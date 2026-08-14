import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import {
    INVENTORY_SOURCE_SPLICE_END,
    INVENTORY_SOURCE_SPLICE_START,
    INVENTORY_SOURCE_MAX_BLOCK_LINES,
    locateInventorySourceSpliceBlock,
    previewInventorySourceSplice
} from '../scripts/splice-inventory-source.mjs';

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));

test('app.js has unique inventory source splice boundary markers', () => {
    const app = fs.readFileSync(path.join(root, 'app.js'), 'utf8');
    assert.ok(app.includes(INVENTORY_SOURCE_SPLICE_START));
    assert.ok(app.includes(INVENTORY_SOURCE_SPLICE_END));
    assert.equal(app.split(INVENTORY_SOURCE_SPLICE_START).length - 1, 1);
    assert.equal(app.split(INVENTORY_SOURCE_SPLICE_END).length - 1, 1);
    const located = locateInventorySourceSpliceBlock(app);
    assert.equal(located.ok, true, located.error || 'block must be locatable');
    assert.ok(located.lineCount > 0);
    assert.ok(located.lineCount <= INVENTORY_SOURCE_MAX_BLOCK_LINES);
});

test('splice preview only replaces the inventory source block', () => {
    const app = fs.readFileSync(path.join(root, 'app.js'), 'utf8');
    const mod = fs.readFileSync(path.join(root, 'inventory-source.module.js'), 'utf8');
    const located = locateInventorySourceSpliceBlock(app);
    assert.equal(located.ok, true, located.error || 'block must be locatable');
    const preview = previewInventorySourceSplice(app, mod);
    assert.equal(preview.ok, true, preview.error || 'preview must succeed');

    const next = preview.next;
    const relocated = locateInventorySourceSpliceBlock(next);
    assert.equal(relocated.ok, true);
    assert.equal(relocated.start, located.start);
    assert.equal(next.slice(0, located.start), app.slice(0, located.start));
    assert.ok(next.includes('// ——— App-wide Experience Mode'));
    assert.ok(next.includes('const defaultData = {'));
    assert.ok(relocated.lineCount <= INVENTORY_SOURCE_MAX_BLOCK_LINES);
});

test('legacy generic end marker alone is rejected', () => {
    const fake = `${INVENTORY_SOURCE_SPLICE_START}\n// filler\nconst defaultData = {`;
    const located = locateInventorySourceSpliceBlock(fake);
    assert.equal(located.ok, false);
    assert.match(located.error, /end marker/);
});
