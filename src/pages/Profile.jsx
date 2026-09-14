import { radaiConfirm } from '../services/radaiDialog'
import React, { useState, useEffect, useRef, useMemo } from "react";
import { useSelector, useDispatch } from "react-redux";
import { toast } from "react-toastify";
import { updateUser } from "../store/slices/authSlice";
import {
  User,
  Mail,
  Phone,
  Briefcase,
  MapPin,
  Camera,
  X,
  Check,
  Loader,
  Building2,
  Shield,
  Save,
  Star,
  Award,
  Globe,
  Clock,
  Plus,
  Trash2,
  Calendar,
  FolderOpen,
  TrendingUp,
  Trophy,
  FileText,
  LogOut,
  Search,
} from "lucide-react";
import { API_BASE_URL } from "../config/api.config";
import {
  S3_UPLOAD_CONFIG,
  validateFile,
  formatFileSize,
} from "../config/s3Upload.config";
import PeopleNav from "../components/PeopleNav/PeopleNav";
import AchievementSection from "../components/Profile/AchievementSection";
import WorkExperienceSection from "../components/Profile/WorkExperienceSection";
import SocialMediaLinksSection from "../components/Profile/SocialMediaLinksSection";
import DocumentUploadSection from "../components/Profile/DocumentUploadSection";
import { InitiateExitModal } from "./HR/OnboardingOffboarding";
import EmployeeTabLoading from "../components/HR/EmployeeTabLoading";
import { CORPORATE_CAREER_LEVELS, CORPORATE_FUNCTIONS, CORPORATE_SKILLS, defaultCareerTrack } from "../config/careerProfile.config";
import "../components/Profile/CareerExpertiseWorkspace.css";
import CareerSelectionList from "../components/Profile/CareerSelectionList";
import ReportingManagerSelect from "../components/Profile/ReportingManagerSelect";

// ─────────────────────────────────────────────────────────────────────────────
// Soft-coded engineering constants
// ─────────────────────────────────────────────────────────────────────────────

const ENGINEERING_DISCIPLINES = [
  "Process",
  "Piping",
  "Instrument & Control",
  "Electrical",
  "Civil & Structural",
  "Mechanical",
  "Safety & HSE",
  "Project Controls",
  "Commissioning",
  "Materials & Corrosion",
  "Environmental",
  "Procurement",
];

// Soft-coded: Department choices for Oil & Gas engineering organization
const DEPARTMENTS = [
  { value: "process", label: "Process Engineering" },
  { value: "piping", label: "Piping Engineering" },
  { value: "instrument", label: "Instrument & Control" },
  { value: "electrical", label: "Electrical Engineering" },
  { value: "mechanical", label: "Mechanical Engineering" },
  { value: "civil", label: "Civil & Structural Engineering" },
  { value: "safety", label: "Safety & HSE" },
  { value: "project_controls", label: "Project Controls" },
  { value: "commissioning", label: "Commissioning" },
  { value: "materials", label: "Materials & Corrosion" },
  { value: "environmental", label: "Environmental Engineering" },
  { value: "procurement", label: "Procurement" },
  { value: "operations", label: "Operations" },
  { value: "maintenance", label: "Maintenance" },
  { value: "quality", label: "Quality Assurance" },
  { value: "finance", label: "Finance" },
  { value: "sales", label: "Sales" },
  { value: "hr", label: "Human Resources" },
  { value: "it", label: "Information Technology" },
  { value: "admin", label: "Administration" },
  { value: "management", label: "Management" },
  { value: "radai", label: "RadAI" },
];

const EXPERTISE_LEVELS = [
  {
    value: "junior",
    label: "Junior Engineer",
    years: "0–3 yrs",
    colorClass: "bg-blue-100 text-blue-700 border-blue-300",
    dotClass: "bg-blue-500",
  },
  {
    value: "mid",
    label: "Mid-Level Engineer",
    years: "3–7 yrs",
    colorClass: "bg-cyan-100 text-cyan-700 border-cyan-300",
    dotClass: "bg-cyan-500",
  },
  {
    value: "senior",
    label: "Senior Engineer",
    years: "7–15 yrs",
    colorClass: "bg-green-100 text-green-700 border-green-300",
    dotClass: "bg-green-500",
  },
  {
    value: "lead",
    label: "Lead Engineer",
    years: "12–20 yrs",
    colorClass: "bg-purple-100 text-purple-700 border-purple-300",
    dotClass: "bg-purple-500",
  },
  {
    value: "principal",
    label: "Principal Engineer",
    years: "18+ yrs",
    colorClass: "bg-orange-100 text-orange-700 border-orange-300",
    dotClass: "bg-orange-500",
  },
  { value: "manager", label: "Engineering Manager", years: "People and discipline leadership", colorClass: "bg-blue-50 text-blue-700 border-blue-200" },
  {
    value: "fellow",
    label: "Engineering Fellow",
    years: "25+ yrs",
    colorClass: "bg-red-100 text-red-700 border-red-300",
    dotClass: "bg-red-500",
  },
];

const TECHNICAL_SKILLS_CATALOG = [
  "HYSYS",
  "AspenPlus",
  "PDMS",
  "AVEVA E3D",
  "Smart Plant P&ID",
  "AutoCAD Plant 3D",
  "CAESAR II",
  "ETAP",
  "AVEVA Instrumentation",
  "COMOS",
  "HTRI",
  "FLARENET",
  "PIPESIM",
  "OLGA",
  "Microsoft Project",
  "Primavera P6",
  "SAP PM",
  "HAZOP Leadership",
  "SIL Assessment",
  "Risk-Based Inspection",
  "Front End Loading (FEL)",
  "Rotating Equipment",
];

const CERTIFICATION_OPTIONS = [
  "PMP (Project Management Professional)",
  "Chartered Engineer (CEng)",
  "Professional Engineer (PE)",
  "CompEx (Explosive Atmospheres)",
  "NEBOSH General Certificate",
  "NEBOSH International Diploma",
  "ISO 55000 Asset Management",
  "ISO 9001 Quality MS",
  "ISO 14001 Environmental MS",
  "Functional Safety (IEC 61511)",
  "API 510 Pressure Vessel Inspector",
  "API 570 Piping Inspector",
  "API 653 Tank Inspector",
  "AWS Certified Welding Inspector (CWI)",
  "CSWIP 3.1 Welding Inspector",
  "Prince2 Practitioner",
  "Six Sigma Green Belt",
  "Six Sigma Black Belt",
];

const LANGUAGES = [
  "English",
  "Arabic",
  "French",
  "Spanish",
  "German",
  "Russian",
  "Mandarin",
  "Hindi",
  "Urdu",
  "Tagalog",
  "Portuguese",
];

const AVAILABILITY_STATUSES = [
  {
    value: "available",
    label: "Available",
    badgeClass: "bg-green-500",
    bgClass: "bg-green-50 border-green-300",
    textClass: "text-green-700",
    desc: "Ready for new assignments",
  },
  {
    value: "partial",
    label: "Partially Available",
    badgeClass: "bg-yellow-500",
    bgClass: "bg-yellow-50 border-yellow-300",
    textClass: "text-yellow-700",
    desc: "Limited bandwidth available",
  },
  {
    value: "busy",
    label: "Fully Committed",
    badgeClass: "bg-red-500",
    bgClass: "bg-red-50 border-red-300",
    textClass: "text-red-700",
    desc: "At full project capacity",
  },
  {
    value: "on_leave",
    label: "On Leave",
    badgeClass: "bg-gray-400",
    bgClass: "bg-gray-50 border-gray-300",
    textClass: "text-gray-600",
    desc: "Temporarily unavailable",
  },
];

const PROJECT_TYPES = [
  "Greenfield Development",
  "Brownfield Modification",
  "Conceptual Study",
  "Feasibility Study",
  "FEED",
  "Detailed Engineering",
  "EPC",
  "Construction Support",
  "Commissioning & Start-up",
  "Maintenance Engineering",
  "Decommissioning",
];

const PROJECT_ROLES = [
  "Lead Process Engineer",
  "Process Engineer",
  "Lead Piping Engineer",
  "Piping Engineer",
  "Lead Instrument Engineer",
  "Instrument Engineer",
  "Lead Electrical Engineer",
  "Electrical Engineer",
  "Lead Mechanical Engineer",
  "Mechanical Engineer",
  "Civil / Structural Engineer",
  "Safety / HSE Lead",
  "Project Manager",
  "Project Engineer",
  "Document Controller",
  "Commissioning Engineer",
  "Materials & Corrosion Engineer",
  "Cost Estimator",
];

const PROJECT_ASSIGNMENT_STATUSES = [
  {
    value: "active",
    label: "Active",
    bgClass: "bg-green-100 text-green-700",
    dotClass: "bg-green-500",
  },
  {
    value: "on_hold",
    label: "On Hold",
    bgClass: "bg-yellow-100 text-yellow-700",
    dotClass: "bg-yellow-500",
  },
  {
    value: "completing",
    label: "Completing",
    bgClass: "bg-blue-100 text-blue-700",
    dotClass: "bg-blue-500",
  },
  {
    value: "completed",
    label: "Completed",
    bgClass: "bg-gray-100 text-gray-500",
    dotClass: "bg-gray-400",
  },
];

