# HML Syntax Reference

HoneyGUI Markup Language (HML) syntax rules and best practices.

## Document Structure

Every HML file must follow this structure:

```xml
<?xml version="1.0" encoding="UTF-8"?>
<hml>
  <meta>
    <!-- Metadata -->
  </meta>
  <view id="main_view">
    <!-- Components -->
  </view>
</hml>
```

## XML Declaration

Always start with XML declaration:
```xml
<?xml version="1.0" encoding="UTF-8"?>
```

## Root Element

The `<hml>` tag is the root element and must contain:
1. Exactly one `<meta>` element (optional but recommended)
2. One or more `<view>` elements

## Meta Section

Metadata provides project and document information:

```xml
<meta>
  <title>Screen Title</title>
  <description>Brief description of this screen</description>
  <project>
    <name>Project Name</name>
    <appId>com.example.app</appId>
    <resolution>454x454</resolution>
    <minSdk>1.0</minSdk>
    <pixelMode>RGB565</pixelMode>
  </project>
  <author>
    <name>Developer Name</name>
    <email>dev@example.com</email>
  </author>
</meta>
```

**Common Fields**:
- `title` - Screen/page title
- `description` - Screen description
- `project.resolution` - Screen dimensions (e.g., "454x454", "368x448")
- `project.pixelMode` - Pixel format (RGB565, RGB888, ARGB8888)
- `project.appId` - Application identifier

## View Element

Views are top-level containers. Single-view structure:

```xml
<view id="main_view">
  <!-- Components here -->
</view>
```

Multi-view structure (for navigation):

```xml
<hml>
  <meta>...</meta>

  <view id="view_home">
    <!-- Home screen components -->
  </view>

  <view id="view_settings">
    <!-- Settings screen components -->
  </view>

  <view id="view_about">
    <!-- About screen components -->
  </view>
</hml>
```

**View Attributes**:
- `id` (required) - Unique identifier for navigation
- `residentMemory` - Keep in memory when switching ("true"/"false")

## Component Syntax

Basic component structure:

```xml
<component_type id="unique_id" name="Display Name"
                x="0" y="0" w="100" h="50"
                attribute1="value1"
                attribute2="value2" />
```

### Self-Closing vs. Container

**Self-closing** (no children):
```xml
<hg_button id="btn_ok" name="OK Button"
           x="100" y="200" w="80" h="40"
           text="OK" />
```

**Container** (with children):
```xml
<hg_view id="view_container" name="Container"
         x="0" y="0" w="454" h="454">
  <hg_label id="lbl_title" name="Title"
            x="127" y="50" w="200" h="40"
            text="Hello" />
  <hg_button id="btn_action" name="Action"
             x="177" y="200" w="100" h="44"
             text="Click" />
</hg_view>
```

## Attribute Rules

### Required Attributes

Most components require:
- `id` - Unique identifier (no spaces, alphanumeric + underscore)
- `name` - Human-readable name (for designer UI)
- `x`, `y` - Position in pixels
- `w`, `h` - Size in pixels

### Attribute Value Types

**Numbers**: Plain integers or floats
```xml
x="100" y="200.5" w="80" h="40"
```

**Strings**: Quoted text
```xml
text="Hello World" name="My Button"
```

**Booleans**: "true" or "false" (lowercase)
```xml
checked="true" enabled="false"
```

**Colors**: Hex format with `#`
```xml
color="#FFFFFF" backgroundColor="#000000"
```

With alpha channel:
```xml
color="#80FFFFFF"  <!-- 50% transparent white -->
```

**File Paths**: Relative to project root
```xml
src="assets/image.bin"
fontFamily="assets/fonts/roboto.ttf"
```

## ID Naming Conventions

Use descriptive, unique IDs with prefixes:

```xml
<!-- Good -->
<hg_button id="btn_confirm" />
<hg_label id="lbl_title" />
<hg_image id="img_background" />
<hg_slider id="slider_volume" />
<hg_view id="view_settings" />

<!-- Avoid -->
<hg_button id="button1" />  <!-- Too generic -->
<hg_label id="my label" />  <!-- Spaces not allowed -->
<hg_image id="123_image" /> <!-- Don't start with number -->
```

**Common Prefixes**:
- `btn_` - Buttons
- `lbl_` - Labels
- `img_` - Images
- `view_` - Views/containers
- `slider_` - Sliders
- `switch_` - Switches
- `input_` - Input fields
- `list_` - Lists
- `grid_` - Grids

## Component Hierarchy

Components can be nested to create hierarchy:

```xml
<hg_view id="view_main" x="0" y="0" w="454" h="454">
  <hg_view id="view_header" x="0" y="0" w="454" h="80">
    <hg_label id="lbl_title" x="127" y="20" w="200" h="40"
              text="App Title" />
  </hg_view>

  <hg_view id="view_content" x="0" y="80" w="454" h="324">
    <hg_button id="btn_action1" x="50" y="50" w="150" h="44"
               text="Action 1" />
    <hg_button id="btn_action2" x="50" y="120" w="150" h="44"
               text="Action 2" />
  </hg_view>

  <hg_view id="view_footer" x="0" y="404" w="454" h="50">
    <hg_label id="lbl_status" x="127" y="10" w="200" h="30"
              text="Ready" />
  </hg_view>
</hg_view>
```

