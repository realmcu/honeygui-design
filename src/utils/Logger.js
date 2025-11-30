"use strict";
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
exports.logger = exports.Logger = void 0;
// Dynamic import for vscode to support running in CLI/Node.js environment
var vscode;
try {
    vscode = require('vscode');
}
catch (e) {
    // Ignore - running in non-VSCode environment
}
/**
 * HoneyGUI日志管理器
 * 提供统一的日志记录接口
 */
var Logger = /** @class */ (function () {
    function Logger(name) {
        if (name === void 0) { name = 'HoneyGUI'; }
        this.logLevel = 'info';
        this.cachedLogs = [];
        // 日志缓存最大条目数，防止内存泄漏
        this.MAX_LOG_ENTRIES = 5000;
        if (vscode && vscode.window) {
            this.outputChannel = vscode.window.createOutputChannel(name, { log: true });
        }
        else {
            // Fallback implementation for CLI
            this.outputChannel = {
                debug: function (msg) { return console.debug(msg); },
                info: function (msg) { return console.info(msg); },
                warn: function (msg) { return console.warn(msg); },
                error: function (msg) { return console.error(msg); },
                show: function () { }
            };
        }
    }
    Logger.prototype.formatMessage = function (level, message) {
        var timestamp = new Date().toISOString().replace('T', ' ').substring(0, 19);
        return "[".concat(timestamp, "] [").concat(level.toUpperCase(), "] ").concat(message);
    };
    Logger.prototype.cacheAndLog = function (level, message, formatted) {
        // 检查缓存是否超过最大限制，如果超过删除最旧的日志
        if (this.cachedLogs.length >= this.MAX_LOG_ENTRIES) {
            // 移除最旧的20%日志，避免每次删除单个元素带来的性能开销
            var removeCount = Math.floor(this.MAX_LOG_ENTRIES * 0.2);
            this.cachedLogs.splice(0, removeCount);
        }
        // 缓存使用格式化版本（包含时间戳）
        this.cachedLogs.push(formatted);
        if (vscode) {
            // 输出到VSCode使用原始消息（VSCode LogOutputChannel会自动添加时间戳）
            switch (level) {
                case 'debug':
                    this.outputChannel.debug(message);
                    break;
                case 'info':
                    this.outputChannel.info(message);
                    break;
                case 'warn':
                    this.outputChannel.warn(message);
                    break;
                case 'error':
                    this.outputChannel.error(message);
                    break;
            }
        }
        else {
            // CLI environment: use formatted message
            switch (level) {
                case 'debug':
                    this.outputChannel.debug(formatted);
                    break;
                case 'info':
                    this.outputChannel.info(formatted);
                    break;
                case 'warn':
                    this.outputChannel.warn(formatted);
                    break;
                case 'error':
                    this.outputChannel.error(formatted);
                    break;
            }
        }
    };
    Logger.prototype.shouldLog = function (level) {
        var levels = ['debug', 'info', 'warn', 'error'];
        var currentLevelIndex = levels.indexOf(this.logLevel);
        var messageLevelIndex = levels.indexOf(level);
        return messageLevelIndex >= currentLevelIndex;
    };
    Logger.prototype.debug = function (message) {
        if (this.shouldLog('debug')) {
            var formatted = this.formatMessage('debug', message);
            this.cacheAndLog('debug', message, formatted);
        }
    };
    Logger.prototype.info = function (message) {
        if (this.shouldLog('info')) {
            var formatted = this.formatMessage('info', message);
            this.cacheAndLog('info', message, formatted);
        }
    };
    Logger.prototype.warn = function (message) {
        if (this.shouldLog('warn')) {
            var formatted = this.formatMessage('warn', message);
            this.cacheAndLog('warn', message, formatted);
        }
    };
    Logger.prototype.error = function (message) {
        if (this.shouldLog('error')) {
            var formatted = this.formatMessage('error', message);
            this.cacheAndLog('error', message, formatted);
        }
    };
    Logger.prototype.setLogLevel = function (level) {
        this.logLevel = level;
    };
    Logger.prototype.getCachedLogs = function () {
        return __spreadArray([], this.cachedLogs, true);
    };
    Logger.prototype.clearCache = function () {
        this.cachedLogs = [];
    };
    Logger.prototype.show = function () {
        this.outputChannel.show();
    };
    return Logger;
}());
exports.Logger = Logger;
// 全局日志实例
exports.logger = new Logger();
