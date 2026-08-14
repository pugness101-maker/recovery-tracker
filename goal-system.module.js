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
function getGoalSystemPrefs(data = appData) { return ensureGoalSystemPrefs(data); }
function persistGoalSystemPrefs() {}
function getDefaultGoalRecord() {
    return { id: '', name: '', type: '', status: 'active', substanceId: 'all', linkedPlanId: '', changeHistory: [] };
}
function normalizeGoalRecord(goal) {
    if (!goal || typeof goal !== 'object') return getDefaultGoalRecord();
    return { ...getDefaultGoalRecord(), ...goal, linkedPlanId: goal.linkedPlanId || '', changeHistory: Array.isArray(goal.changeHistory) ? goal.changeHistory : [] };
}
function validateGoalRecord() { return { ok: false, errors: ['Goals have been removed'] }; }
function saveGoalRecord() { return { goal: null, ok: false }; }
function createGoalFromTemplate() { return null; }
function duplicateGoal() { return null; }
function pauseGoal() { return null; }
function resumeGoal() { return null; }
function completeGoalManually() { return null; }
function archiveGoal() { return null; }
function deleteGoal() { return null; }
function evaluateGoal() { return null; }
function evaluateAllGoals() { return []; }
function computeGoalStatusFromProgress() { return 'active'; }
function computeGoalActual() { return 0; }
function resolveGoalPeriodBounds() { return null; }
function syncGoalPeriodHistory() {}
function filterAndSortGoalEvaluations(list) { return Array.isArray(list) ? list : []; }
function buildGoalDashboardSummary() { return { counts: { active: 0, atRisk: 0, completed: 0, paused: 0 } }; }
function buildGoalInsightsAnalytics() { return {}; }
function buildGoalReminders() { return []; }
function mapGoalsToCalendarEvents() { return []; }
function suggestGoalsFromPlan() { return []; }
function migrateLegacyGoals() {}
function openGoalCreateForm() { if (typeof openUnifiedNewTaper === 'function') openUnifiedNewTaper(); }
function openGoalDetail() {}
function openGoalEditForm() {}
function renderGoalsView() {
    if (typeof setGoalsPlansView === 'function') setGoalsPlansView('overview');
}
function renderGoalInsightsPanel() {
    const el = typeof document !== 'undefined' ? document.getElementById('goal-insights-panel') : null;
    if (el) el.innerHTML = '';
}
function formatGoalStatusLabel(status) { return String(status || '').replace(/_/g, ' '); }
function formatGoalTargetDisplay() { return '—'; }
function getGoalTypeMeta() { return null; }
function pushGoalChange() {}
function goalAfterMutation(data = appData) { if (typeof saveData === 'function') saveData(data); }
