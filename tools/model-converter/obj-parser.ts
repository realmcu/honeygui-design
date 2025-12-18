/**
 * OBJ File Parser
 */

import * as fs from 'fs';
import * as path from 'path';
import { Vec3, Vec2, Index, Material, Shape, OBJModel } from './types';

export class OBJParser {
    parse(filePath: string, outputDir?: string): OBJModel {
        const content = fs.readFileSync(filePath, 'utf-8');
        const lines = content.split('\n');
        const dir = path.dirname(filePath);

        const vertices: Vec3[] = [];
        const normals: Vec3[] = [];
        const texcoords: Vec2[] = [];
        const indices: Index[] = [];
        const faceNumVerts: number[] = [];
        const materialIds: number[] = [];
        const shapes: Shape[] = [];
        const materials: Material[] = [];
        const materialMap = new Map<string, number>();
        let currentMaterialId = -1;
        let currentShapeStart = 0;
        let mtlLib: string | null = null;

        for (const line of lines) {
            const trimmed = line.trim();
            if (!trimmed || trimmed.startsWith('#')) continue;

            const parts = trimmed.split(/\s+/);
            const cmd = parts[0];

            switch (cmd) {
                case 'v': // Vertex
                    vertices.push({
                        x: parseFloat(parts[1]),
                        y: parseFloat(parts[2]),
                        z: parseFloat(parts[3]),
                    });
                    break;

                case 'vn': // Normal
                    normals.push({
                        x: parseFloat(parts[1]),
                        y: parseFloat(parts[2]),
                        z: parseFloat(parts[3]),
                    });
                    break;

                case 'vt': // Texcoord
                    texcoords.push({
                        x: parseFloat(parts[1]),
                        y: parseFloat(parts[2]),
                    });
                    break;

                case 'f': // Face
                    const faceIndices: Index[] = [];
                    for (let i = 1; i < parts.length; i++) {
                        const idx = this.parseIndex(parts[i]);
                        faceIndices.push(idx);
                    }
                    indices.push(...faceIndices);
                    faceNumVerts.push(faceIndices.length);
                    materialIds.push(currentMaterialId);
                    break;

                case 'mtllib': // Material library
                    mtlLib = parts[1];
                    break;

                case 'usemtl': // Use material
                    const matName = parts[1];
                    if (!materialMap.has(matName)) {
                        materialMap.set(matName, materials.length);
                        materials.push(this.createDefaultMaterial());
                    }
                    currentMaterialId = materialMap.get(matName)!;
                    break;

                case 'o':
                case 'g': // Object/Group (new shape)
                    if (faceNumVerts.length > currentShapeStart) {
                        shapes.push({
                            offset: currentShapeStart,
                            length: faceNumVerts.length - currentShapeStart,
                        });
                        currentShapeStart = faceNumVerts.length;
                    }
                    break;
            }
        }

        // Add final shape
        if (faceNumVerts.length > currentShapeStart) {
            shapes.push({
                offset: currentShapeStart,
                length: faceNumVerts.length - currentShapeStart,
            });
        }

        // Default shape if none
        if (shapes.length === 0) {
            shapes.push({ offset: 0, length: faceNumVerts.length });
        }

        // Load materials
        if (mtlLib) {
            const mtlPath = path.join(dir, mtlLib);
            if (fs.existsSync(mtlPath)) {
                this.loadMTL(mtlPath, materials, materialMap);
            }
        }

        // Load textures
        const textures: Buffer[] = [];
        for (const mat of materials) {
            const texturePath = (mat as any).texturePath;
            if (texturePath) {
                const fullPath = path.join(dir, texturePath);
                let binPath = fullPath.replace(/\.(png|jpe?g|bmp)$/i, '.bin');
                
                // 如果提供了 outputDir，优先在输出目录查找（图片已转换到输出目录）
                if (outputDir) {
                    const relativePath = path.relative(path.dirname(filePath), fullPath);
                    const outputBinPath = path.join(outputDir, relativePath).replace(/\.(png|jpe?g|bmp)$/i, '.bin');
                    if (fs.existsSync(outputBinPath)) {
                        binPath = outputBinPath;
                    }
                }
                
                if (fs.existsSync(binPath)) {
                    textures.push(fs.readFileSync(binPath));
                } else {
                    console.warn(`Texture bin not found: ${binPath}`);
                    textures.push(Buffer.alloc(0));
                }
            } else {
                textures.push(Buffer.alloc(0));
            }
        }

        return {
            vertices,
            normals,
            texcoords,
            indices,
            faceNumVerts,
            materialIds,
            shapes,
            materials,
            textures,
        };
    }

    private parseIndex(str: string): Index {
        const parts = str.split('/');
        return {
            vertex: parseInt(parts[0]) - 1,
            texcoord: parts[1] ? parseInt(parts[1]) - 1 : -1,
            normal: parts[2] ? parseInt(parts[2]) - 1 : -1,
        };
    }

    private createDefaultMaterial(): Material {
        return {
            ambient: { x: 0, y: 0, z: 0 },
            diffuse: { x: 1, y: 1, z: 1 },
            specular: { x: 0, y: 0, z: 0 },
            transmittance: { x: 0, y: 0, z: 0 },
            emission: { x: 0, y: 0, z: 0 },
            shininess: 0,
            ior: 1,
            dissolve: 1,
            illum: 1,
        };
    }

    private loadMTL(
        filePath: string,
        materials: Material[],
        materialMap: Map<string, number>
    ): void {
        const content = fs.readFileSync(filePath, 'utf-8');
        const lines = content.split('\n');
        let currentMat: Material | null = null;
        let currentName: string | null = null;

        for (const line of lines) {
            const trimmed = line.trim();
            if (!trimmed || trimmed.startsWith('#')) continue;

            const parts = trimmed.split(/\s+/);
            const cmd = parts[0];

            switch (cmd) {
                case 'newmtl':
                    currentName = parts[1];
                    if (materialMap.has(currentName)) {
                        currentMat = materials[materialMap.get(currentName)!];
                    }
                    break;

                case 'Ka':
                    if (currentMat) {
                        currentMat.ambient = {
                            x: parseFloat(parts[1]),
                            y: parseFloat(parts[2]),
                            z: parseFloat(parts[3]),
                        };
                    }
                    break;

                case 'Kd':
                    if (currentMat) {
                        currentMat.diffuse = {
                            x: parseFloat(parts[1]),
                            y: parseFloat(parts[2]),
                            z: parseFloat(parts[3]),
                        };
                    }
                    break;

                case 'Ks':
                    if (currentMat) {
                        currentMat.specular = {
                            x: parseFloat(parts[1]),
                            y: parseFloat(parts[2]),
                            z: parseFloat(parts[3]),
                        };
                    }
                    break;

                case 'Ns':
                    if (currentMat) {
                        currentMat.shininess = parseFloat(parts[1]);
                    }
                    break;

                case 'd':
                    if (currentMat) {
                        currentMat.dissolve = parseFloat(parts[1]);
                    }
                    break;

                case 'illum':
                    if (currentMat) {
                        currentMat.illum = parseInt(parts[1]);
                    }
                    break;

                case 'map_Kd':
                    if (currentMat) {
                        (currentMat as any).texturePath = parts[1];
                    }
                    break;
            }
        }
    }
}
