// ——— Goal System ———
// Self-contained goal tracking for Recovery Tracker. Local-only: every mutation
// persists through saveData(appData). No imports/exports — spliced into app.js.

const GOAL_CATEGORIES = Object.freeze([
    { id: 'use', label: 'Use', icon: '🌿', description: 'Limit how much or how often you use.' },
    { id: 'spending', label: 'Spending', icon: '💵', description: 'Cap what you spend over a period.' },
    { id: 'purchase', label: 'Purchases', icon: '🛒', description: 'Control how often you buy or restock.' },
    { id: 'streak', label: 'Streaks', icon: '🔥', description: 'Build consecutive-day streaks.' },
    { id: 'custom', label: 'Custom', icon: '⭐', description: 'Track anything you define yourself.' }
]);

const GOAL_PERIODS = Object.freeze(['daily', 'weekly', 'monthly', 'quarterly', 'yearly', 'rolling', 'entire']);

const GOAL_PERIOD_LABELS = Object.freeze({
    daily: 'Per day',
    weekly: 'Per week',
    monthly: 'Per month',
    quarterly: 'Per quarter',
    yearly: 'Per year',
    rolling: 'Rolling window',
    entire: 'Whole goal'
});

/**
 * unitKind: substance = substance-native units (never summed across substances),
 * currency / count / days / percent are unit-free and safe to total.
 * aggregation drives which engine branch computeGoalActual() takes.
 */
const GOAL_TYPE_META = Object.freeze({
    // —— Use ——
    max_daily_use: {
        category: 'use', label: 'Max daily use', direction: 'max', aggregation: 'use_amount',
        unitKind: 'substance', defaultPeriod: 'daily', periods: ['daily'],
        targetLabel: 'Daily limit', description: 'Stay at or under an amount each day.'
    },
    max_weekly_use: {
        category: 'use', label: 'Max weekly use', direction: 'max', aggregation: 'use_amount',
        unitKind: 'substance', defaultPeriod: 'weekly', periods: ['weekly', 'rolling'],
        targetLabel: 'Weekly limit', description: 'Stay at or under an amount each week.'
    },
    max_monthly_use: {
        category: 'use', label: 'Max monthly use', direction: 'max', aggregation: 'use_amount',
        unitKind: 'substance', defaultPeriod: 'monthly', periods: ['monthly', 'rolling'],
        targetLabel: 'Monthly limit', description: 'Stay at or under an amount each month.'
    },
    max_session_amount: {
        category: 'use', label: 'Max per session', direction: 'max', aggregation: 'use_session_max',
        unitKind: 'substance', defaultPeriod: 'weekly',
        periods: ['daily', 'weekly', 'monthly', 'rolling', 'entire'],
        targetLabel: 'Largest single log', description: 'Keep any single logged session at or under an amount.'
    },
    max_use_days: {
        category: 'use', label: 'Max use days', direction: 'max', aggregation: 'use_days',
        unitKind: 'days', defaultPeriod: 'weekly',
        periods: ['weekly', 'monthly', 'quarterly', 'yearly', 'rolling', 'entire'],
        targetLabel: 'Use days allowed', description: 'Limit how many days you use in a period.'
    },
    no_use_day: {
        category: 'use', label: 'Protected no-use days', direction: 'max', aggregation: 'use_days_on_weekdays',
        unitKind: 'days', defaultPeriod: 'weekly', fixedTargetZero: true,
        periods: ['weekly', 'monthly', 'quarterly', 'rolling', 'entire'],
        targetLabel: 'Slips on protected days', configFields: ['weekdays'],
        description: 'Pick weekdays that must stay use-free.'
    },
    weekend_only_use: {
        category: 'use', label: 'Weekend-only use', direction: 'max', aggregation: 'weekday_use_days',
        unitKind: 'days', defaultPeriod: 'weekly', fixedTargetZero: true,
        periods: ['weekly', 'monthly', 'quarterly', 'rolling', 'entire'],
        targetLabel: 'Weekday use days', description: 'Use only on Saturday and Sunday.'
    },
    weekday_free_use: {
        category: 'use', label: 'Weekday-only use', direction: 'max', aggregation: 'weekend_use_days',
        unitKind: 'days', defaultPeriod: 'weekly', fixedTargetZero: true,
        periods: ['weekly', 'monthly', 'quarterly', 'rolling', 'entire'],
        targetLabel: 'Weekend use days', description: 'Keep weekends use-free.'
    },
    reduction_pct: {
        category: 'use', label: 'Reduce use by %', direction: 'min', aggregation: 'use_reduction_pct',
        unitKind: 'percent', defaultPeriod: 'weekly', needsBaseline: true,
        periods: ['weekly', 'monthly', 'quarterly', 'rolling', 'entire'],
        targetLabel: 'Reduction target (%)', description: 'Cut use by a percentage versus a baseline period.'
    },
    abstinence: {
        category: 'use', label: 'Abstinence', direction: 'max', aggregation: 'use_days',
        unitKind: 'days', defaultPeriod: 'entire', fixedTargetZero: true,
        periods: ['daily', 'weekly', 'monthly', 'quarterly', 'yearly', 'rolling', 'entire'],
        targetLabel: 'Use days', description: 'No use at all during the goal window.'
    },

    // —— Spending ——
    max_daily_spend: {
        category: 'spending', label: 'Max daily spend', direction: 'max', aggregation: 'spend',
        unitKind: 'currency', defaultPeriod: 'daily', periods: ['daily'],
        targetLabel: 'Daily spend cap', description: 'Cap what you spend in one day.'
    },
    max_weekly_spend: {
        category: 'spending', label: 'Max weekly spend', direction: 'max', aggregation: 'spend',
        unitKind: 'currency', defaultPeriod: 'weekly', periods: ['weekly', 'rolling'],
        targetLabel: 'Weekly spend cap', description: 'Cap what you spend in a week.'
    },
    max_monthly_spend: {
        category: 'spending', label: 'Max monthly spend', direction: 'max', aggregation: 'spend',
        unitKind: 'currency', defaultPeriod: 'monthly', periods: ['monthly', 'rolling'],
        targetLabel: 'Monthly spend cap', description: 'Cap what you spend in a month.'
    },
    max_yearly_spend: {
        category: 'spending', label: 'Max yearly spend', direction: 'max', aggregation: 'spend',
        unitKind: 'currency', defaultPeriod: 'yearly', periods: ['yearly', 'quarterly', 'rolling'],
        targetLabel: 'Yearly spend cap', description: 'Cap what you spend in a year.'
    },
    spend_reduction_pct: {
        category: 'spending', label: 'Reduce spend by %', direction: 'min', aggregation: 'spend_reduction_pct',
        unitKind: 'percent', defaultPeriod: 'monthly', needsBaseline: true,
        periods: ['weekly', 'monthly', 'quarterly', 'rolling', 'entire'],
        targetLabel: 'Reduction target (%)', description: 'Cut spending by a percentage versus a baseline.'
    },
    cost_per_use_day: {
        category: 'spending', label: 'Cost per use day', direction: 'max', aggregation: 'cost_per_use_day',
        unitKind: 'currency', defaultPeriod: 'monthly',
        periods: ['weekly', 'monthly', 'quarterly', 'yearly', 'rolling', 'entire'],
        targetLabel: 'Cost per use day cap', description: 'Keep average spend per day-you-used under a cap.'
    },

    // —— Purchase ——
    max_purchase_count: {
        category: 'purchase', label: 'Max purchases', direction: 'max', aggregation: 'purchase_count',
        unitKind: 'count', defaultPeriod: 'monthly',
        periods: ['weekly', 'monthly', 'quarterly', 'yearly', 'rolling', 'entire'],
        targetLabel: 'Purchases allowed', description: 'Limit how many times you buy.'
    },
    max_purchase_amount: {
        category: 'purchase', label: 'Max purchased amount', direction: 'max', aggregation: 'purchase_amount',
        unitKind: 'substance', defaultPeriod: 'monthly',
        periods: ['weekly', 'monthly', 'quarterly', 'yearly', 'rolling', 'entire'],
        targetLabel: 'Quantity allowed', description: 'Limit total quantity bought in a period.'
    },
    min_days_between_purchases: {
        category: 'purchase', label: 'Min days between buys', direction: 'min', aggregation: 'purchase_min_gap',
        unitKind: 'days', defaultPeriod: 'rolling',
        periods: ['rolling', 'monthly', 'quarterly', 'entire'],
        targetLabel: 'Minimum gap (days)', description: 'Keep a minimum gap between purchases.'
    },
    no_buy_period: {
        category: 'purchase', label: 'No-buy period', direction: 'max', aggregation: 'purchase_count',
        unitKind: 'count', defaultPeriod: 'entire', fixedTargetZero: true,
        periods: ['weekly', 'monthly', 'rolling', 'entire'],
        targetLabel: 'Purchases made', description: 'Buy nothing for the whole window.'
    },
    no_purchase_before_date: {
        category: 'purchase', label: 'No buying before a date', direction: 'max', aggregation: 'purchase_before_date',
        unitKind: 'count', defaultPeriod: 'entire', fixedTargetZero: true,
        periods: ['entire'], configFields: ['beforeDate'],
        targetLabel: 'Early purchases', description: 'Hold off buying until a chosen date.'
    },
    max_active_inventory: {
        category: 'purchase', label: 'Max active inventory', direction: 'max', aggregation: 'active_inventory',
        unitKind: 'substance', defaultPeriod: 'entire', pointInTime: true,
        periods: ['entire', 'rolling', 'monthly'],
        targetLabel: 'Inventory ceiling', description: 'Keep remaining stock on hand under a ceiling.'
    },

    // —— Streaks ——
    no_use_streak: {
        category: 'streak', label: 'No-use streak', direction: 'min', aggregation: 'streak_no_use',
        unitKind: 'days', defaultPeriod: 'entire', periods: ['entire'], pointInTime: true,
        targetLabel: 'Streak target (days)', description: 'Reach a run of consecutive use-free days.'
    },
    no_purchase_streak: {
        category: 'streak', label: 'No-purchase streak', direction: 'min', aggregation: 'streak_no_purchase',
        unitKind: 'days', defaultPeriod: 'entire', periods: ['entire'], pointInTime: true,
        targetLabel: 'Streak target (days)', description: 'Reach a run of consecutive days without buying.'
    },
    logging_streak: {
        category: 'streak', label: 'Logging streak', direction: 'min', aggregation: 'streak_logging',
        unitKind: 'days', defaultPeriod: 'entire', periods: ['entire'], pointInTime: true,
        targetLabel: 'Streak target (days)', description: 'Log something every day for a run of days.'
    },
    plan_adherence_streak: {
        category: 'streak', label: 'Plan adherence streak', direction: 'min', aggregation: 'streak_plan_adherence',
        unitKind: 'days', defaultPeriod: 'entire', periods: ['entire'], pointInTime: true,
        targetLabel: 'Streak target (days)', requiresPlan: true,
        targetHint: 'Counts consecutive days at or under the linked plan target.',
        description: 'Stay at or under your taper plan target day after day.'
    },

    // —— Custom ——
    custom: {
        category: 'custom', label: 'Custom goal', direction: 'max', aggregation: 'custom',
        unitKind: 'count', defaultPeriod: 'weekly', allowDirectionChoice: true,
        periods: GOAL_PERIODS.slice(),
        targetLabel: 'Target value', description: 'Track a number you update yourself.'
    }
});

const GOAL_LIFECYCLE = Object.freeze(['draft', 'active', 'paused', 'completed', 'missed', 'cancelled', 'archived']);

const GOAL_STATUS_META = Object.freeze({
    on_track: { label: 'On track', tone: 'good', className: 'goal-status-on-track' },
    near_limit: { label: 'Near limit', tone: 'warn', className: 'goal-status-near-limit' },
    at_limit: { label: 'At limit', tone: 'warn', className: 'goal-status-at-limit' },
    exceeded: { label: 'Over limit', tone: 'bad', className: 'goal-status-exceeded' },
    achieved: { label: 'Target reached', tone: 'good', className: 'goal-status-achieved' },
    in_progress: { label: 'In progress', tone: 'neutral', className: 'goal-status-in-progress' },
    behind: { label: 'Behind', tone: 'warn', className: 'goal-status-behind' },
    completed: { label: 'Completed', tone: 'good', className: 'goal-status-completed' },
    missed: { label: 'Missed', tone: 'bad', className: 'goal-status-missed' },
    paused: { label: 'Paused', tone: 'neutral', className: 'goal-status-paused' },
    cancelled: { label: 'Cancelled', tone: 'neutral', className: 'goal-status-cancelled' },
    draft: { label: 'Draft', tone: 'neutral', className: 'goal-status-draft' },
    upcoming: { label: 'Upcoming', tone: 'neutral', className: 'goal-status-upcoming' },
    archived: { label: 'Archived', tone: 'neutral', className: 'goal-status-archived' },
    insufficient_data: { label: 'Not enough data', tone: 'neutral', className: 'goal-status-insufficient' },
    needs_review: { label: 'Needs review', tone: 'warn', className: 'goal-status-needs-review' }
});

const GOAL_LIST_BUCKETS = Object.freeze([
    { id: 'active', label: 'Active' },
    { id: 'upcoming', label: 'Upcoming' },
    { id: 'completed', label: 'Completed' },
    { id: 'missed', label: 'Missed' },
    { id: 'paused', label: 'Paused' },
    { id: 'history', label: 'History' }
]);

const GOAL_SORT_OPTIONS = Object.freeze([
    { id: 'status', label: 'Status urgency' },
    { id: 'progress', label: 'Progress' },
    { id: 'deadline', label: 'Deadline' },
    { id: 'name', label: 'Name' },
    { id: 'created', label: 'Newest' },
    { id: 'priority', label: 'Priority' }
]);

const GOAL_TEMPLATES = Object.freeze([
    {
        id: 'reduce-weekly-10',
        label: 'Reduce weekly use 10%',
        icon: '📉',
        blurb: 'Cut weekly use 10% versus the last 4 weeks.',
        goal: { name: 'Reduce weekly use 10%', category: 'use', type: 'reduction_pct', period: 'weekly', targetValue: 10, recurring: true, baselineMode: 'auto', baselineLookbackDays: 28 }
    },
    {
        id: 'reduce-monthly-spend-20',
        label: 'Cut monthly spend 20%',
        icon: '💸',
        blurb: 'Spend 20% less than your baseline month.',
        goal: { name: 'Cut monthly spend 20%', category: 'spending', type: 'spend_reduction_pct', period: 'monthly', targetValue: 20, recurring: true, baselineMode: 'auto', baselineLookbackDays: 90 }
    },
    {
        id: 'no-buy-7',
        label: 'No-buy 7 days',
        icon: '🚫',
        blurb: 'One full week without buying.',
        goal: { name: 'No-buy week', category: 'purchase', type: 'no_buy_period', period: 'entire', targetValue: 0, durationDays: 7, recurring: false }
    },
    {
        id: 'use-days-3-week',
        label: 'Use ≤3 days/week',
        icon: '📆',
        blurb: 'Cap yourself at three use days a week.',
        goal: { name: 'Use 3 days a week or less', category: 'use', type: 'max_use_days', period: 'weekly', targetValue: 3, recurring: true }
    },
    {
        id: 'max-session',
        label: 'Max session size',
        icon: '⚖️',
        blurb: 'Keep every single session under a set amount.',
        goal: { name: 'Smaller sessions', category: 'use', type: 'max_session_amount', period: 'weekly', targetValue: 1, recurring: true }
    },
    {
        id: 'streak-30',
        label: '30-day streak',
        icon: '🔥',
        blurb: 'Thirty consecutive use-free days.',
        goal: { name: '30-day no-use streak', category: 'streak', type: 'no_use_streak', period: 'entire', targetValue: 30, recurring: false }
    },
    {
        id: 'inventory-last-14',
        label: 'Make supply last 14 days',
        icon: '📦',
        blurb: 'Hold current stock and stretch it two weeks.',
        goal: { name: 'Make supply last 14 days', category: 'purchase', type: 'no_buy_period', period: 'entire', targetValue: 0, durationDays: 14, recurring: false }
    },
    {
        id: 'custom-blank',
        label: 'Custom goal',
        icon: '⭐',
        blurb: 'Start from scratch and define your own target.',
        goal: { name: '', category: 'custom', type: 'custom', period: 'weekly', targetValue: 1, recurring: false }
    }
]);

const GOAL_REMINDER_DISCLAIMER = 'Goal reminders are in-app nudges for personal tracking only. They are not medical advice — talk to a qualified clinician about withdrawal, tapering, or treatment.';

const GOAL_WEEKDAY_LABELS = Object.freeze(['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']);

let goalSystemUiState = {
    bucket: 'active',
    sortBy: 'status',
    filters: { substanceId: 'all', category: 'all', type: 'all', search: '' },
    formOpen: false,
    editingGoalId: null,
    detailGoalId: null,
    formDraft: null,
    formErrors: [],
    templatesOpen: true,
    loading: false,
    error: null
};

// ——— Goal System: preferences ———

function getDefaultGoalSystemPrefs() {
    return {
        thresholds: { nearLimit: 0.75, atLimit: 1 },
        scoreContributionEnabled: true,
        remindersEnabled: true,
        reminderLeadDays: 3,
        autoCompleteFinishedGoals: true,
        showGoalsOnDashboard: true,
        showGoalsOnCalendar: true,
        defaultPeriod: 'weekly',
        defaultSortBy: 'status'
    };
}

