import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { SettingsModal } from '../SettingsModal/SettingsModal';
import { TokenManager } from '../../services/TokenManager';
import './CollapsibleSidebar.css';

interface CollapsibleSidebarProps {
  onLoadRepo: (source: string, isLocal: boolean, githubToken?: string, gitlabToken?: string) => Promise<void>;
}

export const CollapsibleSidebar: React.FC<CollapsibleSidebarProps> = ({ onLoadRepo }) => {
  const { t } = useTranslation();
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [repoUrl, setRepoUrl] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastLoaded, setLastLoaded] = useState<string>('');
  const [showSettings, setShowSettings] = useState(false);

  // Charger les tokens automatiquement
  const [githubToken, setGithubToken] = useState<string | null>(null);
  const [gitlabToken, setGitlabToken] = useState<string | null>(null);

  useEffect(() => {
    loadTokens();
  }, []);

  // Recharger les tokens quand on ferme les settings
  useEffect(() => {
    if (!showSettings) {
      loadTokens();
    }
  }, [showSettings]);

  const loadTokens = async () => {
    const gh = await TokenManager.getGitHubToken();
    const gl = await TokenManager.getGitLabToken();
    setGithubToken(gh);
    setGitlabToken(gl);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!repoUrl.trim()) return;

    setLoading(true);
    setError(null);

    try {
      await onLoadRepo(
        repoUrl,
        false,
        githubToken || undefined,
        gitlabToken || undefined
      );
      setLastLoaded(repoUrl);
    } catch (err) {
      const message = err instanceof Error ? err.message : t('errors.unknownError');
      setError(message);
    } finally {
      setLoading(false);
    }
  };

  const handleLoadLocal = async () => {
    setLoading(true);
    setError(null);

    try {
      await onLoadRepo('', true);
      setLastLoaded(t('sidebar.selectLocal'));
    } catch (err) {
      const message = err instanceof Error ? err.message : t('errors.unknownError');
      setError(message);
    } finally {
      setLoading(false);
    }
  };

  const hasTokens = githubToken || gitlabToken;

  return (
    <>
      <div className={`collapsible-sidebar left ${isCollapsed ? 'collapsed' : ''}`}>
        {!isCollapsed && (
          <div className="sidebar-content">
            <div className="sidebar-header">
              <button
                className="settings-btn"
                onClick={() => setShowSettings(true)}
                title={t('settings.title')}
              >
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <line x1="3" y1="6" x2="21" y2="6"></line>
                  <line x1="3" y1="12" x2="21" y2="12"></line>
                  <line x1="3" y1="18" x2="21" y2="18"></line>
                </svg>
                {hasTokens && <span className="has-settings-dot">●</span>}
              </button>
              <h1>{t('sidebar.title')}</h1>
            </div>

            <form onSubmit={handleSubmit} className="load-form">
              <label htmlFor="repo-url">{t('sidebar.repoUrlLabel')}</label>
              <input
                id="repo-url"
                type="text"
                value={repoUrl}
                onChange={(e) => setRepoUrl(e.target.value)}
                placeholder={t('sidebar.repoUrlPlaceholder')}
                disabled={loading}
              />

              <button type="submit" disabled={loading || !repoUrl.trim()}>
                {loading ? `🔄 ${t('sidebar.loading')}` : `🌐 ${t('sidebar.loadRemote')}`}
              </button>
            </form>

            <div className="separator">
              <span>{t('sidebar.orSeparator')}</span>
            </div>

            <button
              onClick={handleLoadLocal}
              disabled={loading}
              className="load-button local-button"
            >
              {loading ? `🔄 ${t('sidebar.loading')}` : `📁 ${t('sidebar.selectLocal')}`}
            </button>

            {lastLoaded && !error && (
              <div className="success-message">
                ✓ {t('sidebar.loadedSuccess', { source: lastLoaded })}
              </div>
            )}

            {error && (
              <div className="error-message">
                <strong>{t('sidebar.errorPrefix')}</strong> {error}
              </div>
            )}

            <div className="info-section">
              <h3>{t('sidebar.supportedSources')}</h3>
              <ul>
                <li><strong>GitHub</strong></li>
                <li><strong>GitLab</strong></li>
                <li><strong>Local</strong></li>
              </ul>
            </div>
          </div>
        )}

        {/* Toggle collapse - TOUJOURS visible, même quand collapsed */}
        <button
          className="collapse-toggle"
          onClick={() => setIsCollapsed(!isCollapsed)}
          title={isCollapsed ? t('sidebar.expand') : t('sidebar.collapse')}
        >
          {isCollapsed ? '▶' : '◀'}
        </button>
      </div>

      <SettingsModal isOpen={showSettings} onClose={() => setShowSettings(false)} />
    </>
  );
};
