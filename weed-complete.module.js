// ——— Complete Weed Support ———
// Normalized Weed/THC calculation layer for Bud, Cart, Edibles, and Pre-rolls.
// Spliced into app.js ahead of `const defaultData`. Never invents missing product types/strengths.

const WEED_PRODUCT_TYPES = Object.freeze(['bud', 'cart', 'edibles', 'pre-rolls']);

const WEED_COMPLETE_DEFAULTS = Object.freeze({
    gramsPerJoint: 0.35,
    gramsPerBowl: 0.25,
    enableBudHitsLogging: false,
    cartDefaultGrams: null
});

function getWeedCompletePrefs(data = appData) {
    if (!data?.settings || typeof data.settings !== 'object') return { ...WEED_COMPLETE_DEFAULTS };
    const raw = data.settings.weedComplete;
    if (!raw || typeof raw !== 'object') return { ...WEED_COMPLETE_DEFAULTS };
    return {
        gramsPerJoint: Number.isFinite(parseFloat(raw.gramsPerJoint)) ? parseFloat(raw.gramsPerJoint) : WEED_COMPLETE_DEFAULTS.gramsPerJoint,
        gramsPerBowl: Number.isFinite(parseFloat(raw.gramsPerBowl)) ? parseFloat(raw.gramsPerBowl) : WEED_COMPLETE_DEFAULTS.gramsPerBowl,
        enableBudHitsLogging: !!raw.enableBudHitsLogging,
        cartDefaultGrams: Number.isFinite(parseFloat(raw.cartDefaultGrams)) ? parseFloat(raw.cartDefaultGrams) : null
    };
}

function ensureWeedCompletePrefs(data = appData) {
    if (!data || typeof data !== 'object') return getWeedCompletePrefs();
    if (!data.settings || typeof data.settings !== 'object') data.settings = {};
    const prefs = getWeedCompletePrefs(data);
    data.settings.weedComplete = prefs;
    return prefs;
}

function weedNum(value, fallback = null) {
    const n = parseFloat(value);
    return Number.isFinite(n) ? n : fallback;
}

function weedRound(value, digits = 4) {
    const n = weedNum(value, null);
    if (n == null) return null;
    const f = 10 ** digits;
    return Math.round(n * f) / f;
}

function getRecordWeedProductType(record, { allowEmpty = true } = {}) {
    if (!record) return allowEmpty ? '' : 'bud';
    return normalizeWeedProductType(record.weedProductType || record.productType || '', { allowEmpty });
}

function weedPurchaseNeedsProductTypeReview(purchase, data = appData) {
    if (!purchase || !isWeedPurchase(purchase, data)) return false;
    return !getRecordWeedProductType(purchase, { allowEmpty: true });
}

function isWeedBudPurchase(purchase, data = appData) {
    return isWeedPurchase(purchase, data) && getRecordWeedProductType(purchase, { allowEmpty: true }) === 'bud';
}

function isWeedPreRollsPurchase(purchase, data = appData) {
    return isWeedPurchase(purchase, data) && getRecordWeedProductType(purchase, { allowEmpty: true }) === 'pre-rolls';
}

function isWeedBudLog(log, data = appData) {
    if (!log || !isWeedTrackingMode(getUseSubstanceId(log, data), data)) return false;
    return getRecordWeedProductType(log, { allowEmpty: true }) === 'bud';
}

function isWeedPreRollsLog(log, data = appData) {
    if (!log || !isWeedTrackingMode(getUseSubstanceId(log, data), data)) return false;
    return getRecordWeedProductType(log, { allowEmpty: true }) === 'pre-rolls';
}

// ——— Edibles CBD ———

function computeWeedEdibleTotalCbdMg(count, mgPerEdible) {
    const qty = weedNum(count, null);
    const mg = weedNum(mgPerEdible, null);
    if (qty == null || qty < 0 || mg == null || mg < 0) return null;
    return qty * mg;
}

function getWeedCbdMgPerEdible(purchase) {
    if (!purchase) return null;
    const n = weedNum(purchase.cbdMgPerEdible ?? purchase.mgCbdPerEdible, null);
    return n != null && n >= 0 ? n : null;
}

function getWeedEdibleTotalCbdMg(purchase) {
    if (!purchase) return null;
    const mgPer = getWeedCbdMgPerEdible(purchase);
    const count = typeof getPurchaseQuantityBought === 'function' ? getPurchaseQuantityBought(purchase) : weedNum(purchase.quantityBought, 0);
    if (mgPer != null) return computeWeedEdibleTotalCbdMg(count, mgPer);
    const stored = weedNum(purchase.totalCbdMg, null);
    return stored != null && stored >= 0 ? stored : null;
}

