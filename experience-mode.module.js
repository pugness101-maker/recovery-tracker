// ——— App-wide Experience Mode (Simple / Advanced) ———
// Presentation layer only — reuses canonical calc engine, logs, inventory, tapers.
// Does not remove Advanced features or rewrite existing records.

const EXPERIENCE_MODE_SIMPLE = 'simple';
const EXPERIENCE_MODE_ADVANCED = 'advanced';
const EXPERIENCE_PROGRESS_RANGES = Object.freeze(['7', '30', '90', 'all']);

const SIMPLE_TAPER_STATUS = Object.freeze({
    within: { key: 'within', label: 'Within target', homeLabel: 'Within taper target' },
    near: { key: 'near', label: 'Near target', homeLabel: 'Near taper target' },
    above: { key: 'above', label: 'Above target', homeLabel: 'Above taper target' },
    none: { key: 'none', label: 'No active taper', homeLabel: 'No active taper' }
});

const SIMPLE_PLAN_INTENTS = Object.freeze([
    { id: 'use-less', label: 'Use less', reductionType: 'reduce-amount', hint: 'Lower daily use over time.' },
    { id: 'spend-less', label: 'Spend less', reductionType: 'reduce-buying', hint: 'Reduce how much you spend.' },
    { id: 'buy-less', label: 'Buy less often', reductionType: 'reduce-buying', hint: 'Increase days between purchases.' },
    { id: 'quit-by-date', label: 'Quit by a date', reductionType: 'reduce-amount', hint: 'Reach zero by a chosen end date.' },
    { id: 'track-only', label: 'Track only', reductionType: null, hint: 'No taper — just monitor use.' },
    { id: 'custom', label: 'Custom', reductionType: null, hint: 'Open full plan settings.' }
]);

const SIMPLE_DUPLICATE_WINDOW_MS = 90 * 1000;
const SIMPLE_RECENT_LOG_LIMIT = 3;
const SIMPLE_RECENT_AMOUNT_LIMIT = 5;

let simpleQuickLogContext = {
    substanceId: null,
    locked: false,
    lastSavedId: null
};

function getDefaultSimpleModePrefs() {
    return {
        quickLogBySubstance: {},
        recentAmountsBySubstance: {},
        progressRange: '7',
        progressSubstanceId: null,
        progressCalendarMonth: null,
        lastQuickSubstanceId: null,
        planIntent: null
    };
}

function normalizeExperienceMode(value) {
    return value === EXPERIENCE_MODE_ADVANCED ? EXPERIENCE_MODE_ADVANCED : EXPERIENCE_MODE_SIMPLE;
}

function hasMeaningfulRecoveryData(data = appData) {
    if (!data || typeof data !== 'object') return false;
    if (Array.isArray(data.logs) && data.logs.length > 0) return true;
    if (Array.isArray(data.purchases) && data.purchases.length > 0) return true;
    if (Array.isArray(data.taperPlansV2) && data.taperPlansV2.length > 0) return true;
    if (data.taperPlans && typeof data.taperPlans === 'object' && Object.keys(data.taperPlans).length > 0) {
        return true;
    }
    return false;
}

function migrateExperienceModeV1(data = appData) {
    if (!data || typeof data !== 'object') return;
    if (!data.migrations || typeof data.migrations !== 'object') data.migrations = {};
    if (data.migrations.experienceModeV1) return;
    if (!data.settings || typeof data.settings !== 'object') data.settings = {};

    const hasExistingWork = hasMeaningfulRecoveryData(data);

    if (data.settings.experienceMode == null) {
        // Existing users keep the full UI by default; new installs use Simple.
        data.settings.experienceMode = hasExistingWork
            ? EXPERIENCE_MODE_ADVANCED
            : EXPERIENCE_MODE_SIMPLE;
    } else {
        data.settings.experienceMode = normalizeExperienceMode(data.settings.experienceMode);
    }
    data.migrations.experienceModeV1 = true;
}

function ensureSimpleModePrefs(data = appData) {
    if (!data || typeof data !== 'object') return getDefaultSimpleModePrefs();
    if (!data.settings || typeof data.settings !== 'object') data.settings = {};
    const defaults = getDefaultSimpleModePrefs();
    if (!data.settings.simpleModePrefs || typeof data.settings.simpleModePrefs !== 'object') {
        data.settings.simpleModePrefs = { ...defaults };
    }
    const prefs = data.settings.simpleModePrefs;
    if (!prefs.quickLogBySubstance || typeof prefs.quickLogBySubstance !== 'object') {
        prefs.quickLogBySubstance = {};
    }
    if (!prefs.recentAmountsBySubstance || typeof prefs.recentAmountsBySubstance !== 'object') {
        prefs.recentAmountsBySubstance = {};
    }
    if (!EXPERIENCE_PROGRESS_RANGES.includes(String(prefs.progressRange))) {
        prefs.progressRange = '7';
    }
    return prefs;
}

function ensureExperienceMode(data = appData) {
    if (!data || typeof data !== 'object') return EXPERIENCE_MODE_SIMPLE;
    if (!data.settings || typeof data.settings !== 'object') data.settings = {};
    migrateExperienceModeV1(data);
    data.settings.experienceMode = normalizeExperienceMode(data.settings.experienceMode);
    ensureSimpleModePrefs(data);
    migrateOnboardingV1(data);
    return data.settings.experienceMode;
}

function getExperienceMode(data = appData) {
    return ensureExperienceMode(data);
}

function isSimpleExperienceMode(data = appData) {
    return getExperienceMode(data) === EXPERIENCE_MODE_SIMPLE;
}

function isAdvancedExperienceMode(data = appData) {
    return getExperienceMode(data) === EXPERIENCE_MODE_ADVANCED;
}

function persistExperienceMode(mode, data = appData) {
    ensureExperienceMode(data);
    data.settings.experienceMode = normalizeExperienceMode(mode);
    if (typeof saveData === 'function') saveData(data);
    applyExperienceMode(data);
    return data.settings.experienceMode;
}

function getSimpleModePrefs(data = appData) {
    return ensureSimpleModePrefs(data);
}

function persistSimpleModePrefs(patch = {}, data = appData) {
    const prefs = ensureSimpleModePrefs(data);
    Object.assign(prefs, patch || {});
    if (typeof saveData === 'function') saveData(data);
    return prefs;
}

function getTrackedSubstancesForSimpleHome(data = appData) {
    const active = typeof getActiveSubstances === 'function'
        ? getActiveSubstances(data)
        : (data.substances || []).filter(s => s && s.active !== false);
    const today = typeof getLocalDateString === 'function' ? getLocalDateString() : '';
    return active.filter(sub => {
        if (!sub?.id) return false;
        if (sub.isMain) return true;
        if (!today) return true;
        const used = typeof getCanonicalUsageOnDate === 'function'
            ? getCanonicalUsageOnDate(sub.id, today, data)
            : 0;
        return used > 0;
    });
}

function resolveSimpleTaperStatus(used, target) {
    if (typeof getTaperLimitStatus === 'function') {
        const engine = getTaperLimitStatus(used, target);
        if (engine.status === 'over') return SIMPLE_TAPER_STATUS.above;
        if (engine.status === 'close') return SIMPLE_TAPER_STATUS.near;
        if (engine.status === 'under') return SIMPLE_TAPER_STATUS.within;
        return SIMPLE_TAPER_STATUS.none;
    }
    if (target == null || !(target > 0)) return SIMPLE_TAPER_STATUS.none;
    if (used > target) return SIMPLE_TAPER_STATUS.above;
    if (used >= target * 0.8) return SIMPLE_TAPER_STATUS.near;
    return SIMPLE_TAPER_STATUS.within;
}

function getSimpleTaperDailyTarget(substanceId, dateStr, data = appData) {
    if (!substanceId || typeof getDailyLimitForDate !== 'function') return null;
    const target = getDailyLimitForDate(substanceId, dateStr, null);
    return target != null && Number(target) > 0 ? Number(target) : null;
}

function formatSimpleUsage(substanceId, amount, data = appData) {
    if (typeof formatRecoveryUsageAmount === 'function') {
        return formatRecoveryUsageAmount(substanceId, amount, data);
    }
    const unit = typeof getSubstanceDisplayUnit === 'function'
        ? getSubstanceDisplayUnit(substanceId, data)
        : '';
    const n = Number(amount) || 0;
    if (typeof formatAmountWithUnit === 'function') return formatAmountWithUnit(n, unit);
    return `${n}${unit ? ` ${unit}` : ''}`;
}

function getSimpleSubstanceDisplayName(subOrId, data = appData) {
    if (typeof getSubstanceDisplayName === 'function') {
        return getSubstanceDisplayName(subOrId, data);
    }
    if (subOrId && typeof subOrId === 'object') return subOrId.name || subOrId.id || '';
    return String(subOrId || '');
}

function formatSimpleLastSaved(raw) {
    const text = String(raw || 'Last Saved: —').trim();
    if (/^Last Saved:/i.test(text)) return text.replace(/^Last Saved:\s*/i, 'Last Saved: ');
    return `Last Saved: ${text}`;
}

function formatSimpleSpendPeriodLabel(bounds) {
    if (!bounds) return 'Estimated spending';
    if (bounds.key === 'all') return 'Estimated spending · All time';
    const days = Number(bounds.days) || Number(bounds.key);
    if (Number.isFinite(days) && days > 0) return `Estimated spending · ${days} days`;
    return 'Estimated spending';
}

function formatSimpleAxisDate(dateStr) {
    if (typeof formatShortMonthDay === 'function') return formatShortMonthDay(dateStr);
    return dateStr || '';
}

function getRecentAverageUsage(substanceId, days = 7, data = appData) {
    if (!substanceId || typeof getCanonicalUsageInRange !== 'function') return 0;
    const today = getLocalDateString();
    const endPrev = addDaysYYYYMMDD(today, -1);
    const startPrev = addDaysYYYYMMDD(endPrev, -(Math.max(1, days) - 1));
    const total = getCanonicalUsageInRange(substanceId, startPrev, endPrev, data);
    return total / Math.max(1, days);
}

function buildSimpleTodayCard(substance, data = appData) {
    const today = getLocalDateString();
    const substanceId = substance.id;
    const used = typeof getCanonicalUsageOnDate === 'function'
        ? getCanonicalUsageOnDate(substanceId, today, data)
        : 0;
    const target = getSimpleTaperDailyTarget(substanceId, today, data);
    const remaining = target != null ? Math.max(0, target - used) : null;
    const recentAvg = getRecentAverageUsage(substanceId, 7, data);
    let vsRecent = null;
    if (recentAvg > 0) {
        vsRecent = ((used - recentAvg) / recentAvg) * 100;
    }
    const status = resolveSimpleTaperStatus(used, target);
    const unit = typeof getSubstanceDisplayUnit === 'function'
        ? getSubstanceDisplayUnit(substanceId, data)
        : (substance.defaultUnit || '');
    return {
        substanceId,
        name: getSimpleSubstanceDisplayName(substance, data) || substance.name || substanceId,
        unit,
        used,
        usedLabel: formatSimpleUsage(substanceId, used, data),
        target,
        targetLabel: target != null ? formatSimpleUsage(substanceId, target, data) : null,
        remaining,
        remainingLabel: remaining != null ? formatSimpleUsage(substanceId, remaining, data) : null,
        vsRecent,
        status
    };
}

function buildSimpleHomeDataset(data = appData) {
    const substances = getTrackedSubstancesForSimpleHome(data);
    const cards = substances.map(s => buildSimpleTodayCard(s, data));
    // Also include any substance with use today that wasn't in the filtered list
    const today = getLocalDateString();
    const seen = new Set(cards.map(c => c.substanceId));
    (data.substances || []).forEach(sub => {
        if (!sub?.id || seen.has(sub.id) || sub.active === false) return;
        const used = getCanonicalUsageOnDate(sub.id, today, data);
        if (used > 0) {
            cards.push(buildSimpleTodayCard(sub, data));
            seen.add(sub.id);
        }
    });
    cards.sort((a, b) => {
        if (b.used !== a.used) return b.used - a.used;
        return String(a.name).localeCompare(String(b.name));
    });
    return { today, cards };
}

