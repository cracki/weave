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
                <div class="flex items-center gap-2">
                    <ModalTitle class="text-sm font-semibold">{{ __(config.display || handle) }}</ModalTitle>
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
                <grid-fieldtype
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
import autoDirection from '../directives/auto-direction';

// Native Grid owns row values, metadata, and row actions. This wrapper only
// changes where it renders. PublishField supplies the same scoped paths at
// every depth, including when this component lives inside another modal.
export default {
    directives: { autoDirection },
    mixins: [Fieldtype.mixin],

    components: { Button, Modal, ModalTitle },

    data() {
        return { rowsOpen: false, pendingAdd: false };
    },

    computed: {
        editorConfig() {
            return { ...this.config, component: 'grid', fullscreen: false };
        },

        canAddRows() {
            return !this.isReadOnly && (this.value?.length || 0) < (this.config.max_rows || Infinity);
        },

        replicatorPreview() {
            if (this.showFieldPreviews) return `${__(this.config.display || this.handle)}: ${__n(':count row|:count rows', this.value?.length || 0)}`;
        },
    },

    methods: {
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
