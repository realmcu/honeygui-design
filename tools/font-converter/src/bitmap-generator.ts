/**
 * Bitmap Font Generator
 * 
 * Generates bitmap font files from TrueType fonts.
 * Supports multiple render modes (1/2/4/8-bit), styles (bold, italic),
 * rotation, gamma correction, and cropping.
 * 
 * Requirements: 2.1, 2.2, 2.3, 2.4, 2.5, 2.6, 2.7, 2.8, 5.5, 5.6, 5.7, 9.1, 9.2, 9.3
 */

import * as fs from 'fs';
import * as opentype from 'opentype.js';
import { FontGenerator } from './font-generator';
import { FontConfig, RenderMode, IndexMethod, Rotation } from './types';
import { BitmapGlyphData, CropInfo } from './types/binary';
import { BitmapFontHeader, BitmapFontHeaderConfig } from './bitmap-font-header';
import { BinaryWriter } from './binary-writer';
import { ImageProcessor } from './image-processor';
import {
  BINARY_FORMAT,
  FILE_NAMING,
  RENDER_MODE_BITS
} from './constants';
import {
  FontConverterError,
  ErrorCode,
  createGlyphRenderFailedError,
  createFileWriteError
} from './errors';
import { PathUtils } from './path-utils';

/**
 * Rendered glyph with all processing applied
 */
interface ProcessedGlyph {
  /** Unicode code point */
  unicode: number;
  /** Packed pixel data */
  pixelData: Uint8Array;
  /** Glyph width (after processing) */
  width: number;
  /** Glyph height (after processing) */
  height: number;
  /** Crop information (if cropping enabled) */
  cropInfo?: CropInfo;
  /** Advance width */
  advance: number;
  /** X offset (posO.x in C++) */
  xOffset: number;
  /** Y offset (posO.y in C++) - baseline related */
  yOffset: number;
  /** Character width for header (pos.x in C++) */
  charWidth: number;
  /** Character height for header (pos.y in C++) */
  charHeight: number;
}

/**
 * Index entry for the index array
 */
interface IndexEntry {
  /** Unicode code point */
  unicode: number;
  /** Character index or file offset depending on mode */
  value: number;
}

/**
 * BitmapFontGenerator class
 * Generates bitmap font files from TrueType fonts
 */
export class BitmapFontGenerator extends FontGenerator {
  /** Processed glyphs */
  private glyphs: Map<number, ProcessedGlyph> = new Map();
  
  /** Base glyph size (width and height before cropping) */
  private baseGlyphWidth: number = 0;
  private baseGlyphHeight: number = 0;

  /** 
   * Scaled font size for rendering (C++ compatibility)
   * 
   * When rvd=false (default):
   *   scaledFontSize = fontSize * unitsPerEM / (ascender - descender)
   *   This ensures glyphs fit within the requested backSize
   * 
   * When rvd=true:
   *   scaledFontSize = fontSize (render at original size)
   */
  private scaledFontSize: number = 0;

  /**
   * Back size (canvas size for glyph rendering)
   * 
   * When rvd=false (default):
   *   backSize = fontSize (config value)
   * 
   * When rvd=true:
   *   backSize = ceil(fontSize * (ascender - descender) / unitsPerEM)
   */
  private backSize: number = 0;

  /**
   * Creates a new BitmapFontGenerator
   * 
   * @param config - Font configuration
   */
  constructor(config: FontConfig) {
    super(config);
  }

  /**
   * Generate the bitmap font file
   * 
   * Process:
   * 1. Load font
   * 2. Load character set
   * 3. Render all glyphs
   * 4. Create header
   * 5. Create index array
   * 6. Write binary file
   * 7. Write character set file
   * 8. Write failed characters file (if any)
   */
  async generate(): Promise<void> {
    try {
      // Load font and character set
      await this.loadFont();
      await this.loadCharacterSet();
      
      // Ensure output directory exists
      await this.ensureOutputDirectory();
      
      // Calculate base glyph dimensions
      this.calculateBaseGlyphDimensions();
      
      // Render all glyphs
      await this.renderAllGlyphs();
      
      // Generate output filename
      const baseName = this.generateOutputBaseName();
      
      // Create header
      const header = this.createHeader();
      
      // Create index array
      const indexArray = this.createIndexArray();
      
      // Write binary file
      const binPath = PathUtils.join(this.config.outputPath, baseName + '.bin');
      this.trackPartialFile(binPath);
      await this.writeBinaryFile(baseName, header, indexArray);
      
      // Write character set file
      const cstPath = PathUtils.join(this.config.outputPath, baseName + '.cst');
      this.trackPartialFile(cstPath);
      await this.writeCharacterSetFile(baseName);
      
      // Write failed characters file
      if (this.failedCharacters.length > 0) {
        const failedPath = PathUtils.join(this.config.outputPath, FILE_NAMING.UNSUPPORTED_CHARS_FILE);
        this.trackPartialFile(failedPath);
        await this.writeFailedCharactersFile();
      }
      
      // Clear partial file tracking on success
      this.partialOutputFiles = [];
    } catch (error) {
      // Clean up partial files on error
      this.cleanupPartialFiles();
      throw error;
    }
  }

