const fs = require('fs');
const path = require('path');
const readline = require('readline');
const { TelegramClient } = require('telegram');
const { StringSession } = require('telegram/sessions');

function ask(query) {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  return new Promise(resolve => rl.question(query, ans => { rl.close(); resolve(ans); }));
}

const ACCOUNTS_FILE = path.resolve(__dirname, 'accounts.json');
if (!fs.existsSync(ACCOUNTS_FILE)) {
  console.error('Не найден accounts.json');
  process.exit(1);
}
const accounts = JSON.parse(fs.readFileSync(ACCOUNTS_FILE, 'utf8'));

async function loginOne(acfg) {
  console.log(`\n=== Авторизация аккаунта: ${acfg.name} ===`);
  const sessDir = path.dirname(acfg.sessionFile);
  if (!fs.existsSync(sessDir)) fs.mkdirSync(sessDir, { recursive: true });

  if (fs.existsSync(acfg.sessionFile) && fs.readFileSync(acfg.sessionFile, 'utf8').trim()) {
    console.log('Уже есть session, пропускаем.');
    return;
  }

  const session = new StringSession('');
  const client = new TelegramClient(session, acfg.apiId, acfg.apiHash, { connectionRetries: 5 });

  await client.start({
    phoneNumber: async () => await ask('Телефон (+7...): '),
    phoneCode: async () => await ask('Код из Telegram: '),
    password: async () => await ask('Пароль 2FA (если есть, иначе Enter): '),
    onError: err => console.error(err)
  });

  fs.writeFileSync(acfg.sessionFile, client.session.save(), 'utf8');
  console.log(`Сессия сохранена -> ${acfg.sessionFile}`);
  await client.disconnect();
}

(async () => {
  for (const ac of accounts) {
    await loginOne(ac);
  }
  console.log('\nВсе аккаунты авторизованы.');
  process.exit(0);
})();
