// Recovery Tracker v2 — dynamic substance tracking
const STORAGE_KEY = 'recovery-tracker-v2';
const STORAGE_KEY_V1 = 'use-tracker-v1';
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
    }
};

let isUnlocked = false;
let pinEntry = '';
let lastActivityAt = Date.now();
let autoLockTimer = null;
let editingSubstanceId = null;

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

function hashPin(pin) {
    let hash = 0;
    const str = `ut-${pin}-salt`;
    for (let i = 0; i < str.length; i++) {
        hash = ((hash << 5) - hash) + str.charCodeAt(i);
        hash |= 0;
    }
    return String(hash);
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
            quantity: qty,
            unit: 'units',
            totalCost: p.packPrice || 0,
            costPerUnit: qty > 0 ? (p.packPrice || 0) / qty : 0,
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
    const v2 = localStorage.getItem(STORAGE_KEY);
    if (v2) {
        const data = JSON.parse(v2);
        if (!data.substances?.length) data.substances = getDefaultSubstances();
        if (!data.privacy) data.privacy = { ...defaultData.privacy };
        if (!data.recoveryStreaks) data.recoveryStreaks = {};
        normalizeAppData(data);
        return data;
    }

    const v1 = localStorage.getItem(STORAGE_KEY_V1);
    if (v1) {
        const migrated = migrateFromV1(JSON.parse(v1));
        normalizeAppData(migrated);
        localStorage.setItem(STORAGE_KEY, JSON.stringify(migrated));
        return migrated;
    }

    return JSON.parse(JSON.stringify(defaultData));
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

    data.logs.forEach(log => {
        if (!log.type) log.type = log.endTime ? 'session' : 'quick';
        if (!log.startTime && log.time) log.startTime = log.time;
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
            cost: s.cost || 0,
            trigger: '',
            cravingLevel: 0,
            location: '',
            notes: s.notes || '',
            timestamp: s.timestamp || new Date().toISOString()
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
            quantity: qty,
            unit: 'units',
            totalCost: p.packPrice || 0,
            costPerUnit: qty > 0 ? (p.packPrice || 0) / qty : 0,
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

    if (data.settings && data.settings.openOnMainSubstance === undefined) {
        data.settings.openOnMainSubstance = true;
    }
    normalizeMainSubstances(data);
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
}

let appData = loadData();
let currentCalendarDate = new Date();
let selectedDate = null;
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

let currentSubstanceId = resolveStartupSubstanceId();

document.addEventListener('DOMContentLoaded', () => {
    try {
        initializeApp();
    } catch (error) {
        console.error('Error initializing app:', error);
    }
});

function initializeApp() {
    setupEventListeners();
    setupPrivacyLock();
    loadSettings();
    populateAllSubstanceDropdowns();
    syncSubstanceSelectors();
    updateDashboard();
    renderRecentUseList();
    renderCalendar();
    updateTaperProgress();
    checkTaperTarget();
    renderTaperPlan();
    renderSupportContacts();
    renderReasons();
    renderSubstancesList();
    setupBuyTrackerForm();
    setupUseLogForm();
    setDefaultUseLogDateTime();
    refreshAllRecoveryStreaks();
    updateQuickActions();
    updateDashboardMainDisplay();
    applyMainSubstanceToForms();

    if (appData.privacy?.enabled) lockApp();
    else isUnlocked = true;
}

// ——— Substance helpers ———
function getSubstance(id) {
    return appData.substances.find(s => s.id === id);
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
    ['dashboard-substance', 'stats-substance', 'settings-substance'].forEach(selectId => {
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

function getSubstanceSettings(id) {
    return appData.settings.substanceSettings[id] || { packPrice: 10, unitsPerPack: 20, baseline: 10, quitGoal: '' };
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
    const settingsDefault = currentSubstanceId === DASHBOARD_ALL ? (mainId || active[0]?.id) : (mainId && shouldOpenOnMainSubstance() ? mainId : currentSubstanceId);

    populateSelect('dashboard-substance', active, { includeAll: true, currentValue: viewDefault });
    populateSelect('craving-substance', getLoggableSubstances(), { currentValue: mainId });
    populateSelect('stats-substance', active, { includeAll: true, currentValue: viewDefault });
    populateSelect('settings-substance', active, { currentValue: settingsDefault });
    populateSelect('taper-substance', taperSubs, { currentValue: mainId && taperSubs.some(s => s.id === mainId) ? mainId : taperSubs[0]?.id });
    populateSelect('use-substance', getLoggableSubstances(), { currentValue: mainId });
    populateSelect('buy-substance', active, { currentValue: mainId });
    populateSelect('calendar-substance', taperSubs, { currentValue: mainId && taperSubs.some(s => s.id === mainId) ? mainId : taperSubs[0]?.id });
    updateUseUnitDropdown();
    updateBuyUnitDropdown();
    updateSettingsSectionsVisibility();
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

function updateSettingsSectionsVisibility() {
    const sub = getSubstance(currentSubstanceId === DASHBOARD_ALL ? document.getElementById('settings-substance')?.value : currentSubstanceId);
    const costSection = document.getElementById('settings-cost-section');
    const baselineSection = document.getElementById('settings-baseline-section');
    if (costSection) costSection.classList.toggle('hidden', !sub?.costTrackingEnabled);
    if (baselineSection) baselineSection.classList.toggle('hidden', !sub?.taperTrackingEnabled);
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
    recordActivity();
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
    const modal = document.getElementById('substance-editor-modal');
    const title = document.getElementById('substance-editor-title');
    const unitsInput = document.getElementById('substance-units');
    const iconPicker = document.getElementById('substance-icon-picker');
    const colorPicker = document.getElementById('substance-color-picker');

    title.textContent = id ? 'Edit Substance' : 'Add Substance';
    iconPicker.innerHTML = '';
    SUBSTANCE_ICONS.forEach(icon => {
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'icon-pick-btn';
        btn.textContent = icon;
        btn.onclick = () => {
            iconPicker.querySelectorAll('.icon-pick-btn').forEach(b => b.classList.remove('selected'));
            btn.classList.add('selected');
            document.getElementById('substance-icon').value = icon;
        };
        iconPicker.appendChild(btn);
    });

    colorPicker.innerHTML = '';
    SUBSTANCE_COLORS.forEach(color => {
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'color-pick-btn';
        btn.style.background = color;
        btn.dataset.color = color;
        btn.onclick = () => {
            colorPicker.querySelectorAll('.color-pick-btn').forEach(b => b.classList.remove('selected'));
            btn.classList.add('selected');
            document.getElementById('substance-color').value = color;
        };
        colorPicker.appendChild(btn);
    });

    if (id) {
        const sub = getSubstance(id);
        document.getElementById('substance-name').value = sub.name;
        document.getElementById('substance-icon').value = sub.icon;
        document.getElementById('substance-color').value = sub.color;
        document.getElementById('substance-default-unit').value = sub.defaultUnit;
        unitsInput.value = sub.units.join(', ');
        document.getElementById('substance-cost-tracking').checked = sub.costTrackingEnabled;
        document.getElementById('substance-taper-tracking').checked = sub.taperTrackingEnabled;
        iconPicker.querySelectorAll('.icon-pick-btn').forEach(b => {
            if (b.textContent === sub.icon) b.classList.add('selected');
        });
        colorPicker.querySelectorAll('.color-pick-btn').forEach(b => {
            if (b.dataset.color === sub.color) b.classList.add('selected');
        });
    } else {
        document.getElementById('substance-form').reset();
        document.getElementById('substance-icon').value = '📦';
        document.getElementById('substance-color').value = SUBSTANCE_COLORS[0];
        document.getElementById('substance-cost-tracking').checked = true;
        document.getElementById('substance-taper-tracking').checked = true;
        unitsInput.value = 'units';
        iconPicker.querySelector('.icon-pick-btn')?.classList.add('selected');
        colorPicker.querySelector('.color-pick-btn')?.classList.add('selected');
    }

    modal.classList.remove('hidden');
}

function closeSubstanceEditor() {
    document.getElementById('substance-editor-modal').classList.add('hidden');
    editingSubstanceId = null;
}

function handleSubstanceSubmit(e) {
    e.preventDefault();
    const name = document.getElementById('substance-name').value.trim();
    if (!name) return alert('Name is required.');

    const unitsRaw = document.getElementById('substance-units').value;
    const units = unitsRaw.split(',').map(u => u.trim()).filter(Boolean);
    if (units.length === 0) return alert('Add at least one unit.');

    const defaultUnit = document.getElementById('substance-default-unit').value.trim() || units[0];
    if (!units.includes(defaultUnit)) units.unshift(defaultUnit);

    const payload = {
        name,
        icon: document.getElementById('substance-icon').value || '📦',
        color: document.getElementById('substance-color').value || SUBSTANCE_COLORS[0],
        units,
        defaultUnit,
        costTrackingEnabled: document.getElementById('substance-cost-tracking').checked,
        taperTrackingEnabled: document.getElementById('substance-taper-tracking').checked,
        active: true
    };

    if (editingSubstanceId) {
        const idx = appData.substances.findIndex(s => s.id === editingSubstanceId);
        if (idx >= 0) {
            appData.substances[idx] = { ...appData.substances[idx], ...payload };
        }
    } else {
        const id = uniqueSubstanceId(name);
        appData.substances.push(createSubstance({ id, ...payload }));
        if (!appData.settings.substanceSettings[id]) {
            appData.settings.substanceSettings[id] = { packPrice: 10, unitsPerPack: 20, baseline: 5, quitGoal: '' };
        }
    }

    normalizeMainSubstances(appData);
    saveData(appData);
    closeSubstanceEditor();
    populateAllSubstanceDropdowns();
    renderSubstancesList();
    updateQuickActions();
    updateDashboardMainDisplay();
    updateDashboard();
    alert(editingSubstanceId ? 'Substance updated.' : 'Substance added.');
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
    document.getElementById(tabId).classList.add('active');
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
        renderTaperPlan();
        checkTaperTarget();
    } else if (tabId === 'settings-tab') {
        applyMainSubstanceToViewSelectors();
        renderSubstancesList();
        loadSubstanceSettings();
    }
    recordActivity();
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

function getCostPerUnit(substanceId) {
    const settings = getSubstanceSettings(substanceId);
    if (!settings.unitsPerPack) return 0;
    return settings.packPrice / settings.unitsPerPack;
}

function getUseLogsForSubstance(substanceId, { sortAsc = true } = {}) {
    let list = appData.logs.filter(l => l.substanceId === substanceId);
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

    const sub = getSubstance(entry.substanceId);
    let cost = parseFloat(entry.cost);
    if ((cost == null || isNaN(cost)) && sub?.costTrackingEnabled) {
        cost = amount * getCostPerUnit(entry.substanceId);
    }

    return {
        ...entry,
        type: entry.type || (entry.endTime ? 'session' : 'quick'),
        durationHours,
        useRate,
        timeBetweenHours,
        breakDurationHours,
        startDatetime,
        endDatetime,
        cost: cost || 0
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
    });
    ['use-amount', 'use-date'].forEach(id => {
        document.getElementById(id)?.addEventListener('input', updateUseTaperPreview);
    });
    document.getElementById('use-start-time')?.addEventListener('change', computeUseFormDuration);
    document.getElementById('use-end-time')?.addEventListener('change', computeUseFormDuration);
    document.getElementById('use-craving-level')?.addEventListener('input', e => {
        const el = document.getElementById('use-craving-level-value');
        if (el) el.textContent = e.target.value;
    });
    setUseLogType(document.getElementById('use-type')?.value || 'quick');
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
    const used = getUsedAmount(substanceId, today);
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
    const settings = getSubstanceSettings(substanceId);
    const costPerUnit = sub.costTrackingEnabled ? settings.packPrice / settings.unitsPerPack : 0;

    const log = {
        id: Date.now(),
        type: 'quick',
        substanceId,
        amount: 1,
        unit: sub.defaultUnit,
        cost: costPerUnit,
        date: now.toISOString().split('T')[0],
        startTime: now.toTimeString().slice(0, 5),
        time: now.toTimeString().slice(0, 5),
        trigger: '',
        cravingLevel: 0,
        location: '',
        notes: '',
        timestamp: now.toISOString()
    };

    snapshotBestStreakBeforeUse(substanceId);
    appData.logs.push(log);
    saveData(appData);
    updateDashboard();
    renderRecentUseList();
    updateTaperProgress();
    checkTaperTarget();
    notifyTaperAfterLog(substanceId);
    recordActivity();
    alert(`Logged 1 ${sub.defaultUnit} of ${sub.name}`);
}

function openUseLogSession() {
    switchTab('use-log-tab');
    setUseLogType('session');
    const id = getQuickLogSubstanceId();
    if (id) document.getElementById('use-substance').value = id;
    setDefaultUseLogDateTime();
    updateUseUnitDropdown();
    updateUseTaperPreview();
}

function undoLastUse() {
    if (!appData.logs.length) return alert('No use entries to undo');
    if (confirm('Undo last use entry?')) {
        appData.logs.pop();
        saveData(appData);
        updateDashboard();
        renderRecentUseList();
        renderUseHistoryTable();
        updateTaperProgress();
    }
}

function handleUseLogSubmit(e) {
    e.preventDefault();
    const type = document.getElementById('use-type').value || 'quick';
    const substanceId = document.getElementById('use-substance').value;
    const sub = getSubstance(substanceId);
    const amount = parseFloat(document.getElementById('use-amount').value);
    const unit = document.getElementById('use-unit').value;
    let cost = parseFloat(document.getElementById('use-cost').value);

    if (!confirmTaperBeforeLog(substanceId, amount, type === 'quick')) return;

    if (sub?.costTrackingEnabled && (!cost || cost === 0)) {
        const settings = getSubstanceSettings(substanceId);
        cost = (amount / settings.unitsPerPack) * settings.packPrice;
    } else if (!sub?.costTrackingEnabled) {
        cost = 0;
    }

    const date = document.getElementById('use-date').value;
    const startTime = document.getElementById('use-start-time').value;
    const endTime = document.getElementById('use-end-time').value;

    const entry = {
        id: Date.now(),
        type,
        substanceId,
        amount,
        unit,
        cost: cost || 0,
        date,
        startTime,
        time: startTime,
        endTime: type === 'session' ? endTime : '',
        count: parseFloat(document.getElementById('use-count').value) || 0,
        trigger: document.getElementById('use-trigger').value || '',
        cravingLevel: parseInt(document.getElementById('use-craving-level').value, 10) || 0,
        location: document.getElementById('use-location').value || '',
        notes: document.getElementById('use-notes').value || '',
        timestamp: new Date().toISOString()
    };

    snapshotBestStreakBeforeUse(substanceId);
    appData.logs.push(entry);
    saveData(appData);
    e.target.reset();
    setDefaultUseLogDateTime();
    setUseLogType('quick');
    applyMainSubstanceToForms();
    populateAllSubstanceDropdowns();
    updateDashboard();
    renderUseLogTab();
    updateTaperProgress();
    checkTaperTarget();
    notifyTaperAfterLog(substanceId);
    recordActivity();
    alert(type === 'session' ? 'Session saved!' : 'Use logged!');
}

function deleteUseEntry(id) {
    if (!confirm('Delete this entry?')) return;
    appData.logs = appData.logs.filter(l => l.id !== id);
    saveData(appData);
    renderUseLogTab();
    updateDashboard();
    checkTaperTarget();
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
    const cur = appData.settings.currency;
    recent.forEach(log => {
        const sub = getSubstance(log.substanceId);
        const enriched = enrichUseEntry(log, null);
        const typeLabel = log.type === 'session' ? '⏱️ Session' : '⚡ Quick';
        const item = document.createElement('div');
        item.className = 'list-item';
        item.innerHTML = `
            <div class="list-item-content">
                <strong>${typeLabel} ${sub?.icon || ''} ${log.amount} ${log.unit} ${sub?.name || ''}</strong><br>
                <small>${formatDate(log.date)} ${log.startTime || log.time}${log.endTime ? '–' + log.endTime : ''}</small>
                ${enriched.durationHours ? `<br><small>Duration: ${formatDurationHours(enriched.durationHours)}</small>` : ''}
            </div>
            <span>${log.cost ? cur + log.cost.toFixed(2) : '—'}</span>
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

    const cur = appData.settings.currency;
    let html = `<div class="session-table-scroll"><table class="session-table"><thead><tr>
        <th>Type</th><th>Date</th><th>Start</th><th>End</th><th>Duration</th><th>Amount</th><th>Unit</th>
        <th>Count</th><th>Rate</th><th>Since Prev</th><th>Break</th><th>Cost</th><th>Trigger</th><th>Notes</th><th></th>
    </tr></thead><tbody>`;

    allRows.forEach(({ entry, sub, avgRate }) => {
        const warnings = getUseRowWarnings(entry, sub.id, avgRate);
        const rateStr = entry.useRate != null ? `${entry.useRate.toFixed(2)}/${sub.defaultUnit}/hr` : '—';
        const typeLabel = entry.type === 'session' ? 'Session' : 'Quick';
        html += `<tr class="${warnings.join(' ')}">
            <td>${typeLabel}</td>
            <td>${formatDate(entry.date)}</td>
            <td>${entry.startTime || entry.time || '—'}</td>
            <td>${entry.endTime || '—'}</td>
            <td>${formatDurationHours(entry.durationHours)}</td>
            <td>${entry.amount}</td>
            <td>${entry.unit}</td>
            <td>${entry.count || '—'}</td>
            <td>${rateStr}</td>
            <td>${formatDurationHours(entry.timeBetweenHours)}</td>
            <td>${formatDurationHours(entry.breakDurationHours)}</td>
            <td>${entry.cost ? cur + entry.cost.toFixed(2) : '—'}</td>
            <td>${entry.trigger || '—'}</td>
            <td class="session-notes-cell">${entry.notes || ''}</td>
            <td><button class="delete-btn" onclick="deleteUseEntry(${entry.id})">×</button></td>
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
    document.getElementById('craving-modal').classList.remove('hidden');
    const sel = document.getElementById('craving-substance');
    if (sel && !isAllSubstancesView()) sel.value = currentSubstanceId;
}

function closeCravingModal() {
    document.getElementById('craving-modal').classList.add('hidden');
    document.getElementById('craving-form').reset();
    document.getElementById('craving-intensity').value = 5;
    document.getElementById('intensity-value').textContent = '5';
}

function handleCravingSubmit(e) {
    e.preventDefault();
    appData.cravings.push({
        id: Date.now(),
        substanceId: document.getElementById('craving-substance').value,
        intensity: parseInt(document.getElementById('craving-intensity').value, 10),
        trigger: document.getElementById('craving-trigger').value || '',
        whatHelped: document.getElementById('craving-helped').value || '',
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
        list = list.filter(p => p.substanceId === substanceId);
    }
    return list;
}

function setupBuyTrackerForm() {
    const form = document.getElementById('buy-form');
    if (!form) return;
    form.addEventListener('submit', handleBuySubmit);
    const now = new Date();
    const dateEl = document.getElementById('buy-date');
    const timeEl = document.getElementById('buy-time');
    if (dateEl) dateEl.value = now.toISOString().split('T')[0];
    if (timeEl) timeEl.value = now.toTimeString().slice(0, 5);
    ['buy-quantity', 'buy-total-cost'].forEach(id => {
        document.getElementById(id)?.addEventListener('input', updateBuyCostPerUnitPreview);
    });
    document.getElementById('buy-substance')?.addEventListener('change', updateBuyUnitDropdown);
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
    const quantity = parseFloat(document.getElementById('buy-quantity').value);
    const totalCost = parseFloat(document.getElementById('buy-total-cost').value);
    const purchase = {
        id: Date.now(),
        substanceId: document.getElementById('buy-substance').value,
        date: document.getElementById('buy-date').value,
        time: document.getElementById('buy-time').value,
        quantity,
        unit: document.getElementById('buy-unit').value,
        totalCost,
        costPerUnit: quantity > 0 ? totalCost / quantity : 0,
        store: document.getElementById('buy-store').value || '',
        paymentMethod: document.getElementById('buy-payment').value || '',
        notes: document.getElementById('buy-notes').value || ''
    };
    if (!appData.purchases) appData.purchases = [];
    appData.purchases.push(purchase);
    saveData(appData);
    e.target.reset();
    const now = new Date();
    document.getElementById('buy-date').value = now.toISOString().split('T')[0];
    document.getElementById('buy-time').value = now.toTimeString().slice(0, 5);
    applyMainSubstanceToForms();
    renderBuyTrackerTab();
    updateDashboard();
    alert('Purchase recorded!');
}

function openBuyTrackerModal() {
    switchTab('buy-tracker-tab');
    const id = getMainSubstanceId();
    if (id) document.getElementById('buy-substance').value = id;
    const now = new Date();
    document.getElementById('buy-date').value = now.toISOString().split('T')[0];
    document.getElementById('buy-time').value = now.toTimeString().slice(0, 5);
    updateBuyUnitDropdown();
}

function deletePurchase(id) {
    if (!confirm('Delete this purchase?')) return;
    appData.purchases = (appData.purchases || []).filter(p => p.id !== id);
    saveData(appData);
    renderBuyTrackerTab();
    updateDashboard();
}

function getBuyStats(substanceId) {
    const purchases = getPurchasesFiltered(substanceId);
    const today = new Date().toISOString().split('T')[0];
    const weekStart = getWeekStartDateStr(today);
    const monthStart = today.slice(0, 7) + '-01';
    const cur = appData.settings.currency;

    const spentToday = purchases.filter(p => p.date === today).reduce((s, p) => s + (p.totalCost || 0), 0);
    const spentWeek = purchases.filter(p => p.date >= weekStart).reduce((s, p) => s + (p.totalCost || 0), 0);
    const spentMonth = purchases.filter(p => p.date >= monthStart).reduce((s, p) => s + (p.totalCost || 0), 0);
    const countWeek = purchases.filter(p => p.date >= weekStart).length;
    const countMonth = purchases.filter(p => p.date >= monthStart).length;

    const withCpu = purchases.filter(p => p.costPerUnit > 0);
    const avgCostUnit = withCpu.length
        ? withCpu.reduce((s, p) => s + p.costPerUnit, 0) / withCpu.length
        : null;

    const sorted = [...purchases].sort((a, b) => new Date(`${b.date}T${b.time || '12:00'}`) - new Date(`${a.date}T${a.time || '12:00'}`));
    const lastPurchase = sorted[0] || null;

    let daysSupply = null;
    if (lastPurchase && substanceId && substanceId !== DASHBOARD_ALL) {
        const qtyPurchased = lastPurchase.quantity || 0;
        const usedSince = appData.logs
            .filter(l => l.substanceId === substanceId && l.date >= lastPurchase.date)
            .reduce((s, l) => s + (parseFloat(l.amount) || 0), 0);
        const dailyAvg = usedSince > 0
            ? usedSince / Math.max(1, Math.ceil((Date.now() - new Date(lastPurchase.date + 'T12:00:00')) / 86400000))
            : null;
        if (dailyAvg > 0 && qtyPurchased > usedSince) {
            daysSupply = Math.round((qtyPurchased - usedSince) / dailyAvg);
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
    const totals = days.map(day => purchases.filter(p => p.date === day).reduce((s, p) => s + (p.totalCost || 0), 0));
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
        const sub = getSubstance(stats.lastPurchase.substanceId);
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
        const sub = getSubstance(purchase.substanceId);
        const item = document.createElement('div');
        item.className = 'list-item';
        item.innerHTML = `
            <div><strong>${sub?.icon} ${sub?.name}</strong> — ${formatDate(purchase.date)} ${purchase.time || ''}<br>
            ${purchase.quantity} ${purchase.unit} · ${cur}${purchase.totalCost.toFixed(2)} (${cur}${(purchase.costPerUnit || 0).toFixed(2)}/unit)${purchase.store ? '<br><small>' + purchase.store + '</small>' : ''}</div>
            <button class="delete-btn" onclick="deletePurchase(${purchase.id})">Delete</button>
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
    document.getElementById('substance-form')?.addEventListener('submit', handleSubstanceSubmit);

    document.getElementById('craving-intensity')?.addEventListener('input', e => {
        const el = document.getElementById('intensity-value');
        if (el) el.textContent = e.target.value;
    });
    document.getElementById('use-substance')?.addEventListener('change', updateUseUnitDropdown);
    document.getElementById('settings-substance')?.addEventListener('change', () => {
        loadSubstanceSettings();
        updateSettingsSectionsVisibility();
    });
    document.getElementById('taper-substance')?.addEventListener('change', () => {
        renderTaperPlan();
        checkTaperTarget();
        updateTaperProgress();
    });

    document.addEventListener('click', recordActivity);
    document.addEventListener('keydown', recordActivity);
    document.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'hidden' && appData.privacy?.enabled) lockApp();
    });
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
        const sub = getSubstance(buyInfo.lastPurchase.substanceId);
        set('dash-last-purchase', `${formatDate(buyInfo.lastPurchase.date)} · ${sub?.name || ''}`);
    } else {
        set('dash-last-purchase', '—');
    }

    set('cravings-resisted', String(todayCravings.length));
    renderSubstanceCompare();
    updateQuickActions();
    updateDoNotSurpassDisplay('dashboard', isAllSubstancesView() ? null : currentSubstanceId);
    updateTaperProgress();
    updateDashboardMainDisplay();
}

function updateDashboardMainDisplay() {
    const el = document.getElementById('dashboard-main-substance');
    const main = getMainSubstance();
    if (!el) return;
    el.textContent = main ? `Main Substance: ${main.icon} ${main.name}` : 'Main Substance: —';
}

function computeAllMoneySaved(today) {
    return getActiveSubstances().reduce((total, sub) => {
        if (!sub.costTrackingEnabled) return total;
        const settings = getSubstanceSettings(sub.id);
        const amount = appData.logs.filter(l => l.date === today && l.substanceId === sub.id).reduce((s, l) => s + l.amount, 0);
        const cpu = settings.packPrice / settings.unitsPerPack;
        return total + (settings.baseline * cpu - amount * cpu);
    }, 0);
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
        const spent = logs.reduce((s, l) => s + (l.cost || 0), 0);
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
            document.getElementById('dashboard-substance').value = sub.id;
            updateDashboard();
        };
        grid.appendChild(card);
    });

    container.appendChild(grid);
}

function updateAvgTimeBetween(todayLogs) {
    const el = document.getElementById('avg-time-between');
    if (todayLogs.length < 2) { el.textContent = '--'; return; }
    const sorted = [...todayLogs].sort((a, b) => new Date(`${a.date}T${a.time}`) - new Date(`${b.date}T${b.time}`));
    let total = 0;
    for (let i = 1; i < sorted.length; i++) {
        total += new Date(`${sorted[i].date}T${sorted[i].time}`) - new Date(`${sorted[i - 1].date}T${sorted[i - 1].time}`);
    }
    const mins = Math.floor(total / (sorted.length - 1) / 60000);
    const hrs = Math.floor(mins / 60);
    el.textContent = hrs > 0 ? `${hrs}h ${mins % 60}m` : `${mins}m`;
}

function updateLongestStreakToday(todayLogs) {
    const el = document.getElementById('longest-streak-today');
    if (todayLogs.length < 2) { el.textContent = '--'; return; }
    const sorted = [...todayLogs].sort((a, b) => new Date(`${a.date}T${a.time}`) - new Date(`${b.date}T${b.time}`));
    let max = 0;
    for (let i = 1; i < sorted.length; i++) {
        max = Math.max(max, new Date(`${sorted[i].date}T${sorted[i].time}`) - new Date(`${sorted[i - 1].date}T${sorted[i - 1].time}`));
    }
    const mins = Math.floor(max / 60000);
    const hrs = Math.floor(mins / 60);
    el.textContent = hrs > 0 ? `${hrs}h ${mins % 60}m` : `${mins}m`;
}

function updateMoneySaved(todayAmount, settings) {
    const cpu = settings.packPrice / settings.unitsPerPack;
    const saved = (settings.baseline || 0) * cpu - todayAmount * cpu;
    document.getElementById('money-saved').textContent = `${appData.settings.currency}${saved.toFixed(2)}`;
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
    const settings = getSubstanceSettings(currentSubstanceId);
    const today = new Date();

    renderUsageChart();
    renderSpendingChart();

    const weekStart = new Date(today);
    weekStart.setDate(today.getDate() - today.getDay());
    const monthStart = new Date(today.getFullYear(), today.getMonth(), 1);

    const totalWeek = substanceLogs.filter(l => new Date(l.date) >= weekStart).reduce((s, l) => s + l.amount, 0);
    const totalMonth = substanceLogs.filter(l => new Date(l.date) >= monthStart).reduce((s, l) => s + l.amount, 0);
    const daysWithData = new Set(substanceLogs.map(l => l.date)).size;
    const avgPerDay = daysWithData ? (substanceLogs.reduce((s, l) => s + l.amount, 0) / daysWithData).toFixed(1) : 0;

    document.getElementById('total-week').textContent = `${totalWeek} ${sub?.defaultUnit || 'units'}`;
    document.getElementById('total-month').textContent = `${totalMonth} ${sub?.defaultUnit || 'units'}`;
    document.getElementById('avg-per-day').textContent = avgPerDay;

    updateLongestTimeBetween();
    const totalSpent = substanceLogs.reduce((s, l) => s + (l.cost || 0), 0);
    document.getElementById('total-spent').textContent = `${appData.settings.currency}${totalSpent.toFixed(2)}`;

    const cpu = settings.packPrice / settings.unitsPerPack;
    const estimatedSaved = substanceLogs.length * (settings.baseline || 0) * cpu - totalSpent;
    document.getElementById('estimated-saved').textContent = `${appData.settings.currency}${estimatedSaved.toFixed(2)}`;
    document.getElementById('cost-per-week').textContent = `${appData.settings.currency}${(avgPerDay * 7 * cpu).toFixed(2)}`;
    document.getElementById('cost-per-month').textContent = `${appData.settings.currency}${(avgPerDay * 30 * cpu).toFixed(2)}`;
    document.getElementById('reduction-baseline').textContent = settings.baseline > 0 ? `${((1 - avgPerDay / settings.baseline) * 100).toFixed(0)}%` : '0%';

    updateRecoveryStreakDisplay(currentSubstanceId);
    renderTriggerBreakdown();
    renderTaperProgressStats(currentSubstanceId);
    document.getElementById('stats-cravings-count').textContent = appData.cravings.filter(c => c.substanceId === currentSubstanceId).length;
}

function renderSubstanceStatsBreakdown() {
    const container = document.getElementById('stats-by-substance');
    if (!container) return;
    container.innerHTML = '';

    getActiveSubstances().forEach(sub => {
        const logs = appData.logs.filter(l => l.substanceId === sub.id);
        const cravings = appData.cravings.filter(c => c.substanceId === sub.id);
        const spent = logs.reduce((s, l) => s + (l.cost || 0), 0);
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
    el.textContent = `${pct}% (${plan.currentAvg} → ${plan.goalAvg})`;
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
        const cost = appData.logs.filter(l => l.date === dateStr && l.substanceId === currentSubstanceId).reduce((s, l) => s + (l.cost || 0), 0);
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
    appData.logs.filter(l => l.substanceId === currentSubstanceId && l.trigger).forEach(l => {
        counts[l.trigger] = (counts[l.trigger] || 0) + 1;
    });
    const sorted = Object.entries(counts).sort((a, b) => b[1] - a[1]).slice(0, 6);
    if (!sorted.length) {
        container.innerHTML = '<p class="empty-hint">Log triggers to see patterns</p>';
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

function getDailyLimitForDate(substanceId, dateStr) {
    const plan = appData.taperPlans[substanceId];
    if (!plan?.dailyTargets) return null;
    const day = plan.dailyTargets.find(d => d.date === dateStr);
    return day != null ? day.target : null;
}

function getUsedAmount(substanceId, dateStr) {
    return appData.logs
        .filter(l => l.date === dateStr && l.substanceId === substanceId)
        .reduce((s, l) => s + (l.amount || 0), 0);
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
        .filter(l => l.substanceId === substanceId && inWeek(l.date))
        .reduce((s, l) => s + (l.amount || 0), 0);
}

function getWeeklyLimit(substanceId, dateStr) {
    const plan = appData.taperPlans[substanceId];
    if (!plan) return null;
    if (plan.weeklyMax != null && plan.weeklyMax > 0) return plan.weeklyMax;

    const weekStart = new Date(getWeekStartDateStr(dateStr) + 'T12:00:00');
    let sum = 0;
    let hasTarget = false;
    for (let i = 0; i < 7; i++) {
        const d = new Date(weekStart);
        d.setDate(weekStart.getDate() + i);
        const ds = d.toISOString().split('T')[0];
        const limit = getDailyLimitForDate(substanceId, ds);
        if (limit != null) {
            sum += limit;
            hasTarget = true;
        }
    }
    return hasTarget ? sum : null;
}

function getTaperLimitStatus(used, limit) {
    if (limit == null || limit <= 0) {
        return { status: 'none', label: 'No limit set', emoji: '—' };
    }
    if (used > limit) {
        return { status: 'over', label: 'Over limit', emoji: '🚫' };
    }
    if (used >= limit * 0.8) {
        return { status: 'close', label: 'Close to limit', emoji: '⚠️' };
    }
    return { status: 'under', label: 'Under limit', emoji: '✅' };
}

function computeUnderTargetStreak(substanceId) {
    const plan = appData.taperPlans[substanceId];
    if (!plan) return 0;

    let streak = 0;
    const check = new Date();
    for (let i = 0; i < 365; i++) {
        const dateStr = check.toISOString().split('T')[0];
        const limit = getDailyLimitForDate(substanceId, dateStr);
        if (limit == null) {
            if (i === 0) {
                check.setDate(check.getDate() - 1);
                continue;
            }
            break;
        }
        const used = getUsedAmount(substanceId, dateStr);
        if (used > limit) break;
        streak++;
        check.setDate(check.getDate() - 1);
    }
    return streak;
}

function getTaperDayStatus(substanceId, dateStr) {
    const limit = getDailyLimitForDate(substanceId, dateStr);
    if (limit == null) return null;
    const used = getUsedAmount(substanceId, dateStr);
    return getTaperLimitStatus(used, limit).status;
}

function confirmTaperBeforeLog(substanceId, amount, isQuickLog) {
    const sub = getSubstance(substanceId);
    if (!sub?.taperTrackingEnabled) return true;

    const today = new Date().toISOString().split('T')[0];
    const limit = getDailyLimitForDate(substanceId, today);
    if (limit == null) return true;

    const used = getUsedAmount(substanceId, today);
    if (used + amount <= limit) return true;

    const plan = appData.taperPlans[substanceId];
    const unit = sub.defaultUnit;

    if (isQuickLog && plan?.blockQuickLogOverLimit) {
        alert(`Daily limit is ${limit} ${unit}. You've used ${used}. Quick log is blocked to help you stay within your taper plan.`);
        return false;
    }

    return confirm(`You're about to surpass today's taper limit (${used}/${limit} ${unit} used). Log anyway?`);
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
        alert(`⚠️ Close to limit: ${used}/${limit} ${unit} used today. ${Math.max(0, limit - used).toFixed(1)} remaining.`);
    } else if (status === 'over') {
        alert(`🚫 Over today's taper limit (${used}/${limit} ${unit}).\n\n${TAPER_RELAPSE_NOTE}`);
    }
}

function updateDoNotSurpassDisplay(prefix, substanceId) {
    const section = document.getElementById(prefix === 'dashboard' ? 'dns-section' : 'today-target');
    if (!substanceId) {
        section?.classList.add('hidden');
        return;
    }

    const sub = getSubstance(substanceId);
    const plan = appData.taperPlans[substanceId];
    if (!sub?.taperTrackingEnabled || !plan) {
        section?.classList.add('hidden');
        return;
    }

    const today = new Date().toISOString().split('T')[0];
    const limit = getDailyLimitForDate(substanceId, today);
    if (limit == null) {
        section?.classList.add('hidden');
        return;
    }

    section?.classList.remove('hidden');

    const used = getUsedAmount(substanceId, today);
    const remaining = Math.max(0, limit - used);
    const { status, label, emoji } = getTaperLimitStatus(used, limit);
    const unit = sub.defaultUnit;
    const weeklyUsed = getWeeklyUsed(substanceId, today);
    const weeklyLimit = getWeeklyLimit(substanceId, today);
    const streak = computeUnderTargetStreak(substanceId);

    const set = (id, text) => {
        const el = document.getElementById(id);
        if (el) el.textContent = text;
    };

    set(`${prefix}-dns-limit`, `${limit} ${unit}`);
    set(`${prefix}-dns-used`, `${used} ${unit}`);
    set(`${prefix}-dns-remaining`, `${remaining.toFixed(1)} ${unit}`);
    set(`${prefix}-dns-used-max`, `${used} / ${limit} ${unit}`);

    const bar = document.getElementById(`${prefix}-dns-bar`);
    const barText = document.getElementById(`${prefix}-dns-bar-text`);
    const pct = Math.min(100, limit > 0 ? (used / limit) * 100 : 0);
    if (bar) {
        bar.style.width = `${Math.max(pct, used > 0 ? 4 : 0)}%`;
        bar.classList.remove('dns-under', 'dns-close', 'dns-over');
        bar.classList.add(`dns-${status}`);
    }
    if (barText) barText.textContent = `${Math.round(pct)}%`;

    const statusEl = document.getElementById(`${prefix}-dns-status`);
    if (statusEl) {
        statusEl.textContent = `${emoji} ${label}`;
        statusEl.className = `dns-status dns-status-${status}`;
    }

    const weeklyEl = document.getElementById(`${prefix}-dns-weekly`);
    if (weeklyEl && weeklyLimit != null) {
        weeklyEl.textContent = `Weekly: ${weeklyUsed} / ${weeklyLimit} ${unit}`;
    }

    const streakEl = document.getElementById(`${prefix}-dns-streak`);
    if (streakEl) {
        streakEl.textContent = `Days under target: ${streak}`;
    }

    const warnEl = document.getElementById(`${prefix}-dns-warning`);
    if (warnEl) {
        if (status === 'close') {
            warnEl.textContent = `⚠️ You're at ${Math.round(pct)}% of today's limit. Only ${remaining.toFixed(1)} ${unit} left.`;
            warnEl.classList.remove('hidden');
        } else {
            warnEl.classList.add('hidden');
        }
    }

    const relapseEl = document.getElementById(`${prefix}-dns-relapse`);
    if (relapseEl) {
        if (status === 'over') {
            relapseEl.textContent = TAPER_RELAPSE_NOTE;
            relapseEl.classList.remove('hidden');
        } else {
            relapseEl.classList.add('hidden');
        }
    }

    if (prefix === 'taper') {
        set('today-target-value', `${limit} ${unit} max`);
        const legacyStatus = document.getElementById('today-target-status');
        if (legacyStatus) {
            legacyStatus.textContent = `${used} / ${limit} ${unit} · ${emoji} ${label}`;
            legacyStatus.style.color = status === 'over' ? 'var(--danger)' : status === 'close' ? 'var(--warning)' : 'var(--accent)';
        }
        const notesDisplay = document.getElementById('taper-notes-display');
        if (notesDisplay) {
            if (plan.taperNotes) {
                notesDisplay.textContent = plan.taperNotes;
                notesDisplay.classList.remove('hidden');
            } else {
                notesDisplay.classList.add('hidden');
            }
        }
        loadTaperPlanSettingsForm(substanceId);
    }
}

function loadTaperPlanSettingsForm(substanceId) {
    const plan = appData.taperPlans[substanceId];
    if (!plan) return;
    const weekly = document.getElementById('edit-weekly-max');
    const notes = document.getElementById('edit-taper-notes');
    const block = document.getElementById('edit-block-quick-log');
    if (weekly) weekly.value = plan.weeklyMax ?? '';
    if (notes) notes.value = plan.taperNotes || '';
    if (block) block.checked = !!plan.blockQuickLogOverLimit;
}

function saveTaperPlanSettings() {
    const substanceId = getTaperSubstanceId();
    const plan = appData.taperPlans[substanceId];
    if (!plan) return;

    const weeklyVal = document.getElementById('edit-weekly-max')?.value;
    plan.weeklyMax = weeklyVal ? parseFloat(weeklyVal) : null;
    plan.taperNotes = document.getElementById('edit-taper-notes')?.value || '';
    plan.blockQuickLogOverLimit = !!document.getElementById('edit-block-quick-log')?.checked;
    saveData(appData);
    updateDoNotSurpassDisplay('taper', substanceId);
    if (!isAllSubstancesView() && currentSubstanceId === substanceId) {
        updateDoNotSurpassDisplay('dashboard', substanceId);
    }
}

function handleTaperSubmit(e) {
    e.preventDefault();
    const substanceId = document.getElementById('taper-substance').value;
    const sub = getSubstance(substanceId);
    if (!sub?.taperTrackingEnabled) return alert('Taper tracking is disabled for this substance.');

    const currentAvg = parseFloat(document.getElementById('current-avg').value);
    const goalAvg = parseFloat(document.getElementById('goal-avg').value);
    const endDate = document.getElementById('end-date').value;
    const startDate = new Date().toISOString().split('T')[0];
    const daysDiff = Math.ceil((new Date(endDate) - new Date(startDate)) / 86400000);
    if (daysDiff <= 0) return alert('End date must be in the future');

    const decrement = (currentAvg - goalAvg) / daysDiff;
    const dailyTargets = [];
    for (let i = 0; i <= daysDiff; i++) {
        const date = new Date(startDate);
        date.setDate(date.getDate() + i);
        dailyTargets.push({
            date: date.toISOString().split('T')[0],
            target: Math.round(Math.max(goalAvg, currentAvg - decrement * i) * 2) / 2
        });
    }

    const weeklyMaxInput = document.getElementById('weekly-max').value;
    const weeklyMax = weeklyMaxInput ? parseFloat(weeklyMaxInput) : null;
    const taperNotes = document.getElementById('taper-notes').value || '';
    const blockQuickLogOverLimit = !!document.getElementById('block-quick-log-over-limit').checked;

    appData.taperPlans[substanceId] = {
        startDate,
        endDate,
        currentAvg,
        goalAvg,
        dailyTargets,
        weeklyMax,
        taperNotes,
        blockQuickLogOverLimit
    };
    saveData(appData);
    renderTaperPlan();
    checkTaperTarget();
    updateTaperProgress();
    if (!isAllSubstancesView() && currentSubstanceId === substanceId) {
        updateDoNotSurpassDisplay('dashboard', substanceId);
    }
    alert('Taper plan generated!');
}

function getTaperSubstanceId() {
    return document.getElementById('taper-substance')?.value || currentSubstanceId;
}

function renderTaperPlan() {
    const substanceId = getTaperSubstanceId();
    const sub = getSubstance(substanceId);
    const plan = appData.taperPlans[substanceId];
    const setup = document.getElementById('taper-setup');
    const panel = document.getElementById('taper-plan');
    const noTaper = document.getElementById('taper-disabled-msg');

    if (!sub?.taperTrackingEnabled) {
        setup?.classList.add('hidden');
        panel?.classList.add('hidden');
        noTaper?.classList.remove('hidden');
        return;
    }
    noTaper?.classList.add('hidden');

    if (!plan) {
        panel?.classList.add('hidden');
        setup?.classList.remove('hidden');
        document.getElementById('today-target')?.classList.add('hidden');
        return;
    }
    setup?.classList.add('hidden');
    panel?.classList.remove('hidden');

    const container = document.getElementById('taper-days-list');
    container.innerHTML = '';
    const today = new Date().toISOString().split('T')[0];
    plan.dailyTargets.forEach(day => {
        const item = document.createElement('div');
        const dayStatus = getTaperDayStatus(substanceId, day.date);
        item.className = `taper-day-item ${day.date === today ? 'today' : ''}${dayStatus ? ` taper-day-${dayStatus}` : ''}`;
        const used = getUsedAmount(substanceId, day.date);
        item.innerHTML = `<span>${formatDate(day.date)}</span><strong>${used}/${day.target} ${sub.defaultUnit}</strong>`;
        container.appendChild(item);
    });

    loadTaperPlanSettingsForm(substanceId);
}

function resetTaper() {
    const id = getTaperSubstanceId();
    if (confirm('Reset taper plan?')) {
        delete appData.taperPlans[id];
        saveData(appData);
        renderTaperPlan();
        document.getElementById('today-target').classList.add('hidden');
        document.getElementById('dns-section')?.classList.add('hidden');
        updateTaperProgress();
    }
}

function checkTaperTarget() {
    const substanceId = getTaperSubstanceId();
    updateDoNotSurpassDisplay('taper', substanceId);
}

function updateTaperProgress() {
    const substanceId = isAllSubstancesView() ? getTaperSubstanceId() : currentSubstanceId;
    const sub = getSubstance(substanceId);
    const plan = appData.taperPlans[substanceId];
    const bar = document.getElementById('taper-progress');
    if (!plan || !sub?.taperTrackingEnabled) {
        bar.style.width = '0%';
        document.getElementById('progress-text').textContent = '0%';
        document.getElementById('progress-label').textContent = 'No taper goal set';
        return;
    }
    const start = new Date(plan.startDate);
    const end = new Date(plan.endDate);
    const pct = Math.min(100, Math.max(0, ((Date.now() - start) / (end - start)) * 100));
    bar.style.width = `${pct}%`;
    document.getElementById('progress-text').textContent = `${Math.round(pct)}%`;
    document.getElementById('progress-label').textContent = `${sub.icon} ${sub.name}: ${plan.currentAvg} → ${plan.goalAvg} ${sub.defaultUnit}/day`;
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
    document.getElementById('calendar-month').textContent = currentCalendarDate.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });

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
            if (dayStatus && dayStatus !== 'none') {
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

    let html = `<p><strong>${formatDate(dateStr)}</strong></p><p>Total uses: ${dayLogs.reduce((s, l) => s + l.amount, 0)}</p><p>Cost: ${appData.settings.currency}${dayLogs.reduce((s, l) => s + (l.cost || 0), 0).toFixed(2)}</p><p>Cravings: ${dayCravings.length}</p>`;

    if (limit != null && sub) {
        const { emoji, label } = getTaperLimitStatus(used, limit);
        html += `<p>Taper (${sub.name}): ${used}/${limit} ${sub.defaultUnit} · ${emoji} ${label}</p>`;
    }
    dayLogs.forEach(log => {
        const sub = getSubstance(log.substanceId);
        html += `<div class="list-item"><div>${sub?.icon} ${log.amount} ${log.unit} ${sub?.name} at ${log.time}</div></div>`;
    });
    dayCravings.forEach(c => {
        const sub = getSubstance(c.substanceId);
        html += `<div class="list-item"><div>${sub?.icon} Craving ${c.intensity}/10</div></div>`;
    });
    container.innerHTML = html;
}

// ——— Settings ———
function loadSettings() {
    document.getElementById('currency').value = appData.settings.currency;
    document.getElementById('reminder-message').value = appData.settings.reminderMessage;
    const openMainEl = document.getElementById('open-on-main-substance');
    if (openMainEl) openMainEl.checked = appData.settings.openOnMainSubstance !== false;
    loadSubstanceSettings();
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

function loadSubstanceSettings() {
    const id = document.getElementById('settings-substance')?.value || currentSubstanceId;
    if (id === DASHBOARD_ALL) return;
    const settings = getSubstanceSettings(id);
    const priceEl = document.getElementById('settings-unit-price');
    const unitsEl = document.getElementById('settings-units-per-purchase');
    const baselineEl = document.getElementById('baseline-cigs');
    const quitEl = document.getElementById('quit-goal');
    if (priceEl) priceEl.value = settings.packPrice;
    if (unitsEl) unitsEl.value = settings.unitsPerPack;
    if (baselineEl) baselineEl.value = settings.baseline;
    if (quitEl) quitEl.value = settings.quitGoal;
    updateSettingsSectionsVisibility();
}

function saveSettings() {
    appData.settings.currency = document.getElementById('currency').value || '$';
    appData.settings.reminderMessage = document.getElementById('reminder-message').value;
    const id = document.getElementById('settings-substance')?.value;
    if (id && id !== DASHBOARD_ALL) {
        if (!appData.settings.substanceSettings[id]) appData.settings.substanceSettings[id] = {};
        appData.settings.substanceSettings[id].packPrice = parseFloat(document.getElementById('settings-unit-price')?.value) || 10;
        appData.settings.substanceSettings[id].unitsPerPack = parseInt(document.getElementById('settings-units-per-purchase')?.value, 10) || 20;
        appData.settings.substanceSettings[id].baseline = parseFloat(document.getElementById('baseline-cigs')?.value) || 20;
        appData.settings.substanceSettings[id].quitGoal = document.getElementById('quit-goal')?.value || '';
    }
    saveData(appData);
    updateDashboard();
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
    appData.supportContacts.push({ id: Date.now(), name: document.getElementById('contact-name').value, phone: document.getElementById('contact-phone').value });
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
    const reason = document.getElementById('reason').value.trim();
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

function exportData() {
    const blob = new Blob([JSON.stringify(appData, null, 2)], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `recovery-tracker-backup-${new Date().toISOString().split('T')[0]}.json`;
    a.click();
    URL.revokeObjectURL(a.href);
}

// ——— Privacy lock ———
function setupPrivacyLock() {
    const screen = document.getElementById('privacy-lock-screen');
    if (!screen) return;
    screen.querySelectorAll('[data-digit]').forEach(btn => btn.addEventListener('click', () => appendPinDigit(btn.dataset.digit)));
    screen.querySelectorAll('[data-action]').forEach(btn => {
        btn.addEventListener('click', () => {
            if (btn.dataset.action === 'clear') clearPinEntry();
            if (btn.dataset.action === 'back') { pinEntry = pinEntry.slice(0, -1); updatePinDots(); }
            if (pinEntry.length >= 4) tryUnlockPin();
        });
    });
    loadPrivacySettingsUI();
    resetAutoLockTimer();
}

function loadPrivacySettingsUI() {
    const enabled = document.getElementById('privacy-lock-enabled');
    const setup = document.getElementById('privacy-pin-setup');
    const autoLock = document.getElementById('auto-lock-minutes');
    if (!enabled || !appData.privacy) return;
    enabled.checked = !!appData.privacy.enabled;
    setup?.classList.toggle('hidden', !appData.privacy.enabled);
    if (autoLock) autoLock.value = appData.privacy.autoLockMinutes ?? 5;
}

function togglePrivacyLockSetting() {
    const enabled = document.getElementById('privacy-lock-enabled').checked;
    appData.privacy.enabled = enabled;
    document.getElementById('privacy-pin-setup')?.classList.toggle('hidden', !enabled);
    if (enabled && !appData.privacy.pinHash) {
        alert('Set a PIN before enabling the lock.');
        appData.privacy.enabled = false;
        document.getElementById('privacy-lock-enabled').checked = false;
        return;
    }
    saveData(appData);
    if (enabled) lockApp();
    else { isUnlocked = true; hideLockScreen(); }
}

function savePrivacyPin() {
    const pin = document.getElementById('privacy-pin-new').value.trim();
    const confirmPin = document.getElementById('privacy-pin-confirm').value.trim();
    if (!/^\d{4,6}$/.test(pin)) return alert('PIN must be 4–6 digits.');
    if (pin !== confirmPin) return alert('PINs do not match.');
    appData.privacy.pinHash = hashPin(pin);
    appData.privacy.enabled = true;
    document.getElementById('privacy-lock-enabled').checked = true;
    saveData(appData);
    document.getElementById('privacy-pin-new').value = '';
    document.getElementById('privacy-pin-confirm').value = '';
    lockApp();
}

function changePrivacyPin() {
    const current = prompt('Enter your current PIN:');
    if (!current || hashPin(current) !== appData.privacy.pinHash) return alert('Incorrect PIN.');
    alert('Enter and confirm your new PIN below, then tap Save PIN.');
}

function savePrivacySettings() {
    appData.privacy.autoLockMinutes = parseInt(document.getElementById('auto-lock-minutes').value, 10) || 0;
    saveData(appData);
    resetAutoLockTimer();
}

function lockAppNow() {
    if (!appData.privacy?.enabled) return alert('Enable privacy lock first.');
    lockApp();
}

function lockApp() {
    if (!appData.privacy?.enabled) return;
    isUnlocked = false;
    clearPinEntry();
    document.getElementById('privacy-lock-screen')?.classList.remove('hidden');
    document.body.classList.add('locked');
}

function hideLockScreen() {
    document.getElementById('privacy-lock-screen')?.classList.add('hidden');
    document.body.classList.remove('locked');
    clearPinEntry();
    isUnlocked = true;
    lastActivityAt = Date.now();
    resetAutoLockTimer();
}

function appendPinDigit(digit) {
    if (pinEntry.length >= 6) return;
    pinEntry += digit;
    updatePinDots();
    if (pinEntry.length >= 4) tryUnlockPin();
}

function clearPinEntry() {
    pinEntry = '';
    updatePinDots();
    document.getElementById('pin-error')?.classList.add('hidden');
}

function updatePinDots() {
    document.querySelectorAll('#pin-dots span').forEach((dot, i) => dot.classList.toggle('filled', i < pinEntry.length));
}

function tryUnlockPin() {
    if (hashPin(pinEntry) === appData.privacy.pinHash) hideLockScreen();
    else if (pinEntry.length >= 6) {
        const err = document.getElementById('pin-error');
        if (err) { err.textContent = 'Incorrect PIN.'; err.classList.remove('hidden'); }
        clearPinEntry();
    }
}

function recordActivity() {
    if (!isUnlocked || !appData.privacy?.enabled) return;
    lastActivityAt = Date.now();
    resetAutoLockTimer();
}

function resetAutoLockTimer() {
    if (autoLockTimer) clearTimeout(autoLockTimer);
    const minutes = appData.privacy?.autoLockMinutes ?? 0;
    if (!appData.privacy?.enabled || minutes <= 0 || !isUnlocked) return;
    autoLockTimer = setTimeout(() => {
        if (Date.now() - lastActivityAt >= minutes * 60000) lockApp();
    }, minutes * 60000);
}

function clearAllData() {
    if (!confirm('Clear ALL data? This cannot be undone.')) return;
    if (!confirm('Delete all logs, substances, and settings?')) return;
    localStorage.removeItem(STORAGE_KEY);
    appData = JSON.parse(JSON.stringify(defaultData));
    appData.substances = getDefaultSubstances();
    currentSubstanceId = resolveStartupSubstanceId();
    loadSettings();
    populateAllSubstanceDropdowns();
    updateDashboard();
    renderRecentUseList();
    renderCalendar();
    renderTaperPlan();
    renderSubstancesList();
    loadPrivacySettingsUI();
    isUnlocked = true;
    hideLockScreen();
    alert('All data cleared.');
}

// Legacy global aliases
function logOneCigarette() { logOneUse(); }
