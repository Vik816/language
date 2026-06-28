// storage.js
// Простое хранилище данных пользователей в JSON-файле.
// На старте этого достаточно. Позже, когда пользователей станет много,
// можно будет перейти на настоящую базу данных (например, SQLite или PostgreSQL).

const fs = require('fs');
const path = require('path');

const DATA_FILE = path.join(__dirname, '..', 'data', 'users.json');

// Создаём файл с данными, если его ещё нет
function ensureFile() {
  if (!fs.existsSync(DATA_FILE)) {
    fs.writeFileSync(DATA_FILE, JSON.stringify({}, null, 2));
  }
}

// Загружаем всех пользователей
function loadAll() {
  ensureFile();
  const raw = fs.readFileSync(DATA_FILE, 'utf-8');
  return JSON.parse(raw);
}

// Сохраняем всех пользователей
function saveAll(data) {
  fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2));
}

// Получить данные конкретного пользователя (или создать новые)
function getUser(chatId) {
  const all = loadAll();
  const key = String(chatId);
  if (!all[key]) {
    all[key] = {
      language: null,       // какой язык учит
      level: null,           // уровень (beginner/intermediate/advanced)
      scenario: null,        // текущий сценарий диалога
      responseMode: 'text',  // как бот отвечает: 'text' или 'voice'
      history: [],           // история сообщений для контекста диалога
      sessionsCount: 0,      // сколько раз попрактиковался
      trialStartedAt: Date.now(),  // когда начался пробный период
      subscriptionUntil: null,     // до какой даты активна подписка (timestamp), null если нет
      createdAt: new Date().toISOString()
    };
    saveAll(all);
  } else if (!all[key].trialStartedAt) {
    // Пользователь создан до введения подписок — даём ему честный пробный период с этого момента
    all[key].trialStartedAt = Date.now();
    if (all[key].subscriptionUntil === undefined) all[key].subscriptionUntil = null;
    saveAll(all);
  }
  return all[key];
}

// Обновить данные пользователя
function updateUser(chatId, updates) {
  const all = loadAll();
  const key = String(chatId);
  all[key] = { ...all[key], ...updates };
  saveAll(all);
  return all[key];
}

module.exports = { getUser, updateUser };
