/**
 * GLTF Parser - 基于 C 版本 extract_gltf_desc.c 重写
 * 完整支持 GLTF 2.0 格式，包括动画、皮肤等特性
 */

import * as fs from 'fs';
import * as path from 'path';

// ==================== 类型定义 ====================

export interface Vec3 {
    x: number;
    y: number;
    z: number;
}

export interface Vec2 {
    x: number;
    y: number;
}

// 完整顶点（包含骨骼权重）
export interface CompleteVertex {
    pos: Vec3;
    normal: Vec3;
    texcoord: Vec2;
    joints: number[];      // 4 个关节索引
    weights: number[];     // 4 个权重值
}

// 三角形
export interface Triangle {
    vertices: [CompleteVertex, CompleteVertex, CompleteVertex];
}

// 材质
export interface Material {
    baseColor: [number, number, number, number];  // RGBA 0-255
    textureData: Buffer | null;
}

// 节点
export interface Node {
    translation: [number, number, number];
    rotation: [number, number, number, number];  // 四元数
    scale: [number, number, number];
    meshIndex: number;          // -1 表示无网格
    parentIndex: number;        // -1 表示无父节点
    childrenIndices: number[];
    skinIndex: number;          // -1 表示无皮肤
}

// 图元
export interface Primitive {
    materialIndex: number;
    triangles: Triangle[];
}

// 网格
export interface Mesh {
    primitives: Primitive[];
}

// 皮肤
export interface Skin {
    jointIndices: number[];           // 关节节点索引
    inverseBindMatrices: Float32Array;  // 16 * jointCount 个 float
}

// 动画路径类型
export enum AnimationPath {
    TRANSLATION = 0,
    ROTATION = 1,
    SCALE = 2
}

// 插值类型
export enum InterpolationType {
    LINEAR = 0,
    STEP = 1,
    CUBICSPLINE = 2
}

// 数据类型
export enum DataType {
    VEC3 = 0,
    VEC4 = 1
}

// 采样器
export interface Sampler {
    inputData: Float32Array;      // 时间轴
    outputData: Float32Array;     // 关键帧值
    interpolation: InterpolationType;
    outputType: DataType;
}

// 通道
export interface Channel {
    samplerIndex: number;
    targetNodeIndex: number;
    targetPath: AnimationPath;
}

// 动画
export interface Animation {
    channels: Channel[];
    samplers: Sampler[];
}

// GLTF 模型
export interface GLTFModel {
    sceneRootIndices: number[];
    nodes: Node[];
    meshes: Mesh[];
    materials: Material[];
    skins: Skin[];
    animation: Animation | null;
}

// ==================== 解析器 ====================

export class GLTFParser {
    parse(gltfPath: string, outputDir?: string): GLTFModel {
        const gltfData = JSON.parse(fs.readFileSync(gltfPath, 'utf-8'));
        const baseDir = path.dirname(gltfPath);

        const model: GLTFModel = {
            sceneRootIndices: [],
            nodes: [],
            meshes: [],
            materials: [],
            skins: [],
            animation: null
        };

        // 加载 buffers
        const buffers: Buffer[] = [];
        if (gltfData.buffers) {
            for (const buffer of gltfData.buffers) {
                if (buffer.uri && buffer.uri.startsWith('data:')) {
                    const base64Data = buffer.uri.split(',')[1];
                    buffers.push(Buffer.from(base64Data, 'base64'));
                } else {
                    const bufferPath = path.join(baseDir, buffer.uri);
                    if (!fs.existsSync(bufferPath)) {
                        throw new Error(`GLTF buffer file not found: ${buffer.uri}`);
                    }
                    buffers.push(fs.readFileSync(bufferPath));
                }
            }
        }

        // 1. 解析节点
        model.nodes = this.parseNodes(gltfData, buffers);

        // 2. 解析场景根节点
        if (gltfData.scene !== undefined && gltfData.scenes && gltfData.scenes[gltfData.scene]) {
            const scene = gltfData.scenes[gltfData.scene];
            model.sceneRootIndices = scene.nodes || [];
        }

        // 3. 解析材质
        model.materials = this.parseMaterials(gltfData, baseDir, outputDir);

        // 4. 解析网格和图元
        model.meshes = this.parseMeshes(gltfData, buffers, model.materials);

        // 5. 解析皮肤
        model.skins = this.parseSkins(gltfData, buffers, model.nodes);

        // 6. 解析动画
        model.animation = this.parseAnimation(gltfData, buffers, model.nodes);

        return model;
    }

