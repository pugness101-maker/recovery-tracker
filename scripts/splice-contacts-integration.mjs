#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
let app = fs.readFileSync(path.join(root, 'app.js'), 'utf8');
const moduleCode = fs.readFileSync(path.join(root, 'contacts-integration.module.js'), 'utf8');
let html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
let css = fs.readFileSync(path.join(root, 'styles.css'), 'utf8');
let navMod = fs.readFileSync(path.join(root, 'nav-combine.module.js'), 'utf8');

function tryReplace(src, find, repl, label) {
    if (!src.includes(find)) {
        console.warn(`Skip: ${label}`);
        return src;
    }
    return src.replace(find, repl);
}

function replaceOnce(src, find, repl, label) {
    if (!src.includes(find)) throw new Error(`Missing: ${label}\n${find.slice(0, 160)}`);
    return src.replace(find, repl);
}

// Insert integration module before defaultData (after contacts/chart/weed modules)
if (!app.includes('// ——— Contacts Cross-Tab Integration ———')) {
    const marker = 'const defaultData = {';
    const idx = app.indexOf(marker);
    if (idx < 0) throw new Error('defaultData marker missing');
    app = `${app.slice(0, idx)}${moduleCode}\n\n${app.slice(idx)}`;
    console.log('Spliced contacts-integration module');
} else {
    console.log('Contacts integration already in app.js');
}

// Remove contacts-tab from PRIMARY_TAB_IDS
app = tryReplace(app,
    `    'buy-tracker-tab',
    'contacts-tab',
    'goals-plans-tab',`,
    `    'buy-tracker-tab',
    'goals-plans-tab',`,
    'PRIMARY_TAB_IDS remove contacts');

// Redirect /contacts and /friends to Settings manage contacts
app = tryReplace(app,
    `    '/contacts': { tab: 'contacts-tab', view: null },
    '/friends': { tab: 'contacts-tab', view: null },`,
    `    '/contacts': { tab: 'settings-tab', view: 'contacts' },
    '/friends': { tab: 'settings-tab', view: 'contacts' },`,
    'hash redirects to settings');

app = tryReplace(app,
    `        'contacts-tab': '/contacts',`,
    `        'settings-tab': '/settings',`,
    'buildAppRouteHash contacts');

// Remove switchTab contacts branch — replace with redirect helper
app = tryReplace(app,
    `    } else if (tabId === 'contacts-tab') {
        ensureContactsMigrated(appData);
        renderContactsView();
        syncLocationToCombinedRoute(tabId);
    }`,
    `    } else if (tabId === 'contacts-tab') {
        // Legacy Friends tab removed — open Settings → Manage Contacts.
        if (typeof openManageContactsSettings === 'function') openManageContactsSettings();
        else switchTab('settings-tab');
        return;
    } else if (tabId === 'settings-tab') {
        if (typeof renderContactsView === 'function') renderContactsView();
        if (typeof renderInsightsContactAnalytics === 'function') { /* no-op */ }
    }`,
    'switchTab contacts redirect');

// Migrate persisted activeTab away from contacts-tab
app = tryReplace(app,
    `    if (data.settings.activeTab === 'history-tab'
        || data.settings.activeTab === 'history') {
        data.settings.activeTab = 'use-log-tab';
    }
}`,
    `    if (data.settings.activeTab === 'history-tab'
        || data.settings.activeTab === 'history') {
        data.settings.activeTab = 'use-log-tab';
    }
    if (data.settings.activeTab === 'contacts-tab'
        || data.settings.activeTab === 'contacts'
        || data.settings.activeTab === 'friends') {
        data.settings.activeTab = 'settings-tab';
    }
}`,
    'migrate activeTab from contacts');

// Hook buildUseEntryFromForm to attach contact ids
app = tryReplace(app,
    `        giftPartyName: giftParty,
        recipientName: isGiftGiven ? giftParty : '',
        giverName: isGiftReceived ? giftParty : '',
        sharedWithName: isSharedUse ? (document.getElementById('use-shared-with')?.value?.trim() || '') : '',`,
    `        giftPartyName: giftParty,
        recipientName: isGiftGiven ? giftParty : '',
        giverName: isGiftReceived ? giftParty : '',
        sharedWithName: isSharedUse ? (getContactPickerSelection?.('use-shared-with')?.name || document.getElementById('use-shared-with')?.value?.trim() || '') : '',`,
    'use entry shared name from picker');

