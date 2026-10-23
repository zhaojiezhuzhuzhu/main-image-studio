import { useCallback, useEffect, useRef, useState } from 'react';
import { snapshotKey } from '../project/snapshotKey';
import { HistoryBuffer } from './historyBuffer';

type UseUndoHistoryOptions<T> = {
  enabled: boolean;
  value: T;
  apply: (value: T) => void;
  limit?: number;
  settleMs?: number;
};

export function useUndoHistory<T>({ enabled, value, apply, limit = 30, settleMs = 450 }: UseUndoHistoryOptions<T>) {
  const valueRef = useRef(value);
  const applyRef = useRef(apply);
  const bufferRef = useRef<HistoryBuffer<T> | undefined>(undefined);
  const timerRef = useRef<number | undefined>(undefined);
  const key = snapshotKey(value);
  const [, refresh] = useState(0);

  valueRef.current = value;
  applyRef.current = apply;

  const updateControls = useCallback(() => refresh((current) => current + 1), []);

  useEffect(() => {
    if (!enabled) return;
    if (!bufferRef.current) {
      bufferRef.current = new HistoryBuffer(valueRef.current, key, limit);
      updateControls();
      return;
    }
    if (key === bufferRef.current.presentKey) {
      updateControls();
      return;
    }
    window.clearTimeout(timerRef.current);
    updateControls();
    timerRef.current = window.setTimeout(() => {
      bufferRef.current?.commit(valueRef.current, snapshotKey(valueRef.current));
      updateControls();
    }, settleMs);
    return () => window.clearTimeout(timerRef.current);
  }, [enabled, key, limit, settleMs, updateControls]);

  const undo = useCallback(() => {
    const buffer = bufferRef.current;
    if (!buffer) return;
    window.clearTimeout(timerRef.current);
    const current = valueRef.current;
    const next = buffer.undo(current, snapshotKey(current));
    if (next !== undefined) applyRef.current(next);
    updateControls();
  }, [updateControls]);

  const redo = useCallback(() => {
    const buffer = bufferRef.current;
    if (!buffer) return;
    window.clearTimeout(timerRef.current);
    const next = buffer.redo(snapshotKey(valueRef.current));
    if (next !== undefined) applyRef.current(next);
    updateControls();
  }, [updateControls]);

  const commit = useCallback((next: T) => {
    window.clearTimeout(timerRef.current);
    const buffer = bufferRef.current;
    if (!buffer) return;
    buffer.commit(valueRef.current, snapshotKey(valueRef.current));
    buffer.commit(next, snapshotKey(next));
    updateControls();
  }, [updateControls]);

  const reset = useCallback((next: T) => {
    window.clearTimeout(timerRef.current);
    const nextKey = snapshotKey(next);
    if (bufferRef.current) bufferRef.current.reset(next, nextKey);
    else bufferRef.current = new HistoryBuffer(next, nextKey, limit);
    updateControls();
  }, [limit, updateControls]);

  const seed = useCallback((past: T[], next: T) => {
    window.clearTimeout(timerRef.current);
    const nextKey = snapshotKey(next);
    const entries = past.map((value) => ({ value, key: snapshotKey(value) }));
    if (bufferRef.current) bufferRef.current.seed(entries, next, nextKey);
    else {
      bufferRef.current = new HistoryBuffer(next, nextKey, limit);
      bufferRef.current.seed(entries, next, nextKey);
    }
    updateControls();
  }, [limit, updateControls]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (!(event.ctrlKey || event.metaKey) || event.altKey) return;
      const keyName = event.key.toLowerCase();
      if (keyName === 'z' && !event.shiftKey) {
        event.preventDefault();
        undo();
      } else if (keyName === 'y' || (keyName === 'z' && event.shiftKey)) {
        event.preventDefault();
        redo();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [redo, undo]);

  const buffer = bufferRef.current;
  const dirty = Boolean(buffer && key !== buffer.presentKey);
  return {
    undo,
    redo,
    commit,
    reset,
    seed,
    canUndo: dirty || Boolean(buffer?.canUndo),
    canRedo: !dirty && Boolean(buffer?.canRedo),
  };
}
