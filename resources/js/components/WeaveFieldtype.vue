<template>
    <Teleport to="body" :disabled="!fullScreenMode">
    <div
        class="weave-fieldtype"
        :dir="uiDirection"
        :class="fullScreenMode ? 'fixed inset-0 overflow-hidden rounded-none bg-gray-100 dark:bg-gray-900' : ''"
        :style="fullScreenMode ? { zIndex: 1 } : null"
    >
        <div :class="fullScreenMode ? 'flex h-full flex-col p-4' : ''">
            <div v-if="fullScreenMode" class="flex items-center justify-between mb-2 shrink-0">
                <div class="flex items-center gap-2">
                    <Button
                        v-tooltip="__('Blocks panel')"
                        :aria-label="__('Blocks panel')"
                        :aria-expanded="blocksPanelOpen"
                        icon="burger-menu"
                        icon-only
                        size="xs"
                        :variant="blocksPanelOpen ? 'primary' : 'ghost'"
                        @click="blocksPanelOpen = !blocksPanelOpen"
                    />
                    <div class="flex items-center gap-1 rounded-md border border-gray-200 p-1 dark:border-gray-700">
                        <Button
                            v-for="preset in viewportPresets"
                            :key="preset.key"
                            :text="preset.label"
                            size="xs"
                            :variant="viewport === preset.key ? 'primary' : 'ghost'"
                            @click="viewport = preset.key"
                        />
                    </div>
                </div>

                <div class="flex items-center gap-2">
                    <Button
                        v-if="selectedNode"
                        v-tooltip="__('Properties panel')"
                        :aria-label="__('Properties panel')"
                        :aria-expanded="propsPanelOpen && !!selectedNode"
                        icon="sliders-horizontal"
                        icon-only
                        size="xs"
                        :variant="propsPanelOpen && selectedNode ? 'primary' : 'ghost'"
                        @click="propsPanelOpen = !propsPanelOpen"
                    />
                    <Button
                        v-tooltip="__('Exit Fullscreen Mode')"
                        :text="__('Close')"
                        icon="x"
                        size="xs"
                        variant="default"
                        @click="toggleFullscreen"
                    />
                </div>
            </div>

            <div v-else class="flex justify-end mb-2 shrink-0">
                <Button
                    v-tooltip="__('Toggle Fullscreen Mode')"
                    icon="fullscreen-open"
                    icon-only
                    size="xs"
                    variant="default"
                    @click="toggleFullscreen"
                />
            </div>

            <div v-if="fullScreenMode" class="weave-editor-layout flex flex-1 min-h-0">
                <div
                    class="weave-blocks-drawer shrink-0"
                    :class="{ 'is-closed': !blocksPanelOpen }"
                    :inert="!blocksPanelOpen"
                    :aria-hidden="!blocksPanelOpen"
                >
                    <div class="weave-scroll weave-blocks-drawer-content">
                    <blocks-panel
                        ref="blocksPanel"
                        :blocks="blocks"
                        :block-types="blockTypesMeta"
                        :selected-id="selectedBlockId"
                        @select="selectedBlockId = $event"
                        @remove="removeBlock"
                        @duplicate="duplicateBlock"
                        @add="addBlock"
                    />
                    </div>
                </div>

                <div class="relative flex flex-1 gap-1 min-w-0">
                    <div class="flex-1 min-w-0 overflow-auto rounded-md bg-gray-200 dark:bg-gray-950">
                        <div class="weave-viewport mx-auto h-full" :style="{ width: viewportWidth }">
                            <canvas-frame
                                :blocks="blocks"
                                :selected-id="selectedBlockId"
                                @select="selectedBlockId = $event"
                                @reorder="reorderBlocks"
                                @add="addBlock"
                                @prop="updateProp"
                                @contextmenu="openContextMenu"
                                @add-empty="openAddForParent"
                                @move="moveBlock"
                            />
                        </div>
                    </div>

                    <Transition name="weave-props">
                    <div
                        v-if="selectedNode"
                        v-show="propsPanelOpen"
                        class="weave-scroll weave-props-panel absolute top-0 overflow-y-auto"
                        :data-panel-size="propsPanelSize"
                    >
                        <!-- Gate on per-node meta: fieldtype components (Grid rows,
                             Assets chips, ...) snapshot `meta` on mount and don't
                             re-render when it changes later — mounting before
                             fetchNodeMeta() resolves renders them from the
                             type-level default meta (empty rows/chips) and
                             never recovers. -->
                        <props-panel
                            v-if="nodeMeta[selectedBlockId]"
                            :node="selectedNode"
                            :block-type="blockTypesMeta.find((b) => b.type === selectedNode.type)"
                            :node-meta="nodeMeta[selectedBlockId]"
                            :size="propsPanelSize"
                            :key="selectedBlockId"
                            :focus-target="fieldFocusTarget?.id === selectedBlockId ? fieldFocusTarget : null"
                            @close="propsPanelOpen = false"
                            @update:size="propsPanelSize = $event"
                            @meta-stale="fetchNodeMeta(selectedBlockId)"
                        />
                    </div>
                    </Transition>
                </div>
            </div>

            <div v-else class="group relative">
                <canvas-frame :blocks="blocks" :selected-id="null" />

                <div
                    class="absolute inset-0 flex items-center justify-center opacity-0 backdrop-blur-xl transition group-hover:opacity-100"
                    style="background: rgba(17, 24, 39, 0.55);"
                >
                    <Button text="Edit" icon="pencil" variant="primary" @click="toggleFullscreen" />
                </div>
            </div>
        </div>

        <context-menu
            v-if="contextMenu"
            :x="contextMenu.x"
            :y="contextMenu.y"
            :items="contextMenuItems"
            @action="onContextAction"
            @close="contextMenu = null"
        />
        <InlineEditDialog
            v-if="inlineEdit"
            :edit="inlineEdit"
            @close="inlineEdit = null"
            @done="commitInlineEdit"
        />
    </div>
    </Teleport>
