const blobIds = new WeakMap<Blob, number>();
let nextBlobId = 1;

export function snapshotKey(value: unknown): string {
  return JSON.stringify(value, (_key, item: unknown) => {
    if (item instanceof Blob) {
      let id = blobIds.get(item);
      if (!id) {
        id = nextBlobId++;
        blobIds.set(item, id);
      }
      return { $blob: id, type: item.type, size: item.size };
    }
    if (typeof HTMLImageElement !== 'undefined' && item instanceof HTMLImageElement) return undefined;
    return item;
  });
}
