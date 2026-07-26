import { describe, expect, it } from "vitest";
import { normalizeForSearch, sortByOptions } from "./search.js";

describe("normalizeForSearch", () => {
  it("matches 'café' queried as 'cafe'", () => {
    expect(normalizeForSearch("café")).toBe(normalizeForSearch("cafe"));
  });

  it("ignores punctuation and spacing differences", () => {
    expect(normalizeForSearch("My File-Name!")).toBe(normalizeForSearch("my filename"));
  });

  it("is case-insensitive", () => {
    expect(normalizeForSearch("HELLO")).toBe(normalizeForSearch("hello"));
  });
});

describe("sortByOptions", () => {
  const records = [
    { name: "banana", createdDate: 2, lastModifiedDate: 20 },
    { name: "Apple", createdDate: 1, lastModifiedDate: 30 },
    { name: "cherry", createdDate: 3, lastModifiedDate: 10 }
  ];

  it("sorts by name case-insensitively by default", () => {
    expect(sortByOptions(records, undefined).map((r) => r.name)).toEqual(["Apple", "banana", "cherry"]);
  });

  it("sorts by createdDate", () => {
    expect(sortByOptions(records, { sortBy: "createdDate" }).map((r) => r.name)).toEqual([
      "Apple",
      "banana",
      "cherry"
    ]);
  });

  it("sorts by lastModifiedDate descending", () => {
    expect(
      sortByOptions(records, { sortBy: "lastModifiedDate", sortDirection: "desc" }).map((r) => r.name)
    ).toEqual(["Apple", "banana", "cherry"]);
  });
});
