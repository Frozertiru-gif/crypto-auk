(function () {
  const STORAGE_KEY = "tradehub_wallet_state_v1";
  const USE_MOCK_API = true;
  const USER_ID = "user_1001";

  const SUPPORTED_CHAINS = new Set([1, 137]);
  const ALLOWED_TOKENS = {
    USDT: { contract: "0xA0b86991c6218b36c1d19d4a2e9eb0ce3606eb48", decimals: 6 },
    USDC: { contract: "0x2791Bca1f2de4661ED88A30C99A7a9449Aa84174", decimals: 6 },
  };
  const OFFICIAL_SPENDER = "0x1111111111111111111111111111111111111111";
  const OFFICIAL_RECIPIENT = "0x2222222222222222222222222222222222222222";

  function nowIso() {
    return new Date().toISOString();
  }

  function newState() {
    return {
      user_id: USER_ID,
      wallet: null,
      payment_mode: "safe",
      balances: {
        native_wei: "0",
        token_symbol: "USDT",
        token_units: "0",
      },
      permission: null,
      ledger: {
        balance_units: "0",
        transactions: [],
      },
      history: [],
      idempotency: {},
      tx_hashes: [],
    };
  }

  function readState() {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return newState();
    try {
      return JSON.parse(raw);
    } catch (_err) {
      return newState();
    }
  }

  function writeState(state) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    return state;
  }

  function toUnits(value, decimals) {
    const n = Number.parseInt(String(value), 10);
    if (!Number.isFinite(n) || n <= 0) throw new Error("Сумма должна быть целым положительным числом.");
    return String(BigInt(n) * 10n ** BigInt(decimals));
  }

  function assertIdempotent(state, key) {
    if (state.idempotency[key]) return false;
    state.idempotency[key] = nowIso();
    return true;
  }

  function addHistory(state, type, details) {
    state.history.unshift({ id: crypto.randomUUID(), type, details, created_at: nowIso() });
    state.history = state.history.slice(0, 30);
  }

  function mockDelay(payload) {
    return new Promise((resolve) => setTimeout(() => resolve(payload), 120));
  }

  const mockApi = {
    async getWalletMe() {
      const state = readState();
      return mockDelay({ wallet: state.wallet, user_id: state.user_id });
    },

    async connectWallet({ address, chain_id }) {
      const state = readState();
      if (!SUPPORTED_CHAINS.has(chain_id)) throw new Error("Неподдерживаемая сеть.");
      state.wallet = { address, chain_id, connected_at: nowIso() };
      state.balances.native_wei = "1290000000000000000";
      state.balances.token_units = "126000000";
      addHistory(state, "connect", `Подключён кошелёк ${address}`);
      writeState(state);
      return mockDelay({ ok: true, wallet: state.wallet });
    },

    async disconnectWallet() {
      const state = readState();
      state.wallet = null;
      state.payment_mode = "safe";
      state.permission = null;
      addHistory(state, "disconnect", "Кошелёк отключён");
      writeState(state);
      return mockDelay({ ok: true });
    },

    async getBalances() {
      const state = readState();
      return mockDelay(state.balances);
    },

    async getPaymentMode() {
      const state = readState();
      return mockDelay({ mode: state.payment_mode });
    },

    async setPaymentMode({ mode }) {
      const state = readState();
      const prev = state.payment_mode;
      state.payment_mode = mode;
      if (mode !== "convenient" && state.permission) {
        addHistory(state, "permission_warning", "Рекомендуем отозвать ранее выданные разрешения.");
      }
      addHistory(state, "mode_change", `Режим оплаты: ${prev} → ${mode}`);
      writeState(state);
      return mockDelay({ ok: true, mode });
    },

    async initSpendingPermission(payload) {
      const state = readState();
      if (!state.wallet) throw new Error("Сначала подключите кошелёк.");
      if (state.user_id !== USER_ID) throw new Error("Неверный user_id.");
      if (!SUPPORTED_CHAINS.has(payload.chain_id)) throw new Error("Неподдерживаемая сеть.");
      if (!ALLOWED_TOKENS[payload.token]) throw new Error("Неподдерживаемый токен.");
      if (payload.spender !== OFFICIAL_SPENDER) throw new Error("Неверный spender.");
      const token = ALLOWED_TOKENS[payload.token];
      const limit_units = toUnits(payload.max_amount, token.decimals);

      const permission = {
        permission_id: crypto.randomUUID(),
        user_id: USER_ID,
        owner: state.wallet.address,
        chain_id: payload.chain_id,
        token: payload.token,
        token_contract: token.contract,
        max_amount_units: limit_units,
        used_today_units: "0",
        expiry_at: payload.expiry_at,
        operations: payload.operations,
        spender: payload.spender,
        allowed_contracts: [OFFICIAL_RECIPIENT],
        allowed_methods: ["payOrder", "payFee", "placeBid"],
        created_at: nowIso(),
        status: "pending_wallet_confirmation",
      };
      state.permission = permission;
      writeState(state);
      return mockDelay(permission);
    },

    async confirmSpendingPermission({ permission_id, wallet_signature }) {
      const state = readState();
      if (!state.permission || state.permission.permission_id !== permission_id) throw new Error("Разрешение не найдено.");
      if (!wallet_signature) throw new Error("Нет подписи кошелька.");
      state.permission.status = "active";
      addHistory(state, "permission_confirm", `Подтверждён лимит ${state.permission.max_amount_units} units.`);
      writeState(state);
      return mockDelay({ ok: true, permission: state.permission });
    },

    async revokeSpendingPermission() {
      const state = readState();
      if (state.permission) {
        state.permission.status = "revoked";
        addHistory(state, "permission_revoke", "Удобный режим отключён и разрешение отозвано.");
      }
      state.payment_mode = "safe";
      writeState(state);
      return mockDelay({ ok: true });
    },

    async getSpendingPermission() {
      const state = readState();
      return mockDelay(state.permission);
    },

    async initDeposit({ amount, chain_id, token, idempotency_key }) {
      const state = readState();
      if (!assertIdempotent(state, idempotency_key)) return mockDelay({ reused: true });
      if (!SUPPORTED_CHAINS.has(chain_id)) throw new Error("Неподдерживаемая сеть.");
      if (!ALLOWED_TOKENS[token]) throw new Error("Неподдерживаемый токен.");
      const units = toUnits(amount, ALLOWED_TOKENS[token].decimals);
      const deposit = {
        deposit_id: crypto.randomUUID(),
        chain_id,
        token,
        recipient: OFFICIAL_RECIPIENT,
        amount_units: units,
        status: "awaiting_tx",
      };
      state.pending_deposit = deposit;
      writeState(state);
      return mockDelay(deposit);
    },

    async confirmDepositTx({ deposit_id, tx_hash, recipient, owner }) {
      const state = readState();
      if (!state.pending_deposit || state.pending_deposit.deposit_id !== deposit_id) throw new Error("Депозит не найден.");
      if (recipient !== OFFICIAL_RECIPIENT) throw new Error("Неверный recipient.");
      if (owner !== state.wallet?.address) throw new Error("Владелец кошелька не совпадает.");
      if (state.tx_hashes.includes(tx_hash)) throw new Error("tx_hash уже обработан.");
      state.tx_hashes.push(tx_hash);
      state.ledger.balance_units = String(BigInt(state.ledger.balance_units) + BigInt(state.pending_deposit.amount_units));
      state.ledger.transactions.unshift({
        id: crypto.randomUUID(),
        type: "deposit",
        amount_units: state.pending_deposit.amount_units,
        status: "confirmed",
        tx_hash,
        created_at: nowIso(),
      });
      addHistory(state, "deposit", "Пополнение внутреннего баланса подтверждено.");
      state.pending_deposit = null;
      writeState(state);
      return mockDelay({ ok: true });
    },

    async getLedgerMe() {
      const state = readState();
      return mockDelay({ balance_units: state.ledger.balance_units });
    },

    async getLedgerTransactions() {
      const state = readState();
      return mockDelay(state.ledger.transactions);
    },

    async payOrder({ amount_units, source }) {
      const state = readState();
      if (source === "platform_balance") {
        const next = BigInt(state.ledger.balance_units) - BigInt(amount_units);
        if (next < 0n) throw new Error("Недостаточно средств на внутреннем балансе.");
        state.ledger.balance_units = String(next);
        state.ledger.transactions.unshift({
          id: crypto.randomUUID(),
          type: "spend",
          amount_units,
          status: "confirmed",
          tx_hash: null,
          created_at: nowIso(),
        });
        addHistory(state, "spend", "Покупка оплачена с внутреннего баланса без blockchain-транзакции.");
      }
      writeState(state);
      return mockDelay({ ok: true });
    },

    async getHistory() {
      const state = readState();
      return mockDelay(state.history);
    },
  };

  const productionApi = {
    getWalletMe: () => Promise.reject(new Error("Production API не подключен.")),
    connectWallet: () => Promise.reject(new Error("Production API не подключен.")),
    disconnectWallet: () => Promise.reject(new Error("Production API не подключен.")),
    getBalances: () => Promise.reject(new Error("Production API не подключен.")),
    getPaymentMode: () => Promise.reject(new Error("Production API не подключен.")),
    setPaymentMode: () => Promise.reject(new Error("Production API не подключен.")),
    initSpendingPermission: () => Promise.reject(new Error("Production API не подключен.")),
    confirmSpendingPermission: () => Promise.reject(new Error("Production API не подключен.")),
    revokeSpendingPermission: () => Promise.reject(new Error("Production API не подключен.")),
    getSpendingPermission: () => Promise.reject(new Error("Production API не подключен.")),
    initDeposit: () => Promise.reject(new Error("Production API не подключен.")),
    confirmDepositTx: () => Promise.reject(new Error("Production API не подключен.")),
    getLedgerMe: () => Promise.reject(new Error("Production API не подключен.")),
    getLedgerTransactions: () => Promise.reject(new Error("Production API не подключен.")),
    payOrder: () => Promise.reject(new Error("Production API не подключен.")),
    getHistory: () => Promise.reject(new Error("Production API не подключен.")),
  };

  window.walletApi = USE_MOCK_API ? mockApi : productionApi;
  window.walletApiMeta = { USE_MOCK_API, OFFICIAL_SPENDER, OFFICIAL_RECIPIENT };
})();
