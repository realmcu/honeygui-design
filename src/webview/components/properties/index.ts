import { ComponentType } from '../../types';
import { HgViewProperties } from './HgViewProperties';
import { HgWindowProperties } from './HgWindowProperties';
import { Hg3DProperties } from './Hg3DProperties';
import { HgVideoProperties } from './HgVideoProperties';
import { HgImageProperties } from './HgImageProperties';
import { HgListProperties } from './HgListProperties';
import { ListItemProperties } from './ListItemProperties';
import { GeometryProperties } from './GeometryProperties';
import { DefaultProperties } from './DefaultProperties';
import { PropertyPanelProps } from './types';

export const propertyPanelRegistry: Record<ComponentType, React.FC<PropertyPanelProps>> = {
  hg_view: HgViewProperties,
  hg_button: DefaultProperties,
  hg_label: DefaultProperties,
  hg_time_label: DefaultProperties,
  hg_text: DefaultProperties,
  hg_input: DefaultProperties,
  hg_textarea: DefaultProperties,
  hg_checkbox: DefaultProperties,
  hg_radio: DefaultProperties,
  hg_switch: DefaultProperties,
  hg_slider: DefaultProperties,
  hg_image: HgImageProperties,
  hg_window: HgWindowProperties,
  hg_canvas: DefaultProperties,
  hg_list: HgListProperties,
  hg_list_item: ListItemProperties,
  hg_video: HgVideoProperties,
  hg_3d: Hg3DProperties,
  hg_arc: GeometryProperties,
  hg_circle: GeometryProperties,
  hg_rect: GeometryProperties,
  hg_svg: DefaultProperties,
  hg_lottie: DefaultProperties,
  hg_glass: DefaultProperties,
};

export { HgViewProperties } from './HgViewProperties';
export { HgWindowProperties } from './HgWindowProperties';
export { Hg3DProperties } from './Hg3DProperties';
export { HgVideoProperties } from './HgVideoProperties';
export { HgImageProperties } from './HgImageProperties';
export { HgListProperties } from './HgListProperties';
export { ListItemProperties } from './ListItemProperties';
export { GeometryProperties } from './GeometryProperties';
export { DefaultProperties } from './DefaultProperties';
export { BaseProperties } from './BaseProperties';
export { PropertyEditor } from './PropertyEditor';
export type { PropertyPanelProps, PropertyEditorProps } from './types';
