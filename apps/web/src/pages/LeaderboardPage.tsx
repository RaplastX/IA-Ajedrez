import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router';
import { ServerNotice } from '../components/common';
import { api, ApiError } from '../lib/api';
import { useServerAvailable } from '../lib/server';
import { useSettings } from '../store/settings';

type Board = 'puzzle' | 'xp';

export default function LeaderboardPage() {
  const { t } = useTranslation();
  const user = useSettings((s) => s.user);
  const [board, setBoard] = useState<Board>('puzzle');
  const available = useServerAvailable();
  // El resultado guarda a qué tabla pertenece: así "cargando" se deriva sin setState en el efecto.
  const [result, setResult] = useState<{
    board: Board;
    entries?: { rank: number; displayName: string; value: number }[];
    error?: string;
  } | null>(null);

  useEffect(() => {
    if (available !== true) return;
    let active = true;
    api
      .leaderboard(board)
      .then((res) => active && setResult({ board, entries: res.entries }))
      .catch(
        (e) =>
          active &&
          setResult({
            board,
            error: e instanceof ApiError && e.status === 0 ? 'offline' : 'generic',
          }),
      );
    return () => {
      active = false;
    };
  }, [board, available]);

  const current = result?.board === board ? result : null;
  const entries = current?.entries ?? null;
  const error = current?.error ?? null;

  return (
    <>
      <div className="page-header">
        <div>
          <h1>{t('leaderboard.title')}</h1>
          <p>{t('leaderboard.subtitle')}</p>
        </div>
        <div className="row" role="tablist">
          {(['puzzle', 'xp'] as const).map((b) => (
            <button
              key={b}
              type="button"
              className="chip"
              aria-pressed={board === b}
              onClick={() => setBoard(b)}
            >
              {t(`leaderboard.boards.${b}`)}
            </button>
          ))}
        </div>
      </div>
      <section className="card">
        <ServerNotice available={available} />
        {available !== false && error && (
          <p className="muted">
            {t(`leaderboard.errors.${error}`)}{' '}
            {!user && <Link to="/settings">{t('leaderboard.login')}</Link>}
          </p>
        )}
        {available !== false && !error && !entries && (
          <p className="muted">{t('common.loading')}</p>
        )}
        {entries && entries.length === 0 && <p className="muted">{t('leaderboard.empty')}</p>}
        {entries && entries.length > 0 && (
          <table>
            <thead>
              <tr>
                <th>#</th>
                <th>{t('leaderboard.player')}</th>
                <th className="num">{t(`leaderboard.boards.${board}`)}</th>
              </tr>
            </thead>
            <tbody>
              {entries.map((e) => (
                <tr
                  key={e.rank}
                  style={user?.displayName === e.displayName ? { fontWeight: 700 } : undefined}
                >
                  <td>{e.rank}</td>
                  <td>{e.displayName}</td>
                  <td className="num">{Math.round(e.value)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
        <p className="small muted" style={{ marginTop: 12 }}>
          {t('leaderboard.privacy')}
        </p>
      </section>
    </>
  );
}
