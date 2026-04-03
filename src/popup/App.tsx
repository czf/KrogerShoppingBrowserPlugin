import { useEffect, useState } from 'react';
import type { FeatureFlags } from '../utils/storage';
import { DEFAULT_FLAGS, getFeatureFlags, setFeatureFlags } from '../utils/storage';

const LABELS: Record<keyof FeatureFlags, { label: string; desc: string }> = {
  removeSponsored:       { label: 'Remove Sponsored Products', desc: 'Hides "Featured" cards on search/listing pages' },
  enhancedProductData:   { label: 'Inventory & Sale Data',     desc: 'Shows stock level, quantity, sale price & end date on product pages' },
  couponScrollResilience:{ label: 'Coupon Scroll Resilience',  desc: 'Shows a retry button if the coupon list fails to load more' },
  couponFilterPrefs:     { label: 'Save Coupon Filters',       desc: 'Remembers your filter selections on the coupon page' },
  couponModalLinks:      { label: 'Coupon Product Links',      desc: 'Adds product page links inside coupon detail modals' },
  couponCustomPage:      { label: 'Custom Coupon Page',        desc: 'Replaces the coupon page with a faster, filter-persistent custom UI' },
};

export default function App() {
  const [flags, setFlags] = useState<FeatureFlags>(DEFAULT_FLAGS);
  const [saved, setSaved] = useState(false);

  useEffect(() => { getFeatureFlags().then(setFlags); }, []);

  const toggle = async (key: keyof FeatureFlags) => {
    const next = { ...flags, [key]: !flags[key] };
    setFlags(next);
    await setFeatureFlags(next);
    setSaved(true);
    setTimeout(() => setSaved(false), 1500);
  };

  return (
    <div style={{ width: 300, padding: '12px 16px', fontFamily: 'system-ui, -apple-system, sans-serif', fontSize: 14 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, paddingBottom: 10, borderBottom: '1px solid #e2e8f0', marginBottom: 8 }}>
        <span style={{ fontSize: 22 }}>🛒</span>
        <strong style={{ fontSize: 15, color: '#1e293b' }}>Kroger Enhancer</strong>
        {saved && <span style={{ marginLeft: 'auto', color: '#16a34a', fontSize: 12 }}>Saved ✓</span>}
      </div>

      {(Object.entries(LABELS) as [keyof FeatureFlags, { label: string; desc: string }][]).map(([key, { label, desc }]) => (
        <label key={key} style={{ display: 'flex', alignItems: 'flex-start', gap: 10, padding: '7px 0', cursor: 'pointer', borderBottom: '1px solid #f1f5f9' }}>
          <input
            type="checkbox"
            checked={flags[key]}
            onChange={() => toggle(key)}
            style={{ width: 15, height: 15, marginTop: 2, cursor: 'pointer', flexShrink: 0 }}
          />
          <div>
            <div style={{ fontWeight: 500, color: '#1e293b' }}>{label}</div>
            <div style={{ fontSize: 12, color: '#94a3b8', marginTop: 1 }}>{desc}</div>
          </div>
        </label>
      ))}

      <div style={{ marginTop: 10, fontSize: 11, color: '#cbd5e1', textAlign: 'center' }}>
        Changes take effect on next page load
      </div>

      <div style={{ marginTop: 12, fontSize: 12, color: '#64748b', textAlign: 'center' }}>
        <a href="https://github.com/czf/KrogerShoppingBrowserPlugin/" target="_blank" rel="noreferrer" style={{ color: '#0369a1', textDecoration: 'none' }}>GitHub Repository</a>
      </div>
    </div>
  );
}
