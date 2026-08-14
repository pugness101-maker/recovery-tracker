// ——— Purchase Analytics ———
// Purchase habits, pricing, suppliers, stores, and inventory turnover.
// Local-only: mutations persist through saveData(appData).
// Spliced into app.js ahead of `const defaultData`.
//
// Rules:
//   • Purchased + Purchased as Gift count toward spending.
//   • Gift Received never counts as spending.
//   • Purchased as Gift is not usable inventory.
//   • Never double-count the same purchase id.
//   • Weighted cost/unit = total spend ÷ total qualifying quantity.

const PURCHASE_ANALYTICS_WEEKDAYS = Object.freeze([
    'Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'
]);

let purchaseAnalyticsCache = null;
let purchaseAnalyticsCacheKey = '';

function paToNumber(value, fallback = 0) {
    const n = typeof value === 'number' ? value : parseFloat(value);
    return Number.isFinite(n) ? n : fallback;
}

function paRound(value, decimals = 2) {
    const n = paToNumber(value, NaN);
    if (!Number.isFinite(n)) return null;
    const f = 10 ** decimals;
    return Math.round(n * f) / f;
}

function paTrim(value) {
    return String(value ?? '').trim();
}

function paKey(value) {
    return paTrim(value).toLowerCase();
}

function paToday() {
    return typeof getLocalDateString === 'function' ? getLocalDateString() : new Date().toISOString().slice(0, 10);
}

function paAllSubstancesId() {
    return typeof DASHBOARD_ALL !== 'undefined' ? DASHBOARD_ALL : 'all';
}

function paMoney(value, decimals = 2) {
    if (value == null || !Number.isFinite(paToNumber(value, NaN))) return '—';
    const sym = typeof getCurrencySymbol === 'function' ? getCurrencySymbol() : '$';
    return `${sym}${formatAmount(paToNumber(value, 0), decimals)}`;
}

function paNumberOrDash(value, decimals = 2) {
    if (value == null || !Number.isFinite(paToNumber(value, NaN))) return '—';
    return formatAmount(value, decimals);
}

