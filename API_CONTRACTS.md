# API-контракты кошелька и оплат

> Статус: **mock-first**. В `wallet-api.js` используется `USE_MOCK_API = true`.
> Для production переключите флаг на `false` и реализуйте методы `productionApi`.

## Wallet

- `GET /api/wallet/me`
- `POST /api/wallet/connect`
- `POST /api/wallet/disconnect`
- `GET /api/wallet/balances`
- `GET /api/wallet/payment-mode`
- `POST /api/wallet/payment-mode`

## Spending permission

- `POST /api/wallet/spending-permission/init`
- `POST /api/wallet/spending-permission/confirm`
- `POST /api/wallet/spending-permission/revoke`
- `GET /api/wallet/spending-permission`

## Deposits and ledger

- `POST /api/deposits/init`
- `POST /api/deposits/confirm-tx`
- `GET /api/deposits/{deposit_id}`
- `GET /api/ledger/me`
- `GET /api/ledger/transactions`
- `POST /api/orders/pay`

## Требования безопасности (контракт)

- Суммы передаются только integer в минимальных единицах (`*_units`, `*_wei`).
- Для `connect`, `permission`, `deposit` обязателен `chain_id` и проверка supported chains.
- Для токенов обязателен whitelist контрактов и символов.
- Для удобного режима:
  - запрет `MaxUint256` и unlimited approve;
  - `spender` только официальный treasury contract.
- Для депозитов:
  - `recipient` только официальный treasury/deposit адрес;
  - `tx_hash` уникален в системе.
- Все permission привязаны к `user_id` и `owner wallet`.
- Permission не действует после `expiry_at`.
- Daily limit считается backend-ом.
- Все операции идемпотентны (`idempotency_key`).
- Все операции логируются в историю.

