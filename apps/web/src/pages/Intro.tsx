import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Orbit } from '../matrix/Chrome';
import './intro.css';
const lines = ['You were born.', "You don't remember it.", "Let's skip to now."];
export default function Intro() {
  const navigate = useNavigate();
  const [step, setStep] = useState(() =>
    matchMedia('(prefers-reduced-motion: reduce)').matches ? lines.length - 1 : 0,
  );
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
    <main className="matrix-intro">
      <header>Matrix</header>
      <div className="intro-light" aria-hidden="true">
        <Orbit small />
      </div>
      <div className="intro-words">
        <h1 key={step}>{lines[step]}</h1>
        <button onClick={enter}>
          Simulate your life <span aria-hidden="true">→</span>
        </button>
      </div>
    </main>
  );
}
