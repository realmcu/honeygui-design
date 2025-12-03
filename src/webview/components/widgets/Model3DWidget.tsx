import React, { useEffect, useRef } from 'react';
import { WidgetProps } from './types';
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader';
import { OBJLoader } from 'three/examples/jsm/loaders/OBJLoader';

export const Model3DWidget: React.FC<WidgetProps> = ({ component, style, handlers }) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const sceneRef = useRef<THREE.Scene | null>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  const modelRef = useRef<THREE.Object3D | null>(null);
  
  const modelPath = component.data?.modelPath as string;
  const rotationX = ((component.data?.rotationX as number) || 0) * Math.PI / 180;
  const rotationY = ((component.data?.rotationY as number) || 0) * Math.PI / 180;
  const rotationZ = ((component.data?.rotationZ as number) || 0) * Math.PI / 180;
  const scale = (component.data?.scale as number) || 1;

  useEffect(() => {
    if (!containerRef.current || !modelPath) return;

    // 初始化场景
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x2a2a2a);
    sceneRef.current = scene;

    // 初始化相机
    const camera = new THREE.PerspectiveCamera(
      45,
      containerRef.current.clientWidth / containerRef.current.clientHeight,
      0.1,
      1000
    );
    camera.position.z = 5;
    cameraRef.current = camera;

    // 初始化渲染器
    const renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setSize(containerRef.current.clientWidth, containerRef.current.clientHeight);
    containerRef.current.appendChild(renderer.domElement);
    rendererRef.current = renderer;

    // 添加光源
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.5);
    scene.add(ambientLight);
    const directionalLight = new THREE.DirectionalLight(0xffffff, 0.8);
    directionalLight.position.set(5, 5, 5);
    scene.add(directionalLight);

    // 加载模型
    const ext = modelPath.split('.').pop()?.toLowerCase();
    
    if (ext === 'gltf' || ext === 'glb') {
      const loader = new GLTFLoader();
      loader.load(
        modelPath,
        (gltf) => {
          const model = gltf.scene;
          model.scale.set(scale, scale, scale);
          model.rotation.set(rotationX, rotationY, rotationZ);
          scene.add(model);
          modelRef.current = model;
          
          // 居中模型
          const box = new THREE.Box3().setFromObject(model);
          const center = box.getCenter(new THREE.Vector3());
          model.position.sub(center);
        },
        undefined,
        (error) => {
          console.error('加载GLTF模型失败:', error);
        }
      );
    } else if (ext === 'obj') {
      const loader = new OBJLoader();
      loader.load(
        modelPath,
        (obj) => {
          obj.scale.set(scale, scale, scale);
          obj.rotation.set(rotationX, rotationY, rotationZ);
          scene.add(obj);
          modelRef.current = obj;
          
          // 居中模型
          const box = new THREE.Box3().setFromObject(obj);
          const center = box.getCenter(new THREE.Vector3());
          obj.position.sub(center);
        },
        undefined,
        (error) => {
          console.error('加载OBJ模型失败:', error);
        }
      );
    }

    // 动画循环
    const animate = () => {
      requestAnimationFrame(animate);
      if (modelRef.current) {
        modelRef.current.rotation.y += 0.005; // 自动旋转
      }
      renderer.render(scene, camera);
    };
    animate();

    // 清理
    return () => {
      if (rendererRef.current && containerRef.current) {
        containerRef.current.removeChild(rendererRef.current.domElement);
        rendererRef.current.dispose();
      }
    };
  }, [modelPath, rotationX, rotationY, rotationZ, scale]);

  return (
    <div key={component.id} style={style} {...handlers}>
      {modelPath ? (
        <div ref={containerRef} style={{ width: '100%', height: '100%' }} />
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
          <div style={{ fontSize: '10px', marginTop: '4px' }}>设置 modelPath 属性</div>
          <div style={{ fontSize: '10px', marginTop: '2px' }}>支持 GLTF/GLB/OBJ 格式</div>
        </div>
      )}
    </div>
  );
};
