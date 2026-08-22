import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import {
    INVENTORY_PAGE_MAX_BLOCK_LINES,
    INVENTORY_PAGE_SPLICE_END,
    INVENTORY_PAGE_SPLICE_START,
    locateInventoryPageSpliceBlock,
    previewInventoryPageSplice
} from '../scripts/splice-inventory.mjs';

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));

const REQUIRED_FUNCTIONS = [
    'getPurchaseInventoryTab',
    'getInventoryFilteredPurchases',
    'getInventorySummary',
    'renderInventorySummaryCards',
    'setInventoryDateFilter',
    'getInventoryDateFilterBounds',
    'onInventorySubstanceChange'
];

test('app.js has unique Inventory page splice boundary markers', () => {
    const app = fs.readFileSync(path.join(root, 'app.js'), 'utf8');
    assert.ok(app.includes(INVENTORY_PAGE_SPLICE_START));
    assert.ok(app.includes(INVENTORY_PAGE_SPLICE_END));
    assert.equal(app.split(INVENTORY_PAGE_SPLICE_START).length - 1, 1);
    assert.equal(app.split(INVENTORY_PAGE_SPLICE_END).length - 1, 1);
    const located = locateInventoryPageSpliceBlock(app);
    assert.equal(located.ok, true, located.error || 'block must be locatable');
    assert.ok(located.lineCount > 0);
    assert.ok(located.lineCount <= INVENTORY_PAGE_MAX_BLOCK_LINES);
});

test('inventory.module.js is the Inventory page source and stays in sync with app.js', () => {
    const app = fs.readFileSync(path.join(root, 'app.js'), 'utf8');
    const mod = fs.readFileSync(path.join(root, 'inventory.module.js'), 'utf8');
    assert.ok(mod.startsWith(INVENTORY_PAGE_SPLICE_START));
    assert.ok(mod.includes(INVENTORY_PAGE_SPLICE_END));
    for (const name of REQUIRED_FUNCTIONS) {
        assert.match(mod, new RegExp(`function ${name}\\(`));
        assert.equal(app.split(`function ${name}(`).length - 1, 1, `${name} must remain a single public function`);
    }
    const preview = previewInventoryPageSplice(app, mod);
    assert.equal(preview.ok, true, preview.error || 'preview must succeed');
    const located = locateInventoryPageSpliceBlock(app);
    const next = preview.next;
    const relocated = locateInventoryPageSpliceBlock(next);
    assert.equal(relocated.ok, true);
    assert.equal(relocated.start, located.start);
    assert.equal(next.slice(0, located.start), app.slice(0, located.start));
    assert.ok(next.includes('function getVapePurchaseDisplayStatus'));
    assert.ok(next.includes('function migrateInventoryStatusFields'));
    assert.ok(relocated.lineCount <= INVENTORY_PAGE_MAX_BLOCK_LINES);
});

test('legacy generic end marker alone is rejected', () => {
    const fake = `${INVENTORY_PAGE_SPLICE_START}\n// filler\nfunction getVapePurchaseDisplayStatus() {}`;
    const located = locateInventoryPageSpliceBlock(fake);
    assert.equal(located.ok, false);
    assert.match(located.error, /end marker/);
});
