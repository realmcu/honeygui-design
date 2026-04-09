/**
 * TypeScript Font Converter
 * Converts TrueType fonts to embedded system optimized binary formats
 * 
 * @packageDocumentation
 */

// Export types (interfaces and enums), excluding names re-exported as classes below
export * from './types/enums';
export * from './types/config';
export type { GlyphEntry, BitmapGlyphData, CropInfo, VectorGlyphData } from './types/binary';

// Export constants and errors
export * from './constants';
export * from './errors';

// Export configuration
export * from './config';

// Export CLI
export * from './cli';
export * from './main';

// Export binary writer
export * from './binary-writer';

// Export header classes (override interface exports from types/binary)
export { BitmapFontHeader, BitmapFontHeaderConfig } from './bitmap-font-header';
export { VectorFontHeader, VectorFontHeaderConfig } from './vector-font-header';

// Export charset processor
export * from './charset-processor';

// Export codepage parser
export * from './codepage-parser';

// Export font parser
export * from './font-parser';

// Export image processor
export * from './image-processor';

// Export font generators
export * from './font-generator';
export * from './bitmap-generator';
export * from './vector-generator';
