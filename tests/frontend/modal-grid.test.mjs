import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import vm from 'node:vm';
import * as Vue from 'vue';
import { compile } from '@vue/compiler-dom';
import { modalGridConfig } from '../../resources/js/lib/modal-grid.js';

test('Grid editors are modal at every depth, with conditions and unrelated fields intact', () => {
    const original = {
        handle: 'rows', type: 'grid', component: 'grid', fullscreen: true,
        fields: [{ handle: 'children', type: 'grid', if: { enabled: 'equals true' }, fields: [
            { handle: 'image', type: 'assets', component: 'assets', container: 'assets' },
            { handle: 'details', type: 'replicator', sets: { group: { sets: { item: { fields: [
                { handle: 'items', field: { type: 'grid', fullscreen: true } },
            ] } } } } },
        ] }],
    };
    const config = modalGridConfig(original);
    assert.equal(config.component, 'weave-modal-grid');
    assert.equal(config.fullscreen, false);
    assert.equal(config.fields[0].component, 'weave-modal-grid');
    assert.deepEqual(config.fields[0].if, original.fields[0].if);
    assert.deepEqual(config.fields[0].fields[0], original.fields[0].fields[0]);
    const inSet = config.fields[0].fields[1].sets.group.sets.item.fields[0].field;
    assert.equal(inSet.component, 'weave-modal-grid');
    assert.equal(inSet.fullscreen, false);
    assert.equal(original.component, 'grid');
    assert.equal(original.fields[0].component, undefined);
});

function loadModalGrid() {
    const source = readFileSync(new URL('../../resources/js/components/ModalGridFieldtype.vue', import.meta.url), 'utf8');
    const script = source.match(/<script>([\s\S]*?)<\/script>/)[1]
        .replace(/^import .*;$/gm, '').replace('export default', 'globalThis.component =');
    const fieldProps = Object.fromEntries(['value', 'config', 'handle', 'meta', 'readOnly', 'showFieldPreviews', 'namePrefix', 'fieldPathPrefix', 'metaPathPrefix', 'id'].map(key => [key, {}]));
    const context = {
        autoDirection: {},
        Button: { props: ['disabled'], render() { return Vue.h('button', { disabled: this.disabled }, this.$slots.default?.()); } },
        ModalTitle: { render() { return Vue.h('h2', this.$slots.default?.()); } },
        Modal: {
            props: ['open'], emits: ['opened', 'update:open'],
            watch: { async open(value) { if (value) { await Vue.nextTick(); this.$emit('opened'); } } },
            render() { return this.open ? Vue.h('dialog', [this.$slots.default?.(), this.$slots.footer?.()]) : null; },
        },
        Fieldtype: {
            props: fieldProps,
            emits: ['update:value', 'update:meta', 'focus', 'blur', 'replicator-preview-updated'],
            // Statamic 6 exports a helper object. The Options API behavior is
            // on Fieldtype.mixin, not on Fieldtype itself.
            mixin: {
                props: fieldProps,
                emits: ['update:value', 'update:meta', 'focus', 'blur', 'replicator-preview-updated'],
                computed: { isReadOnly() { return this.readOnly || ['read_only', 'computed'].includes(this.config.visibility); } },
                methods: {
                    update(value) { this.$emit('update:value', value); },
                    updateMeta(meta) { this.$emit('update:meta', meta); },
                },
            },
        },
    };
    vm.runInNewContext(script, context);
    const template = source.match(/<template>([\s\S]*)<\/template>/)[1];
    context.component.render = new Function('Vue', compile(template, { mode: 'function', prefixIdentifiers: true }).code)(Vue);
    return context.component;
}

