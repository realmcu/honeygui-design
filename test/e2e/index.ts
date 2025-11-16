import * as path from 'path';
import * as Mocha from 'mocha';
import * as glob from 'glob';

export function run(): Promise<void> {
  // 创建Mocha实例
  const mocha = new Mocha({
    ui: 'bdd',
    color: true,
    timeout: 30000 // 给予足够的超时时间
  });

  const testsRoot = path.resolve(__dirname, '.');

  return new Promise((c, e) => {
    // 查找所有测试文件
    glob('**/**.test.js', { cwd: testsRoot }, (err, files) => {
      if (err) {
        return e(err);
      }

      // 添加测试文件到Mocha
      files.forEach(f => mocha.addFile(path.resolve(testsRoot, f)));

      try {
        // 运行测试
        mocha.run(failures => {
          if (failures > 0) {
            e(new Error(`${failures} tests failed.`));
          } else {
            c();
          }
        });
      } catch (err) {
        console.error(err);
        e(err);
      }
    });
  });
}
