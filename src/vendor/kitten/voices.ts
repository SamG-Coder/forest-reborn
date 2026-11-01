import type { VoiceTable } from "./types";

export const DEFAULT_VOICE_NAMES = [
  "Bella",
  "Jasper",
  "Luna",
  "Bruno",
  "Rosie",
  "Hugo",
  "Kiki",
  "Leo"
] as const;

export const DEFAULT_VOICE_KEYS = [
  "expr-voice-2-m",
  "expr-voice-2-f",
  "expr-voice-3-m",
  "expr-voice-3-f",
  "expr-voice-4-m",
  "expr-voice-4-f",
  "expr-voice-5-m",
  "expr-voice-5-f"
] as const;

export const DEFAULT_VOICE_ALIAS: Record<string, string> = DEFAULT_VOICE_NAMES.reduce(
  (map, voiceName, index) => {
    map[voiceName] = DEFAULT_VOICE_KEYS[index] ?? DEFAULT_VOICE_KEYS[0];
    return map;
  },
  {} as Record<string, string>
);

export function resolveDisplayVoices(voiceAlias: Record<string, string>, voiceTable: VoiceTable): string[] {
  const mapped = Object.entries(voiceAlias)
    .filter((entry) => Boolean(voiceTable[entry[1]]))
    .map((entry) => entry[0]);

  if (mapped.length) {
    const preferredOrder = new Map<string, number>(DEFAULT_VOICE_NAMES.map((voice, idx) => [voice, idx]));
    return mapped.sort((a, b) => (preferredOrder.get(a) ?? Number.MAX_SAFE_INTEGER) - (preferredOrder.get(b) ?? Number.MAX_SAFE_INTEGER));
  }

  return Object.keys(voiceTable).sort();
}

export function resolveVoiceKey(requestedVoice: string, voiceAlias: Record<string, string>): string {
  return voiceAlias[requestedVoice] ?? requestedVoice;
}
