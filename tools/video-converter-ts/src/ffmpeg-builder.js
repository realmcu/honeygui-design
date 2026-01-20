"use strict";
/**
 * FFmpegBuilder - FFmpeg command construction
 *
 * Builds FFmpeg commands for different output formats:
 * - MJPEG frames extraction
 * - AVI-MJPEG conversion
 * - H264 conversion
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.FFmpegBuilder = void 0;
var path = require("path");
var FFmpegBuilder = /** @class */ (function () {
    function FFmpegBuilder() {
    }
    /**
     * Build MJPEG frames extraction command
     *
     * Command format:
     * ffmpeg -i input.mp4 -r 24 -vf "format=yuvj420p" -q:v 5 output/frame_%04d.jpg
     *
     * @param inputPath - Input video file path
     * @param outputDir - Output directory path
     * @param frameRate - Target frame rate, undefined to keep original
     * @param quality - JPEG quality (1-31, 1 is highest), defaults to 5
     * @returns FFmpeg command arguments array
     */
    FFmpegBuilder.prototype.buildMjpegFramesCmd = function (inputPath, outputDir, frameRate, quality) {
        if (quality === void 0) { quality = 5; }
        var cmd = ['ffmpeg', '-i', inputPath];
        // Add frame rate parameter if specified
        if (frameRate !== undefined) {
            cmd.push('-r', String(frameRate));
        }
        // Add video filter and quality parameters
        cmd.push('-vf', 'format=yuvj420p');
        // Quality parameter: 1 highest quality, 31 lowest quality
        cmd.push('-q:v', String(quality));
        // Output path pattern using path.join for cross-platform compatibility
        var outputPattern = path.join(outputDir, 'frame_%04d.jpg');
        cmd.push(outputPattern);
        return cmd;
    };
    /**
     * Build AVI-MJPEG conversion command
     *
     * Command format:
     * ffmpeg -i input.mp4 -an -r 25 -vcodec mjpeg -pix_fmt yuvj420p -q:v 5 output.avi
     *
     * @param inputPath - Input video file path
     * @param outputPath - Output file path
     * @param frameRate - Target frame rate, undefined to keep original
     * @param quality - JPEG quality (1-31, 1 is highest), defaults to 5
     * @returns FFmpeg command arguments array
     */
    FFmpegBuilder.prototype.buildAviCmd = function (inputPath, outputPath, frameRate, quality) {
        if (quality === void 0) { quality = 5; }
        var cmd = ['ffmpeg', '-i', inputPath];
        // No audio
        cmd.push('-an');
        // Add frame rate parameter if specified
        if (frameRate !== undefined) {
            cmd.push('-r', String(frameRate));
        }
        // Video codec and pixel format
        cmd.push('-vcodec', 'mjpeg');
        cmd.push('-pix_fmt', 'yuvj420p');
        // Quality parameter
        cmd.push('-q:v', String(quality));
        // Output path
        cmd.push(outputPath);
        return cmd;
    };
    /**
     * Build H264 conversion command
     *
     * Command format:
     * ffmpeg -r 30 -i input.mp4 -c:v libx264 -x264-params "..." -an -f rawvideo output.h264
     *
     * @param inputPath - Input video file path
     * @param outputPath - Output file path
     * @param frameRate - Input frame rate, undefined to keep original
     * @param crf - CRF value for quality control, defaults to 23
     * @returns FFmpeg command arguments array
     */
    FFmpegBuilder.prototype.buildH264Cmd = function (inputPath, outputPath, frameRate, crf) {
        if (crf === void 0) { crf = 23; }
        var cmd = ['ffmpeg'];
        // Add frame rate parameter if specified - for H264, frame rate comes before input
        if (frameRate !== undefined) {
            cmd.push('-r', String(frameRate));
        }
        // Input file
        cmd.push('-i', inputPath);
        // H264 encoder
        cmd.push('-c:v', 'libx264');
        // x264 parameters (with CRF value substituted)
        var x264Params = FFmpegBuilder.H264_X264_PARAMS.replace('{crf}', String(crf));
        cmd.push('-x264-params', x264Params);
        // No audio
        cmd.push('-an');
        // Output format as raw video
        cmd.push('-f', 'rawvideo');
        // Output path
        cmd.push(outputPath);
        return cmd;
    };
    /**
     * H264 encoding parameters (same as Python version)
     * Contains x264 encoder settings with {crf} placeholder for quality control
     */
    FFmpegBuilder.H264_X264_PARAMS = 'cabac=0:ref=3:deblock=1:0:0:analyse=0x1:0x111:me=hex:subme=7:' +
        'psy=1:psy_rd=1.0:0.0:mixed_ref=1:me_range=16:chroma_me=1:' +
        'trellis=1:8x8dct=0:deadzone-inter=21:deadzone-intra=11:' +
        'fast_pskip=1:chroma_qp_offset=-2:threads=11:lookahead_threads=1:' +
        'sliced_threads=0:nr=0:decimate=1:interlaced=0:bluray_compat=0:' +
        'constrained_intra=0:bframes=0:weightp=0:keyint=40:min-keyint=4:' +
        'scenecut=40:intra_refresh=0:rc_lookahead=40:mbtree=1:' +
        'crf={crf}:qcomp=0.60:qpmin=0:qpmax=69:qpstep=4:ipratio=1.40:' +
        'aq-mode=1:aq-strength=1.00';
    return FFmpegBuilder;
}());
exports.FFmpegBuilder = FFmpegBuilder;
