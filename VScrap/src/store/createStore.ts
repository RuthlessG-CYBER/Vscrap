import { useSyncExternalStore } from 'react';

/**
 * Imperative API attached onto the callable store hook.
 */
export interface StoreApi<S extends object> {
  <T>(selector: (s: S) => T): T;
  getState: () => S;
  setState: (
    partial: Partial<S> | ((prev: S) => Partial<S>)
  ) => void;
  subscribe: (listener: () => void) => () => void;
}

/**
 * A tiny Zustand-compatible store.
 *
 * `createStore(initial)` returns a hook-like function `useStore(selector)`
 * that re-renders the component only when the selected slice changes. The
 * returned function also carries `.getState()`, `.setState(partial)` and
 * `.subscribe(listener)` so actions can read/write state outside components.
 *
 * Usage:
 *   const useStore = createStore({ count: 0 });
 *   const count = useStore((s) => s.count);        // in a component
 *   useStore.setState((s) => ({ count: s.count + 1 })); // anywhere
 */
export function createStore<S extends object>(initial: S): StoreApi<S> {
  let state: S = initial;
  const listeners = new Set<() => void>();

  const getState = () => state;

  const setState = (
    partial: Partial<S> | ((prev: S) => Partial<S>)
  ): void => {
    const next =
      typeof partial === 'function' ? partial(state) : partial;
    state = { ...state, ...next } as S;
    for (const listener of listeners) listener();
  };

  const subscribe = (listener: () => void): (() => void) => {
    listeners.add(listener);
    return () => {
      listeners.delete(listener);
    };
  };

  const useStore = <T>(selector: (s: S) => T): T =>
    useSyncExternalStore(
      subscribe,
      () => selector(getState()),
      // Server snapshot: SSR renders the initial store state. On the client,
      // getSnapshot takes over and triggers re-renders as state changes.
      () => selector(initial)
    );

  // Attach imperative APIs onto the callable hook.
  Object.assign(useStore, { getState, setState, subscribe });

  return useStore as StoreApi<S>;
}
