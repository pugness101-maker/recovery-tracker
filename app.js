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
const expandedPurchaseIds = new Set();
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

function migrateUseLogsToLogs(data) {
    const legacy = data.useLogs;
    if (!Array.isArray(legacy) || !legacy.length) {
        delete data.useLogs;
        return;
    }
    data.logs = [...(data.logs || [])];
    const seen = new Set(data.logs.map(l => l.id));
    legacy.forEach(l => {
        if (l?.id != null && seen.has(l.id)) {
            const idx = data.logs.findIndex(x => x.id === l.id);
            if (idx >= 0) data.logs[idx] = l;
        } else if (l?.id != null) {
            data.logs.push(l);
            seen.add(l.id);
        } else {
            data.logs.push(l);
        }
    });
    delete data.useLogs;
}

function normalizeAppData(data) {
    normalizeLegacyRefs(data);
    migrateUseLogsToLogs(data);
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
        if (!log.transactionType) log.transactionType = 'use';
        const resolvedSubstanceId = normalizeSubstanceRef(getUseSubstanceId(log), data);
        if (resolvedSubstanceId) log.substanceId = resolvedSubstanceId;
        if (!Array.isArray(log.linkedPurchases)) log.linkedPurchases = [];
        if (log.inventoryAffects === undefined) {
            log.inventoryAffects = !!(log.linkedPurchaseId != null && log.linkedPurchaseId !== ''
                || log.linkedPurchases.length);
        }
        if (hasLinkedSupply(log) && log.inventoryAffects === false) {
            log.inventoryAffects = true;
        }
        if (!log.inventoryAffects && !hasLinkedSupply(log)) {
            log.linkedPurchaseId = null;
            log.linkedPurchases = [];
            log.supplyUnlinked = true;
        }
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
        migrateTaperPlan(plan, substanceId, data);
    });
    recalculateAllBreaksForData(data);
    recalculateAllBuyBreaksForData(data);
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
    ensureTableColumnSettings(data);
    ensureCollapsedSections(data);
}

const DEFAULT_COLLAPSED_SECTIONS = {
    useLogForm: false,
    recentUse: false,
    bulkActions: true,
    useHistory: false,
    purchaseForm: false,
    purchaseHistory: false,
    buySpendingTrend: true,
    buyMetrics: true,
    statsDateRange: false,
    statsUsageChart: true,
    statsUseStats: false,
    statsBreakMetrics: true,
    statsBuyMetrics: true,
    taperTodayStatus: false,
    taperReductionPlan: true,
    taperWeeklyPlan: false,
    taperCalendarPreview: true,
    taperInsights: true,
    settingsSubstances: false,
    settingsMainSubstance: true,
    settingsPreferences: true,
    settingsBackup: true
};

function ensureCollapsedSections(data) {
    if (!data.settings) data.settings = {};
    if (!data.settings.collapsedSections) {
        data.settings.collapsedSections = { ...DEFAULT_COLLAPSED_SECTIONS };
        return;
    }
    const stored = data.settings.collapsedSections;
    Object.keys(DEFAULT_COLLAPSED_SECTIONS).forEach(key => {
        if (stored[key] === undefined) stored[key] = DEFAULT_COLLAPSED_SECTIONS[key];
    });
    if (stored.statsCharts !== undefined && stored.statsUsageChart === undefined) {
        stored.statsUsageChart = stored.statsCharts;
    }
}

function toggleSection(sectionKey) {
    ensureCollapsedSections(appData);
    const current = !!appData.settings.collapsedSections[sectionKey];
    appData.settings.collapsedSections[sectionKey] = !current;
    saveData(appData);
    applyCollapsedSections();
    if (sectionKey === 'purchaseHistory') {
        renderPurchaseHistory();
    }
}

function applyCollapsedSections() {
    ensureCollapsedSections(appData);
    const collapsed = appData.settings?.collapsedSections || {};

    document.querySelectorAll('.collapsible-section').forEach(section => {
        const key = section.dataset.section;
        if (!key) return;
        const isCollapsed = !!collapsed[key];

        section.classList.toggle('collapsed', isCollapsed);
        const content = section.querySelector('.section-content');
        const chevron = section.querySelector('.chevron');

        if (content) {
            content.hidden = isCollapsed;
            content.style.display = isCollapsed ? 'none' : 'block';
        }
        if (chevron) chevron.textContent = isCollapsed ? '›' : '⌄';
    });
}

const TABLE_COLUMN_DEFAULTS = {
    useHistory: {
        order: ['select', 'date', 'start', 'end', 'duration', 'amount', 'unit', 'count', 'rate', 'break', 'supply', 'notes', 'actions'],
        hidden: []
    },
    purchaseHistory: {
        order: ['date', 'time', 'substance', 'bought', 'remaining', 'usedPct', 'supplyDuration', 'sinceLastUse', 'supply', 'cost', 'store', 'break', 'actions'],
        hidden: []
    }
};

const TABLE_COLUMN_LABELS = {
    useHistory: {
        select: 'Select',
        date: 'Date',
        start: 'Start',
        end: 'End',
        duration: 'Duration',
        amount: 'Amount',
        unit: 'Unit',
        count: 'Count',
        rate: 'Rate',
        break: 'Break Since Previous',
        supply: 'Supply',
        notes: 'Notes',
        actions: 'Actions'
    },
    purchaseHistory: {
        date: 'Date',
        time: 'Time',
        substance: 'Substance',
        bought: 'Bought',
        remaining: 'Remaining',
        usedPct: 'Used %',
        supplyDuration: 'Supply Duration',
        sinceLastUse: 'Since Last Use',
        supply: 'Supply',
        cost: 'Cost',
        store: 'Store',
        break: 'Break Since Previous Buy',
        actions: 'Actions'
    }
};

const TABLE_COLUMNS_REQUIRED = {
    useHistory: ['select', 'actions'],
    purchaseHistory: ['actions']
};

let columnSettingsTableKey = null;

function ensureTableColumnSettings(data) {
    if (!data.settings) data.settings = {};
    if (!data.settings.tableColumns) {
        data.settings.tableColumns = JSON.parse(JSON.stringify(TABLE_COLUMN_DEFAULTS));
        return;
    }
    Object.keys(TABLE_COLUMN_DEFAULTS).forEach(tableKey => {
        const defaults = TABLE_COLUMN_DEFAULTS[tableKey];
        const stored = data.settings.tableColumns[tableKey] || {};
        const order = Array.isArray(stored.order) ? stored.order.filter(id => defaults.order.includes(id)) : [];
        defaults.order.forEach(id => {
            if (!order.includes(id)) order.push(id);
        });
        const hidden = Array.isArray(stored.hidden)
            ? stored.hidden.filter(id => defaults.order.includes(id) && !(TABLE_COLUMNS_REQUIRED[tableKey] || []).includes(id))
            : [];
        data.settings.tableColumns[tableKey] = { order, hidden };
    });
}

function getTableColumnConfig(tableKey) {
    ensureTableColumnSettings(appData);
    return appData.settings.tableColumns[tableKey] || TABLE_COLUMN_DEFAULTS[tableKey];
}

function getEffectiveColumnOrder(tableKey) {
    const defaults = TABLE_COLUMN_DEFAULTS[tableKey];
    const config = getTableColumnConfig(tableKey);
    const hidden = new Set(config.hidden || []);
    const required = new Set(TABLE_COLUMNS_REQUIRED[tableKey] || []);
    const order = [...config.order];
    defaults.order.forEach(id => {
        if (!order.includes(id)) order.push(id);
    });
    return order.filter(id => defaults.order.includes(id) && (!hidden.has(id) || required.has(id)));
}

function saveTableColumnConfig(tableKey, config) {
    ensureTableColumnSettings(appData);
    appData.settings.tableColumns[tableKey] = config;
    saveData(appData);
}

function resetTableColumnConfig(tableKey) {
    saveTableColumnConfig(tableKey, JSON.parse(JSON.stringify(TABLE_COLUMN_DEFAULTS[tableKey])));
}

function openColumnSettingsModal(tableKey) {
    columnSettingsTableKey = tableKey;
    const modal = document.getElementById('column-settings-modal');
    const title = document.getElementById('column-settings-title');
    if (title) {
        title.textContent = tableKey === 'useHistory' ? 'Customize Use History Columns' : 'Customize Purchase History Columns';
    }
    renderColumnSettingsList(tableKey);
    modal?.classList.remove('hidden');
}

function closeColumnSettingsModal() {
    columnSettingsTableKey = null;
    document.getElementById('column-settings-modal')?.classList.add('hidden');
}

function renderColumnSettingsList(tableKey) {
    const list = document.getElementById('column-settings-list');
    if (!list) return;
    const config = getTableColumnConfig(tableKey);
    const labels = TABLE_COLUMN_LABELS[tableKey];
    const required = new Set(TABLE_COLUMNS_REQUIRED[tableKey] || []);
    const hidden = new Set(config.hidden || []);
    const order = [...config.order];
    TABLE_COLUMN_DEFAULTS[tableKey].order.forEach(id => {
        if (!order.includes(id)) order.push(id);
    });

    list.innerHTML = order.map(colId => {
        const checked = !hidden.has(colId);
        const disabled = required.has(colId) ? 'disabled checked' : (checked ? 'checked' : '');
        const reqNote = required.has(colId) ? ' <span class="column-required-tag">(required)</span>' : '';
        return `<li class="column-settings-item" draggable="true" data-col-id="${colId}">
            <span class="column-drag-handle" draggable="true" aria-hidden="true">☰</span>
            <label class="column-settings-label">
                <input type="checkbox" class="column-settings-visible" data-col-id="${colId}" ${disabled}>
                ${labels[colId] || colId}${reqNote}
            </label>
        </li>`;
    }).join('');
}

function readColumnSettingsFromModal(tableKey) {
    const list = document.getElementById('column-settings-list');
    if (!list) return getTableColumnConfig(tableKey);
    const required = new Set(TABLE_COLUMNS_REQUIRED[tableKey] || []);
    const order = [...list.querySelectorAll('.column-settings-item')].map(li => li.dataset.colId);
    const hidden = [];
    list.querySelectorAll('.column-settings-visible').forEach(input => {
        if (!input.checked && !required.has(input.dataset.colId)) {
            hidden.push(input.dataset.colId);
        }
    });
    return { order, hidden };
}

function applyColumnSettingsFromModal() {
    if (!columnSettingsTableKey) return;
    const tableKey = columnSettingsTableKey;
    const config = readColumnSettingsFromModal(tableKey);
    saveTableColumnConfig(tableKey, config);
    closeColumnSettingsModal();
    if (tableKey === 'useHistory') {
        renderUseHistoryTable();
    } else {
        renderPurchaseHistory(isAllSubstancesView() ? null : currentSubstanceId);
    }
}

function resetColumnSettingsFromModal() {
    if (!columnSettingsTableKey) return;
    const tableKey = columnSettingsTableKey;
    resetTableColumnConfig(tableKey);
    renderColumnSettingsList(tableKey);
    if (tableKey === 'useHistory') {
        renderUseHistoryTable();
    } else {
        renderPurchaseHistory(isAllSubstancesView() ? null : currentSubstanceId);
    }
}

function setupColumnSettingsModal() {
    document.getElementById('use-history-customize-columns')?.addEventListener('click', () => {
        openColumnSettingsModal('useHistory');
    });
    document.getElementById('purchase-history-customize-columns')?.addEventListener('click', () => {
        openColumnSettingsModal('purchaseHistory');
    });
    document.getElementById('column-settings-close')?.addEventListener('click', closeColumnSettingsModal);
    document.getElementById('column-settings-apply')?.addEventListener('click', applyColumnSettingsFromModal);
    document.getElementById('column-settings-reset')?.addEventListener('click', resetColumnSettingsFromModal);

    const list = document.getElementById('column-settings-list');
    if (!list) return;

    let dragItem = null;

    list.addEventListener('dragstart', e => {
        if (!e.target.closest('.column-drag-handle')) {
            e.preventDefault();
            return;
        }
        const item = e.target.closest('.column-settings-item');
        if (!item) return;
        dragItem = item;
        item.classList.add('column-settings-dragging');
        e.dataTransfer.effectAllowed = 'move';
        e.dataTransfer.setData('text/plain', item.dataset.colId);
    });

    list.addEventListener('dragend', () => {
        dragItem?.classList.remove('column-settings-dragging');
        dragItem = null;
        list.querySelectorAll('.column-settings-item').forEach(el => el.classList.remove('column-settings-drop-target'));
    });

    list.addEventListener('dragover', e => {
        e.preventDefault();
        const item = e.target.closest('.column-settings-item');
        if (!item || item === dragItem) return;
        list.querySelectorAll('.column-settings-item').forEach(el => el.classList.remove('column-settings-drop-target'));
        item.classList.add('column-settings-drop-target');
    });

    list.addEventListener('drop', e => {
        e.preventDefault();
        const target = e.target.closest('.column-settings-item');
        if (!target || !dragItem || target === dragItem) return;
        const items = [...list.querySelectorAll('.column-settings-item')];
        const dragIdx = items.indexOf(dragItem);
        const targetIdx = items.indexOf(target);
        if (dragIdx < targetIdx) target.after(dragItem);
        else target.before(dragItem);
        target.classList.remove('column-settings-drop-target');
    });
}

function renderUseHistoryHeaderCell(colId) {
    const labels = TABLE_COLUMN_LABELS.useHistory;
    if (colId === 'select') {
        return `<th class="use-history-cb-col"><span class="sr-only">${labels.select}</span></th>`;
    }
    if (colId === 'actions') {
        return `<th class="actions-cell">${labels.actions}</th>`;
    }
    return `<th>${labels[colId] || colId}</th>`;
}

function renderUseHistoryBodyCell(colId, entry, sub, avgRate) {
    const rateStr = entry.useRate != null ? `${entry.useRate.toFixed(2)}/${sub.defaultUnit}/hr` : '—';
    const checked = useHistorySelectionHas(entry.id) ? 'checked' : '';
    switch (colId) {
        case 'select':
            return `<td class="use-history-cb-col"><input type="checkbox" class="use-history-row-cb" data-log-id="${entry.id}" aria-label="Select session" ${checked}></td>`;
        case 'date':
            return `<td>${formatDate(entry.date)}</td>`;
        case 'start':
            return `<td>${entry.startTime || entry.time || '—'}</td>`;
        case 'end':
            return `<td>${entry.endTime || '—'}</td>`;
        case 'duration':
            return `<td>${formatDurationHours(entry.durationHours)}</td>`;
        case 'amount':
            return `<td>${entry.amount}</td>`;
        case 'unit':
            return `<td>${entry.unit}</td>`;
        case 'count':
            return `<td>${entry.count || '—'}</td>`;
        case 'rate':
            return `<td>${rateStr}</td>`;
        case 'break':
            return `<td>${renderBreakSincePreviousCell(entry)}</td>`;
        case 'supply':
            return `<td class="supply-cell session-supply-cell">${formatInventoryLinkDisplay(entry)}</td>`;
        case 'notes':
            return `<td class="notes-cell session-notes-cell">${entry.notes || ''}</td>`;
        case 'actions':
            return `<td class="actions-cell use-history-actions-cell">
                <button type="button" class="secondary-btn" onclick="editUseEntry(${entry.id})">Edit</button>
                <button type="button" class="delete-btn" onclick="deleteUseEntry(${entry.id})">×</button>
            </td>`;
        default:
            return '<td>—</td>';
    }
}

function renderPurchaseHistoryHeaderCell(colId) {
    const labels = TABLE_COLUMN_LABELS.purchaseHistory;
    if (colId === 'actions') return `<th class="actions-cell">${labels.actions}</th>`;
    return `<th>${labels[colId] || colId}</th>`;
}

function renderPurchaseHistoryBodyCell(colId, ctx) {
    const {
        purchase, sub, cur, store, bought, remaining, pctUsed, supply, unit,
        breakCell, supplyDurationLabel, supplyDurationTooltip, sinceLastUseLabel,
        totalNum, cpu, expanded, toggleLabel
    } = ctx;
    switch (colId) {
        case 'date':
            return `<td>${formatDate(purchase.date || '')}</td>`;
        case 'time':
            return `<td>${purchase.time || '—'}</td>`;
        case 'substance':
            return `<td>${sub?.icon || ''} ${sub?.name || 'Unknown'}</td>`;
        case 'bought':
            return `<td>${bought}${unit}</td>`;
        case 'remaining':
            return `<td>${remaining.toFixed(1)}${unit}</td>`;
        case 'usedPct':
            return `<td>${pctUsed}%</td>`;
        case 'supplyDuration':
            return `<td class="purchase-supply-duration-cell" title="${supplyDurationTooltip}">${supplyDurationLabel}</td>`;
        case 'sinceLastUse':
            return `<td>${sinceLastUseLabel}</td>`;
        case 'supply':
            return `<td class="supply-cell"><span class="purchase-supply-status ${supply.className}">${supply.label}</span></td>`;
        case 'cost':
            return `<td>${cur}${totalNum.toFixed(2)} <small>(${cur}${cpu.toFixed(2)}/u)</small></td>`;
        case 'store':
            return `<td>${store || '—'}</td>`;
        case 'break':
            return `<td>${breakCell}</td>`;
        case 'actions':
            return `<td class="actions-cell purchase-history-actions-cell">
                <button type="button" class="secondary-btn purchase-expand-btn" data-purchase-toggle="${purchase.id}" aria-expanded="${expanded ? 'true' : 'false'}" onclick="togglePurchaseLinkedLogs(${purchase.id})">${toggleLabel}</button>
                <button type="button" class="secondary-btn" onclick="editPurchase(${purchase.id})">Edit</button>
                <button type="button" class="delete-btn" onclick="deletePurchase(${purchase.id})">Delete</button>
            </td>`;
        default:
            return '<td>—</td>';
    }
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
    renderHistory();
    refreshTaperDashboard();
    renderSupportContacts();
    renderReasons();
    renderSubstancesList();
    setupBuyTrackerForm();
    setupUseLogForm();
    setupSubstanceForm();
    setupStatsDateRange();
    setDefaultUseLogDateTime();
    refreshAllRecoveryStreaks();
    updateQuickActions();
    updateDashboardMainDisplay();
    applyMainSubstanceToForms();

    updateLastSavedDisplay();
    applyCollapsedSections();
}

