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
   * @param width Image width
   * @param height Image height
   * @param pixelBytes Bytes per pixel
   */
  compress(
    pixelData: Buffer,
    width: number,
    height: number,
    pixelBytes: number
  ): CompressionResult;

  /**
   * Get algorithm type constant
   */
  getAlgorithmType(): number;
}
