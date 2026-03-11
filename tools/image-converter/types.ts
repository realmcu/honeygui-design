/**
 * HoneyGUI Image Format Types
 * 与 SDK 的 GUI_FormatType 枚举保持一致
 */

// GUI_FormatType enum values
export enum PixelFormat {
    // Packed RGB formats
    RGB565       = 0,    // 16-bit: bit[4:0] Blue, bit[10:5] Green, bit[15:11] Red
    ARGB8565     = 1,    // 24-bit: RGB565 + 8-bit Alpha, packed
    RGB888       = 3,    // 24-bit: 8-bit per channel BGR
    ARGB8888     = 4,    // 32-bit: 8-bit per channel BGRA
    XRGB8888     = 5,    // 32-bit: 8-bit per channel BGR + unused X

    // Luma / mask / indexed formats
    BINARY       = 6,    // 1-bit monochrome (black/white), also GRAY1
    GRAY         = 7,    // Grayscale 8 bpp (256 levels), also GRAY8
    ALPHAMASK    = 9,    // Alpha-only mask (default 8 bits)
    PALETTE      = 10,   // Indexed color using a palette (CLUT)

    // Encoded image container formats
    BMP          = 11,   // BMP image file format
    JPEG         = 12,   // JPEG image file format
    PNG          = 13,   // PNG image file format
    GIF          = 14,   // GIF image file format
    RTKARGB8565  = 15,   // Planar: [A 8bpp plane][RGB565 plane]

    // Grayscale subtypes (GRAY1 = BINARY = 6, GRAY8 = GRAY = 7)
    GRAY2        = 0x21, // 2 bpp grayscale (4 levels)
    GRAY4        = 0x22, // 4 bpp grayscale (16 levels)

    // Alpha subtypes
    A8           = 0x30, // 8 bpp alpha (256 levels)
    A4           = 0x31, // 4 bpp alpha (16 levels)
    A2           = 0x32, // 2 bpp alpha (4 levels)
    A1           = 0x33, // 1 bpp alpha (2 levels)

    // X (unused/fixed) subtypes
    X8           = 0x34, // 8 bpp X (256 levels)
    X4           = 0x35, // 4 bpp X (16 levels)
    X2           = 0x36, // 2 bpp X (4 levels)
    X1           = 0x37, // 1 bpp X (2 levels)

    // Indexed color subtypes
    I8           = 0x38, // 8 bpp indexed (256 colors)
    I4           = 0x39, // 4 bpp indexed (16 colors)
    I2           = 0x3a, // 2 bpp indexed (4 colors)
    I1           = 0x3b, // 1 bpp indexed (2 colors)
}

// Aliases for compatibility
export const GRAY1 = PixelFormat.BINARY;  // 1 bpp grayscale = BINARY
export const GRAY8 = PixelFormat.GRAY;    // 8 bpp grayscale = GRAY

// Compression algorithm types
export enum CompressionType {
    NONE = 0,
    RLE = 0,
    FASTLZ = 1,
    YUV_FASTLZ = 2,
    YUV = 3,
}

// Pixel bytes mapping (for header)
export enum PixelBytes {
    BYTES_2 = 0,  // RGB565, ARGB8565
    BYTES_3 = 1,  // RGB888
    BYTES_4 = 2,  // ARGB8888, XRGB8888
    BYTES_1 = 3,  // A8, GRAY, I8, etc.
}

export const FORMAT_TO_PIXEL_BYTES: Record<number, PixelBytes> = {
    [PixelFormat.RGB565]: PixelBytes.BYTES_2,
    [PixelFormat.ARGB8565]: PixelBytes.BYTES_3,
    [PixelFormat.RGB888]: PixelBytes.BYTES_3,
    [PixelFormat.ARGB8888]: PixelBytes.BYTES_4,
    [PixelFormat.XRGB8888]: PixelBytes.BYTES_4,
    [PixelFormat.BINARY]: PixelBytes.BYTES_1,
    [PixelFormat.GRAY]: PixelBytes.BYTES_1,
    [PixelFormat.ALPHAMASK]: PixelBytes.BYTES_1,
    [PixelFormat.PALETTE]: PixelBytes.BYTES_1,
    [PixelFormat.GRAY2]: PixelBytes.BYTES_1,
    [PixelFormat.GRAY4]: PixelBytes.BYTES_1,
    [PixelFormat.A8]: PixelBytes.BYTES_1,
    [PixelFormat.A4]: PixelBytes.BYTES_1,
    [PixelFormat.A2]: PixelBytes.BYTES_1,
    [PixelFormat.A1]: PixelBytes.BYTES_1,
    [PixelFormat.I8]: PixelBytes.BYTES_1,
    [PixelFormat.I4]: PixelBytes.BYTES_1,
    [PixelFormat.I2]: PixelBytes.BYTES_1,
    [PixelFormat.I1]: PixelBytes.BYTES_1,
};

// Bytes per pixel mapping (for data size calculation)
export const FORMAT_TO_BPP: Record<number, number> = {
    [PixelFormat.RGB565]: 2,
    [PixelFormat.ARGB8565]: 3,
    [PixelFormat.RGB888]: 3,
    [PixelFormat.ARGB8888]: 4,
    [PixelFormat.XRGB8888]: 4,
    [PixelFormat.BINARY]: 1,
    [PixelFormat.GRAY]: 1,
    [PixelFormat.ALPHAMASK]: 1,
    [PixelFormat.PALETTE]: 1,
    [PixelFormat.GRAY2]: 1,
    [PixelFormat.GRAY4]: 1,
    [PixelFormat.A8]: 1,
    [PixelFormat.A4]: 1,
    [PixelFormat.A2]: 1,
    [PixelFormat.A1]: 1,
    [PixelFormat.I8]: 1,
    [PixelFormat.I4]: 1,
    [PixelFormat.I2]: 1,
    [PixelFormat.I1]: 1,
};
