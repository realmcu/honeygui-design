import { ComponentType } from '../../types';
import { HgViewProperties } from './HgViewProperties';
import { DefaultProperties } from './DefaultProperties';

export const propertyPanelRegistry: Record<ComponentType, React.FC<any>> = {
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
};

export { HgViewProperties } from './HgViewProperties';
export { DefaultProperties } from './DefaultProperties';
export { PropertyEditor } from './PropertyEditor';
export type { PropertyPanelProps, PropertyEditorProps } from './types';
