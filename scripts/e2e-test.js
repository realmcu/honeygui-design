#!/usr/bin/env npx ts-node
"use strict";
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
var __assign = (this && this.__assign) || function () {
    __assign = Object.assign || function(t) {
        for (var s, i = 1, n = arguments.length; i < n; i++) {
            s = arguments[i];
            for (var p in s) if (Object.prototype.hasOwnProperty.call(s, p))
                t[p] = s[p];
        }
        return t;
    };
    return __assign.apply(this, arguments);
};
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __generator = (this && this.__generator) || function (thisArg, body) {
    var _ = { label: 0, sent: function() { if (t[0] & 1) throw t[1]; return t[1]; }, trys: [], ops: [] }, f, y, t, g = Object.create((typeof Iterator === "function" ? Iterator : Object).prototype);
    return g.next = verb(0), g["throw"] = verb(1), g["return"] = verb(2), typeof Symbol === "function" && (g[Symbol.iterator] = function() { return this; }), g;
    function verb(n) { return function (v) { return step([n, v]); }; }
    function step(op) {
        if (f) throw new TypeError("Generator is already executing.");
        while (g && (g = 0, op[0] && (_ = 0)), _) try {
            if (f = 1, y && (t = op[0] & 2 ? y["return"] : op[0] ? y["throw"] || ((t = y["return"]) && t.call(y), 0) : y.next) && !(t = t.call(y, op[1])).done) return t;
            if (y = 0, t) op = [op[0] & 2, t.value];
            switch (op[0]) {
                case 0: case 1: t = op; break;
                case 4: _.label++; return { value: op[1], done: false };
                case 5: _.label++; y = op[1]; op = [0]; continue;
                case 7: op = _.ops.pop(); _.trys.pop(); continue;
                default:
                    if (!(t = _.trys, t = t.length > 0 && t[t.length - 1]) && (op[0] === 6 || op[0] === 2)) { _ = 0; continue; }
                    if (op[0] === 3 && (!t || (op[1] > t[0] && op[1] < t[3]))) { _.label = op[1]; break; }
                    if (op[0] === 6 && _.label < t[1]) { _.label = t[1]; t = op; break; }
                    if (t && _.label < t[2]) { _.label = t[2]; _.ops.push(op); break; }
                    if (t[2]) _.ops.pop();
                    _.trys.pop(); continue;
            }
            op = body.call(thisArg, _);
        } catch (e) { op = [6, e]; y = 0; } finally { f = t = 0; }
        if (op[0] & 5) throw op[1]; return { value: op[0] ? op[1] : void 0, done: true };
    }
};
var __spreadArray = (this && this.__spreadArray) || function (to, from, pack) {
    if (pack || arguments.length === 2) for (var i = 0, l = from.length, ar; i < l; i++) {
        if (ar || !(i in from)) {
            if (!ar) ar = Array.prototype.slice.call(from, 0, i);
            ar[i] = from[i];
        }
    }
    return to.concat(ar || Array.prototype.slice.call(from));
};
Object.defineProperty(exports, "__esModule", { value: true });
var fs = __importStar(require("fs"));
var path = __importStar(require("path"));
var os = __importStar(require("os"));
var child_process_1 = require("child_process");
var HoneyGuiCCodeGenerator_1 = require("../src/codegen/honeygui/HoneyGuiCCodeGenerator");
var HmlSerializer_1 = require("../src/hml/HmlSerializer");
var HmlParser_1 = require("../src/hml/HmlParser");
var BuildCore_1 = require("../src/simulation/BuildCore");
// 配置
var CONFIG = {
    sdkPath: path.join(os.homedir(), '.HoneyGUI-SDK'),
    resolution: { width: 480, height: 272 },
    timeout: 120000,
    runDuration: 3000, // 3 秒足够测试启动和停止
};
// 颜色输出
var log = {
    info: function (msg) { return console.log("\u001B[36m[INFO]\u001B[0m ".concat(msg)); },
    success: function (msg) { return console.log("\u001B[32m[SUCCESS]\u001B[0m ".concat(msg)); },
    error: function (msg) { return console.log("\u001B[31m[ERROR]\u001B[0m ".concat(msg)); },
    warn: function (msg) { return console.log("\u001B[33m[WARN]\u001B[0m ".concat(msg)); },
    step: function (n, msg) { return console.log("\n\u001B[33m[STEP ".concat(n, "]\u001B[0m ").concat(msg)); },
};
// ============ 测试步骤 ============
function createProject(projectPath, projectName) {
    log.step(1, '创建临时项目...');
    fs.mkdirSync(path.join(projectPath, 'ui', 'main'), { recursive: true });
    fs.mkdirSync(path.join(projectPath, 'src', 'autogen', 'main'), { recursive: true });
    fs.mkdirSync(path.join(projectPath, 'assets'), { recursive: true });
    var projectConfig = {
        name: projectName,
        appId: "com.test.".concat(projectName),
        version: '1.0.0',
        resolution: "".concat(CONFIG.resolution.width, "X").concat(CONFIG.resolution.height),
    };
    fs.writeFileSync(path.join(projectPath, 'project.json'), JSON.stringify(projectConfig, null, 2));
    log.info("\u9879\u76EE\u521B\u5EFA\u4E8E: ".concat(projectPath));
}
function createMockDesignerData() {
    var _a = CONFIG.resolution, width = _a.width, height = _a.height;
    // 模拟设计器前端传递过来的组件数据
    return [
        {
            id: 'mainView',
            type: 'hg_view',
            name: 'mainView',
            position: { x: 0, y: 0, width: width, height: height },
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
function generateHml(projectPath) {
    log.step(2, '生成 HML 文件 (模拟保存)...');
    var components = createMockDesignerData();
    var document = {
        meta: {
            project: {
                name: 'E2ETest',
                resolution: "".concat(CONFIG.resolution.width, "X").concat(CONFIG.resolution.height)
            }
        },
        view: {
            components: components
        }
    };
    // 1. 序列化：Component[] -> HML String
    var serializer = new HmlSerializer_1.HmlSerializer();
    var hmlContent = serializer.serialize(document);
    var hmlPath = path.join(projectPath, 'ui', 'main', 'main.hml');
    fs.writeFileSync(hmlPath, hmlContent);
    log.info('HML 文件已生成');
    log.info('内容预览:\n' + hmlContent);
}
function generateCode(projectPath) {
    return __awaiter(this, void 0, void 0, function () {
        var hmlPath, hmlContent, parser, document, components, outputDir, generator, result, sourceFile;
        var _a;
        return __generator(this, function (_b) {
            switch (_b.label) {
                case 0:
                    log.step(3, '生成 C 代码 (模拟编译)...');
                    hmlPath = path.join(projectPath, 'ui', 'main', 'main.hml');
                    hmlContent = fs.readFileSync(hmlPath, 'utf-8');
                    parser = new HmlParser_1.HmlParser();
                    document = parser.parse(hmlContent);
                    if (!document || !document.view || !document.view.components) {
                        throw new Error('HML 解析失败或无组件');
                    }
                    components = document.view.components;
                    log.info("\u89E3\u6790\u5F97\u5230 ".concat(components.length, " \u4E2A\u7EC4\u4EF6"));
                    outputDir = path.join(projectPath, 'src', 'autogen', 'main');
                    generator = new HoneyGuiCCodeGenerator_1.HoneyGuiCCodeGenerator(components, {
                        outputDir: outputDir,
                        hmlFileName: 'main',
                        enableProtectedAreas: false
                    });
                    return [4 /*yield*/, generator.generate()];
                case 1:
                    result = _b.sent();
                    if (result.success) {
                        log.info("\u751F\u6210\u4E86 ".concat(result.files.length, " \u4E2A\u6587\u4EF6: ").concat(result.files.map(function (f) { return path.basename(f); }).join(', ')));
                        sourceFile = path.join(outputDir, 'main.c');
                        if (fs.existsSync(sourceFile)) {
                            log.info('\n生成的 main.c:');
                            console.log(fs.readFileSync(sourceFile, 'utf-8'));
                        }
                    }
                    else {
                        throw new Error("\u4EE3\u7801\u751F\u6210\u5931\u8D25: ".concat((_a = result.errors) === null || _a === void 0 ? void 0 : _a.join(', ')));
                    }
                    return [2 /*return*/];
            }
        });
    });
}
function compile(projectPath) {
    return __awaiter(this, void 0, void 0, function () {
        var logger, buildCore, buildDir;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    log.step(4, '准备编译环境...');
                    logger = {
                        log: function (msg, isError) {
                            if (isError) {
                                log.error(msg);
                            }
                            else {
                                log.info(msg);
                            }
                        }
                    };
                    buildCore = new BuildCore_1.BuildCore(projectPath, CONFIG.sdkPath, logger);
                    buildDir = buildCore.getBuildDir();
                    if (fs.existsSync(buildDir)) {
                        fs.rmSync(buildDir, { recursive: true, force: true });
                    }
                    return [4 /*yield*/, buildCore.setupBuildDir()];
                case 1:
                    _a.sent();
                    return [4 /*yield*/, buildCore.copyGeneratedCode()];
                case 2:
                    _a.sent();
                    log.info("\u7F16\u8BD1\u76EE\u5F55: ".concat(buildDir));
                    log.step(5, '执行 scons 编译...');
                    return [4 /*yield*/, buildCore.compile()];
                case 3:
                    _a.sent();
                    log.success('编译成功！');
                    return [2 /*return*/, buildCore.getExecutablePath()];
            }
        });
    });
}
function runSimulation(exePath) {
    return __awaiter(this, void 0, void 0, function () {
        var hasDisplay;
        var _this = this;
        return __generator(this, function (_a) {
            log.step(6, '运行仿真并测试停止功能...');
            if (!fs.existsSync(exePath)) {
                throw new Error("\u53EF\u6267\u884C\u6587\u4EF6\u4E0D\u5B58\u5728: ".concat(exePath));
            }
            hasDisplay = process.env.DISPLAY || process.platform === 'win32';
            if (!hasDisplay) {
                log.warn('未检测到图形环境 (DISPLAY 未设置)，跳过仿真运行');
                log.info('编译成功即表示代码生成正确');
                return [2 /*return*/];
            }
            return [2 /*return*/, new Promise(function (resolve, reject) {
                    var _a, _b;
                    log.info("\u542F\u52A8: ".concat(exePath));
                    log.info("\u4EFF\u771F\u5C06\u8FD0\u884C ".concat(CONFIG.runDuration / 1000, " \u79D2\u540E\u505C\u6B62..."));
                    // 使用 stdbuf 启动（Linux）或直接启动（Windows）
                    var command;
                    var args;
                    if (process.platform === 'win32') {
                        command = exePath;
                        args = [];
                    }
                    else {
                        command = 'stdbuf';
                        args = ['-o0', '-e0', exePath];
                    }
                    var proc = (0, child_process_1.spawn)(command, args, {
                        cwd: path.dirname(exePath),
                        stdio: ['ignore', 'pipe', 'pipe'],
                        env: __assign(__assign({}, process.env), { DISPLAY: process.env.DISPLAY || ':0', SDL_STDIO_REDIRECT: '0' }),
                        detached: process.platform !== 'win32'
                    });
                    var pid = proc.pid;
                    log.info("\u8FDB\u7A0B PID: ".concat(pid));
                    var outputReceived = false;
                    (_a = proc.stdout) === null || _a === void 0 ? void 0 : _a.on('data', function (data) {
                        var output = data.toString().trim();
                        if (output) {
                            log.info("[\u4EFF\u771F] ".concat(output));
                            outputReceived = true;
                        }
                    });
                    (_b = proc.stderr) === null || _b === void 0 ? void 0 : _b.on('data', function (data) {
                        var msg = data.toString().trim();
                        if (msg.includes('No available video device') || msg.includes("Couldn't initialize SDL")) {
                            log.warn('无图形环境，仿真无法启动（编译已成功）');
                            killProcessTree(proc);
                            return;
                        }
                        if (msg) {
                            log.warn("[\u4EFF\u771F\u9519\u8BEF] ".concat(msg));
                        }
                    });
                    // 检查进程是否存在
                    setTimeout(function () {
                        if (pid && isProcessRunning(pid)) {
                            log.success('✓ 进程启动成功');
                        }
                        else {
                            log.error('✗ 进程未正常启动');
                        }
                    }, 1000);
                    var timeout = setTimeout(function () { return __awaiter(_this, void 0, void 0, function () {
                        var childProcesses;
                        return __generator(this, function (_a) {
                            switch (_a.label) {
                                case 0:
                                    log.info('测试停止功能...');
                                    childProcesses = getChildProcesses(pid);
                                    log.info("\u505C\u6B62\u524D\u8FDB\u7A0B\u6811: \u4E3B\u8FDB\u7A0B ".concat(pid, ", \u5B50\u8FDB\u7A0B: ").concat(childProcesses.join(', ')));
                                    // 停止进程
                                    return [4 /*yield*/, killProcessTree(proc)];
                                case 1:
                                    // 停止进程
                                    _a.sent();
                                    // 等待 1 秒后检查进程是否真的被杀死
                                    setTimeout(function () {
                                        var stillRunning = __spreadArray([pid], childProcesses, true).filter(function (p) { return isProcessRunning(p); });
                                        if (stillRunning.length === 0) {
                                            log.success('✓ 所有进程已正确清理');
                                        }
                                        else {
                                            log.error("\u2717 \u4ECD\u6709\u8FDB\u7A0B\u672A\u6E05\u7406: ".concat(stillRunning.join(', ')));
                                            // 强制清理
                                            stillRunning.forEach(function (p) {
                                                try {
                                                    process.kill(p, 'SIGKILL');
                                                }
                                                catch (_a) { }
                                            });
                                        }
                                        if (outputReceived) {
                                            log.success('✓ 接收到仿真输出');
                                        }
                                        else {
                                            log.warn('⚠ 未接收到仿真输出（可能是正常的）');
                                        }
                                        resolve();
                                    }, 1000);
                                    return [2 /*return*/];
                            }
                        });
                    }); }, CONFIG.runDuration);
                    proc.on('close', function (code) {
                        clearTimeout(timeout);
                        log.info("\u4EFF\u771F\u7A0B\u5E8F\u9000\u51FA\uFF0C\u9000\u51FA\u7801: ".concat(code));
                    });
                    proc.on('error', function (error) {
                        clearTimeout(timeout);
                        reject(error);
                    });
                })];
        });
    });
}
/**
 * 检查进程是否在运行
 */
