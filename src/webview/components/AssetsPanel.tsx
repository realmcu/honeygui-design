import React, { useState, useEffect, useRef } from 'react';
import { Trash2, Edit2 } from 'lucide-react';
import { AssetFile } from '../types';
import './AssetsPanel.css';
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { OBJLoader } from 'three/examples/jsm/loaders/OBJLoader.js';
import { MTLLoader } from 'three/examples/jsm/loaders/MTLLoader.js';
import { parseObjDependencies, parseMtlDependencies, findDependencyFiles } from '../utils/objDependencyParser';

// 文件类型分类
const IMAGE_EXTS = ['png', 'jpg', 'jpeg', 'gif', 'bmp', 'svg', 'webp'];
const VIDEO_EXTS = ['mp4', 'avi', 'mov', 'mkv', 'webm'];
const MODEL_EXTS = ['gltf', 'glb', 'obj'];
const MODEL_DEP_EXTS = ['mtl'];  // 3D 模型依赖文件

type AssetCategory = 'images' | 'videos' | 'models';

// 3D 模型预览组件
const Model3DPreview: React.FC<{ modelPath: string }> = ({ modelPath }) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    if (!containerRef.current || !modelPath) return;

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(50, 1, 0.1, 1000);
    camera.position.set(0, 0, -3);
    camera.lookAt(0, 0, 0);

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setSize(100, 100);
    renderer.setClearColor(0x000000, 0);
    containerRef.current.appendChild(renderer.domElement);

    const ambientLight = new THREE.AmbientLight(0xffffff, 0.6);
    scene.add(ambientLight);
    const directionalLight = new THREE.DirectionalLight(0xffffff, 0.8);
    directionalLight.position.set(5, -5, -5);
    scene.add(directionalLight);

    const ext = modelPath.split('.').pop()?.toLowerCase();

    if (ext === 'gltf' || ext === 'glb') {
      const loader = new GLTFLoader();
      loader.load(
        modelPath,
        (gltf) => {
          const model = gltf.scene;
          model.scale.set(1, -1, -1);
          model.rotation.y = Math.PI;
          scene.add(model);
          renderer.render(scene, camera);
        },
        undefined,
        () => setError(true)
      );
    } else if (ext === 'obj') {
      const mtlPath = modelPath.replace(/\.obj$/i, '.mtl');
      const mtlLoader = new MTLLoader();
      
      mtlLoader.load(
        mtlPath,
        (materials) => {
          materials.preload();
          const objLoader = new OBJLoader();
          objLoader.setMaterials(materials);
          objLoader.load(
            modelPath,
            (obj) => {
              obj.scale.set(1, -1, -1);
              obj.rotation.y = Math.PI;
              scene.add(obj);
              renderer.render(scene, camera);
            },
            undefined,
            () => setError(true)
          );
        },
        undefined,
        () => {
          const objLoader = new OBJLoader();
          objLoader.load(
            modelPath,
            (obj) => {
              obj.scale.set(1, -1, -1);
              obj.rotation.y = Math.PI;
              scene.add(obj);
              renderer.render(scene, camera);
            },
            undefined,
            () => setError(true)
          );
        }
      );
    }

    return () => {
      renderer.dispose();
      if (containerRef.current && renderer.domElement.parentNode === containerRef.current) {
        containerRef.current.removeChild(renderer.domElement);
      }
    };
  }, [modelPath]);

  if (error) {
    return <div className="file-icon" style={{ fontSize: '48px' }}>🧊</div>;
  }

  return <div ref={containerRef} style={{ width: '100%', height: '100%' }} />;
};

// 获取文件扩展名
const getFileExt = (name: string): string => {
  return name.split('.').pop()?.toLowerCase() || '';
};

// 判断文件类型
const getAssetCategory = (name: string): AssetCategory | null => {
  const ext = getFileExt(name);
  if (IMAGE_EXTS.includes(ext)) return 'images';
  if (VIDEO_EXTS.includes(ext)) return 'videos';
  if (MODEL_EXTS.includes(ext)) return 'models';
  return null;
};

// 判断是否是 3D 模型依赖文件
const isModelDependency = (name: string): boolean => {
  const ext = getFileExt(name);
  return MODEL_DEP_EXTS.includes(ext);
};

