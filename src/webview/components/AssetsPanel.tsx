import React, { useState, useEffect, useRef } from 'react';
import { Trash2, Edit2, Upload, FolderUp } from 'lucide-react';
import { AssetFile } from '../types';
import './AssetsPanel.css';
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { OBJLoader } from 'three/examples/jsm/loaders/OBJLoader.js';
import { MTLLoader } from 'three/examples/jsm/loaders/MTLLoader.js';

// 文件类型分类
const IMAGE_EXTS = ['png', 'jpg', 'jpeg', 'gif', 'bmp', 'svg', 'webp'];
const VIDEO_EXTS = ['mp4', 'avi', 'mov', 'mkv', 'webm'];
const MODEL_EXTS = ['gltf', 'glb', 'obj'];
const FONT_EXTS = ['ttf', 'otf', 'woff', 'woff2', 'bin'];  // 字体文件
const MODEL_DEP_EXTS = ['mtl'];  // 3D 模型依赖文件

type AssetCategory = 'all' | 'images' | 'videos' | 'models' | 'fonts';

// 视频预览组件
const VideoPreview: React.FC<{ videoPath: string }> = ({ videoPath }) => {
  const [error, setError] = useState(false);
  
  if (error) {
    const fileName = videoPath.split('/').pop() || '';
    return (
      <div style={{ 
        width: '100%', 
        height: '100%', 
        display: 'flex', 
        flexDirection: 'column',
        alignItems: 'center', 
        justifyContent: 'center',
        background: '#1a1a2e',
        color: '#fff'
      }}>
        <div style={{ fontSize: '32px' }}>▶️</div>
        <div style={{ fontSize: '10px', marginTop: '4px' }}>{fileName}</div>
      </div>
    );
  }

  return (
    <video 
      src={videoPath}
      muted
      style={{ width: '100%', height: '100%', objectFit: 'cover' }}
      onLoadedData={(e) => {
        // 跳到第一帧
        (e.target as HTMLVideoElement).currentTime = 0.1;
      }}
      onError={() => setError(true)}
    />
  );
};

