import React, { useState } from 'react';
import { PropertyEditor } from './PropertyEditor';
import { t } from '../../i18n';
import { TimerConfig, TimerAction } from '../../../hml/types';

interface TimerPropertiesProps {
  componentId: string;
  componentType: string;
  timers: TimerConfig[];
  onUpdate: (timers: TimerConfig[]) => void;
}

export const TimerProperties: React.FC<TimerPropertiesProps> = ({
  componentId,
  componentType,
  timers,
  onUpdate,
}) => {
  const [expandedTimerId, setExpandedTimerId] = useState<string | null>(
    timers.length > 0 ? timers[0].id : null
  );

  // 添加新定时器
  const handleAddTimer = () => {
    const newTimer: TimerConfig = {
      id: `timer_${Date.now()}`,
      name: `定时器 ${timers.length + 1}`,
      enabled: timers.length === 0, // 第一个默认启用
      interval: 1000,
      reload: true,
      mode: 'custom',
      callback: `${componentId}_timer_${timers.length + 1}_cb`,
      duration: 1000,
      stopOnComplete: true,
      delayStart: 0,
      actions: [],
    };
    onUpdate([...timers, newTimer]);
    setExpandedTimerId(newTimer.id);
  };

  // 删除定时器
  const handleDeleteTimer = (timerId: string) => {
    const newTimers = timers.filter(t => t.id !== timerId);
    onUpdate(newTimers);
    if (expandedTimerId === timerId && newTimers.length > 0) {
      setExpandedTimerId(newTimers[0].id);
    }
  };

  // 更新定时器
  const handleUpdateTimer = (timerId: string, updates: Partial<TimerConfig>) => {
    const newTimers = timers.map(t => {
      if (t.id === timerId) {
        // 如果启用当前定时器，禁用其他定时器
        if (updates.enabled === true) {
          return { ...t, ...updates };
        }
        return { ...t, ...updates };
      } else if (updates.enabled === true) {
        // 禁用其他定时器
        return { ...t, enabled: false };
      }
      return t;
    });
    onUpdate(newTimers);
  };

  // 切换定时器展开/折叠
  const toggleExpand = (timerId: string) => {
    setExpandedTimerId(expandedTimerId === timerId ? null : timerId);
  };

  return (
    <div className="property-group">
      <div className="property-item">
        <label>{t('Timers')}</label>
        
        {/* 定时器列表 */}
        {timers.map((timer, index) => (
          <div
            key={timer.id}
            style={{
              marginTop: index === 0 ? '8px' : '12px',
              padding: '8px',
              background: 'var(--vscode-editor-background)',
              borderRadius: '4px',
              border: timer.enabled
                ? '2px solid var(--vscode-focusBorder)'
                : '1px solid var(--vscode-panel-border)',
            }}
          >
            {/* 定时器头部 */}
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                cursor: 'pointer',
              }}
              onClick={() => toggleExpand(timer.id)}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flex: 1 }}>
                <input
                  type="checkbox"
                  checked={timer.enabled}
                  onChange={(e) => {
                    e.stopPropagation();
                    handleUpdateTimer(timer.id, { enabled: e.target.checked });
                  }}
                  onClick={(e) => e.stopPropagation()}
                  style={{ cursor: 'pointer' }}
                />
                <input
                  type="text"
                  value={timer.name || ''}
                  onChange={(e) => {
                    e.stopPropagation();
                    handleUpdateTimer(timer.id, { name: e.target.value });
                  }}
                  onClick={(e) => e.stopPropagation()}
                  placeholder={t('Timer Name')}
                  style={{
                    flex: 1,
                    padding: '2px 6px',
                    backgroundColor: 'var(--vscode-input-background)',
                    color: 'var(--vscode-input-foreground)',
                    border: '1px solid var(--vscode-input-border)',
                    borderRadius: '2px',
                    fontSize: '12px',
                  }}
                />
                <span style={{ fontSize: '12px', opacity: 0.7 }}>
                  {expandedTimerId === timer.id ? '▼' : '▶'}
                </span>
              </div>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  handleDeleteTimer(timer.id);
                }}
                style={{
                  padding: '2px 8px',
                  background: 'var(--vscode-button-secondaryBackground)',
                  color: 'var(--vscode-button-secondaryForeground)',
                  border: 'none',
                  borderRadius: '2px',
                  cursor: 'pointer',
                  fontSize: '11px',
                  marginLeft: '8px',
                }}
              >
                {t('Delete')}
              </button>
            </div>

            {/* 定时器详细配置 */}
            {expandedTimerId === timer.id && (
              <div style={{ marginTop: '12px', paddingTop: '12px', borderTop: '1px solid var(--vscode-panel-border)' }}>
                {/* 基本配置 */}
                <div style={{ marginBottom: '8px' }}>
                  <label style={{ fontSize: '11px', display: 'block', marginBottom: '4px' }}>
                    {t('Timer Interval (ms)')}
                  </label>
                  <PropertyEditor
                    type="number"
                    value={timer.interval}
                    onChange={(value) => handleUpdateTimer(timer.id, { interval: value })}
                  />
                </div>

                <div style={{ marginBottom: '8px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <PropertyEditor
                      type="boolean"
                      value={timer.reload}
                      onChange={(value) => handleUpdateTimer(timer.id, { reload: value })}
                    />
                    <span style={{ fontSize: '12px' }}>{t('Repeat timer')}</span>
                  </div>
                </div>

                {/* 模式选择 */}
                <div style={{ marginBottom: '12px' }}>
                  <div
                    style={{
                      display: 'flex',
                      gap: '4px',
                      marginBottom: '8px',
                      borderBottom: '1px solid var(--vscode-panel-border)',
                    }}
                  >
                    <button
                      style={{
                        flex: 1,
                        padding: '4px 8px',
                        background: timer.mode === 'preset' ? 'var(--vscode-editor-background)' : 'transparent',
                        color: 'var(--vscode-foreground)',
                        border: 'none',
                        borderBottom:
                          timer.mode === 'preset'
                            ? '2px solid var(--vscode-focusBorder)'
                            : '2px solid transparent',
                        cursor: 'pointer',
                        fontSize: '11px',
                        opacity: timer.mode === 'preset' ? 1 : 0.7,
                      }}
                      onClick={() => handleUpdateTimer(timer.id, { mode: 'preset', actions: [] })}
                    >
                      {t('Preset Actions')}
                    </button>
                    <button
                      style={{
                        flex: 1,
                        padding: '4px 8px',
                        background: timer.mode === 'custom' ? 'var(--vscode-editor-background)' : 'transparent',
                        color: 'var(--vscode-foreground)',
                        border: 'none',
                        borderBottom:
                          timer.mode === 'custom'
                            ? '2px solid var(--vscode-focusBorder)'
                            : '2px solid transparent',
                        cursor: 'pointer',
                        fontSize: '11px',
                        opacity: timer.mode === 'custom' ? 1 : 0.7,
                      }}
                      onClick={() =>
                        handleUpdateTimer(timer.id, {
                          mode: 'custom',
                          callback: timer.callback || `${componentId}_timer_cb`,
                        })
                      }
                    >
                      {t('Custom Function')}
                    </button>
                  </div>

                  {/* 预设动作模式 */}
                  {timer.mode === 'preset' && (
                    <TimerPresetMode
                      timer={timer}
                      componentType={componentType}
                      onUpdate={(updates) => handleUpdateTimer(timer.id, updates)}
                    />
                  )}

                  {/* 自定义函数模式 */}
                  {timer.mode === 'custom' && (
                    <div style={{ marginTop: '8px' }}>
                      <label style={{ fontSize: '11px', display: 'block', marginBottom: '4px' }}>
                        {t('Timer Callback')}
                      </label>
                      <input
                        type="text"
                        value={timer.callback || ''}
                        onChange={(e) => handleUpdateTimer(timer.id, { callback: e.target.value })}
                        placeholder={`${componentId}_timer_cb`}
                        style={{
                          width: '100%',
                          padding: '4px 8px',
                          backgroundColor: 'var(--vscode-input-background)',
                          color: 'var(--vscode-input-foreground)',
                          border: '1px solid var(--vscode-input-border)',
                          borderRadius: '2px',
                          fontFamily: 'monospace',
                          fontSize: '12px',
                        }}
                      />
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        ))}

        {/* 添加定时器按钮 */}
        <button
          onClick={handleAddTimer}
          style={{
            width: '100%',
            marginTop: '8px',
            padding: '6px 12px',
            background: 'var(--vscode-button-background)',
            color: 'var(--vscode-button-foreground)',
            border: 'none',
            borderRadius: '2px',
            cursor: 'pointer',
            fontSize: '12px',
          }}
        >
          + {t('Add Timer')}
        </button>
      </div>
    </div>
  );
};

// 预设动作模式组件
const TimerPresetMode: React.FC<{
  timer: TimerConfig;
  componentType: string;
  onUpdate: (updates: Partial<TimerConfig>) => void;
}> = ({ timer, componentType, onUpdate }) => {
  const actions = timer.actions || [];

  const handleAddAction = () => {
    let newAction: TimerAction;
    if (componentType === 'hg_window') {
      newAction = { type: 'size', fromW: 0, fromH: 0, toW: 0, toH: 0 };
    } else if (componentType === 'hg_image') {
      newAction = { type: 'opacity', from: 255, to: 128 };
    } else {
      newAction = { type: 'position', fromX: 0, fromY: 0, toX: 0, toY: 0 };
    }
    onUpdate({ actions: [...actions, newAction] });
  };

  const handleUpdateAction = (index: number, updates: Partial<TimerAction>) => {
    const newActions = [...actions];
    newActions[index] = { ...newActions[index], ...updates };
    onUpdate({ actions: newActions });
  };

  const handleDeleteAction = (index: number) => {
    onUpdate({ actions: actions.filter((_, i) => i !== index) });
  };

  return (
    <div style={{ marginTop: '8px' }}>
      {/* 总时间 */}
      <div style={{ marginBottom: '8px' }}>
        <label style={{ fontSize: '11px', display: 'block', marginBottom: '4px' }}>
          {t('Total Duration (ms)')}
        </label>
        <PropertyEditor
          type="number"
          value={timer.duration || 1000}
          onChange={(value) => onUpdate({ duration: value })}
        />
      </div>

      {/* 延时启动 */}
      <div style={{ marginBottom: '8px' }}>
        <label style={{ fontSize: '11px', display: 'block', marginBottom: '4px' }}>
          {t('Delay Start (ms)')}
        </label>
        <PropertyEditor
          type="number"
          value={timer.delayStart || 0}
          onChange={(value) => onUpdate({ delayStart: value })}
        />
      </div>

      {/* 停止选项 */}
      <div style={{ marginBottom: '12px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <PropertyEditor
            type="boolean"
            value={timer.stopOnComplete !== false}
            onChange={(value) => onUpdate({ stopOnComplete: value })}
          />
          <span style={{ fontSize: '12px' }}>{t('Stop on Complete')}</span>
        </div>
      </div>

      {/* 动作列表 */}
      {actions.map((action, index) => (
        <div
          key={index}
          style={{
            marginBottom: '8px',
            padding: '8px',
            background: 'var(--vscode-input-background)',
            borderRadius: '4px',
            border: '1px solid var(--vscode-input-border)',
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
            <select
              value={action.type}
              onChange={(e) => {
                const newType = e.target.value as 'size' | 'position' | 'opacity';
                const newAction: TimerAction = { type: newType };
                if (newType === 'size') {
                  newAction.fromW = 0;
                  newAction.fromH = 0;
                  newAction.toW = 0;
                  newAction.toH = 0;
                } else if (newType === 'position') {
                  newAction.fromX = 0;
                  newAction.fromY = 0;
                  newAction.toX = 0;
                  newAction.toY = 0;
                } else {
                  newAction.from = 255;
                  newAction.to = 128;
                }
                handleUpdateAction(index, newAction);
              }}
              style={{
                padding: '4px 8px',
                backgroundColor: 'var(--vscode-input-background)',
                color: 'var(--vscode-input-foreground)',
                border: '1px solid var(--vscode-input-border)',
                borderRadius: '2px',
                fontSize: '11px',
              }}
            >
              {componentType === 'hg_window' && <option value="size">{t('Adjust Size')}</option>}
              <option value="position">{t('Adjust Position')}</option>
              {componentType === 'hg_image' && <option value="opacity">{t('Adjust Opacity')}</option>}
            </select>
            <button
              onClick={() => handleDeleteAction(index)}
              style={{
                padding: '2px 8px',
                background: 'var(--vscode-button-secondaryBackground)',
                color: 'var(--vscode-button-secondaryForeground)',
                border: 'none',
                borderRadius: '2px',
                cursor: 'pointer',
                fontSize: '10px',
              }}
            >
              {t('Remove')}
            </button>
          </div>

          {/* 动作参数 */}
          {action.type === 'size' && (
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '6px' }}>
              <div>
                <label style={{ fontSize: '10px', display: 'block', marginBottom: '2px' }}>{t('From')} W</label>
                <input
                  type="number"
                  value={action.fromW || 0}
                  onChange={(e) => handleUpdateAction(index, { fromW: Number(e.target.value) })}
                  style={{
                    width: '100%',
                    padding: '3px',
                    backgroundColor: 'var(--vscode-input-background)',
                    color: 'var(--vscode-input-foreground)',
                    border: '1px solid var(--vscode-input-border)',
                    borderRadius: '2px',
                    fontSize: '11px',
                  }}
                />
              </div>
              <div>
                <label style={{ fontSize: '10px', display: 'block', marginBottom: '2px' }}>{t('To')} W</label>
                <input
                  type="number"
                  value={action.toW || 0}
                  onChange={(e) => handleUpdateAction(index, { toW: Number(e.target.value) })}
                  style={{
                    width: '100%',
                    padding: '3px',
                    backgroundColor: 'var(--vscode-input-background)',
                    color: 'var(--vscode-input-foreground)',
                    border: '1px solid var(--vscode-input-border)',
                    borderRadius: '2px',
                    fontSize: '11px',
                  }}
                />
              </div>
              <div>
                <label style={{ fontSize: '10px', display: 'block', marginBottom: '2px' }}>{t('From')} H</label>
                <input
                  type="number"
                  value={action.fromH || 0}
                  onChange={(e) => handleUpdateAction(index, { fromH: Number(e.target.value) })}
                  style={{
                    width: '100%',
                    padding: '3px',
                    backgroundColor: 'var(--vscode-input-background)',
                    color: 'var(--vscode-input-foreground)',
                    border: '1px solid var(--vscode-input-border)',
                    borderRadius: '2px',
                    fontSize: '11px',
                  }}
                />
              </div>
              <div>
                <label style={{ fontSize: '10px', display: 'block', marginBottom: '2px' }}>{t('To')} H</label>
                <input
                  type="number"
                  value={action.toH || 0}
                  onChange={(e) => handleUpdateAction(index, { toH: Number(e.target.value) })}
                  style={{
                    width: '100%',
                    padding: '3px',
                    backgroundColor: 'var(--vscode-input-background)',
                    color: 'var(--vscode-input-foreground)',
                    border: '1px solid var(--vscode-input-border)',
                    borderRadius: '2px',
                    fontSize: '11px',
                  }}
                />
              </div>
            </div>
          )}

          {action.type === 'position' && (
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '6px' }}>
              <div>
                <label style={{ fontSize: '10px', display: 'block', marginBottom: '2px' }}>{t('From')} X</label>
                <input
                  type="number"
                  value={action.fromX || 0}
                  onChange={(e) => handleUpdateAction(index, { fromX: Number(e.target.value) })}
                  style={{
                    width: '100%',
                    padding: '3px',
                    backgroundColor: 'var(--vscode-input-background)',
                    color: 'var(--vscode-input-foreground)',
                    border: '1px solid var(--vscode-input-border)',
                    borderRadius: '2px',
                    fontSize: '11px',
                  }}
                />
              </div>
              <div>
                <label style={{ fontSize: '10px', display: 'block', marginBottom: '2px' }}>{t('To')} X</label>
                <input
                  type="number"
                  value={action.toX || 0}
                  onChange={(e) => handleUpdateAction(index, { toX: Number(e.target.value) })}
                  style={{
                    width: '100%',
                    padding: '3px',
                    backgroundColor: 'var(--vscode-input-background)',
                    color: 'var(--vscode-input-foreground)',
                    border: '1px solid var(--vscode-input-border)',
                    borderRadius: '2px',
                    fontSize: '11px',
                  }}
                />
              </div>
              <div>
                <label style={{ fontSize: '10px', display: 'block', marginBottom: '2px' }}>{t('From')} Y</label>
                <input
                  type="number"
                  value={action.fromY || 0}
                  onChange={(e) => handleUpdateAction(index, { fromY: Number(e.target.value) })}
                  style={{
                    width: '100%',
                    padding: '3px',
                    backgroundColor: 'var(--vscode-input-background)',
                    color: 'var(--vscode-input-foreground)',
                    border: '1px solid var(--vscode-input-border)',
                    borderRadius: '2px',
                    fontSize: '11px',
                  }}
                />
              </div>
              <div>
                <label style={{ fontSize: '10px', display: 'block', marginBottom: '2px' }}>{t('To')} Y</label>
                <input
                  type="number"
                  value={action.toY || 0}
                  onChange={(e) => handleUpdateAction(index, { toY: Number(e.target.value) })}
                  style={{
                    width: '100%',
                    padding: '3px',
                    backgroundColor: 'var(--vscode-input-background)',
                    color: 'var(--vscode-input-foreground)',
                    border: '1px solid var(--vscode-input-border)',
                    borderRadius: '2px',
                    fontSize: '11px',
                  }}
                />
              </div>
            </div>
          )}

          {action.type === 'opacity' && (
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '6px' }}>
              <div>
                <label style={{ fontSize: '10px', display: 'block', marginBottom: '2px' }}>{t('From')} (0-255)</label>
                <input
                  type="number"
                  min="0"
                  max="255"
                  value={action.from || 255}
                  onChange={(e) => handleUpdateAction(index, { from: Number(e.target.value) })}
                  style={{
                    width: '100%',
                    padding: '3px',
                    backgroundColor: 'var(--vscode-input-background)',
                    color: 'var(--vscode-input-foreground)',
                    border: '1px solid var(--vscode-input-border)',
                    borderRadius: '2px',
                    fontSize: '11px',
                  }}
                />
              </div>
              <div>
                <label style={{ fontSize: '10px', display: 'block', marginBottom: '2px' }}>{t('To')} (0-255)</label>
                <input
                  type="number"
                  min="0"
                  max="255"
                  value={action.to || 128}
                  onChange={(e) => handleUpdateAction(index, { to: Number(e.target.value) })}
                  style={{
                    width: '100%',
                    padding: '3px',
                    backgroundColor: 'var(--vscode-input-background)',
                    color: 'var(--vscode-input-foreground)',
                    border: '1px solid var(--vscode-input-border)',
                    borderRadius: '2px',
                    fontSize: '11px',
                  }}
                />
              </div>
            </div>
          )}
        </div>
      ))}

      {/* 添加动作按钮 */}
      <button
        onClick={handleAddAction}
        style={{
          width: '100%',
          padding: '4px 8px',
          background: 'var(--vscode-button-secondaryBackground)',
          color: 'var(--vscode-button-secondaryForeground)',
          border: 'none',
          borderRadius: '2px',
          cursor: 'pointer',
          fontSize: '11px',
        }}
      >
        + {t('Add Action')}
      </button>
    </div>
  );
};
