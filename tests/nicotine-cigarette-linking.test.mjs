import test from 'node:test';
import assert from 'node:assert/strict';
import { loadRecoveryTrackerApp } from './harness.mjs';

const NICOTINE_ID = 'nicotine';

function createElement(id, props = {}) {
  const children = [];
  const classes = new Set();
  const element = {
    id,
    tagName: 'div',
    value: props.value ?? '',
    textContent: '',
    checked: !!props.checked,
    disabled: !!props.disabled,
    required: !!props.required,
    hidden: false,
    dataset: {},
    style: {},
    children,
    options: children,
    classList: {
      add(...names) { names.forEach(name => classes.add(name)); },
      remove(...names) { names.forEach(name => classes.delete(name)); },
      toggle(name, force) {
        if (force === true) classes.add(name);
        else if (force === false) classes.delete(name);
        else if (classes.has(name)) classes.delete(name);
        else classes.add(name);
        return classes.has(name);
      },
      contains(name) { return classes.has(name); }
    },
    appendChild(child) {
      children.push(child);
      this.options = children.filter(node => (node.tagName || '').toLowerCase() === 'option' || node.value != null);
      return child;
    },
    addEventListener() {},
    removeEventListener() {},
    setAttribute() {},
    remove() {},
    focus() {},
    scrollIntoView() {},
    checkValidity() {
      if (this.required && (this.value === '' || this.value == null)) return false;
      return true;
    },
    reportValidity() { return this.checkValidity(); },
    _innerHTML: ''
  };
  Object.defineProperty(element, 'innerHTML', {
    get() { return element._innerHTML || ''; },
    set(value) {
      element._innerHTML = value;
      children.length = 0;
      if (typeof value === 'string' && value.includes('<option')) {
        const empty = createElement();
        empty.tagName = 'option';
        empty.value = '';
        empty.textContent = 'No linked purchase';
        children.push(empty);
      }
      element.options = children.filter(node => (node.tagName || '').toLowerCase() === 'option' || node.value != null);
    }
  });
  return element;
}

function makeNicotineData({ purchases = [], logs = [] } = {}) {
  return {
    substances: [{
      id: NICOTINE_ID,
      name: 'Nicotine',
      trackingMode: 'nicotine',
      primaryUnit: 'puffs',
      units: ['puffs', 'cigarettes'],
      defaultUnit: 'puffs',
      costTrackingEnabled: true,
      taperTrackingEnabled: true,
      isMain: true
    }],
    purchases,
    logs,
    cravings: [],
    settings: {
      currency: '$',
      substanceSettings: {},
      vapeTaperCountMode: 'log-date',
      spreadPercentLeftUsage: true,
      appearanceViewMode: 'auto'
    },
    taperPlans: {},
    taperPlansV2: [],
    recoveryStreaks: {},
    privacy: {
      enabled: false,
      pinHash: '',
      autoLockMinutes: 5
    },
    migrations: {
      inventoryLinkedV1: true,
      purchaseIdLinkV2: true,
      vapeInventoryLinkV2: true
    }
  };
}

function makeCigarettePurchase(overrides = {}) {
  return {
    id: 2,
    substanceId: NICOTINE_ID,
    nicotineProductType: 'cigarettes',
    quantityBought: 20,
    quantity: 20,
    totalCigarettes: 20,
    remainingAmount: 20,
    unit: 'cigarettes',
    cigarettesPerPack: 20,
    acquisitionType: 'purchased',
    date: '2024-01-02',
    time: '12:00',
    isDepleted: false,
    ...overrides
  };
}

function makeVapePurchase(overrides = {}) {
  return {
    id: 1,
    substanceId: NICOTINE_ID,
    nicotineProductType: 'vape',
    quantityBought: 10000,
    remainingAmount: 10000,
    unit: 'puffs',
    fullPuffCount: 10000,
    acquisitionType: 'purchased',
    date: '2024-01-01',
    time: '12:00',
    isDepleted: false,
    ...overrides
  };
}

