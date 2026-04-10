import * as assert from 'assert';
import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';

suite('HoneyGUI Extension E2E', function () {
    this.timeout(180000);

    const workspacePath = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath || '';

    suiteSetup(async () => {
        // Wait for extension activation (onStartupFinished)
        await new Promise(resolve => setTimeout(resolve, 3000));
    });

    suiteTeardown(async () => {
        // Stop any running simulation
        try {
            await vscode.commands.executeCommand('honeygui.simulation.stop');
        } catch { /* ignore */ }

        // Clean up build artifacts from fixture
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

    test('Simulation command compiles template project', async function () {
        // Execute the simulation command (triggers full pipeline:
        // env check → codegen → build setup → compile → run)
        await vscode.commands.executeCommand('honeygui.simulation');

        // Verify compiled executable exists
        const buildDir = path.join(workspacePath, 'build');
        const exeName = process.platform === 'win32' ? 'gui.exe' : 'gui';
        const exePath = path.join(buildDir, exeName);

        assert.ok(
            fs.existsSync(exePath),
            `Compiled executable should exist at ${exePath}`
        );

        // Verify it's actually executable (non-zero size)
        const stats = fs.statSync(exePath);
        assert.ok(stats.size > 0, 'Executable should have non-zero size');

        // Stop the running simulation
        await vscode.commands.executeCommand('honeygui.simulation.stop');
    });
});
