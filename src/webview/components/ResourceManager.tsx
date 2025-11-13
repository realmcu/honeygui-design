import React, { useState, useEffect } from 'react';
import {
  Folder,
  FileImage,
  File,
  RefreshCw,
  Search,
  Upload,
  Trash2,
  Eye,
  FolderOpen,
  List,
  Grid3x3,
} from 'lucide-react';
import './ResourceManager.css';

export interface ResourceItem {
  id: string;
  name: string;
  path: string;
  type: 'folder' | 'image' | 'file';
  size?: number;
  modified?: Date;
  thumbnail?: string;
}

interface ResourceManagerProps {
  onSelectResource?: (resource: ResourceItem) => void;
  onAddResource?: () => void;
  onDeleteResource?: (resource: ResourceItem) => void;
  onRefresh?: () => void;
}

const ResourceManager: React.FC<ResourceManagerProps> = ({
  onSelectResource,
  onAddResource,
  onDeleteResource,
  onRefresh,
}) => {
  const [resources, setResources] = useState<ResourceItem[]>([]);
  const [selectedResource, setSelectedResource] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [currentFolder, setCurrentFolder] = useState('assets/images');
  const [expandedFolders, setExpandedFolders] = useState<Set<string>>(new Set(['assets/images']));
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');

  // 模拟资源数据
  useEffect(() => {
    const mockResources: ResourceItem[] = [
      {
        id: '1',
        name: 'background.png',
        path: 'assets/images/background.png',
        type: 'image',
        size: 102400,
        modified: new Date(),
        thumbnail:
          'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==',
      },
      {
        id: '2',
        name: 'logo.png',
        path: 'assets/images/logo.png',
        type: 'image',
        size: 51200,
        modified: new Date(),
        thumbnail:
          'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==',
      },
      {
        id: '3',
        name: 'button_normal.png',
        path: 'assets/images/button_normal.png',
        type: 'image',
        size: 10240,
        modified: new Date(),
        thumbnail: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==',
      },
      {
        id: '4',
        name: 'button_pressed.png',
        path: 'assets/images/button_pressed.png',
        type: 'image',
        size: 10240,
        modified: new Date(),
        thumbnail: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==',
      },
      {
        id: '5',
        name: 'clock.png',
        path: 'assets/images/clock.png',
        type: 'image',
        size: 204800,
        modified: new Date(),
        thumbnail: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==',
      },
    ];
    setResources(mockResources);
  }, []);

  const filteredResources = resources.filter(
    (resource) =>
      resource.name.toLowerCase().includes(searchTerm.toLowerCase()) &&
      resource.path.startsWith(currentFolder)
  );;

  const handleSelectResource = (resource: ResourceItem) => {
    setSelectedResource(resource.id);
    if (onSelectResource) {
      onSelectResource(resource);
    }
  };

  const handleAddResource = () => {
    if (onAddResource) {
      onAddResource();
    }
  };

  const handleDeleteResource = (resource: ResourceItem) => {
    if (onDeleteResource) {
      onDeleteResource(resource);
    }
  };

  const handleRefresh = () => {
    if (onRefresh) {
      onRefresh();
    }
  };

  const formatFileSize = (bytes: number): string => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
  };

  const formatDateTime = (date: Date): string => {
    const now = new Date();
    const diffTime = Math.abs(Number(now) - Number(date));
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

    if (diffDays === 1) {
      return '今天 ' + date.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' });
    } else if (diffDays === 2) {
      return '昨天 ' + date.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' });
    } else if (diffDays < 7) {
      return `${diffDays} 天前`;
    } else {
      return date.toLocaleDateString('zh-CN');
    }
  };

  return (
    <div className="resource-manager">
      <div className="resource-header">
        <h3>资源管理器</h3>
        <div className="resource-actions">
          <button className="action-button" onClick={handleRefresh} title="刷新">
            <RefreshCw size={16} />
          </button>
          <div className="view-toggle">
            <button
              className={`view-button ${viewMode === 'grid' ? 'active' : ''}`}
              onClick={() => setViewMode('grid')}
              title="网格视图"
            >
              <Grid3x3 size={16} />
            </button>
            <button
              className={`view-button ${viewMode === 'list' ? 'active' : ''}`}
              onClick={() => setViewMode('list')}
              title="列表视图"
            >
              <List size={16} />
            </button>
          </div>
        </div>
      </div>

      <div className="resource-toolbar">
        <div className="search-box">
          <Search size={16} className="search-icon" />
          <input
            type="text"
            placeholder="搜索资源..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
        <button className="add-button" onClick={handleAddResource} title="添加资源">
          <Upload size={16} />
          <span>添加</span>
        </button>
      </div>

      {viewMode === 'grid' ? (
        <div className="resource-grid">
          {filteredResources.map((resource) => (
            <div
              key={resource.id}
              className={`resource-card ${selectedResource === resource.id ? 'selected' : ''}`}
              onClick={() => handleSelectResource(resource)}
            >
              {resource.type === 'folder' ? (
                <Folder className="resource-icon folder-icon" size={48} />
              ) : resource.type === 'image' && resource.thumbnail ? (
                <img src={resource.thumbnail} alt={resource.name} className="resource-thumbnail" />
              ) : (
                <FileImage className="resource-icon file-icon" size={48} />
              )}
              <div className="resource-name" title={resource.name}>
                {resource.name}
              </div>
              <div className="resource-info">
                <span className="resource-size">{formatFileSize(resource.size || 0)}</span>
                <span className="resource-date">{formatDateTime(resource.modified || new Date())}</span>
              </div>
              <div className="resource-actions-overlay">
                <button
                  className="action-button small"
                  onClick={(e) => {
                    e.stopPropagation();
                    handleDeleteResource(resource);
                  }}
                  title="删除"
                >
                  <Trash2 size={14} />
                </button>
                <button
                  className="action-button small"
                  onClick={(e) => {
                    e.stopPropagation();
                    console.log('Preview resource:', resource.name);
                  }}
                  title="预览"
                >
                  <Eye size={14} />
                </button>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="resource-list">
          {filteredResources.map((resource) => (
            <div
              key={resource.id}
              className={`resource-list-item ${selectedResource === resource.id ? 'selected' : ''}`}
              onClick={() => handleSelectResource(resource)}
            >
              {resource.type === 'folder' ? (
                <Folder className="list-icon folder-icon" size={20} />
              ) : resource.type === 'image' ? (
                <FileImage className="list-icon file-icon" size={20} />
              ) : (
                <File className="list-icon file-icon" size={20} />
              )}
              <div className="list-info">
                <div className="list-name" title={resource.name}>
                  {resource.name}
                </div>
                <div className="list-details">
                  <span className="resource-size">{formatFileSize(resource.size || 0)}</span>
                  <span className="resource-date">{formatDateTime(resource.modified || new Date())}</span>
                </div>
              </div>
              <div className="list-actions">
                <button
                  className="action-button small"
                  onClick={(e) => {
                    e.stopPropagation();
                    handleDeleteResource(resource);
                  }}
                  title="删除"
                >
                  <Trash2 size={14} />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {filteredResources.length === 0 && (
        <div className="empty-state">
          <FolderOpen size={48} />
          <p>暂无资源</p>
          <button className="add-button primary" onClick={handleAddResource}>
            <Upload size={16} />
            <span>添加资源</span>
          </button>
        </div>
      )}
    </div>
  );
};

export default ResourceManager;
