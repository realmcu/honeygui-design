/**
 * 配置管理器
 * 统一管理HoneyGUI插件的所有配置项
 */

import * as vscode from 'vscode';

/**
 * HoneyGUI配置接口
 */
export interface HoneyGuiConfig {
  codegen: {
    language: 'cpp' | 'c';
    outputDir: string;
    cppVersion: string;
    enableDebugInfo: boolean;
  };
  hml: {
    outputDir: string;
  };
  preview: {
    runnerPath: string;
    autoDownload: boolean;
    timeoutMs: number;
    autoReload: boolean;
  };
  ui: {
    gridSize: number;
    snapToGrid: boolean;
  };
  codeGeneration: {
    outputPath: string;
    cppVersion: string;
    enableDebugInfo: boolean;
  };
  telemetry: {
    enabled: boolean;
  };
}

/**
 * 配置变更事件
 */
export interface ConfigChangeEvent {
  key: string;
  oldValue: any;
  newValue: any;
}

/**
 * 配置管理器类
 */
export class ConfigManager {
  private static readonly CONFIG_NAMESPACE = 'honeygui';
  private static instance: ConfigManager;
  private changeEmitter = new vscode.EventEmitter<ConfigChangeEvent>();
  private disposables: vscode.Disposable[] = [];

  private constructor() {
    // 监听配置变更
    this.disposables.push(
      vscode.workspace.onDidChangeConfiguration(e => {
        if (e.affectsConfiguration(ConfigManager.CONFIG_NAMESPACE)) {
          this.handleConfigChange(e);
        }
      })
    );
  }

  /**
   * 获取单例实例
   */
  static getInstance(): ConfigManager {
    if (!ConfigManager.instance) {
      ConfigManager.instance = new ConfigManager();
    }
    return ConfigManager.instance;
  }

  /**
   * 获取配置项
   */
  get<T = any>(key: string, defaultValue?: T): T {
    const config = vscode.workspace.getConfiguration(ConfigManager.CONFIG_NAMESPACE);
    return config.get<T>(key, defaultValue as T);
  }

  /**
   * 设置配置项
   */
  async set<T = any>(
    key: string,
    value: T,
    target: vscode.ConfigurationTarget = vscode.ConfigurationTarget.Global
  ): Promise<void> {
    const config = vscode.workspace.getConfiguration(ConfigManager.CONFIG_NAMESPACE);
    await config.update(key, value, target);
  }

  /**
   * 获取所有配置
   */
  getAll(): HoneyGuiConfig {
    const config = vscode.workspace.getConfiguration(ConfigManager.CONFIG_NAMESPACE);
    
    return {
      codegen: {
        language: config.get('codegen.language', 'cpp'),
        outputDir: config.get('codegen.outputDir', 'src/ui'),
        cppVersion: config.get('codeGeneration.cppVersion', 'c++17'),
        enableDebugInfo: config.get('codeGeneration.enableDebugInfo', true)
      },
      hml: {
        outputDir: config.get('hml.outputDir', 'ui')
      },
      preview: {
        runnerPath: config.get('preview.runnerPath', ''),
        autoDownload: config.get('preview.autoDownload', false),
        timeoutMs: config.get('preview.timeoutMs', 10000),
        autoReload: config.get('preview.autoReload', true)
      },
      ui: {
        gridSize: config.get('ui.gridSize', 8),
        snapToGrid: config.get('ui.snapToGrid', true)
      },
      codeGeneration: {
        outputPath: config.get('codeGeneration.outputPath', 'src'),
        cppVersion: config.get('codeGeneration.cppVersion', 'c++17'),
        enableDebugInfo: config.get('codeGeneration.enableDebugInfo', true)
      },
      telemetry: {
        enabled: config.get('telemetry.enabled', true)
      }
    };
  }

  /**
   * 重置配置到默认值
   */
  async reset(key?: string): Promise<void> {
    const config = vscode.workspace.getConfiguration(ConfigManager.CONFIG_NAMESPACE);
    
    if (key) {
      await config.update(key, undefined, vscode.ConfigurationTarget.Global);
    } else {
      // 重置所有配置
      const allKeys = [
        'codegen.language',
        'codegen.outputDir',
        'hml.outputDir',
        'preview.runnerPath',
        'preview.autoDownload',
        'preview.timeoutMs',
        'preview.autoReload',
        'ui.gridSize',
        'ui.snapToGrid',
        'codeGeneration.outputPath',
        'codeGeneration.cppVersion',
        'codeGeneration.enableDebugInfo',
        'telemetry.enabled'
      ];

      for (const k of allKeys) {
        await config.update(k, undefined, vscode.ConfigurationTarget.Global);
      }
    }
  }

