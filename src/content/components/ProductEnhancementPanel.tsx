import React from 'react';
import type { KrogerProduct } from '../../utils/api';

interface Props {
  upc: string;
  state: 'loading' | 'loaded' | 'error';
  product?: KrogerProduct;
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-US', { month: 'numeric', day: 'numeric', year: 'numeric' });
}

function daysUntil(iso: string): number {
  return Math.ceil((new Date(iso).getTime() - Date.now()) / 86_400_000);
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div style={{ display: 'flex', gap: 8, marginTop: 6, alignItems: 'baseline', flexWrap: 'wrap' }}>
      <span style={{ color: '#64748b', minWidth: 130, flexShrink: 0, fontSize: 13 }}>{label}</span>
      <span style={{ fontSize: 14 }}>{children}</span>
    </div>
  );
}

export function ProductEnhancementPanel({ state, product }: Props) {
  const panel: React.CSSProperties = {
    margin: '12px 0',
    padding: '12px 16px',
    border: '1px solid #e2e8f0',
    borderRadius: '8px',
    backgroundColor: '#f8fafc',
    fontFamily: 'system-ui, -apple-system, sans-serif',
    fontSize: '14px',
    lineHeight: '1.5',
    color: '#1e293b',
    boxSizing: 'border-box',
  };

  const header = (
    <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: '#94a3b8', marginBottom: 4 }}>
      Kroger Enhancer
    </div>
  );

  if (state === 'loading') {
    return <div style={panel}>{header}<span style={{ color: '#64748b' }}>Loading…</span></div>;
  }
  if (state === 'error' || !product) {
    return <div style={panel}>{header}<span style={{ color: '#dc2626' }}>Unable to load product data.</span></div>;
  }

  const pickup = product.fulfillmentSummaries?.find(s => s.type === 'PICKUP');
  const promoData = product.price?.storePrices?.promo;
  const sale = pickup?.sale;
  const isOnSale = product.price?.displayTemplate === 'YellowTag' && !!sale;

  // Sale timing
  const saleEndIso = promoData?.expirationDate?.value ?? sale?.expirationDate?.value;
  const saleStartIso = product.sourceLocations?.[0]?.prices?.[0]?.effectiveDate?.value;
  const daysLeft = saleEndIso && saleEndIso !== '9999-12-31T00:00:00Z' ? daysUntil(saleEndIso) : null;

  // In-store shelf location — prefer the human-readable description (e.g. "PRODUCE TABLE 4")
  const loc = product.sourceLocations?.[0]?.itemLocations?.[0];
  let shelfInfo: string | undefined;
  if (loc) {
    const desc = loc.aisleDescription?.trim();
    if (desc) {
      // Use description as the aisle identifier; append bay/shelf only if sensible
      const parts: string[] = [desc];
      if (loc.bayNumberInAisle != null) parts.push(`Bay ${loc.bayNumberInAisle}`);
      if (loc.shelfNumber != null) parts.push(`Shelf ${loc.shelfNumber}`);
      shelfInfo = parts.join(', ');
    } else {
      // Fallback to number+side when no description
      const parts: string[] = [];
      if (loc.aisleNumber != null) parts.push(`Aisle ${loc.aisleNumber}${loc.aisleSide ?? ''}`);
      if (loc.bayNumberInAisle != null) parts.push(`Bay ${loc.bayNumberInAisle}`);
      if (loc.shelfNumber != null) parts.push(`Shelf ${loc.shelfNumber}`);
      if (parts.length > 0) shelfInfo = parts.join(', ');
    }
  }

  // Stock level — only surface when not HIGH (low/out is the actionable signal)
  const inv = product.inventorySummaries?.find(s => s.modalityType === 'PICKUP');
  const stockLevel = inv?.stockLevel ?? pickup?.availability?.inventoryLevel;
  const showStock = stockLevel && stockLevel !== 'HIGH';
  const stockQty = inv?.availableToSell;

  // Rating distribution — surface when polarized (notable 1-star ratio)
  const ratings = product.item?.ratingsAndReviewsAggregate;
  const lowRatioNotable = ratings && ratings.numberOfReviews >= 5 &&
    (ratings.numOfOneStarRating / ratings.numberOfReviews) >= 0.15;

  const hasContent = isOnSale || shelfInfo || showStock || lowRatioNotable;
  if (!hasContent) return null;

  return (
    <div style={panel}>
      {header}

      {isOnSale && saleEndIso && saleEndIso !== '9999-12-31T00:00:00Z' && (
        <Row label="Sale ends">
          <span style={{ color: '#d97706', fontWeight: 600 }}>
            {formatDate(saleEndIso)}
            {daysLeft !== null && (
              <span style={{ fontWeight: 400, color: daysLeft <= 2 ? '#dc2626' : '#d97706' }}>
                {' '}({daysLeft <= 0 ? 'last day' : `${daysLeft} day${daysLeft === 1 ? '' : 's'} left`})
              </span>
            )}
          </span>
        </Row>
      )}

      {isOnSale && saleStartIso && (
        <Row label="Sale started">
          <span style={{ color: '#64748b' }}>{formatDate(saleStartIso)}</span>
        </Row>
      )}

      {shelfInfo && (
        <Row label="In-store location">
          <span>{shelfInfo}</span>
        </Row>
      )}

      {showStock && (
        <Row label="Pickup stock">
          <span style={{ fontWeight: 600, color: stockLevel === 'LOW' || stockLevel === 'TEMPORARILY_OUT_OF_STOCK' ? '#d97706' : '#dc2626' }}>
            {stockLevel === 'LOW' ? 'Low Stock' : 'Out of Stock'}
            {stockQty != null && stockQty > 0 ? ` (${stockQty} left)` : ''}
          </span>
        </Row>
      )}

      {lowRatioNotable && ratings && (
        <Row label="Review breakdown">
          <span style={{ color: '#64748b' }}>
            {ratings.numOfFiveStarRating}★★★★★&nbsp;&nbsp;
            <span style={{ color: '#dc2626' }}>{ratings.numOfOneStarRating}★☆☆☆☆</span>
            <span style={{ fontSize: 12 }}> of {ratings.numberOfReviews} reviews</span>
          </span>
        </Row>
      )}
    </div>
  );
}
