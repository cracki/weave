import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import vm from 'node:vm';
import * as Vue from 'vue';
import { compile } from '@vue/compiler-dom';
import { renderToString } from '@vue/server-renderer';
import { inlineDialogFields } from '../../resources/js/lib/inline-fields.js';

test('dialog text controls grow without changing field types, validation, conditions, or other editors', () => {
    const fields = [
        { handle: 'title', type: 'text', component: 'text', width: 50, character_limit: 200, if: { enabled: 'equals true' } },
        { handle: 'description', type: 'textarea', component: 'textarea', rows: 4 },
        { handle: 'secret', type: 'text', input_type: 'password' },
        { handle: 'special', type: 'text', component: 'custom-text' },
        { handle: 'rows', type: 'grid', fields: [{ handle: 'label', type: 'text', width: 50 }] },
        { handle: 'image', type: 'assets', component: 'assets' },
    ];
    const original = structuredClone(fields);
    const result = inlineDialogFields(fields);
    assert.equal(result[0].component, 'weave-elastic-text');
    assert.equal(result[0].type, 'text');
    assert.equal(result[0].character_limit, 200);
    assert.deepEqual(result[0].if, fields[0].if);
    assert.equal(result[0].width, 100);
    assert.equal(result[1].component, 'weave-elastic-text');
    assert.equal(result[1].rows, 4);
    assert.equal(result[2].component, undefined);
    assert.equal(result[3].component, 'custom-text');
    assert.equal(result[4].component, 'weave-modal-grid');
    assert.equal(result[4].fields[0].component, 'weave-elastic-text');
    assert.equal(result[4].fields[0].width, 50);
    assert.equal(result[5].component, 'assets');
    assert.deepEqual(fields, original);
});

test('elastic controls use automatic direction, preserve read-only and limits, and emit edits immediately for Done', async () => {
    let control;
    const events = [];
    const source = readFileSync(new URL('../../resources/js/components/ElasticTextFieldtype.vue', import.meta.url), 'utf8');
    const context = {
        Fieldtype: { mixin: {
            props: ['value', 'config', 'id', 'handle', 'readOnly'],
            computed: { fieldId() { return this.id; }, name() { return this.handle; }, isReadOnly() { return this.readOnly; } },
            methods: { update(value) { this.$emit('update:value', value); } },
        } },
        Textarea: { render() { control = this.$attrs; return Vue.h('textarea', this.$attrs); } },
    };
    const script = source.match(/<script>([\s\S]*?)<\/script>/)[1]
        .replace(/^import .*;$/gm, '').replace('export default', 'globalThis.component =');
    vm.runInNewContext(script, context);
    const template = source.match(/<template>([\s\S]*)<\/template>/)[1];
    context.component.render = new Function('Vue', compile(template, { mode: 'function', prefixIdentifiers: true }).code)(Vue);
    const app = Vue.createSSRApp(context.component, {
        value: 'عنوان فارسی طولانی', handle: 'title', id: 'title-input', readOnly: true,
        config: { type: 'text', character_limit: 200 }, 'onUpdate:value': value => events.push(value),
    });
    app.config.globalProperties.__ = value => value;
    await renderToString(app);
    assert.equal(control.elastic, '');
    assert.equal(control.rows, 1);
    assert.equal(control.resize, 'none');
    assert.equal(control.dir, 'auto');
    assert.equal(control['read-only'], true);
    assert.equal(control.limit, 200);
    assert.equal(control.id, 'title-input');
    control['onUpdate:modelValue']('عنوان جدید');
    assert.deepEqual(events, ['عنوان جدید']);
});
