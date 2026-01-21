/**
 * Event-Action 系统类型定义
 */

// ============ 事件类型 ============

export type EventType =
  // 通用事件
  | 'onClick'
  | 'onLongPress'
  | 'onTouchDown'
  | 'onTouchUp'
  | 'onKeyShortClick'
  | 'onKeyLongClick'
  // 滑动事件
  | 'onSwipeLeft'
  | 'onSwipeRight'
  | 'onSwipeUp'
  | 'onSwipeDown'
  // 状态事件
  | 'onValueChange'
  | 'onCheckedChange'
  // 生命周期事件
  | 'onShow'
  | 'onHide'
  // 消息事件
  | 'onMessage';

// ============ 动作类型 ============

export type ActionType =
  // 视图切换(跳转界面，带动画)
  | 'switchView'
  // 消息
  | 'sendMessage'
  // 自定义
  | 'callFunction'
  // 控制动画定时器
  | 'controlTimer';

// ============ 动作定义 ============

export interface Action {
  type: ActionType;
  target?: string;           // 目标视图ID (switchView用)
  message?: string;          // 消息名(sendMessage用)
  functionName?: string;     // 函数名(callFunction用)
  // switchView专用
  switchOutStyle?: string;   // 退出动画
  switchInStyle?: string;    // 进入动画
  // controlTimer专用
  timerTargets?: Array<{     // 目标组件列表
    componentId: string;     // 组件ID
    timerIndex?: number;     // 定时器索引（如果有多个定时器）
    action: 'start' | 'stop'; // 每个定时器的动作
  }>;
}

// ============ 事件配置 ============

export interface EventConfig {
  type: EventType;
  message?: string;          // 仅 onMessage 事件需要
  handler?: string;          // 回调函数名（onMessage 用）
  actions: Action[];
  checkReleaseArea?: boolean; // 抬起区域检测（仅 onTouchUp 事件）
}

// ============ 组件支持的事件映射 ============

export const COMPONENT_SUPPORTED_EVENTS: Record<string, EventType[]> = {
  hg_view: ['onClick', 'onLongPress', 'onTouchDown', 'onTouchUp', 'onKeyShortClick', 'onKeyLongClick', 'onSwipeLeft', 'onSwipeRight', 'onSwipeUp', 'onSwipeDown', 'onShow', 'onHide', 'onMessage'],
  hg_window: ['onClick', 'onLongPress', 'onTouchDown', 'onTouchUp', 'onMessage'],
  hg_button: ['onClick', 'onLongPress', 'onTouchDown', 'onTouchUp', 'onMessage'],
  hg_image: ['onClick', 'onLongPress', 'onTouchDown', 'onTouchUp', 'onMessage'],
  hg_text: ['onClick', 'onLongPress', 'onMessage'],
  hg_label: ['onClick', 'onLongPress', 'onMessage'],
  hg_switch: ['onClick', 'onCheckedChange', 'onMessage'],
  hg_checkbox: ['onClick', 'onCheckedChange', 'onMessage'],
  hg_radio: ['onClick', 'onCheckedChange', 'onMessage'],
  hg_slider: ['onClick', 'onValueChange', 'onMessage'],
  hg_progressbar: ['onClick', 'onValueChange', 'onMessage'],
  hg_input: ['onClick', 'onValueChange', 'onMessage'],
  hg_canvas: ['onClick', 'onLongPress', 'onMessage'],
  hg_arc: ['onClick', 'onLongPress', 'onMessage'],
  hg_rect: ['onClick', 'onLongPress', 'onMessage'],
  hg_svg: ['onClick', 'onLongPress', 'onMessage'],
  hg_lottie: ['onClick', 'onLongPress', 'onMessage'],
  hg_video: ['onClick', 'onLongPress', 'onMessage'],
  hg_3d: ['onClick', 'onLongPress', 'onMessage'],
};

