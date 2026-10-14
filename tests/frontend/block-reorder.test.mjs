import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import vm from 'node:vm';
import * as Vue from 'vue';
import { compile } from '@vue/compiler-dom';
import { planBlockDrop, reorderNodes } from '../../resources/js/lib/reorder.js';

function component(name, dependencies) {
    const source = readFileSync(new URL(`../../resources/js/components/${name}.vue`, import.meta.url), 'utf8');
    const script = source.match(/<script>([\s\S]*?)<\/script>/)[1]
        .replace(/^import .*;$/gm, '').replace('export default', 'globalThis.component =');
    const context = { ...dependencies };
    vm.runInNewContext(script, context);
    const template = source.match(/<template>([\s\S]*)<\/template>/)[1];
    context.component.render = new Function('Vue', compile(template, { mode: 'function', prefixIdentifiers: true }).code)(Vue);
    return context.component;
}

function descendants(node, className) {
    return node.children.flatMap(child => [
        ...(String(child.props.class || '').split(/\s+/).includes(className) ? [child] : []),
        ...descendants(child, className),
    ]);
}

function harness(blocks, blockTypes = []) {
    const makeNode = (type, text = '') => ({ type, text, children: [], props: {}, style: {}, parent: null });
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
    const lists = [];
    const primitive = { render() { return Vue.h('span', this.$slots.default?.()); } };
    const Modal = { props: ['open'], render() { return this.open ? Vue.h('dialog', this.$slots.default?.()) : null; } };
    const BlockList = component('BlockList', { planBlockDrop, reorderNodes });
    BlockList.mounted = function () { lists.push(this); };
    const dependencies = {
        BlockList, Button: primitive, DragHandle: primitive, Icon: primitive, Modal, ModalTitle: primitive,
        Tabs: primitive, TabList: primitive, TabTrigger: primitive, TabContent: primitive,
    };
    const BlockNode = component('BlockNode', dependencies);
    const BlocksPanel = component('BlocksPanel', { ...dependencies, BlockNode, uuid: () => 'panel' });
    const errors = [];
    const added = [];
    const app = renderer.createApp(BlocksPanel, { blocks, blockTypes, onAdd: value => added.push(value) });
    app.config.errorHandler = error => errors.push(error);
    const instance = app.mount(makeNode('root'));
    return { app, instance, lists, errors, added };
}

function expandNodes(vnode) {
    if (vnode?.component?.type.name === 'BlockNode') vnode.component.proxy.collapsed = false;
    if (vnode?.component) expandNodes(vnode.component.subTree);
    if (Array.isArray(vnode?.children)) vnode.children.forEach(expandNodes);
}

function dragEvent(offset = 50) {
    return {
        clientY: offset,
        dataTransfer: { setData() {} },
        preventDefault() { this.prevented = true; },
        currentTarget: { querySelector: () => ({ getBoundingClientRect: () => ({ top: 0, height: 100 }) }) },
    };
}

function drag(list, oldIndex, newIndex) {
    const original = [...list.blocks];
    const source = list.blocks[oldIndex];
    const target = list.blocks[newIndex];
    const event = dragEvent(oldIndex < newIndex ? 90 : 10);
    list.startDrag(event, source);
    list.onDragOver(event, target.id);
    assert.deepEqual(list.blocks, original, 'hover leaves the persisted order untouched');
    list.onDrop(event, target.id);
}

