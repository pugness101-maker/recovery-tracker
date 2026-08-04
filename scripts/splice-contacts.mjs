#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
let app = fs.readFileSync(path.join(root, 'app.js'), 'utf8');
const moduleCode = fs.readFileSync(path.join(root, 'contacts.module.js'), 'utf8');
let html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
let css = fs.readFileSync(path.join(root, 'styles.css'), 'utf8');

function replaceOnce(src, find, repl, label) {
    if (!src.includes(find)) throw new Error(`Missing patch target: ${label}\n---\n${find.slice(0, 240)}`);
    return src.replace(find, repl);
}

if (!app.includes('// ——— Friends & Contacts ———')) {
    const marker = 'const defaultData = {';
    const idx = app.indexOf(marker);
    if (idx < 0) throw new Error('defaultData marker missing');
    app = `${app.slice(0, idx)}${moduleCode}\n\n${app.slice(idx)}`;
    console.log('Spliced contacts module');
} else {
    console.log('Contacts module already present');
}

if (!app.includes('contacts: [],')) {
    app = replaceOnce(app,
        '    budgets: [],\n    settings: {',
        '    budgets: [],\n    contacts: [],\n    settings: {',
        'defaultData.contacts');
}

if (!app.includes('ensureContacts(data)') && !app.includes('ensureContactsMigrated(data)')) {
    // will add ensure hook below
}

if (!app.includes('ensureContactsMigrated(data);') && !app.includes('ensureContactsMigrated(data)')) {
    try {
        app = replaceOnce(app,
            '    migratePurchaseAnalytics(data);\n    ensureTableColumnSettings(data);',
            '    migratePurchaseAnalytics(data);\n    ensureContactsMigrated(data);\n    ensureContactsPrefs(data);\n    ensureTableColumnSettings(data);',
            'ensure contacts on load');
    } catch (_) {
        app = replaceOnce(app,
            '    migrateFinancialAnalytics(data);\n    ensurePurchaseAnalyticsPrefs(data);',
            '    migrateFinancialAnalytics(data);\n    ensurePurchaseAnalyticsPrefs(data);\n    ensureContactsMigrated(data);\n    ensureContactsPrefs(data);',
            'ensure contacts alt');
    }
}

// normalizeAppData contacts array
if (!app.includes('data.contacts = Array.isArray(data.contacts)')) {
    try {
        app = replaceOnce(app,
            '    data.budgets = Array.isArray(data.budgets) ? data.budgets : [];\n\n    ensurePurchaseIds(data);',
            '    data.budgets = Array.isArray(data.budgets) ? data.budgets : [];\n    data.contacts = Array.isArray(data.contacts) ? data.contacts : [];\n\n    ensurePurchaseIds(data);',
            'normalize contacts array');
    } catch (e) {
        console.warn(e.message);
    }
}

// export
if (!app.includes('contacts: (data.contacts || []).map')) {
    try {
        app = replaceOnce(app,
            '        budgets: (data.budgets || []).map(b => ({ ...b })),\n\n        recoveryStreaks: data.recoveryStreaks || {},',
            '        budgets: (data.budgets || []).map(b => ({ ...b })),\n        contacts: (data.contacts || []).filter(c => c && !c.excludeFromExport).map(c => {\n            const copy = { ...c };\n            if (copy.localNotesOnly) copy.notes = \'\';\n            return copy;\n        }),\n\n        recoveryStreaks: data.recoveryStreaks || {},',
            'export contacts');
    } catch (e) {
        console.warn(e.message);
    }
}

// import normalize
if (!app.includes('if (!Array.isArray(data.contacts)) data.contacts = [];')) {
    try {
        app = replaceOnce(app,
            '    if (!Array.isArray(data.budgets)) data.budgets = [];\n    if (!data.recoveryStreaks',
            '    if (!Array.isArray(data.budgets)) data.budgets = [];\n    if (!Array.isArray(data.contacts)) data.contacts = [];\n    if (!data.recoveryStreaks',
            'import normalize contacts');
    } catch (e) {
        console.warn(e.message);
    }
}

