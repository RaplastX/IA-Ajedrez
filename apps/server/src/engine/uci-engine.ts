/**
 * Motor UCI en el servidor (proceso hijo que habla por stdin/stdout).
 *  - Producción: binario nativo de Stockfish (STOCKFISH_PATH, p. ej. /usr/games/stockfish), mucho más rápido.
 *  - Desarrollo/tests: Stockfish.js (WASM) del paquete npm `stockfish`, ejecutado con Node.
 * Mismo protocolo que el motor del navegador, así que reutiliza el parser de @ia-ajedrez/core.
 */
import { parseBestMove, parseInfo, toWhitePerspective, type InfoLine, type Score } from '@ia-ajedrez/core';
import { spawn, type ChildProcessWithoutNullStreams } from 'node:child_process';
import { existsSync } from 'node:fs';
import { createRequire } from 'node:module';
import { createInterface } from 'node:readline';

export interface EngineAnalysis {
  bestmove: string | null;
  scoreWhite?: Score;
  pv: string[];
  depth: number;
}

function resolveCommand(stockfishPath?: string): { cmd: string; args: string[] } | null {
  if (stockfishPath) return existsSync(stockfishPath) ? { cmd: stockfishPath, args: [] } : null;
  try {
    const require = createRequire(import.meta.url);
    const findEngine = (require('stockfish') as { findEngine: (name: string) => string }).findEngine;
    return { cmd: process.execPath, args: [findEngine('lite-single')] };
  } catch {
    return null;
  }
}

export class UciEngine {
  private readonly proc: ChildProcessWithoutNullStreams;
  private readonly listeners = new Set<(line: string) => void>();
  private chain: Promise<unknown> = Promise.resolve();
  readonly ready: Promise<void>;

  private constructor(cmd: string, args: string[]) {
    this.proc = spawn(cmd, args, { stdio: 'pipe' });
    createInterface({ input: this.proc.stdout }).on('line', (line) => {
      for (const l of this.listeners) l(line);
    });
    this.proc.on('error', () => undefined);
    this.ready = (async () => {
      const ok = this.waitFor((l) => l === 'uciok', 60_000);
      this.send('uci');
      await ok;
      await this.isReady();
    })();
  }

  static create(stockfishPath?: string): UciEngine | null {
    const command = resolveCommand(stockfishPath);
    return command ? new UciEngine(command.cmd, command.args) : null;
  }

  private send(cmd: string) {
    this.proc.stdin.write(`${cmd}\n`);
  }

  private waitFor(predicate: (line: string) => boolean, timeoutMs: number): Promise<string> {
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        this.listeners.delete(listener);
        reject(new Error('engine_timeout'));
      }, timeoutMs);
      const listener = (line: string) => {
        if (!predicate(line)) return;
        clearTimeout(timer);
        this.listeners.delete(listener);
        resolve(line);
      };
      this.listeners.add(listener);
    });
  }

  private async isReady() {
    const ok = this.waitFor((l) => l === 'readyok', 30_000);
    this.send('isready');
    await ok;
  }

  analyse(fen: string, depth: number): Promise<EngineAnalysis> {
    const run = this.chain.then(async () => {
      await this.ready;
      let top: InfoLine | null = null;
      const listener = (line: string) => {
        const info = parseInfo(line);
        if (info?.score && !info.bound && info.multipv === 1) top = info;
      };
      this.listeners.add(listener);
      try {
        const done = this.waitFor((l) => l.startsWith('bestmove'), 60_000);
        this.send(`position fen ${fen}`);
        this.send(`go depth ${depth}`);
        const best = parseBestMove(await done);
        const final = top as InfoLine | null;
        const side = (fen.split(' ')[1] ?? 'w') as 'w' | 'b';
        return {
          bestmove: best?.bestmove ?? null,
          scoreWhite: final?.score ? toWhitePerspective(final.score, side) : undefined,
          pv: final?.pv ?? [],
          depth: final?.depth ?? 0,
        };
      } finally {
        this.listeners.delete(listener);
      }
    });
    this.chain = run.catch(() => undefined);
    return run;
  }

  close() {
    try {
      this.send('quit');
    } catch {
      // ya cerrado
    }
    this.proc.kill();
  }
}
