const SENTENCE_BREAK_REGEX = /[.!?]+/g;
const URL_REGEX = /https?:\/\/\S+|www\.\S+/gi;
const EMAIL_REGEX = /\b[\w.+-]+@[\w-]+\.[a-z]{2,}\b/gi;
const HTML_REGEX = /<[^>]+>/g;
const PUNCTUATION_REGEX = /[^\w\s.,?!;:\-\u2014\u2013\u2026]/g;
const WHITESPACE_REGEX = /\s+/g;

const CONTRACTIONS: Array<[RegExp, string]> = [
  [/\bcan't\b/gi, "cannot"],
  [/\bwon't\b/gi, "will not"],
  [/\bshan't\b/gi, "shall not"],
  [/\bain't\b/gi, "is not"],
  [/\blet's\b/gi, "let us"],
  [/\b(\w+)n't\b/gi, "$1 not"],
  [/\b(\w+)'re\b/gi, "$1 are"],
  [/\b(\w+)'ve\b/gi, "$1 have"],
  [/\b(\w+)'ll\b/gi, "$1 will"],
  [/\b(\w+)'d\b/gi, "$1 would"],
  [/\b(\w+)'m\b/gi, "$1 am"],
  [/\bit's\b/gi, "it is"]
];

export type TextPreprocessorOptions = {
  lowercase?: boolean;
  removeUrls?: boolean;
  removeEmails?: boolean;
  removeHtml?: boolean;
  expandContractions?: boolean;
  normalizeLeadingDecimals?: boolean;
  removePunctuation?: boolean;
  removeExtraWhitespace?: boolean;
  normalizeUnicode?: boolean;
};

const DEFAULT_TEXT_PREPROCESSOR_OPTIONS: Required<TextPreprocessorOptions> = {
  lowercase: true,
  removeUrls: true,
  removeEmails: true,
  removeHtml: true,
  expandContractions: true,
  normalizeLeadingDecimals: true,
  removePunctuation: true,
  removeExtraWhitespace: true,
  normalizeUnicode: true
};

export class TextPreprocessor {
  private readonly options: Required<TextPreprocessorOptions>;

  constructor(options: TextPreprocessorOptions = {}) {
    this.options = {
      ...DEFAULT_TEXT_PREPROCESSOR_OPTIONS,
      ...options
    };
  }

  process(text: string): string {
    let out = text;

    if (this.options.normalizeUnicode) {
      out = out.normalize("NFC");
    }
    if (this.options.removeHtml) {
      out = out.replace(HTML_REGEX, " ");
    }
    if (this.options.removeUrls) {
      out = out.replace(URL_REGEX, " ");
    }
    if (this.options.removeEmails) {
      out = out.replace(EMAIL_REGEX, " ");
    }
    if (this.options.expandContractions) {
      out = expandContractions(out);
    }
    if (this.options.normalizeLeadingDecimals) {
      out = normalizeLeadingDecimals(out);
    }
    if (this.options.removePunctuation) {
      out = out.replace(PUNCTUATION_REGEX, " ");
    }
    if (this.options.lowercase) {
      out = out.toLowerCase();
    }
    if (this.options.removeExtraWhitespace) {
      out = out.replace(WHITESPACE_REGEX, " ").trim();
    }

    return out;
  }
}

export function ensurePunctuation(text: string): string {
  const trimmed = text.trim();
  if (!trimmed) {
    return trimmed;
  }

  return /[.!?,;:]$/.test(trimmed) ? trimmed : `${trimmed},`;
}

export function chunkText(text: string, maxLen = 400): string[] {
  const chunks: string[] = [];
  // Keep sentence punctuation so questions and complete thoughts retain their cadence.
  const sentences = text.match(/[^.!?]+[.!?]+|[^.!?]+$/g) ?? [];

  for (const sentence of sentences) {
    const value = sentence.trim();
    if (!value) {
      continue;
    }

    if (value.length <= maxLen) {
      chunks.push(ensurePunctuation(value));
      continue;
    }

    let current = "";
    for (const word of value.split(/\s+/)) {
      const next = current ? `${current} ${word}` : word;
      if (next.length <= maxLen) {
        current = next;
      } else {
        if (current) {
          chunks.push(ensurePunctuation(current));
        }
        current = word;
      }
    }

    if (current) {
      chunks.push(ensurePunctuation(current));
    }
  }

  return chunks;
}

function expandContractions(text: string): string {
  let out = text;
  for (const [pattern, replacement] of CONTRACTIONS) {
    out = out.replace(pattern, replacement);
  }
  return out;
}

function normalizeLeadingDecimals(text: string): string {
  const signed = text.replace(/(?<!\d)(-)\.([\d])/g, (_match, sign: string, digit: string) => `${sign}0.${digit}`);
  return signed.replace(/(?<!\d)\.([\d])/g, (_match, digit: string) => `0.${digit}`);
}
