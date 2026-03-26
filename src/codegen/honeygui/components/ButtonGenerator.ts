/**
 * hg_button component code generator
 * Implements dual-state image button using gui_img control
 * State transitions via gui_img_set_src image switching
 */
import { Component } from '../../../hml/types';
import { ComponentCodeGenerator, GeneratorContext } from './ComponentGenerator';
import * as path from 'path';
import * as fs from 'fs';

export class ButtonGenerator implements ComponentCodeGenerator {

  generateCreation(component: Component, indent: number, context: GeneratorContext): string {
    const indentStr = '    '.repeat(indent);
    const parentRef = context.getParentRef(component);
    const { x, y, width, height } = component.position;

    // Check for toggle mode (compatible with boolean and string "true")
    const toggleMode = component.data?.toggleMode === true || component.data?.toggleMode === 'true';
    
    if (toggleMode) {
      // Toggle mode: create image button using gui_img
      // Initially use off image as placeholder, then set correct image based on runtime state
      const imageOn = component.data?.imageOn || '';
      const imageOff = component.data?.imageOff || '';
      const binOn = this.convertToBinPath(imageOn);
      const binOff = this.convertToBinPath(imageOff);

      // Create widget (using off image as placeholder)
      let code = `${indentStr}${component.id} = (gui_obj_t *)gui_img_create_from_fs(${parentRef}, "${component.name}", "${binOff}", ${x}, ${y}, ${width}, ${height});\n`;
      // Set initial image based on runtime state variable (restore state on page re-entry)
      code += `${indentStr}if (${component.id}_state) {\n`;
      code += `${indentStr}    gui_img_set_src((gui_img_t *)${component.id}, "${binOn}", IMG_SRC_FILESYS);\n`;
      code += `${indentStr}}\n`;
      return code;
    }

    // Normal mode: also uses gui_img (SDK has no gui_button)
    // Consider overlaying gui_text for text content
    return `${indentStr}// Normal button not supported, please use toggle mode\n${indentStr}// ${component.id} = gui_img_create_from_fs(${parentRef}, "${component.name}", "", ${x}, ${y}, ${width}, ${height});\n`;
  }

  generatePropertySetters(component: Component, indent: number, context: GeneratorContext): string {
    const indentStr = '    '.repeat(indent);
    let code = '';

    // Visibility
    if (component.visible !== undefined) {
      code += `${indentStr}gui_obj_show((gui_obj_t *)${component.id}, ${component.visible ? 'true' : 'false'});\n`;
    }

    // Check for toggle mode
    const toggleMode = component.data?.toggleMode === true || component.data?.toggleMode === 'true';
    if (!toggleMode) {
      return code;
    }

    // Auto-scale: add scaling code if button size differs from original image size
    const { width, height } = component.position;
    const imageSize = this.getImageSize(component, context);
    
    if (imageSize && (width !== imageSize.width || height !== imageSize.height)) {
      const scaleX = width / imageSize.width;
      const scaleY = height / imageSize.height;
      code += `${indentStr}gui_img_scale((gui_img_t *)${component.id}, ${scaleX.toFixed(6)}f, ${scaleY.toFixed(6)}f);\n`;
    }

    return code;
  }

  /**
   * Get original image dimensions
   * Read image size info from asset configuration
   */
  private getImageSize(component: Component, context: GeneratorContext): { width: number; height: number } | null {
    const toggleMode = component.data?.toggleMode === true || component.data?.toggleMode === 'true';
    if (!toggleMode) {
      return null;
    }

    // Get image path for initial state
    const initialState = component.data?.initialState === 'on';
    const imageOn = component.data?.imageOn || '';
    const imageOff = component.data?.imageOff || '';
    const imagePath = initialState ? imageOn : imageOff;

    if (!imagePath) {
      return null;
    }

    // Get project root from context
    let projectRoot = context.projectRoot;
    if (!projectRoot) {
      return null;
    }

    // If projectRoot is .preview directory, go up one level to find actual project root
    if (projectRoot.endsWith('.preview')) {
      projectRoot = path.dirname(projectRoot);
    }

    // Build full image path
    const fullImagePath = path.join(projectRoot, imagePath);
    
    // Check if file exists
    if (!fs.existsSync(fullImagePath)) {
      return null;
    }

    try {
      // Read image file header to get dimensions
      const buffer = fs.readFileSync(fullImagePath);
      return this.parseImageSize(buffer, imagePath);
    } catch (err) {
      console.error(`Failed to read image size for ${imagePath}:`, err);
      return null;
    }
  }

  /**
   * Parse image dimensions (supports PNG, JPEG, BMP)
   */
  private parseImageSize(buffer: Buffer, filename: string): { width: number; height: number } | null {
    const ext = path.extname(filename).toLowerCase();

    if (ext === '.png') {
      // PNG: read IHDR chunk
      if (buffer.length >= 24 && buffer.toString('ascii', 1, 4) === 'PNG') {
        const width = buffer.readUInt32BE(16);
        const height = buffer.readUInt32BE(20);
        return { width, height };
      }
    } else if (ext === '.jpg' || ext === '.jpeg') {
      // JPEG: find SOF0 marker
      let offset = 2;
      while (offset < buffer.length - 9) {
        if (buffer[offset] === 0xFF) {
          const marker = buffer[offset + 1];
          // SOF0, SOF1, SOF2
          if (marker === 0xC0 || marker === 0xC1 || marker === 0xC2) {
            const height = buffer.readUInt16BE(offset + 5);
            const width = buffer.readUInt16BE(offset + 7);
            return { width, height };
          }
          // Skip this segment
          const segmentLength = buffer.readUInt16BE(offset + 2);
          offset += 2 + segmentLength;
        } else {
          offset++;
        }
      }
    } else if (ext === '.bmp') {
      // BMP: read DIB header
      if (buffer.length >= 26) {
        const width = buffer.readInt32LE(18);
        const height = Math.abs(buffer.readInt32LE(22));
        return { width, height };
      }
    }

    return null;
  }

