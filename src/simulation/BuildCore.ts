import * as path from 'path';
import * as fs from 'fs';
import { spawn } from 'child_process';
import { ImageConverterService } from '../services/ImageConverterService';

/**
 * 日志接口
 */
export interface Logger {
    log(message: string, isError?: boolean): void;
}

/**
 * 编译核心逻辑（不依赖 VSCode）
 */
export class BuildCore {
    protected buildDir: string;
    protected projectRoot: string;
    protected sdkPath: string;
    protected logger: Logger;

    constructor(projectRoot: string, sdkPath: string, logger: Logger) {
        this.projectRoot = projectRoot;
        this.sdkPath = sdkPath;
        this.buildDir = path.join(projectRoot, 'build');
        this.logger = logger;
    }

    getBuildDir(): string {
        return this.buildDir;
    }

    async setupBuildDir(): Promise<void> {
        this.logger.log('准备编译目录...');

        const parentDir = path.dirname(this.buildDir);
        if (!fs.existsSync(parentDir)) {
            fs.mkdirSync(parentDir, { recursive: true });
        }

        const sdkWin32Sim = path.join(this.sdkPath, 'win32_sim');
        if (!fs.existsSync(sdkWin32Sim)) {
            throw new Error(`SDK win32_sim 目录不存在: ${sdkWin32Sim}`);
        }

        if (!fs.existsSync(this.buildDir)) {
            this.logger.log('拷贝 win32_sim...');
            this.copyDirectory(sdkWin32Sim, this.buildDir);
            this.logger.log('win32_sim 拷贝完成');
        } else {
            this.logger.log('win32_sim 已存在，跳过拷贝');
        }

        const kconfigSource = path.join(this.sdkPath, 'Kconfig.gui');
        const kconfigDest = path.join(this.buildDir, 'Kconfig.gui');
        if (fs.existsSync(kconfigSource)) {
            fs.copyFileSync(kconfigSource, kconfigDest);
        }

        this.generateConfig();
        this.modifySConstruct();
        this.logger.log('编译目录准备完成');
    }

    async copyGeneratedCode(): Promise<void> {
        this.logger.log('检查生成的代码...');

        const srcAutogen = path.join(this.projectRoot, 'src', 'autogen');
        if (!fs.existsSync(srcAutogen)) {
            throw new Error(`生成的代码目录不存在: ${srcAutogen}`);
        }

        const sconscript = path.join(srcAutogen, 'SConscript');
        if (!fs.existsSync(sconscript)) {
            throw new Error(`SConscript 文件不存在: ${sconscript}，请先生成代码`);
        }

        this.logger.log('代码检查完成');
    }

    async convertAssets(): Promise<void> {
        this.logger.log('转换图片资源...');

        const assetsDir = path.join(this.projectRoot, 'assets');
        const outputDir = path.join(this.buildDir, 'assets');

        const converter = new ImageConverterService(this.sdkPath);
        const results = await converter.convertAssetsDir(assetsDir, outputDir);

        const failed = results.filter(r => !r.success);
        if (failed.length > 0) {
            for (const f of failed) {
                this.logger.log(`转换失败: ${f.inputPath} - ${f.error}`, true);
            }
            throw new Error(`${failed.length} 个图片转换失败`);
        }

        this.logger.log(`转换完成: ${results.length} 个图片`);
    }

    async compile(): Promise<void> {
        this.logger.log('开始编译...');

        return new Promise((resolve, reject) => {
            const compileProcess = spawn('scons', ['-j4'], {
                cwd: this.buildDir,
                shell: true
            });

            compileProcess.stdout?.on('data', (data) => {
                this.logger.log(data.toString());
            });

            compileProcess.stderr?.on('data', (data) => {
                this.logger.log(data.toString(), true);
            });

            compileProcess.on('exit', (code) => {
                if (code === 0) {
                    this.logger.log('编译成功！');
                    resolve();
                } else {
                    reject(new Error(`编译失败，退出码: ${code}`));
                }
            });

            compileProcess.on('error', reject);
        });
    }

    getExecutablePath(): string {
        const exeName = process.platform === 'win32' ? 'gui.exe' : 'gui';
        return path.join(this.buildDir, exeName);
    }

    private generateConfig(): void {
        const configContent = 'CONFIG_REALTEK_HONEYGUI=y\n';
        fs.writeFileSync(path.join(this.buildDir, '.config'), configContent);
    }

    private modifySConstruct(): void {
        const sconstructPath = path.join(this.buildDir, 'SConstruct');
        if (!fs.existsSync(sconstructPath)) return;

        let content = fs.readFileSync(sconstructPath, 'utf-8');
        const sdkPathNormalized = this.sdkPath.replace(/\\/g, '/');
        const projectRootNormalized = this.projectRoot.replace(/\\/g, '/');
        
        content = content.replace(
            /PROJECT_ROOT\s*=\s*os\.path\.dirname\(os\.getcwd\(\)\)/,
            `PROJECT_ROOT = '${sdkPathNormalized}'`
        );

        // 在 DoBuilding 之前添加项目 autogen 代码的编译（仅当不存在时）
        if (!content.includes('PROJECT_AUTOGEN')) {
            const autogenInclude = `
# Include project autogen code
PROJECT_AUTOGEN = '${projectRootNormalized}/src/autogen'
if os.path.exists(os.path.join(PROJECT_AUTOGEN, 'SConscript')):
    objs.extend(SConscript(os.path.join(PROJECT_AUTOGEN, 'SConscript')))
`;
            content = content.replace(
                /# Build\s*\nDoBuilding\(TARGET, objs\)/,
                `${autogenInclude}\n# Build\nDoBuilding(TARGET, objs)`
            );
        }
        
        fs.writeFileSync(sconstructPath, content);
    }

    protected copyDirectory(src: string, dest: string): void {
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
}
