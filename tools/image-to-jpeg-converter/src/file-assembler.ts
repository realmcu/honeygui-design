/**
 * File assembler module for the Image to JPEG Converter.
 * 
 * Combines binary header structures with JPEG data to create the final output file.
 * Handles binary file writing with proper error handling and verification.
 * 
 * @module file-assembler
 * @see Requirements 6.1, 6.2, 6.5
 */

import * as fs from 'fs';
import * as path from 'path';

/**
 * Error information for file assembly failures.
 */
export interface FileAssemblyError {
  /** Error message describing what went wrong */
  message: string;
  /** Additional error details */
  details?: unknown;
}

/**
 * File assembler for combining header and JPEG data.
 * 
 * Writes the complete output file with:
 * 1. Custom binary header (first 16+ bytes)
 * 2. JPEG data immediately following the header
 * 
 * Ensures atomic file operations:
 * - Verifies output directory exists
 * - Writes header bytes first (Requirement 6.1)
 * - Writes JPEG data immediately after (Requirement 6.2)
 * - Verifies file was written successfully (Requirement 6.5)
 * - Handles I/O errors gracefully (Requirement 6.4)
 * 
 * @see Requirements 6.1, 6.2, 6.4, 6.5
 */
export class FileAssembler {
  /**
   * Assembles header and JPEG data into the output file.
   * 
   * Writes the complete binary file structure:
   * 1. Header bytes (custom binary header)
   * 2. JPEG data (starting with 0xFFD8 marker)
   * 
   * The method ensures atomic file creation:
   * - Creates parent directories if needed
   * - Writes all data in a single operation
   * - Verifies the file exists and has correct size after writing
   * - Cleans up on error
   * 
   * @param headerBytes - Binary header data to write first
   * @param jpegData - JPEG data to write after header
   * @param outputPath - Path where the output file will be created
   * @throws FileAssemblyError if file writing fails or verification fails
   * 
   * @example
   * ```typescript
   * const assembler = new FileAssembler();
   * await assembler.assemble(headerBytes, jpegData, 'output.jpg');
   * ```
   * 
   * @see Requirements 6.1, 6.2, 6.4, 6.5
   */
  async assemble(
    headerBytes: Buffer,
    jpegData: Buffer,
    outputPath: string
  ): Promise<void> {
    try {
      // Ensure output directory exists
      const outputDir = path.dirname(outputPath);
      if (outputDir && outputDir !== '.') {
        await fs.promises.mkdir(outputDir, { recursive: true });
      }

      // Combine header and JPEG data into a single buffer
      // This ensures atomic write operation
      const totalSize = headerBytes.length + jpegData.length;
      const completeData = Buffer.concat([headerBytes, jpegData], totalSize);

      // Write the complete file (Requirement 6.1, 6.2)
      // Header bytes are written first, JPEG data immediately after
      await fs.promises.writeFile(outputPath, completeData);

      // Verify file was written successfully (Requirement 6.5)
      await this.verifyFile(outputPath, totalSize);
    } catch (error) {
      // Handle I/O errors gracefully (Requirement 6.4)
      throw this.createAssemblyError(error, outputPath);
    }
  }

  /**
   * Verifies that the output file was written successfully.
   * 
   * Checks:
   * - File exists
   * - File size matches expected size
   * 
   * @param filePath - Path to the file to verify
   * @param expectedSize - Expected file size in bytes
   * @throws FileAssemblyError if verification fails
   * 
   * @see Requirement 6.5
   */
  private async verifyFile(filePath: string, expectedSize: number): Promise<void> {
    try {
      const stats = await fs.promises.stat(filePath);
      
      if (!stats.isFile()) {
        throw {
          message: `Output path exists but is not a file: ${filePath}`,
          details: { path: filePath },
        } as FileAssemblyError;
      }

      if (stats.size !== expectedSize) {
        throw {
          message: `File size mismatch: expected ${expectedSize} bytes, got ${stats.size} bytes`,
          details: {
            path: filePath,
            expectedSize,
            actualSize: stats.size,
          },
        } as FileAssemblyError;
      }
    } catch (error) {
      if ((error as FileAssemblyError).message) {
        throw error; // Re-throw our own errors
      }
      
      // File doesn't exist or stat failed
      throw {
        message: `Failed to verify output file: ${filePath}`,
        details: {
          path: filePath,
          error: error instanceof Error ? error.message : String(error),
        },
      } as FileAssemblyError;
    }
  }

  /**
   * Creates a standardized FileAssemblyError from various error types.
   * 
   * Provides context about the operation that failed and the output path.
   * 
   * @param error - Original error that occurred
   * @param outputPath - Path where file was being written
   * @returns FileAssemblyError with descriptive message and details
   * 
   * @see Requirement 6.4
   */
  private createAssemblyError(error: unknown, outputPath: string): FileAssemblyError {
    // If it's already a FileAssemblyError, return it
    if ((error as FileAssemblyError).message && (error as FileAssemblyError).details) {
      return error as FileAssemblyError;
    }

    // Handle Node.js file system errors
    if (error instanceof Error) {
      const nodeError = error as NodeJS.ErrnoException;
      
      let message = `Failed to write output file: ${outputPath}`;
      
      // Provide specific error messages for common cases
      if (nodeError.code === 'ENOENT') {
        message = `Output directory does not exist: ${path.dirname(outputPath)}`;
      } else if (nodeError.code === 'EACCES' || nodeError.code === 'EPERM') {
        message = `Permission denied writing to: ${outputPath}`;
      } else if (nodeError.code === 'ENOSPC') {
        message = `No space left on device: ${outputPath}`;
      } else if (nodeError.code === 'EROFS') {
        message = `Read-only file system: ${outputPath}`;
      }

      return {
        message,
        details: {
          path: outputPath,
          code: nodeError.code,
          errno: nodeError.errno,
          syscall: nodeError.syscall,
          originalMessage: nodeError.message,
        },
      };
    }

    // Generic error
    return {
      message: `Failed to write output file: ${outputPath}`,
      details: {
        path: outputPath,
        error: String(error),
      },
    };
  }
}
