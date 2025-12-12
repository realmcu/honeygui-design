import * as fs from 'fs';
import * as path from 'path';
import { RotaryTemplate } from '../../src/template/templates/RotaryTemplate';
import { SettingsTemplate } from '../../src/template/templates/SettingsTemplate';
import { SmartWatchTemplate } from '../../src/template/templates/SmartWatchTemplate';
import { DashboardTemplate } from '../../src/template/templates/DashboardTemplate';
import { ChatBotTemplate } from '../../src/template/templates/ChatBotTemplate';

type TestResult = { name: string; passed: boolean; details?: string };

function ensureCleanDir(dir: string) {
  fs.rmSync(dir, { recursive: true, force: true });
  fs.mkdirSync(dir, { recursive: true });
}

function fileExists(p: string) {
  try {
    fs.accessSync(p, fs.constants.F_OK);
    return true;
  } catch {
    return false;
  }
}

function readJson(p: string): any {
  return JSON.parse(fs.readFileSync(p, 'utf8'));
}

function listAllFiles(dir: string): string[] {
  const results: string[] = [];
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const e of entries) {
    const full = path.join(dir, e.name);
    if (e.isDirectory()) results.push(...listAllFiles(full));
    else results.push(full);
  }
  return results;
}

async function runTemplateTest(id: string, template: { createProject: (targetPath: string, projectName: string, appId: string, sdkPath: string) => Promise<void> }): Promise<TestResult> {
  const outDir = path.join(process.cwd(), '.tmp', 'template-tests', id);
  const projectName = `T_${id}_Demo`;
  const appId = `com.example.${id}`;
  const sdkPath = '/opt/honeygui-sdk';
  try {
    ensureCleanDir(outDir);
    await template.createProject(outDir, projectName, appId, sdkPath);
    const hmlDir = path.join(outDir, 'ui', 'main');
    const hmlFile = path.join(hmlDir, `${projectName}Main.hml`);
    if (!fileExists(hmlFile)) return { name: id, passed: false, details: 'HML 重命名文件不存在' };
    const hmlContent = fs.readFileSync(hmlFile, 'utf8');
    if (!hmlContent.includes(projectName)) return { name: id, passed: false, details: 'HML 未替换 PROJECT_NAME' };
    if (!hmlContent.includes(appId)) return { name: id, passed: false, details: 'HML 未替换 APP_ID' };
    const projectJsonPath = path.join(outDir, 'project.json');
    if (fileExists(projectJsonPath)) {
      const pj = readJson(projectJsonPath);
      if (pj.name !== projectName) return { name: id, passed: false, details: 'project.json name 未替换' };
      if (pj.appId !== appId) return { name: id, passed: false, details: 'project.json appId 未替换' };
      if (pj.mainHmlFile !== `ui/main/${projectName}Main.hml`) return { name: id, passed: false, details: 'project.json mainHmlFile 未更新' };
      if (pj.honeyguiSdkPath !== sdkPath) return { name: id, passed: false, details: 'project.json honeyguiSdkPath 未替换' };
    }
    const allFiles = listAllFiles(outDir);
    for (const f of allFiles) {
      if (f.includes('.template.')) return { name: id, passed: false, details: `发现残留模板文件: ${path.basename(f)}` };
      const content = fs.readFileSync(f, 'utf8');
      if (content.includes('{{PROJECT_NAME}}') || content.includes('{{APP_ID}}') || content.includes('{{SDK_PATH}}') || content.includes('{{CREATED_TIME}}')) {
        return { name: id, passed: false, details: `占位符未完全替换: ${path.relative(outDir, f)}` };
      }
    }
    return { name: id, passed: true };
  } catch (e: any) {
    return { name: id, passed: false, details: String(e?.message || e) };
  }
}

async function main() {
  const suites: Array<{ id: string; instance: any }> = [
    { id: 'rotary', instance: new RotaryTemplate() },
    { id: 'settings', instance: new SettingsTemplate() },
    { id: 'smartwatch', instance: new SmartWatchTemplate() },
    { id: 'dashboard', instance: new DashboardTemplate() },
    { id: 'chatbot', instance: new ChatBotTemplate() }
  ];
  const results: TestResult[] = [];
  for (const s of suites) {
    const r = await runTemplateTest(s.id, s.instance);
    results.push(r);
    const status = r.passed ? 'PASS' : 'FAIL';
    console.log(`[${status}] ${r.name}${r.details ? ` - ${r.details}` : ''}`);
  }
  const failed = results.filter(x => !x.passed);
  if (failed.length > 0) {
    console.error(`共 ${failed.length} 个模板测试失败`);
    process.exitCode = 1;
  } else {
    console.log('所有模板测试通过');
    process.exitCode = 0;
  }
}

main();