// merge
if (!app.includes('if (Array.isArray(imported.contacts))')) {
    try {
        app = replaceOnce(app,
            '    if (Array.isArray(imported.budgets)) {\n        merged.budgets = mergeArrayById(merged.budgets || [], imported.budgets);\n    }\n    merged.recoveryStreaks',
            '    if (Array.isArray(imported.budgets)) {\n        merged.budgets = mergeArrayById(merged.budgets || [], imported.budgets);\n    }\n    if (Array.isArray(imported.contacts)) {\n        merged.contacts = mergeArrayById(merged.contacts || [], imported.contacts);\n    }\n    merged.recoveryStreaks',
            'merge contacts');
    } catch (e) {
        console.warn(e.message);
    }
}

// PRIMARY_TAB_IDS
if (!app.includes("'contacts-tab'")) {
    app = replaceOnce(app,
        `const PRIMARY_TAB_IDS = new Set([
    'dashboard-tab',
    'use-log-tab',
    'buy-tracker-tab',
    'goals-plans-tab',
    'insights-calendar-tab',
    'settings-tab'
]);`,
        `const PRIMARY_TAB_IDS = new Set([
    'dashboard-tab',
    'use-log-tab',
    'buy-tracker-tab',
    'contacts-tab',
    'goals-plans-tab',
    'insights-calendar-tab',
    'settings-tab'
]);`,
        'primary tab ids');
}

// switchTab branch
if (!app.includes("tabId === 'contacts-tab'")) {
    app = replaceOnce(app,
        `    } else if (tabId === 'goals-plans-tab') {
        if (typeof renderGoalsPlansCombinedView === 'function') renderGoalsPlansCombinedView();
        else if (typeof renderGoalsView === 'function') renderGoalsView();`,
        `    } else if (tabId === 'contacts-tab') {
        if (typeof ensureContactsMigrated === 'function') ensureContactsMigrated(appData);
        if (typeof renderContactsView === 'function') renderContactsView();
        if (typeof syncLocationToCombinedRoute === 'function') syncLocationToCombinedRoute(tabId);
    } else if (tabId === 'goals-plans-tab') {
        if (typeof renderGoalsPlansCombinedView === 'function') renderGoalsPlansCombinedView();
        else if (typeof renderGoalsView === 'function') renderGoalsView();`,
        'switchTab contacts');
}

// Route map
if (!app.includes("'/contacts':")) {
    try {
        app = replaceOnce(app,
            "    '/inventory': { tab: 'buy-tracker-tab', view: null },",
            "    '/inventory': { tab: 'buy-tracker-tab', view: null },\n    '/contacts': { tab: 'contacts-tab', view: null },\n    '/friends': { tab: 'contacts-tab', view: null },",
            'route contacts');
    } catch (e) {
        console.warn(e.message);
    }
}

if (!app.includes("'contacts-tab': '/contacts'")) {
    try {
        app = replaceOnce(app,
            "        'buy-tracker-tab': '/inventory',",
            "        'buy-tracker-tab': '/inventory',\n        'contacts-tab': '/contacts',",
            'hash map contacts');
    } catch (e) {
        console.warn(e.message);
    }
}

// Calendar events
if (!app.includes('mapContactsToCalendarEvents')) {
    try {
        app = replaceOnce(app,
            `    if (typeof mapFinancialCalendarEvents === 'function') {
        mapFinancialCalendarEvents(bounds, data).forEach(ev => events.push(ev));
    }`,
            `    if (typeof mapFinancialCalendarEvents === 'function') {
        mapFinancialCalendarEvents(bounds, data).forEach(ev => events.push(ev));
    }
    if (typeof mapContactsToCalendarEvents === 'function') {
        mapContactsToCalendarEvents(bounds, data).forEach(ev => events.push(ev));
    }`,
            'calendar contact events');
    } catch (e) {
        console.warn(e.message);
    }
}

