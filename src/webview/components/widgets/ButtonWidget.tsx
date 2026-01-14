import React from 'react';
import { WidgetProps } from './types';
import { useWebviewUri } from '../../hooks/useWebviewUri';

export const ButtonWidget: React.FC<WidgetProps> = ({ component, style, handlers }) => {
  // 检查是否是双态模式
  const toggleMode = component.data?.toggleMode === true;
  const [isOn, setIsOn] = React.useState(component.data?.initialState === 'on');
  
  // 当 initialState 属性变化时同步状态
  React.useEffect(() => {
    setIsOn(component.data?.initialState === 'on');
  }, [component.data?.initialState]);
  
  // 双态模式：根据状态选择图片
  const imageOn = component.data?.imageOn || '';
  const imageOff = component.data?.imageOff || '';
  const currentImage = isOn ? imageOn : imageOff;
  
  // 如果没有设置当前状态的图片，尝试使用另一个状态的图片
  const displayImage = currentImage || (isOn ? imageOff : imageOn);
  const webviewUri = useWebviewUri(toggleMode ? displayImage : '');

  // 双态模式的点击处理
  const handleMouseDown = (e: React.MouseEvent) => {
    if (toggleMode) {
      setIsOn(!isOn);
    }
    // 调用原有的 handlers
    handlers.onMouseDown(e);
  };

  // 双态模式：显示图片按钮
  if (toggleMode) {
    return (
      <div
        key={component.id}
        style={{
          ...style,
          backgroundImage: webviewUri ? `url(${webviewUri})` : undefined,
          backgroundSize: 'contain',
          backgroundRepeat: 'no-repeat',
          backgroundPosition: 'center',
          cursor: 'pointer',
        }}
        {...handlers}
        onMouseDown={handleMouseDown}
        title={`双态按钮 (当前: ${isOn ? '开启' : '关闭'})`}
      >
        {!webviewUri && (
          <div style={{
            width: '100%',
            height: '100%',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            border: '2px dashed #666',
            borderRadius: '4px',
            backgroundColor: 'rgba(128,128,128,0.1)',
            color: '#888',
            fontSize: '12px',
            gap: '4px',
            boxSizing: 'border-box'
          }}>
            <span style={{ fontSize: '24px' }}>🔄</span>
            <span>双态按钮</span>
          </div>
        )}
      </div>
    );
  }

  // 普通模式：显示文本按钮
  return (
    <button
      key={component.id}
      style={style}
      {...handlers}
      disabled={!component.enabled}
    >
      {component.data?.text || component.name}
    </button>
  );
};
