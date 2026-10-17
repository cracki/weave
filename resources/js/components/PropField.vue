<template>
    <div v-auto-direction :data-weave-field="field.handle" tabindex="-1">
        <PublishFieldsProvider :fields="[panelField]">
            <PublishField :config="panelField" />
        </PublishFieldsProvider>
    </div>
</template>

<script>
import { PublishField, PublishFieldsProvider } from '@statamic/cms/ui';
import { modalGridConfig } from '../lib/modal-grid';
import autoDirection from '../directives/auto-direction';

export default {
    directives: { autoDirection },
    props: {
        field: { type: Object, required: true },
    },

    components: { PublishField, PublishFieldsProvider },

    computed: {
        panelField() {
            return modalGridConfig(this.field);
        },
    },
};
</script>

<style>
:is(.weave-props-card, .weave-inline-edit-fields, .weave-repeater-editor) :is(input, textarea)[dir="auto"] {
    text-align: start;
}
</style>
