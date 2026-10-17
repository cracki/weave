import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import vm from 'node:vm';
import * as Vue from 'vue';
import { compile } from '@vue/compiler-dom';
import { repeaterLayout, setRepeaterLayout } from '../../resources/js/lib/repeater-layout.js';

function harness(overrides = {}) {
    setRepeaterLayout('split');
    const makeNode = (type, text = '') => ({ type, text, children: [], props: {}, style: {}, parent: null, addEventListener() {}, removeEventListener() {} });
    const renderer = Vue.createRenderer({
        createElement: makeNode, createText: text => makeNode('#text', text), createComment: text => makeNode('#comment', text),
        setText: (node, text) => { node.text = text; }, setElementText: (node, text) => { node.text = text; },
        patchProp: (node, key, old, value) => { node.props[key] = value; },
        insert(node, parent, anchor) {
            if (node.parent) node.parent.children.splice(node.parent.children.indexOf(node), 1);
            node.parent = parent;
            const index = anchor ? parent.children.indexOf(anchor) : -1;
            parent.children.splice(index === -1 ? parent.children.length : index, 0, node);
        },
        remove(node) { node.parent?.children.splice(node.parent.children.indexOf(node), 1); node.parent = null; },
        parentNode: node => node.parent,
        nextSibling: node => node.parent?.children[node.parent.children.indexOf(node) + 1] ?? null,
    });
    const editors = [];
    const events = [];
    const passthrough = { render() { return Vue.h('div', this.$slots.default?.({})); } };
    const context = {
        repeaterLayout,
        SortableList: { ...passthrough, props: ['modelValue', 'disabled', 'itemClass', 'handleClass', 'vertical', 'appendTo', 'constrainDimensions'] },
        Button: { props: ['disabled'], render() { return Vue.h('button', { ...this.$attrs, disabled: this.disabled }); } },
        DragHandle: { render() { return Vue.h('span'); } }, Icon: { render() { return Vue.h('svg'); } },
        PublishFieldsProvider: {
            props: ['fields', 'asConfig', 'readOnly', 'fieldPathPrefix', 'metaPathPrefix'],
            setup(props) { Vue.provide('scope', props); },
            render() { return Vue.h('div', this.$slots.default?.()); },
        },
        PublishFields: {
            setup() {
                const editor = { scope: Vue.inject('scope'), draft: Vue.ref('unsaved input') };
                editors.push(editor);
                return () => Vue.h('input', { value: editor.draft.value });
            },
        },
    };
    const source = readFileSync(new URL('../../resources/js/components/RepeaterRows.vue', import.meta.url), 'utf8');
    vm.runInNewContext(source.match(/<script>([\s\S]*?)<\/script>/)[1]
        .replace(/^import .*;$/gm, '').replace('export default', 'globalThis.component ='), context);
    const component = {
        extends: {
            props: ['rows', 'fields', 'readOnly', 'canAddRows', 'canDeleteRows', 'errors'],
            inject: ['grid'],
            computed: {
                sortableItemClass() { return 'test-row'; }, sortableHandleClass() { return 'test-drag'; },
                fieldPathPrefix() { return 'outer.2.children'; }, metaPathPrefix() { return 'outer.existing.parent.children'; },
                errorsById() { return this.errors ?? {}; },
            },
            methods: { rowHasError(id) { return Boolean(this.errorsById[id]?.length); } },
        },
        ...context.component,
    };
    // Search is driven through the component below; DOM-specific text-input
    // event wiring needs a browser and is outside this renderer's contract.
    component.render = new Function('Vue', compile(source.match(/<template>([\s\S]*)<\/template>/)[1], { mode: 'function', prefixIdentifiers: true }).code)({ ...Vue, vModelText: {} });
    const props = Vue.reactive({
        rows: [{ _id: 'one', title: 'عنوان اول', description: 'شرح اول' }, { _id: 'two', title: 'Second', description: 'Description' }],
        fields: [{ handle: 'title', type: 'text' }, { handle: 'description', type: 'textarea' }],
        readOnly: false, canAddRows: true, canDeleteRows: true, errors: {}, ...overrides,
    });
    let instance;
    const grid = Vue.reactive({ config: { reorderable: true }, isReorderable: !props.readOnly });
    const app = renderer.createApp({ render() {
        return Vue.h(component, {
            ...props, ref: value => { instance = value; },
            onSorted: rows => events.push(['sorted', rows]), onRemoved: index => events.push(['removed', index]),
            onDuplicate: index => events.push(['duplicate', index]),
        });
    } });
    app.provide('grid', grid);
    app.provide('weaveRepeaterActions', { addRow: () => events.push(['add']) });
    app.config.globalProperties.__ = value => value;
    app.directive('tooltip', {});
    const root = makeNode('root');
    app.mount(root);
    return { app, props, grid, editors, events, root, get instance() { return instance; } };
}

