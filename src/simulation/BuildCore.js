"use strict";
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
Object.defineProperty(exports, "__esModule", { value: true });
exports.BuildCore = void 0;
var path = __importStar(require("path"));
var fs = __importStar(require("fs"));
var child_process_1 = require("child_process");
/**
 * 编译核心逻辑（不依赖 VSCode）
 */
var BuildCore = /** @class */ (function () {
    function BuildCore(projectRoot, sdkPath, logger) {
        this.projectRoot = projectRoot;
        this.sdkPath = sdkPath;
        this.buildDir = path.join(projectRoot, '.honeygui-build', 'win32_sim');
        this.logger = logger;
    }
    BuildCore.prototype.getBuildDir = function () {
        return this.buildDir;
    };
    BuildCore.prototype.setupBuildDir = function () {
        return __awaiter(this, void 0, void 0, function () {
            var parentDir, sdkWin32Sim, kconfigSource, kconfigDest;
            return __generator(this, function (_a) {
                this.logger.log('准备编译目录...');
                parentDir = path.dirname(this.buildDir);
                if (!fs.existsSync(parentDir)) {
                    fs.mkdirSync(parentDir, { recursive: true });
                }
                sdkWin32Sim = path.join(this.sdkPath, 'win32_sim');
                if (!fs.existsSync(sdkWin32Sim)) {
                    throw new Error("SDK win32_sim \u76EE\u5F55\u4E0D\u5B58\u5728: ".concat(sdkWin32Sim));
                }
                if (!fs.existsSync(this.buildDir)) {
                    this.logger.log('拷贝 win32_sim...');
                    this.copyDirectory(sdkWin32Sim, this.buildDir);
                    this.logger.log('win32_sim 拷贝完成');
                }
                else {
                    this.logger.log('win32_sim 已存在，跳过拷贝');
                }
                kconfigSource = path.join(this.sdkPath, 'Kconfig.gui');
                kconfigDest = path.join(this.buildDir, 'Kconfig.gui');
                if (fs.existsSync(kconfigSource)) {
                    fs.copyFileSync(kconfigSource, kconfigDest);
                }
                this.generateConfig();
                this.modifySConstruct();
                this.logger.log('编译目录准备完成');
                return [2 /*return*/];
            });
        });
    };
    BuildCore.prototype.copyGeneratedCode = function () {
        return __awaiter(this, void 0, void 0, function () {
            var srcAutogen, destAutogen;
            return __generator(this, function (_a) {
                this.logger.log('拷贝生成的代码...');
                srcAutogen = path.join(this.projectRoot, 'src', 'autogen');
                destAutogen = path.join(this.buildDir, 'autogen');
                if (fs.existsSync(srcAutogen)) {
                    if (fs.existsSync(destAutogen)) {
                        fs.rmSync(destAutogen, { recursive: true, force: true });
                    }
                    this.copyDirectory(srcAutogen, destAutogen);
                    this.generateAutogenSConscript(destAutogen);
                    this.logger.log('代码拷贝完成');
                }
                else {
                    throw new Error("\u751F\u6210\u7684\u4EE3\u7801\u76EE\u5F55\u4E0D\u5B58\u5728: ".concat(srcAutogen));
                }
                return [2 /*return*/];
            });
        });
    };
    BuildCore.prototype.compile = function () {
        return __awaiter(this, void 0, void 0, function () {
            var _this = this;
            return __generator(this, function (_a) {
                this.logger.log('开始编译...');
                return [2 /*return*/, new Promise(function (resolve, reject) {
                        var _a, _b;
                        var compileProcess = (0, child_process_1.spawn)('scons', ['-j4'], {
                            cwd: _this.buildDir,
                            shell: true
                        });
                        (_a = compileProcess.stdout) === null || _a === void 0 ? void 0 : _a.on('data', function (data) {
                            _this.logger.log(data.toString());
                        });
                        (_b = compileProcess.stderr) === null || _b === void 0 ? void 0 : _b.on('data', function (data) {
                            _this.logger.log(data.toString(), true);
                        });
                        compileProcess.on('exit', function (code) {
                            if (code === 0) {
                                _this.logger.log('编译成功！');
                                resolve();
                            }
                            else {
                                reject(new Error("\u7F16\u8BD1\u5931\u8D25\uFF0C\u9000\u51FA\u7801: ".concat(code)));
                            }
                        });
                        compileProcess.on('error', reject);
                    })];
            });
        });
    };
    BuildCore.prototype.getExecutablePath = function () {
        var exeName = process.platform === 'win32' ? 'gui.exe' : 'gui';
        return path.join(this.buildDir, exeName);
    };
    BuildCore.prototype.generateAutogenSConscript = function (autogenDir) {
        var sconscript = "from building import *\nimport os\n\ncwd = GetCurrentDir()\nsrc = []\nfor root, dirs, files in os.walk(cwd):\n    for f in files:\n        if f.endswith('.c'):\n            src.append(os.path.join(root, f))\n\nCPPPATH = [cwd]\nfor root, dirs, files in os.walk(cwd):\n    CPPPATH.append(root)\n\ngroup = DefineGroup('autogen', src, depend=[''], CPPPATH=CPPPATH)\nReturn('group')\n";
        fs.writeFileSync(path.join(autogenDir, 'SConscript'), sconscript);
        this.logger.log('SConscript 生成完成');
    };
    BuildCore.prototype.generateConfig = function () {
        var configContent = 'CONFIG_REALTEK_HONEYGUI=y\n';
        fs.writeFileSync(path.join(this.buildDir, '.config'), configContent);
    };
    BuildCore.prototype.modifySConstruct = function () {
        var sconstructPath = path.join(this.buildDir, 'SConstruct');
        if (!fs.existsSync(sconstructPath))
            return;
        var content = fs.readFileSync(sconstructPath, 'utf-8');
        var sdkPathNormalized = this.sdkPath.replace(/\\/g, '/');
        content = content.replace(/PROJECT_ROOT\s*=\s*os\.path\.dirname\(os\.getcwd\(\)\)/, "PROJECT_ROOT = '".concat(sdkPathNormalized, "'"));
        fs.writeFileSync(sconstructPath, content);
    };
    BuildCore.prototype.copyDirectory = function (src, dest) {
        if (!fs.existsSync(dest)) {
            fs.mkdirSync(dest, { recursive: true });
        }
        var entries = fs.readdirSync(src, { withFileTypes: true });
        for (var _i = 0, entries_1 = entries; _i < entries_1.length; _i++) {
            var entry = entries_1[_i];
            var srcPath = path.join(src, entry.name);
            var destPath = path.join(dest, entry.name);
            if (entry.isDirectory()) {
                this.copyDirectory(srcPath, destPath);
            }
            else {
                fs.copyFileSync(srcPath, destPath);
            }
        }
    };
    return BuildCore;
}());
exports.BuildCore = BuildCore;
