export function getToolsPanelHtml(): string {
    return `<!DOCTYPE html>
<html lang="zh-CN">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>资源转换工具</title>
    <style>${getStyles()}</style>
</head>
<body>
    <div class="container">
        <h1>🔧 资源转换工具</h1>
        <div class="main-layout">
            <div class="left-panel">
                <div class="panel-header">
                    <select class="filter-select" id="filterSelect" onchange="setFilter(this.value)">
                        <option value="all">全部</option>
                        <option value="image">🖼️ 图片</option>
                        <option value="video">🎬 视频</option>
                        <option value="model">📦 3D模型</option>
                    </select>
                    <div class="header-buttons">
                        <button class="icon-btn" onclick="selectFiles()" title="选择文件">📁</button>
                        <button class="icon-btn" onclick="selectFolder()" title="选择文件夹">📂</button>
                    </div>
                </div>
                <div class="breadcrumb" id="breadcrumb">
                    <span class="breadcrumb-item" onclick="navigateTo(-1)">🏠 根目录</span>
                </div>
                <div class="file-grid" id="fileGrid" ondragover="handleDragOver(event)" ondragleave="handleDragLeave(event)" ondrop="handleDrop(event)">
                    <div class="file-grid-inner" id="fileGridInner">
                        <div class="empty-hint">拖拽文件或文件夹到此处</div>
                    </div>
                </div>
                <input type="file" id="fileInput" multiple accept=".png,.jpg,.jpeg,.bmp,.mp4,.avi,.mov,.mkv,.webm,.obj,.gltf" style="display:none" onchange="handleFileSelect(event)">
                <input type="file" id="folderInput" multiple webkitdirectory="" directory="" style="display:none" onchange="handleFileSelect(event)">
            </div>
            <div class="right-panel">
                <div class="panel-header">属性设置</div>
                <div class="properties" id="properties">
                    <div class="preview-area" id="previewArea"></div>
                    <div class="no-selection">选择文件查看设置</div>
                </div>
            </div>
        </div>
        <div class="output-section">
            <span>输出目录:</span>
            <button onclick="selectOutputDir()">选择目录</button>
            <span id="outputDirPath" class="output-path">未选择</span>
        </div>
        <div class="footer">
            <div class="stats" id="stats">🖼️ 0  🎬 0  📦 0</div>
            <div class="actions">
                <button onclick="clearAll()">🗑️ 清空</button>
                <button id="convertBtn" onclick="startConvert()" disabled>▶️ 开始转换</button>
            </div>
        </div>
        <div class="progress-section" id="progressSection" style="display:none">
            <div class="progress-bar"><div class="progress-fill" id="progressFill"></div></div>
            <div class="progress-text" id="progressText">准备中...</div>
        </div>
        <div class="results" id="results" style="display:none"></div>
    </div>
    <script>${getScript()}</script>
</body>
</html>`;
}

