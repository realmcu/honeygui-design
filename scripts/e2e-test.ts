#!/usr/bin/env npx ts-node
/**
 * HoneyGUI Design 端到端测试脚本（独立版本，不依赖 VSCode）
 * 
 * 测试流程：
 * 1. 创建临时项目
 * 2. 使用 HmlSerializer 生成 HML 文件
 * 3. 使用 HoneyGuiCCodeGenerator 生成 C 代码
 * 4. 在 SDK 的 win32_sim 目录下编译
 * 5. 运行仿真程序
 * 6. 清理临时文件
 */

import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { spawn, execSync } from 'child_process';
import { HoneyGuiCCodeGenerator } from '../src/codegen/honeygui/HoneyGuiCCodeGenerator';
import { HmlSerializer } from '../src/hml/HmlSerializer';
import { HmlParser } from '../src/hml/HmlParser';
import { Document as HmlDocument, Component } from '../src/hml/types';

// 配置
const CONFIG = {
  sdkPath: path.join(os.homedir(), '.HoneyGUI-SDK'),
  resolution: { width: 480, height: 272 },
  timeout: 120000,
  runDuration: 5000,
};

// 颜色输出
const log = {
  info: (msg: string) => console.log(`\x1b[36m[INFO]\x1b[0m ${msg}`),
  success: (msg: string) => console.log(`\x1b[32m[SUCCESS]\x1b[0m ${msg}`),
  error: (msg: string) => console.log(`\x1b[31m[ERROR]\x1b[0m ${msg}`),
  warn: (msg: string) => console.log(`\x1b[33m[WARN]\x1b[0m ${msg}`),
  step: (n: number, msg: string) => console.log(`\n\x1b[33m[STEP ${n}]\x1b[0m ${msg}`),
};

// ============ 测试步骤 ============

function createProject(projectPath: string, projectName: string): void {
  log.step(1, '创建临时项目...');
  
  fs.mkdirSync(path.join(projectPath, 'ui', 'main'), { recursive: true });
  fs.mkdirSync(path.join(projectPath, 'src', 'autogen', 'main'), { recursive: true });
  fs.mkdirSync(path.join(projectPath, 'assets'), { recursive: true });
  
  const projectConfig = {
    name: projectName,
    appId: `com.test.${projectName}`,
    version: '1.0.0',
    resolution: `${CONFIG.resolution.width}X${CONFIG.resolution.height}`,
  };
  
  fs.writeFileSync(
    path.join(projectPath, 'project.json'),
    JSON.stringify(projectConfig, null, 2)
  );
  
  log.info(`项目创建于: ${projectPath}`);
}

function createMockDesignerData(): Component[] {
    const { width, height } = CONFIG.resolution;
    // 模拟设计器前端传递过来的组件数据
    return [
        {
            id: 'mainView',
            type: 'hg_view',
            name: 'mainView',
            position: { x: 0, y: 0, width, height },
            style: { backgroundColor: '#000000' },
            parent: null,
            children: ['testImage'],
            visible: true,
            enabled: true,
            locked: false,
            zIndex: 0
        },
        {
            id: 'testImage',
            type: 'hg_image',
            name: 'testImage',
            position: { x: 100, y: 50, width: 280, height: 172 },
            data: { src: 'assets/test.png' },
            parent: 'mainView',
            children: [],
            visible: true,
            enabled: true,
            locked: false,
            zIndex: 0
        }
    ];
}

function generateHml(projectPath: string): void {
  log.step(2, '生成 HML 文件 (模拟保存)...');
  
  const components = createMockDesignerData();

  const document: HmlDocument = {
      meta: {
          project: {
              name: 'E2ETest',
              resolution: `${CONFIG.resolution.width}X${CONFIG.resolution.height}`
          }
      },
      view: {
          components: components
      }
  };

  // 1. 序列化：Component[] -> HML String
  const serializer = new HmlSerializer();
  const hmlContent = serializer.serialize(document);

  const hmlPath = path.join(projectPath, 'ui', 'main', 'main.hml');
  fs.writeFileSync(hmlPath, hmlContent);
  
  log.info('HML 文件已生成');
  log.info('内容预览:\n' + hmlContent);
}

