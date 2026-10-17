<script>
import { h, resolveComponent } from 'vue';
import AssetBrowserModal from './AssetBrowserModal.vue';

// Keep Statamic's asset field, selector and upload/selection behavior intact.
// Only its local Stack component is replaced; other CP stacks stay native.
export default {
    inheritAttrs: false,

    setup(props, { attrs }) {
        const assets = {
            extends: resolveComponent('assets-fieldtype'),
            components: { Stack: AssetBrowserModal },
        };

        return () => h(assets, attrs);
    },
};
</script>