  /**
   * 检查配置项是否存在
   */
  has(key: string): boolean {
    const config = vscode.workspace.getConfiguration(ConfigManager.CONFIG_NAMESPACE);
    return config.has(key);
  }

  /**
   * 监听配置变更
   */
  onDidChange(callback: (event: ConfigChangeEvent) => void): vscode.Disposable {
    return this.changeEmitter.event(callback);
  }

  /**
   * 处理配置变更
   */
  private handleConfigChange(e: vscode.ConfigurationChangeEvent): void {
    const config = vscode.workspace.getConfiguration(ConfigManager.CONFIG_NAMESPACE);
    const keys = this.getAllConfigKeys();

    keys.forEach(key => {
      const fullKey = `${ConfigManager.CONFIG_NAMESPACE}.${key}`;
      if (e.affectsConfiguration(fullKey)) {
        const newValue = config.get(key);
        this.changeEmitter.fire({
          key,
          oldValue: undefined, // VSCode API不提供旧值
          newValue
        });
      }
    });
  }

  /**
   * 获取所有配置键
   */
  private getAllConfigKeys(): string[] {
    return [
      'codegen.language',
      'codegen.outputDir',
      'hml.outputDir',
      'preview.runnerPath',
      'preview.autoDownload',
      'preview.timeoutMs',
      'preview.autoReload',
      'ui.gridSize',
      'ui.snapToGrid',
      'codeGeneration.outputPath',
      'codeGeneration.cppVersion',
      'codeGeneration.enableDebugInfo',
      'telemetry.enabled'
    ];
  }

  /**
   * 验证配置
   */
  validate(): { valid: boolean; errors: string[] } {
    const errors: string[] = [];
    const config = this.getAll();

    // 验证代码生成配置
    if (!['cpp', 'c'].includes(config.codegen.language)) {
      errors.push(`Invalid codegen.language: ${config.codegen.language}`);
    }

    // 验证网格大小
    if (config.ui.gridSize < 1 || config.ui.gridSize > 100) {
      errors.push(`Invalid ui.gridSize: ${config.ui.gridSize} (must be 1-100)`);
    }

    // 验证超时时间
    if (config.preview.timeoutMs < 1000 || config.preview.timeoutMs > 60000) {
      errors.push(`Invalid preview.timeoutMs: ${config.preview.timeoutMs} (must be 1000-60000)`);
    }

    return {
      valid: errors.length === 0,
      errors
    };
  }

  /**
   * 导出配置到JSON
   */
  exportToJson(): string {
    return JSON.stringify(this.getAll(), null, 2);
  }

  /**
   * 从JSON导入配置
   */
  async importFromJson(json: string): Promise<void> {
    try {
      const config = JSON.parse(json) as Partial<HoneyGuiConfig>;
      
      // 逐项设置配置
      if (config.codegen) {
        await this.set('codegen.language', config.codegen.language);
        await this.set('codegen.outputDir', config.codegen.outputDir);
      }
      
      if (config.hml) {
        await this.set('hml.outputDir', config.hml.outputDir);
      }
      
      if (config.preview) {
        await this.set('preview.runnerPath', config.preview.runnerPath);
        await this.set('preview.autoDownload', config.preview.autoDownload);
        await this.set('preview.timeoutMs', config.preview.timeoutMs);
        await this.set('preview.autoReload', config.preview.autoReload);
      }
      
      if (config.ui) {
        await this.set('ui.gridSize', config.ui.gridSize);
        await this.set('ui.snapToGrid', config.ui.snapToGrid);
      }
      
      if (config.codeGeneration) {
        await this.set('codeGeneration.outputPath', config.codeGeneration.outputPath);
        await this.set('codeGeneration.cppVersion', config.codeGeneration.cppVersion);
        await this.set('codeGeneration.enableDebugInfo', config.codeGeneration.enableDebugInfo);
      }
      
      if (config.telemetry) {
        await this.set('telemetry.enabled', config.telemetry.enabled);
      }
      
    } catch (error) {
      throw new Error(`Failed to import config: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * 清理资源
   */
  dispose(): void {
    this.disposables.forEach(d => d.dispose());
    this.changeEmitter.dispose();
  }
}

/**
 * 便捷函数：获取配置管理器实例
 */
export function getConfig(): ConfigManager {
  return ConfigManager.getInstance();
}

/**
 * 便捷函数：获取配置项
 */
export function get<T = any>(key: string, defaultValue?: T): T {
  return ConfigManager.getInstance().get(key, defaultValue);
}

/**
 * 便捷函数：设置配置项
 */
export function set<T = any>(key: string, value: T): Promise<void> {
  return ConfigManager.getInstance().set(key, value);
}
