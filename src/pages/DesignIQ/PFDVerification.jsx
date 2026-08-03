import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  Upload, FileText, AlertCircle, CheckCircle, Loader, X, Plus, FolderPlus,
  Package, Edit, Trash2, Download, FileSpreadsheet, Filter, Search,
  ChevronDown, ChevronUp, BarChart2, Layers, RefreshCw, Eye, MessageSquare,
  Cpu, BookOpen, SearchCode, GitMerge, Info, Shield
} from 'lucide-react';
import api from '../../services/api.service';
import { API_TIMEOUT_PFD_VERIFY } from '../../config/api.config';

// â”€â”€â”€ Soft-coded configuration â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

const SEVERITY_CONFIG = {
  critical:    { label: 'Critical',    bg: 'bg-red-100',    text: 'text-red-800',    border: 'border-red-300',    dot: 'bg-red-500',    sort: 4 },
  major:       { label: 'Major',       bg: 'bg-orange-100', text: 'text-orange-800', border: 'border-orange-300', dot: 'bg-orange-500', sort: 3 },
  minor:       { label: 'Minor',       bg: 'bg-yellow-100', text: 'text-yellow-800', border: 'border-yellow-300', dot: 'bg-yellow-500', sort: 2 },
  observation: { label: 'Observation', bg: 'bg-blue-100',   text: 'text-blue-800',   border: 'border-blue-300',   dot: 'bg-blue-400',  sort: 1 },
};

const STATUS_CONFIG = {
  pending:  { label: 'Pending',  bg: 'bg-amber-100',  text: 'text-amber-800'  },
  approved: { label: 'Approved', bg: 'bg-green-100',  text: 'text-green-800'  },
  ignored:  { label: 'Ignored',  bg: 'bg-gray-100',   text: 'text-gray-600'   },
};

const ANALYSIS_STAGES = [
  { id: 1, icon: SearchCode, label: 'Visual Inventory Scan',       desc: 'Cataloguing equipment, streams, title block, notes...' },
  { id: 2, icon: BookOpen,   label: 'Reference Document Extraction',desc: 'Reading process description, equipment data sheets...'  },
  { id: 3, icon: Cpu,        label: 'Deep Systematic Analysis',     desc: 'Applying 42 engineering checks...'                     },
  { id: 4, icon: GitMerge,   label: 'Gap Analysis',                 desc: 'Scanning for missing elements and incomplete data...'   },
];

const REF_DOC_COLORS = {
  blue: 'bg-blue-50 border-blue-200 text-blue-700',
  green: 'bg-green-50 border-green-200 text-green-700',
  purple: 'bg-purple-50 border-purple-200 text-purple-700',
  orange: 'bg-orange-50 border-orange-200 text-orange-700',
  indigo: 'bg-indigo-50 border-indigo-200 text-indigo-700',
  pink: 'bg-pink-50 border-pink-200 text-pink-700',
  teal: 'bg-teal-50 border-teal-200 text-teal-700',
  gray: 'bg-gray-50 border-gray-200 text-gray-700',
};

