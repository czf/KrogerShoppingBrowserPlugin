import React, { useState, useEffect, useRef, useMemo, useLayoutEffect } from 'react';
import { createPortal } from 'react-dom';
import { getCouponFilters, setCouponFilters } from '../../../utils/storage';
import * as couponApi from '../../../utils/couponApi';
import type { KrogerCoupon, KrogerProductCompact } from '../../../utils/couponApi';
import { formatExpiry, filterCoupons, sortCoupons, parseStoredFilters, buildStoredFilters } from '../../../utils/couponUtils';

const PAGE_SIZE = 24;


const SCOPED_CSS = `
#kroger-ext-coupon-custom-page {
  --kext-blue: #0066cc;
  --kext-green: #1a7a3c;
  --kext-bg: #f4f6f8;
  --kext-card-bg: #ffffff;
  --kext-border: #e2e8f0;
  --kext-text: #1a202c;
  --kext-muted: #718096;
  --kext-expiry-bg: #f5f5f5;
  --kext-expiry-color: #555;
  --kext-expiry-urgent-bg: #fce8e8;
  --kext-expiry-urgent-color: #b71c1c;
  --kext-special-bg: #eef2ff;
  --kext-special-color: #3730a3;
}
@keyframes kext-shimmer {
  0%   { background-position: -400px 0; }
  100% { background-position:  400px 0; }
}
#kroger-ext-coupon-custom-page .kext-skeleton {
  background: linear-gradient(90deg, #e8ecef 25%, #f0f3f5 50%, #e8ecef 75%);
  background-size: 800px 100%;
  animation: kext-shimmer 1.4s infinite linear;
  border-radius: 10px;
}
#kroger-ext-coupon-custom-page .kext-card {
  background: var(--kext-card-bg);
  border: 1px solid var(--kext-border);
  border-radius: 10px;
  overflow: hidden;
  display: flex;
  flex-direction: column;
  transition: box-shadow 0.18s, transform 0.18s;
}
#kroger-ext-coupon-custom-page .kext-card:hover {
  box-shadow: 0 4px 12px rgba(0,0,0,0.12);
  transform: translateY(-2px);
}
#kroger-ext-coupon-custom-page .kext-clip-btn {
  width: 100%;
  border: none;
  border-radius: 20px;
  padding: 8px 0;
  font-size: 13px;
  font-weight: 700;
  cursor: pointer;
  transition: opacity 0.15s, filter 0.15s;
  letter-spacing: 0.2px;
}
#kroger-ext-coupon-custom-page .kext-clip-btn:not(:disabled):hover {
  filter: brightness(0.93);
}
#kroger-ext-coupon-custom-page .kext-clip-btn--clip {
  background: var(--kext-blue);
  color: #fff;
}
#kroger-ext-coupon-custom-page .kext-clip-btn--clipped {
  background: #e8f5ec;
  color: var(--kext-green);
  border: 1px solid #a8dbb8 !important;
}
#kroger-ext-coupon-custom-page .kext-clip-btn--signin {
  background: #f5f7fa;
  color: #718096;
  border: 1px solid var(--kext-border) !important;
}
#kroger-ext-coupon-custom-page .kext-clip-btn--loading {
  background: #f5f7fa;
  color: #aaa;
  cursor: not-allowed;
}
#kroger-ext-coupon-custom-page .kext-view-link {
  font-size: 12px;
  color: var(--kext-blue);
  background: none;
  border: none;
  cursor: pointer;
  padding: 0;
  text-decoration: none;
}
#kroger-ext-coupon-custom-page .kext-view-link:hover {
  text-decoration: underline;
}
#kroger-ext-coupon-custom-page .kext-title-link {
  background: none;
  border: none;
  padding: 0;
  margin: 0;
  cursor: pointer;
  text-align: left;
  font-size: 15px;
  font-weight: 700;
  color: #111;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
  line-height: 1.35;
  margin-bottom: 4px;
  transition: color 0.12s;
}
#kroger-ext-coupon-custom-page .kext-title-link:hover {
  color: var(--kext-blue);
  text-decoration: underline;
}
#kroger-ext-coupon-custom-page .kext-sidebar-label {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 4px 6px;
  cursor: pointer;
  border-radius: 5px;
  font-size: 13px;
  color: #333;
  transition: background 0.12s;
}
#kroger-ext-coupon-custom-page .kext-sidebar-label:hover {
  background: #f0f4ff;
}
#kroger-ext-coupon-custom-page .kext-pill-toggle {
  flex: 1;
  padding: 6px 4px;
  border-radius: 20px;
  border: 1px solid var(--kext-border);
  font-size: 12px;
  font-weight: 600;
  cursor: pointer;
  transition: background 0.15s, color 0.15s, border-color 0.15s;
  background: #f5f7fa;
  color: var(--kext-muted);
  text-align: center;
}
#kroger-ext-coupon-custom-page .kext-pill-toggle--active {
  background: var(--kext-blue);
  color: #fff;
  border-color: var(--kext-blue);
}
#kroger-ext-coupon-custom-page .kext-pill-toggle:hover:not(.kext-pill-toggle--active) {
  background: #e8f0ff;
  border-color: #c0d4f5;
  color: var(--kext-blue);
}
#kroger-ext-coupon-custom-page .kext-special-pill {
  padding: 5px 10px;
  border-radius: 20px;
  border: 1px solid var(--kext-border);
  font-size: 12px;
  font-weight: 600;
  cursor: pointer;
  transition: background 0.15s, color 0.15s, border-color 0.15s;
  background: #f5f7fa;
  color: var(--kext-muted);
  white-space: nowrap;
}
#kroger-ext-coupon-custom-page .kext-special-pill--active {
  background: var(--kext-blue);
  color: #fff;
  border-color: var(--kext-blue);
}
#kroger-ext-coupon-custom-page .kext-special-pill:hover:not(.kext-special-pill--active) {
  background: #e8f0ff;
  border-color: #c0d4f5;
  color: var(--kext-blue);
}
#kroger-ext-coupon-custom-page .kext-chip {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 3px 10px;
  border-radius: 20px;
  background: #e8f0ff;
  color: var(--kext-blue);
  font-size: 12px;
  font-weight: 500;
  border: 1px solid #c0d4f5;
}
#kroger-ext-coupon-custom-page .kext-chip-x {
  background: none;
  border: none;
  cursor: pointer;
  color: var(--kext-blue);
  font-size: 14px;
  line-height: 1;
  padding: 0 0 0 2px;
  opacity: 0.7;
  transition: opacity 0.12s;
}
#kroger-ext-coupon-custom-page .kext-chip-x:hover {
  opacity: 1;
}
#kroger-ext-coupon-custom-page .kext-search-input:focus {
  outline: 2px solid #0073d1;
  outline-offset: -1px;
}
#kroger-ext-coupon-custom-page .kext-brand-input:focus {
  outline: 2px solid #0073d1;
  outline-offset: -1px;
}
#kroger-ext-coupon-custom-page .kext-badge {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 18px;
  height: 18px;
  padding: 0 5px;
  border-radius: 9px;
  background: var(--kext-blue);
  color: #fff;
  font-size: 10px;
  font-weight: 700;
}
#kroger-ext-coupon-custom-page .kext-section-title-btn {
  display: flex;
  align-items: center;
  justify-content: space-between;
  width: 100%;
  padding: 10px 0 8px;
  background: none;
  border: none;
  cursor: pointer;
  font-size: 13px;
  font-weight: 600;
  color: #333;
  text-align: left;
  gap: 6px;
}
#kroger-ext-coupon-custom-page .kext-section-title-btn:hover {
  color: var(--kext-blue);
}
`;

