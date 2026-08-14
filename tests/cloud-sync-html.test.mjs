import assert from 'node:assert/strict';
import test from 'node:test';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));

test('index.html has exactly one sm-toast and one cloud-config.js script', () => {
    const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
    const toasts = html.match(/id="sm-toast"/g) || [];
    const configs = html.match(/<script src="cloud-config\.js"><\/script>/g) || [];
    assert.equal(toasts.length, 1);
    assert.equal(configs.length, 1);
    assert.match(html, /cloud-config\.js[\s\S]*app\.js/);
});

test('Danger Zone distinguishes Delete Cloud Data from Delete Account', () => {
    const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
    assert.match(html, /Delete Cloud Data/);
    assert.match(html, /Delete Account/);
    assert.match(html, /does not delete your login/);
    assert.doesNotMatch(html, /onclick="confirmDeleteCloudAccountData\(\)"/);
});
