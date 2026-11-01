import {phonemizeWithPunctuation} from '../../audio/phoneme-text.js';

export interface Phonemizer {
  phonemize(text: string): Promise<string>;
}

export type PhonemizerMode = "auto" | "grapheme" | "espeak";

export type CreatePhonemizerOptions = {
  mode?: PhonemizerMode;
  language?: string;
  moduleUrl?: string;
};

class GraphemePhonemizer implements Phonemizer {
  async phonemize(text: string): Promise<string> {
    return text;
  }
}

type RuntimePhonemize = (text: string, language?: string) => Promise<unknown> | unknown;

type RuntimePhonemizerModule = {
  phonemize?: RuntimePhonemize;
};

class EspeakWasmPhonemizer implements Phonemizer {
  constructor(
    private readonly runtimePhonemize: RuntimePhonemize,
    private readonly language: string
  ) {}

  async phonemize(text: string): Promise<string> {
    return phonemizeWithPunctuation(text,this.runtimePhonemize,this.language);
  }
}

const DEFAULT_MODULE_URL = "phonemizer";
const DEFAULT_LANGUAGE = "en-us";
const moduleCache = new Map<string, Promise<RuntimePhonemize>>();

export async function createPhonemizer(options: CreatePhonemizerOptions = {}): Promise<Phonemizer> {
  const mode = options.mode ?? "auto";
  if (mode !== "auto" && mode !== "grapheme" && mode !== "espeak") {
    throw new Error(`Unsupported phonemizer mode '${mode}'.`);
  }

  if (mode === "grapheme") {
    return new GraphemePhonemizer();
  }

  const language = options.language ?? DEFAULT_LANGUAGE;
  const moduleUrl = options.moduleUrl ?? DEFAULT_MODULE_URL;

  try {
    const runtimePhonemize = await loadPhonemizeFunction(moduleUrl);
    return new EspeakWasmPhonemizer(runtimePhonemize, language);
  } catch (error) {
    if (mode === "espeak") {
      throw toError(error, `Failed to initialize eSpeak phonemizer from '${moduleUrl}'.`);
    }
    return new GraphemePhonemizer();
  }
}

async function loadPhonemizeFunction(moduleUrl: string): Promise<RuntimePhonemize> {
  const cacheKey = moduleUrl;
  const cached = moduleCache.get(cacheKey);
  if (cached) {
    return cached;
  }

  const loading = (async () => {
    const module = (moduleUrl === DEFAULT_MODULE_URL ? await import("phonemizer") : await runtimeImport(moduleUrl)) as RuntimePhonemizerModule;
    const phonemize = module.phonemize;

    if (typeof phonemize !== "function") {
      throw new Error("Module does not export a 'phonemize' function.");
    }

    return phonemize;
  })();

  moduleCache.set(cacheKey, loading);
  try {
    return await loading;
  } catch (error) {
    moduleCache.delete(cacheKey);
    throw error;
  }
}

function runtimeImport(specifier: string): Promise<unknown> {
  const importer = new Function("s", "return import(s);") as (s: string) => Promise<unknown>;
  return importer(specifier);
}

function toError(error: unknown, prefix: string): Error {
  if (error instanceof Error) {
    return new Error(`${prefix} ${error.message}`);
  }
  return new Error(`${prefix} ${String(error)}`);
}

