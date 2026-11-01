export type AudioFormat = "f32" | "wav";

export type GenerateOptions = {
  voice?: string;
  speed?: number;
  cleanText?: boolean;
  format?: AudioFormat;
};

export type CreateOptions = {
  modelRepo?: string;
  modelBaseUrl?: string;
  cache?: Cache;
  executionProvider?: "webgpu" | "wasm";
  retryCount?: number;
  phonemizerMode?: "auto" | "grapheme" | "espeak";
  phonemizerLanguage?: string;
  phonemizerModuleUrl?: string;
};

export type ModelConfig = {
  type: "ONNX1" | "ONNX2";
  model_file: string;
  voices: string;
  speed_priors?: Record<string, number>;
  voice_aliases?: Record<string, string>;
};

export type VoiceEmbeddingMatrix = {
  rows: number;
  cols: number;
  values: Float32Array;
};

export type VoiceTable = Record<string, VoiceEmbeddingMatrix>;
