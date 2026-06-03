// Recovery Tracker v2 — dynamic substance tracking
const STORAGE_KEY = 'recovery-tracker-v2';
const STORAGE_KEY_V1 = 'use-tracker-v1';
const LAST_SAVED_KEY = 'recovery-tracker-v2-last-saved';
const DASHBOARD_ALL = 'all';

const SUBSTANCE_ICONS = ['🚬', '💨', '🍺', '🌿', '💊', '☕', '🍬', '💉', '🎯', '⚡', '🧪', '📦', '🔥', '❄️', '💧', '🌸'];
const SUBSTANCE_COLORS = ['#4caf50', '#42a5f5', '#ffb74d', '#66bb6a', '#ab47bc', '#ef5350', '#78909c', '#26a69a', '#ff7043', '#5c6bc0'];

const V1_NAME_TO_ID = {
    'Cigarettes': 'cigarettes',
    'Vapes/Nicotine': 'vape-nicotine',
    'Vape/Nicotine': 'vape-nicotine',
    'Alcohol': 'alcohol',
    'Weed/THC': 'weed-thc'
};

function createSubstance(opts) {
    return {
        id: opts.id,
        name: opts.name,
        icon: opts.icon || '📦',
        color: opts.color || '#4caf50',
        units: opts.units || ['units'],
        defaultUnit: opts.defaultUnit || opts.units?.[0] || 'units',
        costTrackingEnabled: opts.costTrackingEnabled !== false,
        taperTrackingEnabled: opts.taperTrackingEnabled !== false,
        active: opts.active !== false,
        isMain: opts.isMain === true
    };
}

function getDefaultSubstances() {
    return [
        createSubstance({
            id: 'cigarettes',
            name: 'Cigarettes',
            icon: '🚬',
            color: '#78909c',
            units: ['cigarettes', 'packs'],
            defaultUnit: 'cigarettes',
            costTrackingEnabled: true,
            taperTrackingEnabled: true,
            isMain: true
        }),
        createSubstance({
            id: 'vape-nicotine',
            name: 'Vape/Nicotine',
            icon: '💨',
            color: '#42a5f5',
            units: ['puffs', 'hits', 'pods', 'ml'],
            defaultUnit: 'puffs',
            costTrackingEnabled: true,
            taperTrackingEnabled: true
        }),
        createSubstance({
            id: 'alcohol',
            name: 'Alcohol',
            icon: '🍺',
            color: '#ffb74d',
            units: ['drinks', 'beers', 'shots', 'ounces'],
            defaultUnit: 'drinks',
            costTrackingEnabled: true,
            taperTrackingEnabled: true
        }),
        createSubstance({
            id: 'weed-thc',
            name: 'Weed/THC',
            icon: '🌿',
            color: '#66bb6a',
            units: ['grams', 'joints', 'bowls', 'hits', 'edibles'],
            defaultUnit: 'grams',
            costTrackingEnabled: true,
            taperTrackingEnabled: true
        })
    ];
}

function getDefaultSubstanceSettings() {
    return {
        cigarettes: { packPrice: 10, unitsPerPack: 20, baseline: 20, quitGoal: '' },
        'vape-nicotine': { packPrice: 20, unitsPerPack: 200, baseline: 20, quitGoal: '' },
        alcohol: { packPrice: 15, unitsPerPack: 6, baseline: 2, quitGoal: '' },
        'weed-thc': { packPrice: 50, unitsPerPack: 28, baseline: 1, quitGoal: '' }
    };
}

const SESSION_RATE_HIGH_MULTIPLIER = 1.5;
const SESSION_SHORT_BREAK_HOURS = 2;
const SESSION_LONG_BREAK_HOURS = 12;
const SUPPLY_LOW_REMAINING_PCT = 0.25;
const INVENTORY_EPS = 0.0001;

const defaultData = {
    substances: getDefaultSubstances(),
    logs: [],
    purchases: [],
    cravings: [],
    settings: {
        currency: '$',
        reminderMessage: '',
        openOnMainSubstance: true,
        substanceSettings: getDefaultSubstanceSettings()
    },
    taperPlans: {},
    recoveryStreaks: {},
    supportContacts: [],
    reasons: [],
    privacy: {
        enabled: false,
        pinHash: '',
        autoLockMinutes: 5
    },
    migrations: {}
};

let editingSubstanceId = null;
let editingPurchaseId = null;
let editingUseId = null;
let taperEditingPlan = false;

function slugify(name) {
    return name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || `substance-${Date.now()}`;
}

function uniqueSubstanceId(name, excludeId) {
    let base = slugify(name);
    let id = base;
    let n = 1;
    while (appData.substances.some(s => s.id === id && s.id !== excludeId)) {
        id = `${base}-${n++}`;
    }
    return id;
}

function migrateFromV1(v1) {
    const substances = getDefaultSubstances();
    const nameToId = { ...V1_NAME_TO_ID };
    const substanceSettings = { ...getDefaultSubstanceSettings() };

    const ensureSubstance = (name) => {
        if (nameToId[name]) return nameToId[name];
        let id = slugify(name);
        let n = 1;
        while (substances.some(s => s.id === id)) {
            id = `${slugify(name)}-${n++}`;
        }
        substances.push(createSubstance({
            id,
            name,
            icon: '📦',
            color: SUBSTANCE_COLORS[substances.length % SUBSTANCE_COLORS.length],
            units: ['units'],
            defaultUnit: 'units',
            costTrackingEnabled: true,
            taperTrackingEnabled: true
        }));
        nameToId[name] = id;
        if (v1.settings?.substanceSettings?.[name]) {
            substanceSettings[id] = { ...v1.settings.substanceSettings[name] };
        }
        return id;
    };

    Object.keys(v1.settings?.substanceSettings || {}).forEach(name => {
        const id = ensureSubstance(name);
        if (!substanceSettings[id]) substanceSettings[id] = { ...v1.settings.substanceSettings[name] };
    });

    (v1.customSubstances || []).forEach(name => ensureSubstance(name));

    const mapRef = (ref) => {
        if (!ref) return ref;
        if (nameToId[ref]) return nameToId[ref];
        return ensureSubstance(ref);
    };

    const logs = (v1.logs || []).map(log => ({
        ...log,
        substanceId: mapRef(log.substanceId || log.substance)
    }));

    const cravings = (v1.cravings || []).map(c => ({
        ...c,
        substanceId: mapRef(c.substanceId || c.substance)
    }));

    const taperPlans = {};
    Object.entries(v1.taperPlans || {}).forEach(([key, plan]) => {
        taperPlans[mapRef(key)] = plan;
    });

    const recoveryStreaks = {};
    Object.entries(v1.recoveryStreaks || {}).forEach(([key, val]) => {
        recoveryStreaks[mapRef(key)] = val;
    });

    const settingsSubstance = {};
    Object.entries(v1.settings?.substanceSettings || {}).forEach(([name, val]) => {
        settingsSubstance[mapRef(name)] = val;
    });

    const purchases = (v1.packPurchases || []).map(p => {
        const qty = (p.packsBought || 1) * (p.unitsPerPack || 1);
        return {
            id: p.id,
            substanceId: mapRef(p.substanceId || p.substance),
            date: p.date,
            time: '12:00',
            quantityBought: qty,
            quantity: qty,
            unit: 'units',
            totalCost: p.packPrice || 0,
            costPerUnit: qty > 0 ? (p.packPrice || 0) / qty : 0,
            remainingAmount: qty,
            isDepleted: false,
            store: p.store || '',
            paymentMethod: '',
            notes: p.notes || ''
        };
    });

    return {
        substances,
        logs,
        purchases,
        cravings,
        settings: {
            currency: v1.settings?.currency || '$',
            reminderMessage: v1.settings?.reminderMessage || '',
            substanceSettings: { ...substanceSettings, ...settingsSubstance }
        },
        taperPlans,
        recoveryStreaks,
        supportContacts: v1.supportContacts || [],
        reasons: v1.reasons || [],
        privacy: v1.privacy || { ...defaultData.privacy }
    };
}

function loadData() {
    const raw = localStorage.getItem(STORAGE_KEY);
    let data;

    if (raw) {
        data = JSON.parse(raw);
        if (!data.substances?.length) data.substances = getDefaultSubstances();
        if (!data.privacy) data.privacy = { ...defaultData.privacy };
        if (!data.recoveryStreaks) data.recoveryStreaks = {};
    } else {
        const v1 = localStorage.getItem(STORAGE_KEY_V1);
        if (v1) {
            data = migrateFromV1(JSON.parse(v1));
            localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
        } else {
            data = typeof structuredClone === 'function'
                ? structuredClone(defaultData)
                : JSON.parse(JSON.stringify(defaultData));
        }
    }

    return normalizeAppData(data);
}

function normalizeLegacyRefs(data) {
    data.logs?.forEach(log => {
        if (!log.substanceId && log.substance) log.substanceId = log.substance;
    });
    data.cravings?.forEach(c => {
        if (!c.substanceId && c.substance) c.substanceId = c.substance;
    });
}

function normalizeAppData(data) {
    normalizeLegacyRefs(data);
    data.logs = data.logs || [];
    data.purchases = data.purchases || [];
    data.cravings = data.cravings || [];

    data.logs.forEach(log => {
        if (!log.type) log.type = log.endTime ? 'session' : 'quick';
        if (!log.startTime && log.time) log.startTime = log.time;
        const fallbackTs = log.timestamp || (log.date && (log.startTime || log.time)
            ? new Date(`${log.date}T${log.startTime || log.time}`).toISOString()
            : null);
        if (!log.createdAt) log.createdAt = fallbackTs || new Date().toISOString();
        if (!log.updatedAt) log.updatedAt = log.createdAt;
        if (!log.timestamp && fallbackTs) log.timestamp = fallbackTs;
    });

    (data.sessions || []).forEach(s => {
        data.logs.push({
            id: s.id,
            type: 'session',
            substanceId: s.substanceId || s.substance,
            date: s.date,
            startTime: s.startTime,
            endTime: s.endTime,
            amount: s.amount,
            unit: s.unit,
            count: s.count || 0,
            notes: s.notes || '',
            timestamp: s.timestamp || new Date().toISOString(),
            createdAt: s.createdAt || s.timestamp || new Date().toISOString(),
            updatedAt: s.updatedAt || s.createdAt || s.timestamp || new Date().toISOString()
        });
    });
    delete data.sessions;

    const legacyPurchases = data.packPurchases || [];
    legacyPurchases.forEach(p => {
        const qty = (p.packsBought || 1) * (p.unitsPerPack || 1);
        data.purchases.push({
            id: p.id,
            substanceId: p.substanceId || p.substance,
            date: p.date,
            time: p.time || '12:00',
            quantityBought: qty,
            quantity: qty,
            unit: 'units',
            totalCost: p.packPrice || 0,
            costPerUnit: qty > 0 ? (p.packPrice || 0) / qty : 0,
            remainingAmount: qty,
            isDepleted: false,
            store: p.store || '',
            paymentMethod: '',
            notes: p.notes || ''
        });
    });
    delete data.packPurchases;
    delete data.currentPack;

    data.purchases.forEach(p => {
        if (!p.substanceId && p.substance) p.substanceId = p.substance;
        if (!p.costPerUnit && p.quantity > 0) p.costPerUnit = p.totalCost / p.quantity;
    });

    migrateInventoryLinkedV1(data);

    data.purchases.forEach(p => {
        migratePurchaseInventory(p, data.logs || [], data);
    });

    ensureAppDataSettings(data);
    ensureAppDataMigrations(data);
    normalizeMainSubstances(data);
    Object.entries(data.taperPlans || {}).forEach(([substanceId, plan]) => {
        migrateTaperPlan(plan, substanceId);
    });
    return data;
}

function ensureAppDataMigrations(data) {
    if (!data.migrations) data.migrations = {};
}

function ensureAppDataSettings(data) {
    if (!data.settings) {
        data.settings = JSON.parse(JSON.stringify(defaultData.settings));
    }
    if (!data.settings.substanceSettings) {
        data.settings.substanceSettings = getDefaultSubstanceSettings();
    }
    if (data.settings.openOnMainSubstance === undefined) {
        data.settings.openOnMainSubstance = true;
    }
    if (!data.settings.currency) data.settings.currency = '$';
    if (data.settings.reminderMessage === undefined) data.settings.reminderMessage = '';
}

function normalizeMainSubstances(data) {
    if (!data.substances?.length) return;
    data.substances.forEach(s => {
        if (s.isMain === undefined) s.isMain = false;
    });
    const active = data.substances.filter(s => s.active);
    if (!active.length) {
        data.substances.forEach(s => { s.isMain = false; });
        return;
    }
    let main = active.find(s => s.isMain);
    if (!main) {
        main = active[0];
        main.isMain = true;
    }
    data.substances.forEach(s => {
        s.isMain = s.active && s.id === main.id;
    });
}

function saveData(data) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
    const savedAt = new Date().toISOString();
    localStorage.setItem(LAST_SAVED_KEY, savedAt);
    updateLastSavedDisplay(savedAt);
}

function getLastSavedTimestamp() {
    return localStorage.getItem(LAST_SAVED_KEY);
}

function formatLastSaved(iso) {
    if (!iso) return 'Never';
    const d = new Date(iso);
    return Number.isNaN(d.getTime()) ? 'Never' : d.toLocaleString();
}

function updateLastSavedDisplay(iso) {
    const label = `Last Saved: ${formatLastSaved(iso || getLastSavedTimestamp())}`;
    ['dashboard-last-saved', 'settings-last-saved'].forEach(id => {
        const el = document.getElementById(id);
        if (el) el.textContent = label;
    });
}

function setText(id, text) {
    const el = document.getElementById(id);
    if (el) el.textContent = text;
}

function setInputValue(id, value) {
    const el = document.getElementById(id);
    if (el != null) el.value = value;
}

function getMainSubstance() {
    return appData.substances.find(s => s.active && s.isMain) || getActiveSubstances()[0] || null;
}

function getMainSubstanceId() {
    return getMainSubstance()?.id || null;
}

function shouldOpenOnMainSubstance() {
    return appData.settings?.openOnMainSubstance !== false;
}

function resolveStartupSubstanceId() {
    if (shouldOpenOnMainSubstance()) {
        const mainId = getMainSubstanceId();
        if (mainId) return mainId;
    }
    return appData.substances.find(s => s.active)?.id || 'cigarettes';
}

function sortSubstancesMainFirst(list) {
    return [...list].sort((a, b) => {
        if (a.isMain !== b.isMain) return a.isMain ? -1 : 1;
        if (a.active !== b.active) return a.active ? -1 : 1;
        return a.name.localeCompare(b.name);
    });
}

document.addEventListener('DOMContentLoaded', () => {
    try {
        initializeApp();
    } catch (error) {
        console.error('Error initializing app:', error);
    }
});

function initializeApp() {
    setupEventListeners();
    loadSettings();
    populateAllSubstanceDropdowns();
    syncSubstanceSelectors();
    syncTaperSubstanceToMain();
    updateDashboard();
    renderRecentUseList();
    renderCalendar();
    refreshTaperDashboard();
    renderSupportContacts();
    renderReasons();
    renderSubstancesList();
    setupBuyTrackerForm();
    setupUseLogForm();
    setupSubstanceForm();
    setDefaultUseLogDateTime();
    refreshAllRecoveryStreaks();
    updateQuickActions();
    updateDashboardMainDisplay();
    applyMainSubstanceToForms();

    updateLastSavedDisplay();
}

function refreshAppAfterDataChange() {
    currentSubstanceId = resolveStartupSubstanceId();
    loadSettings();
    populateAllSubstanceDropdowns();
    syncSubstanceSelectors();
    applyMainSubstanceToForms();
    applyMainSubstanceToViewSelectors();
    updateDashboard();
    updateDashboardMainDisplay();
    updateQuickActions();
    renderRecentUseList();
    renderUseLogTab();
    updateStats();
    renderBuyTrackerTab();
    renderCalendar();
    syncTaperSubstanceToMain();
    refreshTaperDashboard();
    renderSubstancesList();
    renderSupportContacts();
    renderReasons();
    refreshAllRecoveryStreaks();
}

// ——— Substance helpers ———
function getSubstance(id, data = appData) {
    if (!id) return null;
    const substances = data?.substances || [];
    return substances.find(s => s.id === id || s.name === id) || null;
}

function getSubstanceName(id) {
    return getSubstance(id)?.name || 'Unknown';
}

function getActiveSubstances() {
    return sortSubstancesMainFirst(appData.substances.filter(s => s.active));
}

function setMainSubstance(id) {
    const sub = getSubstance(id);
    if (!sub) return;
    if (!sub.active) return alert('Only active substances can be set as main.');
    appData.substances.forEach(s => { s.isMain = s.id === id; });
    saveData(appData);
    if (shouldOpenOnMainSubstance()) currentSubstanceId = id;
    populateAllSubstanceDropdowns();
    syncSubstanceSelectors();
    applyMainSubstanceToForms();
    renderSubstancesList();
    updateDashboardMainDisplay();
    updateDashboard();
    updateQuickActions();
    syncTaperSubstanceToMain();
    refreshTaperDashboard();
}

function applyMainSubstanceToForms() {
    const mainId = getMainSubstanceId();
    if (!mainId) return;
    ['use-substance', 'buy-substance', 'craving-substance'].forEach(selectId => {
        const el = document.getElementById(selectId);
        if (el && [...el.options].some(o => o.value === mainId)) el.value = mainId;
    });
    updateUseUnitDropdown();
    updateBuyUnitDropdown();
    updateUseTaperPreview();
}

function applyMainSubstanceToViewSelectors() {
    if (!shouldOpenOnMainSubstance()) return;
    const mainId = getMainSubstanceId();
    if (!mainId) return;
    currentSubstanceId = mainId;
    ['dashboard-substance', 'stats-substance'].forEach(selectId => {
        const el = document.getElementById(selectId);
        if (el && [...el.options].some(o => o.value === mainId)) el.value = mainId;
    });
    const taperEl = document.getElementById('taper-substance');
    if (taperEl && [...taperEl.options].some(o => o.value === mainId)) taperEl.value = mainId;
    const calEl = document.getElementById('calendar-substance');
    if (calEl && [...calEl.options].some(o => o.value === mainId)) calEl.value = mainId;
}

function getLoggableSubstances() {
    return getActiveSubstances();
}

function getCostTrackedSubstances() {
    return appData.substances.filter(s => s.active && s.costTrackingEnabled);
}

function getTaperSubstances() {
    return sortSubstancesMainFirst(appData.substances.filter(s => s.active && s.taperTrackingEnabled));
}

function getAveragePurchaseCostPerUnit(substanceId) {
    const purchases = (appData.purchases || []).filter(p => getPurchaseSubstanceId(p) === substanceId);
    const withCpu = purchases.filter(p => {
        const cpu = parseFloat(p.costPerUnit);
        return Number.isFinite(cpu) && cpu > 0;
    });
    if (!withCpu.length) return null;
    return withCpu.reduce((s, p) => s + parseFloat(p.costPerUnit), 0) / withCpu.length;
}

function getTaperStartingDailyAverage(substanceId) {
    const plan = appData.taperPlans?.[substanceId];
    if (!plan) return null;
    const val = plan.startingDailyAverage ?? plan.currentAvg;
    return val != null && val !== '' ? parseFloat(val) : null;
}

function isAllSubstancesView() {
    return currentSubstanceId === DASHBOARD_ALL;
}

function buildSubstanceOption(sub, { includeIcon = true } = {}) {
    const opt = document.createElement('option');
    opt.value = sub.id;
    const prefix = sub.isMain ? '⭐ ' : '';
    opt.textContent = includeIcon ? `${prefix}${sub.icon} ${sub.name}` : `${prefix}${sub.name}`;
    opt.style.color = sub.color;
    return opt;
}

function populateSelect(selectId, substances, { includeAll = false, currentValue } = {}) {
    const dropdown = document.getElementById(selectId);
    if (!dropdown) return;
    const prev = currentValue ?? dropdown.value;
    dropdown.innerHTML = '';
    if (includeAll) {
        const all = document.createElement('option');
        all.value = DASHBOARD_ALL;
        all.textContent = '📊 All Substances';
        dropdown.appendChild(all);
    }
    substances.forEach(sub => dropdown.appendChild(buildSubstanceOption(sub)));
    const valid = [...dropdown.options].some(o => o.value === prev);
    dropdown.value = valid ? prev : (substances[0]?.id || '');
}

function populateAllSubstanceDropdowns() {
    const mainId = getMainSubstanceId();
    const active = getActiveSubstances();
    const taperSubs = sortSubstancesMainFirst(getTaperSubstances());
    const viewDefault = shouldOpenOnMainSubstance() && mainId ? mainId : currentSubstanceId;

    populateSelect('dashboard-substance', active, { includeAll: true, currentValue: viewDefault });
    populateSelect('craving-substance', getLoggableSubstances(), { currentValue: mainId });
    populateSelect('stats-substance', active, { includeAll: true, currentValue: viewDefault });
    populateSelect('taper-substance', taperSubs, { currentValue: mainId && taperSubs.some(s => s.id === mainId) ? mainId : taperSubs[0]?.id });
    populateSelect('use-substance', getLoggableSubstances(), { currentValue: mainId });
    populateSelect('buy-substance', active, { currentValue: mainId });
    populateSelect('calendar-substance', taperSubs, { currentValue: mainId && taperSubs.some(s => s.id === mainId) ? mainId : taperSubs[0]?.id });
    updateUseUnitDropdown();
    updateBuyUnitDropdown();
}

function syncSubstanceSelectors() {
    ['dashboard-substance', 'stats-substance'].forEach(id => {
        const el = document.getElementById(id);
        if (el && [...el.options].some(o => o.value === currentSubstanceId)) {
            el.value = currentSubstanceId;
        }
    });
    const taperEl = document.getElementById('taper-substance');
    if (taperEl && getTaperSubstances().some(s => s.id === currentSubstanceId)) {
        taperEl.value = currentSubstanceId;
    }
}

