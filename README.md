# Telegram Bot

## Spam messages to telegram

Automatic messaging in Telegram

## Using

#### create files:

- accounts.json
- config.json
- contacts.json

#### Add to accounts.json

```
[
  {
    "name": "name",
    "apiId": 12345678,
    "apiHash": "11111111111111111111111111111111",
    "sessionFile": "./sessions/acc1.session"
  },
  {
    "name": "name1",
    "apiId": 12345678,
    "apiHash": "11111111111111111111111111111111",
    "sessionFile": "./sessions/acc2.session"
  },
]
```

#### Add to config.json

```
{
  "timezone": "Europe/Moscow",
  "work_start_hour": 10,
  "work_end_hour": 21,
  "per_account_daily_limit": 100,
  "min_delay_ms": 1000,
  "max_delay_ms": 5000,
  "image_url": "image/url",
  "send_text": "message"
}
```

#### Add to config.json

```
[
  {
    "id": 111111111,
    "username": "name",
    "opt_in": true
  },
  {
    "id": 1111111111,
    "username": "name",
    "opt_in": true
  }
]
```

## Autors

- a10nger
- Blussful