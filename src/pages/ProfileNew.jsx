import React, { useState, useEffect } from 'react';
import { useSelector, useDispatch } from 'react-redux';
import { toast } from 'react-toastify';
import { updateUser } from '../store/slices/authSlice';
import {
  User, Mail, Phone, Briefcase, MapPin, Camera, X, Check, Loader,
  Building2, Shield, Save, Users, Calendar, Award, Globe,
  ChevronRight, Edit3, Upload, TrendingUp, Star, Clock,
  FolderOpen, Plus, Trash2
} from 'lucide-react';
import { API_BASE_URL } from '../config/api.config';

// ════════════════════════════════════════════════════════════════════════════
// SOFT-CODED CONSTANTS
// ════════════════════════════════════════════════════════════════════════════

const DEPARTMENTS = [
  { value: 'process', label: 'Process Engineering', icon: '⚙️', color: 'blue' },
  { value: 'piping', label: 'Piping Engineering', icon: '🔧', color: 'cyan' },
  { value: 'instrument', label: 'Instrument & Control', icon: '📊', color: 'purple' },
  { value: 'electrical', label: 'Electrical Engineering', icon: '⚡', color: 'yellow' },
  { value: 'mechanical', label: 'Mechanical Engineering', icon: '🔩', color: 'gray' },
  { value: 'civil', label: 'Civil & Structural Engineering', icon: '🏗️', color: 'stone' },
  { value: 'safety', label: 'Safety & HSE', icon: '🛡️', color: 'red' },
  { value: 'project_controls', label: 'Project Controls', icon: '📈', color: 'green' },
  { value: 'commissioning', label: 'Commissioning', icon: '🎯', color: 'indigo' },
  { value: 'materials', label: 'Materials & Corrosion', icon: '🧪', color: 'pink' },
  { value: 'environmental', label: 'Environmental Engineering', icon: '🌱', color: 'emerald' },
  { value: 'procurement', label: 'Procurement', icon: '📦', color: 'amber' },
  { value: 'operations', label: 'Operations', icon: '⚙️', color: 'orange' },
  { value: 'maintenance', label: 'Maintenance', icon: '🔨', color: 'slate' },
  { value: 'quality', label: 'Quality Assurance', icon: '✅', color: 'teal' },
  { value: 'finance', label: 'Finance', icon: '💰', color: 'green' },
  { value: 'hr', label: 'Human Resources', icon: '👥', color: 'blue' },
  { value: 'it', label: 'Information Technology', icon: '💻', color: 'violet' },
  { value: 'admin', label: 'Administration', icon: '📋', color: 'gray' },
  { value: 'management', label: 'Management', icon: '👔', color: 'indigo' },
  { value: 'radai', label: 'RadAI', icon: '🤖', color: 'fuchsia' },  // SOFT-CODED: AI/ML department
];

const ENGINEERING_DISCIPLINES = [
  'Process', 'Piping', 'Instrument & Control', 'Electrical',
  'Civil & Structural', 'Mechanical', 'Safety & HSE', 'Project Controls',
];

const EXPERTISE_LEVELS = [
  { value: 'junior', label: 'Junior Engineer', years: '0–3 yrs', color: 'bg-blue-500', colorClass: 'bg-blue-100 text-blue-700 border-blue-300', dotClass: 'bg-blue-500' },
  { value: 'mid', label: 'Mid-Level Engineer', years: '3–7 yrs', color: 'bg-cyan-500', colorClass: 'bg-cyan-100 text-cyan-700 border-cyan-300', dotClass: 'bg-cyan-500' },
  { value: 'senior', label: 'Senior Engineer', years: '7–15 yrs', color: 'bg-green-500', colorClass: 'bg-green-100 text-green-700 border-green-300', dotClass: 'bg-green-500' },
  { value: 'lead', label: 'Lead Engineer', years: '12–20 yrs', color: 'bg-purple-500', colorClass: 'bg-purple-100 text-purple-700 border-purple-300', dotClass: 'bg-purple-500' },
  { value: 'principal', label: 'Principal Engineer', years: '18+ yrs', color: 'bg-orange-500', colorClass: 'bg-orange-100 text-orange-700 border-orange-300', dotClass: 'bg-orange-500' },
];

const TECHNICAL_SKILLS_CATALOG = [
  'HYSYS', 'AspenPlus', 'PDMS', 'AVEVA E3D', 'Smart Plant P&ID',
  'AutoCAD Plant 3D', 'CAESAR II', 'ETAP', 'AVEVA Instrumentation',
  'COMOS', 'HTRI', 'FLARENET', 'PIPESIM', 'OLGA', 'Microsoft Project',
  'Primavera P6', 'SAP PM', 'HAZOP Leadership', 'SIL Assessment',
  'Risk-Based Inspection', 'Front End Loading (FEL)', 'Rotating Equipment',
];

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

const LANGUAGES = [
  'English', 'Arabic', 'French', 'Spanish', 'German', 'Russian',
  'Mandarin', 'Hindi', 'Urdu', 'Tagalog', 'Portuguese',
];

const AVAILABILITY_STATUSES = [
  { value: 'available', label: 'Available', badgeClass: 'bg-green-500', bgClass: 'bg-green-50 border-green-300', textClass: 'text-green-700', desc: 'Ready for new assignments' },
  { value: 'partial', label: 'Partially Available', badgeClass: 'bg-yellow-500', bgClass: 'bg-yellow-50 border-yellow-300', textClass: 'text-yellow-700', desc: 'Limited bandwidth available' },
  { value: 'busy', label: 'Fully Committed', badgeClass: 'bg-red-500', bgClass: 'bg-red-50 border-red-300', textClass: 'text-red-700', desc: 'At full project capacity' },
  { value: 'on_leave', label: 'On Leave', badgeClass: 'bg-gray-400', bgClass: 'bg-gray-50 border-gray-300', textClass: 'text-gray-600', desc: 'Temporarily unavailable' },
];