const SPECIAL_SAVINGS_OPTIONS = [
  '4X Gift Card Event',
  '5X Event',
  'Bonus Digital Deals',
  'Expiring Soon',
  'General Savings',
  'Pickup & Delivery Only',
  'Weekly Digital Deals',
];

const MODALITY_OPTIONS = [
  { label: 'In Store', value: 'IN_STORE', icon: '🏪' },
  { label: 'Pickup', value: 'PICKUP', icon: '🛒' },
  { label: 'Delivery', value: 'DELIVERY', icon: '🚚' },
];

const SORT_OPTIONS = [
  { value: 'relevance', label: 'Relevance' },
  { value: 'recent', label: 'Most Recent' },
  { value: 'expiration', label: 'Expiration Date' },
  { value: 'value', label: 'Value' },
];

const ALL_MODALITY_VALUES = ['IN_STORE', 'PICKUP', 'DELIVERY'];

interface CouponCardProps {
  coupon: KrogerCoupon;
  clipping: boolean;
  onClip: (id: string) => void;
  onViewDetails: (id: string) => void;
}

function CouponCard({ coupon, clipping, onClip, onViewDetails }: CouponCardProps) {
  const expiry = formatExpiry(coupon.expirationDate);
  const titleText = coupon.title || coupon.shortDescription;
  const showDesc = coupon.displayDescription && coupon.displayDescription !== titleText
    ? coupon.displayDescription
    : '';
  const specialSavings = coupon.specialSavings ?? [];
  const couponModalities = coupon.modalities ?? [];
  const hasAllThree = ALL_MODALITY_VALUES.every(v => couponModalities.includes(v));
  const modalityDisplay = hasAllThree ? [] : couponModalities
    .map(m => MODALITY_OPTIONS.find(o => o.value === m))
    .filter(Boolean) as typeof MODALITY_OPTIONS;

  // Show "Clip by" when displayEndDate is meaningfully earlier than expirationDate
  const clipByExpiry = formatExpiry(coupon.displayEndDate);
  const showClipBy = coupon.displayEndDate && coupon.expirationDate &&
    new Date(coupon.displayEndDate).getTime() < new Date(coupon.expirationDate).getTime() - 12 * 60 * 60 * 1000;

  let clipBtnClass = 'kext-clip-btn ';
  let clipBtnLabel: string;
  let clipBtnDisabled = false;
  let clipBtnHandler: (() => void) | undefined;

  if (clipping) {
    clipBtnClass += 'kext-clip-btn--loading';
    clipBtnLabel = 'Clipping...';
    clipBtnDisabled = true;
  } else if (coupon.addedToCard) {
    clipBtnClass += 'kext-clip-btn--clipped';
    clipBtnLabel = '✓ Clipped';
    clipBtnHandler = () => onClip(coupon.id);
  } else if (!coupon.canBeAddedToCard) {
    clipBtnClass += 'kext-clip-btn--signin';
    clipBtnLabel = 'Sign In';
  } else {
    clipBtnClass += 'kext-clip-btn--clip';
    clipBtnLabel = 'Clip';
    clipBtnHandler = () => onClip(coupon.id);
  }

  return (
    <div className="kext-card">
      {/* Image area — full width, light grey bg, clickable */}
      <div
        onClick={() => onViewDetails(coupon.id)}
        style={{
          width: '100%', height: 160, backgroundColor: '#f5f7fa',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          overflow: 'hidden', position: 'relative', cursor: 'pointer',
        }}
      >
        <img
          src={coupon.imageUrl}
          alt={coupon.shortDescription}
          style={{ width: '100%', height: '100%', objectFit: 'contain' }}
        />
        {specialSavings.length > 0 && (
          <div style={{
            position: 'absolute', top: 6, right: 6,
            display: 'flex', flexDirection: 'column', gap: 3, alignItems: 'flex-end',
          }}>
            {specialSavings.slice(0, 2).map((ss, i) => (
              <span key={i} style={{
                backgroundColor: 'var(--kext-special-bg)', color: 'var(--kext-special-color)',
                fontSize: 10, padding: '2px 6px', borderRadius: 8, fontWeight: 700,
                whiteSpace: 'nowrap', maxWidth: 90, overflow: 'hidden', textOverflow: 'ellipsis',
                boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
              }}>
                {ss.displayName}
              </span>
            ))}
          </div>
        )}
      </div>

      {/* Card content */}
      <div style={{ display: 'flex', flexDirection: 'column', flex: 1, padding: '10px 12px 12px' }}>
        <span style={{ fontSize: 11, color: '#999', textTransform: 'uppercase', letterSpacing: 0.6, marginBottom: 2 }}>
          {coupon.brandName || coupon.brand}
        </span>
        <button className="kext-title-link" onClick={() => onViewDetails(coupon.id)}>
          {titleText}
        </button>
        {showDesc && (
          <span style={{
            fontSize: 12, color: '#666', marginBottom: 4,
            overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
          }}>
            {showDesc}
          </span>
        )}
        <div style={{ display: 'flex', alignItems: 'center', gap: 4, flexWrap: 'wrap', marginTop: 'auto', marginBottom: showClipBy ? 4 : 8 }}>
          <span style={{
            backgroundColor: expiry.urgent ? 'var(--kext-expiry-urgent-bg)' : 'var(--kext-expiry-bg)',
            color: expiry.urgent ? 'var(--kext-expiry-urgent-color)' : 'var(--kext-expiry-color)',
            fontSize: 11, padding: '2px 7px', borderRadius: 10, fontWeight: 500,
          }}>
            {expiry.text}
          </span>
          {modalityDisplay.map(m => (
            <span key={m.value} title={m.label} style={{ fontSize: 13, cursor: 'default' }}>
              {m.icon}
            </span>
          ))}
        </div>
        {showClipBy && (
          <div style={{ marginBottom: 8 }}>
            <span style={{
              fontSize: 11, padding: '2px 7px', borderRadius: 10, fontWeight: 500,
              backgroundColor: '#fef3c7', color: '#92400e',
            }}>
              Clip by {clipByExpiry.text.replace('Exp. ', '')}
            </span>
          </div>
        )}
        <button
          className={clipBtnClass}
          disabled={clipBtnDisabled}
          onClick={clipBtnHandler}
          title={coupon.addedToCard ? 'Unclip' : undefined}
        >
          {clipBtnLabel}
        </button>
      </div>
    </div>
  );
}

