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
import { spawn, execSync, ChildProcess } from 'child_process';
import { HoneyGuiCCodeGenerator } from '../src/codegen/honeygui/HoneyGuiCCodeGenerator';
import { HmlSerializer } from '../src/hml/HmlSerializer';
import { HmlParser } from '../src/hml/HmlParser';
import { HmlTemplateManager } from '../src/hml/HmlTemplateManager';
import { Document as HmlDocument, Component } from '../src/hml/types';
import { BuildCore, Logger } from '../src/simulation/BuildCore';

// 配置
const CONFIG = {
  projectName: 'E2ETest',  // 项目名称（可配置）
  sdkPath: path.join(os.homedir(), '.HoneyGUI-SDK'),
  resolution: { width: 480, height: 272 },
  timeout: 120000,
  runDuration: 3000,  // 3 秒足够测试启动和停止
};

// 根据项目名称生成文件名
const HML_FILE_NAME = `${CONFIG.projectName}Main.hml`;
const C_FILE_NAME = `${CONFIG.projectName}Main`;

// 颜色输出
const log = {
  info: (msg: string) => console.log(`\x1b[36m[INFO]\x1b[0m ${msg}`),
  success: (msg: string) => console.log(`\x1b[32m[SUCCESS]\x1b[0m ${msg}`),
  error: (msg: string) => console.log(`\x1b[31m[ERROR]\x1b[0m ${msg}`),
  warn: (msg: string) => console.log(`\x1b[33m[WARN]\x1b[0m ${msg}`),
  step: (n: number, msg: string) => console.log(`\n\x1b[33m[STEP ${n}]\x1b[0m ${msg}`),
};

// ============ 测试步骤 ============

function createProject(projectPath: string): void {
  log.step(1, '创建临时项目...');
  
  fs.mkdirSync(path.join(projectPath, 'ui', 'main'), { recursive: true });
  fs.mkdirSync(path.join(projectPath, 'src', 'autogen', 'main'), { recursive: true });
  fs.mkdirSync(path.join(projectPath, 'assets'), { recursive: true });
  
  const projectConfig = {
    name: CONFIG.projectName,
    appId: `com.test.${CONFIG.projectName.toLowerCase()}`,
    version: '1.0.0',
    resolution: `${CONFIG.resolution.width}X${CONFIG.resolution.height}`,
    minSdk: 'API 2: HoneyGUI V1.1.0',
    pixelMode: 'ARGB8888',
    mainHmlFile: `ui/main/${HML_FILE_NAME}`,
  };
  
  fs.writeFileSync(
    path.join(projectPath, 'project.json'),
    JSON.stringify(projectConfig, null, 2)
  );
  
  log.info(`项目创建于: ${projectPath}`);
  log.info(`主 HML 文件: ${HML_FILE_NAME}`);
}

function generateHml(projectPath: string): void {
  log.step(2, '生成 HML 文件 (使用 HmlTemplateManager)...');
  
  // 使用插件的 HmlTemplateManager API 生成标准 HML
  const hmlContent = HmlTemplateManager.generateMainHml(
    CONFIG.projectName,
    `${CONFIG.resolution.width}X${CONFIG.resolution.height}`,
    `com.test.${CONFIG.projectName.toLowerCase()}`,
    'API 2: HoneyGUI V1.1.0',
    'ARGB8888'
  );

  const hmlPath = path.join(projectPath, 'ui', 'main', HML_FILE_NAME);
  fs.writeFileSync(hmlPath, hmlContent);
  
  log.info('HML 文件已生成（使用插件 API）');
  log.info('内容预览:\n' + hmlContent);
}

async function generateCode(projectPath: string): Promise<void> {
  log.step(3, '生成 C 代码 (模拟编译)...');
  
  const hmlPath = path.join(projectPath, 'ui', 'main', HML_FILE_NAME);
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
      hmlFileName: C_FILE_NAME,
      enableProtectedAreas: false
  });

  const result = await generator.generate();

  if (result.success) {
      log.info(`生成了 ${result.files.length} 个文件: ${result.files.map(f => path.basename(f)).join(', ')}`);
      // 读取生成的 C 文件并打印出来以供检查
      const sourceFile = path.join(outputDir, `${C_FILE_NAME}.c`);
      if (fs.existsSync(sourceFile)) {
          log.info(`\n生成的 ${C_FILE_NAME}.c:`);
          console.log(fs.readFileSync(sourceFile, 'utf-8'));
      }
  } else {
      throw new Error(`代码生成失败: ${result.errors?.join(', ')}`);
  }
}

async function compile(projectPath: string): Promise<string> {
  log.step(4, '准备编译环境...');
  
  // 使用 BuildCore（与 BuildManager 共享核心逻辑）
  const logger: Logger = {
    log: (msg: string, isError?: boolean) => {
      if (isError) {
        log.error(msg);
      } else {
        log.info(msg);
      }
    }
  };
  
  const buildCore = new BuildCore(projectPath, CONFIG.sdkPath, logger);
  
  // 清理旧的编译目录
  const buildDir = buildCore.getBuildDir();
  if (fs.existsSync(buildDir)) {
    fs.rmSync(buildDir, { recursive: true, force: true });
  }
  
  await buildCore.setupBuildDir();
  await buildCore.copyGeneratedCode();
  
  log.info(`编译目录: ${buildDir}`);
  log.step(5, '执行 scons 编译...');
  
  await buildCore.compile();
  
  log.success('编译成功！');
  return buildCore.getExecutablePath();
}

