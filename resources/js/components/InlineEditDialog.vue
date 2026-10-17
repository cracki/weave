<template>
    <Modal :open="true" class="weave-repeater-modal weave-inline-edit-modal" @update:open="!$event && $emit('close')">
        <div class="weave-repeater-header">
            <ModalTitle class="text-sm font-semibold">{{ __(edit.title) }}</ModalTitle>
            <Button :aria-label="__('Cancel editing')" icon="x" icon-only size="sm" variant="ghost" @click="$emit('close')" />
        </div>
        <div v-auto-direction class="weave-scroll weave-repeater-editor weave-inline-edit-fields">
            <NodeContainer :node="draftNode" :meta="edit.meta">
                <PublishFieldsProvider :fields="dialogFields">
                    <div v-for="field in dialogFields" :key="field.handle" class="weave-inline-edit-field">
                        <PublishField :config="field" />
                    </div>
                </PublishFieldsProvider>
            </NodeContainer>
        </div>
        <template #footer>
            <div class="weave-repeater-footer weave-inline-edit-footer">
                <Button :text="__('Cancel')" @click="$emit('close')" />
                <Button :text="__('Done')" variant="primary" @click="$emit('done', edit)" />
            </div>
        </template>
    </Modal>
</template>

<script>
import { Button, Modal, ModalTitle, PublishField, PublishFieldsProvider } from '@statamic/cms/ui';
import NodeContainer from './NodeContainer.vue';
import { inlineDialogFields } from '../lib/inline-fields';
import autoDirection from '../directives/auto-direction';

export default {
    directives: { autoDirection },
    components: { Button, Modal, ModalTitle, PublishField, PublishFieldsProvider, NodeContainer },
    props: { edit: { type: Object, required: true } },
    emits: ['close', 'done'],
    computed: {
        draftNode() {
            return { id: `${this.edit.id}-inline`, props: this.edit.values };
        },
        dialogFields() {
            return inlineDialogFields(this.edit.fields);
        },
    },
};
</script>

<style>
.weave-repeater-modal.weave-inline-edit-modal {
    width: min(32rem, calc(100vw - 2rem));
    max-width: 32rem;
}

.weave-inline-edit-fields {
    display: flex;
    flex-direction: column;
    gap: 20px;
}

.weave-inline-edit-field {
    min-width: 0;
    flex-shrink: 0;
}

.weave-inline-edit-field:empty {
    display: none;
}

.weave-inline-edit-footer {
    gap: 8px;
}
</style>
