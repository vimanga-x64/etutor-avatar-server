const express = require('express');
const cors = require('cors');
const compression = require('compression');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

// ── Amazon Polly (primary TTS) ──────────────────────────────────────────────
const AWS_ACCESS_KEY_ID     = process.env.AWS_ACCESS_KEY_ID;
const AWS_SECRET_ACCESS_KEY = process.env.AWS_SECRET_ACCESS_KEY;
const AWS_REGION            = process.env.AWS_REGION || 'us-east-1';
const POLLY_VOICE_ID        = process.env.POLLY_VOICE_ID || 'Joanna';
const POLLY_AUDIO_FORMAT    = (process.env.POLLY_AUDIO_FORMAT || 'wav').toLowerCase();
const POLLY_PCM_SAMPLE_RATE = '16000';


// ── Polly phoneme to avatar viseme ID ──────────────────────────────
// Polly viseme speech marks return phoneme strings; the avatar page JS uses
// Numeric IDs 0-21 drive lip morph targets, so we map Polly marks here.
// Avatar viseme ID to lip morph:
//   0=silence  1=ah  2=aa  3=oh/ao  4=eh  5=er  6=i  7=w/uw  8=ow
//   9=aw  10=oy  11=aa/ae  12=r  13=n  14=d_s_t  15=ch_j_sh
//   16=th  17=f_v  18=d_s_z  19=alveolar-t  20=k  21=b_m_p
const POLLY_PHONEME_TO_VISEME_ID = {
  // Silence / pause
  'sil': 0,
  
  // Consonants
  'p': 21, 'b': 21, 'm': 21,    // b_m_p
  'k': 20, 'g': 20, 'N': 20,    // k
  't': 15, 'd': 15, 's': 15, 'z': 15, // d_s_t
  'f': 18, 'v': 18,             // f_v
  'T': 17, 'D': 17,             // th
  'S': 16, 'Z': 16, 'tS': 16, 'dZ': 16, // ch_j_sh
  'n': 14, 'l': 14,             // n
  'r': 13,                      // r
  'h': 12,                      // small_aah
  'w': 7,                       // w
  'j': 6,                       // ee
  
  // Vowels
  'i': 6, 'I': 6,               // ee
  'e': 4, 'E': 4,               // eh
  '@': 1, 'V': 1,               // eh (schwa)
  'a': 2, 'A': 2,               // big_aah
  'o': 8,                       // ooh_q / oh
  'O': 3,                       // oh
  'u': 7, 'U': 7,               // w
  '@r': 5, 'Er': 5, 'Ir': 5,    // r
  'aI': 2, 'ai': 2,             // big_aah
  'aU': 9, 'au': 9,             // w (aw)
  'OI': 10, 'oi': 10,           // oh (oy)
};

// Middleware
app.use(cors());
app.use(compression({
  // Don't compress WAV audio files — they are uncompressed PCM and
  // gzip-ing them breaks streaming playback on Android WebView
  // (the browser must download the entire gzip stream before playing).
  filter: (req, res) => {
    if (req.path.endsWith('.wav')) return false;
    return compression.filter(req, res);
  }
}));
app.use(express.json());
app.use(express.static('public'));

// ── Helpers ─────────────────────────────────────────────────────────────────

// Collect a Node.js Readable stream into a single Buffer.
async function streamToBuffer(stream) {
  const chunks = [];
  for await (const chunk of stream) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }
  return Buffer.concat(chunks);
}

function wrapPcm16MonoAsWav(pcmBuffer, sampleRate = 16000) {
  const dataSize = pcmBuffer.length;
  const wav = Buffer.alloc(44 + dataSize);
  wav.write('RIFF', 0);
  wav.writeUInt32LE(36 + dataSize, 4);
  wav.write('WAVE', 8);
  wav.write('fmt ', 12);
  wav.writeUInt32LE(16, 16);
  wav.writeUInt16LE(1, 20);
  wav.writeUInt16LE(1, 22);
  wav.writeUInt32LE(sampleRate, 24);
  wav.writeUInt32LE(sampleRate * 2, 28);
  wav.writeUInt16LE(2, 32);
  wav.writeUInt16LE(16, 34);
  wav.write('data', 36);
  wav.writeUInt32LE(dataSize, 40);
  pcmBuffer.copy(wav, 44);
  return wav;
}

