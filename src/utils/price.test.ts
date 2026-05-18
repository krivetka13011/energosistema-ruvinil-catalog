import { describe, it, expect } from "vitest";
import { metersPerSaleUnit } from "./price";
import type { CatalogProduct } from "../types/catalog";

function createMockProduct(overrides: Partial<CatalogProduct>): CatalogProduct {
  return {
    url: "/product",
    slug: "product",
    supplierPath: "/product",
    title: "Test Product",
    image: "",
    images: [],
    properties: {},
    priceHint: "",
    availability: "",
    listingPage: "",
    categoryPath: "",
    descriptionHtml: "",
    ...overrides,
  };
}

describe("metersPerSaleUnit", () => {
  it("extracts from 'Длина в бухте, м'", () => {
    const product = createMockProduct({
      properties: { "Длина в бухте, м": "50" },
    });
    expect(metersPerSaleUnit(product)).toBe(50);
  });

  it("extracts from 'Длина в бухте'", () => {
    const product = createMockProduct({
      properties: { "Длина в бухте": "100" },
    });
    expect(metersPerSaleUnit(product)).toBe(100);
  });

  it("extracts from 'Длина бухты, м'", () => {
    const product = createMockProduct({
      properties: { "Длина бухты, м": "25" },
    });
    expect(metersPerSaleUnit(product)).toBe(25);
  });

  it("extracts from 'Длина, м'", () => {
    const product = createMockProduct({
      properties: { "Длина, м": "10" },
    });
    expect(metersPerSaleUnit(product)).toBe(10);
  });

  it("extracts from 'Длина (м)'", () => {
    const product = createMockProduct({
      properties: { "Длина (м)": "75.5" },
    });
    expect(metersPerSaleUnit(product)).toBe(75.5);
  });

  it("extracts from title matching '(XX м)'", () => {
    const product = createMockProduct({
      title: "Гофрированная труба (15 м)",
    });
    expect(metersPerSaleUnit(product)).toBe(15);
  });

  it("extracts from title matching '(XX.X м)'", () => {
    const product = createMockProduct({
      title: "Труба ПНД (15.5 м)",
    });
    expect(metersPerSaleUnit(product)).toBe(15.5);
  });

  it("extracts from title matching '(XX,X м)'", () => {
    const product = createMockProduct({
      title: "Труба ПВХ (12,5 м)",
    });
    expect(metersPerSaleUnit(product)).toBe(12.5);
  });

  it("returns null if no length is specified", () => {
    const product = createMockProduct({});
    expect(metersPerSaleUnit(product)).toBeNull();
  });

  it("handles extra text that should be cleaned (trailing 'м.')", () => {
    const product = createMockProduct({
      properties: { "Длина в бухте, м": " 30 м. " },
    });
    expect(metersPerSaleUnit(product)).toBe(30);
  });

  it("handles trailing 'м'", () => {
    const product = createMockProduct({
      properties: { "Длина в бухте, м": " 40 м " },
    });
    expect(metersPerSaleUnit(product)).toBe(40);
  });

  it("extracts positive value if text starts with negative sign", () => {
    // `parseFirstPositiveRub` extracts the first number ignoring any minus sign
    const product = createMockProduct({
      properties: { "Длина в бухте, м": "-50" },
    });
    expect(metersPerSaleUnit(product)).toBe(50);
  });

  it("ignores zero in properties", () => {
    const product = createMockProduct({
      properties: { "Длина в бухте, м": "0" },
    });
    expect(metersPerSaleUnit(product)).toBeNull();
  });
});
