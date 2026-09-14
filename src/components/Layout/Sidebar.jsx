import { resolveRouteModule, canAccessRouteModule } from '../../config/serviceAccess.config';
import React, { useRef, useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { useSelector, useDispatch } from "react-redux";
import { updateUser } from "../../store/slices/authSlice";
import { API_BASE_URL } from "../../config/api.config";
import { getSectionTitle } from "../../config/navigationLabels.config";
import { getEngineeringDisciplines } from "../../config/engineeringStructure.config";
import { SIDEBAR } from "../../config/layout.config";
import { getActiveSidebarItem } from "../../utils/sidebarNavigation";
import useSidebarDrawer from "../../hooks/useSidebarDrawer";
import "./Sidebar.css";
import { FEATURE_FLAGS } from "../../config/features.config";
import {
  QHSE_MODULE_LABELS,
} from "../../config/qhseModules.config";
import {
  ChevronDownIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  HomeIcon,
  DocumentTextIcon,
  DocumentPlusIcon,
  CogIcon,
  UsersIcon,
  ChartBarIcon,
  XMarkIcon,
  FolderIcon,
  CurrencyDollarIcon,
  ShieldCheckIcon,
  TableCellsIcon,
  SparklesIcon,
  BuildingOffice2Icon,
  WrenchScrewdriverIcon,
  RectangleGroupIcon,
  RectangleStackIcon,
  PresentationChartLineIcon,
  ClipboardDocumentListIcon,
  ArrowRightStartOnRectangleIcon,
  LightBulbIcon,
  ShoppingCartIcon,
  IdentificationIcon,
  EnvelopeIcon,
} from "@heroicons/react/24/outline";

/**
 * Sidebar Navigation Component
 * Professional hierarchical menu for RADAI platform
 */

// ΓöÇΓöÇ SOFT-CODED: Admin Module Codes ΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇ
// Array of module codes that grant access to the Admin section (9. Admin).
// Add new admin features here to auto-enable admin section visibility.
const ADMIN_MODULE_CODES = [
  "admin_dashboard",
  "user_mgmt",
  "role_access_mgmt",
  "wrench_integration",
  "ai_champion",
  "enquiry_management",
];

// Only one primary navigation group may be expanded at a time. Nested
// Engineering disciplines use the same accordion rule within Engineering.
const TOP_LEVEL_ACCORDION_IDS = [
  "processEngineering",
  "crs",
  "finance",
  "human_resource",
  "sales",
  "projectControl",
  "procurement",
  "qhse",
  "admin",
];

// Strip HTML/script markup from string fields before persisting API data to
// localStorage - defense-in-depth against stored-XSS if upstream data is
// ever tainted (e.g. an unsanitized profile field round-tripped from the API).
const sanitizeForStorage = (value) => {
  if (typeof value === "string") {
    return value.replace(/<[^>]*>/g, "");
  }
  if (Array.isArray(value)) {
    return value.map(sanitizeForStorage);
  }
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value).map(([k, v]) => [k, sanitizeForStorage(v)]),
    );
  }
  return value;
};
// ΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇ

