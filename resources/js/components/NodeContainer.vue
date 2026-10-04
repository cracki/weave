<template>
    <slot />
</template>

<script>
import { computed, provide, ref } from 'vue';
import { publishContextKey } from '@statamic/cms/ui';
import { data_set } from '../lib/dot';

// A scoped publish container for ONE block node's props.
//
// Container-managed fieldtypes (Grid rows, relationship fields, ...) don't
// bind their inner values through the `:value` prop — they resolve them from
// the surrounding publish container context by dotted field path. Rendering
// them inside the entry's own container would read/write the wrong paths
// (e.g. `buttons.0.label` instead of `blocks.0.props.buttons.0.label`), which
// is why grid rows used to mount empty. This provider scopes the context to
// the node: `values` IS the node's live props object and `meta` is the node's
// per-field meta (from Weave::preload's nodeMeta, or a fetch for new nodes),
// so grid/relationship fields behave exactly like top-level blueprint fields.
//
// Writes mutate the node's props directly — the editor's local tree — and flow
// up to the entry container through WeaveFieldtype's existing debounced update
// watcher, keeping a single source of truth.
export default {
    props: {
        node: { type: Object, required: true },
        meta: { type: Object, required: true },
    },

    setup(props) {
        const values = computed(() => props.node.props ?? {});

        const context = {
            name: ref(`weave-node-${props.node.id ?? ''}`),
            parentContainer: ref(undefined),
            blueprint: ref({ fields: [] }),
            reference: ref(undefined),
            values,
            extraValues: ref({}),
            visibleValues: values,
            originValues: ref(undefined),
            hiddenFields: ref({}),
            revealerFields: ref([]),
            revealerValues: ref({}),
            localizedFields: ref([]),
            meta: computed(() => props.meta),
            site: ref(undefined),
            direction: computed(() => 'ltr'),
            errors: ref({}),
            readOnly: ref(false),
            previews: ref({}),
            syncField: () => {},
            desyncField: () => {},
            components: ref([]),
            asConfig: ref(false),
            rememberTab: ref(false),
            isTrackingOriginValues: computed(() => false),
            isDirty: computed(() => false),
            setValues: () => {},
            setFieldValue: (path, value) => {
                data_set(props.node.props ?? {}, path, value);
            },
            setMeta: () => {},
            setFieldMeta: (path, value) => {
                data_set(props.meta, path, value);
            },
            setFieldPreviewValue: () => {},
            setRevealerField: () => {},
            unsetRevealerField: () => {},
            setHiddenField: () => {},
            fieldFocus: ref({}),
            fieldLocks: computed(() => ({})),
            focusField: () => {},
            blurField: () => {},
            withoutDirtying: (callback) => callback(),
        };

        // Core containers expose themselves as `container` — field conditions
        // and field actions read it back.
        context.container = context;

        provide(publishContextKey, context);
    },
};
</script>
