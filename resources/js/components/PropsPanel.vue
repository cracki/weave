<template>
    <Card>
        <div class="mb-3 flex items-center justify-between">
            <span ref="panelTitle" tabindex="-1" class="text-sm font-semibold">{{ blockType ? blockType.label : node.type }}</span>
            <div class="flex items-center gap-1">
                <Button
                    v-tooltip="__('Close properties panel')"
                    :aria-label="__('Close properties panel')"
                    icon="x"
                    icon-only
                    size="sm"
                    variant="ghost"
                    @click="$emit('close')"
                />
            </div>
        </div>

        <NodeContainer :node="node" :meta="nodeMeta">
            <div class="weave-props-content">
                <div v-for="field in contentFields" :key="field.handle" class="weave-props-field">
                    <PropField :field="field" />
                </div>
            </div>

            <div v-if="styleSections.length || groups.length" class="weave-props-sections mt-5 border-t border-gray-200 dark:border-gray-700">
                <div v-for="section in styleSections" :key="section.title" class="weave-props-section">
                    <button
                        type="button"
                        class="flex w-full items-center gap-1 py-2 text-xs font-semibold uppercase text-gray-500 dark:text-gray-400"
                        @click="toggleSection(section.title)"
                    >
                        <Icon :name="isSectionCollapsed(section.title) ? 'chevron-right' : 'chevron-down'" class="size-3" />
                        {{ section.title }}
                    </button>

                    <div v-if="!isSectionCollapsed(section.title)" class="space-y-4 pb-3">
                        <PropField v-for="field in section.fields" :key="field.handle" :field="field" />
                    </div>
                </div>

                <div v-if="groups.length" class="weave-props-section">
                    <button
                        type="button"
                        class="flex w-full items-center gap-1 py-2 text-xs font-semibold uppercase text-gray-500 dark:text-gray-400"
                        @click="toggleSection('Spacing')"
                    >
                        <Icon :name="isSectionCollapsed('Spacing') ? 'chevron-right' : 'chevron-down'" class="size-3" />
                        Spacing
                    </button>

                    <div v-if="!isSectionCollapsed('Spacing')" class="space-y-4 pb-3">
                        <div
                            v-for="group in groups"
                            :key="group.name"
                            :data-weave-spacing-fields="group.fields.map((field) => field.handle).join(',')"
                            tabindex="-1"
                        >
                            <BoxModelControl
                                :title="group.title"
                                :fields="group.fields"
                                :node="node"
                            />
                        </div>
                    </div>
                </div>
            </div>
        </NodeContainer>
    </Card>
</template>

<script>
import { Button, Card, Icon } from '@statamic/cms/ui';
import BoxModelControl from './BoxModelControl.vue';
import NodeContainer from './NodeContainer.vue';
import PropField from './PropField.vue';
import { resizeColumnsForPreset } from '../lib/columns';

const RELATIONAL_FIELD_TYPES = ['entries', 'assets', 'terms', 'users'];

// Which style-panel section a generic style field (see Blocks/Block.php
// styleSchema()) belongs to. Anything not listed here — a block's own
// propsSchema() fields, e.g. Column's Width — renders up top, unsectioned.
// Spacing (margin/padding) isn't listed: it's already grouped via `group` in
// the blueprint and rendered from `groups` below, not this handle map.
const STYLE_SECTIONS = [
    { title: 'Typography', handles: ['text_color', 'background_color', 'font_size', 'font_family', 'font_weight'] },
    { title: 'Border & Shadow', handles: ['border_radius', 'border_width', 'border_style', 'border_color', 'shadow'] },
    { title: 'Animation', handles: ['animation', 'animation_duration', 'animation_delay'] },
    { title: 'Visibility', handles: ['hide_mobile', 'hide_tablet', 'hide_desktop'] },
];

