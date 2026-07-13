// src/components/SearchBar.jsx
import { useState, useEffect } from "react";

export default function SearchBar({ placeholder = "Search...", onSearch, delay = 400 }) {
  const [value, setValue] = useState("");

  useEffect(() => {
    const timer = setTimeout(() => onSearch(value), delay);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value]);

  const handleClear = () => setValue("");

  return (
    <div className="search-bar">
      <i className="bi bi-search search-bar__icon"></i>
      <input
        type="text"
        className="search-bar__input"
        placeholder={placeholder}
        value={value}
        onChange={(e) => setValue(e.target.value)}
      />
      {value && (
        <button
          type="button"
          className="search-bar__clear"
          onClick={handleClear}
          aria-label="Clear search"
        >
          <i className="bi bi-x"></i>
        </button>
      )}
    </div>
  );
}