function getWeedEdibleRemainingCbdMg(purchase) {
    if (!purchase) return null;
    const mgPer = getWeedCbdMgPerEdible(purchase);
    if (mgPer != null) {
        const rem = typeof getPurchaseRemainingAmount === 'function' ? getPurchaseRemainingAmount(purchase) : weedNum(purchase.remainingAmount, 0);
        return computeWeedEdibleTotalCbdMg(rem, mgPer);
    }
    const stored = weedNum(purchase.remainingCbdMg, null);
    return stored != null && stored >= 0 ? stored : null;
}

function getWeedEdibleLogCbdUsed(log) {
    if (!log) return null;
    const fromField = weedNum(log.cbdMgUsed, null);
    if (fromField != null && fromField >= 0) return fromField;
    const amount = weedNum(log.amount, null);
    const mgPer = weedNum(log.cbdMgPerEdibleAtTimeOfUse, null);
    if (amount != null && mgPer != null && mgPer >= 0) return amount * mgPer;
    return null;
}

function syncWeedEdibleCbdFields(purchase) {
    if (typeof isWeedEdiblesPurchase === 'function' && !isWeedEdiblesPurchase(purchase)) return purchase;
    const count = typeof getPurchaseQuantityBought === 'function' ? getPurchaseQuantityBought(purchase) : weedNum(purchase.quantityBought, 0);
    const mgPer = getWeedCbdMgPerEdible(purchase);
    if (mgPer != null) {
        purchase.cbdMgPerEdible = mgPer;
        purchase.totalCbdMg = computeWeedEdibleTotalCbdMg(count, mgPer);
        const rem = typeof getPurchaseRemainingAmount === 'function' ? getPurchaseRemainingAmount(purchase) : weedNum(purchase.remainingAmount, 0);
        purchase.remainingCbdMg = computeWeedEdibleTotalCbdMg(rem, mgPer);
    }
    return purchase;
}

// ——— Bud joint / bowl / hits normalization ———

function getWeedBudEstimateGrams(unit, data = appData, override = null) {
    const prefs = getWeedCompletePrefs(data);
    const o = weedNum(override, null);
    if (o != null && o > 0) return o;
    const u = String(unit || '').toLowerCase();
    if (u === 'joints' || u === 'joint') return prefs.gramsPerJoint;
    if (u === 'bowls' || u === 'bowl') return prefs.gramsPerBowl;
    return null;
}

function computeWeedBudNormalizedGrams({ enteredAmount, unit, gramsPerUnit, data = appData } = {}) {
    const entered = weedNum(enteredAmount, null);
    if (entered == null || entered < 0) return { error: 'Enter a valid bud amount.' };
    const u = String(unit || 'grams').toLowerCase();
    if (u === 'grams' || u === 'g' || u === 'gram') {
        return {
            enteredAmount: entered,
            enteredUnit: 'grams',
            normalizedGrams: entered,
            amount: entered,
            unit: 'grams',
            estimate: false
        };
    }
    if (u === 'hits' || u === 'hit') {
        const prefs = getWeedCompletePrefs(data);
        if (!prefs.enableBudHitsLogging) {
            return { error: 'Hits logging is disabled. Enable it in Weed settings or log in grams.' };
        }
        // Hits are stored as entered measure; grams only when estimate provided.
        const gPer = weedNum(gramsPerUnit, null);
        if (gPer != null && gPer > 0) {
            const grams = entered * gPer;
            return {
                enteredAmount: entered,
                enteredUnit: 'hits',
                gramsPerUnitEstimate: gPer,
                normalizedGrams: grams,
                amount: grams,
                unit: 'grams',
                estimate: true
            };
        }
        return {
            enteredAmount: entered,
            enteredUnit: 'hits',
            normalizedGrams: null,
            amount: entered,
            unit: 'hits',
            estimate: true,
            needsReview: true
        };
    }
    if (u === 'joints' || u === 'joint' || u === 'bowls' || u === 'bowl') {
        const gPer = getWeedBudEstimateGrams(u, data, gramsPerUnit);
        if (!(gPer > 0)) return { error: 'Enter estimated grams per joint/bowl.' };
        const grams = entered * gPer;
        const enteredUnit = (u === 'joint' || u === 'joints') ? 'joints' : 'bowls';
        return {
            enteredAmount: entered,
            enteredUnit,
            gramsPerUnitEstimate: gPer,
            normalizedGrams: grams,
            amount: grams,
            unit: 'grams',
            estimate: true
        };
    }
    return {
        enteredAmount: entered,
        enteredUnit: u,
        normalizedGrams: entered,
        amount: entered,
        unit: u || 'grams',
        estimate: false
    };
}

