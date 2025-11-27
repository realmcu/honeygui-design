/**
 * 运行器状态定义
 */
export interface RunnerStatus {
    isRunning: boolean;
    currentFile?: string;
    error?: string;
}

/**
 * 运行器事件监听器
 */
export interface RunnerListener {
    onStart?: () => void;
    onSuccess?: () => void;
    onError?: (error: Error) => void;
    onExit?: (code: number | null) => void;
    onLog?: (message: string) => void;
}
