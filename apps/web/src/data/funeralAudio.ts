import { funeralPerformer, type ChapelCue, type ChapelGuest } from './funeralCast';
import manifest from './audio.json';

export interface FuneralRecording {
  cast: string;
  voice: string;
  text: string;
  src: string;
  durationMs: number;
}

const recordings: readonly FuneralRecording[] =
  'clips' in manifest && Array.isArray(manifest.clips) ? manifest.clips : [];

export function devicePerformer<T extends Pick<SpeechSynthesisVoice, 'lang' | 'name' | 'voiceURI'>>(
  voices: readonly T[],
  language: string,
  slot: number,
): T | null {
  const english = voices.filter((voice) => /^en(?:[-_]|$)/i.test(voice.lang));
  const natural = english.filter((voice) =>
    /premium|enhanced|neural|natural/i.test(voice.name + ' ' + voice.voiceURI),
  );
  const available = natural.length ? natural : english;
  const regional = available.filter(
    (voice) => voice.lang.replace('_', '-').toLowerCase() === language.toLowerCase(),
  );
  const cast = regional.length ? regional : available;
  return cast.length ? cast[slot % cast.length]! : null;
}

export function findFuneralRecording(
  profile: { relatives: readonly ChapelGuest[] },
  cue: Pick<ChapelCue, 'speaks' | 'kind' | 'relativeId' | 'text'>,
): FuneralRecording | undefined {
  const cast = funeralPerformer(profile, cue);
  if (!cast) return undefined;
  return recordings.find((clip) => clip.cast === cast && clip.text === cue.text);
}