function formatWeedBudUseSummary(log) {
    if (!log) return '—';
    const entered = weedNum(log.enteredAmount ?? log.originalEnteredAmount, null);
    const enteredUnit = String(log.enteredUnit || '').toLowerCase();
    const grams = weedNum(log.normalizedGrams ?? (log.unit === 'grams' || log.unit === 'g' ? log.amount : null), null);
    if (entered != null && (enteredUnit === 'joints' || enteredUnit === 'joint')) {
        const gLabel = grams != null ? ` · estimated ${typeof formatAmount === 'function' ? formatAmount(grams) : grams} g` : '';
        return `${typeof formatAmount === 'function' ? formatAmount(entered) : entered} joint${entered === 1 ? '' : 's'}${gLabel}`;
    }
    if (entered != null && (enteredUnit === 'bowls' || enteredUnit === 'bowl')) {
        const gLabel = grams != null ? ` · estimated ${typeof formatAmount === 'function' ? formatAmount(grams) : grams} g` : '';
        return `${typeof formatAmount === 'function' ? formatAmount(entered) : entered} bowl${entered === 1 ? '' : 's'}${gLabel}`;
    }
    if (entered != null && enteredUnit === 'hits') {
        return `${typeof formatAmount === 'function' ? formatAmount(entered) : entered} hits`;
    }
    const amt = weedNum(log.amount, null);
    if (amt != null) return `${typeof formatAmount === 'function' ? formatAmount(amt) : amt} g Bud`;
    return '—';
}

// ——— Pre-roll fractions ———

function computeWeedPreRollNormalized({ fractionOrCount, gramsPerPreRoll } = {}) {
    const amount = weedNum(fractionOrCount, null);
    if (amount == null || amount < 0) return { error: 'Enter pre-roll amount (count or fraction).' };
    const gPer = weedNum(gramsPerPreRoll, null);
    const normalizedGrams = gPer != null && gPer >= 0 ? amount * gPer : null;
    return {
        enteredAmount: amount,
        enteredUnit: 'pre-roll',
        amount,
        unit: 'pre-roll',
        gramsPerPreRollAtTimeOfUse: gPer,
        normalizedGrams,
        estimate: gPer != null
    };
}

function formatWeedPreRollUseSummary(log) {
    if (!log) return '—';
    const amount = weedNum(log.amount ?? log.enteredAmount, null);
    const grams = weedNum(log.normalizedGrams, null);
    if (amount == null) return '—';
    const amtLabel = typeof formatAmount === 'function' ? formatAmount(amount) : String(amount);
    if (grams != null) {
        const gLabel = typeof formatAmount === 'function' ? formatAmount(grams) : String(grams);
        return `${amtLabel} pre-roll · ${gLabel} g`;
    }
    return `${amtLabel} pre-roll`;
}

function getWeedPreRollGramsPer(purchase) {
    if (!purchase) return null;
    const n = weedNum(purchase.gramsPerPreRoll, null);
    return n != null && n > 0 ? n : null;
}

function syncWeedPreRollPurchaseFields(purchase) {
    if (!isWeedPreRollsPurchase(purchase)) return purchase;
    const count = weedNum(purchase.preRollCount, null);
    const gPer = getWeedPreRollGramsPer(purchase);
    if (count != null && gPer != null) {
        purchase.totalPreRollGrams = computeWeedTotalPreRollGrams(count, gPer);
    }
    const remCount = weedNum(purchase.remainingPreRollCount, null);
    if (remCount == null && count != null) {
        // If inventory stored as grams, derive remaining count when possible.
        if (gPer != null && purchase.unit === 'grams') {
            const remG = typeof getPurchaseRemainingAmount === 'function' ? getPurchaseRemainingAmount(purchase) : weedNum(purchase.remainingAmount, 0);
            purchase.remainingPreRollCount = gPer > 0 ? remG / gPer : null;
            purchase.remainingGrams = remG;
        } else {
            purchase.remainingPreRollCount = typeof getPurchaseRemainingAmount === 'function'
                ? getPurchaseRemainingAmount(purchase)
                : weedNum(purchase.remainingAmount, null);
        }
    } else if (remCount != null && gPer != null) {
        purchase.remainingGrams = remCount * gPer;
    }
    return purchase;
}

// ——— Cart calculations ———

function getWeedCartGramsCapacity(purchase) {
    if (!purchase) return null;
    const g = weedNum(purchase.cartGrams ?? purchase.gramsPerCart, null);
    if (g != null && g > 0) {
        const count = weedNum(purchase.cartCount, 1) || 1;
        return g * (count > 0 ? 1 : 1); // cartGrams is typically per cart / package total
    }
    return null;
}

function getWeedCartEstimatedGramsRemaining(purchase) {
    const capacity = getWeedCartGramsCapacity(purchase);
    const pct = typeof getWeedCartPercentRemaining === 'function'
        ? getWeedCartPercentRemaining(purchase)
        : weedNum(purchase?.remainingAmount, null);
    if (capacity == null || pct == null) return null;
    return weedRound(capacity * pct / 100, 4);
}

function getWeedCartCostPerPercent(purchase) {
    if (!purchase) return null;
    const cost = typeof getPurchaseTotalCost === 'function'
        ? weedNum(getPurchaseTotalCost(purchase), null)
        : weedNum(purchase.totalCost, null);
    if (cost == null || !(cost >= 0)) return null;
    return weedRound(cost / 100, 4);
}