**Benefits of Hierarchy**:
- Logical grouping
- Easier positioning (relative to parent)
- Better organization
- Visibility control (hide/show groups)

## Special Characters

### Escaping XML Special Characters

In text content, escape these characters:

| Character | Escape Sequence |
|-----------|----------------|
| `<`       | `&lt;`         |
| `>`       | `&gt;`         |
| `&`       | `&amp;`        |
| `"`       | `&quot;`       |
| `'`       | `&apos;`       |

**Example**:
```xml
<hg_label text="Value &lt; 100" />
<hg_label text="A &amp; B" />
```

### Unicode Support

HML supports Unicode characters directly:

```xml
<hg_label text="温度: 25°C" />
<hg_label text="音量 🔊" />
```

## Comments

Use XML comment syntax:

```xml
<!-- This is a comment -->

<!--
  Multi-line comment
  Describing complex logic
-->

<hg_button id="btn_ok" name="OK Button"
           x="100" y="200" w="80" h="40"
           text="OK" />  <!-- Inline comment -->
```

## Whitespace and Formatting

### Indentation

Use consistent indentation (2 or 4 spaces):

```xml
<hml>
  <meta>
    <title>Example</title>
  </meta>
  <view id="main_view">
    <hg_view id="view_container">
      <hg_button id="btn_action" />
    </hg_view>
  </view>
</hml>
```

### Line Breaks

Break long attribute lists for readability:

```xml
<!-- Single line (short attributes) -->
<hg_button id="btn_ok" x="100" y="200" w="80" h="40" text="OK" />

<!-- Multi-line (many attributes) -->
<hg_image id="img_animated"
          name="Animated Image"
          x="177" y="177"
          w="100" h="100"
          src="assets/icon.bin"
          rotation="45"
          scaleX="1.2"
          scaleY="1.2"
          opacity="200" />
```

### Attribute Order

Recommended attribute order:
1. `id` (always first)
2. `name`
3. Position and size (`x`, `y`, `w`, `h`)
4. Content attributes (`text`, `src`, `value`)
5. Style attributes (`color`, `fontSize`, etc.)
6. Event handlers (`onClick`, `onValueChange`, etc.)

**Example**:
```xml
<hg_button id="btn_submit"
           name="Submit Button"
           x="177" y="350"
           w="100" h="44"
           text="Submit"
           fontSize="16"
           color="#FFFFFF"
           backgroundColor="#0066CC"
           onClick="handleSubmit" />
```

## Validation Rules

### Must Have

✅ XML declaration
✅ Root `<hml>` element
✅ At least one `<view>` element
✅ Unique component IDs
✅ Required attributes for each component type

### Must Not Have

❌ Duplicate IDs
❌ Invalid component types
❌ Missing required attributes
❌ Malformed XML syntax
❌ Circular parent-child relationships

## Error Prevention Tips

1. **Always close tags**: Use self-closing `/>` for empty elements
2. **Quote all attributes**: Even numbers should be quoted
3. **Unique IDs**: Check for duplicates across all views
4. **Valid paths**: Ensure asset paths exist and are correct
5. **Proper nesting**: Close tags in correct order (LIFO)
6. **Use validation**: Check with HML parser before deployment

## Example: Complete Valid HML

```xml
<?xml version="1.0" encoding="UTF-8"?>
<hml>
  <meta>
    <title>Smart Watch Home</title>
    <description>Main home screen with time and quick actions</description>
    <project>
      <resolution>454x454</resolution>
      <pixelMode>RGB565</pixelMode>
    </project>
  </meta>

  <view id="view_home">
    <!-- Background -->
    <hg_image id="img_background"
              name="Background"
              x="0" y="0"
              w="454" h="454"
              src="assets/bg_home.bin" />

    <!-- Time Display -->
    <hg_label id="lbl_time"
              name="Time"
              x="127" y="150"
              w="200" h="60"
              timeFormat="HH:MM"
              fontSize="48"
              color="#FFFFFF"
              textAlign="center" />

    <!-- Date Display -->
    <hg_label id="lbl_date"
              name="Date"
              x="127" y="220"
              w="200" h="30"
              timeFormat="YYYY-MM-DD"
              fontSize="16"
              color="#CCCCCC"
              textAlign="center" />

    <!-- Quick Actions -->
    <hg_button id="btn_apps"
               name="Apps Button"
               x="127" y="300"
               w="80" h="80"
               src="assets/icon_apps.bin"
               onClick="goToApps" />

    <hg_button id="btn_settings"
               name="Settings Button"
               x="247" y="300"
               w="80" h="80"
               src="assets/icon_settings.bin"
               onClick="goToSettings" />
  </view>
</hml>
```

## Best Practices Summary

1. **Consistent naming**: Use clear, descriptive IDs with prefixes
2. **Proper indentation**: Makes structure readable
3. **Comments for complexity**: Explain non-obvious logic
4. **Logical grouping**: Use containers to organize related components
5. **Avoid deep nesting**: Keep hierarchy reasonable (max 4-5 levels)
6. **Separate concerns**: One view per screen/page
7. **Asset organization**: Use consistent asset paths
8. **Validate early**: Check syntax as you build