// 默认支持的事件(未在映射中的组件)
export const DEFAULT_SUPPORTED_EVENTS: EventType[] = ['onClick', 'onLongPress', 'onMessage'];

// ============ 事件显示名称 ============

export const EVENT_LABELS: Record<EventType, string> = {
  onClick: '单击',
  onLongPress: '长按',
  onTouchDown: '按下',
  onTouchUp: '抬起',
  onKeyShortClick: '键盘短按',
  onKeyLongClick: '键盘长按',
  onSwipeLeft: '左滑',
  onSwipeRight: '右滑',
  onSwipeUp: '上滑',
  onSwipeDown: '下滑',
  onValueChange: '值改变',
  onCheckedChange: '选中改变',
  onShow: '显示',
  onHide: '隐藏',
  onMessage: '消息监听',
};

// ============ 动作显示名称 ============

export const ACTION_LABELS: Record<ActionType, string> = {
  switchView: '跳转界面',
  sendMessage: '发送消息',
  callFunction: '调用函数',
  controlTimer: '自定义动画集',
};

// ============ 视图切换动画选项 ============

export const SWITCH_OUT_STYLES = [
  // 初始状态（无动画）
  { value: 'SWITCH_INIT_STATE', label: '无动画（初始状态）' },
  
  // Translation (平移)
  { value: 'SWITCH_OUT_TO_LEFT_USE_TRANSLATION', label: '向左平移' },
  { value: 'SWITCH_OUT_TO_RIGHT_USE_TRANSLATION', label: '向右平移' },
  { value: 'SWITCH_OUT_TO_TOP_USE_TRANSLATION', label: '向上平移' },
  { value: 'SWITCH_OUT_TO_BOTTOM_USE_TRANSLATION', label: '向下平移' },
  
  // Cube (立方体)
  { value: 'SWITCH_OUT_TO_LEFT_USE_CUBE', label: '向左立方体' },
  { value: 'SWITCH_OUT_TO_RIGHT_USE_CUBE', label: '向右立方体' },
  { value: 'SWITCH_OUT_TO_TOP_USE_CUBE', label: '向上立方体' },
  { value: 'SWITCH_OUT_TO_BOTTOM_USE_CUBE', label: '向下立方体' },
  
  // Rotate (旋转)
  { value: 'SWITCH_OUT_TO_LEFT_USE_ROTATE', label: '向左旋转' },
  { value: 'SWITCH_OUT_TO_RIGHT_USE_ROTATE', label: '向右旋转' },
  { value: 'SWITCH_OUT_TO_TOP_USE_ROTATE', label: '向上旋转' },
  { value: 'SWITCH_OUT_TO_BOTTOM_USE_ROTATE', label: '向下旋转' },
  
  // Reduction (缩小)
  { value: 'SWITCH_OUT_TO_LEFT_USE_REDUCTION', label: '向左缩小' },
  { value: 'SWITCH_OUT_TO_RIGHT_USE_REDUCTION', label: '向右缩小' },
  { value: 'SWITCH_OUT_TO_TOP_USE_REDUCTION', label: '向上缩小' },
  { value: 'SWITCH_OUT_TO_BOTTOM_USE_REDUCTION', label: '向下缩小' },
  
  // Blur (模糊)
  { value: 'SWITCH_OUT_STILL_USE_BLUR', label: '高斯模糊（静止）' },
  
  // Animation (动画)
  { value: 'SWITCH_OUT_NONE_ANIMATION', label: '无动画' },
  { value: 'SWITCH_OUT_ANIMATION_ZOOM', label: '缩放' },
  { value: 'SWITCH_OUT_ANIMATION_FADE', label: '淡出' },
  { value: 'SWITCH_OUT_ANIMATION_MOVE_TO_RIGHT', label: '向右移动' },
  { value: 'SWITCH_OUT_ANIMATION_MOVE_TO_LEFT', label: '向左移动' },
  { value: 'SWITCH_OUT_ANIMATION_ZOOM_TO_TOP_LEFT', label: '缩放到左上角' },
  { value: 'SWITCH_OUT_ANIMATION_ZOOM_TO_TOP_RIGHT', label: '缩放到右上角' },
];

