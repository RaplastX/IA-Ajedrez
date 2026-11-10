import { lazy, Suspense, useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { NavLink, Route, Routes, useLocation } from 'react-router';
import { ConsentBanner, Toasts } from './components/common';
import { Celebration, Splash, useAppearance } from './components/effects';
import { api } from './lib/api';
import { HomePage } from './pages/HomePage';
import { pickData, useProgress } from './store/progress';
import { useSettings } from './store/settings';

// Las páginas pesadas se cargan bajo demanda para que el primer render sea rápido en móvil.
const PlayPage = lazy(() => import('./pages/PlayPage'));
const AnalysisPage = lazy(() => import('./pages/AnalysisPage'));
const TacticsPage = lazy(() => import('./pages/TacticsPage'));
const OpeningsPage = lazy(() => import('./pages/OpeningsPage'));
const EndgamesPage = lazy(() => import('./pages/EndgamesPage'));
const LessonsPage = lazy(() => import('./pages/LessonsPage'));
const ProgressPage = lazy(() => import('./pages/ProgressPage'));
const AchievementsPage = lazy(() => import('./pages/AchievementsPage'));
const LeaderboardPage = lazy(() => import('./pages/LeaderboardPage'));
const MultiplayerPage = lazy(() => import('./pages/MultiplayerPage'));
const SettingsPage = lazy(() => import('./pages/SettingsPage'));

const NAV = [
  { to: '/', key: 'home', icon: '⌂' },
  { to: '/play', key: 'play', icon: '♟' },
  { to: '/tactics', key: 'tactics', icon: '⚡' },
  { to: '/analysis', key: 'analysis', icon: '🔍' },
  { to: '/openings', key: 'openings', icon: '📖' },
  { to: '/endgames', key: 'endgames', icon: '♔' },
  { to: '/lessons', key: 'lessons', icon: '🎓' },
  { to: '/online', key: 'online', icon: '👥' },
  { to: '/progress', key: 'progress', icon: '📈' },
  { to: '/achievements', key: 'achievements', icon: '🏅' },
  { to: '/leaderboard', key: 'leaderboard', icon: '🏆' },
  { to: '/settings', key: 'settings', icon: '⚙' },
] as const;

/** Sincroniza el progreso local con la API cuando hay sesión (con retardo para agrupar cambios). */
function useServerSync() {
  const token = useSettings((s) => s.token);
  const updatedAt = useProgress((s) => s.updatedAt);
  const firstLoad = useRef(true);

  useEffect(() => {
    if (!token) return;
    // Al iniciar sesión: si el servidor tiene datos más recientes, se importan.
    api
      .getProgress()
      .then(({ data, updatedAt: remoteUpdated }) => {
        const local = useProgress.getState().updatedAt;
        if (data && remoteUpdated && remoteUpdated > local)
          useProgress.getState().importSnapshot(data);
      })
      .catch(() => undefined);
  }, [token]);

  useEffect(() => {
    if (!token) return;
    if (firstLoad.current) {
      firstLoad.current = false;
      return;
    }
    const timer = setTimeout(() => {
      api.putProgress(pickData(useProgress.getState())).catch(() => undefined);
    }, 3000);
    return () => clearTimeout(timer);
  }, [token, updatedAt]);
}

export function App() {
  const { t } = useTranslation();
  useServerSync();
  useAppearance();
  const location = useLocation();
  return (
    <div className="app">
      <a href="#main" className="sr-only">
        {t('nav.skip')}
      </a>
      <aside className="sidebar">
        <NavLink to="/" className="brand" aria-label="IA Ajedrez">
          <img src="/icon-192.png" alt="" />
          <span>IA Ajedrez</span>
        </NavLink>
        <nav className="nav" aria-label={t('nav.label')}>
          {NAV.map((item) => (
            <NavLink key={item.to} to={item.to} end={item.to === '/'}>
              <span className="nav-icon" aria-hidden="true">
                {item.icon}
              </span>
              {t(`nav.${item.key}`)}
            </NavLink>
          ))}
        </nav>
      </aside>
      <main id="main" className="main">
        <Suspense fallback={<p className="muted">{t('common.loading')}</p>}>
          <div className="page" key={location.pathname}>
            <Routes>
              <Route path="/" element={<HomePage />} />
              <Route path="/play" element={<PlayPage />} />
              <Route path="/analysis" element={<AnalysisPage />} />
              <Route path="/tactics" element={<TacticsPage />} />
              <Route path="/openings" element={<OpeningsPage />} />
              <Route path="/endgames" element={<EndgamesPage />} />
              <Route path="/lessons" element={<LessonsPage />} />
              <Route path="/online" element={<MultiplayerPage />} />
              <Route path="/progress" element={<ProgressPage />} />
              <Route path="/achievements" element={<AchievementsPage />} />
              <Route path="/leaderboard" element={<LeaderboardPage />} />
              <Route path="/settings" element={<SettingsPage />} />
              <Route path="*" element={<p>{t('common.notFound')}</p>} />
            </Routes>
          </div>
        </Suspense>
      </main>
      <Toasts />
      <ConsentBanner />
      <Celebration />
      <Splash />
    </div>
  );
}
