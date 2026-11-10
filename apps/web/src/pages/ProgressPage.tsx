import { levelFromXp, recommendThemes } from '@ia-ajedrez/core';
import { useTranslation } from 'react-i18next';
import { Link, useNavigate } from 'react-router';
import { BarList } from '../components/common';
import { LineChart } from '../components/LineChart';
import { THEME_CATALOG } from '../data/themes';
import { downloadText } from '../lib/download';
import { useProgress } from '../store/progress';

export default function ProgressPage() {
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();
  const stats = useProgress((s) => s.stats);
  const ratingHistory = useProgress((s) => s.ratingHistory);
  const accuracyHistory = useProgress((s) => s.accuracyHistory);
  const themeStats = useProgress((s) => s.themeStats);
  const phaseErrors = useProgress((s) => s.phaseErrors);
  const games = useProgress((s) => s.games);
  const fmtDate = (iso: string) => new Date(iso).toLocaleDateString(i18n.language);

  const successRate = stats.puzzlesAttempted
    ? Math.round((stats.puzzlesSolved / stats.puzzlesAttempted) * 100)
    : 0;
  const themes = Object.entries(themeStats)
    .filter(([, s]) => s.attempts >= 1)
    .sort((a, b) => b[1].attempts - a[1].attempts)
    .slice(0, 8)
    .map(([theme, s]) => ({
      label: t(`themes.${theme}`, { defaultValue: theme }),
      value: Math.round((s.successes / s.attempts) * 100),
    }));
  const recs = recommendThemes(themeStats, { catalog: [...THEME_CATALOG], phaseErrors, limit: 3 });

  const tiles = [
    { label: t('progress.level'), value: levelFromXp(stats.xp).level },
    { label: t('progress.puzzleRating'), value: stats.puzzleRating },
    { label: t('progress.successRate'), value: `${successRate}%` },
    { label: t('progress.games'), value: `${stats.gamesWon}/${stats.gamesPlayed}` },
    { label: t('progress.bestAccuracy'), value: `${stats.bestAccuracy}%` },
    { label: t('progress.bestAi'), value: stats.bestAiEloBeaten || '–' },
  ];

  return (
    <>
      <div className="page-header">
        <div>
          <h1>{t('progress.title')}</h1>
          <p>{t('progress.subtitle')}</p>
        </div>
      </div>
      <div className="grid cols-3" style={{ marginBottom: 16 }}>
        {tiles.map((tile) => (
          <div key={tile.label} className="card stat">
            <span className="label">{tile.label}</span>
            <span className="value">{tile.value}</span>
          </div>
        ))}
      </div>
      <div className="grid cols-2">
        <section className="card">
          <LineChart
            title={t('progress.ratingHistory')}
            valueHeader={t('progress.puzzleRating')}
            points={ratingHistory.map((p, i) => ({
              x: i,
              y: p.rating,
              label: fmtDate(p.date),
              display: String(p.rating),
            }))}
          />
        </section>
        <section className="card">
          <LineChart
            title={t('progress.accuracyHistory')}
            valueHeader={t('analysis.accuracy')}
            points={accuracyHistory.map((p, i) => ({
              x: i,
              y: p.accuracy,
              label: fmtDate(p.date),
              display: `${p.accuracy.toFixed(1)}%`,
            }))}
            yDomain={[0, 100]}
            formatTick={(v) => `${v}%`}
          />
        </section>
        <section className="card">
          <h2>{t('progress.themes')}</h2>
          {themes.length ? (
            <BarList rows={themes} max={100} format={(v) => `${v}%`} />
          ) : (
            <p className="muted small">{t('charts.noData')}</p>
          )}
        </section>
        <section className="card">
          <h2>{t('progress.errorsByPhase')}</h2>
          <p className="small muted">{t('progress.errorsHelp')}</p>
          <BarList
            rows={(['opening', 'middlegame', 'endgame'] as const).map((p) => ({
              label: t(`phases.${p}`),
              value: phaseErrors[p],
            }))}
          />
          <h3 style={{ marginTop: 16 }}>{t('progress.focus')}</h3>
          <ul className="list small">
            {recs.map((r) => (
              <li key={r.theme}>
                <Link to={`/tactics?theme=${r.theme}`}>{t(`themes.${r.theme}`)}</Link> —{' '}
                {t(`reasons.${r.reason}`, {
                  rate: r.successRate === null ? '' : Math.round(r.successRate * 100),
                })}
              </li>
            ))}
          </ul>
        </section>
      </div>
      <section className="card" style={{ marginTop: 16 }}>
        <h2>{t('progress.recentGames')}</h2>
        {games.length === 0 ? (
          <p className="muted small">{t('progress.noGames')}</p>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table>
              <thead>
                <tr>
                  <th>{t('progress.date')}</th>
                  <th>{t('progress.opponent')}</th>
                  <th>{t('progress.result')}</th>
                  <th className="num">{t('analysis.accuracy')}</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {[...games].reverse().map((g) => (
                  <tr key={g.id}>
                    <td>{fmtDate(g.date)}</td>
                    <td>{g.opponent}</td>
                    <td>{g.result}</td>
                    <td className="num">
                      {g.accuracy !== undefined ? `${g.accuracy.toFixed(1)}%` : '–'}
                    </td>
                    <td>
                      <div className="row">
                        <button
                          type="button"
                          className="btn small"
                          onClick={() =>
                            navigate('/analysis', {
                              state: { pgn: g.pgn, playerColor: g.playerColor, gameId: g.id },
                            })
                          }
                        >
                          {t('play.analyze')}
                        </button>
                        <button
                          type="button"
                          className="btn small"
                          onClick={() => downloadText(`partida-${g.id.slice(0, 8)}.pgn`, g.pgn)}
                        >
                          PGN
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </>
  );
}
