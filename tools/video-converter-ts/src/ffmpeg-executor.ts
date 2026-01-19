/**
 * FFmpegExecutor - FFmpeg command execution with progress tracking
 * 
 * This module provides functionality to execute FFmpeg commands with:
 * - Availability checking for ffmpeg and ffprobe
 * - Simple execution without progress tracking
 * - Progress tracking by parsing stderr output
 * - Automatic -y flag addition for file overwriting
 */

import { spawn, execFile, ChildProcess } from 'child_process';
import { promisify } from 'util';
import { ProgressCallback } from './models';
import { FFmpegError, FFmpegNotFoundError } from './errors';

const execFileAsync = promisify(execFile);

/**
 * FFmpeg command executor with progress tracking support
 */
export class FFmpegExecutor {
  private progressCallback?: ProgressCallback;

  /**
   * Create a new FFmpegExecutor
   * @param progressCallback - Optional callback for progress reporting
   */
  constructor(progressCallback?: ProgressCallback) {
    this.progressCallback = progressCallback;
  }

  /**
   * Get the ffmpeg command name based on platform
   */
  private static getFfmpegCmd(): string {
    return process.platform === 'win32' ? 'ffmpeg.exe' : 'ffmpeg';
  }

  /**
   * Get the ffprobe command name based on platform
   */
  private static getFfprobeCmd(): string {
    return process.platform === 'win32' ? 'ffprobe.exe' : 'ffprobe';
  }

  /**
   * Check if ffmpeg is available in the system PATH
   * @returns Promise<boolean> - true if ffmpeg is available
   */
  static async checkFfmpegAvailable(): Promise<boolean> {
    const ffmpegCmd = FFmpegExecutor.getFfmpegCmd();
    try {
      await execFileAsync(ffmpegCmd, ['-version'], { timeout: 10000 });
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Check if ffprobe is available in the system PATH
   * @returns Promise<boolean> - true if ffprobe is available
   */
  static async checkFfprobeAvailable(): Promise<boolean> {
    const ffprobeCmd = FFmpegExecutor.getFfprobeCmd();
    try {
      await execFileAsync(ffprobeCmd, ['-version'], { timeout: 10000 });
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Ensure ffmpeg is available, throw error if not
   * @throws FFmpegNotFoundError if ffmpeg is not available
   */
  private static async ensureFfmpegAvailable(): Promise<void> {
    if (!(await FFmpegExecutor.checkFfmpegAvailable())) {
      throw new FFmpegNotFoundError(
        'ffmpeg is not installed or not in system PATH. ' +
        'Please install ffmpeg and ensure it is accessible in your PATH.'
      );
    }
  }

  /**
   * Execute an FFmpeg command
   * 
   * This method:
   * - Ensures ffmpeg is available
   * - Automatically adds -y flag for file overwriting
   * - Uses progress tracking if callback is provided and totalFrames > 0
   * 
   * @param cmd - Command arguments array (first element should be 'ffmpeg' or 'ffmpeg.exe')
   * @param totalFrames - Total number of frames for progress calculation (optional)
   * @throws FFmpegNotFoundError if ffmpeg is not available
   * @throws FFmpegError if ffmpeg execution fails
   */
  async execute(cmd: string[], totalFrames: number = 0): Promise<void> {
    // Ensure ffmpeg is available
    await FFmpegExecutor.ensureFfmpegAvailable();

    // Make a copy of the command array to avoid modifying the original
    let execCmd = [...cmd];

    // Add -y flag to overwrite output files without prompting
    if ((execCmd[0] === 'ffmpeg' || execCmd[0] === 'ffmpeg.exe') && !execCmd.includes('-y')) {
      execCmd = [execCmd[0], '-y', ...execCmd.slice(1)];
    }

    try {
      if (this.progressCallback && totalFrames > 0) {
        await this.executeWithProgress(execCmd, totalFrames);
      } else {
        await this.executeSimple(execCmd);
      }
    } catch (error) {
      if (error instanceof FFmpegError || error instanceof FFmpegNotFoundError) {
        throw error;
      }
      // Handle FileNotFoundError (ENOENT)
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
        throw new FFmpegNotFoundError(
          'ffmpeg is not installed or not in system PATH. ' +
          'Please install ffmpeg and ensure it is accessible in your PATH.'
        );
      }
      throw error;
    }
  }

  /**
   * Execute command without progress tracking
   * Uses execFile for simple execution with captured output
   * 
   * @param cmd - Command arguments array
   * @throws FFmpegError if command execution fails
   */
  private async executeSimple(cmd: string[]): Promise<void> {
    const command = cmd[0];
    const args = cmd.slice(1);
    
    if (!command) {
      throw new FFmpegError('Empty command provided');
    }
    
    try {
      await execFileAsync(command, args);
    } catch (error: unknown) {
      // execFile throws an error object with stderr when command fails
      const err = error as NodeJS.ErrnoException & { stderr?: string; code?: number | string };
      const stderr = err.stderr || '';
      const exitCode = typeof err.code === 'number' ? err.code : 1;
      throw new FFmpegError(
        `ffmpeg execution failed (exit code: ${exitCode})\n` +
        `Command: ${cmd.join(' ')}\n` +
        `Error output: ${stderr}`
      );
    }
  }

  /**
   * Execute command with progress tracking
   * Uses spawn to read stderr in real-time and parse frame progress
   * 
   * @param cmd - Command arguments array
   * @param totalFrames - Total number of frames for progress calculation
   * @throws FFmpegError if command execution fails
   */
  private executeWithProgress(cmd: string[], totalFrames: number): Promise<void> {
    return new Promise((resolve, reject) => {
      const command = cmd[0];
      const args = cmd.slice(1);
      
      if (!command) {
        reject(new FFmpegError('Empty command provided'));
        return;
      }
      
      const childProcess: ChildProcess = spawn(command, args);

      const stderrChunks: string[] = [];
      let lastFrame = 0;

      // FFmpeg outputs progress information to stderr
      if (childProcess.stderr) {
        childProcess.stderr.on('data', (data: Buffer) => {
          const text = data.toString();
          stderrChunks.push(text);

          // Parse frame progress (format: frame=  123 ...)
          const frameMatch = text.match(/frame=\s*(\d+)/);
          if (frameMatch && frameMatch[1]) {
            const currentFrame = parseInt(frameMatch[1], 10);
            // Ensure progress is monotonically increasing
            if (currentFrame > lastFrame) {
              lastFrame = currentFrame;
              if (this.progressCallback) {
                this.progressCallback(currentFrame, totalFrames);
              }
            }
          }
        });
      }

      // Also capture stdout (though ffmpeg typically doesn't output much there)
      if (childProcess.stdout) {
        childProcess.stdout.on('data', () => {
          // Ignore stdout data
        });
      }

      childProcess.on('error', (error: NodeJS.ErrnoException) => {
        if (error.code === 'ENOENT') {
          reject(new FFmpegNotFoundError(
            'ffmpeg is not installed or not in system PATH. ' +
            'Please install ffmpeg and ensure it is accessible in your PATH.'
          ));
        } else {
          reject(error);
        }
      });

      childProcess.on('close', (code: number | null) => {
        // Final progress callback to ensure we report 100%
        if (this.progressCallback && totalFrames > 0) {
          this.progressCallback(totalFrames, totalFrames);
        }

        if (code !== 0) {
          const stderr = stderrChunks.join('');
          reject(new FFmpegError(
            `ffmpeg execution failed (exit code: ${code})\n` +
            `Command: ${cmd.join(' ')}\n` +
            `Error output: ${stderr}`
          ));
        } else {
          resolve();
        }
      });
    });
  }
}