    private parseNodes(gltfData: any, buffers: Buffer[]): Node[] {
        if (!gltfData.nodes) return [];

        const nodes: Node[] = [];
        const allNodes = gltfData.nodes;

        for (let i = 0; i < allNodes.length; i++) {
            const srcNode = allNodes[i];
            const node: Node = {
                translation: srcNode.translation || [0, 0, 0],
                rotation: srcNode.rotation || [0, 0, 0, 1],
                scale: srcNode.scale || [1, 1, 1],
                meshIndex: srcNode.mesh !== undefined ? srcNode.mesh : -1,
                parentIndex: -1,
                childrenIndices: [],
                skinIndex: srcNode.skin !== undefined ? srcNode.skin : -1
            };

            if (srcNode.children) {
                node.childrenIndices = srcNode.children;
            }

            nodes.push(node);
        }

        // 填充父节点索引
        for (let i = 0; i < nodes.length; i++) {
            for (const childIdx of nodes[i].childrenIndices) {
                nodes[childIdx].parentIndex = i;
            }
        }

        return nodes;
    }

    private parseMaterials(gltfData: any, baseDir: string, outputDir?: string): Material[] {
        if (!gltfData.materials) return [];

        const materials: Material[] = [];

        for (const srcMat of gltfData.materials) {
            const material: Material = {
                baseColor: [255, 255, 255, 255],
                textureData: null
            };

            if (srcMat.pbrMetallicRoughness) {
                const pbr = srcMat.pbrMetallicRoughness;

                if (pbr.baseColorFactor) {
                    material.baseColor = [
                        Math.round(pbr.baseColorFactor[0] * 255),
                        Math.round(pbr.baseColorFactor[1] * 255),
                        Math.round(pbr.baseColorFactor[2] * 255),
                        Math.round(pbr.baseColorFactor[3] * 255)
                    ];
                }

                if (pbr.baseColorTexture && gltfData.textures && gltfData.images) {
                    const texIndex = pbr.baseColorTexture.index;
                    const texture = gltfData.textures[texIndex];
                    const image = gltfData.images[texture.source];

                    if (image.uri) {
                        console.log(`[GLTF Parser] Found texture URI: ${image.uri}`);
                        const imagePath = path.join(baseDir, image.uri);
                        let binPath = imagePath.replace(/\.(png|jpg|jpeg)$/i, '.bin');
                        console.log(`[GLTF Parser] Initial bin path: ${binPath}`);

                        // 如果提供了 outputDir，直接在 build/assets 根目录查找纹理bin（不保持子目录结构）
                        if (outputDir) {
                            const textureFileName = path.basename(image.uri).replace(/\.(png|jpg|jpeg)$/i, '.bin');
                            const outputBinPath = path.join(outputDir, textureFileName);
                            console.log(`[GLTF Parser] Checking output bin path: ${outputBinPath}`);
                            if (fs.existsSync(outputBinPath)) {
                                binPath = outputBinPath;
                                console.log(`[GLTF Parser] Using output bin path`);
                            }
                        }

                        console.log(`[GLTF Parser] Final bin path: ${binPath}`);
                        if (fs.existsSync(binPath)) {
                            material.textureData = fs.readFileSync(binPath);
                            console.log(`[GLTF Parser] ✓ Loaded texture data: ${material.textureData.length} bytes`);
                        } else {
                            console.warn(`[GLTF Parser] ✗ Texture bin not found: ${binPath}`);
                        }
                    }
                }
            }

            materials.push(material);
        }

        return materials;
    }

    private parseMeshes(gltfData: any, buffers: Buffer[], materials: Material[]): Mesh[] {
        if (!gltfData.meshes) return [];

        const meshes: Mesh[] = [];

        for (const srcMesh of gltfData.meshes) {
            const mesh: Mesh = { primitives: [] };

            for (const srcPrim of srcMesh.primitives) {
                if (srcPrim.mode !== undefined && srcPrim.mode !== 4) {
                    console.warn('Skipping non-triangle primitive');
                    continue;
                }

                const primitive = this.parsePrimitive(srcPrim, gltfData, buffers, materials);
                if (primitive) {
                    mesh.primitives.push(primitive);
                }
            }

            meshes.push(mesh);
        }

        return meshes;
    }

