/**
 * 事件面板组件 - Event-Action 配置
 */
import React, { useState } from 'react';
import { Component } from '../../types';
import { useDesignerStore } from '../../store';
import {
  EventConfig,
  Action,
  EventType,
  ActionType,
  getSupportedEvents,
  EVENT_LABELS,
  ACTION_LABELS,
  SWITCH_OUT_STYLES,
  SWITCH_IN_STYLES,
} from '../../../hml/eventTypes';
import './EventsPanel.css';

interface EventsPanelProps {
  component: Component;
  onUpdate: (updates: Partial<Component>) => void;
}

export const EventsPanel: React.FC<EventsPanelProps> = ({ component, onUpdate }) => {
  const [expandedEvents, setExpandedEvents] = useState<Set<number>>(new Set([0]));
  const components = useDesignerStore((state) => state.components);
  const allViews = useDesignerStore((state) => state.allViews || []);

  const eventConfigs = component.eventConfigs || [];
  const supportedEvents = getSupportedEvents(component.type);

  // 获取可用的视图列表（当前文件 + 其他文件）
  const getAvailableViews = () => {
    // 当前文件的 view
    const currentViews = components
      .filter(c => c.type === 'hg_view' && c.id !== component.id)
      .map(c => ({
        id: c.id,
        name: c.name || c.id,
        file: '当前文件'
      }));
    
    // 其他文件的 view（排除当前文件中已有的）
    const currentViewIds = new Set(currentViews.map(v => v.id));
    const otherViews = allViews.filter(v => !currentViewIds.has(v.id));
    
    return [...currentViews, ...otherViews];
  };

  // 添加事件
  const handleAddEvent = () => {
    const usedEvents = new Set(eventConfigs.map(e => e.type));
    const availableEvents = supportedEvents.filter(e => !usedEvents.has(e));
    
    if (availableEvents.length === 0) return;

    const newEvent: EventConfig = {
      type: availableEvents[0],
      actions: [],
    };

    onUpdate({
      eventConfigs: [...eventConfigs, newEvent],
    });
    setExpandedEvents(new Set([...expandedEvents, eventConfigs.length]));
  };

  // 删除事件
  const handleRemoveEvent = (index: number) => {
    onUpdate({
      eventConfigs: eventConfigs.filter((_, i) => i !== index),
    });
  };

  // 更新事件类型
  const handleEventTypeChange = (index: number, type: EventType) => {
    const newConfigs = [...eventConfigs];
    newConfigs[index] = { ...newConfigs[index], type };
    if (type === 'onMessage') {
      newConfigs[index].message = newConfigs[index].message || '';
    }
    onUpdate({ eventConfigs: newConfigs });
  };

  // 更新消息名
  const handleMessageChange = (index: number, message: string) => {
    const newConfigs = [...eventConfigs];
    newConfigs[index] = { ...newConfigs[index], message };
    onUpdate({ eventConfigs: newConfigs });
  };

  // 生成默认回调函数名
  const getDefaultHandler = (eventIndex: number): string => {
    // 计算当前事件在 onMessage 事件中的序号
    let msgIndex = 0;
    for (let i = 0; i < eventIndex; i++) {
      if (eventConfigs[i].type === 'onMessage') {
        msgIndex++;
      }
    }
    return `${component.id}_msg_cb_${msgIndex}`;
  };

  // 验证回调函数名
  const validateHandler = (handler: string, currentIndex: number): string | null => {
    if (!handler) return null;
    // 检查格式：只允许字母、数字、下划线，不能以数字开头
    if (!/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(handler)) {
      return '函数名只能包含字母、数字、下划线，且不能以数字开头';
    }
    // 检查重复：在所有组件中查找
    for (const comp of components) {
      if (!comp.eventConfigs) continue;
      for (let i = 0; i < comp.eventConfigs.length; i++) {
        const ec = comp.eventConfigs[i];
        if (ec.type === 'onMessage' && ec.handler === handler) {
          // 排除当前正在编辑的
          if (comp.id === component.id && i === currentIndex) continue;
          return `函数名 "${handler}" 已被组件 "${comp.id}" 使用`;
        }
      }
    }
    return null;
  };

  // 更新回调函数名
  const [handlerError, setHandlerError] = useState<string | null>(null);
  const handleHandlerChange = (index: number, handler: string) => {
    const error = validateHandler(handler, index);
    setHandlerError(error);
    
    const newConfigs = [...eventConfigs];
    newConfigs[index] = { ...newConfigs[index], handler };
    onUpdate({ eventConfigs: newConfigs });
  };

  // 添加动作
  const handleAddAction = (eventIndex: number) => {
    const currentEvent = eventConfigs[eventIndex];
    const hasSwitchView = currentEvent.actions.some(a => a.type === 'switchView');
    
    // 如果已有 switchView，默认添加 sendMessage，否则添加 switchView
    const newAction: Action = hasSwitchView 
      ? { type: 'sendMessage', message: '' }
      : { type: 'switchView', target: '' };
    
    const newConfigs = [...eventConfigs];
    newConfigs[eventIndex] = {
      ...newConfigs[eventIndex],
      actions: [...newConfigs[eventIndex].actions, newAction],
    };
    onUpdate({ eventConfigs: newConfigs });
  };

  // 删除动作
  const handleRemoveAction = (eventIndex: number, actionIndex: number) => {
    const newConfigs = [...eventConfigs];
    newConfigs[eventIndex] = {
      ...newConfigs[eventIndex],
      actions: newConfigs[eventIndex].actions.filter((_, i) => i !== actionIndex),
    };
    onUpdate({ eventConfigs: newConfigs });
  };

  // 更新动作
  const handleActionUpdate = (eventIndex: number, actionIndex: number, updates: Partial<Action>) => {
    const newConfigs = [...eventConfigs];
    const actions = [...newConfigs[eventIndex].actions];
    actions[actionIndex] = { ...actions[actionIndex], ...updates };
    newConfigs[eventIndex] = { ...newConfigs[eventIndex], actions };
    onUpdate({ eventConfigs: newConfigs });
  };

  // 切换展开/折叠
  const toggleExpand = (index: number) => {
    const newExpanded = new Set(expandedEvents);
    if (newExpanded.has(index)) {
      newExpanded.delete(index);
    } else {
      newExpanded.add(index);
    }
    setExpandedEvents(newExpanded);
  };

  // 渲染动作编辑器
  const renderActionEditor = (action: Action, eventIndex: number, actionIndex: number) => {
    const views = getAvailableViews();
    const eventConfig = eventConfigs[eventIndex];

    return (
      <div className="action-item" key={actionIndex}>
        <div className="action-header">
          <select
            value={action.type}
            onChange={(e) => handleActionUpdate(eventIndex, actionIndex, { type: e.target.value as ActionType })}
            className="action-type-select"
          >
            <option 
              value="switchView" 
              disabled={eventConfig.actions.filter(a => a.type === 'switchView').length > 0 && action.type !== 'switchView'}
            >
              跳转界面
            </option>
            <option value="sendMessage">发送消息</option>
            <option value="callFunction">调用函数</option>
          </select>
          <button
            className="action-remove-btn"
            onClick={() => handleRemoveAction(eventIndex, actionIndex)}
            title="删除动作"
          >
            ×
          </button>
        </div>

        <div className="action-params">
          {/* switchView - 跳转界面 */}
          {action.type === 'switchView' && (
            <>
              <div className="param-row">
                <label>目标界面</label>
                <select
                  value={action.target || ''}
                  onChange={(e) => handleActionUpdate(eventIndex, actionIndex, { target: e.target.value })}
                >
                  <option value="">-- 选择 --</option>
                  {views.map(v => (
                    <option key={v.id} value={v.id}>
                      {v.name} {v.file !== '当前文件' ? `(${v.file})` : ''}
                    </option>
                  ))}
                </select>
              </div>
              <div className="param-row">
                <label>退出动画</label>
                <select
                  value={action.switchOutStyle || 'SWITCH_OUT_TO_LEFT_USE_TRANSLATION'}
                  onChange={(e) => handleActionUpdate(eventIndex, actionIndex, { switchOutStyle: e.target.value })}
                >
                  {SWITCH_OUT_STYLES.map(s => (
                    <option key={s.value} value={s.value}>{s.label}</option>
                  ))}
                </select>
              </div>
              <div className="param-row">
                <label>进入动画</label>
                <select
                  value={action.switchInStyle || 'SWITCH_IN_FROM_RIGHT_USE_TRANSLATION'}
                  onChange={(e) => handleActionUpdate(eventIndex, actionIndex, { switchInStyle: e.target.value })}
                >
                  {SWITCH_IN_STYLES.map(s => (
                    <option key={s.value} value={s.value}>{s.label}</option>
                  ))}
                </select>
              </div>
            </>
          )}

          {/* sendMessage - 发送消息 */}
          {action.type === 'sendMessage' && (
            <div className="param-row">
              <label>消息名</label>
              <input
                type="text"
                value={action.message || ''}
                onChange={(e) => handleActionUpdate(eventIndex, actionIndex, { message: e.target.value })}
                placeholder="如: button_clicked"
              />
            </div>
          )}

          {/* callFunction - 调用函数 */}
          {action.type === 'callFunction' && (
            <div className="param-row">
              <label>函数名</label>
              <input
                type="text"
                value={action.functionName || ''}
                onChange={(e) => handleActionUpdate(eventIndex, actionIndex, { functionName: e.target.value })}
                placeholder="如: on_button_click"
              />
            </div>
          )}
        </div>
      </div>
    );
  };

  return (
    <div className="events-panel">
      {eventConfigs.length === 0 ? (
        <div className="events-empty">暂无事件配置</div>
      ) : (
        eventConfigs.map((event, eventIndex) => (
          <div key={eventIndex} className="event-item">
            <div className="event-header" onClick={() => toggleExpand(eventIndex)}>
              <span className="event-expand-icon">
                {expandedEvents.has(eventIndex) ? '▼' : '▶'}
              </span>
              <select
                value={event.type}
                onChange={(e) => {
                  e.stopPropagation();
                  handleEventTypeChange(eventIndex, e.target.value as EventType);
                }}
                onClick={(e) => e.stopPropagation()}
                className="event-type-select"
              >
                {supportedEvents.map(et => (
                  <option key={et} value={et}>{EVENT_LABELS[et]}</option>
                ))}
              </select>
              <button
                className="event-remove-btn"
                onClick={(e) => {
                  e.stopPropagation();
                  handleRemoveEvent(eventIndex);
                }}
                title="删除事件"
              >
                删除
              </button>
            </div>

            {expandedEvents.has(eventIndex) && (
              <div className="event-content">
                {/* onMessage 需要消息名和回调函数名 */}
                {event.type === 'onMessage' && (
                  <>
                    <div className="message-input">
                      <label>监听消息</label>
                      <input
                        type="text"
                        value={event.message || ''}
                        onChange={(e) => handleMessageChange(eventIndex, e.target.value)}
                        placeholder="消息名称"
                      />
                    </div>
                    <div className="handler-input">
                      <label>回调函数名</label>
                      <input
                        type="text"
                        value={event.handler || getDefaultHandler(eventIndex)}
                        onChange={(e) => handleHandlerChange(eventIndex, e.target.value)}
                        placeholder="回调函数名"
                        className={handlerError ? 'input-error' : ''}
                      />
                      {handlerError && <span className="error-hint">{handlerError}</span>}
                    </div>
                  </>
                )}

                {/* 动作列表 */}
                <div className="actions-list">
                  {event.actions.map((action, actionIndex) =>
                    renderActionEditor(action, eventIndex, actionIndex)
                  )}
                </div>

                <button
                  className="add-action-btn"
                  onClick={() => handleAddAction(eventIndex)}
                  title={event.actions.some(a => a.type === 'switchView') ? '提示：一个事件只能有一个"跳转界面"动作' : '添加动作'}
                >
                  + 添加动作
                </button>
              </div>
            )}
          </div>
        ))
      )}

      <button className="add-event-btn" onClick={handleAddEvent}>
        + 添加事件
      </button>
    </div>
  );
};
