import {
  clockRemaining,
  formatClock,
  TIME_CONTROLS,
  uciToMoveObject,
  type ClockState,
  type ClientMessage,
  type PlayerInfo,
  type ServerMessage,
  type TimeControl,
} from '@ia-ajedrez/core';
import { Chess } from 'chess.js';
import { useEffect, useReducer, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router';
import { Board, type BoardMove } from '../components/Board/Board';
import { MoveList } from '../components/common';
import { api, websocketUrl } from '../lib/api';
import { downloadText } from '../lib/download';
import { useProgress } from '../store/progress';
import { useSettings } from '../store/settings';

interface OnlineGame {
  id: string;
  color: 'w' | 'b';
  white: PlayerInfo;
  black: PlayerInfo;
  tc: TimeControl;
  chess: Chess;
  clock: ClockState;
  /** Diferencia entre el reloj del servidor y el local, para descontar bien el tiempo. */
  offset: number;
  end?: { result: '1-0' | '0-1' | '1/2-1/2'; reason: string; pgn: string };
}

export default function MultiplayerPage() {
  const { t } = useTranslation();
  const token = useSettings((s) => s.token);
  const setSession = useSettings((s) => s.setSession);
  const recordGame = useProgress((s) => s.recordGame);
  const [connection, setConnection] = useState<'idle' | 'connecting' | 'open' | 'closed'>('idle');
  const [seeking, setSeeking] = useState<TimeControl | null>(null);
  const [tc, setTc] = useState<TimeControl>('3+2');
  const [game, setGame] = useState<OnlineGame | null>(null);
  const [chat, setChat] = useState<{ from: string; text: string }[]>([]);
  const [message, setMessage] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [, tick] = useReducer((x: number) => x + 1, 0);
  const socket = useRef<WebSocket | null>(null);
  const gameRef = useRef<OnlineGame | null>(null);
  gameRef.current = game;

  useEffect(() => {
    if (!token) return;
    setConnection('connecting');
    const ws = new WebSocket(websocketUrl(token));
    socket.current = ws;
    ws.onopen = () => setConnection('open');
    ws.onclose = () => setConnection('closed');
    ws.onerror = () => setError('connection');
    ws.onmessage = (event) => {
      const msg = JSON.parse(String(event.data)) as ServerMessage;
      const current = gameRef.current;
      switch (msg.t) {
        case 'seeking':
          setSeeking(msg.tc);
          break;
        case 'cancelled':
          setSeeking(null);
          break;
        case 'start':
          setSeeking(null);
          setChat([]);
          setGame({
            id: msg.gameId,
            color: msg.color,
            white: msg.white,
            black: msg.black,
            tc: msg.tc,
            chess: new Chess(msg.fen),
            clock: msg.clock,
            offset: msg.serverNow - Date.now(),
          });
          break;
        case 'move':
          if (current?.id === msg.gameId) {
            current.chess.move(uciToMoveObject(msg.uci)!);
            setGame({ ...current, clock: msg.clock, offset: msg.serverNow - Date.now() });
          }
          break;
        case 'end':
          if (current?.id === msg.gameId) {
            const ended = { ...current, end: { result: msg.result, reason: msg.reason, pgn: msg.pgn } };
            setGame(ended);
            const opponent = current.color === 'w' ? current.black.name : current.white.name;
            recordGame({
              id: msg.gameId,
              date: new Date().toISOString(),
              mode: 'online',
              pgn: msg.pgn,
              result: msg.result,
              playerColor: current.color,
              opponent,
            });
          }
          break;
        case 'chat':
          setChat((c) => [...c.slice(-50), { from: msg.from, text: msg.text }]);
          break;
        case 'error':
          setError(msg.code);
          break;
        default:
          break;
      }
    };
    const ping = window.setInterval(() => ws.readyState === WebSocket.OPEN && ws.send(JSON.stringify({ t: 'ping' })), 25_000);
    return () => {
      window.clearInterval(ping);
      ws.close();
    };
  }, [token, recordGame]);

  // Refresca los relojes en pantalla.
  useEffect(() => {
    if (!game || game.end) return;
    const id = window.setInterval(tick, 200);
    return () => window.clearInterval(id);
  }, [game]);

  const send = (msg: ClientMessage) => socket.current?.send(JSON.stringify(msg));

  async function playAsGuest() {
    try {
      const session = await api.guest();
      setSession(session.token, session.user);
    } catch {
      setError('server');
    }
  }

  if (!token) {
    return (
      <>
        <div className="page-header">
          <div>
            <h1>{t('online.title')}</h1>
            <p>{t('online.subtitle')}</p>
          </div>
        </div>
        <section className="card">
          <p>{t('online.needAccount')}</p>
          <div className="row">
            <button type="button" className="btn primary" onClick={() => void playAsGuest()}>
              {t('online.guest')}
            </button>
            <Link className="btn" to="/settings">
              {t('online.login')}
            </Link>
          </div>
          {error && <p className="status bad" style={{ marginTop: 12 }}>{t('online.errors.server')}</p>}
        </section>
      </>
    );
  }

  function onMove(move: BoardMove) {
    if (!game || game.end) return;
    send({ t: 'move', gameId: game.id, uci: `${move.from}${move.to}${move.promotion ?? ''}` });
  }

  const remaining = game ? clockRemaining(game.clock, Date.now() + game.offset) : null;
  const history = game?.chess.history({ verbose: true }) ?? [];
  const last = history[history.length - 1];
  const opponentColor = game?.color === 'w' ? 'b' : 'w';
  const playerRow = (color: 'w' | 'b') =>
    game && remaining ? (
      <div className="spread">
        <span>
          <strong>{color === 'w' ? game.white.name : game.black.name}</strong>
          {color === game.color ? ` (${t('online.you')})` : ''}
        </span>
        <span className={`clock${!game.end && game.chess.turn() === color ? ' active' : ''}`} data-testid={`clock-${color}`}>
          {formatClock(remaining[color])}
        </span>
      </div>
    ) : null;

  return (
    <>
      <div className="page-header">
        <div>
          <h1>{t('online.title')}</h1>
          <p>{t('online.subtitle')}</p>
        </div>
        <span className="chip" data-testid="connection">{t(`online.connection.${connection}`)}</span>
      </div>
      <div className="train-layout">
        <div className="panel">
          {playerRow(opponentColor)}
          <Board
            fen={game?.chess.fen() ?? new Chess().fen()}
            orientation={game?.color ?? 'w'}
            movable={game && !game.end ? game.color : 'none'}
            onMove={onMove}
            lastMove={last ? [last.from, last.to] : null}
          />
          {game && playerRow(game.color)}
        </div>
        <div className="panel">
          {(!game || game.end) && (
            <section className="card">
              <h2>{t('online.seek')}</h2>
              <div className="row" style={{ marginBottom: 12 }}>
                {TIME_CONTROLS.map((c) => (
                  <button key={c} type="button" className="chip" aria-pressed={tc === c} onClick={() => setTc(c)}>
                    {c}
                  </button>
                ))}
              </div>
              {seeking ? (
                <div className="row">
                  <span className="status" aria-live="polite">{t('online.searching', { tc: seeking })}</span>
                  <button type="button" className="btn" onClick={() => send({ t: 'cancel' })}>
                    {t('common.cancel')}
                  </button>
                </div>
              ) : (
                <button type="button" className="btn primary" disabled={connection !== 'open'} onClick={() => send({ t: 'seek', tc })}>
                  {t('online.find')}
                </button>
              )}
            </section>
          )}
          {game && (
            <section className="card">
              {game.end ? (
                <>
                  <p className="status" aria-live="polite">
                    {t(`online.end.${game.end.reason}`, { result: game.end.result })}
                  </p>
                  <button type="button" className="btn small" onClick={() => downloadText(`online-${game.id.slice(0, 8)}.pgn`, game.end!.pgn)}>
                    {t('common.downloadPgn')}
                  </button>
                </>
              ) : (
                <div className="spread">
                  <span className="status">{game.chess.turn() === game.color ? t('play.yourTurn') : t('play.waiting')}</span>
                  <button type="button" className="btn danger" onClick={() => send({ t: 'resign', gameId: game.id })}>
                    {t('play.resign')}
                  </button>
                </div>
              )}
              <MoveList moves={history.map((m) => ({ san: m.san }))} current={history.length} />
            </section>
          )}
          {game && (
            <section className="card">
              <h3>{t('online.chat')}</h3>
              <div className="chat-log" aria-live="polite">
                {chat.map((c, i) => (
                  <div key={i}>
                    <strong>{c.from}:</strong> {c.text}
                  </div>
                ))}
              </div>
              <form
                className="row"
                style={{ marginTop: 8 }}
                onSubmit={(e) => {
                  e.preventDefault();
                  if (message.trim()) send({ t: 'chat', gameId: game.id, text: message });
                  setMessage('');
                }}
              >
                <input type="text" value={message} maxLength={200} onChange={(e) => setMessage(e.target.value)} aria-label={t('online.chat')} style={{ flex: 1 }} />
                <button type="submit" className="btn small">
                  {t('online.send')}
                </button>
              </form>
              <p className="small muted" style={{ marginTop: 6 }}>{t('online.chatRules')}</p>
            </section>
          )}
          {error && <p className="status bad">{t(`online.errors.${['connection', 'server', 'illegal_move', 'not_your_turn'].includes(error) ? error : 'server'}`)}</p>}
        </div>
      </div>
    </>
  );
}
