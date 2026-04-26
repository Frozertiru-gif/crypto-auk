# TradeHub Crypto Auction MVP

Статический MVP крипто-аукциона для крупных сделок в USDT.

## Что реализовано

- публичная landing-страница `index.html`;
- кабинет `dashboard.html`;
- регистрация, вход и сессия через mock-базу в `localStorage`;
- live-аукционы, фильтр, поиск, создание лота;
- ставки с проверкой минимального шага и доступной суммы;
- кошелёк с двумя режимами оплаты: convenient и platform balance;
- расчёт "можно потратить" для ставок;
- история ставок и операций кошелька;
- адаптивный UI и базовые анимации.

## Локальный запуск

Откройте `index.html` в браузере или запустите локальный сервер:

```bash
python -m http.server 4173
```

После запуска:

- главная: `http://localhost:4173/index.html`;
- кабинет: `http://localhost:4173/dashboard.html`.

## Важно

`app-db.js` и `wallet-api.js` используют mock-first подход. Это не production-хранение и не настоящая blockchain-интеграция. Следующий этап: заменить localStorage/API mocks на backend, базу данных, WalletConnect/MetaMask provider и on-chain проверки.
