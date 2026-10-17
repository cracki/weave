<template>
    <div class="fixed inset-0 z-40" @click="$emit('close')" @contextmenu.prevent="$emit('close')" />

    <div
        class="fixed z-50 min-w-40 rounded-md border border-gray-200 bg-white py-1 shadow-lg dark:border-gray-700 dark:bg-gray-800"
        :dir="uiDirection"
        :style="{ top: `${y}px`, insetInlineStart: uiDirection === 'rtl' ? `calc(100vw - ${x}px)` : `${x}px` }"
    >
        <button
            v-for="item in items"
            :key="item.action"
            type="button"
            class="weave-context-item flex w-full items-center gap-2 px-3 py-1.5 text-sm text-gray-700 hover:bg-gray-100 disabled:cursor-not-allowed disabled:text-gray-300 disabled:hover:bg-transparent dark:text-gray-200 dark:hover:bg-gray-700"
            :disabled="item.disabled"
            @click="$emit('action', item.action)"
        >
            <Icon :name="item.icon" class="size-4 shrink-0 text-gray-400" />
            {{ item.label }}
        </button>
    </div>
</template>

<script>
import { Icon, useUiDirection } from '@statamic/cms/ui';

export default {
    setup() {
        const { direction } = useUiDirection();
        return { uiDirection: direction };
    },

    components: { Icon },

    props: {
        x: { type: Number, required: true },
        y: { type: Number, required: true },
        items: { type: Array, required: true },
    },

    emits: ['action', 'close'],
};
</script>

<style>
.weave-context-item {
    text-align: start;
}
</style>
