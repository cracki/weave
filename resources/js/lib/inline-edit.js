import { resolveCanvasField } from './canvas-target.js';

const normalizeText = (value) => String(value ?? '').replace(/<[^>]*>/g, '').replace(/\s+/g, ' ').trim();
const fieldConfigs = (fields = []) => fields.map((field) => ({
    ...field.field, ...field, field: undefined, prefix: '',
    component: field.component || field.field?.component || field.type || field.field?.type,
}));

function rowFields(field, row) {
    if (field.type === 'grid') return fieldConfigs(field.fields);
    if (field.type !== 'replicator') return [];
    const sets = Object.values(field.sets || {}).flatMap((group) =>
        group.sets ? Object.entries(group.sets) : []);
    const set = field.sets?.[row.type] || sets.find(([handle]) => handle === row.type)?.[1];
    return fieldConfigs(set?.fields);
}

function containsText(value, text) {
    if (typeof value === 'string' || typeof value === 'number') return normalizeText(value) === text;
    if (Array.isArray(value)) return value.some((item) => containsText(item, text));
    if (value && typeof value === 'object') {
        return Object.entries(value).some(([key, item]) => !['_id', 'id', 'type'].includes(key) && containsText(item, text));
    }
    return false;
}

// A row owns a publish scope regardless of its depth. Metadata follows row IDs,
// while value paths follow indices; never use an index to look up row metadata.
export function resolveInlineScope(node, fields, target = {}, meta = {}) {
    const rows = [];
    function visit(values, configs, metadata, path = [], metaPath = []) {
        for (const field of configs) {
            if (!['grid', 'replicator'].includes(field.type) || !Array.isArray(values?.[field.handle])) continue;
            values[field.handle].forEach((row, index) => {
                const children = rowFields(field, row);
                const rowPath = [...path, field.handle, String(index)];
                const rowMetaPath = [...metaPath, field.handle, 'existing', row._id];
                const rowMeta = metadata?.[field.handle]?.existing?.[row._id] || {};
                const scope = {
                    path: rowPath, metaPath: rowMetaPath, values: row, meta: rowMeta,
                    fields: children, rowId: row._id, title: `${field.display || field.handle} · ${index + 1}`,
                };
                rows.push(scope);
                visit(row, children, rowMeta, rowPath, rowMetaPath);
            });
        }
    }
    const configs = fieldConfigs(fields);
    visit(node.props, configs, meta);

    // Explicit identity handles duplicated labels, icons, images, and empty rows.
    if (target.row) return rows.find((row) => row.rowId === target.row) || null;
    if (typeof target.field === 'string') {
        const path = target.field.split('.');
        const explicit = rows.filter((row) => row.path.every((part, index) => path[index] === part))
            .sort((a, b) => b.path.length - a.path.length)[0];
        if (explicit) return explicit;
    }

    // Custom views without markers can still identify an unambiguous text row.
    const handle = resolveCanvasField(node, configs, target);
    for (const value of target.texts || []) {
        const text = normalizeText(value);
        if (!text) continue;
        const matches = rows.filter((row) => (!handle || row.path[0] === handle) && containsText(row.values, text));
        const deepest = matches.filter((row) => !matches.some((child) =>
            child.path.length > row.path.length && row.path.every((part, index) => child.path[index] === part)));
        if (deepest.length === 1) return deepest[0];
    }
    const selected = handle ? configs.filter((field) => field.handle === handle) : configs;
    return {
        path: [], metaPath: [], values: node.props ?? {}, meta, fields: selected, rowId: null,
        title: selected.length === 1 ? selected[0].display || selected[0].handle : node.type,
    };
}

// Re-resolve by identity at Done: rows may have moved or disappeared while open.
// Merge only this dialog's fields, preserving siblings, parent values, and IDs.
export function applyInlineEdit(node, fields, meta, edit) {
    const scope = resolveInlineScope(node, fields, edit.target, meta);
    if (!scope || scope.rowId !== edit.rowId) return false;
    for (const field of edit.fields) {
        scope.values[field.handle] = edit.values[field.handle];
        if (Object.hasOwn(edit.meta, field.handle)) scope.meta[field.handle] = edit.meta[field.handle];
    }
    return true;
}
