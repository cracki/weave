// Route every Grid in a Weave configuration to the same modal editor,
// including grids in Grid rows, Replicator sets, and Bard sets. Leave
// Statamic's global Grid registration and the shared blueprint untouched.
export function modalGridConfig(config) {
    if (Array.isArray(config)) return config.map(modalGridConfig);
    if (config === null || typeof config !== 'object') return config;

    const result = Object.fromEntries(Object.entries(config).map(([key, value]) => [key, modalGridConfig(value)]));

    if (result.type === 'grid') {
        result.component = 'weave-modal-grid';
        result.fullscreen = false;
        result.hide_display = true;
    }

    return result;
}
