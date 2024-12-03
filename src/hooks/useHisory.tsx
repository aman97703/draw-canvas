import { useState } from "react";

// Define the hook with a generic type T for the state
function useHistory<T>(
  initialState: T
): [
  T,
  (action: T | ((prevState: T) => T), overwrite?: Boolean) => void,
  () => void,
  () => void
] {
  const [index, setIndex] = useState<number>(0);
  const [history, setHistory] = useState<T[]>([initialState]);

  // setState accepts either a direct value (T) or a function that returns the new state
  const setState = (
    action: T | ((prevState: T) => T),
    overwrite: Boolean = false
  ) => {
    const newState =
      typeof action === "function"
        ? (action as (prevState: T) => T)(history[index])
        : action;

    // Update the history and index
    if (overwrite) {
      const historyCopy = [...history];
      historyCopy[index] = newState;
      setHistory(historyCopy);
    } else {
      const updatedState = [...history].slice(0, index+1);
      setHistory(() => [...updatedState, newState]);
      setIndex((prev) => prev + 1);
    }
  };

  const undo = () => {
    if (index > 0) {
      setIndex((prev) => prev - 1);
    }
  };
  const redo = () => {
    if (index < history.length - 1) {
      setIndex((prev) => prev + 1);
    }
  };

  return [history[index], setState, undo, redo] as const;
}

export default useHistory;
