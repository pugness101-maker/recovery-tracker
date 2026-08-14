import { cpSync, mkdirSync, readFileSync, existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const dist = join(root, 'dist');

function run(command, args) {
    const result = spawnSync(command, args, {
        cwd: root,
        stdio: 'inherit',
    });

    if (result.status !== 0) {
        process.exit(result.status ?? 1);
    }
}

run('node', ['--check', 'app.js']);

const testsDir = join(root, 'tests');

if (existsSync(testsDir)) {
    run('node', ['--test', 'tests/**/*.test.mjs']);
} else {
    console.log(
        'No tests directory found; skipping tests during production build.'
    );
}

mkdirSync(dist, { recursive: true });

for (const file of ['index.html', 'app.js', 'styles.css', 'cloud-config.js']) {
    cpSync(join(root, file), join(dist, file));
}

run('node', ['scripts/write-cloud-config.mjs']);

readFileSync(join(root, 'index.html'), 'utf8');

const stamp = new Date().toISOString();
console.log(`Production build completed at ${stamp}`);