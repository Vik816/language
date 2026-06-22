// claudeClient.js
// Здесь вся логика общения с Claude API.
// Используем встроенный fetch (доступен в Node.js 18+).

// Используем ProxyAPI (российский посредник), а не прямой адрес Anthropic,
// т.к. напрямую api.anthropic.com из России обычно недоступен.
const API_URL = 'https://api.proxyapi.ru/anthropic/v1/messages';
const MODEL = 'claude-sonnet-4-6';

async function callClaude(apiKey, messages, systemPrompt) {
  const response = await fetch(API_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01'
    },
    body: JSON.stringify({
      model: MODEL,
      max_tokens: 600,
      system: systemPrompt,
      messages: messages
    })
  });

  if (!response.ok) {
    const errText = await response.text();
    throw new Error(`Claude API error ${response.status}: ${errText}`);
  }

  const data = await response.json();
  // Склеиваем все текстовые блоки ответа
  const text = data.content
    .filter((block) => block.type === 'text')
    .map((block) => block.text)
    .join('\n');
  return text;
}

// Генерация ответа собеседника в рамках диалоговой практики
async function getConversationReply(apiKey, language, level, scenario, history, userMessage) {
  const systemPrompt = `Ты — дружелюбный собеседник-носитель языка "${language}".
Веди непринуждённый диалог на тему: "${scenario}".
Уровень собеседника: ${level}.
Отвечай ТОЛЬКО на языке "${language}", коротко (1-3 предложения), как в живом разговоре.
Не объясняй грамматику в этом ответе — это будет отдельным шагом. Просто общайся естественно.
Важно: не заканчивай каждую реплику вопросом. Иногда просто комментируй, делись мнением, реагируй эмоционально, рассказывай что-то своё — как это естественно делает человек в обычном разговоре. Вопрос уместен не чаще, чем в одном ответе из двух-трёх.`;

  const messages = [
    ...history,
    { role: 'user', content: userMessage }
  ];

  return callClaude(apiKey, messages, systemPrompt);
}

// Разбор ошибок пользователя в его последнем сообщении
async function getFeedback(apiKey, language, userMessage) {
  const systemPrompt = `Ты — преподаватель языка "${language}".
Тебе дают одно сообщение ученика на этом языке.
Дай короткий разбор на русском языке:
1) Есть ли ошибки (грамматика, лексика) — укажи их и исправленный вариант.
2) Если ошибок нет — похвали и предложи более естественный/продвинутый вариант фразы.
Ответ должен быть кратким, максимум 4-5 строк, без длинных вступлений.`;

  const messages = [{ role: 'user', content: userMessage }];
  return callClaude(apiKey, messages, systemPrompt);
}

module.exports = { getConversationReply, getFeedback };
