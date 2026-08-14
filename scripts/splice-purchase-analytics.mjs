#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
let app = fs.readFileSync(path.join(root, 'app.js'), 'utf8');
const moduleCode = fs.readFileSync(path.join(root, 'purchase-analytics.module.js'), 'utf8');
let html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
let css = fs.readFileSync(path.join(root, 'styles.css'), 'utf8');

function replaceOnce(src, find, repl, label) {
    if (src.includes(repl.trim().slice(0, 40)) && label.includes('skip-if-done')) return src;
    if (!src.includes(find)) throw new Error(`Missing patch target: ${label}\n---\n${find.slice(0, 220)}`);
    return src.replace(find, repl);
}

if (!app.includes('// ——— Purchase Analytics ———')) {
    const marker = 'const defaultData = {';
    const idx = app.indexOf(marker);
    if (idx < 0) throw new Error('defaultData marker missing');
    app = `${app.slice(0, idx)}${moduleCode}\n\n${app.slice(idx)}`;
    console.log('Spliced purchase analytics module before defaultData');
} else {
    console.log('Purchase analytics module already present');
}

if (!app.includes('ensurePurchaseAnalyticsPrefs(data)')) {
    app = replaceOnce(app,
        '    migrateFinancialAnalytics(data);\n    ensureTableColumnSettings(data);',
        '    migrateFinancialAnalytics(data);\n    ensurePurchaseAnalyticsPrefs(data);\n    migratePurchaseAnalytics(data);\n    ensureTableColumnSettings(data);',
        'ensure purchase analytics prefs');
}

if (!app.includes('statsPurchaseAnalytics:')) {
    app = replaceOnce(app,
        '    statsCustomMetrics: false,\n    taperPlanHeader: false,',
        '    statsCustomMetrics: false,\n    statsPurchaseAnalytics: false,\n    purchaseAnalyticsFilters: false,\n    taperPlanHeader: false,',
        'collapsed purchase analytics');
}

// Hook updateStats to render purchase analytics near financial/gift
if (!app.includes('renderPurchaseAnalyticsView()')) {
    const finHook = `if (typeof renderFinancialAnalyticsView === 'function') renderFinancialAnalyticsView();
    } catch (err) { console.error('Financial analytics render failed', err); }
    renderGiftAnalytics(insights.bounds);`;
    const finHookNew = `if (typeof renderFinancialAnalyticsView === 'function') renderFinancialAnalyticsView();
    } catch (err) { console.error('Financial analytics render failed', err); }
    try {
        if (typeof ensurePurchaseAnalyticsPrefs === 'function') {
            const paPrefs = ensurePurchaseAnalyticsPrefs(appData);
            paPrefs.filters = paPrefs.filters || {};
            paPrefs.filters.substanceId = currentSubstanceId || 'all';
            if (insights.bounds?.startDate && insights.bounds?.endDate) {
                paPrefs.filters.customStart = insights.bounds.startDate;
                paPrefs.filters.customEnd = insights.bounds.endDate;
            }
        }
        if (typeof invalidatePurchaseAnalyticsCache === 'function') invalidatePurchaseAnalyticsCache();
        if (typeof renderPurchaseAnalyticsView === 'function') renderPurchaseAnalyticsView();
    } catch (err) { console.error('Purchase analytics render failed', err); }
    renderGiftAnalytics(insights.bounds);`;
    if (app.includes(finHook)) {
        app = app.replace(finHook, finHookNew);
        console.log('Hooked renderPurchaseAnalyticsView into updateStats');
    } else {
        console.warn('Could not find financial/gift hook for purchase analytics');
    }
}

// Insights calendar purchase view
if (!app.includes("if (next === 'purchase' && typeof renderPurchaseAnalyticsView")) {
    app = replaceOnce(app,
        "if (next === 'financial' && typeof renderFinancialAnalyticsView === 'function') renderFinancialAnalyticsView();",
        "if (next === 'financial' && typeof renderFinancialAnalyticsView === 'function') renderFinancialAnalyticsView();\n        if (next === 'purchase' && typeof renderPurchaseAnalyticsView === 'function') renderPurchaseAnalyticsView();",
        'insights purchase subview render');
}

