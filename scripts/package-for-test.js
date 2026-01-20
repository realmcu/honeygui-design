/**
 * 打包测试版本的脚本
 * 运行完整的 prepublish 流程并打包
 */

const { execSync } = require('child_process');

console.log('开始打包测试版本...\n');

try {
  // 1. 运行 prepublish 脚本（编译 + 构建）
  console.log('运行 prepublish 脚本...');
  execSync('npm run vscode:prepublish', { stdio: 'inherit' });

  // 2. 打包（vsce 会自动处理依赖）
  console.log('\n开始打包...');
  execSync('npx @vscode/vsce package', { stdio: 'inherit' });

  console.log('\n✅ 打包完成！');
} catch (error) {
  console.error('\n❌ 打包失败:', error.message);
  process.exit(1);
}