function renderSimpleHome(data = appData) {
    if (typeof document === 'undefined') return;
    const root = document.getElementById('simple-home');
    if (!root) return;
    const dataset = buildSimpleHomeDataset(data);
    const cardsHtml = dataset.cards.length
        ? dataset.cards.map(card => {
            const vsRow = card.vsRecent == null
                ? ''
                : `<div class="sm-today-row">
                    <dt>vs recent</dt>
                    <dd class="${card.vsRecent <= 0 ? 'sm-vs-down' : 'sm-vs-up'}">${card.vsRecent <= 0 ? '↓' : '↑'} ${Math.abs(Math.round(card.vsRecent))}%</dd>
                   </div>`;
            const meta = card.target != null
                ? `<dl class="sm-today-meta">
                    <div class="sm-today-row"><dt>Taper target</dt><dd>≤ ${escapeHtml(card.targetLabel)}</dd></div>
                    <div class="sm-today-row"><dt>Remaining</dt><dd>${escapeHtml(card.remainingLabel)}</dd></div>
                    ${vsRow}
                   </dl>`
                : `<dl class="sm-today-meta">
                    <div class="sm-today-row"><dt>Taper</dt><dd>${escapeHtml(card.status.homeLabel || card.status.label)}</dd></div>
                    ${vsRow}
                   </dl>`;
            return `
                <article class="sm-today-card status-${escapeHtml(card.status.key)}" data-substance-id="${escapeHtml(card.substanceId)}">
                    <header class="sm-today-card-head">
                        <h3>${escapeHtml(card.name)}</h3>
                        <span class="sm-status-pill">${escapeHtml(card.status.homeLabel || card.status.label)}</span>
                    </header>
                    <p class="sm-today-amount">${escapeHtml(card.usedLabel)} <span class="sm-today-amount-label">today</span></p>
                    ${meta}
                    <button type="button" class="sm-card-quick-btn" onclick="openSimpleQuickLog('${escapeHtml(card.substanceId)}')">Quick Log</button>
                </article>`;
        }).join('')
        : `<div class="sm-empty">
            <p>Nothing logged yet</p>
            <p class="settings-hint">Start with your first entry.</p>
            <button type="button" class="sm-action-btn sm-action-primary" onclick="openSimpleQuickLog()">Quick Log</button>
           </div>`;

    const lastSaved = formatSimpleLastSaved(
        document.getElementById('dashboard-last-saved')?.textContent
        || document.getElementById('settings-last-saved')?.textContent
        || 'Last Saved: —'
    );

    root.innerHTML = `
        <div class="sm-home-header">
            <div>
                <h2 class="sm-home-title">Today</h2>
                <p class="sm-home-sub">How am I doing today?</p>
            </div>
            <p class="last-saved-status sm-last-saved">${escapeHtml(lastSaved)}</p>
        </div>
        <div class="sm-primary-actions" role="group" aria-label="Primary actions">
            <button type="button" class="sm-action-btn sm-action-primary" onclick="openSimpleQuickLog()">Quick Log</button>
            ${renderSimpleRepeatLastButton(data)}
            <button type="button" class="sm-action-btn sm-action-secondary" onclick="openSimpleLogDetails()">Log Details</button>
            <button type="button" class="sm-action-btn sm-action-secondary" onclick="openSimpleProgress()">View Progress</button>
        </div>
        <div class="sm-today-grid" id="sm-today-grid">${cardsHtml}</div>
        ${renderSimpleRecentlyLoggedHtml(data)}
        <div class="sm-home-footer">
            <button type="button" class="sm-text-btn" onclick="showAdvancedHomeDashboard()">Show full dashboard</button>
        </div>`;
}

function showAdvancedHomeDashboard() {
    if (typeof document === 'undefined') return;
    document.getElementById('dashboard-tab')?.classList.add('sm-show-advanced-home');
    if (typeof updateDashboard === 'function') updateDashboard();
}

function hideAdvancedHomeDashboard() {
    if (typeof document === 'undefined') return;
    document.getElementById('dashboard-tab')?.classList.remove('sm-show-advanced-home');
}

function openSimpleLogDetails() {
    hideAdvancedHomeDashboard();
    if (typeof switchTab === 'function') switchTab('use-log-tab');
}

function openSimpleProgress() {
    hideAdvancedHomeDashboard();
    if (typeof switchTab === 'function') switchTab('insights-calendar-tab');
    renderSimpleProgress();
}

function rememberQuickLogSettings(patch, data = appData) {
    const substanceId = patch?.substanceId;
    if (!substanceId) return null;
    const prefs = ensureSimpleModePrefs(data);
    const prev = prefs.quickLogBySubstance[substanceId] && typeof prefs.quickLogBySubstance[substanceId] === 'object'
        ? prefs.quickLogBySubstance[substanceId]
        : {};
    const amount = Number.isFinite(Number(patch.amount)) ? Number(patch.amount) : (prev.amount ?? null);
    const next = {
        substanceId,
        productType: patch.productType !== undefined ? (patch.productType || null) : (prev.productType || null),
        amount: amount != null && Number.isFinite(amount) ? amount : null,
        unit: patch.unit !== undefined ? (patch.unit || '') : (prev.unit || ''),
        purchaseId: patch.purchaseId !== undefined ? (patch.purchaseId || null) : (prev.purchaseId || null),
        transactionType: patch.transactionType || prev.transactionType || 'use',
        logMode: patch.logMode !== undefined ? (patch.logMode || null) : (prev.logMode || null),
        vapeMode: patch.vapeMode !== undefined ? (patch.vapeMode || null) : (prev.vapeMode || null),
        updatedAt: new Date().toISOString()
    };
    prefs.quickLogBySubstance[substanceId] = next;
    prefs.lastQuickSubstanceId = substanceId;
    if (next.amount != null && next.amount > 0) {
        rememberRecentAmount(substanceId, next.amount, data);
    } else if (typeof saveData === 'function') {
        saveData(data);
    }
    return next;
}

function getQuickLogMemoryForSubstance(substanceId, data = appData) {
    if (!substanceId) return null;
    const prefs = ensureSimpleModePrefs(data);
    const mem = prefs.quickLogBySubstance?.[substanceId];
    return mem && typeof mem === 'object' ? mem : null;
}

function rememberQuickLogFromForm(data = appData) {
    if (typeof document === 'undefined') return null;
    const substanceId = document.getElementById('use-substance')?.value
        || document.getElementById('use-log-substance')?.value;
    if (!substanceId) return null;
    const amountRaw = document.getElementById('use-amount')?.value
        || document.getElementById('use-vape-puffs-used')?.value
        || document.getElementById('use-cigarettes-smoked')?.value
        || document.getElementById('use-lsd-tabs-used')?.value
        || document.getElementById('use-xanax-pills-used')?.value;
    const amount = parseFloat(amountRaw);
    const unit = document.getElementById('use-unit')?.value || '';
    const productType = document.getElementById('use-nicotine-product-type')?.value
        || document.getElementById('use-weed-product-type')?.value
        || null;
    const purchaseId = document.getElementById('use-purchase-select')?.value
        || document.getElementById('use-vape-purchase-select')?.value
        || null;
    const transactionType = document.getElementById('use-transaction-type')?.value || 'use';
    const vapeMode = document.getElementById('use-vape-log-mode')?.value || null;
    const logMode = document.getElementById('use-lsd-log-mode')?.value
        || document.getElementById('use-xanax-log-mode')?.value
        || document.getElementById('use-weed-cart-log-mode')?.value
        || vapeMode
        || null;
    return rememberQuickLogSettings({
        substanceId,
        productType,
        amount: Number.isFinite(amount) ? amount : null,
        unit,
        purchaseId: purchaseId || null,
        transactionType,
        logMode,
        vapeMode
    }, data);
}

function rememberQuickLogFromEntry(entry, data = appData) {
    if (!entry) return null;
    const substanceId = typeof getUseSubstanceId === 'function'
        ? getUseSubstanceId(entry)
        : (entry.substanceId || entry.substance);
    if (!substanceId) return null;
    const productType = entry.nicotineProductType || entry.weedProductType || null;
    const purchaseId = typeof getLogPurchaseId === 'function'
        ? getLogPurchaseId(entry)
        : (entry.purchaseId || entry.inventoryId || null);
    return rememberQuickLogSettings({
        substanceId,
        productType,
        amount: Number(entry.amount),
        unit: entry.unit || '',
        purchaseId: purchaseId || null,
        transactionType: (typeof getLogTransactionType === 'function'
            ? getLogTransactionType(entry)
            : entry.transactionType) || 'use',
        logMode: entry.logMode || null,
        vapeMode: entry.logMode === 'vape_puffs' ? 'puffs'
            : (entry.logMode === 'percent_remaining' ? 'percent' : null)
    }, data);
}

function rememberRecentAmount(substanceId, amount, data = appData) {
    if (!substanceId || !(amount > 0)) return;
    const prefs = ensureSimpleModePrefs(data);
    const key = String(substanceId);
    const list = Array.isArray(prefs.recentAmountsBySubstance[key])
        ? prefs.recentAmountsBySubstance[key].slice()
        : [];
    const rounded = Math.round(amount * 1000) / 1000;
    const next = [rounded, ...list.filter(v => Math.abs(v - rounded) > 1e-9)]
        .slice(0, SIMPLE_RECENT_AMOUNT_LIMIT);
    prefs.recentAmountsBySubstance[key] = next;
    if (typeof saveData === 'function') saveData(data);
}

function getRecentAmountsForSubstance(substanceId, data = appData) {
    const prefs = ensureSimpleModePrefs(data);
    const remembered = prefs.recentAmountsBySubstance?.[substanceId];
    if (Array.isArray(remembered) && remembered.length) {
        return remembered.filter(n => Number.isFinite(n) && n > 0).slice(0, SIMPLE_RECENT_AMOUNT_LIMIT);
    }
    const logs = (data.logs || [])
        .filter(l => l && String(l.substanceId || l.substance) === String(substanceId) && Number(l.amount) > 0)
        .sort((a, b) => {
            const msA = typeof getLogDatetimeMs === 'function' ? getLogDatetimeMs(a) : 0;
            const msB = typeof getLogDatetimeMs === 'function' ? getLogDatetimeMs(b) : 0;
            return msB - msA;
        })
        .slice(0, 40);
    const seen = [];
    logs.forEach(log => {
        const amt = Math.round(Number(log.amount) * 1000) / 1000;
        if (!(amt > 0)) return;
        if (!seen.some(v => Math.abs(v - amt) < 1e-9)) seen.push(amt);
    });
    if (seen.length) return seen.slice(0, SIMPLE_RECENT_AMOUNT_LIMIT);

    if (typeof isNicotineTrackingMode === 'function' && isNicotineTrackingMode(substanceId, data)) {
        return [100, 250, 500];
    }
    if (typeof isPowderTrackingMode === 'function' && isPowderTrackingMode(substanceId, data)) {
        return [0.1, 0.25, 0.5];
    }
    return [1, 2, 5];
}

function getCompatibleSimpleInventoryItems(substanceId, productType, data = appData) {
    if (!substanceId || typeof getActiveInventoryItems !== 'function') return [];
    let items = getActiveInventoryItems(substanceId, data) || [];
    if (productType && typeof isNicotineTrackingMode === 'function' && isNicotineTrackingMode(substanceId, data)) {
        items = items.filter(p => {
            const pt = typeof getNicotineProductType === 'function'
                ? getNicotineProductType(p, data)
                : (p.nicotineProductType || null);
            return !pt || pt === productType;
        });
    }
    if (productType && typeof isWeedTrackingMode === 'function' && isWeedTrackingMode(substanceId, data)) {
        items = items.filter(p => (p.weedProductType || 'bud') === productType);
    }
    return items;
}

function resolveSimpleInventoryPrefill(substanceId, data = appData, options = {}) {
    if (!substanceId) return null;
    const mem = options.memory || getQuickLogMemoryForSubstance(substanceId, data);
    const productType = options.productType || mem?.productType || null;
    const items = getCompatibleSimpleInventoryItems(substanceId, productType, data);
    const rememberedId = options.purchaseId !== undefined ? options.purchaseId : (mem?.purchaseId || null);
    if (rememberedId != null && rememberedId !== '') {
        const still = items.find(p => String(p.id) === String(rememberedId));
        if (still) return still.id;
    }
    if (items.length === 1) return items[0].id;
    return null;
}

function applySimpleInventoryPrefill(substanceId, data = appData, mem = null) {
    if (typeof setUsePurchaseLinkMode !== 'function') return null;
    const prefillId = resolveSimpleInventoryPrefill(substanceId, data, { memory: mem });
    if (prefillId) {
        setUsePurchaseLinkMode('manual');
        const sel = document.getElementById('use-purchase-select');
        if (sel) sel.value = String(prefillId);
        const vapeSel = document.getElementById('use-vape-purchase-select');
        if (vapeSel) vapeSel.value = String(prefillId);
        if (typeof updateUsePurchaseLinkUI === 'function') {
            try { updateUsePurchaseLinkUI(); } catch (_) { /* ignore */ }
        }
        if (typeof updateVapePurchaseSelectDetails === 'function') {
            try { updateVapePurchaseSelectDetails(); } catch (_) { /* ignore */ }
        }
        return prefillId;
    }
    if (isSimpleExperienceMode(data)) setUsePurchaseLinkMode('none');
    return null;
}

function applySimpleLogModeMemory(mem) {
    if (!mem) return;
    if (mem.vapeMode && typeof setVapeLogInputMode === 'function') {
        try { setVapeLogInputMode(mem.vapeMode); } catch (_) { /* ignore */ }
    } else if (mem.logMode === 'vape_puffs' && typeof setVapeLogInputMode === 'function') {
        try { setVapeLogInputMode('puffs'); } catch (_) { /* ignore */ }
    } else if (mem.logMode === 'percent_remaining' && typeof setVapeLogInputMode === 'function') {
        try { setVapeLogInputMode('percent'); } catch (_) { /* ignore */ }
    }
    if (typeof setLsdLogInputMode === 'function' && (mem.logMode === 'tabs' || mem.logMode === 'ug')) {
        try { setLsdLogInputMode(mem.logMode); } catch (_) { /* ignore */ }
    }
    if (typeof setXanaxLogInputMode === 'function' && (mem.logMode === 'pills' || mem.logMode === 'mg')) {
        try { setXanaxLogInputMode(mem.logMode); } catch (_) { /* ignore */ }
    }
}

