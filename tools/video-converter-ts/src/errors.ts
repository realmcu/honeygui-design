/**
 * Custom error classes for the video converter
 * 
 * Error hierarchy:
 * VideoConverterError (base class)
 * ├── VideoFormatError      - 不支持的视频格式或文件损坏
 * ├── FFmpegNotFoundError   - FFmpeg/FFprobe 未安装
 * ├── FFmpegError           - FFmpeg 执行失败
 * └── PostProcessError      - 后处理脚本执行失败
 */

/**
 * 视频转换器基础异常
 * Base error class for all video converter errors
 */
export class VideoConverterError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'VideoConverterError';
    // Maintains proper stack trace for where our error was thrown (only available on V8)
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, VideoConverterError);
    }
  }
}

/**
 * 不支持的视频格式
 * Thrown when the video format is unsupported or the file is corrupted
 */
export class VideoFormatError extends VideoConverterError {
  constructor(message: string) {
    super(message);
    this.name = 'VideoFormatError';
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, VideoFormatError);
    }
  }
}

/**
 * FFmpeg 未安装或不在 PATH 中
 * Thrown when FFmpeg or FFprobe is not installed or not in PATH
 */
export class FFmpegNotFoundError extends VideoConverterError {
  constructor(message: string) {
    super(message);
    this.name = 'FFmpegNotFoundError';
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, FFmpegNotFoundError);
    }
  }
}

/**
 * FFmpeg 执行错误
 * Thrown when FFmpeg command execution fails
 */
export class FFmpegError extends VideoConverterError {
  constructor(message: string) {
    super(message);
    this.name = 'FFmpegError';
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, FFmpegError);
    }
  }
}

/**
 * 后处理脚本执行错误
 * Thrown when post-processing script execution fails
 */
export class PostProcessError extends VideoConverterError {
  constructor(message: string) {
    super(message);
    this.name = 'PostProcessError';
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, PostProcessError);
    }
  }
}