interface CouponDetailModalProps {
  coupon: KrogerCoupon;
  clipping: boolean;
  onClip: (id: string) => void;
  onClose: () => void;
  products: KrogerProductCompact[];
  loadingProducts: boolean;
}

function CouponDetailModal({ coupon, clipping, onClip, onClose, products, loadingProducts }: CouponDetailModalProps) {
  const expiry = formatExpiry(coupon.expirationDate);
  const titleText = coupon.title || coupon.shortDescription;
  const showDesc = coupon.displayDescription && coupon.displayDescription !== titleText
    ? coupon.displayDescription
    : '';

  const specialSavings = coupon.specialSavings ?? [];
  const couponModalities = coupon.modalities ?? [];
  const hasAllThree = ALL_MODALITY_VALUES.every(v => couponModalities.includes(v));
  const modalityDisplay = hasAllThree ? [] : couponModalities
    .map(m => MODALITY_OPTIONS.find(o => o.value === m))
    .filter(Boolean) as typeof MODALITY_OPTIONS;

  let modalClipBtn: React.ReactElement;
  if (clipping) {
    modalClipBtn = (
      <button
        disabled
        style={{
          padding: '8px 24px', borderRadius: 20, border: 'none',
          fontSize: 14, fontWeight: 700, cursor: 'not-allowed',
          backgroundColor: 'rgba(255,255,255,0.3)', color: '#ccc',
        }}
      >
        Clipping...
      </button>
    );
  } else if (coupon.addedToCard) {
    modalClipBtn = (
      <button
        onClick={() => onClip(coupon.id)}
        title="Unclip"
        style={{
          padding: '8px 24px', borderRadius: 20, border: '1px solid #a5d6a7',
          fontSize: 14, fontWeight: 700, cursor: 'pointer',
          backgroundColor: '#e8f5e9', color: '#2e7d32',
        }}
      >
        ✓ Clipped
      </button>
    );
  } else if (!coupon.canBeAddedToCard) {
    modalClipBtn = (
      <button
        style={{
          padding: '8px 24px', borderRadius: 20, border: 'none',
          fontSize: 14, fontWeight: 700, cursor: 'pointer',
          backgroundColor: 'rgba(255,255,255,0.2)', color: '#fff',
        }}
      >
        Sign In
      </button>
    );
  } else {
    modalClipBtn = (
      <button
        onClick={() => onClip(coupon.id)}
        style={{
          padding: '8px 24px', borderRadius: 20, border: 'none',
          fontSize: 14, fontWeight: 700, cursor: 'pointer',
          backgroundColor: '#fff', color: '#0066cc',
        }}
      >
        Clip
      </button>
    );
  }

  return (
    <div
      onClick={onClose}
      style={{
        position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.55)',
        zIndex: 9999, display: 'flex', alignItems: 'flex-start', justifyContent: 'center',
        paddingTop: 'max(80px, 10vh)',
        overflowY: 'auto',
      }}
    >
      <div
        onClick={e => e.stopPropagation()}
        style={{
          backgroundColor: '#fff', borderRadius: 14, maxWidth: 680, width: '90vw',
          maxHeight: 'calc(90vh - 80px)', overflowY: 'auto', padding: 0,
          boxShadow: '0 8px 40px rgba(0,0,0,0.18)',
          marginBottom: 40,
        }}
      >
        <div style={{
          backgroundColor: '#0066cc', color: '#fff',
          padding: '18px 24px', borderRadius: '14px 14px 0 0',
          display: 'flex', flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
        }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            <span style={{ fontSize: 11, textTransform: 'uppercase', letterSpacing: 0.5, opacity: 0.85 }}>
              {coupon.brandName || coupon.brand}
            </span>
            <span style={{ fontSize: 18, fontWeight: 700, lineHeight: '1.3' }}>{titleText}</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0, marginLeft: 16 }}>
            {modalClipBtn}
            <button
              onClick={onClose}
              style={{
                background: 'rgba(255,255,255,0.15)', border: 'none', color: '#fff',
                fontSize: 18, cursor: 'pointer', padding: '6px 10px', lineHeight: 1, borderRadius: 8,
              }}
            >
              ✕
            </button>
          </div>
        </div>
        <div style={{ padding: 24 }}>
          <div style={{ display: 'flex', flexDirection: 'row', gap: 20, marginBottom: 20 }}>
            <img
              src={coupon.imageUrl}
              alt={coupon.shortDescription}
              style={{
                width: 120, height: 120, objectFit: 'contain', flexShrink: 0,
                borderRadius: 8, border: '1px solid #eee', backgroundColor: '#f5f7fa',
              }}
            />
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6, flex: 1 }}>
              <span style={{ fontSize: 20, fontWeight: 700, color: '#0066cc' }}>
                {titleText}
              </span>
              {showDesc && (
                <span style={{ fontSize: 14, color: '#666' }}>{showDesc}</span>
              )}
              {coupon.requirementDescription && (
                <span style={{ fontSize: 13, color: '#888', fontStyle: 'italic' }}>
                  {coupon.requirementDescription}
                </span>
              )}
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                <span style={{
                  backgroundColor: expiry.urgent ? 'var(--kext-expiry-urgent-bg)' : 'var(--kext-expiry-bg)',
                  color: expiry.urgent ? 'var(--kext-expiry-urgent-color)' : 'var(--kext-expiry-color)',
                  fontSize: 11, padding: '2px 8px', borderRadius: 10, fontWeight: 500,
                }}>
                  {expiry.text}
                </span>
                {modalityDisplay.map(m => (
                  <span key={m.value} title={m.label} style={{ fontSize: 15, cursor: 'default' }}>
                    {m.icon}
                  </span>
                ))}
              </div>
              {specialSavings.length > 0 && (
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                  {specialSavings.map((ss, i) => (
                    <span key={i} style={{
                      backgroundColor: 'var(--kext-special-bg)', color: 'var(--kext-special-color)',
                      fontSize: 11, padding: '2px 8px', borderRadius: 8, fontWeight: 600,
                    }}>
                      {ss.displayName}
                    </span>
                  ))}
                </div>
              )}
            </div>
          </div>
          <hr style={{ margin: '0 0 20px', border: 'none', borderTop: '1px solid #e2e8f0' }} />
          <div>
            <div style={{ fontSize: 15, fontWeight: 700, color: '#111', marginBottom: 12 }}>
              Qualifying Products
            </div>
            {loadingProducts ? (
              <div style={{ color: '#888', fontSize: 13 }}>Loading products...</div>
            ) : products.length === 0 ? (
              <div style={{ color: '#888', fontSize: 13 }}>No specific qualifying products listed.</div>
            ) : (
              <div style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))',
                gap: 12,
              }}>
                {products.map(p => (
                  <a
                    key={p.id}
                    href={p.shareLink}
                    target="_blank"
                    rel="noreferrer"
                    style={{
                      display: 'flex', flexDirection: 'column', alignItems: 'center',
                      gap: 6, padding: 10, border: '1px solid #e2e8f0', borderRadius: 8,
                      backgroundColor: '#fff', textDecoration: 'none', color: '#222',
                    }}
                  >
                    {p.imageUrl && (
                      <img
                        src={p.imageUrl}
                        alt={p.description}
                        style={{ width: 100, height: 100, objectFit: 'contain' }}
                      />
                    )}
                    <span style={{
                      fontSize: 13,
                      display: '-webkit-box',
                      WebkitLineClamp: 3,
                      WebkitBoxOrient: 'vertical',
                      overflow: 'hidden',
                      textAlign: 'center',
                      lineHeight: '1.3',
                      wordBreak: 'break-word',
                    } as React.CSSProperties}>
                      {p.description}
                    </span>
                    {p.price && (
                      <span style={{ fontSize: 13, fontWeight: 700, color: '#0066cc' }}>{p.price}</span>
                    )}
                  </a>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function SidebarSection({
  title,
  collapsed,
  onToggle,
  children,
  badgeCount,
}: {
  title: string;
  collapsed: boolean;
  onToggle: () => void;
  children: React.ReactNode;
  badgeCount?: number;
}) {
  return (
    <div>
      <button className="kext-section-title-btn" onClick={onToggle}>
        <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          {title}
          {badgeCount != null && badgeCount > 0 && (
            <span className="kext-badge">{badgeCount}</span>
          )}
        </span>
        <span style={{ fontSize: 11, color: '#aaa', flexShrink: 0 }}>{collapsed ? '▼' : '▲'}</span>
      </button>
      {!collapsed && <div style={{ paddingBottom: 8 }}>{children}</div>}
      <hr style={{ margin: '0 0 2px', border: 'none', borderTop: '1px solid #e2e8f0' }} />
    </div>
  );
}

export function CouponCustomPage() {
  const [activeCategories, setActiveCategories] = useState<string[]>([]);
  const [activeModalities, setActiveModalities] = useState<string[]>([]);
  const [activeSpecialSavings, setActiveSpecialSavings] = useState<string[]>([]);
  const [onlyNewCoupons, setOnlyNewCoupons] = useState(false);
  const [searchText, setSearchText] = useState('');
  const [sortBy, setSortBy] = useState('relevance');
  const [coupons, setCoupons] = useState<KrogerCoupon[]>([]);
  const [dynamicCategories, setDynamicCategories] = useState<{ label: string; value: string }[]>([]);
  const [offset, setOffset] = useState(0);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(false);
  const [totalCount, setTotalCount] = useState(0);
  const [newCouponsCount, setNewCouponsCount] = useState(0);
  const [loadError, setLoadError] = useState(false);
  const fetchingRef = useRef(false);
  const sentinelRef = useRef<HTMLDivElement | null>(null);
  const checkAndLoadMoreRef = useRef<() => void>(() => {});
  const categoriesScrollRef = useRef<HTMLDivElement | null>(null);
  const scrollRestoreRef = useRef<number | null>(null);
  const [clipping, setClipping] = useState<Record<string, boolean>>({});
  const [modalCouponId, setModalCouponId] = useState<string | null>(null);
  const [qualifyingProducts, setQualifyingProducts] = useState<Record<string, KrogerProductCompact[]>>({});
  const [loadingProducts, setLoadingProducts] = useState<Record<string, boolean>>({});
  const [sidebarCollapsed, setSidebarCollapsed] = useState<Record<string, boolean>>({});
  const [excludedBrands, setExcludedBrands] = useState<string[]>([]);
  const [brandInputValue, setBrandInputValue] = useState('');
  const [activeStatuses, setActiveStatuses] = useState<string[]>(['unclipped']);
  const [showScrollTop, setShowScrollTop] = useState(false);
  const initialized = useRef(false);
  const searchTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Inject scoped CSS once
  useEffect(() => {
    const styleTag = document.createElement('style');
    styleTag.id = 'kroger-ext-coupon-styles';
    styleTag.textContent = SCOPED_CSS;
    document.head.appendChild(styleTag);
    return () => {
      const existing = document.getElementById('kroger-ext-coupon-styles');
      if (existing) existing.remove();
    };
  }, []);

  async function loadCoupons(cats: string[], sort: string, newOnly: boolean, off: number, append = false, searchString?: string, statuses?: string[]) {
    if (fetchingRef.current) return;
    fetchingRef.current = true;
    if (append) {
      setLoadingMore(true);
      setLoadError(false);
    } else {
      setLoading(true);
      setLoadError(false);
    }
    try {
      const result = await couponApi.fetchCoupons({ categories: cats, offset: off, pageSize: PAGE_SIZE, searchString, statuses });
      let couponsPage = result.coupons;
      if (newOnly && couponsPage.length > 0) {
        couponsPage = filterCoupons(couponsPage, { newOnly: true });
      }
      couponsPage = sortCoupons(couponsPage, sort);
      if (append) {
        setCoupons(prev => [...prev, ...couponsPage]);
      } else {
        setCoupons(couponsPage);
      }
      setHasMore(result.hasMore && !newOnly);
      if (!append) {
        setTotalCount(result.totalCount);
        setNewCouponsCount(result.newCouponsCount);
        if (result.categoryOptions.length > 0) {
          const dynCats = result.categoryOptions
            .map(o => ({ label: o.name, value: o.name.toLowerCase() }))
            .sort((a, b) => a.label.localeCompare(b.label));
          setDynamicCategories(dynCats);
          // Drop any active categories that are no longer available (e.g. stale persisted values)
          if (result.categoriesDropped) {
            setActiveCategories([]);
            persistFilters([], activeModalities, activeSpecialSavings, newOnly, sort);
          } else {
            const validValues = new Set(dynCats.map(c => c.value));
            setActiveCategories(prev => prev.filter(c => validValues.has(c)));
          }
        }
      }
    } catch {
      setLoadError(true);
    } finally {
      setLoading(false);
      setLoadingMore(false);
      fetchingRef.current = false;
      // After an append load, check if sentinel is still visible and queue another load
      if (append) {
        setTimeout(() => checkAndLoadMoreRef.current?.(), 50);
      }
    }
  }

  function persistFilters(cats: string[], mods: string[], specials: string[], newOnly: boolean, sort: string, excluded: string[] = excludedBrands) {
    setCouponFilters(buildStoredFilters({ categories: cats, modalities: mods, specialSavings: specials, excludedBrands: excluded, newOnly, sortBy: sort }));
  }

  useEffect(() => {
    let cancelled = false;
    getCouponFilters().then(saved => {
      if (cancelled) return;
      const { categories: cats, modalities: mods, specialSavings: specials, excludedBrands: excluded, newOnly, sortBy: sort } = parseStoredFilters(saved);
      setActiveCategories(cats);
      setActiveModalities(mods);
      setActiveSpecialSavings(specials);
      setOnlyNewCoupons(newOnly);
      setSortBy(sort);
      setExcludedBrands(excluded);
      initialized.current = true;
      loadCoupons(cats, sort, newOnly, 0, false, searchText, activeStatuses);
    });
    return () => { cancelled = true; };
  }, []);

  function handleCategoryToggle(value: string) {
    if (categoriesScrollRef.current) {
      scrollRestoreRef.current = categoriesScrollRef.current.scrollTop;
    }
    const newCats = activeCategories.includes(value)
      ? activeCategories.filter(c => c !== value)
      : [...activeCategories, value];
    setActiveCategories(newCats);
    persistFilters(newCats, activeModalities, activeSpecialSavings, onlyNewCoupons, sortBy);
    setOffset(0);
    loadCoupons(newCats, sortBy, onlyNewCoupons, 0, false, searchText, activeStatuses);
  }

  useLayoutEffect(() => {
    if (scrollRestoreRef.current !== null && categoriesScrollRef.current) {
      categoriesScrollRef.current.scrollTop = scrollRestoreRef.current;
      scrollRestoreRef.current = null;
    }
  }, [dynamicCategories, activeCategories]);

  function handleModalityToggle(value: string) {
    const newMods = activeModalities.includes(value)
      ? activeModalities.filter(m => m !== value)
      : [...activeModalities, value];
    setActiveModalities(newMods);
    persistFilters(activeCategories, newMods, activeSpecialSavings, onlyNewCoupons, sortBy);
  }

  function handleSpecialSavingsToggle(value: string) {
    const newSpecials = activeSpecialSavings.includes(value)
      ? activeSpecialSavings.filter(s => s !== value)
      : [...activeSpecialSavings, value];
    setActiveSpecialSavings(newSpecials);
    persistFilters(activeCategories, activeModalities, newSpecials, onlyNewCoupons, sortBy);
  }

  function handleStatusToggle(value: string) {
    const newStatuses = activeStatuses.includes(value)
      ? activeStatuses.filter(s => s !== value)
      : [...activeStatuses, value];
    setActiveStatuses(newStatuses);
    // trigger reload with new statuses
    setOffset(0);
    loadCoupons(activeCategories, sortBy, onlyNewCoupons, 0, false, searchText, newStatuses);
  }

  function handleOnlyNewCouponsToggle() {
    const newVal = !onlyNewCoupons;
    setOnlyNewCoupons(newVal);
    const newSort = newVal ? 'recent' : sortBy;
    if (newVal) setSortBy('recent');
    persistFilters(activeCategories, activeModalities, activeSpecialSavings, newVal, newSort);
    setOffset(0);
    loadCoupons(activeCategories, newSort, newVal, 0, false, searchText, activeStatuses);
  }

  function handleSortChange(sort: string) {
    setSortBy(sort);
    persistFilters(activeCategories, activeModalities, activeSpecialSavings, onlyNewCoupons, sort);
    setOffset(0);
    loadCoupons(activeCategories, sort, onlyNewCoupons, 0, false, searchText, activeStatuses);
  }

  function handleSearchChange(text: string) {
    if (searchTimer.current) clearTimeout(searchTimer.current);
    searchTimer.current = setTimeout(() => {
      setSearchText(text);
      setOffset(0);
      loadCoupons(activeCategories, sortBy, onlyNewCoupons, 0, false, text, activeStatuses);
    }, 300);
  }

  function handleClearAll() {
    setActiveCategories([]);
    setActiveModalities([]);
    setActiveSpecialSavings([]);
    setOnlyNewCoupons(false);
    setSortBy('relevance');
    setSearchText('');
    setExcludedBrands([]);
    setBrandInputValue('');
    setActiveStatuses(['unclipped']);
    setCouponFilters([]);
    setOffset(0);
    loadCoupons([], 'relevance', false, 0, false, '', ['unclipped']);
  }

  // Keep checkAndLoadMoreRef always pointing to the latest load-next-page logic
  useEffect(() => {
    checkAndLoadMoreRef.current = () => {
      if (fetchingRef.current || !hasMore || loadError) return;
      const sentinel = sentinelRef.current;
      if (!sentinel) return;
      const rect = sentinel.getBoundingClientRect();
      if (rect.top < window.innerHeight + 200 && rect.bottom >= 0) {
        const nextOffset = offset + PAGE_SIZE;
        setOffset(nextOffset);
        loadCoupons(activeCategories, sortBy, onlyNewCoupons, nextOffset, true, undefined, activeStatuses);
      }
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hasMore, loadError, offset, activeCategories, sortBy, onlyNewCoupons]);

  // Stable scroll listener — never disconnects; calls the always-fresh checkAndLoadMoreRef
  useEffect(() => {
    const onScroll = () => checkAndLoadMoreRef.current?.();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  // Show/hide scroll-to-top button when scrolled down
  useEffect(() => {
    const onShow = () => setShowScrollTop(window.scrollY > 200);
    onShow();
    window.addEventListener('scroll', onShow, { passive: true });
    return () => window.removeEventListener('scroll', onShow);
  }, []);

  async function handleClip(id: string) {
    const coupon = coupons.find(c => c.id === id);
    if (!coupon) return;
    setClipping(prev => ({ ...prev, [id]: true }));
    const action = coupon.addedToCard ? 'UNCLIP' : 'CLIP';
    const ok = await couponApi.clipCoupon(id, action);
    if (ok) {
      setCoupons(prev => prev.map(c =>
        c.id === id ? { ...c, addedToCard: !c.addedToCard } : c,
      ));
    }
    setClipping(prev => ({ ...prev, [id]: false }));
  }

  async function handleViewDetails(id: string) {
    setModalCouponId(id);
    if (qualifyingProducts[id] !== undefined) return;
    const coupon = coupons.find(c => c.id === id);
    if (!coupon) return;
    setLoadingProducts(prev => ({ ...prev, [id]: true }));
    const upcs = await couponApi.fetchCouponFull(coupon.krogerCouponNumber);
    const prods = await couponApi.fetchProductsByUpcs(upcs.slice(0, 50));
    setQualifyingProducts(prev => ({ ...prev, [id]: prods }));
    setLoadingProducts(prev => ({ ...prev, [id]: false }));
  }

  useEffect(() => {
    if (!modalCouponId) return;
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') setModalCouponId(null); };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [modalCouponId]);

  function toggleSidebarSection(key: string) {
    setSidebarCollapsed(prev => ({ ...prev, [key]: !prev[key] }));
  }

  function handleAddExcludedBrand() {
    const b = brandInputValue.trim();
    if (!b || excludedBrands.some(x => x.toLowerCase() === b.toLowerCase())) return;
    const newExcluded = [...excludedBrands, b];
    setExcludedBrands(newExcluded);
    setBrandInputValue('');
    persistFilters(activeCategories, activeModalities, activeSpecialSavings, onlyNewCoupons, sortBy, newExcluded);
  }

  function handleRemoveExcludedBrand(brand: string) {
    const newExcluded = excludedBrands.filter(b => b !== brand);
    setExcludedBrands(newExcluded);
    persistFilters(activeCategories, activeModalities, activeSpecialSavings, onlyNewCoupons, sortBy, newExcluded);
  }

  const displayedCoupons = useMemo(() => filterCoupons(coupons, {
    modalities: activeModalities,
    specialSavings: activeSpecialSavings,
    excludedBrands,
    newOnly: onlyNewCoupons,
  }), [coupons, activeModalities, activeSpecialSavings, excludedBrands, onlyNewCoupons]);

  const hasAnyFilter = activeCategories.length > 0 || activeModalities.length > 0 ||
    activeSpecialSavings.length > 0 || onlyNewCoupons || sortBy !== 'relevance' || excludedBrands.length > 0;

  // Build dismissible filter chip list
  const activeFilterChips: { label: string; onRemove: () => void }[] = [];
  if (onlyNewCoupons) {
    activeFilterChips.push({ label: 'New (last 10 days)', onRemove: handleOnlyNewCouponsToggle });
  }
  if (sortBy !== 'relevance') {
    const sortLabel = SORT_OPTIONS.find(o => o.value === sortBy)?.label ?? sortBy;
    activeFilterChips.push({ label: `Sort: ${sortLabel}`, onRemove: () => handleSortChange('relevance') });
  }
  activeModalities.forEach(mod => {
    const opt = MODALITY_OPTIONS.find(o => o.value === mod);
    if (opt) activeFilterChips.push({ label: opt.label, onRemove: () => handleModalityToggle(mod) });
  });
  activeSpecialSavings.forEach(s => {
    activeFilterChips.push({ label: s, onRemove: () => handleSpecialSavingsToggle(s) });
  });
  activeCategories.forEach(cat => {
    const catObj = dynamicCategories.find(c => c.value === cat);
    if (catObj) activeFilterChips.push({ label: catObj.label, onRemove: () => handleCategoryToggle(cat) });
  });
  excludedBrands.forEach(brand => {
    activeFilterChips.push({ label: `Excl: ${brand}`, onRemove: () => handleRemoveExcludedBrand(brand) });
  });

  return (
    <div style={{
      display: 'flex', flexDirection: 'row',
      minHeight: '80vh', backgroundColor: 'var(--kext-bg)',
      fontFamily: 'system-ui, -apple-system, sans-serif', boxSizing: 'border-box',
    }}>
      {/* Sidebar */}
      <div style={{
        width: 256, flexShrink: 0,
        backgroundColor: '#fff', borderRight: '1px solid var(--kext-border)',
        padding: '16px 14px', alignSelf: 'flex-start',
      }}>
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14,
        }}>
          <span style={{ fontSize: 16, fontWeight: 700, color: '#111' }}>Filters</span>
          {hasAnyFilter && (
            <button
              onClick={handleClearAll}
              style={{
                color: 'var(--kext-blue)', cursor: 'pointer', border: 'none',
                background: 'none', fontSize: 12, padding: 0, fontWeight: 600,
              }}
            >
              Clear all
            </button>
          )}
        </div>

        {/* New coupons toggle */}
        <label className="kext-sidebar-label" style={{ marginBottom: 6 }}>
          <input
            type="checkbox"
            checked={onlyNewCoupons}
            onChange={handleOnlyNewCouponsToggle}
            style={{ cursor: 'pointer', accentColor: '#0066cc' }}
          />
          <span style={{ fontSize: 13, color: '#333' }}>Added in last 10 days</span>
          {newCouponsCount > 0 && (
            <span style={{
              marginLeft: 'auto', fontSize: 11, fontWeight: 600, padding: '1px 6px',
              borderRadius: 10, backgroundColor: '#e0f2fe', color: '#0369a1',
            }}>{newCouponsCount}</span>
          )}
        </label>

        {/* Status filters */}
        <div style={{ marginTop: 8, marginBottom: 8 }}>
          <div style={{ fontSize: 13, fontWeight: 600, color: '#333', marginBottom: 6 }}>Status</div>
          <label className="kext-sidebar-label">
            <input
              type="checkbox"
              checked={activeStatuses.includes('unclipped')}
              onChange={() => handleStatusToggle('unclipped')}
              style={{ cursor: 'pointer', accentColor: '#0066cc', flexShrink: 0 }}
            />
            <span style={{ fontSize: 13, color: '#333' }}>Unclipped</span>
          </label>
          <label className="kext-sidebar-label">
            <input
              type="checkbox"
              checked={activeStatuses.includes('active')}
              onChange={() => handleStatusToggle('active')}
              style={{ cursor: 'pointer', accentColor: '#0066cc', flexShrink: 0 }}
            />
            <span style={{ fontSize: 13, color: '#333' }}>Active</span>
          </label>
          <label className="kext-sidebar-label">
            <input
              type="checkbox"
              checked={activeStatuses.includes('redeemed')}
              onChange={() => handleStatusToggle('redeemed')}
              style={{ cursor: 'pointer', accentColor: '#0066cc', flexShrink: 0 }}
            />
            <span style={{ fontSize: 13, color: '#333' }}>Redeemed</span>
          </label>
        </div>

        <hr style={{ margin: '6px 0 2px', border: 'none', borderTop: '1px solid #e2e8f0' }} />

        {/* Exclude Brands */}
        <SidebarSection
          title="Exclude Brands"
          collapsed={!!sidebarCollapsed['excludeBrands']}
          onToggle={() => toggleSidebarSection('excludeBrands')}
          badgeCount={excludedBrands.length}
        >
          <div style={{ display: 'flex', gap: 4, marginBottom: 8 }}>
            <input
              className="kext-brand-input"
              type="text"
              value={brandInputValue}
              onChange={e => setBrandInputValue(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') handleAddExcludedBrand(); }}
              placeholder="Brand name..."
              style={{
                flex: 1, padding: '5px 8px', fontSize: 12, border: '1px solid #ddd',
                borderRadius: 6, outline: 'none', color: '#222',
              }}
            />
            <button
              onClick={handleAddExcludedBrand}
              style={{
                padding: '5px 10px', fontSize: 12, border: 'none', borderRadius: 6,
                backgroundColor: 'var(--kext-blue)', color: '#fff', cursor: 'pointer', fontWeight: 600,
              }}
            >
              Add
            </button>
          </div>
          {excludedBrands.map(brand => (
            <div key={brand} style={{
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              padding: '3px 0', fontSize: 12, color: '#333',
            }}>
              <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1 }}>
                {brand}
              </span>
              <button
                onClick={() => handleRemoveExcludedBrand(brand)}
                style={{
                  border: 'none', background: 'none', cursor: 'pointer',
                  color: '#aaa', fontSize: 14, padding: '0 4px', flexShrink: 0,
                }}
                title={`Remove ${brand}`}
              >
                ×
              </button>
            </div>
          ))}
          {excludedBrands.length === 0 && (
            <div style={{ fontSize: 11, color: '#bbb', fontStyle: 'italic' }}>No brands excluded</div>
          )}
        </SidebarSection>

        {/* Ways to Shop — pill toggles */}
        <SidebarSection
          title="Ways to Shop"
          collapsed={!!sidebarCollapsed.modalities}
          onToggle={() => toggleSidebarSection('modalities')}
          badgeCount={activeModalities.length}
        >
          <div style={{ display: 'flex', gap: 6, paddingBottom: 4 }}>
            {MODALITY_OPTIONS.map(m => (
              <button
                key={m.value}
                className={`kext-pill-toggle${activeModalities.includes(m.value) ? ' kext-pill-toggle--active' : ''}`}
                onClick={() => handleModalityToggle(m.value)}
                title={m.label}
              >
                {m.icon} {m.label}
              </button>
            ))}
          </div>
        </SidebarSection>

        {/* Special Savings — pill toggles */}
        <SidebarSection
          title="Special Savings"
          collapsed={!!sidebarCollapsed.specials}
          onToggle={() => toggleSidebarSection('specials')}
          badgeCount={activeSpecialSavings.length}
        >
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, paddingBottom: 4 }}>
            {SPECIAL_SAVINGS_OPTIONS.map(s => (
              <button
                key={s}
                className={`kext-special-pill${activeSpecialSavings.includes(s) ? ' kext-special-pill--active' : ''}`}
                onClick={() => handleSpecialSavingsToggle(s)}
              >
                {s}
              </button>
            ))}
          </div>
        </SidebarSection>

        {/* Product Categories — checkboxes */}
        <SidebarSection
          title="Product Categories"
          collapsed={!!sidebarCollapsed.categories}
          onToggle={() => toggleSidebarSection('categories')}
          badgeCount={activeCategories.length}
        >
          <div ref={categoriesScrollRef} style={{ maxHeight: 200, overflowY: 'auto' }}>
            {dynamicCategories.map(cat => (
              <div
                key={cat.value}
                className="kext-sidebar-label"
                onClick={e => { if ((e.target as HTMLElement).tagName === 'INPUT') return; handleCategoryToggle(cat.value); }}
              >
                <input
                  type="checkbox"
                  checked={activeCategories.includes(cat.value)}
                  onChange={() => handleCategoryToggle(cat.value)}
                  style={{ cursor: 'pointer', accentColor: '#0066cc', flexShrink: 0 }}
                />
                <span
                  onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); handleCategoryToggle(cat.value); } }}
                  role="button"
                  tabIndex={0}
                  style={{ flex: 1, cursor: 'pointer', display: 'flex', alignItems: 'center', height: '100%' }}
                >
                  {cat.label}
                </span>
              </div>
            ))}
            {dynamicCategories.length === 0 && (
              <span style={{ fontSize: 12, color: '#999' }}>Loading…</span>
            )}
          </div>
        </SidebarSection>
      </div>

      {/* Main content */}
      <div style={{ flex: 1, padding: '20px 24px', minWidth: 0 }}>
        {/* Search + Sort bar */}
        <div style={{
          display: 'flex', alignItems: 'center', gap: 14, marginBottom: 14, flexWrap: 'wrap',
        }}>
          <h2 style={{ margin: 0, fontSize: 22, fontWeight: 700, color: '#111', flexShrink: 0 }}>
            Digital Coupons
          </h2>
          <input
            className="kext-search-input"
            type="text"
            placeholder="Search coupons..."
            onChange={e => handleSearchChange(e.target.value)}
            style={{
              flex: 1, minWidth: 180, padding: '8px 14px',
              border: '1px solid var(--kext-border)', borderRadius: 8, fontSize: 14,
              outline: 'none', color: '#222', backgroundColor: '#fff',
            }}
          />
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
            <label style={{ fontSize: 13, color: '#666', whiteSpace: 'nowrap' }}>Sort by</label>
            <select
              value={sortBy}
              onChange={e => handleSortChange(e.target.value)}
              style={{
                padding: '7px 10px', border: '1px solid var(--kext-border)', borderRadius: 8,
                fontSize: 14, backgroundColor: '#fff', cursor: 'pointer', color: '#222',
              }}
            >
              {SORT_OPTIONS.map(o => (
                <option key={o.value} value={o.value}>{o.label}</option>
              ))}
            </select>
          </div>
        </div>

        {/* Active filter chips */}
        {activeFilterChips.length > 0 && (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 12 }}>
            {activeFilterChips.map((chip, i) => (
              <span key={i} className="kext-chip">
                {chip.label}
                <button className="kext-chip-x" onClick={chip.onRemove} title="Remove filter">×</button>
              </span>
            ))}
          </div>
        )}

        {loading ? (
          <>
            <div style={{ color: '#c0c8d0', fontSize: 13, marginBottom: 12 }}>&nbsp;</div>
            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))',
              gap: 16,
            }}>
              {Array.from({ length: 8 }).map((_, i) => (
                <div key={i} className="kext-skeleton" style={{ height: 280 }} />
              ))}
            </div>
          </>
        ) : (
          <>
            <div style={{ color: '#718096', fontSize: 13, marginBottom: 12 }}>
              {totalCount > 0 ? `${totalCount} coupons` : `${coupons.length} coupons`}
            </div>
            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))',
              gap: 16,
            }}>
              {displayedCoupons.map(coupon => (
                <CouponCard
                  key={coupon.id}
                  coupon={coupon}
                  clipping={!!clipping[coupon.id]}
                  onClip={handleClip}
                  onViewDetails={handleViewDetails}
                />
              ))}
            </div>
            {/* Infinite scroll sentinel / status */}
            {hasMore && !loadError && (
              <div ref={sentinelRef} style={{ height: 48, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                {loadingMore && <span style={{ fontSize: 13, color: '#888' }}>Loading more...</span>}
              </div>
            )}
            {loadError && (
              <div style={{ display: 'flex', justifyContent: 'center', marginTop: 24, gap: 10, alignItems: 'center' }}>
                <span style={{ fontSize: 13, color: '#c62828' }}>Failed to load more coupons.</span>
                <button
                  onClick={() => {
                    setLoadError(false);
                    const nextOffset = offset + PAGE_SIZE;
                    setOffset(nextOffset);
                    loadCoupons(activeCategories, sortBy, onlyNewCoupons, nextOffset, true, searchText, activeStatuses);
                  }}
                  style={{
                    padding: '6px 20px', backgroundColor: 'var(--kext-blue)', color: '#fff',
                    border: 'none', borderRadius: 16, cursor: 'pointer',
                    fontSize: 13, fontWeight: 700,
                  }}
                >
                  Retry
                </button>
              </div>
            )}
          </>
        )}
      </div>
      {/* Scroll-to-top button */}
      {showScrollTop && (
        <button
          onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
          title="Scroll to top"
          aria-label="Scroll to top"
          style={{
            position: 'fixed', right: 20, bottom: 24, zIndex: 9000,
            width: 44, height: 44, borderRadius: 22, border: 'none',
            backgroundColor: 'var(--kext-blue)', color: '#fff',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            boxShadow: '0 6px 20px rgba(0,0,0,0.2)', cursor: 'pointer'
          }}
        >
          <span style={{ fontSize: 20, lineHeight: 1 }}>↑</span>
        </button>
      )}
      {modalCouponId && (() => {
        const coupon = coupons.find(c => c.id === modalCouponId);
        if (!coupon) return null;
        return createPortal(
          <CouponDetailModal
            coupon={coupon}
            clipping={!!clipping[coupon.id]}
            onClip={handleClip}
            onClose={() => setModalCouponId(null)}
            products={qualifyingProducts[coupon.id] ?? []}
            loadingProducts={!!loadingProducts[coupon.id]}
          />,
          document.body,
        );
      })()}
    </div>
  );
}
