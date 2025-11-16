import * as vscode from 'vscode';

/**
 * HoneyGUI 扩展日志记录器
 * 提供输出通道日志、文件日志和控制台日志的集中式日志管理
 */
export class LoggerOutputChannel {
    private static instance: LoggerOutputChannel;
    private outputChannel: vscode.OutputChannel;
    private logLevel: 'debug' | 'info' | 'warn' | 'error' = 'debug';
    private isDebugMode: boolean;

    private constructor() {
        this.outputChannel = vscode.window.createOutputChannel('HoneyGUI Design', { log: true });
        this.isDebugMode = process.env.HONEYGUI_DEBUG === 'true';

        this.info('HoneyGUI 日志系统初始化完成');
        if (this.isDebugMode) {
            this.warn('当前处于调试模式，详细日志已启用');
        }
    }

    public static getInstance(): LoggerOutputChannel {
        if (!LoggerOutputChannel.instance) {
            LoggerOutputChannel.instance = new LoggerOutputChannel();
        }
        return LoggerOutputChannel.instance;
    }

    /**
     * 设置日志级别
     */
    public setLogLevel(level: 'debug' | 'info' | 'warn' | 'error'): void {
        this.logLevel = level;
        this.info(`日志级别已设置为: ${level}`);
    }

    /**
     * 切换调试模式
     */
    public setDebugMode(enabled: boolean): void {
        this.isDebugMode = enabled;
        this.info(`调试模式已${enabled ? '启用' : '禁用'}`);
    }

    /**
     * 检查是否应该记录该级别的日志
     */
    private shouldLog(level: 'debug' | 'info' | 'warn' | 'error'): boolean {
        const levels = ['debug', 'info', 'warn', 'error'];
        return levels.indexOf(level) >= levels.indexOf(this.logLevel);
    }

    /**
     * 格式化日志消息
     */
    private formatMessage(level: string, message: string, data?: any): string {
        const timestamp = new Date().toISOString().substr(11, 12); // HH:MM:SS.ms
        const prefix = `[${timestamp}] [${level.toUpperCase()}]`;

        let formatted = `${prefix} ${message}`;

        if (data !== undefined) {
            if (data instanceof Error) {
                formatted += `\n${prefix} Error: ${data.message}\n${prefix} Stack: ${data.stack}`;
            } else if (typeof data === 'object') {
                try {
                    const dataStr = JSON.stringify(data, null, 2);
                    // 只显示前500个字符，避免日志过长
                    const truncated = dataStr.length > 500 ? dataStr.substring(0, 500) + '...' : dataStr;
                    formatted += `\n${prefix} Data: ${truncated}`;
                } catch (e) {
                    formatted += `\n${prefix} Data: [无法序列化对象]`;
                }
            } else {
                formatted += `\n${prefix} Data: ${String(data)}`;
            }
        }

        return formatted;
    }

    private log(level: 'debug' | 'info' | 'warn' | 'error', message: string, data?: any): void {
        if (!this.shouldLog(level)) {
            return;
        }

        const formattedMessage = this.formatMessage(level, message, data);

        // 输出到输出通道
        switch (level) {
            case 'debug':
                this.outputChannel.debug(formattedMessage);
                break;
            case 'info':
                this.outputChannel.info(formattedMessage);
                break;
            case 'warn':
                this.outputChannel.warn(formattedMessage);
                break;
            case 'error':
                this.outputChannel.error(formattedMessage);
                break;
        }

        // 调试模式下也输出到控制台
        if (this.isDebugMode) {
            const consoleMethod = level === 'debug' ? 'log' : level;
            // 添加彩色输出
            const colorPrefix = {
                debug: '\x1b[36m[DEBUG]\x1b[0m',  // 青色
                info: '\x1b[32m[INFO]\x1b[0m',   // 绿色
                warn: '\x1b[33m[WARN]\x1b[0m',   // 黄色
                error: '\x1b[31m[ERROR]\x1b[0m'  // 红色
            }[level];

            // 清理 ANSI 转义序列再发送到控制台
            const cleanMessage = formattedMessage.replace(/\x1b\[\d+m/g, '');
            // 减少重复的时间戳
            const simplified = cleanMessage.replace(/^\[\d{2}:\d{2}:\d{2}\.\d{3}\] \[\w+\]\s*/g, '');

            // 简化后的输出
            if (data) {
                console[consoleMethod](`${colorPrefix} ${message}`, data instanceof Error ? data.message : data);
            } else {
                console[consoleMethod](`${colorPrefix} ${message}`);
            }
        }
    }

    public debug(message: string, data?: any): void {
        this.log('debug', message, data);
    }

    public info(message: string, data?: any): void {
        this.log('info', message, data);
    }

    public warn(message: string, data?: any): void {
        this.log('warn', message, data);
    }

    public error(message: string, data?: any): void {
        this.log('error', message, data);
    }

    /**
     * 显示输出通道（显示日志面板）
     */
    public show(): void {
        this.outputChannel.show(true);
    }

    /**
     * 清空日志
     */
    public clear(): void {
        this.outputChannel.clear();
        this.info('日志已清空');
    }

    /**
     * 将当前日志内容复制到剪贴板
     */
    public async copyToClipboard(): Promise<void> {
        try {
            const content = this.getAllContent();
            await vscode.env.clipboard.writeText(content);
            vscode.window.showInformationMessage('HoneyGUI 日志已复制到剪贴板');
        } catch (error) {
            this.error('复制日志到剪贴板失败', error);
            vscode.window.showErrorMessage('复制日志失败: ' + (error as Error).message);
        }
    }

    /**
     * 获取所有日志内容（用于复制或导出）
     */
    private getAllContent(): string {
        return this.outputChannel['value'] || '';
    }

    /**
     * 导出日志到文件
     */
    public async exportToFile(filePath?: string): Promise<void> {
        const content = this.getAllContent();

        if (!filePath) {
            const defaultPath = `honeygui-log-${new Date().toISOString().replace(/[:.]/g, '-')}.txt`;
            const uri = await vscode.window.showSaveDialog({
                defaultUri: vscode.Uri.file(defaultPath),
                filters: {
                    'Text Files': ['txt'],
                    'Log Files': ['log'],
                    'All Files': ['*']
                },
                title: '导出 HoneyGUI 日志'
            });

            if (!uri) {
                return; // 用户取消
            }

            filePath = uri.fsPath;
        }

        try {
            const fs = require('fs');
            fs.writeFileSync(filePath, content, 'utf8');
            vscode.window.showInformationMessage(`日志已导出到: ${filePath}`);
        } catch (error) {
            this.error('导出日志失败', error);
            vscode.window.showErrorMessage('导出日志失败: ' + (error as Error).message);
        }
    }
}

/**
 * 全局日志记录器实例
 */
export const logger = LoggerOutputChannel.getInstance();
