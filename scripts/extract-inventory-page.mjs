#!/usr/bin/env node
/**
 * One-time / repeatable extractor: pull Inventory page list/filter/summary
 * functions out of app.js into inventory.module.js and splice them back
 * behind unique boundary markers. Does not change function bodies.
 *
 * Default is dry-run. Pass --apply to write files.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
    INVENTORY_PAGE_SPLICE_END,
    INVENTORY_PAGE_SPLICE_START,
    previewInventoryPageSplice
} from './splice-inventory.mjs';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');

const FUNCTION_NAMES = [
    'getPurchaseInventoryTab',
    'purchaseMatchesInventorySearch',
    'purchaseMatchesInventoryStatus',
    'purchaseMatchesInventoryFilters',
    'getInventoryFilteredPurchases',
    'comparePurchaseHistoryByFlavor',
    'togglePurchaseHistoryFlavorSort',
    'markPurchaseInventoryStatus',
    'setPurchaseHidden',
    'isInventoryAllSubstancesFilter',
    'getInventorySubstanceFilterId',
    'syncInventorySubstanceFilterState',
    'getFilteredPurchases',
    'getInventoryPurchaseEstimatedValue',
    'getInventorySummary',
    'formatInventoryTotalRemainingValue',
    'shouldShowVapeInventorySummaryCards',
    'shouldShowTotalRemainingInventoryCard',
    'formatNicotineInventorySummary',
    'renderInventorySummaryCards',
    'getInventoryStatusFilterLabel',
    'normalizeInventoryStatusFilter',
    'syncInventoryStatusFilterUI',
    'countActiveInventoryFilters',
    'hasActiveInventoryFilters',
    'loadInventoryFiltersPanelState',
    'saveInventoryFiltersPanelState',
    'saveInventoryFilterState',
    'toggleInventoryFiltersPanel',
    'updateInventoryBulkBarUI',
    'renderInventoryFilterChips',
    'updateInventoryFiltersPanelUI',
    'clearInventoryFilters',
    'syncInventoryDateShortcutButtons',
    'syncInventoryCustomDateInputs',
    'setInventoryDateFilter',
    'applyInventoryCustomDates',
    'applyInventorySearchFilters',
    'runInventoryBulkAction',
    'onInventorySubstanceChange',
    'getInventoryDateFilterBounds',
    'getInventorySearchPlaceholder',
    'syncInventorySearchPlaceholder'
];

const STATE_DECLS = [
    'let inventoryTabFilter = \'all\';',
    'let inventorySearchQuery = \'\';',
    'const inventorySelectedIds = new Set();',
    'const INVENTORY_RANGE_FILTER_KEYS = Object.freeze([',
    `const inventoryListFilters = {
    substanceId: '',
    datePreset: 'all',
    dateStart: '',
    dateEnd: '',
    hasRemaining: '',
    hasCost: '',
    acquisitionType: '',
    totalCostMin: '',
    totalCostMax: '',
    costPerUnitMin: '',
    costPerUnitMax: '',
    qtyBoughtMin: '',
    qtyBoughtMax: '',
    qtyRemainingMin: '',
    qtyRemainingMax: '',
    amountUsedMin: '',
    amountUsedMax: '',
    pctUsedMin: '',
    pctUsedMax: '',
    purchaseDateMin: '',
    purchaseDateMax: ''
};`,
    'let inventoryFiltersPanelOpen = false;',
    'const INVENTORY_FILTERS_PANEL_KEY = \'recoveryTracker.inventoryFiltersPanel.v1\';',
    'const INVENTORY_FILTERS_STORAGE_KEY = \'recoveryTracker.inventoryFilters.v2\';'
];

function skipWsAndComments(src, i) {
    while (i < src.length) {
        if (src[i] === ' ' || src[i] === '\t' || src[i] === '\n' || src[i] === '\r') {
            i += 1;
            continue;
        }
        if (src.startsWith('//', i)) {
            const nl = src.indexOf('\n', i);
            i = nl < 0 ? src.length : nl + 1;
            continue;
        }
        if (src.startsWith('/*', i)) {
            const end = src.indexOf('*/', i + 2);
            i = end < 0 ? src.length : end + 2;
            continue;
        }
        break;
    }
    return i;
}

