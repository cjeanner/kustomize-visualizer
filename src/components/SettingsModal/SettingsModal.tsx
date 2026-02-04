import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { TokenManager } from '../../services/TokenManager';
import './SettingsModal.css';

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const SettingsModal: React.FC<SettingsModalProps> = ({ isOpen, onClose }) => {
  const { t, i18n } = useTranslation();
  const [githubToken, setGithubToken] = useState('');
  const [gitlabToken, setGitlabToken] = useState('');
  const [hasStoredGithubToken, setHasStoredGithubToken] = useState(false);
  const [hasStoredGitlabToken, setHasStoredGitlabToken] = useState(false);
  const [showGithubToken, setShowGithubToken] = useState(false);
  const [showGitlabToken, setShowGitlabToken] = useState(false);

  // Charger les tokens
  useEffect(() => {
    if (isOpen) {
      loadTokens();
    }
  }, [isOpen]);

  const loadTokens = async () => {
    const gh = await TokenManager.getGitHubToken();
    const gl = await TokenManager.getGitLabToken();
    
    if (gh) {
      setGithubToken(gh);
      setHasStoredGithubToken(true);
    }
    if (gl) {
      setGitlabToken(gl);
      setHasStoredGitlabToken(true);
    }
  };

  const handleSaveGithubToken = async () => {
    try {
      await TokenManager.saveGitHubToken(githubToken);
      setHasStoredGithubToken(githubToken.trim() !== '');
    } catch (err) {
      console.error('Error saving GitHub token');
    }
  };

  const handleSaveGitlabToken = async () => {
    try {
      await TokenManager.saveGitLabToken(gitlabToken);
      setHasStoredGitlabToken(gitlabToken.trim() !== '');
    } catch (err) {
      console.error('Error saving GitLab token');
    }
  };

  const handleClearGithubToken = () => {
    TokenManager.clearGitHubToken();
    setGithubToken('');
    setHasStoredGithubToken(false);
  };

  const handleClearGitlabToken = () => {
    TokenManager.clearGitLabToken();
    setGitlabToken('');
    setHasStoredGitlabToken(false);
  };

  const changeLanguage = (lng: string) => {
    i18n.changeLanguage(lng);
  };

  if (!isOpen) return null;

  return (
    <div className="settings-modal-overlay" onClick={onClose}>
      <div className="settings-modal" onClick={(e) => e.stopPropagation()}>
        <div className="settings-header">
          <h2>⚙️ {t('settings.title')}</h2>
          <button className="close-btn" onClick={onClose}>✕</button>
        </div>

        <div className="settings-content">
          {/* Section Langue */}
          <section className="settings-section">
            <h3>🌍 {t('settings.language.title')}</h3>
            <div className="language-selector">
              <button
                className={`lang-btn ${i18n.language === 'en' ? 'active' : ''}`}
                onClick={() => changeLanguage('en')}
              >
                English
              </button>
              <button
                className={`lang-btn ${i18n.language === 'fr' ? 'active' : ''}`}
                onClick={() => changeLanguage('fr')}
              >
                Français
              </button>
            </div>
          </section>

          {/* Section Tokens */}
          <section className="settings-section">
            <h3>🔑 {t('settings.tokens.title')}</h3>
            <p className="section-description">{t('settings.tokens.description')}</p>

            {/* GitHub Token */}
            <div className="token-item">
              <div className="token-header">
                <label>
                  GitHub
                  {hasStoredGithubToken && <span className="status-dot">●</span>}
                </label>
                <a 
                  href="https://github.com/settings/tokens" 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="help-icon"
                  title={t('settings.tokens.howToGet')}
                >
                  ❓
                </a>
              </div>
              <div className="token-input-wrapper">
                <input
                  type={showGithubToken ? 'text' : 'password'}
                  value={githubToken}
                  onChange={(e) => setGithubToken(e.target.value)}
                  placeholder="ghp_..."
                  className={hasStoredGithubToken ? 'has-token' : ''}
                />
                <button
                  type="button"
                  className="toggle-visibility"
                  onClick={() => setShowGithubToken(!showGithubToken)}
                  title={showGithubToken ? t('settings.tokens.hide') : t('settings.tokens.show')}
                >
                  {showGithubToken ? '👁️' : '👁️‍🗨️'}
                </button>
              </div>
              <div className="token-actions">
                <button
                  onClick={handleSaveGithubToken}
                  disabled={!githubToken.trim()}
                  className="btn-save"
                >
                  💾 {t('settings.tokens.save')}
                </button>
                {hasStoredGithubToken && (
                  <button onClick={handleClearGithubToken} className="btn-clear">
                    🗑️ {t('settings.tokens.clear')}
                  </button>
                )}
              </div>
            </div>

            {/* GitLab Token */}
            <div className="token-item">
              <div className="token-header">
                <label>
                  GitLab
                  {hasStoredGitlabToken && <span className="status-dot">●</span>}
                </label>
                <a 
                  href="https://gitlab.com/-/profile/personal_access_tokens" 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="help-icon"
                  title={t('settings.tokens.howToGet')}
                >
                  ❓
                </a>
              </div>
              <div className="token-input-wrapper">
                <input
                  type={showGitlabToken ? 'text' : 'password'}
                  value={gitlabToken}
                  onChange={(e) => setGitlabToken(e.target.value)}
                  placeholder="glpat-..."
                  className={hasStoredGitlabToken ? 'has-token' : ''}
                />
                <button
                  type="button"
                  className="toggle-visibility"
                  onClick={() => setShowGitlabToken(!showGitlabToken)}
                  title={showGitlabToken ? t('settings.tokens.hide') : t('settings.tokens.show')}
                >
                  {showGitlabToken ? '👁️' : '👁️‍🗨️'}
                </button>
              </div>
              <div className="token-actions">
                <button
                  onClick={handleSaveGitlabToken}
                  disabled={!gitlabToken.trim()}
                  className="btn-save"
                >
                  💾 {t('settings.tokens.save')}
                </button>
                {hasStoredGitlabToken && (
                  <button onClick={handleClearGitlabToken} className="btn-clear">
                    🗑️ {t('settings.tokens.clear')}
                  </button>
                )}
              </div>
            </div>

            <div className="token-info">
              <small>
                🔒 {t('settings.tokens.encrypted')}
                <br />
                ⚡ {t('settings.tokens.rateLimits')}
              </small>
            </div>
          </section>
        </div>
      </div>
    </div>
  );
};
