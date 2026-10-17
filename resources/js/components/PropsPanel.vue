<template>
    <Card inset class="weave-props-card" :data-panel-size="size">
        <header class="weave-props-header">
            <span ref="panelTitle" tabindex="-1" class="weave-props-title text-sm font-semibold" :title="blockType ? blockType.label : node.type">{{ blockType ? blockType.label : node.type }}</span>
            <div class="weave-props-actions">
                <div
                    class="weave-props-sizes"
                    role="radiogroup"
                    :aria-label="__('Properties panel size')"
                    :style="{ '--weave-props-active-size': sizePresets.findIndex((preset) => preset.key === size) }"
                    @keydown="onSizeKeydown"
                >
                    <span class="weave-props-size-indicator" aria-hidden="true" />
                    <button
                        v-for="preset in sizePresets"
                        :key="preset.key"
                        v-tooltip="__(preset.label)"
                        type="button"
                        role="radio"
                        :aria-label="__(preset.label)"
                        :aria-checked="size === preset.key"
                        :tabindex="size === preset.key ? 0 : -1"
                        class="weave-props-size"
                        @click="$emit('update:size', preset.key)"
                    >
                        <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.5" aria-hidden="true">
                            <rect x="2.5" y="3.5" width="15" height="13" rx="1.5" />
                            <path :d="`M${preset.divider} 3.5v13`" />
                        </svg>
                    </button>
                </div>
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
        </header>

        <NodeContainer :node="node" :meta="nodeMeta">
            <div class="weave-props-body">
                <section v-if="contentFields.length" class="weave-props-content">
                    <h3 class="weave-props-content-title">{{ __('Content') }}</h3>
                    <div class="weave-props-content-fields">
                        <div v-for="field in contentFields" :key="field.handle" class="weave-props-field" :class="{ 'weave-props-field-full': needsFullWidth(field) }">
                            <PropField :field="field" />
                        </div>
                    </div>
                </section>

                <section v-for="section in styleSections" :key="section.title" class="weave-props-section">
                    <button
                        type="button"
                        class="flex w-full items-center gap-1 py-2 text-xs font-semibold uppercase text-gray-500 dark:text-gray-400"
                        :aria-expanded="!isSectionCollapsed(section.title)"
                        @click="toggleSection(section.title)"
                    >
                        <Icon :name="isSectionCollapsed(section.title) ? 'chevron-right' : 'chevron-down'" class="weave-disclosure-icon size-3" :class="{ 'is-collapsed': isSectionCollapsed(section.title) }" />
                        {{ __(section.title) }}
                    </button>

                    <div v-if="!isSectionCollapsed(section.title)" class="weave-props-section-fields">
                        <PropField v-for="field in section.fields" :key="field.handle" :field="field" />
                    </div>
                </section>

                <section v-if="groups.length" class="weave-props-section">
                    <button
                        type="button"
                        class="flex w-full items-center gap-1 py-2 text-xs font-semibold uppercase text-gray-500 dark:text-gray-400"
                        :aria-expanded="!isSectionCollapsed('Spacing')"
                        @click="toggleSection('Spacing')"
                    >
                        <Icon :name="isSectionCollapsed('Spacing') ? 'chevron-right' : 'chevron-down'" class="weave-disclosure-icon size-3" :class="{ 'is-collapsed': isSectionCollapsed('Spacing') }" />
                        {{ __('Spacing') }}
                    </button>

                    <div v-if="!isSectionCollapsed('Spacing')" class="weave-props-section-fields">
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
                </section>
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
        size: { type: String, default: 'compact', validator: (value) => ['compact', 'medium', 'wide'].includes(value) },
    },

    emits: ['close', 'meta-stale', 'update:size'],

    data() {
        return {
            sectionCollapsed: {},
            sizePresets: [
                { key: 'compact', label: 'Compact properties panel', divider: 13 },
                { key: 'medium', label: 'Medium properties panel', divider: 10 },
                { key: 'wide', label: 'Wide properties panel', divider: 7 },
            ],
        };
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
        needsFullWidth(field) {
            return ['textarea', 'markdown', 'bard', 'code', 'html', 'grid', 'replicator', 'table', 'assets', 'entries', 'terms', 'users', 'array', 'link'].includes(field.type);
        },

        onSizeKeydown(event) {
            const keys = ['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'Home', 'End'];
            if (!keys.includes(event.key)) return;
            event.preventDefault();
            const current = this.sizePresets.findIndex((preset) => preset.key === this.size);
            const rtl = event.currentTarget.matches(':dir(rtl)');
            const forward = event.key === 'ArrowDown' || event.key === (rtl ? 'ArrowLeft' : 'ArrowRight');
            const next = event.key === 'Home' ? 0 : event.key === 'End' ? 2
                : (current + (forward ? 1 : -1) + 3) % 3;
            this.$emit('update:size', this.sizePresets[next].key);
            event.currentTarget.querySelectorAll('[role="radio"]')[next].focus();
        },

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
                    top: panel.scrollTop + field.getBoundingClientRect().top - panel.getBoundingClientRect().top
                        - this.$el.querySelector('.weave-props-header').getBoundingClientRect().height - 12,
                    behavior: reducedMotion ? 'instant' : 'smooth',
                });
            }
        },

        isSectionCollapsed(title) {
            return this.sectionCollapsed[title] ?? (this.size === 'compact');
        },

        toggleSection(title) {
            this.sectionCollapsed[title] = ! this.isSectionCollapsed(title);
        },

    },
};
</script>

