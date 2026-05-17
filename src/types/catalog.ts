export interface CatalogCategory {
  pathname: string;
  title: string;
  parentPath: string | null;
  slug: string;
  /** Превью раздела с сайта-источника (парсер) или пусто — тогда подставляем фото из товаров */
  image?: string;
  /** Порядок среди соседних разделов (как в разметке родительской страницы каталога источника) */
  sortHint?: number;
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
  /** Номер страницы Bitrix (PAGEN_1=N), 1 если без параметра */
  listingPageIndex?: number;
  /** Позиция в листинге сверху вниз, как у поставщика */
  listingPosition?: number;
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