function setupDom(rt, { productType = 'cigarettes', purchaseSelect = '2', linkMode = 'manual' } = {}) {
  const elements = new Map();
  const form = createElement('use-log-form');
  form.checkValidity = function checkValidity() {
    for (const el of elements.values()) {
      if (typeof el.checkValidity === 'function' && el !== form && !el.checkValidity()) return false;
    }
    return true;
  };
  form.reportValidity = () => form.checkValidity();
  form.reset = () => {};
  elements.set('use-log-form', form);

  const put = (id, props = {}) => {
    const el = createElement(id, props);
    elements.set(id, el);
    return el;
  };

  put('use-substance', { value: NICOTINE_ID });
  put('use-transaction-type', { value: 'use' });
  put('use-type', { value: 'quick' });
  put('use-date', { value: '2026-08-04' });
  put('use-start-time', { value: '', required: true });
  put('use-end-date', {});
  put('use-end-time', {});
  put('use-amount', { value: '1', required: true });
  put('use-unit', { value: 'puffs', required: true });
  put('use-nicotine-product-type', { value: productType });
  put('use-cigarettes-smoked', { value: '5' });
  put('use-percent-after', { value: '', required: true });
  put('use-vape-puffs-used', {});
  put('use-vape-log-mode', { value: 'percent' });
  put('use-purchase-link-mode', { value: linkMode });
  put('use-purchase-select', { value: String(purchaseSelect) });
  put('use-purchase-manual-wrap', {});
  put('use-purchase-preview', {});
  put('use-purchase-link-label', {});
  put('use-vape-purchase-select', { value: '' });
  put('use-notes', {});
  put('use-count', { value: '0' });
  put('use-shared-total', {});
  put('use-shared-personal', {});
  put('use-shared-other', {});
  put('use-shared-with', {});
  put('use-gift-party', {});
  put('use-amount-mode-group', {});
  put('use-start-time-group', {});
  put('use-nicotine-product-type-group', {});
  put('use-cigarettes-fields-group', {});
  put('use-vape-fields-group', {});
  put('use-vape-purchase-block', {});
  put('use-pouches-fields-group', {});
  put('use-gum-fields-group', {});
  put('use-patches-fields-group', {});
  put('use-duration-preview', {});
  put('use-weed-product-type-group', {});
  put('use-weed-cart-fields-group', {});
  put('use-lsd-fields-group', {});
  put('use-xanax-fields-group', {});
  put('use-count-group', {});
  put('use-cigarettes-preview', {});
  put('use-date-label', {});
  put('cancel-use-edit-btn', {});
  put('use-inventory-fields-group', {});
  put('use-inventory-core-anchor', {
    appendChild(child) { return child; }
  });
  put('use-advanced-section', {});
  // querySelector fallback target for inventory reposition
  const advancedBody = createElement('use-log-advanced-body');
  advancedBody.insertBefore = (node) => node;

  rt.document.getElementById = (id) => elements.get(id) || null;
  rt.document.querySelector = (sel) => {
    if (sel === '#use-advanced-section .use-log-advanced-body') return advancedBody;
    return null;
  };
  rt.document.querySelectorAll = () => [];
  rt.document.createElement = (tagName) => {
    const el = createElement();
    el.tagName = String(tagName || '').toLowerCase();
    return el;
  };

  return elements;
}

test('cigarette use logs only offer cigarette inventory purchases in the link picker', () => {
  const rt = loadRecoveryTrackerApp();
  const elements = setupDom(rt, { productType: 'cigarettes', purchaseSelect: '', linkMode: 'manual' });

  rt.__setTestAppData(makeNicotineData({
    purchases: [makeVapePurchase(), makeCigarettePurchase()]
  }));

  rt.updateUsePurchaseLinkUI();

  const select = elements.get('use-purchase-select');
  const values = select.options.map(option => option.value);
  assert.deepEqual(values, ['', '2']);
  assert.equal(select.options.some(option => String(option.textContent || '').includes('cigarettes')), true);

  select.value = '2';
  rt.updateUsePurchaseLinkUI();
  assert.notEqual(elements.get('use-purchase-preview').textContent, 'Choose a purchase with remaining supply, or select No linked purchase.');
});

test('switching from vape to cigarettes clears hidden required fields so the form can submit', () => {
  const rt = loadRecoveryTrackerApp();
  const elements = setupDom(rt, { productType: 'vape', purchaseSelect: '1', linkMode: 'manual' });
  elements.get('use-percent-after').required = true;
  elements.get('use-amount').required = false;
  elements.get('use-unit').required = false;

  rt.__setTestAppData(makeNicotineData({
    purchases: [makeVapePurchase(), makeCigarettePurchase()]
  }));

  // Simulate prior vape mode leaving percent required, then switch to cigarettes.
  elements.get('use-nicotine-product-type').value = 'cigarettes';
  elements.get('use-purchase-select').value = '2';
  rt.onNicotineUseProductTypeChange();

  assert.equal(elements.get('use-percent-after').required, false);
  assert.equal(elements.get('use-amount').required, false);
  assert.equal(elements.get('use-unit').required, false);
  assert.equal(elements.get('use-log-form').checkValidity(), true);

  const calc = rt.computeNicotineNonVapeUseFromForm();
  assert.equal(calc.error, undefined);
  assert.equal(calc.amount, 5);
  assert.equal(calc.nicotineProductType, 'cigarettes');
  assert.equal(String(calc.purchaseId), '2');
});

test('cigarette use saves to history, links purchase, and deducts inventory', () => {
  const rt = loadRecoveryTrackerApp();
  setupDom(rt, { productType: 'cigarettes', purchaseSelect: '2', linkMode: 'manual' });

  const data = makeNicotineData({
    purchases: [makeVapePurchase(), makeCigarettePurchase()]
  });
  rt.__setTestAppData(data);

  // Ensure required flags match post product-type-change state.
  rt.onNicotineUseProductTypeChange();
  rt.handleUseLogSubmit({ preventDefault() {} });

  const logs = data.logs || rt.getUseEntries();
  assert.ok(logs.length >= 1, 'expected a saved use log');
  const log = logs[logs.length - 1];
  assert.equal(log.nicotineProductType, 'cigarettes');
  assert.equal(log.cigarettesUsed, 5);
  assert.equal(log.amount, 5);
  assert.equal(log.unit, 'cigarettes');
  assert.equal(String(rt.getLogPurchaseId(log)), '2');
  assert.equal(log.inventoryAffects, true);

  const cigPurchase = data.purchases.find(p => String(p.id) === '2');
  assert.equal(cigPurchase.remainingAmount, 15);

  const vapePurchase = data.purchases.find(p => String(p.id) === '1');
  assert.equal(vapePurchase.remainingAmount, 10000);
});
