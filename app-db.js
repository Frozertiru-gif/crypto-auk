(function () {
  const DB_KEY = "tradehub_market_db_v1";
  const SESSION_KEY = "tradehub_session_v1";

  const seedAuctions = [
    {
      id: "auc-miner-001",
      title: "ASIC Antminer S21 Pro, партия 10 шт.",
      category: "Оборудование",
      image:
        "https://images.unsplash.com/photo-1621501103258-3e135c8c1fda?auto=format&fit=crop&w=1200&q=80",
      description: "Поставка новой партии майнингового оборудования с проверкой серийных номеров и документами.",
      seller: "NordHash Supply",
      location: "Москва",
      currency: "USDT",
      startPrice: 8200,
      currentBid: 9400,
      minStep: 100,
      endsAt: new Date(Date.now() + 1000 * 60 * 60 * 9).toISOString(),
      status: "live",
      bids: [
        { id: "bid-1", userId: "seed-buyer", amount: 9000, createdAt: new Date(Date.now() - 3600000).toISOString() },
        { id: "bid-2", userId: "seed-buyer-2", amount: 9400, createdAt: new Date(Date.now() - 1400000).toISOString() },
      ],
    },
    {
      id: "auc-gpu-002",
      title: "GPU RTX 4090, 24 GB, 6 единиц",
      category: "Электроника",
      image:
        "https://images.unsplash.com/photo-1591488320449-011701bb6704?auto=format&fit=crop&w=1200&q=80",
      description: "Комплект видеокарт для рендера, ML и вычислительных задач. Проверка перед передачей.",
      seller: "Compute Yard",
      location: "Санкт-Петербург",
      currency: "USDT",
      startPrice: 7800,
      currentBid: 8100,
      minStep: 100,
      endsAt: new Date(Date.now() + 1000 * 60 * 60 * 28).toISOString(),
      status: "live",
      bids: [{ id: "bid-3", userId: "seed-buyer", amount: 8100, createdAt: new Date(Date.now() - 7200000).toISOString() }],
    },
    {
      id: "auc-server-003",
      title: "Серверный шкаф с сетевым оборудованием",
      category: "B2B",
      image:
        "https://images.unsplash.com/photo-1558494949-ef010cbdcc31?auto=format&fit=crop&w=1200&q=80",
      description: "Готовый комплект для малого дата-центра: стойка, коммутаторы, PDU, кабельная организация.",
      seller: "RackPoint",
      location: "Казань",
      currency: "USDT",
      startPrice: 5100,
      currentBid: 5600,
      minStep: 100,
      endsAt: new Date(Date.now() + 1000 * 60 * 60 * 52).toISOString(),
      status: "live",
      bids: [{ id: "bid-4", userId: "seed-buyer-3", amount: 5600, createdAt: new Date(Date.now() - 5400000).toISOString() }],
    },
  ];

  function emptyDb() {
    return {
      users: [],
      auctions: seedAuctions,
      notifications: [],
      audit: [],
    };
  }

  function readDb() {
    const raw = localStorage.getItem(DB_KEY);
    if (!raw) {
      const db = emptyDb();
      writeDb(db);
      return db;
    }
    try {
      return JSON.parse(raw);
    } catch (_err) {
      const db = emptyDb();
      writeDb(db);
      return db;
    }
  }

  function writeDb(db) {
    localStorage.setItem(DB_KEY, JSON.stringify(db));
    return db;
  }

  function readSession() {
    const raw = localStorage.getItem(SESSION_KEY);
    if (!raw) return null;
    try {
      return JSON.parse(raw);
    } catch (_err) {
      return null;
    }
  }

  function setSession(userId) {
    localStorage.setItem(SESSION_KEY, JSON.stringify({ userId, createdAt: new Date().toISOString() }));
  }

  function publicUser(user) {
    if (!user) return null;
    const { password, ...safeUser } = user;
    return safeUser;
  }

  function audit(db, type, details) {
    db.audit.unshift({ id: crypto.randomUUID(), type, details, createdAt: new Date().toISOString() });
    db.audit = db.audit.slice(0, 80);
  }

  function normalizeEmail(email) {
    return String(email || "").trim().toLowerCase();
  }

  const api = {
    getCurrentUser() {
      const session = readSession();
      if (!session) return null;
      const db = readDb();
      return publicUser(db.users.find((user) => user.id === session.userId));
    },

    register({ name, email, password, role }) {
      const db = readDb();
      const normalizedEmail = normalizeEmail(email);
      if (!name || !normalizedEmail || !password) throw new Error("Заполните имя, email и пароль.");
      if (password.length < 6) throw new Error("Пароль должен быть не короче 6 символов.");
      if (db.users.some((user) => user.email === normalizedEmail)) throw new Error("Пользователь с таким email уже есть.");

      const user = {
        id: crypto.randomUUID(),
        name: String(name).trim(),
        email: normalizedEmail,
        password,
        role: role || "buyer",
        verified: false,
        createdAt: new Date().toISOString(),
        reservedUnits: 0,
      };
      db.users.push(user);
      audit(db, "register", `Новый пользователь: ${user.email}`);
      writeDb(db);
      setSession(user.id);
      return publicUser(user);
    },

    login({ email, password }) {
      const db = readDb();
      const user = db.users.find((item) => item.email === normalizeEmail(email) && item.password === password);
      if (!user) throw new Error("Неверный email или пароль.");
      setSession(user.id);
      audit(db, "login", `Вход: ${user.email}`);
      writeDb(db);
      return publicUser(user);
    },

    logout() {
      localStorage.removeItem(SESSION_KEY);
    },

    listAuctions() {
      return readDb().auctions;
    },

    getUserBids(userId) {
      const db = readDb();
      return db.auctions.flatMap((auction) =>
        auction.bids
          .filter((bid) => bid.userId === userId)
          .map((bid) => ({ ...bid, auctionId: auction.id, auctionTitle: auction.title, currency: auction.currency })),
      );
    },

    placeBid({ auctionId, userId, amount, available }) {
      const db = readDb();
      const auction = db.auctions.find((item) => item.id === auctionId);
      if (!auction) throw new Error("Аукцион не найден.");
      if (auction.status !== "live") throw new Error("Аукцион уже завершён.");
      const value = Number.parseInt(String(amount), 10);
      if (!Number.isFinite(value)) throw new Error("Введите сумму ставки.");
      const minBid = auction.currentBid + auction.minStep;
      if (value < minBid) throw new Error(`Минимальная ставка: ${minBid} ${auction.currency}.`);
      if (value > available) throw new Error("Ставка больше доступной суммы.");

      auction.currentBid = value;
      auction.bids.unshift({ id: crypto.randomUUID(), userId, amount: value, createdAt: new Date().toISOString() });
      audit(db, "bid", `Ставка ${value} ${auction.currency} по лоту ${auction.title}`);
      writeDb(db);
      return auction;
    },

    createAuction({ title, category, description, startPrice, minStep, durationHours, seller }) {
      const db = readDb();
      const price = Number.parseInt(String(startPrice), 10);
      if (!title || !description || !price) throw new Error("Заполните название, описание и стартовую цену.");
      const auction = {
        id: crypto.randomUUID(),
        title: String(title).trim(),
        category: category || "Оборудование",
        image: "https://images.unsplash.com/photo-1518770660439-4636190af475?auto=format&fit=crop&w=1200&q=80",
        description: String(description).trim(),
        seller: seller || "Новый продавец",
        location: "Онлайн",
        currency: "USDT",
        startPrice: price,
        currentBid: price,
        minStep: Number.parseInt(String(minStep || 100), 10),
        endsAt: new Date(Date.now() + 1000 * 60 * 60 * Number(durationHours || 24)).toISOString(),
        status: "live",
        bids: [],
      };
      db.auctions.unshift(auction);
      audit(db, "auction_create", `Создан лот: ${auction.title}`);
      writeDb(db);
      return auction;
    },
  };

  window.tradeHubDb = api;
})();
