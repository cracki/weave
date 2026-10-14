<template>
    <div :data-weave-field="field.handle" tabindex="-1">
        <PublishFieldsProvider :fields="[panelField]">
            <PublishField :config="panelField" />
        </PublishFieldsProvider>
    </div>
</template>

<script>
import { PublishField, PublishFieldsProvider } from '@statamic/cms/ui';
import { modalGridConfig } from '../lib/modal-grid';

export default {
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