function updateUseUnitDropdown() {
    const substanceSelect = document.getElementById('use-substance');
    const unitSelect = document.getElementById('use-unit');
    if (!substanceSelect || !unitSelect) return;
    const sub = getSubstance(substanceSelect.value);
    const units = sub?.units || ['units'];
    unitSelect.innerHTML = '';
    units.forEach(unit => {
        const option = document.createElement('option');
        option.value = unit;
        option.textContent = unit;
        unitSelect.appendChild(option);
    });
    if (sub?.defaultUnit) unitSelect.value = sub.defaultUnit;
}

function updateBuyUnitDropdown() {
    const substanceSelect = document.getElementById('buy-substance');
    const unitSelect = document.getElementById('buy-unit');
    if (!substanceSelect || !unitSelect) return;
    const sub = getSubstance(substanceSelect.value);
    const units = sub?.units || ['units'];
    unitSelect.innerHTML = '';
    units.forEach(unit => {
        const option = document.createElement('option');
        option.value = unit;
        option.textContent = unit;
        unitSelect.appendChild(option);
    });
    if (sub?.defaultUnit) unitSelect.value = sub.defaultUnit;
}

function updateQuickActions() {
    const sub = isAllSubstancesView() ? getMainSubstance() : getSubstance(currentSubstanceId);
    const logBtn = document.getElementById('quick-log-btn');
    if (logBtn && sub) {
        logBtn.querySelector('.quick-icon').textContent = sub.icon;
        logBtn.querySelector('.quick-label').textContent = 'Quick Use';
    }
}

function switchSubstance(substanceId) {
    currentSubstanceId = substanceId;
    const statsSelect = document.getElementById('stats-substance');
    if (statsSelect) statsSelect.value = substanceId;
    updateDashboard();
    updateTaperProgress();
    checkTaperTarget();
    updateQuickActions();
}

function switchStatsSubstance(substanceId) {
    currentSubstanceId = substanceId;
    const dash = document.getElementById('dashboard-substance');
    if (dash) dash.value = substanceId;
    updateStats();
}

function filterLogsBySubstance(logs, substanceId) {
    if (substanceId === DASHBOARD_ALL) return logs;
    return logs.filter(log => log.substanceId === substanceId);
}

function filterCravingsBySubstance(cravings, substanceId) {
    if (substanceId === DASHBOARD_ALL) return cravings;
    return cravings.filter(c => c.substanceId === substanceId);
}

// ——— Manage Substances ———
function renderSubstancesList() {
    const container = document.getElementById('substances-list');
    if (!container) return;
    container.innerHTML = '';

    const sorted = sortSubstancesMainFirst(appData.substances);

    if (sorted.length === 0) {
        container.innerHTML = '<p class="empty-hint">No substances yet. Add one below.</p>';
        return;
    }

    sorted.forEach(sub => {
        const item = document.createElement('div');
        item.className = `substance-card ${sub.active ? '' : 'archived'}`;
        item.style.borderLeftColor = sub.color;
        item.innerHTML = `
            <div class="substance-card-main">
                <span class="substance-card-icon">${sub.icon}</span>
                <div>
                    <strong>${sub.name}</strong>${sub.isMain ? ' <span class="main-badge">⭐ Main</span>' : ''}
                    <div class="substance-card-meta">
                        ${sub.defaultUnit} · ${sub.costTrackingEnabled ? '💰 cost' : ''}${sub.costTrackingEnabled && sub.taperTrackingEnabled ? ' · ' : ''}${sub.taperTrackingEnabled ? '📉 taper' : ''}
                        ${!sub.active ? ' · <em>archived</em>' : ''}
                    </div>
                </div>
            </div>
            <div class="substance-card-actions">
                ${sub.active && !sub.isMain ? `<button type="button" class="secondary-btn main-set-btn" onclick="setMainSubstance('${sub.id}')">⭐ Set as Main</button>` : ''}
                <button type="button" class="secondary-btn" onclick="openSubstanceEditor('${sub.id}')">Edit</button>
                ${sub.active
                    ? `<button type="button" class="secondary-btn" onclick="archiveSubstance('${sub.id}')">Archive</button>`
                    : `<button type="button" class="secondary-btn" onclick="restoreSubstance('${sub.id}')">Restore</button>`}
                <button type="button" class="delete-btn" onclick="deleteSubstance('${sub.id}')">Delete</button>
            </div>
        `;
        container.appendChild(item);
    });
}

function openSubstanceEditor(id) {
    editingSubstanceId = id || null;
    const modal = document.getElementById('substance-modal');
    const title = document.getElementById('substance-editor-title');
    const unitsInput = document.getElementById('substance-units');
    const iconPicker = document.getElementById('substance-icon-picker');
    const colorPicker = document.getElementById('substance-color-picker');
    if (!modal || !title || !unitsInput || !iconPicker || !colorPicker) return;

    title.textContent = id ? 'Edit Substance' : 'Add Substance';
    iconPicker.innerHTML = '';
    SUBSTANCE_ICONS.forEach(icon => {
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'icon-pick-btn icon-option';
        btn.textContent = icon;
        btn.dataset.icon = icon;
        btn.onclick = () => {
            iconPicker.querySelectorAll('.icon-option').forEach(b => b.classList.remove('selected'));
            btn.classList.add('selected');
            setInputValue('substance-icon', icon);
        };
        iconPicker.appendChild(btn);
    });

    colorPicker.innerHTML = '';
    SUBSTANCE_COLORS.forEach(color => {
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'color-pick-btn color-option';
        btn.style.background = color;
        btn.dataset.color = color;
        btn.onclick = () => {
            colorPicker.querySelectorAll('.color-option').forEach(b => b.classList.remove('selected'));
            btn.classList.add('selected');
            setInputValue('substance-color', color);
        };
        colorPicker.appendChild(btn);
    });

    const submitBtn = document.getElementById('save-substance-btn');
    if (submitBtn) submitBtn.textContent = id ? 'Save Changes' : 'Save Substance';

    if (id) {
        const sub = getSubstance(id);
        setInputValue('substance-name', sub.name);
        setInputValue('substance-icon', sub.icon);
        setInputValue('substance-color', sub.color);
        setInputValue('substance-default-unit', sub.defaultUnit);
        unitsInput.value = sub.units.join(', ');
        const costEl = document.getElementById('substance-cost-tracking');
        const taperEl = document.getElementById('substance-taper-tracking');
        if (costEl) costEl.checked = sub.costTrackingEnabled;
        if (taperEl) taperEl.checked = sub.taperTrackingEnabled;
        iconPicker.querySelectorAll('.icon-option').forEach(b => {
            if (b.textContent === sub.icon || b.dataset.icon === sub.icon) b.classList.add('selected');
        });
        colorPicker.querySelectorAll('.color-option').forEach(b => {
            if (b.dataset.color === sub.color) b.classList.add('selected');
        });
    } else {
        const form = document.getElementById('substance-form');
        form?.reset();
        setInputValue('substance-icon', '📦');
        setInputValue('substance-color', SUBSTANCE_COLORS[0]);
        const costEl = document.getElementById('substance-cost-tracking');
        const taperEl = document.getElementById('substance-taper-tracking');
        if (costEl) costEl.checked = true;
        if (taperEl) taperEl.checked = true;
        unitsInput.value = 'units';
        setInputValue('substance-default-unit', 'units');
        iconPicker.querySelector('.icon-option')?.classList.add('selected');
        colorPicker.querySelector('.color-option')?.classList.add('selected');
    }

    modal.classList.remove('hidden');
    document.getElementById('substance-name')?.focus();
}

function closeSubstanceEditor() {
    closeSubstanceModal();
}

function closeSubstanceModal() {
    document.getElementById('substance-modal')?.classList.add('hidden');
    document.getElementById('substance-form')?.reset();
    editingSubstanceId = null;
}

function handleSubstanceSubmit(e) {
    if (e) e.preventDefault();

    console.log('[substance] submit started');

    try {
        if (!appData || typeof appData !== 'object') appData = {};
        if (!Array.isArray(appData.substances)) appData.substances = [];
        if (!appData.settings) appData.settings = {};
        if (!appData.settings.substanceSettings) appData.settings.substanceSettings = {};

        const nameEl = document.getElementById('substance-name');
        const unitsEl = document.getElementById('substance-units');
        const defaultUnitEl = document.getElementById('substance-default-unit');

        if (!nameEl) {
            alert('Missing substance-name input.');
            console.error('[substance] missing #substance-name');
            return;
        }

        const name = nameEl.value.trim();

        if (!name) {
            alert('Enter a substance name.');
            return;
        }

        const duplicate = appData.substances.some(s =>
            String(s.name || '').toLowerCase() === name.toLowerCase()
            && s.id !== editingSubstanceId
        );

        if (duplicate) {
            alert('That substance already exists.');
            return;
        }

        const selectedIcon = document.querySelector('#substance-icon-picker .icon-option.selected')
            || document.querySelector('.icon-option.selected');
        const selectedColor = document.querySelector('#substance-color-picker .color-option.selected')
            || document.querySelector('.color-option.selected');

        const icon = selectedIcon?.dataset.icon || selectedIcon?.textContent?.trim() || '📦';
        const color = selectedColor?.dataset.color
            || document.getElementById('substance-color')?.value
            || SUBSTANCE_COLORS[0];

        const unitsText = unitsEl?.value?.trim() || 'units';
        const units = unitsText.split(',').map(u => u.trim()).filter(Boolean);
        if (units.length === 0) units.push('units');

        const defaultUnit = defaultUnitEl?.value?.trim() || units[0] || 'units';
        const costTrackingEnabled = document.getElementById('substance-cost-tracking')?.checked !== false;
        const taperTrackingEnabled = document.getElementById('substance-taper-tracking')?.checked !== false;

        let savedSubstance;

        if (editingSubstanceId) {
            const idx = appData.substances.findIndex(s => s.id === editingSubstanceId);
            if (idx < 0) {
                alert('Substance to edit was not found.');
                return;
            }
            savedSubstance = {
                ...appData.substances[idx],
                name,
                icon,
                color,
                units,
                defaultUnit,
                costTrackingEnabled,
                taperTrackingEnabled,
                active: true,
                archived: false,
                updatedAt: new Date().toISOString()
            };
            appData.substances[idx] = savedSubstance;
        } else {
            const activeCount = appData.substances.filter(s => s.active && !s.archived).length;
            savedSubstance = {
                id: 'sub-' + Date.now(),
                name,
                icon,
                color,
                units,
                defaultUnit,
                active: true,
                archived: false,
                isMain: activeCount === 0,
                costTrackingEnabled,
                taperTrackingEnabled,
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString()
            };

            appData.substances.push(savedSubstance);

            appData.settings.substanceSettings[savedSubstance.id] = {
                defaultUnit,
                units
            };
        }

        normalizeMainSubstances(appData);
        localStorage.setItem(STORAGE_KEY, JSON.stringify(appData));
        const savedAt = new Date().toISOString();
        localStorage.setItem(LAST_SAVED_KEY, savedAt);
        console.log('[substance] saved', savedSubstance);

        const wasEdit = !!editingSubstanceId;
        safeRefreshAfterSubstanceSave();
        alert(wasEdit ? 'Substance updated: ' + name : 'Substance added: ' + name);
    } catch (err) {
        console.error('[substance] save failed', err);
        alert('Save failed. Open Console and send the red error.');
    }
}

function safeRefreshAfterSubstanceSave() {
    try {
        if (typeof updateLastSaved === 'function') updateLastSaved();
        else if (typeof updateLastSavedDisplay === 'function') updateLastSavedDisplay();
    } catch (err) {
        console.error('[substance] updateLastSaved failed', err);
    }
    try {
        if (typeof closeSubstanceModal === 'function') closeSubstanceModal();
    } catch (err) {
        console.error('[substance] closeSubstanceModal failed', err);
    }
    try {
        if (typeof renderSubstances === 'function') renderSubstances();
        else if (typeof renderSubstancesList === 'function') renderSubstancesList();
    } catch (err) {
        console.error('[substance] renderSubstances failed', err);
    }
    try {
        if (typeof populateSubstanceDropdowns === 'function') populateSubstanceDropdowns();
        else if (typeof populateAllSubstanceDropdowns === 'function') populateAllSubstanceDropdowns();
    } catch (err) {
        console.error('[substance] populateSubstanceDropdowns failed', err);
    }
    try {
        if (typeof updateDashboard === 'function') updateDashboard();
    } catch (err) {
        console.error('[substance] updateDashboard failed', err);
    }
    try {
        if (typeof refreshAppAfterDataChange === 'function') refreshAppAfterDataChange();
    } catch (err) {
        console.error('[substance] refreshAppAfterDataChange failed', err);
    }
}

function setupSubstanceForm() {
    const form = document.getElementById('substance-form');
    if (!form) {
        console.warn('[substance] #substance-form not found');
        return;
    }
    if (form.dataset.submitBound !== 'true') {
        form.addEventListener('submit', (ev) => {
            ev.preventDefault();
            console.log('[substance] form submit');
            handleSubstanceSubmit();
        });
        form.dataset.submitBound = 'true';
    }
}

function updateLastSaved() {
    updateLastSavedDisplay();
}

function renderSubstances() {
    renderSubstancesList();
}

function populateSubstanceDropdowns() {
    populateAllSubstanceDropdowns();
}

function archiveSubstance(id) {
    const sub = getSubstance(id);
    if (!sub) return;
    if (confirm(`Archive "${sub.name}"? It will be hidden from logging but data is kept.`)) {
        sub.active = false;
        if (sub.isMain) sub.isMain = false;
        normalizeMainSubstances(appData);
        saveData(appData);
        if (currentSubstanceId === id) currentSubstanceId = getMainSubstanceId() || getActiveSubstances()[0]?.id || DASHBOARD_ALL;
        populateAllSubstanceDropdowns();
        renderSubstancesList();
        updateDashboard();
    }
}

function restoreSubstance(id) {
    const sub = getSubstance(id);
    if (sub) {
        sub.active = true;
        if (!getMainSubstance()) sub.isMain = true;
        normalizeMainSubstances(appData);
        saveData(appData);
        populateAllSubstanceDropdowns();
        renderSubstancesList();
        updateDashboardMainDisplay();
    }
}

function deleteSubstance(id) {
    const sub = getSubstance(id);
    if (!sub) return;
    const logCount = appData.logs.filter(l => l.substanceId === id).length;
    const msg = logCount
        ? `Delete "${sub.name}"? This removes the substance but keeps ${logCount} log(s) in history.`
        : `Delete "${sub.name}"?`;
    if (!confirm(msg)) return;

    appData.substances = appData.substances.filter(s => s.id !== id);
    delete appData.settings.substanceSettings[id];
    delete appData.taperPlans[id];
    delete appData.recoveryStreaks[id];
    normalizeMainSubstances(appData);
    if (currentSubstanceId === id) currentSubstanceId = getMainSubstanceId() || getActiveSubstances()[0]?.id || DASHBOARD_ALL;
    saveData(appData);
    populateAllSubstanceDropdowns();
    renderSubstancesList();
    updateDashboardMainDisplay();
    updateDashboard();
}

// ——— Tabs & events ———
function switchTab(tabId) {
    document.querySelectorAll('.tab').forEach(tab => tab.classList.remove('active'));
    document.querySelectorAll('.nav-btn').forEach(btn => btn.classList.remove('active'));
    document.getElementById(tabId)?.classList.add('active');
    document.querySelector(`[data-tab="${tabId}"]`)?.classList.add('active');

    if (tabId === 'dashboard-tab') {
        applyMainSubstanceToViewSelectors();
        updateDashboard();
    } else if (tabId === 'stats-tab') {
        applyMainSubstanceToViewSelectors();
        updateStats();
    } else if (tabId === 'calendar-tab') {
        const taperSubs = sortSubstancesMainFirst(getTaperSubstances());
        const mainId = getMainSubstanceId();
        populateSelect('calendar-substance', taperSubs, {
            currentValue: mainId && taperSubs.some(s => s.id === mainId) ? mainId : taperSubs[0]?.id
        });
        renderCalendar();
    } else if (tabId === 'buy-tracker-tab') {
        applyMainSubstanceToForms();
        renderBuyTrackerTab();
    } else if (tabId === 'use-log-tab') {
        applyMainSubstanceToForms();
        renderUseLogTab();
    } else if (tabId === 'taper-tab') {
        applyMainSubstanceToViewSelectors();
        syncTaperSubstanceToMain();
        refreshTaperDashboard();
    } else if (tabId === 'settings-tab') {
        applyMainSubstanceToViewSelectors();
        renderSubstancesList();
        loadSettings();
    }
}

// ——— Use Log ———
function parseUseDateTime(dateStr, timeStr) {
    if (!dateStr || !timeStr) return null;
    return new Date(`${dateStr}T${timeStr}`);
}

function formatDurationHours(hours) {
    if (hours == null || isNaN(hours)) return '—';
    if (hours < 1 / 60) return '<1m';
    const h = Math.floor(hours);
    const m = Math.round((hours - h) * 60);
    if (h > 0) return m > 0 ? `${h}h ${m}m` : `${h}h`;
    return `${m}m`;
}

function formatHoursAgo(ms) {
    if (ms == null || ms < 0) return '—';
    const hours = ms / 3600000;
    if (hours < 1) return `${Math.round(ms / 60000)}m ago`;
    if (hours < 24) return `${hours.toFixed(1)}h ago`;
    const days = Math.floor(hours / 24);
    return `${days}d ${Math.round(hours % 24)}h ago`;
}

function findUseEntry(id) {
    return appData.logs.find(l => l.id === id)
        || appData.useLogs?.find(l => l.id === id);
}

function getUseSubstanceId(entry) {
    return entry.substanceId || entry.substance || '';
}

function getUseCount(entry) {
    const count = entry.count ?? entry.lines;
    return count != null && count !== '' ? count : '';
}

function getUseLogType(entry) {
    if (entry.type === 'session' || entry.type === 'quick') return entry.type;
    return entry.endTime ? 'session' : 'quick';
}

function setUseFormSubmitLabel(text) {
    const btn = document.getElementById('use-submit-btn');
    if (btn) btn.textContent = text;
}

function getUseEventTimestamp(date, startTime) {
    const startDt = parseUseDateTime(date, startTime);
    return startDt && !Number.isNaN(startDt.getTime())
        ? startDt.toISOString()
        : new Date().toISOString();
}

function getUseCreatedAt(entry) {
    return entry.createdAt || entry.timestamp || new Date().toISOString();
}

function buildUseEntryFromForm() {
    const type = document.getElementById('use-type')?.value || 'quick';
    const substanceId = document.getElementById('use-substance')?.value;
    const amount = parseFloat(document.getElementById('use-amount')?.value);
    const unit = document.getElementById('use-unit')?.value;
    const date = document.getElementById('use-date')?.value;
    const startTime = document.getElementById('use-start-time')?.value || '12:00';
    const endTime = document.getElementById('use-end-time')?.value;
    const linkedPurchaseId = resolveLinkedPurchaseId(substanceId);

    return {
        type,
        substanceId,
        amount: Number.isFinite(amount) ? amount : 0,
        unit: unit || 'units',
        date,
        startTime,
        time: startTime,
        endTime: type === 'session' ? (endTime || '') : '',
        count: parseFloat(document.getElementById('use-count')?.value) || 0,
        notes: document.getElementById('use-notes')?.value || '',
        linkedPurchaseId: linkedPurchaseId || null,
        supplyUnlinked: !linkedPurchaseId
    };
}

function stripLegacyUseLogFields(entry) {
    if (!entry) return;
    delete entry.cost;
    delete entry.trigger;
    delete entry.cravingLevel;
    delete entry.location;
}

function resetUseFormAfterSave() {
    editingUseId = null;
    document.getElementById('use-log-form')?.reset();
    setDefaultUseLogDateTime();
    setUseLogType('quick');
    setUseFormSubmitLabel('Save Entry');
    document.getElementById('cancel-use-edit-btn')?.classList.add('hidden');
    applyMainSubstanceToForms();
    updateUseUnitDropdown();
    updateUseTaperPreview();
    setUsePurchaseLinkMode('auto');
}

function refreshUseLogRelatedViews() {
    renderUseLogTab();
    updateDashboard();
    updateStats();
    refreshTaperDashboard();
    refreshBuyTrackerRelatedViews();
    renderCalendar();
}

function getLogDatetimeMs(log) {
    if (log.startDatetime) {
        const ms = new Date(log.startDatetime).getTime();
        if (!Number.isNaN(ms)) return ms;
    }
    if (log.timestamp) {
        const ms = new Date(log.timestamp).getTime();
        if (!Number.isNaN(ms)) return ms;
    }
    const time = log.startTime || log.time || '00:00';
    const ms = new Date(`${log.date}T${time}`).getTime();
    return Number.isNaN(ms) ? 0 : ms;
}

function getPurchaseDatetimeMs(purchase) {
    const ms = new Date(`${purchase.date}T${purchase.time || '12:00'}`).getTime();
    return Number.isNaN(ms) ? 0 : ms;
}

function findPurchaseInData(id, data) {
    if (id == null || id === '') return null;
    return (data?.purchases || []).find(p => p.id === id || String(p.id) === String(id)) || null;
}

function finalizePurchaseRemainingState(purchase) {
    const remaining = getPurchaseRemainingAmount(purchase);
    if (remaining <= INVENTORY_EPS) {
        purchase.remainingAmount = 0;
        purchase.isDepleted = true;
    } else {
        purchase.isDepleted = false;
    }
}