  /**
   * Calculate base glyph dimensions based on font size
   * Dimensions are aligned to 8-pixel boundaries
   * 
   * C++ Reference: BitmapFontGenerator.h lines 36-44
   * 
   * When rvd=true (--rvd flag):
   *   backSize = ceil(fontSize * (ascender - descender) / unitsPerEM)
   *   scaledFontSize = fontSize (render at original size)
   * 
   * When rvd=false (default):
   *   backSize = fontSize (config value)
   *   scaledFontSize = fontSize * unitsPerEM / (ascender - descender)
   */
  private calculateBaseGlyphDimensions(): void {
    const fontSize = this.config.fontSize;
    
    // Calculate backSize and scaledFontSize based on rvd mode
    if (this.parsedFont) {
      const font = this.parsedFont.opentypeFont;
      const unitsPerEm = font.unitsPerEm;
      const ascender = font.ascender;
      const descender = font.descender;
      
      if (this.config.rvd) {
        // rvd=true: render at original fontSize, calculate backSize
        // C++ formula: backSize = ceil(fontSize * (ascender - descender) / unitsPerEM)
        this.backSize = Math.ceil(fontSize * (ascender - descender) / unitsPerEm);
        this.scaledFontSize = fontSize;
      } else {
        // rvd=false (default): shrink fontSize to fit in backSize
        // C++ formula: backSize = fontSize, scaledFontSize = fontSize * unitsPerEM / (ascender - descender)
        this.backSize = fontSize;
        this.scaledFontSize = fontSize * unitsPerEm / (ascender - descender);
      }
    } else {
      this.backSize = fontSize;
      this.scaledFontSize = fontSize;
    }
    
    // Base dimensions are typically backSize + some padding
    // Align to 8-pixel boundaries for byte alignment
    const [alignedWidth, alignedHeight] = ImageProcessor.adjustDimensionsForAlignment(
      this.backSize,
      this.backSize
    );
    
    this.baseGlyphWidth = alignedWidth;
    this.baseGlyphHeight = alignedHeight;
  }

  /**
   * Calculate the recalculated font size for the header
   * 
   * C++ Reference: BitmapFontGenerator.h SetupFontHeader()
   * - size = scaledFontSize (the actual rendering size)
   * - fontSize = backSize (canvas size)
   * 
   * @returns Recalculated font size (rounded to nearest integer)
   */
  private calculateRecalculatedSize(): number {
    return Math.round(this.scaledFontSize);
  }

  /**
   * Render all glyphs in the character set
   * 
   * IMPORTANT: Failed characters are recorded in this.failedCharacters
   * but are NOT removed from this.characters. This ensures that the
   * CST file will contain all requested characters, matching C++ behavior.
   * 
   * C++ Reference: GenerateBitmapFont() in fontDictionary_o.cpp
   * - CST is written before rendering
   * - Failed renders go to NotSupportedChars.txt
   * - But all requested characters stay in CST
   * 
   * Requirements: 1.1, 1.2
   */
  private async renderAllGlyphs(): Promise<void> {
    for (const unicode of this.characters) {
      try {
        const glyph = await this.renderGlyph(unicode);
        if (glyph) {
          this.glyphs.set(unicode, glyph);
        } else {
          this.recordFailedCharacter(unicode);
        }
      } catch (error) {
        // Record failed character and continue
        this.recordFailedCharacter(unicode);
      }
    }
  }

