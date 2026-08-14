// ——— Financial Analytics ———
// Spending analytics, budgets, savings, and forecasting for Recovery Tracker.
// Local-only: every mutation persists through saveData(appData). No imports/exports —
// this file is spliced into app.js ahead of `const defaultData`.
//
// Money rules enforced everywhere in this module:
//   • "Purchased as Gift" counts as spending (you paid for it).
//   • "Gift Received" and free/other adjustments never count as spending.
//   • Use logs are consumption, never spend — cost-per-use divides spend by usage.
//   • Weighted cost per unit is sum(cost) / sum(quantity), never the mean of per-unit costs.
//   • Date ranges are local-date strings and inclusive on both ends.
//   • Anything projected or inferred is labelled as an estimate.

const FINANCIAL_ESTIMATE_LABEL = 'Estimate';

const FINANCIAL_DATE_PRESETS = Object.freeze([
    { id: 'today', label: 'Today' },
    { id: 'yesterday', label: 'Yesterday' },
    { id: 'last-7', label: 'Last 7 days' },
    { id: 'last-30', label: 'Last 30 days' },
    { id: 'this-week', label: 'This week' },
    { id: 'last-week', label: 'Last week' },
    { id: 'this-month', label: 'This month' },
    { id: 'last-month', label: 'Last month' },
    { id: 'past-3-months', label: 'Past 3 months' },
    { id: 'past-6-months', label: 'Past 6 months' },
    { id: 'past-12-months', label: 'Past 12 months' },
    { id: 'this-year', label: 'This year' },
    { id: 'last-year', label: 'Last year' },
    { id: 'all-time', label: 'All time' },
    { id: 'custom', label: 'Custom range' }
]);

const FINANCIAL_BUDGET_PERIODS = Object.freeze(['daily', 'weekly', 'monthly', 'yearly']);

const FINANCIAL_BUDGET_PERIOD_LABELS = Object.freeze({
    daily: 'Per day',
    weekly: 'Per week',
    monthly: 'Per month',
    yearly: 'Per year'
});

const FINANCIAL_BUDGET_STATUSES = Object.freeze(['active', 'paused', 'archived']);

const FINANCIAL_BUDGET_STATE_META = Object.freeze({
    on_track: { label: 'On track', tone: 'good' },
    near_limit: { label: 'Near limit', tone: 'warn' },
    at_limit: { label: 'At limit', tone: 'warn' },
    over_budget: { label: 'Over budget', tone: 'bad' },
    not_started: { label: 'Not started', tone: 'neutral' },
    paused: { label: 'Paused', tone: 'neutral' },
    archived: { label: 'Archived', tone: 'neutral' },
    ended: { label: 'Ended', tone: 'neutral' }
});

const FINANCIAL_ISSUE_LABELS = Object.freeze({
    nearBudget: 'Near budget',
    overBudget: 'Over budget',
    largePurchase: 'Unusually large purchase',
    spendingSpike: 'Spending spike',
    purchaseFrequency: 'Buying more often',
    costPerUnitIncrease: 'Unit price increase',
    duplicatePurchase: 'Possible duplicate',
    missingCost: 'Missing cost',
    missingQuantity: 'Missing quantity',
    invalidCostPerUnit: 'Suspicious unit price'
});

const FINANCIAL_CHART_GROUP_BYS = Object.freeze([
    { id: 'spend', label: 'Spending' },
    { id: 'count', label: 'Purchase count' },
    { id: 'avgCost', label: 'Average purchase cost' },
    { id: 'avgCostPerUnit', label: 'Average cost per unit' },
    { id: 'rolling7', label: 'Rolling 7-day spend' },
    { id: 'rolling30', label: 'Rolling 30-day spend' },
    { id: 'runningMonthly', label: 'Running monthly total' },
    { id: 'runningYearly', label: 'Running yearly total' }
]);

const FINANCIAL_CHART_GRAINS = Object.freeze(['daily', 'weekly', 'monthly', 'yearly']);

const FINANCIAL_COMPARE_PRESETS = Object.freeze([
    { id: 'previous-period', label: 'Previous period' },
    { id: 'previous-week', label: 'Week over week' },
    { id: 'previous-month', label: 'Month over month' },
    { id: 'previous-year', label: 'Year over year' },
    { id: 'same-period-last-year', label: 'Same period last year' },
    { id: 'baseline-average', label: 'Versus history average' }
]);

const FINANCIAL_BREAKDOWN_DIMENSIONS = Object.freeze([
    { id: 'substance', label: 'Substance' },
    { id: 'productType', label: 'Product type' },
    { id: 'store', label: 'Store' },
    { id: 'supplier', label: 'Supplier' },
    { id: 'paymentMethod', label: 'Payment method' },
    { id: 'acquisitionType', label: 'Acquisition type' },
    { id: 'weekday', label: 'Day of week' },
    { id: 'timeOfDay', label: 'Time of day' }
]);

const FINANCIAL_WEEKDAY_LABELS = Object.freeze(['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']);

const FINANCIAL_ACQUISITION_LABELS = Object.freeze({
    purchased: 'Purchased',
    purchased_as_gift: 'Purchased as gift',
    gift_received: 'Gift received',
    other_adjustment: 'Other adjustment'
});

const FINANCIAL_NO_PURCHASE_MILESTONES = Object.freeze([7, 14, 30, 60, 90, 180, 365]);

const FINANCIAL_DAYS_PER_MONTH = 30.4375;

// ——— Financial Analytics: tiny shared helpers ———

function finToNumber(value, fallback = 0) {
    const n = typeof value === 'number' ? value : parseFloat(value);
    return Number.isFinite(n) ? n : fallback;
}

function finRound(value, decimals = 2) {
    const n = finToNumber(value, 0);
    const factor = Math.pow(10, decimals);
    return Math.round((n + Number.EPSILON) * factor) / factor;
}

function finSum(values) {
    return (values || []).reduce((total, v) => total + finToNumber(v, 0), 0);
}

function finMedian(values) {
    const nums = (values || []).map(v => finToNumber(v, 0)).sort((a, b) => a - b);
    if (!nums.length) return 0;
    const mid = Math.floor(nums.length / 2);
    return nums.length % 2 ? nums[mid] : (nums[mid - 1] + nums[mid]) / 2;
}

function finDivide(numerator, denominator) {
    const d = finToNumber(denominator, 0);
    if (!d) return null;
    return finToNumber(numerator, 0) / d;
}

function finStdDev(values) {
    const nums = (values || []).map(v => finToNumber(v, 0));
    if (nums.length < 2) return 0;
    const mean = finSum(nums) / nums.length;
    const variance = finSum(nums.map(n => (n - mean) * (n - mean))) / (nums.length - 1);
    return Math.sqrt(Math.max(0, variance));
}

function finToday() {
    return typeof getLocalDateString === 'function' ? getLocalDateString() : new Date().toISOString().slice(0, 10);
}

function finAddDays(dateStr, days) {
    return typeof addDaysYYYYMMDD === 'function' ? addDaysYYYYMMDD(dateStr, days) : dateStr;
}

function finDaysBetween(startDate, endDate) {
    if (!startDate || !endDate) return 0;
    return typeof countDaysInRange === 'function' ? countDaysInRange(startDate, endDate) : 1;
}

function finAddMonths(dateStr, months) {
    const d = typeof parseLocalDate === 'function' ? parseLocalDate(dateStr) : null;
    if (!d) return dateStr;
    const day = d.getDate();
    const shifted = new Date(d.getFullYear(), d.getMonth() + months, 1, 12, 0, 0, 0);
    const lastDay = new Date(shifted.getFullYear(), shifted.getMonth() + 1, 0).getDate();
    shifted.setDate(Math.min(day, lastDay));
    return formatYYYYMMDD(shifted);
}

function finYearStart(dateStr) {
    const d = parseLocalDate(dateStr);
    if (!d) return dateStr || '';
    return formatYYYYMMDD(new Date(d.getFullYear(), 0, 1, 12, 0, 0, 0));
}

function finYearEnd(dateStr) {
    const d = parseLocalDate(dateStr);
    if (!d) return dateStr || '';
    return formatYYYYMMDD(new Date(d.getFullYear(), 11, 31, 12, 0, 0, 0));
}

function finMoney(value, decimals = 2) {
    const symbol = typeof getCurrencySymbol === 'function' ? getCurrencySymbol() : '$';
    const n = finToNumber(value, 0);
    const sign = n < 0 ? '-' : '';
    return `${sign}${symbol}${formatAmount(Math.abs(n), decimals)}`;
}

function finMoneyOrDash(value, decimals = 2) {
    return value == null || !Number.isFinite(finToNumber(value, NaN)) ? '—' : finMoney(value, decimals);
}

function finNumberOrDash(value, decimals = 2) {
    return value == null || !Number.isFinite(finToNumber(value, NaN)) ? '—' : formatAmount(value, decimals);
}

function finPctLabel(value, decimals = 0) {
    if (value == null || !Number.isFinite(finToNumber(value, NaN))) return '—';
    return `${formatAmount(finToNumber(value, 0) * 100, decimals)}%`;
}

function finSignedPctLabel(value, decimals = 0) {
    if (value == null || !Number.isFinite(finToNumber(value, NaN))) return '—';
    const n = finToNumber(value, 0);
    return `${n > 0 ? '+' : ''}${formatAmount(n * 100, decimals)}%`;
}

