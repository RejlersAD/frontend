import React, { useCallback, useEffect, useMemo, useState } from 'react';
import PropTypes from 'prop-types';
import {
  ArrowDownTrayIcon,
  ArrowPathIcon,
  ArrowLeftIcon,
  ArrowRightIcon,
  BuildingOffice2Icon,
  CheckCircleIcon,
  ChevronDownIcon,
  ChevronRightIcon,
  ClockIcon,
  DocumentCheckIcon,
  ExclamationTriangleIcon,
  FunnelIcon,
  GlobeAltIcon,
  IdentificationIcon,
  LockClosedIcon,
  MagnifyingGlassIcon,
  PencilSquareIcon,
  PlusIcon,
  ShieldCheckIcon,
  SparklesIcon,
  TrashIcon,
  UserGroupIcon,
  XMarkIcon,
} from '@heroicons/react/24/outline';
import apiClient from '../../services/api.service';
import AIVendorCreator from './AIVendorCreator';
import SupplierEditModal from './SupplierEditModal';

const cx = (...classes) => classes.filter(Boolean).join(' ');
const DAY = 86400000;
const REQUIRED_FIELDS = [
  ['vendor_code', 'Supplier code'], ['name', 'Legal name'], ['contact_person', 'Primary contact'],
  ['email', 'Email'], ['phone', 'Phone'], ['address', 'Address'], ['country', 'Country'],
  ['trade_license_number', 'Trade license'], ['vat_number', 'VAT number'], ['categories', 'Category'],
  ['certifications', 'Certifications'],
];
const hasValue = (value) => Array.isArray(value) ? value.length > 0 : value !== null && value !== undefined && String(value).trim() !== '';
const completeness = (supplier) => {
  const missing = REQUIRED_FIELDS.filter(([key]) => !hasValue(supplier?.[key]));
  return { score: Math.round(((REQUIRED_FIELDS.length - missing.length) / REQUIRED_FIELDS.length) * 100), missing };
};
const daysUntil = (date) => date ? Math.ceil((new Date(date).setHours(23, 59, 59, 999) - Date.now()) / DAY) : null;
const normalize = (value) => String(value || '').toLowerCase().replace(/[^a-z0-9]/g, '');
const initials = (name) => String(name || 'S').split(/\s+/).slice(0, 2).map((word) => word[0]).join('').toUpperCase();
const formatDate = (value, fallback = 'Not recorded') => {
  if (!value) return fallback;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? fallback : date.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
};
const relativeDate = (value) => {
  if (!value) return 'Not recorded';
  const days = Math.max(0, Math.floor((Date.now() - new Date(value).getTime()) / DAY));
  if (days === 0) return 'Today';
  if (days === 1) return '1 day ago';
  return days < 30 ? days + ' days ago' : formatDate(value);
};

const COUNTRY_CODES = {
  'united arab emirates': 'AE', uae: 'AE', ae: 'AE',
  'saudi arabia': 'SA', ksa: 'SA', sa: 'SA', qatar: 'QA', qa: 'QA', oman: 'OM', om: 'OM',
  bahrain: 'BH', bh: 'BH', kuwait: 'KW', kw: 'KW', india: 'IN', in: 'IN',
  germany: 'DE', de: 'DE', france: 'FR', fr: 'FR', italy: 'IT', it: 'IT', spain: 'ES', es: 'ES',
  'united kingdom': 'GB', uk: 'GB', gb: 'GB', england: 'GB',
  'united states': 'US', usa: 'US', us: 'US', canada: 'CA', ca: 'CA',
  china: 'CN', cn: 'CN', japan: 'JP', jp: 'JP', singapore: 'SG', sg: 'SG',
  netherlands: 'NL', nl: 'NL', belgium: 'BE', be: 'BE', sweden: 'SE', se: 'SE',
  norway: 'NO', no: 'NO', finland: 'FI', fi: 'FI', denmark: 'DK', dk: 'DK',
  australia: 'AU', au: 'AU', switzerland: 'CH', ch: 'CH', austria: 'AT', at: 'AT',
};
const countryCode = (country) => {
  const source = String(country || '').trim().toLowerCase();
  return COUNTRY_CODES[source] || COUNTRY_CODES[normalize(source)] || '';
};
const countryFlag = (country) => {
  const code = countryCode(country);
  return code ? String.fromCodePoint(...code.split('').map((character) => 127397 + character.charCodeAt())) : '';
};
const countryName = (country) => {
  const source = String(country || '').trim();
  const code = countryCode(source);
  if (!code) return source;
  if (code === 'AE') return 'UAE';
  try {
    return new Intl.DisplayNames(['en'], { type: 'region' }).of(code) || source;
  } catch {
    return source;
  }
};

const CountryFlag = ({ country }) => {
  const code = countryCode(country);
  if (code === 'AE') {
    return (
      <svg className="h-3.5 w-5 shrink-0 overflow-hidden rounded-[2px] ring-1 ring-slate-300" viewBox="0 0 28 20" role="img" aria-label="United Arab Emirates flag">
        <rect width="28" height="20" fill="#fff" />
        <rect x="0" y="0" width="8" height="20" fill="#ff0000" />
        <rect x="8" y="0" width="20" height="6.667" fill="#00732f" />
        <rect x="8" y="13.333" width="20" height="6.667" fill="#000" />
      </svg>
    );
  }
  if (code) return <span className="country-flag shrink-0 text-sm" aria-hidden="true">{countryFlag(country)}</span>;
  return <GlobeAltIcon className="h-3.5 w-3.5 shrink-0 text-slate-400" aria-hidden="true" />;
};

