import * as assert from 'assert';
import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';
import { execSync } from 'child_process';

suite('HoneyGUI Extension E2E', function () {
    this.timeout(180000);

    const workspacePath = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath || '';

    suiteSetup(async () => {
        // Wait for extension activation (onStartupFinished)
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
        console.log(`Extension path: ${ext!.extensionPath}`);
        console.log(`lib/sim path: ${libSimPath}`);
        assert.ok(fs.existsSync(libSimPath), `lib/sim should exist at ${libSimPath}`);
        assert.ok(
            fs.existsSync(path.join(libSimPath, 'win32_sim')),
            'lib/sim/win32_sim should exist'
        );
        assert.ok(
            fs.existsSync(path.join(libSimPath, 'include')),
            'lib/sim/include should exist'
        );

        const platform = process.platform === 'win32' ? 'win32' : 'linux';
        const libGui = path.join(libSimPath, platform, 'libgui.a');
        console.log(`libgui.a path: ${libGui}, exists: ${fs.existsSync(libGui)}`);
        assert.ok(fs.existsSync(libGui), `libgui.a should exist at ${libGui}`);
    });

    test('Simulation command sets up build environment', async function () {
        console.log(`Workspace: ${workspacePath}`);
        console.log(`Project files: ${fs.readdirSync(workspacePath).join(', ')}`);

        // Execute the simulation command
        try {
            await vscode.commands.executeCommand('honeygui.simulation');
        } catch (err: any) {
            console.error(`Simulation command threw: ${err.message}`);
        }

        // Give it time to set up build env (even if compile fails)
        await new Promise(resolve => setTimeout(resolve, 5000));

        const buildDir = path.join(workspacePath, 'build');
        const srcDir = path.join(workspacePath, 'src');

        // Check codegen output
        console.log(`src dir exists: ${fs.existsSync(srcDir)}`);
        if (fs.existsSync(srcDir)) {
            const srcFiles = fs.readdirSync(srcDir, { recursive: true });
            console.log(`src files: ${srcFiles.join(', ')}`);
        }

        // Check build dir
        console.log(`build dir exists: ${fs.existsSync(buildDir)}`);
        if (fs.existsSync(buildDir)) {
            const buildFiles = fs.readdirSync(buildDir);
            console.log(`build dir contents: ${buildFiles.join(', ')}`);

            // Check build/build/ for any .o files
            const innerBuild = path.join(buildDir, 'build');
            if (fs.existsSync(innerBuild)) {
                try {
                    const oFiles = execSync(`find ${innerBuild} -name "*.o" 2>/dev/null | head -5`, { encoding: 'utf8' });
                    console.log(`Object files: ${oFiles || '(none)'}`);
                } catch { /* ignore */ }
            }

            // Check SConstruct exists
            assert.ok(
                fs.existsSync(path.join(buildDir, 'SConstruct')),
                'Build directory should contain SConstruct'
            );

            // Check .config exists
            assert.ok(
                fs.existsSync(path.join(buildDir, '.config')),
                'Build directory should contain .config'
            );
        }

        assert.ok(fs.existsSync(buildDir), 'Build directory should be created');
    });

    test('Direct scons compilation succeeds', async function () {
        this.timeout(120000);

        const buildDir = path.join(workspacePath, 'build');
        assert.ok(fs.existsSync(buildDir), 'Build dir must exist from previous test');
        assert.ok(
            fs.existsSync(path.join(buildDir, 'SConstruct')),
            'SConstruct must exist'
        );

        // Run scons directly and capture output
        console.log('Running scons -j4 directly...');
        console.log(`CWD: ${buildDir}`);

        // Check scons availability first
        try {
            const sconsVersion = execSync('scons --version 2>&1', { encoding: 'utf8' }).trim();
            console.log(`scons version: ${sconsVersion.split('\n')[0]}`);
        } catch (err: any) {
            console.error(`scons not found: ${err.message}`);
            assert.fail('scons is not available in PATH');
        }

        // Check gcc availability
        try {
            const gccVersion = execSync('gcc --version 2>&1', { encoding: 'utf8' }).trim();
            console.log(`gcc: ${gccVersion.split('\n')[0]}`);
        } catch (err: any) {
            console.error(`gcc not found: ${err.message}`);
            assert.fail('gcc is not available in PATH');
        }

        // Run scons directly (without 2>&1 so we get separate stdout/stderr)
        try {
            const output = execSync('scons -j4', {
                cwd: buildDir,
                encoding: 'utf8',
                timeout: 90000,
                maxBuffer: 10 * 1024 * 1024
            });
            console.log(`scons output (last 2000 chars):\n${output.slice(-2000)}`);
        } catch (err: any) {
            console.error(`scons failed with exit code: ${err.status}`);
            console.error(`=== STDOUT (last 5000 chars) ===\n${(err.stdout || '').slice(-5000)}`);
            console.error(`=== STDERR (last 5000 chars) ===\n${(err.stderr || '').slice(-5000)}`);
            assert.fail(`scons compilation failed: ${(err.stderr || err.stdout || err.message).slice(-1000)}`);
        }

        // Check for executable
        const exeName = process.platform === 'win32' ? 'gui.exe' : 'gui';
        const exePath = path.join(buildDir, exeName);
        console.log(`Executable path: ${exePath}, exists: ${fs.existsSync(exePath)}`);

        assert.ok(fs.existsSync(exePath), `Compiled executable should exist at ${exePath}`);

        if (fs.existsSync(exePath)) {
            const stats = fs.statSync(exePath);
            console.log(`Executable size: ${stats.size} bytes`);
            assert.ok(stats.size > 0, 'Executable should have non-zero size');
        }

        // Cleanup
        try {
            await vscode.commands.executeCommand('honeygui.simulation.stop');
        } catch { /* ignore */ }
    });
});