const PFDVerification = () => {
  // â”€â”€ Config â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  const referenceDocuments = [
    { key: 'bfd',                          label: 'BFD (Block Flow Diagram)',       color: 'blue',   required: false },
    { key: 'process_description',          label: 'Process Description',            color: 'green',  required: true  },
    { key: 'process_design_basis',         label: 'Process Design Basis',           color: 'purple', required: true  },
    { key: 'operation_control_philosophy', label: 'Operation & Control Philosophy', color: 'orange', required: true  },
    { key: 'scope_of_work',                label: 'Scope of Work',                  color: 'indigo', required: true  },
    { key: 'legends_symbols',              label: 'Legends & Symbols',              color: 'pink',   required: true  },
    { key: 'equipment_data_sheet',         label: 'Equipment Data Sheet',           color: 'teal',   required: true  },
    { key: 'other_documents',              label: 'Other Documents',                color: 'gray',   required: false },
  ];

  const requiredRefDocs = referenceDocuments.filter(d => d.required);

  // â”€â”€ Project state â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  const [selectedProject, setSelectedProject]         = useState(null);
  const [projects, setProjects]                       = useState([]);
  const [loadingProjects, setLoadingProjects]         = useState(false);
  const [showCreateModal, setShowCreateModal]         = useState(false);
  const [newProjectName, setNewProjectName]           = useState('');
  const [newProjectDescription, setNewProjectDescription] = useState('');
  const [creatingProject, setCreatingProject]         = useState(false);
  const [showEditModal, setShowEditModal]             = useState(false);
  const [editingProject, setEditingProject]           = useState(null);
  const [editProjectName, setEditProjectName]         = useState('');
  const [editProjectDescription, setEditProjectDescription] = useState('');
  const [updatingProject, setUpdatingProject]         = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm]     = useState(false);
  const [deletingProject, setDeletingProject]         = useState(null);
  const [isDeleting, setIsDeleting]                   = useState(false);

  // â”€â”€ Upload state â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  const [pfdFile, setPfdFile]           = useState(null);
  const [referenceFiles, setReferenceFiles] = useState({});
  const [uploadProgress, setUploadProgress] = useState({});
  const [isUploading, setIsUploading]   = useState(false);
  const [message, setMessage]           = useState({ type: '', text: '' });
  const [drawingNumber, setDrawingNumber] = useState('');
  const [revision, setRevision]         = useState('');
  const [drawingTitle, setDrawingTitle] = useState('');
  const [draggingOver, setDraggingOver] = useState(false);
  const pfdDropRef = useRef(null);

  // â”€â”€ Verification state â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  const [uploadedPFDId, setUploadedPFDId]         = useState(null);
  const [verificationReport, setVerificationReport] = useState(null);
  const [isVerifying, setIsVerifying]             = useState(false);
  const [activeStage, setActiveStage]             = useState(0);
  const [showResults, setShowResults]             = useState(false);
  const stageTimerRef                             = useRef(null);

  // â”€â”€ Results UI state â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  const [selectedIssues, setSelectedIssues]       = useState([]);
  const [updatingIssues, setUpdatingIssues]       = useState(false);
  const [filterSeverity, setFilterSeverity]       = useState('all');
  const [filterCategory, setFilterCategory]       = useState('all');
  const [filterStatus, setFilterStatus]           = useState('all');
  const [searchText, setSearchText]               = useState('');
  const [viewMode, setViewMode]                   = useState('flat');   // 'flat' | 'grouped'
  const [expandedIssue, setExpandedIssue]         = useState(null);
  const [remarkInput, setRemarkInput]             = useState('');
  const [showRemarkModal, setShowRemarkModal]     = useState(false);
  const [pendingAction, setPendingAction]         = useState(null);     // { action, issueIds }

  // â”€â”€ Lifecycle â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  useEffect(() => { fetchProjects(); }, []);
  useEffect(() => () => clearInterval(stageTimerRef.current), []);

  // â”€â”€ Stage animation during analysis â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  const startStageAnimation = () => {
    setActiveStage(1);
    let stage = 1;
    stageTimerRef.current = setInterval(() => {
      stage += 1;
      if (stage > ANALYSIS_STAGES.length) {
        clearInterval(stageTimerRef.current);
      } else {
        setActiveStage(stage);
      }
    }, 28000); // ~28s per pass ~ 112s total, matching real API timing
  };

  const stopStageAnimation = () => {
    clearInterval(stageTimerRef.current);
    setActiveStage(ANALYSIS_STAGES.length + 1); // all complete
  };

  // â”€â”€ Project CRUD â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  const fetchProjects = async () => {
    setLoadingProjects(true);
    try {
      const res = await api.get('/pfd/projects/');
      setProjects(res.data.projects || res.data.results || res.data || []);
    } catch { setMessage({ type: 'error', text: 'Failed to load projects' }); }
    finally { setLoadingProjects(false); }
  };

  const handleCreateProject = async (e) => {
    e.preventDefault();
    if (!newProjectName.trim()) return;
    setCreatingProject(true);
    try {
      const res = await api.post('/pfd/projects/', { name: newProjectName, description: newProjectDescription });
      const proj = res.data.project || res.data;
      setSelectedProject(proj);
      setShowCreateModal(false);
      setNewProjectName(''); setNewProjectDescription('');
      fetchProjects();
      showMsg('success', `Project "${proj.project_name}" created!`);
    } catch (err) {
      showMsg('error', err.response?.data?.message || 'Failed to create project');
    } finally { setCreatingProject(false); }
  };

  const handleUpdateProject = async (e) => {
    e.preventDefault();
    if (!editProjectName.trim()) return;
    setUpdatingProject(true);
    try {
      await api.put(`/pfd/projects/${editingProject.id}/`, {
        project_name: editProjectName, description: editProjectDescription, created_by: editingProject.created_by
      });
      fetchProjects();
      setShowEditModal(false); setEditingProject(null);
      showMsg('success', 'Project updated!');
    } catch (err) {
      showMsg('error', err.response?.data?.message || 'Failed to update project');
    } finally { setUpdatingProject(false); }
  };

  const confirmDelete = async () => {
    if (!deletingProject) return;
    setIsDeleting(true);
    try {
      await api.delete(`/pfd/projects/${deletingProject.id}/`);
      fetchProjects();
      setShowDeleteConfirm(false); setDeletingProject(null);
      showMsg('success', 'Project deleted.');
    } catch (err) {
      showMsg('error', err.response?.data?.message || 'Failed to delete project');
    } finally { setIsDeleting(false); }
  };

  // â”€â”€ File handling â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  const validateFile = (file) => {
    if (!file) return 'No file selected';
    if (file.type !== 'application/pdf') return 'Please select a PDF file';
    if (file.size > 50 * 1024 * 1024) return 'File exceeds 50 MB limit';
    return null;
  };

  const handlePfdFileChange = (file) => {
    const err = validateFile(file);
    if (err) { showMsg('error', err); return; }
    setPfdFile(file);
    showMsg('success', `PFD selected: ${file.name}`);
  };

  const handleReferenceFileChange = (key, file) => {
    const err = validateFile(file);
    if (err) { showMsg('error', err); return; }
    setReferenceFiles(prev => ({ ...prev, [key]: file }));
  };

  const removeFile = (key) => {
    if (key === 'pfd') {
      setPfdFile(null);
      const el = document.getElementById('pfd-upload');
      if (el) el.value = '';
    } else {
      setReferenceFiles(prev => { const n = { ...prev }; delete n[key]; return n; });
      const el = document.getElementById(`ref-${key}`);
      if (el) el.value = '';
    }
  };

  // Drag-and-drop for PFD
  const onDragOver  = useCallback((e) => { e.preventDefault(); setDraggingOver(true);  }, []);
  const onDragLeave = useCallback(()  => setDraggingOver(false), []);
  const onDrop      = useCallback((e) => {
    e.preventDefault(); setDraggingOver(false);
    const file = e.dataTransfer.files[0];
    if (file) handlePfdFileChange(file);
  }, []);

  // â”€â”€ Upload & verify â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!selectedProject) { showMsg('error', 'Please select a project'); return; }
    if (!pfdFile)          { showMsg('error', 'Please upload the PFD document'); return; }
    if (!drawingNumber || !revision || !drawingTitle) {
      showMsg('error', 'Please fill in all drawing fields');
      return;
    }
    setIsUploading(true);
    setUploadProgress({});
    try {
      // 1. Upload reference documents one-by-one to the correct endpoint
      for (const [docType, docFile] of Object.entries(referenceFiles)) {
        const refFd = new FormData();
        refFd.append('file', docFile);
        refFd.append('document_type', docType);
        try {
          await api.post(`/pfd/projects/${selectedProject.id}/upload-reference-doc/`, refFd, {
            headers: { 'Content-Type': 'multipart/form-data' },
          });
        } catch (e) {
          console.warn(`Reference doc ${docType} upload failed:`, e.message);
        }
      }

      // 2. Upload the PFD file with correct field names
      const fd = new FormData();
      fd.append('file', pfdFile);
      fd.append('drawing_number', drawingNumber);
      fd.append('drawing_revision', revision);
      fd.append('drawing_title', drawingTitle);

      const res = await api.post(`/pfd/projects/${selectedProject.id}/upload-pfd/`, fd, {
        headers: { 'Content-Type': 'multipart/form-data' },
        onUploadProgress: (e) =>
          setUploadProgress({ overall: Math.round((e.loaded * 100) / e.total) }),
      });

      const uploadId = res.data.upload?.upload_id || res.data.upload_id;
      if (uploadId) {
        setUploadedPFDId(uploadId);
        showMsg('success', 'PFD uploaded! Starting AI analysis…');
        startVerification(uploadId);
      }
    } catch (err) {
      showMsg('error', err.response?.data?.error || err.response?.data?.message || 'Upload failed');
    } finally { setIsUploading(false); }
  };

  const startVerification = async (uploadId) => {
    setIsVerifying(true);
    startStageAnimation();
    try {
      // SOFT-CODED timeout: controlled via timeout_pfd_verify in config/environments.json
      // (default 600 s — PFD AI multi-pass analysis on large drawings can take 5-8 min)
      const res = await api.post('/pfd/verify/start-verification/', {
        upload_id: uploadId, auto_analyze: true
      }, { timeout: API_TIMEOUT_PFD_VERIFY });
      if (res.data.success) {
        stopStageAnimation();
        setVerificationReport(res.data.report);
        setShowResults(true);
        showMsg('success', `Analysis complete - ${res.data.report.total_issues} findings.`);
      }
    } catch (err) {
      stopStageAnimation();
      showMsg('error', 'Verification failed: ' + (err.response?.data?.error || err.message));
    } finally { setIsVerifying(false); }
  };

  const reAnalyze = () => {
    if (!uploadedPFDId) return;
    setVerificationReport(null);
    setShowResults(false);
    setSelectedIssues([]);
    startVerification(uploadedPFDId);
  };

  // â”€â”€ Issue management â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  const openActionModal = (action, issueIds) => {
    setPendingAction({ action, issueIds });
    setRemarkInput('');
    setShowRemarkModal(true);
  };

  const confirmIssueAction = async () => {
    if (!pendingAction) return;
    const { action, issueIds } = pendingAction;
    setUpdatingIssues(true);
    setShowRemarkModal(false);
    try {
      await api.post(`/pfd/verify/${uploadedPFDId}/update-issues/`, {
        issue_ids: issueIds,
        status:   action === 'approve' ? 'approved' : 'ignored',
        approval: action === 'approve' ? 'Approved' : 'Rejected',
        remark:   remarkInput || (action === 'approve' ? 'Approved by reviewer' : 'Rejected by reviewer'),
      });
      const res = await api.get(`/pfd/verify/${uploadedPFDId}/results/`);
      setVerificationReport(res.data.report);
      setSelectedIssues([]);
      showMsg('success', `${issueIds.length} issue(s) ${action}d.`);
    } catch { showMsg('error', 'Failed to update issues'); }
    finally  { setUpdatingIssues(false); setPendingAction(null); }
  };

  const toggleIssueSelection = (id) =>
    setSelectedIssues(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);

  // â”€â”€ Derived data â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  const filteredIssues = (verificationReport?.issues || []).filter(issue => {
    if (filterSeverity !== 'all' && issue.severity !== filterSeverity) return false;
    if (filterCategory !== 'all' && issue.category !== filterCategory) return false;
    if (filterStatus   !== 'all' && issue.status   !== filterStatus)   return false;
    if (searchText && !issue.issue_found?.toLowerCase().includes(searchText.toLowerCase()) &&
                      !issue.action_required?.toLowerCase().includes(searchText.toLowerCase())) return false;
    return true;
  });

  const categories = [...new Set((verificationReport?.issues || []).map(i => i.category))].sort();

  const groupedIssues = categories.reduce((acc, cat) => {
    acc[cat] = filteredIssues.filter(i => i.category === cat);
    return acc;
  }, {});

  const drawingInfo   = verificationReport?.report_data?.drawing_info || {};
  const analysisMeta  = verificationReport?.report_data?.analysis_metadata || {};
  const inventoryCounts = {
    equipment: analysisMeta.inventory_equipment_count ?? verificationReport?.report_data?.summary?.inventory_equipment_count ?? '-',
    streams:   analysisMeta.inventory_stream_count    ?? verificationReport?.report_data?.summary?.inventory_stream_count    ?? '-',
  };

  const requiredUploaded  = requiredRefDocs.filter(d => referenceFiles[d.key]).length;
  const refDocCompletion  = Math.round((requiredUploaded / requiredRefDocs.length) * 100);

  // â”€â”€ Exports â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  const handleExportExcel = () => {
    if (!filteredIssues.length) { showMsg('error', 'No issues to export'); return; }
    let csv = '\uFEFF';
    csv += 'S/N,Severity,Category,Issue Found,Evidence,Action Required,Status,Remark\n';
    filteredIssues.forEach(i => {
      csv += `"${i.serial_number}","${i.severity}","${i.category}",`;
      csv += `"${(i.issue_found || '').replace(/"/g,'""')}",`;
      csv += `"${(i.evidence  || '').replace(/"/g,'""')}",`;
      csv += `"${(i.action_required || '').replace(/"/g,'""')}",`;
      csv += `"${i.status}","${(i.remark || '').replace(/"/g,'""')}"\n`;
    });
    // metadata rows
    csv += `\n"Analysis Engine","${analysisMeta.engine || '4-pass'}"\n`;
    csv += `"Passes Run","${analysisMeta.passes_run || 4}"\n`;
    csv += `"Pages Analyzed","${analysisMeta.pages_analyzed || ''}"\n`;
    csv += `"Ref Docs Used","${analysisMeta.reference_docs_used || ''}"\n`;

    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement('a');
    a.href = url;
    a.download = `PFD_Verification_${drawingNumber || 'report'}_${new Date().toISOString().slice(0,10)}.csv`;
    document.body.appendChild(a); a.click();
    document.body.removeChild(a); URL.revokeObjectURL(url);
    showMsg('success', 'Excel file downloaded.');
  };

  const handleExportPDF = () => {
    const pw = window.open('', '', 'height=800,width=1100');
    const sev = (s) => SEVERITY_CONFIG[s] || SEVERITY_CONFIG.observation;
    pw.document.write(`<html><head><title>PFD Verification Report</title>
<style>
  body{font-family:Arial,sans-serif;margin:24px;color:#111}
  h1{color:#1e40af;margin-bottom:8px;font-size:22px}
  .meta{display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-bottom:20px;font-size:12px}
  .meta-card{background:#f3f4f6;border-radius:6px;padding:10px}
  .meta-card strong{display:block;color:#374151;margin-bottom:4px}
  .chips{display:flex;gap:8px;flex-wrap:wrap;margin-bottom:16px}
  .chip{padding:6px 14px;border-radius:20px;font-size:12px;font-weight:600}
  .chip-crit{background:#fee2e2;color:#991b1b}
  .chip-major{background:#fed7aa;color:#9a3412}
  .chip-minor{background:#fef3c7;color:#92400e}
  .chip-obs{background:#dbeafe;color:#1e40af}
  table{width:100%;border-collapse:collapse;font-size:11px}
  th{background:#1e40af;color:#fff;padding:8px 10px;text-align:left}
  td{border:1px solid #e5e7eb;padding:7px 10px;vertical-align:top}
  tr:nth-child(even) td{background:#f9fafb}
  .badge{padding:2px 8px;border-radius:10px;font-size:10px;font-weight:600}
</style></head><body>
<h1>PFD Verification Report</h1>
<div class="meta">
  <div class="meta-card"><strong>Drawing Number</strong>${drawingNumber || 'N/A'}</div>
  <div class="meta-card"><strong>Revision</strong>${revision || 'N/A'}</div>
  <div class="meta-card"><strong>Drawing Title</strong>${drawingTitle || 'N/A'}</div>
  <div class="meta-card"><strong>Analysis Engine</strong>${analysisMeta.engine || '4-pass multi-stage'} x ${analysisMeta.passes_run || 4} passes</div>
</div>
<div class="chips">
  <span class="chip chip-crit">Critical: ${verificationReport?.critical_count || 0}</span>
  <span class="chip chip-major">Major: ${verificationReport?.major_count || 0}</span>
  <span class="chip chip-minor">Minor: ${verificationReport?.minor_count || 0}</span>
  <span class="chip chip-obs">Observations: ${verificationReport?.observation_count || 0}</span>
</div>
<table>
<thead><tr><th>#</th><th>Severity</th><th>Category</th><th>Issue Found</th><th>Evidence</th><th>Action Required</th><th>Status</th></tr></thead>
<tbody>
${filteredIssues.map(i => `<tr>
  <td>${i.serial_number}</td>
  <td><span class="badge" style="background:${severityBgHex(i.severity)};color:${severityColorHex(i.severity)}">${i.severity}</span></td>
  <td>${i.category}</td><td>${i.issue_found}</td><td>${i.evidence || ''}</td><td>${i.action_required}</td>
  <td>${i.status}</td></tr>`).join('')}
</tbody></table>
</body></html>`);
    pw.document.close();
    setTimeout(() => pw.print(), 300);
  };

  const severityBgHex    = s => ({ critical:'#fee2e2', major:'#fed7aa', minor:'#fef3c7', observation:'#dbeafe' }[s] || '#f3f4f6');
  const severityColorHex = s => ({ critical:'#991b1b', major:'#9a3412', minor:'#92400e', observation:'#1e40af' }[s] || '#374151');

  // â”€â”€ Helpers â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  const showMsg = (type, text) => {
    setMessage({ type, text });
    if (type !== 'error') setTimeout(() => setMessage({ type: '', text: '' }), 4000);
  };

  const resetForm = () => {
    setPfdFile(null); setReferenceFiles({}); setDrawingNumber('');
    setRevision(''); setDrawingTitle(''); setUploadProgress({});
    setMessage({ type: '', text: '' }); setUploadedPFDId(null);
    setVerificationReport(null); setShowResults(false); setSelectedIssues([]);
    setActiveStage(0);
    ['pfd-upload', ...referenceDocuments.map(d => `ref-${d.key}`)].forEach(id => {
      const el = document.getElementById(id);
      if (el) el.value = '';
    });
  };

  // â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  //  Render helpers
  // â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

  const MessageBanner = () => !message.text ? null : (
    <div className={`mb-5 p-4 rounded-xl flex items-start gap-3 border ${
      message.type === 'success' ? 'bg-green-50 border-green-200' :
      message.type === 'error'   ? 'bg-red-50 border-red-200' :
                                   'bg-blue-50 border-blue-200'}`}>
      {message.type === 'success' ? <CheckCircle className="w-5 h-5 text-green-600 flex-shrink-0 mt-0.5" /> :
       message.type === 'error'   ? <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />  :
                                    <Info         className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />}
      <p className={`text-sm ${message.type === 'success' ? 'text-green-800' : message.type === 'error' ? 'text-red-800' : 'text-blue-800'}`}>
        {message.text}
      </p>
      <button onClick={() => setMessage({type:'',text:''})} className="ml-auto"><X className="w-4 h-4 opacity-50 hover:opacity-100" /></button>
    </div>
  );

  const SeverityBadge = ({ severity }) => {
    const cfg = SEVERITY_CONFIG[severity] || SEVERITY_CONFIG.observation;
    return (
      <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold ${cfg.bg} ${cfg.text}`}>
        <span className={`w-1.5 h-1.5 rounded-full ${cfg.dot}`} />
        {cfg.label}
      </span>
    );
  };

  const StatusBadge = ({ status }) => {
    const cfg = STATUS_CONFIG[status] || STATUS_CONFIG.pending;
    return <span className={`px-2.5 py-1 rounded-full text-xs font-semibold ${cfg.bg} ${cfg.text}`}>{cfg.label}</span>;
  };

  // â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  //  No-project landing page
  // â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  if (!selectedProject) {
    return (
      <div className="p-6 max-w-7xl mx-auto">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900">PFD Quality Checker</h1>
          <p className="text-gray-500 mt-1">Advanced 4-pass AI verification - 42-check deep analysis + gap detection</p>
        </div>

        <MessageBanner />

        {/* Hero card */}
        <div className="bg-gradient-to-br from-blue-600 to-indigo-700 rounded-2xl shadow-xl p-10 text-center mb-10">
          <Shield className="w-20 h-20 text-white/80 mx-auto mb-4" />
          <h2 className="text-2xl font-bold text-white mb-2">
            {projects.length > 0 ? 'Start a New Verification Project' : 'Create Your First Project'}
          </h2>
          <p className="text-blue-100 mb-6 max-w-lg mx-auto">
            Organise reference documents, upload your PFD, and let the 4-pass AI engine run 42 engineering checks and a full gap analysis.
          </p>
          <button onClick={() => setShowCreateModal(true)}
            className="px-8 py-3 bg-white text-blue-700 rounded-xl hover:bg-blue-50 font-semibold text-base flex items-center mx-auto shadow-lg transition-colors">
            <Plus className="w-5 h-5 mr-2" /> Create Project
          </button>
        </div>

        {/* Engine capabilities strip */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-10">
          {ANALYSIS_STAGES.map(s => (
            <div key={s.id} className="bg-white rounded-xl border border-gray-100 shadow-sm p-4 flex items-start gap-3">
              <div className="w-9 h-9 rounded-lg bg-blue-50 flex items-center justify-center flex-shrink-0">
                <s.icon className="w-5 h-5 text-blue-600" />
              </div>
              <div>
                <p className="text-xs font-semibold text-gray-800">Pass {s.id}</p>
                <p className="text-xs text-gray-500 mt-0.5">{s.label}</p>
              </div>
            </div>
          ))}
        </div>

        {/* Existing projects */}
        {loadingProjects ? (
          <div className="text-center py-10">
            <Loader className="w-8 h-8 animate-spin text-blue-500 mx-auto" />
            <p className="text-gray-500 mt-2">Loading projects...</p>
          </div>
        ) : projects.length > 0 && (
          <div>
            <h3 className="text-lg font-bold text-gray-900 mb-4">Recent Projects</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
              {projects.map((p) => (
                <div key={p.project_id || p.id}
                  onClick={() => setSelectedProject(p)}
                  className="bg-white rounded-xl shadow-sm border border-gray-100 p-5 cursor-pointer hover:border-blue-400 hover:shadow-md transition-all group relative">
                  <div className="absolute top-3 right-3 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button onClick={(e) => { e.stopPropagation(); setEditingProject(p); setEditProjectName(p.project_name||p.name); setEditProjectDescription(p.description||''); setShowEditModal(true); }}
                      className="p-1.5 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors">
                      <Edit className="w-3.5 h-3.5" />
                    </button>
                    <button onClick={(e) => { e.stopPropagation(); setDeletingProject(p); setShowDeleteConfirm(true); }}
                      className="p-1.5 bg-red-500 text-white rounded-lg hover:bg-red-600 transition-colors">
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                  <div className="w-10 h-10 bg-blue-50 rounded-xl flex items-center justify-center mb-3">
                    <Package className="w-5 h-5 text-blue-600" />
                  </div>
                  <h4 className="font-bold text-gray-900 mb-1">{p.project_name || p.name}</h4>
                  <p className="text-xs text-gray-500">{p.description || 'No description'}</p>
                  <p className="text-xs font-mono text-blue-500 mt-2">{p.project_id}</p>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Modals */}
        <ProjectModal title="Create New Project" show={showCreateModal} onClose={() => { setShowCreateModal(false); setNewProjectName(''); setNewProjectDescription(''); }}>
          <form onSubmit={handleCreateProject} className="space-y-4">
            <FormField label="Project Name *"><input autoFocus required value={newProjectName} onChange={e => setNewProjectName(e.target.value)} placeholder="e.g., ADNOC Project XYZ" /></FormField>
            <FormField label="Description"><textarea rows="3" value={newProjectDescription} onChange={e => setNewProjectDescription(e.target.value)} placeholder="Brief description..." /></FormField>
            <ModalActions onCancel={() => { setShowCreateModal(false); setNewProjectName(''); setNewProjectDescription(''); }} loading={creatingProject} submitLabel="Create Project" />
          </form>
        </ProjectModal>

        <ProjectModal title="Edit Project" show={showEditModal} onClose={() => { setShowEditModal(false); setEditingProject(null); }}>
          <form onSubmit={handleUpdateProject} className="space-y-4">
            <FormField label="Project Name *"><input required value={editProjectName} onChange={e => setEditProjectName(e.target.value)} /></FormField>
            <FormField label="Description"><textarea rows="3" value={editProjectDescription} onChange={e => setEditProjectDescription(e.target.value)} /></FormField>
            <ModalActions onCancel={() => setShowEditModal(false)} loading={updatingProject} submitLabel="Update Project" />
          </form>
        </ProjectModal>

        <DeleteModal show={showDeleteConfirm} name={deletingProject?.project_name || deletingProject?.name}
          loading={isDeleting} onCancel={() => { setShowDeleteConfirm(false); setDeletingProject(null); }} onConfirm={confirmDelete} />
      </div>
    );
  }

  // â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  //  Main upload + results interface
  // â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  return (
    <div className="p-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="mb-6 flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">PFD Quality Checker</h1>
          <p className="text-gray-500 text-sm mt-0.5">4-Pass AI Engine x 42 Engineering Checks x Gap Analysis</p>
        </div>
        <button onClick={() => { setSelectedProject(null); resetForm(); }}
          className="px-4 py-2 bg-gray-100 text-gray-700 rounded-xl hover:bg-gray-200 flex items-center gap-2 text-sm font-medium transition-colors">
          <FolderPlus className="w-4 h-4" /> Switch Project
        </button>
      </div>

      <MessageBanner />

      {/* Project banner */}
      <div className="bg-gradient-to-r from-blue-600 to-indigo-600 rounded-xl p-4 mb-6 flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 bg-white/20 rounded-lg flex items-center justify-center">
            <Package className="w-5 h-5 text-white" />
          </div>
          <div>
            <p className="text-white font-bold">{selectedProject.project_name}</p>
            <p className="text-blue-100 text-xs">Active Project</p>
          </div>
        </div>
        <div className="bg-white/15 px-4 py-2 rounded-lg text-right">
          <p className="text-white/60 text-xs">Project ID</p>
          <p className="text-white font-mono font-bold">{selectedProject.project_id}</p>
        </div>
      </div>

      {/* â”€â”€ Reference Docs â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */}
      {!showResults && (
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6 mb-6">
          <div className="flex items-center justify-between mb-5">
            <div className="flex items-center gap-2">
              <BookOpen className="w-5 h-5 text-blue-500" />
              <div>
                <h2 className="font-bold text-gray-900">Reference Documents</h2>
                <p className="text-xs text-gray-500">AI will extract and cross-reference text from these files</p>
              </div>
            </div>
            {/* Completeness bar */}
            <div className="flex items-center gap-3">
              <div className="w-32">
                <div className="flex justify-between text-xs text-gray-500 mb-1">
                  <span>Required docs</span>
                  <span>{requiredUploaded}/{requiredRefDocs.length}</span>
                </div>
                <div className="w-full bg-gray-100 rounded-full h-2">
                  <div className={`h-2 rounded-full transition-all ${refDocCompletion === 100 ? 'bg-green-500' : 'bg-blue-500'}`}
                    style={{ width: `${refDocCompletion}%` }} />
                </div>
              </div>
              <span className={`text-xs font-semibold px-2 py-1 rounded-full ${refDocCompletion === 100 ? 'bg-green-100 text-green-700' : 'bg-amber-100 text-amber-700'}`}>
                {refDocCompletion}%
              </span>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
            {referenceDocuments.map((doc) => {
              const colorCls = REF_DOC_COLORS[doc.color] || REF_DOC_COLORS.gray;
              const uploaded  = !!referenceFiles[doc.key];
              return (
                <div key={doc.key} className={`p-3 border rounded-xl ${colorCls} ${uploaded ? 'ring-2 ring-offset-1 ring-green-400' : ''}`}>
                  <div className="flex items-center justify-between mb-2">
                    <span className="font-semibold text-xs leading-tight">{doc.label}</span>
                    {!doc.required && <span className="text-xs bg-white/60 px-1.5 py-0.5 rounded-full">Optional</span>}
                    {doc.required && !uploaded && <span className="text-xs bg-red-100 text-red-600 px-1.5 py-0.5 rounded-full">Required</span>}
                    {uploaded && <CheckCircle className="w-4 h-4 text-green-600" />}
                  </div>
                  {uploaded ? (
                    <div className="flex items-center justify-between bg-white/70 rounded-lg p-1.5">
                      <p className="text-xs truncate flex-1">{referenceFiles[doc.key].name}</p>
                      <button onClick={() => removeFile(doc.key)} className="ml-1 p-0.5 hover:bg-red-100 rounded"><X className="w-3 h-3 text-red-500" /></button>
                    </div>
                  ) : (
                    <label htmlFor={`ref-${doc.key}`} className="block cursor-pointer">
                      <div className="border-2 border-dashed border-white/50 rounded-lg p-2 text-center hover:border-white/80 transition-colors">
                        <Upload className="w-4 h-4 mx-auto mb-0.5 opacity-60" />
                        <p className="text-xs opacity-70">Upload PDF</p>
                      </div>
                      <input type="file" id={`ref-${doc.key}`} accept=".pdf" className="hidden"
                        onChange={e => e.target.files[0] && handleReferenceFileChange(doc.key, e.target.files[0])} />
                    </label>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* â”€â”€ PFD Upload form â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */}
      {!showResults && !isVerifying && (
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6 mb-6">
          <div className="flex items-center gap-2 mb-5">
            <Upload className="w-5 h-5 text-blue-500" />
            <h2 className="font-bold text-gray-900">PFD Document</h2>
          </div>

          <form onSubmit={handleSubmit} className="space-y-5">
            {/* Drawing metadata */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {[
                { label: 'Drawing Number *', val: drawingNumber, set: setDrawingNumber, ph: 'PFD-001' },
                { label: 'Revision *',       val: revision,       set: setRevision,       ph: 'A, B, 01' },
                { label: 'Drawing Title *',  val: drawingTitle,   set: setDrawingTitle,   ph: 'Main Process Flow' },
              ].map(f => (
                <div key={f.label}>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">{f.label}</label>
                  <input value={f.val} onChange={e => f.set(e.target.value)} placeholder={f.ph} required
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-400 focus:border-transparent text-sm" />
                </div>
              ))}
            </div>

            {/* Drag-and-drop PFD upload */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">PFD Document *</label>
              {pfdFile ? (
                <div className="flex items-center justify-between p-4 bg-blue-50 border border-blue-200 rounded-xl">
                  <div className="flex items-center gap-3 flex-1 min-w-0">
                    <div className="w-9 h-9 bg-blue-100 rounded-lg flex items-center justify-center flex-shrink-0">
                      <FileText className="w-5 h-5 text-blue-600" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-gray-900 text-sm truncate">{pfdFile.name}</p>
                      <p className="text-xs text-gray-500">{(pfdFile.size / (1024*1024)).toFixed(2)} MB</p>
                    </div>
                  </div>
                  <button type="button" onClick={() => removeFile('pfd')} className="p-1.5 hover:bg-blue-100 rounded-lg">
                    <X className="w-4 h-4 text-red-500" />
                  </button>
                </div>
              ) : (
                <div ref={pfdDropRef} onDragOver={onDragOver} onDragLeave={onDragLeave} onDrop={onDrop}
                  className={`border-2 border-dashed rounded-xl p-8 text-center transition-colors ${draggingOver ? 'border-blue-500 bg-blue-50' : 'border-gray-200 hover:border-blue-400 hover:bg-blue-50/30'}`}>
                  <label htmlFor="pfd-upload" className="cursor-pointer block">
                    <Upload className="w-10 h-10 mx-auto mb-2 text-gray-300" />
                    <p className="text-sm font-medium text-gray-600">Drag & drop your PFD here, or <span className="text-blue-600 underline">browse</span></p>
                    <p className="text-xs text-gray-400 mt-1">PDF format x max 50 MB</p>
                  </label>
                  <input type="file" id="pfd-upload" accept=".pdf" className="hidden"
                    onChange={e => e.target.files[0] && handlePfdFileChange(e.target.files[0])} />
                </div>
              )}
            </div>

            {/* Upload progress */}
            {isUploading && uploadProgress.overall !== undefined && (
              <div className="bg-blue-50 border border-blue-100 rounded-xl p-4">
                <div className="flex justify-between text-sm font-medium text-blue-800 mb-2">
                  <span>Uploading...</span><span>{uploadProgress.overall}%</span>
                </div>
                <div className="w-full bg-blue-100 rounded-full h-2">
                  <div className="bg-blue-500 h-2 rounded-full transition-all" style={{ width: `${uploadProgress.overall}%` }} />
                </div>
              </div>
            )}

            {/* Summary strip */}
            <div className="flex flex-wrap gap-3 p-3 bg-gray-50 rounded-xl border border-gray-100">
              <div className="flex items-center gap-2 text-sm">
                <span className={`w-2 h-2 rounded-full ${pfdFile ? 'bg-green-500' : 'bg-gray-300'}`} />
                <span className="text-gray-600">PFD: <strong>{pfdFile ? pfdFile.name : 'Not selected'}</strong></span>
              </div>
              <div className="flex items-center gap-2 text-sm">
                <span className={`w-2 h-2 rounded-full ${Object.keys(referenceFiles).length > 0 ? 'bg-green-500' : 'bg-gray-300'}`} />
                <span className="text-gray-600">Ref docs: <strong>{Object.keys(referenceFiles).length} uploaded</strong></span>
              </div>
            </div>

            <div className="flex justify-end gap-3">
              <button type="button" onClick={resetForm} className="px-5 py-2.5 bg-gray-100 text-gray-700 rounded-xl hover:bg-gray-200 text-sm font-medium transition-colors">
                Reset
              </button>
              <button type="submit" disabled={isUploading}
                className="px-7 py-2.5 bg-blue-600 text-white rounded-xl hover:bg-blue-700 disabled:bg-gray-300 text-sm font-semibold flex items-center gap-2 transition-colors shadow-sm">
                {isUploading ? <><Loader className="w-4 h-4 animate-spin" /> Uploading...</> : <><Cpu className="w-4 h-4" /> Run Analysis</>}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* â”€â”€ 4-pass progress panel â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */}
      {isVerifying && (
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6 mb-6">
          <div className="flex items-center gap-3 mb-6">
            <Cpu className="w-6 h-6 text-blue-500 animate-pulse" />
            <div>
              <h3 className="font-bold text-gray-900">AI Analysis Running...</h3>
              <p className="text-sm text-gray-500">4-pass engine x please wait 2-3 minutes</p>
            </div>
          </div>
          <div className="space-y-4">
            {ANALYSIS_STAGES.map(stage => {
              const done  = activeStage >  stage.id;
              const active= activeStage === stage.id;
              return (
                <div key={stage.id} className={`flex items-center gap-4 p-4 rounded-xl border transition-all ${
                  done   ? 'border-green-200 bg-green-50' :
                  active ? 'border-blue-200 bg-blue-50 ring-2 ring-blue-200' :
                           'border-gray-100 bg-gray-50 opacity-50'}`}>
                  <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 ${
                    done   ? 'bg-green-100' :
                    active ? 'bg-blue-100' : 'bg-gray-100'}`}>
                    {done
                      ? <CheckCircle className="w-5 h-5 text-green-600" />
                      : active
                        ? <stage.icon className="w-5 h-5 text-blue-600 animate-pulse" />
                        : <stage.icon className="w-5 h-5 text-gray-400" />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className={`font-semibold text-sm ${done ? 'text-green-800' : active ? 'text-blue-800' : 'text-gray-400'}`}>
                      Pass {stage.id}: {stage.label}
                    </p>
                    <p className={`text-xs mt-0.5 ${done ? 'text-green-600' : active ? 'text-blue-600' : 'text-gray-400'}`}>
                      {done ? 'Completed' : active ? stage.desc : 'Queued...'}
                    </p>
                  </div>
                  {active && <Loader className="w-4 h-4 text-blue-500 animate-spin flex-shrink-0" />}
                  {done  && <CheckCircle className="w-4 h-4 text-green-500 flex-shrink-0" />}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* â”€â”€ Results â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */}
      {showResults && verificationReport && (
        <div className="space-y-6">

          {/* Drawing info card */}
          {(drawingInfo.drawing_number || drawingInfo.project_name) && (
            <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5">
              <div className="flex items-center gap-2 mb-3">
                <FileText className="w-4 h-4 text-indigo-500" />
                <h3 className="font-semibold text-gray-800 text-sm">AI-Extracted Drawing Info</h3>
                <span className="ml-auto text-xs bg-indigo-50 text-indigo-600 px-2 py-0.5 rounded-full">From title block</span>
              </div>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                {[
                  { lbl: 'Drawing No.', val: drawingInfo.drawing_number || drawingNumber },
                  { lbl: 'Revision',    val: drawingInfo.revision || revision },
                  { lbl: 'Project',     val: drawingInfo.project_name || selectedProject.project_name },
                  { lbl: 'Client',      val: drawingInfo.client_name || '-' },
                ].map(f => (
                  <div key={f.lbl} className="bg-gray-50 rounded-lg p-3">
                    <p className="text-xs text-gray-400 mb-0.5">{f.lbl}</p>
                    <p className="font-semibold text-gray-900 truncate">{f.val || '-'}</p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Summary cards + analysis metadata */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
            <div className="flex items-center justify-between mb-5 flex-wrap gap-3">
              <h2 className="text-xl font-bold text-gray-900">Verification Results</h2>
              <div className="flex items-center gap-2 flex-wrap">
                {analysisMeta.engine && (
                  <span className="flex items-center gap-1.5 text-xs bg-indigo-50 text-indigo-700 px-3 py-1.5 rounded-full font-medium border border-indigo-100">
                    <Cpu className="w-3.5 h-3.5" />
                    {analysisMeta.engine} x {analysisMeta.passes_run || 4} passes
                  </span>
                )}
                {analysisMeta.pages_analyzed && (
                  <span className="text-xs bg-gray-50 text-gray-600 px-3 py-1.5 rounded-full border border-gray-100">
                    {analysisMeta.pages_analyzed} page(s) scanned
                  </span>
                )}
                {analysisMeta.reference_docs_used > 0 && (
                  <span className="text-xs bg-green-50 text-green-700 px-3 py-1.5 rounded-full border border-green-100">
                    {analysisMeta.reference_docs_used} ref doc(s) read
                  </span>
                )}
                {inventoryCounts.equipment !== '-' && (
                  <span className="text-xs bg-blue-50 text-blue-700 px-3 py-1.5 rounded-full border border-blue-100">
                    {inventoryCounts.equipment} equipment x {inventoryCounts.streams} streams inventoried
                  </span>
                )}
              </div>
            </div>

            {/* Severity counts */}
            <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mb-6">
              {[
                { key: 'total',       label: 'Total',       count: verificationReport.total_issues || 0,       bg: 'bg-gray-50',    text: 'text-gray-800',   border: 'border-gray-200' },
                { key: 'critical',    label: 'Critical',    count: verificationReport.critical_count || 0,     bg: 'bg-red-50',     text: 'text-red-700',    border: 'border-red-200'  },
                { key: 'major',       label: 'Major',       count: verificationReport.major_count || 0,        bg: 'bg-orange-50',  text: 'text-orange-700', border: 'border-orange-200' },
                { key: 'minor',       label: 'Minor',       count: verificationReport.minor_count || 0,        bg: 'bg-yellow-50',  text: 'text-yellow-700', border: 'border-yellow-200' },
                { key: 'observation', label: 'Observations',count: verificationReport.observation_count || 0,  bg: 'bg-blue-50',    text: 'text-blue-700',   border: 'border-blue-200'  },
              ].map(c => (
                <div key={c.key} className={`${c.bg} border ${c.border} rounded-xl p-4 cursor-pointer transition-all hover:shadow-md ${filterSeverity === c.key ? 'ring-2 ring-offset-1 ring-blue-400' : ''}`}
                  onClick={() => setFilterSeverity(prev => prev === c.key ? 'all' : c.key)}>
                  <p className={`text-xs font-medium ${c.text} mb-1`}>{c.label}</p>
                  <p className={`text-3xl font-bold ${c.text}`}>{c.count}</p>
                </div>
              ))}
            </div>

            {/* Approval progress */}
            <div className="flex items-center gap-4 p-3 bg-gray-50 rounded-xl mb-5 text-sm flex-wrap">
              {[
                { label: 'Pending',  count: verificationReport.pending_count  || 0, color: 'text-amber-600'  },
                { label: 'Approved', count: verificationReport.approved_count || 0, color: 'text-green-600'  },
                { label: 'Ignored',  count: verificationReport.ignored_count  || 0, color: 'text-gray-500'   },
              ].map(s => (
                <span key={s.label} className="flex items-center gap-1.5">
                  <span className={`font-bold ${s.color}`}>{s.count}</span>
                  <span className="text-gray-500">{s.label}</span>
                  <span className="text-gray-300 ml-2">|</span>
                </span>
              ))}
            </div>

            {/* Toolbar */}
            <div className="flex flex-wrap items-center gap-3 mb-4">
              {/* Search */}
              <div className="relative flex-1 min-w-48">
                <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                <input value={searchText} onChange={e => setSearchText(e.target.value)} placeholder="Search issues..."
                  className="w-full pl-9 pr-3 py-2 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-blue-300 focus:border-transparent" />
              </div>
              {/* Category filter */}
              <select value={filterCategory} onChange={e => setFilterCategory(e.target.value)}
                className="px-3 py-2 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-blue-300 bg-white">
                <option value="all">All Categories</option>
                {categories.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
              {/* Status filter */}
              <select value={filterStatus} onChange={e => setFilterStatus(e.target.value)}
                className="px-3 py-2 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-blue-300 bg-white">
                <option value="all">All Statuses</option>
                {Object.entries(STATUS_CONFIG).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
              </select>
              {/* View toggle */}
              <div className="flex border border-gray-200 rounded-xl overflow-hidden">
                {[['flat', Layers, 'Flat'], ['grouped', BarChart2, 'Grouped']].map(([mode, Icon, lbl]) => (
                  <button key={mode} onClick={() => setViewMode(mode)}
                    className={`px-3 py-2 flex items-center gap-1.5 text-xs font-medium transition-colors ${viewMode === mode ? 'bg-blue-600 text-white' : 'bg-white text-gray-600 hover:bg-gray-50'}`}>
                    <Icon className="w-3.5 h-3.5" />{lbl}
                  </button>
                ))}
              </div>
              {/* Re-analyze */}
              <button onClick={reAnalyze} title="Re-run analysis"
                className="px-3 py-2 border border-gray-200 text-gray-600 rounded-xl hover:bg-gray-50 flex items-center gap-1.5 text-xs font-medium transition-colors">
                <RefreshCw className="w-3.5 h-3.5" /> Re-analyze
              </button>
            </div>

            {/* Bulk actions */}
            {selectedIssues.length > 0 && (
              <div className="flex items-center gap-3 p-3 bg-blue-50 border border-blue-200 rounded-xl mb-4">
                <span className="text-sm text-blue-800 font-medium">{selectedIssues.length} selected</span>
                <button onClick={() => openActionModal('approve', selectedIssues)}
                  disabled={updatingIssues}
                  className="px-3 py-1.5 bg-green-600 text-white rounded-lg text-xs font-semibold hover:bg-green-700 flex items-center gap-1.5 disabled:opacity-50">
                  <CheckCircle className="w-3.5 h-3.5" /> Approve
                </button>
                <button onClick={() => openActionModal('reject', selectedIssues)}
                  disabled={updatingIssues}
                  className="px-3 py-1.5 bg-red-600 text-white rounded-lg text-xs font-semibold hover:bg-red-700 flex items-center gap-1.5 disabled:opacity-50">
                  <X className="w-3.5 h-3.5" /> Reject
                </button>
                <button onClick={() => setSelectedIssues([])} className="ml-auto text-xs text-blue-600 hover:underline">Clear</button>
              </div>
            )}

            {/* Export buttons */}
            <div className="flex gap-2 mb-4">
              <button onClick={handleExportPDF}
                className="px-4 py-2 bg-rose-600 text-white rounded-xl hover:bg-rose-700 flex items-center gap-2 text-xs font-semibold transition-colors">
                <Download className="w-3.5 h-3.5" /> Export PDF
              </button>
              <button onClick={handleExportExcel}
                className="px-4 py-2 bg-emerald-600 text-white rounded-xl hover:bg-emerald-700 flex items-center gap-2 text-xs font-semibold transition-colors">
                <FileSpreadsheet className="w-3.5 h-3.5" /> Export Excel
              </button>
              <span className="ml-auto text-xs text-gray-400 self-center">
                Showing {filteredIssues.length} of {verificationReport.total_issues || 0} issues
              </span>
            </div>

            {/* Issues table - flat or grouped */}
            {viewMode === 'flat' ? (
              <IssuesTable issues={filteredIssues} selectedIssues={selectedIssues}
                onToggle={toggleIssueSelection} onSelectAll={() =>
                  setSelectedIssues(filteredIssues.length === selectedIssues.length
                    ? [] : filteredIssues.map(i => i.id))}
                allSelected={filteredIssues.length > 0 && selectedIssues.length === filteredIssues.length}
                expandedIssue={expandedIssue} setExpandedIssue={setExpandedIssue}
                onAction={openActionModal} updatingIssues={updatingIssues}
                SeverityBadge={SeverityBadge} StatusBadge={StatusBadge} />
            ) : (
              <div className="space-y-4">
                {Object.entries(groupedIssues).filter(([, issues]) => issues.length > 0).map(([cat, issues]) => (
                  <details key={cat} open className="border border-gray-100 rounded-xl overflow-hidden">
                    <summary className="flex items-center justify-between px-4 py-3 bg-gray-50 cursor-pointer select-none">
                      <span className="font-semibold text-gray-800 text-sm">{cat}</span>
                      <span className="text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full font-medium">{issues.length}</span>
                    </summary>
                    <IssuesTable issues={issues} selectedIssues={selectedIssues}
                      onToggle={toggleIssueSelection} onSelectAll={() => {}}
                      allSelected={false} expandedIssue={expandedIssue}
                      setExpandedIssue={setExpandedIssue} onAction={openActionModal}
                      updatingIssues={updatingIssues} SeverityBadge={SeverityBadge} StatusBadge={StatusBadge} />
                  </details>
                ))}
              </div>
            )}
          </div>

          {/* New verification button */}
          <div className="flex justify-center">
            <button onClick={resetForm}
              className="px-7 py-3 bg-blue-600 text-white rounded-xl hover:bg-blue-700 font-semibold flex items-center gap-2 shadow-sm">
              <Plus className="w-5 h-5" /> Start New Verification
            </button>
          </div>
        </div>
      )}

      {/* â”€â”€ Remark / Action modal â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */}
      {showRemarkModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-bold text-gray-900 capitalize">
                {pendingAction?.action === 'approve' ? 'Approve' : 'Reject'} {pendingAction?.issueIds?.length} Issue(s)
              </h3>
              <button onClick={() => setShowRemarkModal(false)}><X className="w-5 h-5 text-gray-400" /></button>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5 flex items-center gap-1.5">
                <MessageSquare className="w-4 h-4" /> Remark (optional)
              </label>
              <textarea value={remarkInput} onChange={e => setRemarkInput(e.target.value)} rows="3"
                placeholder="Add a review comment or remark..."
                className="w-full px-3 py-2 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-blue-300 focus:border-transparent" />
            </div>
            <div className="flex gap-3 mt-5">
              <button onClick={() => setShowRemarkModal(false)}
                className="flex-1 px-4 py-2.5 border border-gray-200 text-gray-700 rounded-xl hover:bg-gray-50 text-sm font-medium">Cancel</button>
              <button onClick={confirmIssueAction} disabled={updatingIssues}
                className={`flex-1 px-4 py-2.5 text-white rounded-xl text-sm font-semibold flex items-center justify-center gap-2 disabled:opacity-50 ${
                  pendingAction?.action === 'approve' ? 'bg-green-600 hover:bg-green-700' : 'bg-red-600 hover:bg-red-700'}`}>
                {updatingIssues ? <Loader className="w-4 h-4 animate-spin" /> : <CheckCircle className="w-4 h-4" />}
                Confirm
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

// â”€â”€â”€ Sub-components â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

const IssuesTable = ({ issues, selectedIssues, onToggle, onSelectAll, allSelected,
  expandedIssue, setExpandedIssue, onAction, updatingIssues, SeverityBadge, StatusBadge }) => (
  <div className="overflow-x-auto">
    <table className="min-w-full text-sm">
      <thead>
        <tr className="bg-gray-50 border-b border-gray-100">
          <th className="w-10 px-3 py-3">
            <input type="checkbox" checked={allSelected} onChange={onSelectAll} className="rounded border-gray-300 text-blue-600 focus:ring-blue-400" />
          </th>
          <th className="px-3 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide w-12">#</th>
          <th className="px-3 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">Severity</th>
          <th className="px-3 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">Category</th>
          <th className="px-3 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">Issue Found</th>
          <th className="px-3 py-3 text-left text-xs font-semibold text-purple-600 uppercase tracking-wide">
            <span className="flex items-center gap-1">
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.347.05A3.878 3.878 0 0015 17H9a3.878 3.878 0 00-1.797-.546l-.347-.05z" /></svg>
              Evidence
            </span>
          </th>
          <th className="px-3 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">Action Required</th>
          <th className="px-3 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">Status</th>
        </tr>
      </thead>
      <tbody className="divide-y divide-gray-50">
        {issues.map(issue => (
          <React.Fragment key={issue.id}>
            <tr className={`hover:bg-gray-50 transition-colors cursor-pointer ${selectedIssues.includes(issue.id) ? 'bg-blue-50' : ''}`}
              onClick={() => setExpandedIssue(expandedIssue === issue.id ? null : issue.id)}>
              <td className="px-3 py-3" onClick={e => e.stopPropagation()}>
                <input type="checkbox" checked={selectedIssues.includes(issue.id)} onChange={() => onToggle(issue.id)}
                  className="rounded border-gray-300 text-blue-600 focus:ring-blue-400" />
              </td>
              <td className="px-3 py-3 text-gray-500 font-mono text-xs">{issue.serial_number}</td>
              <td className="px-3 py-3"><SeverityBadge severity={issue.severity} /></td>
              <td className="px-3 py-3"><span className="text-xs text-gray-500 bg-gray-100 px-2 py-1 rounded-lg">{issue.category}</span></td>
              <td className="px-3 py-3 text-gray-800 max-w-xs">
                <p className="line-clamp-2 text-xs leading-relaxed">{issue.issue_found}</p>
              </td>
              <td className="px-3 py-3 max-w-sm bg-purple-50/50">
                {issue.evidence ? (
                  <p className="line-clamp-3 text-xs leading-relaxed text-purple-900">{issue.evidence}</p>
                ) : (
                  <span className="text-gray-300 text-xs italic">Re-analyze to generate</span>
                )}
              </td>
              <td className="px-3 py-3 text-gray-600 max-w-xs">
                <p className="line-clamp-2 text-xs leading-relaxed">{issue.action_required}</p>
              </td>
              <td className="px-3 py-3" onClick={e => e.stopPropagation()}>
                <div className="flex items-center gap-1.5">
                  {issue.status === 'pending' ? (
                    <>
                      <button onClick={() => onAction('approve', [issue.id])} disabled={updatingIssues}
                        className="px-2 py-1 bg-green-600 text-white rounded-lg text-xs hover:bg-green-700 disabled:opacity-50 flex items-center gap-1">
                        <CheckCircle className="w-3 h-3" />
                      </button>
                      <button onClick={() => onAction('reject', [issue.id])} disabled={updatingIssues}
                        className="px-2 py-1 bg-red-600 text-white rounded-lg text-xs hover:bg-red-700 disabled:opacity-50 flex items-center gap-1">
                        <X className="w-3 h-3" />
                      </button>
                    </>
                  ) : (
                    <StatusBadge status={issue.status} />
                  )}
                </div>
              </td>
            </tr>
            {/* Expanded row */}
            {expandedIssue === issue.id && (
              <tr className="bg-indigo-50/50">
                <td colSpan="8" className="px-4 py-4">
                  <div className="grid md:grid-cols-2 gap-4 text-xs">
                    <div>
                      <p className="font-semibold text-gray-700 mb-1 flex items-center gap-1.5"><Eye className="w-3.5 h-3.5 text-indigo-500" />Full Issue Description</p>
                      <p className="text-gray-600 leading-relaxed bg-white p-3 rounded-xl border border-indigo-100">{issue.issue_found}</p>
                    </div>
                    {issue.evidence && (
                      <div>
                        <p className="font-semibold text-purple-700 mb-1 flex items-center gap-1.5">
                          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.347.05A3.878 3.878 0 0015 17H9a3.878 3.878 0 00-1.797-.546l-.347-.05z" /></svg>
                          Evidence
                        </p>
                        <p className="text-purple-900 leading-relaxed bg-purple-50 p-3 rounded-xl border border-purple-100">{issue.evidence}</p>
                      </div>
                    )}
                    <div>
                      <p className="font-semibold text-gray-700 mb-1 flex items-center gap-1.5"><CheckCircle className="w-3.5 h-3.5 text-green-500" />Full Action Required</p>
                      <p className="text-gray-600 leading-relaxed bg-white p-3 rounded-xl border border-indigo-100">{issue.action_required}</p>
                    </div>
                    {issue.remark && issue.remark !== 'Pending' && (
                      <div>
                        <p className="font-semibold text-gray-700 mb-1 flex items-center gap-1.5"><MessageSquare className="w-3.5 h-3.5 text-blue-500" />Remark</p>
                        <p className="text-gray-600 bg-white p-3 rounded-xl border border-indigo-100">{issue.remark}</p>
                      </div>
                    )}
                  </div>
                </td>
              </tr>
            )}
          </React.Fragment>
        ))}
        {issues.length === 0 && (
          <tr><td colSpan="8" className="py-10 text-center text-gray-400 text-sm">No issues match the current filters.</td></tr>
        )}
      </tbody>
    </table>
  </div>
);

const ProjectModal = ({ title, show, onClose, children }) => !show ? null : (
  <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
    <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full p-6">
      <div className="flex items-center justify-between mb-5">
        <h3 className="text-lg font-bold text-gray-900">{title}</h3>
        <button onClick={onClose}><X className="w-5 h-5 text-gray-400 hover:text-gray-600" /></button>
      </div>
      {children}
    </div>
  </div>
);

const FormField = ({ label, children }) => (
  <div>
    <label className="block text-sm font-medium text-gray-700 mb-1.5">{label}</label>
    {React.cloneElement(children, {
      className: 'w-full px-3 py-2.5 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-400 focus:border-transparent text-sm'
    })}
  </div>
);

const ModalActions = ({ onCancel, loading, submitLabel }) => (
  <div className="flex gap-3 pt-2">
    <button type="button" onClick={onCancel} disabled={loading}
      className="flex-1 px-4 py-2.5 border border-gray-200 text-gray-700 rounded-xl hover:bg-gray-50 font-medium text-sm transition-colors">
      Cancel
    </button>
    <button type="submit" disabled={loading}
      className="flex-1 px-4 py-2.5 bg-blue-600 text-white rounded-xl hover:bg-blue-700 disabled:bg-gray-300 font-semibold text-sm flex items-center justify-center gap-2 transition-colors">
      {loading ? <><Loader className="w-4 h-4 animate-spin" />Saving...</> : submitLabel}
    </button>
  </div>
);

const DeleteModal = ({ show, name, loading, onCancel, onConfirm }) => !show ? null : (
  <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
    <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full p-6 text-center">
      <div className="w-14 h-14 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
        <Trash2 className="w-7 h-7 text-red-600" />
      </div>
      <h3 className="text-lg font-bold text-gray-900 mb-2">Delete Project?</h3>
      <p className="text-gray-600 text-sm mb-1">You are about to permanently delete:</p>
      <p className="font-bold text-gray-900 mb-4">{name}</p>
      <p className="text-xs text-red-500 mb-6">This action cannot be undone.</p>
      <div className="flex gap-3">
        <button onClick={onCancel} disabled={loading}
          className="flex-1 px-4 py-2.5 border border-gray-200 text-gray-700 rounded-xl hover:bg-gray-50 font-medium text-sm">Cancel</button>
        <button onClick={onConfirm} disabled={loading}
          className="flex-1 px-4 py-2.5 bg-red-600 text-white rounded-xl hover:bg-red-700 disabled:opacity-50 font-semibold text-sm flex items-center justify-center gap-2">
          {loading ? <Loader className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />} Delete
        </button>
      </div>
    </div>
  </div>
);

export default PFDVerification;
