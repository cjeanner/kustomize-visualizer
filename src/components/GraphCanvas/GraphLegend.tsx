import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import './GraphLegend.css';

export const GraphLegend: React.FC = () => {
  const { t } = useTranslation();
  const [isOpen, setIsOpen] = useState(false);

  return (
    <div className={`graph-legend ${isOpen ? 'open' : 'closed'}`}>
      <button 
        className="legend-toggle"
        onClick={() => setIsOpen(!isOpen)}
        title={t('sidebar.legendTitle')}
      >
        {isOpen ? '✕' : 'ℹ️'}
      </button>
      
      {isOpen && (
        <div className="legend-content">
          <h3>{t('sidebar.legendTitle')}</h3>
          <div className="legend-items">
            <div className="legend-item">
              <div className="legend-shape ellipse base"></div>
              <span>{t('sidebar.legendBase')}</span>
            </div>
            <div className="legend-item">
              <div className="legend-shape rectangle overlay"></div>
              <span>{t('sidebar.legendOverlay')}</span>
            </div>
            <div className="legend-item">
              <div className="legend-shape roundrect component"></div>
              <span>{t('sidebar.legendComponent')}</span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
