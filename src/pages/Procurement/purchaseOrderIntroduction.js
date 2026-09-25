import { BRANDING_CONFIG } from '../../config/branding.config.js';

export const ORDER_INTRODUCTION_MAX_LENGTH = 10000;

export function defaultPurchaseOrderIntroduction(vendorName) {
  const seller = String(vendorName ?? '').trim() || '—';
  return `We, ${BRANDING_CONFIG.brand.companyFull} (Buyer), issue this purchase order to ${seller} (Seller).`;
}

export function purchaseOrderIntroduction(order, vendorName = order?.vendor_name) {
  if (order?.contact_persons?.show_order_introduction === false) return '';
  const custom = order?.contact_persons?.order_introduction;
  if (typeof custom === 'string') return custom.trim() ? custom : '';
  return defaultPurchaseOrderIntroduction(vendorName);
}

export function purchaseOrderIntroductionVisible(order, vendorName = order?.vendor_name) {
  const visible = order?.contact_persons?.show_order_introduction;
  if (typeof visible === 'boolean') return visible;
  return Boolean(purchaseOrderIntroduction(order, vendorName));
}
