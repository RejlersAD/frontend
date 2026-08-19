import React, { useState, useRef, useCallback } from 'react';
import {
  XMarkIcon, SparklesIcon, CloudArrowUpIcon, DocumentTextIcon,
  CheckCircleIcon, ExclamationTriangleIcon, ArrowLeftIcon,
  PlusIcon, TrashIcon, CurrencyDollarIcon, ShieldCheckIcon,
  CalendarIcon, ArrowPathIcon, BuildingOfficeIcon, ClipboardDocumentListIcon,
} from '@heroicons/react/24/outline';
import apiClient from '../../services/api.service';

const EXTRACTION_STAGES = [
  { id: 'upload',   label: 'Uploading to secure storage...',   pct: 20  },
  { id: 'parse',    label: 'Extracting document content...',   pct: 40  },
  { id: 'ai',       label: 'AI analysing procurement data...', pct: 70  },
  { id: 'mapping',  label: 'Mapping fields to PO form...',     pct: 90  },
  { id: 'done',     label: 'Extraction complete!',             pct: 100 },
];

const DELIVERY_TERMS = [
  { value: 'exw',                label: 'EXW - Ex Works' },
  { value: 'fob',                label: 'FOB - Free on Board' },
  { value: 'cif',                label: 'CIF - Cost, Insurance & Freight' },
  { value: 'dap',                label: 'DAP - Delivered at Place' },
  { value: 'ddp',                label: 'DDP - Delivered Duty Paid' },
  { value: 'services_completed', label: 'Services Completed and Accepted' },
];

const CURRENCY_OPTIONS = ['USD', 'AED', 'EUR', 'GBP', 'SAR', 'QAR', 'KWD'];

const CATEGORY_OPTIONS = [
  { value: 'engineering_services', label: 'Engineering & Consulting' },
  { value: 'maintenance_services', label: 'Maintenance & Repair Services' },
  { value: 'rotating_equipment',   label: 'Rotating Equipment' },
  { value: 'static_equipment',     label: 'Static Equipment' },
  { value: 'piping_materials',     label: 'Piping & Pipeline Materials' },
  { value: 'valves_fittings',      label: 'Valves & Fittings' },
  { value: 'instrumentation',      label: 'Instrumentation & Control' },
  { value: 'electrical_materials', label: 'Electrical Materials' },
  { value: 'safety_equipment',     label: 'Safety & PPE' },
  { value: 'chemicals',            label: 'Chemicals & Additives' },
  { value: 'spare_parts',          label: 'Spare Parts & Components' },
  { value: 'inspection_testing',   label: 'Inspection & Testing' },
  { value: 'other',                label: 'Other' },
];

const emptyForm = () => ({
  // Identification
  po_number: '', pr_reference: '', pr_requester_name: '',
  
  // Project linkage (soft-coded FK relationship)
  project: '',  // UUID FK to Project model
  project_number: '', project_manager: '', budget: '',
  
  // Vendor
  vendor: '', vendor_name_hint: '',
  
  // Description
  title: '', description: '',
  category: 'engineering_services',
  
  // Financial
  currency: 'USD', total_amount: '', tax_amount: '', discount_amount: '',
  
  // Dates
  po_date: '', start_date: '', end_date: '', expected_delivery: '',
  
  // Payment & Delivery
  payment_terms: '', delivery_terms: '',
  payment_milestones: [],
  
  // Additional details
  terms_and_conditions: '', notes: '',
  
  // Oil & Gas specific
  material_specifications: {}, required_certifications: [],
  inspection_requirements: '', witness_inspection: false,
  heat_numbers_required: false, ndt_requirements: '',
  applicable_standards: [], material_grade: '',
  pressure_rating: '', temperature_rating: '',
});

const emptyItem = () => ({
  id: Date.now() + Math.random(),
  description: '', quantity: 1, unit: 'unit', unit_price: 0, total: 0, discount: 0,
});

// -- DropZone --
const DropZone = ({ onFile }) => {
  const [dragging, setDragging] = useState(false);
  const inputRef = useRef();
  const handleDrop = useCallback((e) => {
    e.preventDefault(); setDragging(false);
    const file = e.dataTransfer.files?.[0]; if (file) onFile(file);
  }, [onFile]);
  return (
    <div
      onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
      onDragLeave={() => setDragging(false)}
      onDrop={handleDrop}
      onClick={() => inputRef.current?.click()}
      className={`cursor-pointer border-2 border-dashed rounded-xl p-10 text-center transition-all ${dragging ? 'border-indigo-500 bg-indigo-50' : 'border-gray-300 hover:border-indigo-400 hover:bg-gray-50'}`}
    >
      <input ref={inputRef} type="file" accept="application/pdf" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) onFile(f); }} />
      <CloudArrowUpIcon className="h-14 w-14 text-indigo-400 mx-auto mb-4" />
      <p className="text-lg font-semibold text-gray-700">Drop your PDF here</p>
      <p className="text-sm text-gray-500 mt-1">Purchase Order or Purchase Requisition - PDF only</p>
      <div className="mt-4 inline-block px-4 py-2 bg-indigo-600 text-white text-sm rounded-lg">Browse File</div>
    </div>
  );
};