function deductPurchaseRemainingInData(purchase, amount) {
    const amt = parseFloat(amount) || 0;
    if (amt <= 0) return 0;
    const remaining = getPurchaseRemainingAmount(purchase);
    const used = Math.min(amt, remaining);
    purchase.remainingAmount = Math.max(0, remaining - used);
    finalizePurchaseRemainingState(purchase);
    return used;
}

function migrateInventoryLinkedV1(data) {
    ensureAppDataMigrations(data);
    if (data.migrations.inventoryLinkedV1) return;

    const purchases = data.purchases || [];
    const logs = data.logs || [];

    purchases.forEach(purchase => {
        const qty = getPurchaseQuantityBought(purchase);
        if (!purchase.quantityBought && qty) purchase.quantityBought = qty;
        if (!purchase.quantity && qty) purchase.quantity = qty;
        purchase.remainingAmount = qty;
        purchase.isDepleted = false;
    });

    const sortedLogs = [...logs].sort((a, b) => getLogDatetimeMs(a) - getLogDatetimeMs(b));

    sortedLogs.forEach(log => {
        const amount = parseFloat(log.amount) || 0;
        if (amount <= INVENTORY_EPS) return;

        if (log.linkedPurchases?.length) {
            log.linkedPurchases.forEach(alloc => {
                const purchase = findPurchaseInData(alloc.purchaseId, data);
                if (purchase) deductPurchaseRemainingInData(purchase, alloc.amountUsed);
            });
            log.supplyUnlinked = false;
            return;
        }

        if (log.linkedPurchaseId != null && log.linkedPurchaseId !== '') {
            const purchase = findPurchaseInData(log.linkedPurchaseId, data);
            if (purchase) deductPurchaseRemainingInData(purchase, amount);
            log.supplyUnlinked = false;
            return;
        }

        const substanceId = getUseSubstanceId(log);
        const logMs = getLogDatetimeMs(log);
        let amountLeft = amount;
        const allocations = [];

        const eligible = purchases
            .filter(p => getPurchaseSubstanceId(p) === substanceId)
            .filter(p => getPurchaseDatetimeMs(p) <= logMs)
            .sort((a, b) => getPurchaseDatetimeMs(a) - getPurchaseDatetimeMs(b));

        for (const purchase of eligible) {
            if (amountLeft <= INVENTORY_EPS) break;
            const remaining = getPurchaseRemainingAmount(purchase);
            if (remaining <= INVENTORY_EPS) continue;
            const used = deductPurchaseRemainingInData(purchase, amountLeft);
            if (used > 0) {
                allocations.push({ purchaseId: purchase.id, amountUsed: used });
                amountLeft -= used;
            }
        }

        if (allocations.length === 1) {
            log.linkedPurchaseId = allocations[0].purchaseId;
            delete log.linkedPurchases;
            log.supplyUnlinked = false;
        } else if (allocations.length > 1) {
            log.linkedPurchases = allocations;
            log.linkedPurchaseId = allocations[0].purchaseId;
            log.supplyUnlinked = false;
        } else {
            log.supplyUnlinked = true;
        }
    });

    purchases.forEach(finalizePurchaseRemainingState);
    data.migrations.inventoryLinkedV1 = true;
}

function getPurchaseQuantityBought(purchase) {
    const q = purchase.quantityBought ?? purchase.quantity;
    return parseFloat(q) || 0;
}

function getPurchaseRemainingAmount(purchase) {
    if (purchase.remainingAmount != null && purchase.remainingAmount !== '') {
        return Math.max(0, parseFloat(purchase.remainingAmount) || 0);
    }
    if (purchase.isDepleted) return 0;
    return getPurchaseQuantityBought(purchase);
}

function getLinkedUseAmountForPurchase(purchaseId, logs = []) {
    let total = 0;
    (logs || []).forEach(log => {
        if (log.linkedPurchases?.length) {
            log.linkedPurchases.forEach(alloc => {
                if (alloc.purchaseId === purchaseId || String(alloc.purchaseId) === String(purchaseId)) {
                    total += parseFloat(alloc.amountUsed) || 0;
                }
            });
            return;
        }
        if (log.linkedPurchaseId === purchaseId || String(log.linkedPurchaseId) === String(purchaseId)) {
            total += parseFloat(log.amount) || 0;
        }
    });
    return total;
}

function migratePurchaseInventory(purchase, logs, data) {
    const qty = getPurchaseQuantityBought(purchase);
    if (!purchase.quantityBought && qty) purchase.quantityBought = qty;
    if (!purchase.quantity && qty) purchase.quantity = qty;
    if (purchase.remainingAmount == null || purchase.remainingAmount === '') {
        const used = getLinkedUseAmountForPurchase(purchase.id, logs);
        purchase.remainingAmount = Math.max(0, qty - used);
    }
    finalizePurchaseRemainingState(purchase);
    if (!purchase.substanceName) {
        const substanceRef = getPurchaseSubstanceId(purchase);
        const sub = getSubstance(substanceRef, data);
        purchase.substanceName = sub?.name || '';
    }
    if (!purchase.createdAt) purchase.createdAt = new Date().toISOString();
    if (!purchase.updatedAt) purchase.updatedAt = purchase.createdAt;
}

let appData = loadData();
let currentCalendarDate = new Date();
let selectedDate = null;
let currentSubstanceId = resolveStartupSubstanceId();

function findPurchase(id, data = appData) {
    return findPurchaseInData(id, data);
}

function getActivePurchasesForSubstance(substanceId) {
    return (appData.purchases || [])
        .filter(p => getPurchaseSubstanceId(p) === substanceId && !p.isDepleted && getPurchaseRemainingAmount(p) > 0)
        .sort((a, b) => new Date(`${a.date}T${a.time || '12:00'}`) - new Date(`${b.date}T${b.time || '12:00'}`));
}

function getOldestActivePurchase(substanceId) {
    const active = getActivePurchasesForSubstance(substanceId);
    return active[0] || null;
}

function getPurchasePercentUsed(purchase) {
    const bought = getPurchaseQuantityBought(purchase);
    if (bought <= 0) return 0;
    const remaining = getPurchaseRemainingAmount(purchase);
    return Math.round(((bought - remaining) / bought) * 100);
}

function getPurchaseSupplyStatus(purchase) {
    const bought = getPurchaseQuantityBought(purchase);
    const remaining = getPurchaseRemainingAmount(purchase);
    if (purchase.isDepleted || remaining <= 0) {
        return { key: 'depleted', label: '❌ Depleted', className: 'supply-depleted' };
    }
    if (bought > 0 && remaining / bought <= SUPPLY_LOW_REMAINING_PCT) {
        return { key: 'low', label: '⚠️ Low supply', className: 'supply-low' };
    }
    return { key: 'ok', label: '✅ In supply', className: 'supply-ok' };
}

function formatPurchaseOptionLabel(purchase) {
    const remaining = getPurchaseRemainingAmount(purchase);
    const bought = getPurchaseQuantityBought(purchase);
    const unit = purchase.unit || 'units';
    const store = purchase.store || purchase.location || '';
    const storePart = store ? ` — ${store}` : '';
    return `${formatDate(purchase.date)} — ${bought}${unit} bought — ${remaining.toFixed(1)}${unit} left${storePart}`;
}

function formatLinkedPurchaseDisplay(log) {
    if (log.linkedPurchases?.length) {
        const parts = log.linkedPurchases.map(alloc => {
            const p = findPurchase(alloc.purchaseId);
            const store = p?.store || p?.location || '';
            const unit = log.unit || p?.unit || 'units';
            const storePart = store ? ` · ${store}` : '';
            return `${alloc.amountUsed}${unit} from ${formatDate(p?.date || '')}${storePart}`;
        });
        return parts.join('; ');
    }
    if (!log.linkedPurchaseId) return 'Unlinked';
    const p = findPurchase(log.linkedPurchaseId);
    if (!p) return 'Unlinked';
    const store = p.store || p.location || '';
    const storePart = store ? ` · ${store}` : '';
    return `${formatDate(p.date)} purchase${storePart}`;
}

function getUsePurchaseLinkMode() {
    return document.getElementById('use-purchase-link-mode')?.value || 'auto';
}

function setUsePurchaseLinkMode(mode) {
    const el = document.getElementById('use-purchase-link-mode');
    if (el) el.value = mode;
    updateUsePurchaseLinkUI();
}

function resolveLinkedPurchaseId(substanceId) {
    const mode = getUsePurchaseLinkMode();
    if (mode === 'none') return null;
    if (mode === 'manual') {
        const val = document.getElementById('use-purchase-select')?.value;
        return val ? parseInt(val, 10) : null;
    }
    const oldest = getOldestActivePurchase(substanceId);
    return oldest ? oldest.id : null;
}

function restorePurchaseAmount(purchaseId, amount) {
    if (!purchaseId) return;
    const purchase = findPurchase(purchaseId);
    if (!purchase) return;
    const amt = parseFloat(amount) || 0;
    if (amt <= 0) return;
    const cap = getPurchaseQuantityBought(purchase);
    purchase.remainingAmount = Math.min(cap, getPurchaseRemainingAmount(purchase) + amt);
    finalizePurchaseRemainingState(purchase);
    purchase.updatedAt = new Date().toISOString();
}

function deductPurchaseAmount(purchaseId, amount) {
    if (!purchaseId) return { ok: true };
    const purchase = findPurchase(purchaseId);
    if (!purchase) return { ok: false, error: 'Linked purchase not found.' };
    const amt = parseFloat(amount) || 0;
    const remaining = getPurchaseRemainingAmount(purchase);
    if (amt > remaining + 0.0001) {
        return {
            ok: false,
            error: `Only ${remaining.toFixed(2)} ${purchase.unit || 'units'} left in that bag.`
        };
    }
    purchase.remainingAmount = Math.max(0, remaining - amt);
    finalizePurchaseRemainingState(purchase);
    purchase.updatedAt = new Date().toISOString();
    return { ok: true };
}

function getTotalRemainingSupply(substanceId) {
    return (appData.purchases || [])
        .filter(p => getPurchaseSubstanceId(p) === substanceId && !p.isDepleted)
        .reduce((s, p) => s + getPurchaseRemainingAmount(p), 0);
}

function getCurrentBagPurchase(substanceId) {
    return getOldestActivePurchase(substanceId);
}

function getAverageDailyUse(substanceId, days = 7) {
    const today = new Date();
    let total = 0;
    let dayCount = 0;
    for (let i = 0; i < days; i++) {
        const d = new Date(today);
        d.setDate(today.getDate() - i);
        const dateStr = d.toISOString().split('T')[0];
        const dayTotal = appData.logs
            .filter(l => getUseSubstanceId(l) === substanceId && l.date === dateStr)
            .reduce((s, l) => s + (parseFloat(l.amount) || 0), 0);
        total += dayTotal;
        dayCount++;
    }
    return dayCount ? total / dayCount : 0;
}

function getCostPerUnitFromPurchase(purchaseId) {
    const p = findPurchase(purchaseId);
    if (!p) return null;
    const cpu = parseFloat(p.costPerUnit);
    if (Number.isFinite(cpu) && cpu > 0) return cpu;
    const qty = getPurchaseQuantityBought(p);
    const total = parseFloat(getPurchaseTotalCost(p)) || 0;
    return qty > 0 ? total / qty : null;
}

function updateUsePurchaseLinkUI() {
    const mode = getUsePurchaseLinkMode();
    const manualWrap = document.getElementById('use-purchase-manual-wrap');
    const select = document.getElementById('use-purchase-select');
    const preview = document.getElementById('use-purchase-preview');
    const substanceId = document.getElementById('use-substance')?.value;

    if (manualWrap) manualWrap.classList.toggle('hidden', mode !== 'manual');

    if (mode === 'manual' && select && substanceId) {
        let active = getActivePurchasesForSubstance(substanceId);
        if (editingUseId) {
            const entry = findUseEntry(editingUseId);
            if (entry?.linkedPurchaseId) {
                const linked = findPurchase(entry.linkedPurchaseId);
                if (linked && !active.some(p => p.id === linked.id)) {
                    active = [linked, ...active];
                }
            }
        }
        const currentVal = select.value;
        select.innerHTML = '<option value="">Select a purchase…</option>';
        active.forEach(p => {
            const opt = document.createElement('option');
            opt.value = p.id;
            opt.textContent = formatPurchaseOptionLabel(p);
            select.appendChild(opt);
        });
        if (currentVal && [...select.options].some(o => o.value === currentVal)) {
            select.value = currentVal;
        }
    }

    if (preview) {
        if (mode === 'none') {
            preview.textContent = 'This use will not deduct from any purchase (unlinked).';
            preview.classList.remove('hidden');
        } else if (!substanceId) {
            preview.classList.add('hidden');
        } else if (mode === 'auto') {
            const bag = getOldestActivePurchase(substanceId);
            if (bag) {
                preview.textContent = `Auto: ${formatPurchaseOptionLabel(bag)}`;
                preview.classList.remove('hidden');
            } else {
                preview.textContent = 'No active supply — entry will save as unlinked.';
                preview.classList.remove('hidden');
            }
        } else if (mode === 'manual') {
            const id = select?.value;
            const bag = id ? findPurchase(parseInt(id, 10)) : null;
            preview.textContent = bag ? formatPurchaseOptionLabel(bag) : 'Choose a purchase with remaining supply.';
            preview.classList.remove('hidden');
        }
    }
}

function updateCurrentSupplyDashboard() {
    const mainId = getMainSubstanceId();
    const set = (id, text) => { const el = document.getElementById(id); if (el) el.textContent = text; };
    if (!mainId) {
        set('dash-supply-total', '—');
        set('dash-supply-current-bag', 'Set a main substance');
        set('dash-supply-last-purchase', '—');
        set('dash-supply-days-left', '—');
        return;
    }
    const sub = getSubstance(mainId);
    const unit = sub?.defaultUnit || 'units';
    const totalRemaining = getTotalRemainingSupply(mainId);
    const bag = getCurrentBagPurchase(mainId);
    const purchases = (appData.purchases || [])
        .filter(p => getPurchaseSubstanceId(p) === mainId)
        .sort((a, b) => new Date(`${b.date}T${b.time || '12:00'}`) - new Date(`${a.date}T${a.time || '12:00'}`));
    const lastPurchase = purchases[0] || null;
    const dailyAvg = getAverageDailyUse(mainId);

    set('dash-supply-total', `${totalRemaining.toFixed(1)} ${unit} remaining`);
    if (bag) {
        set('dash-supply-current-bag', `Current bag: ${getPurchaseRemainingAmount(bag).toFixed(1)} ${unit} left`);
    } else {
        set('dash-supply-current-bag', 'No active bag in supply');
    }
    if (lastPurchase) {
        const store = lastPurchase.store || lastPurchase.location || '';
        set('dash-supply-last-purchase', `Last buy: ${formatDate(lastPurchase.date)}${store ? ' · ' + store : ''}`);
    } else {
        set('dash-supply-last-purchase', 'Last buy: —');
    }
    if (dailyAvg > 0 && totalRemaining > 0) {
        set('dash-supply-days-left', `~${Math.round(totalRemaining / dailyAvg)} days left at current pace`);
    } else {
        set('dash-supply-days-left', 'Est. days left: —');
    }
}

function refreshTaperDashboard() {
    renderTaperPlan();
    checkTaperTarget();
    updateTaperProgress();
    const sid = getTaperSubstanceId();
    if (sid && !isAllSubstancesView() && currentSubstanceId === sid) {
        updateDoNotSurpassDisplay('dashboard', sid);
    }
}

