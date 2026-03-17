/** 地图工具面板 HTML 生成器 */
export function getMapToolsPanelHtml(): string {
    return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Map Tools</title>
    <!-- Leaflet CSS from CDN -->
    <link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css" />
    <!-- Custom Styles -->
    <style>${getStyles()}</style>
</head>
<body>
    ${getHtmlContent()}
    <!-- Leaflet JS from CDN -->
    <script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
    <!-- Custom Script -->
    <script>${getScript()}</script>
</body>
</html>`;
}

function getHtmlContent(): string {
    return `
<div class="container">
    <!-- 顶部工具栏 -->
    <div class="toolbar">
        <div class="toolbar-left">
            <label>Go to City:</label>
            <select id="citySelect">
                <option value="">Select a city...</option>
                <option value="31.30,120.58,12">Suzhou</option>
                <option value="31.23,121.47,11">Shanghai</option>
                <option value="39.90,116.40,11">Beijing</option>
                <option value="30.27,120.15,12">Hangzhou</option>
                <option value="32.06,118.79,12">Nanjing</option>
                <option value="22.54,114.06,12">Shenzhen</option>
                <option value="23.13,113.26,11">Guangzhou</option>
                <option value="30.57,104.07,12">Chengdu</option>
                <option value="30.59,114.30,12">Wuhan</option>
                <option value="34.26,108.94,12">Xi'an</option>
                <option value="35.68,139.69,11">Tokyo</option>
                <option value="40.71,-74.01,11">New York</option>
                <option value="51.51,-0.13,11">London</option>
                <option value="48.86,2.35,12">Paris</option>
            </select>
            <label>Lat:</label>
            <input type="number" id="latInput" step="0.01" value="31.30">
            <label>Lon:</label>
            <input type="number" id="lonInput" step="0.01" value="120.58">
            <button id="gotoBtn">Go</button>
        </div>
        <div class="toolbar-right">
            <button id="selectDownloadBtn">📥 Download Region</button>
            <button id="selectConvertBtn">🔄 Convert Region</button>
            <button id="clearSelectionBtn">✖ Clear</button>
        </div>
    </div>
    <!-- 地图源工具栏 -->
    <div class="toolbar toolbar-secondary">
        <div class="toolbar-left">
            <label>Map Source:</label>
            <select id="tileServerSelect">
                <option value="https://mt1.google.com/vt/lyrs=m&x={x}&y={y}&z={z}">Google Maps</option>
                <option value="https://mt1.google.com/vt/lyrs=s&x={x}&y={y}&z={z}">Google Satellite</option>
                <option value="https://mt1.google.com/vt/lyrs=y&x={x}&y={y}&z={z}">Google Hybrid</option>
                <option value="https://tile.openstreetmap.org/{z}/{x}/{y}.png">OpenStreetMap</option>
                <option value="https://webrd01.is.autonavi.com/appmaptile?lang=zh_cn&size=1&scale=1&style=8&x={x}&y={y}&z={z}">Amap Maps</option>
                <option value="https://webst01.is.autonavi.com/appmaptile?style=6&x={x}&y={y}&z={z}">Amap Satellite</option>
                <option value="https://a.basemaps.cartocdn.com/light_all/{z}/{x}/{y}.png">CARTO Light</option>
                <option value="https://a.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}.png">CARTO Dark</option>
                <option value="https://a.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}.png">CARTO Voyager</option>
            </select>
            <button id="refreshMapBtn">Refresh Map</button>
            <span style="color: gray; font-size: 11px; margin-left: 8px;">💡 If map doesn't display, try switching map source</span>
        </div>
    </div>

    <!-- 主内容：地图 + 侧边栏 -->
    <div class="main-layout">
        <!-- 左侧地图 -->
        <div class="map-container">
            <div id="map"></div>
            <div id="positionLabel" class="position-label">Position: ---, ---</div>
        </div>

        <!-- 右侧控制面板 -->
        <div class="control-panel">
            <div class="tabs">
                <button class="tab-button active" data-tab="download">Download</button>
                <button class="tab-button" data-tab="convert">Convert</button>
                <button class="tab-button" data-tab="log">Log</button>
            </div>

            <!-- Download Tab -->
            <div id="downloadTab" class="tab-content active">
                <div class="section">
                    <h3>Download Region</h3>
                    <div id="downloadRegionInfo" class="info-box">
                        No region selected
                    </div>
                </div>
                <div class="section">
                    <h3>Download Features</h3>
                    <label><input type="checkbox" id="roadsCheck" checked> Roads</label>
                    <label><input type="checkbox" id="waterCheck" checked> Water</label>
                    <label><input type="checkbox" id="parksCheck" checked> Parks</label>
                    <label><input type="checkbox" id="buildingsCheck"> Buildings</label>
                </div>
                <div class="section">
                    <h3>Chunked Download Settings</h3>
                    <label>
                        <input type="checkbox" id="chunkedEnabledCheck" checked>
                        Enable chunked download (recommended for large areas)
                    </label>
                    <div class="setting-row">
                        <label>Chunk size (degrees):</label>
                        <input type="number" id="chunkSizeInput" value="0.02" step="0.01" min="0.01" max="0.5">
                    </div>
                    <div class="setting-row">
                        <label>Max retries per chunk:</label>
                        <input type="number" id="maxRetriesInput" value="3" min="1" max="10">
                    </div>
                    <label>
                        <input type="checkbox" id="useCacheCheck">
                        Use cache (retry only failed chunks)
                    </label>
                    <button id="cleanCacheBtn" class="secondary-button" style="margin-top: 10px">Clean Cache</button>
                    <p class="hint">Tip: Chunked download splits large areas into smaller parts. Enable cache to skip successfully downloaded chunks on retry.</p>
                </div>
                <div class="section">
                    <h3>Output Directory</h3>
                    <div class="file-select">
                        <input type="text" id="downloadOutputDir" readonly placeholder="Not Selected">
                        <button id="selectDownloadDirBtn">Browse</button>
                    </div>
                </div>
                <div class="section">
                    <button id="startDownloadBtn" class="primary-button" disabled>Start Download</button>
                    <div id="downloadProgress" class="progress-container" style="display:none">
                        <div class="progress-bar">
                            <div id="downloadProgressBar" class="progress-fill"></div>
                        </div>
                        <div class="progress-info">
                            <span id="downloadProgressPercent" class="progress-text">0%</span>
                            <span id="downloadProgressSpeed" class="progress-speed"></span>
                        </div>
                        <div id="downloadProgressPhase" class="progress-phase"></div>
                    </div>
                </div>
            </div>

            <!-- Convert Tab -->
            <div id="convertTab" class="tab-content">
                <div class="section">
                    <h3>Input File</h3>
                    <div class="file-select">
                        <input type="text" id="convertInputFile" readonly placeholder="Select OSM File">
                        <button id="selectInputFileBtn">Browse</button>
                    </div>
                </div>
                <div class="section">
                    <h3>Convert Features</h3>
                    <label><input type="checkbox" id="convertRoadsCheck" checked> Roads</label>
                    <label><input type="checkbox" id="convertWaterCheck" checked> Water</label>
                    <label><input type="checkbox" id="convertParksCheck" checked> Parks</label>
                    <label><input type="checkbox" id="convertBuildingsCheck"> Buildings</label>
                    <label><input type="checkbox" id="convertLabelsCheck" checked> Labels</label>
                </div>
                <div class="section">
                    <h3>Simplification Settings</h3>
                    <div class="setting-row">
                        <label>Polygon simplification (m):</label>
                        <input type="number" id="simplifyPolyInput" value="20" min="0" max="100">
                    </div>
                    <div class="setting-row">
                        <label>Road simplification (m):</label>
                        <input type="number" id="simplifyRoadsInput" value="5" min="0" max="50">
                    </div>
                    <p class="hint">Tip: 0 = no simplification. Recommended: Poly 20-50, Road 5-20</p>
                </div>
                <div class="section">
                    <h3>Convert Region (Optional)</h3>
                    <div id="convertRegionInfo" class="info-box">
                        No region selected (will convert entire file)
                    </div>
                </div>
                <div class="section">
                    <h3>Output Directory</h3>
                    <div class="file-select">
                        <input type="text" id="convertOutputDir" readonly placeholder="Not Selected">
                        <button id="selectConvertDirBtn">Browse</button>
                    </div>
                </div>
                <div class="section">
                    <button id="startConvertBtn" class="primary-button" disabled>Start Convert</button>
                    <div id="convertProgress" class="progress-container" style="display:none">
                        <div class="progress-bar">
                            <div id="convertProgressBar" class="progress-fill"></div>
                        </div>
                        <div class="progress-info">
                            <span id="convertProgressPercent" class="progress-text">0%</span>
                        </div>
                        <div id="convertProgressText" class="progress-phase"></div>
                    </div>
                </div>
            </div>

            <!-- Log Tab -->
            <div id="logTab" class="tab-content">
                <div class="log-container">
                    <div class="log-header">
                        <h3>Activity Log</h3>
                        <button id="clearLogBtn" class="small-button">Clear</button>
                    </div>
                    <div id="logOutput" class="log-output"></div>
                </div>
            </div>
        </div>
    </div>
</div>
`;
}

function getStyles(): string {
    return `
/* ============================================
   CARTOGRAPHIC ELEGANCE DESIGN SYSTEM
   Theme: Dark mode map-making aesthetic
   ============================================ */

/* CSS Custom Properties - Design Tokens */
:root {
    /* Color Palette - Refined Earth Tones */
    --color-charcoal: #1a1d23;
    --color-charcoal-light: #252932;
    --color-bronze: #a88f75;           /* Muted bronze - primary accent */
    --color-bronze-dark: #8b7963;      /* Dark bronze - borders */
    --color-bronze-bright: #c4a88a;    /* Light bronze - hover highlights */
    --color-steel-blue: #7b9eb0;       /* Steel blue - active states */
    --color-steel-blue-dark: #5a7a8a;  /* Dark steel blue */
    --color-teal: #4ecdc4;
    --color-teal-dark: #3db5ad;
    --color-coral: #e07a5f;
    --color-offwhite: #e8e6e3;
    --color-gray: #8b8b8b;
    --color-gray-dark: #4a4a4a;
    
    /* Typography */
    --font-mono: 'IBM Plex Mono', 'Consolas', 'Courier New', monospace;
    --font-body: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', system-ui, sans-serif;
    
    /* Spacing Scale */
    --space-xs: 4px;
    --space-sm: 8px;
    --space-md: 12px;
    --space-lg: 16px;
    --space-xl: 24px;
    
    /* Shadows - Layered map sheet effect */
    --shadow-sm: 0 2px 4px rgba(0,0,0,0.3);
    --shadow-md: 0 4px 8px rgba(0,0,0,0.4), 0 2px 4px rgba(0,0,0,0.2);
    --shadow-lg: 0 8px 16px rgba(0,0,0,0.5), 0 4px 8px rgba(0,0,0,0.3);
    
    /* Transitions */
    --transition-fast: 0.15s cubic-bezier(0.4, 0, 0.2, 1);
    --transition-smooth: 0.3s cubic-bezier(0.4, 0, 0.2, 1);
}

/* Topographic Background Pattern */
@keyframes topographicFlow {
    0% { background-position: 0 0; }
    100% { background-position: 100px 100px; }
}

/* Progress Bar Animation - Drawing Map Lines */
@keyframes drawMapLine {
    0% { 
        background-size: 0% 100%;
        opacity: 0.8;
    }
    50% { opacity: 1; }
    100% { 
        background-size: 100% 100%;
        opacity: 0.95;
    }
}

/* Compass Rose Rotation */
@keyframes compassRotate {
    0% { transform: rotate(0deg); }
    100% { transform: rotate(360deg); }
}

/* Base Reset */
* { 
    margin: 0; 
    padding: 0; 
    box-sizing: border-box; 
}

/* Body - Deep Charcoal with Subtle Texture */
body {
    font-family: var(--font-body);
    color: var(--color-offwhite);
    background: 
        linear-gradient(135deg, var(--color-charcoal) 0%, #15171c 100%);
    overflow: hidden;
    font-variant-numeric: tabular-nums;
    -webkit-font-smoothing: antialiased;
    position: relative;
}

body::before {
    content: '';
    position: absolute;
    top: 0; left: 0; right: 0; bottom: 0;
    background-image: 
        repeating-linear-gradient(0deg, transparent, transparent 2px, rgba(168,143,117,0.02) 2px, rgba(168,143,117,0.02) 4px),
        repeating-linear-gradient(90deg, transparent, transparent 2px, rgba(168,143,117,0.02) 2px, rgba(168,143,117,0.02) 4px);
    pointer-events: none;
    opacity: 0.4;
}

.container { 
    display: flex; 
    flex-direction: column; 
    height: 100vh;
    position: relative;
    z-index: 1;
}

/* ============================================
   TOOLBAR - Navigation Header
   ============================================ */
.toolbar {
    display: flex;
    justify-content: space-between;
    padding: var(--space-md) var(--space-lg);
    background: linear-gradient(180deg, #22252e 0%, var(--color-charcoal-light) 100%);
    border-bottom: 2px solid var(--color-bronze-dark);
    border-bottom-style: double;
    flex-shrink: 0;
    box-shadow: var(--shadow-md);
    position: relative;
}

.toolbar::after {
    content: '';
    position: absolute;
    bottom: -2px;
    left: 0;
    right: 0;
    height: 1px;
    background: linear-gradient(90deg, 
        transparent 0%, 
        var(--color-bronze) 20%, 
        var(--color-bronze) 80%, 
        transparent 100%
    );
}

.toolbar-secondary {
    background: var(--color-charcoal);
    border-bottom: 1px solid rgba(168,143,117,0.2);
    padding: var(--space-sm) var(--space-lg);
}

.toolbar-left, .toolbar-right { 
    display: flex; 
    align-items: center; 
    gap: var(--space-md); 
}

.toolbar label { 
    font-size: 11px; 
    font-family: var(--font-mono);
    text-transform: uppercase;
    letter-spacing: 0.8px;
    white-space: nowrap;
    color: var(--color-steel-blue);
    font-weight: 600;
}

.toolbar input, .toolbar select {
    background: rgba(255,255,255,0.05);
    color: var(--color-offwhite);
    border: 1px solid rgba(168,143,117,0.3);
    padding: 6px var(--space-md);
    font-size: 12px;
    font-family: var(--font-mono);
    border-radius: 3px;
    transition: all var(--transition-fast);
    backdrop-filter: blur(10px);
}

.toolbar input:focus, .toolbar select:focus {
    outline: none;
    border-color: var(--color-steel-blue);
    background: rgba(255,255,255,0.08);
    box-shadow: 0 0 0 3px rgba(123,158,176,0.2);
}

.toolbar input:hover, .toolbar select:hover {
    border-color: var(--color-bronze);
}

.toolbar input[type="number"] { 
    width: 90px; 
}

.toolbar select { 
    max-width: 160px;
    cursor: pointer;
}

/* Toolbar Buttons */
.toolbar button {
    padding: 6px var(--space-lg);
    background: linear-gradient(135deg, var(--color-steel-blue-dark) 0%, var(--color-steel-blue) 100%);
    color: var(--color-offwhite);
    border: 1px solid var(--color-steel-blue);
    cursor: pointer;
    border-radius: 4px;
    font-size: 11px;
    font-family: var(--font-mono);
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.5px;
    transition: all var(--transition-fast);
    box-shadow: var(--shadow-sm);
    position: relative;
    overflow: hidden;
}

.toolbar button::before {
    content: '';
    position: absolute;
    top: 0; left: -100%; right: 100%;
    height: 100%;
    background: linear-gradient(90deg, transparent, rgba(255,255,255,0.3), transparent);
    transition: left 0.5s;
}

.toolbar button:hover {
    background: linear-gradient(135deg, var(--color-steel-blue) 0%, var(--color-bronze) 100%);
    color: var(--color-charcoal);
    box-shadow: var(--shadow-md), 0 0 15px rgba(123,158,176,0.3);
    transform: translateY(-1px);
}

.toolbar button:hover::before {
    left: 100%;
}

.toolbar button:active {
    transform: translateY(0);
    box-shadow: var(--shadow-sm);
}

/* ============================================
   MAIN LAYOUT
   ============================================ */
.main-layout { 
    display: flex; 
    flex: 1; 
    overflow: hidden;
    gap: 0;
}

/* ============================================
   MAP CONTAINER
   ============================================ */
.map-container {
    flex: 3;
    position: relative;
    display: flex;
    flex-direction: column;
    overflow: hidden;
    border-right: 2px solid rgba(168,143,117,0.2);
}

#map { 
    flex: 1; 
    background: #e5e3df;
    position: relative;
}

/* Position Label - Coordinate Display */
.position-label {
    position: absolute;
    bottom: var(--space-lg);
    right: var(--space-lg);
    background: rgba(26,29,35,0.98);
    padding: var(--space-sm) var(--space-md);
    border-radius: 4px;
    font-size: 11px;
    font-family: var(--font-mono);
    z-index: 1000;
    border: 1px solid var(--color-bronze-dark);
    box-shadow: var(--shadow-md);
    color: var(--color-steel-blue);
    letter-spacing: 0.5px;
    backdrop-filter: blur(10px);
}

/* ============================================
   CONTROL PANEL - Right Sidebar
   ============================================ */
.control-panel {
    flex: 1;
    display: flex;
    flex-direction: column;
    background: var(--color-charcoal);
    overflow-y: auto;
    min-width: 300px;
    max-width: 360px;
    box-shadow: inset 4px 0 8px rgba(0,0,0,0.3);
    position: relative;
}

.control-panel::before {
    content: '';
    position: absolute;
    top: 0; left: 0;
    width: 100%; height: 100%;
    background-image: 
        repeating-linear-gradient(0deg, transparent, transparent 20px, rgba(168,143,117,0.03) 20px, rgba(168,143,117,0.03) 40px);
    pointer-events: none;
}

/* ============================================
   TABS - Map Legend Style
   ============================================ */
.tabs {
    display: flex;
    border-bottom: 2px solid rgba(168,143,117,0.3);
    flex-shrink: 0;
    background: var(--color-charcoal-light);
    position: relative;
    z-index: 2;
}

.tab-button {
    flex: 1;
    padding: var(--space-md);
    background: transparent;
    color: var(--color-gray);
    border: none;
    cursor: pointer;
    font-size: 12px;
    font-family: var(--font-mono);
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 1px;
    transition: all var(--transition-smooth);
    position: relative;
}

.tab-button::before {
    content: '';
    position: absolute;
    bottom: 0; left: 50%;
    width: 0%;
    height: 2px;
    background: var(--color-steel-blue);
    transform: translateX(-50%);
    transition: width var(--transition-smooth);
}

.tab-button:hover { 
    background: rgba(168,143,117,0.05);
    color: var(--color-bronze);
}

.tab-button.active {
    background: rgba(168,143,117,0.1);
    color: var(--color-bronze);
}

.tab-button.active::before {
    width: 80%;
}

.tab-content { 
    display: none; 
    padding: var(--space-xl);
    position: relative;
    z-index: 1;
}

.tab-content.active { 
    display: block; 
    animation: fadeIn 0.3s ease-out;
}

@keyframes fadeIn {
    from { opacity: 0; transform: translateY(10px); }
    to { opacity: 1; transform: translateY(0); }
}

/* ============================================
   SECTIONS - Grouped Controls
   ============================================ */
.section { 
    margin-bottom: var(--space-xl);
    padding: var(--space-lg);
    background: rgba(255,255,255,0.02);
    border: 1px solid rgba(168,143,117,0.15);
    border-radius: 6px;
    box-shadow: var(--shadow-sm);
    position: relative;
}

.section::before {
    content: '';
    position: absolute;
    top: 0; left: 0;
    width: 4px; height: 100%;
    background: linear-gradient(180deg, var(--color-steel-blue) 0%, transparent 100%);
    border-radius: 6px 0 0 6px;
}

.section h3 {
    font-size: 13px;
    margin-bottom: var(--space-md);
    color: var(--color-bronze);
    font-weight: 700;
    font-family: var(--font-mono);
    text-transform: uppercase;
    letter-spacing: 1.2px;
    padding-bottom: var(--space-sm);
    border-bottom: 1px solid rgba(168,143,117,0.2);
}

.section label {
    display: block;
    margin-bottom: var(--space-sm);
    font-size: 12px;
    cursor: pointer;
    transition: color var(--transition-fast);
    color: var(--color-offwhite);
    font-family: var(--font-body);
}

.section label:hover { 
    color: var(--color-teal); 
}

.section input[type="checkbox"] { 
    margin-right: var(--space-sm); 
    cursor: pointer;
    accent-color: var(--color-teal);
}

/* Setting Rows */
.setting-row {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin: var(--space-sm) 0;
    padding: var(--space-sm);
    background: rgba(0,0,0,0.2);
    border-radius: 4px;
}

.setting-row label {
    font-size: 11px;
    display: inline;
    margin: 0;
    color: var(--color-steel-blue);
    font-family: var(--font-mono);
}

.setting-row input[type="number"] {
    width: 80px;
    padding: 6px;
    background: rgba(255,255,255,0.05);
    color: var(--color-offwhite);
    border: 1px solid rgba(168,143,117,0.3);
    border-radius: 3px;
    font-family: var(--font-mono);
    transition: all var(--transition-fast);
}

.setting-row input[type="number"]:focus {
    outline: none;
    border-color: var(--color-teal);
    background: rgba(255,255,255,0.08);
    box-shadow: 0 0 0 3px rgba(78,205,196,0.15);
}

/* Hints */
.hint {
    margin-top: var(--space-md);
    font-size: 10px;
    color: var(--color-gray);
    line-height: 1.5;
    font-style: italic;
    padding-left: var(--space-md);
    border-left: 2px solid rgba(168,143,117,0.2);
}

/* ============================================
   FILE SELECTION
   ============================================ */
.file-select {
    display: flex;
    gap: var(--space-sm);
}

.file-select input {
    flex: 1;
    padding: var(--space-sm) var(--space-md);
    background: rgba(0,0,0,0.3);
    color: var(--color-offwhite);
    border: 1px solid rgba(168,143,117,0.3);
    font-size: 11px;
    font-family: var(--font-mono);
    border-radius: 4px;
    transition: all var(--transition-fast);
}

.file-select input:focus {
    outline: none;
    border-color: var(--color-steel-blue);
    background: rgba(0,0,0,0.4);
}

.file-select button {
    padding: var(--space-sm) var(--space-lg);
    background: linear-gradient(135deg, rgba(168,143,117,0.2) 0%, rgba(168,143,117,0.3) 100%);
    color: var(--color-bronze);
    border: 1px solid var(--color-steel-blue);
    cursor: pointer;
    font-size: 11px;
    font-family: var(--font-mono);
    font-weight: 600;
    border-radius: 4px;
    transition: all var(--transition-fast);
}

.file-select button:hover { 
    background: linear-gradient(135deg, var(--color-steel-blue) 0%, var(--color-bronze) 100%);
    color: var(--color-charcoal);
    box-shadow: var(--shadow-sm);
}

/* ============================================
   BUTTONS
   ============================================ */
.primary-button {
    width: 100%;
    padding: var(--space-md);
    background: linear-gradient(135deg, var(--color-teal-dark) 0%, var(--color-teal) 100%);
    color: var(--color-charcoal);
    border: none;
    cursor: pointer;
    font-size: 13px;
    font-family: var(--font-mono);
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 1px;
    border-radius: 6px;
    transition: all var(--transition-smooth);
    box-shadow: var(--shadow-md);
    position: relative;
    overflow: hidden;
}

.primary-button::after {
    content: '';
    position: absolute;
    top: 50%; left: 50%;
    width: 0; height: 0;
    background: rgba(255,255,255,0.3);
    border-radius: 50%;
    transform: translate(-50%, -50%);
    transition: width 0.5s, height 0.5s;
}

.primary-button:hover::after {
    width: 400px;
    height: 400px;
}

.primary-button:hover { 
    background: linear-gradient(135deg, var(--color-teal) 0%, #6fe5dc 100%);
    box-shadow: var(--shadow-lg), 0 0 20px rgba(78,205,196,0.4);
    transform: translateY(-2px);
}

.primary-button:active {
    transform: translateY(0);
}

.primary-button:disabled {
    opacity: 0.3;
    cursor: not-allowed;
    background: rgba(139,139,139,0.2);
    color: var(--color-gray-dark);
    box-shadow: none;
}

.primary-button:disabled:hover {
    transform: none;
}

.secondary-button {
    width: 100%;
    padding: var(--space-sm) var(--space-md);
    background: rgba(224,122,95,0.15);
    color: var(--color-coral);
    border: 1px solid var(--color-coral);
    cursor: pointer;
    font-size: 11px;
    font-family: var(--font-mono);
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.8px;
    border-radius: 4px;
    transition: all var(--transition-fast);
}

.secondary-button:hover {
    background: var(--color-coral);
    color: var(--color-charcoal);
    box-shadow: var(--shadow-sm);
}

/* ============================================
   INFO BOX - Coordinate Display
   ============================================ */
.info-box {
    padding: var(--space-md);
    background: rgba(0,0,0,0.4);
    border: 1px solid rgba(168,143,117,0.3);
    border-left: 3px solid var(--color-steel-blue);
    font-size: 11px;
    color: var(--color-bronze);
    white-space: pre-wrap;
    font-family: var(--font-mono);
    border-radius: 4px;
    box-shadow: inset 0 1px 3px rgba(0,0,0,0.3);
    letter-spacing: 0.3px;
    line-height: 1.6;
}

/* ============================================
   PROGRESS BARS - Topographic Animation
   ============================================ */
.progress-container { 
    margin-top: var(--space-md);
}

.progress-bar {
    height: 24px;
    background: rgba(0,0,0,0.4);
    border-radius: 6px;
    overflow: hidden;
    border: 1px solid rgba(168,143,117,0.3);
    box-shadow: inset 0 2px 4px rgba(0,0,0,0.3);
    position: relative;
}

.progress-bar::before {
    content: '';
    position: absolute;
    top: 0; left: 0; right: 0; bottom: 0;
    background-image: repeating-linear-gradient(
        45deg,
        transparent,
        transparent 10px,
        rgba(255,255,255,0.02) 10px,
        rgba(255,255,255,0.02) 20px
    );
    pointer-events: none;
}

.progress-fill {
    height: 100%;
    background: linear-gradient(90deg, 
        var(--color-teal-dark) 0%, 
        var(--color-teal) 50%, 
        var(--color-teal-dark) 100%
    );
    background-size: 200% 100%;
    animation: progressShimmer 2s linear infinite, drawMapLine 0.8s ease-out;
    position: relative;
    border-radius: 5px;
    box-shadow: 0 0 10px rgba(78,205,196,0.5);
}

@keyframes progressShimmer {
    0% { background-position: 200% 0; }
    100% { background-position: -200% 0; }
}

.progress-fill::after {
    content: '';
    position: absolute;
    top: 0; left: 0; right: 0; bottom: 0;
    background-image: repeating-linear-gradient(
        90deg,
        transparent,
        transparent 15px,
        rgba(255,255,255,0.1) 15px,
        rgba(255,255,255,0.1) 30px
    );
}

.progress-text {
    margin-top: var(--space-sm);
    font-size: 12px;
    font-family: var(--font-mono);
    font-weight: 700;
    color: var(--color-teal);
}

.progress-info {
    display: flex;
    justify-content: space-between;
    margin-top: var(--space-sm);
}

.progress-speed {
    font-size: 10px;
    font-family: var(--font-mono);
    color: var(--color-gray);
}

.progress-phase {
    margin-top: var(--space-xs);
    font-size: 10px;
    font-family: var(--font-mono);
    color: var(--color-bronze);
    font-style: italic;
}

/* ============================================
   LOG PANEL
   ============================================ */
.log-container {
    display: flex;
    flex-direction: column;
    height: calc(100vh - 200px);
}

.log-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: var(--space-md);
    padding-bottom: var(--space-sm);
    border-bottom: 1px solid rgba(168,143,117,0.2);
}

.log-header h3 {
    margin: 0;
    font-family: var(--font-mono);
    color: var(--color-bronze);
}

.small-button {
    padding: 6px var(--space-md);
    font-size: 10px;
    font-family: var(--font-mono);
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.5px;
    background: rgba(224,122,95,0.2);
    color: var(--color-coral);
    border: 1px solid var(--color-coral);
    cursor: pointer;
    border-radius: 3px;
    transition: all var(--transition-fast);
}

.small-button:hover {
    background: var(--color-coral);
    color: var(--color-charcoal);
}

.log-output {
    flex: 1;
    overflow-y: auto;
    background: rgba(0,0,0,0.5);
    border: 1px solid rgba(168,143,117,0.2);
    padding: var(--space-md);
    font-family: var(--font-mono);
    font-size: 11px;
    border-radius: 4px;
    box-shadow: inset 0 2px 8px rgba(0,0,0,0.4);
}

.log-output::-webkit-scrollbar {
    width: 8px;
}

.log-output::-webkit-scrollbar-track {
    background: rgba(0,0,0,0.3);
    border-radius: 4px;
}

.log-output::-webkit-scrollbar-thumb {
    background: rgba(168,143,117,0.3);
    border-radius: 4px;
}

.log-output::-webkit-scrollbar-thumb:hover {
    background: rgba(168,143,117,0.5);
}

.log-entry {
    margin-bottom: 6px;
    line-height: 1.5;
    padding-left: var(--space-md);
    border-left: 2px solid transparent;
    transition: all var(--transition-fast);
}

.log-entry:hover {
    background: rgba(255,255,255,0.02);
    border-left-color: var(--color-steel-blue);
}

.log-entry.info { 
    color: var(--color-offwhite); 
}

.log-entry.success { 
    color: var(--color-teal); 
    border-left-color: var(--color-teal);
}

.log-entry.warning { 
    color: var(--color-bronze);
    border-left-color: var(--color-steel-blue);
}

.log-entry.error { 
    color: var(--color-coral);
    border-left-color: var(--color-coral);
}

/* ============================================
   SCROLLBAR CUSTOMIZATION
   ============================================ */
.control-panel::-webkit-scrollbar {
    width: 10px;
}

.control-panel::-webkit-scrollbar-track {
    background: var(--color-charcoal);
}

.control-panel::-webkit-scrollbar-thumb {
    background: rgba(168,143,117,0.3);
    border-radius: 5px;
    border: 2px solid var(--color-charcoal);
}

.control-panel::-webkit-scrollbar-thumb:hover {
    background: rgba(168,143,117,0.5);
}

/* ============================================
   RESPONSIVE ADJUSTMENTS
   ============================================ */
@media (max-width: 1200px) {
    .control-panel {
        min-width: 280px;
        max-width: 300px;
    }
}

/* ============================================
   ACCESSIBILITY
   ============================================ */
button:focus-visible,
input:focus-visible,
select:focus-visible {
    outline: 2px solid var(--color-steel-blue);
    outline-offset: 2px;
}

/* ============================================
   DECORATIVE COMPASS ROSE (OPTIONAL)
   ============================================ */
.toolbar::before {
    content: '⊕';
    position: absolute;
    top: 50%;
    left: 50%;
    transform: translate(-50%, -50%);
    font-size: 20px;
    color: rgba(168,143,117,0.1);
    pointer-events: none;
    animation: compassRotate 60s linear infinite;
}
`;
}

function getScript(): string {
    return `
const vscode = acquireVsCodeApi();

// 初始化地图
const map = L.map('map').setView([31.30, 120.58], 12);
let currentTileLayer = L.tileLayer('https://mt1.google.com/vt/lyrs=m&x={x}&y={y}&z={z}', {
    maxZoom: 19,
    attribution: '© Google Maps'
}).addTo(map);

// 状态变量
let selectionMode = null; // 'download' or 'convert'
let selectionStart = null;
let selectionRect = null;
let downloadBbox = null;
let convertBbox = null;

// 日志函数
function log(message, level = 'info') {
    const logOutput = document.getElementById('logOutput');
    const entry = document.createElement('div');
    entry.className = \`log-entry \${level}\`;
    const timestamp = new Date().toLocaleTimeString();
    entry.textContent = \`[\${timestamp}] \${message}\`;
    logOutput.appendChild(entry);
    logOutput.scrollTop = logOutput.scrollHeight;
}

// 清除日志
document.getElementById('clearLogBtn').addEventListener('click', () => {
    document.getElementById('logOutput').innerHTML = '';
    log('Log cleared', 'info');
});

// 地图源切换
document.getElementById('tileServerSelect').addEventListener('change', (e) => {
    const url = e.target.value;
    log('Switching map source...', 'info');
    map.removeLayer(currentTileLayer);
    currentTileLayer = L.tileLayer(url, { 
        maxZoom: 19,
        errorTileUrl: '',
        attribution: ''
    }).addTo(map);
    log('Map source changed', 'success');
});

// 刷新地图
document.getElementById('refreshMapBtn').addEventListener('click', () => {
    log('Refreshing map...', 'info');
    map.removeLayer(currentTileLayer);
    const url = document.getElementById('tileServerSelect').value;
    currentTileLayer = L.tileLayer(url, { 
        maxZoom: 19,
        errorTileUrl: '',
        attribution: ''
    }).addTo(map);
    log('Map refreshed', 'success');
});

// 选择区域模式
document.getElementById('selectDownloadBtn').addEventListener('click', () => {
    selectionMode = 'download';
    document.getElementById('selectDownloadBtn').style.backgroundColor = '#4CAF50';
    document.getElementById('selectDownloadBtn').style.color = 'white';
    document.getElementById('selectConvertBtn').style.backgroundColor = 'white';
    document.getElementById('selectConvertBtn').style.color = 'black';
    log('Download region selection mode activated', 'info');
});

document.getElementById('selectConvertBtn').addEventListener('click', () => {
    selectionMode = 'convert';
    document.getElementById('selectConvertBtn').style.backgroundColor = '#4CAF50';
    document.getElementById('selectConvertBtn').style.color = 'white';
    document.getElementById('selectDownloadBtn').style.backgroundColor = 'white';
    document.getElementById('selectDownloadBtn').style.color = 'black';
    log('Convert region selection mode activated', 'info');
});

// 地图点击事件
map.on('click', (e) => {
    if (!selectionMode) return;

    if (!selectionStart) {
        // 第一个点
        selectionStart = e.latlng;
        if (selectionRect) {
            map.removeLayer(selectionRect);
        }
        log(\`First point selected: \${e.latlng.lat.toFixed(5)}, \${e.latlng.lng.toFixed(5)}\`, 'info');
    } else {
        // 第二个点 - 完成选择
        const bounds = L.latLngBounds(selectionStart, e.latlng);
        
        if (selectionRect) {
            map.removeLayer(selectionRect);
        }
        
        selectionRect = L.rectangle(bounds, {
            color: selectionMode === 'download' ? '#3388ff' : '#ff7800',
            weight: 2,
            fillOpacity: 0.2
        }).addTo(map);

        const bbox = {
            minLat: bounds.getSouth(),
            minLon: bounds.getWest(),
            maxLat: bounds.getNorth(),
            maxLon: bounds.getEast()
        };

        if (selectionMode === 'download') {
            downloadBbox = bbox;
            updateDownloadRegionInfo(bbox);
            log(\`Download region selected: \${calculateArea(bbox).toFixed(2)} km²\`, 'success');
        } else {
            convertBbox = bbox;
            updateConvertRegionInfo(bbox);
            log(\`Convert region selected: \${calculateArea(bbox).toFixed(2)} km²\`, 'success');
        }

        selectionStart = null;
        selectionMode = null;
        document.getElementById('selectDownloadBtn').style.backgroundColor = 'white';
        document.getElementById('selectDownloadBtn').style.color = 'black';
        document.getElementById('selectConvertBtn').style.backgroundColor = 'white';
        document.getElementById('selectConvertBtn').style.color = 'black';
    }
});

// 鼠标移动显示坐标
map.on('mousemove', (e) => {
    document.getElementById('positionLabel').textContent = 
        \`Position: \${e.latlng.lat.toFixed(5)}, \${e.latlng.lng.toFixed(5)}\`;
});

// Tab 切换
document.querySelectorAll('.tab-button').forEach(btn => {
    btn.addEventListener('click', () => {
        const tab = btn.dataset.tab;
        document.querySelectorAll('.tab-button').forEach(b => b.classList.remove('active'));
        document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
        btn.classList.add('active');
        document.getElementById(tab + 'Tab').classList.add('active');
    });
});

// 城市选择
document.getElementById('citySelect').addEventListener('change', (e) => {
    if (!e.target.value) return;
    const [lat, lon, zoom] = e.target.value.split(',').map(Number);
    document.getElementById('latInput').value = lat;
    document.getElementById('lonInput').value = lon;
    map.setView([lat, lon], zoom);
    const cityName = e.target.options[e.target.selectedIndex].text;
    log(\`Navigated to \${cityName}\`, 'info');
});

// Goto 按钮
document.getElementById('gotoBtn').addEventListener('click', () => {
    const lat = parseFloat(document.getElementById('latInput').value);
    const lon = parseFloat(document.getElementById('lonInput').value);
    
    if (isNaN(lat) || isNaN(lon)) {
        vscode.postMessage({ type: 'showError', message: 'Invalid coordinates: please enter valid numbers' });
        log('Invalid coordinates', 'error');
        return;
    }
    
    if (lat < -90 || lat > 90) {
        vscode.postMessage({ type: 'showError', message: 'Invalid latitude: must be between -90 and 90' });
        log(\`Invalid latitude: \${lat}\`, 'error');
        return;
    }
    
    if (lon < -180 || lon > 180) {
        vscode.postMessage({ type: 'showError', message: 'Invalid longitude: must be between -180 and 180' });
        log(\`Invalid longitude: \${lon}\`, 'error');
        return;
    }
    
    map.setView([lat, lon], map.getZoom());
    log(\`Navigated to: \${lat.toFixed(5)}, \${lon.toFixed(5)}\`, 'info');
});

// Clear Selection
document.getElementById('clearSelectionBtn').addEventListener('click', () => {
    if (selectionRect) {
        map.removeLayer(selectionRect);
        selectionRect = null;
    }
    selectionStart = null;
    selectionMode = null;
    downloadBbox = null;
    convertBbox = null;
    document.getElementById('downloadRegionInfo').textContent = 'No region selected';
    document.getElementById('convertRegionInfo').textContent = 'No region selected (will convert entire file)';
    document.getElementById('selectDownloadBtn').style.backgroundColor = 'white';
    document.getElementById('selectDownloadBtn').style.color = 'black';
    document.getElementById('selectConvertBtn').style.backgroundColor = 'white';
    document.getElementById('selectConvertBtn').style.color = 'black';
    checkDownloadReady();
    log('Selection cleared', 'info');
});

// 选择输出目录 - Download
document.getElementById('selectDownloadDirBtn').addEventListener('click', () => {
    vscode.postMessage({ type: 'selectOutputDir', target: 'download' });
});

// 选择输出目录 - Convert
document.getElementById('selectConvertDirBtn').addEventListener('click', () => {
    vscode.postMessage({ type: 'selectOutputDir', target: 'convert' });
});

// 选择输入文件
document.getElementById('selectInputFileBtn').addEventListener('click', () => {
    vscode.postMessage({ type: 'selectInputFile' });
});

// 清理缓存
document.getElementById('cleanCacheBtn').addEventListener('click', () => {
    if (confirm('Are you sure you want to clean the download cache?')) {
        vscode.postMessage({ type: 'cleanCache' });
        log('Cache cleaned', 'success');
    }
});

// 开始下载
document.getElementById('startDownloadBtn').addEventListener('click', () => {
    if (!downloadBbox) {
        vscode.postMessage({ type: 'showError', message: 'Please select a region on the map' });
        log('Download failed: No region selected', 'error');
        return;
    }
    const outputDir = document.getElementById('downloadOutputDir').value;
    if (!outputDir) {
        vscode.postMessage({ type: 'showError', message: 'Please select output directory' });
        log('Download failed: No output directory', 'error');
        return;
    }

    const features = [];
    if (document.getElementById('roadsCheck').checked) features.push('roads');
    if (document.getElementById('waterCheck').checked) features.push('water');
    if (document.getElementById('parksCheck').checked) features.push('parks');
    if (document.getElementById('buildingsCheck').checked) features.push('buildings');

    if (features.length === 0) {
        vscode.postMessage({ type: 'showError', message: 'Please select at least one feature' });
        log('Download failed: No features selected', 'error');
        return;
    }

    document.getElementById('downloadProgress').style.display = 'block';
    document.getElementById('startDownloadBtn').disabled = true;

    log(\`Starting download... Features: \${features.join(', ')}\`, 'info');

    vscode.postMessage({
        type: 'startDownload',
        bbox: downloadBbox,
        features: features,
        outputPath: outputDir,
        chunkedEnabled: document.getElementById('chunkedEnabledCheck').checked,
        chunkSize: parseFloat(document.getElementById('chunkSizeInput').value),
        maxRetries: parseInt(document.getElementById('maxRetriesInput').value),
        useCache: document.getElementById('useCacheCheck').checked
    });
});

// 开始转换
document.getElementById('startConvertBtn').addEventListener('click', () => {
    const inputFile = document.getElementById('convertInputFile').value;
    const outputDir = document.getElementById('convertOutputDir').value;

    if (!inputFile || !outputDir) {
        vscode.postMessage({ type: 'showError', message: 'Please select input file and output directory' });
        log('Convert failed: Missing input file or output directory', 'error');
        return;
    }

    const features = [];
    if (document.getElementById('convertRoadsCheck').checked) features.push('roads');
    if (document.getElementById('convertWaterCheck').checked) features.push('water');
    if (document.getElementById('convertParksCheck').checked) features.push('parks');
    if (document.getElementById('convertBuildingsCheck').checked) features.push('buildings');
    if (document.getElementById('convertLabelsCheck').checked) features.push('labels');

    if (features.length === 0) {
        vscode.postMessage({ type: 'showError', message: 'Please select at least one feature' });
        log('Convert failed: No features selected', 'error');
        return;
    }

    document.getElementById('convertProgress').style.display = 'block';
    document.getElementById('startConvertBtn').disabled = true;

    log(\`Starting conversion... Features: \${features.join(', ')}\`, 'info');

    vscode.postMessage({
        type: 'startConvert',
        inputPath: inputFile,
        outputPath: outputDir,
        features: features,
        simplifyPoly: parseFloat(document.getElementById('simplifyPolyInput').value),
        simplifyRoads: parseFloat(document.getElementById('simplifyRoadsInput').value),
        bbox: convertBbox  // Optional, for partial conversion
    });
});

// 接收后端消息
window.addEventListener('message', event => {
    const message = event.data;
    
    switch (message.type) {
        case 'outputDirSelected':
            if (message.target === 'download') {
                document.getElementById('downloadOutputDir').value = message.path;
                checkDownloadReady();
                log(\`Download output directory selected: \${message.path}\`, 'info');
            } else {
                document.getElementById('convertOutputDir').value = message.path;
                checkConvertReady();
                log(\`Convert output directory selected: \${message.path}\`, 'info');
            }
            break;
        
        case 'inputFileSelected':
            document.getElementById('convertInputFile').value = message.path;
            checkConvertReady();
            log(\`Input file selected: \${message.path}\`, 'info');
            break;
        
        case 'downloadProgress':
            updateDownloadProgress(message.progress);
            break;
        
        case 'downloadComplete':
            handleDownloadComplete(message);
            break;
        
        case 'convertProgress':
            updateConvertProgress(message.progress);
            break;
        
        case 'convertComplete':
            handleConvertComplete(message);
            break;
    }
});

// 辅助函数
function updateDownloadRegionInfo(bbox) {
    const area = calculateArea(bbox);
    document.getElementById('downloadRegionInfo').textContent = 
        \`Lat: \${bbox.minLat.toFixed(4)} - \${bbox.maxLat.toFixed(4)}\\nLon: \${bbox.minLon.toFixed(4)} - \${bbox.maxLon.toFixed(4)}\\nArea: \${area.toFixed(2)} km²\`;
    checkDownloadReady();
}

function updateConvertRegionInfo(bbox) {
    const area = calculateArea(bbox);
    document.getElementById('convertRegionInfo').textContent = 
        \`Lat: \${bbox.minLat.toFixed(4)} - \${bbox.maxLat.toFixed(4)}\\nLon: \${bbox.minLon.toFixed(4)} - \${bbox.maxLon.toFixed(4)}\\nArea: \${area.toFixed(2)} km²\`;
}

function calculateArea(bbox) {
    const latDiff = bbox.maxLat - bbox.minLat;
    const lonDiff = bbox.maxLon - bbox.minLon;
    const avgLat = (bbox.maxLat + bbox.minLat) / 2;
    const latKm = latDiff * 111;
    const lonKm = lonDiff * 111 * Math.cos(avgLat * Math.PI / 180);
    return latKm * lonKm;
}

function checkDownloadReady() {
    const ready = downloadBbox && document.getElementById('downloadOutputDir').value;
    document.getElementById('startDownloadBtn').disabled = !ready;
}

function checkConvertReady() {
    const ready = document.getElementById('convertInputFile').value && 
                  document.getElementById('convertOutputDir').value;
    document.getElementById('startConvertBtn').disabled = !ready;
}

function updateDownloadProgress(progress) {
    const percent = (progress.current / progress.total * 100).toFixed(0);
    document.getElementById('downloadProgressBar').style.width = percent + '%';
    document.getElementById('downloadProgressPercent').textContent = percent + '%';
    
    if (progress.currentChunk && progress.totalChunks) {
        document.getElementById('downloadProgressPhase').textContent = 
            \`\${progress.phase}: Chunk \${progress.currentChunk}/\${progress.totalChunks}\`;
        log(\`\${progress.phase}: Chunk \${progress.currentChunk}/\${progress.totalChunks} (\${percent}%)\`, 'info');
    } else {
        document.getElementById('downloadProgressPhase').textContent = 
            \`\${progress.phase}: \${progress.message || ''}\`;
        log(\`\${progress.phase}: \${progress.message || ''} (\${percent}%)\`, 'info');
    }
    
    if (progress.speed) {
        document.getElementById('downloadProgressSpeed').textContent = 
            \`\${(progress.speed / 1024).toFixed(2)} KB/s\`;
    }
}

function handleDownloadComplete(message) {
    document.getElementById('downloadProgress').style.display = 'none';
    document.getElementById('startDownloadBtn').disabled = false;
    
    if (message.success) {
        document.getElementById('downloadProgressBar').style.width = '100%';
        document.getElementById('downloadProgressPercent').textContent = '100%';
        document.getElementById('downloadProgressPhase').textContent = 
            \`Downloaded: \${message.fileSizeKB} KB\`;
        vscode.postMessage({ type: 'showInfo', message: 'Download completed successfully!' });
        log(\`Download completed successfully! File size: \${message.fileSizeKB} KB\`, 'success');
    } else {
        document.getElementById('downloadProgressBar').style.width = '0%';
        document.getElementById('downloadProgressPercent').textContent = '0%';
        document.getElementById('downloadProgressPhase').textContent = 
            \`Failed: \${message.error}\`;
        vscode.postMessage({ type: 'showError', message: 'Download failed: ' + message.error });
        log(\`Download failed: \${message.error}\`, 'error');
    }
}

function updateConvertProgress(progress) {
    const percent = (progress.current / progress.total * 100).toFixed(0);
    document.getElementById('convertProgressBar').style.width = percent + '%';
    document.getElementById('convertProgressPercent').textContent = percent + '%';
    document.getElementById('convertProgressText').textContent = 
        \`\${progress.phase}: \${progress.step}\`;
    log(\`\${progress.phase}: \${progress.step} (\${percent}%)\`, 'info');
}

function handleConvertComplete(message) {
    document.getElementById('convertProgress').style.display = 'none';
    document.getElementById('startConvertBtn').disabled = false;
    
    if (message.success) {
        document.getElementById('convertProgressBar').style.width = '100%';
        document.getElementById('convertProgressText').textContent = 
            \`Converted: \${message.stats.nodeCount} nodes, \${message.stats.edgeCount} edges\`;
        vscode.postMessage({ type: 'showInfo', message: 'Conversion completed successfully!' });
        log(\`Conversion completed successfully! Nodes: \${message.stats.nodeCount}, Edges: \${message.stats.edgeCount}\`, 'success');
    } else {
        document.getElementById('convertProgressBar').style.width = '0%';
        document.getElementById('convertProgressText').textContent = 
            \`Failed: \${message.error}\`;
        vscode.postMessage({ type: 'showError', message: 'Conversion failed: ' + message.error });
        log(\`Conversion failed: \${message.error}\`, 'error');
    }
}

// 初始日志
log('Map Tools initialized', 'success');
`;
}