  /**
   * Render a single glyph
   * 
   * @param unicode - Unicode code point
   * @returns Processed glyph or null if rendering failed
   */
  private async renderGlyph(unicode: number): Promise<ProcessedGlyph | null> {
    if (!this.parsedFont) {
      return null;
    }

    const font = this.parsedFont.opentypeFont;
    const glyph = font.charToGlyph(String.fromCodePoint(unicode));
    
    // Check if glyph exists (index 0 is typically .notdef)
    if (!glyph || glyph.index === 0) {
      return null;
    }

    // Get glyph metrics
    const advanceWidth = glyph.advanceWidth || 0;
    // backSize = canvas size (calculated based on rvd mode)
    // scaledFontSize = actual rendering size
    const backSize = this.backSize;
    const renderFontSize = this.scaledFontSize;
    const unitsPerEm = font.unitsPerEm;
    
    // Scale advance width to pixel size (using backSize for output metrics)
    const scaledAdvance = Math.round((advanceWidth / unitsPerEm) * backSize);

    // Get glyph bounding box for C++ compatible header calculation
    // Use scaledFontSize for actual rendering metrics
    const bbox = glyph.getBoundingBox();
    const scale = renderFontSize / unitsPerEm;
    const slotLeft = Math.floor(bbox.x1 * scale);  // slot->left equivalent
    const slotTop = Math.ceil(bbox.y2 * scale);    // slot->top equivalent

    // Render glyph to bitmap using scaledFontSize (C++ compatibility)
    let { pixels, width, height } = this.renderGlyphToBitmap(glyph, renderFontSize, unitsPerEm);
    
    // Save original bitmap dimensions for header calculation (before any processing)
    const originalBitmapWidth = width;
    const originalBitmapRows = height;
    
    if (width === 0 || height === 0) {
      // Empty glyph (like space) - create minimal bitmap
      // Use backSize for canvas dimensions
      width = Math.max(1, Math.round(scaledAdvance / 2));
      height = backSize;
      pixels = new Uint8Array(width * height);
    }

    // Apply gamma correction
    if (this.config.gamma !== 1.0) {
      pixels = ImageProcessor.applyGamma(pixels, width, height, this.config.gamma);
    }

    // Apply bold effect
    if (this.config.bold) {
      const result = ImageProcessor.applyBold(pixels, width, height);
      pixels = result.pixels;
      width = result.width;
      height = result.height;
    }

    // Apply italic effect
    if (this.config.italic) {
      const result = ImageProcessor.applyItalic(pixels, width, height);
      pixels = result.pixels;
      width = result.width;
      height = result.height;
    }

    // Apply rotation
    if (this.config.rotation !== Rotation.ROTATE_0) {
      const result = ImageProcessor.rotateImage(pixels, width, height, this.config.rotation);
      pixels = result.pixels;
      width = result.width;
      height = result.height;
    }

    // Handle cropping or padding
    let cropInfo: CropInfo | undefined;
    
    // Both crop and non-crop modes need to render to canvas with baseline alignment first
    // C++ calculation:
    // rows = backSize (fontSize)
    // cols = backSize * (2 + italic) / 2
    // Then align to 8-pixel boundaries based on rotation
    
    let targetRows = backSize;
    let targetCols = Math.floor(backSize * (2 + (this.config.italic ? 1 : 0)) / 2);
    
    // Align dimensions based on rotation (matching C++ AdjustDimensionsForScanModeAndRotation)
    if (this.config.rotation === Rotation.ROTATE_90 || 
        this.config.rotation === Rotation.ROTATE_270) {
      targetRows = targetRows % 8 ? (Math.floor(targetRows / 8) + 1) * 8 : targetRows;
    } else {
      targetCols = targetCols % 8 ? (Math.floor(targetCols / 8) + 1) * 8 : targetCols;
    }
    
    const targetWidth = targetCols;
    const targetHeight = targetRows;
    
    // Calculate baseline position for proper vertical alignment (C++ compatibility)
    // C++ formula: baseline_height = ascender * backSize / (ascender - descender)
    const ascender = font.ascender;
    const descender = font.descender;
    const baselineHeight = Math.round(Math.abs(ascender) * backSize / (ascender - descender));
    
    // Calculate glyph position on canvas using baseline alignment
    // C++ logic:
    //   pos.x = slot->left (clamped to canvas bounds)
    //   pos.y = baseline_height - slot->top + rows (bottom of glyph)
    // Then renders: r = pos.y - (rows - i), meaning from pos.y upward
    
    // slotLeft and slotTop are already calculated above
    // slotTop = bbox.y2 * scale = distance from baseline to glyph top
    // slotLeft = bbox.x1 * scale = left bearing
    
    // Calculate draw position
    let drawX = slotLeft;
    if (drawX < 0) {
      drawX = 0;
    } else if (drawX + width > targetWidth) {
      drawX = targetWidth - width;
    }
    
    // pos.y in C++ is the bottom of the glyph bitmap
    let posY = baselineHeight - slotTop + height;
    if (baselineHeight - slotTop < 0) {
      posY = height;
    } else if (posY > targetHeight) {
      posY = targetHeight;
    }
    
    // Create new canvas and copy glyph with baseline alignment
    const canvas = new Uint8Array(targetWidth * targetHeight);
    
    // C++ renders from pos.y upward: r = pos.y - (rows - i)
    // This means: for glyph row i (0 = top), canvas row = pos.y - rows + i
    // Which is: canvas row = pos.y - height + i
    for (let i = 0; i < height; i++) {
      const canvasY = posY - height + i;
      if (canvasY < 0 || canvasY >= targetHeight) continue;
      
      for (let j = 0; j < width; j++) {
        const canvasX = drawX + j;
        if (canvasX < 0 || canvasX >= targetWidth) continue;
        
        // Source pixel (glyph bitmap is in normal orientation, top-to-bottom)
        // But opentype.js renders Y-up, so we need to flip
        const srcY = height - 1 - i;
        canvas[canvasY * targetWidth + canvasX] = pixels[srcY * width + j];
      }
    }
    
    pixels = canvas;
    width = targetWidth;
    height = targetHeight;
    
    if (this.config.crop) {
      // C++ crop: only remove top empty rows
      // validWidth = pos.x (drawX + originalBitmapWidth)
      // validHeight = pos.y (already calculated above)
      // Then find zeroRowsCount (top empty rows)
      
      const cropValidWidth = Math.min(drawX + originalBitmapWidth, width);
      const cropValidHeight = Math.min(posY, height);
      
      // Find top skip (first non-zero row within valid area)
      let topSkip = 0;
      let foundTop = false;
      for (let y = 0; y < cropValidHeight && !foundTop; y++) {
        for (let x = 0; x < cropValidWidth; x++) {
          if (pixels[y * width + x] > 0) {
            topSkip = y;
            foundTop = true;
            break;
          }
        }
      }
      
      // C++ keeps all rows from topSkip to cropValidHeight
      const croppedHeight = foundTop ? (cropValidHeight - topSkip) : 0;
      
      if (croppedHeight > 0 && cropValidWidth > 0) {
        const cropped = new Uint8Array(cropValidWidth * croppedHeight);
        for (let y = 0; y < croppedHeight; y++) {
          for (let x = 0; x < cropValidWidth; x++) {
            cropped[y * cropValidWidth + x] = pixels[(y + topSkip) * width + x];
          }
        }
        pixels = cropped;
        width = cropValidWidth;
        height = croppedHeight;
        cropInfo = {
          topSkip,
          leftSkip: 0,
          validWidth: cropValidWidth,
          validHeight: croppedHeight
        };
      } else {
        pixels = new Uint8Array(0);
        width = 0;
        height = 0;
        cropInfo = {
          topSkip: cropValidHeight,
          leftSkip: 0,
          validWidth: 0,
          validHeight: 0
        };
      }
    }

    // Pack pixels according to render mode
    const packedPixels = ImageProcessor.packPixels(
      pixels,
      width,
      height,
      this.config.renderMode
    );

    // C++ calculation uses clamped draw positions (after bounds checking):
    // pos.x starts as drawX (clamped slot->left), then pos.x += cols
    // pos.y is already clamped in the baseline calculation above
    // posO.x = drawX - slot->left  (offset for negative left bearing, e.g. 'j')
    // posO.y = pos.y - rows + slot->top
    //
    // C++ CvxText.cpp logic:
    //   if (slot->left < 0) { pos.x = 0; }
    //   else if (slot->left + cols > img.cols) { pos.x = img.cols - cols; }
    //   else { pos.x = slot->left; }
    //   RenderToBitmap(...)
    //   pos.x += cols;  // final char_w = drawX + cols
    //   posO.x = pos.x - slot->left;  // always executed after all branches
    const posX = drawX + originalBitmapWidth;  // Character width: C++ does pos.x = drawX, then pos.x += cols
    const posYHeader = posY;  // Character height: posY is already clamped like C++ pos.y
    const posOX = drawX - slotLeft;  // X offset: compensates for negative left bearing (e.g. 'j')
    const posOY = posY - originalBitmapRows + slotTop;  // Y offset: C++ posO.y = pos.y - rows + slot->top

    return {
      unicode,
      pixelData: packedPixels,
      width,
      height,
      cropInfo,
      advance: scaledAdvance,
      xOffset: Math.max(0, Math.min(255, posOX)),
      yOffset: Math.max(0, Math.min(255, posOY)),
      charWidth: Math.max(0, Math.min(255, posX)),
      charHeight: Math.max(0, Math.min(255, posYHeader))
    };
  }

