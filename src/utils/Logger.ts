import * as vscode from 'vscode';

/**
 * HoneyGUI日志管理器
 * 提供统一的日志记录接口
 */
export class Logger {
    private outputChannel: vscode.LogOutputChannel;
    private logLevel: 'debug' | 'info' | 'warn' | 'error' = 'info';
    private cachedLogs: string[] = [];

    constructor(name: string = 'HoneyGUI') {
        this.outputChannel = vscode.window.createOutputChannel(name, { log: true });
    }

    private formatMessage(level: string, message: string): string {
        const timestamp = new Date().toISOString().replace('T', ' ').substring(0, 19);
        return `[${timestamp}] [${level.toUpperCase()}] ${message}`;
    }

    private cacheAndLog(level: string, formatted: string): void {
        this.cachedLogs.push(formatted);
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

    private shouldLog(level: string): boolean {
        const levels = ['debug', 'info', 'warn', 'error'];
        const currentLevelIndex = levels.indexOf(this.logLevel);
        const messageLevelIndex = levels.indexOf(level);
        return messageLevelIndex >= currentLevelIndex;
    }

    debug(message: string): void {
        if (this.shouldLog('debug')) {
            const formatted = this.formatMessage('debug', message);
            this.cacheAndLog('debug', formatted);
        }
    }

    info(message: string): void {
        if (this.shouldLog('info')) {
            const formatted = this.formatMessage('info', message);
            this.cacheAndLog('info', formatted);
        }
    }

    warn(message: string): void {
        if (this.shouldLog('warn')) {
            const formatted = this.formatMessage('warn', message);
            this.cacheAndLog('warn', formatted);
        }
    }

    error(message: string): void {
        if (this.shouldLog('error')) {
            const formatted = this.formatMessage('error', message);
            this.cacheAndLog('error', formatted);
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