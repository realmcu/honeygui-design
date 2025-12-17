/**
 * HoneyGUI Image Format Types
 */

// GUI_FormatType enum values
export enum PixelFormat {
    RGB565 = 0,
    ARGB8565 = 1,
    RGB888 = 3,
    ARGB8888 = 4,
    XRGB8888 = 5,
    BINARY = 6,
    GRAY = 7,
    A8 = 9,
}

// Compression algorithm types
export enum CompressionType {
    NONE = 0,
    RLE = 0,
    FASTLZ = 1,
    YUV_FASTLZ = 2,
    YUV = 3,
}

// Pixel bytes mapping
export enum PixelBytes {
    BYTES_2 = 0,  // RGB565, ARGB8565
    BYTES_3 = 1,  // RGB888
    BYTES_4 = 2,  // ARGB8888
    BYTES_1 = 3,  // A8, GRAY
}

export const FORMAT_TO_PIXEL_BYTES: Record<PixelFormat, PixelBytes> = {
    [PixelFormat.RGB565]: PixelBytes.BYTES_2,
    [PixelFormat.ARGB8565]: PixelBytes.BYTES_2,
    [PixelFormat.RGB888]: PixelBytes.BYTES_3,
    [PixelFormat.ARGB8888]: PixelBytes.BYTES_4,
    [PixelFormat.XRGB8888]: PixelBytes.BYTES_4,
    [PixelFormat.A8]: PixelBytes.BYTES_1,
    [PixelFormat.GRAY]: PixelBytes.BYTES_1,
    [PixelFormat.BINARY]: PixelBytes.BYTES_1,
};

export const FORMAT_TO_BPP: Record<PixelFormat, number> = {
    [PixelFormat.RGB565]: 2,
    [PixelFormat.ARGB8565]: 3,
    [PixelFormat.RGB888]: 3,
    [PixelFormat.ARGB8888]: 4,
    [PixelFormat.XRGB8888]: 4,
    [PixelFormat.A8]: 1,
    [PixelFormat.GRAY]: 1,
    [PixelFormat.BINARY]: 1,
};
