// audioClient.js
// Распознавание речи (Speech-to-Text) и синтез речи (Text-to-Speech)
// через OpenAI-совместимый эндпоинт ProxyAPI.

const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');

const OPENAI_BASE = 'https://api.proxyapi.ru/openai/v1';
const TMP_DIR = path.join(__dirname, '..', 'data', 'tmp');
const FFMPEG_PATH = process.env.FFMPEG_PATH || 'ffmpeg';

if (!fs.existsSync(TMP_DIR)) fs.mkdirSync(TMP_DIR, { recursive: true });

// ===== Распознавание речи: голосовое сообщение -> текст =====
async function transcribeVoice(openaiKey, audioBuffer, filename = 'voice.oga') {
  const form = new FormData();
  const blob = new Blob([audioBuffer]);
  form.append('file', blob, filename);
  form.append('model', 'whisper-1');

  const response = await fetch(`${OPENAI_BASE}/audio/transcriptions`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${openaiKey}` },
    body: form
  });

  if (!response.ok) {
    const errText = await response.text();
    throw new Error(`Whisper API error ${response.status}: ${errText}`);
  }

  const data = await response.json();
  return data.text;
}

// ===== Синтез речи: текст -> mp3-буфер =====
async function synthesizeSpeech(openaiKey, text) {
  const response = await fetch(`${OPENAI_BASE}/audio/speech`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${openaiKey}`
    },
    body: JSON.stringify({
      model: 'tts-1',
      voice: 'nova', // приятный женский голос
      input: text,
      response_format: 'mp3'
    })
  });

  if (!response.ok) {
    const errText = await response.text();
    throw new Error(`TTS API error ${response.status}: ${errText}`);
  }

  const arrayBuffer = await response.arrayBuffer();
  return Buffer.from(arrayBuffer);
}

// ===== Конвертация mp3 -> ogg/opus (формат голосовых сообщений Telegram) =====
// Требует установленного ffmpeg на компьютере/сервере.
function convertMp3ToOgg(mp3Buffer) {
  return new Promise((resolve, reject) => {
    const id = Date.now() + '_' + Math.random().toString(36).slice(2);
    const inPath = path.join(TMP_DIR, `${id}.mp3`);
    const outPath = path.join(TMP_DIR, `${id}.ogg`);

    fs.writeFileSync(inPath, mp3Buffer);

    const ffmpeg = spawn(FFMPEG_PATH, [
      '-y',
      '-i', inPath,
      '-c:a', 'libopus',
      '-b:a', '48k',
      outPath
    ]);

    ffmpeg.on('error', (err) => {
      cleanup();
      reject(new Error(`Не удалось запустить ffmpeg (${FFMPEG_PATH}): ${err.message}. Установи ffmpeg или укажи путь к ffmpeg.exe в переменной FFMPEG_PATH в .env`));
    });

    ffmpeg.on('close', (code) => {
      if (code !== 0) {
        cleanup();
        reject(new Error(`ffmpeg завершился с ошибкой, код ${code}`));
        return;
      }
      try {
        const oggBuffer = fs.readFileSync(outPath);
        cleanup();
        resolve(oggBuffer);
      } catch (err) {
        cleanup();
        reject(err);
      }
    });

    function cleanup() {
      try { fs.unlinkSync(inPath); } catch (e) {}
      try { fs.unlinkSync(outPath); } catch (e) {}
    }
  });
}

module.exports = { transcribeVoice, synthesizeSpeech, convertMp3ToOgg };