function extractBalancedBlock(src, startIdx) {
    const open = src.indexOf('{', startIdx);
    if (open < 0) throw new Error('opening brace not found');
    let depth = 0;
    let inSingle = false;
    let inDouble = false;
    let inTemplate = false;
    let escaped = false;
    for (let i = open; i < src.length; i += 1) {
        const ch = src[i];
        if (escaped) {
            escaped = false;
            continue;
        }
        if (ch === '\\' && (inSingle || inDouble || inTemplate)) {
            escaped = true;
            continue;
        }
        if (!inDouble && !inTemplate && ch === "'" && !inSingle) {
            inSingle = true;
            continue;
        }
        if (inSingle && ch === "'") {
            inSingle = false;
            continue;
        }
        if (!inSingle && !inTemplate && ch === '"' && !inDouble) {
            inDouble = true;
            continue;
        }
        if (inDouble && ch === '"') {
            inDouble = false;
            continue;
        }
        if (!inSingle && !inDouble && ch === '`') {
            inTemplate = !inTemplate;
            continue;
        }
        if (inSingle || inDouble || inTemplate) continue;
        if (ch === '{') depth += 1;
        else if (ch === '}') {
            depth -= 1;
            if (depth === 0) return { start: open, end: i + 1 };
        }
    }
    throw new Error('unbalanced braces');
}

function extractFunction(src, name) {
    const needle = `function ${name}(`;
    const hits = [];
    let from = 0;
    while (from < src.length) {
        const idx = src.indexOf(needle, from);
        if (idx < 0) break;
        const prev = src[idx - 1];
        if (prev && /[A-Za-z0-9_]/.test(prev)) {
            from = idx + needle.length;
            continue;
        }
        hits.push(idx);
        from = idx + needle.length;
    }
    if (hits.length !== 1) {
        throw new Error(`expected exactly one ${name}(), found ${hits.length}`);
    }
    const start = hits[0];
    const block = extractBalancedBlock(src, start);
    let end = block.end;
    if (src[end] === '\n') end += 1;
    return { start, end, text: src.slice(start, end) };
}

function extractExactDecl(src, decl) {
    const idx = src.indexOf(decl);
    if (idx < 0) throw new Error(`missing decl:\n${decl.slice(0, 80)}`);
    if (src.indexOf(decl, idx + 1) !== -1) {
        throw new Error(`decl appears more than once:\n${decl.slice(0, 80)}`);
    }
    let end = idx + decl.length;
    if (src[end] === '\n') end += 1;
    return { start: idx, end, text: src.slice(idx, end) };
}

function buildModule(parts) {
    return `${INVENTORY_PAGE_SPLICE_START}
// Inventory list, filters, summary cards, and status helpers for the Inventory page.
// Remaining-amount math, purchase migrations, and the buy form stay in app.js.
// Public function names stay global after splice.

${parts.join('\n')}
${INVENTORY_PAGE_SPLICE_END}
`;
}

function removeRanges(src, ranges) {
    const sorted = [...ranges].sort((a, b) => b.start - a.start);
    let next = src;
    for (const range of sorted) {
        const before = next.slice(0, range.start);
        const after = next.slice(range.end);
        const trimmedBefore = before.replace(/\n{3,}$/ , '\n\n');
        const trimmedAfter = after.replace(/^\n{3,}/, '\n\n');
        next = trimmedBefore + trimmedAfter;
    }
    return next;
}

function findInsertIndex(src) {
    const after = src.indexOf('function getVapePurchaseDisplayStatus(purchase) {');
    if (after < 0) throw new Error('getVapePurchaseDisplayStatus missing; cannot place Inventory module');
    return after;
}

const apply = process.argv.includes('--apply');
const appPath = path.join(root, 'app.js');
const modPath = path.join(root, 'inventory.module.js');
let app = fs.readFileSync(appPath, 'utf8');

if (app.includes(INVENTORY_PAGE_SPLICE_START)) {
    console.log('Inventory page markers already present; extraction is a no-op.');
    process.exit(0);
}

const ranges = [];
const functionParts = [];
for (const name of FUNCTION_NAMES) {
    const extracted = extractFunction(app, name);
    ranges.push(extracted);
    functionParts.push(extracted.text.trimEnd());
}

const stateParts = [];
for (const decl of STATE_DECLS) {
    const extracted = extractExactDecl(app, decl);
    ranges.push(extracted);
    stateParts.push(extracted.text.trimEnd());
}

const moduleSource = buildModule([...stateParts, ...functionParts]);
const stripped = removeRanges(app, ranges);
const insertAt = findInsertIndex(stripped);
const nextApp = `${stripped.slice(0, insertAt)}${moduleSource}\n${stripped.slice(insertAt)}`;

const preview = previewInventoryPageSplice(nextApp, moduleSource);
if (!preview.ok) {
    console.error('Post-extract splice validation failed:', preview.error);
    process.exit(1);
}

console.log(`Extracted ${FUNCTION_NAMES.length} functions and ${STATE_DECLS.length} state decls.`);
console.log(`Module lines: ${moduleSource.split('\n').length}; app.js ${app.split('\n').length} → ${nextApp.split('\n').length}`);

if (!apply) {
    console.log('Dry run only — no files written. Pass --apply to write inventory.module.js and app.js.');
    process.exit(0);
}

fs.writeFileSync(modPath, moduleSource);
fs.writeFileSync(appPath, nextApp);
console.log('Wrote inventory.module.js and updated app.js');