// Synthesise speech with Amazon Polly.
// Returns { audioBuffer, audioExt, visemes } or throws.
async function synthesiseWithPolly(text, ratePercent) {
  const { PollyClient, SynthesizeSpeechCommand } = require('@aws-sdk/client-polly');

  const polly = new PollyClient({
    region: AWS_REGION,
    credentials: {
      accessKeyId: AWS_ACCESS_KEY_ID,
      secretAccessKey: AWS_SECRET_ACCESS_KEY,
    },
  });

  const escapedText = String(text)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');

  // Polly neural does not support pitch prosody — rate only.
  // Render rate: 0 → 'medium', positive → faster, negative → slower.
  const rateNum = Number(ratePercent) || 0;
  const rateTag = rateNum !== 0 ? `${100 + Math.round(rateNum)}%` : 'medium';

  const ssml = `<speak><break time="250ms"/><prosody rate="${rateTag}">${escapedText}</prosody></speak>`;

  const commonParams = {
    Engine: 'neural',
    VoiceId: POLLY_VOICE_ID,
    Text: ssml,
    TextType: 'ssml',
  };

  // Fire both requests in parallel — audio synthesis and viseme speech marks.
  const usePcmWav = POLLY_AUDIO_FORMAT !== 'mp3';
  const [audioResponse, marksResponse] = await Promise.all([
    polly.send(new SynthesizeSpeechCommand({
      ...commonParams,
      OutputFormat: usePcmWav ? 'pcm' : 'mp3',
      ...(usePcmWav ? { SampleRate: POLLY_PCM_SAMPLE_RATE } : {}),
    })),
    polly.send(new SynthesizeSpeechCommand({
      ...commonParams,
      OutputFormat: 'json',
      SpeechMarkTypes: ['viseme'],
    })),
  ]);

  // Read both streams in parallel to prevent "Premature close" timeout on the unread stream
  const [audioBuffer, marksTextBuf] = await Promise.all([
    streamToBuffer(audioResponse.AudioStream),
    streamToBuffer(marksResponse.AudioStream)
  ]);
  const conditionedAudioBuffer = usePcmWav
    ? smoothWavPcm16Mono(wrapPcm16MonoAsWav(audioBuffer, Number(POLLY_PCM_SAMPLE_RATE)), 28, 0.58)
    : audioBuffer;

  // Speech marks are newline-delimited JSON objects.
  const marksText = marksTextBuf.toString('utf-8');
  const visemes = marksText
    .trim()
    .split('\n')
    .filter(Boolean)
    .map(line => { try { return JSON.parse(line); } catch { return null; } })
    .filter(m => m && m.type === 'viseme')
    .map(m => ({
      offset: m.time,  // Polly reports time in ms from audio start
      id: POLLY_PHONEME_TO_VISEME_ID[m.value] ?? 0,
    }));

  return {
    audioBuffer: conditionedAudioBuffer,
    audioExt: usePcmWav ? 'wav' : 'mp3',
    visemes,
  };
}

// Health check endpoint
app.get('/health', (req, res) => {
  const ttsProvider = (AWS_ACCESS_KEY_ID && AWS_SECRET_ACCESS_KEY) ? 'polly' : 'none';
  res.json({
    status: 'healthy',
    ttsProvider,
    pollyVoice:  AWS_ACCESS_KEY_ID  ? POLLY_VOICE_ID        : null,
    uptime: process.uptime(),
    timestamp: new Date().toISOString(),
  });
});

// Avatar viewer endpoint - Mobile-first interface
app.get('/avatar', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'mobile-tutor.html'));
});

// Legacy web demo (for reference)
app.get('/avatar/demo', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'avatar-viewer.html'));
});

// API endpoints for avatar control
app.post('/avatar/speak', (req, res) => {
  const { text, expression } = req.body;
  console.log(`Speaking: "${text}" with expression: ${expression || 'neutral'}`);
  
  // In a real implementation, this would trigger the avatar
  res.json({ 
    success: true, 
    text,
    expression,
    duration: Math.ceil(text.length / 15) // Rough estimate in seconds
  });
});

app.post('/avatar/expression', (req, res) => {
  const { expression } = req.body;
  console.log(`Setting expression: ${expression}`);
  
  res.json({ 
    success: true, 
    expression 
  });
});

