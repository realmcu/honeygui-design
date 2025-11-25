/**
 * 调试日志工具
 * 通过环境变量控制是否输出日志
 */

const DEBUG = process.env.NODE_ENV === 'development';

export const logger = {
  drop: (...args: any[]) => {
    if (DEBUG) {
      console.log('[拖放]', ...args);
    }
  },
  
  info: (...args: any[]) => {
    if (DEBUG) {
      console.info(...args);
    }
  },
  
  warn: (...args: any[]) => {
    console.warn(...args);
  },
  
  error: (...args: any[]) => {
    console.error(...args);
  },
};