function getWeedCartCostPerGram(purchase) {
    const capacity = getWeedCartGramsCapacity(purchase);
    const cost = typeof getPurchaseTotalCost === 'function'
        ? weedNum(getPurchaseTotalCost(purchase), null)
        : weedNum(purchase.totalCost, null);
    if (capacity == null || !(capacity > 0) || cost == null) return null;
    return weedRound(cost / capacity, 4);
}

function estimateWeedCartLifespanDays(purchase, logs = [], data = appData) {
    if (!purchase?.id) return null;
    const related = (logs || []).filter(l => {
        if (!isWeedCartPercentLog(l, data)) return false;
        const pid = typeof getLogPurchaseId === 'function' ? getLogPurchaseId(l) : (l.purchaseId || l.linkedPurchaseId);
        return String(pid || '') === String(purchase.id);
    });
    if (related.length < 2) {
        // Fallback: average %/day from first use date to today if one session exists
        if (!related.length) return null;
    }
    const uses = related
        .map(l => ({
            date: l.date,
            used: weedNum(l.estimatedPercentUsed ?? l.amount, 0) || 0
        }))
        .filter(r => r.date && r.used > 0)
        .sort((a, b) => String(a.date).localeCompare(String(b.date)));
    if (!uses.length) return null;
    const totalUsed = uses.reduce((s, u) => s + u.used, 0);
    const first = uses[0].date;
    const last = uses[uses.length - 1].date;
    const days = typeof chartDaysBetween === 'function'
        ? Math.max(1, (chartDaysBetween(first, last) || 0) + 1)
        : Math.max(1, uses.length);
    const avgPerDay = totalUsed / days;
    if (!(avgPerDay > 0)) return null;
    const remaining = typeof getWeedCartPercentRemaining === 'function'
        ? getWeedCartPercentRemaining(purchase)
        : weedNum(purchase.remainingAmount, 0);
    if (remaining == null) return null;
    return weedRound(remaining / avgPerDay, 2);
}

// ——— Shared use validation (product-specific measures) ———

function validateWeedSharedSplit({ total, personal, shared } = {}) {
    const t = weedNum(total, null);
    const p = weedNum(personal, null);
    const s = weedNum(shared, null);
    if (t == null || p == null || s == null) return { ok: false, reason: 'Enter total, personal, and shared amounts.' };
    if (t < 0 || p < 0 || s < 0) return { ok: false, reason: 'Amounts cannot be negative.' };
    if (Math.abs((p + s) - t) > 0.0001) {
        return { ok: false, reason: 'Personal amount + Shared amount must equal Total amount.' };
    }
    return { ok: true, total: t, personal: p, shared: s };
}

function getWeedNormalizedStatsAmount(log, data = appData) {
    if (!log) return 0;
    const type = getRecordWeedProductType(log, { allowEmpty: true });
    if (type === 'edibles') {
        const thc = typeof getWeedEdibleLogThcUsed === 'function' ? getWeedEdibleLogThcUsed(log) : null;
        if (thc != null) return thc;
        return weedNum(log.amount, 0) || 0;
    }
    if (type === 'cart') return weedNum(log.estimatedPercentUsed ?? log.amount, 0) || 0;
    if (type === 'bud') return weedNum(log.normalizedGrams ?? (log.unit === 'grams' || log.unit === 'g' ? log.amount : null), weedNum(log.amount, 0) || 0);
    if (type === 'pre-rolls') return weedNum(log.normalizedGrams ?? log.amount, 0) || 0;
    return typeof getLogStatsAmount === 'function' ? getLogStatsAmount(log) : weedNum(log.amount, 0) || 0;
}

function getWeedInventoryDeductionAmount(log, data = appData) {
    if (!log) return 0;
    const type = getRecordWeedProductType(log, { allowEmpty: true });
    if (type === 'bud') {
        return weedNum(log.normalizedGrams ?? log.amount, 0) || 0;
    }
    if (type === 'pre-rolls') {
        // Prefer count/fraction for count-tracked inventory; grams handled by sync helpers.
        return weedNum(log.amount, 0) || 0;
    }
    if (type === 'cart') return weedNum(log.estimatedPercentUsed ?? log.amount, 0) || 0;
    if (type === 'edibles') return weedNum(log.amount, 0) || 0;
    return typeof getLogInventoryDeductionAmount === 'function' ? getLogInventoryDeductionAmount(log) : weedNum(log.amount, 0) || 0;
}

// ——— Display ———

