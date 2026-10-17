<template>
    <div class="weave-repeater-summary">
        <div class="flex items-center justify-between gap-2">
            <span class="text-sm font-medium">{{ __(config.display || handle) }}<span v-if="config.required" aria-hidden="true"> *</span></span>
            <div class="flex items-center gap-1">
                <Button
                    v-tooltip="__('Add Row')"
                    :aria-label="__('Add Row')"
                    icon="plus"
                    icon-only
                    size="sm"
                    variant="default"
                    :disabled="!canAddRows"
                    @click="openRows(true)"
                />
                <Button
                    v-tooltip="__('Manage rows')"
                    :aria-label="__('Manage rows')"
                    icon="sliders-horizontal"
                    icon-only
                    size="sm"
                    variant="default"
                    @click="openRows()"
                />
            </div>
        </div>
        <p class="mt-1 text-xs text-gray-500 dark:text-gray-400">
            {{ __n(':count row|:count rows', value?.length || 0) }}
        </p>
        <Modal
            v-model:open="rowsOpen"
            class="weave-repeater-modal"
            @opened="addPendingRow"
        >
            <div class="weave-repeater-header">
                <div class="weave-repeater-toolbar-start">
                    <Button
                        v-tooltip="__('Add Row')"
                        :aria-label="__('Add Row')"
                        icon="plus"
                        icon-only
                        size="sm"
                        variant="primary"
                        :disabled="!canAddRows"
                        @click="addRow"
                    />
                    <ModalTitle class="text-sm font-semibold">{{ __(config.display || handle) }}</ModalTitle>
                </div>
                <div class="flex items-center gap-2">
                    <div
                        class="weave-repeater-layouts"
                        role="radiogroup"
                        :aria-label="__('Repeater layout')"
                        :style="{ '--weave-repeater-active-layout': layout === 'split' ? 0 : 1 }"
                        @keydown="onLayoutKeydown"
                    >
                        <span class="weave-repeater-layout-indicator" aria-hidden="true" />
                        <button
                            v-for="preset in layoutPresets"
                            :key="preset.key"
                            v-tooltip="__(preset.label)"
                            type="button"
                            role="radio"
                            :aria-label="__(preset.label)"
                            :aria-checked="layout === preset.key"
                            :tabindex="layout === preset.key ? 0 : -1"
                            class="weave-repeater-layout"
                            @click="setLayout(preset.key)"
                        >
                            <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.5" aria-hidden="true">
                                <rect x="2.5" y="3.5" width="15" height="13" rx="1.5" />
                                <path :d="preset.key === 'split' ? 'M8 3.5v13M4.5 7h1.5M4.5 10h1.5M4.5 13h1.5' : 'M2.5 7.5h15M2.5 12.5h15'" />
                            </svg>
                        </button>
                    </div>
                    <Button
                        v-tooltip="__('Close')"
                        :aria-label="__('Close')"
                        icon="x"
                        icon-only
                        size="sm"
                        variant="default"
                        @click="rowsOpen = false"
                    />
                </div>
            </div>
            <div v-auto-direction class="weave-scroll weave-repeater-editor">
                <component
                    :is="gridComponent"
                    ref="grid"
                    v-bind="$props"
                    :config="editorConfig"
                    @update:value="update"
                    @update:meta="updateMeta"
                    @focus="$emit('focus')"
                    @blur="$emit('blur')"
                    @replicator-preview-updated="$emit('replicator-preview-updated', $event)"
                />
            </div>
            <template #footer>
                <div class="weave-repeater-footer">
                    <Button :text="__('Done')" variant="primary" @click="rowsOpen = false" />
                </div>
            </template>
        </Modal>
    </div>
</template>

<script>
import { Fieldtype } from '@statamic/cms';
import { Button, Modal, ModalTitle } from '@statamic/cms/ui';
import { markRaw, resolveComponent } from 'vue';
import autoDirection from '../directives/auto-direction';
import RepeaterRows from './RepeaterRows.vue';
import { repeaterLayout, setRepeaterLayout } from '../lib/repeater-layout';

