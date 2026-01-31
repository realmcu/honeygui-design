import React, { useState } from 'react';
import { useDesignerStore } from '../store';
import { Users, Wifi, WifiOff, Play, Square, UserPlus, LogOut } from 'lucide-react';
import { t } from '../i18n';
import './CollaborationPanel.css';

const CollaborationPanel: React.FC = () => {
  const {
    collaborationRole,
    collaborationStatus,
    collaborationHostAddress,
    collaborationHostPort,
    collaborationPeerCount,
    collaborationError,
    startHost,
    stopHost,
    joinSession,
    leaveSession,
  } = useDesignerStore();

  const [hostPort, setHostPort] = useState<string>('3000');
  const [joinAddress, setJoinAddress] = useState<string>('');

  const isDisconnected = collaborationStatus === 'disconnected';
  const isConnecting = collaborationStatus === 'connecting';
  const isHosting = collaborationRole === 'host' && collaborationStatus === 'hosting';
  const isConnected = collaborationRole === 'guest' && collaborationStatus === 'connected';

  const handleStartHost = () => {
    const port = parseInt(hostPort, 10);
    if (isNaN(port) || port < 1024 || port > 65535) {
      return;
    }
    startHost(port);
  };

  const handleStopHost = () => {
    stopHost();
  };

  const handleJoinSession = () => {
    if (!joinAddress.trim()) {
      return;
    }
    joinSession(joinAddress.trim());
  };

  const handleLeaveSession = () => {
    leaveSession();
  };

  const getStatusText = () => {
    switch (collaborationStatus) {
      case 'disconnected':
        return t('Disconnected');
      case 'connecting':
        return t('Connecting...');
      case 'connected':
        return t('Connected');
      case 'hosting':
        return t('Hosting');
      default:
        return t('Unknown');
    }
  };

  const getStatusIcon = () => {
    if (isHosting || isConnected) {
      return <Wifi className="status-icon connected" size={16} />;
    }
    if (isConnecting) {
      return <Wifi className="status-icon connecting" size={16} />;
    }
    return <WifiOff className="status-icon disconnected" size={16} />;
  };

  return (
    <div className="collaboration-panel">
      <div className="collaboration-header">
        <Users size={16} />
        <span>{t('Collaboration')}</span>
      </div>

      {/* 状态显示 */}
      <div className="collaboration-status">
        {getStatusIcon()}
        <span className="status-text">{getStatusText()}</span>
        {isHosting && (
          <span className="peer-count">
            ({collaborationPeerCount} {t('connected')})
          </span>
        )}
      </div>

      {/* 错误信息 */}
      {collaborationError && (
        <div className="collaboration-error">
          {collaborationError}
        </div>
      )}

      {/* 主机模式 */}
      {isDisconnected && (
        <div className="collaboration-section">
          <div className="section-title">{t('Host Mode')}</div>
          <div className="input-row">
            <label>{t('Port')}:</label>
            <input
              type="number"
              value={hostPort}
              onChange={(e) => setHostPort(e.target.value)}
              min="1024"
              max="65535"
              placeholder="3000"
            />
          </div>
          <button
            className="collaboration-btn primary"
            onClick={handleStartHost}
            disabled={isConnecting}
          >
            <Play size={14} />
            {t('Start Host')}
          </button>
        </div>
      )}

      {/* 主机运行中 */}
      {isHosting && (
        <div className="collaboration-section">
          <div className="section-title">{t('Host Running')}</div>
          <div className="host-info">
            <span className="host-address">{collaborationHostAddress}</span>
          </div>
          <button
            className="collaboration-btn danger"
            onClick={handleStopHost}
          >
            <Square size={14} />
            {t('Stop Host')}
          </button>
        </div>
      )}

      {/* 访客模式 */}
      {isDisconnected && (
        <div className="collaboration-section">
          <div className="section-title">{t('Join Session')}</div>
          <div className="input-row">
            <label>{t('Address')}:</label>
            <input
              type="text"
              value={joinAddress}
              onChange={(e) => setJoinAddress(e.target.value)}
              placeholder="192.168.1.100:3000"
            />
          </div>
          <button
            className="collaboration-btn secondary"
            onClick={handleJoinSession}
            disabled={isConnecting || !joinAddress.trim()}
          >
            <UserPlus size={14} />
            {t('Connect')}
          </button>
        </div>
      )}

      {/* 已连接为访客 */}
      {isConnected && (
        <div className="collaboration-section">
          <div className="section-title">{t('Connected to Host')}</div>
          <div className="host-info">
            <span className="host-address">{collaborationHostAddress}</span>
          </div>
          <button
            className="collaboration-btn danger"
            onClick={handleLeaveSession}
          >
            <LogOut size={14} />
            {t('Disconnect')}
          </button>
        </div>
      )}

      {/* 连接中状态 */}
      {isConnecting && (
        <div className="collaboration-section">
          <div className="connecting-hint">
            {t('Connecting...')}
          </div>
        </div>
      )}
    </div>
  );
};

export default CollaborationPanel;
