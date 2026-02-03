import React from 'react';
import { useTranslation } from 'react-i18next';
import type { KustomizeNode } from '../../types/kustomize.types';
import './DetailsPanel.css';

interface DetailsPanelProps {
  node: KustomizeNode | null;
}

export const DetailsPanel: React.FC<DetailsPanelProps> = ({ node }) => {
  const { t } = useTranslation();

  if (!node) {
    return (
      <div className="details-panel">
        <div className="no-selection">
          <h2>{t('details.noSelection')}</h2>
          <p>{t('details.selectNodeHint')}</p>
        </div>
      </div>
    );
  }

  const typeLabel = node.type === 'base' ? t('details.typeBase')
    : node.type === 'overlay' ? t('details.typeOverlay')
    : t('details.typeComponent');

  return (
    <div className="details-panel">
      <h2>{t('details.nodeDetails')}</h2>

      <div className="node-info">
        <div className="info-row">
          <strong>{t('details.path')}</strong>
          <span>{node.path}</span>
        </div>

        <div className="info-row">
          <strong>{t('details.type')}</strong>
          <span className={`type-badge type-${node.type}`}>
            {typeLabel}
          </span>
        </div>

        <div className="info-row">
          <strong>{t('details.isRemote')}</strong>
          <span>{node.isRemote ? t('details.yes') : t('details.no')}</span>
        </div>

        {node.remoteUrl && (
          <div className="info-row">
            <strong>{t('details.remoteUrl')}</strong>
            <a href={node.remoteUrl} target="_blank" rel="noopener noreferrer">
              {node.remoteUrl}
            </a>
          </div>
        )}
      </div>

      <h3>{t('details.kustomizationContent')}</h3>

      <div className="kustomization-details">
        {node.kustomizationContent.resources && node.kustomizationContent.resources.length > 0 && (
          <div className="detail-section">
            <h4>{t('details.resources')}</h4>
            <ul>
              {node.kustomizationContent.resources.map((resource, idx) => (
                <li key={idx}><code>{resource}</code></li>
              ))}
            </ul>
          </div>
        )}

        {node.kustomizationContent.bases && node.kustomizationContent.bases.length > 0 && (
          <div className="detail-section">
            <h4>{t('details.bases')}</h4>
            <ul>
              {node.kustomizationContent.bases.map((base, idx) => (
                <li key={idx}><code>{base}</code></li>
              ))}
            </ul>
          </div>
        )}

        {node.kustomizationContent.components && node.kustomizationContent.components.length > 0 && (
          <div className="detail-section">
            <h4>{t('details.components')}</h4>
            <ul>
              {node.kustomizationContent.components.map((component, idx) => (
                <li key={idx}><code>{component}</code></li>
              ))}
            </ul>
          </div>
        )}

        {node.kustomizationContent.patches && node.kustomizationContent.patches.length > 0 && (
          <div className="detail-section">
            <h4>{t('details.patches')}</h4>
            <ul>
              {node.kustomizationContent.patches.map((patch, idx) => (
                <li key={idx}><code>{JSON.stringify(patch)}</code></li>
              ))}
            </ul>
          </div>
        )}

        {!node.kustomizationContent.resources &&
         !node.kustomizationContent.bases &&
         !node.kustomizationContent.components &&
         !node.kustomizationContent.patches && (
          <p className="no-data">{t('details.noData')}</p>
        )}
      </div>
    </div>
  );
};