    private parsePrimitive(srcPrim: any, gltfData: any, buffers: Buffer[], materials: Material[]): Primitive | null {
        const posAccessor = srcPrim.attributes.POSITION !== undefined ? gltfData.accessors[srcPrim.attributes.POSITION] : null;
        const normAccessor = srcPrim.attributes.NORMAL !== undefined ? gltfData.accessors[srcPrim.attributes.NORMAL] : null;
        const uvAccessor = srcPrim.attributes.TEXCOORD_0 !== undefined ? gltfData.accessors[srcPrim.attributes.TEXCOORD_0] : null;
        const jointsAccessor = srcPrim.attributes.JOINTS_0 !== undefined ? gltfData.accessors[srcPrim.attributes.JOINTS_0] : null;
        const weightsAccessor = srcPrim.attributes.WEIGHTS_0 !== undefined ? gltfData.accessors[srcPrim.attributes.WEIGHTS_0] : null;
        const indicesAccessor = srcPrim.indices !== undefined ? gltfData.accessors[srcPrim.indices] : null;

        if (!posAccessor || !indicesAccessor) {
            console.warn('Primitive missing position or indices');
            return null;
        }

        const triangleCount = Math.floor(indicesAccessor.count / 3);
        const triangles: Triangle[] = [];

        for (let triIdx = 0; triIdx < triangleCount; triIdx++) {
            const triangle: Triangle = {
                vertices: [
                    this.createEmptyVertex(),
                    this.createEmptyVertex(),
                    this.createEmptyVertex()
                ]
            };

            for (let vertOfTri = 0; vertOfTri < 3; vertOfTri++) {
                const indexBufferPos = triIdx * 3 + vertOfTri;
                const originalVertexIndex = this.readAccessorUint(indicesAccessor, gltfData, buffers, indexBufferPos, 1) as number;

                const vertex = triangle.vertices[vertOfTri];

                const pos = this.readAccessorFloat(posAccessor, gltfData, buffers, originalVertexIndex, 3);
                vertex.pos = { x: pos[0], y: pos[1], z: pos[2] };

                if (normAccessor) {
                    const norm = this.readAccessorFloat(normAccessor, gltfData, buffers, originalVertexIndex, 3);
                    vertex.normal = { x: norm[0], y: norm[1], z: norm[2] };
                }

                if (uvAccessor) {
                    const uv = this.readAccessorFloat(uvAccessor, gltfData, buffers, originalVertexIndex, 2);
                    vertex.texcoord = { x: uv[0], y: uv[1] };
                }

                if (jointsAccessor) {
                    vertex.joints = this.readAccessorUint(jointsAccessor, gltfData, buffers, originalVertexIndex, 4) as number[];
                }

                if (weightsAccessor) {
                    vertex.weights = this.readAccessorFloat(weightsAccessor, gltfData, buffers, originalVertexIndex, 4);
                }
            }

            triangles.push(triangle);
        }

        return {
            materialIndex: srcPrim.material !== undefined ? srcPrim.material : -1,
            triangles
        };
    }

    private parseSkins(gltfData: any, buffers: Buffer[], nodes: Node[]): Skin[] {
        if (!gltfData.skins) return [];

        const skins: Skin[] = [];

        for (const srcSkin of gltfData.skins) {
            const skin: Skin = {
                jointIndices: srcSkin.joints || [],
                inverseBindMatrices: new Float32Array(0)
            };

            if (srcSkin.inverseBindMatrices !== undefined) {
                const accessor = gltfData.accessors[srcSkin.inverseBindMatrices];
                const matrixCount = accessor.count;
                const matrices = new Float32Array(matrixCount * 16);

                for (let i = 0; i < matrixCount; i++) {
                    const mat = this.readAccessorFloat(accessor, gltfData, buffers, i, 16);
                    // 转置矩阵
                    matrices[i * 16 + 0] = mat[0];
                    matrices[i * 16 + 1] = mat[4];
                    matrices[i * 16 + 2] = mat[8];
                    matrices[i * 16 + 3] = mat[12];
                    matrices[i * 16 + 4] = mat[1];
                    matrices[i * 16 + 5] = mat[5];
                    matrices[i * 16 + 6] = mat[9];
                    matrices[i * 16 + 7] = mat[13];
                    matrices[i * 16 + 8] = mat[2];
                    matrices[i * 16 + 9] = mat[6];
                    matrices[i * 16 + 10] = mat[10];
                    matrices[i * 16 + 11] = mat[14];
                    matrices[i * 16 + 12] = mat[3];
                    matrices[i * 16 + 13] = mat[7];
                    matrices[i * 16 + 14] = mat[11];
                    matrices[i * 16 + 15] = mat[15];
                }

                skin.inverseBindMatrices = matrices;
            }

            skins.push(skin);
        }

        return skins;
    }

