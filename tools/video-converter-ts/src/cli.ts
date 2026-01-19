#!/usr/bin/env node
/**
 * CLI - Command line interface for the video converter
 * 
 * Usage:
 *   npx video-converter -i input.mp4 -o output.mjpeg -f mjpeg
 *   npx video-converter -i input.mp4 -o output.avi -f avi_mjpeg -r 25 -q 1
 *   npx video-converter -i input.mp4 -o output.h264 -f h264 -r 30 -q 23
 *   npx video-converter -i input.mp4 --info
 */

import { Command } from 'commander';
import { VideoConverter } from './converter';
import { VideoInfo, ConversionResult, OutputFormat } from './models';
import { VideoConverterError } from './errors';

/**
 * CLI arguments interface
 */
interface CliArgs {
  input: string;
  output?: string;
  format?: 'mjpeg' | 'avi_mjpeg' | 'h264';
  framerate?: number;
  quality?: number;
  info?: boolean;
  verbose?: boolean;
  debug?: boolean;
}

/**
 * Print video information
 */
function printVideoInfo(info: VideoInfo): void {
  console.log(`\n视频信息: ${info.filePath}`);
  console.log('-'.repeat(40));
  console.log(`  分辨率: ${info.width} x ${info.height}`);
  console.log(`  帧率: ${info.frameRate.toFixed(2)} fps`);
  console.log(`  帧数: ${info.frameCount}`);
  console.log(`  时长: ${info.duration.toFixed(2)} 秒`);
  console.log(`  编码: ${info.codec}`);
  console.log();
}

/**
 * Print progress bar
 */
function printProgress(current: number, total: number): void {
  const percent = total > 0 ? (current / total) * 100 : 0;
  const barLength = 40;
  const filled = total > 0 ? Math.floor(barLength * current / total) : 0;
  const bar = '='.repeat(filled) + '-'.repeat(barLength - filled);
  process.stdout.write(`\r进度: [${bar}] ${percent.toFixed(1)}% (${current}/${total})`);
}

/**
 * Print conversion result
 */
function printResult(result: ConversionResult): void {
  console.log('\n\n转换完成!');
  console.log('-'.repeat(40));
  console.log(`  输入文件: ${result.inputPath}`);
  console.log(`  输出文件: ${result.outputPath}`);
  console.log(`  输出格式: ${result.outputFormat}`);
  console.log(`  帧数: ${result.frameCount}`);
  console.log(`  帧率: ${result.frameRate.toFixed(2)} fps`);
  console.log(`  质量: ${result.quality}`);
  console.log();
}

/**
 * Parse command line arguments
 */
function parseArgs(args?: string[]): CliArgs {
  const program = new Command();
  
  program
    .name('video-converter')
    .description('视频转换工具 - 将视频转换为 MJPEG、AVI-MJPEG 或 H264 格式')
    .requiredOption('-i, --input <path>', '输入视频文件路径')
    .option('-o, --output <path>', '输出文件路径（使用 --info 时可省略）')
    .option('-f, --format <format>', '输出格式: mjpeg, avi_mjpeg, h264')
    .option('-r, --framerate <fps>', '目标帧率（默认保持原帧率）', parseFloat)
    .option('-q, --quality <value>', '编码质量: MJPEG/AVI 为 1-31（1最高质量），H264 为 CRF 值 0-51', parseInt)
    .option('--info', '仅显示输入视频信息，不进行转换')
    .option('-v, --verbose', '显示详细输出')
    .option('-d, --debug', '调试模式：保留中间文件用于检查');
  
  program.parse(args);
  
  const opts = program.opts();
  
  return {
    input: opts.input,
    output: opts.output,
    format: opts.format,
    framerate: opts.framerate,
    quality: opts.quality,
    info: opts.info,
    verbose: opts.verbose,
    debug: opts.debug
  };
}


/**
 * Main CLI function
 */
export async function main(args?: string[]): Promise<number> {
  let parsedArgs: CliArgs;
  
  try {
    parsedArgs = parseArgs(args);
  } catch (error) {
    console.error(`参数解析错误: ${error}`);
    return 1;
  }
  
  // Validate arguments
  if (!parsedArgs.info) {
    if (!parsedArgs.output) {
      console.error('错误: 需要指定输出文件路径 (-o/--output)');
      return 1;
    }
    if (!parsedArgs.format) {
      console.error('错误: 需要指定输出格式 (-f/--format)');
      return 1;
    }
    if (!['mjpeg', 'avi_mjpeg', 'h264'].includes(parsedArgs.format)) {
      console.error(`错误: 无效的输出格式: ${parsedArgs.format}`);
      return 1;
    }
  }
  
  // Create converter
  const progressCallback = parsedArgs.verbose ? printProgress : undefined;
  const converter = new VideoConverter(progressCallback);
  
  try {
    // Info only mode
    if (parsedArgs.info) {
      const info = await converter.getVideoInfo(parsedArgs.input);
      printVideoInfo(info);
      return 0;
    }
    
    // Map format string to enum
    const formatMap: Record<string, OutputFormat> = {
      'mjpeg': OutputFormat.MJPEG,
      'avi_mjpeg': OutputFormat.AVI_MJPEG,
      'h264': OutputFormat.H264
    };
    const outputFormat = formatMap[parsedArgs.format!] as OutputFormat;
    
    // Show start info
    if (parsedArgs.verbose) {
      const info = await converter.getVideoInfo(parsedArgs.input);
      printVideoInfo(info);
      console.log('开始转换...');
      console.log(`  输出格式: ${outputFormat}`);
      console.log(`  目标帧率: ${parsedArgs.framerate ?? '保持原帧率'}`);
      console.log(`  质量: ${parsedArgs.quality ?? '默认'}`);
      if (parsedArgs.debug) {
        console.log(`  调试模式: 已启用（中间文件将被保留）`);
      }
      console.log();
    }
    
    // Execute conversion
    const result = await converter.convert(
      parsedArgs.input,
      parsedArgs.output!,
      outputFormat,
      {
        frameRate: parsedArgs.framerate,
        quality: parsedArgs.quality,
        debug: parsedArgs.debug
      }
    );
    
    // Show result
    printResult(result);
    return 0;
    
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
      console.error(`错误: 文件不存在: ${parsedArgs.input}`);
    } else if (error instanceof VideoConverterError) {
      console.error(`转换错误: ${error.message}`);
    } else {
      console.error(`未知错误: ${error}`);
    }
    return 1;
  }
}

// Run CLI if this is the main module
if (require.main === module) {
  main().then(code => process.exit(code));
}
