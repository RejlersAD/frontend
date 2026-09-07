import React, { useEffect, useMemo, useState } from 'react';
import PropTypes from 'prop-types';
import {
  ArrowUpTrayIcon,
  BanknotesIcon,
  BuildingOffice2Icon,
  CheckIcon,
  PhotoIcon,
  ShieldCheckIcon,
  XMarkIcon,
} from '@heroicons/react/24/outline';
import apiClient from '../../services/api.service';

const cx = (...classes) => classes.filter(Boolean).join(' ');
const splitList = (value) => String(value || '').split(',').map((item) => item.trim()).filter(Boolean);
const joinList = (value) => Array.isArray(value) ? value.join(', ') : '';
const isoDate = (value) => {
  if (!value) return '';
  const text = String(value).trim();
  const iso = text.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (iso) return `${iso[1]}-${iso[2]}-${iso[3]}`;
  const dayFirst = text.match(/^(\d{1,2})[./-](\d{1,2})[./-](\d{4})$/);
  if (dayFirst) return `${dayFirst[3]}-${dayFirst[2].padStart(2, '0')}-${dayFirst[1].padStart(2, '0')}`;
  const parsed = new Date(text);
  return Number.isNaN(parsed.getTime()) ? '' : parsed.toISOString().slice(0, 10);
};

const makeForm = (supplier) => ({
  name: supplier.name || '', vendor_code: supplier.vendor_code || '', status: supplier.status === 'pending' ? 'active' : supplier.status || 'active',
  logo_url: supplier.logo_url || '', country: supplier.country || '', address: supplier.address || '',
  business_type: supplier.business_type || '', specialization: supplier.specialization || '',
  website: supplier.website || '', city: supplier.city || '',
  contact_person: supplier.contact_person || '', email: supplier.email || '', phone: supplier.phone || '',
  categories: joinList(supplier.categories), tax_id: supplier.tax_id || '',
  trade_license_number: supplier.trade_license_number || '', vat_number: supplier.vat_number || '',
  certifications: joinList(supplier.certifications), quality_standards: joinList(supplier.quality_standards),
  approved_materials: joinList(supplier.approved_materials), inspection_authority: supplier.inspection_authority || '',
  hse_rating: supplier.hse_rating || '', is_icv_certified: Boolean(supplier.is_icv_certified),
  icv_percentage: supplier.icv_percentage ?? '', icv_certificate: supplier.icv_certificate || '',
  icv_expiry_date: isoDate(supplier.icv_expiry_date), icv_issuing_authority: supplier.icv_issuing_authority || 'ADDED',
  adnoc_approved: Boolean(supplier.adnoc_approved), payment_terms: supplier.payment_terms || '',
  credit_limit: supplier.credit_limit ?? '', vendor_tenure_years: supplier.vendor_tenure_years ?? '',
  rating: supplier.rating ?? '', performance_notes: supplier.performance_notes || '', notes: supplier.notes || '',
});

const Field = ({ label, hint, className, children }) => (
  <label className={cx('block min-w-0', className)}>
    <span className="block text-xs font-semibold text-slate-700">{label}</span>
    {children}
    {hint && <span className="mt-1 block text-[11px] leading-4 text-slate-500">{hint}</span>}
  </label>
);

Field.propTypes = {
  label: PropTypes.string.isRequired,
  hint: PropTypes.string,
  className: PropTypes.string,
  children: PropTypes.node.isRequired,
};

const inputClass = 'mt-1 block h-10 w-full rounded-lg border border-slate-300 bg-white px-3 text-sm text-slate-900 shadow-sm outline-none transition placeholder:text-slate-400 focus:border-blue-500 focus:ring-2 focus:ring-blue-100 disabled:bg-slate-100 disabled:text-slate-500';
const textareaClass = 'mt-1 block w-full resize-y rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm leading-5 text-slate-900 shadow-sm outline-none transition placeholder:text-slate-400 focus:border-blue-500 focus:ring-2 focus:ring-blue-100';