const DEFAULT_PROJECT = {
  project_id: "",
  name: "",
  project_manager_id: "",
  role: "",
  project_type: "",
  allocation: 50,
  start_date: "",
  end_date: "",
  status: "active",
  client: "",
  location: "",
};

const buildProjectId = (projectName, projects = [], startDate = "") => {
  const normalizedName = String(projectName || "").trim().replace(/\s+/g, " ");
  if (!normalizedName) return "";
  const dateYear = String(startDate || "").slice(0, 4);
  const year = /^\d{4}$/.test(dateYear)
    ? Number(dateYear)
    : new Date().getFullYear();
  const suffixPattern = new RegExp(`-(\\d{4})-${year}$`);
  const highestSequence = projects.reduce((highest, project) => {
    const match = String(project.project_id || "").match(suffixPattern);
    return match ? Math.max(highest, Number(match[1])) : highest;
  }, 0);
  const nextSequence = Math.max(highestSequence, projects.length) + 1;
  return `${normalizedName}-${String(nextSequence).padStart(4, "0")}-${year}`;
};

// Completeness weights — must sum to 100
const COMPLETENESS_FIELDS = [
  { key: "first_name", src: "basic", w: 5 },
  { key: "last_name", src: "basic", w: 5 },
  { key: "profile_photo", src: "basic", w: 10 },
  { key: "phone", src: "basic", w: 5 },
  { key: "location", src: "basic", w: 5 },
  { key: "department", src: "basic", w: 5 },
  { key: "job_title", src: "basic", w: 5 },
  { key: "bio", src: "basic", w: 5 },
  { key: "expertise_level", src: "eng", w: 10 },
  { key: "years_experience", src: "eng", w: 5 },
  { key: "engineering_disciplines", src: "arr", w: 10 },
  { key: "technical_skills", src: "arr", w: 10 },
  { key: "certifications", src: "arr", w: 10 },
  { key: "availability_status", src: "eng", w: 5 },
  { key: "languages", src: "arr", w: 5 },
];

const DEFAULT_EP = {
  expertise_level: "",
  years_experience: "",
  engineering_disciplines: [],
  technical_skills: [],
  languages: [],
  certifications: [],
  availability_status: "available",
  availability_percentage: 100,
  preferred_project_types: [],
  max_concurrent_projects: 2,
  next_available_date: "",
  current_projects: [],
};

