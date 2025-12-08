/**
 * 解析 OBJ 文件的依赖关系
 */

export interface ObjDependencies {
  mtlFile?: string;
  textures: string[];
}

/**
 * 从 OBJ 文件内容中提取 MTL 文件名
 */
export function extractMtlFromObj(objContent: string): string | undefined {
  const lines = objContent.split('\n');
  for (const line of lines) {
    const trimmed = line.trim();
    if (trimmed.startsWith('mtllib ')) {
      return trimmed.substring(7).trim();
    }
  }
  return undefined;
}

/**
 * 从 MTL 文件内容中提取贴图文件名
 */
export function extractTexturesFromMtl(mtlContent: string): string[] {
  const textures = new Set<string>();
  const lines = mtlContent.split('\n');
  
  for (const line of lines) {
    const trimmed = line.trim();
    // 支持常见的贴图类型
    const mapTypes = ['map_Kd', 'map_Ka', 'map_Ks', 'map_Ns', 'map_d', 'map_bump', 'bump'];
    
    for (const mapType of mapTypes) {
      if (trimmed.startsWith(mapType + ' ')) {
        const texturePath = trimmed.substring(mapType.length + 1).trim();
        // 移除可能的选项参数（如 -blendu on）
        const parts = texturePath.split(/\s+/);
        const filename = parts[parts.length - 1];
        if (filename && !filename.startsWith('-')) {
          textures.add(filename);
        }
      }
    }
  }
  
  return Array.from(textures);
}

/**
 * 解析 OBJ 文件的所有依赖
 */
export async function parseObjDependencies(objFile: File): Promise<ObjDependencies> {
  const objContent = await objFile.text();
  const mtlFile = extractMtlFromObj(objContent);
  
  return {
    mtlFile,
    textures: []
  };
}

/**
 * 从文件列表中查找依赖文件
 */
export function findDependencyFiles(
  objFileName: string,
  dependencies: ObjDependencies,
  fileList: FileList
): { mtl?: File; textures: File[] } {
  const files = Array.from(fileList);
  const result: { mtl?: File; textures: File[] } = { textures: [] };
  
  // 查找 MTL 文件
  if (dependencies.mtlFile) {
    result.mtl = files.find(f => f.name === dependencies.mtlFile);
  } else {
    // 尝试同名 MTL
    const baseName = objFileName.replace(/\.obj$/i, '');
    result.mtl = files.find(f => f.name === `${baseName}.mtl`);
  }
  
  // 查找贴图文件
  result.textures = files.filter(f => 
    dependencies.textures.includes(f.name)
  );
  
  return result;
}

/**
 * 解析 MTL 文件并更新依赖信息
 */
export async function parseMtlDependencies(
  mtlFile: File,
  dependencies: ObjDependencies
): Promise<ObjDependencies> {
  const mtlContent = await mtlFile.text();
  const textures = extractTexturesFromMtl(mtlContent);
  
  return {
    ...dependencies,
    textures
  };
}