  /**
   * Render a glyph to a grayscale bitmap using opentype.js with supersampling
   * 
   * Uses 4x supersampling for anti-aliasing: renders at 4x resolution then
   * downsamples to target size, producing smooth grayscale edges.
   * 
   * @param glyph - OpenType glyph
   * @param fontSize - Target font size in pixels
   * @param unitsPerEm - Font units per em
   * @returns Grayscale pixel data and dimensions
   */
  private renderGlyphToBitmap(
    glyph: opentype.Glyph,
    fontSize: number,
    unitsPerEm: number
  ): { pixels: Uint8Array; width: number; height: number } {
    // Get glyph bounding box
    const bbox = glyph.getBoundingBox();
    
    // Scale factor
    const scale = fontSize / unitsPerEm;
    
    // Calculate dimensions
    const x1 = Math.floor(bbox.x1 * scale);
    const y1 = Math.floor(bbox.y1 * scale);
    const x2 = Math.ceil(bbox.x2 * scale);
    const y2 = Math.ceil(bbox.y2 * scale);
    
    // Check for empty glyph (like space) - bbox is all zeros
    if (bbox.x1 === 0 && bbox.y1 === 0 && bbox.x2 === 0 && bbox.y2 === 0) {
      return { pixels: new Uint8Array(0), width: 0, height: 0 };
    }
    
    const width = Math.max(1, x2 - x1);
    const height = Math.max(1, y2 - y1);
    
    if (width <= 0 || height <= 0) {
      return { pixels: new Uint8Array(0), width: 0, height: 0 };
    }

    // Supersampling factor (4x for good quality anti-aliasing)
    const ssScale = 4;
    const ssWidth = width * ssScale;
    const ssHeight = height * ssScale;
    const ssFontSize = fontSize * ssScale;
    
    // Create supersampled pixel buffer
    const ssPixels = new Uint8Array(ssWidth * ssHeight);
    
    // Get glyph path at supersampled size
    const path = glyph.getPath(0, 0, ssFontSize);
    
    // Rasterize at high resolution
    this.rasterizePathImproved(path, ssPixels, ssWidth, ssHeight, -x1 * ssScale, -y1 * ssScale);
    
    // Downsample to target size with box filter (average)
    const pixels = this.downsampleBitmap(ssPixels, ssWidth, ssHeight, width, height, ssScale);
    
    return { pixels, width, height };
  }

