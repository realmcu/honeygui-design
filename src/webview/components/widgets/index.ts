import React from 'react';
import { WidgetProps } from './types';
import { ButtonWidget } from './ButtonWidget';
import { LabelWidget } from './LabelWidget';
import { TextWidget } from './TextWidget';
import { InputWidget } from './InputWidget';
import { CheckboxWidget } from './CheckboxWidget';
import { RadioWidget } from './RadioWidget';
import { ProgressBarWidget } from './ProgressBarWidget';
import { SliderWidget } from './SliderWidget';
import { ContainerWidget } from './ContainerWidget';
import { ImageWidget } from './ImageWidget';
import { ListWidget } from './ListWidget';
import { ListItemWidget } from './ListItemWidget';
import { VideoWidget } from './VideoWidget';
import { Model3DWidget } from './Model3DWidget';
import { ArcWidget } from './ArcWidget';
import { RectWidget } from './RectWidget';
import { SvgWidget } from './SvgWidget';
import { LottieWidget } from './LottieWidget';

export { WidgetProps } from './types';

/**
 * 组件类型到控件的映射
 */
export const widgetRegistry: Record<string, React.FC<WidgetProps>> = {
  hg_button: ButtonWidget,
  hg_label: LabelWidget,
  hg_text: TextWidget,
  hg_input: InputWidget,
  hg_checkbox: CheckboxWidget,
  hg_radio: RadioWidget,
  hg_progressbar: ProgressBarWidget,
  hg_slider: SliderWidget,
  hg_view: ContainerWidget,
  hg_window: ContainerWidget,
  hg_image: ImageWidget,
  hg_canvas: ContainerWidget,
  hg_list: ListWidget,
  hg_list_item: ListItemWidget,
  hg_video: VideoWidget,
  hg_3d: Model3DWidget,
  hg_arc: ArcWidget,
  hg_rect: RectWidget,
  hg_svg: SvgWidget,
  hg_lottie: LottieWidget,
};
