/**
 * 用户代码文件生成器
 * 负责生成 user.h 和 user.c 文件（只生成一次）
 */

export class UserFileGenerator {

  /**
   * 生成用户头文件
   */
  generateHeader(baseName: string): string {
    const guardName = `${baseName.toUpperCase()}_USER_H`;
    return `#ifndef ${guardName}
#define ${guardName}

/**
 * 用户自定义头文件
 * 此文件只生成一次，可自由修改
 */

// 在此添加自定义声明

#endif // ${guardName}
`;
  }

  /**
   * 生成用户实现文件
   */
  generateImplementation(baseName: string): string {
    return `#include "${baseName}_user.h"
#include "../ui/${baseName}_ui.h"
#include "../callbacks/${baseName}_callbacks.h"

/**
 * 用户自定义实现
 * 此文件只生成一次，可自由修改
 */

// 在此添加自定义实现
`;
  }
}
