import { execFileSync } from 'node:child_process';
import { createHash, randomUUID } from 'node:crypto';
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  renameSync,
  rmSync,
  statSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { basename, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { ProfileSchema, RunSchema, type Profile, type Run } from '@eulogy/shared';
import { homily, missedCalls, testimony } from '../apps/web/src/data/chapelLines';
import { buildChapelService } from '../apps/web/src/data/chapelService';
import { demoRecipe } from '../apps/web/src/matrix/analysis';
import { getLives } from '../apps/web/src/matrix/simulation';
import { funeralPerformer } from '../apps/web/src/data/funeralCast';
import type { FuneralRecording } from '../apps/web/src/data/funeralAudio';
import { elevenModel, elevenReading, libraryCast } from './chapel-readings';
import namePronunciations from './funeral-pronunciations.json';

const root = fileURLToPath(new URL('../', import.meta.url));
const data = join(root, 'data');
const web = join(root, 'apps/web');
const publicDir = join(web, 'public');
const manifestPath = join(web, 'src/data/audio.json');
const json = (path: string) => JSON.parse(readFileSync(path, 'utf8'));

// The bundled recordings use only public demonstration data.
function archives(): { profile: Profile; runs: Run[] }[] {
  const sources: [string, unknown[]][] = [
    ['jules', json(join(data, 'screenings/jules.json')).runs],
    [
      'louis',
      readFileSync(join(data, 'runs/louis-demo.jsonl'), 'utf8')
        .trim()
        .split('\n')
        .map((line) => JSON.parse(line)),
    ],
  ];
  return sources.map(([name, rows]) => {
    const profile = ProfileSchema.parse(json(join(data, 'profiles', name + '.json')));
    const runs = rows.map((row) => RunSchema.parse(row));
    if (runs.some((run) => run.profile_id !== profile.id))
      throw Error('Archive and profile disagree for ' + name);
    return { profile, runs };
  });
}

interface RenderJob extends Omit<FuneralRecording, 'durationMs'> {
  speed: number;
  pronunciations: Record<string, string>;
  speech?: ReturnType<typeof elevenReading>;
  checkVoice?: boolean;
}
type PublishedRecording = FuneralRecording & { sha256?: string };
const fileDigest = (path: string) => createHash('sha256').update(readFileSync(path)).digest('hex');
const args = process.argv.slice(2);
if (
  args.some((arg) => !['--elevenlabs', '--kokoro', '--plan'].includes(arg)) ||
  (args.includes('--elevenlabs') && args.includes('--kokoro'))
)
  throw Error('Usage: npm run voices -- [--elevenlabs | --kokoro] [--plan]');
const prior = existsSync(manifestPath) ? json(manifestPath) : {};
const remote =
  args.includes('--elevenlabs') || (!args.includes('--kokoro') && prior.engine === elevenModel);
const planOnly = args.includes('--plan');
if (remote && existsSync(join(root, '.env'))) process.loadEnvFile(join(root, '.env'));
const engine = remote ? elevenModel : 'kokoro-82m-v1.0';
const delivery: Record<string, number> = {
  bm_george: 0.91,
  bf_emma: 0.92,
  am_fenrir: 0.9,
  af_kore: 0.95,
  am_puck: 0.97,
  af_heart: 0.94,
  af_bella: 0.96,
  am_michael: 0.95,
};
const jobs = new Map<string, RenderJob>();
const castReadings = new Map<string, RenderJob>();
let runCount = 0;
const passages: { cast: string; text: string }[] = [
  ...[...Object.values(homily), ...missedCalls].map((text) => ({ cast: 'bm_george', text })),
  ...Object.values(testimony).map((text) => ({ cast: 'af_heart', text })),
];
for (const { profile, runs } of [
  ...archives(),
  { profile: demoRecipe.profile, runs: getLives(demoRecipe) },
]) {
  runCount += runs.length;
  for (const run of runs) {
    const { guests, cues } = buildChapelService(profile, run);
    for (const cue of cues) {
      if (!cue.speaks) continue;
      const cast = funeralPerformer({ relatives: guests }, cue);
      if (!cast || !cue.text.trim())
        throw Error('Missing performer or line for ' + run.run_id + '/' + cue.id);
      passages.push({ cast, text: cue.text });
    }
  }
}
for (const { cast, text } of passages) {
  const voice = remote
    ? process.env['ELEVENLABS_VOICE_' + cast.toUpperCase()] || libraryCast[cast]
    : cast;
  if (!voice) throw Error('Set a library voice in ELEVENLABS_VOICE_' + cast.toUpperCase());
  const speed = remote ? 1 : (delivery[cast] ?? 0.95);
  const words = new Set(text.match(/[\p{L}\p{M}]+/gu) ?? []);
  const names = remote
    ? []
    : Object.entries(namePronunciations).filter(([name]) => words.has(name));
  const speech = remote ? elevenReading(cast, text) : undefined;
  const rendition = speech
    ? [engine, 'mp3_44100_128', voice, speech]
    : [engine, 'chapel-reading-v1', voice, speed, text, ...names];
  const digest = createHash('sha256').update(JSON.stringify(rendition)).digest('hex');
  const src = '/audio/chapel/' + digest + '.mp3';
  const job = {
    cast,
    voice,
    speed,
    text,
    src,
    pronunciations: Object.fromEntries(names),
    speech,
    checkVoice: remote && !Object.values(libraryCast).includes(voice),
  };
  jobs.set(src, job);
  castReadings.set(JSON.stringify([cast, text]), job);
}
if (!jobs.size) throw Error('Archives contain no speaking cues.');
const cached = new Map<string, PublishedRecording>(
  (Array.isArray(prior.clips) ? prior.clips : []).map((clip: PublishedRecording) => [
    clip.src,
    clip,
  ]),
);
const durations = new Map<string, number>();
const repair = new Set<string>();
const pending = [...jobs.values()].filter((job) => {
  const old = cached.get(job.src);
  const path = join(publicDir, job.src);
  if (
    old &&
    old.voice === job.voice &&
    old.text === job.text &&
    old.durationMs > 0 &&
    existsSync(path) &&
    statSync(path).size > 500
  ) {
    if (old.sha256 && old.sha256 !== fileDigest(path)) {
      repair.add(job.src);
      return true;
    }
    durations.set(job.src, old.durationMs);
    return false;
  }
  return true;
});
const outputDir = join(publicDir, 'audio/chapel');
if (planOnly) {
  console.log(
    engine +
      ': ' +
      jobs.size +
      ' unique recordings, ' +
      pending.length +
      ' to verify or render, up to ' +
      pending.reduce((n, job) => n + Array.from(job.speech?.text ?? job.text).length, 0) +
      ' input characters in pending passages (including delivery tags).',
  );
  process.exit(0);
}
mkdirSync(outputDir, { recursive: true });
if (pending.length) {
  if (remote && !process.env.ELEVENLABS_API_KEY)
    throw Error('Set ELEVENLABS_API_KEY in the local .env file to record these passages.');
  const scratch = mkdtempSync(join(tmpdir(), 'eulogy-voices-'));
  try {
    const plan = join(scratch, 'plan.json');
    const receipt = join(scratch, 'durations.json');
    writeFileSync(
      plan,
      JSON.stringify(
        pending.map((job) => ({
          ...job,
          filename: basename(job.src),
          repair: repair.has(job.src),
        })),
      ),
    );
    const localPython = join(
      root,
      '.local/voices/.venv',
      process.platform === 'win32' ? 'Scripts/python.exe' : 'bin/python',
    );
    const envPython =
      process.env.EULOGY_VOICE_PYTHON ?? (existsSync(localPython) ? localPython : undefined);
    const command = envPython ?? 'uv';
    const helper = join(root, 'scripts/render-funeral-voices.py');
    const commandArgs = envPython ? [helper] : ['run', '--script', helper];
    console.log('Recording ' + pending.length + ' passages with ' + engine + '.');
    execFileSync(command, [...commandArgs, engine, plan, receipt, outputDir], {
      cwd: root,
      stdio: 'inherit',
    });
    const measured: Record<string, number> = json(receipt);
    for (const job of pending) {
      const ms = measured[basename(job.src)];
      if (!ms || !Number.isFinite(ms) || ms < 200) throw Error('Missing duration for ' + job.src);
      durations.set(job.src, ms);
    }
  } finally {
    rmSync(scratch, { recursive: true, force: true });
  }
}
// Two library roles may deliberately share one ElevenLabs performer. Address
// the file by its actual voice + text, and preserve a lookup for each cast.
const clips = [...castReadings.values()].map(({ src, cast, voice, text }) => ({
  cast,
  voice,
  text,
  src,
  durationMs: durations.get(src)!,
  sha256: fileDigest(join(publicDir, src)),
}));
const out = JSON.stringify({ engine, clips }, null, 2) + '\n';
if (!existsSync(manifestPath) || readFileSync(manifestPath, 'utf8') !== out) {
  const stage = manifestPath + '.' + randomUUID() + '.tmp';
  writeFileSync(stage, out);
  renameSync(stage, manifestPath);
}
console.log(
  runCount +
    ' lives, ' +
    passages.length +
    ' passages, ' +
    jobs.size +
    ' recordings (' +
    pending.length +
    ' rendered).',
);
