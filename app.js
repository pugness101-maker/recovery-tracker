// Recovery Tracker v2 — dynamic substance tracking
const STORAGE_KEY = 'recovery-tracker-v2';
const STORAGE_KEY_V1 = 'use-tracker-v1';
const LAST_SAVED_KEY = 'recovery-tracker-v2-last-saved';
const AUTO_BACKUP_KEY = 'recovery-tracker-v2-auto-backup';
const DASHBOARD_ALL = 'all';

const SUBSTANCE_ICONS = ['🚬', '💨', '🍺', '🌿', '💊', '☕', '🍬', '💉', '🎯', '⚡', '🧪', '📦', '🔥', '❄️', '💧', '🌸', '🌀'];
const SUBSTANCE_COLORS = ['#4caf50', '#42a5f5', '#ffb74d', '#66bb6a', '#ab47bc', '#ef5350', '#78909c', '#26a69a', '#ff7043', '#5c6bc0'];

const V1_NAME_TO_ID = {
    'Cigarettes': 'cigarettes',
    'Vapes/Nicotine': 'vape-nicotine',
    'Vape/Nicotine': 'vape-nicotine',
    'Coke': 'coke',
    'Alcohol': 'alcohol',
    'Weed/THC': 'weed-thc',
    'Caffeine': 'caffeine',
    'LSD': 'lsd',
    'Molly': 'molly',
    'Xannax': 'xannax',
    'Ketamine': 'ketamine'
};

const SUBSTANCE_NAME_ALIASES = {
    'vapes/nicotine': 'vape/nicotine',
    'vape nicotine': 'vape/nicotine',
    'nicotine': 'vape/nicotine',
    'cocaine': 'coke',
    'weed': 'weed/thc',
    'thc': 'weed/thc',
    'marijuana': 'weed/thc',
    'cigs': 'cigarettes',
    'cigarette': 'cigarettes',
    'xanax': 'xannax',
    'xannax': 'xannax',
    'mdma': 'molly',
    'ecstasy': 'molly',
    'acid': 'lsd',
    'alchocol': 'alcohol'
};

function normalizeSubstanceName(name) {
    if (name == null || name === '') return '';
    const normalized = String(name).trim().toLowerCase().replace(/\s+/g, ' ');
    return SUBSTANCE_NAME_ALIASES[normalized] || normalized;
}

const VAPE_NICOTINE_ID = 'vape-nicotine';

const DEFAULT_SUBSTANCE_CATALOG = [
    {
        id: 'vape-nicotine',
        name: 'Vape/Nicotine',
        icon: '💨',
        color: '#42a5f5',
        trackingMode: 'vape',
        primaryUnit: 'puffs',
        units: ['puffs', 'hits', 'pods', 'disposable', 'ml'],
        defaultUnit: 'puffs',
        costTrackingEnabled: true,
        taperTrackingEnabled: true,
        isMain: true
    },
    {
        id: 'coke',
        name: 'Coke',
        icon: '❄️',
        color: '#90caf9',
        trackingMode: 'powder',
        primaryUnit: 'g',
        secondaryCountLabel: 'lines',
        units: ['g', 'grams', 'lines', 'bumps'],
        defaultUnit: 'g',
        costTrackingEnabled: true,
        taperTrackingEnabled: true
    },
    {
        id: 'alcohol',
        name: 'Alcohol',
        icon: '🍺',
        color: '#ffb74d',
        trackingMode: 'alcohol',
        primaryUnit: 'drinks',
        units: ['drinks', 'beers', 'shots', 'ounces'],
        defaultUnit: 'drinks',
        costTrackingEnabled: true,
        taperTrackingEnabled: true
    },
    {
        id: 'weed-thc',
        name: 'Weed/THC',
        icon: '🌿',
        color: '#66bb6a',
        trackingMode: 'weed',
        primaryUnit: 'hits',
        units: ['hits', 'grams', 'joints', 'bowls', 'edibles'],
        defaultUnit: 'hits',
        costTrackingEnabled: true,
        taperTrackingEnabled: true
    },
    {
        id: 'caffeine',
        name: 'Caffeine',
        icon: '☕',
        color: '#8d6e63',
        trackingMode: 'caffeine',
        primaryUnit: 'mg',
        units: ['mg', 'cups', 'drinks', 'pills'],
        defaultUnit: 'mg',
        costTrackingEnabled: true,
        taperTrackingEnabled: true
    },
    {
        id: 'lsd',
        name: 'LSD',
        icon: '🧪',
        color: '#7e57c2',
        trackingMode: 'dose',
        primaryUnit: 'tabs',
        units: ['tabs', 'ug', 'hits'],
        defaultUnit: 'tabs',
        costTrackingEnabled: true,
        taperTrackingEnabled: true
    },
    {
        id: 'molly',
        name: 'Molly',
        icon: '💊',
        color: '#ec407a',
        trackingMode: 'dose',
        primaryUnit: 'mg',
        units: ['mg', 'pills', 'grams'],
        defaultUnit: 'mg',
        costTrackingEnabled: true,
        taperTrackingEnabled: true
    },
    {
        id: 'xannax',
        name: 'Xannax',
        icon: '💊',
        color: '#5c6bc0',
        trackingMode: 'dose',
        primaryUnit: 'mg',
        units: ['mg', 'pills', 'bars'],
        defaultUnit: 'mg',
        costTrackingEnabled: true,
        taperTrackingEnabled: true
    },
    {
        id: 'ketamine',
        name: 'Ketamine',
        icon: '🌀',
        color: '#26c6da',
        trackingMode: 'powder',
        primaryUnit: 'g',
        units: ['g', 'mg', 'bumps', 'lines'],
        defaultUnit: 'g',
        costTrackingEnabled: true,
        taperTrackingEnabled: true
    },
    {
        id: 'cigarettes',
        name: 'Cigarettes',
        icon: '🚬',
        color: '#78909c',
        trackingMode: 'cigarettes',
        primaryUnit: 'cigarettes',
        units: ['cigarettes', 'packs'],
        defaultUnit: 'cigarettes',
        costTrackingEnabled: true,
        taperTrackingEnabled: true
    }
];

const DEFAULT_SUBSTANCE_IDS = DEFAULT_SUBSTANCE_CATALOG.map(s => s.id);

const SUBSTANCE_TRACKING_DEFAULTS = Object.fromEntries(
    DEFAULT_SUBSTANCE_CATALOG.map(entry => [entry.id, {
        trackingMode: entry.trackingMode,
        primaryUnit: entry.primaryUnit,
        secondaryCountLabel: entry.secondaryCountLabel ?? null
    }])
);

function getSubstanceTrackingDefaults(substanceId) {
    return SUBSTANCE_TRACKING_DEFAULTS[substanceId] || {};
}

function inferTrackingModeFromSubstance(sub) {
    if (!sub) return 'standard';
    if (sub.id === 'coke' || normalizeSubstanceName(sub.name) === 'coke') return 'powder';
    const idDefaults = getSubstanceTrackingDefaults(sub.id);
    if (idDefaults.trackingMode) return idDefaults.trackingMode;
    const name = normalizeSubstanceName(sub.name);
    if (name === 'vape/nicotine' || (name.includes('vape') && name.includes('nicotine'))) return 'vape';
    if (name.includes('cigarette')) return 'cigarettes';
    if (name === 'coke' || name.includes('cocaine')) return 'powder';
    return 'standard';
}

function getSubstanceTrackingMode(substanceId, data = appData) {
    if (!substanceId) return 'standard';
    if (substanceId === 'coke') return 'powder';
    const sub = typeof getSubstance === 'function' ? getSubstance(substanceId, data) : null;
    if (sub) {
        if (sub.id === 'coke' || normalizeSubstanceName(sub.name) === 'coke') return 'powder';
        if (sub.trackingMode) return sub.trackingMode;
        return inferTrackingModeFromSubstance(sub);
    }
    return getSubstanceTrackingDefaults(substanceId).trackingMode || 'standard';
}

function isVapeTrackingMode(substanceId, data = appData) {
    if (!substanceId || substanceId === 'coke') return false;
    return getSubstanceTrackingMode(substanceId, data) === 'vape';
}

function isPowderTrackingMode(substanceId, data = appData) {
    return getSubstanceTrackingMode(substanceId, data) === 'powder';
}

function isAlcoholTrackingMode(substanceId, data = appData) {
    return getSubstanceTrackingMode(substanceId, data) === 'alcohol';
}

function isWeedTrackingMode(substanceId, data = appData) {
    return getSubstanceTrackingMode(substanceId, data) === 'weed';
}

function isWeedDateOnlyUseForm() {
    return isWeedTrackingMode(document.getElementById('use-substance')?.value);
}

function isWeedDateOnlyUseLog(log, data = appData) {
    if (!log || !isWeedTrackingMode(getUseSubstanceId(log, data), data)) return false;
    return log.logMode === 'amount' || getUseLogType(log) === 'quick' || !log.endTime;
}

function isCigarettesTrackingMode(substanceId, data = appData) {
    return getSubstanceTrackingMode(substanceId, data) === 'cigarettes';
}

function isVapeTaperSubstanceId(substanceId, data = appData) {
    return isVapeTrackingMode(substanceId, data);
}

function getSubstancePrimaryUnit(substanceId, data = appData) {
    const sub = typeof getSubstance === 'function' ? getSubstance(substanceId, data) : null;
    return sub?.primaryUnit
        || getSubstanceTrackingDefaults(substanceId).primaryUnit
        || sub?.defaultUnit
        || 'units';
}

function getSubstanceSecondaryCountLabel(substanceId, data = appData) {
    const sub = typeof getSubstance === 'function' ? getSubstance(substanceId, data) : null;
    return sub?.secondaryCountLabel
        ?? getSubstanceTrackingDefaults(substanceId).secondaryCountLabel
        ?? null;
}

function formatSecondaryCountDisplay(substanceId, count, data = appData) {
    const label = getSubstanceSecondaryCountLabel(substanceId, data);
    if (!label || count === '' || count == null || count === 0) return '';
    return `${count} ${label}`;
}

function getSubstanceDisplayName(sub, data = appData) {
    if (!sub) return 'Unknown';
    const resolved = typeof sub === 'string' ? getSubstance(sub, data) : sub;
    if (!resolved) return typeof sub === 'string' ? sub : 'Unknown';
    const catalog = DEFAULT_SUBSTANCE_CATALOG.find(e => e.id === resolved.id);
    if (catalog) return catalog.name;
    const n = normalizeSubstanceName(resolved.name);
    if (n === 'lsd' || n === 'acid') return 'LSD';
    if (n === 'alcohol' || n === 'alchocol') return 'Alcohol';
    return resolved.name || resolved.id;
}

function reassignSubstanceIdInData(data, fromId, toId) {
    if (!fromId || !toId || fromId === toId) return;
    (data.logs || []).forEach(log => {
        if (getUseSubstanceId(log) === fromId) log.substanceId = toId;
    });
    (data.purchases || []).forEach(purchase => {
        if (getPurchaseSubstanceId(purchase) === fromId) purchase.substanceId = toId;
    });
    if (data.taperPlans?.[fromId]) {
        if (!data.taperPlans[toId]) data.taperPlans[toId] = data.taperPlans[fromId];
        delete data.taperPlans[fromId];
    }
    if (data.recoveryStreaks?.[fromId]) {
        if (!data.recoveryStreaks[toId]) data.recoveryStreaks[toId] = data.recoveryStreaks[fromId];
        delete data.recoveryStreaks[fromId];
    }
    if (data.settings?.substanceSettings?.[fromId]) {
        if (!data.settings.substanceSettings[toId]) {
            data.settings.substanceSettings[toId] = data.settings.substanceSettings[fromId];
        }
        delete data.settings.substanceSettings[fromId];
    }
}

function migrateSubstanceNameDedupe(data) {
    if (!Array.isArray(data.substances)) data.substances = [];
    ensureAppDataMigrations(data);
    if (data.migrations.substanceNameDedupeV1) return;

    data.substances.forEach(sub => {
        if (!sub || typeof sub !== 'object') return;
        const n = normalizeSubstanceName(sub.name);
        if (n === 'lsd' || n === 'acid') sub.name = 'LSD';
        if (n === 'alcohol' || n === 'alchocol') sub.name = 'Alcohol';
    });

    const groups = new Map();
    data.substances.forEach(sub => {
        const key = normalizeSubstanceName(sub.name);
        if (!groups.has(key)) groups.set(key, []);
        groups.get(key).push(sub);
    });

    const removeIds = new Set();
    groups.forEach((subs, key) => {
        if (subs.length <= 1) return;
        const catalog = DEFAULT_SUBSTANCE_CATALOG.find(e => normalizeSubstanceName(e.name) === key);
        const keep = subs.find(s => s.id === catalog?.id) || subs[0];
        subs.forEach(sub => {
            if (sub.id === keep.id) return;
            reassignSubstanceIdInData(data, sub.id, keep.id);
            removeIds.add(sub.id);
        });
    });
    if (removeIds.size) {
        data.substances = data.substances.filter(s => !removeIds.has(s.id));
    }
    data.migrations.substanceNameDedupeV1 = true;
}

function migrateSubstanceTrackingModes(data) {
    if (!Array.isArray(data.substances)) data.substances = [];

    data.substances.forEach(sub => {
        if (!sub || typeof sub !== 'object') return;
        const defaults = getSubstanceTrackingDefaults(sub.id);
        if (!sub.trackingMode) sub.trackingMode = inferTrackingModeFromSubstance(sub);
        if (sub.id === 'coke' || normalizeSubstanceName(sub.name) === 'coke') {
            sub.trackingMode = 'powder';
            sub.primaryUnit = sub.primaryUnit || 'g';
            sub.secondaryCountLabel = sub.secondaryCountLabel || 'lines';
        }
        if (sub.trackingMode === 'vape' && sub.id !== VAPE_NICOTINE_ID) {
            const name = normalizeSubstanceName(sub.name);
            if (name !== 'vape/nicotine' && !(name.includes('vape') && name.includes('nicotine'))) {
                sub.trackingMode = inferTrackingModeFromSubstance({ ...sub, trackingMode: null });
            }
        }
        if (!sub.primaryUnit) {
            sub.primaryUnit = defaults.primaryUnit || sub.defaultUnit || sub.units?.[0] || 'units';
        }
        if (sub.secondaryCountLabel == null && defaults.secondaryCountLabel) {
            sub.secondaryCountLabel = defaults.secondaryCountLabel;
        }
        if (defaults.primaryUnit && (!sub.defaultUnit || sub.defaultUnit === 'units')) {
            sub.defaultUnit = defaults.primaryUnit;
        }
        if (sub.trackingMode === 'vape' && sub.defaultUnit !== 'puffs') {
            sub.defaultUnit = 'puffs';
            sub.primaryUnit = 'puffs';
        }
    });

    (data.logs || []).forEach(log => {
        if (!log || typeof log !== 'object') return;
        const substanceId = getUseSubstanceId(log);
        const mode = getSubstanceTrackingMode(substanceId, data);
        if (!log.trackingMode) log.trackingMode = mode;
        if (mode === 'vape' && isPersonalUseLog(log)) {
            if (log.percentLeftAfter != null || log.percentRemaining != null || log.logMode === 'percent_remaining') {
                log.logMode = log.logMode || 'percent_remaining';
                log.trackingMode = 'vape';
            }
        } else if (mode !== 'vape' && log.trackingMode === 'vape') {
            log.trackingMode = mode;
        }
        if (mode !== 'vape' && (log.logMode === 'percent_remaining' || log.logMode === 'vape_puffs')) {
            log.logMode = 'standard';
        }
        if (substanceId === 'coke' && log.unit === 'grams') {
            log.unit = 'g';
        }
        if (mode === 'vape' && isPersonalUseLog(log)) {
            if (!log.type || log.type === 'quick') log.type = 'session';
        }
    });

    (data.purchases || []).forEach(purchase => {
        if (!purchase || typeof purchase !== 'object') return;
        const substanceId = getPurchaseSubstanceId(purchase);
        const mode = getSubstanceTrackingMode(substanceId, data);
        if (!purchase.trackingMode) purchase.trackingMode = mode;
        if (mode !== 'vape' && purchase.trackingMode === 'vape') {
            purchase.trackingMode = mode;
        }
    });
}

function useTimeToMinutes(timeStr) {
    const parts = (timeStr || '00:00').split(':').map(Number);
    return (parts[0] || 0) * 60 + (parts[1] || 0);
}

function repairDataConsistency(data) {
    const stats = {
        logsTransactionTypeFixed: 0,
        logsEndDateFixed: 0,
        purchasesSubstanceNameRefreshed: 0,
        purchasesInventoryStatusFixed: 0,
        purchasesRecalculated: 0,
        taperPlansRecalculated: 0
    };

    (data.logs || []).forEach(log => {
        if (!log || typeof log !== 'object') return;

        if (log.transactionType === 'session') {
            log.transactionType = 'use';
            if (!log.type || log.type === 'quick') log.type = 'session';
            stats.logsTransactionTypeFixed++;
        }

        if (log.startTime && log.endTime && !log.endDate && log.date) {
            if (useTimeToMinutes(log.endTime) < useTimeToMinutes(log.startTime)) {
                log.endDate = addDaysToDateStr(log.date, 1);
                stats.logsEndDateFixed++;
            }
        }
    });

    (data.purchases || []).forEach(purchase => {
        if (!purchase || typeof purchase !== 'object') return;
        const substanceId = getPurchaseSubstanceId(purchase);
        const sub = getSubstance(substanceId, data);
        const name = sub?.name || '';
        if (purchase.substanceName !== name) {
            purchase.substanceName = name;
            stats.purchasesSubstanceNameRefreshed++;
        }
    });

    migrateInventoryStatusFields(data);
    (data.purchases || []).forEach(purchase => {
        if (!purchase || typeof purchase !== 'object') return;
        const beforeStatus = purchase.inventoryStatus;
        syncPurchaseInventoryStatus(purchase);
        if (beforeStatus !== purchase.inventoryStatus) stats.purchasesInventoryStatusFixed++;
    });
    stats.purchasesRecalculated = recalculateAllPurchaseRemaining(data);

    const taperPlans = data.taperPlans || {};
    Object.keys(taperPlans).forEach(substanceId => {
        const plan = taperPlans[substanceId];
        if (!plan) return;
        const before = JSON.stringify((plan.weeklyTargets || []).map(w => w.actualUsed));
        syncTaperPlanData(substanceId, data);
        const after = JSON.stringify((plan.weeklyTargets || []).map(w => w.actualUsed));
        if (before !== after) stats.taperPlansRecalculated++;
    });

    return stats;
}

function formatRepairSummary(stats) {
    const lines = [];
    if (stats.logsTransactionTypeFixed) {
        lines.push(`${stats.logsTransactionTypeFixed} log(s): fixed transaction type (session → use)`);
    }
    if (stats.logsEndDateFixed) {
        lines.push(`${stats.logsEndDateFixed} log(s): added overnight end date`);
    }
    if (stats.purchasesSubstanceNameRefreshed) {
        lines.push(`${stats.purchasesSubstanceNameRefreshed} purchase(s): refreshed substance name`);
    }
    if (stats.purchasesInventoryStatusFixed) {
        lines.push(`${stats.purchasesInventoryStatusFixed} purchase(s): normalized inventory status`);
    }
    if (stats.purchasesRecalculated) {
        lines.push(`${stats.purchasesRecalculated} purchase(s): recalculated remaining inventory`);
    }
    if (stats.taperPlansRecalculated) {
        lines.push(`${stats.taperPlansRecalculated} taper plan(s): recalculated weekly usage`);
    }
    if (!lines.length) lines.push('No changes needed — data is already consistent.');
    return lines.join('\n');
}

function getVapeTaperCountMode(data = appData) {
    return data?.settings?.vapeTaperCountMode === 'spread-across-days'
        ? 'spread-across-days'
        : 'log-date';
}

function setVapeTaperCountMode(mode) {
    if (!appData.settings) appData.settings = {};
    appData.settings.vapeTaperCountMode = mode === 'spread-across-days' ? 'spread-across-days' : 'log-date';
    saveData(appData);
    updateVapeTaperModeNote();
    refreshTaperDashboard();
    updateStats();
}

function updateVapeTaperModeNote() {
    const el = document.getElementById('vape-taper-mode-note');
    if (!el) return;
    const spread = getVapeTaperCountMode() === 'spread-across-days';
    el.classList.toggle('hidden', !spread);
}

function migrateInventoryStatusFields(data) {
    (data.purchases || []).forEach(purchase => {
        if (!purchase || typeof purchase !== 'object') return;
        if (purchase.inventoryHidden == null) purchase.inventoryHidden = false;
        if (!purchase.inventoryStatus) {
            if (purchase.isDepleted) {
                purchase.inventoryStatus = 'depleted';
            } else {
                const rem = getPurchaseRemainingAmount(purchase);
                const remPuffs = isVapePuffPurchase(purchase, data)
                    ? (parseFloat(purchase.remainingPuffs ?? rem) || 0)
                    : rem;
                purchase.inventoryStatus = (rem > INVENTORY_EPS || remPuffs > INVENTORY_EPS) ? 'active' : 'depleted';
            }
        }
    });
}

function syncPurchaseInventoryStatus(purchase) {
    if (!purchase) return;
    const rem = getPurchaseRemainingAmount(purchase);
    const remPuffs = isVapePuffPurchase(purchase)
        ? (parseFloat(purchase.remainingPuffs ?? rem) || 0)
        : rem;
    if (purchase.isDepleted || rem <= INVENTORY_EPS || remPuffs <= INVENTORY_EPS) {
        purchase.isDepleted = true;
        if (purchase.inventoryStatus !== 'stored') purchase.inventoryStatus = 'depleted';
        if (!purchase.depletedAt) purchase.depletedAt = new Date().toISOString();
    } else if (!purchase.inventoryHidden && purchase.inventoryStatus !== 'stored') {
        purchase.inventoryStatus = 'active';
        purchase.isDepleted = false;
        purchase.depletedAt = null;
    }
}

function getPurchaseInventoryTab(purchase) {
    if (!purchase) return 'all';
    if (purchase.inventoryHidden) return 'hidden';
    if (purchase.inventoryStatus === 'stored') return 'stored';
    const rem = getPurchaseRemainingAmount(purchase);
    const remPuffs = isVapePuffPurchase(purchase)
        ? (parseFloat(purchase.remainingPuffs ?? rem) || 0)
        : rem;
    if (purchase.isDepleted || purchase.inventoryStatus === 'depleted' || rem <= INVENTORY_EPS || remPuffs <= INVENTORY_EPS) {
        return 'depleted';
    }
    return 'active';
}

function getVapePurchaseDisplayStatus(purchase) {
    if (purchase.inventoryHidden) return { key: 'hidden', label: 'Hidden', className: 'vape-status-hidden' };
    if (purchase.inventoryStatus === 'stored') return { key: 'stored', label: 'Stored', className: 'vape-status-stored' };
    const remaining = getPurchaseRemainingAmount(purchase);
    if (purchase.isDepleted || remaining <= INVENTORY_EPS) {
        return { key: 'empty', label: 'Empty', className: 'vape-status-empty' };
    }
    const pctLeft = getPurchasePercentRemaining(purchase);
    if (pctLeft <= 15 && pctLeft > 0) {
        return { key: 'low', label: 'Low', className: 'vape-status-low' };
    }
    return { key: 'active', label: 'Active', className: 'vape-status-active' };
}

function purchaseMatchesInventorySearch(purchase, query, data = appData) {
    if (!query) return true;
    const q = query.toLowerCase();
    const sub = getSubstance(getPurchaseSubstanceId(purchase), data);
    const haystack = [
        purchase.store, purchase.location, purchase.notes, purchase.substanceName,
        sub?.name, purchase.paymentMethod
    ].filter(Boolean).join(' ').toLowerCase();
    return haystack.includes(q);
}

function purchaseMatchesInventoryFilters(purchase, filters = inventoryListFilters, data = appData) {
    if (filters.substanceId && getPurchaseSubstanceId(purchase) !== filters.substanceId) return false;
    if (filters.dateStart && purchase.date < filters.dateStart) return false;
    if (filters.dateEnd && purchase.date > filters.dateEnd) return false;
    if (filters.status && getPurchaseInventoryTab(purchase) !== filters.status) return false;
    if (filters.paymentMethod && (purchase.paymentMethod || '') !== filters.paymentMethod) return false;
    if (filters.hasRemaining === 'yes' && getPurchaseRemainingAmount(purchase) <= INVENTORY_EPS) return false;
    if (filters.hasRemaining === 'no' && getPurchaseRemainingAmount(purchase) > INVENTORY_EPS) return false;
    const cost = parseFloat(getPurchaseTotalCost(purchase)) || 0;
    if (filters.hasCost === 'yes' && cost <= 0) return false;
    if (filters.hasCost === 'no' && cost > 0) return false;
    if (filters.vapeOnly && !isVapePuffPurchase(purchase, data)) return false;
    return true;
}

function getInventoryFilteredPurchases(substanceId, data = appData) {
    let list = [...(data.purchases || [])];
    if (substanceId && substanceId !== DASHBOARD_ALL) {
        list = list.filter(p => getPurchaseSubstanceId(p) === substanceId);
    }
    if (inventoryTabFilter !== 'all') {
        list = list.filter(p => getPurchaseInventoryTab(p) === inventoryTabFilter);
    }
    if (inventorySearchQuery) {
        list = list.filter(p => purchaseMatchesInventorySearch(p, inventorySearchQuery, data));
    }
    list = list.filter(p => purchaseMatchesInventoryFilters(p, inventoryListFilters, data));
    return list.sort((a, b) => getPurchaseDatetimeMs(b) - getPurchaseDatetimeMs(a));
}

function recalculatePurchaseRemaining(purchaseId, data = appData) {
    const purchase = findPurchaseInData(purchaseId, data);
    if (!purchase) return null;
    const oldRemaining = getPurchaseRemainingAmount(purchase);

    if (isVapePuffPurchase(purchase, data)) {
        recalculateVapePurchaseInventory(purchaseId, data);
    } else {
        let remaining = getPurchaseQuantityBought(purchase);
        (data.logs || []).forEach(log => {
            const pid = getLogPurchaseId(log);
            if (pid == null || String(pid) !== String(purchaseId)) return;
            if (!logInventoryAffects(log)) return;
            const tx = getLogTransactionType(log);
            const amt = parseFloat(log.amount) || 0;
            if (tx === 'use' || tx === 'gift_given') remaining -= amt;
            else if (tx === 'gift_received') remaining += amt;
            else if (tx === 'inventory_adjustment') {
                if (inventoryAdjustmentAdds(log)) remaining += amt;
                else if (inventoryAdjustmentRemoves(log)) remaining -= amt;
            }
        });
        purchase.remainingAmount = Math.max(0, remaining);
        purchase.isDepleted = purchase.remainingAmount <= INVENTORY_EPS;
    }
    syncPurchaseInventoryStatus(purchase);
    purchase.updatedAt = new Date().toISOString();
    return {
        purchaseId,
        oldRemaining,
        newRemaining: getPurchaseRemainingAmount(purchase)
    };
}

function recalculateAllPurchaseRemaining(data = appData) {
    let count = 0;
    (data.purchases || []).forEach(p => {
        if (recalculatePurchaseRemaining(p.id, data)) count++;
    });
    return count;
}

function markPurchaseInventoryStatus(purchaseId, status, persist = true) {
    const purchase = findPurchase(purchaseId);
    if (!purchase) return false;
    const now = new Date().toISOString();
    if (status === 'stored') {
        purchase.inventoryStatus = 'stored';
        purchase.archivedAt = purchase.archivedAt || now;
    } else if (status === 'active') {
        purchase.inventoryStatus = 'active';
        purchase.inventoryHidden = false;
        purchase.depletedAt = null;
        if (getPurchaseRemainingAmount(purchase) > INVENTORY_EPS) purchase.isDepleted = false;
    } else if (status === 'depleted') {
        purchase.inventoryStatus = 'depleted';
        purchase.isDepleted = true;
        purchase.depletedAt = now;
        purchase.remainingAmount = 0;
        if (isVapePuffPurchase(purchase)) purchase.remainingPuffs = 0;
    }
    purchase.updatedAt = now;
    if (persist) {
        saveData(appData);
        refreshBuyTrackerRelatedViews();
    }
    return true;
}

function setPurchaseHidden(purchaseId, hidden, persist = true) {
    const purchase = findPurchase(purchaseId);
    if (!purchase) return false;
    purchase.inventoryHidden = !!hidden;
    purchase.updatedAt = new Date().toISOString();
    if (persist) {
        saveData(appData);
        refreshBuyTrackerRelatedViews();
    }
    return true;
}

function duplicatePurchaseNow(id) {
    const purchase = findPurchase(id);
    if (!purchase) {
        alert('Could not find that purchase to duplicate.');
        return null;
    }
    const now = new Date().toISOString();
    const today = getLocalDateString();
    const isVape = isVapePuffPurchase(purchase);
    const qty = getPurchaseQuantityBought(purchase);
    const fullPuffs = isVape ? getVapeFullPuffCount(purchase) : qty;
    const pctBought = isVape ? getVapePercentBoughtAt(purchase) : 100;
    const startingPuffs = isVape ? computeVapeStartingPuffsFromForm(fullPuffs, pctBought) : qty;
    const newId = `purchase-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const record = {
        substanceId: getPurchaseSubstanceId(purchase),
        substanceName: purchase.substanceName || getSubstance(getPurchaseSubstanceId(purchase))?.name || '',
        trackingMode: purchase.trackingMode || getSubstanceTrackingMode(getPurchaseSubstanceId(purchase)),
        date: today,
        time: isVape ? '12:00' : getLocalTimeString(),
        quantityBought: isVape ? fullPuffs : qty,
        quantity: isVape ? fullPuffs : qty,
        unit: purchase.unit || 'units',
        totalCost: parseFloat(getPurchaseTotalCost(purchase)) || 0,
        costPerUnit: purchase.costPerUnit || 0,
        store: purchase.store || purchase.location || '',
        paymentMethod: purchase.paymentMethod || '',
        notes: purchase.notes || '',
        remainingAmount: isVape ? startingPuffs : qty,
        isDepleted: false,
        inventoryStatus: 'active',
        inventoryHidden: false,
        startedAt: null,
        finishedAt: null,
        supplyStartedAt: null,
        depletedAt: null,
        archivedAt: null,
        createdAt: now,
        updatedAt: now,
        id: newId
    };
    if (isVape) {
        record.fullPuffCount = fullPuffs;
        record.percentBoughtAt = pctBought;
        record.startingPuffsLeft = startingPuffs;
        record.remainingPuffs = startingPuffs;
        record.eLiquidCapacityMl = getVapeELiquidCapacityMl(purchase);
        record.nicotineMgPerMl = getVapeNicotineMgPerMl(purchase);
        syncVapeNicotineFields(record);
    }
    stripIrrelevantPurchaseFields(record);
    appData.purchases.push(record);
    saveData(appData);
    refreshBuyTrackerRelatedViews();
    return record;
}

function markVapePurchaseStartedNow(purchaseId) {
    alert('Start time is recorded automatically when you log Vape/Nicotine use.');
    return false;
}

function markVapePurchaseFinishedNow(purchaseId) {
    const purchase = findPurchase(purchaseId);
    if (!purchase || !isVapePuffPurchase(purchase)) return false;
    const now = new Date().toISOString();
    purchase.isDepleted = true;
    purchase.remainingAmount = 0;
    purchase.remainingPuffs = 0;
    purchase.inventoryStatus = 'depleted';
    purchase.depletedAt = now;
    purchase.updatedAt = now;
    saveData(appData);
    refreshBuyTrackerRelatedViews();
    return true;
}

function getDataQualityReport(data = appData) {
    const purchases = data.purchases || [];
    const logs = data.logs || [];
    return {
        sessionTransactionType: logs.filter(l => l?.transactionType === 'session').length,
        substanceNameMismatch: purchases.filter(p => {
            const sub = getSubstance(getPurchaseSubstanceId(p), data);
            return sub?.name && p.substanceName && p.substanceName !== sub.name;
        }).length,
        activeNoRemaining: purchases.filter(p =>
            p.inventoryStatus === 'active'
            && !p.inventoryHidden
            && getPurchaseRemainingAmount(p) <= INVENTORY_EPS
        ).length,
        vapeMissingPuffCount: purchases.filter(p =>
            isVapePuffPurchase(p, data) && !getVapeFullPuffCount(p)
        ).length,
        vapeMissingNicotine: purchases.filter(p =>
            isVapePuffPurchase(p, data)
            && (!getVapeELiquidCapacityMl(p) || !getVapeNicotineMgPerMl(p))
        ).length,
        overnightMissingEndDate: logs.filter(l =>
            l.startTime && l.endTime && !l.endDate && l.date
            && useTimeToMinutes(l.endTime) < useTimeToMinutes(l.startTime)
        ).length
    };
}

function renderDataQualityPanel() {
    const container = document.getElementById('data-quality-panel');
    if (!container) return;
    const r = getDataQualityReport();
    const rows = [
        ['Logs with transactionType "session"', r.sessionTransactionType],
        ['Purchases with mismatched substance name', r.substanceNameMismatch],
        ['Active purchases with no remaining', r.activeNoRemaining],
        ['Vape purchases missing puff count', r.vapeMissingPuffCount],
        ['Vape purchases missing nicotine fields', r.vapeMissingNicotine],
        ['Overnight logs missing endDate', r.overnightMissingEndDate]
    ];
    const totalIssues = rows.reduce((s, [, n]) => s + n, 0);
    container.innerHTML = `
        <p class="settings-hint">${totalIssues ? `${totalIssues} potential issue(s) found.` : 'No data quality issues detected.'}</p>
        <ul class="data-quality-list">
            ${rows.map(([label, count]) => `<li><span>${label}</span><strong>${count}</strong></li>`).join('')}
        </ul>`;
}

function isInventoryAllSubstancesFilter(selectedSubstanceId) {
    return !selectedSubstanceId || selectedSubstanceId === DASHBOARD_ALL;
}

function getInventorySubstanceFilterId() {
    return isSelectedAllSubstances() ? '' : selectedSubstanceId;
}

function syncInventorySubstanceFilterState() {
    inventoryListFilters.substanceId = getInventorySubstanceFilterId();
}

function getFilteredPurchases(purchases, selectedSubstanceId, selectedStatus = null, data = appData) {
    let list = [...(purchases || [])];
    if (!isInventoryAllSubstancesFilter(selectedSubstanceId)) {
        list = list.filter(p => getPurchaseSubstanceId(p) === selectedSubstanceId);
    }
    if (selectedStatus) {
        list = list.filter(p => getPurchaseInventoryTab(p) === selectedStatus);
    }
    return list;
}

function getInventoryPurchaseEstimatedValue(purchase, data = appData) {
    const rem = getPurchaseRemainingDisplayAmount(purchase);
    const cpu = parseFloat(purchase.costPerUnit) || 0;
    const totalCost = parseFloat(getPurchaseTotalCost(purchase)) || 0;
    if (isVapePuffPurchase(purchase, data)) {
        if (cpu > 0) return rem * cpu;
        const starting = getVapeStartingPuffsLeft(purchase);
        return starting > 0 ? totalCost * (rem / starting) : 0;
    }
    return rem * cpu;
}

function getInventorySummary(selectedSubstanceId, data = appData) {
    const scope = getFilteredPurchases(data.purchases || [], selectedSubstanceId, null, data);
    const active = scope.filter(p => getPurchaseInventoryTab(p) === 'active');
    const stored = scope.filter(p => getPurchaseInventoryTab(p) === 'stored');
    const depleted = scope.filter(p => getPurchaseInventoryTab(p) === 'depleted');

    let inventoryValue = 0;
    let totalRemaining = 0;
    let totalRemainingUnit = null;
    let vapePuffsLeft = 0;
    let vapeActiveCount = 0;
    let vapeStoredCount = 0;
    let oldestActive = null;
    const remainingBySubstance = {};

    active.forEach(p => {
        const sid = getPurchaseSubstanceId(p);
        const rem = getPurchaseRemainingDisplayAmount(p);
        if (isVapePuffPurchase(p, data)) {
            vapePuffsLeft += rem;
            vapeActiveCount++;
        } else {
            totalRemaining += rem;
            remainingBySubstance[sid] = (remainingBySubstance[sid] || 0) + rem;
            if (!totalRemainingUnit) totalRemainingUnit = getPurchaseRemainingDisplayUnit(p);
        }
        inventoryValue += getInventoryPurchaseEstimatedValue(p, data);
        if (!oldestActive || getPurchaseDatetimeMs(p) < getPurchaseDatetimeMs(oldestActive)) {
            oldestActive = p;
        }
    });

    scope.forEach(p => {
        if (getPurchaseInventoryTab(p) === 'stored' && isVapePuffPurchase(p, data)) {
            vapeStoredCount++;
        }
    });

    return {
        activeCount: active.length,
        storedCount: stored.length,
        depletedCount: depleted.length,
        inventoryValue,
        totalRemaining,
        totalRemainingUnit,
        vapePuffsLeft,
        vapeActiveCount,
        vapeStoredCount,
        oldestActive,
        remainingBySubstance
    };
}

function getInventoryTotalRemainingLabel(selectedSubstanceId) {
    if (isInventoryAllSubstancesFilter(selectedSubstanceId)) return 'Total remaining by substance';
    const sub = getSubstance(selectedSubstanceId);
    if (!sub) return 'Remaining';
    return `${sub.name} Remaining`;
}

function formatInventoryTotalRemainingValue(summary, selectedSubstanceId, data = appData) {
    if (isInventoryAllSubstancesFilter(selectedSubstanceId)) {
        const lines = Object.entries(summary.remainingBySubstance || {})
            .filter(([, amt]) => amt > INVENTORY_EPS)
            .map(([sid, amt]) => {
                const sub = getSubstance(sid, data);
                const unit = sub?.defaultUnit || 'units';
                return `${sub?.name || sid}: ${formatAmountWithUnit(amt, unit)}`;
            });
        return lines.length ? lines.join(' · ') : '—';
    }
    const sub = getSubstance(selectedSubstanceId, data);
    const unit = sub?.defaultUnit || summary.totalRemainingUnit || 'units';
    return formatAmountWithUnit(summary.totalRemaining, unit);
}

function shouldShowVapeInventorySummaryCards(selectedSubstanceId) {
    return isInventoryAllSubstancesFilter(selectedSubstanceId)
        || isVapeNicotineSubstanceId(selectedSubstanceId);
}

function shouldShowTotalRemainingInventoryCard(selectedSubstanceId) {
    return isInventoryAllSubstancesFilter(selectedSubstanceId)
        || !isVapeNicotineSubstanceId(selectedSubstanceId);
}

function renderInventorySummaryCards() {
    const container = document.getElementById('inventory-summary-cards');
    if (!container) return;
    const selectedId = getInventorySubstanceFilterId();
    const m = getInventorySummary(selectedId || null);
    const cur = getCurrencySymbol();
    const oldestLabel = m.oldestActive
        ? `${formatDate(m.oldestActive.date)}${m.oldestActive.store ? ` · ${m.oldestActive.store}` : ''}`
        : '—';

    const cards = [
        `<div class="stat-card"><h3>Active</h3><p class="stat-value">${m.activeCount}</p></div>`,
        `<div class="stat-card"><h3>Stored</h3><p class="stat-value">${m.storedCount}</p></div>`,
        `<div class="stat-card"><h3>Depleted</h3><p class="stat-value">${m.depletedCount}</p></div>`,
        `<div class="stat-card"><h3>Inventory Value (est.)</h3><p class="stat-value">${fmtSheetMoney(m.inventoryValue, cur)}</p></div>`
    ];

    if (shouldShowTotalRemainingInventoryCard(selectedId)) {
        cards.push(
            `<div class="stat-card"><h3>${getInventoryTotalRemainingLabel(selectedId)}</h3><p class="stat-value stat-value-sm">${formatInventoryTotalRemainingValue(m, selectedId)}</p></div>`
        );
    }

    if (shouldShowVapeInventorySummaryCards(selectedId)) {
        cards.push(
            `<div class="stat-card"><h3>Vape Puffs Left</h3><p class="stat-value">${formatAmountWithUnit(m.vapePuffsLeft, 'puffs')}</p></div>`,
            `<div class="stat-card"><h3>Vapes Active / Stored</h3><p class="stat-value">${m.vapeActiveCount} / ${m.vapeStoredCount}</p></div>`
        );
    }

    cards.push(
        `<div class="stat-card"><h3>Oldest Active</h3><p class="stat-value stat-value-sm">${oldestLabel}</p></div>`
    );

    container.innerHTML = `<div class="inventory-summary-grid">${cards.join('')}</div>`;
}

function setInventoryTab(tab) {
    inventoryTabFilter = tab;
    document.querySelectorAll('.inventory-tab-btn').forEach(btn => {
        btn.classList.toggle('active', btn.dataset.inventoryTab === tab);
    });
    renderPurchaseHistory(null);
    renderInventorySummaryCards();
}

function applyInventorySearchFilters() {
    inventorySearchQuery = document.getElementById('inventory-search')?.value?.trim() || '';
    inventoryListFilters.dateStart = document.getElementById('inventory-filter-date-start')?.value || '';
    inventoryListFilters.dateEnd = document.getElementById('inventory-filter-date-end')?.value || '';
    inventoryListFilters.status = document.getElementById('inventory-filter-status')?.value || '';
    inventoryListFilters.paymentMethod = document.getElementById('inventory-filter-payment')?.value || '';
    inventoryListFilters.hasRemaining = document.getElementById('inventory-filter-remaining')?.value || '';
    inventoryListFilters.hasCost = document.getElementById('inventory-filter-cost')?.value || '';
    inventoryListFilters.vapeOnly = !!document.getElementById('inventory-filter-vape-only')?.checked;
    syncInventorySubstanceFilterState();
    renderPurchaseHistory(null);
    renderInventorySummaryCards();
}

function runInventoryBulkAction(action) {
    const ids = [...inventorySelectedIds];
    if (!ids.length) {
        alert('Select at least one purchase.');
        return;
    }
    if (action === 'delete' && !confirm(`Delete ${ids.length} purchase(s)?`)) return;
    createAutoBackup(`before-inventory-bulk-${action}`);
    ids.forEach(id => {
        if (action === 'stored') markPurchaseInventoryStatus(id, 'stored', false);
        else if (action === 'active') markPurchaseInventoryStatus(id, 'active', false);
        else if (action === 'depleted') markPurchaseInventoryStatus(id, 'depleted', false);
        else if (action === 'hide') setPurchaseHidden(id, true, false);
        else if (action === 'unhide') setPurchaseHidden(id, false, false);
        else if (action === 'recalculate') recalculatePurchaseRemaining(id);
        else if (action === 'delete') {
            appData.purchases = (appData.purchases || []).filter(p => !purchaseIdEquals(p.id, id));
        }
    });
    saveData(appData);
    inventorySelectedIds.clear();
    refreshBuyTrackerRelatedViews();
}

function populatePageSubstanceDropdowns() {
    const active = getActiveSubstances();
    populatePageSubstanceSelect('use-log-substance', { includeAll: true, substances: active });
    populatePageSubstanceSelect('inventory-substance', { includeAll: true, substances: active });
    const taperSubs = sortSubstancesMainFirst(getTaperSubstances());
    populatePageSubstanceSelect('taper-substance', { includeAll: false, substances: taperSubs });
    syncPageSubstanceSelectors();
    syncInventorySubstanceFilterState();
}

function populatePageSubstanceSelect(selectId, { includeAll = false, substances = null } = {}) {
    const dropdown = document.getElementById(selectId);
    if (!dropdown) return;
    const subs = substances || getActiveSubstances();
    dropdown.innerHTML = '';
    if (includeAll) {
        const all = document.createElement('option');
        all.value = DASHBOARD_ALL;
        all.textContent = '📊 All substances';
        dropdown.appendChild(all);
    }
    sortSubstancesMainFirst(subs).forEach(sub => dropdown.appendChild(buildSubstanceOption(sub)));
    const fallback = includeAll
        ? (subs[0]?.id || DASHBOARD_ALL)
        : (subs[0]?.id || '');
    const target = [...dropdown.options].some(o => o.value === selectedSubstanceId)
        ? selectedSubstanceId
        : fallback;
    if (target && [...dropdown.options].some(o => o.value === target)) {
        dropdown.value = target;
    }
}

function syncPageSubstanceSelectors(skipId = null) {
    if (skipId !== 'use-log-substance') {
        const el = document.getElementById('use-log-substance');
        if (el && [...el.options].some(o => o.value === selectedSubstanceId)) el.value = selectedSubstanceId;
    }
    if (skipId !== 'inventory-substance') {
        const el = document.getElementById('inventory-substance');
        if (el && [...el.options].some(o => o.value === selectedSubstanceId)) el.value = selectedSubstanceId;
    }
    if (skipId !== 'taper-substance') {
        const taperEl = document.getElementById('taper-substance');
        if (taperEl && [...taperEl.options].some(o => o.value === selectedSubstanceId)) {
            taperEl.value = selectedSubstanceId;
        }
    }
    syncInventorySubstanceFilterState();
}

function ensureSelectedSubstanceIdValid() {
    if (isSelectedAllSubstances()) return;
    if (getActiveSubstances().some(s => s.id === selectedSubstanceId)) return;
    selectedSubstanceId = resolveDefaultSelectedSubstanceId();
}

function setSelectedSubstanceId(id, { source = null, refresh = true } = {}) {
    selectedSubstanceId = id || DASHBOARD_ALL;
    ensureSelectedSubstanceIdValid();
    syncPageSubstanceSelectors(source);
    syncUseLogFormFromSelectedSubstance();
    syncBuyFormFromSelectedSubstance();
    if (!refresh) return;
    renderUseLogTab();
    renderInventorySummaryCards();
    renderPurchaseHistory(null);
    if (source !== 'taper' && getTaperSubstances().some(s => s.id === selectedSubstanceId)) {
        refreshTaperDashboard();
    }
}

function onUseLogSubstanceChange() {
    const id = document.getElementById('use-log-substance')?.value;
    if (!id) return;
    setSelectedSubstanceId(id, { source: 'use-log-substance' });
}

function onInventorySubstanceChange() {
    const id = document.getElementById('inventory-substance')?.value;
    if (!id) return;
    setSelectedSubstanceId(id, { source: 'inventory-substance' });
}

function syncUseLogFormFromSelectedSubstance() {
    const group = document.getElementById('use-substance-group');
    const useSelect = document.getElementById('use-substance');
    const all = isSelectedAllSubstances();
    group?.classList.toggle('hidden', !all);
    if (useSelect) {
        useSelect.required = all;
        if (!all && [...useSelect.options].some(o => o.value === selectedSubstanceId)) {
            useSelect.value = selectedSubstanceId;
            updateUseUnitDropdown();
            updateVapeUseFormUI();
        }
    }
}

function syncBuyFormFromSelectedSubstance() {
    if (isSelectedAllSubstances()) return;
    const buyEl = document.getElementById('buy-substance');
    if (buyEl && [...buyEl.options].some(o => o.value === selectedSubstanceId)) {
        buyEl.value = selectedSubstanceId;
        updateBuyUnitDropdown();
        updateBuyVapeFieldsVisibility();
    }
}

function getUseLogViewSubstanceId() {
    return isSelectedAllSubstances() ? null : selectedSubstanceId;
}

function getUseLogFormSubstanceId() {
    if (!isSelectedAllSubstances()) return selectedSubstanceId;
    return document.getElementById('use-substance')?.value || selectedSubstanceId;
}

function syncVapeTaperCountModeSelect() {
    const el = document.getElementById('vape-taper-count-mode');
    if (el) el.value = getVapeTaperCountMode();
    updateVapeTaperModeNote();
}

function isAlcoholPurchase(purchase, data = appData) {
    return isAlcoholTrackingMode(getPurchaseSubstanceId(purchase), data);
}

function isWeedPurchase(purchase, data = appData) {
    return isWeedTrackingMode(getPurchaseSubstanceId(purchase), data);
}

function isCigarettesPurchase(purchase, data = appData) {
    return isCigarettesTrackingMode(getPurchaseSubstanceId(purchase), data);
}

function computePureAlcoholMl(netVolumeMl, alcoholPercent) {
    const vol = parseFloat(netVolumeMl);
    const pct = parseFloat(alcoholPercent);
    if (!Number.isFinite(vol) || !Number.isFinite(pct) || vol <= 0 || pct < 0) return null;
    return vol * (pct / 100);
}

function getAlcoholPureAlcoholMl(purchase) {
    if (!purchase) return null;
    if (purchase.pureAlcoholMl != null && purchase.pureAlcoholMl !== '') {
        const stored = parseFloat(purchase.pureAlcoholMl);
        if (Number.isFinite(stored) && stored >= 0) return stored;
    }
    return computePureAlcoholMl(purchase.netVolumeMl, purchase.alcoholPercent);
}

function syncAlcoholPurchaseFields(purchase) {
    if (!isAlcoholPurchase(purchase)) return;
    const pure = computePureAlcoholMl(purchase.netVolumeMl, purchase.alcoholPercent);
    if (pure != null) purchase.pureAlcoholMl = pure;
    else delete purchase.pureAlcoholMl;
}

function parseAlcoholFieldsFromForm() {
    const percentRaw = parseFloat(document.getElementById('buy-alcohol-percent')?.value);
    const volumeRaw = parseFloat(document.getElementById('buy-net-volume-ml')?.value);
    const alcoholPercent = Number.isFinite(percentRaw) && percentRaw >= 0 ? percentRaw : null;
    const netVolumeMl = Number.isFinite(volumeRaw) && volumeRaw > 0 ? volumeRaw : null;
    const pureAlcoholMl = computePureAlcoholMl(netVolumeMl, alcoholPercent);
    return { alcoholPercent, netVolumeMl, pureAlcoholMl };
}

function applyAlcoholFieldsToPayload(payload, fields) {
    if (fields.alcoholPercent != null) payload.alcoholPercent = fields.alcoholPercent;
    else delete payload.alcoholPercent;
    if (fields.netVolumeMl != null) payload.netVolumeMl = fields.netVolumeMl;
    else delete payload.netVolumeMl;
    if (fields.pureAlcoholMl != null) payload.pureAlcoholMl = fields.pureAlcoholMl;
    else delete payload.pureAlcoholMl;
}

function getWeedProductTypeLabel(type) {
    if (type === 'cart') return 'Cart';
    if (type === 'edibles') return 'Edibles';
    if (type === 'prerolls') return 'Pre-rolls';
    return 'Bud';
}

function computeWeedTotalPreRollGrams(count, gramsPer) {
    if (!Number.isFinite(count) || !Number.isFinite(gramsPer) || count < 0 || gramsPer < 0) return null;
    return count * gramsPer;
}

function formatWeedPurchaseDisplayLine(purchase) {
    const type = purchase.weedProductType || 'bud';
    if (type === 'bud') {
        const g = purchase.budGrams ?? getPurchaseQuantityBought(purchase);
        return `Bud · ${formatAmount(g)} g`;
    }
    if (type === 'cart') {
        const count = getPurchaseQuantityBought(purchase);
        const g = purchase.cartGrams;
        let line = `Cart · ${formatAmount(count)} carts`;
        if (g != null && g !== '') line += ` · ${formatAmount(g)} g`;
        return line;
    }
    if (type === 'edibles') {
        const count = getPurchaseQuantityBought(purchase);
        const mg = purchase.ediblesMg;
        let line = `Edibles · ${formatAmount(count)} count`;
        if (mg != null && mg !== '') line += ` · ${formatAmount(mg)} mg`;
        return line;
    }
    if (type === 'prerolls') {
        const count = purchase.preRollCount ?? getPurchaseQuantityBought(purchase);
        const total = purchase.totalPreRollGrams ?? getPurchaseQuantityBought(purchase);
        return `Pre-rolls · ${formatAmount(count)} count · ${formatAmount(total)} g total`;
    }
    return '—';
}

function parseWeedFieldsFromForm() {
    const productType = document.getElementById('buy-weed-product-type')?.value || 'bud';
    const budRaw = parseFloat(document.getElementById('buy-bud-grams')?.value);
    const cartRaw = parseFloat(document.getElementById('buy-cart-grams')?.value);
    const ediblesRaw = parseFloat(document.getElementById('buy-edibles-mg')?.value);
    const preRollCountRaw = parseFloat(document.getElementById('buy-preroll-count')?.value);
    const gramsPerPreRollRaw = parseFloat(document.getElementById('buy-grams-per-preroll')?.value);
    const weedProductType = ['bud', 'cart', 'edibles', 'prerolls'].includes(productType) ? productType : 'bud';
    const budGrams = weedProductType === 'bud' && Number.isFinite(budRaw) && budRaw >= 0 ? budRaw : null;
    const cartGrams = weedProductType === 'cart' && Number.isFinite(cartRaw) && cartRaw >= 0 ? cartRaw : null;
    const ediblesMg = weedProductType === 'edibles' && Number.isFinite(ediblesRaw) && ediblesRaw >= 0 ? ediblesRaw : null;
    const preRollCount = weedProductType === 'prerolls' && Number.isFinite(preRollCountRaw) && preRollCountRaw >= 0
        ? preRollCountRaw
        : null;
    const gramsPerPreRoll = weedProductType === 'prerolls' && Number.isFinite(gramsPerPreRollRaw) && gramsPerPreRollRaw >= 0
        ? gramsPerPreRollRaw
        : null;
    const totalPreRollGrams = weedProductType === 'prerolls'
        ? computeWeedTotalPreRollGrams(preRollCount, gramsPerPreRoll)
        : null;
    return { weedProductType, budGrams, cartGrams, ediblesMg, preRollCount, gramsPerPreRoll, totalPreRollGrams };
}

function applyWeedFieldsToPayload(payload, fields) {
    payload.weedProductType = fields.weedProductType;
    ['budGrams', 'cartGrams', 'ediblesMg', 'preRollCount', 'gramsPerPreRoll', 'totalPreRollGrams'].forEach(key => {
        delete payload[key];
    });
    if (fields.weedProductType === 'bud' && fields.budGrams != null) payload.budGrams = fields.budGrams;
    if (fields.weedProductType === 'cart' && fields.cartGrams != null) payload.cartGrams = fields.cartGrams;
    if (fields.weedProductType === 'edibles' && fields.ediblesMg != null) payload.ediblesMg = fields.ediblesMg;
    if (fields.weedProductType === 'prerolls') {
        if (fields.preRollCount != null) payload.preRollCount = fields.preRollCount;
        if (fields.gramsPerPreRoll != null) payload.gramsPerPreRoll = fields.gramsPerPreRoll;
        if (fields.totalPreRollGrams != null) payload.totalPreRollGrams = fields.totalPreRollGrams;
    }
}

function applyWeedQuantityFromFields(payload, fields, totalCost) {
    const cost = Number.isFinite(totalCost) ? totalCost : 0;
    if (fields.weedProductType === 'bud' && fields.budGrams != null) {
        payload.quantityBought = fields.budGrams;
        payload.quantity = fields.budGrams;
        payload.unit = 'grams';
        payload.costPerUnit = fields.budGrams > 0 ? cost / fields.budGrams : 0;
    } else if (fields.weedProductType === 'prerolls' && fields.totalPreRollGrams != null) {
        payload.quantityBought = fields.totalPreRollGrams;
        payload.quantity = fields.totalPreRollGrams;
        payload.unit = 'grams';
        payload.costPerUnit = fields.totalPreRollGrams > 0 ? cost / fields.totalPreRollGrams : 0;
    }
}

function validateWeedBuyForm(substanceId) {
    if (!isWeedTrackingMode(substanceId)) return null;
    const productType = document.getElementById('buy-weed-product-type')?.value || 'bud';
    if (productType === 'bud') {
        const g = parseFloat(document.getElementById('buy-bud-grams')?.value);
        if (!Number.isFinite(g) || g <= 0) return 'Enter bud grams for this purchase.';
    } else if (productType === 'cart' || productType === 'edibles') {
        const qty = parseFloat(document.getElementById('buy-quantity')?.value);
        if (!Number.isFinite(qty) || qty <= 0) return 'Enter quantity (count) for this purchase.';
    } else if (productType === 'prerolls') {
        const count = parseFloat(document.getElementById('buy-preroll-count')?.value);
        const grams = parseFloat(document.getElementById('buy-grams-per-preroll')?.value);
        if (!Number.isFinite(count) || count <= 0) return 'Enter pre-roll count.';
        if (!Number.isFinite(grams) || grams <= 0) return 'Enter grams per pre-roll.';
    }
    return null;
}

function parseCigaretteFieldsFromForm() {
    const raw = parseFloat(document.getElementById('buy-cigarette-nicotine-mg')?.value);
    return Number.isFinite(raw) && raw >= 0 ? raw : null;
}

function applyCigaretteFieldsToPayload(payload, nicotineMg) {
    if (nicotineMg != null) payload.nicotineMg = nicotineMg;
    else delete payload.nicotineMg;
}

function stripIrrelevantPurchaseFields(purchase) {
    if (!purchase || typeof purchase !== 'object') return;
    const mode = getSubstanceTrackingMode(getPurchaseSubstanceId(purchase));
    if (mode !== 'vape') {
        ['fullPuffCount', 'percentBoughtAt', 'startingPuffsLeft', 'remainingPuffs', 'eLiquidCapacityMl',
            'nicotineMgPerMl', 'totalNicotineMg', 'finishedAt'].forEach(key => delete purchase[key]);
    }
    if (mode !== 'alcohol') {
        ['alcoholPercent', 'netVolumeMl', 'pureAlcoholMl'].forEach(key => delete purchase[key]);
    }
    if (mode !== 'weed') {
        ['weedProductType', 'budGrams', 'cartGrams', 'ediblesMg', 'preRollCount', 'gramsPerPreRoll', 'totalPreRollGrams']
            .forEach(key => delete purchase[key]);
    }
    if (mode !== 'cigarettes') {
        delete purchase.nicotineMg;
    }
}

function migrateInventorySubstanceFields(data) {
    (data.purchases || []).forEach(purchase => {
        if (!purchase || typeof purchase !== 'object') return;
        try {
            syncAlcoholPurchaseFields(purchase);
            stripIrrelevantPurchaseFields(purchase);
        } catch (_) { /* keep old entries loadable */ }
    });
}

function createSubstance(opts) {
    const defaults = getSubstanceTrackingDefaults(opts.id);
    const primaryUnit = opts.primaryUnit || defaults.primaryUnit || opts.defaultUnit || opts.units?.[0] || 'units';
    return {
        id: opts.id,
        name: opts.name,
        icon: opts.icon || '📦',
        color: opts.color || '#4caf50',
        trackingMode: opts.trackingMode || defaults.trackingMode || 'standard',
        primaryUnit,
        secondaryCountLabel: opts.secondaryCountLabel ?? defaults.secondaryCountLabel ?? null,
        units: opts.units || ['units'],
        defaultUnit: opts.defaultUnit || primaryUnit,
        costTrackingEnabled: opts.costTrackingEnabled !== false,
        taperTrackingEnabled: opts.taperTrackingEnabled !== false,
        active: opts.active !== false,
        isMain: opts.isMain === true
    };
}

function getDefaultSubstances() {
    return DEFAULT_SUBSTANCE_CATALOG.map(entry => createSubstance({ ...entry }));
}

function getDefaultSubstanceSettings() {
    return {
        'vape-nicotine': { packPrice: 20, unitsPerPack: 200, baseline: 20, quitGoal: '' },
        coke: { packPrice: 80, unitsPerPack: 1, baseline: 0.5, quitGoal: '' },
        alcohol: { packPrice: 15, unitsPerPack: 6, baseline: 2, quitGoal: '' },
        'weed-thc': { packPrice: 50, unitsPerPack: 28, baseline: 1, quitGoal: '' },
        caffeine: { packPrice: 5, unitsPerPack: 30, baseline: 200, quitGoal: '' },
        lsd: { packPrice: 15, unitsPerPack: 10, baseline: 1, quitGoal: '' },
        molly: { packPrice: 25, unitsPerPack: 1, baseline: 100, quitGoal: '' },
        xannax: { packPrice: 10, unitsPerPack: 30, baseline: 1, quitGoal: '' },
        ketamine: { packPrice: 60, unitsPerPack: 1, baseline: 50, quitGoal: '' },
        cigarettes: { packPrice: 10, unitsPerPack: 20, baseline: 20, quitGoal: '' }
    };
}

function findSubstanceByNormalizedName(substances, name) {
    const target = normalizeSubstanceName(name);
    if (!target) return null;
    return substances.find(s => normalizeSubstanceName(s.name) === target) || null;
}

function getSubstanceCatalogIndex(substance) {
    if (!substance) return Number.MAX_SAFE_INTEGER;
    const byId = DEFAULT_SUBSTANCE_IDS.indexOf(substance.id);
    if (byId >= 0) return byId;
    const byName = DEFAULT_SUBSTANCE_CATALOG.findIndex(
        entry => normalizeSubstanceName(entry.name) === normalizeSubstanceName(substance.name)
    );
    return byName >= 0 ? byName : Number.MAX_SAFE_INTEGER;
}

function ensureDefaultSubstanceSettings(data) {
    ensureAppDataSettings(data);
    const defaults = getDefaultSubstanceSettings();
    Object.entries(defaults).forEach(([id, settings]) => {
        if (!data.settings.substanceSettings[id]) {
            data.settings.substanceSettings[id] = { ...settings };
        }
    });
}

function ensureDefaultSubstances(data) {
    if (!Array.isArray(data.substances)) data.substances = [];

    if (!data.substances.length) {
        data.substances = getDefaultSubstances();
        return;
    }

    const defaults = getDefaultSubstances();
    defaults.forEach(def => {
        const existsById = data.substances.some(s => s.id === def.id);
        const existsByName = findSubstanceByNormalizedName(data.substances, def.name);
        if (existsById || existsByName) return;
        data.substances.push(createSubstance({ ...def, isMain: false }));
    });

    reorderSubstancesCatalogFirst(data);
}

function reorderSubstancesCatalogFirst(data) {
    if (!Array.isArray(data.substances) || !data.substances.length) return;

    const byId = new Map(data.substances.map(s => [s.id, s]));
    const byNorm = new Map();
    data.substances.forEach(s => {
        const key = normalizeSubstanceName(s.name);
        if (!byNorm.has(key)) byNorm.set(key, s);
    });

    const ordered = [];
    const used = new Set();

    DEFAULT_SUBSTANCE_CATALOG.forEach(def => {
        const match = byId.get(def.id) || byNorm.get(normalizeSubstanceName(def.name));
        if (match && !used.has(match.id)) {
            ordered.push(match);
            used.add(match.id);
        }
    });

    data.substances.forEach(s => {
        if (!used.has(s.id)) ordered.push(s);
    });

    data.substances = ordered;
}

const SESSION_RATE_HIGH_MULTIPLIER = 1.5;
const SESSION_SHORT_BREAK_HOURS = 2;
const SESSION_LONG_BREAK_HOURS = 12;
const SUPPLY_LOW_REMAINING_PCT = 0.25;
const INVENTORY_EPS = 0.0001;
const PERCENT_REMAINING_UNITS = new Set(['puffs', 'pods', 'disposable']);
const DEFAULT_MAIN_SUBSTANCE_ID = VAPE_NICOTINE_ID;

const TAPER_RELAPSE_NOTE = 'Going over your limit doesn\'t erase your progress. Every day is a new chance—no shame, just data.';
const TAPER_STANDARD_REDUCTION_TYPES = ['reduce-amount', 'reduce-percent', 'fixed', 'manual-weekly'];
const TAPER_VAPE_REDUCTION_TYPES = ['reduce-puffs', 'reduce-buying', 'reduce-nicotine', 'manual-weekly'];
const TAPER_REDUCTION_LABELS = {
    'reduce-amount': 'Reduce by amount',
    'reduce-percent': 'Reduce by percent',
    fixed: 'Fixed daily limit',
    'manual-weekly': 'Manual weekly plan',
    'reduce-puffs': 'Reduce by puffs',
    'reduce-buying': 'Reduce buying',
    'reduce-nicotine': 'Reduce nicotine strength'
};
const TAPER_LEGACY_REDUCTION_ALIASES = {
    'step-weekly': '__legacy_step__',
    'weekly-step-down': '__legacy_step__',
    weeklyStepDown: '__legacy_step__',
    stepDown: '__legacy_step__',
    'reduce-by-amount': 'reduce-amount',
    reduceByAmount: 'reduce-amount',
    'reduce-by-percent': 'reduce-percent',
    reduceByPercent: 'reduce-percent',
    'reduce-by-puffs': 'reduce-puffs',
    reduceByPuffs: 'reduce-puffs',
    'reduce-buying': 'reduce-buying',
    reduceBuying: 'reduce-buying',
    'reduce-nicotine': 'reduce-nicotine',
    reduceNicotine: 'reduce-nicotine',
    'manual-weekly': 'manual-weekly',
    manualWeekly: 'manual-weekly'
};

function normalizeTaperReductionTypeValue(type) {
    if (type == null || type === '') return type;
    return TAPER_LEGACY_REDUCTION_ALIASES[type] ?? type;
}

function isReducePuffsPlan(plan) {
    return plan?.reductionType === 'reduce-puffs';
}

function isReduceBuyingPlan(plan) {
    return plan?.reductionType === 'reduce-buying';
}

function isReduceNicotinePlan(plan) {
    return plan?.reductionType === 'reduce-nicotine';
}

function isVapeSpecificTaperPlan(plan) {
    return isReducePuffsPlan(plan) || isReduceBuyingPlan(plan) || isReduceNicotinePlan(plan);
}

function getPuffReductionMode(plan) {
    return plan?.puffReductionMode === 'percent' ? 'percent' : 'amount';
}

function migrateLegacyTaperReductionType(plan, substanceId) {
    if (!plan) return;

    let type = normalizeTaperReductionTypeValue(plan.reductionType)
        || normalizeTaperReductionTypeValue(plan.planType);

    if (type === '__legacy_step__' || type === 'step-weekly') {
        plan.reductionType = isVapeTaperSubstanceId(substanceId) ? 'reduce-puffs' : 'reduce-amount';
        if (isVapeTaperSubstanceId(substanceId)) {
            plan.puffReductionMode = plan.puffReductionMode || 'amount';
        }
        return;
    }

    plan.reductionType = type
        || (isVapeTaperSubstanceId(substanceId) ? 'reduce-puffs' : 'reduce-amount');

    if (isVapeTaperSubstanceId(substanceId)) {
        if (['reduce-amount', 'reduce-percent', 'fixed'].includes(plan.reductionType)) {
            const previousType = plan.reductionType;
            plan.reductionType = 'reduce-puffs';
            if (!plan.puffReductionMode) {
                plan.puffReductionMode = previousType === 'reduce-percent' ? 'percent' : 'amount';
            }
        } else if (!TAPER_VAPE_REDUCTION_TYPES.includes(plan.reductionType)) {
            plan.reductionType = 'reduce-puffs';
            plan.puffReductionMode = plan.puffReductionMode || 'amount';
        }
    } else if (['reduce-puffs', 'reduce-buying', 'reduce-nicotine'].includes(plan.reductionType)) {
        plan.reductionType = 'reduce-amount';
    }
}

function repairTaperPlanDefaults(plan, substanceId) {
    if (!plan) return;
    const now = new Date().toISOString();
    plan.substanceId = substanceId;
    plan.startDate = plan.startDate || now.slice(0, 10);
    plan.reductionType = substanceId === VAPE_NICOTINE_ID || isVapeTaperSubstanceId(substanceId)
        ? 'reduce-puffs'
        : 'reduce-amount';
    plan.isPaused = !!plan.isPaused;
    plan.createdAt = plan.createdAt || now;
    plan.updatedAt = now;
    plan.goalDailyAverage = plan.goalDailyAverage ?? 0;
    plan.weeklyTargets = Array.isArray(plan.weeklyTargets) ? plan.weeklyTargets : [];
    plan.manualWeeklyTargets = Array.isArray(plan.manualWeeklyTargets) ? plan.manualWeeklyTargets : [];
}

function migrateTaperPlansSafely(data) {
    if (!data.taperPlans || typeof data.taperPlans !== 'object') {
        data.taperPlans = {};
        return;
    }
    Object.entries(data.taperPlans).forEach(([substanceId, plan]) => {
        if (!plan || typeof plan !== 'object') {
            delete data.taperPlans[substanceId];
            return;
        }
        try {
            migrateTaperPlan(plan, substanceId, data);
        } catch (err) {
            console.warn('Taper plan migration failed for', substanceId, err);
            try {
                repairTaperPlanDefaults(plan, substanceId);
                migrateTaperPlan(plan, substanceId, data);
            } catch (repairErr) {
                console.warn('Taper plan repair failed for', substanceId, repairErr);
                delete data.taperPlans[substanceId];
            }
        }
    });
}

const RECOVERY_TAPER_LABELS = {
    under: 'On track',
    close: 'Near plan',
    over: 'Above plan',
    none: 'No plan'
};

function formatAmount(value, maxDecimals = 2) {
    const n = parseFloat(value);
    if (!Number.isFinite(n)) return '0';
    const factor = Math.pow(10, maxDecimals);
    const rounded = Math.round((n + Number.EPSILON) * factor) / factor;
    const str = rounded.toFixed(maxDecimals);
    return str.replace(/\.?0+$/, '') || '0';
}

function formatAmountWithUnit(amount, unit) {
    if (amount === null || amount === undefined || amount === '') return '—';
    const n = Number(amount);
    if (!Number.isFinite(n)) return '—';
    const formattedAmount = n.toLocaleString(undefined, { maximumFractionDigits: 2 });
    return `${formattedAmount} ${unit || ''}`.trim();
}

function normalizePurchaseDisplayUnit(unit, purchase) {
    const raw = (unit || 'units').trim();
    if (isWeedPurchase(purchase)) {
        const type = purchase.weedProductType || 'bud';
        if (type === 'edibles') return 'edibles';
        if (type === 'prerolls') return 'g';
        if (type === 'bud') return 'g';
        if (type === 'cart') return raw === 'grams' ? 'g' : 'carts';
    }
    if (raw === 'grams') return 'g';
    return raw;
}

function getPurchaseRemainingDisplayAmount(purchase) {
    if (isVapePuffPurchase(purchase)) {
        if (purchase.remainingPuffs != null && purchase.remainingPuffs !== '') {
            return Math.max(0, parseFloat(purchase.remainingPuffs) || 0);
        }
    }
    return getPurchaseRemainingAmount(purchase);
}

function getPurchaseRemainingDisplayUnit(purchase) {
    if (isVapePuffPurchase(purchase)) return 'puffs';
    return normalizePurchaseDisplayUnit(purchase.unit || 'units', purchase);
}

function formatPurchaseRemainingWithUnit(purchase) {
    return formatAmountWithUnit(
        getPurchaseRemainingDisplayAmount(purchase),
        getPurchaseRemainingDisplayUnit(purchase)
    );
}

function generateUniqueId(prefix) {
    return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

function ensurePurchaseIds(data) {
    (data.purchases || []).forEach(purchase => {
        if (purchase.id == null || purchase.id === '') {
            purchase.id = generateUniqueId('purchase');
        }
    });
}

function getLogPurchaseId(log) {
    if (!log) return null;
    const id = log.inventoryId ?? log.purchaseId ?? log.linkedPurchaseId;
    return id != null && id !== '' ? id : null;
}

function setLogPurchaseId(log, purchaseId) {
    if (!log) return;
    if (purchaseId == null || purchaseId === '') {
        log.purchaseId = null;
        log.linkedPurchaseId = null;
        log.inventoryId = null;
        log.linkedPurchases = [];
        log.inventoryAffects = false;
        log.supplyUnlinked = true;
        return;
    }
    log.inventoryId = purchaseId;
    log.purchaseId = purchaseId;
    log.linkedPurchaseId = purchaseId;
    log.linkedPurchases = [];
    log.inventoryAffects = true;
    log.supplyUnlinked = false;
}

function syncLogInventoryId(log) {
    if (!log) return;
    if (log.inventoryId != null && log.inventoryId !== '') {
        log.purchaseId = log.inventoryId;
        log.linkedPurchaseId = log.inventoryId;
        return;
    }
    const pid = log.purchaseId ?? log.linkedPurchaseId;
    if (pid != null && pid !== '') {
        log.inventoryId = pid;
    }
}

function syncLogPurchaseFields(log) {
    if (!log) return;
    syncLogInventoryId(log);
    if (log.purchaseId != null && log.purchaseId !== '') {
        log.linkedPurchaseId = log.purchaseId;
        if (!log.inventoryId) log.inventoryId = log.purchaseId;
    } else if (log.linkedPurchaseId != null && log.linkedPurchaseId !== '') {
        log.purchaseId = log.linkedPurchaseId;
        if (!log.inventoryId) log.inventoryId = log.linkedPurchaseId;
    } else if (log.inventoryId != null && log.inventoryId !== '') {
        log.purchaseId = log.inventoryId;
        log.linkedPurchaseId = log.inventoryId;
    } else if (log.linkedPurchases?.length === 1) {
        log.purchaseId = log.linkedPurchases[0].purchaseId;
        log.linkedPurchaseId = log.purchaseId;
        log.inventoryId = log.purchaseId;
    }
}

function captureLegacySupplyText(log) {
    if (!log || getLogPurchaseId(log)) return;
    const legacy = log.legacySupplyText
        || (typeof log.supplySource === 'string' ? log.supplySource : '')
        || (typeof log.source === 'string' ? log.source : '')
        || (typeof log.supply === 'string' ? log.supply : '');
    if (legacy && !log.legacySupplyText) log.legacySupplyText = legacy;
}

const defaultData = {
    substances: getDefaultSubstances(),
    logs: [],
    purchases: [],
    cravings: [],
    settings: {
        currency: '$',
        substanceSettings: getDefaultSubstanceSettings(),
        vapeTaperCountMode: 'log-date'
    },
    taperPlans: {},
    recoveryStreaks: {},
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
            currency: '$',
            substanceSettings: { ...substanceSettings, ...settingsSubstance }
        },
        taperPlans,
        recoveryStreaks,
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
            if (raw) {
                try {
                    createAutoBackupFromData(JSON.parse(raw), 'before-v1-upgrade');
                } catch (_) { /* ignore */ }
            }
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

    ensurePurchaseIds(data);

    data.logs.forEach(log => {
        if (!log.type) log.type = log.endTime ? 'session' : 'quick';
        if (!log.startTime && log.time) log.startTime = log.time;
        const fallbackTs = log.timestamp || (log.date && (log.startTime || log.time)
            ? (parseLocalDateTime(log.date, log.startTime || log.time)?.toISOString() || null)
            : null);
        if (!log.createdAt) log.createdAt = fallbackTs || new Date().toISOString();
        if (!log.updatedAt) log.updatedAt = log.createdAt;
        if (!log.timestamp && fallbackTs) log.timestamp = fallbackTs;
        if (!log.transactionType) log.transactionType = 'use';
        const resolvedSubstanceId = normalizeSubstanceRef(getUseSubstanceId(log), data);
        if (resolvedSubstanceId) log.substanceId = resolvedSubstanceId;
        if (!Array.isArray(log.linkedPurchases)) log.linkedPurchases = [];
        syncLogPurchaseFields(log);
        normalizeUseLogWellness(log);
        if (hasLinkedSupply(log)) {
            log.inventoryAffects = true;
            log.supplyUnlinked = false;
        } else {
            captureLegacySupplyText(log);
            log.inventoryAffects = false;
            log.purchaseId = null;
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
    if (!data.migrations?.purchaseIdLinkV2) {
        createAutoBackupFromData(data, 'migration');
    }
    migratePurchaseIdLinkV2(data);

    data.purchases.forEach(p => {
        migratePurchaseInventory(p, data.logs || [], data);
    });

    ensureAppDataSettings(data);
    ensureAppDataMigrations(data);
    ensureDefaultSubstances(data);
    ensureDefaultSubstanceSettings(data);
    migrateSubstanceTrackingModes(data);
    migrateSubstanceNameDedupe(data);
    migrateInventorySubstanceFields(data);
    normalizeMainSubstances(data);
    migrateTaperPlansSafely(data);
    recalculateAllBreaksForData(data);
    recalculateAllBuyBreaksForData(data);
    delete data.supportContacts;
    delete data.reasons;
    migrateVapeDataV1(data);
    repairVapeInventoryLinks(data);
    migrateInventoryStatusFields(data);
    repairDataConsistency(data);
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
    data.settings.currency = '$';
    if (!data.settings.vapeTaperCountMode) {
        data.settings.vapeTaperCountMode = 'log-date';
    }
    ensureTableColumnSettings(data);
    ensureUseStatsConfig(data);
    ensureCollapsedSections(data);
    if (data.settings.activeTab === 'calendar-tab'
        || data.settings.activeTab === 'history-tab'
        || data.settings.activeTab === 'history') {
        data.settings.activeTab = 'use-log-tab';
    }
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
    statsSummaryDashboard: false,
    statsMonthlySummary: false,
    statsWeeklySummary: true,
    statsUseAnalytics: false,
    statsBuyAnalytics: true,
    statsLimitGoal: true,
    taperTodayStatus: false,
    taperWeeklyPlan: false,
    taperByWeek: false,
    taperWeeklyCalendar: false,
    buyWeeklySummary: false,
    buyMonthlySummary: false,
    dashRecoveryInsights: false,
    settingsSubstances: false,
    settingsStores: true,
    settingsBackup: true,
    settingsDataQuality: false,
    settingsDangerZone: true
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
    if (stored.taperByWeek === undefined && stored.taperCalendarPreview !== undefined) {
        stored.taperByWeek = stored.taperCalendarPreview;
    }
    if (stored.statsMonthlyTracking !== undefined && stored.statsMonthlySummary === undefined) {
        stored.statsMonthlySummary = stored.statsMonthlyTracking;
    }
    if (stored.statsUsageChart !== undefined && stored.statsUseAnalytics === undefined) {
        stored.statsUseAnalytics = stored.statsUsageChart;
    }
    if (stored.statsUseStats !== undefined && stored.statsUseAnalytics === undefined) {
        stored.statsUseAnalytics = stored.statsUseStats;
    }
    if (stored.statsBreakMetrics !== undefined && stored.statsUseAnalytics === undefined) {
        stored.statsUseAnalytics = !stored.statsBreakMetrics;
    }
    if (stored.statsBuyMetrics !== undefined && stored.statsBuyAnalytics === undefined) {
        stored.statsBuyAnalytics = stored.statsBuyMetrics;
    }
    if (stored.taperCalendarPreview !== undefined && stored.taperWeeklyCalendar === undefined) {
        stored.taperWeeklyCalendar = stored.taperCalendarPreview;
    }
    delete stored.settingsEmergency;
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
        order: ['select', 'date', 'substance', 'bought', 'remaining', 'usedPct', 'supplyDuration', 'supply', 'cost', 'store', 'payment', 'notes', 'break', 'actions'],
        hidden: [],
        widths: {
            select: 40,
            date: 110,
            substance: 140,
            bought: 110,
            remaining: 130,
            usedPct: 80,
            supplyDuration: 100,
            supply: 100,
            cost: 100,
            store: 140,
            payment: 110,
            notes: 220,
            break: 100,
            actions: 220
        }
    },
    statsWeekly: {
        order: ['week', 'start', 'end', 'usage', 'monthRunning', 'avgBreak', 'sessions', 'duration', 'avgDur', 'gPerSession', 'gPerHour', 'longBreak', 'shortBreak', 'status'],
        hidden: []
    },
    statsMonthly: {
        order: ['month', 'start', 'end', 'usage', 'purchased', 'cost', 'sessions', 'useDays', 'usePct', 'avgBreak', 'duration', 'avgDur', 'gPerSession', 'gPerUseDay', 'gPerCalDay', 'gPerHour'],
        hidden: ['gPerUseDay', 'gPerCalDay']
    },
    buyWeekly: {
        order: ['startWeek', 'endWeek', 'purchased', 'monthRunning', 'cost', 'costPerUnit', 'gPerDay', 'supplyDuration'],
        hidden: []
    },
    buyMonthly: {
        order: ['startMonth', 'endMonth', 'purchased', 'cost', 'costPerUnit', 'gPerDay', 'supplyDuration'],
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
        select: '',
        date: 'Date',
        substance: 'Substance',
        bought: 'Quantity',
        remaining: 'Remaining',
        usedPct: 'Used %',
        supplyDuration: 'Supply Duration',
        supply: 'Status',
        cost: 'Cost',
        store: 'Store',
        payment: 'Payment',
        notes: 'Notes',
        break: 'Break Since Previous Buy',
        actions: 'Actions'
    },
    statsWeekly: {
        week: 'Week',
        start: 'Start',
        end: 'End',
        usage: 'Usage',
        monthRunning: 'Month running',
        avgBreak: 'Avg break',
        sessions: 'Sessions',
        duration: 'Duration',
        avgDur: 'Avg dur',
        gPerSession: 'g/sess',
        gPerHour: 'g/hr',
        longBreak: 'Long break',
        shortBreak: 'Short break',
        status: 'Status'
    },
    statsMonthly: {
        month: 'Month',
        start: 'Start',
        end: 'End',
        usage: 'Usage',
        purchased: 'Purchased',
        cost: 'Cost',
        sessions: 'Sessions',
        useDays: 'Use days',
        usePct: 'Use %',
        avgBreak: 'Avg break',
        duration: 'Duration',
        avgDur: 'Avg dur',
        gPerSession: 'g/sess',
        gPerUseDay: 'g/use day',
        gPerCalDay: 'g/cal day',
        gPerHour: 'g/hr'
    },
    buyWeekly: {
        startWeek: 'Start Week',
        endWeek: 'End Week',
        purchased: 'Purchased',
        monthRunning: 'Month running',
        cost: 'Cost',
        costPerUnit: 'Cost/unit',
        gPerDay: 'g/day',
        supplyDuration: 'Supply Duration'
    },
    buyMonthly: {
        startMonth: 'Start Month',
        endMonth: 'End Month',
        purchased: 'Purchased',
        cost: 'Cost',
        costPerUnit: 'Cost/g',
        gPerDay: 'g/day',
        supplyDuration: 'Supply Duration'
    }
};

const COLUMN_MODAL_TITLES = {
    useHistory: 'Customize Use History Columns',
    purchaseHistory: 'Customize Purchase History Columns',
    statsWeekly: 'Customize Weekly Summary Columns',
    statsMonthly: 'Customize Monthly Summary Columns',
    buyWeekly: 'Customize Weekly Buy Summary Columns',
    buyMonthly: 'Customize Monthly Buy Summary Columns'
};

const TABLE_COLUMNS_REQUIRED = {
    useHistory: ['select', 'actions'],
    purchaseHistory: ['select', 'actions']
};

const PURCHASE_HISTORY_WIDTH_MAP = {
    S: 80,
    M: 120,
    L: 180,
    XL: 260
};

const PURCHASE_HISTORY_ACTIONS_WIDTH_MAP = {
    S: 220,
    M: 320,
    L: 420,
    XL: 520
};

const PURCHASE_HISTORY_COLUMN_WIDTH_DEFAULTS = TABLE_COLUMN_DEFAULTS.purchaseHistory.widths;

const PURCHASE_HISTORY_WIDTH_TIERS = ['S', 'M', 'L', 'XL'];

const USE_STATS_DEFAULTS = {
    order: [
        'totalUsage', 'sessionCount', 'avgPerSession', 'avgPerHr', 'totalDuration', 'avgDuration',
        'currentSupplyDuration', 'longestSession', 'shortestSession', 'longestBreak', 'shortestBreak', 'avgBreak',
        'useDays', 'useDayPct', 'avgPerUseDay', 'avgPerCalendarDay',
        'avgPuffsPerDay', 'vapeCount', 'avgCostPerVape'
    ],
    hidden: [
        'currentSupplyDuration', 'longestSession', 'shortestSession', 'longestBreak', 'shortestBreak', 'avgBreak',
        'useDays', 'useDayPct', 'avgPerUseDay', 'avgPerCalendarDay',
        'avgPuffsPerDay', 'vapeCount', 'avgCostPerVape'
    ]
};

const USE_STATS_VAPE_DEFAULTS = {
    order: [
        'totalUsage', 'avgPuffsPerDay', 'vapeCount', 'activeVapes', 'avgCostPerDay',
        'avgDaysPerVape', 'nicotineMgPerDay',
        'sessionCount', 'avgPuffsPerSession', 'puffsRemaining', 'percentLeft', 'avgCostPerVape',
        'avgDuration', 'currentSupplyDuration'
    ],
    hidden: [
        'sessionCount', 'avgPuffsPerSession', 'puffsRemaining', 'percentLeft', 'avgCostPerVape',
        'avgDuration', 'currentSupplyDuration'
    ]
};

const USE_STATS_COKE_DEFAULTS = {
    order: [
        'totalUsage', 'sessionCount', 'avgPerCalendarDay', 'avgPerUseDay',
        'avgPerSession', 'avgPerHr', 'totalDuration', 'avgDuration',
        'currentSupplyDuration', 'longestSession', 'shortestSession', 'longestBreak', 'shortestBreak', 'avgBreak',
        'useDays', 'useDayPct'
    ],
    hidden: [
        'avgPerSession', 'avgPerHr', 'totalDuration', 'avgDuration', 'currentSupplyDuration',
        'longestSession', 'shortestSession', 'longestBreak', 'shortestBreak', 'avgBreak',
        'avgPerUseDay', 'useDays', 'useDayPct'
    ]
};

const USE_STATS_WEED_DEFAULTS = {
    order: [...USE_STATS_COKE_DEFAULTS.order],
    hidden: [...USE_STATS_COKE_DEFAULTS.hidden]
};

const USE_STATS_LAYOUT_STORAGE_KEY = 'recoveryTracker.useStatsLayout.v1';

const VAPE_ONLY_USE_STAT_IDS = [
    'avgPuffsPerDay', 'avgPuffsPerSession', 'vapeCount', 'activeVapes',
    'avgCostPerVape', 'avgCostPerDay', 'nicotineMgPerDay', 'puffsRemaining', 'percentLeft'
];

const VAPE_EXCLUDED_USE_STAT_IDS = new Set([
    'avgPerSession', 'avgPerHr', 'totalDuration',
    'longestSession', 'shortestSession', 'longestBreak', 'shortestBreak', 'avgBreak',
    'useDays', 'useDayPct', 'avgPerUseDay', 'avgPerCalendarDay',
    'avgDuration', 'currentSupplyDuration', 'avgDaysPerVape'
]);

const WEED_EXCLUDED_USE_STAT_IDS = new Set([
    'avgPerHr', 'totalDuration', 'avgDuration',
    'longestSession', 'shortestSession', 'longestBreak', 'shortestBreak', 'avgBreak'
]);

const USE_STATS_LABELS = {
    totalUsage: 'Total Usage',
    sessionCount: 'Session Count',
    avgPerSession: 'Avg / Session',
    avgPerHr: 'Avg / hr',
    totalDuration: 'Total Duration',
    avgDuration: 'Avg Duration',
    currentSupplyDuration: 'Current Supply Duration',
    longestSession: 'Longest Session',
    shortestSession: 'Shortest Session',
    longestBreak: 'Longest Break',
    shortestBreak: 'Shortest Break',
    avgBreak: 'Avg Break',
    useDays: 'Use Days',
    useDayPct: 'Use Day %',
    avgPerUseDay: 'Avg / Use Day',
    avgPerCalendarDay: 'Avg / Calendar Day',
    avgPuffsPerDay: 'Avg puffs/day',
    avgPuffsPerSession: 'Avg puffs/session',
    vapeCount: 'Vape count',
    activeVapes: 'Active vapes',
    avgCostPerVape: 'Avg cost/vape',
    avgCostPerDay: 'Cost/day',
    avgDaysPerVape: 'Avg days/vape',
    nicotineMgPerDay: 'Nicotine mg/day (est.)',
    puffsRemaining: 'Puffs remaining',
    percentLeft: 'Percent left'
};

let columnSettingsTableKey = null;
let useLogDateFilter = 'all';
let inventoryTabFilter = 'active';
let inventorySearchQuery = '';
const inventorySelectedIds = new Set();
const inventoryListFilters = {
    substanceId: '',
    dateStart: '',
    dateEnd: '',
    status: '',
    paymentMethod: '',
    hasRemaining: '',
    hasCost: '',
    vapeOnly: false
};

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
        if (tableKey === 'purchaseHistory') {
            const defaultWidths = { ...PURCHASE_HISTORY_COLUMN_WIDTH_DEFAULTS };
            const storedWidths = stored.widths && typeof stored.widths === 'object' ? stored.widths : {};
            const widths = { ...defaultWidths };
            defaults.order.forEach(id => {
                if (storedWidths[id] != null) widths[id] = storedWidths[id];
            });
            data.settings.tableColumns[tableKey] = { order, hidden, widths };
        } else {
            data.settings.tableColumns[tableKey] = { order, hidden };
        }
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

function ensureUseStatsConfig(data) {
    if (!data.settings) data.settings = {};
    if (!data.settings.useStatsCards) {
        data.settings.useStatsCards = JSON.parse(JSON.stringify(USE_STATS_DEFAULTS));
        return;
    }
    const stored = data.settings.useStatsCards;
    const order = Array.isArray(stored.order)
        ? stored.order.filter(id => USE_STATS_DEFAULTS.order.includes(id))
        : [];
    USE_STATS_DEFAULTS.order.forEach(id => {
        if (!order.includes(id)) order.push(id);
    });
    const hidden = Array.isArray(stored.hidden)
        ? stored.hidden.filter(id => USE_STATS_DEFAULTS.order.includes(id))
        : [...USE_STATS_DEFAULTS.hidden];
    data.settings.useStatsCards = { order, hidden };
}

function getUseStatsConfig() {
    ensureUseStatsConfig(appData);
    return appData.settings.useStatsCards;
}

function getVisibleUseStatsOrder() {
    const config = getUseStatsConfig();
    const hidden = new Set(config.hidden || []);
    const order = [...config.order];
    USE_STATS_DEFAULTS.order.forEach(id => {
        if (!order.includes(id)) order.push(id);
    });
    return order.filter(id => USE_STATS_DEFAULTS.order.includes(id) && !hidden.has(id));
}

function saveUseStatsConfig(config) {
    ensureUseStatsConfig(appData);
    appData.settings.useStatsCards = config;
    saveData(appData);
}

function resetUseStatsConfig() {
    const defaults = isVapeNicotineSubstanceId(currentSubstanceId)
        ? USE_STATS_VAPE_DEFAULTS
        : USE_STATS_DEFAULTS;
    saveUseStatsConfig(JSON.parse(JSON.stringify(defaults)));
}

function openUseStatsSettingsModal() {
    const modal = document.getElementById('use-stats-settings-modal');
    renderUseStatsSettingsList();
    modal?.classList.remove('hidden');
}

function closeUseStatsSettingsModal() {
    document.getElementById('use-stats-settings-modal')?.classList.add('hidden');
}

function renderUseStatsSettingsList() {
    const list = document.getElementById('use-stats-settings-list');
    if (!list) return;
    const config = getUseStatsConfig();
    const hidden = new Set(config.hidden || []);
    const catalog = getUseStatsCatalogForSubstance(currentSubstanceId);
    const order = [];
    [...config.order, ...catalog].forEach(id => {
        if (catalog.includes(id) && !order.includes(id)) order.push(id);
    });

    list.innerHTML = order.map(statId => {
        const checked = !hidden.has(statId) && !VAPE_EXCLUDED_USE_STAT_IDS.has(statId) ? 'checked' : '';
        const label = getUseStatLabelForSubstance(statId, currentSubstanceId, 'puffs');
        return `<li class="column-settings-item" draggable="true" data-stat-id="${statId}">
            <span class="column-drag-handle" draggable="true" aria-hidden="true">☰</span>
            <label class="column-settings-label">
                <input type="checkbox" class="use-stats-settings-visible" data-stat-id="${statId}" ${checked}>
                ${label}
            </label>
        </li>`;
    }).join('');
}

function readUseStatsSettingsFromModal() {
    const list = document.getElementById('use-stats-settings-list');
    if (!list) return getUseStatsConfig();
    const catalog = new Set(getUseStatsCatalogForSubstance(currentSubstanceId));
    const modalOrder = [...list.querySelectorAll('.column-settings-item')].map(li => li.dataset.statId);
    const existing = getUseStatsConfig();
    const order = [...modalOrder];
    existing.order.forEach(id => {
        if (!order.includes(id)) order.push(id);
    });
    USE_STATS_DEFAULTS.order.forEach(id => {
        if (!order.includes(id)) order.push(id);
    });
    const hidden = [...(existing.hidden || [])];
    list.querySelectorAll('.use-stats-settings-visible').forEach(input => {
        const statId = input.dataset.statId;
        if (!catalog.has(statId)) return;
        if (!input.checked && !hidden.includes(statId)) hidden.push(statId);
        if (input.checked) {
            const idx = hidden.indexOf(statId);
            if (idx >= 0) hidden.splice(idx, 1);
        }
    });
    if (isVapeNicotineSubstanceId(currentSubstanceId)) {
        VAPE_EXCLUDED_USE_STAT_IDS.forEach(id => {
            if (!hidden.includes(id)) hidden.push(id);
        });
    }
    return { order, hidden };
}

function applyUseStatsSettingsFromModal() {
    const config = readUseStatsSettingsFromModal();
    saveUseStatsConfig(config);
    closeUseStatsSettingsModal();
    updateStats();
}

function resetUseStatsSettingsFromModal() {
    resetUseStatsConfig();
    renderUseStatsSettingsList();
    updateStats();
}

function setupUseStatsSettingsModal() {
    document.getElementById('use-stats-edit-btn')?.addEventListener('click', openUseStatsSettingsModal);
    document.getElementById('use-stats-settings-close')?.addEventListener('click', closeUseStatsSettingsModal);
    document.getElementById('use-stats-settings-apply')?.addEventListener('click', applyUseStatsSettingsFromModal);
    document.getElementById('use-stats-settings-reset')?.addEventListener('click', resetUseStatsSettingsFromModal);

    const list = document.getElementById('use-stats-settings-list');
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
        e.dataTransfer.setData('text/plain', item.dataset.statId);
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
        const from = items.indexOf(dragItem);
        const to = items.indexOf(target);
        if (from < 0 || to < 0) return;
        if (from < to) target.after(dragItem);
        else target.before(dragItem);
        target.classList.remove('column-settings-drop-target');
    });
}

function resetTableColumnConfig(tableKey) {
    saveTableColumnConfig(tableKey, JSON.parse(JSON.stringify(TABLE_COLUMN_DEFAULTS[tableKey])));
}

function openColumnSettingsModal(tableKey) {
    columnSettingsTableKey = tableKey;
    const modal = document.getElementById('column-settings-modal');
    const title = document.getElementById('column-settings-title');
    if (title) {
        title.textContent = COLUMN_MODAL_TITLES[tableKey] || 'Customize Columns';
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
        const label = getTableColumnLabelForSubstance(tableKey, colId, currentSubstanceId);
        const widthControl = tableKey === 'purchaseHistory'
            ? renderPurchaseHistoryColumnWidthControl(colId)
            : '';
        return `<li class="column-settings-item${tableKey === 'purchaseHistory' ? ' column-settings-item-with-width' : ''}" draggable="true" data-col-id="${colId}">
            <span class="column-drag-handle" draggable="true" aria-hidden="true">☰</span>
            <label class="column-settings-label">
                <input type="checkbox" class="column-settings-visible" data-col-id="${colId}" ${disabled}>
                ${label}${reqNote}
            </label>
            ${widthControl}
        </li>`;
    }).join('');
}

function renderPurchaseHistoryColumnWidthControl(colId) {
    const setting = getPurchaseHistoryColumnWidthSetting(colId);
    const isCustomPx = typeof setting === 'number' && setting > 0;
    const selectValue = isCustomPx
        ? findNearestPurchaseHistoryWidthTier(colId, setting)
        : (PURCHASE_HISTORY_WIDTH_TIERS.includes(setting) ? setting : 'M');
    const options = PURCHASE_HISTORY_WIDTH_TIERS.map(tier =>
        `<option value="${tier}"${selectValue === tier ? ' selected' : ''}>${tier}</option>`
    ).join('');
    const customHint = isCustomPx
        ? `<span class="column-settings-width-hint">${Math.round(setting)}px</span>`
        : '';
    return `<div class="column-settings-width">
        <label class="column-settings-width-label" for="column-width-${colId}">Width</label>
        <select id="column-width-${colId}" class="column-settings-width-select" data-col-id="${colId}" onchange="this.dataset.widthDirty='1'">${options}</select>
        ${customHint}
    </div>`;
}

function getPurchaseHistoryColumnWidthSetting(colId) {
    const config = getTableColumnConfig('purchaseHistory');
    const widths = config.widths || PURCHASE_HISTORY_COLUMN_WIDTH_DEFAULTS;
    if (widths[colId] != null) return widths[colId];
    return PURCHASE_HISTORY_COLUMN_WIDTH_DEFAULTS[colId] || 'M';
}

function getPurchaseHistoryColumnWidthPx(colId, widthSetting) {
    if (typeof widthSetting === 'number' && Number.isFinite(widthSetting) && widthSetting > 0) {
        return Math.round(widthSetting);
    }
    if (typeof widthSetting === 'string' && /^\d+(\.\d+)?px$/.test(widthSetting)) {
        return Math.round(parseFloat(widthSetting));
    }
    const map = colId === 'actions' ? PURCHASE_HISTORY_ACTIONS_WIDTH_MAP : PURCHASE_HISTORY_WIDTH_MAP;
    const key = PURCHASE_HISTORY_WIDTH_TIERS.includes(widthSetting) ? widthSetting : 'M';
    return map[key] || map.M;
}

function findNearestPurchaseHistoryWidthTier(colId, px) {
    const map = colId === 'actions' ? PURCHASE_HISTORY_ACTIONS_WIDTH_MAP : PURCHASE_HISTORY_WIDTH_MAP;
    let nearest = 'M';
    let nearestDiff = Number.POSITIVE_INFINITY;
    PURCHASE_HISTORY_WIDTH_TIERS.forEach(tier => {
        const diff = Math.abs(map[tier] - px);
        if (diff < nearestDiff) {
            nearestDiff = diff;
            nearest = tier;
        }
    });
    return nearest;
}

function getPurchaseHistoryColumnWidthsMap() {
    const config = getTableColumnConfig('purchaseHistory');
    return { ...(config.widths || PURCHASE_HISTORY_COLUMN_WIDTH_DEFAULTS) };
}

function savePurchaseHistoryColumnWidth(colId, px) {
    const config = getTableColumnConfig('purchaseHistory');
    const widths = getPurchaseHistoryColumnWidthsMap();
    widths[colId] = Math.max(colId === 'actions' ? 180 : 60, Math.round(px));
    saveTableColumnConfig('purchaseHistory', { ...config, widths });
}

function buildPurchaseHistoryColgroup(columnIds) {
    const widths = getPurchaseHistoryColumnWidthsMap();
    let html = '<colgroup>';
    columnIds.forEach(colId => {
        const px = getPurchaseHistoryColumnWidthPx(colId, widths[colId]);
        html += `<col data-col="${colId}" style="width:${px}px;min-width:${px}px">`;
    });
    html += '</colgroup>';
    return html;
}

function setupPurchaseHistoryColumnResize() {
    if (document.documentElement.dataset.purchaseHistoryColResizeBound === '1') return;
    document.documentElement.dataset.purchaseHistoryColResizeBound = '1';

    let active = null;

    document.addEventListener('mousedown', e => {
        const handle = e.target.closest('.purchase-history-col-resize');
        if (!handle) return;
        e.preventDefault();
        const colId = handle.dataset.colResize;
        const table = handle.closest('table.purchase-history-table');
        const col = table?.querySelector(`colgroup col[data-col="${colId}"]`);
        if (!table || !col) return;
        const startWidth = col.getBoundingClientRect().width || getPurchaseHistoryColumnWidthPx(colId, getPurchaseHistoryColumnWidthSetting(colId));
        active = { colId, col, table, startX: e.clientX, startWidth };
        document.body.classList.add('purchase-history-col-resizing');
    });

    document.addEventListener('mousemove', e => {
        if (!active) return;
        e.preventDefault();
        const minW = active.colId === 'actions' ? 180 : 60;
        const newWidth = Math.max(minW, Math.round(active.startWidth + (e.clientX - active.startX)));
        active.col.style.width = `${newWidth}px`;
        active.col.style.minWidth = `${newWidth}px`;
        const total = [...active.table.querySelectorAll('colgroup col')].reduce((sum, c) => {
            return sum + (parseInt(c.style.width, 10) || c.getBoundingClientRect().width || 0);
        }, 0);
        active.table.style.minWidth = `${Math.max(total, 320)}px`;
    });

    document.addEventListener('mouseup', () => {
        if (!active) return;
        const px = parseInt(active.col.style.width, 10) || active.startWidth;
        savePurchaseHistoryColumnWidth(active.colId, px);
        document.body.classList.remove('purchase-history-col-resizing');
        active = null;
    });
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
    const result = { order, hidden };
    if (tableKey === 'purchaseHistory') {
        const widths = getPurchaseHistoryColumnWidthsMap();
        list.querySelectorAll('.column-settings-width-select').forEach(select => {
            const colId = select.dataset.colId;
            if (!colId) return;
            if (select.dataset.widthDirty === '1' || typeof widths[colId] !== 'number') {
                widths[colId] = select.value;
            }
        });
        result.widths = widths;
    }
    return result;
}

function refreshTableAfterColumnChange(tableKey) {
    const substanceId = isAllSubstancesView() ? null : currentSubstanceId;
    switch (tableKey) {
        case 'useHistory':
            renderUseHistoryTable();
            break;
        case 'purchaseHistory':
            renderPurchaseHistory(substanceId);
            break;
        case 'statsWeekly':
            renderStatsWeeklySummary(currentSubstanceId);
            break;
        case 'statsMonthly':
            renderStatsMonthlySummary(currentSubstanceId);
            break;
        case 'buyWeekly':
            renderBuyWeeklySummary(substanceId);
            break;
        case 'buyMonthly':
            renderBuyMonthlySummary(substanceId);
            break;
        default:
            break;
    }
}

function applyColumnSettingsFromModal() {
    if (!columnSettingsTableKey) return;
    const tableKey = columnSettingsTableKey;
    const config = readColumnSettingsFromModal(tableKey);
    saveTableColumnConfig(tableKey, config);
    closeColumnSettingsModal();
    refreshTableAfterColumnChange(tableKey);
}

function resetColumnSettingsFromModal() {
    if (!columnSettingsTableKey) return;
    const tableKey = columnSettingsTableKey;
    resetTableColumnConfig(tableKey);
    renderColumnSettingsList(tableKey);
    refreshTableAfterColumnChange(tableKey);
}

function setupColumnSettingsModal() {
    document.getElementById('use-history-customize-columns')?.addEventListener('click', () => {
        openColumnSettingsModal('useHistory');
    });
    document.getElementById('purchase-history-customize-columns')?.addEventListener('click', () => {
        openColumnSettingsModal('purchaseHistory');
    });
    document.getElementById('stats-weekly-customize-columns')?.addEventListener('click', () => {
        openColumnSettingsModal('statsWeekly');
    });
    document.getElementById('stats-monthly-customize-columns')?.addEventListener('click', () => {
        openColumnSettingsModal('statsMonthly');
    });
    document.getElementById('buy-weekly-customize-columns')?.addEventListener('click', () => {
        openColumnSettingsModal('buyWeekly');
    });
    document.getElementById('buy-monthly-customize-columns')?.addEventListener('click', () => {
        openColumnSettingsModal('buyMonthly');
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

    setupPurchaseHistoryColumnResize();
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
    const isWeedSimple = isWeedDateOnlyUseLog(entry);
    const isVapeDateOnly = isVapeDateOnlyUseLog(entry);
    const hideTimeStats = isWeedSimple || isVapeDateOnly;
    const rateStr = (!hideTimeStats && entry.useRate != null) ? `${formatAmount(entry.useRate)}/${sub.defaultUnit}/hr` : '—';
    const checked = useHistorySelectionHas(entry.id) ? 'checked' : '';
    switch (colId) {
        case 'select':
            return `<td class="use-history-cb-col"><input type="checkbox" class="use-history-row-cb" data-log-id="${entry.id}" aria-label="Select session" ${checked}></td>`;
        case 'date':
            return `<td>${formatDate(entry.date)}</td>`;
        case 'start':
            return `<td>${hideTimeStats ? '—' : (entry.startTime || entry.time || '—')}</td>`;
        case 'end':
            return `<td>${hideTimeStats ? '—' : (entry.endTime || '—')}</td>`;
        case 'duration':
            return `<td>${hideTimeStats ? '—' : formatDurationHours(entry.durationHours)}</td>`;
        case 'amount':
            return `<td>${formatAmount(entry.amount)}</td>`;
        case 'unit':
            return `<td>${entry.unit}</td>`;
        case 'count':
            return `<td>${isVapeUseLog(entry) ? '—' : (entry.count || '—')}</td>`;
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

function getPurchaseHistoryColumnLabel(colId) {
    return TABLE_COLUMN_LABELS.purchaseHistory[colId] || colId;
}

function getPurchaseHistoryTableMinWidth(columns) {
    const widths = getPurchaseHistoryColumnWidthsMap();
    let min = 0;
    columns.forEach(colId => {
        min += getPurchaseHistoryColumnWidthPx(colId, widths[colId]);
    });
    return Math.max(min, 320);
}

function renderPurchaseHistoryHeaderCell(colId) {
    const label = getPurchaseHistoryColumnLabel(colId);
    const resize = colId === 'select' ? '' : `<span class="purchase-history-col-resize" data-col-resize="${colId}" role="separator" aria-orientation="vertical" aria-label="Resize ${escapeAttr(label)} column"></span>`;
    if (colId === 'select') {
        return `<th class="select-cell" data-col="${colId}"><input type="checkbox" id="inventory-select-all" aria-label="Select all"></th>`;
    }
    if (colId === 'actions') {
        return `<th class="actions-cell" data-col="${colId}"><span class="purchase-history-th-label">${label}</span>${resize}</th>`;
    }
    return `<th data-col="${colId}"><span class="purchase-history-th-label">${label}</span>${resize}</th>`;
}

function phTd(colId, content, className = '') {
    const label = getPurchaseHistoryColumnLabel(colId);
    const cls = className ? ` class="${className}"` : '';
    return `<td${cls} data-col="${colId}" data-label="${escapeAttr(label)}">${content}</td>`;
}

function renderPurchaseBoughtMetaInner(purchase) {
    if (isAlcoholPurchase(purchase)) {
        const pct = purchase.alcoholPercent;
        const vol = purchase.netVolumeMl;
        const pure = getAlcoholPureAlcoholMl(purchase);
        let meta = '';
        if (pct != null && pct !== '') meta += `<div class="purchase-vape-meta">Alcohol: ${formatAmount(pct)}%</div>`;
        if (vol != null && vol !== '') meta += `<div class="purchase-vape-meta">Net volume: ${formatAmount(vol)} mL</div>`;
        if (pure != null) meta += `<div class="purchase-vape-meta">Pure alcohol: ${formatAmount(pure)} mL</div>`;
        return meta;
    }
    if (isWeedPurchase(purchase)) {
        return `<div class="purchase-vape-meta">${formatWeedPurchaseDisplayLine(purchase)}</div>`;
    }
    if (isCigarettesPurchase(purchase)) {
        const nic = purchase.nicotineMg;
        if (nic != null && nic !== '') {
            return `<div class="purchase-vape-meta">Nicotine: ${formatAmount(nic)} mg</div>`;
        }
    }
    return '';
}

function renderPurchaseWeedBoughtCell(purchase) {
    return phTd('bought', formatWeedPurchaseDisplayLine(purchase), 'purchase-weed-bought-cell');
}

function renderPurchaseVapeBoughtCell(purchase) {
    const full = getVapeFullPuffCount(purchase);
    const pctBought = getVapePercentBoughtAt(purchase);
    const starting = getVapeStartingPuffsLeft(purchase);
    const cap = getVapeELiquidCapacityMl(purchase);
    const strength = getVapeNicotineMgPerMl(purchase);
    const totalNic = getVapeTotalNicotineMg(purchase);
    let liquidLines = '';
    if (cap != null) liquidLines += `<div class="purchase-vape-meta">E-liquid: ${formatAmount(cap)} mL</div>`;
    if (strength != null) liquidLines += `<div class="purchase-vape-meta">Nicotine: ${formatAmount(strength)} mg/mL</div>`;
    if (totalNic != null) liquidLines += `<div class="purchase-vape-meta">Total nicotine: ${formatAmount(totalNic)} mg</div>`;
    return phTd('bought', `<div>Full puff count: ${formatAmount(full)}</div>
        <div class="purchase-vape-meta">Bought at: ${pctBought}%</div>
        <div class="purchase-vape-meta">Started left: ${formatAmount(starting)} puffs</div>
        ${liquidLines}`, 'purchase-vape-bought-cell');
}

function renderPurchaseHistoryBodyCell(colId, ctx) {
    const {
        purchase, sub, cur, store, bought, remaining, pctUsed, supply, unit,
        breakCell, supplyDurationLabel, supplyDurationTooltip,
        totalNum, cpu, expanded, toggleLabel
    } = ctx;
    switch (colId) {
        case 'date':
            return phTd('date', formatDate(purchase.date || ''));
        case 'substance':
            return phTd('substance', `${sub?.icon || ''} ${sub?.name || 'Unknown'}`);
        case 'bought':
            if (isVapePuffPurchase(purchase)) {
                return renderPurchaseVapeBoughtCell(purchase);
            }
            if (isWeedPurchase(purchase)) {
                return renderPurchaseWeedBoughtCell(purchase);
            }
            {
                const meta = renderPurchaseBoughtMetaInner(purchase);
                if (meta) {
                    return phTd('bought', `<div>${formatAmount(bought)}${unit}</div>${meta}`);
                }
            }
            return phTd('bought', `${formatAmount(bought)}${unit}`);
        case 'remaining':
            return phTd('remaining', formatPurchaseRemainingDisplay(purchase), 'purchase-remaining-cell');
        case 'usedPct':
            return phTd('usedPct', `${pctUsed}%`);
        case 'supplyDuration': {
            const titleAttr = supplyDurationTooltip ? ` title="${supplyDurationTooltip}"` : '';
            return `<td class="purchase-supply-duration-cell" data-col="supplyDuration" data-label="${escapeAttr(getPurchaseHistoryColumnLabel('supplyDuration'))}"${titleAttr}>${supplyDurationLabel}</td>`;
        }
        case 'supply':
            return phTd(
                'supply',
                `<span class="purchase-supply-status ${supply.className}">${supply.label}</span>`,
                'supply-cell'
            );
        case 'cost':
            return phTd('cost', `${fmtSheetMoney(totalNum, cur)} <small>(${fmtSheetMoney(cpu, cur)}/u)</small>`);
        case 'store':
            return phTd('store', store || '—');
        case 'payment':
            return phTd('payment', purchase.paymentMethod || '—');
        case 'notes':
            return phTd('notes', purchase.notes || '—', 'notes-cell');
        case 'break':
            return phTd('break', breakCell);
        case 'actions': {
            const pid = normalizePurchaseId(purchase.id);
            const markEmptyBtn = isVapePuffPurchase(purchase) && remaining > INVENTORY_EPS
                ? `<button type="button" class="secondary-btn btn-sm" data-mark-vape-empty="${escapeAttr(pid)}">Mark empty</button>`
                : '';
            const vapeLifecycleBtns = isVapePuffPurchase(purchase) ? `
                <button type="button" class="secondary-btn btn-sm" data-mark-vape-finished="${escapeAttr(pid)}">Mark Finished</button>` : '';
            const statusBtns = `
                <button type="button" class="secondary-btn btn-sm" data-mark-purchase-active="${escapeAttr(pid)}">Active</button>
                <button type="button" class="secondary-btn btn-sm" data-mark-purchase-stored="${escapeAttr(pid)}">Stored</button>
                <button type="button" class="secondary-btn btn-sm" data-mark-purchase-depleted="${escapeAttr(pid)}">Depleted</button>
                <button type="button" class="secondary-btn btn-sm" data-${purchase.inventoryHidden ? 'unhide' : 'hide'}-purchase="${escapeAttr(pid)}">${purchase.inventoryHidden ? 'Unhide' : 'Hide'}</button>
                <button type="button" class="secondary-btn btn-sm" data-recalculate-purchase="${escapeAttr(pid)}">Recalc</button>`;
            const buttons = `
                <button type="button" class="secondary-btn btn-sm purchase-expand-btn" data-purchase-toggle="${escapeAttr(pid)}" data-toggle-purchase-logs="${escapeAttr(pid)}" aria-expanded="${expanded ? 'true' : 'false'}">${toggleLabel}</button>
                <button type="button" class="secondary-btn btn-sm" data-edit-purchase="${escapeAttr(pid)}">Edit</button>
                <button type="button" class="secondary-btn btn-sm" data-duplicate-purchase-now="${escapeAttr(pid)}">Duplicate</button>
                ${markEmptyBtn}
                ${vapeLifecycleBtns}
                ${statusBtns}
                <button type="button" class="delete-btn btn-sm" data-delete-purchase="${escapeAttr(pid)}">Delete</button>`;
            return phTd(
                'actions',
                `<div class="purchase-history-actions-wrap">${buttons}</div>`,
                'actions-cell purchase-history-actions-cell'
            );
        }
        case 'select': {
            const pid = normalizePurchaseId(purchase.id);
            const checked = inventorySelectedIds.has(pid) ? 'checked' : '';
            return phTd('select', `<input type="checkbox" class="inventory-select-cb" data-inventory-select="${escapeAttr(pid)}" ${checked} aria-label="Select purchase">`, 'select-cell');
        }
        default:
            return phTd(colId, '—');
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
        main = active.find(s => s.id === DEFAULT_MAIN_SUBSTANCE_ID)
            || findSubstanceByNormalizedName(active, 'Vape/Nicotine')
            || active[0];
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
    updateAutoBackupDisplay();
}

function createAutoBackup(reason = 'auto') {
    try {
        const payload = {
            savedAt: new Date().toISOString(),
            reason,
            data: JSON.parse(JSON.stringify(appData))
        };
        localStorage.setItem(AUTO_BACKUP_KEY, JSON.stringify(payload));
        updateAutoBackupDisplay();
        return true;
    } catch (err) {
        console.error('Auto backup failed', err);
        return false;
    }
}

function createAutoBackupFromData(data, reason = 'migration') {
    try {
        const payload = {
            savedAt: new Date().toISOString(),
            reason,
            data: JSON.parse(JSON.stringify(data))
        };
        localStorage.setItem(AUTO_BACKUP_KEY, JSON.stringify(payload));
        return true;
    } catch (err) {
        console.error('Auto backup failed', err);
        return false;
    }
}

function getAutoBackupInfo() {
    try {
        const raw = localStorage.getItem(AUTO_BACKUP_KEY);
        if (!raw) return null;
        const parsed = JSON.parse(raw);
        return parsed?.savedAt ? { savedAt: parsed.savedAt, reason: parsed.reason || 'auto' } : null;
    } catch {
        return null;
    }
}

function updateAutoBackupDisplay() {
    const info = getAutoBackupInfo();
    const label = info ? formatLastSaved(info.savedAt) : 'Never';
    const el = document.getElementById('settings-auto-backup-date');
    if (el) el.textContent = label;
}

function restoreLastAutoBackup() {
    const raw = localStorage.getItem(AUTO_BACKUP_KEY);
    if (!raw) {
        alert('No automatic backup found.');
        return;
    }
    let parsed;
    try {
        parsed = JSON.parse(raw);
    } catch {
        alert('Could not read the automatic backup.');
        return;
    }
    const backupData = parsed?.data;
    const validation = validateBackupData(backupData);
    if (!validation.ok) {
        alert(validation.error || 'Automatic backup is invalid.');
        return;
    }
    if (!confirm('Restore the last automatic backup? Current data will be replaced.')) return;
    createAutoBackup('before-restore');
    appData = backupData;
    normalizeAppData(appData);
    saveData(appData);
    refreshAppAfterDataChange();
    alert('Restored from last automatic backup.');
}

function repairAppData() {
    if (!confirm('Repair data consistency issues?\n\nAn automatic backup will be saved first.')) return;
    createAutoBackup('before-repair');
    repairVapeInventoryLinks(appData);
    const stats = repairDataConsistency(appData);
    saveData(appData);
    refreshAppAfterDataChange();
    renderDataQualityPanel();
    alert(`Data repair complete.\n\n${formatRepairSummary(stats)}`);
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
    if (!appData?.substances?.length) return null;
    return appData.substances.find(s => s.active && s.isMain) || getActiveSubstances()[0] || null;
}

function getMainSubstanceId() {
    if (!appData?.substances?.length) return DEFAULT_MAIN_SUBSTANCE_ID;
    return getMainSubstance()?.id || DEFAULT_MAIN_SUBSTANCE_ID;
}

function resolveDefaultSelectedSubstanceId() {
    if (!appData?.substances?.length) return DASHBOARD_ALL;
    const mainId = getMainSubstanceId();
    if (mainId) return mainId;
    return getActiveSubstances()[0]?.id || DASHBOARD_ALL;
}

function isSelectedAllSubstances() {
    return selectedSubstanceId === DASHBOARD_ALL;
}

function getSelectedSubstanceFilterId() {
    return isSelectedAllSubstances() ? null : selectedSubstanceId;
}

function resolveStartupSubstanceId() {
    if (!appData?.substances?.length) return DEFAULT_MAIN_SUBSTANCE_ID;
    const mainId = getMainSubstanceId();
    if (mainId) return mainId;
    return appData.substances.find(s => s.active)?.id || DEFAULT_MAIN_SUBSTANCE_ID;
}

function sortSubstancesMainFirst(list) {
    return [...list].sort((a, b) => {
        if (a.isMain !== b.isMain) return a.isMain ? -1 : 1;
        if (a.active !== b.active) return a.active ? -1 : 1;
        const catalogDiff = getSubstanceCatalogIndex(a) - getSubstanceCatalogIndex(b);
        if (catalogDiff !== 0) return catalogDiff;
        return a.name.localeCompare(b.name);
    });
}

let appData;
try {
    appData = loadData();
} catch (error) {
    console.error('Failed to load app data, using defaults:', error);
    appData = typeof structuredClone === 'function'
        ? structuredClone(defaultData)
        : JSON.parse(JSON.stringify(defaultData));
    try {
        appData = normalizeAppData(appData);
    } catch (normalizeError) {
        console.error('Failed to normalize default app data:', normalizeError);
    }
}

let currentSubstanceId = resolveStartupSubstanceId();
let selectedSubstanceId = resolveDefaultSelectedSubstanceId();
let statsDateRangePreset = 'last-7';
let statsCustomStartDate = '';
let statsCustomEndDate = '';

document.addEventListener('DOMContentLoaded', () => {
    try {
        initializeApp();
    } catch (error) {
        console.error('Error initializing app:', error);
    }
});

function initializeApp() {
    setupEventListeners();
    populateAllSubstanceDropdowns();
    syncSubstanceSelectors();
    syncUseLogFormFromSelectedSubstance();
    syncBuyFormFromSelectedSubstance();
    updateDashboard();
    renderRecentUseList();
    refreshTaperDashboard();
    renderSubstancesList();
    renderStoresList();
    renderDataQualityPanel();
    updateVapeTaperModeNote();
    syncVapeTaperCountModeSelect();
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

    if (appData.settings?.activeTab) {
        switchTab(appData.settings.activeTab);
    }
}

function refreshAppAfterDataChange() {
    recalculateAllBreaks();
    recalculateAllBuyBreaks();
    currentSubstanceId = resolveStartupSubstanceId();
    ensureSelectedSubstanceIdValid();
    populateAllSubstanceDropdowns();
    populatePageSubstanceDropdowns();
    syncSubstanceSelectors();
    syncUseLogFormFromSelectedSubstance();
    applyMainSubstanceToForms();
    applyMainSubstanceToViewSelectors();
    updateDashboard();
    updateDashboardMainDisplay();
    updateQuickActions();
    renderRecentUseList();
    renderUseLogTab();
    updateStats();
    renderBuyTrackerTab();
    syncTaperSubstanceToMain();
    refreshTaperDashboard();
    renderSubstancesList();
    renderStoresList();
    renderDataQualityPanel();
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

function getActiveSubstances(data = appData) {
    return sortSubstancesMainFirst((data.substances || []).filter(s => s.active));
}

function setMainSubstance(id) {
    const sub = getSubstance(id);
    if (!sub) return;
    if (!sub.active) return alert('Only active substances can be set as main.');
    appData.substances.forEach(s => { s.isMain = s.id === id; });
    saveData(appData);
    currentSubstanceId = id;
    selectedSubstanceId = id;
    populateAllSubstanceDropdowns();
    populatePageSubstanceDropdowns();
    syncUseLogFormFromSelectedSubstance();
    applyMainSubstanceToViewSelectors();
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
    syncUseLogFormFromSelectedSubstance();
    syncBuyFormFromSelectedSubstance();
    if (!mainId || !isSelectedAllSubstances()) return;
    const useEl = document.getElementById('use-substance');
    if (useEl && [...useEl.options].some(o => o.value === mainId)) useEl.value = mainId;
    const buyEl = document.getElementById('buy-substance');
    if (buyEl && [...buyEl.options].some(o => o.value === mainId)) buyEl.value = mainId;
    updateUseUnitDropdown();
    updateBuyUnitDropdown();
}

function applyMainSubstanceToViewSelectors() {
    const mainId = getMainSubstanceId();
    if (!mainId) return;
    currentSubstanceId = mainId;
    ['dashboard-substance', 'stats-substance'].forEach(selectId => {
        const el = document.getElementById(selectId);
        if (el && [...el.options].some(o => o.value === mainId)) el.value = mainId;
    });
    const taperEl = document.getElementById('taper-substance');
    if (taperEl && [...taperEl.options].some(o => o.value === mainId)) taperEl.value = mainId;
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
    const viewDefault = mainId || currentSubstanceId;

    populateSelect('dashboard-substance', active, { includeAll: true, currentValue: viewDefault });
    populateSelect('stats-substance', active, { includeAll: true, currentValue: viewDefault });
    populateSelect('use-substance', getLoggableSubstances(), { currentValue: isSelectedAllSubstances() ? getMainSubstanceId() : selectedSubstanceId });
    populateSelect('buy-substance', active, { currentValue: isSelectedAllSubstances() ? mainId : selectedSubstanceId });
    populatePageSubstanceDropdowns();
    populateTaperReductionTypeSelect(getTaperSubstanceId());
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
    updateSubstanceTrackingFormUI();
    updateVapeUseFormUI();
}

function updateSubstanceTrackingFormUI() {
    const substanceId = document.getElementById('use-substance')?.value;
    if (isWeedTrackingMode(substanceId)) {
        updateWeedUseFormUI();
        return;
    }
    document.getElementById('use-weed-product-type-group')?.classList.add('hidden');
    const amountLabel = document.getElementById('use-amount-label');
    const countLabel = document.querySelector('#use-count-group label');
    const primaryUnit = getSubstancePrimaryUnit(substanceId);
    const countFieldLabel = getSubstanceSecondaryCountLabel(substanceId);
    if (amountLabel) {
        amountLabel.textContent = primaryUnit && primaryUnit !== 'units'
            ? `Amount (${primaryUnit})`
            : 'Amount';
    }
    if (countLabel) {
        countLabel.textContent = countFieldLabel
            ? `${countFieldLabel.charAt(0).toUpperCase()}${countFieldLabel.slice(1)} (optional)`
            : 'Count (optional)';
    }
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
    updateBuyVapeFieldsVisibility();
}

function updateQuickActions() {
    const logBtn = document.getElementById('quick-log-btn');
    if (isAllSubstancesView()) {
        if (logBtn) {
            logBtn.querySelector('.quick-icon').textContent = '📊';
            logBtn.querySelector('.quick-label').textContent = 'Quick Use (pick substance)';
        }
        return;
    }
    const sub = getSubstance(currentSubstanceId);
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

function renderStoresList() {
    const container = document.getElementById('settings-stores-list');
    if (!container) return;
    const stores = getSavedStoreNames();
    if (!stores.length) {
        container.innerHTML = '<p class="settings-hint">Stores and locations appear here when you add them on Buy Tracker purchases.</p>';
        return;
    }
    container.innerHTML = `<ul class="settings-stores-list">${stores.map(store => {
        const safe = String(store).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
        return `<li>${safe}</li>`;
    }).join('')}</ul>`;
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
const REMOVED_TAB_ALIASES = {
    'calendar-tab': 'use-log-tab',
    'history-tab': 'use-log-tab',
    history: 'use-log-tab'
};

function normalizeTabId(tabId) {
    if (!tabId) return 'dashboard-tab';
    const alias = REMOVED_TAB_ALIASES[tabId] || REMOVED_TAB_ALIASES[String(tabId).replace(/-tab$/, '')];
    if (alias) return alias;
    return document.getElementById(tabId) ? tabId : 'dashboard-tab';
}

let cachedNavButtons = null;

function getNavButtons() {
    if (!cachedNavButtons?.length) {
        cachedNavButtons = [...document.querySelectorAll('.bottom-nav .nav-btn')];
    }
    return cachedNavButtons;
}

function setActiveNavTab(tabId) {
    getNavButtons().forEach(btn => {
        btn.classList.toggle('active', btn.dataset.tab === tabId);
    });
}

function switchTab(tabId) {
    tabId = normalizeTabId(tabId);
    document.querySelectorAll('.tab').forEach(tab => tab.classList.remove('active'));
    setActiveNavTab(tabId);
    document.getElementById(tabId)?.classList.add('active');

    if (tabId === 'dashboard-tab') {
        applyMainSubstanceToViewSelectors();
        updateDashboard();
    } else if (tabId === 'stats-tab') {
        applyMainSubstanceToViewSelectors();
        updateStats();
    } else if (tabId === 'buy-tracker-tab') {
        syncBuyFormFromSelectedSubstance();
        renderBuyTrackerTab();
    } else if (tabId === 'use-log-tab') {
        syncUseLogFormFromSelectedSubstance();
        renderUseLogTab();
    } else if (tabId === 'taper-tab') {
        applyMainSubstanceToViewSelectors();
        populatePageSubstanceDropdowns();
        syncTaperSubstanceToSelected();
        refreshTaperDashboard();
    } else if (tabId === 'settings-tab') {
        applyMainSubstanceToViewSelectors();
        renderSubstancesList();
    }
    applyCollapsedSections();
}

// ——— Local date/time (app dates are YYYY-MM-DD in local timezone) ———
function getLocalDateString(date = new Date()) {
    const d = date instanceof Date ? date : new Date(date);
    if (Number.isNaN(d.getTime())) return '';
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
}

function getLocalTimeString(date = new Date()) {
    const d = date instanceof Date ? date : new Date(date);
    if (Number.isNaN(d.getTime())) return '00:00';
    return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

function parseLocalDate(dateString) {
    if (!dateString || typeof dateString !== 'string') return null;
    const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(dateString.trim());
    if (!match) return null;
    const y = Number(match[1]);
    const m = Number(match[2]);
    const day = Number(match[3]);
    if (!y || m < 1 || m > 12 || day < 1 || day > 31) return null;
    return new Date(y, m - 1, day, 12, 0, 0, 0);
}

function parseLocalDateTime(dateStr, timeStr = '12:00') {
    const base = parseLocalDate(dateStr);
    if (!base) return null;
    const parts = String(timeStr || '12:00').split(':').map(Number);
    const d = new Date(base);
    d.setHours(parts[0] || 0, parts[1] || 0, parts[2] || 0, 0);
    return d;
}

function getLocalDayBoundaryMs(dateStr) {
    const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(dateStr || '').trim());
    if (!match) return null;
    const y = Number(match[1]);
    const m = Number(match[2]) - 1;
    const day = Number(match[3]);
    return {
        startMs: new Date(y, m, day, 0, 0, 0, 0).getTime(),
        endMs: new Date(y, m, day, 23, 59, 59, 999).getTime()
    };
}

function formatStatsPuffs(value, maxDecimals = 1) {
    if (value == null || Number.isNaN(value)) return '0';
    const factor = Math.pow(10, maxDecimals);
    const rounded = Math.round(value * factor) / factor;
    if (Number.isInteger(rounded)) return String(rounded);
    const fixed = rounded.toFixed(maxDecimals);
    return fixed.replace(/(\.\d*?)0+$/, '$1').replace(/\.$/, '');
}

function formatStatsPuffsPerDay(value) {
    if (value == null || Number.isNaN(value)) return '—';
    const rounded = Math.round(value * 10) / 10;
    const formatted = Number.isInteger(rounded)
        ? rounded.toLocaleString('en-US')
        : rounded.toLocaleString('en-US', { minimumFractionDigits: 1, maximumFractionDigits: 1 });
    return `${formatted} puffs/day`;
}

function formatCostPerVape(value, cur = getCurrencySymbol()) {
    if (value == null || Number.isNaN(value)) return '—';
    return `${cur}${value.toFixed(2)}/vape`;
}

function getStatsDisplayUnit(substanceId, fallbackUnit = 'units') {
    return isVapeNicotineSubstanceId(substanceId) ? 'puffs' : fallbackUnit;
}

function getTableColumnLabelForSubstance(tableKey, colId, substanceId = currentSubstanceId) {
    const labels = TABLE_COLUMN_LABELS[tableKey] || {};
    if (!isVapeNicotineSubstanceId(substanceId)) return labels[colId] || colId;
    const vapeBuyLabels = {
        purchased: 'Puffs purchased',
        costPerUnit: 'Cost/vape',
        gPerDay: 'Puffs/day',
        supplyDuration: 'Days per vape'
    };
    const vapeStatsLabels = {
        gPerSession: 'Puffs/sess',
        gPerHour: 'Puffs/hr',
        gPerUseDay: 'Puffs/use day',
        gPerCalDay: 'Puffs/cal day'
    };
    if (tableKey === 'buyWeekly' || tableKey === 'buyMonthly') {
        return vapeBuyLabels[colId] || labels[colId] || colId;
    }
    if (tableKey === 'statsWeekly' || tableKey === 'statsMonthly') {
        return vapeStatsLabels[colId] || labels[colId] || colId;
    }
    return labels[colId] || colId;
}

function getLocalDateFromIso(isoString) {
    if (!isoString) return '';
    const d = new Date(isoString);
    if (Number.isNaN(d.getTime())) {
        const match = /^(\d{4}-\d{2}-\d{2})/.exec(String(isoString).trim());
        return match ? match[1] : '';
    }
    return getLocalDateString(d);
}

function formatLocalDate(dateString) {
    const d = parseLocalDate(dateString);
    if (!d) return dateString || '—';
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

// ——— Use Log ———
function parseUseDateTime(dateStr, timeStr) {
    return parseLocalDateTime(dateStr, timeStr);
}

function formatDurationHours(hours) {
    if (hours == null || isNaN(hours)) return '—';
    if (hours < 1 / 60) return '<1m';
    const h = Math.floor(hours);
    const m = Math.round((hours - h) * 60);
    if (h > 0) return m > 0 ? `${h}h ${m}m` : `${h}h`;
    return `${m}m`;
}

function formatDurationHMS(hours) {
    if (hours == null || isNaN(hours) || hours < 0) return '—';
    const totalSeconds = Math.round(hours * 3600);
    const h = Math.floor(totalSeconds / 3600);
    const m = Math.floor((totalSeconds % 3600) / 60);
    const s = totalSeconds % 60;
    return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

function formatTaperMonthlyAmount(value, unit) {
    if (value == null || Number.isNaN(value)) return '—';
    return formatTaperAmount(value, unit);
}

function formatTaperAmount(value, unit) {
    if (value == null || Number.isNaN(value)) return '—';
    return `${formatAmount(value)} ${unit || ''}`.trim();
}

function formatTaperActualAmount(value, unit) {
    if (value == null || Number.isNaN(value)) return '—';
    return `${formatAmount(value, 1)} ${unit || ''}`.trim();
}

function formatTaperPercent(actual, goal) {
    if (goal == null || goal <= 0 || actual == null || Number.isNaN(actual)) return '—';
    return `${Math.round((actual / goal) * 100)}%`;
}

function formatTaperMonthlyRate(value, unit, suffix) {
    if (value == null || Number.isNaN(value)) return '—';
    return `${Number(value.toFixed(2))} ${unit}${suffix}`;
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

        if (isWeedTrackingMode(substanceId, data)) {
            const prevDate = previous.date;
            const curDate = log.date;
            if (!prevDate || !curDate) {
                delete log.breakMinutes;
                delete log.breakHours;
                delete log.breakText;
                return;
            }
            const prevDay = parseLocalDate(prevDate);
            const curDay = parseLocalDate(curDate);
            if (!prevDay || !curDay) {
                delete log.breakMinutes;
                delete log.breakHours;
                delete log.breakText;
                return;
            }
            const dayGap = Math.round((curDay.getTime() - prevDay.getTime()) / 86400000);
            if (dayGap <= 0) {
                delete log.breakMinutes;
                delete log.breakHours;
                delete log.breakText;
                return;
            }
            const breakMinutes = dayGap * 24 * 60;
            log.breakMinutes = breakMinutes;
            log.breakHours = breakMinutes / 60;
            log.breakText = formatBreakFromHours(log.breakHours);
            return;
        }

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
                label: formatDate(getLocalDateString(nextDate))
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

function purchaseIdEquals(a, b) {
    if (a == null || b == null) return false;
    return a === b || String(a) === String(b);
}

function normalizePurchaseId(id) {
    return id == null ? '' : String(id);
}

function purchaseIdLiteral(id) {
    return JSON.stringify(normalizePurchaseId(id));
}

function ensureSubstanceInBuyDropdown(substanceId, purchase) {
    const select = document.getElementById('buy-substance');
    if (!select || !substanceId) return;
    if ([...select.options].some(o => o.value === substanceId)) {
        select.value = substanceId;
        return;
    }
    const sub = getSubstance(substanceId);
    if (sub) {
        select.appendChild(buildSubstanceOption(sub));
    } else {
        const opt = document.createElement('option');
        opt.value = substanceId;
        opt.textContent = purchase?.substanceName || substanceId;
        select.appendChild(opt);
    }
    select.value = substanceId;
}

function setupPurchaseHistoryActions() {
    if (document.documentElement.dataset.purchaseHistoryActionsBound === '1') return;
    document.documentElement.dataset.purchaseHistoryActionsBound = '1';
    document.addEventListener('click', (e) => {
        const editBtn = e.target.closest('[data-edit-purchase]');
        if (editBtn) {
            e.preventDefault();
            editPurchase(editBtn.getAttribute('data-edit-purchase'));
            return;
        }
        const duplicateBtn = e.target.closest('[data-duplicate-purchase]');
        if (duplicateBtn) {
            e.preventDefault();
            duplicatePurchase(duplicateBtn.getAttribute('data-duplicate-purchase'));
            return;
        }
        const duplicateNowBtn = e.target.closest('[data-duplicate-purchase-now]');
        if (duplicateNowBtn) {
            e.preventDefault();
            createAutoBackup('before-duplicate-purchase');
            duplicatePurchaseNow(duplicateNowBtn.getAttribute('data-duplicate-purchase-now'));
            return;
        }
        const deleteBtn = e.target.closest('[data-delete-purchase]');
        if (deleteBtn) {
            e.preventDefault();
            deletePurchase(deleteBtn.getAttribute('data-delete-purchase'));
            return;
        }
        const toggleBtn = e.target.closest('[data-toggle-purchase-logs]');
        if (toggleBtn) {
            e.preventDefault();
            togglePurchaseLinkedLogs(toggleBtn.getAttribute('data-toggle-purchase-logs'));
            return;
        }
        const markEmptyBtn = e.target.closest('[data-mark-vape-empty]');
        if (markEmptyBtn) {
            e.preventDefault();
            markVapePurchaseEmpty(markEmptyBtn.getAttribute('data-mark-vape-empty'));
            return;
        }
        const markFinishedBtn = e.target.closest('[data-mark-vape-finished]');
        if (markFinishedBtn) {
            e.preventDefault();
            markVapePurchaseFinishedNow(markFinishedBtn.getAttribute('data-mark-vape-finished'));
            return;
        }
        const activeBtn = e.target.closest('[data-mark-purchase-active]');
        if (activeBtn) {
            e.preventDefault();
            markPurchaseInventoryStatus(activeBtn.getAttribute('data-mark-purchase-active'), 'active');
            return;
        }
        const storedBtn = e.target.closest('[data-mark-purchase-stored]');
        if (storedBtn) {
            e.preventDefault();
            markPurchaseInventoryStatus(storedBtn.getAttribute('data-mark-purchase-stored'), 'stored');
            return;
        }
        const depletedBtn = e.target.closest('[data-mark-purchase-depleted]');
        if (depletedBtn) {
            e.preventDefault();
            markPurchaseInventoryStatus(depletedBtn.getAttribute('data-mark-purchase-depleted'), 'depleted');
            return;
        }
        const hideBtn = e.target.closest('[data-hide-purchase]');
        if (hideBtn) {
            e.preventDefault();
            setPurchaseHidden(hideBtn.getAttribute('data-hide-purchase'), true);
            return;
        }
        const unhideBtn = e.target.closest('[data-unhide-purchase]');
        if (unhideBtn) {
            e.preventDefault();
            setPurchaseHidden(unhideBtn.getAttribute('data-unhide-purchase'), false);
            return;
        }
        const recalcBtn = e.target.closest('[data-recalculate-purchase]');
        if (recalcBtn) {
            e.preventDefault();
            const result = recalculatePurchaseRemaining(recalcBtn.getAttribute('data-recalculate-purchase'));
            if (result) {
                saveData(appData);
                refreshBuyTrackerRelatedViews();
                alert(`Remaining updated: ${formatAmount(result.oldRemaining)} → ${formatAmount(result.newRemaining)}`);
            }
        }
    });
    document.addEventListener('change', (e) => {
        const cb = e.target.closest('[data-inventory-select]');
        if (!cb) return;
        const id = cb.getAttribute('data-inventory-select');
        if (cb.checked) inventorySelectedIds.add(id);
        else inventorySelectedIds.delete(id);
    });
}

function isSameTaperWeek(logDate, dateStr) {
    if (!logDate || !dateStr) return false;
    return getWeekStartDateStr(logDate) === getWeekStartDateStr(dateStr);
}

function getTaperWeekBounds(plan, dateStr) {
    if (!plan || !dateStr) return null;
    const week = getWeekRowForDate(plan, dateStr);
    if (week) return { weekStart: week.weekStart, weekEnd: week.weekEnd };
    if (isManualWeeklyPlan(plan) && plan.startDate) {
        const manualWeek = getCurrentManualWeekRow(plan, dateStr);
        if (manualWeek) return { weekStart: manualWeek.weekStart, weekEnd: manualWeek.weekEnd };
    }
    return null;
}

function getTaperPlanWeekNumber(plan, dateStr) {
    if (!plan || !dateStr) return 1;
    if (isManualWeeklyPlan(plan)) return getManualWeeklyWeekNumber(plan, dateStr);
    const idx = (plan.weeklyTargets || []).findIndex(w => dateStr >= w.weekStart && dateStr <= w.weekEnd);
    if (idx >= 0) return idx + 1;
    if (plan.weeklyTargets?.length && dateStr < plan.weeklyTargets[0].weekStart) return 1;
    return plan.weeklyTargets?.length || 1;
}

function getUsedAmountForTaperWeek(substanceId, dateStr, excludeLogId = null, data = appData) {
    return getTaperWeekUsage(substanceId, dateStr, excludeLogId, data);
}

function shortWeeklyTaperStatus(status) {
    return getRecoveryTaperStatusLabel(status);
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
    if (t === 'session') return 'use';
    return 'use';
}

function isPersonalUseLog(log) {
    return getLogTransactionType(log) === 'use';
}

function isVapeDateOnlyUseForm() {
    return isVapeTrackingMode(document.getElementById('use-substance')?.value);
}

function isVapeDateOnlyUseLog(log, data = appData) {
    if (!isVapeUseLog(log, data)) return false;
    return getUseLogType(log) === 'quick' || log.logMode === 'vape_puffs' || !log.endTime;
}

function isVapeSessionFormActive() {
    return isVapeDateOnlyUseForm();
}

function positionUseInventoryFields(inWeedMode) {
    const group = document.getElementById('use-inventory-fields-group');
    const coreAnchor = document.getElementById('use-inventory-core-anchor');
    const advancedBody = document.querySelector('#use-advanced-section .use-log-advanced-body');
    const countGroup = document.getElementById('use-count-group');
    if (!group || !coreAnchor || !advancedBody) return;
    if (inWeedMode) {
        coreAnchor.appendChild(group);
    } else if (countGroup) {
        advancedBody.insertBefore(group, countGroup);
    } else {
        advancedBody.appendChild(group);
    }
}

function getWeedUseProductType() {
    return document.getElementById('use-weed-product-type')?.value || 'bud';
}

function updateWeedUseUnitOptions(productType) {
    const unitSelect = document.getElementById('use-unit');
    if (!unitSelect) return;
    const current = unitSelect.value;
    unitSelect.innerHTML = '';
    if (productType === 'bud') {
        ['grams', 'bowls', 'joints'].forEach(unit => {
            const option = document.createElement('option');
            option.value = unit;
            option.textContent = unit;
            unitSelect.appendChild(option);
        });
        unitSelect.value = 'grams';
    } else {
        const option = document.createElement('option');
        option.value = 'units';
        option.textContent = 'count';
        unitSelect.appendChild(option);
        unitSelect.value = 'units';
    }
    if ([...unitSelect.options].some(o => o.value === current)) {
        unitSelect.value = current;
    }
}

function updateWeedUseAmountLabel(productType) {
    const amountLabel = document.getElementById('use-amount-label');
    if (!amountLabel) return;
    if (productType === 'bud') {
        amountLabel.textContent = 'Amount';
    } else if (productType === 'cart') {
        amountLabel.textContent = 'Amount';
    } else {
        amountLabel.textContent = 'Quantity (count)';
    }
}

function syncWeedProductTypeFromPurchase() {
    if (!isWeedDateOnlyUseForm()) return;
    const substanceId = document.getElementById('use-substance')?.value;
    const purchaseId = resolveLinkedPurchaseId(substanceId, document.getElementById('use-transaction-type')?.value || 'use');
    if (!purchaseId) return;
    const purchase = findPurchase(purchaseId);
    if (purchase?.weedProductType) {
        setInputValue('use-weed-product-type', purchase.weedProductType);
        updateWeedUseFormUI();
    }
}

function updateWeedUseFormUI() {
    if (!isWeedDateOnlyUseForm()) return;
    const productType = getWeedUseProductType();
    document.getElementById('use-weed-product-type-group')?.classList.remove('hidden');
    updateWeedUseAmountLabel(productType);
    updateWeedUseUnitOptions(productType);
}

function ensureWeedUseFormDefaults() {
    if (!isWeedDateOnlyUseForm()) return;
    setUseLogType('quick');
    const startEl = document.getElementById('use-start-time');
    if (startEl) {
        startEl.value = '';
        startEl.required = false;
    }
    const endTimeEl = document.getElementById('use-end-time');
    if (endTimeEl) endTimeEl.value = '';
    const endDateEl = document.getElementById('use-end-date');
    if (endDateEl) endDateEl.value = '';
    document.getElementById('use-duration-preview')?.classList.add('hidden');
}

function setDefaultWeedUseLogDate() {
    const dateStr = getLocalDateString(new Date());
    const dateEl = document.getElementById('use-date');
    if (dateEl) dateEl.value = dateStr;
    const startEl = document.getElementById('use-start-time');
    if (startEl) {
        startEl.value = '';
        startEl.required = false;
    }
    const endTimeEl = document.getElementById('use-end-time');
    if (endTimeEl) endTimeEl.value = '';
    const endDateEl = document.getElementById('use-end-date');
    if (endDateEl) endDateEl.value = '';
}

function setDefaultVapeUseLogDate() {
    setDefaultWeedUseLogDate();
}

function parseUseSessionEndDateTime(startDate, startTime, endDate, endTime) {
    const start = parseUseDateTime(startDate, startTime);
    if (!start) return { start: null, end: null };
    const resolvedEndDate = endDate || startDate;
    let end = endTime ? parseUseDateTime(resolvedEndDate, endTime) : null;
    if (end && end <= start && resolvedEndDate === startDate) {
        end = new Date(end);
        end.setDate(end.getDate() + 1);
    }
    return { start, end };
}

function getUseLogStartedAt(log) {
    if (log?.startedAt) {
        const d = new Date(log.startedAt);
        if (!Number.isNaN(d.getTime())) return d;
    }
    return parseUseDateTime(log?.date, log?.startTime || log?.time);
}

function getUseLogEndedAt(log) {
    if (log?.endedAt) {
        const d = new Date(log.endedAt);
        if (!Number.isNaN(d.getTime())) return d;
    }
    if (log?.endDatetime) {
        const d = new Date(log.endDatetime);
        if (!Number.isNaN(d.getTime())) return d;
    }
    const endDate = log?.endDate || log?.date;
    if (log?.endTime) {
        const end = parseUseDateTime(endDate, log.endTime);
        const start = getUseLogStartedAt(log);
        if (end && start && end <= start) {
            end.setDate(end.getDate() + 1);
        }
        return end;
    }
    return null;
}

function syncVapeEndDateDefault() {
    if (!isVapeSessionFormActive() || isVapeDateOnlyUseForm()) return;
    const startDate = document.getElementById('use-date')?.value;
    const endDateEl = document.getElementById('use-end-date');
    if (!startDate || !endDateEl) return;
    const prevSynced = endDateEl.dataset.syncedStart;
    if (!endDateEl.value || endDateEl.value === prevSynced) {
        endDateEl.value = startDate;
    }
    endDateEl.dataset.syncedStart = startDate;
}

function ensureVapeUseFormDefaults() {
    if (!isVapeDateOnlyUseForm()) return;
    setInputValue('use-transaction-type', 'use');
    setUseLogType('quick');
    const startEl = document.getElementById('use-start-time');
    if (startEl) {
        startEl.value = '';
        startEl.required = false;
    }
    const endTimeEl = document.getElementById('use-end-time');
    if (endTimeEl) endTimeEl.value = '';
    const endDateEl = document.getElementById('use-end-date');
    if (endDateEl) endDateEl.value = '';
    document.getElementById('use-duration-preview')?.classList.add('hidden');
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
    if (log?.linkedPurchases?.length) return true;
    if (getLogPurchaseId(log)) return true;
    return log?.inventoryAffects === true;
}

function hasLinkedSupply(log) {
    if (getLogPurchaseId(log)) return true;
    return Array.isArray(log?.linkedPurchases) && log.linkedPurchases.length > 0;
}

function getLinkedSupplyLabel(log) {
    const purchases = appData.purchases || [];
    const purchaseId = getLogPurchaseId(log);

    if (purchaseId) {
        const purchase = purchases.find(p => String(p.id) === String(purchaseId));
        if (purchase) {
            const store = purchase.store || purchase.location || purchase.substanceName || '';
            return `Linked: ${formatDate(purchase.date)} purchase${store ? ` · ${store}` : ''}`;
        }
        return 'Linked: unknown purchase';
    }

    if (Array.isArray(log.linkedPurchases) && log.linkedPurchases.length) {
        return log.linkedPurchases.map(lp => {
            const purchase = purchases.find(p => String(p.id) === String(lp.purchaseId));
            const amt = formatAmount(lp.amountUsed ?? lp.amount ?? 0);
            const unit = log.unit || purchase?.unit || '';
            if (!purchase) return `${amt}${unit} from unknown supply`;
            const store = purchase.store || purchase.location || '';
            return `${amt}${unit} from ${formatDate(purchase.date)}${store ? ` · ${store}` : ''}`;
        }).join(', ');
    }

    if (log.legacySupplyText) {
        return `Legacy: ${log.legacySupplyText}`;
    }

    const tx = getLogTransactionType(log);
    if (tx === 'gift_received') return 'Gift received · no purchase';
    if (log.inventoryAffects === false) return 'No linked purchase';

    return 'No linked purchase';
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
    if (isVapeUseLog(entry)) {
        return formatVapeUseSummary(entry, sub);
    }
    if (isWeedDateOnlyUseLog(entry)) {
        return `${sub?.icon || ''} ${amount} ${unit}`;
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

    document.getElementById('use-entry-type-group')?.classList.toggle('hidden', isNonUse || isWeedDateOnlyUseForm() || isVapeDateOnlyUseForm());
    document.getElementById('use-adjustment-direction-group')?.classList.toggle('hidden', !isAdjustment);
    document.getElementById('use-gift-party-group')?.classList.toggle('hidden', !isGift);

    const partyLabel = document.getElementById('use-gift-party-label');
    if (partyLabel) partyLabel.textContent = isGiftReceived ? 'From' : 'Recipient Name';

    const amountLabel = document.getElementById('use-amount-label');
    if (amountLabel) {
        if (isAdjustment) amountLabel.textContent = 'Amount';
        else if (isGiftReceived) amountLabel.textContent = 'Amount Received';
        else if (isGiftGiven) amountLabel.textContent = 'Amount Given';
        else if (isWeedDateOnlyUseForm()) updateWeedUseAmountLabel(getWeedUseProductType());
        else amountLabel.textContent = 'Amount';
    }

    const linkLabel = document.getElementById('use-purchase-link-label');
    if (linkLabel) {
        if (isGiftReceived || (isAdjustment && getUseAdjustmentDirection() === 'add')) {
            linkLabel.textContent = 'Add to Inventory';
        } else if (isAdjustment) {
            linkLabel.textContent = 'Remove from Inventory';
        } else {
            linkLabel.textContent = 'Use From Inventory';
        }
    }

    document.querySelector('.use-log-core-card')?.classList.toggle('gift-adjustment-mode', isNonUse);

    if (isNonUse) {
        setUseLogType('quick');
    } else {
        updateUseEndTimeVisibility();
    }
    updateVapeUseFormUI();
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
    if (!startTime) {
        const day = parseLocalDate(date);
        if (day && !Number.isNaN(day.getTime())) {
            return new Date(day.getTime() + 12 * 3600000).toISOString();
        }
    }
    const startDt = parseUseDateTime(date, startTime);
    return startDt && !Number.isNaN(startDt.getTime())
        ? startDt.toISOString()
        : new Date().toISOString();
}

function getUseCreatedAt(entry) {
    return entry.createdAt || entry.timestamp || new Date().toISOString();
}

function buildUseEntryFromForm(vapeCalc = null) {
    const substanceId = document.getElementById('use-substance')?.value;
    const isVapeDateOnly = isVapeTrackingMode(substanceId);
    const isWeedSimple = isWeedTrackingMode(substanceId);
    const transactionType = document.getElementById('use-transaction-type')?.value || 'use';
    const isGift = transactionType === 'gift_given' || transactionType === 'gift_received';
    const isAdjustment = transactionType === 'inventory_adjustment';
    let type = (isGift || isAdjustment || isWeedSimple || isVapeDateOnly) ? 'quick' : (document.getElementById('use-type')?.value || 'quick');
    const date = document.getElementById('use-date')?.value;
    const startTime = (isWeedSimple || isVapeDateOnly) ? '' : (document.getElementById('use-start-time')?.value || '12:00');
    const endDate = (isWeedSimple || isVapeDateOnly) ? null : (document.getElementById('use-end-date')?.value || date);
    const endTime = (isWeedSimple || isVapeDateOnly) ? '' : (document.getElementById('use-end-time')?.value || '');
    const isVapeUse = isVapeDateOnly;

    let amount;
    let unit;
    let linkedPurchaseId;
    let inventoryAffects;
    let logMode = isWeedSimple ? 'amount' : 'amount';
    let percentRemaining;
    let previousRemainingBeforeLog;

    if (isVapeUse && vapeCalc && !vapeCalc.error) {
        amount = vapeCalc.estimatedPuffsUsed ?? vapeCalc.puffsUsed;
        unit = 'puffs';
        linkedPurchaseId = vapeCalc.purchaseId;
        inventoryAffects = getUsePurchaseLinkMode() !== 'none' && !!linkedPurchaseId;
        logMode = 'vape_puffs';
        percentRemaining = vapeCalc.percentAfter;
        previousRemainingBeforeLog = vapeCalc.previousRemaining;
    } else {
        amount = parseFloat(document.getElementById('use-amount')?.value);
        unit = document.getElementById('use-unit')?.value;
        const linkMode = getUsePurchaseLinkMode();
        linkedPurchaseId = resolveLinkedPurchaseId(substanceId, transactionType);
        inventoryAffects = linkMode !== 'none' && linkedPurchaseId != null;
    }

    const base = {
        type,
        transactionType,
        substanceId,
        amount: Number.isFinite(amount) ? amount : 0,
        unit: unit || 'units',
        logMode,
        percentRemaining: percentRemaining != null ? percentRemaining : undefined,
        previousRemainingBeforeLog: previousRemainingBeforeLog != null ? previousRemainingBeforeLog : undefined,
        date,
        endDate: (isWeedSimple || isVapeDateOnly) ? undefined : ((isGift || isAdjustment || type === 'session') ? (endDate || date) : undefined),
        startTime,
        time: startTime,
        endTime: (isWeedSimple || isVapeDateOnly) ? '' : ((isGift || isAdjustment || type === 'session') ? (endTime || '') : ''),
        count: (isGift || isAdjustment || isWeedSimple) ? 0 : (parseFloat(document.getElementById('use-count')?.value) || 0),
        giftPartyName: isGift ? (document.getElementById('use-gift-party')?.value?.trim() || '') : '',
        adjustmentDirection: isAdjustment ? getUseAdjustmentDirection() : undefined,
        notes: document.getElementById('use-notes')?.value || '',
        purchaseId: inventoryAffects ? linkedPurchaseId : null,
        linkedPurchaseId: inventoryAffects ? linkedPurchaseId : null,
        inventoryId: inventoryAffects ? linkedPurchaseId : null,
        linkedPurchases: [],
        supplyUnlinked: !inventoryAffects,
        inventoryAffects
    };

    base.trackingMode = getSubstanceTrackingMode(substanceId);

    if (isWeedSimple) {
        base.weedProductType = getWeedUseProductType();
    }

    if (isVapeUse && vapeCalc && !vapeCalc.error) {
        base.isEstimated = !!vapeCalc.isEstimated;
        base.estimatedFromPercent = !!vapeCalc.estimatedFromPercent;
        base.percentLeftAfter = vapeCalc.percentAfter;
        base.remainingPuffsAfter = vapeCalc.currentRemaining;
        base.estimatedPuffsUsed = vapeCalc.estimatedPuffsUsed ?? vapeCalc.puffsUsed;
    }

    return base;
}

function normalizeUseLogWellness(log) {
    if (!log) return;
    const parseLevel = val => {
        if (val == null || val === '') return null;
        const n = parseInt(val, 10);
        return Number.isFinite(n) ? Math.min(10, Math.max(1, n)) : null;
    };
    log.cravingLevel = parseLevel(log.cravingLevel ?? log.craving);
    log.stressLevel = parseLevel(log.stressLevel);
    if (log.mood != null && typeof log.mood !== 'string') log.mood = String(log.mood);
    if (log.trigger != null && typeof log.trigger !== 'string') log.trigger = String(log.trigger);
    if (log.mood == null) log.mood = '';
    if (log.trigger == null) log.trigger = '';
    delete log.craving;
}

function stripLegacyUseLogFields(entry) {
    if (!entry) return;
    delete entry.cost;
    delete entry.location;
    normalizeUseLogWellness(entry);
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
    setUsePurchaseLinkMode('auto');
    setUseTransactionType('use');
    setUseAdjustmentDirection('add');
    updateVapeUseFormUI();
}

function refreshUseLogRelatedViews() {
    recalculateAllBreaks();
    recalculateAllBuyBreaks();
    renderUseLogTab();
    updateDashboard();
    updateStats();
    refreshTaperDashboard();
    refreshBuyTrackerRelatedViews();
}

function getLogDatetimeMs(log) {
    if (isWeedDateOnlyUseLog(log) || isVapeDateOnlyUseLog(log)) {
        const day = parseLocalDate(log.date);
        if (day && !Number.isNaN(day.getTime())) {
            return day.getTime() + 12 * 3600000;
        }
    }
    if (log.startedAt) {
        const ms = new Date(log.startedAt).getTime();
        if (!Number.isNaN(ms)) return ms;
    }
    if (log.startDatetime) {
        const ms = new Date(log.startDatetime).getTime();
        if (!Number.isNaN(ms)) return ms;
    }
    if (log.timestamp) {
        const ms = new Date(log.timestamp).getTime();
        if (!Number.isNaN(ms)) return ms;
    }
    const time = log.startTime || log.time || '00:00';
    const dt = parseLocalDateTime(log.date, time);
    const ms = dt ? dt.getTime() : 0;
    return Number.isNaN(ms) ? 0 : ms;
}

function getPurchaseDatetimeMs(purchase) {
    const dt = parseLocalDateTime(purchase.date, purchase.time || '12:00');
    const ms = dt ? dt.getTime() : 0;
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
        const pid = getLogPurchaseId(log);
        return pid ? addPurchaseAmount(pid, amount) : { ok: true };
    }

    if (log.linkedPurchases?.length) {
        for (const alloc of log.linkedPurchases) {
            const result = deductPurchaseAmount(alloc.purchaseId, alloc.amountUsed ?? alloc.amount);
            if (!result.ok) return result;
        }
        return { ok: true };
    }

    const deductId = getLogPurchaseId(log);
    if (inventoryAdjustmentRemoves(log) || deductId) {
        return deductPurchaseAmount(deductId, amount);
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
    return !getLogPurchaseId(log);
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
    const pid = getLogPurchaseId(log);
    if (pid) {
        const purchase = findPurchaseInData(pid, { purchases });
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
        setLogPurchaseId(log, allocations[0].purchaseId);
    } else if (allocations.length > 1) {
        log.linkedPurchases = allocations;
        log.purchaseId = null;
        log.linkedPurchaseId = null;
        log.inventoryAffects = true;
        log.supplyUnlinked = false;
    } else {
        setLogPurchaseId(log, null);
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

    });

    purchases.forEach(finalizePurchaseRemainingState);
    data.migrations.inventoryLinkedV1 = true;
}

function migratePurchaseIdLinkV2(data) {
    ensureAppDataMigrations(data);
    if (data.migrations.purchaseIdLinkV2) return;

    ensurePurchaseIds(data);
    (data.logs || []).forEach(log => {
        syncLogPurchaseFields(log);
        if (hasLinkedSupply(log)) {
            log.inventoryAffects = true;
            log.supplyUnlinked = false;
            return;
        }
        captureLegacySupplyText(log);
        log.purchaseId = null;
        log.linkedPurchaseId = null;
        log.linkedPurchases = [];
        log.inventoryAffects = false;
        log.supplyUnlinked = true;
    });

    data.migrations.purchaseIdLinkV2 = true;
}

function recalculateAllInventory(data = appData) {
    const purchases = data.purchases || [];
    const logs = data.logs || [];
    const nonVapePurchases = purchases.filter(p => !isVapePuffPurchase(p));
    resetAllPurchaseInventory(nonVapePurchases);

    const sortedLogs = [...logs].sort((a, b) => getLogDatetimeMs(a) - getLogDatetimeMs(b));

    sortedLogs.forEach(log => {
        if (isVapeUseLog(log, data)) return;
        const amount = parseFloat(log.amount) || 0;
        if (amount <= INVENTORY_EPS) return;

        if (log.linkedPurchases?.length) {
            applyExistingLogLinks(log, nonVapePurchases);
            return;
        }

        if (getLogPurchaseId(log)) {
            applyExistingLogLinks(log, nonVapePurchases);
        }
    });

    nonVapePurchases.forEach(finalizePurchaseRemainingState);
    purchases.filter(isVapePuffPurchase).forEach(p => recalculateVapePurchaseInventory(p.id, data));
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
    if (isVapePuffPurchase(purchase)) {
        return getVapeStartingPuffsLeft(purchase);
    }
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
        const pid = getLogPurchaseId(log);
        if (pid === purchaseId || String(pid) === String(purchaseId)) {
            total += parseFloat(log.amount) || 0;
        }
    });
    return total;
}

function migratePurchaseInventory(purchase, logs, data) {
    if (isVapePuffPurchase(purchase)) {
        normalizeVapePurchaseFields(purchase);
        if (purchase.remainingAmount == null || purchase.remainingAmount === '') {
            purchase.remainingAmount = getVapeStartingPuffsLeft(purchase);
        }
        finalizePurchaseRemainingState(purchase);
    } else {
        const qty = getPurchaseQuantityBought(purchase);
        if (!purchase.quantityBought && qty) purchase.quantityBought = qty;
        if (!purchase.quantity && qty) purchase.quantity = qty;
        if (purchase.remainingAmount == null || purchase.remainingAmount === '') {
            const used = getLinkedUseAmountForPurchase(purchase.id, logs);
            purchase.remainingAmount = Math.max(0, qty - used);
        }
        finalizePurchaseRemainingState(purchase);
    }
    if (!purchase.substanceName) {
        const substanceRef = getPurchaseSubstanceId(purchase);
        const sub = getSubstance(substanceRef, data);
        purchase.substanceName = sub?.name || '';
    }
    if (!purchase.createdAt) purchase.createdAt = new Date().toISOString();
    if (!purchase.updatedAt) purchase.updatedAt = purchase.createdAt;
}

function findPurchase(id, data = appData) {
    return findPurchaseInData(id, data);
}

function getActivePurchasesForSubstance(substanceId) {
    return (appData.purchases || [])
        .filter(p => getPurchaseSubstanceId(p) === substanceId && !p.isDepleted && getPurchaseRemainingAmount(p) > 0)
        .sort((a, b) => getPurchaseDatetimeMs(b) - getPurchaseDatetimeMs(a));
}

function getOldestActivePurchase(substanceId) {
    const active = getActivePurchasesForSubstance(substanceId);
    return active[0] || null;
}

function getPurchasePercentUsed(purchase) {
    if (isVapePuffPurchase(purchase)) {
        const starting = getVapeStartingPuffsLeft(purchase);
        if (starting <= 0) return 0;
        const remaining = getPurchaseRemainingAmount(purchase);
        return Math.round(((starting - remaining) / starting) * 100);
    }
    const bought = getPurchaseQuantityBought(purchase);
    if (bought <= 0) return 0;
    const remaining = getPurchaseRemainingAmount(purchase);
    return Math.round(((bought - remaining) / bought) * 100);
}

function getPurchaseSupplyStatus(purchase) {
    if (isVapePuffPurchase(purchase)) {
        const starting = getVapeStartingPuffsLeft(purchase);
        const remaining = getPurchaseRemainingAmount(purchase);
        if (purchase.isDepleted || remaining <= 0) {
            return { key: 'depleted', label: '❌ Depleted', className: 'supply-depleted' };
        }
        if (starting > 0 && remaining / starting <= SUPPLY_LOW_REMAINING_PCT) {
            return { key: 'low', label: '⚠️ Low supply', className: 'supply-low' };
        }
        return { key: 'ok', label: '✅ In supply', className: 'supply-ok' };
    }
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

function isPercentRemainingUnit(unit) {
    return PERCENT_REMAINING_UNITS.has((unit || '').toLowerCase());
}

function getPurchasePercentRemaining(purchase) {
    if (isVapePuffPurchase(purchase)) {
        const full = getVapeFullPuffCount(purchase);
        if (full <= 0) return 0;
        const remaining = getPurchaseRemainingAmount(purchase);
        return Math.round((remaining / full) * 1000) / 10;
    }
    const bought = getPurchaseQuantityBought(purchase);
    if (bought <= 0) return 0;
    const remaining = getPurchaseRemainingAmount(purchase);
    return Math.round((remaining / bought) * 1000) / 10;
}

function formatPercentRemainingLabel(remaining, bought) {
    if (bought <= 0) return '';
    const pct = Math.round((remaining / bought) * 1000) / 10;
    const label = Number.isInteger(pct) ? String(pct) : pct.toFixed(1);
    return `${label}% left`;
}

function isVapeNicotineSubstanceId(substanceId, data = appData) {
    return isVapeTrackingMode(substanceId, data);
}

function isVapeNicotineSubstance(sub, data = appData) {
    return sub?.id ? isVapeTrackingMode(sub.id, data) : false;
}

function isVapePuffUnit(unit) {
    return isPercentRemainingUnit(unit);
}

function isVapePuffPurchase(purchase, data = appData) {
    const substanceId = getPurchaseSubstanceId(purchase);
    return isVapeTrackingMode(substanceId, data) && isVapePuffUnit(purchase?.unit);
}

function getVapeFullPuffCount(purchase) {
    if (!purchase) return 0;
    const full = purchase.fullPuffCount ?? purchase.quantityBought ?? purchase.quantity;
    return parseFloat(full) || 0;
}

function getVapePercentBoughtAt(purchase) {
    if (!purchase) return 100;
    const pct = parseFloat(purchase.percentBoughtAt);
    return Number.isFinite(pct) ? Math.max(0, Math.min(100, pct)) : 100;
}

function computeVapeStartingPuffsFromForm(fullCount, percentBoughtAt) {
    const full = Math.max(0, parseFloat(fullCount) || 0);
    const pct = Math.max(0, Math.min(100, parseFloat(percentBoughtAt) || 100));
    return Math.max(0, full * (pct / 100));
}

function getVapeStartingPuffsLeft(purchase) {
    if (!purchase) return 0;
    if (purchase.startingPuffsLeft != null && purchase.startingPuffsLeft !== '') {
        return Math.max(0, parseFloat(purchase.startingPuffsLeft) || 0);
    }
    return computeVapeStartingPuffsFromForm(getVapeFullPuffCount(purchase), getVapePercentBoughtAt(purchase));
}

function normalizeVapePurchaseFields(purchase) {
    if (!isVapePuffPurchase(purchase)) return;
    const full = getVapeFullPuffCount(purchase);
    if (full > 0) {
        purchase.fullPuffCount = full;
        purchase.quantityBought = full;
        purchase.quantity = full;
    }
    if (purchase.percentBoughtAt == null || purchase.percentBoughtAt === '') {
        purchase.percentBoughtAt = 100;
    }
    purchase.startingPuffsLeft = getVapeStartingPuffsLeft(purchase);
    if (purchase.remainingPuffs == null || purchase.remainingPuffs === '') {
        purchase.remainingPuffs = getPurchaseRemainingAmount(purchase);
    }
    syncVapeNicotineFields(purchase);
}

function getVapeELiquidCapacityMl(purchase) {
    const ml = parseFloat(purchase?.eLiquidCapacityMl);
    return Number.isFinite(ml) && ml > 0 ? ml : null;
}

function getVapeNicotineMgPerMl(purchase) {
    const mg = parseFloat(purchase?.nicotineMgPerMl);
    return Number.isFinite(mg) && mg > 0 ? mg : null;
}

function computeVapeTotalNicotineMg(capacityMl, nicotineMgPerMl) {
    const cap = parseFloat(capacityMl);
    const strength = parseFloat(nicotineMgPerMl);
    if (!Number.isFinite(cap) || !Number.isFinite(strength) || cap <= 0 || strength <= 0) return null;
    return cap * strength;
}

function getVapeTotalNicotineMg(purchase) {
    if (!purchase) return null;
    if (purchase.totalNicotineMg != null && purchase.totalNicotineMg !== '') {
        const stored = parseFloat(purchase.totalNicotineMg);
        if (Number.isFinite(stored) && stored > 0) return stored;
    }
    return computeVapeTotalNicotineMg(getVapeELiquidCapacityMl(purchase), getVapeNicotineMgPerMl(purchase));
}

function syncVapeNicotineFields(purchase) {
    if (!isVapePuffPurchase(purchase)) return;
    const cap = getVapeELiquidCapacityMl(purchase);
    const strength = getVapeNicotineMgPerMl(purchase);
    const total = computeVapeTotalNicotineMg(cap, strength);
    if (total != null) {
        purchase.totalNicotineMg = total;
    } else {
        delete purchase.totalNicotineMg;
    }
}

function getVapeNicotineUsedMg(purchase) {
    const total = getVapeTotalNicotineMg(purchase);
    const full = getVapeFullPuffCount(purchase);
    if (!total || full <= 0) return null;
    const starting = getVapeStartingPuffsLeft(purchase);
    const remaining = getPurchaseRemainingAmount(purchase);
    const puffsUsed = Math.max(0, starting - remaining);
    return total * (puffsUsed / full);
}

function getVapeNicotineLeftMg(purchase) {
    const total = getVapeTotalNicotineMg(purchase);
    const full = getVapeFullPuffCount(purchase);
    if (!total || full <= 0) return null;
    const remaining = getPurchaseRemainingAmount(purchase);
    return total * (remaining / full);
}

function getVapeNicotineMetrics(purchase, asOfMs = Date.now()) {
    const totalNicotineMg = getVapeTotalNicotineMg(purchase);
    if (totalNicotineMg == null) return null;
    const nicotineUsedMg = getVapeNicotineUsedMg(purchase);
    const nicotineLeftMg = getVapeNicotineLeftMg(purchase);
    const durationMs = getVapePurchaseSupplyDurationMs(purchase, asOfMs);
    const durationDays = durationMs != null ? durationMs / 86400000 : null;
    return {
        eLiquidCapacityMl: getVapeELiquidCapacityMl(purchase),
        nicotineMgPerMl: getVapeNicotineMgPerMl(purchase),
        totalNicotineMg,
        nicotineUsedMg,
        nicotineLeftMg,
        avgNicotineMgPerDay: durationDays != null && durationDays >= 1 && nicotineUsedMg != null
            ? nicotineUsedMg / durationDays
            : null
    };
}

function parseVapeNicotineFieldsFromForm() {
    const capRaw = parseFloat(document.getElementById('buy-eliquid-capacity')?.value);
    const nicRaw = parseFloat(document.getElementById('buy-nicotine-strength')?.value);
    const eLiquidCapacityMl = Number.isFinite(capRaw) && capRaw > 0 ? capRaw : null;
    const nicotineMgPerMl = Number.isFinite(nicRaw) && nicRaw > 0 ? nicRaw : null;
    const totalNicotineMg = computeVapeTotalNicotineMg(eLiquidCapacityMl, nicotineMgPerMl);
    return { eLiquidCapacityMl, nicotineMgPerMl, totalNicotineMg };
}

function isVapeUseLog(log, data = appData) {
    if (!isPersonalUseLog(log)) return false;
    const substanceId = getUseSubstanceId(log);
    if (!isVapeTrackingMode(substanceId, data)) return false;
    return log.logMode === 'vape_puffs'
        || log.logMode === 'percent_remaining'
        || log.trackingMode === 'vape'
        || isVapePuffUnit(log.unit)
        || log.percentLeftAfter != null
        || log.percentRemaining != null;
}

function shouldShowUseCountForSubstance(substanceId, data = appData) {
    return Boolean(getSubstanceSecondaryCountLabel(substanceId, data));
}

function getPurchaseDatetimeIso(purchase) {
    const dt = parseLocalDateTime(purchase?.date, purchase?.time || '12:00');
    return dt && !Number.isNaN(dt.getTime()) ? dt.toISOString() : new Date().toISOString();
}

function getVapeLogUseDate(log) {
    if (!log?.date) return null;
    const day = parseLocalDate(log.date);
    return day && !Number.isNaN(day.getTime()) ? day : null;
}

function countInclusiveCalendarDays(startDate, endDate) {
    const start = typeof startDate === 'string' ? parseLocalDate(startDate) : startDate;
    const end = typeof endDate === 'string' ? parseLocalDate(endDate) : endDate;
    if (!start || !end || Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) return null;
    const ms = end.getTime() - start.getTime();
    if (ms < 0) return null;
    return Math.max(1, Math.round(ms / 86400000) + 1);
}

function parsePurchaseStartedAt(purchase, data = appData) {
    if (isVapePuffPurchase(purchase)) {
        const logs = getVapePurchaseUseLogs(purchase, data);
        if (!logs.length) return null;
        return getVapeLogUseDate(logs[0]);
    }
    if (purchase?.startedAt) {
        const d = new Date(purchase.startedAt);
        if (!Number.isNaN(d.getTime())) return d;
    }
    return parseLocalDateTime(purchase?.date, purchase?.time || '12:00');
}

function getVapePurchaseUseLogs(purchase, data = appData) {
    return getLogsForPurchase(purchase.id, data)
        .filter(l => isPersonalUseLog(l) && isVapeUseLog(l, data))
        .sort((a, b) => getVapeLogSortMs(a) - getVapeLogSortMs(b));
}

function getVapeDerivedFinishedAt(purchase, data = appData) {
    if (!isVapePuffPurchase(purchase)) return null;
    const depleted = purchase.isDepleted || getPurchaseRemainingAmount(purchase) <= INVENTORY_EPS;
    if (!depleted) return null;
    const logs = getVapePurchaseUseLogs(purchase, data);
    if (!logs.length) return null;
    return getVapeLogUseDate(logs[logs.length - 1]);
}

function formatVapeSupplyDurationLabel(purchase, durationMs, data = appData) {
    if (durationMs == null || durationMs < 0) return 'Not started';
    const days = Math.max(1, Math.round(durationMs / 86400000));
    const depleted = purchase.isDepleted || getPurchaseRemainingAmount(purchase) <= INVENTORY_EPS;
    return depleted
        ? `Lasted ${days} day${days === 1 ? '' : 's'}`
        : `Used for ${days} day${days === 1 ? '' : 's'} so far`;
}

function ensureVapePurchaseStartedAt(purchase, logEntry = null) {
    // Supply start comes from linked use logs via syncVapePurchaseSupplyStartedAt / recalculateVapePurchaseInventory.
}

function formatVapeDuration(ms) {
    if (ms == null || ms < 0 || Number.isNaN(ms)) return '—';
    const days = Math.floor(ms / 86400000);
    const hours = Math.floor((ms % 86400000) / 3600000);
    const minutes = Math.floor((ms % 3600000) / 60000);
    if (days >= 1) return `${days} day${days === 1 ? '' : 's'} ${hours} hr${hours === 1 ? '' : 's'}`;
    return `${hours} hr${hours === 1 ? '' : 's'} ${minutes} min${minutes === 1 ? '' : 's'}`;
}

function getVapePurchaseLifecycleMetrics(purchase, asOfMs = Date.now(), data = appData) {
    if (!isVapePuffPurchase(purchase)) return null;
    const starting = getVapeStartingPuffsLeft(purchase);
    const remaining = getPurchaseRemainingAmount(purchase);
    const totalUsed = Math.max(0, starting - remaining);
    const logs = getVapePurchaseUseLogs(purchase, data);
    const firstLog = logs[0] || null;
    const lastLog = logs[logs.length - 1] || null;
    const firstUseAt = firstLog ? getVapeLogUseDate(firstLog) : null;
    const lastUseAt = lastLog ? getVapeLogUseDate(lastLog) : null;
    const started = firstUseAt;
    const finished = getVapeDerivedFinishedAt(purchase, data);
    const isFinished = !!(purchase.isDepleted || remaining <= INVENTORY_EPS) && !!finished;
    const durationMs = getVapePurchaseSupplyDurationMs(purchase, asOfMs, data);
    const durationDays = durationMs != null ? durationMs / 86400000 : null;
    const durationLabel = logs.length
        ? formatVapeSupplyDurationLabel(purchase, durationMs, data)
        : 'Not started';
    return {
        started,
        firstUseAt,
        lastUseAt,
        finished: isFinished ? finished : null,
        durationMs,
        durationLabel,
        totalUsed,
        isFinished,
        avgPuffsPerDay: durationDays != null && durationDays >= 1 ? totalUsed / durationDays : null,
        avgPuffsPerHour: durationMs != null && durationDays != null && durationDays < 2 && durationMs > 0
            ? totalUsed / (durationMs / 3600000)
            : null,
        nicotine: getVapeNicotineMetrics(purchase, asOfMs)
    };
}

function getPurchaseStartedAtMs(purchase, data = appData) {
    const started = parsePurchaseStartedAt(purchase, data);
    if (started && !Number.isNaN(started.getTime())) return started.getTime();
    if (!isVapePuffPurchase(purchase)) return getPurchaseDatetimeMs(purchase);
    return null;
}

function getVapePurchaseSupplyDurationMs(purchase, asOfMs = Date.now(), data = appData) {
    const logs = getVapePurchaseUseLogs(purchase, data);
    if (!logs.length) return null;
    const firstDate = logs[0]?.date;
    if (!firstDate) return null;
    const depleted = purchase.isDepleted || getPurchaseRemainingAmount(purchase) <= INVENTORY_EPS;
    const endDate = depleted
        ? logs[logs.length - 1]?.date
        : getLocalDateString(new Date(asOfMs));
    const days = countInclusiveCalendarDays(firstDate, endDate);
    return days != null ? days * 86400000 : null;
}

function shouldDistributeVapeLogForStats(log, data = appData) {
    if (!isVapeUseLog(log, data) || !isPersonalUseLog(log) || log.needsReview) return false;
    return getVapeTaperCountMode(data) === 'spread-across-days';
}

function distributeAmountOverTimeInterval(amount, startDt, endDt) {
    if (!Number.isFinite(amount) || amount <= 0) return [];
    const startMs = startDt?.getTime();
    const endMs = endDt?.getTime();
    if (startMs == null || endMs == null || Number.isNaN(startMs) || Number.isNaN(endMs)) {
        const fallbackDt = endDt && !Number.isNaN(endDt.getTime())
            ? endDt
            : (startDt && !Number.isNaN(startDt.getTime()) ? startDt : null);
        return fallbackDt ? [{ date: getLocalDateString(fallbackDt), amount }] : [];
    }
    if (endMs <= startMs) {
        return [{ date: getLocalDateString(startDt), amount }];
    }
    const totalMs = endMs - startMs;
    const allocations = new Map();
    let cursor = parseLocalDate(getLocalDateString(startDt));
    const endDate = parseLocalDate(getLocalDateString(endDt));
    while (cursor && endDate && cursor <= endDate) {
        const dateStr = getLocalDateString(cursor);
        const bounds = getLocalDayBoundaryMs(dateStr);
        if (bounds) {
            const overlapStart = Math.max(startMs, bounds.startMs);
            const overlapEnd = Math.min(endMs, bounds.endMs);
            if (overlapEnd > overlapStart) {
                const portion = amount * ((overlapEnd - overlapStart) / totalMs);
                if (portion > 0) allocations.set(dateStr, (allocations.get(dateStr) || 0) + portion);
            }
        }
        cursor.setDate(cursor.getDate() + 1);
    }
    const entries = [...allocations.entries()].map(([date, amt]) => ({ date, amount: amt }));
    const sum = entries.reduce((s, e) => s + e.amount, 0);
    if (entries.length && Math.abs(sum - amount) > 0.001) {
        entries[entries.length - 1].amount += amount - sum;
    }
    return entries;
}

function getVapeLogPuffAmount(log) {
    return parseFloat(log.estimatedPuffsUsed ?? log.amount) || 0;
}

function getVapeLogStatsAllocations(log, data = appData) {
    const amount = getVapeLogPuffAmount(log);
    if (amount <= INVENTORY_EPS) return [];
    if (isVapeDateOnlyUseLog(log, data)) {
        return log.date ? [{ date: log.date, amount }] : [];
    }
    if (!shouldDistributeVapeLogForStats(log)) {
        return log.date ? [{ date: log.date, amount }] : [];
    }

    const startedAt = getUseLogStartedAt(log);
    const endedAt = getUseLogEndedAt(log);
    const durationMs = getVapeLogDurationMs(log);

    if (startedAt && endedAt && endedAt > startedAt) {
        return distributeAmountOverTimeInterval(amount, startedAt, endedAt);
    }
    if (startedAt && durationMs != null && durationMs <= 0) {
        return [{ date: getLocalDateString(startedAt), amount }];
    }
    if (startedAt && !endedAt) {
        return [{ date: getLocalDateString(startedAt), amount }];
    }

    const purchase = findPurchaseInData(getLogPurchaseId(log), data);
    if (purchase) {
        const supplyStart = parsePurchaseStartedAt(purchase, data);
        const logEnd = endedAt || parseUseDateTime(log.date, log.endTime || log.startTime || log.time);
        if (supplyStart && logEnd && logEnd > supplyStart) {
            return distributeAmountOverTimeInterval(amount, supplyStart, logEnd);
        }
    }
    if (log.date) return [{ date: log.date, amount }];
    if (startedAt) return [{ date: getLocalDateString(startedAt), amount }];
    return [];
}

function getVapeDistributedUsageMap(substanceId, data = appData) {
    const map = new Map();
    getUseLogsForSubstance(substanceId, { personalUseOnly: true, data }).forEach(log => {
        if (!isVapeUseLog(log)) return;
        getVapeLogStatsAllocations(log, data).forEach(({ date, amount }) => {
            map.set(date, (map.get(date) || 0) + amount);
        });
    });
    return map;
}

function getStatsUsageInRange(substanceId, startDate, endDate, data = appData) {
    if (!isVapeNicotineSubstanceId(substanceId)) {
        return getPersonalUseInRange(substanceId, startDate, endDate, data)
            .reduce((s, l) => s + (parseFloat(l.amount) || 0), 0);
    }
    let total = 0;
    getVapeDistributedUsageMap(substanceId, data).forEach((amount, date) => {
        if (startDate && date < startDate) return;
        if (endDate && date > endDate) return;
        total += amount;
    });
    return total;
}

function getStatsUsageOnDate(substanceId, dateStr, data = appData) {
    if (!isVapeNicotineSubstanceId(substanceId)) {
        return getUsedAmount(substanceId, dateStr, null, data);
    }
    return getVapeDistributedUsageMap(substanceId, data).get(dateStr) || 0;
}

function getStatsMonthUsageTotal(substanceId, dateStr = getLocalDateString(), data = appData) {
    const monthStart = getMonthStartDateStr(dateStr);
    return getStatsUsageInRange(substanceId, monthStart, dateStr, data);
}

function getVapePurchaseBreakHoursList(substanceId, startDate = null, endDate = null, data = appData) {
    const purchases = getPurchasesForSubstance(substanceId, data).filter(isVapePuffPurchase);
    const gaps = [];
    for (let i = 1; i < purchases.length; i++) {
        const prevMs = getPurchaseStartedAtMs(purchases[i - 1]);
        const curMs = getPurchaseStartedAtMs(purchases[i]);
        const curDate = purchases[i].date;
        if (!prevMs || !curMs || curMs <= prevMs) continue;
        if (startDate && curDate < startDate) continue;
        if (endDate && curDate > endDate) continue;
        gaps.push((curMs - prevMs) / 3600000);
    }
    return gaps;
}

function getVapeFinishedSupplyDurationsInRange(substanceId, startDate, endDate, data = appData) {
    return getPurchasesForSubstance(substanceId, data)
        .filter(p => isVapePuffPurchase(p) && (p.isDepleted || getPurchaseRemainingAmount(p) <= INVENTORY_EPS))
        .filter(p => {
            const finished = getVapeDerivedFinishedAt(p, data);
            if (!finished) return false;
            const finishDate = getLocalDateString(finished);
            return finishDate >= startDate && finishDate <= endDate;
        })
        .map(p => getVapePurchaseSupplyDurationMs(p, Date.now(), data))
        .filter(ms => ms != null && ms >= 0);
}

function getVapeCurrentSupplyDurationMs(substanceId) {
    const active = getActivePurchasesForSubstance(substanceId).filter(isVapePuffPurchase);
    if (!active.length) return null;
    const latest = active.sort((a, b) => getPurchaseStartedAtMs(b) - getPurchaseStartedAtMs(a))[0];
    return getVapePurchaseSupplyDurationMs(latest);
}

function formatStatsBreakValue(hours, substanceId) {
    if (hours == null || Number.isNaN(hours)) return '—';
    if (isVapeNicotineSubstanceId(substanceId)) return formatBreakFromHours(hours);
    return formatDurationHMS(hours);
}

function formatStatsDurationValue(hours, substanceId, { soFar = false } = {}) {
    if (hours == null || Number.isNaN(hours)) return '—';
    if (isWeedTrackingMode(substanceId)) return '—';
    if (isVapeNicotineSubstanceId(substanceId)) {
        const label = formatVapeDuration(hours * 3600000);
        return soFar ? `${label} so far` : label;
    }
    return formatDurationHMS(hours);
}

function getUseStatsCatalogForSubstance(substanceId) {
    if (isVapeNicotineSubstanceId(substanceId)) {
        return [...USE_STATS_VAPE_DEFAULTS.order];
    }
    if (isWeedTrackingMode(substanceId)) {
        return USE_STATS_DEFAULTS.order.filter(id =>
            !VAPE_ONLY_USE_STAT_IDS.includes(id) && !WEED_EXCLUDED_USE_STAT_IDS.has(id)
        );
    }
    return USE_STATS_DEFAULTS.order.filter(id => !VAPE_ONLY_USE_STAT_IDS.includes(id));
}

function getUseStatLabelForSubstance(statId, substanceId, unit) {
    if (isVapeNicotineSubstanceId(substanceId)) {
        if (statId === 'totalUsage') return 'Total puffs';
        if (statId === 'sessionCount') return 'Entries';
        if (statId === 'avgPuffsPerSession') return 'Avg puffs/log';
        return USE_STATS_LABELS[statId] || statId;
    }
    if (isWeedTrackingMode(substanceId) && statId === 'sessionCount') return 'Entries';
    if (statId === 'avgPerUseDay') return `Avg ${unit} / Use Day`;
    if (statId === 'avgPerCalendarDay') return `Avg ${unit} / Calendar Day`;
    return USE_STATS_LABELS[statId] || statId;
}

function getVisibleUseStatsOrderForSubstance(substanceId) {
    if (isWeedTrackingMode(substanceId)) {
        const config = getUseStatsConfig();
        const hidden = new Set(config.hidden || []);
        WEED_EXCLUDED_USE_STAT_IDS.forEach(id => hidden.add(id));
        VAPE_ONLY_USE_STAT_IDS.forEach(id => hidden.add(id));
        const catalog = getUseStatsCatalogForSubstance(substanceId);
        const order = [];
        [...config.order, ...catalog].forEach(id => {
            if (catalog.includes(id) && !order.includes(id)) order.push(id);
        });
        const visible = order.filter(id => !hidden.has(id) && catalog.includes(id));
        return visible.length ? visible : [...catalog];
    }
    if (!isVapeNicotineSubstanceId(substanceId)) {
        return getVisibleUseStatsOrder().filter(id => !VAPE_ONLY_USE_STAT_IDS.includes(id));
    }
    const config = getUseStatsConfig();
    const hidden = new Set(config.hidden || []);
    VAPE_EXCLUDED_USE_STAT_IDS.forEach(id => hidden.add(id));
    const catalog = getUseStatsCatalogForSubstance(substanceId);
    const order = [];
    [...config.order, ...catalog].forEach(id => {
        if (catalog.includes(id) && !order.includes(id)) order.push(id);
    });
    const visible = order.filter(id => !hidden.has(id) && !VAPE_EXCLUDED_USE_STAT_IDS.has(id));
    return visible.length ? visible : [...catalog];
}

function reconcileVapePurchaseLifecycle(purchase, data = appData) {
    if (!isVapePuffPurchase(purchase)) return;
    recalculateVapePurchaseInventory(purchase.id, data);
}

function isPercentBasedVapeLog(log) {
    if (!log || log.needsReview) return false;
    if (log.estimatedFromPercent || log.isEstimated) return true;
    return log.logMode === 'percent_remaining';
}

function applyVapeLogToRemaining(purchase, previousRemaining, log) {
    const fullPuffs = getVapeFullPuffCount(purchase);
    if (log.needsReview) return previousRemaining;
    if (isPercentBasedVapeLog(log)) {
        const pct = log.percentLeftAfter ?? log.percentRemaining;
        if (pct != null && Number.isFinite(parseFloat(pct))) {
            return Math.round(Math.max(0, Math.min(fullPuffs, fullPuffs * (parseFloat(pct) / 100))));
        }
    }
    const used = parseFloat(log.amount) || 0;
    return Math.max(0, Math.min(fullPuffs, previousRemaining - used));
}

function getVapeLogEndMs(log) {
    if (isVapeDateOnlyUseLog(log)) {
        const day = getVapeLogUseDate(log);
        if (day) return day.getTime() + 86400000 - 1;
    }
    const ended = getUseLogEndedAt(log);
    if (ended) return ended.getTime();
    return getLogDatetimeMs(log);
}

function getVapeLogSortMs(log) {
    const day = getVapeLogUseDate(log);
    if (day) return day.getTime() + 12 * 3600000;
    const started = getUseLogStartedAt(log);
    if (started && !Number.isNaN(started.getTime())) return started.getTime();
    return getLogDatetimeMs(log);
}

function getVapeLogDurationMs(log) {
    if (log?.durationMs != null && log.durationMs > 0) return log.durationMs;
    const started = getUseLogStartedAt(log);
    const ended = getUseLogEndedAt(log);
    if (started && ended && ended > started) return ended.getTime() - started.getTime();
    return null;
}

function getVapePurchasesForSubstance(substanceId, data = appData) {
    return getPurchasesForSubstance(substanceId, data, { sortAsc: true }).filter(isVapePuffPurchase);
}

function findVapePurchaseForLogDatetime(substanceId, logMs, data = appData) {
    const purchases = getVapePurchasesForSubstance(substanceId, data);
    if (!purchases.length || logMs == null || Number.isNaN(logMs)) return null;
    for (let i = 0; i < purchases.length; i++) {
        const purchaseMs = getPurchaseDatetimeMs(purchases[i]);
        const nextMs = purchases[i + 1] ? getPurchaseDatetimeMs(purchases[i + 1]) : null;
        if (logMs >= purchaseMs && (nextMs == null || logMs < nextMs)) {
            return purchases[i];
        }
    }
    return null;
}

function findVapePurchaseForLogDate(substanceId, logDateStr, data = appData) {
    if (!logDateStr) return null;
    const logDay = parseLocalDate(logDateStr);
    if (!logDay) return null;
    return findVapePurchaseForLogDatetime(substanceId, logDay.getTime(), data);
}

function inferVapeInventoryIdForLog(log, data = appData) {
    if (getLogPurchaseId(log)) return getLogPurchaseId(log);
    if (!isVapeUseLog(log, data)) return null;
    const substanceId = getUseSubstanceId(log);
    if (isVapeDateOnlyUseLog(log, data) && log.date) {
        const purchase = findVapePurchaseForLogDate(substanceId, log.date, data);
        return purchase?.id ?? null;
    }
    const started = getUseLogStartedAt(log);
    const logMs = started && !Number.isNaN(started.getTime())
        ? started.getTime()
        : (parseLocalDate(log.date)?.getTime() ?? null);
    const purchase = findVapePurchaseForLogDatetime(substanceId, logMs, data);
    return purchase?.id ?? null;
}

function syncVapePurchaseSupplyStartedAt(purchase, logs, data = appData) {
    // Vape supply start/end are derived from linked use logs at display time.
}

function getVapeRemainingBeforeLog(purchase, logDate, data = appData, excludeLogId = null) {
    let remaining = getVapeStartingPuffsLeft(purchase);
    const logs = getLogsForPurchase(purchase.id, data)
        .filter(l => isPersonalUseLog(l) && isVapeUseLog(l, data) && !l.needsReview)
        .filter(l => excludeLogId == null || String(l.id) !== String(excludeLogId))
        .filter(l => (l.date || '') <= (logDate || ''))
        .sort((a, b) => {
            const dateCmp = (a.date || '').localeCompare(b.date || '');
            if (dateCmp !== 0) return dateCmp;
            return String(a.id).localeCompare(String(b.id));
        });
    logs.forEach(log => {
        remaining = applyVapeLogToRemaining(purchase, remaining, log);
    });
    return remaining;
}

function recalculateVapePurchaseInventory(purchaseId, data = appData, options = {}) {
    const purchase = findPurchaseInData(purchaseId, data);
    if (!purchase || !isVapePuffPurchase(purchase)) return;
    normalizeVapePurchaseFields(purchase);
    const { excludeLogId = null } = options;
    const fullPuffs = getVapeFullPuffCount(purchase);
    const startingPuffs = getVapeStartingPuffsLeft(purchase);
    const logs = getLogsForPurchase(purchaseId, data)
        .filter(l => isPersonalUseLog(l) && isVapeUseLog(l, data) && !l.needsReview)
        .filter(l => excludeLogId == null || String(l.id) !== String(excludeLogId))
        .sort((a, b) => getVapeLogSortMs(a) - getVapeLogSortMs(b));

    let remaining = startingPuffs;
    let lastFinishLog = null;

    logs.forEach(log => {
        const previousRemaining = remaining;
        log.previousRemainingBeforeLog = previousRemaining;
        syncLogInventoryId(log);
        log.inventoryId = purchaseId;
        log.purchaseId = purchaseId;
        log.linkedPurchaseId = purchaseId;

        if (isPercentBasedVapeLog(log)) {
            const pct = log.percentLeftAfter ?? log.percentRemaining;
            remaining = Math.round(Math.max(0, Math.min(fullPuffs, fullPuffs * (parseFloat(pct) / 100))));
            const estimatedUsed = Math.max(0, previousRemaining - remaining);
            log.amount = estimatedUsed;
            log.estimatedPuffsUsed = estimatedUsed;
            log.isEstimated = true;
            log.estimatedFromPercent = true;
            log.remainingPuffsAfter = remaining;
            log.percentLeftAfter = parseFloat(pct);
            log.percentRemaining = parseFloat(pct);
        } else {
            const used = parseFloat(log.amount) || 0;
            remaining = Math.max(0, Math.min(fullPuffs, previousRemaining - used));
            log.isEstimated = false;
            log.estimatedFromPercent = false;
            log.remainingPuffsAfter = remaining;
            if (fullPuffs > 0) {
                log.percentRemaining = Math.round((remaining / fullPuffs) * 1000) / 10;
                log.percentLeftAfter = log.percentRemaining;
            }
        }

        if (remaining <= INVENTORY_EPS) {
            remaining = 0;
            lastFinishLog = log;
        }
    });

    purchase.remainingAmount = remaining;
    purchase.remainingPuffs = remaining;
    purchase.isDepleted = remaining <= INVENTORY_EPS;
    if (purchase.isDepleted) {
        purchase.inventoryStatus = 'depleted';
    } else if (purchase.inventoryStatus !== 'stored') {
        purchase.inventoryStatus = 'active';
    }
    syncVapePurchaseSupplyStartedAt(purchase, logs, data);
    purchase.updatedAt = new Date().toISOString();
}

function getVapeUsageRatePreview(purchase, newRemaining, useDate, useTime) {
    const starting = getVapeStartingPuffsLeft(purchase);
    const started = parsePurchaseStartedAt(purchase);
    const useDt = parseUseDateTime(useDate, useTime);
    if (!started || !useDt || Number.isNaN(started.getTime()) || Number.isNaN(useDt.getTime())) return null;
    const ms = useDt.getTime() - started.getTime();
    if (ms <= 0) return null;
    const days = ms / 86400000;
    const totalUsedSoFar = Math.max(0, starting - newRemaining);
    return {
        days,
        ms,
        totalUsedSoFar,
        puffsPerDay: totalUsedSoFar / days,
        puffsPerHour: days < 1 ? totalUsedSoFar / (ms / 3600000) : null,
        started,
        useDt
    };
}

function formatPreviewMonthDay(date) {
    if (!date || Number.isNaN(date.getTime())) return '—';
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

function getSelectedVapePurchaseId() {
    const vapeVal = document.getElementById('use-vape-purchase-select')?.value;
    if (vapeVal) return parsePurchaseSelectId(vapeVal);
    const val = document.getElementById('use-purchase-select')?.value;
    return val ? parsePurchaseSelectId(val) : null;
}

function populateVapeActivePurchaseSelect(substanceId) {
    const select = document.getElementById('use-vape-purchase-select');
    if (!select) return;
    const active = (appData.purchases || [])
        .filter(p => getPurchaseSubstanceId(p) === substanceId && isVapePuffPurchase(p))
        .filter(p => getPurchaseInventoryTab(p) === 'active' && getPurchaseRemainingAmount(p) > INVENTORY_EPS)
        .sort((a, b) => getPurchaseDatetimeMs(b) - getPurchaseDatetimeMs(a));
    const fallback = (appData.purchases || [])
        .filter(p => getPurchaseSubstanceId(p) === substanceId && isVapePuffPurchase(p))
        .sort((a, b) => getPurchaseDatetimeMs(b) - getPurchaseDatetimeMs(a));
    const list = active.length ? active : fallback;
    const prev = select.value;
    select.innerHTML = '';
    list.forEach(p => {
        const opt = document.createElement('option');
        opt.value = String(p.id);
        const name = p.notes || p.store || p.location || `Purchase ${formatDate(p.date)}`;
        opt.textContent = `${name} · ${formatAmount(getPurchaseRemainingAmount(p))} puffs left`;
        select.appendChild(opt);
    });
    if (prev && [...select.options].some(o => o.value === prev)) select.value = prev;
    else if (list.length) select.value = String(list[0].id);
    const manualSelect = document.getElementById('use-purchase-select');
    if (manualSelect && select.value) manualSelect.value = select.value;
    updateVapePurchaseSelectDetails();
}

function updateVapePurchaseSelectDetails() {
    const detail = document.getElementById('use-vape-purchase-detail');
    if (!detail) return;
    const purchase = findPurchase(getSelectedVapePurchaseId());
    if (!purchase) {
        detail.textContent = 'Select an active vape purchase.';
        return;
    }
    const cur = getCurrencySymbol();
    const cost = parseFloat(getPurchaseTotalCost(purchase)) || 0;
    const pct = getPurchasePercentRemaining(purchase);
    const rem = getPurchaseRemainingAmount(purchase);
    const nic = getVapeNicotineMgPerMl(purchase);
    const name = purchase.notes || purchase.store || 'Vape';
    detail.textContent = `${name} · ${formatAmount(rem)} puffs (${pct}%) · ${nic != null ? `${formatAmount(nic)} mg/mL` : 'nicotine n/a'} · ${fmtSheetMoney(cost, cur)}`;
}

function getVapeLogInputMode() {
    return document.getElementById('use-vape-log-mode')?.value === 'puffs' ? 'puffs' : 'percent';
}

function setVapeLogInputMode(mode) {
    const val = mode === 'puffs' ? 'puffs' : 'percent';
    setInputValue('use-vape-log-mode', val);
    document.querySelectorAll('.use-vape-mode-btn').forEach(btn => {
        btn.classList.toggle('active', btn.dataset.vapeMode === val);
    });
    document.getElementById('use-vape-percent-group')?.classList.toggle('hidden', val === 'puffs');
    document.getElementById('use-vape-puffs-group')?.classList.toggle('hidden', val !== 'puffs');
    updateVapeUsePreview();
}

function computeVapeUseFromForm(options = {}) {
    const substanceId = document.getElementById('use-substance')?.value;
    if (!isVapeTrackingMode(substanceId)) return null;

    const logDate = document.getElementById('use-date')?.value || getLocalDateString();
    if (!logDate) return { error: 'Enter a date.' };

    const purchaseId = getSelectedVapePurchaseId();
    const purchase = purchaseId ? findPurchase(purchaseId) : null;
    const fullPuffCount = purchase ? getVapeFullPuffCount(purchase) : null;
    if (!purchase || !fullPuffCount) {
        return { error: 'Select an active vape purchase.' };
    }

    const previousRemaining = getVapeRemainingBeforeLog(
        purchase,
        logDate,
        appData,
        options.editingId || null
    );
    const inputMode = getVapeLogInputMode();
    let percentAfter;
    let currentRemaining;
    let puffsUsed;
    let isEstimated = true;
    let estimatedFromPercent = true;
    let warning = null;

    if (inputMode === 'puffs') {
        const puffsRaw = parseFloat(document.getElementById('use-vape-puffs-used')?.value);
        if (!Number.isFinite(puffsRaw) || puffsRaw < 0) {
            return { error: 'Enter puffs used.' };
        }
        puffsUsed = puffsRaw;
        currentRemaining = Math.max(0, previousRemaining - puffsUsed);
        percentAfter = fullPuffCount > 0
            ? Math.round((currentRemaining / fullPuffCount) * 100)
            : 0;
        isEstimated = false;
        estimatedFromPercent = false;
    } else {
        const percentRaw = document.getElementById('use-percent-after')?.value;
        const hasPercent = percentRaw !== '' && percentRaw != null && Number.isFinite(parseFloat(percentRaw));
        if (!hasPercent) return { error: 'Enter current % left after this use.' };
        percentAfter = Math.max(0, Math.min(100, parseFloat(percentRaw)));
        currentRemaining = Math.round(Math.max(0, Math.min(fullPuffCount, fullPuffCount * (percentAfter / 100))));
        puffsUsed = previousRemaining - currentRemaining;
        if (puffsUsed < 0) {
            warning = 'Percent left is higher than current inventory. This will be treated as an adjustment unless you choose a different vape.';
        }
    }

    return {
        purchase,
        purchaseId: purchase.id,
        puffsUsed,
        estimatedPuffsUsed: puffsUsed,
        currentRemaining,
        percentAfter,
        previousRemaining,
        totalPuffs: fullPuffCount,
        isEstimated,
        estimatedFromPercent,
        warning
    };
}

function updateVapeUsePreview() {
    const preview = document.getElementById('use-vape-preview');
    if (!preview) return;
    if (!isVapeSessionFormActive()) {
        preview.textContent = '—';
        return;
    }

    const calc = computeVapeUseFromForm({ editingId: editingUseId || null });
    if (!calc || calc.error) {
        preview.textContent = calc?.error || 'Enter current % left after this use.';
        return;
    }

    const pctLabel = Number.isInteger(calc.percentAfter)
        ? calc.percentAfter
        : parseFloat(calc.percentAfter).toFixed(1);
    const lines = [
        `${formatAmount(calc.puffsUsed)} puffs used → ${formatAmount(calc.currentRemaining)} puffs remaining (${pctLabel}% left).`
    ];
    if (calc.warning) lines.push(calc.warning);

    preview.textContent = lines.join('\n');
}

function updateVapeUseFormUI() {
    const substanceId = document.getElementById('use-substance')?.value;
    const isVape = isVapeTrackingMode(substanceId);
    const isWeed = isWeedTrackingMode(substanceId);
    const isVapeUse = isVape;
    const vapeGroup = document.getElementById('use-vape-fields-group');
    const amountGroup = document.getElementById('use-amount-mode-group');
    const amountInput = document.getElementById('use-amount');
    const percentInput = document.getElementById('use-percent-after');
    const unitSelect = document.getElementById('use-unit');
    const countGroup = document.getElementById('use-count-group');
    const tx = document.getElementById('use-transaction-type')?.value || 'use';
    const isNonUse = isNonUseTransactionType(tx);

    document.getElementById('use-log-form')?.classList.toggle('is-weed-simple', isWeed);
    document.getElementById('use-log-form')?.classList.toggle('is-vape-simple', isVape);
    document.getElementById('use-entry-type-group')?.classList.toggle('hidden', isVape || isWeed || isNonUse);
    document.getElementById('use-transaction-type-block')?.classList.toggle('hidden', isVape);
    document.getElementById('use-start-time-group')?.classList.toggle('hidden', isWeed || isVape);
    document.getElementById('use-end-date-group')?.classList.add('hidden');
    document.getElementById('use-end-time-group')?.classList.toggle('hidden', isWeed || isVape || (
        (document.getElementById('use-type')?.value || 'quick') !== 'session'
        && !isNonUse
    ));

    const dateLabel = document.getElementById('use-date-label');
    if (dateLabel) dateLabel.textContent = 'Date';
    const startTimeInput = document.getElementById('use-start-time');
    if (startTimeInput) startTimeInput.required = !isWeed && !isVape;

    if (isWeed) {
        ensureWeedUseFormDefaults();
        updateWeedUseFormUI();
        positionUseInventoryFields(true);
        document.getElementById('use-duration-preview')?.classList.add('hidden');
    } else if (isVape) {
        ensureVapeUseFormDefaults();
        positionUseInventoryFields(false);
        document.getElementById('use-duration-preview')?.classList.add('hidden');
        document.getElementById('use-weed-product-type-group')?.classList.add('hidden');
    } else {
        document.getElementById('use-weed-product-type-group')?.classList.add('hidden');
        positionUseInventoryFields(false);
    }

    if (isVape) {
        setUsePurchaseLinkMode('manual');
        populateVapeActivePurchaseSelect(substanceId);
        setVapeLogInputMode(getVapeLogInputMode());
    }

    amountGroup?.classList.toggle('hidden', isVapeUse);
    vapeGroup?.classList.toggle('hidden', !isVapeUse);
    document.getElementById('use-vape-purchase-block')?.classList.toggle('hidden', !isVapeUse);
    if (amountInput) {
        amountInput.required = !isVapeUse;
    }
    if (percentInput) {
        if (isVapeUse) {
            percentInput.required = getVapeLogInputMode() === 'percent';
            const purchaseId = getSelectedVapePurchaseId();
            percentInput.disabled = !purchaseId;
        } else {
            percentInput.required = false;
            percentInput.disabled = false;
        }
    }
    if (unitSelect) {
        unitSelect.disabled = isVapeUse;
        unitSelect.required = !isVapeUse;
    }
    countGroup?.classList.toggle('hidden', !shouldShowUseCountForSubstance(substanceId) || isVapeUse || isWeed);
    if (isVapeUse) {
        updateVapeUsePreview();
    }
}

function applyVapeUseInventory(calc, logEntry) {
    const purchase = calc.purchase;
    if (!purchase) return { ok: false, error: 'Purchase not found.' };
    setLogPurchaseId(logEntry, purchase.id);
    recalculateVapePurchaseInventory(purchase.id);
    return { ok: true };
}

function formatVapeUseSummary(log, sub) {
    return formatVapeRecentUseDetailLines(log).join(' · ') || `${sub?.name || 'Vape'} use`;
}

function formatVapeRecentUseDetailLines(log) {
    const lines = [];
    if (log.needsReview) {
        lines.push('Needs review');
        return lines;
    }
    const amount = parseFloat(log.estimatedPuffsUsed ?? log.amount);
    if (Number.isFinite(amount)) {
        lines.push(`~${formatAmount(amount)} puffs used`);
    }
    const pct = log.percentLeftAfter ?? log.percentRemaining;
    if (pct != null) {
        const pctLabel = Number.isInteger(pct) ? pct : parseFloat(pct).toFixed(1);
        lines.push(`${pctLabel}% left after`);
    }
    const started = getUseLogStartedAt(log);
    const ended = getUseLogEndedAt(log);
    if (!isVapeDateOnlyUseLog(log)) {
        if (started) lines.push(`Start: ${formatDatetimeShort(started)}`);
        if (ended && (log.endTime || log.endedAt)) lines.push(`End: ${formatDatetimeShort(ended)}`);
        const durationMs = log.durationMs ?? (started && ended ? ended.getTime() - started.getTime() : null);
        if (durationMs != null && durationMs > 0) {
            lines.push(`Duration: ${formatVapeDuration(durationMs)}`);
        }
    }
    if (log.isEstimated || log.estimatedFromPercent) {
        lines.push('Estimated from percent left');
    }
    return lines;
}

function formatVapeLinkedPurchaseLine(log) {
    const pid = getLogPurchaseId(log);
    if (!pid) return '';
    const purchase = findPurchase(pid);
    if (!purchase) return '';
    const store = purchase.store || purchase.location || purchase.notes || '';
    return `Linked: ${formatDate(purchase.date)} purchase${store ? ` · ${store}` : ''}`;
}

function repairVapeInventoryLinks(data) {
    ensureAppDataMigrations(data);
    (data.logs || []).forEach(log => {
        syncLogInventoryId(log);
        if (!data.migrations.vapeInventoryLinkV2 && !getLogPurchaseId(log) && isVapeUseLog(log, data)) {
            const inferred = inferVapeInventoryIdForLog(log, data);
            if (inferred) setLogPurchaseId(log, inferred);
        }
    });
    if (!data.migrations.vapeInventoryLinkV2) {
        (data.purchases || []).filter(isVapePuffPurchase).forEach(purchase => {
            delete purchase.startedAt;
        });
        data.migrations.vapeInventoryLinkV2 = true;
    }
    (data.purchases || []).filter(isVapePuffPurchase).forEach(purchase => {
        recalculateVapePurchaseInventory(purchase.id, data);
    });
}

function migrateVapeDataV1(data) {
    if (data.migrations?.vapePuffsV1) return;
    (data.purchases || []).forEach(purchase => {
        if (!isVapePuffPurchase(purchase)) return;
        normalizeVapePurchaseFields(purchase);
        if (!purchase.time) purchase.time = '12:00';
        if (purchase.remainingPuffs == null) purchase.remainingPuffs = getPurchaseRemainingAmount(purchase);
    });
    (data.logs || []).forEach(log => {
        if (!isVapeNicotineSubstanceId(getUseSubstanceId(log)) || !isPersonalUseLog(log)) return;
        if (log.logMode === 'percent_remaining' || log.amountUnit === '%') {
            log.logMode = 'vape_puffs';
            log.unit = 'puffs';
            delete log.amountUnit;
            const pid = getLogPurchaseId(log);
            const purchase = pid ? findPurchaseInData(pid, data) : null;
            const bought = purchase ? getVapeFullPuffCount(purchase) : null;
            const amount = parseFloat(log.amount) || 0;
            if (amount <= INVENTORY_EPS && log.previousRemainingBeforeLog != null && log.percentRemaining != null && bought > 0) {
                const afterRemaining = bought * (parseFloat(log.percentRemaining) / 100);
                const inferred = log.previousRemainingBeforeLog - afterRemaining;
                if (inferred > INVENTORY_EPS) log.amount = inferred;
                else log.needsReview = true;
            } else if (amount <= INVENTORY_EPS) {
                log.needsReview = true;
            }
            if (bought > 0 && amount >= bought * 0.95 && parseFloat(log.percentRemaining) === 0) {
                log.needsReview = true;
            }
            if (!log.needsReview) {
                log.estimatedFromPercent = true;
                log.isEstimated = true;
                log.percentLeftAfter = log.percentRemaining;
            }
        }
        if (isVapeUseLog(log) && log.unit !== 'puffs') log.unit = 'puffs';
    });
    (data.purchases || []).forEach(purchase => {
        if (isVapePuffPurchase(purchase)) recalculateVapePurchaseInventory(purchase.id, data);
    });
    if (!data.migrations) data.migrations = {};
    data.migrations.vapePuffsV1 = true;
}

function markVapePurchaseEmpty(purchaseId) {
    const purchase = findPurchase(purchaseId);
    if (!purchase || !isVapePuffPurchase(purchase)) return;
    const remaining = getPurchaseRemainingAmount(purchase);
    if (remaining <= INVENTORY_EPS) return alert('This vape is already empty.');

    const dateStr = prompt('Finish date (YYYY-MM-DD):', getLocalDateString());
    if (dateStr == null) return;
    const timeStr = prompt('Finish time (HH:MM):', getLocalTimeString()) || '12:00';
    const finishIso = getUseEventTimestamp(dateStr, timeStr);

    const logRemaining = confirm(
        `Mark this vape empty on ${formatDate(dateStr)} at ${timeStr}?\n\nOK = also log ${formatAmount(remaining)} puffs used\nCancel = mark empty without a use log`
    );

    if (logRemaining) {
        const log = {
            id: Date.now(),
            type: 'quick',
            transactionType: 'use',
            substanceId: getPurchaseSubstanceId(purchase),
            amount: remaining,
            unit: 'puffs',
            logMode: 'vape_puffs',
            isEstimated: true,
            estimatedFromPercent: true,
            percentRemaining: 0,
            percentLeftAfter: 0,
            remainingPuffsAfter: 0,
            previousRemainingBeforeLog: remaining,
            date: dateStr,
            startTime: timeStr,
            time: timeStr,
            notes: 'Marked empty',
            purchaseId: purchase.id,
            linkedPurchaseId: purchase.id,
            linkedPurchases: [],
            inventoryAffects: true,
            supplyUnlinked: false,
            timestamp: finishIso,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString()
        };
        stripLegacyUseLogFields(log);
        if (!Array.isArray(appData.logs)) appData.logs = [];
        appData.logs.push(log);
        recalculateVapePurchaseInventory(purchase.id);
    } else {
        purchase.remainingAmount = 0;
        purchase.isDepleted = true;
        purchase.updatedAt = new Date().toISOString();
    }

    saveData(appData);
    refreshUseLogRelatedViews();
    refreshBuyTrackerRelatedViews();
    alert(logRemaining ? 'Vape marked empty and use logged.' : 'Vape marked empty.');
}

function formatPurchaseRemainingDisplay(purchase) {
    if (isVapePuffPurchase(purchase)) {
        const pct = getPurchasePercentRemaining(purchase);
        return `${formatAmountWithUnit(getPurchaseRemainingDisplayAmount(purchase), 'puffs')} / ${pct}%`;
    }
    const remaining = getPurchaseRemainingDisplayAmount(purchase);
    const unit = getPurchaseRemainingDisplayUnit(purchase);
    const base = formatAmountWithUnit(remaining, unit);
    const bought = getPurchaseQuantityBought(purchase);
    if (!isPercentRemainingUnit(purchase.unit || unit) || bought <= 0) return base;
    return `${base} (${formatPercentRemainingLabel(remaining, bought)})`;
}

function formatPurchaseOptionLabel(purchase) {
    const remaining = getPurchaseRemainingDisplayAmount(purchase);
    const store = purchase.store || purchase.location || '';
    const storePart = store ? ` — ${store}` : '';
    if (isVapePuffPurchase(purchase)) {
        const full = getVapeFullPuffCount(purchase);
        const starting = getVapeStartingPuffsLeft(purchase);
        const pct = getPurchasePercentRemaining(purchase);
        const pctBought = getVapePercentBoughtAt(purchase);
        const boughtPart = pctBought < 100
            ? `${formatAmount(full)} @100% · bought at ${pctBought}% · ${formatAmount(starting)} started`
            : `${formatAmount(full)} puffs`;
        return `${formatDate(purchase.date)} — ${boughtPart} — ${formatAmountWithUnit(remaining, 'puffs')} left (${pct}%)${storePart}`;
    }
    const bought = getPurchaseQuantityBought(purchase);
    const unit = getPurchaseRemainingDisplayUnit(purchase);
    const pctPart = isPercentRemainingUnit(purchase.unit || unit) && bought > 0
        ? ` (${formatPercentRemainingLabel(remaining, bought)})`
        : '';
    return `${formatDate(purchase.date)} — ${formatAmountWithUnit(bought, unit)} bought — ${formatAmountWithUnit(remaining, unit)} left${pctPart}${storePart}`;
}

function updateUseLogModeUI() {
    updateVapeUseFormUI();
}

function getUseFormEffectiveAmount() {
    if (isVapeSessionFormActive()) {
        const calc = computeVapeUseFromForm({ editingId: editingUseId || null });
        if (calc && !calc.error) return calc.estimatedPuffsUsed ?? calc.puffsUsed;
    }
    return parseFloat(document.getElementById('use-amount')?.value) || 0;
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

    if (isVapeTrackingMode(substanceId)) {
        const selected = getSelectedVapePurchaseId();
        if (selected) return selected;
        const logDate = document.getElementById('use-date')?.value || getLocalDateString();
        const purchase = findVapePurchaseForLogDate(substanceId, logDate);
        return purchase?.id ?? null;
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
    if (log.logMode === 'vape_puffs' || log.logMode === 'percent_remaining') {
        const pid = getLogPurchaseId(log);
        if (pid) recalculateVapePurchaseInventory(pid, data, { excludeLogId: log.id });
        return;
    }
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
    } else {
        const pid = getLogPurchaseId(log);
        if (pid) {
            const purchase = findPurchaseInData(pid, { purchases });
            applyRestore(purchase, parseFloat(log.amount) || 0);
        }
    }
}

function restoreLogSupplyLinks(log, data = appData) {
    restoreLogInventoryEffect(log, data);
    setLogPurchaseId(log, null);
}

function getPurchasesForManualLink(substanceId) {
    return (appData.purchases || [])
        .filter(p => getPurchaseSubstanceId(p) === substanceId)
        .sort((a, b) => getPurchaseDatetimeMs(b) - getPurchaseDatetimeMs(a));
}

function applyLogLinkAllocations(log, allocations, { forceSplitArray = false } = {}) {
    if (allocations.length === 1 && !forceSplitArray) {
        setLogPurchaseId(log, allocations[0].purchaseId);
    } else if (allocations.length >= 1) {
        log.linkedPurchases = allocations;
        log.purchaseId = null;
        log.linkedPurchaseId = null;
        log.inventoryAffects = true;
        log.supplyUnlinked = false;
    } else {
        setLogPurchaseId(log, null);
    }
}

function setLogPurchaseLink(log, purchaseId, amount, { split = false } = {}) {
    const amt = parseFloat(amount) || 0;
    log.updatedAt = new Date().toISOString();
    if (split) {
        log.purchaseId = null;
        log.linkedPurchaseId = null;
        log.linkedPurchases = [{ purchaseId, amountUsed: amt }];
        log.inventoryAffects = true;
        log.supplyUnlinked = false;
    } else {
        setLogPurchaseId(log, purchaseId);
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
            error: `Only ${formatAmount(remaining)} ${purchase.unit || 'units'} left in that inventory item.`
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
        const dateStr = getLocalDateString(d);
        total += isVapeNicotineSubstanceId(substanceId)
            ? getStatsUsageOnDate(substanceId, dateStr)
            : getUsedAmount(substanceId, dateStr);
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
        else linkLabel.textContent = 'Use From Inventory';
    }

    const isVapeUse = isVapeSessionFormActive();

    if (manualWrap) manualWrap.classList.toggle('hidden', mode !== 'manual' && !isVapeUse);

    if ((mode === 'manual' || isVapeUse) && select && substanceId) {
        let active = addsInventory
            ? getPurchasesForManualLink(substanceId)
            : getActivePurchasesForSubstance(substanceId);
        if (editingUseId) {
            const entry = findUseEntry(editingUseId);
            const linkedIds = new Set();
            const entryPid = getLogPurchaseId(entry);
            if (entryPid) linkedIds.add(String(entryPid));
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
            if (isVapeUse) {
                const id = select?.value;
                const bag = id ? findPurchase(parsePurchaseSelectId(id)) : null;
                preview.textContent = bag
                    ? `Using: ${formatPurchaseOptionLabel(bag)}`
                    : 'Select a vape inventory item for this log.';
                preview.classList.remove('hidden');
            } else {
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
            }
        } else if (mode === 'manual') {
            const id = select?.value;
            const purchaseId = id ? parsePurchaseSelectId(id) : null;
            const amount = parseFloat(document.getElementById('use-amount')?.value) || 0;
            const unit = document.getElementById('use-unit')?.value || 'units';
            if (purchaseId) {
                const previewLog = {
                    purchaseId,
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

    syncWeedProductTypeFromPurchase();
}

function updateCurrentSupplyDashboard() {
    const set = (id, text) => { const el = document.getElementById(id); if (el) el.textContent = text; };
    const titleEl = document.getElementById('dash-supply-card-title');
    const standardRows = document.getElementById('dash-supply-rows-standard');
    const allContainer = document.getElementById('dash-supply-all-substances');

    if (isAllSubstancesView()) {
        if (titleEl) titleEl.textContent = 'Current Inventory by Substance';
        standardRows?.classList.add('hidden');
        allContainer?.classList.remove('hidden');
        renderAllSubstancesInventoryDashboard(allContainer);
        return;
    }

    if (titleEl) titleEl.textContent = 'Current Inventory';
    standardRows?.classList.remove('hidden');
    allContainer?.classList.add('hidden');

    const substanceId = currentSubstanceId;
    if (!substanceId || substanceId === DASHBOARD_ALL) {
        set('dash-supply-total', '—');
        set('dash-supply-remaining', '—');
        set('dash-supply-days-left', '—');
        set('dash-supply-last-buy-date', '—');
        set('dash-supply-last-used', '—');
        set('dash-supply-since-last-use', '—');
        return;
    }
    const sub = getSubstance(substanceId);
    const unit = getSubstanceDisplayUnit(substanceId);
    const totalRemaining = getTotalRemainingSupply(substanceId);
    const purchases = (appData.purchases || [])
        .filter(p => getPurchaseSubstanceId(p) === substanceId)
        .sort((a, b) => getPurchaseDatetimeMs(b) - getPurchaseDatetimeMs(a));
    const lastPurchase = purchases[0] || null;
    const dailyAvg = getAverageDailyUse(substanceId);

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

    const currentBag = getOldestActivePurchase(substanceId);
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
}

function editUseEntry(id) {
    const entry = findUseEntry(id);
    if (!entry) return;

    editingUseId = id;
    const isVape = isVapeUseLog(entry);
    const isWeed = isWeedTrackingMode(getUseSubstanceId(entry));
    if (isVape) {
        setUseTransactionType('use');
        setUseLogType('quick');
    } else if (isWeed) {
        setUseTransactionType(getLogTransactionType(entry));
        setUseLogType('quick');
        if (isInventoryAdjustmentLog(entry)) {
            setUseAdjustmentDirection(getAdjustmentDirection(entry));
        }
    } else {
        setUseTransactionType(getLogTransactionType(entry));
        setUseLogType(getUseLogType(entry));
        if (isInventoryAdjustmentLog(entry)) {
            setUseAdjustmentDirection(getAdjustmentDirection(entry));
        }
    }

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
    if (isWeed || isVape) {
        if (isWeed) {
            setInputValue('use-weed-product-type', entry.weedProductType || 'bud');
        }
        setInputValue('use-start-time', '');
        setInputValue('use-end-date', '');
        setInputValue('use-end-time', '');
        updateVapeUseFormUI();
    } else {
        setInputValue('use-start-time', entry.startTime || entry.time || '12:00');
        setInputValue('use-end-date', entry.endDate || entry.date || '');
        setInputValue('use-end-time', entry.endTime || '');
        if (entry.startedAt) {
            const started = new Date(entry.startedAt);
            if (!Number.isNaN(started.getTime())) {
                setInputValue('use-date', getLocalDateString(started));
                setInputValue('use-start-time', getLocalTimeString(started));
            }
        }
        if (entry.endedAt) {
            const ended = new Date(entry.endedAt);
            if (!Number.isNaN(ended.getTime())) {
                setInputValue('use-end-date', getLocalDateString(ended));
                setInputValue('use-end-time', getLocalTimeString(ended));
            }
        }
    }
    if (isVape) {
        setInputValue('use-percent-after', entry.percentLeftAfter ?? entry.percentRemaining ?? '');
        if (entry.logMode === 'vape_puffs' && !entry.estimatedFromPercent && entry.amount != null) {
            setVapeLogInputMode('puffs');
            setInputValue('use-vape-puffs-used', entry.amount);
        } else {
            setVapeLogInputMode('percent');
        }
        updateVapeUsePreview();
    } else {
        setInputValue('use-amount', entry.amount != null ? entry.amount : '');
        setInputValue('use-percent-after', '');
    }
    setInputValue('use-count', getUseCount(entry));
    setInputValue('use-notes', entry.notes || '');
    setInputValue('use-gift-party', entry.giftPartyName || '');

    if (isVapeUseLog(entry)) {
        setUsePurchaseLinkMode(hasLinkedSupply(entry) ? 'manual' : 'none');
        updateUsePurchaseLinkUI();
        const select = document.getElementById('use-purchase-select');
        if (select && hasLinkedSupply(entry)) {
            const linkedId = getLogPurchaseId(entry);
            if (linkedId != null && linkedId !== '') {
                const match = [...select.options].find(o => String(o.value) === String(linkedId));
                if (match) select.value = match.value;
            }
        }
    } else if (isWeed) {
        updateVapeUseFormUI();
        if (!hasLinkedSupply(entry) && !logInventoryAffects(entry)) {
            setUsePurchaseLinkMode('none');
        } else if (hasLinkedSupply(entry)) {
            setUsePurchaseLinkMode('manual');
            const select = document.getElementById('use-purchase-select');
            updateUsePurchaseLinkUI();
            if (select) {
                const linkedId = getLogPurchaseId(entry) || entry.linkedPurchases?.[0]?.purchaseId;
                if (linkedId != null && linkedId !== '') {
                    const match = [...select.options].find(o => String(o.value) === String(linkedId));
                    if (match) select.value = match.value;
                }
            }
        } else {
            setUsePurchaseLinkMode('auto');
        }
    } else if (!hasLinkedSupply(entry) && !logInventoryAffects(entry)) {
        setUsePurchaseLinkMode('none');
    } else if (hasLinkedSupply(entry)) {
        setUsePurchaseLinkMode('manual');
        const select = document.getElementById('use-purchase-select');
        updateUsePurchaseLinkUI();
        if (select) {
            const linkedId = getLogPurchaseId(entry) || entry.linkedPurchases?.[0]?.purchaseId;
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
    setUsePurchaseLinkMode('auto');
    setUseTransactionType('use');
    setUseAdjustmentDirection('add');
    updateVapeUseFormUI();
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
    const ended = getUseLogEndedAt(entry);
    if (ended) return ended;
    return getUseLogStartedAt(entry);
}

function enrichUseEntry(entry, previousEntry) {
    const isGift = !isPersonalUseLog(entry);
    const isWeedSimple = isWeedDateOnlyUseLog(entry);
    const isVapeDateOnly = isVapeDateOnlyUseLog(entry);
    const startTime = entry.startTime || entry.time;
    const start = getUseLogStartedAt(entry);
    let end = getUseLogEndedAt(entry);
    let durationHours = null;
    let startDatetime = start ? start.toISOString() : null;
    let endDatetime = end ? end.toISOString() : null;

    if (!isWeedSimple && !isVapeDateOnly) {
        if (entry.durationMs != null && entry.durationMs > 0) {
            durationHours = entry.durationMs / 3600000;
        } else if (end && start) {
            durationHours = (end - start) / 3600000;
        }
    }

    const amount = parseFloat(entry.amount) || 0;
    const useRate = (!isWeedSimple && !isVapeDateOnly && durationHours > 0) ? amount / durationHours : null;

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
        type: entry.type || (isGift ? 'quick' : (entry.endTime ? 'session' : 'quick')),
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
    const today = getLocalDateString();
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

function isNonUseTransactionType(tx) {
    return tx === 'gift_given' || tx === 'gift_received' || tx === 'inventory_adjustment';
}

function updateUseEndTimeVisibility() {
    if (isWeedDateOnlyUseForm() || isVapeDateOnlyUseForm()) {
        document.getElementById('use-end-date-group')?.classList.add('hidden');
        document.getElementById('use-end-time-group')?.classList.add('hidden');
        return;
    }
    const tx = document.getElementById('use-transaction-type')?.value || 'use';
    const isNonUse = isNonUseTransactionType(tx);
    const type = document.getElementById('use-type')?.value || 'quick';
    const showEnd = type === 'session' || isNonUse;
    document.getElementById('use-end-time-group')?.classList.toggle('hidden', !showEnd);
    document.getElementById('use-end-date-group')?.classList.add('hidden');
    document.querySelectorAll('.use-end-time-field').forEach(el => {
        el.classList.toggle('session-end-span', showEnd && !isNonUse && type === 'session');
    });
}

function setUseLogType(type) {
    if (isWeedDateOnlyUseForm() || isVapeDateOnlyUseForm()) {
        type = 'quick';
    }
    const hidden = document.getElementById('use-type');
    if (hidden) hidden.value = type;
    document.querySelectorAll('.use-entry-toggle-btn, .type-toggle-btn').forEach(btn => {
        btn.classList.toggle('active', btn.dataset.type === type);
    });
    const tx = document.getElementById('use-transaction-type')?.value || 'use';
    if (type === 'quick' && !isNonUseTransactionType(tx) && !isVapeSessionFormActive()) {
        const endEl = document.getElementById('use-end-time');
        if (endEl) endEl.value = '';
    }
    updateUseEndTimeVisibility();
    computeUseFormDuration();
}

function setDefaultUseLogDateTime() {
    const now = new Date();
    const dateStr = getLocalDateString(now);
    const timeStr = getLocalTimeString(now);
    const dateEl = document.getElementById('use-date');
    const startEl = document.getElementById('use-start-time');
    const endDateEl = document.getElementById('use-end-date');
    const endTimeEl = document.getElementById('use-end-time');
    if (dateEl) dateEl.value = dateStr;
    if (startEl) startEl.value = timeStr;
    if (endDateEl) {
        endDateEl.value = dateStr;
        endDateEl.dataset.syncedStart = dateStr;
    }
    if (endTimeEl && !isVapeDateOnlyUseForm()) endTimeEl.value = timeStr;
}

function setupUseLogForm() {
    const form = document.getElementById('use-log-form');
    if (!form) return;
    form.addEventListener('submit', handleUseLogSubmit);
    document.getElementById('use-substance')?.addEventListener('change', () => {
        updateUseUnitDropdown();
        updateUsePurchaseLinkUI();
    });
    document.getElementById('use-unit')?.addEventListener('change', () => {
        updateVapeUseFormUI();
    });
    ['use-amount', 'use-date', 'use-end-date', 'use-percent-after', 'use-vape-puffs-used'].forEach(id => {
        document.getElementById(id)?.addEventListener('input', () => {
            if (id === 'use-date') syncVapeEndDateDefault();
            updateUsePurchaseLinkUI();
            updateVapeUsePreview();
            computeUseFormDuration();
        });
    });
    document.getElementById('use-vape-purchase-select')?.addEventListener('change', () => {
        const manual = document.getElementById('use-purchase-select');
        const vapeSel = document.getElementById('use-vape-purchase-select');
        if (manual && vapeSel?.value) manual.value = vapeSel.value;
        updateVapePurchaseSelectDetails();
        updateVapeUsePreview();
    });
    document.getElementById('use-start-time')?.addEventListener('change', () => {
        computeUseFormDuration();
        updateVapeUsePreview();
    });
    document.getElementById('use-end-time')?.addEventListener('change', () => {
        computeUseFormDuration();
        updateVapeUsePreview();
    });
    document.getElementById('use-end-date')?.addEventListener('change', () => {
        computeUseFormDuration();
        updateVapeUsePreview();
    });
    document.getElementById('use-purchase-link-mode')?.addEventListener('change', () => {
        updateUsePurchaseLinkUI();
        updateVapeUsePreview();
    });
    document.getElementById('use-purchase-select')?.addEventListener('change', () => {
        updateUsePurchaseLinkUI();
        updateVapeUsePreview();
    });
    document.getElementById('use-weed-product-type')?.addEventListener('change', () => {
        updateWeedUseFormUI();
        updateUsePurchaseLinkUI();
    });
    setUseLogType(document.getElementById('use-type')?.value || 'quick');
    updateVapeUseFormUI();
    updateUsePurchaseLinkUI();
}

function computeUseFormDuration() {
    if (isWeedDateOnlyUseForm() || isVapeDateOnlyUseForm()) {
        document.getElementById('use-duration-preview')?.classList.add('hidden');
        return;
    }
    const startDate = document.getElementById('use-date')?.value;
    const endDate = document.getElementById('use-end-date')?.value || startDate;
    const start = document.getElementById('use-start-time')?.value;
    const end = document.getElementById('use-end-time')?.value;
    const preview = document.getElementById('use-duration-preview');
    if (!preview) return;
    const showForVape = false;
    const showForSession = (document.getElementById('use-type')?.value || 'quick') === 'session';
    if (!startDate || !start || !end || (!showForVape && !showForSession)) {
        preview.classList.add('hidden');
        return;
    }
    const { start: s, end: e } = parseUseSessionEndDateTime(startDate, start, endDate, end);
    if (!s || !e) {
        preview.classList.add('hidden');
        return;
    }
    const hours = (e - s) / 3600000;
    preview.textContent = `Duration: ${formatDurationHours(hours)}`;
    preview.classList.remove('hidden');
}

function getQuickLogSubstanceId() {
    return pickSubstanceForQuickAction('Quick Use — choose substance');
}

function logOneUse() {
    const substanceId = getQuickLogSubstanceId();
    if (!substanceId) return;
    const sub = getSubstance(substanceId);
    if (!sub) return alert('Add an active substance first.');
    if (isVapeTrackingMode(substanceId)) {
        setSelectedSubstanceId(substanceId, { source: 'use-log-substance', refresh: false });
        switchTab('use-log-tab');
        setDefaultVapeUseLogDate();
        ensureVapeUseFormDefaults();
        updateVapeUseFormUI();
        document.getElementById('use-log-form')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
        return;
    }
    if (isWeedTrackingMode(substanceId)) {
        setSelectedSubstanceId(substanceId, { source: 'use-log-substance', refresh: false });
        switchTab('use-log-tab');
        setDefaultWeedUseLogDate();
        ensureWeedUseFormDefaults();
        updateVapeUseFormUI();
        document.getElementById('use-log-form')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
        return;
    }
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
        date: getLocalDateString(now),
        startTime: getLocalTimeString(now),
        time: getLocalTimeString(now),
        notes: '',
        purchaseId: linkedPurchaseId,
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
            setLogPurchaseId(log, null);
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
    alert(`Logged 1 ${sub.defaultUnit} of ${sub.name}`);
}

function openUseLogSession() {
    switchTab('use-log-tab');
    setUseLogType('session');
    const id = pickSubstanceForQuickAction('Session — choose substance');
    if (id) setInputValue('use-substance', id);
    setDefaultUseLogDateTime();
    updateUseUnitDropdown();
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

    const substanceIdPreview = document.getElementById('use-substance')?.value;
    const isVapeUse = isVapeTrackingMode(substanceIdPreview);
    let vapeCalc = null;

    if (isVapeUse) {
        vapeCalc = computeVapeUseFromForm({ editingId: editingUseId || null });
        if (vapeCalc?.error) return alert(vapeCalc.error);
        const tx = document.getElementById('use-transaction-type')?.value || 'use';
        if (vapeCalc.puffsUsed < 0 && tx === 'use') {
            return alert(vapeCalc.warning || 'Percent left is higher than current inventory. This will be treated as an adjustment unless you choose a different vape.');
        }
    }

    const payload = buildUseEntryFromForm(vapeCalc);
    const { substanceId, amount, type, transactionType } = payload;
    const isPersonalUse = isPersonalUseLog({ transactionType });
    const eventTimestamp = getUseEventTimestamp(payload.date, payload.startTime);
    const now = new Date().toISOString();
    const useVapeInventory = isVapeUse && vapeCalc?.purchase && payload.inventoryAffects;

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
        const oldPid = getLogPurchaseId(existing);
        const isVapeEdit = isVapeUseLog(existing) || useVapeInventory;

        if (!isVapeEdit) {
            restoreLogInventoryEffect(existing);
        }

        const updated = {
            ...existing,
            ...payload,
            id: editingUseId,
            substanceId: payload.substanceId,
            purchaseId: payload.inventoryAffects ? (payload.purchaseId ?? payload.linkedPurchaseId) : null,
            linkedPurchaseId: payload.inventoryAffects ? payload.linkedPurchaseId : null,
            inventoryId: payload.inventoryAffects ? (payload.inventoryId ?? payload.linkedPurchaseId) : null,
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
        if (isWeedTrackingMode(substanceId)) {
            updated.type = 'quick';
            updated.logMode = 'amount';
            updated.startTime = '';
            updated.time = '';
            updated.endTime = '';
            delete updated.endDate;
            delete updated.startedAt;
            delete updated.endedAt;
            delete updated.durationMs;
        }
        if (isVapeTrackingMode(substanceId)) {
            updated.type = 'quick';
            updated.logMode = 'vape_puffs';
            updated.startTime = '';
            updated.time = '';
            updated.endTime = '';
            delete updated.endDate;
            delete updated.startedAt;
            delete updated.endedAt;
            delete updated.durationMs;
            delete updated.estimatedPuffsPerHour;
            delete updated.estimatedPuffsPerMinute;
        }

        if (isVapeEdit || useVapeInventory) {
            setLogPurchaseId(updated, getLogPurchaseId(updated));
            appData.logs[idx] = updated;
            const recalcIds = new Set();
            if (oldPid != null) recalcIds.add(oldPid);
            const newPid = getLogPurchaseId(updated);
            if (newPid != null) recalcIds.add(newPid);
            recalcIds.forEach(pid => recalculateVapePurchaseInventory(pid));
        } else {
            const inv = applyLogInventoryEffect(updated);
            if (!inv.ok) {
                applyExistingLogLinks(priorState, appData.purchases || []);
                Object.assign(existing, priorState);
                return alert(inv.error);
            }
            appData.logs[idx] = updated;
        }

        saveData(appData);
        refreshAfterLogLinkChange(substanceId);
        resetUseFormAfterSave();
        populateAllSubstanceDropdowns();
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
    if (isWeedTrackingMode(substanceId)) {
        log.type = 'quick';
        log.logMode = 'amount';
        log.startTime = '';
        log.time = '';
        log.endTime = '';
        delete log.endDate;
        delete log.startedAt;
        delete log.endedAt;
        delete log.durationMs;
    }
    if (isVapeTrackingMode(substanceId)) {
        log.type = 'quick';
        log.logMode = 'vape_puffs';
        log.startTime = '';
        log.time = '';
        log.endTime = '';
        delete log.endDate;
        delete log.startedAt;
        delete log.endedAt;
        delete log.durationMs;
        delete log.estimatedPuffsPerHour;
        delete log.estimatedPuffsPerMinute;
    }

    if (!Array.isArray(appData.logs)) appData.logs = [];
    appData.logs.push(log);

    if (useVapeInventory && vapeCalc.purchaseId) {
        setLogPurchaseId(log, vapeCalc.purchaseId);
        recalculateVapePurchaseInventory(vapeCalc.purchaseId);
    } else if (!useVapeInventory) {
        const inv = applyLogInventoryEffect(log);
        if (!inv.ok) {
            appData.logs.pop();
            return alert(inv.error);
        }
    }

    saveData(appData);
    resetUseFormAfterSave();
    populateAllSubstanceDropdowns();
    refreshUseLogRelatedViews();
    alert(getUseSaveSuccessMessage(log));
}

function deleteUseEntry(id) {
    if (!confirm('Delete this entry?')) return;
    const entry = findUseEntry(id);
    if (editingUseId === id) cancelUseEdit();
    const vapePid = entry && isVapeUseLog(entry) ? getLogPurchaseId(entry) : null;
    if (entry && !vapePid) restoreLogSupplyLinks(entry);
    appData.logs = getUseEntries().filter(l => l.id !== id && String(l.id) !== String(id));
    if (vapePid) recalculateVapePurchaseInventory(vapePid);
    saveData(appData);
    refreshUseLogRelatedViews();
}

function renderUseLogTab() {
    renderUseLogTotals();
    renderRecentUseList();
    renderUseHistoryTable();
}

let bulkLinkPending = null;
const useHistorySelection = new Set();

function useHistorySelectionHas(id) {
    if (useHistorySelection.has(id)) return true;
    return [...useHistorySelection].some(sid => String(sid) === String(id));
}

function buildUseHistoryRows(substanceIdOverride = null) {
    const entries = getUseEntries();
    const filterId = substanceIdOverride ?? getUseLogViewSubstanceId();
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

    allRows = allRows.filter(({ entry }) => logMatchesUseLogFilter(entry));

    allRows.sort((a, b) => {
        const da = getLogDatetimeMs(a.entry);
        const db = getLogDatetimeMs(b.entry);
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

    let defaultId = selectedSubstanceId;
    if (!isSelectedAllSubstances() && subs.some(s => s.id === selectedSubstanceId)) {
        defaultId = selectedSubstanceId;
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
            setLogPurchaseId(log, null);
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
            delete log.purchaseId;
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
    if (isWeedDateOnlyUseLog(log)) return { label: 'Use', className: 'badge-quick' };
    if (getUseLogType(log) === 'session') return { label: 'Session', className: 'badge-session' };
    return { label: 'Quick Use', className: 'badge-quick' };
}

function renderUseLogBadge(log) {
    const { label, className } = getUseLogBadgeInfo(log);
    return `<span class="use-log-badge ${className}">${label}</span>`;
}

function renderUseHistoryCard(entry, sub, avgRate) {
    const warnings = getUseRowWarnings(entry, sub.id, avgRate);
    const isWeedSimple = isWeedDateOnlyUseLog(entry);
    const isVapeDateOnly = isVapeDateOnlyUseLog(entry);
    const hideTimeStats = isWeedSimple || isVapeDateOnly;
    const rateStr = (!hideTimeStats && entry.useRate != null) ? `${entry.useRate.toFixed(2)}/${sub.defaultUnit}/hr` : '—';
    const checked = useHistorySelectionHas(entry.id) ? 'checked' : '';
    const timeRange = hideTimeStats ? '' : (entry.endTime
        ? `${entry.startTime || entry.time || '—'} – ${entry.endTime}`
        : (entry.startTime || entry.time || '—'));
    const isVape = isVapeUseLog(entry);
    const countStr = isVape ? '—' : (entry.count || '—');
    const amountDisplay = isVape ? formatVapeUseSummary(entry, sub) : `${entry.amount} ${entry.unit}`;
    const warningClass = warnings.length ? ` ${warnings.join(' ')}` : '';

    return `<article class="use-history-card${warningClass}" data-log-id="${entry.id}">
        <div class="use-history-card-top">
            <label class="use-history-card-check">
                <input type="checkbox" class="use-history-row-cb" data-log-id="${entry.id}" aria-label="Select entry" ${checked}>
            </label>
            <div class="use-history-card-main">
                <div class="use-history-card-title-row">
                    ${renderUseLogBadge(entry)}
                    <span class="use-history-card-amount">${amountDisplay}</span>
                </div>
                <div class="use-history-card-meta">${sub.icon} ${sub.name} · ${formatDate(entry.date)}${timeRange ? ` · ${timeRange}` : ''}</div>
            </div>
        </div>
        <dl class="use-history-card-details">
            ${hideTimeStats ? '' : `<div><dt>Duration</dt><dd>${formatDurationHours(entry.durationHours)}</dd></div>`}
            <div><dt>Count</dt><dd>${countStr}</dd></div>
            ${hideTimeStats ? '' : `<div><dt>Rate</dt><dd>${rateStr}</dd></div>`}
            ${hideTimeStats ? '' : `<div><dt>Break</dt><dd>${entry.breakText || '—'}</dd></div>`}
            <div class="use-history-card-supply"><dt>Supply</dt><dd>${isVape ? formatVapeLinkedPurchaseLine(entry) || formatInventoryLinkDisplay(entry) : formatInventoryLinkDisplay(entry)}</dd></div>
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
    const filterId = getUseLogViewSubstanceId();
    let list = [...getUseEntries()].filter(l => logMatchesUseLogFilter(l));
    if (filterId) list = list.filter(l => logMatchesSubstance(l, filterId));
    const recent = list.sort((a, b) => getLogDatetimeMs(b) - getLogDatetimeMs(a)).slice(0, 12);
    if (!recent.length) {
        container.innerHTML = '<p class="empty-hint">No use entries yet</p>';
        applyCollapsedSections();
        return;
    }
    recent.forEach(log => {
        const substanceId = getUseSubstanceId(log);
        const sub = getSubstance(substanceId);
        const enriched = enrichUseEntry(log, null);
        const isVape = isVapeUseLog(log);
        const countStr = getUseCount(log);
        const timeRange = log.endTime
            ? `${log.startTime || log.time || ''}–${log.endTime}`
            : (log.startTime || log.time || '');
        const amountDisplay = isVape
            ? ''
            : `${log.amount != null ? formatAmount(log.amount) : '—'} ${log.unit || ''}`;
        const vapeDetailHtml = isVape
            ? formatVapeRecentUseDetailLines(log).map(line => `<div class="use-recent-detail">${line}</div>`).join('')
            : '';
        const linkedLine = isVape ? formatVapeLinkedPurchaseLine(log) : formatInventoryLinkDisplay(log);
        const item = document.createElement('div');
        item.className = 'use-recent-card';
        item.innerHTML = `
            <div class="use-recent-main">
                <div class="use-recent-top">
                    ${renderUseLogBadge(log)}
                    ${amountDisplay ? `<span class="use-recent-amount">${amountDisplay}</span>` : ''}
                </div>
                <div class="use-recent-sub">${sub?.icon || ''} ${sub?.name || 'Unknown'} · ${formatDate(log.date || '')}${timeRange ? ` · ${timeRange}` : ''}</div>
                ${vapeDetailHtml}
                ${!isVape && enriched.durationHours ? `<div class="use-recent-detail">${formatDurationHours(enriched.durationHours)}</div>` : ''}
                ${!isVape && formatSecondaryCountDisplay(substanceId, countStr) ? `<div class="use-recent-detail">${formatSecondaryCountDisplay(substanceId, countStr)}</div>` : ''}
                ${log.notes ? `<div class="use-recent-notes">${log.notes}</div>` : ''}
                ${log.mood ? `<div class="use-recent-detail">Mood: ${log.mood}</div>` : ''}
                ${log.trigger ? `<div class="use-recent-detail">Trigger: ${log.trigger}</div>` : ''}
                ${log.cravingLevel != null ? `<div class="use-recent-detail">Craving: ${log.cravingLevel}/10</div>` : ''}
                ${log.stressLevel != null ? `<div class="use-recent-detail">Stress: ${log.stressLevel}/10</div>` : ''}
                <div class="use-recent-supply">${linkedLine}</div>
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

function renderUseHistoryTable(options = {}) {
    const {
        wrapId = 'use-history-table-wrap',
        substanceId = null,
        showLegend = true
    } = typeof options === 'object' ? options : { wrapId: options };
    const wrap = document.getElementById(wrapId);
    if (!wrap) return;

    const allRows = buildUseHistoryRows(substanceId);

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

    const legendHtml = showLegend ? `<div class="session-legend use-history-legend">
        <span class="legend-high-rate">High rate</span>
        <span class="legend-short-break">Short break</span>
        <span class="legend-long-break">Long break</span>
        <span class="legend-taper-close">Near taper limit</span>
    </div>` : '';

    wrap.innerHTML = tableHtml + cardsHtml + legendHtml;
    updateUseHistorySelectionUI();
    syncUseHistorySelectAllCheckbox();
    applyCollapsedSections();
}

function getTodayUseStats(substanceId) {
    const today = getLocalDateString();
    const logs = filterLogsBySubstance(
        getUseEntries().filter(l => l.date === today && isPersonalUseLog(l)),
        substanceId
    );
    const stats = calculateUseStats(logs);
    return {
        logs,
        totalAmount: stats.totalAmount,
        sessionCount: stats.sessionCount,
        totalDurationMinutes: stats.totalDurationMinutes,
        totalDurationHours: stats.totalDurationMinutes / 60,
        avgPerSession: stats.avgPerSession,
        sessionDuration: stats.totalDurationMinutes / 60
    };
}

function formatTodayDuration(hours) {
    if (hours == null || isNaN(hours) || hours <= 0) return '0h 0m';
    return formatDurationHours(hours);
}

function aggregateTodayUseStats() {
    let totalAmount = 0;
    let sessionCount = 0;
    let totalDurationMinutes = 0;
    getActiveSubstances().forEach(sub => {
        const stats = getTodayUseStats(sub.id);
        totalAmount += stats.totalAmount;
        sessionCount += stats.sessionCount;
        totalDurationMinutes += stats.totalDurationMinutes;
    });
    return {
        totalAmount,
        sessionCount,
        totalDurationMinutes,
        totalDurationHours: totalDurationMinutes / 60,
        avgPerSession: sessionCount > 0 ? totalAmount / sessionCount : null
    };
}

function getTimeSinceLastUse(substanceId) {
    const logs = filterLogsBySubstance(getUseEntries().filter(isPersonalUseLog), substanceId);
    if (!logs.length) return null;
    const sorted = logs.sort((a, b) => getLogDatetimeMs(b) - getLogDatetimeMs(a));
    const last = sorted[0];
    if (isWeedTrackingMode(substanceId)) {
        const day = parseLocalDate(last.date);
        if (day) {
            const endOfDay = new Date(day);
            endOfDay.setHours(23, 59, 59, 999);
            return Date.now() - endOfDay.getTime();
        }
    }
    const end = getUseEndDatetime(enrichUseEntry(last, null));
    if (!end) return null;
    return Date.now() - end.getTime();
}

// ——— Buy Tracker ———
function getPurchasesFiltered(substanceId) {
    return getInventoryFilteredPurchases(substanceId);
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

const BUY_STORE_ADD_NEW = '__add_new_store__';

function normalizeStoreName(name) {
    if (name == null) return '';
    return String(name).trim().replace(/\s+/g, ' ');
}

function getStoreDedupeKey(name) {
    return normalizeStoreName(name).toLowerCase();
}

function getSavedStoreNames(data = appData) {
    const byKey = new Map();
    const purchases = [...(data?.purchases || [])].sort((a, b) => getPurchaseDatetimeMs(b) - getPurchaseDatetimeMs(a));
    purchases.forEach(purchase => {
        const normalized = normalizeStoreName(purchase.store || purchase.location || '');
        if (!normalized) return;
        const key = getStoreDedupeKey(normalized);
        if (!byKey.has(key)) byKey.set(key, normalized);
    });
    return [...byKey.values()].sort((a, b) => a.localeCompare(b, undefined, { sensitivity: 'base' }));
}

function updateBuyStoreNewFieldVisibility() {
    const select = document.getElementById('buy-store-select');
    const group = document.getElementById('buy-store-new-group');
    const isAddNew = select?.value === BUY_STORE_ADD_NEW;
    group?.classList.toggle('hidden', !isAddNew);
    if (!isAddNew) {
        const newInput = document.getElementById('buy-store-new');
        if (newInput) newInput.value = '';
    }
}

function populateBuyStoreDropdown(selectedValue = '') {
    const select = document.getElementById('buy-store-select');
    if (!select) return;

    const normalized = normalizeStoreName(selectedValue);
    let stores = getSavedStoreNames();
    if (normalized && !stores.some(s => getStoreDedupeKey(s) === getStoreDedupeKey(normalized))) {
        stores = [...stores, normalized].sort((a, b) => a.localeCompare(b, undefined, { sensitivity: 'base' }));
    }

    select.innerHTML = '';
    const addOption = (value, label) => {
        const opt = document.createElement('option');
        opt.value = value;
        opt.textContent = label;
        select.appendChild(opt);
    };

    addOption('', '— Select store/location —');
    stores.forEach(store => addOption(store, store));
    addOption(BUY_STORE_ADD_NEW, '+ Add new store/location');

    if (normalized) {
        const match = [...select.options].find(o =>
            o.value && o.value !== BUY_STORE_ADD_NEW && getStoreDedupeKey(o.value) === getStoreDedupeKey(normalized)
        );
        if (match) {
            select.value = match.value;
        } else {
            select.value = BUY_STORE_ADD_NEW;
            const newInput = document.getElementById('buy-store-new');
            if (newInput) newInput.value = normalized;
        }
    } else {
        select.value = '';
    }

    updateBuyStoreNewFieldVisibility();
}

function setBuyStoreFieldValue(value) {
    populateBuyStoreDropdown(value);
}

function getBuyFormStoreValue() {
    const select = document.getElementById('buy-store-select');
    const value = select?.value || '';
    if (value === BUY_STORE_ADD_NEW) {
        return normalizeStoreName(document.getElementById('buy-store-new')?.value);
    }
    return normalizeStoreName(value);
}

function resetBuyStoreField() {
    populateBuyStoreDropdown('');
}

function onBuyStoreSelectChange() {
    updateBuyStoreNewFieldVisibility();
}

function setDefaultBuyDateTime() {
    const now = new Date();
    const dateStr = getLocalDateString(now);
    const timeStr = getLocalTimeString(now);
    const dateEl = document.getElementById('buy-date');
    if (dateEl) dateEl.value = dateStr;
    const timeEl = document.getElementById('buy-time');
    if (timeEl) timeEl.value = timeStr;
}

function updateBuyVapeNicotinePreview() {
    const substanceId = document.getElementById('buy-substance')?.value;
    if (!isVapeNicotineSubstanceId(substanceId)) return;
    const preview = document.getElementById('buy-vape-nicotine-preview');
    if (!preview) return;
    const { eLiquidCapacityMl, nicotineMgPerMl, totalNicotineMg } = parseVapeNicotineFieldsFromForm();
    if (eLiquidCapacityMl != null && nicotineMgPerMl != null && totalNicotineMg != null) {
        preview.textContent = `${formatAmount(eLiquidCapacityMl)} mL × ${formatAmount(nicotineMgPerMl)} mg/mL = ${formatAmount(totalNicotineMg)} mg nicotine total.`;
    } else {
        preview.textContent = '—';
    }
}

function updateBuyVapeFieldsPreview() {
    const substanceId = document.getElementById('buy-substance')?.value;
    if (!isVapeNicotineSubstanceId(substanceId)) return;
    const full = parseFloat(document.getElementById('buy-quantity')?.value) || 0;
    const pctRaw = parseFloat(document.getElementById('buy-percent-bought')?.value);
    const percentBoughtAt = Number.isFinite(pctRaw) ? pctRaw : 100;
    const starting = computeVapeStartingPuffsFromForm(full, percentBoughtAt);
    const preview = document.getElementById('buy-vape-start-preview');
    if (preview) {
        preview.textContent = full > 0
            ? `${formatAmount(full)} puffs at ${percentBoughtAt}% = ${formatAmount(starting)} puffs starting left.`
            : '—';
    }
    updateBuyVapeNicotinePreview();
}

function updateBuyAlcoholPreview() {
    const substanceId = document.getElementById('buy-substance')?.value;
    if (!isAlcoholTrackingMode(substanceId)) return;
    const preview = document.getElementById('buy-alcohol-preview');
    if (!preview) return;
    const { netVolumeMl, alcoholPercent, pureAlcoholMl } = parseAlcoholFieldsFromForm();
    if (netVolumeMl != null && alcoholPercent != null && pureAlcoholMl != null) {
        preview.textContent = `${formatAmount(netVolumeMl)} mL × ${formatAmount(alcoholPercent)}% = ${formatAmount(pureAlcoholMl)} mL pure alcohol.`;
    } else {
        preview.textContent = '—';
    }
}

function updateBuyWeedPreRollPreview() {
    const preview = document.getElementById('buy-preroll-preview');
    if (!preview) return;
    const count = parseFloat(document.getElementById('buy-preroll-count')?.value);
    const grams = parseFloat(document.getElementById('buy-grams-per-preroll')?.value);
    const total = computeWeedTotalPreRollGrams(count, grams);
    if (total != null && count > 0 && grams > 0) {
        preview.textContent = `${formatAmount(count)} pre-rolls × ${formatAmount(grams)} g = ${formatAmount(total)} g total.`;
    } else {
        preview.textContent = '—';
    }
}

function updateBuyWeedProductTypeUI() {
    const substanceId = document.getElementById('buy-substance')?.value;
    if (!isWeedTrackingMode(substanceId)) return;
    const productType = document.getElementById('buy-weed-product-type')?.value || 'bud';
    const needsCountQty = productType === 'cart' || productType === 'edibles';
    const hideQty = productType === 'bud' || productType === 'prerolls';

    document.getElementById('buy-weed-bud-group')?.classList.toggle('hidden', productType !== 'bud');
    document.getElementById('buy-weed-cart-group')?.classList.toggle('hidden', productType !== 'cart');
    document.getElementById('buy-weed-edibles-group')?.classList.toggle('hidden', productType !== 'edibles');
    document.getElementById('buy-weed-prerolls-group')?.classList.toggle('hidden', productType !== 'prerolls');
    document.getElementById('buy-quantity-group')?.classList.toggle('hidden', hideQty);

    const qtyInput = document.getElementById('buy-quantity');
    const qtyLabel = document.getElementById('buy-quantity-label');
    if (qtyInput) qtyInput.required = needsCountQty;
    if (qtyLabel) {
        qtyLabel.textContent = needsCountQty ? 'Quantity (count)' : 'Quantity Bought';
    }

    const unitSelect = document.getElementById('buy-unit');
    if (unitSelect && (productType === 'bud' || productType === 'prerolls')) {
        if ([...unitSelect.options].some(o => o.value === 'grams')) {
            unitSelect.value = 'grams';
        }
    }

    updateBuyWeedPreRollPreview();
    updateBuyCostPerUnitPreview();
}

function updateBuyVapeFieldsVisibility() {
    const substanceId = document.getElementById('buy-substance')?.value;
    const isVape = isVapeTrackingMode(substanceId);
    const isAlcohol = isAlcoholTrackingMode(substanceId);
    const isWeed = isWeedTrackingMode(substanceId);
    const isCigarettes = isCigarettesTrackingMode(substanceId);
    document.getElementById('buy-vape-percent-group')?.classList.toggle('hidden', !isVape);
    document.getElementById('buy-vape-liquid-group')?.classList.toggle('hidden', !isVape);
    document.getElementById('buy-alcohol-fields-group')?.classList.toggle('hidden', !isAlcohol);
    document.getElementById('buy-weed-fields-group')?.classList.toggle('hidden', !isWeed);
    document.getElementById('buy-cigarettes-fields-group')?.classList.toggle('hidden', !isCigarettes);
    document.getElementById('buy-time-group')?.classList.toggle('hidden', isVape);
    if (!isWeed) {
        document.getElementById('buy-quantity-group')?.classList.remove('hidden');
        const qtyInput = document.getElementById('buy-quantity');
        if (qtyInput) qtyInput.required = true;
    }
    const qtyLabel = document.getElementById('buy-quantity-label');
    const primaryUnit = getSubstancePrimaryUnit(substanceId);
    if (qtyLabel && !isWeed) {
        qtyLabel.textContent = isVape
            ? 'Puff count at 100%'
            : (primaryUnit && primaryUnit !== 'units'
                ? `Quantity (${primaryUnit})`
                : 'Quantity Bought');
    }
    if (isVape) updateBuyVapeFieldsPreview();
    if (isAlcohol) updateBuyAlcoholPreview();
    if (isWeed) updateBuyWeedProductTypeUI();
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
    populateBuyStoreDropdown();
    updateBuyVapeFieldsVisibility();
    ['buy-quantity', 'buy-total-cost'].forEach(id => {
        document.getElementById(id)?.addEventListener('input', () => {
            updateBuyCostPerUnitPreview();
            updateBuyVapeFieldsPreview();
        });
    });
    document.getElementById('buy-percent-bought')?.addEventListener('input', updateBuyVapeFieldsPreview);
    ['buy-eliquid-capacity', 'buy-nicotine-strength'].forEach(id => {
        document.getElementById(id)?.addEventListener('input', updateBuyVapeNicotinePreview);
    });
    ['buy-alcohol-percent', 'buy-net-volume-ml'].forEach(id => {
        document.getElementById(id)?.addEventListener('input', updateBuyAlcoholPreview);
    });
    document.getElementById('buy-weed-product-type')?.addEventListener('change', updateBuyWeedProductTypeUI);
    ['buy-preroll-count', 'buy-grams-per-preroll'].forEach(id => {
        document.getElementById(id)?.addEventListener('input', () => {
            updateBuyWeedPreRollPreview();
            updateBuyCostPerUnitPreview();
        });
    });
    document.getElementById('buy-bud-grams')?.addEventListener('input', updateBuyCostPerUnitPreview);
    document.getElementById('buy-substance')?.addEventListener('change', updateBuyUnitDropdown);
    document.getElementById('buy-store-select')?.addEventListener('change', onBuyStoreSelectChange);
}

function buildPurchaseFromForm() {
    const quantity = parseFloat(document.getElementById('buy-quantity')?.value);
    const totalCost = parseFloat(document.getElementById('buy-total-cost')?.value);
    const substanceId = document.getElementById('buy-substance')?.value;
    const sub = getSubstance(substanceId);
    const qty = Number.isFinite(quantity) ? quantity : 0;
    const unit = document.getElementById('buy-unit')?.value || 'units';
    const isVape = isVapeTrackingMode(substanceId) && isVapePuffUnit(unit);
    const payload = {
        substanceId,
        substanceName: sub?.name || '',
        trackingMode: getSubstanceTrackingMode(substanceId),
        date: document.getElementById('buy-date')?.value,
        time: isVape ? '12:00' : (document.getElementById('buy-time')?.value || '12:00'),
        quantityBought: qty,
        quantity: qty,
        unit,
        totalCost: Number.isFinite(totalCost) ? totalCost : 0,
        costPerUnit: qty > 0 ? (Number.isFinite(totalCost) ? totalCost : 0) / qty : 0,
        store: getBuyFormStoreValue(),
        paymentMethod: document.getElementById('buy-payment')?.value || '',
        notes: document.getElementById('buy-notes')?.value || ''
    };
    if (isVape) {
        const percentRaw = parseFloat(document.getElementById('buy-percent-bought')?.value);
        const percentBoughtAt = Number.isFinite(percentRaw) ? Math.max(0, Math.min(100, percentRaw)) : 100;
        const startingPuffsLeft = computeVapeStartingPuffsFromForm(qty, percentBoughtAt);
        payload.fullPuffCount = qty;
        payload.percentBoughtAt = percentBoughtAt;
        payload.startingPuffsLeft = startingPuffsLeft;
        payload.remainingAmount = startingPuffsLeft;
        payload.remainingPuffs = startingPuffsLeft;
        const nicotine = parseVapeNicotineFieldsFromForm();
        payload.eLiquidCapacityMl = nicotine.eLiquidCapacityMl;
        payload.nicotineMgPerMl = nicotine.nicotineMgPerMl;
        payload.totalNicotineMg = nicotine.totalNicotineMg;
        payload.supplyStartedAt = null;
        payload.startedAt = null;
        payload.finishedAt = null;
    }
    if (isAlcoholTrackingMode(substanceId)) {
        applyAlcoholFieldsToPayload(payload, parseAlcoholFieldsFromForm());
    }
    if (isWeedTrackingMode(substanceId)) {
        const weedFields = parseWeedFieldsFromForm();
        applyWeedFieldsToPayload(payload, weedFields);
        applyWeedQuantityFromFields(payload, weedFields, payload.totalCost);
    }
    if (isCigarettesTrackingMode(substanceId)) {
        applyCigaretteFieldsToPayload(payload, parseCigaretteFieldsFromForm());
    }
    stripIrrelevantPurchaseFields(payload);
    return payload;
}

function finalizeNewPurchaseRecord(payload) {
    const now = new Date().toISOString();
    const isVape = isVapeTrackingMode(payload.substanceId) && isVapePuffUnit(payload.unit);
    const record = {
        ...payload,
        remainingAmount: isVape
            ? (payload.startingPuffsLeft ?? payload.remainingAmount ?? 0)
            : (payload.quantityBought ?? payload.quantity ?? 0),
        isDepleted: false,
        createdAt: now,
        updatedAt: now
    };
    if (isVape) {
        record.fullPuffCount = payload.fullPuffCount ?? payload.quantityBought;
        record.percentBoughtAt = payload.percentBoughtAt ?? 100;
        record.startingPuffsLeft = payload.startingPuffsLeft ?? record.remainingAmount;
        record.remainingPuffs = payload.remainingPuffs ?? record.remainingAmount;
        if (payload.eLiquidCapacityMl != null) record.eLiquidCapacityMl = payload.eLiquidCapacityMl;
        if (payload.nicotineMgPerMl != null) record.nicotineMgPerMl = payload.nicotineMgPerMl;
        if (payload.totalNicotineMg != null) record.totalNicotineMg = payload.totalNicotineMg;
        syncVapeNicotineFields(record);
        record.supplyStartedAt = null;
        record.startedAt = null;
        record.finishedAt = null;
    }
    record.inventoryStatus = 'active';
    record.inventoryHidden = false;
    stripIrrelevantPurchaseFields(record);
    return record;
}

function applyPurchaseQuantityEdit(existing, newQty, options = {}) {
    if (isVapePuffPurchase(existing)) {
        const full = newQty;
        const pct = options.percentBoughtAt ?? getVapePercentBoughtAt(existing);
        const newStarting = computeVapeStartingPuffsFromForm(full, pct);
        existing.fullPuffCount = full;
        existing.quantityBought = full;
        existing.quantity = full;
        existing.percentBoughtAt = pct;
        existing.startingPuffsLeft = newStarting;
        if (options.eLiquidCapacityMl !== undefined) {
            if (options.eLiquidCapacityMl != null) existing.eLiquidCapacityMl = options.eLiquidCapacityMl;
            else delete existing.eLiquidCapacityMl;
        }
        if (options.nicotineMgPerMl !== undefined) {
            if (options.nicotineMgPerMl != null) existing.nicotineMgPerMl = options.nicotineMgPerMl;
            else delete existing.nicotineMgPerMl;
        }
        syncVapeNicotineFields(existing);
        recalculateVapePurchaseInventory(existing.id);
        if (full > 0) {
            const total = parseFloat(getPurchaseTotalCost(existing)) || 0;
            existing.costPerUnit = total / full;
        }
        existing.updatedAt = new Date().toISOString();
        return;
    }
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
    resetBuyStoreField();
    setInputValue('buy-percent-bought', 100);
    setInputValue('buy-alcohol-percent', '');
    setInputValue('buy-net-volume-ml', '');
    setInputValue('buy-weed-product-type', 'bud');
    setInputValue('buy-bud-grams', '');
    setInputValue('buy-cart-grams', '');
    setInputValue('buy-edibles-mg', '');
    setInputValue('buy-preroll-count', '');
    setInputValue('buy-grams-per-preroll', '');
    setInputValue('buy-cigarette-nicotine-mg', '');
    setBuyFormSubmitLabel('Save Purchase');
    document.getElementById('cancel-buy-edit-btn')?.classList.add('hidden');
    clearBuyFormFeedback();
    applyMainSubstanceToForms();
    updateBuyCostPerUnitPreview();
    updateBuyVapeFieldsVisibility();
}

function refreshBuyTrackerRelatedViews() {
    recalculateAllBuyBreaks();
    renderBuyTrackerTab();
    updateDashboard();
    updateStats();
}

function ensureSectionExpanded(sectionKey) {
    ensureCollapsedSections(appData);
    if (appData.settings.collapsedSections[sectionKey]) {
        appData.settings.collapsedSections[sectionKey] = false;
        saveData(appData);
        applyCollapsedSections();
    }
}

function clearBuyFormFeedback() {
    const el = document.getElementById('buy-form-feedback');
    if (!el) return;
    el.textContent = '';
    el.classList.add('hidden');
}

function showBuyFormFeedback(message) {
    const el = document.getElementById('buy-form-feedback');
    if (!el) return;
    el.textContent = message;
    el.classList.remove('hidden');
}

function fillBuyFormFromPurchase(purchase, { asDuplicate = false } = {}) {
    if (!purchase) return false;

    const substanceId = getPurchaseSubstanceId(purchase);
    ensureSubstanceInBuyDropdown(substanceId, purchase);
    setInputValue('buy-substance', substanceId);
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

    const isVape = isVapePuffPurchase(purchase);
    if (asDuplicate) {
        setDefaultBuyDateTime();
        if (isVape) {
            setInputValue('buy-time', '12:00');
        }
    } else {
        setInputValue('buy-date', purchase.date || '');
        setInputValue('buy-time', purchase.time || '12:00');
    }

    updateBuyVapeFieldsVisibility();
    const weedType = purchase.weedProductType || 'bud';
    if (isWeedPurchase(purchase) && weedType === 'bud') {
        setInputValue('buy-quantity', '');
    } else if (isWeedPurchase(purchase) && weedType === 'prerolls') {
        setInputValue('buy-quantity', '');
    } else {
        setInputValue('buy-quantity', isVape ? getVapeFullPuffCount(purchase) : getPurchaseQuantity(purchase));
    }
    setInputValue('buy-percent-bought', getVapePercentBoughtAt(purchase));
    setInputValue('buy-eliquid-capacity', getVapeELiquidCapacityMl(purchase) ?? '');
    setInputValue('buy-nicotine-strength', getVapeNicotineMgPerMl(purchase) ?? '');
    setInputValue('buy-alcohol-percent', purchase.alcoholPercent ?? '');
    setInputValue('buy-net-volume-ml', purchase.netVolumeMl ?? '');
    setInputValue('buy-weed-product-type', purchase.weedProductType || 'bud');
    setInputValue('buy-bud-grams', purchase.budGrams ?? '');
    setInputValue('buy-cart-grams', purchase.cartGrams ?? '');
    setInputValue('buy-edibles-mg', purchase.ediblesMg ?? '');
    setInputValue('buy-preroll-count', purchase.preRollCount ?? '');
    setInputValue('buy-grams-per-preroll', purchase.gramsPerPreRoll ?? '');
    setInputValue('buy-cigarette-nicotine-mg', purchase.nicotineMg ?? '');
    setInputValue('buy-total-cost', getPurchaseTotalCost(purchase));
    setBuyStoreFieldValue(purchase.store || purchase.location || '');
    setInputValue('buy-payment', purchase.paymentMethod || '');
    setInputValue('buy-notes', purchase.notes || '');

    updateBuyCostPerUnitPreview();
    updateBuyVapeFieldsPreview();
    updateBuyAlcoholPreview();
    updateBuyWeedProductTypeUI();
    return true;
}

function editPurchase(id) {
    const purchase = findPurchase(id);
    if (!purchase) {
        console.error('[inventory] purchase not found for edit:', id);
        return;
    }

    editingPurchaseId = purchase.id;
    clearBuyFormFeedback();
    switchTab('buy-tracker-tab');
    ensureSectionExpanded('purchaseForm');
    fillBuyFormFromPurchase(purchase);

    setBuyFormSubmitLabel('Update Purchase');
    document.getElementById('cancel-buy-edit-btn')?.classList.remove('hidden');
    document.getElementById('buy-form')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

function duplicatePurchase(id) {
    const purchase = findPurchase(id);
    if (!purchase) {
        alert('Could not find that purchase to duplicate.');
        return;
    }

    editingPurchaseId = null;
    clearBuyFormFeedback();
    switchTab('buy-tracker-tab');
    ensureSectionExpanded('purchaseForm');
    fillBuyFormFromPurchase(purchase, { asDuplicate: true });

    setBuyFormSubmitLabel('Save Purchase');
    document.getElementById('cancel-buy-edit-btn')?.classList.add('hidden');
    showBuyFormFeedback('Duplicated purchase details. Review and save as a new buy.');
    document.getElementById('buy-form')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

function cancelBuyEdit() {
    editingPurchaseId = null;
    document.getElementById('buy-form')?.reset();
    setDefaultBuyDateTime();
    resetBuyStoreField();
    setBuyFormSubmitLabel('Save Purchase');
    document.getElementById('cancel-buy-edit-btn')?.classList.add('hidden');
    clearBuyFormFeedback();
    applyMainSubstanceToForms();
    updateBuyUnitDropdown();
    updateBuyCostPerUnitPreview();
    updateBuyVapeFieldsVisibility();
}

function updateBuyCostPerUnitPreview() {
    const el = document.getElementById('buy-cost-per-unit-preview');
    if (!el) return;
    const substanceId = document.getElementById('buy-substance')?.value;
    let qty = parseFloat(document.getElementById('buy-quantity')?.value);
    if (isWeedTrackingMode(substanceId)) {
        const productType = document.getElementById('buy-weed-product-type')?.value || 'bud';
        if (productType === 'bud') {
            qty = parseFloat(document.getElementById('buy-bud-grams')?.value);
        } else if (productType === 'prerolls') {
            const count = parseFloat(document.getElementById('buy-preroll-count')?.value);
            const grams = parseFloat(document.getElementById('buy-grams-per-preroll')?.value);
            qty = computeWeedTotalPreRollGrams(count, grams);
        }
    }
    const total = parseFloat(document.getElementById('buy-total-cost')?.value);
    if (qty > 0 && total >= 0) {
        el.textContent = `${getCurrencySymbol()}${(total / qty).toFixed(2)} per unit`;
    } else {
        el.textContent = '—';
    }
}

function handleBuySubmit(e) {
    e.preventDefault();
    if (!appData.purchases) appData.purchases = [];

    const substanceId = document.getElementById('buy-substance')?.value;
    const weedErr = validateWeedBuyForm(substanceId);
    if (weedErr) {
        alert(weedErr);
        return;
    }

    const payload = buildPurchaseFromForm();

    if (editingPurchaseId != null) {
        const idx = appData.purchases.findIndex(p => purchaseIdEquals(p.id, editingPurchaseId));
        if (idx < 0) {
            alert('Could not find the purchase to update.');
            cancelBuyEdit();
            return;
        }
        const existing = appData.purchases[idx];
        appData.purchases[idx] = {
            ...existing,
            ...payload,
            id: existing.id,
            substanceId: payload.substanceId,
            createdAt: existing.createdAt || new Date().toISOString(),
            updatedAt: new Date().toISOString()
        };
        if (isVapePuffPurchase(appData.purchases[idx])) {
            delete appData.purchases[idx].startedAt;
            delete appData.purchases[idx].supplyStartedAt;
            appData.purchases[idx].finishedAt = null;
        }
        syncPurchaseInventoryStatus(appData.purchases[idx]);
        applyPurchaseQuantityEdit(appData.purchases[idx], payload.quantityBought ?? payload.quantity ?? 0, {
            percentBoughtAt: payload.percentBoughtAt,
            eLiquidCapacityMl: payload.eLiquidCapacityMl ?? null,
            nicotineMgPerMl: payload.nicotineMgPerMl ?? null
        });
        migratePurchaseInventory(appData.purchases[idx], appData.logs || [], appData);
        if (isVapePuffPurchase(appData.purchases[idx])) {
            reconcileVapePurchaseLifecycle(appData.purchases[idx]);
        }
        syncAlcoholPurchaseFields(appData.purchases[idx]);
        stripIrrelevantPurchaseFields(appData.purchases[idx]);
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

    const newPurchase = { ...finalizeNewPurchaseRecord(payload), id: generateUniqueId('purchase') };
    if (isVapePuffPurchase(newPurchase)) reconcileVapePurchaseLifecycle(newPurchase);
    appData.purchases.push(newPurchase);
    saveData(appData);
    resetBuyFormAfterSave();
    refreshBuyTrackerRelatedViews();
    alert('Purchase recorded!');
}

function openBuyTrackerModal() {
    switchTab('buy-tracker-tab');
    if (!isAllSubstancesView()) {
        const id = currentSubstanceId && currentSubstanceId !== DASHBOARD_ALL
            ? currentSubstanceId
            : getMainSubstanceId();
        if (id) setInputValue('buy-substance', id);
    }
    setDefaultBuyDateTime();
    populateBuyStoreDropdown();
    updateBuyUnitDropdown();
}

function deletePurchase(id) {
    const linked = getLogsForPurchase(id);
    let msg = 'Delete this purchase?';
    if (linked.length) {
        msg = `This purchase has ${linked.length} linked use ${linked.length === 1 ? 'entry' : 'entries'}. Delete anyway? Those uses will become unlinked.`;
    }
    if (!confirm(msg)) return;
    if (purchaseIdEquals(editingPurchaseId, id)) cancelBuyEdit();
    linked.forEach(l => {
        if (l.linkedPurchases?.length) {
            l.linkedPurchases = l.linkedPurchases.filter(a => !purchaseIdEquals(a.purchaseId, id));
            if (l.linkedPurchases.length === 1) {
                setLogPurchaseId(l, l.linkedPurchases[0].purchaseId);
            } else if (l.linkedPurchases.length === 0) {
                setLogPurchaseId(l, null);
            } else {
                l.purchaseId = null;
                l.linkedPurchaseId = null;
                l.inventoryAffects = true;
                l.supplyUnlinked = false;
            }
        } else {
            setLogPurchaseId(l, null);
        }
        l.updatedAt = new Date().toISOString();
    });
    appData.purchases = (appData.purchases || []).filter(p => !purchaseIdEquals(p.id, id));
    expandedPurchaseIds.delete(normalizePurchaseId(id));
    saveData(appData);
    refreshBuyTrackerRelatedViews();
    refreshUseLogRelatedViews();
}

function logMatchesPurchase(log, purchaseId) {
    const pid = getLogPurchaseId(log);
    if (pid === purchaseId || String(pid) === String(purchaseId)) return true;
    return Array.isArray(log.linkedPurchases)
        && log.linkedPurchases.some(lp => lp.purchaseId === purchaseId || String(lp.purchaseId) === String(purchaseId));
}

function getLogsForPurchase(purchaseId, data = appData) {
    return getUseEntries(data).filter(log => logMatchesPurchase(log, purchaseId));
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
    const isVape = isVapePuffPurchase(purchase);
    const logs = getLogsForPurchase(purchaseId)
        .slice()
        .sort((a, b) => (isVape ? getVapeLogSortMs(a) - getVapeLogSortMs(b) : getLogDatetimeMs(a) - getLogDatetimeMs(b)));
    const bought = isVape
        ? getVapeFullPuffCount(purchase)
        : getPurchaseQuantityBought(purchase);
    const remaining = getPurchaseRemainingAmount(purchase);
    let totalUsed = 0;
    if (isVape) {
        totalUsed = Math.max(0, getVapeStartingPuffsLeft(purchase) - remaining);
    } else {
        logs.forEach(log => { totalUsed += getAmountUsedFromPurchase(log, purchaseId); });
    }

    const firstLog = logs[0] || null;
    const lastLog = logs[logs.length - 1] || null;
    const firstUseAt = firstLog
        ? (isVape ? getUseLogStartedAt(firstLog) : getLogSupplyStartDate(firstLog))
        : null;
    const lastSupplyUseAt = lastLog
        ? (isVape
            ? (getUseLogEndedAt(lastLog) || getUseLogStartedAt(lastLog))
            : getLogActivityEndDatetime(lastLog))
        : null;
    const supplyDuration = isVape
        ? (() => {
            const lifecycle = getVapePurchaseLifecycleMetrics(purchase);
            const vapeFirst = lifecycle?.firstUseAt || null;
            const vapeLast = lifecycle?.lastUseAt || null;
            const label = lifecycle?.durationLabel || 'Not started';
            const ms = lifecycle?.durationMs ?? null;
            const tooltip = vapeFirst
                ? `First use: ${formatDatetimeLong(vapeFirst)}\nLast use: ${vapeLast ? formatDatetimeLong(vapeLast) : '—'}`
                : 'No linked use logs for this supply.';
            return { label, ms, tooltip, firstUseAt: vapeFirst, lastUseAt: vapeLast };
        })()
        : computeSupplyDurationMetrics(logs);

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
    const isVape = isVapeNicotineSubstanceId(substanceId);

    const durationMsList = [];
    purchases.forEach(purchase => {
        if (isVape && isVapePuffPurchase(purchase)) {
            const depleted = purchase.isDepleted || getPurchaseRemainingAmount(purchase) <= INVENTORY_EPS;
            if (!depleted) return;
            const ms = getVapePurchaseSupplyDurationMs(purchase);
            if (ms != null) durationMsList.push(ms);
            return;
        }
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

function renderVapePurchaseLifecycleHtml(purchase) {
    if (!isVapePuffPurchase(purchase)) return '';
    const metrics = getVapePurchaseLifecycleMetrics(purchase);
    if (!metrics) return '';
    const full = getVapeFullPuffCount(purchase);
    const pctBought = getVapePercentBoughtAt(purchase);
    const starting = getVapeStartingPuffsLeft(purchase);
    const remaining = getPurchaseRemainingAmount(purchase);
    const pctLeft = getPurchasePercentRemaining(purchase);
    const avgDay = metrics.avgPuffsPerDay != null
        ? `${formatAmount(metrics.avgPuffsPerDay)} puffs/day`
        : '—';
    const avgHour = metrics.avgPuffsPerHour != null
        ? `${formatAmount(metrics.avgPuffsPerHour)} puffs/hr`
        : '—';
    const totalCost = parseFloat(getPurchaseTotalCost(purchase)) || 0;
    const costPerDay = metrics.durationMs != null && metrics.durationMs >= 86400000
        ? totalCost / (metrics.durationMs / 86400000)
        : null;
    const puffsUsed = metrics.totalUsed ?? Math.max(0, starting - remaining);
    const costPer1000 = puffsUsed > INVENTORY_EPS ? (totalCost / puffsUsed) * 1000 : null;
    const nic = metrics.nicotine;
    const nicotineHtml = nic ? `
            <div class="purchase-supply-stat"><span>E-liquid</span><strong>${formatAmount(nic.eLiquidCapacityMl)} mL</strong></div>
            <div class="purchase-supply-stat"><span>Nicotine strength</span><strong>${formatAmount(nic.nicotineMgPerMl)} mg/mL</strong></div>
            <div class="purchase-supply-stat"><span>Total nicotine</span><strong>${formatAmount(nic.totalNicotineMg)} mg</strong></div>
            <div class="purchase-supply-stat"><span>Est. nicotine used</span><strong>${formatAmount(nic.nicotineUsedMg)} mg</strong></div>
            <div class="purchase-supply-stat"><span>Est. nicotine left</span><strong>${formatAmount(nic.nicotineLeftMg)} mg</strong></div>
            <div class="purchase-supply-stat"><span>Avg nicotine/day</span><strong>${nic.avgNicotineMgPerDay != null ? `${formatAmount(nic.avgNicotineMgPerDay)} mg/day` : '—'}</strong></div>` : '';
    return `
        <div class="purchase-vape-lifecycle">
            <div class="purchase-supply-stat"><span>Full puff count</span><strong>${formatAmount(full)}</strong></div>
            <div class="purchase-supply-stat"><span>Bought at</span><strong>${pctBought}%</strong></div>
            <div class="purchase-supply-stat"><span>Started left</span><strong>${formatAmount(starting)} puffs</strong></div>
            <div class="purchase-supply-stat"><span>Current left</span><strong>${formatAmountWithUnit(remaining, 'puffs')} / ${pctLeft}%</strong></div>
            <div class="purchase-supply-stat"><span>Puffs used</span><strong>${formatAmount(puffsUsed)}</strong></div>
            <div class="purchase-supply-stat"><span>Cost</span><strong>${fmtSheetMoney(totalCost, getCurrencySymbol())}</strong></div>
            <div class="purchase-supply-stat"><span>Cost/day</span><strong>${costPerDay != null ? fmtSheetMoney(costPerDay, getCurrencySymbol()) : '—'}</strong></div>
            <div class="purchase-supply-stat"><span>Cost / 1,000 puffs</span><strong>${costPer1000 != null ? fmtSheetMoney(costPer1000, getCurrencySymbol()) : '—'}</strong></div>
            ${nicotineHtml}
            <div class="purchase-supply-stat"><span>First use</span><strong>${metrics.firstUseAt ? formatDatetimeLong(metrics.firstUseAt) : 'Not started'}</strong></div>
            <div class="purchase-supply-stat"><span>Last use</span><strong>${metrics.lastUseAt ? formatDatetimeLong(metrics.lastUseAt) : '—'}</strong></div>
            <div class="purchase-supply-stat"><span>Supply duration</span><strong>${metrics.durationLabel}</strong></div>
            <div class="purchase-supply-stat"><span>Avg puffs/day</span><strong>${avgDay}</strong></div>
            <div class="purchase-supply-stat"><span>Avg puffs/hr</span><strong>${avgHour}</strong></div>
        </div>`;
}

function renderPurchaseLinkedLogSummaryLine(log, purchaseId, unit) {
    const enriched = enrichUseEntry(log, null);
    const amount = getAmountUsedFromPurchase(log, purchaseId);
    if (isVapeUseLog(log)) {
        const started = getUseLogStartedAt(log);
        const ended = getUseLogEndedAt(log);
        const startLabel = started ? formatDatetimeLong(started) : `${formatDate(log.date)} ${log.startTime || log.time || ''}`.trim();
        const endLabel = ended ? formatDatetimeLong(ended) : (log.endTime || '—');
        const durationMs = getVapeLogDurationMs(log);
        const parts = [
            startLabel,
            `→ ${endLabel}`,
            durationMs != null ? formatVapeDuration(durationMs) : '—',
            `${log.isEstimated || log.estimatedFromPercent ? '~' : ''}${formatAmount(amount)} puffs`
        ];
        if (log.needsReview) parts.push('Needs review');
        else if (log.percentRemaining != null) {
            const pct = Number.isInteger(log.percentRemaining)
                ? log.percentRemaining
                : parseFloat(log.percentRemaining).toFixed(1);
            parts.push(`${pct}% left after`);
        }
        return parts.join(' · ');
    }
    const startTime = log.startTime || log.time || '';
    const endTime = log.endTime || '';
    const timeRange = endTime ? `${startTime}–${endTime}` : startTime;
    const parts = [
        `${formatDate(log.date)} ${timeRange}`.trim(),
        formatAmountWithUnit(amount, unit)
    ];
    const count = getUseCount(log);
    const countLine = formatSecondaryCountDisplay(getUseSubstanceId(log), count);
    if (countLine) parts.push(countLine);
    else if (enriched.durationHours) parts.push(formatDurationHours(enriched.durationHours));
    return parts.join(' · ');
}

function renderPurchaseLinkedLogsPanel(purchase) {
    const purchaseId = purchase.id;
    const displayUnit = getPurchaseRemainingDisplayUnit(purchase);
    const store = purchase.store || purchase.location || '';
    const metrics = getPurchaseSupplyMetrics(purchase);
    const isVape = isVapePuffPurchase(purchase);
    const header = isVape
        ? `${formatDate(purchase.date)} purchase${store ? ` · ${store}` : ''} · ${formatAmountWithUnit(getVapeFullPuffCount(purchase), 'puffs')} @100%`
        : `${formatDate(purchase.date)} purchase${store ? ` · ${store}` : ''} · ${formatAmountWithUnit(metrics.quantityBought, displayUnit)}`;

    const totalsHtml = isVape
        ? renderVapePurchaseLifecycleHtml(purchase)
        : `<div class="purchase-supply-totals">
            <div class="purchase-supply-stat"><span>Quantity bought</span><strong>${formatAmountWithUnit(metrics.quantityBought, displayUnit)}</strong></div>
            <div class="purchase-supply-stat"><span>Total used</span><strong>${formatAmountWithUnit(metrics.totalUsed, displayUnit)}</strong></div>
            <div class="purchase-supply-stat"><span>Remaining</span><strong>${formatPurchaseRemainingWithUnit(purchase)}</strong></div>
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
        `<li>${renderPurchaseLinkedLogSummaryLine(log, purchaseId, displayUnit)}</li>`
    ).join('');

    let detailRows = '';
    metrics.logs.slice().reverse().forEach(log => {
        const enriched = enrichUseEntry(log, null);
        const amount = getAmountUsedFromPurchase(log, purchaseId);
        const count = getUseCount(log);
        if (isVape) {
            const started = getUseLogStartedAt(log);
            const ended = getUseLogEndedAt(log);
            const durationMs = getVapeLogDurationMs(log);
            detailRows += `<tr>
            <td>${started ? formatDatetimeLong(started) : formatDate(log.date)}</td>
            <td>${started ? formatDatetimeLong(started) : (log.startTime || log.time || '—')}</td>
            <td>${ended ? formatDatetimeLong(ended) : (log.endTime || '—')}</td>
            <td>${durationMs != null ? formatVapeDuration(durationMs) : '—'}</td>
            <td>${formatAmount(amount)} puffs</td>
            <td>${log.percentRemaining != null ? `${log.percentRemaining}%` : '—'}</td>
            <td>${getTransactionTypeShortLabel(log)}</td>
            <td>${formatInventoryLinkDisplay(log)}</td>
            <td class="session-notes-cell">${log.notes || ''}</td>
        </tr>`;
            return;
        }
        detailRows += `<tr>
            <td>${formatDate(log.date)}</td>
            <td>${log.startTime || log.time || '—'}</td>
            <td>${log.endTime || '—'}</td>
            <td>${enriched.durationHours != null ? formatDurationHours(enriched.durationHours) : '—'}</td>
            <td>${formatAmountWithUnit(amount, displayUnit)}</td>
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
    const purchase = findPurchase(purchaseId);
    const id = normalizePurchaseId(purchase?.id ?? purchaseId);
    if (!id) return;
    if (expandedPurchaseIds.has(id)) expandedPurchaseIds.delete(id);
    else expandedPurchaseIds.add(id);

    const detail = document.getElementById(`purchase-detail-${id}`);
    const btn = document.querySelector(`[data-purchase-toggle="${String(id).replace(/"/g, '\\"')}"]`);
    const expanded = expandedPurchaseIds.has(id);
    if (detail) detail.classList.toggle('hidden', !expanded);
    if (btn) {
        btn.setAttribute('aria-expanded', expanded ? 'true' : 'false');
        btn.textContent = expanded ? 'Hide Linked Logs' : 'View Linked Logs';
    }
}

function getBuyStats(substanceId) {
    const purchases = getPurchasesFiltered(substanceId);
    const today = getLocalDateString();
    const weekStart = getWeekStartDateStr(today);
    const monthStart = today.slice(0, 7) + '-01';
    const cur = getCurrencySymbol();

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

    const sorted = [...purchases].sort((a, b) => getPurchaseDatetimeMs(b) - getPurchaseDatetimeMs(a));
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
        days.push(getLocalDateString(d));
    }
    const totals = days.map(day => purchases.filter(p => p.date === day).reduce((s, p) => s + (p.totalCost ?? p.cost ?? 0), 0));
    const max = Math.max(...totals, 1);
    container.innerHTML = '<div class="mini-bar-chart">' + days.map((day, i) => {
        const h = Math.round((totals[i] / max) * 100);
        const label = parseLocalDate(day)?.toLocaleDateString('en-US', { weekday: 'short' }) || day;
        return `<div class="mini-bar" title="${getCurrencySymbol()}${totals[i].toFixed(2)}"><div class="mini-bar-fill" style="height:${h}%"></div><span>${label}</span></div>`;
    }).join('') + '</div>';
}

function renderBuyTrackerTab() {
    const filterId = getSelectedSubstanceFilterId();
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
    renderInventorySummaryCards();
    renderPurchaseHistory(null);
    renderBuyWeeklySummary(filterId);
    renderBuyMonthlySummary(filterId);
    renderStoresList();
    applyCollapsedSections();
}

function renderPurchaseHistory(substanceId, containerId = null) {
    const filterId = substanceId !== undefined
        ? substanceId
        : getSelectedSubstanceFilterId();
    const container = document.getElementById(containerId || 'purchase-history-list')
        || document.getElementById('buy-history-table-wrap')
        || document.getElementById('purchase-history');

    if (!container) return;

    if (!appData.purchases?.length) {
        container.innerHTML = '<p class="empty-hint">No purchases yet.</p>';
        applyCollapsedSections();
        return;
    }

    const purchases = getInventoryFilteredPurchases(filterId);

    if (!purchases.length) {
        container.innerHTML = '<p class="empty-hint">No purchases match this filter.</p>';
        applyCollapsedSections();
        return;
    }

    const cur = getCurrencySymbol();
    const purchaseColumns = getEffectiveColumnOrder('purchaseHistory');
    const tableMinWidth = getPurchaseHistoryTableMinWidth(purchaseColumns);
    const colgroup = buildPurchaseHistoryColgroup(purchaseColumns);
    let html = `<div class="table-scroll purchase-history-scroll"><table class="session-table history-table purchase-history-table inventory-history-table" style="min-width:${tableMinWidth}px;table-layout:fixed">${colgroup}<thead><tr class="inventory-history-header">`;
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
        const purchaseId = normalizePurchaseId(purchase.id);
        const expanded = expandedPurchaseIds.has(purchaseId);
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
            totalNum,
            cpu,
            expanded,
            toggleLabel
        };

        html += '<tr class="purchase-history-row inventory-history-row">';
        purchaseColumns.forEach(colId => {
            html += renderPurchaseHistoryBodyCell(colId, rowCtx);
        });
        html += '</tr>';
        html += `<tr id="purchase-detail-${escapeAttr(purchaseId)}" class="purchase-linked-detail${expanded ? '' : ' hidden'}">
            <td colspan="${purchaseColumns.length}">${renderPurchaseLinkedLogsPanel(purchase)}</td>
        </tr>`;
    });

    html += '</tbody></table></div>';
    container.innerHTML = html;
    document.getElementById('inventory-select-all')?.addEventListener('change', (e) => {
        const checked = e.target.checked;
        purchases.forEach(p => {
            const pid = normalizePurchaseId(p.id);
            if (checked) inventorySelectedIds.add(pid);
            else inventorySelectedIds.delete(pid);
        });
        renderPurchaseHistory(filterId, containerId);
    });
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
    setupPurchaseHistoryActions();
    setupManualBulkLinkListeners();
    setupColumnSettingsModal();
    setupUseStatsSettingsModal();
    document.getElementById('taper-form')?.addEventListener('submit', handleTaperSubmit);
    setupSubstanceForm();
    document.getElementById('save-substance-btn')?.addEventListener('click', () => {
        console.log('[substance] save button clicked');
        handleSubstanceSubmit();
    });

    document.getElementById('use-substance')?.addEventListener('change', updateUseUnitDropdown);
    document.getElementById('taper-substance')?.addEventListener('change', onTaperSubstanceChange);
}

// ——— Recovery-focused dashboard & use log helpers ———
function getRecoveryTaperStatusLabel(status) {
    return RECOVERY_TAPER_LABELS[status] || '—';
}

function getMonthEndDateStr(dateStr) {
    const d = parseLocalDate(dateStr);
    if (!d) return dateStr || '';
    return getLocalDateString(new Date(d.getFullYear(), d.getMonth() + 1, 0));
}

function getPersonalUseInRange(substanceId, startDate, endDate, data = appData) {
    return getUseLogsForSubstance(substanceId, { sortAsc: true, personalUseOnly: true, data })
        .filter(l => {
            if (!l.date) return false;
            if (startDate && l.date < startDate) return false;
            if (endDate && l.date > endDate) return false;
            return true;
        });
}

function getMonthPersonalUseTotal(substanceId, dateStr = getLocalDateString()) {
    const monthStart = getMonthStartDateStr(dateStr);
    return getPersonalUseInRange(substanceId, monthStart, dateStr)
        .reduce((s, l) => s + (parseFloat(l.amount) || 0), 0);
}

function getWeekPersonalUseTotal(substanceId, dateStr = getLocalDateString()) {
    const weekStart = getWeekStartDateStr(dateStr);
    return getPersonalUseInRange(substanceId, weekStart, dateStr)
        .reduce((s, l) => s + (parseFloat(l.amount) || 0), 0);
}

function getMonthlyLimit(substanceId, dateStr = getLocalDateString()) {
    const plan = appData.taperPlans[substanceId];
    if (!plan || plan.isPaused) return null;
    if (plan.monthlyMax != null && plan.monthlyMax > 0) {
        return roundTaperValue(plan.monthlyMax);
    }
    const monthStart = getMonthStartDateStr(dateStr);
    const monthEnd = getMonthEndDateStr(dateStr);
    let weekSum = 0;
    let hasWeek = false;
    (plan.weeklyTargets || []).forEach(weekRow => {
        if (weekRow.weekEnd >= monthStart && weekRow.weekStart <= monthEnd) {
            const planned = getPlannedWeeklyTarget(plan, weekRow) ?? weekRow.weeklyMax ?? 0;
            if (planned > 0) {
                weekSum += planned;
                hasWeek = true;
            }
        }
    });
    if (hasWeek && weekSum > 0) return roundTaperValue(weekSum);
    const daily = getDailyLimitForDate(substanceId, dateStr);
    if (daily == null) return null;
    const start = parseLocalDate(monthStart);
    const end = parseLocalDate(monthEnd);
    const daysInMonth = start && end ? Math.max(1, Math.round((end - start) / 86400000) + 1) : 30;
    return roundTaperValue(daily * daysInMonth);
}

function getMonthSpent(substanceId, dateStr = getLocalDateString()) {
    const monthStart = getMonthStartDateStr(dateStr);
    return (appData.purchases || [])
        .filter(p => getPurchaseSubstanceId(p) === substanceId && p.date >= monthStart && p.date <= dateStr)
        .reduce((s, p) => s + (parseFloat(getPurchaseTotalCost(p)) || 0), 0);
}

function getMonthPurchaseTotal(substanceId, dateStr = getLocalDateString()) {
    const monthStart = getMonthStartDateStr(dateStr);
    return (appData.purchases || [])
        .filter(p => getPurchaseSubstanceId(p) === substanceId && p.date >= monthStart && p.date <= dateStr)
        .reduce((s, p) => s + (parseFloat(getPurchaseQuantity(p)) || 0), 0);
}

function estimateLogCost(log) {
    const pid = getLogPurchaseId(log);
    if (!pid) return 0;
    const purchase = findPurchase(pid);
    if (!purchase) return 0;
    const qty = parseFloat(getPurchaseQuantity(purchase)) || 0;
    const cost = parseFloat(getPurchaseTotalCost(purchase)) || 0;
    if (qty <= 0) return 0;
    return ((parseFloat(log.amount) || 0) / qty) * cost;
}

function getUseLogFilterBounds(filter = useLogDateFilter) {
    const today = getLocalDateString();
    switch (filter) {
        case 'today':
            return { startDate: today, endDate: today };
        case 'week': {
            const weekStart = getWeekStartDateStr(today);
            return { startDate: weekStart, endDate: today };
        }
        case 'month': {
            return { startDate: getMonthStartDateStr(today), endDate: today };
        }
        default:
            return { startDate: null, endDate: null };
    }
}

function logMatchesUseLogFilter(log, filter = useLogDateFilter) {
    if (!log?.date) return false;
    const { startDate, endDate } = getUseLogFilterBounds(filter);
    if (startDate && log.date < startDate) return false;
    if (endDate && log.date > endDate) return false;
    return true;
}

function setUseLogFilter(filter) {
    useLogDateFilter = filter;
    document.querySelectorAll('.use-log-filter-btn').forEach(btn => {
        btn.classList.toggle('active', btn.dataset.filter === filter);
    });
    renderUseLogTab();
}

function getUseLogTotalsForView(substanceId = getUseLogViewSubstanceId()) {
    const bounds = getUseLogFilterBounds();
    let logs = getUseEntries().filter(l => logMatchesUseLogFilter(l) && isPersonalUseLog(l));
    if (substanceId) {
        logs = logs.filter(l => logMatchesSubstance(l, substanceId));
    }
    const totalGrams = logs.reduce((s, l) => s + (parseFloat(l.amount) || 0), 0);
    const totalCost = logs.reduce((s, l) => s + estimateLogCost(l), 0);
    return { totalGrams, totalCost, entryCount: logs.length };
}

function renderUseLogTotals() {
    const container = document.getElementById('use-log-totals');
    if (!container) return;
    const sub = isSelectedAllSubstances() ? null : getSubstance(selectedSubstanceId);
    const unit = sub?.defaultUnit || 'units';
    const { totalGrams, totalCost, entryCount } = getUseLogTotalsForView();
    const cur = getCurrencySymbol();
    container.innerHTML = `
        <div class="use-log-totals-grid">
            <div class="use-log-total-card"><span>Total amount</span><strong>${formatAmount(totalGrams)} ${unit}</strong></div>
            <div class="use-log-total-card"><span>Est. cost</span><strong>${fmtSheetMoney(totalCost, cur)}</strong></div>
            <div class="use-log-total-card"><span>Entries</span><strong>${entryCount}</strong></div>
        </div>`;
}

function getSubstanceDisplayUnit(substanceId, data = appData) {
    const sub = getSubstance(substanceId, data);
    return sub?.defaultUnit || getSubstancePrimaryUnit(substanceId, data) || 'units';
}

function getSubstanceUsageAmountForDate(substanceId, dateStr, data = appData) {
    try {
        return getStatsUsageOnDate(substanceId, dateStr, data);
    } catch (_) {
        return getUsedAmount(substanceId, dateStr, null, data);
    }
}

function getSubstanceUsageAmountForRange(substanceId, startDate, endDate, data = appData) {
    try {
        return getStatsUsageInRange(substanceId, startDate, endDate, data);
    } catch (_) {
        return getPersonalUseInRange(substanceId, startDate, endDate, data)
            .reduce((s, l) => s + (parseFloat(l.amount) || 0), 0);
    }
}

function buildAllSubstancesUsageEntries(startDate, endDate, data = appData) {
    const end = endDate || startDate;
    return getActiveSubstances(data).map(sub => ({
        id: sub.id,
        name: getSubstanceDisplayName(sub, data),
        icon: sub.icon,
        unit: getSubstanceDisplayUnit(sub.id, data),
        amount: startDate === end
            ? getSubstanceUsageAmountForDate(sub.id, startDate, data)
            : getSubstanceUsageAmountForRange(sub.id, startDate, end, data)
    })).sort((a, b) => b.amount - a.amount || a.name.localeCompare(b.name));
}

function formatGroupedUsageCompact(entries, maxItems = 3) {
    if (!entries.length) return '0';
    const visible = entries.slice(0, maxItems).map(e => `${e.name} ${formatAmount(e.amount)} ${e.unit}`);
    const more = entries.length > maxItems ? ` · +${entries.length - maxItems} more` : '';
    return visible.join(' · ') + more;
}

function getAllSubstancesMonthSpent(dateStr = getLocalDateString(), data = appData) {
    const monthStart = getMonthStartDateStr(dateStr);
    return (data.purchases || [])
        .filter(p => p.date >= monthStart && p.date <= dateStr)
        .reduce((s, p) => s + (parseFloat(getPurchaseTotalCost(p)) || 0), 0);
}

function getAllSubstancesBestStreak(data = appData) {
    let best = { days: 0, name: '' };
    getActiveSubstances(data).forEach(sub => {
        const { days } = computeRecoveryStreakDays(sub.id);
        if (days > best.days) best = { days, name: getSubstanceDisplayName(sub, data) };
    });
    return best;
}

function getAllSubstancesLowInventoryWarnings(data = appData) {
    const warnings = [];
    getActiveSubstances(data).forEach(sub => {
        const remaining = getTotalRemainingSupply(sub.id);
        const unit = getSubstanceDisplayUnit(sub.id, data);
        const name = getSubstanceDisplayName(sub, data);
        const purchases = (data.purchases || []).filter(p => getPurchaseSubstanceId(p) === sub.id);
        if (!purchases.length) return;
        const totalBought = purchases.reduce((s, p) => s + (parseFloat(getPurchaseQuantity(p)) || 0), 0);
        const pct = totalBought > 0 && remaining != null ? remaining / totalBought : null;
        if (pct != null && pct <= 0.15 && remaining > INVENTORY_EPS) {
            warnings.push(`Low inventory: ${name} about ${formatAmount(remaining)} ${unit} remaining.`);
        } else if (remaining != null && remaining <= INVENTORY_EPS) {
            warnings.push(`${name} inventory is depleted.`);
        }
    });
    return warnings;
}

function setDashboardMetricLabel(metricId, labelText) {
    const metric = document.getElementById(metricId);
    const label = metric?.closest('.dash-metric-card')?.querySelector('.dash-metric-label');
    if (label) label.textContent = labelText;
}

function renderAllSubstancesInventoryDashboard(container) {
    if (!container) return;
    const subs = getActiveSubstances();
    if (!subs.length) {
        container.innerHTML = '<p class="empty-hint">No active substances.</p>';
        return;
    }

    const supplyLines = [];
    const lowLines = [];
    const recentLines = [];

    subs.forEach(sub => {
        const name = getSubstanceDisplayName(sub);
        const unit = getSubstanceDisplayUnit(sub.id);
        const remaining = getTotalRemainingSupply(sub.id);
        supplyLines.push(`<li><strong>${name}</strong> · ${formatAmount(remaining)} ${unit}</li>`);

        const purchases = (appData.purchases || [])
            .filter(p => getPurchaseSubstanceId(p) === sub.id)
            .sort((a, b) => getPurchaseDatetimeMs(b) - getPurchaseDatetimeMs(a));
        const totalBought = purchases.reduce((s, p) => s + (parseFloat(getPurchaseQuantity(p)) || 0), 0);
        const pct = totalBought > 0 && remaining != null ? remaining / totalBought : null;
        if (pct != null && pct <= 0.15 && remaining > INVENTORY_EPS) {
            lowLines.push(`<li>Low inventory: ${name} about ${formatAmount(remaining)} ${unit} remaining.</li>`);
        } else if (purchases.length && remaining != null && remaining <= INVENTORY_EPS) {
            lowLines.push(`<li>${name} inventory is depleted.</li>`);
        }

        if (purchases[0]) {
            const store = purchases[0].store || purchases[0].location || '';
            recentLines.push(`<li><strong>${name}</strong> · ${formatDate(purchases[0].date)}${store ? ` · ${store}` : ''}</li>`);
        }
    });

    container.innerHTML = `
        <div class="dash-supply-all-section">
            <h4 class="dash-supply-all-heading">In supply</h4>
            <ul class="dash-supply-all-list">${supplyLines.join('')}</ul>
        </div>
        ${lowLines.length ? `<div class="dash-supply-all-section"><h4 class="dash-supply-all-heading">Low / depleted</h4><ul class="dash-supply-all-list dash-supply-all-low">${lowLines.join('')}</ul></div>` : ''}
        ${recentLines.length ? `<div class="dash-supply-all-section"><h4 class="dash-supply-all-heading">Recent purchases</h4><ul class="dash-supply-all-list">${recentLines.join('')}</ul></div>` : ''}`;
}

function pickSubstanceForQuickAction(actionLabel) {
    const subs = getActiveSubstances();
    if (!subs.length) {
        alert('Add an active substance first.');
        return null;
    }
    if (!isAllSubstancesView()) {
        return currentSubstanceId && currentSubstanceId !== DASHBOARD_ALL ? currentSubstanceId : getMainSubstanceId();
    }
    if (subs.length === 1) return subs[0].id;
    const lines = subs.map((s, i) => `${i + 1}. ${getSubstanceDisplayName(s)}`).join('\n');
    const choice = prompt(`${actionLabel}\n\n${lines}\n\nEnter number (1-${subs.length}):`);
    if (choice == null || choice.trim() === '') return null;
    const idx = parseInt(choice, 10) - 1;
    if (!Number.isFinite(idx) || idx < 0 || idx >= subs.length) {
        alert('Invalid selection.');
        return null;
    }
    return subs[idx].id;
}

function getNextBestAction(substanceId) {
    if (isAllSubstancesView()) {
        const today = getLocalDateString();
        const entries = buildAllSubstancesUsageEntries(today, today);
        const top = entries.find(e => e.amount > 0);
        if (top) {
            return {
                tone: 'steady',
                title: 'All substances',
                message: `Highest use today: ${top.name} ${formatAmount(top.amount)} ${top.unit}. Select a single substance for detailed taper/recovery insights.`
            };
        }
        return {
            tone: 'steady',
            title: 'All substances',
            message: 'Select a single substance for detailed taper/recovery insights.'
        };
    }
    if (!substanceId) {
        return {
            tone: 'steady',
            title: 'Choose a substance',
            message: 'Select a substance to see personalized recovery guidance.'
        };
    }
    const today = getLocalDateString();
    const plan = appData.taperPlans?.[substanceId];
    const weekUsed = plan && !plan.isPaused
        ? getUsedAmountForTaperWeek(substanceId, today)
        : getWeekPersonalUseTotal(substanceId, today);
    const weekLimit = getWeeklyLimit(substanceId, today);
    const todayUsed = getUsedAmount(substanceId, today);
    const dailyLimit = getDailyLimitForDate(substanceId, today);
    const monthUsed = getMonthPersonalUseTotal(substanceId, today);
    const monthLimit = getMonthlyLimit(substanceId, today);

    if (monthLimit != null && monthUsed > monthLimit) {
        return {
            tone: 'reset',
            title: 'Room to adjust',
            message: 'This month is above your monthly plan. That does not erase progress — consider a lighter day when you are ready.'
        };
    }
    if (weekLimit != null && weekUsed > weekLimit) {
        return {
            tone: 'reset',
            title: 'Gentle reset',
            message: 'This week is above your weekly plan. One heavier day does not define you — a smaller day tomorrow can help you reset.'
        };
    }
    if (dailyLimit != null && todayUsed > dailyLimit) {
        return {
            tone: 'reset',
            title: 'Tomorrow is fresh',
            message: 'Today went above your daily plan. Take a breath — try a lighter amount tomorrow if that feels right.'
        };
    }
    if (weekLimit != null && weekUsed <= weekLimit * 0.75) {
        return {
            tone: 'encourage',
            title: 'You are on track',
            message: 'You are below your weekly plan so far. Notice what is helping you — small wins matter.'
        };
    }
    if (dailyLimit != null && todayUsed > 0 && todayUsed <= dailyLimit * 0.8) {
        return {
            tone: 'encourage',
            title: 'Steady day',
            message: 'Today is within your daily plan. Keep logging honestly — awareness supports recovery.'
        };
    }
    return {
        tone: 'steady',
        title: 'Stay curious',
        message: 'Check in with mood and triggers when you log. Honest data helps you see patterns without judgment.'
    };
}

function renderNextBestAction(substanceId) {
    const card = document.getElementById('dash-next-action');
    if (!card) return;
    const action = getNextBestAction(substanceId);
    card.className = `dash-card dash-next-action-card dash-next-action-${action.tone}`;
    card.innerHTML = `
        <h3 class="dash-card-title">Next Best Action</h3>
        <p class="dash-next-action-title">${action.title}</p>
        <p class="dash-next-action-message">${action.message}</p>`;
}

function renderDashboardSummaryCards(substanceId) {
    const set = (id, text) => { const el = document.getElementById(id); if (el) el.textContent = text; };
    if (isAllSubstancesView()) {
        const today = getLocalDateString();
        const weekStart = getWeekStartDateStr(today);
        const monthStart = getMonthStartDateStr(today);
        const todayEntries = buildAllSubstancesUsageEntries(today, today);
        const weekEntries = buildAllSubstancesUsageEntries(weekStart, today);
        const monthEntries = buildAllSubstancesUsageEntries(monthStart, today);
        const cur = getCurrencySymbol();

        set('dash-card-today', todayEntries.length
            ? formatGroupedUsageCompact(todayEntries, todayEntries.length)
            : '0');
        set('dash-card-week', weekEntries.length
            ? formatGroupedUsageCompact(weekEntries, 3)
            : '0');
        set('dash-card-month', monthEntries.length
            ? formatGroupedUsageCompact(monthEntries, 3)
            : '0');
        set('dash-card-spent', fmtSheetMoney(getAllSubstancesMonthSpent(today), cur));
        const best = getAllSubstancesBestStreak();
        set('dash-card-streak', best.days
            ? `${best.days} day${best.days === 1 ? '' : 's'} (${best.name})`
            : '0 days');
        set('dash-card-month-cap', '—');
        setDashboardMetricLabel('dash-card-month-cap', 'Select one substance for cap');
        return;
    }

    setDashboardMetricLabel('dash-card-month-cap', 'Remaining Monthly Cap');
    if (!substanceId) {
        ['dash-card-today', 'dash-card-week', 'dash-card-month', 'dash-card-spent', 'dash-card-streak', 'dash-card-month-cap']
            .forEach(id => set(id, '—'));
        return;
    }
    const sub = getSubstance(substanceId);
    const unit = sub?.defaultUnit || 'units';
    const today = getLocalDateString();
    const todayUsed = isVapeNicotineSubstanceId(substanceId)
        ? getStatsUsageOnDate(substanceId, today)
        : getUsedAmount(substanceId, today);
    const weekUsed = isVapeNicotineSubstanceId(substanceId)
        ? getStatsUsageInRange(substanceId, getWeekStartDateStr(today), today)
        : getWeekPersonalUseTotal(substanceId, today);
    const monthUsed = isVapeNicotineSubstanceId(substanceId)
        ? getStatsUsageInRange(substanceId, getMonthStartDateStr(today), today)
        : getMonthPersonalUseTotal(substanceId, today);
    const monthLimit = getMonthlyLimit(substanceId, today);
    const monthRemaining = monthLimit != null ? Math.max(0, monthLimit - monthUsed) : null;
    const streakDays = computeRecoveryStreakDays(substanceId).days;
    const spent = getMonthSpent(substanceId, today);
    const cur = getCurrencySymbol();

    set('dash-card-today', `${formatAmount(todayUsed)} ${unit}`);
    set('dash-card-week', `${formatAmount(weekUsed)} ${unit}`);
    set('dash-card-month', `${formatAmount(monthUsed)} ${unit}`);
    set('dash-card-spent', fmtSheetMoney(spent, cur));
    set('dash-card-streak', streakDays ? `${streakDays} day${streakDays === 1 ? '' : 's'}` : '0 days');
    set('dash-card-month-cap', monthRemaining != null ? `${formatAmount(monthRemaining)} ${unit}` : '—');
}

function renderMiniUsageChart(containerId, buckets, emptyHint = 'No data yet') {
    const container = document.getElementById(containerId);
    if (!container) return;
    container.innerHTML = '';
    if (!buckets.length) {
        container.innerHTML = `<p class="empty-hint">${emptyHint}</p>`;
        return;
    }
    const max = Math.max(...buckets.map(b => b.value), 0.01);
    buckets.forEach(data => {
        const bar = document.createElement('div');
        bar.className = 'chart-bar chart-bar-insight';
        bar.style.height = `${Math.max((data.value / max) * 100, 4)}%`;
        bar.title = `${data.label}: ${formatAmount(data.value)}`;
        bar.innerHTML = `<span class="chart-bar-value">${formatAmount(data.value)}</span><span class="chart-bar-label">${data.label}</span>`;
        container.appendChild(bar);
    });
}

function buildDailyUsageBuckets(substanceId, days = 7) {
    const today = getLocalDateString();
    const buckets = [];
    for (let i = days - 1; i >= 0; i--) {
        const dateStr = addDaysToDateStr(today, -i);
        const d = parseLocalDate(dateStr);
        const label = d ? d.toLocaleDateString('en-US', { weekday: 'short' }) : dateStr.slice(5);
        buckets.push({
            label,
            value: isVapeNicotineSubstanceId(substanceId)
                ? getStatsUsageOnDate(substanceId, dateStr)
                : getUsedAmount(substanceId, dateStr)
        });
    }
    return buckets;
}

function buildWeeklyUsageBuckets(substanceId, weeks = 4) {
    const today = getLocalDateString();
    const buckets = [];
    for (let i = weeks - 1; i >= 0; i--) {
        const weekEnd = addDaysToDateStr(getWeekStartDateStr(today), -i * 7 + 6);
        const weekStart = addDaysToDateStr(weekEnd, -6);
        const used = isVapeNicotineSubstanceId(substanceId)
            ? getStatsUsageInRange(substanceId, weekStart, weekEnd)
            : getPersonalUseInRange(substanceId, weekStart, weekEnd)
                .reduce((s, l) => s + (parseFloat(l.amount) || 0), 0);
        buckets.push({ label: `W${weeks - i}`, value: used });
    }
    return buckets;
}

function buildMonthlyUsageBuckets(substanceId, months = 3) {
    const today = new Date();
    const buckets = [];
    for (let i = months - 1; i >= 0; i--) {
        const d = new Date(today.getFullYear(), today.getMonth() - i, 1);
        const monthStart = getLocalDateString(d);
        const monthEnd = getMonthEndDateStr(monthStart);
        const used = isVapeNicotineSubstanceId(substanceId)
            ? getStatsMonthUsageTotal(substanceId, monthEnd)
            : getMonthPersonalUseTotal(substanceId, monthEnd);
        const label = d.toLocaleDateString('en-US', { month: 'short' });
        buckets.push({ label, value: used });
    }
    return buckets;
}

function buildCostOverTimeBuckets(substanceId, days = 14) {
    const today = getLocalDateString();
    const buckets = [];
    for (let i = days - 1; i >= 0; i--) {
        const dateStr = addDaysToDateStr(today, -i);
        const cost = (appData.purchases || [])
            .filter(p => getPurchaseSubstanceId(p) === substanceId && p.date === dateStr)
            .reduce((s, p) => s + (parseFloat(getPurchaseTotalCost(p)) || 0), 0);
        const d = parseLocalDate(dateStr);
        buckets.push({
            label: d ? `${d.getMonth() + 1}/${d.getDate()}` : dateStr.slice(5),
            value: cost
        });
    }
    return buckets;
}

function getRecoveryInsightStats(substanceId) {
    const today = getLocalDateString();
    const monthStart = getMonthStartDateStr(today);
    const monthLogs = getPersonalUseInRange(substanceId, monthStart, today);
    const daysInMonth = countDaysInRange(monthStart, today);
    const totalMonth = monthLogs.reduce((s, l) => s + (parseFloat(l.amount) || 0), 0);
    const avgDaily = daysInMonth > 0 ? totalMonth / daysInMonth : 0;
    const byDay = new Map();
    monthLogs.forEach(l => {
        byDay.set(l.date, (byDay.get(l.date) || 0) + (parseFloat(l.amount) || 0));
    });
    let highestDay = '—';
    let highestAmt = 0;
    byDay.forEach((amt, date) => {
        if (amt > highestAmt) {
            highestAmt = amt;
            highestDay = formatDate(date);
        }
    });
    let noUseDays = 0;
    let d = monthStart;
    while (d <= today) {
        if (!byDay.has(d) || byDay.get(d) <= 0) noUseDays++;
        d = addDaysToDateStr(d, 1);
    }
    return { avgDaily, highestDay, highestAmt, noUseDays };
}

function renderDashboardRecoveryInsights(substanceId) {
    const wrap = document.getElementById('dash-recovery-insights');
    if (!wrap) return;
    if (isAllSubstancesView()) {
        const today = getLocalDateString();
        const entries = buildAllSubstancesUsageEntries(today, today);
        const top = entries.find(e => e.amount > 0);
        const insight = top
            ? `Highest use today: ${top.name} ${formatAmount(top.amount)} ${top.unit}.`
            : 'No personal use logged today across substances.';
        wrap.innerHTML = `<p class="dash-all-insight">${insight}</p><p class="settings-hint">Select a single substance for detailed taper/recovery insights.</p>`;
        ['insight-avg-daily', 'insight-highest-day', 'insight-no-use-days'].forEach(id => {
            const el = document.getElementById(id);
            if (el) el.textContent = '—';
        });
        ['insight-chart-day', 'insight-chart-week', 'insight-chart-month', 'insight-chart-cost'].forEach(id => {
            const el = document.getElementById(id);
            if (el) el.innerHTML = '';
        });
        return;
    }
    if (!substanceId) {
        wrap.innerHTML = '<p class="empty-hint">Select a substance to view recovery insights.</p>';
        return;
    }
    const stats = getRecoveryInsightStats(substanceId);
    const sub = getSubstance(substanceId);
    const unit = sub?.defaultUnit || 'units';
    const set = (id, text) => { const el = document.getElementById(id); if (el) el.textContent = text; };
    set('insight-avg-daily', `${formatAmount(stats.avgDaily)} ${unit}`);
    set('insight-highest-day', stats.highestAmt > 0 ? `${stats.highestDay} (${formatAmount(stats.highestAmt)} ${unit})` : '—');
    set('insight-no-use-days', String(stats.noUseDays));
    renderMiniUsageChart('insight-chart-day', buildDailyUsageBuckets(substanceId, 7));
    renderMiniUsageChart('insight-chart-week', buildWeeklyUsageBuckets(substanceId, 4));
    renderMiniUsageChart('insight-chart-month', buildMonthlyUsageBuckets(substanceId, 3));
    const costBuckets = buildCostOverTimeBuckets(substanceId, 14);
    const costContainer = document.getElementById('insight-chart-cost');
    if (costContainer) {
        costContainer.innerHTML = '';
        if (!costBuckets.some(b => b.value > 0)) {
            costContainer.innerHTML = '<p class="empty-hint">No purchases in range</p>';
        } else {
            const max = Math.max(...costBuckets.map(b => b.value), 0.01);
            const cur = getCurrencySymbol();
            costBuckets.forEach(data => {
                const bar = document.createElement('div');
                bar.className = 'chart-bar chart-bar-insight chart-bar-spend';
                bar.style.height = `${Math.max((data.value / max) * 100, 4)}%`;
                bar.innerHTML = `<span class="chart-bar-value">${cur}${formatAmount(data.value)}</span><span class="chart-bar-label">${data.label}</span>`;
                costContainer.appendChild(bar);
            });
        }
    }
}

function updateInventoryLowWarning(substanceId) {
    const el = document.getElementById('dash-inventory-warning');
    if (!el) return;
    if (isAllSubstancesView()) {
        const warnings = getAllSubstancesLowInventoryWarnings();
        if (warnings.length) {
            el.textContent = warnings.join(' ');
            el.classList.remove('hidden');
        } else {
            el.classList.add('hidden');
        }
        return;
    }
    if (!substanceId) {
        el.classList.add('hidden');
        return;
    }
    const remaining = getTotalRemainingSupply(substanceId);
    const sub = getSubstance(substanceId);
    const unit = getSubstanceDisplayUnit(substanceId);
    const name = getSubstanceDisplayName(sub);
    const purchases = (appData.purchases || []).filter(p => getPurchaseSubstanceId(p) === substanceId);
    const totalBought = purchases.reduce((s, p) => s + (parseFloat(getPurchaseQuantity(p)) || 0), 0);
    const pct = totalBought > 0 && remaining != null ? remaining / totalBought : null;
    if (pct != null && pct <= 0.15 && remaining > 0) {
        el.textContent = `Low inventory: ${name} about ${formatAmount(remaining)} ${unit} remaining.`;
        el.classList.remove('hidden');
    } else if (remaining != null && remaining <= INVENTORY_EPS) {
        el.textContent = `${name} inventory is depleted — log a purchase when you restock.`;
        el.classList.remove('hidden');
    } else {
        el.classList.add('hidden');
    }
}

function buildVapeDashboardMetrics(substanceId, data = appData) {
    const today = getLocalDateString();
    const weekStart = getWeekStartDateStr(today);
    const monthStart = getMonthStartDateStr(today);
    const weekPuffs = getStatsUsageInRange(substanceId, weekStart, today, data);
    const monthPuffs = getStatsUsageInRange(substanceId, monthStart, today, data);
    const weekDays = Math.max(1, Math.ceil((parseLocalDate(today) - parseLocalDate(weekStart)) / 86400000) + 1);
    const monthDays = Math.max(1, Math.ceil((parseLocalDate(today) - parseLocalDate(monthStart)) / 86400000) + 1);
    const vapeLogs = getUseLogsForSubstance(substanceId, { personalUseOnly: true, data })
        .filter(l => isVapeUseLog(l, data));
    const sessionLogs = vapeLogs.filter(l => getUseLogType(l) === 'session' || isVapeUseLog(l));
    const avgPuffsPerDay = monthPuffs / monthDays;
    const avgPuffsPerSession = sessionLogs.length
        ? sessionLogs.reduce((s, l) => s + getVapeLogPuffAmount(l), 0) / sessionLogs.length
        : null;
    const lastLog = vapeLogs.sort((a, b) => getVapeLogSortMs(b) - getVapeLogSortMs(a))[0] || null;
    const lastLogLabel = lastLog
        ? formatDatetimeLong(getUseLogEndedAt(lastLog) || getUseLogStartedAt(lastLog) || parseUseDateTime(lastLog.date, lastLog.startTime))
        : '—';
    const estimatedDailyFromPercent = vapeLogs.filter(l => l.estimatedFromPercent).length
        ? weekPuffs / weekDays
        : null;

    const activeVapes = (data.purchases || [])
        .filter(p => getPurchaseSubstanceId(p) === substanceId && isVapePuffPurchase(p, data))
        .filter(p => getPurchaseInventoryTab(p) === 'active');
    const primaryVape = activeVapes.sort((a, b) => getPurchaseDatetimeMs(b) - getPurchaseDatetimeMs(a))[0] || null;

    const monthPurchases = getPurchasesInDateRange(substanceId, monthStart, today, data).filter(isVapePuffPurchase);
    const allVapePurchases = getPurchasesForSubstance(substanceId, data).filter(isVapePuffPurchase);
    const monthSpend = monthPurchases.reduce((s, p) => s + (parseFloat(getPurchaseTotalCost(p)) || 0), 0);
    const allTimeSpend = allVapePurchases.reduce((s, p) => s + (parseFloat(getPurchaseTotalCost(p)) || 0), 0);
    const vapeCount = allVapePurchases.length;
    const avgCostPerVape = vapeCount > 0 ? allTimeSpend / vapeCount : null;
    const avgCostPerDay = monthSpend / monthDays;
    const costPer1000Puffs = monthPuffs > INVENTORY_EPS ? (monthSpend / monthPuffs) * 1000 : null;

    let nicotineUsedMg = null;
    let nicotineLeftMg = null;
    let nicotinePerDay = null;
    let totalNicotineMg = null;
    if (primaryVape) {
        const nic = getVapeNicotineMetrics(primaryVape);
        if (nic) {
            nicotineUsedMg = nic.nicotineUsedMg;
            nicotineLeftMg = nic.nicotineLeftMg;
            nicotinePerDay = nic.avgNicotineMgPerDay;
            totalNicotineMg = nic.totalNicotineMg;
        }
    }

    return {
        primaryVape,
        weekPuffs,
        monthPuffs,
        avgPuffsPerDay,
        avgPuffsPerSession,
        lastLogLabel,
        estimatedDailyFromPercent,
        avgCostPerVape,
        avgCostPerDay,
        costPer1000Puffs,
        monthSpend,
        allTimeSpend,
        totalNicotineMg,
        nicotineUsedMg,
        nicotinePerDay,
        nicotineLeftMg,
        activeVapeCount: activeVapes.length
    };
}

function renderVapeDashboardSection(substanceId) {
    const section = document.getElementById('vape-dashboard-section');
    if (!section) return;
    if (!substanceId || !isVapeNicotineSubstanceId(substanceId)) {
        section.classList.add('hidden');
        return;
    }
    section.classList.remove('hidden');
    const m = buildVapeDashboardMetrics(substanceId);
    const cur = getCurrencySymbol();
    const p = m.primaryVape;
    const status = p ? getVapePurchaseDisplayStatus(p) : { label: '—', className: '' };
    const name = p ? (p.notes || p.store || 'Vape') : 'No active vape';
    const lifecycle = p ? getVapePurchaseLifecycleMetrics(p) : null;
    const firstUseLabel = lifecycle?.firstUseAt
        ? formatDatetimeShort(lifecycle.firstUseAt.toISOString())
        : 'Not started';
    const set = (id, text) => { const el = document.getElementById(id); if (el) el.textContent = text; };

    set('vape-dash-name', name);
    set('vape-dash-purchase-date', p ? formatDate(p.date) : '—');
    set('vape-dash-started', firstUseLabel);
    set('vape-dash-full-puffs', p ? formatAmount(getVapeFullPuffCount(p)) : '—');
    set('vape-dash-puffs-left', p ? formatAmount(getPurchaseRemainingAmount(p)) : '—');
    set('vape-dash-percent-left', p ? `${getPurchasePercentRemaining(p)}%` : '—');
    const statusEl = document.getElementById('vape-dash-status');
    if (statusEl) {
        statusEl.textContent = status.label;
        statusEl.className = `vape-dash-status ${status.className}`;
    }

    set('vape-dash-week-puffs', formatAmount(m.weekPuffs));
    set('vape-dash-month-puffs', formatAmount(m.monthPuffs));
    set('vape-dash-avg-day', m.avgPuffsPerDay != null ? formatAmount(m.avgPuffsPerDay) : '—');
    set('vape-dash-avg-session', m.avgPuffsPerSession != null ? formatAmount(m.avgPuffsPerSession) : '—');
    set('vape-dash-last-log', m.lastLogLabel);
    set('vape-dash-est-daily', m.estimatedDailyFromPercent != null ? `~${formatAmount(m.estimatedDailyFromPercent)} puffs/day` : '—');

    set('vape-dash-avg-cost-vape', m.avgCostPerVape != null ? fmtSheetMoney(m.avgCostPerVape, cur) : '—');
    set('vape-dash-cost-day', m.avgCostPerDay != null ? fmtSheetMoney(m.avgCostPerDay, cur) : '—');
    set('vape-dash-cost-1k', m.costPer1000Puffs != null ? fmtSheetMoney(m.costPer1000Puffs, cur) : '—');
    set('vape-dash-month-spend', fmtSheetMoney(m.monthSpend, cur));
    set('vape-dash-all-spend', fmtSheetMoney(m.allTimeSpend, cur));

    set('vape-dash-total-nic', m.totalNicotineMg != null ? `${formatAmount(m.totalNicotineMg)} mg` : '—');
    set('vape-dash-nic-used', m.nicotineUsedMg != null ? `${formatAmount(m.nicotineUsedMg)} mg` : '—');
    set('vape-dash-nic-day', m.nicotinePerDay != null ? `${formatAmount(m.nicotinePerDay)} mg/day` : '—');
    set('vape-dash-nic-left', m.nicotineLeftMg != null ? `${formatAmount(m.nicotineLeftMg)} mg` : '—');
}

// ——— Dashboard ———
function updateDashboard() {
    const set = (id, text) => { const el = document.getElementById(id); if (el) el.textContent = text; };

    const todayStats = isAllSubstancesView()
        ? aggregateTodayUseStats()
        : getTodayUseStats(currentSubstanceId);

    const unitLabel = isAllSubstancesView() ? 'uses' : (getSubstance(currentSubstanceId)?.defaultUnit || 'units');
    const sessionLabel = todayStats.sessionCount === 1 ? 'session' : 'sessions';

    set('dash-today-total-use', `${todayStats.totalAmount.toFixed(1)} ${unitLabel}`);
    set('dash-today-session-count', `${todayStats.sessionCount} ${sessionLabel}`);
    set('dash-today-duration', `Duration: ${formatTodayDuration(todayStats.totalDurationHours)}`);
    set('dash-today-avg-session', todayStats.avgPerSession != null
        ? `Avg/session: ${todayStats.avgPerSession.toFixed(1)} ${unitLabel}`
        : 'Avg/session: —');

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
        updateRecoveryStreakDisplay(currentSubstanceId);
    } else {
        const best = getAllSubstancesBestStreak();
        set('recovery-streak-current', best.days ? `${best.days} day${best.days === 1 ? '' : 's'}` : '0 days');
        set('recovery-streak-since', best.name ? `Best streak: ${best.name}` : 'All substances');
        const bestEl = document.getElementById('recovery-streak-best');
        if (bestEl) bestEl.textContent = '—';
    }

    updateCurrentSupplyDashboard();
    renderSubstanceCompare();
    updateQuickActions();
    updateDashboardMainDisplay();
    updateBreakMetricsDashboard();

    const dashSubId = isAllSubstancesView() ? null : currentSubstanceId;
    renderDashboardSummaryCards(dashSubId);
    renderVapeDashboardSection(dashSubId);
    renderNextBestAction(dashSubId);
    renderDashboardRecoveryInsights(dashSubId);
    updateInventoryLowWarning(dashSubId);
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
    const viewingEl = document.getElementById('dashboard-viewing-label');
    const main = getMainSubstance();
    if (el) el.textContent = main ? `Main: ${getSubstanceDisplayName(main)}` : 'Main: —';
    if (viewingEl) {
        viewingEl.textContent = isAllSubstancesView()
            ? 'Viewing: All Substances'
            : `Viewing: ${getSubstanceDisplayName(getSubstance(currentSubstanceId))}`;
    }
}

function renderSubstanceCompare() {
    const container = document.getElementById('substance-compare');
    if (!container) return;

    if (!isAllSubstancesView()) {
        container.classList.add('hidden');
        return;
    }

    container.classList.remove('hidden');
    const today = getLocalDateString();
    container.innerHTML = '<h3>Today by Substance</h3>';

    const grid = document.createElement('div');
    grid.className = 'compare-grid';

    getActiveSubstances().forEach(sub => {
        const amount = getSubstanceUsageAmountForDate(sub.id, today);
        const unit = getSubstanceDisplayUnit(sub.id);
        const name = getSubstanceDisplayName(sub);
        const spent = getSubstancePurchaseSpend(sub.id, p => p.date === today);
        const { days } = computeRecoveryStreakDays(sub.id);
        const card = document.createElement('div');
        card.className = 'compare-card';
        card.style.borderTopColor = sub.color;
        card.innerHTML = `
            <div class="compare-header">${sub.icon} ${name}</div>
            <div class="compare-stat"><span>Uses</span><strong>${formatAmount(amount)} ${unit}</strong></div>
            ${sub.costTrackingEnabled ? `<div class="compare-stat"><span>Spent</span><strong>${getCurrencySymbol()}${spent.toFixed(2)}</strong></div>` : ''}
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
        .sort((a, b) => getLogDatetimeMs(b) - getLogDatetimeMs(a))[0] || null;
}

function computeRecoveryStreakDays(substanceId) {
    const lastUse = getLastUseForSubstance(substanceId);
    if (!lastUse) return { days: 0, sinceLabel: 'No use logged yet' };
    const diffMs = Date.now() - getLogDatetimeMs(lastUse);
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
    return getLocalDateString(date);
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
    const start = parseLocalDate(startDate);
    const end = parseLocalDate(endDate);
    if (!start || !end) return 1;
    return Math.max(1, Math.floor((end - start) / 86400000) + 1);
}

function getStatsChartGrouping(startDate, endDate) {
    const days = countDaysInRange(startDate, endDate);
    if (days > 90) return 'month';
    if (days > 14) return 'week';
    return 'day';
}

function calculateSessionDurationMinutes(log) {
    if (isWeedDateOnlyUseLog(log)) return null;
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

function buildUseStatsMetrics(logs, daysInRange, substanceId, bounds = null) {
    if (isVapeNicotineSubstanceId(substanceId) && bounds) {
        return buildVapeUseStatsMetrics(logs, daysInRange, substanceId, bounds);
    }
    const base = calculateUseStats(logs);
    const personalLogs = (logs || []).filter(isPersonalUseLog);
    const useDays = new Set(personalLogs.map(l => l.date)).size;
    const useDayPct = daysInRange > 0 ? (useDays / daysInRange) * 100 : 0;
    const avgPerUseDay = useDays > 0 ? base.totalAmount / useDays : null;
    const avgPerCalendarDay = daysInRange > 0 ? base.totalAmount / daysInRange : null;

    if (isWeedTrackingMode(substanceId)) {
        return {
            ...base,
            avgPerHour: null,
            totalDurationMinutes: 0,
            avgDurationMinutes: null,
            longestMinutes: null,
            shortestMinutes: null,
            useDays,
            useDayPct,
            avgPerUseDay,
            avgPerCalendarDay,
            longestBreakHours: null,
            shortestBreakHours: null,
            avgBreakHours: null
        };
    }

    const enrichedAll = substanceId ? buildEnrichedUseEntries(substanceId) : [];
    const enrichedById = new Map();
    enrichedAll.forEach(e => {
        if (e.id != null) enrichedById.set(String(e.id), e);
    });
    const breakHoursList = personalLogs
        .map(log => enrichedById.get(String(log.id))?.breakDurationHours)
        .filter(h => h != null && h >= 0);

    return {
        ...base,
        useDays,
        useDayPct,
        avgPerUseDay,
        avgPerCalendarDay,
        longestBreakHours: breakHoursList.length ? Math.max(...breakHoursList) : null,
        shortestBreakHours: breakHoursList.length ? Math.min(...breakHoursList) : null,
        avgBreakHours: breakHoursList.length
            ? breakHoursList.reduce((sum, h) => sum + h, 0) / breakHoursList.length
            : null
    };
}

function getVapePurchasesInStatsRange(substanceId, startDate, endDate, data = appData) {
    return (data.purchases || []).filter(p =>
        getPurchaseSubstanceId(p) === substanceId
        && isVapePuffPurchase(p)
        && p.date >= startDate
        && p.date <= endDate
    );
}

function getVapeTotalSupplyDurationDaysInRange(substanceId, startDate, endDate, data = appData) {
    let totalMs = 0;
    getUseLogsForSubstance(substanceId, { personalUseOnly: true, data }).forEach(log => {
        if (!isVapeUseLog(log, data) || log.needsReview) return;
        const inRange = getVapeLogStatsAllocations(log, data).some(
            a => a.date >= startDate && a.date <= endDate && a.amount > INVENTORY_EPS
        );
        if (!inRange) return;
        const durationMs = getVapeLogDurationMs(log);
        if (durationMs != null && durationMs > 0) totalMs += durationMs;
    });
    return totalMs / 86400000;
}

function getVapeUseDayCountInRange(substanceId, startDate, endDate, data = appData) {
    const dates = new Set();
    getUseLogsForSubstance(substanceId, { personalUseOnly: true, data }).forEach(log => {
        if (!isVapeUseLog(log, data) || log.needsReview || !log.date) return;
        if (log.date >= startDate && log.date <= endDate) dates.add(log.date);
    });
    return dates.size;
}

function getVapeInventoryStatsSnapshot(substanceId, data = appData) {
    const active = (data.purchases || [])
        .filter(p => getPurchaseSubstanceId(p) === substanceId && isVapePuffPurchase(p))
        .filter(p => getPurchaseInventoryTab(p) === 'active');
    if (!active.length) return { puffsRemaining: null, percentLeft: null };
    let totalRemaining = 0;
    let totalFull = 0;
    active.forEach(p => {
        totalFull += getVapeFullPuffCount(p);
        totalRemaining += getPurchaseRemainingAmount(p);
    });
    return {
        puffsRemaining: totalRemaining,
        percentLeft: totalFull > 0 ? Math.round((totalRemaining / totalFull) * 100) : null
    };
}

function buildVapeUseStatsMetrics(logs, daysInRange, substanceId, bounds) {
    const personalLogs = (logs || []).filter(isPersonalUseLog);
    const totalAmount = getStatsUsageInRange(substanceId, bounds.startDate, bounds.endDate);
    const useDayCount = getVapeUseDayCountInRange(substanceId, bounds.startDate, bounds.endDate);
    const avgPuffsPerDay = useDayCount > 0 ? totalAmount / useDayCount : null;
    const vapePurchases = getVapePurchasesInStatsRange(substanceId, bounds.startDate, bounds.endDate);
    const vapeCount = vapePurchases.length;
    const vapePurchaseCost = vapePurchases.reduce(
        (sum, p) => sum + (parseFloat(getPurchaseTotalCost(p)) || 0),
        0
    );
    const avgCostPerVape = vapeCount > 0 ? vapePurchaseCost / vapeCount : null;
    const costPerPuff = totalAmount > INVENTORY_EPS && vapePurchaseCost > 0
        ? vapePurchaseCost / totalAmount
        : null;

    const finishedDurationsMs = getVapeFinishedSupplyDurationsInRange(
        substanceId,
        bounds.startDate,
        bounds.endDate
    );
    const avgDaysPerVape = finishedDurationsMs.length
        ? (finishedDurationsMs.reduce((s, ms) => s + ms, 0) / finishedDurationsMs.length) / 86400000
        : null;
    const activeVapes = (appData.purchases || [])
        .filter(p => getPurchaseSubstanceId(p) === substanceId && isVapePuffPurchase(p))
        .filter(p => getPurchaseInventoryTab(p) === 'active').length;
    const sessionPuffLogs = personalLogs.filter(isVapeUseLog);
    const avgPuffsPerSession = sessionPuffLogs.length
        ? totalAmount / sessionPuffLogs.length
        : null;
    const monthDays = Math.max(1, Math.ceil(
        (parseLocalDate(bounds.endDate) - parseLocalDate(bounds.startDate)) / 86400000
    ) + 1);
    const avgCostPerDay = vapePurchaseCost > 0 ? vapePurchaseCost / monthDays : null;
    let nicotineMgPerDay = null;
    const activeVape = getActivePurchasesForSubstance(substanceId).find(isVapePuffPurchase);
    if (activeVape) {
        const nic = getVapeNicotineMetrics(activeVape);
        nicotineMgPerDay = nic?.avgNicotineMgPerDay ?? null;
    }
    const avgDurationMinutes = finishedDurationsMs.length
        ? finishedDurationsMs.reduce((s, ms) => s + ms, 0) / finishedDurationsMs.length / 60000
        : null;
    const currentSupplyDurationMs = getVapeCurrentSupplyDurationMs(substanceId);
    const inventorySnapshot = getVapeInventoryStatsSnapshot(substanceId);

    return {
        totalAmount,
        avgPuffsPerDay,
        avgPuffsPerSession,
        vapeCount,
        activeVapes,
        avgCostPerVape,
        avgCostPerDay,
        avgDaysPerVape,
        nicotineMgPerDay,
        costPerPuff,
        avgDurationMinutes,
        currentSupplyDurationMs,
        puffsRemaining: inventorySnapshot.puffsRemaining,
        percentLeft: inventorySnapshot.percentLeft,
        sessionCount: personalLogs.filter(isVapeUseLog).length,
        avgPerSession: null,
        avgPerHour: null,
        totalDurationMinutes: 0,
        longestMinutes: null,
        shortestMinutes: null,
        useDays: 0,
        useDayPct: 0,
        avgPerUseDay: null,
        avgPerCalendarDay: null,
        longestBreakHours: null,
        shortestBreakHours: null,
        avgBreakHours: null
    };
}

function formatUseStatValue(statId, metrics, unit) {
    const fmtUsage = (value) => isVapeNicotineSubstanceId(currentSubstanceId)
        ? formatStatsPuffs(value)
        : value.toFixed(1);
    const isWeed = isWeedTrackingMode(currentSubstanceId);
    if (isWeed && WEED_EXCLUDED_USE_STAT_IDS.has(statId)) return '—';
    switch (statId) {
        case 'totalUsage':
            return `${fmtUsage(metrics.totalAmount)} ${unit}`;
        case 'sessionCount':
            return String(metrics.sessionCount);
        case 'avgPerSession':
            return metrics.avgPerSession != null ? `${fmtUsage(metrics.avgPerSession)} ${unit}` : '—';
        case 'avgPerHr':
            return metrics.avgPerHour != null ? `${metrics.avgPerHour.toFixed(2)} ${unit}/hr` : '—';
        case 'totalDuration':
            return metrics.totalDurationMinutes > 0
                ? formatDurationHours(metrics.totalDurationMinutes / 60)
                : '—';
        case 'avgDuration':
            if (isVapeNicotineSubstanceId(currentSubstanceId)) {
                return metrics.avgDurationMinutes != null
                    ? formatVapeDuration(metrics.avgDurationMinutes * 60000)
                    : '—';
            }
            return metrics.avgDurationMinutes != null
                ? formatDurationHours(metrics.avgDurationMinutes / 60)
                : '—';
        case 'currentSupplyDuration':
            return metrics.currentSupplyDurationMs != null
                ? `${formatVapeDuration(metrics.currentSupplyDurationMs)} so far`
                : '—';
        case 'longestSession':
            return metrics.longestMinutes != null
                ? formatDurationHours(metrics.longestMinutes / 60)
                : '—';
        case 'shortestSession':
            return metrics.shortestMinutes != null
                ? formatDurationHours(metrics.shortestMinutes / 60)
                : '—';
        case 'longestBreak':
            return metrics.longestBreakHours != null
                ? formatBreakFromHours(metrics.longestBreakHours)
                : '—';
        case 'shortestBreak':
            return metrics.shortestBreakHours != null
                ? formatBreakFromHours(metrics.shortestBreakHours)
                : '—';
        case 'avgBreak':
            if (isVapeNicotineSubstanceId(currentSubstanceId)) {
                return metrics.avgBreakHours != null
                    ? formatBreakFromHours(metrics.avgBreakHours)
                    : '—';
            }
            return metrics.avgBreakHours != null
                ? formatBreakFromHours(metrics.avgBreakHours)
                : '—';
        case 'useDays':
            return String(metrics.useDays);
        case 'useDayPct':
            return `${metrics.useDayPct.toFixed(2)}%`;
        case 'avgPerUseDay':
            return metrics.avgPerUseDay != null ? `${fmtUsage(metrics.avgPerUseDay)} ${unit}` : '—';
        case 'avgPerCalendarDay':
            return metrics.avgPerCalendarDay != null ? `${fmtUsage(metrics.avgPerCalendarDay)} ${unit}` : '—';
        case 'avgPuffsPerDay':
            return formatStatsPuffsPerDay(metrics.avgPuffsPerDay);
        case 'avgPuffsPerSession':
            return metrics.avgPuffsPerSession != null ? `${formatAmount(metrics.avgPuffsPerSession)} puffs` : '—';
        case 'vapeCount':
            return String(metrics.vapeCount ?? 0);
        case 'activeVapes':
            return String(metrics.activeVapes ?? 0);
        case 'avgCostPerVape':
            return formatCostPerVape(metrics.avgCostPerVape, getCurrencySymbol());
        case 'avgCostPerDay':
            return metrics.avgCostPerDay != null ? `${getCurrencySymbol()}${metrics.avgCostPerDay.toFixed(2)}/day` : '—';
        case 'avgDaysPerVape':
            return metrics.avgDaysPerVape != null ? `~${metrics.avgDaysPerVape.toFixed(1)} days` : '—';
        case 'nicotineMgPerDay':
            return metrics.nicotineMgPerDay != null ? `${formatAmount(metrics.nicotineMgPerDay)} mg/day` : '—';
        case 'puffsRemaining':
            return metrics.puffsRemaining != null ? `${formatAmount(metrics.puffsRemaining)} puffs` : '—';
        case 'percentLeft':
            return metrics.percentLeft != null ? `${metrics.percentLeft}%` : '—';
        default:
            return '—';
    }
}

function getUseStatLabel(statId, unit) {
    return getUseStatLabelForSubstance(statId, currentSubstanceId, unit);
}

function renderUseStatsCards(metrics, unit) {
    const grid = document.getElementById('use-stats-cards-grid');
    if (!grid) return;

    const visible = getVisibleUseStatsOrderForSubstance(currentSubstanceId);
    if (!visible.length) {
        grid.innerHTML = '<p class="empty-hint">No stats selected. Tap Edit Stats to choose cards.</p>';
        return;
    }

    grid.innerHTML = visible.map(statId => {
        const label = getUseStatLabel(statId, unit);
        const value = formatUseStatValue(statId, metrics, unit);
        return `<div class="stat-card use-stat-card">
            <h3>${label}</h3>
            <p class="stat-value">${value}</p>
        </div>`;
    }).join('');
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

// ——— Spreadsheet-style status badges ———
function mapTaperStatusToBadge(status) {
    if (status === 'under') return 'good';
    if (status === 'close' || status === 'on-track') return 'caution';
    if (status === 'over') return 'risk';
    return 'none';
}

function getUsageVsTargetBadge(used, target) {
    if (target == null || target <= 0) return { level: 'none', label: '—' };
    const pct = used / target;
    if (pct > 1) return { level: 'risk', label: 'Over' };
    if (pct >= 0.9) return { level: 'high', label: 'High' };
    if (pct >= 0.7) return { level: 'caution', label: 'Caution' };
    return { level: 'good', label: 'Good' };
}

function getBreakTimeBadge(hours) {
    if (hours == null || Number.isNaN(hours)) return { level: 'none', label: '—' };
    if (hours < 1) return { level: 'risk', label: 'Short' };
    if (hours < 12) return { level: 'high', label: 'Low' };
    if (hours < 48) return { level: 'caution', label: 'OK' };
    return { level: 'good', label: 'Long' };
}

function getSupplyRemainingBadge(pctRemaining) {
    if (pctRemaining == null || Number.isNaN(pctRemaining)) return { level: 'none', label: '—' };
    if (pctRemaining <= 0.1) return { level: 'risk', label: 'Low' };
    if (pctRemaining <= 0.25) return { level: 'high', label: 'Getting low' };
    if (pctRemaining <= 0.5) return { level: 'caution', label: 'Half' };
    return { level: 'good', label: 'OK' };
}

function renderStatusBadge(level, label) {
    if (!level || level === 'none') return `<span class="status-badge status-none">${label || '—'}</span>`;
    return `<span class="status-badge status-${level}">${label}</span>`;
}

function renderSheetMetricCard(label, value, badge) {
    const badgeHtml = badge ? renderStatusBadge(badge.level, badge.label) : '';
    return `<div class="sheet-metric-card"><span class="sheet-metric-label">${label}</span><strong class="sheet-metric-value">${value}</strong>${badgeHtml}</div>`;
}

function renderConfigurableSheetTable(tableKey, rows, renderCell, substanceId = currentSubstanceId) {
    const order = getEffectiveColumnOrder(tableKey);
    if (!rows.length) return '<p class="empty-hint">No data yet.</p>';
    let html = '<div class="table-scroll"><table class="sheet-table"><thead><tr>';
    order.forEach(colId => {
        html += `<th>${getTableColumnLabelForSubstance(tableKey, colId, substanceId)}</th>`;
    });
    html += '</tr></thead><tbody>';
    rows.forEach(rowData => {
        html += '<tr>';
        order.forEach(colId => {
            const cell = renderCell(colId, rowData);
            if (cell && typeof cell === 'object' && cell.html) {
                html += `<td>${cell.html}</td>`;
            } else {
                html += `<td>${cell ?? '—'}</td>`;
            }
        });
        html += '</tr>';
    });
    html += '</tbody></table></div>';
    return html;
}

function renderSheetTable(headers, rows) {
    if (!rows.length) return '<p class="empty-hint">No data yet.</p>';
    let html = '<div class="table-scroll"><table class="sheet-table"><thead><tr>';
    headers.forEach(h => { html += `<th>${h}</th>`; });
    html += '</tr></thead><tbody>';
    rows.forEach(row => {
        html += '<tr>';
        row.forEach(cell => {
            if (cell && typeof cell === 'object' && cell.html) {
                html += `<td>${cell.html}</td>`;
            } else {
                html += `<td>${cell ?? '—'}</td>`;
            }
        });
        html += '</tr>';
    });
    html += '</tbody></table></div>';
    return html;
}

function formatSupplyDurationDays(days) {
    if (days == null || !Number.isFinite(days) || days <= 0) return '—';
    return `~${formatAmount(days, 1)} days`;
}

function formatBuySheetDate(dateStr) {
    const d = parseLocalDate(dateStr);
    if (!d) return dateStr || '—';
    const month = d.getMonth() + 1;
    const day = d.getDate();
    const year = String(d.getFullYear()).slice(-2);
    return `${month}/${day}/${year}`;
}

function getEffectiveDaysInMonth(monthStart, monthEnd, daysInMonth) {
    const today = getLocalDateString();
    if (today < monthStart || today > monthEnd) return daysInMonth;
    let count = 0;
    let d = monthStart;
    while (d <= monthEnd && d <= today) {
        count++;
        d = addDaysToDateStr(d, 1);
    }
    return count || daysInMonth;
}

function getMonthUsageTotal(substanceId, monthStart, monthEnd) {
    const today = getLocalDateString();
    const end = monthEnd < today ? monthEnd : today;
    if (end < monthStart) return 0;
    let total = 0;
    let d = monthStart;
    while (d <= end) {
        total += getUsedAmount(substanceId, d);
        d = addDaysToDateStr(d, 1);
    }
    return total;
}

function formatSupplyDurationDaysHours(days) {
    if (days == null || !Number.isFinite(days) || days <= 0) return '—';
    const totalHours = Math.round(days * 24);
    const wholeDays = Math.floor(totalHours / 24);
    const hours = totalHours % 24;
    const dayWord = wholeDays === 1 ? 'day' : 'days';
    const hourWord = hours === 1 ? 'hr' : 'hrs';
    if (wholeDays === 0) return `0 day, ${hours} ${hourWord}`;
    if (hours === 0) return `${wholeDays} ${dayWord}, 0 ${hourWord}`;
    return `${wholeDays} ${dayWord}, ${hours} ${hourWord}`;
}

function fmtSheetMoney(value, cur = getCurrencySymbol()) {
    if (value == null || Number.isNaN(value)) return '—';
    const num = parseFloat(value);
    if (!Number.isFinite(num)) return '—';
    return `${cur}${num.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function fmtSheetAmount(value, unit) {
    if (value == null || Number.isNaN(value)) return '—';
    return formatAmountWithUnit(value, unit);
}

function fmtSheetRate(value, unit, suffix) {
    if (value == null || Number.isNaN(value)) return '—';
    return `${formatAmount(value)} ${unit}${suffix || ''}`;
}

function enrichMonthlySummaryWithBuyData(summary, substanceId) {
    const purchases = (appData.purchases || []).filter(p =>
        getPurchaseSubstanceId(p) === substanceId
        && p.date >= summary.monthStart
        && p.date <= summary.monthEnd
    );
    const purchasedAmount = purchases.reduce((s, p) => s + (parseFloat(getPurchaseQuantity(p)) || 0), 0);
    const cost = purchases.reduce((s, p) => s + (parseFloat(getPurchaseTotalCost(p)) || 0), 0);
    return { ...summary, purchasedAmount, cost };
}

function calculateWeeklyTrackingSummary(substanceId, weekStart, weekEnd) {
    const enriched = buildEnrichedUseEntries(substanceId);
    const weekEntries = enriched.filter(e => isPersonalUseLog(e) && e.date >= weekStart && e.date <= weekEnd);
    const isVape = isVapeNicotineSubstanceId(substanceId);

    let totalUsage;
    let avgBreak;
    let longestBreak;
    let shortestBreak;
    let avgDurationHours;
    let totalDurationHours = 0;
    let gPerHour = null;

    if (isVape) {
        totalUsage = getStatsUsageInRange(substanceId, weekStart, weekEnd);
        const breakHours = getVapePurchaseBreakHoursList(substanceId, weekStart, weekEnd);
        avgBreak = breakHours.length ? breakHours.reduce((a, b) => a + b, 0) / breakHours.length : null;
        longestBreak = breakHours.length ? Math.max(...breakHours) : null;
        shortestBreak = breakHours.length ? Math.min(...breakHours) : null;
        const supplyDurMs = getVapeFinishedSupplyDurationsInRange(substanceId, weekStart, weekEnd);
        totalDurationHours = supplyDurMs.reduce((s, ms) => s + ms, 0) / 3600000;
        avgDurationHours = supplyDurMs.length
            ? totalDurationHours / supplyDurMs.length
            : null;
    } else {
        totalUsage = weekEntries.reduce((s, e) => s + (parseFloat(e.amount) || 0), 0);
        weekEntries.forEach(e => { if (e.durationHours) totalDurationHours += e.durationHours; });
        avgDurationHours = weekEntries.length > 0 ? totalDurationHours / weekEntries.length : null;
        const breaks = weekEntries.map(e => e.breakDurationHours).filter(h => h != null && h >= 0);
        avgBreak = breaks.length ? breaks.reduce((a, b) => a + b, 0) / breaks.length : null;
        longestBreak = breaks.length ? Math.max(...breaks) : null;
        shortestBreak = breaks.length ? Math.min(...breaks) : null;
    }

    const sessions = isVape
        ? weekEntries.filter(e => isVapeUseLog(e)).length
        : weekEntries.length;
    const avgPerSession = sessions > 0 ? totalUsage / sessions : null;
    if (!isVape) {
        gPerHour = totalDurationHours > 0 ? totalUsage / totalDurationHours : null;
    }
    const goalUse = getWeeklyLimit(substanceId, weekStart);
    const left = goalUse != null && goalUse > 0 ? goalUse - totalUsage : null;
    const usageBadge = getUsageVsTargetBadge(totalUsage, goalUse);
    return {
        weekStart,
        weekEnd,
        totalUsage,
        sessions,
        totalDurationHours,
        avgDurationHours,
        avgPerSession,
        gPerHour,
        avgBreak,
        longestBreak,
        shortestBreak,
        goalUse,
        left,
        usageBadge
    };
}

function getMonthSplitWeekRangeForDate(dateStr) {
    const monthStart = getMonthStartDateStr(dateStr);
    const monthEnd = getMonthEndDateStr(dateStr);
    const calendarWeekStart = getWeekStartDateStr(dateStr);
    const calendarWeekEnd = addDaysToDateStr(calendarWeekStart, 6);
    const weekStart = calendarWeekStart < monthStart ? monthStart : calendarWeekStart;
    const weekEnd = calendarWeekEnd > monthEnd ? monthEnd : calendarWeekEnd;
    return { weekStart, weekEnd };
}

function getMonthSplitWeekRangeKey(range) {
    return `${range.weekStart}_${range.weekEnd}`;
}

function buildMonthSplitWeeklyRanges(entries, dateGetter, limit = null) {
    if (!entries?.length) return [];
    const rangeMap = new Map();
    entries.forEach(entry => {
        const dateStr = dateGetter(entry);
        if (!dateStr) return;
        const range = getMonthSplitWeekRangeForDate(dateStr);
        const key = getMonthSplitWeekRangeKey(range);
        if (!rangeMap.has(key)) rangeMap.set(key, range);
    });
    let ranges = [...rangeMap.values()].sort((a, b) =>
        a.weekStart.localeCompare(b.weekStart) || a.weekEnd.localeCompare(b.weekEnd)
    );
    if (limit != null && limit > 0) {
        ranges = ranges.slice(-limit);
    }
    return ranges;
}

function buildMonthSplitWeeklyRows(entries, amountGetter, dateGetter, limit = null) {
    const ranges = buildMonthSplitWeeklyRanges(entries, dateGetter, limit);
    let monthRunning = 0;
    let currentMonthKey = null;
    return ranges.map(range => {
        const monthKey = range.weekStart.slice(0, 7);
        if (monthKey !== currentMonthKey) {
            currentMonthKey = monthKey;
            monthRunning = 0;
        }
        const amount = entries
            .filter(entry => {
                const dateStr = dateGetter(entry);
                return dateStr && dateStr >= range.weekStart && dateStr <= range.weekEnd;
            })
            .reduce((sum, entry) => sum + (parseFloat(amountGetter(entry)) || 0), 0);
        monthRunning += amount;
        return {
            weekStart: range.weekStart,
            weekEnd: range.weekEnd,
            amount,
            monthRunning: roundTaperValue(monthRunning)
        };
    });
}

function getWeeklyTrackingSummaries(substanceId, limit = 12) {
    const logs = getUseLogsForSubstance(substanceId, { sortAsc: true, personalUseOnly: true });
    const isVape = isVapeNicotineSubstanceId(substanceId);
    let baseRows = [];
    if (isVape) {
        const distributedEntries = [];
        getVapeDistributedUsageMap(substanceId).forEach((amount, date) => {
            if (amount > INVENTORY_EPS) distributedEntries.push({ date, amount });
        });
        const rangeSource = distributedEntries.length ? distributedEntries : logs;
        if (!rangeSource.length) return [];
        baseRows = buildMonthSplitWeeklyRows(rangeSource, e => e.amount || 0, e => e.date, limit);
    } else {
        if (!logs.length) return [];
        baseRows = buildMonthSplitWeeklyRows(logs, log => log.amount, log => log.date, limit);
    }
    return baseRows.slice().reverse().map(row => ({
        ...calculateWeeklyTrackingSummary(substanceId, row.weekStart, row.weekEnd),
        runningTotal: roundTaperValue(
            isVapeNicotineSubstanceId(substanceId)
                ? getStatsMonthUsageTotal(substanceId, row.weekEnd)
                : getMonthPersonalUseTotal(substanceId, row.weekEnd)
        )
    }));
}

function getBuyWeeklySummaries(substanceId, limit = 8) {
    const purchases = (appData.purchases || [])
        .filter(p => getPurchaseSubstanceId(p) === substanceId);
    if (!purchases.length) return [];
    const baseRows = buildMonthSplitWeeklyRows(
        purchases,
        p => getPurchaseQuantity(p),
        p => p.date,
        limit
    );
    const sub = getSubstance(substanceId);
    const unit = sub?.defaultUnit || 'units';
    const cur = getCurrencySymbol();
    return baseRows.slice().reverse().map(row => {
        const { weekStart, weekEnd, amount: purchased } = row;
        const weekPurchases = purchases.filter(p => p.date >= weekStart && p.date <= weekEnd);
        const cost = weekPurchases.reduce((s, p) => s + (parseFloat(getPurchaseTotalCost(p)) || 0), 0);
        const costPerUnit = purchased > 0 ? cost / purchased : null;
        const daysInWeek = countDaysInRange(weekStart, weekEnd);
        const weekUsed = isVapeNicotineSubstanceId(substanceId)
            ? getStatsUsageInRange(substanceId, weekStart, weekEnd)
            : getPersonalUseInRange(substanceId, weekStart, weekEnd)
                .reduce((s, l) => s + (parseFloat(l.amount) || 0), 0);
        const gPerDay = weekUsed > 0 && daysInWeek > 0 ? weekUsed / daysInWeek : null;
        const supplyDuration = gPerDay > 0 ? purchased / gPerDay : null;
        return {
            weekStart,
            weekEnd,
            purchased,
            cost,
            costPerUnit,
            gPerDay,
            supplyDuration,
            monthRunning: roundTaperValue(getMonthPurchaseTotal(substanceId, weekEnd)),
            unit,
            cur
        };
    });
}

function getBuyMonthlySummaries(substanceId, limit = 12) {
    const purchases = (appData.purchases || [])
        .filter(p => getPurchaseSubstanceId(p) === substanceId);
    if (!purchases.length) return [];

    const monthSet = new Set();
    purchases.forEach(p => {
        if (p.date) monthSet.add(p.date.slice(0, 7));
    });

    const months = [...monthSet].sort().reverse().slice(0, limit);
    const sub = getSubstance(substanceId);
    const unit = sub?.defaultUnit || 'units';
    const cur = getCurrencySymbol();

    return months.map(monthKey => {
        const [yearStr, monthStr] = monthKey.split('-');
        const year = parseInt(yearStr, 10);
        const monthIndex = parseInt(monthStr, 10) - 1;
        const { monthStart, monthEnd, daysInMonth } = getTaperCalendarMonthBounds(year, monthIndex);
        const monthPurchases = purchases.filter(p => p.date >= monthStart && p.date <= monthEnd);
        const purchased = monthPurchases.reduce((s, p) => s + (parseFloat(getPurchaseQuantity(p)) || 0), 0);
        const cost = monthPurchases.reduce((s, p) => s + (parseFloat(getPurchaseTotalCost(p)) || 0), 0);
        const costPerUnit = purchased > 0 ? cost / purchased : null;
        const effectiveDays = getEffectiveDaysInMonth(monthStart, monthEnd, daysInMonth);
        const monthUsage = getMonthUsageTotal(substanceId, monthStart, monthEnd);
        const avgDailyUse = effectiveDays > 0 && monthUsage > 0 ? monthUsage / effectiveDays : null;
        const gPerDay = avgDailyUse;
        const supplyDurationDays = avgDailyUse > 0 && purchased > 0 ? purchased / avgDailyUse : null;

        return {
            monthStart,
            monthEnd,
            purchased,
            cost,
            costPerUnit,
            gPerDay,
            supplyDurationDays,
            unit,
            cur
        };
    });
}

function renderStatsSummaryDashboard(substanceId, useStats, bounds, unit, cur) {
    const container = document.getElementById('stats-summary-dashboard');
    if (!container) return;
    const sub = getSubstance(substanceId);
    const today = getLocalDateString();
    const weekStart = getWeekStartDateStr(today);
    const isVape = isVapeNicotineSubstanceId(substanceId);
    const displayUnit = getStatsDisplayUnit(substanceId, unit);
    const weekUsed = isVape
        ? getStatsUsageInRange(substanceId, weekStart, today)
        : getWeeklyUsed(substanceId, today);
    const weekGoal = getWeeklyLimit(substanceId, weekStart);
    const weeklyBadge = getUsageVsTargetBadge(weekUsed, weekGoal);
    const remaining = getTotalRemainingSupply(substanceId);
    const avgDaily = weekUsed > 0 ? weekUsed / 7 : null;
    const supplyDaysLeft = remaining != null && avgDaily > 0 ? remaining / avgDaily : null;
    const supplyBadge = supplyDaysLeft != null
        ? (supplyDaysLeft < 3 ? { level: 'risk', label: 'Low' }
            : supplyDaysLeft < 7 ? { level: 'high', label: 'Soon' }
            : supplyDaysLeft < 14 ? { level: 'caution', label: 'OK' }
            : { level: 'good', label: 'Good' })
        : { level: 'none', label: '—' };

    if (isVape) {
        const todayUsed = getStatsUsageOnDate(substanceId, today);
        container.innerHTML = [
            renderSheetMetricCard('Today\'s use', `${formatStatsPuffs(todayUsed)} puffs`, null),
            renderSheetMetricCard('This week', `${formatStatsPuffs(weekUsed)} puffs`, weeklyBadge),
            renderSheetMetricCard('Weekly goal', weekGoal != null ? `${formatStatsPuffs(weekGoal)} puffs` : '—', weeklyBadge),
            renderSheetMetricCard('Range total', `${formatStatsPuffs(useStats.totalAmount)} puffs`, null),
            renderSheetMetricCard('Vape count', String(useStats.vapeCount ?? 0), null),
            renderSheetMetricCard('Avg cost/vape', formatCostPerVape(useStats.avgCostPerVape, cur), null),
            renderSheetMetricCard('Remaining puffs', remaining != null ? `${formatStatsPuffs(remaining)} puffs` : '—', supplyBadge),
            renderSheetMetricCard('Range', `${formatDate(bounds.startDate)} – ${formatDate(bounds.endDate)}`, null)
        ].join('');
        return;
    }

    const todayStats = getTodayUseStats(substanceId);
    const entriesLabel = isWeedTrackingMode(substanceId) ? 'Entries' : 'Sessions';
    container.innerHTML = [
        renderSheetMetricCard('Today\'s use', `${formatAmount(todayStats.totalAmount)} ${displayUnit}`, null),
        renderSheetMetricCard('This week', `${formatAmount(weekUsed)} ${displayUnit}`, weeklyBadge),
        renderSheetMetricCard('Weekly goal', weekGoal != null ? `${formatAmount(weekGoal)} ${displayUnit}` : '—', weeklyBadge),
        renderSheetMetricCard('Range total', `${formatAmount(useStats.totalAmount)} ${displayUnit}`, null),
        renderSheetMetricCard(entriesLabel, String(useStats.sessionCount), null),
        renderSheetMetricCard('Use days', String(useStats.useDays), null),
        renderSheetMetricCard('Use day %', `${formatAmount(useStats.useDayPct, 1)}%`, null),
        renderSheetMetricCard('Remaining supply', remaining != null ? `${formatAmount(remaining)} ${displayUnit}` : '—', supplyBadge),
        renderSheetMetricCard('Range', `${formatDate(bounds.startDate)} – ${formatDate(bounds.endDate)}`, null)
    ].join('');
}

function renderStatsMonthlySummary(substanceId) {
    const container = document.getElementById('stats-monthly-summary');
    if (!container) return;
    const sub = getSubstance(substanceId);
    if (!sub) {
        container.innerHTML = '<p class="empty-hint">Select a substance.</p>';
        return;
    }
    const unit = sub.defaultUnit || 'units';
    const displayUnit = isVapeNicotineSubstanceId(substanceId) ? 'puffs' : unit;
    const cur = getCurrencySymbol();
    const summaries = getMonthlyTrackingSummaries(substanceId).map(s =>
        enrichMonthlySummaryWithBuyData(s, substanceId)
    );
    if (!summaries.length) {
        container.innerHTML = '<p class="empty-hint">No monthly data yet.</p>';
        return;
    }
    container.innerHTML = renderConfigurableSheetTable('statsMonthly', summaries, (colId, s) => {
        const dailyGoal = getDailyLimitForDate(substanceId, s.monthStart);
        const monthGoal = dailyGoal != null ? dailyGoal * s.daysInMonth : null;
        const usageBadge = getUsageVsTargetBadge(s.totalUsage, monthGoal);
        switch (colId) {
            case 'month': return s.monthLabel;
            case 'start': return formatDate(s.monthStart);
            case 'end': return formatDate(s.monthEnd);
            case 'usage':
                return { html: `${fmtSheetAmount(s.totalUsage, displayUnit)} ${renderStatusBadge(usageBadge.level, usageBadge.label)}` };
            case 'purchased': return fmtSheetAmount(
                s.purchasedAmount,
                isVapeNicotineSubstanceId(substanceId) ? 'puffs' : unit
            );
            case 'cost': return fmtSheetMoney(s.cost || 0, cur);
            case 'sessions': return String(s.sessions);
            case 'useDays': return String(s.useDays);
            case 'usePct': return `${formatAmount(s.useDayPct, 1)}%`;
            case 'avgBreak': return formatStatsBreakValue(s.avgBreak, substanceId);
            case 'duration': return formatStatsDurationValue(s.totalDurationHours, substanceId);
            case 'avgDur': return formatStatsDurationValue(s.avgDurationHours, substanceId);
            case 'gPerSession': return fmtSheetAmount(s.avgPerSession, displayUnit);
            case 'gPerUseDay': return fmtSheetAmount(s.avgPerUseDay, displayUnit);
            case 'gPerCalDay': return fmtSheetAmount(s.avgPerCalendarDay, displayUnit);
            case 'gPerHour': return fmtSheetRate(s.gPerHour, unit, '/hr');
            default: return '—';
        }
    });
}

function renderStatsWeeklySummary(substanceId) {
    const container = document.getElementById('stats-weekly-summary');
    if (!container) return;
    const sub = getSubstance(substanceId);
    if (!sub) {
        container.innerHTML = '<p class="empty-hint">Select a substance.</p>';
        return;
    }
    const unit = sub.defaultUnit || 'units';
    const displayUnit = isVapeNicotineSubstanceId(substanceId) ? 'puffs' : unit;
    const summaries = getWeeklyTrackingSummaries(substanceId);
    if (!summaries.length) {
        container.innerHTML = '<p class="empty-hint">No weekly data yet.</p>';
        return;
    }
    container.innerHTML = renderConfigurableSheetTable('statsWeekly', summaries, (colId, s) => {
        switch (colId) {
            case 'week': return `${formatDate(s.weekStart)}`;
            case 'start': return formatDate(s.weekStart);
            case 'end': return formatDate(s.weekEnd);
            case 'usage': return fmtSheetAmount(s.totalUsage, displayUnit);
            case 'monthRunning': return fmtSheetAmount(s.runningTotal, displayUnit);
            case 'avgBreak': return formatStatsBreakValue(s.avgBreak, substanceId);
            case 'sessions': return String(s.sessions);
            case 'duration': return formatStatsDurationValue(s.totalDurationHours, substanceId);
            case 'avgDur': return formatStatsDurationValue(s.avgDurationHours, substanceId);
            case 'gPerSession': return fmtSheetAmount(s.avgPerSession, displayUnit);
            case 'gPerHour': return fmtSheetRate(s.gPerHour, unit, '/hr');
            case 'longBreak': return formatStatsBreakValue(s.longestBreak, substanceId);
            case 'shortBreak': return formatStatsBreakValue(s.shortestBreak, substanceId);
            case 'status':
                return { html: renderStatusBadge(s.usageBadge.level, s.usageBadge.label) };
            default: return '—';
        }
    });
}

function getStoreBuySummaries(substanceId, bounds) {
    const inRange = p => p.date >= bounds.startDate && p.date <= bounds.endDate;
    const byStore = new Map();
    (appData.purchases || []).forEach(p => {
        if (getPurchaseSubstanceId(p) !== substanceId || !inRange(p)) return;
        const store = normalizeStoreName(p.store || p.location || '') || 'Unknown';
        const key = getStoreDedupeKey(store);
        const row = byStore.get(key) || { store, purchased: 0, cost: 0, count: 0 };
        row.purchased += parseFloat(getPurchaseQuantity(p)) || 0;
        row.cost += parseFloat(getPurchaseTotalCost(p)) || 0;
        row.count += 1;
        byStore.set(key, row);
    });
    return [...byStore.values()].sort((a, b) => b.cost - a.cost);
}

function getAlcoholInventoryAnalytics(purchases) {
    const totalPureAlcoholMl = purchases.reduce((s, p) => s + (getAlcoholPureAlcoholMl(p) || 0), 0);
    return { totalPureAlcoholMl };
}

function getWeedInventoryAnalytics(purchases) {
    let budGrams = 0;
    let cartGrams = 0;
    let ediblesMg = 0;
    let preRollGrams = 0;
    purchases.forEach(p => {
        if ((p.weedProductType || 'bud') === 'bud' && p.budGrams != null && p.budGrams !== '') {
            budGrams += parseFloat(p.budGrams) || 0;
        } else if (p.weedProductType === 'cart' && p.cartGrams != null && p.cartGrams !== '') {
            cartGrams += parseFloat(p.cartGrams) || 0;
        } else if (p.weedProductType === 'edibles' && p.ediblesMg != null && p.ediblesMg !== '') {
            ediblesMg += parseFloat(p.ediblesMg) || 0;
        } else if (p.weedProductType === 'prerolls' && p.totalPreRollGrams != null && p.totalPreRollGrams !== '') {
            preRollGrams += parseFloat(p.totalPreRollGrams) || 0;
        } else {
            if (p.budGrams != null && p.budGrams !== '') budGrams += parseFloat(p.budGrams) || 0;
            if (p.cartGrams != null && p.cartGrams !== '') cartGrams += parseFloat(p.cartGrams) || 0;
            if (p.ediblesMg != null && p.ediblesMg !== '') ediblesMg += parseFloat(p.ediblesMg) || 0;
        }
    });
    return { budGrams, cartGrams, ediblesMg, preRollGrams };
}

function getCigarettesInventoryAnalytics(purchases) {
    let totalNicotineMg = 0;
    let perUnitSamples = 0;
    purchases.forEach(p => {
        const nic = parseFloat(p.nicotineMg);
        if (!Number.isFinite(nic)) return;
        perUnitSamples += 1;
        const qty = parseFloat(getPurchaseQuantity(p)) || 0;
        const unit = (p.unit || '').toLowerCase();
        if (unit === 'cigarettes' || unit === 'cigarette') {
            totalNicotineMg += qty * nic;
        }
    });
    return { totalNicotineMg, perUnitSamples };
}

function renderStatsBuyAnalyticsCards(substanceId, bounds) {
    const container = document.getElementById('stats-buy-analytics-cards');
    if (!container) return;
    const sub = getSubstance(substanceId);
    const unit = sub?.defaultUnit || 'units';
    const displayUnit = getStatsDisplayUnit(substanceId, unit);
    const cur = getCurrencySymbol();
    const inRange = p => p.date >= bounds.startDate && p.date <= bounds.endDate;
    const purchases = (appData.purchases || []).filter(p =>
        getPurchaseSubstanceId(p) === substanceId && inRange(p)
    );
    const purchased = purchases.reduce((s, p) => s + (parseFloat(getPurchaseQuantity(p)) || 0), 0);
    const cost = purchases.reduce((s, p) => s + (parseFloat(getPurchaseTotalCost(p)) || 0), 0);
    const remaining = getTotalRemainingSupply(substanceId);
    const supplyBadge = remaining != null ? getSupplyRemainingBadge(0.25) : { level: 'none', label: '—' };
    const today = getLocalDateString();
    const weekStart = getWeekStartDateStr(today);
    const monthStart = getMonthStartDateStr(today);
    const weekPurchases = (appData.purchases || []).filter(p =>
        getPurchaseSubstanceId(p) === substanceId && p.date >= weekStart
    );
    const monthPurchases = (appData.purchases || []).filter(p =>
        getPurchaseSubstanceId(p) === substanceId && p.date >= monthStart
    );
    const weekCost = weekPurchases.reduce((s, p) => s + (parseFloat(getPurchaseTotalCost(p)) || 0), 0);
    const monthCost = monthPurchases.reduce((s, p) => s + (parseFloat(getPurchaseTotalCost(p)) || 0), 0);
    const storeSummaries = getStoreBuySummaries(substanceId, bounds);
    const topStore = storeSummaries[0];
    const supplyDuration = getAverageSupplyDurationDays(substanceId);

    if (isVapeNicotineSubstanceId(substanceId)) {
        const vapePurchases = purchases.filter(isVapePuffPurchase);
        const vapeCount = vapePurchases.length;
        const avgCostPerVape = vapeCount > 0 ? cost / vapeCount : null;
        const rangePuffs = getStatsUsageInRange(substanceId, bounds.startDate, bounds.endDate);
        const costPerPuff = rangePuffs > INVENTORY_EPS && cost > 0 ? cost / rangePuffs : null;
        const cards = [
            renderSheetMetricCard('Vape count (range)', String(vapeCount), null),
            renderSheetMetricCard('Range cost', fmtSheetMoney(cost, cur), null),
            renderSheetMetricCard('Avg cost/vape', formatCostPerVape(avgCostPerVape, cur), null),
            renderSheetMetricCard('Cost/puff', costPerPuff != null ? `${cur}${costPerPuff.toFixed(4)}/puff` : '—', null),
            renderSheetMetricCard('Weekly cost', fmtSheetMoney(weekCost, cur), null),
            renderSheetMetricCard('Monthly cost', fmtSheetMoney(monthCost, cur), null),
            renderSheetMetricCard('Days per vape', supplyDuration != null ? formatSupplyDurationDays(supplyDuration) : '—', null),
            renderSheetMetricCard('Remaining puffs', remaining != null ? `${formatStatsPuffs(remaining)} puffs` : '—', supplyBadge),
            renderSheetMetricCard('Top store', topStore ? `${topStore.store} (${fmtSheetMoney(topStore.cost, cur)})` : '—', null)
        ];
        container.innerHTML = cards.join('');
        const storeContainer = document.getElementById('stats-buy-store-summary');
        if (storeContainer) {
            if (!storeSummaries.length) {
                storeContainer.innerHTML = '';
            } else {
                storeContainer.innerHTML = renderSheetTable(
                    ['Store / Location', 'Vapes', 'Cost', 'Purchases'],
                    storeSummaries.map(s => [
                        s.store,
                        String(s.count),
                        fmtSheetMoney(s.cost, cur),
                        String(s.count)
                    ])
                );
            }
        }
        return;
    }

    const costPerUnit = purchased > 0 ? cost / purchased : getAveragePurchaseCostPerUnit(substanceId);
    const daysInRange = countDaysInRange(bounds.startDate, bounds.endDate);
    const gPerDaySupply = daysInRange > 0 ? purchased / daysInRange : null;
    const weekPurchased = weekPurchases.reduce((s, p) => s + (parseFloat(getPurchaseQuantity(p)) || 0), 0);
    const monthPurchased = monthPurchases.reduce((s, p) => s + (parseFloat(getPurchaseQuantity(p)) || 0), 0);
    const allPurchases = (appData.purchases || []).filter(p => getPurchaseSubstanceId(p) === substanceId);
    const totalPurchased = allPurchases.reduce((s, p) => s + (parseFloat(getPurchaseQuantity(p)) || 0), 0);
    const totalCost = allPurchases.reduce((s, p) => s + (parseFloat(getPurchaseTotalCost(p)) || 0), 0);
    const avgCostPerUnit = totalPurchased > 0 ? totalCost / totalPurchased : null;

    const cards = [
        renderSheetMetricCard('Total purchased', fmtSheetAmount(totalPurchased, unit), null),
        renderSheetMetricCard('Total cost', fmtSheetMoney(totalCost, cur), null),
        renderSheetMetricCard('Avg cost/g', avgCostPerUnit != null ? fmtSheetMoney(avgCostPerUnit, cur) : '—', null),
        renderSheetMetricCard('Weekly purchased', fmtSheetAmount(weekPurchased, unit), null),
        renderSheetMetricCard('Weekly cost', fmtSheetMoney(weekCost, cur), null),
        renderSheetMetricCard('Monthly purchased', fmtSheetAmount(monthPurchased, unit), null),
        renderSheetMetricCard('Monthly cost', fmtSheetMoney(monthCost, cur), null),
        renderSheetMetricCard('Range purchased', fmtSheetAmount(purchased, unit), null),
        renderSheetMetricCard('Range cost', fmtSheetMoney(cost, cur), null),
        renderSheetMetricCard('Cost / unit', costPerUnit != null ? fmtSheetMoney(costPerUnit, cur) : '—', null),
        renderSheetMetricCard('g / day supply', gPerDaySupply != null ? fmtSheetRate(gPerDaySupply, unit, '/day') : '—', null),
        renderSheetMetricCard('Supply duration', supplyDuration != null ? formatSupplyDurationDays(supplyDuration) : '—', null),
        renderSheetMetricCard('Remaining supply', remaining != null ? fmtSheetAmount(remaining, unit) : '—', supplyBadge),
        renderSheetMetricCard('Top store', topStore ? `${topStore.store} (${fmtSheetMoney(topStore.cost, cur)})` : '—', null)
    ];

    if (isAlcoholTrackingMode(substanceId)) {
        const alcoholStats = getAlcoholInventoryAnalytics(purchases);
        if (alcoholStats.totalPureAlcoholMl > 0) {
            cards.push(renderSheetMetricCard(
                'Pure alcohol (range)',
                fmtSheetAmount(alcoholStats.totalPureAlcoholMl, 'mL'),
                null
            ));
        }
        const allAlcoholStats = getAlcoholInventoryAnalytics(allPurchases);
        if (allAlcoholStats.totalPureAlcoholMl > 0) {
            cards.push(renderSheetMetricCard(
                'Pure alcohol (all time)',
                fmtSheetAmount(allAlcoholStats.totalPureAlcoholMl, 'mL'),
                null
            ));
        }
    }

    if (isWeedTrackingMode(substanceId)) {
        const weedStats = getWeedInventoryAnalytics(purchases);
        if (weedStats.budGrams > 0) {
            cards.push(renderSheetMetricCard('Bud purchased (range)', fmtSheetAmount(weedStats.budGrams, 'g'), null));
        }
        if (weedStats.cartGrams > 0) {
            cards.push(renderSheetMetricCard('Cart purchased (range)', fmtSheetAmount(weedStats.cartGrams, 'g'), null));
        }
        if (weedStats.ediblesMg > 0) {
            cards.push(renderSheetMetricCard('Edibles purchased (range)', fmtSheetAmount(weedStats.ediblesMg, 'mg'), null));
        }
        if (weedStats.preRollGrams > 0) {
            cards.push(renderSheetMetricCard('Pre-rolls purchased (range)', fmtSheetAmount(weedStats.preRollGrams, 'g'), null));
        }
    }

    if (isCigarettesTrackingMode(substanceId)) {
        const cigStats = getCigarettesInventoryAnalytics(purchases);
        if (cigStats.totalNicotineMg > 0) {
            cards.push(renderSheetMetricCard(
                'Nicotine purchased (range)',
                fmtSheetAmount(cigStats.totalNicotineMg, 'mg'),
                null
            ));
        } else if (cigStats.perUnitSamples > 0) {
            cards.push(renderSheetMetricCard(
                'Nicotine per unit',
                'See inventory entries',
                null
            ));
        }
    }

    container.innerHTML = cards.join('');

    const storeContainer = document.getElementById('stats-buy-store-summary');
    if (storeContainer) {
        if (!storeSummaries.length) {
            storeContainer.innerHTML = '';
        } else {
            storeContainer.innerHTML = renderSheetTable(
                ['Store / Location', 'Purchased', 'Cost', 'Purchases'],
                storeSummaries.map(s => [
                    s.store,
                    fmtSheetAmount(s.purchased, unit),
                    fmtSheetMoney(s.cost, cur),
                    String(s.count)
                ])
            );
        }
    }
}

function renderStatsLimitGoal(substanceId, useStats, bounds, unit, cur) {
    const container = document.getElementById('stats-limit-goal');
    if (!container) return;
    const today = getLocalDateString();
    const weekStart = getWeekStartDateStr(today);
    const isVape = isVapeNicotineSubstanceId(substanceId);
    const displayUnit = getStatsDisplayUnit(substanceId, unit);
    const weekUsed = isVape
        ? getStatsUsageInRange(substanceId, weekStart, today)
        : getWeeklyUsed(substanceId, today);
    const weekGoal = getWeeklyLimit(substanceId, weekStart);
    const weeklyBadge = getUsageVsTargetBadge(weekUsed, weekGoal);
    const taperStart = getTaperStartingDailyAverage(substanceId);
    const daysInRange = countDaysInRange(bounds.startDate, bounds.endDate);
    const avgPerDay = isVape && useStats.avgPuffsPerDay != null
        ? useStats.avgPuffsPerDay
        : (daysInRange ? useStats.totalAmount / daysInRange : 0);
    let reductionPct = '—';
    if (taperStart != null && taperStart > 0) {
        reductionPct = `${Math.max(0, Math.round((1 - avgPerDay / taperStart) * 100))}%`;
    }
    const plan = appData.taperPlans[substanceId];
    const byWeek = buildTaperByWeekData(substanceId);
    const trackBadge = byWeek
        ? getUsageVsTargetBadge(byWeek.totalUsed, byWeek.totalPlanned)
        : null;
    const monthStart = getMonthStartDateStr(today);
    const monthWeeks = getWeeklyTrackingSummaries(substanceId)
        .filter(s => s.weekEnd >= monthStart && s.weekStart <= today);
    const monthRunning = monthWeeks.length ? monthWeeks[monthWeeks.length - 1].runningTotal : 0;
    const fmtAmount = (value) => isVape ? formatStatsPuffs(value) : formatAmount(value);

    container.innerHTML = [
        renderSheetMetricCard('Weekly used / goal', weekGoal != null ? `${fmtAmount(weekUsed)} / ${fmtAmount(weekGoal)} ${displayUnit}` : `${fmtAmount(weekUsed)} ${displayUnit}`, weeklyBadge),
        renderSheetMetricCard('Reduction from start', reductionPct, null),
        renderSheetMetricCard('Running planned', byWeek ? `${fmtAmount(byWeek.totalPlanned)} ${displayUnit}` : '—', null),
        renderSheetMetricCard('Running used', byWeek ? `${fmtAmount(byWeek.totalUsed)} ${displayUnit}` : '—', null),
        renderSheetMetricCard('Running difference', byWeek ? `${fmtAmount(byWeek.remainingAllowance)} ${displayUnit}` : '—', trackBadge),
        renderSheetMetricCard('Month running total', `${fmtAmount(monthRunning)} ${displayUnit}`, null),
        renderSheetMetricCard('Plan end', plan?.endDate ? formatDate(plan.endDate) : '—', null)
    ].join('');
}

function renderTaperWeeklyCalendar(substanceId) {
    const container = document.getElementById('taper-weekly-calendar');
    if (!container) return;
    const plan = appData.taperPlans[substanceId];
    const sub = getSubstance(substanceId);
    if (!plan?.weeklyTargets?.length || !sub) {
        container.innerHTML = '<p class="empty-hint">No taper plan weeks to preview.</p>';
        return;
    }
    syncTaperPlanData(substanceId);
    const unit = getTaperTrackingUnit(plan, substanceId);
    const displayUnit = isVapeNicotineSubstanceId(substanceId) ? 'puffs' : unit;
    const enriched = buildEnrichedUseEntries(substanceId);
    const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    let html = '';
    plan.weeklyTargets.forEach((weekRow, index) => {
        const planned = getPlannedWeeklyTarget(plan, weekRow);
        const used = roundTaperActual(weekRow.actualUsed || 0);
        const left = roundTaperActual(planned - used);
        const { status, label } = getTaperByWeekStatus(used, planned);
        const calStart = getWeekStartDateStr(weekRow.weekStart);
        const days = [];
        for (let i = 0; i < 7; i++) {
            const dateStr = addDaysToDateStr(calStart, i);
            const dayUsed = isVapeNicotineSubstanceId(substanceId)
                ? getStatsUsageOnDate(substanceId, dateStr)
                : enriched.filter(e => isPersonalUseLog(e) && e.date === dateStr)
                    .reduce((s, e) => s + (parseFloat(e.amount) || 0), 0);
            const dayLogs = enriched.filter(e => isPersonalUseLog(e) && e.date === dateStr);
            let dayDur = 0;
            dayLogs.forEach(e => { if (e.durationHours) dayDur += e.durationHours; });
            const breakH = dayLogs[0]?.breakDurationHours ?? null;
            const limit = getDailyLimitForDate(substanceId, dateStr);
            const { status: dayStatus } = getTaperLimitStatus(dayUsed, limit);
            const badge = mapTaperStatusToBadge(dayStatus);
            const inPlan = dateStr >= weekRow.weekStart && dateStr <= weekRow.weekEnd;
            days.push({ dateStr, dayUsed, dayDur, breakH, badge, inPlan });
        }
        if (isReduceBuyingPlan(plan)) {
            const messages = weekRow.messages?.length ? weekRow.messages : buildBuyingTaperMessages(weekRow);
            html += `<div class="taper-week-calendar-block">
                <header class="taper-week-calendar-head">
                    <h4>Week ${weekRow.week ?? index + 1} · ${formatDate(weekRow.weekStart)} – ${formatDate(weekRow.weekEnd)}</h4>
                </header>
                <ul class="taper-buying-targets">${messages.map(m => `<li>${m}</li>`).join('')}</ul>
                <div class="taper-week-calendar-summary">
                    <span>Purchases: <strong>${weekRow.actualPurchases || 0}</strong></span>
                    <span>Spend: <strong>${formatTaperMoney(weekRow.actualSpend || 0)}</strong></span>
                </div>
            </div>`;
            return;
        }
        if (isReduceNicotinePlan(plan)) {
            html += `<div class="taper-week-calendar-block">
                <header class="taper-week-calendar-head">
                    <h4>Week ${weekRow.week ?? index + 1} · ${formatDate(weekRow.weekStart)} – ${formatDate(weekRow.weekEnd)}</h4>
                </header>
                <div class="taper-week-calendar-summary">
                    <span>Target: <strong>${formatTaperNicotineStrength(weekRow.targetNicotineMgPerMl)}</strong></span>
                    <span>Current: <strong>${formatTaperNicotineStrength(weekRow.actualNicotineMgPerMl)}</strong></span>
                </div>
            </div>`;
            return;
        }
        html += `<div class="taper-week-calendar-block">
            <header class="taper-week-calendar-head">
                <h4>Week ${weekRow.week ?? index + 1} · ${formatDate(weekRow.weekStart)} – ${formatDate(weekRow.weekEnd)}</h4>
                ${renderStatusBadge(mapTaperStatusToBadge(status === 'on-track' ? 'close' : status), label)}
            </header>
            <div class="table-scroll"><table class="sheet-table taper-week-calendar-table">
                <thead><tr><th></th>${dayNames.map(d => `<th>${d}</th>`).join('')}</tr></thead>
                <tbody>
                    <tr><td>Date</td>${days.map(d => `<td class="${d.inPlan ? '' : 'cal-outside'}">${parseInt(d.dateStr.slice(-2), 10)}</td>`).join('')}</tr>
                    <tr><td>Used</td>${days.map(d => `<td class="status-text-${d.badge}">${d.dayUsed > 0 ? formatStatsPuffs(d.dayUsed) : '—'}</td>`).join('')}</tr>
                    <tr><td>Dur</td>${days.map(d => `<td>${d.dayDur > 0 ? formatDurationHours(d.dayDur) : '—'}</td>`).join('')}</tr>
                    <tr><td>Break</td>${days.map(d => `<td>${d.breakH != null ? formatBreakFromHours(d.breakH) : '—'}</td>`).join('')}</tr>
                </tbody>
            </table></div>
            <div class="taper-week-calendar-summary">
                <span>Total: <strong>${used} ${displayUnit}</strong></span>
                <span>Goal: <strong>${planned} ${displayUnit}</strong></span>
                <span>Left: <strong class="status-text-${mapTaperStatusToBadge(left >= 0 ? 'under' : 'over')}">${left} ${displayUnit}</strong></span>
            </div>
        </div>`;
    });
    container.innerHTML = html;
}

function renderBuyWeeklySummary(substanceId) {
    const container = document.getElementById('buy-weekly-summary');
    if (!container) return;
    if (!substanceId) {
        container.innerHTML = '<p class="empty-hint">Select a substance.</p>';
        return;
    }
    const summaries = getBuyWeeklySummaries(substanceId);
    if (!summaries.length) {
        container.innerHTML = '<p class="empty-hint">No purchases yet.</p>';
        return;
    }
    container.innerHTML = renderConfigurableSheetTable('buyWeekly', summaries, (colId, s) => {
        switch (colId) {
            case 'startWeek': return formatDate(s.weekStart);
            case 'endWeek': return formatDate(s.weekEnd);
            case 'purchased': return fmtSheetAmount(
                s.purchased,
                isVapeNicotineSubstanceId(substanceId) ? 'puffs' : s.unit
            );
            case 'monthRunning': return fmtSheetAmount(
                s.monthRunning,
                isVapeNicotineSubstanceId(substanceId) ? 'puffs' : s.unit
            );
            case 'cost': return fmtSheetMoney(s.cost, s.cur);
            case 'costPerUnit': return isVapeNicotineSubstanceId(substanceId)
                ? formatCostPerVape(s.costPerUnit, s.cur)
                : (s.costPerUnit != null ? fmtSheetMoney(s.costPerUnit, s.cur) : '—');
            case 'gPerDay': return s.gPerDay != null
                ? (isVapeNicotineSubstanceId(substanceId)
                    ? `${formatStatsPuffs(s.gPerDay)}/day`
                    : fmtSheetRate(s.gPerDay, s.unit, '/day'))
                : '—';
            case 'supplyDuration': return formatSupplyDurationDays(s.supplyDuration);
            default: return '—';
        }
    }, substanceId);
}

function renderBuyMonthlySummary(substanceId) {
    const container = document.getElementById('buy-monthly-summary');
    if (!container) return;
    if (!substanceId) {
        container.innerHTML = '<p class="empty-hint">Select a substance.</p>';
        return;
    }
    const summaries = getBuyMonthlySummaries(substanceId);
    if (!summaries.length) {
        container.innerHTML = '<p class="empty-hint">No purchases yet.</p>';
        return;
    }
    container.innerHTML = renderConfigurableSheetTable('buyMonthly', summaries, (colId, s) => {
        switch (colId) {
            case 'startMonth': return formatBuySheetDate(s.monthStart);
            case 'endMonth': return formatBuySheetDate(s.monthEnd);
            case 'purchased': return fmtSheetAmount(
                s.purchased,
                isVapeNicotineSubstanceId(substanceId) ? 'puffs' : s.unit
            );
            case 'cost': return fmtSheetMoney(s.cost, s.cur);
            case 'costPerUnit': return isVapeNicotineSubstanceId(substanceId)
                ? formatCostPerVape(s.costPerUnit, s.cur)
                : (s.costPerUnit != null ? fmtSheetMoney(s.costPerUnit, s.cur) : '—');
            case 'gPerDay': return s.gPerDay != null
                ? (isVapeNicotineSubstanceId(substanceId)
                    ? `${formatStatsPuffs(s.gPerDay)}/day`
                    : formatAmount(s.gPerDay))
                : '—';
            case 'supplyDuration': return formatSupplyDurationDaysHours(s.supplyDurationDays);
            default: return '—';
        }
    }, substanceId);
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
    const displayUnit = getStatsDisplayUnit(currentSubstanceId, unit);
    const cur = getCurrencySymbol();
    const daysInRange = countDaysInRange(bounds.startDate, bounds.endDate);
    const useStats = buildUseStatsMetrics(rangeLogs, daysInRange, currentSubstanceId, bounds);

    const summaryEl = document.getElementById('stats-range-summary');
    if (summaryEl) summaryEl.textContent = getStatsRangeLabel(preset, bounds.startDate, bounds.endDate);

    renderStatsSummaryDashboard(currentSubstanceId, useStats, bounds, displayUnit, cur);
    renderStatsMonthlySummary(currentSubstanceId);
    renderStatsWeeklySummary(currentSubstanceId);

    renderUsageChart(bounds);
    renderSpendingChart(bounds);
    renderUseStatsCards(useStats, displayUnit);
    updateLongestTimeBetween();
    updateBreakStats();
    updateBuyBreakStats();
    renderGiftAnalytics(bounds);
    renderStatsBuyAnalyticsCards(currentSubstanceId, bounds);
    renderStatsLimitGoal(currentSubstanceId, useStats, bounds, displayUnit, cur);
    updateRecoveryStreakDisplay(currentSubstanceId);
    applyCollapsedSections();
}

function renderSubstanceStatsBreakdown() {
    const container = document.getElementById('stats-by-substance');
    if (!container) return;
    container.innerHTML = '';

    getActiveSubstances().forEach(sub => {
        const logs = appData.logs.filter(l => l.substanceId === sub.id && isPersonalUseLog(l));
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
                <div><span>Money spent</span><strong>${sub.costTrackingEnabled ? getCurrencySymbol() + spent.toFixed(2) : '—'}</strong></div>
                <div><span>Streak</span><strong>${days}d (best ${best}d)</strong></div>
                <div><span>Taper</span><strong>${sub.taperTrackingEnabled ? taperPct : '—'}</strong></div>
            </div>
        `;
        container.appendChild(card);
    });
}

function renderGiftAnalytics(bounds) {
    const section = document.getElementById('gift-analytics-section');
    if (!section) return;

    if (isAllSubstancesView() || isVapeNicotineSubstanceId(currentSubstanceId)) {
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

function buildUsageChartBuckets(bounds) {
    const { startDate, endDate } = bounds;
    const grouping = getStatsChartGrouping(startDate, endDate);
    const isVape = isVapeNicotineSubstanceId(currentSubstanceId);
    const logs = getUseEntries().filter(
        l => logMatchesSubstance(l, currentSubstanceId) && isPersonalUseLog(l)
    );
    const filtered = filterLogsByDateRange(logs, startDate, endDate);
    const buckets = [];

    const sumUsage = (bucketStart, bucketEnd) => isVape
        ? getStatsUsageInRange(currentSubstanceId, bucketStart, bucketEnd)
        : filtered
            .filter(l => l.date >= bucketStart && l.date <= bucketEnd)
            .reduce((s, l) => s + (parseFloat(l.amount) || 0), 0);

    if (grouping === 'day') {
        let cursor = parseLocalDate(startDate);
        const end = parseLocalDate(endDate);
        const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
        while (cursor && end && cursor <= end) {
            const dateStr = getLocalDateString(cursor);
            const count = isVape
                ? getStatsUsageOnDate(currentSubstanceId, dateStr)
                : filtered
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
        let cursor = parseLocalDate(startDate);
        if (cursor) cursor.setDate(cursor.getDate() - cursor.getDay());
        const end = parseLocalDate(endDate);
        while (cursor && end && cursor <= end) {
            const weekStartStr = getLocalDateString(cursor);
            const weekEnd = new Date(cursor);
            weekEnd.setDate(weekEnd.getDate() + 6);
            const weekEndStr = getLocalDateString(weekEnd);
            buckets.push({
                label: cursor.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
                detail: 'Week',
                bucketStart: weekStartStr,
                bucketEnd: weekEndStr,
                count: sumUsage(weekStartStr, weekEndStr)
            });
            cursor.setDate(cursor.getDate() + 7);
        }
        return { grouping, buckets };
    }

    let cursor = parseLocalDate(startDate.slice(0, 7) + '-01');
    const end = parseLocalDate(endDate.slice(0, 7) + '-01');
    while (cursor && end && cursor <= end) {
        const monthKey = `${cursor.getFullYear()}-${String(cursor.getMonth() + 1).padStart(2, '0')}`;
        const monthEnd = new Date(cursor.getFullYear(), cursor.getMonth() + 1, 0);
        const monthEndStr = getLocalDateString(monthEnd);
        buckets.push({
            label: cursor.toLocaleDateString('en-US', { month: 'short' }),
            detail: String(cursor.getFullYear()),
            bucketStart: `${monthKey}-01`,
            bucketEnd: monthEndStr,
            count: sumUsage(`${monthKey}-01`, monthEndStr)
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
    const isVapeChart = isVapeNicotineSubstanceId(currentSubstanceId);
    buckets.forEach(data => {
        const bar = document.createElement('div');
        bar.className = 'chart-bar';
        bar.style.height = `${Math.max((data.count / max) * 100, 4)}%`;
        const displayCount = isVapeChart ? formatStatsPuffs(data.count) : data.count.toFixed(1);
        bar.title = data.detail ? `${data.detail}: ${displayCount}` : displayCount;
        bar.innerHTML = `<span class="chart-bar-value">${displayCount}</span><span class="chart-bar-label">${data.label}</span>`;
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
        bar.innerHTML = `<span class="chart-bar-value">${getCurrencySymbol()}${data.cost.toFixed(0)}</span><span class="chart-bar-label">${data.label}</span>`;
        container.appendChild(bar);
    });
}

function updateLongestTimeBetween() {
    const el = document.getElementById('longest-time-between');
    if (!el) return;
    const metrics = getBreakMetrics(currentSubstanceId);
    el.textContent = formatBreakFromHours(metrics.longest);
}

// ——— Taper / Do Not Surpass ———
function getTaperReductionTypesForSubstance(substanceId) {
    return isVapeTrackingMode(substanceId) ? TAPER_VAPE_REDUCTION_TYPES : TAPER_STANDARD_REDUCTION_TYPES;
}

function getVapeBaselinePuffsPerDay(substanceId, data = appData) {
    const today = getLocalDateString();
    const start = addDaysToDateStr(today, -13);
    const total = getStatsUsageInRange(substanceId, start, today, data);
    const days = countDaysInRange(start, today);
    if (total > INVENTORY_EPS && days > 0) return roundTaperValue(total / days);
    const baseline = data.settings?.substanceSettings?.[substanceId]?.baseline;
    if (baseline != null && baseline !== '') return roundTaperValue(parseFloat(baseline));
    return null;
}

function getVapeBaselineBuyFrequencyDays(substanceId) {
    const stats = getSubstanceSupplyDurationStats(substanceId);
    if (stats.avgDaysBetweenPurchases != null) return roundTaperValue(stats.avgDaysBetweenPurchases);
    const buyMetrics = getBuyBreakMetrics(substanceId);
    if (buyMetrics.average != null) return roundTaperValue(buyMetrics.average / 24);
    return null;
}

function getVapeBaselineNicotineStrength(substanceId, data = appData) {
    const purchases = getPurchasesForSubstance(substanceId, data)
        .filter(p => p.nicotineMgPerMl != null && parseFloat(p.nicotineMgPerMl) > 0)
        .sort((a, b) => getPurchaseDatetimeMs(b) - getPurchaseDatetimeMs(a));
    if (purchases.length) return roundTaperValue(parseFloat(purchases[0].nicotineMgPerMl));
    return null;
}

function getVapeCurrentNicotineStrength(substanceId) {
    const active = getActivePurchasesForSubstance(substanceId).filter(isVapePuffPurchase);
    const sorted = [...active].sort((a, b) => getPurchaseDatetimeMs(b) - getPurchaseDatetimeMs(a));
    for (const purchase of sorted) {
        const strength = parseFloat(purchase.nicotineMgPerMl);
        if (Number.isFinite(strength) && strength > 0) return roundTaperValue(strength);
    }
    return getVapeBaselineNicotineStrength(substanceId);
}

function getNicotineStepIntervalDays(interval) {
    if (interval === 'biweekly') return 14;
    if (interval === 'monthly') return 30;
    return 7;
}

function populateTaperReductionTypeSelect(substanceId, selectedType) {
    const select = document.getElementById('reduction-type');
    if (!select) return;
    const types = getTaperReductionTypesForSubstance(substanceId);
    let value = selectedType || select.value || types[0];
    if (!types.includes(value)) {
        value = types.includes('reduce-puffs') ? 'reduce-puffs' : types[0];
    }
    select.innerHTML = types.map(type =>
        `<option value="${type}">${TAPER_REDUCTION_LABELS[type] || type}</option>`
    ).join('');
    select.value = value;
}

function getTaperTrackingUnit(plan, substanceId) {
    if (isManualWeeklyPlan(plan)) return getManualWeeklyPlanUnit(plan, substanceId);
    if (isReduceNicotinePlan(plan)) return 'mg/mL';
    if (isReduceBuyingPlan(plan)) return 'days';
    if (isVapeTrackingMode(substanceId)) return 'puffs';
    return getSubstancePrimaryUnit(substanceId) || 'units';
}

function shouldUseVapeStatsUsage(substanceId, plan) {
    return isVapeTrackingMode(substanceId)
        && (isReducePuffsPlan(plan) || isManualWeeklyPlan(plan));
}

function getTaperDayUsage(substanceId, dateStr, excludeLogId = null, data = appData) {
    const plan = data?.taperPlans?.[substanceId];
    if (shouldUseVapeStatsUsage(substanceId, plan)) {
        return getStatsUsageOnDate(substanceId, dateStr, data);
    }
    return getUsedAmount(substanceId, dateStr, excludeLogId, data);
}

function getTaperWeekUsage(substanceId, dateStr, excludeLogId = null, data = appData) {
    const plan = data?.taperPlans?.[substanceId];
    const bounds = plan ? getTaperWeekBounds(plan, dateStr) : null;
    const weekStart = bounds?.weekStart || getWeekStartDateStr(dateStr);
    const weekEnd = bounds?.weekEnd || addDaysToDateStr(getWeekStartDateStr(dateStr), 6);
    if (shouldUseVapeStatsUsage(substanceId, plan)) {
        return getStatsUsageInRange(substanceId, weekStart, weekEnd, data);
    }
    if (bounds) {
        return getUseEntries(data)
            .filter(log =>
                logMatchesSubstance(log, substanceId, data)
                && log.date >= bounds.weekStart
                && log.date <= bounds.weekEnd
                && !logIdEquals(log.id, excludeLogId)
                && isPersonalUseLog(log)
            )
            .reduce((sum, log) => sum + Number(log.amount || 0), 0);
    }
    return getUsedAmountForWeek(substanceId, dateStr, excludeLogId, data);
}

function getTaperMonthUsage(substanceId, dateStr = getLocalDateString(), data = appData) {
    if (isVapeNicotineSubstanceId(substanceId)) {
        return getStatsMonthUsageTotal(substanceId, dateStr, data);
    }
    return getMonthPersonalUseTotal(substanceId, dateStr, data);
}

function formatTaperPuffsPerDay(value) {
    if (value == null || Number.isNaN(value)) return '—';
    return `${formatAmount(value)} puffs/day`;
}

function formatTaperDaysPerVape(value) {
    if (value == null || Number.isNaN(value)) return '—';
    return `${formatAmount(value)} days/vape`;
}

function formatTaperVapesPerMonth(value) {
    if (value == null || Number.isNaN(value)) return '—';
    return `${formatAmount(value)} vapes/month`;
}

function formatTaperNicotineStrength(value) {
    if (value == null || Number.isNaN(value)) return '—';
    return `${formatAmount(value)} mg/mL`;
}

function formatTaperMoney(value) {
    if (value == null || Number.isNaN(value)) return '—';
    return `${getCurrencySymbol()}${formatAmount(value, 2)}`;
}

function getPurchasesInDateRange(substanceId, startDate, endDate, data = appData) {
    return getPurchasesForSubstance(substanceId, data)
        .filter(p => p.date >= startDate && p.date <= endDate);
}

function getDaysSinceLastVapePurchase(substanceId, data = appData) {
    const purchases = getPurchasesForSubstance(substanceId, data);
    if (!purchases.length) return null;
    const last = purchases[purchases.length - 1];
    const lastMs = getPurchaseDatetimeMs(last);
    if (!lastMs) return null;
    return Math.max(0, (Date.now() - lastMs) / 86400000);
}

function buildBuyingTaperMessages(weekRow) {
    const messages = [];
    if (weekRow.minDaysPerVape > 0) {
        messages.push(`Make each vape last at least ${formatAmount(weekRow.minDaysPerVape)} days`);
    }
    if (weekRow.monthlyVapeCap > 0) {
        messages.push(`Max ${formatAmount(weekRow.monthlyVapeCap)} vapes this month`);
    }
    if (weekRow.weeklySpendCap > 0) {
        messages.push(`Weekly spend cap ${formatTaperMoney(weekRow.weeklySpendCap)}`);
    }
    if (weekRow.doNotBuyBefore) {
        messages.push(`Do not buy before ${formatDate(weekRow.doNotBuyBefore)}`);
    }
    return messages;
}

function generateReducePuffsWeeklyTargets(plan) {
    const {
        startDate, endDate, startingDailyAverage, goalDailyAverage,
        reductionAmount, reductionPercent, weeklyMax, puffReductionMode
    } = plan;
    const weeks = [];
    let cursor = startDate;
    let currentDaily = startingDailyAverage ?? 0;
    const goal = goalDailyAverage ?? 0;
    let guard = 0;
    const mode = puffReductionMode === 'percent' ? 'percent' : 'amount';

    while (cursor <= endDate && guard < 104) {
        guard++;
        const weekStart = cursor;
        let weekEnd = addDaysToDateStr(getWeekStartDateStr(cursor), 6);
        if (weekEnd > endDate) weekEnd = endDate;

        let dailyTarget = roundTaperValue(Math.max(goal, currentDaily));
        const wMax = weeklyMax > 0 ? roundTaperValue(weeklyMax) : roundTaperValue(dailyTarget * 7);

        weeks.push({
            weekStart,
            weekEnd,
            dailyTarget,
            weeklyMax: wMax,
            targetPuffsPerDay: dailyTarget,
            actualUsed: 0,
            difference: 0,
            status: 'under'
        });

        if (mode === 'percent') {
            currentDaily = Math.max(goal, currentDaily * (1 - (parseFloat(reductionPercent) || 0) / 100));
        } else {
            currentDaily = Math.max(goal, currentDaily - (parseFloat(reductionAmount) || 0));
        }

        const next = addDaysToDateStr(weekEnd, 1);
        if (next <= cursor) break;
        cursor = next;
    }
    return weeks;
}

function generateBuyingTaperWeeklyTargets(plan, substanceId, data = appData) {
    const { startDate, endDate } = plan;
    const currentDays = plan.currentBuyFrequencyDays ?? getVapeBaselineBuyFrequencyDays(substanceId) ?? 7;
    const goalDays = plan.goalBuyFrequencyDays ?? currentDays;
    const totalWeeks = Math.max(1, countWeeksBetween(startDate, endDate));
    const purchases = getPurchasesForSubstance(substanceId, data);
    const lastPurchase = purchases.length ? purchases[purchases.length - 1] : null;
    const weeks = [];
    let cursor = startDate;
    let guard = 0;

    while (cursor <= endDate && guard < 104) {
        guard++;
        const weekIndex = weeks.length;
        const progress = totalWeeks > 1 ? weekIndex / (totalWeeks - 1) : 1;
        const targetBuyDays = roundTaperValue(currentDays + (goalDays - currentDays) * progress);
        const weekStart = cursor;
        let weekEnd = addDaysToDateStr(getWeekStartDateStr(cursor), 6);
        if (weekEnd > endDate) weekEnd = endDate;

        let doNotBuyBefore = null;
        if (lastPurchase?.date) {
            doNotBuyBefore = addDaysToDateStr(lastPurchase.date, Math.ceil(targetBuyDays));
        }

        const weekRow = {
            week: weekIndex + 1,
            weekStart,
            weekEnd,
            targetBuyFrequencyDays: targetBuyDays,
            minDaysPerVape: targetBuyDays,
            monthlyVapeCap: plan.monthlyMax > 0 ? plan.monthlyMax : null,
            weeklySpendCap: plan.weeklySpendCap > 0 ? plan.weeklySpendCap : null,
            doNotBuyBefore,
            dailyTarget: null,
            weeklyMax: null,
            actualUsed: 0,
            actualPurchases: 0,
            actualSpend: 0,
            difference: 0,
            status: 'under'
        };
        weekRow.messages = buildBuyingTaperMessages(weekRow);
        weeks.push(weekRow);

        const next = addDaysToDateStr(weekEnd, 1);
        if (next <= cursor) break;
        cursor = next;
    }
    return weeks;
}

function generateNicotineTaperWeeklyTargets(plan) {
    const startStrength = parseFloat(plan.startingNicotineMgPerMl) || 0;
    const goalStrength = parseFloat(plan.goalNicotineMgPerMl) || 0;
    const step = Math.max(0.1, parseFloat(plan.nicotineStepDownMgPerMl) || 5);
    const intervalDays = getNicotineStepIntervalDays(plan.nicotineStepDownInterval);
    const weeks = [];
    let strength = startStrength > 0 ? startStrength : 50;
    let cursor = plan.startDate || getLocalDateString();
    let guard = 0;

    while (strength > goalStrength + INVENTORY_EPS && guard < 104) {
        guard++;
        const weekStart = cursor;
        const weekEnd = addDaysToDateStr(cursor, intervalDays - 1);
        weeks.push({
            week: weeks.length + 1,
            weekStart,
            weekEnd,
            targetNicotineMgPerMl: roundTaperValue(strength),
            dailyTarget: null,
            weeklyMax: null,
            actualUsed: 0,
            actualNicotineMgPerMl: null,
            difference: 0,
            status: 'under'
        });
        strength = Math.max(goalStrength, roundTaperValue(strength - step));
        cursor = addDaysToDateStr(weekEnd, 1);
    }

    if (!weeks.length || weeks[weeks.length - 1].targetNicotineMgPerMl > goalStrength) {
        weeks.push({
            week: weeks.length + 1,
            weekStart: cursor,
            weekEnd: addDaysToDateStr(cursor, intervalDays - 1),
            targetNicotineMgPerMl: roundTaperValue(goalStrength),
            dailyTarget: null,
            weeklyMax: null,
            actualUsed: 0,
            actualNicotineMgPerMl: null,
            difference: 0,
            status: 'under'
        });
    }

    if (weeks.length) plan.endDate = weeks[weeks.length - 1].weekEnd;
    return weeks;
}

function prefillVapeTaperDefaults(substanceId) {
    if (!isVapeNicotineSubstanceId(substanceId)) return;
    const type = document.getElementById('reduction-type')?.value;
    const currentAvgEl = document.getElementById('current-avg');
    const goalAvgEl = document.getElementById('goal-avg');
    if (type === 'reduce-puffs' && currentAvgEl && !currentAvgEl.value) {
        const baseline = getVapeBaselinePuffsPerDay(substanceId);
        if (baseline != null) setInputValue('current-avg', baseline);
    }
    if (type === 'reduce-buying') {
        const currentBuyEl = document.getElementById('vape-current-buy-days');
        const goalBuyEl = document.getElementById('vape-goal-buy-days');
        if (currentBuyEl && !currentBuyEl.value) {
            const baseline = getVapeBaselineBuyFrequencyDays(substanceId);
            if (baseline != null) setInputValue('vape-current-buy-days', baseline);
        }
        if (goalBuyEl && !goalBuyEl.value && currentBuyEl?.value) {
            setInputValue('vape-goal-buy-days', Math.max(1, parseFloat(currentBuyEl.value) + 2));
        }
    }
    if (type === 'reduce-nicotine') {
        const startNicEl = document.getElementById('vape-start-nicotine');
        const goalNicEl = document.getElementById('vape-goal-nicotine');
        if (startNicEl && !startNicEl.value) {
            const baseline = getVapeBaselineNicotineStrength(substanceId);
            if (baseline != null) setInputValue('vape-start-nicotine', baseline);
        }
        if (goalNicEl && !goalNicEl.value && startNicEl?.value) {
            setInputValue('vape-goal-nicotine', Math.max(0, parseFloat(startNicEl.value) - 10));
        }
    }
    if (type === 'reduce-puffs' && goalAvgEl && !goalAvgEl.value && currentAvgEl?.value) {
        setInputValue('goal-avg', Math.max(0, parseFloat(currentAvgEl.value) - 5));
    }
}

const MANUAL_WEEKLY_UNIT_PRESETS = ['g', 'mg', 'ug', 'drinks', 'cigarettes', 'puffs', 'hits', 'pills'];

function isManualWeeklyPlan(plan) {
    return plan?.reductionType === 'manual-weekly';
}

function getManualWeeklyMode(plan) {
    return plan?.manualWeeklyMode === 'percent' ? 'percent' : 'amount';
}

function isManualWeeklyPercentMode(plan) {
    return getManualWeeklyMode(plan) === 'percent';
}

function getManualWeeklyPlanUnit(plan, substanceId) {
    const stored = plan?.manualWeeklyUnit;
    if (stored && stored !== '__default__') return stored;
    return getSubstancePrimaryUnit(substanceId) || 'units';
}

function getManualWeeklyModeFromForm() {
    const active = document.querySelector('.manual-mode-btn.active');
    return active?.dataset.mode === 'percent' ? 'percent' : 'amount';
}

function getManualWeeklyUnitFromForm(substanceId = getTaperSubstanceId()) {
    const select = document.getElementById('manual-weekly-unit');
    if (!select) return getSubstance(substanceId)?.defaultUnit || 'units';
    if (select.value === '__custom__') {
        return document.getElementById('manual-weekly-unit-custom')?.value?.trim()
            || getSubstance(substanceId)?.defaultUnit
            || 'units';
    }
    if (select.value === '__default__') {
        return getSubstance(substanceId)?.defaultUnit || 'units';
    }
    return select.value;
}

function getManualWeeklyBaselineFromForm() {
    return parseOptionalTaperNumber(document.getElementById('manual-weekly-baseline'));
}

function resolveManualWeekTargetAmount(entry, plan) {
    if (getManualWeeklyMode(plan) === 'percent') {
        const baseline = parseFloat(plan.manualWeeklyBaseline) || 0;
        const pct = parseFloat(entry.targetPercent);
        if (!Number.isFinite(pct) || baseline <= 0) return 0;
        return roundTaperValue(baseline * (pct / 100));
    }
    return roundTaperValue(parseFloat(entry.targetAmount) || 0);
}

function formatManualWeeklyGoalCell(weekRow, plan, unit) {
    const target = weekRow.targetAmount ?? weekRow.weeklyMax ?? 0;
    const pct = weekRow.targetPercent;
    if (isManualWeeklyPercentMode(plan) && pct != null && Number.isFinite(parseFloat(pct))) {
        return `${pct}% (${formatTaperAmount(target, unit)})`;
    }
    return formatTaperAmount(target, unit);
}

function populateManualWeeklyUnitSelect(substanceId, selectedUnit) {
    const select = document.getElementById('manual-weekly-unit');
    const customInput = document.getElementById('manual-weekly-unit-custom');
    if (!select) return;

    const sub = getSubstance(substanceId);
    const defaultUnit = getSubstancePrimaryUnit(substanceId) || sub?.defaultUnit || 'units';
    const substanceUnits = sub?.units || [];
    const presetUnits = isVapeTrackingMode(substanceId)
        ? MANUAL_WEEKLY_UNIT_PRESETS.filter(u => ['puffs', 'hits'].includes(u))
        : MANUAL_WEEKLY_UNIT_PRESETS.filter(u => u !== 'puffs');
    const options = new Set([defaultUnit, ...substanceUnits, ...presetUnits]);

    select.innerHTML = '';
    const defaultOpt = document.createElement('option');
    defaultOpt.value = '__default__';
    defaultOpt.textContent = `Use substance default (${defaultUnit})`;
    select.appendChild(defaultOpt);

    [...options].sort((a, b) => a.localeCompare(b)).forEach(unit => {
        if (unit === defaultUnit) return;
        const opt = document.createElement('option');
        opt.value = unit;
        opt.textContent = unit;
        select.appendChild(opt);
    });

    const customOpt = document.createElement('option');
    customOpt.value = '__custom__';
    customOpt.textContent = 'Custom unit…';
    select.appendChild(customOpt);

    const isPreset = selectedUnit && [...options].has(selectedUnit);
    if (!selectedUnit || selectedUnit === defaultUnit || selectedUnit === '__default__') {
        select.value = '__default__';
        customInput?.classList.add('hidden');
        if (customInput) customInput.value = '';
    } else if (isPreset) {
        select.value = selectedUnit;
        customInput?.classList.add('hidden');
        if (customInput) customInput.value = '';
    } else {
        select.value = '__custom__';
        customInput?.classList.remove('hidden');
        if (customInput) customInput.value = selectedUnit;
    }
}

function updateManualWeeklyModeUI(mode) {
    const baselineGroup = document.getElementById('manual-weekly-baseline-group');
    const intro = document.getElementById('manual-weekly-intro');
    const example = document.getElementById('manual-weekly-example');
    baselineGroup?.classList.toggle('hidden', mode !== 'percent');
    document.querySelectorAll('.manual-mode-btn').forEach(btn => {
        btn.classList.toggle('active', btn.dataset.mode === mode);
    });
    if (intro) {
        intro.textContent = mode === 'percent'
            ? 'Enter a baseline and weekly reduction percentages. Targets are calculated automatically.'
            : 'Enter a weekly goal amount for each week.';
    }
    if (example) {
        example.textContent = mode === 'percent'
            ? 'Example: Baseline 70 cigarettes · Week 1: 100% · Week 2: 90% · Week 3: 80% · Week 4: 70%'
            : 'Example: Week 1: 70 cigarettes · Week 2: 63 cigarettes · Week 3: 56 cigarettes';
    }
}

function setManualWeeklyMode(mode, { skipRender = false } = {}) {
    const nextMode = mode === 'percent' ? 'percent' : 'amount';
    const prevMode = getManualWeeklyModeFromForm();
    updateManualWeeklyModeUI(nextMode);

    if (!skipRender && prevMode !== nextMode) {
        let targets = collectManualWeeklyTargetsFromForm();
        if (nextMode === 'percent') {
            let baseline = getManualWeeklyBaselineFromForm();
            if (!baseline && targets[0]?.targetAmount) baseline = parseFloat(targets[0].targetAmount) || 0;
            if (baseline) setInputValue('manual-weekly-baseline', baseline);
            targets = convertManualTargetsToPercent(targets, baseline);
        } else {
            const plan = {
                manualWeeklyMode: 'percent',
                manualWeeklyBaseline: getManualWeeklyBaselineFromForm()
            };
            targets = convertManualTargetsToAmount(targets, plan);
        }
        renderManualWeeklyTargetsEditor(targets);
    } else if (!skipRender) {
        renderManualWeeklyTargetsEditor(collectManualWeeklyTargetsFromForm());
    }
}

function convertManualTargetsToPercent(targets, baseline) {
    const base = parseFloat(baseline) || parseFloat(targets[0]?.targetAmount) || 0;
    return targets.map((t, i) => {
        const week = t.week ?? i + 1;
        const amount = parseFloat(t.targetAmount);
        let targetPercent = parseFloat(t.targetPercent);
        if (!Number.isFinite(targetPercent)) {
            if (base > 0 && Number.isFinite(amount)) {
                targetPercent = Math.round((amount / base) * 100);
            } else {
                targetPercent = Math.max(0, 100 - i * 10);
            }
        }
        return { week, targetPercent };
    });
}

function convertManualTargetsToAmount(targets, plan) {
    return targets.map((t, i) => ({
        week: t.week ?? i + 1,
        targetAmount: resolveManualWeekTargetAmount(t, plan)
    }));
}

function onManualWeeklyUnitChange() {
    const select = document.getElementById('manual-weekly-unit');
    const customInput = document.getElementById('manual-weekly-unit-custom');
    const isCustom = select?.value === '__custom__';
    customInput?.classList.toggle('hidden', !isCustom);
    renderManualWeeklyTargetsEditor(collectManualWeeklyTargetsFromForm());
}

function updateManualWeeklyComputedPreviews() {
    const mode = getManualWeeklyModeFromForm();
    if (mode !== 'percent') return;
    const baseline = getManualWeeklyBaselineFromForm() || 0;
    const unit = getManualWeeklyUnitFromForm();
    document.querySelectorAll('.manual-week-row').forEach(row => {
        const input = row.querySelector('.manual-week-percent-input');
        const preview = row.querySelector('.manual-week-computed');
        if (!input || !preview) return;
        const pct = parseFloat(input.value) || 0;
        const amt = baseline > 0 ? resolveManualWeekTargetAmount({ targetPercent: pct }, {
            manualWeeklyMode: 'percent',
            manualWeeklyBaseline: baseline
        }) : 0;
        preview.textContent = amt > 0 ? `(${formatTaperAmount(amt, unit)})` : '';
    });
}

function getManualWeeklyWeekNumber(plan, dateStr) {
    if (!plan?.startDate || !dateStr) return 1;
    const start = parseLocalDate(plan.startDate);
    const d = parseLocalDate(dateStr);
    if (!start || !d) return 1;
    const diffDays = Math.floor((d - start) / 86400000);
    return Math.max(1, Math.floor(diffDays / 7) + 1);
}

function getManualWeeklyStatus(actual, target) {
    if (target == null || target <= 0) {
        return { status: 'none', label: RECOVERY_TAPER_LABELS.none, emoji: '—' };
    }
    if (actual > target) {
        return { status: 'over', label: RECOVERY_TAPER_LABELS.over, emoji: '↑' };
    }
    if (actual >= target * 0.9) {
        return { status: 'close', label: RECOVERY_TAPER_LABELS.close, emoji: '~' };
    }
    return { status: 'under', label: RECOVERY_TAPER_LABELS.under, emoji: '✓' };
}

function buildWeeklyTargetsFromManual(plan) {
    const targets = plan.manualWeeklyTargets || [];
    const weeks = [];
    let cursor = plan.startDate || getLocalDateString();

    targets.forEach((entry, index) => {
        const weekNum = entry.week ?? index + 1;
        const weekStart = cursor;
        let weekEnd = addDaysToDateStr(getWeekStartDateStr(cursor), 6);
        if (plan.endDate && weekEnd > plan.endDate) weekEnd = plan.endDate;
        const targetAmount = resolveManualWeekTargetAmount(entry, plan);
        const targetPercent = entry.targetPercent != null && entry.targetPercent !== ''
            ? parseFloat(entry.targetPercent)
            : null;

        weeks.push({
            week: weekNum,
            weekStart,
            weekEnd,
            targetAmount,
            targetPercent: Number.isFinite(targetPercent) ? targetPercent : null,
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

    const mode = getManualWeeklyModeFromForm();
    const unit = getManualWeeklyUnitFromForm();
    const baseline = getManualWeeklyBaselineFromForm() || 0;
    const list = targets?.length
        ? targets
        : (mode === 'percent'
            ? [{ week: 1, targetPercent: 100 }]
            : [{ week: 1, targetAmount: '' }]);

    container.innerHTML = list.map((t, i) => {
        const weekNum = t.week ?? i + 1;
        if (mode === 'percent') {
            const pct = t.targetPercent ?? '';
            const computed = baseline > 0 && pct !== ''
                ? resolveManualWeekTargetAmount({ targetPercent: pct }, {
                    manualWeeklyMode: 'percent',
                    manualWeeklyBaseline: baseline
                })
                : 0;
            const computedLabel = computed > 0 ? `(${formatTaperAmount(computed, unit)})` : '';
            return `<div class="manual-week-row" data-week="${weekNum}">
                <label>Week ${weekNum} Goal</label>
                <input type="number" class="manual-week-percent-input" data-week="${weekNum}" min="0" max="1000" step="1" value="${pct}" placeholder="100" oninput="updateManualWeeklyComputedPreviews()">
                <span class="manual-week-unit">%</span>
                <span class="manual-week-computed">${computedLabel}</span>
            </div>`;
        }
        return `<div class="manual-week-row" data-week="${weekNum}">
            <label>Week ${weekNum} Goal</label>
            <input type="number" class="manual-week-target-input" data-week="${weekNum}" min="0" step="0.1" value="${t.targetAmount ?? ''}" placeholder="0">
            <span class="manual-week-unit">${unit}</span>
        </div>`;
    }).join('');
}

function collectManualWeeklyTargetsFromForm() {
    const mode = getManualWeeklyModeFromForm();
    if (mode === 'percent') {
        const inputs = document.querySelectorAll('.manual-week-percent-input');
        const baseline = getManualWeeklyBaselineFromForm();
        const plan = { manualWeeklyMode: 'percent', manualWeeklyBaseline: baseline };
        return [...inputs].map((input, index) => {
            const targetPercent = parseFloat(input.value);
            const entry = {
                week: parseInt(input.dataset.week, 10) || index + 1,
                targetPercent: Number.isFinite(targetPercent) ? targetPercent : 0
            };
            entry.targetAmount = resolveManualWeekTargetAmount(entry, plan);
            return entry;
        });
    }

    const inputs = document.querySelectorAll('.manual-week-target-input');
    return [...inputs].map((input, index) => {
        const amount = parseFloat(input.value);
        return {
            week: parseInt(input.dataset.week, 10) || index + 1,
            targetAmount: Number.isFinite(amount) ? amount : 0
        };
    });
}

function addManualWeeklyWeek() {
    const mode = getManualWeeklyModeFromForm();
    const targets = collectManualWeeklyTargetsFromForm();
    const last = targets[targets.length - 1];
    if (mode === 'percent') {
        const lastPct = parseFloat(last?.targetPercent);
        const nextPercent = Number.isFinite(lastPct) ? Math.max(0, lastPct - 10) : 90;
        targets.push({ week: targets.length + 1, targetPercent: nextPercent });
    } else {
        const lastAmt = parseFloat(last?.targetAmount);
        const nextAmount = Number.isFinite(lastAmt) ? roundTaperValue(Math.max(0, lastAmt - 1)) : '';
        targets.push({ week: targets.length + 1, targetAmount: nextAmount });
    }
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
    const startGoalRow = document.getElementById('taper-start-goal-row');
    const targetsList = document.getElementById('manual-weekly-targets-list');
    if (!manualSection || !goalGroup || !targetsList) return;

    if (isManual) {
        manualSection.insertBefore(goalGroup, targetsList);
    } else {
        startGoalRow?.appendChild(goalGroup);
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

function roundTaperActual(n) {
    return Math.round((parseFloat(n) || 0) * 10) / 10;
}

function migrateTaperPlan(plan, substanceId, data) {
    if (!plan) return;
    const now = new Date().toISOString();
    if (!plan.id) plan.id = `${substanceId}-${Date.now()}`;
    if (!plan.substanceId) plan.substanceId = substanceId;
    if (!plan.createdAt) {
        plan.createdAt = plan.startDate
            ? (parseLocalDateTime(plan.startDate, '12:00')?.toISOString() || now)
            : now;
    }
    if (!plan.updatedAt) plan.updatedAt = plan.createdAt;
    if (plan.isPaused === undefined) plan.isPaused = false;
    if (!plan.startDate) {
        plan.startDate = plan.createdAt
            ? getLocalDateFromIso(plan.createdAt)
            : getLocalDateString();
    }

    migrateLegacyTaperReductionType(plan, substanceId);

    if (isReducePuffsPlan(plan)) {
        if (!plan.puffReductionMode) {
            plan.puffReductionMode = plan.reductionPercent > 0 && !plan.reductionAmount ? 'percent' : 'amount';
        }
        plan.startingDailyAverage = plan.startingDailyAverage ?? plan.currentAvg ?? getVapeBaselinePuffsPerDay(substanceId, data);
        plan.goalDailyAverage = plan.goalDailyAverage ?? plan.goalAvg ?? 0;
        plan.currentAvg = plan.startingDailyAverage ?? null;
        plan.goalAvg = plan.goalDailyAverage ?? null;
        if (plan.reductionAmount == null && plan.puffReductionMode === 'amount') plan.reductionAmount = 5;
        if (plan.reductionPercent == null && plan.puffReductionMode === 'percent') plan.reductionPercent = 10;
    } else if (isReduceBuyingPlan(plan)) {
        plan.currentBuyFrequencyDays = plan.currentBuyFrequencyDays ?? getVapeBaselineBuyFrequencyDays(substanceId) ?? 7;
        plan.goalBuyFrequencyDays = plan.goalBuyFrequencyDays ?? plan.currentBuyFrequencyDays;
        if (plan.weeklySpendCap == null) plan.weeklySpendCap = null;
    } else if (isReduceNicotinePlan(plan)) {
        plan.startingNicotineMgPerMl = plan.startingNicotineMgPerMl ?? getVapeBaselineNicotineStrength(substanceId, data) ?? 50;
        plan.goalNicotineMgPerMl = plan.goalNicotineMgPerMl ?? 0;
        plan.nicotineStepDownMgPerMl = plan.nicotineStepDownMgPerMl ?? 5;
        plan.nicotineStepDownInterval = plan.nicotineStepDownInterval || 'weekly';
    } else if (isManualWeeklyPlan(plan)) {
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
            const map = { linear: 'reduce-amount', hold: 'fixed', custom: 'fixed' };
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
        const map = { linear: 'reduce-amount', hold: 'fixed', custom: 'fixed' };
        plan.reductionType = map[plan.planType] || (isVapeNicotineSubstanceId(substanceId) ? 'reduce-puffs' : 'reduce-amount');
    }

    plan.weeklyMax = plan.weeklyMax ?? null;
    if (plan.monthlyMax == null) plan.monthlyMax = null;
    plan.doNotSurpassDaily = plan.doNotSurpassDaily ?? plan.warnBeforeSurpass ?? true;
    plan.doNotSurpassWeekly = plan.doNotSurpassWeekly ?? false;
    plan.notes = plan.notes ?? plan.taperNotes ?? '';
    plan.taperNotes = plan.notes;

    if (isManualWeeklyPlan(plan)) {
        if (!plan.manualWeeklyMode) plan.manualWeeklyMode = 'amount';
        if (!plan.manualWeeklyTargets?.length) {
            if (plan.weeklyTargets?.length) {
                plan.manualWeeklyTargets = plan.weeklyTargets.map((w, i) => ({
                    week: w.week ?? i + 1,
                    targetAmount: w.targetAmount ?? w.weeklyMax ?? roundTaperValue((w.dailyTarget || 0) * 7),
                    targetPercent: w.targetPercent ?? null
                }));
            } else {
                plan.manualWeeklyTargets = plan.manualWeeklyMode === 'percent'
                    ? [{ week: 1, targetPercent: 100 }]
                    : [{ week: 1, targetAmount: '' }];
            }
        }
        if (isManualWeeklyPercentMode(plan)) {
            if (plan.manualWeeklyBaseline == null || plan.manualWeeklyBaseline === '') {
                const first = plan.manualWeeklyTargets[0];
                if (first?.targetPercent && first?.targetAmount) {
                    const pct = parseFloat(first.targetPercent);
                    const amt = parseFloat(first.targetAmount);
                    if (pct > 0 && Number.isFinite(amt)) {
                        plan.manualWeeklyBaseline = roundTaperValue(amt / (pct / 100));
                    }
                }
            }
            plan.manualWeeklyTargets = plan.manualWeeklyTargets.map((entry, index) => {
                const week = entry.week ?? index + 1;
                const targetPercent = entry.targetPercent != null
                    ? parseFloat(entry.targetPercent)
                    : (plan.manualWeeklyBaseline > 0 && entry.targetAmount != null
                        ? Math.round((parseFloat(entry.targetAmount) / plan.manualWeeklyBaseline) * 100)
                        : null);
                return {
                    week,
                    targetPercent: Number.isFinite(targetPercent) ? targetPercent : 100,
                    targetAmount: resolveManualWeekTargetAmount(
                        { targetPercent: Number.isFinite(targetPercent) ? targetPercent : 100 },
                        plan
                    )
                };
            });
        }
        plan.weeklyTargets = buildWeeklyTargetsFromManual(plan);
        if (!plan.endDate || plan.endDate < plan.startDate) {
            plan.endDate = computeManualPlanEndDate(plan);
        }
    } else if (isReduceNicotinePlan(plan)) {
        plan.weeklyTargets = generateNicotineTaperWeeklyTargets(plan);
    } else if (isReduceBuyingPlan(plan)) {
        if (!plan.endDate) {
            const d = new Date(parseLocalDate(plan.startDate) || new Date());
            d.setDate(d.getDate() + 84);
            plan.endDate = getLocalDateString(d);
        }
        plan.weeklyTargets = generateBuyingTaperWeeklyTargets(plan, substanceId, data);
    } else if (!plan.weeklyTargets?.length) {
        plan.weeklyTargets = generateWeeklyTargets(plan);
    }
    syncTaperPlanData(substanceId, data);
}

function countWeeksBetween(startDate, endDate) {
    const s = parseLocalDate(startDate);
    const e = parseLocalDate(endDate);
    if (!s || !e) return 1;
    return Math.max(1, Math.ceil((e - s) / (7 * 86400000)) + 1);
}

function generateWeeklyTargets(plan) {
    if (isManualWeeklyPlan(plan)) {
        return buildWeeklyTargetsFromManual(plan);
    }
    if (isReducePuffsPlan(plan)) {
        return generateReducePuffsWeeklyTargets(plan);
    }
    if (isReduceBuyingPlan(plan)) {
        return generateBuyingTaperWeeklyTargets(plan, plan.substanceId);
    }
    if (isReduceNicotinePlan(plan)) {
        return generateNicotineTaperWeeklyTargets(plan);
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

    if (isReduceBuyingPlan(plan)) {
        const today = getLocalDateString();
        const purchases = getPurchasesForSubstance(substanceId, data);
        const lastPurchase = purchases.length ? purchases[purchases.length - 1] : null;
        (plan.weeklyTargets || []).forEach(w => {
            const weekPurchases = getPurchasesInDateRange(substanceId, w.weekStart, w.weekEnd, data);
            w.actualPurchases = weekPurchases.length;
            w.actualSpend = roundTaperActual(weekPurchases.reduce((s, p) => s + (parseFloat(getPurchaseTotalCost(p)) || 0), 0));
            w.actualUsed = w.actualPurchases;
            if (lastPurchase?.date && w.targetBuyFrequencyDays > 0) {
                w.doNotBuyBefore = addDaysToDateStr(lastPurchase.date, Math.ceil(w.targetBuyFrequencyDays));
            }
            w.messages = buildBuyingTaperMessages(w);
            const daysSince = getDaysSinceLastVapePurchase(substanceId, data);
            let status = 'under';
            if (w.weeklySpendCap > 0 && w.actualSpend > w.weeklySpendCap) status = 'over';
            else if (w.monthlyVapeCap > 0) {
                const monthPurchases = getPurchasesInDateRange(substanceId, getMonthStartDateStr(today), getMonthEndDateStr(today), data).length;
                if (monthPurchases > w.monthlyVapeCap) status = 'over';
            } else if (daysSince != null && w.targetBuyFrequencyDays > 0 && daysSince < w.targetBuyFrequencyDays && today >= w.weekStart && today <= w.weekEnd) {
                status = 'over';
            }
            w.status = status;
            w.difference = roundTaperActual(w.actualPurchases - (w.monthlyVapeCap || 0));
        });
        expandDailyTargetsFromWeekly(plan);
        return;
    }

    if (isReduceNicotinePlan(plan)) {
        const currentStrength = getVapeCurrentNicotineStrength(substanceId);
        (plan.weeklyTargets || []).forEach(w => {
            w.actualNicotineMgPerMl = currentStrength;
            w.actualUsed = currentStrength;
            const target = w.targetNicotineMgPerMl;
            if (target == null) {
                w.status = 'none';
            } else if (currentStrength == null) {
                w.status = 'under';
            } else if (currentStrength > target) {
                w.status = 'over';
            } else {
                w.status = 'under';
            }
            w.difference = currentStrength != null && target != null
                ? roundTaperActual(currentStrength - target)
                : 0;
        });
        expandDailyTargetsFromWeekly(plan);
        return;
    }

    (plan.weeklyTargets || []).forEach(w => {
        let actual = 0;
        if (shouldUseVapeStatsUsage(substanceId, plan)) {
            actual = getStatsUsageInRange(substanceId, w.weekStart, w.weekEnd, data);
        } else {
            let d = w.weekStart;
            while (d <= w.weekEnd) {
                actual += getUsedAmount(substanceId, d, null, data);
                d = addDaysToDateStr(d, 1);
            }
        }
        w.actualUsed = roundTaperActual(actual);
        const target = isManualWeeklyPlan(plan)
            ? (w.targetAmount ?? w.weeklyMax)
            : w.weeklyMax;
        w.difference = roundTaperActual(w.actualUsed - target);
        w.status = isManualWeeklyPlan(plan)
            ? getManualWeeklyStatus(w.actualUsed, target).status
            : getTaperLimitStatus(w.actualUsed, target).status;
    });

    expandDailyTargetsFromWeekly(plan);
    (plan.dailyTargets || []).forEach(day => {
        const limit = day.limit ?? day.target;
        if (limit == null) return;
        const used = shouldUseVapeStatsUsage(substanceId, plan)
            ? getStatsUsageOnDate(substanceId, day.date, data)
            : getUsedAmount(substanceId, day.date, null, data);
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
    if (isReduceBuyingPlan(plan) || isReduceNicotinePlan(plan)) return null;

    if (isManualWeeklyPlan(plan)) {
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
    if (isReduceBuyingPlan(plan) || isReduceNicotinePlan(plan)) return null;

    if (isManualWeeklyPlan(plan)) {
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

function getTaperLimitStatus(used, limit) {
    if (limit == null || limit <= 0) {
        return { status: 'none', label: RECOVERY_TAPER_LABELS.none, emoji: '—' };
    }
    if (used > limit) {
        return { status: 'over', label: RECOVERY_TAPER_LABELS.over, emoji: '↑' };
    }
    if (used >= limit * 0.8) {
        return { status: 'close', label: RECOVERY_TAPER_LABELS.close, emoji: '~' };
    }
    return { status: 'under', label: RECOVERY_TAPER_LABELS.under, emoji: '✓' };
}

function getTaperDailyStatusText(status) {
    if (status === 'over') return 'Above daily plan';
    if (status === 'close') return 'Near daily plan';
    if (status === 'under') return 'On track (daily)';
    return 'No daily plan';
}

function getTaperWeeklyStatusText(status) {
    if (status === 'over') return 'Above weekly plan';
    if (status === 'close') return 'Near weekly plan';
    if (status === 'under') return 'On track (weekly)';
    return 'No weekly plan';
}

function applyTaperProgressBar(bar, barText, used, limit, getStatus = getTaperLimitStatus) {
    if (!bar) return 'none';
    const { status } = getStatus(used, limit);
    const pct = limit > 0 ? (used / limit) * 100 : 0;
    bar.style.width = `${Math.min(100, Math.max(pct, used > 0 ? 4 : 0))}%`;
    bar.classList.remove('dns-under', 'dns-close', 'dns-over');
    bar.classList.add(`dns-${status}`);
    if (barText) barText.textContent = formatTaperPercent(used, limit);
    return status;
}

function getTaperCalculatedMetrics(plan, substanceId) {
    const sub = getSubstance(substanceId);
    const unit = sub?.defaultUnit || 'units';
    const today = getLocalDateString();
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

    const checkDate = entryDate || getLocalDateString();
    const weekUsed = getUsedAmountForWeek(substanceId, checkDate, excludeLogId);
    const projectedWeek = weekUsed + amount;

    const weeklyLimit = getWeeklyLimit(substanceId, checkDate);
    if (plan.doNotSurpassWeekly && weeklyLimit != null && projectedWeek > weeklyLimit) {
        if (!confirm('This entry will exceed your weekly taper target. Log anyway?')) return false;
    }

    return true;
}

function buildTaperPlanFromForm(substanceId, existingPlan) {
    const now = new Date().toISOString();
    const startDate = document.getElementById('start-date')?.value
        || existingPlan?.startDate
        || (existingPlan?.createdAt ? getLocalDateFromIso(existingPlan.createdAt) : null)
        || getLocalDateString();
    const reductionType = document.getElementById('reduction-type')?.value || 'reduce-amount';
    const isManual = reductionType === 'manual-weekly';
    const isPuffs = reductionType === 'reduce-puffs';
    const isBuying = reductionType === 'reduce-buying';
    const isNicotine = reductionType === 'reduce-nicotine';
    const startingDailyAverage = (isManual || isBuying || isNicotine)
        ? null
        : parseOptionalTaperNumber(document.getElementById('current-avg'));
    const goalDailyAverage = (isBuying || isNicotine)
        ? null
        : parseOptionalTaperNumber(document.getElementById('goal-avg'));

    const plan = {
        id: existingPlan?.id || `${substanceId}-${Date.now()}`,
        substanceId,
        startDate,
        endDate: document.getElementById('end-date')?.value || null,
        startingDailyAverage,
        goalDailyAverage: isManual ? goalDailyAverage : (goalDailyAverage ?? 0),
        reductionType,
        reductionAmount: (isManual || isBuying || isNicotine) ? 0 : (parseFloat(document.getElementById('reduction-amount')?.value) || 0),
        reductionPercent: (isManual || isBuying || isNicotine) ? 0 : (parseFloat(document.getElementById('reduction-percent')?.value) || 0),
        weeklyMax: (isManual || isBuying || isNicotine) ? null : (parseFloat(document.getElementById('weekly-max')?.value) || null),
        monthlyMax: parseOptionalTaperNumber(document.getElementById('monthly-max')),
        doNotSurpassDaily: document.getElementById('do-not-surpass-daily')?.checked !== false,
        doNotSurpassWeekly: !!document.getElementById('do-not-surpass-weekly')?.checked,
        notes: document.getElementById('taper-notes')?.value || '',
        isPaused: existingPlan?.isPaused || false,
        createdAt: existingPlan?.createdAt || now,
        updatedAt: now
    };

    if (isPuffs) {
        plan.puffReductionMode = document.getElementById('puff-reduction-mode')?.value === 'percent' ? 'percent' : 'amount';
    }
    if (isBuying) {
        plan.currentBuyFrequencyDays = parseOptionalTaperNumber(document.getElementById('vape-current-buy-days'));
        plan.goalBuyFrequencyDays = parseOptionalTaperNumber(document.getElementById('vape-goal-buy-days'));
        plan.weeklySpendCap = parseOptionalTaperNumber(document.getElementById('vape-weekly-spend-cap'));
    }
    if (isNicotine) {
        plan.startingNicotineMgPerMl = parseOptionalTaperNumber(document.getElementById('vape-start-nicotine'));
        plan.goalNicotineMgPerMl = parseOptionalTaperNumber(document.getElementById('vape-goal-nicotine'));
        plan.nicotineStepDownMgPerMl = parseOptionalTaperNumber(document.getElementById('vape-nicotine-step'));
        plan.nicotineStepDownInterval = document.getElementById('vape-nicotine-interval')?.value || 'weekly';
    }

    if (isManual) {
        plan.manualWeeklyMode = getManualWeeklyModeFromForm();
        plan.manualWeeklyUnit = (() => {
            const select = document.getElementById('manual-weekly-unit');
            if (!select) return null;
            if (select.value === '__default__') return null;
            return getManualWeeklyUnitFromForm(substanceId);
        })();
        plan.manualWeeklyBaseline = plan.manualWeeklyMode === 'percent'
            ? getManualWeeklyBaselineFromForm()
            : null;
        plan.manualWeeklyTargets = collectManualWeeklyTargetsFromForm();
        plan.endDate = plan.endDate || computeManualPlanEndDate(plan);
    }

    plan.currentAvg = plan.startingDailyAverage;
    plan.goalAvg = plan.goalDailyAverage;
    plan.weeklyTargets = generateWeeklyTargets(plan);
    migrateTaperPlan(plan, substanceId, appData);
    return plan;
}

function syncTaperSubstanceToMain() {
    const mainId = getMainSubstanceId();
    const el = document.getElementById('taper-substance');
    if (el && mainId && [...el.options].some(o => o.value === mainId)) el.value = mainId;
}

function syncTaperSubstanceToSelected() {
    const el = document.getElementById('taper-substance');
    if (el && [...el.options].some(o => o.value === selectedSubstanceId)) {
        el.value = selectedSubstanceId;
    } else {
        syncTaperSubstanceToMain();
    }
}

function onTaperSubstanceChange() {
    const id = getTaperSubstanceId();
    if (id) setSelectedSubstanceId(id, { source: 'taper', refresh: false });
    taperEditingPlan = false;
    populateTaperReductionTypeSelect(getTaperSubstanceId());
    toggleTaperPlanTypeFields();
    prefillVapeTaperDefaults(getTaperSubstanceId());
    refreshTaperDashboard();
}

function toggleTaperPlanTypeFields() {
    const substanceId = getTaperSubstanceId();
    populateTaperReductionTypeSelect(substanceId);
    const type = document.getElementById('reduction-type')?.value || 'reduce-amount';
    const hint = document.getElementById('plan-type-hint');
    const amtGroup = document.getElementById('reduction-amount-group');
    const pctGroup = document.getElementById('reduction-percent-group');
    const reductionRow = document.getElementById('taper-reduction-fields-row');
    const manualSection = document.getElementById('manual-weekly-plan-section');
    const startAvgGroup = document.getElementById('taper-start-avg-group');
    const endWeeklyRow = document.getElementById('taper-end-weekly-row');
    const weeklyMaxGroup = document.getElementById('weekly-max-group');
    const monthlyMaxGroup = document.getElementById('monthly-max-group');
    const warnToggles = document.getElementById('taper-warn-toggles');
    const goalAvgInput = document.getElementById('goal-avg');
    const goalAvgLabel = document.getElementById('goal-avg-label');
    const startAvgLabel = document.querySelector('#taper-start-avg-group label');
    const endDateInput = document.getElementById('end-date');
    const endDateLabel = document.getElementById('end-date-label');
    const vapePuffsExtra = document.getElementById('taper-vape-puffs-extra');
    const vapeBuyingSection = document.getElementById('taper-vape-buying-section');
    const vapeNicotineSection = document.getElementById('taper-vape-nicotine-section');
    const isManual = type === 'manual-weekly';
    const isPuffs = type === 'reduce-puffs';
    const isBuying = type === 'reduce-buying';
    const isNicotine = type === 'reduce-nicotine';
    const isVape = isVapeNicotineSubstanceId(substanceId);
    const puffMode = document.getElementById('puff-reduction-mode')?.value || 'amount';

    reductionRow?.classList.toggle('hidden', isManual || isBuying || isNicotine);
    amtGroup?.classList.toggle('hidden', isManual || isBuying || isNicotine || type === 'reduce-percent' || type === 'fixed' || (isPuffs && puffMode === 'percent'));
    pctGroup?.classList.toggle('hidden', isManual || isBuying || isNicotine || (type !== 'reduce-percent' && !(isPuffs && puffMode === 'percent')));
    manualSection?.classList.toggle('hidden', !isManual);
    startAvgGroup?.classList.toggle('hidden', isManual || isBuying || isNicotine);
    document.getElementById('taper-start-goal-row')?.classList.toggle('hidden', isManual || isBuying || isNicotine);
    endWeeklyRow?.classList.toggle('hidden', isManual || isNicotine);
    weeklyMaxGroup?.classList.toggle('hidden', isManual || isBuying || isNicotine);
    monthlyMaxGroup?.classList.toggle('hidden', isManual || isNicotine);
    warnToggles?.classList.toggle('hidden', isManual || isBuying || isNicotine);
    vapePuffsExtra?.classList.toggle('hidden', !isPuffs);
    vapeBuyingSection?.classList.toggle('hidden', !isBuying);
    vapeNicotineSection?.classList.toggle('hidden', !isNicotine);

    if (startAvgLabel) {
        startAvgLabel.textContent = isPuffs ? 'Starting puffs/day' : 'Starting Daily Average (optional)';
    }
    if (goalAvgLabel) {
        if (isManual) goalAvgLabel.textContent = 'Goal Daily Average (optional)';
        else if (isPuffs) goalAvgLabel.textContent = 'Goal puffs/day';
        else goalAvgLabel.textContent = 'Daily average allowed';
    }
    if (monthlyMaxGroup) {
        const monthlyLabel = monthlyMaxGroup.querySelector('label');
        const monthlyHint = monthlyMaxGroup.querySelector('.field-hint');
        const primaryUnit = getSubstancePrimaryUnit(substanceId);
        if (monthlyLabel) {
            if (isBuying) monthlyLabel.textContent = 'Monthly vape purchase cap (optional)';
            else if (isVape) monthlyLabel.textContent = 'Monthly cap';
            else if (primaryUnit && primaryUnit !== 'units') {
                monthlyLabel.textContent = `Monthly cap (${primaryUnit})`;
            } else {
                monthlyLabel.textContent = 'Monthly cap';
            }
        }
        if (monthlyHint) {
            monthlyHint.textContent = isBuying
                ? 'Optional limit on how many vapes you buy per month.'
                : 'Optional monthly limit for your taper plan.';
        }
    }

    mountManualWeeklyFormFields(isManual);

    if (goalAvgInput) goalAvgInput.required = !isManual && !isBuying && !isNicotine;
    if (endDateLabel) {
        endDateLabel.textContent = isManual || isNicotine ? 'End Date (optional)' : 'End Date';
    }
    if (endDateInput) endDateInput.required = !isManual && !isNicotine;

    if (isManual) {
        populateManualWeeklyUnitSelect(getTaperSubstanceId());
        setManualWeeklyMode(getManualWeeklyModeFromForm() || 'amount', { skipRender: true });
        if (!document.querySelector('.manual-week-target-input, .manual-week-percent-input')) {
            renderManualWeeklyTargetsEditor(getManualWeeklyModeFromForm() === 'percent'
                ? [{ week: 1, targetPercent: 100 }]
                : [{ week: 1, targetAmount: '' }]);
        }
    }

    const hints = {
        'reduce-amount': 'Reduce a fixed amount from your daily average each week.',
        'reduce-percent': 'Reduce by a percentage of your daily average each week.',
        fixed: 'Keep the same daily limit until your target end date.',
        'manual-weekly': 'Set weekly goals by amount or percentage of a baseline.',
        'reduce-puffs': 'Reduce estimated puffs per day each week until you reach your goal.',
        'reduce-buying': 'Space out purchases and stretch each vape longer using buy frequency targets.',
        'reduce-nicotine': 'Step down nicotine strength (mg/mL) on a fixed schedule.'
    };
    if (hint) hint.textContent = hints[type] || hints['reduce-amount'];

    if (isVape && taperEditingPlan) prefillVapeTaperDefaults(substanceId);
}

function fillTaperFormFromPlan(plan) {
    if (!plan) return;
    const substanceId = plan.substanceId || getTaperSubstanceId();
    populateTaperReductionTypeSelect(substanceId, plan.reductionType || 'reduce-amount');
    setInputValue('start-date', plan.startDate || (plan.createdAt ? getLocalDateFromIso(plan.createdAt) : ''));
    const startVal = plan.startingDailyAverage ?? plan.currentAvg;
    setInputValue('current-avg', startVal != null && startVal !== '' ? startVal : '');
    const goalVal = plan.goalDailyAverage ?? plan.goalAvg;
    setInputValue('goal-avg', goalVal != null && goalVal !== '' ? goalVal : '');
    setInputValue('reduction-type', plan.reductionType || 'reduce-amount');
    setInputValue('reduction-amount', plan.reductionAmount ?? '');
    setInputValue('reduction-percent', plan.reductionPercent ?? '');
    setInputValue('puff-reduction-mode', plan.puffReductionMode || 'amount');
    setInputValue('vape-current-buy-days', plan.currentBuyFrequencyDays ?? '');
    setInputValue('vape-goal-buy-days', plan.goalBuyFrequencyDays ?? '');
    setInputValue('vape-weekly-spend-cap', plan.weeklySpendCap ?? '');
    setInputValue('vape-start-nicotine', plan.startingNicotineMgPerMl ?? '');
    setInputValue('vape-goal-nicotine', plan.goalNicotineMgPerMl ?? '');
    setInputValue('vape-nicotine-step', plan.nicotineStepDownMgPerMl ?? '');
    setInputValue('vape-nicotine-interval', plan.nicotineStepDownInterval || 'weekly');
    setInputValue('end-date', plan.endDate || '');
    setInputValue('weekly-max', plan.weeklyMax ?? '');
    setInputValue('monthly-max', plan.monthlyMax ?? '');
    setInputValue('taper-notes', plan.notes || '');
    const dailyEl = document.getElementById('do-not-surpass-daily');
    const weeklyEl = document.getElementById('do-not-surpass-weekly');
    if (dailyEl) dailyEl.checked = plan.doNotSurpassDaily !== false;
    if (weeklyEl) weeklyEl.checked = !!plan.doNotSurpassWeekly;
    toggleTaperPlanTypeFields();
    if (isManualWeeklyPlan(plan)) {
        const substanceId = plan.substanceId || getTaperSubstanceId();
        populateManualWeeklyUnitSelect(substanceId, plan.manualWeeklyUnit);
        setManualWeeklyMode(plan.manualWeeklyMode || 'amount', { skipRender: true });
        setInputValue('manual-weekly-baseline', plan.manualWeeklyBaseline ?? '');
        renderManualWeeklyTargetsEditor(plan.manualWeeklyTargets || []);
    }
}

function setDefaultTaperDates() {
    const today = getLocalDateString();
    const startEl = document.getElementById('start-date');
    if (startEl && !startEl.value) startEl.value = today;

    const endEl = document.getElementById('end-date');
    if (!endEl || endEl.value) return;
    if (document.getElementById('reduction-type')?.value === 'manual-weekly') return;
    const d = new Date();
    d.setDate(d.getDate() + 30);
    endEl.value = getLocalDateString(d);
}

function setDefaultTaperEndDate() {
    setDefaultTaperDates();
}

function showTaperSetup() {
    taperEditingPlan = true;
    setText('taper-setup-title', 'Create Taper Plan');
    setText('taper-generate-btn', 'Save Plan');
    document.getElementById('taper-dashboard')?.classList.add('hidden');
    document.getElementById('taper-no-plan')?.classList.add('hidden');
    document.getElementById('taper-setup')?.classList.remove('hidden');
    populateTaperReductionTypeSelect(getTaperSubstanceId());
    setDefaultTaperEndDate();
    toggleTaperPlanTypeFields();
    prefillVapeTaperDefaults(getTaperSubstanceId());
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
    return getRecoveryTaperStatusLabel(status);
}

function updateTaperKpiLabels(plan, substanceId) {
    const setLabel = (id, text) => {
        const el = document.getElementById(id)?.querySelector('.taper-kpi-label');
        if (el) el.textContent = text;
    };
    if (isReduceBuyingPlan(plan)) {
        setLabel('taper-kpi-used-today', 'Days since last buy');
        setLabel('taper-kpi-used-week', 'Purchases this week');
        setLabel('taper-kpi-remaining-week', 'Spend cap remaining');
        return;
    }
    if (isReduceNicotinePlan(plan)) {
        setLabel('taper-kpi-used-today', 'Current strength');
        setLabel('taper-kpi-used-week', 'Target this week');
        setLabel('taper-kpi-remaining-week', 'Steps to goal');
        return;
    }
    if (isVapeNicotineSubstanceId(substanceId)) {
        setLabel('taper-kpi-used-today', 'Puffs today (est.)');
        setLabel('taper-kpi-used-week', 'Puffs this week (est.)');
        setLabel('taper-kpi-remaining-week', 'Puffs left this week');
        return;
    }
    setLabel('taper-kpi-used-today', 'Used Today');
    setLabel('taper-kpi-used-week', 'Used This Week');
    setLabel('taper-kpi-remaining-week', 'Remaining This Week');
}

function renderTaperKpiRow(substanceId) {
    const plan = appData.taperPlans[substanceId];
    const sub = getSubstance(substanceId);
    if (!plan || !sub) return;

    syncTaperPlanData(substanceId);
    updateTaperKpiLabels(plan, substanceId);

    const set = (id, text) => {
        const el = document.getElementById(id);
        if (el) el.textContent = text;
    };
    const unit = getTaperTrackingUnit(plan, substanceId);
    const statusTiles = [
        'taper-kpi-used-today',
        'taper-kpi-used-week',
        'taper-kpi-remaining-week',
        'taper-kpi-status'
    ];
    statusTiles.forEach(id => document.getElementById(id)?.classList.remove('taper-kpi-under', 'taper-kpi-close', 'taper-kpi-over'));

    if (plan.isPaused) {
        set('taper-kpi-used-today-val', '—');
        set('taper-kpi-used-week-val', '—');
        set('taper-kpi-remaining-week-val', '—');
        set('taper-kpi-status-val', 'Paused');
        return;
    }

    const today = getLocalDateString();

    if (isReduceBuyingPlan(plan)) {
        const daysSince = getDaysSinceLastVapePurchase(substanceId);
        const weekStart = getWeekStartDateStr(today);
        const weekEnd = addDaysToDateStr(getWeekStartDateStr(today), 6);
        const purchasesThisWeek = getPurchasesInDateRange(substanceId, weekStart, weekEnd).length;
        const weekSpend = getPurchasesInDateRange(substanceId, weekStart, weekEnd)
            .reduce((s, p) => s + (parseFloat(getPurchaseTotalCost(p)) || 0), 0);
        const spendCap = plan.weeklySpendCap;
        set('taper-kpi-used-today-val', daysSince != null ? `${formatAmount(daysSince, 1)} days` : '—');
        set('taper-kpi-used-week-val', `${purchasesThisWeek} vapes`);
        if (spendCap > 0) {
            set('taper-kpi-remaining-week-val', formatTaperMoney(Math.max(0, spendCap - weekSpend)));
            const status = weekSpend > spendCap ? 'over' : 'under';
            set('taper-kpi-status-val', shortWeeklyTaperStatus(status));
            document.getElementById('taper-kpi-status')?.classList.add(`taper-kpi-${status}`);
        } else {
            set('taper-kpi-remaining-week-val', '—');
            set('taper-kpi-status-val', purchasesThisWeek === 0 ? 'On track' : 'Review');
        }
        return;
    }

    if (isReduceNicotinePlan(plan)) {
        const currentStrength = getVapeCurrentNicotineStrength(substanceId);
        const weekRow = getWeekRowForDate(plan, today);
        const targetStrength = weekRow?.targetNicotineMgPerMl;
        const stepsLeft = (plan.weeklyTargets || []).filter(w =>
            today <= w.weekEnd && w.targetNicotineMgPerMl != null && currentStrength != null
            && currentStrength > w.targetNicotineMgPerMl
        ).length;
        set('taper-kpi-used-today-val', formatTaperNicotineStrength(currentStrength));
        set('taper-kpi-used-week-val', formatTaperNicotineStrength(targetStrength));
        set('taper-kpi-remaining-week-val', stepsLeft ? String(stepsLeft) : '0');
        const status = currentStrength != null && targetStrength != null && currentStrength <= targetStrength ? 'under' : 'over';
        set('taper-kpi-status-val', shortWeeklyTaperStatus(status));
        document.getElementById('taper-kpi-status')?.classList.add(`taper-kpi-${status}`);
        return;
    }

    const usedToday = getTaperDayUsage(substanceId, today);
    const weeklyLimit = getWeeklyLimit(substanceId, today);
    const usedWeek = getTaperWeekUsage(substanceId, today);

    if (isVapeNicotineSubstanceId(substanceId)) {
        set('taper-kpi-used-today-val', formatTaperAmount(usedToday, 'puffs'));
        set('taper-kpi-used-week-val', formatTaperActualAmount(usedWeek, 'puffs'));
    } else {
        set('taper-kpi-used-today-val', formatTaperAmount(usedToday, sub.defaultUnit));
        set('taper-kpi-used-week-val', formatTaperActualAmount(usedWeek, unit));
    }

    if (weeklyLimit != null) {
        const remWeek = Math.max(0, weeklyLimit - usedWeek);
        set('taper-kpi-remaining-week-val', isVapeNicotineSubstanceId(substanceId)
            ? formatTaperAmount(remWeek, 'puffs')
            : formatTaperAmount(remWeek, unit));
        const weeklyStatus = isManualWeeklyPlan(plan)
            ? getManualWeeklyStatus(usedWeek, weeklyLimit).status
            : getTaperLimitStatus(usedWeek, weeklyLimit).status;
        set('taper-kpi-status-val', shortWeeklyTaperStatus(weeklyStatus));
        document.getElementById('taper-kpi-status')?.classList.add(`taper-kpi-${weeklyStatus}`);
        if (weeklyStatus === 'under' || weeklyStatus === 'close') {
            document.getElementById('taper-kpi-remaining-week')?.classList.add(`taper-kpi-${weeklyStatus}`);
        }
    } else {
        set('taper-kpi-remaining-week-val', '—');
        set('taper-kpi-status-val', 'No plan');
    }
}

function renderTaperProgressCard(substanceId) {
    const plan = appData.taperPlans[substanceId];
    const sub = getSubstance(substanceId);
    if (!plan || !sub) return;
    syncTaperPlanData(substanceId);
    const today = getLocalDateString();
    const unit = getTaperTrackingUnit(plan, substanceId);
    const set = (id, text) => { const el = document.getElementById(id); if (el) el.textContent = text; };

    if (plan.isPaused) {
        setTaperStatusBadge(document.getElementById('taper-weekly-status'), 'close', 'Paused');
        return;
    }

    if (isReduceBuyingPlan(plan)) {
        const weekRow = getWeekRowForDate(plan, today) || plan.weeklyTargets?.[0];
        const weekStart = getWeekStartDateStr(today);
        const weekEnd = addDaysToDateStr(getWeekStartDateStr(today), 6);
        const purchases = getPurchasesInDateRange(substanceId, weekStart, weekEnd);
        const weekSpend = purchases.reduce((s, p) => s + (parseFloat(getPurchaseTotalCost(p)) || 0), 0);
        const monthPurchases = getPurchasesInDateRange(substanceId, getMonthStartDateStr(today), getMonthEndDateStr(today)).length;
        const daysSince = getDaysSinceLastVapePurchase(substanceId);
        const messages = weekRow?.messages?.length ? weekRow.messages : buildBuyingTaperMessages(weekRow || {});

        set('taper-weekly-max-val', weekRow ? formatTaperDaysPerVape(weekRow.minDaysPerVape) : '—');
        set('taper-weekly-used', `${purchases.length} vapes`);
        set('taper-weekly-remaining', weekRow?.doNotBuyBefore ? formatDate(weekRow.doNotBuyBefore) : '—');
        set('taper-weekly-over-under', messages[0] || '—');
        set('taper-weekly-pct', daysSince != null ? `${formatAmount(daysSince, 1)} days since buy` : '—');
        set('taper-monthly-cap-val', plan.monthlyMax > 0 ? formatTaperVapesPerMonth(plan.monthlyMax) : '—');
        set('taper-monthly-used-val', `${monthPurchases} vapes`);
        set('taper-monthly-remaining-val', plan.monthlyMax > 0
            ? formatTaperVapesPerMonth(Math.max(0, plan.monthlyMax - monthPurchases))
            : '—');
        const spendCap = plan.weeklySpendCap;
        if (spendCap > 0) {
            applyTaperProgressBar(
                document.getElementById('taper-weekly-bar'),
                document.getElementById('taper-weekly-bar-text'),
                weekSpend,
                spendCap
            );
        }
        setTaperStatusBadge(document.getElementById('taper-weekly-status'), weekSpend > (spendCap || Infinity) ? 'over' : 'under', weekRow ? 'Buying plan' : '—');
        return;
    }

    if (isReduceNicotinePlan(plan)) {
        const weekRow = getWeekRowForDate(plan, today) || plan.weeklyTargets?.[0];
        const currentStrength = getVapeCurrentNicotineStrength(substanceId);
        const targetStrength = weekRow?.targetNicotineMgPerMl;
        set('taper-weekly-max-val', formatTaperNicotineStrength(targetStrength));
        set('taper-weekly-used', formatTaperNicotineStrength(currentStrength));
        set('taper-weekly-remaining', weekRow ? `Week ${weekRow.week || getTaperPlanWeekNumber(plan, today)}` : '—');
        set('taper-weekly-over-under', currentStrength != null && targetStrength != null
            ? (currentStrength <= targetStrength ? 'At or below target' : `${formatAmount(currentStrength - targetStrength)} mg/mL above`)
            : '—');
        set('taper-weekly-pct', '—');
        set('taper-monthly-cap-val', '—');
        set('taper-monthly-used-val', '—');
        set('taper-monthly-remaining-val', '—');
        const status = currentStrength != null && targetStrength != null && currentStrength <= targetStrength ? 'under' : 'over';
        setTaperStatusBadge(document.getElementById('taper-weekly-status'), status, shortTaperStatus(status));
        return;
    }

    const weeklyLimit = getWeeklyLimit(substanceId, today);
    const weeklyUsed = getTaperWeekUsage(substanceId, today);

    const monthLimit = getMonthlyLimit(substanceId, today);
    const monthUsed = getTaperMonthUsage(substanceId, today);
    const monthUnit = isVapeNicotineSubstanceId(substanceId) ? 'puffs' : sub.defaultUnit;
    set('taper-monthly-cap-val', monthLimit != null ? formatTaperAmount(monthLimit, monthUnit) : '—');
    set('taper-monthly-used-val', formatTaperAmount(monthUsed, monthUnit));
    set('taper-monthly-remaining-val', monthLimit != null
        ? formatTaperAmount(Math.max(0, monthLimit - monthUsed), monthUnit)
        : '—');

    if (weeklyLimit != null) {
        const remW = Math.max(0, weeklyLimit - weeklyUsed);
        const diffW = roundTaperActual(weeklyUsed - weeklyLimit);
        const weeklyStatusFn = isManualWeeklyPlan(plan) ? getManualWeeklyStatus : getTaperLimitStatus;
        const weeklyStatus = applyTaperProgressBar(
            document.getElementById('taper-weekly-bar'),
            document.getElementById('taper-weekly-bar-text'),
            weeklyUsed,
            weeklyLimit,
            weeklyStatusFn
        );
        const displayUnit = isVapeNicotineSubstanceId(substanceId) ? 'puffs' : unit;
        if (isManualWeeklyPlan(plan)) {
            const weekNum = getManualWeeklyWeekNumber(plan, today);
            const weekRow = getCurrentManualWeekRow(plan, today);
            const goalLabel = isManualWeeklyPercentMode(plan) && weekRow?.targetPercent != null
                ? `${weekRow.targetPercent}% (${formatTaperAmount(weeklyLimit, displayUnit)})`
                : formatTaperAmount(weeklyLimit, displayUnit);
            set('taper-weekly-max-val', `Week ${weekNum}: ${goalLabel}`);
        } else if (isReducePuffsPlan(plan)) {
            const weekRow = getWeekRowForDate(plan, today);
            set('taper-weekly-max-val', weekRow?.targetPuffsPerDay != null
                ? `${formatTaperAmount(weeklyLimit, 'puffs')} · ${formatTaperPuffsPerDay(weekRow.targetPuffsPerDay)}`
                : formatTaperAmount(weeklyLimit, 'puffs'));
        } else {
            set('taper-weekly-max-val', formatTaperAmount(weeklyLimit, displayUnit));
        }
        set('taper-weekly-used', formatTaperActualAmount(weeklyUsed, displayUnit));
        set('taper-weekly-remaining', formatTaperActualAmount(remW, displayUnit));
        set('taper-weekly-over-under', diffW > 0
            ? `${formatTaperActualAmount(diffW, displayUnit)} above`
            : diffW < 0
                ? `${formatTaperActualAmount(Math.abs(diffW), displayUnit)} below`
                : 'On plan');
        set('taper-weekly-pct', formatTaperPercent(weeklyUsed, weeklyLimit));
        const badgeStatus = weeklyStatus;
        setTaperStatusBadge(document.getElementById('taper-weekly-status'), badgeStatus, shortTaperStatus(badgeStatus));
    } else {
        set('taper-weekly-max-val', '—');
        set('taper-weekly-used', formatTaperAmount(weeklyUsed, isVapeNicotineSubstanceId(substanceId) ? 'puffs' : unit));
        set('taper-weekly-remaining', '—');
        set('taper-weekly-pct', '—');
        setTaperStatusBadge(document.getElementById('taper-weekly-status'), 'under', '—');
    }
}

function getTaperWeeklySummary(plan, substanceId) {
    const today = getLocalDateString();
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
            avgThis += getTaperDayUsage(substanceId, d);
            daysThis++;
            d = addDaysToDateStr(d, 1);
        }
    }
    avgThis = daysThis ? avgThis / daysThis : getTaperDayUsage(substanceId, today);

    const prevStart = currentWeek ? addDaysToDateStr(getWeekStartDateStr(currentWeek.weekStart), -7) : null;
    const prevWeek = prevStart ? plan.weeklyTargets.find(w => w.weekStart === getWeekStartDateStr(prevStart)) : null;
    let avgLast = 0;
    if (prevWeek) {
        let d = prevWeek.weekStart;
        let cnt = 0;
        while (d <= prevWeek.weekEnd) {
            avgLast += getTaperDayUsage(substanceId, d);
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
    const unit = getTaperTrackingUnit(plan, substanceId);
    const sum = getTaperWeeklySummary(plan, substanceId);

    if (summary) {
        const changeStr = sum.changeVsLast != null
            ? `${sum.changeVsLast >= 0 ? '+' : ''}${sum.changeVsLast.toFixed(0)}%`
            : '—';
        if (isReduceBuyingPlan(plan)) {
            summary.innerHTML = [
                taperChipStat('Week', sum.weekIndex || '—'),
                taperChipStat('Buy every (target)', formatTaperDaysPerVape(getWeekRowForDate(plan, getLocalDateString())?.targetBuyFrequencyDays)),
                taperChipStat('Min days/vape', formatTaperDaysPerVape(getWeekRowForDate(plan, getLocalDateString())?.minDaysPerVape)),
                taperChipStat('On-track weeks', sum.underWeeks),
                taperChipStat('Over weeks', sum.overWeeks)
            ].join('');
        } else if (isReduceNicotinePlan(plan)) {
            summary.innerHTML = [
                taperChipStat('Week', sum.weekIndex || '—'),
                taperChipStat('Target strength', formatTaperNicotineStrength(getWeekRowForDate(plan, getLocalDateString())?.targetNicotineMgPerMl)),
                taperChipStat('Current strength', formatTaperNicotineStrength(getVapeCurrentNicotineStrength(substanceId))),
                taperChipStat('Weeks remaining', sum.weeksRemaining)
            ].join('');
        } else {
            summary.innerHTML = [
                taperChipStat('Week', sum.weekIndex || '—'),
                taperChipStat('Weeks Remaining', sum.weeksRemaining),
                taperChipStat('Reduction done', `${formatAmount(sum.reductionCompleted)}/${formatAmount(sum.totalReduction)}`),
                taperChipStat('Avg this week', isReducePuffsPlan(plan) || isVapeNicotineSubstanceId(substanceId)
                    ? formatTaperPuffsPerDay(sum.avgThis)
                    : formatTaperAmount(sum.avgThis, unit)),
                taperChipStat('Avg last week', isReducePuffsPlan(plan) || isVapeNicotineSubstanceId(substanceId)
                    ? formatTaperPuffsPerDay(sum.avgLast)
                    : formatTaperAmount(sum.avgLast, unit)),
                taperChipStat('Change vs Last Week', changeStr),
                taperChipStat('On-track weeks', sum.underWeeks),
                taperChipStat('Over weeks', sum.overWeeks)
            ].join('');
        }
    }

    if (!plan.weeklyTargets?.length) {
        table.innerHTML = '<p class="empty-hint">No weekly rows.</p>';
        return;
    }

    if (isReduceBuyingPlan(plan)) {
        let html = `<table class="taper-preview-table taper-weekly-table"><thead><tr>
            <th>Week</th><th>Dates</th><th>Targets</th><th>Purchases</th><th>Spend</th><th>Status</th>
        </tr></thead><tbody>`;
        plan.weeklyTargets.forEach(w => {
            const messages = w.messages?.length ? w.messages : buildBuyingTaperMessages(w);
            const { emoji, label } = getTaperLimitStatus(w.actualPurchases, w.monthlyVapeCap || 0);
            html += `<tr class="taper-preview-${w.status}">
                <td>Week ${w.week ?? '—'}</td>
                <td>${formatDate(w.weekStart)} – ${formatDate(w.weekEnd)}</td>
                <td>${messages.join('<br>') || '—'}</td>
                <td>${w.actualPurchases || 0}</td>
                <td>${formatTaperMoney(w.actualSpend || 0)}</td>
                <td>${emoji} ${getRecoveryTaperStatusLabel(w.status)}</td>
            </tr>`;
        });
        html += '</tbody></table>';
        table.innerHTML = html;
        return;
    }

    if (isReduceNicotinePlan(plan)) {
        let html = `<table class="taper-preview-table taper-weekly-table"><thead><tr>
            <th>Week</th><th>Dates</th><th>Target mg/mL</th><th>Current mg/mL</th><th>Status</th>
        </tr></thead><tbody>`;
        plan.weeklyTargets.forEach(w => {
            html += `<tr class="taper-preview-${w.status}">
                <td>Week ${w.week ?? '—'}</td>
                <td>${formatDate(w.weekStart)} – ${formatDate(w.weekEnd)}</td>
                <td>${formatTaperNicotineStrength(w.targetNicotineMgPerMl)}</td>
                <td>${formatTaperNicotineStrength(w.actualNicotineMgPerMl)}</td>
                <td>${getRecoveryTaperStatusLabel(w.status)}</td>
            </tr>`;
        });
        html += '</tbody></table>';
        table.innerHTML = html;
        return;
    }

    if (isManualWeeklyPlan(plan)) {
        let html = `<table class="taper-preview-table taper-weekly-table"><thead><tr>
            <th>Week</th><th>Goal</th><th>Actual</th><th>%</th><th>Status</th>
        </tr></thead><tbody>`;
        plan.weeklyTargets.forEach(w => {
            const target = w.targetAmount ?? w.weeklyMax ?? 0;
            const { emoji, label } = getManualWeeklyStatus(w.actualUsed, target);
            const rowClass = `manual-week-${w.status}`;
            html += `<tr class="${rowClass}">
                <td>Week ${w.week ?? '—'}</td>
                <td>${formatManualWeeklyGoalCell(w, plan, unit)}</td>
                <td>${formatTaperActualAmount(w.actualUsed, unit)}</td>
                <td>${formatTaperPercent(w.actualUsed, target)}</td>
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
    const displayUnit = isVapeNicotineSubstanceId(substanceId) ? 'puffs' : unit;
    plan.weeklyTargets.forEach(w => {
        const { emoji, status } = getTaperLimitStatus(w.actualUsed, w.weeklyMax);
        const dailyLabel = isReducePuffsPlan(plan) && w.targetPuffsPerDay != null
            ? formatTaperPuffsPerDay(w.targetPuffsPerDay)
            : formatTaperAmount(w.dailyTarget, displayUnit);
        html += `<tr class="taper-preview-${w.status}">
            <td>${formatDate(w.weekStart)}</td>
            <td>${formatDate(w.weekEnd)}</td>
            <td>${dailyLabel}</td>
            <td>${formatTaperAmount(w.weeklyMax, displayUnit)}</td>
            <td>${formatTaperActualAmount(w.actualUsed, displayUnit)}</td>
            <td>${formatTaperWeekDiff(w.difference, displayUnit)}</td>
            <td>${emoji} ${getRecoveryTaperStatusLabel(status)}</td>
        </tr>`;
    });
    html += '</tbody></table>';
    table.innerHTML = html;
}

function getTaperMonthKeysFromLogs(substanceId) {
    const monthSet = new Set();
    getUseLogsForSubstance(substanceId, { sortAsc: false, personalUseOnly: true }).forEach(log => {
        if (log.date) monthSet.add(log.date.slice(0, 7));
    });
    if (isVapeNicotineSubstanceId(substanceId)) {
        getVapeDistributedUsageMap(substanceId).forEach((amount, date) => {
            if (amount > INVENTORY_EPS) monthSet.add(date.slice(0, 7));
        });
    }
    return [...monthSet].sort((a, b) => b.localeCompare(a));
}

function getTaperCalendarMonthBounds(year, monthIndex) {
    const monthStart = `${year}-${String(monthIndex + 1).padStart(2, '0')}-01`;
    const daysInMonth = new Date(year, monthIndex + 1, 0).getDate();
    const monthEnd = `${year}-${String(monthIndex + 1).padStart(2, '0')}-${String(daysInMonth).padStart(2, '0')}`;
    return { monthStart, monthEnd, daysInMonth };
}

function calculateMonthlyTrackingSummary(substanceId, year, monthIndex) {
    const { monthStart, monthEnd, daysInMonth } = getTaperCalendarMonthBounds(year, monthIndex);
    const enriched = buildEnrichedUseEntries(substanceId);
    const monthEntries = enriched.filter(e =>
        isPersonalUseLog(e) && e.date >= monthStart && e.date <= monthEnd
    );
    const isVape = isVapeNicotineSubstanceId(substanceId);

    let totalUsage;
    let sessions;
    let useDays;
    let totalDurationHours = 0;
    let avgDurationHours;
    let avgBreak;
    let longestBreak;
    let shortestBreak;
    let gPerHour = null;

    if (isVape) {
        totalUsage = getStatsUsageInRange(substanceId, monthStart, monthEnd);
        sessions = monthEntries.filter(e => isVapeUseLog(e)).length;
        useDays = 0;
        getVapeDistributedUsageMap(substanceId).forEach((amount, date) => {
            if (date >= monthStart && date <= monthEnd && amount > INVENTORY_EPS) useDays++;
        });
        const breakHours = getVapePurchaseBreakHoursList(substanceId, monthStart, monthEnd);
        avgBreak = breakHours.length ? breakHours.reduce((a, b) => a + b, 0) / breakHours.length : null;
        longestBreak = breakHours.length ? Math.max(...breakHours) : null;
        shortestBreak = breakHours.length ? Math.min(...breakHours) : null;
        const supplyDurMs = getVapeFinishedSupplyDurationsInRange(substanceId, monthStart, monthEnd);
        totalDurationHours = supplyDurMs.reduce((s, ms) => s + ms, 0) / 3600000;
        avgDurationHours = supplyDurMs.length ? totalDurationHours / supplyDurMs.length : null;
    } else {
        totalUsage = monthEntries.reduce((sum, e) => sum + (parseFloat(e.amount) || 0), 0);
        sessions = monthEntries.length;
        useDays = new Set(monthEntries.map(e => e.date)).size;
        monthEntries.forEach(e => {
            if (e.durationHours) totalDurationHours += e.durationHours;
        });
        avgDurationHours = sessions > 0 ? totalDurationHours / sessions : null;
        const breaks = monthEntries
            .map(e => e.breakDurationHours)
            .filter(h => h != null && h >= 0);
        avgBreak = breaks.length ? breaks.reduce((a, b) => a + b, 0) / breaks.length : null;
        longestBreak = breaks.length ? Math.max(...breaks) : null;
        shortestBreak = breaks.length ? Math.min(...breaks) : null;
    }

    const useDayPct = daysInMonth > 0 ? (useDays / daysInMonth) * 100 : 0;
    const avgPerSession = sessions > 0 ? totalUsage / sessions : null;
    const avgPerUseDay = useDays > 0 ? totalUsage / useDays : null;
    const avgPerCalendarDay = daysInMonth > 0 ? totalUsage / daysInMonth : null;
    if (!isVape) {
        gPerHour = totalDurationHours > 0 ? totalUsage / totalDurationHours : null;
    }

    const monthLabel = new Date(year, monthIndex, 1).toLocaleDateString('en-US', {
        month: 'long',
        year: 'numeric'
    });

    return {
        year,
        monthIndex,
        monthLabel,
        monthStart,
        monthEnd,
        daysInMonth,
        totalUsage,
        sessions,
        useDays,
        useDayPct,
        totalDurationHours,
        avgDurationHours,
        avgPerSession,
        avgPerUseDay,
        avgPerCalendarDay,
        gPerHour,
        avgBreak,
        longestBreak,
        shortestBreak
    };
}

function getMonthlyTrackingSummaries(substanceId) {
    const keys = getTaperMonthKeysFromLogs(substanceId);
    const summaries = keys.map(key => {
        const [yearStr, monthStr] = key.split('-');
        return calculateMonthlyTrackingSummary(
            substanceId,
            parseInt(yearStr, 10),
            parseInt(monthStr, 10) - 1
        );
    });

    return summaries.map((summary, index) => {
        const previous = summaries[index + 1];
        let trend = 'none';
        if (previous) {
            if (summary.totalUsage < previous.totalUsage) trend = 'down';
            else if (summary.totalUsage > previous.totalUsage) trend = 'up';
        }
        return { ...summary, trend };
    });
}

function renderTaperMonthlyTrendBadge(trend) {
    if (trend === 'down') {
        return '<span class="taper-month-trend taper-month-trend-down">↓ Lower than prior month</span>';
    }
    if (trend === 'up') {
        return '<span class="taper-month-trend taper-month-trend-up">↑ Higher than prior month</span>';
    }
    return '<span class="taper-month-trend taper-month-trend-none">— No prior month</span>';
}

function renderTaperMonthlyTrackingCard(summary, unit) {
    const metrics = [
        ['Month start', formatDate(summary.monthStart)],
        ['Month end', formatDate(summary.monthEnd)],
        ['Total usage', formatTaperMonthlyAmount(summary.totalUsage, unit)],
        ['Average break', formatDurationHMS(summary.avgBreak)],
        ['Sessions', summary.sessions ? String(summary.sessions) : '0'],
        ['Use days', summary.useDays ? String(summary.useDays) : '0'],
        ['Use day %', summary.useDays ? `${summary.useDayPct.toFixed(2)}%` : '0.00%'],
        ['Total duration', formatDurationHMS(summary.totalDurationHours)],
        ['Average duration', formatDurationHMS(summary.avgDurationHours)],
        [`Avg ${unit} / session`, formatTaperMonthlyAmount(summary.avgPerSession, unit)],
        [`Avg ${unit} / use day`, formatTaperMonthlyAmount(summary.avgPerUseDay, unit)],
        [`Avg ${unit} / calendar day`, formatTaperMonthlyAmount(summary.avgPerCalendarDay, unit)],
        ['Longest break', formatDurationHMS(summary.longestBreak)],
        ['Shortest break', formatDurationHMS(summary.shortestBreak)],
        [`${unit} / hour`, formatTaperMonthlyRate(summary.gPerHour, unit, '/hr')]
    ];

    return `
        <article class="taper-month-card">
            <header class="taper-month-card-header">
                <h4>${summary.monthLabel}</h4>
                ${renderTaperMonthlyTrendBadge(summary.trend)}
            </header>
            <div class="taper-month-metrics">
                ${metrics.map(([label, value]) =>
                    `<div class="taper-month-metric"><span>${label}</span><strong>${value}</strong></div>`
                ).join('')}
            </div>
        </article>`;
}

function renderMonthlyTracking(substanceId) {
    const container = document.getElementById('stats-monthly-tracking');
    if (!container) return;
    if (!substanceId) {
        container.innerHTML = '<p class="empty-hint">Select a substance to view monthly tracking.</p>';
        return;
    }
    const sub = getSubstance(substanceId);
    if (!sub) {
        container.innerHTML = '<p class="empty-hint">Select a substance to view monthly tracking.</p>';
        return;
    }

    const summaries = getMonthlyTrackingSummaries(substanceId);
    if (!summaries.length) {
        container.innerHTML = '<p class="empty-hint">No use log entries yet — monthly tracking will appear here.</p>';
        return;
    }

    const unit = sub.defaultUnit || 'units';
    container.innerHTML = summaries.map(summary => renderTaperMonthlyTrackingCard(summary, unit)).join('');
}

function renderTaperPlanSummary(substanceId) {
    const plan = appData.taperPlans[substanceId];
    const sub = getSubstance(substanceId);
    if (!plan || !sub) return;
    const summary = document.getElementById('taper-plan-summary-text');
    const icon = document.getElementById('taper-plan-icon');
    const today = getLocalDateString();
    const set = (id, text) => {
        const el = document.getElementById(id);
        if (el) el.textContent = text;
    };

    if (icon) icon.textContent = sub.icon || '📉';
    if (summary) {
        summary.textContent = `${sub.name} · ${TAPER_REDUCTION_LABELS[plan.reductionType] || plan.reductionType}`;
    }

    const weekCount = isManualWeeklyPlan(plan)
        ? (plan.manualWeeklyTargets?.length || plan.weeklyTargets?.length || 0)
        : (plan.weeklyTargets?.length || countWeeksBetween(plan.startDate, plan.endDate));

    set('taper-plan-start-date', plan.startDate ? formatDate(plan.startDate) : '—');
    set('taper-plan-end-date', plan.endDate ? formatDate(plan.endDate) : '—');
    set('taper-plan-week-count', String(weekCount || '—'));
    set('taper-plan-current-week', `Week ${getTaperPlanWeekNumber(plan, today)}`);

    const pauseBtn = document.getElementById('taper-pause-btn');
    if (pauseBtn) pauseBtn.textContent = plan.isPaused ? '▶ Resume' : '⏸ Pause';
    document.getElementById('taper-paused-banner')?.classList.toggle('hidden', !plan.isPaused);

    const fill = document.getElementById('taper-plan-pct-fill');
    const pctLabel = document.getElementById('taper-plan-pct-label');
    if (fill && plan.startDate && plan.endDate) {
        const start = parseLocalDate(plan.startDate);
        const end = parseLocalDate(plan.endDate);
        if (start && end) {
            const pct = Math.min(100, Math.max(0, ((Date.now() - start) / (end - start)) * 100));
            const rounded = Math.round(pct);
            fill.style.width = `${rounded}%`;
            if (pctLabel) pctLabel.textContent = `Plan progress · ${rounded}%`;
        }
    }
}

function handleTaperSubmit(e) {
    e.preventDefault();
    const substanceId = document.getElementById('taper-substance')?.value;
    const sub = getSubstance(substanceId);
    if (!sub?.taperTrackingEnabled) return alert('Taper tracking is disabled for this substance.');
    const reductionType = document.getElementById('reduction-type')?.value;
    const existingPlan = appData.taperPlans[substanceId];
    const startDate = document.getElementById('start-date')?.value
        || existingPlan?.startDate
        || (existingPlan?.createdAt ? getLocalDateFromIso(existingPlan.createdAt) : null)
        || getLocalDateString();

    if (!startDate) return alert('Start date is required.');

    if (reductionType === 'manual-weekly') {
        const mode = getManualWeeklyModeFromForm();
        const targets = collectManualWeeklyTargetsFromForm();
        if (!targets.length) return alert('Add at least one weekly target.');
        if (mode === 'percent') {
            const baseline = getManualWeeklyBaselineFromForm();
            if (baseline == null || baseline <= 0) {
                return alert('Enter a baseline amount for percentage mode.');
            }
            const hasPercent = targets.some(t => (parseFloat(t.targetPercent) || 0) > 0);
            if (!hasPercent) return alert('Enter at least one weekly percentage.');
        } else {
            const hasAmount = targets.some(t => (parseFloat(t.targetAmount) || 0) > 0);
            if (!hasAmount) return alert('Enter at least one weekly target amount.');
        }
    } else if (reductionType === 'reduce-buying') {
        const currentDays = parseOptionalTaperNumber(document.getElementById('vape-current-buy-days'));
        const goalDays = parseOptionalTaperNumber(document.getElementById('vape-goal-buy-days'));
        if (currentDays == null || currentDays <= 0) return alert('Enter your current buying frequency (days).');
        if (goalDays == null || goalDays <= 0) return alert('Enter your goal buying frequency (days).');
        const endDate = document.getElementById('end-date')?.value;
        if (!endDate || new Date(endDate) <= new Date(startDate)) {
            return alert('End date must be after the start date.');
        }
    } else if (reductionType === 'reduce-nicotine') {
        const startNic = parseOptionalTaperNumber(document.getElementById('vape-start-nicotine'));
        const goalNic = parseOptionalTaperNumber(document.getElementById('vape-goal-nicotine'));
        const step = parseOptionalTaperNumber(document.getElementById('vape-nicotine-step'));
        if (startNic == null || startNic <= 0) return alert('Enter a starting nicotine strength (mg/mL).');
        if (goalNic == null || goalNic < 0) return alert('Enter a goal nicotine strength (mg/mL).');
        if (step == null || step <= 0) return alert('Enter a step-down amount (mg/mL).');
    } else if (reductionType === 'reduce-puffs') {
        const goal = parseOptionalTaperNumber(document.getElementById('goal-avg'));
        if (goal == null || goal < 0) return alert('Enter a goal puffs/day target.');
        const endDate = document.getElementById('end-date')?.value;
        if (!endDate || new Date(endDate) <= new Date(startDate)) {
            return alert('End date must be after the start date.');
        }
    } else {
        const endDate = document.getElementById('end-date')?.value;
        if (!endDate || new Date(endDate) <= new Date(startDate)) {
            return alert('End date must be after the start date.');
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
    renderTaperProgressCard(substanceId);
    renderTaperWeeklyPlan(substanceId);
    renderTaperByWeek(substanceId);
    renderTaperWeeklyCalendar(substanceId);
    applyCollapsedSections();
}

function getPlannedWeeklyTarget(plan, weekRow) {
    if (isManualWeeklyPlan(plan)) {
        return roundTaperValue(parseFloat(weekRow.targetAmount ?? weekRow.weeklyMax) || 0);
    }
    if (isReduceBuyingPlan(plan)) {
        return roundTaperValue(parseFloat(weekRow.monthlyVapeCap) || 0);
    }
    if (isReduceNicotinePlan(plan)) {
        return roundTaperValue(parseFloat(weekRow.targetNicotineMgPerMl) || 0);
    }
    return roundTaperValue(parseFloat(weekRow.weeklyMax) || 0);
}

function getTaperByWeekStatus(used, planned) {
    if (planned == null || planned <= 0) {
        return { status: 'none', label: '—' };
    }
    if (used > planned) {
        return { status: 'over', label: RECOVERY_TAPER_LABELS.over };
    }
    if (used === planned) {
        return { status: 'on-track', label: 'On track' };
    }
    return { status: 'under', label: RECOVERY_TAPER_LABELS.under };
}

function formatTaperWeekDiff(value, unit) {
    if (value == null || Number.isNaN(value)) return '—';
    const rounded = formatAmount(roundTaperActual(value), 1);
    if (parseFloat(rounded) > 0) return `+${rounded}${unit ? ` ${unit}` : ''}`;
    return `${rounded}${unit ? ` ${unit}` : ''}`;
}

function buildTaperByWeekData(substanceId) {
    const plan = appData.taperPlans[substanceId];
    if (!plan?.weeklyTargets?.length) return null;

    syncTaperPlanData(substanceId);
    const today = getLocalDateString();
    let runningPlanned = 0;
    let runningUsed = 0;

    const rows = plan.weeklyTargets.map((weekRow, index) => {
        const planned = getPlannedWeeklyTarget(plan, weekRow);
        const used = roundTaperActual(weekRow.actualUsed || 0);
        const diff = roundTaperActual(used - planned);
        runningPlanned = roundTaperValue(runningPlanned + planned);
        runningUsed = roundTaperActual(runningUsed + used);
        const runningDiff = roundTaperActual(runningPlanned - runningUsed);
        const { status, label } = getTaperByWeekStatus(used, planned);
        const weekNum = weekRow.week ?? index + 1;
        const isCurrent = today >= weekRow.weekStart && today <= weekRow.weekEnd;

        return {
            weekNum,
            weekStart: weekRow.weekStart,
            weekEnd: weekRow.weekEnd,
            planned,
            used,
            diff,
            runningPlanned,
            runningUsed,
            runningDiff,
            status,
            statusLabel: label,
            isCurrent
        };
    });

    const currentIndex = rows.findIndex(r => r.isCurrent);
    const currentWeek = currentIndex >= 0 ? currentIndex + 1 : 0;
    const weeksRemaining = currentIndex >= 0
        ? Math.max(0, rows.length - currentWeek)
        : rows.filter(r => r.weekStart > today).length;
    const totalPlanned = roundTaperValue(rows.reduce((sum, r) => sum + r.planned, 0));
    const totalUsed = roundTaperActual(rows.reduce((sum, r) => sum + r.used, 0));
    const remainingAllowance = roundTaperActual(totalPlanned - totalUsed);

    return {
        rows,
        totalPlanned,
        totalUsed,
        remainingAllowance,
        currentWeek: currentWeek || '—',
        weeksRemaining
    };
}

function renderTaperByWeek(substanceId) {
    const summaryEl = document.getElementById('taper-by-week-summary');
    const tableEl = document.getElementById('taper-by-week-table');
    if (!summaryEl || !tableEl) return;

    const plan = appData.taperPlans[substanceId];
    const sub = getSubstance(substanceId);
    if (!plan || !sub) {
        summaryEl.innerHTML = '';
        tableEl.innerHTML = '<p class="empty-hint">No taper plan for this substance.</p>';
        return;
    }

    const data = buildTaperByWeekData(substanceId);
    if (!data?.rows?.length) {
        summaryEl.innerHTML = '';
        tableEl.innerHTML = '<p class="empty-hint">No weekly targets in this plan.</p>';
        return;
    }

    const unit = getTaperTrackingUnit(plan, substanceId);
    if (isReduceBuyingPlan(plan)) {
        summaryEl.innerHTML = [
            taperChipStat('Weeks in plan', data.rows.length),
            taperChipStat('Purchases so far', formatAmount(data.totalUsed, 0)),
            taperChipStat('Current week', data.currentWeek),
            taperChipStat('Weeks remaining', data.weeksRemaining)
        ].join('');
    } else if (isReduceNicotinePlan(plan)) {
        summaryEl.innerHTML = [
            taperChipStat('Steps in plan', data.rows.length),
            taperChipStat('Current strength', formatTaperNicotineStrength(getVapeCurrentNicotineStrength(substanceId))),
            taperChipStat('Current week', data.currentWeek),
            taperChipStat('Weeks remaining', data.weeksRemaining)
        ].join('');
    } else {
        summaryEl.innerHTML = [
            taperChipStat('Total planned', formatTaperAmount(data.totalPlanned, isVapeNicotineSubstanceId(substanceId) ? 'puffs' : unit)),
            taperChipStat('Total used', formatTaperActualAmount(data.totalUsed, isVapeNicotineSubstanceId(substanceId) ? 'puffs' : unit)),
            taperChipStat('Remaining allowance', formatTaperAmount(data.remainingAllowance, isVapeNicotineSubstanceId(substanceId) ? 'puffs' : unit)),
            taperChipStat('Current week', data.currentWeek),
            taperChipStat('Weeks remaining', data.weeksRemaining)
        ].join('');
    }

    if (isReduceBuyingPlan(plan)) {
        let html = `<table class="taper-preview-table taper-by-week-table"><thead><tr>
            <th>Week</th><th>Dates</th><th>Targets</th><th>Purchases</th><th>Spend</th><th>Status</th>
        </tr></thead><tbody>`;
        data.rows.forEach(row => {
            const weekRow = plan.weeklyTargets[row.weekNum - 1];
            const messages = weekRow?.messages?.length ? weekRow.messages : buildBuyingTaperMessages(weekRow || {});
            html += `<tr class="taper-by-week-row taper-by-week-${row.status}${row.isCurrent ? ' taper-by-week-current' : ''}">
                <td>Week ${row.weekNum}</td>
                <td class="taper-by-week-dates">${formatDate(row.weekStart)} – ${formatDate(row.weekEnd)}</td>
                <td>${messages.join('<br>') || '—'}</td>
                <td>${weekRow?.actualPurchases || 0}</td>
                <td>${formatTaperMoney(weekRow?.actualSpend || 0)}</td>
                <td><span class="taper-by-week-status taper-by-week-status-${row.status}">${row.statusLabel}</span></td>
            </tr>`;
        });
        html += '</tbody></table>';
        tableEl.innerHTML = html;
        return;
    }

    if (isReduceNicotinePlan(plan)) {
        let html = `<table class="taper-preview-table taper-by-week-table"><thead><tr>
            <th>Week</th><th>Dates</th><th>Target mg/mL</th><th>Current mg/mL</th><th>Status</th>
        </tr></thead><tbody>`;
        data.rows.forEach(row => {
            const weekRow = plan.weeklyTargets[row.weekNum - 1];
            html += `<tr class="taper-by-week-row taper-by-week-${row.status}${row.isCurrent ? ' taper-by-week-current' : ''}">
                <td>Week ${row.weekNum}</td>
                <td class="taper-by-week-dates">${formatDate(row.weekStart)} – ${formatDate(row.weekEnd)}</td>
                <td>${formatTaperNicotineStrength(weekRow?.targetNicotineMgPerMl)}</td>
                <td>${formatTaperNicotineStrength(weekRow?.actualNicotineMgPerMl)}</td>
                <td><span class="taper-by-week-status taper-by-week-status-${row.status}">${row.statusLabel}</span></td>
            </tr>`;
        });
        html += '</tbody></table>';
        tableEl.innerHTML = html;
        return;
    }

    let html = `<table class="taper-preview-table taper-by-week-table"><thead><tr>
        <th>Week</th>
        <th>Dates</th>
        <th>Planned</th>
        <th>Used</th>
        <th>+/-</th>
        <th>Running Planned</th>
        <th>Running Used</th>
        <th>Running +/-</th>
        <th>Status</th>
    </tr></thead><tbody>`;

    const displayUnit = isVapeNicotineSubstanceId(substanceId) ? 'puffs' : unit;
    data.rows.forEach(row => {
        const dateRange = `${formatDate(row.weekStart)} – ${formatDate(row.weekEnd)}`;
        html += `<tr class="taper-by-week-row taper-by-week-${row.status}${row.isCurrent ? ' taper-by-week-current' : ''}">
            <td>Week ${row.weekNum}</td>
            <td class="taper-by-week-dates">${dateRange}</td>
            <td>${formatTaperAmount(row.planned, displayUnit)}</td>
            <td>${formatTaperActualAmount(row.used, displayUnit)}</td>
            <td>${formatTaperWeekDiff(row.diff, displayUnit)}</td>
            <td>${formatTaperAmount(row.runningPlanned, displayUnit)}</td>
            <td>${formatTaperActualAmount(row.runningUsed, displayUnit)}</td>
            <td>${formatTaperWeekDiff(row.runningDiff, displayUnit)}</td>
            <td><span class="taper-by-week-status taper-by-week-status-${row.status}">${row.statusLabel}</span></td>
        </tr>`;
    });

    html += '</tbody></table>';
    tableEl.innerHTML = html;
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
    let items;
    if (isReduceBuyingPlan(plan)) {
        items = [
            ['Plan type', TAPER_REDUCTION_LABELS[plan.reductionType] || plan.reductionType || '—'],
            ['Current buy frequency', plan.currentBuyFrequencyDays != null ? `Every ${plan.currentBuyFrequencyDays} days` : '—'],
            ['Goal buy frequency', plan.goalBuyFrequencyDays != null ? `Every ${plan.goalBuyFrequencyDays} days` : '—'],
            ['Monthly vape cap', plan.monthlyMax != null ? formatTaperVapesPerMonth(plan.monthlyMax) : '—'],
            ['Weekly spend cap', plan.weeklySpendCap != null ? formatTaperMoney(plan.weeklySpendCap) : '—'],
            ['Status', plan.isPaused ? 'Paused' : 'Active']
        ];
    } else if (isReduceNicotinePlan(plan)) {
        items = [
            ['Plan type', TAPER_REDUCTION_LABELS[plan.reductionType] || plan.reductionType || '—'],
            ['Starting strength', formatTaperNicotineStrength(plan.startingNicotineMgPerMl)],
            ['Goal strength', formatTaperNicotineStrength(plan.goalNicotineMgPerMl)],
            ['Step-down', plan.nicotineStepDownMgPerMl != null ? `${plan.nicotineStepDownMgPerMl} mg/mL` : '—'],
            ['Interval', plan.nicotineStepDownInterval || 'weekly'],
            ['Status', plan.isPaused ? 'Paused' : 'Active']
        ];
    } else if (isReducePuffsPlan(plan)) {
        items = [
            ['Plan type', TAPER_REDUCTION_LABELS[plan.reductionType] || plan.reductionType || '—'],
            ['Start average', plan.startingDailyAverage != null ? formatTaperPuffsPerDay(plan.startingDailyAverage) : '—'],
            ['Goal average', plan.goalDailyAverage != null ? formatTaperPuffsPerDay(plan.goalDailyAverage) : '—'],
            ['Reduction', getPuffReductionMode(plan) === 'percent'
                ? `${plan.reductionPercent || 0}% per week`
                : `${plan.reductionAmount || 0} puffs/day per week`],
            ['Target end', plan.endDate ? formatDate(plan.endDate) : '—'],
            ['Status', plan.isPaused ? 'Paused' : 'Active']
        ];
    } else {
        const unit = isVapeNicotineSubstanceId(substanceId) ? 'puffs' : sub.defaultUnit;
        items = [
            ['Plan type', TAPER_REDUCTION_LABELS[plan.reductionType] || plan.reductionType || '—'],
            ['Start average', plan.startingDailyAverage != null ? `${plan.startingDailyAverage} ${unit}/day` : '—'],
            ['Goal average', plan.goalDailyAverage != null ? `${plan.goalDailyAverage} ${unit}/day` : '—'],
            ['Target end', plan.endDate ? formatDate(plan.endDate) : '—'],
            ['Weekly max', plan.weeklyMax != null ? `${plan.weeklyMax} ${unit}` : '—'],
            ['Status', plan.isPaused ? 'Paused' : 'Active']
        ];
    }
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
    setText('taper-setup-title', 'Edit Taper Plan');
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
    setText('taper-setup-title', 'Create Taper Plan');
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
}

function checkTaperTarget() {
    renderTaperProgressCard(getTaperSubstanceId());
}

function getDaysLeftInWeek(dateStr) {
    const d = parseLocalDate(dateStr);
    if (!d) return 0;
    return 6 - d.getDay();
}

function addDaysToDateStr(dateStr, days) {
    const d = parseLocalDate(dateStr);
    if (!d) return dateStr;
    d.setDate(d.getDate() + days);
    return getLocalDateString(d);
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

function getMonthStartDateStr(dateStr) {
    const d = parseLocalDate(dateStr);
    if (!d) return dateStr || '';
    return getLocalDateString(new Date(d.getFullYear(), d.getMonth(), 1));
}

function getAverageSupplyDurationDays(substanceId) {
    const stats = getSubstanceSupplyDurationStats(substanceId);
    if (stats.averageMs == null) return null;
    return stats.averageMs / 86400000;
}

function getWeekStartDateStr(dateStr) {
    const d = parseLocalDate(dateStr);
    if (!d) return dateStr;
    d.setDate(d.getDate() - d.getDay());
    return getLocalDateString(d);
}

function getWeeklyUsed(substanceId, dateStr, excludeLogId = null, data = appData) {
    return getUsedAmountForWeek(substanceId, dateStr, excludeLogId, data);
}

// ——— Settings ———
function getCurrencySymbol() {
    return '$';
}

function formatDate(dateStr) {
    return formatLocalDate(dateStr);
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
            logMode: l.logMode || 'amount',
            percentRemaining: l.percentRemaining ?? null,
            percentLeftAfter: l.percentLeftAfter ?? null,
            remainingPuffsAfter: l.remainingPuffsAfter ?? null,
            previousRemainingBeforeLog: l.previousRemainingBeforeLog ?? null,
            isEstimated: !!l.isEstimated,
            estimatedFromPercent: !!l.estimatedFromPercent,
            estimatedPuffsPerDay: l.estimatedPuffsPerDay ?? null,
            needsReview: !!l.needsReview,
            count: Number(l.count || 0),
            giftPartyName: l.giftPartyName || '',
            adjustmentDirection: l.adjustmentDirection || null,
            notes: l.notes || '',
            purchaseId: getLogPurchaseId(l),
            linkedPurchaseId: getLogPurchaseId(l),
            linkedPurchases: l.linkedPurchases || [],
            legacySupplyText: l.legacySupplyText || null,
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
            fullPuffCount: p.fullPuffCount != null ? Number(p.fullPuffCount) : null,
            percentBoughtAt: p.percentBoughtAt != null ? Number(p.percentBoughtAt) : null,
            startingPuffsLeft: p.startingPuffsLeft != null ? Number(p.startingPuffsLeft) : null,
            remainingPuffs: p.remainingPuffs != null ? Number(p.remainingPuffs) : null,
            eLiquidCapacityMl: p.eLiquidCapacityMl != null ? Number(p.eLiquidCapacityMl) : null,
            nicotineMgPerMl: p.nicotineMgPerMl != null ? Number(p.nicotineMgPerMl) : null,
            totalNicotineMg: p.totalNicotineMg != null ? Number(p.totalNicotineMg) : null,
            startedAt: p.startedAt || p.supplyStartedAt || null,
            finishedAt: p.finishedAt || null,
            inventoryStatus: p.inventoryStatus || null,
            inventoryHidden: !!p.inventoryHidden,
            archivedAt: p.archivedAt || null,
            depletedAt: p.depletedAt || null,
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
            currency: '$'
        },

        recoveryStreaks: data.recoveryStreaks || {},
        migrations: data.migrations || {}
    };
}

function exportJsonBackup() {
    const exportObject = cleanExportData(appData);
    const dataStr = JSON.stringify(exportObject, null, 2);
    const blob = new Blob([dataStr], { type: 'application/json' });
    downloadBlob(blob, `recovery-tracker-backup-${getLocalDateString()}.json`);
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
    downloadBlob(blob, `recovery-tracker-export-${getLocalDateString()}.csv`);
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
    if (imported.privacy && typeof imported.privacy === 'object') {
        merged.privacy = { ...merged.privacy, ...imported.privacy };
    }
    return merged;
}

function applyImportedBackup(imported, mode) {
    createAutoBackup(mode === 'replace' ? 'before-import-replace' : 'before-import-merge');
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
    createAutoBackup('before-clear');
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
        restoreLastAutoBackup,
        exportJsonBackup,
        setUseLogFilter,
        onUseLogSubstanceChange,
        onInventorySubstanceChange,
        startBulkLinkSessions,
        closeBulkLinkModal,
        applyBulkLinkPreview,
        editPurchase,
        duplicatePurchase,
        duplicatePurchaseNow,
        deletePurchase,
        togglePurchaseLinkedLogs,
        setInventoryTab,
        applyInventorySearchFilters,
        runInventoryBulkAction,
        setVapeLogInputMode,
        setVapeTaperCountMode,
        repairAppData,
        updateVapePurchaseSelectDetails
    });
}
