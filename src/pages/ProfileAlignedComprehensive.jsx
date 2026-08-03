/**
 * Comprehensive Employee Profile (Self-Service)
 * Aligned with HR Onboarding/Offboarding + Full Engineering Profile Features
 * 
 * ✅ Personal Info (from EmployeeMaster)
 * ✅ Engineering Expertise (disciplines, skills, certifications)
 * ✅ Project Assignments
 * ✅ Availability Status
 * ✅ Photo Upload (AWS S3)
 * ✅ Profile Completeness Tracker
 * ✅ Tabbed Interface
 * ✅ Full Edit Mode
 * ✅ Soft-coded Configuration
 */
import React, { useState, useEffect, useRef, useMemo } from 'react';
import { useSelector, useDispatch } from 'react-redux';
import { toast } from 'react-toastify';
import { updateUser } from '../store/slices/authSlice';
import apiClient from '../services/api.service';
import {
  User, Mail, Phone, Briefcase, MapPin, Building2,
  Camera, Loader, Save, UserCircle, Pencil, X, Check,
  Hash, Calendar, Globe, DollarSign, CreditCard,
  ChevronRight, Shield, Star, Award, FolderOpen,
  Plus, Trash2, TrendingUp, Clock, FileText, Upload,
  Download, CheckCircle, AlertCircle, File
} from 'lucide-react';

// ────────────────────────────────────────────────────────────────────────────
// SOFT-CODED CONFIGURATION
// ────────────────────────────────────────────────────────────────────────────

// API Endpoints
const API_ENDPOINTS = {
  myProfile: '/users/employees/my-employee-profile',
  uploadPhoto: '/users/employees/my-profile-photo',
  activeEmployees: '/users/employees/active_employees',
  onboarding: '/onboarding',
  documents: '/onboarding/documents',
};

// Document Types (aligned with HR Onboarding system)
const DOCUMENT_TYPES = [
  { value: 'passport', label: 'Passport Copy', icon: FileText, color: 'bg-blue-100 text-blue-700' },
  { value: 'visa', label: 'Visa', icon: FileText, color: 'bg-purple-100 text-purple-700' },
  { value: 'emirates_id', label: 'Emirates ID', icon: FileText, color: 'bg-green-100 text-green-700' },
  { value: 'driving_license', label: 'Driving License', icon: FileText, color: 'bg-yellow-100 text-yellow-700' },
  { value: 'degree', label: 'Educational Certificates', icon: Award, color: 'bg-indigo-100 text-indigo-700' },
  { value: 'certificate', label: 'Professional Certificate', icon: Award, color: 'bg-cyan-100 text-cyan-700' },
  { value: 'experience', label: 'Experience Letters', icon: FileText, color: 'bg-teal-100 text-teal-700' },
  { value: 'offer_letter', label: 'Signed Offer Letter', icon: FileText, color: 'bg-pink-100 text-pink-700' },
  { value: 'contract', label: 'Employment Contract', icon: FileText, color: 'bg-rose-100 text-rose-700' },
  { value: 'confidentiality', label: 'Confidentiality Agreement', icon: Shield, color: 'bg-orange-100 text-orange-700' },
  { value: 'policy_acknowledgment', label: 'Policy Acknowledgment', icon: CheckCircle, color: 'bg-lime-100 text-lime-700' },
  { value: 'bank_details', label: 'Bank Account Details', icon: CreditCard, color: 'bg-emerald-100 text-emerald-700' },
  { value: 'emergency_contact', label: 'Emergency Contact Form', icon: Phone, color: 'bg-red-100 text-red-700' },
  { value: 'medical', label: 'Medical/Insurance Forms', icon: Plus, color: 'bg-violet-100 text-violet-700' },
  { value: 'vaccination', label: 'Vaccination Certificate', icon: Plus, color: 'bg-fuchsia-100 text-fuchsia-700' },
  { value: 'police_clearance', label: 'Police Clearance Certificate', icon: Shield, color: 'bg-amber-100 text-amber-700' },
  { value: 'other', label: 'Other', icon: File, color: 'bg-gray-100 text-gray-700' },
];

// Engineering Disciplines
const ENGINEERING_DISCIPLINES = [
  'Process', 'Piping', 'Instrument & Control', 'Electrical',
  'Civil & Structural', 'Mechanical', 'Safety & HSE', 'Project Controls',
  'Commissioning', 'Materials & Corrosion', 'Environmental', 'Procurement',
];

// Expertise Levels
const EXPERTISE_LEVELS = [
  { value: 'junior',    label: 'Junior Engineer',    years: '0–3 yrs',   colorClass: 'bg-blue-100 text-blue-700 border-blue-300',     dotClass: 'bg-blue-500' },
  { value: 'mid',       label: 'Mid-Level Engineer', years: '3–7 yrs',   colorClass: 'bg-cyan-100 text-cyan-700 border-cyan-300',      dotClass: 'bg-cyan-500' },
  { value: 'senior',    label: 'Senior Engineer',    years: '7–15 yrs',  colorClass: 'bg-green-100 text-green-700 border-green-300',   dotClass: 'bg-green-500' },
  { value: 'lead',      label: 'Lead Engineer',      years: '12–20 yrs', colorClass: 'bg-purple-100 text-purple-700 border-purple-300', dotClass: 'bg-purple-500' },
  { value: 'principal', label: 'Principal Engineer', years: '18+ yrs',   colorClass: 'bg-orange-100 text-orange-700 border-orange-300', dotClass: 'bg-orange-500' },
  { value: 'fellow',    label: 'Engineering Fellow', years: '25+ yrs',   colorClass: 'bg-red-100 text-red-700 border-red-300',         dotClass: 'bg-red-500' },
];

// Technical Skills
const TECHNICAL_SKILLS_CATALOG = [
  'HYSYS', 'AspenPlus', 'PDMS', 'AVEVA E3D', 'Smart Plant P&ID',
  'AutoCAD Plant 3D', 'CAESAR II', 'ETAP', 'AVEVA Instrumentation',
  'COMOS', 'HTRI', 'FLARENET', 'PIPESIM', 'OLGA', 'Microsoft Project',
  'Primavera P6', 'SAP PM', 'HAZOP Leadership', 'SIL Assessment',
  'Risk-Based Inspection', 'Front End Loading (FEL)', 'Rotating Equipment',
];

// Certifications
const CERTIFICATION_OPTIONS = [
  'PMP (Project Management Professional)',
  'Chartered Engineer (CEng)',
  'Professional Engineer (PE)',
  'CompEx (Explosive Atmospheres)',
  'NEBOSH General Certificate',
  'NEBOSH International Diploma',
  'ISO 55000 Asset Management',
  'ISO 9001 Quality MS',
  'ISO 14001 Environmental MS',
  'Functional Safety (IEC 61511)',
  'API 510 Pressure Vessel Inspector',
  'API 570 Piping Inspector',
  'API 653 Tank Inspector',
  'AWS Certified Welding Inspector (CWI)',
  'CSWIP 3.1 Welding Inspector',
  'Prince2 Practitioner',
  'Six Sigma Green Belt',
  'Six Sigma Black Belt',
];

