// Thin host capabilities: the algorithms passed to map/fold stay in Mira.
// Input arrays are bounded to keep interactive examples responsive.
const MAX_ITEMS = 10000;

export function collectionHost() {
  const api = Object.create(null);

  api['get:from:'] = (key, record) => {
    if (typeof key !== 'string' || !record || typeof record !== 'object' ||
        !Object.hasOwn(record, key)) {
      throw new Error('Missing record field: ' + String(key));
    }
    return record[key];
  };

  api['filter:with:'] = (items, predicate) => {
    if (!Array.isArray(items) || typeof predicate !== 'function' ||
        items.length > MAX_ITEMS) {
      throw new Error('filter:with: expects a bounded list and predicate');
    }
    return items.filter(item => predicate(item));
  };

  api['map:with:'] = (items, callback) => {
    if (!Array.isArray(items) || typeof callback !== 'function' ||
        items.length > MAX_ITEMS) {
      throw new Error('map:with: expects a bounded list and function');
    }
    return items.map(value => callback(value));
  };

  api['fold:with:from:'] = (items, callback, initial) => {
    if (!Array.isArray(items) || typeof callback !== 'function' ||
        items.length > MAX_ITEMS) {
      throw new Error('fold:with:from: expects a bounded list and function');
    }
    return items.reduce((acc, item) => callback(acc, item), initial);
  };
  return Object.freeze(api);
}
