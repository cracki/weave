// Minimal dotted-path helpers, mirroring Statamic's data_get/data_set — those
// aren't exported from @statamic/cms, and the scoped node container needs them
// to resolve nested paths like `buttons.0.label` against the node's props.
export function data_get(target, path, fallback = null) {
    const value = String(path)
        .split('.')
        .reduce((carry, key) => (carry === null || carry === undefined ? undefined : carry[key]), target);

    return value === undefined ? fallback : value;
}

export function data_set(target, path, value) {
    const keys = String(path).split('.');
    const last = keys.pop();

    let carry = target;
    for (const key of keys) {
        if (carry[key] === null || typeof carry[key] !== 'object') {
            carry[key] = /^\d+$/.test(keys[keys.indexOf(key) + 1] ?? '') ? [] : {};
        }
        carry = carry[key];
    }

    carry[last] = value;

    return target;
}
