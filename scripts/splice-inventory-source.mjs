#!/usr/bin/env node
/**
 * Splices inventory-source.module.js into app.js between unique boundary markers.
 *
 * SAFETY: This script does NOT write files unless invoked with --apply.
 * Default mode is validate-only (dry run). Re-running with a missing/ambiguous
 * end marker previously deleted thousands of lines — guarded below.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');

export const INVENTORY_SOURCE_SPLICE_START = '// ——— Inventory Source (unified Store + Supplier Contact) ———';
export const INVENTORY_SOURCE_SPLICE_END = '// ——— END Inventory Source (splice boundary — do not remove) ———';

/** Max lines the inventory-source block may span; abort if larger (Experience Mode lives after END). */
export const INVENTORY_SOURCE_MAX_BLOCK_LINES = 1200;

export function stripInventorySourceModuleMarker(moduleSource) {
    let mod = String(moduleSource || '').trim();
    if (mod.startsWith(INVENTORY_SOURCE_SPLICE_START)) {
        mod = mod.slice(INVENTORY_SOURCE_SPLICE_START.length).replace(/^\s*\n/, '');
    }
    return mod.trim();
}

export function locateInventorySourceSpliceBlock(appSource) {
    const startMatches = appSource.split(INVENTORY_SOURCE_SPLICE_START).length - 1;
    const endMatches = appSource.split(INVENTORY_SOURCE_SPLICE_END).length - 1;
    if (startMatches !== 1) {
        return { ok: false, error: `expected exactly one start marker, found ${startMatches}` };
    }
    if (endMatches !== 1) {
        return { ok: false, error: `expected exactly one end marker, found ${endMatches}` };
    }
    const start = appSource.indexOf(INVENTORY_SOURCE_SPLICE_START);
    const end = appSource.indexOf(INVENTORY_SOURCE_SPLICE_END, start + INVENTORY_SOURCE_SPLICE_START.length);
    if (start < 0 || end < 0) {
        return { ok: false, error: 'start or end marker missing' };
    }
    if (end <= start) {
        return { ok: false, error: 'end marker precedes start marker' };
    }
    const block = appSource.slice(start, end + INVENTORY_SOURCE_SPLICE_END.length);
    const lineCount = block.split('\n').length;
    if (lineCount > INVENTORY_SOURCE_MAX_BLOCK_LINES) {
        return {
            ok: false,
            error: `block too large (${lineCount} lines > ${INVENTORY_SOURCE_MAX_BLOCK_LINES}); refusing ambiguous splice`
        };
    }
    const afterEnd = appSource.slice(end + INVENTORY_SOURCE_SPLICE_END.length, end + INVENTORY_SOURCE_SPLICE_END.length + 120);
    if (!afterEnd.includes('App-wide Experience Mode')) {
        return {
            ok: false,
            error: 'block end is not immediately followed by Experience Mode section'
        };
    }
    return { ok: true, start, end, endExclusive: end + INVENTORY_SOURCE_SPLICE_END.length, lineCount };
}

export function previewInventorySourceSplice(appSource, moduleSource) {
    const located = locateInventorySourceSpliceBlock(appSource);
    if (!located.ok) return located;
    const modBody = stripInventorySourceModuleMarker(moduleSource);
    const replacement = `${INVENTORY_SOURCE_SPLICE_START}\n${modBody}\n\n${INVENTORY_SOURCE_SPLICE_END}\n`;
    const next = appSource.slice(0, located.start) + replacement + appSource.slice(located.endExclusive);
    const relocated = locateInventorySourceSpliceBlock(next);
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

function tryReplace(src, find, repl, label) {
    if (!src.includes(find)) {
        console.warn('Skip:', label);
        return src;
    }
    return src.replace(find, repl);
}

const isCliMain = process.argv[1]
    && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);

