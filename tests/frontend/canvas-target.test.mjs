import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import vm from 'node:vm';
import { resolveCanvasField } from '../../resources/js/lib/canvas-target.js';

function loadComponent(file, dependencies = {}) {
    const source = readFileSync(new URL(`../../resources/js/components/${file}`, import.meta.url), 'utf8');
    const script = source.match(/<script>([\s\S]*?)<\/script>/)[1]
        .replace(/^import .*;$/gm, '').replace('export default', 'globalThis.component =');
    const context = { ...dependencies };
    vm.runInNewContext(script, context);
    return context.component;
}

const fields = (...handles) => handles.map((handle) => ({ handle }));

test('Hero heading and button labels resolve to their owning fields', () => {
    const node = { type: 'hero', props: { lines: ['Welcome', 'Explore'], buttons: [{ _id: 'row', label: 'Read more' }] } };
    const config = fields('lines', 'background', 'buttons');
    assert.equal(resolveCanvasField(node, config, { kind: 'heading', texts: ['Explore'] }), 'lines');
    assert.equal(resolveCanvasField(node, config, { kind: 'button', texts: ['Read more'] }), 'buttons');
    assert.equal(resolveCanvasField(node, config, { kind: 'button', texts: [] }), 'buttons');
});

test('custom title spans resolve separately and whitespace is normalized', () => {
    const node = { type: 'custom_hero', props: { title: 'First line', title_line_2: 'Second line' } };
    assert.equal(resolveCanvasField(node, fields('title', 'title_line_2'), {
        kind: 'heading', texts: ['  Second\n  line  ', 'First line Second line'],
    }), 'title_line_2');
});

test('explicit markers override text matches and validate field handles', () => {
    const node = { type: 'hero', props: { title: 'Same', buttons: [{ label: 'Same' }] } };
    const config = fields('title', 'buttons');
    assert.equal(resolveCanvasField(node, config, { field: 'buttons.0.label', texts: ['Same'] }), 'buttons');
    assert.equal(resolveCanvasField(node, config, { field: 'missing', kind: 'heading', texts: ['Same'] }), 'title');
});

test('unknown markup does not jump to an unrelated field', () => {
    assert.equal(resolveCanvasField({ type: 'custom', props: {} }, fields('label'), { texts: ['Other'] }), null);
    assert.equal(resolveCanvasField({ type: 'heading', props: {} }, fields('unrelated')), null);
});

test('nested canvas targets retain the child block and reject ancestor field markers', () => {
    const blade = readFileSync(new URL('../../resources/views/components/render.blade.php', import.meta.url), 'utf8');
    const listener = blade.match(/document\.addEventListener\('contextmenu', function \(e\) \{[\s\S]*?\n        \}\);/)[0];
    let handler, message;
    vm.runInNewContext(listener, {
        document: { addEventListener: (_, callback) => { handler = callback; } },
        parent: { postMessage: (value) => { message = value; } },
    });
    const ancestor = { closest: () => ancestor, getAttribute: () => 'parent_title' };
    const block = { getAttribute: () => 'child' };
    const heading = { tagName: 'H2', textContent: 'Child title', closest: () => block, parentElement: block };
    const span = {
        textContent: 'Child title', parentElement: heading,
        closest: (selector) => selector === '[data-weave-id]' ? block
            : selector.startsWith('[data-weave-field]') ? ancestor : selector === '[data-weave-row]' ? null : heading,
    };
    handler({ target: span, preventDefault() {}, clientX: 30, clientY: 40 });
    assert.equal(message.id, 'child');
    assert.equal(message.target.field, null);
    assert.equal(message.target.kind, 'heading');
    assert.deepEqual(Array.from(message.target.texts), ['Child title']);
});

