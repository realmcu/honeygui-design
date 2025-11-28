import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';
import { spawn, ChildProcess } from 'child_process';
import { SConstructGenerator } from './SConstructGenerator';

/**
 * 编译管理器
 * 负责设置编译目录、拷贝文件、执行编译
 */
export class BuildManager {
    private buildDir: string;
    private projectRoot: string;
    private sdkPath: string;
    private outputChannel: vscode.OutputChannel;

    constructor(projectRoot: string, sdkPath: string) {
        this.projectRoot = projectRoot;
        this.sdkPath = sdkPath;
        this.buildDir = path.join(projectRoot, '.honeygui-build', 'win32_sim');
        this.outputChannel = vscode.window.createOutputChannel('HoneyGUI Simulation');
    }

    /**
     * 准备编译目录
     */
    async setupBuildDir(): Promise<void> {
        this.log('准备编译目录...');

        const parentDir = path.dirname(this.buildDir);
        
        // 创建 .honeygui-build 目录
        if (!fs.existsSync(parentDir)) {
            fs.mkdirSync(parentDir, { recursive: true });
        }

        // 拷贝 SDK 的 win32_sim 到 .honeygui-build/win32_sim
        const sdkWin32Sim = path.join(this.sdkPath, 'win32_sim');
        if (!fs.existsSync(sdkWin32Sim)) {
            throw new Error(`SDK win32_sim 目录不存在: ${sdkWin32Sim}`);
        }

        // 如果目录不存在或需要更新，则拷贝
        if (!fs.existsSync(this.buildDir)) {
            this.log('拷贝 win32_sim...');
            this.copyDirectory(sdkWin32Sim, this.buildDir);
            this.log('win32_sim 拷贝完成');
        } else {
            this.log('win32_sim 已存在，跳过拷贝');
        }

        // 拷贝 Kconfig.gui
        const kconfigSource = path.join(this.sdkPath, 'Kconfig.gui');
        const kconfigDest = path.join(this.buildDir, 'Kconfig.gui');
        if (fs.existsSync(kconfigSource)) {
            fs.copyFileSync(kconfigSource, kconfigDest);
            this.log('Kconfig.gui 拷贝完成');
        } else {
            this.log('警告: Kconfig.gui 不存在');
        }

        // 生成 .config 文件
        this.generateConfig();

        // 修改 SConstruct
        this.modifySConstruct();

        // 更新 .gitignore
        await this.updateGitignore();

        this.log('编译目录准备完成');
    }

    /**
     * 拷贝生成的代码
     */
    async copyGeneratedCode(): Promise<void> {
        this.log('拷贝生成的代码...');

        const srcAutogen = path.join(this.projectRoot, 'src', 'autogen');
        const destAutogen = path.join(this.buildDir, 'autogen');

        if (fs.existsSync(srcAutogen)) {
            // 清理旧的 autogen 目录
            if (fs.existsSync(destAutogen)) {
                fs.rmSync(destAutogen, { recursive: true, force: true });
            }
            this.copyDirectory(srcAutogen, destAutogen);
            this.log('代码拷贝完成');
        } else {
            throw new Error(`生成的代码目录不存在: ${srcAutogen}`);
        }
    }

    /**
     * 执行编译
     */
    async compile(): Promise<void> {
        this.log('开始编译...');
        this.outputChannel.show(true);

        return new Promise((resolve, reject) => {
            const compileProcess = spawn('scons', ['-j4'], {
                cwd: this.buildDir,
                shell: true
            });

            compileProcess.stdout?.on('data', (data) => {
                this.log(data.toString());
            });

            compileProcess.stderr?.on('data', (data) => {
                this.log(data.toString(), true);
            });

            compileProcess.on('exit', (code) => {
                if (code === 0) {
                    this.log('编译成功！');
                    resolve();
                } else {
                    const error = `编译失败，退出码: ${code}`;
                    this.log(error, true);
                    reject(new Error(error));
                }
            });

            compileProcess.on('error', (error) => {
                this.log(`编译进程错误: ${error.message}`, true);
                reject(error);
            });
        });
    }

    /**
     * 获取可执行文件路径
     */
    getExecutablePath(): string {
        const exeName = process.platform === 'win32' ? 'gui.exe' : 'gui';
        return path.join(this.buildDir, 'build', exeName);
    }

