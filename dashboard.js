(function () {
  const ui = {
    connectBtn: document.getElementById("connectWalletBtn"),
    disconnectBtn: document.getElementById("disconnectWalletBtn"),
    changeModeBtn: document.getElementById("changeModeBtn"),
    disableConvenientBtn: document.getElementById("disableConvenientBtn"),
    topUpBtn: document.getElementById("topUpBtn"),
    withdrawBtn: document.getElementById("withdrawBtn"),
    onboarding: document.getElementById("web3Onboarding"),
    cancelOnboardingBtn: document.getElementById("cancelOnboardingBtn"),
    continueOnboardingBtn: document.getElementById("continueOnboardingBtn"),
    convenientForm: document.getElementById("convenientModeForm"),
    toast: document.getElementById("walletToast"),
    historyList: document.getElementById("walletHistoryList"),
    fields: {
      address: document.getElementById("walletAddress"),
      network: document.getElementById("walletNetwork"),
      nativeBalance: document.getElementById("walletNativeBalance"),
      tokenBalance: document.getElementById("walletTokenBalance"),
      modeLabel: document.getElementById("paymentModeLabel"),
      modeHint: document.getElementById("paymentModeHint"),
      permissionLimit: document.getElementById("permissionLimit"),
      permissionUsedToday: document.getElementById("permissionUsedToday"),
      permissionExpiry: document.getElementById("permissionExpiry"),
      permissionOps: document.getElementById("permissionOps"),
      ledgerBalance: document.getElementById("ledgerBalance"),
    },
    cards: {
      convenient: document.getElementById("convenientDetails"),
      platformBalance: document.getElementById("platformBalanceDetails"),
    },
    inputs: {
      limit: document.getElementById("limitInput"),
      expiry: document.getElementById("expiryInput"),
      network: document.getElementById("networkInput"),
      token: document.getElementById("tokenInput"),
      modeRadios: () => document.querySelectorAll("input[name='paymentMode']"),
      opChecks: () => ui.convenientForm.querySelectorAll("input[type='checkbox']"),
    },
  };

  function showToast(message) {
    ui.toast.textContent = message;
    ui.toast.classList.remove("hidden");
    setTimeout(() => ui.toast.classList.add("hidden"), 2400);
  }

  function formatNetwork(chainId) {
    return chainId === 137 ? "Polygon (137)" : chainId === 1 ? "Ethereum (1)" : `chain_id ${chainId}`;
  }

  function unitsToAmount(units) {
    return Number(BigInt(units) / 1000000n);
  }

  function modeLabel(mode) {
    if (mode === "convenient") return "Удобный";
    if (mode === "platform_balance") return "Баланс площадки";
    return "Безопасный";
  }

  function setModeCard(mode) {
    ui.fields.modeLabel.textContent = modeLabel(mode);
    ui.cards.convenient.classList.toggle("hidden", mode !== "convenient");
    ui.cards.platformBalance.classList.toggle("hidden", mode !== "platform_balance");

    if (mode === "safe") {
      ui.fields.modeHint.textContent = "Подключение кошелька не списывает средства. Для платежей выберите удобный режим или баланс площадки.";
    } else if (mode === "convenient") {
      ui.fields.modeHint.textContent = "Для автосписаний вы задаёте лимит и срок. Платформа не запрашивает безлимитный доступ.";
    } else {
      ui.fields.modeHint.textContent = "Баланс площадки позволяет оплачивать сделки без повторных подтверждений.";
    }
  }

  async function refreshWalletView() {
    const [me, balances, modeRes, permission, ledger, history] = await Promise.all([
      walletApi.getWalletMe(),
      walletApi.getBalances(),
      walletApi.getPaymentMode(),
      walletApi.getSpendingPermission(),
      walletApi.getLedgerMe(),
      walletApi.getHistory(),
    ]);

    const wallet = me.wallet;
    if (!wallet) {
      ui.fields.address.textContent = "—";
      ui.fields.network.textContent = "—";
      ui.fields.nativeBalance.textContent = "—";
      ui.fields.tokenBalance.textContent = "—";
      setModeCard("safe");
    } else {
      ui.fields.address.textContent = wallet.address;
      ui.fields.network.textContent = formatNetwork(wallet.chain_id);
      ui.fields.nativeBalance.textContent = `${(Number(balances.native_wei) / 1e18).toFixed(3)} ETH`;
      ui.fields.tokenBalance.textContent = `${unitsToAmount(balances.token_units)} ${balances.token_symbol}`;
      setModeCard(modeRes.mode);
    }

    if (permission && permission.status !== "revoked") {
      ui.fields.permissionLimit.textContent = `${unitsToAmount(permission.max_amount_units)} ${permission.token}`;
      ui.fields.permissionUsedToday.textContent = `${unitsToAmount(permission.used_today_units)} ${permission.token}`;
      ui.fields.permissionExpiry.textContent = new Date(permission.expiry_at).toLocaleString("ru-RU");
      ui.fields.permissionOps.textContent = permission.operations.join(", ");
    } else {
      ui.fields.permissionLimit.textContent = "—";
      ui.fields.permissionUsedToday.textContent = "—";
      ui.fields.permissionExpiry.textContent = "—";
      ui.fields.permissionOps.textContent = "—";
    }

    ui.fields.ledgerBalance.textContent = `${unitsToAmount(ledger.balance_units)} USDT`;

    ui.historyList.innerHTML = "";
    if (!history.length) {
      ui.historyList.innerHTML = "<li>История пока пуста.</li>";
    } else {
      history.forEach((item) => {
        const li = document.createElement("li");
        li.textContent = `${new Date(item.created_at).toLocaleString("ru-RU")}: ${item.details}`;
        ui.historyList.appendChild(li);
      });
    }
  }

  function openOnboarding() {
    ui.onboarding.classList.remove("hidden");
  }

  function closeOnboarding() {
    ui.onboarding.classList.add("hidden");
  }

  function getSelectedMode() {
    const selected = [...ui.inputs.modeRadios()].find((el) => el.checked);
    return selected ? selected.value : null;
  }

  function toggleConvenientForm() {
    const selectedMode = getSelectedMode();
    ui.convenientForm.classList.toggle("hidden", selectedMode !== "convenient");
  }

  async function connectFlow() {
    const mode = getSelectedMode();
    if (!mode) {
      showToast("Сначала выберите режим оплаты.");
      return;
    }

    try {
      await walletApi.connectWallet({
        address: "0xABCD1234ABCD1234ABCD1234ABCD1234ABCD1234",
        chain_id: Number(ui.inputs.network.value || 137),
      });

      if (mode === "convenient") {
        const ops = [...ui.inputs.opChecks()].filter((el) => el.checked).map((el) => el.value);
        if (!ops.length) {
          showToast("Выберите хотя бы один тип операций.");
          return;
        }

        const init = await walletApi.initSpendingPermission({
          max_amount: ui.inputs.limit.value,
          expiry_at: ui.inputs.expiry.value,
          token: ui.inputs.token.value,
          chain_id: Number(ui.inputs.network.value),
          operations: ops,
          spender: window.walletApiMeta.OFFICIAL_SPENDER,
        });

        await walletApi.confirmSpendingPermission({
          permission_id: init.permission_id,
          wallet_signature: "mock_user_signature",
        });
      }

      if (mode === "platform_balance") {
        const deposit = await walletApi.initDeposit({
          amount: 50,
          chain_id: 137,
          token: "USDT",
          idempotency_key: `deposit-${Date.now()}`,
        });
        await walletApi.confirmDepositTx({
          deposit_id: deposit.deposit_id,
          tx_hash: `0x${Date.now().toString(16)}abc`,
          recipient: window.walletApiMeta.OFFICIAL_RECIPIENT,
          owner: "0xABCD1234ABCD1234ABCD1234ABCD1234ABCD1234",
        });
      }

      await walletApi.setPaymentMode({ mode });
      closeOnboarding();
      await refreshWalletView();
      showToast("Кошелёк подключён безопасно.");
    } catch (error) {
      showToast(error.message || "Ошибка подключения кошелька.");
    }
  }

  async function topUpLedger() {
    try {
      const amount = Number.parseInt(prompt("Введите сумму пополнения в USDT (целое число):", "25") || "0", 10);
      if (!amount) return;
      const deposit = await walletApi.initDeposit({
        amount,
        chain_id: 137,
        token: "USDT",
        idempotency_key: `deposit-manual-${Date.now()}`,
      });
      await walletApi.confirmDepositTx({
        deposit_id: deposit.deposit_id,
        tx_hash: `0x${Date.now().toString(16)}ff`,
        recipient: window.walletApiMeta.OFFICIAL_RECIPIENT,
        owner: "0xABCD1234ABCD1234ABCD1234ABCD1234ABCD1234",
      });
      await refreshWalletView();
      showToast("Баланс площадки пополнен.");
    } catch (error) {
      showToast(error.message);
    }
  }

  async function init() {
    ui.inputs.modeRadios().forEach((radio) => radio.addEventListener("change", toggleConvenientForm));

    ui.connectBtn.addEventListener("click", openOnboarding);
    ui.changeModeBtn.addEventListener("click", openOnboarding);

    ui.cancelOnboardingBtn.addEventListener("click", () => {
      closeOnboarding();
      showToast("Крипто-функции не активированы.");
    });

    ui.continueOnboardingBtn.addEventListener("click", connectFlow);

    ui.disconnectBtn.addEventListener("click", async () => {
      await walletApi.disconnectWallet();
      await refreshWalletView();
      showToast("Кошелёк отключён.");
    });

    ui.disableConvenientBtn.addEventListener("click", async () => {
      await walletApi.revokeSpendingPermission();
      await refreshWalletView();
      showToast("Удобный режим отключён.");
    });

    ui.topUpBtn.addEventListener("click", topUpLedger);

    ui.withdrawBtn.addEventListener("click", () => {
      showToast("Вывод доступен в отдельном flow “Вывести”.");
    });

    await refreshWalletView();
  }

  init().catch((error) => {
    showToast(error.message || "Не удалось инициализировать кошелёк.");
  });
})();
