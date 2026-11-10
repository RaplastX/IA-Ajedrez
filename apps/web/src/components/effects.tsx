/** Capas globales de efectos: confeti de celebración, intro animada y tema/efectos en <html>. */
import { useEffect, useRef, useState } from 'react';
import { confetti, ParticleSystem } from '../lib/fx';
import { play } from '../lib/sound';
import { notify } from '../lib/haptics';
import { useProgress } from '../store/progress';
import { motionEnabled, useSettings } from '../store/settings';

/** Aplica el tema de la app y el ajuste de efectos como atributos de <html>. */
export function useAppearance() {
  const appTheme = useSettings((s) => s.appTheme);
  const effects = useSettings((s) => s.effects);
  useEffect(() => {
    const root = document.documentElement;
    if (appTheme === 'system') root.removeAttribute('data-theme');
    else root.setAttribute('data-theme', appTheme);
    root.setAttribute('data-effects', effects ? 'on' : 'off');
    const dark =
      appTheme === 'dark' ||
      (appTheme === 'system' && matchMedia('(prefers-color-scheme: dark)').matches);
    document
      .querySelector('meta[name="theme-color"]')
      ?.setAttribute('content', dark ? '#030304' : '#f6f4ef');
  }, [appTheme, effects]);
}

/** Confeti cromado a pantalla completa cuando se dispara `celebrate()` o se gana una insignia/reto. */
export function Celebration() {
  const canvas = useRef<HTMLCanvasElement>(null);
  const system = useRef<ParticleSystem | null>(null);
  const toasts = useProgress((s) => s.toasts);
  const seen = useRef(new Set<string>());

  useEffect(() => {
    const fire = () => {
      if (!canvas.current || !motionEnabled()) return;
      system.current ??= new ParticleSystem(canvas.current);
      system.current.add(confetti(window.innerWidth));
    };
    window.addEventListener('ia:celebrate', fire);
    return () => {
      window.removeEventListener('ia:celebrate', fire);
      system.current?.dispose();
    };
  }, []);

  useEffect(() => {
    for (const toast of toasts) {
      if (seen.current.has(toast.id)) continue;
      seen.current.add(toast.id);
      if (toast.kind === 'badge' || toast.kind === 'challenge') {
        play('notify');
        notify('success');
        window.dispatchEvent(new CustomEvent('ia:celebrate'));
      }
    }
  }, [toasts]);

  return <canvas ref={canvas} className="celebration" aria-hidden="true" />;
}

/** Presentación del logo al abrir la app (una vez por sesión, salvo "reducir movimiento"). */
export function Splash() {
  const [show] = useState(() => {
    try {
      if (!motionEnabled() || sessionStorage.getItem('ia-ajedrez:splash')) return false;
      sessionStorage.setItem('ia-ajedrez:splash', '1');
      return true;
    } catch {
      return false;
    }
  });
  const [done, setDone] = useState(false);
  useEffect(() => {
    if (!show) return;
    const timer = window.setTimeout(() => setDone(true), 1700);
    return () => window.clearTimeout(timer);
  }, [show]);
  if (!show || done) return null;
  return (
    <div className="splash" aria-hidden="true">
      <div>
        <img className="splash-logo" src="/icon-512.png" alt="" />
        <div className="splash-title">IA Ajedrez</div>
      </div>
    </div>
  );
}
