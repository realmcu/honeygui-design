import React, { useState } from 'react';
import { PropertyEditor } from './PropertyEditor';
import { t } from '../../i18n';
import { TimerConfig, TimerAction, AnimationSegment } from '../../../hml/types';
import { SWITCH_OUT_STYLES, SWITCH_IN_STYLES } from '../../../hml/eventTypes';
import { useDesignerStore } from '../../store';

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
  
  const components = useDesignerStore((state) => state.components);
  const allViews = useDesignerStore((state) => state.allViews || []);

  // 获取可用的视图列表
  const getAvailableViews = () => {
    const currentViews = components
      .filter(c => c.type === 'hg_view' && c.id !== componentId)
      .map(c => ({
        id: c.id,
        name: c.name || c.id,
        file: '当前文件'
      }));
    
    const currentViewIds = new Set(currentViews.map(v => v.id));
    const otherViews = allViews.filter(v => !currentViewIds.has(v.id));
    
    return [...currentViews, ...otherViews];
  };

  // 添加新定时动画
  const handleAddTimer = () => {
    const timerIndex = timers.length;
    const newTimer: TimerConfig = {
      id: `timer_${timerIndex}`,
      name: `${t('Animation')} ${timerIndex + 1}`,
      enabled: timers.length === 0,
      interval: 1000,
      reload: true,
      mode: 'custom',
      callback: `${componentId}_timer_${timerIndex}_cb`,
      duration: 1000,
      stopOnComplete: true,
      delayStart: 0,
      actions: [],
      segments: [],
    };
    onUpdate([...timers, newTimer]);
    setExpandedTimerId(newTimer.id);
  };

  // 删除定时动画
  const handleDeleteTimer = (timerId: string) => {
    const newTimers = timers.filter(t => t.id !== timerId);
    // 重新索引所有定时动画的 ID，确保 ID 连续且不重复
    const reindexedTimers = newTimers.map((timer, index) => ({
      ...timer,
      id: `timer_${index}`,
      callback: timer.mode === 'custom' ? `${componentId}_timer_${index}_cb` : timer.callback,
    }));
    onUpdate(reindexedTimers);
    if (expandedTimerId === timerId && reindexedTimers.length > 0) {
      setExpandedTimerId(reindexedTimers[0].id);
    }
  };

  // 更新定时动画
  const handleUpdateTimer = (timerId: string, updates: Partial<TimerConfig>) => {
    const newTimers = timers.map(t => {
      if (t.id === timerId) {
        if (updates.enabled === true) {
          return { ...t, ...updates };
        }
        return { ...t, ...updates };
      } else if (updates.enabled === true) {
        return { ...t, enabled: false };
      }
      return t;
    });
    onUpdate(newTimers);
  };

  // 切换定时动画展开/折叠
  const toggleExpand = (timerId: string) => {
    setExpandedTimerId(expandedTimerId === timerId ? null : timerId);
  };

  return (
    <div className="property-group">
      <div className="property-item">
        <label>{t('Animations')}</label>
        
        {/* 定时动画列表 */}
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
            {/* 定时动画头部 */}
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
                <span style={{ fontSize: '11px', opacity: 0.7, whiteSpace: 'nowrap' }}>
                  {t('Bind on component creation')}
                </span>
                <input
                  type="text"
                  value={timer.name || ''}
                  onChange={(e) => {
                    e.stopPropagation();
                    handleUpdateTimer(timer.id, { name: e.target.value });
                  }}
                  onClick={(e) => e.stopPropagation()}
                  placeholder={t('Animation Name')}
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

            {/* 定时动画详细配置 */}
            {expandedTimerId === timer.id && (
              <div style={{ marginTop: '12px', paddingTop: '12px', borderTop: '1px solid var(--vscode-panel-border)' }}>
                {/* 基本配置 */}
                <div style={{ marginBottom: '8px' }}>
                  <label style={{ fontSize: '11px', display: 'block', marginBottom: '4px' }}>
                    {t('Animation Interval (ms)')}
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
                    <span style={{ fontSize: '12px' }}>{t('Repeat animation')}</span>
                  </div>
                </div>

                <div style={{ marginBottom: '8px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <PropertyEditor
                      type="boolean"
                      value={timer.runImmediately || false}
                      onChange={(value) => handleUpdateTimer(timer.id, { runImmediately: value })}
                    />
                    <span style={{ fontSize: '12px' }}>{t('Run immediately')}</span>
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
                      onClick={() => {
                        // 切换到预设模式时，恢复之前保存的预设数据
                        const updates: Partial<TimerConfig> = { mode: 'preset' };
                        if (timer.segmentsBackup && timer.segmentsBackup.length > 0) {
                          updates.segments = timer.segmentsBackup;
                        } else if (!timer.segments || timer.segments.length === 0) {
                          updates.segments = [];
                        }
                        handleUpdateTimer(timer.id, updates);
                      }}
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
                      onClick={() => {
                        // 切换到自定义模式时，备份当前的预设数据
                        const updates: Partial<TimerConfig> = {
                          mode: 'custom',
                          callback: timer.callback || `${componentId}_timer_cb`,
                        };
                        // 如果当前有预设数据，备份它
                        if (timer.segments && timer.segments.length > 0) {
                          updates.segmentsBackup = timer.segments;
                        }
                        handleUpdateTimer(timer.id, updates);
                      }}
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
                      getAvailableViews={getAvailableViews}
                    />
                  )}

                  {/* 自定义函数模式 */}
                  {timer.mode === 'custom' && (
                    <div style={{ marginTop: '8px' }}>
                      <label style={{ fontSize: '11px', display: 'block', marginBottom: '4px' }}>
                        {t('Animation Callback')}
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

        {/* 添加定时动画按钮 */}
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
          + {t('Add Animation')}
        </button>
      </div>
    </div>
  );
};

// 预设动作模式组件（支持多段动画）
const TimerPresetMode: React.FC<{
  timer: TimerConfig;
  componentType: string;
  onUpdate: (updates: Partial<TimerConfig>) => void;
  getAvailableViews: () => Array<{ id: string; name: string; file: string }>;
}> = ({ timer, componentType, onUpdate, getAvailableViews }) => {
  const segments = timer.segments || [];
  const [expandedSegmentIndex, setExpandedSegmentIndex] = useState<number | null>(
    segments.length > 0 ? 0 : null
  );
  
  // 获取当前组件的所有定时动画（从父组件传递）
  const componentId = useDesignerStore((state) => state.selectedComponent);
  const components = useDesignerStore((state) => state.components);
  const currentComponent = components.find(c => c.id === componentId);
  const allTimers = currentComponent?.data?.timers || [];

  const handleAddSegment = () => {
    const newSegment: AnimationSegment = {
      duration: 1000,
      actions: [],
    };
    onUpdate({ segments: [...segments, newSegment] });
    setExpandedSegmentIndex(segments.length);
  };

  const handleUpdateSegment = (index: number, updates: Partial<AnimationSegment>) => {
    const newSegments = [...segments];
    newSegments[index] = { ...newSegments[index], ...updates };
    onUpdate({ segments: newSegments });
  };

  const handleDeleteSegment = (index: number) => {
    const newSegments = segments.filter((_, i) => i !== index);
    onUpdate({ segments: newSegments });
    if (expandedSegmentIndex === index && newSegments.length > 0) {
      setExpandedSegmentIndex(0);
    } else if (expandedSegmentIndex !== null && expandedSegmentIndex > index) {
      setExpandedSegmentIndex(expandedSegmentIndex - 1);
    }
  };

  // 拖拽相关状态
  const [draggedSegmentIndex, setDraggedSegmentIndex] = React.useState<number | null>(null);
  const [dragOverSegmentIndex, setDragOverSegmentIndex] = React.useState<number | null>(null);

  // 处理拖拽开始
  const handleDragStart = (e: React.DragEvent, index: number) => {
    setDraggedSegmentIndex(index);
    e.dataTransfer.effectAllowed = 'move';
  };

  // 处理拖拽经过
  const handleDragOver = (e: React.DragEvent, index: number) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    if (draggedSegmentIndex !== null && draggedSegmentIndex !== index) {
      setDragOverSegmentIndex(index);
    }
  };

  // 处理拖拽离开
  const handleDragLeave = () => {
    setDragOverSegmentIndex(null);
  };

  // 处理放置
  const handleDrop = (e: React.DragEvent, dropIndex: number) => {
    e.preventDefault();
    if (draggedSegmentIndex === null || draggedSegmentIndex === dropIndex) {
      setDraggedSegmentIndex(null);
      setDragOverSegmentIndex(null);
      return;
    }

    // 重新排列动画段
    const newSegments = [...segments];
    const [draggedSegment] = newSegments.splice(draggedSegmentIndex, 1);
    newSegments.splice(dropIndex, 0, draggedSegment);
    
    onUpdate({ segments: newSegments });

    // 更新展开状态
    if (expandedSegmentIndex === draggedSegmentIndex) {
      setExpandedSegmentIndex(dropIndex);
    } else if (expandedSegmentIndex !== null) {
      if (draggedSegmentIndex < expandedSegmentIndex && dropIndex >= expandedSegmentIndex) {
        setExpandedSegmentIndex(expandedSegmentIndex - 1);
      } else if (draggedSegmentIndex > expandedSegmentIndex && dropIndex <= expandedSegmentIndex) {
        setExpandedSegmentIndex(expandedSegmentIndex + 1);
      }
    }

    setDraggedSegmentIndex(null);
    setDragOverSegmentIndex(null);
  };

  // 处理拖拽结束
  const handleDragEnd = () => {
    setDraggedSegmentIndex(null);
    setDragOverSegmentIndex(null);
  };

  const handleAddAction = (segmentIndex: number) => {
    const segment = segments[segmentIndex];
    let newAction: TimerAction;
    if (componentType === 'hg_window') {
      newAction = { type: 'size', fromW: 0, fromH: 0, toW: 0, toH: 0 };
    } else if (componentType === 'hg_image') {
      newAction = { type: 'opacity', from: 255, to: 128 };
    } else {
      newAction = { type: 'position', fromX: 0, fromY: 0, toX: 0, toY: 0 };
    }
    handleUpdateSegment(segmentIndex, { actions: [...segment.actions, newAction] });
  };

  const handleUpdateAction = (segmentIndex: number, actionIndex: number, updates: Partial<TimerAction>) => {
    const segment = segments[segmentIndex];
    const newActions = [...segment.actions];
    newActions[actionIndex] = { ...newActions[actionIndex], ...updates };
    handleUpdateSegment(segmentIndex, { actions: newActions });
  };

  const handleDeleteAction = (segmentIndex: number, actionIndex: number) => {
    const segment = segments[segmentIndex];
    handleUpdateSegment(segmentIndex, { actions: segment.actions.filter((_, i) => i !== actionIndex) });
  };

  // 计算总时间
  const totalDuration = segments.reduce((sum, seg) => sum + seg.duration, 0);

  return (
    <div style={{ marginTop: '8px' }}>
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

      {/* 总时间显示 */}
      {segments.length > 0 && (
        <div style={{ marginBottom: '12px', padding: '6px', background: 'var(--vscode-editor-background)', borderRadius: '4px' }}>
          <span style={{ fontSize: '11px', opacity: 0.8 }}>
            {t('Total Duration')}: {totalDuration} ms
          </span>
        </div>
      )}

      {/* 动画段列表 */}
      {segments.map((segment, segmentIndex) => (
        <div
          key={segmentIndex}
          onDragOver={(e) => handleDragOver(e, segmentIndex)}
          onDragLeave={handleDragLeave}
          onDrop={(e) => handleDrop(e, segmentIndex)}
          style={{
            marginBottom: '8px',
            padding: '8px',
            background: 'var(--vscode-input-background)',
            borderRadius: '4px',
            border: dragOverSegmentIndex === segmentIndex 
              ? '2px dashed var(--vscode-focusBorder)' 
              : '1px solid var(--vscode-input-border)',
            opacity: draggedSegmentIndex === segmentIndex ? 0.5 : 1,
            transition: 'border 0.2s, opacity 0.2s',
          }}
        >
          {/* 段头部 */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
            <div
              style={{ display: 'flex', alignItems: 'center', gap: '8px', flex: 1 }}
            >
              <span 
                draggable
                onDragStart={(e) => handleDragStart(e, segmentIndex)}
                onDragEnd={handleDragEnd}
                style={{ 
                  fontSize: '14px', 
                  opacity: 0.6, 
                  cursor: 'grab',
                  padding: '2px 4px',
                  userSelect: 'none',
                }} 
                title={t('Drag to reorder')}
              >
                ⋮⋮
              </span>
              <span 
                style={{ fontSize: '11px', fontWeight: 'bold', cursor: 'pointer' }}
                onClick={() => setExpandedSegmentIndex(expandedSegmentIndex === segmentIndex ? null : segmentIndex)}
              >
                {t('Segment')} {segmentIndex + 1}
              </span>
              <span 
                style={{ fontSize: '10px', opacity: 0.7, cursor: 'pointer' }}
                onClick={() => setExpandedSegmentIndex(expandedSegmentIndex === segmentIndex ? null : segmentIndex)}
              >
                ({segment.duration}ms, {segment.actions.length} {t('actions')})
              </span>
              <span 
                style={{ fontSize: '12px', opacity: 0.7, cursor: 'pointer' }}
                onClick={() => setExpandedSegmentIndex(expandedSegmentIndex === segmentIndex ? null : segmentIndex)}
              >
                {expandedSegmentIndex === segmentIndex ? '▼' : '▶'}
              </span>
            </div>
            <button
              onClick={(e) => {
                e.stopPropagation();
                handleDeleteSegment(segmentIndex);
              }}
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

          {/* 段详细配置 */}
          {expandedSegmentIndex === segmentIndex && (
            <div style={{ marginTop: '8px', paddingTop: '8px', borderTop: '1px solid var(--vscode-panel-border)' }}>
              {/* 持续时间 */}
              <div style={{ marginBottom: '8px' }}>
                <label style={{ fontSize: '10px', display: 'block', marginBottom: '4px' }}>
                  {t('Duration (ms)')}
                </label>
                <input
                  type="number"
                  value={segment.duration}
                  onChange={(e) => handleUpdateSegment(segmentIndex, { duration: Number(e.target.value) })}
                  style={{
                    width: '100%',
                    padding: '4px 8px',
                    backgroundColor: 'var(--vscode-input-background)',
                    color: 'var(--vscode-input-foreground)',
                    border: '1px solid var(--vscode-input-border)',
                    borderRadius: '2px',
                    fontSize: '11px',
                  }}
                />
              </div>

              {/* 动作列表 */}
              {segment.actions.map((action, actionIndex) => (
                <div
                  key={actionIndex}
                  style={{
                    marginBottom: '8px',
                    padding: '6px',
                    background: 'var(--vscode-editor-background)',
                    borderRadius: '4px',
                    border: '1px solid var(--vscode-panel-border)',
                  }}
                >
                  <TimerActionEditor
                    action={action}
                    componentType={componentType}
                    onUpdate={(updates) => handleUpdateAction(segmentIndex, actionIndex, updates)}
                    onDelete={() => handleDeleteAction(segmentIndex, actionIndex)}
                    availableViews={getAvailableViews()}
                    availableTimers={allTimers}
                    currentTimerId={timer.id}
                  />
                </div>
              ))}

              {/* 添加动作按钮 */}
              <button
                onClick={() => handleAddAction(segmentIndex)}
                style={{
                  width: '100%',
                  padding: '4px 8px',
                  background: 'var(--vscode-button-secondaryBackground)',
                  color: 'var(--vscode-button-secondaryForeground)',
                  border: 'none',
                  borderRadius: '2px',
                  cursor: 'pointer',
                  fontSize: '10px',
                }}
              >
                + {t('Add Action')}
              </button>
            </div>
          )}
        </div>
      ))}

      {/* 添加动画段按钮 */}
      <button
        onClick={handleAddSegment}
        style={{
          width: '100%',
          padding: '4px 8px',
          background: 'var(--vscode-button-background)',
          color: 'var(--vscode-button-foreground)',
          border: 'none',
          borderRadius: '2px',
          cursor: 'pointer',
          fontSize: '11px',
        }}
      >
        + {t('Add Segment')}
      </button>
    </div>
  );
};

// 动作编辑器组件
const TimerActionEditor: React.FC<{
  action: TimerAction;
  componentType: string;
  onUpdate: (updates: Partial<TimerAction>) => void;
  onDelete: () => void;
  availableViews: Array<{ id: string; name: string; file: string }>;
  availableTimers: TimerConfig[];
  currentTimerId: string;
}> = ({ action, componentType, onUpdate, onDelete, availableViews, availableTimers, currentTimerId }) => {
  const components = useDesignerStore((state) => state.components);
  
  // 获取除当前定时器外的其他定时器
  const otherTimers = availableTimers.filter(t => t.id !== currentTimerId);

  return (
    <>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
        <select
          value={action.type}
          onChange={(e) => {
            const newType = e.target.value as 'size' | 'position' | 'opacity' | 'rotation' | 'scale' | 'switchView' | 'changeImage' | 'imageSequence' | 'visibility' | 'switchTimer';
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
            } else if (newType === 'opacity') {
              newAction.from = 255;
              newAction.to = 128;
            } else if (newType === 'rotation') {
              newAction.angleOrigin = 0;
              newAction.angleTarget = 360;
            } else if (newType === 'scale') {
              newAction.zoomXOrigin = 1.0;
              newAction.zoomXTarget = 2.0;
              newAction.zoomYOrigin = 1.0;
              newAction.zoomYTarget = 2.0;
            } else if (newType === 'switchView') {
              newAction.target = '';
              newAction.switchOutStyle = 'SWITCH_OUT_TO_LEFT_USE_TRANSLATION';
              newAction.switchInStyle = 'SWITCH_IN_FROM_RIGHT_USE_TRANSLATION';
            } else if (newType === 'changeImage') {
              newAction.imagePath = '';
            } else if (newType === 'imageSequence') {
              newAction.imageSequence = [];
            } else if (newType === 'visibility') {
              newAction.visible = true;
            } else if (newType === 'switchTimer') {
              newAction.timerId = '';
            }
            onUpdate(newAction);
          }}
          style={{
            padding: '4px 8px',
            backgroundColor: 'var(--vscode-input-background)',
            color: 'var(--vscode-input-foreground)',
            border: '1px solid var(--vscode-input-border)',
            borderRadius: '2px',
            fontSize: '10px',
          }}
        >
          {componentType === 'hg_window' && <option value="size">{t('Adjust Size')}</option>}
          <option value="position">{t('Adjust Position')}</option>
          <option value="opacity">{t('Adjust Opacity')}</option>
          {componentType === 'hg_image' && <option value="rotation">{t('Adjust Rotation')}</option>}
          {componentType === 'hg_image' && <option value="scale">{t('Adjust Scale')}</option>}
          {componentType === 'hg_image' && <option value="changeImage">{t('Change Image')}</option>}
          {componentType === 'hg_image' && <option value="imageSequence">{t('Image Sequence')}</option>}
          <option value="switchView">{t('Switch View')}</option>
          <option value="switchTimer">{t('Switch Timer')}</option>
          <option value="visibility">{t('Set Visibility')}</option>
        </select>
        <button
          onClick={onDelete}
          style={{
            padding: '2px 8px',
            background: 'var(--vscode-button-secondaryBackground)',
            color: 'var(--vscode-button-secondaryForeground)',
            border: 'none',
            borderRadius: '2px',
            cursor: 'pointer',
            fontSize: '9px',
          }}
        >
          {t('Remove')}
        </button>
      </div>

      {/* 动作参数 */}
      {action.type === 'visibility' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
          <div>
            <label style={{ fontSize: '10px', display: 'block', marginBottom: '2px' }}>{t('Visibility')}</label>
            <select
              value={action.visible ? 'true' : 'false'}
              onChange={(e) => onUpdate({ visible: e.target.value === 'true' })}
              style={{
                width: '100%',
                padding: '3px',
                backgroundColor: 'var(--vscode-input-background)',
                color: 'var(--vscode-input-foreground)',
                border: '1px solid var(--vscode-input-border)',
                borderRadius: '2px',
                fontSize: '11px',
              }}
            >
              <option value="true">{t('Show')}</option>
              <option value="false">{t('Hide')}</option>
            </select>
          </div>
        </div>
      )}

      {action.type === 'changeImage' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
          <div>
            <label style={{ fontSize: '10px', display: 'block', marginBottom: '2px' }}>{t('Image Path')}</label>
            <div style={{ display: 'flex', gap: '4px' }}>
              <input
                type="text"
                value={action.imagePath || ''}
                onChange={(e) => onUpdate({ imagePath: e.target.value })}
                placeholder="assets/image.bin"
                style={{
                  flex: 1,
                  padding: '3px',
                  backgroundColor: 'var(--vscode-input-background)',
                  color: 'var(--vscode-input-foreground)',
                  border: '1px solid var(--vscode-input-border)',
                  borderRadius: '2px',
                  fontSize: '11px',
                }}
              />
              <button
                onClick={() => {
                  // 生成临时回调 ID
                  const callbackId = `timer_image_${Date.now()}`;
                  
                  // 注册一次性消息监听器来接收保存后的路径
                  const messageHandler = (event: MessageEvent) => {
                    const message = event.data;
                    if (message.command === 'imageSaved' && message.callbackId === callbackId) {
                      // 更新动作的图片路径
                      onUpdate({ imagePath: message.path });
                      // 移除监听器
                      window.removeEventListener('message', messageHandler);
                    }
                  };
                  window.addEventListener('message', messageHandler);
                  
                  // 使用后端的 selectImagePath 命令，让后端处理路径检测和复制
                  window.vscodeAPI?.postMessage({
                    command: 'selectImagePath',
                    callbackId: callbackId
                  });
                }}
                style={{
                  padding: '3px 8px',
                  backgroundColor: 'var(--vscode-button-background)',
                  color: 'var(--vscode-button-foreground)',
                  border: 'none',
                  borderRadius: '2px',
                  cursor: 'pointer',
                  fontSize: '11px'
                }}
                title={t('Select Image File')}
              >
                📁
              </button>
            </div>
          </div>
        </div>
      )}

      {action.type === 'imageSequence' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
          <div>
            <label style={{ fontSize: '10px', display: 'block', marginBottom: '2px' }}>{t('Image Sequence')}</label>
            
            {/* 文件夹选择按钮 */}
            <div style={{ marginBottom: '8px' }}>
              <button
                onClick={() => {
                  const callbackId = `timer_folder_${Date.now()}`;
                  const messageHandler = (event: MessageEvent) => {
                    const message = event.data;
                    if (message.command === 'folderImagesSelected' && message.callbackId === callbackId) {
                      // 更新图片序列
                      onUpdate({ imageSequence: message.paths });
                      window.removeEventListener('message', messageHandler);
                    }
                  };
                  window.addEventListener('message', messageHandler);
                  window.vscodeAPI?.postMessage({
                    command: 'selectFolderImages',
                    callbackId: callbackId
                  });
                }}
                style={{
                  width: '100%',
                  padding: '6px 12px',
                  backgroundColor: 'var(--vscode-button-background)',
                  color: 'var(--vscode-button-foreground)',
                  border: 'none',
                  borderRadius: '2px',
                  cursor: 'pointer',
                  fontSize: '11px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '6px'
                }}
              >
                📁 {t('Select Folder')}
              </button>
            </div>
            
            {(action.imageSequence || []).map((imgPath, idx) => (
              <div key={idx} style={{ display: 'flex', gap: '4px', marginBottom: '4px' }}>
                <span style={{ fontSize: '10px', minWidth: '20px', opacity: 0.7 }}>{idx + 1}.</span>
                <input
                  type="text"
                  value={imgPath}
                  onChange={(e) => {
                    const newSeq = [...(action.imageSequence || [])];
                    newSeq[idx] = e.target.value;
                    onUpdate({ imageSequence: newSeq });
                  }}
                  placeholder="assets/image.bin"
                  style={{
                    flex: 1,
                    padding: '3px',
                    backgroundColor: 'var(--vscode-input-background)',
                    color: 'var(--vscode-input-foreground)',
                    border: '1px solid var(--vscode-input-border)',
                    borderRadius: '2px',
                    fontSize: '11px',
                  }}
                />
                <button
                  onClick={() => {
                    const callbackId = `timer_seq_${Date.now()}_${idx}`;
                    const messageHandler = (event: MessageEvent) => {
                      const message = event.data;
                      if (message.command === 'imageSaved' && message.callbackId === callbackId) {
                        const newSeq = [...(action.imageSequence || [])];
                        newSeq[idx] = message.path;
                        onUpdate({ imageSequence: newSeq });
                        window.removeEventListener('message', messageHandler);
                      }
                    };
                    window.addEventListener('message', messageHandler);
                    window.vscodeAPI?.postMessage({
                      command: 'selectImagePath',
                      callbackId: callbackId
                    });
                  }}
                  style={{
                    padding: '3px 8px',
                    backgroundColor: 'var(--vscode-button-background)',
                    color: 'var(--vscode-button-foreground)',
                    border: 'none',
                    borderRadius: '2px',
                    cursor: 'pointer',
                    fontSize: '11px'
                  }}
                  title={t('Select Image File')}
                >
                  📁
                </button>
                <button
                  onClick={() => {
                    const newSeq = (action.imageSequence || []).filter((_, i) => i !== idx);
                    onUpdate({ imageSequence: newSeq });
                  }}
                  style={{
                    padding: '3px 8px',
                    backgroundColor: 'var(--vscode-button-secondaryBackground)',
                    color: 'var(--vscode-button-secondaryForeground)',
                    border: 'none',
                    borderRadius: '2px',
                    cursor: 'pointer',
                    fontSize: '11px'
                  }}
                  title={t('Remove')}
                >
                  ✕
                </button>
              </div>
            ))}
            <button
              onClick={() => {
                const newSeq = [...(action.imageSequence || []), ''];
                onUpdate({ imageSequence: newSeq });
              }}
              style={{
                width: '100%',
                padding: '4px 8px',
                backgroundColor: 'var(--vscode-button-secondaryBackground)',
                color: 'var(--vscode-button-secondaryForeground)',
                border: 'none',
                borderRadius: '2px',
                cursor: 'pointer',
                fontSize: '10px',
                marginTop: '4px'
              }}
            >
              + {t('Add Image')}
            </button>
          </div>
        </div>
      )}

      {action.type === 'switchView' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
          <div>
            <label style={{ fontSize: '10px', display: 'block', marginBottom: '2px' }}>{t('Target View')}</label>
            <select
              value={action.target || ''}
              onChange={(e) => onUpdate({ target: e.target.value })}
              style={{
                width: '100%',
                padding: '3px',
                backgroundColor: 'var(--vscode-input-background)',
                color: 'var(--vscode-input-foreground)',
                border: '1px solid var(--vscode-input-border)',
                borderRadius: '2px',
                fontSize: '11px',
              }}
            >
              <option value="">-- {t('Select')} --</option>
              {availableViews.map(v => (
                <option key={v.id} value={v.id}>
                  {v.name} {v.file !== '当前文件' ? `(${v.file})` : ''}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label style={{ fontSize: '10px', display: 'block', marginBottom: '2px' }}>{t('Exit Animation')}</label>
            <select
              value={action.switchOutStyle || 'SWITCH_OUT_TO_LEFT_USE_TRANSLATION'}
              onChange={(e) => onUpdate({ switchOutStyle: e.target.value })}
              style={{
                width: '100%',
                padding: '3px',
                backgroundColor: 'var(--vscode-input-background)',
                color: 'var(--vscode-input-foreground)',
                border: '1px solid var(--vscode-input-border)',
                borderRadius: '2px',
                fontSize: '11px',
              }}
            >
              {SWITCH_OUT_STYLES.map(s => (
                <option key={s.value} value={s.value}>{s.label}</option>
              ))}
            </select>
          </div>
          <div>
            <label style={{ fontSize: '10px', display: 'block', marginBottom: '2px' }}>{t('Enter Animation')}</label>
            <select
              value={action.switchInStyle || 'SWITCH_IN_FROM_RIGHT_USE_TRANSLATION'}
              onChange={(e) => onUpdate({ switchInStyle: e.target.value })}
              style={{
                width: '100%',
                padding: '3px',
                backgroundColor: 'var(--vscode-input-background)',
                color: 'var(--vscode-input-foreground)',
                border: '1px solid var(--vscode-input-border)',
                borderRadius: '2px',
                fontSize: '11px',
              }}
            >
              {SWITCH_IN_STYLES.map(s => (
                <option key={s.value} value={s.value}>{s.label}</option>
              ))}
            </select>
          </div>
        </div>
      )}

      {action.type === 'switchTimer' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
          <div>
            <label style={{ fontSize: '10px', display: 'block', marginBottom: '2px' }}>{t('Target Timer')}</label>
            {otherTimers.length === 0 ? (
              <div style={{ 
                padding: '8px', 
                backgroundColor: 'var(--vscode-inputValidation-warningBackground)',
                border: '1px solid var(--vscode-inputValidation-warningBorder)',
                borderRadius: '2px',
                fontSize: '11px',
                color: 'var(--vscode-inputValidation-warningForeground)'
              }}>
                ⚠️ {t('No other timers available. Please add another timer first.')}
              </div>
            ) : (
              <select
                value={action.timerId || ''}
                onChange={(e) => onUpdate({ timerId: e.target.value })}
                style={{
                  width: '100%',
                  padding: '3px',
                  backgroundColor: 'var(--vscode-input-background)',
                  color: 'var(--vscode-input-foreground)',
                  border: '1px solid var(--vscode-input-border)',
                  borderRadius: '2px',
                  fontSize: '11px',
                }}
              >
                <option value="">-- {t('Select')} --</option>
                {otherTimers.map(t => (
                  <option key={t.id} value={t.id}>
                    {t.name || t.id}
                  </option>
                ))}
              </select>
            )}
          </div>
        </div>
      )}

      {action.type === 'size' && (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '6px' }}>
          <div>
            <label style={{ fontSize: '10px', display: 'block', marginBottom: '2px' }}>{t('From')} W</label>
            <input
              type="number"
              value={action.fromW || 0}
              onChange={(e) => onUpdate({ fromW: Number(e.target.value) })}
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
              onChange={(e) => onUpdate({ toW: Number(e.target.value) })}
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
              onChange={(e) => onUpdate({ fromH: Number(e.target.value) })}
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
              onChange={(e) => onUpdate({ toH: Number(e.target.value) })}
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
              onChange={(e) => onUpdate({ fromX: Number(e.target.value) })}
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
              onChange={(e) => onUpdate({ toX: Number(e.target.value) })}
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
              onChange={(e) => onUpdate({ fromY: Number(e.target.value) })}
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
              onChange={(e) => onUpdate({ toY: Number(e.target.value) })}
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
              onChange={(e) => onUpdate({ from: Number(e.target.value) })}
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
              onChange={(e) => onUpdate({ to: Number(e.target.value) })}
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

      {action.type === 'rotation' && (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '6px' }}>
          <div>
            <label style={{ fontSize: '10px', display: 'block', marginBottom: '2px' }}>{t('From Angle')} (°)</label>
            <input
              type="number"
              value={action.angleOrigin || 0}
              onChange={(e) => onUpdate({ angleOrigin: Number(e.target.value) })}
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
            <label style={{ fontSize: '10px', display: 'block', marginBottom: '2px' }}>{t('To Angle')} (°)</label>
            <input
              type="number"
              value={action.angleTarget || 360}
              onChange={(e) => onUpdate({ angleTarget: Number(e.target.value) })}
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

      {action.type === 'scale' && (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '6px' }}>
          <div>
            <label style={{ fontSize: '10px', display: 'block', marginBottom: '2px' }}>{t('From Scale')} X</label>
            <input
              type="number"
              step="0.1"
              value={action.zoomXOrigin || 1.0}
              onChange={(e) => onUpdate({ zoomXOrigin: Number(e.target.value) })}
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
            <label style={{ fontSize: '10px', display: 'block', marginBottom: '2px' }}>{t('To Scale')} X</label>
            <input
              type="number"
              step="0.1"
              value={action.zoomXTarget || 2.0}
              onChange={(e) => onUpdate({ zoomXTarget: Number(e.target.value) })}
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
            <label style={{ fontSize: '10px', display: 'block', marginBottom: '2px' }}>{t('From Scale')} Y</label>
            <input
              type="number"
              step="0.1"
              value={action.zoomYOrigin || 1.0}
              onChange={(e) => onUpdate({ zoomYOrigin: Number(e.target.value) })}
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
            <label style={{ fontSize: '10px', display: 'block', marginBottom: '2px' }}>{t('To Scale')} Y</label>
            <input
              type="number"
              step="0.1"
              value={action.zoomYTarget || 2.0}
              onChange={(e) => onUpdate({ zoomYTarget: Number(e.target.value) })}
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
    </>
  );
};
