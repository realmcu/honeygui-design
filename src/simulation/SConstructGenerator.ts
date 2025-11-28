import * as path from 'path';

/**
 * SConstruct 生成器配置
 */
export interface SConstructConfig {
    sdkPath: string;
    buildDir: string;
    projectName: string;
}

/**
 * SConstruct 编译脚本生成器
 */
export class SConstructGenerator {
    /**
     * 生成 SConstruct 文件内容
     */
    generate(config: SConstructConfig): string {
        const { sdkPath, buildDir, projectName } = config;

        return `import os
import sys

# HoneyGUI SDK 路径
HONEYGUI_SDK = '${sdkPath.replace(/\\/g, '/')}'

# 项目路径
PROJECT_PATH = os.getcwd()

# 添加 HoneyGUI 工具路径
sys.path.append(os.path.join(HONEYGUI_SDK, 'tool/scons-tool'))

# 导入 HoneyGUI 构建工具
try:
    from building import *
except ImportError:
    print("错误: 无法导入 HoneyGUI 构建工具")
    print("请检查 SDK 路径是否正确: " + HONEYGUI_SDK)
    Exit(1)

# 环境配置
env = Environment()

# 设置编译器
env['CC'] = 'gcc'
env['CXX'] = 'g++'

# 编译标志
env.Append(CFLAGS=['-std=c99', '-O2', '-g'])
env.Append(CPPPATH=[
    os.path.join(HONEYGUI_SDK, 'realgui'),
    os.path.join(HONEYGUI_SDK, 'realgui/server'),
    os.path.join(HONEYGUI_SDK, 'realgui/widget'),
    os.path.join(HONEYGUI_SDK, 'realgui/engine'),
    os.path.join(HONEYGUI_SDK, 'realgui/core'),
    os.path.join(HONEYGUI_SDK, 'win32_sim/port'),
    os.path.join(PROJECT_PATH, 'src'),
])

# 链接库配置
if sys.platform == 'win32':
    # Windows (MinGW)
    SDL2_LIB_PATH = os.path.join(HONEYGUI_SDK, 'win32_sim/RTE/SDL2-2.26.0/x86_64-w64-mingw32/lib')
    env.Append(LIBPATH=[SDL2_LIB_PATH])
    env.Append(LIBS=['SDL2main', 'SDL2', 'opengl32', 'mingw32'])
else:
    # Linux
    env.Append(LIBS=['SDL2', 'GL', 'm', 'pthread'])

# 收集源文件
# 1. HoneyGUI SDK 源文件
honeygui_src = []
for root, dirs, files in os.walk(os.path.join(HONEYGUI_SDK, 'realgui')):
    for file in files:
        if file.endswith('.c'):
            honeygui_src.append(os.path.join(root, file))

# 2. 模拟器入口和适配层
sim_src = []
sim_src.append(os.path.join(HONEYGUI_SDK, 'win32_sim/main.c'))
for root, dirs, files in os.walk(os.path.join(HONEYGUI_SDK, 'win32_sim/port')):
    for file in files:
        if file.endswith('.c'):
            sim_src.append(os.path.join(root, file))

# 3. 用户生成的代码
user_src = []
for root, dirs, files in os.walk(os.path.join(PROJECT_PATH, 'src')):
    for file in files:
        if file.endswith('.c'):
            user_src.append(os.path.join(root, file))

# 合并所有源文件
all_src = sim_src + honeygui_src + user_src

# 构建可执行文件
target = os.path.join('build', 'gui')
env.Program(target, all_src)

print("编译配置:")
print("  SDK 路径: " + HONEYGUI_SDK)
print("  源文件数: " + str(len(all_src)))
print("  输出文件: " + target)
`;
    }
}
