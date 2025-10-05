const fs = require('fs');
const { TelegramClient } = require('telegram');
const { StringSession } = require('telegram/sessions');
const dayjs = require('dayjs');
const utc = require('dayjs/plugin/utc');
const tz = require('dayjs/plugin/timezone');

dayjs.extend(utc);
dayjs.extend(tz);

const config = JSON.parse(fs.readFileSync('./config.json', 'utf8'));
const accountsCfg = JSON.parse(fs.readFileSync('./accounts.json', 'utf8'));

function inWorkingHours() {
  const now = dayjs().tz(config.timezone);
  return now.hour() >= config.work_start_hour && now.hour() < config.work_end_hour;
}

function sleep(ms) {
  return new Promise(r => setTimeout(r, ms));
}

async function withTimeout(promise, ms) {
  let timeout = new Promise((_, reject) =>
    setTimeout(() => reject(new Error('Превышено время ожидания отправки сообщения')), ms)
  );
  return Promise.race([promise, timeout]);
}

async function createClient(acfg) {
  try {
    const sessionStr = fs.existsSync(acfg.sessionFile) ? fs.readFileSync(acfg.sessionFile, 'utf8') : '';
    if (!sessionStr.trim()) {
      console.warn(`Сессия отсутствует или пустая для аккаунта ${acfg.name}, пропускаем.`);
      return null;
    }
    const client = new TelegramClient(new StringSession(sessionStr), acfg.apiId, acfg.apiHash, { connectionRetries: 5 });
    await client.connect();
    client.name = acfg.name;

    client.on('error', err => {
      console.warn(`Ошибка клиента ${client.name}: ${err.message || err}`);
    });

    console.log(`Аккаунт ${acfg.name} подключен.`);
    return client;
  } catch (e) {
    console.error(`Ошибка подключения аккаунта ${acfg.name}: ${e.message}`);
    return null;
  }
}

async function getEntity(client, contact) {
  try {
    if (contact.username) {
      return await client.getEntity(contact.username);
    } else if (contact.id) {
      return await client.getEntity(contact.id);
    }
    throw new Error('Контакт не содержит корректного username или id');
  } catch (e) {
    if (e.message.includes('401')) {
      console.warn(`Ошибка 401 у аккаунта ${client.name} при получении entity для ${contact.username || contact.id}`);
      return null;
    }
    if (e.message.includes('Нет user has')) {
      console.warn(`Пользователь ${contact.username || contact.id} не найден для аккаунта ${client.name}`);
      return null;
    }
    throw e;
  }
}

async function hasResponded(client, contact, lastSent) {
  try {
    const entity = await getEntity(client, contact);
    if (!entity) return false;

    const history = await client.getMessages(entity, { limit: 20 });

    for (const msg of history) {
      if (msg.out === false && dayjs(msg.date).isAfter(lastSent)) {
        return true;
      }
    }
    return false;
  } catch (e) {
    console.warn(`Ошибка при проверке ответа от ${contact.username || contact.id}: ${e.message}`);
    return false;
  }
}

async function sendMessageIfNeeded(client, contact) {
  if (!inWorkingHours()) {
    console.log('Вне рабочего времени, отправка пропущена.');
    return false;
  }

  const lastSent = contact.lastSent ? dayjs(contact.lastSent) : dayjs(0);
  const now = dayjs().tz(config.timezone);

  if (now.diff(lastSent, 'day') < 14) {
    console.log(`Сообщение для ${contact.username || contact.id} было отправлено недавно (${lastSent.format()}), пропускаем.`);
    return false;
  }

  if (await hasResponded(client, contact, lastSent)) {
    console.log(`Пользователь ${contact.username || contact.id} ответил после последней рассылки. Сообщение не отправляется.`);
    return false;
  }

  try {
    const entity = await getEntity(client, contact);
    if (!entity) {
      console.log(`Пропускаем ${contact.username || contact.id} из-за ошибки получения entity.`);
      return false;
    }

    await withTimeout(
      client.sendMessage(entity, {
        message: config.send_text,
        file: config.image_url
      }),
      30000
    );

    console.log(`✅ Сообщение отправлено ${contact.username || contact.id} через аккаунт ${client.name}`);

    contact.lastSent = now.toISOString();
    return true;
  } catch (e) {
    console.error(`❌ Ошибка при отправке сообщения ${contact.username || contact.id} через аккаунт ${client.name}: ${e.message}`);
    return false;
  }
}

function saveContacts(contacts) {
  fs.writeFileSync('./contacts.json', JSON.stringify(contacts, null, 2), 'utf8');
  console.log('Файл contacts.json обновлен с новыми датами рассылок.');
}

(async () => {
  const contacts = JSON.parse(fs.readFileSync('./contacts.json', 'utf8')).filter(c => c.opt_in);
  const clients = [];

  for (const ac of accountsCfg) {
    const c = await createClient(ac);
    if (c) clients.push(c);
  }
  if (clients.length === 0) {
    console.error('Нет доступных клиентов для отправки сообщений.');
    process.exit(1);
  }

  while (true) {
    for (const client of clients) {
      for (const contact of contacts) {
        await sendMessageIfNeeded(client, contact);
        // await sleep(1000);
      }
    }

    saveContacts(contacts);

    await sleep(60 * 60 * 1000);
  }
})();