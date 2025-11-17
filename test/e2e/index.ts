import * as path from 'path';
import { glob } from 'glob';

declare const require: any;

export function run(): Promise<void> {
  // 动态导入Mocha，避免TypeScript类型检查问题
  const Mocha = require('mocha');

  // 创建Mocha实例
  const mocha = new Mocha({
    ui: 'bdd',
    color: true,
    timeout: 30000 // 给予足够的超时时间
  });

  const testsRoot = path.resolve(__dirname, '.');

  return new Promise((c, e) => {
    // 查找所有测试文件
    glob('**/**.test.js', { cwd: testsRoot })
      .then((files: string[]) => {
        // 添加测试文件到Mocha
        files.forEach((f: string) => mocha.addFile(path.resolve(testsRoot, f)));

        try {
          // 运行测试
          mocha.run((failures: number) => {
            if (failures > 0) {
              e(new Error(`${failures} tests failed.`));
            } else {
              c();
            }
          });
        } catch (err: any) {
          console.error(err);
          e(err);
        }
      })
      .catch((err: any) => {
        e(err);
      });
  });
}