function ensureGoalSystemPrefs(data = appData) {
    if (!data || typeof data !== 'object') return getDefaultGoalSystemPrefs();
    if (!data.settings || typeof data.settings !== 'object') data.settings = {};
    const defaults = getDefaultGoalSystemPrefs();
    if (!data.settings.goalSystem || typeof data.settings.goalSystem !== 'object' || Array.isArray(data.settings.goalSystem)) {
        data.settings.goalSystem = { ...defaults, thresholds: { ...defaults.thresholds } };
    }
    const prefs = data.settings.goalSystem;
    Object.keys(defaults).forEach(key => {
        if (prefs[key] === undefined) {
            prefs[key] = key === 'thresholds' ? { ...defaults.thresholds } : defaults[key];
        }
    });
    if (!prefs.thresholds || typeof prefs.thresholds !== 'object') prefs.thresholds = { ...defaults.thresholds };
    const near = Number(prefs.thresholds.nearLimit);
    const at = Number(prefs.thresholds.atLimit);
    prefs.thresholds.nearLimit = Number.isFinite(near) && near > 0 && near <= 1 ? near : defaults.thresholds.nearLimit;
    prefs.thresholds.atLimit = Number.isFinite(at) && at > 0 ? at : defaults.thresholds.atLimit;
    if (!GOAL_PERIODS.includes(prefs.defaultPeriod)) prefs.defaultPeriod = defaults.defaultPeriod;
    return prefs;
}

function getGoalSystemPrefs(data = appData) {
    return ensureGoalSystemPrefs(data);
}

function persistGoalSystemPrefs(patch = {}, data = appData) {
    const prefs = ensureGoalSystemPrefs(data);
    const { thresholds, ...rest } = patch || {};
    Object.assign(prefs, rest);
    if (thresholds) prefs.thresholds = { ...prefs.thresholds, ...thresholds };
    ensureGoalSystemPrefs(data);
    saveData(data);
    return prefs;
}

// ——— Goal System: small shared helpers ———

function goalTodayStr() {
    return getLocalDateString();
}

function goalToNumber(value, fallback = 0) {
    const n = parseFloat(value);
    return Number.isFinite(n) ? n : fallback;
}

function goalRoundTo(value, decimals = 2) {
    const factor = Math.pow(10, decimals);
    return Math.round(((goalToNumber(value, 0)) + Number.EPSILON) * factor) / factor;
}

/** Keeps Infinity intact — a zero target with any activity is an infinite ratio, not zero. */
function goalClampRatio(value) {
    if (value === Infinity) return Infinity;
    if (!Number.isFinite(value)) return 0;
    return Math.max(0, value);
}

function goalFormatDate(dateStr) {
    if (!dateStr) return '—';
    if (typeof formatDate === 'function') {
        try { return formatDate(dateStr); } catch (_err) { /* fall through */ }
    }
    return dateStr;
}

function goalIsAllSubstances(substanceId) {
    return !substanceId || substanceId === DASHBOARD_ALL || substanceId === 'all';
}

function goalMatchesSubstance(recordSubstanceId, selectedSubstanceId, data = appData) {
    if (goalIsAllSubstances(selectedSubstanceId)) return true;
    if (goalIsAllSubstances(recordSubstanceId)) return true;
    return recoveryDashboardMatchesSubstance(recordSubstanceId, selectedSubstanceId, data);
}

function goalSubstanceLabel(substanceId, data = appData) {
    if (goalIsAllSubstances(substanceId)) return 'All substances';
    return getSubstanceDisplayName(substanceId, data);
}

function getGoalTypeMeta(type) {
    return GOAL_TYPE_META[type] || GOAL_TYPE_META.custom;
}

function getGoalTypesForCategory(categoryId) {
    return Object.keys(GOAL_TYPE_META).filter(type => GOAL_TYPE_META[type].category === categoryId);
}

function getGoalDirection(goal) {
    const meta = getGoalTypeMeta(goal?.type);
    if (meta.allowDirectionChoice && (goal?.direction === 'min' || goal?.direction === 'max')) return goal.direction;
    return meta.direction;
}

function getGoalTargetValue(goal) {
    const meta = getGoalTypeMeta(goal?.type);
    if (meta.fixedTargetZero) return 0;
    return goalToNumber(goal?.targetValue, 0);
}

function getGoalUnitLabel(goal, data = appData) {
    const meta = getGoalTypeMeta(goal?.type);
    if (meta.unitKind === 'currency') return getCurrencySymbol();
    if (meta.unitKind === 'percent') return '%';
    if (meta.unitKind === 'days') return 'days';
    if (meta.unitKind === 'count') return goal?.targetUnit || 'times';
    if (meta.unitKind === 'substance') {
        if (goalIsAllSubstances(goal?.substanceId)) return goal?.targetUnit || 'units';
        return getSubstanceDisplayUnit(goal.substanceId, data);
    }
    return goal?.targetUnit || '';
}

function goalIsPointInTime(goal) {
    return !!getGoalTypeMeta(goal?.type).pointInTime;
}

function goalNeedsBaseline(goal) {
    return !!getGoalTypeMeta(goal?.type).needsBaseline;
}

// ——— Goal System: data layer ———