</template>

<script>
import uuid from '../lib/uuid';
import { Fieldtype, clone, debounce } from '@statamic/cms';
import { Button, useUiDirection } from '@statamic/cms/ui';
import BlocksPanel from './BlocksPanel.vue';
import CanvasFrame from './Canvas.vue';
import ContextMenu from './ContextMenu.vue';
import PropsPanel from './PropsPanel.vue';
import InlineEditDialog from './InlineEditDialog.vue';
import { findNodeById, containingArray, reassignIds } from '../lib/tree';
import { columnsForPreset, resizeColumnsForPreset } from '../lib/columns';
import { resolveCanvasField } from '../lib/canvas-target';
import { resolveInlineScope, applyInlineEdit } from '../lib/inline-edit';
import { reorderNodes } from '../lib/reorder';

export default {
    setup() {
        const { direction } = useUiDirection();
        return { uiDirection: direction };
    },

    mixins: [Fieldtype],

    components: { Button, BlocksPanel, CanvasFrame, ContextMenu, PropsPanel, InlineEditDialog },

    data() {
        return {
            blocks: clone(this.value) || [],
            selectedBlockId: null,
            fullScreenMode: false,
            blocksPanelOpen: true,
            propsPanelOpen: true,
            propsPanelSize: 'compact',
            // Per-node field meta, keyed by node id — Grid row metas, resolved
            // titles/thumbnails for relational fields, ... Seeded server-side by
            // Weave::preload()'s nodeMeta (computed from the actual saved values)
            // and refreshed by fetchNodeMeta() for newly added nodes. This is the
            // live meta store the scoped NodeContainer reads from.
            nodeMeta: clone(this.meta?.nodeMeta ?? {}),
            clipboard: null,
            contextMenu: null,
            inlineEdit: null,
            inlineEditRequest: 0,
            fieldFocusTarget: null,
            viewport: 'desktop',
            viewportPresets: [
                { key: 'desktop', label: 'Desktop' },
                { key: 'tablet', label: 'Tablet' },
                { key: 'mobile', label: 'Mobile' },
            ],
        };
    },

    computed: {
        blockTypesMeta() {
            return this.meta.blockTypes || [];
        },

        viewportWidth() {
            return { desktop: '100%', tablet: '768px', mobile: '390px' }[this.viewport];
        },

        selectedNode() {
            return this.selectedBlockId ? findNodeById(this.blocks, this.selectedBlockId) : null;
        },

        contextMenuItems() {
            return [
                { action: 'edit', icon: 'sliders-horizontal', label: __('Edit in Properties') },
                { action: 'edit-here', icon: 'pencil', label: __('Edit Here') },
                { action: 'duplicate', icon: 'duplicate', label: 'Duplicate' },
                { action: 'copy', icon: 'clipboard', label: 'Copy' },
                { action: 'paste', icon: 'clipboard-check', label: 'Paste', disabled: ! this.clipboard },
                { action: 'remove', icon: 'trash', label: 'Delete' },
            ];
        },
    },

    watch: {
        blocks: {
            deep: true,
            handler: debounce(function () {
                this.update(this.blocks);
            }, 300),
        },

        selectedBlockId(id) {
            if (id && ! this.nodeMeta[id]) this.fetchNodeMeta(id);
        },

        fullScreenMode(on) {
            document.querySelector('.nav-main')?.style.setProperty('visibility', on ? 'hidden' : '');
            document.body.style.setProperty('overflow', on ? 'hidden' : '');
            if (! on) {
                document.removeEventListener('keydown', this.onEscKey);
                return;
            }
            document.addEventListener('keydown', this.onEscKey);
        },
    },

    beforeUnmount() {
        document.removeEventListener('keydown', this.onEscKey);
        document.querySelector('.nav-main')?.style.setProperty('visibility', '');
        document.body.style.setProperty('overflow', '');
    },

    methods: {
        update(value) {
            this.$emit('update:value', value);
        },

        async fetchNodeMeta(id) {
            const node = findNodeById(this.blocks, id);
            if (! node) return;

            const token = Statamic.$config.get('csrfToken');

            try {
                const response = await fetch(cp_url('weave/field-meta'), {
                    method: 'POST',
                    credentials: 'same-origin',
                    headers: {
                        'Content-Type': 'application/json',
                        'X-CSRF-TOKEN': token,
                    },
                    body: JSON.stringify({ type: node.type, props: node.props }),
                });
                if (!response.ok) throw new Error('Unable to load field metadata');
                const { meta } = await response.json();
                this.nodeMeta[id] = meta;
            } catch {
                // Preserve existing relationship/row metadata if a refresh fails.
                this.nodeMeta[id] ??= {};
            }
        },

        toggleFullscreen() {
            this.fullScreenMode = ! this.fullScreenMode;
        },

        onEscKey(e) {
            if (e.key !== 'Escape' || this.inlineEdit || document.querySelector('.weave-repeater-modal, .weave-block-picker')) return;
            if (this.contextMenu) {
                this.contextMenu = null;
                return;
            }
            this.fullScreenMode = false;
        },

        addBlock({ type, parentId, index }) {
            const definition = this.blockTypesMeta.find((b) => b.type === type);
            if (! definition) return;

            const node = {
                id: uuid(),
                type,
                props: clone(definition.defaults) || {},
            };

            if (definition.allowsChildren) node.children = [];
            if (type === 'columns') node.children = columnsForPreset(node.props.preset);

            if (parentId) {
                const parent = findNodeById(this.blocks, parentId);
                if (parent) {
                    parent.children = parent.children || [];
                    parent.children.push(node);
                }
            } else {
                const at = Number.isInteger(index) ? index : this.blocks.length;
                this.blocks.splice(at, 0, node);
            }

            this.selectedBlockId = node.id;
        },

        updateProp({ id, prop, value }) {
            const node = findNodeById(this.blocks, id);
            if (! node) return;
            node.props = { ...node.props, [prop]: value };
        },

        reorderBlocks(ids) {
            if (!Array.isArray(ids) || !ids.length) return;
            const siblings = containingArray(this.blocks, ids[0]) || this.blocks;
            reorderNodes(siblings, ids.map(id => ({ id })));
        },

        removeBlock(id) {
            const removeFrom = (nodes) => {
                const index = nodes.findIndex((n) => n.id === id);
                if (index !== -1) {
                    nodes.splice(index, 1);
                    return true;
                }
                return nodes.some((n) => n.children && removeFrom(n.children));
            };

            removeFrom(this.blocks);

            if (this.selectedBlockId === id) this.selectedBlockId = null;
        },

        duplicateBlock(id) {
            const original = findNodeById(this.blocks, id);
            if (! original) return;

            const copy = reassignIds(clone(original));
            const siblings = containingArray(this.blocks, id) || this.blocks;
            const index = siblings.findIndex((n) => n.id === id);
            siblings.splice(index + 1, 0, copy);
        },

        copyBlock(id) {
            const node = findNodeById(this.blocks, id);
            if (node) this.clipboard = clone(node);
        },

        pasteBlock(afterId) {
            if (! this.clipboard) return;

            const copy = reassignIds(clone(this.clipboard));
            const siblings = containingArray(this.blocks, afterId) || this.blocks;
            const index = siblings.findIndex((n) => n.id === afterId);
            siblings.splice(index === -1 ? siblings.length : index + 1, 0, copy);
            this.selectedBlockId = copy.id;
        },

        moveBlock({ id, parentId }) {
            if (id === parentId) return;

            const target = findNodeById(this.blocks, parentId);
            if (! target) return;

            const siblings = containingArray(this.blocks, id);
            const index = siblings ? siblings.findIndex((n) => n.id === id) : -1;
            if (index === -1) return;
            if (siblings[index].locked || siblings.slice(index + 1).some(node => node.locked)) return;

            const [node] = siblings.splice(index, 1);
            target.children = target.children || [];
            target.children.push(node);
            this.selectedBlockId = node.id;
        },

        openAddForParent(id) {
            this.selectedBlockId = id;
            this.blocksPanelOpen = true;
            this.$nextTick(() => this.$refs.blocksPanel?.openAddPicker(id));
        },

        openContextMenu({ id, target, x, y }) {
            this.contextMenu = { id, target, x, y };
        },

        async openInlineEdit(id, target = {}) {
            const request = ++this.inlineEditRequest;
            if (!this.nodeMeta[id]) await this.fetchNodeMeta(id);
            if (request !== this.inlineEditRequest || !this.fullScreenMode) return;
            const node = findNodeById(this.blocks, id);
            if (!node) return;
            const definition = this.blockTypesMeta.find((block) => block.type === node.type);
            const scope = resolveInlineScope(node, definition?.fields || [], target, this.nodeMeta[id]);
            if (!scope?.fields.length) return;
            this.inlineEdit = {
                id, target: scope.rowId ? { row: scope.rowId } : clone(target), rowId: scope.rowId,
                fields: scope.fields, values: clone(scope.values), meta: clone(scope.meta),
                title: !scope.path.length && scope.fields.length !== 1 ? definition?.label || node.type : scope.title,
            };
        },

        commitInlineEdit(edit) {
            const node = findNodeById(this.blocks, edit.id);
            const fields = this.blockTypesMeta.find((block) => block.type === node?.type)?.fields || [];
            if (node && applyInlineEdit(node, fields, this.nodeMeta[edit.id], edit)) {
                if (node.type === 'columns' && edit.fields.some((field) => field.handle === 'preset')) {
                    node.children = resizeColumnsForPreset(node.children || [], node.props.preset);
                }
                this.fetchNodeMeta(edit.id);
            }
            this.inlineEdit = null;
        },

        onContextAction(action) {
            const { id, target } = this.contextMenu;
            this.contextMenu = null;

            if (action === 'edit') {
                const node = findNodeById(this.blocks, id);
                if (!node) return;
                const fields = this.blockTypesMeta.find((block) => block.type === node.type)?.fields || [];
                this.selectedBlockId = id;
                this.propsPanelOpen = true;
                // A fresh object also refocuses when editing the same field twice.
                const rowScope = target?.row ? resolveInlineScope(node, fields, target) : null;
                this.fieldFocusTarget = { id, field: rowScope?.path[0] || resolveCanvasField(node, fields, target) };
            }
            if (action === 'edit-here') this.openInlineEdit(id, target);
            if (action === 'duplicate') this.duplicateBlock(id);
            if (action === 'copy') this.copyBlock(id);
            if (action === 'paste') this.pasteBlock(id);
            if (action === 'remove') this.removeBlock(id);
        },
    },
};
</script>