const SupplierAvatar = ({ supplier, large = false }) => {
  const source = supplier.logo_url || supplier.logo || '';
  return (
    <span className={cx(
      'relative grid shrink-0 place-items-center overflow-hidden border border-slate-200 bg-slate-100 font-semibold text-slate-600',
      large ? 'h-12 w-12 rounded-xl text-sm' : 'h-7 w-7 rounded-md text-[9px]'
    )}>
      <span aria-hidden="true">{initials(supplier.name)}</span>
      {source && <img src={source} alt="" className="absolute inset-0 h-full w-full bg-white object-contain p-0.5" onError={(event) => { event.currentTarget.style.display = 'none'; }} />}
    </span>
  );
};

const governance = (supplier) => {
  const readiness = completeness(supplier);
  const expiryDays = daysUntil(supplier?.icv_expiry_date);
  const expired = expiryDays !== null && expiryDays < 0;
  const expiring = expiryDays !== null && expiryDays >= 0 && expiryDays <= 90;
  const conditions = [];
  if (!supplier?.trade_license_number) conditions.push('Trade license missing');
  if (!supplier?.vat_number) conditions.push('VAT registration missing');
  if (supplier?.is_icv_certified && expired) conditions.push('ICV certificate expired');
  if (!supplier?.is_icv_certified) conditions.push('ICV verification missing');
  if (!supplier?.adnoc_approved) conditions.push('ADNOC approval not recorded');
  let eligibility = 'eligible';
  if (supplier?.status !== 'active' || expired) eligibility = 'not_eligible';
  else if (conditions.length) eligibility = 'conditional';
  const risk = supplier?.status === 'blacklisted' || expired ? 'high'
    : supplier?.status !== 'active' || readiness.score < 60 || conditions.length >= 3 ? 'medium' : 'low';
  return { readiness, expiryDays, expired, expiring, conditions, eligibility, risk };
};

const ToneBadge = ({ tone = 'slate', children }) => {
  const tones = {
    emerald: 'border-emerald-200 bg-emerald-50 text-emerald-700',
    amber: 'border-amber-200 bg-amber-50 text-amber-700',
    red: 'border-red-200 bg-red-50 text-red-700',
    blue: 'border-blue-200 bg-blue-50 text-blue-700',
    slate: 'border-slate-200 bg-slate-50 text-slate-600',
  };
  return <span className={cx('status-badge inline-flex items-center gap-1 rounded-full border px-2 py-0.5', tones[tone])}>{children}</span>;
};

const EligibilityBadge = ({ value, compact = false }) => value === 'eligible'
  ? <ToneBadge tone="emerald"><CheckCircleIcon className="h-3 w-3" />Eligible</ToneBadge>
  : value === 'conditional'
    ? <ToneBadge tone="amber"><ExclamationTriangleIcon className="h-3 w-3" />{compact ? 'Conditional' : 'Eligible with conditions'}</ToneBadge>
    : <ToneBadge tone="red"><XMarkIcon className="h-3 w-3" />{compact ? 'Blocked' : 'Not eligible'}</ToneBadge>;

const Kpi = ({ label, value, icon: Icon, tone, active, onClick }) => (
  <button type="button" onClick={onClick} aria-pressed={active} className={cx('flex min-h-16 items-center gap-2.5 rounded-lg border bg-white px-3 py-2 text-left shadow-sm transition hover:border-blue-300 hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500', active ? 'border-blue-400 ring-1 ring-blue-100' : 'border-slate-200')}>
    <span className={cx('grid h-8 w-8 shrink-0 place-items-center rounded-md', tone)}><Icon className="h-4 w-4" /></span>
    <span><span className="metric-label block">{label}</span><span className="metric-value mt-0.5 block text-slate-950">{value}</span></span>
  </button>
);

ToneBadge.propTypes = {
  tone: PropTypes.oneOf(['emerald', 'amber', 'red', 'blue', 'slate']),
  children: PropTypes.node.isRequired,
};

EligibilityBadge.propTypes = {
  value: PropTypes.oneOf(['eligible', 'conditional', 'not_eligible']).isRequired,
  compact: PropTypes.bool,
};

Kpi.propTypes = {
  label: PropTypes.string.isRequired,
  value: PropTypes.oneOfType([PropTypes.string, PropTypes.number]).isRequired,
  icon: PropTypes.elementType.isRequired,
  tone: PropTypes.string.isRequired,
  active: PropTypes.bool.isRequired,
  onClick: PropTypes.func.isRequired,
};

CountryFlag.propTypes = {
  country: PropTypes.string,
};

SupplierAvatar.propTypes = {
  supplier: PropTypes.shape({
    name: PropTypes.string.isRequired,
    logo: PropTypes.string,
    logo_url: PropTypes.string,
  }).isRequired,
  large: PropTypes.bool,
};