const Profile = ({ embedded = false }) => {
  const dispatch = useDispatch();
  const { user } = useSelector((s) => s.auth);

  const [activeTab, setActiveTab] = useState("personal");
  const [isLoading, setIsLoading] = useState(false);
  const [isFetching, setIsFetching] = useState(true);
  const [profileData, setProfileData] = useState(null);
  const [showExitModal, setShowExitModal] = useState(false);

  // Authentication and RBAC profile endpoints use slightly different shapes:
  // auth may be flat or nested, while the profile API returns user.email.
  const profileEmail =
    profileData?.user?.email ||
    profileData?.email ||
    user?.user?.email ||
    user?.email ||
    "";
  const profileUserId =
    profileData?.user?.id ||
    profileData?.user_id ||
    user?.user?.id ||
    user?.id ||
    null;

  // Photo
  const [photoPreview, setPhotoPreview] = useState(null);
  const [selectedFile, setSelectedFile] = useState(null);
  const [isDragging, setIsDragging] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const fileInputRef = useRef(null);

  // Basic form
  const [formData, setFormData] = useState({
    first_name: "",
    last_name: "",
    phone: "",
    bio: "",
    location: "",
    department: "",
    job_title: "",
    manager_id: "",
  });

  // Managers list for the Reporting Manager dropdown
  const [managers, setManagers] = useState([]);
  const [managersLoading, setManagersLoading] = useState(true);
  const [managersError, setManagersError] = useState("");

  const PROFILE_EMPLOYEE_FIELDS = [
    { key: "branch", label: "Branch", type: "select" },
    { key: "join_date", label: "Joining Date", type: "date" },
    { key: "division", label: "Division", type: "text" },
    { key: "business_unit", label: "Business Unit", type: "text" },
    { key: "business_area", label: "Business Area", type: "text" },
    { key: "office", label: "Office", type: "text" },
  ];
  const [empData, setEmpData] = useState({
    branch: "",
    join_date: "",
    division: "",
    business_unit: "",
    business_area: "",
    office: "",
  });
  const [branchChoices, setBranchChoices] = useState([]);
  const [empDataChanged, setEmpDataChanged] = useState(false);
  const setEmpField = (key, val) => {
    setEmpData((p) => ({ ...p, [key]: val }));
    setEmpDataChanged(true);
  };

  // Engineer profile
  const [ep, setEp] = useState(DEFAULT_EP);

  // Cert entry
  const [newCert, setNewCert] = useState({
    name: "",
    issuer: "",
    year: "",
    expiry_date: "",
  });
  const [showCertForm, setShowCertForm] = useState(false);

  // Skill entry

  // Project assignment entry
  const [newProject, setNewProject] = useState(DEFAULT_PROJECT);
  const [showProjectForm, setShowProjectForm] = useState(false);
  const [projectManagers, setProjectManagers] = useState([]);
  const [projectManagersLoading, setProjectManagersLoading] = useState(false);
  const [projectManagerSearch, setProjectManagerSearch] = useState("");
  const [showProjectManagerOptions, setShowProjectManagerOptions] = useState(false);

  const generatedProjectId = useMemo(
    () => buildProjectId(newProject.name, ep.current_projects, newProject.start_date),
    [newProject.name, newProject.start_date, ep.current_projects],
  );

  // Completeness
  const completeness = useMemo(() => {
    let total = 0;
    COMPLETENESS_FIELDS.forEach(({ key, src, w }) => {
      const val = key === "profile_photo"
        ? photoPreview
        : src === "basic" ? formData[key] : ep[key];
      if (src === "arr") {
        if (Array.isArray(val) && val.length > 0) total += w;
      } else if (key === "years_experience") {
        if (val !== "" && val !== null && val !== undefined) total += w;
      } else {
        if (val && String(val).trim()) total += w;
      }
    });
    return Math.min(100, total);
  }, [formData, ep, photoPreview]);

  useEffect(() => {
    fetchProfile();
  }, []);

  useEffect(() => {
    if (!showProjectForm || newProject.project_manager_id) return undefined;
    const token =
      localStorage.getItem("radai_access_token") ||
      localStorage.getItem("access");
    const controller = new AbortController();
    const timer = setTimeout(() => {
      setProjectManagersLoading(true);
      fetch(
        `${API_BASE_URL}/users/employees/project-managers/?search=${encodeURIComponent(projectManagerSearch.trim())}`,
        {
          headers: { Authorization: `Bearer ${token}` },
          signal: controller.signal,
        },
      )
        .then((r) => (r.ok ? r.json() : []))
        .then((data) =>
          setProjectManagers(
            Array.isArray(data) ? data : (data?.results ?? data?.employees ?? []),
          ),
        )
        .catch((error) => {
          if (error.name !== "AbortError") setProjectManagers([]);
        })
        .finally(() => setProjectManagersLoading(false));
    }, 250);
    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [projectManagerSearch, showProjectForm, newProject.project_manager_id]);

  useEffect(() => {
    const token =
      localStorage.getItem("radai_access_token") ||
      localStorage.getItem("access");
    fetch(`${API_BASE_URL}/rbac/users/reporting-managers/`, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then((r) => {
        if (!r.ok) throw new Error("Unable to load employees. Reload the page to try again.");
        return r.json();
      })
      .then((d) => {
        const managerList = Array.isArray(d)
          ? d
          : (d?.engineers ?? d?.results ?? []);
        setManagers(managerList);
      })
      .catch((error) => setManagersError(error.message))
      .finally(() => setManagersLoading(false));
  }, []);

  useEffect(() => {
    const token =
      localStorage.getItem("radai_access_token") ||
      localStorage.getItem("access");
    fetch(`${API_BASE_URL}/users/employees/my-employee-profile/`, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (!d) return;
        const emp = d.employee || {};
        setEmpData({
          branch: emp.branch || "",
          join_date: emp.join_date || "",
          division: emp.division || "",
          business_unit: emp.business_unit || "",
          business_area: emp.business_area || "",
          office: emp.office || "",
        });
        if (Array.isArray(d.branch_choices)) setBranchChoices(d.branch_choices);
      })
      .catch(() => {});
  }, []);

  const fetchProfile = async () => {
    try {
      setIsFetching(true);
      const token =
        localStorage.getItem("radai_access_token") ||
        localStorage.getItem("access");
      const ctrl = new AbortController();
      const tid = setTimeout(() => ctrl.abort(), 20000);
      const res = await fetch(`${API_BASE_URL}/rbac/users/me/?view=profile`, {
        headers: { Authorization: `Bearer ${token}` },
        signal: ctrl.signal,
      });
      clearTimeout(tid);
      if (!res.ok) throw new Error("Failed to fetch profile");
      const data = await res.json();
      setProfileData(data);
      setFormData({
        first_name: data.user?.first_name || "",
        last_name: data.user?.last_name || "",
        phone: data.phone || "",
        bio: data.bio || "",
        location: data.location || "",
        department: data.department || "",
        job_title: data.job_title || "",
        manager_id: data.manager_detail?.id || "",
      });
      if (data.profile_photo) setPhotoPreview(data.profile_photo);
      const saved = data.engineer_profile || {};
      setEp({ ...DEFAULT_EP, ...saved });
    } catch (err) {
      toast.error(
        err.name === "AbortError"
          ? "Profile load timed out"
          : "Failed to load profile",
      );
    } finally {
      setIsFetching(false);
    }
  };

  const savePersonalInfo = async () => {
    setIsLoading(true);
    setUploadProgress(0);
    try {
      const token =
        localStorage.getItem("radai_access_token") ||
        localStorage.getItem("access");
      const fd = new FormData();
      Object.entries(formData).forEach(([k, v]) => {
        if (v !== undefined) fd.append(k, v);
      });
      if (selectedFile) {
        fd.append("profile_photo", selectedFile);
        setUploadProgress(40);
      }
      const res = await fetch(`${API_BASE_URL}/rbac/users/me/`, {
        method: "PATCH",
        headers: { Authorization: `Bearer ${token}` },
        body: fd,
      });
      setUploadProgress(80);
      if (!res.ok) {
        const error = await res.json().catch(() => ({}));
        const fieldError = Object.values(error)
          .flat()
          .find((value) => typeof value === "string");
        throw new Error(
          error.error || error.detail || fieldError || "Update failed",
        );
      }
      const updated = await res.json();
      setUploadProgress(100);
      if (empDataChanged) {
        try {
          const empRes = await fetch(
            `${API_BASE_URL}/users/employees/my-employee-profile/`,
            {
              method: "PATCH",
              headers: {
                Authorization: `Bearer ${token}`,
                "Content-Type": "application/json",
              },
              body: JSON.stringify(empData),
            },
          );
          if (empRes.ok) setEmpDataChanged(false);
        } catch (_) {
          /* non-fatal */
        }
      }
      dispatch(updateUser(updated));
      await fetchProfile();
      setSelectedFile(null);
      toast.success("Personal information saved!");
    } catch (err) {
      toast.error(err.message || "Failed to save");
    } finally {
      setIsLoading(false);
      setUploadProgress(0);
    }
  };

  const saveEngineerProfile = async (
    successMsg = "Engineering profile saved!",
    profileData = ep,
  ) => {
    setIsLoading(true);
    try {
      const token =
        localStorage.getItem("radai_access_token") ||
        localStorage.getItem("access");
      const res = await fetch(`${API_BASE_URL}/rbac/users/me/`, {
        method: "PATCH",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ engineer_profile: profileData }),
      });
      if (!res.ok) {
        const error = await res.json().catch(() => ({}));
        const fieldError = Object.values(error)
          .flat()
          .find((value) => typeof value === "string");
        throw new Error(
          error.error || error.detail || fieldError || "Update failed",
        );
      }
      const updatedProfile = await res.json().catch(() => null);
      toast.success(successMsg);
      return updatedProfile?.engineer_profile || profileData;
    } catch (err) {
      toast.error(err.message || "Failed to save");
      return null;
    } finally {
      setIsLoading(false);
    }
  };

  const uploadPhotoOnly = async (file) => {
    setIsLoading(true);
    try {
      const token =
        localStorage.getItem("radai_access_token") ||
        localStorage.getItem("access");
      const fd = new FormData();
      fd.append("profile_photo", file);
      const res = await fetch(`${API_BASE_URL}/rbac/users/me/`, {
        method: "PATCH",
        headers: { Authorization: `Bearer ${token}` },
        body: fd,
      });
      if (!res.ok) {
        const e = await res.json();
        throw new Error(e.error || "Photo upload failed");
      }
      const updated = await res.json();
      if (updated.profile_photo) {
        setPhotoPreview(updated.profile_photo);
        dispatch(updateUser({ profile_photo: updated.profile_photo }));
      }
      setSelectedFile(null);
      toast.success("Profile photo updated!");
    } catch (err) {
      toast.error(err.message || "Failed to upload photo");
      setPhotoPreview(null);
    } finally {
      setIsLoading(false);
    }
  };

  const handleFileSelect = (file) => {
    const { isValid, errors } = validateFile(file);
    if (!isValid) {
      errors.forEach((e) => toast.error(e));
      return;
    }
    setSelectedFile(file);
    const reader = new FileReader();
    reader.onloadend = () => {
      setPhotoPreview(reader.result);
      uploadPhotoOnly(file);
    };
    reader.readAsDataURL(file);
  };

  const removeSkill = (name) =>
    setEp((p) => ({
      ...p,
      technical_skills: p.technical_skills.filter((s) => s.name !== name),
    }));

  const addCertification = () => {
    if (!newCert.name) {
      toast.error("Certification name is required");
      return;
    }
    setEp((p) => ({
      ...p,
      certifications: [...p.certifications, { ...newCert, id: Date.now() }],
    }));
    setNewCert({ name: "", issuer: "", year: "", expiry_date: "" });
    setShowCertForm(false);
  };
  const removeCert = (id) =>
    setEp((p) => ({
      ...p,
      certifications: p.certifications.filter((c) => c.id !== id),
    }));

  const getCertExpiryStatus = (expiryDate) => {
    if (!expiryDate) return null;
    const monthsLeft =
      (new Date(expiryDate) - new Date()) / (1000 * 60 * 60 * 24 * 30);
    if (monthsLeft < 0) return "expired";
    if (monthsLeft <= 6) return "expiring";
    return "valid";
  };

  const toggleArr = (key, val) =>
    setEp((p) => ({
      ...p,
      [key]: p[key].includes(val)
        ? p[key].filter((x) => x !== val)
        : [...p[key], val],
    }));

  const addProject = async () => {
    if (!newProject.name.trim()) {
      toast.error("Project name is required");
      return;
    }
    if (!newProject.role) {
      toast.error("Your role on the project is required");
      return;
    }
    if (!newProject.project_manager_id) {
      toast.error("Project Manager (PoM) is required");
      return;
    }
    const selectedPoM = projectManagers.find(
      (manager) => String(manager.user_id || manager.id) === String(newProject.project_manager_id),
    );
    if (!selectedPoM) {
      toast.error("Select an active Project Manager from the list");
      return;
    }
    const projectAssignment = {
      ...newProject,
      project_id: generatedProjectId,
      project_manager_id: selectedPoM.user_id || selectedPoM.id,
      project_manager_name:
        `${selectedPoM.first_name || ""} ${selectedPoM.last_name || ""}`.trim() ||
        selectedPoM.email,
      project_manager_email: selectedPoM.email || "",
      id: Date.now(),
    };
    const nextProfile = {
      ...ep,
      current_projects: [
        ...(ep.current_projects || []),
        projectAssignment,
      ],
    };
    const savedProfile = await saveEngineerProfile(
      "Project assignment added and saved!",
      nextProfile,
    );
    if (!savedProfile) return;
    setEp({ ...DEFAULT_EP, ...savedProfile });
    setNewProject(DEFAULT_PROJECT);
    setProjectManagerSearch("");
    setShowProjectManagerOptions(false);
    setShowProjectForm(false);
  };
  const removeProject = async (project, projectIndex) => {
    const projectLabel = project.name || project.project_id || "this project";
    if (!(await radaiConfirm(`Delete ${projectLabel} from your project assignments?`))) {
      return;
    }

    const projectKey = String(project.project_id || project.id || "");
    const nextProjects = (ep.current_projects || []).filter((candidate, index) => {
      if (projectKey) {
        return String(candidate.project_id || candidate.id || "") !== projectKey;
      }
      return index !== projectIndex;
    });
    const nextProfile = { ...ep, current_projects: nextProjects };
    const savedProfile = await saveEngineerProfile(
      "Project assignment deleted successfully!",
      nextProfile,
    );
    if (!savedProfile) return;
    setEp({ ...DEFAULT_EP, ...savedProfile });
  };
  const updateProjectStatus = (id, status) =>
    setEp((p) => ({
      ...p,
      current_projects: (p.current_projects || []).map((pr) =>
        pr.id === id ? { ...pr, status } : pr,
      ),
    }));

  const getUserInitials = () => {
    const f = formData.first_name || user?.first_name || "";
    const l = formData.last_name || user?.last_name || "";
    return `${f.charAt(0)}${l.charAt(0)}`.toUpperCase() || "U";
  };
  const careerTrack = defaultCareerTrack(ep.expertise_level, formData.department);
  const isCorporateCareer = careerTrack === "corporate";
  const functionCatalog = isCorporateCareer ? CORPORATE_FUNCTIONS : ENGINEERING_DISCIPLINES;
  const skillCatalog = isCorporateCareer ? CORPORATE_SKILLS : TECHNICAL_SKILLS_CATALOG;
  const currentExpertise = [...EXPERTISE_LEVELS, ...CORPORATE_CAREER_LEVELS].find(
    (e) => e.value === ep.expertise_level,
  );
  const currentAvail = AVAILABILITY_STATUSES.find(
    (a) => a.value === ep.availability_status,
  );
  const disciplineOptions = [
    ...functionCatalog,
    ...ep.engineering_disciplines.filter(
      (selected) =>
        !functionCatalog.some(
          (item) => item.toLowerCase() === selected.toLowerCase(),
        ),
    ),
  ];
  const completenessColor =
    completeness >= 80
      ? "bg-green-500"
      : completeness >= 50
        ? "bg-blue-500"
        : "bg-yellow-400";
  const completenessText =
    completeness >= 80
      ? "text-green-600"
      : completeness >= 50
        ? "text-blue-600"
        : "text-yellow-600";

  const inputCls =
    "w-full px-4 py-2.5 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white text-gray-900 placeholder-gray-400 transition-all";
  const labelCls = "block text-sm font-medium text-gray-700 mb-1.5";

  const TABS = [
    { id: "personal", label: "Personal", icon: User },
    { id: "expertise", label: "Career & Expertise", icon: Briefcase },
    { id: "certifications", label: "Certifications", icon: Award },
    { id: "achievements", label: "Achievements", icon: Trophy },
    { id: "experience", label: "Experience", icon: TrendingUp },
    { id: "social", label: "Social Links", icon: Globe },
    { id: "documents", label: "Documents", icon: FileText },
    { id: "availability", label: "Availability", icon: Calendar },
    { id: "projects", label: "Projects", icon: FolderOpen },
    { id: "exit", label: "Leave Rejlers", icon: LogOut, className: "text-red-600 hover:text-red-700" },
  ];

  if (isFetching) {
    return <EmployeeTabLoading message="Loading your engineering profile…" />;
  }

  return (
    <>
      <div className={embedded ? 'w-full min-w-0 max-w-full overflow-x-hidden' : 'min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-purple-50 px-3 py-5 sm:px-4 sm:py-6'}>
        <div className={embedded ? 'w-full min-w-0 max-w-full space-y-4' : 'w-full space-y-6'}>
          {/* ── Cross-link nav ── */}
          {!embedded && <PeopleNav activeId="profile" />}

          {/* ── Profile Hero ── */}
          {!embedded && <div className="bg-white rounded-2xl shadow-lg overflow-hidden">
            <div className="relative h-28 bg-gradient-to-r from-blue-600 via-purple-600 to-teal-500">
              <h1 className="absolute bottom-4 left-40 right-6 truncate text-2xl font-bold leading-tight text-white sm:right-8">
                {formData.first_name || formData.last_name
                  ? `${formData.first_name} ${formData.last_name}`.trim()
                  : profileEmail}
              </h1>
            </div>

            <div className="px-6 sm:px-8 pb-6">
              <div className="flex flex-col sm:flex-row sm:items-end gap-5 -mt-14 mb-5">
                <div
                  className={`relative w-28 h-28 rounded-full overflow-hidden ring-4 ring-white shadow-xl flex-shrink-0 cursor-pointer ${isDragging ? "ring-blue-400" : ""}`}
                  onDragOver={(e) => {
                    e.preventDefault();
                    setIsDragging(true);
                  }}
                  onDragLeave={() => setIsDragging(false)}
                  onDrop={(e) => {
                    e.preventDefault();
                    setIsDragging(false);
                    const f = e.dataTransfer.files[0];
                    if (f) handleFileSelect(f);
                  }}
                  onClick={() => fileInputRef.current?.click()}
                  title="Click or drag to change photo"
                >
                  <div className="absolute inset-0 bg-gradient-to-br from-blue-500 to-purple-500 flex items-center justify-center text-white text-4xl font-bold">
                    {getUserInitials()}
                  </div>
                  {photoPreview && (
                    <img
                      src={photoPreview}
                      alt="Profile"
                      className="absolute inset-0 w-full h-full object-cover"
                      onError={(e) => {
                        e.target.onerror = null;
                        setPhotoPreview(null);
                      }}
                    />
                  )}
                  <div className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 hover:opacity-100 transition-opacity rounded-full">
                    <Camera className="w-6 h-6 text-white" />
                  </div>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept={S3_UPLOAD_CONFIG.allowedFileTypes.join(",")}
                    onChange={(e) => {
                      const f = e.target.files[0];
                      if (f) handleFileSelect(f);
                    }}
                    className="hidden"
                  />
                </div>

                <div className="flex-1 pb-0.5">
                  <div className="flex flex-wrap items-center gap-2 mt-1">
                    {formData.job_title && (
                      <span className="text-gray-600 font-medium">
                        {formData.job_title}
                      </span>
                    )}
                    {formData.job_title && formData.department && (
                      <span className="text-gray-300">·</span>
                    )}
                    {formData.department && (
                      <span className="text-gray-500">
                        {DEPARTMENTS.find(
                          (d) => d.value === formData.department,
                        )?.label || formData.department}
                      </span>
                    )}
                    {currentExpertise && (
                      <span
                        className={`text-xs px-2.5 py-0.5 rounded-full border font-semibold ${currentExpertise.colorClass || "bg-blue-50 text-blue-700 border-blue-200"}`}
                      >
                        {currentExpertise.label}
                      </span>
                    )}
                  </div>
                  {formData.location && (
                    <p className="text-sm text-gray-400 mt-1 flex items-center gap-1">
                      <MapPin className="w-3.5 h-3.5" />
                      {formData.location}
                    </p>
                  )}
                </div>

                {currentAvail && (
                  <div
                    className={`flex-shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-full border text-sm font-semibold ${currentAvail.bgClass} ${currentAvail.textClass}`}
                  >
                    <span
                      className={`w-2 h-2 rounded-full ${currentAvail.badgeClass}`}
                    />
                    {currentAvail.label}
                  </div>
                )}
              </div>

              {ep.engineering_disciplines.length > 0 && (
                <div className="flex flex-wrap gap-1.5 mb-4">
                  {ep.engineering_disciplines.map((d) => (
                    <span
                      key={d}
                      className="text-xs bg-blue-50 text-blue-700 border border-blue-100 px-2 py-0.5 rounded-full font-medium"
                    >
                      {d}
                    </span>
                  ))}
                </div>
              )}

              <div>
                <div className="flex items-center justify-between text-sm mb-1.5">
                  <span className="text-gray-500 font-medium">
                    Profile Completeness
                  </span>
                  <span className={`font-bold ${completenessText}`}>
                    {completeness}%
                  </span>
                </div>
                <div className="w-full bg-gray-100 rounded-full h-2 overflow-hidden">
                  <div
                    className={`h-2 rounded-full transition-all duration-700 ${completenessColor}`}
                    style={{ width: `${completeness}%` }}
                  />
                </div>
                {completeness < 80 && (
                  <p className="text-xs text-gray-400 mt-1">
                    Complete engineering expertise &amp; certifications to reach
                    80% — required for project matching eligibility.
                  </p>
                )}
              </div>
            </div>
          </div>}

          {/* ── Tabbed Card ── */}
          <div className="career-profile-layout">
            <aside className="career-profile-sidebar">
              <nav aria-label="Career Profile sections">
                {TABS.filter(tab => tab.id !== 'exit').map(({id, label, icon: Icon}) => <button type="button" key={id} aria-current={activeTab === id ? 'page' : undefined} onClick={() => setActiveTab(id)}><Icon /><span>{label}</span></button>)}
              </nav>
              <div className="career-sidebar-progress"><strong>{completeness}% complete</strong><div role="progressbar" aria-label="Career profile completeness" aria-valuenow={completeness} aria-valuemin={0} aria-valuemax={100}><span style={{width: `${completeness}%`}} /></div><p>Keep going to build a stronger profile</p></div>
              <button className="career-sidebar-exit text-red-600 hover:text-red-700" type="button" aria-current={activeTab === 'exit' ? 'page' : undefined} onClick={() => setActiveTab('exit')}><LogOut /> Leave Rejlers</button>
            </aside>
            <div className="career-profile-content">
            {activeTab === "personal" && (
              <div className="career-personal">
                <fieldset className="career-form-panel career-form-group"><legend><h2>Personal information</h2></legend>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                  <div className="career-input-field">
                    <label htmlFor="career-field-first-name" className="sr-only">First Name</label>
                    <input id="career-field-first-name"
                      type="text"
                      value={formData.first_name}
                      onChange={(e) =>
                        setFormData((p) => ({
                          ...p,
                          first_name: e.target.value,
                        }))
                      }
                      className={inputCls}
                      placeholder="First name"
                    />
                  </div>
                  <div className="career-input-field">
                    <label htmlFor="career-field-last-name" className="sr-only">Last Name</label>
                    <input id="career-field-last-name"
                      type="text"
                      value={formData.last_name}
                      onChange={(e) =>
                        setFormData((p) => ({
                          ...p,
                          last_name: e.target.value,
                        }))
                      }
                      className={inputCls}
                      placeholder="Last name"
                    />
                  </div>
                  <div className="career-input-field">
                    <label htmlFor="career-field-email-address" className="sr-only">Email Address</label>
                    <input id="career-field-email-address"
                      type="email" placeholder="Email address"
                      value={profileEmail}
                      disabled
                      className="w-full px-4 py-2.5 border border-gray-200 rounded-lg bg-gray-50 text-gray-400 cursor-not-allowed"
                    />

                  </div>
                  <div className="career-input-field">
                    <label htmlFor="career-field-phone-number" className="sr-only">Phone Number</label>
                    <div className="relative">
                      <Phone className="absolute left-3 top-3 w-4 h-4 text-gray-400" />
                      <input id="career-field-phone-number"
                        type="tel"
                        value={formData.phone}
                        onChange={(e) =>
                          setFormData((p) => ({ ...p, phone: e.target.value }))
                        }
                        className={`${inputCls} pl-10`}
                        placeholder="Phone number"
                      />
                    </div>
                  </div>
                  <div className="career-input-field">
                    <label htmlFor="career-field-location" className="sr-only">Location</label>
                    <div className="relative">
                      <MapPin className="absolute left-3 top-3 w-4 h-4 text-gray-400" />
                      <input id="career-field-location"
                        type="text"
                        value={formData.location}
                        onChange={(e) =>
                          setFormData((p) => ({
                            ...p,
                            location: e.target.value,
                          }))
                        }
                        className={`${inputCls} pl-10`}
                        placeholder="Location"
                      />
                    </div>
                  </div>
                  <div className="career-input-field">
                    <label htmlFor="career-field-department" className="sr-only">Department</label>
                    <div className="relative">
                      <Building2 className="absolute left-3 top-3 w-4 h-4 text-gray-400 pointer-events-none" />
                      <select id="career-field-department"
                        value={formData.department}
                        onChange={(e) =>
                          setFormData((p) => ({
                            ...p,
                            department: e.target.value,
                          }))
                        }
                        className={`${inputCls} pl-10 appearance-none cursor-pointer`}
                      >
                        <option value="">Select department...</option>
                        {DEPARTMENTS.map((dept) => (
                          <option key={dept.value} value={dept.value}>
                            {dept.label}
                          </option>
                        ))}
                      </select>
                      <div className="absolute right-3 top-3 pointer-events-none text-gray-400">
                        <svg
                          className="w-4 h-4"
                          fill="none"
                          stroke="currentColor"
                          viewBox="0 0 24 24"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M19 9l-7 7-7-7"
                          />
                        </svg>
                      </div>
                    </div>

                  </div>
                </div></fieldset>
                <fieldset className="career-form-panel career-form-group"><legend><h2>Employment details</h2></legend><div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                  <div className="career-input-field">
                    <label htmlFor="career-field-job-title" className="sr-only">Job Title</label>
                    <input id="career-field-job-title"
                      type="text"
                      value={formData.job_title}
                      onChange={(e) =>
                        setFormData((p) => ({
                          ...p,
                          job_title: e.target.value,
                        }))
                      }
                      className={inputCls}
                      placeholder="Job title"
                    />
                  </div>
                  <div>
                    <ReportingManagerSelect
                      compact
                      employees={managers}
                      value={formData.manager_id}
                      selectedEmployee={profileData?.manager_detail}
                      onChange={manager_id => setFormData(previous => ({ ...previous, manager_id }))}
                      loading={managersLoading}
                      error={managersError}
                      inputClassName={inputCls}
                    />
                  </div>

                  <div className="career-employment-fields">
                    <div className="career-employment-fields">
                      {PROFILE_EMPLOYEE_FIELDS.map(({ key, label, type }) => (
                        <div key={key} className="career-input-field">
                          <label htmlFor={`career-employment-${key}`} className="sr-only">{label}</label>
                          {type === "select" ? (
                            <select id={`career-employment-${key}`}
                              value={empData[key] || ""}
                              onChange={(e) => setEmpField(key, e.target.value)}
                              className={inputCls}
                            >
                              <option value="">Select {label.toLowerCase()}</option>
                              {branchChoices.map((c) => (
                                <option key={c.value} value={c.value}>
                                  {c.label}
                                </option>
                              ))}
                            </select>
                          ) : (
                            <input id={`career-employment-${key}`}
                              type={type}
                              title={label}
                              value={empData[key] || ""}
                              onChange={(e) => setEmpField(key, e.target.value)}
                              className={inputCls}
                              placeholder={label}
                            />
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                </div></fieldset>
                <fieldset className="career-form-panel career-form-group"><legend><h2>Professional summary</h2></legend>
                  <div>
                    <label className="sr-only" htmlFor="career-bio">Professional Bio</label>
                    <textarea id="career-bio"
                      value={formData.bio}
                      onChange={(e) =>
                        setFormData((p) => ({ ...p, bio: e.target.value }))
                      }
                      rows={2}
                      maxLength={500}
                      className={`${inputCls} resize-none`}
                      placeholder="Brief professional summary — experience, expertise, notable achievements…"
                    />
                    <p className="text-xs text-gray-400 mt-1 text-right">
                      {formData.bio.length}/500
                    </p>
                  </div>
                </fieldset>

                {isLoading && selectedFile && (
                  <div className="flex items-center gap-2 p-3 bg-blue-50 rounded-lg border border-blue-100">
                    <Loader className="w-4 h-4 text-blue-500 animate-spin flex-shrink-0" />
                    <p className="text-sm text-blue-700 font-medium">
                      Uploading photo…
                    </p>
                  </div>
                )}
                {uploadProgress > 0 && (
                  <div className="w-full bg-gray-100 rounded-full h-1.5">
                    <div
                      className="bg-blue-500 h-1.5 rounded-full transition-all"
                      style={{ width: `${uploadProgress}%` }}
                    />
                  </div>
                )}



                <div className="career-save">
                  <button
                    onClick={savePersonalInfo}
                    disabled={isLoading}
                    className="px-6 py-2.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 flex items-center gap-2 font-semibold transition-all"
                  >
                    {isLoading ? (
                      <Loader className="w-4 h-4 animate-spin" />
                    ) : (
                      <Save className="w-4 h-4" />
                    )}
                    Save Update
                  </button>
                </div>
              </div>
            )}

            {/* ── Tab: Engineering Expertise ── */}
            {activeTab === "expertise" && (
              <div className="career-editor">
                <fieldset className="career-section career-form-group career-level-section"><legend><h3>Career level</h3></legend>
                  <div className="career-level-select">
                    <label className="sr-only" htmlFor="career-level">Career level</label>
                    <select id="career-level" value={ep.expertise_level} onChange={event => setEp(previous => ({...previous, expertise_level: event.target.value}))}>
                      <option value="">Select career level</option>
                      <optgroup label="Engineering">
                        {EXPERTISE_LEVELS.map(level => <option key={level.value} value={level.value}>{level.label}</option>)}
                      </optgroup>
                      <optgroup label="Corporate &amp; Operational Support">
                        {CORPORATE_CAREER_LEVELS.map(level => <option key={level.value} value={level.value}>{level.label}</option>)}
                      </optgroup>
                    </select>
                    {currentExpertise && <div className="career-level-badge"><Check aria-hidden="true" /><strong title={`${ep.years_experience === "" || ep.years_experience == null ? "" : `${ep.years_experience} Years of `}${currentExpertise.label}`}>{ep.years_experience !== "" && ep.years_experience != null ? `${ep.years_experience} Years of ` : ""}{currentExpertise.label}</strong></div>}
                  </div>
                  <div className="career-experience">
                    <label className="sr-only" htmlFor="career-years">Years of Experience</label>
                    <input
                      id="career-years"
                      type="number"
                      min="0"
                      max="50"
                      value={ep.years_experience}
                      onChange={(e) =>
                        setEp((p) => ({
                          ...p,
                          years_experience: e.target.value,
                        }))
                      }
                      className={inputCls}
                      placeholder="Years of experience"
                    />
                  </div>
                </fieldset>

                <fieldset className="career-section career-form-group"><legend><h3>
                    {isCorporateCareer ? "Functional Expertise" : "Engineering Disciplines"}
                  </h3></legend>
                  <CareerSelectionList label={isCorporateCareer ? 'Functional areas' : 'Engineering disciplines'} options={disciplineOptions} selected={ep.engineering_disciplines}
                    onAdd={name => setEp(previous => ({...previous, engineering_disciplines: [...previous.engineering_disciplines, name]}))}
                    onRemove={name => toggleArr('engineering_disciplines', name)} />
                </fieldset>

                <fieldset className="career-section career-form-group"><legend><h3>
                    {isCorporateCareer ? "Professional Skills & Software" : "Technical Skills & Software"}
                  </h3></legend>
                  <CareerSelectionList label={isCorporateCareer ? 'Professional skills & software' : 'Technical skills & software'} options={skillCatalog} selected={ep.technical_skills}
                    onAdd={(name, proficiency) => setEp(previous => ({...previous, technical_skills: [...previous.technical_skills, {name, proficiency}]}))}
                    onRemove={removeSkill}
                    onProficiency={(name, proficiency) => setEp(previous => ({...previous, technical_skills: previous.technical_skills.map(skill => skill.name === name ? {...skill, proficiency} : skill)}))} />
                </fieldset>

                <fieldset className="career-section career-form-group"><legend><h3>
                    <Globe className="w-4 h-4 text-gray-400" /> Languages
                  </h3></legend>
                  <div className="flex flex-wrap gap-2">
                    {LANGUAGES.map((l) => (
                      <button
                        key={l}
                        type="button"
                        aria-pressed={ep.languages.includes(l)}
                        onClick={() => toggleArr("languages", l)}
                        className={`px-3 py-1.5 rounded-full border text-sm font-medium transition-all ${
                          ep.languages.includes(l)
                            ? "bg-teal-600 text-white border-teal-600"
                            : "bg-white text-gray-600 border-gray-200 hover:border-teal-300"
                        }`}
                      >
                        {l}
                      </button>
                    ))}
                  </div>
                </fieldset>

                <footer className="career-save">
                  <button
                    onClick={() =>
                      saveEngineerProfile("Career profile updated!")
                    }
                    disabled={isLoading}
                    className="px-6 py-2.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 flex items-center gap-2 font-semibold"
                  >
                    {isLoading ? (
                      <Loader className="w-4 h-4 animate-spin" />
                    ) : (
                      <Save className="w-4 h-4" />
                    )}
                    Save Update
                  </button>
                </footer>
              </div>
            )}

            {/* ── Tab: Certifications ── */}
            {activeTab === "certifications" && (
              <div className="p-6 sm:p-8 space-y-6">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-base font-semibold text-gray-900">
                      Professional Certifications
                    </h3>
                    <p className="text-xs text-gray-400 mt-0.5">
                      Certifications visible to project managers for team
                      matching
                    </p>
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
                    <h4 className="text-sm font-semibold text-blue-800 mb-4">
                      New Certification
                    </h4>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div className="sm:col-span-2">
                        <label className={labelCls}>Certification Name *</label>
                        <select
                          value={newCert.name}
                          onChange={(e) =>
                            setNewCert((p) => ({ ...p, name: e.target.value }))
                          }
                          className={`${inputCls} mb-2`}
                        >
                          <option value="">Choose from catalogue…</option>
                          {CERTIFICATION_OPTIONS.map((c) => (
                            <option key={c} value={c}>
                              {c}
                            </option>
                          ))}
                        </select>
                        <input
                          type="text"
                          value={newCert.name}
                          onChange={(e) =>
                            setNewCert((p) => ({ ...p, name: e.target.value }))
                          }
                          className={inputCls}
                          placeholder="Or type a custom certification name"
                        />
                      </div>
                      <div>
                        <label className={labelCls}>Issuing Body</label>
                        <input
                          type="text"
                          value={newCert.issuer}
                          onChange={(e) =>
                            setNewCert((p) => ({
                              ...p,
                              issuer: e.target.value,
                            }))
                          }
                          className={inputCls}
                          placeholder="e.g. PMI, IChemE, ECITB"
                        />
                      </div>
                      <div>
                        <label className={labelCls}>Year Obtained</label>
                        <input
                          type="number"
                          min="1980"
                          max={new Date().getFullYear()}
                          value={newCert.year}
                          onChange={(e) =>
                            setNewCert((p) => ({ ...p, year: e.target.value }))
                          }
                          className={inputCls}
                          placeholder={String(new Date().getFullYear())}
                        />
                      </div>
                      <div>
                        <label className={labelCls}>
                          Expiry Date (if applicable)
                        </label>
                        <input
                          type="date"
                          value={newCert.expiry_date}
                          onChange={(e) =>
                            setNewCert((p) => ({
                              ...p,
                              expiry_date: e.target.value,
                            }))
                          }
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
                      <p className="text-sm font-medium">
                        No certifications added yet
                      </p>
                      <p className="text-xs mt-1 text-gray-400">
                        Add professional certifications to improve project
                        matching eligibility
                      </p>
                    </div>
                  ) : (
                    ep.certifications.map((cert) => {
                      const status = getCertExpiryStatus(cert.expiry_date);
                      const borderCls =
                        status === "expired"
                          ? "border-red-200 bg-red-50"
                          : status === "expiring"
                            ? "border-yellow-200 bg-yellow-50"
                            : "border-gray-100 bg-white hover:border-blue-100";
                      const iconCls =
                        status === "expired"
                          ? "text-red-500 bg-red-100"
                          : status === "expiring"
                            ? "text-yellow-500 bg-yellow-100"
                            : "text-blue-500 bg-blue-100";
                      const expCls =
                        status === "expired"
                          ? "text-red-600"
                          : status === "expiring"
                            ? "text-yellow-600"
                            : "text-green-600";
                      const expLabel =
                        status === "expired"
                          ? "⚠ Expired"
                          : status === "expiring"
                            ? "⚡ Expiring soon"
                            : "✓ Valid";
                      return (
                        <div
                          key={cert.id}
                          className={`flex items-start gap-4 p-4 rounded-xl border-2 transition-all ${borderCls}`}
                        >
                          <div
                            className={`w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 ${iconCls}`}
                          >
                            <Award className="w-5 h-5" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="font-semibold text-gray-900 text-sm">
                              {cert.name}
                            </p>
                            <p className="text-xs text-gray-400 mt-0.5">
                              {cert.issuer && <span>{cert.issuer}</span>}
                              {cert.issuer && cert.year && (
                                <span className="mx-1">·</span>
                              )}
                              {cert.year && <span>Obtained {cert.year}</span>}
                            </p>
                            {cert.expiry_date && (
                              <p
                                className={`text-xs mt-1 font-semibold ${expCls}`}
                              >
                                {expLabel} · {cert.expiry_date}
                              </p>
                            )}
                          </div>
                          <button
                            onClick={() => removeCert(cert.id)}
                            className="text-gray-200 hover:text-red-500 transition-colors flex-shrink-0 mt-0.5"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      );
                    })
                  )}
                </div>

                {ep.certifications.length > 0 && (
                  <div className="flex justify-end">
                    <button
                      onClick={() =>
                        saveEngineerProfile("Certifications saved!")
                      }
                      disabled={isLoading}
                      className="px-6 py-2.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 flex items-center gap-2 font-semibold"
                    >
                      {isLoading ? (
                        <Loader className="w-4 h-4 animate-spin" />
                      ) : (
                        <Save className="w-4 h-4" />
                      )}
                      Save Update
                    </button>
                  </div>
                )}
              </div>
            )}

            {/* ── Tab: Availability ── */}
            {activeTab === "availability" && (
              <div className="career-editor availability-editor">
                <fieldset className="career-section career-form-group"><legend><h3>Current availability</h3></legend>
                  <div className="availability-fields">
                    <div>
                      <label className="sr-only" htmlFor="availability-status">Availability status</label>
                      <select id="availability-status" value={ep.availability_status} onChange={event => setEp(previous => ({...previous, availability_status: event.target.value}))}>
                        {AVAILABILITY_STATUSES.map(status => <option key={status.value} value={status.value}>{status.label}</option>)}
                      </select>
                      {currentAvail && <div className={`availability-status-note ${currentAvail.textClass}`}><span className={`availability-dot ${currentAvail.badgeClass}`} /><strong>{currentAvail.label}</strong><span>{currentAvail.desc}</span></div>}
                    </div>
                    {(ep.availability_status === "busy" || ep.availability_status === "on_leave") && <div>
                      <label htmlFor="availability-next-date" className="availability-label">Next available date</label>
                      <input id="availability-next-date" type="date" value={ep.next_available_date || ''} onChange={event => setEp(previous => ({...previous, next_available_date: event.target.value}))} className={inputCls} />
                    </div>}
                  </div>
                </fieldset>
                <fieldset className="career-section career-form-group"><legend><h3>Project capacity</h3></legend>
                  <div className="availability-fields">
                    <div>
                      <div className="availability-bandwidth-heading"><label htmlFor="availability-bandwidth">Bandwidth available</label><output htmlFor="availability-bandwidth">{ep.availability_percentage}%</output></div>
                      <input id="availability-bandwidth" type="range" min="0" max="100" step="5" value={ep.availability_percentage} aria-valuetext={`${ep.availability_percentage}% available for new projects`} onChange={event => setEp(previous => ({...previous, availability_percentage: Number(event.target.value)}))} />
                      <div className="availability-range-labels"><span>0%</span><span>100%</span></div>
                    </div>
                    <div>
                      <label className="sr-only" htmlFor="availability-project-limit">Maximum concurrent projects</label>
                      <select id="availability-project-limit" value={ep.max_concurrent_projects} onChange={event => setEp(previous => ({...previous, max_concurrent_projects: Number(event.target.value)}))}>
                        {Array.from({length: 10}, (_, index) => index + 1).map(count => <option key={count} value={count}>{count} concurrent {count === 1 ? 'project' : 'projects'} maximum</option>)}
                      </select>
                    </div>
                  </div>
                </fieldset>
                <fieldset className="career-section career-form-group"><legend><h3>Preferred project types</h3></legend>
                  <CareerSelectionList label="Preferred project types" options={PROJECT_TYPES} selected={ep.preferred_project_types || []}
                    onAdd={name => setEp(previous => ({...previous, preferred_project_types: [...(previous.preferred_project_types || []), name]}))}
                    onRemove={name => toggleArr('preferred_project_types', name)} />
                </fieldset>
                <footer className="career-save"><button onClick={() => saveEngineerProfile("Availability updated!")} disabled={isLoading} className="px-6 py-2.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 flex items-center gap-2 font-semibold">
                  {isLoading ? <Loader className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />} Save Update
                </button></footer>
              </div>
            )}

            {/* ── Tab: Projects ── */}
            {activeTab === "projects" && (
              <div className="career-editor projects-editor">
                <div className="projects-heading">
                  <div>
                    <h3 className="text-base font-semibold text-gray-900">
                      Current Project Assignments
                    </h3>

                  </div>
                  <button
                    onClick={() => setShowProjectForm((v) => !v)}
                    className="flex items-center gap-1.5 px-4 py-2 bg-blue-600 text-white text-sm font-semibold rounded-lg hover:bg-blue-700 transition-all"
                  >
                    <Plus className="w-4 h-4" />
                    Add Project
                  </button>
                </div>

                {(ep.current_projects || []).length > 0 &&
                  (() => {
                    const totalAlloc = (ep.current_projects || []).reduce(
                      (s, p) => s + Number(p.allocation || 0),
                      0,
                    );
                    const active = (ep.current_projects || []).filter(
                      (p) => p.status === "active",
                    ).length;
                    return (
                      <div className="projects-summary">
                        <div className="bg-blue-50 border border-blue-100 rounded-xl p-4 text-center">
                          <p className="text-2xl font-extrabold text-blue-600">
                            {active}
                          </p>
                          <p className="text-xs text-blue-500 font-medium mt-0.5">
                            Active Projects
                          </p>
                        </div>
                        <div
                          className={`rounded-xl border p-4 text-center ${totalAlloc > 100 ? "bg-red-50 border-red-200" : "bg-emerald-50 border-emerald-100"}`}
                        >
                          <p
                            className={`text-2xl font-extrabold ${totalAlloc > 100 ? "text-red-600" : "text-emerald-600"}`}
                          >
                            {totalAlloc}%
                          </p>
                          <p
                            className={`text-xs font-medium mt-0.5 ${totalAlloc > 100 ? "text-red-500" : "text-emerald-500"}`}
                          >
                            Total Allocation{" "}
                            {totalAlloc > 100 ? "⚠ Over 100%" : ""}
                          </p>
                        </div>
                        <div className="bg-gray-50 border border-gray-200 rounded-xl p-4 text-center">
                          <p className="text-2xl font-extrabold text-gray-700">
                            {Math.max(0, 100 - totalAlloc)}%
                          </p>
                          <p className="text-xs text-gray-500 font-medium mt-0.5">
                            Remaining Bandwidth
                          </p>
                        </div>
                      </div>
                    );
                  })()}

                {showProjectForm && (
                  <fieldset className="career-section career-form-group projects-form"><legend><h3>New project assignment</h3></legend>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div>
                        <label className={labelCls}>Project Name *</label>
                        <input
                          value={newProject.name}
                          onChange={(e) =>
                            setNewProject((p) => ({
                              ...p,
                              name: e.target.value,
                            }))
                          }
                          placeholder="e.g. Offshore Platform FEED"
                          className={inputCls}
                        />
                      </div>
                      <div>
                        <label className={labelCls}>Project ID</label>
                        <input
                          value={generatedProjectId}
                          readOnly
                          placeholder="Generated after entering project name"
                          className={`${inputCls} bg-gray-100 font-mono text-gray-600`}
                        />
                        <p className="mt-1 text-xs text-gray-400">
                          Generated automatically as Project Name-0000-YYYY.
                        </p>
                      </div>
                      <div className="relative sm:col-span-2">
                        <label className={labelCls}>Project Manager (PoM) *</label>
                        <div className="relative">
                          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
                          <input
                            value={projectManagerSearch}
                            onChange={(e) => {
                              setProjectManagerSearch(e.target.value);
                              setNewProject((project) => ({
                                ...project,
                                project_manager_id: "",
                              }));
                              setShowProjectManagerOptions(true);
                            }}
                            onFocus={() => setShowProjectManagerOptions(true)}
                            placeholder={projectManagersLoading ? "Loading employees..." : "Search employee by name, ID, or email"}
                            className={`${inputCls} pl-9`}
                          />
                        </div>
                        {showProjectManagerOptions && (
                          <div className="absolute z-20 mt-1 max-h-56 w-full overflow-y-auto rounded-lg border border-gray-200 bg-white py-1 shadow-xl">
                            {projectManagersLoading ? (
                              <p className="px-3 py-2 text-xs text-gray-500">Searching employees...</p>
                            ) : projectManagers.length > 0 ? (
                              projectManagers.map((manager) => {
                                const managerId = manager.user_id || manager.id;
                                const managerName =
                                  `${manager.first_name || ""} ${manager.last_name || ""}`.trim() ||
                                  manager.email;
                                return (
                                  <button
                                    key={managerId}
                                    type="button"
                                    onClick={() => {
                                      setNewProject((project) => ({
                                        ...project,
                                        project_manager_id: managerId,
                                      }));
                                      setProjectManagerSearch(managerName);
                                      setShowProjectManagerOptions(false);
                                    }}
                                    className="flex w-full items-start justify-between gap-3 px-3 py-2 text-left hover:bg-blue-50"
                                  >
                                    <span className="min-w-0">
                                      <span className="block truncate text-sm font-semibold text-gray-800">{managerName}</span>
                                      <span className="block truncate text-xs text-gray-400">{manager.email}{manager.position ? ` · ${manager.position}` : ""}</span>
                                    </span>
                                    {manager.employee_number && <span className="shrink-0 text-xs font-medium text-gray-400">{manager.employee_number}</span>}
                                  </button>
                                );
                              })
                            ) : (
                              <p className="px-3 py-2 text-xs text-amber-600">No matching active employees found.</p>
                            )}
                          </div>
                        )}
                        <select
                          value={newProject.project_manager_id}
                          onChange={(e) =>
                            setNewProject((project) => ({
                              ...project,
                              project_manager_id: e.target.value,
                            }))
                          }
                          disabled={projectManagersLoading}
                          className="hidden"
                        >
                          <option value="">
                            {projectManagersLoading
                              ? "Loading Project Managers..."
                              : "— Select Project Manager —"}
                          </option>
                          {projectManagers.map((manager) => {
                            const managerId = manager.user_id || manager.id;
                            const managerName =
                              `${manager.first_name || ""} ${manager.last_name || ""}`.trim() ||
                              manager.email;
                            return (
                              <option key={managerId} value={managerId}>
                                {managerName}
                                {manager.position ? ` — ${manager.position}` : ""}
                              </option>
                            );
                          })}
                        </select>
                        <p className="mt-1 text-xs text-gray-400">
                          Search all active employees and select the person directly responsible for this project.
                        </p>
                        {!projectManagersLoading && projectManagers.length === 0 && (
                          <p className="mt-1 text-xs font-medium text-amber-600">
                            No matching active employees were found.
                          </p>
                        )}
                      </div>
                      <div>
                        <label className={labelCls}>Client / Company</label>
                        <input
                          value={newProject.client}
                          onChange={(e) =>
                            setNewProject((p) => ({
                              ...p,
                              client: e.target.value,
                            }))
                          }
                          placeholder="e.g. ADNOC, Saudi Aramco"
                          className={inputCls}
                        />
                      </div>
                      <div>
                        <label className={labelCls}>Your Role *</label>
                        <select
                          value={newProject.role}
                          onChange={(e) =>
                            setNewProject((p) => ({
                              ...p,
                              role: e.target.value,
                            }))
                          }
                          className={inputCls}
                        >
                          <option value="">— Select role —</option>
                          {PROJECT_ROLES.map((r) => (
                            <option key={r} value={r}>
                              {r}
                            </option>
                          ))}
                        </select>
                      </div>
                      <div>
                        <label className={labelCls}>Project Type</label>
                        <select
                          value={newProject.project_type}
                          onChange={(e) =>
                            setNewProject((p) => ({
                              ...p,
                              project_type: e.target.value,
                            }))
                          }
                          className={inputCls}
                        >
                          <option value="">— Select type —</option>
                          {PROJECT_TYPES.map((t) => (
                            <option key={t} value={t}>
                              {t}
                            </option>
                          ))}
                        </select>
                      </div>
                      <div>
                        <label className={labelCls}>
                          Allocation:{" "}
                          <span className="text-blue-600 font-bold">
                            {newProject.allocation}%
                          </span>
                        </label>
                        <input
                          type="range"
                          min="5"
                          max="100"
                          step="5"
                          value={newProject.allocation}
                          onChange={(e) =>
                            setNewProject((p) => ({
                              ...p,
                              allocation: Number(e.target.value),
                            }))
                          }
                          className="w-full accent-blue-600 cursor-pointer mt-2"
                        />
                      </div>
                      <div>
                        <label className={labelCls}>Status</label>
                        <select
                          value={newProject.status}
                          onChange={(e) =>
                            setNewProject((p) => ({
                              ...p,
                              status: e.target.value,
                            }))
                          }
                          className={inputCls}
                        >
                          {PROJECT_ASSIGNMENT_STATUSES.map((s) => (
                            <option key={s.value} value={s.value}>
                              {s.label}
                            </option>
                          ))}
                        </select>
                      </div>
                      <div>
                        <label className={labelCls}>Start Date</label>
                        <input
                          type="date"
                          value={newProject.start_date}
                          onChange={(e) =>
                            setNewProject((p) => ({
                              ...p,
                              start_date: e.target.value,
                            }))
                          }
                          className={inputCls}
                        />
                      </div>
                      <div>
                        <label className={labelCls}>Expected End Date</label>
                        <input
                          type="date"
                          value={newProject.end_date}
                          onChange={(e) =>
                            setNewProject((p) => ({
                              ...p,
                              end_date: e.target.value,
                            }))
                          }
                          className={inputCls}
                        />
                      </div>
                      <div className="sm:col-span-2">
                        <label className={labelCls}>Location / Site</label>
                        <input
                          value={newProject.location}
                          onChange={(e) =>
                            setNewProject((p) => ({
                              ...p,
                              location: e.target.value,
                            }))
                          }
                          placeholder="e.g. Abu Dhabi, Offshore"
                          className={inputCls}
                        />
                      </div>
                    </div>
                    <div className="flex gap-3 pt-1">
                      <button
                        onClick={addProject}
                        disabled={isLoading}
                        className="px-5 py-2 bg-blue-600 text-white rounded-lg text-sm font-semibold hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50 flex items-center gap-1.5"
                      >
                        {isLoading ? (
                          <Loader className="w-4 h-4 animate-spin" />
                        ) : (
                          <Check className="w-4 h-4" />
                        )}
                        {isLoading ? "Saving..." : "Add & Save"}
                      </button>
                      <button
                        onClick={() => {
                          setShowProjectForm(false);
                          setNewProject(DEFAULT_PROJECT);
                          setProjectManagerSearch("");
                          setShowProjectManagerOptions(false);
                        }}
                        className="px-5 py-2 bg-white border border-gray-200 text-gray-600 rounded-lg text-sm font-semibold hover:bg-gray-50 flex items-center gap-1.5"
                      >
                        <X className="w-4 h-4" /> Cancel
                      </button>
                    </div>
                  </fieldset>
                )}

                {(ep.current_projects || []).length === 0 ? (
                  <div className="projects-empty">
                    <FolderOpen className="w-16 h-16 mb-4" />
                    <p className="text-base font-semibold text-gray-400">
                      No project assignments yet
                    </p>
                    <p className="text-sm text-gray-300 mt-1">
                      Click &ldquo;Add Project&rdquo; to log your current work.
                    </p>
                  </div>
                ) : (
                  <div className="projects-list">
                    {(ep.current_projects || []).map((pr, projectIndex) => {
                      const si =
                        PROJECT_ASSIGNMENT_STATUSES.find(
                          (s) => s.value === pr.status,
                        ) || PROJECT_ASSIGNMENT_STATUSES[0];
                      return (
                        <div
                          key={pr.id}
                          className="project-assignment-row"
                        >

                          <div className="project-assignment-body">
                            <div className="flex items-start justify-between gap-3">
                              <div className="min-w-0">
                                <h4 className="font-bold text-gray-900 truncate">
                                  {pr.name}
                                </h4>
                                {pr.project_id && (
                                  <p className="mt-0.5 font-mono text-[11px] font-semibold text-blue-600">
                                    {pr.project_id}
                                  </p>
                                )}
                                {pr.client && (
                                  <p className="text-xs text-gray-400 mt-0.5">
                                    {pr.client}
                                  </p>
                                )}
                              </div>
                              <div className="flex items-center gap-2 shrink-0">
                                <span
                                  className={`px-2.5 py-0.5 rounded-full text-xs font-semibold flex items-center gap-1 ${si.bgClass}`}
                                >
                                  <span
                                    className={`w-1.5 h-1.5 rounded-full ${si.dotClass}`}
                                  />
                                  {si.label}
                                </span>
                                <button
                                  type="button"
                                  onClick={() => removeProject(pr, projectIndex)}
                                  disabled={isLoading}
                                  title="Delete project assignment"
                                  aria-label={`Delete ${pr.name}`}
                                  className="p-1.5 text-gray-300 hover:text-red-500 hover:bg-red-50 rounded-lg transition-all disabled:cursor-not-allowed disabled:opacity-40"
                                >
                                  <Trash2 className="w-4 h-4" />
                                </button>
                              </div>
                            </div>
                            <div className="mt-3 flex flex-wrap gap-x-6 gap-y-1.5 text-sm text-gray-600">
                              {pr.role && (
                                <span className="flex items-center gap-1.5">
                                  <Briefcase className="w-3.5 h-3.5 text-gray-400" />{" "}
                                  {pr.role}
                                </span>
                              )}
                              {pr.project_manager_name && (
                                <span className="flex items-center gap-1.5" title={pr.project_manager_email || "Project Manager"}>
                                  <User className="w-3.5 h-3.5 text-gray-400" />{" "}
                                  PoM: {pr.project_manager_name}
                                </span>
                              )}
                              {pr.location && (
                                <span className="flex items-center gap-1.5">
                                  <MapPin className="w-3.5 h-3.5 text-gray-400" />{" "}
                                  {pr.location}
                                </span>
                              )}
                              {pr.start_date && (
                                <span className="flex items-center gap-1.5">
                                  <Calendar className="w-3.5 h-3.5 text-gray-400" />
                                  {pr.start_date}
                                  {pr.end_date ? ` → ${pr.end_date}` : ""}
                                </span>
                              )}
                            </div>
                            <div className="mt-4">
                              <div className="flex justify-between text-xs text-gray-400 mb-1">
                                <span className="flex items-center gap-1">
                                  <TrendingUp className="w-3 h-3" /> Allocation
                                </span>
                                <span className="font-semibold text-gray-700">
                                  {pr.allocation || 0}%
                                </span>
                              </div>
                              <div className="w-full bg-gray-100 rounded-full h-2">
                                <div
                                  className={`h-2 rounded-full transition-all ${Number(pr.allocation) > 80 ? "bg-orange-500" : "bg-blue-500"}`}
                                  style={{ width: `${pr.allocation || 0}%` }}
                                />
                              </div>
                            </div>
                            <div className="project-status-control">
                              <label className="sr-only" htmlFor={`project-status-${pr.id}`}>Status for {pr.name}</label>
                              <select id={`project-status-${pr.id}`} value={pr.status} disabled={isLoading} onChange={event => updateProjectStatus(pr.id, event.target.value)}>
                                {PROJECT_ASSIGNMENT_STATUSES.map(status => <option key={status.value} value={status.value}>{status.label}</option>)}
                              </select>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}

                <div className="career-save">
                  <button
                    onClick={() =>
                      saveEngineerProfile("Project assignments saved!")
                    }
                    disabled={isLoading}
                    className="px-6 py-2.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 flex items-center gap-2 font-semibold"
                  >
                    {isLoading ? (
                      <Loader className="w-4 h-4 animate-spin" />
                    ) : (
                      <Save className="w-4 h-4" />
                    )}
                    Save Update
                  </button>
                </div>
              </div>
            )}

            {/* ── Tab: Achievements ── */}
            {activeTab === "achievements" && (
              <div className="p-6 sm:p-8">
                <AchievementSection />
              </div>
            )}

            {/* ── Tab: Work Experience ── */}
            {activeTab === "experience" && (
              <div className="p-6 sm:p-8">
                <WorkExperienceSection />
              </div>
            )}

            {/* ── Tab: Social Media Links ── */}
            {activeTab === "social" && (
              <div className="p-6 sm:p-8">
                <SocialMediaLinksSection />
              </div>
            )}

            {/* ── Tab: Documents ── */}
            {activeTab === "documents" && (
              <div className="p-6 sm:p-8">
                <DocumentUploadSection />
              </div>
            )}

            {/* ── Tab: Exit ── */}
            {activeTab === "exit" && (
              <div className="p-6 sm:p-8">
                <div className="flex flex-col items-center justify-center py-16">
                  <div className="w-16 h-16 rounded-full bg-red-100 flex items-center justify-center mb-4">
                    <LogOut className="w-8 h-8 text-red-500" />
                  </div>
                  <h3 className="text-xl font-bold text-gray-800 mb-2">
                    Initiate Exit Process
                  </h3>
                  <p className="text-gray-500 mb-6">
                    Start the offboarding process for this employee
                  </p>
                  <button
                    onClick={() => setShowExitModal(true)}
                    style={{
                      padding: "12px 32px",
                      background: "linear-gradient(135deg,#f43f8e,#ec4899)",
                      border: "none",
                      borderRadius: 12,
                      color: "#fff",
                      fontSize: 15,
                      fontWeight: 700,
                      cursor: "pointer",
                      boxShadow: "0 4px 14px rgba(244,63,142,0.4)",
                    }}
                  >
                    🚪 Initiate Exit
                  </button>
                </div>
              </div>
            )}
            </div>
          </div>
        </div>
      </div>

      {/* Exit Modal */}
      {showExitModal && (
        <InitiateExitModal
          initialEmployeeId={profileUserId}
          lockEmployee
          onClose={() => setShowExitModal(false)}
          onSuccess={() => {
            setShowExitModal(false);
            toast.success("Your exit request has been submitted to HR");
          }}
        />
      )}
    </>
  );
};

export default Profile;