const SupplierEditModal = ({ supplier, onClose, onSaved }) => {
  const [tab, setTab] = useState('basic');
  const [form, setForm] = useState(() => makeForm(supplier));
  const [logoFile, setLogoFile] = useState(null);
  const [logoPreview, setLogoPreview] = useState(supplier.logo_url || supplier.logo || '');
  const [removeLogo, setRemoveLogo] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => () => {
    if (logoPreview.startsWith('blob:')) URL.revokeObjectURL(logoPreview);
  }, [logoPreview]);

  const initials = useMemo(() => String(form.name || 'S').split(/\s+/).slice(0, 2).map((word) => word[0]).join('').toUpperCase(), [form.name]);
  const setValue = (key, value) => setForm((current) => ({ ...current, [key]: value }));
  const tabs = [
    { id: 'basic', label: 'Basic Information', icon: BuildingOffice2Icon },
    { id: 'legal', label: 'Financial & Legal', icon: ShieldCheckIcon },
    { id: 'icv', label: 'ICV & ADNOC', icon: ShieldCheckIcon },
    { id: 'payment', label: 'Payment Terms', icon: BanknotesIcon },
  ];

  const chooseLogo = (event) => {
    const file = event.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith('image/') || file.size > 2 * 1024 * 1024) {
      setError('Choose a PNG, JPEG, WebP, or GIF image no larger than 2 MB.');
      event.target.value = '';
      return;
    }
    setError('');
    setLogoFile(file);
    setRemoveLogo(false);
    setValue('logo_url', '');
    setLogoPreview(URL.createObjectURL(file));
  };

  const submit = async (event) => {
    event.preventDefault();
    if (!form.name.trim() || !form.business_type || !form.email.trim() || !form.phone.trim() || !form.country.trim()) {
      setTab('basic');
      setError('Complete all required Basic Information fields before saving.');
      return;
    }
    if (!splitList(form.categories).length) {
      setTab('legal');
      setError('Add at least one Procurement Category before saving.');
      return;
    }
    setSaving(true);
    setError('');
    const payload = {
      ...form,
      categories: splitList(form.categories), certifications: splitList(form.certifications),
      quality_standards: splitList(form.quality_standards), approved_materials: splitList(form.approved_materials),
      icv_expiry_date: isoDate(form.icv_expiry_date) || null,
      icv_percentage: form.icv_percentage === '' ? null : form.icv_percentage,
      credit_limit: form.credit_limit === '' ? null : form.credit_limit,
      vendor_tenure_years: form.vendor_tenure_years === '' ? null : form.vendor_tenure_years,
      rating: form.rating === '' ? null : form.rating,
      remove_logo: removeLogo,
    };
    try {
      let requestData = payload;
      if (logoFile) {
        requestData = new FormData();
        Object.entries(payload).forEach(([key, value]) => {
          if (value === undefined) return;
          requestData.append(key, value === null ? '' : Array.isArray(value) ? JSON.stringify(value) : String(value));
        });
        requestData.append('logo', logoFile);
      }
      const response = await apiClient.patch(`/procurement/vendors/${supplier.id}/`, requestData);
      await onSaved(response.data);
      onClose();
    } catch (requestError) {
      const details = requestError.response?.data;
      const message = details && typeof details === 'object'
        ? Object.entries(details).map(([key, value]) => `${key.replaceAll('_', ' ')}: ${Array.isArray(value) ? value.join(' ') : value}`).join(' · ')
        : requestError.message;
      setError(message || 'The vendor could not be updated.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[90] flex items-center justify-center bg-slate-950/45 p-4 backdrop-blur-[1px]" role="dialog" aria-modal="true" aria-labelledby="supplier-edit-title">
      <form onSubmit={submit} className="flex max-h-[92vh] w-full max-w-5xl flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl">
        <header className="flex items-start justify-between gap-4 border-b border-slate-200 px-6 py-4">
          <div className="min-w-0"><p className="text-[11px] font-semibold text-blue-700">Vendor master data</p><h2 id="supplier-edit-title" className="mt-0.5 truncate text-xl font-semibold text-slate-950">AI-Powered Vendor Creator</h2><p className="mt-0.5 truncate text-xs text-slate-500">Editing {supplier.vendor_code} · Complete vendor identity, compliance and commercial information</p></div>
          <button type="button" onClick={onClose} disabled={saving} aria-label="Close vendor editor" className="grid h-9 w-9 shrink-0 place-items-center rounded-lg border border-slate-200 text-slate-500 hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"><XMarkIcon className="h-5 w-5" /></button>
        </header>

        <nav className="flex overflow-x-auto border-b border-slate-200 bg-slate-50 px-6" aria-label="Vendor information sections">
          {tabs.map(({ id, label, icon: Icon }) => <button key={id} type="button" onClick={() => setTab(id)} aria-current={tab === id ? 'step' : undefined} className={cx('flex h-12 shrink-0 items-center gap-2 border-b-2 px-4 text-xs font-semibold transition', tab === id ? 'border-blue-600 bg-white text-blue-700' : 'border-transparent text-slate-600 hover:bg-white/70 hover:text-slate-900')}><Icon className="h-4 w-4" />{label}</button>)}
        </nav>

        <div className="min-h-0 flex-1 overflow-y-auto bg-slate-50/60 p-6">
          {error && <div role="alert" className="mb-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>}

          {tab === 'basic' && <div className="space-y-5">
            <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
              <h3 className="flex items-center gap-2 text-base font-semibold text-slate-900"><BuildingOffice2Icon className="h-5 w-5 text-blue-600" />Basic Information</h3><p className="mt-0.5 text-xs text-slate-500">Company identity, business profile and contact information.</p>
              <div className="mt-4 flex flex-col gap-4 rounded-xl border border-slate-200 bg-slate-50 p-4 sm:flex-row sm:items-center">
                <span className="relative grid h-20 w-20 shrink-0 place-items-center overflow-hidden rounded-xl border border-slate-200 bg-white text-xl font-semibold text-slate-500"><span>{initials}</span>{logoPreview && <img src={logoPreview} alt="Vendor logo preview" className="absolute inset-0 h-full w-full bg-white object-contain p-2" onError={(e) => { e.currentTarget.style.display = 'none'; }} />}</span>
                <div className="min-w-0 flex-1"><div className="flex flex-wrap gap-2"><label className="inline-flex h-9 cursor-pointer items-center gap-2 rounded-lg border border-slate-300 bg-white px-3 text-xs font-semibold text-slate-700 shadow-sm hover:bg-slate-50"><ArrowUpTrayIcon className="h-4 w-4" />Upload logo<input type="file" accept="image/png,image/jpeg,image/webp,image/gif" onChange={chooseLogo} className="sr-only" /></label><button type="button" onClick={() => { setLogoFile(null); setLogoPreview(''); setRemoveLogo(true); setValue('logo_url', ''); }} className="h-9 rounded-lg px-3 text-xs font-semibold text-red-600 hover:bg-red-50">Remove</button></div><p className="mt-2 text-[11px] text-slate-500">PNG, JPEG, WebP or GIF · Maximum 2 MB</p></div>
                <Field label="Or paste logo URL" className="w-full sm:max-w-sm"><div className="relative"><PhotoIcon className="pointer-events-none absolute left-3 top-4 h-4 w-4 text-slate-400" /><input type="url" value={form.logo_url} onChange={(e) => { const value = e.target.value; setLogoFile(null); setRemoveLogo(Boolean(value && supplier.logo)); setLogoPreview(value); setValue('logo_url', value); }} className={`${inputClass} pl-9`} placeholder="https://vendor.com/logo.png" /></div></Field>
              </div>
              <div className="mt-5 grid gap-4 md:grid-cols-2"><Field label="Company Name *"><input required value={form.name} onChange={(e) => setValue('name', e.target.value)} className={inputClass} /></Field><Field label="Business Type *"><select required value={form.business_type} onChange={(e) => setValue('business_type', e.target.value)} className={inputClass}><option value="">Select business type</option><option value="manufacturer">Manufacturer</option><option value="distributor">Distributor</option><option value="service_provider">Service Provider</option><option value="contractor">Contractor</option><option value="consultant">Consultant</option></select></Field><Field label="Vendor Code"><input required value={form.vendor_code} onChange={(e) => setValue('vendor_code', e.target.value)} className={inputClass} /></Field><Field label="Specialization"><input value={form.specialization} onChange={(e) => setValue('specialization', e.target.value)} className={inputClass} placeholder="Piping materials, valves, pumps" /></Field><Field label="Status"><select value={form.status} onChange={(e) => setValue('status', e.target.value)} className={inputClass}><option value="active">Active</option><option value="inactive">Inactive</option><option value="blacklisted">Blacklisted</option></select></Field><Field label="Website"><input type="url" value={form.website} onChange={(e) => setValue('website', e.target.value)} className={inputClass} placeholder="https://vendor.com" /></Field><Field label="Country *"><input required value={form.country} onChange={(e) => setValue('country', e.target.value)} className={inputClass} /></Field><Field label="City"><input value={form.city} onChange={(e) => setValue('city', e.target.value)} className={inputClass} /></Field><Field label="Address" className="md:col-span-2"><textarea rows="2" value={form.address} onChange={(e) => setValue('address', e.target.value)} className={textareaClass} /></Field></div>
            </section>
            <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm"><h3 className="text-base font-semibold text-slate-900">Contact Information</h3><div className="mt-4 grid gap-4 md:grid-cols-3"><Field label="Contact Person"><input value={form.contact_person} onChange={(e) => setValue('contact_person', e.target.value)} className={inputClass} /></Field><Field label="Email *"><input required type="email" value={form.email} onChange={(e) => setValue('email', e.target.value)} className={inputClass} /></Field><Field label="Phone *"><input required type="tel" value={form.phone} onChange={(e) => setValue('phone', e.target.value)} className={inputClass} /></Field></div></section>
          </div>}

          {tab === 'legal' && <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm"><h3 className="flex items-center gap-2 text-base font-semibold text-slate-900"><ShieldCheckIcon className="h-5 w-5 text-emerald-600" />Financial &amp; Legal Information</h3><p className="mt-0.5 text-xs text-slate-500">Procurement classification, registrations and compliance evidence.</p><div className="mt-4 grid gap-4 md:grid-cols-3"><Field label="Procurement Categories *" hint="Separate multiple categories with commas." className="md:col-span-3"><input required value={form.categories} onChange={(e) => setValue('categories', e.target.value)} className={inputClass} placeholder="OEM, Valves" /></Field><Field label="Trade License Number"><input value={form.trade_license_number} onChange={(e) => setValue('trade_license_number', e.target.value)} className={inputClass} /></Field><Field label="VAT Registration Number"><input value={form.vat_number} onChange={(e) => setValue('vat_number', e.target.value)} className={inputClass} /></Field><Field label="Tax ID / TRN"><input value={form.tax_id} onChange={(e) => setValue('tax_id', e.target.value)} className={inputClass} /></Field><Field label="Certifications & Compliance" hint="Comma-separated"><input value={form.certifications} onChange={(e) => setValue('certifications', e.target.value)} className={inputClass} /></Field><Field label="Quality Standards" hint="Comma-separated"><input value={form.quality_standards} onChange={(e) => setValue('quality_standards', e.target.value)} className={inputClass} /></Field><Field label="HSE Rating"><input value={form.hse_rating} onChange={(e) => setValue('hse_rating', e.target.value)} className={inputClass} /></Field></div></section>}
          {tab === 'icv' && <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm"><div className="flex flex-wrap items-center justify-between gap-3"><div><h3 className="text-base font-semibold text-slate-900">ICV (In-Country Value) - Abu Dhabi Market</h3><p className="mt-0.5 text-xs text-slate-500">Record only evidence reviewed by procurement.</p></div><label className="flex items-center gap-2 text-xs font-semibold text-slate-700"><input type="checkbox" checked={form.is_icv_certified} onChange={(e) => setValue('is_icv_certified', e.target.checked)} className="h-4 w-4 rounded border-slate-300 text-blue-600" />ICV Certified Vendor</label></div><div className="mt-4 grid gap-4 md:grid-cols-4"><Field label="ICV Percentage"><input type="number" min="0" max="100" step="0.01" value={form.icv_percentage} onChange={(e) => setValue('icv_percentage', e.target.value)} disabled={!form.is_icv_certified} className={inputClass} /></Field><Field label="Certificate Number"><input value={form.icv_certificate} onChange={(e) => setValue('icv_certificate', e.target.value)} disabled={!form.is_icv_certified} className={inputClass} /></Field><Field label="Expiry Date"><input type="date" value={form.icv_expiry_date} onChange={(e) => setValue('icv_expiry_date', e.target.value)} disabled={!form.is_icv_certified} className={inputClass} /></Field><Field label="Issuing Authority"><input value={form.icv_issuing_authority} onChange={(e) => setValue('icv_issuing_authority', e.target.value)} disabled={!form.is_icv_certified} className={inputClass} /></Field></div><label className="mt-5 flex items-start gap-3 rounded-lg border border-slate-200 bg-slate-50 p-3"><input type="checkbox" checked={form.adnoc_approved} onChange={(e) => setValue('adnoc_approved', e.target.checked)} className="mt-0.5 h-4 w-4 rounded border-slate-300 text-blue-600" /><span><span className="block text-xs font-semibold text-slate-800">ADNOC Approved Vendor</span><span className="mt-0.5 block text-[11px] text-slate-500">Check if vendor is approved by ADNOC.</span></span></label></section>}

          {tab === 'payment' && <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm"><h3 className="flex items-center gap-2 text-base font-semibold text-slate-900"><BanknotesIcon className="h-5 w-5 text-amber-600" />Payment Terms</h3><div className="mt-4 grid gap-4 md:grid-cols-3"><Field label="Payment Terms"><input value={form.payment_terms} onChange={(e) => setValue('payment_terms', e.target.value)} className={inputClass} /></Field><Field label="Credit Limit"><input type="number" min="0" step="0.01" value={form.credit_limit} onChange={(e) => setValue('credit_limit', e.target.value)} className={inputClass} /></Field><Field label="Vendor Tenure (Years)"><input type="number" min="0" value={form.vendor_tenure_years} onChange={(e) => setValue('vendor_tenure_years', e.target.value)} className={inputClass} /></Field><Field label="Performance Rating"><select value={form.rating} onChange={(e) => setValue('rating', e.target.value)} className={inputClass}><option value="">Not rated</option><option value="5">Excellent</option><option value="4">Good</option><option value="3">Average</option><option value="2">Below average</option><option value="1">Poor</option></select></Field><Field label="Inspection Authority"><input value={form.inspection_authority} onChange={(e) => setValue('inspection_authority', e.target.value)} className={inputClass} /></Field><Field label="Approved Materials" hint="Comma-separated"><input value={form.approved_materials} onChange={(e) => setValue('approved_materials', e.target.value)} className={inputClass} /></Field><Field label="Performance Notes" className="md:col-span-3"><textarea rows="3" value={form.performance_notes} onChange={(e) => setValue('performance_notes', e.target.value)} className={textareaClass} /></Field><Field label="Internal Procurement Notes" className="md:col-span-3"><textarea rows="3" value={form.notes} onChange={(e) => setValue('notes', e.target.value)} className={textareaClass} /></Field></div></section>}
        </div>

        <footer className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-200 bg-white px-6 py-4"><p className="text-[11px] text-slate-500">Fields marked by governance rules affect procurement eligibility.</p><div className="flex gap-2"><button type="button" onClick={onClose} disabled={saving} className="h-10 rounded-lg border border-slate-300 bg-white px-4 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50">Cancel</button><button type="submit" disabled={saving} className="inline-flex h-10 min-w-36 items-center justify-center gap-2 rounded-lg bg-blue-600 px-5 text-sm font-semibold text-white shadow-sm hover:bg-blue-700 disabled:cursor-wait disabled:opacity-60">{saving ? 'Saving…' : <><CheckIcon className="h-4 w-4" />Save changes</>}</button></div></footer>
      </form>
    </div>
  );
};

SupplierEditModal.propTypes = {
  supplier: PropTypes.object.isRequired,
  onClose: PropTypes.func.isRequired,
  onSaved: PropTypes.func.isRequired,
};

export default SupplierEditModal;
