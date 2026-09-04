import React, { useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { useSelector, useDispatch } from "react-redux";
import { updateUser } from "../../store/slices/authSlice";
import { API_BASE_URL } from "../../config/api.config";
import { getSectionTitle } from "../../config/navigationLabels.config";
import { getEngineeringDisciplines } from "../../config/engineeringStructure.config";
import { USER_DISPLAY_CONFIG } from "../../config/userDisplay.config";
import { SIDEBAR } from "../../config/layout.config";
import { FEATURE_FLAGS } from "../../config/features.config";
import {
  QHSE_MODULE_LABELS,
  isQHSEModuleEnabled,
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
  PresentationChartLineIcon,
  ClipboardDocumentListIcon,
  ShoppingCartIcon,
  IdentificationIcon,
  EnvelopeIcon,
  CubeIcon,
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
  profilePhotoUrl,
}) => {
  const navigate = useNavigate();
  const location = useLocation();
  const dispatch = useDispatch();
  const { user } = useSelector((state) => state.auth);
  const [userModules, setUserModules] = useState([]);
  // SOFT-CODED: freshIsAdmin is set from the live /rbac/users/me/ response so that
  // stale localStorage data does not permanently hide menu items until re-login.
  const [freshIsAdmin, setFreshIsAdmin] = useState(false);
  // If parent Layout drives collapse state, use those props; otherwise
  // fall back to local state so the component still works standalone.
  const [internalCollapsed, setInternalCollapsed] = useState(true);
  const isCollapsed =
    isCollapsedProp !== undefined ? isCollapsedProp : internalCollapsed;
  const setIsCollapsed = setIsCollapsedProp || setInternalCollapsed;
  const [expandedSections, setExpandedSections] = useState({});

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
          setUserModules(moduleCodes);
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
    if (user) {
      fetchUserModules();
    }
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

  // Check if route is active
  const isActiveRoute = (path) => {
    return (
      location.pathname === path || location.pathname.startsWith(path + "/")
    );
  };

  // Navigation menu structure
  const menuStructure = [
    {
      id: "dashboard",
      title: "Dashboard",
      icon: HomeIcon,
      path: "/dashboard",
      type: "single",
      requiresModule: false, // Dashboard is always accessible
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
        children: discipline.subFeatures.map((subFeature, subIndex) => ({
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
          title: "2.5 My Profile",
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
          title: "4.0 HR Dashboard",
          icon: ChartBarIcon,
          path: "/hr",
          description: "Consolidated real-time HR command center",
          moduleCode: "hr_management", // matches DB module code
        },
        {
          id: "hrEmployees",
          title: "4.1 Employees",
          icon: UsersIcon,
          path: "/hr/employees",
          description: "Employee records and profiles",
          moduleCode: "hr_management",
        },
        {
          id: "hrPayroll",
          title: "4.2 Payroll",
          icon: CurrencyDollarIcon,
          path: "/hr/payroll",
          description: "Payroll processing and management",
          moduleCode: "payroll", // matches DB module code
        },
        {
          id: "hrOnboarding",
          title: "4.3 Onboarding | Offboarding",
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
      type: "single",
      path: "/sales",
      moduleCode: "sales",
      badge: "AI",
      description: "Internal Platform Usage Analytics",
      enabled: true,
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
          title: "6.1 Projects",
          icon: FolderIcon,
          path: "/projects",
          description: "Manage and track projects",
          moduleCode: "project_control",
        },
        {
          id: "planningPackage",
          title: "6.2 Planning Package",
          icon: CubeIcon,
          path: "/planning-packages",
          description: "Work package planning and tracking",
          moduleCode: "project_control",
          badge: "NEW",
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
          title: "7.2 Projects",
          icon: FolderIcon,
          path: "/procurement/projects",
          description: "Project portfolio management",
          moduleCode: "procurement", // project-based procurement
        },
        {
          id: "vendors",
          title: "7.3 Vendors",
          icon: UsersIcon,
          path: "/procurement/vendors",
          description: "Vendor management",
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
      return userModules.includes(item.moduleCode);
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
          title: "9.2 Users & Roles",
          icon: UsersIcon,
          path: "/admin/users",
          description: "User accounts & permissions",
          moduleCode: "user_mgmt",
        },
        {
          id: "roleManagement",
          title: "9.3 Role & Access Management",
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

  // Keep the accordion synchronized with direct links, browser history, and
  // programmatic navigation. A route can activate one top-level section and,
  // for Engineering, one nested discipline.
  React.useEffect(() => {
    let activeTopLevel = null;
    let activeNested = null;

    for (const item of filteredMenu) {
      if (item.type !== "section") continue;

      for (const child of item.children || []) {
        if (child.type === "subsection") {
          const hasActiveChild = (child.children || []).some((nestedChild) =>
            isActiveRoute(nestedChild.path),
          );
          if (hasActiveChild) {
            activeTopLevel = item.id;
            activeNested = child.id;
            break;
          }
        } else if (child.path && isActiveRoute(child.path)) {
          activeTopLevel = item.id;
          break;
        }
      }

      if (activeTopLevel) break;
    }

    setExpandedSections((prev) => {
      const next = {};
      if (activeTopLevel) next[activeTopLevel] = true;
      if (activeNested) next[activeNested] = true;
      return JSON.stringify(prev) === JSON.stringify(next) ? prev : next;
    });
  }, [location.pathname, userModules, isAdmin]);

  React.useEffect(() => {
    const handleEscape = (event) => {
      if (event.key !== "Escape") return;
      if (window.matchMedia("(min-width: 1024px)").matches) {
        setIsCollapsed(true);
      } else {
        setIsOpen(false);
      }
    };

    document.addEventListener("keydown", handleEscape);
    return () => document.removeEventListener("keydown", handleEscape);
  }, [setIsCollapsed, setIsOpen]);

  const handleNavigation = (path) => {
    navigate(path);
    if (window.innerWidth < 1024) {
      setIsOpen(false);
    } else {
      setIsCollapsed(true);
    }
  };

  return (
    <>
      {/* Mobile drawer backdrop */}
      {isOpen && (
        <button
          type="button"
          aria-label="Close navigation menu"
          className="fixed inset-0 z-40 bg-black/50 lg:hidden"
          onClick={() => setIsOpen(false)}
        />
      )}

      {/* Desktop flyout backdrop: expanded navigation overlays content. */}
      {isOpen && !isCollapsed && (
        <button
          type="button"
          aria-label="Collapse navigation menu"
          className="fixed inset-0 z-20 hidden bg-slate-950/10 lg:block"
          onClick={() => setIsCollapsed(true)}
        />
      )}

      {/* Sidebar */}
      <aside
        aria-label="Application navigation"
        aria-hidden={!isOpen ? true : undefined}
        inert={!isOpen ? "" : undefined}
        className={`
          fixed inset-y-0 left-0 z-50 h-dvh lg:relative lg:inset-auto lg:z-50
          ${isCollapsed ? SIDEBAR.collapsed.widthClass : SIDEBAR.expanded.widthClass} bg-white dark:bg-gray-800
          border-r border-slate-200 dark:border-slate-700
          ${!isCollapsed ? "lg:-mr-52 lg:shadow-2xl" : ""}
          transform transition-all duration-300 ease-in-out motion-reduce:transition-none
          ${isOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0"}
          flex flex-col
        `}
      >
        {/* Sidebar Header */}
        <div
          className="flex h-14 flex-none items-center justify-between border-b border-slate-200 px-3 dark:border-slate-700"
        >
          {!isCollapsed ? (
            <>
              <div className="flex min-w-0 items-center gap-2.5">
                <div className="flex h-8 w-8 flex-none items-center justify-center rounded-lg bg-blue-600">
                  <span className="text-sm font-bold text-white">AI</span>
                </div>
                <div className="min-w-0">
                  <span className="block truncate text-sm font-extrabold tracking-wide text-slate-900 dark:text-white">RADAI</span>
                  <span className="block text-[8px] font-semibold uppercase tracking-[0.18em] text-slate-400">AI Platform</span>
                </div>
              </div>
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={() => setIsCollapsed(true)}
                  className="hidden lg:block p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                  title="Collapse sidebar"
                  aria-label="Collapse sidebar"
                >
                  <ChevronLeftIcon className="w-5 h-5 text-gray-600 dark:text-gray-400" />
                </button>
                <button
                  onClick={() => setIsOpen(false)}
                  className="lg:hidden p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                >
                  <XMarkIcon className="w-5 h-5 text-gray-600 dark:text-gray-400" />
                </button>
              </div>
            </>
          ) : (
            <button
              type="button"
              onClick={() => setIsCollapsed(false)}
              className="mx-auto flex h-8 w-8 items-center justify-center rounded-lg bg-blue-600 text-sm font-bold text-white shadow-sm transition-shadow hover:shadow-md focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2"
              title="Expand sidebar"
              aria-label="Expand sidebar"
            >
              AI
            </button>
          )}
        </div>

        {/* Navigation Menu */}
        <nav
          aria-label="Primary application sections"
          className="min-h-0 flex-1 space-y-1 overflow-y-auto px-3 py-4 [scrollbar-width:thin]"
        >
          {filteredMenu.map((item) => (
            <div key={item.id}>
              {item.type === "single" ? (
                // Single menu item
                <button
                  onClick={() => handleNavigation(item.path)}
                  aria-current={isActiveRoute(item.path) ? "page" : undefined}
                  aria-label={item.title}
                  className={`
                    w-full flex items-center ${isCollapsed ? "justify-center" : "justify-between"} px-3 py-2.5 rounded-lg
                    transition-all duration-200 motion-reduce:transition-none relative overflow-hidden group focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-1
                    ${
                      isActiveRoute(item.path)
                        ? "bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-blue-900 dark:to-indigo-900 text-blue-700 dark:text-blue-300 font-semibold shadow-md ring-2 ring-blue-200"
                        : "text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 hover:shadow-sm"
                    }
                  `}
                  title={isCollapsed ? item.title : item.description || ""}
                >
                  <div className="flex items-center space-x-3">
                    <item.icon
                      className={`w-5 h-5 ${isActiveRoute(item.path) ? "text-blue-600 dark:text-blue-400" : ""}`}
                    />
                    {!isCollapsed && (
                      <span className="flex-1 text-left">{item.title}</span>
                    )}
                  </div>
                  {!isCollapsed && item.badge && (
                    <span className="px-2 py-0.5 text-xs font-bold bg-gradient-to-r from-purple-500 to-pink-500 text-white rounded-full shadow-sm animate-pulse">
                      {item.badge}
                    </span>
                  )}
                  {/* Hover effect background */}
                  {!isActiveRoute(item.path) && (
                    <div className="absolute inset-0 bg-gradient-to-r from-blue-500/5 to-indigo-500/5 opacity-0 group-hover:opacity-100 transition-opacity duration-300 -z-10"></div>
                  )}
                </button>
              ) : (
                // Section with children
                <div className="space-y-1">
                  <button
                    onClick={() => {
                      if (isCollapsed) {
                        setIsCollapsed(false);
                        setExpandedSections((prev) => (
                          prev[item.id] ? prev : { [item.id]: true }
                        ));
                        return;
                      }
                      toggleSection(item.id);
                    }}
                    aria-expanded={!isCollapsed && Boolean(item.expanded)}
                    aria-controls={`sidebar-section-${item.id}`}
                    aria-label={item.title}
                    className={`w-full flex items-center ${isCollapsed ? "justify-center" : "justify-between"} px-3 py-2.5 rounded-lg text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors motion-reduce:transition-none font-semibold focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-1`}
                    title={isCollapsed ? item.title : ""}
                  >
                    {isCollapsed ? (
                      <item.icon className="w-5 h-5 text-gray-600 dark:text-gray-400" />
                    ) : (
                      <>
                        <div className="flex items-center space-x-3">
                          <item.icon className="w-5 h-5 text-gray-600 dark:text-gray-400" />
                          <span>{item.title}</span>
                        </div>
                        <div className="flex items-center space-x-2">
                          {item.badge && (
                            <span className="px-2 py-0.5 text-xs font-bold bg-gradient-to-r from-amber-400 to-orange-500 text-white rounded-full">
                              {item.badge}
                            </span>
                          )}
                          {item.expanded ? (
                            <ChevronDownIcon className="w-4 h-4 text-gray-500" />
                          ) : (
                            <ChevronRightIcon className="w-4 h-4 text-gray-500" />
                          )}
                        </div>
                      </>
                    )}
                  </button>

                  {/* Child items */}
                  {!isCollapsed && item.expanded && (
                    <div id={`sidebar-section-${item.id}`} className="ml-4 pl-4 border-l-2 border-gray-200 dark:border-gray-700 space-y-1">
                      {item.children.map((child) =>
                        child.type === "subsection" ? (
                          // Subsection with nested children (like Engineering disciplines)
                          <div key={child.id} className="space-y-1">
                            <button
                              onClick={() => toggleSection(child.id)}
                              aria-expanded={Boolean(expandedSections[child.id])}
                              aria-controls={`sidebar-subsection-${child.id}`}
                              className={`
                                w-full flex items-center justify-between px-3 py-2 rounded-lg
                                transition-all duration-200 motion-reduce:transition-none focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-1
                                ${
                                  expandedSections[child.id]
                                    ? "bg-gray-50 dark:bg-gray-700/50 text-gray-900 dark:text-gray-100"
                                    : "text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700"
                                }
                              `}
                            >
                              <div className="flex items-center space-x-2">
                                <child.icon className="w-4 h-4" />
                                <span className="text-sm font-medium">
                                  {child.title}
                                </span>
                              </div>
                              {expandedSections[child.id] ? (
                                <ChevronDownIcon className="w-3 h-3" />
                              ) : (
                                <ChevronRightIcon className="w-3 h-3" />
                              )}
                            </button>

                            {/* Nested sub-features */}
                            {expandedSections[child.id] && (
                              <div id={`sidebar-subsection-${child.id}`} className="ml-4 pl-3 border-l-2 border-gray-100 dark:border-gray-600 space-y-0.5">
                                {child.children.map((subFeature) => (
                                  <button
                                    key={subFeature.id}
                                    onClick={() =>
                                      handleNavigation(subFeature.path)
                                    }
                                    aria-current={isActiveRoute(subFeature.path) ? "page" : undefined}
                                    className={`
                                      w-full flex items-center justify-between px-2.5 py-2 rounded-md
                                      transition-all duration-200 motion-reduce:transition-none text-left group focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-1
                                      ${
                                        isActiveRoute(subFeature.path)
                                          ? "bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-blue-900/30 dark:to-indigo-900/30 text-blue-700 dark:text-blue-300 font-medium shadow-sm"
                                          : "text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-700/50 hover:text-gray-900 dark:hover:text-gray-200"
                                      }
                                    `}
                                  >
                                    <div className="flex items-center space-x-2 min-w-0 flex-1">
                                      <subFeature.icon
                                        className={`w-3.5 h-3.5 flex-shrink-0 ${isActiveRoute(subFeature.path) ? "text-blue-600 dark:text-blue-400" : ""}`}
                                      />
                                      <span className="text-xs truncate">
                                        {subFeature.title}
                                      </span>
                                    </div>
                                    {subFeature.badge && (
                                      <span
                                        className={`
                                        px-1.5 py-0.5 text-[10px] font-bold rounded-full flex-shrink-0
                                        ${
                                          subFeature.badge === "AI"
                                            ? "bg-gradient-to-r from-purple-500 to-pink-500 text-white"
                                            : "bg-gradient-to-r from-green-500 to-emerald-500 text-white"
                                        }
                                      `}
                                      >
                                        {subFeature.badge}
                                      </span>
                                    )}
                                  </button>
                                ))}
                              </div>
                            )}
                          </div>
                        ) : (
                          // Regular child item (no nested children)
                          <button
                            key={child.id}
                            onClick={() => handleNavigation(child.path)}
                            aria-current={isActiveRoute(child.path) ? "page" : undefined}
                            className={`
                              w-full flex items-center justify-between px-3 py-2.5 rounded-lg
                              transition-all duration-200 motion-reduce:transition-none text-left focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-1
                              ${
                                isActiveRoute(child.path)
                                  ? "bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-blue-900 dark:to-indigo-900 text-blue-700 dark:text-blue-300 font-medium shadow-sm"
                                  : "text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-700 hover:text-gray-900 dark:hover:text-gray-200"
                              }
                            `}
                          >
                            <div className="flex items-start space-x-3 flex-1 min-w-0">
                              <child.icon
                                className={`w-4 h-4 mt-0.5 flex-shrink-0 ${isActiveRoute(child.path) ? "text-blue-600 dark:text-blue-400" : ""}`}
                              />
                              <div className="flex-1 min-w-0">
                                <div
                                  className={`text-sm ${isActiveRoute(child.path) ? "font-semibold" : "font-medium"}`}
                                >
                                  {child.title}
                                </div>
                                {child.description && (
                                  <div className="text-xs text-gray-500 dark:text-gray-500 mt-0.5">
                                    {child.description}
                                  </div>
                                )}
                              </div>
                            </div>
                            {child.badge && (
                              <span
                                className={`
                                px-2 py-0.5 text-[10px] font-bold rounded-full flex-shrink-0 ml-2
                                ${
                                  child.badge === "AI"
                                    ? "bg-gradient-to-r from-purple-500 to-pink-500 text-white"
                                    : "bg-gradient-to-r from-green-500 to-emerald-500 text-white"
                                }
                              `}
                              >
                                {child.badge}
                              </span>
                            )}
                          </button>
                        ),
                      )}
                    </div>
                  )}
                </div>
              )}
            </div>
          ))}
        </nav>

        {/* Sidebar Footer - User Info */}
        <div className="flex-none border-t border-gray-200 p-3 dark:border-gray-700">
          <div
            className={`flex items-center ${isCollapsed ? "justify-center" : "space-x-3"}`}
          >
            <div className="w-10 h-10 rounded-full flex items-center justify-center relative overflow-hidden ring-2 ring-white dark:ring-gray-700 shadow-lg bg-gradient-to-br from-blue-500 to-indigo-600">
              {/* Show profile photo when available, fall back to initials */}
              {profilePhotoUrl || user?.profile_photo ? (
                <img
                  src={profilePhotoUrl || user.profile_photo}
                  alt="Profile"
                  className="absolute inset-0 w-full h-full object-cover z-10"
                  onError={(e) => {
                    e.target.onerror = null;
                    e.target.style.display = "none";
                  }}
                />
              ) : null}
              <span className="absolute inset-0 flex items-center justify-center text-white font-semibold text-sm">
                {USER_DISPLAY_CONFIG.formatting.getUserInitials(userData)}
              </span>
              {isAdmin && isCollapsed && (
                <span className="absolute -top-1 -right-1 w-3 h-3 bg-gradient-to-r from-amber-400 to-orange-500 rounded-full border-2 border-white z-20"></span>
              )}
            </div>
            {!isCollapsed && (
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-gray-900 dark:text-white truncate">
                  {USER_DISPLAY_CONFIG.formatting.getDisplayName(userData)}
                </p>
                <p className="text-xs text-gray-500 dark:text-gray-400 truncate">
                  {USER_DISPLAY_CONFIG.formatting.getEmailDisplay(userData)}
                </p>
                {isAdmin && (
                  <span className="inline-flex items-center px-2 py-0.5 text-xs font-bold bg-gradient-to-r from-amber-400 to-orange-500 text-white rounded-full mt-1">
                    ADMIN
                  </span>
                )}
              </div>
            )}
          </div>
        </div>
      </aside>
    </>
  );
};

export default Sidebar;