function isProcessRunning(pid) {
    try {
        process.kill(pid, 0);
        return true;
    }
    catch (_a) {
        return false;
    }
}
/**
 * 获取子进程列表
 */
function getChildProcesses(parentPid) {
    try {
        var result = (0, child_process_1.execSync)("pgrep -P ".concat(parentPid), { encoding: 'utf-8' });
        return result.trim().split('\n').map(function (p) { return parseInt(p); }).filter(function (p) { return !isNaN(p); });
    }
    catch (_a) {
        return [];
    }
}
/**
 * 杀死进程树
 */
function killProcessTree(proc) {
    return __awaiter(this, void 0, void 0, function () {
        var err_1;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    if (!proc.pid)
                        return [2 /*return*/];
                    _a.label = 1;
                case 1:
                    _a.trys.push([1, 5, , 6]);
                    if (!(process.platform === 'win32')) return [3 /*break*/, 2];
                    (0, child_process_1.execSync)("taskkill /F /T /PID ".concat(proc.pid), { stdio: 'ignore' });
                    return [3 /*break*/, 4];
                case 2:
                    try {
                        process.kill(-proc.pid, 'SIGTERM');
                    }
                    catch (_b) {
                        proc.kill('SIGTERM');
                    }
                    // 等待 1 秒后强制杀死
                    return [4 /*yield*/, new Promise(function (resolve) { return setTimeout(resolve, 1000); })];
                case 3:
                    // 等待 1 秒后强制杀死
                    _a.sent();
                    try {
                        process.kill(-proc.pid, 'SIGKILL');
                    }
                    catch (_c) {
                        proc.kill('SIGKILL');
                    }
                    _a.label = 4;
                case 4: return [3 /*break*/, 6];
                case 5:
                    err_1 = _a.sent();
                    log.warn("\u6740\u6B7B\u8FDB\u7A0B\u65F6\u51FA\u9519: ".concat(err_1));
                    return [3 /*break*/, 6];
                case 6: return [2 /*return*/];
            }
        });
    });
}
proc.on('error', function (err) {
    clearTimeout(timeout);
    reject(err);
});
;
function cleanup(projectPath) {
    log.step(7, '清理临时文件...');
    try {
        fs.rmSync(projectPath, { recursive: true, force: true });
        var testDir = path.join(CONFIG.sdkPath, 'example', 'e2e_test');
        if (fs.existsSync(testDir)) {
            fs.rmSync(testDir, { recursive: true, force: true });
        }
        log.info('临时文件已清理');
    }
    catch (err) {
        log.error("\u6E05\u7406\u5931\u8D25: ".concat(err));
    }
}
function copyDir(src, dest) {
    if (!fs.existsSync(src))
        return;
    fs.mkdirSync(dest, { recursive: true });
    for (var _i = 0, _a = fs.readdirSync(src, { withFileTypes: true }); _i < _a.length; _i++) {
        var entry = _a[_i];
        var srcPath = path.join(src, entry.name);
        var destPath = path.join(dest, entry.name);
        if (entry.isDirectory()) {
            copyDir(srcPath, destPath);
        }
        else {
            fs.copyFileSync(srcPath, destPath);
        }
    }
}
function checkEnvironment() {
    log.info('检查环境...');
    if (!fs.existsSync(CONFIG.sdkPath)) {
        throw new Error("HoneyGUI SDK \u4E0D\u5B58\u5728: ".concat(CONFIG.sdkPath));
    }
    log.info("SDK: ".concat(CONFIG.sdkPath));
    try {
        (0, child_process_1.execSync)('scons --version', { stdio: 'pipe' });
        log.info('SCons: OK');
    }
    catch (_a) {
        throw new Error('SCons 未安装');
    }
    try {
        (0, child_process_1.execSync)('gcc --version', { stdio: 'pipe' });
        log.info('GCC: OK');
    }
    catch (_b) {
        throw new Error('GCC 未安装');
    }
    log.success('环境检查通过');
}
function main() {
    return __awaiter(this, void 0, void 0, function () {
        var projectName, projectPath, success, exePath, error_1;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    console.log('\n' + '='.repeat(50));
                    console.log('  HoneyGUI Design 端到端测试');
                    console.log('='.repeat(50));
                    projectName = 'e2e_test_project';
                    projectPath = path.join(process.cwd(), projectName);
                    success = false;
                    _a.label = 1;
                case 1:
                    _a.trys.push([1, 5, 6, 7]);
                    checkEnvironment();
                    createProject(projectPath, projectName);
                    generateHml(projectPath);
                    return [4 /*yield*/, generateCode(projectPath)];
                case 2:
                    _a.sent();
                    return [4 /*yield*/, compile(projectPath)];
                case 3:
                    exePath = _a.sent();
                    return [4 /*yield*/, runSimulation(exePath)];
                case 4:
                    _a.sent();
                    success = true;
                    return [3 /*break*/, 7];
                case 5:
                    error_1 = _a.sent();
                    log.error("\u6D4B\u8BD5\u5931\u8D25: ".concat(error_1 instanceof Error ? error_1.message : error_1));
                    return [3 /*break*/, 7];
                case 6:
                    // cleanup(projectPath);  // 暂时注释，保留生成的工程以便检查
                    log.info("\u5DE5\u7A0B\u4FDD\u7559\u5728: ".concat(projectPath));
                    return [7 /*endfinally*/];
                case 7:
                    console.log('\n' + '='.repeat(50));
                    if (success) {
                        log.success('端到端测试通过！');
                    }
                    else {
                        log.error('端到端测试失败！');
                        process.exit(1);
                    }
                    console.log('='.repeat(50) + '\n');
                    return [2 /*return*/];
            }
        });
    });
}
main();
