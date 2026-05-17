export interface CatalogCategory {
  pathname: string;
  title: string;
  parentPath: string | null;
  slug: string;
}

export interface CatalogProduct {
  url: string;
  slug: string;
  supplierPath: string;
  title: string;
  image: string;
  images: string[];
  properties: Record<string, string>;
  priceHint: string;
  availability: string;
  listingPage: string;
  categoryPath: string;
  descriptionHtml: string;
}

export interface CatalogPayload {
  generatedAt: string;
  /** Устарело: может присутствовать в старых сборках */
  sourceCatalog?: string;
  categories: CatalogCategory[];
  products: CatalogProduct[];
  company: {
    name: string;
    legalNote: string;
    contacts: {
      address: string;
      phone: string;
      email: string;
      hours: string;
    };
    /** Устарело */
    supplier?: {
      name: string;
      catalogUrl: string;
    };
  };
}
