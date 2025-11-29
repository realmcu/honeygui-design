
// Dynamic import for vscode to support running in CLI/Node.js environment
let vscode: any;
try {
    vscode = require('vscode');
} catch (e) {
    // Ignore - running in non-VSCode environment
}

/**
 * HoneyGUI日志管理器
 * 提供统一的日志记录接口
 */
export class Logger {
    private outputChannel: any;
    private logLevel: 'debug' | 'info' | 'warn' | 'error' = 'info';
    private cachedLogs: string[] = [];

    // 日志缓存最大条目数，防止内存泄漏
    private readonly MAX_LOG_ENTRIES = 5000;

    constructor(name: string = 'HoneyGUI') {
        if (vscode && vscode.window) {
            this.outputChannel = vscode.window.createOutputChannel(name, { log: true });
        } else {
            // Fallback implementation for CLI
            this.outputChannel = {
                debug: (msg: string) => console.debug(msg),
                info: (msg: string) => console.info(msg),
                warn: (msg: string) => console.warn(msg),
                error: (msg: string) => console.error(msg),
                show: () => {}
            };
        }
    }

    private formatMessage(level: string, message: string): string {
        const timestamp = new Date().toISOString().replace('T', ' ').substring(0, 19);
        return `[${timestamp}] [${level.toUpperCase()}] ${message}`;
    }

    private cacheAndLog(level: string, message: string, formatted: string): void {
        // 检查缓存是否超过最大限制，如果超过删除最旧的日志
        if (this.cachedLogs.length >= this.MAX_LOG_ENTRIES) {
            // 移除最旧的20%日志，避免每次删除单个元素带来的性能开销
            const removeCount = Math.floor(this.MAX_LOG_ENTRIES * 0.2);
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
        } else {
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
    }

    private shouldLog(level: string): boolean {
        const levels = ['debug', 'info', 'warn', 'error'];
        const currentLevelIndex = levels.indexOf(this.logLevel);
        const messageLevelIndex = levels.indexOf(level);
        return messageLevelIndex >= currentLevelIndex;
    }

    debug(message: string): void {
        if (this.shouldLog('debug')) {
            const formatted = this.formatMessage('debug', message);
            this.cacheAndLog('debug', message, formatted);
        }
    }

    info(message: string): void {
        if (this.shouldLog('info')) {
            const formatted = this.formatMessage('info', message);
            this.cacheAndLog('info', message, formatted);
        }
    }

    warn(message: string): void {
        if (this.shouldLog('warn')) {
            const formatted = this.formatMessage('warn', message);
            this.cacheAndLog('warn', message, formatted);
        }
    }

    error(message: string): void {
        if (this.shouldLog('error')) {
            const formatted = this.formatMessage('error', message);
            this.cacheAndLog('error', message, formatted);
        }
    }

    setLogLevel(level: 'debug' | 'info' | 'warn' | 'error'): void {
        this.logLevel = level;
    }

    getCachedLogs(): string[] {
        return [...this.cachedLogs];
    }

    clearCache(): void {
        this.cachedLogs = [];
    }

    show(): void {
        this.outputChannel.show();
    }
}

// 全局日志实例
export const logger = new Logger();
