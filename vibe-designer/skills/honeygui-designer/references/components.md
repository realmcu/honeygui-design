# HoneyGUI Component Reference

Complete documentation for all HoneyGUI HML components.

## Table of Contents

- [Basic Components](#basic-components)
  - [hg_button](#hg_button)
  - [hg_label](#hg_label)
  - [hg_image](#hg_image)
  - [hg_input](#hg_input)
- [Interactive Components](#interactive-components)
  - [hg_slider](#hg_slider)
  - [hg_switch](#hg_switch)
  - [hg_progressbar](#hg_progressbar)
  - [hg_checkbox](#hg_checkbox)
  - [hg_radio](#hg_radio)
- [Container Components](#container-components)
  - [hg_view](#hg_view)
  - [hg_window](#hg_window)
  - [hg_container](#hg_container)
- [Advanced Components](#advanced-components)
  - [hg_list / hg_list_item](#hg_list--hg_list_item)
  - [hg_grid](#hg_grid)
  - [hg_tab](#hg_tab)
  - [hg_canvas](#hg_canvas)
  - [hg_menu_cellular](#hg_menu_cellular)
  - [hg_particle](#hg_particle)
  - [hg_glass](#hg_glass)

---

## Basic Components

### hg_button

Interactive button component with image and text support.

**Attributes**:
- `id` (required) - Unique identifier
- `name` (required) - Display name
- `x`, `y` - Position in pixels
- `w`, `h` - Size in pixels
- `src` - Image path (optional)
- `text` - Button label (optional)
- `onClick` - Click event handler

**Example**:
```xml
<hg_button id="btn_confirm" name="Confirm Button"
           x="177" y="350" w="100" h="44"
           text="Confirm"
           onClick="handleConfirm" />

<hg_button id="btn_icon" name="Icon Button"
           x="50" y="100" w="80" h="80"
           src="assets/icon_settings.bin" />
```

**Best Practices**:
- Minimum size: 44x44px for touch targets
- Provide visual feedback (use state images or events)
- Keep text concise

---

### hg_label

Text display component with support for static text, dynamic data, and time display.

**Attributes**:
- `id` (required)
- `name` (required)
- `x`, `y`, `w`, `h`
- `text` - Static text content
- `fontSize` - Font size in pixels (default: 16)
- `color` - Text color in hex (e.g., "#FFFFFF")
- `fontFamily` - Font file path
- `textAlign` - Alignment: "left", "center", "right"
- `timeFormat` - Auto-update time (e.g., "HH:MM:SS")

**Timer Label Attributes** (for stopwatch/countdown):
- `isTimerLabel` - Enable timer mode
- `timerType` - "stopwatch" or "countdown"
- `timerFormat` - "HH:MM:SS", "MM:SS", "MM:SS:MS", "SS"
- `timerInitialValue` - Initial value in milliseconds
- `timerAutoStart` - Auto-start on load (default: true)

**Example**:
```xml
<!-- Static text -->
<hg_label id="lbl_title" name="Title"
          x="127" y="50" w="200" h="40"
          text="Settings"
          fontSize="24"
          color="#FFFFFF"
          textAlign="center" />

<!-- Time display -->
<hg_label id="lbl_time" name="Clock"
          x="177" y="100" w="100" h="30"
          timeFormat="HH:MM:SS"
          fontSize="18" />

<!-- Stopwatch -->
<hg_label id="lbl_timer" name="Timer"
          x="150" y="200" w="154" h="40"
          isTimerLabel="true"
          timerType="stopwatch"
          timerFormat="MM:SS"
          fontSize="32" />
```

---

### hg_image

Image display component with transform support (scale, rotate, opacity).

**Attributes**:
- `id`, `name`, `x`, `y`, `w`, `h`
- `src` - Image file path (required)
- `opacity` - 0-255 (default: 255)
- `rotation` - Rotation angle in degrees
- `scaleX`, `scaleY` - Scale factors (default: 1.0)
- `focusX`, `focusY` - Transform origin point

**Example**:
```xml
<hg_image id="img_background" name="Background"
          x="0" y="0" w="454" h="454"
          src="assets/bg_main.bin" />

<hg_image id="img_icon" name="Icon"
          x="177" y="177" w="100" h="100"
          src="assets/icon.bin"
          rotation="45"
          scaleX="1.2"
          scaleY="1.2"
          opacity="200" />
```

**Supported Transform Actions** (via timers/events):
- Size: `fromW`, `fromH`, `toW`, `toH`
- Position: `fromX`, `fromY`, `toX`, `toY`
- Opacity: `from`, `to` (0-255)
- Rotation: `angleOrigin`, `angleTarget`
- Scale: `zoomXOrigin`, `zoomXTarget`, `zoomYOrigin`, `zoomYTarget`
- Image change: `imagePath`
- Image sequence: `imageSequence` (array)
- Color tint: `fgColorFrom`, `fgColorTo`, `bgColorFrom`, `bgColorTo`

---

### hg_input

Text input field for user input.

**Attributes**:
- `id`, `name`, `x`, `y`, `w`, `h`
- `placeholder` - Placeholder text
- `value` - Initial value
- `fontSize` - Font size
- `maxLength` - Maximum character count

**Example**:
```xml
<hg_input id="input_name" name="Name Input"
          x="100" y="200" w="254" h="40"
          placeholder="Enter your name"
          fontSize="16"
          maxLength="20" />
```

---

## Interactive Components

### hg_slider

Horizontal or vertical slider for value selection.

**Attributes**:
- `id`, `name`, `x`, `y`, `w`, `h`
- `min` - Minimum value (default: 0)
- `max` - Maximum value (default: 100)
- `value` - Initial value
- `orientation` - "horizontal" or "vertical"
- `onValueChange` - Value change event handler

**Example**:
```xml
<hg_slider id="slider_brightness" name="Brightness"
           x="100" y="200" w="254" h="40"
           min="0"
           max="100"
           value="50"
           onValueChange="handleBrightnessChange" />
```

---

### hg_switch

Toggle switch component (on/off state).

**Attributes**:
- `id`, `name`, `x`, `y`, `w`, `h`
- `checked` - Initial state (true/false)
- `onToggle` - Toggle event handler

**Example**:
```xml
<hg_switch id="switch_wifi" name="WiFi Switch"
           x="300" y="150" w="60" h="30"
           checked="true"
           onToggle="handleWifiToggle" />
```

---

### hg_progressbar

Progress bar for displaying completion percentage.

**Attributes**:
- `id`, `name`, `x`, `y`, `w`, `h`
- `value` - Current value (0-100)
- `orientation` - "horizontal" or "vertical"
- `color` - Bar color
- `backgroundColor` - Track color

**Example**:
```xml
<hg_progressbar id="progress_download" name="Download Progress"
                x="100" y="300" w="254" h="20"
                value="65"
                color="#00FF00"
                backgroundColor="#333333" />
```

---

### hg_checkbox

Checkbox for boolean selection (checked/unchecked).

**Attributes**:
- `id`, `name`, `x`, `y`, `w`, `h`
- `checked` - Initial state
- `label` - Label text
- `onChange` - State change handler

**Example**:
```xml
<hg_checkbox id="chk_agree" name="Agreement Checkbox"
             x="100" y="350" w="254" h="30"
             label="I agree to terms"
             checked="false"
             onChange="handleAgree" />
```

---

### hg_radio

Radio button for single selection from a group.

**Attributes**:
- `id`, `name`, `x`, `y`, `w`, `h`
- `group` - Radio group name (for mutual exclusion)
- `checked` - Initial selection
- `label` - Label text

**Example**:
```xml
<hg_radio id="radio_opt1" name="Option 1"
          x="100" y="200" w="200" h="30"
          group="options"
          label="Option 1"
          checked="true" />

<hg_radio id="radio_opt2" name="Option 2"
          x="100" y="240" w="200" h="30"
          group="options"
          label="Option 2" />
```

---

## Container Components

### hg_view

Generic container component for organizing child elements. Supports nesting, animations, and opacity.

**Attributes**:
- `id`, `name`, `x`, `y`, `w`, `h`
- `residentMemory` - Keep in memory when switching views ("true"/"false")
- `opacity` - View opacity 0-255
- `animateStep` - Animation step value

**Example**:
```xml
<hg_view id="view_settings" name="Settings View"
         x="0" y="0" w="454" h="454"
         residentMemory="true">
  <!-- Child components -->
  <hg_label id="lbl_settings" name="Settings Title"
            x="127" y="50" w="200" h="40"
            text="Settings" />
</hg_view>
```

**Multi-View Navigation**:
```xml
<hml>
  <meta>...</meta>
  <view id="view_home">
    <hg_button id="btn_goto_settings"
               text="Settings"
               onClick="switchToSettings" />
  </view>
  <view id="view_settings">
    <hg_button id="btn_back"
               text="Back"
               onClick="switchToHome" />
  </view>
</hml>
```

---

### hg_window

Window container with title bar and border.

**Attributes**:
- `id`, `name`, `x`, `y`, `w`, `h`
- `title` - Window title
- `titleBarHeight` - Title bar height in pixels
- `titleBarColor` - Title bar background color

**Example**:
```xml
<hg_window id="win_dialog" name="Dialog Window"
           x="50" y="100" w="354" h="254"
           title="Confirmation"
           titleBarHeight="40"
           titleBarColor="#0066CC">
  <!-- Content -->
</hg_window>
```

---

### hg_container

Layout container for organizing components.

**Attributes**:
- `id`, `name`, `x`, `y`, `w`, `h`
- `overflow` - "visible", "hidden", "scroll"
- `backgroundColor` - Container background

**Example**:
```xml
<hg_container id="cnt_main" name="Main Container"
              x="0" y="100" w="454" h="354"
              overflow="scroll"
              backgroundColor="#1A1A1A">
  <!-- Components -->
</hg_container>
```

---

## Advanced Components

### hg_list / hg_list_item

Scrollable list with item templates.

**hg_list Attributes**:
- `id`, `name`, `x`, `y`, `w`, `h`
- `itemHeight` - Height of each list item

**hg_list_item Attributes**:
- `id`, `name`
- Contains child components for item layout

**Example**:
```xml
<hg_list id="list_menu" name="Menu List"
         x="50" y="100" w="354" h="300"
         itemHeight="60">
  <hg_list_item id="item_template" name="Item Template">
    <hg_label id="lbl_item_text"
              x="20" y="10" w="300" h="40"
              text="Menu Item" />
  </hg_list_item>
</hg_list>
```

---

### hg_grid

Grid layout for arranging items in rows and columns.

**Attributes**:
- `id`, `name`, `x`, `y`, `w`, `h`
- `rows` - Number of rows
- `columns` - Number of columns
- `spacing` - Space between items

**Example**:
```xml
<hg_grid id="grid_icons" name="Icon Grid"
         x="50" y="100" w="354" h="354"
         rows="3"
         columns="3"
         spacing="20">
  <!-- Grid items -->
</hg_grid>
```

---

### hg_tab

Tab navigation component.

**Attributes**:
- `id`, `name`, `x`, `y`, `w`, `h`
- `tabs` - Tab definitions
- `activeTab` - Initially active tab index

**Example**:
```xml
<hg_tab id="tab_main" name="Main Tabs"
        x="0" y="50" w="454" h="404"
        activeTab="0">
  <!-- Tab contents -->
</hg_tab>
```

---

### hg_canvas

Custom drawing canvas for vector graphics and animations.

**Attributes**:
- `id`, `name`, `x`, `y`, `w`, `h`
- Requires custom drawing code

**Example**:
```xml
<hg_canvas id="canvas_graph" name="Graph Canvas"
           x="50" y="100" w="354" h="200" />
```

---

### hg_menu_cellular

Honeycomb-style menu (cellular/hexagonal layout).

**Attributes**:
- `id`, `name`, `x`, `y`, `w`, `h`
- `cellSize` - Size of each hexagonal cell
- Menu items defined as children

**Example**:
```xml
<hg_menu_cellular id="menu_main" name="Main Menu"
                  x="77" y="77" w="300" h="300"
                  cellSize="80">
  <!-- Menu items -->
</hg_menu_cellular>
```

---

### hg_particle

Particle effect system for visual effects.

**Attributes**:
- `id`, `name`, `x`, `y`, `w`, `h`
- `particleCount` - Number of particles
- `effect` - Effect type
- Requires additional configuration

**Example**:
```xml
<hg_particle id="particle_stars" name="Star Effect"
             x="0" y="0" w="454" h="454"
             particleCount="50"
             effect="stars" />
```

---

### hg_glass

Glass/frosted effect overlay.

**Attributes**:
- `id`, `name`, `x`, `y`, `w`, `h`
- `blurRadius` - Blur intensity
- `opacity` - Overlay opacity

**Example**:
```xml
<hg_glass id="glass_overlay" name="Glass Effect"
          x="50" y="100" w="354" h="254"
          blurRadius="10"
          opacity="200" />
```

---

## Timer-Based Animations

Components support timer-based animations for dynamic effects. Multiple timers can be defined per component.

**Timer Configuration Structure**:
```xml
<hg_image id="img_animated" name="Animated Image"
          x="177" y="177" w="100" h="100"
          src="assets/icon.bin">
  <timer id="anim_rotate"
         name="Rotation Animation"
         enabled="true"
         interval="16"
         reload="true"
         mode="preset">
    <segment duration="1000">
      <action type="rotation"
              angleOrigin="0"
              angleTarget="360" />
    </segment>
  </timer>
</hg_image>
```

**Timer Attributes**:
- `id` - Timer unique ID
- `name` - Timer name (for documentation)
- `enabled` - Auto-bind on component creation (only one can be true)
- `interval` - Execution interval in milliseconds
- `reload` - Loop animation (true/false)
- `mode` - "preset" (predefined actions) or "custom" (callback function)
- `runImmediately` - Execute immediately without waiting for interval

**Animation Segments**:
Each timer can have multiple segments for sequential animations:
- `duration` - Segment duration in milliseconds
- `actions` - Array of actions to perform during this segment

**Action Types** (see hg_image section for detailed parameters):
- `size` - Animate width/height
- `position` - Animate x/y position
- `opacity` - Fade in/out
- `rotation` - Rotate image
- `scale` - Scale image
- `switchView` - Navigate to another view
- `changeImage` - Change image source
- `imageSequence` - Animate through image sequence
- `visibility` - Show/hide component
- `switchTimer` - Control other timers
- `fgColor` / `bgColor` - Animate color tint

**Multi-Segment Example**:
```xml
<timer id="anim_complex" enabled="true" interval="16" reload="true" mode="preset">
  <!-- Wait 500ms -->
  <segment duration="500"></segment>

  <!-- Fade in over 1s -->
  <segment duration="1000">
    <action type="opacity" from="0" to="255" />
  </segment>

  <!-- Move and scale over 2s -->
  <segment duration="2000">
    <action type="position" fromX="100" fromY="100" toX="200" toY="200" />
    <action type="scale" zoomXOrigin="1.0" zoomXTarget="1.5"
                         zoomYOrigin="1.0" zoomYTarget="1.5" />
  </segment>

  <!-- Wait 1s -->
  <segment duration="1000"></segment>

  <!-- Fade out over 1s -->
  <segment duration="1000">
    <action type="opacity" from="255" to="0" />
  </segment>
</timer>
```

**Custom Callback Mode**:
```xml
<timer id="anim_custom"
       enabled="true"
       interval="100"
       reload="true"
       mode="custom"
       callback="customAnimationFunction" />
```

---

## Event-Action System

Components support an event-action configuration system for interactive behavior.

**Supported Events**:
- `onClick` - Component clicked
- `onLongPress` - Component long-pressed
- `onValueChange` - Value changed (sliders, inputs, etc.)
- `onToggle` - Toggle state changed (switches)
- `onChange` - State changed (checkboxes, radios)

**Supported Actions**:
- `switchView` - Navigate to another view
- `updateProperty` - Change component property
- `playAnimation` - Start timer animation
- `stopAnimation` - Stop timer animation
- `callback` - Execute custom function

**Example** (Event-Action in attributes):
```xml
<hg_button id="btn_next" name="Next Button"
           x="177" y="350" w="100" h="44"
           text="Next"
           onClick="goToNextScreen" />
```

For more complex event-action configurations, use the `<eventConfig>` structure (handled by the designer UI).

---

## Notes

- All position and size values are in pixels
- Colors use hex format: `#RRGGBB` or `#AARRGGBB`
- Image paths should point to converted `.bin` files
- Font paths should point to converted font files
- IDs must be unique within the document
- Component hierarchy is determined by nesting in XML