if (isCliMain) {
const apply = process.argv.includes('--apply');

const appPath = path.join(root, 'app.js');
const htmlPath = path.join(root, 'index.html');
const cssPath = path.join(root, 'styles.css');
const modPath = path.join(root, 'inventory-source.module.js');

let app = fs.readFileSync(appPath, 'utf8');
const mod = fs.readFileSync(modPath, 'utf8');

const preview = previewInventorySourceSplice(app, mod);
if (!preview.ok) {
    console.error('splice-inventory-source: refused —', preview.error);
    console.error('The script will not modify app.js. Fix boundary markers or run validate-only checks.');
    process.exit(1);
}

console.log(`Inventory Source block: ${preview.lineCount} line(s); replacement ~${preview.replacementLineCount} line(s).`);

if (!apply) {
    console.log('Dry run only — no files written. Pass --apply to modify app.js, index.html, and styles.css.');
    process.exit(0);
}

app = preview.next;

app = tryReplace(app,
    `    ensureInsightsLayoutPrefs(data);
    applyInsightsSimplifyNavMigration(data);
    ensureTableColumnSettings(data);`,
    `    ensureInsightsLayoutPrefs(data);
    applyInsightsSimplifyNavMigration(data);
    ensureInventorySourcesMigrated(data);
    ensureTableColumnSettings(data);`,
    'ensure inventory source migration');

app = tryReplace(app,
    `if (typeof initInsightsSimplify === 'function') {
    try { initInsightsSimplify(); } catch (_) { /* DOM may be absent in tests */ }
}`,
    `if (typeof initInsightsSimplify === 'function') {
    try { initInsightsSimplify(); } catch (_) { /* DOM may be absent in tests */ }
}
if (typeof initInventorySource === 'function') {
    try { initInventorySource(); } catch (_) { /* DOM may be absent in tests */ }
}`,
    'init inventory source');

app = tryReplace(app,
    `        store: 'Store',
        supplier: 'Supplier',`,
    `        store: 'Source',
        supplier: 'Source (legacy)',`,
    'history column labels');

app = tryReplace(app,
    `    purchaseHistory: {
        order: [`,
    `    purchaseHistory: {
        // supplier hidden — Source (store column) is the single source field
        order: [`,
    'comment purchase history');

app = tryReplace(app,
    `        case 'store':
            return phTd('store', store || '—');`,
    `        case 'store':
            return phTd('store', typeof formatPurchaseSourceDisplay === 'function'
                ? formatPurchaseSourceDisplay(purchase)
                : (store || '—'));`,
    'history store cell');

app = tryReplace(app,
    `        ensureInsightsLayoutPrefs,
        getInsightsLayoutPrefs,`,
    `        ensureInventorySourcesMigrated,
        migrateInventorySourceFields,
        migratePurchaseSourceFields,
        syncPurchaseSourceFields,
        getPurchaseSourceName,
        getPurchaseSourceKind,
        getPurchaseSourceContactId,
        formatPurchaseSourceDisplay,
        applyInventorySourceToPayload,
        collectInventorySourceOptions,
        initInventorySource,
        INVENTORY_SOURCE_KINDS,
        ensureInsightsLayoutPrefs,
        getInsightsLayoutPrefs,`,
    'source test exports');

let html = fs.readFileSync(htmlPath, 'utf8');
let css = fs.readFileSync(cssPath, 'utf8');

html = tryReplace(html,
    `                    <div class="form-group" id="buy-store-group">
                        <label for="buy-store-select">Store / Location</label>
                        <select id="buy-store-select"></select>
                        <div class="form-group buy-store-new-group hidden" id="buy-store-new-group">
                            <label for="buy-store-new">New Store / Location</label>
                            <input type="text" id="buy-store-new" placeholder="Enter store or location name" autocomplete="off">
                        </div>
                    </div>`,
    `                    <div class="form-group hidden" id="buy-store-group" data-legacy-store="1" hidden>
                        <label for="buy-store-select">Source (legacy)</label>
                        <select id="buy-store-select"></select>
                        <div class="form-group buy-store-new-group hidden" id="buy-store-new-group">
                            <label for="buy-store-new">New Source</label>
                            <input type="text" id="buy-store-new" placeholder="Enter source name" autocomplete="off">
                        </div>
                    </div>
                    <div id="buy-source-mount" class="buy-source-mount"></div>`,
    'html store → source mount');

html = tryReplace(html, `Store / Location`, `Source`, 'insights store label');

if (!css.includes('.buy-source-picker')) {
    css += `

/* Inventory Source picker */
.buy-source-picker { position: relative; }
.buy-source-search {
    width: 100%; min-height: 42px; border: 1px solid var(--border); border-radius: 8px;
    padding: 8px 12px; background: var(--bg, #fff); color: var(--text);
}
.buy-source-menu {
    position: absolute; left: 0; right: 0; top: calc(100% + 4px); z-index: 40;
    max-height: 280px; overflow: auto; border: 1px solid var(--border); border-radius: 10px;
    background: var(--bg, #fff); box-shadow: 0 8px 24px rgba(0,0,0,0.12);
}
.buy-source-group-label {
    padding: 8px 12px 4px; font-size: 0.75rem; font-weight: 600;
    color: var(--text-secondary); text-transform: uppercase; letter-spacing: 0.04em;
}
.buy-source-meta { align-items: end; margin-top: 8px; gap: 8px; }
.buy-source-meta .form-group { flex: 1; margin-bottom: 0; }
#buy-source-group .settings-hint { margin-top: 6px; }
`;
    console.log('Appended source CSS');
}

const postCheck = locateInventorySourceSpliceBlock(app);
if (!postCheck.ok) {
    console.error('Post-write validation failed:', postCheck.error);
    process.exit(1);
}

fs.writeFileSync(appPath, app);
fs.writeFileSync(htmlPath, html);
fs.writeFileSync(cssPath, css);
console.log('splice-inventory-source complete (--apply)');
}
