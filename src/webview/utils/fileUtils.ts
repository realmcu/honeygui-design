/**
 * 文件处理工具函数
 */

const IMAGE_EXTENSIONS = ['png', 'jpg', 'jpeg', 'gif', 'bmp', 'svg', 'webp'];

/**
 * 检查文件是否为图片
 */
export const isImageFile = (fileName: string): boolean => {
  const ext = fileName.split('.').pop()?.toLowerCase();
  return ext ? IMAGE_EXTENSIONS.includes(ext) : false;
};

/**
 * 读取文件为 ArrayBuffer
 */
export const readFileAsArrayBuffer = (file: File): Promise<Uint8Array> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (event) => {
      const arrayBuffer = event.target?.result as ArrayBuffer;
      resolve(new Uint8Array(arrayBuffer));
    };
    reader.onerror = reject;
    reader.readAsArrayBuffer(file);
  });
};

/**
 * 处理图片文件列表
 */
export const processImageFiles = async (
  files: FileList,
  onProcess: (file: File, index: number, data: Uint8Array) => void
): Promise<void> => {
  const imageFiles = Array.from(files).filter(file => isImageFile(file.name));
  
  for (let i = 0; i < imageFiles.length; i++) {
    const file = imageFiles[i];
    try {
      const data = await readFileAsArrayBuffer(file);
      onProcess(file, i, data);
    } catch (error) {
      console.error(`[文件处理] 读取文件失败: ${file.name}`, error);
    }
  }
};
