<template>
    <Textarea
        class="weave-elastic-text"
        elastic
        resize="none"
        :rows="config.type === 'textarea' ? (config.rows ?? 3) : 1"
        :model-value="value == null ? '' : String(value)"
        :id="fieldId"
        :name="name"
        dir="auto"
        :read-only="isReadOnly"
        :disabled="config.disabled"
        :limit="config.character_limit || null"
        :placeholder="__(config.placeholder || '')"
        @update:model-value="update"
        @focus="$emit('focus')"
        @blur="$emit('blur')"
    />
</template>

<script>
import { Fieldtype } from '@statamic/cms';
import { Textarea } from '@statamic/cms/ui';

// Retain the original field type and validation. Only its dialog control changes;
// Statamic's elastic textarea handles wrapping, resizing, and character counts.
export default {
    mixins: [Fieldtype.mixin],
    components: { Textarea },
};
</script>

<style>
.weave-elastic-text textarea {
    min-height: 40px;
    padding-block: 8px;
    line-height: 1.5;
    white-space: pre-wrap;
    overflow-wrap: anywhere;
    word-break: break-word;
}
</style>
