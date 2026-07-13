import { useState, useEffect } from "react";

export function useLocalStorage(key, initialValue) {
  // Get stored value from localStorage
  const readStoredValue = () => {
    if (typeof window === "undefined") {
      return initialValue;
    }

    try {
      const item = window.localStorage.getItem(key);
      return item ? JSON.parse(item) : initialValue;
    } catch (error) {
      console.warn(`Error reading localStorage key "${key}":`, error);
      return initialValue;
    }
  };

  const [storedValue, setStoredValue] = useState(readStoredValue);

  // Update localStorage when state changes
  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    try {
      window.localStorage.setItem(key, JSON.stringify(storedValue));
    } catch (error) {
      console.warn(`Error setting localStorage key "${key}":`, error);
    }
  }, [key, storedValue]);

  const setValue = (value) => {
    if (typeof value === "function") {
      setStoredValue((prev) => {
        const newValue = value(prev);
        return newValue;
      });
    } else {
      setStoredValue(value);
    }
  };

  const removeValue = () => {
    if (typeof window === "undefined") {
      return;
    }

    try {
      window.localStorage.removeItem(key);
      setStoredValue(initialValue);
    } catch (error) {
      console.warn(`Error removing localStorage key "${key}":`, error);
    }
  };

  return [storedValue, setValue, removeValue];
}