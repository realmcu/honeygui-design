/**
 * ConversionConfigService Property-Based Tests
 * 
 * **Feature: image-conversion-config**
 * 
 * Property 2: Configuration Persistence Round-Trip
 * Property 3: Inheritance Resolution
 */

import * as fs from 'fs';
import * as path from 'path';
import * as fc from 'fast-check';
import {
  ConversionConfigService,
  ConversionConfig,
  ItemSettings,
  TargetFormat,
  CompressionMethod,
  YuvSampling,
  YuvBlur,
  YuvParams
} from '../../src/services/ConversionConfigService';

const TEST_DIR = path.join(__dirname, 'temp-config');

// Arbitraries for generating random config values
const targetFormatArb = fc.constantFrom<TargetFormat>(
  'RGB565', 'RGB888', 'ARGB8565', 'ARGB8888', 'I8', 'adaptive16', 'adaptive24', 'inherit'
);

const compressionMethodArb = fc.constantFrom<CompressionMethod>(
  'none', 'rle', 'fastlz', 'yuv', 'adaptive'
);

const yuvSamplingArb = fc.constantFrom<YuvSampling>('YUV444', 'YUV422', 'YUV411');
const yuvBlurArb = fc.constantFrom<YuvBlur>('none', '1bit', '2bit', '4bit');

const yuvParamsArb: fc.Arbitrary<YuvParams> = fc.record({
  sampling: yuvSamplingArb,
  blur: yuvBlurArb,
  fastlzSecondary: fc.boolean()
});


const itemSettingsArb: fc.Arbitrary<ItemSettings> = fc.record({
  format: fc.option(targetFormatArb, { nil: undefined }),
  compression: fc.option(compressionMethodArb, { nil: undefined }),
  yuvParams: fc.option(yuvParamsArb, { nil: undefined })
}).map(settings => {
  // Clean up undefined values
  const result: ItemSettings = {};
  if (settings.format !== undefined) result.format = settings.format;
  if (settings.compression !== undefined) result.compression = settings.compression;
  if (settings.yuvParams !== undefined) result.yuvParams = settings.yuvParams;
  return result;
});

// Generate valid path segments (no special characters)
const pathSegmentArb = fc.stringOf(
  fc.constantFrom(...'abcdefghijklmnopqrstuvwxyz0123456789_-'.split('')),
  { minLength: 1, maxLength: 10 }
);

// Generate valid asset paths
const assetPathArb = fc.array(pathSegmentArb, { minLength: 1, maxLength: 4 })
  .map(segments => segments.join('/'));

// Generate items record
const itemsRecordArb = fc.dictionary(assetPathArb, itemSettingsArb);

// Generate complete config
const conversionConfigArb: fc.Arbitrary<ConversionConfig> = fc.record({
  version: fc.constant('1.0'),
  defaultSettings: itemSettingsArb,
  items: itemsRecordArb
});

