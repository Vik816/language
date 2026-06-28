// payments.js
// Логика пробного периода и платной подписки через Telegram Payments (провайдер ЮKassa).

const TRIAL_DAYS = 7;          // длительность бесплатного пробного периода
const SUBSCRIPTION_PRICE = 29900; // цена в копейках (299.00 ₽)
const SUBSCRIPTION_DAYS = 30;     // на сколько дней даёт оплата

const DAY_MS = 24 * 60 * 60 * 1000;

// Проверяет, есть ли у пользователя доступ (триал ещё не закончился ИЛИ подписка активна)
function hasAccess(user) {
  const now = Date.now();

  if (user.subscriptionUntil && user.subscriptionUntil > now) {
    return true;
  }

  if (user.trialStartedAt) {
    const trialEnds = user.trialStartedAt + TRIAL_DAYS * DAY_MS;
    if (now < trialEnds) return true;
  }

  return false;
}

// Сколько дней триала осталось (для информативных сообщений)
function trialDaysLeft(user) {
  if (!user.trialStartedAt) return TRIAL_DAYS;
  const trialEnds = user.trialStartedAt + TRIAL_DAYS * DAY_MS;
  const msLeft = trialEnds - Date.now();
  return Math.max(0, Math.ceil(msLeft / DAY_MS));
}

// Формирует счёт на оплату подписки
function buildInvoicePayload() {
  return {
    title: 'Подписка на языкового бота',
    description: `Доступ к боту на ${SUBSCRIPTION_DAYS} дней — безлимитная практика языка текстом и голосом.`,
    payload: 'subscription_30_days', // произвольная строка, вернётся в successful_payment
    currency: 'RUB',
    prices: [{ label: 'Подписка на 30 дней', amount: SUBSCRIPTION_PRICE }]
  };
}

module.exports = {
  TRIAL_DAYS,
  SUBSCRIPTION_DAYS,
  hasAccess,
  trialDaysLeft,
  buildInvoicePayload
};