function formatWeedNormalizedUseSummary(log, data = appData) {
    if (!log) return '—';
    const type = getRecordWeedProductType(log, { allowEmpty: true });
    if (!type) return 'Needs review';
    if (type === 'cart') return typeof formatWeedCartUseSummary === 'function' ? formatWeedCartUseSummary(log) : '—';
    if (type === 'edibles') {
        const base = typeof formatWeedEdibleUseSummary === 'function' ? formatWeedEdibleUseSummary(log) : '—';
        const cbd = getWeedEdibleLogCbdUsed(log);
        if (cbd != null && cbd > 0) {
            const cbdLabel = typeof formatAmount === 'function' ? formatAmount(cbd) : String(cbd);
            return `${base} · ${cbdLabel} mg CBD`;
        }
        return base;
    }
    if (type === 'pre-rolls') return formatWeedPreRollUseSummary(log);
    if (type === 'bud') return formatWeedBudUseSummary(log);
    return '—';
}

// ——— Analytics ———

function buildWeedProductAnalytics(data = appData, options = {}) {
    const substanceId = options.substanceId || (typeof WEED_THC_ID !== 'undefined' ? WEED_THC_ID : 'weed-thc');
    const productType = options.productType ? normalizeWeedProductType(options.productType, { allowEmpty: true }) : '';
    const logs = (data.logs || []).filter(l => {
        if (!isWeedTrackingMode(getUseSubstanceId(l, data), data)) return false;
        if (productType && getRecordWeedProductType(l, { allowEmpty: true }) !== productType) return false;
        if (typeof logCountsTowardPersonalUseStats === 'function' && !logCountsTowardPersonalUseStats(l)) return false;
        return true;
    });
    const purchases = (data.purchases || []).filter(p => {
        if (!isWeedPurchase(p, data)) return false;
        if (productType && getRecordWeedProductType(p, { allowEmpty: true }) !== productType) return false;
        return true;
    });

    const byType = {
        bud: { gramsUsed: 0, useDays: new Set(), remainingGrams: 0, spend: 0, purchaseCount: 0, purchaseGrams: 0 },
        cart: { percentUsed: 0, sessions: 0, remainingPercent: 0, spend: 0, costPerPercentSamples: [], lifespanDays: [] },
        edibles: { edibleCountUsed: 0, thcMgUsed: 0, cbdMgUsed: 0, spend: 0, purchaseCount: 0 },
        'pre-rolls': { countUsed: 0, gramsUsed: 0, spend: 0, purchaseCount: 0 }
    };

    logs.forEach(log => {
        const type = getRecordWeedProductType(log, { allowEmpty: true });
        if (!type || !byType[type]) return;
        const personal = typeof getLogStatsAmount === 'function' ? getLogStatsAmount(log) : weedNum(log.amount, 0) || 0;
        if (type === 'bud') {
            const g = weedNum(log.normalizedGrams ?? (log.unit === 'grams' || log.unit === 'g' ? personal : null), personal) || 0;
            byType.bud.gramsUsed += g;
            if (log.date) byType.bud.useDays.add(log.date);
        } else if (type === 'cart') {
            byType.cart.percentUsed += weedNum(log.estimatedPercentUsed ?? personal, 0) || 0;
            byType.cart.sessions += 1;
        } else if (type === 'edibles') {
            byType.edibles.edibleCountUsed += personal;
            byType.edibles.thcMgUsed += weedNum(typeof getWeedEdibleLogThcUsed === 'function' ? getWeedEdibleLogThcUsed(log) : null, 0) || 0;
            byType.edibles.cbdMgUsed += weedNum(getWeedEdibleLogCbdUsed(log), 0) || 0;
        } else if (type === 'pre-rolls') {
            byType['pre-rolls'].countUsed += personal;
            byType['pre-rolls'].gramsUsed += weedNum(log.normalizedGrams, 0) || 0;
        }
    });

    purchases.forEach(p => {
        const type = getRecordWeedProductType(p, { allowEmpty: true });
        if (!type || !byType[type]) return;
        const cost = typeof getPurchaseSpendAmount === 'function'
            ? weedNum(getPurchaseSpendAmount(p), 0) || 0
            : weedNum(p.totalCost, 0) || 0;
        const acq = typeof getPurchaseAcquisitionType === 'function' ? getPurchaseAcquisitionType(p) : p.acquisitionType;
        const countsSpend = acq !== 'gift_received' && acq !== 'other_adjustment';
        if (type === 'bud') {
            byType.bud.remainingGrams += typeof getPurchaseRemainingAmount === 'function' ? (getPurchaseRemainingAmount(p) || 0) : 0;
            if (countsSpend) {
                byType.bud.spend += cost;
                byType.bud.purchaseCount += 1;
                byType.bud.purchaseGrams += weedNum(p.budGrams ?? p.quantityBought, 0) || 0;
            }
        } else if (type === 'cart') {
            if (typeof ensureWeedCartTracksPercent === 'function') ensureWeedCartTracksPercent(p);
            byType.cart.remainingPercent += typeof getWeedCartPercentRemaining === 'function' ? (getWeedCartPercentRemaining(p) || 0) : 0;
            if (countsSpend) {
                byType.cart.spend += cost;
                const cpp = getWeedCartCostPerPercent(p);
                if (cpp != null) byType.cart.costPerPercentSamples.push(cpp);
            }
            const life = estimateWeedCartLifespanDays(p, data.logs || [], data);
            if (life != null) byType.cart.lifespanDays.push(life);
        } else if (type === 'edibles') {
            if (countsSpend) {
                byType.edibles.spend += cost;
                byType.edibles.purchaseCount += 1;
            }
        } else if (type === 'pre-rolls') {
            if (countsSpend) {
                byType['pre-rolls'].spend += cost;
                byType['pre-rolls'].purchaseCount += 1;
            }
        }
    });

    const budDays = byType.bud.useDays.size || 0;
    return {
        substanceId,
        productType: productType || 'all',
        bud: {
            gramsUsed: weedRound(byType.bud.gramsUsed, 4),
            gramsPerUseDay: budDays ? weedRound(byType.bud.gramsUsed / budDays, 4) : null,
            remainingGrams: weedRound(byType.bud.remainingGrams, 4),
            costPerGram: byType.bud.purchaseGrams > 0 ? weedRound(byType.bud.spend / byType.bud.purchaseGrams, 4) : null,
            averagePurchaseSize: byType.bud.purchaseCount ? weedRound(byType.bud.purchaseGrams / byType.bud.purchaseCount, 4) : null
        },
        cart: {
            percentUsed: weedRound(byType.cart.percentUsed, 4),
            averagePercentPerSession: byType.cart.sessions ? weedRound(byType.cart.percentUsed / byType.cart.sessions, 4) : null,
            remainingPercent: weedRound(byType.cart.remainingPercent, 4),
            costPerPercent: byType.cart.costPerPercentSamples.length
                ? weedRound(byType.cart.costPerPercentSamples.reduce((s, v) => s + v, 0) / byType.cart.costPerPercentSamples.length, 4)
                : null,
            estimatedLifespanDays: byType.cart.lifespanDays.length
                ? weedRound(byType.cart.lifespanDays.reduce((s, v) => s + v, 0) / byType.cart.lifespanDays.length, 2)
                : null
        },
        edibles: {
            edibleCountUsed: weedRound(byType.edibles.edibleCountUsed, 4),
            thcMgUsed: weedRound(byType.edibles.thcMgUsed, 4),
            cbdMgUsed: weedRound(byType.edibles.cbdMgUsed, 4),
            costPerEdible: byType.edibles.edibleCountUsed > 0
                ? weedRound(byType.edibles.spend / byType.edibles.edibleCountUsed, 4)
                : null,
            costPerThcMg: byType.edibles.thcMgUsed > 0 ? weedRound(byType.edibles.spend / byType.edibles.thcMgUsed, 4) : null
        },
        'pre-rolls': {
            countUsed: weedRound(byType['pre-rolls'].countUsed, 4),
            gramsUsed: weedRound(byType['pre-rolls'].gramsUsed, 4),
            costPerPreRoll: byType['pre-rolls'].purchaseCount && byType['pre-rolls'].countUsed > 0
                ? weedRound(byType['pre-rolls'].spend / byType['pre-rolls'].countUsed, 4)
                : null
        }
    };
}

