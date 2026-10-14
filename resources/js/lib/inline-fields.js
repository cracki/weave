import { modalGridConfig } from './modal-grid.js';

function elasticTextConfig(config) {
    if (Array.isArray(config)) return config.map(elasticTextConfig);
    if (config === null || typeof config !== 'object') return config;
    const result = Object.fromEntries(Object.entries(config).map(([key, value]) => [key, elasticTextConfig(value)]));
    const nativeText = ['text', 'textarea'].includes(result.type)
        && (!result.component || result.component === result.type);
    if (nativeText && (result.type === 'textarea' || !result.input_type || result.input_type === 'text')) {
        result.component = 'weave-elastic-text';
    }
    return result;
}

export function inlineDialogFields(fields) {
    // Dialog fields form one readable column; nested Grid layouts keep their widths.
    return elasticTextConfig(modalGridConfig(fields)).map((field) => ({ ...field, width: 100 }));
}
