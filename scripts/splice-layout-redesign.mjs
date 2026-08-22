#!/usr/bin/env node
/**
 * Splice layout-redesign.module.js into app.js
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
let app = fs.readFileSync(path.join(root, 'app.js'), 'utf8');
const mod = fs.readFileSync(path.join(root, 'layout-redesign.module.js'), 'utf8');

const MODULE_START = '// ——— Recovery Tracker layout redesign ———';
const MODULE_END = 'const defaultData = {';

if (app.includes(MODULE_START)) {
    const start = app.indexOf(MODULE_START);
    const end = app.indexOf(MODULE_END, start);
    if (end < 0) throw new Error('Could not find defaultData after layout-redesign block');
    app = app.slice(0, start) + mod + '\n\n' + app.slice(end);
    console.log('Refreshed layout-redesign module');
} else {
    const idx = app.indexOf(MODULE_END);
    if (idx < 0) throw new Error('defaultData missing');
    app = app.slice(0, idx) + mod + '\n\n' + app.slice(idx);
    console.log('Inserted layout-redesign module');
}

function tryReplace(src, find, repl, label) {
    if (src.includes(repl) && repl.length > 40) {
        console.warn('Already applied:', label);
        return src;
    }
    if (!src.includes(find)) {
        console.warn('Skip:', label);
        return src;
    }
    return src.replace(find, repl);
}

app = tryReplace(app,
    `    if (typeof initExperienceMode === 'function') {
        try { initExperienceMode(); } catch (err) { console.error('[experience-mode] init failed', err); }
    }`,
    `    if (typeof initExperienceMode === 'function') {
        try { initExperienceMode(); } catch (err) { console.error('[experience-mode] init failed', err); }
    }
    if (typeof initLayoutRedesign === 'function') {
        try { initLayoutRedesign(); } catch (err) { console.error('[layout-redesign] init failed', err); }
    }`,
    'init layout redesign');

app = tryReplace(app,
    `    if (typeof applyExperienceMode === 'function') {
        try { applyExperienceMode(appData); } catch (_) { /* ignore */ }
    }
}`,
    `    if (typeof applyExperienceMode === 'function') {
        try { applyExperienceMode(appData); } catch (_) { /* ignore */ }
    }
    if (typeof applyLayoutRedesign === 'function') {
        try { applyLayoutRedesign(appData); } catch (_) { /* ignore */ }
    }
}`,
    'refresh layout redesign');

app = tryReplace(app,
    `        initInsightsSimplify,
        expandAllInsightsSections,`,
    `        initInsightsSimplify,
        initLayoutRedesign,
        applyLayoutRedesign,
        renderTodayAtAGlance,
        getLayoutTodayCards,
        getLayoutTodayActivityLabel,
        setLayoutTaperWorkspaceView,
        setLayoutSettingsCategory,
        LAYOUT_TAPER_WORKSPACE_VIEWS,
        LAYOUT_SETTINGS_CATEGORIES,
        expandAllInsightsSections,`,
    'export layout redesign');

app = tryReplace(app,
    `let inventoryTabFilter = 'active';`,
    `let inventoryTabFilter = 'all';`,
    'default inventory filter all');

app = tryReplace(app,
    `    ['dashboard-last-saved', 'settings-last-saved'].forEach(id => {`,
    `    ['dashboard-last-saved', 'settings-last-saved', 'home-last-saved'].forEach(id => {`,
    'last saved home id');

app = tryReplace(app,
    `                <button type="button" class="secondary-btn btn-sm purchase-expand-btn" data-purchase-toggle="\${escapeAttr(pid)}" data-toggle-purchase-logs="\${escapeAttr(pid)}" aria-expanded="\${expanded ? 'true' : 'false'}">\${toggleLabel}</button>
                <button type="button" class="secondary-btn btn-sm" data-edit-purchase="\${escapeAttr(pid)}">Edit</button>`,
    `                <button type="button" class="secondary-btn btn-sm" data-inv-row-id="\${escapeAttr(pid)}">View</button>
                <button type="button" class="secondary-btn btn-sm purchase-expand-btn" data-purchase-toggle="\${escapeAttr(pid)}" data-toggle-purchase-logs="\${escapeAttr(pid)}" aria-expanded="\${expanded ? 'true' : 'false'}">\${toggleLabel}</button>
                <button type="button" class="secondary-btn btn-sm" data-edit-purchase="\${escapeAttr(pid)}">Edit</button>`,
    'inventory view button table');

app = tryReplace(app,
    `            <button type="button" class="secondary-btn btn-sm purchase-expand-btn" data-purchase-toggle="\${escapeAttr(pid)}" data-toggle-purchase-logs="\${escapeAttr(pid)}" aria-expanded="\${expanded ? 'true' : 'false'}">\${toggleLabel}</button>
            <button type="button" class="secondary-btn btn-sm" data-edit-purchase="\${escapeAttr(pid)}">Edit</button>`,
    `            <button type="button" class="secondary-btn btn-sm" data-inv-row-id="\${escapeAttr(pid)}">View</button>
            <button type="button" class="secondary-btn btn-sm purchase-expand-btn" data-purchase-toggle="\${escapeAttr(pid)}" data-toggle-purchase-logs="\${escapeAttr(pid)}" aria-expanded="\${expanded ? 'true' : 'false'}">\${toggleLabel}</button>
            <button type="button" class="secondary-btn btn-sm" data-edit-purchase="\${escapeAttr(pid)}">Edit</button>`,
    'inventory view button card');

fs.writeFileSync(path.join(root, 'app.js'), app);
console.log('Wrote app.js');
