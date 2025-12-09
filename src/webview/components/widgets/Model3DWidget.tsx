import React, { useEffect, useRef, useState } from 'react';
import { WidgetProps } from './types';
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { OBJLoader } from 'three/examples/jsm/loaders/OBJLoader.js';
import { MTLLoader } from 'three/examples/jsm/loaders/MTLLoader.js';
import { useWebviewUri } from '../../hooks/useWebviewUri';

export const Model3DWidget: React.FC<WidgetProps> = ({ component, style, handlers }) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const sceneRef = useRef<THREE.Scene | null>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  const modelRef = useRef<THREE.Object3D | null>(null);
  const animationIdRef = useRef<number | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  
  const modelPath = component.data?.modelPath as string;
  
  // 自动查找同名MTL文件（将 .obj 替换为 .mtl）
  const autoMtlPath = modelPath && modelPath.toLowerCase().endsWith('.obj')
    ? modelPath.replace(/\.obj$/i, '.mtl')
    : undefined;
  
  // 转换为 webview URI
  const modelUri = useWebviewUri(modelPath);
  const mtlUri = useWebviewUri(autoMtlPath);
  
  const rotationX = ((component.data?.rotationX as number) || 0) * Math.PI / 180;
  const rotationY = ((component.data?.rotationY as number) || 0) * Math.PI / 180;
  const rotationZ = ((component.data?.rotationZ as number) || 0) * Math.PI / 180;
  const scale = (component.data?.scale as number) || 1;

  useEffect(() => {
    if (!containerRef.current || !modelUri) return;

    setIsLoading(true);
    setLoadError(null);

    // 初始化场景
    const scene = new THREE.Scene();
    // 透明背景，融入设计窗口
    scene.background = null;
    sceneRef.current = scene;

    // 初始化相机
    const width = containerRef.current.clientWidth;
    const height = containerRef.current.clientHeight;
    const camera = new THREE.PerspectiveCamera(50, width / height, 0.1, 1000);
    // 调整相机位置以适应新坐标系（Y向下，Z向里）
    // 相机在 -Z 方向看向原点
    camera.position.set(0, 0, -5);
    camera.lookAt(0, 0, 0);
    cameraRef.current = camera;

    // 初始化渲染器
    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setSize(width, height);
    renderer.setPixelRatio(window.devicePixelRatio);
    // 启用透明度排序
    renderer.sortObjects = true;
    containerRef.current.appendChild(renderer.domElement);
    rendererRef.current = renderer;



    // 添加光源（适应新坐标系）
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.6);
    scene.add(ambientLight);
    
    // 主光源从前上方照射
    const directionalLight1 = new THREE.DirectionalLight(0xffffff, 0.8);
    directionalLight1.position.set(5, -5, -5); // Y向下，Z向里
    scene.add(directionalLight1);
    
    // 补光从后下方
    const directionalLight2 = new THREE.DirectionalLight(0xffffff, 0.4);
    directionalLight2.position.set(-5, 5, 5);
    scene.add(directionalLight2);

    // 加载模型
    const ext = modelPath?.split('.').pop()?.toLowerCase();
    
    const onLoadSuccess = (model: THREE.Object3D) => {
      // 调整坐标系：正X向右，正Y向下，正Z向里
      // 使用缩放来翻转Y和Z轴
      model.scale.set(scale, -scale, -scale);
      
      // 绕Y轴旋转180度
      model.rotation.y = Math.PI;
      
      // 应用用户设置的旋转
      model.rotation.x += rotationX;
      model.rotation.y += rotationY;
      model.rotation.z += rotationZ;
      
      scene.add(model);
      modelRef.current = model;
      
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
      cameraZ *= 1.5; // 留一些边距
      // 相机在 -Z 方向（向里的反方向）
      camera.position.z = -cameraZ;
      camera.lookAt(0, 0, 0);
      
      setIsLoading(false);
      console.log('[3D模型] 加载成功:', modelPath, '(URI:', modelUri, ')');
    };
    
    const onLoadError = (error: any) => {
      // 只在控制台打印，不显示错误状态（因为MTL失败后还会尝试加载OBJ）
      console.warn('[3D模型] 加载警告:', error?.message || error);
      setLoadError(`加载失败: ${error?.message || '未知错误'}`);
      setIsLoading(false);
    };
    
    if (ext === 'gltf') {
      console.log('[3D模型] 加载GLTF文件');
      console.log('[3D模型] modelUri:', modelUri);
      console.log('[3D模型] modelPath:', modelPath);
      
      const loader = new GLTFLoader();
      
      // GLTF 文件可能引用外部资源，需要设置基础路径
      const gltfPath = modelUri.substring(0, modelUri.lastIndexOf('/') + 1);
      const gltfFileName = modelUri.substring(modelUri.lastIndexOf('/') + 1);
      
      console.log('[3D模型] 加载 GLTF（JSON格式）');
      console.log('[3D模型] gltfPath:', gltfPath);
      console.log('[3D模型] gltfFileName:', gltfFileName);
      
      loader.setPath(gltfPath);
      loader.load(
        gltfFileName,
        (gltf: any) => onLoadSuccess(gltf.scene),
        (progress: any) => {
          const percent = (progress.loaded / progress.total) * 100;
          console.log(`[3D模型] 加载中: ${percent.toFixed(0)}%`);
        },
        onLoadError
      );
    } else if (ext === 'obj') {
      console.log('[3D模型] 加载OBJ文件');
      console.log('[3D模型] 自动MTL路径:', autoMtlPath);
      console.log('[3D模型] mtlUri:', mtlUri);
      
      // 尝试加载同名MTL文件
      if (mtlUri && (mtlUri.startsWith('http') || mtlUri.startsWith('vscode-webview'))) {
        console.log('[3D模型] 加载MTL材质');
        console.log('[3D模型] mtlUri:', mtlUri);
        
        // 先加载 MTL 材质
        const mtlLoader = new MTLLoader();
        // 设置纹理路径（假设纹理和 MTL 在同一目录）
        const texturePath = mtlUri.substring(0, mtlUri.lastIndexOf('/') + 1);
        const mtlFileName = mtlUri.substring(mtlUri.lastIndexOf('/') + 1);
        
        console.log('[3D模型] texturePath:', texturePath);
        console.log('[3D模型] mtlFileName:', mtlFileName);
        
        mtlLoader.setPath(texturePath);
        
        mtlLoader.load(
          mtlFileName,  // 只传文件名，不是完整URI
          (materials: any) => {
            materials.preload();
            console.log('[3D模型] MTL 材质加载成功');
            console.log('[3D模型] 材质列表:', Object.keys(materials.materials));
            
            // 检查并修复材质
            console.log('[3D模型] MTL材质数量:', Object.keys(materials.materials).length);
            Object.keys(materials.materials).forEach((key) => {
              const mat = materials.materials[key];
              console.log('[3D模型] MTL材质:', key);
              console.log('[3D模型]   - Kd颜色:', mat.color?.r, mat.color?.g, mat.color?.b);
              console.log('[3D模型]   - 颜色hex:', mat.color?.getHexString());
              console.log('[3D模型]   - 材质类型:', mat.type);
              console.log('[3D模型]   - 透明度:', mat.opacity);
              
              // 强制设置材质属性
              mat.side = THREE.DoubleSide;
              mat.flatShading = false;
              
              // 启用透明度支持
              if (mat.opacity < 1.0 || mat.transparent) {
                mat.transparent = true;
                mat.alphaTest = 0.5; // 设置 alpha 测试阈值
                console.log('[3D模型]   - 启用透明度');
              }
              
              // 处理贴图
              if (mat.map) {
                mat.map.needsUpdate = true;
                // 设置纹理过滤，避免像素错乱
                mat.map.minFilter = THREE.LinearFilter;
                mat.map.magFilter = THREE.LinearFilter;
                mat.map.anisotropy = 16; // 各向异性过滤，提高纹理质量
                console.log('[3D模型]   - 有贴图');
                
                // 如果贴图有 alpha 通道，启用透明度
                if (mat.map.format === THREE.RGBAFormat) {
                  mat.transparent = true;
                  mat.alphaTest = 0.5;
                  console.log('[3D模型]   - 贴图包含透明通道');
                }
              }
              
              mat.needsUpdate = true;
            });
            
            // 使用材质加载 OBJ
            const objLoader = new OBJLoader();
            const objPath = modelUri.substring(0, modelUri.lastIndexOf('/') + 1);
            const objFileName = modelUri.substring(modelUri.lastIndexOf('/') + 1);
            
            console.log('[3D模型] objPath:', objPath);
            console.log('[3D模型] objFileName:', objFileName);
            
            // 设置资源路径
            objLoader.setPath(objPath);
            // 设置我们手动加载的材质
            objLoader.setMaterials(materials);
            objLoader.load(
              objFileName,  // 只传文件名
              (obj: any) => {
                console.log('[3D模型] OBJ 加载完成，开始遍历网格...');
                let meshCount = 0;
                
                // 获取所有MTL材质
                const mtlMaterials = materials.materials;
                const mtlMaterialNames = Object.keys(mtlMaterials);
                console.log('[3D模型] 可用的MTL材质:', mtlMaterialNames);
                
                // 遍历所有网格，检查并应用正确的MTL材质
                obj.traverse((child: any) => {
                  if (child.isMesh) {
                    meshCount++;
                    console.log(`[3D模型] 网格 ${meshCount}:`, child.name || '未命名');
                    
                    // 检查材质是否是数组（多材质）
                    const isMultiMaterial = Array.isArray(child.material);
                    console.log('[3D模型]   - 多材质:', isMultiMaterial);
                    
                    if (isMultiMaterial) {
                      // 处理多材质
                      console.log('[3D模型]   - 材质数量:', child.material.length);
                      child.material.forEach((mat: any, index: number) => {
                        console.log(`[3D模型]   - 材质${index}:`, mat.name, mat.type, mat.color?.getHexString());
                        if (mat.type === 'MeshPhongMaterial') {
                          mat.side = THREE.DoubleSide;
                          mat.needsUpdate = true;
                        }
                      });
                    } else if (child.material) {
                      // 单个材质
                      console.log('[3D模型]   - 材质名:', child.material.name);
                      console.log('[3D模型]   - 材质类型:', child.material.type);
                      console.log('[3D模型]   - 材质颜色:', child.material.color?.getHexString());
                      
                      if (child.material.type === 'MeshPhongMaterial') {
                        console.log('[3D模型]   - ✓ MTL材质已正确应用');
                        child.material.side = THREE.DoubleSide;
                        child.material.needsUpdate = true;
                      } else {
                        console.log('[3D模型]   - ✗ 使用默认材质，尝试匹配MTL...');
                        let matchedMaterial = null;
                        
                        if (child.material.name && mtlMaterials[child.material.name]) {
                          matchedMaterial = mtlMaterials[child.material.name];
                          console.log('[3D模型]   - 根据名称匹配:', child.material.name);
                        } else if (mtlMaterialNames.length > 0) {
                          matchedMaterial = mtlMaterials[mtlMaterialNames[0]];
                          console.log('[3D模型]   - 使用第一个MTL材质:', mtlMaterialNames[0]);
                        }
                        
                        if (matchedMaterial) {
                          child.material = matchedMaterial;
                          child.material.side = THREE.DoubleSide;
                          child.material.needsUpdate = true;
                          console.log('[3D模型]   - 应用后颜色:', child.material.color?.getHexString());
                        }
                      }
                    } else {
                      console.warn('[3D模型]   - 警告：网格没有材质！');
                    }
                  }
                });
                
                console.log(`[3D模型] 共找到 ${meshCount} 个网格`);
                onLoadSuccess(obj);
              },
              (progress: any) => {
                const percent = (progress.loaded / progress.total) * 100;
                console.log(`[3D模型] 加载中: ${percent.toFixed(0)}%`);
              },
              onLoadError
            );
          },
          (progress: any) => {
            console.log('[3D模型] MTL 加载中...');
          },
          (error: any) => {
            // MTL 加载失败是正常情况（可能没有MTL文件），静默处理
            // 使用默认材质加载 OBJ
            const objLoader = new OBJLoader();
            const objPath = modelUri.substring(0, modelUri.lastIndexOf('/') + 1);
            const objFileName = modelUri.substring(modelUri.lastIndexOf('/') + 1);
            objLoader.setPath(objPath);
            objLoader.load(
              objFileName,
              (obj: any) => {
                // 应用默认材质
                obj.traverse((child: any) => {
                  if (child.isMesh) {
                    child.material = new THREE.MeshStandardMaterial({
                      color: 0xcccccc,
                      side: THREE.DoubleSide
                    });
                    
                    console.log('[3D模型]   - 应用默认灰色材质');
                  }
                });
                onLoadSuccess(obj);
              },
              undefined,
              onLoadError
            );
          }
        );
      } else {
        // 没有找到MTL文件或URI未转换完成，使用默认材质
        console.log('[3D模型] 没有MTL文件或URI未就绪，使用默认材质');
        console.log('[3D模型] mtlUri:', mtlUri);
        const loader = new OBJLoader();
        const objPath = modelUri.substring(0, modelUri.lastIndexOf('/') + 1);
        const objFileName = modelUri.substring(modelUri.lastIndexOf('/') + 1);
        loader.setPath(objPath);
        loader.load(
          objFileName,
          (obj: any) => {
            // 应用默认材质
            obj.traverse((child: any) => {
              if (child.isMesh) {
                child.material = new THREE.MeshStandardMaterial({
                  color: 0xcccccc,
                  side: THREE.DoubleSide
                });
                
                console.log('[3D模型]   - 应用默认灰色材质');
              }
            });
            onLoadSuccess(obj);
          },
          (progress: any) => {
            const percent = (progress.loaded / progress.total) * 100;
            console.log(`[3D模型] 加载中: ${percent.toFixed(0)}%`);
          },
          onLoadError
        );
      }
    } else {
      setLoadError(`不支持的文件格式: ${ext}`);
      setIsLoading(false);
    }

    // 动画循环
    const animate = () => {
      animationIdRef.current = requestAnimationFrame(animate);
      if (rendererRef.current && sceneRef.current && cameraRef.current) {
        rendererRef.current.render(sceneRef.current, cameraRef.current);
      }
    };
    animate();

    // 清理
    return () => {
      if (animationIdRef.current) {
        cancelAnimationFrame(animationIdRef.current);
      }
      if (rendererRef.current && containerRef.current) {
        if (containerRef.current.contains(rendererRef.current.domElement)) {
          containerRef.current.removeChild(rendererRef.current.domElement);
        }
        rendererRef.current.dispose();
      }
      if (sceneRef.current) {
        sceneRef.current.clear();
      }
    };
  }, [modelUri, mtlUri, rotationX, rotationY, rotationZ, scale]);

  return (
    <div key={component.id} style={style} {...handlers}>
      {modelPath ? (
        <div style={{ width: '100%', height: '100%', position: 'relative' }}>
          <div ref={containerRef} style={{ width: '100%', height: '100%' }} />
          {isLoading && (
            <div style={{
              position: 'absolute',
              top: '50%',
              left: '50%',
              transform: 'translate(-50%, -50%)',
              background: 'rgba(0, 0, 0, 0.7)',
              color: 'white',
              padding: '10px 20px',
              borderRadius: '4px',
              fontSize: '12px',
              pointerEvents: 'none'
            }}>
              加载中...
            </div>
          )}
          {loadError && (
            <div style={{
              position: 'absolute',
              top: '50%',
              left: '50%',
              transform: 'translate(-50%, -50%)',
              background: 'rgba(200, 0, 0, 0.8)',
              color: 'white',
              padding: '10px 20px',
              borderRadius: '4px',
              fontSize: '12px',
              textAlign: 'center',
              maxWidth: '80%'
            }}>
              {loadError}
            </div>
          )}

        </div>
      ) : (
        <div style={{ 
          width: '100%', 
          height: '100%', 
          display: 'flex', 
          flexDirection: 'column',
          alignItems: 'center', 
          justifyContent: 'center',
          background: 'rgba(100, 100, 100, 0.2)',
          border: '2px dashed rgba(150, 150, 150, 0.5)',
          color: 'rgba(100, 100, 100, 0.8)',
          fontSize: '12px'
        }}>
          <div style={{ fontSize: '48px', marginBottom: '8px' }}>🧊</div>
          <div>3D模型组件</div>
          <div style={{ fontSize: '10px', marginTop: '4px' }}>拖拽 3D 模型文件到此处</div>
          <div style={{ fontSize: '10px', marginTop: '2px' }}>支持 OBJ/GLTF 格式</div>
          <div style={{ fontSize: '9px', marginTop: '2px', opacity: 0.7, textAlign: 'center', maxWidth: '200px' }}>
            OBJ格式：MTL材质和纹理需在同目录<br/>
            GLTF格式：BIN文件和纹理需在同目录
          </div>
        </div>
      )}
    </div>
  );
};