describe('ConversionConfigService', () => {
  let service: ConversionConfigService;

  beforeAll(() => {
    service = ConversionConfigService.getInstance();
  });

  beforeEach(() => {
    if (!fs.existsSync(TEST_DIR)) {
      fs.mkdirSync(TEST_DIR, { recursive: true });
    }
  });

  afterEach(() => {
    if (fs.existsSync(TEST_DIR)) {
      fs.rmSync(TEST_DIR, { recursive: true });
    }
  });


  /**
   * **Property 2: Configuration Persistence Round-Trip**
   * 
   * *For any* valid ConversionConfig object, saving it to the config file 
   * and then loading it back SHALL produce an equivalent configuration object.
   * Note: loadConfig merges default values for missing fields, so we verify
   * that the loaded config contains at least the saved values.
   * 
   * **Validates: Requirements 1.4, 2.4, 3.4, 4.4, 6.4**
   */
  test('Property 2: Configuration Persistence Round-Trip', () => {
    fc.assert(
      fc.property(conversionConfigArb, (config) => {
        // Save config
        service.saveConfig(TEST_DIR, config);
        
        // Load config back
        const loadedConfig = service.loadConfig(TEST_DIR);
        
        // Verify round-trip consistency
        expect(loadedConfig.version).toBe(config.version);
        
        // Items should be exactly equal
        expect(loadedConfig.items).toEqual(config.items);
        
        // For defaultSettings, verify saved values are preserved
        // (loadConfig may add default values for missing fields)
        if (config.defaultSettings.format) {
          expect(loadedConfig.defaultSettings.format).toBe(config.defaultSettings.format);
        }
        if (config.defaultSettings.compression) {
          expect(loadedConfig.defaultSettings.compression).toBe(config.defaultSettings.compression);
        }
        if (config.defaultSettings.yuvParams) {
          expect(loadedConfig.defaultSettings.yuvParams).toEqual(config.defaultSettings.yuvParams);
        }
      }),
      { numRuns: 100 }
    );
  });

  /**
   * **Property 3: Inheritance Resolution**
   * 
   * *For any* asset path in the configuration:
   * - If the item has explicit settings, those settings SHALL be used
   * - If the item has no explicit settings or has `format: 'inherit'`, 
   *   the effective settings SHALL equal the nearest ancestor's settings
   * - The root default settings SHALL be used when no ancestor has explicit settings
   * 
   * **Validates: Requirements 2.2, 2.3, 5.1, 5.2, 5.3**
   */
  test('Property 3: Inheritance Resolution - explicit settings used', () => {
    fc.assert(
      fc.property(
        assetPathArb,
        targetFormatArb.filter(f => f !== 'inherit'),
        compressionMethodArb,
        (assetPath, format, compression) => {
          const config: ConversionConfig = {
            version: '1.0',
            defaultSettings: { format: 'RGB565', compression: 'none' },
            items: {
              [assetPath]: { format, compression }
            }
          };
          
          const resolved = service.resolveEffectiveConfig(assetPath, config);
          
          // Explicit settings should be used (not inherited)
          expect(resolved.isInherited).toBe(false);
          expect(resolved.compression).toBe(compression);
        }
      ),
      { numRuns: 100 }
    );
  });


  test('Property 3: Inheritance Resolution - inherit from parent', () => {
    fc.assert(
      fc.property(
        pathSegmentArb,
        pathSegmentArb,
        targetFormatArb.filter(f => f !== 'inherit' && f !== 'adaptive16' && f !== 'adaptive24'),
        compressionMethodArb,
        (parentDir, childFile, parentFormat, parentCompression) => {
          const parentPath = parentDir;
          const childPath = `${parentDir}/${childFile}`;
          
          const config: ConversionConfig = {
            version: '1.0',
            defaultSettings: { format: 'RGB565', compression: 'none' },
            items: {
              [parentPath]: { format: parentFormat, compression: parentCompression },
              [childPath]: { format: 'inherit' }
            }
          };
          
          const resolved = service.resolveEffectiveConfig(childPath, config);
          
          // Should inherit from parent
          expect(resolved.isInherited).toBe(true);
          expect(resolved.compression).toBe(parentCompression);
        }
      ),
      { numRuns: 100 }
    );
  });

  test('Property 3: Inheritance Resolution - default settings when no parent', () => {
    fc.assert(
      fc.property(
        assetPathArb,
        targetFormatArb.filter(f => f !== 'inherit' && f !== 'adaptive16' && f !== 'adaptive24'),
        compressionMethodArb,
        (assetPath, defaultFormat, defaultCompression) => {
          const config: ConversionConfig = {
            version: '1.0',
            defaultSettings: { format: defaultFormat, compression: defaultCompression },
            items: {}
          };
          
          const resolved = service.resolveEffectiveConfig(assetPath, config);
          
          // Should use default settings
          expect(resolved.isInherited).toBe(true);
          expect(resolved.inheritedFrom).toBe('default');
          expect(resolved.compression).toBe(defaultCompression);
        }
      ),
      { numRuns: 100 }
    );
  });
});


describe('ConversionConfigService - Adaptive Format', () => {
  let service: ConversionConfigService;

  beforeAll(() => {
    service = ConversionConfigService.getInstance();
  });

  /**
   * **Property 1: Adaptive Format Selection**
   * 
   * *For any* image with transparency and adaptive16 format setting, 
   * the resolved format SHALL be ARGB8565; 
   * *for any* image without transparency and adaptive16 format setting, 
   * the resolved format SHALL be RGB565.
   * Similarly for adaptive24: with transparency → ARGB8888, without transparency → RGB888.
   * 
   * **Validates: Requirements 1.2, 1.3**
   */
  test('Property 1: Adaptive Format Selection - adaptive16', () => {
    fc.assert(
      fc.property(fc.boolean(), (hasAlpha) => {
        const result = service.resolveAdaptiveFormat('adaptive16', hasAlpha);
        
        if (hasAlpha) {
          expect(result).toBe('ARGB8565');
        } else {
          expect(result).toBe('RGB565');
        }
      }),
      { numRuns: 100 }
    );
  });

  test('Property 1: Adaptive Format Selection - adaptive24', () => {
    fc.assert(
      fc.property(fc.boolean(), (hasAlpha) => {
        const result = service.resolveAdaptiveFormat('adaptive24', hasAlpha);
        
        if (hasAlpha) {
          expect(result).toBe('ARGB8888');
        } else {
          expect(result).toBe('RGB888');
        }
      }),
      { numRuns: 100 }
    );
  });

  test('Property 1: Adaptive Format Selection - fixed formats unchanged', () => {
    const fixedFormats: Array<Exclude<TargetFormat, 'inherit' | 'adaptive16' | 'adaptive24'>> = [
      'RGB565', 'RGB888', 'ARGB8565', 'ARGB8888', 'I8'
    ];
    
    fc.assert(
      fc.property(
        fc.constantFrom(...fixedFormats),
        fc.boolean(),
        (format, hasAlpha) => {
          const result = service.resolveAdaptiveFormat(format, hasAlpha);
          expect(result).toBe(format);
        }
      ),
      { numRuns: 100 }
    );
  });
});
