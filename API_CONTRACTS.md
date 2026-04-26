# API-контракты кошелька и оплат

> Статус: **mock-first**. В `wallet-api.js` используется `USE_MOCK_API = true`.
> Для production переключите флаг на `false` и реализуйте методы `productionApi`.
> Пользователи, аукционы и ставки сейчас хранятся в `app-db.js` через `localStorage`.

## Auth and auction

- `POST /api/auth/register`
- `POST /api/auth/login`
- `POST /api/auth/logout`
- `GET /api/auth/me`
- `GET /api/auctions`
- `POST /api/auctions`
- `GET /api/auctions/{auction_id}`
- `POST /api/auctions/{auction_id}/bids`
- `GET /api/users/me/bids`

## Основные сущности

- `users`: профиль, email, роль, KYC/verification статус.
- `auctions`: название, категория, описание, продавец, текущая ставка, шаг, срок, статус.
- `bids`: пользователь, аукцион, сумма, время, источник оплаты.
- `ledger_transactions`: депозиты, списания, выводы, заморозки и финализация.
- `wallet_permissions`: режим, token, chain_id, spender, полный доступ по сумме, срок действия.

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
  - `max_amount_units` всегда `null`: сумма не ограничивается на уровне UX;
  - `spender` только официальный treasury contract.
- Для депозитов:
  - `recipient` только официальный treasury/deposit адрес;
  - `tx_hash` уникален в системе.
- Все permission привязаны к `user_id` и `owner wallet`.
- Permission не действует после `expiry_at`.
- Все операции идемпотентны (`idempotency_key`).
- Все операции логируются в историю.

