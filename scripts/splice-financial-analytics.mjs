import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
let app = fs.readFileSync(path.join(root, 'app.js'), 'utf8');
const moduleCode = fs.readFileSync(path.join(root, 'financial-analytics.module.js'), 'utf8');

function replaceOnce(src, find, repl, label) {
    if (!src.includes(find)) throw new Error(`Missing patch target: ${label}\n---\n${find.slice(0, 200)}`);
    return src.replace(find, repl);
}

if (!app.includes('// ——— Financial Analytics ———')) {
    const marker = 'const defaultData = {';
    const idx = app.indexOf(marker);
    if (idx < 0) throw new Error('defaultData marker missing');
    app = `${app.slice(0, idx)}${moduleCode}\n\n${app.slice(idx)}`;
    console.log('Spliced financial module before defaultData');
} else {
    console.log('Financial module already present');
}

app = replaceOnce(app,
    '    goals: [],\n    settings: {',
    '    goals: [],\n    budgets: [],\n    settings: {',
    'defaultData.budgets');

app = replaceOnce(app,
    '    data.goals = Array.isArray(data.goals) ? data.goals : [];\n\n    ensurePurchaseIds(data);',
    '    data.goals = Array.isArray(data.goals) ? data.goals : [];\n    data.budgets = Array.isArray(data.budgets) ? data.budgets : [];\n\n    ensurePurchaseIds(data);',
    'normalize budgets array');

app = replaceOnce(app,
    '    ensureGoalSystemPrefs(data);\n    ensureTableColumnSettings(data);',
    '    ensureGoalSystemPrefs(data);\n    ensureFinancialAnalyticsPrefs(data);\n    ensureBudgets(data);\n    migrateFinancialAnalytics(data);\n    ensureTableColumnSettings(data);',
    'ensure financial prefs');

app = replaceOnce(app,
    '    statsGiftAnalytics: true,\n    taperPlanHeader: false,',
    '    statsGiftAnalytics: true,\n    statsFinancialAnalytics: true,\n    taperPlanHeader: false,',
    'collapsed financial section');

app = replaceOnce(app,
    '        goals: (data.goals || []).map(g => ({ ...g })),\n\n        recoveryStreaks: data.recoveryStreaks || {},',
    '        goals: (data.goals || []).map(g => ({ ...g })),\n        budgets: (data.budgets || []).map(b => ({ ...b })),\n\n        recoveryStreaks: data.recoveryStreaks || {},',
    'export budgets');

app = replaceOnce(app,
    '    if (!Array.isArray(data.goals)) data.goals = [];\n    if (!data.recoveryStreaks || typeof data.recoveryStreaks !== \'object\' || Array.isArray(data.recoveryStreaks)) {\n        data.recoveryStreaks = {};\n    }',
    '    if (!Array.isArray(data.goals)) data.goals = [];\n    if (!Array.isArray(data.budgets)) data.budgets = [];\n    if (!data.recoveryStreaks || typeof data.recoveryStreaks !== \'object\' || Array.isArray(data.recoveryStreaks)) {\n        data.recoveryStreaks = {};\n    }',
    'import normalize budgets');

app = replaceOnce(app,
    '    if (Array.isArray(imported.goals)) {\n        merged.goals = mergeArrayById(merged.goals || [], imported.goals);\n    }\n    merged.recoveryStreaks = { ...(merged.recoveryStreaks || {}), ...(imported.recoveryStreaks || {}) };',
    '    if (Array.isArray(imported.goals)) {\n        merged.goals = mergeArrayById(merged.goals || [], imported.goals);\n    }\n    if (Array.isArray(imported.budgets)) {\n        merged.budgets = mergeArrayById(merged.budgets || [], imported.budgets);\n    }\n    merged.recoveryStreaks = { ...(merged.recoveryStreaks || {}), ...(imported.recoveryStreaks || {}) };',
    'merge budgets');

app = replaceOnce(app,
    '        goals: (data.goals || []).length\n    });',
    '        goals: (data.goals || []).length,\n        budgets: (data.budgets || []).length\n    });',
    'calendar cache budgets');

app = replaceOnce(app,
    '    if (typeof mapGoalsToCalendarEvents === \'function\') {\n        mapGoalsToCalendarEvents(bounds, data).forEach(ev => events.push(ev));\n    }\n\n    const filtered = events',
    '    if (typeof mapGoalsToCalendarEvents === \'function\') {\n        mapGoalsToCalendarEvents(bounds, data).forEach(ev => events.push(ev));\n    }\n    if (typeof mapFinancialCalendarEvents === \'function\') {\n        mapFinancialCalendarEvents(bounds, data).forEach(ev => events.push(ev));\n    }\n\n    const filtered = events',
    'calendar financial events');

app = replaceOnce(app,
    '    renderBuyInsights(currentSubstanceId, insights);\n    renderGiftAnalytics(insights.bounds);',
    `    renderBuyInsights(currentSubstanceId, insights);
    try {
        if (typeof ensureFinancialAnalyticsPrefs === 'function') {
            const finPrefs = ensureFinancialAnalyticsPrefs(appData);
            finPrefs.filters = finPrefs.filters || {};
            finPrefs.filters.substanceId = currentSubstanceId || 'all';
            if (insights.bounds?.startDate && insights.bounds?.endDate) {
                finPrefs.filters.customStart = insights.bounds.startDate;
                finPrefs.filters.customEnd = insights.bounds.endDate;
            }
        }
        if (typeof invalidateFinancialAnalyticsCache === 'function') invalidateFinancialAnalyticsCache();
        if (typeof renderFinancialAnalyticsView === 'function') renderFinancialAnalyticsView();
    } catch (err) { console.error('Financial analytics render failed', err); }
    renderGiftAnalytics(insights.bounds);`,
    'updateStats financial render');

