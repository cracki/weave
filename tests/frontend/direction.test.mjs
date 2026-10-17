import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import vm from 'node:vm';
import * as Vue from 'vue';
import { renderToString } from '@vue/server-renderer';
import autoDirection from '../../resources/js/directives/auto-direction.js';

function component(name, globals = {}) {
    const source = readFileSync(new URL(`../../resources/js/components/${name}.vue`, import.meta.url), 'utf8');
    const script = source.match(/<script>([\s\S]*?)<\/script>/)[1]
        .replace(/^import .*;\r?$/gm, '').replace('export default', 'globalThis.component =');
    const context = { ...globals };
    vm.runInNewContext(script, context);
    return context.component;
}

test('node content direction stays automatic under either UI preference, including nested providers', async () => {
    const publishContextKey = Symbol('container');
    const NodeContainer = component('NodeContainer', { ...Vue, publishContextKey });
    NodeContainer.render = function () { return this.$slots.default?.(); };
    const Control = {
        setup() {
            const context = Vue.inject(publishContextKey);
            return () => Vue.h('input', { dir: context.direction.value, value: context.values.value.title });
        },
    };
    for (const dir of ['rtl', 'ltr']) {
        const app = Vue.createSSRApp({
            render() {
                return Vue.h('div', { dir }, Vue.h(NodeContainer, { node: { props: { title: 'عنوان فارسی' } }, meta: {} }, {
                    default: () => [Vue.h(Control), Vue.h(NodeContainer, { node: { props: { title: 'English' } }, meta: {} }, { default: () => Vue.h(Control) })],
                }));
            },
        });
        const html = await renderToString(app);
        assert.match(html, /dir="auto" value="عنوان فارسی"/);
        assert.match(html, /dir="auto" value="English"/);
    }
});

test('size tabs follow visual arrow order in RTL and LTR, wrap and retain Home/End behavior', () => {
    const panel = component('PropsPanel', { Button: {}, Card: {}, Icon: {}, BoxModelControl: {}, NodeContainer: {}, PropField: {} });
    for (const rtl of [false, true]) {
        let focused;
        const receiver = {
            ...panel.data(), size: 'compact',
            $emit(name, value) { assert.equal(name, 'update:size'); this.size = value; },
        };
        const press = (key) => {
            let prevented = false;
            panel.methods.onSizeKeydown.call(receiver, {
                key, preventDefault() { prevented = true; },
                currentTarget: { matches: () => rtl, querySelectorAll: () => [0, 1, 2].map(index => ({ focus() { focused = index; } })) },
            });
            return prevented;
        };
        press(rtl ? 'ArrowLeft' : 'ArrowRight');
        assert.equal(receiver.size, 'medium');
        assert.equal(focused, 1);
        press('End');
        assert.equal(receiver.size, 'wide');
        press('ArrowDown');
        assert.equal(receiver.size, 'compact');
        press(rtl ? 'ArrowRight' : 'ArrowLeft');
        assert.equal(receiver.size, 'wide');
        press('Home');
        assert.equal(receiver.size, 'compact');
        assert.equal(press('Tab'), false);
    }
});

test('automatic direction covers inserted and replaced text controls without changing values or other input types', () => {
    let callback, options, disconnected = false;
    const previousObserver = globalThis.MutationObserver;
    globalThis.MutationObserver = class {
        constructor(handler) { callback = handler; }
        observe(element, config) { options = config; }
        disconnect() { disconnected = true; }
    };
    const element = (textControl, value = '') => ({
        nodeType: 1, value, attributes: { dir: 'rtl' }, children: [],
        matches() { return textControl; },
        querySelectorAll() { return this.children.filter(child => child.matches()); },
        getAttribute(name) { return this.attributes[name]; },
        setAttribute(name, value) { this.attributes[name] = value; },
    });
    const root = element(false);
    const text = element(true, 'عنوان فارسی');
    const numeric = element(false, 42);
    root.children.push(text, numeric);
    try {
        autoDirection.mounted(root);
        assert.equal(text.attributes.dir, 'auto');
        assert.equal(text.value, 'عنوان فارسی');
        assert.equal(numeric.attributes.dir, 'rtl');
        assert.deepEqual(options.attributeFilter, ['dir']);
        const added = element(true, 'https://example.test/path');
        callback([{ type: 'childList', addedNodes: [added, { nodeType: 3 }] }]);
        assert.equal(added.attributes.dir, 'auto');
        assert.equal(added.value, 'https://example.test/path');
        text.attributes.dir = 'ltr';
        callback([{ type: 'attributes', target: text }]);
        assert.equal(text.attributes.dir, 'auto');
        autoDirection.beforeUnmount(root);
        assert.equal(disconnected, true);
    } finally {
        globalThis.MutationObserver = previousObserver;
    }
});
