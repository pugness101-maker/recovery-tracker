#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
let app = fs.readFileSync(path.join(root, 'app.js'), 'utf8');
let html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
let css = fs.readFileSync(path.join(root, 'styles.css'), 'utf8');
const mod = fs.readFileSync(path.join(root, 'inventory-source.module.js'), 'utf8');

function tryReplace(src, find, repl, label) {
    if (!src.includes(find)) {
        console.warn('Skip:', label);
        return src;
    }
    return src.replace(find, repl);
}

if (app.includes('// ——— Inventory Source (unified Store + Supplier Contact) ———')) {
    const start = app.indexOf('// ——— Inventory Source (unified Store + Supplier Contact) ———');
    const end = app.indexOf('const defaultData = {', start);
    if (start < 0 || end < 0) throw new Error('markers missing for refresh');
    app = app.slice(0, start) + mod + '\n\n' + app.slice(end);
    console.log('Refreshed inventory-source module');
} else {
    const marker = 'const defaultData = {';
    const idx = app.indexOf(marker);
    if (idx < 0) throw new Error('defaultData missing');
    app = app.slice(0, idx) + mod + '\n\n' + app.slice(idx);
    console.log('Inserted inventory-source module');
}

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

// Hide supplier by default in TABLE_COLUMN_DEFAULTS purchaseHistory.hidden
app = tryReplace(app,
    `    purchaseHistory: {
        order: [`,
    `    purchaseHistory: {
        // supplier hidden — Source (store column) is the single source field
        order: [`,
    'comment purchase history');

// Ensure supplier in hidden list — find purchaseHistory hidden array
if (app.includes("purchaseHistory:") && !app.match(/purchaseHistory:[\s\S]{0,400}?hidden:\s*\[[^\]]*supplier/)) {
    app = tryReplace(app,
        `        // Family-specific columns are gated by getUseHistoryColumnCatalog / getUseHistoryVisibleColumns.
        // Only keep rarely used generic metrics hidden by default.
        hidden: ['count', 'rate'],`,
        `        // Family-specific columns are gated by getUseHistoryColumnCatalog / getUseHistoryVisibleColumns.
        // Only keep rarely used generic metrics hidden by default.
        hidden: ['count', 'rate'],`,
        'noop useHistory');
}

// Patch purchase history store cell to use formatPurchaseSourceDisplay — in render switch
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
        migrateInventorySources,
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

// HTML: rename store group label; source picker will replace at runtime
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

// Insights store breakdown header
html = tryReplace(html,
    `Store / Location`,
    `Source`,
    'insights store label');

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

fs.writeFileSync(path.join(root, 'app.js'), app);
fs.writeFileSync(path.join(root, 'index.html'), html);
fs.writeFileSync(path.join(root, 'styles.css'), css);
console.log('splice-inventory-source complete');