<style>
.weave-props-card {
    --weave-size-tab-sign: 1;
    --weave-props-border: var(--color-gray-200, #e4e4e7);
    --weave-props-surface: var(--color-white, #fff);
    min-width: 0;
}

.weave-props-card:dir(rtl) {
    --weave-size-tab-sign: -1;
}

.weave-props-card:not([data-panel-size="compact"]) [data-ui-description] {
    display: none;
}

.weave-props-header {
    position: sticky;
    top: 0;
    z-index: 2;
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
    padding: 12px 16px;
    background: var(--weave-props-surface);
    border-bottom: 1px solid var(--weave-props-border);
}

.weave-props-title {
    min-width: 0;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
}

.weave-props-actions,
.weave-props-sizes {
    display: flex;
    align-items: center;
    flex-shrink: 0;
    gap: 4px;
}

.weave-props-actions {
    margin-inline-start: auto;
}

.weave-props-sizes {
    position: relative;
    padding: 3px;
    border-radius: 6px;
    background: var(--color-gray-100, #f4f4f5);
}

.weave-props-size-indicator {
    position: absolute;
    top: 3px;
    inset-inline-start: 3px;
    width: 28px;
    height: 28px;
    border-radius: 4px;
    background: var(--weave-props-surface);
    box-shadow: 0 1px 3px rgb(0 0 0 / 12%);
    pointer-events: none;
    transform: translateX(calc(var(--weave-props-active-size, 0) * 32px * var(--weave-size-tab-sign)));
    transition: transform var(--weave-props-resize-motion, 280ms cubic-bezier(0.22, 1, 0.36, 1));
}

.weave-props-size {
    position: relative;
    display: grid;
    place-items: center;
    width: 28px;
    height: 28px;
    border-radius: 4px;
    color: var(--color-gray-600, #52525b);
    cursor: pointer;
}

.weave-props-size svg {
    width: 20px;
    height: 20px;
    transform: scaleX(var(--weave-size-tab-sign));
}

.weave-props-size:not([aria-checked="true"]):hover {
    background: var(--weave-props-border);
}

.weave-props-size[aria-checked="true"] {
    color: var(--color-gray-900, #18181b);
}

.weave-props-size:focus-visible {
    outline: 2px solid var(--color-blue-500, #3b82f6);
    outline-offset: 2px;
}

.weave-props-body {
    display: grid;
    padding: 16px;
    gap: 16px 24px;
}

.weave-props-content,
.weave-props-field,
.weave-props-section {
    min-width: 0;
}

.weave-props-content-title {
    display: none;
    margin-bottom: 16px;
    font-size: 12px;
    font-weight: 600;
    color: var(--color-gray-600, #52525b);
}

.weave-props-field + .weave-props-field {
    margin-top: 16px;
    padding-top: 16px;
    border-top: 1px solid var(--weave-props-border);
}

.weave-props-section {
    padding-top: 8px;
    border-top: 1px solid var(--weave-props-border);
}

.weave-props-section-fields {
    display: grid;
    gap: 16px;
    padding-block: 8px;
}

.dark .weave-props-card {
    --weave-props-border: var(--color-gray-700, #3f3f46);
    --weave-props-surface: var(--color-gray-850, #202025);
}

.dark .weave-props-sizes {
    background: var(--color-gray-900, #18181b);
}

.dark .weave-props-size,
.dark .weave-props-content-title {
    color: var(--color-gray-300, #d4d4d8);
}

.dark .weave-props-size[aria-checked="true"] {
    color: var(--color-white, #fff);
}

/* Reflow according to the available panel space, including narrow editors. */
@container weave-properties (min-width: 32rem) {
    .weave-props-card:not([data-panel-size="compact"]) .weave-props-body {
        grid-template-columns: repeat(2, minmax(0, 1fr));
    }

    .weave-props-content {
        grid-column: 1 / -1;
    }

    .weave-props-content-title {
        display: block;
    }

    .weave-props-content-fields {
        display: grid;
        grid-template-columns: repeat(2, minmax(0, 1fr));
        align-items: start;
        gap: 20px 24px;
    }

    .weave-props-field + .weave-props-field {
        margin: 0;
        padding: 0;
        border: 0;
    }

    .weave-props-field-full {
        grid-column: 1 / -1;
    }
}

@container weave-properties (min-width: 48rem) {
    .weave-props-card[data-panel-size="wide"] .weave-props-body,
    .weave-props-card[data-panel-size="wide"] .weave-props-content-fields {
        grid-template-columns: repeat(3, minmax(0, 1fr));
    }
}

@media (prefers-reduced-motion: reduce) {
    .weave-props-size-indicator {
        transition: none;
    }
}
</style>
