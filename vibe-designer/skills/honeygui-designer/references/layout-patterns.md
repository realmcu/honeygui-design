# HML Layout Patterns

Common UI layout patterns for embedded devices with complete examples.

## Table of Contents

- [Dashboard / Status Screen](#dashboard--status-screen)
- [Settings List](#settings-list)
- [Media Player Controls](#media-player-controls)
- [Form / Input Screen](#form--input-screen)
- [Navigation Menu](#navigation-menu)
- [Notification Center](#notification-center)
- [Activity Tracking](#activity-tracking)
- [Timer / Stopwatch](#timer--stopwatch)
- [Grid Menu](#grid-menu)
- [Carousel / Swipe Pages](#carousel--swipe-pages)

---

## Dashboard / Status Screen

**Use Case**: Display multiple status metrics at a glance (fitness, health, home automation).

**Layout**: Grid of cards with icons and values.

```xml
<?xml version="1.0" encoding="UTF-8"?>
<hml>
  <meta>
    <title>Dashboard</title>
    <project>
      <resolution>454x454</resolution>
    </project>
  </meta>

  <view id="view_dashboard">
    <!-- Background -->
    <hg_image id="img_bg" x="0" y="0" w="454" h="454"
              src="assets/bg_dashboard.bin" />

    <!-- Title -->
    <hg_label id="lbl_title" x="127" y="30" w="200" h="40"
              text="Dashboard"
              fontSize="24"
              color="#FFFFFF"
              textAlign="center" />

    <!-- Status Cards in 2x2 Grid -->

    <!-- Card 1: Steps -->
    <hg_view id="card_steps" x="40" y="100" w="167" h="147"
             backgroundColor="#1E1E1E" borderRadius="16">
      <hg_image id="icon_steps" x="59" y="20" w="50" h="50"
                src="assets/icon_steps.bin" />
      <hg_label id="lbl_steps_value" x="34" y="80" w="100" h="40"
                text="8,542"
                fontSize="28"
                color="#00FF88"
                textAlign="center" />
      <hg_label id="lbl_steps_label" x="34" y="115" w="100" h="20"
                text="Steps"
                fontSize="14"
                color="#999999"
                textAlign="center" />
    </hg_view>

    <!-- Card 2: Heart Rate -->
    <hg_view id="card_heart" x="247" y="100" w="167" h="147"
             backgroundColor="#1E1E1E" borderRadius="16">
      <hg_image id="icon_heart" x="59" y="20" w="50" h="50"
                src="assets/icon_heart.bin" />
      <hg_label id="lbl_heart_value" x="34" y="80" w="100" h="40"
                text="72"
                fontSize="28"
                color="#FF0066"
                textAlign="center" />
      <hg_label id="lbl_heart_label" x="34" y="115" w="100" h="20"
                text="BPM"
                fontSize="14"
                color="#999999"
                textAlign="center" />
    </hg_view>

    <!-- Card 3: Calories -->
    <hg_view id="card_calories" x="40" y="267" w="167" h="147"
             backgroundColor="#1E1E1E" borderRadius="16">
      <hg_image id="icon_calories" x="59" y="20" w="50" h="50"
                src="assets/icon_calories.bin" />
      <hg_label id="lbl_calories_value" x="34" y="80" w="100" h="40"
                text="420"
                fontSize="28"
                color="#FF8800"
                textAlign="center" />
      <hg_label id="lbl_calories_label" x="34" y="115" w="100" h="20"
                text="Cal"
                fontSize="14"
                color="#999999"
                textAlign="center" />
    </hg_view>

    <!-- Card 4: Sleep -->
    <hg_view id="card_sleep" x="247" y="267" w="167" h="147"
             backgroundColor="#1E1E1E" borderRadius="16">
      <hg_image id="icon_sleep" x="59" y="20" w="50" h="50"
                src="assets/icon_sleep.bin" />
      <hg_label id="lbl_sleep_value" x="34" y="80" w="100" h="40"
                text="7.5h"
                fontSize="28"
                color="#6688FF"
                textAlign="center" />
      <hg_label id="lbl_sleep_label" x="34" y="115" w="100" h="20"
                text="Sleep"
                fontSize="14"
                color="#999999"
                textAlign="center" />
    </hg_view>
  </view>
</hml>
```

---

## Settings List

**Use Case**: Scrollable list of settings options (system settings, preferences).

**Layout**: Vertical list with icons, labels, and controls.

```xml
<?xml version="1.0" encoding="UTF-8"?>
<hml>
  <meta>
    <title>Settings</title>
    <project>
      <resolution>454x454</resolution>
    </project>
  </meta>

  <view id="view_settings">
    <!-- Header -->
    <hg_view id="view_header" x="0" y="0" w="454" h="80"
             backgroundColor="#0066CC">
      <hg_button id="btn_back" x="20" y="20" w="40" h="40"
                 src="assets/icon_back.bin"
                 onClick="goBack" />
      <hg_label id="lbl_title" x="127" y="20" w="200" h="40"
                text="Settings"
                fontSize="24"
                color="#FFFFFF"
                textAlign="center" />
    </hg_view>

    <!-- Scrollable Content -->
    <hg_container id="cnt_settings" x="0" y="80" w="454" h="374"
                  overflow="scroll"
                  backgroundColor="#000000">

      <!-- Brightness Setting -->
      <hg_view id="item_brightness" x="20" y="20" w="414" h="80">
        <hg_image id="icon_brightness" x="0" y="15" w="50" h="50"
                  src="assets/icon_brightness.bin" />
        <hg_label id="lbl_brightness" x="70" y="10" w="150" h="30"
                  text="Brightness"
                  fontSize="18"
                  color="#FFFFFF" />
        <hg_slider id="slider_brightness" x="70" y="45" w="324" h="30"
                   min="0" max="100" value="70"
                   onValueChange="handleBrightnessChange" />
      </hg_view>

      <!-- Volume Setting -->
      <hg_view id="item_volume" x="20" y="120" w="414" h="80">
        <hg_image id="icon_volume" x="0" y="15" w="50" h="50"
                  src="assets/icon_volume.bin" />
        <hg_label id="lbl_volume" x="70" y="10" w="150" h="30"
                  text="Volume"
                  fontSize="18"
                  color="#FFFFFF" />
        <hg_slider id="slider_volume" x="70" y="45" w="324" h="30"
                   min="0" max="100" value="50"
                   onValueChange="handleVolumeChange" />
      </hg_view>

      <!-- WiFi Toggle -->
      <hg_view id="item_wifi" x="20" y="220" w="414" h="60">
        <hg_image id="icon_wifi" x="0" y="5" w="50" h="50"
                  src="assets/icon_wifi.bin" />
        <hg_label id="lbl_wifi" x="70" y="15" w="200" h="30"
                  text="WiFi"
                  fontSize="18"
                  color="#FFFFFF" />
        <hg_switch id="switch_wifi" x="334" y="15" w="60" h="30"
                   checked="true"
                   onToggle="handleWifiToggle" />
      </hg_view>

      <!-- Bluetooth Toggle -->
      <hg_view id="item_bluetooth" x="20" y="300" w="414" h="60">
        <hg_image id="icon_bluetooth" x="0" y="5" w="50" h="50"
                  src="assets/icon_bluetooth.bin" />
        <hg_label id="lbl_bluetooth" x="70" y="15" w="200" h="30"
                  text="Bluetooth"
                  fontSize="18"
                  color="#FFFFFF" />
        <hg_switch id="switch_bluetooth" x="334" y="15" w="60" h="30"
                   checked="false"
                   onToggle="handleBluetoothToggle" />
      </hg_view>

      <!-- About -->
      <hg_button id="btn_about" x="20" y="380" w="414" h="60"
                 backgroundColor="#1E1E1E">
        <hg_image id="icon_about" x="0" y="5" w="50" h="50"
                  src="assets/icon_info.bin" />
        <hg_label id="lbl_about" x="70" y="15" w="200" h="30"
                  text="About"
                  fontSize="18"
                  color="#FFFFFF" />
      </hg_button>
    </hg_container>
  </view>
</hml>
```

---

## Media Player Controls

**Use Case**: Music/audio playback interface.

**Layout**: Centered album art, progress bar, and control buttons.

```xml
<?xml version="1.0" encoding="UTF-8"?>
<hml>
  <meta>
    <title>Music Player</title>
    <project>
      <resolution>454x454</resolution>
    </project>
  </meta>

  <view id="view_player">
    <!-- Background -->
    <hg_image id="img_bg" x="0" y="0" w="454" h="454"
              src="assets/bg_gradient.bin" />

    <!-- Album Art -->
    <hg_image id="img_album" x="127" y="80" w="200" h="200"
              src="assets/album_cover.bin"
              borderRadius="16" />

    <!-- Song Title -->
    <hg_label id="lbl_title" x="77" y="300" w="300" h="30"
              text="Song Title"
              fontSize="20"
              color="#FFFFFF"
              textAlign="center" />

    <!-- Artist Name -->
    <hg_label id="lbl_artist" x="77" y="335" w="300" h="25"
              text="Artist Name"
              fontSize="16"
              color="#CCCCCC"
              textAlign="center" />

    <!-- Progress Bar -->
    <hg_progressbar id="progress_time" x="77" y="375" w="300" h="4"
                    value="45"
                    color="#00FF88"
                    backgroundColor="#333333" />

    <!-- Time Labels -->
    <hg_label id="lbl_time_current" x="77" y="385" w="60" h="20"
              text="1:23"
              fontSize="12"
              color="#999999" />
    <hg_label id="lbl_time_total" x="317" y="385" w="60" h="20"
              text="3:05"
              fontSize="12"
              color="#999999"
              textAlign="right" />

    <!-- Control Buttons -->
    <hg_button id="btn_previous" x="107" y="410" w="50" h="50"
               src="assets/icon_previous.bin"
               onClick="handlePrevious" />

    <hg_button id="btn_play_pause" x="202" y="405" w="60" h="60"
               src="assets/icon_play.bin"
               onClick="handlePlayPause" />

    <hg_button id="btn_next" x="297" y="410" w="50" h="50"
               src="assets/icon_next.bin"
               onClick="handleNext" />
  </view>
</hml>
```

---

## Form / Input Screen

**Use Case**: User data entry (login, profile, registration).

**Layout**: Vertical form with input fields and submit button.

```xml
<?xml version="1.0" encoding="UTF-8"?>
<hml>
  <meta>
    <title>Login Form</title>
    <project>
      <resolution>454x454</resolution>
    </project>
  </meta>

  <view id="view_login">
    <!-- Background -->
    <hg_view id="view_bg" x="0" y="0" w="454" h="454"
             backgroundColor="#000000" />

    <!-- Logo -->
    <hg_image id="img_logo" x="177" y="60" w="100" h="100"
              src="assets/logo.bin" />

    <!-- Title -->
    <hg_label id="lbl_title" x="127" y="180" w="200" h="40"
              text="Welcome"
              fontSize="28"
              color="#FFFFFF"
              textAlign="center" />

    <!-- Username Input -->
    <hg_label id="lbl_username" x="77" y="240" w="300" h="25"
              text="Username"
              fontSize="14"
              color="#CCCCCC" />
    <hg_input id="input_username" x="77" y="270" w="300" h="40"
              placeholder="Enter username"
              fontSize="16"
              backgroundColor="#1E1E1E"
              color="#FFFFFF" />

    <!-- Password Input -->
    <hg_label id="lbl_password" x="77" y="330" w="300" h="25"
              text="Password"
              fontSize="14"
              color="#CCCCCC" />
    <hg_input id="input_password" x="77" y="360" w="300" h="40"
              placeholder="Enter password"
              fontSize="16"
              type="password"
              backgroundColor="#1E1E1E"
              color="#FFFFFF" />

    <!-- Remember Me -->
    <hg_checkbox id="chk_remember" x="77" y="420" w="200" h="25"
                 label="Remember me"
                 fontSize="14"
                 color="#CCCCCC" />

    <!-- Login Button -->
    <hg_button id="btn_login" x="127" y="470" w="200" h="44"
               text="Login"
               fontSize="18"
               color="#FFFFFF"
               backgroundColor="#0066CC"
               borderRadius="22"
               onClick="handleLogin" />
  </view>
</hml>
```

---

## Navigation Menu

**Use Case**: Main app menu with multiple options.

**Layout**: Vertical list or grid of navigation buttons.

```xml
<?xml version="1.0" encoding="UTF-8"?>
<hml>
  <meta>
    <title>Main Menu</title>
    <project>
      <resolution>454x454</resolution>
    </project>
  </meta>

  <view id="view_menu">
    <!-- Background -->
    <hg_image id="img_bg" x="0" y="0" w="454" h="454"
              src="assets/bg_menu.bin" />

    <!-- Title -->
    <hg_label id="lbl_title" x="127" y="40" w="200" h="40"
              text="Menu"
              fontSize="28"
              color="#FFFFFF"
              textAlign="center" />

    <!-- Menu Items (3x2 Grid) -->

    <!-- Row 1 -->
    <hg_button id="btn_health" x="57" y="120" w="120" h="120"
               backgroundColor="#FF0066"
               borderRadius="24"
               onClick="goToHealth">
      <hg_image id="icon_health" x="35" y="25" w="50" h="50"
                src="assets/icon_health.bin" />
      <hg_label id="lbl_health" x="0" y="85" w="120" h="25"
                text="Health"
                fontSize="16"
                color="#FFFFFF"
                textAlign="center" />
    </hg_button>

    <hg_button id="btn_fitness" x="277" y="120" w="120" h="120"
               backgroundColor="#00FF88"
               borderRadius="24"
               onClick="goToFitness">
      <hg_image id="icon_fitness" x="35" y="25" w="50" h="50"
                src="assets/icon_fitness.bin" />
      <hg_label id="lbl_fitness" x="0" y="85" w="120" h="25"
                text="Fitness"
                fontSize="16"
                color="#FFFFFF"
                textAlign="center" />
    </hg_button>

    <!-- Row 2 -->
    <hg_button id="btn_music" x="57" y="260" w="120" h="120"
               backgroundColor="#6688FF"
               borderRadius="24"
               onClick="goToMusic">
      <hg_image id="icon_music" x="35" y="25" w="50" h="50"
                src="assets/icon_music.bin" />
      <hg_label id="lbl_music" x="0" y="85" w="120" h="25"
                text="Music"
                fontSize="16"
                color="#FFFFFF"
                textAlign="center" />
    </hg_button>

    <hg_button id="btn_weather" x="277" y="260" w="120" h="120"
               backgroundColor="#FF8800"
               borderRadius="24"
               onClick="goToWeather">
      <hg_image id="icon_weather" x="35" y="25" w="50" h="50"
                src="assets/icon_weather.bin" />
      <hg_label id="lbl_weather" x="0" y="85" w="120" h="25"
                text="Weather"
                fontSize="16"
                color="#FFFFFF"
                textAlign="center" />
    </hg_button>

    <!-- Settings Button (Bottom) -->
    <hg_button id="btn_settings" x="177" y="400" w="100" h="40"
               text="Settings"
               fontSize="16"
               color="#FFFFFF"
               backgroundColor="#333333"
               borderRadius="20"
               onClick="goToSettings" />
  </view>
</hml>
```

---

## Notification Center

**Use Case**: Display list of notifications.

**Layout**: Scrollable list of notification cards.

```xml
<?xml version="1.0" encoding="UTF-8"?>
<hml>
  <meta>
    <title>Notifications</title>
    <project>
      <resolution>454x454</resolution>
    </project>
  </meta>

  <view id="view_notifications">
    <!-- Header -->
    <hg_view id="view_header" x="0" y="0" w="454" h="60"
             backgroundColor="#1E1E1E">
      <hg_label id="lbl_title" x="127" y="10" w="200" h="40"
                text="Notifications"
                fontSize="20"
                color="#FFFFFF"
                textAlign="center" />
    </hg_view>

    <!-- Notification List -->
    <hg_container id="cnt_notifications" x="0" y="60" w="454" h="394"
                  overflow="scroll">

      <!-- Notification 1 -->
      <hg_view id="notif_1" x="20" y="20" w="414" h="100"
               backgroundColor="#2A2A2A"
               borderRadius="12">
        <hg_image id="icon_notif_1" x="15" y="15" w="40" h="40"
                  src="assets/icon_message.bin" />
        <hg_label id="lbl_notif_1_title" x="65" y="15" w="329" h="25"
                  text="New Message"
                  fontSize="16"
                  color="#FFFFFF" />
        <hg_label id="lbl_notif_1_body" x="65" y="45" w="329" h="35"
                  text="You have a new message from John"
                  fontSize="14"
                  color="#CCCCCC" />
        <hg_label id="lbl_notif_1_time" x="65" y="75" w="329" h="20"
                  text="5 min ago"
                  fontSize="12"
                  color="#999999" />
      </hg_view>

      <!-- Notification 2 -->
      <hg_view id="notif_2" x="20" y="140" w="414" h="100"
               backgroundColor="#2A2A2A"
               borderRadius="12">
        <hg_image id="icon_notif_2" x="15" y="15" w="40" h="40"
                  src="assets/icon_calendar.bin" />
        <hg_label id="lbl_notif_2_title" x="65" y="15" w="329" h="25"
                  text="Calendar Event"
                  fontSize="16"
                  color="#FFFFFF" />
        <hg_label id="lbl_notif_2_body" x="65" y="45" w="329" h="35"
                  text="Meeting starts in 30 minutes"
                  fontSize="14"
                  color="#CCCCCC" />
        <hg_label id="lbl_notif_2_time" x="65" y="75" w="329" h="20"
                  text="25 min ago"
                  fontSize="12"
                  color="#999999" />
      </hg_view>

      <!-- More notifications... -->
    </hg_container>
  </view>
</hml>
```

---

## Activity Tracking

**Use Case**: Display fitness activity progress (steps, distance, calories).

**Layout**: Circular progress indicators with stats.

```xml
<?xml version="1.0" encoding="UTF-8"?>
<hml>
  <meta>
    <title>Activity</title>
    <project>
      <resolution>454x454</resolution>
    </project>
  </meta>

  <view id="view_activity">
    <!-- Background -->
    <hg_view id="view_bg" x="0" y="0" w="454" h="454"
             backgroundColor="#000000" />

    <!-- Title -->
    <hg_label id="lbl_title" x="127" y="30" w="200" h="40"
              text="Activity"
              fontSize="24"
              color="#FFFFFF"
              textAlign="center" />

    <!-- Main Metric (Steps) - Central Circle -->
    <hg_canvas id="canvas_steps_ring" x="127" y="90" w="200" h="200" />

    <hg_label id="lbl_steps_value" x="177" y="160" w="100" h="50"
              text="8,542"
              fontSize="36"
              color="#00FF88"
              textAlign="center" />
    <hg_label id="lbl_steps_label" x="177" y="210" w="100" h="25"
              text="steps"
              fontSize="16"
              color="#999999"
              textAlign="center" />

    <!-- Sub Metrics -->
    <hg_view id="view_distance" x="57" y="320" w="120" h="100">
      <hg_image id="icon_distance" x="35" y="0" w="50" h="50"
                src="assets/icon_distance.bin" />
      <hg_label id="lbl_distance_value" x="0" y="55" w="120" h="30"
                text="5.2"
                fontSize="24"
                color="#FFFFFF"
                textAlign="center" />
      <hg_label id="lbl_distance_unit" x="0" y="80" w="120" h="20"
                text="km"
                fontSize="14"
                color="#999999"
                textAlign="center" />
    </hg_view>

    <hg_view id="view_calories" x="277" y="320" w="120" h="100">
      <hg_image id="icon_calories" x="35" y="0" w="50" h="50"
                src="assets/icon_calories.bin" />
      <hg_label id="lbl_calories_value" x="0" y="55" w="120" h="30"
                text="420"
                fontSize="24"
                color="#FFFFFF"
                textAlign="center" />
      <hg_label id="lbl_calories_unit" x="0" y="80" w="120" h="20"
                text="Cal"
                fontSize="14"
                color="#999999"
                textAlign="center" />
    </hg_view>
  </view>
</hml>
```

---

## Timer / Stopwatch

**Use Case**: Countdown timer or stopwatch functionality.

**Layout**: Large time display with start/stop/reset controls.

```xml
<?xml version="1.0" encoding="UTF-8"?>
<hml>
  <meta>
    <title>Stopwatch</title>
    <project>
      <resolution>454x454</resolution>
    </project>
  </meta>

  <view id="view_stopwatch">
    <!-- Background -->
    <hg_view id="view_bg" x="0" y="0" w="454" h="454"
             backgroundColor="#000000" />

    <!-- Title -->
    <hg_label id="lbl_title" x="127" y="50" w="200" h="40"
              text="Stopwatch"
              fontSize="24"
              color="#FFFFFF"
              textAlign="center" />

    <!-- Time Display (Timer Label) -->
    <hg_label id="lbl_timer" x="77" y="150" w="300" h="100"
              text="00:00.00"
              isTimerLabel="true"
              timerType="stopwatch"
              timerFormat="MM:SS:MS"
              timerAutoStart="false"
              fontSize="60"
              color="#00FF88"
              textAlign="center" />

    <!-- Lap Times (Optional) -->
    <hg_container id="cnt_laps" x="77" y="270" w="300" h="100"
                  overflow="scroll">
      <!-- Lap time labels would be dynamically added -->
    </hg_container>

    <!-- Control Buttons -->
    <hg_button id="btn_start_stop" x="127" y="390" w="80" h="80"
               src="assets/icon_play.bin"
               onClick="handleStartStop" />

    <hg_button id="btn_reset" x="247" y="390" w="80" h="80"
               src="assets/icon_reset.bin"
               onClick="handleReset" />
  </view>
</hml>
```

---

## Grid Menu

**Use Case**: App launcher or feature selection with many options.

**Layout**: 3x3 or 4x4 grid of icon buttons.

```xml
<?xml version="1.0" encoding="UTF-8"?>
<hml>
  <meta>
    <title>App Grid</title>
    <project>
      <resolution>454x454</resolution>
    </project>
  </meta>

  <view id="view_grid">
    <!-- Background -->
    <hg_view id="view_bg" x="0" y="0" w="454" h="454"
             backgroundColor="#000000" />

    <!-- Grid (3x3) -->
    <hg_grid id="grid_apps" x="57" y="77" w="340" h="340"
             rows="3" columns="3" spacing="20">

      <hg_button id="btn_app_1" w="100" h="100"
                 src="assets/app_icon_1.bin"
                 onClick="openApp1" />
      <hg_button id="btn_app_2" w="100" h="100"
                 src="assets/app_icon_2.bin"
                 onClick="openApp2" />
      <hg_button id="btn_app_3" w="100" h="100"
                 src="assets/app_icon_3.bin"
                 onClick="openApp3" />
      <hg_button id="btn_app_4" w="100" h="100"
                 src="assets/app_icon_4.bin"
                 onClick="openApp4" />
      <hg_button id="btn_app_5" w="100" h="100"
                 src="assets/app_icon_5.bin"
                 onClick="openApp5" />
      <hg_button id="btn_app_6" w="100" h="100"
                 src="assets/app_icon_6.bin"
                 onClick="openApp6" />
      <hg_button id="btn_app_7" w="100" h="100"
                 src="assets/app_icon_7.bin"
                 onClick="openApp7" />
      <hg_button id="btn_app_8" w="100" h="100"
                 src="assets/app_icon_8.bin"
                 onClick="openApp8" />
      <hg_button id="btn_app_9" w="100" h="100"
                 src="assets/app_icon_9.bin"
                 onClick="openApp9" />
    </hg_grid>
  </view>
</hml>
```

---

## Carousel / Swipe Pages

**Use Case**: Multiple pages that can be swiped horizontally.

**Layout**: Multiple views at different x positions (swipe handled by gestures).

```xml
<?xml version="1.0" encoding="UTF-8"?>
<hml>
  <meta>
    <title>Carousel</title>
    <project>
      <resolution>454x454</resolution>
    </project>
  </meta>

  <view id="view_main">
    <!-- Container for swipe pages -->
    <hg_container id="cnt_carousel" x="0" y="0" w="1362" h="454">

      <!-- Page 1 -->
      <hg_view id="page_1" x="0" y="0" w="454" h="454"
               backgroundColor="#FF0066">
        <hg_label id="lbl_page_1" x="127" y="207" w="200" h="40"
                  text="Page 1"
                  fontSize="28"
                  color="#FFFFFF"
                  textAlign="center" />
      </hg_view>

      <!-- Page 2 -->
      <hg_view id="page_2" x="454" y="0" w="454" h="454"
               backgroundColor="#00FF88">
        <hg_label id="lbl_page_2" x="127" y="207" w="200" h="40"
                  text="Page 2"
                  fontSize="28"
                  color="#FFFFFF"
                  textAlign="center" />
      </hg_view>

      <!-- Page 3 -->
      <hg_view id="page_3" x="908" y="0" w="454" h="454"
               backgroundColor="#6688FF">
        <hg_label id="lbl_page_3" x="127" y="207" w="200" h="40"
                  text="Page 3"
                  fontSize="28"
                  color="#FFFFFF"
                  textAlign="center" />
      </hg_view>
    </hg_container>

    <!-- Page Indicators -->
    <hg_view id="view_indicators" x="177" y="414" w="100" h="20">
      <hg_view id="indicator_1" x="0" y="5" w="10" h="10"
               backgroundColor="#FFFFFF"
               borderRadius="5" />
      <hg_view id="indicator_2" x="20" y="5" w="10" h="10"
               backgroundColor="#666666"
               borderRadius="5" />
      <hg_view id="indicator_3" x="40" y="5" w="10" h="10"
               backgroundColor="#666666"
               borderRadius="5" />
    </hg_view>
  </view>
</hml>
```

---

## Pattern Selection Guide

| Use Case | Recommended Pattern |
|----------|-------------------|
| Overview of multiple metrics | Dashboard |
| Configuration/preferences | Settings List |
| Audio/video playback | Media Player Controls |
| Data entry | Form / Input Screen |
| App launcher | Navigation Menu or Grid Menu |
| Message/alert list | Notification Center |
| Fitness tracking | Activity Tracking |
| Time measurement | Timer / Stopwatch |
| Multiple content pages | Carousel / Swipe Pages |

## General Layout Tips

1. **Hierarchy**: Use visual hierarchy (size, color, position) to guide attention
2. **Spacing**: Consistent margins and padding (20px, 40px common)
3. **Alignment**: Align elements to a grid for visual order
4. **Touch Targets**: Minimum 44x44px for interactive elements
5. **Feedback**: Always provide visual feedback for interactions
6. **Readability**: High contrast, appropriate font sizes (≥16px)
7. **Balance**: Distribute visual weight evenly
8. **Consistency**: Reuse patterns across similar screens