// Purchase history columns
if (!app.includes("'inventoryLifespan'")) {
    app = replaceOnce(app,
        "order: ['select', 'date', 'substance', 'bought', 'remaining', 'usedPct', 'supplyDuration', 'supply', 'cost', 'costPerUnit', 'acquisitionType', 'store', 'supplier', 'payment', 'giftRecipient', 'runningMonthlySpend', 'runningYearlySpend', 'budgetStatus', 'flavor', 'notes', 'break', 'actions'],\n        hidden: ['costPerUnit', 'acquisitionType', 'supplier', 'giftRecipient', 'runningMonthlySpend', 'runningYearlySpend', 'budgetStatus'],",
        "order: ['select', 'date', 'substance', 'bought', 'remaining', 'usedPct', 'supplyDuration', 'supply', 'cost', 'costPerUnit', 'acquisitionType', 'store', 'supplier', 'payment', 'giftRecipient', 'runningMonthlySpend', 'runningYearlySpend', 'budgetStatus', 'productType', 'inventoryLifespan', 'giftStatus', 'linkedUsers', 'purchaseQualityRating', 'flavor', 'notes', 'break', 'actions'],\n        hidden: ['costPerUnit', 'acquisitionType', 'supplier', 'giftRecipient', 'runningMonthlySpend', 'runningYearlySpend', 'budgetStatus', 'productType', 'inventoryLifespan', 'giftStatus', 'linkedUsers', 'purchaseQualityRating'],",
        'purchase history column order');

    app = replaceOnce(app,
        `            budgetStatus: 110,
            flavor: 120,`,
        `            budgetStatus: 110,
            productType: 120,
            inventoryLifespan: 120,
            giftStatus: 130,
            linkedUsers: 140,
            purchaseQualityRating: 110,
            flavor: 120,`,
        'purchase history widths');

    app = replaceOnce(app,
        `        budgetStatus: 'Budget Status',
        flavor: 'Flavor',`,
        `        budgetStatus: 'Budget Status',
        productType: 'Product Type',
        inventoryLifespan: 'Inventory Lifespan',
        giftStatus: 'Gift Status',
        linkedUsers: 'Linked Users',
        purchaseQualityRating: 'Purchase Quality',
        flavor: 'Flavor',`,
        'purchase history labels');
}

// Cell renderers
if (!app.includes("case 'inventoryLifespan':")) {
    app = replaceOnce(app,
        `        case 'budgetStatus':
            return phTd('budgetStatus', ctx.budgetStatusLabel || '—');
        case 'flavor': {`,
        `        case 'budgetStatus':
            return phTd('budgetStatus', ctx.budgetStatusLabel || '—');
        case 'productType':
            return phTd('productType', (typeof purchaseAnalyticsProductType === 'function' ? purchaseAnalyticsProductType(purchase) : (purchase.weedProductType || purchase.productType || purchase.flavor || '')) || '—');
        case 'inventoryLifespan':
            return phTd('inventoryLifespan', typeof purchaseHistoryInventoryLifespanLabel === 'function' ? purchaseHistoryInventoryLifespanLabel(purchase) : (supplyDurationLabel || '—'));
        case 'giftStatus':
            return phTd('giftStatus', typeof purchaseHistoryGiftStatusLabel === 'function' ? purchaseHistoryGiftStatusLabel(purchase) : '—');
        case 'linkedUsers':
            return phTd('linkedUsers', typeof purchaseHistoryLinkedUsersLabel === 'function' ? purchaseHistoryLinkedUsersLabel(purchase) : '—');
        case 'purchaseQualityRating':
            return phTd('purchaseQualityRating', typeof purchaseHistoryQualityRating === 'function' ? purchaseHistoryQualityRating(purchase) : '—');
        case 'flavor': {`,
        'purchase history body cells');
}

// Test exports
if (!app.includes('buildPurchaseAnalyticsDataset,')) {
    app = replaceOnce(app,
        '        migrateFinancialAnalytics,',
        `        migrateFinancialAnalytics,
        ensurePurchaseAnalyticsPrefs,
        getPurchaseAnalyticsPrefs,
        persistPurchaseAnalyticsPrefs,
        migratePurchaseAnalytics,
        getPurchaseAnalyticsPurchases,
        getPurchaseAnalyticsSpendPurchases,
        buildPurchaseDashboardMetrics,
        buildPurchaseFrequencyMetrics,
        buildSupplierAnalytics,
        buildStoreAnalytics,
        buildPriceTrackingMetrics,
        buildPurchasePatternMetrics,
        buildInventoryTurnoverMetrics,
        buildProductAnalytics,
        buildPurchaseAnalyticsDataset,
        buildPurchaseAnalyticsCsvRows,
        exportPurchaseAnalyticsCsv,
        purchaseAnalyticsCostPerUnit,
        purchaseAnalyticsCountsTowardSpend,
        renderPurchaseAnalyticsView,`,
        'test exports');
}

