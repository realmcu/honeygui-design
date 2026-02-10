import React from 'react';
import { X, Users } from 'lucide-react';
import { t } from '../i18n';
import CollaborationPanel from './CollaborationPanel';
import './CollaborationModal.css';

interface CollaborationModalProps {
  visible: boolean;
  onClose: () => void;
}

export const CollaborationModal: React.FC<CollaborationModalProps> = ({ visible, onClose }) => {
  if (!visible) return null;

  return (
    <div className="collab-modal-overlay" onClick={onClose}>
      <div className="collab-modal-dialog" onClick={e => e.stopPropagation()}>
        <div className="collab-modal-header">
          <div className="collab-modal-title">
            <Users size={16} />
            <span>{t('Collaboration')}</span>
          </div>
          <button className="collab-modal-close" onClick={onClose} title={t('Close')}>
            <X size={18} />
          </button>
        </div>
        
        <div className="collab-modal-content">
          <CollaborationPanel showHeader={false} />
        </div>
      </div>
    </div>
  );
};