// -- ExtractionProgress --
const ExtractionProgress = ({ stage, progress, filename }) => (
  <div className="py-10 px-6 text-center">
    <div className="relative w-20 h-20 mx-auto mb-6">
      <svg className="w-20 h-20 -rotate-90" viewBox="0 0 80 80">
        <circle cx="40" cy="40" r="34" fill="none" stroke="#e5e7eb" strokeWidth="6" />
        <circle cx="40" cy="40" r="34" fill="none" stroke="#6366f1" strokeWidth="6"
          strokeDasharray={`${2 * Math.PI * 34}`}
          strokeDashoffset={`${2 * Math.PI * 34 * (1 - progress / 100)}`}
          className="transition-all duration-700" />
      </svg>
      <span className="absolute inset-0 flex items-center justify-center text-indigo-700 font-bold text-sm">{progress}%</span>
    </div>
    <p className="text-sm text-gray-500 mb-2 truncate max-w-xs mx-auto">{filename}</p>
    <p className="text-base font-semibold text-gray-800 mb-6">{stage}</p>
    <div className="space-y-2 max-w-sm mx-auto">
      {EXTRACTION_STAGES.map((s) => (
        <div key={s.id} className="flex items-center space-x-3 text-sm">
          <div className={`w-5 h-5 rounded-full flex items-center justify-center flex-shrink-0 ${progress >= s.pct ? 'bg-indigo-600' : 'bg-gray-200'}`}>
            {progress >= s.pct && <CheckCircleIcon className="w-3.5 h-3.5 text-white" />}
          </div>
          <span className={progress >= s.pct ? 'text-gray-800 font-medium' : 'text-gray-400'}>{s.label}</span>
        </div>
      ))}
    </div>
  </div>
);

const ExtractedBadge = ({ value }) =>
  value ? <span className="ml-2 text-xs bg-emerald-100 text-emerald-700 border border-emerald-300 rounded px-1.5 py-0.5 font-medium">AI extracted</span> : null;