  /**
   * Downsample a bitmap using box filter (averaging)
   * 
   * @param src - Source pixel data
   * @param srcWidth - Source width
   * @param srcHeight - Source height
   * @param dstWidth - Destination width
   * @param dstHeight - Destination height
   * @param scale - Downsample scale factor
   * @returns Downsampled pixel data
   */
  private downsampleBitmap(
    src: Uint8Array,
    srcWidth: number,
    srcHeight: number,
    dstWidth: number,
    dstHeight: number,
    scale: number
  ): Uint8Array {
    const dst = new Uint8Array(dstWidth * dstHeight);
    const scaleSquared = scale * scale;
    
    for (let dstY = 0; dstY < dstHeight; dstY++) {
      for (let dstX = 0; dstX < dstWidth; dstX++) {
        // Sum all source pixels in this block
        let sum = 0;
        const srcStartX = dstX * scale;
        const srcStartY = dstY * scale;
        
        for (let sy = 0; sy < scale; sy++) {
          for (let sx = 0; sx < scale; sx++) {
            const srcX = srcStartX + sx;
            const srcY = srcStartY + sy;
            if (srcX < srcWidth && srcY < srcHeight) {
              sum += src[srcY * srcWidth + srcX];
            }
          }
        }
        
        // Average and store
        dst[dstY * dstWidth + dstX] = Math.round(sum / scaleSquared);
      }
    }
    
    return dst;
  }