if (!app.includes('applyLogContactIdsToEntry(base)')) {
    app = tryReplace(app,
        `    base.trackingMode = isNicotineTrackingMode(substanceId) ? 'nicotine' : getSubstanceTrackingMode(substanceId);

    if (isAlcohol && alcoholCalc && !alcoholCalc.error) {`,
        `    base.trackingMode = isNicotineTrackingMode(substanceId) ? 'nicotine' : getSubstanceTrackingMode(substanceId);
    if (typeof applyLogContactIdsToEntry === 'function') applyLogContactIdsToEntry(base);

    if (isAlcohol && alcoholCalc && !alcoholCalc.error) {`,
        'apply log contact ids');
}

// Hook purchase payload — find applyWeedFieldsToPayload usage or similar buy save
app = tryReplace(app,
    `        giftPartyName: giftParty,`,
    `        giftPartyName: (typeof getContactPickerSelection === 'function' ? getContactPickerSelection('use-gift-party').name : '') || giftParty,`,
    'gift party from picker');

// updateDashboard home cards
app = tryReplace(app,
    `    renderDashboardRecoveryInsights();
    renderRecoveryDashboard();
}`,
    `    renderDashboardRecoveryInsights();
    renderRecoveryDashboard();
    if (typeof renderHomeContactCards === 'function') renderHomeContactCards();
}`,
    'home contact cards');

// updateStats / insights render contact analytics
app = tryReplace(app,
    `    } catch (err) { console.error('Chart dashboard render failed', err); }
    renderGiftAnalytics(insights.bounds);`,
    `    } catch (err) { console.error('Chart dashboard render failed', err); }
    try {
        if (typeof renderInsightsContactAnalytics === 'function') renderInsightsContactAnalytics();
    } catch (err) { console.error('Contact insights render failed', err); }
    renderGiftAnalytics(insights.bounds);`,
    'insights contact analytics');

// Mount pickers when use/buy forms initialize
app = tryReplace(app,
    `    document.getElementById('use-unit')?.addEventListener('change', () => {
        updateVapeUseFormUI();
        updateAlcoholUseFormUI();
        if (typeof updateWeedBudEstimateVisibility === 'function') updateWeedBudEstimateVisibility();
    });`,
    `    document.getElementById('use-unit')?.addEventListener('change', () => {
        updateVapeUseFormUI();
        updateAlcoholUseFormUI();
        if (typeof updateWeedBudEstimateVisibility === 'function') updateWeedBudEstimateVisibility();
    });
    if (typeof initContactsIntegrationUi === 'function') initContactsIntegrationUi();
    if (typeof mountLogContactPickers === 'function') mountLogContactPickers();`,
    'init contact pickers');

// Also remount when transaction type changes — patch updateUseTransactionTypeUI if present
app = tryReplace(app,
    `function updateUseTransactionTypeUI() {`,
    `function updateUseTransactionTypeUI() {
    if (typeof mountLogContactPickers === 'function') mountLogContactPickers();`,
    'remount log pickers on tx type');

// Buy form acquisition change
app = tryReplace(app,
    `function updateBuyWeedProductTypeUI() {`,
    `function updateBuyWeedProductTypeUI() {
    if (typeof mountBuyContactPickers === 'function') mountBuyContactPickers();`,
    'remount buy pickers');

// Use history contact column
app = tryReplace(app,
    `'transactionType', 'amount', 'unit', 'tabs', 'ug', 'pills', 'mg', 'thcUsed', 'cbdUsed', 'strength',
            'enteredAmount', 'normalizedAmount', 'percentBefore', 'percentAfter', 'percentUsed',
            'cost', 'gPerHour', 'sharedAmount', 'multiDayRange', 'dailyBreakdown',`,
    `'transactionType', 'amount', 'unit', 'tabs', 'ug', 'pills', 'mg', 'thcUsed', 'cbdUsed', 'strength',
            'enteredAmount', 'normalizedAmount', 'percentBefore', 'percentAfter', 'percentUsed',
            'contact', 'cost', 'gPerHour', 'sharedAmount', 'multiDayRange', 'dailyBreakdown',`,
    'useHistory contact column order');

