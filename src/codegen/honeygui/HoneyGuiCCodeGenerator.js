"use strict";
/**
 * HoneyGUI C代码生成器
 * 从组件树生成调用HoneyGUI API的C代码
 */
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
exports.HoneyGuiCCodeGenerator = void 0;
var fs = __importStar(require("fs"));
var path = __importStar(require("path"));
var HoneyGuiApiMapper_1 = require("./HoneyGuiApiMapper");
var HoneyGuiCCodeGenerator = /** @class */ (function () {
    function HoneyGuiCCodeGenerator(components, options) {
        this.apiMapper = new HoneyGuiApiMapper_1.HoneyGuiApiMapper();
        this.components = components;
        this.options = options;
        this.componentMap = new Map(components.map(function (c) { return [c.id, c]; }));
    }
    /**
     * 生成所有代码文件
     */
    HoneyGuiCCodeGenerator.prototype.generate = function () {
        return __awaiter(this, void 0, void 0, function () {
            var files, baseName, headerFile, implFile, callbackHeaderFile, callbackImplFile, existing, merged;
            return __generator(this, function (_a) {
                try {
                    files = [];
                    baseName = this.options.hmlFileName;
                    // 确保输出目录存在
                    if (!fs.existsSync(this.options.outputDir)) {
                        fs.mkdirSync(this.options.outputDir, { recursive: true });
                    }
                    headerFile = path.join(this.options.outputDir, "".concat(baseName, ".h"));
                    fs.writeFileSync(headerFile, this.generateHeader(baseName));
                    files.push(headerFile);
                    implFile = path.join(this.options.outputDir, "".concat(baseName, ".c"));
                    fs.writeFileSync(implFile, this.generateImplementation(baseName));
                    files.push(implFile);
                    callbackHeaderFile = path.join(this.options.outputDir, "".concat(baseName, "_callbacks.h"));
                    callbackImplFile = path.join(this.options.outputDir, "".concat(baseName, "_callbacks.c"));
                    if (!fs.existsSync(callbackHeaderFile)) {
                        fs.writeFileSync(callbackHeaderFile, this.generateCallbackHeader(baseName));
                        files.push(callbackHeaderFile);
                    }
                    if (!fs.existsSync(callbackImplFile)) {
                        fs.writeFileSync(callbackImplFile, this.generateCallbackImplementation(baseName));
                        files.push(callbackImplFile);
                    }
                    else if (this.options.enableProtectedAreas) {
                        existing = fs.readFileSync(callbackImplFile, 'utf-8');
                        merged = this.mergeProtectedAreas(existing, this.generateCallbackImplementation(baseName));
                        fs.writeFileSync(callbackImplFile, merged);
                        files.push(callbackImplFile);
                    }
                    return [2 /*return*/, { success: true, files: files }];
                }
                catch (error) {
                    return [2 /*return*/, {
                            success: false,
                            files: [],
                            errors: [error instanceof Error ? error.message : String(error)]
                        }];
                }
                return [2 /*return*/];
            });
        });
    };
    /**
     * 生成头文件
     */
    HoneyGuiCCodeGenerator.prototype.generateHeader = function (baseName) {
        var guardName = "".concat(baseName.toUpperCase(), "_H");
        var componentTypes = __spreadArray([], new Set(this.components.map(function (c) { return c.type; })), true);
        var headers = this.apiMapper.getRequiredHeaders(componentTypes);
        var hasView = componentTypes.includes('hg_view');
        var code = "#ifndef ".concat(guardName, "\n#define ").concat(guardName, "\n\n#include \"guidef.h\"\n#include \"gui_obj.h\"\n");
        // hg_view 需要额外的头文件
        if (hasView) {
            code += "#include \"gui_components_init.h\"\n";
            code += "#include \"gui_view.h\"\n";
            code += "#include \"gui_view_instance.h\"\n";
        }
        // 包含其他组件的头文件
        headers.forEach(function (header) {
            if (header !== 'gui_view.h') { // gui_view.h 已经包含
                code += "#include \"".concat(header, "\"\n");
            }
        });
        code += "\n// \u7EC4\u4EF6\u53E5\u67C4\u58F0\u660E\n";
        // 声明所有非 view 组件的句柄
        this.components.forEach(function (comp) {
            if (comp.type !== 'hg_view') {
                code += "extern gui_obj_t *".concat(comp.id, ";\n");
            }
        });
        code += "\n#endif // ".concat(guardName, "\n");
        return code;
    };
    /**
     * 生成实现文件
     */
    HoneyGuiCCodeGenerator.prototype.generateImplementation = function (baseName) {
        var _this = this;
        var code = "#include \"".concat(baseName, ".h\"\n#include \"").concat(baseName, "_callbacks.h\"\n#include <stddef.h>\n\n// \u7EC4\u4EF6\u53E5\u67C4\u5B9A\u4E49\n");
        // 定义所有非 view 组件的句柄
        this.components.forEach(function (comp) {
            if (comp.type !== 'hg_view') {
                code += "gui_obj_t *".concat(comp.id, " = NULL;\n");
            }
        });
        code += "\n";
        // 生成组件创建代码（按层级顺序，直接在全局作用域）
        var rootComponents = this.components.filter(function (c) { return c.parent === null; });
        rootComponents.forEach(function (comp) {
            code += _this.generateComponentTree(comp, 0);
        });
        return code;
    };
    /**
     * 递归生成组件树
     */
    HoneyGuiCCodeGenerator.prototype.generateComponentTree = function (component, indent) {
        var _this = this;
        var code = '';
        var indentStr = '    '.repeat(indent);
        // 添加注释
        code += "\n".concat(indentStr, "// \u521B\u5EFA").concat(component.name, " (").concat(component.type, ")\n");
        // 生成创建代码
        code += this.generateComponentCreation(component, indent);
        // hg_view 的子组件已在 switch_in 中处理，不在这里递归
        if (component.type === 'hg_view') {
            return code;
        }
        // 生成属性设置代码
        code += this.generatePropertySetters(component, indent);
        // 生成事件绑定代码
        code += this.generateEventBindings(component, indent);
        // 递归生成子组件
        if (component.children && component.children.length > 0) {
            component.children.forEach(function (childId) {
                var child = _this.componentMap.get(childId);
                if (child) {
                    code += _this.generateComponentTree(child, indent);
                }
            });
        }
        return code;
    };
    /**
     * 生成组件创建代码
     */
    HoneyGuiCCodeGenerator.prototype.generateComponentCreation = function (component, indent) {
        var _a;
        var indentStr = '    '.repeat(indent);
        var mapping = this.apiMapper.getMapping(component.type);
        if (!mapping) {
            return "".concat(indentStr, "// \u8B66\u544A: \u672A\u627E\u5230").concat(component.type, "\u7684API\u6620\u5C04\n");
        }
        // hg_view 使用特殊的生成规则
        if (component.type === 'hg_view') {
            return this.generateViewInstance(component, indent);
        }
        // 确定父组件引用
        var parentRef = 'NULL';
        if (component.parent) {
            var parentComp = this.componentMap.get(component.parent);
            // 如果父组件是 hg_view，使用 NULL（因为 view 没有句柄）
            if (parentComp && parentComp.type !== 'hg_view') {
                parentRef = component.parent;
            }
        }
        var _b = component.position, x = _b.x, y = _b.y, width = _b.width, height = _b.height;
        // 特殊处理图片组件，直接在创建时传入路径
        if (component.type === 'hg_image') {
            var src = ((_a = component.data) === null || _a === void 0 ? void 0 : _a.src) || '';
            // gui_img_create_from_fs(parent, name, file, x, y, w, h)
            return "".concat(indentStr).concat(component.id, " = gui_img_create_from_fs(").concat(parentRef, ", \"").concat(component.name, "\", \"").concat(src, "\", ").concat(x, ", ").concat(y, ", ").concat(width, ", ").concat(height, ");\n");
        }
        return "".concat(indentStr).concat(component.id, " = ").concat(mapping.createFunction, "(").concat(parentRef, ", \"").concat(component.name, "\", ").concat(x, ", ").concat(y, ", ").concat(width, ", ").concat(height, ");\n");
    };
    /**
     * 生成 hg_view 的 GUI_VIEW_INSTANCE 代码
     */
    HoneyGuiCCodeGenerator.prototype.generateViewInstance = function (component, indent) {
        var _this = this;
        var indentStr = '    '.repeat(indent);
        var name = component.name;
        var code = '';
        code += "".concat(indentStr, "static void ").concat(name, "_switch_out(gui_view_t *view)\n");
        code += "".concat(indentStr, "{\n");
        code += "".concat(indentStr, "    GUI_UNUSED(view);\n");
        code += "".concat(indentStr, "}\n\n");
        code += "".concat(indentStr, "static void ").concat(name, "_switch_in(gui_view_t *view)\n");
        code += "".concat(indentStr, "{\n");
        code += "".concat(indentStr, "    GUI_UNUSED(view);\n");
        // 在 switch_in 中创建子组件
        if (component.children && component.children.length > 0) {
            code += "\n";
            component.children.forEach(function (childId) {
                var child = _this.componentMap.get(childId);
                if (child) {
                    code += _this.generateComponentTree(child, indent + 1);
                }
            });
        }
        code += "".concat(indentStr, "}\n");
        code += "".concat(indentStr, "GUI_VIEW_INSTANCE(\"").concat(name, "\", false, ").concat(name, "_switch_in, ").concat(name, "_switch_out);\n");
        return code;
    };
    /**
     * 生成属性设置代码
     */
    HoneyGuiCCodeGenerator.prototype.generatePropertySetters = function (component, indent) {
        var code = '';
        var indentStr = '    '.repeat(indent);
        var mapping = this.apiMapper.getMapping(component.type);
        if (!mapping)
            return code;
        mapping.propertySetters.forEach(function (setter) {
            var value = null;
            // 从style或data中获取值
            if (component.style && setter.property in component.style) {
                value = component.style[setter.property];
            }
            else if (component.data && setter.property in component.data) {
                value = component.data[setter.property];
            }
            if (value !== null && value !== undefined) {
                // 应用值转换
                var transformedValue = setter.valueTransform
                    ? setter.valueTransform(value)
                    : (typeof value === 'string' ? "\"".concat(value, "\"") : value);
                code += "".concat(indentStr).concat(setter.apiFunction, "(").concat(component.id, ", ").concat(transformedValue, ");\n");
            }
        });
        // 可见性
        if (component.visible !== undefined) {
            code += "".concat(indentStr, "gui_obj_show(").concat(component.id, ", ").concat(component.visible ? 'true' : 'false', ");\n");
        }
        return code;
    };
    /**
     * 生成事件绑定代码
     */
    HoneyGuiCCodeGenerator.prototype.generateEventBindings = function (component, indent) {
        var code = '';
        var indentStr = '    '.repeat(indent);
        var mapping = this.apiMapper.getMapping(component.type);
        if (!mapping || !component.events)
            return code;
        mapping.eventHandlers.forEach(function (handler) {
            if (component.events && component.events[handler.event]) {
                var callbackName = component.events[handler.event] || "on_".concat(component.id, "_").concat(handler.event);
                code += "".concat(indentStr).concat(handler.apiFunction, "(").concat(component.id, ", ").concat(callbackName, ");\n");
            }
        });
        return code;
    };
    /**
     * 生成回调头文件
     */
    HoneyGuiCCodeGenerator.prototype.generateCallbackHeader = function (baseName) {
        var guardName = "".concat(baseName.toUpperCase(), "_CALLBACKS_H");
        var code = "#ifndef ".concat(guardName, "\n#define ").concat(guardName, "\n\n#include \"gui_api.h\"\n\n// \u4E8B\u4EF6\u56DE\u8C03\u51FD\u6570\u58F0\u660E\n");
        // 收集所有事件回调
        this.components.forEach(function (comp) {
            if (comp.events) {
                Object.entries(comp.events).forEach(function (_a) {
                    var event = _a[0], callback = _a[1];
                    code += "void ".concat(callback, "(gui_obj_t *obj);\n");
                });
            }
        });
        code += "\n#endif // ".concat(guardName, "\n");
        return code;
    };
    /**
     * 生成回调实现文件
     */
    HoneyGuiCCodeGenerator.prototype.generateCallbackImplementation = function (baseName) {
        var code = "#include \"".concat(baseName, "_callbacks.h\"\n#include <stdio.h>\n\n// \u4E8B\u4EF6\u56DE\u8C03\u51FD\u6570\u5B9E\u73B0\n\n");
        // 为每个事件生成回调函数模板
        this.components.forEach(function (comp) {
            if (comp.events) {
                Object.entries(comp.events).forEach(function (_a) {
                    var event = _a[0], callback = _a[1];
                    code += "/* @protected start ".concat(callback, " */\nvoid ").concat(callback, "(gui_obj_t *obj) {\n    printf(\"").concat(comp.name, " ").concat(event, " triggered\\n\");\n    // TODO: \u5B9E\u73B0\u4E8B\u4EF6\u5904\u7406\u903B\u8F91\n}\n/* @protected end ").concat(callback, " */\n\n");
                });
            }
        });
        code += "/* @protected start custom_functions */\n// \u81EA\u5B9A\u4E49\u51FD\u6570\n/* @protected end custom_functions */\n";
        return code;
    };
    /**
     * 合并保护区代码
     */
    HoneyGuiCCodeGenerator.prototype.mergeProtectedAreas = function (existing, generated) {
        var protectedAreas = new Map();
        // 提取现有文件中的保护区
        var regex = /\/\* @protected start (\w+) \*\/([\s\S]*?)\/\* @protected end \1 \*\//g;
        var match;
        while ((match = regex.exec(existing)) !== null) {
            protectedAreas.set(match[1], match[2]);
        }
        // 替换生成代码中的保护区
        var result = generated;
        protectedAreas.forEach(function (content, id) {
            var pattern = new RegExp("\\/\\* @protected start ".concat(id, " \\*\\/[\\s\\S]*?\\/\\* @protected end ").concat(id, " \\*\\/"), 'g');
            result = result.replace(pattern, "/* @protected start ".concat(id, " */").concat(content, "/* @protected end ").concat(id, " */"));
        });
        return result;
    };
    return HoneyGuiCCodeGenerator;
}());
exports.HoneyGuiCCodeGenerator = HoneyGuiCCodeGenerator;
