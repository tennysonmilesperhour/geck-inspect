import * as React from 'react';

/**
 * Lightweight in-memory toast store. Subscribes are kept in a
 * module-level array so any component can fire a toast without needing
 * a surrounding provider ,  the <Toaster /> mounted once in App.jsx is
 * the single UI consumer.
 *
 * Differences from the stock shadcn generator:
 *   - TOAST_LIMIT is 3 so fast-firing toasts stack instead of replacing.
 *   - The manual `setTimeout(dismiss, duration)` inside `toast()` is
 *     gone ,  Radix Toast handles its own auto-dismiss via the
 *     `duration` prop we forward through. Having both racing each
 *     other was the root cause of toasts flickering in/out.
 *   - Default duration is 3.5s, slightly more generous than the old 2s
 *     so users have time to read the message.
 */

const TOAST_LIMIT = 3;
const TOAST_REMOVE_DELAY = 500; // after dismiss, how long to keep in DOM for exit animation
const DEFAULT_DURATION = 3500;

const actionTypes = {
  ADD_TOAST: 'ADD_TOAST',
  UPDATE_TOAST: 'UPDATE_TOAST',
  DISMISS_TOAST: 'DISMISS_TOAST',
  REMOVE_TOAST: 'REMOVE_TOAST',
};

let count = 0;

function genId() {
  count = (count + 1) % Number.MAX_SAFE_INTEGER;
  return count.toString();
}

const toastTimeouts = new Map();

const addToRemoveQueue = (toastId) => {
  if (toastTimeouts.has(toastId)) return;
  const timeout = setTimeout(() => {
    toastTimeouts.delete(toastId);
    dispatch({ type: actionTypes.REMOVE_TOAST, toastId });
  }, TOAST_REMOVE_DELAY);
  toastTimeouts.set(toastId, timeout);
};

export const reducer = (state, action) => {
  switch (action.type) {
    case actionTypes.ADD_TOAST:
      return {
        ...state,
        toasts: [action.toast, ...state.toasts].slice(0, TOAST_LIMIT),
      };

    case actionTypes.UPDATE_TOAST:
      return {
        ...state,
        toasts: state.toasts.map((t) =>
          t.id === action.toast.id ? { ...t, ...action.toast } : t
        ),
      };

    case actionTypes.DISMISS_TOAST: {
      const { toastId } = action;
      if (toastId) {
        addToRemoveQueue(toastId);
      } else {
        state.toasts.forEach((t) => addToRemoveQueue(t.id));
      }
      return {
        ...state,
        toasts: state.toasts.map((t) =>
          t.id === toastId || toastId === undefined ? { ...t, open: false } : t
        ),
      };
    }

    case actionTypes.REMOVE_TOAST:
      if (action.toastId === undefined) {
        return { ...state, toasts: [] };
      }
      return {
        ...state,
        toasts: state.toasts.filter((t) => t.id !== action.toastId),
      };

    default:
      return state;
  }
};

const listeners = [];
let memoryState = { toasts: [] };

function dispatch(action) {
  memoryState = reducer(memoryState, action);
  listeners.forEach((l) => l(memoryState));
}

function toast({ duration, ...props }) {
  const id = genId();

  const update = (next) =>
    dispatch({ type: actionTypes.UPDATE_TOAST, toast: { ...next, id } });

  const dismiss = () =>
    dispatch({ type: actionTypes.DISMISS_TOAST, toastId: id });

  dispatch({
    type: actionTypes.ADD_TOAST,
    toast: {
      ...props,
      id,
      open: true,
      duration: duration ?? DEFAULT_DURATION,
      // Radix Toast will call this when it auto-dismisses or when the
      // close button is clicked. We mark the toast as closed, then the
      // delayed REMOVE_TOAST pops it out of the DOM after the exit
      // animation.
      onOpenChange: (open) => {
        if (!open) dismiss();
      },
    },
  });

  return { id, dismiss, update };
}

function useToast() {
  const [state, setState] = React.useState(memoryState);

  React.useEffect(() => {
    listeners.push(setState);
    return () => {
      const idx = listeners.indexOf(setState);
      if (idx > -1) listeners.splice(idx, 1);
    };
  }, []);

  return {
    ...state,
    toast,
    dismiss: (toastId) =>
      dispatch({ type: actionTypes.DISMISS_TOAST, toastId }),
  };
}

export { useToast, toast };