// ——— Data health + migration ———

function buildWeedDataHealthReport(data = appData) {
    const issues = [];
    (data.logs || []).forEach(log => {
        if (!log || !isWeedTrackingMode(getUseSubstanceId(log, data), data)) return;
        const type = getRecordWeedProductType(log, { allowEmpty: true });
        if (!type) {
            issues.push({ kind: 'missing_product_type', recordType: 'log', id: log.id, message: 'Use log missing Product Type', repairable: false });
            return;
        }
        if (!WEED_PRODUCT_TYPES.includes(type)) {
            issues.push({ kind: 'invalid_product_type', recordType: 'log', id: log.id, message: `Invalid Product Type: ${log.weedProductType}`, repairable: false });
        }
        if (type === 'cart') {
            const used = weedNum(log.estimatedPercentUsed ?? log.amount, null);
            if (used != null && (used < 0 || used > 100)) {
                issues.push({ kind: 'cart_percent_out_of_range', recordType: 'log', id: log.id, message: 'Cart percent used out of 0–100', repairable: false });
            }
        }
        if (type === 'edibles' && getWeedEdibleLogThcUsed(log) == null && weedNum(log.amount, 0) > 0) {
            issues.push({ kind: 'missing_edible_thc_strength', recordType: 'log', id: log.id, message: 'Edible use missing THC strength', repairable: false });
        }
        const pid = typeof getLogPurchaseId === 'function' ? getLogPurchaseId(log) : (log.purchaseId || log.linkedPurchaseId);
        if (pid && !(data.purchases || []).some(p => String(p.id) === String(pid))) {
            issues.push({ kind: 'broken_inventory_link', recordType: 'log', id: log.id, message: 'Broken inventory link', repairable: true, purchaseId: pid });
        }
    });
    (data.purchases || []).forEach(purchase => {
        if (!purchase || !isWeedPurchase(purchase, data)) return;
        const type = getRecordWeedProductType(purchase, { allowEmpty: true });
        if (!type) {
            issues.push({ kind: 'missing_product_type', recordType: 'purchase', id: purchase.id, message: 'Purchase missing Product Type', repairable: false });
            return;
        }
        if (type === 'cart') {
            const rawRem = weedNum(purchase.remainingAmount, null);
            if (rawRem != null && rawRem < 0) {
                issues.push({ kind: 'cart_remaining_below_zero', recordType: 'purchase', id: purchase.id, message: 'Cart remaining below 0', repairable: true });
            }
            if (rawRem != null && rawRem > 100) {
                issues.push({ kind: 'cart_percent_above_100', recordType: 'purchase', id: purchase.id, message: 'Cart remaining above 100%', repairable: true });
            }
            if (purchase.startingPercent == null && purchase.percentBoughtAt == null && !purchase.cartTracksPercent) {
                issues.push({ kind: 'missing_cart_starting_percent', recordType: 'purchase', id: purchase.id, message: 'Cart missing starting percent', repairable: false });
            }
        }
        if (type === 'edibles' && typeof weedEdiblePurchaseNeedsStrengthInfo === 'function' && weedEdiblePurchaseNeedsStrengthInfo(purchase)) {
            issues.push({ kind: 'missing_edible_thc_strength', recordType: 'purchase', id: purchase.id, message: 'Edible purchase missing THC mg per edible', repairable: false });
        }
        if (type === 'edibles') {
            const mgPer = typeof getWeedEdibleMgPerEdible === 'function' ? getWeedEdibleMgPerEdible(purchase) : null;
            const total = typeof getWeedEdibleTotalThcMg === 'function' ? getWeedEdibleTotalThcMg(purchase) : null;
            const count = typeof getPurchaseQuantityBought === 'function' ? getPurchaseQuantityBought(purchase) : weedNum(purchase.quantityBought, 0);
            if (mgPer != null && total != null && Math.abs(total - count * mgPer) > 0.05) {
                issues.push({ kind: 'mismatched_total_thc', recordType: 'purchase', id: purchase.id, message: 'Mismatched total THC mg', repairable: true });
            }
        }
        if (type === 'pre-rolls' && getWeedPreRollGramsPer(purchase) == null && purchase.totalPreRollGrams != null) {
            issues.push({ kind: 'missing_grams_per_preroll', recordType: 'purchase', id: purchase.id, message: 'Pre-roll missing grams per pre-roll', repairable: false });
        }
        if (type === 'pre-rolls') {
            const count = weedNum(purchase.preRollCount, null);
            const gPer = getWeedPreRollGramsPer(purchase);
            const total = weedNum(purchase.totalPreRollGrams, null);
            if (count != null && gPer != null && total != null && Math.abs(total - count * gPer) > 0.05) {
                issues.push({ kind: 'mismatched_total_grams', recordType: 'purchase', id: purchase.id, message: 'Mismatched total pre-roll grams', repairable: true });
            }
        }
        if (purchase.unit === 'units' || purchase.unit === 'hits' || purchase.legacyUnit) {
            issues.push({ kind: 'legacy_generic_unit', recordType: 'purchase', id: purchase.id, message: 'Legacy generic-unit entry', repairable: false });
        }
    });
    return {
        generatedAt: new Date().toISOString(),
        issueCount: issues.length,
        issues,
        needsReviewCount: issues.filter(i => i.kind === 'missing_product_type' || i.kind.includes('missing')).length
    };
}

