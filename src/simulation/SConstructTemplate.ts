/**
 * SConstruct 模板生成器
 * 将仿真构建脚本独立成可维护的模板，便于后续调整。
 */

export interface SConstructOptions {
    libSim: string;                    // 插件内置 lib/sim 绝对路径（正斜杠）
    projectSrc: string;                // 项目 src 目录绝对路径（正斜杠）
    lcd: { width: number; height: number; cornerRadius: number; pixelBits: number };
    platform: 'win32' | 'linux';       // 当前平台，用于选择静态库目录
}

/**
 * 生成 SConstruct 文件内容
 */
export function buildSConstruct(opts: SConstructOptions): string {
    const { libSim, projectSrc, lcd, platform } = opts;

    const includeDir = `${libSim}/include`;
    const libDir = `${libSim}/${platform}`;
    
    // Linux 使用系统 SDL2，Windows 使用内置静态库
    const sdl2Setup = platform === 'linux' 
        ? `# Linux: 使用系统 SDL2
import subprocess
sdl2_cflags = subprocess.check_output(['sdl2-config', '--cflags']).decode().strip()
sdl2_libs = subprocess.check_output(['sdl2-config', '--libs']).decode().strip()`
        : `# Windows: 使用内置 SDL2 静态库
sdl2_inc1 = '${libSim}/SDL2-2.26.0-STATIC/include'
sdl2_inc2 = '${libSim}/SDL2-2.26.0-STATIC/include/SDL2'
sdl2_libdir = '${libSim}/SDL2-2.26.0-STATIC/lib'`;

    // CFLAGS 拼接
    const cflags = platform === 'linux'
        ? `menu_config.CFLAGS + ' -DDRV_LCD_WIDTH=${lcd.width} -DDRV_LCD_HEIGHT=${lcd.height} -DDRV_LCD_CORNER_RADIUS=${lcd.cornerRadius} -DDRV_PIXEL_BITS=${lcd.pixelBits} -I${includeDir}' + ' ' + sdl2_cflags`
        : `menu_config.CFLAGS + ' -DDRV_LCD_WIDTH=${lcd.width} -DDRV_LCD_HEIGHT=${lcd.height} -DDRV_LCD_CORNER_RADIUS=${lcd.cornerRadius} -DDRV_PIXEL_BITS=${lcd.pixelBits} -I${includeDir} -I' + sdl2_inc1 + ' -I' + sdl2_inc2`;

    const cpppath = platform === 'linux'
        ? `env.AppendUnique(CPPPATH=['${includeDir}'])`
        : `env.AppendUnique(CPPPATH=['${includeDir}', sdl2_inc1, sdl2_inc2])`;

    const libpath = platform === 'linux'
        ? `env.AppendUnique(LIBPATH=['${libDir}'])`
        : `env.AppendUnique(LIBPATH=['${libDir}', sdl2_libdir])`;

    const libs = platform === 'linux'
        ? `env.AppendUnique(LIBS=['gui', 'SDL2', 'GL', 'pthread', 'm', 'dl', 'stdc++'])`
        : `env.AppendUnique(LIBS=['mingw32', 'gui', 'SDL2main', 'SDL2', 'opengl32', 'gdi32', 'user32', 'winmm', 'imm32', 'ole32', 'oleaut32', 'version', 'uuid', 'advapi32', 'setupapi', 'shell32', 'dinput8', 'm'])`;

    return (
`import os
import sys
import menu_config
from SCons.Script import *

# 固定到插件内置的 lib/sim
PROJECT_ROOT = '${libSim}'
TOOL_ROOT = os.path.join(PROJECT_ROOT, 'tool/scons-tool')

sys.path.append(TOOL_ROOT)
from building import *

TARGET = 'gui.exe' if sys.platform == 'win32' else 'gui'

${sdl2Setup}

# 构建环境参数
env_params = {
    'CC': menu_config.CC,
    'CFLAGS': ${cflags},
    'CXX': menu_config.CXX,
    'CXXFLAGS': menu_config.CXXFLAGS,
    'LINKFLAGS': menu_config.LFLAGS
}

if sys.platform == 'win32':
    env = Environment(tools=['mingw'], **env_params)
    env['LINK'] = 'g++'
    env['SHLINK'] = 'g++'
else:
    env = Environment(tools=['default'], PROGSUFFIX='', **env_params)
    env['LINK'] = 'g++'

# PC 仿真宏
env.Append(CPPDEFINES=['_HONEYGUI_SIMULATOR_'])

# 头文件与库路径
${cpppath}
${libpath}

# 系统库
${libs}

# 准备环境（会自动编译当前目录的 SConscript）
objs = PrepareBuilding(env, TOOL_ROOT, has_libcpu=False)

# 编译项目代码
PROJECT_SRC = '${projectSrc}'
if os.path.exists(os.path.join(PROJECT_SRC, 'SConscript')):
    objs.extend(SConscript(os.path.join(PROJECT_SRC, 'SConscript')))

DoBuilding(TARGET, objs)
`);
}