app.get('/avatar/status', (req, res) => {
  res.json({
    ready: true,
    expressions: ['neutral', 'smile', 'laugh', 'sad', 'surprise', 'anger'],
    version: '1.0.0'
  });
});

function handleTtsConfig(req, res) {
  if (AWS_ACCESS_KEY_ID && AWS_SECRET_ACCESS_KEY) {
    res.json({
      enabled: true,
      provider: 'polly',
      region: AWS_REGION,
      voice: POLLY_VOICE_ID,
    });
    return;
  }

  res.json({ enabled: false, provider: 'none' });
}

app.get('/azure-speech/config', handleTtsConfig);
app.get('/tts/config', handleTtsConfig);

// Serve temp audio files (cleaned up automatically)
const fs = require('fs');
const crypto = require('crypto');
const tempAudioDir = path.join(__dirname, 'public', 'temp-audio');
if (!fs.existsSync(tempAudioDir)) {
  fs.mkdirSync(tempAudioDir, { recursive: true });
}

// Clean up temp audio files older than 60 seconds
function cleanupTempAudio() {
  try {
    const now = Date.now();
    const files = fs.readdirSync(tempAudioDir);
    files.forEach(file => {
      const filePath = path.join(tempAudioDir, file);
      try {
        const stat = fs.statSync(filePath);
        if (now - stat.mtimeMs > 60000) {
          fs.unlinkSync(filePath);
        }
      } catch (_) {}
    });
  } catch (_) {}
}

// Apply edge fades + peak normalization + transient de-clicking on 16-bit mono WAV.
// This targets hard discontinuities and isolated spikes that can sound like
// pops/static on Android WebView audio pipelines.
function smoothWavPcm16Mono(audioBuffer, fadeMs = 36, maxPeak = 0.74) {
  if (!Buffer.isBuffer(audioBuffer) || audioBuffer.length < 44) {
    return audioBuffer;
  }

  if (audioBuffer.toString('ascii', 0, 4) !== 'RIFF' ||
      audioBuffer.toString('ascii', 8, 12) !== 'WAVE') {
    return audioBuffer;
  }

  const channels = audioBuffer.readUInt16LE(22);
  const sampleRate = audioBuffer.readUInt32LE(24);
  const bitsPerSample = audioBuffer.readUInt16LE(34);
  if (channels !== 1 || bitsPerSample !== 16 || sampleRate <= 0) {
    return audioBuffer;
  }

  let chunkOffset = 12;
  let dataOffset = -1;
  let dataSize = 0;
  while (chunkOffset + 8 <= audioBuffer.length) {
    const chunkId = audioBuffer.toString('ascii', chunkOffset, chunkOffset + 4);
    const chunkSize = audioBuffer.readUInt32LE(chunkOffset + 4);
    if (chunkId === 'data') {
      dataOffset = chunkOffset + 8;
      dataSize = Math.min(chunkSize, audioBuffer.length - dataOffset);
      break;
    }
    chunkOffset += 8 + chunkSize + (chunkSize % 2);
  }

  if (dataOffset < 0 || dataSize < 4) {
    return audioBuffer;
  }

  const sampleCount = Math.floor(dataSize / 2);
  if (sampleCount < 8) {
    return audioBuffer;
  }

  const samples = new Int32Array(sampleCount);
  let sum = 0;
  for (let i = 0; i < sampleCount; i++) {
    const s = audioBuffer.readInt16LE(dataOffset + (i * 2));
    samples[i] = s;
    sum += s;
  }

  // Remove DC offset so the waveform is centered around zero.
  const dcOffset = Math.round(sum / sampleCount);
  if (Math.abs(dcOffset) > 2) {
    for (let i = 0; i < sampleCount; i++) {
      samples[i] -= dcOffset;
    }
  }

  // Suppress isolated spikes (single-sample/very short transients).
  const clickThreshold = 5200;
  for (let i = 1; i < sampleCount - 1; i++) {
    const prev = samples[i - 1];
    const curr = samples[i];
    const next = samples[i + 1];
    const jumpIn = curr - prev;
    const jumpOut = next - curr;
    const oppositeDirection = (jumpIn > 0 && jumpOut < 0) || (jumpIn < 0 && jumpOut > 0);
    if (oppositeDirection &&
        Math.abs(jumpIn) > clickThreshold &&
        Math.abs(jumpOut) > clickThreshold) {
      samples[i] = Math.round((prev + next) * 0.5);
    }
  }

  const fadeSamples = Math.max(
    1,
    Math.min(Math.floor(sampleRate * (fadeMs / 1000)), Math.floor(sampleCount / 2)),
  );

  let peak = 0;
  for (let i = 0; i < sampleCount; i++) {
    const normalized = Math.abs(samples[i]) / 32767;
    if (normalized > peak) {
      peak = normalized;
    }
  }

  const normalizeGain = peak > maxPeak ? (maxPeak / peak) : 1.0;

  for (let i = 0; i < sampleCount; i++) {
    const inSample = samples[i];
    let edgeGain = 1.0;
    if (i < fadeSamples) {
      edgeGain = i / fadeSamples;
    } else if (i >= sampleCount - fadeSamples) {
      edgeGain = (sampleCount - i - 1) / fadeSamples;
    }

    const gain = Math.max(0, Math.min(1, edgeGain)) * normalizeGain;
    const outSample = Math.max(-32768, Math.min(32767, Math.round(inSample * gain)));
    audioBuffer.writeInt16LE(outSample, dataOffset + (i * 2));
  }

  return audioBuffer;
}

