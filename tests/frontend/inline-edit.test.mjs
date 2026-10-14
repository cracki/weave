import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import vm from 'node:vm';
import { resolveInlineScope, applyInlineEdit } from '../../resources/js/lib/inline-edit.js';
import { resolveCanvasField } from '../../resources/js/lib/canvas-target.js';

const text = (handle) => ({ handle, type: 'text', component: 'text' });
const grid = (handle, fields) => ({ handle, type: 'grid', display: handle, fields });
function fixture() {
    const fields = [text('title'), grid('links', [text('label'), grid('children', [
        text('label'), grid('children', [text('label'), { handle: 'image', type: 'assets', component: 'assets' }]),
    ])])];
    const node = { id: 'block', type: 'navigation', props: { title: 'Title', links: [
        { _id: 'parent', label: 'Same', children: [{ _id: 'child', label: 'Same', children: [
            { _id: 'deep', label: 'Same', image: ['assets::photo.jpg'] },
        ] }] },
        { _id: 'sibling', label: 'Same', children: [] },
    ] } };
    const image = { data: [{ id: 'assets::photo.jpg', title: 'Photo' }] };
    const meta = { links: { existing: {
        parent: { children: { existing: { child: { children: { existing: { deep: { image } } } } } } },
        sibling: { children: { existing: {} } },
    } } };
    return { node, fields, meta };
}

test('row identity resolves all fields and asset metadata at arbitrary depth despite identical labels', () => {
    const { node, fields, meta } = fixture();
    const scope = resolveInlineScope(node, fields, { row: 'deep', kind: 'image' }, meta);
    assert.deepEqual(scope.path, ['links', '0', 'children', '0', 'children', '0']);
    assert.deepEqual(scope.fields.map((field) => field.handle), ['label', 'image']);
    assert.equal(scope.meta.image.data[0].title, 'Photo');
    assert.equal(scope.values, node.props.links[0].children[0].children[0]);
    assert.equal(resolveInlineScope(node, fields, { row: 'missing' }, meta), null);
});

test('dotted markers and unique text resolve the deepest row; scalar targets show only their field', () => {
    const { node, fields, meta } = fixture();
    const scope = resolveInlineScope(node, fields, { field: 'links.0.children.0.children.0.image' }, meta);
    assert.equal(scope.rowId, 'deep');
    node.props.links[0].children[0].children[0].label = 'Unique';
    assert.equal(resolveInlineScope(node, fields, { texts: ['Unique'] }, meta).rowId, 'deep');
    assert.deepEqual(resolveInlineScope(node, fields, { field: 'title' }, meta).fields.map(field => field.handle), ['title']);
});

test('Done merges only the edited row after reordering, preserves IDs and siblings, and rejects deleted rows', () => {
    const { node, fields, meta } = fixture();
    const scope = resolveInlineScope(node, fields, { row: 'deep' }, meta);
    const edit = { ...scope, target: { row: scope.rowId }, values: structuredClone(scope.values), meta: structuredClone(scope.meta) };
    edit.values.label = 'Edited';
    edit.meta.image.data[0].title = 'Updated photo';
    assert.equal(node.props.links[0].children[0].children[0].label, 'Same');
    assert.equal(meta.links.existing.parent.children.existing.child.children.existing.deep.image.data[0].title, 'Photo');
    node.props.links.reverse();
    assert.equal(applyInlineEdit(node, fields, meta, edit), true);
    assert.equal(node.props.links[1].children[0].children[0].label, 'Edited');
    assert.equal(node.props.links[1].children[0].children[0]._id, 'deep');
    assert.equal(node.props.links[0].label, 'Same');
    assert.equal(node.props.title, 'Title');
    assert.equal(meta.links.existing.parent.children.existing.child.children.existing.deep.image.data[0].title, 'Updated photo');
    node.props.links[1].children[0].children = [];
    assert.equal(applyInlineEdit(node, fields, meta, edit), false);
});

test('Grid inside a grouped or legacy Replicator set resolves its own row and metadata', () => {
    for (const grouped of [true, false]) {
        const set = { fields: [grid('items', [text('label')])] };
        const fields = [{ handle: 'sets', type: 'replicator', sets: grouped ? { group: { sets: { card: set } } } : { card: set } }];
        const node = { props: { sets: [{ _id: 'set', type: 'card', items: [{ _id: 'item', label: 'Text' }] }] } };
        const meta = { sets: { existing: { set: { items: { existing: { item: { label: { test: true } } } } } } } };
        const scope = resolveInlineScope(node, fields, { row: 'item' }, meta);
        assert.deepEqual(scope.path, ['sets', '0', 'items', '0']);
        assert.equal(scope.meta.label.test, true);
    }
});

function loadFieldtype() {
    const source = readFileSync(new URL('../../resources/js/components/WeaveFieldtype.vue', import.meta.url), 'utf8');
    const script = source.match(/<script>([\s\S]*?)<\/script>/)[1]
        .replace(/^import .*;$/gm, '').replace('export default', 'globalThis.component =');
    const context = {
        Fieldtype: {}, Button: {}, BlocksPanel: {}, CanvasFrame: {}, ContextMenu: {}, PropsPanel: {}, InlineEditDialog: {},
        debounce: fn => fn, clone: structuredClone, resolveInlineScope, applyInlineEdit, resolveCanvasField,
        findNodeById: (nodes, id) => nodes.find(node => node.id === id),
    };
    vm.runInNewContext(script, context);
    return context.component;
}

test('Edit Here keeps panel selection and visibility unchanged and stages values until Done', async () => {
    const component = loadFieldtype();
    const { node, fields, meta } = fixture();
    const receiver = {
        ...component.methods, blocks: [node], blockTypesMeta: [{ type: node.type, label: 'Navigation', fields }],
        nodeMeta: { block: meta }, inlineEditRequest: 0, fullScreenMode: true,
        selectedBlockId: 'other', propsPanelOpen: false, inlineEdit: null,
        contextMenu: { id: 'block', target: { row: 'deep' } }, fetchNodeMeta: () => {},
    };
    component.methods.onContextAction.call(receiver, 'edit-here');
    assert.equal(receiver.selectedBlockId, 'other');
    assert.equal(receiver.propsPanelOpen, false);
    receiver.inlineEdit.values.label = 'New value';
    assert.equal(node.props.links[0].children[0].children[0].label, 'Same');
    receiver.inlineEdit = null; // Cancel discards the entire isolated draft.
    await receiver.openInlineEdit('block', { row: 'deep' });
    assert.equal(receiver.inlineEdit.values.label, 'Same');
    receiver.inlineEdit.values.label = 'Done value';
    receiver.commitInlineEdit(receiver.inlineEdit);
    assert.equal(node.props.links[0].children[0].children[0].label, 'Done value');
    assert.equal(receiver.inlineEdit, null);
    assert.equal(receiver.propsPanelOpen, false);
});

test('pending metadata requests cannot reopen the editor after fullscreen closes', async () => {
    const component = loadFieldtype();
    const { node, fields } = fixture();
    let finish;
    const receiver = {
        ...component.methods, blocks: [node], blockTypesMeta: [{ type: node.type, fields }],
        nodeMeta: {}, inlineEditRequest: 0, fullScreenMode: true, inlineEdit: null,
        fetchNodeMeta: () => new Promise(resolve => { finish = resolve; }),
    };
    const pending = receiver.openInlineEdit('block', { row: 'deep' });
    receiver.fullScreenMode = false;
    finish();
    await pending;
    assert.equal(receiver.inlineEdit, null);
});
