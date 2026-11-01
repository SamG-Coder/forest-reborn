const PCM_16_MAX = 32767;
const PCM_16_MIN = -32768;

function clampToPcm16(sample: number): number {
  if (sample > 1) {
    return PCM_16_MAX;
  }
  if (sample < -1) {
    return PCM_16_MIN;
  }

  return sample < 0 ? Math.round(sample * -PCM_16_MIN) : Math.round(sample * PCM_16_MAX);
}

export function encodeWav16(samples: Float32Array, sampleRate = 24_000): ArrayBuffer {
  const bytesPerSample = 2;
  const dataSize = samples.length * bytesPerSample;
  const buffer = new ArrayBuffer(44 + dataSize);
  const view = new DataView(buffer);

  writeAscii(view, 0, "RIFF");
  view.setUint32(4, 36 + dataSize, true);
  writeAscii(view, 8, "WAVE");
  writeAscii(view, 12, "fmt ");
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, 1, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * bytesPerSample, true);
  view.setUint16(32, bytesPerSample, true);
  view.setUint16(34, 16, true);
  writeAscii(view, 36, "data");
  view.setUint32(40, dataSize, true);

  let offset = 44;
  for (const sample of samples) {
    view.setInt16(offset, clampToPcm16(sample), true);
    offset += bytesPerSample;
  }

  return buffer;
}

export function wavBlobFromPcm(samples: Float32Array, sampleRate = 24_000): Blob {
  return new Blob([encodeWav16(samples, sampleRate)], { type: "audio/wav" });
}

function writeAscii(view: DataView, offset: number, text: string): void {
  for (let i = 0; i < text.length; i += 1) {
    view.setUint8(offset + i, text.charCodeAt(i));
  }
}
