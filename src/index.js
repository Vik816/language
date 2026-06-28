// index.js
// Точка входа в приложение. Запускается командой: npm start

require('dotenv').config();
const { createBot } = require('./bot');

const TELEGRAM_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const ANTHROPIC_KEY = process.env.ANTHROPIC_API_KEY;
const OPENAI_KEY = process.env.OPENAI_API_KEY;
const PAYMENT_PROVIDER_TOKEN = process.env.PAYMENT_PROVIDER_TOKEN;

if (!TELEGRAM_TOKEN || TELEGRAM_TOKEN.includes('вставь')) {
  console.error('Ошибка: не задан TELEGRAM_BOT_TOKEN в файле .env');
  process.exit(1);
}

if (!ANTHROPIC_KEY || ANTHROPIC_KEY.includes('вставь')) {
  console.error('Ошибка: не задан ANTHROPIC_API_KEY в файле .env');
  process.exit(1);
}

if (!OPENAI_KEY || OPENAI_KEY.includes('вставь')) {
  console.error('Ошибка: не задан OPENAI_API_KEY в файле .env (нужен для голосовых сообщений)');
  process.exit(1);
}

if (!PAYMENT_PROVIDER_TOKEN || PAYMENT_PROVIDER_TOKEN.includes('вставь')) {
  console.warn('Внимание: не задан PAYMENT_PROVIDER_TOKEN — команда /subscribe не будет работать, пока его не настроишь.');
}

createBot(TELEGRAM_TOKEN, ANTHROPIC_KEY, OPENAI_KEY, PAYMENT_PROVIDER_TOKEN);
