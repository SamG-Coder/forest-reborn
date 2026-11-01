const DEFAULT_SAMPLE_RATE = 24_000;

export async function playAudioPcm(samples: Float32Array, sampleRate = DEFAULT_SAMPLE_RATE): Promise<void> {
  const context = new AudioContext({ sampleRate });
  const audioBuffer = context.createBuffer(1, samples.length, sampleRate);
  audioBuffer.getChannelData(0).set(samples);

  const source = context.createBufferSource();
  source.buffer = audioBuffer;
  source.connect(context.destination);
  source.start();

  await new Promise<void>((resolve) => {
    source.onended = () => {
      context.close().catch(() => undefined);
      resolve();
    };
  });
}

export function downloadWav(wavBlob: Blob, filename = "kittentts.wav"): void {
  const objectUrl = URL.createObjectURL(wavBlob);
  const anchor = document.createElement("a");
  anchor.href = objectUrl;
  anchor.download = filename;
  anchor.click();

  queueMicrotask(() => {
    URL.revokeObjectURL(objectUrl);
    anchor.remove();
  });
}
