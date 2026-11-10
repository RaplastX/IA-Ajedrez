import { useState, type FormEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { api, ApiError } from '../lib/api';
import { downloadText } from '../lib/download';
import { pickData, useProgress } from '../store/progress';
import { useSettings, type AppTheme, type BoardTheme, type Language } from '../store/settings';

const LICENSES = [
  {
    name: 'Stockfish 19 (stockfish.js)',
    license: 'GPL-3.0',
    url: 'https://github.com/nmrugg/stockfish.js',
    extra: '/engine/COPYING-stockfish.txt',
  },
  {
    name: 'Piezas Cburnett (Wikimedia Commons)',
    license: 'BSD / GPL / GFDL',
    url: 'https://commons.wikimedia.org/wiki/Category:SVG_chess_pieces',
  },
  { name: 'Lichess puzzle database', license: 'CC0', url: 'https://database.lichess.org/#puzzles' },
  {
    name: 'lichess-org/chess-openings',
    license: 'CC0',
    url: 'https://github.com/lichess-org/chess-openings',
  },
  {
    name: 'Lichess tablebase API (Syzygy)',
    license: 'API pública',
    url: 'https://tablebase.lichess.ovh',
  },
  { name: 'chess.js', license: 'BSD-2-Clause', url: 'https://github.com/jhlywa/chess.js' },
  { name: 'React, React Router, i18next, Zustand', license: 'MIT', url: 'https://react.dev' },
];

export default function SettingsPage() {
  const { t, i18n } = useTranslation();
  const settings = useSettings();
  const resetProgress = useProgress((s) => s.reset);
  const [mode, setMode] = useState<'login' | 'register'>('login');
  const [form, setForm] = useState({
    email: '',
    password: '',
    displayName: '',
    acceptTerms: false,
  });
  const [status, setStatus] = useState<{ kind: 'good' | 'bad'; text: string } | null>(null);

  async function submit(e: FormEvent) {
    e.preventDefault();
    setStatus(null);
    try {
      const session =
        mode === 'login'
          ? await api.login({ email: form.email, password: form.password })
          : await api.register({ ...form, locale: i18n.language });
      settings.setSession(session.token, session.user);
      setStatus({
        kind: 'good',
        text: t('settings.account.welcome', { name: session.user.displayName }),
      });
    } catch (err) {
      const code = err instanceof ApiError ? err.code : 'unknown';
      setStatus({
        kind: 'bad',
        text: t(`settings.account.errors.${code}`, {
          defaultValue: t('settings.account.errors.unknown'),
        }),
      });
    }
  }

  async function exportData() {
    const local = pickData(useProgress.getState());
    let remote: unknown = null;
    if (settings.token) remote = await api.exportData().catch(() => null);
    downloadText(
      'ia-ajedrez-mis-datos.json',
      JSON.stringify({ exportedAt: new Date().toISOString(), local, remote }, null, 2),
      'application/json',
    );
  }

  async function deleteEverything() {
    if (!window.confirm(t('settings.privacy.confirmDelete'))) return;
    if (settings.token && !settings.user?.isGuest) await api.deleteAccount().catch(() => undefined);
    resetProgress();
    settings.setSession(null, null);
    setStatus({ kind: 'good', text: t('settings.privacy.deleted') });
  }

  async function goPremium() {
    try {
      const { url } = await api.checkout();
      window.location.assign(url);
    } catch (err) {
      const code = err instanceof ApiError ? err.code : 'unknown';
      setStatus({
        kind: 'bad',
        text: t(`settings.premium.errors.${code === 'payments_disabled' ? code : 'unknown'}`),
      });
    }
  }

  return (
    <>
      <div className="page-header">
        <div>
          <h1>{t('settings.title')}</h1>
        </div>
      </div>
      <div className="grid cols-2">
        <section className="card">
          <h2>{t('settings.preferences')}</h2>
          <div className="panel">
            <label className="field">
              <span>{t('settings.language')}</span>
              <select
                value={settings.language}
                onChange={(e) => settings.setLanguage(e.target.value as Language)}
                data-testid="language-select"
              >
                <option value="es">Español</option>
                <option value="en">English</option>
              </select>
            </label>
            <label className="field">
              <span>{t('settings.boardTheme')}</span>
              <select
                value={settings.boardTheme}
                onChange={(e) => settings.setBoardTheme(e.target.value as BoardTheme)}
              >
                {(['midnight', 'ebony', 'green', 'brown', 'blue'] as const).map((th) => (
                  <option key={th} value={th}>
                    {t(`settings.themes.${th}`)}
                  </option>
                ))}
              </select>
            </label>
            <label className="row">
              <input
                type="checkbox"
                checked={settings.showCoordinates}
                onChange={(e) => settings.setShowCoordinates(e.target.checked)}
              />
              <span>{t('settings.coordinates')}</span>
            </label>
            <label className="field">
              <span>{t('settings.appTheme')}</span>
              <select
                value={settings.appTheme}
                onChange={(e) => settings.setAppTheme(e.target.value as AppTheme)}
                data-testid="app-theme-select"
              >
                {(['dark', 'light', 'system'] as const).map((th) => (
                  <option key={th} value={th}>
                    {t(`settings.appThemes.${th}`)}
                  </option>
                ))}
              </select>
            </label>
            <label className="row">
              <input
                type="checkbox"
                checked={settings.sound}
                onChange={(e) => settings.setSound(e.target.checked)}
              />
              <span>{t('settings.sound')}</span>
            </label>
            <label className="row">
              <input
                type="checkbox"
                checked={settings.effects}
                onChange={(e) => settings.setEffects(e.target.checked)}
              />
              <span>{t('settings.effects')}</span>
            </label>
          </div>
        </section>

        <section className="card">
          <h2>{t('settings.account.title')}</h2>
          {settings.user ? (
            <div className="panel">
              <p>
                {t('settings.account.signedIn', { name: settings.user.displayName })}
                {settings.user.isGuest && ` (${t('settings.account.guest')})`}
                {settings.user.isPremium && ' · ⭐ Premium'}
              </p>
              <button type="button" className="btn" onClick={() => settings.setSession(null, null)}>
                {t('settings.account.logout')}
              </button>
            </div>
          ) : (
            <form className="panel" onSubmit={(e) => void submit(e)}>
              <div className="row" role="tablist">
                {(['login', 'register'] as const).map((m) => (
                  <button
                    key={m}
                    type="button"
                    className="chip"
                    aria-pressed={mode === m}
                    onClick={() => setMode(m)}
                  >
                    {t(`settings.account.${m}`)}
                  </button>
                ))}
              </div>
              {mode === 'register' && (
                <label className="field">
                  <span>{t('settings.account.displayName')}</span>
                  <input
                    type="text"
                    required
                    minLength={3}
                    maxLength={24}
                    value={form.displayName}
                    onChange={(e) => setForm({ ...form, displayName: e.target.value })}
                  />
                </label>
              )}
              <label className="field">
                <span>{t('settings.account.email')}</span>
                <input
                  type="email"
                  required
                  autoComplete="email"
                  value={form.email}
                  onChange={(e) => setForm({ ...form, email: e.target.value })}
                />
              </label>
              <label className="field">
                <span>{t('settings.account.password')}</span>
                <input
                  type="password"
                  required
                  minLength={8}
                  autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
                  value={form.password}
                  onChange={(e) => setForm({ ...form, password: e.target.value })}
                />
              </label>
              {mode === 'register' && (
                <label className="row small">
                  <input
                    type="checkbox"
                    required
                    checked={form.acceptTerms}
                    onChange={(e) => setForm({ ...form, acceptTerms: e.target.checked })}
                  />
                  <span>{t('settings.account.acceptTerms')}</span>
                </label>
              )}
              <button type="submit" className="btn primary">
                {t(`settings.account.${mode}`)}
              </button>
            </form>
          )}
          {status && (
            <p className={`status ${status.kind}`} role="status" style={{ marginTop: 12 }}>
              {status.text}
            </p>
          )}
        </section>

        <section className="card">
          <h2>⭐ {t('settings.premium.title')}</h2>
          <p className="small muted">{t('settings.premium.body')}</p>
          <button
            type="button"
            className="btn primary"
            disabled={!settings.user || settings.user.isGuest || settings.user.isPremium}
            onClick={() => void goPremium()}
          >
            {settings.user?.isPremium ? t('settings.premium.active') : t('settings.premium.cta')}
          </button>
        </section>

        <section className="card">
          <h2>{t('settings.privacy.title')}</h2>
          <p className="small muted">{t('settings.privacy.body')}</p>
          <label className="row" style={{ marginBottom: 12 }}>
            <input
              type="checkbox"
              checked={settings.analyticsConsent === 'granted'}
              onChange={(e) =>
                settings.setAnalyticsConsent(e.target.checked ? 'granted' : 'denied')
              }
            />
            <span>{t('settings.privacy.analytics')}</span>
          </label>
          <div className="row">
            <button type="button" className="btn" onClick={() => void exportData()}>
              {t('settings.privacy.export')}
            </button>
            <button type="button" className="btn danger" onClick={() => void deleteEverything()}>
              {t('settings.privacy.delete')}
            </button>
          </div>
        </section>

        <section className="card" style={{ gridColumn: '1 / -1' }}>
          <h2>{t('settings.licenses.title')}</h2>
          <p className="small muted">{t('settings.licenses.body')}</p>
          <ul className="list small">
            {LICENSES.map((l) => (
              <li key={l.name}>
                <a href={l.url} target="_blank" rel="noreferrer">
                  {l.name}
                </a>{' '}
                — {l.license}
                {l.extra && (
                  <>
                    {' · '}
                    <a href={l.extra}>{t('settings.licenses.text')}</a>
                  </>
                )}
              </li>
            ))}
          </ul>
        </section>
      </div>
    </>
  );
}
