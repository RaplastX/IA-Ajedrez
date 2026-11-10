/** ¿Hay un servidor de API conectado? Las funciones online se desactivan con un aviso si no. */
import { useEffect, useState } from 'react';

const BASE = (import.meta.env.VITE_API_URL as string | undefined)?.replace(/\/$/, '') ?? '';
let cached: Promise<boolean> | null = null;

export function checkServer(): Promise<boolean> {
  cached ??= (async () => {
    try {
      const res = await fetch(`${BASE}/health`, { signal: AbortSignal.timeout(4000) });
      // En hosting estático "/health" devuelve el index.html, así que se exige el JSON de la API.
      const body = (await res.json()) as { status?: string };
      return res.ok && body.status === 'ok';
    } catch {
      return false;
    }
  })();
  return cached;
}

/** null mientras se comprueba; después true/false. */
export function useServerAvailable(): boolean | null {
  const [available, setAvailable] = useState<boolean | null>(null);
  useEffect(() => {
    let active = true;
    void checkServer().then((ok) => active && setAvailable(ok));
    return () => {
      active = false;
    };
  }, []);
  return available;
}
