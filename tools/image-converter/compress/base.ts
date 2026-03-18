/**
 * Compression Algorithm Base Interface
 */

export interface CompressionResult {
  compressedData: Buffer;
  lineOffsets: number[];
  params: {
    feature_1: number;
    feature_2: number;
  };
}

export interface CompressionAlgorithm {
  /**
   * Compress pixel data
   * @param pixelData Raw pixel data
   * @param width Image width in pixels
   * @param height Image height
   * @param pixelBytes Bytes per pixel (for full-byte formats) or 1 (for sub-byte formats)
   * @param bytesPerLine Optional: actual bytes per line (for sub-byte formats like A4/A2/A1)
   */
  compress(
    pixelData: Buffer,
    width: number,
    height: number,
    pixelBytes: number,
    bytesPerLine?: number
  ): CompressionResult;

  /**
   * Get algorithm type constant
   */
  getAlgorithmType(): number;
}
