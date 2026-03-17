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
            <button id="zoomInBtn">+</button>
            <button id="zoomOutBtn">-</button>
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
            <div class="map-buttons">
                <button id="selectDownloadBtn">📥 Select Download Region</button>
                <button id="selectConvertBtn">🔄 Select Convert Region</button>
                <button id="clearSelectionBtn">❌ Clear Selection</button>
            </div>
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
* { margin: 0; padding: 0; box-sizing: border-box; }
body {
    font-family: var(--vscode-font-family);
    color: var(--vscode-foreground);
    background-color: var(--vscode-editor-background);
    overflow: hidden;
}
.container { display: flex; flex-direction: column; height: 100vh; }
.toolbar {
    display: flex;
    justify-content: space-between;
    padding: 8px;
    background-color: var(--vscode-editorGroupHeader-tabsBackground);
    border-bottom: 1px solid var(--vscode-panel-border);
    flex-shrink: 0;
}
.toolbar-secondary {
    background-color: var(--vscode-sideBar-background);
}
.toolbar-left, .toolbar-right { display: flex; align-items: center; gap: 8px; }
.toolbar label { font-size: 12px; white-space: nowrap; }
.toolbar input, .toolbar select {
    background-color: var(--vscode-input-background);
    color: var(--vscode-input-foreground);
    border: 1px solid var(--vscode-input-border);
    padding: 4px 8px;
    font-size: 12px;
    border-radius: 2px;
}
.toolbar input[type="number"] { width: 90px; }
.toolbar select { max-width: 150px; }
.toolbar button {
    padding: 4px 12px;
    background-color: var(--vscode-button-background);
    color: var(--vscode-button-foreground);
    border: none;
    cursor: pointer;
    border-radius: 2px;
    font-size: 12px;
    font-weight: 500;
}
.toolbar button:hover { background-color: var(--vscode-button-hoverBackground); }
.main-layout { display: flex; flex: 1; overflow: hidden; }
.map-container {
    flex: 3;
    position: relative;
    display: flex;
    flex-direction: column;
    overflow: hidden;
}
#map { flex: 1; background: #e5e3df; }
.map-buttons {
    position: absolute;
    top: 10px;
    left: 10px;
    display: flex;
    gap: 10px;
    z-index: 1000;
}
.map-buttons button {
    padding: 8px 16px;
    background-color: white;
    border: 2px solid rgba(0,0,0,0.2);
    border-radius: 4px;
    cursor: pointer;
    font-size: 13px;
    box-shadow: 0 2px 4px rgba(0,0,0,0.2);
    font-weight: 500;
    transition: all 0.2s;
}
.map-buttons button:hover { 
    background-color: #f4f4f4; 
    transform: translateY(-1px);
    box-shadow: 0 4px 6px rgba(0,0,0,0.2);
}
.map-buttons button:active { transform: translateY(0); }
.position-label {
    position: absolute;
    bottom: 10px;
    right: 10px;
    background-color: rgba(255,255,255,0.95);
    padding: 4px 8px;
    border-radius: 4px;
    font-size: 12px;
    z-index: 1000;
    border: 1px solid rgba(0,0,0,0.1);
    box-shadow: 0 2px 4px rgba(0,0,0,0.1);
    font-family: monospace;
}
.control-panel {
    flex: 1;
    display: flex;
    flex-direction: column;
    border-left: 1px solid var(--vscode-panel-border);
    background-color: var(--vscode-sideBar-background);
    overflow-y: auto;
    min-width: 280px;
    max-width: 350px;
}
.tabs {
    display: flex;
    border-bottom: 1px solid var(--vscode-panel-border);
    flex-shrink: 0;
}
.tab-button {
    flex: 1;
    padding: 10px;
    background-color: transparent;
    color: var(--vscode-foreground);
    border: none;
    cursor: pointer;
    font-size: 13px;
    font-weight: 500;
    transition: background-color 0.2s;
}
.tab-button:hover { background-color: var(--vscode-list-hoverBackground); }
.tab-button.active {
    background-color: var(--vscode-tab-activeBackground);
    border-bottom: 2px solid var(--vscode-focusBorder);
}
.tab-content { display: none; padding: 16px; }
.tab-content.active { display: block; }
.section { margin-bottom: 20px; }
.section h3 {
    font-size: 14px;
    margin-bottom: 8px;
    color: var(--vscode-foreground);
    font-weight: 600;
}
.section label {
    display: block;
    margin-bottom: 6px;
    font-size: 13px;
    cursor: pointer;
    transition: color 0.2s;
}
.section label:hover { color: var(--vscode-textLink-foreground); }
.section input[type="checkbox"] { margin-right: 6px; cursor: pointer; }
.setting-row {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin: 6px 0;
}
.setting-row label {
    font-size: 12px;
    display: inline;
    margin: 0;
}
.setting-row input[type="number"] {
    width: 80px;
    padding: 4px;
    background-color: var(--vscode-input-background);
    color: var(--vscode-input-foreground);
    border: 1px solid var(--vscode-input-border);
    border-radius: 2px;
}
.hint {
    margin-top: 8px;
    font-size: 11px;
    color: var(--vscode-descriptionForeground);
    line-height: 1.4;
}
.file-select {
    display: flex;
    gap: 8px;
}
.file-select input {
    flex: 1;
    padding: 6px;
    background-color: var(--vscode-input-background);
    color: var(--vscode-input-foreground);
    border: 1px solid var(--vscode-input-border);
    font-size: 12px;
    border-radius: 2px;
}
.file-select button {
    padding: 6px 12px;
    background-color: var(--vscode-button-background);
    color: var(--vscode-button-foreground);
    border: none;
    cursor: pointer;
    font-size: 12px;
    border-radius: 2px;
    font-weight: 500;
}
.file-select button:hover { background-color: var(--vscode-button-hoverBackground); }
.primary-button {
    width: 100%;
    padding: 10px;
    background-color: var(--vscode-button-background);
    color: var(--vscode-button-foreground);
    border: none;
    cursor: pointer;
    font-size: 14px;
    font-weight: bold;
    border-radius: 2px;
    transition: background-color 0.2s;
}
.primary-button:hover { background-color: var(--vscode-button-hoverBackground); }
.primary-button:disabled {
    opacity: 0.5;
    cursor: not-allowed;
}
.info-box {
    padding: 10px;
    background-color: var(--vscode-textBlockQuote-background);
    border-left: 3px solid var(--vscode-textBlockQuote-border);
    font-size: 12px;
    color: var(--vscode-foreground);
    white-space: pre-wrap;
    font-family: monospace;
    border-radius: 2px;
}
.progress-container { margin-top: 10px; }
.progress-bar {
    height: 20px;
    background-color: var(--vscode-input-background);
    border-radius: 4px;
    overflow: hidden;
    border: 1px solid var(--vscode-input-border);
}
.progress-fill {
    height: 100%;
    background-color: var(--vscode-progressBar-background);
    transition: width 0.3s ease;
}
.progress-text {
    margin-top: 6px;
    font-size: 12px;
    color: var(--vscode-foreground);
}
.progress-info {
    display: flex;
    justify-content: space-between;
    margin-top: 6px;
}
.progress-speed {
    font-size: 11px;
    color: var(--vscode-descriptionForeground);
}
.progress-phase {
    margin-top: 4px;
    font-size: 11px;
    color: var(--vscode-textLink-foreground);
}
.log-container {
    display: flex;
    flex-direction: column;
    height: calc(100vh - 200px);
}
.log-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 10px;
}
.log-header h3 {
    margin: 0;
}
.small-button {
    padding: 4px 8px;
    font-size: 11px;
    background-color: var(--vscode-button-secondaryBackground);
    color: var(--vscode-button-secondaryForeground);
    border: none;
    cursor: pointer;
    border-radius: 2px;
}
.small-button:hover {
    background-color: var(--vscode-button-secondaryHoverBackground);
}
.log-output {
    flex: 1;
    overflow-y: auto;
    background-color: var(--vscode-editor-background);
    border: 1px solid var(--vscode-panel-border);
    padding: 8px;
    font-family: var(--vscode-editor-font-family);
    font-size: 12px;
    border-radius: 2px;
}
.log-entry {
    margin-bottom: 4px;
    line-height: 1.4;
}
.log-entry.info { color: var(--vscode-foreground); }
.log-entry.success { color: #4EC9B0; }
.log-entry.warning { color: #DCDCAA; }
.log-entry.error { color: #F48771; }
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

// Zoom 按钮
document.getElementById('zoomInBtn').addEventListener('click', () => {
    map.zoomIn();
    log(\`Zoomed in to level \${map.getZoom()}\`, 'info');
});
document.getElementById('zoomOutBtn').addEventListener('click', () => {
    map.zoomOut();
    log(\`Zoomed out to level \${map.getZoom()}\`, 'info');
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
