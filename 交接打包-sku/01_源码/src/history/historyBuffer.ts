export class HistoryBuffer<T> {
  private past: Array<{ value: T; key: string }> = [];
  private future: Array<{ value: T; key: string }> = [];
  private present: { value: T; key: string };

  constructor(initial: T, key: string, private readonly limit = 30) {
    this.present = { value: initial, key };
  }

  reset(value: T, key: string) {
    this.past = [];
    this.future = [];
    this.present = { value, key };
  }

  seed(past: Array<{ value: T; key: string }>, value: T, key: string) {
    this.past = past.filter((entry) => entry.key !== key).slice(-this.limit);
    this.future = [];
    this.present = { value, key };
  }

  commit(value: T, key: string) {
    if (key === this.present.key) return;
    this.past.push(this.present);
    if (this.past.length > this.limit) this.past.shift();
    this.present = { value, key };
    this.future = [];
  }

  undo(current: T, currentKey: string): T | undefined {
    if (currentKey !== this.present.key) {
      this.future.push({ value: current, key: currentKey });
      return this.present.value;
    }
    const previous = this.past.pop();
    if (!previous) return undefined;
    this.future.push(this.present);
    this.present = previous;
    return previous.value;
  }

  redo(currentKey: string): T | undefined {
    if (currentKey !== this.present.key) return undefined;
    const next = this.future.pop();
    if (!next) return undefined;
    this.past.push(this.present);
    if (this.past.length > this.limit) this.past.shift();
    this.present = next;
    return next.value;
  }

  get canUndo() { return this.past.length > 0; }
  get canRedo() { return this.future.length > 0; }
  get presentKey() { return this.present.key; }
}
