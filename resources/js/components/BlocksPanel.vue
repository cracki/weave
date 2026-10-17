<template>
    <div class="weave-blocks-content p-3">
        <Button text="Add Block" icon="plus" class="mb-3 w-full" @click="openAddPicker(null)" />

        <Modal v-model:open="pickerOpen" class="weave-block-picker max-w-3xl" @opened="focusSearch">
            <div class="flex items-center justify-between gap-3">
                <ModalTitle class="text-base font-semibold">Add Block</ModalTitle>
                <Button icon="x" aria-label="Close block picker" icon-only size="sm" variant="ghost" @click="pickerOpen = false" />
            </div>

            <div class="mt-4">
                <label :for="searchId" class="mb-1 block text-sm font-medium">Search blocks</label>
                <input
                    :id="searchId"
                    ref="search"
                    v-model="searchQuery"
                    type="search"
                    dir="auto"
                    placeholder="Search by name or category…"
                    class="weave-block-search w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm text-gray-800 placeholder:text-gray-500 focus:border-sky-500 focus:outline-none focus:ring-2 focus:ring-sky-500 dark:border-gray-600 dark:bg-gray-900 dark:text-gray-100 dark:placeholder:text-gray-400"
                />
            </div>

            <Tabs v-model="categoryTab" class="weave-block-picker-tabs mt-3">
                <TabList class="weave-scroll weave-block-picker-tab-list whitespace-nowrap" aria-label="Filter blocks by category">
                    <TabTrigger name="all" text="All" />
                    <TabTrigger v-for="category in categories" :key="category" :name="`category:${category}`" :text="category" />
                </TabList>

                <TabContent :name="categoryTab" class="weave-scroll weave-block-picker-results mt-4">
                    <section v-for="(items, category) in grouped" :key="category" class="mb-5">
                        <h3 class="mb-2 text-sm font-semibold text-gray-700 dark:text-gray-200">{{ category }}</h3>
                        <div class="weave-block-picker-grid grid grid-cols-2 gap-2 sm:grid-cols-5">
                            <button
                                v-for="block in items"
                                :key="block.type"
                                type="button"
                                class="flex min-h-24 flex-col items-center justify-center gap-2 rounded-md border border-gray-200 p-3 text-center hover:border-sky-500 hover:bg-gray-50 focus-visible:outline-2 focus-visible:outline-sky-500 dark:border-gray-700 dark:hover:bg-gray-800"
                                @click="choose(block.type)"
                            >
                                <span v-if="block.iconSvg" class="inline-flex size-6 items-center justify-center text-gray-500 dark:text-gray-400 [&_svg]:size-6" v-html="block.iconSvg" />
                                <Icon v-else :name="block.icon || 'puzzle-piece'" class="size-6 text-gray-500 dark:text-gray-400" />
                                <span class="text-sm font-medium">{{ block.label }}</span>
                            </button>
                        </div>
                    </section>
                    <p v-if="!Object.keys(grouped).length" class="py-8 text-center text-sm text-gray-500 dark:text-gray-400" role="status">
                        No blocks match your search. Try another name or category.
                    </p>
                </TabContent>
            </Tabs>
        </Modal>

        <div v-show="blocks.length" class="mb-3">
            <button
                type="button"
                class="mb-1 flex w-full items-center gap-1 px-1 text-xs font-semibold uppercase text-gray-500 dark:text-gray-400"
                :aria-expanded="!sectionsCollapsed"
                @click="sectionsCollapsed = !sectionsCollapsed"
            >
                <Icon :name="sectionsCollapsed ? 'chevron-right' : 'chevron-down'" class="weave-disclosure-icon size-3" :class="{ 'is-collapsed': sectionsCollapsed }" />
                List view
            </button>

            <BlockList v-if="!sectionsCollapsed" :blocks="blocks">
                <template #default="{ node, startDrag, resetDrag }">
                    <BlockNode
                        :node="node"
                        :block-types="blockTypes"
                        :selected-id="selectedId"
                        @select="$emit('select', $event)"
                        @remove="$emit('remove', $event)"
                        @duplicate="$emit('duplicate', $event)"
                        @add="openAddPicker($event)"
                        @drag-start="startDrag"
                        @drag-end="resetDrag"
                    />
                </template>
            </BlockList>
        </div>

        <div v-if="!blocks.length" class="rounded-md border-2 border-dashed border-gray-200 p-6 text-center text-sm text-gray-500 dark:border-gray-700 dark:text-gray-400">
            Use “Add Block” above to add your first block.
        </div>
    </div>
