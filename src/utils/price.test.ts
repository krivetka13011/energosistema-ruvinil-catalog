import { describe, it, expect } from "vitest";
import {
  metersPerSaleUnit,
  parsePackQuantity,
  piecesPerSaleUnit,
  saleUnitMeterQty,
  catalogCartUnitPriceRub,
  catalogCartPriceLabelForCart,
} from "./price";
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

  it("extracts from title matching '(XX м)'", () => {
    const product = createMockProduct({
      title: "Гофрированная труба (15 м)",
    });
    expect(metersPerSaleUnit(product)).toBe(15);
  });

  it("extracts from title ending with '10 м'", () => {
    const product = createMockProduct({
      title: "Бандаж спиральный 10 м",
    });
    expect(metersPerSaleUnit(product)).toBe(10);
  });
});

describe("parsePackQuantity", () => {
  it("parses 12x4 as 48", () => {
    expect(parsePackQuantity("12x4")).toBe(48);
  });

  it("parses plain number", () => {
    expect(parsePackQuantity("100")).toBe(100);
  });
});

describe("piecesPerSaleUnit", () => {
  it("reads Количество в упаковке, шт.", () => {
    const product = createMockProduct({
      properties: { "Количество в упаковке, шт.": "100" },
    });
    expect(piecesPerSaleUnit(product)).toBe(100);
  });

  it("reads pack from title", () => {
    const product = createMockProduct({
      title: "Скоба (уп. 100 шт.)",
    });
    expect(piecesPerSaleUnit(product)).toBe(100);
  });
});

describe("saleUnitMeterQty", () => {
  it("uses Количество в упаковке, м", () => {
    const product = createMockProduct({
      properties: { "Количество в упаковке, м": "60" },
    });
    expect(saleUnitMeterQty(product)).toBe(60);
  });

  it("multiplies piece length and pack count for lot covers", () => {
    const product = createMockProduct({
      title: "Крышка лотка 500х15х3000 мм S=0,55",
      properties: { "В упаковке": "3" },
    });
    expect(saleUnitMeterQty(product)).toBe(9);
  });
});

describe("catalogCartUnitPriceRub", () => {
  it("multiplies per-piece rate by pack size", () => {
    const product = createMockProduct({
      priceHint: "5.42 руб./шт",
      properties: { "Количество в упаковке, шт.": "100" },
    });
    expect(catalogCartUnitPriceRub(product)).toBe(542);
  });

  it("multiplies per-meter rate by coil length", () => {
    const product = createMockProduct({
      priceHint: "100 руб./м",
      properties: { "Длина в бухте, м": "50" },
    });
    expect(catalogCartUnitPriceRub(product)).toBe(5000);
  });

  it("leaves single-piece price unchanged", () => {
    const product = createMockProduct({
      priceHint: "88.91 руб./шт",
      properties: { "В упаковке": "1" },
    });
    expect(catalogCartUnitPriceRub(product)).toBe(88.91);
  });
});

describe("catalogCartPriceLabelForCart", () => {
  it("shows pack calculation for pieces", () => {
    const product = createMockProduct({
      priceHint: "5.42 руб./шт",
      properties: { "Количество в упаковке, шт.": "100" },
    });
    expect(catalogCartPriceLabelForCart(product)).toContain("542");
    expect(catalogCartPriceLabelForCart(product)).toContain("100 шт");
  });
});
