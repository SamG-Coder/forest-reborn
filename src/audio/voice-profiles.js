export const VOICE_BANKS = Object.freeze({
  male: ['Jasper', 'Bruno', 'Hugo', 'Leo'],
  female: ['Bella', 'Luna', 'Rosie', 'Kiki'],
});

function hash(text) {
  let value = 2166136261;
  for (const char of String(text)) value = Math.imul(value ^ char.charCodeAt(0), 16777619) >>> 0;
  return value;
}

/** Identity, rather than spawn order, owns the voice across saves and zone reloads. */
export function voiceProfile(person) {
  const id = person.id ?? person.name ?? 'traveller';
  const gender = person.gender ?? person.actor?.avatar?.bodyType ?? person.bodyType ?? 'male';
  const seed = hash(id), bank = VOICE_BANKS[gender] ?? VOICE_BANKS.male;
  return {
    id,
    voice: bank.includes(person.voice) ? person.voice : id === 'innkeeper' ? 'Hugo' : bank[seed % bank.length],
    speed: id === 'innkeeper' ? .98 : .96 + (seed % 9) * .01,
    pitch: id === 'innkeeper' ? -.5 : ((seed >>> 5) % 13 - 6) * .15,
    warmth: id === 'innkeeper' ? 2.5 : ((seed >>> 9) % 9 - 4) * .5,
  };
}

export function spokenText(text) {
  return String(text ?? '').replace(/<[^>]*>/g, '').replace(/[‘’]/g, "'")
    .replace(/[“”]/g, '"').replace(/…/g, '...').replace(/\s+/g, ' ').trim().slice(0, 500);
}

export function voiceCacheKey(profile, text) {
  return `${profile.voice}|${profile.speed}|${spokenText(text)}`;
}