<style>
.weave-fieldtype {
    --weave-inline-sign: 1;
}

.weave-fieldtype:dir(rtl) {
    --weave-inline-sign: -1;
}

.weave-disclosure-icon.is-collapsed:dir(rtl) {
    transform: scaleX(-1);
}

.weave-blocks-drawer {
    width: var(--weave-drawer-width);
    margin-inline-end: 4px;
    overflow: hidden;
    transition: width var(--weave-panel-motion), margin-inline-end var(--weave-panel-motion);
}

.weave-editor-layout {
    --weave-drawer-width: min(18rem, 35vw);
    --weave-panel-motion: 240ms cubic-bezier(0.22, 1, 0.36, 1);
    overflow: hidden;
}

.weave-blocks-drawer-content {
    width: var(--weave-drawer-width);
    height: 100%;
    overflow-y: auto;
    transition: transform var(--weave-panel-motion), opacity var(--weave-panel-motion);
}

.weave-blocks-drawer.is-closed {
    width: 0;
    margin-inline-end: 0;
}

.weave-blocks-drawer.is-closed .weave-blocks-drawer-content {
    transform: translateX(calc(-100% * var(--weave-inline-sign)));
    opacity: 0;
}

.weave-viewport {
    transition: width var(--weave-panel-motion);
}

