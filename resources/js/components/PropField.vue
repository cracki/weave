<template>
    <PublishFieldsProvider :fields="[field]">
        <PublishField :config="field" />
    </PublishFieldsProvider>
</template>

<script>
import { PublishField, PublishFieldsProvider } from '@statamic/cms/ui';

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

    components: { PublishField, PublishFieldsProvider },
};
</script>