function getStyles(): string {
    return `
*{box-sizing:border-box;margin:0;padding:0}
body{font-family:var(--vscode-font-family);background:var(--vscode-editor-background);color:var(--vscode-editor-foreground);padding:16px;height:100vh;overflow:hidden}
.container{display:flex;flex-direction:column;height:100%}
h1{font-size:16px;margin-bottom:12px}
.main-layout{display:flex;flex:1;gap:12px;min-height:0;overflow:hidden}
.left-panel,.right-panel{background:var(--vscode-input-background);border-radius:4px;display:flex;flex-direction:column;min-height:0;overflow:hidden}
.left-panel{flex:1}
.right-panel{width:300px}
.panel-header{padding:8px 12px;border-bottom:1px solid var(--vscode-panel-border);display:flex;justify-content:space-between;align-items:center;font-weight:600;font-size:13px}
.filter-select{background:var(--vscode-input-background);border:1px solid var(--vscode-input-border);color:var(--vscode-input-foreground);padding:4px 8px;border-radius:4px;font-size:12px}
.header-buttons{display:flex;gap:4px}
.icon-btn{background:transparent;border:none;cursor:pointer;padding:4px 8px;border-radius:4px;font-size:14px}
.icon-btn:hover{background:var(--vscode-toolbar-hoverBackground)}
.breadcrumb{padding:6px 12px;border-bottom:1px solid var(--vscode-panel-border);font-size:12px;display:flex;align-items:center;flex-wrap:wrap;gap:2px}
.breadcrumb-item{cursor:pointer;padding:2px 6px;border-radius:3px;color:var(--vscode-textLink-foreground)}
.breadcrumb-item:hover{background:var(--vscode-toolbar-hoverBackground)}
.breadcrumb-separator{color:var(--vscode-descriptionForeground);margin:0 2px}
.file-grid{flex:1;overflow-y:auto;padding:8px}
.file-grid-inner{display:grid;grid-template-columns:repeat(auto-fill,minmax(90px,1fr));gap:8px}
.file-grid.drag-over{background:var(--vscode-list-hoverBackground);outline:2px dashed var(--vscode-focusBorder);outline-offset:-4px}
.empty-hint{grid-column:1/-1;color:var(--vscode-descriptionForeground);text-align:center;padding:60px 20px;font-size:13px}
.grid-item{position:relative;border-radius:4px;overflow:hidden;cursor:pointer;background:var(--vscode-editor-background);border:2px solid transparent;flex-shrink:0}
.grid-item:hover{border-color:var(--vscode-focusBorder)}
.grid-item.selected{border-color:var(--vscode-focusBorder);background:var(--vscode-list-activeSelectionBackground)}
.grid-item .thumb{width:100%;height:0;padding-bottom:100%;position:relative;background:#1e1e1e;overflow:hidden}
.grid-item .thumb img,.grid-item .thumb video,.grid-item .thumb .icon{position:absolute;top:0;left:0;width:100%;height:100%;object-fit:cover}
.grid-item .thumb .icon{display:flex;align-items:center;justify-content:center;font-size:36px}
.grid-item .info{padding:4px 6px;font-size:10px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;text-align:center}
.grid-item .remove-btn{position:absolute;top:2px;right:2px;width:18px;height:18px;border-radius:50%;background:rgba(0,0,0,0.6);color:#fff;border:none;cursor:pointer;font-size:10px;display:none;align-items:center;justify-content:center}
.grid-item:hover .remove-btn{display:flex}
.grid-item .type-badge{position:absolute;top:2px;left:2px;font-size:11px;background:rgba(0,0,0,0.5);padding:2px 4px;border-radius:3px}
.grid-item .count-badge{position:absolute;bottom:22px;right:4px;font-size:9px;background:var(--vscode-badge-background);color:var(--vscode-badge-foreground);padding:1px 5px;border-radius:8px}
.folder-item .thumb{background:var(--vscode-editor-background)}
.properties{flex:1;padding:12px;overflow-y:auto;display:flex;flex-direction:column}
.preview-area{margin-bottom:12px}
.preview-area img,.preview-area video{max-width:100%;max-height:180px;border-radius:4px;display:block;margin:0 auto}
.preview-area .model-preview{text-align:center;padding:40px;background:#1e1e1e;border-radius:4px;font-size:48px}
.no-selection{color:var(--vscode-descriptionForeground);text-align:center;padding:20px;font-size:12px}
.prop-group{margin-bottom:12px}
.prop-group-title{font-size:11px;font-weight:600;margin-bottom:6px;color:var(--vscode-descriptionForeground)}
.prop-row{display:flex;align-items:center;margin-bottom:6px;font-size:12px}
.prop-row label{width:65px;color:var(--vscode-descriptionForeground)}
.prop-row select,.prop-row input{flex:1;background:var(--vscode-input-background);border:1px solid var(--vscode-input-border);color:var(--vscode-input-foreground);padding:4px 6px;border-radius:3px;font-size:11px}
.output-section{display:flex;align-items:center;gap:10px;padding:10px 0;font-size:13px}
.output-path{flex:1;padding:6px 10px;background:var(--vscode-textBlockQuote-background);border-radius:4px;font-size:12px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.footer{display:flex;justify-content:space-between;align-items:center;padding:10px 0}
.stats{font-size:13px}
.actions{display:flex;gap:8px}
button{background:var(--vscode-button-background);color:var(--vscode-button-foreground);border:none;padding:6px 14px;border-radius:4px;cursor:pointer;font-size:12px}
button:hover{background:var(--vscode-button-hoverBackground)}
button:disabled{opacity:.5;cursor:not-allowed}
.progress-section{padding:10px 0}
.progress-bar{height:6px;background:var(--vscode-progressBar-background);border-radius:3px;overflow:hidden}
.progress-fill{height:100%;background:var(--vscode-progressBar-foreground,#0e70c0);width:0;transition:width .3s}
.progress-text{font-size:12px;margin-top:6px;color:var(--vscode-descriptionForeground)}
.results{padding:12px;border-radius:4px;font-size:12px;white-space:pre-wrap;max-height:100px;overflow-y:auto}
.results.success{background:#2e7d32;color:#fff}
.results.error{background:#c62828;color:#fff}
.results.mixed{background:var(--vscode-textBlockQuote-background)}
.file-name{font-size:12px;font-weight:500;margin-bottom:4px;word-break:break-all}
.file-path{font-size:10px;color:var(--vscode-descriptionForeground);margin-bottom:8px}
`;
}