// TTS synthesis: AWS Polly only. Browser speech remains the client fallback.
// Keep the legacy URL (/azure-speech/synthesize) for older mobile clients.
async function handleTtsSynthesize(req, res, next) {
  try {
    const { text, rate } = req.body;
    if (!text) {
      return res.status(400).json({ error: 'Missing text parameter' });
    }

    cleanupTempAudio();
    if (!AWS_ACCESS_KEY_ID || !AWS_SECRET_ACCESS_KEY) {
      return res.status(503).json({
        error: 'AWS Polly is not configured',
        hint: 'Set AWS_ACCESS_KEY_ID + AWS_SECRET_ACCESS_KEY for Polly. Browser speech is the client fallback.',
      });
    }

    const { audioBuffer, audioExt, visemes } = await synthesiseWithPolly(text, rate);
    const audioId = crypto.randomUUID();
    const audioFileName = `${audioId}.${audioExt}`;
    fs.writeFileSync(path.join(tempAudioDir, audioFileName), audioBuffer);

    console.log(`[Polly] Synthesised "${text.slice(0, 40)}..." - ${visemes.length} visemes`);
    return res.json({
      audioUrl: `/temp-audio/${audioFileName}`,
      visemes,
      format: audioExt === 'mp3' ? 'audio/mpeg' : 'audio/wav',
      provider: 'polly',
      voice: POLLY_VOICE_ID,
      durationMs: estimateDurationMs(text, visemes),
    });
  } catch (error) {
    console.error('[Polly] synthesis failed:', error.message);
    next(error);
  }
}

app.post('/azure-speech/synthesize', handleTtsSynthesize);
app.post('/tts/synthesize', handleTtsSynthesize);

function estimateDurationMs(text, visemes) {
  const lastVisemeMs = Array.isArray(visemes) && visemes.length > 0
    ? Math.max(...visemes.map(v => Number(v.offset) || 0))
    : 0;
  const textMs = Math.max(850, Math.round(String(text || '').trim().length / 13 * 1000));
  return Math.max(textMs, lastVisemeMs + 450);
}

// Root endpoint
app.get('/', (req, res) => {
  res.json({
    service: 'E-Tutor Avatar Server',
    version: '1.0.0',
    endpoints: {
      health: '/health',
      avatar: '/avatar',
      ttsConfig: '/tts/config',
      ttsSynthesize: 'POST /tts/synthesize',
      legacyCloudSpeechConfig: '/azure-speech/config',
      speak: 'POST /avatar/speak',
      expression: 'POST /avatar/expression',
      status: '/avatar/status'
    },
    docs: 'https://github.com/vimanga-x64/three.js-e-tutoring-avatar'
  });
});

// Error handling
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ 
    error: 'Something went wrong!',
    message: err.message 
  });
});

// Start server
app.listen(PORT, () => {
  console.log(`🚀 E-Tutor Avatar Server running on port ${PORT}`);
  console.log(`📱 Avatar viewer: http://localhost:${PORT}/avatar`);
  console.log(`💚 Health check: http://localhost:${PORT}/health`);
});