.weave-props-panel {
    --weave-props-width: 20rem;
    --weave-props-resize-motion: 280ms cubic-bezier(0.22, 1, 0.36, 1);
    top: 8px;
    inset-inline-end: 8px;
    width: min(var(--weave-props-width), calc(100% - 16px));
    max-height: calc(100% - 16px);
    z-index: 1;
    border-radius: 0.5rem;
    box-shadow: 0 12px 32px rgba(0, 0, 0, 0.2);
    container: weave-properties / inline-size;
    scroll-padding-top: 4rem;
    /* Width must reflow the fields and categories during the resize. */
    transition: width var(--weave-props-resize-motion);
}

.weave-props-panel[data-panel-size="medium"] {
    --weave-props-width: 36rem;
}

.weave-props-panel[data-panel-size="wide"] {
    --weave-props-width: 56rem;
}

.weave-props-enter-active,
.weave-props-leave-active {
    transition: transform var(--weave-panel-motion), opacity var(--weave-panel-motion);
}

.weave-props-enter-from,
.weave-props-leave-to {
    transform: translateX(calc((100% + 8px) * var(--weave-inline-sign)));
    opacity: 0;
}

@media (prefers-reduced-motion: reduce) {
    .weave-editor-layout {
        --weave-panel-motion: 0ms linear;
    }

    .weave-props-panel {
        --weave-props-resize-motion: 0ms linear;
    }
}

/* Keep portaled field dropdowns above the editor and its row-management modal. */
[data-reka-popper-content-wrapper] {
    z-index: 100 !important;
}
</style>
