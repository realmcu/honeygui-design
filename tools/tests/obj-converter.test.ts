/**
 * OBJ Converter Test
 * 验证 JS 版本输出格式正确
 */

import * as fs from 'fs';
import * as path from 'path';
import { OBJConverter } from '../model-converter/obj-converter';
import { ModelType, FaceType, MAGIC, TOOL_VERSION } from '../model-converter/types';

const TEST_DIR = path.join(__dirname, 'temp');

describe('OBJConverter', () => {
    let converter: OBJConverter;

    beforeAll(() => {
        converter = new OBJConverter();
    });

    beforeEach(() => {
        if (!fs.existsSync(TEST_DIR)) {
            fs.mkdirSync(TEST_DIR, { recursive: true });
        }
    });

    afterAll(() => {
        if (fs.existsSync(TEST_DIR)) {
            fs.rmSync(TEST_DIR, { recursive: true });
        }
    });

    function createTestOBJ(name: string, content: string): string {
        const filePath = path.join(TEST_DIR, name);
        fs.writeFileSync(filePath, content);
        return filePath;
    }

    test('Rectangle mesh conversion', () => {
        const objContent = `# Rectangle mesh
v 0.0 0.0 0.0
v 1.0 0.0 0.0
v 1.0 1.0 0.0
v 0.0 1.0 0.0

vn 0.0 0.0 1.0

vt 0.0 0.0
vt 1.0 0.0
vt 1.0 1.0
vt 0.0 1.0

f 1/1/1 2/2/1 3/3/1 4/4/1
`;
        const inputPath = createTestOBJ('rectangle.obj', objContent);
        const binPath = path.join(TEST_DIR, 'rectangle.bin');
        const txtPath = path.join(TEST_DIR, 'rectangle.txt');

        converter.convert(inputPath, binPath, txtPath);

        expect(fs.existsSync(binPath)).toBe(true);
        expect(fs.existsSync(txtPath)).toBe(true);

        // Verify file header
        const bin = fs.readFileSync(binPath);
        expect(bin.readUInt16LE(0)).toBe(MAGIC); // Magic
        expect(bin.readUInt8(2)).toBe(ModelType.OBJ); // ModelType
        expect(bin.readUInt8(3)).toBe(TOOL_VERSION); // Version
        expect(bin.readUInt8(8)).toBe(FaceType.RECTANGLE); // FaceType
        expect(bin.readUInt8(9)).toBe(16); // payload_offset

        // Verify file size
        const fileSize = bin.readUInt32LE(4);
        expect(fileSize).toBe(bin.length);

        // Verify txt file
        const txt = fs.readFileSync(txtPath, 'utf-8');
        expect(txt).toContain('__attribute__((aligned(4)))');
        expect(txt).toContain(`[${bin.length}]`);
    });

    test('Triangle mesh conversion', () => {
        const objContent = `# Triangle mesh
v 0.0 0.0 0.0
v 1.0 0.0 0.0
v 0.5 1.0 0.0

vn 0.0 0.0 1.0

vt 0.0 0.0
vt 1.0 0.0
vt 0.5 1.0

f 1/1/1 2/2/1 3/3/1
`;
        const inputPath = createTestOBJ('triangle.obj', objContent);
        const binPath = path.join(TEST_DIR, 'triangle.bin');
        const txtPath = path.join(TEST_DIR, 'triangle.txt');

        converter.convert(inputPath, binPath, txtPath);

        expect(fs.existsSync(binPath)).toBe(true);

        // Verify face type
        const bin = fs.readFileSync(binPath);
        expect(bin.readUInt8(8)).toBe(FaceType.TRIANGLE);
    });

    test('Mixed mesh conversion', () => {
        const objContent = `# Mixed mesh
v 0.0 0.0 0.0
v 1.0 0.0 0.0
v 1.0 1.0 0.0
v 0.0 1.0 0.0
v 0.5 2.0 0.0

vn 0.0 0.0 1.0

vt 0.0 0.0
vt 1.0 0.0
vt 1.0 1.0
vt 0.0 1.0
vt 0.5 2.0

f 1/1/1 2/2/1 3/3/1 4/4/1
f 3/3/1 4/4/1 5/5/1
`;
        const inputPath = createTestOBJ('mixed.obj', objContent);
        const binPath = path.join(TEST_DIR, 'mixed.bin');
        const txtPath = path.join(TEST_DIR, 'mixed.txt');

        converter.convert(inputPath, binPath, txtPath);

        expect(fs.existsSync(binPath)).toBe(true);

        // Verify face type
        const bin = fs.readFileSync(binPath);
        expect(bin.readUInt8(8)).toBe(FaceType.MIXED);
    });

    test('Vertex data integrity', () => {
        const objContent = `# Test vertices
v 1.5 2.5 3.5
v -1.0 -2.0 -3.0

vn 0.0 1.0 0.0

vt 0.25 0.75

f 1/1/1 2/1/1 1/1/1
`;
        const inputPath = createTestOBJ('vertices.obj', objContent);
        const binPath = path.join(TEST_DIR, 'vertices.bin');
        const txtPath = path.join(TEST_DIR, 'vertices.txt');

        converter.convert(inputPath, binPath, txtPath);

        const bin = fs.readFileSync(binPath);
        
        // Read counts (after 16-byte header)
        const numVertices = bin.readUInt32LE(16);
        const numNormals = bin.readUInt32LE(20);
        const numTexcoords = bin.readUInt32LE(24);
        
        expect(numVertices).toBe(2);
        expect(numNormals).toBe(1);
        expect(numTexcoords).toBe(1);

        // Read first vertex (after counts: 16 + 24 = 40)
        const v1x = bin.readFloatLE(40);
        const v1y = bin.readFloatLE(44);
        const v1z = bin.readFloatLE(48);
        
        expect(v1x).toBeCloseTo(1.5);
        expect(v1y).toBeCloseTo(2.5);
        expect(v1z).toBeCloseTo(3.5);
    });
});
