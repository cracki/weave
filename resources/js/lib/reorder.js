// A reorder must be a complete permutation of the current siblings. Reject
// stale or malformed drag results before they can remove or corrupt blocks.
export function reorderNodes(nodes, items) {
    if (!Array.isArray(items) || items.length !== nodes.length) return false;

    const byId = new Map(nodes.map((node) => [node.id, node]));
    const seen = new Set();
    const ordered = [];

    for (const item of items) {
        if (!item || !byId.has(item.id) || seen.has(item.id)) return false;
        seen.add(item.id);
        ordered.push(byId.get(item.id));
    }

    if (nodes.some((node, index) => node.locked && ordered[index] !== node)) return false;

    nodes.splice(0, nodes.length, ...ordered);
    return true;
}

// Preview a drop without touching the source array. A gap normally inserts;
// crossing a pinned slot swaps with the row above the gap instead.
export function planBlockDrop(nodes, sourceId, targetId, position) {
    const source = nodes.findIndex(node => node.id === sourceId);
    const target = nodes.findIndex(node => node.id === targetId);
    if (source < 0 || target < 0 || nodes[source].locked) return null;
    if (!['before', 'after', 'swap'].includes(position)) return null;

    const items = [...nodes];
    let destination = target;
    let mode = 'swap';

    if (position !== 'swap') {
        const gap = target + (position === 'after' ? 1 : 0);
        destination = gap > source ? gap - 1 : gap;
        const crossesLock = nodes.some((node, index) => node.locked
            && index >= Math.min(source, destination) && index <= Math.max(source, destination));

        if (!crossesLock) {
            mode = 'insert';
            items.splice(source, 1);
            items.splice(destination, 0, nodes[source]);
        } else {
            destination = Math.max(0, gap - 1);
        }
    }

    if (destination === source || nodes[destination]?.locked) return null;
    if (mode === 'swap') [items[source], items[destination]] = [items[destination], items[source]];
    return { items, mode, destinationId: nodes[destination].id };
}