    /**
     * 生成 .config 文件
     */
    private generateConfig(): void {
        this.log('生成 .config 文件...');

        const kconfigPath = path.join(this.buildDir, 'Kconfig.gui');
        
        if (!fs.existsSync(kconfigPath)) {
            this.log('警告: Kconfig.gui 不存在，使用默认配置');
            this.generateDefaultConfig();
            return;
        }

        // 解析 Kconfig.gui
        const kconfigContent = fs.readFileSync(kconfigPath, 'utf-8');
        const configLines: string[] = [];

        // 启用 HoneyGUI 框架
        configLines.push('CONFIG_REALTEK_HONEYGUI=y');

        // 解析所有 config 项，只启用 Feature Configuration 中的项
        let inFeatureMenu = false;
        const lines = kconfigContent.split('\n');
        
        for (let i = 0; i < lines.length; i++) {
            const line = lines[i].trim();
            
            // 检测进入 Feature Configuration 菜单
            if (line.includes('HoneyGUI Feature Configuration')) {
                inFeatureMenu = true;
                continue;
            }
            
            // 检测退出菜单
            if (inFeatureMenu && line === 'endmenu') {
                inFeatureMenu = false;
                continue;
            }
            
            // 在 Feature 菜单中，提取 config 项
            if (inFeatureMenu && line.startsWith('config ')) {
                const configName = line.replace('config ', '').trim();
                if (configName) {
                    configLines.push(`${configName}=y`);
                }
            }
        }

        const configContent = configLines.join('\n') + '\n';
        const configPath = path.join(this.buildDir, '.config');
        fs.writeFileSync(configPath, configContent, 'utf-8');
        
        this.log(`.config 文件生成完成，启用了 ${configLines.length} 个配置项`);
    }

    /**
     * 生成默认 .config（当 Kconfig.gui 不存在时）
     */
    private generateDefaultConfig(): void {
        const configContent = `CONFIG_REALTEK_HONEYGUI=y
CONFIG_REALTEK_BUILD_CJSON=y
CONFIG_REALTEK_BUILD_WEB=y
CONFIG_REALTEK_BUILD_PINYIN=y
CONFIG_REALTEK_BUILD_U8G2=y
CONFIG_REALTEK_BUILD_LITE_GFX=y
CONFIG_REALTEK_BUILD_LETTER_SHELL=y
CONFIG_REALTEK_BUILD_MONKEY_TEST=y
CONFIG_REALTEK_BUILD_GUI_BOX2D=y
CONFIG_REALTEK_BUILD_GUI_XML_DOM=y
CONFIG_REALTEK_BUILD_LITE3D=y
`;

        const configPath = path.join(this.buildDir, '.config');
        fs.writeFileSync(configPath, configContent, 'utf-8');
        
        this.log('.config 文件生成完成（使用默认配置）');
    }

    /**
     * 修改 SConstruct 文件
     */
    private modifySConstruct(): void {
        this.log('修改 SConstruct...');

        const sconstructPath = path.join(this.buildDir, 'SConstruct');
        
        if (!fs.existsSync(sconstructPath)) {
            this.log('警告: SConstruct 不存在');
            return;
        }

        let content = fs.readFileSync(sconstructPath, 'utf-8');
        
        // 修改 autogen 路径：从 ./../autogen/ 改为 ./autogen/
        content = content.replace(
            /GUI_AUTOGEN_CODE\s*=\s*os\.path\.abspath\(['"]\.\.\/\.\.\/autogen\/['"]\)/g,
            "GUI_AUTOGEN_CODE = os.path.abspath('./autogen/')"
        );
        content = content.replace(
            /GUI_AUTOGEN_CODE\s*=\s*os\.path\.abspath\(['"]\.\/\.\.\/autogen\/['"]\)/g,
            "GUI_AUTOGEN_CODE = os.path.abspath('./autogen/')"
        );
        
        fs.writeFileSync(sconstructPath, content, 'utf-8');
        
        this.log('SConstruct 修改完成');
    }

    /**
     * 更新 .gitignore
     */
    private async updateGitignore(): Promise<void> {
        const gitignorePath = path.join(this.projectRoot, '.gitignore');
        const entry = '.honeygui-build/';

        let content = '';
        if (fs.existsSync(gitignorePath)) {
            content = fs.readFileSync(gitignorePath, 'utf-8');
        }

        if (!content.includes(entry)) {
            content += `\n# HoneyGUI 编译仿真目录\n${entry}\n`;
            fs.writeFileSync(gitignorePath, content, 'utf-8');
        }
    }

    /**
     * 递归拷贝目录
     */
    private copyDirectory(src: string, dest: string): void {
        if (!fs.existsSync(dest)) {
            fs.mkdirSync(dest, { recursive: true });
        }

        const entries = fs.readdirSync(src, { withFileTypes: true });

        for (const entry of entries) {
            const srcPath = path.join(src, entry.name);
            const destPath = path.join(dest, entry.name);

            if (entry.isDirectory()) {
                this.copyDirectory(srcPath, destPath);
            } else {
                fs.copyFileSync(srcPath, destPath);
            }
        }
    }

    /**
     * 输出日志
     */
    private log(message: string, isError: boolean = false): void {
        const prefix = isError ? '[错误]' : '[信息]';
        this.outputChannel.appendLine(`${prefix} ${message}`);
    }

    /**
     * 清理资源
     */
    dispose(): void {
        this.outputChannel.dispose();
    }
}