function refreshAppAfterDataChange() {
    recalculateAllBreaks();
    recalculateAllBuyBreaks();
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
    renderHistory();
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
    const calEl = document.getElementById('history-substance');
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
    populateSelect('history-substance', getLoggableSubstances(), { currentValue: mainId && active.some(s => s.id === mainId) ? mainId : active[0]?.id });
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
    return logs.filter(log => logMatchesSubstance(log, substanceId));
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
        applyCollapsedSections();
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
    applyCollapsedSections();
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
        const subs = sortSubstancesMainFirst(getLoggableSubstances());
        const mainId = getMainSubstanceId();
        populateSelect('history-substance', subs, {
            currentValue: mainId && subs.some(s => s.id === mainId) ? mainId : subs[0]?.id
        });
        renderHistory();
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
    applyCollapsedSections();
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

function formatBreakText(minutes) {
    if (minutes == null || isNaN(minutes) || minutes < 0) return '—';
    const total = Math.floor(minutes);
    const days = Math.floor(total / 1440);
    const hours = Math.floor((total % 1440) / 60);
    const mins = total % 60;
    if (days > 0) {
        if (hours > 0) return `${days}d ${hours}h`;
        return `${days}d`;
    }
    if (hours > 0) {
        if (mins > 0) return `${hours}h ${mins}m`;
        return `${hours}h`;
    }
    return `${mins}m`;
}

function getBreakColorClass(hours) {
    if (hours == null || isNaN(hours)) return '';
    if (hours < 1) return 'break-red';
    if (hours < 12) return 'break-orange';
    if (hours < 48) return 'break-yellow';
    return 'break-green';
}

function medianBreakHours(values) {
    if (!values.length) return null;
    const sorted = [...values].sort((a, b) => a - b);
    const mid = Math.floor(sorted.length / 2);
    return sorted.length % 2 === 1
        ? sorted[mid]
        : (sorted[mid - 1] + sorted[mid]) / 2;
}

function recalculateBreaksForData(substanceId, data) {
    const logs = getUseEntries(data)
        .filter(l => logMatchesSubstance(l, substanceId, data) && isPersonalUseLog(l))
        .sort((a, b) => getLogDatetimeMs(a) - getLogDatetimeMs(b));

    logs.forEach((log, index) => {
        if (index === 0) {
            delete log.breakMinutes;
            delete log.breakHours;
            delete log.breakText;
            return;
        }

        const previous = logs[index - 1];
        const previousEnd = getUseEndDatetime(previous);
        const currentStartMs = getLogDatetimeMs(log);

        if (!previousEnd || !currentStartMs) {
            delete log.breakMinutes;
            delete log.breakHours;
            delete log.breakText;
            return;
        }

        const breakMs = currentStartMs - previousEnd.getTime();
        if (breakMs < 0) {
            delete log.breakMinutes;
            delete log.breakHours;
            delete log.breakText;
            return;
        }

        const breakMinutes = Math.floor(breakMs / 60000);
        log.breakMinutes = breakMinutes;
        log.breakHours = breakMinutes / 60;
        log.breakText = formatBreakText(breakMinutes);
    });
}

function recalculateBreaks(substanceId) {
    recalculateBreaksForData(substanceId, appData);
}

function recalculateAllBreaks() {
    const substanceIds = new Set((appData.logs || []).map(l => getUseSubstanceId(l)).filter(Boolean));
    substanceIds.forEach(id => recalculateBreaks(id));
}

function recalculateAllBreaksForData(data) {
    const substanceIds = new Set(getUseEntries(data).map(l => getUseSubstanceId(l)).filter(Boolean));
    substanceIds.forEach(id => recalculateBreaksForData(id, data));
}

function getBreakMetrics(substanceId) {
    const logs = getUseLogsForSubstance(substanceId, { sortAsc: true, personalUseOnly: true });
    const breakHoursList = logs
        .filter(l => l.breakHours != null && !isNaN(l.breakHours))
        .map(l => l.breakHours);

    const currentLog = logs.length ? logs[logs.length - 1] : null;
    const currentBreak = currentLog?.breakHours != null
        ? { hours: currentLog.breakHours, text: currentLog.breakText || formatBreakText(currentLog.breakMinutes) }
        : null;

    let streakWithoutUse = null;
    if (logs.length) {
        const lastEnd = getUseEndDatetime(logs[logs.length - 1]);
        if (lastEnd) {
            const ms = Date.now() - lastEnd.getTime();
            if (ms >= 0) {
                const minutes = Math.floor(ms / 60000);
                streakWithoutUse = {
                    minutes,
                    hours: minutes / 60,
                    text: formatBreakText(minutes)
                };
            }
        }
    }

    const thirtyDaysAgo = Date.now() - 30 * 24 * 60 * 60 * 1000;
    const recentBreakHours = logs
        .filter(l => l.breakHours != null && getLogDatetimeMs(l) >= thirtyDaysAgo)
        .map(l => l.breakHours);

    const trend = logs
        .filter(l => l.breakHours != null)
        .slice(-10)
        .map(l => ({
            date: l.date,
            hours: l.breakHours,
            text: l.breakText,
            label: formatDate(l.date)
        }));

    return {
        count: breakHoursList.length,
        current: currentBreak,
        longest: breakHoursList.length ? Math.max(...breakHoursList) : null,
        average: breakHoursList.length
            ? breakHoursList.reduce((sum, h) => sum + h, 0) / breakHoursList.length
            : null,
        median: medianBreakHours(breakHoursList),
        shortest: breakHoursList.length ? Math.min(...breakHoursList) : null,
        avg30Days: recentBreakHours.length
            ? recentBreakHours.reduce((sum, h) => sum + h, 0) / recentBreakHours.length
            : null,
        streakWithoutUse,
        trend
    };
}

function getBuyBreakColorClass(hours) {
    if (hours == null || isNaN(hours)) return '';
    if (hours < 24) return 'buy-break-red';
    if (hours < 72) return 'buy-break-orange';
    if (hours < 168) return 'buy-break-yellow';
    return 'buy-break-green';
}

function getPurchasesForSubstance(substanceId, data = appData, { sortAsc = true } = {}) {
    let list = (data.purchases || []).filter(p => getPurchaseSubstanceId(p) === substanceId);
    list = [...list].sort((a, b) => {
        const da = getPurchaseDatetimeMs(a);
        const db = getPurchaseDatetimeMs(b);
        return sortAsc ? da - db : db - da;
    });
    return list;
}

function recalculateBuyBreaksForData(substanceId, data) {
    const purchases = getPurchasesForSubstance(substanceId, data, { sortAsc: true });

    purchases.forEach((purchase, index) => {
        if (index === 0) {
            delete purchase.buyBreakMinutes;
            delete purchase.buyBreakHours;
            delete purchase.buyBreakText;
            return;
        }

        const previous = purchases[index - 1];
        const previousMs = getPurchaseDatetimeMs(previous);
        const currentMs = getPurchaseDatetimeMs(purchase);

        if (!previousMs || !currentMs) {
            delete purchase.buyBreakMinutes;
            delete purchase.buyBreakHours;
            delete purchase.buyBreakText;
            return;
        }

        const buyBreakMs = currentMs - previousMs;
        if (buyBreakMs < 0) {
            delete purchase.buyBreakMinutes;
            delete purchase.buyBreakHours;
            delete purchase.buyBreakText;
            return;
        }

        const buyBreakMinutes = Math.floor(buyBreakMs / 60000);
        purchase.buyBreakMinutes = buyBreakMinutes;
        purchase.buyBreakHours = buyBreakMinutes / 60;
        purchase.buyBreakText = formatBreakText(buyBreakMinutes);
    });
}

function recalculateBuyBreaks(substanceId) {
    recalculateBuyBreaksForData(substanceId, appData);
}

function recalculateAllBuyBreaks() {
    const substanceIds = new Set((appData.purchases || []).map(p => getPurchaseSubstanceId(p)).filter(Boolean));
    substanceIds.forEach(id => recalculateBuyBreaks(id));
}

function recalculateAllBuyBreaksForData(data) {
    const substanceIds = new Set((data.purchases || []).map(p => getPurchaseSubstanceId(p)).filter(Boolean));
    substanceIds.forEach(id => recalculateBuyBreaksForData(id, data));
}

function formatBuyBreakFromHours(hours) {
    if (hours == null || isNaN(hours)) return '—';
    return formatBreakText(Math.floor(hours * 60));
}

function getBuyBreakMetrics(substanceId) {
    const purchases = getPurchasesForSubstance(substanceId, appData, { sortAsc: true });
    const breakHoursList = purchases
        .filter(p => p.buyBreakHours != null && !isNaN(p.buyBreakHours))
        .map(p => p.buyBreakHours);

    const lastPurchase = purchases.length ? purchases[purchases.length - 1] : null;
    let timeSinceLastBuy = null;
    if (lastPurchase) {
        const lastMs = getPurchaseDatetimeMs(lastPurchase);
        if (lastMs) {
            const ms = Date.now() - lastMs;
            if (ms >= 0) {
                const minutes = Math.floor(ms / 60000);
                timeSinceLastBuy = {
                    minutes,
                    hours: minutes / 60,
                    text: formatBreakText(minutes)
                };
            }
        }
    }

    const currentBuyBreak = lastPurchase?.buyBreakHours != null
        ? {
            hours: lastPurchase.buyBreakHours,
            text: lastPurchase.buyBreakText || formatBreakText(lastPurchase.buyBreakMinutes)
        }
        : null;

    const thirtyDaysAgo = Date.now() - 30 * 24 * 60 * 60 * 1000;
    const recentBreakHours = purchases
        .filter(p => p.buyBreakHours != null && getPurchaseDatetimeMs(p) >= thirtyDaysAgo)
        .map(p => p.buyBreakHours);

    const average = breakHoursList.length
        ? breakHoursList.reduce((sum, h) => sum + h, 0) / breakHoursList.length
        : null;

    let estimatedNextBuy = null;
    if (lastPurchase && average != null) {
        const lastMs = getPurchaseDatetimeMs(lastPurchase);
        if (lastMs) {
            const nextMs = lastMs + average * 60 * 60 * 1000;
            const nextDate = new Date(nextMs);
            estimatedNextBuy = {
                date: nextDate,
                label: formatDate(nextDate.toISOString().split('T')[0])
            };
        }
    }

    const trend = purchases
        .filter(p => p.buyBreakHours != null)
        .slice(-10)
        .map(p => ({
            date: p.date,
            hours: p.buyBreakHours,
            text: p.buyBreakText,
            label: formatDate(p.date)
        }));

    return {
        count: breakHoursList.length,
        purchases: purchases.length,
        lastPurchase,
        current: currentBuyBreak,
        timeSinceLastBuy,
        longest: breakHoursList.length ? Math.max(...breakHoursList) : null,
        average,
        shortest: breakHoursList.length ? Math.min(...breakHoursList) : null,
        avg30Days: recentBreakHours.length
            ? recentBreakHours.reduce((sum, h) => sum + h, 0) / recentBreakHours.length
            : null,
        estimatedNextBuy,
        trend
    };
}

function renderBuyBreakSincePreviousCell(purchase) {
    const hours = purchase.buyBreakHours;
    const text = purchase.buyBreakText || (hours != null ? formatBuyBreakFromHours(hours) : '—');
    if (text === '—' || hours == null) return '—';
    return `<span class="buy-break-cell ${getBuyBreakColorClass(hours)}">${text}</span>`;
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
    return getUseEntries().find(l => l.id === id || String(l.id) === String(id));
}

function logIdEquals(a, b) {
    if (a == null || b == null) return false;
    return a === b || String(a) === String(b);
}

function isSameTaperWeek(logDate, dateStr) {
    if (!logDate || !dateStr) return false;
    return getWeekStartDateStr(logDate) === getWeekStartDateStr(dateStr);
}

function getUseEntries(data = appData) {
    return Array.isArray(data?.logs) ? data.logs : [];
}

function normalizeSubstanceRef(ref, data = appData) {
    if (ref == null || ref === '') return '';
    const substances = data?.substances || [];
    const refStr = String(ref);
    const byId = substances.find(s => String(s.id) === refStr);
    if (byId) return byId.id;
    const byName = substances.find(s =>
        s.name === ref || String(s.name).toLowerCase() === refStr.toLowerCase()
    );
    if (byName) return byName.id;
    return refStr;
}

function logMatchesSubstance(log, substanceId, data = appData) {
    if (!substanceId) return true;
    return normalizeSubstanceRef(getUseSubstanceId(log), data)
        === normalizeSubstanceRef(substanceId, data);
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

function getLogTransactionType(log) {
    const t = log?.transactionType;
    if (t === 'gift_given' || t === 'gift_received' || t === 'inventory_adjustment') return t;
    if (t === 'correction') return 'inventory_adjustment';
    return 'use';
}

function isPersonalUseLog(log) {
    return getLogTransactionType(log) === 'use';
}

function isGiftGivenLog(log) {
    return getLogTransactionType(log) === 'gift_given';
}

function isGiftReceivedLog(log) {
    return getLogTransactionType(log) === 'gift_received';
}

function isInventoryAdjustmentLog(log) {
    return getLogTransactionType(log) === 'inventory_adjustment';
}

function isNonUseTransactionLog(log) {
    return !isPersonalUseLog(log);
}

function logInventoryAffects(log) {
    if (log?.inventoryAffects === false) return false;
    if (log?.inventoryAffects === true) return true;
    if (log?.linkedPurchases?.length) return true;
    return log?.linkedPurchaseId != null && log.linkedPurchaseId !== '';
}

function hasLinkedSupply(log) {
    if (log?.linkedPurchaseId != null && log.linkedPurchaseId !== '') return true;
    return Array.isArray(log?.linkedPurchases) && log.linkedPurchases.length > 0;
}

function getLinkedSupplyLabel(log) {
    const purchases = appData.purchases || [];

    if (log.linkedPurchaseId != null && log.linkedPurchaseId !== '') {
        const purchase = purchases.find(p => String(p.id) === String(log.linkedPurchaseId));
        if (purchase) {
            const store = purchase.store || purchase.location || purchase.substanceName || '';
            return `${formatDate(purchase.date)} purchase${store ? ` · ${store}` : ''}`;
        }
    }

    if (Array.isArray(log.linkedPurchases) && log.linkedPurchases.length) {
        return log.linkedPurchases.map(lp => {
            const purchase = purchases.find(p => String(p.id) === String(lp.purchaseId));
            const amt = lp.amountUsed ?? lp.amount ?? 0;
            const unit = log.unit || purchase?.unit || '';
            if (!purchase) return `${amt}${unit} from unknown supply`;
            const store = purchase.store || purchase.location || '';
            return `${amt}${unit} from ${formatDate(purchase.date)}${store ? ` · ${store}` : ''}`;
        }).join(', ');
    }

    const tx = getLogTransactionType(log);
    if (tx === 'gift_received') return 'Gift received · no purchase';
    if (log.inventoryAffects === false) return 'No inventory change';

    return 'Unlinked use';
}

function formatInventoryLinkDisplay(log) {
    return getLinkedSupplyLabel(log);
}

function getAdjustmentDirection(log) {
    return log?.adjustmentDirection === 'remove' ? 'remove' : 'add';
}

function inventoryAdjustmentAdds(log) {
    return isInventoryAdjustmentLog(log) && getAdjustmentDirection(log) === 'add';
}

function inventoryAdjustmentRemoves(log) {
    return isInventoryAdjustmentLog(log) && getAdjustmentDirection(log) === 'remove';
}

function getTransactionTypeLabel(tx) {
    if (tx === 'gift_given') return 'Gift Given';
    if (tx === 'gift_received') return 'Gift Received';
    if (tx === 'inventory_adjustment') return 'Inventory Adjustment';
    return 'Personal Use';
}

function formatLogHistoryLabel(entry, sub) {
    const tx = getLogTransactionType(entry);
    const unit = entry.unit || sub?.defaultUnit || 'units';
    const amount = entry.amount ?? '—';
    if (tx === 'gift_given') {
        const who = entry.giftPartyName ? ` — ${entry.giftPartyName}` : '';
        return `🎁 Gift Given${who} — ${amount}${unit}`;
    }
    if (tx === 'gift_received') {
        const who = entry.giftPartyName ? ` — ${entry.giftPartyName}` : '';
        return `🎁 Gift Received${who} — ${amount}${unit}`;
    }
    if (tx === 'inventory_adjustment') {
        const dir = getAdjustmentDirection(entry) === 'remove' ? '−' : '+';
        return `📦 Inventory ${dir}${amount}${unit}`;
    }
    const typeLabel = getUseLogType(entry) === 'session' ? '⏱️ Session' : '⚡ Quick Use';
    return `${typeLabel} ${sub?.icon || ''} ${amount} ${unit} ${sub?.name || 'Unknown'}`;
}

function setUseTransactionType(tx) {
    const hidden = document.getElementById('use-transaction-type');
    if (hidden) hidden.value = tx;
    document.querySelectorAll('.use-tx-pill').forEach(btn => {
        btn.classList.toggle('active', btn.dataset.tx === tx);
    });

    const isGiftGiven = tx === 'gift_given';
    const isGiftReceived = tx === 'gift_received';
    const isGift = isGiftGiven || isGiftReceived;
    const isAdjustment = tx === 'inventory_adjustment';
    const isNonUse = isGift || isAdjustment;

    document.getElementById('use-entry-type-group')?.classList.toggle('hidden', isNonUse);
    document.getElementById('use-adjustment-direction-group')?.classList.toggle('hidden', !isAdjustment);
    document.getElementById('use-gift-party-group')?.classList.toggle('hidden', !isGift);

    const partyLabel = document.getElementById('use-gift-party-label');
    if (partyLabel) partyLabel.textContent = isGiftReceived ? 'From' : 'Recipient Name';

    const amountLabel = document.getElementById('use-amount-label');
    if (amountLabel) {
        if (isAdjustment) amountLabel.textContent = 'Amount';
        else if (isGiftReceived) amountLabel.textContent = 'Amount Received';
        else if (isGiftGiven) amountLabel.textContent = 'Amount Given';
        else amountLabel.textContent = 'Amount';
    }

    const linkLabel = document.getElementById('use-purchase-link-label');
    if (linkLabel) {
        if (isGiftReceived || (isAdjustment && getUseAdjustmentDirection() === 'add')) {
            linkLabel.textContent = 'Add to Inventory';
        } else if (isAdjustment) {
            linkLabel.textContent = 'Remove from Inventory';
        } else {
            linkLabel.textContent = 'Use From Purchase / Bag';
        }
    }

    document.querySelectorAll('.session-only-field').forEach(el => {
        el.classList.toggle('hidden', isNonUse || document.getElementById('use-type')?.value !== 'session');
    });

    if (isNonUse) setUseLogType('quick');
    updateUseTaperPreview();
    updateUsePurchaseLinkUI();
}

function getUseAdjustmentDirection() {
    const active = document.querySelector('.use-adj-pill.active');
    return active?.dataset.dir === 'remove' ? 'remove' : 'add';
}

function setUseAdjustmentDirection(dir) {
    document.querySelectorAll('.use-adj-pill').forEach(btn => {
        btn.classList.toggle('active', btn.dataset.dir === dir);
    });
    updateUsePurchaseLinkUI();
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
    const transactionType = document.getElementById('use-transaction-type')?.value || 'use';
    const isGift = transactionType === 'gift_given' || transactionType === 'gift_received';
    const isAdjustment = transactionType === 'inventory_adjustment';
    const type = (isGift || isAdjustment) ? 'quick' : (document.getElementById('use-type')?.value || 'quick');
    const substanceId = document.getElementById('use-substance')?.value;
    const amount = parseFloat(document.getElementById('use-amount')?.value);
    const unit = document.getElementById('use-unit')?.value;
    const date = document.getElementById('use-date')?.value;
    const startTime = document.getElementById('use-start-time')?.value || '12:00';
    const endTime = document.getElementById('use-end-time')?.value;
    const linkMode = getUsePurchaseLinkMode();
    const linkedPurchaseId = resolveLinkedPurchaseId(substanceId, transactionType);
    const inventoryAffects = linkMode !== 'none' && linkedPurchaseId != null;

    return {
        type,
        transactionType,
        substanceId,
        amount: Number.isFinite(amount) ? amount : 0,
        unit: unit || 'units',
        date,
        startTime,
        time: startTime,
        endTime: !isGift && !isAdjustment && type === 'session' ? (endTime || '') : '',
        count: (isGift || isAdjustment) ? 0 : (parseFloat(document.getElementById('use-count')?.value) || 0),
        giftPartyName: isGift ? (document.getElementById('use-gift-party')?.value?.trim() || '') : '',
        adjustmentDirection: isAdjustment ? getUseAdjustmentDirection() : undefined,
        notes: document.getElementById('use-notes')?.value || '',
        linkedPurchaseId: inventoryAffects ? linkedPurchaseId : null,
        linkedPurchases: [],
        supplyUnlinked: !inventoryAffects,
        inventoryAffects
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
    setUseTransactionType('use');
    setUseAdjustmentDirection('add');
}

function refreshUseLogRelatedViews() {
    recalculateAllBreaks();
    recalculateAllBuyBreaks();
    renderUseLogTab();
    updateDashboard();
    updateStats();
    refreshTaperDashboard();
    refreshBuyTrackerRelatedViews();
    renderHistory();
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

function addPurchaseRemainingInData(purchase, amount) {
    const amt = parseFloat(amount) || 0;
    if (amt <= 0) return 0;
    const cap = getPurchaseQuantityBought(purchase);
    const remaining = getPurchaseRemainingAmount(purchase);
    purchase.remainingAmount = Math.min(cap, remaining + amt);
    finalizePurchaseRemainingState(purchase);
    return purchase.remainingAmount - remaining;
}

function subtractPurchaseRemainingInData(purchase, amount) {
    const amt = parseFloat(amount) || 0;
    if (amt <= 0) return 0;
    purchase.remainingAmount = Math.max(0, getPurchaseRemainingAmount(purchase) - amt);
    finalizePurchaseRemainingState(purchase);
    return amt;
}

function resolveGiftReceivedPurchaseInData(substanceId, purchases) {
    const list = (purchases || [])
        .filter(p => getPurchaseSubstanceId(p) === substanceId)
        .sort((a, b) => getPurchaseDatetimeMs(a) - getPurchaseDatetimeMs(b));
    const active = list.find(p => !p.isDepleted && getPurchaseRemainingAmount(p) > INVENTORY_EPS);
    if (active) return active;
    return list.length ? list[list.length - 1] : null;
}

function resolveGiftReceivedPurchaseId(substanceId) {
    const purchase = resolveGiftReceivedPurchaseInData(substanceId, appData.purchases || []);
    return purchase?.id || null;
}

function addPurchaseAmount(purchaseId, amount) {
    if (!purchaseId) return { ok: true };
    const purchase = findPurchase(purchaseId);
    if (!purchase) return { ok: false, error: 'Linked purchase not found.' };
    addPurchaseRemainingInData(purchase, amount);
    purchase.updatedAt = new Date().toISOString();
    return { ok: true };
}

function applyLogInventoryEffect(log) {
    if (!logInventoryAffects(log)) return { ok: true };

    const amount = parseFloat(log.amount) || 0;
    if (amount <= INVENTORY_EPS) return { ok: true };

    if (isGiftReceivedLog(log) || inventoryAdjustmentAdds(log)) {
        if (log.linkedPurchases?.length) {
            for (const alloc of log.linkedPurchases) {
                const result = addPurchaseAmount(alloc.purchaseId, alloc.amountUsed ?? alloc.amount);
                if (!result.ok) return result;
            }
            return { ok: true };
        }
        return log.linkedPurchaseId
            ? addPurchaseAmount(log.linkedPurchaseId, amount)
            : { ok: true };
    }

    if (log.linkedPurchases?.length) {
        for (const alloc of log.linkedPurchases) {
            const result = deductPurchaseAmount(alloc.purchaseId, alloc.amountUsed ?? alloc.amount);
            if (!result.ok) return result;
        }
        return { ok: true };
    }

    if (inventoryAdjustmentRemoves(log) || log.linkedPurchaseId) {
        return deductPurchaseAmount(log.linkedPurchaseId, amount);
    }

    return { ok: true };
}

function resetAllPurchaseInventory(purchases) {
    purchases.forEach(purchase => {
        const qty = getPurchaseQuantityBought(purchase);
        if (!purchase.quantityBought && qty) purchase.quantityBought = qty;
        if (!purchase.quantity && qty) purchase.quantity = qty;
        purchase.remainingAmount = qty;
        purchase.isDepleted = false;
    });
}

function logIsUnlinked(log) {
    if (log.linkedPurchases?.length) return false;
    return log.linkedPurchaseId == null || log.linkedPurchaseId === '';
}

function applyExistingLogLinks(log, purchases) {
    const purchaseIds = [];
    if (!logInventoryAffects(log)) return purchaseIds;

    const amount = parseFloat(log.amount) || 0;
    if (amount <= INVENTORY_EPS) return purchaseIds;

    const addsInventory = isGiftReceivedLog(log) || inventoryAdjustmentAdds(log);
    const applyChange = addsInventory ? addPurchaseRemainingInData : deductPurchaseRemainingInData;

    if (log.linkedPurchases?.length) {
        log.linkedPurchases.forEach(alloc => {
            const purchase = findPurchaseInData(alloc.purchaseId, { purchases });
            if (purchase) {
                applyChange(purchase, alloc.amountUsed);
                purchaseIds.push(purchase.id);
            }
        });
        log.supplyUnlinked = false;
        return purchaseIds;
    }
    if (log.linkedPurchaseId != null && log.linkedPurchaseId !== '') {
        const purchase = findPurchaseInData(log.linkedPurchaseId, { purchases });
        if (purchase) {
            applyChange(purchase, amount);
            purchaseIds.push(purchase.id);
        }
        log.supplyUnlinked = false;
    }
    return purchaseIds;
}

function fifoLinkLogToPurchases(log, purchases) {
    const amount = parseFloat(log.amount) || 0;
    if (amount <= INVENTORY_EPS) {
        return { linked: false, unmatched: false, purchaseIds: [] };
    }

    if (isGiftReceivedLog(log) || inventoryAdjustmentAdds(log)) {
        if (!logInventoryAffects(log)) {
            return { linked: false, unmatched: true, purchaseIds: [] };
        }
        const purchaseIds = applyExistingLogLinks(log, purchases);
        return {
            linked: purchaseIds.length > 0,
            unmatched: purchaseIds.length === 0,
            purchaseIds
        };
    }

    const substanceId = getUseSubstanceId(log);
    const logMs = getLogDatetimeMs(log);
    let amountLeft = amount;
    const allocations = [];
    const purchaseIds = [];

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
            purchaseIds.push(purchase.id);
            amountLeft -= used;
        }
    }

    if (allocations.length === 1) {
        log.linkedPurchaseId = allocations[0].purchaseId;
        log.linkedPurchases = [];
        log.supplyUnlinked = false;
    } else if (allocations.length > 1) {
        log.linkedPurchases = allocations;
        log.linkedPurchaseId = null;
        log.supplyUnlinked = false;
    } else {
        log.linkedPurchaseId = null;
        log.linkedPurchases = [];
        log.supplyUnlinked = true;
    }

    return {
        linked: allocations.length > 0,
        unmatched: allocations.length === 0 || amountLeft > INVENTORY_EPS,
        purchaseIds
    };
}

function migrateInventoryLinkedV1(data) {
    ensureAppDataMigrations(data);
    if (data.migrations.inventoryLinkedV1) return;

    const purchases = data.purchases || [];
    const logs = data.logs || [];
    resetAllPurchaseInventory(purchases);

    const sortedLogs = [...logs].sort((a, b) => getLogDatetimeMs(a) - getLogDatetimeMs(b));

    sortedLogs.forEach(log => {
        const amount = parseFloat(log.amount) || 0;
        if (amount <= INVENTORY_EPS) return;

        if (log.linkedPurchases?.length) {
            applyExistingLogLinks(log, purchases);
            return;
        }

        if (log.linkedPurchaseId != null && log.linkedPurchaseId !== '') {
            applyExistingLogLinks(log, purchases);
            return;
        }

        fifoLinkLogToPurchases(log, purchases);
    });

    purchases.forEach(finalizePurchaseRemainingState);
    data.migrations.inventoryLinkedV1 = true;
}

function recalculateAllInventory(data = appData) {
    const purchases = data.purchases || [];
    const logs = data.logs || [];
    resetAllPurchaseInventory(purchases);

    const sortedLogs = [...logs].sort((a, b) => getLogDatetimeMs(a) - getLogDatetimeMs(b));

    sortedLogs.forEach(log => {
        const amount = parseFloat(log.amount) || 0;
        if (amount <= INVENTORY_EPS) return;

        if (log.linkedPurchases?.length) {
            applyExistingLogLinks(log, purchases);
            return;
        }

        if (log.linkedPurchaseId != null && log.linkedPurchaseId !== '') {
            applyExistingLogLinks(log, purchases);
            return;
        }

        if (logInventoryAffects(log)) {
            fifoLinkLogToPurchases(log, purchases);
        }
    });

    purchases.forEach(finalizePurchaseRemainingState);
}

function refreshAfterLogLinkChange(substanceId) {
    saveData(appData);
    recalculateAllInventory();
    if (substanceId) recalculateBreaks(substanceId);
    else recalculateAllBreaks();
    renderUseHistoryTable();
    renderRecentUseList();
    refreshBuyTrackerRelatedViews();
    updateDashboard();
    updateStats();
    updateCurrentSupplyDashboard();
    refreshTaperDashboard();
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
let statsDateRangePreset = 'last-7';
let statsCustomStartDate = '';
let statsCustomEndDate = '';

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
    return getLinkedSupplyLabel(log);
}

function getUsePurchaseLinkMode() {
    return document.getElementById('use-purchase-link-mode')?.value || 'auto';
}

function setUsePurchaseLinkMode(mode) {
    const el = document.getElementById('use-purchase-link-mode');
    if (el) el.value = mode;
    updateUsePurchaseLinkUI();
}

function parsePurchaseSelectId(val) {
    if (val == null || val === '') return null;
    const parsed = parseInt(val, 10);
    return Number.isNaN(parsed) ? val : parsed;
}

function resolveLinkedPurchaseId(substanceId, transactionType = 'use') {
    const mode = getUsePurchaseLinkMode();
    if (mode === 'none') return null;

    const addsInventory = transactionType === 'gift_received'
        || (transactionType === 'inventory_adjustment' && getUseAdjustmentDirection() === 'add');

    if (addsInventory) {
        if (mode === 'manual') {
            const val = document.getElementById('use-purchase-select')?.value;
            return val ? parsePurchaseSelectId(val) : null;
        }
        return resolveGiftReceivedPurchaseId(substanceId);
    }

    if (mode === 'manual') {
        const val = document.getElementById('use-purchase-select')?.value;
        return val ? parsePurchaseSelectId(val) : null;
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

function restoreLogInventoryEffect(log, data = appData) {
    if (!hasLinkedSupply(log)) return;

    const purchases = data.purchases || [];
    const applyRestore = (purchase, amt) => {
        if (!purchase || amt <= 0) return;
        if (isGiftReceivedLog(log) || inventoryAdjustmentAdds(log)) {
            subtractPurchaseRemainingInData(purchase, amt);
        } else {
            const cap = getPurchaseQuantityBought(purchase);
            purchase.remainingAmount = Math.min(cap, getPurchaseRemainingAmount(purchase) + amt);
            finalizePurchaseRemainingState(purchase);
        }
    };

    if (log.linkedPurchases?.length) {
        log.linkedPurchases.forEach(alloc => {
            const purchase = findPurchaseInData(alloc.purchaseId, { purchases });
            applyRestore(purchase, parseFloat(alloc.amountUsed ?? alloc.amount) || 0);
        });
    } else if (log.linkedPurchaseId != null && log.linkedPurchaseId !== '') {
        const purchase = findPurchaseInData(log.linkedPurchaseId, { purchases });
        applyRestore(purchase, parseFloat(log.amount) || 0);
    }
}

function restoreLogSupplyLinks(log, data = appData) {
    restoreLogInventoryEffect(log, data);
    log.linkedPurchaseId = null;
    log.linkedPurchases = [];
    log.inventoryAffects = false;
    log.supplyUnlinked = true;
}

function getPurchasesForManualLink(substanceId) {
    return (appData.purchases || [])
        .filter(p => getPurchaseSubstanceId(p) === substanceId)
        .sort((a, b) => getPurchaseDatetimeMs(b) - getPurchaseDatetimeMs(a));
}

function applyLogLinkAllocations(log, allocations, { forceSplitArray = false } = {}) {
    if (allocations.length === 1 && !forceSplitArray) {
        log.linkedPurchaseId = allocations[0].purchaseId;
        log.linkedPurchases = [];
        log.supplyUnlinked = false;
    } else if (allocations.length >= 1) {
        log.linkedPurchases = allocations;
        log.linkedPurchaseId = null;
        log.supplyUnlinked = false;
    } else {
        log.linkedPurchaseId = null;
        log.linkedPurchases = [];
        log.supplyUnlinked = true;
    }
}

function setLogPurchaseLink(log, purchaseId, amount, { split = false } = {}) {
    const amt = parseFloat(amount) || 0;
    log.inventoryAffects = true;
    log.supplyUnlinked = false;
    log.updatedAt = new Date().toISOString();
    if (split) {
        log.linkedPurchaseId = null;
        log.linkedPurchases = [{ purchaseId, amountUsed: amt }];
    } else {
        log.linkedPurchaseId = purchaseId;
        log.linkedPurchases = [];
    }
}

function manualFifoLinkFromPurchase(log, purchases, startPurchaseId, { allowOverdraw } = {}) {
    const amount = parseFloat(log.amount) || 0;
    if (amount <= INVENTORY_EPS) {
        applyLogLinkAllocations(log, []);
        return { allocations: [], overdraw: 0 };
    }

    const substanceId = getUseSubstanceId(log);
    const sorted = purchases
        .filter(p => getPurchaseSubstanceId(p) === substanceId)
        .sort((a, b) => getPurchaseDatetimeMs(a) - getPurchaseDatetimeMs(b));
    const startIdx = sorted.findIndex(p => p.id === startPurchaseId || String(p.id) === String(startPurchaseId));
    const eligible = startIdx >= 0 ? sorted.slice(startIdx) : sorted;

    let amountLeft = amount;
    const allocations = [];
    let overdraw = 0;

    for (let i = 0; i < eligible.length && amountLeft > INVENTORY_EPS; i++) {
        const purchase = eligible[i];
        const remaining = getPurchaseRemainingAmount(purchase);
        let used = 0;

        if (allowOverdraw && i === 0) {
            used = amountLeft;
            purchase.remainingAmount = remaining - used;
            if (purchase.remainingAmount < -INVENTORY_EPS) {
                overdraw += Math.abs(purchase.remainingAmount);
            }
            finalizePurchaseRemainingState(purchase);
            allocations.push({ purchaseId: purchase.id, amountUsed: used });
            amountLeft = 0;
            break;
        }

        if (remaining <= INVENTORY_EPS) continue;
        used = Math.min(amountLeft, remaining);
        if (used <= INVENTORY_EPS) continue;
        purchase.remainingAmount = Math.max(0, remaining - used);
        finalizePurchaseRemainingState(purchase);
        allocations.push({ purchaseId: purchase.id, amountUsed: used });
        amountLeft -= used;
    }

    if (amountLeft > INVENTORY_EPS) {
        overdraw += amountLeft;
    }

    applyLogLinkAllocations(log, allocations);
    return { allocations, overdraw };
}

function getManualBulkLinkOptionsFromUI() {
    return {
        resetOldLinksFirst: !!document.getElementById('manual-link-reset')?.checked,
        allowOverdraw: !!document.getElementById('manual-link-overdraw')?.checked,
        splitIntoNext: !!document.getElementById('manual-link-split')?.checked
    };
}

function getManualBulkLinkSubstanceId() {
    const val = document.getElementById('manual-link-substance')?.value;
    return val || null;
}

function getManualBulkLinkPurchaseId() {
    const val = document.getElementById('manual-link-purchase')?.value;
    if (!val) return null;
    const parsed = parseInt(val, 10);
    return Number.isNaN(parsed) ? val : parsed;
}

function getSelectedLogsForManualLink(substanceId, data = appData) {
    const ids = [...useHistorySelection];
    return ids
        .map(id => (data.logs || []).find(l => l.id === id || String(l.id) === String(id)))
        .filter(Boolean)
        .filter(l => !substanceId || getUseSubstanceId(l) === substanceId)
        .sort((a, b) => getLogDatetimeMs(a) - getLogDatetimeMs(b));
}

function runManualBulkLinkOnData(data, selectedIds, purchaseId, options) {
    const purchases = data.purchases || [];
    const primary = findPurchaseInData(purchaseId, data);
    if (!primary) return 'Selected purchase not found.';

    const substanceId = getPurchaseSubstanceId(primary);
    const selectedLogs = (data.logs || [])
        .filter(l => selectedIds.some(id => l.id === id || String(l.id) === String(id)))
        .filter(l => getUseSubstanceId(l) === substanceId)
        .sort((a, b) => getLogDatetimeMs(a) - getLogDatetimeMs(b));

    if (!selectedLogs.length) {
        return 'No selected sessions match this substance.';
    }

    const totalAmount = selectedLogs.reduce((s, l) => s + (parseFloat(l.amount) || 0), 0);
    const unit = selectedLogs[0]?.unit || getSubstance(substanceId, data)?.defaultUnit || 'units';

    if (options.resetOldLinksFirst) {
        selectedLogs.forEach(log => restoreLogSupplyLinks(log, data));
    }

    const remainingBefore = getPurchaseRemainingAmount(primary);

    let totalOverdraw = 0;

    if (options.splitIntoNext) {
        selectedLogs.forEach(log => {
            const result = manualFifoLinkFromPurchase(log, purchases, purchaseId, {
                allowOverdraw: options.allowOverdraw
            });
            log.inventoryAffects = true;
            log.updatedAt = new Date().toISOString();
            if (result.allocations.length === 1) {
                applyLogLinkAllocations(log, result.allocations, { forceSplitArray: true });
            }
            totalOverdraw += result.overdraw;
        });
        purchases.forEach(finalizePurchaseRemainingState);
    } else {
        selectedLogs.forEach(log => {
            setLogPurchaseLink(log, primary.id, parseFloat(log.amount) || 0, { split: false });
        });

        if (options.allowOverdraw) {
            primary.remainingAmount = remainingBefore - totalAmount;
            totalOverdraw = Math.max(0, totalAmount - remainingBefore);
        } else {
            const used = Math.min(totalAmount, remainingBefore);
            primary.remainingAmount = Math.max(0, remainingBefore - used);
            totalOverdraw = Math.max(0, totalAmount - used);
        }
        finalizePurchaseRemainingState(primary);
    }

    const remainingAfter = getPurchaseRemainingAmount(primary);

    return {
        ok: true,
        stats: {
            sessionCount: selectedLogs.length,
            totalAmount,
            unit,
            purchaseLabel: formatPurchaseOptionLabel(primary),
            remainingBefore,
            remainingAfter,
            overdraw: totalOverdraw
        }
    };
}

function buildManualBulkLinkPreviewStats(data, selectedIds, purchaseId, options) {
    const working = JSON.parse(JSON.stringify(data));
    const result = runManualBulkLinkOnData(working, selectedIds, purchaseId, options);
    if (typeof result === 'string') return { error: result };
    return result.stats;
}

function formatManualBulkLinkPreview(stats) {
    if (!stats) {
        return '<p class="empty-hint">Choose a purchase to preview.</p>';
    }
    if (stats.error) {
        return `<p class="empty-hint">${stats.error}</p>`;
    }
    const unit = stats.unit || 'units';
    const overdrawLine = stats.overdraw > INVENTORY_EPS
        ? `<li><strong>Overdraw:</strong> ${stats.overdraw.toFixed(2)} ${unit}</li>`
        : '';
    return `
        <ul class="bulk-link-summary-list">
            <li><strong>Selected sessions:</strong> ${stats.sessionCount}</li>
            <li><strong>Total amount:</strong> ${stats.totalAmount.toFixed(2)} ${unit}</li>
            <li><strong>Supply selected:</strong> ${stats.purchaseLabel}</li>
            <li><strong>Remaining before:</strong> ${stats.remainingBefore.toFixed(2)} ${unit}</li>
            <li><strong>Remaining after:</strong> ${stats.remainingAfter.toFixed(2)} ${unit}</li>
            ${overdrawLine}
        </ul>
    `;
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

function getGiftMetrics(substanceId) {
    const logs = getUseEntries().filter(l => logMatchesSubstance(l, substanceId));
    return getGiftMetricsFromLogs(logs);
}

function getGiftMetricsFromLogs(logs) {
    let given = 0;
    let received = 0;
    const recipients = {};
    const senders = {};
    (logs || []).forEach(l => {
        const amt = parseFloat(l.amount) || 0;
        if (isGiftGivenLog(l)) {
            given += amt;
            const name = l.giftPartyName?.trim() || 'Unknown';
            recipients[name] = (recipients[name] || 0) + amt;
        } else if (isGiftReceivedLog(l)) {
            received += amt;
            const name = l.giftPartyName?.trim() || 'Unknown';
            senders[name] = (senders[name] || 0) + amt;
        }
    });
    return { given, received, net: received - given, recipients, senders };
}

function getInventoryBreakdown(substanceId) {
    const purchases = (appData.purchases || []).filter(p => getPurchaseSubstanceId(p) === substanceId);
    const purchased = purchases.reduce((s, p) => s + getPurchaseQuantityBought(p), 0);
    const logs = getUseEntries().filter(l => logMatchesSubstance(l, substanceId));
    let used = 0;
    let gifted = 0;
    let received = 0;
    logs.forEach(l => {
        const amt = parseFloat(l.amount) || 0;
        if (isPersonalUseLog(l)) used += amt;
        else if (isGiftGivenLog(l)) gifted += amt;
        else if (isGiftReceivedLog(l)) received += amt;
    });
    return {
        purchased,
        used,
        gifted,
        received,
        remaining: getTotalRemainingSupply(substanceId)
    };
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
        total += getUsedAmount(substanceId, dateStr);
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
    const transactionType = document.getElementById('use-transaction-type')?.value || 'use';
    const isReceived = transactionType === 'gift_received';
    const isGiven = transactionType === 'gift_given';
    const isAdjustment = transactionType === 'inventory_adjustment';
    const adjustmentAdds = isAdjustment && getUseAdjustmentDirection() === 'add';
    const addsInventory = isReceived || adjustmentAdds;

    const linkLabel = document.getElementById('use-purchase-link-label');
    if (linkLabel) {
        if (addsInventory) linkLabel.textContent = 'Add to Inventory';
        else if (isAdjustment) linkLabel.textContent = 'Remove from Inventory';
        else linkLabel.textContent = 'Use From Purchase / Bag';
    }

    if (manualWrap) manualWrap.classList.toggle('hidden', mode !== 'manual');

    if (mode === 'manual' && select && substanceId) {
        let active = addsInventory
            ? getPurchasesForManualLink(substanceId)
            : getActivePurchasesForSubstance(substanceId);
        if (editingUseId) {
            const entry = findUseEntry(editingUseId);
            const linkedIds = new Set();
            if (entry?.linkedPurchaseId != null && entry.linkedPurchaseId !== '') {
                linkedIds.add(String(entry.linkedPurchaseId));
            }
            if (entry?.linkedPurchases?.length) {
                entry.linkedPurchases.forEach(lp => linkedIds.add(String(lp.purchaseId)));
            }
            linkedIds.forEach(linkedId => {
                const linked = (appData.purchases || []).find(p => String(p.id) === linkedId);
                if (linked && !active.some(p => String(p.id) === linkedId)) {
                    active = [linked, ...active];
                }
            });
        }
        const currentVal = select.value;
        select.innerHTML = '<option value="">No linked purchase</option>';
        active.forEach(p => {
            const opt = document.createElement('option');
            opt.value = String(p.id);
            opt.textContent = formatPurchaseOptionLabel(p);
            select.appendChild(opt);
        });
        if (currentVal && [...select.options].some(o => o.value === currentVal || String(o.value) === String(currentVal))) {
            select.value = [...select.options].find(o => o.value === currentVal || String(o.value) === String(currentVal)).value;
        }
    }

    if (preview) {
        if (mode === 'none') {
            preview.textContent = 'This entry will save without changing inventory.';
            preview.classList.remove('hidden');
        } else if (!substanceId) {
            preview.classList.add('hidden');
        } else if (addsInventory) {
            if (mode === 'auto') {
                const target = resolveGiftReceivedPurchaseInData(substanceId, appData.purchases || []);
                preview.textContent = target
                    ? `Auto add to: ${formatPurchaseOptionLabel(target)}`
                    : 'No purchase found — will save without changing inventory.';
            } else {
                const id = select?.value;
                const bag = id ? findPurchase(parsePurchaseSelectId(id)) : null;
                preview.textContent = bag
                    ? `Add to: ${formatPurchaseOptionLabel(bag)}`
                    : 'Choose a purchase to add to, or select No linked purchase.';
            }
            preview.classList.remove('hidden');
        } else if (mode === 'auto') {
            const bag = getOldestActivePurchase(substanceId);
            if (bag) {
                preview.textContent = isGiven
                    ? `Auto deduct (gift): ${formatPurchaseOptionLabel(bag)}`
                    : `Auto: ${formatPurchaseOptionLabel(bag)}`;
                preview.classList.remove('hidden');
            } else {
                preview.textContent = 'No active supply — will save without changing inventory.';
                preview.classList.remove('hidden');
            }
        } else if (mode === 'manual') {
            const id = select?.value;
            const purchaseId = id ? parsePurchaseSelectId(id) : null;
            const amount = parseFloat(document.getElementById('use-amount')?.value) || 0;
            const unit = document.getElementById('use-unit')?.value || 'units';
            if (purchaseId) {
                const previewLog = {
                    linkedPurchaseId: purchaseId,
                    linkedPurchases: [],
                    unit,
                    inventoryAffects: true
                };
                preview.textContent = getLinkedSupplyLabel(previewLog);
            } else {
                preview.textContent = 'Choose a purchase with remaining supply, or select No linked purchase.';
            }
            preview.classList.remove('hidden');
        }
    }
}

function updateCurrentSupplyDashboard() {
    const mainId = getMainSubstanceId() || (!isAllSubstancesView() ? currentSubstanceId : null);
    const set = (id, text) => { const el = document.getElementById(id); if (el) el.textContent = text; };
    if (!mainId) {
        set('dash-supply-total', '—');
        set('dash-supply-remaining', '—');
        set('dash-supply-days-left', '—');
        set('dash-supply-last-buy-date', '—');
        set('dash-supply-last-used', '—');
        set('dash-supply-since-last-use', '—');
        return;
    }
    const sub = getSubstance(mainId);
    const unit = sub?.defaultUnit || 'units';
    const totalRemaining = getTotalRemainingSupply(mainId);
    const purchases = (appData.purchases || [])
        .filter(p => getPurchaseSubstanceId(p) === mainId)
        .sort((a, b) => getPurchaseDatetimeMs(b) - getPurchaseDatetimeMs(a));
    const lastPurchase = purchases[0] || null;
    const dailyAvg = getAverageDailyUse(mainId);

    const remainingLabel = `${totalRemaining.toFixed(1)} ${unit}`;
    set('dash-supply-total', remainingLabel);
    set('dash-supply-remaining', remainingLabel);

    if (dailyAvg > 0 && totalRemaining > 0) {
        set('dash-supply-days-left', `~${Math.round(totalRemaining / dailyAvg)} days`);
    } else {
        set('dash-supply-days-left', '—');
    }

    if (lastPurchase) {
        const store = lastPurchase.store || lastPurchase.location || '';
        set('dash-supply-last-buy-date', `${formatDate(lastPurchase.date)}${store ? ` · ${store}` : ''}`);
    } else {
        set('dash-supply-last-buy-date', '—');
    }

    const currentBag = getOldestActivePurchase(mainId);
    if (currentBag) {
        const bagMetrics = getPurchaseSupplyMetrics(currentBag);
        set('dash-supply-last-used', bagMetrics.lastSupplyUseAt
            ? formatDatetimeShort(bagMetrics.lastSupplyUseAt)
            : 'Never');
        set('dash-supply-since-last-use', bagMetrics.timeSinceLastSupplyUse != null
            ? formatTimeSinceMs(bagMetrics.timeSinceLastSupplyUse)
            : '—');
    } else {
        set('dash-supply-last-used', '—');
        set('dash-supply-since-last-use', '—');
    }
}

function updateGiftMetricsDashboard() {
    const set = (id, text) => { const el = document.getElementById(id); if (el) el.textContent = text; };
    const substanceId = isAllSubstancesView() ? getMainSubstanceId() : currentSubstanceId;
    if (!substanceId) {
        set('dash-gift-given', '—');
        set('dash-gift-received', '—');
        set('dash-gift-net', 'Net: —');
        return;
    }
    const sub = getSubstance(substanceId);
    const unit = sub?.defaultUnit || 'units';
    const metrics = getGiftMetrics(substanceId);
    set('dash-gift-given', `${metrics.given.toFixed(1)}${unit}`);
    set('dash-gift-received', `${metrics.received.toFixed(1)}${unit}`);
    const netLabel = metrics.net >= 0 ? `+${metrics.net.toFixed(1)}` : metrics.net.toFixed(1);
    set('dash-gift-net', `Net: ${netLabel}${unit}`);
}

function refreshTaperDashboard() {
    renderTaperPlan();
    checkTaperTarget();
    updateTaperProgress();
    renderHistory();
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
    setInputValue('use-gift-party', entry.giftPartyName || '');
    setUseTransactionType(getLogTransactionType(entry));
    if (isInventoryAdjustmentLog(entry)) {
        setUseAdjustmentDirection(getAdjustmentDirection(entry));
    }

    if (!hasLinkedSupply(entry) && !logInventoryAffects(entry)) {
        setUsePurchaseLinkMode('none');
    } else if (hasLinkedSupply(entry)) {
        setUsePurchaseLinkMode('manual');
        const select = document.getElementById('use-purchase-select');
        updateUsePurchaseLinkUI();
        if (select) {
            const linkedId = entry.linkedPurchaseId != null && entry.linkedPurchaseId !== ''
                ? entry.linkedPurchaseId
                : entry.linkedPurchases?.[0]?.purchaseId;
            if (linkedId != null && linkedId !== '') {
                const match = [...select.options].find(o => String(o.value) === String(linkedId));
                if (match) select.value = match.value;
            }
        }
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
    setUseTransactionType('use');
    setUseAdjustmentDirection('add');
}

function getUseLogsForSubstance(substanceId, { sortAsc = true, personalUseOnly = false, data = appData } = {}) {
    let list = getUseEntries(data).filter(l => {
        if (!logMatchesSubstance(l, substanceId, data)) return false;
        if (personalUseOnly && !isPersonalUseLog(l)) return false;
        return true;
    });
    list = [...list].sort((a, b) => {
        const da = getLogDatetimeMs(a);
        const db = getLogDatetimeMs(b);
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
    const isGift = !isPersonalUseLog(entry);
    const isSession = !isGift && (entry.type === 'session' || !!entry.endTime);
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
    let breakDurationHours = entry.breakHours != null ? entry.breakHours : null;
    if (breakDurationHours == null && entry.breakMinutes != null) {
        breakDurationHours = entry.breakMinutes / 60;
    }
    if (breakDurationHours == null && !isGift && previousEntry && isPersonalUseLog(previousEntry) && start) {
        const prevEnd = getUseEndDatetime(previousEntry);
        if (prevEnd) {
            const gapMs = start - prevEnd;
            if (gapMs >= 0) {
                timeBetweenHours = gapMs / 3600000;
                breakDurationHours = gapMs / 3600000;
            }
        }
    } else if (breakDurationHours != null) {
        timeBetweenHours = breakDurationHours;
    }

    return {
        ...entry,
        type: entry.type || (entry.endTime ? 'session' : 'quick'),
        durationHours,
        useRate,
        timeBetweenHours,
        breakDurationHours,
        breakMinutes: entry.breakMinutes,
        breakText: entry.breakText,
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

function renderBreakSincePreviousCell(entry) {
    const hours = entry.breakHours ?? entry.breakDurationHours;
    const text = entry.breakText || (hours != null ? formatBreakFromHours(hours) : '—');
    if (text === '—' || hours == null) return '—';
    return `<span class="break-cell ${getBreakColorClass(hours)}">${text}</span>`;
}

function getUseRowWarnings(entry, substanceId, avgRate) {
    const warnings = [];
    if (!isPersonalUseLog(entry)) return warnings;
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
    document.querySelectorAll('.use-entry-toggle-btn, .type-toggle-btn').forEach(btn => {
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
    const transactionType = document.getElementById('use-transaction-type')?.value || 'use';
    if (!isPersonalUseLog({ transactionType })) {
        el.classList.add('hidden');
        return;
    }
    const substanceId = document.getElementById('use-substance')?.value;
    const amount = parseFloat(document.getElementById('use-amount')?.value) || 0;
    const entryDate = document.getElementById('use-date')?.value
        || new Date().toISOString().split('T')[0];
    if (!substanceId) {
        el.classList.add('hidden');
        return;
    }
    const sub = getSubstance(substanceId);
    const limit = getDailyLimitForDate(substanceId, entryDate);
    if (!sub?.taperTrackingEnabled || limit == null) {
        el.classList.add('hidden');
        return;
    }

    const excludeId = editingUseId || null;
    const used = getUsedAmountForDate(substanceId, entryDate, excludeId);
    const projected = used + amount;
    const unit = sub.defaultUnit;
    const isEditing = excludeId != null;
    const today = new Date().toISOString().split('T')[0];
    const existing = isEditing ? findUseEntry(excludeId) : null;

    if (isEditing && existing
        && logMatchesSubstance(existing, substanceId)
        && existing.date === entryDate) {
        const originalAmount = parseFloat(existing.amount) || 0;
        if (Math.abs(amount - originalAmount) < 0.001) {
            el.classList.remove('hidden');
            el.className = 'use-taper-banner use-taper-banner-ok';
            el.textContent = `Editing entry: ${projected.toFixed(1)} / ${limit} ${unit} for that day.`;
            return;
        }
    }

    el.classList.remove('hidden');
    const dayPhrase = isEditing ? 'that day' : (entryDate === today ? 'today' : 'that day');

    if (projected > limit) {
        el.className = 'use-taper-banner use-taper-banner-warn';
        el.textContent = isEditing
            ? `Editing this entry would put that day at ${projected.toFixed(1)} / ${limit} ${unit}.`
            : `This entry would put ${dayPhrase} at ${projected.toFixed(1)} / ${limit} ${unit}.`;
    } else if (projected >= limit * 0.8) {
        el.className = 'use-taper-banner use-taper-banner-close';
        el.textContent = isEditing
            ? `Editing this entry would put that day at ${projected.toFixed(1)} / ${limit} ${unit}.`
            : `This entry would put ${dayPhrase} at ${projected.toFixed(1)} / ${limit} ${unit}.`;
    } else {
        el.className = 'use-taper-banner use-taper-banner-ok';
        const remaining = Math.max(0, limit - projected);
        el.textContent = `${remaining.toFixed(1)} ${unit} remaining (${projected.toFixed(1)} / ${limit} ${unit}).`;
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
        transactionType: 'use',
        substanceId,
        amount: 1,
        unit: sub.defaultUnit,
        date: now.toISOString().split('T')[0],
        startTime: now.toTimeString().slice(0, 5),
        time: now.toTimeString().slice(0, 5),
        notes: '',
        linkedPurchaseId,
        linkedPurchases: [],
        supplyUnlinked: !linkedPurchaseId,
        inventoryAffects: !!linkedPurchaseId,
        timestamp: now.toISOString(),
        createdAt: now.toISOString(),
        updatedAt: now.toISOString()
    };

    if (linkedPurchaseId) {
        const deduct = deductPurchaseAmount(linkedPurchaseId, 1);
        if (!deduct.ok) {
            log.linkedPurchaseId = null;
            log.linkedPurchases = [];
            log.supplyUnlinked = true;
            log.inventoryAffects = false;
        }
    }

    snapshotBestStreakBeforeUse(substanceId);
    if (!Array.isArray(appData.logs)) appData.logs = [];
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
    const entries = getUseEntries();
    if (!entries.length) return alert('No use entries to undo');
    if (confirm('Undo last use entry?')) {
        const last = entries[entries.length - 1];
        if (last) restoreLogSupplyLinks(last);
        if (!Array.isArray(appData.logs)) appData.logs = [];
        appData.logs = getUseEntries().filter(l => l.id !== last.id && String(l.id) !== String(last.id));
        saveData(appData);
        updateDashboard();
        renderRecentUseList();
        renderUseHistoryTable();
        refreshTaperDashboard();
        refreshBuyTrackerRelatedViews();
    }
}

function getUseSaveSuccessMessage(entry) {
    if (isGiftGivenLog(entry)) return 'Gift given recorded!';
    if (isGiftReceivedLog(entry)) return 'Gift received recorded!';
    if (isInventoryAdjustmentLog(entry)) return 'Inventory adjustment saved!';
    return entry.type === 'session' ? 'Session saved!' : 'Use logged!';
}

function getUseUpdateSuccessMessage(entry) {
    if (isGiftGivenLog(entry)) return 'Gift given updated!';
    if (isGiftReceivedLog(entry)) return 'Gift received updated!';
    if (isInventoryAdjustmentLog(entry)) return 'Inventory adjustment updated!';
    return entry.type === 'session' ? 'Session updated!' : 'Entry updated!';
}

function handleUseLogSubmit(e) {
    e.preventDefault();
    const payload = buildUseEntryFromForm();
    const { substanceId, amount, type, transactionType } = payload;
    const isPersonalUse = isPersonalUseLog({ transactionType });
    const eventTimestamp = getUseEventTimestamp(payload.date, payload.startTime);
    const now = new Date().toISOString();

    if (!confirmTaperBeforeLog(substanceId, amount, type === 'quick', editingUseId, transactionType, payload.date)) return;

    if (editingUseId != null) {
        const existing = findUseEntry(editingUseId);
        const idx = getUseEntries().findIndex(l => l.id === editingUseId || String(l.id) === String(editingUseId));
        if (!existing || idx < 0) {
            alert('Could not find the entry to update.');
            cancelUseEdit();
            return;
        }
        const priorState = JSON.parse(JSON.stringify(existing));
        restoreLogInventoryEffect(existing);
        const updated = {
            ...existing,
            ...payload,
            id: editingUseId,
            substanceId: payload.substanceId,
            linkedPurchaseId: payload.inventoryAffects ? payload.linkedPurchaseId : null,
            linkedPurchases: payload.inventoryAffects ? (payload.linkedPurchases || []) : [],
            inventoryAffects: payload.inventoryAffects,
            supplyUnlinked: !payload.inventoryAffects,
            createdAt: getUseCreatedAt(existing),
            updatedAt: now,
            timestamp: eventTimestamp
        };
        stripLegacyUseLogFields(updated);
        delete updated.substance;
        delete updated.lines;

        const inv = applyLogInventoryEffect(updated);
        if (!inv.ok) {
            applyExistingLogLinks(priorState, appData.purchases || []);
            Object.assign(existing, priorState);
            return alert(inv.error);
        }

        appData.logs[idx] = updated;
        refreshAfterLogLinkChange(substanceId);
        resetUseFormAfterSave();
        populateAllSubstanceDropdowns();
        if (isPersonalUse && payload.date === new Date().toISOString().split('T')[0]) {
            notifyTaperAfterLog(substanceId);
        }
        alert(getUseUpdateSuccessMessage(updated));
        return;
    }

    if (isPersonalUse) snapshotBestStreakBeforeUse(substanceId);
    const log = {
        ...payload,
        id: Date.now(),
        createdAt: now,
        updatedAt: now,
        timestamp: eventTimestamp
    };
    stripLegacyUseLogFields(log);

    const inv = applyLogInventoryEffect(log);
    if (!inv.ok) return alert(inv.error);

    if (!Array.isArray(appData.logs)) appData.logs = [];
    appData.logs.push(log);
    saveData(appData);
    resetUseFormAfterSave();
    populateAllSubstanceDropdowns();
    refreshUseLogRelatedViews();
    if (isPersonalUse) notifyTaperAfterLog(substanceId);
    alert(getUseSaveSuccessMessage(log));
}

function deleteUseEntry(id) {
    if (!confirm('Delete this entry?')) return;
    const entry = findUseEntry(id);
    if (editingUseId === id) cancelUseEdit();
    if (entry) restoreLogSupplyLinks(entry);
    appData.logs = getUseEntries().filter(l => l.id !== id && String(l.id) !== String(id));
    saveData(appData);
    refreshUseLogRelatedViews();
}

function renderUseLogTab() {
    updateUseTaperPreview();
    renderRecentUseList();
    renderUseHistoryTable();
}

let bulkLinkPending = null;
const useHistorySelection = new Set();

function useHistorySelectionHas(id) {
    if (useHistorySelection.has(id)) return true;
    return [...useHistorySelection].some(sid => String(sid) === String(id));
}

function buildUseHistoryRows() {
    console.log('[use-history] logs', appData.logs?.length, 'useLogs', appData.useLogs?.length);
    const entries = getUseEntries();
    console.log('[use-history] getUseEntries', entries.length);

    const filterId = isAllSubstancesView() ? null : currentSubstanceId;
    let substances = filterId ? [getSubstance(filterId)].filter(Boolean) : getLoggableSubstances();

    if (filterId && !substances.length && entries.length) {
        substances = getLoggableSubstances();
    }

    let allRows = [];
    substances.forEach(sub => {
        const enriched = buildEnrichedUseEntries(sub.id);
        const avgRate = (() => {
            const rates = enriched
                .filter(e => isPersonalUseLog(e))
                .map(e => e.useRate)
                .filter(r => r != null && r > 0);
            return rates.length ? rates.reduce((a, b) => a + b, 0) / rates.length : null;
        })();
        enriched.forEach(entry => allRows.push({ entry, sub, avgRate }));
    });

    if (!allRows.length && entries.length && filterId) {
        const matched = entries.filter(l => logMatchesSubstance(l, filterId));
        const sub = getSubstance(filterId) || {
            id: filterId,
            name: getSubstanceName(filterId),
            icon: '📦',
            defaultUnit: 'units',
            color: '#888'
        };
        const enriched = [];
        const sorted = [...matched].sort((a, b) => getLogDatetimeMs(a) - getLogDatetimeMs(b));
        sorted.forEach((entry, i) => {
            enriched.push(enrichUseEntry(entry, i > 0 ? enriched[i - 1] : null));
        });
        const avgRate = (() => {
            const rates = enriched.map(e => e.useRate).filter(r => r != null && r > 0);
            return rates.length ? rates.reduce((a, b) => a + b, 0) / rates.length : null;
        })();
        enriched.forEach(entry => allRows.push({ entry, sub, avgRate }));
    }

    allRows.sort((a, b) => {
        const da = new Date(a.entry.startDatetime || a.entry.timestamp || 0);
        const db = new Date(b.entry.startDatetime || b.entry.timestamp || 0);
        return db - da;
    });
    return allRows;
}

function getVisibleUseHistoryLogIds() {
    return buildUseHistoryRows().map(({ entry }) => entry.id);
}

function updateUseHistorySelectionUI() {
    const countEl = document.getElementById('use-history-selected-count');
    if (countEl) countEl.textContent = `${useHistorySelection.size} selected`;
    const btn = document.getElementById('manual-link-selected-btn');
    if (btn) btn.disabled = useHistorySelection.size === 0;
}

function syncUseHistorySelectAllCheckbox() {
    const selectAll = document.getElementById('use-history-select-all');
    if (!selectAll) return;
    const visibleIds = getVisibleUseHistoryLogIds();
    if (!visibleIds.length) {
        selectAll.checked = false;
        selectAll.indeterminate = false;
        return;
    }
    const selectedVisible = visibleIds.filter(id => useHistorySelectionHas(id)).length;
    selectAll.checked = selectedVisible === visibleIds.length;
    selectAll.indeterminate = selectedVisible > 0 && selectedVisible < visibleIds.length;
}

function clearUseHistorySelection() {
    useHistorySelection.clear();
    document.querySelectorAll('.use-history-row-cb').forEach(cb => { cb.checked = false; });
    const selectAll = document.getElementById('use-history-select-all');
    if (selectAll) {
        selectAll.checked = false;
        selectAll.indeterminate = false;
    }
    updateUseHistorySelectionUI();
}

function populateManualLinkSubstanceDropdown() {
    const select = document.getElementById('manual-link-substance');
    if (!select) return;
    const subs = getLoggableSubstances();
    const selectedIds = [...useHistorySelection];
    const substanceIdsInSelection = new Set(
        selectedIds
            .map(id => findUseEntry(id))
            .filter(Boolean)
            .map(l => getUseSubstanceId(l))
    );

    select.innerHTML = '';
    subs.forEach(sub => {
        const opt = document.createElement('option');
        opt.value = sub.id;
        opt.textContent = `${sub.icon} ${sub.name}`;
        select.appendChild(opt);
    });

    let defaultId = currentSubstanceId;
    if (!isAllSubstancesView() && subs.some(s => s.id === currentSubstanceId)) {
        defaultId = currentSubstanceId;
    } else if (substanceIdsInSelection.size === 1) {
        defaultId = [...substanceIdsInSelection][0];
    } else if (subs.length) {
        defaultId = subs[0].id;
    }
    if (defaultId && [...select.options].some(o => o.value === defaultId)) {
        select.value = defaultId;
    }
}

function populateManualLinkPurchaseDropdown(substanceId) {
    const select = document.getElementById('manual-link-purchase');
    if (!select) return;
    const purchases = getPurchasesForManualLink(substanceId);
    const currentVal = select.value;
    select.innerHTML = '<option value="">Select a purchase…</option>';
    purchases.forEach(p => {
        const opt = document.createElement('option');
        opt.value = p.id;
        opt.textContent = formatPurchaseOptionLabel(p);
        select.appendChild(opt);
    });
    if (currentVal && [...select.options].some(o => String(o.value) === String(currentVal))) {
        select.value = currentVal;
    } else if (purchases.length) {
        select.value = purchases[0].id;
    }
}

function updateManualBulkLinkModalSummary() {
    const substanceId = getManualBulkLinkSubstanceId();
    const selectedLogs = getSelectedLogsForManualLink(substanceId);
    const totalAmount = selectedLogs.reduce((s, l) => s + (parseFloat(l.amount) || 0), 0);
    const unit = selectedLogs[0]?.unit || getSubstance(substanceId)?.defaultUnit || 'units';

    setText('manual-link-session-count', String(selectedLogs.length));
    setText('manual-link-total-amount', selectedLogs.length
        ? `${totalAmount.toFixed(2)} ${unit}`
        : '—');

    const previewEl = document.getElementById('manual-link-preview');
    const purchaseId = getManualBulkLinkPurchaseId();
    if (!previewEl) return;

    if (!purchaseId) {
        previewEl.innerHTML = '<p class="empty-hint">Choose a purchase to preview.</p>';
        return;
    }

    const stats = buildManualBulkLinkPreviewStats(
        appData,
        [...useHistorySelection],
        purchaseId,
        getManualBulkLinkOptionsFromUI()
    );
    previewEl.innerHTML = formatManualBulkLinkPreview(stats);
}

function openManualBulkLinkModal() {
    if (!useHistorySelection.size) {
        alert('Select at least one session in Use History.');
        return;
    }

    populateManualLinkSubstanceDropdown();
    const substanceId = getManualBulkLinkSubstanceId();
    if (substanceId) populateManualLinkPurchaseDropdown(substanceId);
    updateManualBulkLinkModalSummary();

    document.getElementById('manual-bulk-link-modal')?.classList.remove('hidden');
}

function closeManualBulkLinkModal() {
    document.getElementById('manual-bulk-link-modal')?.classList.add('hidden');
}

function applyManualBulkLink() {
    const purchaseId = getManualBulkLinkPurchaseId();
    if (!purchaseId) {
        alert('Select a purchase to link.');
        return;
    }
    if (!useHistorySelection.size) {
        alert('No sessions selected.');
        return;
    }

    const options = getManualBulkLinkOptionsFromUI();
    const selectedLogIds = [...useHistorySelection];
    const substanceId = getManualBulkLinkSubstanceId() || getPurchaseSubstanceId(findPurchase(purchaseId));
    const result = runManualBulkLinkOnData(appData, selectedLogIds, purchaseId, options);
    if (typeof result === 'string') {
        alert(result);
        return;
    }

    console.log('[manual-link] updated logs',
        selectedLogIds.map(id => appData.logs.find(l => String(l.id) === String(id)))
    );

    closeManualBulkLinkModal();
    clearUseHistorySelection();
    refreshAfterLogLinkChange(substanceId);
    updateLastSavedDisplay();

    const { stats } = result;
    const unit = stats.unit || 'units';
    let msg = `Linked ${stats.sessionCount} session(s) (${stats.totalAmount.toFixed(2)} ${unit}).`;
    if (stats.overdraw > INVENTORY_EPS) {
        msg += ` Overdraw: ${stats.overdraw.toFixed(2)} ${unit}.`;
    }
    alert(msg);
}

function setupManualBulkLinkListeners() {
    document.getElementById('use-history-clear-selection')?.addEventListener('click', clearUseHistorySelection);

    document.getElementById('use-history-select-all')?.addEventListener('change', e => {
        const visibleIds = getVisibleUseHistoryLogIds();
        if (e.target.checked) {
            visibleIds.forEach(id => useHistorySelection.add(id));
        } else {
            visibleIds.forEach(id => useHistorySelection.delete(id));
        }
        renderUseHistoryTable();
    });

    document.getElementById('use-history-table-wrap')?.addEventListener('change', e => {
        if (!e.target.classList.contains('use-history-row-cb')) return;
        const idRaw = e.target.dataset.logId;
        const id = parsePurchaseSelectId(idRaw);
        if (id == null) return;
        if (e.target.checked) useHistorySelection.add(id);
        else useHistorySelection.delete(id);
        updateUseHistorySelectionUI();
        syncUseHistorySelectAllCheckbox();
    });

    const modal = document.getElementById('manual-bulk-link-modal');
    if (!modal) return;

    ['manual-link-substance', 'manual-link-purchase', 'manual-link-reset', 'manual-link-overdraw', 'manual-link-split']
        .forEach(id => {
            document.getElementById(id)?.addEventListener('change', () => {
                if (id === 'manual-link-substance') {
                    const substanceId = getManualBulkLinkSubstanceId();
                    if (substanceId) populateManualLinkPurchaseDropdown(substanceId);
                }
                updateManualBulkLinkModalSummary();
            });
        });
}

function runBulkInventoryLink(data, mode) {
    const working = JSON.parse(JSON.stringify(data));
    migrateUseLogsToLogs(working);
    const purchases = working.purchases || [];
    const logs = working.logs || [];
    resetAllPurchaseInventory(purchases);

    const stats = {
        linked: 0,
        purchasesMatched: new Set(),
        unmatched: 0,
        processed: 0,
        cleared: 0
    };

    if (mode === 'clear') {
        logs.forEach(log => {
            delete log.linkedPurchaseId;
            delete log.linkedPurchases;
            log.supplyUnlinked = true;
        });
        stats.cleared = logs.length;
        purchases.forEach(finalizePurchaseRemainingState);
        return {
            data: working,
            stats: {
                linked: 0,
                purchasesMatched: 0,
                unmatched: 0,
                processed: logs.length,
                cleared: stats.cleared
            }
        };
    }

    const sortedLogs = [...logs].sort((a, b) => getLogDatetimeMs(a) - getLogDatetimeMs(b));

    sortedLogs.forEach(log => {
        const amount = parseFloat(log.amount) || 0;
        if (amount <= INVENTORY_EPS) return;

        stats.processed++;

        if (mode === 'unlinked_only' && !logIsUnlinked(log)) {
            applyExistingLogLinks(log, purchases).forEach(id => stats.purchasesMatched.add(id));
            return;
        }

        if (mode === 'all') {
            delete log.linkedPurchaseId;
            delete log.linkedPurchases;
        }

        const wasUnlinked = logIsUnlinked(log);
        const result = fifoLinkLogToPurchases(log, purchases);

        if (result.purchaseIds.length) {
            result.purchaseIds.forEach(id => stats.purchasesMatched.add(id));
            if (mode === 'all' || wasUnlinked) stats.linked++;
        }
        if (result.unmatched) stats.unmatched++;
    });

    purchases.forEach(finalizePurchaseRemainingState);

    return {
        data: working,
        stats: {
            linked: stats.linked,
            purchasesMatched: stats.purchasesMatched.size,
            unmatched: stats.unmatched,
            processed: stats.processed,
            cleared: 0
        }
    };
}

function formatBulkLinkSummary(stats, mode) {
    if (mode === 'clear') {
        return `
            <p>Cleared links on <strong>${stats.cleared}</strong> session(s).</p>
            <p>Purchase inventory reset to full quantity bought.</p>
        `;
    }
    const label = mode === 'unlinked_only' ? 'session(s)' : 'session(s)';
    return `
        <ul class="bulk-link-summary-list">
            <li>Linked <strong>${stats.linked}</strong> ${label}</li>
            <li>Matched <strong>${stats.purchasesMatched}</strong> purchase(s)</li>
            <li><strong>${stats.unmatched}</strong> session(s) could not be fully matched</li>
        </ul>
        <p class="settings-hint">Inventory will be recalculated from oldest purchases first (FIFO).</p>
    `;
}

function startBulkLinkSessions(mode) {
    const titles = {
        all: 'Auto Link Sessions',
        unlinked_only: 'Link Unlinked Only',
        clear: 'Clear All Links'
    };
    const result = runBulkInventoryLink(appData, mode);
    bulkLinkPending = { mode, result };

    const titleEl = document.getElementById('bulk-link-modal-title');
    const summaryEl = document.getElementById('bulk-link-summary');
    const modal = document.getElementById('bulk-link-modal');
    if (titleEl) titleEl.textContent = titles[mode] || 'Bulk Link Preview';
    if (summaryEl) summaryEl.innerHTML = formatBulkLinkSummary(result.stats, mode);
    modal?.classList.remove('hidden');
}

function closeBulkLinkModal() {
    document.getElementById('bulk-link-modal')?.classList.add('hidden');
    bulkLinkPending = null;
}

function applyBulkLinkPreview() {
    if (!bulkLinkPending) return;
    const { mode, result } = bulkLinkPending;
    appData.logs = result.data.logs;
    appData.purchases = result.data.purchases;
    saveData(appData);
    closeBulkLinkModal();
    refreshUseLogRelatedViews();
    updateCurrentSupplyDashboard();
    const msg = mode === 'clear'
        ? `Cleared links on ${result.stats.cleared} session(s). Inventory reset.`
        : `Linked ${result.stats.linked} session(s). ${result.stats.unmatched} could not be fully matched.`;
    alert(msg);
}

function getUseLogBadgeInfo(log) {
    const tx = getLogTransactionType(log);
    if (tx === 'gift_given') return { label: 'Gift Given', className: 'badge-gift-given' };
    if (tx === 'gift_received') return { label: 'Gift Received', className: 'badge-gift-received' };
    if (tx === 'inventory_adjustment') return { label: 'Adjustment', className: 'badge-inventory' };
    if (getUseLogType(log) === 'session') return { label: 'Session', className: 'badge-session' };
    return { label: 'Quick Use', className: 'badge-quick' };
}

function renderUseLogBadge(log) {
    const { label, className } = getUseLogBadgeInfo(log);
    return `<span class="use-log-badge ${className}">${label}</span>`;
}

function renderUseHistoryCard(entry, sub, avgRate) {
    const warnings = getUseRowWarnings(entry, sub.id, avgRate);
    const rateStr = entry.useRate != null ? `${entry.useRate.toFixed(2)}/${sub.defaultUnit}/hr` : '—';
    const checked = useHistorySelectionHas(entry.id) ? 'checked' : '';
    const timeRange = entry.endTime
        ? `${entry.startTime || entry.time || '—'} – ${entry.endTime}`
        : (entry.startTime || entry.time || '—');
    const countStr = entry.count || '—';
    const warningClass = warnings.length ? ` ${warnings.join(' ')}` : '';

    return `<article class="use-history-card${warningClass}" data-log-id="${entry.id}">
        <div class="use-history-card-top">
            <label class="use-history-card-check">
                <input type="checkbox" class="use-history-row-cb" data-log-id="${entry.id}" aria-label="Select entry" ${checked}>
            </label>
            <div class="use-history-card-main">
                <div class="use-history-card-title-row">
                    ${renderUseLogBadge(entry)}
                    <span class="use-history-card-amount">${entry.amount} ${entry.unit}</span>
                </div>
                <div class="use-history-card-meta">${sub.icon} ${sub.name} · ${formatDate(entry.date)} · ${timeRange}</div>
            </div>
        </div>
        <dl class="use-history-card-details">
            <div><dt>Duration</dt><dd>${formatDurationHours(entry.durationHours)}</dd></div>
            <div><dt>Count</dt><dd>${countStr}</dd></div>
            <div><dt>Rate</dt><dd>${rateStr}</dd></div>
            <div><dt>Break</dt><dd>${entry.breakText || '—'}</dd></div>
            <div class="use-history-card-supply"><dt>Supply</dt><dd>${formatInventoryLinkDisplay(entry)}</dd></div>
            ${entry.notes ? `<div class="use-history-card-notes"><dt>Notes</dt><dd>${entry.notes}</dd></div>` : ''}
        </dl>
        <div class="use-history-card-actions">
            <button type="button" class="secondary-btn" onclick="editUseEntry(${entry.id})">Edit</button>
            <button type="button" class="delete-btn" onclick="deleteUseEntry(${entry.id})">Delete</button>
        </div>
    </article>`;
}

function renderRecentUseList() {
    const container = document.getElementById('recent-use-list');
    if (!container) return;
    container.innerHTML = '';
    const recent = [...getUseEntries()].sort((a, b) =>
        new Date(b.timestamp || `${b.date}T${b.startTime || b.time}`) -
        new Date(a.timestamp || `${a.date}T${a.startTime || a.time}`)
    ).slice(0, 5);
    if (!recent.length) {
        container.innerHTML = '<p class="empty-hint">No use entries yet</p>';
        applyCollapsedSections();
        return;
    }
    recent.forEach(log => {
        const substanceId = getUseSubstanceId(log);
        const sub = getSubstance(substanceId);
        const enriched = enrichUseEntry(log, null);
        const countStr = getUseCount(log);
        const timeRange = log.endTime
            ? `${log.startTime || log.time || ''}–${log.endTime}`
            : (log.startTime || log.time || '');
        const item = document.createElement('div');
        item.className = 'use-recent-card';
        item.innerHTML = `
            <div class="use-recent-main">
                <div class="use-recent-top">
                    ${renderUseLogBadge(log)}
                    <span class="use-recent-amount">${log.amount ?? '—'} ${log.unit || ''}</span>
                </div>
                <div class="use-recent-sub">${sub?.icon || ''} ${sub?.name || 'Unknown'} · ${formatDate(log.date || '')}${timeRange ? ` · ${timeRange}` : ''}</div>
                ${enriched.durationHours ? `<div class="use-recent-detail">${formatDurationHours(enriched.durationHours)}</div>` : ''}
                ${countStr !== '' ? `<div class="use-recent-detail">${countStr} lines</div>` : ''}
                ${log.notes ? `<div class="use-recent-notes">${log.notes}</div>` : ''}
                <div class="use-recent-supply">${formatInventoryLinkDisplay(log)}</div>
            </div>
            <div class="use-recent-actions">
                <button type="button" class="secondary-btn" onclick="editUseEntry(${log.id})">Edit</button>
                <button type="button" class="delete-btn" onclick="deleteUseEntry(${log.id})">Del</button>
            </div>
        `;
        container.appendChild(item);
    });
    applyCollapsedSections();
}

function renderUseHistoryTable() {
    const wrap = document.getElementById('use-history-table-wrap');
    if (!wrap) return;

    const allRows = buildUseHistoryRows();

    if (!allRows.length) {
        const hasEntries = getUseEntries().length > 0;
        wrap.innerHTML = hasEntries
            ? '<p class="empty-hint">No entries for the selected substance in this view.</p>'
            : '<p class="empty-hint">No entries yet. Log your first use above.</p>';
        updateUseHistorySelectionUI();
        syncUseHistorySelectAllCheckbox();
        applyCollapsedSections();
        return;
    }

    let tableHtml = `<div class="use-history-table-view table-scroll"><table class="session-table history-table use-history-table"><thead><tr>`;
    const useColumns = getEffectiveColumnOrder('useHistory');
    useColumns.forEach(colId => {
        tableHtml += renderUseHistoryHeaderCell(colId);
    });
    tableHtml += '</tr></thead><tbody>';

    let cardsHtml = '<div class="use-history-cards">';

    allRows.forEach(({ entry, sub, avgRate }) => {
        const warnings = getUseRowWarnings(entry, sub.id, avgRate);
        tableHtml += `<tr class="${warnings.join(' ')}">`;
        useColumns.forEach(colId => {
            tableHtml += renderUseHistoryBodyCell(colId, entry, sub, avgRate);
        });
        tableHtml += '</tr>';
        cardsHtml += renderUseHistoryCard(entry, sub, avgRate);
    });

    tableHtml += '</tbody></table></div>';
    cardsHtml += '</div>';

    const legendHtml = `<div class="session-legend use-history-legend">
        <span class="legend-high-rate">High rate</span>
        <span class="legend-short-break">Short break</span>
        <span class="legend-long-break">Long break</span>
        <span class="legend-taper-close">Near taper limit</span>
    </div>`;

    wrap.innerHTML = tableHtml + cardsHtml + legendHtml;
    updateUseHistorySelectionUI();
    syncUseHistorySelectAllCheckbox();
    applyCollapsedSections();
}

function getTodayUseStats(substanceId) {
    const today = new Date().toISOString().split('T')[0];
    const logs = filterLogsBySubstance(
        getUseEntries().filter(l => l.date === today && isPersonalUseLog(l)),
        substanceId
    );
    const enriched = logs.map(l => enrichUseEntry(l, null));
    const totalAmount = logs.reduce((s, l) => s + (parseFloat(l.amount) || 0), 0);
    const sessionDuration = enriched
        .filter(e => e.type === 'session' && e.durationHours)
        .reduce((s, e) => s + e.durationHours, 0);
    return { totalAmount, sessionDuration, logs };
}

function getTimeSinceLastUse(substanceId) {
    const logs = filterLogsBySubstance(getUseEntries().filter(isPersonalUseLog), substanceId);
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
    recalculateAllBuyBreaks();
    renderBuyTrackerTab();
    updateDashboard();
    updateStats();
    renderHistory();
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
    const linked = getLogsForPurchase(id);
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
    expandedPurchaseIds.delete(id);
    saveData(appData);
    refreshBuyTrackerRelatedViews();
    refreshUseLogRelatedViews();
}

function logMatchesPurchase(log, purchaseId) {
    if (log.linkedPurchaseId === purchaseId || String(log.linkedPurchaseId) === String(purchaseId)) return true;
    return Array.isArray(log.linkedPurchases)
        && log.linkedPurchases.some(lp => lp.purchaseId === purchaseId || String(lp.purchaseId) === String(purchaseId));
}

function getLogsForPurchase(purchaseId) {
    return getUseEntries().filter(log => logMatchesPurchase(log, purchaseId));
}

function getAmountUsedFromPurchase(log, purchaseId) {
    if (Array.isArray(log.linkedPurchases) && log.linkedPurchases.length) {
        const alloc = log.linkedPurchases.find(lp =>
            lp.purchaseId === purchaseId || String(lp.purchaseId) === String(purchaseId));
        return alloc ? parseFloat(alloc.amountUsed) || 0 : 0;
    }
    return parseFloat(log.amount) || 0;
}

function getLogActivityEndDatetime(log) {
    const end = getUseEndDatetime(log);
    if (end && !Number.isNaN(end.getTime())) return end;
    return parseUseDateTime(log.date, log.startTime || log.time);
}

function formatDatetimeShort(date) {
    if (!date || Number.isNaN(date.getTime())) return '—';
    return date.toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });
}

function formatTimeSinceMs(ms) {
    if (ms == null || ms < 0 || Number.isNaN(ms)) return '—';
    return formatBreakText(Math.floor(ms / 60000));
}

function formatDatetimeLong(date) {
    if (!date || Number.isNaN(date.getTime())) return '—';
    return date.toLocaleString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
        hour: 'numeric',
        minute: '2-digit'
    });
}

function escapeAttr(str) {
    return String(str || '')
        .replace(/&/g, '&amp;')
        .replace(/"/g, '&quot;')
        .replace(/</g, '&lt;');
}

function getLogSupplyStartDate(log) {
    return parseUseDateTime(log.date, log.startTime || log.time);
}

function computeSupplyDurationMetrics(logs) {
    if (!logs.length) {
        return {
            label: 'Unused',
            ms: null,
            tooltip: 'No linked use logs for this supply.'
        };
    }

    const firstStart = getLogSupplyStartDate(logs[0]);
    const lastEnd = getLogActivityEndDatetime(logs[logs.length - 1]);

    if (logs.length === 1) {
        const tooltip = [
            `First Use: ${formatDatetimeLong(firstStart)}`,
            `Last Use: ${formatDatetimeLong(lastEnd)}`,
            'Supply Duration: Single Use'
        ].join('\n');
        return { label: 'Single Use', ms: 0, tooltip, firstUseAt: firstStart, lastUseAt: lastEnd };
    }

    const firstMs = firstStart?.getTime();
    const lastMs = lastEnd?.getTime();
    const ms = firstMs != null && lastMs != null ? lastMs - firstMs : null;
    const label = ms != null && ms >= 0 ? formatTimeSinceMs(ms) : '—';
    const tooltip = [
        `First Use: ${formatDatetimeLong(firstStart)}`,
        `Last Use: ${formatDatetimeLong(lastEnd)}`,
        `Supply Duration: ${label}`
    ].join('\n');

    return {
        label,
        ms: ms != null && ms >= 0 ? ms : null,
        tooltip,
        firstUseAt: firstStart,
        lastUseAt: lastEnd
    };
}

function getPurchaseSupplyMetrics(purchase) {
    const purchaseId = purchase.id;
    const logs = getLogsForPurchase(purchaseId)
        .slice()
        .sort((a, b) => getLogDatetimeMs(a) - getLogDatetimeMs(b));
    const bought = getPurchaseQuantityBought(purchase);
    const remaining = getPurchaseRemainingAmount(purchase);
    let totalUsed = 0;
    logs.forEach(log => { totalUsed += getAmountUsedFromPurchase(log, purchaseId); });

    const firstLog = logs[0] || null;
    const lastLog = logs[logs.length - 1] || null;
    const firstUseAt = firstLog ? getLogSupplyStartDate(firstLog) : null;
    const lastSupplyUseAt = lastLog ? getLogActivityEndDatetime(lastLog) : null;
    const supplyDuration = computeSupplyDurationMetrics(logs);

    const purchaseMs = getPurchaseDatetimeMs(purchase);
    let timeFromBuyToFirstUse = null;
    if (purchaseMs && firstUseAt && !Number.isNaN(firstUseAt.getTime())) {
        const ms = firstUseAt.getTime() - purchaseMs;
        if (ms >= 0) timeFromBuyToFirstUse = ms;
    }

    let timeSinceLastSupplyUse = null;
    if (lastSupplyUseAt && !Number.isNaN(lastSupplyUseAt.getTime())) {
        const ms = Date.now() - lastSupplyUseAt.getTime();
        if (ms >= 0) timeSinceLastSupplyUse = ms;
    }

    return {
        quantityBought: bought,
        totalUsed,
        remaining,
        percentUsed: getPurchasePercentUsed(purchase),
        linkedSessionCount: logs.length,
        logs,
        firstLog,
        lastLog,
        firstUseAt,
        lastSupplyUseAt,
        timeFromBuyToFirstUse,
        timeSinceLastSupplyUse,
        supplyDurationLabel: supplyDuration.label,
        supplyDurationMs: supplyDuration.ms,
        supplyDurationTooltip: supplyDuration.tooltip
    };
}

function getSubstanceSupplyDurationStats(substanceId) {
    const purchases = substanceId
        ? getPurchasesForSubstance(substanceId, appData)
        : [...getPurchasesFiltered(null)];

    const durationMsList = [];
    purchases.forEach(purchase => {
        const metrics = getPurchaseSupplyMetrics(purchase);
        if (metrics.logs.length >= 2 && metrics.supplyDurationMs != null) {
            durationMsList.push(metrics.supplyDurationMs);
        }
    });

    const sortedPurchases = [...purchases].sort((a, b) => getPurchaseDatetimeMs(a) - getPurchaseDatetimeMs(b));
    const buyGapMs = [];
    for (let i = 1; i < sortedPurchases.length; i++) {
        const prevMs = getPurchaseDatetimeMs(sortedPurchases[i - 1]);
        const curMs = getPurchaseDatetimeMs(sortedPurchases[i]);
        if (prevMs && curMs) {
            const gap = curMs - prevMs;
            if (gap >= 0) buyGapMs.push(gap);
        }
    }

    const avgDaysBetweenPurchases = buyGapMs.length
        ? (buyGapMs.reduce((sum, ms) => sum + ms, 0) / buyGapMs.length) / 86400000
        : null;

    return {
        longestMs: durationMsList.length ? Math.max(...durationMsList) : null,
        averageMs: durationMsList.length
            ? durationMsList.reduce((sum, ms) => sum + ms, 0) / durationMsList.length
            : null,
        shortestMs: durationMsList.length ? Math.min(...durationMsList) : null,
        avgDaysBetweenPurchases,
        qualifyingCount: durationMsList.length
    };
}

function getSubstanceSupplyUseMetrics(substanceId) {
    if (!substanceId || substanceId === DASHBOARD_ALL) {
        return {
            lastSupplyUseAt: null,
            timeSinceLastSupplyUse: null,
            oldestActive: null,
            activeCount: 0
        };
    }

    const purchases = getPurchasesForSubstance(substanceId, appData);
    const active = getActivePurchasesForSubstance(substanceId);
    const oldestActive = getOldestActivePurchase(substanceId);

    let lastSupplyUseAt = null;
    purchases.forEach(purchase => {
        const { lastSupplyUseAt: at } = getPurchaseSupplyMetrics(purchase);
        if (at && !Number.isNaN(at.getTime()) && (!lastSupplyUseAt || at > lastSupplyUseAt)) {
            lastSupplyUseAt = at;
        }
    });

    let timeSinceLastSupplyUse = null;
    if (lastSupplyUseAt) {
        const ms = Date.now() - lastSupplyUseAt.getTime();
        if (ms >= 0) timeSinceLastSupplyUse = ms;
    }

    return { lastSupplyUseAt, timeSinceLastSupplyUse, oldestActive, activeCount: active.length };
}

function getTransactionTypeShortLabel(log) {
    const tx = getLogTransactionType(log);
    if (tx === 'gift_given') return 'Gift Given';
    if (tx === 'gift_received') return 'Gift Received';
    if (tx === 'inventory_adjustment') return 'Inventory Adjustment';
    return 'Use';
}

function renderPurchaseLinkedLogSummaryLine(log, purchaseId, unit) {
    const enriched = enrichUseEntry(log, null);
    const amount = getAmountUsedFromPurchase(log, purchaseId);
    const startTime = log.startTime || log.time || '';
    const endTime = log.endTime || '';
    const timeRange = endTime ? `${startTime}–${endTime}` : startTime;
    const count = getUseCount(log);
    const parts = [
        `${formatDate(log.date)} ${timeRange}`.trim(),
        `${amount}${unit}`
    ];
    if (count !== '' && count != null) parts.push(`${count} lines`);
    else if (enriched.durationHours) parts.push(formatDurationHours(enriched.durationHours));
    return parts.join(' · ');
}

function renderPurchaseLinkedLogsPanel(purchase) {
    const purchaseId = purchase.id;
    const unit = purchase.unit || 'units';
    const store = purchase.store || purchase.location || '';
    const metrics = getPurchaseSupplyMetrics(purchase);
    const header = `${formatDate(purchase.date)} purchase${store ? ` · ${store}` : ''} · ${metrics.quantityBought}${unit}`;

    const totalsHtml = `
        <div class="purchase-supply-totals">
            <div class="purchase-supply-stat"><span>Quantity bought</span><strong>${metrics.quantityBought}${unit}</strong></div>
            <div class="purchase-supply-stat"><span>Total used</span><strong>${metrics.totalUsed.toFixed(1)}${unit}</strong></div>
            <div class="purchase-supply-stat"><span>Remaining</span><strong>${metrics.remaining.toFixed(1)}${unit}</strong></div>
            <div class="purchase-supply-stat"><span>Percent used</span><strong>${metrics.percentUsed}%</strong></div>
            <div class="purchase-supply-stat"><span>Linked logs</span><strong>${metrics.linkedSessionCount}</strong></div>
            <div class="purchase-supply-stat"><span>Supply duration</span><strong>${metrics.supplyDurationLabel}</strong></div>
            <div class="purchase-supply-stat"><span>First use</span><strong>${metrics.firstUseAt ? formatDatetimeLong(metrics.firstUseAt) : 'Never'}</strong></div>
            <div class="purchase-supply-stat"><span>Last use</span><strong>${metrics.lastSupplyUseAt ? formatDatetimeLong(metrics.lastSupplyUseAt) : 'Never'}</strong></div>
            <div class="purchase-supply-stat"><span>Time since last use</span><strong>${metrics.timeSinceLastSupplyUse != null ? formatTimeSinceMs(metrics.timeSinceLastSupplyUse) : '—'}</strong></div>
            <div class="purchase-supply-stat"><span>Buy → first use</span><strong>${metrics.timeFromBuyToFirstUse != null ? formatTimeSinceMs(metrics.timeFromBuyToFirstUse) : '—'}</strong></div>
        </div>`;

    if (!metrics.logs.length) {
        return `<div class="purchase-linked-panel">
            <p class="purchase-linked-header">${header}</p>
            ${totalsHtml}
            <p class="empty-hint purchase-linked-empty">No linked use logs for this supply.</p>
        </div>`;
    }

    const summaryLines = metrics.logs.map(log =>
        `<li>${renderPurchaseLinkedLogSummaryLine(log, purchaseId, unit)}</li>`
    ).join('');

    let detailRows = '';
    metrics.logs.slice().reverse().forEach(log => {
        const enriched = enrichUseEntry(log, null);
        const amount = getAmountUsedFromPurchase(log, purchaseId);
        const count = getUseCount(log);
        detailRows += `<tr>
            <td>${formatDate(log.date)}</td>
            <td>${log.startTime || log.time || '—'}</td>
            <td>${log.endTime || '—'}</td>
            <td>${enriched.durationHours != null ? formatDurationHours(enriched.durationHours) : '—'}</td>
            <td>${amount}${unit}</td>
            <td>${count !== '' && count != null ? count : '—'}</td>
            <td>${getTransactionTypeShortLabel(log)}</td>
            <td>${formatInventoryLinkDisplay(log)}</td>
            <td class="session-notes-cell">${log.notes || ''}</td>
        </tr>`;
    });

    return `<div class="purchase-linked-panel">
        <p class="purchase-linked-header">${header}</p>
        ${totalsHtml}
        <div class="purchase-linked-used-by">
            <strong>Used by:</strong>
            <ul class="purchase-linked-summary-list">${summaryLines}</ul>
        </div>
        <div class="purchase-linked-detail-table-wrap session-table-scroll">
            <table class="session-table purchase-linked-logs-table">
                <thead><tr>
                    <th>Date</th><th>Start</th><th>End</th><th>Duration</th><th>Amount</th>
                    <th>Count</th><th>Type</th><th>Link</th><th>Notes</th>
                </tr></thead>
                <tbody>${detailRows}</tbody>
            </table>
        </div>
    </div>`;
}

function togglePurchaseLinkedLogs(purchaseId) {
    const id = typeof purchaseId === 'string' ? parseInt(purchaseId, 10) : purchaseId;
    if (expandedPurchaseIds.has(id)) expandedPurchaseIds.delete(id);
    else expandedPurchaseIds.add(id);

    const detail = document.getElementById(`purchase-detail-${id}`);
    const btn = document.querySelector(`[data-purchase-toggle="${id}"]`);
    const expanded = expandedPurchaseIds.has(id);
    if (detail) detail.classList.toggle('hidden', !expanded);
    if (btn) {
        btn.setAttribute('aria-expanded', expanded ? 'true' : 'false');
        btn.textContent = expanded ? 'Hide Linked Logs' : 'View Linked Logs';
    }
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

    return { spentToday, spentWeek, spentMonth, countWeek, countMonth, avgCostUnit, lastPurchase, daysSupply, purchases, cur,
        supplyUse: getSubstanceSupplyUseMetrics(substanceId && substanceId !== DASHBOARD_ALL ? substanceId : null),
        supplyDuration: getSubstanceSupplyDurationStats(substanceId) };
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

    const durationStats = stats.supplyDuration || getSubstanceSupplyDurationStats(filterId);
    set('buy-longest-supply-duration', durationStats.longestMs != null
        ? formatTimeSinceMs(durationStats.longestMs)
        : '—');
    set('buy-avg-supply-duration', durationStats.averageMs != null
        ? formatTimeSinceMs(durationStats.averageMs)
        : '—');
    set('buy-shortest-supply-duration', durationStats.shortestMs != null
        ? formatTimeSinceMs(durationStats.shortestMs)
        : '—');
    set('buy-avg-days-between-purchases', durationStats.avgDaysBetweenPurchases != null
        ? `~${durationStats.avgDaysBetweenPurchases.toFixed(1)} days`
        : '—');

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

    if (filterId) {
        const buyMetrics = getBuyBreakMetrics(filterId);
        set('buy-since-last', buyMetrics.timeSinceLastBuy?.text || '—');
        set('buy-break-longest', formatBuyBreakFromHours(buyMetrics.longest));
        set('buy-break-average', formatBuyBreakFromHours(buyMetrics.average));
        set('buy-break-shortest', formatBuyBreakFromHours(buyMetrics.shortest));
        set('buy-break-avg-30', formatBuyBreakFromHours(buyMetrics.avg30Days));
        set('buy-est-next', buyMetrics.estimatedNextBuy?.label || '—');
    } else {
        set('buy-since-last', 'Select substance');
        set('buy-break-longest', '—');
        set('buy-break-average', '—');
        set('buy-break-shortest', '—');
        set('buy-break-avg-30', '—');
        set('buy-est-next', '—');
        set('buy-last-supply-used', '—');
        set('buy-since-last-supply-use', '—');
        set('buy-oldest-active-supply', '—');
        set('buy-active-supplies-count', '—');
    }

    if (filterId) {
        const supplyUse = stats.supplyUse || getSubstanceSupplyUseMetrics(filterId);
        set('buy-last-supply-used', supplyUse.lastSupplyUseAt
            ? formatDatetimeShort(supplyUse.lastSupplyUseAt)
            : 'Never');
        set('buy-since-last-supply-use', supplyUse.timeSinceLastSupplyUse != null
            ? formatTimeSinceMs(supplyUse.timeSinceLastSupplyUse)
            : '—');
        if (supplyUse.oldestActive) {
            const store = supplyUse.oldestActive.store || supplyUse.oldestActive.location || '';
            set('buy-oldest-active-supply', `${formatDate(supplyUse.oldestActive.date)}${store ? ` · ${store}` : ''}`);
        } else {
            set('buy-oldest-active-supply', '—');
        }
        set('buy-active-supplies-count', String(supplyUse.activeCount));
    }

    renderBuySpendingTrend(filterId);
    renderPurchaseHistory(filterId);
    applyCollapsedSections();
}

function renderPurchaseHistory(substanceId) {
    const filterId = substanceId !== undefined
        ? substanceId
        : (isAllSubstancesView() ? null : currentSubstanceId);
    const container = document.getElementById('purchase-history-list')
        || document.getElementById('buy-history-table-wrap')
        || document.getElementById('purchase-history');

    console.log('[purchase-history] purchases', appData.purchases?.length);
    console.log('[purchase-history] container', container);

    if (!container) {
        console.error('[purchase-history] missing container');
        return;
    }

    if (!appData.purchases?.length) {
        container.innerHTML = '<p class="empty-hint">No purchases yet.</p>';
        applyCollapsedSections();
        return;
    }

    const purchases = filterId
        ? [...getPurchasesForSubstance(filterId, appData, { sortAsc: false })]
        : [...getPurchasesFiltered(null)].sort((a, b) => getPurchaseDatetimeMs(b) - getPurchaseDatetimeMs(a));

    if (!purchases.length) {
        container.innerHTML = '<p class="empty-hint">No purchases recorded</p>';
        applyCollapsedSections();
        return;
    }

    const cur = appData.settings.currency;
    const purchaseColumns = getEffectiveColumnOrder('purchaseHistory');
    let html = `<div class="table-scroll"><table class="session-table history-table purchase-history-table"><thead><tr>`;
    purchaseColumns.forEach(colId => {
        html += renderPurchaseHistoryHeaderCell(colId);
    });
    html += '</tr></thead><tbody>';

    purchases.forEach(purchase => {
        const purchaseSubstanceId = getPurchaseSubstanceId(purchase);
        const sub = getSubstance(purchaseSubstanceId);
        const totalNum = parseFloat(getPurchaseTotalCost(purchase)) || 0;
        const qtyNum = parseFloat(getPurchaseQuantity(purchase)) || 0;
        const cpu = purchase.costPerUnit ?? (qtyNum > 0 ? totalNum / qtyNum : 0);
        const store = purchase.store || purchase.location || '';
        const bought = getPurchaseQuantityBought(purchase);
        const remaining = getPurchaseRemainingAmount(purchase);
        const pctUsed = getPurchasePercentUsed(purchase);
        const supply = getPurchaseSupplyStatus(purchase);
        const unit = purchase.unit || 'units';
        const breakCell = renderBuyBreakSincePreviousCell(purchase);
        const metrics = getPurchaseSupplyMetrics(purchase);
        const supplyDurationLabel = metrics.supplyDurationLabel || 'Unused';
        const supplyDurationTooltip = escapeAttr(metrics.supplyDurationTooltip || '');
        const sinceLastUseLabel = metrics.timeSinceLastSupplyUse != null
            ? formatTimeSinceMs(metrics.timeSinceLastSupplyUse)
            : '—';
        const expanded = expandedPurchaseIds.has(purchase.id);
        const toggleLabel = expanded ? 'Hide Linked Logs' : 'View Linked Logs';
        const rowCtx = {
            purchase,
            sub,
            cur,
            store,
            bought,
            remaining,
            pctUsed,
            supply,
            unit,
            breakCell,
            supplyDurationLabel,
            supplyDurationTooltip,
            sinceLastUseLabel,
            totalNum,
            cpu,
            expanded,
            toggleLabel
        };

        html += '<tr class="purchase-history-row">';
        purchaseColumns.forEach(colId => {
            html += renderPurchaseHistoryBodyCell(colId, rowCtx);
        });
        html += '</tr>';
        html += `<tr id="purchase-detail-${purchase.id}" class="purchase-linked-detail${expanded ? '' : ' hidden'}">
            <td colspan="${purchaseColumns.length}">${renderPurchaseLinkedLogsPanel(purchase)}</td>
        </tr>`;
    });

    html += '</tbody></table></div>';
    container.innerHTML = html;
    applyCollapsedSections();
}

function renderBuyHistory(substanceId) {
    renderPurchaseHistory(substanceId);
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
    setupManualBulkLinkListeners();
    setupColumnSettingsModal();
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
function renderRecentActivity() {
    const container = document.getElementById('dash-recent-activity');
    if (!container) return;

    const sid = isAllSubstancesView() ? null : currentSubstanceId;
    const logs = sid
        ? getUseEntries().filter(l => logMatchesSubstance(l, sid))
        : getUseEntries();

    const lastUse = [...logs]
        .filter(isPersonalUseLog)
        .sort((a, b) => getLogDatetimeMs(b) - getLogDatetimeMs(a))[0] || null;

    const lastSession = [...logs]
        .filter(l => isPersonalUseLog(l) && (l.type === 'session' || l.endTime))
        .sort((a, b) => getLogDatetimeMs(b) - getLogDatetimeMs(a))[0] || null;

    const purchases = (appData.purchases || [])
        .filter(p => !sid || logMatchesSubstance({ substanceId: getPurchaseSubstanceId(p) }, sid));
    const lastPurchase = [...purchases]
        .sort((a, b) => getPurchaseDatetimeMs(b) - getPurchaseDatetimeMs(a))[0] || null;

    const cravings = (appData.cravings || [])
        .filter(c => !sid || logMatchesSubstance(c, sid));
    const lastCraving = [...cravings]
        .sort((a, b) => {
            const ta = a.timestamp ? new Date(a.timestamp).getTime() : new Date(`${a.date}T${a.time || '12:00'}`).getTime();
            const tb = b.timestamp ? new Date(b.timestamp).getTime() : new Date(`${b.date}T${b.time || '12:00'}`).getTime();
            return tb - ta;
        })[0] || null;

    const rows = [];

    if (lastUse) {
        const sub = getSubstance(getUseSubstanceId(lastUse));
        rows.push({
            icon: isGiftGivenLog(lastUse) || isGiftReceivedLog(lastUse) ? '🎁' : '⚡',
            title: formatLogHistoryLabel(lastUse, sub),
            meta: `${formatDate(lastUse.date)} · ${lastUse.startTime || lastUse.time || ''}`
        });
    }

    if (lastSession) {
        const sub = getSubstance(getUseSubstanceId(lastSession));
        const enriched = enrichUseEntry(lastSession, null);
        const dur = enriched.durationHours ? formatDurationHours(enriched.durationHours) : '—';
        rows.push({
            icon: '⏱️',
            title: `Session · ${lastSession.amount ?? '—'} ${lastSession.unit || sub?.defaultUnit || ''}`,
            meta: `${formatDate(lastSession.date)} · ${dur}`
        });
    }

    if (lastPurchase) {
        const sub = getSubstance(getPurchaseSubstanceId(lastPurchase));
        const qty = getPurchaseQuantityBought(lastPurchase);
        rows.push({
            icon: '🛒',
            title: `Purchase · ${qty} ${lastPurchase.unit || sub?.defaultUnit || ''}`,
            meta: `${formatDate(lastPurchase.date)}${lastPurchase.store ? ` · ${lastPurchase.store}` : ''}`
        });
    }

    if (lastCraving) {
        const sub = getSubstance(lastCraving.substanceId);
        rows.push({
            icon: '🎯',
            title: `Craving resisted · ${lastCraving.intensity ?? '—'}/10`,
            meta: `${formatDate(lastCraving.date)} · ${sub?.name || 'Unknown'}`
        });
    }

    if (!rows.length) {
        container.innerHTML = '<p class="empty-hint">No recent activity yet</p>';
        return;
    }

    container.innerHTML = rows.map(row => `
        <div class="dash-activity-item">
            <span class="dash-activity-icon">${row.icon}</span>
            <div class="dash-activity-body">
                <strong>${row.title}</strong>
                <small>${row.meta}</small>
            </div>
        </div>
    `).join('');
}

function updateDashboard() {
    const today = new Date().toISOString().split('T')[0];
    const todayCravings = filterCravingsBySubstance(appData.cravings.filter(c => c.date === today), currentSubstanceId);

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
    set('dash-today-session-duration', sessionDuration > 0
        ? `${formatDurationHours(sessionDuration)} session time`
        : 'No sessions today');

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
            const remaining = Math.max(0, limit - used);
            const { emoji } = getTaperLimitStatus(used, limit);
            set('dash-remaining-taper', `${remaining.toFixed(1)} ${sub.defaultUnit}`);
            set('dash-daily-limit-status', `${used.toFixed(1)} / ${limit} ${sub.defaultUnit} ${emoji}`);
            set('dash-daily-taper-limit', `${limit} ${sub.defaultUnit}`);
        } else {
            set('dash-remaining-taper', '—');
            set('dash-daily-limit-status', 'No taper limit set');
            set('dash-daily-taper-limit', '—');
        }
        updateRecoveryStreakDisplay(currentSubstanceId);
    } else {
        set('dash-remaining-taper', '—');
        set('dash-daily-limit-status', 'Select a substance');
        set('dash-daily-taper-limit', '—');
        set('recovery-streak-current', '—');
        set('recovery-streak-since', 'All substances');
        const bestEl = document.getElementById('recovery-streak-best');
        if (bestEl) bestEl.textContent = '—';
    }

    set('cravings-resisted', String(todayCravings.length));
    updateCurrentSupplyDashboard();
    renderSubstanceCompare();
    updateQuickActions();
    const dashboardTaperId = getMainSubstanceId() || (isAllSubstancesView() ? null : currentSubstanceId);
    updateDoNotSurpassDisplay('dashboard', dashboardTaperId);
    updateTaperProgress();
    updateDashboardMainDisplay();
    updateBreakMetricsDashboard();
    renderRecentActivity();
}

function formatBreakFromHours(hours) {
    if (hours == null || isNaN(hours)) return '—';
    return formatBreakText(Math.floor(hours * 60));
}

function updateBreakMetricsDashboard() {
    const set = (id, text) => {
        const el = document.getElementById(id);
        if (el) el.textContent = text;
    };

    if (isAllSubstancesView()) {
        set('dash-break-current', '—');
        set('dash-break-longest', '—');
        set('dash-break-avg-30', '—');
        return;
    }

    const metrics = getBreakMetrics(currentSubstanceId);
    set('dash-break-current', metrics.current?.text || '—');
    set('dash-break-longest', formatBreakFromHours(metrics.longest));
    set('dash-break-avg-30', formatBreakFromHours(metrics.avg30Days));
    set('dash-break-average', formatBreakFromHours(metrics.average));
    set('dash-break-streak-no-use', metrics.streakWithoutUse?.text || '—');
}

function updateBreakStats() {
    const metrics = getBreakMetrics(currentSubstanceId);
    const set = (id, text) => {
        const el = document.getElementById(id);
        if (el) el.textContent = text;
    };

    set('stats-break-longest', formatBreakFromHours(metrics.longest));
    set('stats-break-average', formatBreakFromHours(metrics.average));
    set('stats-break-median', formatBreakFromHours(metrics.median));
    set('stats-break-shortest', formatBreakFromHours(metrics.shortest));
    set('stats-break-current', metrics.current?.text || '—');

    const trendEl = document.getElementById('break-trend-list');
    if (trendEl) {
        if (!metrics.trend.length) {
            trendEl.innerHTML = '<p class="empty-hint">Log at least two sessions to see break trends</p>';
        } else {
            trendEl.innerHTML = metrics.trend.map(item => `
                <div class="break-trend-row">
                    <span>${item.label || item.date || '—'}</span>
                    <span class="break-trend-value ${getBreakColorClass(item.hours)}">${item.text || formatBreakFromHours(item.hours)}</span>
                </div>
            `).join('');
        }
    }

    renderBreakLengthChart(metrics);
}

function renderBreakLengthChart(metrics) {
    const container = document.getElementById('break-length-chart');
    if (!container) return;
    container.innerHTML = '';

    if (!metrics.trend.length) {
        container.innerHTML = '<p class="empty-hint">Log at least two sessions to chart breaks</p>';
        return;
    }

    const maxHours = Math.max(...metrics.trend.map(t => t.hours), 0.1);
    metrics.trend.forEach(item => {
        const bar = document.createElement('div');
        bar.className = 'chart-bar chart-bar-break';
        bar.style.height = `${Math.max((item.hours / maxHours) * 100, 4)}%`;
        const hoursLabel = formatBreakFromHours(item.hours);
        const dateLabel = item.label || (item.date ? formatDate(item.date) : '—');
        bar.innerHTML = `<span class="chart-bar-value">${hoursLabel}</span><span class="chart-bar-label">${dateLabel}</span>`;
        container.appendChild(bar);
    });
}

function updateBuyBreakStats() {
    const metrics = getBuyBreakMetrics(currentSubstanceId);
    const set = (id, text) => {
        const el = document.getElementById(id);
        if (el) el.textContent = text;
    };

    set('stats-buy-break-longest', formatBuyBreakFromHours(metrics.longest));
    set('stats-buy-break-average', formatBuyBreakFromHours(metrics.average));
    set('stats-buy-break-shortest', formatBuyBreakFromHours(metrics.shortest));
    set('stats-buy-since-last', metrics.timeSinceLastBuy?.text || '—');

    const trendEl = document.getElementById('buy-break-trend-list');
    if (trendEl) {
        if (!metrics.trend.length) {
            trendEl.innerHTML = '<p class="empty-hint">Log at least two purchases to see buy break trends</p>';
        } else {
            trendEl.innerHTML = metrics.trend.map(item => `
                <div class="break-trend-row">
                    <span>${item.label || item.date || '—'}</span>
                    <span class="buy-break-trend-value ${getBuyBreakColorClass(item.hours)}">${item.text || formatBuyBreakFromHours(item.hours)}</span>
                </div>
            `).join('');
        }
    }

    renderBuyBreakFrequencyChart(metrics);
}

function renderBuyBreakFrequencyChart(metrics) {
    const container = document.getElementById('buy-break-frequency-chart');
    if (!container) return;
    container.innerHTML = '';

    if (!metrics.trend.length) {
        container.innerHTML = '<p class="empty-hint">Log at least two purchases to chart buy frequency</p>';
        return;
    }

    const maxHours = Math.max(...metrics.trend.map(t => t.hours), 0.1);
    metrics.trend.forEach(item => {
        const bar = document.createElement('div');
        bar.className = 'chart-bar chart-bar-buy-break';
        bar.style.height = `${Math.max((item.hours / maxHours) * 100, 4)}%`;
        const daysLabel = formatBuyBreakFromHours(item.hours);
        const dateLabel = item.label || (item.date ? formatDate(item.date) : '—');
        bar.innerHTML = `<span class="chart-bar-value">${daysLabel}</span><span class="chart-bar-label">${dateLabel}</span>`;
        container.appendChild(bar);
    });
}

function updateDashboardMainDisplay() {
    const el = document.getElementById('dashboard-main-substance');
    const main = getMainSubstance();
    if (!el) return;
    el.textContent = main ? `Main: ${main.icon} ${main.name}` : 'Main: —';
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
        const logs = appData.logs.filter(l => l.date === today && l.substanceId === sub.id && isPersonalUseLog(l));
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
    return getUseEntries()
        .filter(l => logMatchesSubstance(l, substanceId) && isPersonalUseLog(l))
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

function toDateStr(date) {
    return date.toISOString().split('T')[0];
}

function getStatsDateRange() {
    const today = new Date();
    const todayStr = toDateStr(today);

    switch (statsDateRangePreset) {
        case 'last-14': {
            const start = new Date(today);
            start.setDate(start.getDate() - 13);
            return { startDate: toDateStr(start), endDate: todayStr, preset: 'last-14' };
        }
        case 'last-30': {
            const start = new Date(today);
            start.setDate(start.getDate() - 29);
            return { startDate: toDateStr(start), endDate: todayStr, preset: 'last-30' };
        }
        case 'this-week': {
            const start = new Date(today);
            start.setDate(start.getDate() - start.getDay());
            return { startDate: toDateStr(start), endDate: todayStr, preset: 'this-week' };
        }
        case 'this-month': {
            const start = new Date(today.getFullYear(), today.getMonth(), 1);
            return { startDate: toDateStr(start), endDate: todayStr, preset: 'this-month' };
        }
        case 'last-month': {
            const start = new Date(today.getFullYear(), today.getMonth() - 1, 1);
            const end = new Date(today.getFullYear(), today.getMonth(), 0);
            return { startDate: toDateStr(start), endDate: toDateStr(end), preset: 'last-month' };
        }
        case 'custom': {
            const start = statsCustomStartDate || todayStr;
            const end = statsCustomEndDate || todayStr;
            return {
                startDate: start <= end ? start : end,
                endDate: start <= end ? end : start,
                preset: 'custom'
            };
        }
        case 'all-time':
            return { startDate: null, endDate: todayStr, preset: 'all-time' };
        case 'last-7':
        default: {
            const start = new Date(today);
            start.setDate(start.getDate() - 6);
            return { startDate: toDateStr(start), endDate: todayStr, preset: 'last-7' };
        }
    }
}

function filterLogsByDateRange(logs, startDate, endDate) {
    return (logs || []).filter(l => {
        if (!l.date) return false;
        if (startDate && l.date < startDate) return false;
        if (endDate && l.date > endDate) return false;
        return true;
    });
}

function resolveStatsRangeBounds(startDate, endDate, logs) {
    const todayStr = toDateStr(new Date());
    let end = endDate || todayStr;
    let start = startDate;
    if (!start) {
        const dated = (logs || []).map(l => l.date).filter(Boolean).sort();
        start = dated[0] || end;
    }
    if (start > end) {
        const swap = start;
        start = end;
        end = swap;
    }
    return { startDate: start, endDate: end };
}

function countDaysInRange(startDate, endDate) {
    const start = new Date(startDate + 'T12:00:00');
    const end = new Date(endDate + 'T12:00:00');
    return Math.max(1, Math.floor((end - start) / 86400000) + 1);
}

function getStatsChartGrouping(startDate, endDate) {
    const days = countDaysInRange(startDate, endDate);
    if (days > 90) return 'month';
    if (days > 14) return 'week';
    return 'day';
}

function calculateSessionDurationMinutes(log) {
    if (!log?.endTime) return null;
    const startTime = log.startTime || log.time;
    if (!startTime || !log.date) return null;
    const start = parseUseDateTime(log.date, startTime);
    let end = parseUseDateTime(log.date, log.endTime);
    if (!start || !end) return null;
    if (end < start) end.setDate(end.getDate() + 1);
    const minutes = (end - start) / 60000;
    return minutes >= 0 ? minutes : null;
}

function calculateUseStats(logs) {
    const personalUseLogs = (logs || []).filter(isPersonalUseLog);
    const sessionCount = personalUseLogs.length;
    const totalAmount = personalUseLogs.reduce((s, l) => s + (parseFloat(l.amount) || 0), 0);

    const durationEntries = personalUseLogs
        .map(log => ({ log, minutes: calculateSessionDurationMinutes(log) }))
        .filter(entry => entry.minutes != null && entry.minutes > 0);

    const durationMinutesList = durationEntries.map(entry => entry.minutes);
    const totalDurationMinutes = durationMinutesList.reduce((s, m) => s + m, 0);
    const totalDurationHours = totalDurationMinutes / 60;

    const avgDurationMinutes = durationMinutesList.length
        ? totalDurationMinutes / durationMinutesList.length
        : null;

    const avgPerSession = sessionCount > 0 ? totalAmount / sessionCount : null;

    const amountWithDuration = durationEntries.reduce(
        (s, entry) => s + (parseFloat(entry.log.amount) || 0),
        0
    );
    const avgPerHour = totalDurationHours > 0 ? amountWithDuration / totalDurationHours : null;

    return {
        sessionCount,
        totalAmount,
        avgDurationMinutes,
        avgPerSession,
        avgPerHour,
        totalDurationMinutes,
        longestMinutes: durationMinutesList.length ? Math.max(...durationMinutesList) : null,
        shortestMinutes: durationMinutesList.length ? Math.min(...durationMinutesList) : null
    };
}

function getStatsRangeLabel(preset, startDate, endDate) {
    const labels = {
        'last-7': 'Last 7 Days',
        'last-14': 'Last 14 Days',
        'last-30': 'Last 30 Days',
        'this-week': 'This Week',
        'this-month': 'This Month',
        'last-month': 'Last Month',
        'all-time': 'All Time',
        custom: 'Custom Range'
    };
    const name = labels[preset] || 'Selected Range';
    if (preset === 'all-time') return `${name} · through ${formatDate(endDate)}`;
    return `${name} · ${formatDate(startDate)} – ${formatDate(endDate)}`;
}

function setupStatsDateRange() {
    const today = new Date();
    const start = new Date(today);
    start.setDate(start.getDate() - 6);
    statsCustomStartDate = toDateStr(start);
    statsCustomEndDate = toDateStr(today);

    const select = document.getElementById('stats-date-range');
    if (select) select.value = statsDateRangePreset;

    const startEl = document.getElementById('stats-custom-start');
    const endEl = document.getElementById('stats-custom-end');
    if (startEl) startEl.value = statsCustomStartDate;
    if (endEl) endEl.value = statsCustomEndDate;
}

function onStatsDateRangeChange() {
    const select = document.getElementById('stats-date-range');
    statsDateRangePreset = select?.value || 'last-7';
    document.getElementById('stats-custom-range-wrap')?.classList.toggle('hidden', statsDateRangePreset !== 'custom');
    if (statsDateRangePreset !== 'custom') updateStats();
}

function applyStatsCustomRange() {
    statsCustomStartDate = document.getElementById('stats-custom-start')?.value || '';
    statsCustomEndDate = document.getElementById('stats-custom-end')?.value || '';
    if (!statsCustomStartDate || !statsCustomEndDate) {
        alert('Select both a start and end date.');
        return;
    }
    statsDateRangePreset = 'custom';
    const select = document.getElementById('stats-date-range');
    if (select) select.value = 'custom';
    document.getElementById('stats-custom-range-wrap')?.classList.remove('hidden');
    updateStats();
}

function getStatsLogsForSubstance(substanceId) {
    const range = getStatsDateRange();
    const allLogs = getUseEntries().filter(l => logMatchesSubstance(l, substanceId) && isPersonalUseLog(l));
    const bounds = resolveStatsRangeBounds(range.startDate, range.endDate, allLogs);
    return {
        logs: filterLogsByDateRange(allLogs, bounds.startDate, bounds.endDate),
        bounds,
        preset: range.preset
    };
}

function renderUseStatsCards(useStats, unit) {
    setText('stats-avg-duration', useStats.avgDurationMinutes != null
        ? formatDurationHours(useStats.avgDurationMinutes / 60)
        : '—');
    setText('stats-avg-per-session', useStats.avgPerSession != null
        ? `${useStats.avgPerSession.toFixed(1)} ${unit}`
        : '—');
    setText('stats-avg-per-hr', useStats.avgPerHour != null
        ? `${useStats.avgPerHour.toFixed(2)} ${unit}/hr`
        : '—');
    setText('stats-session-count', String(useStats.sessionCount));
    setText('stats-total-duration', useStats.totalDurationMinutes > 0
        ? formatDurationHours(useStats.totalDurationMinutes / 60)
        : '—');
    setText('stats-longest-session', useStats.longestMinutes != null
        ? formatDurationHours(useStats.longestMinutes / 60)
        : '—');
    setText('stats-shortest-session', useStats.shortestMinutes != null
        ? formatDurationHours(useStats.shortestMinutes / 60)
        : '—');
}

function updateStats() {
    if (isAllSubstancesView()) {
        document.querySelector('.stats-date-range-toolbar')?.classList.add('hidden');
        renderSubstanceStatsBreakdown();
        document.getElementById('stats-single-view')?.classList.add('hidden');
        document.getElementById('stats-all-view')?.classList.remove('hidden');
        applyCollapsedSections();
        return;
    }

    document.querySelector('.stats-date-range-toolbar')?.classList.remove('hidden');

    document.getElementById('stats-single-view')?.classList.remove('hidden');
    document.getElementById('stats-all-view')?.classList.add('hidden');

    const { logs: rangeLogs, bounds, preset } = getStatsLogsForSubstance(currentSubstanceId);
    const sub = getSubstance(currentSubstanceId);
    const unit = sub?.defaultUnit || 'units';
    const cur = appData.settings.currency;
    const daysInRange = countDaysInRange(bounds.startDate, bounds.endDate);
    const useStats = calculateUseStats(rangeLogs);

    const summaryEl = document.getElementById('stats-range-summary');
    if (summaryEl) summaryEl.textContent = getStatsRangeLabel(preset, bounds.startDate, bounds.endDate);

    renderUsageChart(bounds);
    renderSpendingChart(bounds);

    const avgPerDay = daysInRange ? (useStats.totalAmount / daysInRange).toFixed(1) : '0';

    setText('total-week', `${useStats.totalAmount.toFixed(1)} ${unit}`);
    setText('total-month', String(useStats.sessionCount));
    setText('avg-per-day', avgPerDay);
    renderUseStatsCards(useStats, unit);

    updateLongestTimeBetween();
    updateBreakStats();
    updateBuyBreakStats();
    renderWeeklyPlanProgressStats(currentSubstanceId);
    renderGiftAnalytics(bounds);

    const inRangePurchaseFilter = p => p.date >= bounds.startDate && p.date <= bounds.endDate;
    const totalSpent = getSubstancePurchaseSpend(currentSubstanceId, inRangePurchaseFilter);
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
    const cravingsInRange = appData.cravings.filter(
        c => c.substanceId === currentSubstanceId && c.date >= bounds.startDate && c.date <= bounds.endDate
    );
    setText('stats-cravings-count', String(cravingsInRange.length));
    applyCollapsedSections();
}

function renderSubstanceStatsBreakdown() {
    const container = document.getElementById('stats-by-substance');
    if (!container) return;
    container.innerHTML = '';

    getActiveSubstances().forEach(sub => {
        const logs = appData.logs.filter(l => l.substanceId === sub.id && isPersonalUseLog(l));
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

function renderGiftAnalytics(bounds) {
    const section = document.getElementById('gift-analytics-section');
    if (!section) return;

    if (isAllSubstancesView()) {
        section.classList.add('hidden');
        return;
    }

    section.classList.remove('hidden');
    const sub = getSubstance(currentSubstanceId);
    const unit = sub?.defaultUnit || 'units';
    const giftLogs = filterLogsByDateRange(
        (appData.logs || []).filter(l => getUseSubstanceId(l) === currentSubstanceId),
        bounds?.startDate,
        bounds?.endDate
    );
    const metrics = getGiftMetricsFromLogs(giftLogs);

    setText('stats-gift-given', `${metrics.given.toFixed(1)} ${unit}`);
    setText('stats-gift-received', `${metrics.received.toFixed(1)} ${unit}`);
    const netLabel = metrics.net >= 0 ? `+${metrics.net.toFixed(1)}` : metrics.net.toFixed(1);
    setText('stats-gift-net', `${netLabel} ${unit}`);

    renderGiftPartyBreakdown('stats-gift-recipients', metrics.recipients, unit);
    renderGiftPartyBreakdown('stats-gift-senders', metrics.senders, unit);
}

function renderGiftPartyBreakdown(containerId, totalsMap, unit) {
    const container = document.getElementById(containerId);
    if (!container) return;
    const sorted = Object.entries(totalsMap).sort((a, b) => b[1] - a[1]).slice(0, 10);
    if (!sorted.length) {
        container.innerHTML = '<p class="empty-hint">No data yet</p>';
        return;
    }
    container.innerHTML = sorted.map(([name, amt]) =>
        `<div class="breakdown-row"><span>${name}</span><strong>${amt.toFixed(1)} ${unit}</strong></div>`
    ).join('');
}

function renderTaperProgressStats(substanceId) {
    const el = document.getElementById('stats-taper-progress');
    if (!el) return;
    const plan = appData.taperPlans[substanceId];
    if (!plan) { el.textContent = 'No plan'; return; }
    const start = new Date(plan.startDate);
    const end = new Date(plan.endDate);
    const pct = Math.round(Math.min(100, Math.max(0, ((Date.now() - start) / (end - start)) * 100)));
    if (isManualWeeklyPlan(plan)) {
        const weekCount = plan.manualWeeklyTargets?.length || plan.weeklyTargets?.length || 0;
        const goalPart = plan.goalDailyAverage != null ? ` · goal ${plan.goalDailyAverage}` : '';
        el.textContent = `${pct}% · ${weekCount} manual week${weekCount === 1 ? '' : 's'}${goalPart}`;
    } else {
        const startAvg = plan.startingDailyAverage ?? plan.currentAvg;
        const goalAvg = plan.goalDailyAverage ?? plan.goalAvg;
        const range = startAvg != null ? `${startAvg} → ${goalAvg ?? '—'}` : String(goalAvg ?? '—');
        el.textContent = `${pct}% (${range})`;
    }
}

function buildUsageChartBuckets(bounds) {
    const { startDate, endDate } = bounds;
    const grouping = getStatsChartGrouping(startDate, endDate);
    const logs = getUseEntries().filter(
        l => logMatchesSubstance(l, currentSubstanceId) && isPersonalUseLog(l)
    );
    const filtered = filterLogsByDateRange(logs, startDate, endDate);
    const buckets = [];

    if (grouping === 'day') {
        let cursor = new Date(startDate + 'T12:00:00');
        const end = new Date(endDate + 'T12:00:00');
        const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
        while (cursor <= end) {
            const dateStr = toDateStr(cursor);
            const count = filtered
                .filter(l => l.date === dateStr)
                .reduce((s, l) => s + (parseFloat(l.amount) || 0), 0);
            buckets.push({
                label: dayNames[cursor.getDay()],
                detail: cursor.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
                bucketStart: dateStr,
                bucketEnd: dateStr,
                count
            });
            cursor.setDate(cursor.getDate() + 1);
        }
        return { grouping, buckets };
    }

    if (grouping === 'week') {
        let cursor = new Date(startDate + 'T12:00:00');
        cursor.setDate(cursor.getDate() - cursor.getDay());
        const end = new Date(endDate + 'T12:00:00');
        while (cursor <= end) {
            const weekStartStr = toDateStr(cursor);
            const weekEnd = new Date(cursor);
            weekEnd.setDate(weekEnd.getDate() + 6);
            const weekEndStr = toDateStr(weekEnd);
            const count = filtered
                .filter(l => l.date >= weekStartStr && l.date <= weekEndStr)
                .reduce((s, l) => s + (parseFloat(l.amount) || 0), 0);
            buckets.push({
                label: cursor.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
                detail: 'Week',
                bucketStart: weekStartStr,
                bucketEnd: weekEndStr,
                count
            });
            cursor.setDate(cursor.getDate() + 7);
        }
        return { grouping, buckets };
    }

    let cursor = new Date(startDate.slice(0, 7) + '-01T12:00:00');
    const end = new Date(endDate.slice(0, 7) + '-01T12:00:00');
    while (cursor <= end) {
        const monthKey = `${cursor.getFullYear()}-${String(cursor.getMonth() + 1).padStart(2, '0')}`;
        const monthEnd = new Date(cursor.getFullYear(), cursor.getMonth() + 1, 0);
        const count = filtered
            .filter(l => l.date.startsWith(monthKey))
            .reduce((s, l) => s + (parseFloat(l.amount) || 0), 0);
        buckets.push({
            label: cursor.toLocaleDateString('en-US', { month: 'short' }),
            detail: String(cursor.getFullYear()),
            bucketStart: `${monthKey}-01`,
            bucketEnd: toDateStr(monthEnd),
            count
        });
        cursor.setMonth(cursor.getMonth() + 1);
    }
    return { grouping, buckets };
}

function renderUsageChart(bounds) {
    const container = document.getElementById('cigarettes-per-day-chart');
    if (!container) return;
    container.innerHTML = '';

    const { grouping, buckets } = buildUsageChartBuckets(bounds);
    const titleEl = document.getElementById('usage-chart-title');
    if (titleEl) {
        titleEl.textContent = grouping === 'month'
            ? 'Usage Per Month'
            : grouping === 'week'
                ? 'Usage Per Week'
                : 'Usage Per Day';
    }

    if (!buckets.length) {
        container.innerHTML = '<p class="empty-hint">No usage in selected range</p>';
        return;
    }

    const max = Math.max(...buckets.map(d => d.count), 1);
    buckets.forEach(data => {
        const bar = document.createElement('div');
        bar.className = 'chart-bar';
        bar.style.height = `${Math.max((data.count / max) * 100, 4)}%`;
        bar.title = data.detail ? `${data.detail}: ${data.count}` : String(data.count);
        bar.innerHTML = `<span class="chart-bar-value">${data.count.toFixed(1)}</span><span class="chart-bar-label">${data.label}</span>`;
        container.appendChild(bar);
    });
}

function renderSpendingChart(bounds) {
    const container = document.getElementById('spending-per-day-chart');
    if (!container) return;
    container.innerHTML = '';
    const sub = getSubstance(currentSubstanceId);
    if (!sub?.costTrackingEnabled) {
        container.innerHTML = '<p class="empty-hint">Cost tracking disabled for this substance</p>';
        return;
    }

    const { grouping, buckets } = buildUsageChartBuckets(bounds);
    const titleEl = document.getElementById('spending-chart-title');
    if (titleEl) {
        titleEl.textContent = grouping === 'month'
            ? 'Spending Per Month'
            : grouping === 'week'
                ? 'Spending Per Week'
                : 'Spending Per Day';
    }

    const purchases = (appData.purchases || []).filter(
        p => getPurchaseSubstanceId(p) === currentSubstanceId
            && p.date >= bounds.startDate
            && p.date <= bounds.endDate
    );

    const spendBuckets = buckets.map(bucket => ({
        ...bucket,
        cost: purchases
            .filter(p => p.date >= bucket.bucketStart && p.date <= bucket.bucketEnd)
            .reduce((s, p) => s + (p.totalCost ?? p.cost ?? 0), 0)
    }));

    const maxCost = Math.max(...spendBuckets.map(d => d.cost), 0.01);
    spendBuckets.forEach(data => {
        const bar = document.createElement('div');
        bar.className = 'chart-bar chart-bar-spend';
        bar.style.height = `${Math.max((data.cost / maxCost) * 100, 4)}%`;
        bar.innerHTML = `<span class="chart-bar-value">${appData.settings.currency}${data.cost.toFixed(0)}</span><span class="chart-bar-label">${data.label}</span>`;
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
    const el = document.getElementById('longest-time-between');
    if (!el) return;
    const metrics = getBreakMetrics(currentSubstanceId);
    el.textContent = formatBreakFromHours(metrics.longest);
}

// ——— Taper / Do Not Surpass ———
const TAPER_RELAPSE_NOTE = 'Going over your limit doesn\'t erase your progress. Every day is a new chance—no shame, just data.';
const TAPER_REDUCTION_LABELS = {
    'reduce-amount': 'Reduce by amount',
    'reduce-percent': 'Reduce by percent',
    fixed: 'Fixed daily limit',
    'step-weekly': 'Weekly step-down',
    'manual-weekly': 'Manual weekly plan'
};

function isManualWeeklyPlan(plan) {
    return plan?.reductionType === 'manual-weekly';
}

function getManualWeeklyWeekNumber(plan, dateStr) {
    if (!plan?.startDate || !dateStr) return 1;
    const start = new Date(plan.startDate + 'T12:00:00');
    const d = new Date(dateStr + 'T12:00:00');
    const diffDays = Math.floor((d - start) / 86400000);
    return Math.max(1, Math.floor(diffDays / 7) + 1);
}

function getManualWeeklyStatus(actual, target) {
    if (target == null || target <= 0) {
        return { status: 'none', label: 'No target', emoji: '—' };
    }
    if (actual > target) {
        return { status: 'over', label: 'Over target', emoji: '❌' };
    }
    if (actual >= target * 0.9) {
        return { status: 'close', label: 'Near target', emoji: '⚠️' };
    }
    return { status: 'under', label: 'Under target', emoji: '✅' };
}

function getManualWeeklyGoalStatus(used, goal) {
    if (goal == null || goal <= 0) {
        return { status: 'none', label: '—', emoji: '—' };
    }
    if (used > goal) {
        return { status: 'over', label: 'Over Goal', emoji: '❌' };
    }
    if (used >= goal * 0.9) {
        return { status: 'close', label: 'Near Goal', emoji: '⚠️' };
    }
    return { status: 'under', label: 'Under Goal', emoji: '✅' };
}

function buildWeeklyTargetsFromManual(plan) {
    const targets = plan.manualWeeklyTargets || [];
    const weeks = [];
    let cursor = plan.startDate || new Date().toISOString().split('T')[0];

    targets.forEach((entry, index) => {
        const weekNum = entry.week ?? index + 1;
        const weekStart = cursor;
        let weekEnd = addDaysToDateStr(getWeekStartDateStr(cursor), 6);
        if (plan.endDate && weekEnd > plan.endDate) weekEnd = plan.endDate;
        const targetAmount = roundTaperValue(parseFloat(entry.targetAmount) || 0);

        weeks.push({
            week: weekNum,
            weekStart,
            weekEnd,
            targetAmount,
            dailyTarget: roundTaperValue(targetAmount / 7),
            weeklyMax: targetAmount,
            actualUsed: 0,
            difference: 0,
            status: 'under'
        });

        const next = addDaysToDateStr(weekEnd, 1);
        if (next > cursor) cursor = next;
    });

    return weeks;
}

function computeManualPlanEndDate(plan) {
    const weeks = plan.manualWeeklyTargets?.length || plan.weeklyTargets?.length || 1;
    if (!plan.startDate) return plan.endDate;
    return addDaysToDateStr(plan.startDate, weeks * 7 - 1);
}

function renderManualWeeklyTargetsEditor(targets) {
    const container = document.getElementById('manual-weekly-targets-list');
    if (!container) return;
    const list = targets?.length ? targets : [{ week: 1, targetAmount: '' }];
    container.innerHTML = list.map((t, i) => {
        const weekNum = t.week ?? i + 1;
        return `<div class="manual-week-row" data-week="${weekNum}">
            <label>Week ${weekNum} Goal</label>
            <input type="number" class="manual-week-target-input" data-week="${weekNum}" min="0" step="0.1" value="${t.targetAmount ?? ''}" placeholder="0">
        </div>`;
    }).join('');
}

function collectManualWeeklyTargetsFromForm() {
    const inputs = document.querySelectorAll('.manual-week-target-input');
    const targets = [];
    inputs.forEach((input, index) => {
        const amount = parseFloat(input.value);
        targets.push({
            week: parseInt(input.dataset.week, 10) || index + 1,
            targetAmount: Number.isFinite(amount) ? amount : 0
        });
    });
    return targets;
}

function addManualWeeklyWeek() {
    const targets = collectManualWeeklyTargetsFromForm();
    const last = targets[targets.length - 1];
    const lastAmt = parseFloat(last?.targetAmount);
    const nextAmount = Number.isFinite(lastAmt) ? roundTaperValue(Math.max(0, lastAmt - 1)) : '';
    targets.push({ week: targets.length + 1, targetAmount: nextAmount });
    renderManualWeeklyTargetsEditor(targets);
}

function removeManualWeeklyWeek() {
    const targets = collectManualWeeklyTargetsFromForm();
    if (targets.length <= 1) return;
    targets.pop();
    targets.forEach((t, i) => { t.week = i + 1; });
    renderManualWeeklyTargetsEditor(targets);
}

function parseOptionalTaperNumber(inputEl) {
    const raw = inputEl?.value?.trim?.() ?? inputEl?.value;
    if (raw === '' || raw == null) return null;
    const n = parseFloat(raw);
    return Number.isFinite(n) ? n : null;
}

function mountManualWeeklyFormFields(isManual) {
    const manualSection = document.getElementById('manual-weekly-plan-section');
    const goalGroup = document.getElementById('goal-avg-group');
    const endGroup = document.getElementById('end-date-group');
    const startGoalRow = document.getElementById('taper-start-goal-row');
    const endRow = document.getElementById('taper-end-weekly-row');
    const targetsList = document.getElementById('manual-weekly-targets-list');
    if (!manualSection || !goalGroup || !endGroup || !targetsList) return;

    if (isManual) {
        manualSection.insertBefore(endGroup, targetsList);
        manualSection.insertBefore(goalGroup, endGroup);
    } else {
        startGoalRow?.appendChild(goalGroup);
        endRow?.insertBefore(endGroup, endRow.firstChild);
    }
}

function getCurrentManualWeekRow(plan, dateStr) {
    if (!plan?.weeklyTargets?.length) return null;
    const weekNum = getManualWeeklyWeekNumber(plan, dateStr);
    return plan.weeklyTargets.find(w => w.week === weekNum)
        || plan.weeklyTargets[Math.min(weekNum - 1, plan.weeklyTargets.length - 1)];
}

function roundTaperValue(n) {
    return Math.round((parseFloat(n) || 0) * 2) / 2;
}

function migrateTaperPlan(plan, substanceId, data) {
    if (!plan) return;
    const now = new Date().toISOString();
    if (!plan.id) plan.id = `${substanceId}-${Date.now()}`;
    if (!plan.substanceId) plan.substanceId = substanceId;
    if (!plan.createdAt) plan.createdAt = plan.startDate ? `${plan.startDate}T12:00:00.000Z` : now;
    if (!plan.updatedAt) plan.updatedAt = plan.createdAt;
    if (plan.isPaused === undefined) plan.isPaused = false;

    if (isManualWeeklyPlan(plan)) {
        if (plan.startingDailyAverage == null && plan.currentAvg != null) {
            plan.startingDailyAverage = plan.currentAvg;
        }
        plan.reductionAmount = 0;
        plan.reductionPercent = 0;
        if (plan.goalDailyAverage == null && plan.goalAvg != null) {
            plan.goalDailyAverage = plan.goalAvg;
        }
        plan.currentAvg = plan.startingDailyAverage ?? null;
        plan.goalAvg = plan.goalDailyAverage ?? null;
    } else {
        plan.startingDailyAverage = plan.startingDailyAverage ?? plan.currentAvg ?? null;
        plan.goalDailyAverage = plan.goalDailyAverage ?? plan.goalAvg ?? 0;
        plan.currentAvg = plan.startingDailyAverage;
        plan.goalAvg = plan.goalDailyAverage;

        if (!plan.reductionType) {
            const map = { linear: 'reduce-amount', 'step-weekly': 'step-weekly', hold: 'fixed', custom: 'fixed' };
            plan.reductionType = map[plan.planType] || 'reduce-amount';
        }

        const startVal = plan.startingDailyAverage ?? 0;
        if (plan.reductionAmount == null && startVal > plan.goalDailyAverage) {
            const weeks = Math.max(1, countWeeksBetween(plan.startDate, plan.endDate));
            plan.reductionAmount = roundTaperValue((startVal - plan.goalDailyAverage) / weeks);
        }
        if (plan.reductionPercent == null) plan.reductionPercent = 10;
    }

    if (!plan.reductionType) {
        const map = { linear: 'reduce-amount', 'step-weekly': 'step-weekly', hold: 'fixed', custom: 'fixed' };
        plan.reductionType = map[plan.planType] || 'reduce-amount';
    }

    plan.weeklyMax = plan.weeklyMax ?? null;
    plan.doNotSurpassDaily = plan.doNotSurpassDaily ?? plan.warnBeforeSurpass ?? true;
    plan.doNotSurpassWeekly = plan.doNotSurpassWeekly ?? false;
    plan.notes = plan.notes ?? plan.taperNotes ?? '';
    plan.taperNotes = plan.notes;

    if (isManualWeeklyPlan(plan)) {
        if (!plan.goalLimitType) plan.goalLimitType = 'daily';
        if (plan.goalLimitAmount == null) plan.goalLimitAmount = 0;
        if (!plan.manualWeeklyTargets?.length) {
            if (plan.weeklyTargets?.length) {
                plan.manualWeeklyTargets = plan.weeklyTargets.map((w, i) => ({
                    week: w.week ?? i + 1,
                    targetAmount: w.targetAmount ?? w.weeklyMax ?? roundTaperValue((w.dailyTarget || 0) * 7)
                }));
            } else {
                plan.manualWeeklyTargets = [{ week: 1, targetAmount: '' }];
            }
        }
        plan.weeklyTargets = buildWeeklyTargetsFromManual(plan);
        if (!plan.endDate || plan.endDate < plan.startDate) {
            plan.endDate = computeManualPlanEndDate(plan);
        }
    } else if (!plan.weeklyTargets?.length) {
        plan.weeklyTargets = generateWeeklyTargets(plan);
    }
    syncTaperPlanData(substanceId, data);
}

function countWeeksBetween(startDate, endDate) {
    const s = new Date(startDate + 'T12:00:00');
    const e = new Date(endDate + 'T12:00:00');
    return Math.max(1, Math.ceil((e - s) / (7 * 86400000)) + 1);
}

function generateWeeklyTargets(plan) {
    if (isManualWeeklyPlan(plan)) {
        return buildWeeklyTargetsFromManual(plan);
    }

    const { startDate, endDate, startingDailyAverage, goalDailyAverage, reductionType, reductionAmount, reductionPercent, weeklyMax } = plan;
    const weeks = [];
    let cursor = startDate;
    let currentDaily = startingDailyAverage ?? 0;
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

function syncTaperPlanData(substanceId, data = appData) {
    const plan = data?.taperPlans?.[substanceId];
    if (!plan) return;

    (plan.weeklyTargets || []).forEach(w => {
        let actual = 0;
        let d = w.weekStart;
        while (d <= w.weekEnd) {
            actual += getUsedAmount(substanceId, d, null, data);
            d = addDaysToDateStr(d, 1);
        }
        w.actualUsed = roundTaperValue(actual);
        const target = isManualWeeklyPlan(plan)
            ? (w.targetAmount ?? w.weeklyMax)
            : w.weeklyMax;
        w.difference = roundTaperValue(actual - target);
        w.status = isManualWeeklyPlan(plan)
            ? getManualWeeklyStatus(actual, target).status
            : getTaperLimitStatus(actual, target).status;
    });

    expandDailyTargetsFromWeekly(plan);
    (plan.dailyTargets || []).forEach(day => {
        const limit = day.limit ?? day.target;
        if (limit == null) return;
        const used = getUsedAmount(substanceId, day.date, null, data);
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

    if (isManualWeeklyPlan(plan)) {
        if (plan.goalLimitType === 'daily' && plan.goalLimitAmount > 0) {
            return roundTaperValue(plan.goalLimitAmount);
        }
        const week = getCurrentManualWeekRow(plan, dateStr);
        if (week?.targetAmount > 0) return roundTaperValue(week.targetAmount / 7);
        if (week?.dailyTarget > 0) return week.dailyTarget;
    }

    const week = getWeekRowForDate(plan, dateStr);
    if (week) return week.dailyTarget;
    const day = plan.dailyTargets?.find(d => d.date === dateStr);
    return day ? (day.limit ?? day.target) : null;
}

function getWeeklyLimit(substanceId, dateStr) {
    const plan = appData.taperPlans[substanceId];
    if (!plan || plan.isPaused) return null;

    if (isManualWeeklyPlan(plan)) {
        if (plan.goalLimitType === 'weekly' && plan.goalLimitAmount > 0) {
            return roundTaperValue(plan.goalLimitAmount);
        }
        const week = getCurrentManualWeekRow(plan, dateStr);
        const target = week?.targetAmount ?? week?.weeklyMax;
        if (target > 0) return roundTaperValue(target);
    }

    const week = getWeekRowForDate(plan, dateStr);
    if (week?.weeklyMax > 0) return week.weeklyMax;
    if (plan.weeklyMax > 0) return plan.weeklyMax;
    const daily = getDailyLimitForDate(substanceId, dateStr);
    return daily != null ? roundTaperValue(daily * 7) : null;
}

function getManualWeeklyGoalUsed(plan, substanceId, dateStr) {
    if (plan.goalLimitType === 'weekly') {
        return getWeeklyUsed(substanceId, dateStr);
    }
    return getUsedAmount(substanceId, dateStr);
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
    let totalReduction = Math.max(0, start - goal);
    let weeklyReduction = 0;
    if (isManualWeeklyPlan(plan)) {
        const manual = plan.manualWeeklyTargets || [];
        const first = parseFloat(manual[0]?.targetAmount) || 0;
        const last = parseFloat(manual[manual.length - 1]?.targetAmount) || 0;
        totalReduction = Math.max(0, first - last);
        weeklyReduction = manual.length > 1 ? totalReduction / (manual.length - 1) : 0;
    } else {
        const weeks = plan.weeklyTargets?.length || 1;
        weeklyReduction = weeks > 0 ? totalReduction / weeks : 0;
    }
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
        weeks: plan.weeklyTargets?.length || 0
    };
}

function getTaperDayStatus(substanceId, dateStr) {
    const limit = getDailyLimitForDate(substanceId, dateStr);
    if (limit == null) return 'none';
    const used = getUsedAmount(substanceId, dateStr);
    return getTaperLimitStatus(used, limit).status;
}

function confirmTaperBeforeLog(substanceId, amount, isQuickLog, excludeLogId = null, transactionType = 'use', entryDate = null) {
    if (!isPersonalUseLog({ transactionType })) return true;

    const sub = getSubstance(substanceId);
    if (!sub?.taperTrackingEnabled) return true;

    const plan = appData.taperPlans[substanceId];
    if (!plan || plan.isPaused) return true;

    const checkDate = entryDate || new Date().toISOString().split('T')[0];
    const dailyLimit = getDailyLimitForDate(substanceId, checkDate);
    const usedToday = getUsedAmountForDate(substanceId, checkDate, excludeLogId);
    const weekUsed = getUsedAmountForWeek(substanceId, checkDate, excludeLogId);
    const projectedToday = usedToday + amount;
    const projectedWeek = weekUsed + amount;

    if (excludeLogId) {
        const ex = findUseEntry(excludeLogId);
        if (ex && logMatchesSubstance(ex, substanceId) && ex.date === checkDate) {
            const originalAmount = parseFloat(ex.amount) || 0;
            if (Math.abs(amount - originalAmount) < 0.001) return true;
        }
    }

    if (plan.doNotSurpassDaily && dailyLimit != null && projectedToday > dailyLimit) {
        const msg = excludeLogId
            ? `Editing this entry would put that day at ${projectedToday.toFixed(1)} / ${dailyLimit} ${sub.defaultUnit}. Log anyway?`
            : `This entry would put ${checkDate === new Date().toISOString().split('T')[0] ? 'today' : 'that day'} at ${projectedToday.toFixed(1)} / ${dailyLimit} ${sub.defaultUnit}. Log anyway?`;
        if (!confirm(msg)) return false;
    }

    const weeklyLimit = getWeeklyLimit(substanceId, checkDate);
    if (plan.doNotSurpassWeekly && weeklyLimit != null && projectedWeek > weeklyLimit) {
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
    const reductionType = document.getElementById('reduction-type')?.value || 'reduce-amount';
    const isManual = reductionType === 'manual-weekly';
    const startingDailyAverage = isManual
        ? null
        : parseOptionalTaperNumber(document.getElementById('current-avg'));
    const goalDailyAverage = parseOptionalTaperNumber(document.getElementById('goal-avg'));

    const plan = {
        id: existingPlan?.id || `${substanceId}-${Date.now()}`,
        substanceId,
        startDate,
        endDate: document.getElementById('end-date')?.value || null,
        startingDailyAverage,
        goalDailyAverage: isManual ? goalDailyAverage : (goalDailyAverage ?? 0),
        reductionType,
        reductionAmount: isManual ? 0 : (parseFloat(document.getElementById('reduction-amount')?.value) || 0),
        reductionPercent: isManual ? 0 : (parseFloat(document.getElementById('reduction-percent')?.value) || 0),
        weeklyMax: isManual ? null : (parseFloat(document.getElementById('weekly-max')?.value) || null),
        doNotSurpassDaily: document.getElementById('do-not-surpass-daily')?.checked !== false,
        doNotSurpassWeekly: !!document.getElementById('do-not-surpass-weekly')?.checked,
        notes: document.getElementById('taper-notes')?.value || '',
        isPaused: existingPlan?.isPaused || false,
        createdAt: existingPlan?.createdAt || now,
        updatedAt: now
    };

    if (isManual) {
        plan.manualWeeklyTargets = collectManualWeeklyTargetsFromForm();
        plan.goalLimitAmount = parseOptionalTaperNumber(document.getElementById('goal-limit-amount')) ?? 0;
        plan.goalLimitType = document.getElementById('goal-limit-type')?.value || 'daily';
        plan.endDate = plan.endDate || computeManualPlanEndDate(plan);
    }

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
    const reductionRow = document.getElementById('taper-reduction-fields-row');
    const manualSection = document.getElementById('manual-weekly-plan-section');
    const startAvgGroup = document.getElementById('taper-start-avg-group');
    const endWeeklyRow = document.getElementById('taper-end-weekly-row');
    const weeklyMaxGroup = document.getElementById('weekly-max-group');
    const warnToggles = document.getElementById('taper-warn-toggles');
    const goalAvgInput = document.getElementById('goal-avg');
    const goalAvgLabel = document.getElementById('goal-avg-label');
    const endDateInput = document.getElementById('end-date');
    const endDateLabel = document.getElementById('end-date-label');
    const isManual = type === 'manual-weekly';

    reductionRow?.classList.toggle('hidden', isManual);
    amtGroup?.classList.toggle('hidden', isManual || type === 'reduce-percent' || type === 'fixed');
    pctGroup?.classList.toggle('hidden', isManual || type !== 'reduce-percent');
    manualSection?.classList.toggle('hidden', !isManual);
    startAvgGroup?.classList.toggle('hidden', isManual);
    document.getElementById('taper-start-goal-row')?.classList.toggle('hidden', isManual);
    endWeeklyRow?.classList.toggle('hidden', isManual);
    weeklyMaxGroup?.classList.toggle('hidden', isManual);
    warnToggles?.classList.toggle('hidden', isManual);

    mountManualWeeklyFormFields(isManual);

    if (goalAvgLabel) {
        goalAvgLabel.textContent = isManual ? 'Goal Daily Average (optional)' : 'Goal Daily Average';
    }
    if (goalAvgInput) goalAvgInput.required = !isManual;
    if (endDateLabel) {
        endDateLabel.textContent = isManual ? 'Target end date (optional)' : 'Target end date';
    }
    if (endDateInput) endDateInput.required = !isManual;

    if (isManual && !document.querySelector('.manual-week-target-input')) {
        renderManualWeeklyTargetsEditor([{ week: 1, targetAmount: '' }]);
    }

    const hints = {
        'reduce-amount': 'Reduce a fixed amount from your daily average each week.',
        'reduce-percent': 'Reduce by a percentage of your daily average each week.',
        fixed: 'Keep the same daily limit until your target end date.',
        'step-weekly': 'Step down once per week (same as reduce by amount).',
        'manual-weekly': 'Set each week\'s max amount manually.'
    };
    if (hint) hint.textContent = hints[type] || hints['reduce-amount'];
}

function fillTaperFormFromPlan(plan) {
    if (!plan) return;
    const startVal = plan.startingDailyAverage ?? plan.currentAvg;
    setInputValue('current-avg', startVal != null && startVal !== '' ? startVal : '');
    const goalVal = plan.goalDailyAverage ?? plan.goalAvg;
    setInputValue('goal-avg', goalVal != null && goalVal !== '' ? goalVal : '');
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
    if (isManualWeeklyPlan(plan)) {
        renderManualWeeklyTargetsEditor(plan.manualWeeklyTargets || []);
        setInputValue('goal-limit-amount', plan.goalLimitAmount ?? '');
        setInputValue('goal-limit-type', plan.goalLimitType || 'daily');
    }
    toggleTaperPlanTypeFields();
}

function setDefaultTaperEndDate() {
    const endEl = document.getElementById('end-date');
    if (!endEl || endEl.value) return;
    if (document.getElementById('reduction-type')?.value === 'manual-weekly') return;
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
        const tiles = [
            taperMetricTile('Reduction Target', TAPER_REDUCTION_LABELS[plan.reductionType] || plan.reductionType)
        ];
        if (isManualWeeklyPlan(plan)) {
            tiles.unshift(
                taperMetricTile('Goal Daily Average', plan.goalDailyAverage != null ? `${plan.goalDailyAverage} ${unit}` : '—')
            );
            tiles.push(taperMetricTile('Weeks in plan', String(plan.manualWeeklyTargets?.length || 0)));
            if (plan.goalLimitAmount > 0) {
                tiles.push(taperMetricTile('Goal use under', `${plan.goalLimitAmount} ${unit}/${plan.goalLimitType}`));
            }
        } else {
            tiles.unshift(
                taperMetricTile('Starting Daily Average', plan.startingDailyAverage != null ? `${plan.startingDailyAverage} ${unit}` : '—'),
                taperMetricTile('Goal Daily Average', plan.goalDailyAverage != null ? `${plan.goalDailyAverage} ${unit}` : '—')
            );
            tiles.push(
                plan.reductionType === 'reduce-percent'
                    ? taperMetricTile('Reduction %', `${plan.reductionPercent}% / wk`)
                    : taperMetricTile('Reduction / wk', `${plan.reductionAmount} ${unit}`),
                taperMetricTile('Weekly Limit', plan.weeklyMax ? `${plan.weeklyMax} ${unit}` : 'Auto')
            );
        }
        tiles.push(
            taperMetricTile('Target end date', formatDate(plan.endDate)),
            taperMetricTile('Daily warn', plan.doNotSurpassDaily ? 'On' : 'Off'),
            taperMetricTile('Weekly warn', plan.doNotSurpassWeekly ? 'On' : 'Off')
        );
        ro.innerHTML = tiles.join('');
    }
    if (ca) {
        if (isManualWeeklyPlan(plan)) {
            ca.innerHTML = [
                taperMetricTile('Total reduction', `${calc.totalReduction.toFixed(1)} ${unit}`),
                taperMetricTile('Avg weekly step', `${calc.weeklyReduction.toFixed(2)} ${unit}`),
                taperMetricTile('Today\'s target', calc.todayTarget != null ? `${calc.todayTarget} ${unit}` : '—'),
                taperMetricTile('Next week target', `${calc.nextWeekTarget} ${unit}`),
                taperMetricTile('Est. end date', formatDate(calc.endDate))
            ].join('');
        } else {
            ca.innerHTML = [
                taperMetricTile('Total reduction', `${calc.totalReduction.toFixed(1)} ${unit}`),
                taperMetricTile('Weekly reduction', `${calc.weeklyReduction.toFixed(2)} ${unit}`),
                taperMetricTile('Today\'s target', calc.todayTarget != null ? `${calc.todayTarget} ${unit}` : '—'),
                taperMetricTile('Next week target', `${calc.nextWeekTarget} ${unit}`),
                taperMetricTile('Est. end date', formatDate(calc.endDate))
            ].join('');
        }
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
        if (isManualWeeklyPlan(plan)) {
            const weekNum = getManualWeeklyWeekNumber(plan, today);
            set('taper-weekly-max-val', `Week ${weekNum}: ${weeklyLimit} ${unit}`);
        } else {
            set('taper-weekly-max-val', `${weeklyLimit} ${unit}`);
        }
        set('taper-weekly-used', `${weeklyUsed} ${unit}`);
        set('taper-weekly-remaining', `${remW.toFixed(1)} ${unit}`);
        set('taper-weekly-pct', `${Math.round(pctW)}%`);
        const badgeStatus = isManualWeeklyPlan(plan)
            ? getManualWeeklyStatus(weeklyUsed, weeklyLimit).status
            : weeklyStatus;
        setTaperStatusBadge(document.getElementById('taper-weekly-status'), badgeStatus, shortTaperStatus(badgeStatus));
    }
}

function getTaperWeeklySummary(plan, substanceId) {
    const today = new Date().toISOString().split('T')[0];
    const currentWeek = getWeekRowForDate(plan, today);
    const weekIndex = currentWeek ? plan.weeklyTargets.findIndex(w => w.weekStart === currentWeek.weekStart) + 1 : 0;
    const weeksRemaining = Math.max(0, (plan.weeklyTargets?.length || 0) - weekIndex);
    const goal = plan.goalDailyAverage ?? 0;
    let start = plan.startingDailyAverage ?? 0;
    let totalReduction = Math.max(0, start - goal);
    if (isManualWeeklyPlan(plan)) {
        const manual = plan.manualWeeklyTargets || [];
        const first = parseFloat(manual[0]?.targetAmount) || 0;
        const last = parseFloat(manual[manual.length - 1]?.targetAmount) || 0;
        start = first;
        totalReduction = Math.max(0, first - last);
    }
    const currentDaily = currentWeek?.dailyTarget ?? getDailyLimitForDate(substanceId, today) ?? start;
    const reductionCompleted = isManualWeeklyPlan(plan)
        ? Math.max(0, start - (currentWeek?.targetAmount ?? currentWeek?.weeklyMax ?? currentDaily))
        : Math.max(0, start - currentDaily);

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
    const planCardTitle = document.querySelector('#taper-weekly-plan-card h3');
    if (!plan || !sub || !table) return;

    if (planCardTitle) {
        planCardTitle.textContent = isManualWeeklyPlan(plan) ? 'Weekly Plan Progress' : 'Weekly Plan';
    }

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

    if (isManualWeeklyPlan(plan)) {
        let html = `<table class="taper-preview-table taper-weekly-table"><thead><tr>
            <th>Week</th><th>Goal</th><th>Actual</th><th>%</th><th>Status</th>
        </tr></thead><tbody>`;
        plan.weeklyTargets.forEach(w => {
            const target = w.targetAmount ?? w.weeklyMax ?? 0;
            const pct = target > 0 ? Math.round((w.actualUsed / target) * 100) : 0;
            const { emoji, label } = getManualWeeklyStatus(w.actualUsed, target);
            const rowClass = `manual-week-${w.status}`;
            html += `<tr class="${rowClass}">
                <td>Week ${w.week ?? '—'}</td>
                <td>${target} ${unit}</td>
                <td>${w.actualUsed} ${unit}</td>
                <td>${pct}%</td>
                <td>${emoji} ${label.replace(' target', '')}</td>
            </tr>`;
        });
        html += '</tbody></table>';
        table.innerHTML = html;
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

function renderWeeklyPlanProgressStats(substanceId) {
    const section = document.getElementById('stats-weekly-plan-section');
    const table = document.getElementById('stats-weekly-plan-table');
    const plan = appData.taperPlans[substanceId];
    const sub = getSubstance(substanceId);

    if (!section || !table) return;

    if (!plan || !isManualWeeklyPlan(plan) || !sub?.taperTrackingEnabled) {
        section.classList.add('hidden');
        return;
    }

    section.classList.remove('hidden');
    syncTaperPlanData(substanceId);
    const unit = sub.defaultUnit || 'units';

    if (!plan.weeklyTargets?.length) {
        table.innerHTML = '<p class="empty-hint">No weekly targets in plan.</p>';
        return;
    }

    let html = `<table class="taper-preview-table"><thead><tr>
        <th>Week</th><th>Goal</th><th>Actual</th><th>%</th>
    </tr></thead><tbody>`;
    plan.weeklyTargets.forEach(w => {
        const target = w.targetAmount ?? w.weeklyMax ?? 0;
        const pct = target > 0 ? Math.round((w.actualUsed / target) * 100) : 0;
        html += `<tr class="manual-week-${w.status}">
            <td>${w.week ?? '—'}</td>
            <td>${target} ${unit}</td>
            <td>${w.actualUsed} ${unit}</td>
            <td>${pct}%</td>
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
        if (isManualWeeklyPlan(plan)) {
            const weekCount = plan.manualWeeklyTargets?.length || plan.weeklyTargets?.length || 0;
            const goalPart = plan.goalDailyAverage != null ? ` · goal ${plan.goalDailyAverage} ${sub.defaultUnit}/day` : '';
            dates.textContent = `${formatDate(plan.startDate)} → ${formatDate(plan.endDate)} · ${weekCount} manual week${weekCount === 1 ? '' : 's'}${goalPart}`;
        } else {
            const start = plan.startingDailyAverage ?? plan.currentAvg;
            const goal = plan.goalDailyAverage ?? plan.goalAvg;
            const startPart = start != null ? `${start} → ${goal}` : String(goal ?? '—');
            dates.textContent = `${formatDate(plan.startDate)} → ${formatDate(plan.endDate)} · ${startPart} ${sub.defaultUnit}/day`;
        }
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
    const manualCard = document.getElementById('dashboard-manual-weekly-card');
    if (!sub?.taperTrackingEnabled || !plan || plan.isPaused) {
        section?.classList.add('hidden');
        manualCard?.classList.add('hidden');
        return;
    }
    const today = new Date().toISOString().split('T')[0];
    const dailyLimit = getDailyLimitForDate(substanceId, today);
    const weeklyLimit = getWeeklyLimit(substanceId, today);
    if (dailyLimit == null && weeklyLimit == null) {
        section?.classList.add('hidden');
        manualCard?.classList.add('hidden');
        return;
    }
    section?.classList.remove('hidden');
    syncTaperPlanData(substanceId);

    const usedToday = getUsedAmount(substanceId, today);
    const weeklyUsed = getWeeklyUsed(substanceId, today);
    const unit = sub.defaultUnit;
    const set = (id, text) => { const el = document.getElementById(id); if (el) el.textContent = text; };

    const subLabel = document.getElementById('dashboard-taper-substance-label');
    if (subLabel) subLabel.textContent = `(${sub.name})`;

    const isManual = isManualWeeklyPlan(plan);
    manualCard?.classList.toggle('hidden', true);

    if (isManual) {
        const weekNum = getManualWeeklyWeekNumber(plan, today);
        const weekRow = getCurrentManualWeekRow(plan, today);
        const target = weekRow?.targetAmount ?? weekRow?.weeklyMax ?? weeklyLimit ?? 0;
        const actual = weekRow?.actualUsed ?? weeklyUsed;
        const rem = Math.max(0, target - actual);
        applyTaperProgressBar(
            document.getElementById('dash-manual-week-bar'),
            document.getElementById('dash-manual-week-bar-text'),
            actual,
            target
        );

        set('dash-manual-week-num', `Week ${weekNum}`);
        set('dash-manual-week-target', `${target} ${unit}/week`);
        set('dash-manual-week-actual', `${actual} ${unit}/week`);
        set('dash-manual-week-remaining', `${rem.toFixed(1)} ${unit}`);

        const manualNote = document.getElementById('dashboard-taper-manual-note');
        if (manualNote) {
            manualNote.textContent = `Manual plan · Week ${weekNum}: ${actual}/${target} ${unit}/week`;
            manualNote.classList.remove('hidden');
        }
    } else {
        document.getElementById('dashboard-taper-manual-note')?.classList.add('hidden');
    }

    if (dailyLimit != null) {
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
    }

    if (weeklyLimit != null) {
        const remW = Math.max(0, weeklyLimit - weeklyUsed);
        const weeklyStatus = applyTaperProgressBar(
            document.getElementById('dashboard-weekly-bar'),
            document.getElementById('dashboard-weekly-bar-text'),
            weeklyUsed,
            weeklyLimit
        );
        set('dashboard-weekly-limit', `${weeklyLimit} ${unit}${isManual ? '/week' : ''}`);
        set('dashboard-weekly-used', `${weeklyUsed} ${unit}`);
        set('dashboard-weekly-remaining', `${remW.toFixed(1)} ${unit}`);
        const weeklyStatusEl = document.getElementById('dashboard-weekly-status');
        if (weeklyStatusEl) {
            weeklyStatusEl.textContent = isManual
                ? `Week ${getManualWeeklyWeekNumber(plan, today)}: ${getManualWeeklyStatus(weeklyUsed, weeklyLimit).emoji} ${shortTaperStatus(weeklyStatus)}`
                : getTaperWeeklyStatusText(weeklyStatus);
            weeklyStatusEl.className = `dns-status dns-status-${weeklyStatus}`;
        }
        const overall = document.getElementById('dashboard-taper-overall-status');
        if (overall) {
            const dailyStatus = dailyLimit != null
                ? getTaperLimitStatus(usedToday, dailyLimit).status
                : 'under';
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
    const reductionType = document.getElementById('reduction-type')?.value;
    const startDate = taperEditingPlan && appData.taperPlans[substanceId]?.startDate
        ? appData.taperPlans[substanceId].startDate
        : new Date().toISOString().split('T')[0];

    if (reductionType === 'manual-weekly') {
        const targets = collectManualWeeklyTargetsFromForm();
        if (!targets.length) return alert('Add at least one weekly target.');
        const hasAmount = targets.some(t => (parseFloat(t.targetAmount) || 0) > 0);
        if (!hasAmount) return alert('Enter at least one weekly target amount.');
    } else {
        const endDate = document.getElementById('end-date')?.value;
        if (!endDate || new Date(endDate) <= new Date(startDate)) {
            return alert('Target end date must be after the start date.');
        }
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
    renderTaperCalendarPreview(substanceId);
    renderTaperInsights(substanceId);
    applyCollapsedSections();
}

function renderTaperCalendarPreview(substanceId) {
    const container = document.getElementById('taper-calendar-preview');
    if (!container) return;
    const plan = appData.taperPlans[substanceId];
    const sub = getSubstance(substanceId);
    if (!plan || !sub) {
        container.innerHTML = '<p class="empty-hint">No taper plan for this substance.</p>';
        return;
    }
    const today = new Date();
    let rows = '';
    for (let i = 6; i >= 0; i--) {
        const d = new Date(today);
        d.setDate(d.getDate() - i);
        const dateStr = d.toISOString().split('T')[0];
        const limit = getDailyLimitForDate(substanceId, dateStr);
        const used = getUsedAmount(substanceId, dateStr);
        const status = limit != null ? getTaperLimitStatus(used, limit) : { emoji: '—', label: 'No target' };
        rows += `<tr><td>${formatDate(dateStr)}</td><td>${limit != null ? limit : '—'}</td><td>${used}</td><td>${status.emoji} ${status.label}</td></tr>`;
    }
    container.innerHTML = `<table class="taper-preview-table"><thead><tr><th>Date</th><th>Target</th><th>Used</th><th>Status</th></tr></thead><tbody>${rows}</tbody></table>`;
}

function renderTaperInsights(substanceId) {
    const container = document.getElementById('taper-insights');
    if (!container) return;
    const plan = appData.taperPlans[substanceId];
    const sub = getSubstance(substanceId);
    if (!plan || !sub) {
        container.innerHTML = '<p class="empty-hint">No insights yet.</p>';
        return;
    }
    const unit = sub.defaultUnit;
    const items = [
        ['Plan type', TAPER_REDUCTION_LABELS[plan.reductionType] || plan.reductionType || '—'],
        ['Start average', plan.startingDailyAverage != null ? `${plan.startingDailyAverage} ${unit}/day` : '—'],
        ['Goal average', plan.goalDailyAverage != null ? `${plan.goalDailyAverage} ${unit}/day` : '—'],
        ['Target end', plan.endDate ? formatDate(plan.endDate) : '—'],
        ['Weekly max', plan.weeklyMax != null ? `${plan.weeklyMax} ${unit}` : '—'],
        ['Status', plan.isPaused ? 'Paused' : 'Active']
    ];
    container.innerHTML = items.map(([label, val]) =>
        `<div class="taper-insight-item"><span>${label}</span><strong>${val}</strong></div>`
    ).join('');
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

function getUsedAmountForDate(substanceId, date, excludeLogId = null, data = appData) {
    return getUseEntries(data)
        .filter(log =>
            logMatchesSubstance(log, substanceId, data)
            && log.date === date
            && !logIdEquals(log.id, excludeLogId)
            && isPersonalUseLog(log)
        )
        .reduce((sum, log) => sum + Number(log.amount || 0), 0);
}

function getUsedAmountForWeek(substanceId, date, excludeLogId = null, data = appData) {
    return getUseEntries(data)
        .filter(log =>
            logMatchesSubstance(log, substanceId, data)
            && isSameTaperWeek(log.date, date)
            && !logIdEquals(log.id, excludeLogId)
            && isPersonalUseLog(log)
        )
        .reduce((sum, log) => sum + Number(log.amount || 0), 0);
}

function getUsedAmount(substanceId, dateStr, excludeLogId = null, data = appData) {
    return getUsedAmountForDate(substanceId, dateStr, excludeLogId, data);
}

function getWeekStartDateStr(dateStr) {
    const d = new Date(dateStr + 'T12:00:00');
    d.setDate(d.getDate() - d.getDay());
    return d.toISOString().split('T')[0];
}

function getWeeklyUsed(substanceId, dateStr, excludeLogId = null, data = appData) {
    return getUsedAmountForWeek(substanceId, dateStr, excludeLogId, data);
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
        if (isManualWeeklyPlan(plan)) {
            const weekCount = plan.manualWeeklyTargets?.length || plan.weeklyTargets?.length || 0;
            pl.textContent = `${sub.icon} ${sub.name}: ${weekCount} manual week${weekCount === 1 ? '' : 's'}`;
        } else {
            const startAvg = plan.startingDailyAverage ?? plan.currentAvg;
            const goalAvg = plan.goalDailyAverage ?? plan.goalAvg;
            const range = startAvg != null ? `${startAvg} → ${goalAvg ?? '—'}` : String(goalAvg ?? '—');
            pl.textContent = `${sub.icon} ${sub.name}: ${range} ${sub.defaultUnit}/day`;
        }
    }
}
// ——— History / Calendar ———
function getHistorySubstanceId() {
    const el = document.getElementById('history-substance');
    return el?.value || getMainSubstanceId() || currentSubstanceId || null;
}

function getCalendarTaperSubstanceId() {
    return getHistorySubstanceId();
}

function getHistoryViewMode() {
    return appData.settings?.historyView || 'calendar';
}

function setHistoryView(view) {
    if (!appData.settings) appData.settings = {};
    appData.settings.historyView = view;
    saveData(appData);
    renderHistory();
}

function applyHistoryViewToggleUI() {
    const mode = getHistoryViewMode();
    document.querySelectorAll('.history-view-btn').forEach(btn => {
        btn.classList.toggle('active', btn.dataset.view === mode);
    });
}

function getMonthDateBounds(year, month) {
    const monthStart = `${year}-${String(month + 1).padStart(2, '0')}-01`;
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const monthEnd = `${year}-${String(month + 1).padStart(2, '0')}-${String(daysInMonth).padStart(2, '0')}`;
    return { monthStart, monthEnd, daysInMonth };
}

function getWeeksForMonth(year, month) {
    const { monthStart, monthEnd } = getMonthDateBounds(year, month);
    const weeks = [];
    let cursor = getWeekStartDateStr(monthStart);
    while (cursor <= monthEnd) {
        const fullWeekEnd = addDaysToDateStr(cursor, 6);
        weeks.push({
            fullWeekStart: cursor,
            fullWeekEnd,
            weekStart: cursor < monthStart ? monthStart : cursor,
            weekEnd: fullWeekEnd > monthEnd ? monthEnd : fullWeekEnd
        });
        cursor = addDaysToDateStr(cursor, 7);
    }
    return weeks;
}

function getLogsForWeek(substanceId, weekStart, weekEnd, { personalUseOnly = false, data = appData } = {}) {
    return getUseEntries(data).filter(log => {
        if (!substanceId || !logMatchesSubstance(log, substanceId, data)) return false;
        if (log.date < weekStart || log.date > weekEnd) return false;
        if (personalUseOnly && !isPersonalUseLog(log)) return false;
        return true;
    });
}

function getPurchasesForWeek(substanceId, weekStart, weekEnd, data = appData) {
    return (data.purchases || []).filter(p => {
        if (!substanceId || getPurchaseSubstanceId(p) !== substanceId) return false;
        return p.date >= weekStart && p.date <= weekEnd;
    });
}

function getTaperGoalForWeek(substanceId, weekStart) {
    if (!substanceId) return null;
    return getWeeklyLimit(substanceId, weekStart);
}

function formatWeekRange(weekStart, weekEnd) {
    const s = new Date(weekStart + 'T12:00:00');
    const e = new Date(weekEnd + 'T12:00:00');
    const sMon = s.toLocaleDateString('en-US', { month: 'short' });
    const eMon = e.toLocaleDateString('en-US', { month: 'short' });
    if (sMon === eMon) return `${sMon} ${s.getDate()}–${e.getDate()}`;
    return `${sMon} ${s.getDate()}–${eMon} ${e.getDate()}`;
}

function formatHistoryAmount(value) {
    if (value == null || Number.isNaN(value)) return '—';
    return Number(parseFloat(value).toFixed(1)).toString();
}

function formatDurationColon(hours) {
    if (hours == null || Number.isNaN(hours) || hours <= 0) return '—';
    const totalMinutes = Math.round(hours * 60);
    const h = Math.floor(totalMinutes / 60);
    const m = totalMinutes % 60;
    return `${h}:${String(m).padStart(2, '0')}`;
}

function formatBreakColonHours(hours) {
    if (hours == null || Number.isNaN(hours)) return '—';
    const totalMinutes = Math.floor(hours * 60);
    const h = Math.floor(totalMinutes / 60);
    const m = totalMinutes % 60;
    return `${h}:${String(m).padStart(2, '0')}`;
}

function getWeeklyGoalStatus(actualUse, goalUse) {
    if (goalUse == null || goalUse <= 0) {
        return { status: 'none', label: 'No goal', emoji: '—' };
    }
    if (actualUse > goalUse) {
        return { status: 'over', label: 'Over goal', emoji: '🚫' };
    }
    if (actualUse >= goalUse * 0.8) {
        return { status: 'close', label: 'Close to goal', emoji: '⚠️' };
    }
    return { status: 'under', label: 'Under goal', emoji: '✅' };
}

function findNextPersonalUseLog(substanceId, afterMs, data = appData) {
    return getUseLogsForSubstance(substanceId, { sortAsc: true, personalUseOnly: true, data })
        .find(log => getLogDatetimeMs(log) > afterMs) || null;
}

function calculateWeeklySummary(substanceId, weekStart, weekEnd, data = appData, opts = {}) {
    const dayBreakdownStart = opts.dayBreakdownStart || weekStart;
    const dayBreakdownEnd = opts.dayBreakdownEnd || weekEnd;
    const goalWeekStart = opts.goalWeekStart || weekStart;
    const personalLogs = getLogsForWeek(substanceId, weekStart, weekEnd, { personalUseOnly: true, data });
    const allLogs = getLogsForWeek(substanceId, weekStart, weekEnd, { data });
    const purchases = getPurchasesForWeek(substanceId, weekStart, weekEnd, data);
    const enrichedAll = buildEnrichedUseEntries(substanceId);
    const personalEnriched = enrichedAll.filter(e => e.date >= weekStart && e.date <= weekEnd && isPersonalUseLog(e));

    const totalUse = personalLogs.reduce((sum, log) => sum + (parseFloat(log.amount) || 0), 0);
    const sessionCount = personalLogs.length;
    let totalDurationHours = 0;
    personalEnriched.forEach(entry => {
        if (entry.durationHours) totalDurationHours += entry.durationHours;
    });

    const avgPerSession = sessionCount > 0 ? totalUse / sessionCount : null;
    const avgRate = totalDurationHours > 0 ? totalUse / totalDurationHours : null;

    const breaks = [];
    personalEnriched.forEach((entry, index) => {
        if (index === 0 && entry.breakDurationHours != null) breaks.push(entry.breakDurationHours);
        else if (index > 0 && entry.breakDurationHours != null) breaks.push(entry.breakDurationHours);
    });
    const longestBreak = breaks.length ? Math.max(...breaks) : null;
    const avgBreak = breaks.length ? breaks.reduce((a, b) => a + b, 0) / breaks.length : null;

    const purchaseCount = purchases.length;
    const totalBought = purchases.reduce((sum, p) => sum + (parseFloat(getPurchaseQuantity(p)) || 0), 0);
    const totalSpent = purchases.reduce((sum, p) => sum + (parseFloat(getPurchaseTotalCost(p)) || 0), 0);

    const goalUse = getTaperGoalForWeek(substanceId, goalWeekStart);
    const left = goalUse != null && goalUse > 0 ? goalUse - totalUse : null;
    const difference = goalUse != null && goalUse > 0 ? totalUse - goalUse : null;
    const goalStatus = getWeeklyGoalStatus(totalUse, goalUse);

    const days = [];
    for (let d = dayBreakdownStart; d <= dayBreakdownEnd; d = addDaysToDateStr(d, 1)) {
        const dayPersonal = getLogsForWeek(substanceId, d, d, { personalUseOnly: true, data });
        const dayAll = getLogsForWeek(substanceId, d, d, { data });
        const dayUse = dayPersonal.reduce((sum, log) => sum + (parseFloat(log.amount) || 0), 0);
        let dayDuration = 0;
        personalEnriched.filter(entry => entry.date === d).forEach(entry => {
            if (entry.durationHours) dayDuration += entry.durationHours;
        });
        const dayEnriched = personalEnriched.filter(entry => entry.date === d);
        const breakHours = dayEnriched[0]?.breakDurationHours ?? null;
        let nextSession = null;
        if (dayEnriched.length) {
            const lastDayEntry = dayEnriched[dayEnriched.length - 1];
            const afterMs = getLogDatetimeMs(lastDayEntry);
            const nextLog = findNextPersonalUseLog(substanceId, afterMs, data);
            if (nextLog) {
                nextSession = parseUseDateTime(nextLog.date, nextLog.startTime || nextLog.time);
            }
        }
        const dailyLimit = substanceId ? getDailyLimitForDate(substanceId, d) : null;
        const dailyStatus = getTaperLimitStatus(dayUse, dailyLimit).status;
        const giftLogs = dayAll.filter(log => !isPersonalUseLog(log));
        days.push({
            date: d,
            use: dayUse,
            durationHours: dayDuration,
            sessions: dayPersonal.length,
            breakHours,
            nextSession,
            dailyLimit,
            dailyStatus,
            giftLogs
        });
    }

    const sub = getSubstance(substanceId);
    const unit = sub?.defaultUnit || '';
    const summaryText = buildWeeklySummaryText({
        weekStart,
        weekEnd,
        totalUse,
        sessionCount,
        totalDurationHours,
        goalUse,
        left
    }, unit);

    return {
        weekStart,
        weekEnd,
        totalUse,
        sessionCount,
        totalDurationHours,
        avgPerSession,
        avgRate,
        longestBreak,
        avgBreak,
        purchaseCount,
        totalBought,
        totalSpent,
        goalUse,
        left,
        difference,
        goalStatus,
        days,
        summaryText
    };
}

function buildWeeklySummaryText(summary, unit) {
    const range = formatWeekRange(summary.weekStart, summary.weekEnd);
    const dur = formatDurationHours(summary.totalDurationHours);
    let text = `Week of ${range}: ${formatHistoryAmount(summary.totalUse)}${unit} used across ${summary.sessionCount} session${summary.sessionCount === 1 ? '' : 's'}`;
    if (summary.totalDurationHours > 0) text += `, ${dur} total duration`;
    text += '.';
    if (summary.goalUse != null && summary.goalUse > 0) {
        const left = summary.left ?? 0;
        if (left >= 0) {
            text += ` Goal was ${formatHistoryAmount(summary.goalUse)}${unit}, leaving ${formatHistoryAmount(left)}${unit} under target.`;
        } else {
            text += ` Goal was ${formatHistoryAmount(summary.goalUse)}${unit}, ${formatHistoryAmount(Math.abs(left))}${unit} over target.`;
        }
    } else {
        text += ' No weekly goal set.';
    }
    return text;
}

function calculateMonthlyHistorySummary(substanceId, year, month, data = appData) {
    const { monthStart, monthEnd } = getMonthDateBounds(year, month);
    const weeks = getWeeksForMonth(year, month);
    const weekSummaries = weeks.map(w => calculateWeeklySummary(substanceId, w.weekStart, w.weekEnd, data, {
        goalWeekStart: w.fullWeekStart,
        dayBreakdownStart: w.fullWeekStart,
        dayBreakdownEnd: w.fullWeekEnd
    }));

    const personalLogs = getUseEntries(data).filter(log =>
        logMatchesSubstance(log, substanceId, data)
        && isPersonalUseLog(log)
        && log.date >= monthStart
        && log.date <= monthEnd
    );
    const enriched = buildEnrichedUseEntries(substanceId);
    const monthEnriched = enriched.filter(e => e.date >= monthStart && e.date <= monthEnd && isPersonalUseLog(e));

    const totalUse = personalLogs.reduce((sum, log) => sum + (parseFloat(log.amount) || 0), 0);
    const totalSessions = personalLogs.length;
    const totalDurationHours = monthEnriched.reduce((sum, e) => sum + (e.durationHours || 0), 0);

    const purchases = (data.purchases || []).filter(p =>
        getPurchaseSubstanceId(p) === substanceId && p.date >= monthStart && p.date <= monthEnd
    );
    const totalPurchases = purchases.length;
    const totalSpent = purchases.reduce((sum, p) => sum + (parseFloat(getPurchaseTotalCost(p)) || 0), 0);

    const activeWeeks = weekSummaries.filter(w => w.sessionCount > 0 || w.totalUse > 0);
    const avgUsePerWeek = activeWeeks.length ? totalUse / activeWeeks.length : 0;

    const allBreaks = monthEnriched
        .map(e => e.breakDurationHours)
        .filter(h => h != null && h >= 0);
    const bestBreak = allBreaks.length ? Math.max(...allBreaks) : null;

    const overGoalWeeks = weekSummaries.filter(w => w.goalStatus.status === 'over').length;
    const underGoalWeeks = weekSummaries.filter(w => w.goalStatus.status === 'under').length;

    return {
        monthStart,
        monthEnd,
        totalUse,
        totalSessions,
        totalDurationHours,
        totalPurchases,
        totalSpent,
        avgUsePerWeek,
        bestBreak,
        overGoalWeeks,
        underGoalWeeks,
        weekSummaries
    };
}

function renderHistory() {
    applyHistoryViewToggleUI();
    const year = currentCalendarDate.getFullYear();
    const month = currentCalendarDate.getMonth();
    setText('calendar-month', currentCalendarDate.toLocaleDateString('en-US', { month: 'long', year: 'numeric' }));

    renderMonthlyHistorySummary(year, month);

    const mode = getHistoryViewMode();
    document.getElementById('history-calendar-view')?.classList.toggle('hidden', mode !== 'calendar');
    document.getElementById('history-weekly-view')?.classList.toggle('hidden', mode !== 'weekly');
    document.getElementById('history-monthly-view')?.classList.toggle('hidden', mode !== 'monthly');

    if (mode === 'calendar') {
        renderCalendar();
        renderWeeklyTotalsTable(year, month);
    } else if (mode === 'weekly') {
        renderWeeklySummary(year, month);
    } else {
        renderMonthlyHistoryDetail(year, month);
    }
}

function renderMonthlyHistorySummary(year, month) {
    const container = document.getElementById('history-monthly-summary');
    if (!container) return;
    const substanceId = getHistorySubstanceId();
    const sub = getSubstance(substanceId);
    if (!substanceId || !sub) {
        container.innerHTML = '<p class="empty-hint">Select a substance to view history.</p>';
        return;
    }
    const summary = calculateMonthlyHistorySummary(substanceId, year, month);
    const unit = sub.defaultUnit;
    const currency = appData.settings.currency || '$';
    const tiles = [
        ['Total use', `${formatHistoryAmount(summary.totalUse)} ${unit}`],
        ['Sessions', String(summary.totalSessions)],
        ['Duration', formatDurationHours(summary.totalDurationHours)],
        ['Purchases', String(summary.totalPurchases)],
        ['Spent', `${currency}${summary.totalSpent.toFixed(2)}`],
        ['Avg / week', `${formatHistoryAmount(summary.avgUsePerWeek)} ${unit}`],
        ['Best break', formatBreakColonHours(summary.bestBreak)],
        ['Over-goal weeks', String(summary.overGoalWeeks)],
        ['Under-goal weeks', String(summary.underGoalWeeks)]
    ];
    container.innerHTML = `
        <h3 class="history-section-title">Monthly Summary</h3>
        <div class="history-monthly-grid">${tiles.map(([label, value]) =>
            `<div class="history-stat-tile"><span>${label}</span><strong>${value}</strong></div>`
        ).join('')}</div>`;
}

function renderWeeklyTotalsTable(year, month) {
    const container = document.getElementById('history-weekly-totals');
    if (!container) return;
    const substanceId = getHistorySubstanceId();
    const sub = getSubstance(substanceId);
    if (!substanceId || !sub) {
        container.innerHTML = '';
        return;
    }
    const unit = sub.defaultUnit;
    const currency = appData.settings.currency || '$';
    const weeks = getWeeksForMonth(year, month);
    const rows = weeks.map(w => calculateWeeklySummary(substanceId, w.weekStart, w.weekEnd, appData, {
        goalWeekStart: w.fullWeekStart,
        dayBreakdownStart: w.fullWeekStart,
        dayBreakdownEnd: w.fullWeekEnd
    }));

    if (!rows.some(r => r.sessionCount > 0 || r.totalUse > 0 || r.purchaseCount > 0)) {
        container.innerHTML = '<h3 class="history-section-title">Weekly Totals</h3><p class="empty-hint">No activity this month.</p>';
        return;
    }

    container.innerHTML = `
        <h3 class="history-section-title">Weekly Totals</h3>
        <div class="table-scroll">
            <table class="history-table history-weekly-table">
                <thead>
                    <tr>
                        <th>Week Start</th>
                        <th>Week End</th>
                        <th>Total Use</th>
                        <th>Sessions</th>
                        <th>Duration</th>
                        <th>Avg ${unit}/session</th>
                        <th>Avg ${unit}/hr</th>
                        <th>Longest Break</th>
                        <th>Avg Break</th>
                        <th>Purchases</th>
                        <th>Total Bought</th>
                        <th>Total Spent</th>
                        <th>Goal</th>
                        <th>Left</th>
                    </tr>
                </thead>
                <tbody>
                    ${rows.map(row => `
                        <tr>
                            <td>${formatDate(row.weekStart)}</td>
                            <td>${formatDate(row.weekEnd)}</td>
                            <td>${formatHistoryAmount(row.totalUse)} ${unit}</td>
                            <td>${row.sessionCount}</td>
                            <td>${formatDurationHours(row.totalDurationHours)}</td>
                            <td>${row.avgPerSession != null ? formatHistoryAmount(row.avgPerSession) : '—'}</td>
                            <td>${row.avgRate != null ? formatHistoryAmount(row.avgRate) : '—'}</td>
                            <td>${formatBreakColonHours(row.longestBreak)}</td>
                            <td>${formatBreakColonHours(row.avgBreak)}</td>
                            <td>${row.purchaseCount}</td>
                            <td>${formatHistoryAmount(row.totalBought)} ${unit}</td>
                            <td>${currency}${row.totalSpent.toFixed(2)}</td>
                            <td>${row.goalUse != null && row.goalUse > 0 ? `${formatHistoryAmount(row.goalUse)} ${unit}` : '—'}</td>
                            <td class="history-goal-${row.goalStatus.status}">${row.left != null ? `${formatHistoryAmount(row.left)} ${unit}` : '—'}</td>
                        </tr>
                    `).join('')}
                </tbody>
            </table>
        </div>`;
}

function renderWeeklyGoalComparisonRow(row, unit) {
    const gs = row.goalStatus;
    return `
        <tr class="history-goal-row history-goal-${gs.status}">
            <td>${formatWeekRange(row.weekStart, row.weekEnd)}</td>
            <td>${row.goalUse != null && row.goalUse > 0 ? `${formatHistoryAmount(row.goalUse)} ${unit}` : '—'}</td>
            <td>${formatHistoryAmount(row.totalUse)} ${unit}</td>
            <td>${row.left != null ? `${formatHistoryAmount(row.left)} ${unit}` : '—'}</td>
            <td>${row.difference != null ? `${row.difference >= 0 ? '+' : ''}${formatHistoryAmount(row.difference)} ${unit}` : '—'}</td>
            <td>${gs.emoji} ${gs.label}</td>
        </tr>`;
}

function renderWeeklyDayBreakdown(days, unit, monthStart, monthEnd) {
    const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    return `
        <div class="history-week-days">
            ${days.map(day => {
                const d = new Date(day.date + 'T12:00:00');
                const dayLabel = dayNames[d.getDay()];
                const dateShort = d.toLocaleDateString('en-US', { month: 'numeric', day: 'numeric' });
                const nextLabel = day.nextSession ? formatDatetimeShort(day.nextSession) : '—';
                const outsideMonth = monthStart && monthEnd && (day.date < monthStart || day.date > monthEnd);
                const gifts = day.giftLogs.length
                    ? `<div class="history-day-gifts">${day.giftLogs.map(log => {
                        const sub = getSubstance(log.substanceId);
                        return `<small>${formatLogHistoryLabel(log, sub)}</small>`;
                    }).join('')}</div>`
                    : '';
                return `
                    <div class="history-day-cell history-day-${day.dailyStatus}${day.sessions === 0 && !day.giftLogs.length ? ' history-day-empty' : ''}${outsideMonth ? ' history-day-outside' : ''}">
                        <div class="history-day-head">${dayLabel}</div>
                        <div class="history-day-date">${dateShort} ${dayLabel.slice(0, 3)}</div>
                        <div class="history-day-stat">Use: ${day.sessions ? `${formatHistoryAmount(day.use)}${unit}` : '—'}</div>
                        <div class="history-day-stat">Dur: ${formatDurationColon(day.durationHours)}</div>
                        <div class="history-day-stat">Sessions: ${day.sessions || '—'}</div>
                        <div class="history-day-stat">Break: ${formatBreakColonHours(day.breakHours)}</div>
                        <div class="history-day-stat">Next: ${nextLabel}</div>
                        ${gifts}
                    </div>`;
            }).join('')}
        </div>`;
}

function renderWeeklySummaryCard(row, unit, currency, monthStart, monthEnd) {
    return `
        <article class="history-week-card">
            <header class="history-week-card-header">
                <h4>${formatWeekRange(row.weekStart, row.weekEnd)}</h4>
                <div class="history-week-quick-stats">
                    <span>Use: ${formatHistoryAmount(row.totalUse)}${unit}</span>
                    <span>Sessions: ${row.sessionCount}</span>
                    <span>Duration: ${formatDurationHours(row.totalDurationHours)}</span>
                    ${row.goalUse != null && row.goalUse > 0 ? `<span>Goal: ${formatHistoryAmount(row.goalUse)}${unit}</span><span>Left: ${formatHistoryAmount(row.left)}${unit}</span>` : ''}
                </div>
            </header>
            <p class="history-week-summary-text">${row.summaryText}</p>
            <div class="table-scroll">
                <table class="history-table history-goal-table">
                    <thead>
                        <tr>
                            <th>Week</th>
                            <th>Goal Use</th>
                            <th>Actual Use</th>
                            <th>Left</th>
                            <th>Difference</th>
                            <th>Status</th>
                        </tr>
                    </thead>
                    <tbody>${renderWeeklyGoalComparisonRow(row, unit)}</tbody>
                </table>
            </div>
            <h5 class="history-subsection-title">Day Breakdown</h5>
            ${renderWeeklyDayBreakdown(row.days, unit, monthStart, monthEnd)}
            <div class="history-week-meta">
                <span>Avg: ${row.avgPerSession != null ? `${formatHistoryAmount(row.avgPerSession)}${unit}/session` : '—'}</span>
                <span>Purchases: ${row.purchaseCount} · ${currency}${row.totalSpent.toFixed(2)}</span>
            </div>
        </article>`;
}

function renderWeeklySummary(year, month) {
    const container = document.getElementById('history-weekly-view');
    if (!container) return;
    const substanceId = getHistorySubstanceId();
    const sub = getSubstance(substanceId);
    if (!substanceId || !sub) {
        container.innerHTML = '<p class="empty-hint">Select a substance to view weekly summary.</p>';
        return;
    }
    const unit = sub.defaultUnit;
    const currency = appData.settings.currency || '$';
    const { monthStart, monthEnd } = getMonthDateBounds(year, month);
    const weeks = getWeeksForMonth(year, month);
    const rows = weeks.map(w => calculateWeeklySummary(substanceId, w.weekStart, w.weekEnd, appData, {
        goalWeekStart: w.fullWeekStart,
        dayBreakdownStart: w.fullWeekStart,
        dayBreakdownEnd: w.fullWeekEnd
    }));
    const activeRows = rows.filter(r => r.sessionCount > 0 || r.totalUse > 0 || r.purchaseCount > 0 || (r.goalUse != null && r.goalUse > 0));

    if (!activeRows.length) {
        container.innerHTML = '<p class="empty-hint">No weekly activity this month.</p>';
        return;
    }

    container.innerHTML = activeRows.map(row => renderWeeklySummaryCard(row, unit, currency, monthStart, monthEnd)).join('');
}

function renderMonthlyHistoryDetail(year, month) {
    const container = document.getElementById('history-monthly-view');
    if (!container) return;
    const substanceId = getHistorySubstanceId();
    const sub = getSubstance(substanceId);
    if (!substanceId || !sub) {
        container.innerHTML = '<p class="empty-hint">Select a substance to view monthly summary.</p>';
        return;
    }
    const { monthStart, monthEnd } = getMonthDateBounds(year, month);
    const summary = calculateMonthlyHistorySummary(substanceId, year, month);
    const unit = sub.defaultUnit;
    const currency = appData.settings.currency || '$';

    const goalRows = summary.weekSummaries.filter(w =>
        w.sessionCount > 0 || w.totalUse > 0 || (w.goalUse != null && w.goalUse > 0)
    );

    container.innerHTML = `
        <div class="history-monthly-detail">
            <p class="history-monthly-intro">Overview for ${currentCalendarDate.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })} — ${sub.icon} ${sub.name}</p>
            <div class="table-scroll">
                <table class="history-table history-goal-table">
                    <thead>
                        <tr>
                            <th>Week</th>
                            <th>Goal Use</th>
                            <th>Actual Use</th>
                            <th>Left</th>
                            <th>Difference</th>
                            <th>Status</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${goalRows.length
                            ? goalRows.map(row => renderWeeklyGoalComparisonRow(row, unit)).join('')
                            : '<tr><td colspan="6" class="empty-hint">No weekly data this month.</td></tr>'}
                    </tbody>
                </table>
            </div>
            <h3 class="history-section-title">Weekly Breakdown</h3>
            ${goalRows.length
                ? goalRows.map(row => renderWeeklySummaryCard(row, unit, currency, monthStart, monthEnd)).join('')
                : '<p class="empty-hint">No activity recorded this month.</p>'}
        </div>`;
}

function renderCalendar() {
    const container = document.getElementById('calendar-grid');
    if (!container) return;
    container.innerHTML = '';
    const year = currentCalendarDate.getFullYear();
    const month = currentCalendarDate.getMonth();

    ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].forEach(day => {
        const h = document.createElement('div');
        h.className = 'calendar-day-header';
        h.textContent = day;
        container.appendChild(h);
    });

    const firstDay = new Date(year, month, 1).getDay();
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const today = new Date().toISOString().split('T')[0];
    const substanceId = getHistorySubstanceId();

    for (let i = 0; i < firstDay; i++) container.appendChild(document.createElement('div'));

    for (let day = 1; day <= daysInMonth; day++) {
        const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
        const dayLogs = appData.logs.filter(l =>
            l.date === dateStr && (!substanceId || logMatchesSubstance(l, substanceId))
        );
        const dayCravings = appData.cravings.filter(c =>
            c.date === dateStr && (!substanceId || c.substanceId === substanceId)
        );
        const cell = document.createElement('div');
        cell.className = 'calendar-day';
        if (dayLogs.length || dayCravings.length) cell.classList.add('has-data');
        if (dateStr === today) cell.classList.add('today');
        if (dateStr === selectedDate) cell.classList.add('selected');

        if (substanceId) {
            const dayStatus = getTaperDayStatus(substanceId, dateStr);
            if (dayStatus === 'none') cell.classList.add('taper-none');
            else if (dayStatus) cell.classList.add(`taper-${dayStatus}`);
        }

        const personalUse = dayLogs.filter(isPersonalUseLog);
        const dayTotal = personalUse.reduce((s, l) => s + (parseFloat(l.amount) || 0), 0);
        const sub = substanceId ? getSubstance(substanceId) : null;
        cell.innerHTML = `<span>${day}</span>${sub ? `<div class="substance-indicators"><span class="substance-indicator" style="color:${sub.color}">${sub.icon}</span></div>` : ''}${dayTotal > 0 ? `<span class="calendar-day-count">${formatHistoryAmount(dayTotal)}</span>` : ''}`;
        cell.onclick = () => selectDate(dateStr);
        container.appendChild(cell);
    }
}

function changeMonth(delta) {
    currentCalendarDate.setMonth(currentCalendarDate.getMonth() + delta);
    renderHistory();
}

function selectDate(dateStr) {
    selectedDate = dateStr;
    renderHistory();
    renderDayDetails(dateStr);
}

function renderDayDetails(dateStr) {
    const container = document.getElementById('day-details-content');
    if (!container) return;
    const substanceId = getHistorySubstanceId();
    const dayLogs = appData.logs.filter(l =>
        l.date === dateStr && (!substanceId || logMatchesSubstance(l, substanceId))
    );
    const dayCravings = appData.cravings.filter(c =>
        c.date === dateStr && (!substanceId || c.substanceId === substanceId)
    );
    const sub = substanceId ? getSubstance(substanceId) : null;
    const limit = substanceId ? getDailyLimitForDate(substanceId, dateStr) : null;
    const used = substanceId ? getUsedAmount(substanceId, dateStr) : 0;
    const currency = appData.settings.currency || '$';

    const dayPurchaseSpend = (appData.purchases || [])
        .filter(p => p.date === dateStr && (!substanceId || getPurchaseSubstanceId(p) === substanceId))
        .reduce((s, p) => s + (parseFloat(getPurchaseTotalCost(p)) || 0), 0);

    let html = `<p><strong>${formatDate(dateStr)}</strong></p>`;
    html += `<p>Personal use: ${formatHistoryAmount(used)}${sub ? ` ${sub.defaultUnit}` : ''}</p>`;
    html += `<p>Purchases: ${currency}${dayPurchaseSpend.toFixed(2)}</p>`;
    html += `<p>Cravings: ${dayCravings.length}</p>`;

    if (limit != null && sub) {
        const { emoji, label } = getTaperLimitStatus(used, limit);
        html += `<p>Taper (${sub.name}): ${used}/${limit} ${sub.defaultUnit} · ${emoji} ${label}</p>`;
    }

    dayLogs.forEach(log => {
        const logSub = getSubstance(log.substanceId);
        const supplyLine = formatInventoryLinkDisplay(log);
        const label = isPersonalUseLog(log)
            ? `${logSub?.icon} ${log.amount} ${log.unit} ${logSub?.name} at ${log.startTime || log.time || ''}`
            : `${formatLogHistoryLabel(log, logSub)} at ${log.startTime || log.time || ''}`;
        html += `<div class="list-item"><div>${label}<br><small>${supplyLine}</small></div></div>`;
    });
    dayCravings.forEach(c => {
        const cravingSub = getSubstance(c.substanceId);
        html += `<div class="list-item"><div>${cravingSub?.icon} Craving ${c.intensity}/10</div></div>`;
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
            transactionType: getLogTransactionType(l),
            substanceId: l.substanceId || l.substance || '',
            date: l.date,
            startTime: l.startTime || l.time || '',
            endTime: l.endTime || '',
            amount: Number(l.amount || 0),
            unit: l.unit || 'units',
            count: Number(l.count || 0),
            giftPartyName: l.giftPartyName || '',
            adjustmentDirection: l.adjustmentDirection || null,
            notes: l.notes || '',
            linkedPurchaseId: l.linkedPurchaseId || null,
            linkedPurchases: l.linkedPurchases || [],
            inventoryAffects: logInventoryAffects(l),
            supplyUnlinked: !logInventoryAffects(l),
            ...(l.breakMinutes != null ? {
                breakMinutes: l.breakMinutes,
                breakHours: l.breakHours,
                breakText: l.breakText
            } : {}),
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
            ...(p.buyBreakMinutes != null ? {
                buyBreakMinutes: p.buyBreakMinutes,
                buyBreakHours: p.buyBreakHours,
                buyBreakText: p.buyBreakText
            } : {}),
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
    if (!Array.isArray(data.logs) && Array.isArray(data.useLogs)) {
        data.logs = data.useLogs;
    }
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
    if (Array.isArray(imported.useLogs)) {
        imported.logs = mergeArrayById(imported.logs || [], imported.useLogs);
        delete imported.useLogs;
    }
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
        deleteSubstance,
        startBulkLinkSessions,
        closeBulkLinkModal,
        applyBulkLinkPreview
    });
}
