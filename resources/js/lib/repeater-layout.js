import { readonly, ref } from 'vue';

export const REPEATER_LAYOUT_KEY = 'weave.repeater-layout';
const layouts = ['split', 'accordion'];
const normalize = (value) => layouts.includes(value) ? value : 'split';

function readLayout() {
    try {
        return normalize(window.localStorage.getItem(REPEATER_LAYOUT_KEY));
    } catch {
        return 'split';
    }
}

// One preference for every mounted editor, including editors in nested modals.
const layout = ref(readLayout());
export const repeaterLayout = readonly(layout);

export function setRepeaterLayout(value) {
    if (!layouts.includes(value)) return;
    layout.value = value;
    try {
        window.localStorage.setItem(REPEATER_LAYOUT_KEY, value);
    } catch {
        // The current session still works when browser storage is unavailable.
    }
}

if (typeof window !== 'undefined') {
    window.addEventListener('storage', (event) => {
        if (event.key === REPEATER_LAYOUT_KEY || event.key === null) layout.value = readLayout();
    });
}