// Mount Vue without a browser: verify the wrapper/native Grid contract,
// including modal nesting, rather than inspecting template source strings.
function harness(props) {
    const makeNode = (type, text = '') => ({ type, text, children: [], props: {}, parent: null });
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
    const component = loadModalGrid();
    const nativeGrids = [];
    const events = [];
    const app = renderer.createApp(component, {
        ...props,
        'onUpdate:value': value => events.push(['value', value]),
        'onUpdate:meta': meta => events.push(['meta', meta]),
    });
    app.config.globalProperties.__ = value => value;
    app.config.globalProperties.__n = (label, count) => `${count} rows`;
    app.directive('tooltip', {});
    app.component('weave-modal-grid-fieldtype', component);
    app.component('grid-fieldtype', {
        props: ['value', 'meta', 'config', 'handle', 'fieldPathPrefix', 'metaPathPrefix', 'readOnly', 'id', 'namePrefix'],
        emits: ['update:value', 'update:meta'],
        computed: { canAddRows() { return !this.readOnly; } },
        methods: {
            addRow() {
                this.$emit('update:meta', { ...this.meta, existing: { ...this.meta.existing, added: {} } });
                this.$emit('update:value', [...this.value, { _id: 'added' }]);
            },
        },
        mounted() { nativeGrids.push(this); },
        render() {
            return Vue.h('section', this.config.fields?.filter(field => field.type === 'grid').map(field => Vue.h(Vue.resolveComponent('weave-modal-grid-fieldtype'), {
                config: field, handle: field.handle, value: [], meta: { existing: {} },
                fieldPathPrefix: `${this.handle}.0`, metaPathPrefix: `${this.handle}.existing.row`,
            })));
        },
    });
    const root = makeNode('root');
    const instance = app.mount(root);
    return { app, instance, nativeGrids, events, root };
}

test('the modal forwards scoped props and native row metadata/value updates', async () => {
    const value = [{ _id: 'row' }];
    const meta = { existing: { row: {} } };
    const state = harness({ handle: 'children', value, meta, config: modalGridConfig({ type: 'grid', display: 'Children' }), fieldPathPrefix: 'links.0', metaPathPrefix: 'links.existing.parent' });
    assert.equal(state.nativeGrids.length, 0);
    state.instance.openRows(true);
    for (let i = 0; i < 5; i++) await Vue.nextTick();
    const grid = state.nativeGrids[0];
    assert.equal(grid.config.fullscreen, false);
    assert.equal(grid.config.component, 'grid');
    assert.equal(grid.fieldPathPrefix, 'links.0');
    assert.equal(grid.metaPathPrefix, 'links.existing.parent');
    assert.equal(Vue.toRaw(grid.value), value);
    assert.equal(Vue.toRaw(grid.meta), meta);
    assert.deepEqual(state.events.map(([event]) => event), ['meta', 'value']);
    assert.equal(state.events[1][1][1]._id, 'added');
    assert.equal(state.instance.pendingAdd, false);
    // The toolbar button in an already open modal uses the same path.
    state.instance.addRow();
    assert.deepEqual(state.events.map(([event]) => event), ['meta', 'value', 'meta', 'value']);
    state.app.unmount();
});

test('nested grids open independent modals and closing a child leaves the parent open', async () => {
    const state = harness({ handle: 'rows', value: [{ _id: 'row' }], meta: { existing: {} }, config: modalGridConfig({ type: 'grid', fields: [{ handle: 'children', type: 'grid' }] }) });
    state.instance.openRows();
    await Vue.nextTick();
    // The native row renderer creates the wrapper registered by its config.
    const childVm = state.nativeGrids[0].$.subTree.children[0].component.proxy;
    childVm.openRows();
    await Vue.nextTick();
    assert.equal(state.nativeGrids.length, 2);
    assert.equal(state.nativeGrids[1].fieldPathPrefix, 'rows.0');
    assert.equal(state.nativeGrids[1].metaPathPrefix, 'rows.existing.row');
    const childEvents = [];
    // Native Grid emits to the nested wrapper, which must forward both
    // events to the row's PublishField instead of dropping them.
    childVm.$.vnode.props['onUpdate:value'] = value => childEvents.push(['value', value]);
    childVm.$.vnode.props['onUpdate:meta'] = meta => childEvents.push(['meta', meta]);
    childVm.addRow();
    assert.deepEqual(childEvents.map(([event]) => event), ['meta', 'value']);
    assert.equal(childEvents[1][1][0]._id, 'added');
    childVm.rowsOpen = false;
    await Vue.nextTick();
    assert.equal(state.instance.rowsOpen, true);
    assert.equal(childVm.rowsOpen, false);
    state.app.unmount();
});

test('read-only and max-row limits prevent modal add actions', () => {
    for (const props of [
        { readOnly: true },
        { config: { type: 'grid', visibility: 'read_only' } },
        { config: { type: 'grid', max_rows: 1 }, value: [{ _id: 'row' }] },
    ]) {
        const state = harness({ handle: 'rows', value: [], meta: { existing: {} }, config: { type: 'grid' }, ...props });
        state.instance.openRows(true);
        assert.equal(state.instance.rowsOpen, false);
        assert.equal(state.events.length, 0);
        state.app.unmount();
    }
});