const ItemRow = ({ item, onChange, onRemove }) => {
  const handleField = (field, value) => {
    const updated = { ...item, [field]: value };
    if (field === 'quantity' || field === 'unit_price')
      updated.total = (parseFloat(updated.quantity) || 0) * (parseFloat(updated.unit_price) || 0);
    onChange(updated);
  };
  const total = ((parseFloat(item.quantity) || 0) * (parseFloat(item.unit_price) || 0)).toFixed(2);
  return (
    <div className="grid grid-cols-12 gap-2 items-start py-2 border-b border-gray-100 last:border-0">
      <div className="col-span-5">
        <input value={item.description} onChange={(e) => handleField('description', e.target.value)}
          placeholder="Description / service"
          className="w-full text-sm border border-gray-300 rounded px-2 py-1.5 focus:ring-1 focus:ring-indigo-400 focus:outline-none" />
      </div>
      <div className="col-span-1">
        <input type="number" min="0" step="any" value={item.quantity} onChange={(e) => handleField('quantity', e.target.value)}
          className="w-full text-sm border border-gray-300 rounded px-2 py-1.5 text-center focus:ring-1 focus:ring-indigo-400 focus:outline-none" />
      </div>
      <div className="col-span-1">
        <input value={item.unit} onChange={(e) => handleField('unit', e.target.value)} placeholder="unit"
          className="w-full text-sm border border-gray-300 rounded px-2 py-1.5 focus:ring-1 focus:ring-indigo-400 focus:outline-none" />
      </div>
      <div className="col-span-2">
        <input type="number" min="0" step="any" value={item.unit_price} onChange={(e) => handleField('unit_price', e.target.value)} placeholder="0.00"
          className="w-full text-sm border border-gray-300 rounded px-2 py-1.5 text-right focus:ring-1 focus:ring-indigo-400 focus:outline-none" />
      </div>
      <div className="col-span-2">
        <div className="text-sm text-right py-1.5 px-2 font-medium text-gray-700">
          {parseFloat(total).toLocaleString(undefined, { minimumFractionDigits: 2 })}
        </div>
      </div>
      <div className="col-span-1 flex justify-center pt-1">
        <button type="button" onClick={onRemove} className="text-red-400 hover:text-red-600">
          <TrashIcon className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
};

// -- Main component --
const AIPurchaseOrderCreator = ({ isOpen, onClose, onOrderCreated, vendors = [], projects = [] }) => {
  const [step, setStep] = useState('upload');
  const [selectedFile, setSelectedFile] = useState(null);
  const [extractionProgress, setExtractionProgress] = useState(0);
  const [extractionStage, setExtractionStage] = useState('');
  const [documentId, setDocumentId] = useState(null);
  const [extractionError, setExtractionError] = useState(null);
  const [formData, setFormData] = useState(emptyForm());
  const [items, setItems] = useState([]);
  const [aiExtractedFields, setAiExtractedFields] = useState(new Set());
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState(null);

  if (!isOpen) return null;

  const setField = (key, value) => setFormData((prev) => ({ ...prev, [key]: value }));
  const totalOrderValue = items.reduce((s, i) => s + (parseFloat(i.total) || 0), 0);
  const updateItem = (u) => setItems((prev) => prev.map((i) => (i.id === u.id ? u : i)));
  const removeItem = (id) => setItems((prev) => prev.filter((i) => i.id !== id));
  const addItem = () => setItems((prev) => [...prev, emptyItem()]);

  const runProgressAnimation = async (realExtractFn) => {
    const stages = EXTRACTION_STAGES;
    const advanceTo = (idx) => {
      if (idx < stages.length) {
        setExtractionStage(stages[idx].label);
        setExtractionProgress(stages[idx].pct);
      }
    };
    advanceTo(0);
    await new Promise((r) => setTimeout(r, 800));
    advanceTo(1);
    const extractPromise = realExtractFn();
    await new Promise((r) => setTimeout(r, 1200));
    advanceTo(2);
    await new Promise((r) => setTimeout(r, 1800));
    advanceTo(3);
    const result = await extractPromise;
    await new Promise((r) => setTimeout(r, 600));
    advanceTo(4);
    await new Promise((r) => setTimeout(r, 400));
    return result;
  };

  const applyExtractedData = (data) => {
    if (!data || typeof data !== 'object') return;
    const touched = new Set();
    const set = (key, value) => { if (value !== null && value !== undefined && value !== '') { touched.add(key); return value; } return emptyForm()[key] ?? ''; };
    
    // Auto-match vendor by name
    const vendorNameHint = data.vendor_name || '';
    const matchedVendor = vendors.find((v) =>
      v.name?.toLowerCase().includes(vendorNameHint.toLowerCase()) ||
      vendorNameHint.toLowerCase().includes(v.name?.toLowerCase())
    );
    
    // Smart auto-match project by number (AI extraction + fuzzy matching)
    const projectNumberHint = data.project_number || data.project_code || '';
    const matchedProject = projects.find((p) =>
      p.project_number?.toLowerCase().includes(projectNumberHint.toLowerCase()) ||
      projectNumberHint.toLowerCase().includes(p.project_number?.toLowerCase())
    );
    
    setFormData({
      // Identification
      po_number:            set('po_number', data.po_number) || '',
      pr_reference:         set('pr_reference', data.pr_number) || '',
      pr_requester_name:    set('pr_requester_name', data.pr_requester_name) || '',
      
      // Project linkage - auto-populated if matched
      project:              matchedProject ? matchedProject.id : '',
      project_number:       set('project_number', projectNumberHint) || '',
      project_manager:      set('project_manager', data.project_manager) || '',
      budget:               set('budget', data.budget) || '',
      
      // Vendor
      vendor:               matchedVendor ? matchedVendor.id : '',
      vendor_name_hint:     vendorNameHint,
      
      // Description
      title:                set('title', data.title || data.scope_of_services?.slice(0, 150)) || '',
      description:          set('description', data.description || data.scope_of_services) || '',
      category:             set('category', data.category) || 'engineering_services',
      
      // Financial
      currency:             set('currency', data.currency) || 'USD',
      total_amount:         set('total_amount', data.total_amount) || '',
      tax_amount:           set('tax_amount', data.tax_amount) || '',
      discount_amount:      '',
      
      // Dates
      po_date:              set('po_date', data.po_date) || '',
      start_date:           set('start_date', data.start_date) || '',
      end_date:             set('end_date', data.end_date) || '',
      expected_delivery:    set('expected_delivery', data.expected_delivery || data.delivery_date) || '',
      
      // Payment & Delivery
      payment_terms:        set('payment_terms', data.payment_terms) || '',
      delivery_terms:       set('delivery_terms', data.delivery_terms) || '',
      payment_milestones:   Array.isArray(data.payment_milestones) ? data.payment_milestones : [],
      
      // Additional details
      terms_and_conditions: set('terms_and_conditions', data.terms_and_conditions) || '',
      notes:                set('notes', data.special_notes) || '',
      
      // Oil & Gas specific
      material_specifications: {}, 
      required_certifications: [],
      inspection_requirements: '', 
      witness_inspection: false,
      heat_numbers_required: false, 
      ndt_requirements: '',
      applicable_standards: data.applicable_standards || [],
      material_grade: '', 
      pressure_rating: '', 
      temperature_rating: '',
    });
    
    // Mark vendor as AI-extracted if matched
    if (matchedVendor) touched.add('vendor');
    
    // Mark project as AI-extracted if matched
    if (matchedProject) touched.add('project');
    
    // Map payment milestones if present
    if (Array.isArray(data.payment_milestones) && data.payment_milestones.length > 0) {
      touched.add('payment_milestones');
    }
    
    // Map line items if present
    if (Array.isArray(data.items) && data.items.length > 0) {
      touched.add('items');
      setItems(data.items.map((it, idx) => ({
        id: Date.now() + idx,
        description: it.description || '',
        quantity:    parseFloat(it.quantity) || 1,
        unit:        it.unit || 'unit',
        unit_price:  parseFloat(it.unit_price) || 0,
        discount:    parseFloat(it.discount) || 0,
        total:       parseFloat(it.total) || (parseFloat(it.quantity) || 1) * (parseFloat(it.unit_price) || 0),
      })));
    }
    
    setAiExtractedFields(touched);
  };

  const handleFileSelected = async (file) => {
    setSelectedFile(file);
    setExtractionError(null);
    setStep('extracting');
    try {
      const doExtract = async () => {
        const fd = new FormData();
        fd.append('file', file);
        const resp = await apiClient.post('/procurement/po-documents/extract_from_pdf/', fd, {
          headers: { 'Content-Type': 'multipart/form-data' }
        });
        const json = resp.data;
        if (!json.success) throw new Error(json.error || 'Extraction failed');
        return json;
      };
      const result = await runProgressAnimation(doExtract);
      setDocumentId(result.document_id);
      applyExtractedData(result.extracted_data || {});
      setStep('review');
    } catch (err) {
      setExtractionError(err.response?.data?.error || err.message || 'Extraction failed');
      setStep('upload');
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    // Smart validation with helpful messages
    if (vendors.length === 0) { 
      setSubmitError('No vendors available. Please create a vendor first before creating a Purchase Order.'); 
      return; 
    }
    if (!formData.vendor) { 
      setSubmitError('Please select a vendor from the list.'); 
      return; 
    }
    
    setSubmitting(true); setSubmitError(null);
    try {
      const payload = { ...formData, items, total_amount: totalOrderValue > 0 ? totalOrderValue : (parseFloat(formData.total_amount) || 0) };
      delete payload.vendor_name_hint;
      const resp = await apiClient.post('/procurement/orders/', payload);
      const created = resp.data;
      if (documentId && created.id) {
        apiClient.post(`/procurement/po-documents/${documentId}/confirm_po/`, { purchase_order_id: created.id }).catch(() => {});
      }
      onOrderCreated?.(created);
      onClose();
    } catch (err) {
      const errorData = err.response?.data;
      const errorMsg = errorData?.error || errorData?.detail || JSON.stringify(errorData) || err.message || 'Failed to create purchase order';
      setSubmitError(errorMsg);
    } finally {
      setSubmitting(false);
    }
  };

  const Field = ({ label, name, type = 'text', required = false, children, aiKey }) => (
    <div>
      <label className="block text-xs font-semibold text-gray-600 mb-1">
        {label}{required && <span className="text-red-500 ml-0.5">*</span>}
        {aiKey && aiExtractedFields.has(aiKey) && <ExtractedBadge value={true} />}
      </label>
      {children ?? (
        <input type={type} name={name} value={formData[name] ?? ''} onChange={(e) => setField(name, e.target.value)} required={required}
          className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-400 focus:outline-none" />
      )}
    </div>
  );

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto">
      <div className="flex items-center justify-center min-h-screen px-4 py-8">
        <div className="fixed inset-0 bg-black bg-opacity-50" onClick={step !== 'extracting' ? onClose : undefined} />
        <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-5xl overflow-hidden">

          {/* Header */}
          <div className="bg-gradient-to-r from-indigo-600 to-purple-600 px-6 py-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-3">
                <SparklesIcon className="h-7 w-7 text-white" />
                <div>
                  <h2 className="text-lg font-bold text-white">AI Purchase Order Creator</h2>
                  <p className="text-xs text-indigo-200">
                    {step === 'upload'     && 'Upload a PDF to auto-generate, or create manually'}
                    {step === 'extracting' && 'AI is extracting procurement data from your document...'}
                    {step === 'review'     && 'Review AI-extracted data and confirm your PO'}
                    {step === 'manual'     && 'Fill in the purchase order details manually'}
                  </p>
                </div>
              </div>
              {step !== 'extracting' && (
                <button onClick={onClose} className="text-white hover:text-indigo-200"><XMarkIcon className="h-6 w-6" /></button>
              )}
            </div>
            <div className="flex items-center space-x-2 mt-3">
              {[{ id: 'upload', label: '1. Upload' }, { id: 'extracting', label: '2. Extract' }, { id: 'review', label: '3. Review' }].map((s, idx, arr) => (
                <React.Fragment key={s.id}>
                  <div className={`text-xs px-2 py-0.5 rounded-full font-medium
                    ${step === s.id ? 'bg-white text-indigo-700'
                      : (['review','manual'].includes(step) && idx < 2) || (step === 'extracting' && idx === 0) ? 'bg-indigo-400 text-white'
                      : 'bg-indigo-500 text-indigo-200'}`}>
                    {s.id === 'extracting' && step === 'manual' ? '—' : s.label}
                  </div>
                  {idx < arr.length - 1 && <div className="flex-1 h-px bg-indigo-400" />}
                </React.Fragment>
              ))}
            </div>
          </div>

          {/* Body */}
          <div className="max-h-[78vh] overflow-y-auto">

            {/* UPLOAD STEP */}
            {step === 'upload' && (
              <div className="p-8">
                {extractionError && (
                  <div className="mb-6 flex items-start space-x-2 bg-red-50 border border-red-200 rounded-lg p-4">
                    <ExclamationTriangleIcon className="h-5 w-5 text-red-500 flex-shrink-0 mt-0.5" />
                    <div>
                      <p className="text-sm font-semibold text-red-700">Extraction failed</p>
                      <p className="text-xs text-red-600 mt-1">{extractionError}</p>
                    </div>
                  </div>
                )}
                <DropZone onFile={handleFileSelected} />
                <div className="my-6 flex items-center space-x-4">
                  <div className="flex-1 h-px bg-gray-200" />
                  <span className="text-xs text-gray-400 font-medium">OR</span>
                  <div className="flex-1 h-px bg-gray-200" />
                </div>
                <button type="button" onClick={() => { setFormData(emptyForm()); setItems([]); setAiExtractedFields(new Set()); setStep('manual'); }}
                  className="w-full py-3 border-2 border-indigo-200 text-indigo-700 font-semibold rounded-xl hover:bg-indigo-50 transition-colors text-sm">
                  Create Purchase Order Manually
                </button>
                <div className="mt-6 grid grid-cols-3 gap-4 text-center text-xs text-gray-500">
                  {[
                    { icon: DocumentTextIcon,  color: 'indigo',  title: 'Smart Extraction',  desc: 'AI reads all PO & PR fields automatically' },
                    { icon: ShieldCheckIcon,   color: 'emerald', title: 'Secure Storage',    desc: 'PDF stored in AWS S3 with AES-256 encryption' },
                    { icon: SparklesIcon,      color: 'purple',  title: 'GPT-4o Powered',    desc: 'Industry-leading AI understands complex docs' },
                  ].map(({ icon: Icon, color, title, desc }) => (
                    <div key={title} className="p-3 bg-gray-50 rounded-lg">
                      <Icon className={`h-6 w-6 text-${color}-400 mx-auto mb-1`} />
                      <p className="font-medium text-gray-700">{title}</p>
                      <p>{desc}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* EXTRACTING STEP */}
            {step === 'extracting' && (
              <ExtractionProgress stage={extractionStage} progress={extractionProgress} filename={selectedFile?.name || ''} />
            )}

            {/* REVIEW / MANUAL STEP */}
            {(step === 'review' || step === 'manual') && (
              <form onSubmit={handleSubmit} className="p-6 space-y-6">

                {step === 'review' && aiExtractedFields.size > 0 && (
                  <div className="flex items-start space-x-3 bg-emerald-50 border border-emerald-200 rounded-xl p-4">
                    <CheckCircleIcon className="h-5 w-5 text-emerald-500 flex-shrink-0 mt-0.5" />
                    <div className="flex-1">
                      <p className="text-sm font-semibold text-emerald-800">
                        AI extracted {aiExtractedFields.size} fields from <span className="italic">{selectedFile?.name}</span>
                      </p>
                      <p className="text-xs text-emerald-700 mt-0.5">
                        Review and edit below. Fields marked <span className="bg-emerald-100 text-emerald-700 border border-emerald-300 rounded px-1 font-medium text-xs">AI extracted</span> were populated automatically.
                      </p>
                    </div>
                    <button type="button" onClick={() => { setStep('upload'); setSelectedFile(null); setExtractionProgress(0); }}
                      className="text-xs text-emerald-600 hover:underline flex-shrink-0">Re-upload</button>
                  </div>
                )}

                {/* PO Identification */}
                <section>
                  <h3 className="text-sm font-bold text-gray-800 uppercase tracking-wide border-b border-gray-200 pb-1 mb-3 flex items-center">
                    <ClipboardDocumentListIcon className="h-4 w-4 mr-1.5 text-indigo-500" />PO Identification
                  </h3>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <Field label="PO Number" name="po_number" required aiKey="po_number" />
                    <Field label="PR Reference (optional)" name="pr_reference" aiKey="pr_reference" />
                    <Field label="Category" name="category" aiKey="category">
                      <select value={formData.category} onChange={(e) => setField('category', e.target.value)}
                        className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-400 focus:outline-none">
                        {CATEGORY_OPTIONS.map((c) => <option key={c.value} value={c.value}>{c.label}</option>)}
                      </select>
                    </Field>
                    <div className="md:col-span-3"><Field label="Title / Subject" name="title" required aiKey="title" /></div>
                    <div className="md:col-span-3">
                      <Field label="Scope of Services / Description" name="description" aiKey="description">
                        <textarea value={formData.description} onChange={(e) => setField('description', e.target.value)} rows={3}
                          className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-400 focus:outline-none" />
                      </Field>
                    </div>
                  </div>
                </section>

                {/* Project Linkage */}
                <section>
                  <div className="flex items-center justify-between border-b border-gray-200 pb-1 mb-3">
                    <h3 className="text-sm font-bold text-gray-800 uppercase tracking-wide flex items-center">
                      <ClipboardDocumentListIcon className="h-4 w-4 mr-1.5 text-indigo-500" />Project Linkage
                      {aiExtractedFields.has('project') && <ExtractedBadge value={true} />}
                      {!aiExtractedFields.has('project') && formData.project_number && (
                        <span className="ml-2 text-xs text-amber-600 bg-amber-50 border border-amber-200 px-2 py-0.5 rounded">
                          AI found: "{formData.project_number}" — select from list below
                        </span>
                      )}
                    </h3>
                    <a
                      href="/procurement/projects/new"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-1 text-xs text-indigo-600 hover:text-indigo-800 font-medium"
                    >
                      <PlusIcon className="h-3.5 w-3.5" />
                      <span>New Project</span>
                    </a>
                  </div>
                  
                  {/* Smart Project Selection or Creation Prompt */}
                  {projects.length === 0 ? (
                    <div className="bg-blue-50 border-l-4 border-blue-400 p-4 rounded-lg">
                      <div className="flex items-start gap-3">
                        <ClipboardDocumentListIcon className="h-5 w-5 text-blue-500 flex-shrink-0 mt-0.5" />
                        <div className="flex-1">
                          <h4 className="text-sm font-semibold text-blue-900 mb-1">
                            No Projects Available
                          </h4>
                          <p className="text-xs text-blue-800 mb-3">
                            You can create this Purchase Order without a project, or create a project first for better budget tracking and financial reporting.
                          </p>
                          <div className="flex gap-2">
                            <a
                              href="/procurement/projects/new"
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 text-white text-xs font-medium rounded-lg hover:bg-blue-700 transition-colors"
                            >
                              <PlusIcon className="h-4 w-4" />
                              Create Project First
                            </a>
                            <button
                              type="button"
                              onClick={() => {/* Continue without project - do nothing, form already allows it */}}
                              className="px-3 py-1.5 bg-white border border-blue-300 text-blue-700 text-xs font-medium rounded-lg hover:bg-blue-50 transition-colors"
                            >
                              Continue Without Project
                            </button>
                          </div>
                          <p className="text-xs text-blue-600 mt-2">
                            💡 Tip: After creating a project, refresh this page to link it to this PO
                          </p>
                        </div>
                      </div>
                    </div>
                  ) : (
                    <>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <Field label="Project" name="project">
                          <select 
                            value={formData.project} 
                            onChange={(e) => {
                              setField('project', e.target.value);
                              // Auto-fill project details when selected
                              const selectedProj = projects.find(p => p.id === e.target.value);
                              if (selectedProj) {
                                setField('project_number', selectedProj.project_number || '');
                                setField('project_manager', selectedProj.project_manager_name || '');
                              }
                            }}
                            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-400 focus:outline-none"
                          >
                            <option value="">— Select project (optional) —</option>
                            {projects.map((p) => (
                              <option key={p.id} value={p.id}>
                                {p.project_number} - {p.project_name} ({p.client_name})
                              </option>
                            ))}
                          </select>
                        </Field>
                        <Field label="Project number found in document">
                          <input type="text" readOnly value={formData.project_number}
                            className="w-full border border-gray-200 bg-gray-50 rounded-lg px-3 py-2 text-sm text-gray-500 cursor-not-allowed" />
                        </Field>
                      </div>
                      <p className="text-xs text-gray-500 mt-2">
                        💡 Link this PO to a project for budget tracking and financial reporting. Found {projects.length} project{projects.length !== 1 ? 's' : ''}.
                      </p>
                    </>
                  )}
                </section>

                {/* Vendor */}
                <section>
                  <div className="flex items-center justify-between border-b border-gray-200 pb-1 mb-3">
                    <h3 className="text-sm font-bold text-gray-800 uppercase tracking-wide flex items-center">
                      <BuildingOfficeIcon className="h-4 w-4 mr-1.5 text-indigo-500" />Vendor
                      {aiExtractedFields.has('vendor') && <ExtractedBadge value={true} />}
                      {!aiExtractedFields.has('vendor') && formData.vendor_name_hint && (
                        <span className="ml-2 text-xs text-amber-600 bg-amber-50 border border-amber-200 px-2 py-0.5 rounded">
                          AI found: "{formData.vendor_name_hint}" — select from list below
                        </span>
                      )}
                    </h3>
                    <a
                      href="/procurement/vendors"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-1 text-xs text-indigo-600 hover:text-indigo-800 font-medium"
                    >
                      <PlusIcon className="h-3.5 w-3.5" />
                      <span>New Vendor</span>
                    </a>
                  </div>
                  
                  {/* Smart Vendor Selection or Creation Requirement */}
                  {vendors.length === 0 ? (
                    <div className="bg-red-50 border-l-4 border-red-400 p-4 rounded-lg">
                      <div className="flex items-start gap-3">
                        <ExclamationTriangleIcon className="h-5 w-5 text-red-500 flex-shrink-0 mt-0.5" />
                        <div className="flex-1">
                          <h4 className="text-sm font-semibold text-red-900 mb-1">
                            Vendor Required - No Vendors Available
                          </h4>
                          <p className="text-xs text-red-800 mb-3">
                            You must create at least one vendor before creating a Purchase Order. Vendors are required for all procurement transactions.
                          </p>
                          <a
                            href="/procurement/vendors"
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-red-600 text-white text-xs font-medium rounded-lg hover:bg-red-700 transition-colors"
                          >
                            <BuildingOfficeIcon className="h-4 w-4" />
                            Create Vendor First
                          </a>
                          <p className="text-xs text-red-600 mt-2">
                            💡 Tip: After creating a vendor, refresh this page to select it
                          </p>
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <Field label="Vendor" name="vendor" required>
                        <select value={formData.vendor} onChange={(e) => setField('vendor', e.target.value)}
                          className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-400 focus:outline-none">
                          <option value="">— Select vendor —</option>
                          {vendors.map((v) => <option key={v.id} value={v.id}>{v.name} ({v.vendor_code})</option>)}
                        </select>
                      </Field>
                      <Field label="Vendor name found in document">
                        <input type="text" readOnly value={formData.vendor_name_hint}
                          className="w-full border border-gray-200 bg-gray-50 rounded-lg px-3 py-2 text-sm text-gray-500 cursor-not-allowed" />
                      </Field>
                    </div>
                  )}
                </section>

                {/* Financials */}
                <section>
                  <h3 className="text-sm font-bold text-gray-800 uppercase tracking-wide border-b border-gray-200 pb-1 mb-3 flex items-center">
                    <CurrencyDollarIcon className="h-4 w-4 mr-1.5 text-indigo-500" />Financials
                  </h3>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <Field label="Currency" name="currency" aiKey="currency">
                      <select value={formData.currency} onChange={(e) => setField('currency', e.target.value)}
                        className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-400 focus:outline-none">
                        {CURRENCY_OPTIONS.map((c) => <option key={c}>{c}</option>)}
                      </select>
                    </Field>
                    <Field label="Tax Amount" name="tax_amount" type="number" aiKey="tax_amount" />
                    <Field label="Discount Amount" name="discount_amount" type="number" />
                    <Field label="Payment Terms" name="payment_terms" aiKey="payment_terms" />
                  </div>
                </section>

                {/* Dates */}
                <section>
                  <h3 className="text-sm font-bold text-gray-800 uppercase tracking-wide border-b border-gray-200 pb-1 mb-3 flex items-center">
                    <CalendarIcon className="h-4 w-4 mr-1.5 text-indigo-500" />Dates & Delivery
                  </h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <Field label="Expected Delivery / End Date" name="expected_delivery" type="date" aiKey="expected_delivery" />
                    <Field label="Delivery Terms" name="delivery_terms" aiKey="delivery_terms">
                      <select value={formData.delivery_terms} onChange={(e) => setField('delivery_terms', e.target.value)}
                        className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-400 focus:outline-none">
                        <option value="">— Select —</option>
                        {DELIVERY_TERMS.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
                      </select>
                    </Field>
                  </div>
                </section>

                {/* Line Items */}
                <section>
                  <div className="flex items-center justify-between border-b border-gray-200 pb-1 mb-3">
                    <h3 className="text-sm font-bold text-gray-800 uppercase tracking-wide flex items-center">
                      <ClipboardDocumentListIcon className="h-4 w-4 mr-1.5 text-indigo-500" />Line Items
                      {aiExtractedFields.has('items') && <ExtractedBadge value={true} />}
                    </h3>
                    <button type="button" onClick={addItem} className="flex items-center space-x-1 text-xs text-indigo-600 hover:text-indigo-800 font-medium">
                      <PlusIcon className="h-4 w-4" /><span>Add Item</span>
                    </button>
                  </div>
                  {items.length === 0 ? (
                    <div className="text-center py-6 text-gray-400 text-sm border border-dashed border-gray-200 rounded-lg">
                      No items yet. <button type="button" onClick={addItem} className="text-indigo-500 hover:underline">Add one</button>
                    </div>
                  ) : (
                    <div>
                      <div className="grid grid-cols-12 gap-2 text-xs font-semibold text-gray-500 mb-1">
                        <div className="col-span-5">Description</div>
                        <div className="col-span-1 text-center">Qty</div>
                        <div className="col-span-1">Unit</div>
                        <div className="col-span-2 text-right">Unit Price</div>
                        <div className="col-span-2 text-right">Total</div>
                        <div className="col-span-1" />
                      </div>
                      {items.map((item) => (
                        <ItemRow key={item.id} item={item} onChange={updateItem} onRemove={() => removeItem(item.id)} />
                      ))}
                      <div className="flex justify-end mt-3 pt-3 border-t border-gray-200">
                        <div className="text-sm text-gray-600 space-y-1 text-right">
                          <div>Subtotal: <span className="font-semibold">{formData.currency} {totalOrderValue.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span></div>
                          {parseFloat(formData.tax_amount) > 0 && <div>Tax: <span className="font-semibold">{formData.currency} {parseFloat(formData.tax_amount).toLocaleString(undefined, { minimumFractionDigits: 2 })}</span></div>}
                          <div className="text-base font-bold text-gray-900 border-t pt-1">
                            Total: {formData.currency} {(totalOrderValue + (parseFloat(formData.tax_amount) || 0) - (parseFloat(formData.discount_amount) || 0)).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                          </div>
                        </div>
                      </div>
                    </div>
                  )}
                </section>

                {/* Terms & Notes */}
                <section>
                  <h3 className="text-sm font-bold text-gray-800 uppercase tracking-wide border-b border-gray-200 pb-1 mb-3 flex items-center">
                    <DocumentTextIcon className="h-4 w-4 mr-1.5 text-indigo-500" />Terms & Notes
                  </h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <Field label="Terms & Conditions" name="terms_and_conditions" aiKey="terms_and_conditions">
                      <textarea value={formData.terms_and_conditions} onChange={(e) => setField('terms_and_conditions', e.target.value)} rows={3}
                        className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-400 focus:outline-none" />
                    </Field>
                    <Field label="Notes" name="notes" aiKey="notes">
                      <textarea value={formData.notes} onChange={(e) => setField('notes', e.target.value)} rows={3}
                        className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-400 focus:outline-none" />
                    </Field>
                  </div>
                </section>

                {submitError && (
                  <div className="flex items-start space-x-2 bg-red-50 border border-red-200 rounded-lg p-3">
                    <ExclamationTriangleIcon className="h-5 w-5 text-red-500 flex-shrink-0" />
                    <p className="text-sm text-red-700">{submitError}</p>
                  </div>
                )}

                {/* Footer */}
                <div className="flex items-center justify-between pt-4 border-t border-gray-200 sticky bottom-0 bg-white pb-2">
                  <button type="button" onClick={() => setStep('upload')}
                    className="flex items-center space-x-1 text-sm text-gray-500 hover:text-gray-700">
                    <ArrowLeftIcon className="h-4 w-4" /><span>Back</span>
                  </button>
                  <div className="flex items-center space-x-3">
                    <button type="button" onClick={onClose}
                      className="px-4 py-2 text-sm border border-gray-300 rounded-lg text-gray-600 hover:bg-gray-50">Cancel</button>
                    <button type="submit" disabled={submitting}
                      className="flex items-center space-x-2 px-5 py-2 bg-indigo-600 text-white text-sm font-semibold rounded-lg hover:bg-indigo-700 disabled:opacity-60 transition-colors">
                      {submitting
                        ? <><ArrowPathIcon className="h-4 w-4 animate-spin" /><span>Saving...</span></>
                        : <><CheckCircleIcon className="h-4 w-4" /><span>Create Purchase Order</span></>}
                    </button>
                  </div>
                </div>
              </form>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default AIPurchaseOrderCreator;
