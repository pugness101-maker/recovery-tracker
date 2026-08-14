#!/usr/bin/env node
/**
 * Splice optional Cloud Sync (Supabase) into app.js + index.html + styles.css
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
let app = fs.readFileSync(path.join(root, 'app.js'), 'utf8');
let html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
let css = fs.readFileSync(path.join(root, 'styles.css'), 'utf8');
const mod = fs.readFileSync(path.join(root, 'cloud-sync.module.js'), 'utf8');

function tryReplace(src, find, repl, label) {
    if (!src.includes(find)) {
        console.warn('Skip:', label);
        return src;
    }
    if (src.includes(repl) && repl.length > 40) {
        console.warn('Already applied:', label);
        return src;
    }
    return src.replace(find, repl);
}

function ensureSingleCloudConfigScript(html) {
    const tag = '<script src="cloud-config.js"></script>';
    const appTag = '<script src="app.js" defer></script>';
    html = html.replace(/\n?[ \t]*<script src="cloud-config\.js"><\/script>/g, '');
    if (!html.includes(appTag)) {
        console.warn('Missing marker: cloud-config script');
        return html;
    }
    return html.replace(appTag, `${tag}\n    ${appTag}`);
}

function ensureSingleSmToast(html) {
    const toast = '<div id="sm-toast" class="sm-toast hidden" role="status" aria-live="polite"></div>';
    const toastRe = /\n?[ \t]*<div id="sm-toast" class="sm-toast hidden" role="status" aria-live="polite"><\/div>/g;
    const count = (html.match(/id="sm-toast"/g) || []).length;
    if (count === 1) return html;
    html = html.replace(toastRe, '');
    const appTag = '<script src="app.js" defer></script>';
    const cloudTag = '<script src="cloud-config.js"></script>';
    const anchor = html.includes(cloudTag) ? cloudTag : appTag;
    if (!html.includes(anchor)) {
        console.warn('Missing marker: sm-toast');
        return html;
    }
    return html.replace(anchor, `${toast}\n    ${anchor}`);
}

const MODULE_START = '// ——— Cloud Sync (optional account layer) ———';
const MODULE_END = 'const defaultData = {';

if (app.includes(MODULE_START)) {
    const start = app.indexOf(MODULE_START);
    const end = app.indexOf(MODULE_END, start);
    if (end < 0) throw new Error('Could not find defaultData after cloud-sync block');
    app = app.slice(0, start) + mod + '\n\n' + app.slice(end);
    console.log('Refreshed cloud-sync module');
} else {
    const idx = app.indexOf(MODULE_END);
    if (idx < 0) throw new Error('defaultData missing');
    app = app.slice(0, idx) + mod + '\n\n' + app.slice(idx);
    console.log('Inserted cloud-sync module');
}

app = tryReplace(app,
    `    ensurePurchaseIds(data);

    data.logs.forEach(log => {`,
    `    ensurePurchaseIds(data);
    if (typeof ensureSyncableRecordIds === 'function') {
        try { ensureSyncableRecordIds(data); } catch (_) { /* keep load going */ }
    }

    data.logs.forEach(log => {`,
    'ensureSyncableRecordIds in normalizeAppData');

app = tryReplace(app,
    `function saveData(data) {
    try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
        const savedAt = new Date().toISOString();
        localStorage.setItem(LAST_SAVED_KEY, savedAt);
        invalidateInsightsDatasetCache();
        updateLastSavedDisplay(savedAt);
        console.log('Saved recovery data');
        return true;
    } catch (err) {
        console.error('Failed to save recovery data:', err);
        return false;
    }
}`,
    `function saveData(data) {
    try {
        if (typeof ensureSyncableRecordIds === 'function') {
            try { ensureSyncableRecordIds(data); } catch (_) { /* local save still proceeds */ }
        }
        if (data?.settings && typeof data.settings === 'object'
            && typeof getCloudAuthState === 'function') {
            try {
                if (getCloudAuthState().signedIn) {
                    data.settings.updatedAt = new Date().toISOString();
                }
            } catch (_) { /* ignore */ }
        }
        localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
        const savedAt = new Date().toISOString();
        localStorage.setItem(LAST_SAVED_KEY, savedAt);
        invalidateInsightsDatasetCache();
        updateLastSavedDisplay(savedAt);
        console.log('Saved recovery data');
        try {
            if (typeof onLocalDataSaved === 'function') onLocalDataSaved(data);
        } catch (syncErr) {
            console.error('Cloud sync hook failed; local data was kept', syncErr);
        }
        return true;
    } catch (err) {
        console.error('Failed to save recovery data:', err);
        return false;
    }
}`,
    'saveData local-first then cloud hook');

app = tryReplace(app,
    `    persistLoadedAppDataIfNeeded();
    syncSpreadPercentLeftToggle();`,
    `    persistLoadedAppDataIfNeeded();
    if (typeof initCloudSync === 'function') {
        try { initCloudSync(); } catch (err) { console.error('[cloud-sync] init failed', err); }
    }
    syncSpreadPercentLeftToggle();`,
    'initCloudSync');

app = tryReplace(app,
    `function applyImportedBackup(imported, mode, extras = null) {
    createAutoBackup(mode === 'replace' ? 'before-import-replace' : 'before-import-merge');
    const normalized = normalizeImportedAppData(imported);`,
    `function applyImportedBackup(imported, mode, extras = null) {
    createAutoBackup(mode === 'replace' ? 'before-import-replace' : 'before-import-merge');
    if (mode === 'replace' && typeof beginLocalDataReset === 'function') beginLocalDataReset();
    const normalized = normalizeImportedAppData(imported);`,
    'import replace skip tombstones start');

app = tryReplace(app,
    `    normalizeAppData(appData);
    repairAppDataAfterImport(appData);
    saveData(appData);
    if (extras) applyImportedColumnSettings(extras);
    else if (imported && (imported.columnSettings || imported.purchaseHistoryColumns)) {
        applyImportedColumnSettings(imported);
    }
    refreshAppAfterDataChange();
}`,
    `    normalizeAppData(appData);
    repairAppDataAfterImport(appData);
    saveData(appData);
    if (mode === 'replace' && typeof endLocalDataReset === 'function') endLocalDataReset(appData);
    if (extras) applyImportedColumnSettings(extras);
    else if (imported && (imported.columnSettings || imported.purchaseHistoryColumns)) {
        applyImportedColumnSettings(imported);
    }
    refreshAppAfterDataChange();
}`,
    'import replace skip tombstones end');

app = tryReplace(app,
    `function clearAllData() {
    if (!confirm('Clear ALL data? This cannot be undone.')) return;
    if (!confirm('Delete all logs, substances, and settings?')) return;
    pushChangeHistory('before-clear', { summary: 'Before clearing all data' });
    createAutoBackup('before-clear');
    appData = getDefaultAppData();
    appData.substances = getDefaultSubstances();
    saveData(appData);
    refreshAppAfterDataChange();
    alert('All data cleared.');
}`,
    `function clearAllData() {
    if (!confirm('Delete all Recovery Tracker data from THIS DEVICE? Cloud account data is not deleted.')) return;
    if (!confirm('This cannot be undone on this device. Continue?')) return;
    pushChangeHistory('before-clear', { summary: 'Before clearing all data' });
    createAutoBackup('before-clear');
    if (typeof beginLocalDataReset === 'function') beginLocalDataReset();
    appData = getDefaultAppData();
    appData.substances = getDefaultSubstances();
    saveData(appData);
    if (typeof endLocalDataReset === 'function') endLocalDataReset(appData);
    refreshAppAfterDataChange();
    alert('This device’s data was cleared. Cloud account data was not deleted.');
}`,
    'clearAllData device-only');

app = tryReplace(app,
    `        formatSimpleRepeatLastLabel,
        hasMeaningfulRecoveryData,`,
    `        formatSimpleRepeatLastLabel,
        CLOUD_AUTH_KEY,
        CLOUD_META_KEY,
        CLOUD_COLLECTIONS,
        CLOUD_SYNC_DEBOUNCE_MS,
        ensureSyncableRecordIds,
        mergeCloudRecords,
        mergeCloudAndLocalData,
        firstSignInDecision,
        cloudPayloadHasMeaningfulData,
        inferDeletedIds,
        createMemoryCloudTransport,
        setCloudTransportForTests,
        getCloudSyncStatus,
        getCloudAuthState,
        getCloudConfig,
        onLocalDataSaved,
        runCloudSyncNow,
        queueCloudSync,
        cancelQueuedCloudSync,
        afterCloudSignIn,
        backupLocalDataToAccount,
        dismissCloudBackupOffer,
        cloudSignUp,
        cloudSignIn,
        cloudSignOut,
        cloudForgotPassword,
        cloudDeleteCloudData,
        cloudDeleteAccount,
        confirmDeleteCloudData,
        confirmDeleteAccount,
        confirmDeleteLocalDeviceData,
        ensureFreshCloudSession,
        isAccessTokenExpired,
        normalizeCloudSession,
        expireStoredCloudSessionForTests,
        beginLocalDataReset,
        endLocalDataReset,
        hasMeaningfulRecoveryData,`,
    'cloud sync test exports');

app = tryReplace(app,
    `        cloudDeleteCloudAccountData,
        confirmDeleteCloudAccountData,
        confirmDeleteLocalDeviceData,
        beginLocalDataReset,
        endLocalDataReset,
        hasMeaningfulRecoveryData,`,
    `        cloudDeleteCloudData,
        cloudDeleteAccount,
        confirmDeleteCloudData,
        confirmDeleteAccount,
        confirmDeleteLocalDeviceData,
        ensureFreshCloudSession,
        isAccessTokenExpired,
        normalizeCloudSession,
        expireStoredCloudSessionForTests,
        beginLocalDataReset,
        endLocalDataReset,
        hasMeaningfulRecoveryData,`,
    'upgrade cloud sync test exports');

html = tryReplace(html,
    `                <div class="collapsible-section" data-section="settingsBackup">
                    <button type="button" class="section-toggle" onclick="toggleSection('settingsBackup')">
                        <span>Data Backup</span>
                        <span class="chevron">⌄</span>
                    </button>
                    <div class="section-content">
                <div class="settings-section">
                    <p id="settings-last-saved" class="last-saved-status">Last Saved: Never</p>
                    <p class="last-saved-status">Last auto-backup: <span id="settings-auto-backup-date">Never</span></p>
                    <p class="data-storage-note">Data is stored only in this browser (localStorage). A local backup is created automatically before import, reset, migration, or bulk repair.</p>
                    <input type="file" id="import-json-input" accept=".json,application/json" class="hidden" onchange="handleImportJsonFile(event)">
                    <div class="data-management-buttons">
                        <button type="button" class="secondary-btn" onclick="exportJsonBackup()">Export JSON Backup</button>
                        <button type="button" class="secondary-btn" onclick="triggerImportJsonBackup()">Import JSON Backup</button>
                        <button type="button" class="secondary-btn" onclick="restoreLastAutoBackup()">Restore Last Backup</button>
                        <button type="button" class="secondary-btn" onclick="exportDataCsv()">Export CSV</button>
                        <button type="button" class="secondary-btn" onclick="repairAppData()">Repair Data</button>
                    </div>
                    <label class="settings-toggle-row" for="settings-use-custom-names-in-csv">
                        <input type="checkbox" id="settings-use-custom-names-in-csv">
                        <span>Use custom names in CSV export</span>
                    </label>
                    <p class="settings-hint">Off by default so CSV headers stay stable. Turn on to use your Display names in table CSV exports.</p>
                </div>
                    </div>
                </div>

                <div class="collapsible-section" data-section="settingsDangerZone">
                    <button type="button" class="section-toggle" onclick="toggleSection('settingsDangerZone')">
                        <span>Danger Zone</span>
                        <span class="chevron">⌄</span>
                    </button>
                    <div class="section-content">
                <div class="settings-section danger-zone-section">
                    <p class="settings-hint">Permanently delete all logs, substances, and settings. An automatic backup is created first.</p>
                    <button type="button" class="danger-btn" onclick="clearAllData()">Clear All Data</button>
                </div>
                    </div>
                </div>`,
    `                <div class="collapsible-section" data-section="settingsBackup">
                    <button type="button" class="section-toggle" onclick="toggleSection('settingsBackup')">
                        <span>Account &amp; Data</span>
                        <span class="chevron">⌄</span>
                    </button>
                    <div class="section-content">
                <div class="settings-section" id="settings-cloud-sync">
                    <h3>Cloud Sync</h3>
                    <p class="settings-hint">This device saves immediately. Cloud sync is optional and never required to use Recovery Tracker.</p>
                    <div id="cloud-sync-root" class="cloud-sync-root" aria-live="polite"></div>
                </div>
                <div class="settings-section">
                    <h3>Data &amp; Backup</h3>
                    <p id="settings-last-saved" class="last-saved-status">Last Saved: Never</p>
                    <p class="last-saved-status">Last auto-backup: <span id="settings-auto-backup-date">Never</span></p>
                    <p class="data-storage-note">Data is stored in this browser first (localStorage). Optional cloud sync never replaces JSON export. A local backup is created automatically before import, reset, migration, or bulk repair.</p>
                    <input type="file" id="import-json-input" accept=".json,application/json" class="hidden" onchange="handleImportJsonFile(event)">
                    <div class="data-management-buttons">
                        <button type="button" class="secondary-btn" onclick="exportJsonBackup()">Export JSON Backup</button>
                        <button type="button" class="secondary-btn" onclick="triggerImportJsonBackup()">Import JSON Backup</button>
                        <button type="button" class="secondary-btn" onclick="restoreLastAutoBackup()">Restore Last Backup</button>
                        <button type="button" class="secondary-btn" onclick="exportDataCsv()">Export CSV</button>
                        <button type="button" class="secondary-btn" onclick="repairAppData()">Repair Data</button>
                    </div>
                    <label class="settings-toggle-row" for="settings-use-custom-names-in-csv">
                        <input type="checkbox" id="settings-use-custom-names-in-csv">
                        <span>Use custom names in CSV export</span>
                    </label>
                    <p class="settings-hint">Off by default so CSV headers stay stable. Turn on to use your Display names in table CSV exports.</p>
                </div>
                    </div>
                </div>

                <div class="collapsible-section" data-section="settingsDangerZone">
                    <button type="button" class="section-toggle" onclick="toggleSection('settingsDangerZone')">
                        <span>Danger Zone</span>
                        <span class="chevron">⌄</span>
                    </button>
                    <div class="section-content">
                <div class="settings-section danger-zone-section">
                    <h3>Delete Cloud Data</h3>
                    <p class="settings-hint">Removes Recovery Tracker rows stored in your account. This does not delete your login. This device’s local logs are kept. You will be signed out so this device does not immediately re-upload.</p>
                    <button type="button" class="danger-btn" onclick="confirmDeleteCloudData()">Delete Cloud Data</button>
                    <h3>Delete Account</h3>
                    <p class="settings-hint">Permanently deletes your cloud Recovery Tracker data and your login. This device’s local data is kept unless you also delete data from this device. Requires the server-side delete-account function.</p>
                    <button type="button" class="danger-btn" onclick="confirmDeleteAccount()">Delete Account</button>
                    <h3>Delete data from this device</h3>
                    <p class="settings-hint">Permanently delete logs, substances, and settings on this device only. An automatic backup is created first. Cloud account data and your login are not deleted.</p>
                    <button type="button" class="danger-btn" onclick="clearAllData()">Delete data from this device</button>
                </div>
                    </div>
                </div>`,
    'account and data settings UI');

html = tryReplace(html,
    `                    <h3>Delete cloud account data</h3>
                    <p class="settings-hint">Removes Recovery Tracker rows stored in your account. This device’s local logs are kept. Full Auth user deletion is done in the Supabase dashboard (or an optional Edge Function), not by this button.</p>
                    <button type="button" class="danger-btn" onclick="confirmDeleteCloudAccountData()">Delete cloud account data</button>
                    <h3>Delete data from this device</h3>
                    <p class="settings-hint">Permanently delete logs, substances, and settings on this device only. An automatic backup is created first. Cloud account data is not deleted.</p>
                    <button type="button" class="danger-btn" onclick="clearAllData()">Delete data from this device</button>`,
    `                    <h3>Delete Cloud Data</h3>
                    <p class="settings-hint">Removes Recovery Tracker rows stored in your account. This does not delete your login. This device’s local logs are kept. You will be signed out so this device does not immediately re-upload.</p>
                    <button type="button" class="danger-btn" onclick="confirmDeleteCloudData()">Delete Cloud Data</button>
                    <h3>Delete Account</h3>
                    <p class="settings-hint">Permanently deletes your cloud Recovery Tracker data and your login. This device’s local data is kept unless you also delete data from this device. Requires the server-side delete-account function.</p>
                    <button type="button" class="danger-btn" onclick="confirmDeleteAccount()">Delete Account</button>
                    <h3>Delete data from this device</h3>
                    <p class="settings-hint">Permanently delete logs, substances, and settings on this device only. An automatic backup is created first. Cloud account data and your login are not deleted.</p>
                    <button type="button" class="danger-btn" onclick="clearAllData()">Delete data from this device</button>`,
    'rename delete cloud data vs delete account');

html = ensureSingleSmToast(html);
html = ensureSingleCloudConfigScript(html);

if (!css.includes('.cloud-sync-root')) {
    css += `

.cloud-sync-root {
    margin: 8px 0 16px;
}
.cloud-sync-status {
    margin: 0 0 8px;
    font-size: 0.92rem;
    color: var(--text-secondary);
}
.cloud-sync-status[data-cloud-status="syncing"] {
    color: var(--text-primary);
}
.cloud-sync-status[data-cloud-status="error"] {
    color: var(--danger, #c62828);
}
.cloud-auth-form,
.cloud-backup-offer {
    display: grid;
    gap: 10px;
    margin: 12px 0;
}
.cloud-auth-form .sm-field {
    display: grid;
    gap: 4px;
}
.cloud-auth-error {
    color: var(--danger, #c62828);
}
.danger-zone-section h3 {
    margin-top: 16px;
}
`;
    console.log('Appended cloud-sync CSS');
}

fs.writeFileSync(path.join(root, 'app.js'), app);
fs.writeFileSync(path.join(root, 'index.html'), html);
fs.writeFileSync(path.join(root, 'styles.css'), css);
console.log('Wrote cloud-sync splice');
