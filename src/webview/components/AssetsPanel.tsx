import React, { useState, useEffect } from 'react';
import { Image, Trash2, Edit2, FolderOpen, Check, Upload } from 'lucide-react';
import { useDesignerStore } from '../store';
import { AssetFile } from '../types';
import './AssetsPanel.css';

const AssetsPanel: React.FC = () => {
  const {
    selectedComponent,
    getComponentById,
    updateComponent,
    setAssetList,
    updateAssetPreview,
  } = useDesignerStore();

  const [assets, setAssets] = useState<AssetFile[]>([]);
  const [isExpanded, setIsExpanded] = useState(true);
  const [editingAsset, setEditingAsset] = useState<string | null>(null);
  const [newName, setNewName] = useState('');
  const [selectedAsset, setSelectedAsset] = useState<string | null>(null);

  useEffect(() => {
    window.vscodeAPI?.postMessage({ command: 'loadAssets' });

    const handleMessage = (event: MessageEvent) => {
      const message = event.data;
      if (message.command === 'assetsLoaded') {
        const loaded: AssetFile[] = (message.assets || []).map((asset: any) => ({
          name: asset.name,
          type: asset.type || 'image',
          size: asset.size || 0,
          relativePath: asset.relativePath || asset.path || asset.name,
          webviewPath: asset.webviewPath || asset.path || '',
        }));
        setAssets(loaded);
        setAssetList(loaded);
      }
    };

    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, [setAssetList]);

  const formatSize = (bytes: number) => {
    if (!bytes) return '0 B';
    const units = ['B', 'KB', 'MB', 'GB'];
    const i = Math.min(units.length - 1, Math.floor(Math.log(bytes) / Math.log(1024)));
    return `${(bytes / Math.pow(1024, i)).toFixed(i === 0 ? 0 : 1)} ${units[i]}`;
  };

  const handleDelete = (asset: AssetFile) => {
    if (confirm('确定要删除这个资源文件吗？')) {
      window.vscodeAPI?.postMessage({
        command: 'deleteAsset',
        path: asset.relativePath,
      });
    }
  };

  const handleRename = (asset: AssetFile) => {
    setEditingAsset(asset.relativePath);
    setNewName(asset.name);
  };

  const handleRenameConfirm = (asset: AssetFile) => {
    if (newName && newName !== asset.name) {
      window.vscodeAPI?.postMessage({
        command: 'renameAsset',
        oldPath: asset.relativePath,
        newName,
      });
    }
    setEditingAsset(null);
  };

  const handleOpenFolder = () => {
    window.vscodeAPI?.postMessage({
      command: 'openAssetsFolder',
    });
  };

  const handleImportAssets = () => {
    window.vscodeAPI?.postMessage({
      command: 'importAssets',
    });
  };

  const handleApplyToSelection = (asset: AssetFile) => {
    if (!selectedComponent) {
      window.vscodeAPI?.postMessage({ command: 'notify', text: '请选择一个图片组件后再应用资源' });
      return;
    }
    const target = getComponentById(selectedComponent);
    if (!target || target.type !== 'hg_image') {
      window.vscodeAPI?.postMessage({ command: 'notify', text: '当前选中的不是图片组件' });
      return;
    }
    updateComponent(selectedComponent, {
      data: {
        ...target.data,
        src: asset.relativePath,
      },
    });
    updateAssetPreview(asset.relativePath, asset.webviewPath);
    setSelectedAsset(asset.relativePath);
  };

  const handleAssetClick = (asset: AssetFile) => {
    setSelectedAsset(asset.relativePath);
  };

  return (
    <div
      className={`assets-panel ${!isExpanded ? 'collapsed' : ''}`}
      style={{ flex: isExpanded ? '1' : '0 0 auto' }}
    >
      <div className="panel-header" onClick={() => setIsExpanded(!isExpanded)}>
        <span className={`expand-icon ${isExpanded ? 'expanded' : ''}`}>›</span>
        <Image size={16} />
        <span>资源预览</span>
        <button
          className="open-folder-btn"
          onClick={(e) => {
            e.stopPropagation();
            handleImportAssets();
          }}
          title="导入图片资源到 assets 目录"
        >
          <Upload size={14} />
        </button>
        <button
          className="open-folder-btn"
          onClick={(e) => {
            e.stopPropagation();
            handleOpenFolder();
          }}
          title="打开资源文件夹"
        >
          <FolderOpen size={14} />
        </button>
      </div>

      {isExpanded && (
        <div className="assets-content" style={{ minHeight: Math.min(240, Math.max(160, assets.length > 0 ? 180 : 160)) }}>
          {assets.length === 0 ? (
            <div className="empty-state">
              <p>暂无资源文件</p>
              <p className="hint">拖拽图片到画布上可自动添加</p>
            </div>
          ) : (
            <div className="assets-grid">
              {assets.map((asset) => (
                <div
                  key={asset.relativePath}
                  className={`asset-item ${selectedAsset === asset.relativePath ? 'selected' : ''}`}
                  onClick={() => handleAssetClick(asset)}
                  onDoubleClick={() => handleApplyToSelection(asset)}
                  title={asset.relativePath}
                >
                      {asset.type === 'image' && (
                        <div className="asset-preview">
                          {asset.webviewPath ? (
                            <img
                              src={asset.webviewPath}
                              alt={asset.name}
                              onError={(e) => {
                            console.error('资源预览加载失败:', asset.webviewPath);
                            (e.target as HTMLImageElement).style.display = 'none';
                          }}
                            />
                          ) : (
                            <div className="asset-placeholder">No Preview</div>
                          )}
                    </div>
                  )}
                  <div className="asset-info">
                    {editingAsset === asset.relativePath ? (
                      <input
                        type="text"
                        value={newName}
                        onChange={(e) => setNewName(e.target.value)}
                        onBlur={() => handleRenameConfirm(asset)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') handleRenameConfirm(asset);
                          if (e.key === 'Escape') setEditingAsset(null);
                        }}
                        autoFocus
                        className="rename-input"
                      />
                    ) : (
                      <span className="asset-name" title={asset.name}>
                        {asset.name}
                      </span>
                    )}
                    <div className="asset-meta">
                      <span className="asset-size">{formatSize(asset.size)}</span>
                    </div>
                    <div className="asset-actions">
                      <button
                        onClick={() => handleApplyToSelection(asset)}
                        title="应用到选中图片组件"
                        className="action-btn"
                      >
                        <Check size={12} />
                      </button>
                      <button
                        onClick={() => handleRename(asset)}
                        title="重命名"
                        className="action-btn"
                      >
                        <Edit2 size={12} />
                      </button>
                      <button
                        onClick={() => handleDelete(asset)}
                        title="删除"
                        className="action-btn delete"
                      >
                        <Trash2 size={12} />
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default AssetsPanel;
