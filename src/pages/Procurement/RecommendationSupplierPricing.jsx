import React, { useRef, useState } from 'react';
import PropTypes from 'prop-types';
import {
  ArrowTopRightOnSquareIcon, BanknotesIcon, CalculatorIcon, CheckCircleIcon,
  ChevronDownIcon, ChevronRightIcon, InformationCircleIcon, MagnifyingGlassIcon,
  PlusIcon, TrashIcon, XMarkIcon,
} from '@heroicons/react/24/outline';
import './RecommendationSupplierPricing.css';
import { confirmedRecommendationVat, recommendationEnteredAmount, recommendationVat, recommendationLineDiscount } from './recommendationVat';
import { calculateProcurementVat, PROCUREMENT_VAT_OPTIONS, procurementLineNet } from '../../utils/procurementVat';

const vendorId = (vendor) => String(vendor?.vendor_id || vendor?.id || '');
const number = (value) => value === '' || value === null || value === undefined || !Number.isFinite(Number(value)) ? null : Number(value);
const money = (value) => Number(value || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const FieldError = ({ value }) => value ? <p className="prf-sp-error" role="alert">{value}</p> : null;
FieldError.propTypes = { value: PropTypes.node };

function SupplierCheck({ available, children }) {
  const Icon = available ? CheckCircleIcon : InformationCircleIcon;
  return <span className={`prf-sp-check ${available ? 'is-verified' : ''}`}><Icon aria-hidden="true" />{children}</span>;
}
SupplierCheck.propTypes = { available: PropTypes.bool, children: PropTypes.node };

export default function RecommendationSupplierPricing({
  formData, setFormData, errors = {}, vendors = [], vendorSearch = '', onVendorSearch,
  loadingVendors, vendorLoadError, onAddVendor, onRemoveVendor, onPreferredVendor,
  onAddLineItem, onUpdateLineItem, onRemoveLineItem, showAdvancedPricing,
  setShowAdvancedPricing, manualIcv, setManualIcv, onSaveManualIcv, onPriceDescriptionChange,
}) {
  const [showVendorOptions, setShowVendorOptions] = useState(false);
  const [showVendorDetails, setShowVendorDetails] = useState(false);
  const searchRef = useRef(null);
  const shortlist = formData.selected_vendors || [];
  const preferred = shortlist.find((vendor) => vendorId(vendor) === String(formData.vendor || ''));
  const masterVendor = vendors.find((vendor) => String(vendor.id) === String(formData.vendor || ''));
  const selectedVendor = preferred || masterVendor;
  const recordedSupplier = !formData.vendor && String(formData.supplier_name || '').trim();
  const selectedDetails = { ...preferred, ...masterVendor };
  const metadata = formData.price_remarks_data || {};
  const selectionType = metadata.selection_type || (shortlist.length === 1 ? 'single_source' : 'competitive_shortlist');
  const items = formData.items || [];
  const currency = formData.currency || 'AED';
  const vatConfirmed = confirmedRecommendationVat(formData.vat_basis);
  const includesVat = formData.vat_basis === 'inclusive';
  const enteredAmount = recommendationEnteredAmount(formData);
  const { netAmount: net, taxAmount: vat, totalAmount: gross, vatRate } = recommendationVat(formData);
  const budget = number(formData.estimated_budget);
  const icv = number(selectedDetails.icv_percentage);
  const icvExpired = selectedDetails.icv_expiry_date && selectedDetails.icv_expiry_date < new Date().toISOString().slice(0, 10);
  const active = selectedDetails.status === 'active' || selectedDetails.is_active === true;
  const updateField = (field, value) => setFormData((previous) => ({ ...previous, [field]: value, ...(field === 'currency' ? { _vatPricingChanged: true } : {}) }));
  const changeVatBasis = value => setFormData(previous => {
    const inputAmount = recommendationEnteredAmount(previous);
    const amounts = calculateProcurementVat(inputAmount, previous.price_remarks_data?.discount_amount ?? 0, { basis: value });
    return { ...previous, vat_basis: value, _vatPricingChanged: true, _vatEnteredAmount: inputAmount,
      net_total_excl_vat: amounts.netAmount === null ? '' : amounts.netAmount.toFixed(2),
      total_price: amounts.totalAmount === null ? '' : amounts.totalAmount.toFixed(2),
    };
  });
  const updateMetadata = (field, value) => setFormData((previous) => ({ ...previous, price_remarks_data: { ...(previous.price_remarks_data || {}), [field]: value } }));
  const openVendorSearch = () => {
    setShowVendorOptions(true);
    onVendorSearch(vendorSearch);
    searchRef.current?.focus();
  };

  return <div className="prf-sp">
    <section className="prf-sp-card" aria-labelledby="prf-supplier-title">
      <h2 id="prf-supplier-title">Supplier selection</h2>
      <fieldset className="prf-sp-selection-type">
        <legend>Selection type <span className="prf-sp-required">*</span> <InformationCircleIcon aria-hidden="true" /></legend>
        <div>
          {[
            ['competitive_shortlist', 'Competitive shortlist'],
            ['single_source', 'Single source'],
            ['not_selected', 'Supplier not yet selected'],
          ].map(([value, label]) => <label key={value}><input type="radio" name="supplier_selection_type" value={value} checked={selectionType === value} onChange={() => updateMetadata('selection_type', value)} />{label}</label>)}
        </div>
      </fieldset>

      <div className="prf-sp-supplier-grid">
        <div className="prf-sp-subcard prf-sp-shortlist">
          <h3>Vendor shortlist</h3>
          <div className="prf-sp-vendor-search" onBlur={(event) => { if (!event.currentTarget.contains(event.relatedTarget)) setShowVendorOptions(false); }}>
            <div className="prf-sp-search-field"><MagnifyingGlassIcon aria-hidden="true" /><input ref={searchRef} type="search" aria-label="Search vendors by name or code" placeholder="Search vendors by name or code..." value={vendorSearch} autoComplete="off" onChange={(event) => { onVendorSearch(event.target.value); setShowVendorOptions(true); }} onFocus={() => { setShowVendorOptions(true); if (!vendors.length) onVendorSearch(vendorSearch); }} onKeyDown={(event) => { if (event.key === 'Escape') { setShowVendorOptions(false); event.stopPropagation(); } }} /></div>
            <button type="button" className="prf-sp-button" onClick={openVendorSearch}><PlusIcon aria-hidden="true" />Add supplier</button>
            {showVendorOptions && <div className="prf-sp-vendor-options" aria-label="Available suppliers">
              <div className="prf-sp-options-heading"><span>Choose an existing supplier</span><button type="button" aria-label="Close supplier search" className="prf-sp-icon-button" onClick={() => setShowVendorOptions(false)}><XMarkIcon /></button></div>
              {loadingVendors ? <p role="status">Loading suppliers...</p> : vendorLoadError ? <p role="alert">{vendorLoadError} <button className="prf-sp-link" type="button" onClick={() => onVendorSearch(vendorSearch)}>Retry</button></p> : vendors.length === 0 ? <p>No active suppliers found.</p> : vendors.map((vendor) => {
                const included = shortlist.some((candidate) => vendorId(candidate) === String(vendor.id));
                return <button className="prf-sp-vendor-option" type="button" key={vendor.id} disabled={included} onClick={async () => { await onAddVendor(vendor.id); setShowVendorOptions(false); }}><span><strong>{vendor.name}</strong><small>{vendor.vendor_code || 'Code not provided'}</small></span>{included ? <span>Shortlisted</span> : <PlusIcon aria-hidden="true" />}</button>;
              })}
            </div>}
          </div>
          <div className="prf-sp-shortlist-rows">
            {shortlist.length === 0 && <div className="prf-sp-empty">{recordedSupplier ? <><strong>{recordedSupplier}</strong><p>Recorded on the PR. A vendor master link has not been selected.</p></> : 'Search and add suppliers to compare their offers.'}</div>}
            {shortlist.map((vendor) => {
              const id = vendorId(vendor);
              const master = vendors.find((candidate) => String(candidate.id) === id);
              const isActive = (master?.status || vendor.status) === 'active' || master?.is_active === true || vendor.is_active === true;
              const selected = String(formData.vendor || '') === id;
              return <div className={`prf-sp-shortlist-row ${selected ? 'is-selected' : ''}`} key={id}>
                <label><input type="radio" name="preferred_shortlist_vendor" checked={selected} onChange={() => onPreferredVendor(id)} /><span><strong>{vendor.name}</strong><small>{vendor.vendor_code || master?.vendor_code || 'Code not provided'}</small></span></label>
                {isActive && <span className="prf-sp-badge is-green">Active</span>}
                <button type="button" className="prf-sp-icon-button prf-sp-remove-vendor" onClick={() => onRemoveVendor(id)} aria-label={`Remove ${vendor.name} from shortlist`}><XMarkIcon /></button>
              </div>;
            })}
          </div>
          <FieldError value={errors.selected_vendors} />
        </div>

        <div className="prf-sp-subcard prf-sp-selected-supplier">
          <div className="prf-sp-card-heading"><h3>Selected supplier</h3>{selectedVendor && <button type="button" className="prf-sp-link" onClick={() => setShowVendorDetails(!showVendorDetails)} aria-expanded={showVendorDetails}>View supplier details <ArrowTopRightOnSquareIcon aria-hidden="true" /></button>}</div>
          <strong className="prf-sp-supplier-name">{selectedVendor?.name || formData.supplier_name || 'Choose a preferred supplier'}</strong>
          <span className="prf-sp-muted">{selectedDetails.vendor_code || formData.supplier_business_id || (recordedSupplier ? 'Supplier recorded on the PR' : 'Supplier details appear after selection')}</span>
          {selectedVendor && <div className="prf-sp-supplier-checks">
            <SupplierCheck available={icv !== null && !icvExpired}>{icv === null ? 'ICV not recorded' : icvExpired ? 'ICV expired' : `ICV ${icv}% available`}</SupplierCheck>
            <SupplierCheck available={active}>{active ? 'Vendor active' : selectedDetails.status ? `Vendor ${selectedDetails.status}` : 'Vendor status not provided'}</SupplierCheck>
            <SupplierCheck available={false}>Commercial documents not verified</SupplierCheck>
          </div>}
          {showVendorDetails && <dl className="prf-sp-vendor-detail-list">
            <div><dt>Business ID</dt><dd>{selectedDetails.trade_license_number || selectedDetails.tax_id || formData.supplier_business_id || 'Not provided'}</dd></div>
            <div><dt>Email</dt><dd>{selectedDetails.email || selectedDetails.contact_email || 'Not provided'}</dd></div>
            <div><dt>ICV expiry</dt><dd>{selectedDetails.icv_expiry_date || 'Not provided'}</dd></div>
          </dl>}
          <label className="prf-sp-field">Preferred supplier <span className="prf-sp-required">*</span><select name="vendor" value={formData.vendor || ''} onChange={(event) => onPreferredVendor(event.target.value)} aria-invalid={!!errors.vendor}><option value="">{recordedSupplier || 'Select from shortlisted suppliers'}</option>{shortlist.map((vendor) => <option key={vendorId(vendor)} value={vendorId(vendor)}>{vendor.name}</option>)}</select></label>
          <FieldError value={errors.vendor} />
          <label className="prf-sp-field">Reason for supplier selection <span className="prf-sp-required">*</span><textarea name="vendor_selection_reason" rows={2} value={formData.vendor_selection_reason || ''} onChange={(event) => updateField('vendor_selection_reason', event.target.value)} placeholder="Explain the supplier's value, experience and commercial terms..." aria-invalid={!!errors.vendor_selection_reason} /></label>
          <span className="prf-sp-character-count">{(formData.vendor_selection_reason || '').length} characters</span>
          <FieldError value={errors.vendor_selection_reason} />
        </div>
      </div>

      {manualIcv?.vendorId && <div className="prf-sp-notice prf-sp-manual-icv">
        <strong>ICV is not recorded for this supplier</strong>
        <div className="prf-sp-icv-fields">
          <label className="prf-sp-field">ICV percentage<input type="number" min="0" max="100" step="0.01" value={manualIcv.value} onChange={(event) => setManualIcv((previous) => ({ ...previous, value: event.target.value, error: '' }))} placeholder="0-100" /></label>
          <label className="prf-sp-field">Certificate expiry (optional)<input type="date" value={manualIcv.expiryDate} onChange={(event) => setManualIcv((previous) => ({ ...previous, expiryDate: event.target.value, error: '' }))} /></label>
          <button type="button" className="prf-sp-button" disabled={manualIcv.saving} onClick={onSaveManualIcv}>{manualIcv.saving ? 'Saving...' : 'Save ICV'}</button>
        </div>
        <FieldError value={manualIcv.error} />
      </div>}
      {(shortlist.length === 1 || selectionType === 'single_source') && <div className="prf-sp-single-source"><label className="prf-sp-field">Single source justification <span className="prf-sp-required">*</span><textarea name="single_source_justification" rows={2} value={formData.single_source_justification || ''} onChange={(event) => updateField('single_source_justification', event.target.value)} placeholder="Explain why only one supplier is being considered..." aria-invalid={!!errors.single_source_justification} /></label><FieldError value={errors.single_source_justification} /></div>}
    </section>

    <section className="prf-sp-card prf-sp-commercial" aria-labelledby="prf-commercial-title">
      <div className="prf-sp-card-heading prf-sp-commercial-heading"><h2 id="prf-commercial-title">Commercial comparison</h2><div className="prf-sp-pricing-controls"><label className="prf-sp-vat-basis">VAT treatment<select name="vat_basis" aria-label="VAT price basis" aria-invalid={Boolean(errors.vat_basis && !vatConfirmed)} value={vatConfirmed ? formData.vat_basis : 'unconfirmed'} onChange={event => changeVatBasis(event.target.value)}><option value="unconfirmed" disabled>Confirm VAT treatment</option>{PROCUREMENT_VAT_OPTIONS.map(option => <option key={option.value} value={option.value}>{option.label}</option>)}</select></label><label className="prf-sp-currency">Currency<select name="currency" value={currency} onChange={(event) => updateField('currency', event.target.value)}>{['AED', 'USD', 'EUR', 'GBP', 'SAR', 'INR'].map((code) => <option key={code}>{code}</option>)}</select></label></div></div>
      {!vatConfirmed && <p className="prf-sp-muted">VAT is not confirmed. Recorded amounts stay unchanged until you choose the VAT treatment and save.</p>}
      <div className="prf-sp-table-scroll">
        <table className="prf-sp-items" data-table-typography="preserve"><colgroup><col className="prf-sp-col-number" /><col className="prf-sp-col-description" /><col className="prf-sp-col-quantity" /><col className="prf-sp-col-unit" /><col className="prf-sp-col-price" /><col className="prf-sp-col-vat" /><col className="prf-sp-col-total" /><col className="prf-sp-col-vendor" /><col className="prf-sp-col-action" /></colgroup><thead><tr><th scope="col">#</th><th scope="col">Description <span className="prf-sp-required">*</span></th><th scope="col">Qty <span className="prf-sp-required">*</span></th><th scope="col">Unit <span className="prf-sp-required">*</span></th><th scope="col">Unit price ({currency}) <span className="prf-sp-required">*</span></th><th scope="col">VAT</th><th scope="col">Total ({currency})</th><th scope="col">Vendor</th><th scope="col"><span className="prf-sp-sr-only">Actions</span></th></tr></thead><tbody>
          {items.length === 0 ? <tr><td colSpan={9}><button type="button" onClick={onAddLineItem} className="prf-sp-add-first"><PlusIcon aria-hidden="true" />Add a line item with quantities and pricing</button></td></tr> : items.map((item, index) => {
            const lineAmount = procurementLineNet(item.quantity, item.unit_price, recommendationLineDiscount(item));
            const lineTotal = vatConfirmed ? calculateProcurementVat(lineAmount, 0, { basis: formData.vat_basis }).totalAmount : number(item.total) ?? lineAmount;
            return <tr key={index}><td>{index + 1}</td>
              <td><input aria-label={`Line item ${index + 1} description`} value={item.description || ''} placeholder="Description" onChange={(event) => onUpdateLineItem(index, 'description', event.target.value)} /></td>
              <td><input type="number" min="0.0001" step="0.0001" aria-label={`Line item ${index + 1} quantity`} value={item.quantity ?? ''} onChange={(event) => onUpdateLineItem(index, 'quantity', event.target.value)} /></td>
              <td><input aria-label={`Line item ${index + 1} unit`} value={item.unit || ''} placeholder="Unit" onChange={(event) => onUpdateLineItem(index, 'unit', event.target.value)} /></td>
              <td><input type="number" min="0" step="0.01" aria-label={`Line item ${index + 1} unit price`} value={item.unit_price ?? ''} placeholder="0.00" onChange={(event) => onUpdateLineItem(index, 'unit_price', event.target.value)} /></td>
              <td><span aria-label={`Line item ${index + 1} VAT`}>{vatRate === null ? 'Not confirmed' : `${vatRate}%`}</span></td>
              <td className="prf-sp-line-total" title={vatConfirmed ? 'Line total with the selected VAT treatment' : 'Recorded line amount'}>{money(lineTotal)}</td>
              <td><select aria-label={`Line item ${index + 1} vendor`} value={item.vendor_id || item.vendor || ''} onChange={(event) => onUpdateLineItem(index, 'vendor_id', event.target.value)}><option value="">{selectedVendor?.name || recordedSupplier || 'Preferred supplier'}</option>{shortlist.map((vendor) => <option key={vendorId(vendor)} value={vendorId(vendor)}>{vendor.name}</option>)}</select></td>
              <td><button type="button" className="prf-sp-icon-button" onClick={() => onRemoveLineItem(index)} aria-label={`Remove line item ${index + 1}`}><TrashIcon /></button></td>
            </tr>;
          })}
        </tbody></table>
      </div>
      <FieldError value={errors.items} />
      <FieldError value={errors.total_price} />
      <FieldError value={vatConfirmed ? null : errors.vat_basis} />
      <div className="prf-sp-commercial-bottom">
        <div className="prf-sp-negotiation"><button type="button" className="prf-sp-button prf-sp-add-line" onClick={onAddLineItem}><PlusIcon aria-hidden="true" />Add line item</button><label className="prf-sp-field">Negotiation outcome <InformationCircleIcon aria-hidden="true" /><textarea name="price_remarks" rows={1} value={formData.price_remarks || ''} onChange={(event) => updateField('price_remarks', event.target.value)} placeholder="Record negotiation outcome, agreed savings, commercial clarifications, or final terms..." /></label></div>
        <dl className="prf-sp-totals" aria-label="Recommendation totals"><div><dt>Net excluding VAT ({currency})</dt><dd>{money(net)}</dd></div><div><dt>{vatRate === null ? 'VAT not confirmed' : vatRate === 0 ? 'No VAT' : 'VAT (5%)'}</dt><dd>{money(vat)}</dd></div><div className="prf-sp-grand-total"><dt>{vatConfirmed ? 'Total' : 'Recorded total'} ({currency})</dt><dd>{money(gross)}</dd></div></dl>
      </div>
      {items.length === 0 && <div className="prf-sp-lump-pricing"><label className="prf-sp-field">Entered price {vatConfirmed && formData.vat_basis !== 'none' ? includesVat ? 'including VAT' : 'excluding VAT' : ''} <span className="prf-sp-required">*</span><input type="number" min="0" step="0.01" aria-label="Entered price" name="entered_price" value={enteredAmount ?? ''} onChange={(event) => { const value = event.target.value; const amounts = vatConfirmed ? calculateProcurementVat(value, formData.price_remarks_data?.discount_amount ?? 0, { basis: formData.vat_basis }) : { netAmount: number(value), totalAmount: number(value) }; setFormData(previous => ({ ...previous, _vatPricingChanged: true, _vatEnteredAmount: value, net_total_excl_vat: amounts.netAmount === null ? '' : amounts.netAmount.toFixed(2), total_price: amounts.totalAmount === null ? '' : amounts.totalAmount.toFixed(2) })); }} placeholder="0.00" aria-invalid={!!errors.total_price} /></label></div>}
      <button type="button" className="prf-sp-link prf-sp-advanced-toggle" onClick={() => setShowAdvancedPricing(!showAdvancedPricing)} aria-expanded={showAdvancedPricing}>{showAdvancedPricing ? <ChevronDownIcon aria-hidden="true" /> : <ChevronRightIcon aria-hidden="true" />}{showAdvancedPricing ? 'Hide' : 'Show'} advanced pricing details</button>
      {showAdvancedPricing && <div className="prf-sp-advanced">
        <label className="prf-sp-field prf-sp-full-width">Pricing description<textarea name="price_description" rows={2} value={formData.price_description || ''} onChange={(event) => onPriceDescriptionChange ? onPriceDescriptionChange(event.target.value) : updateField('price_description', event.target.value)} placeholder="Description to show on the purchase recommendation" /></label><FieldError value={errors.price_description} />
        {[['budget_allocation', 'Budget allocation'], ['cost_center', 'Cost center'], ['payment_terms', 'Payment terms']].map(([field, label]) => <label className="prf-sp-field" key={field}>{label}<input value={metadata[field] || ''} onChange={(event) => updateMetadata(field, event.target.value)} /></label>)}
        {items.length === 0 && <label className="prf-sp-field">Estimated budget ({currency})<input type="number" min="0" step="0.01" name="estimated_budget" value={formData.estimated_budget ?? ''} onChange={(event) => updateField('estimated_budget', event.target.value)} placeholder="Not provided" /></label>}
        {items.map((item, index) => <label className="prf-sp-field" key={index}>Line {index + 1} budget ({currency})<input type="number" min="0" step="0.01" value={item.budget ?? ''} onChange={(event) => onUpdateLineItem(index, 'budget', event.target.value)} aria-label={`Line item ${index + 1} budget`} placeholder="Not provided" /></label>)}
      </div>}
      <div className="prf-sp-budget-heading">Budget check <InformationCircleIcon aria-hidden="true" /></div>
      <div className={`prf-sp-budget ${budget === null ? 'is-unavailable' : ''}`}>
        <div><span className="prf-sp-budget-icon"><BanknotesIcon aria-hidden="true" /></span><span><small>Entered budget</small><strong>{budget === null ? 'Not provided' : `${money(budget)} ${currency}`}</strong></span></div>
        <div><span className="prf-sp-budget-icon"><CalculatorIcon aria-hidden="true" /></span><span><small>Recommendation total</small><strong>{money(gross)} {currency}</strong></span></div>
        <div><span className="prf-sp-budget-icon"><BanknotesIcon aria-hidden="true" /></span><span><small>Remaining against entered budget</small><strong className={budget !== null && budget < gross ? 'prf-sp-error' : ''}>{budget === null ? 'Not available' : `${money(budget - gross)} ${currency}`}</strong></span></div>
      </div>
      <p className="prf-sp-budget-note">{budget === null ? 'Add the approved budget in advanced pricing details to compare this recommendation.' : 'Based on the entered budget. Available project funding has not been verified.'}</p>
    </section>
  </div>;
}

RecommendationSupplierPricing.propTypes = {
  formData: PropTypes.object.isRequired, setFormData: PropTypes.func.isRequired,
  errors: PropTypes.object, vendors: PropTypes.array, vendorSearch: PropTypes.string,
  onVendorSearch: PropTypes.func.isRequired, loadingVendors: PropTypes.bool, vendorLoadError: PropTypes.string,
  onAddVendor: PropTypes.func.isRequired, onRemoveVendor: PropTypes.func.isRequired, onPreferredVendor: PropTypes.func.isRequired,
  onAddLineItem: PropTypes.func.isRequired, onUpdateLineItem: PropTypes.func.isRequired, onRemoveLineItem: PropTypes.func.isRequired,
  showAdvancedPricing: PropTypes.bool, setShowAdvancedPricing: PropTypes.func.isRequired,
  manualIcv: PropTypes.object, setManualIcv: PropTypes.func.isRequired, onSaveManualIcv: PropTypes.func.isRequired,
  onPriceDescriptionChange: PropTypes.func,
};