app = tryReplace(app,
    `            sharedAmount: 140,
            multiDayRange: 150,`,
    `            contact: 140,
            sharedAmount: 140,
            multiDayRange: 150,`,
    'useHistory contact width');

app = tryReplace(app,
    `        sharedAmount: 'Shared Amount',
        multiDayRange: 'Multi-Day Range',`,
    `        contact: 'Contact',
        sharedAmount: 'Shared Amount',
        multiDayRange: 'Multi-Day Range',`,
    'useHistory contact label');

// Add contact to family columns that show people
for (const family of ['all', 'nicotine', 'cannabis', 'generic', 'cocaine', 'alcohol']) {
    // soft — skip if patterns differ
}

app = tryReplace(app,
    `    cannabis: [
        'select', 'date', 'productType', 'transactionType', 'amount', 'unit',
        'thcUsed', 'cbdUsed', 'strength', 'cost', 'sharedAmount', 'inventory', 'notes', 'actions'
    ],`,
    `    cannabis: [
        'select', 'date', 'productType', 'transactionType', 'amount', 'unit',
        'thcUsed', 'cbdUsed', 'strength', 'cost', 'contact', 'sharedAmount', 'inventory', 'notes', 'actions'
    ],`,
    'cannabis contact col');

app = tryReplace(app,
    `    nicotine: [
        'select', 'date', 'start', 'end', 'duration', 'productType', 'transactionType',
        'amount', 'unit', 'sharedAmount', 'inventory', 'notes', 'actions'
    ],`,
    `    nicotine: [
        'select', 'date', 'start', 'end', 'duration', 'productType', 'transactionType',
        'amount', 'unit', 'contact', 'sharedAmount', 'inventory', 'notes', 'actions'
    ],`,
    'nicotine contact col');

app = tryReplace(app,
    `    all: [
        'select', 'date', 'start', 'end', 'duration', 'substance', 'transactionType',
        'amount', 'unit', 'inventory', 'notes', 'actions'
    ],`,
    `    all: [
        'select', 'date', 'start', 'end', 'duration', 'substance', 'transactionType',
        'amount', 'unit', 'contact', 'inventory', 'notes', 'actions'
    ],`,
    'all contact col');

// Cell renderer for contact
if (!app.includes("case 'contact':")) {
    app = tryReplace(app,
        `        case 'sharedAmount': {
            if (!isSharedUseLog(entry)) return \`<td data-col="\${colId}"\${dataLabel}>—</td>\`;
            return \`<td data-col="\${colId}"\${dataLabel}>Me \${formatAmount(getLogPersonalAmount(entry))} · \${escapeHtml(entry.sharedWithName || 'Other')} \${formatAmount(getLogSharedAmount(entry))}</td>\`;
        }`,
        `        case 'contact': {
            const label = typeof resolveLogContactLabel === 'function' ? resolveLogContactLabel(entry) : (entry.sharedWithName || entry.giftPartyName || '');
            const cid = entry.sharedWithContactId || entry.giftPartyContactId || '';
            if (cid && label) {
                return \`<td data-col="\${colId}"\${dataLabel}><button type="button" class="link-btn" onclick="openContactDetailPanel('\${escapeAttr(cid)}')">\${escapeHtml(label)}</button></td>\`;
            }
            return \`<td data-col="\${colId}"\${dataLabel}>\${label ? escapeHtml(label) : '—'}</td>\`;
        }
        case 'sharedAmount': {
            if (!isSharedUseLog(entry)) return \`<td data-col="\${colId}"\${dataLabel}>—</td>\`;
            return \`<td data-col="\${colId}"\${dataLabel}>Me \${formatAmount(getLogPersonalAmount(entry))} · \${escapeHtml(entry.sharedWithName || 'Other')} \${formatAmount(getLogSharedAmount(entry))}</td>\`;
        }`,
        'contact history cell');
}

