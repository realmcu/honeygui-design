import * as assert from 'assert';
import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';

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

        const buildDir = path.join(workspacePath, 'build');
        const srcDir = path.join(workspacePath, 'src');
        if (fs.existsSync(buildDir)) {
            fs.rmSync(buildDir, { recursive: true, force: true });
        }
        if (fs.existsSync(srcDir)) {
            fs.rmSync(srcDir, { recursive: true, force: true });
        }
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
        // Check that lib/sim structure is accessible from extension
        const ext = vscode.extensions.all.find(e =>
            e.packageJSON?.name === 'honeygui-visual-designer'
        );
        assert.ok(ext, 'Extension should be found');
        const libSimPath = path.join(ext.extensionPath, 'lib', 'sim');
        console.log(`Extension path: ${ext.extensionPath}`);
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

    test('Simulation command compiles template project', async function () {
        // Create output channel listener to capture simulation output
        const logs: string[] = [];
        const disposable = vscode.workspace.onDidChangeTextDocument(() => {});

        console.log(`Workspace: ${workspacePath}`);
        console.log(`Project files: ${fs.readdirSync(workspacePath).join(', ')}`);

        // Execute the simulation command
        try {
            await vscode.commands.executeCommand('honeygui.simulation');
        } catch (err: any) {
            console.error(`Simulation command threw: ${err.message}`);
        }

        // Wait for build to complete (poll for executable)
        const buildDir = path.join(workspacePath, 'build');
        const exeName = process.platform === 'win32' ? 'gui.exe' : 'gui';
        const exePath = path.join(buildDir, exeName);

        // Poll for up to 120 seconds
        let found = false;
        for (let i = 0; i < 60; i++) {
            if (fs.existsSync(exePath)) {
                found = true;
                break;
            }
            // Log what exists in workspace for debugging
            if (i === 0 || i === 5 || i === 10) {
                const wsFiles = fs.existsSync(workspacePath)
                    ? fs.readdirSync(workspacePath) : [];
                console.log(`[${i * 2}s] Workspace contents: ${wsFiles.join(', ')}`);
                if (fs.existsSync(buildDir)) {
                    const buildFiles = fs.readdirSync(buildDir);
                    console.log(`[${i * 2}s] Build dir contents: ${buildFiles.join(', ')}`);
                }
            }
            await new Promise(resolve => setTimeout(resolve, 2000));
        }

        disposable.dispose();

        assert.ok(found, `Compiled executable should exist at ${exePath}`);

        if (found) {
            const stats = fs.statSync(exePath);
            assert.ok(stats.size > 0, 'Executable should have non-zero size');
        }

        try {
            await vscode.commands.executeCommand('honeygui.simulation.stop');
        } catch { /* ignore */ }
    });
});
