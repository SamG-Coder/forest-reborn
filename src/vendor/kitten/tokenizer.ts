const PAD = "$";
const PUNCTUATION = ';:,.!?¡¿—…"«»"" ';
const LETTERS = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz";
const LETTERS_IPA =
  "ɑɐɒæɓʙβɔɕçɗɖðʤəɘɚɛɜɝɞɟʄɡɠɢʛɦɧħɥʜɨɪʝɭɬɫɮʟɱɯɰŋɳɲɴøɵɸθœɶʘɹɺɾɻʀʁɽʂʃʈʧʉʊʋⱱʌɣɤʍχʎʏʑʐʒʔʡʕʢǀǁǂǃˈˌːˑʼʴʰʱʲʷˠˤ˞↓↑→↗↘'̩'ᵻ";

const SYMBOLS = [PAD, ...Array.from(PUNCTUATION), ...Array.from(LETTERS), ...Array.from(LETTERS_IPA)];

export class TextCleaner {
  private readonly symbolToId: Map<string, number>;

  constructor() {
    this.symbolToId = new Map(SYMBOLS.map((symbol, index) => [symbol, index]));
  }

  tokenize(input: string): number[] {
    const out: number[] = [];
    for (const symbol of input) {
      const id = this.symbolToId.get(symbol);
      if (id !== undefined) {
        out.push(id);
      }
    }
    return out;
  }
}

export function basicEnglishTokenize(text: string): string[] {
  return text.match(/[\p{L}\p{M}\p{N}_]+|[^\p{L}\p{M}\p{N}_\s]/gu) ?? [];
}

export function normalizePhonemesForTokenizer(text: string): string {
  return basicEnglishTokenize(text).join(" ");
}

export function addBoundaryTokens(tokens: number[]): number[] {
  return [0, ...tokens, 10, 0];
}