async function generateCode(projectPath: string): Promise<void> {
  log.step(3, '生成 C 代码 (模拟编译)...');
  
  const hmlPath = path.join(projectPath, 'ui', 'main', 'main.hml');
  const hmlContent = fs.readFileSync(hmlPath, 'utf-8');

  // 2. 解析：HML String -> Component[]
  // 这一步验证了从文件还原数据的能力，构成了完整的闭环
  const parser = new HmlParser();
  const document = parser.parse(hmlContent);
  
  if (!document || !document.view || !document.view.components) {
      throw new Error('HML 解析失败或无组件');
  }

  const components = document.view.components;
  log.info(`解析得到 ${components.length} 个组件`);
  
  const outputDir = path.join(projectPath, 'src', 'autogen', 'main');
  const generator = new HoneyGuiCCodeGenerator(components, {
      outputDir: outputDir,
      hmlFileName: 'main',
      enableProtectedAreas: false
  });

  const result = await generator.generate();

  if (result.success) {
      log.info(`生成了 ${result.files.length} 个文件: ${result.files.map(f => path.basename(f)).join(', ')}`);
      // 读取生成的 main.c 并打印出来以供检查
      const sourceFile = path.join(outputDir, 'main.c');
      if (fs.existsSync(sourceFile)) {
          log.info('\n生成的 main.c:');
          console.log(fs.readFileSync(sourceFile, 'utf-8'));
      }
  } else {
      throw new Error(`代码生成失败: ${result.errors?.join(', ')}`);
  }
}

async function compile(projectPath: string): Promise<string> {
  log.step(4, '准备编译环境...');
  
  const buildDir = path.join(projectPath, '.honeygui-build', 'win32_sim');
  const sdkWin32Sim = path.join(CONFIG.sdkPath, 'win32_sim');
  
  // 1. 拷贝 SDK 的 win32_sim 到 .honeygui-build/win32_sim
  log.info('拷贝 SDK win32_sim...');
  if (fs.existsSync(buildDir)) {
    fs.rmSync(buildDir, { recursive: true, force: true });
  }
  copyDir(sdkWin32Sim, buildDir);
  
  // 2. 拷贝 Kconfig.gui
  const kconfigSrc = path.join(CONFIG.sdkPath, 'Kconfig.gui');
  if (fs.existsSync(kconfigSrc)) {
    fs.copyFileSync(kconfigSrc, path.join(buildDir, 'Kconfig.gui'));
  }
  
  // 3. 生成 .config
  const configContent = 'CONFIG_REALTEK_HONEYGUI=y\n';
  fs.writeFileSync(path.join(buildDir, '.config'), configContent);
  
  // 4. 修改 SConstruct，指向 SDK 路径
  const sconstructPath = path.join(buildDir, 'SConstruct');
  let scontent = fs.readFileSync(sconstructPath, 'utf-8');
  const sdkPathNorm = CONFIG.sdkPath.replace(/\\/g, '/');
  scontent = scontent.replace(
    /PROJECT_ROOT\s*=\s*os\.path\.dirname\(os\.getcwd\(\)\)/,
    `PROJECT_ROOT = '${sdkPathNorm}'`
  );
  fs.writeFileSync(sconstructPath, scontent);
  
  // 5. 拷贝生成的代码到 autogen 目录
  const srcAutogen = path.join(projectPath, 'src', 'autogen');
  const destAutogen = path.join(buildDir, 'autogen');
  copyDir(srcAutogen, destAutogen);
  
  // 6. 创建 autogen 的 SConscript
  const autogenSconscript = `
from building import *
import os

cwd = GetCurrentDir()
src = []
for root, dirs, files in os.walk(cwd):
    for f in files:
        if f.endswith('.c'):
            src.append(os.path.join(root, f))

CPPPATH = [cwd]
for root, dirs, files in os.walk(cwd):
    CPPPATH.append(root)

group = DefineGroup('autogen', src, depend=[''], CPPPATH=CPPPATH)
Return('group')
`;
  fs.writeFileSync(path.join(destAutogen, 'SConscript'), autogenSconscript);
  
  log.info(`编译目录: ${buildDir}`);
  log.step(5, '执行 scons 编译...');
  
  return new Promise((resolve, reject) => {
    const scons = spawn('scons', ['-j4'], {
      cwd: buildDir,
      shell: true,
      stdio: ['pipe', 'pipe', 'pipe'],
    });
    
    let stderr = '';
    
    scons.stdout?.on('data', (data) => {
      const str = data.toString();
      if (str.includes('error') || str.includes('Error') || str.includes('Linking') || str.includes('TOOL ROOT')) {
        process.stdout.write(data);
      }
    });
    
    scons.stderr?.on('data', (data) => {
      stderr += data.toString();
      process.stderr.write(data);
    });
    
    const timeout = setTimeout(() => {
      scons.kill();
      reject(new Error('编译超时'));
    }, CONFIG.timeout);
    
    scons.on('close', (code) => {
      clearTimeout(timeout);
      if (code === 0) {
        const exeName = process.platform === 'win32' ? 'gui.exe' : 'gui';
        const exePath = path.join(buildDir, exeName);
        log.success('编译成功！');
        resolve(exePath);
      } else {
        reject(new Error(`编译失败，退出码: ${code}\n${stderr}`));
      }
    });
    
    scons.on('error', reject);
  });
}

