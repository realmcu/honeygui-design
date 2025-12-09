import { ComponentType } from '../../types';
import { HgViewProperties } from './HgViewProperties';
import { Hg3DProperties } from './Hg3DProperties';
import { HgVideoProperties } from './HgVideoProperties';
import { DefaultProperties } from './DefaultProperties';
import { PropertyPanelProps } from './types';

export const propertyPanelRegistry: Record<ComponentType, React.FC<PropertyPanelProps>> = {
  hg_view: HgViewProperties,
  hg_button: DefaultProperties,
  hg_label: DefaultProperties,
  hg_text: DefaultProperties,
  hg_input: DefaultProperties,
  hg_textarea: DefaultProperties,
  hg_checkbox: DefaultProperties,
  hg_radio: DefaultProperties,
  hg_switch: DefaultProperties,
  hg_slider: DefaultProperties,
  hg_image: DefaultProperties,
  hg_window: DefaultProperties,
  hg_screen: DefaultProperties,
  hg_canvas: DefaultProperties,
  hg_list: DefaultProperties,
  hg_video: HgVideoProperties,
  hg_3d: Hg3DProperties,
  hg_arc: DefaultProperties,
  hg_rect: DefaultProperties,
  hg_circle: DefaultProperties,
};

export { HgViewProperties } from './HgViewProperties';
export { Hg3DProperties } from './Hg3DProperties';
export { HgVideoProperties } from './HgVideoProperties';
export { DefaultProperties } from './DefaultProperties';
export { BaseProperties } from './BaseProperties';
export { PropertyEditor } from './PropertyEditor';
export type { PropertyPanelProps, PropertyEditorProps } from './types';