// Goal save draft — attach contact fields
app = tryReplace(app,
        `        priority: val('goal-form-priority') || 'normal',`,
        `        priority: val('goal-form-priority') || 'normal',
        accountabilityPartnerContactId: (typeof getContactPickerSelection === 'function' ? getContactPickerSelection('goal-accountability-partner').contactId : '') || '',
        supportContactId: (typeof getContactPickerSelection === 'function' ? getContactPickerSelection('goal-support-contact').contactId : '') || '',
        checkInContactId: (typeof getContactPickerSelection === 'function' ? getContactPickerSelection('goal-checkin-contact').contactId : '') || '',
        accountabilityPartnerName: (typeof getContactPickerSelection === 'function' ? getContactPickerSelection('goal-accountability-partner').name : '') || '',
        supportContactName: (typeof getContactPickerSelection === 'function' ? getContactPickerSelection('goal-support-contact').name : '') || '',
        checkInContactName: (typeof getContactPickerSelection === 'function' ? getContactPickerSelection('goal-checkin-contact').name : '') || '',`,
        'goal contact fields on save');

// Test exports
app = tryReplace(app,
    `        ensureWeedCompletePrefs,
        ensureWeedCompleteMigrated,`,
    `        ensureWeedCompletePrefs,
        ensureWeedCompleteMigrated,
        buildContactPickerHtml,
        getContactPickerSelection,
        selectContactPickerValue,
        clearContactPicker,
        openContactDetailPanel,
        closeContactDetailPanel,
        openManageContactsSettings,
        buildHomeContactCardsHtml,
        buildInsightsContactAnalyticsHtml,
        resolveLogContactLabel,
        applyLogContactIdsToEntry,
        applyBuyContactIdsToPayload,
        applyGoalContactFieldsToDraft,
        applyPlanContactFieldsToDraft,
        renderGoalPlanContactFieldsHtml,
        rankContactsForPicker,
        mountLogContactPickers,
        mountBuyContactPickers,`,
    'contacts integration exports');

// ——— HTML ———
// Remove Friends nav button
html = tryReplace(html,
    `        <button class="nav-btn" data-tab="contacts-tab" onclick="switchTab('contacts-tab')">
            <span>👥</span>
            <span class="nav-btn-label-full">Friends &amp; Contacts</span>
            <span class="nav-btn-label-short">Friends</span>
        </button>
        <button class="nav-btn" data-tab="goals-plans-tab" onclick="switchTab('goals-plans-tab')">`,
    `        <button class="nav-btn" data-tab="goals-plans-tab" onclick="switchTab('goals-plans-tab')">`,
    'remove friends nav button');

// Move contacts-root into Settings; remove standalone tab
html = tryReplace(html,
    `            <!-- Friends & Contacts Tab -->
            <section id="contacts-tab" class="tab contacts-page">
                <div id="contacts-root" class="contacts-root" aria-live="polite"></div>
            </section>

            <!-- Settings Tab -->`,
    `            <!-- Settings Tab -->`,
    'remove contacts tab section');

if (!html.includes('data-section="settingsContacts"')) {
    html = replaceOnce(html,
        `                <div class="collapsible-section" data-section="settingsBackup">
                    <button type="button" class="section-toggle" onclick="toggleSection('settingsBackup')">
                        <span>Data Backup</span>`,
        `                <div class="collapsible-section" data-section="settingsContacts">
                    <button type="button" class="section-toggle" onclick="toggleSection('settingsContacts')">
                        <span>Data &amp; Contacts</span>
                        <span class="chevron">⌄</span>
                    </button>
                    <div class="section-content">
                        <div class="settings-section">
                            <h3>Manage Contacts</h3>
                            <p class="settings-hint">Shared contacts for Log, Inventory, Goals &amp; Plans, Insights, and Home. Archiving never deletes history.</p>
                            <div id="contacts-root" class="contacts-root" aria-live="polite"></div>
                        </div>
                    </div>
                </div>

                <div class="collapsible-section" data-section="settingsBackup">
                    <button type="button" class="section-toggle" onclick="toggleSection('settingsBackup')">
                        <span>Data Backup</span>`,
        'settings manage contacts');
}

