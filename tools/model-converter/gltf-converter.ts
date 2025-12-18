/**
 * GLTF Converter - 基于 C 版本 extract_gltf_desc.c 重写
 * 生成完整的 GLTF 二进制格式，包括 data blob
 */

import * as fs from 'fs';
import { GLTFParser, GLTFModel } from './gltf-parser';
import { ModelType, TOOL_VERSION, MAGIC } from './types';

export class GLTFConverter {
    convert(gltfPath: string, binPath: string, txtPath: string, outputDir?: string): void {
        const parser = new GLTFParser();
        const model = parser.parse(gltfPath, outputDir);

        // 创建 data blob
        const blob = new DataBlob();

        // === Phase 1: 准备所有数据并填充 blob ===
        
        // Scene Roots
        const sceneRootsBuf = Buffer.alloc(model.sceneRootIndices.length * 4);
        for (let i = 0; i < model.sceneRootIndices.length; i++) {
            sceneRootsBuf.writeInt32LE(model.sceneRootIndices[i], i * 4);
        }

        // Nodes
        const nodesBuf = this.packNodes(model.nodes, blob);

        // Meshes
        const meshesBuf = this.packMeshes(model.meshes);

        // Primitives
        const primitivesBuf = this.packPrimitives(model.meshes, blob);

        // Skins
        const skinsBuf = this.packSkins(model.skins, blob);

        // Channels
        const channelsBuf = this.packChannels(model.animation);

        // Samplers
        const samplersBuf = this.packSamplers(model.animation, blob);

        // Materials
        const materialsBuf = this.packMaterials(model.materials);

        // Textures
        const texturesBuf = this.packTextures(model.materials, blob);

        // Data Blob
        const dataBlobBuf = blob.getData();

        // === Phase 2: 计算偏移量 ===
        let currentOffset = 16 + 80; // 文件头 16 + GLTF 头 80

        const offsets = {
            sceneRootsOffset: currentOffset,
            nodesOffset: currentOffset += sceneRootsBuf.length,
            meshesOffset: currentOffset += nodesBuf.length,
            primitivesOffset: currentOffset += meshesBuf.length,
            skinsOffset: currentOffset += primitivesBuf.length,
            channelsOffset: currentOffset += skinsBuf.length,
            samplersOffset: currentOffset += channelsBuf.length,
            materialsOffset: currentOffset += samplersBuf.length,
            texturesOffset: currentOffset += materialsBuf.length,
            dataBlobOffset: currentOffset += texturesBuf.length,
        };

        // === Phase 3: 构建并写入文件 ===
        const buffers: Buffer[] = [];

        // 1. 文件头 (16 bytes)
        const fileHeader = Buffer.alloc(16);
        fileHeader.writeUInt16LE(MAGIC, 0);
        fileHeader.writeUInt8(ModelType.GLTF, 2);
        fileHeader.writeUInt8(TOOL_VERSION, 3);
        fileHeader.writeUInt32LE(0, 4); // file_size (稍后更新)
        fileHeader.writeUInt8(1, 8); // face_type = TRIANGLE
        fileHeader.writeUInt8(16, 9); // payload_offset
        buffers.push(fileHeader);

        // 2. GLTF 头 (80 bytes)
        const headerBuf = this.packHeader(model, offsets, dataBlobBuf.length);
        buffers.push(headerBuf);

        // 3. 数据部分
        buffers.push(sceneRootsBuf);
        buffers.push(nodesBuf);
        buffers.push(meshesBuf);
        buffers.push(primitivesBuf);
        buffers.push(skinsBuf);
        buffers.push(channelsBuf);
        buffers.push(samplersBuf);
        buffers.push(materialsBuf);
        buffers.push(texturesBuf);
        buffers.push(dataBlobBuf);

        // 合并所有 buffers
        const output = Buffer.concat(buffers);

        // 更新文件大小
        output.writeUInt32LE(output.length, 4);

        // 写入文件
        const dir = require('path').dirname(binPath);
        if (!fs.existsSync(dir)) {
            fs.mkdirSync(dir, { recursive: true });
        }

        fs.writeFileSync(binPath, output);
        this.binaryToTxtArray(output, txtPath);
    }

