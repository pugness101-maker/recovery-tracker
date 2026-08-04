import { cpSync, mkdirSync, readFileSync, existsSync, readdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const dist = join(root, 'dist');

function run(command, args) {
    const result = spawnSync(command, args, { cwd: root, stdio: 'inherit' });
    if (result.status !== 0) {
        process.exit(result.status ?? 1);
    }
}

run('node', ['--check', 'app.js']);

// Only run tests if test files exist
const testsDir = join(root, 'tests');
if (existsSync(testsDir) && readdirSync(testsDir).length > 0) {
    try {
        run('node', ['--test', 'tests/']);
    } catch (e) {
        console.error('Test execution failed:', e.message);
        throw e;
    }
}

mkdirSync(dist, { recursive: true });
for (const file of ['index.html', 'app.js', 'styles.css']) {
    cpSync(join(root, file), join(dist, file));
}

const stamp = new Date().toISOString();
readFileSync(join(root, 'index.html'), 'utf8');
console.log(`Production build completed at ${stamp}`);
