import { useState, useCallback, useRef } from 'react';

/**
 * A custom hook for managing undo/redo state history.
 * T is the type of the state being tracked.
 */
export function useUndoRedo<T>(initialState: T) {
  const [current, setCurrent] = useState<T>(initialState);
  const [past, setPast] = useState<T[]>([]);
  const [future, setFuture] = useState<T[]>([]);

  // We use a ref to keep track of the current state for immediate access in push
  const stateRef = useRef<T>(initialState);

  const canUndo = past.length > 0;
  const canRedo = future.length > 0;

  const undo = useCallback(() => {
    if (!canUndo) return;

    const previous = past[past.length - 1];
    const newPast = past.slice(0, past.length - 1);

    setPast(newPast);
    setFuture([current, ...future]);
    setCurrent(previous);
    stateRef.current = previous;
  }, [canUndo, past, current, future]);

  const redo = useCallback(() => {
    if (!canRedo) return;

    const next = future[0];
    const newFuture = future.slice(1);

    setPast([...past, current]);
    setFuture(newFuture);
    setCurrent(next);
    stateRef.current = next;
  }, [canRedo, past, current, future]);

  const updateState = useCallback((newState: T | ((prev: T) => T), skipHistory = false) => {
    setCurrent((prev) => {
      const resolvedState = typeof newState === 'function' ? (newState as any)(prev) : newState;
      
      if (!skipHistory) {
        setPast((p) => [...p, prev]);
        setFuture([]);
      }
      
      stateRef.current = resolvedState;
      return resolvedState;
    });
  }, []);

  return {
    state: current,
    setState: updateState,
    undo,
    redo,
    canUndo,
    canRedo,
  };
}
