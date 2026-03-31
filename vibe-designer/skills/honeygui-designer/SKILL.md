---
name: honeygui-designer
description: |
  Generate HoneyGUI HML (XML-based UI markup) files for embedded devices from natural language descriptions.

  Use when user wants to:
  - Create/design GUI interfaces for embedded systems, wearables, or IoT devices
  - Generate HML files from descriptions like "design a settings screen" or "create a dashboard"
  - Build UI layouts for HoneyGUI projects with components like buttons, images, text, labels, etc.
  - Convert UI requirements into structured HML format

  Trigger keywords: "design", "create interface/screen/UI/page", "generate HML",
  "smart watch/wearable interface", "embedded GUI", "build UI", "make a screen",
  or any request describing GUI layouts for embedded/IoT devices.
---

# HoneyGUI Designer Skill

Generate production-ready HoneyGUI HML files from natural language descriptions.

## Quick Start

When user requests a UI design:

1. **Understand Requirements**
   - Clarify the device type (smartwatch, IoT panel, etc.)
   - Screen resolution (default: 454x454 for smartwatch)
   - Key features/components needed
   - Visual style preferences

2. **Plan the Layout**
   - Sketch component hierarchy mentally
   - Consider ergonomics for embedded devices (touch targets, readability)
   - Plan navigation flow if multi-screen

3. **Generate HML**
   - Use appropriate components from the component library
   - Follow HML syntax rules
   - Include meta information
   - Add event handlers for interactivity

4. **Iterate**
   - Present generated HML
   - Accept feedback and refine
   - Suggest improvements based on embedded UI best practices

## HML Structure

```xml
<?xml version="1.0" encoding="UTF-8"?>
<hml>
  <meta>
    <title>Screen Name</title>
    <description>Brief description</description>
    <project>
      <resolution>454x454</resolution>
      <pixelMode>RGB565</pixelMode>
    </project>
  </meta>
  <view id="main_view">
    <!-- Components here -->
  </view>
</hml>
```

## Component Library Overview

**Common Components**:
- `hg_button` - Interactive buttons
- `hg_label` - Text display (static or dynamic)
- `hg_image` - Images with transform support
- `hg_slider` - Value sliders
- `hg_switch` - Toggle switches
- `hg_progressbar` - Progress indicators
- `hg_input` - Text input fields

**Container Components**:
- `hg_view` - Generic container
- `hg_window` - Window container
- `hg_container` - Layout container

**Advanced Components**:
- `hg_list` / `hg_list_item` - Scrollable lists
- `hg_grid` - Grid layouts
- `hg_tab` - Tab navigation
- `hg_canvas` - Custom drawing
- `hg_menu_cellular` - Honeycomb menu
- `hg_particle` - Particle effects

**For detailed component documentation**: Read `references/components.md`

## Key Attributes

Every component typically has:
- `id` - Unique identifier
- `name` - Display name
- `x`, `y` - Position (pixels)
- `w`, `h` - Size (pixels)

Component-specific attributes vary. See `references/components.md` for details.

## Event Handling

Components support events like:
- `onClick` - Button press
- `onValueChange` - Slider/input change
- `onLongPress` - Long press gesture

Event actions can:
- Switch views
- Update component properties
- Trigger animations
- Execute custom callbacks

## Design Principles for Embedded UIs

1. **Touch Targets**: Minimum 44x44px for buttons
2. **Readability**: Use legible font sizes (≥16px for body text)
3. **Performance**: Minimize nesting, reuse resources
4. **Simplicity**: Clean hierarchy, avoid overcomplication
5. **Feedback**: Visual feedback for interactions

**For comprehensive guidelines**: Read `references/design-principles.md`

## Layout Patterns

Common patterns include:
- **Dashboard** - Grid of status cards
- **Settings** - Vertical list of options
- **Media Control** - Centered playback controls
- **Navigation** - Top/bottom nav bars
- **Forms** - Vertical field arrangement

**For detailed patterns with examples**: Read `references/layout-patterns.md`

## Workflow Example

**User**: "Design a smart watch settings screen with brightness and volume sliders"

**Steps**:
1. Clarify: Resolution? Additional features?
2. Plan: Title label, two sliders with labels, back button
3. Generate: Complete HML with proper layout
4. Present: Show generated code
5. Iterate: Adjust based on feedback

## Advanced Features

**Animations & Timers**:
- Components support timer-based animations
- Multiple animation segments
- Actions: size, position, opacity, rotation, scale, etc.
- See `references/components.md` for timer configuration

**Multi-Screen Navigation**:
- Multiple `<view>` elements with unique IDs
- Switch between views using events
- Transition animations supported

**Custom Styling**:
- Colors, borders, backgrounds
- Image transforms (scale, rotate, opacity)
- Font customization

## File References

- **`references/components.md`** - Complete component documentation with all attributes and examples
- **`references/hml-syntax.md`** - HML XML syntax rules and best practices
- **`references/layout-patterns.md`** - Common UI patterns with code examples
- **`references/design-principles.md`** - Embedded UI design guidelines

## Tips

- **Start simple**: Basic layout first, add complexity gradually
- **Use examples**: Reference `assets/examples/` for inspiration
- **Validate as you go**: Ensure IDs are unique, attributes are valid
- **Think embedded**: Battery life, limited resources, finger-friendly UI
- **Iterate quickly**: Generate → feedback → refine
