/** Sort-field + direction control shared by the project and file lists. */
import type { SortDirection, SortField } from "../storage/search.js";
import { ArrowDownwardIcon, ArrowUpwardIcon } from "../icons.js";

export interface SortControlProps {
  sortBy: SortField;
  sortDirection: SortDirection;
  onChange: (sortBy: SortField, sortDirection: SortDirection) => void;
}

const FIELDS: { value: SortField; label: string }[] = [
  { value: "name", label: "Name" },
  { value: "createdDate", label: "Created" },
  { value: "lastModifiedDate", label: "Modified" }
];

export function SortControl(props: SortControlProps) {
  const { sortBy, sortDirection, onChange } = props;

  return (
    <div class="files-sort-control">
      <select
        aria-label="Sort by"
        value={sortBy}
        onChange={(event) => onChange((event.target as HTMLSelectElement).value as SortField, sortDirection)}
      >
        {FIELDS.map((field) => (
          <option key={field.value} value={field.value}>
            {field.label}
          </option>
        ))}
      </select>
      <button
        type="button"
        class="icon-btn"
        aria-label={sortDirection === "asc" ? "Ascending" : "Descending"}
        onClick={() => onChange(sortBy, sortDirection === "asc" ? "desc" : "asc")}
      >
        {sortDirection === "asc" ? <ArrowUpwardIcon /> : <ArrowDownwardIcon />}
      </button>
    </div>
  );
}
