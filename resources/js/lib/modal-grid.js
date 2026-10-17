// Route every Grid in a Weave configuration to the same modal editor,
// including grids and asset browsers in Grid rows, Replicator sets, and Bard
// sets. Leave Statamic's global registrations and the blueprint untouched.
export function modalGridConfig(config) {
    if (Array.isArray(config)) return config.map(modalGridConfig);
    if (config === null || typeof config !== 'object') return config;

    const result = Object.fromEntries(Object.entries(config).map(([key, value]) => [key, modalGridConfig(value)]));

    if (result.type === 'grid') {
        result.component = 'weave-modal-grid';
        result.fullscreen = false;
        result.hide_display = true;
    }

    if (result.type === 'assets' && (!result.component || result.component === 'assets')) {
        result.component = 'weave-modal-assets';
    }

    return result;
}
