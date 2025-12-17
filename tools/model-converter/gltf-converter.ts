/**
 * GLTF Model Converter
 */

import * as fs from 'fs';
import { GLTFParser } from './gltf-parser';
import { ModelType, FaceType, TOOL_VERSION, MAGIC } from './types';

export class GLTFConverter {
    convert(gltfPath: string, binPath: string, txtPath: string): void {
        const parser = new GLTFParser();
        const model = parser.parse(gltfPath);

        // GLTF typically uses triangles
        const faceType = FaceType.TRIANGLE;

        // Write binary file
        const buffers: Buffer[] = [];

        // File header (16 bytes)
        const header = Buffer.alloc(16);
        header.writeUInt16LE(MAGIC, 0);
        header.writeUInt8(ModelType.GLTF, 2);
        header.writeUInt8(TOOL_VERSION, 3);
        header.writeUInt32LE(0, 4); // file_size (update later)
        header.writeUInt8(faceType, 8);
        header.writeUInt8(16, 9); // payload_offset
        buffers.push(header);

        // Attribute counts
        const counts = Buffer.alloc(24);
        counts.writeUInt32LE(model.vertices.length, 0);
        counts.writeUInt32LE(model.normals.length, 4);
        counts.writeUInt32LE(model.texcoords.length, 8);
        counts.writeUInt32LE(model.indices.length, 12);
        counts.writeUInt32LE(model.faceNumVerts.length, 16);
        counts.writeInt32LE(0, 20); // pad0
        buffers.push(counts);

        // Vertices
        for (const v of model.vertices) {
            const buf = Buffer.alloc(12);
            buf.writeFloatLE(v.x, 0);
            buf.writeFloatLE(v.y, 4);
            buf.writeFloatLE(v.z, 8);
            buffers.push(buf);
        }

        // Normals
        for (const n of model.normals) {
            const buf = Buffer.alloc(12);
            buf.writeFloatLE(n.x, 0);
            buf.writeFloatLE(n.y, 4);
            buf.writeFloatLE(n.z, 8);
            buffers.push(buf);
        }

        // Texcoords
        for (const t of model.texcoords) {
            const buf = Buffer.alloc(8);
            buf.writeFloatLE(t.x, 0);
            buf.writeFloatLE(t.y, 4);
            buffers.push(buf);
        }

        // Indices
        for (const idx of model.indices) {
            const buf = Buffer.alloc(12);
            buf.writeInt32LE(idx.vertex, 0);
            buf.writeInt32LE(idx.texcoord, 4);
            buf.writeInt32LE(idx.normal, 8);
            buffers.push(buf);
        }

        // Face num verts
        for (const num of model.faceNumVerts) {
            const buf = Buffer.alloc(4);
            buf.writeInt32LE(num, 0);
            buffers.push(buf);
        }

        // Material IDs
        for (const id of model.materialIds) {
            const buf = Buffer.alloc(4);
            buf.writeInt32LE(id, 0);
            buffers.push(buf);
        }

        // Shapes
        const shapesCount = Buffer.alloc(4);
        shapesCount.writeUInt32LE(model.shapes.length, 0);
        buffers.push(shapesCount);

        for (const shape of model.shapes) {
            const buf = Buffer.alloc(8);
            buf.writeUInt32LE(shape.offset, 0);
            buf.writeUInt32LE(shape.length, 4);
            buffers.push(buf);
        }

        // Materials
        const materialsCount = Buffer.alloc(4);
        materialsCount.writeUInt32LE(model.materials.length, 0);
        buffers.push(materialsCount);

        for (const mat of model.materials) {
            const buf = Buffer.alloc(60);
            buf.writeFloatLE(mat.ambient.x, 0);
            buf.writeFloatLE(mat.ambient.y, 4);
            buf.writeFloatLE(mat.ambient.z, 8);
            buf.writeFloatLE(mat.diffuse.x, 12);
            buf.writeFloatLE(mat.diffuse.y, 16);
            buf.writeFloatLE(mat.diffuse.z, 20);
            buf.writeFloatLE(mat.specular.x, 24);
            buf.writeFloatLE(mat.specular.y, 28);
            buf.writeFloatLE(mat.specular.z, 32);
            buf.writeFloatLE(mat.transmittance.x, 36);
            buf.writeFloatLE(mat.transmittance.y, 40);
            buf.writeFloatLE(mat.transmittance.z, 44);
            buf.writeFloatLE(mat.emission.x, 48);
            buf.writeFloatLE(mat.emission.y, 52);
            buf.writeFloatLE(mat.emission.z, 56);
            buffers.push(buf);

            const buf2 = Buffer.alloc(16);
            buf2.writeFloatLE(mat.shininess, 0);
            buf2.writeFloatLE(mat.ior, 4);
            buf2.writeFloatLE(mat.dissolve, 8);
            buf2.writeInt32LE(mat.illum, 12);
            buffers.push(buf2);
        }

        // Texture sizes
        for (const tex of model.textures) {
            const buf = Buffer.alloc(4);
            buf.writeUInt32LE(tex.length, 0);
            buffers.push(buf);
        }

        // Texture data
        for (const tex of model.textures) {
            if (tex.length > 0) {
                buffers.push(tex);
            }
        }

        // Combine all buffers
        const output = Buffer.concat(buffers);

        // Update file size
        output.writeUInt32LE(output.length, 4);

        // Write files
        const binDir = require('path').dirname(binPath);
        const txtDir = require('path').dirname(txtPath);
        if (!fs.existsSync(binDir)) {
            fs.mkdirSync(binDir, { recursive: true });
        }
        if (!fs.existsSync(txtDir)) {
            fs.mkdirSync(txtDir, { recursive: true });
        }
        
        fs.writeFileSync(binPath, output);
        this.binaryToTxtArray(output, txtPath);
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