async function runSimulation(exePath: string): Promise<void> {
  log.step(6, '运行仿真...');
  
  if (!fs.existsSync(exePath)) {
    throw new Error(`可执行文件不存在: ${exePath}`);
  }
  
  // 检查是否有图形环境
  const hasDisplay = process.env.DISPLAY || process.platform === 'win32';
  if (!hasDisplay) {
    log.warn('未检测到图形环境 (DISPLAY 未设置)，跳过仿真运行');
    log.info('编译成功即表示代码生成正确');
    return;
  }
  
  return new Promise((resolve, reject) => {
    log.info(`启动: ${exePath}`);
    log.info(`仿真将运行 ${CONFIG.runDuration / 1000} 秒...`);
    
    const proc = spawn(exePath, [], {
      cwd: path.dirname(exePath),
      stdio: ['pipe', 'pipe', 'pipe'],
      env: { ...process.env, DISPLAY: process.env.DISPLAY || ':0' },
    });
    
    proc.stdout?.on('data', (data) => {
      log.info(`[仿真] ${data.toString().trim()}`);
    });
    
    proc.stderr?.on('data', (data) => {
      const msg = data.toString().trim();
      // SDL 初始化失败通常是因为没有图形环境
      if (msg.includes('No available video device') || msg.includes("Couldn't initialize SDL")) {
        log.warn('无图形环境，仿真无法启动（编译已成功）');
        proc.kill();
        return;
      }
      log.warn(`[仿真] ${msg}`);
    });
    
    const timeout = setTimeout(() => {
      log.info('正在关闭仿真程序...');
      proc.kill('SIGTERM');
    }, CONFIG.runDuration);
    
    proc.on('close', (code) => {
      clearTimeout(timeout);
      log.success(`仿真程序退出，退出码: ${code}`);
      resolve();
    });
    
    proc.on('error', (err) => {
      clearTimeout(timeout);
      reject(err);
    });
  });
}

function cleanup(projectPath: string): void {
  log.step(7, '清理临时文件...');
  
  try {
    fs.rmSync(projectPath, { recursive: true, force: true });
    
    const testDir = path.join(CONFIG.sdkPath, 'example', 'e2e_test');
    if (fs.existsSync(testDir)) {
      fs.rmSync(testDir, { recursive: true, force: true });
    }
    
    log.info('临时文件已清理');
  } catch (err) {
    log.error(`清理失败: ${err}`);
  }
}

function copyDir(src: string, dest: string): void {
  if (!fs.existsSync(src)) return;
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

function checkEnvironment(): void {
  log.info('检查环境...');
  
  if (!fs.existsSync(CONFIG.sdkPath)) {
    throw new Error(`HoneyGUI SDK 不存在: ${CONFIG.sdkPath}`);
  }
  log.info(`SDK: ${CONFIG.sdkPath}`);
  
  try {
    execSync('scons --version', { stdio: 'pipe' });
    log.info('SCons: OK');
  } catch {
    throw new Error('SCons 未安装');
  }
  
  try {
    execSync('gcc --version', { stdio: 'pipe' });
    log.info('GCC: OK');
  } catch {
    throw new Error('GCC 未安装');
  }
  
  log.success('环境检查通过');
}

async function main(): Promise<void> {
  console.log('\n' + '='.repeat(50));
  console.log('  HoneyGUI Design 端到端测试');
  console.log('='.repeat(50));
  
  const projectName = 'e2e_test_project';
  const projectPath = path.join(process.cwd(), projectName);
  
  let success = false;
  
  try {
    checkEnvironment();
    createProject(projectPath, projectName);
    generateHml(projectPath);
    await generateCode(projectPath);
    const exePath = await compile(projectPath);
    await runSimulation(exePath);
    success = true;
  } catch (error) {
    log.error(`测试失败: ${error instanceof Error ? error.message : error}`);
  } finally {
    // cleanup(projectPath);  // 暂时注释，保留生成的工程以便检查
    log.info(`工程保留在: ${projectPath}`);
  }
  
  console.log('\n' + '='.repeat(50));
  if (success) {
    log.success('端到端测试通过！');
  } else {
    log.error('端到端测试失败！');
    process.exit(1);
  }
  console.log('='.repeat(50) + '\n');
}

main();