const PROJECT_TYPES = [
  'Greenfield Development', 'Brownfield Modification', 'Conceptual Study',
  'Feasibility Study', 'FEED', 'Detailed Engineering', 'EPC',
  'Construction Support', 'Commissioning & Start-up', 'Maintenance Engineering', 'Decommissioning',
];

const PROJECT_ROLES = [
  'Lead Process Engineer', 'Process Engineer', 'Lead Piping Engineer', 'Piping Engineer',
  'Lead Instrument Engineer', 'Instrument Engineer', 'Lead Electrical Engineer', 'Electrical Engineer',
  'Lead Mechanical Engineer', 'Mechanical Engineer', 'Civil / Structural Engineer',
  'Safety / HSE Lead', 'Project Manager', 'Project Engineer', 'Document Controller',
  'Commissioning Engineer', 'Materials & Corrosion Engineer', 'Cost Estimator',
];

const PROJECT_ASSIGNMENT_STATUSES = [
  { value: 'active', label: 'Active', bgClass: 'bg-green-100 text-green-700', dotClass: 'bg-green-500' },
  { value: 'on_hold', label: 'On Hold', bgClass: 'bg-yellow-100 text-yellow-700', dotClass: 'bg-yellow-500' },
  { value: 'completing', label: 'Completing', bgClass: 'bg-blue-100 text-blue-700', dotClass: 'bg-blue-500' },
  { value: 'completed', label: 'Completed', bgClass: 'bg-gray-100 text-gray-500', dotClass: 'bg-gray-400' },
];

const DEFAULT_PROJECT = { 
  id: Date.now(), 
  name: '', 
  role: '', 
  allocation: 50, 
  start_date: '', 
  end_date: '', 
  status: 'active', 
  client: '', 
  location: '' 
};