test('Canvas forwards field context only from its own iframe', () => {
    const source = readFileSync(new URL('../../resources/js/components/Canvas.vue', import.meta.url), 'utf8');
    const script = source.match(/<script>([\s\S]*?)<\/script>/)[1]
        .replace(/^import .*;$/gm, '').replace('export default', 'globalThis.component =');
    const context = { debounce: (fn) => fn, PATCHABLE_KEYS: [], INLINE_EDITED_KEYS: [] };
    vm.runInNewContext(script, context);
    const frameWindow = {};
    const events = [];
    const receiver = {
        $refs: { frame: { contentWindow: frameWindow, getBoundingClientRect: () => ({ left: 10, top: 20 }) } },
        $emit: (...args) => events.push(args),
    };
    const data = { type: 'block:contextmenu', id: 'hero', target: { kind: 'heading' }, x: 30, y: 40 };
    context.component.methods.onMessage.call(receiver, { source: {}, data });
    assert.equal(events.length, 0);
    context.component.methods.onMessage.call(receiver, { source: frameWindow, data });
    assert.equal(events[0][0], 'contextmenu');
    assert.equal(events[0][1].target.kind, 'heading');
    assert.equal(events[0][1].x, 40);
    assert.equal(events[0][1].y, 60);
});

test('Edit selects the right-clicked block and reopens its properties panel', () => {
    const component = loadComponent('WeaveFieldtype.vue', {
        Fieldtype: {}, Button: {}, BlocksPanel: {}, CanvasFrame: {}, ContextMenu: {}, PropsPanel: {}, InlineEditDialog: {},
        debounce: (fn) => fn, resolveCanvasField,
        findNodeById: (nodes, id) => nodes.find((node) => node.id === id),
    });
    const receiver = {
        blocks: [{ id: 'other', type: 'hero', props: { lines: ['Other'] } }, { id: 'clicked', type: 'hero', props: { lines: ['Clicked'] } }],
        blockTypesMeta: [{ type: 'hero', fields: fields('lines', 'buttons') }],
        selectedBlockId: 'other', propsPanelOpen: false,
        contextMenu: { id: 'clicked', target: { kind: 'heading', texts: ['Clicked'] } },
    };
    component.methods.onContextAction.call(receiver, 'edit');
    assert.equal(receiver.selectedBlockId, 'clicked');
    assert.equal(receiver.propsPanelOpen, true);
    assert.equal(receiver.fieldFocusTarget.field, 'lines');
    assert.equal(receiver.fieldFocusTarget.id, 'clicked');
    assert.equal(receiver.contextMenu, null);
    const previous = receiver.fieldFocusTarget;
    receiver.contextMenu = { id: 'clicked', target: { kind: 'heading' } };
    component.methods.onContextAction.call(receiver, 'edit');
    assert.notEqual(receiver.fieldFocusTarget, previous);
});

test('field navigation expands its section, focuses without scrolling, then scrolls the panel', async () => {
    const component = loadComponent('PropsPanel.vue', {
        Button: {}, Card: {}, Icon: {}, BoxModelControl: {}, NodeContainer: {}, PropField: {},
        window: { matchMedia: () => ({ matches: true }) },
    });
    let focusOptions, scrollOptions;
    const panel = { scrollTop: 30, getBoundingClientRect: () => ({ top: 10 }), scrollTo: (options) => { scrollOptions = options; } };
    const field = {
        dataset: { weaveField: 'font_size' }, getBoundingClientRect: () => ({ top: 510 }),
        querySelector: () => ({ focus: (options) => { focusOptions = options; } }),
    };
    const receiver = {
        styleSections: [{ title: 'Typography', fields: fields('font_size') }], groups: [],
        sectionCollapsed: { Typography: true }, focusTarget: { field: 'font_size' },
        $el: {
            closest: () => panel, querySelectorAll: () => [field],
            querySelector: () => ({ getBoundingClientRect: () => ({ height: 56 }) }),
        },
        $nextTick: async () => { assert.equal(receiver.sectionCollapsed.Typography, false); },
    };
    await component.methods.focusField.call(receiver, 'font_size');
    assert.equal(focusOptions.preventScroll, true);
    assert.equal(scrollOptions.top, 462);
    assert.equal(scrollOptions.behavior, 'instant');
});