    private packHeader(model: GLTFModel, offsets: any, dataBlobSize: number): Buffer {
        const buf = Buffer.alloc(80); // 20 个 uint32
        let offset = 0;

        // 计算计数
        let primitiveCount = 0;
        for (const mesh of model.meshes) {
            primitiveCount += mesh.primitives.length;
        }

        let textureCount = 0;
        for (const mat of model.materials) {
            if (mat.textureData) {
                textureCount++;
            }
        }

        // 写入计数 (9 个 uint32)
        buf.writeUInt32LE(model.sceneRootIndices.length, offset); offset += 4;
        buf.writeUInt32LE(model.nodes.length, offset); offset += 4;
        buf.writeUInt32LE(model.meshes.length, offset); offset += 4;
        buf.writeUInt32LE(primitiveCount, offset); offset += 4;
        buf.writeUInt32LE(model.skins.length, offset); offset += 4;
        buf.writeUInt32LE(model.animation ? model.animation.channels.length : 0, offset); offset += 4;
        buf.writeUInt32LE(model.animation ? model.animation.samplers.length : 0, offset); offset += 4;
        buf.writeUInt32LE(model.materials.length, offset); offset += 4;
        buf.writeUInt32LE(textureCount, offset); offset += 4;

        // 写入偏移量 (9 个 uint32)
        buf.writeUInt32LE(offsets.sceneRootsOffset, offset); offset += 4;
        buf.writeUInt32LE(offsets.nodesOffset, offset); offset += 4;
        buf.writeUInt32LE(offsets.meshesOffset, offset); offset += 4;
        buf.writeUInt32LE(offsets.primitivesOffset, offset); offset += 4;
        buf.writeUInt32LE(offsets.skinsOffset, offset); offset += 4;
        buf.writeUInt32LE(offsets.channelsOffset, offset); offset += 4;
        buf.writeUInt32LE(offsets.samplersOffset, offset); offset += 4;
        buf.writeUInt32LE(offsets.materialsOffset, offset); offset += 4;
        buf.writeUInt32LE(offsets.texturesOffset, offset); offset += 4;

        // 写入 data blob 信息 (2 个 uint32)
        buf.writeUInt32LE(offsets.dataBlobOffset, offset); offset += 4;
        buf.writeUInt32LE(dataBlobSize, offset); offset += 4;

        return buf;
    }

    private packNodes(nodes: any[], blob: DataBlob): Buffer {
        const buf = Buffer.alloc(nodes.length * 56); // 每个节点 56 bytes

        for (let i = 0; i < nodes.length; i++) {
            const node = nodes[i];
            const offset = i * 56;

            // translation (3 * 4 = 12 bytes)
            buf.writeFloatLE(node.translation[0], offset + 0);
            buf.writeFloatLE(node.translation[1], offset + 4);
            buf.writeFloatLE(node.translation[2], offset + 8);

            // rotation (4 * 4 = 16 bytes)
            buf.writeFloatLE(node.rotation[0], offset + 12);
            buf.writeFloatLE(node.rotation[1], offset + 16);
            buf.writeFloatLE(node.rotation[2], offset + 20);
            buf.writeFloatLE(node.rotation[3], offset + 24);

            // scale (3 * 4 = 12 bytes)
            buf.writeFloatLE(node.scale[0], offset + 28);
            buf.writeFloatLE(node.scale[1], offset + 32);
            buf.writeFloatLE(node.scale[2], offset + 36);

            // mesh_index (4 bytes)
            buf.writeInt32LE(node.meshIndex, offset + 40);

            // parent_index (4 bytes)
            buf.writeInt32LE(node.parentIndex, offset + 44);

            // children_count (4 bytes)
            buf.writeUInt32LE(node.childrenIndices.length, offset + 48);

            // children_offset (4 bytes)
            const childrenBuf = Buffer.alloc(node.childrenIndices.length * 4);
            for (let j = 0; j < node.childrenIndices.length; j++) {
                childrenBuf.writeInt32LE(node.childrenIndices[j], j * 4);
            }
            const childrenOffset = blob.append(childrenBuf);
            buf.writeUInt32LE(childrenOffset, offset + 52);

            // skin_index (4 bytes) - 实际上在 offset + 56，但我们的结构是 56 bytes
            // 需要调整：实际 C 结构是 56 bytes，包含 skin_index
        }

        // 修正：重新打包，包含 skin_index
        const correctBuf = Buffer.alloc(nodes.length * 60); // 60 bytes per node
        for (let i = 0; i < nodes.length; i++) {
            const node = nodes[i];
            const offset = i * 60;

            buf.copy(correctBuf, offset, i * 56, i * 56 + 56);
            correctBuf.writeInt32LE(node.skinIndex, offset + 56);
        }

        return correctBuf;
    }

    private packMeshes(meshes: any[]): Buffer {
        const buf = Buffer.alloc(meshes.length * 8); // 每个 mesh 8 bytes

        let primitiveStartIndex = 0;
        for (let i = 0; i < meshes.length; i++) {
            const mesh = meshes[i];
            const offset = i * 8;

            buf.writeUInt32LE(primitiveStartIndex, offset + 0);
            buf.writeUInt32LE(mesh.primitives.length, offset + 4);

            primitiveStartIndex += mesh.primitives.length;
        }

        return buf;
    }