// Purchase history optional financial columns (hidden by default)
app = replaceOnce(app,
    "order: ['select', 'date', 'substance', 'bought', 'remaining', 'usedPct', 'supplyDuration', 'supply', 'cost', 'store', 'payment', 'flavor', 'notes', 'break', 'actions'],\n        hidden: [],",
    "order: ['select', 'date', 'substance', 'bought', 'remaining', 'usedPct', 'supplyDuration', 'supply', 'cost', 'costPerUnit', 'acquisitionType', 'store', 'supplier', 'payment', 'giftRecipient', 'runningMonthlySpend', 'runningYearlySpend', 'budgetStatus', 'flavor', 'notes', 'break', 'actions'],\n        hidden: ['costPerUnit', 'acquisitionType', 'supplier', 'giftRecipient', 'runningMonthlySpend', 'runningYearlySpend', 'budgetStatus'],",
    'purchase history columns order');

app = replaceOnce(app,
    `            cost: 100,
            store: 140,
            payment: 110,
            flavor: 120,
            notes: 220,
            break: 100,
            actions: 220
        }
    },
    statsWeekly: {`,
    `            cost: 100,
            costPerUnit: 110,
            acquisitionType: 120,
            store: 140,
            supplier: 140,
            payment: 110,
            giftRecipient: 140,
            runningMonthlySpend: 130,
            runningYearlySpend: 130,
            budgetStatus: 110,
            flavor: 120,
            notes: 220,
            break: 100,
            actions: 220
        }
    },
    statsWeekly: {`,
    'purchase history widths');

app = replaceOnce(app,
    `        cost: 'Cost',
        store: 'Store',
        payment: 'Payment',
        flavor: 'Flavor',
        notes: 'Notes',
        break: 'Break Since Previous Buy',
        actions: 'Actions'
    },
    statsWeekly: {`,
    `        cost: 'Cost',
        costPerUnit: 'Cost per Unit',
        acquisitionType: 'Acquisition Type',
        store: 'Store',
        supplier: 'Supplier',
        payment: 'Payment',
        giftRecipient: 'Purchased as Gift Recipient',
        runningMonthlySpend: 'Running Monthly Spending',
        runningYearlySpend: 'Running Yearly Spending',
        budgetStatus: 'Budget Status',
        flavor: 'Flavor',
        notes: 'Notes',
        break: 'Break Since Previous Buy',
        actions: 'Actions'
    },
    statsWeekly: {`,
    'purchase history labels');

app = replaceOnce(app,
    `        case 'store':
            return phTd('store', store || '—');
        case 'payment':
            return phTd('payment', purchase.paymentMethod || '—');
        case 'flavor': {`,
    `        case 'store':
            return phTd('store', store || '—');
        case 'payment':
            return phTd('payment', purchase.paymentMethod || '—');
        case 'costPerUnit': {
            const unitCpu = getPurchaseHistoryCostPerUnit(purchase, totalNum);
            const unitSuffix = getPurchaseHistoryCostPerUnitSuffix(purchase);
            return phTd('costPerUnit', Number.isFinite(unitCpu) ? (fmtSheetMoney(unitCpu, cur) + '/' + unitSuffix) : '—');
        }
        case 'acquisitionType':
            return phTd('acquisitionType', getPurchaseAcquisitionType(purchase) || '—');
        case 'supplier':
            return phTd('supplier', (typeof financialPurchaseSupplier === 'function' ? financialPurchaseSupplier(purchase) : (purchase.store || getPurchaseGiftSource(purchase) || '')) || '—');
        case 'giftRecipient':
            return phTd('giftRecipient', getPurchaseGiftRecipient(purchase) || '—');
        case 'runningMonthlySpend':
            return phTd('runningMonthlySpend', ctx.runningMonthlySpendLabel || '—');
        case 'runningYearlySpend':
            return phTd('runningYearlySpend', ctx.runningYearlySpendLabel || '—');
        case 'budgetStatus':
            return phTd('budgetStatus', ctx.budgetStatusLabel || '—');
        case 'flavor': {`,
    'purchase history cell cases');

// Test exports
app = replaceOnce(app,
    `        migrateLegacyGoals,
        buildCalendarEvents,`,
    `        migrateLegacyGoals,
        ensureFinancialAnalyticsPrefs,
        getFinancialAnalyticsPrefs,
        persistFinancialAnalyticsPrefs,
        ensureBudgets,
        getBudgets,
        getBudgetById,
        saveBudget,
        deleteBudget,
        validateBudgetRecord,
        normalizeBudgetRecord,
        resolveFinancialBounds,
        resolveFinancialPreviousBounds,
        getFinancialPurchases,
        sumFinancialSpend,
        buildFinancialCoreMetrics,
        buildSubstanceCostMetrics,
        buildFinancialPeriodComparison,
        evaluateBudgets,
        buildFinancialSavings,
        buildFinancialForecast,
        buildFinancialBreakdowns,
        buildFinancialAlerts,
        buildFinancialDataset,
        buildDashboardFinancialSummary,
        mapFinancialCalendarEvents,
        scanFinancialDataQuality,
        exportFinancialAnalyticsCsv,
        invalidateFinancialAnalyticsCache,
        FINANCIAL_DATE_PRESETS,
        migrateFinancialAnalytics,
        buildCalendarEvents,`,
    'test exports financial');

fs.writeFileSync(path.join(root, 'app.js'), app);
console.log('Patched app.js lines:', app.split('\n').length);
