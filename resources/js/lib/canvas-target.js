const normalizeText = (value) => String(value ?? '').replace(/<[^>]*>/g, '').replace(/\s+/g, ' ').trim();

function containsText(value, text) {
    if (typeof value === 'string') return normalizeText(value) === text;
    if (Array.isArray(value)) return value.some((item) => containsText(item, text));
    if (value && typeof value === 'object') {
        return Object.entries(value).some(([key, item]) => key !== '_id' && containsText(item, text));
    }
    return false;
}

// Explicit preview markers take precedence. Text matching also supports custom
// block views, including a heading's separate spans and labels inside Grid rows.
export function resolveCanvasField(node, fields, target = {}) {
    const handles = fields.map((field) => field.handle);
    const explicit = typeof target.field === 'string' ? target.field.split('.')[0] : null;
    if (handles.includes(explicit)) return explicit;

    const semantic = {
        heading: ['lines', 'title', 'heading', 'text', 'content'],
        button: ['buttons', 'button_label', 'label', 'text'],
        image: ['asset', 'image', 'background'],
        caption: ['caption', 'quotes', 'stats'],
        quote: ['quotes', 'quote', 'body'],
        text: ['content', 'body', 'text', 'eyebrow', 'title'],
    }[target.kind] || [];

    const preferred = [...new Set([...semantic, ...handles])].filter((handle) => handles.includes(handle));
    for (const value of target.texts || []) {
        const text = normalizeText(value);
        if (!text) continue;
        const matched = preferred.find((handle) => containsText(node.props?.[handle], text));
        if (matched) return matched;
    }

    const semanticField = semantic.find((handle) => handles.includes(handle));
    if (semanticField) return semanticField;

    const fallback = {
        heading: 'text', text: 'content', button: 'label', image: 'asset',
        image_banner: 'asset', testimonial_carousel: 'quotes', stat_grid: 'stats',
    }[node.type];
    return handles.includes(fallback) ? fallback : null;
}
