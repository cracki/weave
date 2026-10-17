<template>
    <div class="weave-repeater-rows" :data-layout="layout">
        <div class="weave-repeater-detail">
            <p v-if="!rows.length" class="weave-repeater-empty">{{ __('No rows yet') }}</p>
            <SortableList
                :model-value="rows"
                vertical
                :item-class="sortableItemClass"
                :handle-class="sortableHandleClass"
                :disabled="layout === 'split' || !grid.isReorderable"
                append-to="body"
                constrain-dimensions
                @update:model-value="$emit('sorted', $event)"
                @dragstart="$emit('focus')"
                @dragend="$emit('blur')"
            >
                <div class="weave-repeater-cards">
                    <section
                        v-for="(row, index) in rows"
                        v-show="layout === 'accordion' || activeId === row._id"
                        :key="row._id"
                        :class="[sortableItemClass, 'weave-repeater-row', { 'has-error': rowHasError(row._id), 'is-excessive': grid.config.max_rows && index >= grid.config.max_rows }]"
                        :data-error="rowHasError(row._id) || undefined"
                    >
                        <header class="weave-repeater-row-header">
                            <DragHandle v-if="layout === 'accordion' && grid.isReorderable" :class="sortableHandleClass" />
                            <button
                                type="button"
                                class="weave-repeater-row-disclosure"
                                :aria-expanded="activeId === row._id"
                                :aria-controls="`${row._id}-weave-fields`"
                                @click="toggleRow(row._id)"
                            >
                                <Icon v-if="layout === 'accordion'" :name="activeId === row._id ? 'chevron-down' : 'chevron-right'" class="weave-disclosure-icon size-3" :class="{ 'is-collapsed': activeId !== row._id }" />
                                <span dir="auto" class="weave-repeater-row-title">{{ rowTitle(row, index) }}</span>
                                <span class="weave-repeater-number">{{ index + 1 }}</span>
                                <Icon v-if="rowHasError(row._id)" name="warning-diamond" class="size-4" :aria-label="__('Validation errors')" />
                            </button>
                            <div class="weave-repeater-row-actions">
                                <Button v-if="grid.isReorderable" v-tooltip="__('Move up')" :aria-label="__('Move up')" icon="chevron-up" icon-only size="sm" variant="ghost" :disabled="index === 0" @click="moveRow(index, -1)" />
                                <Button v-if="grid.isReorderable" v-tooltip="__('Move down')" :aria-label="__('Move down')" icon="chevron-down" icon-only size="sm" variant="ghost" :disabled="index === rows.length - 1" @click="moveRow(index, 1)" />
                                <Button v-if="canAddRows" v-tooltip="__('Duplicate Row')" :aria-label="__('Duplicate Row')" icon="duplicate" icon-only size="sm" variant="ghost" @click="$emit('duplicate', index)" />
                                <Button v-if="canDeleteRows" v-tooltip="__('Delete Row')" :aria-label="__('Delete Row')" icon="trash" icon-only size="sm" variant="ghost" @click="$emit('removed', index)" />
                            </div>
                        </header>
                        <div v-show="activeId === row._id" :id="`${row._id}-weave-fields`" class="weave-repeater-row-fields @container/panel">
                            <PublishFieldsProvider
                                :fields="fields"
                                :as-config="false"
                                :read-only="readOnly"
                                :field-path-prefix="`${fieldPathPrefix}.${index}`"
                                :meta-path-prefix="`${metaPathPrefix}.existing.${row._id}`"
                            >
                                <PublishFields />
                            </PublishFieldsProvider>
                        </div>
                    </section>
                </div>
            </SortableList>
            <Button v-if="canAddRows && layout === 'accordion'" class="weave-repeater-add" icon="plus" :text="__(grid.config.add_row || 'Add Row')" @click="actions.addRow()" />
        </div>

        <aside v-if="layout === 'split'" class="weave-repeater-list" :aria-label="__('Rows')">
            <div class="weave-repeater-search">
                <Icon name="magnifying-glass" class="size-4" aria-hidden="true" />
                <input v-model="query" type="search" dir="auto" :placeholder="__('Search rows…')" :aria-label="__('Search rows')" />
            </div>
            <SortableList
                :model-value="rows"
                vertical
                :item-class="sortableItemClass"
                :handle-class="sortableHandleClass"
                :disabled="!grid.isReorderable || !!query"
                append-to="body"
                constrain-dimensions
                @update:model-value="$emit('sorted', $event)"
                @dragstart="$emit('focus')"
                @dragend="$emit('blur')"
            >
                <div class="weave-repeater-list-items">
                    <div
                        v-for="(row, index) in rows"
                        v-show="matchesSearch(row)"
                        :key="row._id"
                        :class="[sortableItemClass, 'weave-repeater-list-item', { 'is-selected': activeId === row._id, 'has-error': rowHasError(row._id) }]"
                    >
                        <DragHandle v-if="grid.isReorderable && !query" :class="sortableHandleClass" />
                        <button type="button" class="weave-repeater-select" :aria-pressed="activeId === row._id" @click="selectRow(row._id)">
                            <span class="weave-repeater-list-copy">
                                <span dir="auto" class="weave-repeater-row-title">{{ rowTitle(row, index) }}</span>
                                <span v-if="rowDescription(row)" dir="auto" class="weave-repeater-row-description">{{ rowDescription(row) }}</span>
                            </span>
                            <span class="weave-repeater-number">{{ index + 1 }}</span>
                            <Icon v-if="rowHasError(row._id)" name="warning-diamond" class="size-4" :aria-label="__('Validation errors')" />
                        </button>
                    </div>
                </div>
            </SortableList>
            <p v-if="rows.length && !visibleRows.length" class="weave-repeater-empty" role="status">{{ __('No matching rows') }}</p>
            <Button v-if="canAddRows" class="weave-repeater-add" icon="plus" :text="__(grid.config.add_row || 'Add Row')" @click="actions.addRow()" />
        </aside>
    </div>
