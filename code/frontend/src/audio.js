// Microphone capture -> 16 kHz mono WAV, the exact format backend/app/services/speech.py
// tells Azure to expect (Content-Type: ...codecs=audio/pcm; samplerate=16000). MediaRecorder
// only ever produces compressed audio (webm/opus, ogg/opus, ...), so every recording is
// decoded and resampled in the browser before it leaves it.

const SAMPLE_RATE = 16000

export async function startRecording() {
  const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
  const recorder = new MediaRecorder(stream)
  const chunks = []
  recorder.ondataavailable = (e) => { if (e.data.size) chunks.push(e.data) }
  const stopped = new Promise((resolve, reject) => {
    recorder.onstop = () => resolve(new Blob(chunks, { type: recorder.mimeType }))
    recorder.onerror = (e) => reject(e.error || new Error('recording failed'))
  })
  recorder.start()

  return {
    async stop() {
      recorder.stop()
      stream.getTracks().forEach((t) => t.stop())
      const blob = await stopped
      return toWav16kMono(blob)
    },
    cancel() {
      recorder.stop()
      stream.getTracks().forEach((t) => t.stop())
    },
  }
}

async function toWav16kMono(blob) {
  const arrayBuffer = await blob.arrayBuffer()
  const decodeCtx = new (window.AudioContext || window.webkitAudioContext)()
  let decoded
  try {
    decoded = await decodeCtx.decodeAudioData(arrayBuffer)
  } finally {
    decodeCtx.close()
  }

  // Resampling to exactly 16 kHz mono happens here, via the browser's own resampler —
  // OfflineAudioContext renders into whatever sample rate/channel count it's given.
  const offline = new OfflineAudioContext(1, Math.ceil(decoded.duration * SAMPLE_RATE), SAMPLE_RATE)
  const source = offline.createBufferSource()
  source.buffer = decoded
  source.connect(offline.destination)
  source.start()
  const rendered = await offline.startRendering()

  const samples = rendered.getChannelData(0)
  const pcm = new Int16Array(samples.length)
  for (let i = 0; i < samples.length; i++) {
    const s = Math.max(-1, Math.min(1, samples[i]))
    pcm[i] = s < 0 ? s * 0x8000 : s * 0x7fff
  }

  const dataSize = pcm.length * 2
  const buffer = new ArrayBuffer(44 + dataSize)
  const view = new DataView(buffer)
  const writeStr = (offset, str) => { for (let i = 0; i < str.length; i++) view.setUint8(offset + i, str.charCodeAt(i)) }

  writeStr(0, 'RIFF'); view.setUint32(4, 36 + dataSize, true); writeStr(8, 'WAVE')
  writeStr(12, 'fmt '); view.setUint32(16, 16, true); view.setUint16(20, 1, true)   // PCM
  view.setUint16(22, 1, true)                                                      // mono
  view.setUint32(24, SAMPLE_RATE, true); view.setUint32(28, SAMPLE_RATE * 2, true)  // byte rate
  view.setUint16(32, 2, true); view.setUint16(34, 16, true)                         // block align, bits/sample
  writeStr(36, 'data'); view.setUint32(40, dataSize, true)
  new Int16Array(buffer, 44).set(pcm)

  return new Blob([buffer], { type: 'audio/wav' })
}