// Home contacts root
if (!html.includes('id="dash-contacts-root"')) {
    // Place near end of dashboard tab — before closing section of dashboard if possible
    if (html.includes('id="recovery-dashboard-root"')) {
        html = tryReplace(html,
            `id="recovery-dashboard-root"`,
            `id="recovery-dashboard-root"`, // noop marker
            'dash contacts placeholder');
        html = html.replace(
            /(<div[^>]*id="recovery-dashboard-root"[^>]*><\/div>)/,
            `$1\n                        <div id="dash-contacts-root" class="dash-contacts-root" aria-live="polite"></div>`
        );
        console.log('Added dash-contacts-root');
    } else if (html.includes('id="dashboard-tab"')) {
        html = html.replace(
            /(<section id="dashboard-tab"[^>]*>)/,
            `$1\n                <div id="dash-contacts-root" class="dash-contacts-root" aria-live="polite"></div>`
        );
        console.log('Added dash-contacts-root near dashboard');
    }
}

// Insights contacts section
if (!html.includes('id="insights-contacts-root"') && html.includes('id="chart-dashboard-section"')) {
    html = tryReplace(html,
        `                <div class="collapsible-section" data-section="statsChartDashboard" data-ic-panels="charts overview" id="chart-dashboard-section">`,
        `                <div class="collapsible-section" data-section="statsContactAnalytics" data-ic-panels="overview financial purchase use" id="insights-contacts-section">
                    <button type="button" class="section-toggle" onclick="toggleSection('statsContactAnalytics')">
                        <span>Contact Analytics</span>
                        <span class="chevron">⌄</span>
                    </button>
                    <div class="section-content">
                        <p class="settings-hint">Spending, gifts, and shared use by linked contacts and suppliers.</p>
                        <div id="insights-contacts-root" class="insights-contacts-root" aria-live="polite"></div>
                    </div>
                </div>

                <div class="collapsible-section" data-section="statsChartDashboard" data-ic-panels="charts overview" id="chart-dashboard-section">`,
        'insights contacts section');
}

// Contact detail panel + quick create modal before closing body
if (!html.includes('id="contact-detail-panel"')) {
    html = tryReplace(html,
        `    <!-- Substance Editor Modal -->
    <div id="substance-modal" class="modal hidden">`,
        `    <!-- Contact detail panel (global) -->
    <div id="contact-detail-panel" class="ct-detail-panel hidden" aria-hidden="true" role="dialog" aria-label="Contact details">
        <div class="ct-detail-panel-backdrop" onclick="closeContactDetailPanel()"></div>
        <aside class="ct-detail-panel-sheet" id="contact-detail-panel-body"></aside>
    </div>

    <!-- Quick add contact modal -->
    <div id="contact-quick-modal" class="modal hidden" aria-hidden="true">
        <div class="modal-content">
            <h2>Add contact</h2>
            <form onsubmit="submitContactQuickCreate(event)">
                <div class="form-group">
                    <label for="ct-quick-name">Name</label>
                    <input id="ct-quick-name" required placeholder="Name" autocomplete="off">
                </div>
                <div class="form-group">
                    <label for="ct-quick-nickname">Nickname</label>
                    <input id="ct-quick-nickname" placeholder="Optional" autocomplete="off">
                </div>
                <fieldset class="ct-roles-fieldset"><legend>Roles</legend><div id="ct-quick-roles" class="ct-roles-grid"></div></fieldset>
                <label class="settings-toggle-row"><input type="checkbox" id="ct-quick-favorite"> <span>Favorite</span></label>
                <div class="form-actions">
                    <button type="submit" class="btn-primary">Save</button>
                    <button type="button" class="secondary-btn" onclick="closeContactCreateModal()">Cancel</button>
                </div>
            </form>
        </div>
    </div>

    <!-- Substance Editor Modal -->
    <div id="substance-modal" class="modal hidden">`,
        'contact panel + modal');
}