// 3D 模型预览组件
const Model3DPreview: React.FC<{ modelPath: string }> = ({ modelPath }) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const sceneRef = useRef<THREE.Scene | null>(null);
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const [error, setError] = useState(false);
  const [thumbnail, setThumbnail] = useState<string | null>(null);

  useEffect(() => {
    if (!containerRef.current || !modelPath) return;

    const scene = new THREE.Scene();
    scene.background = null;
    sceneRef.current = scene;
    
    const camera = new THREE.PerspectiveCamera(50, 1, 0.1, 1000);
    camera.position.set(0, 0, 0);
    camera.lookAt(0, 0, 1);
    cameraRef.current = camera;

    const renderer = new THREE.WebGLRenderer({ 
      antialias: true, 
      alpha: true,
      preserveDrawingBuffer: true  // 保持绘制缓冲区，防止内容丢失
    });
    renderer.setSize(100, 100);
    renderer.setPixelRatio(window.devicePixelRatio);
    renderer.sortObjects = true;
    rendererRef.current = renderer;
    
    // 监听WebGL上下文丢失和恢复
    const canvas = renderer.domElement;
    const handleContextLost = (event: Event) => {
      event.preventDefault();
      console.warn('[3D预览] WebGL上下文丢失');
    };
    
    const handleContextRestored = () => {
      console.log('[3D预览] WebGL上下文恢复，重新渲染');
      if (sceneRef.current && cameraRef.current && rendererRef.current) {
        rendererRef.current.render(sceneRef.current, cameraRef.current);
      }
    };
    
    canvas.addEventListener('webglcontextlost', handleContextLost);
    canvas.addEventListener('webglcontextrestored', handleContextRestored);
    
    containerRef.current.appendChild(renderer.domElement);

    // 添加光源（与设计窗口一致）
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.6);
    scene.add(ambientLight);
    
    const directionalLight1 = new THREE.DirectionalLight(0xffffff, 0.8);
    directionalLight1.position.set(5, -5, -5);
    scene.add(directionalLight1);
    
    const directionalLight2 = new THREE.DirectionalLight(0xffffff, 0.4);
    directionalLight2.position.set(-5, 5, 5);
    scene.add(directionalLight2);

    const ext = modelPath.split('.').pop()?.toLowerCase();

    const onLoadSuccess = (model: THREE.Object3D) => {
      // 调整坐标系：正X向右，正Y向下，正Z向里（与设计窗口一致）
      model.rotation.x = Math.PI;
      
      scene.add(model);
      
      // 计算模型边界并居中
      const box = new THREE.Box3().setFromObject(model);
      const center = box.getCenter(new THREE.Vector3());
      const size = box.getSize(new THREE.Vector3());
      
      // 将模型移到中心
      model.position.sub(center);
      
      // 调整相机位置以适应模型大小
      const maxDim = Math.max(size.x, size.y, size.z);
      const fov = camera.fov * (Math.PI / 180);
      let cameraZ = Math.abs(maxDim / 2 / Math.tan(fov / 2));
      cameraZ *= 1.5;
      camera.position.z = cameraZ;
      camera.lookAt(0, 0, 1);
      
      // 初始渲染
      renderer.render(scene, camera);
      
      // 生成缩略图并保存
      setTimeout(() => {
        renderer.render(scene, camera);
        try {
          const dataURL = renderer.domElement.toDataURL('image/png');
          setThumbnail(dataURL);
          
          // 生成缩略图后，清理WebGL资源
          renderer.dispose();
          scene.clear();
          if (containerRef.current && renderer.domElement.parentNode === containerRef.current) {
            containerRef.current.removeChild(renderer.domElement);
          }
          rendererRef.current = null;
          sceneRef.current = null;
          cameraRef.current = null;
        } catch (err) {
          console.warn('[3D预览] 生成缩略图失败:', err);
        }
      }, 200);
    };

    if (ext === 'gltf' || ext === 'glb') {
      const loader = new GLTFLoader();
      const gltfPath = modelPath.substring(0, modelPath.lastIndexOf('/') + 1);
      const gltfFileName = modelPath.substring(modelPath.lastIndexOf('/') + 1);
      
      loader.setPath(gltfPath);
      loader.load(
        gltfFileName,
        (gltf) => onLoadSuccess(gltf.scene),
        undefined,
        () => setError(true)
      );
    } else if (ext === 'obj') {
      const mtlPath = modelPath.replace(/\.obj$/i, '.mtl');
      const mtlLoader = new MTLLoader();
      
      const texturePath = mtlPath.substring(0, mtlPath.lastIndexOf('/') + 1);
      const mtlFileName = mtlPath.substring(mtlPath.lastIndexOf('/') + 1);
      
      mtlLoader.setPath(texturePath);
      mtlLoader.load(
        mtlFileName,
        (materials) => {
          materials.preload();
          
          // 修复材质（与设计窗口一致）
          Object.keys(materials.materials).forEach((key) => {
            const mat = materials.materials[key] as any;
            mat.side = THREE.DoubleSide;
            mat.flatShading = false;
            
            if (mat.opacity < 1.0 || mat.transparent) {
              mat.transparent = true;
              mat.alphaTest = 0.5;
            }
            
            if (mat.map) {
              mat.map.needsUpdate = true;
              mat.map.minFilter = THREE.LinearFilter;
              mat.map.magFilter = THREE.LinearFilter;
              mat.map.anisotropy = 16;
              
              if (mat.map.format === THREE.RGBAFormat) {
                mat.transparent = true;
                mat.alphaTest = 0.5;
              }
            }
            
            mat.needsUpdate = true;
          });
          
          const objLoader = new OBJLoader();
          const objPath = modelPath.substring(0, modelPath.lastIndexOf('/') + 1);
          const objFileName = modelPath.substring(modelPath.lastIndexOf('/') + 1);
          
          objLoader.setPath(objPath);
          objLoader.setMaterials(materials);
          objLoader.load(
            objFileName,
            (obj) => {
              // 确保材质正确应用
              obj.traverse((child: any) => {
                if (child.isMesh && child.material) {
                  if (child.material.type === 'MeshPhongMaterial') {
                    child.material.side = THREE.DoubleSide;
                    child.material.needsUpdate = true;
                  }
                }
              });
              onLoadSuccess(obj);
            },
            undefined,
            () => setError(true)
          );
        },
        undefined,
        () => {
          // MTL 加载失败，使用默认材质
          const objLoader = new OBJLoader();
          const objPath = modelPath.substring(0, modelPath.lastIndexOf('/') + 1);
          const objFileName = modelPath.substring(modelPath.lastIndexOf('/') + 1);
          
          objLoader.setPath(objPath);
          objLoader.load(
            objFileName,
            (obj) => {
              obj.traverse((child: any) => {
                if (child.isMesh) {
                  child.material = new THREE.MeshStandardMaterial({
                    color: 0xcccccc,
                    side: THREE.DoubleSide
                  });
                }
              });
              onLoadSuccess(obj);
            },
            undefined,
            () => setError(true)
          );
        }
      );
    }

    return () => {
      const canvas = rendererRef.current?.domElement;
      if (canvas) {
        canvas.removeEventListener('webglcontextlost', () => {});
        canvas.removeEventListener('webglcontextrestored', () => {});
      }
      
      if (rendererRef.current) {
        rendererRef.current.dispose();
        if (containerRef.current && rendererRef.current.domElement.parentNode === containerRef.current) {
          containerRef.current.removeChild(rendererRef.current.domElement);
        }
      }
      
      sceneRef.current = null;
      cameraRef.current = null;
      rendererRef.current = null;
    };
  }, [modelPath]);

  if (error) {
    return <div className="file-icon" style={{ fontSize: '48px' }}>🧊</div>;
  }

  // 如果已生成缩略图，显示图片而不是WebGL canvas
  if (thumbnail) {
    return (
      <img 
        src={thumbnail} 
        alt="3D Model Preview" 
        style={{ width: '100%', height: '100%', objectFit: 'contain' }}
      />
    );
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
  if (FONT_EXTS.includes(ext)) return 'fonts';
  return null;
};