async function runSimulation(exePath: string): Promise<void> {
  log.step(6, '运行仿真并测试停止功能...');
  
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
    log.info(`仿真将运行 ${CONFIG.runDuration / 1000} 秒后停止...`);
    
    // 使用 stdbuf 启动（Linux）或直接启动（Windows）
    let command: string;
    let args: string[];
    
    if (process.platform === 'win32') {
      command = exePath;
      args = [];
    } else {
      command = 'stdbuf';
      args = ['-o0', '-e0', exePath];
    }
    
    const proc = spawn(command, args, {
      cwd: path.dirname(exePath),
      stdio: ['ignore', 'pipe', 'pipe'],
      env: { 
        ...process.env, 
        DISPLAY: process.env.DISPLAY || ':0',
        SDL_STDIO_REDIRECT: '0'
      },
      detached: process.platform !== 'win32'
    });
    
    const pid = proc.pid;
    log.info(`进程 PID: ${pid}`);
    
    let outputReceived = false;
    
    proc.stdout?.on('data', (data) => {
      const output = data.toString().trim();
      if (output) {
        log.info(`[仿真] ${output}`);
        outputReceived = true;
      }
    });
    
    proc.stderr?.on('data', (data) => {
      const msg = data.toString().trim();
      if (msg.includes('No available video device') || msg.includes("Couldn't initialize SDL")) {
        log.warn('无图形环境，仿真无法启动（编译已成功）');
        killProcessTree(proc);
        return;
      }
      if (msg) {
        log.warn(`[仿真错误] ${msg}`);
      }
    });
    
    // 检查进程是否存在
    setTimeout(() => {
      if (pid && isProcessRunning(pid)) {
        log.success('✓ 进程启动成功');
      } else {
        log.error('✗ 进程未正常启动');
      }
    }, 1000);
    
    const timeout = setTimeout(async () => {
      log.info('测试停止功能...');
      
      // 记录停止前的进程状态
      if (!pid) {
        resolve();
        return;
      }
      
      const childProcesses = getChildProcesses(pid);
      log.info(`停止前进程树: 主进程 ${pid}, 子进程: ${childProcesses.join(', ')}`);
      
      // 停止进程
      await killProcessTree(proc);
      
      // 等待 1 秒后检查进程是否真的被杀死
      setTimeout(() => {
        if (!pid) {
          resolve();
          return;
        }
        
        const stillRunning = [pid, ...childProcesses].filter(p => isProcessRunning(p));
        
        if (stillRunning.length === 0) {
          log.success('✓ 所有进程已正确清理');
        } else {
          log.error(`✗ 仍有进程未清理: ${stillRunning.join(', ')}`);
          // 强制清理
          stillRunning.forEach(p => {
            try {
              process.kill(p, 'SIGKILL');
            } catch {}
          });
        }
        
        if (outputReceived) {
          log.success('✓ 接收到仿真输出');
        } else {
          log.warn('⚠ 未接收到仿真输出（可能是正常的）');
        }
        
        resolve();
      }, 1000);
    }, CONFIG.runDuration);
    
    proc.on('close', (code) => {
      clearTimeout(timeout);
      log.info(`仿真程序退出，退出码: ${code}`);
    });
    
    proc.on('error', (error) => {
      clearTimeout(timeout);
      reject(error);
    });
  });
}

/**
 * 检查进程是否在运行
 */
function isProcessRunning(pid: number): boolean {
  try {
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
}

/**
 * 获取子进程列表
 */
function getChildProcesses(parentPid: number): number[] {
  try {
    const result = execSync(`pgrep -P ${parentPid}`, { encoding: 'utf-8' });
    return result.trim().split('\n').map(p => parseInt(p)).filter(p => !isNaN(p));
  } catch {
    return [];
  }
}

/**
 * 杀死进程树
 */
async function killProcessTree(proc: ChildProcess): Promise<void> {
  if (!proc.pid) return;
  
  try {
    if (process.platform === 'win32') {
      execSync(`taskkill /F /T /PID ${proc.pid}`, { stdio: 'ignore' });
    } else {
      try {
        process.kill(-proc.pid, 'SIGTERM');
      } catch {
        proc.kill('SIGTERM');
      }
      
      // 等待 1 秒后强制杀死
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      try {
        process.kill(-proc.pid, 'SIGKILL');
      } catch {
        proc.kill('SIGKILL');
      }
    }
  } catch (err) {
    log.warn(`杀死进程时出错: ${err}`);
  }
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
  
  const projectPath = path.join(process.cwd(), `${CONFIG.projectName.toLowerCase()}_test_project`);
  
  let success = false;
  
  try {
    checkEnvironment();
    createProject(projectPath);
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