</template>

<script>
import { SortableList } from '@statamic/cms';
import { Button, DragHandle, Icon, PublishFields, PublishFieldsProvider } from '@statamic/cms/ui';
import { repeaterLayout } from '../lib/repeater-layout';

// The native GridStacked view is supplied as `extends` by ModalGridFieldtype.
// It retains Statamic's row props, scoped paths, validation and Grid injection.
export default {
    components: { Button, DragHandle, Icon, PublishFields, PublishFieldsProvider, SortableList },
    inject: { actions: { from: 'weaveRepeaterActions' } },
    emits: ['sorted', 'duplicate', 'removed', 'focus', 'blur'],

    setup() {
        return { layout: repeaterLayout };
    },

    data() {
        return { activeId: this.rows[0]?._id ?? null, query: '' };
    },

    computed: {
        visibleRows() {
            return this.rows.filter(this.matchesSearch);
        },
        rowIds() {
            return this.rows.map((row) => row._id);
        },
        summaryFields() {
            const fields = this.fields.filter((field) => ['text', 'textarea', 'slug', 'integer', 'float'].includes(field.type)
                && field.visibility !== 'hidden' && field.input_type !== 'password' && field.replicator_preview !== false
                && !field.if && !field.unless && !field.if_any && !field.unless_any);
            const title = fields.find((field) => ['title', 'name', 'label', 'heading'].includes(field.handle));
            return title ? [title, ...fields.filter((field) => field !== title)] : fields;
        },
    },

    watch: {
        rowIds(ids, previous) {
            const added = ids.find((id) => !previous.includes(id));
            if (added) {
                this.query = '';
                this.activeId = added;
            } else if (this.activeId && !ids.includes(this.activeId)) {
                this.activeId = ids[Math.min(Math.max(previous.indexOf(this.activeId), 0), ids.length - 1)] ?? null;
            }
        },
        query() {
            if (!this.visibleRows.some((row) => row._id === this.activeId)) this.activeId = this.visibleRows[0]?._id ?? null;
        },
        layout(value) {
            if (value !== 'split') return;
            if (this.activeId && !this.visibleRows.some((row) => row._id === this.activeId)) this.query = '';
            if (!this.activeId) this.activeId = this.visibleRows[0]?._id ?? null;
        },
        errorsById: {
            immediate: true,
            deep: true,
            handler() {
                const row = this.rows.find((row) => this.rowHasError(row._id));
                if (row) { this.query = ''; this.activeId = row._id; }
            },
        },
    },

    methods: {
        summaryValues(row) {
            return this.summaryFields.map((field) => row[field.handle])
                .filter((value) => (typeof value === 'string' || typeof value === 'number') && String(value).trim());
        },
        rowTitle(row, index) {
            return this.summaryValues(row)[0] ?? `${this.__('Row')} ${index + 1}`;
        },
        rowDescription(row) {
            return this.summaryValues(row).slice(1).join(' · ');
        },
        matchesSearch(row) {
            const index = this.rows.indexOf(row);
            return `${this.rowTitle(row, index)} ${this.rowDescription(row)}`.toLocaleLowerCase().includes(this.query.trim().toLocaleLowerCase());
        },
        selectRow(id) { this.activeId = id; },
        toggleRow(id) { this.activeId = this.layout === 'accordion' && this.activeId === id ? null : id; },
        moveRow(index, offset) {
            if (!this.grid.isReorderable || index + offset < 0 || index + offset >= this.rows.length) return;
            const rows = [...this.rows];
            [rows[index], rows[index + offset]] = [rows[index + offset], rows[index]];
            this.$emit('sorted', rows);
        },
    },
};
</script>

