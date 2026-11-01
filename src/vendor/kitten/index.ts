import { playAudioPcm, downloadWav } from "./audio";
import { InferenceEngine } from "./inference";
import { loadModelArtifacts } from "./model-loader";
import { chunkText, TextPreprocessor } from "./preprocess";
import { createPhonemizer, type Phonemizer } from "./phonemizer";
import { addBoundaryTokens, normalizePhonemesForTokenizer, TextCleaner } from "./tokenizer";
import { DEFAULT_VOICE_ALIAS, resolveDisplayVoices, resolveVoiceKey } from "./voices";
import { wavBlobFromPcm } from "./wav";
import type { CreateOptions, GenerateOptions, VoiceTable } from "./types";

const DEFAULT_SAMPLE_RATE = 24_000;
const DEFAULT_VOICE = "Jasper";

export class KittenTTSWeb {
  private constructor(
    private readonly engine: InferenceEngine,
    private readonly voices: VoiceTable,
    private readonly voiceAlias: Record<string, string>,
    private readonly speedPriors: Record<string, number>,
    private readonly voiceNames: string[],
    private readonly preprocessor: TextPreprocessor,
    private readonly phonemizer: Phonemizer
  ) {}

  static async create(opts: CreateOptions = {}): Promise<KittenTTSWeb> {
    const artifacts = await loadModelArtifacts(opts);
    const provider = opts.executionProvider ?? "wasm";

    let engine: InferenceEngine;
    try {
      engine = await InferenceEngine.create(artifacts.modelData, provider);
    } catch (err) {
      if (provider !== "webgpu") {
        throw err;
      }
      engine = await InferenceEngine.create(artifacts.modelData, "wasm");
    }

    const voiceAlias = {
      ...DEFAULT_VOICE_ALIAS,
      ...(artifacts.config.voice_aliases ?? {})
    };

    const phonemizer = await createPhonemizer({
      mode: opts.phonemizerMode,
      language: opts.phonemizerLanguage,
      moduleUrl: opts.phonemizerModuleUrl
    });

    return new KittenTTSWeb(
      engine,
      artifacts.voices,
      voiceAlias,
      artifacts.config.speed_priors ?? {},
      resolveDisplayVoices(voiceAlias, artifacts.voices),
      new TextPreprocessor({ removePunctuation: false }),
      phonemizer
    );
  }

  getVoices(): string[] {
    return [...this.voiceNames];
  }

  async generate(text: string, opts: GenerateOptions = {}): Promise<Float32Array> {
    const voiceName = opts.voice ?? DEFAULT_VOICE;
    const resolvedVoiceKey = resolveVoiceKey(voiceName, this.voiceAlias);
    const voiceMatrix = this.voices[resolvedVoiceKey];

    if (!voiceMatrix) {
      throw new Error(`Voice '${voiceName}' is not available. Available voices: ${this.getVoices().join(", ")}`);
    }

    const cleanedText = opts.cleanText === false ? text : this.preprocessor.process(text);
    const textCleaner = new TextCleaner();
    const chunks = chunkText(cleanedText);

    if (!chunks.length) {
      return new Float32Array();
    }

    const speedPrior = this.speedPriors[resolvedVoiceKey] ?? 1;
    const speed = (opts.speed ?? 1) * speedPrior;
    const collected: Float32Array[] = [];

    for (const chunk of chunks) {
      const phonemes = await this.phonemizer.phonemize(chunk);
      const normalizedPhonemes = normalizePhonemesForTokenizer(phonemes);
      const tokens = addBoundaryTokens(textCleaner.tokenize(normalizedPhonemes));
      const inputIds = BigInt64Array.from(tokens, (value) => BigInt(value));
      const style = pickStyleByTextLength(voiceMatrix, chunk.length);
      const output = await this.engine.run({ inputIds, style, speed });
      // Preserve final consonants. The original port removed a fixed 5,000
      // samples (208 ms), even when those samples contained speech.
      collected.push(output);
    }

    return concatFloat32(collected);
  }

  async generateWav(text: string, opts: GenerateOptions = {}): Promise<Blob> {
    const pcm = await this.generate(text, opts);
    return wavBlobFromPcm(pcm, DEFAULT_SAMPLE_RATE);
  }
}

export { playAudioPcm, downloadWav };
export { wavBlobFromPcm };
export type { CreateOptions, GenerateOptions };

function pickStyleByTextLength(
  voice: { rows: number; cols: number; values: Float32Array },
  textLength: number
): Float32Array {
  const rowIndex = Math.min(textLength, voice.rows - 1);
  const start = rowIndex * voice.cols;
  const end = start + voice.cols;
  return voice.values.slice(start, end);
}

function concatFloat32(chunks: Float32Array[]): Float32Array {
  if (!chunks.length) {
    return new Float32Array();
  }

  let length = 0;
  for (const chunk of chunks) {
    length += chunk.length;
  }

  const out = new Float32Array(length);
  let offset = 0;
  for (const chunk of chunks) {
    out.set(chunk, offset);
    offset += chunk.length;
  }

  return out;
}