// 判断是否是 3D 模型依赖文件
const isModelDependency = (name: string): boolean => {
  const ext = getFileExt(name);
  return MODEL_DEP_EXTS.includes(ext);
};

const AssetsPanel: React.FC = () => {
  const [assets, setAssets] = useState<AssetFile[]>([]);
  const [activeCategory, setActiveCategory] = useState<AssetCategory>('all');
  const [editingAsset, setEditingAsset] = useState<string | null>(null);
  const [newName, setNewName] = useState('');
  const [isDragOver, setIsDragOver] = useState(false);
  const [gridColumns, setGridColumns] = useState(3);
  const [currentPath, setCurrentPath] = useState<string[]>([]);  // 当前浏览路径
  const fileInputRef = useRef<HTMLInputElement>(null);
  const folderInputRef = useRef<HTMLInputElement>(null);

  // 获取当前路径下的内容（仅用于"全部"分类）
  const getCurrentFolderContent = React.useMemo(() => {
    let current = assets;
    
    // 根据 currentPath 导航到目标文件夹
    for (const folderName of currentPath) {
      const folder = current.find(item => item.type === 'folder' && item.name === folderName);
      if (folder && folder.children) {
        current = folder.children;
      } else {
        return { folders: [], files: [] };
      }
    }
    
    // 分离文件夹和文件
    const folders = current.filter(item => item.type === 'folder');
    const files = current.filter(item => item.type !== 'folder');
    
    return { folders, files };
  }, [assets, currentPath]);

  // 按类型分类资源
  const categorizedAssets = React.useMemo(() => {
    const result: Record<AssetCategory, AssetFile[]> = {
      all: [],
      images: [],
      videos: [],
      models: [],
      fonts: []
    };
    
    // "全部"分类：使用当前目录的文件
    if (activeCategory === 'all') {
      const { files } = getCurrentFolderContent;
      for (const asset of files) {
        const category = getAssetCategory(asset.name);
        if (category) {
          result.all.push(asset);
        }
        if (isModelDependency(asset.name)) {
          result.all.push(asset);
        }
      }
    }
    
    // 其他分类：递归扁平化所有文件
    const processAssets = (assetList: AssetFile[]) => {
      for (const asset of assetList) {
        if (asset.type === 'folder' && asset.children) {
          processAssets(asset.children);
        } else {
          const category = getAssetCategory(asset.name);
          if (category && category !== 'all') {
            result[category].push(asset);
          }
          if (isModelDependency(asset.name)) {
            result.models.push(asset);
          }
        }
      }
    };
    
    if (activeCategory !== 'all') {
      processAssets(assets);
    }
    
    return result;
  }, [assets, currentPath, getCurrentFolderContent, activeCategory]);

  // 获取各类型数量
  const counts = React.useMemo(() => ({
    all: categorizedAssets.all.length,
    images: categorizedAssets.images.length,
    videos: categorizedAssets.videos.length,
    models: categorizedAssets.models.length,
    fonts: categorizedAssets.fonts.length
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
    const isFont = FONT_EXTS.includes(ext);
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
          {isVideo && <VideoPreview videoPath={asset.path} />}
          {isFont && <div className="file-icon" style={{ fontSize: '48px' }}>🔤</div>}
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

  const renderFolderItem = (folder: AssetFile) => {
    return (
      <div 
        key={folder.path} 
        className="asset-grid-item folder-item"
        onClick={() => setCurrentPath([...currentPath, folder.name])}
      >
        <div className="asset-preview folder-preview">
          <div className="file-icon" style={{ fontSize: '48px' }}>📁</div>
        </div>
        <div className="asset-info">
          <span className="asset-name" title={folder.name}>{folder.name}</span>
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

    // 简化逻辑：拖拽什么就拷贝什么
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
    // 拷贝所有文件，不做过滤
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
  };

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    // 拷贝所有选中的文件，保留目录结构
    Array.from(files).forEach(file => {
      // webkitRelativePath 包含完整路径（如 "folder/subfolder/file.txt"）
      // 需要去掉文件名，只保留目录路径
      const relativePath = file.webkitRelativePath 
        ? file.webkitRelativePath.split('/').slice(0, -1).join('/')
        : '';
      processFile(file, relativePath);
    });
    
    if (fileInputRef.current) fileInputRef.current.value = '';
    if (folderInputRef.current) folderInputRef.current.value = '';
  };

  const currentAssets = categorizedAssets[activeCategory];
  const { folders } = getCurrentFolderContent;
  const emptyMessage = activeCategory === 'all' ? '暂无资源' : 
    activeCategory === 'images' ? '暂无图片资源' :
    activeCategory === 'videos' ? '暂无视频资源' : 
    activeCategory === 'models' ? '暂无3D模型资源' : '暂无字体资源';

  // 切换分类时重置路径
  const handleCategoryChange = (category: AssetCategory) => {
    setActiveCategory(category);
    if (category !== 'all') {
      setCurrentPath([]);  // 切换到其他分类时回到根目录
    }
  };

  return (
    <div className="assets-panel">
      <div className="assets-header">
        <select 
          className="category-select"
          value={activeCategory}
          onChange={(e) => handleCategoryChange(e.target.value as AssetCategory)}
        >
          <option value="all">全部 ({counts.all})</option>
          <option value="images">图片 ({counts.images})</option>
          <option value="videos">视频 ({counts.videos})</option>
          <option value="models">3D ({counts.models})</option>
          <option value="fonts">字体 ({counts.fonts})</option>
        </select>
        <button 
          className="upload-btn" 
          onClick={() => fileInputRef.current?.click()}
          title="上传文件"
        >
          <Upload size={16} />
        </button>
        <button 
          className="upload-btn" 
          onClick={() => folderInputRef.current?.click()}
          title="上传文件夹"
        >
          <FolderUp size={16} />
        </button>
        <input
          ref={fileInputRef}
          type="file"
          multiple
          accept=".png,.jpg,.jpeg,.gif,.bmp,.svg,.webp,.mp4,.avi,.mov,.mkv,.webm,.gltf,.glb,.obj,.mtl,.ttf,.otf,.woff,.woff2,.bin"
          style={{ display: 'none' }}
          onChange={handleFileSelect}
        />
        <input
          ref={folderInputRef}
          type="file"
          multiple
          {...({ webkitdirectory: '', directory: '' } as any)}
          style={{ display: 'none' }}
          onChange={handleFileSelect}
        />
      </div>
      
      {/* 面包屑导航 - 仅在"全部"分类时显示 */}
      {activeCategory === 'all' && (
        <div className="breadcrumb">
          <span 
            className="breadcrumb-item" 
            onClick={() => setCurrentPath([])}
            title="返回根目录"
          >
            🏠 根目录
          </span>
          {currentPath.map((folder, index) => (
            <React.Fragment key={index}>
              <span className="breadcrumb-separator">/</span>
              <span 
                className="breadcrumb-item"
                onClick={() => setCurrentPath(currentPath.slice(0, index + 1))}
                title={folder}
              >
                {folder}
              </span>
            </React.Fragment>
          ))}
        </div>
      )}
      
      <div className="assets-toolbar">
        <input 
          type="range" 
          min="2" 
          max="6" 
          value={gridColumns} 
          onChange={(e) => setGridColumns(Number(e.target.value))}
          title={`列数: ${gridColumns}`}
        />
        <span className="grid-columns-label">{gridColumns} 列</span>
      </div>
      <div 
        className={`assets-content ${isDragOver ? 'drag-over' : ''}`}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
      >
        {folders.length === 0 && currentAssets.length === 0 ? (
          <div className="empty-state">
            <p>{emptyMessage}</p>
            <p className="hint">拖拽文件到此处</p>
          </div>
        ) : (
          <div className="assets-grid" style={{ gridTemplateColumns: `repeat(${gridColumns}, 1fr)` }}>
            {/* 先显示文件夹（仅在"全部"分类时显示） */}
            {activeCategory === 'all' && folders.map(folder => renderFolderItem(folder))}
            {/* 再显示文件 */}
            {currentAssets.map(asset => renderAssetItem(asset))}
          </div>
        )}
      </div>
    </div>
  );
};

export default AssetsPanel;
