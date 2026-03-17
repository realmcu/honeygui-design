#!/usr/bin/env node

/**
 * Command-line interface for the Image to JPEG Converter.
 * 
 * Provides a CLI for converting images to JPEG format with custom binary headers.
 * Parses command-line arguments, validates inputs, and displays results or errors.
 * 
 * @module cli
 * @see Requirement 11.1
 * 
 * @example
 * ```bash
 * # Basic conversion
 * image-to-jpeg -i input.png -o output.jpg -s 420 -q 10
 * 
 * # With resize option
 * image-to-jpeg -i input.png -o output.jpg -s 422 -q 5 -r 50
 * 
 * # Grayscale conversion
 * image-to-jpeg -i input.png -o output.jpg -s 400 -q 20
 * 
 * # High quality with compression flag
 * image-to-jpeg -i input.png -o output.jpg -s 444 -q 2 -c
 * ```
 */

import { convertToJpeg } from './index.js';
import { SamplingFactor, ResizeOption, ConversionError } from './types.js';

/**
 * CLI argument interface.
 */
interface CliArgs {
  input?: string | undefined;
  output?: string | undefined;
  sampling?: string | undefined;
  quality?: string | undefined;
  resize?: string | undefined;
  compress?: boolean | undefined;
  help?: boolean | undefined;
  version?: boolean | undefined;
}

/**
 * Displays help text with usage examples.
 * 
 * Shows all available command-line options, their descriptions, and
 * practical usage examples for common scenarios.
 * 
 * @see Requirement 11.1
 */
function displayHelp(): void {
  console.log(`
Image to JPEG Converter - CLI

USAGE:
  image-to-jpeg [OPTIONS]

OPTIONS:
  -i, --input <path>       Input image file path (required)
                           Supports any format that FFmpeg can read (PNG, BMP, TIFF, GIF, etc.)

  -o, --output <path>      Output JPEG file path (required)
                           Will be created with custom binary header for embedded systems

  -s, --sampling <factor>  Chroma sampling factor (required)
                           Valid values:
                             400 - Grayscale (Y channel only)
                             420 - 4:2:0 subsampling (most common, good compression)
                             422 - 4:2:2 subsampling (better quality, moderate compression)
                             444 - 4:4:4 subsampling (best quality, least compression)

  -q, --quality <value>    JPEG encoding quality (optional, default varies by sampling)
                           Valid range: 1-31 (lower is higher quality)
                           Recommended values:
                             1-5   - Very high quality
                             6-10  - High quality
                             11-20 - Medium quality
                             21-31 - Low quality

  -r, --resize <percent>   Resize image to percentage of original (optional)
                           Valid values:
                             50  - Resize to 50% of original dimensions
                             70  - Resize to 70% of original dimensions
                             80  - Resize to 80% of original dimensions

  -c, --compress           Enable compression flag in header (optional)
                           Sets the compress bit in the RGB data header

  -h, --help               Display this help message

  -v, --version            Display version information

EXAMPLES:
  # Basic conversion with 4:2:0 sampling and quality 10
  image-to-jpeg -i photo.png -o photo.jpg -s 420 -q 10

  # Grayscale conversion
  image-to-jpeg -i image.bmp -o image.jpg -s 400 -q 15

  # High quality conversion with 4:4:4 sampling
  image-to-jpeg -i input.tiff -o output.jpg -s 444 -q 2

  # Conversion with resize to 50%
  image-to-jpeg -i large.png -o small.jpg -s 420 -q 10 -r 50

  # Conversion with compression flag enabled
  image-to-jpeg -i input.png -o output.jpg -s 422 -q 5 -c

REQUIREMENTS:
  - FFmpeg must be installed and available in system PATH
  - Input file must exist and be a valid image format
  - Output directory must be writable

ERROR CODES:
  0 - Success
  1 - Validation error (invalid arguments or input file)
  2 - FFmpeg error (conversion failed)
  3 - I/O error (file read/write failed)
  4 - Header generation error

For more information, see the documentation at:
https://github.com/your-repo/image-to-jpeg-converter
`);
}

/**
 * Displays version information.
 */
function displayVersion(): void {
  console.log('Image to JPEG Converter v1.0.0');
}

