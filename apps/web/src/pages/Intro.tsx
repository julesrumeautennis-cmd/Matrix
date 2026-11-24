import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useProfileStore } from '../store/profile';
import { Header, Orbit } from '../matrix/Chrome';
const lines = ['You were born.', "You don't remember it.", "Let's skip to now."];
export default function Intro() {
  const navigate = useNavigate();
  const castSize = useProfileStore((s) => s.profile.relatives.length + 1);
  const [step, setStep] = useState(0);
  useEffect(() => {
    if (matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    const timers = [2700, 5300].map((ms, i) => setTimeout(() => setStep(i + 1), ms));
    return () => timers.forEach(clearTimeout);
  }, []);
  function enter() {
    try {
      const ctx = new AudioContext();
      const osc = ctx.createOscillator(),
        gain = ctx.createGain();
      osc.frequency.value = 54;
      gain.gain.setValueAtTime(0.001, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.09, ctx.currentTime + 0.04);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.28);
      osc.connect(gain).connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + 0.3);
      osc.onended = () => void ctx.close();
    } catch {
      /* Silent opening. */
    }
    navigate('/you');
  }
  return (
    <div className="mx mx-opening">
      <Header />
      <main className="mx-opening-main">
        <div className="mx-opening-copy">
          <div className="mx-kicker">
            <i />A personal life simulation
          </div>
          <h1 key={step}>{lines[step]}</h1>
          <p>
            You and the people closest to you, across a hundred possible futures. Which life will
            you recognize?
          </p>
          <button className="mx-primary" onClick={enter}>
            Begin your simulation <span aria-hidden="true">→</span>
          </button>
        </div>
        <figure className="mx-orbit-frame">
          <Orbit />
          <figcaption>
            <span className="mx-live-dot" /> Initial conditions{' '}
            <span>
              {castSize} {castSize === 1 ? 'agent' : 'agents'} / 100 lives
            </span>
          </figcaption>
        </figure>
      </main>
      <footer className="mx-opening-footer">
        <span>Matrix</span>
        <span>Life simulation experiment</span>
      </footer>
    </div>
  );
}