<style>
.weave-repeater-rows {
    --weave-repeater-border: var(--color-gray-200, #e4e4e7);
    --weave-repeater-muted: var(--color-gray-500, #71717a);
    --weave-repeater-subtle: var(--color-gray-50, #fafafa);
    --weave-repeater-selected: var(--color-gray-100, #f4f4f5);
    display: grid;
    min-width: 0;
    gap: 20px;
}

.weave-repeater-rows[data-layout="split"] { grid-template-columns: minmax(0, 1fr) minmax(13rem, 30%); height: min(56vh, 42rem); min-height: 16rem; }
.weave-repeater-list { display: flex; flex-direction: column; min-width: 0; min-height: 0; padding-inline-start: 20px; border-inline-start: 1px solid var(--weave-repeater-border); }
.weave-repeater-list > .weave-repeater-list-items { flex: 1; min-height: 0; overflow: auto; align-content: start; }
.weave-repeater-list > .weave-repeater-add, .weave-repeater-search { flex-shrink: 0; }
.weave-repeater-rows[data-layout="split"] > .weave-repeater-detail { min-height: 0; overflow: auto; overscroll-behavior: contain; }
.weave-repeater-search { display: flex; align-items: center; gap: 8px; padding: 8px 10px; margin-bottom: 12px; border: 1px solid var(--weave-repeater-border); border-radius: 6px; }
.weave-repeater-search input { width: 100%; min-width: 0; border: 0; padding: 0; background: transparent; font: inherit; font-size: 12px; outline: none; }
.weave-repeater-search:focus-within { outline: 2px solid var(--color-blue-500, #3b82f6); outline-offset: 2px; }
.weave-repeater-list-items, .weave-repeater-cards { display: grid; gap: 8px; }
.weave-repeater-list-item { display: flex; align-items: center; gap: 8px; padding-inline-start: 8px; border: 1px solid var(--weave-repeater-border); border-radius: 6px; }
.weave-repeater-list-item.is-selected { background: var(--weave-repeater-selected); border-color: currentColor; }
.weave-repeater-select { display: flex; align-items: center; gap: 8px; flex: 1; min-width: 0; padding: 12px 8px; cursor: pointer; text-align: start; }
.weave-repeater-list-copy { display: grid; flex: 1; min-width: 0; gap: 4px; }
.weave-repeater-row-title { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; font-size: 13px; font-weight: 600; }
.weave-repeater-row-description { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; font-size: 12px; color: var(--weave-repeater-muted); }
.weave-repeater-number { flex-shrink: 0; font-size: 12px; font-variant-numeric: tabular-nums; color: var(--weave-repeater-muted); }
.weave-repeater-detail { min-width: 0; }
.weave-repeater-row { min-width: 0; border: 1px solid var(--weave-repeater-border); border-radius: 8px; }
.weave-repeater-row-header { display: flex; align-items: center; gap: 8px; padding: 8px 12px; background: var(--weave-repeater-subtle); border-radius: 8px; }
.weave-repeater-row-disclosure { display: flex; align-items: center; gap: 8px; flex: 1; min-width: 0; text-align: start; cursor: pointer; }
.weave-repeater-row-actions { display: flex; flex-shrink: 0; align-items: center; gap: 2px; }
.weave-repeater-row-fields { min-width: 0; padding: 16px; border-top: 1px solid var(--weave-repeater-border); }
.weave-repeater-add { width: 100%; margin-top: 12px; }
.weave-repeater-empty { padding: 20px 8px; text-align: center; font-size: 13px; color: var(--weave-repeater-muted); }
.weave-repeater-rows .has-error { border-color: var(--color-red-500, #ef4444); }
.weave-repeater-row.is-excessive { opacity: .5; }
.weave-repeater-select:focus-visible, .weave-repeater-row-disclosure:focus-visible { outline: 2px solid var(--color-blue-500, #3b82f6); outline-offset: 2px; border-radius: 4px; }
.dark .weave-repeater-rows {
    --weave-repeater-border: var(--color-gray-700, #3f3f46);
    --weave-repeater-muted: var(--color-gray-400, #a1a1aa);
    --weave-repeater-subtle: var(--color-gray-900, #18181b);
    --weave-repeater-selected: var(--color-gray-800, #27272a);
}

@media (max-width: 700px) {
    .weave-repeater-rows[data-layout="split"] { grid-template-columns: minmax(0, 1fr); height: auto; min-height: 0; }
    .weave-repeater-list { padding-inline-start: 0; padding-top: 16px; border-inline-start: 0; border-top: 1px solid var(--weave-repeater-border); }
    .weave-repeater-list-items { max-height: 12rem; overflow: auto; }
    .weave-repeater-row-header { flex-wrap: wrap; }
    .weave-repeater-row-actions { margin-inline-start: auto; }
}
</style>