function applySimpleAmountToVisibleFields(amount, mem = null) {
    const n = Number(amount);
    if (!Number.isFinite(n) || n < 0) return;
    const amountEl = document.getElementById('use-amount');
    if (amountEl) amountEl.value = String(n);
    const fillIfVisible = (id, after) => {
        const el = document.getElementById(id);
        if (!el) return;
        const hidden = el.closest?.('.hidden');
        if (!hidden) {
            el.value = String(n);
            if (typeof after === 'function') after();
        }
    };
    fillIfVisible('use-vape-puffs-used', () => {
        if (typeof setVapeLogInputMode === 'function' && (mem?.vapeMode === 'puffs' || mem?.productType === 'vape')) {
            try { setVapeLogInputMode('puffs'); } catch (_) { /* ignore */ }
        }
        if (typeof updateVapeUsePreview === 'function') {
            try { updateVapeUsePreview(); } catch (_) { /* ignore */ }
        }
    });
    fillIfVisible('use-cigarettes-smoked');
    fillIfVisible('use-pouches-used');
    fillIfVisible('use-gum-pieces-used');
    fillIfVisible('use-patches-used');
    fillIfVisible('use-lsd-tabs-used');
    fillIfVisible('use-lsd-ug-used');
    fillIfVisible('use-xanax-pills-used');
    fillIfVisible('use-xanax-mg-used');
}

function updateSimpleLockedSubstanceChip(substanceId, data = appData) {
    if (typeof document === 'undefined') return;
    const chip = document.getElementById('sm-locked-substance-chip');
    const nameEl = document.getElementById('sm-locked-substance-name');
    const locked = !!(simpleQuickLogContext.locked && substanceId);
    if (nameEl && substanceId) {
        nameEl.textContent = getSimpleSubstanceDisplayName(substanceId, data);
    }
    chip?.classList.toggle('hidden', !locked);
}

function getSimpleQuickLogContext() {
    return { ...simpleQuickLogContext };
}

function unlockSimpleQuickLogSubstance() {
    simpleQuickLogContext.locked = false;
    applySimpleLogFormLayout(appData);
    document.getElementById('use-substance')?.focus?.();
}

function applyQuickLogMemoryToForm(substanceId, data = appData) {
    if (!substanceId) return;
    simpleQuickLogContext.substanceId = substanceId;
    if (typeof document === 'undefined') return;
    const mem = getQuickLogMemoryForSubstance(substanceId, data);
    const substanceEl = document.getElementById('use-substance');
    const pageSubstanceEl = document.getElementById('use-log-substance');
    if (substanceEl) substanceEl.value = substanceId;
    if (pageSubstanceEl) pageSubstanceEl.value = substanceId;
    if (typeof onUseLogSubstanceChange === 'function') {
        try { onUseLogSubstanceChange(); } catch (_) { /* ignore */ }
    } else if (typeof syncUseLogFormFromSelectedSubstance === 'function') {
        try { syncUseLogFormFromSelectedSubstance(); } catch (_) { /* ignore */ }
    }

    if (mem?.productType) {
        const nic = document.getElementById('use-nicotine-product-type');
        const weed = document.getElementById('use-weed-product-type');
        if (nic && [...nic.options].some(o => o.value === mem.productType)) {
            nic.value = mem.productType;
            if (typeof onNicotineUseProductTypeChange === 'function') onNicotineUseProductTypeChange();
        }
        if (weed && [...weed.options].some(o => o.value === mem.productType)) {
            weed.value = mem.productType;
            if (typeof onWeedUseProductTypeChange === 'function') onWeedUseProductTypeChange();
        }
    }

    applySimpleLogModeMemory(mem);

    if (mem?.unit) {
        const unitEl = document.getElementById('use-unit');
        if (unitEl && [...unitEl.options].some(o => o.value === mem.unit)) {
            unitEl.value = mem.unit;
        }
    }

    if (mem?.amount != null && Number.isFinite(Number(mem.amount))) {
        applySimpleAmountToVisibleFields(mem.amount, mem);
    }

    if (mem?.transactionType && typeof setUseTransactionType === 'function') {
        try { setUseTransactionType(mem.transactionType); } catch (_) { /* ignore */ }
    }

    applySimpleInventoryPrefill(substanceId, data, mem);
    updateSimpleLockedSubstanceChip(substanceId, data);
    renderSimpleRecentAmountChips(substanceId, data);
}

function renderSimpleRecentAmountChips(substanceId, data = appData) {
    if (typeof document === 'undefined') return;
    const host = document.getElementById('sm-recent-amounts');
    if (!host) return;
    if (!substanceId) {
        host.innerHTML = '';
        host.classList.add('hidden');
        return;
    }
    const amounts = getRecentAmountsForSubstance(substanceId, data);
    const mem = getQuickLogMemoryForSubstance(substanceId, data);
    const unit = mem?.unit
        || (typeof getSubstanceDisplayUnit === 'function' ? getSubstanceDisplayUnit(substanceId, data) : '');
    host.classList.remove('hidden');
    host.innerHTML = `
        <span class="sm-recent-label">Recent</span>
        <div class="sm-recent-chips" role="group" aria-label="Recent amounts">
            ${amounts.map(amt => {
                const label = unit ? `${amt} ${unit}` : String(amt);
                return `<button type="button" class="sm-amount-chip" onclick="applySimpleQuickAmount(${amt})">${escapeHtml(label)}</button>`;
            }).join('')}
        </div>`;
}

function applySimpleQuickAmount(amount) {
    applySimpleAmountToVisibleFields(amount, getQuickLogMemoryForSubstance(
        simpleQuickLogContext.substanceId
        || document.getElementById('use-substance')?.value
    ));
}

function openSimpleQuickLog(substanceId) {
    const prefs = ensureSimpleModePrefs(appData);
    const fromContext = substanceId != null && substanceId !== '';
    const sid = substanceId
        || prefs.lastQuickSubstanceId
        || prefs.progressSubstanceId
        || (typeof resolveDefaultSelectedSubstanceId === 'function' ? resolveDefaultSelectedSubstanceId() : null)
        || getActiveSubstances?.(appData)?.[0]?.id;

    simpleQuickLogContext.substanceId = sid || null;
    simpleQuickLogContext.locked = !!(fromContext && sid);

    if (typeof switchTab === 'function') switchTab('use-log-tab');
    if (typeof selectUseEntryType === 'function') selectUseEntryType('quick');
    if (typeof setUseTransactionType === 'function') setUseTransactionType('use');
    if (typeof setDefaultUseLogDateTime === 'function') setDefaultUseLogDateTime();

    if (sid) applyQuickLogMemoryToForm(sid, appData);
    applySimpleLogFormLayout(appData);

    setTimeout(() => {
        const amount = document.getElementById('use-amount');
        const puffs = document.getElementById('use-vape-puffs-used');
        const cigs = document.getElementById('use-cigarettes-smoked');
        const target = (puffs && !puffs.closest?.('.hidden'))
            ? puffs
            : ((cigs && !cigs.closest?.('.hidden')) ? cigs : amount);
        target?.focus?.();
        target?.scrollIntoView?.({ block: 'center', behavior: 'smooth' });
    }, 60);

    const formSection = document.querySelector('#use-log-tab [data-section="useLogForm"]');
    if (formSection?.classList.contains('collapsed') && typeof toggleSection === 'function') {
        try { toggleSection('useLogForm'); } catch (_) { /* ignore */ }
    }
    return getSimpleQuickLogContext();
}

function applySimpleLogFormLayout(data = appData) {
    if (typeof document === 'undefined') return;
    const page = document.getElementById('use-log-tab');
    if (!page) return;
    const simple = isSimpleExperienceMode(data);
    const substanceId = simpleQuickLogContext.substanceId
        || document.getElementById('use-substance')?.value
        || document.getElementById('use-log-substance')?.value;
    const locked = simple && simpleQuickLogContext.locked && !!substanceId;
    page.classList.toggle('sm-log-simple', simple);
    page.classList.toggle('sm-substance-locked', locked);

    const summary = document.querySelector('#use-advanced-section .use-log-advanced-summary');
    if (summary) summary.textContent = simple ? 'More Options' : 'Advanced options';

    const slot = document.getElementById('sm-more-options-slot');
    const form = document.getElementById('use-log-form');
    if (slot && form) {
        const moreFields = [...form.querySelectorAll('.sm-log-more-field')];
        if (simple) {
            moreFields.forEach(el => {
                if (el.parentElement !== slot) slot.appendChild(el);
            });
        } else {
            const core = form.querySelector('.use-log-core-card');
            moreFields.forEach(el => {
                if (el.parentElement === slot && core) {
                    form.insertBefore(el, core);
                }
            });
        }
    }

    if (simple && typeof editingUseId !== 'undefined' && !editingUseId) {
        if (typeof setUseFormSubmitLabel === 'function') setUseFormSubmitLabel('Save');
        if (typeof setUsePurchaseLinkMode === 'function') {
            const mode = typeof getUsePurchaseLinkMode === 'function' ? getUsePurchaseLinkMode() : null;
            if (mode === 'auto') setUsePurchaseLinkMode('none');
        }
    } else if (!simple && typeof editingUseId !== 'undefined' && !editingUseId
        && typeof setUseFormSubmitLabel === 'function') {
        setUseFormSubmitLabel('Save Entry');
    }

    updateSimpleLockedSubstanceChip(substanceId, data);
    if (simple && substanceId) renderSimpleRecentAmountChips(substanceId, data);
    else {
        const host = document.getElementById('sm-recent-amounts');
        if (host) {
            host.innerHTML = '';
            host.classList.add('hidden');
        }
        document.getElementById('sm-locked-substance-chip')?.classList.add('hidden');
    }
}

function formatSimpleLogAmount(log) {
    if (!log) return '';
    const amt = Number(log.amount);
    const formatted = typeof formatAmount === 'function'
        ? formatAmount(amt)
        : (Number.isFinite(amt) ? String(amt) : '');
    const unit = log.unit || '';
    return unit ? `${formatted} ${unit}` : formatted;
}

function getSimpleInventoryShortName(purchase) {
    if (!purchase) return '';
    if (typeof formatVapePurchaseTitleLine === 'function') {
        const isVape = purchase.nicotineProductType === 'vape'
            || purchase.logMode === 'vape_puffs'
            || Number(purchase.fullPuffCount) > 0
            || (purchase.unit || '').toLowerCase() === 'puffs';
        if (isVape) {
            const title = formatVapePurchaseTitleLine(purchase);
            if (title && title !== 'Vape') return title;
        }
    }
    return purchase.productName || purchase.name || purchase.flavor || purchase.store || '';
}

function isSimpleRecentLogEligible(log) {
    if (!log || log.deletedAt || log.deleted || log.hidden) return false;
    if (typeof isPercentLeftDistributedChildLog === 'function' && isPercentLeftDistributedChildLog(log)) return false;
    if (typeof isAlcoholMultiDayChildLog === 'function' && isAlcoholMultiDayChildLog(log)) return false;
    return true;
}

function getLastSimpleUseLog(data = appData) {
    return (data.logs || [])
        .filter(isSimpleRecentLogEligible)
        .slice()
        .sort((a, b) => {
            const msA = typeof getLogDatetimeMs === 'function' ? getLogDatetimeMs(a) : Date.parse(a.timestamp || 0);
            const msB = typeof getLogDatetimeMs === 'function' ? getLogDatetimeMs(b) : Date.parse(b.timestamp || 0);
            return (msB || 0) - (msA || 0);
        })[0] || null;
}

function formatSimpleRepeatLastLabel(log, data = appData) {
    if (!log) return 'Repeat Last';
    const amount = formatSimpleLogAmount(log);
    const name = getSimpleSubstanceDisplayName(
        typeof getUseSubstanceId === 'function' ? getUseSubstanceId(log) : (log.substanceId || log.substance),
        data
    );
    const pid = typeof getLogPurchaseId === 'function' ? getLogPurchaseId(log) : (log.purchaseId || null);
    const purchase = pid && typeof findPurchaseInData === 'function'
        ? findPurchaseInData(pid, data)
        : (data.purchases || []).find(p => String(p.id) === String(pid));
    const invName = getSimpleInventoryShortName(purchase);
    if (invName) return `Repeat: ${amount} · ${invName}`;
    return `Repeat: ${amount} ${name}`.replace(/\s+/g, ' ').trim();
}

function formatSimpleRecentLogTime(log) {
    const ms = typeof getLogDatetimeMs === 'function'
        ? getLogDatetimeMs(log)
        : Date.parse(log?.timestamp || '');
    if (!Number.isFinite(ms) || ms <= 0) return '';
    try {
        return new Date(ms).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
    } catch (_) {
        return '';
    }
}

