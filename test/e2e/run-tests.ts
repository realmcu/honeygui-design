import * as path from 'path';
import { runTests as runVsCodeTests } from '@vscode/test-electron';

async function main() {
  try {
    // 获取扩展根目录
    const extensionDevelopmentPath = path.resolve(__dirname, '../../');
    
    // 获取编译后的测试入口文件路径
    const extensionTestsPath = path.resolve(__dirname, '../../out/test/e2e/index');
    
    // 创建临时测试工作区
    const testWorkspace = path.resolve(__dirname, '../../test-workspace');
    
    // 下载VSCode并运行测试
    const exitCode = await runVsCodeTests({
      extensionDevelopmentPath,
      extensionTestsPath,
      launchArgs: [
        testWorkspace,
        '--disable-extensions',
        '--disable-gpu',
        '--locale=en'
      ]
    });
    
    // 根据退出码决定是否成功
    if (exitCode !== 0) {
      console.error(`Tests failed with exit code: ${exitCode}`);
      process.exit(exitCode);
    }
    
    console.log('All tests passed successfully!');
  } catch (err) {
    console.error('Failed to run tests:', err);
    process.exit(1);
  }
}

// 运行测试
main();