test('repeated root and nested reorders keep every block and isolate sibling lists', async () => {
    const blocks = Vue.reactive([
        { id: 'a', type: 'text', props: { text: 'A' } },
        { id: 'b', type: 'columns', children: [
            { id: 'b1', type: 'column', children: [
                { id: 'leaf1', type: 'text' }, { id: 'leaf2', type: 'text' },
            ] },
            { id: 'b2', type: 'column', children: [] },
        ] },
        { id: 'c', type: 'text' },
    ]);
    const original = [...blocks];
    const state = harness(blocks);
    try {
        for (let depth = 0; depth < 3; depth++) {
            expandNodes(state.instance.$.subTree);
            await Vue.nextTick();
        }
        assert.equal(state.lists.length, 4);
        assert.equal(new Set(state.lists.map(list => list.blocks)).size, 4);
        const root = state.lists[0];
        const columns = state.lists.find(list => list.blocks === original[1].children);
        const leaves = state.lists.find(list => list.blocks === original[1].children[0].children);
        for (let i = 0; i < 20; i++) {
            drag(root, 2, 0);
            await Vue.nextTick();
            drag(columns, 1, 0);
            await Vue.nextTick();
            drag(leaves, 1, 0);
            await Vue.nextTick();
        }
        assert.deepEqual(blocks.map(node => node.id).sort(), ['a', 'b', 'c']);
        for (const node of original) assert.ok(blocks.includes(node), 'node references survive');
        assert.deepEqual(columns.blocks.map(node => node.id), ['b1', 'b2']);
        assert.deepEqual(leaves.blocks.map(node => node.id), ['leaf1', 'leaf2']);
        assert.equal(blocks.length, 3);
        assert.equal(columns.blocks.length, 2);
        assert.deepEqual(state.errors, []);
    } finally {
        state.app.unmount();
    }
});

test('invalid and stale reorder results leave siblings untouched', () => {
    const first = { id: 'a', props: { text: 'current value' } };
    const second = { id: 'b' };
    const nodes = [first, second];
    for (const result of [undefined, null, [], [second], [first, undefined], [first, first], [first, { id: 'other' }], [first, second, undefined]]) {
        assert.equal(reorderNodes(nodes, result), false);
        assert.deepEqual(nodes, [first, second]);
    }
    const sparse = new Array(2);
    sparse[0] = first;
    assert.equal(reorderNodes(nodes, sparse), false);
    assert.equal(reorderNodes(nodes, [{ id: 'b' }, { id: 'a', props: { text: 'stale value' } }]), true);
    assert.equal(nodes[0], second);
    assert.equal(nodes[1], first);
    assert.equal(nodes[1].props.text, 'current value');
});

test('gap drops insert normally, body drops swap, and crossing a lock swaps with the row above the gap', () => {
    const nodes = ['a', 'b', 'c', 'd'].map(id => ({ id }));
    const ids = plan => plan?.items.map(node => node.id);
    assert.deepEqual(ids(planBlockDrop(nodes, 'a', 'd', 'before')), ['b', 'c', 'a', 'd']);
    assert.deepEqual(ids(planBlockDrop(nodes, 'a', 'c', 'swap')), ['c', 'b', 'a', 'd']);
    nodes[1].locked = true;
    assert.deepEqual(ids(planBlockDrop(nodes, 'a', 'd', 'before')), ['c', 'b', 'a', 'd']);
    assert.deepEqual(ids(planBlockDrop(nodes, 'a', 'c', 'after')), ['c', 'b', 'a', 'd']);
    assert.deepEqual(ids(planBlockDrop(nodes, 'd', 'a', 'before')), ['d', 'b', 'c', 'a']);
    assert.equal(planBlockDrop(nodes, 'a', 'b', 'swap'), null);
    assert.equal(planBlockDrop(nodes, 'b', 'd', 'before'), null);
    assert.equal(planBlockDrop(nodes, 'a', 'c', 'before'), null, 'the row above this gap is locked');
    assert.deepEqual(nodes.map(node => node.id), ['a', 'b', 'c', 'd']);
    assert.equal(reorderNodes(nodes, [nodes[1], nodes[0], nodes[2], nodes[3]]), false);
    nodes[1].locked = false;
    assert.equal(reorderNodes(nodes, [nodes[1], nodes[0], nodes[2], nodes[3]]), true);
});