function buildSimpleRecentLogs(data = appData, limit = SIMPLE_RECENT_LOG_LIMIT) {
    return (data.logs || [])
        .filter(isSimpleRecentLogEligible)
        .slice()
        .sort((a, b) => {
            const msA = typeof getLogDatetimeMs === 'function' ? getLogDatetimeMs(a) : 0;
            const msB = typeof getLogDatetimeMs === 'function' ? getLogDatetimeMs(b) : 0;
            return msB - msA;
        })
        .slice(0, limit)
        .map(log => {
            const sid = typeof getUseSubstanceId === 'function'
                ? getUseSubstanceId(log)
                : (log.substanceId || log.substance);
            return {
                id: log.id,
                substanceId: sid,
                substanceName: getSimpleSubstanceDisplayName(sid, data),
                amountLabel: formatSimpleLogAmount(log),
                timeLabel: formatSimpleRecentLogTime(log),
                log
            };
        });
}

function renderSimpleRepeatLastButton(data = appData) {
    const last = getLastSimpleUseLog(data);
    if (!last) return '';
    const label = formatSimpleRepeatLastLabel(last, data);
    return `<button type="button" class="sm-action-btn sm-action-repeat" onclick="repeatSimpleLastEntry()">${escapeHtml(label)}</button>`;
}

function renderSimpleRecentlyLoggedHtml(data = appData) {
    const rows = buildSimpleRecentLogs(data);
    if (!rows.length) return '';
    return `
        <section class="sm-recently-logged" aria-label="Recently logged">
            <h3 class="sm-recently-logged-title">Recently Logged</h3>
            <ul class="sm-recently-logged-list">
                ${rows.map(row => `
                    <li class="sm-recent-log-row">
                        <span class="sm-recent-log-main">${escapeHtml(row.timeLabel)} · ${escapeHtml(row.substanceName)} · ${escapeHtml(row.amountLabel)}</span>
                        <span class="sm-recent-log-actions">
                            <button type="button" class="sm-text-btn" onclick="editSimpleRecentLog(${JSON.stringify(String(row.id))})">Edit</button>
                            <button type="button" class="sm-text-btn" onclick="undoSimpleLoggedEntry(${JSON.stringify(String(row.id))}, { confirmDelete: true })">Undo</button>
                        </span>
                    </li>`).join('')}
            </ul>
        </section>`;
}

function editSimpleRecentLog(id) {
    if (typeof editUseEntry === 'function') editUseEntry(id);
}

