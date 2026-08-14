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
  { key: "first_name", src: "basic", w: 6 },
  { key: "last_name", src: "basic", w: 6 },
  { key: "phone", src: "basic", w: 4 },
  { key: "location", src: "basic", w: 4 },
  { key: "department", src: "basic", w: 4 },
  { key: "job_title", src: "basic", w: 6 },
  { key: "bio", src: "basic", w: 6 },
  { key: "expertise_level", src: "eng", w: 10 },
  { key: "years_experience", src: "eng", w: 6 },
  { key: "engineering_disciplines", src: "arr", w: 12 },
  { key: "technical_skills", src: "arr", w: 12 },
  { key: "certifications", src: "arr", w: 12 },
  { key: "availability_status", src: "eng", w: 6 },
  { key: "languages", src: "arr", w: 6 },
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

const Profile = () => {
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
  const [newDiscipline, setNewDiscipline] = useState("");
  const [selectedSkill, setSelectedSkill] = useState("");
  const [skillProficiency, setSkillProficiency] = useState(3);

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
      const val = src === "basic" ? formData[key] : ep[key];
      if (src === "arr") {
        if (Array.isArray(val) && val.length > 0) total += w;
      } else {
        if (val && String(val).trim()) total += w;
      }
    });
    return Math.min(100, total);
  }, [formData, ep]);

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
    fetch(`${API_BASE_URL}/rbac/users/engineers/`, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then((r) => (r.ok ? r.json() : { engineers: [] }))
      .then((d) => {
        const managerList = Array.isArray(d)
          ? d
          : (d?.engineers ?? d?.results ?? []);
        setManagers(managerList);
      })
      .catch(() => setManagers([]));
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
        if (k === "manager_id") {
          if (v) fd.append(k, v);
          return;
        }
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

  const addDiscipline = () => {
    const entered = newDiscipline.trim().replace(/\s+/g, " ");
    if (!entered) return;
    if (entered.length > 100) {
      toast.error("Discipline name must be 100 characters or fewer");
      return;
    }

    const canonical =
      ENGINEERING_DISCIPLINES.find(
        (d) => d.toLowerCase() === entered.toLowerCase(),
      ) || entered;
    if (
      ep.engineering_disciplines.some(
        (d) => d.toLowerCase() === canonical.toLowerCase(),
      )
    ) {
      toast.info("Discipline already selected");
      return;
    }
    setEp((p) => ({
      ...p,
      engineering_disciplines: [...p.engineering_disciplines, canonical],
    }));
    setNewDiscipline("");
  };

  const addSkill = () => {
    const entered = selectedSkill.trim().replace(/\s+/g, " ");
    if (!entered) return;
    if (entered.length > 100) {
      toast.error("Skill name must be 100 characters or fewer");
      return;
    }

    const canonical =
      TECHNICAL_SKILLS_CATALOG.find(
        (s) => s.toLowerCase() === entered.toLowerCase(),
      ) || entered;
    if (
      ep.technical_skills.some(
        (s) => String(s.name || "").toLowerCase() === canonical.toLowerCase(),
      )
    ) {
      toast.info("Skill already added");
      return;
    }
    setEp((p) => ({
      ...p,
      technical_skills: [
        ...p.technical_skills,
        { name: canonical, proficiency: skillProficiency },
      ],
    }));
    setSelectedSkill("");
    setSkillProficiency(3);
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
    if (!window.confirm(`Delete ${projectLabel} from your project assignments?`)) {
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
  const currentExpertise = EXPERTISE_LEVELS.find(
    (e) => e.value === ep.expertise_level,
  );
  const currentAvail = AVAILABILITY_STATUSES.find(
    (a) => a.value === ep.availability_status,
  );
  const disciplineOptions = [
    ...ENGINEERING_DISCIPLINES,
    ...ep.engineering_disciplines.filter(
      (selected) =>
        !ENGINEERING_DISCIPLINES.some(
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
    { id: "expertise", label: "Engineering", icon: Briefcase },
    { id: "certifications", label: "Certifications", icon: Award },
    { id: "achievements", label: "Achievements", icon: Trophy },
    { id: "experience", label: "Experience", icon: TrendingUp },
    { id: "social", label: "Social Links", icon: Globe },
    { id: "documents", label: "Documents", icon: FileText },
    { id: "availability", label: "Availability", icon: Calendar },
    { id: "projects", label: "Projects", icon: FolderOpen },
    { id: "exit", label: "Exit", icon: LogOut },
  ];

  if (isFetching) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-purple-50 flex items-center justify-center">
        <div className="text-center">
          <Loader className="w-12 h-12 animate-spin text-blue-600 mx-auto mb-4" />
          <p className="text-gray-600 font-medium">
            Loading your engineering profile…
          </p>
        </div>
      </div>
    );
  }

  return (
    <>
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-purple-50 px-3 py-5 sm:px-4 sm:py-6">
        <div className="w-full space-y-6">
          {/* ── Cross-link nav ── */}
          <PeopleNav activeId="profile" />

          {/* ── Profile Hero ── */}
          <div className="bg-white rounded-2xl shadow-lg overflow-hidden">
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
                        className={`text-xs px-2.5 py-0.5 rounded-full border font-semibold ${currentExpertise.colorClass}`}
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
          </div>

          {/* ── Tabbed Card ── */}
          <div className="bg-white rounded-2xl shadow-lg overflow-hidden">
            <div className="flex border-b border-gray-100 bg-gray-50/50">
              {TABS.map(({ id, label, icon: Icon }) => (
                <button
                  key={id}
                  onClick={() => setActiveTab(id)}
                  className={`flex-1 flex items-center justify-center gap-2 py-4 text-sm font-semibold transition-all ${
                    activeTab === id
                      ? "text-blue-600 border-b-2 border-blue-600 bg-white"
                      : "text-gray-500 hover:text-gray-700 hover:bg-white/70"
                  }`}
                >
                  <Icon className="w-4 h-4" />
                  <span className="hidden sm:inline">{label}</span>
                </button>
              ))}
            </div>

            {/* ── Tab: Personal ── */}
            {activeTab === "personal" && (
              <div className="p-6 sm:p-8 space-y-5">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                  <div>
                    <label className={labelCls}>First Name</label>
                    <input
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
                  <div>
                    <label className={labelCls}>Last Name</label>
                    <input
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
                  <div>
                    <label className={labelCls}>Email Address</label>
                    <input
                      type="email"
                      value={profileEmail}
                      disabled
                      className="w-full px-4 py-2.5 border border-gray-200 rounded-lg bg-gray-50 text-gray-400 cursor-not-allowed"
                    />
                    <p className="text-xs text-gray-400 mt-1">
                      Email cannot be changed
                    </p>
                  </div>
                  <div>
                    <label className={labelCls}>Phone Number</label>
                    <div className="relative">
                      <Phone className="absolute left-3 top-3 w-4 h-4 text-gray-400" />
                      <input
                        type="tel"
                        value={formData.phone}
                        onChange={(e) =>
                          setFormData((p) => ({ ...p, phone: e.target.value }))
                        }
                        className={`${inputCls} pl-10`}
                        placeholder="+971 50 123 4567"
                      />
                    </div>
                  </div>
                  <div>
                    <label className={labelCls}>Location</label>
                    <div className="relative">
                      <MapPin className="absolute left-3 top-3 w-4 h-4 text-gray-400" />
                      <input
                        type="text"
                        value={formData.location}
                        onChange={(e) =>
                          setFormData((p) => ({
                            ...p,
                            location: e.target.value,
                          }))
                        }
                        className={`${inputCls} pl-10`}
                        placeholder="Abu Dhabi, UAE"
                      />
                    </div>
                  </div>
                  <div>
                    <label className={labelCls}>Department</label>
                    <div className="relative">
                      <Building2 className="absolute left-3 top-3 w-4 h-4 text-gray-400 pointer-events-none" />
                      <select
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
                    {formData.department && (
                      <p className="text-xs text-green-600 mt-1 flex items-center gap-1">
                        <Check className="w-3 h-3" />
                        {DEPARTMENTS.find(
                          (d) => d.value === formData.department,
                        )?.label || formData.department}
                      </p>
                    )}
                  </div>
                  <div className="sm:col-span-2">
                    <label className={labelCls}>Job Title</label>
                    <input
                      type="text"
                      value={formData.job_title}
                      onChange={(e) =>
                        setFormData((p) => ({
                          ...p,
                          job_title: e.target.value,
                        }))
                      }
                      className={inputCls}
                      placeholder="Senior Process Engineer"
                    />
                  </div>
                  <div className="sm:col-span-2">
                    <label className={labelCls}>Reporting Manager</label>
                    <select
                      value={formData.manager_id || ""}
                      onChange={(e) =>
                        setFormData((p) => ({
                          ...p,
                          manager_id: e.target.value,
                        }))
                      }
                      className={inputCls}
                    >
                      <option value="">No reporting manager assigned</option>
                      {managers.map((m) => (
                        <option key={m.id} value={m.id}>
                          {m.name}
                          {m.job_title ? " - " + m.job_title : ""}
                          {m.department ? " (" + m.department + ")" : ""}
                        </option>
                      ))}
                    </select>
                    {managers.find((m) => m.id === formData.manager_id) && (
                      <p className="text-xs text-green-600 mt-1 flex items-center gap-1">
                        <Check className="w-3 h-3" />
                        Reporting to{" "}
                        {
                          managers.find((m) => m.id === formData.manager_id)
                            ?.name
                        }
                        {managers.find((m) => m.id === formData.manager_id)
                          ?.job_title &&
                          ` (${managers.find((m) => m.id === formData.manager_id)?.job_title})`}
                      </p>
                    )}
                  </div>

                  <div className="sm:col-span-2 pt-2 border-t border-gray-100">
                    <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-3 flex items-center gap-1.5">
                      <Building2 className="w-3.5 h-3.5" />
                      Organisation Details
                      <span className="font-normal normal-case text-gray-300 ml-1">
                        synced with Onboarding
                      </span>
                    </p>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      {PROFILE_EMPLOYEE_FIELDS.map(({ key, label, type }) => (
                        <div key={key}>
                          <label className={labelCls}>{label}</label>
                          {type === "select" ? (
                            <select
                              value={empData[key] || ""}
                              onChange={(e) => setEmpField(key, e.target.value)}
                              className={inputCls}
                            >
                              <option value="">Not set</option>
                              {branchChoices.map((c) => (
                                <option key={c.value} value={c.value}>
                                  {c.label}
                                </option>
                              ))}
                            </select>
                          ) : (
                            <input
                              type={type}
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
                  <div className="sm:col-span-2">
                    <label className={labelCls}>Professional Bio</label>
                    <textarea
                      value={formData.bio}
                      onChange={(e) =>
                        setFormData((p) => ({ ...p, bio: e.target.value }))
                      }
                      rows={4}
                      maxLength={500}
                      className={`${inputCls} resize-none`}
                      placeholder="Brief professional summary — experience, expertise, notable achievements…"
                    />
                    <p className="text-xs text-gray-400 mt-1 text-right">
                      {formData.bio.length}/500
                    </p>
                  </div>
                </div>

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

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-2 border-t border-gray-50">
                  {[
                    {
                      label: "Status",
                      val: profileData?.status || "Active",
                      pill: true,
                    },
                    {
                      label: "Organization",
                      val: profileData?.organization_name || "—",
                    },
                    {
                      label: "Member Since",
                      val: profileData?.created_at
                        ? new Date(profileData.created_at).toLocaleDateString(
                            "en-US",
                            { month: "short", year: "numeric" },
                          )
                        : "—",
                    },
                    {
                      label: "Employee ID",
                      val: profileData?.employee_id || "—",
                    },
                  ].map(({ label, val, pill }) => (
                    <div key={label} className="bg-gray-50 rounded-lg p-3">
                      <p className="text-xs text-gray-400 mb-0.5">{label}</p>
                      {pill ? (
                        <span
                          className={`text-xs px-2 py-0.5 rounded-full font-semibold ${profileData?.status === "active" ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-500"}`}
                        >
                          {val}
                        </span>
                      ) : (
                        <p className="text-sm font-semibold text-gray-800 truncate">
                          {val}
                        </p>
                      )}
                    </div>
                  ))}
                </div>

                <div className="flex justify-end">
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
                    Save Personal Info
                  </button>
                </div>
              </div>
            )}

            {/* ── Tab: Engineering Expertise ── */}
            {activeTab === "expertise" && (
              <div className="p-6 sm:p-8 space-y-8">
                <div>
                  <h3 className="text-base font-semibold text-gray-900 mb-3">
                    Career Level
                  </h3>
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mb-5">
                    {EXPERTISE_LEVELS.map((lvl) => (
                      <button
                        key={lvl.value}
                        type="button"
                        onClick={() =>
                          setEp((p) => ({ ...p, expertise_level: lvl.value }))
                        }
                        className={`p-3 rounded-xl border-2 text-left transition-all ${
                          ep.expertise_level === lvl.value
                            ? `${lvl.colorClass} shadow-md`
                            : "bg-gray-50 border-gray-200 hover:border-gray-300"
                        }`}
                      >
                        <div
                          className={`w-2.5 h-2.5 rounded-full mb-2 ${lvl.dotClass}`}
                        />
                        <p className="text-sm font-bold text-gray-900 leading-tight">
                          {lvl.label}
                        </p>
                        <p className="text-xs text-gray-500 mt-0.5">
                          {lvl.years}
                        </p>
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
                      onChange={(e) =>
                        setEp((p) => ({
                          ...p,
                          years_experience: e.target.value,
                        }))
                      }
                      className={inputCls}
                      placeholder="e.g. 12"
                    />
                  </div>
                </div>

                <div>
                  <h3 className="text-base font-semibold text-gray-900 mb-1">
                    Engineering Disciplines
                  </h3>
                  <p className="text-xs text-gray-400 mb-3">
                    Select all disciplines you are competent in
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {disciplineOptions.map((d) => (
                      <button
                        key={d}
                        type="button"
                        onClick={() => toggleArr("engineering_disciplines", d)}
                        className={`px-3 py-1.5 rounded-full border text-sm font-medium transition-all ${
                          ep.engineering_disciplines.includes(d)
                            ? "bg-blue-600 text-white border-blue-600 shadow-sm"
                            : "bg-white text-gray-600 border-gray-200 hover:border-blue-300 hover:text-blue-600"
                        }`}
                      >
                        {ep.engineering_disciplines.includes(d) && (
                          <Check className="inline w-3.5 h-3.5 mr-1 -mt-0.5" />
                        )}
                        {d}
                      </button>
                    ))}
                  </div>
                  <div className="mt-3 flex max-w-xl gap-2">
                    <input
                      type="text"
                      value={newDiscipline}
                      maxLength={100}
                      onChange={(e) => setNewDiscipline(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") {
                          e.preventDefault();
                          addDiscipline();
                        }
                      }}
                      className={`${inputCls} flex-1`}
                      placeholder="Add another engineering discipline…"
                    />
                    <button
                      type="button"
                      onClick={addDiscipline}
                      disabled={!newDiscipline.trim()}
                      className="inline-flex items-center gap-1 rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:bg-gray-300"
                    >
                      <Plus className="h-4 w-4" /> Add
                    </button>
                  </div>
                </div>

                <div>
                  <h3 className="text-base font-semibold text-gray-900 mb-1">
                    Technical Skills &amp; Software
                  </h3>
                  <p className="text-xs text-gray-400 mb-3">
                    Add tools and competencies with proficiency level (★)
                  </p>
                  <div className="flex gap-2 mb-4">
                    <div className="flex-1">
                      <input
                        type="text"
                        list="technical-skills-catalog"
                        value={selectedSkill}
                        maxLength={100}
                        onChange={(e) => setSelectedSkill(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") {
                            e.preventDefault();
                            addSkill();
                          }
                        }}
                        className="w-full px-3 py-2.5 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 bg-white text-gray-700"
                        placeholder="Select or type a technical skill…"
                      />
                      <datalist id="technical-skills-catalog">
                        {TECHNICAL_SKILLS_CATALOG.filter(
                          (s) =>
                            !ep.technical_skills.some(
                              (ts) =>
                                String(ts.name || "").toLowerCase() ===
                                s.toLowerCase(),
                            ),
                        ).map((s) => (
                          <option key={s} value={s} />
                        ))}
                      </datalist>
                    </div>
                    <div className="flex items-center gap-0.5 bg-gray-50 border border-gray-200 rounded-lg px-3">
                      {[1, 2, 3, 4, 5].map((n) => (
                        <button
                          key={n}
                          type="button"
                          onClick={() => setSkillProficiency(n)}
                        >
                          <Star
                            className={`w-4 h-4 transition-colors ${n <= skillProficiency ? "text-yellow-400 fill-yellow-400" : "text-gray-300"}`}
                          />
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
                    {ep.technical_skills.map((sk) => (
                      <div
                        key={sk.name}
                        className="flex items-center gap-1.5 bg-white border border-gray-200 rounded-full pl-3 pr-1.5 py-1 text-sm shadow-sm"
                      >
                        <span className="font-medium text-gray-800">
                          {sk.name}
                        </span>
                        <span className="flex gap-0.5">
                          {[1, 2, 3, 4, 5].map((n) => (
                            <Star
                              key={n}
                              className={`w-3 h-3 ${n <= sk.proficiency ? "text-yellow-400 fill-yellow-400" : "text-gray-200"}`}
                            />
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
                      <p className="text-sm text-gray-400 italic">
                        No skills added yet
                      </p>
                    )}
                  </div>
                </div>

                <div>
                  <h3 className="text-base font-semibold text-gray-900 mb-3 flex items-center gap-1.5">
                    <Globe className="w-4 h-4 text-gray-400" /> Languages
                  </h3>
                  <div className="flex flex-wrap gap-2">
                    {LANGUAGES.map((l) => (
                      <button
                        key={l}
                        type="button"
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
                </div>

                <div className="flex justify-end">
                  <button
                    onClick={() =>
                      saveEngineerProfile("Engineering profile saved!")
                    }
                    disabled={isLoading}
                    className="px-6 py-2.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 flex items-center gap-2 font-semibold"
                  >
                    {isLoading ? (
                      <Loader className="w-4 h-4 animate-spin" />
                    ) : (
                      <Save className="w-4 h-4" />
                    )}
                    Save Engineering Profile
                  </button>
                </div>
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
                      Save Certifications
                    </button>
                  </div>
                )}
              </div>
            )}

            {/* ── Tab: Availability ── */}
            {activeTab === "availability" && (
              <div className="p-6 sm:p-8 space-y-8">
                <div>
                  <h3 className="text-base font-semibold text-gray-900 mb-3">
                    Current Availability
                  </h3>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                    {AVAILABILITY_STATUSES.map((a) => (
                      <button
                        key={a.value}
                        type="button"
                        onClick={() =>
                          setEp((p) => ({ ...p, availability_status: a.value }))
                        }
                        className={`p-4 rounded-xl border-2 text-left transition-all ${
                          ep.availability_status === a.value
                            ? `${a.bgClass} shadow-md`
                            : "bg-white border-gray-200 hover:border-gray-300"
                        }`}
                      >
                        <div
                          className={`w-3 h-3 rounded-full mb-2.5 ${a.badgeClass}`}
                        />
                        <p className={`text-sm font-bold ${a.textClass}`}>
                          {a.label}
                        </p>
                        <p className="text-xs text-gray-400 mt-0.5 leading-tight">
                          {a.desc}
                        </p>
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <h3 className="text-base font-semibold text-gray-900 mb-1">
                    Bandwidth Available:{" "}
                    <span className="text-blue-600 font-bold">
                      {ep.availability_percentage}%
                    </span>
                  </h3>
                  <p className="text-xs text-gray-400 mb-3">
                    What percentage of your time can be allocated to new
                    projects?
                  </p>
                  <div className="flex items-center gap-4">
                    <span className="text-xs text-gray-400 w-5">0%</span>
                    <input
                      type="range"
                      min="0"
                      max="100"
                      step="5"
                      value={ep.availability_percentage}
                      onChange={(e) =>
                        setEp((p) => ({
                          ...p,
                          availability_percentage: Number(e.target.value),
                        }))
                      }
                      className="flex-1 accent-blue-600 cursor-pointer"
                    />
                    <span className="text-xs text-gray-400 w-8 text-right">
                      100%
                    </span>
                  </div>
                  <div className="mt-2 w-full bg-gray-100 rounded-full h-2 overflow-hidden">
                    <div
                      className="bg-blue-500 h-2 rounded-full transition-all"
                      style={{ width: `${ep.availability_percentage}%` }}
                    />
                  </div>
                </div>

                {(ep.availability_status === "busy" ||
                  ep.availability_status === "on_leave") && (
                  <div className="max-w-xs">
                    <label className={labelCls}>
                      <Clock className="inline w-4 h-4 mr-1 text-gray-400" />{" "}
                      Next Available Date
                    </label>
                    <input
                      type="date"
                      value={ep.next_available_date}
                      onChange={(e) =>
                        setEp((p) => ({
                          ...p,
                          next_available_date: e.target.value,
                        }))
                      }
                      className={inputCls}
                    />
                  </div>
                )}

                <div>
                  <h3 className="text-base font-semibold text-gray-900 mb-3">
                    Maximum Concurrent Projects
                  </h3>
                  <div className="flex items-center gap-4">
                    <button
                      onClick={() =>
                        setEp((p) => ({
                          ...p,
                          max_concurrent_projects: Math.max(
                            1,
                            p.max_concurrent_projects - 1,
                          ),
                        }))
                      }
                      className="w-10 h-10 rounded-full border-2 border-gray-200 bg-white flex items-center justify-center text-lg font-bold text-gray-600 hover:bg-gray-50 transition-all"
                    >
                      −
                    </button>
                    <span className="text-3xl font-bold text-gray-900 w-10 text-center">
                      {ep.max_concurrent_projects}
                    </span>
                    <button
                      onClick={() =>
                        setEp((p) => ({
                          ...p,
                          max_concurrent_projects: Math.min(
                            10,
                            p.max_concurrent_projects + 1,
                          ),
                        }))
                      }
                      className="w-10 h-10 rounded-full border-2 border-gray-200 bg-white flex items-center justify-center text-lg font-bold text-gray-600 hover:bg-gray-50 transition-all"
                    >
                      +
                    </button>
                    <span className="text-sm text-gray-500">
                      projects at once
                    </span>
                  </div>
                </div>

                <div>
                  <h3 className="text-base font-semibold text-gray-900 mb-3">
                    Preferred Project Types
                  </h3>
                  <div className="flex flex-wrap gap-2">
                    {PROJECT_TYPES.map((pt) => (
                      <button
                        key={pt}
                        type="button"
                        onClick={() => toggleArr("preferred_project_types", pt)}
                        className={`px-3 py-1.5 rounded-full border text-sm font-medium transition-all ${
                          ep.preferred_project_types.includes(pt)
                            ? "bg-purple-600 text-white border-purple-600"
                            : "bg-white text-gray-600 border-gray-200 hover:border-purple-300"
                        }`}
                      >
                        {pt}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="flex justify-end">
                  <button
                    onClick={() => saveEngineerProfile("Availability updated!")}
                    disabled={isLoading}
                    className="px-6 py-2.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 flex items-center gap-2 font-semibold"
                  >
                    {isLoading ? (
                      <Loader className="w-4 h-4 animate-spin" />
                    ) : (
                      <Save className="w-4 h-4" />
                    )}
                    Save Availability
                  </button>
                </div>
              </div>
            )}

            {/* ── Tab: Projects ── */}
            {activeTab === "projects" && (
              <div className="p-6 sm:p-8 space-y-6">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-base font-semibold text-gray-900">
                      Current Project Assignments
                    </h3>
                    <p className="text-xs text-gray-400 mt-0.5">
                      Let management know what you are actively working on.
                    </p>
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
                      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
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
                  <div className="bg-blue-50 border border-blue-200 rounded-xl p-5 space-y-4">
                    <h4 className="font-semibold text-blue-800 text-sm">
                      New Project Assignment
                    </h4>
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
                  </div>
                )}

                {(ep.current_projects || []).length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-16 text-gray-300">
                    <FolderOpen className="w-16 h-16 mb-4" />
                    <p className="text-base font-semibold text-gray-400">
                      No project assignments yet
                    </p>
                    <p className="text-sm text-gray-300 mt-1">
                      Click &ldquo;Add Project&rdquo; to log your current work.
                    </p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {(ep.current_projects || []).map((pr, projectIndex) => {
                      const si =
                        PROJECT_ASSIGNMENT_STATUSES.find(
                          (s) => s.value === pr.status,
                        ) || PROJECT_ASSIGNMENT_STATUSES[0];
                      return (
                        <div
                          key={pr.id}
                          className="bg-white border border-gray-100 rounded-xl shadow-sm overflow-hidden"
                        >
                          <div className={`h-1 w-full ${si.dotClass}`} />
                          <div className="p-5">
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
                            <div className="mt-3 flex items-center gap-2">
                              <span className="text-xs text-gray-400">
                                Update status:
                              </span>
                              {PROJECT_ASSIGNMENT_STATUSES.map((s) => (
                                <button
                                  key={s.value}
                                  onClick={() =>
                                    updateProjectStatus(pr.id, s.value)
                                  }
                                  className={`px-2.5 py-0.5 rounded-full text-xs font-medium border transition-all ${
                                    pr.status === s.value
                                      ? `${s.bgClass} border-transparent shadow-sm`
                                      : "bg-white border-gray-200 text-gray-500 hover:border-gray-300"
                                  }`}
                                >
                                  {s.label}
                                </button>
                              ))}
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}

                <div className="flex justify-end pt-2">
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
                    Save Projects
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