// Goal form contact fields host — if goal form exists
if (!html.includes('id="goal-contact-fields-root"') && html.includes('id="goal-form-name"')) {
    html = tryReplace(html,
        `id="goal-form-name"`,
        `id="goal-form-name"`,
        'goal form marker');
    // Insert after priority if present
    if (html.includes('id="goal-form-priority"')) {
        html = html.replace(
            /(<\/select>\s*<\/div>\s*)(?=[\s\S]{0,200}goal-form)/,
            (m) => m
        );
    }
}

// Collapsed defaults
app = tryReplace(app,
    `    settingsBackup: true,
    settingsDangerZone: true,`,
    `    settingsBackup: true,
    settingsContacts: false,
    settingsDangerZone: true,
    dashContacts: false,
    statsContactAnalytics: true,`,
    'collapsed contact sections');

// nav-combine.module.js redirects
if (!navMod.includes("'/contacts'")) {
    navMod = tryReplace(navMod,
        `    '/settings': { tab: 'settings-tab', view: null }
};`,
        `    '/settings': { tab: 'settings-tab', view: null },
    '/contacts': { tab: 'settings-tab', view: 'contacts' },
    '/friends': { tab: 'settings-tab', view: 'contacts' }
};`,
        'nav-combine contacts redirects');
}

// CSS
if (!css.includes('.ct-detail-panel')) {
    css += `

/* Contacts cross-tab integration */
.ct-picker { position: relative; display: flex; flex-direction: column; gap: 4px; }
.ct-picker-row { display: flex; gap: 6px; align-items: center; }
.ct-picker-search { flex: 1; min-height: 40px; }
.ct-picker-menu {
    position: absolute; left: 0; right: 0; top: calc(100% + 2px); z-index: 40;
    max-height: 240px; overflow: auto; border: 1px solid var(--border);
    border-radius: 10px; background: var(--bg, #fff); box-shadow: 0 8px 24px rgba(0,0,0,0.12);
}
.ct-picker-group { padding: 6px; }
.ct-picker-group > span { display: block; font-size: 0.75rem; color: var(--text-secondary); margin: 4px 6px; }
.ct-picker-option {
    display: block; width: 100%; text-align: left; border: 0; background: transparent;
    padding: 8px 10px; border-radius: 8px; color: var(--text); cursor: pointer;
}
.ct-picker-option:hover, .ct-picker-option:focus { background: rgba(127,127,127,0.12); }
.ct-picker-add { font-weight: 600; }
.ct-detail-panel { position: fixed; inset: 0; z-index: 13000; }
.ct-detail-panel.hidden { display: none; }
.ct-detail-panel-backdrop { position: absolute; inset: 0; background: rgba(0,0,0,0.35); }
.ct-detail-panel-sheet {
    position: absolute; top: 0; right: 0; width: min(440px, 100%); height: 100%;
    overflow: auto; background: var(--bg, #fff); padding: 16px;
    box-shadow: -8px 0 32px rgba(0,0,0,0.18);
}
.ct-home-grid, .ct-summary-grid {
    display: grid; grid-template-columns: repeat(auto-fit, minmax(140px, 1fr)); gap: 10px;
}
.ct-home-card, .ct-card {
    border: 1px solid var(--border); border-radius: 12px; padding: 10px 12px;
    background: var(--panel, var(--bg-card, #fff));
}
.ct-home-card span, .ct-card span { display: block; font-size: 0.78rem; color: var(--text-secondary); }
.ct-home-card strong, .ct-card strong { display: block; margin-top: 4px; }
.contacts-root { margin-top: 8px; }
.dash-contacts-root, .insights-contacts-root { margin-top: 10px; }
@media (max-width: 720px) {
    .ct-detail-panel-sheet { width: 100%; border-radius: 16px 16px 0 0; top: auto; bottom: 0; height: min(88vh, 100%); }
}
`;
    console.log('Appended contacts integration CSS');
}

fs.writeFileSync(path.join(root, 'app.js'), app);
fs.writeFileSync(path.join(root, 'index.html'), html);
fs.writeFileSync(path.join(root, 'styles.css'), css);
fs.writeFileSync(path.join(root, 'nav-combine.module.js'), navMod);
console.log('splice-contacts-integration complete');