const SupplierManagementWorkspace = () => {
  const [suppliers, setSuppliers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const [filters, setFilters] = useState({ eligibility: 'all', compliance: 'all', category: 'all', country: 'all', readiness: 'all', risk: 'all' });
  const [activeView, setActiveView] = useState('suppliers');
  const [selected, setSelected] = useState(null);
  const [profileTab, setProfileTab] = useState('overview');
  const [checked, setChecked] = useState([]);
  const [page, setPage] = useState(1);
  const [creator, setCreator] = useState({ open: false, edit: false, supplier: null });
  const [enrichment, setEnrichment] = useState(null);
  const [confirmDelete, setConfirmDelete] = useState(null);
  const [actionBusy, setActionBusy] = useState(false);

  const fetchSuppliers = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const response = await apiClient.get('/procurement/vendors/', { params: { page_size: 10000 } });
      const rows = Array.isArray(response.data) ? response.data : response.data?.results || [];
      setSuppliers(rows);
      setSelected((current) => current ? rows.find((item) => item.id === current.id) || null : null);
    } catch (requestError) {
      setError(requestError.response?.data?.detail || requestError.message || 'Supplier directory could not be loaded.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchSuppliers(); }, [fetchSuppliers]);

  const duplicateIds = useMemo(() => {
    const groups = new Map();
    suppliers.forEach((supplier) => {
      [
        ['name', normalize(supplier.name)],
        ['email', normalize(supplier.email)],
        ['license', normalize(supplier.trade_license_number)],
        ['vat', normalize(supplier.vat_number)],
      ].filter(([, value]) => value).forEach(([type, value]) => {
        const key = type + ':' + value;
        groups.set(key, [...(groups.get(key) || []), supplier.id]);
      });
    });
    return new Set([...groups.values()].filter((ids) => ids.length > 1).flat());
  }, [suppliers]);

  const metrics = useMemo(() => {
    const enriched = suppliers.map((supplier) => governance(supplier));
    return {
      total: suppliers.length,
      eligible: enriched.filter((item) => item.eligibility === 'eligible').length,
      review: enriched.filter((item) => item.eligibility !== 'eligible' || item.readiness.score < 75).length,
      expiring: enriched.filter((item) => item.expiring).length,
      completeness: enriched.length ? Math.round(enriched.reduce((sum, item) => sum + item.readiness.score, 0) / enriched.length) : 0,
      highRisk: enriched.filter((item) => item.risk === 'high').length,
    };
  }, [suppliers]);

  const categories = useMemo(() => [...new Set(suppliers.flatMap((supplier) => supplier.categories || []))].sort(), [suppliers]);
  const countries = useMemo(() => [...new Set(suppliers.map((supplier) => supplier.country).filter(Boolean))].sort(), [suppliers]);
  const displayed = useMemo(() => suppliers.filter((supplier) => {
    const state = governance(supplier);
    const haystack = [supplier.name, supplier.vendor_code, supplier.email, supplier.country, supplier.contact_person, ...(supplier.categories || [])].join(' ').toLowerCase();
    if (search && !haystack.includes(search.toLowerCase())) return false;
    if (activeView === 'compliance' && !state.conditions.length) return false;
    if (activeView === 'duplicates' && !duplicateIds.has(supplier.id)) return false;
    if (filters.eligibility !== 'all' && state.eligibility !== filters.eligibility) return false;
    if (filters.compliance === 'expiring' && !state.expiring) return false;
    if (filters.compliance === 'expired' && !state.expired) return false;
    if (filters.compliance === 'missing' && !state.conditions.length) return false;
    if (filters.category !== 'all' && !(supplier.categories || []).includes(filters.category)) return false;
    if (filters.country !== 'all' && supplier.country !== filters.country) return false;
    if (filters.readiness === 'complete' && state.readiness.score < 85) return false;
    if (filters.readiness === 'incomplete' && state.readiness.score >= 85) return false;
    if (filters.risk !== 'all' && state.risk !== filters.risk) return false;
    return true;
  }), [activeView, duplicateIds, filters, search, suppliers]);

  const pageSize = 10;
  const pageCount = Math.max(1, Math.ceil(displayed.length / pageSize));
  const currentPage = Math.min(page, pageCount);
  const pagedSuppliers = displayed.slice((currentPage - 1) * pageSize, currentPage * pageSize);

  useEffect(() => { setPage(1); }, [activeView, filters, search]);

  const exportSuppliers = () => {
    const header = ['Supplier code', 'Legal name', 'Country', 'Contact', 'Email', 'Completeness', 'Eligibility', 'Risk'];
    const rows = displayed.map((supplier) => {
      const state = governance(supplier);
      return [supplier.vendor_code, supplier.name, supplier.country, supplier.contact_person, supplier.email, state.readiness.score + '%', state.eligibility, state.risk];
    });
    const csv = [header, ...rows].map((row) => row.map((cell) => '"' + String(cell || '').replaceAll('"', '""') + '"').join(',')).join('\n');
    const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
    const link = document.createElement('a');
    link.href = url;
    link.download = 'Supplier_Directory_' + new Date().toISOString().slice(0, 10) + '.csv';
    link.click();
    URL.revokeObjectURL(url);
  };

  const deleteSupplier = async () => {
    if (!confirmDelete) return;
    setActionBusy(true);
    try {
      await apiClient.delete('/procurement/vendors/' + confirmDelete.id + '/');
      setConfirmDelete(null);
      await fetchSuppliers();
    } catch (requestError) {
      setError(requestError.response?.data?.detail || 'Supplier could not be deleted.');
    } finally {
      setActionBusy(false);
    }
  };

  const selectedState = selected ? governance(selected) : null;
  const viewTabs = [
    ['suppliers', 'Suppliers', metrics.total],
    ['compliance', 'Compliance reviews', metrics.review],
    ['duplicates', 'Duplicates', duplicateIds.size],
    ['categories', 'Categories', categories.length],
  ];

  return (
    <div className="supplier-workspace min-h-screen bg-slate-50 text-slate-900">
      <div className="mx-auto w-full max-w-[1800px] px-3 py-3 sm:px-4">
        <header className="flex flex-col gap-3 border-b border-slate-200 pb-3 lg:flex-row lg:items-center lg:justify-between">
          <h1 className="page-title text-slate-950">Supplier management</h1>
          <div className="flex flex-wrap items-center gap-2">
            <button type="button" onClick={fetchSuppliers} className="inline-flex h-10 items-center gap-2 rounded-lg border border-slate-300 bg-white px-3 text-sm font-semibold text-slate-700 shadow-sm hover:bg-slate-50"><ArrowPathIcon className={cx('h-4 w-4', loading && 'animate-spin')} />Refresh</button>
            <button type="button" onClick={exportSuppliers} className="inline-flex h-10 items-center gap-2 rounded-lg border border-slate-300 bg-white px-3 text-sm font-semibold text-slate-700 shadow-sm hover:bg-slate-50"><ArrowDownTrayIcon className="h-4 w-4" />Export</button>
            <button type="button" onClick={() => setEnrichment(selected || true)} className="inline-flex h-10 items-center gap-2 rounded-lg border border-slate-300 bg-white px-3 text-sm font-semibold text-slate-700 shadow-sm hover:bg-slate-50"><SparklesIcon className="h-4 w-4" />Review enrichment</button>
            <button type="button" onClick={() => setCreator({ open: true, edit: false, supplier: null })} className="inline-flex h-10 items-center gap-2 rounded-lg bg-red-600 px-4 text-sm font-semibold text-white shadow-sm hover:bg-red-700"><PlusIcon className="h-4 w-4" />Add supplier</button>
          </div>
        </header>

        <nav className="supplier-view-tabs flex gap-5 overflow-x-auto border-b border-slate-200" aria-label="Supplier workspace views">
          {viewTabs.map(([key, label, count]) => <button key={key} type="button" onClick={() => setActiveView(key)} className={cx('flex h-10 shrink-0 items-center gap-1.5 border-b-2 px-1 text-xs font-semibold', activeView === key ? 'border-blue-600 text-blue-700' : 'border-transparent text-slate-500 hover:text-slate-800')}>{label}<span className="rounded-full bg-slate-100 px-1.5 py-0.5 text-[10px] text-slate-600">{count}</span></button>)}
        </nav>

        <section className="mt-2.5 grid gap-2.5 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-6" aria-label="Supplier governance metrics">
          <Kpi label="Total suppliers" value={metrics.total} icon={UserGroupIcon} tone="bg-blue-50 text-blue-600" active={activeView === 'suppliers'} onClick={() => setActiveView('suppliers')} />
          <Kpi label="Eligible for procurement" value={metrics.eligible} icon={CheckCircleIcon} tone="bg-emerald-50 text-emerald-600" active={filters.eligibility === 'eligible'} onClick={() => setFilters((value) => ({ ...value, eligibility: value.eligibility === 'eligible' ? 'all' : 'eligible' }))} />
          <Kpi label="Needs review" value={metrics.review} icon={ExclamationTriangleIcon} tone="bg-amber-50 text-amber-600" active={activeView === 'compliance'} onClick={() => setActiveView('compliance')} />
          <Kpi label="Compliance expiring" value={metrics.expiring} icon={ClockIcon} tone="bg-red-50 text-red-600" active={filters.compliance === 'expiring'} onClick={() => setFilters((value) => ({ ...value, compliance: value.compliance === 'expiring' ? 'all' : 'expiring' }))} />
          <Kpi label="Data completeness (avg)" value={metrics.completeness + '%'} icon={DocumentCheckIcon} tone="bg-sky-50 text-sky-600" active={false} onClick={() => setFilters((value) => ({ ...value, readiness: 'incomplete' }))} />
          <Kpi label="High-risk suppliers" value={metrics.highRisk} icon={ShieldCheckIcon} tone="bg-rose-50 text-rose-600" active={filters.risk === 'high'} onClick={() => setFilters((value) => ({ ...value, risk: value.risk === 'high' ? 'all' : 'high' }))} />
        </section>

        {error && <div className="mt-3 flex items-center justify-between rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-800"><span>{error}</span><button type="button" onClick={() => setError('')} aria-label="Dismiss error"><XMarkIcon className="h-5 w-5" /></button></div>}

        <div className="mt-2.5 grid gap-2.5 xl:grid-cols-[minmax(0,2fr)_minmax(340px,1fr)]">
          <section className="min-w-0 overflow-hidden rounded-lg border border-slate-300 bg-white shadow-sm" aria-labelledby="directory-heading">
            <div className="border-b border-slate-300 px-3 py-2.5">
              <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                <div><h2 id="directory-heading" className="section-title">Supplier directory ({displayed.length})</h2><p className="metadata">Verified master data and explainable eligibility.</p></div>
                <div className="relative w-full lg:max-w-xl"><MagnifyingGlassIcon className="pointer-events-none absolute left-3 top-2.5 h-4 w-4 text-slate-400" /><input value={search} onChange={(event) => setSearch(event.target.value)} className="supplier-search h-9 w-full rounded-lg border border-slate-300 bg-slate-50 pl-9 pr-3 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100" placeholder="Search supplier, code, email, country, category or contact…" /></div>
              </div>
              <div className="mt-2 flex gap-1.5 overflow-x-auto pb-0.5">
                {[
                  ['eligibility', [['all', 'Eligibility'], ['eligible', 'Eligible'], ['conditional', 'Conditional'], ['not_eligible', 'Not eligible']]],
                  ['compliance', [['all', 'Compliance'], ['expiring', 'Expiring'], ['expired', 'Expired'], ['missing', 'Missing data']]],
                  ['category', [['all', 'Category'], ...categories.map((value) => [value, value])]],
                  ['country', [['all', 'Country'], ...countries.map((value) => [value, value])]],
                  ['readiness', [['all', 'Data readiness'], ['complete', 'Complete 85%+'], ['incomplete', 'Incomplete']]],
                  ['risk', [['all', 'Risk'], ['low', 'Low risk'], ['medium', 'Medium risk'], ['high', 'High risk']]],
                ].map(([key, options]) => <label key={key} className="relative shrink-0"><span className="sr-only">{key}</span><select value={filters[key]} onChange={(event) => setFilters((value) => ({ ...value, [key]: event.target.value }))} className="h-7 appearance-none rounded-md border border-slate-300 bg-white pl-2.5 pr-6 text-[11px] font-medium text-slate-600 outline-none focus:border-blue-500">{options.map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select><ChevronDownIcon className="pointer-events-none absolute right-1.5 top-1.5 h-3.5 w-3.5 text-slate-400" /></label>)}
                <button type="button" onClick={() => { setFilters({ eligibility: 'all', compliance: 'all', category: 'all', country: 'all', readiness: 'all', risk: 'all' }); setSearch(''); setActiveView('suppliers'); }} className="h-8 shrink-0 rounded-lg px-3 text-[11px] font-semibold text-blue-700 hover:bg-blue-50">Clear filters</button>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="supplier-directory-table w-full text-left">
                <thead className="table-header"><tr className="supplier-directory-grid">
                  <th className="supplier-selection-column px-2 text-center"><input type="checkbox" aria-label="Select all suppliers on this page" checked={pagedSuppliers.length > 0 && pagedSuppliers.every((item) => checked.includes(item.id))} onChange={(event) => setChecked((items) => event.target.checked ? [...new Set([...items, ...pagedSuppliers.map((item) => item.id)])] : items.filter((id) => !pagedSuppliers.some((item) => item.id === id)))} /></th>
                  <th className="supplier-name-column px-2">Supplier</th><th className="px-2">Code</th><th className="px-2">Category</th><th className="px-2">Country</th><th className="numeric px-2">Data completeness</th><th className="px-2">Compliance</th><th className="px-2">Performance</th><th className="px-2">Eligibility</th><th className="px-2">Updated</th>
                </tr></thead>
                <tbody className="table-cell">
                  {loading ? <tr className="supplier-directory-grid supplier-grid-state"><td className="h-56 text-center text-slate-500"><ArrowPathIcon className="mx-auto h-6 w-6 animate-spin" /><p className="mt-2">Loading supplier governance data…</p></td></tr>
                    : displayed.length === 0 ? <tr className="supplier-directory-grid supplier-grid-state"><td className="h-56 text-center text-slate-500"><FunnelIcon className="mx-auto h-7 w-7" /><p className="mt-2 font-semibold">No suppliers match this view</p><button type="button" onClick={() => { setSearch(''); setActiveView('suppliers'); }} className="mt-2 text-blue-700 underline">Reset view</button></td></tr>
                    : pagedSuppliers.map((supplier) => {
                      const state = governance(supplier);
                      const isSelected = selected?.id === supplier.id;
                      const readinessTone = state.readiness.score >= 85 ? 'bg-emerald-500' : state.readiness.score >= 65 ? 'bg-amber-500' : 'bg-red-500';
                      const complianceItems = [
                        supplier.trade_license_number ? 'Trade license ✓' : 'Trade license missing',
                        supplier.vat_number ? 'VAT ✓' : 'VAT missing',
                        supplier.is_icv_certified ? 'ICV ✓' : 'ICV missing',
                      ];
                      return <tr key={supplier.id} onClick={() => { setSelected(supplier); setProfileTab('overview'); }} className={cx('supplier-directory-grid cursor-pointer', isSelected && 'supplier-row-selected')}>
                        <td className="supplier-selection-column px-2 text-center" onClick={(event) => event.stopPropagation()}><input type="checkbox" aria-label={'Select ' + supplier.name} checked={checked.includes(supplier.id)} onChange={(event) => setChecked((items) => event.target.checked ? [...items, supplier.id] : items.filter((id) => id !== supplier.id))} /></td>
                        <td className="supplier-name-column min-w-0 px-2"><div className="flex min-w-0 items-center gap-2"><SupplierAvatar supplier={supplier} /><p className="truncate font-semibold text-slate-900" title={supplier.name}>{supplier.name}</p></div></td>
                        <td className="truncate px-2 text-slate-600" title={supplier.vendor_code}>{supplier.vendor_code}</td>
                        <td className="truncate px-2 text-slate-600" title={supplier.categories?.join(', ') || 'Unclassified'}>{supplier.categories?.[0] || 'Unclassified'}</td>
                        <td className="min-w-0 px-2 text-slate-600"><span className="flex items-center gap-1.5"><CountryFlag country={supplier.country} /><span className="truncate" title={countryName(supplier.country) || 'Country missing'}>{countryName(supplier.country) || '—'}</span></span></td>
                        <td className="numeric px-2"><div className="flex items-center justify-end gap-2"><span className="font-semibold tabular-nums">{state.readiness.score}%</span><span className="h-1.5 w-14 overflow-hidden rounded-full bg-slate-200" role="progressbar" aria-label={supplier.name + ' data completeness'} aria-valuenow={state.readiness.score} aria-valuemin="0" aria-valuemax="100"><span className={cx('block h-full rounded-full', readinessTone)} style={{ width: state.readiness.score + '%' }} /></span></div></td>
                        <td className="px-2"><div className="flex flex-wrap gap-1">{complianceItems.slice(0, 2).map((item) => <ToneBadge key={item} tone={item.includes('missing') ? 'red' : 'emerald'}>{item}</ToneBadge>)}</div></td>
                        <td className="px-2"><ToneBadge tone={supplier.rating >= 4 ? 'emerald' : supplier.rating === 3 ? 'slate' : supplier.rating ? 'amber' : 'slate'}>{supplier.rating_display || (supplier.rating ? supplier.rating + '/5' : 'Unrated')}</ToneBadge></td>
                        <td className="px-2"><EligibilityBadge value={state.eligibility} compact /></td>
                        <td className="px-2 text-slate-500"><span className="tabular-nums">{relativeDate(supplier.updated_at)}</span></td>
                      </tr>;
                    })}
                </tbody>
              </table>
            </div>
            <div className="supplier-directory-footer flex flex-wrap items-center justify-between gap-3 border-t border-slate-200 px-4 py-3 text-slate-500">
              <span>{displayed.length ? 'Showing ' + ((currentPage - 1) * pageSize + 1) + '–' + Math.min(currentPage * pageSize, displayed.length) + ' of ' + displayed.length : 'No suppliers'}{checked.length ? ' · ' + checked.length + ' selected' : ''}</span>
              <div className="flex items-center gap-2"><span>10 rows per page</span><button type="button" onClick={() => setPage((value) => Math.max(1, value - 1))} disabled={currentPage === 1} aria-label="Previous supplier page" className="grid h-8 w-8 place-items-center rounded-lg border border-slate-300 bg-white disabled:opacity-40"><ArrowLeftIcon className="h-4 w-4" /></button><span className="min-w-14 text-center font-semibold text-slate-700">{currentPage} / {pageCount}</span><button type="button" onClick={() => setPage((value) => Math.min(pageCount, value + 1))} disabled={currentPage === pageCount} aria-label="Next supplier page" className="grid h-8 w-8 place-items-center rounded-lg border border-slate-300 bg-white disabled:opacity-40"><ArrowRightIcon className="h-4 w-4" /></button></div>
            </div>
          </section>

          <aside className="supplier-profile-panel overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm xl:sticky xl:top-4 xl:self-start" aria-label="Contextual supplier profile">
            {!selected ? <div className="grid min-h-[560px] place-items-center p-8 text-center text-slate-500"><div><BuildingOffice2Icon className="mx-auto h-9 w-9" /><p className="mt-3 text-sm font-semibold">Select a supplier</p><p className="mt-1 text-xs">Review identity, evidence and procurement eligibility.</p></div></div> : <>
              <div className="border-b border-slate-200 p-4">
                <div className="flex items-start justify-between gap-3"><div className="flex min-w-0 items-center gap-3"><SupplierAvatar supplier={selected} large /><div className="min-w-0"><h2 className="truncate text-sm font-bold">{selected.name}</h2><div className="mt-1 flex flex-wrap gap-1.5"><ToneBadge tone={selected.status === 'active' ? 'emerald' : selected.status === 'blacklisted' ? 'red' : 'amber'}>{selected.status_display || selected.status}</ToneBadge><EligibilityBadge value={selectedState.eligibility} /></div></div></div><button type="button" onClick={() => setSelected(null)} className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100" aria-label="Close supplier profile"><XMarkIcon className="h-5 w-5" /></button></div>
                <p className="mt-3 text-[10px] font-semibold uppercase tracking-wide text-slate-400">{selected.vendor_code}</p>
              </div>
              <div className="flex overflow-x-auto border-b border-slate-200 px-2">{['overview', 'compliance', 'contacts', 'performance', 'activity'].map((tab) => <button key={tab} type="button" onClick={() => setProfileTab(tab)} className={cx('h-10 shrink-0 border-b-2 px-2.5 text-[10px] font-semibold capitalize', profileTab === tab ? 'border-blue-600 text-blue-700' : 'border-transparent text-slate-500')}>{tab}</button>)}</div>
              <div className="max-h-[680px] overflow-y-auto p-4">
                {profileTab === 'overview' && <div className="space-y-3">
                  <section><h3 className="text-xs font-bold">Basic information</h3><dl className="mt-3 grid grid-cols-[110px_1fr] gap-x-3 gap-y-2 text-[11px]"><dt className="text-slate-500">Legal name</dt><dd className="font-medium">{selected.name}</dd><dt className="text-slate-500">Supplier code</dt><dd>{selected.vendor_code}</dd><dt className="text-slate-500">Country</dt><dd>{selected.country || 'Not recorded'}</dd><dt className="text-slate-500">Category</dt><dd>{selected.categories?.join(', ') || 'Unclassified'}</dd><dt className="text-slate-500">Primary contact</dt><dd>{selected.contact_person || 'Not recorded'}</dd><dt className="text-slate-500">Owner</dt><dd>{selected.created_by_name || 'Procurement master data'}</dd><dt className="text-slate-500">Last reviewed</dt><dd>{formatDate(selected.updated_at)}</dd></dl></section>
                  <div className="supplier-governance-summary grid gap-3 sm:grid-cols-2 xl:grid-cols-1 2xl:grid-cols-2">
                    <section className="rounded-lg border border-slate-200 p-3"><div className="flex items-center justify-between"><h3 className="text-[11px] font-bold">Data readiness</h3><strong className="text-xs">{selectedState.readiness.score}%</strong></div><div className="mt-2 h-1.5 overflow-hidden rounded-full bg-slate-100"><div className="h-full rounded-full bg-blue-600" style={{ width: selectedState.readiness.score + '%' }} /></div><div className="mt-3 space-y-1.5">{selectedState.readiness.missing.slice(0, 4).map(([, label]) => <p key={label} className="flex items-center gap-1.5 text-[10px] text-red-600"><XMarkIcon className="h-3 w-3" />{label} missing</p>)}{!selectedState.readiness.missing.length && <p className="text-[10px] text-emerald-700">All tracked fields complete</p>}</div></section>
                    <section className="rounded-lg border border-slate-200 p-3"><h3 className="text-[11px] font-bold">Procurement eligibility</h3><div className="mt-2"><EligibilityBadge value={selectedState.eligibility} /></div><p className="mt-2 text-[10px] leading-4 text-slate-500">{selectedState.eligibility === 'eligible' ? 'No blocking governance conditions detected.' : selectedState.conditions[0] || 'Supplier status prevents purchasing.'}</p><p className="mt-2 text-[10px]"><strong>Risk:</strong> <span className="capitalize">{selectedState.risk}</span></p></section>
                  </div>
                </div>}
                {profileTab === 'compliance' && <div className="space-y-3">
                  <section className="rounded-lg border border-slate-200 p-3"><h3 className="flex items-center gap-2 text-xs font-bold"><IdentificationIcon className="h-4 w-4 text-blue-600" />ICV verification evidence</h3><dl className="mt-3 grid grid-cols-2 gap-3 text-[10px]"><div><dt className="text-slate-500">Status</dt><dd className="mt-1 font-semibold">{selected.is_icv_certified ? 'Verified' : 'Not verified'}</dd></div><div><dt className="text-slate-500">ICV value</dt><dd className="mt-1 font-semibold">{selected.icv_percentage ? selected.icv_percentage + '%' : 'Not recorded'}</dd></div><div><dt className="text-slate-500">Certificate</dt><dd className="mt-1 font-semibold">{selected.icv_certificate || 'Missing'}</dd></div><div><dt className="text-slate-500">Expiry</dt><dd className="mt-1 font-semibold">{formatDate(selected.icv_expiry_date, 'Missing')}</dd></div><div className="col-span-2"><dt className="text-slate-500">Issuing authority</dt><dd className="mt-1 font-semibold">{selected.icv_issuing_authority || 'Not recorded'}</dd></div></dl></section>
                  <section className="rounded-lg border border-slate-200 p-3"><h3 className="flex items-center gap-2 text-xs font-bold"><ShieldCheckIcon className="h-4 w-4 text-blue-600" />ADNOC verification</h3><p className="mt-2 text-[11px]">{selected.adnoc_approved ? 'Approved in supplier master' : 'Approval evidence not recorded'}</p><p className="mt-1 text-[10px] text-slate-500">{selected.attachments?.length ? selected.attachments.length + ' supplier attachments available for human review.' : 'No supporting attachment is linked.'}</p></section>
                  <section className="rounded-lg border border-amber-200 bg-amber-50 p-3"><h3 className="flex items-center gap-2 text-xs font-bold text-amber-900"><LockClosedIcon className="h-4 w-4" />Bank verification · Restricted</h3><p className="mt-2 text-[10px] leading-4 text-amber-800">Bank-account information is not exposed in this workspace. Finance authorization and an auditable verification workflow are required.</p></section>
                </div>}
                {profileTab === 'contacts' && <dl className="space-y-3 text-[11px]"><div><dt className="text-slate-500">Primary contact</dt><dd className="mt-1 font-semibold">{selected.contact_person || 'Not recorded'}</dd></div><div><dt className="text-slate-500">Email</dt><dd className="mt-1 break-all">{selected.email ? <a className="text-blue-700 underline underline-offset-2" href={'mailto:' + selected.email}>{selected.email}</a> : 'Not recorded'}</dd></div><div><dt className="text-slate-500">Phone</dt><dd className="mt-1">{selected.phone || 'Not recorded'}</dd></div><div><dt className="text-slate-500">Address</dt><dd className="mt-1">{selected.address || 'Not recorded'}</dd></div></dl>}
                {profileTab === 'performance' && <div className="space-y-3 text-[11px]"><section className="rounded-lg border border-slate-200 p-3"><p className="text-slate-500">Current rating</p><p className="mt-1 text-lg font-bold">{selected.rating ? selected.rating + ' / 5' : 'Not rated'}</p><p className="mt-2 leading-5 text-slate-600">{selected.performance_notes || 'No reviewed performance notes are recorded.'}</p></section><section className="rounded-lg border border-slate-200 p-3"><p className="text-slate-500">HSE audit</p><p className="mt-1 font-semibold">{selected.audit_status || 'Not recorded'}</p><p className="mt-1 text-slate-500">Last audit: {formatDate(selected.last_audit_date)}</p></section></div>}
                {profileTab === 'activity' && <div className="space-y-4"><h3 className="text-xs font-bold">Supplier audit history</h3>{[{ label: 'Supplier record updated', at: selected.updated_at, by: 'Master data workflow' }, { label: 'Supplier record created', at: selected.created_at, by: selected.created_by_name || 'Procurement user' }].filter((item) => item.at).map((item) => <div key={item.label} className="flex gap-3"><span className="mt-1 h-2 w-2 shrink-0 rounded-full bg-blue-600" /><div><p className="text-[11px] font-semibold">{item.label}</p><p className="text-[10px] text-slate-500">{formatDate(item.at)} · {item.by}</p></div></div>)}<p className="rounded-lg bg-slate-50 p-3 text-[10px] leading-4 text-slate-500">This history contains every supplier-master event exposed by the current API. Field-level change logging requires the governed audit-ledger service.</p></div>}
              </div>
              <div className="grid grid-cols-3 gap-2 border-t border-slate-200 p-3">
                <button type="button" onClick={() => setCreator({ open: true, edit: true, supplier: selected })} className="inline-flex h-9 items-center justify-center gap-1 rounded-lg bg-blue-600 text-[11px] font-semibold text-white hover:bg-blue-700"><PencilSquareIcon className="h-4 w-4" />Edit</button>
                <button type="button" onClick={() => setEnrichment(selected)} className="inline-flex h-9 items-center justify-center gap-1 rounded-lg border border-slate-300 text-[11px] font-semibold hover:bg-slate-50"><SparklesIcon className="h-4 w-4" />Enrich</button>
                <button type="button" onClick={() => setConfirmDelete(selected)} className="inline-flex h-9 items-center justify-center gap-1 rounded-lg border border-red-200 text-[11px] font-semibold text-red-700 hover:bg-red-50"><TrashIcon className="h-4 w-4" />Delete</button>
              </div>
            </>}
          </aside>
        </div>

        <section className="supplier-insights mt-3 grid gap-3 lg:grid-cols-3">
          <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm"><div className="flex items-center justify-between"><h2 className="text-xs font-bold">Compliance expiries (next 90 days)</h2><button type="button" onClick={() => setFilters((value) => ({ ...value, compliance: 'expiring' }))} className="text-[10px] font-semibold text-blue-700">View all →</button></div><div className="mt-4 flex items-center gap-3"><span className="text-2xl font-bold text-red-600">{metrics.expiring}</span><span className="text-[11px] text-slate-500">ICV certificates expiring</span></div><p className="mt-3 text-[10px] text-slate-400">Trade-license expiry is not stored by the current supplier-master schema.</p></div>
          <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm"><div className="flex items-center justify-between"><h2 className="text-xs font-bold">Suppliers by category</h2><button type="button" onClick={() => setActiveView('categories')} className="text-[10px] font-semibold text-blue-700">View all →</button></div><div className="mt-3 space-y-2">{categories.slice(0, 4).map((category) => { const count = suppliers.filter((item) => item.categories?.includes(category)).length; return <div key={category} className="grid grid-cols-[100px_1fr_28px] items-center gap-2 text-[10px]"><span className="truncate">{category}</span><span className="h-1.5 overflow-hidden rounded-full bg-slate-100"><span className="block h-full rounded-full bg-blue-500" style={{ width: (suppliers.length ? count / suppliers.length * 100 : 0) + '%' }} /></span><strong>{count}</strong></div>; })}{!categories.length && <p className="text-[11px] text-slate-500">No categories recorded.</p>}</div></div>
          <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm"><div className="flex items-center justify-between"><h2 className="text-xs font-bold">Recent changes &amp; duplicate reviews</h2><ClockIcon className="h-4 w-4 text-blue-600" /></div><div className="mt-3 space-y-3">{[...suppliers].sort((a, b) => new Date(b.updated_at) - new Date(a.updated_at)).slice(0, 3).map((supplier) => <button key={supplier.id} type="button" onClick={() => setSelected(supplier)} className="flex w-full items-start justify-between gap-3 text-left"><span><span className="block truncate text-[10px] font-semibold">{duplicateIds.has(supplier.id) ? 'Possible duplicate detected' : 'Supplier master updated'}</span><span className="block truncate text-[9px] text-blue-700">{supplier.name}</span></span><span className="shrink-0 text-[9px] text-slate-400">{relativeDate(supplier.updated_at)}</span></button>)}</div></div>
        </section>
      </div>

      {enrichment && <><button type="button" className="fixed inset-0 z-[70] bg-slate-950/35" aria-label="Close enrichment review" onClick={() => setEnrichment(null)} /><aside className="fixed inset-y-0 right-0 z-[80] flex w-full max-w-lg flex-col bg-white shadow-2xl" role="dialog" aria-modal="true" aria-labelledby="enrichment-title"><div className="border-b border-slate-200 p-5"><div className="flex items-start justify-between"><div><p className="text-[10px] font-bold uppercase tracking-widest text-blue-600">Human review required</p><h2 id="enrichment-title" className="mt-1 text-lg font-bold">Data-enrichment suggestions</h2><p className="mt-1 text-xs text-slate-500">No supplier data is changed automatically.</p></div><button type="button" onClick={() => setEnrichment(null)}><XMarkIcon className="h-5 w-5 text-slate-400" /></button></div></div><div className="flex-1 overflow-y-auto bg-slate-50 p-5">{(enrichment === true ? suppliers.filter((item) => completeness(item).score < 85) : [enrichment]).map((supplier) => <button key={supplier.id} type="button" onClick={() => setEnrichment(supplier)} className="mb-3 w-full rounded-xl border border-slate-200 bg-white p-4 text-left shadow-sm"><div className="flex justify-between gap-3"><div><p className="text-sm font-bold">{supplier.name}</p><p className="mt-1 text-[10px] text-slate-500">{completeness(supplier).missing.length} missing tracked fields</p></div><strong className="text-sm text-amber-600">{completeness(supplier).score}%</strong></div>{enrichment !== true && <div className="mt-3 space-y-2">{completeness(supplier).missing.map(([, label]) => <div key={label} className="flex items-center justify-between rounded-lg bg-slate-50 px-3 py-2 text-[10px]"><span>{label}</span><span className="text-slate-400">Awaiting verified evidence</span></div>)}</div>}</button>)}</div><div className="border-t border-slate-200 p-4"><button type="button" disabled className="h-10 w-full rounded-lg bg-slate-200 text-xs font-semibold text-slate-500">Apply reviewed suggestions</button><p className="mt-2 text-center text-[9px] text-slate-400">Enabled only when a trusted source and reviewer decision are recorded.</p></div></aside></>}

      {confirmDelete && <div className="fixed inset-0 z-[90] grid place-items-center bg-slate-950/40 p-4" role="dialog" aria-modal="true"><div className="w-full max-w-md rounded-xl bg-white p-5 shadow-2xl"><h2 className="text-base font-bold">Delete supplier?</h2><p className="mt-2 text-sm text-slate-600">This permanently deletes <strong>{confirmDelete.name}</strong>. Existing procurement references may prevent deletion.</p><div className="mt-5 flex justify-end gap-2"><button type="button" disabled={actionBusy} onClick={() => setConfirmDelete(null)} className="h-9 rounded-lg border border-slate-300 px-4 text-xs font-semibold">Cancel</button><button type="button" disabled={actionBusy} onClick={deleteSupplier} className="h-9 rounded-lg bg-red-600 px-4 text-xs font-semibold text-white">{actionBusy ? 'Deleting…' : 'Delete supplier'}</button></div></div></div>}

      {creator.open && creator.edit && creator.supplier
        ? <SupplierEditModal supplier={creator.supplier} onClose={() => setCreator({ open: false, edit: false, supplier: null })} onSaved={async (updated) => { setSelected(updated); await fetchSuppliers(); }} />
        : <AIVendorCreator isOpen={creator.open} onClose={() => setCreator({ open: false, edit: false, supplier: null })} onVendorCreated={async () => { setCreator({ open: false, edit: false, supplier: null }); await fetchSuppliers(); }} editMode={false} vendorData={null} />}
    </div>
  );
};

export default SupplierManagementWorkspace;