// HTML mount
if (!html.includes('id="purchase-analytics-root"')) {
    html = replaceOnce(html,
        `                <div class="collapsible-section" data-section="statsBuyAnalytics" data-ic-panels="purchase overview">
                    <button type="button" class="section-toggle" onclick="toggleSection('statsBuyAnalytics')">
                        <span>Spending &amp; Purchases</span>
                        <span class="chevron">⌄</span>
                    </button>
                    <div class="section-content">
                        <div id="stats-buy-analytics-cards" class="sheet-summary-grid"></div>`,
        `                <div class="collapsible-section" data-section="statsPurchaseAnalytics" data-ic-panels="purchase overview" id="purchase-analytics-section">
                    <button type="button" class="section-toggle" onclick="toggleSection('statsPurchaseAnalytics')">
                        <span>Purchase Analytics</span>
                        <span class="chevron">⌄</span>
                    </button>
                    <div class="section-content">
                        <p class="settings-hint">Purchasing habits, pricing trends, suppliers, stores, and inventory turnover. Uses the same spend rules as Financial Analytics.</p>
                        <div id="purchase-analytics-root" class="purchase-analytics-root" aria-live="polite"></div>
                    </div>
                </div>

                <div class="collapsible-section" data-section="statsBuyAnalytics" data-ic-panels="purchase overview">
                    <button type="button" class="section-toggle" onclick="toggleSection('statsBuyAnalytics')">
                        <span>Spending &amp; Purchases</span>
                        <span class="chevron">⌄</span>
                    </button>
                    <div class="section-content">
                        <div id="stats-buy-analytics-cards" class="sheet-summary-grid"></div>`,
        'html purchase analytics section');
}

if (!css.includes('.purchase-analytics-root')) {
    css += `

/* Purchase Analytics */
.purchase-analytics-root { margin-top: 4px; }
.pa-view { display: flex; flex-direction: column; gap: 14px; }
.pa-toolbar { display: flex; flex-wrap: wrap; gap: 8px; align-items: center; justify-content: space-between; }
.pa-summary-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(140px, 1fr)); gap: 10px; }
.pa-card { border: 1px solid var(--border); border-radius: 12px; padding: 12px; background: var(--panel, var(--bg-card, #fff)); }
.pa-card span { display: block; font-size: 0.78rem; color: var(--text-secondary); }
.pa-card strong { display: block; margin-top: 4px; font-size: 1.05rem; }
.pa-panel { border: 1px solid var(--border); border-radius: 12px; padding: 12px; background: var(--surface, transparent); }
.pa-panel h3 { margin: 0 0 10px; font-size: 1.05rem; }
.pa-panel h4 { margin: 12px 0 6px; font-size: 0.92rem; }
.pa-filters-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(140px, 1fr)); gap: 8px; }
.pa-filters-grid label { display: flex; flex-direction: column; gap: 4px; font-size: 0.82rem; }
.pa-filters-grid select, .pa-filters-grid input {
    min-height: 40px; border: 1px solid var(--border); border-radius: 8px; padding: 6px 10px;
    background: var(--bg, #fff); color: var(--text);
}
.pa-bar-chart { display: flex; flex-direction: column; gap: 6px; }
.pa-bar-row { display: grid; grid-template-columns: 88px 1fr 64px; gap: 8px; align-items: center; font-size: 0.8rem; }
.pa-bar-track { height: 10px; border-radius: 999px; background: rgba(127,127,127,0.15); overflow: hidden; }
.pa-bar-fill { display: block; height: 100%; background: var(--accent); border-radius: inherit; min-width: 2px; }
.pa-table { width: 100%; border-collapse: collapse; font-size: 0.85rem; }
.pa-table th, .pa-table td { border-bottom: 1px solid var(--border); padding: 6px 4px; text-align: left; }
.pa-empty, .pa-loading, .pa-error { color: var(--text-secondary); font-size: 0.9rem; }
@media (max-width: 640px) {
    .pa-summary-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); }
    .pa-bar-row { grid-template-columns: 64px 1fr 52px; }
}
`;
    console.log('Appended purchase analytics CSS');
}

fs.writeFileSync(path.join(root, 'app.js'), app);
fs.writeFileSync(path.join(root, 'index.html'), html);
fs.writeFileSync(path.join(root, 'styles.css'), css);
console.log('splice-purchase-analytics complete');