</template>

<script>
import { Button, Icon, Modal, ModalTitle, Tabs, TabList, TabTrigger, TabContent } from '@statamic/cms/ui';
import BlockNode from './BlockNode.vue';
import BlockList from './BlockList.vue';
import uuid from '../lib/uuid';

export default {
    components: { Button, Icon, Modal, ModalTitle, Tabs, TabList, TabTrigger, TabContent, BlockNode, BlockList },

    props: {
        blocks: { type: Array, default: () => [] },
        blockTypes: { type: Array, default: () => [] },
        selectedId: { type: String, default: null },
    },

    emits: ['select', 'remove', 'duplicate', 'add'],

    data() {
        return {
            searchId: `weave-block-search-${uuid()}`,
            addingParentId: null,
            pickerOpen: false,
            searchQuery: '',
            selectedCategory: null,
            sectionsCollapsed: false,
        };
    },

    computed: {
        categoryTab: {
            get() { return this.selectedCategory === null ? 'all' : `category:${this.selectedCategory}`; },
            set(value) { this.selectedCategory = value === 'all' ? null : value.slice('category:'.length); },
        },

        categories() {
            return [...new Set(this.blockTypes.map(block => block.category || 'Other'))];
        },

        grouped() {
            const query = this.searchQuery.trim().toLocaleLowerCase();
            return this.blockTypes.reduce((groups, block) => {
                const category = block.category || 'Other';
                if (this.selectedCategory !== null && this.selectedCategory !== category) return groups;
                if (query && !`${block.label} ${block.type} ${category}`.toLocaleLowerCase().includes(query)) return groups;
                (groups[category] = groups[category] || []).push(block);
                return groups;
            }, {});
        },
    },

    methods: {
        openAddPicker(parentId = null) {
            this.addingParentId = parentId;
            this.searchQuery = '';
            this.selectedCategory = null;
            this.pickerOpen = true;
        },

        focusSearch() {
            // Focus after Modal's own initial focus pass.
            requestAnimationFrame(() => this.$refs.search?.focus());
        },

        choose(type) {
            this.$emit('add', { type, parentId: this.addingParentId || null });
            this.addingParentId = null;
            this.pickerOpen = false;
        },
    },
};
</script>

<style>
.weave-blocks-content {
    padding-inline-end: 6px;
}

.weave-block-search {
    text-align: start;
}

.weave-block-picker {
    width: min(48rem, calc(100vw - 32px));
    max-width: 48rem;
    top: 8vh;
    max-height: 84vh;
}
.weave-block-picker > div:first-child {
    display: flex;
    flex-direction: column;
    min-height: 0;
    max-height: calc(84vh - 16px);
    overflow: hidden;
}
.weave-block-picker > div:first-child > :not(.weave-block-picker-tabs) {
    flex-shrink: 0;
}
.weave-block-picker-tabs {
    display: flex;
    flex-direction: column;
    min-height: 0;
}
.weave-block-picker-tab-list {
    flex-shrink: 0;
    overflow-x: auto;
    overflow-y: hidden;
    padding-block: 2px;
}
@media (min-width: 640px) {
    .weave-block-picker-grid {
        grid-template-columns: repeat(5, minmax(0, 1fr));
    }
}
.weave-block-picker-results {
    min-height: 0;
    max-height: min(55vh, 480px);
    overflow-y: auto;
    overscroll-behavior: contain;
}
</style>