const ProfileNew = () => {
  const dispatch = useDispatch();
  const { user } = useSelector((s) => s.auth);

  const [activeSection, setActiveSection] = useState('personal');
  const [isLoading, setIsLoading] = useState(false);
  const [isFetching, setIsFetching] = useState(true);

  // Form data
  const [formData, setFormData] = useState({
    first_name: '', last_name: '', phone: '', bio: '',
    location: '', department: '', job_title: '', manager_id: '',
  });

  // Photo
  const [photoPreview, setPhotoPreview] = useState(null);
  const [selectedFile, setSelectedFile] = useState(null);
  const [uploadProgress, setUploadProgress] = useState(0);

  // Managers list
  const [managers, setManagers] = useState([]);

  // Engineering profile
  const [ep, setEp] = useState({
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
  });

  // Skill entry
  const [selectedSkill, setSelectedSkill] = useState('');
  const [skillProficiency, setSkillProficiency] = useState(3);

  // Certification entry
  const [newCert, setNewCert] = useState({ name: '', issuer: '', year: '', expiry_date: '' });
  const [showCertForm, setShowCertForm] = useState(false);

  // Project entry
  const [newProject, setNewProject] = useState(DEFAULT_PROJECT);
  const [showProjectForm, setShowProjectForm] = useState(false);

  // Fetch profile
  useEffect(() => { fetchProfile(); fetchManagers(); }, []);

  const fetchProfile = async () => {
    try {
      setIsFetching(true);
      const token = localStorage.getItem('radai_access_token') || localStorage.getItem('access');
      const res = await fetch(`${API_BASE_URL}/rbac/users/me/`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error('Failed to fetch profile');
      const data = await res.json();
      
      console.log('✅ Profile data loaded:', data);
      
      setFormData({
        first_name: data.user?.first_name || '',
        last_name: data.user?.last_name || '',
        phone: data.phone || '',
        bio: data.bio || '',
        location: data.location || '',
        department: data.department || '',
        job_title: data.job_title || '',
        manager_id: data.manager_detail?.id || '',
      });
      
      console.log('✅ Current manager:', data.manager_detail);
      
      if (data.profile_photo) setPhotoPreview(data.profile_photo);
      const saved = data.engineer_profile || {};
      setEp({
        expertise_level: saved.expertise_level || '',
        years_experience: saved.years_experience || '',
        engineering_disciplines: saved.engineering_disciplines || [],
        technical_skills: saved.technical_skills || [],
        languages: saved.languages || [],
        certifications: saved.certifications || [],
        availability_status: saved.availability_status || 'available',
        availability_percentage: saved.availability_percentage || 100,
        preferred_project_types: saved.preferred_project_types || [],
        max_concurrent_projects: saved.max_concurrent_projects || 2,
        next_available_date: saved.next_available_date || '',
        current_projects: saved.current_projects || [],
      });
    } catch (err) {
      console.error('❌ Profile fetch error:', err);
      toast.error('Failed to load profile');
    } finally {
      setIsFetching(false);
    }
  };

  const fetchManagers = async () => {
    const token = localStorage.getItem('radai_access_token') || localStorage.getItem('access');
    try {
      const res = await fetch(`${API_BASE_URL}/rbac/users/engineers/`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      
      if (!res.ok) {
        console.error('Failed to fetch managers:', res.status);
        return;
      }
      
      const data = await res.json();
      console.log('✅ Managers fetched:', data);
      
      // Backend returns { engineers: [...], count: N }
      const engineersList = data.engineers || [];
      setManagers(engineersList);
      console.log(`✅ Loaded ${engineersList.length} potential managers`);
    } catch (error) {
      console.error('Error fetching managers:', error);
      toast.error('Failed to load managers list');
    }
  };

  const handlePhotoSelect = (e) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 5 * 1024 * 1024) {
        toast.error('Photo must be less than 5MB');
        return;
      }
      setSelectedFile(file);
      setPhotoPreview(URL.createObjectURL(file));
    }
  };

  const saveProfile = async () => {
    setIsLoading(true);
    setUploadProgress(0);
    try {
      const token = localStorage.getItem('radai_access_token') || localStorage.getItem('access');
      const fd = new FormData();
      
      Object.entries(formData).forEach(([k, v]) => {
        if (k === 'manager_id') { if (v) fd.append(k, v); return; }
        if (v !== undefined) fd.append(k, v);
      });
      
      if (selectedFile) { 
        fd.append('profile_photo', selectedFile); 
        setUploadProgress(40); 
      }

      // Add engineering profile
      fd.append('engineer_profile', JSON.stringify(ep));
      
      setUploadProgress(60);
      
      const res = await fetch(`${API_BASE_URL}/rbac/users/me/`, {
        method: 'PATCH',
        headers: { Authorization: `Bearer ${token}` },
        body: fd,
      });
      
      setUploadProgress(80);
      
      if (!res.ok) {
        const e = await res.json();
        throw new Error(e.error || 'Update failed');
      }
      
      const updated = await res.json();
      setUploadProgress(100);
      
      // Update Redux store
      dispatch(updateUser({
        first_name: updated.user?.first_name,
        last_name: updated.user?.last_name,
      }));
      
      toast.success('Profile updated successfully!');
      setSelectedFile(null);
      setUploadProgress(0);
    } catch (err) {
      toast.error(err.message || 'Failed to update profile');
    } finally {
      setIsLoading(false);
    }
  };

  const selectedDept = DEPARTMENTS.find(d => d.value === formData.department);
  const selectedManager = managers.find(m => m.id === formData.manager_id);
  const selectedLevel = EXPERTISE_LEVELS.find(l => l.value === ep.expertise_level);

  // Helper to get department label from code
  const getDepartmentLabel = (deptCode) => {
    if (!deptCode) return '';
    const dept = DEPARTMENTS.find(d => d.value === deptCode);
    return dept ? dept.label : deptCode;
  };

  // Helper functions for arrays
  const toggleArr = (key, val) => {
    setEp(p => ({
      ...p,
      [key]: p[key].includes(val) ? p[key].filter(x => x !== val) : [...p[key], val]
    }));
  };

  const addSkill = () => {
    if (!selectedSkill) return;
    const exists = ep.technical_skills.some(s => s.name === selectedSkill);
    if (exists) {
      toast.warning('Skill already added');
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
    setEp(p => ({ ...p, technical_skills: p.technical_skills.filter(s => s.name !== name) }));
  };

  const addCertification = () => {
    if (!newCert.name) {
      toast.warning('Please enter certification name');
      return;
    }
    setEp(p => ({
      ...p,
      certifications: [...p.certifications, { ...newCert, id: Date.now() }]
    }));
    setNewCert({ name: '', issuer: '', year: '', expiry_date: '' });
    setShowCertForm(false);
  };

  const removeCertification = (id) => {
    setEp(p => ({ ...p, certifications: p.certifications.filter(c => c.id !== id) }));
  };

  const addProject = () => {
    if (!newProject.name || !newProject.role) {
      toast.warning('Please fill in project name and your role');
      return;
    }
    setEp(p => ({
      ...p,
      current_projects: [...p.current_projects, { ...newProject, id: Date.now() }]
    }));
    setNewProject(DEFAULT_PROJECT);
    setShowProjectForm(false);
  };

  const removeProject = (id) => {
    setEp(p => ({ ...p, current_projects: p.current_projects.filter(pr => pr.id !== id) }));
  };

  if (isFetching) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader className="w-8 h-8 animate-spin text-blue-600" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 via-blue-50 to-purple-50 py-8 px-4">
      <div className="max-w-7xl mx-auto">
        
        {/* ═══════════════════════════════════════════════════════════════ */}
        {/* HEADER CARD */}
        {/* ═══════════════════════════════════════════════════════════════ */}
        <div className="bg-white rounded-3xl shadow-2xl overflow-hidden mb-6 border border-gray-100">
          <div className="h-32 bg-gradient-to-r from-blue-600 via-purple-600 to-pink-600 relative">
            <div className="absolute inset-0 bg-black/10"></div>
            <div className="absolute -bottom-16 left-8 flex items-end gap-6">
              {/* Profile Photo */}
              <div className="relative group">
                <div className="w-32 h-32 rounded-2xl bg-white p-1.5 shadow-xl">
                  {photoPreview ? (
                    <img src={photoPreview} alt="Profile" 
                      className="w-full h-full rounded-xl object-cover" />
                  ) : (
                    <div className="w-full h-full rounded-xl bg-gradient-to-br from-blue-500 to-purple-500 flex items-center justify-center text-white text-4xl font-bold">
                      {formData.first_name?.[0]}{formData.last_name?.[0]}
                    </div>
                  )}
                </div>
                <label className="absolute bottom-0 right-0 bg-blue-600 hover:bg-blue-700 text-white p-2.5 rounded-xl cursor-pointer shadow-lg transition-all hover:scale-110">
                  <Camera className="w-5 h-5" />
                  <input type="file" accept="image/*" onChange={handlePhotoSelect} className="hidden" />
                </label>
              </div>
              
              {/* Name & Title */}
              <div className="pb-4">
                <h1 className="text-3xl font-bold text-gray-900">
                  {formData.first_name} {formData.last_name}
                </h1>
                <div className="flex items-center gap-3 mt-2">
                  {formData.job_title && (
                    <span className="flex items-center gap-2 text-gray-700 font-medium bg-white/90 backdrop-blur-sm px-3 py-1 rounded-lg shadow-sm">
                      <Briefcase className="w-4 h-4" />
                      {formData.job_title}
                    </span>
                  )}
                  {selectedDept && (
                    <span className="flex items-center gap-2 text-gray-700 bg-white/90 backdrop-blur-sm px-3 py-1 rounded-lg shadow-sm">
                      <span>{selectedDept.icon}</span>
                      {selectedDept.label}
                    </span>
                  )}
                  {selectedLevel && (
                    <span className={`${selectedLevel.color} text-white px-3 py-1 rounded-lg shadow-sm text-sm font-semibold`}>
                      {selectedLevel.label}
                    </span>
                  )}
                  {selectedManager && (
                    <span className="flex items-center gap-2 text-purple-700 bg-purple-50 backdrop-blur-sm px-3 py-1 rounded-lg shadow-sm border border-purple-200">
                      <Users className="w-4 h-4" />
                      Reports to {selectedManager.name.split(' ')[0]}
                    </span>
                  )}
                </div>
              </div>
            </div>
          </div>
          
          <div className="pt-20 px-8 pb-6 flex justify-between items-center">
            <div className="flex gap-6">
              {[
                { id: 'personal', label: 'Personal Info', icon: User },
                { id: 'engineering', label: 'Engineering', icon: Briefcase },
                { id: 'certifications', label: 'Certifications', icon: Award },
                { id: 'availability', label: 'Availability', icon: Calendar },
                { id: 'projects', label: 'Projects', icon: FolderOpen },
              ].map(({ id, label, icon: Icon }) => (
                <button
                  key={id}
                  onClick={() => setActiveSection(id)}
                  className={`flex items-center gap-2 px-6 py-3 rounded-xl font-semibold transition-all ${
                    activeSection === id
                      ? 'bg-blue-600 text-white shadow-lg shadow-blue-200'
                      : 'text-gray-600 hover:bg-gray-100'
                  }`}
                >
                  <Icon className="w-5 h-5" />
                  {label}
                </button>
              ))}
            </div>
            
            <button
              onClick={saveProfile}
              disabled={isLoading}
              className="flex items-center gap-2 bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-700 hover:to-emerald-700 text-white px-8 py-3 rounded-xl font-semibold shadow-lg hover:shadow-xl transition-all disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isLoading ? (
                <>
                  <Loader className="w-5 h-5 animate-spin" />
                  Saving... {uploadProgress > 0 && `${uploadProgress}%`}
                </>
              ) : (
                <>
                  <Save className="w-5 h-5" />
                  Save Changes
                </>
              )}
            </button>
          </div>
        </div>

        {/* ═══════════════════════════════════════════════════════════════ */}
        {/* PERSONAL INFO SECTION */}
        {/* ═══════════════════════════════════════════════════════════════ */}
        {activeSection === 'personal' && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            
            {/* BASIC INFORMATION */}
            <div className="lg:col-span-2 bg-white rounded-2xl shadow-xl p-8 border border-gray-100">
              <h2 className="text-2xl font-bold text-gray-900 mb-6 flex items-center gap-3">
                <div className="w-10 h-10 bg-blue-100 rounded-xl flex items-center justify-center">
                  <User className="w-5 h-5 text-blue-600" />
                </div>
                Basic Information
              </h2>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">First Name</label>
                  <input
                    type="text"
                    value={formData.first_name}
                    onChange={e => setFormData(p => ({ ...p, first_name: e.target.value }))}
                    className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:border-blue-500 focus:ring-4 focus:ring-blue-100 transition-all"
                    placeholder="First name"
                  />
                </div>
                
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">Last Name</label>
                  <input
                    type="text"
                    value={formData.last_name}
                    onChange={e => setFormData(p => ({ ...p, last_name: e.target.value }))}
                    className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:border-blue-500 focus:ring-4 focus:ring-blue-100 transition-all"
                    placeholder="Last name"
                  />
                </div>
                
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">Email Address</label>
                  <div className="relative">
                    <Mail className="absolute left-4 top-4 w-5 h-5 text-gray-400" />
                    <input
                      type="email"
                      value={user?.email || ''}
                      disabled
                      className="w-full pl-12 pr-4 py-3 border-2 border-gray-200 rounded-xl bg-gray-50 text-gray-500 cursor-not-allowed"
                    />
                  </div>
                  <p className="text-xs text-gray-500 mt-1">Email cannot be changed</p>
                </div>
                
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">Phone Number</label>
                  <div className="relative">
                    <Phone className="absolute left-4 top-4 w-5 h-5 text-gray-400" />
                    <input
                      type="tel"
                      value={formData.phone}
                      onChange={e => setFormData(p => ({ ...p, phone: e.target.value }))}
                      className="w-full pl-12 pr-4 py-3 border-2 border-gray-200 rounded-xl focus:border-blue-500 focus:ring-4 focus:ring-blue-100 transition-all"
                      placeholder="+971 50 123 4567"
                    />
                  </div>
                </div>
                
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">Location</label>
                  <div className="relative">
                    <MapPin className="absolute left-4 top-4 w-5 h-5 text-gray-400" />
                    <input
                      type="text"
                      value={formData.location}
                      onChange={e => setFormData(p => ({ ...p, location: e.target.value }))}
                      className="w-full pl-12 pr-4 py-3 border-2 border-gray-200 rounded-xl focus:border-blue-500 focus:ring-4 focus:ring-blue-100 transition-all"
                      placeholder="Abu Dhabi, UAE"
                    />
                  </div>
                </div>
                
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">Job Title</label>
                  <div className="relative">
                    <Briefcase className="absolute left-4 top-4 w-5 h-5 text-gray-400" />
                    <input
                      type="text"
                      value={formData.job_title}
                      onChange={e => setFormData(p => ({ ...p, job_title: e.target.value }))}
                      className="w-full pl-12 pr-4 py-3 border-2 border-gray-200 rounded-xl focus:border-blue-500 focus:ring-4 focus:ring-blue-100 transition-all"
                      placeholder="Senior Process Engineer"
                    />
                  </div>
                </div>
                
                <div className="md:col-span-2">
                  <label className="block text-sm font-semibold text-gray-700 mb-2">Professional Bio</label>
                  <textarea
                    value={formData.bio}
                    onChange={e => setFormData(p => ({ ...p, bio: e.target.value }))}
                    rows={4}
                    maxLength={500}
                    className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:border-blue-500 focus:ring-4 focus:ring-blue-100 transition-all resize-none"
                    placeholder="Brief professional summary — experience, expertise, notable achievements…"
                  />
                  <p className="text-xs text-gray-500 mt-1 text-right">{formData.bio.length}/500</p>
                </div>
              </div>
            </div>

            {/* ORGANIZATION CARD */}
            <div className="space-y-6">
              
              {/* DEPARTMENT */}
              <div className="bg-gradient-to-br from-blue-50 to-purple-50 rounded-2xl shadow-xl p-6 border-2 border-blue-100">
                <h3 className="text-lg font-bold text-gray-900 mb-4 flex items-center gap-2">
                  <Building2 className="w-5 h-5 text-blue-600" />
                  Department
                </h3>
                <select
                  value={formData.department}
                  onChange={e => setFormData(p => ({ ...p, department: e.target.value }))}
                  className="w-full px-4 py-3 border-2 border-blue-200 rounded-xl focus:border-blue-500 focus:ring-4 focus:ring-blue-100 transition-all bg-white cursor-pointer font-medium"
                >
                  <option value="">Select department...</option>
                  {DEPARTMENTS.map(dept => (
                    <option key={dept.value} value={dept.value}>
                      {dept.icon} {dept.label}
                    </option>
                  ))}
                </select>
                {selectedDept && (
                  <div className="mt-3 p-3 bg-white rounded-xl border border-blue-200">
                    <p className="text-sm text-blue-700 font-semibold flex items-center gap-2">
                      <Check className="w-4 h-4" />
                      {selectedDept.icon} {selectedDept.label}
                    </p>
                  </div>
                )}
              </div>

              {/* REPORTING MANAGER */}
              <div className="bg-gradient-to-br from-purple-50 to-pink-50 rounded-2xl shadow-xl p-6 border-2 border-purple-100">
                <h3 className="text-lg font-bold text-gray-900 mb-4 flex items-center gap-2">
                  <Users className="w-5 h-5 text-purple-600" />
                  Reporting Manager
                </h3>
                <select
                  value={formData.manager_id || ''}
                  onChange={e => setFormData(p => ({ ...p, manager_id: e.target.value }))}
                  className="w-full px-4 py-3 border-2 border-purple-200 rounded-xl focus:border-purple-500 focus:ring-4 focus:ring-purple-100 transition-all bg-white cursor-pointer font-medium"
                >
                  <option value="">No reporting manager assigned</option>
                  {managers.length === 0 ? (
                    <option disabled>Loading managers...</option>
                  ) : (
                    managers.map(m => (
                      <option key={m.id} value={m.id}>
                        {m.name}
                        {m.job_title && ` — ${m.job_title}`}
                        {m.department && ` (${getDepartmentLabel(m.department)})`}
                      </option>
                    ))
                  )}
                </select>
                <p className="text-xs text-gray-500 mt-2">
                  {managers.length > 0 
                    ? `${managers.length} manager${managers.length !== 1 ? 's' : ''} available` 
                    : 'Loading managers from database...'}
                </p>
                {selectedManager && (
                  <div className="mt-3 p-4 bg-white rounded-xl border border-purple-200">
                    <p className="text-sm text-gray-600 mb-1">Reporting to</p>
                    <p className="font-bold text-purple-700 flex items-center gap-2">
                      <ChevronRight className="w-4 h-4" />
                      {selectedManager.name}
                    </p>
                    {selectedManager.job_title && (
                      <p className="text-sm text-gray-600 mt-1 flex items-center gap-1">
                        <Briefcase className="w-3 h-3" />
                        {selectedManager.job_title}
                      </p>
                    )}
                    {selectedManager.department && (
                      <p className="text-sm text-gray-600 mt-1 flex items-center gap-1">
                        <Building2 className="w-3 h-3" />
                        {getDepartmentLabel(selectedManager.department)}
                      </p>
                    )}
                    {selectedManager.email && (
                      <p className="text-xs text-gray-500 mt-2 flex items-center gap-1">
                        <Mail className="w-3 h-3" />
                        {selectedManager.email}
                      </p>
                    )}
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* ═══════════════════════════════════════════════════════════════ */}
        {/* ENGINEERING PROFILE SECTION */}
        {/* ═══════════════════════════════════════════════════════════════ */}
        {activeSection === 'engineering' && (
          <div className="bg-white rounded-2xl shadow-xl p-8 border border-gray-100 space-y-8">
            <h2 className="text-2xl font-bold text-gray-900 mb-6 flex items-center gap-3">
              <div className="w-10 h-10 bg-purple-100 rounded-xl flex items-center justify-center">
                <Briefcase className="w-5 h-5 text-purple-600" />
              </div>
              Engineering Competency Profile
            </h2>
            
            {/* Career Level */}
            <div>
              <h3 className="text-base font-semibold text-gray-900 mb-3">Career Level</h3>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                {EXPERTISE_LEVELS.map(lvl => (
                  <button
                    key={lvl.value}
                    type="button"
                    onClick={() => setEp(p => ({ ...p, expertise_level: lvl.value }))}
                    className={`p-4 rounded-xl border-2 text-left transition-all ${
                      ep.expertise_level === lvl.value
                        ? `${lvl.colorClass} shadow-md`
                        : 'bg-gray-50 border-gray-200 hover:border-gray-300'
                    }`}
                  >
                    <div className={`w-2.5 h-2.5 rounded-full mb-2 ${lvl.dotClass}`} />
                    <p className="text-sm font-bold text-gray-900">{lvl.label}</p>
                    <p className="text-xs text-gray-500 mt-0.5">{lvl.years}</p>
                  </button>
                ))}
              </div>
              <div className="max-w-xs mt-4">
                <label className="block text-sm font-semibold text-gray-700 mb-2">Years of Experience</label>
                <input
                  type="number"
                  value={ep.years_experience}
                  onChange={e => setEp(p => ({ ...p, years_experience: e.target.value }))}
                  className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:border-purple-500 focus:ring-4 focus:ring-purple-100 transition-all"
                  placeholder="e.g. 12"
                  min="0"
                  max="50"
                />
              </div>
            </div>

            {/* Disciplines */}
            <div>
              <h3 className="text-base font-semibold text-gray-900 mb-3">Engineering Disciplines</h3>
              <div className="flex flex-wrap gap-2">
                {ENGINEERING_DISCIPLINES.map(d => (
                  <button
                    key={d}
                    type="button"
                    onClick={() => toggleArr('engineering_disciplines', d)}
                    className={`px-4 py-2 rounded-full border text-sm font-medium transition-all ${
                      ep.engineering_disciplines.includes(d)
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

            {/* Technical Skills */}
            <div>
              <h3 className="text-base font-semibold text-gray-900 mb-3">Technical Skills & Software</h3>
              <div className="flex gap-2 mb-4">
                <select
                  value={selectedSkill}
                  onChange={e => setSelectedSkill(e.target.value)}
                  className="flex-1 px-3 py-2.5 border-2 border-gray-200 rounded-xl focus:border-purple-500 focus:ring-4 focus:ring-purple-100"
                >
                  <option value="">Select a skill…</option>
                  {TECHNICAL_SKILLS_CATALOG.filter(s => !ep.technical_skills.some(ts => ts.name === s)).map(s => (
                    <option key={s} value={s}>{s}</option>
                  ))}
                </select>
                <div className="flex items-center gap-0.5 bg-gray-50 border-2 border-gray-200 rounded-xl px-3">
                  {[1, 2, 3, 4, 5].map(n => (
                    <button key={n} type="button" onClick={() => setSkillProficiency(n)}>
                      <Star className={`w-4 h-4 transition-colors ${n <= skillProficiency ? 'text-yellow-400 fill-yellow-400' : 'text-gray-300'}`} />
                    </button>
                  ))}
                </div>
                <button
                  type="button"
                  onClick={addSkill}
                  className="px-4 py-2 bg-purple-600 text-white rounded-xl text-sm font-semibold hover:bg-purple-700 flex items-center gap-1"
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
                    <button
                      onClick={() => removeSkill(sk.name)}
                      className="text-gray-300 hover:text-red-500 ml-0.5"
                    >
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
              <h3 className="text-base font-semibold text-gray-900 mb-3 flex items-center gap-2">
                <Globe className="w-4 h-4 text-gray-400" /> Languages
              </h3>
              <div className="flex flex-wrap gap-2">
                {LANGUAGES.map(l => (
                  <button
                    key={l}
                    type="button"
                    onClick={() => toggleArr('languages', l)}
                    className={`px-3 py-1.5 rounded-full border text-sm font-medium transition-all ${
                      ep.languages.includes(l)
                        ? 'bg-teal-600 text-white border-teal-600'
                        : 'bg-white text-gray-600 border-gray-200 hover:border-teal-300'
                    }`}
                  >
                    {l}
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* ═══════════════════════════════════════════════════════════════ */}
        {/* CERTIFICATIONS SECTION */}
        {/* ═══════════════════════════════════════════════════════════════ */}
        {activeSection === 'certifications' && (
          <div className="bg-white rounded-2xl shadow-xl p-8 border border-gray-100">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-2xl font-bold text-gray-900 flex items-center gap-3">
                <div className="w-10 h-10 bg-amber-100 rounded-xl flex items-center justify-center">
                  <Award className="w-5 h-5 text-amber-600" />
                </div>
                Professional Certifications
              </h2>
              <button
                onClick={() => setShowCertForm(v => !v)}
                className="flex items-center gap-2 px-4 py-2 bg-amber-600 text-white rounded-xl font-semibold hover:bg-amber-700 transition-all"
              >
                <Plus className="w-4 h-4" />
                Add Certification
              </button>
            </div>

            {/* Add certification form */}
            {showCertForm && (
              <div className="bg-amber-50 border border-amber-200 rounded-xl p-6 mb-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="md:col-span-2">
                    <label className="block text-sm font-semibold text-gray-700 mb-2">Certification Name</label>
                    <select
                      value={newCert.name}
                      onChange={e => setNewCert(p => ({ ...p, name: e.target.value }))}
                      className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:border-amber-500 focus:ring-4 focus:ring-amber-100"
                    >
                      <option value="">Select or type custom...</option>
                      {CERTIFICATION_OPTIONS.map(cert => (
                        <option key={cert} value={cert}>{cert}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">Issuing Organization</label>
                    <input
                      value={newCert.issuer}
                      onChange={e => setNewCert(p => ({ ...p, issuer: e.target.value }))}
                      className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:border-amber-500 focus:ring-4 focus:ring-amber-100"
                      placeholder="e.g., PMI, BSI"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">Year Obtained</label>
                    <input
                      type="number"
                      value={newCert.year}
                      onChange={e => setNewCert(p => ({ ...p, year: e.target.value }))}
                      className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:border-amber-500 focus:ring-4 focus:ring-amber-100"
                      placeholder="2023"
                      min="1990"
                      max="2030"
                    />
                  </div>
                </div>
                <div className="flex gap-3 mt-4">
                  <button
                    onClick={addCertification}
                    className="px-5 py-2 bg-amber-600 text-white rounded-xl font-semibold hover:bg-amber-700"
                  >
                    <Check className="w-4 h-4 inline mr-1" /> Add
                  </button>
                  <button
                    onClick={() => {
                      setShowCertForm(false);
                      setNewCert({ name: '', issuer: '', year: '', expiry_date: '' });
                    }}
                    className="px-5 py-2 bg-white border border-gray-200 text-gray-600 rounded-xl font-semibold hover:bg-gray-50"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            )}

            {/* Certifications list */}
            {ep.certifications.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16 text-gray-300">
                <Award className="w-16 h-16 mb-4" />
                <p className="text-base font-semibold text-gray-400">No certifications added yet</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {ep.certifications.map(cert => (
                  <div key={cert.id} className="bg-gradient-to-br from-amber-50 to-orange-50 border border-amber-200 rounded-xl p-5">
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <h4 className="font-bold text-gray-900 mb-1">{cert.name}</h4>
                        {cert.issuer && <p className="text-sm text-gray-600">{cert.issuer}</p>}
                        {cert.year && <p className="text-xs text-gray-500 mt-1">Obtained: {cert.year}</p>}
                      </div>
                      <button
                        onClick={() => removeCertification(cert.id)}
                        className="text-gray-300 hover:text-red-500"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* ═══════════════════════════════════════════════════════════════ */}
        {/* AVAILABILITY SECTION */}
        {/* ═══════════════════════════════════════════════════════════════ */}
        {activeSection === 'availability' && (
          <div className="bg-white rounded-2xl shadow-xl p-8 border border-gray-100 space-y-8">
            <h2 className="text-2xl font-bold text-gray-900 mb-6 flex items-center gap-3">
              <div className="w-10 h-10 bg-green-100 rounded-xl flex items-center justify-center">
                <Calendar className="w-5 h-5 text-green-600" />
              </div>
              Availability & Capacity
            </h2>

            {/* Status cards */}
            <div>
              <h3 className="text-base font-semibold text-gray-900 mb-3">Current Availability</h3>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                {AVAILABILITY_STATUSES.map(a => (
                  <button
                    key={a.value}
                    type="button"
                    onClick={() => setEp(p => ({ ...p, availability_status: a.value }))}
                    className={`p-4 rounded-xl border-2 text-left transition-all ${
                      ep.availability_status === a.value ? `${a.bgClass} shadow-md` : 'bg-white border-gray-200 hover:border-gray-300'
                    }`}
                  >
                    <div className={`w-3 h-3 rounded-full mb-2.5 ${a.badgeClass}`} />
                    <p className={`text-sm font-bold ${a.textClass}`}>{a.label}</p>
                    <p className="text-xs text-gray-400 mt-0.5 leading-tight">{a.desc}</p>
                  </button>
                ))}
              </div>
            </div>

            {/* Bandwidth slider */}
            <div>
              <h3 className="text-base font-semibold text-gray-900 mb-1">
                Bandwidth Available: <span className="text-blue-600 font-bold">{ep.availability_percentage}%</span>
              </h3>
              <p className="text-xs text-gray-400 mb-3">What percentage of your time can be allocated to new projects?</p>
              <div className="flex items-center gap-4">
                <span className="text-xs text-gray-400 w-5">0%</span>
                <input
                  type="range"
                  min="0"
                  max="100"
                  step="5"
                  value={ep.availability_percentage}
                  onChange={e => setEp(p => ({ ...p, availability_percentage: Number(e.target.value) }))}
                  className="flex-1 accent-blue-600 cursor-pointer"
                />
                <span className="text-xs text-gray-400 w-8 text-right">100%</span>
              </div>
              <div className="mt-2 w-full bg-gray-100 rounded-full h-2 overflow-hidden">
                <div
                  className="bg-blue-500 h-2 rounded-full transition-all"
                  style={{ width: `${ep.availability_percentage}%` }}
                />
              </div>
            </div>

            {/* Max concurrent projects */}
            <div>
              <h3 className="text-base font-semibold text-gray-900 mb-3">Maximum Concurrent Projects</h3>
              <div className="flex items-center gap-4">
                <button
                  onClick={() => setEp(p => ({ ...p, max_concurrent_projects: Math.max(1, p.max_concurrent_projects - 1) }))}
                  className="w-10 h-10 rounded-full border-2 border-gray-200 bg-white flex items-center justify-center text-lg font-bold text-gray-600 hover:bg-gray-50 transition-all"
                >
                  −
                </button>
                <span className="text-3xl font-bold text-gray-900 w-10 text-center">{ep.max_concurrent_projects}</span>
                <button
                  onClick={() => setEp(p => ({ ...p, max_concurrent_projects: Math.min(10, p.max_concurrent_projects + 1) }))}
                  className="w-10 h-10 rounded-full border-2 border-gray-200 bg-white flex items-center justify-center text-lg font-bold text-gray-600 hover:bg-gray-50 transition-all"
                >
                  +
                </button>
                <span className="text-sm text-gray-500">projects at once</span>
              </div>
            </div>

            {/* Project types */}
            <div>
              <h3 className="text-base font-semibold text-gray-900 mb-3">Preferred Project Types</h3>
              <div className="flex flex-wrap gap-2">
                {PROJECT_TYPES.map(pt => (
                  <button
                    key={pt}
                    type="button"
                    onClick={() => toggleArr('preferred_project_types', pt)}
                    className={`px-3 py-1.5 rounded-full border text-sm font-medium transition-all ${
                      ep.preferred_project_types.includes(pt)
                        ? 'bg-purple-600 text-white border-purple-600'
                        : 'bg-white text-gray-600 border-gray-200 hover:border-purple-300'
                    }`}
                  >
                    {pt}
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* ═══════════════════════════════════════════════════════════════ */}
        {/* PROJECTS SECTION */}
        {/* ═══════════════════════════════════════════════════════════════ */}
        {activeSection === 'projects' && (
          <div className="bg-white rounded-2xl shadow-xl p-8 border border-gray-100">
            <div className="flex items-center justify-between mb-6">
              <div>
                <h2 className="text-2xl font-bold text-gray-900 flex items-center gap-3">
                  <div className="w-10 h-10 bg-indigo-100 rounded-xl flex items-center justify-center">
                    <FolderOpen className="w-5 h-5 text-indigo-600" />
                  </div>
                  Current Project Assignments
                </h2>
                <p className="text-xs text-gray-400 mt-1">Let management know what you are actively working on</p>
              </div>
              <button
                onClick={() => setShowProjectForm(v => !v)}
                className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-xl font-semibold hover:bg-indigo-700 transition-all"
              >
                <Plus className="w-4 h-4" />
                Add Project
              </button>
            </div>

            {/* Bandwidth summary */}
            {(ep.current_projects || []).length > 0 && (() => {
              const totalAlloc = (ep.current_projects || []).reduce((s, p) => s + Number(p.allocation || 0), 0);
              const active = (ep.current_projects || []).filter(p => p.status === 'active').length;
              return (
                <div className="grid grid-cols-2 md:grid-cols-3 gap-3 mb-6">
                  <div className="bg-blue-50 border border-blue-100 rounded-xl p-4 text-center">
                    <p className="text-2xl font-extrabold text-blue-600">{active}</p>
                    <p className="text-xs text-blue-500 font-medium mt-0.5">Active Projects</p>
                  </div>
                  <div className={`rounded-xl border p-4 text-center ${totalAlloc > 100 ? 'bg-red-50 border-red-200' : 'bg-emerald-50 border-emerald-100'}`}>
                    <p className={`text-2xl font-extrabold ${totalAlloc > 100 ? 'text-red-600' : 'text-emerald-600'}`}>{totalAlloc}%</p>
                    <p className={`text-xs font-medium mt-0.5 ${totalAlloc > 100 ? 'text-red-500' : 'text-emerald-500'}`}>
                      Total Allocation {totalAlloc > 100 ? '⚠ Over 100%' : ''}
                    </p>
                  </div>
                  <div className="bg-gray-50 border border-gray-200 rounded-xl p-4 text-center">
                    <p className="text-2xl font-extrabold text-gray-700">{Math.max(0, 100 - totalAlloc)}%</p>
                    <p className="text-xs text-gray-500 font-medium mt-0.5">Remaining Bandwidth</p>
                  </div>
                </div>
              );
            })()}

            {/* Add project form */}
            {showProjectForm && (
              <div className="bg-indigo-50 border border-indigo-200 rounded-xl p-6 mb-6">
                <h4 className="font-semibold text-indigo-800 text-sm mb-4">New Project Assignment</h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">Project Name *</label>
                    <input
                      value={newProject.name}
                      onChange={e => setNewProject(p => ({ ...p, name: e.target.value }))}
                      className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:border-indigo-500 focus:ring-4 focus:ring-indigo-100"
                      placeholder="e.g. Offshore Platform FEED"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">Client / Company</label>
                    <input
                      value={newProject.client}
                      onChange={e => setNewProject(p => ({ ...p, client: e.target.value }))}
                      className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:border-indigo-500 focus:ring-4 focus:ring-indigo-100"
                      placeholder="e.g. ADNOC, Saudi Aramco"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">Your Role *</label>
                    <select
                      value={newProject.role}
                      onChange={e => setNewProject(p => ({ ...p, role: e.target.value }))}
                      className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:border-indigo-500 focus:ring-4 focus:ring-indigo-100"
                    >
                      <option value="">— Select role —</option>
                      {PROJECT_ROLES.map(r => <option key={r} value={r}>{r}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">
                      Allocation: <span className="text-indigo-600 font-bold">{newProject.allocation}%</span>
                    </label>
                    <input
                      type="range"
                      min="5"
                      max="100"
                      step="5"
                      value={newProject.allocation}
                      onChange={e => setNewProject(p => ({ ...p, allocation: Number(e.target.value) }))}
                      className="w-full accent-indigo-600 cursor-pointer mt-2"
                    />
                  </div>
                </div>
                <div className="flex gap-3 mt-4">
                  <button
                    onClick={addProject}
                    className="px-5 py-2 bg-indigo-600 text-white rounded-xl font-semibold hover:bg-indigo-700"
                  >
                    <Check className="w-4 h-4 inline mr-1" /> Add
                  </button>
                  <button
                    onClick={() => {
                      setShowProjectForm(false);
                      setNewProject(DEFAULT_PROJECT);
                    }}
                    className="px-5 py-2 bg-white border border-gray-200 text-gray-600 rounded-xl font-semibold hover:bg-gray-50"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            )}

            {/* Projects list */}
            {(ep.current_projects || []).length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16 text-gray-300">
                <FolderOpen className="w-16 h-16 mb-4" />
                <p className="text-base font-semibold text-gray-400">No project assignments yet</p>
                <p className="text-sm text-gray-300 mt-1">Click "Add Project" to log your current work</p>
              </div>
            ) : (
              <div className="space-y-4">
                {(ep.current_projects || []).map(pr => {
                  const si = PROJECT_ASSIGNMENT_STATUSES.find(s => s.value === pr.status) || PROJECT_ASSIGNMENT_STATUSES[0];
                  return (
                    <div key={pr.id} className="bg-white border border-gray-100 rounded-xl shadow-sm overflow-hidden">
                      <div className={`h-1 w-full ${si.dotClass}`} />
                      <div className="p-5">
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0 flex-1">
                            <h4 className="font-bold text-gray-900 truncate">{pr.name}</h4>
                            {pr.client && <p className="text-xs text-gray-400 mt-0.5">{pr.client}</p>}
                            {pr.role && <p className="text-sm text-gray-600 mt-1">{pr.role}</p>}
                          </div>
                          <div className="flex items-center gap-2 shrink-0">
                            <span className={`px-2.5 py-0.5 rounded-full text-xs font-semibold flex items-center gap-1 ${si.bgClass}`}>
                              <span className={`w-1.5 h-1.5 rounded-full ${si.dotClass}`} />
                              {si.label}
                            </span>
                            <div className="px-3 py-1 bg-blue-50 border border-blue-100 rounded-full text-xs font-bold text-blue-700">
                              {pr.allocation}%
                            </div>
                            <button
                              onClick={() => removeProject(pr.id)}
                              className="p-1.5 text-gray-300 hover:text-red-500 hover:bg-red-50 rounded-lg transition-all"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default ProfileNew;
