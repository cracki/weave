<template>
    <div class="weave-block-list" @dragleave="onDragLeave">
        <div
            v-for="node in blocks"
            :key="node.id"
            class="weave-block-list-item"
            :class="{ 'is-dragging': dragId === node.id, 'is-swap-target': swapTarget === node.id }"
            @dragover.stop.prevent="onDragOver($event, node.id)"
            @drop.stop.prevent="onDrop($event, node.id)"
        >
            <div v-if="dropTarget === node.id && dropPosition === 'before'" class="weave-drop-line is-before" aria-hidden="true" />
            <slot :node="node" :start-drag="startDrag" :reset-drag="resetDrag" />
            <div v-if="dropTarget === node.id && dropPosition === 'after'" class="weave-drop-line" :style="{ top: dropRowHeight + 'px' }" aria-hidden="true" />
        </div>
    </div>
</template>

<script>
import { planBlockDrop, reorderNodes } from '../lib/reorder';

export default {
    props: { blocks: { type: Array, default: () => [] } },

    data() {
        return { dragId: null, dropTarget: null, dropPosition: null, swapTarget: null, dropRowHeight: 0 };
    },

    methods: {
        startDrag(event, node) {
            if (node.locked) {
                event.preventDefault();
                return;
            }
            this.dragId = node.id;
            event.dataTransfer.effectAllowed = 'move';
            event.dataTransfer.setData('text/plain', node.id);
        },

        onDragOver(event, nodeId) {
            if (!this.dragId) return;
            // Use the row header, never the height of its expanded descendants.
            const row = event.currentTarget.querySelector('[data-weave-block-row]');
            if (!row) return;
            const rect = row.getBoundingClientRect();
            this.dropRowHeight = rect.height;
            const offset = (event.clientY - rect.top) / rect.height;
            const position = offset < 0.25 ? 'before' : offset > 0.75 ? 'after' : 'swap';
            const plan = planBlockDrop(this.blocks, this.dragId, nodeId, position);
            event.dataTransfer.dropEffect = plan ? 'move' : 'none';
            this.dropTarget = plan ? nodeId : null;
            this.dropPosition = plan ? position : null;
            this.swapTarget = plan?.mode === 'swap' ? plan.destinationId : null;
        },

        onDrop(event, nodeId) {
            if (nodeId === this.dropTarget) {
                const plan = planBlockDrop(this.blocks, this.dragId, nodeId, this.dropPosition);
                if (plan) reorderNodes(this.blocks, plan.items);
            }
            this.resetDrag();
        },

        onDragLeave(event) {
            if (event.currentTarget.contains(event.relatedTarget)) return;
            this.dropTarget = null;
            this.dropPosition = null;
            this.swapTarget = null;
        },

        resetDrag() {
            this.dragId = null;
            this.dropTarget = null;
            this.dropPosition = null;
            this.swapTarget = null;
        },
    },
};
</script>

<style scoped>
.weave-block-list-item {
    position: relative;
}
.weave-block-list-item.is-dragging > :deep(div > [data-weave-block-row]) {
    opacity: 0.45;
}
.weave-block-list-item.is-swap-target > :deep(div > [data-weave-block-row]) {
    outline: 1px solid var(--color-sky-500, #0ea5e9);
    outline-offset: -1px;
}
.weave-drop-line {
    position: absolute;
    inset-inline: 0;
    height: 2px;
    background: var(--color-sky-500, #0ea5e9);
    pointer-events: none;
    z-index: 1;
}
.weave-drop-line.is-before { top: 0; }
</style>