function cloneSimpleRepeatLog(source, now = new Date()) {
    const clone = JSON.parse(JSON.stringify(source || {}));
    const dateStr = typeof getLocalDateString === 'function'
        ? getLocalDateString(now)
        : now.toISOString().slice(0, 10);
    const timeStr = typeof getLocalTimeString === 'function'
        ? getLocalTimeString(now)
        : `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
    clone.id = typeof generateUniqueId === 'function'
        ? generateUniqueId('use')
        : `use-${now.getTime()}-${Math.random().toString(36).slice(2, 9)}`;
    clone.date = dateStr;
    clone.startTime = timeStr;
    clone.time = timeStr;
    clone.createdAt = now.toISOString();
    clone.updatedAt = now.toISOString();
    clone.timestamp = typeof getUseEventTimestamp === 'function'
        ? getUseEventTimestamp(dateStr, timeStr)
        : now.toISOString();
    delete clone.startedAt;
    delete clone.endedAt;
    delete clone.durationMs;
    delete clone.endTime;
    delete clone.endDate;
    delete clone.breakMinutes;
    delete clone.breakHours;
    delete clone.breakText;
    delete clone.parentLogId;
    delete clone.isDistributedChild;
    delete clone.isMultiDay;
    delete clone.dailyBreakdown;
    delete clone.parentPercentLogId;
    return clone;
}

function buildSimpleRepeatPreview(source, now = new Date(), data = appData) {
    const next = cloneSimpleRepeatLog(source, now);
    return {
        previousId: source?.id ?? null,
        previousTimestamp: source?.timestamp || source?.createdAt || null,
        nextId: next.id,
        nextTimestamp: next.timestamp,
        summary: formatSimpleRepeatLastLabel(source, data).replace(/^Repeat:\s*/, ''),
        amountLabel: formatSimpleLogAmount(source),
        timeLabel: formatSimpleRecentLogTime({ ...next, timestamp: next.timestamp, date: next.date, startTime: next.startTime })
    };
}

function repeatSimpleLastEntry(options = {}) {
    const data = options.data || appData;
    const now = options.now instanceof Date ? options.now : new Date();
    const last = getLastSimpleUseLog(data);
    if (!last) return { ok: false, error: 'No previous entry' };
    const preview = buildSimpleRepeatPreview(last, now, data);
    if (options.confirm !== false) {
        const ok = typeof confirm === 'function'
            ? confirm(`Repeat last entry?\n\n${preview.summary}\nTime: now\n\nSave this log?`)
            : true;
        if (!ok) return { ok: false, cancelled: true, preview };
    }
    const clone = cloneSimpleRepeatLog(last, now);
    if (clone.id === last.id) {
        clone.id = `use-${now.getTime()}-${Math.random().toString(36).slice(2, 9)}`;
    }
    const persist = options.persist !== false && data === appData;
    const result = typeof commitUseLogEntry === 'function'
        ? commitUseLogEntry(clone, { data, persist, applyInventory: clone.inventoryAffects !== false })
        : { ok: true, log: clone };
    if (!result.ok) return result;
    rememberQuickLogFromEntry(result.log || clone, data);
    simpleQuickLogContext.lastSavedId = (result.log || clone).id;
    if (data === appData) {
        if (typeof refreshUseLogRelatedViews === 'function') {
            try { refreshUseLogRelatedViews(); } catch (_) { /* ignore */ }
        } else {
            renderSimpleHome(data);
        }
        notifySimpleQuickLogSaved(result.log || clone);
        if (typeof switchTab === 'function') {
            try { switchTab('dashboard-tab'); } catch (_) { /* ignore */ }
        }
    }
    return { ok: true, log: result.log || clone, preview, previousId: last.id };
}

function logsLookLikeSimpleDuplicate(a, b) {
    if (!a || !b) return false;
    const sidA = String(a.substanceId || a.substance || '');
    const sidB = String(b.substanceId || b.substance || '');
    if (!sidA || sidA !== sidB) return false;
    if (Math.abs(Number(a.amount || 0) - Number(b.amount || 0)) > 1e-9) return false;
    if (String(a.unit || '') !== String(b.unit || '')) return false;
    const txA = typeof getLogTransactionType === 'function' ? getLogTransactionType(a) : (a.transactionType || 'use');
    const txB = typeof getLogTransactionType === 'function' ? getLogTransactionType(b) : (b.transactionType || 'use');
    if (String(txA || 'use') !== String(txB || 'use')) return false;
    const ptA = a.nicotineProductType || a.weedProductType || '';
    const ptB = b.nicotineProductType || b.weedProductType || '';
    if (String(ptA) !== String(ptB)) return false;
    return true;
}

function findSimpleQuickLogDuplicate(candidate, data = appData, nowMs = Date.now()) {
    if (!candidate) return null;
    return (data.logs || []).find(log => {
        if (!isSimpleRecentLogEligible(log)) return false;
        if (!logsLookLikeSimpleDuplicate(log, candidate)) return false;
        const ms = typeof getLogDatetimeMs === 'function'
            ? getLogDatetimeMs(log)
            : Date.parse(log.timestamp || log.createdAt || '');
        return Number.isFinite(ms) && Math.abs(nowMs - ms) <= SIMPLE_DUPLICATE_WINDOW_MS;
    }) || null;
}

function confirmSimpleQuickLogDuplicate(payload, data = appData) {
    if (typeof isSimpleExperienceMode === 'function' && !isSimpleExperienceMode(data)) return true;
    const dup = findSimpleQuickLogDuplicate(payload, data, Date.now());
    if (!dup) return true;
    if (typeof confirm !== 'function') return true;
    return confirm('Possible duplicate\n\nAn identical entry was just logged.\n\nKeep both?');
}

let simpleToastTimer = null;
let lastSimpleToast = null;

function getLastSimpleToast() {
    return lastSimpleToast;
}

function hideSimpleToast() {
    if (simpleToastTimer) {
        clearTimeout(simpleToastTimer);
        simpleToastTimer = null;
    }
    lastSimpleToast = null;
    const host = typeof document !== 'undefined' ? document.getElementById('sm-toast') : null;
    if (!host) return;
    host.classList.add('hidden');
    host.innerHTML = '';
}

function showSimpleToast(message, options = {}) {
    lastSimpleToast = { message, actionLabel: options.actionLabel || null };
    if (typeof document === 'undefined') return lastSimpleToast;
    let host = document.getElementById('sm-toast');
    if (!host && document.body) {
        host = document.createElement('div');
        host.id = 'sm-toast';
        host.className = 'sm-toast';
        host.setAttribute('role', 'status');
        host.setAttribute('aria-live', 'polite');
        document.body.appendChild(host);
    }
    if (!host) return lastSimpleToast;
    const action = options.actionLabel
        ? `<button type="button" class="sm-toast-action" id="sm-toast-action">${escapeHtml(options.actionLabel)}</button>`
        : '';
    host.classList.remove('hidden');
    host.innerHTML = `<span class="sm-toast-msg">${escapeHtml(message)}</span>${action}`;
    const btn = document.getElementById('sm-toast-action');
    if (btn && typeof options.onAction === 'function') {
        btn.addEventListener('click', () => {
            options.onAction();
            hideSimpleToast();
        });
    }
    if (simpleToastTimer) clearTimeout(simpleToastTimer);
    simpleToastTimer = setTimeout(() => hideSimpleToast(), options.durationMs || 6000);
    return lastSimpleToast;
}

function notifySimpleQuickLogSaved(log) {
    if (!log) return;
    simpleQuickLogContext.lastSavedId = log.id;
    const amountLabel = formatSimpleLogAmount(log) || 'entry';
    showSimpleToast(`Logged ${amountLabel}`, {
        actionLabel: 'Undo',
        onAction: () => undoSimpleLoggedEntry(log.id, { confirmDelete: false })
    });
}

function notifyUseLogSaved(log, options = {}) {
    if (isSimpleExperienceMode() && log) {
        if (!options.isUpdate) notifySimpleQuickLogSaved(log);
        else showSimpleToast(`Updated ${formatSimpleLogAmount(log) || 'entry'}`);
        if (typeof switchTab === 'function') {
            try { switchTab('dashboard-tab'); } catch (_) { renderSimpleHome(appData); }
        } else {
            renderSimpleHome(appData);
        }
        return;
    }
    const msg = options.isUpdate
        ? (typeof getUseUpdateSuccessMessage === 'function' ? getUseUpdateSuccessMessage(log) : 'Entry updated!')
        : (typeof getUseSaveSuccessMessage === 'function' ? getUseSaveSuccessMessage(log) : 'Use logged!');
    if (typeof alert === 'function') alert(msg);
}

function undoSimpleLoggedEntry(id, options = {}) {
    const data = options.data || appData;
    if (id == null || id === '') return { ok: false, error: 'Missing id' };
    const entry = (data.logs || []).find(l => l.id === id || String(l.id) === String(id));
    if (!entry) return { ok: false, error: 'Entry not found' };
    if (options.confirmDelete) {
        const ok = typeof confirm === 'function' ? confirm('Delete this entry?') : true;
        if (!ok) return { ok: false, cancelled: true };
    }
    if (typeof restoreLogInventoryEffect === 'function') {
        try { restoreLogInventoryEffect(entry, data); } catch (_) { /* ignore */ }
    }
    data.logs = (data.logs || []).filter(l => l.id !== id && String(l.id) !== String(id));
    if (typeof saveData === 'function' && data === appData) saveData(data);
    if (data === appData) {
        if (typeof refreshUseLogRelatedViews === 'function') {
            try { refreshUseLogRelatedViews(); } catch (_) { /* ignore */ }
        } else {
            renderSimpleHome(data);
        }
        hideSimpleToast();
    }
    if (simpleQuickLogContext.lastSavedId === id || String(simpleQuickLogContext.lastSavedId) === String(id)) {
        simpleQuickLogContext.lastSavedId = null;
    }
    return { ok: true, removed: entry };
}

function mergeSimpleModePrefs(currentPrefs, incomingPrefs) {
    const base = { ...getDefaultSimpleModePrefs(), ...(currentPrefs && typeof currentPrefs === 'object' ? currentPrefs : {}) };
    const inc = incomingPrefs && typeof incomingPrefs === 'object' ? incomingPrefs : {};
    return {
        ...base,
        ...inc,
        quickLogBySubstance: {
            ...(base.quickLogBySubstance || {}),
            ...(inc.quickLogBySubstance || {})
        },
        recentAmountsBySubstance: {
            ...(base.recentAmountsBySubstance || {}),
            ...(inc.recentAmountsBySubstance || {})
        }
    };
}

function getProgressRangeBounds(rangeKey, data = appData) {
    const today = getLocalDateString();
    const key = EXPERIENCE_PROGRESS_RANGES.includes(String(rangeKey)) ? String(rangeKey) : '7';
    if (key === 'all') {
        const dates = (data.logs || []).map(l => l?.date).filter(Boolean).sort();
        return {
            key,
            label: 'All Time',
            startDate: dates[0] || today,
            endDate: today,
            days: Math.max(1, dates.length ? ((parseLocalDate(today) - parseLocalDate(dates[0])) / 86400000) + 1 : 1)
        };
    }
    const days = Number(key);
    const startDate = addDaysYYYYMMDD(today, -(days - 1));
    return { key, label: `Last ${days} Days`, startDate, endDate: today, days };
}

function buildSimpleProgressDataset(substanceId, rangeKey, data = appData) {
    const bounds = getProgressRangeBounds(rangeKey, data);
    const usedToday = getCanonicalUsageOnDate(substanceId, bounds.endDate, data);
    const rangeTotal = getCanonicalUsageInRange(substanceId, bounds.startDate, bounds.endDate, data);
    const dailyAvg = rangeTotal / Math.max(1, bounds.days);

    const prevEnd = addDaysYYYYMMDD(bounds.startDate, -1);
    const prevStart = addDaysYYYYMMDD(prevEnd, -(bounds.days - 1));
    const prevTotal = getCanonicalUsageInRange(substanceId, prevStart, prevEnd, data);
    const prevAvg = prevTotal / Math.max(1, bounds.days);
    const pctChange = prevAvg > 0 ? ((dailyAvg - prevAvg) / prevAvg) * 100 : null;

    const target = getSimpleTaperDailyTarget(substanceId, bounds.endDate, data);
    const status = resolveSimpleTaperStatus(usedToday, target);
    const streak = typeof computeRecoveryStreakDays === 'function'
        ? computeRecoveryStreakDays(substanceId)
        : { days: 0 };
    // Estimated spending: reuse the canonical use-cost engine for the selected range.
    const spend = typeof getCanonicalCostInRange === 'function'
        ? getCanonicalCostInRange(substanceId, bounds.startDate, bounds.endDate, data)
        : 0;

    const series = [];
    let cursor = bounds.startDate;
    let guard = 0;
    while (cursor <= bounds.endDate && guard < 400) {
        const amt = getCanonicalUsageOnDate(substanceId, cursor, data);
        const dayTarget = getSimpleTaperDailyTarget(substanceId, cursor, data);
        series.push({
            date: cursor,
            amount: amt,
            target: dayTarget,
            status: resolveSimpleTaperStatus(amt, dayTarget)
        });
        cursor = addDaysYYYYMMDD(cursor, 1);
        guard += 1;
    }

    return {
        substanceId,
        bounds,
        usedToday,
        dailyAvg,
        prevAvg,
        pctChange,
        target,
        status,
        streakDays: streak?.days ?? 0,
        spend,
        spendPeriodLabel: formatSimpleSpendPeriodLabel(bounds),
        displayName: getSimpleSubstanceDisplayName(substanceId, data),
        series,
        unit: typeof getSubstanceDisplayUnit === 'function'
            ? getSubstanceDisplayUnit(substanceId, data)
            : ''
    };
}

function renderSimpleProgressChart(series) {
    if (!series?.length) return '<p class="settings-hint">No use in this range.</p>';
    const max = Math.max(...series.map(s => s.amount), 0.0001);
    const bars = series.map(s => {
        const h = Math.max(4, Math.round((s.amount / max) * 100));
        return `<div class="sm-chart-bar-wrap" title="${escapeHtml(s.date)}: ${escapeHtml(String(s.amount))}">
            <div class="sm-chart-bar status-${escapeHtml(s.status.key)}" style="height:${h}%"></div>
        </div>`;
    }).join('');
    const startLabel = formatSimpleAxisDate(series[0].date);
    const endLabel = formatSimpleAxisDate(series[series.length - 1].date);
    return `<div class="sm-trend-card">
        <div class="sm-trend-chart" role="img" aria-label="Use trend">
            ${bars}
        </div>
        <div class="sm-trend-axis">
            <span>${escapeHtml(startLabel)}</span>
            <span>${escapeHtml(endLabel)}</span>
        </div>
    </div>`;
}

function renderSimpleProgressCalendar(dataset, monthStr) {
    const today = getLocalDateString();
    const base = monthStr && /^\d{4}-\d{2}/.test(monthStr)
        ? `${monthStr.slice(0, 7)}-01`
        : `${today.slice(0, 7)}-01`;
    const monthStart = parseLocalDate(base);
    if (!monthStart) return '';
    const year = monthStart.getFullYear();
    const month = monthStart.getMonth();
    const firstDow = new Date(year, month, 1).getDay();
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const byDate = new Map((dataset.series || []).map(s => [s.date, s]));
    const maxInMonth = Math.max(0.0001, ...[...byDate.values()].map(s => s.amount));

    const cells = [];
    for (let i = 0; i < firstDow; i++) cells.push('<div class="sm-cal-cell empty"></div>');
    for (let d = 1; d <= daysInMonth; d++) {
        const dateStr = formatYYYYMMDD(new Date(year, month, d));
        const point = byDate.get(dateStr);
        const amount = point?.amount ?? (dateStr >= dataset.bounds.startDate && dateStr <= dataset.bounds.endDate
            ? getCanonicalUsageOnDate(dataset.substanceId, dateStr)
            : 0);
        const status = point?.status || resolveSimpleTaperStatus(amount, point?.target ?? dataset.target);
        const intensity = amount > 0 ? Math.min(1, amount / maxInMonth) : 0;
        cells.push(`
            <button type="button" class="sm-cal-cell status-${escapeHtml(status.key)}"
                style="--sm-intensity:${intensity.toFixed(3)}"
                data-date="${escapeHtml(dateStr)}"
                onclick="openSimpleProgressDay('${escapeHtml(dateStr)}')"
                aria-label="${escapeHtml(dateStr)}">
                <span class="sm-cal-day">${d}</span>
            </button>`);
    }

    const label = monthStart.toLocaleString(undefined, { month: 'long', year: 'numeric' });
    const prevMonth = formatYYYYMMDD(new Date(year, month - 1, 1)).slice(0, 7);
    const nextMonth = formatYYYYMMDD(new Date(year, month + 1, 1)).slice(0, 7);
    return `
        <div class="sm-cal-card">
            <div class="sm-cal-header">
                <button type="button" class="sm-cal-nav" onclick="setSimpleProgressCalendarMonth('${prevMonth}')" aria-label="Previous month">‹</button>
                <h4>${escapeHtml(label)}</h4>
                <button type="button" class="sm-cal-nav" onclick="setSimpleProgressCalendarMonth('${nextMonth}')" aria-label="Next month">›</button>
            </div>
            <div class="sm-cal-dow">${['S','M','T','W','T','F','S'].map(d => `<span>${d}</span>`).join('')}</div>
            <div class="sm-cal-grid">${cells.join('')}</div>
        </div>`;
}

function setSimpleProgressCalendarMonth(monthStr) {
    persistSimpleModePrefs({ progressCalendarMonth: monthStr });
    renderSimpleProgress();
}

function openSimpleProgressDay(dateStr) {
    if (!dateStr) return;
    if (typeof setUseLogFilter === 'function') setUseLogFilter('all');
    if (typeof switchTab === 'function') switchTab('use-log-tab');
    // Prefer today filter when applicable
    const today = getLocalDateString();
    if (dateStr === today && typeof setUseLogFilter === 'function') setUseLogFilter('today');
    const list = document.getElementById('use-history-table-wrap') || document.getElementById('recent-use-list');
    list?.scrollIntoView?.({ behavior: 'smooth', block: 'start' });
}

function renderSimpleProgress(data = appData) {
    if (typeof document === 'undefined') return;
    const root = document.getElementById('simple-progress');
    if (!root) return;

    const prefs = ensureSimpleModePrefs(data);
    const substances = typeof getActiveSubstances === 'function'
        ? getActiveSubstances(data)
        : (data.substances || []).filter(s => s?.active !== false);
    let substanceId = prefs.progressSubstanceId
        || substances.find(s => s.isMain)?.id
        || substances[0]?.id;
    if (substanceId && !substances.some(s => s.id === substanceId)) {
        substanceId = substances[0]?.id || null;
    }
    if (!substanceId) {
        root.innerHTML = '<p class="settings-hint">Add a substance in Settings to see progress.</p>';
        return;
    }

    const dataset = buildSimpleProgressDataset(substanceId, prefs.progressRange, data);
    const month = prefs.progressCalendarMonth || dataset.bounds.endDate.slice(0, 7);
    const pctLabel = dataset.pctChange == null
        ? '—'
        : `${dataset.pctChange <= 0 ? '' : '+'}${Math.round(dataset.pctChange)}%`;
    const spendLabel = dataset.spend > 0
        ? (typeof formatMoneyOrDash === 'function'
            ? formatMoneyOrDash(dataset.spend)
            : `$${Number(dataset.spend).toFixed(2)}`)
        : '—';
    const spendPeriodLabel = dataset.spendPeriodLabel || formatSimpleSpendPeriodLabel(dataset.bounds);

    root.innerHTML = `
        <div class="sm-progress-header">
            <h2>Progress</h2>
            <p class="sm-progress-sub">A simple look at how things are going.</p>
        </div>
        <div class="sm-progress-controls">
            <label class="sm-field">
                <span>Substance</span>
                <select id="sm-progress-substance" onchange="onSimpleProgressSubstanceChange(this.value)">
                    ${substances.map(s => `<option value="${escapeHtml(s.id)}"${s.id === substanceId ? ' selected' : ''}>${escapeHtml(getSimpleSubstanceDisplayName(s, data))}</option>`).join('')}
                </select>
            </label>
            <div class="sm-range-pills" role="group" aria-label="Progress range">
                ${EXPERIENCE_PROGRESS_RANGES.map(r => {
                    const label = r === 'all' ? 'All Time' : `${r} Days`;
                    return `<button type="button" class="sm-range-btn${prefs.progressRange === r ? ' active' : ''}" onclick="setSimpleProgressRange('${r}')">${label}</button>`;
                }).join('')}
            </div>
        </div>
        <div class="sm-progress-metrics">
            <div class="sm-metric"><span class="sm-metric-label">Today</span><strong>${escapeHtml(formatSimpleUsage(substanceId, dataset.usedToday, data))}</strong></div>
            <div class="sm-metric"><span class="sm-metric-label">Daily average</span><strong>${escapeHtml(formatSimpleUsage(substanceId, dataset.dailyAvg, data))}</strong></div>
            <div class="sm-metric"><span class="sm-metric-label">Previous period</span><strong>${escapeHtml(formatSimpleUsage(substanceId, dataset.prevAvg, data))}</strong></div>
            <div class="sm-metric"><span class="sm-metric-label">Change</span><strong>${escapeHtml(pctLabel)}</strong></div>
            <div class="sm-metric"><span class="sm-metric-label">Break / streak</span><strong>${dataset.streakDays} day${dataset.streakDays === 1 ? '' : 's'}</strong></div>
            <div class="sm-metric"><span class="sm-metric-label">Taper</span><strong>${escapeHtml(dataset.status.label)}</strong></div>
            <div class="sm-metric"><span class="sm-metric-label">${escapeHtml(spendPeriodLabel)}</span><strong>${escapeHtml(spendLabel)}</strong></div>
        </div>
        <section class="sm-progress-section sm-trend-section">
            <div class="sm-section-head">
                <h3>Trend</h3>
                <p class="sm-section-sub">${escapeHtml(dataset.bounds.label)}</p>
            </div>
            ${renderSimpleProgressChart(dataset.series)}
            ${dataset.hasLogs === false || (!(dataset.usedToday > 0) && !(dataset.dailyAvg > 0) && !(dataset.series || []).some(p => Number(p?.amount) > 0))
                ? '<p class="sm-empty-hint">Your trends will appear after you start logging.</p>'
                : ''}
        </section>
        <section class="sm-progress-section sm-cal-section">
            <div class="sm-section-head">
                <h3>Calendar</h3>
            </div>
            <div id="sm-progress-calendar">${renderSimpleProgressCalendar(dataset, month)}</div>
        </section>
        <div class="sm-progress-footer">
            <button type="button" class="sm-text-btn" onclick="openDetailedAnalyticsFromSimple()">View Detailed Analytics</button>
        </div>`;
}

function onSimpleProgressSubstanceChange(substanceId) {
    persistSimpleModePrefs({ progressSubstanceId: substanceId });
    renderSimpleProgress();
}

function setSimpleProgressRange(rangeKey) {
    persistSimpleModePrefs({ progressRange: String(rangeKey) });
    renderSimpleProgress();
}

function openDetailedAnalyticsFromSimple() {
    // Temporarily reveal advanced insights UI without forcing global Advanced mode
    const tab = document.getElementById('insights-calendar-tab');
    tab?.classList.add('sm-show-detailed-analytics');
    if (typeof setInsightsCalendarView === 'function') setInsightsCalendarView('overview');
    if (typeof updateStats === 'function') updateStats();
    document.getElementById('stats-summary-dashboard')?.scrollIntoView?.({ behavior: 'smooth' });
}

function applySimplePlanIntent(intentId) {
    const intent = SIMPLE_PLAN_INTENTS.find(i => i.id === intentId) || SIMPLE_PLAN_INTENTS[0];
    persistSimpleModePrefs({ planIntent: intent.id });

    if (intent.id === 'track-only') {
        const wizardOnly = document.getElementById('simple-plan-wizard');
        if (wizardOnly) wizardOnly.classList.add('hidden');
        alert('Track only keeps logging without a taper plan. You can create a plan later anytime.');
        return;
    }

    const wizard = document.getElementById('simple-plan-wizard');
    if (wizard) wizard.classList.add('hidden');
    if (typeof globalThis !== 'undefined') globalThis.__smPlanWizardBypass = true;
    try {
        if (typeof showNewTaperPlan === 'function') showNewTaperPlan();
    } finally {
        if (typeof globalThis !== 'undefined') globalThis.__smPlanWizardBypass = false;
    }

    // Prefill relevant fields based on intent
    if (intent.reductionType && typeof populateTaperReductionTypeSelect === 'function') {
        const substanceId = typeof getTaperSubstanceId === 'function' ? getTaperSubstanceId() : null;
        try {
            populateTaperReductionTypeSelect(substanceId, intent.reductionType);
            const typeEl = document.getElementById('taper-reduction-type');
            if (typeEl) typeEl.value = intent.reductionType;
            if (typeof toggleTaperPlanTypeFields === 'function') {
                toggleTaperPlanTypeFields({ selectedType: intent.reductionType, skipPrefill: false });
            }
        } catch (_) { /* ignore */ }
    }

    if (intent.id === 'quit-by-date') {
        const goalEl = document.getElementById('taper-goal-daily')
            || document.getElementById('goal-daily-average')
            || document.getElementById('taper-goal-avg');
        if (goalEl) goalEl.value = '0';
    }

    if (intent.id === 'custom' || intent.id === 'use-less' || intent.id === 'quit-by-date') {
        // Show advanced block for custom; keep simpler fields visible otherwise
    }

    applySimplePlanFormLayout();
    document.getElementById('taper-setup')?.scrollIntoView?.({ behavior: 'smooth', block: 'start' });
}

function openSimplePlanWizard() {
    const wizard = typeof document !== 'undefined'
        ? document.getElementById('simple-plan-wizard')
        : null;
    if (!wizard) {
        // Tests / missing DOM — open the real taper form without looping.
        if (typeof globalThis !== 'undefined') globalThis.__smPlanWizardBypass = true;
        try {
            if (typeof showNewTaperPlan === 'function') showNewTaperPlan();
        } finally {
            if (typeof globalThis !== 'undefined') globalThis.__smPlanWizardBypass = false;
        }
        return;
    }
    wizard.classList.remove('hidden');
    wizard.innerHTML = `
        <div class="sm-plan-wizard-card">
            <h3>What are you trying to do?</h3>
            <p class="settings-hint">We’ll only show the settings that match what you’re trying to do.</p>
            <div class="sm-plan-intent-grid">
                ${SIMPLE_PLAN_INTENTS.map(intent => `
                    <button type="button" class="sm-plan-intent-btn" onclick="applySimplePlanIntent('${intent.id}')">
                        <strong>${escapeHtml(intent.label)}</strong>
                        <span>${escapeHtml(intent.hint)}</span>
                    </button>`).join('')}
            </div>
            <button type="button" class="secondary-btn btn-sm" onclick="closeSimplePlanWizard()">Cancel</button>
        </div>`;
    wizard.scrollIntoView?.({ behavior: 'smooth', block: 'start' });
}

function closeSimplePlanWizard() {
    document.getElementById('simple-plan-wizard')?.classList.add('hidden');
}

function applySimplePlanFormLayout(data = appData) {
    if (typeof document === 'undefined') return;
    const page = document.getElementById('goals-plans-tab');
    if (!page) return;
    const simple = isSimpleExperienceMode(data);
    page.classList.toggle('sm-plan-simple', simple);
    const prefs = ensureSimpleModePrefs(data);
    const intent = prefs.planIntent;
    page.dataset.planIntent = intent || '';

    // Hide purchase-heavy / advanced blocks unless Custom or Advanced Mode
    const advancedBlocks = page.querySelectorAll('[data-sm-plan-advanced="true"]');
    advancedBlocks.forEach(el => {
        el.classList.toggle('sm-hidden-in-simple', simple && intent !== 'custom');
    });

    const empty = document.getElementById('taper-no-plan');
    if (empty) {
        const heading = empty.querySelector('h3');
        const copy = empty.querySelector('p');
        if (simple) {
            if (heading) heading.textContent = 'No active taper';
            if (copy) copy.textContent = 'Create one when you’re ready.';
        } else {
            if (heading) heading.textContent = 'No taper plans for this substance yet.';
            if (copy) copy.textContent = 'Set starting and target averages, pick a reduction style, and track progress week by week.';
        }
    }
}

function syncExperienceModeSettingsUI(data = appData) {
    if (typeof document === 'undefined') return;
    const mode = getExperienceMode(data);
    const select = document.getElementById('experience-mode');
    if (select) select.value = mode;
    document.querySelectorAll('[data-experience-mode]').forEach(btn => {
        const active = btn.getAttribute('data-experience-mode') === mode;
        btn.classList.toggle('active', active);
        btn.setAttribute('aria-pressed', active ? 'true' : 'false');
    });
}

function onExperienceModeChange(value) {
    const next = normalizeExperienceMode(value);
    const prev = getExperienceMode(appData);
    persistExperienceMode(next);
    syncExperienceModeSettingsUI();
    // Leaving Advanced → Simple while on Inventory: return Home (Inventory stays reachable via Settings → Advanced/More)
    if (prev === EXPERIENCE_MODE_ADVANCED && next === EXPERIENCE_MODE_SIMPLE
        && appData.settings?.activeTab === 'buy-tracker-tab'
        && typeof switchTab === 'function') {
        switchTab('dashboard-tab');
    }
}

function updateBottomNavForExperienceMode(data = appData) {
    if (typeof document === 'undefined' || !document.body?.classList) return;
    const simple = isSimpleExperienceMode(data);
    document.body.classList.toggle('experience-simple', simple);
    document.body.classList.toggle('experience-advanced', !simple);

    const inventoryBtn = document.querySelector('.bottom-nav .nav-btn[data-tab="buy-tracker-tab"]');
    if (inventoryBtn) {
        inventoryBtn.classList.toggle('sm-nav-hidden', simple);
        inventoryBtn.setAttribute('aria-hidden', simple ? 'true' : 'false');
    }

    const insightsBtn = document.querySelector('.bottom-nav .nav-btn[data-tab="insights-calendar-tab"]');
    if (insightsBtn) {
        const full = insightsBtn.querySelector('.nav-btn-label-full');
        const short = insightsBtn.querySelector('.nav-btn-label-short');
        if (full) full.textContent = simple ? 'Progress' : 'Insights & Calendar';
        if (short) short.textContent = simple ? 'Progress' : 'Insights';
    }

    const plansBtn = document.querySelector('.bottom-nav .nav-btn[data-tab="goals-plans-tab"]');
    if (plansBtn) {
        const full = plansBtn.querySelector('.nav-btn-label-full');
        const short = plansBtn.querySelector('.nav-btn-label-short');
        if (full) full.textContent = simple ? 'Plan' : 'Tapers';
        if (short) short.textContent = simple ? 'Plan' : 'Tapers';
    }
}

function applyExperienceMode(data = appData) {
    ensureExperienceMode(data);
    const simple = isSimpleExperienceMode(data);
    if (typeof document === 'undefined' || !document.body?.classList) return;

    document.body.classList.toggle('experience-simple', simple);
    document.body.classList.toggle('experience-advanced', !simple);

    updateBottomNavForExperienceMode(data);
    syncExperienceModeSettingsUI(data);
    applySimpleLogFormLayout(data);
    applySimplePlanFormLayout(data);

    const dash = document.getElementById('dashboard-tab');
    if (dash) {
        dash.classList.toggle('sm-home-active', simple);
        if (!simple) dash.classList.remove('sm-show-advanced-home');
    }

    const insights = document.getElementById('insights-calendar-tab');
    if (insights) {
        insights.classList.toggle('sm-progress-active', simple);
        if (!simple) insights.classList.remove('sm-show-detailed-analytics');
    }

    const gp = document.getElementById('goals-plans-tab');
    if (gp) {
        const title = gp.querySelector('.combined-page-header h2');
        if (title) title.textContent = simple ? 'Plan' : 'Tapers';
        const hint = gp.querySelector('.combined-page-header .settings-hint');
        if (hint) {
            hint.textContent = simple
                ? 'Set a simple plan for how you want use to change.'
                : 'Tapers define a gradual reduction path.';
        }
    }

    if (simple) {
        renderSimpleHome(data);
        renderSimpleProgress(data);
    }
}

function initExperienceMode() {
    ensureExperienceMode(appData);
    applyExperienceMode(appData);

    // Hook new-plan buttons in simple mode toward wizard
    if (typeof document !== 'undefined') {
        document.getElementById('sm-new-plan-btn')?.addEventListener('click', (e) => {
            e.preventDefault();
            openSimplePlanWizard();
        });
    }
    maybeStartOnboarding(appData);
}

function onExperienceModeAfterUseLogSave() {
    try {
        rememberQuickLogFromForm(appData);
    } catch (err) {
        console.warn('[experience-mode] quick log memory failed', err);
    }
    if (isSimpleExperienceMode()) {
        renderSimpleHome(appData);
        renderSimpleProgress(appData);
    }
}

function onExperienceModeTabChange(tabId) {
    if (!isSimpleExperienceMode()) return;
    if (tabId === 'dashboard-tab') {
        hideAdvancedHomeDashboard();
        renderSimpleHome(appData);
    } else if (tabId === 'insights-calendar-tab') {
        document.getElementById('insights-calendar-tab')?.classList.remove('sm-show-detailed-analytics');
        renderSimpleProgress(appData);
    } else if (tabId === 'use-log-tab') {
        applySimpleLogFormLayout(appData);
    } else if (tabId === 'goals-plans-tab') {
        applySimplePlanFormLayout(appData);
    } else if (tabId === 'settings-tab') {
        syncExperienceModeSettingsUI(appData);
        renderOnboardingSettingsPanel(appData);
    }
}

// ——— First-time onboarding (Simple Mode) ———

const ONBOARDING_STEP_IDS = Object.freeze(['welcome', 'substances', 'intent', 'preferences', 'ready']);
const ONBOARDING_OTHER_ID = '__other__';
const ONBOARDING_REMINDERS = Object.freeze([
    { id: 'morning', label: 'Morning' },
    { id: 'evening', label: 'Evening' },
    { id: 'both', label: 'Both' },
    { id: 'none', label: 'No reminders' }
]);
const ONBOARDING_INTENTS = Object.freeze([
    { id: 'track-use', label: 'Track my use', planIntent: 'track-only', offersTaper: false },
    { id: 'use-less', label: 'Use less', planIntent: 'use-less', offersTaper: true },
    { id: 'spend-less', label: 'Spend less', planIntent: 'spend-less', offersTaper: true },
    { id: 'buy-less', label: 'Buy less often', planIntent: 'buy-less', offersTaper: true },
    { id: 'quit-eventually', label: 'Quit eventually', planIntent: 'quit-by-date', offersTaper: true },
    { id: 'understand', label: 'Understand my patterns', planIntent: 'track-only', offersTaper: false }
]);

let onboardingUi = {
    open: false,
    stepIndex: 0,
    draft: null
};

function getDefaultOnboardingState() {
    return {
        skipped: false,
        restarting: false,
        intentId: null,
        reminder: 'none',
        reminderPermission: 'not-requested',
        reminderScheduled: false,
        taperSetupRequested: false,
        selectedSubstanceIds: [],
        primarySubstanceId: null,
        experienceMode: EXPERIENCE_MODE_SIMPLE,
        completedAt: null
    };
}

function getDefaultOnboardingDraft(data = appData) {
    const active = (data.substances || []).filter(s => s && s.active !== false).map(s => s.id);
    const main = (data.substances || []).find(s => s && s.isMain && s.active !== false);
    return {
        selectedIds: active.slice(),
        otherEnabled: false,
        otherName: '',
        primaryId: main?.id || active[0] || null,
        intentId: null,
        taperChoice: null,
        experienceMode: EXPERIENCE_MODE_SIMPLE,
        reminder: 'none',
        skipped: false
    };
}

function ensureOnboardingSettings(data = appData) {
    if (!data || typeof data !== 'object') return getDefaultOnboardingState();
    if (!data.settings || typeof data.settings !== 'object') data.settings = {};
    const defaults = getDefaultOnboardingState();
    if (typeof data.settings.onboardingCompleted !== 'boolean') {
        data.settings.onboardingCompleted = false;
    }
    if (!data.settings.onboarding || typeof data.settings.onboarding !== 'object') {
        data.settings.onboarding = { ...defaults };
    }
    const state = data.settings.onboarding;
    Object.keys(defaults).forEach(key => {
        if (state[key] === undefined) state[key] = defaults[key];
    });
    return state;
}

function migrateOnboardingV1(data = appData) {
    if (!data || typeof data !== 'object') return;
    if (!data.migrations || typeof data.migrations !== 'object') data.migrations = {};
    if (!data.settings || typeof data.settings !== 'object') data.settings = {};

    if (!data.migrations.onboardingV1) {
        if (hasMeaningfulRecoveryData(data) && data.settings.onboardingCompleted !== true) {
            data.settings.onboardingCompleted = true;
        }
        data.migrations.onboardingV1 = true;
    }
    ensureOnboardingSettings(data);
    if (hasMeaningfulRecoveryData(data) && !data.settings.onboarding?.restarting) {
        data.settings.onboarding.restarting = false;
        if (data.settings.onboardingCompleted !== true && data.settings.onboardingCompleted !== false) {
            data.settings.onboardingCompleted = true;
        }
    }
}

function getOnboardingState(data = appData) {
    migrateOnboardingV1(data);
    return ensureOnboardingSettings(data);
}

function shouldShowOnboarding(data = appData) {
    if (!data || typeof data !== 'object') return false;
    if (!data.settings || typeof data.settings !== 'object') data.settings = {};
    const state = data.settings.onboarding && typeof data.settings.onboarding === 'object'
        ? data.settings.onboarding
        : null;
    if (state?.restarting === true) return true;
    if (data.settings.onboardingCompleted === true) return false;
    if (hasMeaningfulRecoveryData(data)) return false;
    return true;
}

function persistOnboardingState(patch = {}, data = appData) {
    const state = ensureOnboardingSettings(data);
    Object.assign(state, patch || {});
    if (typeof saveData === 'function') saveData(data);
    return state;
}

function getOnboardingCatalog(data = appData) {
    const catalog = typeof DEFAULT_SUBSTANCE_CATALOG !== 'undefined'
        ? DEFAULT_SUBSTANCE_CATALOG
        : (data.substances || []);
    return (catalog || []).map(entry => {
        const existing = (data.substances || []).find(s => s && s.id === entry.id);
        return existing || entry;
    });
}

function getOnboardingSubstanceLabel(sub) {
    if (!sub) return '';
    if (sub.id === 'weed-thc') return 'Cannabis';
    if (sub.id === 'coke') return 'Cocaine';
    if (sub.id === 'xannax') return 'Xanax / benzodiazepines';
    return getSimpleSubstanceDisplayName(sub);
}

function getOnboardingDraft() {
    if (!onboardingUi.draft) onboardingUi.draft = getDefaultOnboardingDraft(appData);
    return onboardingUi.draft;
}

function isOnboardingOpen() {
    return !!onboardingUi.open;
}

function getOnboardingStepId() {
    return ONBOARDING_STEP_IDS[onboardingUi.stepIndex] || ONBOARDING_STEP_IDS[0];
}

function applyOnboardingTrackedSubstances(selectedIds, primaryId, data = appData, options = {}) {
    const ids = (selectedIds || []).filter(id => id && id !== ONBOARDING_OTHER_ID);
    if (!ids.length && !options.otherName) {
        return { changed: false, selectedIds: [], primaryId: null };
    }
    if (!Array.isArray(data.substances)) data.substances = [];

    let otherId = null;
    if (options.otherName && String(options.otherName).trim()) {
        const name = String(options.otherName).trim();
        const existing = data.substances.find(s =>
            s && String(s.name).toLowerCase() === name.toLowerCase()
        );
        if (existing) {
            otherId = existing.id;
            existing.active = true;
            existing.archived = false;
        } else if (typeof createSubstance === 'function') {
            otherId = typeof uniqueSubstanceId === 'function'
                ? uniqueSubstanceId(name)
                : `custom-${Date.now()}`;
            data.substances.push(createSubstance({
                id: otherId,
                name,
                trackingMode: 'standard',
                units: ['units'],
                defaultUnit: 'units',
                active: true,
                isMain: false
            }));
        }
        if (otherId && !ids.includes(otherId)) ids.push(otherId);
    }

    const selected = new Set(ids);
    data.substances.forEach(sub => {
        if (!sub?.id) return;
        const on = selected.has(sub.id);
        sub.active = on;
        if (on) sub.archived = false;
        if (!on) sub.isMain = false;
    });

    const resolvedPrimary = (primaryId && selected.has(primaryId))
        ? primaryId
        : (ids[0] || otherId || null);
    data.substances.forEach(sub => {
        sub.isMain = !!(resolvedPrimary && sub.id === resolvedPrimary && sub.active !== false);
    });
    if (typeof normalizeMainSubstances === 'function') normalizeMainSubstances(data);
    return {
        changed: true,
        selectedIds: ids.slice(),
        primaryId: resolvedPrimary
    };
}

function applyOnboardingReminderPreference(choice, options = {}) {
    const reminder = ONBOARDING_REMINDERS.some(r => r.id === choice) ? choice : 'none';
    const result = {
        reminder,
        reminderPermission: 'not-requested',
        reminderScheduled: false
    };
    if (reminder === 'none') return result;
    if (options.requestPermission === false) return result;
    const NotificationApi = (typeof Notification !== 'undefined') ? Notification : null;
    if (!NotificationApi || typeof NotificationApi.requestPermission !== 'function') {
        result.reminderPermission = 'unsupported';
        result.reminderScheduled = false;
        return result;
    }
    try {
        const permission = NotificationApi.requestPermission();
        result.reminderPermission = permission && typeof permission.then === 'function' ? 'pending' : String(permission || 'default');
        result.reminderScheduled = false;
    } catch (_) {
        result.reminderPermission = 'unsupported';
        result.reminderScheduled = false;
    }
    return result;
}

function hideOnboardingOverlay() {
    onboardingUi.open = false;
    if (typeof document === 'undefined') return;
    document.getElementById('onboarding-overlay')?.classList?.add('hidden');
    document.body?.classList?.remove('onboarding-open');
}

function renderOnboarding(data = appData) {
    if (typeof document === 'undefined') return;
    const overlay = document.getElementById('onboarding-overlay');
    const root = document.getElementById('onboarding-root');
    if (!overlay || !root) return;
    overlay.classList?.toggle('hidden', !onboardingUi.open);
    document.body?.classList?.toggle('onboarding-open', !!onboardingUi.open);
    if (!onboardingUi.open) {
        root.innerHTML = '';
        return;
    }
    const draft = getOnboardingDraft();
    const stepId = getOnboardingStepId();
    const stepNum = onboardingUi.stepIndex + 1;
    const stepTotal = ONBOARDING_STEP_IDS.length;
    const progress = `<p class="onboarding-progress">${stepNum} of ${stepTotal}</p>`;
    const navStart = `
        <div class="onboarding-nav">
            ${onboardingUi.stepIndex > 0
                ? '<button type="button" class="secondary-btn" onclick="onboardingBack()">Back</button>'
                : '<span></span>'}
            <button type="button" class="sm-text-btn" onclick="skipOnboarding()">Exit</button>
        </div>`;

    let body = '';
    if (stepId === 'welcome') {
        body = `
            <h1 id="onboarding-title">Recovery Tracker</h1>
            <p class="onboarding-lead">Track use, spending, patterns, and progress in one place.</p>
            <div class="onboarding-actions">
                <button type="button" class="sm-action-btn sm-action-primary" onclick="onboardingContinue()">Get Started</button>
                <button type="button" class="sm-action-btn sm-action-secondary" onclick="skipOnboarding()">Skip Setup</button>
            </div>`;
    } else if (stepId === 'substances') {
        const catalog = getOnboardingCatalog(data);
        const chips = catalog.map(sub => {
            const selected = draft.selectedIds.includes(sub.id);
            return `<button type="button" class="onboarding-chip${selected ? ' selected' : ''}" aria-pressed="${selected}" onclick="toggleOnboardingSubstance('${escapeHtml(sub.id)}')">${escapeHtml(getOnboardingSubstanceLabel(sub))}</button>`;
        }).join('');
        const primaryNeeded = draft.selectedIds.length > 1;
        const primary = primaryNeeded ? `
            <h3 class="onboarding-subhead">Which one do you want to focus on most?</h3>
            <div class="onboarding-chip-grid">
                ${draft.selectedIds.map(id => {
                    const sub = catalog.find(s => s.id === id) || (data.substances || []).find(s => s.id === id);
                    const on = draft.primaryId === id;
                    return `<button type="button" class="onboarding-chip${on ? ' selected' : ''}" onclick="setOnboardingPrimary('${escapeHtml(id)}')">${escapeHtml(getOnboardingSubstanceLabel(sub) || id)}</button>`;
                }).join('')}
            </div>` : '';
        body = `
            ${progress}
            <h2 id="onboarding-title">What do you want to track?</h2>
            <p class="onboarding-lead">Choose only what you want. You can add another later.</p>
            <div class="onboarding-chip-grid">${chips}
                <button type="button" class="onboarding-chip${draft.otherEnabled ? ' selected' : ''}" aria-pressed="${draft.otherEnabled}" onclick="toggleOnboardingSubstance('${ONBOARDING_OTHER_ID}')">Other</button>
            </div>
            ${draft.otherEnabled ? `
                <label class="sm-field">Name
                    <input type="text" id="onboarding-other-name" value="${escapeHtml(draft.otherName)}" placeholder="Custom substance" oninput="onboardingUi.draft.otherName = this.value">
                </label>` : ''}
            ${primary}
            <p class="settings-hint">Add another later from Settings → Manage Substances.</p>
            ${navStart}
            <div class="onboarding-actions">
                <button type="button" class="sm-action-btn sm-action-primary" onclick="onboardingContinue()">Continue</button>
                <button type="button" class="sm-text-btn" onclick="onboardingSkipStep()">Add another later</button>
            </div>`;
    } else if (stepId === 'intent') {
        const intent = ONBOARDING_INTENTS.find(i => i.id === draft.intentId);
        body = `
            ${progress}
            <h2 id="onboarding-title">What are you trying to do?</h2>
            <p class="onboarding-lead">Pick one. This is just a preference — it does not create a taper by itself.</p>
            <div class="onboarding-choice-list">
                ${ONBOARDING_INTENTS.map(item => `
                    <button type="button" class="onboarding-choice${draft.intentId === item.id ? ' selected' : ''}" onclick="setOnboardingIntent('${item.id}')">
                        ${escapeHtml(item.label)}
                    </button>`).join('')}
            </div>
            ${intent?.offersTaper ? `
                <div class="onboarding-taper-offer">
                    <p>Want to set up a taper now?</p>
                    <div class="onboarding-choice-row">
                        <button type="button" class="onboarding-chip${draft.taperChoice === 'now' ? ' selected' : ''}" onclick="setOnboardingTaperChoice('now')">Set up a taper now</button>
                        <button type="button" class="onboarding-chip${draft.taperChoice === 'later' ? ' selected' : ''}" onclick="setOnboardingTaperChoice('later')">Do this later</button>
                    </div>
                </div>` : ''}
            ${navStart}
            <div class="onboarding-actions">
                <button type="button" class="sm-action-btn sm-action-primary" onclick="onboardingContinue()">Continue</button>
                <button type="button" class="sm-text-btn" onclick="onboardingSkipStep()">Skip</button>
            </div>`;
    } else if (stepId === 'preferences') {
        body = `
            ${progress}
            <h2 id="onboarding-title">How detailed do you want tracking to be?</h2>
            <div class="onboarding-choice-list">
                <button type="button" class="onboarding-choice${draft.experienceMode !== 'advanced' ? ' selected' : ''}" onclick="setOnboardingExperienceMode('simple')">
                    <strong>Simple</strong>
                    <span>Just log use quickly.</span>
                </button>
                <button type="button" class="onboarding-choice${draft.experienceMode === 'advanced' ? ' selected' : ''}" onclick="setOnboardingExperienceMode('advanced')">
                    <strong>Detailed</strong>
                    <span>Track purchases, inventory, cost, product details, and advanced analytics.</span>
                </button>
            </div>
            <h3 class="onboarding-subhead">Want a reminder to check in?</h3>
            <div class="onboarding-chip-grid">
                ${ONBOARDING_REMINDERS.map(item => `
                    <button type="button" class="onboarding-chip${draft.reminder === item.id ? ' selected' : ''}" onclick="setOnboardingReminder('${item.id}')">${escapeHtml(item.label)}</button>
                `).join('')}
            </div>
            <p class="settings-hint">Reminders are saved as a preference. Notification permission is only requested if you choose one, and only if this browser supports it.</p>
            ${navStart}
            <div class="onboarding-actions">
                <button type="button" class="sm-action-btn sm-action-primary" onclick="onboardingContinue()">Continue</button>
                <button type="button" class="sm-text-btn" onclick="onboardingSkipStep()">Skip</button>
            </div>`;
    } else {
        const selectedNames = getOnboardingSummary(draft, data);
        body = `
            ${progress}
            <h2 id="onboarding-title">You're ready</h2>
            <ul class="onboarding-summary">
                <li><span>Tracking</span><strong>${escapeHtml(selectedNames.substances)}</strong></li>
                <li><span>Focus</span><strong>${escapeHtml(selectedNames.primary)}</strong></li>
                <li><span>Mode</span><strong>${escapeHtml(selectedNames.mode)}</strong></li>
                <li><span>Taper</span><strong>${escapeHtml(selectedNames.taper)}</strong></li>
            </ul>
            <details class="onboarding-privacy">
                <summary>Your data</summary>
                <p>Recovery Tracker stores your information in this browser first, using localStorage. An optional account can back it up to the cloud. There is no automatic cloud wipe of this device, and export still downloads a file you keep.</p>
                <p>Export JSON Backup downloads a file you can keep or restore later. Clear All Data permanently deletes local logs, substances, and settings on this device after creating an automatic backup. Cloud account data is separate.</p>
            </details>
            ${navStart}
            <div class="onboarding-actions">
                <button type="button" class="sm-action-btn sm-action-primary" onclick="completeOnboarding({ next: 'quick-log' })">Log my first entry</button>
                <button type="button" class="sm-action-btn sm-action-secondary" onclick="completeOnboarding({ next: 'home' })">Go to Home</button>
            </div>`;
    }
    root.innerHTML = `<div class="onboarding-card-inner">${body}</div>`;
}

function getOnboardingSummary(draft, data = appData) {
    const catalog = getOnboardingCatalog(data);
    const names = (draft.selectedIds || []).map(id => {
        const sub = catalog.find(s => s.id === id) || (data.substances || []).find(s => s.id === id);
        return getOnboardingSubstanceLabel(sub) || id;
    });
    if (draft.otherEnabled && draft.otherName) names.push(draft.otherName.trim());
    const primarySub = catalog.find(s => s.id === draft.primaryId)
        || (data.substances || []).find(s => s.id === draft.primaryId);
    const intent = ONBOARDING_INTENTS.find(i => i.id === draft.intentId);
    let taper = 'None yet';
    if (draft.taperChoice === 'now') taper = 'Set up next';
    else if (draft.taperChoice === 'later') taper = 'Later';
    else if (!intent?.offersTaper) taper = 'Not requested';
    return {
        substances: names.length ? names.join(', ') : 'Add later',
        primary: getOnboardingSubstanceLabel(primarySub) || names[0] || 'Not set',
        mode: draft.experienceMode === 'advanced' ? 'Detailed' : 'Simple',
        taper
    };
}

function startOnboarding(options = {}, data = appData) {
    const restart = options.restart === true;
    if (restart) {
        persistOnboardingState({ restarting: true }, data);
        data.settings.onboardingCompleted = false;
        if (typeof saveData === 'function') saveData(data);
    }
    onboardingUi.open = true;
    onboardingUi.stepIndex = Number.isInteger(options.stepIndex) ? options.stepIndex : 0;
    onboardingUi.draft = getDefaultOnboardingDraft(data);
    if (restart) {
        onboardingUi.draft.experienceMode = getExperienceMode(data);
    } else {
        onboardingUi.draft.selectedIds = [];
        onboardingUi.draft.primaryId = null;
        onboardingUi.draft.experienceMode = EXPERIENCE_MODE_SIMPLE;
    }
    renderOnboarding(data);
    return getOnboardingDraft();
}

function maybeStartOnboarding(data = appData) {
    if (!shouldShowOnboarding(data)) return false;
    startOnboarding({ restart: !!ensureOnboardingSettings(data).restarting }, data);
    return true;
}

function onboardingBack() {
    if (onboardingUi.stepIndex > 0) onboardingUi.stepIndex -= 1;
    renderOnboarding();
}

function onboardingSkipStep() {
    const stepId = getOnboardingStepId();
    if (stepId === 'substances') {
        getOnboardingDraft().selectedIds = getOnboardingDraft().selectedIds || [];
    } else if (stepId === 'intent') {
        getOnboardingDraft().intentId = getOnboardingDraft().intentId || null;
        getOnboardingDraft().taperChoice = 'later';
    } else if (stepId === 'preferences') {
        getOnboardingDraft().reminder = 'none';
    }
    onboardingContinue();
}

function onboardingContinue() {
    const draft = getOnboardingDraft();
    const stepId = getOnboardingStepId();
    if (stepId === 'substances' && draft.selectedIds.length === 1) {
        draft.primaryId = draft.selectedIds[0];
    }
    if (stepId === 'substances' && draft.selectedIds.length > 1 && !draft.primaryId) {
        draft.primaryId = draft.selectedIds[0];
    }
    if (onboardingUi.stepIndex < ONBOARDING_STEP_IDS.length - 1) {
        onboardingUi.stepIndex += 1;
        renderOnboarding();
        return;
    }
    completeOnboarding({ next: 'home' });
}

function toggleOnboardingSubstance(id) {
    const draft = getOnboardingDraft();
    if (id === ONBOARDING_OTHER_ID) {
        draft.otherEnabled = !draft.otherEnabled;
        renderOnboarding();
        return;
    }
    const idx = draft.selectedIds.indexOf(id);
    if (idx >= 0) draft.selectedIds.splice(idx, 1);
    else draft.selectedIds.push(id);
    if (draft.primaryId && !draft.selectedIds.includes(draft.primaryId)) {
        draft.primaryId = draft.selectedIds[0] || null;
    }
    if (draft.selectedIds.length === 1) draft.primaryId = draft.selectedIds[0];
    renderOnboarding();
}

function setOnboardingPrimary(id) {
    getOnboardingDraft().primaryId = id;
    renderOnboarding();
}

function setOnboardingIntent(id) {
    const draft = getOnboardingDraft();
    draft.intentId = id;
    const intent = ONBOARDING_INTENTS.find(i => i.id === id);
    if (!intent?.offersTaper) draft.taperChoice = null;
    renderOnboarding();
}

function setOnboardingTaperChoice(choice) {
    getOnboardingDraft().taperChoice = choice === 'now' ? 'now' : 'later';
    renderOnboarding();
}

function setOnboardingExperienceMode(mode) {
    getOnboardingDraft().experienceMode = normalizeExperienceMode(mode);
    renderOnboarding();
}

function setOnboardingReminder(id) {
    const draft = getOnboardingDraft();
    draft.reminder = id;
    if (id && id !== 'none') applyOnboardingReminderPreference(id);
    renderOnboarding();
}

function skipOnboarding(data = appData) {
    const reminder = applyOnboardingReminderPreference('none', { requestPermission: false });
    persistOnboardingState({
        skipped: true,
        restarting: false,
        reminder: 'none',
        reminderPermission: reminder.reminderPermission,
        reminderScheduled: false,
        taperSetupRequested: false,
        completedAt: new Date().toISOString()
    }, data);
    data.settings.onboardingCompleted = true;
    if (typeof saveData === 'function') saveData(data);
    hideOnboardingOverlay();
    renderOnboardingSettingsPanel(data);
    if (typeof switchTab === 'function') {
        try { switchTab('dashboard-tab'); } catch (_) { /* ignore */ }
    }
    return { ok: true, skipped: true, onboardingCompleted: true };
}

function completeOnboarding(options = {}, data = appData) {
    const draft = options.draft || getOnboardingDraft();
    const next = options.next || 'home';
    const createdTaperBefore = Array.isArray(data.taperPlansV2) ? data.taperPlansV2.length : 0;

    const substanceResult = applyOnboardingTrackedSubstances(
        draft.selectedIds,
        draft.primaryId,
        data,
        { otherName: draft.otherEnabled ? draft.otherName : '' }
    );
    const primaryId = substanceResult.primaryId
        || (data.substances || []).find(s => s.isMain)?.id
        || null;

    const mode = persistExperienceMode(draft.experienceMode || EXPERIENCE_MODE_SIMPLE, data);
    const intent = ONBOARDING_INTENTS.find(i => i.id === draft.intentId);
    if (intent?.planIntent) persistSimpleModePrefs({ planIntent: intent.planIntent }, data);
    if (primaryId) persistSimpleModePrefs({ lastQuickSubstanceId: primaryId, progressSubstanceId: primaryId }, data);

    const reminder = applyOnboardingReminderPreference(draft.reminder || 'none', {
        requestPermission: draft.reminder && draft.reminder !== 'none'
    });
    persistOnboardingState({
        skipped: false,
        restarting: false,
        intentId: draft.intentId || null,
        reminder: reminder.reminder,
        reminderPermission: reminder.reminderPermission,
        reminderScheduled: false,
        taperSetupRequested: draft.taperChoice === 'now',
        selectedSubstanceIds: substanceResult.selectedIds,
        primarySubstanceId: primaryId,
        experienceMode: mode,
        completedAt: new Date().toISOString()
    }, data);
    data.settings.onboardingCompleted = true;
    if (typeof saveData === 'function') saveData(data);

    hideOnboardingOverlay();
    if (typeof applyExperienceMode === 'function') applyExperienceMode(data);
    renderOnboardingSettingsPanel(data);

    const createdTaperAfter = Array.isArray(data.taperPlansV2) ? data.taperPlansV2.length : 0;
    const result = {
        ok: true,
        skipped: false,
        onboardingCompleted: true,
        experienceMode: mode,
        primarySubstanceId: primaryId,
        selectedSubstanceIds: substanceResult.selectedIds,
        taperCreated: createdTaperAfter > createdTaperBefore,
        taperSetupRequested: draft.taperChoice === 'now'
    };

    if (next === 'quick-log') {
        if (typeof openSimpleQuickLog === 'function') openSimpleQuickLog(primaryId);
    } else if (typeof switchTab === 'function') {
        try { switchTab('dashboard-tab'); } catch (_) { /* ignore */ }
    }

    if (draft.taperChoice === 'now' && next !== 'quick-log' && intent?.planIntent) {
        if (typeof switchTab === 'function') {
            try { switchTab('goals-plans-tab'); } catch (_) { /* ignore */ }
        }
        if (typeof applySimplePlanIntent === 'function') {
            try { applySimplePlanIntent(intent.planIntent); } catch (_) { /* ignore */ }
        }
    }
    return result;
}

function restartOnboarding(data = appData) {
    const logs = (data.logs || []).length;
    const purchases = (data.purchases || []).length;
    const tapers = Array.isArray(data.taperPlansV2) ? data.taperPlansV2.length : 0;
    startOnboarding({ restart: true }, data);
    return {
        ok: true,
        logsPreserved: (data.logs || []).length === logs,
        purchasesPreserved: (data.purchases || []).length === purchases,
        tapersPreserved: (Array.isArray(data.taperPlansV2) ? data.taperPlansV2.length : 0) === tapers
    };
}

function reconcileOnboardingAfterImport(merged) {
    if (!merged || typeof merged !== 'object') return merged;
    if (!merged.settings || typeof merged.settings !== 'object') merged.settings = {};
    migrateOnboardingV1(merged);
    if (hasMeaningfulRecoveryData(merged)) {
        merged.settings.onboardingCompleted = true;
        if (merged.settings.onboarding) merged.settings.onboarding.restarting = false;
    }
    return merged;
}

function renderOnboardingSettingsPanel(data = appData) {
    if (typeof document === 'undefined') return;
    const root = document.getElementById('onboarding-settings-summary');
    if (!root) return;
    const state = getOnboardingState(data);
    const completed = data.settings?.onboardingCompleted === true;
    const mode = getExperienceMode(data) === EXPERIENCE_MODE_ADVANCED ? 'Detailed' : 'Simple';
    const primary = getSimpleSubstanceDisplayName(state.primarySubstanceId || (data.substances || []).find(s => s.isMain), data);
    const tracked = (data.substances || []).filter(s => s && s.active !== false).map(s => getSimpleSubstanceDisplayName(s, data));
    root.innerHTML = `
        <p class="settings-hint">${completed ? 'Setup complete.' : 'Setup has not been finished yet.'}</p>
        <ul class="onboarding-settings-facts">
            <li>Mode: ${escapeHtml(mode)}</li>
            <li>Primary: ${escapeHtml(primary || '—')}</li>
            <li>Tracking: ${escapeHtml(tracked.join(', ') || '—')}</li>
        </ul>`;
}

function openOnboardingReview() {
    if (typeof switchTab === 'function') switchTab('settings-tab');
    document.getElementById('onboarding-setup-section')?.scrollIntoView?.({ behavior: 'smooth', block: 'start' });
}

function openTrackedSubstancesFromOnboarding() {
    if (typeof switchTab === 'function') switchTab('settings-tab');
    const section = document.querySelector('[data-section="settingsSubstances"]');
    if (section?.classList.contains('collapsed') && typeof toggleSection === 'function') {
        try { toggleSection('settingsSubstances'); } catch (_) { /* ignore */ }
    }
    section?.scrollIntoView?.({ behavior: 'smooth', block: 'start' });
}
