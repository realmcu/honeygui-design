/**
 * 3D Model Types
 */

export enum ModelType {
    OBJ = 0,
    GLTF = 1,
    UNKNOWN = 2,
}

export enum FaceType {
    RECTANGLE = 0,
    TRIANGLE = 1,
    MIXED = 2,
}

export const TOOL_VERSION = 3;
export const MAGIC = 0x3344;

export interface Vec3 {
    x: number;
    y: number;
    z: number;
}

export interface Vec2 {
    x: number;
    y: number;
}

export interface Index {
    vertex: number;
    texcoord: number;
    normal: number;
}

export interface Material {
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

export interface Shape {
    offset: number;
    length: number;
}

export interface OBJModel {
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