// financialPurchaseSupplier prefer contact
if (!app.includes('resolvePurchaseSupplierContact')) {
    try {
        app = replaceOnce(app,
            `function financialPurchaseSupplier(purchase) {
    const store = finTrim(purchase?.store || purchase?.location || '');
    if (store) return store;
    const giftSource = typeof getPurchaseGiftSource === 'function' ? finTrim(getPurchaseGiftSource(purchase)) : '';
    return giftSource || finTrim(purchase?.dealer || purchase?.contact || '');
}`,
            `function financialPurchaseSupplier(purchase) {
    if (typeof resolvePurchaseSupplierContact === 'function') {
        const linked = resolvePurchaseSupplierContact(purchase);
        if (linked?.name) return finTrim(linked.name);
    }
    if (purchase?.supplierContactId && typeof getContactById === 'function') {
        const c = getContactById(purchase.supplierContactId);
        if (c?.name) return finTrim(c.name);
    }
    const store = finTrim(purchase?.store || purchase?.location || '');
    if (store) return store;
    const giftSource = typeof getPurchaseGiftSource === 'function' ? finTrim(getPurchaseGiftSource(purchase)) : '';
    return giftSource || finTrim(purchase?.dealer || purchase?.contact || '');
}`,
            'supplier prefers contact');
    } catch (e) {
        console.warn(e.message);
    }
}