export default {
    components: { Button, Card, Icon, BoxModelControl, NodeContainer, PropField },

    props: {
        node: { type: Object, required: true },
        blockType: { type: Object, default: null },
        // Per-node meta (resolved title/thumbnail for a relationship field's
        // current value, Grid row metas, ...) — seeded from Weave::preload's
        // nodeMeta and refreshed by fetchNodeMeta() in WeaveFieldtype.vue.
        // Doubles as the NodeContainer's live meta store.
        nodeMeta: { type: Object, default: () => ({}) },
        focusTarget: { type: Object, default: null },
    },

    emits: ['close', 'meta-stale'],

    data() {
        // Collapsed by default — this panel lists every generic style field on
        // every block, and most edits are to the block's own top fields, not
        // typography/border/spacing/visibility.
        return { sectionCollapsed: {} };
    },

    computed: {
        fields() {
            return this.blockType?.fields || [];
        },

        ungroupedFields() {
            return this.fields.filter((field) => ! field.group);
        },

        // The block's own fields (Column's Width, Image's asset/alt, ...) — not a
        // generic style field, so always shown, no section chrome.
        contentFields() {
            const styleHandles = STYLE_SECTIONS.flatMap((section) => section.handles);
            return this.ungroupedFields.filter((field) => ! styleHandles.includes(field.handle));
        },

        styleSections() {
            return STYLE_SECTIONS
                .map((section) => ({
                    title: section.title,
                    fields: this.ungroupedFields.filter((field) => section.handles.includes(field.handle)),
                }))
                .filter((section) => section.fields.length);
        },

        groups() {
            const byName = {};
            for (const field of this.fields) {
                if (! field.group) continue;
                (byName[field.group] = byName[field.group] || []).push(field);
            }
            return Object.entries(byName).map(([name, fields]) => ({
                name,
                title: name.charAt(0).toUpperCase() + name.slice(1),
                fields,
            }));
        },

        // Signature of the relational props — watched so the parent can refetch
        // per-node meta (resolved titles/thumbnails) after a new value is picked
        // through the scoped container, which bypasses the old updateField path.
        relationalSignature() {
            return JSON.stringify(
                this.fields
                    .filter((field) => RELATIONAL_FIELD_TYPES.includes(field.type))
                    .map((field) => this.node.props?.[field.handle] ?? null),
            );
        },
    },

    watch: {
        focusTarget: {
            immediate: true,
            handler(target) {
                if (target) this.focusField(target.field);
            },
        },
        relationalSignature(value, previous) {
            if (previous !== undefined && value !== previous) this.$emit('meta-stale');
        },

        // Selects are now bound through the scoped container, which bypasses the
        // old updateField() side effect — keep the Columns preset behaviour here.
        'node.props.preset'(value) {
            if (this.node.type === 'columns' && value) {
                this.node.children = resizeColumnsForPreset(this.node.children || [], value);
            }
        },
    },

    methods: {
        async focusField(handle) {
            const section = this.styleSections.find((section) => section.fields.some((field) => field.handle === handle));
            if (section) this.sectionCollapsed[section.title] = false;
            if (this.groups.some((group) => group.fields.some((field) => field.handle === handle))) {
                this.sectionCollapsed.Spacing = false;
            }

            // Also waits for a newly selected node's panel to mount after metadata
            // arrives, and for a previously collapsed section to render its fields.
            await this.$nextTick();
            if (!this.$el || this.focusTarget?.field !== handle) return;
            const panel = this.$el.closest('.weave-props-panel');
            const field = Array.from(this.$el.querySelectorAll('[data-weave-field], [data-weave-spacing-fields]'))
                .find((el) => el.dataset.weaveField === handle || el.dataset.weaveSpacingFields?.split(',').includes(handle));
            if (!field) {
                panel?.scrollTo({ top: 0 });
                this.$refs.panelTitle?.focus({ preventScroll: true });
                return;
            }

            const control = field.querySelector('[aria-label="Manage rows"]')
                || field.querySelector('input:not([disabled]):not([type="hidden"]), textarea:not([disabled]), select:not([disabled]), [contenteditable="true"], [role="combobox"]')
                || field.querySelector('button:not([disabled])')
                || field;
            control.focus({ preventScroll: true });
            if (panel) {
                const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
                panel.scrollTo({
                    top: panel.scrollTop + field.getBoundingClientRect().top - panel.getBoundingClientRect().top - 12,
                    behavior: reducedMotion ? 'instant' : 'smooth',
                });
            }
        },

        isSectionCollapsed(title) {
            return this.sectionCollapsed[title] !== false;
        },

        toggleSection(title) {
            this.sectionCollapsed[title] = ! this.isSectionCollapsed(title);
        },

    },
};
</script>

<style>
.weave-props-field + .weave-props-field {
    margin-top: 16px;
    padding-top: 16px;
    border-top: 1px solid var(--color-gray-200, #e4e4e7);
}

.weave-props-section {
    padding-block: 8px;
}

.weave-props-section + .weave-props-section {
    border-top: 1px solid var(--color-gray-200, #e4e4e7);
}

.dark .weave-props-field + .weave-props-field,
.dark .weave-props-section + .weave-props-section {
    border-color: var(--color-gray-700, #3f3f46);
}
</style>
