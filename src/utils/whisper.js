const fetch = (...args) => import('node-fetch').then(({ default: fetch }) => fetch(...args));
let FormDataCtor = null;
try {
  if (typeof FormData !== 'undefined') {
    FormDataCtor = FormData;
  }
} catch (_) {}
if (!FormDataCtor) {
  try {
    FormDataCtor = require('form-data');
  } catch (err) {
    // handled later
  }
}

const OPENAI_API_KEY = process.env.OPENAI_API_KEY || process.env.OPENAI_API;
const OPENAI_TRANSCRIBE_MODEL = process.env.TRANSCRIBE_MODEL || 'whisper-1';
const MAX_BYTES = 25 * 1024 * 1024; // 25 MB
const allowed = ['audio/mpeg', 'audio/mp3', 'audio/wav', 'audio/x-wav', 'audio/ogg', 'audio/webm', 'audio/mp4', 'audio/m4a'];

async function transcribeAttachment(attachment, prompt) {
  if (!OPENAI_API_KEY) {
    throw new Error('OpenAI API key not configured. Set OPENAI_API_KEY in your environment.');
  }
  if (!FormDataCtor) {
    throw new Error('Missing FormData implementation. Please install the "form-data" package or run on Node 18+.');
  }
  if (!attachment?.url) {
    throw new Error('No attachment URL provided.');
  }

  const ct = (attachment.contentType || '').toLowerCase();
  if (ct && !allowed.some(a => ct.includes(a.split('/')[1]) || ct === a)) {
    try { console.log(`[transcribe] Unrecognized content-type: ${ct}`); } catch (_) {}
  }

  const fileRes = await fetch(attachment.url);
  if (!fileRes.ok) {
    const text = await fileRes.text().catch(() => '');
    throw new Error(`Failed to download attachment: ${fileRes.status} ${text?.slice(0,200)}`);
  }
  const audioBuffer = Buffer.from(await fileRes.arrayBuffer());

  if (audioBuffer.length > MAX_BYTES) {
    throw new Error(`Downloaded file exceeds ${MAX_BYTES / (1024*1024)}MB after fetch.`);
  }

  const fileName = attachment.name || 'audio';
  const mimeType = ct || 'application/octet-stream';

  const form = new FormDataCtor();
  if (form.append.length >= 3) {
    form.append('file', audioBuffer, { filename: fileName, contentType: mimeType });
  } else {
    let blob;
    try {
      const { Blob } = require('buffer');
      blob = new Blob([audioBuffer], { type: mimeType });
    } catch (_) {
      blob = audioBuffer;
    }
    form.append('file', blob, fileName);
  }
  form.append('model', OPENAI_TRANSCRIBE_MODEL);
  if (prompt) form.append('prompt', prompt);

  const resp = await fetch('https://api.openai.com/v1/audio/transcriptions', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${OPENAI_API_KEY}`,
    },
    body: form,
  });

  const bodyText = await resp.text();
  if (!resp.ok) {
    let msg = bodyText;
    try { msg = (JSON.parse(bodyText)?.error?.message) || msg; } catch (_) {}
    throw new Error(`OpenAI API error: ${resp.status} ${msg}`);
  }

  let data;
  try { data = JSON.parse(bodyText); } catch (_) {
    data = { text: bodyText };
  }

  const text = String(data.text || '').trim();
  if (!text) {
    throw new Error('Transcription returned no text.');
  }
  return text;
}

module.exports = { transcribeAttachment, MAX_BYTES };