function createGoalId() {
    return `goal-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

function getDefaultGoalRecord() {
    const today = goalTodayStr();
    return {
        id: '',
        name: '',
        description: '',
        category: 'use',
        type: 'max_weekly_use',
        substanceId: DASHBOARD_ALL,
        direction: 'max',
        targetValue: 0,
        targetUnit: '',
        period: 'weekly',
        rollingDays: 7,
        startDate: today,
        endDate: '',
        recurring: true,
        status: 'active',
        priority: 'normal',
        config: {},
        baselineMode: 'auto',
        baselineValue: null,
        baselineStartDate: '',
        baselineEndDate: '',
        baselineLookbackDays: 28,
        manualActual: null,
        linkedPlanId: '',
        tags: [],
        notes: '',
        reminders: { enabled: true, leadDays: 3, frequency: 'period' },
        periodHistory: [],
        changeHistory: [],
        needsReview: false,
        source: 'manual',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        completedAt: '',
        archivedAt: ''
    };
}

function normalizeGoalRecord(raw) {
    const defaults = getDefaultGoalRecord();
    const goal = { ...defaults, ...(raw && typeof raw === 'object' ? raw : {}) };

    goal.id = goal.id || createGoalId();
    goal.name = String(goal.name || '').trim();
    goal.description = String(goal.description || '');
    if (!GOAL_TYPE_META[goal.type]) goal.type = 'custom';
    const meta = getGoalTypeMeta(goal.type);
    goal.category = meta.category;
    goal.direction = meta.allowDirectionChoice && goal.direction === 'min' ? 'min' : meta.direction;

    if (!goal.substanceId) goal.substanceId = DASHBOARD_ALL;
    if (!GOAL_PERIODS.includes(goal.period) || !meta.periods.includes(goal.period)) {
        goal.period = meta.periods.includes(goal.period) ? goal.period : meta.defaultPeriod;
    }
    goal.rollingDays = Math.max(1, Math.round(goalToNumber(goal.rollingDays, 7)));
    goal.targetValue = meta.fixedTargetZero ? 0 : goalToNumber(goal.targetValue, 0);
    goal.targetUnit = String(goal.targetUnit || '');
    goal.startDate = String(goal.startDate || defaults.startDate);
    goal.endDate = goal.endDate ? String(goal.endDate) : '';
    goal.recurring = !!goal.recurring && goal.period !== 'entire';
    if (!GOAL_LIFECYCLE.includes(goal.status)) goal.status = 'active';
    if (!['low', 'normal', 'high'].includes(goal.priority)) goal.priority = 'normal';

    goal.config = goal.config && typeof goal.config === 'object' && !Array.isArray(goal.config) ? { ...goal.config } : {};
    if (Array.isArray(goal.config.weekdays)) {
        goal.config.weekdays = goal.config.weekdays
            .map(d => Math.round(goalToNumber(d, -1)))
            .filter(d => d >= 0 && d <= 6);
    } else if (goal.type === 'no_use_day') {
        goal.config.weekdays = [1, 2, 3, 4];
    }
    if (goal.type === 'no_purchase_before_date' && !goal.config.beforeDate) {
        goal.config.beforeDate = goal.endDate || addDaysYYYYMMDD(goal.startDate, 14);
    }

    goal.baselineMode = goal.baselineMode === 'manual' ? 'manual' : 'auto';
    goal.baselineValue = goal.baselineValue == null || goal.baselineValue === ''
        ? null
        : goalToNumber(goal.baselineValue, 0);
    goal.baselineLookbackDays = Math.max(1, Math.round(goalToNumber(goal.baselineLookbackDays, 28)));
    goal.baselineStartDate = String(goal.baselineStartDate || '');
    goal.baselineEndDate = String(goal.baselineEndDate || '');
    goal.manualActual = goal.manualActual == null || goal.manualActual === '' ? null : goalToNumber(goal.manualActual, 0);

    goal.linkedPlanId = String(goal.linkedPlanId || '');
    goal.tags = Array.isArray(goal.tags) ? goal.tags.map(t => String(t).trim()).filter(Boolean) : [];
    goal.notes = String(goal.notes || '');

    const reminders = goal.reminders && typeof goal.reminders === 'object' ? goal.reminders : {};
    goal.reminders = {
        enabled: reminders.enabled !== false,
        leadDays: Math.max(0, Math.round(goalToNumber(reminders.leadDays, 3))),
        frequency: ['period', 'daily', 'deadline'].includes(reminders.frequency) ? reminders.frequency : 'period'
    };

    goal.periodHistory = Array.isArray(goal.periodHistory)
        ? goal.periodHistory.filter(p => p && p.periodStart).map(p => ({
            periodStart: String(p.periodStart),
            periodEnd: String(p.periodEnd || p.periodStart),
            actual: p.actual == null ? null : goalToNumber(p.actual, 0),
            target: goalToNumber(p.target, 0),
            status: p.status || 'insufficient_data',
            met: !!p.met,
            finalized: !!p.finalized,
            note: String(p.note || ''),
            evaluatedAt: p.evaluatedAt || ''
        }))
        : [];
    goal.periodHistory.sort((a, b) => (a.periodStart < b.periodStart ? -1 : a.periodStart > b.periodStart ? 1 : 0));

    goal.changeHistory = Array.isArray(goal.changeHistory)
        ? goal.changeHistory.slice(-60).map(c => ({
            at: c.at || new Date().toISOString(),
            action: String(c.action || 'updated'),
            detail: c.detail && typeof c.detail === 'object' ? c.detail : {}
        }))
        : [];

    goal.needsReview = !!goal.needsReview;
    goal.source = String(goal.source || 'manual');
    goal.createdAt = goal.createdAt || new Date().toISOString();
    goal.updatedAt = goal.updatedAt || goal.createdAt;
    goal.completedAt = String(goal.completedAt || '');
    goal.archivedAt = String(goal.archivedAt || '');
    return goal;
}

function migrateLegacyGoals(data = appData) {
    if (!data || typeof data !== 'object') return 0;
    if (!data.migrations || typeof data.migrations !== 'object') data.migrations = {};
    if (data.migrations.goalsFromPlansV1) return 0;
    if (typeof ensureTaperPlansV2 === 'function') ensureTaperPlansV2(data);
    if (!Array.isArray(data.goals)) data.goals = [];

    let created = 0;
    (data.taperPlansV2 || []).forEach(plan => {
        const goalDate = plan?.goalDate || plan?.quitDate || '';
        if (!goalDate) return;
        if (data.goals.some(g => g?.linkedPlanId === plan.id && g?.source === 'migration:plan')) return;

        const isQuit = !!plan.quitDate || plan.planType === 'quit' || plan.strategy === 'quit-by-date';
        const reductionPct = goalToNumber(plan.reductionPercent ?? plan.weeklyReductionPercent, 0);
        const base = getDefaultGoalRecord();
        const goal = normalizeGoalRecord({
            ...base,
            id: createGoalId(),
            name: `${plan.name || getSubstanceDisplayName(plan.substanceId, data)} goal`,
            description: 'Imported from a taper plan goal date. Review the target before relying on it.',
            substanceId: plan.substanceId || DASHBOARD_ALL,
            category: 'use',
            type: isQuit ? 'abstinence' : (reductionPct > 0 ? 'reduction_pct' : 'custom'),
            targetValue: isQuit ? 0 : (reductionPct > 0 ? reductionPct : 1),
            period: 'entire',
            startDate: plan.startDate || plan.createdAt?.slice(0, 10) || goalTodayStr(),
            endDate: goalDate,
            recurring: false,
            status: plan.status === 'archived' ? 'archived' : 'active',
            linkedPlanId: plan.id || '',
            needsReview: true,
            source: 'migration:plan',
            changeHistory: [{ at: new Date().toISOString(), action: 'migrated', detail: { planId: plan.id, goalDate } }]
        });
        data.goals.push(goal);
        created += 1;
    });

    data.migrations.goalsFromPlansV1 = true;
    return created;
}

function ensureGoals(data = appData) {
    if (!data || typeof data !== 'object') return [];
    if (!Array.isArray(data.goals)) data.goals = [];
    ensureGoalSystemPrefs(data);
    migrateLegacyGoals(data);
    data.goals = data.goals
        .filter(g => g && typeof g === 'object')
        .map(normalizeGoalRecord);
    return data.goals;
}

function getGoals(data = appData) {
    return ensureGoals(data);
}

function getGoalById(goalId, data = appData) {
    if (!goalId) return null;
    return getGoals(data).find(g => g.id === goalId) || null;
}

function validateGoalRecord(goal, data = appData) {
    const errors = [];
    if (!goal || typeof goal !== 'object') return { valid: false, errors: ['Goal record is missing.'] };
    const meta = GOAL_TYPE_META[goal.type];
    if (!meta) errors.push('Pick a goal type.');
    if (!String(goal.name || '').trim()) errors.push('Give the goal a name.');
    if (!goal.startDate || !parseLocalDate(goal.startDate)) errors.push('Start date must be a valid date.');
    if (goal.endDate) {
        if (!parseLocalDate(goal.endDate)) errors.push('End date must be a valid date.');
        else if (goal.endDate < goal.startDate) errors.push('End date cannot be before the start date.');
    }
    if (meta && !meta.fixedTargetZero) {
        const target = goalToNumber(goal.targetValue, NaN);
        if (!Number.isFinite(target)) errors.push('Target must be a number.');
        else if (target < 0) errors.push('Target cannot be negative.');
        else if (target === 0 && getGoalDirection(goal) === 'min') errors.push('A minimum target needs to be greater than zero.');
    }
    if (meta && meta.unitKind === 'percent') {
        const target = goalToNumber(goal.targetValue, 0);
        if (target > 100) errors.push('Percentage targets cannot exceed 100.');
    }
    if (goal.period === 'rolling' && goalToNumber(goal.rollingDays, 0) < 1) {
        errors.push('Rolling window needs at least 1 day.');
    }
    if (meta && meta.periods && !meta.periods.includes(goal.period)) {
        errors.push(`${meta.label} does not support the “${GOAL_PERIOD_LABELS[goal.period] || goal.period}” period.`);
    }
    if (goal.type === 'no_use_day' && !(goal.config?.weekdays || []).length) {
        errors.push('Choose at least one protected weekday.');
    }
    if (goal.type === 'no_purchase_before_date' && !parseLocalDate(goal.config?.beforeDate || '')) {
        errors.push('Choose the date you are holding out for.');
    }
    if (meta?.requiresPlan && !goal.linkedPlanId) {
        errors.push('Plan adherence goals need a linked taper plan.');
    }
    if (goal.baselineMode === 'manual' && goalNeedsBaseline(goal) && !Number.isFinite(goalToNumber(goal.baselineValue, NaN))) {
        errors.push('Manual baseline needs a numeric value.');
    }
    if (!goalIsAllSubstances(goal.substanceId) && !getSubstance(goal.substanceId, data)) {
        errors.push('Selected substance no longer exists.');
    }
    return { valid: errors.length === 0, errors };
}

function pushGoalChange(goal, action, detail = {}) {
    if (!goal) return null;
    if (!Array.isArray(goal.changeHistory)) goal.changeHistory = [];
    const entry = { at: new Date().toISOString(), action: String(action || 'updated'), detail: detail || {} };
    goal.changeHistory.push(entry);
    if (goal.changeHistory.length > 60) goal.changeHistory = goal.changeHistory.slice(-60);
    goal.updatedAt = entry.at;
    return entry;
}

function goalAfterMutation(data = appData, { persist = true } = {}) {
    if (persist) saveData(data);
    invalidateCalendarEventsCache?.();
    invalidateRecoveryDashboardCache?.();
}

function saveGoalRecord(patch, { data = appData, action = null, silent = false } = {}) {
    ensureGoals(data);
    const isNew = !patch?.id || !getGoalById(patch.id, data);
    const existing = isNew ? null : getGoalById(patch.id, data);
    const merged = normalizeGoalRecord({
        ...(existing || getDefaultGoalRecord()),
        ...patch,
        id: existing?.id || patch?.id || createGoalId(),
        createdAt: existing?.createdAt || new Date().toISOString()
    });

    const validation = validateGoalRecord(merged, data);
    if (!validation.valid) return { ok: false, errors: validation.errors, goal: merged };

    if (existing) {
        const changed = goalDiffFields(existing, merged);
        Object.assign(existing, merged);
        pushGoalChange(existing, action || 'updated', { fields: changed });
        goalAfterMutation(data, { persist: !silent });
        return { ok: true, errors: [], goal: existing, created: false };
    }

    pushGoalChange(merged, action || 'created', { type: merged.type, target: merged.targetValue });
    data.goals.push(merged);
    goalAfterMutation(data, { persist: !silent });
    return { ok: true, errors: [], goal: merged, created: true };
}

function goalDiffFields(before, after) {
    const skip = new Set(['changeHistory', 'periodHistory', 'updatedAt']);
    const fields = [];
    Object.keys(after).forEach(key => {
        if (skip.has(key)) return;
        const a = JSON.stringify(before?.[key] ?? null);
        const b = JSON.stringify(after?.[key] ?? null);
        if (a !== b) fields.push(key);
    });
    return fields;
}

function createGoalFromTemplate(templateId, overrides = {}, data = appData) {
    const template = GOAL_TEMPLATES.find(t => t.id === templateId);
    if (!template) return null;
    const today = goalTodayStr();
    const base = getDefaultGoalRecord();
    const durationDays = goalToNumber(template.goal.durationDays, 0);
    const draft = normalizeGoalRecord({
        ...base,
        ...template.goal,
        id: createGoalId(),
        startDate: overrides.startDate || today,
        endDate: overrides.endDate || (durationDays > 0 ? addDaysYYYYMMDD(today, durationDays - 1) : ''),
        substanceId: overrides.substanceId || base.substanceId,
        source: `template:${template.id}`,
        status: 'draft',
        ...overrides
    });
    delete draft.durationDays;
    if (goalNeedsBaseline(draft) && draft.baselineMode === 'auto') {
        const baseline = computeGoalAutoBaseline(draft, data);
        draft.baselineValue = baseline.value;
        draft.baselineStartDate = baseline.startDate;
        draft.baselineEndDate = baseline.endDate;
    }
    return draft;
}

function duplicateGoal(goalId, data = appData) {
    const source = getGoalById(goalId, data);
    if (!source) return null;
    const copy = normalizeGoalRecord({
        ...JSON.parse(JSON.stringify(source)),
        id: createGoalId(),
        name: `${source.name} (copy)`,
        status: 'draft',
        periodHistory: [],
        changeHistory: [],
        completedAt: '',
        archivedAt: '',
        createdAt: new Date().toISOString(),
        source: `duplicate:${source.id}`
    });
    pushGoalChange(copy, 'duplicated', { from: source.id });
    data.goals.push(copy);
    goalAfterMutation(data);
    return copy;
}

function goalSetStatus(goalId, status, action, detail = {}, data = appData) {
    const goal = getGoalById(goalId, data);
    if (!goal || !GOAL_LIFECYCLE.includes(status)) return null;
    const previous = goal.status;
    goal.status = status;
    if (status === 'completed' && !goal.completedAt) goal.completedAt = new Date().toISOString();
    if (status === 'archived' && !goal.archivedAt) goal.archivedAt = new Date().toISOString();
    if (status === 'active') {
        goal.completedAt = '';
        goal.archivedAt = '';
    }
    pushGoalChange(goal, action, { from: previous, to: status, ...detail });
    goalAfterMutation(data);
    return goal;
}

function pauseGoal(goalId, data = appData) {
    return goalSetStatus(goalId, 'paused', 'paused', {}, data);
}

function resumeGoal(goalId, data = appData) {
    return goalSetStatus(goalId, 'active', 'resumed', {}, data);
}

function completeGoalManually(goalId, note = '', data = appData) {
    const goal = goalSetStatus(goalId, 'completed', 'completed-manually', { note }, data);
    if (goal && note) goal.notes = goal.notes ? `${goal.notes}\n${note}` : note;
    return goal;
}

function archiveGoal(goalId, data = appData) {
    return goalSetStatus(goalId, 'archived', 'archived', {}, data);
}

/** Removes only the goal record — logs, purchases, and taper plans are untouched. */
function deleteGoal(goalId, data = appData) {
    ensureGoals(data);
    const index = data.goals.findIndex(g => g.id === goalId);
    if (index === -1) return false;
    const [removed] = data.goals.splice(index, 1);
    if (typeof pushChangeHistory === 'function') {
        pushChangeHistory('goal-deleted', { goalId, name: removed?.name || '' });
    }
    goalAfterMutation(data);
    return true;
}

function unlinkGoalFromPlan(goalId, data = appData) {
    const goal = getGoalById(goalId, data);
    if (!goal || !goal.linkedPlanId) return null;
    const previous = goal.linkedPlanId;
    goal.linkedPlanId = '';
    if (getGoalTypeMeta(goal.type).requiresPlan) goal.needsReview = true;
    pushGoalChange(goal, 'plan-unlinked', { planId: previous });
    goalAfterMutation(data);
    return goal;
}

function suggestGoalsFromPlan(planId, data = appData) {
    if (typeof ensureTaperPlansV2 === 'function') ensureTaperPlansV2(data);
    const plan = (data.taperPlansV2 || []).find(p => p?.id === planId);
    if (!plan) return [];
    const today = goalTodayStr();
    const substanceId = plan.substanceId || DASHBOARD_ALL;
    const substanceName = goalSubstanceLabel(substanceId, data);
    const suggestions = [];

    const weeklyTargets = Array.isArray(plan.weeklyTargets) ? plan.weeklyTargets : [];
    const upcoming = weeklyTargets.find(w => (w.weekEnd || w.weekStart || '') >= today) || weeklyTargets[0];
    const weeklyTarget = goalToNumber(upcoming?.targetAmount ?? upcoming?.target ?? upcoming?.amount, 0);
    if (weeklyTarget > 0) {
        suggestions.push(normalizeGoalRecord({
            id: createGoalId(),
            name: `Weekly cap · ${substanceName}`,
            description: `Matches the current weekly target from “${plan.name || 'taper plan'}”.`,
            type: 'max_weekly_use',
            substanceId,
            targetValue: weeklyTarget,
            period: 'weekly',
            recurring: true,
            startDate: today,
            endDate: plan.endDate || '',
            linkedPlanId: plan.id,
            status: 'draft',
            source: `plan-suggestion:${plan.id}`
        }));
    }

    const monthlySpend = goalToNumber(plan.monthlySpendTarget ?? plan.spendTarget, 0);
    if (monthlySpend > 0) {
        suggestions.push(normalizeGoalRecord({
            id: createGoalId(),
            name: `Monthly spend cap · ${substanceName}`,
            description: `Keeps spending in line with “${plan.name || 'taper plan'}”.`,
            type: 'max_monthly_spend',
            substanceId,
            targetValue: monthlySpend,
            period: 'monthly',
            recurring: true,
            startDate: today,
            linkedPlanId: plan.id,
            status: 'draft',
            source: `plan-suggestion:${plan.id}`
        }));
    }

    suggestions.push(normalizeGoalRecord({
        id: createGoalId(),
        name: `Plan adherence streak · ${substanceName}`,
        description: 'Consecutive days at or under the plan target.',
        type: 'plan_adherence_streak',
        substanceId,
        targetValue: 14,
        period: 'entire',
        startDate: today,
        linkedPlanId: plan.id,
        status: 'draft',
        source: `plan-suggestion:${plan.id}`
    }));

    const goalDate = plan.goalDate || plan.quitDate || plan.endDate;
    if (goalDate) {
        suggestions.push(normalizeGoalRecord({
            id: createGoalId(),
            name: `No buying before ${goalFormatDate(goalDate)}`,
            description: 'Hold off restocking until the plan milestone.',
            type: 'no_purchase_before_date',
            substanceId,
            period: 'entire',
            startDate: today,
            endDate: goalDate,
            config: { beforeDate: goalDate },
            linkedPlanId: plan.id,
            status: 'draft',
            source: `plan-suggestion:${plan.id}`
        }));
    }

    return suggestions;
}

// ——— Goal System: period engine ———

function goalQuarterBounds(dateStr) {
    const d = parseLocalDate(dateStr) || new Date();
    const quarter = Math.floor(d.getMonth() / 3);
    const startMonth = quarter * 3;
    const start = `${d.getFullYear()}-${String(startMonth + 1).padStart(2, '0')}-01`;
    return { start, end: getMonthEndDateStr(`${d.getFullYear()}-${String(startMonth + 3).padStart(2, '0')}-01`) };
}

function resolveGoalPeriodBounds(goal, referenceDate = goalTodayStr()) {
    const today = goalTodayStr();
    const ref = referenceDate || today;
    const period = goal?.period || 'entire';
    let periodStart = ref;
    let periodEnd = ref;
    let label = goalFormatDate(ref);

    if (period === 'daily') {
        periodStart = ref;
        periodEnd = ref;
        label = goalFormatDate(ref);
    } else if (period === 'weekly') {
        periodStart = getWeekStartDateStr(ref);
        periodEnd = addDaysYYYYMMDD(periodStart, 6);
        label = `Week of ${goalFormatDate(periodStart)}`;
    } else if (period === 'monthly') {
        periodStart = getMonthStartDateStr(ref);
        periodEnd = getMonthEndDateStr(ref);
        label = `Month of ${goalFormatDate(periodStart)}`;
    } else if (period === 'quarterly') {
        const q = goalQuarterBounds(ref);
        periodStart = q.start;
        periodEnd = q.end;
        label = `Quarter from ${goalFormatDate(periodStart)}`;
    } else if (period === 'yearly') {
        const year = (parseLocalDate(ref) || new Date()).getFullYear();
        periodStart = `${year}-01-01`;
        periodEnd = `${year}-12-31`;
        label = `Year ${year}`;
    } else if (period === 'rolling') {
        const days = Math.max(1, Math.round(goalToNumber(goal?.rollingDays, 7)));
        periodEnd = ref;
        periodStart = addDaysYYYYMMDD(ref, -(days - 1));
        label = `Last ${days} day${days === 1 ? '' : 's'}`;
    } else {
        periodStart = goal?.startDate || ref;
        periodEnd = goal?.endDate || (ref > periodStart ? ref : periodStart);
        label = goal?.endDate
            ? `${goalFormatDate(periodStart)} – ${goalFormatDate(goal.endDate)}`
            : `Since ${goalFormatDate(periodStart)}`;
    }

    // Clamp to the goal window so partial first/last periods stay honest.
    if (goal?.startDate && periodStart < goal.startDate) periodStart = goal.startDate;
    if (goal?.endDate && periodEnd > goal.endDate) periodEnd = goal.endDate;
    if (periodEnd < periodStart) periodEnd = periodStart;

    const daysTotal = countDaysInRange(periodStart, periodEnd);
    const cappedToday = today < periodStart ? periodStart : (today > periodEnd ? periodEnd : today);
    const daysElapsed = today < periodStart ? 0 : countDaysInRange(periodStart, cappedToday);

    return {
        periodStart,
        periodEnd,
        label,
        key: `${periodStart}..${periodEnd}`,
        daysTotal,
        daysElapsed,
        daysRemaining: Math.max(0, daysTotal - daysElapsed),
        ended: periodEnd < today,
        started: periodStart <= today,
        isCurrent: periodStart <= today && periodEnd >= today
    };
}

function listGoalPeriodStarts(goal, { limit = 26, upTo = goalTodayStr() } = {}) {
    const starts = [];
    if (!goal) return starts;
    if (goal.period === 'entire' || !goal.recurring) {
        starts.push(resolveGoalPeriodBounds(goal, upTo));
        return starts;
    }
    let cursor = goal.startDate || upTo;
    let guard = 0;
    const hardEnd = goal.endDate && goal.endDate < upTo ? goal.endDate : upTo;
    while (cursor <= hardEnd && guard < 1000) {
        const bounds = resolveGoalPeriodBounds(goal, cursor);
        starts.push(bounds);
        const next = addDaysYYYYMMDD(bounds.periodEnd, 1);
        if (!next || next <= cursor) break;
        cursor = next;
        guard += 1;
    }
    return starts.slice(-limit);
}

// ——— Goal System: aggregation helpers ———

function goalUseLogsInRange(goal, startDate, endDate, data = appData) {
    return (data.logs || []).filter(log => {
        if (!logCountsTowardPersonalUseStats(log)) return false;
        const dateStr = getLogDateStr(log);
        if (!dateStr || dateStr < startDate || dateStr > endDate) return false;
        return goalMatchesSubstance(getUseSubstanceId(log), goal?.substanceId, data);
    });
}

function goalAllLogsInRange(goal, startDate, endDate, data = appData) {
    return (data.logs || []).filter(log => {
        const dateStr = getLogDateStr(log);
        if (!dateStr || dateStr < startDate || dateStr > endDate) return false;
        return goalMatchesSubstance(getUseSubstanceId(log), goal?.substanceId, data);
    });
}

function goalPurchasesInRange(goal, startDate, endDate, data = appData, { spendOnly = true } = {}) {
    return (data.purchases || []).filter(purchase => {
        if (spendOnly && !purchaseCountsTowardSpend(purchase)) return false;
        const dateStr = getPurchaseDateStr(purchase);
        if (!dateStr || dateStr < startDate || dateStr > endDate) return false;
        return goalMatchesSubstance(getPurchaseSubstanceId(purchase), goal?.substanceId, data);
    }).sort((a, b) => (getPurchaseDateStr(a) < getPurchaseDateStr(b) ? -1 : 1));
}

function goalSubstanceIdsForGoal(goal, data = appData) {
    if (!goalIsAllSubstances(goal?.substanceId)) return [goal.substanceId];
    return getActiveSubstances(data).map(s => s.id);
}

/**
 * Never fabricates a cross-substance total: when a goal covers every substance the
 * result is a grouped list in each substance's own units.
 */
function sumGoalUseInRange(goal, startDate, endDate, data = appData) {
    const ids = goalSubstanceIdsForGoal(goal, data);
    const groups = ids.map(id => {
        const value = goalToNumber(getCanonicalUsageInRange(id, startDate, endDate, data), 0);
        const group = {
            substanceId: id,
            label: getSubstanceDisplayName(id, data),
            unit: getSubstanceDisplayUnit(id, data),
            value
        };
        if (isWeedTrackingMode(id, data)) {
            const breakdown = getWeedProductTypeUsageInRange(id, startDate, endDate, data) || [];
            group.breakdown = (Array.isArray(breakdown) ? breakdown : []).map(b => ({
                productType: normalizeWeedProductType(b.productType || b.type, { allowEmpty: true }) || 'bud',
                amount: goalToNumber(b.amount ?? b.value, 0),
                unit: b.unit || group.unit
            })).filter(b => b.amount > 0);
        }
        return group;
    }).filter(g => g.value > 0 || ids.length === 1);

    const single = ids.length === 1;
    return {
        grouped: !single,
        groups,
        value: single ? goalToNumber(groups[0]?.value, 0) : null,
        unit: single ? (groups[0]?.unit || '') : ''
    };
}

function sumGoalSpendInRange(goal, startDate, endDate, data = appData) {
    let total = 0;
    let count = 0;
    goalPurchasesInRange(goal, startDate, endDate, data).forEach(purchase => {
        total += goalToNumber(getPurchaseSpendAmount(purchase), 0);
        count += 1;
    });
    return { value: goalRoundTo(total, 2), count };
}

function goalUseDaySet(goal, startDate, endDate, data = appData) {
    const days = new Set();
    goalUseLogsInRange(goal, startDate, endDate, data).forEach(log => {
        if (goalToNumber(getLogPersonalAmount(log), 0) <= 0) return;
        const dateStr = getLogDateStr(log);
        if (dateStr) days.add(dateStr);
    });
    // Canonical usage catches tracking modes (vape/nicotine) that do not carry personal amounts.
    goalSubstanceIdsForGoal(goal, data).forEach(id => {
        iterateDatesInRange(startDate, endDate).forEach(dateStr => {
            if (days.has(dateStr)) return;
            if (goalToNumber(getCanonicalUsageOnDate(id, dateStr, data), 0) > 0) days.add(dateStr);
        });
    });
    return days;
}

function goalLoggedDaySet(goal, startDate, endDate, data = appData) {
    const days = new Set();
    goalAllLogsInRange(goal, startDate, endDate, data).forEach(log => {
        const dateStr = getLogDateStr(log);
        if (dateStr) days.add(dateStr);
    });
    goalPurchasesInRange(goal, startDate, endDate, data, { spendOnly: false }).forEach(purchase => {
        const dateStr = getPurchaseDateStr(purchase);
        if (dateStr) days.add(dateStr);
    });
    return days;
}

function goalPurchaseDayCount(goal, startDate, endDate, data = appData) {
    const days = new Set();
    goalPurchasesInRange(goal, startDate, endDate, data).forEach(p => {
        const dateStr = getPurchaseDateStr(p);
        if (dateStr) days.add(dateStr);
    });
    return days.size;
}

function goalWeekdayOf(dateStr) {
    const d = parseLocalDate(dateStr);
    return d ? d.getDay() : -1;
}

function goalCountUseDaysMatching(goal, startDate, endDate, predicate, data = appData) {
    let count = 0;
    const matched = [];
    goalUseDaySet(goal, startDate, endDate, data).forEach(dateStr => {
        if (predicate(goalWeekdayOf(dateStr), dateStr)) {
            count += 1;
            matched.push(dateStr);
        }
    });
    matched.sort();
    return { count, dates: matched };
}

function goalActiveInventoryTotals(goal, data = appData) {
    const ids = goalSubstanceIdsForGoal(goal, data);
    const groups = ids.map(id => ({ substanceId: id, label: getSubstanceDisplayName(id, data), unit: getSubstanceDisplayUnit(id, data), value: 0 }));
    const byId = new Map(groups.map(g => [String(g.substanceId), g]));
    (data.purchases || []).forEach(purchase => {
        if (!goalMatchesSubstance(getPurchaseSubstanceId(purchase), goal?.substanceId, data)) return;
        if (getPurchaseInventoryTab(purchase) !== 'active') return;
        const remaining = goalToNumber(getPurchaseRemainingAmount(purchase), 0);
        if (remaining <= 0) return;
        const key = String(getPurchaseSubstanceId(purchase));
        const group = byId.get(key) || byId.get(String(ids[0]));
        if (group) group.value += remaining;
    });
    const single = ids.length === 1;
    return {
        grouped: !single,
        groups: groups.filter(g => g.value > 0 || single),
        value: single ? goalRoundTo(groups[0]?.value, 3) : null,
        unit: single ? groups[0]?.unit || '' : ''
    };
}

function goalNoUseStreakDays(goal, data = appData) {
    const today = goalTodayStr();
    let streak = 0;
    let cursor = today;
    for (let i = 0; i < 3650; i++) {
        if (goal?.startDate && cursor < goal.startDate) break;
        const used = goalSubstanceIdsForGoal(goal, data)
            .some(id => goalToNumber(getCanonicalUsageOnDate(id, cursor, data), 0) > 0);
        if (used) break;
        streak += 1;
        cursor = addDaysYYYYMMDD(cursor, -1);
    }
    return streak;
}

function goalLoggingStreakDays(goal, data = appData) {
    const today = goalTodayStr();
    const logged = new Set();
    (data.logs || []).forEach(log => {
        if (!goalMatchesSubstance(getUseSubstanceId(log), goal?.substanceId, data)) return;
        const dateStr = getLogDateStr(log);
        if (dateStr) logged.add(dateStr);
    });
    (data.purchases || []).forEach(p => {
        if (!goalMatchesSubstance(getPurchaseSubstanceId(p), goal?.substanceId, data)) return;
        const dateStr = getPurchaseDateStr(p);
        if (dateStr) logged.add(dateStr);
    });
    let streak = 0;
    let cursor = today;
    while (logged.has(cursor) && streak < 3650) {
        streak += 1;
        cursor = addDaysYYYYMMDD(cursor, -1);
    }
    return streak;
}

function goalPlanDailyTargetForDate(plan, dateStr) {
    if (!plan) return null;
    const weekly = Array.isArray(plan.weeklyTargets) ? plan.weeklyTargets : [];
    const row = weekly.find(w => {
        const start = w.weekStart || '';
        const end = w.weekEnd || (start ? addDaysYYYYMMDD(start, 6) : '');
        return start && end && dateStr >= start && dateStr <= end;
    });
    if (!row) return null;
    const daily = row.dailyTarget ?? row.targetPerDay;
    if (daily != null && daily !== '') return goalToNumber(daily, 0);
    const weeklyTarget = goalToNumber(row.targetAmount ?? row.target ?? row.amount, NaN);
    return Number.isFinite(weeklyTarget) ? weeklyTarget / 7 : null;
}

function goalPlanAdherenceStreakDays(goal, data = appData) {
    const plan = (data.taperPlansV2 || []).find(p => p?.id === goal?.linkedPlanId);
    if (!plan) return null;
    const substanceId = plan.substanceId || (goalIsAllSubstances(goal?.substanceId) ? null : goal.substanceId);
    if (!substanceId) return null;
    let streak = 0;
    let cursor = goalTodayStr();
    for (let i = 0; i < 3650; i++) {
        if (goal?.startDate && cursor < goal.startDate) break;
        const target = goalPlanDailyTargetForDate(plan, cursor);
        if (target == null) break;
        const used = goalToNumber(getCanonicalUsageOnDate(substanceId, cursor, data), 0);
        if (used > target + 1e-9) break;
        streak += 1;
        cursor = addDaysYYYYMMDD(cursor, -1);
    }
    return streak;
}

function goalMinDaysBetweenPurchases(goal, startDate, endDate, data = appData) {
    const purchases = goalPurchasesInRange(goal, startDate, endDate, data);
    const dates = [...new Set(purchases.map(getPurchaseDateStr).filter(Boolean))].sort();
    if (dates.length === 0) {
        const streak = computeNoPurchaseStreakDays(goalIsAllSubstances(goal?.substanceId) ? null : goal.substanceId, data);
        return { value: goalToNumber(streak?.days, 0), gaps: [], hasData: true, sinceLabel: streak?.sinceLabel || '' };
    }
    if (dates.length === 1) {
        const gap = countDaysInRange(dates[0], endDate) - 1;
        return { value: Math.max(0, gap), gaps: [], hasData: true, sinceLabel: `Since ${goalFormatDate(dates[0])}` };
    }
    const gaps = [];
    for (let i = 1; i < dates.length; i++) {
        gaps.push({ from: dates[i - 1], to: dates[i], days: countDaysInRange(dates[i - 1], dates[i]) - 1 });
    }
    return { value: Math.min(...gaps.map(g => g.days)), gaps, hasData: true, sinceLabel: '' };
}

function computeGoalAutoBaseline(goal, data = appData) {
    const lookback = Math.max(1, Math.round(goalToNumber(goal?.baselineLookbackDays, 28)));
    const anchor = goal?.startDate || goalTodayStr();
    const endDate = addDaysYYYYMMDD(anchor, -1);
    const startDate = addDaysYYYYMMDD(endDate, -(lookback - 1));
    const meta = getGoalTypeMeta(goal?.type);
    const periodDays = Math.max(1, resolveGoalPeriodBounds(goal, anchor).daysTotal);

    if (meta.aggregation === 'spend_reduction_pct') {
        const spend = sumGoalSpendInRange(goal, startDate, endDate, data).value;
        return { value: goalRoundTo((spend / lookback) * periodDays, 2), startDate, endDate, perDay: goalRoundTo(spend / lookback, 4) };
    }
    const use = sumGoalUseInRange(goal, startDate, endDate, data);
    const total = use.grouped
        ? null
        : goalToNumber(use.value, 0);
    if (total == null) {
        // Grouped baselines are stored per substance to avoid unit-mixing.
        const groups = use.groups.map(g => ({ ...g, perDay: goalRoundTo(g.value / lookback, 4), periodValue: goalRoundTo((g.value / lookback) * periodDays, 4) }));
        return { value: null, groups, startDate, endDate };
    }
    return { value: goalRoundTo((total / lookback) * periodDays, 4), startDate, endDate, perDay: goalRoundTo(total / lookback, 4) };
}

function getGoalBaseline(goal, data = appData) {
    if (!goalNeedsBaseline(goal)) return { value: null, groups: null, hasData: true, mode: 'none' };
    if (goal.baselineMode === 'manual') {
        const value = goalToNumber(goal.baselineValue, NaN);
        return { value: Number.isFinite(value) ? value : null, groups: null, hasData: Number.isFinite(value), mode: 'manual', startDate: goal.baselineStartDate, endDate: goal.baselineEndDate };
    }
    if (Number.isFinite(goalToNumber(goal.baselineValue, NaN)) && goal.baselineStartDate) {
        return { value: goalToNumber(goal.baselineValue, 0), groups: null, hasData: true, mode: 'stored', startDate: goal.baselineStartDate, endDate: goal.baselineEndDate };
    }
    const auto = computeGoalAutoBaseline(goal, data);
    const hasData = auto.value != null ? auto.value > 0 : !!auto.groups?.some(g => g.periodValue > 0);
    return { ...auto, groups: auto.groups || null, hasData, mode: 'auto' };
}

// ——— Goal System: actual computation ———

function computeGoalActual(goal, bounds, data = appData) {
    const meta = getGoalTypeMeta(goal?.type);
    const start = bounds.periodStart;
    const end = bounds.periodEnd;
    const empty = { value: null, groups: null, unitKind: meta.unitKind, hasData: false, detail: {} };
    if (!goal) return empty;

    switch (meta.aggregation) {
        case 'use_amount': {
            const use = sumGoalUseInRange(goal, start, end, data);
            return {
                value: use.grouped ? null : goalRoundTo(use.value, 3),
                groups: use.grouped ? use.groups : null,
                unitKind: 'substance',
                unit: use.unit,
                hasData: true,
                detail: { groups: use.groups }
            };
        }
        case 'use_session_max': {
            const logs = goalUseLogsInRange(goal, start, end, data);
            const byId = new Map();
            logs.forEach(log => {
                const amount = goalToNumber(getLogPersonalAmount(log), 0);
                if (amount <= 0) return;
                const id = getUseSubstanceId(log);
                const prev = byId.get(id);
                if (!prev || amount > prev.value) {
                    byId.set(id, {
                        substanceId: id,
                        label: getSubstanceDisplayName(id, data),
                        unit: getSubstanceDisplayUnit(id, data),
                        value: goalRoundTo(amount, 3),
                        date: getLogDateStr(log)
                    });
                }
            });
            const groups = [...byId.values()];
            const single = !goalIsAllSubstances(goal.substanceId);
            return {
                value: single ? goalRoundTo(groups[0]?.value ?? 0, 3) : null,
                groups: single ? null : groups,
                unitKind: 'substance',
                unit: single ? getSubstanceDisplayUnit(goal.substanceId, data) : '',
                hasData: logs.length > 0,
                detail: { groups, sessions: logs.length }
            };
        }
        case 'use_days': {
            const days = goalUseDaySet(goal, start, end, data);
            return { value: days.size, groups: null, unitKind: 'days', hasData: true, detail: { dates: [...days].sort() } };
        }
        case 'use_days_on_weekdays': {
            const weekdays = (goal.config?.weekdays || []);
            const res = goalCountUseDaysMatching(goal, start, end, dow => weekdays.includes(dow), data);
            return { value: res.count, groups: null, unitKind: 'days', hasData: true, detail: { dates: res.dates, weekdays } };
        }
        case 'weekday_use_days': {
            const res = goalCountUseDaysMatching(goal, start, end, dow => dow >= 1 && dow <= 5, data);
            return { value: res.count, groups: null, unitKind: 'days', hasData: true, detail: { dates: res.dates } };
        }
        case 'weekend_use_days': {
            const res = goalCountUseDaysMatching(goal, start, end, dow => dow === 0 || dow === 6, data);
            return { value: res.count, groups: null, unitKind: 'days', hasData: true, detail: { dates: res.dates } };
        }
        case 'use_reduction_pct': {
            const baseline = getGoalBaseline(goal, data);
            const use = sumGoalUseInRange(goal, start, end, data);
            if (!baseline.hasData) {
                return { ...empty, unitKind: 'percent', detail: { reason: 'no-baseline' } };
            }
            if (use.grouped) {
                const baselineGroups = baseline.groups || [];
                const groups = use.groups.map(g => {
                    const base = baselineGroups.find(b => String(b.substanceId) === String(g.substanceId));
                    const baseValue = goalToNumber(base?.periodValue ?? base?.value, 0);
                    const pct = baseValue > 0 ? ((baseValue - g.value) / baseValue) * 100 : null;
                    return { ...g, baseline: baseValue, value: pct == null ? 0 : goalRoundTo(pct, 1), unit: '%' , rawUse: g.value };
                }).filter(g => g.baseline > 0);
                return { value: null, groups, unitKind: 'percent', hasData: groups.length > 0, detail: { baseline } };
            }
            const baseValue = goalToNumber(baseline.value, 0);
            if (baseValue <= 0) return { ...empty, unitKind: 'percent', detail: { reason: 'zero-baseline', baseline } };
            const pct = ((baseValue - goalToNumber(use.value, 0)) / baseValue) * 100;
            return {
                value: goalRoundTo(pct, 1),
                groups: null,
                unitKind: 'percent',
                hasData: true,
                detail: { baseline, current: goalToNumber(use.value, 0), unit: use.unit }
            };
        }
        case 'spend': {
            const spend = sumGoalSpendInRange(goal, start, end, data);
            return { value: spend.value, groups: null, unitKind: 'currency', hasData: true, detail: { purchases: spend.count } };
        }
        case 'spend_reduction_pct': {
            const baseline = getGoalBaseline(goal, data);
            const spend = sumGoalSpendInRange(goal, start, end, data);
            const baseValue = goalToNumber(baseline.value, 0);
            if (!baseline.hasData || baseValue <= 0) {
                return { ...empty, unitKind: 'percent', detail: { reason: 'no-baseline', baseline } };
            }
            const pct = ((baseValue - spend.value) / baseValue) * 100;
            return { value: goalRoundTo(pct, 1), groups: null, unitKind: 'percent', hasData: true, detail: { baseline, current: spend.value } };
        }
        case 'cost_per_use_day': {
            const spend = sumGoalSpendInRange(goal, start, end, data);
            const useDays = goalUseDaySet(goal, start, end, data).size;
            if (useDays === 0) {
                return { value: 0, groups: null, unitKind: 'currency', hasData: spend.value === 0, detail: { spend: spend.value, useDays } };
            }
            return { value: goalRoundTo(spend.value / useDays, 2), groups: null, unitKind: 'currency', hasData: true, detail: { spend: spend.value, useDays } };
        }
        case 'purchase_count': {
            const purchases = goalPurchasesInRange(goal, start, end, data);
            return {
                value: purchases.length,
                groups: null,
                unitKind: 'count',
                hasData: true,
                detail: { dates: purchases.map(getPurchaseDateStr), purchaseDays: goalPurchaseDayCount(goal, start, end, data) }
            };
        }
        case 'purchase_amount': {
            const purchases = goalPurchasesInRange(goal, start, end, data);
            const byId = new Map();
            purchases.forEach(p => {
                const id = getPurchaseSubstanceId(p);
                const qty = goalToNumber(getPurchaseQuantity(p), 0);
                if (qty <= 0) return;
                const group = byId.get(id) || { substanceId: id, label: getSubstanceDisplayName(id, data), unit: getSubstanceDisplayUnit(id, data), value: 0 };
                group.value = goalRoundTo(group.value + qty, 3);
                byId.set(id, group);
            });
            const groups = [...byId.values()];
            const single = !goalIsAllSubstances(goal.substanceId);
            return {
                value: single ? goalRoundTo(groups[0]?.value ?? 0, 3) : null,
                groups: single ? null : groups,
                unitKind: 'substance',
                unit: single ? getSubstanceDisplayUnit(goal.substanceId, data) : '',
                hasData: true,
                detail: { purchases: purchases.length }
            };
        }
        case 'purchase_min_gap': {
            const gap = goalMinDaysBetweenPurchases(goal, start, end, data);
            return { value: gap.value, groups: null, unitKind: 'days', hasData: gap.hasData, detail: gap };
        }
        case 'purchase_before_date': {
            const beforeDate = goal.config?.beforeDate || goal.endDate || end;
            const limitEnd = beforeDate < end ? addDaysYYYYMMDD(beforeDate, -1) : end;
            const purchases = goalPurchasesInRange(goal, start, limitEnd < start ? start : limitEnd, data);
            const early = purchases.filter(p => getPurchaseDateStr(p) < beforeDate);
            return {
                value: early.length,
                groups: null,
                unitKind: 'count',
                hasData: true,
                detail: { beforeDate, dates: early.map(getPurchaseDateStr) }
            };
        }
        case 'active_inventory': {
            const inv = goalActiveInventoryTotals(goal, data);
            return {
                value: inv.grouped ? null : inv.value,
                groups: inv.grouped ? inv.groups : null,
                unitKind: 'substance',
                unit: inv.unit,
                hasData: true,
                detail: {}
            };
        }
        case 'streak_no_use': {
            return { value: goalNoUseStreakDays(goal, data), groups: null, unitKind: 'days', hasData: true, detail: {} };
        }
        case 'streak_no_purchase': {
            const streak = computeNoPurchaseStreakDays(goalIsAllSubstances(goal.substanceId) ? null : goal.substanceId, data);
            return { value: goalToNumber(streak?.days, 0), groups: null, unitKind: 'days', hasData: true, detail: { sinceLabel: streak?.sinceLabel || '' } };
        }
        case 'streak_logging': {
            return { value: goalLoggingStreakDays(goal, data), groups: null, unitKind: 'days', hasData: true, detail: {} };
        }
        case 'streak_plan_adherence': {
            const streak = goalPlanAdherenceStreakDays(goal, data);
            if (streak == null) return { ...empty, unitKind: 'days', detail: { reason: 'no-plan' } };
            return { value: streak, groups: null, unitKind: 'days', hasData: true, detail: {} };
        }
        case 'custom':
        default: {
            const manual = goal.manualActual;
            const hasData = manual != null && Number.isFinite(goalToNumber(manual, NaN));
            return { value: hasData ? goalToNumber(manual, 0) : null, groups: null, unitKind: meta.unitKind, hasData, detail: { manual: true } };
        }
    }
}

// ——— Goal System: status + evaluation ———

function goalRatioFor(actualValue, target, direction) {
    if (direction === 'min') {
        if (!(target > 0)) return 1;
        return goalClampRatio(goalToNumber(actualValue, 0) / target);
    }
    if (target === 0) return goalToNumber(actualValue, 0) > 0 ? Infinity : 0;
    if (!(target > 0)) return 0;
    return goalClampRatio(goalToNumber(actualValue, 0) / target);
}

function computeGoalStatusFromProgress(goal, progress, prefs = getGoalSystemPrefs()) {
    const status = goal?.status;
    if (status === 'archived') return 'archived';
    if (status === 'cancelled') return 'cancelled';
    if (status === 'paused') return 'paused';
    if (status === 'completed') return 'completed';
    if (status === 'missed') return 'missed';
    if (status === 'draft') return 'draft';
    if (goal?.needsReview) return 'needs_review';
    if (progress?.upcoming) return 'upcoming';
    if (!progress?.hasData) return 'insufficient_data';

    const near = goalToNumber(prefs?.thresholds?.nearLimit, 0.75);
    const atLimit = goalToNumber(prefs?.thresholds?.atLimit, 1);
    const ratio = progress.ratio === Infinity ? Infinity : goalToNumber(progress.ratio, 0);
    const direction = progress.direction || 'max';

    if (direction === 'max') {
        if (progress.periodEnded) return ratio <= atLimit ? 'completed' : 'missed';
        if (ratio > atLimit) return 'exceeded';
        if (ratio >= atLimit) return 'at_limit';
        if (ratio >= near) return 'near_limit';
        return 'on_track';
    }
    if (progress.periodEnded) return ratio >= 1 ? 'completed' : 'missed';
    if (ratio >= 1) return 'achieved';
    if (ratio >= near) return 'in_progress';
    return 'behind';
}

function evaluateGoal(goal, { data = appData, referenceDate = goalTodayStr(), prefs = null } = {}) {
    const resolvedPrefs = prefs || getGoalSystemPrefs(data);
    const meta = getGoalTypeMeta(goal?.type);
    const bounds = resolveGoalPeriodBounds(goal, referenceDate);
    const direction = getGoalDirection(goal);
    const target = getGoalTargetValue(goal);
    const actual = computeGoalActual(goal, bounds, data);

    const groups = Array.isArray(actual.groups) ? actual.groups : null;
    let ratio;
    let groupResults = null;
    if (groups && groups.length) {
        groupResults = groups.map(g => {
            const r = goalRatioFor(g.value, target, direction);
            return { ...g, ratio: r, status: null };
        });
        const ratios = groupResults.map(g => g.ratio).filter(r => Number.isFinite(r) || r === Infinity);
        ratio = direction === 'max'
            ? (ratios.length ? Math.max(...ratios) : 0)
            : (ratios.length ? Math.min(...ratios) : 0);
    } else if (groups && !groups.length) {
        ratio = direction === 'max' ? 0 : 0;
    } else {
        ratio = goalRatioFor(actual.value, target, direction);
    }

    const upcoming = !!goal?.startDate && goal.startDate > referenceDate;
    const goalWindowEnded = !!goal?.endDate && goal.endDate < referenceDate;
    const periodEnded = goalIsPointInTime(goal)
        ? goalWindowEnded
        : (bounds.ended || (goal?.period === 'entire' && goalWindowEnded));

    const progress = {
        actual: actual.value,
        target,
        ratio,
        direction,
        hasData: actual.hasData,
        periodEnded,
        upcoming
    };
    const status = computeGoalStatusFromProgress(goal, progress, resolvedPrefs);
    if (groupResults) {
        groupResults.forEach(g => {
            g.status = computeGoalStatusFromProgress(goal, { ...progress, ratio: g.ratio }, resolvedPrefs);
        });
    }

    const percent = Number.isFinite(ratio) ? Math.min(999, Math.round(ratio * 100)) : 999;
    const remaining = direction === 'max'
        ? (actual.value == null ? null : goalRoundTo(target - goalToNumber(actual.value, 0), 3))
        : (actual.value == null ? null : goalRoundTo(target - goalToNumber(actual.value, 0), 3));

    return {
        goalId: goal?.id || '',
        goal,
        meta,
        bounds,
        periodStart: bounds.periodStart,
        periodEnd: bounds.periodEnd,
        direction,
        target,
        actual: actual.value,
        groups: groupResults,
        unitKind: actual.unitKind || meta.unitKind,
        unit: actual.unit || getGoalUnitLabel(goal, data),
        detail: actual.detail || {},
        hasData: actual.hasData,
        ratio,
        percent,
        remaining,
        status,
        statusLabel: formatGoalStatusLabel(status),
        statusMeta: GOAL_STATUS_META[status] || GOAL_STATUS_META.insufficient_data,
        met: direction === 'max' ? ratio <= 1 : ratio >= 1,
        daysRemaining: bounds.daysRemaining,
        daysElapsed: bounds.daysElapsed,
        upcoming,
        periodEnded,
        evaluatedAt: new Date().toISOString()
    };
}

function syncGoalPeriodHistory(goal, evaluation, { data = appData } = {}) {
    if (!goal || !evaluation) return null;
    if (!Array.isArray(goal.periodHistory)) goal.periodHistory = [];
    const today = goalTodayStr();
    const existing = goal.periodHistory.find(p => p.periodStart === evaluation.periodStart);

    // Finalized past periods are the historical record — never rewrite them.
    if (existing?.finalized) return existing;

    const entry = {
        periodStart: evaluation.periodStart,
        periodEnd: evaluation.periodEnd,
        actual: evaluation.actual,
        target: evaluation.target,
        status: evaluation.status,
        met: evaluation.met,
        finalized: evaluation.periodEnd < today,
        note: existing?.note || '',
        evaluatedAt: evaluation.evaluatedAt
    };
    if (existing) Object.assign(existing, entry);
    else goal.periodHistory.push(entry);
    goal.periodHistory.sort((a, b) => (a.periodStart < b.periodStart ? -1 : a.periodStart > b.periodStart ? 1 : 0));
    if (goal.periodHistory.length > 260) goal.periodHistory = goal.periodHistory.slice(-260);
    return existing || entry;
}

function backfillGoalPeriodHistory(goal, { data = appData, prefs = null } = {}) {
    if (!goal || goal.period === 'entire' || !goal.recurring) return;
    listGoalPeriodStarts(goal, { limit: 26 }).forEach(bounds => {
        if (bounds.periodEnd >= goalTodayStr()) return;
        const existing = (goal.periodHistory || []).find(p => p.periodStart === bounds.periodStart);
        if (existing?.finalized) return;
        const evaluation = evaluateGoal(goal, { data, referenceDate: bounds.periodEnd, prefs });
        syncGoalPeriodHistory(goal, evaluation, { data });
    });
}

function evaluateAllGoals({ data = appData, referenceDate = goalTodayStr(), persist = true, includeArchived = false } = {}) {
    const goals = getGoals(data);
    const prefs = getGoalSystemPrefs(data);
    const evaluations = [];
    let dirty = false;

    goals.forEach(goal => {
        if (!includeArchived && goal.status === 'archived') {
            evaluations.push(evaluateGoal(goal, { data, referenceDate, prefs }));
            return;
        }
        backfillGoalPeriodHistory(goal, { data, prefs });
        const evaluation = evaluateGoal(goal, { data, referenceDate, prefs });
        const before = JSON.stringify(goal.periodHistory);
        syncGoalPeriodHistory(goal, evaluation, { data });
        if (before !== JSON.stringify(goal.periodHistory)) dirty = true;

        if (prefs.autoCompleteFinishedGoals && goal.status === 'active' && goal.endDate && goal.endDate < referenceDate) {
            const finalStatus = evaluation.met ? 'completed' : 'missed';
            goal.status = finalStatus;
            if (finalStatus === 'completed' && !goal.completedAt) goal.completedAt = new Date().toISOString();
            pushGoalChange(goal, `auto-${finalStatus}`, { periodEnd: goal.endDate, actual: evaluation.actual });
            evaluation.status = finalStatus;
            evaluation.statusLabel = formatGoalStatusLabel(finalStatus);
            evaluation.statusMeta = GOAL_STATUS_META[finalStatus];
            dirty = true;
        }
        evaluations.push(evaluation);
    });

    if (dirty && persist) {
        saveData(data);
        invalidateCalendarEventsCache?.();
        invalidateRecoveryDashboardCache?.();
    }
    return evaluations;
}

function getGoalRecurringStats(goal, { data = appData } = {}) {
    const history = (goal?.periodHistory || []).filter(p => p.finalized);
    const total = history.length;
    const met = history.filter(p => p.met).length;
    let currentStreak = 0;
    for (let i = history.length - 1; i >= 0; i--) {
        if (history[i].met) currentStreak += 1;
        else break;
    }
    let bestStreak = 0;
    let run = 0;
    history.forEach(p => {
        if (p.met) {
            run += 1;
            bestStreak = Math.max(bestStreak, run);
        } else {
            run = 0;
        }
    });
    const values = history.map(p => goalToNumber(p.actual, 0));
    const average = values.length ? goalRoundTo(values.reduce((a, b) => a + b, 0) / values.length, 2) : null;
    const firstHalf = values.slice(0, Math.floor(values.length / 2));
    const secondHalf = values.slice(Math.ceil(values.length / 2));
    const avg = arr => (arr.length ? arr.reduce((a, b) => a + b, 0) / arr.length : null);
    const trendDelta = firstHalf.length && secondHalf.length ? goalRoundTo(avg(secondHalf) - avg(firstHalf), 2) : null;

    return {
        totalPeriods: total,
        metCount: met,
        missedCount: total - met,
        successRate: total ? goalRoundTo((met / total) * 100, 1) : null,
        currentStreak,
        bestStreak,
        average,
        trendDelta,
        lastPeriod: history[history.length - 1] || null,
        history
    };
}

function goalEvaluationBucket(evaluation) {
    const status = evaluation?.status;
    if (status === 'paused') return 'paused';
    if (status === 'archived' || status === 'cancelled') return 'history';
    if (status === 'upcoming' || status === 'draft') return 'upcoming';
    if (status === 'completed') return 'completed';
    if (status === 'missed') return 'missed';
    return 'active';
}

const GOAL_STATUS_URGENCY = Object.freeze({
    exceeded: 0, at_limit: 1, behind: 2, near_limit: 3, needs_review: 4,
    in_progress: 5, on_track: 6, achieved: 7, insufficient_data: 8,
    upcoming: 9, draft: 10, paused: 11, missed: 12, completed: 13,
    cancelled: 14, archived: 15
});

function filterAndSortGoalEvaluations(evaluations, options = {}) {
    const {
        bucket = 'active',
        substanceId = 'all',
        category = 'all',
        type = 'all',
        search = '',
        sortBy = 'status',
        data = appData
    } = options;
    const needle = String(search || '').trim().toLowerCase();

    let list = (evaluations || []).filter(ev => {
        if (!ev?.goal) return false;
        if (bucket !== 'all' && goalEvaluationBucket(ev) !== bucket) return false;
        if (category !== 'all' && ev.goal.category !== category) return false;
        if (type !== 'all' && ev.goal.type !== type) return false;
        // All-substance goals stay visible even when filtering down to one substance.
        if (!goalIsAllSubstances(substanceId)
            && !goalIsAllSubstances(ev.goal.substanceId)
            && !recoveryDashboardMatchesSubstance(ev.goal.substanceId, substanceId, data)) {
            return false;
        }
        if (needle) {
            const haystack = [
                ev.goal.name, ev.goal.description, ev.goal.notes,
                getGoalTypeMeta(ev.goal.type).label, (ev.goal.tags || []).join(' ')
            ].join(' ').toLowerCase();
            if (!haystack.includes(needle)) return false;
        }
        return true;
    });

    const priorityRank = { high: 0, normal: 1, low: 2 };
    list = [...list].sort((a, b) => {
        if (sortBy === 'name') return String(a.goal.name).localeCompare(String(b.goal.name));
        if (sortBy === 'created') return String(b.goal.createdAt).localeCompare(String(a.goal.createdAt));
        if (sortBy === 'priority') {
            const diff = (priorityRank[a.goal.priority] ?? 1) - (priorityRank[b.goal.priority] ?? 1);
            if (diff) return diff;
        }
        if (sortBy === 'deadline') {
            const ad = a.goal.endDate || a.periodEnd || '9999-12-31';
            const bd = b.goal.endDate || b.periodEnd || '9999-12-31';
            if (ad !== bd) return ad < bd ? -1 : 1;
        }
        if (sortBy === 'progress') {
            const ar = Number.isFinite(a.ratio) ? a.ratio : 999;
            const br = Number.isFinite(b.ratio) ? b.ratio : 999;
            if (ar !== br) return br - ar;
        }
        const au = GOAL_STATUS_URGENCY[a.status] ?? 20;
        const bu = GOAL_STATUS_URGENCY[b.status] ?? 20;
        if (au !== bu) return au - bu;
        return String(a.goal.name).localeCompare(String(b.goal.name));
    });
    return list;
}

function buildGoalReminders(evaluations = null, { data = appData } = {}) {
    const prefs = getGoalSystemPrefs(data);
    const evals = evaluations || evaluateAllGoals({ data, persist: false });
    const today = goalTodayStr();
    const reminders = [];
    if (!prefs.remindersEnabled) return { reminders, disclaimer: GOAL_REMINDER_DISCLAIMER };

    evals.forEach(ev => {
        const goal = ev.goal;
        if (!goal || goal.reminders?.enabled === false) return;
        if (['archived', 'cancelled', 'paused'].includes(goal.status)) return;
        const lead = goalToNumber(goal.reminders?.leadDays, prefs.reminderLeadDays);

        if (ev.status === 'exceeded') {
            reminders.push({
                goalId: goal.id, kind: 'over-limit', severity: 'high',
                title: `Over limit · ${goal.name}`,
                message: `${formatGoalActualDisplay(goal, ev, data)} against a target of ${formatGoalTargetDisplay(goal, data)}.`,
                date: today
            });
        } else if (ev.status === 'at_limit' || ev.status === 'near_limit') {
            reminders.push({
                goalId: goal.id, kind: 'approaching', severity: 'medium',
                title: `Close to your limit · ${goal.name}`,
                message: `${ev.percent}% of the ${GOAL_PERIOD_LABELS[goal.period] || goal.period} target used with ${ev.daysRemaining} day${ev.daysRemaining === 1 ? '' : 's'} left.`,
                date: today
            });
        } else if (ev.status === 'behind') {
            reminders.push({
                goalId: goal.id, kind: 'behind', severity: 'medium',
                title: `Behind pace · ${goal.name}`,
                message: `At ${ev.percent}% of target with ${ev.daysRemaining} day${ev.daysRemaining === 1 ? '' : 's'} to go.`,
                date: today
            });
        }

        if (goal.endDate && goal.endDate >= today) {
            const daysOut = countDaysInRange(today, goal.endDate) - 1;
            if (daysOut <= lead) {
                reminders.push({
                    goalId: goal.id, kind: 'deadline', severity: daysOut === 0 ? 'high' : 'low',
                    title: daysOut === 0 ? `Deadline today · ${goal.name}` : `Deadline in ${daysOut} day${daysOut === 1 ? '' : 's'} · ${goal.name}`,
                    message: `Goal window ends ${goalFormatDate(goal.endDate)}.`,
                    date: goal.endDate
                });
            }
        }

        if (ev.status === 'needs_review') {
            reminders.push({
                goalId: goal.id, kind: 'review', severity: 'medium',
                title: `Review needed · ${goal.name}`,
                message: 'This goal was imported or unlinked — confirm the target still fits.',
                date: today
            });
        }
        if (ev.status === 'insufficient_data') {
            reminders.push({
                goalId: goal.id, kind: 'data', severity: 'low',
                title: `Needs more data · ${goal.name}`,
                message: 'Log a bit more or set a baseline so progress can be measured.',
                date: today
            });
        }
    });

    const severityRank = { high: 0, medium: 1, low: 2 };
    reminders.sort((a, b) => (severityRank[a.severity] ?? 3) - (severityRank[b.severity] ?? 3));
    return { reminders, disclaimer: GOAL_REMINDER_DISCLAIMER };
}

function buildGoalDashboardSummary({ data = appData, limit = 4 } = {}) {
    const evaluations = evaluateAllGoals({ data, persist: false });
    const active = evaluations.filter(ev => goalEvaluationBucket(ev) === 'active');
    const counts = { total: evaluations.length, active: 0, completed: 0, missed: 0, paused: 0, upcoming: 0, history: 0, atRisk: 0 };
    evaluations.forEach(ev => {
        const bucket = goalEvaluationBucket(ev);
        if (counts[bucket] != null) counts[bucket] += 1;
        if (['exceeded', 'at_limit', 'near_limit', 'behind'].includes(ev.status)) counts.atRisk += 1;
    });

    const finalized = evaluations.flatMap(ev => (ev.goal.periodHistory || []).filter(p => p.finalized));
    const successRate = finalized.length
        ? goalRoundTo((finalized.filter(p => p.met).length / finalized.length) * 100, 1)
        : null;

    const upcomingDeadlines = evaluations
        .filter(ev => ev.goal.endDate && ev.goal.endDate >= goalTodayStr() && !['archived', 'cancelled'].includes(ev.goal.status))
        .sort((a, b) => (a.goal.endDate < b.goal.endDate ? -1 : 1))
        .slice(0, limit)
        .map(ev => ({ goalId: ev.goal.id, name: ev.goal.name, date: ev.goal.endDate, status: ev.status }));

    return {
        counts,
        successRate,
        scoreContributionEnabled: !!getGoalSystemPrefs(data).scoreContributionEnabled,
        atRisk: filterAndSortGoalEvaluations(evaluations, { bucket: 'active', sortBy: 'status', data }).slice(0, limit),
        highlights: active.slice(0, limit),
        upcomingDeadlines,
        reminders: buildGoalReminders(evaluations, { data }).reminders.slice(0, limit),
        disclaimer: GOAL_REMINDER_DISCLAIMER
    };
}

function buildGoalInsightsAnalytics({ data = appData } = {}) {
    const evaluations = evaluateAllGoals({ data, persist: false });
    const byCategory = {};
    const byType = {};
    const monthly = {};

    evaluations.forEach(ev => {
        const goal = ev.goal;
        const stats = getGoalRecurringStats(goal, { data });
        const catBucket = byCategory[goal.category] || (byCategory[goal.category] = { category: goal.category, goals: 0, periods: 0, met: 0 });
        catBucket.goals += 1;
        catBucket.periods += stats.totalPeriods;
        catBucket.met += stats.metCount;

        const typeBucket = byType[goal.type] || (byType[goal.type] = { type: goal.type, label: getGoalTypeMeta(goal.type).label, goals: 0, periods: 0, met: 0 });
        typeBucket.goals += 1;
        typeBucket.periods += stats.totalPeriods;
        typeBucket.met += stats.metCount;

        stats.history.forEach(p => {
            const month = String(p.periodStart).slice(0, 7);
            const m = monthly[month] || (monthly[month] = { month, periods: 0, met: 0 });
            m.periods += 1;
            if (p.met) m.met += 1;
        });
    });

    const rate = obj => (obj.periods ? goalRoundTo((obj.met / obj.periods) * 100, 1) : null);
    const categories = Object.values(byCategory).map(c => ({ ...c, successRate: rate(c) }));
    const types = Object.values(byType).map(t => ({ ...t, successRate: rate(t) }));
    const trend = Object.values(monthly).sort((a, b) => (a.month < b.month ? -1 : 1)).map(m => ({ ...m, successRate: rate(m) }));

    const withStats = evaluations.map(ev => ({ ev, stats: getGoalRecurringStats(ev.goal, { data }) }));
    const ranked = withStats.filter(x => x.stats.totalPeriods > 0)
        .sort((a, b) => (b.stats.successRate ?? 0) - (a.stats.successRate ?? 0));
    const streaks = withStats
        .map(x => ({ goalId: x.ev.goal.id, name: x.ev.goal.name, current: x.stats.currentStreak, best: x.stats.bestStreak }))
        .sort((a, b) => b.current - a.current)
        .slice(0, 5);

    return {
        totalGoals: evaluations.length,
        categories,
        types,
        trend,
        bestGoals: ranked.slice(0, 3).map(x => ({ goalId: x.ev.goal.id, name: x.ev.goal.name, successRate: x.stats.successRate })),
        worstGoals: ranked.slice(-3).reverse().map(x => ({ goalId: x.ev.goal.id, name: x.ev.goal.name, successRate: x.stats.successRate })),
        streaks,
        disclaimer: GOAL_REMINDER_DISCLAIMER
    };
}

// ——— Goal System: calendar ———

function mapGoalsToCalendarEvents(bounds, data = appData) {
    const events = [];
    if (!bounds?.startDate || !bounds?.endDate) return events;
    const prefs = getGoalSystemPrefs(data);
    if (!prefs.showGoalsOnCalendar) return events;
    const today = goalTodayStr();

    getGoals(data).forEach(goal => {
        if (goal.status === 'archived' || goal.status === 'cancelled') return;
        const substanceName = goalSubstanceLabel(goal.substanceId, data);
        const inWindow = dateStr => dateStr && dateStr >= bounds.startDate && dateStr <= bounds.endDate;

        if (inWindow(goal.startDate)) {
            events.push(makeCalendarEvent({
                id: `goal-start-${goal.id}`,
                type: 'goal_deadline',
                label: 'Goal Start',
                recordKind: 'goal',
                recordId: goal.id,
                linkedGoalId: goal.id,
                linkedPlanId: goal.linkedPlanId || null,
                date: goal.startDate,
                substanceId: goalIsAllSubstances(goal.substanceId) ? null : goal.substanceId,
                substanceName,
                title: `Goal starts · ${goal.name}`,
                status: 'planned',
                notes: goal.description || '',
                searchable: `${goal.name} ${getGoalTypeMeta(goal.type).label}`
            }));
        }

        if (inWindow(goal.endDate)) {
            const evaluation = evaluateGoal(goal, { data });
            events.push(makeCalendarEvent({
                id: `goal-deadline-${goal.id}`,
                type: 'goal_deadline',
                recordKind: 'goal',
                recordId: goal.id,
                linkedGoalId: goal.id,
                linkedPlanId: goal.linkedPlanId || null,
                date: goal.endDate,
                movable: true,
                substanceId: goalIsAllSubstances(goal.substanceId) ? null : goal.substanceId,
                substanceName,
                title: `Goal deadline · ${goal.name}`,
                status: goal.endDate < today ? (evaluation.met ? 'completed' : 'missed') : 'planned',
                notes: goal.description || '',
                searchable: `${goal.name} deadline`
            }));
        }

        (goal.periodHistory || []).forEach(period => {
            if (!period.finalized || !inWindow(period.periodEnd)) return;
            events.push(makeCalendarEvent({
                id: `goal-period-${goal.id}-${period.periodStart}`,
                type: period.met ? 'goal_completion' : 'goal_deadline',
                label: period.met ? 'Goal Period Met' : 'Goal Period Missed',
                recordKind: 'goal',
                recordId: goal.id,
                linkedGoalId: goal.id,
                date: period.periodEnd,
                startDate: period.periodStart,
                endDate: period.periodEnd,
                substanceId: goalIsAllSubstances(goal.substanceId) ? null : goal.substanceId,
                substanceName,
                title: `${period.met ? 'Met' : 'Missed'} · ${goal.name}`,
                status: period.met ? 'completed' : 'missed',
                amount: period.actual,
                unit: getGoalUnitLabel(goal, data),
                searchable: `${goal.name} ${period.met ? 'met' : 'missed'}`
            }));
        });
    });

    return events;
}

// ——— Goal System: export ———

function goalCsvRowsForGoals(data = appData) {
    const evaluations = evaluateAllGoals({ data, persist: false, includeArchived: true });
    const header = [
        'Goal ID', 'Name', 'Category', 'Type', 'Substance', 'Direction', 'Target', 'Unit',
        'Period', 'Start Date', 'End Date', 'Recurring', 'Record Status', 'Computed Status',
        'Current Actual', 'Percent Of Target', 'Success Rate %', 'Periods Tracked', 'Current Streak',
        'Linked Plan', 'Tags', 'Notes', 'Created At', 'Updated At'
    ];
    const rows = evaluations.map(ev => {
        const goal = ev.goal;
        const stats = getGoalRecurringStats(goal, { data });
        return [
            goal.id,
            goal.name,
            goal.category,
            getGoalTypeMeta(goal.type).label,
            goalSubstanceLabel(goal.substanceId, data),
            ev.direction,
            ev.target,
            getGoalUnitLabel(goal, data),
            goal.period === 'rolling' ? `rolling-${goal.rollingDays}d` : goal.period,
            goal.startDate,
            goal.endDate,
            goal.recurring ? 'yes' : 'no',
            goal.status,
            ev.status,
            ev.actual == null ? (ev.groups || []).map(g => `${g.label}: ${formatAmount(g.value)}`).join(' | ') : ev.actual,
            Number.isFinite(ev.percent) ? ev.percent : '',
            stats.successRate == null ? '' : stats.successRate,
            stats.totalPeriods,
            stats.currentStreak,
            goal.linkedPlanId || '',
            (goal.tags || []).join(' '),
            goal.notes,
            goal.createdAt,
            goal.updatedAt
        ];
    });
    return { header, rows };
}

function exportGoalsCsv(data = appData) {
    const { header, rows } = goalCsvRowsForGoals(data);
    const csv = [header, ...rows].map(row => row.map(csvEscape).join(',')).join('\n');
    downloadBlob(new Blob([csv], { type: 'text/csv;charset=utf-8;' }), `recovery-goals-${goalTodayStr()}.csv`);
    return rows.length;
}

function exportGoalHistoryCsv(goalId = null, data = appData) {
    const goals = getGoals(data).filter(g => !goalId || g.id === goalId);
    const header = ['Goal ID', 'Goal Name', 'Period Start', 'Period End', 'Target', 'Actual', 'Unit', 'Status', 'Met', 'Finalized', 'Evaluated At', 'Note'];
    const rows = [];
    goals.forEach(goal => {
        (goal.periodHistory || []).forEach(p => {
            rows.push([
                goal.id, goal.name, p.periodStart, p.periodEnd, p.target,
                p.actual == null ? '' : p.actual, getGoalUnitLabel(goal, data),
                p.status, p.met ? 'yes' : 'no', p.finalized ? 'yes' : 'no', p.evaluatedAt, p.note
            ]);
        });
    });
    const csv = [header, ...rows].map(row => row.map(csvEscape).join(',')).join('\n');
    const suffix = goalId ? `-${goalId}` : '';
    downloadBlob(new Blob([csv], { type: 'text/csv;charset=utf-8;' }), `recovery-goal-history${suffix}-${goalTodayStr()}.csv`);
    return rows.length;
}

// ——— Goal System: formatting ———

function formatGoalStatusLabel(status) {
    return GOAL_STATUS_META[status]?.label || 'Unknown';
}

function formatGoalValueWithUnit(goal, value, unitOverride = null, data = appData) {
    const meta = getGoalTypeMeta(goal?.type);
    if (value == null) return '—';
    const num = goalToNumber(value, 0);
    if (meta.unitKind === 'currency') return `${getCurrencySymbol()}${formatAmount(num, 2)}`;
    if (meta.unitKind === 'percent') return `${formatAmount(num, 1)}%`;
    if (meta.unitKind === 'days') return `${formatAmount(num, 0)} day${Math.abs(num) === 1 ? '' : 's'}`;
    if (meta.unitKind === 'count') return `${formatAmount(num, 0)} ${unitOverride || goal?.targetUnit || 'times'}`;
    const unit = unitOverride || (goalIsAllSubstances(goal?.substanceId) ? (goal?.targetUnit || 'units') : getSubstanceDisplayUnit(goal.substanceId, data));
    return `${formatAmount(num, 3)} ${unit}`.trim();
}

function formatGoalTargetDisplay(goal, data = appData) {
    const meta = getGoalTypeMeta(goal?.type);
    if (meta.fixedTargetZero) {
        if (meta.unitKind === 'days') return 'zero days';
        if (meta.unitKind === 'count') return 'zero';
        return '0';
    }
    return formatGoalValueWithUnit(goal, getGoalTargetValue(goal), null, data);
}

function formatGoalActualDisplay(goal, evaluation, data = appData) {
    if (!evaluation) return '—';
    if (evaluation.groups && evaluation.groups.length) {
        return evaluation.groups
            .map(g => `${g.label}: ${formatGoalValueWithUnit(goal, g.value, g.unit, data)}`)
            .join(' · ');
    }
    if (evaluation.groups && !evaluation.groups.length) return 'No activity logged';
    if (evaluation.actual == null) return 'Not enough data';
    return formatGoalValueWithUnit(goal, evaluation.actual, evaluation.unit, data);
}

function formatGoalPeriodDescriptor(goal) {
    if (goal?.period === 'rolling') return `Rolling ${goal.rollingDays} days`;
    return GOAL_PERIOD_LABELS[goal?.period] || goal?.period || '';
}

// ——— Goal System: UI ———

function goalRootEl() {
    return document.getElementById('goals-root');
}

function setGoalListBucket(bucket) {
    goalSystemUiState.bucket = GOAL_LIST_BUCKETS.some(b => b.id === bucket) ? bucket : 'active';
    renderGoalsView();
}

function setGoalSortBy(sortBy) {
    goalSystemUiState.sortBy = GOAL_SORT_OPTIONS.some(s => s.id === sortBy) ? sortBy : 'status';
    renderGoalsView();
}

function onGoalFilterChange() {
    const substance = document.getElementById('goal-filter-substance');
    const category = document.getElementById('goal-filter-category');
    const type = document.getElementById('goal-filter-type');
    const search = document.getElementById('goal-filter-search');
    goalSystemUiState.filters = {
        substanceId: substance?.value || 'all',
        category: category?.value || 'all',
        type: type?.value || 'all',
        search: search?.value || ''
    };
    renderGoalsView();
}

function goalToneClass(tone) {
    if (tone === 'good') return 'goal-tone-good';
    if (tone === 'warn') return 'goal-tone-warn';
    if (tone === 'bad') return 'goal-tone-bad';
    return 'goal-tone-neutral';
}

function renderGoalProgressBar(evaluation) {
    if (!evaluation) return '';
    const statusMeta = evaluation.statusMeta || GOAL_STATUS_META.insufficient_data;
    const tone = goalToneClass(statusMeta.tone);
    const rows = (evaluation.groups && evaluation.groups.length)
        ? evaluation.groups
        : [{ label: '', value: evaluation.actual, ratio: evaluation.ratio, unit: evaluation.unit }];

    const bars = rows.map(row => {
        const ratio = row.ratio != null ? row.ratio : evaluation.ratio;
        const overTarget = ratio === Infinity || ratio > 1;
        const pct = Number.isFinite(ratio) ? Math.min(100, Math.round(ratio * 100)) : 100;
        const overflow = overTarget ? (Number.isFinite(ratio) ? Math.min(100, Math.round((ratio - 1) * 100)) : 100) : 0;
        const pctText = Number.isFinite(ratio) ? `${Math.round(ratio * 100)}%` : (overTarget ? 'over' : '—');
        const label = row.label
            ? `<span class="goal-bar-label">${escapeHtml(row.label)}</span>`
            : '';
        return `
            <div class="goal-bar-row">
                ${label}
                <div class="goal-bar-track" role="progressbar" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${pct}">
                    <div class="goal-bar-fill ${tone}" style="width:${pct}%"></div>
                    ${overflow ? `<div class="goal-bar-overflow" style="width:${overflow}%"></div>` : ''}
                </div>
                <span class="goal-bar-pct">${escapeHtml(pctText)}</span>
            </div>`;
    }).join('');

    return `<div class="goal-progress">${bars}</div>`;
}

function renderGoalMiniBarChart(items, { max = null, valueFormatter = null, emptyText = 'No data yet.' } = {}) {
    const rows = (items || []).filter(Boolean);
    if (!rows.length) return `<p class="goal-empty-inline">${escapeHtml(emptyText)}</p>`;
    const peak = max != null ? max : Math.max(...rows.map(r => Math.abs(goalToNumber(r.value, 0))), 1);
    const bars = rows.map(row => {
        const value = goalToNumber(row.value, 0);
        const pct = peak > 0 ? Math.min(100, Math.round((Math.abs(value) / peak) * 100)) : 0;
        const tone = row.tone ? goalToneClass(row.tone) : 'goal-tone-neutral';
        const display = valueFormatter ? valueFormatter(value, row) : formatAmount(value, 2);
        return `
            <div class="goal-chart-row">
                <span class="goal-chart-label">${escapeHtml(row.label ?? '')}</span>
                <span class="goal-chart-track"><span class="goal-chart-fill ${tone}" style="width:${pct}%"></span></span>
                <span class="goal-chart-value">${escapeHtml(display)}</span>
            </div>`;
    }).join('');
    return `<div class="goal-chart">${bars}</div>`;
}

function renderGoalCard(evaluation, data = appData) {
    const goal = evaluation.goal;
    const statusMeta = evaluation.statusMeta || GOAL_STATUS_META.insufficient_data;
    const meta = getGoalTypeMeta(goal.type);
    const stats = getGoalRecurringStats(goal, { data });
    const canPause = ['active', 'draft'].includes(goal.status);
    const canResume = goal.status === 'paused';

    const chips = [
        `<span class="goal-chip">${escapeHtml(meta.label)}</span>`,
        `<span class="goal-chip">${escapeHtml(goalSubstanceLabel(goal.substanceId, data))}</span>`,
        `<span class="goal-chip">${escapeHtml(formatGoalPeriodDescriptor(goal))}</span>`,
        goal.recurring ? '<span class="goal-chip">Repeats</span>' : '',
        goal.priority === 'high' ? '<span class="goal-chip goal-chip-high">High priority</span>' : '',
        goal.linkedPlanId ? '<span class="goal-chip">Linked plan</span>' : '',
        goal.needsReview ? '<span class="goal-chip goal-chip-warn">Needs review</span>' : ''
    ].filter(Boolean).join('');

    const footerBits = [
        `<span>Target: <strong>${escapeHtml(formatGoalTargetDisplay(goal, data))}</strong></span>`,
        `<span>Now: <strong>${escapeHtml(formatGoalActualDisplay(goal, evaluation, data))}</strong></span>`,
        evaluation.periodEnded ? '' : `<span>${evaluation.daysRemaining} day${evaluation.daysRemaining === 1 ? '' : 's'} left</span>`,
        stats.totalPeriods ? `<span>${stats.metCount}/${stats.totalPeriods} periods met</span>` : '',
        stats.currentStreak ? `<span>🔥 ${stats.currentStreak} in a row</span>` : ''
    ].filter(Boolean).join('');

    return `
        <article class="goal-card ${escapeHtml(statusMeta.className)}" data-goal-id="${escapeHtml(goal.id)}">
            <header class="goal-card-head">
                <div>
                    <h3 class="goal-card-title">${escapeHtml(goal.name || 'Untitled goal')}</h3>
                    <p class="goal-card-period">${escapeHtml(evaluation.bounds.label)}</p>
                </div>
                <span class="goal-status-pill ${goalToneClass(statusMeta.tone)}">${escapeHtml(statusMeta.label)}</span>
            </header>
            ${goal.description ? `<p class="goal-card-desc">${escapeHtml(goal.description)}</p>` : ''}
            <div class="goal-chip-row">${chips}</div>
            ${renderGoalProgressBar(evaluation)}
            <div class="goal-card-foot">${footerBits}</div>
            <div class="goal-card-actions">
                <button type="button" class="btn-small" onclick="openGoalDetail('${escapeHtml(goal.id)}')">Details</button>
                <button type="button" class="btn-small" onclick="openGoalEditForm('${escapeHtml(goal.id)}')">Edit</button>
                ${canPause ? `<button type="button" class="btn-small" onclick="pauseGoal('${escapeHtml(goal.id)}'); renderGoalsView();">Pause</button>` : ''}
                ${canResume ? `<button type="button" class="btn-small" onclick="resumeGoal('${escapeHtml(goal.id)}'); renderGoalsView();">Resume</button>` : ''}
                <button type="button" class="btn-small" onclick="duplicateGoal('${escapeHtml(goal.id)}'); renderGoalsView();">Duplicate</button>
                ${goal.status === 'archived' ? '' : `<button type="button" class="btn-small" onclick="archiveGoal('${escapeHtml(goal.id)}'); renderGoalsView();">Archive</button>`}
                <button type="button" class="btn-small btn-danger" onclick="confirmDeleteGoal('${escapeHtml(goal.id)}')">Delete</button>
            </div>
        </article>`;
}

function renderGoalTemplateChips() {
    const chips = GOAL_TEMPLATES.map(t => `
        <button type="button" class="goal-template-chip" onclick="applyGoalTemplate('${escapeHtml(t.id)}')" title="${escapeHtml(t.blurb)}">
            <span class="goal-template-icon">${escapeHtml(t.icon)}</span>
            <span class="goal-template-label">${escapeHtml(t.label)}</span>
        </button>`).join('');
    return `
        <section class="goal-templates">
            <h3 class="goal-section-title">Quick start</h3>
            <div class="goal-template-row">${chips}</div>
        </section>`;
}

function renderGoalFilters(data = appData) {
    const filters = goalSystemUiState.filters;
    const substances = getActiveSubstances(data);
    const substanceOptions = [`<option value="all"${filters.substanceId === 'all' ? ' selected' : ''}>All substances</option>`]
        .concat(substances.map(s => `<option value="${escapeHtml(s.id)}"${filters.substanceId === s.id ? ' selected' : ''}>${escapeHtml(getSubstanceDisplayName(s, data))}</option>`))
        .join('');
    const categoryOptions = [`<option value="all"${filters.category === 'all' ? ' selected' : ''}>All categories</option>`]
        .concat(GOAL_CATEGORIES.map(c => `<option value="${escapeHtml(c.id)}"${filters.category === c.id ? ' selected' : ''}>${escapeHtml(c.label)}</option>`))
        .join('');
    const typePool = filters.category === 'all' ? Object.keys(GOAL_TYPE_META) : getGoalTypesForCategory(filters.category);
    const typeOptions = [`<option value="all"${filters.type === 'all' ? ' selected' : ''}>All types</option>`]
        .concat(typePool.map(t => `<option value="${escapeHtml(t)}"${filters.type === t ? ' selected' : ''}>${escapeHtml(GOAL_TYPE_META[t].label)}</option>`))
        .join('');
    const sortOptions = GOAL_SORT_OPTIONS
        .map(s => `<option value="${escapeHtml(s.id)}"${goalSystemUiState.sortBy === s.id ? ' selected' : ''}>${escapeHtml(s.label)}</option>`)
        .join('');

    return `
        <section class="goal-filters">
            <label class="goal-filter">
                <span>Substance</span>
                <select id="goal-filter-substance" onchange="onGoalFilterChange()">${substanceOptions}</select>
            </label>
            <label class="goal-filter">
                <span>Category</span>
                <select id="goal-filter-category" onchange="onGoalFilterChange()">${categoryOptions}</select>
            </label>
            <label class="goal-filter">
                <span>Type</span>
                <select id="goal-filter-type" onchange="onGoalFilterChange()">${typeOptions}</select>
            </label>
            <label class="goal-filter">
                <span>Search</span>
                <input type="search" id="goal-filter-search" value="${escapeHtml(filters.search)}" placeholder="Name, tag, note" oninput="onGoalFilterChange()">
            </label>
            <label class="goal-filter">
                <span>Sort</span>
                <select id="goal-sort-by" onchange="setGoalSortBy(this.value)">${sortOptions}</select>
            </label>
        </section>`;
}

function renderGoalBucketTabs(evaluations) {
    const counts = {};
    GOAL_LIST_BUCKETS.forEach(b => { counts[b.id] = 0; });
    evaluations.forEach(ev => {
        const bucket = goalEvaluationBucket(ev);
        if (counts[bucket] != null) counts[bucket] += 1;
    });
    const tabs = GOAL_LIST_BUCKETS.map(b => `
        <button type="button" class="goal-bucket-tab${goalSystemUiState.bucket === b.id ? ' is-active' : ''}" onclick="setGoalListBucket('${b.id}')">
            ${escapeHtml(b.label)} <span class="goal-bucket-count">${counts[b.id]}</span>
        </button>`).join('');
    return `<nav class="goal-bucket-tabs" aria-label="Goal groups">${tabs}</nav>`;
}

function renderGoalsEmptyState(bucket) {
    const copy = {
        active: 'No active goals yet. Start from a template or create one from scratch.',
        upcoming: 'Nothing scheduled ahead. Drafts and future-dated goals land here.',
        completed: 'No completed goals yet — they show up here once a window closes successfully.',
        missed: 'Nothing missed. Periods that end over target appear here.',
        paused: 'No paused goals.',
        history: 'No archived or cancelled goals.'
    };
    return `
        <div class="goal-empty">
            <p>${escapeHtml(copy[bucket] || copy.active)}</p>
            <button type="button" class="btn-primary" onclick="openGoalCreateForm()">Create a goal</button>
        </div>`;
}

function renderGoalsView() {
    const root = goalRootEl();
    if (!root) return;
    const data = appData;

    if (goalSystemUiState.loading) {
        root.innerHTML = '<div class="goal-loading" role="status">Loading goals…</div>';
        return;
    }

    try {
        ensureGoals(data);
        const evaluations = evaluateAllGoals({ data });
        const filtered = filterAndSortGoalEvaluations(evaluations, {
            bucket: goalSystemUiState.bucket,
            substanceId: goalSystemUiState.filters.substanceId,
            category: goalSystemUiState.filters.category,
            type: goalSystemUiState.filters.type,
            search: goalSystemUiState.filters.search,
            sortBy: goalSystemUiState.sortBy,
            data
        });
        const summary = buildGoalDashboardSummary({ data });
        const remindersBlock = summary.reminders.length
            ? `<ul class="goal-reminder-list">${summary.reminders.map(r => `
                    <li class="goal-reminder goal-reminder-${escapeHtml(r.severity)}">
                        <strong>${escapeHtml(r.title)}</strong>
                        <span>${escapeHtml(r.message)}</span>
                    </li>`).join('')}</ul>`
            : '<p class="goal-empty-inline">No nudges right now.</p>';

        const detailHtml = goalSystemUiState.detailGoalId
            ? renderGoalDetailHtml(goalSystemUiState.detailGoalId, data)
            : '';
        const formHtml = goalSystemUiState.formOpen ? renderGoalFormHtml(data) : '';

        root.innerHTML = `
            <div class="goal-view">
                <header class="goal-view-head">
                    <div>
                        <h2 class="goal-view-title">Goals</h2>
                        <p class="goal-view-sub">${summary.counts.active} active · ${summary.counts.atRisk} needing attention${summary.successRate == null ? '' : ` · ${summary.successRate}% of finished periods met`}</p>
                    </div>
                    <div class="goal-view-actions">
                        <button type="button" class="btn-primary" onclick="openGoalCreateForm()">New goal</button>
                        <button type="button" class="btn-small" onclick="exportGoalsCsv()">Export CSV</button>
                        <button type="button" class="btn-small" onclick="exportGoalHistoryCsv()">Export history</button>
                    </div>
                </header>

                ${goalSystemUiState.error ? `<div class="goal-error" role="alert">${escapeHtml(goalSystemUiState.error)}</div>` : ''}
                ${formHtml}
                ${detailHtml}
                ${renderGoalTemplateChips()}

                <section class="goal-reminders">
                    <h3 class="goal-section-title">Reminders</h3>
                    ${remindersBlock}
                    <p class="goal-disclaimer">${escapeHtml(GOAL_REMINDER_DISCLAIMER)}</p>
                </section>

                ${renderGoalFilters(data)}
                ${renderGoalBucketTabs(evaluations)}

                <section class="goal-list" id="goal-list">
                    ${filtered.length ? filtered.map(ev => renderGoalCard(ev, data)).join('') : renderGoalsEmptyState(goalSystemUiState.bucket)}
                </section>
            </div>`;
    } catch (err) {
        console.error('[goals] render failed', err);
        root.innerHTML = `
            <div class="goal-error" role="alert">
                <p>Something went wrong rendering goals.</p>
                <p class="goal-error-detail">${escapeHtml(err?.message || String(err))}</p>
                <button type="button" class="btn-small" onclick="renderGoalsView()">Try again</button>
            </div>`;
    }
}

// ——— Goal System: form ———

function goalFormDraft() {
    if (!goalSystemUiState.formDraft) {
        goalSystemUiState.formDraft = normalizeGoalRecord({
            ...getDefaultGoalRecord(),
            id: createGoalId(),
            status: 'active'
        });
    }
    return goalSystemUiState.formDraft;
}

function openGoalCreateForm(prefill = null) {
    goalSystemUiState.formOpen = true;
    goalSystemUiState.editingGoalId = null;
    goalSystemUiState.detailGoalId = null;
    goalSystemUiState.formErrors = [];
    goalSystemUiState.formDraft = normalizeGoalRecord({
        ...getDefaultGoalRecord(),
        id: createGoalId(),
        ...(prefill || {})
    });
    renderGoalsView();
}

function openGoalEditForm(goalId) {
    const goal = getGoalById(goalId);
    if (!goal) {
        alert('That goal no longer exists.');
        return;
    }
    goalSystemUiState.formOpen = true;
    goalSystemUiState.editingGoalId = goal.id;
    goalSystemUiState.detailGoalId = null;
    goalSystemUiState.formErrors = [];
    goalSystemUiState.formDraft = normalizeGoalRecord(JSON.parse(JSON.stringify(goal)));
    renderGoalsView();
}

function closeGoalForm() {
    goalSystemUiState.formOpen = false;
    goalSystemUiState.editingGoalId = null;
    goalSystemUiState.formDraft = null;
    goalSystemUiState.formErrors = [];
    renderGoalsView();
}

function openGoalDetail(goalId) {
    goalSystemUiState.detailGoalId = goalId;
    goalSystemUiState.formOpen = false;
    renderGoalsView();
}

function closeGoalDetail() {
    goalSystemUiState.detailGoalId = null;
    renderGoalsView();
}

function applyGoalTemplate(templateId) {
    const draft = createGoalFromTemplate(templateId);
    if (!draft) return;
    openGoalCreateForm(draft);
}

function readGoalFormFromDom() {
    const val = id => document.getElementById(id)?.value ?? '';
    const checked = id => !!document.getElementById(id)?.checked;
    const draft = goalFormDraft();
    // Conditional fields keep their draft value when the input is not rendered.
    const valOr = (id, fallback) => (document.getElementById(id) ? document.getElementById(id).value : fallback);
    const type = val('goal-form-type') || draft.type;
    const meta = getGoalTypeMeta(type);

    const weekdayBoxesPresent = !!document.getElementById('goal-form-weekday-0');
    const weekdays = weekdayBoxesPresent
        ? GOAL_WEEKDAY_LABELS
            .map((_label, index) => (checked(`goal-form-weekday-${index}`) ? index : null))
            .filter(v => v != null)
        : (draft.config.weekdays || []);

    const patch = {
        ...draft,
        name: val('goal-form-name') || draft.name,
        description: val('goal-form-description'),
        category: val('goal-form-category') || meta.category,
        type,
        substanceId: val('goal-form-substance') || DASHBOARD_ALL,
        targetValue: meta.fixedTargetZero ? 0 : goalToNumber(val('goal-form-target'), 0),
        targetUnit: valOr('goal-form-target-unit', draft.targetUnit),
        period: val('goal-form-period') || meta.defaultPeriod,
        rollingDays: goalToNumber(val('goal-form-rolling-days'), draft.rollingDays),
        startDate: val('goal-form-start') || draft.startDate,
        endDate: val('goal-form-end'),
        recurring: checked('goal-form-recurring'),
        priority: val('goal-form-priority') || 'normal',
        status: val('goal-form-status') || draft.status,
        baselineMode: valOr('goal-form-baseline-mode', draft.baselineMode) || 'auto',
        baselineValue: valOr('goal-form-baseline-value', draft.baselineValue),
        baselineLookbackDays: goalToNumber(valOr('goal-form-baseline-lookback', draft.baselineLookbackDays), draft.baselineLookbackDays),
        linkedPlanId: val('goal-form-plan'),
        tags: val('goal-form-tags').split(',').map(t => t.trim()).filter(Boolean),
        notes: val('goal-form-notes'),
        manualActual: valOr('goal-form-manual-actual', draft.manualActual),
        reminders: {
            enabled: checked('goal-form-reminders-enabled'),
            leadDays: goalToNumber(val('goal-form-reminder-lead'), draft.reminders.leadDays),
            frequency: val('goal-form-reminder-frequency') || draft.reminders.frequency
        },
        config: {
            ...draft.config,
            ...(meta.configFields?.includes('weekdays') ? { weekdays } : {}),
            ...(meta.configFields?.includes('beforeDate')
                ? { beforeDate: valOr('goal-form-before-date', draft.config.beforeDate || '') }
                : {})
        }
    };
    if (meta.allowDirectionChoice) patch.direction = val('goal-form-direction') || 'max';
    return normalizeGoalRecord(patch);
}

function onGoalFormTypeChange() {
    const draft = readGoalFormFromDom();
    const meta = getGoalTypeMeta(draft.type);
    if (!meta.periods.includes(draft.period)) draft.period = meta.defaultPeriod;
    if (meta.configFields?.includes('weekdays') && !(draft.config.weekdays || []).length) {
        draft.config.weekdays = [1, 2, 3, 4];
    }
    if (meta.configFields?.includes('beforeDate') && !draft.config.beforeDate) {
        draft.config.beforeDate = draft.endDate || addDaysYYYYMMDD(draft.startDate, 14);
    }
    if (goalNeedsBaseline(draft) && draft.baselineMode === 'auto') {
        const baseline = computeGoalAutoBaseline(draft, appData);
        draft.baselineValue = baseline.value;
        draft.baselineStartDate = baseline.startDate;
        draft.baselineEndDate = baseline.endDate;
    }
    goalSystemUiState.formDraft = normalizeGoalRecord(draft);
    renderGoalsView();
}

function submitGoalForm(event) {
    if (event?.preventDefault) event.preventDefault();
    const draft = readGoalFormFromDom();
    if (goalSystemUiState.editingGoalId) draft.id = goalSystemUiState.editingGoalId;

    const result = saveGoalRecord(draft, {
        action: goalSystemUiState.editingGoalId ? 'updated' : 'created'
    });
    if (!result.ok) {
        goalSystemUiState.formDraft = draft;
        goalSystemUiState.formErrors = result.errors;
        renderGoalsView();
        return false;
    }
    goalSystemUiState.formOpen = false;
    goalSystemUiState.editingGoalId = null;
    goalSystemUiState.formDraft = null;
    goalSystemUiState.formErrors = [];
    goalSystemUiState.bucket = goalEvaluationBucket(evaluateGoal(result.goal, { data: appData }));
    renderGoalsView();
    return true;
}

function confirmDeleteGoal(goalId) {
    const goal = getGoalById(goalId);
    if (!goal) return false;
    const ok = confirm(`Delete “${goal.name}”?\n\nOnly the goal is removed — your logs, purchases, and taper plans stay exactly as they are.`);
    if (!ok) return false;
    deleteGoal(goalId);
    if (goalSystemUiState.detailGoalId === goalId) goalSystemUiState.detailGoalId = null;
    if (goalSystemUiState.editingGoalId === goalId) closeGoalForm();
    else renderGoalsView();
    return true;
}

function goalSelectOptions(values, selected, labelFn) {
    return values.map(v => `<option value="${escapeHtml(v)}"${String(v) === String(selected) ? ' selected' : ''}>${escapeHtml(labelFn ? labelFn(v) : v)}</option>`).join('');
}

function renderGoalFormHtml(data = appData) {
    const draft = goalFormDraft();
    const meta = getGoalTypeMeta(draft.type);
    const isEdit = !!goalSystemUiState.editingGoalId;
    const typePool = getGoalTypesForCategory(draft.category).length
        ? getGoalTypesForCategory(draft.category)
        : Object.keys(GOAL_TYPE_META);

    const substanceOptions = [`<option value="${DASHBOARD_ALL}"${goalIsAllSubstances(draft.substanceId) ? ' selected' : ''}>All substances</option>`]
        .concat(getActiveSubstances(data).map(s =>
            `<option value="${escapeHtml(s.id)}"${String(draft.substanceId) === String(s.id) ? ' selected' : ''}>${escapeHtml(getSubstanceDisplayName(s, data))}</option>`))
        .join('');

    if (typeof ensureTaperPlansV2 === 'function') ensureTaperPlansV2(data);
    const planOptions = ['<option value="">No linked plan</option>']
        .concat((data.taperPlansV2 || []).map(p =>
            `<option value="${escapeHtml(p.id)}"${draft.linkedPlanId === p.id ? ' selected' : ''}>${escapeHtml(p.name || goalSubstanceLabel(p.substanceId, data))}</option>`))
        .join('');

    const weekdayBoxes = GOAL_WEEKDAY_LABELS.map((label, index) => `
        <label class="goal-weekday">
            <input type="checkbox" id="goal-form-weekday-${index}" ${(draft.config.weekdays || []).includes(index) ? 'checked' : ''}>
            <span>${escapeHtml(label)}</span>
        </label>`).join('');

    const errors = goalSystemUiState.formErrors.length
        ? `<ul class="goal-form-errors" role="alert">${goalSystemUiState.formErrors.map(e => `<li>${escapeHtml(e)}</li>`).join('')}</ul>`
        : '';

    const unitHint = meta.unitKind === 'currency'
        ? getCurrencySymbol()
        : meta.unitKind === 'percent'
            ? '%'
            : meta.unitKind === 'days'
                ? 'days'
                : meta.unitKind === 'substance'
                    ? (goalIsAllSubstances(draft.substanceId) ? 'per substance' : getSubstanceDisplayUnit(draft.substanceId, data))
                    : 'count';

    return `
        <section class="goal-form-wrap" id="goal-form-root">
            <form class="goal-form" id="goal-form" onsubmit="return submitGoalForm(event)">
                <header class="goal-form-head">
                    <h3>${isEdit ? 'Edit goal' : 'New goal'}</h3>
                    <button type="button" class="btn-small" onclick="closeGoalForm()">Close</button>
                </header>
                ${errors}

                <div class="goal-form-grid">
                    <label class="goal-field">
                        <span>Name</span>
                        <input type="text" id="goal-form-name" value="${escapeHtml(draft.name)}" placeholder="e.g. Three use days a week" required>
                    </label>
                    <label class="goal-field">
                        <span>Category</span>
                        <select id="goal-form-category" onchange="onGoalFormTypeChange()">
                            ${GOAL_CATEGORIES.map(c => `<option value="${escapeHtml(c.id)}"${draft.category === c.id ? ' selected' : ''}>${escapeHtml(c.label)}</option>`).join('')}
                        </select>
                    </label>
                    <label class="goal-field">
                        <span>Type</span>
                        <select id="goal-form-type" onchange="onGoalFormTypeChange()">
                            ${goalSelectOptions(typePool, draft.type, t => GOAL_TYPE_META[t].label)}
                        </select>
                    </label>
                    <label class="goal-field goal-field-wide">
                        <span>Description</span>
                        <input type="text" id="goal-form-description" value="${escapeHtml(draft.description)}" placeholder="Why this goal matters">
                    </label>
                    <label class="goal-field">
                        <span>Substance</span>
                        <select id="goal-form-substance" onchange="onGoalFormTypeChange()">${substanceOptions}</select>
                    </label>
                    ${meta.allowDirectionChoice ? `
                    <label class="goal-field">
                        <span>Direction</span>
                        <select id="goal-form-direction">
                            <option value="max"${draft.direction === 'max' ? ' selected' : ''}>Stay at or under</option>
                            <option value="min"${draft.direction === 'min' ? ' selected' : ''}>Reach at least</option>
                        </select>
                    </label>` : ''}
                    <label class="goal-field">
                        <span>${escapeHtml(meta.targetLabel || 'Target')}</span>
                        <input type="number" id="goal-form-target" step="any" min="0" value="${meta.fixedTargetZero ? 0 : escapeHtml(String(draft.targetValue))}" ${meta.fixedTargetZero ? 'readonly' : ''}>
                        <small class="goal-hint">${escapeHtml(unitHint)}</small>
                    </label>
                    ${meta.unitKind === 'count' || meta.unitKind === 'substance' ? `
                    <label class="goal-field">
                        <span>Unit label</span>
                        <input type="text" id="goal-form-target-unit" value="${escapeHtml(draft.targetUnit)}" placeholder="optional">
                    </label>` : ''}
                    <label class="goal-field">
                        <span>Period</span>
                        <select id="goal-form-period" onchange="onGoalFormTypeChange()">
                            ${goalSelectOptions(meta.periods, draft.period, p => GOAL_PERIOD_LABELS[p] || p)}
                        </select>
                    </label>
                    ${draft.period === 'rolling' ? `
                    <label class="goal-field">
                        <span>Rolling window (days)</span>
                        <input type="number" id="goal-form-rolling-days" min="1" step="1" value="${escapeHtml(String(draft.rollingDays))}">
                    </label>` : ''}
                    <label class="goal-field">
                        <span>Start date</span>
                        <input type="date" id="goal-form-start" value="${escapeHtml(draft.startDate)}">
                    </label>
                    <label class="goal-field">
                        <span>End date</span>
                        <input type="date" id="goal-form-end" value="${escapeHtml(draft.endDate)}">
                    </label>
                    ${meta.configFields?.includes('beforeDate') ? `
                    <label class="goal-field">
                        <span>Hold out until</span>
                        <input type="date" id="goal-form-before-date" value="${escapeHtml(draft.config.beforeDate || '')}">
                    </label>` : ''}
                    <label class="goal-field">
                        <span>Priority</span>
                        <select id="goal-form-priority">
                            ${goalSelectOptions(['low', 'normal', 'high'], draft.priority, v => v[0].toUpperCase() + v.slice(1))}
                        </select>
                    </label>
                    <label class="goal-field">
                        <span>Status</span>
                        <select id="goal-form-status">
                            ${goalSelectOptions(['draft', 'active', 'paused', 'completed', 'missed', 'cancelled', 'archived'], draft.status, v => v[0].toUpperCase() + v.slice(1))}
                        </select>
                    </label>
                    <label class="goal-field">
                        <span>Linked taper plan</span>
                        <select id="goal-form-plan">${planOptions}</select>
                    </label>
                    <label class="goal-field goal-field-check">
                        <input type="checkbox" id="goal-form-recurring" ${draft.recurring ? 'checked' : ''} ${draft.period === 'entire' ? 'disabled' : ''}>
                        <span>Repeat every period</span>
                    </label>
                </div>

                ${meta.configFields?.includes('weekdays') ? `
                <fieldset class="goal-fieldset">
                    <legend>Protected days</legend>
                    <div class="goal-weekday-row">${weekdayBoxes}</div>
                </fieldset>` : ''}

                ${meta.needsBaseline ? `
                <fieldset class="goal-fieldset">
                    <legend>Baseline</legend>
                    <div class="goal-form-grid">
                        <label class="goal-field">
                            <span>Baseline source</span>
                            <select id="goal-form-baseline-mode" onchange="onGoalFormTypeChange()">
                                <option value="auto"${draft.baselineMode === 'auto' ? ' selected' : ''}>Auto from history</option>
                                <option value="manual"${draft.baselineMode === 'manual' ? ' selected' : ''}>Manual value</option>
                            </select>
                        </label>
                        <label class="goal-field">
                            <span>Baseline value</span>
                            <input type="number" id="goal-form-baseline-value" step="any" value="${draft.baselineValue == null ? '' : escapeHtml(String(draft.baselineValue))}" ${draft.baselineMode === 'auto' ? 'readonly' : ''}>
                        </label>
                        <label class="goal-field">
                            <span>Lookback (days)</span>
                            <input type="number" id="goal-form-baseline-lookback" min="1" step="1" value="${escapeHtml(String(draft.baselineLookbackDays))}">
                        </label>
                    </div>
                    ${draft.baselineStartDate ? `<p class="goal-hint">Measured ${escapeHtml(goalFormatDate(draft.baselineStartDate))} – ${escapeHtml(goalFormatDate(draft.baselineEndDate))}.</p>` : ''}
                </fieldset>` : ''}

                ${meta.aggregation === 'custom' ? `
                <label class="goal-field">
                    <span>Current value (you update this)</span>
                    <input type="number" id="goal-form-manual-actual" step="any" value="${draft.manualActual == null ? '' : escapeHtml(String(draft.manualActual))}">
                </label>` : ''}

                <fieldset class="goal-fieldset">
                    <legend>Reminders</legend>
                    <div class="goal-form-grid">
                        <label class="goal-field goal-field-check">
                            <input type="checkbox" id="goal-form-reminders-enabled" ${draft.reminders.enabled ? 'checked' : ''}>
                            <span>In-app reminders</span>
                        </label>
                        <label class="goal-field">
                            <span>Lead time (days)</span>
                            <input type="number" id="goal-form-reminder-lead" min="0" step="1" value="${escapeHtml(String(draft.reminders.leadDays))}">
                        </label>
                        <label class="goal-field">
                            <span>Frequency</span>
                            <select id="goal-form-reminder-frequency">
                                ${goalSelectOptions(['period', 'daily', 'deadline'], draft.reminders.frequency, v => v[0].toUpperCase() + v.slice(1))}
                            </select>
                        </label>
                    </div>
                    <p class="goal-disclaimer">${escapeHtml(GOAL_REMINDER_DISCLAIMER)}</p>
                </fieldset>

                <div class="goal-form-grid">
                    <label class="goal-field">
                        <span>Tags</span>
                        <input type="text" id="goal-form-tags" value="${escapeHtml((draft.tags || []).join(', '))}" placeholder="comma separated">
                    </label>
                    <label class="goal-field goal-field-wide">
                        <span>Notes</span>
                        <textarea id="goal-form-notes" rows="3">${escapeHtml(draft.notes)}</textarea>
                    </label>
                </div>

                <footer class="goal-form-foot">
                    <button type="submit" class="btn-primary">${isEdit ? 'Save changes' : 'Create goal'}</button>
                    <button type="button" class="btn-small" onclick="closeGoalForm()">Cancel</button>
                    ${isEdit ? `<button type="button" class="btn-small btn-danger" onclick="confirmDeleteGoal('${escapeHtml(draft.id)}')">Delete</button>` : ''}
                </footer>
            </form>
        </section>`;
}

// ——— Goal System: detail ———

function goalRelatedLogs(goal, bounds, data = appData, limit = 12) {
    return goalUseLogsInRange(goal, bounds.periodStart, bounds.periodEnd, data)
        .sort((a, b) => (getLogDateStr(a) < getLogDateStr(b) ? 1 : -1))
        .slice(0, limit);
}

function goalRelatedPurchases(goal, bounds, data = appData, limit = 12) {
    return goalPurchasesInRange(goal, bounds.periodStart, bounds.periodEnd, data, { spendOnly: false })
        .sort((a, b) => (getPurchaseDateStr(a) < getPurchaseDateStr(b) ? 1 : -1))
        .slice(0, limit);
}

function renderGoalHistoryTable(goal, data = appData) {
    const history = [...(goal.periodHistory || [])].reverse();
    if (!history.length) return '<p class="goal-empty-inline">No completed periods yet.</p>';
    const rows = history.map(p => `
        <tr class="${p.finalized ? '' : 'goal-row-open'}">
            <td>${escapeHtml(goalFormatDate(p.periodStart))} – ${escapeHtml(goalFormatDate(p.periodEnd))}</td>
            <td>${escapeHtml(formatGoalValueWithUnit(goal, p.target, null, data))}</td>
            <td>${p.actual == null ? '—' : escapeHtml(formatGoalValueWithUnit(goal, p.actual, null, data))}</td>
            <td><span class="goal-status-pill ${goalToneClass(GOAL_STATUS_META[p.status]?.tone)}">${escapeHtml(formatGoalStatusLabel(p.status))}</span></td>
            <td>${p.finalized ? (p.met ? 'Met' : 'Missed') : 'In progress'}</td>
        </tr>`).join('');
    return `
        <table class="goal-history-table">
            <thead><tr><th>Period</th><th>Target</th><th>Actual</th><th>Status</th><th>Result</th></tr></thead>
            <tbody>${rows}</tbody>
        </table>`;
}

function renderGoalDetailHtml(goalId, data = appData) {
    const goal = getGoalById(goalId, data);
    if (!goal) return '<section class="goal-detail"><p class="goal-empty-inline">That goal is gone.</p></section>';
    const evaluation = evaluateGoal(goal, { data });
    const stats = getGoalRecurringStats(goal, { data });
    const meta = getGoalTypeMeta(goal.type);
    const bounds = evaluation.bounds;

    const definitionRows = [
        ['Type', meta.label],
        ['Category', GOAL_CATEGORIES.find(c => c.id === goal.category)?.label || goal.category],
        ['Substance', goalSubstanceLabel(goal.substanceId, data)],
        ['Direction', evaluation.direction === 'max' ? 'Stay at or under target' : 'Reach at least target'],
        ['Target', formatGoalTargetDisplay(goal, data)],
        ['Period', formatGoalPeriodDescriptor(goal)],
        ['Window', `${goalFormatDate(goal.startDate)} → ${goal.endDate ? goalFormatDate(goal.endDate) : 'open ended'}`],
        ['Repeats', goal.recurring ? 'Yes' : 'No'],
        ['Priority', goal.priority],
        ['Record status', goal.status],
        ['Source', goal.source]
    ].map(([label, value]) => `<div class="goal-def-row"><dt>${escapeHtml(label)}</dt><dd>${escapeHtml(String(value))}</dd></div>`).join('');

    const actualVsTarget = renderGoalMiniBarChart(
        (evaluation.groups && evaluation.groups.length)
            ? evaluation.groups.map(g => ({ label: g.label, value: g.value, tone: GOAL_STATUS_META[g.status]?.tone }))
                .concat([{ label: 'Target', value: evaluation.target, tone: 'neutral' }])
            : [
                { label: 'Actual', value: evaluation.actual ?? 0, tone: evaluation.statusMeta?.tone },
                { label: 'Target', value: evaluation.target, tone: 'neutral' }
            ],
        { valueFormatter: value => formatGoalValueWithUnit(goal, value, evaluation.unit, data), emptyText: 'Nothing to chart yet.' }
    );

    const historyChart = renderGoalMiniBarChart(
        (goal.periodHistory || []).slice(-12).map(p => ({
            label: goalFormatDate(p.periodStart),
            value: goalToNumber(p.actual, 0),
            tone: p.met ? 'good' : 'bad'
        })),
        { valueFormatter: value => formatGoalValueWithUnit(goal, value, null, data), emptyText: 'History fills in as periods close.' }
    );

    const logs = goalRelatedLogs(goal, bounds, data);
    const logRows = logs.length
        ? logs.map(log => `
            <li>
                <span>${escapeHtml(goalFormatDate(getLogDateStr(log)))}</span>
                <span>${escapeHtml(getSubstanceDisplayName(getUseSubstanceId(log), data))}</span>
                <span>${escapeHtml(formatAmount(getLogPersonalAmount(log), 3))} ${escapeHtml(getSubstanceDisplayUnit(getUseSubstanceId(log), data))}</span>
            </li>`).join('')
        : '<li class="goal-empty-inline">No matching logs in this period.</li>';

    const purchases = goalRelatedPurchases(goal, bounds, data);
    const purchaseRows = purchases.length
        ? purchases.map(p => `
            <li>
                <span>${escapeHtml(goalFormatDate(getPurchaseDateStr(p)))}</span>
                <span>${escapeHtml(getSubstanceDisplayName(getPurchaseSubstanceId(p), data))}</span>
                <span>${escapeHtml(getCurrencySymbol())}${escapeHtml(formatAmount(getPurchaseSpendAmount(p), 2))}</span>
                <span class="goal-mini-tag">${escapeHtml(getPurchaseAcquisitionType(p).replace(/_/g, ' '))}${purchaseIsPurchasedAsGift(p) ? ' · counts as spend' : ''}</span>
            </li>`).join('')
        : '<li class="goal-empty-inline">No matching purchases in this period.</li>';

    const plan = goal.linkedPlanId ? (data.taperPlansV2 || []).find(p => p?.id === goal.linkedPlanId) : null;
    const planBlock = plan
        ? `<p>Linked to <strong>${escapeHtml(plan.name || goalSubstanceLabel(plan.substanceId, data))}</strong>
             <button type="button" class="btn-small" onclick="unlinkGoalFromPlan('${escapeHtml(goal.id)}'); renderGoalsView();">Unlink</button></p>`
        : '<p class="goal-empty-inline">No taper plan linked.</p>';

    const changeRows = [...(goal.changeHistory || [])].reverse().slice(0, 15).map(c => `
        <li>
            <span>${escapeHtml(new Date(c.at).toLocaleString())}</span>
            <span>${escapeHtml(c.action)}</span>
            <span class="goal-mini-tag">${escapeHtml(Object.keys(c.detail || {}).map(k => `${k}: ${JSON.stringify(c.detail[k])}`).join(', ').slice(0, 120))}</span>
        </li>`).join('') || '<li class="goal-empty-inline">No changes recorded.</li>';

    return `
        <section class="goal-detail" id="goal-detail-root">
            <header class="goal-detail-head">
                <div>
                    <h3>${escapeHtml(goal.name)}</h3>
                    <p class="goal-card-period">${escapeHtml(bounds.label)} · <span class="goal-status-pill ${goalToneClass(evaluation.statusMeta.tone)}">${escapeHtml(evaluation.statusLabel)}</span></p>
                </div>
                <div class="goal-detail-actions">
                    <button type="button" class="btn-small" onclick="openGoalEditForm('${escapeHtml(goal.id)}')">Edit</button>
                    <button type="button" class="btn-small" onclick="exportGoalHistoryCsv('${escapeHtml(goal.id)}')">Export history</button>
                    <button type="button" class="btn-small" onclick="closeGoalDetail()">Close</button>
                </div>
            </header>

            ${goal.needsReview ? '<p class="goal-warning">This goal was imported or unlinked. Confirm the target before trusting the numbers.</p>' : ''}

            <div class="goal-detail-grid">
                <section class="goal-detail-block">
                    <h4>Definition</h4>
                    <dl class="goal-def-list">${definitionRows}</dl>
                </section>

                <section class="goal-detail-block">
                    <h4>Progress</h4>
                    ${renderGoalProgressBar(evaluation)}
                    <p>${escapeHtml(formatGoalActualDisplay(goal, evaluation, data))} against ${escapeHtml(formatGoalTargetDisplay(goal, data))}.</p>
                    ${actualVsTarget}
                    <p class="goal-hint">${stats.totalPeriods ? `${stats.metCount}/${stats.totalPeriods} periods met · current streak ${stats.currentStreak} · best ${stats.bestStreak}` : 'No finished periods yet.'}</p>
                </section>

                <section class="goal-detail-block">
                    <h4>History</h4>
                    ${historyChart}
                    ${renderGoalHistoryTable(goal, data)}
                </section>

                <section class="goal-detail-block">
                    <h4>Related logs</h4>
                    <ul class="goal-mini-list">${logRows}</ul>
                </section>

                <section class="goal-detail-block">
                    <h4>Related purchases</h4>
                    <ul class="goal-mini-list">${purchaseRows}</ul>
                </section>

                <section class="goal-detail-block">
                    <h4>Linked plan</h4>
                    ${planBlock}
                </section>

                <section class="goal-detail-block">
                    <h4>Notes</h4>
                    <p>${goal.notes ? escapeHtml(goal.notes) : '<span class="goal-empty-inline">No notes.</span>'}</p>
                </section>

                <section class="goal-detail-block">
                    <h4>Change history</h4>
                    <ul class="goal-mini-list">${changeRows}</ul>
                </section>
            </div>
        </section>`;
}

if (typeof window !== 'undefined') {
    Object.assign(window, {
        renderGoalsView,
        setGoalListBucket,
        setGoalSortBy,
        onGoalFilterChange,
        openGoalCreateForm,
        openGoalEditForm,
        openGoalDetail,
        closeGoalDetail,
        closeGoalForm,
        submitGoalForm,
        onGoalFormTypeChange,
        confirmDeleteGoal,
        applyGoalTemplate,
        pauseGoal,
        resumeGoal,
        completeGoalManually,
        archiveGoal,
        duplicateGoal,
        deleteGoal,
        unlinkGoalFromPlan,
        exportGoalsCsv,
        exportGoalHistoryCsv
    });
}
