// Kroger API response types

export interface KrogerPriceEntry {
  defaultDescription: string;
  expirationDate: { value: string; timezone: string };
  nfor: number;
  nforPrice: string;
  unitPrice: string;
  price: string;
  equivalizedUnitPrice?: { amount: string; denomination: string; unit: string };
  equivalizedUnitPriceString?: string;
}

export interface KrogerFulfillmentSummary {
  type: string;
  regular: {
    price: string;
    displayTemplate: string;
    priceString?: string;
    pricePerUnitString: string;
    equivalizedUnitPriceString?: string;
  };
  sale?: {
    price: string;
    priceString?: string;
    pricePerUnitString: string;
    expirationDate: { value: string; timezone: string };
    equivalizedUnitPriceString?: string;
  };
  availability: {
    sellable: boolean;
    inventoryLevel?: string;
    unavailabilityMessage?: string;
  };
  maxOrderQuantity?: number;
}

export interface KrogerStoreLocation {
  aisle: { description: string; number: string; side: string };
  bayInAisle: string;
  physicalShelfNumber: string;
  numOfFacings: string;
}

export interface KrogerProduct {
  id: string;
  item: {
    upc: string;
    description: string;
    brand: { name: string; code: string };
    customerFacingSize: string;
    shareLink: string;
    snapEligible: boolean;
    dietaryInformation: string[];
    nutritionalClaims: string[];
    categories: Array<{ code: string; name: string }>;
    images: Array<{ perspective: string; url: string; size: string }>;
    ratingsAndReviewsAggregate?: {
      averageRating: number;
      numberOfReviews: number;
      numOfFiveStarRating: number;
      numOfFourStarRating: number;
      numOfThreeStarRating: number;
      numOfTwoStarRating: number;
      numOfOneStarRating: number;
    };
  };
  price: {
    displayTemplate: string;
    offerCode?: string;
    storePrices: {
      regular: KrogerPriceEntry;
      promo?: KrogerPriceEntry;
      sourceLocationId: string;
    };
  };
  location?: {
    locations: KrogerStoreLocation[];
  };
  sourceLocations?: Array<{
    prices?: Array<{
      effectiveDate?: { value: string; timezone: string };
      expirationDate?: { value: string; timezone: string };
    }>;
    itemLocations?: Array<{
      aisleNumber: string;
      aisleDescription: string;
      aisleSide: string;
      bayNumberInAisle: string;
      shelfNumber: string;
      numberOfFacings: string;
    }>;
  }>;
  inventory: {
    locations: Array<{ locationId: string; available: number; stockLevel: string }>;
    effective: { total: number; available: number };
  };
  inventorySummaries: Array<{
    modalityType: string;
    details: Array<{ sourceId: string; availableToSell: number; stockLevel: string }>;
    availableToSell: number;
    stockLevel: string;
  }>;
  fulfillmentSummaries: KrogerFulfillmentSummary[];
  fulfillmentOptions: string[];
}

export interface KrogerProductsResponse {
  data: { products: KrogerProduct[] };
}

// Cross-world message event names
export const EXT_EVENTS = {
  HEADERS_CAPTURED: '__kroger_ext_headers__',
  API_DATA: '__kroger_ext_data__',
  API_RESPONSE: '__kroger_ext_response__',
  COUPON_ERROR: '__kroger_ext_coupon_error__',
  REQUEST: '__kroger_ext_request__',
} as const;

export type ExtRequestDetail = {
  requestId: string;
  action: 'fetchProduct' | 'fetchProductsByUPCs';
  upc?: string;
  upcs?: string[];
};
