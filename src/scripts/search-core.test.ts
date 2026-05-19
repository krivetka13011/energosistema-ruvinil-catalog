import { describe, it, expect } from "vitest";
import { normSearchText, queryTokens, rowMatches } from "./search-core";
import type { SearchIndexRow } from "./search-core";

function row(haystack: string, title = "Труба гофрированная ПВХ (100 м)"): SearchIndexRow {
  return {
    slug: "x",
    title,
    sku: "",
    category: "",
    image: "",
    priceHint: "",
    availability: "",
    wholesaleOpt: "",
    haystack: normSearchText(haystack),
    unitPriceRub: null,
    priceDisplay: "",
    cartPayload: "",
  };
}

describe("search-core", () => {
  it("normalizes 100м and метров", () => {
    expect(normSearchText("100м")).toContain("100");
    expect(normSearchText("100м")).toContain("м");
    expect(queryTokens("100 метров")).toContain("100");
    expect(queryTokens("100 метров")).toContain("м");
  });

  it("matches reordered words and glued length", () => {
    const r = row("труба гофрированная пвх 100 м");
    expect(rowMatches(r, "гофрированная труба 100м")).toBe(true);
    expect(rowMatches(r, "100 метров гофра")).toBe(true);
  });
});