function paDateLabel(dateStr) {
    const d = typeof parseLocalDate === 'function' ? parseLocalDate(dateStr) : null;
    if (!d) return dateStr || '—';
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

function paDaysBetween(a, b) {
    const da = typeof parseLocalDate === 'function' ? parseLocalDate(a) : null;
    const db = typeof parseLocalDate === 'function' ? parseLocalDate(b) : null;
    if (!da || !db) return null;
    return Math.round((db.getTime() - da.getTime()) / 86400000);
}

function paMedian(values) {
    const nums = (values || []).map(v => paToNumber(v, NaN)).filter(Number.isFinite).sort((a, b) => a - b);
    if (!nums.length) return null;
    const mid = Math.floor(nums.length / 2);
    return nums.length % 2 ? nums[mid] : (nums[mid - 1] + nums[mid]) / 2;
}

function paMean(values) {
    const nums = (values || []).map(v => paToNumber(v, NaN)).filter(Number.isFinite);
    if (!nums.length) return null;
    return nums.reduce((s, n) => s + n, 0) / nums.length;
}

function invalidatePurchaseAnalyticsCache() {
    purchaseAnalyticsCache = null;
    purchaseAnalyticsCacheKey = '';
}

function getDefaultPurchaseAnalyticsFilters() {
    return {
        substanceId: paAllSubstancesId(),
        productType: '',
        store: '',
        supplier: '',
        paymentMethod: '',
        acquisitionType: '',
        giftStatus: '',
        minCost: '',
        maxCost: '',
        minQuantity: '',
        maxQuantity: '',
        dateRangePreset: 'last-30',
        customStart: '',
        customEnd: ''
    };
}

function getDefaultPurchaseAnalyticsPrefs() {
    return {
        chartGrain: 'monthly',
        filtersCollapsed: false,
        favoriteStores: [],
        storeDistances: {},
        filters: getDefaultPurchaseAnalyticsFilters()
    };
}

function ensurePurchaseAnalyticsPrefs(data = appData) {
    if (!data || typeof data !== 'object') return getDefaultPurchaseAnalyticsPrefs();
    if (!data.settings || typeof data.settings !== 'object') data.settings = {};
    const defaults = getDefaultPurchaseAnalyticsPrefs();
    if (!data.settings.purchaseAnalytics || typeof data.settings.purchaseAnalytics !== 'object') {
        data.settings.purchaseAnalytics = {
            ...defaults,
            filters: { ...defaults.filters },
            favoriteStores: [],
            storeDistances: {}
        };
    }
    const prefs = data.settings.purchaseAnalytics;
    Object.keys(defaults).forEach(key => {
        if (prefs[key] === undefined) {
            prefs[key] = (key === 'filters' || key === 'storeDistances')
                ? { ...defaults[key] }
                : Array.isArray(defaults[key]) ? [...defaults[key]] : defaults[key];
        }
    });
    if (!prefs.filters || typeof prefs.filters !== 'object') prefs.filters = { ...defaults.filters };
    Object.keys(defaults.filters).forEach(key => {
        if (prefs.filters[key] === undefined) prefs.filters[key] = defaults.filters[key];
    });
    if (!Array.isArray(prefs.favoriteStores)) prefs.favoriteStores = [];
    if (!prefs.storeDistances || typeof prefs.storeDistances !== 'object') prefs.storeDistances = {};
    return prefs;
}

function getPurchaseAnalyticsPrefs(data = appData) {
    return ensurePurchaseAnalyticsPrefs(data);
}

function persistPurchaseAnalyticsPrefs(patch = {}, data = appData) {
    const prefs = ensurePurchaseAnalyticsPrefs(data);
    const { filters, favoriteStores, storeDistances, ...rest } = patch || {};
    Object.assign(prefs, rest);
    if (filters) prefs.filters = { ...prefs.filters, ...filters };
    if (favoriteStores) prefs.favoriteStores = [...favoriteStores];
    if (storeDistances) prefs.storeDistances = { ...prefs.storeDistances, ...storeDistances };
    ensurePurchaseAnalyticsPrefs(data);
    invalidatePurchaseAnalyticsCache();
    if (typeof saveData === 'function') saveData(data);
    return prefs;
}

function migratePurchaseAnalytics(data = appData) {
    ensurePurchaseAnalyticsPrefs(data);
    return data;
}

function purchaseAnalyticsAcquisitionType(purchase) {
    if (typeof getPurchaseAcquisitionType === 'function') return getPurchaseAcquisitionType(purchase);
    return paTrim(purchase?.acquisitionType || purchase?.type || 'purchased') || 'purchased';
}

function purchaseAnalyticsCountsTowardSpend(purchase) {
    if (typeof purchaseCountsTowardSpend === 'function') return purchaseCountsTowardSpend(purchase);
    if (typeof financialCountsTowardSpend === 'function') return financialCountsTowardSpend(purchase);
    const t = purchaseAnalyticsAcquisitionType(purchase);
    return t === 'purchased' || t === 'purchased_as_gift';
}

function purchaseAnalyticsSpendAmount(purchase) {
    if (!purchaseAnalyticsCountsTowardSpend(purchase)) return 0;
    if (typeof getPurchaseSpendAmount === 'function') return paToNumber(getPurchaseSpendAmount(purchase), 0);
    return paToNumber(purchase?.totalCost ?? purchase?.cost ?? purchase?.price, 0);
}

function purchaseAnalyticsIsPurchasedAsGift(purchase) {
    if (typeof purchaseIsPurchasedAsGift === 'function') return purchaseIsPurchasedAsGift(purchase);
    return purchaseAnalyticsAcquisitionType(purchase) === 'purchased_as_gift';
}

function purchaseAnalyticsIsGiftReceived(purchase) {
    return purchaseAnalyticsAcquisitionType(purchase) === 'gift_received';
}

function purchaseAnalyticsIsUsableInventory(purchase) {
    if (purchaseAnalyticsIsPurchasedAsGift(purchase)) return false;
    if (typeof purchaseIsPersonalUseInventory === 'function') return purchaseIsPersonalUseInventory(purchase);
    const t = purchaseAnalyticsAcquisitionType(purchase);
    return t === 'purchased' || t === 'gift_received';
}

function purchaseAnalyticsSupplier(purchase) {
    if (typeof financialPurchaseSupplier === 'function') {
        const s = financialPurchaseSupplier(purchase);
        if (s) return s;
    }
    return paTrim(
        purchase?.supplier
        || purchase?.store
        || purchase?.giftSource
        || purchase?.giverName
        || purchase?.dealer
        || purchase?.contact
        || ''
    );
}

function purchaseAnalyticsStore(purchase) {
    return paTrim(purchase?.store || '');
}

function purchaseAnalyticsProductType(purchase) {
    if (typeof normalizeWeedProductType === 'function') {
        const pt = normalizeWeedProductType(purchase?.weedProductType || purchase?.productType || purchase?.flavor);
        if (pt) return pt;
    }
    return paTrim(purchase?.weedProductType || purchase?.productType || purchase?.flavor || '');
}

function purchaseAnalyticsQuantity(purchase) {
    if (typeof getPurchaseQuantityBought === 'function') return paToNumber(getPurchaseQuantityBought(purchase), 0);
    return paToNumber(purchase?.quantityBought ?? purchase?.quantity ?? purchase?.amount, 0);
}

function purchaseAnalyticsRemaining(purchase) {
    if (typeof getPurchaseRemainingAmount === 'function') return paToNumber(getPurchaseRemainingAmount(purchase), 0);
    return paToNumber(purchase?.remainingAmount ?? purchase?.remaining, 0);
}

function purchaseAnalyticsUnit(purchase, data = appData) {
    return paTrim(purchase?.unit || '')
        || (typeof getSubstancePrimaryUnit === 'function'
            ? getSubstancePrimaryUnit(purchase?.substanceId, data)
            : '')
        || 'unit';
}

function purchaseAnalyticsCostPerUnit(purchase) {
    const qty = purchaseAnalyticsQuantity(purchase);
    const spend = purchaseAnalyticsSpendAmount(purchase);
    if (!(qty > 0) || !(spend >= 0) || !purchaseAnalyticsCountsTowardSpend(purchase)) return null;
    return spend / qty;
}

function purchaseAnalyticsPriceMetricKey(purchase, data = appData) {
    const substance = typeof getSubstance === 'function' ? getSubstance(purchase?.substanceId, data) : null;
    const mode = substance?.trackingMode || '';
    const productType = purchaseAnalyticsProductType(purchase);
    const unit = purchaseAnalyticsUnit(purchase, data).toLowerCase();

    if (mode === 'weed' || purchase?.substanceId === 'weed-thc') {
        if (productType === 'edibles' || productType === 'edible') {
            const thc = paToNumber(purchase?.totalThcMg ?? purchase?.thcMg, 0);
            if (thc > 0) return 'cost_per_thc_mg';
            return 'cost_per_edible';
        }
        if (productType === 'cart') return 'cost_per_cart';
        if (productType === 'pre-roll' || productType === 'preroll') return 'cost_per_gram';
        return 'cost_per_gram';
    }
    if (mode === 'nicotine' || productType === 'vape') return 'cost_per_vape';
    if (mode === 'powder' || unit === 'g' || unit === 'gram' || unit === 'grams') return 'cost_per_gram';
    if (mode === 'xanax' || unit === 'pill' || unit === 'pills') return 'cost_per_pill';
    if (mode === 'lsd' || unit === 'tab' || unit === 'tabs') return 'cost_per_tab';
    return `cost_per_${unit || 'unit'}`;
}

function purchaseAnalyticsPriceQuantity(purchase, metricKey) {
    if (metricKey === 'cost_per_thc_mg') return paToNumber(purchase?.totalThcMg ?? purchase?.thcMg, 0);
    if (metricKey === 'cost_per_edible') {
        return paToNumber(purchase?.edibleCount ?? purchase?.quantityBought ?? purchase?.quantity, 0);
    }
    if (metricKey === 'cost_per_cart' || metricKey === 'cost_per_vape') {
        return Math.max(1, paToNumber(purchase?.quantityBought ?? purchase?.quantity ?? 1, 1));
    }
    return purchaseAnalyticsQuantity(purchase);
}

function normalizePurchaseAnalyticsFilters(filters = null, data = appData) {
    const prefs = ensurePurchaseAnalyticsPrefs(data);
    const base = { ...prefs.filters, ...(filters || {}) };
    if (!base.substanceId) base.substanceId = paAllSubstancesId();
    if (!base.dateRangePreset) base.dateRangePreset = 'last-30';
    return base;
}

function resolvePurchaseAnalyticsBounds(filters = null, data = appData) {
    const f = normalizePurchaseAnalyticsFilters(filters, data);
    if (typeof resolveFinancialBounds === 'function') {
        return resolveFinancialBounds({
            dateRangePreset: f.dateRangePreset,
            customStart: f.customStart,
            customEnd: f.customEnd
        }, data);
    }
    const today = paToday();
    return {
        startDate: f.customStart || today,
        endDate: f.customEnd || today,
        preset: f.dateRangePreset,
        label: f.dateRangePreset,
        incomplete: false
    };
}

function purchaseAnalyticsMatchesFilters(purchase, filters, data = appData) {
    if (!purchase) return false;
    const f = normalizePurchaseAnalyticsFilters(filters, data);
    const substanceId = purchase.substanceId;
    if (f.substanceId && f.substanceId !== paAllSubstancesId()) {
        if (typeof financialMatchesSubstance === 'function') {
            if (!financialMatchesSubstance(substanceId, f.substanceId, data)) return false;
        } else if (String(substanceId) !== String(f.substanceId)) return false;
    }
    if (f.productType && paKey(purchaseAnalyticsProductType(purchase)) !== paKey(f.productType)) return false;
    if (f.store && paKey(purchaseAnalyticsStore(purchase)) !== paKey(f.store)) return false;
    if (f.supplier && paKey(purchaseAnalyticsSupplier(purchase)) !== paKey(f.supplier)) return false;
    if (f.paymentMethod && paKey(purchase.paymentMethod || '') !== paKey(f.paymentMethod)) return false;
    if (f.acquisitionType && purchaseAnalyticsAcquisitionType(purchase) !== f.acquisitionType) return false;
    if (f.giftStatus === 'purchased_as_gift' && !purchaseAnalyticsIsPurchasedAsGift(purchase)) return false;
    if (f.giftStatus === 'gift_received' && !purchaseAnalyticsIsGiftReceived(purchase)) return false;
    if (f.giftStatus === 'not_gift' && (purchaseAnalyticsIsPurchasedAsGift(purchase) || purchaseAnalyticsIsGiftReceived(purchase))) return false;

    const spend = purchaseAnalyticsSpendAmount(purchase);
    const qty = purchaseAnalyticsQuantity(purchase);
    if (f.minCost !== '' && spend < paToNumber(f.minCost, 0)) return false;
    if (f.maxCost !== '' && spend > paToNumber(f.maxCost, Infinity)) return false;
    if (f.minQuantity !== '' && qty < paToNumber(f.minQuantity, 0)) return false;
    if (f.maxQuantity !== '' && qty > paToNumber(f.maxQuantity, Infinity)) return false;
    return true;
}

function getPurchaseAnalyticsPurchases(filters = null, data = appData) {
    const f = normalizePurchaseAnalyticsFilters(filters, data);
    const bounds = resolvePurchaseAnalyticsBounds(f, data);
    const seen = new Set();
    const list = [];
    (data.purchases || []).forEach(p => {
        if (!p || !p.id || seen.has(p.id)) return;
        const date = paTrim(p.date);
        if (!date) return;
        if (bounds.startDate && date < bounds.startDate) return;
        if (bounds.endDate && date > bounds.endDate) return;
        if (!purchaseAnalyticsMatchesFilters(p, f, data)) return;
        seen.add(p.id);
        list.push(p);
    });
    list.sort((a, b) => {
        const d = String(a.date).localeCompare(String(b.date));
        if (d !== 0) return d;
        return String(a.time || '').localeCompare(String(b.time || ''));
    });
    return list;
}

function getPurchaseAnalyticsSpendPurchases(filters = null, data = appData) {
    return getPurchaseAnalyticsPurchases(filters, data).filter(purchaseAnalyticsCountsTowardSpend);
}

function buildPurchaseFrequencyMetrics(purchases = []) {
    const dates = [...new Set(purchases.map(p => p.date).filter(Boolean))].sort();
    const gaps = [];
    for (let i = 1; i < dates.length; i += 1) {
        const gap = paDaysBetween(dates[i - 1], dates[i]);
        if (gap != null && gap >= 0) gaps.push(gap);
    }
    const byDay = {};
    const byWeek = {};
    const byMonth = {};
    const byYear = {};
    purchases.forEach(p => {
        const d = p.date;
        if (!d) return;
        byDay[d] = (byDay[d] || 0) + 1;
        const weekKey = typeof getIsoWeekKey === 'function'
            ? getIsoWeekKey(d)
            : d.slice(0, 7);
        byWeek[weekKey] = (byWeek[weekKey] || 0) + 1;
        const monthKey = d.slice(0, 7);
        byMonth[monthKey] = (byMonth[monthKey] || 0) + 1;
        const yearKey = d.slice(0, 4);
        byYear[yearKey] = (byYear[yearKey] || 0) + 1;
    });

    let longestNoPurchase = 0;
    if (dates.length) {
        for (let i = 1; i < dates.length; i += 1) {
            const gap = paDaysBetween(dates[i - 1], dates[i]);
            if (gap != null) longestNoPurchase = Math.max(longestNoPurchase, Math.max(0, gap - 1));
        }
        const sinceLast = paDaysBetween(dates[dates.length - 1], paToday());
        if (sinceLast != null) longestNoPurchase = Math.max(longestNoPurchase, Math.max(0, sinceLast));
    }

    const weekCount = Object.keys(byWeek).length || 1;
    const monthCount = Object.keys(byMonth).length || 1;

    return {
        byDay,
        byWeek,
        byMonth,
        byYear,
        averagePurchasesPerWeek: paRound(purchases.length / weekCount, 2),
        averagePurchasesPerMonth: paRound(purchases.length / monthCount, 2),
        averageDaysBetweenPurchases: paRound(paMean(gaps), 2),
        longestNoPurchaseStreak: longestNoPurchase,
        shortestIntervalDays: gaps.length ? Math.min(...gaps) : null,
        purchaseCount: purchases.length,
        uniquePurchaseDays: dates.length
    };
}

function buildPurchaseDashboardMetrics(purchases = [], data = appData, bounds = null) {
    const spendPurchases = purchases.filter(purchaseAnalyticsCountsTowardSpend);
    const spends = spendPurchases.map(purchaseAnalyticsSpendAmount);
    const qtys = spendPurchases.map(purchaseAnalyticsQuantity).filter(q => q > 0);
    const totalSpent = spends.reduce((s, n) => s + n, 0);
    const totalQty = qtys.reduce((s, n) => s + n, 0);
    const freq = buildPurchaseFrequencyMetrics(spendPurchases);
    const suppliers = new Set(purchases.map(purchaseAnalyticsSupplier).filter(Boolean));
    const stores = new Set(purchases.map(purchaseAnalyticsStore).filter(Boolean));

    let activeInventoryValue = 0;
    (data.purchases || []).forEach(p => {
        if (!purchaseAnalyticsIsUsableInventory(p)) return;
        const rem = purchaseAnalyticsRemaining(p);
        const qty = purchaseAnalyticsQuantity(p);
        const spend = purchaseAnalyticsSpendAmount(p);
        if (rem > 0 && qty > 0 && spend > 0) activeInventoryValue += spend * (rem / qty);
        else if (rem > 0 && typeof p.costPerUnit === 'number') activeInventoryValue += rem * p.costPerUnit;
    });

    const turnover = buildInventoryTurnoverMetrics(purchases, data, bounds);

    return {
        totalPurchases: purchases.length,
        spendPurchaseCount: spendPurchases.length,
        totalSpent: paRound(totalSpent, 2),
        averagePurchaseSize: paRound(paMean(spends), 2),
        medianPurchaseSize: paRound(paMedian(spends), 2),
        averageCostPerUnit: totalQty > 0 ? paRound(totalSpent / totalQty, 4) : null,
        averageDaysBetweenPurchases: freq.averageDaysBetweenPurchases,
        largestPurchase: spends.length ? paRound(Math.max(...spends), 2) : null,
        smallestPurchase: spends.length ? paRound(Math.min(...spends), 2) : null,
        activeSuppliers: suppliers.size,
        activeStores: stores.size,
        activeInventoryValue: paRound(activeInventoryValue, 2),
        inventoryTurnoverRate: turnover.turnoverRate
    };
}

function buildSupplierAnalytics(purchases = [], data = appData) {
    const map = new Map();
    purchases.forEach(p => {
        const name = purchaseAnalyticsSupplier(p) || 'Unknown';
        const key = paKey(name);
        if (!map.has(key)) {
            map.set(key, {
                id: key,
                name,
                purchases: [],
                totalSpent: 0,
                totalQty: 0,
                substances: {},
                productTypes: {},
                notes: ''
            });
        }
        const row = map.get(key);
        row.purchases.push(p);
        if (purchaseAnalyticsCountsTowardSpend(p)) {
            const spend = purchaseAnalyticsSpendAmount(p);
            const qty = purchaseAnalyticsQuantity(p);
            row.totalSpent += spend;
            if (qty > 0) row.totalQty += qty;
        }
        const sid = p.substanceId || 'unknown';
        row.substances[sid] = (row.substances[sid] || 0) + 1;
        const pt = purchaseAnalyticsProductType(p) || 'n/a';
        row.productTypes[pt] = (row.productTypes[pt] || 0) + 1;
    });

    const today = paToday();
    return [...map.values()].map(row => {
        const dates = row.purchases.map(p => p.date).filter(Boolean).sort();
        const freq = buildPurchaseFrequencyMetrics(row.purchases.filter(purchaseAnalyticsCountsTowardSpend));
        const topSubstance = Object.entries(row.substances).sort((a, b) => b[1] - a[1])[0]?.[0] || '';
        const topProduct = Object.entries(row.productTypes).sort((a, b) => b[1] - a[1])[0]?.[0] || '';
        const last = dates[dates.length - 1] || '';
        const daysSince = last ? paDaysBetween(last, today) : null;
        const completeness = row.purchases.filter(p => purchaseAnalyticsStore(p) && purchaseAnalyticsSpendAmount(p) > 0).length / Math.max(1, row.purchases.length);
        const reliabilityScore = paRound(Math.min(100, (
            (freq.averageDaysBetweenPurchases != null ? 40 : 20)
            + completeness * 40
            + Math.min(20, row.purchases.length * 2)
            - Math.min(30, (daysSince || 0) > 90 ? 20 : 0)
        )), 0);
        return {
            id: row.id,
            name: row.name,
            totalPurchases: row.purchases.length,
            totalSpent: paRound(row.totalSpent, 2),
            averagePurchase: row.purchases.length ? paRound(row.totalSpent / row.purchases.filter(purchaseAnalyticsCountsTowardSpend).length || 1, 2) : null,
            averageCostPerUnit: row.totalQty > 0 ? paRound(row.totalSpent / row.totalQty, 4) : null,
            mostPurchasedSubstance: topSubstance
                ? (typeof getSubstanceDisplayName === 'function' ? getSubstanceDisplayName(topSubstance, data) : topSubstance)
                : '—',
            mostPurchasedProductType: topProduct,
            firstPurchase: dates[0] || '',
            lastPurchase: last,
            purchaseFrequencyDays: freq.averageDaysBetweenPurchases,
            reliabilityScore,
            notes: row.notes,
            status: daysSince != null && daysSince > 90 ? 'inactive' : 'active'
        };
    }).sort((a, b) => b.totalSpent - a.totalSpent);
}

function buildStoreAnalytics(purchases = [], data = appData) {
    const prefs = ensurePurchaseAnalyticsPrefs(data);
    const map = new Map();
    purchases.forEach(p => {
        const name = purchaseAnalyticsStore(p) || 'Unknown';
        const key = paKey(name);
        if (!map.has(key)) {
            map.set(key, {
                id: key,
                name,
                purchases: [],
                totalSpent: 0,
                totalQty: 0,
                products: {}
            });
        }
        const row = map.get(key);
        row.purchases.push(p);
        if (purchaseAnalyticsCountsTowardSpend(p)) {
            row.totalSpent += purchaseAnalyticsSpendAmount(p);
            const qty = purchaseAnalyticsQuantity(p);
            if (qty > 0) row.totalQty += qty;
        }
        const product = purchaseAnalyticsProductType(p)
            || (typeof getSubstanceDisplayName === 'function' ? getSubstanceDisplayName(p.substanceId, data) : p.substanceId)
            || 'n/a';
        row.products[product] = (row.products[product] || 0) + 1;
    });

    return [...map.values()].map(row => {
        const dates = row.purchases.map(p => p.date).filter(Boolean).sort();
        const topProduct = Object.entries(row.products).sort((a, b) => b[1] - a[1])[0]?.[0] || '—';
        const spendCount = row.purchases.filter(purchaseAnalyticsCountsTowardSpend).length || 1;
        return {
            id: row.id,
            name: row.name,
            totalSpent: paRound(row.totalSpent, 2),
            purchaseCount: row.purchases.length,
            averageCost: paRound(row.totalSpent / spendCount, 2),
            mostCommonProduct: topProduct,
            averageCostPerUnit: row.totalQty > 0 ? paRound(row.totalSpent / row.totalQty, 4) : null,
            lastVisit: dates[dates.length - 1] || '',
            distance: prefs.storeDistances[row.id] ?? prefs.storeDistances[row.name] ?? null,
            favorite: prefs.favoriteStores.some(s => paKey(s) === row.id || paKey(s) === paKey(row.name))
        };
    }).sort((a, b) => b.totalSpent - a.totalSpent);
}

function buildPriceTrackingMetrics(purchases = [], data = appData) {
    const points = [];
    purchases.filter(purchaseAnalyticsCountsTowardSpend).forEach(p => {
        const metricKey = purchaseAnalyticsPriceMetricKey(p, data);
        const qty = purchaseAnalyticsPriceQuantity(p, metricKey);
        const spend = purchaseAnalyticsSpendAmount(p);
        if (!(qty > 0) || !(spend >= 0)) return;
        points.push({
            id: p.id,
            date: p.date,
            substanceId: p.substanceId,
            productType: purchaseAnalyticsProductType(p),
            store: purchaseAnalyticsStore(p),
            supplier: purchaseAnalyticsSupplier(p),
            metricKey,
            unitPrice: spend / qty,
            quantity: qty,
            spend
        });
    });

    const byMetric = {};
    points.forEach(pt => {
        if (!byMetric[pt.metricKey]) byMetric[pt.metricKey] = [];
        byMetric[pt.metricKey].push(pt);
    });

    const series = Object.entries(byMetric).map(([metricKey, list]) => {
        const sorted = list.slice().sort((a, b) => String(a.date).localeCompare(String(b.date)));
        const monthly = {};
        sorted.forEach(pt => {
            const m = String(pt.date).slice(0, 7);
            if (!monthly[m]) monthly[m] = { spend: 0, qty: 0 };
            monthly[m].spend += pt.spend;
            monthly[m].qty += pt.quantity;
        });
        const monthlyAvg = Object.entries(monthly)
            .sort((a, b) => a[0].localeCompare(b[0]))
            .map(([month, v]) => ({ month, average: v.qty > 0 ? v.spend / v.qty : null }));

        let inflation = null;
        if (monthlyAvg.length >= 2) {
            const first = monthlyAvg[0].average;
            const last = monthlyAvg[monthlyAvg.length - 1].average;
            if (first > 0 && last != null) inflation = (last - first) / first;
        }

        const bySupplier = {};
        const byStore = {};
        sorted.forEach(pt => {
            if (pt.supplier) {
                if (!bySupplier[pt.supplier]) bySupplier[pt.supplier] = { spend: 0, qty: 0 };
                bySupplier[pt.supplier].spend += pt.spend;
                bySupplier[pt.supplier].qty += pt.quantity;
            }
            if (pt.store) {
                if (!byStore[pt.store]) byStore[pt.store] = { spend: 0, qty: 0 };
                byStore[pt.store].spend += pt.spend;
                byStore[pt.store].qty += pt.quantity;
            }
        });
        const cheapestSupplier = Object.entries(bySupplier)
            .map(([name, v]) => ({ name, unitPrice: v.qty > 0 ? v.spend / v.qty : null }))
            .filter(x => x.unitPrice != null)
            .sort((a, b) => a.unitPrice - b.unitPrice)[0] || null;
        const cheapestStore = Object.entries(byStore)
            .map(([name, v]) => ({ name, unitPrice: v.qty > 0 ? v.spend / v.qty : null }))
            .filter(x => x.unitPrice != null)
            .sort((a, b) => a.unitPrice - b.unitPrice)[0] || null;
        const highest = sorted.slice().sort((a, b) => b.unitPrice - a.unitPrice)[0] || null;

        return {
            metricKey,
            label: metricKey.replace(/_/g, ' '),
            points: sorted.map(pt => ({ date: pt.date, unitPrice: paRound(pt.unitPrice, 4), store: pt.store, supplier: pt.supplier })),
            monthlyAverage: monthlyAvg.map(m => ({ ...m, average: paRound(m.average, 4) })),
            cheapestSupplier: cheapestSupplier ? { ...cheapestSupplier, unitPrice: paRound(cheapestSupplier.unitPrice, 4) } : null,
            cheapestStore: cheapestStore ? { ...cheapestStore, unitPrice: paRound(cheapestStore.unitPrice, 4) } : null,
            highestPrice: highest ? { date: highest.date, unitPrice: paRound(highest.unitPrice, 4), store: highest.store, supplier: highest.supplier } : null,
            inflationRate: inflation != null ? paRound(inflation, 4) : null
        };
    });

    return { points, series };
}

function buildPurchasePatternMetrics(purchases = []) {
    const spendPurchases = purchases.filter(purchaseAnalyticsCountsTowardSpend);
    const weekdayCounts = Array(7).fill(0);
    const hourBuckets = { morning: 0, afternoon: 0, evening: 0, night: 0 };
    const amounts = [];
    const spends = [];

    spendPurchases.forEach(p => {
        const d = typeof parseLocalDate === 'function' ? parseLocalDate(p.date) : null;
        if (d) weekdayCounts[d.getDay()] += 1;
        const time = paTrim(p.time || '12:00');
        const hour = paToNumber(time.split(':')[0], 12);
        if (hour >= 5 && hour < 12) hourBuckets.morning += 1;
        else if (hour >= 12 && hour < 17) hourBuckets.afternoon += 1;
        else if (hour >= 17 && hour < 22) hourBuckets.evening += 1;
        else hourBuckets.night += 1;
        amounts.push(purchaseAnalyticsQuantity(p));
        spends.push(purchaseAnalyticsSpendAmount(p));
    });

    const preferredDayIdx = weekdayCounts.indexOf(Math.max(...weekdayCounts));
    const preferredTime = Object.entries(hourBuckets).sort((a, b) => b[1] - a[1])[0]?.[0] || '—';
    const avgSpend = paMean(spends) || 0;
    const avgAmount = paMean(amounts) || 0;
    const spikes = spendPurchases.filter(p => purchaseAnalyticsSpendAmount(p) >= avgSpend * 2);
    const bulk = spendPurchases.filter(p => purchaseAnalyticsQuantity(p) >= avgAmount * 1.75 && avgAmount > 0);
    const freq = buildPurchaseFrequencyMetrics(spendPurchases);
    const emergency = spendPurchases.filter((p, i, arr) => {
        if (i === 0) return false;
        const gap = paDaysBetween(arr[i - 1].date, p.date);
        return gap != null && gap <= 1 && purchaseAnalyticsSpendAmount(p) > avgSpend;
    });

    return {
        preferredPurchaseDays: weekdayCounts
            .map((count, idx) => ({ day: PURCHASE_ANALYTICS_WEEKDAYS[idx], count }))
            .filter(x => x.count > 0)
            .sort((a, b) => b.count - a.count),
        preferredPurchaseDay: weekdayCounts.some(c => c > 0) ? PURCHASE_ANALYTICS_WEEKDAYS[preferredDayIdx] : '—',
        preferredPurchaseTimes: hourBuckets,
        preferredPurchaseTime: preferredTime,
        typicalPurchaseAmount: paRound(avgAmount, 3),
        typicalSpending: paRound(avgSpend, 2),
        purchaseCycleDays: freq.averageDaysBetweenPurchases,
        purchaseSpikes: spikes.map(p => ({ id: p.id, date: p.date, spend: purchaseAnalyticsSpendAmount(p) })),
        bulkBuying: bulk.map(p => ({ id: p.id, date: p.date, quantity: purchaseAnalyticsQuantity(p) })),
        emergencyPurchases: emergency.map(p => ({ id: p.id, date: p.date, spend: purchaseAnalyticsSpendAmount(p) }))
    };
}

function buildInventoryTurnoverMetrics(purchases = [], data = appData, bounds = null) {
    const usable = (data.purchases || []).filter(purchaseAnalyticsIsUsableInventory);
    let purchasedQty = 0;
    let remainingQty = 0;
    let consumed = 0;
    let gifted = 0;
    let adjusted = 0;
    let waste = 0;

    usable.forEach(p => {
        const bought = purchaseAnalyticsQuantity(p);
        const rem = purchaseAnalyticsRemaining(p);
        purchasedQty += bought;
        remainingQty += Math.max(0, rem);
        const used = Math.max(0, bought - Math.max(0, rem));
        consumed += used;
    });

    (data.logs || []).forEach(log => {
        if (bounds?.startDate && log.date < bounds.startDate) return;
        if (bounds?.endDate && log.date > bounds.endDate) return;
        const amount = paToNumber(log.amount ?? log.quantity, 0);
        if (typeof isGiftGivenLog === 'function' && isGiftGivenLog(log)) gifted += Math.abs(amount);
        else if (typeof isInventoryAdjustmentLog === 'function' && isInventoryAdjustmentLog(log)) {
            if (typeof inventoryAdjustmentRemoves === 'function' && inventoryAdjustmentRemoves(log)) adjusted += Math.abs(amount);
            else adjusted += Math.abs(amount);
        }
    });

    // Approximate waste as adjustments that remove stock beyond normal use tracking
    waste = Math.max(0, adjusted);

    const daysInRange = bounds?.startDate && bounds?.endDate
        ? Math.max(1, (paDaysBetween(bounds.startDate, bounds.endDate) || 0) + 1)
        : 30;
    const depletionRate = consumed / daysInRange;
    const daysInventoryLasts = depletionRate > 0 ? remainingQty / depletionRate : null;
    const purchaseInterval = buildPurchaseFrequencyMetrics(
        purchases.filter(purchaseAnalyticsCountsTowardSpend)
    ).averageDaysBetweenPurchases;
    const turnoverRate = purchasedQty > 0 ? paRound(consumed / purchasedQty, 4) : null;

    return {
        daysInventoryLasts: daysInventoryLasts != null ? paRound(daysInventoryLasts, 1) : null,
        averageDepletionRate: paRound(depletionRate, 4),
        averagePurchaseInterval: purchaseInterval,
        inventoryWaste: paRound(waste, 3),
        inventoryGifted: paRound(gifted, 3),
        inventoryAdjusted: paRound(adjusted, 3),
        inventoryConsumed: paRound(consumed, 3),
        inventoryRemaining: paRound(remainingQty, 3),
        turnoverRate
    };
}

function buildProductAnalytics(purchases = [], data = appData) {
    const map = new Map();
    purchases.forEach(p => {
        const productType = purchaseAnalyticsProductType(p) || 'unspecified';
        const key = paKey(productType);
        if (!map.has(key)) {
            map.set(key, {
                productType,
                purchases: [],
                spent: 0,
                qty: 0,
                durations: []
            });
        }
        const row = map.get(key);
        row.purchases.push(p);
        if (purchaseAnalyticsCountsTowardSpend(p)) {
            row.spent += purchaseAnalyticsSpendAmount(p);
            const q = purchaseAnalyticsQuantity(p);
            if (q > 0) row.qty += q;
        }
    });

    return [...map.values()].map(row => {
        const freq = buildPurchaseFrequencyMetrics(row.purchases.filter(purchaseAnalyticsCountsTowardSpend));
        const spendCount = row.purchases.filter(purchaseAnalyticsCountsTowardSpend).length || 1;
        return {
            productType: row.productType,
            purchaseFrequency: freq.averagePurchasesPerMonth,
            spending: paRound(row.spent, 2),
            averagePrice: paRound(row.spent / spendCount, 2),
            averageAmount: row.qty > 0 ? paRound(row.qty / spendCount, 3) : null,
            averageDurationDays: freq.averageDaysBetweenPurchases,
            inventoryLifespanDays: freq.averageDaysBetweenPurchases
        };
    }).sort((a, b) => b.spending - a.spending);
}

function buildPurchaseAnalyticsCharts(purchases = [], suppliers = [], stores = [], products = [], price = null, frequency = null) {
    const supplierSpend = suppliers.slice(0, 8).map(s => ({ label: s.name, value: s.totalSpent }));
    const storeSpend = stores.slice(0, 8).map(s => ({ label: s.name, value: s.totalSpent }));
    const productSpend = products.slice(0, 8).map(p => ({ label: p.productType, value: p.spending }));
    const timeline = Object.entries(frequency?.byDay || {}).map(([date, count]) => ({ label: date, value: count }));
    const monthlyHeat = Object.entries(frequency?.byMonth || {}).map(([month, count]) => ({ label: month, value: count }));
    const priceTrend = (price?.series?.[0]?.points || []).map(pt => ({ label: pt.date, value: pt.unitPrice }));
    const avgSizeSeries = Object.entries(frequency?.byMonth || {}).map(([month]) => {
        const monthPurchases = purchases.filter(p => String(p.date).startsWith(month) && purchaseAnalyticsCountsTowardSpend(p));
        const avg = paMean(monthPurchases.map(purchaseAnalyticsSpendAmount));
        return { label: month, value: avg == null ? 0 : avg };
    });

    return {
        spendingBySupplier: supplierSpend,
        spendingByStore: storeSpend,
        spendingByProduct: productSpend,
        purchaseTimeline: timeline,
        monthlyPurchaseHeatmap: monthlyHeat,
        priceTrend,
        averagePurchaseSize: avgSizeSeries
    };
}

function buildPurchaseAnalyticsDataset(data = appData, options = {}) {
    const prefs = ensurePurchaseAnalyticsPrefs(data);
    const filters = normalizePurchaseAnalyticsFilters(options.filters || prefs.filters, data);
    const bounds = resolvePurchaseAnalyticsBounds(filters, data);
    const cacheKey = JSON.stringify({
        filters,
        bounds,
        purchaseCount: (data.purchases || []).length,
        logCount: (data.logs || []).length,
        fav: prefs.favoriteStores,
        dist: prefs.storeDistances
    });
    if (!options.bypassCache && purchaseAnalyticsCache && purchaseAnalyticsCacheKey === cacheKey) {
        return purchaseAnalyticsCache;
    }

    const purchases = getPurchaseAnalyticsPurchases(filters, data);
    const dashboard = buildPurchaseDashboardMetrics(purchases, data, bounds);
    const frequency = buildPurchaseFrequencyMetrics(purchases.filter(purchaseAnalyticsCountsTowardSpend));
    const suppliers = buildSupplierAnalytics(purchases, data);
    const stores = buildStoreAnalytics(purchases, data);
    const price = buildPriceTrackingMetrics(purchases, data);
    const patterns = buildPurchasePatternMetrics(purchases);
    const turnover = buildInventoryTurnoverMetrics(purchases, data, bounds);
    const products = buildProductAnalytics(purchases, data);
    const charts = buildPurchaseAnalyticsCharts(purchases, suppliers, stores, products, price, frequency);

    const dataset = {
        generatedAt: new Date().toISOString(),
        filters,
        bounds,
        prefs,
        purchases,
        dashboard,
        frequency,
        suppliers,
        stores,
        price,
        patterns,
        turnover,
        products,
        charts
    };
    purchaseAnalyticsCache = dataset;
    purchaseAnalyticsCacheKey = cacheKey;
    return dataset;
}

function buildPurchaseAnalyticsCsvRows(dataset) {
    const rows = [];
    rows.push(['Section', 'Field', 'Value']);
    const d = dataset.dashboard || {};
    Object.entries(d).forEach(([k, v]) => rows.push(['Dashboard', k, v == null ? '' : v]));
    (dataset.suppliers || []).forEach(s => {
        rows.push(['Supplier', s.name, `spent=${s.totalSpent};count=${s.totalPurchases};cpu=${s.averageCostPerUnit ?? ''};status=${s.status}`]);
    });
    (dataset.stores || []).forEach(s => {
        rows.push(['Store', s.name, `spent=${s.totalSpent};count=${s.purchaseCount};favorite=${s.favorite ? 1 : 0}`]);
    });
    (dataset.price?.series || []).forEach(series => {
        series.points.forEach(pt => rows.push(['Price', series.metricKey, `${pt.date}:${pt.unitPrice}`]));
    });
    (dataset.products || []).forEach(p => {
        rows.push(['Product', p.productType, `spent=${p.spending};avgPrice=${p.averagePrice ?? ''}`]);
    });
    const t = dataset.turnover || {};
    Object.entries(t).forEach(([k, v]) => rows.push(['Turnover', k, v == null ? '' : v]));
    return rows;
}

function exportPurchaseAnalyticsCsv(data = appData) {
    const dataset = buildPurchaseAnalyticsDataset(data, { bypassCache: true });
    const rows = buildPurchaseAnalyticsCsvRows(dataset);
    const csv = rows.map(r => r.map(cell => {
        const s = String(cell ?? '');
        return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
    }).join(',')).join('\n');
    if (typeof downloadTextFile === 'function') {
        downloadTextFile(`purchase-analytics-${paToday()}.csv`, csv, 'text/csv');
    }
    return csv;
}

function paBarChartHtml(items, maxHint = null) {
    const list = (items || []).filter(i => i && (i.value != null));
    if (!list.length) return '<p class="pa-empty">No chart data for this range.</p>';
    const max = maxHint || Math.max(...list.map(i => paToNumber(i.value, 0)), 0.0001);
    return `<div class="pa-bar-chart">${list.slice(0, 12).map(item => {
        const v = paToNumber(item.value, 0);
        const pct = Math.max(2, Math.round((v / max) * 100));
        return `<div class="pa-bar-row"><span>${escapeHtml(item.label)}</span><div class="pa-bar-track"><span class="pa-bar-fill" style="width:${pct}%"></span></div><span>${escapeHtml(String(paRound(v, 2) ?? v))}</span></div>`;
    }).join('')}</div>`;
}

function paTableHtml(headers, rows) {
    if (!rows.length) return '<p class="pa-empty">No rows for this range.</p>';
    return `<div class="table-scroll"><table class="pa-table sheet-table"><thead><tr>${headers.map(h => `<th>${escapeHtml(h)}</th>`).join('')}</tr></thead><tbody>${rows.map(r => `<tr>${r.map(c => `<td>${c}</td>`).join('')}</tr>`).join('')}</tbody></table></div>`;
}

function renderPurchaseAnalyticsView() {
    const root = typeof document !== 'undefined' ? document.getElementById('purchase-analytics-root') : null;
    if (!root) return;
    root.innerHTML = '<div class="pa-loading" role="status">Loading purchase analytics…</div>';
    try {
        migratePurchaseAnalytics(appData);
        const dataset = buildPurchaseAnalyticsDataset(appData);
        const d = dataset.dashboard;
        const f = dataset.frequency;
        const t = dataset.turnover;
        const patterns = dataset.patterns;
        const prefs = dataset.prefs;
        const filters = dataset.filters;

        const substanceOptions = [
            `<option value="${escapeHtml(paAllSubstancesId())}"${filters.substanceId === paAllSubstancesId() ? ' selected' : ''}>All substances</option>`,
            ...(appData.substances || []).filter(s => s && s.active !== false).map(s =>
                `<option value="${escapeHtml(s.id)}"${String(filters.substanceId) === String(s.id) ? ' selected' : ''}>${escapeHtml(s.name || s.id)}</option>`
            )
        ].join('');

        const datePresets = (typeof FINANCIAL_DATE_PRESETS !== 'undefined' ? FINANCIAL_DATE_PRESETS : [
            { id: 'last-30', label: 'Last 30 days' },
            { id: 'this-month', label: 'This month' },
            { id: 'all-time', label: 'All time' },
            { id: 'custom', label: 'Custom range' }
        ]).map(p => `<option value="${p.id}"${filters.dateRangePreset === p.id ? ' selected' : ''}>${escapeHtml(p.label)}</option>`).join('');

        root.innerHTML = `
            <div class="pa-view">
                <div class="pa-toolbar">
                    <p class="settings-hint">Range: <strong>${escapeHtml(dataset.bounds.label || filters.dateRangePreset)}</strong>. Purchased as Gift counts as spending, not usable inventory. Gift Received never counts as spending.</p>
                    <button type="button" class="secondary-btn btn-sm" onclick="exportPurchaseAnalyticsCsv()">Export CSV</button>
                </div>
                <div class="pa-filters collapsible-section ${prefs.filtersCollapsed ? 'collapsed' : ''}" data-section="purchaseAnalyticsFilters">
                    <button type="button" class="section-toggle" onclick="toggleSection('purchaseAnalyticsFilters'); persistPurchaseAnalyticsPrefs({ filtersCollapsed: !getPurchaseAnalyticsPrefs().filtersCollapsed });">
                        <span>Filters</span><span class="chevron">⌄</span>
                    </button>
                    <div class="section-content pa-filters-grid">
                        <label>Substance<select id="pa-filter-substance" onchange="onPurchaseAnalyticsFilterChange()">${substanceOptions}</select></label>
                        <label>Date range<select id="pa-filter-range" onchange="onPurchaseAnalyticsFilterChange()">${datePresets}</select></label>
                        <label>Product type<input id="pa-filter-product" value="${escapeHtml(filters.productType || '')}" onchange="onPurchaseAnalyticsFilterChange()"></label>
                        <label>Store<input id="pa-filter-store" value="${escapeHtml(filters.store || '')}" onchange="onPurchaseAnalyticsFilterChange()"></label>
                        <label>Supplier<input id="pa-filter-supplier" value="${escapeHtml(filters.supplier || '')}" onchange="onPurchaseAnalyticsFilterChange()"></label>
                        <label>Payment<input id="pa-filter-payment" value="${escapeHtml(filters.paymentMethod || '')}" onchange="onPurchaseAnalyticsFilterChange()"></label>
                        <label>Acquisition
                            <select id="pa-filter-acquisition" onchange="onPurchaseAnalyticsFilterChange()">
                                <option value="">All</option>
                                <option value="purchased"${filters.acquisitionType === 'purchased' ? ' selected' : ''}>Purchased</option>
                                <option value="purchased_as_gift"${filters.acquisitionType === 'purchased_as_gift' ? ' selected' : ''}>Purchased as gift</option>
                                <option value="gift_received"${filters.acquisitionType === 'gift_received' ? ' selected' : ''}>Gift received</option>
                            </select>
                        </label>
                        <label>Gift status
                            <select id="pa-filter-gift" onchange="onPurchaseAnalyticsFilterChange()">
                                <option value="">All</option>
                                <option value="not_gift"${filters.giftStatus === 'not_gift' ? ' selected' : ''}>Not gift</option>
                                <option value="purchased_as_gift"${filters.giftStatus === 'purchased_as_gift' ? ' selected' : ''}>Purchased as gift</option>
                                <option value="gift_received"${filters.giftStatus === 'gift_received' ? ' selected' : ''}>Gift received</option>
                            </select>
                        </label>
                        <label>Min cost<input type="number" id="pa-filter-min-cost" value="${escapeHtml(filters.minCost || '')}" onchange="onPurchaseAnalyticsFilterChange()"></label>
                        <label>Max cost<input type="number" id="pa-filter-max-cost" value="${escapeHtml(filters.maxCost || '')}" onchange="onPurchaseAnalyticsFilterChange()"></label>
                        <label>Min qty<input type="number" id="pa-filter-min-qty" value="${escapeHtml(filters.minQuantity || '')}" onchange="onPurchaseAnalyticsFilterChange()"></label>
                        <label>Max qty<input type="number" id="pa-filter-max-qty" value="${escapeHtml(filters.maxQuantity || '')}" onchange="onPurchaseAnalyticsFilterChange()"></label>
                        <label class="pa-custom-dates ${filters.dateRangePreset === 'custom' ? '' : 'hidden'}">Start<input type="date" id="pa-filter-start" value="${escapeHtml(filters.customStart || '')}" onchange="onPurchaseAnalyticsFilterChange()"></label>
                        <label class="pa-custom-dates ${filters.dateRangePreset === 'custom' ? '' : 'hidden'}">End<input type="date" id="pa-filter-end" value="${escapeHtml(filters.customEnd || '')}" onchange="onPurchaseAnalyticsFilterChange()"></label>
                    </div>
                </div>

                <section class="pa-panel">
                    <h3>Purchase Dashboard</h3>
                    <div class="pa-summary-grid">
                        <article class="pa-card"><span>Total purchases</span><strong>${d.totalPurchases}</strong></article>
                        <article class="pa-card"><span>Total spent</span><strong>${paMoney(d.totalSpent)}</strong></article>
                        <article class="pa-card"><span>Average purchase size</span><strong>${paMoney(d.averagePurchaseSize)}</strong></article>
                        <article class="pa-card"><span>Median purchase size</span><strong>${paMoney(d.medianPurchaseSize)}</strong></article>
                        <article class="pa-card"><span>Average cost per unit</span><strong>${d.averageCostPerUnit == null ? '—' : paMoney(d.averageCostPerUnit, 4)}</strong></article>
                        <article class="pa-card"><span>Avg days between purchases</span><strong>${paNumberOrDash(d.averageDaysBetweenPurchases, 1)}</strong></article>
                        <article class="pa-card"><span>Largest purchase</span><strong>${paMoney(d.largestPurchase)}</strong></article>
                        <article class="pa-card"><span>Smallest purchase</span><strong>${paMoney(d.smallestPurchase)}</strong></article>
                        <article class="pa-card"><span>Active suppliers</span><strong>${d.activeSuppliers}</strong></article>
                        <article class="pa-card"><span>Active stores</span><strong>${d.activeStores}</strong></article>
                        <article class="pa-card"><span>Active inventory value</span><strong>${paMoney(d.activeInventoryValue)}</strong></article>
                        <article class="pa-card"><span>Inventory turnover rate</span><strong>${paNumberOrDash(d.inventoryTurnoverRate, 3)}</strong></article>
                    </div>
                </section>

                <section class="pa-panel">
                    <h3>Purchase Frequency</h3>
                    <div class="pa-summary-grid">
                        <article class="pa-card"><span>Avg purchases/week</span><strong>${paNumberOrDash(f.averagePurchasesPerWeek, 2)}</strong></article>
                        <article class="pa-card"><span>Avg purchases/month</span><strong>${paNumberOrDash(f.averagePurchasesPerMonth, 2)}</strong></article>
                        <article class="pa-card"><span>Longest no-purchase streak</span><strong>${paNumberOrDash(f.longestNoPurchaseStreak, 0)} days</strong></article>
                        <article class="pa-card"><span>Shortest interval</span><strong>${f.shortestIntervalDays == null ? '—' : `${f.shortestIntervalDays} days`}</strong></article>
                    </div>
                    ${paBarChartHtml(Object.entries(f.byMonth || {}).map(([label, value]) => ({ label, value })))}
                </section>

                <section class="pa-panel">
                    <h3>Supplier Analytics</h3>
                    ${paTableHtml(
                        ['Supplier', 'Purchases', 'Spent', 'Avg', 'Cost/unit', 'Top substance', 'Top product', 'First', 'Last', 'Freq (days)', 'Reliability', 'Status'],
                        (dataset.suppliers || []).map(s => [
                            escapeHtml(s.name),
                            String(s.totalPurchases),
                            escapeHtml(paMoney(s.totalSpent)),
                            escapeHtml(paMoney(s.averagePurchase)),
                            s.averageCostPerUnit == null ? '—' : escapeHtml(paMoney(s.averageCostPerUnit, 4)),
                            escapeHtml(s.mostPurchasedSubstance),
                            escapeHtml(s.mostPurchasedProductType),
                            escapeHtml(paDateLabel(s.firstPurchase)),
                            escapeHtml(paDateLabel(s.lastPurchase)),
                            paNumberOrDash(s.purchaseFrequencyDays, 1),
                            String(s.reliabilityScore ?? '—'),
                            escapeHtml(s.status)
                        ])
                    )}
                </section>

                <section class="pa-panel">
                    <h3>Store Analytics</h3>
                    ${paTableHtml(
                        ['Store', 'Spent', 'Count', 'Avg cost', 'Top product', 'Cost/unit', 'Last visit', 'Distance', 'Favorite'],
                        (dataset.stores || []).map(s => [
                            escapeHtml(s.name),
                            escapeHtml(paMoney(s.totalSpent)),
                            String(s.purchaseCount),
                            escapeHtml(paMoney(s.averageCost)),
                            escapeHtml(s.mostCommonProduct),
                            s.averageCostPerUnit == null ? '—' : escapeHtml(paMoney(s.averageCostPerUnit, 4)),
                            escapeHtml(paDateLabel(s.lastVisit)),
                            s.distance == null ? '—' : escapeHtml(String(s.distance)),
                            s.favorite ? '★' : '—'
                        ])
                    )}
                </section>

                <section class="pa-panel">
                    <h3>Price Tracking</h3>
                    ${(dataset.price.series || []).map(series => `
                        <div class="pa-price-block">
                            <h4>${escapeHtml(series.label)}</h4>
                            <p class="settings-hint">Cheapest supplier: <strong>${escapeHtml(series.cheapestSupplier?.name || '—')}</strong>
                            · Cheapest store: <strong>${escapeHtml(series.cheapestStore?.name || '—')}</strong>
                            · Inflation: <strong>${series.inflationRate == null ? '—' : `${paRound(series.inflationRate * 100, 1)}%`}</strong></p>
                            ${paBarChartHtml(series.monthlyAverage.map(m => ({ label: m.month, value: m.average || 0 })))}
                        </div>
                    `).join('') || '<p class="pa-empty">No priced purchases in this range.</p>'}
                </section>

                <section class="pa-panel">
                    <h3>Purchase Patterns</h3>
                    <div class="pa-summary-grid">
                        <article class="pa-card"><span>Preferred day</span><strong>${escapeHtml(patterns.preferredPurchaseDay)}</strong></article>
                        <article class="pa-card"><span>Preferred time</span><strong>${escapeHtml(patterns.preferredPurchaseTime)}</strong></article>
                        <article class="pa-card"><span>Typical amount</span><strong>${paNumberOrDash(patterns.typicalPurchaseAmount, 3)}</strong></article>
                        <article class="pa-card"><span>Typical spending</span><strong>${paMoney(patterns.typicalSpending)}</strong></article>
                        <article class="pa-card"><span>Cycle (days)</span><strong>${paNumberOrDash(patterns.purchaseCycleDays, 1)}</strong></article>
                        <article class="pa-card"><span>Spikes</span><strong>${patterns.purchaseSpikes.length}</strong></article>
                        <article class="pa-card"><span>Bulk buys</span><strong>${patterns.bulkBuying.length}</strong></article>
                        <article class="pa-card"><span>Emergency buys</span><strong>${patterns.emergencyPurchases.length}</strong></article>
                    </div>
                </section>

                <section class="pa-panel">
                    <h3>Inventory Turnover</h3>
                    <div class="pa-summary-grid">
                        <article class="pa-card"><span>Days inventory lasts</span><strong>${paNumberOrDash(t.daysInventoryLasts, 1)}</strong></article>
                        <article class="pa-card"><span>Avg depletion rate</span><strong>${paNumberOrDash(t.averageDepletionRate, 3)}/day</strong></article>
                        <article class="pa-card"><span>Avg purchase interval</span><strong>${paNumberOrDash(t.averagePurchaseInterval, 1)}</strong></article>
                        <article class="pa-card"><span>Consumed</span><strong>${paNumberOrDash(t.inventoryConsumed, 2)}</strong></article>
                        <article class="pa-card"><span>Gifted</span><strong>${paNumberOrDash(t.inventoryGifted, 2)}</strong></article>
                        <article class="pa-card"><span>Adjusted</span><strong>${paNumberOrDash(t.inventoryAdjusted, 2)}</strong></article>
                        <article class="pa-card"><span>Waste (est.)</span><strong>${paNumberOrDash(t.inventoryWaste, 2)}</strong></article>
                        <article class="pa-card"><span>Remaining</span><strong>${paNumberOrDash(t.inventoryRemaining, 2)}</strong></article>
                    </div>
                </section>

                <section class="pa-panel">
                    <h3>Product Analytics</h3>
                    ${paTableHtml(
                        ['Product type', 'Freq / month', 'Spending', 'Avg price', 'Avg amount', 'Avg duration', 'Lifespan'],
                        (dataset.products || []).map(p => [
                            escapeHtml(p.productType),
                            paNumberOrDash(p.purchaseFrequency, 2),
                            escapeHtml(paMoney(p.spending)),
                            escapeHtml(paMoney(p.averagePrice)),
                            paNumberOrDash(p.averageAmount, 3),
                            paNumberOrDash(p.averageDurationDays, 1),
                            paNumberOrDash(p.inventoryLifespanDays, 1)
                        ])
                    )}
                </section>

                <section class="pa-panel">
                    <h3>Charts</h3>
                    <h4>Spending by supplier</h4>${paBarChartHtml(dataset.charts.spendingBySupplier)}
                    <h4>Spending by store</h4>${paBarChartHtml(dataset.charts.spendingByStore)}
                    <h4>Spending by product</h4>${paBarChartHtml(dataset.charts.spendingByProduct)}
                    <h4>Purchase timeline</h4>${paBarChartHtml(dataset.charts.purchaseTimeline.slice(-14))}
                    <h4>Monthly purchase heatmap</h4>${paBarChartHtml(dataset.charts.monthlyPurchaseHeatmap)}
                    <h4>Price trend</h4>${paBarChartHtml(dataset.charts.priceTrend.slice(-14))}
                    <h4>Average purchase size</h4>${paBarChartHtml(dataset.charts.averagePurchaseSize)}
                </section>

            </div>
        `;
    } catch (err) {
        console.error('[purchase-analytics] render failed', err);
        root.innerHTML = `<div class="pa-error" role="alert"><p>Could not load Purchase Analytics.</p><p class="settings-hint">${escapeHtml(err?.message || String(err))}</p><button type="button" class="secondary-btn btn-sm" onclick="invalidatePurchaseAnalyticsCache(); renderPurchaseAnalyticsView();">Retry</button></div>`;
    }
}

function onPurchaseAnalyticsFilterChange() {
    const g = id => (typeof document !== 'undefined' ? document.getElementById(id)?.value : '') || '';
    persistPurchaseAnalyticsPrefs({
        filters: {
            substanceId: g('pa-filter-substance') || paAllSubstancesId(),
            dateRangePreset: g('pa-filter-range') || 'last-30',
            productType: g('pa-filter-product'),
            store: g('pa-filter-store'),
            supplier: g('pa-filter-supplier'),
            paymentMethod: g('pa-filter-payment'),
            acquisitionType: g('pa-filter-acquisition'),
            giftStatus: g('pa-filter-gift'),
            minCost: g('pa-filter-min-cost'),
            maxCost: g('pa-filter-max-cost'),
            minQuantity: g('pa-filter-min-qty'),
            maxQuantity: g('pa-filter-max-qty'),
            customStart: g('pa-filter-start'),
            customEnd: g('pa-filter-end')
        }
    });
    renderPurchaseAnalyticsView();
}

function purchaseHistoryInventoryLifespanLabel(purchase, data = appData) {
    try {
        if (typeof getPurchaseSupplyDurationMetrics === 'function') {
            const m = getPurchaseSupplyDurationMetrics(purchase, data);
            if (m?.supplyDurationLabel) return m.supplyDurationLabel;
        }
        if (typeof getBuyBreakMetricsForPurchase === 'function') {
            const m = getBuyBreakMetricsForPurchase(purchase);
            if (m?.supplyDurationLabel) return m.supplyDurationLabel;
        }
    } catch (_) { /* soft */ }
    return '—';
}

function purchaseHistoryGiftStatusLabel(purchase) {
    if (purchaseAnalyticsIsPurchasedAsGift(purchase)) return 'Purchased as gift';
    if (purchaseAnalyticsIsGiftReceived(purchase)) return 'Gift received';
    return '—';
}

function purchaseHistoryLinkedUsersLabel(purchase) {
    const parts = [
        purchase?.giftRecipient || purchase?.recipientName,
        purchase?.giftSource || purchase?.giverName,
        purchase?.sharedWith
    ].map(paTrim).filter(Boolean);
    return parts.length ? parts.join(', ') : '—';
}

function purchaseHistoryQualityRating(purchase) {
    const rating = paToNumber(purchase?.qualityRating ?? purchase?.purchaseQualityRating, NaN);
    if (Number.isFinite(rating)) return String(rating);
    return '—';
}