function previewWeedDataHealthRepairs(data = appData) {
    const report = buildWeedDataHealthReport(data);
    const repairs = report.issues.filter(i => i.repairable).map(issue => {
        if (issue.kind === 'cart_remaining_below_zero' || issue.kind === 'cart_percent_above_100') {
            return { ...issue, action: 'Clamp cart remaining percent to 0–100' };
        }
        if (issue.kind === 'mismatched_total_thc') {
            return { ...issue, action: 'Recalculate totalThcMg / remainingThcMg from count × mg per edible' };
        }
        if (issue.kind === 'mismatched_total_grams') {
            return { ...issue, action: 'Recalculate totalPreRollGrams from count × grams per pre-roll' };
        }
        if (issue.kind === 'broken_inventory_link') {
            return { ...issue, action: 'Clear broken purchaseId / linkedPurchaseId' };
        }
        return { ...issue, action: 'Review manually' };
    });
    return { report, repairs };
}

function applyWeedDataHealthRepairs(data = appData, { dryRun = false } = {}) {
    const preview = previewWeedDataHealthRepairs(data);
    if (dryRun) return preview;
    const applied = [];
    preview.repairs.forEach(repair => {
        if (repair.recordType === 'purchase') {
            const purchase = (data.purchases || []).find(p => String(p.id) === String(repair.id));
            if (!purchase) return;
            if (repair.kind === 'cart_remaining_below_zero' || repair.kind === 'cart_percent_above_100') {
                if (typeof ensureWeedCartTracksPercent === 'function') ensureWeedCartTracksPercent(purchase);
                purchase.remainingAmount = typeof clampWeedCartPercent === 'function'
                    ? clampWeedCartPercent(purchase.remainingAmount) ?? 0
                    : Math.max(0, Math.min(100, weedNum(purchase.remainingAmount, 0) || 0));
                applied.push(repair);
            }
            if (repair.kind === 'mismatched_total_thc' && typeof syncWeedEdiblePurchaseFields === 'function') {
                syncWeedEdiblePurchaseFields(purchase);
                syncWeedEdibleCbdFields(purchase);
                applied.push(repair);
            }
            if (repair.kind === 'mismatched_total_grams') {
                syncWeedPreRollPurchaseFields(purchase);
                applied.push(repair);
            }
        }
        if (repair.recordType === 'log' && repair.kind === 'broken_inventory_link') {
            const log = (data.logs || []).find(l => String(l.id) === String(repair.id));
            if (!log) return;
            log.purchaseId = null;
            log.linkedPurchaseId = null;
            log.inventoryId = null;
            log.supplyUnlinked = true;
            log.inventoryAffects = false;
            applied.push(repair);
        }
    });
    if (applied.length && typeof saveData === 'function') saveData(data);
    return { ...preview, applied };
}

