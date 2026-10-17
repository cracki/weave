import assert from 'node:assert/strict';
import test from 'node:test';

test('layout defaults, persists across reloads and tabs, and tolerates unavailable storage', async () => {
    const originalWindow = globalThis.window;
    const values = new Map();
    const listeners = [];
    globalThis.window = {
        localStorage: {
            getItem: key => values.get(key) ?? null,
            setItem: (key, value) => values.set(key, value),
        },
        addEventListener: (event, listener) => listeners.push(listener),
    };
    try {
        const first = await import('../../resources/js/lib/repeater-layout.js?first');
        assert.equal(first.repeaterLayout.value, 'split');
        first.setRepeaterLayout('accordion');
        assert.equal(values.get(first.REPEATER_LAYOUT_KEY), 'accordion');
        const reloaded = await import('../../resources/js/lib/repeater-layout.js?reload');
        assert.equal(reloaded.repeaterLayout.value, 'accordion');
        first.setRepeaterLayout('invalid');
        assert.equal(first.repeaterLayout.value, 'accordion');
        values.set(first.REPEATER_LAYOUT_KEY, 'split');
        listeners.forEach(listener => listener({ key: first.REPEATER_LAYOUT_KEY }));
        assert.equal(first.repeaterLayout.value, 'split');
        assert.equal(reloaded.repeaterLayout.value, 'split');
        values.set(first.REPEATER_LAYOUT_KEY, 'outdated');
        const invalid = await import('../../resources/js/lib/repeater-layout.js?invalid');
        assert.equal(invalid.repeaterLayout.value, 'split');
        globalThis.window.localStorage = { getItem() { throw Error('blocked'); }, setItem() { throw Error('full'); } };
        const blocked = await import('../../resources/js/lib/repeater-layout.js?blocked');
        assert.equal(blocked.repeaterLayout.value, 'split');
        blocked.setRepeaterLayout('accordion');
        assert.equal(blocked.repeaterLayout.value, 'accordion');
    } finally {
        if (originalWindow === undefined) delete globalThis.window;
        else globalThis.window = originalWindow;
    }
});
