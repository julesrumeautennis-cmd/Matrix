import { homily, testimony } from '../apps/web/src/data/chapelLines';

export const elevenModel = 'eleven_v4';

// Fixed premade library voices. The keys are the cast IDs used by the chapel's recordings.
export const libraryCast: Readonly<Record<string, string>> = {
  bm_george: 'JBFqnCBsd6RMkjVDRZzb', // George, priest
  af_heart: 'pFZP5JQG7iQjIQuC4Bku', // Lily, spouse
  bf_emma: 'Xb7hH8MSUJpSbSDYk0k2', // Alice, mother
  am_fenrir: 'pqHfZKP75CvOlQylNhV4', // Bill, father
  af_kore: 'EXAVITQu4vr4xnSDxMaL', // Sarah, sister
  am_puck: 'bIHbv24MWmeRgasZH58o', // Will, friend
  af_bella: 'cgSgspJ2msm6clMCkdW9', // Jessica, daughter
  am_michael: 'cjVigY5qzO86Huf0OWal', // Eric, cofounder
  af_sarah: 'XrExE9yKIg1WjnnlVkGX', // Matilda, friend
};

// Each mark is inserted before existing dialogue. Captions always keep the original text.
const readings = new Map<string, { opening: string; turn?: [string, string] }>([
  [homily.fulfilled, { opening: 'warmly', turn: ['Then they’ll ask', 'dryly'] }],
  [homily.content, { opening: 'gently amused', turn: ['Please,', 'tenderly'] }],
  [homily.restless, { opening: 'conversational', turn: ['Things finally', 'softly'] }],
  [homily.protagonistAffair, { opening: 'measured', turn: ['And the person', 'quietly'] }],
  [homily.spouseAffair, { opening: 'measured', turn: ['The one who', 'quietly'] }],
  [homily.daughterClose, { opening: 'fondly' }],
  [homily.sonClose, { opening: 'warmly' }],
  [homily.silence, { opening: 'softly' }],
  [homily.blessing, { opening: 'gently', turn: ['When you get outside', 'warmly'] }],
  [
    testimony.protagonistAffair,
    { opening: 'holding back tears', turn: ['Look at me.', 'voice catches'] },
  ],
  [testimony.spouseAffair, { opening: 'hesitant', turn: ['I do.', 'voice trembling'] }],
  [testimony.divorce, { opening: 'quietly', turn: ['Then I walked', 'voice catches'] }],
  [testimony.marriage, { opening: 'tenderly', turn: ['I never practiced', 'holding back tears'] }],
]);

export function elevenReading(cast: string, words: string) {
  const priest = cast === 'bm_george';
  const reading = readings.get(words);
  const turn = reading?.turn;
  const text = turn ? words.replace(turn[0], '[' + turn[1] + '] ' + turn[0]) : words;
  return {
    model_id: elevenModel,
    language_code: 'en',
    text: reading ? '[' + reading.opening + '] ' + text : text,
    voice_settings: { stability: priest ? 0.55 : 0.4, similarity_boost: 0.75 },
  };
}
