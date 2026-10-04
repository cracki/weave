// crypto.randomUUID() only exists in secure contexts (HTTPS or localhost) —
// the CP is routinely served over plain http on local dev domains
// (Laragon *.test, Valet *.test, ...), where the API is undefined and adding
// a block/column throws "crypto.randomUUID is not a function". Fall back to
// the MDN polyfill, which builds a v4 UUID from crypto.getRandomValues
// (available in insecure contexts).
export default function uuid() {
    if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
        return crypto.randomUUID();
    }

    return '10000000-1000-4000-8000-100000000000'.replace(/[018]/g, (c) =>
        (+c ^ crypto.getRandomValues(new Uint8Array(1))[0] & 15 >> +c / 4).toString(16),
    );
}
