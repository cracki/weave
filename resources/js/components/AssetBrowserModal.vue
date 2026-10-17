<template>
    <Modal
        :open="open"
        :aria-label="__('Browse Assets')"
        class="weave-asset-browser-modal"
        @update:open="$emit('update:open', $event)"
        @opened="$emit('opened')"
    >
        <slot />
    </Modal>
</template>

<script>
import { Modal } from '@statamic/cms/ui';

export default {
    inheritAttrs: false,
    components: { Modal },
    props: { open: { type: Boolean, default: false } },
    emits: ['update:open', 'opened'],
};
</script>

<style>
.weave-asset-browser-modal {
    top: 50%;
    width: min(80rem, calc(100vw - 2rem));
    max-width: 80rem;
    height: min(52rem, calc(100dvh - 4rem));
    max-height: calc(100dvh - 4rem);
    translate: -50% -50%;
    padding: 0;
    overflow: hidden;
    background: var(--color-white, #fff);
}

/* Give the unchanged selector the same full-height surface as its old Stack. */
.weave-asset-browser-modal > div:first-child {
    height: 100%;
    max-height: none;
    margin: 0;
    padding: 0;
    overflow: hidden;
    border: 0;
    border-radius: inherit;
    background: transparent;
    box-shadow: none;
}

.dark .weave-asset-browser-modal {
    background: var(--color-gray-850, #202025);
}

@media (max-width: 639px) {
    .weave-asset-browser-modal {
        width: calc(100vw - 1rem);
        height: calc(100dvh - 2rem);
        max-height: calc(100dvh - 2rem);
    }
}

@media (prefers-reduced-motion: reduce) {
    .weave-asset-browser-modal {
        transition-duration: 0ms;
    }
}
</style>