function editUseEntry(id) {
    const entry = findUseEntry(id);
    if (!entry) return;

    editingUseId = id;
    const type = getUseLogType(entry);
    setUseLogType(type);

    const substanceId = getUseSubstanceId(entry);
    const substanceSelect = document.getElementById('use-substance');
    if (substanceSelect && substanceId && [...substanceSelect.options].some(o => o.value === substanceId)) {
        substanceSelect.value = substanceId;
    }
    updateUseUnitDropdown();

    const unit = entry.unit || 'units';
    const unitSelect = document.getElementById('use-unit');
    if (unitSelect) {
        if (unit && ![...unitSelect.options].some(o => o.value === unit)) {
            const option = document.createElement('option');
            option.value = unit;
            option.textContent = unit;
            unitSelect.appendChild(option);
        }
        unitSelect.value = unit;
    }

    setInputValue('use-date', entry.date || '');
    setInputValue('use-start-time', entry.startTime || entry.time || '12:00');
    setInputValue('use-end-time', entry.endTime || '');
    setInputValue('use-amount', entry.amount != null ? entry.amount : '');
    setInputValue('use-count', getUseCount(entry));
    setInputValue('use-notes', entry.notes || '');

    if (entry.linkedPurchaseId) {
        setUsePurchaseLinkMode('manual');
        const select = document.getElementById('use-purchase-select');
        if (select) {
            updateUsePurchaseLinkUI();
            select.value = String(entry.linkedPurchaseId);
        }
    } else if (entry.supplyUnlinked) {
        setUsePurchaseLinkMode('none');
    } else {
        setUsePurchaseLinkMode('auto');
    }
    updateUsePurchaseLinkUI();

    setUseFormSubmitLabel('Update Entry');
    document.getElementById('cancel-use-edit-btn')?.classList.remove('hidden');
    computeUseFormDuration();
    updateUseTaperPreview();

    switchTab('use-log-tab');
    document.getElementById('use-log-form')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

function cancelUseEdit() {
    editingUseId = null;
    document.getElementById('use-log-form')?.reset();
    setDefaultUseLogDateTime();
    setUseLogType('quick');
    setUseFormSubmitLabel('Save Entry');
    document.getElementById('cancel-use-edit-btn')?.classList.add('hidden');
    applyMainSubstanceToForms();
    updateUseUnitDropdown();
    updateUseTaperPreview();
    setUsePurchaseLinkMode('auto');
}

function getUseLogsForSubstance(substanceId, { sortAsc = true } = {}) {
    let list = appData.logs.filter(l => getUseSubstanceId(l) === substanceId);
    list = [...list].sort((a, b) => {
        const da = new Date(a.startDatetime || a.timestamp || `${a.date}T${a.startTime || a.time}`);
        const db = new Date(b.startDatetime || b.timestamp || `${b.date}T${b.startTime || b.time}`);
        return sortAsc ? da - db : db - da;
    });
    return list;
}

function getUseEndDatetime(entry) {
    if (entry.endDatetime) return new Date(entry.endDatetime);
    if (entry.type === 'session' && entry.endTime) {
        const end = parseUseDateTime(entry.date, entry.endTime);
        const start = parseUseDateTime(entry.date, entry.startTime || entry.time);
        if (end && start && end < start) end.setDate(end.getDate() + 1);
        return end;
    }
    return parseUseDateTime(entry.date, entry.startTime || entry.time);
}

function enrichUseEntry(entry, previousEntry) {
    const isSession = entry.type === 'session' || !!entry.endTime;
    const startTime = entry.startTime || entry.time;
    const start = parseUseDateTime(entry.date, startTime);
    let end = null;
    let durationHours = null;
    let startDatetime = start ? start.toISOString() : null;
    let endDatetime = null;

    if (isSession && entry.endTime) {
        end = parseUseDateTime(entry.date, entry.endTime);
        if (start && end) {
            if (end < start) end.setDate(end.getDate() + 1);
            durationHours = (end - start) / 3600000;
            endDatetime = end.toISOString();
        }
    }

    const amount = parseFloat(entry.amount) || 0;
    const useRate = durationHours > 0 ? amount / durationHours : null;

    let timeBetweenHours = null;
    let breakDurationHours = null;
    if (previousEntry && start) {
        const prevEnd = getUseEndDatetime(previousEntry);
        if (prevEnd) {
            const gapMs = start - prevEnd;
            if (gapMs >= 0) {
                timeBetweenHours = gapMs / 3600000;
                breakDurationHours = gapMs / 3600000;
            }
        }
    }

    return {
        ...entry,
        type: entry.type || (entry.endTime ? 'session' : 'quick'),
        durationHours,
        useRate,
        timeBetweenHours,
        breakDurationHours,
        startDatetime,
        endDatetime
    };
}

function buildEnrichedUseEntries(substanceId) {
    const raw = getUseLogsForSubstance(substanceId, { sortAsc: true });
    const enriched = [];
    for (let i = 0; i < raw.length; i++) {
        enriched.push(enrichUseEntry(raw[i], i > 0 ? enriched[i - 1] : null));
    }
    return enriched;
}

function getUseRowWarnings(entry, substanceId, avgRate) {
    const warnings = [];
    const today = new Date().toISOString().split('T')[0];
    const limit = getDailyLimitForDate(substanceId, today);
    const used = getUsedAmount(substanceId, today);

    if (entry.useRate != null && avgRate != null && avgRate > 0 && entry.useRate >= avgRate * SESSION_RATE_HIGH_MULTIPLIER) {
        warnings.push('high-rate');
    }
    if (entry.breakDurationHours != null) {
        if (entry.breakDurationHours < SESSION_SHORT_BREAK_HOURS) warnings.push('short-break');
        if (entry.breakDurationHours >= SESSION_LONG_BREAK_HOURS) warnings.push('long-break');
    }
    if (limit != null && used >= limit * 0.8) warnings.push('taper-close');
    return warnings;
}

function setUseLogType(type) {
    const hidden = document.getElementById('use-type');
    if (hidden) hidden.value = type;
    document.querySelectorAll('.type-toggle-btn').forEach(btn => {
        btn.classList.toggle('active', btn.dataset.type === type);
    });
    document.querySelectorAll('.session-only-field').forEach(el => {
        el.classList.toggle('hidden', type !== 'session');
    });
    const endEl = document.getElementById('use-end-time');
    if (type === 'quick' && endEl) endEl.value = '';
    computeUseFormDuration();
    updateUseTaperPreview();
}

function setDefaultUseLogDateTime() {
    const now = new Date();
    const dateStr = now.toISOString().split('T')[0];
    const timeStr = now.toTimeString().slice(0, 5);
    const dateEl = document.getElementById('use-date');
    const startEl = document.getElementById('use-start-time');
    if (dateEl) dateEl.value = dateStr;
    if (startEl) startEl.value = timeStr;
}

function setupUseLogForm() {
    const form = document.getElementById('use-log-form');
    if (!form) return;
    form.addEventListener('submit', handleUseLogSubmit);
    document.getElementById('use-substance')?.addEventListener('change', () => {
        updateUseUnitDropdown();
        updateUseTaperPreview();
        updateUsePurchaseLinkUI();
    });
    ['use-amount', 'use-date'].forEach(id => {
        document.getElementById(id)?.addEventListener('input', () => {
            updateUseTaperPreview();
            updateUsePurchaseLinkUI();
        });
    });
    document.getElementById('use-purchase-link-mode')?.addEventListener('change', updateUsePurchaseLinkUI);
    document.getElementById('use-purchase-select')?.addEventListener('change', updateUsePurchaseLinkUI);
    document.getElementById('use-start-time')?.addEventListener('change', computeUseFormDuration);
    document.getElementById('use-end-time')?.addEventListener('change', computeUseFormDuration);
    setUseLogType(document.getElementById('use-type')?.value || 'quick');
    updateUsePurchaseLinkUI();
}

function computeUseFormDuration() {
    const date = document.getElementById('use-date')?.value;
    const start = document.getElementById('use-start-time')?.value;
    const end = document.getElementById('use-end-time')?.value;
    const preview = document.getElementById('use-duration-preview');
    if (!preview) return;
    if (!date || !start || !end) {
        preview.classList.add('hidden');
        return;
    }
    const s = parseUseDateTime(date, start);
    const e = parseUseDateTime(date, end);
    if (!s || !e) return;
    if (e < s) e.setDate(e.getDate() + 1);
    const hours = (e - s) / 3600000;
    preview.textContent = `Duration: ${formatDurationHours(hours)}`;
    preview.classList.remove('hidden');
}

function updateUseTaperPreview() {
    const el = document.getElementById('use-taper-preview');
    if (!el) return;
    const substanceId = document.getElementById('use-substance')?.value;
    const amount = parseFloat(document.getElementById('use-amount')?.value) || 0;
    if (!substanceId) {
        el.classList.add('hidden');
        return;
    }
    const sub = getSubstance(substanceId);
    const today = new Date().toISOString().split('T')[0];
    const limit = getDailyLimitForDate(substanceId, today);
    if (!sub?.taperTrackingEnabled || limit == null) {
        el.classList.add('hidden');
        return;
    }
    const used = getUsedAmount(substanceId, today, editingUseId);
    const remaining = Math.max(0, limit - used);
    const after = used + amount;
    el.classList.remove('hidden');
    if (amount > remaining) {
        el.className = 'session-taper-preview session-taper-warn';
        el.textContent = `⚠️ ${remaining.toFixed(1)} ${sub.defaultUnit} remaining today (${used}/${limit} used). This entry (${amount}) would exceed the limit.`;
    } else if (after >= limit * 0.8) {
        el.className = 'session-taper-preview session-taper-close';
        el.textContent = `⚠️ Close to limit: ${(limit - after).toFixed(1)} ${sub.defaultUnit} left after saving (${used} + ${amount} / ${limit}).`;
    } else {
        el.className = 'session-taper-preview';
        el.textContent = `✅ ${remaining.toFixed(1)} ${sub.defaultUnit} remaining today (${used}/${limit} used).`;
    }
}

function getQuickLogSubstanceId() {
    return getMainSubstanceId() || currentSubstanceId;
}

function logOneUse() {
    const substanceId = getQuickLogSubstanceId();
    const sub = getSubstance(substanceId);
    if (!sub) return alert('Add an active substance first.');
    if (!confirmTaperBeforeLog(substanceId, 1, true)) return;

    const now = new Date();
    const linkedPurchaseId = getOldestActivePurchase(substanceId)?.id || null;
    const log = {
        id: Date.now(),
        type: 'quick',
        substanceId,
        amount: 1,
        unit: sub.defaultUnit,
        date: now.toISOString().split('T')[0],
        startTime: now.toTimeString().slice(0, 5),
        time: now.toTimeString().slice(0, 5),
        notes: '',
        linkedPurchaseId,
        supplyUnlinked: !linkedPurchaseId,
        timestamp: now.toISOString(),
        createdAt: now.toISOString(),
        updatedAt: now.toISOString()
    };

    if (linkedPurchaseId) {
        const deduct = deductPurchaseAmount(linkedPurchaseId, 1);
        if (!deduct.ok) {
            log.linkedPurchaseId = null;
            log.supplyUnlinked = true;
        }
    }

    snapshotBestStreakBeforeUse(substanceId);
    appData.logs.push(log);
    saveData(appData);
    updateDashboard();
    renderRecentUseList();
    refreshTaperDashboard();
    refreshBuyTrackerRelatedViews();
    notifyTaperAfterLog(substanceId);
    alert(`Logged 1 ${sub.defaultUnit} of ${sub.name}`);
}

function openUseLogSession() {
    switchTab('use-log-tab');
    setUseLogType('session');
    const id = getQuickLogSubstanceId();
    if (id) setInputValue('use-substance', id);
    setDefaultUseLogDateTime();
    updateUseUnitDropdown();
    updateUseTaperPreview();
    updateUsePurchaseLinkUI();
}

function undoLastUse() {
    if (!appData.logs.length) return alert('No use entries to undo');
    if (confirm('Undo last use entry?')) {
        const last = appData.logs[appData.logs.length - 1];
        if (last?.linkedPurchaseId) {
            restorePurchaseAmount(last.linkedPurchaseId, last.amount);
        }
        appData.logs.pop();
        saveData(appData);
        updateDashboard();
        renderRecentUseList();
        renderUseHistoryTable();
        refreshTaperDashboard();
        refreshBuyTrackerRelatedViews();
    }
}

function handleUseLogSubmit(e) {
    e.preventDefault();
    const payload = buildUseEntryFromForm();
    const { substanceId, amount, type, linkedPurchaseId } = payload;
    const eventTimestamp = getUseEventTimestamp(payload.date, payload.startTime);
    const now = new Date().toISOString();

    if (!confirmTaperBeforeLog(substanceId, amount, type === 'quick', editingUseId)) return;

    if (editingUseId != null) {
        const existing = findUseEntry(editingUseId);
        const idx = appData.logs.findIndex(l => l.id === editingUseId);
        if (!existing || idx < 0) {
            alert('Could not find the entry to update.');
            cancelUseEdit();
            return;
        }
        restorePurchaseAmount(existing.linkedPurchaseId, existing.amount);
        if (linkedPurchaseId) {
            const deduct = deductPurchaseAmount(linkedPurchaseId, amount);
            if (!deduct.ok) {
                restorePurchaseAmount(existing.linkedPurchaseId, existing.amount);
                return alert(deduct.error);
            }
        }
        appData.logs[idx] = {
            ...existing,
            ...payload,
            id: editingUseId,
            substanceId: payload.substanceId,
            linkedPurchaseId: linkedPurchaseId || null,
            supplyUnlinked: !linkedPurchaseId,
            createdAt: getUseCreatedAt(existing),
            updatedAt: now,
            timestamp: eventTimestamp
        };
        stripLegacyUseLogFields(appData.logs[idx]);
        delete appData.logs[idx].substance;
        delete appData.logs[idx].lines;
        saveData(appData);
        resetUseFormAfterSave();
        populateAllSubstanceDropdowns();
        refreshUseLogRelatedViews();
        notifyTaperAfterLog(substanceId);
        alert(type === 'session' ? 'Session updated!' : 'Entry updated!');
        return;
    }

    if (linkedPurchaseId) {
        const deduct = deductPurchaseAmount(linkedPurchaseId, amount);
        if (!deduct.ok) return alert(deduct.error);
    }

    snapshotBestStreakBeforeUse(substanceId);
    const log = {
        ...payload,
        id: Date.now(),
        createdAt: now,
        updatedAt: now,
        timestamp: eventTimestamp,
        linkedPurchaseId: linkedPurchaseId || null,
        supplyUnlinked: !linkedPurchaseId
    };
    stripLegacyUseLogFields(log);
    appData.logs.push(log);
    saveData(appData);
    resetUseFormAfterSave();
    populateAllSubstanceDropdowns();
    refreshUseLogRelatedViews();
    notifyTaperAfterLog(substanceId);
    alert(type === 'session' ? 'Session saved!' : 'Use logged!');
}

function deleteUseEntry(id) {
    if (!confirm('Delete this entry?')) return;
    const entry = findUseEntry(id);
    if (editingUseId === id) cancelUseEdit();
    if (entry?.linkedPurchaseId) {
        restorePurchaseAmount(entry.linkedPurchaseId, entry.amount);
    }
    appData.logs = appData.logs.filter(l => l.id !== id);
    saveData(appData);
    refreshUseLogRelatedViews();
}

function renderUseLogTab() {
    updateUseTaperPreview();
    renderRecentUseList();
    renderUseHistoryTable();
}

function renderRecentUseList() {
    const container = document.getElementById('recent-use-list');
    if (!container) return;
    container.innerHTML = '';
    const recent = [...appData.logs].sort((a, b) =>
        new Date(b.timestamp || `${b.date}T${b.startTime || b.time}`) -
        new Date(a.timestamp || `${a.date}T${a.startTime || a.time}`)
    ).slice(0, 5);
    if (!recent.length) {
        container.innerHTML = '<p class="empty-hint">No use entries yet</p>';
        return;
    }
    recent.forEach(log => {
        const substanceId = getUseSubstanceId(log);
        const sub = getSubstance(substanceId);
        const enriched = enrichUseEntry(log, null);
        const typeLabel = getUseLogType(log) === 'session' ? '⏱️ Session' : '⚡ Quick';
        const countStr = getUseCount(log);
        const item = document.createElement('div');
        item.className = 'list-item';
        item.innerHTML = `
            <div class="list-item-content">
                <strong>${typeLabel} ${sub?.icon || ''} ${log.amount ?? '—'} ${log.unit || ''} ${sub?.name || 'Unknown'}</strong><br>
                <small>${formatDate(log.date || '')} ${log.startTime || log.time || ''}${log.endTime ? '–' + log.endTime : ''}</small>
                ${enriched.durationHours ? `<br><small>Duration: ${formatDurationHours(enriched.durationHours)}</small>` : ''}
                ${countStr !== '' ? `<br><small>Count: ${countStr}</small>` : ''}
                ${log.notes ? `<br><small>${log.notes}</small>` : ''}
                <br><small class="use-supply-line">${formatLinkedPurchaseDisplay(log)}</small>
            </div>
            <div class="use-history-actions">
                <button type="button" class="secondary-btn" onclick="editUseEntry(${log.id})">Edit</button>
                <button type="button" class="delete-btn" onclick="deleteUseEntry(${log.id})">Delete</button>
            </div>
        `;
        container.appendChild(item);
    });
}

function renderUseHistoryTable() {
    const wrap = document.getElementById('use-history-table-wrap');
    if (!wrap) return;

    const filterId = isAllSubstancesView() ? null : currentSubstanceId;
    const substances = filterId ? [getSubstance(filterId)].filter(Boolean) : getLoggableSubstances();
    let allRows = [];
    substances.forEach(sub => {
        const enriched = buildEnrichedUseEntries(sub.id);
        const avgRate = (() => {
            const rates = enriched.map(e => e.useRate).filter(r => r != null && r > 0);
            return rates.length ? rates.reduce((a, b) => a + b, 0) / rates.length : null;
        })();
        enriched.forEach(entry => allRows.push({ entry, sub, avgRate }));
    });

    allRows.sort((a, b) => {
        const da = new Date(a.entry.startDatetime || a.entry.timestamp || 0);
        const db = new Date(b.entry.startDatetime || b.entry.timestamp || 0);
        return db - da;
    });

    if (!allRows.length) {
        wrap.innerHTML = '<p class="empty-hint">No entries yet. Log your first use above.</p>';
        return;
    }

    let html = `<div class="session-table-scroll"><table class="session-table"><thead><tr>
        <th>Date</th><th>Type</th><th>Substance</th><th>Start</th><th>End</th><th>Duration</th><th>Amount</th><th>Unit</th>
        <th>Count</th><th>Rate</th><th>Since Prev</th><th>Break</th><th>Supply</th><th>Notes</th><th>Actions</th>
    </tr></thead><tbody>`;

    allRows.forEach(({ entry, sub, avgRate }) => {
        const warnings = getUseRowWarnings(entry, sub.id, avgRate);
        const rateStr = entry.useRate != null ? `${entry.useRate.toFixed(2)}/${sub.defaultUnit}/hr` : '—';
        const typeLabel = entry.type === 'session' ? 'Session' : 'Quick';
        html += `<tr class="${warnings.join(' ')}">
            <td>${formatDate(entry.date)}</td>
            <td>${typeLabel}</td>
            <td>${sub.icon} ${sub.name}</td>
            <td>${entry.startTime || entry.time || '—'}</td>
            <td>${entry.endTime || '—'}</td>
            <td>${formatDurationHours(entry.durationHours)}</td>
            <td>${entry.amount}</td>
            <td>${entry.unit}</td>
            <td>${entry.count || '—'}</td>
            <td>${rateStr}</td>
            <td>${formatDurationHours(entry.timeBetweenHours)}</td>
            <td>${formatDurationHours(entry.breakDurationHours)}</td>
            <td class="session-supply-cell">${formatLinkedPurchaseDisplay(entry)}</td>
            <td class="session-notes-cell">${entry.notes || ''}</td>
            <td class="use-history-actions-cell">
                <button type="button" class="secondary-btn" onclick="editUseEntry(${entry.id})">Edit</button>
                <button type="button" class="delete-btn" onclick="deleteUseEntry(${entry.id})">×</button>
            </td>
        </tr>`;
    });

    html += '</tbody></table></div>';
    html += `<div class="session-legend">
        <span class="legend-high-rate">High rate</span>
        <span class="legend-short-break">Short break</span>
        <span class="legend-long-break">Long break</span>
        <span class="legend-taper-close">Near taper limit</span>
    </div>`;
    wrap.innerHTML = html;
}

function getTodayUseStats(substanceId) {
    const today = new Date().toISOString().split('T')[0];
    const logs = filterLogsBySubstance(appData.logs.filter(l => l.date === today), substanceId);
    const enriched = logs.map(l => enrichUseEntry(l, null));
    const totalAmount = logs.reduce((s, l) => s + (parseFloat(l.amount) || 0), 0);
    const sessionDuration = enriched
        .filter(e => e.type === 'session' && e.durationHours)
        .reduce((s, e) => s + e.durationHours, 0);
    return { totalAmount, sessionDuration, logs };
}

function getTimeSinceLastUse(substanceId) {
    const logs = filterLogsBySubstance([...appData.logs], substanceId);
    if (!logs.length) return null;
    const sorted = logs.sort((a, b) =>
        new Date(b.timestamp || `${b.date}T${b.startTime || b.time}`) -
        new Date(a.timestamp || `${a.date}T${a.startTime || a.time}`)
    );
    const last = sorted[0];
    const end = getUseEndDatetime(enrichUseEntry(last, null));
    if (!end) return null;
    return Date.now() - end.getTime();
}

function logCravingOnly() {
    document.getElementById('craving-modal')?.classList.remove('hidden');
    const sel = document.getElementById('craving-substance');
    if (sel && !isAllSubstancesView()) sel.value = currentSubstanceId;
}

function closeCravingModal() {
    document.getElementById('craving-modal')?.classList.add('hidden');
    document.getElementById('craving-form')?.reset();
    setInputValue('craving-intensity', 5);
    setText('intensity-value', '5');
}

function handleCravingSubmit(e) {
    e.preventDefault();
    const substanceId = document.getElementById('craving-substance')?.value;
    if (!substanceId) return alert('Select a substance.');
    appData.cravings.push({
        id: Date.now(),
        substanceId,
        intensity: parseInt(document.getElementById('craving-intensity')?.value, 10) || 5,
        trigger: document.getElementById('craving-trigger')?.value || '',
        whatHelped: document.getElementById('craving-helped')?.value || '',
        date: new Date().toISOString().split('T')[0],
        time: new Date().toTimeString().slice(0, 5),
        timestamp: new Date().toISOString()
    });
    saveData(appData);
    closeCravingModal();
    updateDashboard();
    alert('Craving logged — great job resisting!');
}

// ——— Buy Tracker ———
function getPurchasesFiltered(substanceId) {
    let list = appData.purchases || [];
    if (substanceId && substanceId !== DASHBOARD_ALL) {
        list = list.filter(p => getPurchaseSubstanceId(p) === substanceId);
    }
    return list;
}

function getPurchaseSubstanceId(purchase) {
    return purchase.substanceId || purchase.substance || purchase.item || '';
}

function getPurchaseQuantity(purchase) {
    const q = purchase.quantity ?? purchase.quantityBought;
    return q != null && q !== '' ? q : '';
}

function getPurchaseTotalCost(purchase) {
    const c = purchase.totalCost ?? purchase.cost;
    return c != null && c !== '' ? c : '';
}

function getSubstancePurchaseSpend(substanceId, filterFn) {
    return (appData.purchases || [])
        .filter(p => p.substanceId === substanceId && (!filterFn || filterFn(p)))
        .reduce((sum, p) => {
            const c = parseFloat(getPurchaseTotalCost(p));
            return sum + (Number.isFinite(c) ? c : 0);
        }, 0);
}

function setDefaultBuyDateTime() {
    const now = new Date();
    const dateEl = document.getElementById('buy-date');
    const timeEl = document.getElementById('buy-time');
    if (dateEl) dateEl.value = now.toISOString().split('T')[0];
    if (timeEl) timeEl.value = now.toTimeString().slice(0, 5);
}

function setBuyFormSubmitLabel(text) {
    const btn = document.getElementById('buy-submit-btn');
    if (btn) btn.textContent = text;
}

function setupBuyTrackerForm() {
    const form = document.getElementById('buy-form');
    if (!form) return;
    form.addEventListener('submit', handleBuySubmit);
    setDefaultBuyDateTime();
    ['buy-quantity', 'buy-total-cost'].forEach(id => {
        document.getElementById(id)?.addEventListener('input', updateBuyCostPerUnitPreview);
    });
    document.getElementById('buy-substance')?.addEventListener('change', updateBuyUnitDropdown);
}

function buildPurchaseFromForm() {
    const quantity = parseFloat(document.getElementById('buy-quantity')?.value);
    const totalCost = parseFloat(document.getElementById('buy-total-cost')?.value);
    const substanceId = document.getElementById('buy-substance')?.value;
    const sub = getSubstance(substanceId);
    const qty = Number.isFinite(quantity) ? quantity : 0;
    return {
        substanceId,
        substanceName: sub?.name || '',
        date: document.getElementById('buy-date')?.value,
        time: document.getElementById('buy-time')?.value || '12:00',
        quantityBought: qty,
        quantity: qty,
        unit: document.getElementById('buy-unit')?.value || 'units',
        totalCost: Number.isFinite(totalCost) ? totalCost : 0,
        costPerUnit: qty > 0 ? (Number.isFinite(totalCost) ? totalCost : 0) / qty : 0,
        store: document.getElementById('buy-store')?.value || '',
        paymentMethod: document.getElementById('buy-payment')?.value || '',
        notes: document.getElementById('buy-notes')?.value || ''
    };
}

function finalizeNewPurchaseRecord(payload) {
    const now = new Date().toISOString();
    return {
        ...payload,
        remainingAmount: payload.quantityBought ?? payload.quantity ?? 0,
        isDepleted: false,
        createdAt: now,
        updatedAt: now
    };
}

function applyPurchaseQuantityEdit(existing, newQty) {
    const used = getPurchaseQuantityBought(existing) - getPurchaseRemainingAmount(existing);
    const remaining = Math.max(0, newQty - used);
    existing.quantityBought = newQty;
    existing.quantity = newQty;
    existing.remainingAmount = remaining;
    existing.isDepleted = remaining <= 0;
    if (newQty > 0) {
        const total = parseFloat(getPurchaseTotalCost(existing)) || 0;
        existing.costPerUnit = total / newQty;
    }
    existing.updatedAt = new Date().toISOString();
}

function resetBuyFormAfterSave() {
    editingPurchaseId = null;
    document.getElementById('buy-form')?.reset();
    setDefaultBuyDateTime();
    setBuyFormSubmitLabel('Save Purchase');
    document.getElementById('cancel-buy-edit-btn')?.classList.add('hidden');
    applyMainSubstanceToForms();
    updateBuyCostPerUnitPreview();
}

function refreshBuyTrackerRelatedViews() {
    renderBuyTrackerTab();
    updateDashboard();
    updateStats();
    renderCalendar();
}

function editPurchase(id) {
    const purchase = (appData.purchases || []).find(p => p.id === id);
    if (!purchase) return;

    editingPurchaseId = id;
    const substanceId = getPurchaseSubstanceId(purchase);
    const substanceSelect = document.getElementById('buy-substance');
    if (substanceSelect && substanceId && [...substanceSelect.options].some(o => o.value === substanceId)) {
        substanceSelect.value = substanceId;
    }
    updateBuyUnitDropdown();

    const unit = purchase.unit || 'units';
    const unitSelect = document.getElementById('buy-unit');
    if (unitSelect) {
        if (unit && ![...unitSelect.options].some(o => o.value === unit)) {
            const option = document.createElement('option');
            option.value = unit;
            option.textContent = unit;
            unitSelect.appendChild(option);
        }
        unitSelect.value = unit;
    }

    setInputValue('buy-date', purchase.date || '');
    setInputValue('buy-time', purchase.time || '12:00');
    setInputValue('buy-quantity', getPurchaseQuantity(purchase));
    setInputValue('buy-total-cost', getPurchaseTotalCost(purchase));
    setInputValue('buy-store', purchase.store || purchase.location || '');
    setInputValue('buy-payment', purchase.paymentMethod || '');
    setInputValue('buy-notes', purchase.notes || '');

    setBuyFormSubmitLabel('Update Purchase');
    document.getElementById('cancel-buy-edit-btn')?.classList.remove('hidden');
    updateBuyCostPerUnitPreview();

    switchTab('buy-tracker-tab');
    document.getElementById('buy-form')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

function cancelBuyEdit() {
    editingPurchaseId = null;
    document.getElementById('buy-form')?.reset();
    setDefaultBuyDateTime();
    setBuyFormSubmitLabel('Save Purchase');
    document.getElementById('cancel-buy-edit-btn')?.classList.add('hidden');
    applyMainSubstanceToForms();
    updateBuyUnitDropdown();
    updateBuyCostPerUnitPreview();
}

function updateBuyCostPerUnitPreview() {
    const el = document.getElementById('buy-cost-per-unit-preview');
    if (!el) return;
    const qty = parseFloat(document.getElementById('buy-quantity')?.value);
    const total = parseFloat(document.getElementById('buy-total-cost')?.value);
    if (qty > 0 && total >= 0) {
        el.textContent = `${appData.settings.currency}${(total / qty).toFixed(2)} per unit`;
    } else {
        el.textContent = '—';
    }
}

function handleBuySubmit(e) {
    e.preventDefault();
    if (!appData.purchases) appData.purchases = [];

    const payload = buildPurchaseFromForm();

    if (editingPurchaseId != null) {
        const idx = appData.purchases.findIndex(p => p.id === editingPurchaseId);
        if (idx < 0) {
            alert('Could not find the purchase to update.');
            cancelBuyEdit();
            return;
        }
        const existing = appData.purchases[idx];
        appData.purchases[idx] = {
            ...existing,
            ...payload,
            id: editingPurchaseId,
            substanceId: payload.substanceId,
            createdAt: existing.createdAt || new Date().toISOString(),
            updatedAt: new Date().toISOString()
        };
        applyPurchaseQuantityEdit(appData.purchases[idx], payload.quantityBought ?? payload.quantity ?? 0);
        delete appData.purchases[idx].substance;
        delete appData.purchases[idx].item;
        delete appData.purchases[idx].cost;
        delete appData.purchases[idx].location;
        saveData(appData);
        resetBuyFormAfterSave();
        refreshBuyTrackerRelatedViews();
        alert('Purchase updated!');
        return;
    }

    appData.purchases.push({ ...finalizeNewPurchaseRecord(payload), id: Date.now() });
    saveData(appData);
    resetBuyFormAfterSave();
    refreshBuyTrackerRelatedViews();
    alert('Purchase recorded!');
}

function openBuyTrackerModal() {
    switchTab('buy-tracker-tab');
    const id = getMainSubstanceId();
    if (id) setInputValue('buy-substance', id);
    setDefaultBuyDateTime();
    updateBuyUnitDropdown();
}

function deletePurchase(id) {
    const linked = (appData.logs || []).filter(l =>
        l.linkedPurchaseId === id
        || l.linkedPurchases?.some(a => a.purchaseId === id || String(a.purchaseId) === String(id))
    );
    let msg = 'Delete this purchase?';
    if (linked.length) {
        msg = `This purchase has ${linked.length} linked use ${linked.length === 1 ? 'entry' : 'entries'}. Delete anyway? Those uses will become unlinked.`;
    }
    if (!confirm(msg)) return;
    if (editingPurchaseId === id) cancelBuyEdit();
    linked.forEach(l => {
        if (l.linkedPurchases?.length) {
            l.linkedPurchases = l.linkedPurchases.filter(a => a.purchaseId !== id && String(a.purchaseId) !== String(id));
            if (l.linkedPurchases.length === 1) {
                l.linkedPurchaseId = l.linkedPurchases[0].purchaseId;
                delete l.linkedPurchases;
            } else if (l.linkedPurchases.length === 0) {
                l.linkedPurchaseId = null;
                l.supplyUnlinked = true;
            } else {
                l.linkedPurchaseId = l.linkedPurchases[0].purchaseId;
            }
        } else {
            l.linkedPurchaseId = null;
            l.supplyUnlinked = true;
        }
        l.updatedAt = new Date().toISOString();
    });
    appData.purchases = (appData.purchases || []).filter(p => p.id !== id);
    saveData(appData);
    refreshBuyTrackerRelatedViews();
    refreshUseLogRelatedViews();
}

function getBuyStats(substanceId) {
    const purchases = getPurchasesFiltered(substanceId);
    const today = new Date().toISOString().split('T')[0];
    const weekStart = getWeekStartDateStr(today);
    const monthStart = today.slice(0, 7) + '-01';
    const cur = appData.settings.currency;

    const purchaseCost = p => p.totalCost ?? p.cost ?? 0;
    const spentToday = purchases.filter(p => p.date === today).reduce((s, p) => s + purchaseCost(p), 0);
    const spentWeek = purchases.filter(p => p.date >= weekStart).reduce((s, p) => s + purchaseCost(p), 0);
    const spentMonth = purchases.filter(p => p.date >= monthStart).reduce((s, p) => s + purchaseCost(p), 0);
    const countWeek = purchases.filter(p => p.date >= weekStart).length;
    const countMonth = purchases.filter(p => p.date >= monthStart).length;

    const withCpu = purchases.filter(p => p.costPerUnit > 0);
    const avgCostUnit = withCpu.length
        ? withCpu.reduce((s, p) => s + p.costPerUnit, 0) / withCpu.length
        : null;

    const sorted = [...purchases].sort((a, b) => new Date(`${b.date}T${b.time || '12:00'}`) - new Date(`${a.date}T${a.time || '12:00'}`));
    const lastPurchase = sorted[0] || null;

    let daysSupply = null;
    if (substanceId && substanceId !== DASHBOARD_ALL) {
        const totalRemaining = getTotalRemainingSupply(substanceId);
        const dailyAvg = getAverageDailyUse(substanceId);
        if (dailyAvg > 0 && totalRemaining > 0) {
            daysSupply = Math.round(totalRemaining / dailyAvg);
        }
    }

    return { spentToday, spentWeek, spentMonth, countWeek, countMonth, avgCostUnit, lastPurchase, daysSupply, purchases, cur };
}

function renderBuySpendingTrend(substanceId) {
    const container = document.getElementById('buy-spending-trend');
    if (!container) return;
    const purchases = getPurchasesFiltered(substanceId);
    const today = new Date();
    const days = [];
    for (let i = 6; i >= 0; i--) {
        const d = new Date(today);
        d.setDate(d.getDate() - i);
        days.push(d.toISOString().split('T')[0]);
    }
    const totals = days.map(day => purchases.filter(p => p.date === day).reduce((s, p) => s + (p.totalCost ?? p.cost ?? 0), 0));
    const max = Math.max(...totals, 1);
    container.innerHTML = '<div class="mini-bar-chart">' + days.map((day, i) => {
        const h = Math.round((totals[i] / max) * 100);
        const label = new Date(day + 'T12:00:00').toLocaleDateString('en-US', { weekday: 'short' });
        return `<div class="mini-bar" title="${appData.settings.currency}${totals[i].toFixed(2)}"><div class="mini-bar-fill" style="height:${h}%"></div><span>${label}</span></div>`;
    }).join('') + '</div>';
}

function renderBuyTrackerTab() {
    const filterId = isAllSubstancesView() ? null : currentSubstanceId;
    const stats = getBuyStats(filterId);
    const set = (id, val) => { const el = document.getElementById(id); if (el) el.textContent = val; };

    set('buy-spent-today', `${stats.cur}${stats.spentToday.toFixed(2)}`);
    set('buy-spent-week', `${stats.cur}${stats.spentWeek.toFixed(2)}`);
    set('buy-spent-month', `${stats.cur}${stats.spentMonth.toFixed(2)}`);
    set('buy-count-week', String(stats.countWeek));
    set('buy-count-month', String(stats.countMonth));
    set('buy-avg-cost-unit', stats.avgCostUnit != null ? `${stats.cur}${stats.avgCostUnit.toFixed(2)}` : '—');
    if (stats.lastPurchase) {
        const sub = getSubstance(getPurchaseSubstanceId(stats.lastPurchase));
        set('buy-last-date', `${formatDate(stats.lastPurchase.date)} · ${sub?.name || ''}`);
    } else {
        set('buy-last-date', '—');
    }
    set('buy-days-supply', stats.daysSupply != null ? `~${stats.daysSupply} days` : '—');
    renderBuySpendingTrend(filterId);
    renderBuyHistory(filterId);
}

function renderBuyHistory(substanceId) {
    const container = document.getElementById('buy-history-list');
    if (!container) return;
    const purchases = [...getPurchasesFiltered(substanceId)].sort((a, b) =>
        new Date(`${b.date}T${b.time || '12:00'}`) - new Date(`${a.date}T${a.time || '12:00'}`)
    );
    container.innerHTML = '';
    if (!purchases.length) {
        container.innerHTML = '<p class="empty-hint">No purchases recorded</p>';
        return;
    }
    const cur = appData.settings.currency;
    purchases.forEach(purchase => {
        const substanceId = getPurchaseSubstanceId(purchase);
        const sub = getSubstance(substanceId);
        const qty = getPurchaseQuantity(purchase);
        const total = getPurchaseTotalCost(purchase);
        const totalNum = parseFloat(total) || 0;
        const qtyNum = parseFloat(qty) || 0;
        const cpu = purchase.costPerUnit ?? (qtyNum > 0 ? totalNum / qtyNum : 0);
        const store = purchase.store || purchase.location || '';
        const bought = getPurchaseQuantityBought(purchase);
        const remaining = getPurchaseRemainingAmount(purchase);
        const pctUsed = getPurchasePercentUsed(purchase);
        const supply = getPurchaseSupplyStatus(purchase);
        const unit = purchase.unit || 'units';
        const item = document.createElement('div');
        item.className = 'list-item purchase-supply-item';
        item.innerHTML = `
            <div><strong>${sub?.icon || ''} ${sub?.name || 'Unknown'}</strong> — ${formatDate(purchase.date || '')} ${purchase.time || ''}<br>
            <span class="purchase-supply-qty">${bought}${unit} bought</span><br>
            <span class="purchase-supply-remaining">${remaining.toFixed(1)}${unit} remaining · ${pctUsed}% used</span><br>
            <span class="purchase-supply-status ${supply.className}">${supply.label}</span><br>
            ${cur}${totalNum.toFixed(2)} (${cur}${cpu.toFixed(2)}/unit)${store ? '<br><small>' + store + '</small>' : ''}</div>
            <div class="purchase-history-actions">
                <button type="button" class="secondary-btn" onclick="editPurchase(${purchase.id})">Edit</button>
                <button type="button" class="delete-btn" onclick="deletePurchase(${purchase.id})">Delete</button>
            </div>
        `;
        container.appendChild(item);
    });
}

function getDashboardBuyInfo(substanceId) {
    const stats = getBuyStats(substanceId);
    return {
        spentToday: stats.spentToday,
        lastPurchase: stats.lastPurchase
    };
}

// ——— Event listeners ———
function setupEventListeners() {
    document.getElementById('craving-form')?.addEventListener('submit', handleCravingSubmit);
    document.getElementById('taper-form')?.addEventListener('submit', handleTaperSubmit);
    setupSubstanceForm();
    document.getElementById('save-substance-btn')?.addEventListener('click', () => {
        console.log('[substance] save button clicked');
        handleSubstanceSubmit();
    });

    document.getElementById('craving-intensity')?.addEventListener('input', e => {
        const el = document.getElementById('intensity-value');
        if (el) el.textContent = e.target.value;
    });
    document.getElementById('use-substance')?.addEventListener('change', updateUseUnitDropdown);
    document.getElementById('taper-substance')?.addEventListener('change', onTaperSubstanceChange);
}

// ——— Dashboard ———
function updateDashboard() {
    const today = new Date().toISOString().split('T')[0];
    const filterId = isAllSubstancesView() ? DASHBOARD_ALL : currentSubstanceId;
    const todayCravings = filterCravingsBySubstance(appData.cravings.filter(c => c.date === today), currentSubstanceId);
    const cur = appData.settings.currency;

    let todayAmount = 0;
    let sessionDuration = 0;
    if (isAllSubstancesView()) {
        getActiveSubstances().forEach(sub => {
            const stats = getTodayUseStats(sub.id);
            todayAmount += stats.totalAmount;
            sessionDuration += stats.sessionDuration;
        });
    } else {
        const stats = getTodayUseStats(currentSubstanceId);
        todayAmount = stats.totalAmount;
        sessionDuration = stats.sessionDuration;
    }

    const unitLabel = isAllSubstancesView() ? 'uses' : (getSubstance(currentSubstanceId)?.defaultUnit || 'units');
    const set = (id, text) => { const el = document.getElementById(id); if (el) el.textContent = text; };

    set('dash-today-total-use', `${todayAmount.toFixed(1)} ${unitLabel}`);
    set('dash-today-session-duration', formatDurationHours(sessionDuration));

    const sinceMs = isAllSubstancesView()
        ? (() => {
            let min = null;
            getActiveSubstances().forEach(sub => {
                const ms = getTimeSinceLastUse(sub.id);
                if (ms != null && (min == null || ms < min)) min = ms;
            });
            return min;
        })()
        : getTimeSinceLastUse(currentSubstanceId);
    set('dash-time-since-last-use', sinceMs != null ? formatHoursAgo(sinceMs) : '—');

    if (!isAllSubstancesView()) {
        const sub = getSubstance(currentSubstanceId);
        const limit = getDailyLimitForDate(currentSubstanceId, today);
        const used = getUsedAmount(currentSubstanceId, today);
        if (sub?.taperTrackingEnabled && limit != null) {
            set('dash-daily-taper-limit', `${limit} ${sub.defaultUnit}`);
            set('dash-remaining-taper', `${Math.max(0, limit - used).toFixed(1)} ${sub.defaultUnit}`);
        } else {
            set('dash-daily-taper-limit', '—');
            set('dash-remaining-taper', '—');
        }
        updateRecoveryStreakDisplay(currentSubstanceId);
    } else {
        set('dash-daily-taper-limit', '—');
        set('dash-remaining-taper', 'Select substance');
        set('recovery-streak-current', '—');
        set('recovery-streak-since', 'Select a substance');
        const bestEl = document.getElementById('recovery-streak-best');
        if (bestEl) bestEl.textContent = '—';
    }

    const buyInfo = getDashboardBuyInfo(filterId);
    set('dash-spent-today-buy', `${cur}${buyInfo.spentToday.toFixed(2)}`);
    if (buyInfo.lastPurchase) {
        const sub = getSubstance(getPurchaseSubstanceId(buyInfo.lastPurchase));
        set('dash-last-purchase', `${formatDate(buyInfo.lastPurchase.date)} · ${sub?.name || ''}`);
    } else {
        set('dash-last-purchase', '—');
    }

    set('cravings-resisted', String(todayCravings.length));
    updateCurrentSupplyDashboard();
    renderSubstanceCompare();
    updateQuickActions();
    const dashboardTaperId = getMainSubstanceId() || (isAllSubstancesView() ? null : currentSubstanceId);
    updateDoNotSurpassDisplay('dashboard', dashboardTaperId);
    updateTaperProgress();
    updateDashboardMainDisplay();
}

function updateDashboardMainDisplay() {
    const el = document.getElementById('dashboard-main-substance');
    const main = getMainSubstance();
    if (!el) return;
    el.textContent = main ? `Main Substance: ${main.icon} ${main.name}` : 'Main Substance: —';
}

function renderSubstanceCompare() {
    const container = document.getElementById('substance-compare');
    if (!container) return;

    if (!isAllSubstancesView()) {
        container.classList.add('hidden');
        return;
    }

    container.classList.remove('hidden');
    const today = new Date().toISOString().split('T')[0];
    container.innerHTML = '<h3>Today by Substance</h3>';

    const grid = document.createElement('div');
    grid.className = 'compare-grid';

    getActiveSubstances().forEach(sub => {
        const logs = appData.logs.filter(l => l.date === today && l.substanceId === sub.id);
        const amount = logs.reduce((s, l) => s + l.amount, 0);
        const spent = getSubstancePurchaseSpend(sub.id, p => p.date === today);
        const { days } = computeRecoveryStreakDays(sub.id);
        const card = document.createElement('div');
        card.className = 'compare-card';
        card.style.borderTopColor = sub.color;
        card.innerHTML = `
            <div class="compare-header">${sub.icon} ${sub.name}</div>
            <div class="compare-stat"><span>Uses</span><strong>${amount} ${sub.defaultUnit}</strong></div>
            ${sub.costTrackingEnabled ? `<div class="compare-stat"><span>Spent</span><strong>${appData.settings.currency}${spent.toFixed(2)}</strong></div>` : ''}
            <div class="compare-stat"><span>Streak</span><strong>${days}d</strong></div>
        `;
        card.onclick = () => {
            currentSubstanceId = sub.id;
            setInputValue('dashboard-substance', sub.id);
            updateDashboard();
        };
        grid.appendChild(card);
    });

    container.appendChild(grid);
}

// ——— Recovery streaks ———
function getLastUseForSubstance(substanceId) {
    return appData.logs
        .filter(l => l.substanceId === substanceId)
        .sort((a, b) => new Date(b.timestamp || `${b.date}T${b.time}`) - new Date(a.timestamp || `${a.date}T${a.time}`))[0] || null;
}

function computeRecoveryStreakDays(substanceId) {
    const lastUse = getLastUseForSubstance(substanceId);
    if (!lastUse) return { days: 0, sinceLabel: 'No use logged yet' };
    const diffMs = Date.now() - new Date(lastUse.timestamp || `${lastUse.date}T${lastUse.time}`);
    const days = Math.floor(diffMs / 86400000);
    const hours = Math.floor((diffMs % 86400000) / 3600000);
    const sinceLabel = days === 0 ? (hours > 0 ? `${hours}h since last use` : 'Just now') : `${days} day${days !== 1 ? 's' : ''} since last use`;
    return { days, sinceLabel };
}

function snapshotBestStreakBeforeUse(substanceId) {
    const { days } = computeRecoveryStreakDays(substanceId);
    if (!appData.recoveryStreaks[substanceId]) appData.recoveryStreaks[substanceId] = { best: 0 };
    if (days > appData.recoveryStreaks[substanceId].best) appData.recoveryStreaks[substanceId].best = days;
}

function refreshAllRecoveryStreaks() {
    appData.substances.forEach(sub => {
        const { days } = computeRecoveryStreakDays(sub.id);
        if (!appData.recoveryStreaks[sub.id]) appData.recoveryStreaks[sub.id] = { best: 0 };
        if (days > appData.recoveryStreaks[sub.id].best) appData.recoveryStreaks[sub.id].best = days;
    });
    saveData(appData);
}

function updateRecoveryStreakDisplay(substanceId) {
    const { days, sinceLabel } = computeRecoveryStreakDays(substanceId);
    const best = Math.max(appData.recoveryStreaks[substanceId]?.best || 0, days);
    const dayLabel = `${days} day${days !== 1 ? 's' : ''}`;
    const bestLabel = `${best} day${best !== 1 ? 's' : ''}`;

    ['recovery-streak-current', 'stats-recovery-current'].forEach(id => {
        const el = document.getElementById(id);
        if (el) el.textContent = dayLabel;
    });
    const sinceEl = document.getElementById('recovery-streak-since');
    if (sinceEl) sinceEl.textContent = sinceLabel;
    ['recovery-streak-best', 'stats-recovery-best'].forEach(id => {
        const el = document.getElementById(id);
        if (el) el.textContent = bestLabel;
    });
}

// ——— Stats / Analytics ———
function updateStats() {
    if (isAllSubstancesView()) {
        renderSubstanceStatsBreakdown();
        document.getElementById('stats-single-view')?.classList.add('hidden');
        document.getElementById('stats-all-view')?.classList.remove('hidden');
        return;
    }

    document.getElementById('stats-single-view')?.classList.remove('hidden');
    document.getElementById('stats-all-view')?.classList.add('hidden');

    const substanceLogs = appData.logs.filter(l => l.substanceId === currentSubstanceId);
    const sub = getSubstance(currentSubstanceId);
    const today = new Date();
    const cur = appData.settings.currency;

    renderUsageChart();
    renderSpendingChart();

    const weekStart = new Date(today);
    weekStart.setDate(today.getDate() - today.getDay());
    const monthStart = new Date(today.getFullYear(), today.getMonth(), 1);

    const totalWeek = substanceLogs.filter(l => new Date(l.date) >= weekStart).reduce((s, l) => s + l.amount, 0);
    const totalMonth = substanceLogs.filter(l => new Date(l.date) >= monthStart).reduce((s, l) => s + l.amount, 0);
    const daysWithData = new Set(substanceLogs.map(l => l.date)).size;
    const avgPerDay = daysWithData ? (substanceLogs.reduce((s, l) => s + l.amount, 0) / daysWithData).toFixed(1) : 0;

    setText('total-week', `${totalWeek} ${sub?.defaultUnit || 'units'}`);
    setText('total-month', `${totalMonth} ${sub?.defaultUnit || 'units'}`);
    setText('avg-per-day', avgPerDay);

    updateLongestTimeBetween();
    const totalSpent = getSubstancePurchaseSpend(currentSubstanceId);
    setText('total-spent', `${cur}${totalSpent.toFixed(2)}`);

    const cpu = getAveragePurchaseCostPerUnit(currentSubstanceId);
    const avgNum = parseFloat(avgPerDay) || 0;
    if (cpu != null) {
        setText('cost-per-week', `${cur}${(avgNum * 7 * cpu).toFixed(2)}`);
        setText('cost-per-month', `${cur}${(avgNum * 30 * cpu).toFixed(2)}`);
    } else {
        setText('cost-per-week', '—');
        setText('cost-per-month', '—');
    }

    const taperStart = getTaperStartingDailyAverage(currentSubstanceId);
    if (taperStart != null && taperStart > 0) {
        const pct = Math.max(0, Math.round((1 - avgNum / taperStart) * 100));
        setText('reduction-baseline', `${pct}%`);
        if (cpu != null) {
            const baselineSpend = taperStart * cpu;
            const actualSpend = avgNum * cpu;
            setText('estimated-saved', `${cur}${Math.max(0, baselineSpend - actualSpend).toFixed(2)}`);
        } else {
            setText('estimated-saved', '—');
        }
    } else {
        setText('reduction-baseline', '—');
        setText('estimated-saved', '—');
    }

    updateRecoveryStreakDisplay(currentSubstanceId);
    renderTriggerBreakdown();
    renderTaperProgressStats(currentSubstanceId);
    setText('stats-cravings-count', String(appData.cravings.filter(c => c.substanceId === currentSubstanceId).length));
}

function renderSubstanceStatsBreakdown() {
    const container = document.getElementById('stats-by-substance');
    if (!container) return;
    container.innerHTML = '';

    getActiveSubstances().forEach(sub => {
        const logs = appData.logs.filter(l => l.substanceId === sub.id);
        const cravings = appData.cravings.filter(c => c.substanceId === sub.id);
        const spent = getSubstancePurchaseSpend(sub.id);
        const uses = logs.reduce((s, l) => s + l.amount, 0);
        const { days } = computeRecoveryStreakDays(sub.id);
        const best = appData.recoveryStreaks[sub.id]?.best || days;
        const taper = appData.taperPlans[sub.id];
        let taperPct = '—';
        if (taper && sub.taperTrackingEnabled) {
            const start = new Date(taper.startDate);
            const end = new Date(taper.endDate);
            taperPct = `${Math.round(Math.min(100, Math.max(0, ((Date.now() - start) / (end - start)) * 100)))}%`;
        }

        const card = document.createElement('div');
        card.className = 'stats-substance-card';
        card.style.borderLeftColor = sub.color;
        card.innerHTML = `
            <h4>${sub.icon} ${sub.name}</h4>
            <div class="stats-substance-grid">
                <div><span>Total uses</span><strong>${uses} ${sub.defaultUnit}</strong></div>
                <div><span>Money spent</span><strong>${sub.costTrackingEnabled ? appData.settings.currency + spent.toFixed(2) : '—'}</strong></div>
                <div><span>Streak</span><strong>${days}d (best ${best}d)</strong></div>
                <div><span>Cravings</span><strong>${cravings.length}</strong></div>
                <div><span>Taper</span><strong>${sub.taperTrackingEnabled ? taperPct : '—'}</strong></div>
            </div>
        `;
        container.appendChild(card);
    });
}

function renderTaperProgressStats(substanceId) {
    const el = document.getElementById('stats-taper-progress');
    if (!el) return;
    const plan = appData.taperPlans[substanceId];
    if (!plan) { el.textContent = 'No plan'; return; }
    const start = new Date(plan.startDate);
    const end = new Date(plan.endDate);
    const pct = Math.round(Math.min(100, Math.max(0, ((Date.now() - start) / (end - start)) * 100)));
    el.textContent = `${pct}% (${plan.startingDailyAverage ?? plan.currentAvg} → ${plan.goalDailyAverage ?? plan.goalAvg})`;
}

function renderUsageChart() {
    const container = document.getElementById('cigarettes-per-day-chart');
    container.innerHTML = '';
    const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    const today = new Date();
    const weekData = [];
    for (let i = 6; i >= 0; i--) {
        const date = new Date(today);
        date.setDate(date.getDate() - i);
        const dateStr = date.toISOString().split('T')[0];
        const count = appData.logs.filter(l => l.date === dateStr && l.substanceId === currentSubstanceId).reduce((s, l) => s + l.amount, 0);
        weekData.push({ day: days[date.getDay()], count });
    }
    const max = Math.max(...weekData.map(d => d.count), 1);
    weekData.forEach(data => {
        const bar = document.createElement('div');
        bar.className = 'chart-bar';
        bar.style.height = `${Math.max((data.count / max) * 100, 4)}%`;
        bar.innerHTML = `<span class="chart-bar-value">${data.count}</span><span class="chart-bar-label">${data.day}</span>`;
        container.appendChild(bar);
    });
}

function renderSpendingChart() {
    const container = document.getElementById('spending-per-day-chart');
    if (!container) return;
    container.innerHTML = '';
    const sub = getSubstance(currentSubstanceId);
    if (!sub?.costTrackingEnabled) {
        container.innerHTML = '<p class="empty-hint">Cost tracking disabled for this substance</p>';
        return;
    }
    const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    const today = new Date();
    const weekData = [];
    for (let i = 6; i >= 0; i--) {
        const date = new Date(today);
        date.setDate(date.getDate() - i);
        const dateStr = date.toISOString().split('T')[0];
        const cost = getSubstancePurchaseSpend(currentSubstanceId, p => p.date === dateStr);
        weekData.push({ day: days[date.getDay()], cost });
    }
    const maxCost = Math.max(...weekData.map(d => d.cost), 0.01);
    weekData.forEach(data => {
        const bar = document.createElement('div');
        bar.className = 'chart-bar chart-bar-spend';
        bar.style.height = `${Math.max((data.cost / maxCost) * 100, 4)}%`;
        bar.innerHTML = `<span class="chart-bar-value">${appData.settings.currency}${data.cost.toFixed(0)}</span><span class="chart-bar-label">${data.day}</span>`;
        container.appendChild(bar);
    });
}

function renderTriggerBreakdown() {
    const container = document.getElementById('trigger-breakdown');
    if (!container) return;
    const counts = {};
    appData.cravings.filter(c => c.substanceId === currentSubstanceId && c.trigger).forEach(c => {
        counts[c.trigger] = (counts[c.trigger] || 0) + 1;
    });
    const sorted = Object.entries(counts).sort((a, b) => b[1] - a[1]).slice(0, 6);
    if (!sorted.length) {
        container.innerHTML = '<p class="empty-hint">Log cravings to see trigger patterns</p>';
        return;
    }
    container.innerHTML = '';
    const max = sorted[0][1];
    sorted.forEach(([trigger, count]) => {
        const row = document.createElement('div');
        row.className = 'breakdown-row';
        row.innerHTML = `
            <div class="breakdown-label"><span>${trigger}</span><span>${count}</span></div>
            <div class="breakdown-bar"><div class="breakdown-fill" style="width:${Math.round(count / max * 100)}%"></div></div>
        `;
        container.appendChild(row);
    });
}

function updateLongestTimeBetween() {
    const logs = appData.logs.filter(l => l.substanceId === currentSubstanceId);
    const el = document.getElementById('longest-time-between');
    if (!el) return;
    if (logs.length < 2) { el.textContent = '--'; return; }
    const sorted = [...logs].sort((a, b) => new Date(`${a.date}T${a.time}`) - new Date(`${b.date}T${b.time}`));
    let max = 0;
    for (let i = 1; i < sorted.length; i++) {
        max = Math.max(max, new Date(`${sorted[i].date}T${sorted[i].time}`) - new Date(`${sorted[i - 1].date}T${sorted[i - 1].time}`));
    }
    const hrs = Math.floor(max / 3600000);
    const days = Math.floor(hrs / 24);
    el.textContent = days > 0 ? `${days}d ${hrs % 24}h` : `${hrs}h`;
}

// ——— Taper / Do Not Surpass ———
const TAPER_RELAPSE_NOTE = 'Going over your limit doesn\'t erase your progress. Every day is a new chance—no shame, just data.';
const TAPER_REDUCTION_LABELS = {
    'reduce-amount': 'Reduce by amount',
    'reduce-percent': 'Reduce by percent',
    fixed: 'Fixed daily limit',
    'step-weekly': 'Weekly step-down'
};

function roundTaperValue(n) {
    return Math.round((parseFloat(n) || 0) * 2) / 2;
}

function migrateTaperPlan(plan, substanceId) {
    if (!plan) return;
    const now = new Date().toISOString();
    if (!plan.id) plan.id = `${substanceId}-${Date.now()}`;
    if (!plan.substanceId) plan.substanceId = substanceId;
    if (!plan.createdAt) plan.createdAt = plan.startDate ? `${plan.startDate}T12:00:00.000Z` : now;
    if (!plan.updatedAt) plan.updatedAt = plan.createdAt;
    if (plan.isPaused === undefined) plan.isPaused = false;

    plan.startingDailyAverage = plan.startingDailyAverage ?? plan.currentAvg ?? 0;
    plan.goalDailyAverage = plan.goalDailyAverage ?? plan.goalAvg ?? 0;
    plan.currentAvg = plan.startingDailyAverage;
    plan.goalAvg = plan.goalDailyAverage;

    if (!plan.reductionType) {
        const map = { linear: 'reduce-amount', 'step-weekly': 'step-weekly', hold: 'fixed', custom: 'fixed' };
        plan.reductionType = map[plan.planType] || 'reduce-amount';
    }

    if (plan.reductionAmount == null && plan.startingDailyAverage > plan.goalDailyAverage) {
        const weeks = Math.max(1, countWeeksBetween(plan.startDate, plan.endDate));
        plan.reductionAmount = roundTaperValue((plan.startingDailyAverage - plan.goalDailyAverage) / weeks);
    }
    if (plan.reductionPercent == null) plan.reductionPercent = 10;

    plan.weeklyMax = plan.weeklyMax ?? null;
    plan.doNotSurpassDaily = plan.doNotSurpassDaily ?? plan.warnBeforeSurpass ?? true;
    plan.doNotSurpassWeekly = plan.doNotSurpassWeekly ?? false;
    plan.notes = plan.notes ?? plan.taperNotes ?? '';
    plan.taperNotes = plan.notes;

    if (!plan.weeklyTargets?.length) {
        plan.weeklyTargets = generateWeeklyTargets(plan);
    }
    syncTaperPlanData(substanceId);
}

function countWeeksBetween(startDate, endDate) {
    const s = new Date(startDate + 'T12:00:00');
    const e = new Date(endDate + 'T12:00:00');
    return Math.max(1, Math.ceil((e - s) / (7 * 86400000)) + 1);
}

function generateWeeklyTargets(plan) {
    const { startDate, endDate, startingDailyAverage, goalDailyAverage, reductionType, reductionAmount, reductionPercent, weeklyMax } = plan;
    const weeks = [];
    let cursor = startDate;
    let currentDaily = startingDailyAverage;
    const goal = goalDailyAverage ?? 0;
    let guard = 0;

    while (cursor <= endDate && guard < 104) {
        guard++;
        const weekStart = cursor;
        let weekEnd = addDaysToDateStr(getWeekStartDateStr(cursor), 6);
        if (weekEnd > endDate) weekEnd = endDate;

        let dailyTarget = currentDaily;
        if (reductionType === 'fixed') {
            dailyTarget = goal > 0 ? goal : startingDailyAverage;
        }

        dailyTarget = roundTaperValue(Math.max(goal, dailyTarget));
        let wMax = weeklyMax > 0 ? roundTaperValue(weeklyMax) : roundTaperValue(dailyTarget * 7);

        weeks.push({
            weekStart,
            weekEnd,
            dailyTarget,
            weeklyMax: wMax,
            actualUsed: 0,
            difference: 0,
            status: 'under'
        });

        switch (reductionType) {
            case 'reduce-amount':
            case 'step-weekly':
                currentDaily = Math.max(goal, currentDaily - (parseFloat(reductionAmount) || 0));
                break;
            case 'reduce-percent':
                currentDaily = Math.max(goal, currentDaily * (1 - (parseFloat(reductionPercent) || 0) / 100));
                break;
            case 'fixed':
                currentDaily = goal > 0 ? goal : startingDailyAverage;
                break;
            default: {
                const wk = weeks.length;
                const totalW = countWeeksBetween(startDate, endDate);
                const dec = totalW > 1 ? (startingDailyAverage - goal) / (totalW - 1) : 0;
                currentDaily = Math.max(goal, startingDailyAverage - dec * wk);
            }
        }

        const next = addDaysToDateStr(weekEnd, 1);
        if (next <= cursor) break;
        cursor = next;
    }
    return weeks;
}

function expandDailyTargetsFromWeekly(plan) {
    const daily = [];
    (plan.weeklyTargets || []).forEach(w => {
        let d = w.weekStart;
        while (d <= w.weekEnd) {
            daily.push({
                date: d,
                limit: w.dailyTarget,
                target: w.dailyTarget,
                used: 0,
                remaining: w.dailyTarget,
                status: 'under'
            });
            d = addDaysToDateStr(d, 1);
        }
    });
    plan.dailyTargets = daily;
}

function syncTaperPlanData(substanceId) {
    const plan = appData.taperPlans[substanceId];
    if (!plan) return;

    (plan.weeklyTargets || []).forEach(w => {
        let actual = 0;
        let d = w.weekStart;
        while (d <= w.weekEnd) {
            actual += getUsedAmount(substanceId, d);
            d = addDaysToDateStr(d, 1);
        }
        w.actualUsed = roundTaperValue(actual);
        w.difference = roundTaperValue(actual - w.weeklyMax);
        w.status = getTaperLimitStatus(actual, w.weeklyMax).status;
    });

    expandDailyTargetsFromWeekly(plan);
    (plan.dailyTargets || []).forEach(day => {
        const limit = day.limit ?? day.target;
        if (limit == null) return;
        const used = getUsedAmount(substanceId, day.date);
        day.limit = limit;
        day.target = limit;
        day.used = used;
        day.remaining = Math.max(0, limit - used);
        day.status = getTaperLimitStatus(used, limit).status;
    });
}

function getWeekRowForDate(plan, dateStr) {
    return plan?.weeklyTargets?.find(w => dateStr >= w.weekStart && dateStr <= w.weekEnd);
}

function getDailyLimitForDate(substanceId, dateStr) {
    const plan = appData.taperPlans[substanceId];
    if (!plan || plan.isPaused) return null;
    const week = getWeekRowForDate(plan, dateStr);
    if (week) return week.dailyTarget;
    const day = plan.dailyTargets?.find(d => d.date === dateStr);
    return day ? (day.limit ?? day.target) : null;
}

function getWeeklyLimit(substanceId, dateStr) {
    const plan = appData.taperPlans[substanceId];
    if (!plan || plan.isPaused) return null;
    const week = getWeekRowForDate(plan, dateStr);
    if (week?.weeklyMax > 0) return week.weeklyMax;
    if (plan.weeklyMax > 0) return plan.weeklyMax;
    const daily = getDailyLimitForDate(substanceId, dateStr);
    return daily != null ? roundTaperValue(daily * 7) : null;
}

function getTaperLimitStatus(used, limit) {
    if (limit == null || limit <= 0) {
        return { status: 'none', label: 'No target', emoji: '—' };
    }
    if (used > limit) {
        return { status: 'over', label: 'Over target', emoji: '🚫' };
    }
    if (used >= limit * 0.8) {
        return { status: 'close', label: 'Close to target', emoji: '⚠️' };
    }
    return { status: 'under', label: 'Under target', emoji: '✅' };
}

function getTaperDailyStatusText(status) {
    if (status === 'over') return 'Over daily target';
    if (status === 'close') return 'Close to daily target';
    if (status === 'under') return 'Under daily target';
    return 'No daily target';
}

function getTaperWeeklyStatusText(status) {
    if (status === 'over') return 'Over weekly target';
    if (status === 'close') return 'Close to weekly target';
    if (status === 'under') return 'Under weekly target';
    return 'No weekly target';
}

function applyTaperProgressBar(bar, barText, used, limit) {
    if (!bar) return;
    const { status } = getTaperLimitStatus(used, limit);
    const pct = limit > 0 ? (used / limit) * 100 : 0;
    bar.style.width = `${Math.min(100, Math.max(pct, used > 0 ? 4 : 0))}%`;
    bar.classList.remove('dns-under', 'dns-close', 'dns-over');
    bar.classList.add(`dns-${status}`);
    if (barText) barText.textContent = `${Math.round(pct)}%`;
    return status;
}

function getTaperCalculatedMetrics(plan, substanceId) {
    const sub = getSubstance(substanceId);
    const unit = sub?.defaultUnit || 'units';
    const today = new Date().toISOString().split('T')[0];
    const start = plan.startingDailyAverage ?? 0;
    const goal = plan.goalDailyAverage ?? 0;
    const totalReduction = Math.max(0, start - goal);
    const weeks = plan.weeklyTargets?.length || 1;
    const weeklyReduction = weeks > 0 ? totalReduction / weeks : 0;
    const todayTarget = getDailyLimitForDate(substanceId, today);
    const currentWeek = getWeekRowForDate(plan, today);
    const nextWeekStart = currentWeek ? addDaysToDateStr(currentWeek.weekEnd, 1) : null;
    const nextWeek = nextWeekStart ? plan.weeklyTargets.find(w => w.weekStart === nextWeekStart) : null;
    const nextWeekTarget = nextWeek?.dailyTarget ?? goal;

    return {
        unit,
        totalReduction,
        weeklyReduction,
        todayTarget,
        nextWeekTarget,
        endDate: plan.endDate,
        weeks
    };
}

function getTaperDayStatus(substanceId, dateStr) {
    const limit = getDailyLimitForDate(substanceId, dateStr);
    if (limit == null) return 'none';
    const used = getUsedAmount(substanceId, dateStr);
    return getTaperLimitStatus(used, limit).status;
}

function confirmTaperBeforeLog(substanceId, amount, isQuickLog, excludeLogId = null) {
    const sub = getSubstance(substanceId);
    if (!sub?.taperTrackingEnabled) return true;

    const plan = appData.taperPlans[substanceId];
    if (!plan || plan.isPaused) return true;

    const today = new Date().toISOString().split('T')[0];
    const dailyLimit = getDailyLimitForDate(substanceId, today);
    const usedToday = getUsedAmount(substanceId, today, excludeLogId);
    let weekUsed = getWeeklyUsed(substanceId, today);
    if (excludeLogId) {
        const ex = findUseEntry(excludeLogId);
        if (ex && getUseSubstanceId(ex) === substanceId) {
            const ws = getWeekStartDateStr(today);
            const we = addDaysToDateStr(ws, 6);
            if (ex.date >= ws && ex.date <= we) weekUsed -= parseFloat(ex.amount) || 0;
        }
    }

    if (plan.doNotSurpassDaily && dailyLimit != null && usedToday + amount > dailyLimit) {
        if (!confirm('This entry will exceed your daily taper target. Log anyway?')) return false;
    }

    const weeklyLimit = getWeeklyLimit(substanceId, today);
    if (plan.doNotSurpassWeekly && weeklyLimit != null && weekUsed + amount > weeklyLimit) {
        if (!confirm('This entry will exceed your weekly taper target. Log anyway?')) return false;
    }

    return true;
}

function notifyTaperAfterLog(substanceId) {
    const sub = getSubstance(substanceId);
    if (!sub?.taperTrackingEnabled) return;
    const today = new Date().toISOString().split('T')[0];
    const limit = getDailyLimitForDate(substanceId, today);
    if (limit == null) return;
    const used = getUsedAmount(substanceId, today);
    const { status } = getTaperLimitStatus(used, limit);
    const unit = sub.defaultUnit;
    if (status === 'close') {
        alert(`⚠️ Close to daily target: ${used}/${limit} ${unit}. ${Math.max(0, limit - used).toFixed(1)} remaining.`);
    } else if (status === 'over') {
        alert(`🚫 Over daily target (${used}/${limit} ${unit}).\n\n${TAPER_RELAPSE_NOTE}`);
    }
}

function buildTaperPlanFromForm(substanceId, existingPlan) {
    const now = new Date().toISOString();
    const startDate = existingPlan?.startDate || new Date().toISOString().split('T')[0];
    const plan = {
        id: existingPlan?.id || `${substanceId}-${Date.now()}`,
        substanceId,
        startDate,
        endDate: document.getElementById('end-date')?.value,
        startingDailyAverage: parseFloat(document.getElementById('current-avg')?.value) || 0,
        goalDailyAverage: parseFloat(document.getElementById('goal-avg')?.value) || 0,
        reductionType: document.getElementById('reduction-type')?.value || 'reduce-amount',
        reductionAmount: parseFloat(document.getElementById('reduction-amount')?.value) || 0,
        reductionPercent: parseFloat(document.getElementById('reduction-percent')?.value) || 0,
        weeklyMax: parseFloat(document.getElementById('weekly-max')?.value) || null,
        doNotSurpassDaily: document.getElementById('do-not-surpass-daily')?.checked !== false,
        doNotSurpassWeekly: !!document.getElementById('do-not-surpass-weekly')?.checked,
        notes: document.getElementById('taper-notes')?.value || '',
        isPaused: existingPlan?.isPaused || false,
        createdAt: existingPlan?.createdAt || now,
        updatedAt: now
    };
    plan.currentAvg = plan.startingDailyAverage;
    plan.goalAvg = plan.goalDailyAverage;
    plan.weeklyTargets = generateWeeklyTargets(plan);
    migrateTaperPlan(plan, substanceId);
    return plan;
}

function syncTaperSubstanceToMain() {
    const mainId = getMainSubstanceId();
    const el = document.getElementById('taper-substance');
    if (el && mainId && [...el.options].some(o => o.value === mainId)) el.value = mainId;
}

function onTaperSubstanceChange() {
    taperEditingPlan = false;
    refreshTaperDashboard();
}

function toggleTaperPlanTypeFields() {
    const type = document.getElementById('reduction-type')?.value || 'reduce-amount';
    const hint = document.getElementById('plan-type-hint');
    const amtGroup = document.getElementById('reduction-amount-group');
    const pctGroup = document.getElementById('reduction-percent-group');
    amtGroup?.classList.toggle('hidden', type === 'reduce-percent' || type === 'fixed');
    pctGroup?.classList.toggle('hidden', type !== 'reduce-percent');
    const hints = {
        'reduce-amount': 'Reduce a fixed amount from your daily average each week.',
        'reduce-percent': 'Reduce by a percentage of your daily average each week.',
        fixed: 'Keep the same daily limit until your target end date.',
        'step-weekly': 'Step down once per week (same as reduce by amount).'
    };
    if (hint) hint.textContent = hints[type] || hints['reduce-amount'];
}

function fillTaperFormFromPlan(plan) {
    if (!plan) return;
    setInputValue('current-avg', plan.startingDailyAverage ?? plan.currentAvg ?? '');
    setInputValue('goal-avg', plan.goalDailyAverage ?? plan.goalAvg ?? '');
    setInputValue('reduction-type', plan.reductionType || 'reduce-amount');
    setInputValue('reduction-amount', plan.reductionAmount ?? '');
    setInputValue('reduction-percent', plan.reductionPercent ?? '');
    setInputValue('end-date', plan.endDate || '');
    setInputValue('weekly-max', plan.weeklyMax ?? '');
    setInputValue('taper-notes', plan.notes || '');
    const dailyEl = document.getElementById('do-not-surpass-daily');
    const weeklyEl = document.getElementById('do-not-surpass-weekly');
    if (dailyEl) dailyEl.checked = plan.doNotSurpassDaily !== false;
    if (weeklyEl) weeklyEl.checked = !!plan.doNotSurpassWeekly;
    toggleTaperPlanTypeFields();
}

function setDefaultTaperEndDate() {
    const endEl = document.getElementById('end-date');
    if (!endEl || endEl.value) return;
    const d = new Date();
    d.setDate(d.getDate() + 30);
    endEl.value = d.toISOString().split('T')[0];
}

function showTaperSetup() {
    taperEditingPlan = true;
    setText('taper-setup-title', 'Create Reduction Plan');
    setText('taper-generate-btn', 'Save Plan');
    document.getElementById('taper-dashboard')?.classList.add('hidden');
    document.getElementById('taper-no-plan')?.classList.add('hidden');
    document.getElementById('taper-setup')?.classList.remove('hidden');
    setDefaultTaperEndDate();
    toggleTaperPlanTypeFields();
}

function taperMetricTile(label, value) {
    return `<div class="taper-metric-tile"><span>${label}</span><strong>${value}</strong></div>`;
}

function taperChipStat(label, value) {
    return `<div class="taper-chip-stat"><span>${label}</span><strong>${value}</strong></div>`;
}

function setTaperStatusBadge(el, status, shortLabel) {
    if (!el) return;
    el.textContent = shortLabel;
    el.className = `taper-status-badge taper-status-${status}`;
}

function shortTaperStatus(status) {
    if (status === 'over') return 'Over';
    if (status === 'close') return 'Close';
    if (status === 'under') return 'Under';
    return '—';
}

function renderTaperKpiRow(substanceId) {
    const plan = appData.taperPlans[substanceId];
    const sub = getSubstance(substanceId);
    if (!plan || !sub) return;

    const set = (id, text) => {
        const el = document.getElementById(id);
        if (el) el.textContent = text;
    };
    const unit = sub.defaultUnit;
    const tiles = ['taper-kpi-daily', 'taper-kpi-used', 'taper-kpi-remaining', 'taper-kpi-status'];
    tiles.forEach(id => document.getElementById(id)?.classList.remove('taper-kpi-under', 'taper-kpi-close', 'taper-kpi-over'));

    if (plan.isPaused) {
        set('taper-kpi-daily-val', 'Paused');
        set('taper-kpi-used-val', '—');
        set('taper-kpi-remaining-val', '—');
        set('taper-kpi-status-val', 'Paused');
        return;
    }

    const today = new Date().toISOString().split('T')[0];
    const dailyLimit = getDailyLimitForDate(substanceId, today);
    const usedToday = getUsedAmount(substanceId, today);

    if (dailyLimit == null) {
        set('taper-kpi-daily-val', '—');
        set('taper-kpi-used-val', `${usedToday} ${unit}`);
        set('taper-kpi-remaining-val', '—');
        set('taper-kpi-status-val', 'No plan');
        return;
    }

    const rem = Math.max(0, dailyLimit - usedToday);
    const { status } = getTaperLimitStatus(usedToday, dailyLimit);
    ['taper-kpi-status', 'taper-kpi-remaining'].forEach(id => {
        document.getElementById(id)?.classList.add(`taper-kpi-${status}`);
    });

    set('taper-kpi-daily-val', `${dailyLimit} ${unit}`);
    set('taper-kpi-used-val', `${usedToday} ${unit}`);
    set('taper-kpi-remaining-val', `${rem.toFixed(1)} ${unit}`);
    set('taper-kpi-status-val', shortTaperStatus(status));
}

function renderTaperReductionCard(substanceId) {
    const plan = appData.taperPlans[substanceId];
    const sub = getSubstance(substanceId);
    if (!plan || !sub) return;
    const unit = sub.defaultUnit;
    const calc = getTaperCalculatedMetrics(plan, substanceId);
    const ro = document.getElementById('taper-reduction-readonly');
    const ca = document.getElementById('taper-reduction-calculated');
    if (ro) {
        ro.innerHTML = [
            taperMetricTile('Starting Daily Average', `${plan.startingDailyAverage} ${unit}`),
            taperMetricTile('Goal Daily Average', `${plan.goalDailyAverage} ${unit}`),
            taperMetricTile('Reduction Target', TAPER_REDUCTION_LABELS[plan.reductionType] || plan.reductionType),
            plan.reductionType === 'reduce-percent'
                ? taperMetricTile('Reduction %', `${plan.reductionPercent}% / wk`)
                : taperMetricTile('Reduction / wk', `${plan.reductionAmount} ${unit}`),
            taperMetricTile('Target end date', formatDate(plan.endDate)),
            taperMetricTile('Weekly Limit', plan.weeklyMax ? `${plan.weeklyMax} ${unit}` : 'Auto'),
            taperMetricTile('Daily warn', plan.doNotSurpassDaily ? 'On' : 'Off'),
            taperMetricTile('Weekly warn', plan.doNotSurpassWeekly ? 'On' : 'Off')
        ].join('');
    }
    if (ca) {
        ca.innerHTML = [
            taperMetricTile('Total reduction', `${calc.totalReduction.toFixed(1)} ${unit}`),
            taperMetricTile('Weekly reduction', `${calc.weeklyReduction.toFixed(2)} ${unit}`),
            taperMetricTile('Today\'s target', calc.todayTarget != null ? `${calc.todayTarget} ${unit}` : '—'),
            taperMetricTile('Next week target', `${calc.nextWeekTarget} ${unit}`),
            taperMetricTile('Est. end date', formatDate(calc.endDate))
        ].join('');
    }
}

function renderTaperProgressCard(substanceId) {
    const plan = appData.taperPlans[substanceId];
    const sub = getSubstance(substanceId);
    if (!plan || !sub) return;
    syncTaperPlanData(substanceId);
    const today = new Date().toISOString().split('T')[0];
    const unit = sub.defaultUnit;
    const set = (id, text) => { const el = document.getElementById(id); if (el) el.textContent = text; };

    if (plan.isPaused) {
        setTaperStatusBadge(document.getElementById('taper-today-status'), 'close', 'Paused');
        setTaperStatusBadge(document.getElementById('taper-weekly-status'), 'close', 'Paused');
        return;
    }

    const dailyLimit = getDailyLimitForDate(substanceId, today);
    const usedToday = getUsedAmount(substanceId, today);
    const weeklyLimit = getWeeklyLimit(substanceId, today);
    const weeklyUsed = getWeeklyUsed(substanceId, today);

    if (dailyLimit != null) {
        const rem = Math.max(0, dailyLimit - usedToday);
        const pct = dailyLimit > 0 ? (usedToday / dailyLimit) * 100 : 0;
        const dailyStatus = applyTaperProgressBar(
            document.getElementById('taper-today-bar'),
            document.getElementById('taper-today-bar-text'),
            usedToday,
            dailyLimit
        );
        set('taper-today-limit', `${dailyLimit} ${unit}`);
        set('taper-today-used', `${usedToday} ${unit}`);
        set('taper-today-remaining', `${rem.toFixed(1)} ${unit}`);
        set('taper-today-pct', `${Math.round(pct)}%`);
        setTaperStatusBadge(document.getElementById('taper-today-status'), dailyStatus, shortTaperStatus(dailyStatus));
    }

    if (weeklyLimit != null) {
        const remW = Math.max(0, weeklyLimit - weeklyUsed);
        const pctW = weeklyLimit > 0 ? (weeklyUsed / weeklyLimit) * 100 : 0;
        const weeklyStatus = applyTaperProgressBar(
            document.getElementById('taper-weekly-bar'),
            document.getElementById('taper-weekly-bar-text'),
            weeklyUsed,
            weeklyLimit
        );
        set('taper-weekly-max-val', `${weeklyLimit} ${unit}`);
        set('taper-weekly-used', `${weeklyUsed} ${unit}`);
        set('taper-weekly-remaining', `${remW.toFixed(1)} ${unit}`);
        set('taper-weekly-pct', `${Math.round(pctW)}%`);
        setTaperStatusBadge(document.getElementById('taper-weekly-status'), weeklyStatus, shortTaperStatus(weeklyStatus));
    }
}

function getTaperWeeklySummary(plan, substanceId) {
    const today = new Date().toISOString().split('T')[0];
    const currentWeek = getWeekRowForDate(plan, today);
    const weekIndex = currentWeek ? plan.weeklyTargets.findIndex(w => w.weekStart === currentWeek.weekStart) + 1 : 0;
    const weeksRemaining = Math.max(0, (plan.weeklyTargets?.length || 0) - weekIndex);
    const start = plan.startingDailyAverage ?? 0;
    const goal = plan.goalDailyAverage ?? 0;
    const totalReduction = Math.max(0, start - goal);
    const currentDaily = currentWeek?.dailyTarget ?? getDailyLimitForDate(substanceId, today) ?? start;
    const reductionCompleted = Math.max(0, start - currentDaily);

    let avgThis = 0;
    let daysThis = 0;
    if (currentWeek) {
        let d = currentWeek.weekStart;
        while (d <= today && d <= currentWeek.weekEnd) {
            avgThis += getUsedAmount(substanceId, d);
            daysThis++;
            d = addDaysToDateStr(d, 1);
        }
    }
    avgThis = daysThis ? avgThis / daysThis : getUsedAmount(substanceId, today);

    const prevStart = currentWeek ? addDaysToDateStr(getWeekStartDateStr(currentWeek.weekStart), -7) : null;
    const prevWeek = prevStart ? plan.weeklyTargets.find(w => w.weekStart === getWeekStartDateStr(prevStart)) : null;
    let avgLast = 0;
    if (prevWeek) {
        let d = prevWeek.weekStart;
        let cnt = 0;
        while (d <= prevWeek.weekEnd) {
            avgLast += getUsedAmount(substanceId, d);
            cnt++;
            d = addDaysToDateStr(d, 1);
        }
        avgLast = cnt ? avgLast / cnt : 0;
    }
    const changeVsLast = avgLast > 0 ? ((avgThis - avgLast) / avgLast) * 100 : null;

    let underWeeks = 0;
    let overWeeks = 0;
    (plan.weeklyTargets || []).forEach(w => {
        if (w.weekEnd > today) return;
        if (w.status === 'over') overWeeks++;
        else if (w.status === 'under' || w.status === 'close') underWeeks++;
    });

    return { weekIndex, weeksRemaining, reductionCompleted, totalReduction, avgThis, avgLast, changeVsLast, underWeeks, overWeeks };
}

function renderTaperWeeklyPlan(substanceId) {
    const plan = appData.taperPlans[substanceId];
    const sub = getSubstance(substanceId);
    const table = document.getElementById('taper-weekly-table');
    const summary = document.getElementById('taper-weekly-summary');
    if (!plan || !sub || !table) return;

    syncTaperPlanData(substanceId);
    const unit = sub.defaultUnit;
    const sum = getTaperWeeklySummary(plan, substanceId);

    if (summary) {
        const changeStr = sum.changeVsLast != null
            ? `${sum.changeVsLast >= 0 ? '+' : ''}${sum.changeVsLast.toFixed(0)}%`
            : '—';
        summary.innerHTML = [
            taperChipStat('Week', sum.weekIndex || '—'),
            taperChipStat('Weeks Remaining', sum.weeksRemaining),
            taperChipStat('Reduction done', `${sum.reductionCompleted.toFixed(1)}/${sum.totalReduction.toFixed(1)}`),
            taperChipStat('Avg this week', `${sum.avgThis.toFixed(1)} ${unit}`),
            taperChipStat('Avg last week', `${sum.avgLast.toFixed(1)} ${unit}`),
            taperChipStat('Change vs Last Week', changeStr),
            taperChipStat('Under weeks', sum.underWeeks),
            taperChipStat('Over weeks', sum.overWeeks)
        ].join('');
    }

    if (!plan.weeklyTargets?.length) {
        table.innerHTML = '<p class="empty-hint">No weekly rows.</p>';
        return;
    }

    let html = `<table class="taper-preview-table taper-weekly-table"><thead><tr>
        <th>Week Start</th><th>Week End</th><th>Daily Target</th><th>Weekly Max</th>
        <th>Actual Used</th><th>Difference</th><th>Status</th>
    </tr></thead><tbody>`;
    plan.weeklyTargets.forEach(w => {
        const { emoji, label } = getTaperLimitStatus(w.actualUsed, w.weeklyMax);
        const diffLabel = w.difference > 0 ? `+${w.difference}` : w.difference;
        html += `<tr class="taper-preview-${w.status}">
            <td>${formatDate(w.weekStart)}</td>
            <td>${formatDate(w.weekEnd)}</td>
            <td>${w.dailyTarget} ${unit}</td>
            <td>${w.weeklyMax} ${unit}</td>
            <td>${w.actualUsed}</td>
            <td>${diffLabel}</td>
            <td>${emoji} ${label === 'Over target' ? 'Over' : label === 'Close to target' ? 'Close' : 'Under'}</td>
        </tr>`;
    });
    html += '</tbody></table>';
    table.innerHTML = html;
}

function renderTaperPlanSummary(substanceId) {
    const plan = appData.taperPlans[substanceId];
    const sub = getSubstance(substanceId);
    if (!plan || !sub) return;
    const summary = document.getElementById('taper-plan-summary-text');
    const dates = document.getElementById('taper-plan-summary-dates');
    const icon = document.getElementById('taper-plan-icon');
    if (icon) icon.textContent = sub.icon || '📉';
    if (summary) {
        summary.textContent = `${sub.name} · ${TAPER_REDUCTION_LABELS[plan.reductionType] || plan.reductionType}`;
    }
    if (dates) {
        dates.textContent = `${formatDate(plan.startDate)} → ${formatDate(plan.endDate)} · ${plan.startingDailyAverage} → ${plan.goalDailyAverage} ${sub.defaultUnit}/day`;
    }
    const pauseBtn = document.getElementById('taper-pause-btn');
    if (pauseBtn) pauseBtn.textContent = plan.isPaused ? '▶ Resume' : '⏸ Pause';
    document.getElementById('taper-paused-banner')?.classList.toggle('hidden', !plan.isPaused);

    const fill = document.getElementById('taper-plan-pct-fill');
    const pctLabel = document.getElementById('taper-plan-pct-label');
    if (fill && plan.startDate && plan.endDate) {
        const start = new Date(plan.startDate + 'T12:00:00');
        const end = new Date(plan.endDate + 'T12:00:00');
        const pct = Math.min(100, Math.max(0, ((Date.now() - start) / (end - start)) * 100));
        const rounded = Math.round(pct);
        fill.style.width = `${rounded}%`;
        if (pctLabel) pctLabel.textContent = `Plan progress · ${rounded}%`;
    }
}

function updateDoNotSurpassDisplay(prefix, substanceId) {
    if (!substanceId) {
        document.getElementById('dns-section')?.classList.add('hidden');
        return;
    }
    const sub = getSubstance(substanceId);
    const plan = appData.taperPlans[substanceId];
    const section = document.getElementById('dns-section');
    if (!sub?.taperTrackingEnabled || !plan || plan.isPaused) {
        section?.classList.add('hidden');
        return;
    }
    const today = new Date().toISOString().split('T')[0];
    const dailyLimit = getDailyLimitForDate(substanceId, today);
    if (dailyLimit == null) {
        section?.classList.add('hidden');
        return;
    }
    section?.classList.remove('hidden');
    syncTaperPlanData(substanceId);

    const usedToday = getUsedAmount(substanceId, today);
    const weeklyLimit = getWeeklyLimit(substanceId, today);
    const weeklyUsed = getWeeklyUsed(substanceId, today);
    const unit = sub.defaultUnit;
    const set = (id, text) => { const el = document.getElementById(id); if (el) el.textContent = text; };

    const subLabel = document.getElementById('dashboard-taper-substance-label');
    if (subLabel) subLabel.textContent = `(${sub.name})`;

    const remDaily = Math.max(0, dailyLimit - usedToday);
    const dailyStatus = applyTaperProgressBar(
        document.getElementById('dashboard-dns-bar'),
        document.getElementById('dashboard-dns-bar-text'),
        usedToday,
        dailyLimit
    );
    set('dashboard-dns-limit', `${dailyLimit} ${unit}`);
    set('dashboard-dns-used', `${usedToday} ${unit}`);
    set('dashboard-dns-remaining', `${remDaily.toFixed(1)} ${unit}`);
    set('dashboard-dns-used-max', `${usedToday} / ${dailyLimit} ${unit} daily`);
    const dailyStatusEl = document.getElementById('dashboard-dns-status');
    if (dailyStatusEl) {
        dailyStatusEl.textContent = getTaperDailyStatusText(dailyStatus);
        dailyStatusEl.className = `dns-status dns-status-${dailyStatus}`;
    }

    if (weeklyLimit != null) {
        const remW = Math.max(0, weeklyLimit - weeklyUsed);
        const weeklyStatus = applyTaperProgressBar(
            document.getElementById('dashboard-weekly-bar'),
            document.getElementById('dashboard-weekly-bar-text'),
            weeklyUsed,
            weeklyLimit
        );
        set('dashboard-weekly-limit', `${weeklyLimit} ${unit}`);
        set('dashboard-weekly-used', `${weeklyUsed} ${unit}`);
        set('dashboard-weekly-remaining', `${remW.toFixed(1)} ${unit}`);
        const weeklyStatusEl = document.getElementById('dashboard-weekly-status');
        if (weeklyStatusEl) {
            weeklyStatusEl.textContent = getTaperWeeklyStatusText(weeklyStatus);
            weeklyStatusEl.className = `dns-status dns-status-${weeklyStatus}`;
        }
        const overall = document.getElementById('dashboard-taper-overall-status');
        if (overall) {
            overall.textContent = dailyStatus === 'over' || weeklyStatus === 'over'
                ? '🚫 Over taper target'
                : dailyStatus === 'close' || weeklyStatus === 'close'
                    ? '⚠️ Close to taper target'
                    : '✅ On track';
        }
    }
}

function handleTaperSubmit(e) {
    e.preventDefault();
    const substanceId = document.getElementById('taper-substance')?.value;
    const sub = getSubstance(substanceId);
    if (!sub?.taperTrackingEnabled) return alert('Taper tracking is disabled for this substance.');
    const endDate = document.getElementById('end-date')?.value;
    const startDate = taperEditingPlan && appData.taperPlans[substanceId]?.startDate
        ? appData.taperPlans[substanceId].startDate
        : new Date().toISOString().split('T')[0];
    if (!endDate || new Date(endDate) <= new Date(startDate)) {
        return alert('Target end date must be after the start date.');
    }
    const wasEdit = !!appData.taperPlans[substanceId];
    appData.taperPlans[substanceId] = buildTaperPlanFromForm(substanceId, appData.taperPlans[substanceId]);
    saveData(appData);
    taperEditingPlan = false;
    document.getElementById('taper-cancel-edit-btn')?.classList.add('hidden');
    setText('taper-generate-btn', 'Save Plan');
    refreshTaperDashboard();
    alert(wasEdit ? 'Plan updated!' : 'Taper plan saved!');
}

function getTaperSubstanceId() {
    const el = document.getElementById('taper-substance');
    if (el?.value) return el.value;
    return getMainSubstanceId() || currentSubstanceId;
}

function renderTaperPlan() {
    const substanceId = getTaperSubstanceId();
    const sub = getSubstance(substanceId);
    const plan = appData.taperPlans[substanceId];
    const dashboard = document.getElementById('taper-dashboard');
    const setup = document.getElementById('taper-setup');
    const noPlan = document.getElementById('taper-no-plan');
    const noTaper = document.getElementById('taper-disabled-msg');

    setDefaultTaperEndDate();

    if (!sub?.taperTrackingEnabled) {
        dashboard?.classList.add('hidden');
        setup?.classList.add('hidden');
        noPlan?.classList.add('hidden');
        noTaper?.classList.remove('hidden');
        return;
    }
    noTaper?.classList.add('hidden');

    if (!plan && !taperEditingPlan) {
        dashboard?.classList.add('hidden');
        setup?.classList.add('hidden');
        noPlan?.classList.remove('hidden');
        return;
    }

    noPlan?.classList.add('hidden');

    if (taperEditingPlan) {
        dashboard?.classList.add('hidden');
        setup?.classList.remove('hidden');
        return;
    }

    setup?.classList.add('hidden');
    dashboard?.classList.remove('hidden');
    migrateTaperPlan(plan, substanceId);
    renderTaperKpiRow(substanceId);
    renderTaperPlanSummary(substanceId);
    renderTaperReductionCard(substanceId);
    renderTaperProgressCard(substanceId);
    renderTaperWeeklyPlan(substanceId);
}

function editTaperPlan() {
    const substanceId = getTaperSubstanceId();
    const plan = appData.taperPlans[substanceId];
    if (!plan) return;
    taperEditingPlan = true;
    fillTaperFormFromPlan(plan);
    setText('taper-setup-title', 'Edit Reduction Plan');
    setText('taper-generate-btn', 'Save Changes');
    document.getElementById('taper-dashboard')?.classList.add('hidden');
    document.getElementById('taper-no-plan')?.classList.add('hidden');
    document.getElementById('taper-setup')?.classList.remove('hidden');
    document.getElementById('taper-setup')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

function cancelTaperEdit() {
    taperEditingPlan = false;
    document.getElementById('taper-setup')?.classList.add('hidden');
    setText('taper-generate-btn', 'Save Plan');
    setText('taper-setup-title', 'Create Reduction Plan');
    refreshTaperDashboard();
}

function pauseTaper() {
    const id = getTaperSubstanceId();
    const plan = appData.taperPlans[id];
    if (!plan) return;
    plan.isPaused = !plan.isPaused;
    plan.updatedAt = new Date().toISOString();
    saveData(appData);
    refreshTaperDashboard();
}

function resetTaper() {
    const id = getTaperSubstanceId();
    if (!confirm('Reset taper plan? This cannot be undone.')) return;
    delete appData.taperPlans[id];
    taperEditingPlan = false;
    saveData(appData);
    refreshTaperDashboard();
    document.getElementById('dns-section')?.classList.add('hidden');
}

function checkTaperTarget() {
    renderTaperProgressCard(getTaperSubstanceId());
}

function getDaysLeftInWeek(dateStr) {
    const d = new Date(dateStr + 'T12:00:00');
    return 6 - d.getDay();
}

function addDaysToDateStr(dateStr, days) {
    const d = new Date(dateStr + 'T12:00:00');
    d.setDate(d.getDate() + days);
    return d.toISOString().split('T')[0];
}

function getUsedAmount(substanceId, dateStr, excludeLogId = null) {
    return appData.logs
        .filter(l => l.date === dateStr && getUseSubstanceId(l) === substanceId && l.id !== excludeLogId)
        .reduce((s, l) => s + (parseFloat(l.amount) || 0), 0);
}

function getWeekStartDateStr(dateStr) {
    const d = new Date(dateStr + 'T12:00:00');
    d.setDate(d.getDate() - d.getDay());
    return d.toISOString().split('T')[0];
}

function getWeeklyUsed(substanceId, dateStr) {
    const weekStart = new Date(getWeekStartDateStr(dateStr) + 'T12:00:00');
    const weekEnd = new Date(weekStart);
    weekEnd.setDate(weekStart.getDate() + 6);
    const inWeek = (date) => {
        const ld = new Date(date + 'T12:00:00');
        return ld >= weekStart && ld <= weekEnd;
    };
    return appData.logs
        .filter(l => getUseSubstanceId(l) === substanceId && inWeek(l.date))
        .reduce((s, l) => s + (parseFloat(l.amount) || 0), 0);
}

function updateTaperProgress() {
    const substanceId = getMainSubstanceId() || getTaperSubstanceId();
    const sub = getSubstance(substanceId);
    const plan = appData.taperPlans[substanceId];
    const bar = document.getElementById('taper-progress');
    if (!bar) return;
    const pt = document.getElementById('progress-text');
    const pl = document.getElementById('progress-label');
    if (!plan || !sub?.taperTrackingEnabled || plan.isPaused) {
        bar.style.width = '0%';
        if (pt) pt.textContent = '0%';
        if (pl) pl.textContent = plan?.isPaused ? 'Taper paused' : 'No taper goal set';
        return;
    }
    const start = new Date(plan.startDate + 'T12:00:00');
    const end = new Date(plan.endDate + 'T12:00:00');
    const pct = Math.min(100, Math.max(0, ((Date.now() - start) / (end - start)) * 100));
    bar.style.width = `${pct}%`;
    if (pt) pt.textContent = `${Math.round(pct)}%`;
    if (pl) {
        pl.textContent = `${sub.icon} ${sub.name}: ${plan.startingDailyAverage} → ${plan.goalDailyAverage} ${sub.defaultUnit}/day`;
    }
}
// ——— Calendar ———
function getCalendarTaperSubstanceId() {
    const el = document.getElementById('calendar-substance');
    return el?.value || getTaperSubstances()[0]?.id || null;
}

function renderCalendar() {
    const container = document.getElementById('calendar-grid');
    container.innerHTML = '';
    const year = currentCalendarDate.getFullYear();
    const month = currentCalendarDate.getMonth();
    setText('calendar-month', currentCalendarDate.toLocaleDateString('en-US', { month: 'long', year: 'numeric' }));

    ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].forEach(day => {
        const h = document.createElement('div');
        h.className = 'calendar-day-header';
        h.textContent = day;
        container.appendChild(h);
    });

    const firstDay = new Date(year, month, 1).getDay();
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const today = new Date().toISOString().split('T')[0];

    for (let i = 0; i < firstDay; i++) container.appendChild(document.createElement('div'));

    const taperSubstanceId = getCalendarTaperSubstanceId();

    for (let day = 1; day <= daysInMonth; day++) {
        const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
        const dayLogs = appData.logs.filter(l => l.date === dateStr);
        const dayCravings = appData.cravings.filter(c => c.date === dateStr);
        const ids = [...new Set(dayLogs.map(l => l.substanceId))];
        const cell = document.createElement('div');
        cell.className = 'calendar-day';
        if (dayLogs.length || dayCravings.length) cell.classList.add('has-data');
        if (dateStr === today) cell.classList.add('today');
        if (dateStr === selectedDate) cell.classList.add('selected');

        if (taperSubstanceId) {
            const dayStatus = getTaperDayStatus(taperSubstanceId, dateStr);
            if (dayStatus === 'none') {
                cell.classList.add('taper-none');
            } else if (dayStatus) {
                cell.classList.add(`taper-${dayStatus}`);
            }
        }

        let indicators = ids.slice(0, 2).map(id => {
            const sub = getSubstance(id);
            return `<span class="substance-indicator" style="color:${sub?.color || '#888'}">${sub?.icon || '?'}</span>`;
        }).join('');
        if (ids.length > 2) indicators += '<span class="substance-indicator">+</span>';

        cell.innerHTML = `<span>${day}</span>${indicators ? `<div class="substance-indicators">${indicators}</div>` : ''}${dayLogs.length ? `<span class="calendar-day-count">${dayLogs.reduce((s, l) => s + l.amount, 0)}</span>` : ''}`;
        cell.onclick = () => selectDate(dateStr);
        container.appendChild(cell);
    }
}

function changeMonth(delta) {
    currentCalendarDate.setMonth(currentCalendarDate.getMonth() + delta);
    renderCalendar();
}

function selectDate(dateStr) {
    selectedDate = dateStr;
    renderCalendar();
    renderDayDetails(dateStr);
}

function renderDayDetails(dateStr) {
    const container = document.getElementById('day-details-content');
    const dayLogs = appData.logs.filter(l => l.date === dateStr);
    const dayCravings = appData.cravings.filter(c => c.date === dateStr);
    const taperSubstanceId = getCalendarTaperSubstanceId();
    const sub = taperSubstanceId ? getSubstance(taperSubstanceId) : null;
    const limit = taperSubstanceId ? getDailyLimitForDate(taperSubstanceId, dateStr) : null;
    const used = taperSubstanceId ? getUsedAmount(taperSubstanceId, dateStr) : 0;

    const dayPurchaseSpend = (appData.purchases || [])
        .filter(p => p.date === dateStr)
        .reduce((s, p) => s + (p.totalCost ?? p.cost ?? 0), 0);
    let html = `<p><strong>${formatDate(dateStr)}</strong></p><p>Total uses: ${dayLogs.reduce((s, l) => s + l.amount, 0)}</p><p>Purchases: ${appData.settings.currency}${dayPurchaseSpend.toFixed(2)}</p><p>Cravings: ${dayCravings.length}</p>`;

    if (limit != null && sub) {
        const { emoji, label } = getTaperLimitStatus(used, limit);
        html += `<p>Taper (${sub.name}): ${used}/${limit} ${sub.defaultUnit} · ${emoji} ${label}</p>`;
    }
    dayLogs.forEach(log => {
        const sub = getSubstance(log.substanceId);
        const supplyLine = formatLinkedPurchaseDisplay(log);
        html += `<div class="list-item"><div>${sub?.icon} ${log.amount} ${log.unit} ${sub?.name} at ${log.startTime || log.time || ''}<br><small>${supplyLine}</small></div></div>`;
    });
    dayCravings.forEach(c => {
        const sub = getSubstance(c.substanceId);
        html += `<div class="list-item"><div>${sub?.icon} Craving ${c.intensity}/10</div></div>`;
    });
    container.innerHTML = html;
}

// ——— Settings ———
function loadSettings() {
    const currencyEl = document.getElementById('currency');
    const reminderEl = document.getElementById('reminder-message');
    const openMainEl = document.getElementById('open-on-main-substance');
    if (currencyEl) currencyEl.value = appData.settings.currency;
    if (reminderEl) reminderEl.value = appData.settings.reminderMessage;
    if (openMainEl) openMainEl.checked = appData.settings.openOnMainSubstance !== false;
}

function saveOpenOnMainSetting() {
    appData.settings.openOnMainSubstance = document.getElementById('open-on-main-substance')?.checked !== false;
    saveData(appData);
    if (appData.settings.openOnMainSubstance) {
        applyMainSubstanceToViewSelectors();
        applyMainSubstanceToForms();
        syncSubstanceSelectors();
        updateDashboard();
        updateDashboardMainDisplay();
    }
}

function saveSettings() {
    appData.settings.currency = document.getElementById('currency')?.value?.trim() || '$';
    appData.settings.reminderMessage = document.getElementById('reminder-message')?.value || '';
    saveData(appData);
    updateDashboard();
    updateStats();
}

function renderSupportContacts() {
    const container = document.getElementById('support-contacts-list');
    if (!container) return;
    container.innerHTML = '';
    if (!appData.supportContacts.length) {
        container.innerHTML = '<p class="empty-hint">No contacts added</p>';
        return;
    }
    appData.supportContacts.forEach((contact, index) => {
        const item = document.createElement('div');
        item.className = 'list-item';
        item.innerHTML = `<div><strong>${contact.name}</strong><br><a href="tel:${contact.phone}">${contact.phone}</a></div><button class="delete-btn" onclick="deleteContact(${index})">Remove</button>`;
        container.appendChild(item);
    });
}

function handleAddContact(e) {
    e.preventDefault();
    const name = document.getElementById('contact-name')?.value?.trim();
    const phone = document.getElementById('contact-phone')?.value?.trim();
    if (!name || !phone) return;
    appData.supportContacts.push({ id: Date.now(), name, phone });
    saveData(appData);
    e.target.reset();
    renderSupportContacts();
}

function deleteContact(index) {
    if (confirm('Remove this contact?')) {
        appData.supportContacts.splice(index, 1);
        saveData(appData);
        renderSupportContacts();
    }
}

function renderReasons() {
    const container = document.getElementById('reasons-list');
    if (!container) return;
    container.innerHTML = '';
    if (!appData.reasons.length) {
        container.innerHTML = '<p class="empty-hint">No reasons added yet</p>';
        return;
    }
    appData.reasons.forEach((reason, index) => {
        const item = document.createElement('div');
        item.className = 'list-item';
        item.innerHTML = `<div>💪 ${reason}</div><button class="delete-btn" onclick="deleteReason(${index})">Remove</button>`;
        container.appendChild(item);
    });
}

function handleAddReason(e) {
    e.preventDefault();
    const reason = document.getElementById('reason')?.value?.trim();
    if (!reason) return;
    appData.reasons.push(reason);
    saveData(appData);
    e.target.reset();
    renderReasons();
}

function deleteReason(index) {
    if (confirm('Remove this reason?')) {
        appData.reasons.splice(index, 1);
        saveData(appData);
        renderReasons();
    }
}

function formatDate(dateStr) {
    return new Date(dateStr + 'T12:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

function downloadBlob(blob, filename) {
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = filename;
    a.click();
    URL.revokeObjectURL(a.href);
}

function cleanExportData(data) {
    return {
        version: 'recovery-tracker-v2',
        exportedAt: new Date().toISOString(),

        substances: (data.substances || []).map(s => ({
            id: s.id,
            name: s.name,
            icon: s.icon,
            color: s.color,
            units: s.units || ['units'],
            defaultUnit: s.defaultUnit || (s.units?.[0] || 'units'),
            costTrackingEnabled: s.costTrackingEnabled !== false,
            taperTrackingEnabled: s.taperTrackingEnabled !== false,
            active: s.active !== false,
            archived: !!s.archived,
            isMain: !!s.isMain,
            createdAt: s.createdAt || null,
            updatedAt: s.updatedAt || null
        })),

        logs: (data.logs || []).map(l => ({
            id: l.id,
            type: l.type || 'quick',
            substanceId: l.substanceId || l.substance || '',
            date: l.date,
            startTime: l.startTime || l.time || '',
            endTime: l.endTime || '',
            amount: Number(l.amount || 0),
            unit: l.unit || 'units',
            count: Number(l.count || 0),
            notes: l.notes || '',
            linkedPurchaseId: l.linkedPurchaseId || null,
            linkedPurchases: l.linkedPurchases || [],
            createdAt: l.createdAt || l.timestamp || null,
            updatedAt: l.updatedAt || l.timestamp || null
        })),

        purchases: (data.purchases || []).map(p => ({
            id: p.id,
            substanceId: p.substanceId || '',
            substanceName: p.substanceName || '',
            date: p.date,
            time: p.time || '',
            quantityBought: Number(p.quantityBought ?? p.quantity ?? 0),
            unit: p.unit || 'units',
            totalCost: Number(p.totalCost || 0),
            costPerUnit: Number(p.costPerUnit || 0),
            store: p.store || '',
            paymentMethod: p.paymentMethod || '',
            notes: p.notes || '',
            remainingAmount: Number(p.remainingAmount ?? p.quantityBought ?? p.quantity ?? 0),
            isDepleted: !!p.isDepleted,
            createdAt: p.createdAt || null,
            updatedAt: p.updatedAt || null
        })),

        taperPlans: data.taperPlans || {},

        settings: {
            currency: data.settings?.currency || '$',
            reminderMessage: data.settings?.reminderMessage || '',
            openOnMainSubstance: data.settings?.openOnMainSubstance !== false
        },

        recoveryStreaks: data.recoveryStreaks || {},
        supportContacts: data.supportContacts || [],
        reasons: data.reasons || [],
        migrations: data.migrations || {}
    };
}

function exportJsonBackup() {
    const exportObject = cleanExportData(appData);
    const dataStr = JSON.stringify(exportObject, null, 2);
    const blob = new Blob([dataStr], { type: 'application/json' });
    downloadBlob(blob, `recovery-tracker-backup-${new Date().toISOString().split('T')[0]}.json`);
}

function exportData() {
    exportJsonBackup();
}

function csvEscape(value) {
    const s = String(value ?? '');
    if (/[",\n\r]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
    return s;
}

function exportDataCsv() {
    const rows = [];
    rows.push(['Record Type', 'Substance', 'Date', 'Start', 'End', 'Amount', 'Unit', 'Count', 'Notes'].map(csvEscape).join(','));
    appData.logs.forEach(log => {
        rows.push([
            log.type === 'session' ? 'Use Session' : 'Use Quick',
            getSubstanceName(log.substanceId),
            log.date,
            log.startTime || log.time || '',
            log.endTime || '',
            log.amount,
            log.unit,
            log.count ?? '',
            log.notes || ''
        ].map(csvEscape).join(','));
    });
    rows.push('');
    rows.push(['Record Type', 'Substance', 'Date', 'Time', 'Quantity', 'Unit', 'Total Cost', 'Store', 'Notes'].map(csvEscape).join(','));
    (appData.purchases || []).forEach(p => {
        rows.push([
            'Purchase',
            getSubstanceName(p.substanceId),
            p.date,
            p.time || '',
            p.quantity,
            p.unit,
            p.totalCost ?? '',
            p.store || '',
            p.notes || ''
        ].map(csvEscape).join(','));
    });
    const blob = new Blob([rows.join('\n')], { type: 'text/csv;charset=utf-8' });
    downloadBlob(blob, `recovery-tracker-export-${new Date().toISOString().split('T')[0]}.csv`);
}

function validateBackupData(data) {
    if (!data || typeof data !== 'object' || Array.isArray(data)) {
        return { ok: false, error: 'Invalid backup file format.' };
    }
    if (!Array.isArray(data.substances)) return { ok: false, error: 'Backup is missing a substances list.' };
    if (!Array.isArray(data.logs)) return { ok: false, error: 'Backup is missing a logs list.' };
    if (!Array.isArray(data.purchases)) return { ok: false, error: 'Backup is missing a purchases list.' };
    if (!data.settings || typeof data.settings !== 'object') {
        return { ok: false, error: 'Backup is missing settings.' };
    }
    return { ok: true };
}

function mergeArrayById(existing, incoming) {
    const map = new Map((existing || []).map(item => [item.id, item]));
    (incoming || []).forEach(item => {
        if (item?.id != null) map.set(item.id, item);
        else map.set(`import-${Date.now()}-${Math.random()}`, item);
    });
    return [...map.values()];
}

function mergeImportedData(current, imported) {
    const merged = JSON.parse(JSON.stringify(current));
    merged.substances = mergeArrayById(merged.substances, imported.substances);
    merged.logs = mergeArrayById(merged.logs, imported.logs);
    merged.purchases = mergeArrayById(merged.purchases, imported.purchases);
    merged.cravings = mergeArrayById(merged.cravings || [], imported.cravings || []);
    merged.supportContacts = mergeArrayById(merged.supportContacts || [], imported.supportContacts || []);
    merged.settings = {
        ...merged.settings,
        ...imported.settings,
        substanceSettings: {
            ...(merged.settings?.substanceSettings || {}),
            ...(imported.settings?.substanceSettings || {})
        }
    };
    merged.taperPlans = { ...(merged.taperPlans || {}), ...(imported.taperPlans || {}) };
    merged.recoveryStreaks = { ...(merged.recoveryStreaks || {}), ...(imported.recoveryStreaks || {}) };
    if (Array.isArray(imported.reasons)) {
        const reasonSet = new Set([...(merged.reasons || []), ...imported.reasons]);
        merged.reasons = [...reasonSet];
    }
    if (imported.privacy && typeof imported.privacy === 'object') {
        merged.privacy = { ...merged.privacy, ...imported.privacy };
    }
    return merged;
}

function applyImportedBackup(imported, mode) {
    if (mode === 'replace') {
        appData = imported;
    } else {
        appData = mergeImportedData(appData, imported);
    }
    normalizeAppData(appData);
    saveData(appData);
    refreshAppAfterDataChange();
}

function triggerImportJsonBackup() {
    document.getElementById('import-json-input')?.click();
}

function handleImportJsonFile(event) {
    const input = event.target;
    const file = input.files?.[0];
    input.value = '';
    if (!file) return;

    const reader = new FileReader();
    reader.onload = () => {
        try {
            const parsed = JSON.parse(reader.result);
            const validation = validateBackupData(parsed);
            if (!validation.ok) {
                alert(validation.error);
                return;
            }

            const logCount = parsed.logs?.length ?? 0;
            const purchaseCount = parsed.purchases?.length ?? 0;
            const substanceCount = parsed.substances?.length ?? 0;
            const summary = `${substanceCount} substance(s), ${logCount} use log(s), ${purchaseCount} purchase(s).`;

            if (!confirm(`Import this backup?\n\n${summary}`)) return;

            const merge = confirm(
                'How should this backup be applied?\n\nOK = Merge with current data (matching IDs are updated)\nCancel = Replace all current data'
            );
            if (merge) {
                applyImportedBackup(parsed, 'merge');
                alert('Backup merged successfully.');
            } else {
                if (!confirm('Replace ALL current data with this backup? This cannot be undone except by importing another backup.')) return;
                applyImportedBackup(parsed, 'replace');
                alert('Backup imported. Your data was replaced.');
            }
        } catch (err) {
            console.error(err);
            alert('Could not read backup file. Make sure it is valid JSON.');
        }
    };
    reader.onerror = () => alert('Could not read the selected file.');
    reader.readAsText(file);
}

function clearAllData() {
    if (!confirm('Clear ALL data? This cannot be undone.')) return;
    if (!confirm('Delete all logs, substances, and settings?')) return;
    appData = JSON.parse(JSON.stringify(defaultData));
    appData.substances = getDefaultSubstances();
    saveData(appData);
    refreshAppAfterDataChange();
    alert('All data cleared.');
}

// Legacy global aliases
function logOneCigarette() { logOneUse(); }

if (typeof window !== 'undefined') {
    Object.assign(window, {
        openSubstanceEditor,
        closeSubstanceEditor,
        closeSubstanceModal,
        handleSubstanceSubmit,
        updateLastSaved,
        renderSubstances,
        populateSubstanceDropdowns,
        setMainSubstance,
        archiveSubstance,
        restoreSubstance,
        deleteSubstance
    });
}
