// bot.js
// Здесь живёт вся логика общения с пользователем в Telegram.

const TelegramBot = require('node-telegram-bot-api');
const { getUser, updateUser } = require('./storage');
const { getConversationReply, getFeedback } = require('./claudeClient');
const { SCENARIOS, LEVELS } = require('./scenarios');
const { transcribeVoice, synthesizeSpeech, convertMp3ToOgg } = require('./audioClient');

function createBot(telegramToken, anthropicKey, openaiKey) {
  const bot = new TelegramBot(telegramToken, { polling: true });

  // Регистрируем команды, чтобы они появлялись в меню Telegram (кнопка "/" или "Menu")
  bot.setMyCommands([
    { command: 'start', description: 'Начать сначала / перезапустить бота' },
    { command: 'language', description: 'Сменить язык, который изучаешь' },
    { command: 'level', description: 'Сменить уровень сложности' },
    { command: 'scenario', description: 'Сменить тему диалога' },
    { command: 'mode', description: 'Ответ бота: текстом или голосом' },
    { command: 'stats', description: 'Посмотреть свой прогресс' }
  ]);

  // ===== Команда /start =====
  bot.onText(/\/start/, (msg) => {
    const chatId = msg.chat.id;
    getUser(chatId); // создаёт запись пользователя, если её нет

    bot.sendMessage(
      chatId,
      'Привет! Я бот для практики разговорного языка 🗣️\n\n' +
      'Я буду общаться с тобой на изучаемом языке, как живой собеседник, ' +
      'а потом разбирать твои ошибки.\n\n' +
      'Можешь писать текстом или отправлять голосовые. Командой /mode выберешь, ' +
      'как отвечать тебе — текстом или голосом.\n\n' +
      'Для начала выбери язык, который изучаешь — просто напиши его название ' +
      '(например: English, Deutsch, Español).'
    );

    updateUser(chatId, { step: 'waiting_for_language' });
  });

  // ===== Команда /language — сменить язык в любой момент =====
  bot.onText(/\/language/, (msg) => {
    const chatId = msg.chat.id;
    updateUser(chatId, { step: 'waiting_for_language' });
    bot.sendMessage(chatId, 'Какой язык будем практиковать теперь? Просто напиши название (например: English, Deutsch, Español).');
  });

  // ===== Команда /level — сменить уровень =====
  bot.onText(/\/level/, (msg) => {
    const chatId = msg.chat.id;
    sendLevelKeyboard(chatId);
  });

  // ===== Команда /scenario — сменить тему диалога =====
  bot.onText(/\/scenario/, (msg) => {
    const chatId = msg.chat.id;
    sendScenarioKeyboard(chatId);
  });

  // ===== Команда /stats — посмотреть прогресс =====
  bot.onText(/\/stats/, (msg) => {
    const chatId = msg.chat.id;
    const user = getUser(chatId);
    bot.sendMessage(
      chatId,
      `📊 Твой прогресс:\nЯзык: ${user.language || 'не выбран'}\n` +
      `Уровень: ${user.level || 'не выбран'}\n` +
      `Режим ответа бота: ${user.responseMode === 'voice' ? 'голосом 🔊' : 'текстом 💬'}\n` +
      `Сессий практики: ${user.sessionsCount}`
    );
  });

  // ===== Команда /mode — выбрать, как бот отвечает: текстом или голосом =====
  bot.onText(/\/mode/, (msg) => {
    const chatId = msg.chat.id;
    sendModeKeyboard(chatId);
  });

  function sendModeKeyboard(chatId) {
    bot.sendMessage(chatId, 'Как бот должен отвечать тебе?', {
      reply_markup: {
        inline_keyboard: [
          [{ text: '💬 Текстом', callback_data: 'mode_text' }],
          [{ text: '🔊 Голосом', callback_data: 'mode_voice' }]
        ]
      }
    });
  }

  function sendLevelKeyboard(chatId) {
    const keyboard = LEVELS.map((l) => [{ text: l.title, callback_data: `level_${l.id}` }]);
    bot.sendMessage(chatId, 'Выбери свой уровень:', {
      reply_markup: { inline_keyboard: keyboard }
    });
  }

  function sendScenarioKeyboard(chatId) {
    const keyboard = SCENARIOS.map((s) => [{ text: s.title, callback_data: `scenario_${s.id}` }]);
    bot.sendMessage(chatId, 'Выбери тему для практики:', {
      reply_markup: { inline_keyboard: keyboard }
    });
  }

  // ===== Обработка нажатий на кнопки =====
  bot.on('callback_query', async (query) => {
    const chatId = query.message.chat.id;
    const data = query.data;

    if (data.startsWith('level_')) {
      const levelId = data.replace('level_', '');
      const level = LEVELS.find((l) => l.id === levelId);
      updateUser(chatId, { level: level.id });
      await bot.answerCallbackQuery(query.id);
      bot.sendMessage(chatId, `Уровень установлен: ${level.title} ✅`);
      sendScenarioKeyboard(chatId);
    }

    if (data.startsWith('scenario_')) {
      const scenarioId = data.replace('scenario_', '');
      const scenario = SCENARIOS.find((s) => s.id === scenarioId);
      updateUser(chatId, { scenario: scenario.title, history: [] });
      await bot.answerCallbackQuery(query.id);
      bot.sendMessage(
        chatId,
        `Тема выбрана: ${scenario.title} ✅\n\nНачинай диалог — просто напиши первую фразу или отправь голосовое!`
      );
      sendModeKeyboard(chatId);
    }

    if (data.startsWith('mode_')) {
      const mode = data.replace('mode_', ''); // 'text' или 'voice'
      updateUser(chatId, { responseMode: mode });
      await bot.answerCallbackQuery(query.id);
      bot.sendMessage(
        chatId,
        mode === 'voice'
          ? 'Готово, теперь буду отвечать голосом 🔊'
          : 'Готово, теперь буду отвечать текстом 💬'
      );
    }
  });

  // ===== Общая логика: получить от Claude ответ + разбор ошибок, обновить историю =====
  async function processUserText(chatId, user, userText) {
    const reply = await getConversationReply(
      anthropicKey,
      user.language,
      user.level || 'beginner',
      user.scenario,
      user.history,
      userText
    );

    const feedback = await getFeedback(anthropicKey, user.language, userText);

    const newHistory = [
      ...user.history,
      { role: 'user', content: userText },
      { role: 'assistant', content: reply }
    ].slice(-10);

    updateUser(chatId, {
      history: newHistory,
      sessionsCount: user.sessionsCount + 1
    });

    return { reply, feedback };
  }

  // ===== Отправка ответа собеседника с учётом выбранного режима (текст/голос) =====
  async function sendBotReply(chatId, user, replyText) {
    if (user.responseMode === 'voice') {
      try {
        const mp3Buffer = await synthesizeSpeech(openaiKey, replyText);
        const oggBuffer = await convertMp3ToOgg(mp3Buffer);
        await bot.sendVoice(chatId, oggBuffer, {}, { filename: 'reply.ogg', contentType: 'audio/ogg' });
        return;
      } catch (err) {
        console.error('Не получилось озвучить ответ, отправляю текстом. Причина:', err.stack || err.message);
        await bot.sendMessage(chatId, `💬 ${replyText}`);
        return;
      }
    }
    await bot.sendMessage(chatId, `💬 ${replyText}`);
  }

  // ===== Обработка обычных текстовых сообщений =====
  bot.on('message', async (msg) => {
    // Игнорируем команды (они обработаны выше) и не-текстовые сообщения
    if (!msg.text || msg.text.startsWith('/')) return;

    const chatId = msg.chat.id;
    const user = getUser(chatId);

    // Шаг 1: ждём, пока пользователь укажет язык
    if (user.step === 'waiting_for_language') {
      updateUser(chatId, { language: msg.text, step: 'ready', history: [] });
      bot.sendMessage(chatId, `Отлично, будем практиковать ${msg.text}! 🎉`);
      sendLevelKeyboard(chatId);
      return;
    }

    // Если язык/уровень/тема ещё не настроены — подсказываем, что делать
    if (!user.language) {
      bot.sendMessage(chatId, 'Сначала напиши /start, чтобы настроить язык.');
      return;
    }
    if (!user.scenario) {
      bot.sendMessage(chatId, 'Выбери тему для практики:');
      sendScenarioKeyboard(chatId);
      return;
    }

    try {
      bot.sendChatAction(chatId, 'typing');
      const { reply, feedback } = await processUserText(chatId, user, msg.text);
      await sendBotReply(chatId, user, reply);
      await bot.sendMessage(chatId, `📝 Разбор:\n${feedback}`);
    } catch (err) {
      console.error('Ошибка при обращении к Claude API:', err.stack || err.message);
      bot.sendMessage(
        chatId,
        'Упс, что-то пошло не так на моей стороне 😕 Попробуй написать ещё раз через минуту.'
      );
    }
  });

  // ===== Обработка голосовых сообщений =====
  bot.on('voice', async (msg) => {
    const chatId = msg.chat.id;
    const user = getUser(chatId);

    if (!user.language || !user.scenario) {
      bot.sendMessage(chatId, 'Сначала настрой язык и тему через /start.');
      return;
    }

    try {
      bot.sendChatAction(chatId, 'typing');

      // 1. Скачиваем голосовое сообщение от пользователя
      const fileLink = await bot.getFileLink(msg.voice.file_id);
      const audioResponse = await fetch(fileLink);
      const audioBuffer = Buffer.from(await audioResponse.arrayBuffer());

      // 2. Распознаём речь в текст
      const userText = await transcribeVoice(openaiKey, audioBuffer, 'voice.oga');
      await bot.sendMessage(chatId, `🎙 Ты сказал: "${userText}"`);

      // 3. Получаем ответ и разбор ошибок (та же логика, что и для текста)
      const { reply, feedback } = await processUserText(chatId, user, userText);

      // 4. Отправляем ответ собеседника (текстом или голосом — в зависимости от /mode)
      await sendBotReply(chatId, user, reply);

      // 5. Разбор ошибок отправляем текстом — его удобнее читать
      await bot.sendMessage(chatId, `📝 Разбор:\n${feedback}`);
    } catch (err) {
      console.error('Ошибка при обработке голосового сообщения:', err.stack || err.message);
      bot.sendMessage(
        chatId,
        `Не получилось обработать голосовое 😕 Причина: ${err.message}`
      );
    }
  });

  console.log('Бот запущен и слушает сообщения...');
  return bot;
}

module.exports = { createBot };
