// Ten milliseconds of silent PCM unlock the same media element the priest will use.
const silence =
  'data:audio/wav;base64,UklGRnQAAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YVAAAACAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgA==';
type Entry = {
  runId: string;
  audio: HTMLAudioElement;
  context?: AudioContext;
  ready: Promise<boolean>;
};
let pending: Entry | undefined;
let expiry: number | undefined;

function release(entry: Entry) {
  entry.audio.pause();
  void entry.context?.close().catch(() => {});
}

export function prepareChapelEntry(runId: string) {
  if (typeof Audio === 'undefined') return;
  window.clearTimeout(expiry);
  if (pending) release(pending);
  const audio = new Audio(silence);
  let context: AudioContext | undefined;
  try {
    context = new AudioContext();
    void context.resume().catch(() => {});
  } catch {
    /* The native media element can also play alone. */
  }
  const entry = {
    runId,
    audio,
    context,
    ready: audio.play().then(
      () => true,
      () => false,
    ),
  };
  pending = entry;
  // If navigation was abandoned, release the unused browser audio context.
  expiry = window.setTimeout(() => {
    if (pending === entry) {
      pending = undefined;
      release(entry);
    }
  }, 60_000);
}

export async function claimChapelEntry(runId: string, isCurrent: () => boolean) {
  const entry = pending;
  if (!entry || entry.runId !== runId) return;
  const ready = await entry.ready;
  if (entry !== pending || !isCurrent()) return;
  window.clearTimeout(expiry);
  pending = undefined;
  if (!ready || (entry.context && entry.context.state !== 'running')) {
    release(entry);
    return;
  }
  return entry;
}
