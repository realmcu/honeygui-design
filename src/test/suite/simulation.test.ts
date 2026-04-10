import * as assert from 'assert';
import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';
import { execSync } from 'child_process';

suite('HoneyGUI Extension E2E', function () {
    this.timeout(180000);

    const workspacePath = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath || '';

    suiteSetup(async () => {
        await new Promise(resolve => setTimeout(resolve, 5000));
    });

    suiteTeardown(async () => {
        try {
            await vscode.commands.executeCommand('honeygui.simulation.stop');
        } catch { /* ignore */ }
    });

    test('Workspace is open with project.json', () => {
        assert.ok(workspacePath, 'Workspace should be open');
        const projectJson = path.join(workspacePath, 'project.json');
        assert.ok(fs.existsSync(projectJson), 'project.json should exist in workspace');
    });

    test('Extension is active', () => {
        const ext = vscode.extensions.all.find(e =>
            e.packageJSON?.name === 'honeygui-visual-designer'
        );
        assert.ok(ext, 'Extension should be installed');
        assert.ok(ext.isActive, 'Extension should be active');
    });

    test('lib/sim directory is valid', () => {
        const ext = vscode.extensions.all.find(e =>
            e.packageJSON?.name === 'honeygui-visual-designer'
        );
        assert.ok(ext, 'Extension should be found');
        const libSimPath = path.join(ext!.extensionPath, 'lib', 'sim');
        assert.ok(fs.existsSync(libSimPath), `lib/sim should exist at ${libSimPath}`);
        assert.ok(fs.existsSync(path.join(libSimPath, 'win32_sim')), 'lib/sim/win32_sim should exist');
        assert.ok(fs.existsSync(path.join(libSimPath, 'include')), 'lib/sim/include should exist');

        const platform = process.platform === 'win32' ? 'win32' : 'linux';
        const libGui = path.join(libSimPath, platform, 'libgui.a');
        assert.ok(fs.existsSync(libGui), `libgui.a should exist at ${libGui}`);
    });

    test('Simulation command sets up build environment', async function () {
        try {
            await vscode.commands.executeCommand('honeygui.simulation');
        } catch (err: any) {
            assert.fail(`Simulation command threw: ${err.message}`);
        }

        // Wait for codegen + build setup
        await new Promise(resolve => setTimeout(resolve, 5000));

        const buildDir = path.join(workspacePath, 'build');
        const srcDir = path.join(workspacePath, 'src');

        assert.ok(fs.existsSync(srcDir), 'Codegen should create src directory');
        assert.ok(fs.existsSync(buildDir), 'Build directory should be created');
        assert.ok(
            fs.existsSync(path.join(buildDir, 'SConstruct')),
            'Build directory should contain SConstruct'
        );
        assert.ok(
            fs.existsSync(path.join(buildDir, '.config')),
            'Build directory should contain .config'
        );
    });

    test('Direct scons compilation succeeds', async function () {
        this.timeout(120000);

        const buildDir = path.join(workspacePath, 'build');
        assert.ok(fs.existsSync(path.join(buildDir, 'SConstruct')), 'SConstruct must exist');

        try {
            execSync('scons --version', { encoding: 'utf8' });
        } catch {
            assert.fail('scons is not available in PATH');
        }

        try {
            execSync('gcc --version', { encoding: 'utf8' });
        } catch {
            assert.fail('gcc is not available in PATH');
        }

        try {
            execSync('scons -j4', {
                cwd: buildDir,
                encoding: 'utf8',
                timeout: 90000,
                maxBuffer: 10 * 1024 * 1024
            });
        } catch (err: any) {
            const stderr = (err.stderr || '').slice(-2000);
            const stdout = (err.stdout || '').slice(-2000);
            assert.fail(`scons failed (exit ${err.status}):\n${stderr || stdout}`);
        }

        const exeName = process.platform === 'win32' ? 'gui.exe' : 'gui';
        const exePath = path.join(buildDir, exeName);
        assert.ok(fs.existsSync(exePath), `Executable should exist at ${exePath}`);

        const stats = fs.statSync(exePath);
        assert.ok(stats.size > 0, 'Executable should have non-zero size');

        try {
            await vscode.commands.executeCommand('honeygui.simulation.stop');
        } catch { /* ignore */ }
    });
});
