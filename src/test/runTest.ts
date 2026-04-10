import * as path from 'path';
import { runTests } from '@vscode/test-electron';

async function main() {
    const extensionDevelopmentPath = path.resolve(__dirname, '../../..');
    const extensionTestsPath = path.resolve(__dirname, './suite/index');

    // Use TEST_WORKSPACE env var if set (e.g., cloned smartwatch template),
    // otherwise fall back to the minimal fixture
    const testWorkspace = process.env.TEST_WORKSPACE
        ? path.resolve(process.env.TEST_WORKSPACE)
        : path.resolve(extensionDevelopmentPath, 'src/test/fixtures/minimal-project');

    console.log(`Test workspace: ${testWorkspace}`);

    try {
        await runTests({
            extensionDevelopmentPath,
            extensionTestsPath,
            launchArgs: [
                testWorkspace,
                '--disable-extensions',
            ],
        });
    } catch (err) {
        console.error('Failed to run tests:', err);
        process.exit(1);
    }
}

main();