  /**
   * Improved path rasterization using proper scanline algorithm
   * Based on the even-odd fill rule
   */
  private rasterizePathImproved(
    path: opentype.Path,
    pixels: Uint8Array,
    width: number,
    height: number,
    offsetX: number,
    offsetY: number
  ): void {
    // Build contours from path commands
    const contours: Array<Array<{ x: number; y: number }>> = [];
    let currentContour: Array<{ x: number; y: number }> = [];
    let currentX = 0;
    let currentY = 0;

    for (const cmd of path.commands) {
      switch (cmd.type) {
        case 'M': // Move to
          if (currentContour.length > 0) {
            contours.push(currentContour);
            currentContour = [];
          }
          currentX = cmd.x + offsetX;
          currentY = offsetY - cmd.y;
          currentContour.push({ x: currentX, y: currentY });
          break;
          
        case 'L': // Line to
          currentX = cmd.x + offsetX;
          currentY = offsetY - cmd.y;
          currentContour.push({ x: currentX, y: currentY });
          break;
          
        case 'Q': // Quadratic curve
          {
            const x0 = currentX;
            const y0 = currentY;
            const x1 = cmd.x1 + offsetX;
            const y1 = offsetY - cmd.y1;
            const x2 = cmd.x + offsetX;
            const y2 = offsetY - cmd.y;
            
            // Approximate with line segments
            const steps = 10;
            for (let i = 1; i <= steps; i++) {
              const t = i / steps;
              const mt = 1 - t;
              const x = mt * mt * x0 + 2 * mt * t * x1 + t * t * x2;
              const y = mt * mt * y0 + 2 * mt * t * y1 + t * t * y2;
              currentContour.push({ x, y });
            }
            currentX = x2;
            currentY = y2;
          }
          break;
          
        case 'C': // Cubic curve
          {
            const x0 = currentX;
            const y0 = currentY;
            const x1 = cmd.x1 + offsetX;
            const y1 = offsetY - cmd.y1;
            const x2 = cmd.x2 + offsetX;
            const y2 = offsetY - cmd.y2;
            const x3 = cmd.x + offsetX;
            const y3 = offsetY - cmd.y;
            
            // Approximate with line segments
            const steps = 10;
            for (let i = 1; i <= steps; i++) {
              const t = i / steps;
              const mt = 1 - t;
              const mt2 = mt * mt;
              const mt3 = mt2 * mt;
              const t2 = t * t;
              const t3 = t2 * t;
              
              const x = mt3 * x0 + 3 * mt2 * t * x1 + 3 * mt * t2 * x2 + t3 * x3;
              const y = mt3 * y0 + 3 * mt2 * t * y1 + 3 * mt * t2 * y2 + t3 * y3;
              currentContour.push({ x, y });
            }
            currentX = x3;
            currentY = y3;
          }
          break;
          
        case 'Z': // Close path
          if (currentContour.length > 0) {
            contours.push(currentContour);
            currentContour = [];
          }
          break;
      }
    }
    
    if (currentContour.length > 0) {
      contours.push(currentContour);
    }

    // Scanline fill using even-odd rule
    for (let y = 0; y < height; y++) {
      const intersections: number[] = [];
      
      // Find all intersections with this scanline
      for (const contour of contours) {
        for (let i = 0; i < contour.length; i++) {
          const p1 = contour[i];
          const p2 = contour[(i + 1) % contour.length];
          
          // Check if edge crosses scanline
          if ((p1.y <= y && p2.y > y) || (p2.y <= y && p1.y > y)) {
            // Calculate x intersection
            const t = (y - p1.y) / (p2.y - p1.y);
            const x = p1.x + t * (p2.x - p1.x);
            intersections.push(x);
          }
        }
      }
      
      // Sort intersections
      intersections.sort((a, b) => a - b);
      
      // Fill between pairs (even-odd rule)
      for (let i = 0; i < intersections.length - 1; i += 2) {
        const xStart = Math.max(0, Math.ceil(intersections[i]));
        const xEnd = Math.min(width - 1, Math.floor(intersections[i + 1]));
        
        for (let x = xStart; x <= xEnd; x++) {
          pixels[y * width + x] = 255;
        }
      }
    }
  }

  /**
   * Create the bitmap font header
   */
  private createHeader(): BitmapFontHeader {
    const config: BitmapFontHeaderConfig = {
      fontName: this.getFontName(),
      size: this.calculateRecalculatedSize(),
      fontSize: this.backSize,  // backSize is the canvas size (header.fontSize field)
      renderMode: this.config.renderMode,
      bold: this.config.bold,
      italic: this.config.italic,
      indexMethod: this.config.indexMethod,
      crop: this.config.crop,
      characterCount: this.glyphs.size,
      rvd: this.config.rvd || false
    };
    
    return new BitmapFontHeader(config);
  }