function finDateLabel(dateStr) {
    const d = parseLocalDate(dateStr);
    if (!d) return dateStr || '—';
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

function finShortDateLabel(dateStr) {
    const d = parseLocalDate(dateStr);
    if (!d) return dateStr || '';
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

function finTrim(value) {
    return String(value ?? '').trim();
}

function finKey(value) {
    return finTrim(value).toLowerCase();
}

function finToneClass(tone) {
    if (tone === 'good') return 'fin-tone-good';
    if (tone === 'warn') return 'fin-tone-warn';
    if (tone === 'bad') return 'fin-tone-bad';
    return 'fin-tone-neutral';
}

function finAllSubstancesId() {
    return typeof DASHBOARD_ALL !== 'undefined' ? DASHBOARD_ALL : 'all';
}

function financialIsAllSubstances(substanceId) {
    const id = finTrim(substanceId);
    return !id || id === finAllSubstancesId();
}

function financialMatchesSubstance(recordSubstanceId, selectedId, data = appData) {
    if (financialIsAllSubstances(selectedId)) return true;
    if (!recordSubstanceId) return false;
    if (typeof recoveryDashboardMatchesSubstance === 'function') {
        return recoveryDashboardMatchesSubstance(recordSubstanceId, selectedId, data);
    }
    return String(recordSubstanceId) === String(selectedId);
}

function financialSubstanceLabel(substanceId, data = appData) {
    if (financialIsAllSubstances(substanceId)) return 'All substances';
    return typeof getSubstanceDisplayName === 'function'
        ? getSubstanceDisplayName(substanceId, data)
        : String(substanceId);
}

// ——— Financial Analytics: preferences ———

function getDefaultFinancialAnalyticsFilters() {
    return {
        substanceId: finAllSubstancesId(),
        productType: '',
        store: '',
        supplier: '',
        paymentMethod: '',
        acquisitionType: '',
        dateRangePreset: 'last-30',
        customStart: '',
        customEnd: ''
    };
}

function getDefaultFinancialAnalyticsPrefs() {
    return {
        thresholds: { nearLimit: 0.75, atLimit: 1 },
        showOnDashboard: true,
        showOnCalendar: true,
        chartGroupBy: 'spend',
        chartGrain: 'daily',
        comparePreset: 'previous-period',
        filtersCollapsed: false,
        displayCollapsed: true,
        // Financial analytics deliberately stays out of the Recovery Score: money spent is
        // not a recovery-quality signal, so this stays off and is never read by the score.
        scoreContributionEnabled: false,
        baselineLookbackDays: 90,
        filters: getDefaultFinancialAnalyticsFilters()
    };
}

function ensureFinancialAnalyticsPrefs(data = appData) {
    if (!data || typeof data !== 'object') return getDefaultFinancialAnalyticsPrefs();
    if (!data.settings || typeof data.settings !== 'object') data.settings = {};
    const defaults = getDefaultFinancialAnalyticsPrefs();
    const current = data.settings.financialAnalytics;
    if (!current || typeof current !== 'object' || Array.isArray(current)) {
        data.settings.financialAnalytics = {
            ...defaults,
            thresholds: { ...defaults.thresholds },
            filters: { ...defaults.filters }
        };
    }
    const prefs = data.settings.financialAnalytics;
    Object.keys(defaults).forEach(key => {
        if (prefs[key] === undefined) {
            prefs[key] = (key === 'thresholds' || key === 'filters')
                ? { ...defaults[key] }
                : defaults[key];
        }
    });

    if (!prefs.thresholds || typeof prefs.thresholds !== 'object') prefs.thresholds = { ...defaults.thresholds };
    const near = finToNumber(prefs.thresholds.nearLimit, NaN);
    const at = finToNumber(prefs.thresholds.atLimit, NaN);
    prefs.thresholds.nearLimit = Number.isFinite(near) && near > 0 && near <= 1 ? near : defaults.thresholds.nearLimit;
    prefs.thresholds.atLimit = Number.isFinite(at) && at > 0 ? at : defaults.thresholds.atLimit;
    if (prefs.thresholds.nearLimit > prefs.thresholds.atLimit) prefs.thresholds.nearLimit = defaults.thresholds.nearLimit;

    if (!prefs.filters || typeof prefs.filters !== 'object' || Array.isArray(prefs.filters)) {
        prefs.filters = { ...defaults.filters };
    }
    Object.keys(defaults.filters).forEach(key => {
        if (prefs.filters[key] === undefined) prefs.filters[key] = defaults.filters[key];
    });
    if (!FINANCIAL_DATE_PRESETS.some(p => p.id === prefs.filters.dateRangePreset)) {
        prefs.filters.dateRangePreset = defaults.filters.dateRangePreset;
    }
    if (!FINANCIAL_CHART_GROUP_BYS.some(g => g.id === prefs.chartGroupBy)) prefs.chartGroupBy = defaults.chartGroupBy;
    if (!FINANCIAL_CHART_GRAINS.includes(prefs.chartGrain)) prefs.chartGrain = defaults.chartGrain;
    if (!FINANCIAL_COMPARE_PRESETS.some(c => c.id === prefs.comparePreset)) prefs.comparePreset = defaults.comparePreset;
    prefs.baselineLookbackDays = Math.max(7, Math.round(finToNumber(prefs.baselineLookbackDays, defaults.baselineLookbackDays)));
    prefs.scoreContributionEnabled = false;
    return prefs;
}

function getFinancialAnalyticsPrefs(data = appData) {
    return ensureFinancialAnalyticsPrefs(data);
}

function persistFinancialAnalyticsPrefs(patch = {}, data = appData) {
    const prefs = ensureFinancialAnalyticsPrefs(data);
    const { thresholds, filters, ...rest } = patch || {};
    Object.assign(prefs, rest);
    if (thresholds) prefs.thresholds = { ...prefs.thresholds, ...thresholds };
    if (filters) prefs.filters = { ...prefs.filters, ...filters };
    ensureFinancialAnalyticsPrefs(data);
    invalidateFinancialAnalyticsCache();
    saveData(data);
    return prefs;
}

// ——— Financial Analytics: budgets storage ———

function ensureBudgets(data = appData) {
    if (!data || typeof data !== 'object') return [];
    if (!Array.isArray(data.budgets)) data.budgets = [];
    return data.budgets;
}

function getDefaultBudgetRecord() {
    const today = finToday();
    return {
        id: '',
        name: '',
        period: 'monthly',
        amount: 0,
        substanceId: finAllSubstancesId(),
        productType: '',
        store: '',
        supplier: '',
        startDate: today,
        endDate: '',
        status: 'active',
        notes: '',
        createdAt: '',
        updatedAt: '',
        needsReview: false
    };
}

function financialGenerateId(prefix = 'budget') {
    return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

function normalizeBudgetRecord(raw = {}, data = appData) {
    const defaults = getDefaultBudgetRecord();
    const nowIso = new Date().toISOString();
    const record = { ...defaults, ...(raw && typeof raw === 'object' ? raw : {}) };
    record.id = finTrim(record.id) || financialGenerateId();
    record.name = finTrim(record.name);
    record.period = FINANCIAL_BUDGET_PERIODS.includes(record.period) ? record.period : 'monthly';
    record.amount = Math.max(0, finToNumber(record.amount, 0));
    record.substanceId = finTrim(record.substanceId) || finAllSubstancesId();
    record.productType = finTrim(record.productType);
    record.store = finTrim(record.store);
    record.supplier = finTrim(record.supplier);
    record.startDate = /^\d{4}-\d{2}-\d{2}$/.test(finTrim(record.startDate)) ? finTrim(record.startDate) : defaults.startDate;
    record.endDate = /^\d{4}-\d{2}-\d{2}$/.test(finTrim(record.endDate)) ? finTrim(record.endDate) : '';
    record.status = FINANCIAL_BUDGET_STATUSES.includes(record.status) ? record.status : 'active';
    record.notes = finTrim(record.notes);
    record.createdAt = record.createdAt || nowIso;
    record.updatedAt = record.updatedAt || nowIso;
    if (!record.name) {
        record.name = `${FINANCIAL_BUDGET_PERIOD_LABELS[record.period]} · ${financialSubstanceLabel(record.substanceId, data)}`;
    }
    record.needsReview = !!record.needsReview || validateBudgetRecord(record, data).length > 0;
    return record;
}

function validateBudgetRecord(record = {}, data = appData) {
    const errors = [];
    if (!finTrim(record.name)) errors.push('Give the budget a name.');
    if (!FINANCIAL_BUDGET_PERIODS.includes(record.period)) errors.push('Pick a budget period.');
    if (!(finToNumber(record.amount, 0) > 0)) errors.push('Budget amount must be greater than zero.');
    if (!/^\d{4}-\d{2}-\d{2}$/.test(finTrim(record.startDate))) errors.push('Start date is required.');
    if (record.endDate && finTrim(record.endDate) < finTrim(record.startDate)) errors.push('End date cannot be before the start date.');
    if (!financialIsAllSubstances(record.substanceId) && typeof getSubstance === 'function' && !getSubstance(record.substanceId, data)) {
        errors.push('The substance for this budget no longer exists.');
    }
    return errors;
}

function getBudgets(data = appData, { includeArchived = false, includePaused = true, substanceId = null } = {}) {
    ensureBudgets(data);
    return (data.budgets || [])
        .filter(Boolean)
        .filter(b => (includeArchived || b.status !== 'archived'))
        .filter(b => (includePaused || b.status === 'active'))
        .filter(b => substanceId == null
            || financialIsAllSubstances(substanceId)
            || financialIsAllSubstances(b.substanceId)
            || financialMatchesSubstance(b.substanceId, substanceId, data))
        .sort((a, b) => finTrim(a.name).localeCompare(finTrim(b.name)));
}

function getBudgetById(budgetId, data = appData) {
    ensureBudgets(data);
    if (!budgetId) return null;
    return (data.budgets || []).find(b => b && String(b.id) === String(budgetId)) || null;
}

function migrateFinancialAnalytics(data = appData) {
    if (!data || typeof data !== 'object') return { budgets: 0, needsReview: 0, prefs: false };
    ensureFinancialAnalyticsPrefs(data);
    ensureBudgets(data);
    let needsReview = 0;
    data.budgets = (data.budgets || []).filter(b => b && typeof b === 'object').map(raw => {
        const normalized = normalizeBudgetRecord(raw, data);
        const errors = validateBudgetRecord(normalized, data);
        normalized.needsReview = errors.length > 0;
        if (normalized.needsReview) {
            normalized.reviewReason = errors.join(' ');
            needsReview += 1;
        } else if (normalized.reviewReason) {
            delete normalized.reviewReason;
        }
        return normalized;
    });
    invalidateFinancialAnalyticsCache();
    return { budgets: data.budgets.length, needsReview, prefs: true };
}

// ——— Financial Analytics: date range resolution ———

function financialFiltersFrom(prefsOrFilters = null, data = appData) {
    const defaults = getDefaultFinancialAnalyticsFilters();
    if (!prefsOrFilters || typeof prefsOrFilters !== 'object') {
        return { ...defaults, ...(getFinancialAnalyticsPrefs(data).filters || {}) };
    }
    if (prefsOrFilters.filters && typeof prefsOrFilters.filters === 'object') {
        return { ...defaults, ...prefsOrFilters.filters };
    }
    return { ...defaults, ...prefsOrFilters };
}

function financialEarliestDate(data = appData) {
    let earliest = '';
    (data?.purchases || []).forEach(p => {
        const d = getPurchaseDateStr(p);
        if (d && (!earliest || d < earliest)) earliest = d;
    });
    (data?.logs || []).forEach(l => {
        const d = getLogDateStr(l);
        if (d && (!earliest || d < earliest)) earliest = d;
    });
    return earliest || finToday();
}

function resolveFinancialBounds(prefsOrFilters = null, data = appData) {
    const filters = financialFiltersFrom(prefsOrFilters, data);
    const today = finToday();
    const preset = FINANCIAL_DATE_PRESETS.some(p => p.id === filters.dateRangePreset)
        ? filters.dateRangePreset
        : 'last-30';
    const presetLabel = FINANCIAL_DATE_PRESETS.find(p => p.id === preset)?.label || 'Range';

    let startDate = today;
    let naturalEnd = today;

    switch (preset) {
        case 'today':
            startDate = today; naturalEnd = today; break;
        case 'yesterday':
            startDate = finAddDays(today, -1); naturalEnd = startDate; break;
        case 'last-7':
            startDate = finAddDays(today, -6); naturalEnd = today; break;
        case 'last-30':
            startDate = finAddDays(today, -29); naturalEnd = today; break;
        case 'this-week':
            startDate = getWeekStartDateStr(today); naturalEnd = finAddDays(startDate, 6); break;
        case 'last-week':
            startDate = finAddDays(getWeekStartDateStr(today), -7); naturalEnd = finAddDays(startDate, 6); break;
        case 'this-month':
            startDate = getMonthStartDateStr(today); naturalEnd = getMonthEndDateStr(today); break;
        case 'last-month': {
            const prevMonthAnchor = finAddDays(getMonthStartDateStr(today), -1);
            startDate = getMonthStartDateStr(prevMonthAnchor);
            naturalEnd = getMonthEndDateStr(prevMonthAnchor);
            break;
        }
        case 'past-3-months':
            startDate = finAddDays(finAddMonths(today, -3), 1); naturalEnd = today; break;
        case 'past-6-months':
            startDate = finAddDays(finAddMonths(today, -6), 1); naturalEnd = today; break;
        case 'past-12-months':
            startDate = finAddDays(finAddMonths(today, -12), 1); naturalEnd = today; break;
        case 'this-year':
            startDate = finYearStart(today); naturalEnd = finYearEnd(today); break;
        case 'last-year': {
            const lastYearAnchor = finAddDays(finYearStart(today), -1);
            startDate = finYearStart(lastYearAnchor);
            naturalEnd = finYearEnd(lastYearAnchor);
            break;
        }
        case 'all-time':
            startDate = financialEarliestDate(data); naturalEnd = today; break;
        case 'custom': {
            const cs = finTrim(filters.customStart);
            const ce = finTrim(filters.customEnd);
            startDate = /^\d{4}-\d{2}-\d{2}$/.test(cs) ? cs : finAddDays(today, -29);
            naturalEnd = /^\d{4}-\d{2}-\d{2}$/.test(ce) ? ce : today;
            break;
        }
        default:
            startDate = finAddDays(today, -29); naturalEnd = today; break;
    }

    if (startDate > naturalEnd) {
        const swap = startDate; startDate = naturalEnd; naturalEnd = swap;
    }
    const endDate = naturalEnd > today ? today : naturalEnd;
    const incomplete = naturalEnd >= today;
    const days = finDaysBetween(startDate, endDate);
    const label = preset === 'custom'
        ? `${finDateLabel(startDate)} – ${finDateLabel(endDate)}`
        : presetLabel;

    return {
        preset,
        startDate,
        endDate,
        naturalEndDate: naturalEnd,
        days,
        label,
        rangeLabel: `${finDateLabel(startDate)} – ${finDateLabel(endDate)}`,
        incomplete,
        incompleteLabel: incomplete ? 'In progress — this period has not finished yet.' : ''
    };
}

function resolveFinancialPreviousBounds(bounds) {
    if (!bounds || !bounds.startDate || !bounds.endDate) return null;
    const days = finDaysBetween(bounds.startDate, bounds.endDate);
    const endDate = finAddDays(bounds.startDate, -1);
    const startDate = finAddDays(endDate, -(days - 1));
    return {
        preset: 'previous-period',
        startDate,
        endDate,
        naturalEndDate: endDate,
        days,
        label: `Previous ${days} day${days === 1 ? '' : 's'}`,
        rangeLabel: `${finDateLabel(startDate)} – ${finDateLabel(endDate)}`,
        incomplete: false,
        incompleteLabel: ''
    };
}

function financialPeriodBoundsFor(period, dateStr = finToday()) {
    const anchor = /^\d{4}-\d{2}-\d{2}$/.test(finTrim(dateStr)) ? finTrim(dateStr) : finToday();
    if (period === 'daily') {
        return { startDate: anchor, endDate: anchor, label: finDateLabel(anchor) };
    }
    if (period === 'weekly') {
        const start = getWeekStartDateStr(anchor);
        const end = finAddDays(start, 6);
        return { startDate: start, endDate: end, label: `Week of ${finShortDateLabel(start)}` };
    }
    if (period === 'yearly') {
        const start = finYearStart(anchor);
        return { startDate: start, endDate: finYearEnd(anchor), label: start.slice(0, 4) };
    }
    const start = getMonthStartDateStr(anchor);
    const end = getMonthEndDateStr(anchor);
    const parsed = parseLocalDate(start);
    return {
        startDate: start,
        endDate: end,
        label: parsed ? parsed.toLocaleDateString('en-US', { month: 'long', year: 'numeric' }) : start
    };
}

// ——— Financial Analytics: purchase field accessors ———

function financialPurchaseStore(purchase) {
    return finTrim(purchase?.store || purchase?.location || '');
}

// Supplier is not a stored field. It is the store when present, otherwise whoever the
// record says the item came from. Nothing is written back onto the purchase.
function financialPurchaseSupplier(purchase) {
    const store = financialPurchaseStore(purchase);
    if (store) return store;
    const giftSource = typeof getPurchaseGiftSource === 'function' ? finTrim(getPurchaseGiftSource(purchase)) : '';
    return giftSource || finTrim(purchase?.dealer || purchase?.contact || '');
}

function financialPurchasePaymentMethod(purchase) {
    return finTrim(purchase?.paymentMethod || '');
}

function financialPurchaseProductType(purchase, data = appData) {
    if (!purchase) return '';
    const substanceId = getPurchaseSubstanceId(purchase);
    if (typeof isWeedTrackingMode === 'function' && isWeedTrackingMode(substanceId, data)) {
        return typeof normalizeWeedProductType === 'function'
            ? normalizeWeedProductType(purchase.weedProductType, { allowEmpty: true })
            : finTrim(purchase.weedProductType);
    }
    return finTrim(purchase.nicotineProductType || purchase.productType || '');
}

function financialProductTypeLabel(type, purchase = null, data = appData) {
    const value = finTrim(type);
    if (!value) return 'Unspecified';
    const substanceId = purchase ? getPurchaseSubstanceId(purchase) : '';
    if (substanceId && typeof isWeedTrackingMode === 'function' && isWeedTrackingMode(substanceId, data)
        && typeof getWeedProductTypeLabel === 'function') {
        return getWeedProductTypeLabel(value);
    }
    return value.charAt(0).toUpperCase() + value.slice(1).replace(/[-_]/g, ' ');
}

function financialPurchaseQuantity(purchase) {
    const raw = typeof getPurchaseQuantity === 'function' ? getPurchaseQuantity(purchase) : purchase?.quantity;
    const qty = finToNumber(raw, 0);
    if (qty > 0) return qty;
    return Math.max(0, finToNumber(purchase?.quantityBought, 0));
}

function financialPurchaseUnit(purchase, data = appData) {
    const unit = finTrim(purchase?.unit);
    if (unit) return unit;
    const substanceId = getPurchaseSubstanceId(purchase);
    return typeof getSubstanceDisplayUnit === 'function' ? getSubstanceDisplayUnit(substanceId, data) : 'units';
}

function financialPurchaseCostPerUnit(purchase) {
    const qty = financialPurchaseQuantity(purchase);
    const cost = getPurchaseSpendAmount(purchase);
    if (qty > 0 && cost > 0) return cost / qty;
    const stored = finToNumber(purchase?.costPerUnit, 0);
    return stored > 0 ? stored : null;
}

function financialPurchaseTimeOfDay(purchase) {
    const time = finTrim(purchase?.time);
    const match = /^(\d{1,2}):(\d{2})/.exec(time);
    if (!match) return { key: 'unknown', label: 'Unknown time' };
    const hour = Number(match[1]);
    if (!Number.isFinite(hour)) return { key: 'unknown', label: 'Unknown time' };
    if (hour < 6) return { key: 'late-night', label: 'Late night (12am–6am)' };
    if (hour < 12) return { key: 'morning', label: 'Morning (6am–12pm)' };
    if (hour < 17) return { key: 'afternoon', label: 'Afternoon (12pm–5pm)' };
    if (hour < 21) return { key: 'evening', label: 'Evening (5pm–9pm)' };
    return { key: 'night', label: 'Night (9pm–12am)' };
}

function financialPurchaseWeekday(purchase) {
    const d = parseLocalDate(getPurchaseDateStr(purchase));
    if (!d) return { key: 'unknown', label: 'Unknown day', index: 7 };
    return { key: String(d.getDay()), label: FINANCIAL_WEEKDAY_LABELS[d.getDay()], index: d.getDay() };
}

function financialCountsTowardSpend(purchase) {
    if (!purchase) return false;
    if (typeof purchaseCountsTowardSpend === 'function') return purchaseCountsTowardSpend(purchase);
    if (typeof purchaseCountsAsBuySpend === 'function') return purchaseCountsAsBuySpend(purchase);
    return getPurchaseAcquisitionType(purchase) === 'purchased';
}

// ——— Financial Analytics: core engine ———

function normalizeFinancialFilters(prefsOrFilters = null, data = appData) {
    const filters = financialFiltersFrom(prefsOrFilters, data);
    const hasExplicitRange = /^\d{4}-\d{2}-\d{2}$/.test(finTrim(filters.startDate))
        && /^\d{4}-\d{2}-\d{2}$/.test(finTrim(filters.endDate));
    const bounds = hasExplicitRange
        ? {
            preset: filters.dateRangePreset || 'custom',
            startDate: finTrim(filters.startDate),
            endDate: finTrim(filters.endDate),
            naturalEndDate: finTrim(filters.endDate),
            days: finDaysBetween(filters.startDate, filters.endDate),
            label: `${finDateLabel(filters.startDate)} – ${finDateLabel(filters.endDate)}`,
            rangeLabel: `${finDateLabel(filters.startDate)} – ${finDateLabel(filters.endDate)}`,
            incomplete: finTrim(filters.endDate) >= finToday(),
            incompleteLabel: ''
        }
        : resolveFinancialBounds(filters, data);
    return { ...filters, ...bounds, bounds };
}

function getFinancialPurchases(filters = null, data = appData) {
    const f = normalizeFinancialFilters(filters, data);
    const wantStore = finKey(f.store);
    const wantSupplier = finKey(f.supplier);
    const wantPayment = finKey(f.paymentMethod);
    const wantProduct = finKey(f.productType);
    const wantAcquisition = finKey(f.acquisitionType);

    return (data?.purchases || []).filter(p => {
        if (!p) return false;
        // Spend-counting only: purchased + purchased-as-gift. Gifts received and free
        // adjustments never enter financial analytics.
        if (!financialCountsTowardSpend(p)) return false;

        const dateStr = getPurchaseDateStr(p);
        if (!dateStr || dateStr < f.startDate || dateStr > f.endDate) return false;
        if (!financialMatchesSubstance(getPurchaseSubstanceId(p), f.substanceId, data)) return false;
        if (wantProduct && finKey(financialPurchaseProductType(p, data)) !== wantProduct) return false;
        if (wantStore && finKey(financialPurchaseStore(p)) !== wantStore) return false;
        if (wantSupplier && finKey(financialPurchaseSupplier(p)) !== wantSupplier) return false;
        if (wantPayment && finKey(financialPurchasePaymentMethod(p)) !== wantPayment) return false;
        if (wantAcquisition && finKey(getPurchaseAcquisitionType(p)) !== wantAcquisition) return false;
        return true;
    }).sort((a, b) => {
        const da = getPurchaseDateStr(a);
        const db = getPurchaseDateStr(b);
        if (da === db) return finTrim(a.time).localeCompare(finTrim(b.time));
        return da < db ? -1 : 1;
    });
}

function sumFinancialSpend(purchases) {
    return finRound(finSum((purchases || []).map(p => getPurchaseSpendAmount(p))), 2);
}

function getFinancialUseLogs(filters = null, data = appData) {
    const f = normalizeFinancialFilters(filters, data);
    return (data?.logs || []).filter(l => {
        if (!l || l.isDistributedChild) return false;
        if (typeof logCountsTowardPersonalUseStats === 'function' && !logCountsTowardPersonalUseStats(l)) return false;
        const dateStr = getLogDateStr(l);
        if (!dateStr || dateStr < f.startDate || dateStr > f.endDate) return false;
        return financialMatchesSubstance(getUseSubstanceId(l), f.substanceId, data);
    });
}

function financialPersonalUseTotal(filters, data = appData) {
    const f = normalizeFinancialFilters(filters, data);
    if (!financialIsAllSubstances(f.substanceId)) {
        const amount = typeof getCanonicalUsageInRange === 'function'
            ? getCanonicalUsageInRange(f.substanceId, f.startDate, f.endDate, data)
            : 0;
        return { amount: finToNumber(amount, 0), mixedUnits: false, unit: getSubstanceDisplayUnit(f.substanceId, data) };
    }
    // Summing across substances would mix grams with puffs with tabs, so it is not reported.
    return { amount: null, mixedUnits: true, unit: '' };
}

function financialLongestNoPurchaseStreak(purchases, bounds) {
    const dates = [...new Set((purchases || []).map(p => getPurchaseDateStr(p)).filter(Boolean))].sort();
    if (!bounds?.startDate || !bounds?.endDate) return { days: 0, startDate: '', endDate: '' };
    if (!dates.length) {
        return {
            days: finDaysBetween(bounds.startDate, bounds.endDate),
            startDate: bounds.startDate,
            endDate: bounds.endDate
        };
    }
    let best = { days: 0, startDate: '', endDate: '' };
    const consider = (from, to) => {
        if (!from || !to || from > to) return;
        const days = finDaysBetween(from, to);
        if (days > best.days) best = { days, startDate: from, endDate: to };
    };
    consider(bounds.startDate, finAddDays(dates[0], -1));
    for (let i = 1; i < dates.length; i += 1) {
        consider(finAddDays(dates[i - 1], 1), finAddDays(dates[i], -1));
    }
    consider(finAddDays(dates[dates.length - 1], 1), bounds.endDate);
    return best;
}

function buildFinancialCoreMetrics(purchases = [], bounds = null, data = appData, filters = null) {
    const f = normalizeFinancialFilters(filters || bounds || null, data);
    const range = bounds && bounds.startDate ? bounds : f.bounds;
    const list = purchases || [];
    const costs = list.map(p => getPurchaseSpendAmount(p)).filter(c => c > 0);
    const totalSpent = finRound(finSum(list.map(p => getPurchaseSpendAmount(p))), 2);
    const purchaseCount = list.length;
    const days = Math.max(1, finDaysBetween(range.startDate, range.endDate));

    const quantities = list.map(p => financialPurchaseQuantity(p));
    const totalQuantity = finSum(quantities);
    const perUnitValues = list.map(p => financialPurchaseCostPerUnit(p)).filter(v => v != null && v > 0);
    const units = new Set(list.map(p => finKey(financialPurchaseUnit(p, data))).filter(Boolean));
    const substanceIds = new Set(list.map(p => getPurchaseSubstanceId(p)).filter(Boolean));
    const mixedUnits = units.size > 1;

    const sortedByCost = [...list].sort((a, b) => getPurchaseSpendAmount(b) - getPurchaseSpendAmount(a));
    const describe = purchase => (purchase ? {
        id: purchase.id,
        date: getPurchaseDateStr(purchase),
        amount: finRound(getPurchaseSpendAmount(purchase), 2),
        substanceId: getPurchaseSubstanceId(purchase),
        substanceName: financialSubstanceLabel(getPurchaseSubstanceId(purchase), data),
        store: financialPurchaseStore(purchase)
    } : null);

    const purchaseDates = [...new Set(list.map(p => getPurchaseDateStr(p)).filter(Boolean))].sort();
    let avgDaysBetweenPurchases = null;
    if (purchaseDates.length > 1) {
        const gaps = [];
        for (let i = 1; i < purchaseDates.length; i += 1) {
            gaps.push(finDaysBetween(purchaseDates[i - 1], purchaseDates[i]) - 1);
        }
        avgDaysBetweenPurchases = finRound(finSum(gaps) / gaps.length, 1);
    }

    const logs = getFinancialUseLogs(f, data);
    const useDays = new Set(logs.map(l => getLogDateStr(l)).filter(Boolean)).size;
    const sessionCount = logs.length;
    const personalUse = financialPersonalUseTotal(f, data);

    const runningMonthlyTotal = (dateStr = finToday()) => {
        const start = getMonthStartDateStr(dateStr);
        return finRound(finSum(list
            .filter(p => {
                const d = getPurchaseDateStr(p);
                return d >= start && d <= dateStr;
            })
            .map(p => getPurchaseSpendAmount(p))), 2);
    };
    const runningYearlyTotal = (dateStr = finToday()) => {
        const start = finYearStart(dateStr);
        return finRound(finSum(list
            .filter(p => {
                const d = getPurchaseDateStr(p);
                return d >= start && d <= dateStr;
            })
            .map(p => getPurchaseSpendAmount(p))), 2);
    };

    return {
        bounds: range,
        days,
        totalSpent,
        purchaseCount,
        avgPurchaseCost: purchaseCount ? finRound(totalSpent / purchaseCount, 2) : null,
        medianPurchaseCost: costs.length ? finRound(finMedian(costs), 2) : null,
        largestPurchase: describe(sortedByCost[0]),
        smallestPurchase: describe(sortedByCost[sortedByCost.length - 1]),
        totalQuantity: finRound(totalQuantity, 3),
        // Simple mean of each purchase's own unit price — every purchase weighs the same.
        avgCostPerUnit: perUnitValues.length ? finRound(finSum(perUnitValues) / perUnitValues.length, 4) : null,
        // Weighted price actually paid: total money divided by total units.
        weightedAvgCostPerUnit: totalQuantity > 0 ? finRound(totalSpent / totalQuantity, 4) : null,
        unitMixed: mixedUnits,
        unitLabel: mixedUnits ? 'mixed units' : ([...units][0] || ''),
        substanceCount: substanceIds.size,
        useDays,
        sessionCount,
        costPerUseDay: useDays ? finRound(totalSpent / useDays, 2) : null,
        costPerSession: sessionCount ? finRound(totalSpent / sessionCount, 2) : null,
        personalUseAmount: personalUse.amount,
        personalUseUnit: personalUse.unit,
        costPerPersonalUseAmount: personalUse.amount ? finRound(totalSpent / personalUse.amount, 2) : null,
        costPerPersonalUseMixed: personalUse.mixedUnits,
        avgDailySpending: finRound(totalSpent / days, 2),
        avgWeeklySpending: finRound((totalSpent / days) * 7, 2),
        avgMonthlySpending: finRound((totalSpent / days) * FINANCIAL_DAYS_PER_MONTH, 2),
        avgDaysBetweenPurchases,
        longestNoPurchaseStreak: financialLongestNoPurchaseStreak(list, range),
        incomplete: !!range.incomplete,
        runningMonthlyTotal,
        runningYearlyTotal
    };
}

// ——— Financial Analytics: substance-native cost metrics ———

function financialWeedQuantities(purchase) {
    const type = typeof normalizeWeedProductType === 'function'
        ? normalizeWeedProductType(purchase.weedProductType, { allowEmpty: true })
        : finTrim(purchase.weedProductType);
    if (type === 'bud') {
        const grams = finToNumber(purchase.budGrams, 0) || financialPurchaseQuantity(purchase);
        return { bucket: 'bud', label: 'Bud', amount: grams, unit: 'g' };
    }
    if (type === 'cart') {
        const carts = finToNumber(purchase.cartCount, 0) || 1;
        const grams = finToNumber(purchase.cartGrams, 0) * carts;
        return { bucket: 'cart', label: 'Carts', amount: carts, unit: 'cart', secondaryAmount: grams, secondaryUnit: 'g' };
    }
    if (type === 'edibles') {
        const count = financialPurchaseQuantity(purchase);
        const mg = finToNumber(purchase.totalThcMg ?? purchase.ediblesMg, 0);
        return { bucket: 'edibles', label: 'Edibles', amount: count, unit: 'edible', secondaryAmount: mg, secondaryUnit: 'mg THC' };
    }
    if (type === 'pre-rolls') {
        const count = finToNumber(purchase.preRollCount, 0) || financialPurchaseQuantity(purchase);
        const grams = finToNumber(purchase.totalPreRollGrams, 0);
        return { bucket: 'pre-rolls', label: 'Pre-rolls', amount: count, unit: 'pre-roll', secondaryAmount: grams, secondaryUnit: 'g' };
    }
    return { bucket: 'unspecified', label: 'Needs review', amount: financialPurchaseQuantity(purchase), unit: 'units' };
}

function financialSubstanceBuckets(purchase, data = appData) {
    const substanceId = getPurchaseSubstanceId(purchase);
    const cost = getPurchaseSpendAmount(purchase);
    const buckets = [];
    const push = (key, label, amount, unit) => {
        if (!(finToNumber(amount, 0) > 0)) return;
        buckets.push({ key, label, amount: finToNumber(amount, 0), unit, cost });
    };

    if (typeof isWeedTrackingMode === 'function' && isWeedTrackingMode(substanceId, data)) {
        const q = financialWeedQuantities(purchase);
        push(q.bucket, q.label, q.amount, q.unit);
        if (q.secondaryAmount) push(`${q.bucket}-secondary`, `${q.label} (${q.secondaryUnit})`, q.secondaryAmount, q.secondaryUnit);
        return buckets;
    }
    if (typeof isNicotineTrackingMode === 'function' && isNicotineTrackingMode(substanceId, data)) {
        const puffs = typeof getVapeStartingPuffsLeft === 'function'
            ? finToNumber(getVapeStartingPuffsLeft(purchase), 0)
            : finToNumber(purchase.fullPuffCount, 0);
        if (puffs > 0) push('puffs', 'Puffs', puffs, 'puff');
        else push('units', 'Units', financialPurchaseQuantity(purchase), financialPurchaseUnit(purchase, data));
        return buckets;
    }
    if (typeof isLsdSubstanceId === 'function' && isLsdSubstanceId(substanceId, data)) {
        const tabs = finToNumber(purchase.quantityTabs, 0) || financialPurchaseQuantity(purchase);
        const ugPerTab = typeof getLsdUgPerTab === 'function' ? finToNumber(getLsdUgPerTab(purchase), 0) : finToNumber(purchase.ugPerTab, 0);
        const totalUg = finToNumber(purchase.totalUg, 0) || (tabs * ugPerTab);
        push('tabs', 'Tabs', tabs, 'tab');
        push('ug', 'Micrograms', totalUg, 'ug');
        return buckets;
    }
    if (typeof isXanaxSubstanceId === 'function' && isXanaxSubstanceId(substanceId, data)) {
        const pills = typeof getXanaxPillQuantity === 'function'
            ? finToNumber(getXanaxPillQuantity(purchase), 0) || financialPurchaseQuantity(purchase)
            : financialPurchaseQuantity(purchase);
        const totalMg = typeof getXanaxTotalMg === 'function' ? finToNumber(getXanaxTotalMg(purchase), 0) : 0;
        push('pills', 'Pills', pills, 'pill');
        push('mg', 'Milligrams', totalMg, 'mg');
        return buckets;
    }
    const unit = financialPurchaseUnit(purchase, data);
    const mode = typeof getSubstanceTrackingMode === 'function' ? getSubstanceTrackingMode(substanceId, data) : '';
    const label = mode === 'powder'
        ? (finKey(unit) === 'g' || finKey(unit) === 'grams' ? 'Grams' : 'Weight')
        : mode === 'dose' ? 'Doses' : 'Units';
    push('units', label, financialPurchaseQuantity(purchase), unit);
    return buckets;
}

function buildSubstanceCostMetrics(filters = null, purchases = null, data = appData) {
    const f = normalizeFinancialFilters(filters, data);
    const list = purchases || getFinancialPurchases(f, data);
    const bySubstance = new Map();

    list.forEach(p => {
        const substanceId = getPurchaseSubstanceId(p) || 'unknown';
        if (!bySubstance.has(substanceId)) {
            bySubstance.set(substanceId, {
                substanceId,
                name: financialSubstanceLabel(substanceId, data),
                total: 0,
                count: 0,
                buckets: new Map()
            });
        }
        const entry = bySubstance.get(substanceId);
        entry.total += getPurchaseSpendAmount(p);
        entry.count += 1;
        financialSubstanceBuckets(p, data).forEach(bucket => {
            if (!entry.buckets.has(bucket.key)) {
                entry.buckets.set(bucket.key, { label: bucket.label, unit: bucket.unit, amount: 0, cost: 0 });
            }
            const b = entry.buckets.get(bucket.key);
            b.amount += bucket.amount;
            // Secondary buckets share the purchase cost; they answer "cost per mg" style
            // questions and are never summed together with the primary bucket.
            b.cost += bucket.cost;
        });
    });

    return [...bySubstance.values()]
        .sort((a, b) => b.total - a.total)
        .map(entry => {
            const lines = [
                { label: 'Total spent', value: finMoney(entry.total) },
                { label: 'Purchases', value: String(entry.count) },
                { label: 'Average purchase', value: entry.count ? finMoney(entry.total / entry.count) : '—' }
            ];
            [...entry.buckets.entries()].forEach(([, bucket]) => {
                if (!(bucket.amount > 0)) return;
                lines.push({
                    label: `${bucket.label} bought`,
                    value: `${formatAmount(bucket.amount, 3)} ${bucket.unit}`
                });
                lines.push({
                    label: `Weighted cost per ${bucket.unit}`,
                    value: finMoney(bucket.cost / bucket.amount, 4)
                });
            });
            return {
                substanceId: entry.substanceId,
                name: entry.name,
                total: finRound(entry.total, 2),
                count: entry.count,
                lines
            };
        });
}

// ——— Financial Analytics: time series ———

function financialGrainKey(dateStr, grain) {
    if (grain === 'weekly') return getWeekStartDateStr(dateStr);
    if (grain === 'monthly') return getMonthStartDateStr(dateStr);
    if (grain === 'yearly') return finYearStart(dateStr);
    return dateStr;
}

function financialGrainLabel(keyStr, grain) {
    const d = parseLocalDate(keyStr);
    if (!d) return keyStr;
    if (grain === 'weekly') return `Wk ${finShortDateLabel(keyStr)}`;
    if (grain === 'monthly') return d.toLocaleDateString('en-US', { month: 'short', year: '2-digit' });
    if (grain === 'yearly') return String(d.getFullYear());
    return finShortDateLabel(keyStr);
}

function financialGrainForBounds(bounds) {
    const days = finDaysBetween(bounds?.startDate, bounds?.endDate);
    if (days > 400) return 'monthly';
    if (days > 120) return 'monthly';
    if (days > 45) return 'weekly';
    return 'daily';
}

function buildFinancialTimeSeries(purchases = [], bounds = null, groupBy = 'spend', grain = null) {
    const range = bounds && bounds.startDate ? bounds : resolveFinancialBounds(null, appData);
    const effectiveGrain = FINANCIAL_CHART_GRAINS.includes(grain) ? grain : financialGrainForBounds(range);
    const list = purchases || [];

    const dailySpend = new Map();
    const dailyCount = new Map();
    const dailyQty = new Map();
    list.forEach(p => {
        const d = getPurchaseDateStr(p);
        if (!d) return;
        dailySpend.set(d, finToNumber(dailySpend.get(d), 0) + getPurchaseSpendAmount(p));
        dailyCount.set(d, finToNumber(dailyCount.get(d), 0) + 1);
        dailyQty.set(d, finToNumber(dailyQty.get(d), 0) + financialPurchaseQuantity(p));
    });

    const allDates = typeof iterateDatesInRange === 'function'
        ? iterateDatesInRange(range.startDate, range.endDate)
        : [];

    const rollingWindowSum = (dateStr, windowDays) => {
        const from = finAddDays(dateStr, -(windowDays - 1));
        let total = 0;
        dailySpend.forEach((value, key) => {
            if (key >= from && key <= dateStr) total += value;
        });
        return total;
    };

    let points = [];
    if (groupBy === 'rolling7' || groupBy === 'rolling30') {
        const windowDays = groupBy === 'rolling7' ? 7 : 30;
        points = allDates.map(dateStr => ({
            key: dateStr,
            date: dateStr,
            label: finShortDateLabel(dateStr),
            value: finRound(rollingWindowSum(dateStr, windowDays), 2)
        }));
    } else if (groupBy === 'runningMonthly' || groupBy === 'runningYearly') {
        let currentBucket = '';
        let running = 0;
        points = allDates.map(dateStr => {
            const bucket = groupBy === 'runningMonthly' ? getMonthStartDateStr(dateStr) : finYearStart(dateStr);
            if (bucket !== currentBucket) {
                currentBucket = bucket;
                running = 0;
            }
            running += finToNumber(dailySpend.get(dateStr), 0);
            return { key: dateStr, date: dateStr, label: finShortDateLabel(dateStr), value: finRound(running, 2) };
        });
    } else {
        const grouped = new Map();
        allDates.forEach(dateStr => {
            const key = financialGrainKey(dateStr, effectiveGrain);
            if (!grouped.has(key)) grouped.set(key, { key, date: key, spend: 0, count: 0, qty: 0 });
            const bucket = grouped.get(key);
            bucket.spend += finToNumber(dailySpend.get(dateStr), 0);
            bucket.count += finToNumber(dailyCount.get(dateStr), 0);
            bucket.qty += finToNumber(dailyQty.get(dateStr), 0);
        });
        points = [...grouped.values()].map(bucket => {
            let value = bucket.spend;
            if (groupBy === 'count') value = bucket.count;
            else if (groupBy === 'avgCost') value = bucket.count ? bucket.spend / bucket.count : 0;
            else if (groupBy === 'avgCostPerUnit') value = bucket.qty > 0 ? bucket.spend / bucket.qty : 0;
            return {
                key: bucket.key,
                date: bucket.date,
                label: financialGrainLabel(bucket.key, effectiveGrain),
                value: finRound(value, groupBy === 'count' ? 0 : 2),
                spend: finRound(bucket.spend, 2),
                count: bucket.count,
                quantity: finRound(bucket.qty, 3)
            };
        });
    }

    const values = points.map(p => finToNumber(p.value, 0));
    const kind = groupBy === 'count' ? 'count' : 'currency';
    return {
        groupBy,
        grain: effectiveGrain,
        kind,
        points,
        max: values.length ? Math.max(...values) : 0,
        total: finRound(finSum(values), 2),
        label: FINANCIAL_CHART_GROUP_BYS.find(g => g.id === groupBy)?.label || 'Spending',
        incomplete: !!range.incomplete
    };
}

// ——— Financial Analytics: period comparison ———

function financialComparisonBoundsFor(preset, currentBounds) {
    const days = finDaysBetween(currentBounds.startDate, currentBounds.endDate);
    if (preset === 'same-period-last-year') {
        const startDate = finAddMonths(currentBounds.startDate, -12);
        return {
            startDate,
            endDate: finAddDays(startDate, days - 1),
            label: 'Same period last year'
        };
    }
    if (preset === 'previous-week') {
        const start = finAddDays(getWeekStartDateStr(currentBounds.endDate), -7);
        return { startDate: start, endDate: finAddDays(start, 6), label: 'Previous week' };
    }
    if (preset === 'previous-month') {
        const anchor = finAddDays(getMonthStartDateStr(currentBounds.endDate), -1);
        return { startDate: getMonthStartDateStr(anchor), endDate: getMonthEndDateStr(anchor), label: 'Previous month' };
    }
    if (preset === 'previous-year') {
        const anchor = finAddDays(finYearStart(currentBounds.endDate), -1);
        return { startDate: finYearStart(anchor), endDate: finYearEnd(anchor), label: 'Previous year' };
    }
    const previous = resolveFinancialPreviousBounds(currentBounds);
    return previous
        ? { startDate: previous.startDate, endDate: previous.endDate, label: previous.label }
        : { startDate: currentBounds.startDate, endDate: currentBounds.endDate, label: 'Previous period' };
}

function buildFinancialPeriodComparison(currentBounds = null, purchasesAll = null, data = appData, filters = null) {
    const f = normalizeFinancialFilters(filters, data);
    const bounds = currentBounds && currentBounds.startDate ? currentBounds : f.bounds;
    const prefs = getFinancialAnalyticsPrefs(data);
    const preset = FINANCIAL_COMPARE_PRESETS.some(c => c.id === prefs.comparePreset) ? prefs.comparePreset : 'previous-period';

    const currentPurchases = purchasesAll
        ? purchasesAll.filter(p => {
            const d = getPurchaseDateStr(p);
            return d >= bounds.startDate && d <= bounds.endDate;
        })
        : getFinancialPurchases({ ...f, startDate: bounds.startDate, endDate: bounds.endDate }, data);

    const rows = FINANCIAL_COMPARE_PRESETS.map(option => {
        const cmp = financialComparisonBoundsFor(option.id, bounds);
        if (option.id === 'baseline-average') {
            const historyAll = getFinancialPurchases(
                { ...f, dateRangePreset: 'all-time', startDate: '', endDate: '' },
                data
            ).filter(p => getPurchaseDateStr(p) < bounds.startDate);
            const historyDays = historyAll.length
                ? Math.max(1, finDaysBetween(getPurchaseDateStr(historyAll[0]), finAddDays(bounds.startDate, -1)))
                : 0;
            const dailyRate = historyDays ? sumFinancialSpend(historyAll) / historyDays : null;
            const expected = dailyRate == null ? null : dailyRate * finDaysBetween(bounds.startDate, bounds.endDate);
            const currentTotal = sumFinancialSpend(currentPurchases);
            return {
                id: option.id,
                label: option.label,
                periodLabel: historyDays ? `${historyDays} days of history` : 'No prior history',
                currentTotal,
                previousTotal: expected == null ? null : finRound(expected, 2),
                delta: expected == null ? null : finRound(currentTotal - expected, 2),
                deltaPct: expected ? finRound((currentTotal - expected) / expected, 4) : null,
                currentCount: currentPurchases.length,
                previousCount: null,
                estimate: true
            };
        }
        const previousPurchases = getFinancialPurchases({ ...f, startDate: cmp.startDate, endDate: cmp.endDate }, data);
        const currentTotal = sumFinancialSpend(currentPurchases);
        const previousTotal = sumFinancialSpend(previousPurchases);
        return {
            id: option.id,
            label: option.label,
            periodLabel: `${finDateLabel(cmp.startDate)} – ${finDateLabel(cmp.endDate)}`,
            startDate: cmp.startDate,
            endDate: cmp.endDate,
            currentTotal,
            previousTotal,
            delta: finRound(currentTotal - previousTotal, 2),
            deltaPct: previousTotal ? finRound((currentTotal - previousTotal) / previousTotal, 4) : null,
            currentCount: currentPurchases.length,
            previousCount: previousPurchases.length,
            currentAvg: currentPurchases.length ? finRound(currentTotal / currentPurchases.length, 2) : null,
            previousAvg: previousPurchases.length ? finRound(previousTotal / previousPurchases.length, 2) : null,
            estimate: false
        };
    });

    return {
        preset,
        bounds,
        selected: rows.find(r => r.id === preset) || rows[0] || null,
        rows,
        incomplete: !!bounds.incomplete,
        note: bounds.incomplete
            ? 'The current period is still running, so comparisons against finished periods are partial.'
            : ''
    };
}

// ——— Financial Analytics: budgets engine ———

function financialBudgetPurchases(budget, periodBounds, data = appData) {
    const budgetFilters = {
        substanceId: budget.substanceId,
        productType: budget.productType,
        store: budget.store,
        supplier: budget.supplier,
        paymentMethod: '',
        acquisitionType: '',
        startDate: periodBounds.startDate,
        endDate: periodBounds.endDate
    };
    return getFinancialPurchases(budgetFilters, data);
}

function financialBudgetPeriodBounds(budget, data = appData) {
    const today = finToday();
    let anchor = today;
    if (budget.startDate && today < budget.startDate) anchor = budget.startDate;
    if (budget.endDate && today > budget.endDate) anchor = budget.endDate;
    const period = financialPeriodBoundsFor(budget.period, anchor);
    const startDate = budget.startDate && period.startDate < budget.startDate ? budget.startDate : period.startDate;
    const endDate = budget.endDate && period.endDate > budget.endDate ? budget.endDate : period.endDate;
    return { ...period, startDate, endDate };
}

function evaluateBudgets(data = appData, filters = null) {
    ensureBudgets(data);
    const prefs = getFinancialAnalyticsPrefs(data);
    const f = normalizeFinancialFilters(filters, data);
    const today = finToday();

    return getBudgets(data, { includeArchived: true, substanceId: f.substanceId }).map(budget => {
        const period = financialBudgetPeriodBounds(budget, data);
        const purchases = financialBudgetPurchases(budget, period, data);
        const spent = sumFinancialSpend(purchases);
        const amount = finToNumber(budget.amount, 0);
        const pct = amount > 0 ? spent / amount : null;
        const daysTotal = Math.max(1, finDaysBetween(period.startDate, period.endDate));
        const clampedToday = today < period.startDate ? period.startDate : (today > period.endDate ? period.endDate : today);
        const daysElapsed = Math.max(1, finDaysBetween(period.startDate, clampedToday));
        const periodActive = today >= period.startDate && today <= period.endDate;
        const projectedFinal = periodActive
            ? finRound((spent / daysElapsed) * daysTotal, 2)
            : spent;

        let status = 'on_track';
        if (budget.status === 'paused') status = 'paused';
        else if (budget.status === 'archived') status = 'archived';
        else if (budget.startDate && today < budget.startDate) status = 'not_started';
        else if (budget.endDate && today > budget.endDate) status = 'ended';
        else if (pct == null) status = 'on_track';
        else if (pct > prefs.thresholds.atLimit) status = 'over_budget';
        else if (pct >= prefs.thresholds.atLimit) status = 'at_limit';
        else if (pct >= prefs.thresholds.nearLimit) status = 'near_limit';

        const meta = FINANCIAL_BUDGET_STATE_META[status] || FINANCIAL_BUDGET_STATE_META.on_track;
        return {
            budget,
            period,
            periodActive,
            spent,
            amount,
            remaining: finRound(amount - spent, 2),
            pct: pct == null ? null : finRound(pct, 4),
            projectedFinal,
            projectedPct: amount > 0 ? finRound(projectedFinal / amount, 4) : null,
            projectionIsEstimate: true,
            daysElapsed,
            daysTotal,
            daysRemaining: Math.max(0, daysTotal - daysElapsed),
            purchaseCount: purchases.length,
            dailyAllowanceLeft: periodActive && daysTotal > daysElapsed
                ? finRound(Math.max(0, amount - spent) / (daysTotal - daysElapsed + 1), 2)
                : null,
            status,
            statusLabel: meta.label,
            tone: meta.tone,
            needsReview: !!budget.needsReview
        };
    });
}

// ——— Financial Analytics: savings ———

function buildFinancialSavings(bounds = null, purchases = null, data = appData, filters = null) {
    const f = normalizeFinancialFilters(filters, data);
    const range = bounds && bounds.startDate ? bounds : f.bounds;
    const list = purchases || getFinancialPurchases({ ...f, startDate: range.startDate, endDate: range.endDate }, data);
    const prefs = getFinancialAnalyticsPrefs(data);
    const currentTotal = sumFinancialSpend(list);
    const days = Math.max(1, finDaysBetween(range.startDate, range.endDate));

    const previousBounds = resolveFinancialPreviousBounds(range);
    const previousPurchases = previousBounds
        ? getFinancialPurchases({ ...f, startDate: previousBounds.startDate, endDate: previousBounds.endDate }, data)
        : [];
    const previousTotal = sumFinancialSpend(previousPurchases);

    const baselineStart = finAddDays(range.startDate, -prefs.baselineLookbackDays);
    const baselineEnd = finAddDays(range.startDate, -1);
    const baselinePurchases = getFinancialPurchases({ ...f, startDate: baselineStart, endDate: baselineEnd }, data);
    const baselineDays = Math.max(1, finDaysBetween(baselineStart, baselineEnd));
    const baselineTotal = sumFinancialSpend(baselinePurchases);
    const baselineDaily = baselinePurchases.length ? baselineTotal / baselineDays : null;
    const baselineExpected = baselineDaily == null ? null : finRound(baselineDaily * days, 2);

    const planSavings = [];
    if (typeof ensureTaperPlansV2 === 'function') ensureTaperPlansV2(data);
    (data?.taperPlansV2 || []).forEach(plan => {
        if (!plan || plan.status === 'archived') return;
        if (!financialMatchesSubstance(plan.substanceId, f.substanceId, data)) return;
        const planStart = finTrim(plan.startDate);
        if (!planStart) return;
        const preStart = finAddDays(planStart, -30);
        const preEnd = finAddDays(planStart, -1);
        const prePurchases = getFinancialPurchases({ ...f, substanceId: plan.substanceId, startDate: preStart, endDate: preEnd }, data);
        if (!prePurchases.length) return;
        const preDaily = sumFinancialSpend(prePurchases) / Math.max(1, finDaysBetween(preStart, preEnd));
        const sincePurchases = getFinancialPurchases({ ...f, substanceId: plan.substanceId, startDate: planStart, endDate: range.endDate }, data);
        const sinceDays = Math.max(1, finDaysBetween(planStart, range.endDate));
        const expected = preDaily * sinceDays;
        planSavings.push({
            planId: plan.id,
            name: plan.name || financialSubstanceLabel(plan.substanceId, data),
            expected: finRound(expected, 2),
            actual: sumFinancialSpend(sincePurchases),
            saved: finRound(expected - sumFinancialSpend(sincePurchases), 2),
            estimate: true
        });
    });

    const goalSavings = [];
    if (typeof evaluateAllGoals === 'function') {
        try {
            evaluateAllGoals({ data, persist: false })
                .filter(ev => ev?.goal?.category === 'spending' && ev.goal.status === 'active')
                .filter(ev => financialMatchesSubstance(ev.goal.substanceId, f.substanceId, data))
                .forEach(ev => {
                    const target = finToNumber(ev.target, 0);
                    const actual = finToNumber(ev.actual, 0);
                    if (!(target > 0)) return;
                    goalSavings.push({
                        goalId: ev.goal.id,
                        name: ev.goal.name,
                        target: finRound(target, 2),
                        actual: finRound(actual, 2),
                        saved: finRound(target - actual, 2),
                        statusLabel: ev.statusLabel || ev.status,
                        estimate: false
                    });
                });
        } catch (_) { /* goals are optional */ }
    }

    return {
        bounds: range,
        currentTotal,
        vsPrevious: {
            label: previousBounds ? previousBounds.label : 'Previous period',
            periodLabel: previousBounds ? previousBounds.rangeLabel : '',
            previousTotal,
            delta: finRound(currentTotal - previousTotal, 2),
            saved: finRound(previousTotal - currentTotal, 2),
            deltaPct: previousTotal ? finRound((currentTotal - previousTotal) / previousTotal, 4) : null,
            hasData: previousPurchases.length > 0
        },
        vsBaseline: {
            label: `Prior ${prefs.baselineLookbackDays}-day baseline`,
            periodLabel: `${finDateLabel(baselineStart)} – ${finDateLabel(baselineEnd)}`,
            baselineDailyRate: baselineDaily == null ? null : finRound(baselineDaily, 2),
            expected: baselineExpected,
            saved: baselineExpected == null ? null : finRound(baselineExpected - currentTotal, 2),
            hasData: baselinePurchases.length > 0,
            estimate: true
        },
        estimatedCostAvoided: baselineExpected == null
            ? null
            : {
                amount: finRound(Math.max(0, baselineExpected - currentTotal), 2),
                basis: `Assumes you would have kept spending ${finMoney(baselineDaily || 0)} per day.`,
                estimate: true
            },
        planSavings,
        goalSavings,
        estimateNote: `${FINANCIAL_ESTIMATE_LABEL}: avoided-cost figures assume past spending would have continued unchanged.`
    };
}

// ——— Financial Analytics: forecast ———

function buildFinancialForecast(purchases = [], bounds = null, budgets = null, data = appData) {
    const range = bounds && bounds.startDate ? bounds : resolveFinancialBounds(null, data);
    const list = (purchases || []).slice().sort((a, b) => (getPurchaseDateStr(a) < getPurchaseDateStr(b) ? -1 : 1));
    const dates = list.map(p => getPurchaseDateStr(p)).filter(Boolean);
    const spanDays = dates.length ? finDaysBetween(dates[0], dates[dates.length - 1]) : 0;

    if (list.length < 3 || spanDays < 7) {
        return {
            status: 'insufficient_data',
            reason: list.length < 3
                ? 'Needs at least 3 spend-counting purchases before projecting.'
                : 'Needs at least 7 days between the first and last purchase before projecting.',
            purchaseCount: list.length,
            spanDays,
            estimate: true
        };
    }

    const total = sumFinancialSpend(list);
    const windowDays = Math.max(spanDays, finDaysBetween(range.startDate, range.endDate));
    const dailyRate = total / Math.max(1, windowDays);
    const costs = list.map(p => getPurchaseSpendAmount(p));
    const variability = finDivide(finStdDev(costs), finSum(costs) / costs.length);

    const gaps = [];
    for (let i = 1; i < dates.length; i += 1) gaps.push(finDaysBetween(dates[i - 1], dates[i]) - 1);
    const avgGap = gaps.length ? finSum(gaps) / gaps.length : null;
    const lastDate = dates[dates.length - 1];
    const expectedNextPurchaseDate = avgGap == null ? null : finAddDays(lastDate, Math.max(1, Math.round(avgGap + 1)));

    const evaluations = budgets || [];
    const budgetRisk = evaluations
        .filter(ev => ev.status !== 'archived' && ev.status !== 'paused' && ev.amount > 0)
        .map(ev => {
            const ratio = finToNumber(ev.projectedPct, 0);
            const probability = Math.max(0, Math.min(1, (ratio - 0.8) / 0.4));
            return {
                budgetId: ev.budget.id,
                name: ev.budget.name,
                projectedFinal: ev.projectedFinal,
                amount: ev.amount,
                probability: finRound(probability, 2),
                label: probability >= 0.75 ? 'Likely' : probability >= 0.4 ? 'Possible' : 'Unlikely'
            };
        })
        .sort((a, b) => b.probability - a.probability);

    const confidence = list.length >= 12 && (variability == null || variability < 0.6)
        ? 'high'
        : list.length >= 6 ? 'medium' : 'low';

    return {
        status: 'ok',
        estimate: true,
        purchaseCount: list.length,
        spanDays,
        dailyRate: finRound(dailyRate, 2),
        next7Days: finRound(dailyRate * 7, 2),
        next30Days: finRound(dailyRate * 30, 2),
        monthlyProjection: finRound(dailyRate * FINANCIAL_DAYS_PER_MONTH, 2),
        yearlyProjection: finRound(dailyRate * 365, 2),
        avgDaysBetweenPurchases: avgGap == null ? null : finRound(avgGap, 1),
        expectedNextPurchaseDate,
        lastPurchaseDate: lastDate,
        variability: variability == null ? null : finRound(variability, 2),
        confidence,
        budgetRisk,
        note: `${FINANCIAL_ESTIMATE_LABEL}: projections extend your recent average forward and assume nothing changes.`
    };
}

// ——— Financial Analytics: breakdowns ———

function financialBreakdownKeyFor(dimension, purchase, data = appData) {
    switch (dimension) {
        case 'substance': {
            const id = getPurchaseSubstanceId(purchase) || 'unknown';
            return { key: id, label: financialSubstanceLabel(id, data) };
        }
        case 'productType': {
            const type = financialPurchaseProductType(purchase, data);
            return { key: type || 'none', label: financialProductTypeLabel(type, purchase, data) };
        }
        case 'store': {
            const store = financialPurchaseStore(purchase);
            return { key: finKey(store) || 'none', label: store || 'No store recorded' };
        }
        case 'supplier': {
            const supplier = financialPurchaseSupplier(purchase);
            return { key: finKey(supplier) || 'none', label: supplier || 'No supplier recorded' };
        }
        case 'paymentMethod': {
            const method = financialPurchasePaymentMethod(purchase);
            return { key: finKey(method) || 'none', label: method || 'No payment method' };
        }
        case 'acquisitionType': {
            const type = getPurchaseAcquisitionType(purchase);
            return { key: type, label: FINANCIAL_ACQUISITION_LABELS[type] || type };
        }
        case 'weekday': {
            const weekday = financialPurchaseWeekday(purchase);
            return { key: weekday.key, label: weekday.label, sortIndex: weekday.index };
        }
        case 'timeOfDay': {
            const bucket = financialPurchaseTimeOfDay(purchase);
            return { key: bucket.key, label: bucket.label };
        }
        default:
            return { key: 'all', label: 'All' };
    }
}

function financialBreakdownFor(dimension, purchases, previousPurchases, data = appData) {
    const rows = new Map();
    (purchases || []).forEach(p => {
        const { key, label, sortIndex } = financialBreakdownKeyFor(dimension, p, data);
        if (!rows.has(key)) rows.set(key, { key, label, sortIndex, total: 0, count: 0, quantity: 0, previousTotal: 0 });
        const row = rows.get(key);
        row.total += getPurchaseSpendAmount(p);
        row.count += 1;
        row.quantity += financialPurchaseQuantity(p);
    });
    (previousPurchases || []).forEach(p => {
        const { key, label, sortIndex } = financialBreakdownKeyFor(dimension, p, data);
        if (!rows.has(key)) rows.set(key, { key, label, sortIndex, total: 0, count: 0, quantity: 0, previousTotal: 0 });
        rows.get(key).previousTotal += getPurchaseSpendAmount(p);
    });

    const grandTotal = finSum([...rows.values()].map(r => r.total));
    const list = [...rows.values()].map(row => ({
        key: row.key,
        label: row.label,
        total: finRound(row.total, 2),
        count: row.count,
        quantity: finRound(row.quantity, 3),
        avgCost: row.count ? finRound(row.total / row.count, 2) : null,
        weightedCostPerUnit: row.quantity > 0 ? finRound(row.total / row.quantity, 4) : null,
        share: grandTotal > 0 ? finRound(row.total / grandTotal, 4) : null,
        previousTotal: finRound(row.previousTotal, 2),
        delta: finRound(row.total - row.previousTotal, 2),
        deltaPct: row.previousTotal ? finRound((row.total - row.previousTotal) / row.previousTotal, 4) : null,
        sortIndex: row.sortIndex
    }));

    if (dimension === 'weekday') {
        list.sort((a, b) => finToNumber(a.sortIndex, 9) - finToNumber(b.sortIndex, 9));
    } else {
        list.sort((a, b) => b.total - a.total);
    }
    return { dimension, label: FINANCIAL_BREAKDOWN_DIMENSIONS.find(d => d.id === dimension)?.label || dimension, rows: list, total: finRound(grandTotal, 2) };
}

function buildFinancialBreakdowns(purchases = [], previousPurchases = [], data = appData) {
    const result = {};
    FINANCIAL_BREAKDOWN_DIMENSIONS.forEach(dim => {
        result[dim.id] = financialBreakdownFor(dim.id, purchases, previousPurchases, data);
    });
    return result;
}

function buildStoreSupplierAnalytics(purchases = [], data = appData) {
    const build = (accessor, emptyLabel) => {
        const map = new Map();
        (purchases || []).forEach(p => {
            const raw = accessor(p);
            const key = finKey(raw) || 'none';
            if (!map.has(key)) {
                map.set(key, {
                    key,
                    label: raw || emptyLabel,
                    total: 0,
                    count: 0,
                    quantity: 0,
                    dates: [],
                    units: new Set(),
                    substances: new Set()
                });
            }
            const entry = map.get(key);
            entry.total += getPurchaseSpendAmount(p);
            entry.count += 1;
            entry.quantity += financialPurchaseQuantity(p);
            const d = getPurchaseDateStr(p);
            if (d) entry.dates.push(d);
            entry.units.add(finKey(financialPurchaseUnit(p, data)));
            entry.substances.add(getPurchaseSubstanceId(p));
        });
        const grandTotal = finSum([...map.values()].map(e => e.total));
        return [...map.values()].map(entry => {
            const dates = entry.dates.slice().sort();
            let avgDaysBetween = null;
            if (dates.length > 1) {
                const gaps = [];
                for (let i = 1; i < dates.length; i += 1) gaps.push(finDaysBetween(dates[i - 1], dates[i]) - 1);
                avgDaysBetween = finRound(finSum(gaps) / gaps.length, 1);
            }
            return {
                key: entry.key,
                label: entry.label,
                total: finRound(entry.total, 2),
                count: entry.count,
                quantity: finRound(entry.quantity, 3),
                avgCost: entry.count ? finRound(entry.total / entry.count, 2) : null,
                weightedCostPerUnit: entry.quantity > 0 ? finRound(entry.total / entry.quantity, 4) : null,
                mixedUnits: entry.units.size > 1,
                substanceCount: entry.substances.size,
                firstDate: dates[0] || '',
                lastDate: dates[dates.length - 1] || '',
                avgDaysBetween,
                share: grandTotal > 0 ? finRound(entry.total / grandTotal, 4) : null
            };
        }).sort((a, b) => b.total - a.total);
    };

    const stores = build(p => financialPurchaseStore(p), 'No store recorded');
    const suppliers = build(p => financialPurchaseSupplier(p), 'No supplier recorded');

    // Cheapest unit price is only meaningful inside one substance and one unit.
    const valueBySubstance = new Map();
    (purchases || []).forEach(p => {
        const cpu = financialPurchaseCostPerUnit(p);
        if (cpu == null || !(cpu > 0)) return;
        const substanceId = getPurchaseSubstanceId(p);
        const unit = finKey(financialPurchaseUnit(p, data));
        const storeLabel = financialPurchaseStore(p) || financialPurchaseSupplier(p) || 'No store recorded';
        const key = `${substanceId}|${unit}|${finKey(storeLabel)}`;
        if (!valueBySubstance.has(key)) {
            valueBySubstance.set(key, {
                substanceId,
                substanceName: financialSubstanceLabel(substanceId, data),
                unit: financialPurchaseUnit(p, data),
                store: storeLabel,
                cost: 0,
                quantity: 0
            });
        }
        const entry = valueBySubstance.get(key);
        entry.cost += getPurchaseSpendAmount(p);
        entry.quantity += financialPurchaseQuantity(p);
    });
    const bestValue = [...valueBySubstance.values()]
        .filter(e => e.quantity > 0)
        .map(e => ({ ...e, costPerUnit: finRound(e.cost / e.quantity, 4) }))
        .sort((a, b) => a.costPerUnit - b.costPerUnit);

    const bestValueBySubstance = [];
    const seen = new Set();
    bestValue.forEach(entry => {
        const key = `${entry.substanceId}|${finKey(entry.unit)}`;
        if (seen.has(key)) return;
        seen.add(key);
        bestValueBySubstance.push(entry);
    });

    return {
        stores,
        suppliers,
        bestValueBySubstance,
        topStore: stores[0] || null,
        topSupplier: suppliers[0] || null
    };
}

function buildPaymentMethodAnalytics(purchases = []) {
    const map = new Map();
    (purchases || []).forEach(p => {
        const raw = financialPurchasePaymentMethod(p);
        const key = finKey(raw) || 'none';
        if (!map.has(key)) map.set(key, { key, label: raw || 'No payment method', total: 0, count: 0, largest: 0, dates: [] });
        const entry = map.get(key);
        const amount = getPurchaseSpendAmount(p);
        entry.total += amount;
        entry.count += 1;
        entry.largest = Math.max(entry.largest, amount);
        const d = getPurchaseDateStr(p);
        if (d) entry.dates.push(d);
    });
    const grandTotal = finSum([...map.values()].map(e => e.total));
    const rows = [...map.values()].map(entry => {
        const dates = entry.dates.slice().sort();
        return {
            key: entry.key,
            label: entry.label,
            total: finRound(entry.total, 2),
            count: entry.count,
            avgCost: entry.count ? finRound(entry.total / entry.count, 2) : null,
            largest: finRound(entry.largest, 2),
            share: grandTotal > 0 ? finRound(entry.total / grandTotal, 4) : null,
            lastUsed: dates[dates.length - 1] || ''
        };
    }).sort((a, b) => b.total - a.total);
    return {
        rows,
        total: finRound(grandTotal, 2),
        untracked: rows.find(r => r.key === 'none') || null,
        primary: rows.find(r => r.key !== 'none') || null
    };
}

// ——— Financial Analytics: data quality ———

function scanFinancialDataQuality(data = appData, { purchases = null, mutate = false } = {}) {
    const list = purchases || (data?.purchases || []).filter(p => financialCountsTowardSpend(p));
    const costs = list.map(p => getPurchaseSpendAmount(p)).filter(c => c > 0);
    const medianCpu = finMedian(list.map(p => financialPurchaseCostPerUnit(p)).filter(v => v != null && v > 0));
    const issues = [];

    list.forEach(p => {
        const purchaseIssues = [];
        const cost = getPurchaseSpendAmount(p);
        const qty = financialPurchaseQuantity(p);
        const cpu = financialPurchaseCostPerUnit(p);

        if (!(cost > 0)) {
            purchaseIssues.push({
                code: 'missingCost',
                severity: 'medium',
                message: `Purchase on ${finDateLabel(getPurchaseDateStr(p))} has no cost recorded, so it is worth ${finMoney(0)} in these totals.`
            });
        }
        if (!(qty > 0)) {
            purchaseIssues.push({
                code: 'missingQuantity',
                severity: 'low',
                message: `Purchase on ${finDateLabel(getPurchaseDateStr(p))} has no quantity, so it cannot contribute to cost-per-unit.`
            });
        }
        if (cpu != null && medianCpu > 0 && (cpu > medianCpu * 10 || cpu < medianCpu / 10)) {
            purchaseIssues.push({
                code: 'invalidCostPerUnit',
                severity: 'low',
                message: `Unit price ${finMoney(cpu, 4)} on ${finDateLabel(getPurchaseDateStr(p))} is far from your typical ${finMoney(medianCpu, 4)}.`
            });
        }

        purchaseIssues.forEach(issue => issues.push({
            ...issue,
            purchaseId: p.id,
            date: getPurchaseDateStr(p),
            substanceId: getPurchaseSubstanceId(p)
        }));

        if (mutate) {
            if (purchaseIssues.length) {
                p.needsReview = true;
                p.reviewReason = purchaseIssues.map(i => i.message).join(' ');
            } else if (p.reviewReason) {
                p.needsReview = false;
                delete p.reviewReason;
            }
        }
    });

    if (mutate) {
        invalidateFinancialAnalyticsCache();
        saveData(data);
    }

    return {
        issues,
        counts: {
            total: issues.length,
            missingCost: issues.filter(i => i.code === 'missingCost').length,
            missingQuantity: issues.filter(i => i.code === 'missingQuantity').length,
            invalidCostPerUnit: issues.filter(i => i.code === 'invalidCostPerUnit').length
        },
        purchasesScanned: list.length,
        medianCostPerUnit: medianCpu || null,
        medianCost: costs.length ? finRound(finMedian(costs), 2) : null
    };
}

// ——— Financial Analytics: dataset orchestration ———

let financialAnalyticsDatasetCache = null;
let financialAnalyticsDatasetCacheKey = null;

function invalidateFinancialAnalyticsCache() {
    financialAnalyticsDatasetCache = null;
    financialAnalyticsDatasetCacheKey = null;
}

function financialDatasetCacheKey(data, filters, prefs) {
    return JSON.stringify({
        purchases: (data?.purchases || []).length,
        logs: (data?.logs || []).length,
        budgets: (data?.budgets || []).length,
        goals: (data?.goals || []).length,
        plans: (data?.taperPlansV2 || []).length,
        lastSaved: data?.lastSaved || '',
        filters: {
            substanceId: filters.substanceId,
            productType: filters.productType,
            store: filters.store,
            supplier: filters.supplier,
            paymentMethod: filters.paymentMethod,
            acquisitionType: filters.acquisitionType,
            startDate: filters.startDate,
            endDate: filters.endDate,
            preset: filters.dateRangePreset
        },
        prefs: {
            comparePreset: prefs.comparePreset,
            chartGroupBy: prefs.chartGroupBy,
            chartGrain: prefs.chartGrain,
            thresholds: prefs.thresholds,
            baselineLookbackDays: prefs.baselineLookbackDays
        }
    });
}

function buildFinancialDataset(data = appData, options = {}) {
    const { filters = null, useCache = true } = options;
    const prefs = getFinancialAnalyticsPrefs(data);
    ensureBudgets(data);
    const normalized = normalizeFinancialFilters(filters, data);
    const bounds = normalized.bounds;

    const cacheKey = financialDatasetCacheKey(data, normalized, prefs);
    if (useCache && financialAnalyticsDatasetCache && financialAnalyticsDatasetCacheKey === cacheKey) {
        return financialAnalyticsDatasetCache;
    }

    const purchases = getFinancialPurchases(normalized, data);
    const previousBounds = resolveFinancialPreviousBounds(bounds);
    const previousPurchases = previousBounds
        ? getFinancialPurchases({ ...normalized, startDate: previousBounds.startDate, endDate: previousBounds.endDate }, data)
        : [];

    const metrics = buildFinancialCoreMetrics(purchases, bounds, data, normalized);
    const budgetEvaluations = evaluateBudgets(data, normalized);
    const dataset = {
        generatedAt: new Date().toISOString(),
        prefs,
        filters: normalized,
        bounds,
        previousBounds,
        purchases,
        previousPurchases,
        metrics,
        substanceMetrics: buildSubstanceCostMetrics(normalized, purchases, data),
        timeSeries: buildFinancialTimeSeries(purchases, bounds, prefs.chartGroupBy, prefs.chartGrain),
        comparison: buildFinancialPeriodComparison(bounds, purchases, data, normalized),
        budgets: budgetEvaluations,
        savings: buildFinancialSavings(bounds, purchases, data, normalized),
        forecast: buildFinancialForecast(purchases, bounds, budgetEvaluations, data),
        breakdowns: buildFinancialBreakdowns(purchases, previousPurchases, data),
        storeSupplier: buildStoreSupplierAnalytics(purchases, data),
        payments: buildPaymentMethodAnalytics(purchases),
        dataQuality: scanFinancialDataQuality(data, { purchases }),
        isEmpty: purchases.length === 0
    };

    financialAnalyticsDatasetCache = dataset;
    financialAnalyticsDatasetCacheKey = cacheKey;
    return dataset;
}

// ——— Financial Analytics: calendar ———

// Purchases already reach the calendar through the purchase mapper, so this only adds
// budget and spending-goal markers on top of them.
function mapFinancialCalendarEvents(bounds = null, data = appData) {
    const prefs = getFinancialAnalyticsPrefs(data);
    if (!prefs.showOnCalendar) return [];
    if (typeof makeCalendarEvent !== 'function') return [];
    const range = bounds && bounds.startDate ? bounds : resolveFinancialBounds(null, data);
    const events = [];

    evaluateBudgets(data, { substanceId: finAllSubstancesId() }).forEach(ev => {
        if (ev.status !== 'near_limit' && ev.status !== 'at_limit' && ev.status !== 'over_budget') return;
        const markerDate = ev.period.endDate < range.startDate || ev.period.endDate > range.endDate
            ? (finToday() >= range.startDate && finToday() <= range.endDate ? finToday() : null)
            : ev.period.endDate;
        if (!markerDate) return;
        const exceeded = ev.status === 'over_budget';
        events.push(makeCalendarEvent({
            id: `fin-budget-${ev.budget.id}-${markerDate}`,
            type: 'note',
            date: markerDate,
            label: exceeded ? 'Budget exceeded' : 'Budget warning',
            title: `${ev.budget.name}: ${finMoney(ev.spent)} of ${finMoney(ev.amount)}`,
            status: ev.status,
            substanceId: financialIsAllSubstances(ev.budget.substanceId) ? null : ev.budget.substanceId,
            substanceName: financialSubstanceLabel(ev.budget.substanceId, data),
            cost: ev.spent,
            notes: `${ev.statusLabel} · ${ev.period.label}`,
            recordKind: 'budget',
            recordId: ev.budget.id,
            searchable: `budget ${ev.budget.name} ${ev.statusLabel}`
        }));
    });

    const streakPurchases = (data?.purchases || []).filter(p => financialCountsTowardSpend(p));
    const lastPurchaseDate = streakPurchases
        .map(p => getPurchaseDateStr(p))
        .filter(Boolean)
        .sort()
        .pop();
    if (lastPurchaseDate) {
        FINANCIAL_NO_PURCHASE_MILESTONES.forEach(days => {
            const milestoneDate = finAddDays(lastPurchaseDate, days);
            if (milestoneDate < range.startDate || milestoneDate > range.endDate) return;
            if (milestoneDate > finToday()) return;
            events.push(makeCalendarEvent({
                id: `fin-nopurchase-${days}-${milestoneDate}`,
                type: 'recovery_milestone',
                date: milestoneDate,
                label: `${days} days no purchase`,
                title: `${days} days without buying`,
                notes: `Last purchase ${finDateLabel(lastPurchaseDate)}.`,
                recordKind: 'financial_milestone',
                recordId: `fin-nopurchase-${days}`,
                searchable: `no purchase streak ${days} days`
            }));
        });
    }

    if (typeof evaluateAllGoals === 'function') {
        try {
            evaluateAllGoals({ data, persist: false })
                .filter(ev => ev?.goal?.category === 'spending')
                .filter(ev => ev.status === 'completed' || ev.goal.status === 'completed')
                .forEach(ev => {
                    const date = finTrim(ev.goal.completedDate || ev.goal.endDate || ev.bounds?.periodEnd);
                    if (!date || date < range.startDate || date > range.endDate) return;
                    events.push(makeCalendarEvent({
                        id: `fin-goal-done-${ev.goal.id}-${date}`,
                        type: 'goal_completion',
                        date,
                        label: 'Spending target met',
                        title: ev.goal.name,
                        substanceId: financialIsAllSubstances(ev.goal.substanceId) ? null : ev.goal.substanceId,
                        linkedGoalId: ev.goal.id,
                        recordKind: 'goal',
                        recordId: ev.goal.id,
                        searchable: `spending goal ${ev.goal.name}`
                    }));
                });
        } catch (_) { /* goals are optional */ }
    }

    return events;
}

// ——— Financial Analytics: dashboard summary ———

function buildDashboardFinancialSummary(data = appData, substanceId = null) {
    const prefs = getFinancialAnalyticsPrefs(data);
    const selected = substanceId == null ? finAllSubstancesId() : substanceId;
    const monthFilters = {
        ...getDefaultFinancialAnalyticsFilters(),
        substanceId: selected,
        dateRangePreset: 'this-month'
    };
    const monthBounds = resolveFinancialBounds(monthFilters, data);
    const monthPurchases = getFinancialPurchases({ ...monthFilters, startDate: monthBounds.startDate, endDate: monthBounds.endDate }, data);
    const monthSpend = sumFinancialSpend(monthPurchases);

    const lastMonthAnchor = finAddDays(getMonthStartDateStr(finToday()), -1);
    const lastMonthStart = getMonthStartDateStr(lastMonthAnchor);
    const lastMonthEnd = getMonthEndDateStr(lastMonthAnchor);
    const lastMonthSpend = sumFinancialSpend(getFinancialPurchases({ ...monthFilters, startDate: lastMonthStart, endDate: lastMonthEnd }, data));

    const budgets = evaluateBudgets(data, { substanceId: selected }).filter(ev => ev.budget.status === 'active');
    const daysElapsed = Math.max(1, finDaysBetween(monthBounds.startDate, monthBounds.endDate));
    const daysInMonth = Math.max(1, finDaysBetween(monthBounds.startDate, getMonthEndDateStr(finToday())));

    let noPurchaseStreak = null;
    if (typeof computeNoPurchaseStreakDays === 'function') {
        try {
            noPurchaseStreak = computeNoPurchaseStreakDays(financialIsAllSubstances(selected) ? null : selected, data);
        } catch (_) { noPurchaseStreak = null; }
    }

    const stores = buildStoreSupplierAnalytics(monthPurchases, data);

    return {
        show: prefs.showOnDashboard !== false,
        substanceId: selected,
        monthLabel: monthBounds.label,
        monthSpend,
        monthPurchaseCount: monthPurchases.length,
        lastMonthSpend,
        monthDelta: finRound(monthSpend - lastMonthSpend, 2),
        monthDeltaPct: lastMonthSpend ? finRound((monthSpend - lastMonthSpend) / lastMonthSpend, 4) : null,
        projectedMonthSpend: finRound((monthSpend / daysElapsed) * daysInMonth, 2),
        projectionIsEstimate: true,
        avgDailySpend: finRound(monthSpend / daysElapsed, 2),
        budgetCount: budgets.length,
        budgetsOnTrack: budgets.filter(b => b.status === 'on_track').length,
        budgetsNearLimit: budgets.filter(b => b.status === 'near_limit' || b.status === 'at_limit').length,
        budgetsOverBudget: budgets.filter(b => b.status === 'over_budget').length,
        tightestBudget: budgets.slice().sort((a, b) => finToNumber(b.pct, 0) - finToNumber(a.pct, 0))[0] || null,
        topStore: stores.topStore,
        noPurchaseStreakDays: noPurchaseStreak ? noPurchaseStreak.days : null,
        noPurchaseStreakLabel: noPurchaseStreak ? noPurchaseStreak.sinceLabel : '',
        incomplete: !!monthBounds.incomplete
    };
}

// ——— Financial Analytics: CSV export ———

function financialCsvDownload(name, header, rows) {
    const csv = [header, ...rows].map(row => row.map(csvEscape).join(',')).join('\n');
    downloadBlob(new Blob([csv], { type: 'text/csv;charset=utf-8;' }), `${name}-${finToday()}.csv`);
    return rows.length;
}

function exportFinancialAnalyticsCsv(kind = 'summary', data = appData) {
    const dataset = buildFinancialDataset(data, { useCache: true });
    const m = dataset.metrics;

    if (kind === 'purchases') {
        return financialCsvDownload('financial-purchases',
            ['Date', 'Substance', 'Product type', 'Store', 'Supplier', 'Payment method', 'Acquisition', 'Quantity', 'Unit', 'Cost', 'Cost per unit', 'Needs review'],
            dataset.purchases.map(p => [
                getPurchaseDateStr(p),
                financialSubstanceLabel(getPurchaseSubstanceId(p), data),
                financialProductTypeLabel(financialPurchaseProductType(p, data), p, data),
                financialPurchaseStore(p),
                financialPurchaseSupplier(p),
                financialPurchasePaymentMethod(p),
                FINANCIAL_ACQUISITION_LABELS[getPurchaseAcquisitionType(p)] || getPurchaseAcquisitionType(p),
                financialPurchaseQuantity(p),
                financialPurchaseUnit(p, data),
                finRound(getPurchaseSpendAmount(p), 2),
                financialPurchaseCostPerUnit(p) == null ? '' : finRound(financialPurchaseCostPerUnit(p), 4),
                p.needsReview ? 'yes' : 'no'
            ]));
    }

    if (kind === 'budgets') {
        return financialCsvDownload('financial-budgets',
            ['Name', 'Period', 'Amount', 'Substance', 'Product type', 'Store', 'Supplier', 'Period start', 'Period end', 'Spent', 'Remaining', 'Percent used', 'Projected final (estimate)', 'Status', 'Record status', 'Needs review'],
            dataset.budgets.map(ev => [
                ev.budget.name,
                FINANCIAL_BUDGET_PERIOD_LABELS[ev.budget.period] || ev.budget.period,
                ev.amount,
                financialSubstanceLabel(ev.budget.substanceId, data),
                ev.budget.productType,
                ev.budget.store,
                ev.budget.supplier,
                ev.period.startDate,
                ev.period.endDate,
                ev.spent,
                ev.remaining,
                ev.pct == null ? '' : finRound(ev.pct * 100, 1),
                ev.projectedFinal,
                ev.statusLabel,
                ev.budget.status,
                ev.budget.needsReview ? 'yes' : 'no'
            ]));
    }

    if (kind === 'stores') {
        return financialCsvDownload('financial-stores',
            ['Kind', 'Name', 'Total', 'Purchases', 'Average purchase', 'Weighted cost per unit', 'Mixed units', 'First purchase', 'Last purchase', 'Avg days between', 'Share of spend'],
            dataset.storeSupplier.stores.map(s => ['Store', s.label, s.total, s.count, s.avgCost ?? '', s.weightedCostPerUnit ?? '', s.mixedUnits ? 'yes' : 'no', s.firstDate, s.lastDate, s.avgDaysBetween ?? '', s.share == null ? '' : finRound(s.share * 100, 1)])
                .concat(dataset.storeSupplier.suppliers.map(s => ['Supplier', s.label, s.total, s.count, s.avgCost ?? '', s.weightedCostPerUnit ?? '', s.mixedUnits ? 'yes' : 'no', s.firstDate, s.lastDate, s.avgDaysBetween ?? '', s.share == null ? '' : finRound(s.share * 100, 1)])));
    }

    if (kind === 'payments') {
        return financialCsvDownload('financial-payments',
            ['Payment method', 'Total', 'Purchases', 'Average purchase', 'Largest purchase', 'Share of spend', 'Last used'],
            dataset.payments.rows.map(r => [r.label, r.total, r.count, r.avgCost ?? '', r.largest, r.share == null ? '' : finRound(r.share * 100, 1), r.lastUsed]));
    }

    if (kind === 'comparisons') {
        return financialCsvDownload('financial-comparisons',
            ['Comparison', 'Compared period', 'Current total', 'Comparison total', 'Change', 'Change %', 'Current purchases', 'Comparison purchases', 'Estimate'],
            dataset.comparison.rows.map(r => [
                r.label, r.periodLabel, r.currentTotal, r.previousTotal ?? '', r.delta ?? '',
                r.deltaPct == null ? '' : finRound(r.deltaPct * 100, 1),
                r.currentCount, r.previousCount ?? '', r.estimate ? 'yes' : 'no'
            ]));
    }

    if (kind === 'savings') {
        const s = dataset.savings;
        const rows = [
            ['Versus previous period', s.vsPrevious.periodLabel, s.currentTotal, s.vsPrevious.previousTotal, s.vsPrevious.saved, s.vsPrevious.deltaPct == null ? '' : finRound(s.vsPrevious.deltaPct * 100, 1), 'no'],
            ['Versus baseline', s.vsBaseline.periodLabel, s.currentTotal, s.vsBaseline.expected ?? '', s.vsBaseline.saved ?? '', '', 'yes']
        ];
        if (s.estimatedCostAvoided) rows.push(['Estimated cost avoided', s.bounds.rangeLabel, s.currentTotal, '', s.estimatedCostAvoided.amount, '', 'yes']);
        s.planSavings.forEach(p => rows.push([`Plan: ${p.name}`, '', p.actual, p.expected, p.saved, '', 'yes']));
        return financialCsvDownload('financial-savings',
            ['Measure', 'Comparison period', 'Actual', 'Expected', 'Saved', 'Change %', 'Estimate'], rows);
    }

    if (kind === 'forecasts') {
        const f = dataset.forecast;
        if (f.status !== 'ok') {
            return financialCsvDownload('financial-forecast', ['Metric', 'Value', 'Estimate'], [['Status', f.reason, 'yes']]);
        }
        const rows = [
            ['Daily rate', f.dailyRate, 'yes'],
            ['Next 7 days', f.next7Days, 'yes'],
            ['Next 30 days', f.next30Days, 'yes'],
            ['Monthly projection', f.monthlyProjection, 'yes'],
            ['Yearly projection', f.yearlyProjection, 'yes'],
            ['Average days between purchases', f.avgDaysBetweenPurchases ?? '', 'yes'],
            ['Expected next purchase', f.expectedNextPurchaseDate ?? '', 'yes'],
            ['Confidence', f.confidence, 'yes']
        ];
        f.budgetRisk.forEach(r => rows.push([`Budget risk: ${r.name}`, `${finRound(r.probability * 100, 0)}% (${r.label})`, 'yes']));
        return financialCsvDownload('financial-forecast', ['Metric', 'Value', 'Estimate'], rows);
    }

    const rows = [
        ['Range', dataset.bounds.rangeLabel, ''],
        ['Range complete', dataset.bounds.incomplete ? 'no (period in progress)' : 'yes', ''],
        ['Total spent', m.totalSpent, ''],
        ['Purchases', m.purchaseCount, ''],
        ['Average purchase cost', m.avgPurchaseCost ?? '', ''],
        ['Median purchase cost', m.medianPurchaseCost ?? '', ''],
        ['Largest purchase', m.largestPurchase ? m.largestPurchase.amount : '', m.largestPurchase ? m.largestPurchase.date : ''],
        ['Smallest purchase', m.smallestPurchase ? m.smallestPurchase.amount : '', m.smallestPurchase ? m.smallestPurchase.date : ''],
        ['Average cost per unit (simple)', m.avgCostPerUnit ?? '', m.unitMixed ? 'mixed units' : m.unitLabel],
        ['Weighted cost per unit', m.weightedAvgCostPerUnit ?? '', m.unitMixed ? 'mixed units' : m.unitLabel],
        ['Cost per use day', m.costPerUseDay ?? '', ''],
        ['Cost per session', m.costPerSession ?? '', ''],
        ['Cost per unit of personal use', m.costPerPersonalUseAmount ?? '', m.costPerPersonalUseMixed ? 'mixed units' : m.personalUseUnit],
        ['Average daily spending', m.avgDailySpending, ''],
        ['Average weekly spending', m.avgWeeklySpending, ''],
        ['Average monthly spending', m.avgMonthlySpending, ''],
        ['Average days between purchases', m.avgDaysBetweenPurchases ?? '', ''],
        ['Longest no-purchase streak (days)', m.longestNoPurchaseStreak.days, `${m.longestNoPurchaseStreak.startDate} – ${m.longestNoPurchaseStreak.endDate}`]
    ];
    return financialCsvDownload('financial-summary', ['Metric', 'Value', 'Detail'], rows);
}

function exportFinancialSummaryCsv(data = appData) { return exportFinancialAnalyticsCsv('summary', data); }
function exportFinancialPurchasesCsv(data = appData) { return exportFinancialAnalyticsCsv('purchases', data); }
function exportFinancialBudgetsCsv(data = appData) { return exportFinancialAnalyticsCsv('budgets', data); }
function exportFinancialStoresCsv(data = appData) { return exportFinancialAnalyticsCsv('stores', data); }
function exportFinancialPaymentsCsv(data = appData) { return exportFinancialAnalyticsCsv('payments', data); }
function exportFinancialComparisonsCsv(data = appData) { return exportFinancialAnalyticsCsv('comparisons', data); }
function exportFinancialSavingsCsv(data = appData) { return exportFinancialAnalyticsCsv('savings', data); }
function exportFinancialForecastsCsv(data = appData) { return exportFinancialAnalyticsCsv('forecasts', data); }

// ——— Financial Analytics: UI state ———

const financialAnalyticsUiState = {
    budgetFormOpen: false,
    editingBudgetId: null,
    formErrors: [],
    activeBreakdown: 'substance',
    loading: false,
    error: ''
};

// ——— Financial Analytics: UI building blocks ———

function financialCard(label, value, hint = '', tone = 'neutral') {
    return `
        <div class="fin-card ${finToneClass(tone)}">
            <span class="fin-card-label">${escapeHtml(label)}</span>
            <strong class="fin-card-value">${escapeHtml(String(value))}</strong>
            ${hint ? `<span class="fin-card-hint">${escapeHtml(hint)}</span>` : ''}
        </div>`;
}

function renderFinancialBarChart(points, { kind = 'currency', emptyText = 'No spending in this range.' } = {}) {
    const rows = (points || []).filter(Boolean);
    if (!rows.length) return `<p class="fin-empty-inline">${escapeHtml(emptyText)}</p>`;
    const peak = Math.max(...rows.map(r => Math.abs(finToNumber(r.value, 0))), 0);
    const bars = rows.map(row => {
        const value = finToNumber(row.value, 0);
        const pct = peak > 0 ? Math.min(100, Math.round((Math.abs(value) / peak) * 100)) : 0;
        const display = kind === 'count' ? formatAmount(value, 0) : finMoney(value);
        return `
            <div class="fin-chart-row">
                <span class="fin-chart-label">${escapeHtml(row.label ?? '')}</span>
                <span class="fin-chart-track"><span class="fin-chart-fill" style="width:${pct}%"></span></span>
                <span class="fin-chart-value">${escapeHtml(display)}</span>
            </div>`;
    }).join('');
    return `<div class="fin-chart">${bars}</div>`;
}

function financialSelectOptions(values, selected, labelFn = null) {
    return values.map(v => {
        const value = typeof v === 'object' ? v.id : v;
        const label = typeof v === 'object' ? v.label : (labelFn ? labelFn(v) : v);
        return `<option value="${escapeHtml(String(value))}"${String(value) === String(selected) ? ' selected' : ''}>${escapeHtml(String(label))}</option>`;
    }).join('');
}

function financialDistinctValues(data, accessor) {
    const seen = new Map();
    (data?.purchases || []).filter(p => financialCountsTowardSpend(p)).forEach(p => {
        const raw = accessor(p);
        const key = finKey(raw);
        if (!key || seen.has(key)) return;
        seen.set(key, finTrim(raw));
    });
    return [...seen.values()].sort((a, b) => a.localeCompare(b));
}

function renderFinancialFiltersBar(dataset, data = appData) {
    const prefs = dataset.prefs;
    const f = dataset.filters;
    const collapsed = !!prefs.filtersCollapsed;
    const substances = typeof getActiveSubstances === 'function' ? getActiveSubstances(data) : [];
    const productTypes = financialDistinctValues(data, p => financialPurchaseProductType(p, data));
    const stores = financialDistinctValues(data, p => financialPurchaseStore(p));
    const suppliers = financialDistinctValues(data, p => financialPurchaseSupplier(p));
    const payments = financialDistinctValues(data, p => financialPurchasePaymentMethod(p));

    const presetButtons = FINANCIAL_DATE_PRESETS.map(preset => `
        <button type="button" class="fin-preset-btn${f.dateRangePreset === preset.id ? ' is-active' : ''}"
            onclick="setFinancialDatePreset('${escapeHtml(preset.id)}')">${escapeHtml(preset.label)}</button>`).join('');

    return `
        <section class="fin-panel fin-filters${collapsed ? ' is-collapsed' : ''}">
            <header class="fin-panel-head">
                <h3>Filters</h3>
                <div class="fin-panel-head-actions">
                    <span class="fin-range-label">${escapeHtml(dataset.bounds.rangeLabel)}</span>
                    <button type="button" class="btn-small" onclick="toggleFinancialFilters()">${collapsed ? 'Show' : 'Hide'}</button>
                </div>
            </header>
            ${collapsed ? '' : `
            <div class="fin-preset-row">${presetButtons}</div>
            <div class="fin-filter-grid">
                <label class="fin-field">
                    <span>Substance</span>
                    <select id="fin-filter-substance" onchange="onFinancialFilterChange()">
                        <option value="${escapeHtml(finAllSubstancesId())}"${financialIsAllSubstances(f.substanceId) ? ' selected' : ''}>All substances</option>
                        ${substances.map(s => `<option value="${escapeHtml(s.id)}"${String(f.substanceId) === String(s.id) ? ' selected' : ''}>${escapeHtml(getSubstanceDisplayName(s, data))}</option>`).join('')}
                    </select>
                </label>
                <label class="fin-field">
                    <span>Product type</span>
                    <select id="fin-filter-product" onchange="onFinancialFilterChange()">
                        <option value="">Any</option>
                        ${productTypes.map(t => `<option value="${escapeHtml(t)}"${finKey(f.productType) === finKey(t) ? ' selected' : ''}>${escapeHtml(financialProductTypeLabel(t))}</option>`).join('')}
                    </select>
                </label>
                <label class="fin-field">
                    <span>Store</span>
                    <select id="fin-filter-store" onchange="onFinancialFilterChange()">
                        <option value="">Any</option>
                        ${stores.map(s => `<option value="${escapeHtml(s)}"${finKey(f.store) === finKey(s) ? ' selected' : ''}>${escapeHtml(s)}</option>`).join('')}
                    </select>
                </label>
                <label class="fin-field">
                    <span>Supplier</span>
                    <select id="fin-filter-supplier" onchange="onFinancialFilterChange()">
                        <option value="">Any</option>
                        ${suppliers.map(s => `<option value="${escapeHtml(s)}"${finKey(f.supplier) === finKey(s) ? ' selected' : ''}>${escapeHtml(s)}</option>`).join('')}
                    </select>
                </label>
                <label class="fin-field">
                    <span>Payment method</span>
                    <select id="fin-filter-payment" onchange="onFinancialFilterChange()">
                        <option value="">Any</option>
                        ${payments.map(s => `<option value="${escapeHtml(s)}"${finKey(f.paymentMethod) === finKey(s) ? ' selected' : ''}>${escapeHtml(s)}</option>`).join('')}
                    </select>
                </label>
                <label class="fin-field">
                    <span>Acquisition</span>
                    <select id="fin-filter-acquisition" onchange="onFinancialFilterChange()">
                        <option value="">Purchased + purchased as gift</option>
                        <option value="purchased"${f.acquisitionType === 'purchased' ? ' selected' : ''}>Purchased only</option>
                        <option value="purchased_as_gift"${f.acquisitionType === 'purchased_as_gift' ? ' selected' : ''}>Purchased as gift only</option>
                    </select>
                </label>
                <label class="fin-field">
                    <span>Custom start</span>
                    <input type="date" id="fin-filter-start" value="${escapeHtml(f.customStart || '')}" onchange="onFinancialFilterChange()">
                </label>
                <label class="fin-field">
                    <span>Custom end</span>
                    <input type="date" id="fin-filter-end" value="${escapeHtml(f.customEnd || '')}" onchange="onFinancialFilterChange()">
                </label>
            </div>
            <p class="fin-hint">Gifts you received and free adjustments are never counted as spending. Items you purchased as gifts are counted, because you paid for them.</p>`}
        </section>`;
}

function renderFinancialSummaryCards(dataset) {
    const m = dataset.metrics;
    const cards = [
        financialCard('Total spent', finMoney(m.totalSpent), dataset.bounds.rangeLabel),
        financialCard('Purchases', String(m.purchaseCount), m.avgDaysBetweenPurchases == null ? '' : `Every ${formatAmount(m.avgDaysBetweenPurchases, 1)} days on average`),
        financialCard('Average purchase', finMoneyOrDash(m.avgPurchaseCost), m.medianPurchaseCost == null ? '' : `Median ${finMoney(m.medianPurchaseCost)}`),
        financialCard('Largest purchase', m.largestPurchase ? finMoney(m.largestPurchase.amount) : '—', m.largestPurchase ? finDateLabel(m.largestPurchase.date) : ''),
        financialCard('Smallest purchase', m.smallestPurchase ? finMoney(m.smallestPurchase.amount) : '—', m.smallestPurchase ? finDateLabel(m.smallestPurchase.date) : ''),
        financialCard('Weighted cost per unit', m.unitMixed ? 'Mixed units' : finMoneyOrDash(m.weightedAvgCostPerUnit, 4),
            m.unitMixed ? 'Filter to one substance to compare unit prices' : `Total cost ÷ total ${m.unitLabel || 'units'}`),
        financialCard('Average cost per unit', m.unitMixed ? 'Mixed units' : finMoneyOrDash(m.avgCostPerUnit, 4), 'Simple mean of each purchase'),
        financialCard('Cost per use day', finMoneyOrDash(m.costPerUseDay), `${m.useDays} use day${m.useDays === 1 ? '' : 's'} logged`),
        financialCard('Cost per session', finMoneyOrDash(m.costPerSession), `${m.sessionCount} logged session${m.sessionCount === 1 ? '' : 's'}`),
        financialCard('Cost per unit used', m.costPerPersonalUseMixed ? 'Mixed units' : finMoneyOrDash(m.costPerPersonalUseAmount),
            m.costPerPersonalUseMixed ? 'Pick one substance for this number' : `${finNumberOrDash(m.personalUseAmount, 3)} ${m.personalUseUnit} used`),
        financialCard('Average per day', finMoney(m.avgDailySpending), `${finMoney(m.avgWeeklySpending)} per week`),
        financialCard('Average per month', finMoney(m.avgMonthlySpending), 'Scaled from this range'),
        financialCard('Longest no-purchase streak', `${m.longestNoPurchaseStreak.days} day${m.longestNoPurchaseStreak.days === 1 ? '' : 's'}`,
            m.longestNoPurchaseStreak.startDate ? `${finShortDateLabel(m.longestNoPurchaseStreak.startDate)} – ${finShortDateLabel(m.longestNoPurchaseStreak.endDate)}` : '')
    ].join('');

    return `
        <section class="fin-panel">
            <header class="fin-panel-head">
                <h3>Summary</h3>
                ${dataset.bounds.incomplete ? '<span class="fin-badge fin-tone-warn">Period in progress</span>' : ''}
            </header>
            <div class="fin-card-grid">${cards}</div>
        </section>`;
}

function renderFinancialChartPanel(dataset) {
    const series = dataset.timeSeries;
    return `
        <section class="fin-panel">
            <header class="fin-panel-head">
                <h3>Spending over time</h3>
                <div class="fin-panel-head-actions">
                    <label class="fin-inline-field">
                        <span>Measure</span>
                        <select id="fin-chart-groupby" onchange="setFinancialChartGroupBy(this.value)">
                            ${financialSelectOptions(FINANCIAL_CHART_GROUP_BYS, series.groupBy)}
                        </select>
                    </label>
                    <label class="fin-inline-field">
                        <span>Grain</span>
                        <select id="fin-chart-grain" onchange="setFinancialChartGrain(this.value)">
                            ${financialSelectOptions(FINANCIAL_CHART_GRAINS, series.grain, v => v.charAt(0).toUpperCase() + v.slice(1))}
                        </select>
                    </label>
                </div>
            </header>
            ${renderFinancialBarChart(series.points, { kind: series.kind })}
            ${series.incomplete ? '<p class="fin-hint">The final bar covers a period that has not finished yet.</p>' : ''}
        </section>`;
}

function renderFinancialComparisonPanel(dataset) {
    const comparison = dataset.comparison;
    const rows = comparison.rows.map(row => `
        <tr${row.id === comparison.preset ? ' class="is-selected"' : ''}>
            <td>${escapeHtml(row.label)}${row.estimate ? ' <span class="fin-badge fin-tone-neutral">Estimate</span>' : ''}</td>
            <td>${escapeHtml(row.periodLabel)}</td>
            <td>${escapeHtml(finMoney(row.currentTotal))}</td>
            <td>${escapeHtml(finMoneyOrDash(row.previousTotal))}</td>
            <td class="${finToneClass(finToNumber(row.delta, 0) > 0 ? 'bad' : finToNumber(row.delta, 0) < 0 ? 'good' : 'neutral')}">
                ${escapeHtml(finMoneyOrDash(row.delta))} (${escapeHtml(finSignedPctLabel(row.deltaPct))})
            </td>
        </tr>`).join('');

    return `
        <section class="fin-panel">
            <header class="fin-panel-head">
                <h3>Period comparison</h3>
                <label class="fin-inline-field">
                    <span>Default</span>
                    <select id="fin-compare-preset" onchange="setFinancialComparePreset(this.value)">
                        ${financialSelectOptions(FINANCIAL_COMPARE_PRESETS, comparison.preset)}
                    </select>
                </label>
            </header>
            <div class="fin-table-wrap">
                <table class="fin-table">
                    <thead><tr><th>Comparison</th><th>Period</th><th>Now</th><th>Then</th><th>Change</th></tr></thead>
                    <tbody>${rows}</tbody>
                </table>
            </div>
            ${comparison.note ? `<p class="fin-hint">${escapeHtml(comparison.note)}</p>` : ''}
        </section>`;
}

function renderBudgetFormHtml(data = appData) {
    const editing = financialAnalyticsUiState.editingBudgetId
        ? getBudgetById(financialAnalyticsUiState.editingBudgetId, data)
        : null;
    const draft = editing ? { ...editing } : getDefaultBudgetRecord();
    const substances = typeof getActiveSubstances === 'function' ? getActiveSubstances(data) : [];
    const errors = financialAnalyticsUiState.formErrors.length
        ? `<ul class="fin-form-errors" role="alert">${financialAnalyticsUiState.formErrors.map(e => `<li>${escapeHtml(e)}</li>`).join('')}</ul>`
        : '';

    return `
        <form class="fin-budget-form" onsubmit="event.preventDefault(); saveBudget();">
            ${errors}
            <div class="fin-form-grid">
                <label class="fin-field">
                    <span>Name</span>
                    <input type="text" id="fin-budget-name" value="${escapeHtml(draft.name)}" placeholder="Monthly weed budget">
                </label>
                <label class="fin-field">
                    <span>Period</span>
                    <select id="fin-budget-period">
                        ${financialSelectOptions(FINANCIAL_BUDGET_PERIODS, draft.period, v => FINANCIAL_BUDGET_PERIOD_LABELS[v])}
                    </select>
                </label>
                <label class="fin-field">
                    <span>Amount (${escapeHtml(getCurrencySymbol())})</span>
                    <input type="number" id="fin-budget-amount" min="0" step="0.01" value="${draft.amount ? escapeHtml(String(draft.amount)) : ''}">
                </label>
                <label class="fin-field">
                    <span>Substance</span>
                    <select id="fin-budget-substance">
                        <option value="${escapeHtml(finAllSubstancesId())}"${financialIsAllSubstances(draft.substanceId) ? ' selected' : ''}>All substances</option>
                        ${substances.map(s => `<option value="${escapeHtml(s.id)}"${String(draft.substanceId) === String(s.id) ? ' selected' : ''}>${escapeHtml(getSubstanceDisplayName(s, data))}</option>`).join('')}
                    </select>
                </label>
                <label class="fin-field">
                    <span>Product type (optional)</span>
                    <input type="text" id="fin-budget-product" value="${escapeHtml(draft.productType)}" placeholder="bud, cart, vape…">
                </label>
                <label class="fin-field">
                    <span>Store (optional)</span>
                    <input type="text" id="fin-budget-store" value="${escapeHtml(draft.store)}">
                </label>
                <label class="fin-field">
                    <span>Supplier (optional)</span>
                    <input type="text" id="fin-budget-supplier" value="${escapeHtml(draft.supplier)}">
                </label>
                <label class="fin-field">
                    <span>Start date</span>
                    <input type="date" id="fin-budget-start" value="${escapeHtml(draft.startDate)}">
                </label>
                <label class="fin-field">
                    <span>End date (optional)</span>
                    <input type="date" id="fin-budget-end" value="${escapeHtml(draft.endDate)}">
                </label>
                <label class="fin-field fin-field-wide">
                    <span>Notes</span>
                    <textarea id="fin-budget-notes" rows="2">${escapeHtml(draft.notes)}</textarea>
                </label>
            </div>
            <footer class="fin-form-foot">
                <button type="submit" class="btn-primary">${editing ? 'Save budget' : 'Create budget'}</button>
                <button type="button" class="btn-small" onclick="closeBudgetForm()">Cancel</button>
                ${editing ? `<button type="button" class="btn-small btn-danger" onclick="deleteBudget('${escapeHtml(editing.id)}')">Delete</button>` : ''}
            </footer>
        </form>`;
}

function renderFinancialBudgetsPanel(dataset, data = appData) {
    const evaluations = dataset.budgets;
    const cards = evaluations.map(ev => {
        const pct = ev.pct == null ? 0 : Math.min(100, Math.round(ev.pct * 100));
        const scopeBits = [
            financialSubstanceLabel(ev.budget.substanceId, data),
            ev.budget.productType ? financialProductTypeLabel(ev.budget.productType) : '',
            ev.budget.store,
            ev.budget.supplier
        ].filter(Boolean).join(' · ');
        return `
            <article class="fin-budget-card ${finToneClass(ev.tone)}">
                <header>
                    <div>
                        <h4>${escapeHtml(ev.budget.name)}</h4>
                        <p class="fin-budget-scope">${escapeHtml(scopeBits)} · ${escapeHtml(FINANCIAL_BUDGET_PERIOD_LABELS[ev.budget.period])}</p>
                    </div>
                    <span class="fin-badge ${finToneClass(ev.tone)}">${escapeHtml(ev.statusLabel)}</span>
                </header>
                ${ev.needsReview ? '<p class="fin-warning">This budget needs review — check the amount and dates.</p>' : ''}
                <div class="fin-progress"><span class="fin-progress-fill ${finToneClass(ev.tone)}" style="width:${pct}%"></span></div>
                <p class="fin-budget-numbers">
                    <strong>${escapeHtml(finMoney(ev.spent))}</strong> of ${escapeHtml(finMoney(ev.amount))}
                    · ${escapeHtml(finPctLabel(ev.pct))} used
                    · ${escapeHtml(finMoney(ev.remaining))} left
                </p>
                <p class="fin-budget-meta">
                    ${escapeHtml(ev.period.label)} · ${ev.daysRemaining} day${ev.daysRemaining === 1 ? '' : 's'} left
                    · Projected ${escapeHtml(finMoney(ev.projectedFinal))} <span class="fin-badge fin-tone-neutral">${escapeHtml(FINANCIAL_ESTIMATE_LABEL)}</span>
                    ${ev.dailyAllowanceLeft == null ? '' : ` · ${escapeHtml(finMoney(ev.dailyAllowanceLeft))} per remaining day`}
                </p>
                <footer class="fin-budget-actions">
                    <button type="button" class="btn-small" onclick="openBudgetForm('${escapeHtml(ev.budget.id)}')">Edit</button>
                    ${ev.budget.status === 'active'
                        ? `<button type="button" class="btn-small" onclick="pauseBudget('${escapeHtml(ev.budget.id)}')">Pause</button>`
                        : `<button type="button" class="btn-small" onclick="resumeBudget('${escapeHtml(ev.budget.id)}')">Resume</button>`}
                    <button type="button" class="btn-small" onclick="archiveBudget('${escapeHtml(ev.budget.id)}')">Archive</button>
                    <button type="button" class="btn-small btn-danger" onclick="deleteBudget('${escapeHtml(ev.budget.id)}')">Delete</button>
                </footer>
            </article>`;
    }).join('');

    return `
        <section class="fin-panel">
            <header class="fin-panel-head">
                <h3>Budgets</h3>
                <button type="button" class="btn-small" onclick="openBudgetForm()">New budget</button>
            </header>
            ${financialAnalyticsUiState.budgetFormOpen ? renderBudgetFormHtml(data) : ''}
            ${evaluations.length ? `<div class="fin-budget-grid">${cards}</div>` : '<p class="fin-empty-inline">No budgets yet. Create one to track a spending cap per day, week, month, or year.</p>'}
        </section>`;
}

function renderFinancialSavingsPanel(dataset) {
    const s = dataset.savings;
    const cards = [
        financialCard('Versus previous period', finMoneyOrDash(s.vsPrevious.saved),
            s.vsPrevious.hasData ? `${s.vsPrevious.periodLabel} · ${finSignedPctLabel(s.vsPrevious.deltaPct)}` : 'No purchases in the previous period',
            finToNumber(s.vsPrevious.saved, 0) > 0 ? 'good' : finToNumber(s.vsPrevious.saved, 0) < 0 ? 'bad' : 'neutral'),
        financialCard('Versus baseline', finMoneyOrDash(s.vsBaseline.saved),
            s.vsBaseline.hasData ? `${s.vsBaseline.label} · ${FINANCIAL_ESTIMATE_LABEL}` : 'Not enough history yet',
            finToNumber(s.vsBaseline.saved, 0) > 0 ? 'good' : 'neutral'),
        financialCard('Estimated cost avoided', s.estimatedCostAvoided ? finMoney(s.estimatedCostAvoided.amount) : '—',
            s.estimatedCostAvoided ? `${FINANCIAL_ESTIMATE_LABEL} · ${s.estimatedCostAvoided.basis}` : 'Needs prior spending to compare against', 'good')
    ].join('');

    const planRows = s.planSavings.map(p => `
        <tr><td>${escapeHtml(p.name)}</td><td>${escapeHtml(finMoney(p.expected))}</td><td>${escapeHtml(finMoney(p.actual))}</td>
        <td class="${finToneClass(p.saved > 0 ? 'good' : 'bad')}">${escapeHtml(finMoney(p.saved))}</td></tr>`).join('');

    return `
        <section class="fin-panel">
            <header class="fin-panel-head"><h3>Savings</h3></header>
            <div class="fin-card-grid">${cards}</div>
            ${planRows ? `
            <h4 class="fin-subhead">Linked taper plans <span class="fin-badge fin-tone-neutral">${escapeHtml(FINANCIAL_ESTIMATE_LABEL)}</span></h4>
            <div class="fin-table-wrap"><table class="fin-table">
                <thead><tr><th>Plan</th><th>Expected</th><th>Actual</th><th>Saved</th></tr></thead>
                <tbody>${planRows}</tbody>
            </table></div>` : ''}
            <p class="fin-hint">${escapeHtml(s.estimateNote)}</p>
        </section>`;
}

function renderFinancialForecastPanel(dataset) {
    const f = dataset.forecast;
    if (f.status !== 'ok') {
        return `
            <section class="fin-panel">
                <header class="fin-panel-head"><h3>Forecast</h3></header>
                <p class="fin-empty-inline">${escapeHtml(f.reason)}</p>
            </section>`;
    }
    const risk = f.budgetRisk.map(r => `
        <tr><td>${escapeHtml(r.name)}</td><td>${escapeHtml(finMoney(r.projectedFinal))}</td><td>${escapeHtml(finMoney(r.amount))}</td>
        <td>${escapeHtml(finPctLabel(r.probability))} · ${escapeHtml(r.label)}</td></tr>`).join('');

    return `
        <section class="fin-panel">
            <header class="fin-panel-head">
                <h3>Forecast</h3>
                <span class="fin-badge fin-tone-neutral">${escapeHtml(FINANCIAL_ESTIMATE_LABEL)} · ${escapeHtml(f.confidence)} confidence</span>
            </header>
            <div class="fin-card-grid">
                ${financialCard('Next 7 days', finMoney(f.next7Days), FINANCIAL_ESTIMATE_LABEL)}
                ${financialCard('Next 30 days', finMoney(f.next30Days), FINANCIAL_ESTIMATE_LABEL)}
                ${financialCard('Monthly pace', finMoney(f.monthlyProjection), FINANCIAL_ESTIMATE_LABEL)}
                ${financialCard('Yearly pace', finMoney(f.yearlyProjection), FINANCIAL_ESTIMATE_LABEL)}
                ${financialCard('Expected next purchase', f.expectedNextPurchaseDate ? finDateLabel(f.expectedNextPurchaseDate) : '—',
                    f.avgDaysBetweenPurchases == null ? '' : `About every ${formatAmount(f.avgDaysBetweenPurchases, 1)} days`)}
            </div>
            ${risk ? `
            <h4 class="fin-subhead">Budget risk</h4>
            <div class="fin-table-wrap"><table class="fin-table">
                <thead><tr><th>Budget</th><th>Projected</th><th>Limit</th><th>Chance of exceeding</th></tr></thead>
                <tbody>${risk}</tbody>
            </table></div>` : ''}
            <p class="fin-hint">${escapeHtml(f.note)}</p>
        </section>`;
}

function renderFinancialBreakdownPanel(dataset) {
    const active = FINANCIAL_BREAKDOWN_DIMENSIONS.some(d => d.id === financialAnalyticsUiState.activeBreakdown)
        ? financialAnalyticsUiState.activeBreakdown
        : 'substance';
    const breakdown = dataset.breakdowns[active];
    const tabs = FINANCIAL_BREAKDOWN_DIMENSIONS.map(d => `
        <button type="button" class="fin-tab${d.id === active ? ' is-active' : ''}"
            onclick="setFinancialBreakdown('${escapeHtml(d.id)}')">${escapeHtml(d.label)}</button>`).join('');

    const rows = breakdown.rows.map(row => `
        <tr>
            <td>${escapeHtml(row.label)}</td>
            <td>${escapeHtml(finMoney(row.total))}</td>
            <td>${escapeHtml(finPctLabel(row.share))}</td>
            <td>${row.count}</td>
            <td>${escapeHtml(finMoneyOrDash(row.avgCost))}</td>
            <td class="${finToneClass(row.delta > 0 ? 'bad' : row.delta < 0 ? 'good' : 'neutral')}">
                ${escapeHtml(finMoneyOrDash(row.delta))} (${escapeHtml(finSignedPctLabel(row.deltaPct))})
            </td>
        </tr>`).join('');

    return `
        <section class="fin-panel">
            <header class="fin-panel-head"><h3>Breakdowns</h3></header>
            <div class="fin-tabs">${tabs}</div>
            ${breakdown.rows.length ? `
            ${renderFinancialBarChart(breakdown.rows.map(r => ({ label: r.label, value: r.total })), { kind: 'currency' })}
            <div class="fin-table-wrap"><table class="fin-table">
                <thead><tr><th>${escapeHtml(breakdown.label)}</th><th>Spent</th><th>Share</th><th>Buys</th><th>Average</th><th>Versus previous period</th></tr></thead>
                <tbody>${rows}</tbody>
            </table></div>` : '<p class="fin-empty-inline">Nothing to break down in this range.</p>'}
        </section>`;
}

function renderFinancialStorePanel(dataset) {
    const build = (title, rows) => `
        <h4 class="fin-subhead">${escapeHtml(title)}</h4>
        ${rows.length ? `
        <div class="fin-table-wrap"><table class="fin-table">
            <thead><tr><th>Name</th><th>Spent</th><th>Buys</th><th>Average</th><th>Cost per unit</th><th>Last purchase</th><th>Every</th></tr></thead>
            <tbody>${rows.map(r => `
                <tr>
                    <td>${escapeHtml(r.label)}</td>
                    <td>${escapeHtml(finMoney(r.total))}</td>
                    <td>${r.count}</td>
                    <td>${escapeHtml(finMoneyOrDash(r.avgCost))}</td>
                    <td>${r.mixedUnits ? 'Mixed units' : escapeHtml(finMoneyOrDash(r.weightedCostPerUnit, 4))}</td>
                    <td>${escapeHtml(r.lastDate ? finDateLabel(r.lastDate) : '—')}</td>
                    <td>${r.avgDaysBetween == null ? '—' : `${escapeHtml(formatAmount(r.avgDaysBetween, 1))} days`}</td>
                </tr>`).join('')}</tbody>
        </table></div>` : '<p class="fin-empty-inline">Nothing recorded in this range.</p>'}`;

    const bestValue = dataset.storeSupplier.bestValueBySubstance.map(v => `
        <li><strong>${escapeHtml(v.substanceName)}</strong>: ${escapeHtml(v.store)} at ${escapeHtml(finMoney(v.costPerUnit, 4))} per ${escapeHtml(v.unit)}</li>`).join('');

    return `
        <section class="fin-panel">
            <header class="fin-panel-head"><h3>Stores and suppliers</h3></header>
            ${build('Stores', dataset.storeSupplier.stores)}
            ${build('Suppliers', dataset.storeSupplier.suppliers)}
            ${bestValue ? `<h4 class="fin-subhead">Best unit price</h4><ul class="fin-mini-list">${bestValue}</ul>` : ''}
            <p class="fin-hint">Supplier falls back to the gift source when no store is recorded. Unit prices are only compared inside the same substance and unit.</p>
        </section>`;
}

function renderFinancialPaymentPanel(dataset) {
    const rows = dataset.payments.rows.map(r => `
        <tr>
            <td>${escapeHtml(r.label)}</td>
            <td>${escapeHtml(finMoney(r.total))}</td>
            <td>${escapeHtml(finPctLabel(r.share))}</td>
            <td>${r.count}</td>
            <td>${escapeHtml(finMoneyOrDash(r.avgCost))}</td>
            <td>${escapeHtml(finMoney(r.largest))}</td>
            <td>${escapeHtml(r.lastUsed ? finDateLabel(r.lastUsed) : '—')}</td>
        </tr>`).join('');

    return `
        <section class="fin-panel">
            <header class="fin-panel-head"><h3>Payment methods</h3></header>
            ${dataset.payments.rows.length ? `
            <div class="fin-table-wrap"><table class="fin-table">
                <thead><tr><th>Method</th><th>Spent</th><th>Share</th><th>Buys</th><th>Average</th><th>Largest</th><th>Last used</th></tr></thead>
                <tbody>${rows}</tbody>
            </table></div>` : '<p class="fin-empty-inline">No payment methods recorded in this range.</p>'}
        </section>`;
}

function renderFinancialDataQualityPanel(dataset) {
    const q = dataset.dataQuality;
    const rows = q.issues.slice(0, 25).map(i => `
        <tr>
            <td>${escapeHtml(i.date ? finDateLabel(i.date) : '—')}</td>
            <td>${escapeHtml(FINANCIAL_ISSUE_LABELS[i.code] || i.code)}</td>
            <td>${escapeHtml(i.message)}</td>
        </tr>`).join('');

    return `
        <section class="fin-panel">
            <header class="fin-panel-head">
                <h3>Data quality</h3>
                ${q.issues.length ? `<button type="button" class="btn-small" onclick="markFinancialIssuesForReview()">Flag ${q.issues.length} for review</button>` : ''}
            </header>
            ${q.issues.length ? `
            <div class="fin-table-wrap"><table class="fin-table">
                <thead><tr><th>Date</th><th>Issue</th><th>Detail</th></tr></thead>
                <tbody>${rows}</tbody>
            </table></div>
            ${q.issues.length > 25 ? `<p class="fin-hint">Showing the first 25 of ${q.issues.length} issues.</p>` : ''}`
            : `<p class="fin-empty-inline">All ${q.purchasesScanned} spend-counting purchases look complete.</p>`}
        </section>`;
}

function renderFinancialSubstancePanel(dataset) {
    if (!dataset.substanceMetrics.length) return '';
    const cards = dataset.substanceMetrics.map(entry => `
        <article class="fin-substance-card">
            <h4>${escapeHtml(entry.name)}</h4>
            <dl class="fin-def-list">
                ${entry.lines.map(line => `<div class="fin-def-row"><dt>${escapeHtml(line.label)}</dt><dd>${escapeHtml(line.value)}</dd></div>`).join('')}
            </dl>
        </article>`).join('');

    return `
        <section class="fin-panel">
            <header class="fin-panel-head"><h3>Cost by substance</h3></header>
            <div class="fin-substance-grid">${cards}</div>
            <p class="fin-hint">Each substance keeps its own units — grams, carts, puffs, tabs, pills, and milligrams are never added together.</p>
        </section>`;
}

function renderFinancialExportPanel() {
    const buttons = [
        ['summary', 'Summary'],
        ['purchases', 'Purchases'],
        ['budgets', 'Budgets'],
        ['stores', 'Stores & suppliers'],
        ['payments', 'Payments'],
        ['comparisons', 'Comparisons'],
        ['savings', 'Savings'],
        ['forecasts', 'Forecast']
    ].map(([kind, label]) => `<button type="button" class="btn-small" onclick="exportFinancialAnalyticsCsv('${kind}')">${escapeHtml(label)} CSV</button>`).join('');

    return `
        <section class="fin-panel">
            <header class="fin-panel-head"><h3>Export</h3></header>
            <div class="fin-export-row">${buttons}</div>
            <p class="fin-hint">Exports stay on this device — the file downloads straight from your browser.</p>
        </section>`;
}

function renderFinancialAnalyticsView() {
    const root = typeof document !== 'undefined' ? document.getElementById('financial-analytics-root') : null;
    if (!root) return;

    if (financialAnalyticsUiState.loading) {
        root.innerHTML = '<div class="fin-view"><p class="fin-empty-inline">Loading financial analytics…</p></div>';
        return;
    }

    let dataset;
    try {
        migrateFinancialAnalytics(appData);
        dataset = buildFinancialDataset(appData, { useCache: true });
        financialAnalyticsUiState.error = '';
    } catch (error) {
        financialAnalyticsUiState.error = error?.message || String(error);
        root.innerHTML = `
            <div class="fin-view">
                <section class="fin-panel fin-tone-bad">
                    <h3>Financial analytics could not load</h3>
                    <p class="fin-empty-inline">${escapeHtml(financialAnalyticsUiState.error)}</p>
                    <button type="button" class="btn-small" onclick="invalidateFinancialAnalyticsCache(); renderFinancialAnalyticsView();">Try again</button>
                </section>
            </div>`;
        return;
    }

    const emptyState = dataset.isEmpty
        ? `
        <section class="fin-panel">
            <h3>No spending in this range</h3>
            <p class="fin-empty-inline">
                Nothing matched ${escapeHtml(dataset.bounds.rangeLabel)}. Widen the date range, clear a filter,
                or log a purchase to see spending analytics.
            </p>
        </section>`
        : '';

    root.innerHTML = `
        <div class="fin-view">
            <header class="fin-view-head">
                <div>
                    <h2>Financial analytics</h2>
                    <p class="fin-view-sub">${escapeHtml(dataset.bounds.label)} · ${escapeHtml(dataset.bounds.rangeLabel)}</p>
                </div>
                ${dataset.bounds.incomplete ? `<span class="fin-badge fin-tone-warn">${escapeHtml(dataset.bounds.incompleteLabel)}</span>` : ''}
            </header>
            ${renderFinancialFiltersBar(dataset, appData)}
            ${emptyState}
            ${dataset.isEmpty ? '' : `
                ${renderFinancialSummaryCards(dataset)}
                ${renderFinancialChartPanel(dataset)}
                ${renderFinancialComparisonPanel(dataset)}
                ${renderFinancialSubstancePanel(dataset)}
            `}
            ${renderFinancialBudgetsPanel(dataset, appData)}
            ${dataset.isEmpty ? '' : `
                ${renderFinancialSavingsPanel(dataset)}
                ${renderFinancialForecastPanel(dataset)}
                ${renderFinancialBreakdownPanel(dataset)}
                ${renderFinancialStorePanel(dataset)}
                ${renderFinancialPaymentPanel(dataset)}
            `}
            ${renderFinancialDataQualityPanel(dataset)}
            ${renderFinancialExportPanel()}
        </div>`;
}

// ——— Financial Analytics: UI handlers ———

function financialFieldValue(id) {
    if (typeof document === 'undefined') return '';
    return finTrim(document.getElementById(id)?.value || '');
}

function onFinancialFilterChange() {
    const patch = {
        substanceId: financialFieldValue('fin-filter-substance') || finAllSubstancesId(),
        productType: financialFieldValue('fin-filter-product'),
        store: financialFieldValue('fin-filter-store'),
        supplier: financialFieldValue('fin-filter-supplier'),
        paymentMethod: financialFieldValue('fin-filter-payment'),
        acquisitionType: financialFieldValue('fin-filter-acquisition'),
        customStart: financialFieldValue('fin-filter-start'),
        customEnd: financialFieldValue('fin-filter-end')
    };
    const prefs = getFinancialAnalyticsPrefs(appData);
    if ((patch.customStart || patch.customEnd) && prefs.filters.dateRangePreset !== 'custom'
        && (patch.customStart !== prefs.filters.customStart || patch.customEnd !== prefs.filters.customEnd)) {
        patch.dateRangePreset = 'custom';
    }
    persistFinancialAnalyticsPrefs({ filters: patch }, appData);
    renderFinancialAnalyticsView();
}

function setFinancialDatePreset(preset) {
    if (!FINANCIAL_DATE_PRESETS.some(p => p.id === preset)) return;
    persistFinancialAnalyticsPrefs({ filters: { dateRangePreset: preset } }, appData);
    renderFinancialAnalyticsView();
}

function toggleFinancialFilters() {
    const prefs = getFinancialAnalyticsPrefs(appData);
    persistFinancialAnalyticsPrefs({ filtersCollapsed: !prefs.filtersCollapsed }, appData);
    renderFinancialAnalyticsView();
}

function toggleFinancialDisplaySettings() {
    const prefs = getFinancialAnalyticsPrefs(appData);
    persistFinancialAnalyticsPrefs({ displayCollapsed: !prefs.displayCollapsed }, appData);
    renderFinancialAnalyticsView();
}

function setFinancialChartGroupBy(groupBy) {
    if (!FINANCIAL_CHART_GROUP_BYS.some(g => g.id === groupBy)) return;
    persistFinancialAnalyticsPrefs({ chartGroupBy: groupBy }, appData);
    renderFinancialAnalyticsView();
}

function setFinancialChartGrain(grain) {
    if (!FINANCIAL_CHART_GRAINS.includes(grain)) return;
    persistFinancialAnalyticsPrefs({ chartGrain: grain }, appData);
    renderFinancialAnalyticsView();
}

function setFinancialComparePreset(preset) {
    if (!FINANCIAL_COMPARE_PRESETS.some(c => c.id === preset)) return;
    persistFinancialAnalyticsPrefs({ comparePreset: preset }, appData);
    renderFinancialAnalyticsView();
}

function setFinancialBreakdown(dimension) {
    if (!FINANCIAL_BREAKDOWN_DIMENSIONS.some(d => d.id === dimension)) return;
    financialAnalyticsUiState.activeBreakdown = dimension;
    renderFinancialAnalyticsView();
}

function markFinancialIssuesForReview() {
    const result = scanFinancialDataQuality(appData, { mutate: true });
    renderFinancialAnalyticsView();
    return result.issues.length;
}

function financialAfterBudgetChange() {
    invalidateFinancialAnalyticsCache();
    if (typeof invalidateCalendarEventsCache === 'function') invalidateCalendarEventsCache();
    if (typeof invalidateRecoveryDashboardCache === 'function') invalidateRecoveryDashboardCache();
    saveData(appData);
    renderFinancialAnalyticsView();
}

function openBudgetForm(budgetId = null) {
    financialAnalyticsUiState.budgetFormOpen = true;
    financialAnalyticsUiState.editingBudgetId = budgetId || null;
    financialAnalyticsUiState.formErrors = [];
    renderFinancialAnalyticsView();
}

function closeBudgetForm() {
    financialAnalyticsUiState.budgetFormOpen = false;
    financialAnalyticsUiState.editingBudgetId = null;
    financialAnalyticsUiState.formErrors = [];
    renderFinancialAnalyticsView();
}

function saveBudget() {
    ensureBudgets(appData);
    const editingId = financialAnalyticsUiState.editingBudgetId;
    const existing = editingId ? getBudgetById(editingId, appData) : null;
    const draft = normalizeBudgetRecord({
        ...(existing || getDefaultBudgetRecord()),
        name: financialFieldValue('fin-budget-name'),
        period: financialFieldValue('fin-budget-period') || 'monthly',
        amount: finToNumber(financialFieldValue('fin-budget-amount'), 0),
        substanceId: financialFieldValue('fin-budget-substance') || finAllSubstancesId(),
        productType: financialFieldValue('fin-budget-product'),
        store: financialFieldValue('fin-budget-store'),
        supplier: financialFieldValue('fin-budget-supplier'),
        startDate: financialFieldValue('fin-budget-start'),
        endDate: financialFieldValue('fin-budget-end'),
        notes: financialFieldValue('fin-budget-notes')
    }, appData);

    const errors = validateBudgetRecord(draft, appData);
    if (errors.length) {
        financialAnalyticsUiState.formErrors = errors;
        renderFinancialAnalyticsView();
        return null;
    }

    draft.needsReview = false;
    delete draft.reviewReason;
    draft.updatedAt = new Date().toISOString();
    if (existing) {
        Object.assign(existing, draft);
    } else {
        draft.createdAt = draft.createdAt || new Date().toISOString();
        appData.budgets.push(draft);
    }

    financialAnalyticsUiState.budgetFormOpen = false;
    financialAnalyticsUiState.editingBudgetId = null;
    financialAnalyticsUiState.formErrors = [];
    financialAfterBudgetChange();
    return existing || draft;
}

function deleteBudget(budgetId) {
    const budget = getBudgetById(budgetId, appData);
    if (!budget) return false;
    if (typeof confirm === 'function' && !confirm(`Delete the budget "${budget.name}"? This cannot be undone.`)) return false;
    appData.budgets = (appData.budgets || []).filter(b => String(b.id) !== String(budgetId));
    if (financialAnalyticsUiState.editingBudgetId === budgetId) {
        financialAnalyticsUiState.budgetFormOpen = false;
        financialAnalyticsUiState.editingBudgetId = null;
    }
    financialAfterBudgetChange();
    return true;
}

function pauseBudget(budgetId) {
    const budget = getBudgetById(budgetId, appData);
    if (!budget) return false;
    budget.status = 'paused';
    budget.updatedAt = new Date().toISOString();
    financialAfterBudgetChange();
    return true;
}

function resumeBudget(budgetId) {
    const budget = getBudgetById(budgetId, appData);
    if (!budget) return false;
    budget.status = 'active';
    budget.updatedAt = new Date().toISOString();
    financialAfterBudgetChange();
    return true;
}

function archiveBudget(budgetId) {
    const budget = getBudgetById(budgetId, appData);
    if (!budget) return false;
    budget.status = 'archived';
    budget.updatedAt = new Date().toISOString();
    financialAfterBudgetChange();
    return true;
}

if (typeof window !== 'undefined') {
    Object.assign(window, {
        renderFinancialAnalyticsView,
        onFinancialFilterChange,
        setFinancialDatePreset,
        toggleFinancialFilters,
        toggleFinancialDisplaySettings,
        setFinancialChartGroupBy,
        setFinancialChartGrain,
        setFinancialComparePreset,
        setFinancialBreakdown,
        markFinancialIssuesForReview,
        openBudgetForm,
        closeBudgetForm,
        saveBudget,
        deleteBudget,
        pauseBudget,
        resumeBudget,
        archiveBudget,
        invalidateFinancialAnalyticsCache,
        exportFinancialAnalyticsCsv,
        exportFinancialSummaryCsv,
        exportFinancialPurchasesCsv,
        exportFinancialBudgetsCsv,
        exportFinancialStoresCsv,
        exportFinancialPaymentsCsv,
        exportFinancialComparisonsCsv,
        exportFinancialSavingsCsv,
        exportFinancialForecastsCsv
    });
}