const AssetsPanel: React.FC = () => {
  const [assets, setAssets] = useState<AssetFile[]>([]);
  const [activeCategory, setActiveCategory] = useState<AssetCategory>('images');
  const [editingAsset, setEditingAsset] = useState<string | null>(null);
  const [newName, setNewName] = useState('');
  const [isDragOver, setIsDragOver] = useState(false);

  // 按类型分类资源（递归处理）
  const categorizedAssets = React.useMemo(() => {
    const result: Record<AssetCategory, AssetFile[]> = {
      images: [],
      videos: [],
      models: []
    };
    
    const processAssets = (assetList: AssetFile[]) => {
      for (const asset of assetList) {
        if (asset.type === 'folder' && asset.children) {
          processAssets(asset.children);
        } else {
          const category = getAssetCategory(asset.name);
          if (category) {
            result[category].push(asset);
          }
          // 将 mtl 文件也归类到 models（作为依赖显示）
          if (isModelDependency(asset.name)) {
            result.models.push(asset);
          }
        }
      }
    };
    
    processAssets(assets);
    return result;
  }, [assets]);

  // 获取各类型数量
  const counts = React.useMemo(() => ({
    images: categorizedAssets.images.length,
    videos: categorizedAssets.videos.length,
    models: categorizedAssets.models.length
  }), [categorizedAssets]);

  useEffect(() => {
    window.vscodeAPI?.postMessage({ command: 'loadAssets' });

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
    const fileName = assetPath.split('/').pop() || assetPath;
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

  const renderAssetItem = (asset: AssetFile) => {
    const ext = getFileExt(asset.name);
    const isImage = IMAGE_EXTS.includes(ext);
    const isVideo = VIDEO_EXTS.includes(ext);
    const isModel = MODEL_EXTS.includes(ext);
    const isMtl = MODEL_DEP_EXTS.includes(ext);
    
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
          {isImage && (
            <img
              src={asset.path}
              alt={asset.name}
              onError={(e) => {
                (e.target as HTMLImageElement).style.display = 'none';
              }}
            />
          )}
          {isModel && <Model3DPreview modelPath={asset.path} />}
          {isVideo && <div className="file-icon" style={{ fontSize: '48px' }}>🎬</div>}
          {isMtl && <div className="file-icon" style={{ fontSize: '48px' }}>📄</div>}
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
            <span className="asset-name" title={asset.name}>{asset.name}</span>
          )}
          <div className="asset-actions">
            <button onClick={() => handleRename(asset.path)} title="重命名" className="action-btn">
              <Edit2 size={12} />
            </button>
            <button onClick={() => handleDelete(asset.path)} title="删除" className="action-btn delete">
              <Trash2 size={12} />
            </button>
          </div>
        </div>
      </div>
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

    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      const files = Array.from(e.dataTransfer.files);
      const objFiles = files.filter(f => f.name.toLowerCase().endsWith('.obj'));
      
      if (objFiles.length > 0) {
        for (const objFile of objFiles) {
          await processObjWithDependencies(objFile, e.dataTransfer.files, '');
        }
        
        const processedNames = new Set<string>();
        for (const objFile of objFiles) {
          const deps = await parseObjDependencies(objFile);
          processedNames.add(objFile.name);
          if (deps.mtlFile) processedNames.add(deps.mtlFile);
          
          const depFiles = findDependencyFiles(objFile.name, deps, e.dataTransfer.files);
          if (depFiles.mtl) {
            const mtlDeps = await parseMtlDependencies(depFiles.mtl, deps);
            mtlDeps.textures.forEach(t => processedNames.add(t));
          }
        }
        
        files.forEach(file => {
          if (!processedNames.has(file.name)) {
            processFile(file, '');
          }
        });
        return;
      }
    }

    if (e.dataTransfer.items) {
      const items = Array.from(e.dataTransfer.items);
      for (const item of items) {
        const entry = item.webkitGetAsEntry?.();
        if (entry) {
          await processEntry(entry, '');
        }
      }
    } else if (e.dataTransfer.files) {
      Array.from(e.dataTransfer.files).forEach(file => processFile(file, ''));
    }
  };

  const processObjWithDependencies = async (objFile: File, fileList: FileList, relativePath: string) => {
    const deps = await parseObjDependencies(objFile);
    const depFiles = findDependencyFiles(objFile.name, deps, fileList);
    
    if (depFiles.mtl) {
      const mtlDeps = await parseMtlDependencies(depFiles.mtl, deps);
      deps.textures = mtlDeps.textures;
      depFiles.textures = Array.from(fileList).filter(f => deps.textures.includes(f.name));
    }
    
    await uploadFile(objFile, relativePath);
    if (depFiles.mtl) await uploadFile(depFiles.mtl, relativePath);
    for (const textureFile of depFiles.textures) {
      await uploadFile(textureFile, relativePath);
    }
    
    const missingFiles: string[] = [];
    if (deps.mtlFile && !depFiles.mtl) missingFiles.push(deps.mtlFile);
    const missingTextures = deps.textures.filter(t => !depFiles.textures.some(f => f.name === t));
    missingFiles.push(...missingTextures);
    
    if (missingFiles.length > 0) {
      window.vscodeAPI?.postMessage({
        command: 'notify',
        text: `${objFile.name} 缺少依赖文件: ${missingFiles.join(', ')}。请同时选中这些文件一起拖拽。`
      });
    }
  };

  const uploadFile = (file: File, relativePath: string): Promise<void> => {
    return new Promise((resolve) => {
      const reader = new FileReader();
      reader.onload = (event) => {
        const arrayBuffer = event.target?.result as ArrayBuffer;
        const uint8Array = new Uint8Array(arrayBuffer);
        window.vscodeAPI?.postMessage({
          command: 'saveImageToAssets',
          fileName: file.name,
          fileData: Array.from(uint8Array),
          relativePath: relativePath,
          dropPosition: undefined,
          targetContainerId: undefined
        });
        resolve();
      };
      reader.readAsArrayBuffer(file);
    });
  };

  const processEntry = async (entry: any, relativePath: string): Promise<void> => {
    if (entry.isFile) {
      entry.file((file: File) => processFile(file, relativePath));
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
    const ext = getFileExt(file.name);
    const validExts = [...IMAGE_EXTS, ...VIDEO_EXTS, ...MODEL_EXTS, ...MODEL_DEP_EXTS];
    
    if (validExts.includes(ext)) {
      const reader = new FileReader();
      reader.onload = (event) => {
        const arrayBuffer = event.target?.result as ArrayBuffer;
        const uint8Array = new Uint8Array(arrayBuffer);
        window.vscodeAPI?.postMessage({
          command: 'saveImageToAssets',
          fileName: file.name,
          fileData: Array.from(uint8Array),
          relativePath: relativePath,
          dropPosition: undefined,
          targetContainerId: undefined
        });
      };
      reader.readAsArrayBuffer(file);
    }
  };

  const currentAssets = categorizedAssets[activeCategory];
  const emptyMessages: Record<AssetCategory, string> = {
    images: '暂无图片资源',
    videos: '暂无视频资源',
    models: '暂无3D模型资源'
  };

  return (
    <div className="assets-panel">
      <div className="assets-tabs">
        <button 
          className={`assets-tab ${activeCategory === 'images' ? 'active' : ''}`}
          onClick={() => setActiveCategory('images')}
        >
          图片 ({counts.images})
        </button>
        <button 
          className={`assets-tab ${activeCategory === 'videos' ? 'active' : ''}`}
          onClick={() => setActiveCategory('videos')}
        >
          视频 ({counts.videos})
        </button>
        <button 
          className={`assets-tab ${activeCategory === 'models' ? 'active' : ''}`}
          onClick={() => setActiveCategory('models')}
        >
          3D ({counts.models})
        </button>
      </div>
      <div 
        className={`assets-content ${isDragOver ? 'drag-over' : ''}`}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
      >
        {currentAssets.length === 0 ? (
          <div className="empty-state">
            <p>{emptyMessages[activeCategory]}</p>
            <p className="hint">拖拽文件到此处</p>
          </div>
        ) : (
          <div className="assets-grid">
            {currentAssets.map(asset => renderAssetItem(asset))}
          </div>
        )}
      </div>
    </div>
  );
};

export default AssetsPanel;