    private parseAnimation(gltfData: any, buffers: Buffer[], nodes: Node[]): Animation | null {
        if (!gltfData.animations || gltfData.animations.length === 0) {
            return null;
        }

        const srcAnim = gltfData.animations[gltfData.animations.length - 1];

        const animation: Animation = {
            channels: [],
            samplers: []
        };

        for (const srcChannel of srcAnim.channels) {
            const channel: Channel = {
                samplerIndex: srcChannel.sampler,
                targetNodeIndex: srcChannel.target.node,
                targetPath: this.parseAnimationPath(srcChannel.target.path)
            };
            animation.channels.push(channel);
        }

        for (const srcSampler of srcAnim.samplers) {
            const inputAccessor = gltfData.accessors[srcSampler.input];
            const outputAccessor = gltfData.accessors[srcSampler.output];

            const inputCount = inputAccessor.count;
            const inputData = new Float32Array(inputCount);
            for (let i = 0; i < inputCount; i++) {
                inputData[i] = this.readAccessorFloat(inputAccessor, gltfData, buffers, i, 1)[0];
            }

            const outputType = outputAccessor.type === 'VEC3' ? DataType.VEC3 : DataType.VEC4;
            const componentsPerElement = outputType === DataType.VEC3 ? 3 : 4;
            const outputCount = outputAccessor.count;
            const outputData = new Float32Array(outputCount * componentsPerElement);
            for (let i = 0; i < outputCount; i++) {
                const values = this.readAccessorFloat(outputAccessor, gltfData, buffers, i, componentsPerElement);
                for (let j = 0; j < componentsPerElement; j++) {
                    outputData[i * componentsPerElement + j] = values[j];
                }
            }

            const sampler: Sampler = {
                inputData,
                outputData,
                interpolation: this.parseInterpolationType(srcSampler.interpolation),
                outputType
            };
            animation.samplers.push(sampler);
        }

        return animation;
    }

    private parseAnimationPath(path: string): AnimationPath {
        switch (path) {
            case 'translation': return AnimationPath.TRANSLATION;
            case 'rotation': return AnimationPath.ROTATION;
            case 'scale': return AnimationPath.SCALE;
            default: return AnimationPath.TRANSLATION;
        }
    }

    private parseInterpolationType(interp: string): InterpolationType {
        switch (interp) {
            case 'LINEAR': return InterpolationType.LINEAR;
            case 'STEP': return InterpolationType.STEP;
            case 'CUBICSPLINE': return InterpolationType.CUBICSPLINE;
            default: return InterpolationType.LINEAR;
        }
    }

    private createEmptyVertex(): CompleteVertex {
        return {
            pos: { x: 0, y: 0, z: 0 },
            normal: { x: 0, y: 0, z: 0 },
            texcoord: { x: 0, y: 0 },
            joints: [0, 0, 0, 0],
            weights: [0, 0, 0, 0]
        };
    }

    private readAccessorFloat(accessor: any, gltfData: any, buffers: Buffer[], index: number, componentCount: number): number[] {
        const bufferView = gltfData.bufferViews[accessor.bufferView];
        const buffer = buffers[bufferView.buffer];

        const offset = (bufferView.byteOffset || 0) + (accessor.byteOffset || 0);
        const stride = bufferView.byteStride || (componentCount * 4);
        const elementOffset = offset + index * stride;

        const result: number[] = [];
        for (let i = 0; i < componentCount; i++) {
            result.push(buffer.readFloatLE(elementOffset + i * 4));
        }
        return result;
    }

    private readAccessorUint(accessor: any, gltfData: any, buffers: Buffer[], index: number, componentCount: number = 1): number | number[] {
        const bufferView = gltfData.bufferViews[accessor.bufferView];
        const buffer = buffers[bufferView.buffer];

        const componentType = accessor.componentType;
        const componentSize = this.getComponentSize(componentType);
        const offset = (bufferView.byteOffset || 0) + (accessor.byteOffset || 0);
        const stride = bufferView.byteStride || (componentCount * componentSize);
        const elementOffset = offset + index * stride;

        if (componentCount === 1) {
            return this.readComponent(buffer, elementOffset, componentType);
        } else {
            const result: number[] = [];
            for (let i = 0; i < componentCount; i++) {
                result.push(this.readComponent(buffer, elementOffset + i * componentSize, componentType));
            }
            return result;
        }
    }

    private getComponentSize(componentType: number): number {
        switch (componentType) {
            case 5120: return 1;
            case 5121: return 1;
            case 5122: return 2;
            case 5123: return 2;
            case 5125: return 4;
            case 5126: return 4;
            default: return 4;
        }
    }

    private readComponent(buffer: Buffer, offset: number, componentType: number): number {
        switch (componentType) {
            case 5120: return buffer.readInt8(offset);
            case 5121: return buffer.readUInt8(offset);
            case 5122: return buffer.readInt16LE(offset);
            case 5123: return buffer.readUInt16LE(offset);
            case 5125: return buffer.readUInt32LE(offset);
            case 5126: return buffer.readFloatLE(offset);
            default: return 0;
        }
    }
}