    private packPrimitives(meshes: any[], blob: DataBlob): Buffer {
        let totalPrimitives = 0;
        for (const mesh of meshes) {
            totalPrimitives += mesh.primitives.length;
        }

        const buf = Buffer.alloc(totalPrimitives * 12); // 每个 primitive 12 bytes
        let primitiveIndex = 0;

        for (const mesh of meshes) {
            for (const prim of mesh.primitives) {
                const offset = primitiveIndex * 12;

                buf.writeInt32LE(prim.materialIndex, offset + 0);
                buf.writeUInt32LE(prim.triangles.length, offset + 8);

                // 写入三角形数据到 blob
                const trianglesBuf = this.packTriangles(prim.triangles);
                const trianglesOffset = blob.append(trianglesBuf);
                buf.writeUInt32LE(trianglesOffset, offset + 4);

                primitiveIndex++;
            }
        }

        return buf;
    }

    private packTriangles(triangles: any[]): Buffer {
        // 每个三角形 = 3 个顶点
        // 每个顶点 = pos(12) + normal(12) + texcoord(8) + joints(8) + weights(16) = 56 bytes
        // 每个三角形 = 56 * 3 = 168 bytes
        const buf = Buffer.alloc(triangles.length * 168);

        for (let i = 0; i < triangles.length; i++) {
            const tri = triangles[i];
            for (let j = 0; j < 3; j++) {
                const vert = tri.vertices[j];
                const offset = i * 168 + j * 56;

                // pos (12 bytes)
                buf.writeFloatLE(vert.pos.x, offset + 0);
                buf.writeFloatLE(vert.pos.y, offset + 4);
                buf.writeFloatLE(vert.pos.z, offset + 8);

                // normal (12 bytes)
                buf.writeFloatLE(vert.normal.x, offset + 12);
                buf.writeFloatLE(vert.normal.y, offset + 16);
                buf.writeFloatLE(vert.normal.z, offset + 20);

                // texcoord (8 bytes)
                buf.writeFloatLE(vert.texcoord.x, offset + 24);
                buf.writeFloatLE(vert.texcoord.y, offset + 28);

                // joints (8 bytes = 4 * uint16)
                buf.writeUInt16LE(vert.joints[0], offset + 32);
                buf.writeUInt16LE(vert.joints[1], offset + 34);
                buf.writeUInt16LE(vert.joints[2], offset + 36);
                buf.writeUInt16LE(vert.joints[3], offset + 38);

                // weights (16 bytes = 4 * float)
                buf.writeFloatLE(vert.weights[0], offset + 40);
                buf.writeFloatLE(vert.weights[1], offset + 44);
                buf.writeFloatLE(vert.weights[2], offset + 48);
                buf.writeFloatLE(vert.weights[3], offset + 52);
            }
        }

        return buf;
    }

    private packSkins(skins: any[], blob: DataBlob): Buffer {
        const buf = Buffer.alloc(skins.length * 12); // 每个 skin 12 bytes

        for (let i = 0; i < skins.length; i++) {
            const skin = skins[i];
            const offset = i * 12;

            // inverse_bind_matrices_offset (4 bytes)
            if (skin.inverseBindMatrices && skin.inverseBindMatrices.length > 0) {
                const ibmBuf = Buffer.from(skin.inverseBindMatrices.buffer);
                const ibmOffset = blob.append(ibmBuf);
                buf.writeUInt32LE(ibmOffset, offset + 0);
            } else {
                buf.writeUInt32LE(0, offset + 0);
            }

            // joints_offset (4 bytes)
            if (skin.jointIndices && skin.jointIndices.length > 0) {
                const jointsBuf = Buffer.alloc(skin.jointIndices.length * 4);
                for (let j = 0; j < skin.jointIndices.length; j++) {
                    jointsBuf.writeUInt32LE(skin.jointIndices[j], j * 4);
                }
                const jointsOffset = blob.append(jointsBuf);
                buf.writeUInt32LE(jointsOffset, offset + 4);
            } else {
                buf.writeUInt32LE(0, offset + 4);
            }

            // joints_count (4 bytes)
            buf.writeUInt32LE(skin.jointIndices ? skin.jointIndices.length : 0, offset + 8);
        }

        return buf;
    }

