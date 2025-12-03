import React, { useState, useEffect } from 'react';
import { Trash2, Edit2, ChevronRight, ChevronDown, Folder } from 'lucide-react';
import { AssetFile } from '../types';
import './AssetsPanel.css';

const AssetsPanel: React.FC = () => {
  const [assets, setAssets] = useState<AssetFile[]>([]);
  const [editingAsset, setEditingAsset] = useState<string | null>(null);
  const [newName, setNewName] = useState('');
  const [isDragOver, setIsDragOver] = useState(false);
  const [expandedFolders, setExpandedFolders] = useState<Set<string>>(new Set());

  // 排序和分类：文件夹在前，文件在后，相同类型按字母顺序
  const sortedAssets = React.useMemo(() => {
    return [...assets].sort((a, b) => {
      // 文件夹优先
      if (a.type === 'folder' && b.type !== 'folder') return -1;
      if (a.type !== 'folder' && b.type === 'folder') return 1;
      // 相同类型按名称排序
      return a.name.localeCompare(b.name);
    });
  }, [assets]);

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
    // 只传递文件名，不传递完整的 webview URI
    const fileName = assetPath.split('/').pop() || assetPath;
    console.log('[AssetsPanel] 删除资源:', fileName);
    window.vscodeAPI?.postMessage({
      command: 'deleteAsset',
      fileName: fileName,
    });
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

  const toggleFolder = (folderPath: string) => {
    setExpandedFolders(prev => {
      const next = new Set(prev);
      if (next.has(folderPath)) {
        next.delete(folderPath);
      } else {
        next.add(folderPath);
      }
      return next;
    });
  };

  const renderAssetItem = (asset: AssetFile, level: number = 0): React.ReactNode => {
    const isFolder = asset.type === 'folder';
    const isExpanded = expandedFolders.has(asset.path);
    const indent = level * 16;

    if (isFolder) {
      return (
        <div key={asset.path} className="folder-container">
          <div 
            className="folder-item"
            style={{ paddingLeft: `${indent}px` }}
            onClick={() => toggleFolder(asset.path)}
          >
            <div className="folder-header">
              {isExpanded ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
              <Folder size={16} />
              <span className="asset-name">{asset.name}</span>
              <div className="asset-actions">
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    handleDelete(asset.path);
                  }}
                  title="删除文件夹"
                  className="action-btn delete"
                >
                  <Trash2 size={12} />
                </button>
              </div>
            </div>
          </div>
          {isExpanded && asset.children && (
            <div className="folder-children" style={{ paddingLeft: `${indent + 16}px` }}>
              {renderAssetList(asset.children, level + 1)}
            </div>
          )}
        </div>
      );
    }

    // 图片文件 - 网格项
    return (
      <div 
        key={asset.path} 
        className="asset-grid-item"
        draggable
        onDragStart={(e) => {
          e.dataTransfer.setData('asset-path', asset.relativePath || asset.name);
          e.dataTransfer.effectAllowed = 'copy';
        }}
      >
        <div className="asset-preview">
          <img
            src={asset.path}
            alt={asset.name}
            onError={(e) => {
              const img = e.target as HTMLImageElement;
              img.style.display = 'none';
            }}
          />
        </div>
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
    );
  };

  const renderAssetList = (assetList: AssetFile[], level: number = 0) => {
    // 分离文件夹和文件
    const folders = assetList.filter(a => a.type === 'folder');
    const files = assetList.filter(a => a.type !== 'folder');

    return (
      <>
        {/* 文件夹：列表布局 */}
        {folders.map(folder => renderAssetItem(folder, level))}
        
        {/* 文件：网格布局 */}
        {files.length > 0 && (
          <div className="assets-grid">
            {files.map(file => renderAssetItem(file, level))}
          </div>
        )}
      </>
    );
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(false);
  };

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(false);

    if (e.dataTransfer.items) {
      // 使用 DataTransferItemList 支持文件夹
      const items = Array.from(e.dataTransfer.items);
      
      for (const item of items) {
        const entry = item.webkitGetAsEntry?.();
        if (entry) {
          await processEntry(entry, '');
        }
      }
    } else if (e.dataTransfer.files) {
      // 降级处理：只处理文件
      const files = Array.from(e.dataTransfer.files);
      files.forEach(file => processFile(file, ''));
    }
  };

  const processEntry = async (entry: any, relativePath: string): Promise<void> => {
    if (entry.isFile) {
      entry.file((file: File) => {
        processFile(file, relativePath);
      });
    } else if (entry.isDirectory) {
      const reader = entry.createReader();
      reader.readEntries((entries: any[]) => {
        entries.forEach(childEntry => {
          const newPath = relativePath ? `${relativePath}/${entry.name}` : entry.name;
          processEntry(childEntry, newPath);
        });
      });
    }
  };

  const processFile = (file: File, relativePath: string) => {
    const imageExts = ['png', 'jpg', 'jpeg', 'gif', 'bmp', 'svg', 'webp'];
    const ext = file.name.split('.').pop()?.toLowerCase();
    
    if (ext && imageExts.includes(ext)) {
      const reader = new FileReader();
      reader.onload = (event) => {
        const arrayBuffer = event.target?.result as ArrayBuffer;
        const uint8Array = new Uint8Array(arrayBuffer);
        
        // 发送文件到后端保存
        window.vscodeAPI?.postMessage({
          command: 'saveImageToAssets',
          fileName: file.name,
          fileData: Array.from(uint8Array),
          relativePath: relativePath, // 保持文件夹结构
          dropPosition: undefined,
          targetContainerId: undefined
        });
      };
      reader.readAsArrayBuffer(file);
    }
  };

  return (
    <div className="assets-panel">
      <div 
        className={`assets-content ${isDragOver ? 'drag-over' : ''}`}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
      >
        {sortedAssets.length === 0 ? (
          <div className="empty-state">
            <p>暂无资源文件</p>
            <p className="hint">拖拽图片或文件夹到此处</p>
          </div>
        ) : (
          <div className="assets-container">
            {renderAssetList(sortedAssets)}
          </div>
        )}
      </div>
    </div>
  );
};

export default AssetsPanel;
