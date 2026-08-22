#!/usr/bin/env node
/**
 * Splices inventory.module.js into app.js between unique boundary markers.
 *
 * SAFETY: This script does NOT write files unless invoked with --apply.
 * Default mode is validate-only (dry run).
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');

export const INVENTORY_PAGE_SPLICE_START = '// ——— Inventory page (combined table filters + summary) ———';
export const INVENTORY_PAGE_SPLICE_END = '// ——— END Inventory page (splice boundary — do not remove) ———';

/** Max lines the inventory-page block may span; abort if larger. */
export const INVENTORY_PAGE_MAX_BLOCK_LINES = 1200;

export function stripInventoryPageModuleMarker(moduleSource) {
    let mod = String(moduleSource || '').trim();
    if (mod.startsWith(INVENTORY_PAGE_SPLICE_START)) {
        mod = mod.slice(INVENTORY_PAGE_SPLICE_START.length).replace(/^\s*\n/, '');
    }
    if (mod.endsWith(INVENTORY_PAGE_SPLICE_END)) {
        mod = mod.slice(0, -INVENTORY_PAGE_SPLICE_END.length).replace(/\s*$/, '');
    }
    return mod.trim();
}

export function locateInventoryPageSpliceBlock(appSource) {
    const startMatches = appSource.split(INVENTORY_PAGE_SPLICE_START).length - 1;
    const endMatches = appSource.split(INVENTORY_PAGE_SPLICE_END).length - 1;
    if (startMatches !== 1) {
        return { ok: false, error: `expected exactly one start marker, found ${startMatches}` };
    }
    if (endMatches !== 1) {
        return { ok: false, error: `expected exactly one end marker, found ${endMatches}` };
    }
    const start = appSource.indexOf(INVENTORY_PAGE_SPLICE_START);
    const end = appSource.indexOf(INVENTORY_PAGE_SPLICE_END, start + INVENTORY_PAGE_SPLICE_START.length);
    if (start < 0 || end < 0) {
        return { ok: false, error: 'start or end marker missing' };
    }
    if (end <= start) {
        return { ok: false, error: 'end marker precedes start marker' };
    }
    const block = appSource.slice(start, end + INVENTORY_PAGE_SPLICE_END.length);
    const lineCount = block.split('\n').length;
    if (lineCount > INVENTORY_PAGE_MAX_BLOCK_LINES) {
        return {
            ok: false,
            error: `block too large (${lineCount} lines > ${INVENTORY_PAGE_MAX_BLOCK_LINES}); refusing ambiguous splice`
        };
    }
    const afterEnd = appSource.slice(end + INVENTORY_PAGE_SPLICE_END.length, end + INVENTORY_PAGE_SPLICE_END.length + 160);
    if (!afterEnd.includes('function getVapePurchaseDisplayStatus')) {
        return {
            ok: false,
            error: 'block end is not immediately followed by getVapePurchaseDisplayStatus'
        };
    }
    return { ok: true, start, end, endExclusive: end + INVENTORY_PAGE_SPLICE_END.length, lineCount };
}

export function previewInventoryPageSplice(appSource, moduleSource) {
    const located = locateInventoryPageSpliceBlock(appSource);
    if (!located.ok) return located;
    const modBody = stripInventoryPageModuleMarker(moduleSource);
    const replacement = `${INVENTORY_PAGE_SPLICE_START}\n${modBody}\n\n${INVENTORY_PAGE_SPLICE_END}\n`;
    const next = appSource.slice(0, located.start) + replacement + appSource.slice(located.endExclusive);
    const relocated = locateInventoryPageSpliceBlock(next);
    if (!relocated.ok) {
        return { ok: false, error: `post-splice validation failed: ${relocated.error}` };
    }
    return {
        ok: true,
        lineCount: located.lineCount,
        replacementLineCount: replacement.split('\n').length,
        next
    };
}

const isCliMain = process.argv[1]
    && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);

if (isCliMain) {
    const apply = process.argv.includes('--apply');
    const appPath = path.join(root, 'app.js');
    const modPath = path.join(root, 'inventory.module.js');
    const app = fs.readFileSync(appPath, 'utf8');
    const mod = fs.readFileSync(modPath, 'utf8');
    const preview = previewInventoryPageSplice(app, mod);
    if (!preview.ok) {
        console.error('splice-inventory: refused —', preview.error);
        process.exit(1);
    }
    console.log(`Inventory page block: ${preview.lineCount} line(s); replacement ~${preview.replacementLineCount} line(s).`);
    if (!apply) {
        console.log('Dry run only — no files written. Pass --apply to modify app.js.');
        process.exit(0);
    }
    fs.writeFileSync(appPath, preview.next);
    console.log('splice-inventory complete (--apply)');
}