    private packChannels(animation: any): Buffer {
        if (!animation || !animation.channels) {
            return Buffer.alloc(0);
        }

        const buf = Buffer.alloc(animation.channels.length * 12); // 每个 channel 12 bytes

        for (let i = 0; i < animation.channels.length; i++) {
            const channel = animation.channels[i];
            const offset = i * 12;

            buf.writeUInt32LE(channel.samplerIndex, offset + 0);
            buf.writeUInt32LE(channel.targetNodeIndex, offset + 4);
            buf.writeUInt32LE(channel.targetPath, offset + 8);
        }

        return buf;
    }

    private packSamplers(animation: any, blob: DataBlob): Buffer {
        if (!animation || !animation.samplers) {
            return Buffer.alloc(0);
        }

        const buf = Buffer.alloc(animation.samplers.length * 24); // 每个 sampler 24 bytes

        for (let i = 0; i < animation.samplers.length; i++) {
            const sampler = animation.samplers[i];
            const offset = i * 24;

            // input_offset (4 bytes)
            const inputBuf = Buffer.from(sampler.inputData.buffer);
            const inputOffset = blob.append(inputBuf);
            buf.writeUInt32LE(inputOffset, offset + 0);

            // input_count (4 bytes)
            buf.writeUInt32LE(sampler.inputData.length, offset + 4);

            // output_offset (4 bytes)
            const outputBuf = Buffer.from(sampler.outputData.buffer);
            const outputOffset = blob.append(outputBuf);
            buf.writeUInt32LE(outputOffset, offset + 8);

            // output_count (4 bytes)
            buf.writeUInt32LE(sampler.outputData.length / (sampler.outputType === 0 ? 3 : 4), offset + 12);

            // interpolation_type (4 bytes)
            buf.writeUInt32LE(sampler.interpolation, offset + 16);

            // output_type (4 bytes)
            buf.writeUInt32LE(sampler.outputType, offset + 20);
        }

        return buf;
    }

    private packMaterials(materials: any[]): Buffer {
        const buf = Buffer.alloc(materials.length * 8); // 每个 material 8 bytes

        let textureIndex = 0;
        for (let i = 0; i < materials.length; i++) {
            const mat = materials[i];
            const offset = i * 8;

            // base_color (4 bytes)
            buf.writeUInt8(mat.baseColor[0], offset + 0);
            buf.writeUInt8(mat.baseColor[1], offset + 1);
            buf.writeUInt8(mat.baseColor[2], offset + 2);
            buf.writeUInt8(mat.baseColor[3], offset + 3);

            // texture_index (4 bytes)
            if (mat.textureData && mat.textureData.length > 0) {
                buf.writeInt32LE(textureIndex, offset + 4);
                textureIndex++;
            } else {
                buf.writeInt32LE(-1, offset + 4);
            }
        }

        return buf;
    }

    private packTextures(materials: any[], blob: DataBlob): Buffer {
        let textureCount = 0;
        for (const mat of materials) {
            if (mat.textureData && mat.textureData.length > 0) {
                textureCount++;
            }
        }

        const buf = Buffer.alloc(textureCount * 8); // 每个 texture 8 bytes
        let textureIndex = 0;

        for (let i = 0; i < materials.length; i++) {
            const mat = materials[i];
            if (mat.textureData && mat.textureData.length > 0) {
                const offset = textureIndex * 8;

                // data_offset (4 bytes)
                const dataOffset = blob.append(mat.textureData);
                buf.writeUInt32LE(dataOffset, offset + 0);

                // data_size (4 bytes)
                buf.writeUInt32LE(mat.textureData.length, offset + 4);

                textureIndex++;
            }
        }

        return buf;
    }

    private binaryToTxtArray(data: Buffer, txtPath: string): void {
        const baseName = txtPath.replace(/\.[^.]+$/, '').split('/').pop();
        const arrayName = `_ac${baseName}`;

        let txt = `__attribute__((aligned(4))) static const unsigned char ${arrayName}[${data.length}] = {`;

        for (let i = 0; i < data.length; i++) {
            if (i % 40 === 0) {
                txt += '\n    ';
            }
            txt += `0x${data[i].toString(16).padStart(2, '0')}`;
            if (i < data.length - 1) {
                txt += ', ';
            }
        }

        txt += '\n};\n';
        fs.writeFileSync(txtPath, txt);
    }
}

// Data Blob 管理器
class DataBlob {
    private data: Buffer[] = [];
    private size: number = 0;

    append(buffer: Buffer): number {
        if (buffer.length === 0) {
            return 0xFFFFFFFF;
        }

        const offset = this.size;
        this.data.push(buffer);
        this.size += buffer.length;
        return offset;
    }

    getData(): Buffer {
        return Buffer.concat(this.data);
    }

    getSize(): number {
        return this.size;
    }
}