  /**
   * Generate dual-state button callback function
   * Switches images via gui_img_set_src, merges onClick event actions into the same callback
   */
  generateToggleCallback(component: Component): string {
    // Check for toggle mode (compatible with boolean and string "true")
    const toggleMode = component.data?.toggleMode === true || component.data?.toggleMode === 'true';
    if (!toggleMode) {
      return '';
    }

    const imageOn = component.data?.imageOn || '';
    const imageOff = component.data?.imageOff || '';
    const binOn = this.convertToBinPath(imageOn);
    const binOff = this.convertToBinPath(imageOff);

    // User-configured callback function name (empty means no call)
    const onCallback = component.data?.onCallback || '';
    const offCallback = component.data?.offCallback || '';

    // Generate callback invocation code (skip if empty)
    const onCallLine = onCallback ? `        ${onCallback}(obj, e);\n` : '';
    const offCallLine = offCallback ? `        ${offCallback}(obj, e);\n` : '';
    const onCallLineNull = onCallback ? `        ${onCallback}(NULL, NULL);\n` : '';
    const offCallLineNull = offCallback ? `        ${offCallback}(NULL, NULL);\n` : '';

    // Collect onClick event actions, merge into toggle_cb
    const onClickActions = (component.eventConfigs || [])
      .filter(e => e.type === 'onClick')
      .flatMap(e => e.actions || []);

    const extraCode = onClickActions.length > 0
      ? this.generateOnClickActionsCode(onClickActions, component)
      : '';

    return `
// ${component.id} dual-state button callback
static bool ${component.id}_state = ${component.data?.initialState === 'on' ? 'true' : 'false'};

void ${component.id}_toggle_cb(void *obj, gui_event_t *e)
{
    GUI_UNUSED(obj);
    GUI_UNUSED(e);
    
    // Toggle state
    ${component.id}_state = !${component.id}_state;
    
    // Switch image based on state and call corresponding callback
    if (${component.id}_state) {
        gui_img_set_src((gui_img_t *)${component.id}, "${binOn}", IMG_SRC_FILESYS);
${onCallLine}    } else {
        gui_img_set_src((gui_img_t *)${component.id}, "${binOff}", IMG_SRC_FILESYS);
${offCallLine}    }
    gui_fb_change();
${extraCode}}

// Get current state
bool ${component.id}_get_state(void)
{
    return ${component.id}_state;
}

// Set state (external call)
void ${component.id}_set_state(bool state)
{
    if (${component.id}_state != state) {
        ${component.id}_state = state;
        
        if (state) {
            gui_img_set_src((gui_img_t *)${component.id}, "${binOn}", IMG_SRC_FILESYS);
${onCallLineNull}        } else {
            gui_img_set_src((gui_img_t *)${component.id}, "${binOff}", IMG_SRC_FILESYS);
${offCallLineNull}        }
    }
}
`;
  }

  /**
   * Generate onClick actions as inline code (merged into toggle_cb)
   */
  private generateOnClickActionsCode(actions: any[], component: Component): string {
    let code = `\n    // onClick event actions\n`;
    actions.forEach(action => {
      if (action.type === 'callFunction' && action.functionName) {
        code += `    ${action.functionName}(obj, e);\n`;
      } else if (action.type === 'switchView' && action.target) {
        const switchOutStyle = action.switchOutStyle || 'SWITCH_OUT_TO_LEFT_USE_TRANSLATION';
        const switchInStyle = action.switchInStyle || 'SWITCH_IN_FROM_RIGHT_USE_TRANSLATION';
        code += `    gui_view_switch_direct(gui_view_get_current(), "${action.target}", ${switchOutStyle}, ${switchInStyle});\n`;
      } else if (action.type === 'sendMessage' && action.message) {
        code += `    gui_msg_publish("${action.message}", NULL, 0);\n`;
      }
    });
    return code;
  }

  /**
   * Generate dual-state button state callback declarations (for header file)
   * Callback functions are declared by user in _user.h, not generated here
   */
  generateCallbackDeclarations(_component: Component): string {
    return '';
  }

  /**
   * Generate dual-state button state callback implementations (for callbacks.c)
   * Callback functions are implemented by user, not generated here
   */
  generateCallbackImplementations(_component: Component): string {
    return '';
  }

  /**
   * Generate dual-state button event bindings
   */
  generateEventBinding(component: Component, indent: number): string {
    // Check for toggle mode (compatible with boolean and string "true")
    const toggleMode = component.data?.toggleMode === true || component.data?.toggleMode === 'true';
    if (!toggleMode) {
      return '';
    }
    
    const indentStr = '    '.repeat(indent);
    return `${indentStr}gui_obj_add_event_cb((gui_obj_t *)${component.id}, ${component.id}_toggle_cb, GUI_EVENT_TOUCH_CLICKED, NULL);\n`;
  }

  /**
   * Convert image path to .bin format
   */
  private convertToBinPath(src: string): string {
    if (!src) return '';
    
    // Replace image extension with .bin
    let binSrc = src.replace(/\.(png|jpe?g|bmp|gif|tiff?|webp)$/i, '.bin');
    // Strip assets/ prefix
    binSrc = binSrc.replace(/^assets\//, '');
    // Ensure path starts with /
    if (!binSrc.startsWith('/')) {
      binSrc = '/' + binSrc;
    }
    
    return binSrc;
  }
}