  /**
   * Create the index array based on index method and crop settings
   * 
   * Index modes:
   * 1. crop=true, indexMethod=ADDRESS: 65536 × 4 bytes (file offsets)
   * 2. crop=true, indexMethod=OFFSET: N × 6 bytes (unicode 2B + file offset 4B)
   * 3. crop=false, indexMethod=ADDRESS: 65536 × 2 bytes (character indices)
   * 4. crop=false, indexMethod=OFFSET: N × 2 bytes (unicode only)
   */
  private createIndexArray(): IndexEntry[] {
    const entries: IndexEntry[] = [];
    
    if (this.config.crop) {
      if (this.config.indexMethod === IndexMethod.OFFSET) {
        // Offset + Crop mode: N entries with unicode + file offset (placeholder)
        // File offsets will be filled in during writeGlyphData
        for (const unicode of this.characters) {
          if (this.glyphs.has(unicode)) {
            entries.push({ unicode, value: BINARY_FORMAT.UNUSED_INDEX_32 });
          }
        }
      } else {
        // Address + Crop mode: 65536 entries with file offsets
        // Initialize all entries with 0xFFFFFFFF (unused)
        for (let i = 0; i < BINARY_FORMAT.MAX_INDEX_SIZE; i++) {
          entries.push({ unicode: i, value: BINARY_FORMAT.UNUSED_INDEX_32 });
        }
        
        // Update entries for successfully rendered characters only
        // Failed characters keep UNUSED_INDEX_32 (0xFFFFFFFF)
        let charIndex = 0;
        for (const unicode of this.characters) {
          if (this.glyphs.has(unicode)) {
            entries[unicode].value = charIndex; // Temporary: store char index
            charIndex++;
          }
        }
      }
    } else if (this.config.indexMethod === IndexMethod.ADDRESS) {
      // Address mode: 65536 entries with character indices
      for (let i = 0; i < BINARY_FORMAT.MAX_INDEX_SIZE; i++) {
        entries.push({ unicode: i, value: BINARY_FORMAT.UNUSED_INDEX_16 });
      }
      
      // Update entries for successfully rendered characters only
      // Failed characters keep UNUSED_INDEX_16 (0xFFFF)
      let charIndex = 0;
      for (const unicode of this.characters) {
        if (this.glyphs.has(unicode)) {
          entries[unicode].value = charIndex;
          charIndex++;
        }
      }
    } else {
      // Offset mode: N entries with unicode + char index
      // Only include successfully rendered characters
      let charIndex = 0;
      for (const unicode of this.characters) {
        if (this.glyphs.has(unicode)) {
          entries.push({ unicode, value: charIndex });
          charIndex++;
        }
      }
    }
    
    return entries;
  }

  /**
   * Generate output base name for files
   * Format: [fontName]_size[size]_bits[mode]_bitmap
   */
  private generateOutputBaseName(): string {
    const fontName = this.getFontName();
    const size = this.config.fontSize;
    const bits = this.config.renderMode;
    
    return `${fontName}${FILE_NAMING.SIZE_PREFIX}${size}${FILE_NAMING.BITS_PREFIX}${bits}_bitmap`;
  }

  /**
   * Generate output filename
   * Format: [fontName]_size[size]_bits[mode]_bitmap.bin
   */
  generateOutputFilename(): string {
    return this.generateOutputBaseName() + '.bin';
  }

  /**
   * Write the binary font file
   */
  private async writeBinaryFile(
    baseName: string,
    header: BitmapFontHeader,
    indexArray: IndexEntry[]
  ): Promise<void> {
    const filePath = PathUtils.join(this.config.outputPath, baseName + '.bin');
    
    // Calculate total file size
    const headerSize = header.getSize();
    const indexSize = header.indexAreaSize;
    
    // Calculate glyph data size for successfully rendered glyphs only
    // C++ only writes glyph data for characters that rendered successfully
    // Canvas size calculation matches C++ logic:
    // rows = backSize
    // cols = backSize * (2 + italic) / 2
    // Then align to 8-pixel boundaries based on rotation
    const backSize = this.backSize;
    let targetRows = backSize;
    let targetCols = Math.floor(backSize * (2 + (this.config.italic ? 1 : 0)) / 2);
    
    if (this.config.rotation === Rotation.ROTATE_90 || 
        this.config.rotation === Rotation.ROTATE_270) {
      targetRows = targetRows % 8 ? (Math.floor(targetRows / 8) + 1) * 8 : targetRows;
    } else {
      targetCols = targetCols % 8 ? (Math.floor(targetCols / 8) + 1) * 8 : targetCols;
    }
    
    const pixelsPerByte = 8 / this.config.renderMode;
    const pixelDataSize = (targetCols * targetRows) / pixelsPerByte;
    const glyphSize = 4 + pixelDataSize; // 4-byte header + pixel data
    const glyphDataSize = this.glyphs.size * glyphSize;
    
    const totalSize = headerSize + indexSize + glyphDataSize;
    const writer = new BinaryWriter(totalSize);
    
    // Write header
    const headerBytes = header.toBytes();
    writer.writeBytes(headerBytes);
    
    // Write index array
    const indexStartOffset = writer.getOffset();
    this.writeIndexArray(writer, indexArray, header);
    
    // Write glyph data and update index array with file offsets (for crop mode)
    const glyphDataStartOffset = writer.getOffset();
    await this.writeGlyphData(writer, indexArray, indexStartOffset, glyphDataStartOffset);
    
    // Write to file
    try {
      fs.writeFileSync(filePath, writer.getBuffer());
    } catch (error) {
      throw createFileWriteError(filePath, error as Error);
    }
  }

