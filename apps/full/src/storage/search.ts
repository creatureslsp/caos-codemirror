// Search-string normalization shared by files.ts/projects.ts: used both to
// populate the `nameNormalized` index field on write and to normalize the
// query string at search time, so the two are always compared like-for-like.

/** Lowercase, strip diacritics, strip whitespace/punctuation. */
export function normalizeForSearch(s: string): string {
  return s
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]/gu, "");
}

export type SortField = "name" | "createdDate" | "lastModifiedDate";
export type SortDirection = "asc" | "desc";

export interface SortOptions {
  sortBy?: SortField;
  sortDirection?: SortDirection;
}

const collator = new Intl.Collator(undefined, { sensitivity: "base" });

export function sortByOptions<
  T extends { name: string; createdDate: number; lastModifiedDate: number }
>(records: T[], options: SortOptions | undefined): T[] {
  const sortBy = options?.sortBy ?? "name";
  const direction = options?.sortDirection ?? "asc";
  const sorted = [...records].sort((a, b) => {
    switch (sortBy) {
      case "createdDate":
        return a.createdDate - b.createdDate;
      case "lastModifiedDate":
        return a.lastModifiedDate - b.lastModifiedDate;
      case "name":
      default:
        return collator.compare(a.name, b.name);
    }
  });
  return direction === "desc" ? sorted.reverse() : sorted;
}