/**
 * Parses command-line arguments.
 * 
 * Supports both short (-i) and long (--input) option formats.
 * Returns a CliArgs object with parsed values.
 * 
 * @param args - Command-line arguments (typically process.argv.slice(2))
 * @returns Parsed CLI arguments
 * 
 * @see Requirement 11.1
 */
function parseArgs(args: string[]): CliArgs {
  const parsed: CliArgs = {};

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];

    switch (arg) {
      case '-i':
      case '--input':
        parsed.input = args[++i];
        break;

      case '-o':
      case '--output':
        parsed.output = args[++i];
        break;

      case '-s':
      case '--sampling':
        parsed.sampling = args[++i];
        break;

      case '-q':
      case '--quality':
        parsed.quality = args[++i];
        break;

      case '-r':
      case '--resize':
        parsed.resize = args[++i];
        break;

      case '-c':
      case '--compress':
        parsed.compress = true;
        break;

      case '-h':
      case '--help':
        parsed.help = true;
        break;

      case '-v':
      case '--version':
        parsed.version = true;
        break;

      default:
        console.error(`Unknown option: ${arg}`);
        console.error('Use --help to see available options');
        process.exit(1);
    }
  }

  return parsed;
}

/**
 * Validates CLI arguments.
 * 
 * Checks that all required arguments are provided and that values are valid.
 * Returns an array of error messages (empty if valid).
 * 
 * @param args - Parsed CLI arguments
 * @returns Array of validation error messages (empty if valid)
 * 
 * @see Requirement 11.1
 */
function validateArgs(args: CliArgs): string[] {
  const errors: string[] = [];

  // Check required arguments
  if (!args.input) {
    errors.push('Input file path is required (-i or --input)');
  }

  if (!args.output) {
    errors.push('Output file path is required (-o or --output)');
  }

  if (!args.sampling) {
    errors.push('Sampling factor is required (-s or --sampling)');
  } else {
    // Validate sampling factor
    const sampling = parseInt(args.sampling, 10);
    if (![400, 420, 422, 444].includes(sampling)) {
      errors.push(
        `Invalid sampling factor: ${args.sampling}. Valid values: 400, 420, 422, 444`
      );
    }
  }

  // Validate quality if provided
  if (args.quality !== undefined) {
    const quality = parseInt(args.quality, 10);
    if (isNaN(quality) || quality < 1 || quality > 31) {
      errors.push(
        `Invalid quality value: ${args.quality}. Valid range: 1-31 (lower is higher quality)`
      );
    }
  }

  // Validate resize if provided
  if (args.resize !== undefined) {
    const resize = parseInt(args.resize, 10);
    if (![50, 70, 80].includes(resize)) {
      errors.push(
        `Invalid resize value: ${args.resize}. Valid values: 50, 70, 80`
      );
    }
  }

  return errors;
}

/**
 * Maps CLI sampling factor to SamplingFactor enum.
 * 
 * @param sampling - Sampling factor string from CLI
 * @returns SamplingFactor enum value
 */
function mapSamplingFactor(sampling: string): SamplingFactor {
  const value = parseInt(sampling, 10);
  switch (value) {
    case 400:
      return SamplingFactor.Grayscale;
    case 420:
      return SamplingFactor.YUV420;
    case 422:
      return SamplingFactor.YUV422;
    case 444:
      return SamplingFactor.YUV444;
    default:
      throw new Error(`Invalid sampling factor: ${sampling}`);
  }
}

/**
 * Maps CLI resize value to ResizeOption enum.
 * 
 * @param resize - Resize percentage string from CLI
 * @returns ResizeOption enum value
 */
function mapResizeOption(resize: string): ResizeOption {
  const value = parseInt(resize, 10);
  switch (value) {
    case 50:
      return ResizeOption.Fifty;
    case 70:
      return ResizeOption.Seventy;
    case 80:
      return ResizeOption.Eighty;
    default:
      return ResizeOption.None;
  }
}

/**
 * Displays conversion results.
 * 
 * Shows success message with output file path, JPEG size, and image dimensions.
 * 
 * @param result - Conversion result from convertToJpeg
 * 
 * @see Requirement 11.1
 */
function displayResults(result: import('./types.js').ConversionResult): void {
  console.log('\n✓ Conversion successful!');
  console.log(`  Output file: ${result.outputPath}`);
  console.log(`  JPEG size: ${result.jpegSize} bytes`);
  console.log(
    `  Dimensions: ${result.dimensions.width}x${result.dimensions.height} pixels`
  );
  console.log('');
}