function getScript(): string {
    return `
const vscode = acquireVsCodeApi();
const files = new Map();
const blobUrls = new Map();
let selectedId = null;
let selectedFolder = null;
let outputDir = '';
let currentPath = [];
let filterType = 'all';
const folderSettings = {};

const IMAGE_EXTS = ['.png','.jpg','.jpeg','.bmp'];
const VIDEO_EXTS = ['.mp4','.avi','.mov','.mkv','.webm'];
const MODEL_EXTS = ['.obj','.gltf'];

function getFileType(name) {
    const ext = name.toLowerCase().match(/\\.[^.]+$/)?.[0] || '';
    if (IMAGE_EXTS.includes(ext)) return 'image';
    if (VIDEO_EXTS.includes(ext)) return 'video';
    if (MODEL_EXTS.includes(ext)) return 'model';
    return 'unknown';
}

function selectFiles() { 
    console.log('selectFiles clicked');
    document.getElementById('fileInput').click(); 
}
function selectFolder() { 
    console.log('selectFolder clicked');
    const input = document.getElementById('folderInput');
    console.log('folderInput element:', input);
    console.log('webkitdirectory attr:', input.webkitdirectory);
    input.click(); 
}
function selectOutputDir() { vscode.postMessage({type:'selectOutputDir'}); }

function handleFileSelect(e) {
    console.log('handleFileSelect triggered');
    const fileList = e.target.files;
    console.log('files:', fileList?.length);
    if (!fileList) return;
    Array.from(fileList).forEach(file => {
        console.log('file:', file.name, 'webkitRelativePath:', file.webkitRelativePath);
        const relativePath = file.webkitRelativePath ? file.webkitRelativePath.split('/').slice(0,-1).join('/') : '';
        processFile(file, relativePath);
    });
    e.target.value = '';
}

function handleDragOver(e) { e.preventDefault(); e.currentTarget.classList.add('drag-over'); }
function handleDragLeave(e) { e.currentTarget.classList.remove('drag-over'); }

function handleDrop(e) {
    e.preventDefault();
    e.currentTarget.classList.remove('drag-over');
    const items = e.dataTransfer.items;
    if (items) {
        Array.from(items).forEach(item => {
            const entry = item.webkitGetAsEntry?.();
            if (entry) processEntry(entry, '');
        });
    }
}

function processEntry(entry, relativePath) {
    if (entry.isFile) {
        entry.file(file => processFile(file, relativePath));
    } else if (entry.isDirectory) {
        const reader = entry.createReader();
        const readAll = () => {
            reader.readEntries(entries => {
                if (entries.length) {
                    entries.forEach(e => processEntry(e, relativePath ? relativePath+'/'+entry.name : entry.name));
                    readAll();
                }
            });
        };
        readAll();
    }
}

function processFile(file, relativePath) {
    const type = getFileType(file.name);
    if (type === 'unknown') return;
    
    const id = Date.now() + '_' + Math.random().toString(36).substr(2,9);
    const blobUrl = URL.createObjectURL(file);
    blobUrls.set(id, blobUrl);
    
    const reader = new FileReader();
    reader.onload = (e) => {
        const data = Array.from(new Uint8Array(e.target.result));
        files.set(id, { id, name: file.name, relativePath, type, data, blobUrl });
        vscode.postMessage({ type:'addFile', id, name:file.name, relativePath, data });
        renderGrid();
        updateStats();
    };
    reader.readAsArrayBuffer(file);
}

function setFilter(type) {
    filterType = type;
    currentPath = [];
    selectedId = null;
    renderBreadcrumb();
    renderGrid();
    renderProperties();
    updateFilterCounts();
}

function updateFilterCounts() {
    let img=0, vid=0, mod=0;
    files.forEach(f => { if(f.type==='image')img++; else if(f.type==='video')vid++; else if(f.type==='model')mod++; });
    const total = img + vid + mod;
    const sel = document.getElementById('filterSelect');
    sel.options[0].text = '全部 ('+total+')';
    sel.options[1].text = '🖼️ 图片 ('+img+')';
    sel.options[2].text = '🎬 视频 ('+vid+')';
    sel.options[3].text = '📦 3D模型 ('+mod+')';
}

function getCurrentContent() {
    const folders = new Map();
    const currentFiles = [];
    const pathPrefix = currentPath.join('/');
    
    files.forEach(f => {
        if (filterType !== 'all' && f.type !== filterType) return;
        
        if (filterType !== 'all') {
            currentFiles.push(f);
            return;
        }
        
        if (pathPrefix) {
            if (!f.relativePath.startsWith(pathPrefix)) return;
            const rest = f.relativePath.slice(pathPrefix.length + 1);
            if (rest.includes('/')) {
                const folderName = rest.split('/')[0];
                if (!folders.has(folderName)) folders.set(folderName, { name: folderName, count: 0 });
                folders.get(folderName).count++;
            } else if (rest === '') {
                currentFiles.push(f);
            } else {
                const folderName = rest;
                if (!folders.has(folderName)) folders.set(folderName, { name: folderName, count: 0 });
                folders.get(folderName).count++;
            }
        } else {
            if (f.relativePath === '') {
                currentFiles.push(f);
            } else {
                const folderName = f.relativePath.split('/')[0];
                if (!folders.has(folderName)) folders.set(folderName, { name: folderName, count: 0 });
                folders.get(folderName).count++;
            }
        }
    });
    
    return { folders: Array.from(folders.values()), files: currentFiles };
}

function renderBreadcrumb() {
    const bc = document.getElementById('breadcrumb');
    if (filterType !== 'all') {
        bc.style.display = 'none';
        return;
    }
    bc.style.display = 'flex';
    let html = '<span class="breadcrumb-item" onclick="navigateTo(-1)">🏠 根目录</span>';
    currentPath.forEach((name, i) => {
        html += '<span class="breadcrumb-separator">/</span>';
        html += '<span class="breadcrumb-item" onclick="navigateTo('+i+')">'+name+'</span>';
    });
    bc.innerHTML = html;
}

function navigateTo(index) {
    if (index < 0) currentPath = [];
    else currentPath = currentPath.slice(0, index + 1);
    selectedId = null;
    selectedFolder = null;
    renderBreadcrumb();
    renderGrid();
    renderProperties();
}

function enterFolder(name) {
    currentPath.push(name);
    selectedId = null;
    selectedFolder = null;
    renderBreadcrumb();
    renderGrid();
    renderProperties();
}

function renderGrid() {
    const grid = document.getElementById('fileGridInner');
    if (files.size === 0) {
        grid.innerHTML = '<div class="empty-hint">拖拽文件或文件夹到此处</div>';
        return;
    }
    
    const { folders, files: currentFiles } = getCurrentContent();
    
    if (folders.length === 0 && currentFiles.length === 0) {
        grid.innerHTML = '<div class="empty-hint">当前文件夹为空</div>';
        return;
    }
    
    let html = '';
    
    folders.forEach(folder => {
        const folderPath = currentPath.length ? currentPath.join('/') + '/' + folder.name : folder.name;
        const isSelected = selectedFolder === folderPath;
        html += '<div class="grid-item folder-item'+(isSelected?' selected':'')+'" onclick="selectFolderItem(\\''+folderPath+'\\',event)" ondblclick="enterFolder(\\''+folder.name+'\\')">'; 
        html += '<div class="thumb"><span class="icon">📁</span></div>';
        html += '<span class="count-badge">'+folder.count+'</span>';
        html += '<div class="info" title="'+folder.name+'">'+folder.name+'</div>';
        html += '</div>';
    });
    
    currentFiles.forEach(f => {
        const isSelected = selectedId === f.id;
        html += '<div class="grid-item' + (isSelected ? ' selected' : '') + '" onclick="selectItem(\\''+f.id+'\\')">';
        html += '<div class="thumb">';
        if (f.type === 'image') {
            html += '<img src="'+f.blobUrl+'" alt="'+f.name+'">';
        } else if (f.type === 'video') {
            html += '<video src="'+f.blobUrl+'" muted></video>';
        } else {
            html += '<span class="icon">📦</span>';
        }
        html += '</div>';
        html += '<span class="type-badge">' + (f.type==='image'?'🖼️':f.type==='video'?'🎬':'📦') + '</span>';
        html += '<div class="info" title="'+f.name+'">'+f.name+'</div>';
        html += '<button class="remove-btn" onclick="removeFile(event,\\''+f.id+'\\')">✕</button>';
        html += '</div>';
    });
    
    grid.innerHTML = html;
}

function selectFolderItem(folderPath, e) {
    if (e) e.stopPropagation();
    selectedFolder = folderPath;
    selectedId = null;
    renderGrid();
    renderProperties();
}

function selectItem(id) {
    selectedId = id;
    selectedFolder = null;
    renderGrid();
    renderProperties();
}

function removeFile(e, id) {
    e.stopPropagation();
    const url = blobUrls.get(id);
    if (url) URL.revokeObjectURL(url);
    blobUrls.delete(id);
    files.delete(id);
    vscode.postMessage({type:'removeFile', id});
    if (selectedId === id) { selectedId = null; renderProperties(); }
    renderGrid();
    updateStats();
}

function clearAll() {
    blobUrls.forEach(url => URL.revokeObjectURL(url));
    blobUrls.clear();
    files.clear();
    selectedId = null;
    selectedFolder = null;
    currentPath = [];
    filterType = 'all';
    Object.keys(folderSettings).forEach(k => delete folderSettings[k]);
    document.getElementById('filterSelect').value = 'all';
    vscode.postMessage({type:'clearFiles'});
    renderBreadcrumb();
    renderGrid();
    updateStats();
    renderProperties();
}

function updateStats() {
    let img=0, vid=0, mod=0;
    files.forEach(f => { if(f.type==='image')img++; else if(f.type==='video')vid++; else if(f.type==='model')mod++; });
    document.getElementById('stats').textContent = '🖼️ '+img+'  🎬 '+vid+'  📦 '+mod;
    document.getElementById('convertBtn').disabled = !(files.size && outputDir);
    updateFilterCounts();
}

function renderProperties() {
    const props = document.getElementById('properties');
    
    if (selectedFolder) {
        const settings = folderSettings[selectedFolder] || {};
        let imgCount = 0, vidCount = 0, modCount = 0;
        files.forEach(f => {
            if (f.relativePath === selectedFolder || f.relativePath.startsWith(selectedFolder + '/')) {
                if (f.type === 'image') imgCount++;
                else if (f.type === 'video') vidCount++;
                else if (f.type === 'model') modCount++;
            }
        });
        
        let html = '<div class="preview-area"><div class="model-preview">📁</div></div>';
        html += '<div class="file-name">'+selectedFolder.split('/').pop()+'</div>';
        html += '<div class="file-path">🖼️ '+imgCount+'  🎬 '+vidCount+'  📦 '+modCount+'</div>';
        
        if (imgCount > 0) {
            html += '<div class="prop-group"><div class="prop-group-title">🖼️ 图片设置 ('+imgCount+'个)</div>' +
                '<div class="prop-row"><label>像素格式:</label><select onchange="updateFolderSetting(\\'image\\',\\'format\\',this.value)">' +
                '<option value="auto"'+(settings.image?.format==='auto'||!settings.image?.format?' selected':'')+'>自动检测</option>' +
                '<option value="rgb565"'+(settings.image?.format==='rgb565'?' selected':'')+'>RGB565</option>' +
                '<option value="rgb888"'+(settings.image?.format==='rgb888'?' selected':'')+'>RGB888</option>' +
                '<option value="argb8888"'+(settings.image?.format==='argb8888'?' selected':'')+'>ARGB8888</option>' +
                '<option value="argb8565"'+(settings.image?.format==='argb8565'?' selected':'')+'>ARGB8565</option>' +
                '</select></div></div>';
        }
        
        if (vidCount > 0) {
            html += '<div class="prop-group"><div class="prop-group-title">🎬 视频设置 ('+vidCount+'个)</div>' +
                '<div class="prop-row"><label>格式:</label><select onchange="updateFolderSetting(\\'video\\',\\'format\\',this.value)">' +
                '<option value="mjpeg"'+(settings.video?.format==='mjpeg'||!settings.video?.format?' selected':'')+'>MJPEG</option>' +
                '<option value="avi"'+(settings.video?.format==='avi'?' selected':'')+'>AVI</option>' +
                '<option value="h264"'+(settings.video?.format==='h264'?' selected':'')+'>H.264</option>' +
                '</select></div>' +
                '<div class="prop-row"><label>质量:</label><input type="number" min="1" max="31" value="'+(settings.video?.quality||1)+'" onchange="updateFolderSetting(\\'video\\',\\'quality\\',+this.value)"></div>' +
                '<div class="prop-row"><label>帧率:</label><input type="number" value="'+(settings.video?.frameRate||'')+'" placeholder="保持原始" onchange="updateFolderSetting(\\'video\\',\\'frameRate\\',this.value?+this.value:null)"></div></div>';
        }
        
        if (modCount > 0) {
            html += '<div class="prop-group"><div class="prop-group-title">📦 3D模型 ('+modCount+'个)</div><div style="font-size:11px;color:var(--vscode-descriptionForeground)">无额外设置</div></div>';
        }
        
        props.innerHTML = html;
        return;
    }
    
    if (!selectedId) {
        props.innerHTML = '<div class="preview-area"></div><div class="no-selection">选择文件或文件夹查看设置</div>';
        return;
    }
    
    const file = files.get(selectedId);
    if (!file) { props.innerHTML = '<div class="no-selection">文件不存在</div>'; return; }
    
    const inherited = getInheritedSettings(file);
    const settings = file.settings || {};
    
    let html = '<div class="preview-area">';
    if (file.type === 'image') {
        html += '<img src="'+file.blobUrl+'">';
    } else if (file.type === 'video') {
        html += '<video src="'+file.blobUrl+'" controls muted style="max-height:150px"></video>';
    } else {
        html += '<div class="model-preview">📦</div>';
    }
    html += '</div>';
    
    html += '<div class="file-name">'+file.name+'</div>';
    if (file.relativePath) html += '<div class="file-path">📁 '+file.relativePath+'</div>';
    
    if (file.type === 'image') {
        const effectiveFormat = settings.format || inherited.image?.format || 'auto';
        const isInherited = !settings.format && inherited.image?.format;
        html += '<div class="prop-group"><div class="prop-group-title">转换设置'+(isInherited?' <span style="color:var(--vscode-descriptionForeground)">(继承自文件夹)</span>':'')+'</div>' +
            '<div class="prop-row"><label>像素格式:</label><select onchange="updateSetting(\\'format\\',this.value)">' +
            '<option value=""'+(settings.format===''||!settings.format?' selected':'')+'>继承 ('+(inherited.image?.format||'自动')+')</option>' +
            '<option value="auto"'+(settings.format==='auto'?' selected':'')+'>自动检测</option>' +
            '<option value="rgb565"'+(settings.format==='rgb565'?' selected':'')+'>RGB565</option>' +
            '<option value="rgb888"'+(settings.format==='rgb888'?' selected':'')+'>RGB888</option>' +
            '<option value="argb8888"'+(settings.format==='argb8888'?' selected':'')+'>ARGB8888</option>' +
            '<option value="argb8565"'+(settings.format==='argb8565'?' selected':'')+'>ARGB8565</option>' +
            '</select></div></div>';
    } else if (file.type === 'video') {
        const iv = inherited.video || {};
        html += '<div class="prop-group"><div class="prop-group-title">转换设置</div>' +
            '<div class="prop-row"><label>格式:</label><select onchange="updateSetting(\\'format\\',this.value)">' +
            '<option value=""'+(!settings.format?' selected':'')+'>继承 ('+(iv.format||'MJPEG')+')</option>' +
            '<option value="mjpeg"'+(settings.format==='mjpeg'?' selected':'')+'>MJPEG</option>' +
            '<option value="avi"'+(settings.format==='avi'?' selected':'')+'>AVI</option>' +
            '<option value="h264"'+(settings.format==='h264'?' selected':'')+'>H.264</option>' +
            '</select></div>' +
            '<div class="prop-row"><label>质量:</label><input type="number" min="1" max="31" value="'+(settings.quality||'')+'" placeholder="继承 ('+(iv.quality||1)+')" onchange="updateSetting(\\'quality\\',this.value?+this.value:null)"></div>' +
            '<div class="prop-row"><label>帧率:</label><input type="number" value="'+(settings.frameRate||'')+'" placeholder="'+(iv.frameRate||'保持原始')+'" onchange="updateSetting(\\'frameRate\\',this.value?+this.value:null)"></div></div>';
    } else {
        html += '<div class="prop-group"><div class="prop-group-title">转换设置</div><div style="font-size:11px;color:var(--vscode-descriptionForeground)">3D模型无额外设置</div></div>';
    }
    
    props.innerHTML = html;
}

function getInheritedSettings(file) {
    if (!file.relativePath) return {};
    const parts = file.relativePath.split('/');
    for (let i = parts.length; i > 0; i--) {
        const folderPath = parts.slice(0, i).join('/');
        if (folderSettings[folderPath]) return folderSettings[folderPath];
    }
    return {};
}

function updateFolderSetting(category, key, value) {
    if (!folderSettings[selectedFolder]) folderSettings[selectedFolder] = {};
    if (!folderSettings[selectedFolder][category]) folderSettings[selectedFolder][category] = {};
    if (value === null) delete folderSettings[selectedFolder][category][key];
    else folderSettings[selectedFolder][category][key] = value;
    vscode.postMessage({type:'updateFolderSettings', folderPath: selectedFolder, settings: folderSettings[selectedFolder]});
}

function updateSetting(key, value) {
    const file = files.get(selectedId);
    if (!file) return;
    if (!file.settings) file.settings = {};
    if (value === null) delete file.settings[key];
    else file.settings[key] = value;
    vscode.postMessage({type:'updateFileSettings', id:selectedId, settings: file.settings});
}

function startConvert() {
    if (!outputDir || !files.size) return;
    document.getElementById('progressSection').style.display = 'block';
    document.getElementById('results').style.display = 'none';
    document.getElementById('convertBtn').disabled = true;
    vscode.postMessage({type:'startConvert'});
}

window.addEventListener('message', e => {
    const msg = e.data;
    if (msg.type === 'outputDirSelected') {
        outputDir = msg.dir;
        document.getElementById('outputDirPath').textContent = msg.dir;
        updateStats();
    } else if (msg.type === 'progress') {
        const pct = msg.total ? (msg.current / msg.total * 100) : 0;
        document.getElementById('progressFill').style.width = pct + '%';
        document.getElementById('progressText').textContent = msg.current + '/' + msg.total + '  ' + msg.fileName;
    } else if (msg.type === 'convertComplete') {
        document.getElementById('progressSection').style.display = 'none';
        document.getElementById('convertBtn').disabled = false;
        const r = document.getElementById('results');
        r.style.display = 'block';
        const ok = msg.results.filter(x=>x.success).length;
        const fail = msg.results.length - ok;
        r.className = 'results ' + (fail ? (ok ? 'mixed' : 'error') : 'success');
        r.textContent = '完成: ' + ok + ' 成功, ' + fail + ' 失败';
        if (fail) r.textContent += '\\n' + msg.results.filter(x=>!x.success).map(x=>x.fileName+': '+x.error).join('\\n');
    }
});
`;
}
