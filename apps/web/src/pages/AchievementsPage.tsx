import { BADGES, levelFromXp, rankTitle } from '@ia-ajedrez/core';
import { useTranslation } from 'react-i18next';
import { useProgress } from '../store/progress';

const ICONS: Record<string, string> = {
  puzzle: '🧩',
  chart: '📈',
  trophy: '🏆',
  robot: '🤖',
  target: '🎯',
  flame: '🔥',
  book: '📚',
  king: '♔',
  search: '🔍',
  users: '👥',
  calendar: '📅',
};

export default function AchievementsPage() {
  const { t, i18n } = useTranslation();
  const earned = useProgress((s) => s.badges);
  const xp = useProgress((s) => s.stats.xp);
  const level = levelFromXp(xp);
  const count = Object.keys(earned).length;

  return (
    <>
      <div className="page-header">
        <div>
          <h1>{t('achievements.title')}</h1>
          <p>{t('achievements.subtitle', { count, total: BADGES.length })}</p>
        </div>
        <span className="chip">
          {t('home.level')} {level.level} · {t(`ranks.${rankTitle(level.level)}`)} · {xp} XP
        </span>
      </div>
      <div className="badge-grid">
        {BADGES.map((b) => {
          const date = earned[b.id];
          return (
            <div
              key={b.id}
              className={`card badge tier-${b.tier}${date ? '' : ' locked'}`}
              data-testid={`badge-${b.id}`}
              data-earned={!!date}
            >
              <div className="badge-icon" aria-hidden="true">
                {ICONS[b.icon] ?? '⭐'}
              </div>
              <strong>{t(`badges.${b.id}.name`)}</strong>
              <p className="small muted" style={{ margin: '4px 0 0' }}>
                {t(`badges.${b.id}.desc`)}
              </p>
              <p className="small" style={{ margin: '4px 0 0' }}>
                {date
                  ? t('achievements.earnedOn', {
                      date: new Date(date).toLocaleDateString(i18n.language),
                    })
                  : t('achievements.locked')}
              </p>
            </div>
          );
        })}
      </div>
    </>
  );
}