function migrateCompleteWeedSupport(data = appData) {
    ensureWeedCompletePrefs(data);
    const report = {
        migratedAt: new Date().toISOString(),
        purchasesMarkedNeedsReview: 0,
        logsMarkedNeedsReview: 0,
        prerollKeysNormalized: 0,
        edibleCbdSynced: 0,
        prerollFieldsSynced: 0,
        unchangedTotals: true
    };

    (data.logs || []).forEach(log => {
        if (!log || !isWeedTrackingMode(getUseSubstanceId(log, data), data)) return;
        // Preserve original values; never invent product type.
        if (!getRecordWeedProductType(log, { allowEmpty: true })) {
            log.needsReview = true;
            report.logsMarkedNeedsReview += 1;
        }
        if (log.weedProductType === 'pre-roll' || log.weedProductType === 'prerolls' || log.weedProductType === 'pre_rolls') {
            log.legacyWeedProductType = log.weedProductType;
            log.weedProductType = 'pre-rolls';
            report.prerollKeysNormalized += 1;
        }
        if (isWeedBudLog(log, data) && log.normalizedGrams == null && (log.unit === 'grams' || log.unit === 'g')) {
            log.normalizedGrams = weedNum(log.amount, null);
            if (log.enteredAmount == null) log.enteredAmount = log.amount;
            if (!log.enteredUnit) log.enteredUnit = 'grams';
        }
    });

    (data.purchases || []).forEach(purchase => {
        if (!purchase || !isWeedPurchase(purchase, data)) return;
        if (!getRecordWeedProductType(purchase, { allowEmpty: true })) {
            purchase.needsReview = true;
            report.purchasesMarkedNeedsReview += 1;
            // Do not assign product type.
        }
        if (purchase.weedProductType === 'pre-roll' || purchase.weedProductType === 'prerolls' || purchase.weedProductType === 'pre_rolls') {
            purchase.legacyWeedProductType = purchase.weedProductType;
            purchase.weedProductType = 'pre-rolls';
            report.prerollKeysNormalized += 1;
        }
        if (typeof isWeedEdiblesPurchase === 'function' && isWeedEdiblesPurchase(purchase, data)) {
            syncWeedEdibleCbdFields(purchase);
            report.edibleCbdSynced += 1;
        }
        if (isWeedPreRollsPurchase(purchase, data)) {
            syncWeedPreRollPurchaseFields(purchase);
            report.prerollFieldsSynced += 1;
        }
        if (typeof isWeedCartPurchase === 'function' && isWeedCartPurchase(purchase, data)) {
            if (purchase.startingPercent == null && purchase.cartTracksPercent) {
                purchase.startingPercent = 100;
            }
        }
    });

    if (!data.migrations || typeof data.migrations !== 'object') data.migrations = {};
    data.migrations.weedCompleteV1 = true;
    data.migrations.weedCompleteReport = report;
    return report;
}

function ensureWeedCompleteMigrated(data = appData) {
    if (!data || typeof data !== 'object') return null;
    if (!data.migrations || typeof data.migrations !== 'object') data.migrations = {};
    if (data.migrations.weedCompleteV1) return data.migrations.weedCompleteReport || null;
    return migrateCompleteWeedSupport(data);
}
