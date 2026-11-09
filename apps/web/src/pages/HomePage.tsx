import { challengeProgress, dailyChallenges, levelFromXp, rankTitle, recommendThemes } from '@ia-ajedrez/core';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router';
import { THEME_CATALOG } from '../data/themes';
import { today } from '../lib/storage';
import { useProgress } from '../store/progress';

export function HomePage() {
  const { t } = useTranslation();
  const stats = useProgress((s) => s.stats);
  const streak = useProgress((s) => s.streak);
  const daily = useProgress((s) => s.daily);
  const themeStats = useProgress((s) => s.themeStats);
  const phaseErrors = useProgress((s) => s.phaseErrors);
  const personal = useProgress((s) => s.personalPuzzles.length);

  const level = levelFromXp(stats.xp);
  const day = today();
  const counters = daily.day === day ? daily.counters : {};
  const completed = daily.day === day ? daily.completed : [];
  const challenges = dailyChallenges(day);
  const recommendations = recommendThemes(themeStats, { catalog: [...THEME_CATALOG], phaseErrors, limit: 3 });

  return (
    <>
      <div className="page-header">
        <div>
          <h1>{t('home.title')}</h1>
          <p>{t('home.subtitle')}</p>
        </div>
        <div className="row">
          <Link className="btn primary" to="/tactics?mode=daily">
            {t('home.dailyPuzzle')}
          </Link>
          <Link className="btn" to="/play">
            {t('home.playAi')}
          </Link>
        </div>
      </div>

      <div className="grid cols-3" style={{ marginBottom: 16 }}>
        <section className="card stat" aria-label={t('home.level')}>
          <span className="label">{t('home.level')}</span>
          <span className="value" data-testid="level">
            {level.level} · {t(`ranks.${rankTitle(level.level)}`)}
          </span>
          <div className="progress" role="progressbar" aria-valuenow={Math.round(level.progress * 100)} aria-valuemin={0} aria-valuemax={100}>
            <span style={{ width: `${level.progress * 100}%` }} />
          </div>
          <span className="small muted">
            {t('home.xpToNext', { xp: level.xpForNext - level.xpIntoLevel, total: stats.xp })}
          </span>
        </section>
        <section className="card stat">
          <span className="label">{t('home.streak')}</span>
          <span className="value">🔥 {streak.current}</span>
          <span className="small muted">{t('home.longestStreak', { days: streak.longest })}</span>
        </section>
        <section className="card stat">
          <span className="label">{t('home.puzzleRating')}</span>
          <span className="value" data-testid="puzzle-rating">
            {stats.puzzleRating}
          </span>
          <span className="small muted">{t('home.puzzlesSolved', { count: stats.puzzlesSolved })}</span>
        </section>
      </div>

      <div className="grid cols-2">
        <section className="card">
          <h2>{t('home.challenges')}</h2>
          <ul className="list">
            {challenges.map((c) => {
              const progress = challengeProgress(c, counters);
              const done = completed.includes(c.id);
              return (
                <li key={c.id}>
                  <div className="spread small">
                    <span>
                      {done ? '✅ ' : ''}
                      {t(`challenges.${c.counter}`, { count: c.target })}
                    </span>
                    <span className="muted">+{c.xp} XP</span>
                  </div>
                  <div className="progress">
                    <span style={{ width: `${progress * 100}%` }} />
                  </div>
                </li>
              );
            })}
          </ul>
        </section>

        <section className="card">
          <h2>{t('home.recommended')}</h2>
          <p className="small muted">{t('home.recommendedHelp')}</p>
          <ul className="list">
            {recommendations.map((r) => (
              <li key={r.theme} className="spread">
                <span>
                  <strong>{t(`themes.${r.theme}`)}</strong>
                  <br />
                  <span className="small muted">
                    {t(`reasons.${r.reason}`, {
                      rate: r.successRate === null ? '' : Math.round(r.successRate * 100),
                    })}
                  </span>
                </span>
                <Link className="btn small" to={`/tactics?theme=${r.theme}`}>
                  {t('home.train')}
                </Link>
              </li>
            ))}
          </ul>
          {personal > 0 && (
            <Link className="btn" to="/tactics?mode=mine" style={{ marginTop: 12 }}>
              {t('home.reviewMistakes', { count: personal })}
            </Link>
          )}
        </section>
      </div>

      <section className="grid cols-3" style={{ marginTop: 16 }}>
        {[
          { to: '/analysis', key: 'analysis' },
          { to: '/openings', key: 'openings' },
          { to: '/endgames', key: 'endgames' },
          { to: '/lessons', key: 'lessons' },
          { to: '/online', key: 'online' },
          { to: '/progress', key: 'progress' },
        ].map((item) => (
          <Link key={item.to} to={item.to} className="card" style={{ textDecoration: 'none', color: 'inherit' }}>
            <h3>{t(`nav.${item.key}`)}</h3>
            <p className="small muted">{t(`home.cards.${item.key}`)}</p>
          </Link>
        ))}
      </section>
    </>
  );
}
