#!/usr/bin/env node
/**
 * Goals were removed. This splice is intentionally a no-op so it cannot
 * reintroduce Goal UI, analytics, or runtime into app.js.
 *
 * Legacy `goals` arrays are still accepted by normalizeAppData / import.
 */
console.log('Goals have been removed. splice-goal-system is a no-op.');