// Extend the registered native Grid locally; other Statamic Grid fields keep
// their own views. Native Grid still owns values, metadata and row actions.
export default {
    directives: { autoDirection },
    mixins: [Fieldtype.mixin],

    components: { Button, Modal, ModalTitle },

    setup() {
        const nativeGrid = resolveComponent('grid-fieldtype');
        const gridComponent = markRaw({
            extends: nativeGrid,
            components: {
                GridStacked: { extends: nativeGrid.components.GridStacked, ...RepeaterRows },
            },
        });
        return { gridComponent, layout: repeaterLayout, setLayout: setRepeaterLayout };
    },

    provide() {
        return { weaveRepeaterActions: { addRow: () => this.addRow() } };
    },

    data() {
        return {
            rowsOpen: false,
            pendingAdd: false,
            layoutPresets: [
                { key: 'split', label: 'Two-column repeater layout' },
                { key: 'accordion', label: 'Compact accordion repeater layout' },
            ],
        };
    },

    computed: {
        editorConfig() {
            return { ...this.config, component: 'grid', mode: 'stacked', fullscreen: false };
        },

        canAddRows() {
            return !this.isReadOnly && (this.value?.length || 0) < (this.config.max_rows || Infinity);
        },

        replicatorPreview() {
            if (this.showFieldPreviews) return `${__(this.config.display || this.handle)}: ${__n(':count row|:count rows', this.value?.length || 0)}`;
        },
    },

    methods: {
        onLayoutKeydown(event) {
            if (!['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'Home', 'End'].includes(event.key)) return;
            event.preventDefault();
            const index = event.key === 'Home' ? 0 : event.key === 'End' ? 1 : this.layout === 'split' ? 1 : 0;
            this.setLayout(this.layoutPresets[index].key);
            event.currentTarget.querySelectorAll('[role="radio"]')[index].focus();
        },

        openRows(add = false) {
            if (add && !this.canAddRows) return;
            this.pendingAdd = add;
            this.rowsOpen = true;
        },

        async addPendingRow() {
            await this.$nextTick();
            if (this.pendingAdd) this.addRow();
            this.pendingAdd = false;
        },

        addRow() {
            const grid = this.$refs.grid;
            if (this.canAddRows && grid?.canAddRows) grid.addRow();
        },
    },
};
</script>

<style>
.weave-repeater-modal {
    width: min(64rem, calc(100vw - 2rem));
    max-width: 64rem;
    max-height: 84vh;
    top: 8vh;
    padding: 0;
    display: flex;
    flex-direction: column;
    overflow: hidden;
    background: var(--color-white, #fff);
}

/* Modal's default inner card is replaced with one continuous dialog surface. */
.weave-repeater-modal > div:first-child {
    display: flex;
    flex-direction: column;
    min-height: 0;
    max-height: none;
    padding: 0;
    overflow: hidden;
    border: 0;
    border-radius: 0;
    background: transparent;
    box-shadow: none;
}

.weave-repeater-modal > div:first-child > * {
    margin-block: 0;
}

.weave-repeater-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 16px;
    padding: 16px 20px;
    flex-shrink: 0;
    border-bottom: 1px solid var(--color-gray-200, #e4e4e7);
}

.weave-repeater-toolbar-start { display: flex; align-items: center; gap: 12px; min-width: 0; }
.weave-repeater-toolbar-start h2 { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.weave-repeater-layouts {
    --weave-repeater-tab-sign: 1;
    position: relative;
    display: flex;
    flex-shrink: 0;
    gap: 4px;
    padding: 3px;
    border-radius: 6px;
    background: var(--color-gray-100, #f4f4f5);
}
.weave-repeater-layouts:dir(rtl) { --weave-repeater-tab-sign: -1; }
.weave-repeater-layout-indicator {
    position: absolute;
    top: 3px;
    inset-inline-start: 3px;
    width: 28px;
    height: 28px;
    border-radius: 4px;
    background: var(--color-white, #fff);
    box-shadow: 0 1px 3px rgb(0 0 0 / 12%);
    pointer-events: none;
    transform: translateX(calc(var(--weave-repeater-active-layout) * 32px * var(--weave-repeater-tab-sign)));
    transition: transform 280ms cubic-bezier(0.22, 1, 0.36, 1);
}
.weave-repeater-layout { position: relative; display: grid; place-items: center; width: 28px; height: 28px; border-radius: 4px; color: var(--color-gray-600, #52525b); cursor: pointer; }
.weave-repeater-layout svg { width: 20px; height: 20px; transform: scaleX(var(--weave-repeater-tab-sign)); }
.weave-repeater-layout:not([aria-checked="true"]):hover { background: var(--color-gray-200, #e4e4e7); }
.weave-repeater-layout[aria-checked="true"] { color: var(--color-gray-900, #18181b); }
.weave-repeater-layout:focus-visible { outline: 2px solid var(--color-blue-500, #3b82f6); outline-offset: 2px; }
.dark .weave-repeater-layouts { background: var(--color-gray-900, #18181b); }
.dark .weave-repeater-layout-indicator { background: var(--color-gray-850, #202025); }
.dark .weave-repeater-layout { color: var(--color-gray-300, #d4d4d8); }
.dark .weave-repeater-layout:not([aria-checked="true"]):hover { background: var(--color-gray-700, #3f3f46); }
.dark .weave-repeater-layout[aria-checked="true"] { color: var(--color-white, #fff); }
@media (prefers-reduced-motion: reduce) { .weave-repeater-layout-indicator { transition: none; } }

.weave-repeater-editor {
    padding: 20px;
    min-height: 0;
    overflow: auto;
    overscroll-behavior: contain;
}

.weave-repeater-footer {
    display: flex;
    justify-content: flex-end;
    flex-shrink: 0;
    padding: 16px 20px;
    border-top: 1px solid var(--color-gray-200, #e4e4e7);
}

.dark .weave-repeater-modal {
    background: var(--color-gray-850, #202024);
}

.dark .weave-repeater-header,
.dark .weave-repeater-footer {
    border-color: var(--color-gray-700, #3f3f46);
}

/* Each modal toolbar replaces its native Grid Add Row button. Nested grids
   render their own summary and modal through the same fieldtype. */
.weave-repeater-editor > .vue-portal-target > div > section > button:last-child {
    display: none;
}
</style>
