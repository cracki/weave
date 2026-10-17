// Keep direction on the editable element itself. Setting it on the field's
// wrapper would let translated labels or buttons determine the input's direction.
const TEXT_CONTROLS = 'input:not([type]), input[type="text"], input[type="search"], input[type="email"], input[type="url"], input[type="tel"], input[type="password"], textarea, [contenteditable="true"], [contenteditable="plaintext-only"]';
const observers = new WeakMap();

function applyDirection(root) {
    const controls = [...root.querySelectorAll(TEXT_CONTROLS)];
    if (root.matches(TEXT_CONTROLS)) controls.unshift(root);
    for (const control of controls) {
        if (control.getAttribute('dir') !== 'auto') control.setAttribute('dir', 'auto');
    }
}

export default {
    mounted(element) {
        applyDirection(element);
        const observer = new MutationObserver((records) => {
            for (const record of records) {
                if (record.type === 'attributes') applyDirection(record.target);
                else for (const node of record.addedNodes) {
                    if (node.nodeType === 1) applyDirection(node);
                }
            }
        });
        // Dynamic fields, nested rows and controls which reset their own dir
        // stay automatic. Native dir=auto responds to typing without JS scans.
        observer.observe(element, { subtree: true, childList: true, attributes: true, attributeFilter: ['dir'] });
        observers.set(element, observer);
    },
    beforeUnmount(element) {
        observers.get(element)?.disconnect();
        observers.delete(element);
    },
};