// Languages
const LANGUAGES = [
  'English', 'Arabic', 'French', 'Spanish', 'German', 'Russian',
  'Mandarin', 'Hindi', 'Urdu', 'Tagalog', 'Portuguese',
];

// Availability Statuses
const AVAILABILITY_STATUSES = [
  { value: 'available', label: 'Available',           badgeClass: 'bg-green-500',  bgClass: 'bg-green-50 border-green-300',   textClass: 'text-green-700',  desc: 'Ready for new assignments' },
  { value: 'partial',   label: 'Partially Available', badgeClass: 'bg-yellow-500', bgClass: 'bg-yellow-50 border-yellow-300', textClass: 'text-yellow-700', desc: 'Limited bandwidth available' },
  { value: 'busy',      label: 'Fully Committed',     badgeClass: 'bg-red-500',    bgClass: 'bg-red-50 border-red-300',       textClass: 'text-red-700',    desc: 'At full project capacity' },
  { value: 'on_leave',  label: 'On Leave',            badgeClass: 'bg-gray-400',   bgClass: 'bg-gray-50 border-gray-300',     textClass: 'text-gray-600',   desc: 'Temporarily unavailable' },
];

// Project Types
const PROJECT_TYPES = [
  'Greenfield Development', 'Brownfield Modification', 'Conceptual Study',
  'Feasibility Study', 'FEED', 'Detailed Engineering', 'EPC',
  'Construction Support', 'Commissioning & Start-up', 'Maintenance Engineering', 'Decommissioning',
];

// Project Roles
const PROJECT_ROLES = [
  'Lead Process Engineer', 'Process Engineer', 'Lead Piping Engineer', 'Piping Engineer',
  'Lead Instrument Engineer', 'Instrument Engineer', 'Lead Electrical Engineer', 'Electrical Engineer',
  'Lead Mechanical Engineer', 'Mechanical Engineer', 'Civil / Structural Engineer',
  'Safety / HSE Lead', 'Project Manager', 'Project Engineer', 'Document Controller',
  'Commissioning Engineer', 'Materials & Corrosion Engineer', 'Cost Estimator',
];

// Project Statuses
const PROJECT_ASSIGNMENT_STATUSES = [
  { value: 'active',      label: 'Active',       bgClass: 'bg-green-100 text-green-700',  dotClass: 'bg-green-500' },
  { value: 'on_hold',     label: 'On Hold',      bgClass: 'bg-yellow-100 text-yellow-700', dotClass: 'bg-yellow-500' },
  { value: 'completing',  label: 'Completing',   bgClass: 'bg-blue-100 text-blue-700',    dotClass: 'bg-blue-500' },
  { value: 'completed',   label: 'Completed',    bgClass: 'bg-gray-100 text-gray-500',    dotClass: 'bg-gray-400' },
];

// Default Objects
const DEFAULT_PROJECT = { 
  name: '', role: '', allocation: 50, start_date: '', end_date: '', 
  status: 'active', client: '', location: '' 
};

const DEFAULT_EP = {
  expertise_level: '',
  years_experience: '',
  engineering_disciplines: [],
  technical_skills: [],
  languages: [],
  certifications: [],
  availability_status: 'available',
  availability_percentage: 100,
  preferred_project_types: [],
  max_concurrent_projects: 2,
  next_available_date: '',
  current_projects: [],
};

// Completeness Fields (sum to 100)
const COMPLETENESS_FIELDS = [
  { key: 'first_name',              src: 'basic', w: 6  },
  { key: 'last_name',               src: 'basic', w: 6  },
  { key: 'phone_number',            src: 'basic', w: 4  },
  { key: 'city',                    src: 'basic', w: 4  },
  { key: 'department',              src: 'basic', w: 4  },
  { key: 'job_title_uae',           src: 'basic', w: 6  },
  { key: 'expertise_level',         src: 'eng',   w: 10 },
  { key: 'years_experience',        src: 'eng',   w: 6  },
  { key: 'engineering_disciplines', src: 'arr',   w: 12 },
  { key: 'technical_skills',        src: 'arr',   w: 12 },
  { key: 'certifications',          src: 'arr',   w: 12 },
  { key: 'availability_status',     src: 'eng',   w: 6  },
  { key: 'languages',               src: 'arr',   w: 6  },
  { key: 'photo_url',               src: 'basic', w: 6  },
];

// Tabs
const TABS = [
  { id: 'personal',       label: 'Personal',       icon: User       },
  { id: 'expertise',      label: 'Engineering',    icon: Briefcase  },
  { id: 'certifications', label: 'Certifications', icon: Award      },
  { id: 'documents',      label: 'Documents',      icon: FileText   },
  { id: 'availability',   label: 'Availability',   icon: Calendar   },
  { id: 'projects',       label: 'Projects',       icon: FolderOpen },
];

// ────────────────────────────────────────────────────────────────────────────
// MAIN COMPONENT
// ────────────────────────────────────────────────────────────────────────────

