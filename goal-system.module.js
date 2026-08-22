// ——— Goal System (removed) ———
// The standalone Goal feature was removed. Tapers are the only planning/target system.
// These stubs remain so:
//   1. Old localStorage / JSON backups that contain a `goals` array still load.
//   2. Call sites that still name Goal helpers do not throw.
//   3. Goals are never created, evaluated, converted into tapers, or shown in the UI.

function ensureGoals(data = appData) {
    if (!data || typeof data !== 'object') return [];
    if (!Array.isArray(data.goals)) data.goals = [];
    return data.goals;
}
function getGoals(data = appData) { return ensureGoals(data); }
function getGoalById() { return null; }
function ensureGoalSystemPrefs(data = appData) {
    if (!data.settings || typeof data.settings !== 'object') data.settings = {};
    if (!data.settings.goalSystem || typeof data.settings.goalSystem !== 'object') data.settings.goalSystem = {};
    return data.settings.goalSystem;
}
function getDefaultGoalRecord() {
    return { id: '', name: '', type: '', status: 'active', substanceId: 'all', linkedPlanId: '', changeHistory: [] };
}
function normalizeGoalRecord(goal) {
    if (!goal || typeof goal !== 'object') return getDefaultGoalRecord();
    return { ...getDefaultGoalRecord(), ...goal, linkedPlanId: goal.linkedPlanId || '', changeHistory: Array.isArray(goal.changeHistory) ? goal.changeHistory : [] };
}
function saveGoalRecord() { return { goal: null, ok: false }; }
function evaluateAllGoals() { return []; }
function buildGoalDashboardSummary() { return { counts: { active: 0, atRisk: 0, completed: 0, paused: 0 } }; }
function mapGoalsToCalendarEvents() { return []; }
function migrateLegacyGoals() {}
function renderGoalsView() {
    if (typeof setGoalsPlansView === 'function') setGoalsPlansView('overview');
}
function renderGoalInsightsPanel() {
    // Goals were removed. Legacy #goal-insights-panel markup is no longer in the UI.
    const el = typeof document !== 'undefined' ? document.getElementById('goal-insights-panel') : null;
    if (el) el.innerHTML = '';
}
function pushGoalChange() {}
