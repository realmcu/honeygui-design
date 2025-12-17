/**
 * GLTF Parser
 * Parse GLTF 2.0 files and extract geometry data
 */

import * as fs from 'fs';
import * as path from 'path';

interface Vec3 {
    x: number;
    y: number;
    z: number;
}

interface Vec2 {
    x: number;
    y: number;
}

interface Index {
    vertex: number;
    texcoord: number;
    normal: number;
}

interface Material {
    ambient: Vec3;
    diffuse: Vec3;
    specular: Vec3;
    transmittance: Vec3;
    emission: Vec3;
    shininess: number;
    ior: number;
    dissolve: number;
    illum: number;
}

interface Shape {
    offset: number;
    length: number;
}

export interface GLTFModel {
    vertices: Vec3[];
    normals: Vec3[];
    texcoords: Vec2[];
    indices: Index[];
    faceNumVerts: number[];
    materialIds: number[];
    shapes: Shape[];
    materials: Material[];
    textures: Buffer[];
}

export class GLTFParser {
    parse(gltfPath: string): GLTFModel {
        const gltfData = JSON.parse(fs.readFileSync(gltfPath, 'utf-8'));
        const baseDir = path.dirname(gltfPath);

        const model: GLTFModel = {
            vertices: [],
            normals: [],
            texcoords: [],
            indices: [],
            faceNumVerts: [],
            materialIds: [],
            shapes: [],
            materials: [],
            textures: [],
        };

        // Load buffers
        const buffers: Buffer[] = [];
        if (gltfData.buffers) {
            for (const buffer of gltfData.buffers) {
                // 检查是否是 data URI（嵌入式数据）
                if (buffer.uri && buffer.uri.startsWith('data:')) {
                    // 解析 data URI
                    const base64Data = buffer.uri.split(',')[1];
                    buffers.push(Buffer.from(base64Data, 'base64'));
                } else {
                    // 外部文件
                    const bufferPath = path.join(baseDir, buffer.uri);
                    if (!fs.existsSync(bufferPath)) {
                        throw new Error(
                            `GLTF buffer file not found: ${buffer.uri}\n` +
                            `Expected at: ${bufferPath}\n` +
                            `Please ensure the .bin file is in the same directory as the .gltf file.`
                        );
                    }
                    buffers.push(fs.readFileSync(bufferPath));
                }
            }
        }

        // Parse meshes
        if (gltfData.meshes) {
            for (const mesh of gltfData.meshes) {
                for (const primitive of mesh.primitives) {
                    const shapeOffset = model.indices.length;
                    
                    // Get attributes
                    const posAccessor = gltfData.accessors[primitive.attributes.POSITION];
                    const normalAccessor = primitive.attributes.NORMAL !== undefined 
                        ? gltfData.accessors[primitive.attributes.NORMAL] 
                        : null;
                    const texcoordAccessor = primitive.attributes.TEXCOORD_0 !== undefined
                        ? gltfData.accessors[primitive.attributes.TEXCOORD_0]
                        : null;

                    // Read positions
                    const positions = this.readAccessor(gltfData, buffers, posAccessor);
                    const vertexOffset = model.vertices.length;
                    for (let i = 0; i < positions.length; i += 3) {
                        model.vertices.push({
                            x: positions[i],
                            y: positions[i + 1],
                            z: positions[i + 2],
                        });
                    }

                    // Read normals
                    let normalOffset = model.normals.length;
                    if (normalAccessor) {
                        const normals = this.readAccessor(gltfData, buffers, normalAccessor);
                        for (let i = 0; i < normals.length; i += 3) {
                            model.normals.push({
                                x: normals[i],
                                y: normals[i + 1],
                                z: normals[i + 2],
                            });
                        }
                    }

                    // Read texcoords
                    let texcoordOffset = model.texcoords.length;
                    if (texcoordAccessor) {
                        const texcoords = this.readAccessor(gltfData, buffers, texcoordAccessor);
                        for (let i = 0; i < texcoords.length; i += 2) {
                            model.texcoords.push({
                                x: texcoords[i],
                                y: texcoords[i + 1],
                            });
                        }
                    }

                    // Read indices
                    if (primitive.indices !== undefined) {
                        const indexAccessor = gltfData.accessors[primitive.indices];
                        const indices = this.readAccessor(gltfData, buffers, indexAccessor);
                        
                        for (let i = 0; i < indices.length; i += 3) {
                            // Triangle
                            for (let j = 0; j < 3; j++) {
                                const idx = indices[i + j];
                                model.indices.push({
                                    vertex: vertexOffset + idx,
                                    texcoord: texcoordAccessor ? texcoordOffset + idx : -1,
                                    normal: normalAccessor ? normalOffset + idx : -1,
                                });
                            }
                            model.faceNumVerts.push(3);
                            model.materialIds.push(primitive.material !== undefined ? primitive.material : -1);
                        }
                    }

                    model.shapes.push({
                        offset: shapeOffset,
                        length: model.indices.length - shapeOffset,
                    });
                }
            }
        }

        // Parse materials
        if (gltfData.materials) {
            for (const mat of gltfData.materials) {
                const pbr = mat.pbrMetallicRoughness || {};
                const baseColor = pbr.baseColorFactor || [1, 1, 1, 1];
                
                model.materials.push({
                    ambient: { x: 0.2, y: 0.2, z: 0.2 },
                    diffuse: { x: baseColor[0], y: baseColor[1], z: baseColor[2] },
                    specular: { x: 0.5, y: 0.5, z: 0.5 },
                    transmittance: { x: 0, y: 0, z: 0 },
                    emission: { x: 0, y: 0, z: 0 },
                    shininess: 32.0,
                    ior: 1.0,
                    dissolve: baseColor[3],
                    illum: 2,
                });

                // Load texture if exists
                if (pbr.baseColorTexture) {
                    const texIndex = pbr.baseColorTexture.index;
                    const texture = gltfData.textures[texIndex];
                    const image = gltfData.images[texture.source];
                    const imagePath = path.join(baseDir, image.uri);
                    
                    // Try to load .bin version
                    const binPath = imagePath.replace(/\.(png|jpg|jpeg)$/i, '.bin');
                    if (fs.existsSync(binPath)) {
                        model.textures.push(fs.readFileSync(binPath));
                    } else {
                        model.textures.push(Buffer.alloc(0));
                    }
                } else {
                    model.textures.push(Buffer.alloc(0));
                }
            }
        }

        return model;
    }