const Sidebar = ({
  isOpen,
  setIsOpen,
  isCollapsed: isCollapsedProp,
  setIsCollapsed: setIsCollapsedProp,
}) => {
  const location = useLocation();
  const sidebarRef = useRef(null);
  const dispatch = useDispatch();
  const { user } = useSelector((state) => state.auth);
  const [userModules, setUserModules] = useState([]);
  // SOFT-CODED: freshIsAdmin is set from the live /rbac/users/me/ response so that
  // stale localStorage data does not permanently hide menu items until re-login.
  const [freshIsAdmin, setFreshIsAdmin] = useState(false);
  // If parent Layout drives collapse state, use those props; otherwise
  // fall back to local state so the component still works standalone.
  const [internalCollapsed, setInternalCollapsed] = useState(false);
  const isCollapsed =
    isCollapsedProp !== undefined ? isCollapsedProp : internalCollapsed;
  const setIsCollapsed = setIsCollapsedProp || setInternalCollapsed;
  const [expandedSections, setExpandedSections] = useState({});
  const [tooltip, setTooltip] = useState(null);
  const isMobileDrawer = useSidebarDrawer({ sidebarRef, isOpen, setIsOpen });

  // Handle nested user object from API response (user.user.is_staff vs user.is_staff)
  const userData = user?.user || user;

  // Check admin status from multiple sources (SOFT-CODED):
  // SECURITY FIX: is_staff does NOT grant admin access (only Django admin panel)
  // 1. ONLY is_superuser flag (emergency access)
  // 2. Roles array (contains 'Super Administrator', 'Administrator', or 'ICT Administrator' role)
  // 3. User has any admin module code assigned (soft-coded check)
  const hasSuperuserFlag = userData?.is_superuser === true;
  const hasSuperAdminRole = user?.roles?.some(
    (role) =>
      role.code === "super_admin" || role.name === "Super Administrator",
  );
  const hasAdminRole = user?.roles?.some(
    (role) =>
      role.code === "admin" ||
      role.code === "ict_admin" || // ICT Admin added (soft-coded)
      role.name === "Administrator" ||
      role.name === "ICT Administrator",
  );
  const hasAdminModule = userModules.some((code) =>
    ADMIN_MODULE_CODES.includes(code),
  );

  // isAdmin: MODULE-BASED access control (soft-coded)
  // Does NOT use is_staff flag - only is_superuser, super_admin/admin/ict_admin role, or admin modules
  const isAdmin =
    hasSuperuserFlag ||
    hasSuperAdminRole ||
    hasAdminRole ||
    freshIsAdmin ||
    hasAdminModule;

  // Fetch user's accessible modules
  React.useEffect(() => {
    const fetchUserModules = async () => {
      try {
        const token =
          localStorage.getItem("radai_access_token") ||
          localStorage.getItem("access");
        const apiUrl = `${API_BASE_URL}/rbac/users/me/`;
        console.log("≡ƒöÉ Fetching modules from:", apiUrl);
        const response = await fetch(apiUrl, {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        });

        if (!response.ok) {
          console.error("Failed to fetch modules, status:", response.status);
          return;
        }

        const data = await response.json();
        console.log("≡ƒöÉ Full user data:", data);

        // ΓöÇΓöÇ Derive admin status from live API response ΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇ
        // SECURITY FIX: is_staff does NOT grant admin access
        // Only is_superuser flag or super_admin role grants admin section access
        const apiIsAdmin =
          data.user?.is_superuser === true ||
          data.roles?.some(
            (r) => r.code === "super_admin" || r.name === "Super Administrator",
          ) ||
          (data.modules &&
            data.modules.some((m) => ADMIN_MODULE_CODES.includes(m.code)));
        if (apiIsAdmin) {
          setFreshIsAdmin(true);
          console.log("Γ£à Admin status confirmed from live API");
        } else {
          setFreshIsAdmin(false);
          console.log("ΓÜá∩╕Å  Admin status: FALSE (no admin role or modules)");
        }

        // ΓöÇΓöÇ Sync Redux store with fresh auth data ΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇ
        // Dispatches only when the payload actually differs to avoid
        // triggering an infinite update loop (effect depends on user?.id,
        // not on the nested user.user object or roles).
        const shouldUpdateUser =
          data.user &&
          (data.user.is_staff !== user?.user?.is_staff ||
            data.user.is_superuser !== user?.user?.is_superuser);
        const shouldUpdateRoles =
          data.roles &&
          JSON.stringify(data.roles) !== JSON.stringify(user?.roles);
        if (shouldUpdateUser || shouldUpdateRoles) {
          dispatch(
            updateUser({
              ...(shouldUpdateUser ? { user: data.user } : {}),
              ...(shouldUpdateRoles ? { roles: data.roles } : {}),
            }),
          );
          // Also persist corrected auth data to localStorage so the next
          // page reload doesn't start with stale Redux state.
          try {
            const storedRaw = localStorage.getItem("radai_user_data");
            const stored = storedRaw ? JSON.parse(storedRaw) : {};
            const merged = {
              ...stored,
              ...(shouldUpdateUser ? { user: data.user } : {}),
              ...(shouldUpdateRoles ? { roles: data.roles } : {}),
            };
            localStorage.setItem(
              "radai_user_data",
              JSON.stringify(sanitizeForStorage(merged)),
            );
            console.log("Γ£à User auth data persisted to localStorage");
          } catch (_) {
            /* non-fatal */
          }
          console.log("Γ£à User auth data synced from live API");
        }

        // Update Redux store with profile photo and other user data
        // Note: profile_photo currently disabled in backend until S3 CORS configured
        // SOFT-CODED: only dispatch if profile_photo value actually changed
        // to avoid triggering a user-object reference change in Redux (which
        // would re-fire this effect and create an infinite update loop)
        if (data.profile_photo && data.profile_photo !== user?.profile_photo) {
          dispatch(updateUser({ profile_photo: data.profile_photo }));
          console.log("Γ£à Profile photo updated in Redux store");
        }

        if (data.modules && Array.isArray(data.modules)) {
          const moduleCodes = data.modules.map((m) => m.code);
          setUserModules(previous => JSON.stringify(previous) === JSON.stringify(moduleCodes) ? previous : moduleCodes);
          console.log("≡ƒöÉ User accessible modules:", moduleCodes);
        } else {
          console.warn("No modules found in response");
          setUserModules([]);
        }
      } catch (error) {
        console.error("Failed to fetch user modules:", error);
        setUserModules([]);
      }
    };

    // SOFT-CODED: depend on stable user ID so the effect only re-fires
    // when the authenticated user changes, not on every Redux object update
    if (!user) return undefined;
    fetchUserModules();
    const timer = window.setInterval(fetchUserModules, 60000);
    window.addEventListener('focus', fetchUserModules);
    window.addEventListener('radai:access-changed', fetchUserModules);
    return () => {
      window.clearInterval(timer);
      window.removeEventListener('focus', fetchUserModules);
      window.removeEventListener('radai:access-changed', fetchUserModules);
    };
  }, [user?.id]);

  // Debug logging
  React.useEffect(() => {
    if (import.meta.env.DEV) {
      console.log("=== SIDEBAR DEBUG (MODULE-BASED RBAC) ===");
      console.log("Full user object:", user);
      console.log("isAdmin:", isAdmin);
      console.log("hasSuperuserFlag:", hasSuperuserFlag);
      console.log("hasSuperAdminRole:", hasSuperAdminRole);
      console.log("freshIsAdmin:", freshIsAdmin);
      console.log(
        "hasAdminModule:",
        userModules.some((code) => ADMIN_MODULE_CODES.includes(code)),
      );
      console.log("User Modules:", userModules);
      console.log("Admin Module Codes:", ADMIN_MODULE_CODES);
      console.log("==================");
    }
  }, [
    user,
    isAdmin,
    userModules,
    hasSuperuserFlag,
    hasSuperAdminRole,
    freshIsAdmin,
  ]);
  const toggleSection = (section) => {
    setExpandedSections((prev) => {
      if (TOP_LEVEL_ACCORDION_IDS.includes(section)) {
        return prev[section] ? {} : { [section]: true };
      }

      const nestedSectionIds = getEngineeringDisciplines().map(
        (discipline) => discipline.id,
      );
      const next = { ...prev };
      nestedSectionIds.forEach((id) => {
        next[id] = false;
      });
      next[section] = !prev[section];
      return next;
    });
  };

  // Navigation menu structure
  const menuStructure = [
    {
      id: "executive",
      title: "Executive overview",
      icon: PresentationChartLineIcon,
      path: "/executive",
      type: "single",
      moduleCode: "executive_dashboard",
      description: "Business performance and management priorities",
    },
    {
      id: "dashboard",
      title: "Dashboard",
      icon: HomeIcon,
      path: "/dashboard",
      type: "single",
      requiresModule: false, // Dashboard is always accessible
    },
    {
      id: "approvals",
      title: "Approvals",
      icon: ClipboardDocumentListIcon,
      path: "/approvals",
      type: "single",
      requiresModule: false,
      description: "Review your pending approvals",
    },
    {
      id: "processEngineering",
      title: getSectionTitle("processEngineering"),
      icon: WrenchScrewdriverIcon,
      type: "section",
      expanded: expandedSections.processEngineering,
      children: getEngineeringDisciplines().map((discipline, index) => ({
        id: discipline.id,
        title: `1.${index + 1} ${discipline.name}`,
        icon: discipline.icon,
        type: "subsection",
        expanded: expandedSections[discipline.id],
        description: discipline.description,
        color: discipline.color,
        gradient: discipline.gradient,
        children: discipline.subFeatures.map((subFeature) => ({
          id: subFeature.id,
          title: subFeature.name,
          icon: subFeature.icon,
          path: subFeature.path,
          description: subFeature.description,
          moduleCode: subFeature.moduleCode,
          badge: subFeature.badge,
        })),
      })),
    },
    {
      id: "crs",
      title: getSectionTitle("crs"),
      icon: RectangleGroupIcon,
      type: "section",
      expanded: expandedSections.crs,
      children: [
        {
          id: "crsDocuments",
          title: "2.1 CRS Documents",
          icon: DocumentTextIcon,
          path: "/crs/documents",
          description: "Centralized CRS repository",
          moduleCode: "crs_documents",
        },
        {
          id: "crsMultipleRevision",
          title: "2.2 Multi-Revision",
          icon: DocumentTextIcon,
          path: "/crs/multiple-revision",
          description: "AI-powered revision tracking",
          moduleCode: "crs_documents",
        },
        // SOFT-CODED REMOVAL: P&ID Checker duplicate removed from COMMON section
        // P&ID functionality is available in Process Engineering section (1.1 Process -> P&ID)
        // This avoids menu confusion and maintains single source of truth
        // SOFT-DISABLED: DesignIQ nav entry hidden - re-enable by uncommenting
        // { id: 'designiq', title: '2.3 DesignIQ', icon: BeakerIcon, path: '/designiq', description: 'AI-powered design optimization', moduleCode: 'designiq', badge: 'AI' },
        {
          id: "pfd",
          title: "2.3 PFD to P&ID",
          icon: DocumentTextIcon,
          path: "/pfd/upload",
          description: "Intelligent PFD conversion",
          moduleCode: "pfd_to_pid",
          badge: "AI",
        },
        {
          id: "dataMining",
          title: "2.4 Data Mining",
          icon: TableCellsIcon,
          path: "/data-mining",
          description: "AI-powered data integration & transformation",
          moduleCode: "data_mining",
          badge: "NEW",
        },
        {
          id: "myProfile",
          title: "2.5 Employee self-service",
          icon: SparklesIcon,
          path: "/hr/Employeprofile",
          description: "My leave, attendance, timesheet & payroll",
          moduleCode: "hr_self_service", // Accessible to all users via DEFAULT_ROLE_MODULES
          badge: "SELF",
        },
        {
          id: "myEnquiries",
          title: "2.6 My Requests",
          icon: EnvelopeIcon,
          path: "/my-enquiries",
          description: "Create and track your enquiries",
          requiresModule: false,
        },
      ],
    },
    // SOFT-CODED: CRS Multi-Revision Manager removed as per user request
    // This duplicate menu item is disabled - use "2.2 Multi-Revision" under CRS section instead
    /*
        {
          id: 'crsMultiRevision',
          title: '2.3 CRS Multi-Revision Manager',
          icon: DocumentTextIcon,
          path: '/crs/multi-revision',
          description: 'Upload and manage multiple PDF revisions',
          moduleCode: 'crs_documents'
        },
        */
    {
      id: "finance",
      title: getSectionTitle("finance"),
      icon: CurrencyDollarIcon,
      type: "section",
      expanded: expandedSections.finance,
      children: [
        {
          id: "financeDashboard",
          title: "3.1 Finance Dashboard",
          path: "/finance",
          icon: ChartBarIcon,
          moduleCode: "finance",
          description: "Combined accounts receivable and payable summary",
        },
        {
          id: "financeIncomingInvoices",
          title: "3.2 Incoming Invoices",
          path: "/finance/incoming-invoices",
          icon: DocumentTextIcon,
          moduleCode: "finance",
          description: "Vendor invoices received for procurement and payment",
        },
        {
          id: "financeOutgoingInvoices",
          title: "3.3 Outgoing Invoices",
          path: "/finance/outgoing-invoices",
          icon: DocumentPlusIcon,
          moduleCode: "finance",
          description: "Customer invoices issued for collection",
        },
      ],
    },
    // Section 4: Human Resource
    // SOFT-CODED: Controlled by FEATURE_FLAGS.enableHRModule in features.config.js
    // SECURITY: Super administrators ALWAYS see HR, bypassing feature flag
    {
      id: "human_resource",
      title: getSectionTitle("human_resource"),
      icon: IdentificationIcon,
      type: "section",
      expanded: expandedSections.human_resource,
      enabled:
        FEATURE_FLAGS.enableHRModule || hasSuperAdminRole || hasSuperuserFlag, // Super admin bypass
      children: [
        {
          id: "hrDashboard",
          title: "4.0 Dashboard",
          icon: ChartBarIcon,
          path: "/hr",
          description: "Consolidated real-time HR command center",
          moduleCode: "hr_management", // matches DB module code
        },
        {
          id: "hrEmployees",
          title: "4.1 Employee",
          icon: UsersIcon,
          path: "/hr/employees",
          description: "Employee records and profiles",
          moduleCode: "hr_management",
        },
        {
          id: "hrPayroll",
          title: "4.2 Payroll Management",
          icon: CurrencyDollarIcon,
          path: "/hr/payroll",
          description: "Payroll processing and management",
          moduleCode: "payroll", // matches DB module code
        },
        {
          id: "hrAttendance",
          title: "4.3 Attendance Management",
          icon: ChartBarIcon,
          path: "/hr/attendance",
          description: "Employee attendance and timesheets",
          moduleCode: "payroll",
        },
        {
          id: "hrLeave",
          title: "4.4 Leave Management",
          icon: IdentificationIcon,
          path: "/hr/leave",
          description: "Leave requests, approvals and balances",
          moduleCode: "payroll",
        },
        {
          id: "hrOnboarding",
          title: "4.5 Onboarding / Offboarding",
          icon: UsersIcon,
          path: "/hr/onboarding",
          description: "Employee lifecycle management",
          moduleCode: "hr_onboarding",
        },
      ],
    },
    {
      id: "sales",
      title: getSectionTitle("sales"),
      icon: PresentationChartLineIcon,
      type: "section",
      path: "/sales",
      expanded: expandedSections.sales,
      description: "Opportunity-to-project commercial lifecycle",
      enabled: true,
      children: [
        {
          id: "salesOverview",
          title: "5.0 Overview",
          icon: HomeIcon,
          path: "/sales",
          description: "Sales and proposals decision dashboard",
          moduleCode: "sales",
        },
        {
          id: "salesOpportunities",
          title: "5.1 Opportunity",
          icon: LightBulbIcon,
          path: "/sales/opportunities",
          description: "Qualify and govern the opportunity pipeline",
          moduleCode: "sales",
        },
        {
          id: "salesProposals",
          title: "5.2 Proposal",
          icon: DocumentTextIcon,
          path: "/sales/proposals",
          description: "Prepare and control client proposals",
          moduleCode: "sales",
        },
        {
          id: "salesClients",
          title: "5.3 Client",
          icon: BuildingOffice2Icon,
          path: "/sales/clients",
          description: "Manage governed client accounts",
          moduleCode: "sales",
        },
        {
          id: "salesFrameworks",
          title: "5.4 Framework",
          icon: RectangleStackIcon,
          path: "/sales/frameworks",
          description: "Manage framework agreements",
          moduleCode: "sales",
        },
        {
          id: "salesForecasts",
          title: "5.5 Forecast",
          icon: PresentationChartLineIcon,
          path: "/sales/forecasts",
          description: "Review weighted revenue forecasts",
          moduleCode: "sales",
        },
        {
          id: "salesEmailIntake",
          title: "Email Intake",
          icon: EnvelopeIcon,
          path: "/sales/email-intake",
          moduleCode: "sales_email_intake",
        },
        {
          id: "salesHandovers",
          title: "5.6 Project Handover",
          icon: ArrowRightStartOnRectangleIcon,
          path: "/sales/project-handovers",
          description: "Convert approved awards into controlled projects",
          moduleCode: "sales",
        },
      ],
    },
    {
      id: "projectControl",
      title: getSectionTitle("projectControl"),
      icon: ClipboardDocumentListIcon,
      type: "section",
      expanded: expandedSections.projectControl,
      children: [
        {
          id: "projectManagement",
          title: "Portfolio",
          icon: FolderIcon,
          path: "/projects",
          description: "Open and manage projects",
          moduleCode: "project_control",
        },
        {
          id: "planningPackage",
          title: "Plan & Baseline",
          icon: ClipboardDocumentListIcon,
          path: "/projects?view=plan-baseline",
          description: "Prepare and publish project plans",
          moduleCode: "planning_package",
        },
      ],
    },
    {
      id: "procurement",
      title: getSectionTitle("procurement"),
      icon: ShoppingCartIcon,
      type: "section",
      expanded: expandedSections.procurement,
      children: [
        {
          id: "procurementDashboard",
          title: "7.1 Dashboard",
          icon: HomeIcon,
          path: "/procurement",
          description: "Procurement overview",
          moduleCode: "procurement", // root access / dashboard
        },
        {
          id: "projects",
          title: "7.2 Project Links",
          icon: FolderIcon,
          path: "/procurement/projects/reconciliation",
          description: "Link procurement records to enterprise projects",
          moduleCode: "procurement", // project-based procurement
        },
        {
          id: "vendors",
          title: "7.3 Vendors",
          icon: UsersIcon,
          path: "/procurement/vendors",
          description: "Vendor governance and eligibility",
          moduleCode: "procurement_vendors", // granular: vendor management
        },
        {
          id: "requisitions",
          title: "7.4 Purchase Recommendations",
          icon: DocumentTextIcon,
          path: "/procurement/requisitions",
          description: "Purchase recommendation workflow",
          moduleCode: "procurement_requisitions", // stable permission code for purchase recommendations
        },
        {
          id: "purchaseOrders",
          title: "7.5 Purchase Orders",
          icon: DocumentPlusIcon,
          path: "/procurement/orders",
          description: "PO management",
          moduleCode: "procurement_orders", // granular: purchase orders
        },
        {
          id: "receipts",
          title: "7.6 Receipts",
          icon: FolderIcon,
          path: "/procurement/receipts",
          description: "Goods receipt",
          moduleCode: "procurement_receipts", // granular: goods receipt
        },
      ],
    },
    {
      id: "qhse",
      title: getSectionTitle("hse"),
      icon: ShieldCheckIcon,
      type: "section",
      expanded: expandedSections.qhse,
      children: [
        {
          id: "generalQHSE",
          title: "8.1 Project Quality",
          icon: ShieldCheckIcon,
          path: "/qhse/general",
          description: "Project quality management",
          moduleCode: "qhse",
        },
        {
          id: "detailedView",
          title: "8.2 Project Quality Details",
          icon: TableCellsIcon,
          path: "/qhse/general/detailed",
          description: "Detailed project quality view",
          moduleCode: "qhse_detailed",
        },
        {
          id: "qualityManagement",
          title: "8.3 Quality Management",
          icon: ChartBarIcon,
          path: "/qhse/general/quality",
          description: "Quality metrics and audits",
          moduleCode: "qhse_quality",
        },
        {
          id: "healthSafety",
          title: QHSE_MODULE_LABELS.healthSafety.title,
          icon: ShieldCheckIcon,
          path: QHSE_MODULE_LABELS.healthSafety.path,
          description: QHSE_MODULE_LABELS.healthSafety.description,
          moduleCode: "qhse_health_safety",
        },
        // SOFT-CODED: Environmental (8.5) and Energy (8.6) modules disabled - not related to project quality
        // {
        //   id: 'environmental',
        //   title: '8.5 Environmental',
        //   icon: DocumentTextIcon,
        //   path: '/qhse/general/environmental',
        //   description: 'Environmental management',
        //   moduleCode: 'qhse_environmental'
        // },
        // {
        //   id: 'energy',
        //   title: '8.6 Energy',
        //   icon: ChartBarIcon,
        //   path: '/qhse/general/energy',
        //   description: 'Energy management',
        //   moduleCode: 'qhse_energy'
        // }
        // SOFT-CODED: AI Interconnected System demo removed (not needed)
        // {
        //   id: 'interconnectedDemo',
        //   title: '7.7 AI Interconnected System',
        //   icon: SparklesIcon,
        //   path: '/qhse/interconnected-demo',
        //   description: 'AI-powered cross-module intelligence demo',
        //   moduleCode: 'qhse',
        //   badge: 'AI'
        // }
      ].filter(Boolean), // Filter out undefined/null items
    },
  ];

  // Helper function to check if user has access to a menu item
  const hasModuleAccess = (item) => {
    // Soft-coded: items with enabled:false are always hidden
    if (item.enabled === false) return false;

    // Dashboard and admin sections are handled separately
    if (item.requiresModule === false) return true;

    // SOFT-CODED: For sections/subsections WITHOUT a moduleCode,
    // we return true here and let filterMenuByModules check children.
    // Sections WITH a moduleCode are treated like regular menu items.
    if (
      (item.type === "section" || item.type === "subsection") &&
      !item.moduleCode
    ) {
      return true; // Will be filtered by child access in filterMenuByModules
    }

    // SECURITY FIX: Only super_admin role OR is_superuser flag bypass module checks
    // Regular admin role (level 2) must have specific module access
    const isSuperAdmin = hasSuperAdminRole || hasSuperuserFlag;
    if (isSuperAdmin) return true; // ONLY super_admin bypasses module checks

    // Check if user has the required module (soft-coded RBAC)
    if (item.moduleCode) {
      return canAccessRouteModule(userModules, resolveRouteModule(item.moduleCode, item.path?.split('?')[0] || '', item.path?.split('?')[1] || ''));
    }

    // Items without moduleCode are accessible by default
    return true;
  };

  // Filter menu items based on user's modules
  const filterMenuByModules = (items) => {
    return items
      .map((item) => {
        if (
          (item.type === "section" || item.type === "subsection") &&
          item.children
        ) {
          // ≡ƒöÆ SECURITY: Check if section itself is explicitly disabled (e.g., feature flag)
          if (item.enabled === false) {
            return null; // Section disabled by feature flag (e.g., HR module)
          }

          // ≡ƒöÆ SECURITY: If section has a moduleCode requirement, check access
          if (item.moduleCode && !hasModuleAccess(item)) {
            return null; // User doesn't have access to this section's required module
          }

          // Recursively filter children
          const accessibleChildren = item.children
            .map((child) => {
              if (child.type === "subsection" && child.children) {
                // Filter nested children for subsections
                const accessibleNestedChildren =
                  child.children.filter(hasModuleAccess);
                if (accessibleNestedChildren.length > 0) {
                  return { ...child, children: accessibleNestedChildren };
                }
                return null;
              }
              return hasModuleAccess(child) ? child : null;
            })
            .filter((child) => child !== null);

          // ≡ƒöÆ CRITICAL: Only show section if it has accessible children
          // This ensures Finance, Procurement, QHSE, Admin sections are hidden
          // when user has NO modules in those sections
          if (accessibleChildren.length > 0) {
            return { ...item, children: accessibleChildren };
          }
          return null; // Hide section with no accessible children
        }

        // For single items, check module access
        if (hasModuleAccess(item)) {
          return item;
        }

        return null;
      })
      .filter((item) => item !== null);
  };

  const filteredMenu = filterMenuByModules(menuStructure);

  // SOFT-CODED: Request Access link disabled - remove the push() block to re-enable
  // filteredMenu.push({
  //   id: 'requestAccess',
  //   title: 'Request Access',
  //   icon: ShieldCheckIcon,
  //   path: '/request-access',
  //   type: 'single',
  //   requiresModule: false,
  //   description: 'Request access to additional modules',
  // })

  // Add admin section if user is admin
  if (isAdmin) {
    filteredMenu.push({
      id: "admin",
      title: getSectionTitle("admin"),
      icon: CogIcon,
      type: "section",
      expanded: expandedSections.admin,
      badge: "ADMIN",
      children: [
        {
          id: "adminDashboard",
          title: "9.1 Dashboard",
          icon: ChartBarIcon,
          path: "/admin/dashboard",
          description: "System overview & analytics",
          moduleCode: "admin_dashboard",
        },
        {
          id: "userManagement",
          title: "9.2 Users",
          icon: UsersIcon,
          path: "/admin/users",
          description: "User accounts & permissions",
          moduleCode: "user_mgmt",
        },
        {
          id: "roleManagement",
          title: "9.3 Roles & permissions",
          icon: ShieldCheckIcon,
          path: "/admin/roles",
          description: "Roles, module permissions & access request approvals",
          moduleCode: "role_access_mgmt",
        },
        {
          id: "wrenchIntegration",
          title: "9.4 Wrench Integration",
          icon: WrenchScrewdriverIcon,
          path: "/admin/wrench",
          description: "Wrench Project Platform sync",
          moduleCode: "wrench_integration",
        },
        {
          id: "aiChampion",
          title: "9.5 AI Champion",
          icon: SparklesIcon,
          path: "/admin/ai-champion",
          description: "Top AI users leaderboard & badges",
          moduleCode: "ai_champion",
        },
        {
          id: "enquiryManagement",
          title: "9.6 Enquiry Operations",
          icon: EnvelopeIcon,
          path: "/admin/enquiries",
          description: "Assignment, responses, escalation and service reporting",
          moduleCode: "enquiry_management",
        },
        // SOFT-CODED: Subscription feature disabled for in-house deployment
        // {
        //   id: 'subscriptionManagement',
        //   title: '8.3 Subscription',
        //   icon: CurrencyDollarIcon,
        //   path: '/admin/subscriptions',
        //   description: 'Plans & billing management'
        // }
      ].filter(
        (child) =>
          !child.moduleCode ||
          hasSuperAdminRole ||
          hasSuperuserFlag ||
          userModules.includes(child.moduleCode),
      ),
    });
  }

  const visibleMenu = filteredMenu.filter((item) => item.type === "single" || item.children?.length);
  const active = getActiveSidebarItem(visibleMenu, location);
  const { sectionId, subsectionId } = active;

  // Follow direct links and history while allowing manual accordion browsing.
  React.useEffect(() => {
    const next = {};
    if (sectionId) next[sectionId] = true;
    if (subsectionId) next[subsectionId] = true;
    setExpandedSections(next);
  }, [location.pathname, location.search, sectionId, subsectionId]);

  React.useEffect(() => {
    setTooltip(null);
  }, [isCollapsed, isOpen, location.pathname, location.search]);

  const handleNavigation = (event) => {
    if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
    if (window.matchMedia("(max-width: 1023px)").matches) setIsOpen(false);
    setTooltip(null);
  };

  const tooltipProps = (item) => {
    const show = (event) => {
      if (!isCollapsed) return;
      const rect = event.currentTarget.getBoundingClientRect();
      setTooltip({ id: item.id, title: item.title, top: rect.top + rect.height / 2, left: rect.right + 12 });
    };
    return {
      onMouseEnter: show,
      onFocus: show,
      onMouseLeave: () => setTooltip(null),
      onBlur: () => setTooltip(null),
      'aria-describedby': isCollapsed && tooltip?.id === item.id ? 'sidebar-tooltip' : undefined,
    };
  };

  const renderLink = (item, collapsed = false) => (
    <Link
      key={item.id}
      to={item.path}
      onClick={handleNavigation}
      aria-label={item.title}
      aria-current={active.itemId === item.id ? "page" : undefined}
      title={item.description ? `${item.title} — ${item.description}` : item.title}
      className="sidebar-row"
      {...(collapsed ? tooltipProps(item) : {})}
    >
      <item.icon aria-hidden="true" />
      {!collapsed && <span className="min-w-0 flex-1 break-words">{item.title}</span>}
    </Link>
  );

  const groups = [
    { id: "workspace", title: "Workspace", items: visibleMenu.filter((item) => item.type === "single") },
    { id: "modules", title: "Modules", items: visibleMenu.filter((item) => item.type === "section" && item.id !== "admin") },
    { id: "administration", title: "Administration", items: visibleMenu.filter((item) => item.id === "admin") },
  ].filter((group) => group.items.length);

  return (
    <>
      {isMobileDrawer && (
        <button
          type="button"
          tabIndex={-1}
          aria-label="Close navigation menu"
          className="fixed inset-0 z-40 bg-slate-950/40 backdrop-blur-[2px]"
          onClick={() => setIsOpen(false)}
        />
      )}
      <aside
        ref={sidebarRef}
        id="application-sidebar"
        role={isMobileDrawer ? "dialog" : undefined}
        aria-modal={isMobileDrawer ? true : undefined}
        aria-label="Application navigation"
        aria-hidden={!isOpen ? true : undefined}
        inert={!isOpen ? "" : undefined}
        tabIndex={-1}
        data-collapsed={isCollapsed}
        onKeyDown={(event) => {
          if (!isMobileDrawer && event.key === "Escape" && !event.defaultPrevented && !isCollapsed) {
            event.preventDefault();
            setIsCollapsed(true);
            sidebarRef.current.querySelector('[data-sidebar-toggle]')?.focus();
          }
        }}
        className={`app-sidebar fixed inset-y-0 left-0 z-50 flex h-dvh max-w-[calc(100vw-32px)] flex-none flex-col border-r lg:relative lg:inset-auto ${isCollapsed ? SIDEBAR.collapsed.widthClass : SIDEBAR.expanded.widthClass} ${isOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0"} transition-[width,transform] duration-200 ease-out motion-reduce:transition-none`}
      >
        <div className={`sidebar-header flex h-14 flex-none items-center border-b px-4 ${isCollapsed ? "justify-center" : "justify-between"}`}>
          <div className="flex min-w-0 items-center gap-3">
            <span className="sidebar-brand-mark flex h-8 w-8 flex-none items-center justify-center rounded-lg text-xs font-bold" aria-hidden="true">AI</span>
            {!isCollapsed && <div><span className="sidebar-brand-title block text-sm font-semibold tracking-wide">RADAI</span><span className="sidebar-brand-caption block text-[10px] leading-4">Your workspace</span></div>}
          </div>
          <button type="button" data-sidebar-close aria-label="Close sidebar" onClick={() => setIsOpen(false)} className="sidebar-close flex h-10 w-10 items-center justify-center rounded-md lg:hidden"><XMarkIcon className="h-5 w-5" aria-hidden="true" /></button>
        </div>

        <nav aria-label="Primary application sections" onScroll={() => setTooltip(null)} className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-3 py-3 [scrollbar-width:thin]">
          {groups.map((group, index) => (
            <section key={group.id} aria-label={group.title} className={index ? "sidebar-group-divider mt-3 border-t pt-3" : ""}>
              {!isCollapsed && <p className="sidebar-group-label">{group.title}</p>}
              <div className="space-y-1">
                {group.items.map((item) => item.type === "single" ? renderLink(item, isCollapsed) : (
                  <div key={item.id}>
                    <button
                      type="button"
                      className="sidebar-row"
                      aria-label={item.title}
                      aria-expanded={!isCollapsed && Boolean(expandedSections[item.id])}
                      aria-controls={`sidebar-section-${item.id}`}
                      data-active={active.sectionId === item.id}
                      title={item.title}
                      {...tooltipProps(item)}
                      onClick={() => {
                        setTooltip(null);
                        if (isCollapsed) {
                          setIsCollapsed(false);
                          setExpandedSections((previous) => ({ [item.id]: true, ...(active.sectionId === item.id && active.subsectionId ? { [active.subsectionId]: true } : {}), ...(previous[item.id] ? previous : {}) }));
                        } else toggleSection(item.id);
                      }}
                    >
                      <item.icon aria-hidden="true" />
                      {!isCollapsed && <><span className="min-w-0 flex-1">{item.title}</span>{expandedSections[item.id] ? <ChevronDownIcon className="sidebar-chevron" aria-hidden="true" /> : <ChevronRightIcon className="sidebar-chevron" aria-hidden="true" />}</>}
                    </button>
                    <div id={`sidebar-section-${item.id}`} hidden={isCollapsed || !expandedSections[item.id]} className="sidebar-branch sidebar-nested ml-4 space-y-1 border-l-2 pl-4">
                      {item.children.map((child) => child.type === "subsection" ? (
                        <div key={child.id}>
                          <button type="button" className="sidebar-row" aria-expanded={Boolean(expandedSections[child.id])} aria-controls={`sidebar-subsection-${child.id}`} data-active={active.subsectionId === child.id} title={child.description || child.title} onClick={() => toggleSection(child.id)}>
                            <child.icon aria-hidden="true" /><span className="min-w-0 flex-1">{child.title}</span>{expandedSections[child.id] ? <ChevronDownIcon className="sidebar-chevron" aria-hidden="true" /> : <ChevronRightIcon className="sidebar-chevron" aria-hidden="true" />}
                          </button>
                          <div id={`sidebar-subsection-${child.id}`} hidden={!expandedSections[child.id]} className="sidebar-branch ml-4 space-y-0.5 border-l-2 pl-3">
                            {child.children.map((feature) => renderLink(feature))}
                          </div>
                        </div>
                      ) : renderLink(child))}
                    </div>
                  </div>
                ))}
              </div>
            </section>
          ))}
        </nav>

        <div className="sidebar-footer hidden flex-none border-t p-3 lg:block">
          <button type="button" data-sidebar-toggle className="sidebar-row" aria-label={isCollapsed ? "Expand sidebar" : "Collapse sidebar"} aria-expanded={!isCollapsed} title={isCollapsed ? "Expand sidebar" : "Collapse sidebar"} onClick={() => setIsCollapsed(!isCollapsed)}>
            {isCollapsed ? <ChevronRightIcon aria-hidden="true" /> : <><ChevronLeftIcon aria-hidden="true" /><span>Collapse sidebar</span></>}
          </button>
        </div>
      </aside>
      {isCollapsed && tooltip && <div id="sidebar-tooltip" role="tooltip" className="pointer-events-none fixed z-[60] -translate-y-1/2 rounded-md bg-slate-900 px-3 py-2 text-xs font-medium text-white shadow-md dark:bg-slate-100 dark:text-slate-900" style={{ top: tooltip.top, left: tooltip.left }}>{tooltip.title}</div>}
    </>
  );
};

export default Sidebar;