function find(node, predicate) {
    return [node, ...node.children.flatMap(child => find(child, predicate))].filter(predicate);
}

test('both layouts preserve mounted editors, drafts, conditions and scoped row paths while searching and selecting', async () => {
    const state = harness();
    try {
        assert.equal(state.instance.activeId, 'one');
        assert.equal(state.editors.length, 2);
        assert.equal(state.editors[1].scope.fieldPathPrefix, 'outer.2.children.1');
        assert.equal(state.editors[1].scope.metaPathPrefix, 'outer.existing.parent.children.existing.two');
        assert.equal(state.editors[1].scope.asConfig, false);
        state.editors[0].draft.value = 'در حال ویرایش';
        state.instance.selectRow('two');
        state.instance.query = 'شرح اول';
        await Vue.nextTick();
        assert.equal(state.instance.activeId, 'one');
        assert.deepEqual(state.instance.visibleRows.map(row => row._id), ['one']);
        setRepeaterLayout('accordion');
        await Vue.nextTick();
        state.instance.toggleRow('one');
        await Vue.nextTick();
        assert.equal(state.instance.activeId, null);
        setRepeaterLayout('split');
        await Vue.nextTick();
        assert.equal(state.instance.activeId, 'one');
        assert.equal(state.editors.length, 2);
        assert.equal(state.editors[0].draft.value, 'در حال ویرایش');
        setRepeaterLayout('accordion');
        await Vue.nextTick();
        state.instance.selectRow('two');
        setRepeaterLayout('split');
        await Vue.nextTick();
        assert.equal(state.instance.activeId, 'two');
        assert.equal(state.instance.query, '');
    } finally { state.app.unmount(); }
});

test('add, reorder, delete and validation retain row identity and update field indexes', async () => {
    const state = harness();
    try {
        state.instance.selectRow('two');
        state.instance.moveRow(1, -1);
        assert.equal(state.events[0][0], 'sorted');
        state.props.rows = state.events[0][1];
        await Vue.nextTick();
        assert.equal(state.instance.activeId, 'two');
        assert.equal(state.editors[1].scope.fieldPathPrefix, 'outer.2.children.0');
        state.props.rows = [...state.props.rows, { _id: 'new', title: 'New' }];
        await Vue.nextTick();
        assert.equal(state.instance.activeId, 'new');
        state.props.rows = state.props.rows.filter(row => row._id !== 'new');
        await Vue.nextTick();
        assert.equal(state.instance.activeId, 'one');
        state.instance.query = 'missing';
        await Vue.nextTick();
        assert.equal(state.instance.activeId, null);
        state.props.errors = { two: ['Required'] };
        await Vue.nextTick();
        assert.equal(state.instance.activeId, 'two');
        assert.equal(state.instance.query, '');
        const buttons = find(state.root, node => node.type === 'button');
        buttons.find(node => node.props['aria-label'] === 'Duplicate Row').props.onClick();
        buttons.find(node => node.props['aria-label'] === 'Delete Row').props.onClick();
        assert.deepEqual(state.events.slice(-2), [['duplicate', 0], ['removed', 0]]);
    } finally { state.app.unmount(); }
});

test('read-only rows suppress actions and protected/conditional fields do not leak into summaries', async () => {
    const state = harness({
        readOnly: true, canAddRows: false, canDeleteRows: false,
        fields: [{ handle: 'title', type: 'text', if: { enabled: 'equals true' } }, { handle: 'description', type: 'textarea', visibility: 'hidden' }],
    });
    try {
        assert.equal(state.instance.rowTitle(state.props.rows[0], 0), 'Row 1');
        assert.equal(state.editors[0].scope.fields, state.props.fields);
        assert.equal(state.editors[0].scope.readOnly, true);
        state.instance.moveRow(0, 1);
        assert.equal(state.events.length, 0);
        assert.equal(find(state.root, node => ['Delete Row', 'Duplicate Row', 'Move up', 'Move down'].includes(node.props['aria-label'])).length, 0);
    } finally { state.app.unmount(); }
});