    private readAccessor(gltfData: any, buffers: Buffer[], accessor: any): number[] {
        const bufferView = gltfData.bufferViews[accessor.bufferView];
        const buffer = buffers[bufferView.buffer];
        
        const offset = (bufferView.byteOffset || 0) + (accessor.byteOffset || 0);
        const count = accessor.count;
        const componentType = accessor.componentType;
        const type = accessor.type;

        const componentsPerElement = this.getComponentCount(type);
        const bytesPerComponent = this.getComponentSize(componentType);
        
        const result: number[] = [];
        
        for (let i = 0; i < count; i++) {
            for (let j = 0; j < componentsPerElement; j++) {
                const byteOffset = offset + (i * componentsPerElement + j) * bytesPerComponent;
                const value = this.readComponent(buffer, byteOffset, componentType);
                result.push(value);
            }
        }

        return result;
    }

    private getComponentCount(type: string): number {
        switch (type) {
            case 'SCALAR': return 1;
            case 'VEC2': return 2;
            case 'VEC3': return 3;
            case 'VEC4': return 4;
            default: return 1;
        }
    }

    private getComponentSize(componentType: number): number {
        switch (componentType) {
            case 5120: return 1; // BYTE
            case 5121: return 1; // UNSIGNED_BYTE
            case 5122: return 2; // SHORT
            case 5123: return 2; // UNSIGNED_SHORT
            case 5125: return 4; // UNSIGNED_INT
            case 5126: return 4; // FLOAT
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
