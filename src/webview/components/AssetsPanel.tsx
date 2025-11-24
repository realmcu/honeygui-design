import React, { useState, useEffect } from 'react';
import { Image, Trash2, Edit2, FolderOpen } from 'lucide-react';
import './AssetsPanel.css';

interface AssetFile {
  name: string;
  path: string;
  type: 'image' | 'font';
  size: number;
}

const AssetsPanel: React.FC = () => {
  const [assets, setAssets] = useState<AssetFile[]>([]);
  const [isExpanded, setIsExpanded] = useState(true);
  const [editingAsset, setEditingAsset] = useState<string | null>(null);
  const [newName, setNewName] = useState('');

  console.log('[AssetsPanel] Render - isExpanded:', isExpanded, 'assets:', assets.length);

  useEffect(() => {
    // 请求加载资源列表
    window.vscodeAPI?.postMessage({
      command: 'loadAssets',
    });

    // 监听资源列表更新
    const handleMessage = (event: MessageEvent) => {
      const message = event.data;
      if (message.command === 'assetsLoaded') {
        setAssets(message.assets || []);
      }
    };

    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, []);

  const handleDelete = (assetPath: string) => {
    if (confirm('确定要删除这个资源文件吗？')) {
      window.vscodeAPI?.postMessage({
        command: 'deleteAsset',
        path: assetPath,
      });
    }
  };

  const handleRename = (oldPath: string) => {
    setEditingAsset(oldPath);
    setNewName(oldPath.split('/').pop() || '');
  };

  const handleRenameConfirm = (oldPath: string) => {
    if (newName && newName !== oldPath.split('/').pop()) {
      window.vscodeAPI?.postMessage({
        command: 'renameAsset',
        oldPath,
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

  return (
    <div
      className={`assets-panel ${!isExpanded ? 'collapsed' : ''}`}
      style={{ flex: isExpanded ? '1' : '0 0 auto' }}
    >
      <div className="panel-header" onClick={() => setIsExpanded(!isExpanded)}>
        <span className={`expand-icon ${isExpanded ? 'expanded' : ''}`}>▶</span>
        <Image size={16} />
        <span>资源预览</span>
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
        <div className="assets-content" style={{ minHeight: Math.min(240, Math.max(160, assets.length > 0 ? 160 : 160)) }}>
          {assets.length === 0 ? (
            <div className="empty-state">
              <p>暂无资源文件</p>
              <p className="hint">拖拽图片到容器上即可添加</p>
            </div>
          ) : (
            <div className="assets-grid">
              {assets.map((asset) => (
                <div key={asset.path} className="asset-item">
                  {asset.type === 'image' && (
                    <div className="asset-preview">
                      <img
                        src={asset.path}
                        alt={asset.name}
                        onLoad={() => {
                          console.log('[AssetsPanel] 图片加载成功:', asset.name, asset.path);
                        }}
                        onError={(e) => {
                          console.error('[AssetsPanel] 图片加载失败:', asset.name, asset.path);
                          const img = e.target as HTMLImageElement;
                          img.style.display = 'none';
                          // 显示错误提示
                          const preview = img.parentElement;
                          if (preview) {
                            preview.innerHTML = '<div style="color: red; font-size: 10px; padding: 4px;">加载失败</div>';
                          }
                        }}
                      />
                    </div>
                  )}
                  <div className="asset-info">
                    {editingAsset === asset.path ? (
                      <input
                        type="text"
                        value={newName}
                        onChange={(e) => setNewName(e.target.value)}
                        onBlur={() => handleRenameConfirm(asset.path)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') handleRenameConfirm(asset.path);
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
                    <div className="asset-actions">
                      <button
                        onClick={() => handleRename(asset.path)}
                        title="重命名"
                        className="action-btn"
                      >
                        <Edit2 size={12} />
                      </button>
                      <button
                        onClick={() => handleDelete(asset.path)}
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
