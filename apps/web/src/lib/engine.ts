/**
 * Cliente de Stockfish (WASM) en un Web Worker que habla UCI por postMessage.
 * Serializa las peticiones en una cola: una sola búsqueda a la vez, como exige UCI.
 */
import {
  parseBestMove,
  parseInfo,
  toWhitePerspective,
  type InfoLine,
  type Score,
} from '@ia-ajedrez/core';

export interface SearchOptions {
  depth?: number;
  movetime?: number;
  multipv?: number;
  signal?: AbortSignal;
}

export interface SearchResult {
  bestmove: string | null;
  /** Variantes por índice MultiPV (puntuación desde el bando que mueve). */
  lines: InfoLine[];
  /** Puntuación de la mejor variante desde el punto de vista de las blancas. */
  scoreWhite?: Score;
  depth: number;
}

type Listener = (line: string) => void;

export class StockfishEngine {
  private readonly worker: Worker;
  private readonly listeners = new Set<Listener>();
  private chain: Promise<unknown> = Promise.resolve();
  private readonly options = new Map<string, string>();
  readonly ready: Promise<void>;

  constructor(url = `${import.meta.env.BASE_URL}engine/stockfish.js`) {
    this.worker = new Worker(url);
    this.worker.onmessage = (event: MessageEvent) => {
      const line = String(event.data);
      for (const listener of this.listeners) listener(line);
    };
    this.ready = this.handshake();
  }

  private send(command: string) {
    this.worker.postMessage(command);
  }

  private waitFor(predicate: (line: string) => boolean, timeoutMs = 30_000): Promise<string> {
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        this.listeners.delete(listener);
        reject(new Error('Tiempo de espera del motor agotado'));
      }, timeoutMs);
      const listener: Listener = (line) => {
        if (!predicate(line)) return;
        clearTimeout(timer);
        this.listeners.delete(listener);
        resolve(line);
      };
      this.listeners.add(listener);
    });
  }

  private async handshake() {
    const uciok = this.waitFor((l) => l === 'uciok');
    this.send('uci');
    await uciok;
    await this.isReady();
  }

  private async isReady() {
    const ok = this.waitFor((l) => l === 'readyok');
    this.send('isready');
    await ok;
  }

  private enqueue<T>(task: () => Promise<T>): Promise<T> {
    const run = this.chain.then(task, task);
    this.chain = run.catch(() => undefined);
    return run;
  }

  /** Cambia opciones UCI; solo envía las que cambian. */
  configure(options: Record<string, string | number | boolean>): Promise<void> {
    return this.enqueue(async () => {
      await this.ready;
      let changed = false;
      for (const [name, raw] of Object.entries(options)) {
        const value = String(raw);
        if (this.options.get(name) === value) continue;
        this.options.set(name, value);
        this.send(`setoption name ${name} value ${value}`);
        changed = true;
      }
      if (changed) await this.isReady();
    });
  }

  newGame(): Promise<void> {
    return this.enqueue(async () => {
      await this.ready;
      this.send('ucinewgame');
      await this.isReady();
    });
  }

  /** Detiene la búsqueda en curso; su promesa se resuelve con lo calculado hasta ahora. */
  stop() {
    this.send('stop');
  }

  search(
    fen: string,
    options: SearchOptions = {},
    onInfo?: (info: InfoLine) => void,
  ): Promise<SearchResult> {
    return this.enqueue(async () => {
      await this.ready;
      if (options.signal?.aborted) return { bestmove: null, lines: [], depth: 0 };
      const multipv = String(options.multipv ?? 1);
      if (this.options.get('MultiPV') !== multipv) {
        this.options.set('MultiPV', multipv);
        this.send(`setoption name MultiPV value ${multipv}`);
      }
      const lines: InfoLine[] = [];
      let depth = 0;
      const listener: Listener = (line) => {
        const info = parseInfo(line);
        if (!info?.score || info.bound) return;
        lines[info.multipv - 1] = info;
        depth = Math.max(depth, info.depth);
        onInfo?.(info);
      };
      this.listeners.add(listener);
      const onAbort = () => this.stop();
      options.signal?.addEventListener('abort', onAbort, { once: true });
      try {
        const done = this.waitFor((l) => l.startsWith('bestmove'), 120_000);
        this.send(`position fen ${fen}`);
        if (options.movetime) this.send(`go movetime ${options.movetime}`);
        else this.send(`go depth ${options.depth ?? 14}`);
        const best = parseBestMove(await done);
        const sideToMove = (fen.split(' ')[1] ?? 'w') as 'w' | 'b';
        const top = lines[0]?.score;
        return {
          bestmove: best?.bestmove ?? null,
          lines: lines.filter(Boolean),
          scoreWhite: top ? toWhitePerspective(top, sideToMove) : undefined,
          depth,
        };
      } finally {
        this.listeners.delete(listener);
        options.signal?.removeEventListener('abort', onAbort);
      }
    });
  }

  terminate() {
    this.worker.terminate();
  }
}

let shared: StockfishEngine | null = null;

export const engineSupported = () =>
  typeof Worker !== 'undefined' && typeof WebAssembly !== 'undefined';

/** Motor compartido por toda la app (se crea al primer uso). */
export function getEngine(): StockfishEngine {
  if (!shared) shared = new StockfishEngine();
  return shared;
}

/** Opciones para análisis a máxima fuerza (el motor es compartido con el modo de juego). */
export const FULL_STRENGTH = { UCI_LimitStrength: false, 'Skill Level': 20 } as const;
