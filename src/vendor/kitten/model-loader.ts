import { parseVoicesNpz } from "./npz";
import type { CreateOptions, ModelConfig, VoiceTable } from "./types";

const DEFAULT_REPO = "KittenML/kitten-tts-nano-0.8-int8";
const HF_BASE_URL = "https://huggingface.co";

export type ModelArtifacts = {
  repo: string;
  config: ModelConfig;
  modelUrl: string;
  modelData: ArrayBuffer;
  voicesUrl: string;
  voices: VoiceTable;
};

function buildResolveUrl(repo: string, filename: string): string {
  return `${HF_BASE_URL}/${repo}/resolve/main/${filename}`;
}

export async function loadModelArtifacts(opts: CreateOptions = {}): Promise<ModelArtifacts> {
  const repo = opts.modelRepo ?? (opts.modelBaseUrl ? `local:${opts.modelBaseUrl}` : DEFAULT_REPO);
  const configUrl = opts.modelBaseUrl ? buildBaseUrl(opts.modelBaseUrl, "config.json") : buildResolveUrl(repo, "config.json");
  const retryCount = opts.retryCount ?? 1;
  const config = await fetchJson<ModelConfig>(configUrl, opts.cache, retryCount);

  if (config.type !== "ONNX1" && config.type !== "ONNX2") {
    throw new Error(`Unsupported model type: ${String(config.type)}`);
  }

  const modelUrl = opts.modelBaseUrl ? buildBaseUrl(opts.modelBaseUrl, config.model_file) : buildResolveUrl(repo, config.model_file);
  const voicesUrl = opts.modelBaseUrl ? buildBaseUrl(opts.modelBaseUrl, config.voices) : buildResolveUrl(repo, config.voices);

  const [modelData, voicesData] = await Promise.all([
    fetchArrayBuffer(modelUrl, opts.cache, retryCount),
    fetchArrayBuffer(voicesUrl, opts.cache, retryCount)
  ]);

  return {
    repo,
    config,
    modelUrl,
    modelData,
    voicesUrl,
    voices: parseVoicesNpz(voicesData)
  };
}

function buildBaseUrl(baseUrl: string, filename: string): string {
  const base = baseUrl.replace(/\/+$/, "");
  const suffix = filename.replace(/^\/+/, "");
  return `${base}/${suffix}`;
}

async function fetchJson<T>(url: string, cache?: Cache, retryCount = 1): Promise<T> {
  const response = await fetchWithCache(url, cache, retryCount);
  return (await response.json()) as T;
}

async function fetchArrayBuffer(url: string, cache?: Cache, retryCount = 1): Promise<ArrayBuffer> {
  const response = await fetchWithCache(url, cache, retryCount);
  return await response.arrayBuffer();
}

async function fetchWithCache(url: string, cache?: Cache, retryCount = 1): Promise<Response> {
  if (cache) {
    const cached = await cache.match(url);
    if (cached?.ok) {
      return cached;
    }
  }

  const response = await fetchWithRetries(url, retryCount);

  if (cache) {
    await cache.put(url, response.clone());
  }

  return response;
}

async function fetchWithRetries(url: string, retryCount = 1): Promise<Response> {
  let attempt = 0;
  let lastError: unknown;
  const maxAttempts = Math.max(1, retryCount + 1);

  while (attempt < maxAttempts) {
    attempt += 1;

    try {
      const response = await fetch(url);
      if (response.ok) {
        return response;
      }

      lastError = new Error(`Failed to fetch ${url} (${response.status})`);
    } catch (err) {
      lastError = err;
    }
  }

  if (lastError instanceof Error) {
    throw lastError;
  }

  throw new Error(`Failed to fetch ${url}`);
}
