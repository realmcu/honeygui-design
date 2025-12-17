/**
 * 模板端到端测试
 * 流程：读取模板 HML → 解析 → 生成 C 代码 → 编译 → 运行仿真
 */
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { spawn } from 'child_process';
import { HmlParser } from '../../src/hml/HmlParser';
import { HoneyGuiCCodeGenerator } from '../../src/codegen/honeygui/HoneyGuiCCodeGenerator';
import { EntryFileGenerator } from '../../src/codegen/EntryFileGenerator';
import { BuildCore, Logger } from '../../src/simulation/BuildCore';
import { ProjectConfig } from '../../src/common/ProjectConfig';

// 配置
const SDK_PATH = path.join(os.homedir(), '.HoneyGUI-SDK');
// __dirname 在编译后是 out/test/templates，需要回退到项目根目录
const PROJECT_ROOT = path.join(__dirname, '..', '..', '..');
const TEMPLATE_DIR = path.join(PROJECT_ROOT, 'template-projects');
const TMP_DIR = path.join(process.cwd(), '.tmp', 'template-tests');

// 日志
class TestLogger implements Logger {
  log(message: string, isError?: boolean) {
    if (isError) {
      console.error(`    [ERROR] ${message}`);
    } else {
      console.log(`    [INFO] ${message}`);
    }
  }
}

// 测试单个模板
async function testTemplate(templateName: string): Promise<{ passed: boolean; error?: string }> {
  console.log(`\n[测试] ${templateName}`);
  
  const templatePath = path.join(TEMPLATE_DIR, templateName);
  const projectDir = path.join(TMP_DIR, templateName);
  
  try {
    // 1. 找到 HML 文件
    console.log('  [1/5] 查找 HML 文件...');
    const hmlFile = findHmlFile(templatePath);
    console.log(`    找到: ${path.basename(hmlFile)}`);
    
    // 2. 解析 HML
    console.log('  [2/5] 解析 HML...');
    const parser = new HmlParser();
    const hmlContent = fs.readFileSync(hmlFile, 'utf8');
    const doc = parser.parse(hmlContent);
    const components = doc.view.components || [];
    console.log(`    组件数量: ${components.length}`);
    
    // 3. 准备项目目录
    console.log('  [3/5] 生成 C 代码...');
    fs.rmSync(projectDir, { recursive: true, force: true });
    fs.mkdirSync(projectDir, { recursive: true });
    
    // 复制资源
    const assetsDir = path.join(templatePath, 'assets');
    if (fs.existsSync(assetsDir)) {
      copyDir(assetsDir, path.join(projectDir, 'assets'));
    }
    
    // 生成 C 代码
    const projectName = doc.meta.project?.name || templateName;
    const srcDir = path.join(projectDir, 'src');
    
    const generator = new HoneyGuiCCodeGenerator(components, {
      designName: projectName,
      srcDir: srcDir
    });
    await generator.generate();
    
    // 生成入口文件
    EntryFileGenerator.generate(srcDir, projectName);
    
    // 生成 project.json
    const resolution = doc.meta.project?.resolution || '480X480';
    const [width, height] = resolution.split('X').map(Number);
    fs.writeFileSync(path.join(projectDir, 'project.json'), JSON.stringify({
      name: projectName,
      resolution: resolution,
      screenWidth: width,
      screenHeight: height,
      honeyguiSdkPath: SDK_PATH
    }, null, 2));
    
    console.log(`    生成完成`);
    
    // 4. 编译
    console.log('  [4/5] 编译...');
    const projectConfig: ProjectConfig = {
      name: projectName,
      resolution: resolution,
      honeyguiSdkPath: SDK_PATH
    };
    const buildCore = new BuildCore(projectDir, SDK_PATH, projectConfig, new TestLogger());
    await buildCore.setupBuildDir();
    await buildCore.copyGeneratedCode();
    await buildCore.convertAssets();
    await buildCore.compile();
    console.log('    编译成功');
    
    // 5. 运行仿真
    console.log('  [5/5] 运行仿真 (2秒)...');
    await runSimulation(projectDir, 2000);
    console.log('    运行成功');
    
    console.log(`  ✓ ${templateName} 通过`);
    return { passed: true };
    
  } catch (e: any) {
    console.error(`  ✗ ${templateName} 失败: ${e.message}`);
    return { passed: false, error: e.message };
  }
}

// 查找 HML 文件
function findHmlFile(templatePath: string): string {
  const uiMainDir = path.join(templatePath, 'ui', 'main');
  const files = fs.readdirSync(uiMainDir);
  const hmlFile = files.find(f => f.endsWith('.hml') && !f.includes('.template.'));
  if (!hmlFile) throw new Error('找不到 HML 文件');
  return path.join(uiMainDir, hmlFile);
}

// 复制目录
function copyDir(src: string, dest: string) {
  fs.mkdirSync(dest, { recursive: true });
  for (const entry of fs.readdirSync(src, { withFileTypes: true })) {
    const srcPath = path.join(src, entry.name);
    const destPath = path.join(dest, entry.name);
    if (entry.isDirectory()) {
      copyDir(srcPath, destPath);
    } else {
      fs.copyFileSync(srcPath, destPath);
    }
  }
}

// 运行仿真
async function runSimulation(projectDir: string, duration: number): Promise<void> {
  const buildDir = path.join(projectDir, 'build');
  const exeName = process.platform === 'win32' ? 'gui.exe' : 'gui';
  const exePath = path.join(buildDir, exeName);
  
  if (!fs.existsSync(exePath)) {
    throw new Error('可执行文件不存在');
  }
  
  return new Promise((resolve, reject) => {
    const proc = spawn(exePath, [], { cwd: buildDir, stdio: 'ignore' });
    
    const timer = setTimeout(() => {
      proc.kill();
      resolve();
    }, duration);
    
    proc.on('error', (err) => {
      clearTimeout(timer);
      reject(err);
    });
    
    proc.on('exit', (code) => {
      clearTimeout(timer);
      if (code !== null && code !== 0) {
        reject(new Error(`退出码: ${code}`));
      } else {
        resolve();
      }
    });
  });
}

// 主函数
async function main() {
  console.log('========================================');
  console.log('HoneyGUI 模板端到端测试');
  console.log('========================================');
  console.log(`SDK: ${SDK_PATH}`);
  console.log(`模板目录: ${TEMPLATE_DIR}`);
  
  // 检查 SDK
  if (!fs.existsSync(SDK_PATH)) {
    console.error(`\n错误: SDK 不存在`);
    process.exitCode = 1;
    return;
  }
  
  // 测试所有模板
  const templates = ['rotary', 'settings', 'smartwatch', 'dashboard', 'chatbot'];
  
  const results: Array<{ name: string; passed: boolean; error?: string }> = [];
  
  for (const t of templates) {
    const r = await testTemplate(t);
    results.push({ name: t, ...r });
  }
  
  // 总结
  console.log('\n========================================');
  console.log('测试结果');
  console.log('========================================');
  
  for (const r of results) {
    const status = r.passed ? '✓ PASS' : '✗ FAIL';
    console.log(`${status} ${r.name}${r.error ? ` - ${r.error}` : ''}`);
  }
  
  const failed = results.filter(r => !r.passed).length;
  console.log(`\n总计: ${results.length} | 通过: ${results.length - failed} | 失败: ${failed}`);
  
  process.exitCode = failed > 0 ? 1 : 0;
}

main();
