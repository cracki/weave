<template>
    <PublishFieldsProvider :fields="[panelField]">
        <PublishField v-if="field.type !== 'grid'" :config="field" />
        <PublishField v-else :config="panelField">
            <template #default="{ fieldtypeComponent, fieldtypeComponentProps, fieldtypeComponentEvents, shouldShowField }">
                <div v-if="shouldShowField" class="weave-repeater-summary">
                    <div class="flex items-center justify-between gap-2">
                        <span class="text-sm font-medium">{{ __(field.display || field.handle) }}</span>
                        <div class="flex items-center gap-1">
                            <Button
                                v-tooltip="__('Add Row')"
                                :aria-label="__('Add Row')"
                                icon="plus"
                                icon-only
                                size="sm"
                                variant="default"
                                :disabled="!canAddRow(fieldtypeComponentProps)"
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
                    <p v-if="field.instructions" class="mt-1 text-xs text-gray-500 dark:text-gray-400">{{ __(field.instructions) }}</p>
                    <p class="mt-1 text-xs text-gray-500 dark:text-gray-400">
                        {{ __n(':count row|:count rows', fieldtypeComponentProps.value?.length || 0) }}
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
                                :disabled="!canAddRow(fieldtypeComponentProps)"
                                @click="addRow"
                            />
                            <div class="flex items-center gap-2">
                            <ModalTitle class="text-sm font-semibold">{{ __(field.display || field.handle) }}</ModalTitle>
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
                        <div class="weave-scroll weave-repeater-editor">
                            <component
                                :is="fieldtypeComponent"
                                ref="grid"
                                v-bind="fieldtypeComponentProps"
                                v-on="fieldtypeComponentEvents"
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
        </PublishField>
    </PublishFieldsProvider>
</template>

<script>
import { Button, Modal, ModalTitle, PublishField, PublishFieldsProvider } from '@statamic/cms/ui';

// One field row — rendered from three places (content fields, each collapsible
// style section, ungrouped).
//
// Rendering goes through the core PublishField, which resolves value/meta from
// the scoped publish container provided by NodeContainer instead of taking
// them as props. That's what lets container-managed fieldtypes (Grid rows,
// relationship fields, ...) bind their nested values — passing raw :value/:meta
// props only ever worked for simple fieldtypes, and left grid rows empty.
// The label/instructions/errors wrapper comes from PublishField as well.
export default {
    props: {
        field: { type: Object, required: true },
    },

    components: { Button, Modal, ModalTitle, PublishField, PublishFieldsProvider },

    data() {
        return { rowsOpen: false, pendingAdd: false };
    },

    computed: {
        // Keep Statamic's row editor and metadata handling, but replace its
        // fullscreen action with our modal. Other fields retain their config.
        panelField() {
            return this.field.type === 'grid' ? { ...this.field, fullscreen: false } : this.field;
        },
    },

    methods: {
        canAddRow(props) {
            return !props.readOnly && (props.value?.length || 0) < (this.field.max_rows || Infinity);
        },

        openRows(add = false) {
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
            if (grid?.canAddRows) grid.addRow();
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

/* The modal toolbar replaces Grid's trailing Add Row button. Keep all row
   controls (including duplicate, delete, and reorder) in the native editor. */
.weave-repeater-editor section > button:last-child {
    display: none;
}
</style>