export default function ProfileAlignedComprehensive() {
  const dispatch = useDispatch();
  const { user } = useSelector((s) => s.auth);

  const [activeTab, setActiveTab]             = useState('personal');
  const [loading, setLoading]                 = useState(true);
  const [saving, setSaving]                   = useState(false);
  const [employee, setEmployee]               = useState(null);
  const [managers, setManagers]               = useState([]);

  // Photo upload
  const [photoPreview, setPhotoPreview]       = useState(null);
  const [selectedFile, setSelectedFile]       = useState(null);
  const [uploadingPhoto, setUploadingPhoto]   = useState(false);
  const fileInputRef = useRef(null);

  // Personal form
  const [formData, setFormData] = useState({
    first_name: '', last_name: '', email: '', phone_number: '',
    address: '', city: '', postal_code: '', country: '',
    job_title_uae: '', job_title_finland: '',
    division: '', department: '', business_unit: '', office: '',
  });

  // Engineer profile
  const [ep, setEp] = useState(DEFAULT_EP);

  // Cert/skill/project entry
  const [newCert, setNewCert] = useState({ name: '', issuer: '', year: '', expiry_date: '' });
  const [showCertForm, setShowCertForm] = useState(false);
  const [selectedSkill, setSelectedSkill] = useState('');
  const [skillProficiency, setSkillProficiency] = useState(3);
  const [newProject, setNewProject] = useState(DEFAULT_PROJECT);
  const [showProjectForm, setShowProjectForm] = useState(false);

  // Documents
  const [documents, setDocuments] = useState([]);
  const [loadingDocuments, setLoadingDocuments] = useState(false);
  const [showDocumentForm, setShowDocumentForm] = useState(false);
  const [uploadingDocument, setUploadingDocument] = useState(false);
  const [uploadData, setUploadData] = useState({
    document_type: 'emirates_id',
    document_name: '',
    file: null,
  });
  const [documentAlert, setDocumentAlert] = useState(null);

  // Completeness
  const completeness = useMemo(() => {
    let total = 0;
    COMPLETENESS_FIELDS.forEach(({ key, src, w }) => {
      const val = src === 'basic' ? formData[key] : ep[key];
      if (src === 'arr') {
        if (Array.isArray(val) && val.length > 0) total += w;
      } else {
        if (val && String(val).trim()) total += w;
      }
    });
    return Math.min(100, total);
  }, [formData, ep]);

  useEffect(() => {
    loadProfile();
    loadManagers();
  }, []);

  const loadProfile = async () => {
    setLoading(true);
    try {
      const res = await apiClient.get(API_ENDPOINTS.myProfile);
      const emp = res.data.employee;
      setEmployee(emp);

      // Map to form data
      setFormData({
        first_name: emp.first_name || '',
        last_name: emp.last_name || '',
        email: emp.email || '',
        phone_number: emp.phone_number || '',
        address: emp.address || '',
        city: emp.city || '',
        postal_code: emp.postal_code || '',
        country: emp.country || '',
        job_title_uae: emp.job_title_uae || '',
        job_title_finland: emp.job_title_finland || '',
        division: emp.division || '',
        department: emp.department || '',
        business_unit: emp.business_unit || '',
        office: emp.office || '',
      });

      if (emp.photo_url) setPhotoPreview(emp.photo_url);

      // Load engineer_profile if exists (stored as JSON field)
      const savedEp = emp.engineer_profile ? JSON.parse(emp.engineer_profile) : {};
      setEp({ ...DEFAULT_EP, ...savedEp });
    } catch (err) {
      console.error('Failed to load profile:', err);
      toast.error('Failed to load profile data');
    } finally {
      setLoading(false);
    }
  };

  const loadManagers = async () => {
    try {
      const res = await apiClient.get(`${API_ENDPOINTS.activeEmployees}/?search=`);
      setManagers(res.data.results || []);
    } catch (err) {
      console.error('Failed to load managers:', err);
    }
  };

  // ── Load Documents ───────────────────────────────────────────────────────
  const loadDocuments = async () => {
    if (!employee?.email) return;
    setLoadingDocuments(true);
    try {
      // Find onboarding record by employee email
      const res = await apiClient.get(`${API_ENDPOINTS.onboarding}/onboarding/?search=${employee.email}`);
      const data = Array.isArray(res.data) ? res.data : (res.data.results || []);
      if (data.length > 0) {
        const onboardingRecord = data[0];
        setDocuments(onboardingRecord.documents || []);
      }
    } catch (err) {
      console.error('Failed to load documents:', err);
    } finally {
      setLoadingDocuments(false);
    }
  };

  // ── Upload Document ──────────────────────────────────────────────────────
  const handleDocumentUpload = async () => {
    if (!uploadData.file) {
      setDocumentAlert({ type: 'error', message: 'Please select a file to upload' });
      setTimeout(() => setDocumentAlert(null), 3000);
      return;
    }

    setUploadingDocument(true);

    try {
      // Find or verify onboarding record exists
      const onboardingRes = await apiClient.get(`${API_ENDPOINTS.onboarding}/onboarding/?search=${employee.email}`);
      const onboardingData = Array.isArray(onboardingRes.data) ? onboardingRes.data : (onboardingRes.data.results || []);
      
      let onboardingRecordId;
      if (onboardingData.length > 0) {
        onboardingRecordId = onboardingData[0].id;
      } else {
        setDocumentAlert({ type: 'error', message: 'No onboarding record found. Please contact HR.' });
        setTimeout(() => setDocumentAlert(null), 5000);
        setUploadingDocument(false);
        return;
      }

      // Create FormData for file upload
      const formData = new FormData();
      formData.append('file', uploadData.file);
      formData.append('document_type', uploadData.document_type);
      formData.append('document_name', uploadData.document_name);
      formData.append('onboarding_record', onboardingRecordId);

      // Upload document
      await apiClient.post(`${API_ENDPOINTS.documents}/`, formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
      });

      setDocumentAlert({ type: 'success', message: 'Document uploaded successfully!' });
      setTimeout(() => setDocumentAlert(null), 3000);
      
      // Reset form and reload documents
      setUploadData({ document_type: 'emirates_id', document_name: '', file: null });
      setShowDocumentForm(false);
      await loadDocuments();
    } catch (err) {
      setDocumentAlert({ type: 'error', message: err.response?.data?.error || 'Failed to upload document' });
      setTimeout(() => setDocumentAlert(null), 5000);
    } finally {
      setUploadingDocument(false);
    }
  };

  // ── Download Document ────────────────────────────────────────────────────
  const handleDocumentDownload = async (documentId) => {
    try {
      const res = await apiClient.get(`${API_ENDPOINTS.documents}/${documentId}/download_url/`);
      window.open(res.data.download_url, '_blank');
    } catch (err) {
      setDocumentAlert({ type: 'error', message: 'Failed to generate download link' });
      setTimeout(() => setDocumentAlert(null), 3000);
    }
  };

  // ── Delete Document ──────────────────────────────────────────────────────
  const handleDocumentDelete = async (documentId) => {
    if (!confirm('Are you sure you want to delete this document?')) return;

    try {
      await apiClient.delete(`${API_ENDPOINTS.documents}/${documentId}/`);
      setDocumentAlert({ type: 'success', message: 'Document deleted successfully' });
      setTimeout(() => setDocumentAlert(null), 3000);
      await loadDocuments();
    } catch (err) {
      setDocumentAlert({ type: 'error', message: 'Failed to delete document' });
      setTimeout(() => setDocumentAlert(null), 3000);
    }
  };

  // Load documents when employee data is available
  useEffect(() => {
    if (employee?.email) {
      loadDocuments();
    }
  }, [employee?.email]);

  // ── Save Personal Info ───────────────────────────────────────────────────
  const savePersonalInfo = async () => {
    setSaving(true);
    try {
      await apiClient.patch(API_ENDPOINTS.myProfile, formData);
      toast.success('Personal information saved!');
      await loadProfile();
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to save');
    } finally {
      setSaving(false);
    }
  };

  // ── Save Engineer Profile ────────────────────────────────────────────────
  const saveEngineerProfile = async (successMsg = 'Engineering profile saved!') => {
    setSaving(true);
    try {
      await apiClient.patch(API_ENDPOINTS.myProfile, {
        engineer_profile: JSON.stringify(ep)
      });
      toast.success(successMsg);
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to save');
    } finally {
      setSaving(false);
    }
  };

  // ── Photo Upload ─────────────────────────────────────────────────────────
  const handlePhotoUpload = async (file) => {
    if (!file || !file.type.startsWith('image/')) {
      toast.error('Please select a valid image file');
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      toast.error('Image must be less than 5MB');
      return;
    }

    setUploadingPhoto(true);
    const formData = new FormData();
    formData.append('photo', file);

    try {
      const res = await apiClient.post(API_ENDPOINTS.uploadPhoto, formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      setPhotoPreview(res.data.photo_url);
      dispatch(updateUser({ profile_photo: res.data.photo_url }));
      toast.success('Profile photo updated!');
    } catch (err) {
      toast.error('Failed to upload photo');
    } finally {
      setUploadingPhoto(false);
      setSelectedFile(null);
    }
  };

  const handleFileSelect = (file) => {
    setSelectedFile(file);
    // Show preview immediately
    const reader = new FileReader();
    reader.onloadend = () => {
      setPhotoPreview(reader.result);
      handlePhotoUpload(file);
    };
    reader.readAsDataURL(file);
  };

  // ── Skills ───────────────────────────────────────────────────────────────
  const addSkill = () => {
    if (!selectedSkill) return;
    if (ep.technical_skills.some(s => s.name === selectedSkill)) {
      toast.info('Skill already added');
      return;
    }
    setEp(p => ({
      ...p,
      technical_skills: [...p.technical_skills, { name: selectedSkill, proficiency: skillProficiency }]
    }));
    setSelectedSkill('');
    setSkillProficiency(3);
  };

  const removeSkill = (name) => {
    setEp(p => ({
      ...p,
      technical_skills: p.technical_skills.filter(s => s.name !== name)
    }));
  };

  // ── Certifications ───────────────────────────────────────────────────────
  const addCertification = () => {
    if (!newCert.name) {
      toast.error('Certification name is required');
      return;
    }
    setEp(p => ({
      ...p,
      certifications: [...p.certifications, { ...newCert, id: Date.now() }]
    }));
    setNewCert({ name: '', issuer: '', year: '', expiry_date: '' });
    setShowCertForm(false);
  };

  const removeCert = (id) => {
    setEp(p => ({
      ...p,
      certifications: p.certifications.filter(c => c.id !== id)
    }));
  };

  const getCertExpiryStatus = (expiryDate) => {
    if (!expiryDate) return null;
    const monthsLeft = (new Date(expiryDate) - new Date()) / (1000 * 60 * 60 * 24 * 30);
    if (monthsLeft < 0) return 'expired';
    if (monthsLeft <= 6) return 'expiring';
    return 'valid';
  };

  // ── Toggle Array Items ───────────────────────────────────────────────────
  const toggleArr = (key, val) => {
    setEp(p => ({
      ...p,
      [key]: p[key].includes(val) ? p[key].filter(x => x !== val) : [...p[key], val],
    }));
  };

  // ── Projects ─────────────────────────────────────────────────────────────
  const addProject = () => {
    if (!newProject.name.trim()) {
      toast.error('Project name is required');
      return;
    }
    if (!newProject.role) {
      toast.error('Your role on the project is required');
      return;
    }
    setEp(p => ({
      ...p,
      current_projects: [...(p.current_projects || []), { ...newProject, id: Date.now() }]
    }));
    setNewProject(DEFAULT_PROJECT);
    setShowProjectForm(false);
  };

  const removeProject = (id) => {
    setEp(p => ({
      ...p,
      current_projects: (p.current_projects || []).filter(pr => pr.id !== id)
    }));
  };

  const updateProjectStatus = (id, status) => {
    setEp(p => ({
      ...p,
      current_projects: (p.current_projects || []).map(pr =>
        pr.id === id ? { ...pr, status } : pr
      )
    }));
  };

  // ── Helpers ──────────────────────────────────────────────────────────────
  const getUserInitials = () => {
    const f = formData.first_name || '';
    const l = formData.last_name || '';
    return `${f.charAt(0)}${l.charAt(0)}`.toUpperCase() || 'U';
  };

  const formatFileSize = (bytes) => {
    if (!bytes) return 'N/A';
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(2) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(2) + ' MB';
  };

  const currentExpertise = EXPERTISE_LEVELS.find(e => e.value === ep.expertise_level);
  const currentAvail = AVAILABILITY_STATUSES.find(a => a.value === ep.availability_status);
  const completenessColor = completeness >= 80 ? 'bg-green-500' : completeness >= 50 ? 'bg-blue-500' : 'bg-yellow-400';
  const completenessText = completeness >= 80 ? 'text-green-600' : completeness >= 50 ? 'text-blue-600' : 'text-yellow-600';

  // Shared CSS
  const inputCls = 'w-full px-4 py-2.5 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white text-gray-900 placeholder-gray-400 transition-all';
  const labelCls = 'block text-sm font-medium text-gray-700 mb-1.5';

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-purple-50 flex items-center justify-center">
        <div className="text-center">
          <Loader className="w-12 h-12 animate-spin text-blue-600 mx-auto mb-4" />
          <p className="text-gray-600 font-medium">Loading your profile…</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-purple-50 py-8 px-4 sm:px-6 lg:px-8">
      <div className="max-w-5xl mx-auto space-y-6">

        {/* ── Profile Hero ───────────────────────────────────────────────── */}
        <div className="bg-white rounded-2xl shadow-lg overflow-hidden">
          <div className="h-28 bg-gradient-to-r from-blue-600 via-purple-600 to-teal-500" />

          <div className="px-6 sm:px-8 pb-6">
            <div className="flex flex-col sm:flex-row sm:items-end gap-5 -mt-14 mb-5">
              {/* Avatar */}
              <div
                className="relative w-28 h-28 rounded-full overflow-hidden ring-4 ring-white shadow-xl flex-shrink-0 cursor-pointer"
                onClick={() => fileInputRef.current?.click()}
                title="Click to change photo"
              >
                <div className="absolute inset-0 bg-gradient-to-br from-blue-500 to-purple-500 flex items-center justify-center text-white text-4xl font-bold">
                  {getUserInitials()}
                </div>
                {photoPreview && (
                  <img
                    src={photoPreview}
                    alt="Profile"
                    className="absolute inset-0 w-full h-full object-cover"
                    onError={() => setPhotoPreview(null)}
                  />
                )}
                <div className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 hover:opacity-100 transition-opacity rounded-full">
                  <Camera className="w-6 h-6 text-white" />
                </div>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  onChange={(e) => {
                    const f = e.target.files[0];
                    if (f) handleFileSelect(f);
                  }}
                  className="hidden"
                />
              </div>

              {/* Name/Title */}
              <div className="flex-1 pb-0.5">
                <h1 className="text-2xl font-bold text-gray-900 leading-tight">
                  {formData.first_name || formData.last_name
                    ? `${formData.first_name} ${formData.last_name}`.trim()
                    : user?.email}
                </h1>
                <div className="flex flex-wrap items-center gap-2 mt-1">
                  {formData.job_title_uae && <span className="text-gray-600 font-medium">{formData.job_title_uae}</span>}
                  {formData.job_title_uae && formData.department && <span className="text-gray-300">·</span>}
                  {formData.department && <span className="text-gray-500">{formData.department}</span>}
                  {currentExpertise && (
                    <span className={`text-xs px-2.5 py-0.5 rounded-full border font-semibold ${currentExpertise.colorClass}`}>
                      {currentExpertise.label}
                    </span>
                  )}
                </div>
                {formData.city && (
                  <p className="text-sm text-gray-400 mt-1 flex items-center gap-1">
                    <MapPin className="w-3.5 h-3.5" />{formData.city}
                  </p>
                )}
              </div>

              {/* Availability badge */}
              {currentAvail && (
                <div className={`flex-shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-full border text-sm font-semibold ${currentAvail.bgClass} ${currentAvail.textClass}`}>
                  <span className={`w-2 h-2 rounded-full ${currentAvail.badgeClass}`} />
                  {currentAvail.label}
                </div>
              )}
            </div>

            {/* Discipline chips */}
            {ep.engineering_disciplines.length > 0 && (
              <div className="flex flex-wrap gap-1.5 mb-4">
                {ep.engineering_disciplines.map(d => (
                  <span key={d} className="text-xs bg-blue-50 text-blue-700 border border-blue-100 px-2 py-0.5 rounded-full font-medium">{d}</span>
                ))}
              </div>
            )}

            {/* Completeness bar */}
            <div>
              <div className="flex items-center justify-between text-sm mb-1.5">
                <span className="text-gray-500 font-medium">Profile Completeness</span>
                <span className={`font-bold ${completenessText}`}>{completeness}%</span>
              </div>
              <div className="w-full bg-gray-100 rounded-full h-2 overflow-hidden">
                <div
                  className={`h-2 rounded-full transition-all duration-700 ${completenessColor}`}
                  style={{ width: `${completeness}%` }}
                />
              </div>
              {completeness < 80 && (
                <p className="text-xs text-gray-400 mt-1">
                  Complete engineering expertise & certifications to reach 80%
                </p>
              )}
            </div>
          </div>
        </div>

        {/* ── Tabbed Content ─────────────────────────────────────────────── */}
        <div className="bg-white rounded-2xl shadow-lg overflow-hidden">
          {/* Tab bar */}
          <div className="flex border-b border-gray-100 bg-gray-50/50">
            {TABS.map(({ id, label, icon: Icon }) => (
              <button
                key={id}
                onClick={() => setActiveTab(id)}
                className={`flex-1 flex items-center justify-center gap-2 py-4 text-sm font-semibold transition-all ${activeTab === id
                  ? 'text-blue-600 border-b-2 border-blue-600 bg-white'
                  : 'text-gray-500 hover:text-gray-700 hover:bg-white/70'
                  }`}
              >
                <Icon className="w-4 h-4" />
                <span className="hidden sm:inline">{label}</span>
              </button>
            ))}
          </div>

          {/* Tab: Personal */}
          {activeTab === 'personal' && (
            <div className="p-6 sm:p-8 space-y-5">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                <div>
                  <label className={labelCls}>First Name</label>
                  <input
                    type="text"
                    value={formData.first_name}
                    onChange={e => setFormData(p => ({ ...p, first_name: e.target.value }))}
                    className={inputCls}
                    placeholder="First name"
                  />
                </div>
                <div>
                  <label className={labelCls}>Last Name</label>
                  <input
                    type="text"
                    value={formData.last_name}
                    onChange={e => setFormData(p => ({ ...p, last_name: e.target.value }))}
                    className={inputCls}
                    placeholder="Last name"
                  />
                </div>
                <div>
                  <label className={labelCls}>Email Address</label>
                  <input
                    type="email"
                    value={formData.email}
                    disabled
                    className="w-full px-4 py-2.5 border border-gray-200 rounded-lg bg-gray-50 text-gray-400 cursor-not-allowed"
                  />
                  <p className="text-xs text-gray-400 mt-1">Email cannot be changed</p>
                </div>
                <div>
                  <label className={labelCls}>Phone Number</label>
                  <div className="relative">
                    <Phone className="absolute left-3 top-3 w-4 h-4 text-gray-400" />
                    <input
                      type="tel"
                      value={formData.phone_number}
                      onChange={e => setFormData(p => ({ ...p, phone_number: e.target.value }))}
                      className={`${inputCls} pl-10`}
                      placeholder="+971 50 123 4567"
                    />
                  </div>
                </div>
                <div>
                  <label className={labelCls}>City</label>
                  <div className="relative">
                    <MapPin className="absolute left-3 top-3 w-4 h-4 text-gray-400" />
                    <input
                      type="text"
                      value={formData.city}
                      onChange={e => setFormData(p => ({ ...p, city: e.target.value }))}
                      className={`${inputCls} pl-10`}
                      placeholder="Abu Dhabi"
                    />
                  </div>
                </div>
                <div>
                  <label className={labelCls}>Department</label>
                  <div className="relative">
                    <Building2 className="absolute left-3 top-3 w-4 h-4 text-gray-400" />
                    <input
                      type="text"
                      value={formData.department}
                      onChange={e => setFormData(p => ({ ...p, department: e.target.value }))}
                      className={`${inputCls} pl-10`}
                      placeholder="Process Engineering"
                    />
                  </div>
                </div>
                <div className="sm:col-span-2">
                  <label className={labelCls}>Job Title (UAE)</label>
                  <input
                    type="text"
                    value={formData.job_title_uae}
                    onChange={e => setFormData(p => ({ ...p, job_title_uae: e.target.value }))}
                    className={inputCls}
                    placeholder="Senior Process Engineer"
                  />
                </div>
                <div className="sm:col-span-2">
                  <label className={labelCls}>Address</label>
                  <textarea
                    value={formData.address}
                    onChange={e => setFormData(p => ({ ...p, address: e.target.value }))}
                    rows={3}
                    className={`${inputCls} resize-none`}
                    placeholder="Street address"
                  />
                </div>
              </div>

              {uploadingPhoto && (
                <div className="flex items-center gap-2 p-3 bg-blue-50 rounded-lg border border-blue-100">
                  <Loader className="w-4 h-4 text-blue-500 animate-spin flex-shrink-0" />
                  <p className="text-sm text-blue-700 font-medium">Uploading photo…</p>
                </div>
              )}

              <div className="flex justify-end">
                <button
                  onClick={savePersonalInfo}
                  disabled={saving}
                  className="px-6 py-2.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 flex items-center gap-2 font-semibold transition-all"
                >
                  {saving ? <Loader className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                  Save Personal Info
                </button>
              </div>
            </div>
          )}

          {/* Tab: Engineering Expertise */}
          {activeTab === 'expertise' && (
            <div className="p-6 sm:p-8 space-y-8">
              {/* Career level */}
              <div>
                <h3 className="text-base font-semibold text-gray-900 mb-3">Career Level</h3>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mb-5">
                  {EXPERTISE_LEVELS.map(lvl => (
                    <button
                      key={lvl.value}
                      type="button"
                      onClick={() => setEp(p => ({ ...p, expertise_level: lvl.value }))}
                      className={`p-3 rounded-xl border-2 text-left transition-all ${ep.expertise_level === lvl.value
                        ? `${lvl.colorClass} shadow-md`
                        : 'bg-gray-50 border-gray-200 hover:border-gray-300'
                        }`}
                    >
                      <div className={`w-2.5 h-2.5 rounded-full mb-2 ${lvl.dotClass}`} />
                      <p className="text-sm font-bold text-gray-900 leading-tight">{lvl.label}</p>
                      <p className="text-xs text-gray-500 mt-0.5">{lvl.years}</p>
                    </button>
                  ))}
                </div>
                <div className="max-w-xs">
                  <label className={labelCls}>Years of Experience</label>
                  <input
                    type="number"
                    min="0"
                    max="50"
                    value={ep.years_experience}
                    onChange={e => setEp(p => ({ ...p, years_experience: e.target.value }))}
                    className={inputCls}
                    placeholder="e.g. 12"
                  />
                </div>
              </div>

              {/* Disciplines */}
              <div>
                <h3 className="text-base font-semibold text-gray-900 mb-1">Engineering Disciplines</h3>
                <p className="text-xs text-gray-400 mb-3">Select all disciplines you are competent in</p>
                <div className="flex flex-wrap gap-2">
                  {ENGINEERING_DISCIPLINES.map(d => (
                    <button
                      key={d}
                      type="button"
                      onClick={() => toggleArr('engineering_disciplines', d)}
                      className={`px-3 py-1.5 rounded-full border text-sm font-medium transition-all ${ep.engineering_disciplines.includes(d)
                        ? 'bg-blue-600 text-white border-blue-600 shadow-sm'
                        : 'bg-white text-gray-600 border-gray-200 hover:border-blue-300 hover:text-blue-600'
                        }`}
                    >
                      {ep.engineering_disciplines.includes(d) && <Check className="inline w-3.5 h-3.5 mr-1 -mt-0.5" />}
                      {d}
                    </button>
                  ))}
                </div>
              </div>

              {/* Skills */}
              <div>
                <h3 className="text-base font-semibold text-gray-900 mb-1">Technical Skills & Software</h3>
                <p className="text-xs text-gray-400 mb-3">Add tools and competencies with proficiency level (★)</p>
                <div className="flex gap-2 mb-4">
                  <select
                    value={selectedSkill}
                    onChange={e => setSelectedSkill(e.target.value)}
                    className="flex-1 px-3 py-2.5 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 bg-white text-gray-700"
                  >
                    <option value="">Select a skill…</option>
                    {TECHNICAL_SKILLS_CATALOG.filter(s => !ep.technical_skills.some(ts => ts.name === s)).map(s => (
                      <option key={s} value={s}>{s}</option>
                    ))}
                  </select>
                  <div className="flex items-center gap-0.5 bg-gray-50 border border-gray-200 rounded-lg px-3">
                    {[1, 2, 3, 4, 5].map(n => (
                      <button key={n} type="button" onClick={() => setSkillProficiency(n)}>
                        <Star className={`w-4 h-4 transition-colors ${n <= skillProficiency ? 'text-yellow-400 fill-yellow-400' : 'text-gray-300'}`} />
                      </button>
                    ))}
                  </div>
                  <button
                    type="button"
                    onClick={addSkill}
                    className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-semibold hover:bg-blue-700 flex items-center gap-1"
                  >
                    <Plus className="w-4 h-4" />
                  </button>
                </div>
                <div className="flex flex-wrap gap-2">
                  {ep.technical_skills.map(sk => (
                    <div
                      key={sk.name}
                      className="flex items-center gap-1.5 bg-white border border-gray-200 rounded-full pl-3 pr-1.5 py-1 text-sm shadow-sm"
                    >
                      <span className="font-medium text-gray-800">{sk.name}</span>
                      <span className="flex gap-0.5">
                        {[1, 2, 3, 4, 5].map(n => (
                          <Star key={n} className={`w-3 h-3 ${n <= sk.proficiency ? 'text-yellow-400 fill-yellow-400' : 'text-gray-200'}`} />
                        ))}
                      </span>
                      <button onClick={() => removeSkill(sk.name)} className="text-gray-300 hover:text-red-500 ml-0.5">
                        <X className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ))}
                  {ep.technical_skills.length === 0 && (
                    <p className="text-sm text-gray-400 italic">No skills added yet</p>
                  )}
                </div>
              </div>

              {/* Languages */}
              <div>
                <h3 className="text-base font-semibold text-gray-900 mb-3 flex items-center gap-1.5">
                  <Globe className="w-4 h-4 text-gray-400" /> Languages
                </h3>
                <div className="flex flex-wrap gap-2">
                  {LANGUAGES.map(l => (
                    <button
                      key={l}
                      type="button"
                      onClick={() => toggleArr('languages', l)}
                      className={`px-3 py-1.5 rounded-full border text-sm font-medium transition-all ${ep.languages.includes(l)
                        ? 'bg-teal-600 text-white border-teal-600'
                        : 'bg-white text-gray-600 border-gray-200 hover:border-teal-300'
                        }`}
                    >
                      {l}
                    </button>
                  ))}
                </div>
              </div>

              <div className="flex justify-end">
                <button
                  onClick={() => saveEngineerProfile('Engineering profile saved!')}
                  disabled={saving}
                  className="px-6 py-2.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 flex items-center gap-2 font-semibold"
                >
                  {saving ? <Loader className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                  Save Engineering Profile
                </button>
              </div>
            </div>
          )}

          {/* Tab: Certifications */}
          {activeTab === 'certifications' && (
            <div className="p-6 sm:p-8 space-y-6">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-base font-semibold text-gray-900">Professional Certifications</h3>
                  <p className="text-xs text-gray-400 mt-0.5">Certifications visible to project managers</p>
                </div>
                <button
                  onClick={() => setShowCertForm(true)}
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-semibold hover:bg-blue-700 flex items-center gap-1.5"
                >
                  <Plus className="w-4 h-4" /> Add
                </button>
              </div>

              {showCertForm && (
                <div className="bg-blue-50 border border-blue-100 rounded-xl p-5">
                  <h4 className="text-sm font-semibold text-blue-800 mb-4">New Certification</h4>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="sm:col-span-2">
                      <label className={labelCls}>Certification Name *</label>
                      <select
                        value={newCert.name}
                        onChange={e => setNewCert(p => ({ ...p, name: e.target.value }))}
                        className={`${inputCls} mb-2`}
                      >
                        <option value="">Choose from catalogue…</option>
                        {CERTIFICATION_OPTIONS.map(c => <option key={c} value={c}>{c}</option>)}
                      </select>
                      <input
                        type="text"
                        value={newCert.name}
                        onChange={e => setNewCert(p => ({ ...p, name: e.target.value }))}
                        className={inputCls}
                        placeholder="Or type a custom certification name"
                      />
                    </div>
                    <div>
                      <label className={labelCls}>Issuing Body</label>
                      <input
                        type="text"
                        value={newCert.issuer}
                        onChange={e => setNewCert(p => ({ ...p, issuer: e.target.value }))}
                        className={inputCls}
                        placeholder="e.g. PMI, IChemE"
                      />
                    </div>
                    <div>
                      <label className={labelCls}>Year Obtained</label>
                      <input
                        type="number"
                        min="1980"
                        max={new Date().getFullYear()}
                        value={newCert.year}
                        onChange={e => setNewCert(p => ({ ...p, year: e.target.value }))}
                        className={inputCls}
                        placeholder={String(new Date().getFullYear())}
                      />
                    </div>
                    <div className="sm:col-span-2">
                      <label className={labelCls}>Expiry Date (if applicable)</label>
                      <input
                        type="date"
                        value={newCert.expiry_date}
                        onChange={e => setNewCert(p => ({ ...p, expiry_date: e.target.value }))}
                        className={inputCls}
                      />
                    </div>
                  </div>
                  <div className="flex justify-end gap-2 mt-4">
                    <button
                      onClick={() => setShowCertForm(false)}
                      className="px-4 py-2 border border-gray-200 rounded-lg text-sm text-gray-600 hover:bg-gray-50"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={addCertification}
                      className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-semibold hover:bg-blue-700"
                    >
                      Add
                    </button>
                  </div>
                </div>
              )}

              <div className="space-y-3">
                {ep.certifications.length === 0 ? (
                  <div className="text-center py-14 text-gray-300">
                    <Award className="w-14 h-14 mx-auto mb-3" />
                    <p className="text-sm font-medium">No certifications added yet</p>
                    <p className="text-xs mt-1 text-gray-400">Add professional certifications to improve profile</p>
                  </div>
                ) : ep.certifications.map(cert => {
                  const status = getCertExpiryStatus(cert.expiry_date);
                  const borderCls = status === 'expired' ? 'border-red-200 bg-red-50' : status === 'expiring' ? 'border-yellow-200 bg-yellow-50' : 'border-gray-100 bg-white hover:border-blue-100';
                  const iconCls = status === 'expired' ? 'text-red-500 bg-red-100' : status === 'expiring' ? 'text-yellow-500 bg-yellow-100' : 'text-blue-500 bg-blue-100';
                  return (
                    <div key={cert.id} className={`flex items-start gap-4 p-4 rounded-xl border-2 transition-all ${borderCls}`}>
                      <div className={`w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0 ${iconCls}`}>
                        <Award className="w-5 h-5" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <h4 className="font-semibold text-gray-900 text-sm">{cert.name}</h4>
                        {cert.issuer && <p className="text-xs text-gray-500 mt-0.5">{cert.issuer}</p>}
                        <div className="flex items-center gap-2 mt-1 text-xs text-gray-400">
                          {cert.year && <span>Obtained: {cert.year}</span>}
                          {cert.expiry_date && <span>• Expires: {new Date(cert.expiry_date).toLocaleDateString()}</span>}
                        </div>
                      </div>
                      <button onClick={() => removeCert(cert.id)} className="text-gray-300 hover:text-red-500">
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  );
                })}
              </div>

              <div className="flex justify-end">
                <button
                  onClick={() => saveEngineerProfile('Certifications saved!')}
                  disabled={saving}
                  className="px-6 py-2.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 flex items-center gap-2 font-semibold"
                >
                  {saving ? <Loader className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                  Save Certifications
                </button>
              </div>
            </div>
          )}

          {/* Tab: Documents */}
          {activeTab === 'documents' && (
            <div className="p-6 sm:p-8 space-y-6">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-base font-semibold text-gray-900">Document Management</h3>
                  <p className="text-xs text-gray-400 mt-0.5">Upload and manage your employment documents</p>
                </div>
                <button
                  onClick={() => setShowDocumentForm(!showDocumentForm)}
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-semibold hover:bg-blue-700 flex items-center gap-1.5"
                >
                  {showDocumentForm ? (
                    <>
                      <X className="w-4 h-4" />
                      Cancel
                    </>
                  ) : (
                    <>
                      <Plus className="w-4 h-4" />
                      Upload Document
                    </>
                  )}
                </button>
              </div>

              {/* Alert */}
              {documentAlert && (
                <div
                  className={`rounded-lg border p-3 flex items-center gap-2 text-sm ${documentAlert.type === 'success'
                    ? 'bg-emerald-50 border-emerald-200 text-emerald-700'
                    : 'bg-rose-50 border-rose-200 text-rose-700'
                    }`}
                >
                  {documentAlert.type === 'success' ? (
                    <CheckCircle className="w-5 h-5" />
                  ) : (
                    <AlertCircle className="w-5 h-5" />
                  )}
                  <span className="font-medium">{documentAlert.message}</span>
                </div>
              )}

              {/* Upload Form */}
              {showDocumentForm && (
                <div className="bg-blue-50 border border-blue-100 rounded-xl p-5">
                  <h4 className="text-sm font-semibold text-blue-800 mb-4">Upload New Document</h4>
                  <div className="space-y-4">
                    <div>
                      <label className={labelCls}>Document Type *</label>
                      <select
                        value={uploadData.document_type}
                        onChange={(e) => setUploadData({ ...uploadData, document_type: e.target.value })}
                        className={inputCls}
                      >
                        {DOCUMENT_TYPES.map((type) => (
                          <option key={type.value} value={type.value}>{type.label}</option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className={labelCls}>Document Name *</label>
                      <input
                        type="text"
                        value={uploadData.document_name}
                        onChange={(e) => setUploadData({ ...uploadData, document_name: e.target.value })}
                        placeholder="e.g., Emirates ID - Copy"
                        className={inputCls}
                      />
                    </div>
                    <div>
                      <label className={labelCls}>File *</label>
                      <input
                        type="file"
                        onChange={(e) => {
                          const file = e.target.files[0];
                          if (file) setUploadData({ ...uploadData, file, document_name: uploadData.document_name || file.name });
                        }}
                        accept=".pdf,.jpg,.jpeg,.png,.doc,.docx"
                        className={inputCls}
                      />
                      <p className="text-xs text-gray-500 mt-1">
                        Accepted formats: PDF, JPG, PNG, DOC, DOCX (Max 10MB)
                      </p>
                    </div>
                    <button
                      onClick={handleDocumentUpload}
                      disabled={uploadingDocument}
                      className="w-full px-4 py-2.5 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors disabled:bg-slate-400 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                    >
                      {uploadingDocument ? (
                        <>
                          <Loader className="w-5 h-5 animate-spin" />
                          Uploading...
                        </>
                      ) : (
                        <>
                          <Upload className="w-5 h-5" />
                          Upload Document
                        </>
                      )}
                    </button>
                  </div>
                </div>
              )}

              {/* Documents List */}
              {loadingDocuments ? (
                <div className="flex items-center justify-center py-12">
                  <Loader className="w-8 h-8 animate-spin text-blue-600 mr-2" />
                  <span className="text-sm text-gray-500">Loading documents...</span>
                </div>
              ) : documents.length === 0 ? (
                <div className="text-center py-14">
                  <FileText className="w-14 h-14 mx-auto text-gray-300 mb-3" />
                  <p className="text-sm font-medium text-gray-500">No documents uploaded yet</p>
                  <p className="text-xs text-gray-400 mt-1">Upload your employment documents to complete your profile</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {documents.map((doc) => {
                    const docType = DOCUMENT_TYPES.find((t) => t.value === doc.document_type) || {
                      label: doc.document_type,
                      icon: File,
                      color: 'bg-gray-100 text-gray-700',
                    };
                    const IconComponent = docType.icon;
                    return (
                      <div
                        key={doc.id}
                        className="flex items-center justify-between p-4 bg-white rounded-xl border-2 border-gray-100 hover:border-blue-100 transition-all"
                      >
                        <div className="flex items-center gap-3 flex-1">
                          <div className={`w-10 h-10 rounded-lg ${docType.color} flex items-center justify-center`}>
                            <IconComponent className="w-5 h-5" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <h4 className="font-semibold text-gray-900 text-sm truncate">{doc.document_name}</h4>
                            <p className="text-xs text-gray-500 mt-0.5">{docType.label}</p>
                            <div className="flex items-center gap-2 mt-1 text-xs text-gray-400">
                              <span>{formatFileSize(doc.file_size)}</span>
                              {doc.uploaded_at && (
                                <>
                                  <span>•</span>
                                  <span>{new Date(doc.uploaded_at).toLocaleDateString()}</span>
                                </>
                              )}
                            </div>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => handleDocumentDownload(doc.id)}
                            className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                            title="Download"
                          >
                            <Download className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => handleDocumentDelete(doc.id)}
                            className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                            title="Delete"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* Tab: Availability */}
          {activeTab === 'availability' && (
            <div className="p-6 sm:p-8 space-y-6">
              <div>
                <h3 className="text-base font-semibold text-gray-900 mb-3">Current Availability</h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {AVAILABILITY_STATUSES.map(avail => (
                    <button
                      key={avail.value}
                      type="button"
                      onClick={() => setEp(p => ({ ...p, availability_status: avail.value }))}
                      className={`p-4 rounded-xl border-2 text-left transition-all ${ep.availability_status === avail.value
                        ? `${avail.bgClass} ${avail.textClass} shadow-md`
                        : 'bg-white border-gray-200 hover:border-gray-300'
                        }`}
                    >
                      <div className="flex items-center gap-2 mb-1">
                        <span className={`w-2.5 h-2.5 rounded-full ${avail.badgeClass}`} />
                        <span className="font-bold text-gray-900">{avail.label}</span>
                      </div>
                      <p className="text-xs text-gray-500">{avail.desc}</p>
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className={labelCls}>Preferred Project Types</label>
                <p className="text-xs text-gray-400 mb-3">Select types of projects you prefer to work on</p>
                <div className="flex flex-wrap gap-2">
                  {PROJECT_TYPES.map(t => (
                    <button
                      key={t}
                      type="button"
                      onClick={() => toggleArr('preferred_project_types', t)}
                      className={`px-3 py-1.5 rounded-full border text-sm font-medium transition-all ${ep.preferred_project_types.includes(t)
                        ? 'bg-purple-600 text-white border-purple-600'
                        : 'bg-white text-gray-600 border-gray-200 hover:border-purple-300'
                        }`}
                    >
                      {t}
                    </button>
                  ))}
                </div>
              </div>

              <div className="flex justify-end">
                <button
                  onClick={() => saveEngineerProfile('Availability updated!')}
                  disabled={saving}
                  className="px-6 py-2.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 flex items-center gap-2 font-semibold"
                >
                  {saving ? <Loader className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                  Save Availability
                </button>
              </div>
            </div>
          )}

          {/* Tab: Projects */}
          {activeTab === 'projects' && (
            <div className="p-6 sm:p-8 space-y-6">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-base font-semibold text-gray-900">Current Project Assignments</h3>
                  <p className="text-xs text-gray-400 mt-0.5">Track your active projects and allocations</p>
                </div>
                <button
                  onClick={() => setShowProjectForm(true)}
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-semibold hover:bg-blue-700 flex items-center gap-1.5"
                >
                  <Plus className="w-4 h-4" /> Add Project
                </button>
              </div>

              {showProjectForm && (
                <div className="bg-blue-50 border border-blue-100 rounded-xl p-5">
                  <h4 className="text-sm font-semibold text-blue-800 mb-4">New Project Assignment</h4>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className={labelCls}>Project Name *</label>
                      <input
                        type="text"
                        value={newProject.name}
                        onChange={e => setNewProject(p => ({ ...p, name: e.target.value }))}
                        className={inputCls}
                        placeholder="e.g. ADNOC Refinery Expansion"
                      />
                    </div>
                    <div>
                      <label className={labelCls}>Your Role *</label>
                      <select
                        value={newProject.role}
                        onChange={e => setNewProject(p => ({ ...p, role: e.target.value }))}
                        className={inputCls}
                      >
                        <option value="">Select role…</option>
                        {PROJECT_ROLES.map(r => <option key={r} value={r}>{r}</option>)}
                      </select>
                    </div>
                    <div>
                      <label className={labelCls}>Client</label>
                      <input
                        type="text"
                        value={newProject.client}
                        onChange={e => setNewProject(p => ({ ...p, client: e.target.value }))}
                        className={inputCls}
                        placeholder="Client name"
                      />
                    </div>
                    <div>
                      <label className={labelCls}>Location</label>
                      <input
                        type="text"
                        value={newProject.location}
                        onChange={e => setNewProject(p => ({ ...p, location: e.target.value }))}
                        className={inputCls}
                        placeholder="Project location"
                      />
                    </div>
                    <div>
                      <label className={labelCls}>Start Date</label>
                      <input
                        type="date"
                        value={newProject.start_date}
                        onChange={e => setNewProject(p => ({ ...p, start_date: e.target.value }))}
                        className={inputCls}
                      />
                    </div>
                    <div>
                      <label className={labelCls}>End Date</label>
                      <input
                        type="date"
                        value={newProject.end_date}
                        onChange={e => setNewProject(p => ({ ...p, end_date: e.target.value }))}
                        className={inputCls}
                      />
                    </div>
                  </div>
                  <div className="flex justify-end gap-2 mt-4">
                    <button
                      onClick={() => setShowProjectForm(false)}
                      className="px-4 py-2 border border-gray-200 rounded-lg text-sm text-gray-600 hover:bg-gray-50"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={addProject}
                      className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-semibold hover:bg-blue-700"
                    >
                      Add
                    </button>
                  </div>
                </div>
              )}

              <div className="space-y-3">
                {(ep.current_projects || []).length === 0 ? (
                  <div className="text-center py-14 text-gray-300">
                    <FolderOpen className="w-14 h-14 mx-auto mb-3" />
                    <p className="text-sm font-medium">No projects added yet</p>
                    <p className="text-xs mt-1 text-gray-400">Add your current project assignments</p>
                  </div>
                ) : (ep.current_projects || []).map(proj => {
                  const statusObj = PROJECT_ASSIGNMENT_STATUSES.find(s => s.value === proj.status);
                  return (
                    <div key={proj.id} className="flex items-start gap-4 p-4 rounded-xl border-2 border-gray-100 bg-white hover:border-blue-100 transition-all">
                      <div className="w-10 h-10 rounded-lg bg-blue-100 text-blue-600 flex items-center justify-center flex-shrink-0">
                        <FolderOpen className="w-5 h-5" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <h4 className="font-semibold text-gray-900 text-sm">{proj.name}</h4>
                        <p className="text-xs text-gray-500 mt-0.5">{proj.role}</p>
                        {(proj.client || proj.location) && (
                          <p className="text-xs text-gray-400 mt-1">
                            {proj.client}{proj.client && proj.location && ' • '}{proj.location}
                          </p>
                        )}
                        <div className="flex items-center gap-2 mt-2">
                          {statusObj && (
                            <span className={`text-xs px-2 py-0.5 rounded-full font-semibold ${statusObj.bgClass}`}>
                              {statusObj.label}
                            </span>
                          )}
                        </div>
                      </div>
                      <button onClick={() => removeProject(proj.id)} className="text-gray-300 hover:text-red-500">
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  );
                })}
              </div>

              <div className="flex justify-end">
                <button
                  onClick={() => saveEngineerProfile('Projects saved!')}
                  disabled={saving}
                  className="px-6 py-2.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 flex items-center gap-2 font-semibold"
                >
                  {saving ? <Loader className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                  Save Projects
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
