// 快速测试三种视频格式转换
// 使用方法: npm run test:video-formats:quick

const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');

console.log('🎬 快速测试三种视频格式转换\n');

// 检查 assets_test 目录
const testDir = path.join(__dirname, 'assets_test');
if (!fs.existsSync(testDir)) {
    console.log('❌ assets_test 目录不存在');
    console.log('📝 请创建 assets_test 目录并放入测试视频文件\n');
    console.log('示例:');
    console.log('  mkdir assets_test');
    console.log('  # 将测试视频复制到 assets_test 目录');
    process.exit(1);
}

// 查找视频文件
const videoFiles = fs.readdirSync(testDir).filter(file => {
    const ext = path.extname(file).toLowerCase();
    return ['.mp4', '.avi', '.mov', '.mkv'].includes(ext);
});

if (videoFiles.length === 0) {
    console.log('❌ 未找到测试视频文件');
    console.log('📝 请在 assets_test 目录中放入视频文件（.mp4, .avi, .mov, .mkv）');
    process.exit(1);
}

console.log(`✓ 找到 ${videoFiles.length} 个测试视频:`);
videoFiles.forEach(file => console.log(`  - ${file}`));
console.log('');

// 创建输出目录
const outputDir = path.join(__dirname, 'assets_test_output');
if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
    console.log(`✓ 创建输出目录: assets_test_output\n`);
}

// 检查 FFmpeg
console.log('🔍 检查 FFmpeg...');
const ffmpegCheck = spawn('ffmpeg', ['-version'], { shell: true, stdio: 'ignore' });

ffmpegCheck.on('close', (code) => {
    if (code === 0) {
        console.log('✓ FFmpeg 可用\n');
        console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
        console.log('📋 测试说明:');
        console.log('  1. MJPEG 格式 - 高质量，文件较大');
        console.log('  2. AVI 格式 - 兼容性好，MJPEG 编码');
        console.log('  3. H.264 格式 - 压缩率高，文件较小\n');
        console.log('🚀 运行完整测试:');
        console.log('  npm run test:video-formats\n');
        console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
        console.log('✅ 环境检查完成，可以开始测试！');
    } else {
        console.log('❌ FFmpeg 未找到');
        console.log('📝 请安装 FFmpeg 并添加到系统 PATH');
        console.log('\nWindows:');
        console.log('  1. 下载 FFmpeg: https://ffmpeg.org/download.html');
        console.log('  2. 解压到目录（如 C:\\ffmpeg）');
        console.log('  3. 添加到 PATH: C:\\ffmpeg\\bin');
        console.log('\nLinux:');
        console.log('  sudo apt install ffmpeg');
        console.log('\nmacOS:');
        console.log('  brew install ffmpeg');
    }
});

ffmpegCheck.on('error', () => {
    console.log('❌ FFmpeg 未找到');
    console.log('📝 请安装 FFmpeg 并添加到系统 PATH');
});