export const SWITCH_IN_STYLES = [
  // 初始状态（无动画）
  { value: 'SWITCH_INIT_STATE', label: '无动画（初始状态）' },
  
  // Translation (平移)
  { value: 'SWITCH_IN_FROM_LEFT_USE_TRANSLATION', label: '从左平移' },
  { value: 'SWITCH_IN_FROM_RIGHT_USE_TRANSLATION', label: '从右平移' },
  { value: 'SWITCH_IN_FROM_TOP_USE_TRANSLATION', label: '从上平移' },
  { value: 'SWITCH_IN_FROM_BOTTOM_USE_TRANSLATION', label: '从下平移' },
  { value: 'SWITCH_IN_FROM_TOP_RIGHT_USE_TRANSLATION', label: '从右上平移' },
  
  // Cube (立方体)
  { value: 'SWITCH_IN_FROM_LEFT_USE_CUBE', label: '从左立方体' },
  { value: 'SWITCH_IN_FROM_RIGHT_USE_CUBE', label: '从右立方体' },
  { value: 'SWITCH_IN_FROM_TOP_USE_CUBE', label: '从上立方体' },
  { value: 'SWITCH_IN_FROM_BOTTOM_USE_CUBE', label: '从下立方体' },
  
  // Rotate (旋转)
  { value: 'SWITCH_IN_FROM_LEFT_USE_ROTATE', label: '从左旋转' },
  { value: 'SWITCH_IN_FROM_RIGHT_USE_ROTATE', label: '从右旋转' },
  { value: 'SWITCH_IN_FROM_TOP_USE_ROTATE', label: '从上旋转' },
  { value: 'SWITCH_IN_FROM_BOTTOM_USE_ROTATE', label: '从下旋转' },
  
  // Reduction (缩小)
  { value: 'SWITCH_IN_FROM_LEFT_USE_REDUCTION', label: '从左缩小' },
  { value: 'SWITCH_IN_FROM_RIGHT_USE_REDUCTION', label: '从右缩小' },
  { value: 'SWITCH_IN_FROM_TOP_USE_REDUCTION', label: '从上缩小' },
  { value: 'SWITCH_IN_FROM_BOTTOM_USE_REDUCTION', label: '从下缩小' },
  
  // Blur (模糊)
  { value: 'SWITCH_IN_STILL_USE_BLUR', label: '高斯模糊（静止）' },
  
  // Animation (动画)
  { value: 'SWITCH_IN_NONE_ANIMATION', label: '无动画' },
  { value: 'SWITCH_IN_ANIMATION_ZOOM', label: '缩放' },
  { value: 'SWITCH_IN_ANIMATION_FADE', label: '淡入' },
  { value: 'SWITCH_IN_ANIMATION_MOVE_FADE', label: '移动淡入' },
  { value: 'SWITCH_IN_ANIMATION_MOVE_FROM_RIGHT', label: '从右移动' },
  { value: 'SWITCH_IN_ANIMATION_MOVE_FROM_LEFT', label: '从左移动' },
  { value: 'SWITCH_IN_ANIMATION_BOUNCE_FROM_RIGHT', label: '从右弹跳' },
  { value: 'SWITCH_IN_ANIMATION_ZOOM_FROM_TOP_LEFT', label: '从左上角缩放' },
  { value: 'SWITCH_IN_ANIMATION_ZOOM_FROM_TOP_RIGHT', label: '从右上角缩放' },
  { value: 'SWITCH_IN_CENTER_ZOOM_FADE', label: '中心缩放淡入' },
];

// ============ 辅助函数 ============

export function getSupportedEvents(componentType: string): EventType[] {
  return COMPONENT_SUPPORTED_EVENTS[componentType] || DEFAULT_SUPPORTED_EVENTS;
}
