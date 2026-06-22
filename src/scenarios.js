// scenarios.js
// Список тем-сценариев для разговорной практики.
// Можно легко добавлять новые темы сюда в будущем.

const SCENARIOS = [
  { id: 'cafe', title: 'Заказ кофе в кафе' },
  { id: 'interview', title: 'Собеседование на работу' },
  { id: 'smalltalk', title: 'Лёгкая беседа с новым знакомым' },
  { id: 'directions', title: 'Спросить дорогу на улице' },
  { id: 'shopping', title: 'Покупка одежды в магазине' },
  { id: 'hotel', title: 'Заселение в отель' }
];

const LEVELS = [
  { id: 'beginner', title: 'Начальный' },
  { id: 'intermediate', title: 'Средний' },
  { id: 'advanced', title: 'Продвинутый' }
];

module.exports = { SCENARIOS, LEVELS };