test('every drop preserves all locked positions and the complete sibling permutation', () => {
    for (let mask = 0; mask < 32; mask++) {
        const nodes = ['a', 'b', 'c', 'd', 'e'].map((id, i) => ({ id, locked: !!(mask & (1 << i)) }));
        const original = [...nodes];
        for (const source of nodes) for (const target of nodes) for (const position of ['before', 'after', 'swap']) {
            const plan = planBlockDrop(nodes, source.id, target.id, position);
            assert.deepEqual(nodes, original);
            if (!plan) continue;
            assert.equal(source.locked, false);
            assert.deepEqual(plan.items.map(node => node.id).sort(), ['a', 'b', 'c', 'd', 'e']);
            nodes.forEach((node, index) => { if (node.locked) assert.equal(plan.items[index], node); });
        }
    }
});

test('native drag previews gap and swap targets, commits only on drop, and cancels safely', async () => {
    const blocks = Vue.reactive(['a', 'b', 'c', 'd'].map(id => ({ id, type: 'text', locked: id === 'b' })));
    const state = harness(blocks);
    try {
        const list = state.lists[0];
        const event = dragEvent(10);
        list.startDrag(event, blocks[0]);
        list.onDragOver(event, 'd');
        await Vue.nextTick();
        assert.equal(list.dropPosition, 'before');
        assert.equal(list.swapTarget, 'c');
        assert.equal(descendants(list.$el, 'weave-drop-line').length, 1);
        assert.deepEqual(blocks.map(node => node.id), ['a', 'b', 'c', 'd']);
        list.onDrop(event, 'd');
        assert.deepEqual(blocks.map(node => node.id), ['c', 'b', 'a', 'd']);
        assert.equal(list.dragId, null);

        list.startDrag(event, blocks[0]);
        event.clientY = 50;
        list.onDragOver(event, 'b');
        assert.equal(event.dataTransfer.dropEffect, 'none');
        list.onDrop(event, 'b');
        assert.deepEqual(blocks.map(node => node.id), ['c', 'b', 'a', 'd']);

        list.startDrag(event, blocks[0]);
        list.onDragOver(event, 'd');
        assert.equal(list.dropPosition, 'swap');
        list.resetDrag();
        list.onDrop(event, 'd');
        assert.deepEqual(blocks.map(node => node.id), ['c', 'b', 'a', 'd']);
        list.startDrag(event, blocks[1]);
        assert.equal(event.prevented, true);
        assert.equal(list.dragId, null);
        assert.deepEqual(state.errors, []);
    } finally { state.app.unmount(); }
});

test('block picker combines category and search filters and preserves the requested parent', () => {
    const state = harness([], [
        { type: 'text', label: 'Text', category: 'Content' },
        { type: 'image', label: 'Image', category: 'Media' },
        { type: 'columns', label: 'Columns', category: 'Layout' },
    ]);
    try {
        const picker = state.instance;
        picker.openAddPicker('parent');
        assert.equal(picker.pickerOpen, true);
        assert.equal(picker.selectedCategory, null);
        assert.deepEqual(Object.keys(picker.grouped), ['Content', 'Media', 'Layout']);
        picker.searchQuery = ' IMAGE ';
        assert.deepEqual(Object.keys(picker.grouped), ['Media']);
        picker.categoryTab = 'category:Content';
        assert.equal(picker.selectedCategory, 'Content');
        assert.deepEqual(Object.keys(picker.grouped), []);
        picker.searchQuery = 'content';
        assert.deepEqual(Object.keys(picker.grouped), ['Content']);
        picker.choose('text');
        assert.deepEqual({ ...state.added[0] }, { type: 'text', parentId: 'parent' });
        assert.equal(picker.pickerOpen, false);
        picker.openAddPicker(null);
        assert.equal(picker.searchQuery, '');
        assert.equal(picker.selectedCategory, null);
        assert.equal(picker.categoryTab, 'all');
        picker.choose('image');
        assert.deepEqual({ ...state.added[1] }, { type: 'image', parentId: null });
        assert.deepEqual(state.errors, []);
    } finally { state.app.unmount(); }
});
