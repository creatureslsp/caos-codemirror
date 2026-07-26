/** Debounced free-text search input filtering the currently-visible list in place. */
import { useEffect, useRef, useState } from "preact/hooks";

export interface SearchBarProps {
  onChange: (query: string) => void;
  debounceMs?: number;
}

export function SearchBar(props: SearchBarProps) {
  const { onChange, debounceMs = 200 } = props;
  const [value, setValue] = useState("");
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (timeoutRef.current !== null) clearTimeout(timeoutRef.current);
    };
  }, []);

  function handleInput(next: string): void {
    setValue(next);
    if (timeoutRef.current !== null) clearTimeout(timeoutRef.current);
    timeoutRef.current = setTimeout(() => onChange(next), debounceMs);
  }

  return (
    <input
      type="search"
      class="files-search-bar"
      placeholder="Search files and projects…"
      aria-label="Search files and projects"
      value={value}
      onInput={(event) => handleInput((event.target as HTMLInputElement).value)}
    />
  );
}