/**
 * Displays conversion errors.
 * 
 * Shows error message with details and appropriate error code.
 * 
 * @param error - Conversion error from convertToJpeg
 * @returns Exit code for process.exit()
 * 
 * @see Requirement 11.1
 */
function displayError(error: ConversionError): number {
  console.error('\n✗ Conversion failed!');
  console.error(`  Error type: ${error.type}`);
  console.error(`  Message: ${error.message}`);

  if (error.details) {
    console.error('  Details:');
    if (error.type === 'ffmpeg' && typeof error.details === 'object') {
      const details = error.details as {
        exitCode?: number;
        stderr?: string;
        stdout?: string;
      };
      if (details.exitCode !== undefined) {
        console.error(`    Exit code: ${details.exitCode}`);
      }
      if (details.stderr) {
        console.error(`    FFmpeg stderr: ${details.stderr.substring(0, 500)}`);
      }
    } else if (error.type === 'validation' && typeof error.details === 'object') {
      const details = error.details as { errors?: Array<{ field: string; message: string }> };
      if (details.errors) {
        details.errors.forEach((err) => {
          console.error(`    ${err.field}: ${err.message}`);
        });
      }
    } else {
      console.error(`    ${JSON.stringify(error.details, null, 2)}`);
    }
  }

  console.error('');

  // Return appropriate exit code
  switch (error.type) {
    case 'validation':
      return 1;
    case 'ffmpeg':
      return 2;
    case 'io':
      return 3;
    case 'header':
      return 4;
    default:
      return 1;
  }
}

/**
 * Main CLI entry point.
 * 
 * Parses arguments, validates inputs, calls the converter, and displays
 * results or errors. Handles all error cases gracefully.
 * 
 * @see Requirement 11.1
 */
async function main(): Promise<void> {
  try {
    // Parse command-line arguments
    const args = parseArgs(process.argv.slice(2));

    // Handle help flag
    if (args.help) {
      displayHelp();
      process.exit(0);
    }

    // Handle version flag
    if (args.version) {
      displayVersion();
      process.exit(0);
    }

    // Validate arguments
    const validationErrors = validateArgs(args);
    if (validationErrors.length > 0) {
      console.error('\n✗ Invalid arguments:');
      validationErrors.forEach((error) => {
        console.error(`  - ${error}`);
      });
      console.error('\nUse --help to see available options\n');
      process.exit(1);
    }

    // Build conversion configuration
    const config: import('./types.js').ConversionConfig = {
      inputPath: args.input!,
      outputPath: args.output!,
      samplingFactor: mapSamplingFactor(args.sampling!),
      ...(args.quality !== undefined && { quality: parseInt(args.quality, 10) }),
      resize: args.resize ? mapResizeOption(args.resize) : ResizeOption.None,
      compress: args.compress || false,
    };

    // Display conversion parameters
    console.log('\nStarting conversion...');
    console.log(`  Input: ${config.inputPath}`);
    console.log(`  Output: ${config.outputPath}`);
    console.log(`  Sampling: ${args.sampling}`);
    if (config.quality !== undefined) {
      console.log(`  Quality: ${config.quality}`);
    }
    if (args.resize) {
      console.log(`  Resize: ${args.resize}%`);
    }
    if (config.compress) {
      console.log(`  Compress: enabled`);
    }

    // Perform conversion
    const result = await convertToJpeg(config);

    // Display results
    displayResults(result);

    process.exit(0);
  } catch (error) {
    // Handle conversion errors
    if (error && typeof error === 'object' && 'type' in error) {
      const exitCode = displayError(error as ConversionError);
      process.exit(exitCode);
    } else {
      // Handle unexpected errors
      console.error('\n✗ Unexpected error:');
      console.error(error instanceof Error ? error.message : String(error));
      console.error('');
      process.exit(1);
    }
  }
}

// Run CLI if this module is executed directly
// Check if this file is being run directly (not imported)
// CLI entry point check - disabled for CommonJS compatibility
const isMainModule = false; // process.argv[1] && import.meta.url.endsWith(process.argv[1].replace(/\\/g, '/'));
if (isMainModule || process.argv[1]?.includes('cli.js')) {
  main();
}

export { main, parseArgs, validateArgs, displayHelp, displayVersion };
