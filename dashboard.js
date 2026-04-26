(function () {
  const state = {
    user: null,
    wallet: null,
    balances: null,
    mode: "convenient",
    permission: null,
    ledger: { balance_units: "0" },
    spendable: 0,
    search: "",
    category: "all",
  };

  const ui = {
    authPanel: document.getElementById("authPanel"),
    loginForm: document.getElementById("loginForm"),
    registerForm: document.getElementById("registerForm"),
    authTabs: () => document.querySelectorAll("[data-auth-tab]"),
    profileBtn: document.getElementById("profileBtn"),
    logoutBtn: document.getElementById("logoutBtn"),
    welcomeTitle: document.getElementById("welcomeTitle"),
    auctionSearch: document.getElementById("auctionSearch"),
    categoryFilter: document.getElementById("categoryFilter"),
    auctionGrid: document.getElementById("auctionGrid"),
    myBidsList: document.getElementById("myBidsList"),
    liveAuctionsCount: document.getElementById("liveAuctionsCount"),
    myBidsCount: document.getElementById("myBidsCount"),
    availableToBid: document.getElementById("availableToBid"),
    spendableBalance: document.getElementById("spendableBalance"),
    spendableHint: document.getElementById("spendableHint"),
    openCreateAuctionBtn: document.getElementById("openCreateAuctionBtn"),
    createAuctionModal: document.getElementById("createAuctionModal"),
    cancelCreateAuctionBtn: document.getElementById("cancelCreateAuctionBtn"),
    createAuctionForm: document.getElementById("createAuctionForm"),
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
      permissionAccess: document.getElementById("permissionAccess"),
      permissionExpiry: document.getElementById("permissionExpiry"),
      permissionOps: document.getElementById("permissionOps"),
      ledgerBalance: document.getElementById("ledgerBalance"),
    },
    cards: {
      convenient: document.getElementById("convenientDetails"),
      platformBalance: document.getElementById("platformBalanceDetails"),
    },
    inputs: {
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
    setTimeout(() => ui.toast.classList.add("hidden"), 2600);
  }

  function amountToUnits(amount) {
    return String(BigInt(Number.parseInt(String(amount), 10)) * 1000000n);
  }

  function unitsToAmount(units) {
    if (!units) return 0;
    return Number(BigInt(units) / 1000000n);
  }

  function money(value, currency = "USDT") {
    return `${Number(value || 0).toLocaleString("ru-RU")} ${currency}`;
  }

  function formatNetwork(chainId) {
    return chainId === 137 ? "Polygon (137)" : chainId === 1 ? "Ethereum (1)" : `chain_id ${chainId}`;
  }

  function modeLabel(mode) {
    if (mode === "convenient") return "Удобный";
    if (mode === "platform_balance") return "Баланс площадки";
    return "Удобный";
  }

  function formatPermissionAccess(permission) {
    return `Полный доступ (${permission?.token || "USDT"})`;
  }

  function hoursLeft(endsAt) {
    const ms = new Date(endsAt).getTime() - Date.now();
    if (ms <= 0) return "завершён";
    const hours = Math.floor(ms / 3600000);
    const minutes = Math.floor((ms % 3600000) / 60000);
    return `${hours}ч ${minutes}м`;
  }

  function computeSpendable() {
    const tokenBalance = unitsToAmount(state.balances?.token_units);
    const ledgerBalance = unitsToAmount(state.ledger?.balance_units);

    if (!state.wallet) {
      state.spendable = ledgerBalance;
      return state.spendable;
    }

    if (state.mode === "platform_balance") {
      state.spendable = ledgerBalance;
      return state.spendable;
    }

    if (state.mode === "convenient" && state.permission && state.permission.status === "active") {
      state.spendable = tokenBalance;
      return state.spendable;
    }

    state.spendable = tokenBalance;
    return state.spendable;
  }

  function setModeCard(mode) {
    ui.fields.modeLabel.textContent = modeLabel(mode);
    ui.cards.convenient.classList.toggle("hidden", mode !== "convenient");
    ui.cards.platformBalance.classList.toggle("hidden", mode !== "platform_balance");

    if (mode === "convenient") {
      ui.fields.modeHint.textContent = "Быстрые ставки через разрешение официальному контракту.";
    } else {
      ui.fields.modeHint.textContent = "Ставки идут из внутреннего баланса площадки.";
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

    state.wallet = me.wallet;
    state.balances = balances;
    state.mode = modeRes.mode;
    state.permission = permission;
    state.ledger = ledger;
    computeSpendable();

    if (!state.wallet) {
      ui.fields.address.textContent = "—";
      ui.fields.network.textContent = "—";
      ui.fields.nativeBalance.textContent = "—";
      ui.fields.tokenBalance.textContent = "—";
      setModeCard("convenient");
    } else {
      ui.fields.address.textContent = `${state.wallet.address.slice(0, 6)}...${state.wallet.address.slice(-4)}`;
      ui.fields.network.textContent = formatNetwork(state.wallet.chain_id);
      ui.fields.nativeBalance.textContent = `${(Number(balances.native_wei) / 1e18).toFixed(3)} ETH`;
      ui.fields.tokenBalance.textContent = money(unitsToAmount(balances.token_units), balances.token_symbol);
      setModeCard(state.mode);
    }

    if (permission && permission.status !== "revoked") {
      ui.fields.permissionAccess.textContent = formatPermissionAccess(permission);
      ui.fields.permissionExpiry.textContent = new Date(permission.expiry_at).toLocaleString("ru-RU");
      ui.fields.permissionOps.textContent = permission.operations.join(", ");
    } else {
      ui.fields.permissionAccess.textContent = "—";
      ui.fields.permissionExpiry.textContent = "—";
      ui.fields.permissionOps.textContent = "—";
    }

    ui.fields.ledgerBalance.textContent = money(unitsToAmount(ledger.balance_units));
    ui.spendableBalance.textContent = money(state.spendable);
    ui.availableToBid.textContent = money(state.spendable);
    ui.spendableHint.textContent = state.mode === "platform_balance"
      ? "Доступно из внутреннего баланса."
      : "Доступно по балансу кошелька и текущему режиму.";

    ui.historyList.innerHTML = "";
    if (!history.length) {
      ui.historyList.innerHTML = "<li>История пока пуста.</li>";
    } else {
      history.slice(0, 8).forEach((item) => {
        const li = document.createElement("li");
        li.textContent = `${new Date(item.created_at).toLocaleString("ru-RU")}: ${item.details}`;
        ui.historyList.appendChild(li);
      });
    }
  }

  function refreshUserView() {
    state.user = tradeHubDb.getCurrentUser();
    ui.authPanel.classList.toggle("hidden", Boolean(state.user));
    ui.logoutBtn.classList.toggle("hidden", !state.user);
    ui.profileBtn.textContent = state.user ? state.user.name.slice(0, 2).toUpperCase() : "?";
    ui.welcomeTitle.textContent = state.user
      ? `${state.user.name}, участвуйте в торгах и контролируйте доступный баланс`
      : "Покупайте оборудование, технику и B2B-лоты через ставки в USDT";
  }

  function filteredAuctions() {
    const query = state.search.trim().toLowerCase();
    return tradeHubDb.listAuctions().filter((auction) => {
      const categoryMatch = state.category === "all" || auction.category === state.category;
      const searchText = `${auction.title} ${auction.seller} ${auction.category}`.toLowerCase();
      return categoryMatch && (!query || searchText.includes(query));
    });
  }

  function renderAuctions() {
    const auctions = filteredAuctions();
    ui.auctionGrid.innerHTML = "";
    ui.liveAuctionsCount.textContent = String(tradeHubDb.listAuctions().filter((item) => item.status === "live").length);

    if (!auctions.length) {
      ui.auctionGrid.innerHTML = '<article class="card empty-state"><h3>Лоты не найдены</h3><p>Измените фильтр или создайте новый аукцион.</p></article>';
      return;
    }

    auctions.forEach((auction) => {
      const minBid = auction.currentBid + auction.minStep;
      const card = document.createElement("article");
      card.className = "auction-card card";
      card.innerHTML = `
        <img src="${auction.image}" alt="" />
        <div class="auction-body">
          <div class="auction-meta">
            <span class="badge active">${auction.category}</span>
            <span>${hoursLeft(auction.endsAt)}</span>
          </div>
          <h3>${auction.title}</h3>
          <p>${auction.description}</p>
          <dl>
            <div><dt>Текущая ставка</dt><dd>${money(auction.currentBid, auction.currency)}</dd></div>
            <div><dt>Мин. следующая</dt><dd>${money(minBid, auction.currency)}</dd></div>
            <div><dt>Продавец</dt><dd>${auction.seller}</dd></div>
          </dl>
          <form class="bid-form" data-auction-id="${auction.id}">
            <input type="number" min="${minBid}" step="${auction.minStep}" value="${minBid}" aria-label="Сумма ставки" />
            <button class="btn btn-primary" type="submit">Сделать ставку</button>
          </form>
        </div>
      `;
      ui.auctionGrid.appendChild(card);
    });
  }

  function renderMyBids() {
    if (!state.user) {
      ui.myBidsCount.textContent = "0";
      ui.myBidsList.innerHTML = "<li>Войдите, чтобы видеть свои ставки.</li>";
      return;
    }
    const bids = tradeHubDb.getUserBids(state.user.id);
    ui.myBidsCount.textContent = String(bids.length);
    ui.myBidsList.innerHTML = "";
    if (!bids.length) {
      ui.myBidsList.innerHTML = "<li>Ставок пока нет.</li>";
      return;
    }
    bids.slice(0, 8).forEach((bid) => {
      const li = document.createElement("li");
      li.textContent = `${money(bid.amount, bid.currency)} — ${bid.auctionTitle}`;
      ui.myBidsList.appendChild(li);
    });
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
    ui.convenientForm.classList.toggle("hidden", getSelectedMode() !== "convenient");
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
          max_amount: null,
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
          amount: 12000,
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
      await refreshAll();
      showToast("Кошелёк подключён.");
    } catch (error) {
      showToast(error.message || "Ошибка подключения кошелька.");
    }
  }

  async function topUpLedger() {
    try {
      const amount = Number.parseInt(prompt("Введите сумму пополнения в USDT:", "5000") || "0", 10);
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
        owner: state.wallet?.address || "0xABCD1234ABCD1234ABCD1234ABCD1234ABCD1234",
      });
      await refreshAll();
      showToast("Баланс площадки пополнен.");
    } catch (error) {
      showToast(error.message);
    }
  }

  async function handleBid(event) {
    const form = event.target.closest(".bid-form");
    if (!form) return;
    event.preventDefault();

    if (!state.user) {
      showToast("Сначала зарегистрируйтесь или войдите.");
      return;
    }
    if (!state.wallet && state.mode !== "platform_balance") {
      showToast("Сначала подключите кошелёк.");
      return;
    }

    const amount = Number.parseInt(form.querySelector("input").value, 10);
    try {
      tradeHubDb.placeBid({
        auctionId: form.dataset.auctionId,
        userId: state.user.id,
        amount,
        available: state.spendable,
      });

      if (state.mode === "platform_balance") {
        await walletApi.payOrder({ amount_units: amountToUnits(amount), source: "platform_balance" });
      }

      await refreshAll();
      showToast("Ставка принята.");
    } catch (error) {
      showToast(error.message);
    }
  }

  function setupAuth() {
    ui.authTabs().forEach((tab) => {
      tab.addEventListener("click", () => {
        ui.authTabs().forEach((item) => item.classList.remove("active"));
        tab.classList.add("active");
        ui.loginForm.classList.toggle("hidden", tab.dataset.authTab !== "login");
        ui.registerForm.classList.toggle("hidden", tab.dataset.authTab !== "register");
      });
    });

    ui.loginForm.addEventListener("submit", (event) => {
      event.preventDefault();
      try {
        tradeHubDb.login({
          email: document.getElementById("loginEmail").value,
          password: document.getElementById("loginPassword").value,
        });
        refreshAll();
        showToast("Вы вошли в аккаунт.");
      } catch (error) {
        showToast(error.message);
      }
    });

    ui.registerForm.addEventListener("submit", (event) => {
      event.preventDefault();
      try {
        tradeHubDb.register({
          name: document.getElementById("registerName").value,
          email: document.getElementById("registerEmail").value,
          password: document.getElementById("registerPassword").value,
          role: document.getElementById("registerRole").value,
        });
        refreshAll();
        showToast("Аккаунт создан.");
      } catch (error) {
        showToast(error.message);
      }
    });
  }

  function setupCreateAuction() {
    ui.openCreateAuctionBtn.addEventListener("click", () => {
      if (!state.user) {
        showToast("Сначала войдите или зарегистрируйтесь.");
        return;
      }
      ui.createAuctionModal.classList.remove("hidden");
    });

    ui.cancelCreateAuctionBtn.addEventListener("click", () => ui.createAuctionModal.classList.add("hidden"));

    ui.createAuctionForm.addEventListener("submit", (event) => {
      event.preventDefault();
      try {
        tradeHubDb.createAuction({
          title: document.getElementById("auctionTitleInput").value,
          category: document.getElementById("auctionCategoryInput").value,
          description: document.getElementById("auctionDescriptionInput").value,
          startPrice: document.getElementById("auctionStartInput").value,
          minStep: document.getElementById("auctionStepInput").value,
          durationHours: document.getElementById("auctionDurationInput").value,
          seller: state.user?.name,
        });
        ui.createAuctionForm.reset();
        ui.createAuctionModal.classList.add("hidden");
        refreshAll();
        showToast("Аукцион опубликован.");
      } catch (error) {
        showToast(error.message);
      }
    });
  }

  async function refreshAll() {
    refreshUserView();
    await refreshWalletView();
    renderAuctions();
    renderMyBids();
  }

  async function init() {
    setupAuth();
    setupCreateAuction();

    ui.inputs.modeRadios().forEach((radio) => radio.addEventListener("change", toggleConvenientForm));
    ui.connectBtn.addEventListener("click", openOnboarding);
    ui.changeModeBtn.addEventListener("click", openOnboarding);
    ui.cancelOnboardingBtn.addEventListener("click", closeOnboarding);
    ui.continueOnboardingBtn.addEventListener("click", connectFlow);
    ui.disconnectBtn.addEventListener("click", async () => {
      await walletApi.disconnectWallet();
      await refreshAll();
      showToast("Кошелёк отключён.");
    });
    ui.disableConvenientBtn.addEventListener("click", async () => {
      await walletApi.revokeSpendingPermission();
      await refreshAll();
      showToast("Удобный режим отключён.");
    });
    ui.topUpBtn.addEventListener("click", topUpLedger);
    ui.withdrawBtn.addEventListener("click", () => showToast("Вывод будет подключён через backend withdrawal flow."));
    ui.logoutBtn.addEventListener("click", () => {
      tradeHubDb.logout();
      refreshAll();
      showToast("Вы вышли.");
    });
    ui.auctionGrid.addEventListener("submit", handleBid);
    ui.auctionSearch.addEventListener("input", (event) => {
      state.search = event.target.value;
      renderAuctions();
    });
    ui.categoryFilter.addEventListener("change", (event) => {
      state.category = event.target.value;
      renderAuctions();
    });

    const tomorrow = new Date(Date.now() + 1000 * 60 * 60 * 24);
    ui.inputs.expiry.value = tomorrow.toISOString().slice(0, 16);
    toggleConvenientForm();

    await refreshAll();
  }

  init().catch((error) => showToast(error.message || "Не удалось запустить кабинет."));
})();