  /**
   * Write the index array to the binary writer
   */
  private writeIndexArray(
    writer: BinaryWriter,
    indexArray: IndexEntry[],
    header: BitmapFontHeader
  ): void {
    if (this.config.crop) {
      if (this.config.indexMethod === IndexMethod.OFFSET) {
        // Offset + Crop mode: N × 6 bytes (unicode 2B + file offset 4B)
        // Write unicode values now, file offsets will be updated in writeGlyphData
        for (const entry of indexArray) {
          writer.writeUint16LE(entry.unicode);
          writer.writeUint32LE(BINARY_FORMAT.UNUSED_INDEX_32); // Placeholder
        }
      } else {
        // Address + Crop mode: 65536 × 4 bytes (uint32 file offsets)
        // Initially write placeholder values, will be updated later
        for (let i = 0; i < BINARY_FORMAT.MAX_INDEX_SIZE; i++) {
          writer.writeUint32LE(BINARY_FORMAT.UNUSED_INDEX_32);
        }
      }
    } else if (this.config.indexMethod === IndexMethod.ADDRESS) {
      // Address mode: 65536 × 2 bytes (uint16 character indices)
      for (let i = 0; i < BINARY_FORMAT.MAX_INDEX_SIZE; i++) {
        writer.writeUint16LE(indexArray[i].value);
      }
    } else {
      // Offset mode: N × 2 bytes (uint16 unicode only)
      // The character index is implicit from the array position
      for (const entry of indexArray) {
        writer.writeUint16LE(entry.unicode);
      }
    }
  }

  /**
   * Write glyph data to the binary writer
   * For crop mode, also updates the index array with file offsets
   * 
   * C++ Reference: ProcessNormalCharacter() in BitmapFontGenerator.h
   * Non-crop mode writes 4-byte header: [posO.x, posO.y, pos.x, pos.y]
   */
  private async writeGlyphData(
    writer: BinaryWriter,
    indexArray: IndexEntry[],
    indexStartOffset: number,
    glyphDataStartOffset: number
  ): Promise<void> {
    // C++ only writes glyph data for successfully rendered characters
    // Failed characters are skipped (they have 0xFFFF in index array)
    
    // Sort glyphs by unicode for consistent output (matching C++ order)
    const sortedGlyphs = Array.from(this.glyphs.entries())
      .sort((a, b) => a[0] - b[0]);
    
    // Build unicode to index mapping for offset+crop mode
    const unicodeToIndexMap = new Map<number, number>();
    if (this.config.crop && this.config.indexMethod === IndexMethod.OFFSET) {
      indexArray.forEach((entry, idx) => {
        unicodeToIndexMap.set(entry.unicode, idx);
      });
    }
    
    for (const [unicode, glyph] of sortedGlyphs) {
      const glyphOffset = writer.getOffset();
      
      // Update index array with file offset (for crop mode)
      if (this.config.crop) {
        if (this.config.indexMethod === IndexMethod.OFFSET) {
          // Offset + Crop mode: update file offset at position (idx * 6 + 2)
          // Format: [unicode(2B), offset(4B)] per entry
          const idx = unicodeToIndexMap.get(unicode);
          if (idx !== undefined) {
            const offsetPosition = indexStartOffset + idx * 6 + 2; // Skip unicode (2B)
            writer.writeUint32LEAt(offsetPosition, glyphOffset);
          }
        } else {
          // Address + Crop mode: update file offset at position (unicode * 4)
          const indexOffset = indexStartOffset + unicode * 4;
          writer.writeUint32LEAt(indexOffset, glyphOffset);
        }
      }
      
      // Write glyph header (4 bytes)
      if (this.config.crop && glyph.cropInfo) {
        // Crop mode: [topSkip, yOffset, charWidth, charHeight]
        // C++ keeps cPos[1-3] same as non-crop, only cPos[0] becomes zeroRowsCount
        writer.writeUint8(glyph.cropInfo.topSkip);
        writer.writeUint8(glyph.yOffset);
        writer.writeUint8(glyph.charWidth);
        writer.writeUint8(glyph.charHeight);
      } else {
        // Non-crop mode: [xOffset, yOffset, charWidth, charHeight]
        writer.writeUint8(glyph.xOffset);
        writer.writeUint8(glyph.yOffset);
        writer.writeUint8(glyph.charWidth);
        writer.writeUint8(glyph.charHeight);
      }
      
      // Write packed pixel data
      writer.writeBytes(glyph.pixelData);
    }
  }

  /**
   * Get the number of successfully rendered glyphs
   */
  getGlyphCount(): number {
    return this.glyphs.size;
  }

  /**
   * Get the base glyph dimensions
   */
  getBaseGlyphDimensions(): { width: number; height: number } {
    return {
      width: this.baseGlyphWidth,
      height: this.baseGlyphHeight
    };
  }
}