// Test exports
if (!app.includes('ensureContacts,')) {
    app = replaceOnce(app,
        '        migratePurchaseAnalytics,',
        `        migratePurchaseAnalytics,
        ensureContacts,
        ensureContactsMigrated,
        ensureContactsPrefs,
        getContacts,
        getContactById,
        findContactByName,
        normalizeContactRecord,
        saveContactRecord,
        archiveContact,
        restoreContact,
        mergeContacts,
        migrateContactsFromFreeText,
        collectFreeTextContactNames,
        buildContactRecoveryMetrics,
        buildContactSupplierProfile,
        buildContactSupportProfile,
        buildContactTimeline,
        buildContactsDashboard,
        buildContactAnalytics,
        buildContactSuggestions,
        detectDuplicateContacts,
        mapContactsToCalendarEvents,
        buildContactsCsvRows,
        exportContactsCsv,
        convertFreeTextNameToContact,
        resolveContactDisplayName,
        resolvePurchaseSupplierContact,
        'contacts test exports');
}

// HTML tab + nav
if (!html.includes('id="contacts-tab"')) {
    const contactsSection = `
            <!-- Friends & Contacts Tab -->
            <section id="contacts-tab" class="tab contacts-page">
                <div id="contacts-root" class="contacts-root" aria-live="polite"></div>
            </section>
`;
    html = replaceOnce(html,
        '            <!-- Settings Tab -->',
        `${contactsSection}
            <!-- Settings Tab -->`,
        'contacts tab section');
}

if (!html.includes('data-tab="contacts-tab"')) {
    html = replaceOnce(html,
        `        <button class="nav-btn" data-tab="buy-tracker-tab" onclick="switchTab('buy-tracker-tab')">
            <span>📦</span>
            <span>Inventory</span>
        </button>
        <button class="nav-btn" data-tab="goals-plans-tab" onclick="switchTab('goals-plans-tab')">`,
        `        <button class="nav-btn" data-tab="buy-tracker-tab" onclick="switchTab('buy-tracker-tab')">
            <span>📦</span>
            <span>Inventory</span>
        </button>
        <button class="nav-btn" data-tab="contacts-tab" onclick="switchTab('contacts-tab')">
            <span>👥</span>
            <span class="nav-btn-label-full">Friends &amp; Contacts</span>
            <span class="nav-btn-label-short">Friends</span>
        </button>
        <button class="nav-btn" data-tab="goals-plans-tab" onclick="switchTab('goals-plans-tab')">`,
        'nav contacts button');
}

if (!css.includes('.contacts-root')) {
    css += `

/* Friends & Contacts */
.contacts-root { min-height: 200px; }
.ct-page { display: flex; flex-direction: column; gap: 14px; }
.ct-page-head h2 { margin: 0 0 4px; }
.ct-subnav { display: flex; flex-wrap: nowrap; gap: 6px; overflow-x: auto; margin-top: 10px; }
.ct-subnav-btn {
    flex: 0 0 auto; border: 1px solid var(--border); background: var(--panel, #fff);
    color: var(--text-secondary); border-radius: 999px; padding: 8px 12px; font-size: 0.82rem; cursor: pointer;
}
.ct-subnav-btn.active { color: var(--accent); border-color: var(--accent); font-weight: 600; }
.ct-summary-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(140px, 1fr)); gap: 10px; }
.ct-card { border: 1px solid var(--border); border-radius: 12px; padding: 12px; background: var(--panel, var(--bg-card, #fff)); }
.ct-card span { display: block; font-size: 0.78rem; color: var(--text-secondary); }
.ct-card strong { display: block; margin-top: 4px; font-size: 1.05rem; }
.ct-text { font-size: 0.95rem !important; }
.ct-actions { display: flex; flex-wrap: wrap; gap: 8px; }
.ct-panel { border: 1px solid var(--border); border-radius: 12px; padding: 12px; background: var(--surface, transparent); }
.ct-panel h3, .ct-panel h4 { margin: 0 0 8px; }
.ct-toolbar { display: flex; flex-wrap: wrap; gap: 8px; margin-bottom: 12px; }
.ct-search, .ct-toolbar select, .ct-form input, .ct-form textarea, .ct-inline-select {
    min-height: 40px; border: 1px solid var(--border); border-radius: 8px; padding: 6px 10px;
    background: var(--bg, #fff); color: var(--text);
}
.ct-search { flex: 1 1 180px; }
.ct-card-list { display: flex; flex-direction: column; gap: 8px; }
.ct-contact-card {
    text-align: left; border: 1px solid var(--border); border-radius: 12px; padding: 12px;
    background: var(--panel, #fff); cursor: pointer; color: inherit;
}
.ct-contact-card-head { display: flex; justify-content: space-between; gap: 8px; }
.ct-role-row { display: flex; flex-wrap: wrap; gap: 4px; margin: 6px 0; }
.ct-role-chip {
    font-size: 0.72rem; border-radius: 999px; padding: 2px 8px;
    background: rgba(127,127,127,0.12); color: var(--text-secondary);
}
.ct-form-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(160px, 1fr)); gap: 8px; }
.ct-span-2 { grid-column: 1 / -1; }
.ct-roles-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(160px, 1fr)); gap: 6px; }
.ct-role-check { font-size: 0.85rem; }
.ct-form-toggles { display: flex; flex-wrap: wrap; gap: 10px; margin: 10px 0; font-size: 0.85rem; }
.ct-suggestion-list, .ct-timeline { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: 8px; }
.ct-suggestion { border-left: 3px solid var(--accent); padding: 8px 10px; background: rgba(127,127,127,0.08); border-radius: 0 8px 8px 0; }
.ct-suggestion.ct-warn { border-left-color: #ef6c00; }
.ct-empty, .ct-loading, .ct-error { color: var(--text-secondary); font-size: 0.9rem; }
.ct-detail-head { display: flex; flex-wrap: wrap; justify-content: space-between; gap: 10px; margin-bottom: 12px; }
.ct-detail-actions { display: flex; flex-wrap: wrap; gap: 6px; }
@media (max-width: 720px) {
    .ct-summary-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); }
}
`;
    console.log('Appended contacts CSS');
}

fs.writeFileSync(path.join(root, 'app.js'), app);
fs.writeFileSync(path.join(root, 'index.html'), html);
fs.writeFileSync(path.join(root, 'styles.css'), css);
console.log('splice-contacts complete');
