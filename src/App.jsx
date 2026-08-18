import React from 'react'
import { Routes, Route, Navigate } from 'react-router-dom'
import { useSelector } from 'react-redux'
import { useState, useEffect, useCallback } from 'react'
import { API_BASE_URL, API_ENDPOINTS } from './config/api.config'
import { FEATURE_FLAGS, ENV } from './config/features.config'
import passwordExpiryService from './services/passwordExpiry.service'
import Layout from './components/Layout/Layout'
import FirstLoginCheck from './components/Auth/FirstLoginCheck'
import ChangePasswordModal from './components/Auth/ChangePasswordModal'
import PasswordExpiryBanner from './components/PasswordExpiryBanner'
import Home from './pages/Home'
import Login from './pages/Login'
import SetupPassword from './pages/SetupPassword'
import ChangePassword from './pages/ChangePassword'
import RequestPasswordReset from './pages/RequestPasswordReset'
import TermsOfService from './pages/TermsOfService'
import PrivacyPolicy from './pages/PrivacyPolicy'
import Dashboard from './pages/Dashboard'
import Profile from './pages/Profile'
import ProfileAlignedComprehensive from './pages/ProfileAlignedComprehensive'  // ✅ Comprehensive profile with engineering expertise
import ProfileNew from './pages/ProfileNew'  // ✅ NEW: Modern redesigned profile page
import NotificationPanel from './pages/NotificationPanel'
import UsageDashboard from './pages/UsageDashboard'
// SOFT-CODED: /pid/upload disabled — replaced by Engineering > Process > P&ID Verification
// import PIDUpload from './pages/PIDUpload'
import PIDReport from './pages/PIDReport'
import PIDHistory from './pages/PIDHistory'
// Soft-coded PFD Upload - Use different components based on environment
import PFDUploadClassic from './pages/PFDUpload'
import PFDUploadNew from './pages/PFDUploadNew'
const PFDUpload = FEATURE_FLAGS.pfdUploadVersion === 'new' ? PFDUploadNew : PFDUploadClassic
import PFDAnalysisConsole from './pages/PFDAnalysisConsole'
import PFDConvert from './pages/PFDConvert'
import PFDHistory from './pages/PFDHistory'
import PFDFiveStageAnalysis from './pages/PFDFiveStageAnalysis'
import S3PFDBrowser from './pages/S3PFDBrowser'
import S3Management from './pages/S3Management'
import DataMiningPlatform from './pages/DataMiningPlatform'
import CRSDocuments from './pages/CRSDocuments'
import CRSDocumentsHistory from './pages/CRSDocumentsHistory'
import CRSChainDetail from './pages/CRSChainDetail'
// Soft-coded CRS Multi-Revision - Use Smart component with finish early logic
import CRSMultipleRevisionClassic from './pages/CRSMultipleRevision'
import CRSMultiRevisionSmart from './pages/CRSMultiRevisionSmart'
const CRSMultipleRevision = FEATURE_FLAGS.crsMultiRevisionVersion === 'classic' ? CRSMultipleRevisionClassic : CRSMultiRevisionSmart
import ProjectControl from './pages/ProjectControl'
import ProjectsPage from './pages/Projects/ProjectsPage'
import PlanningPackagePage from './pages/PlanningPackagePage'
import GeneralQHSE from './pages/QHSE/GeneralQHSE'
import QHSEHub from './pages/QHSE/QHSEHub'
// SOFT-CODED: QHSEInterconnectedDemo removed (not needed)
// import QHSEInterconnectedDemo from './pages/QHSE/QHSEInterconnectedDemo'
// SOFT-CODED: InvoiceUpload route retired — keep file for future revival
// import InvoiceUpload from './pages/Finance/InvoiceUpload'
// SOFT-CODED: InvoiceList / InvoiceDetail routes retired — keep files for future revival
// import InvoiceList from './pages/Finance/InvoiceList'
import InvoiceTracker from './pages/Finance/InvoiceTracker'
import SalarySlip from './pages/Finance/SalarySlip'
import HREmployees from './pages/HR/HREmployees'
import HRDashboard from './pages/HR/HRDashboard'
import Payroll from './pages/HR/Payroll'
import EmployeeSelfService from './pages/HR/EmployeeSelfService'
import OnboardingOffboarding from './pages/HR/OnboardingOffboarding'
import SiteVisits from './pages/HR/SiteVisits'
// import InvoiceDetail from './pages/Finance/InvoiceDetail'
import InvoiceApproval from './pages/Finance/InvoiceApproval'
import FinanceHub from './pages/Finance/FinanceHub'
import InternalSalesDashboard from './pages/InternalSalesDashboard'
import AdminDashboard from './pages/AdminDashboard'
import UserManagement from './pages/UserManagement'
import UserDetail from './pages/UserDetail'
import WrenchIntegration from './pages/WrenchIntegration'
import AIChampion from './pages/Admin/AIChampion'
import EnquiryManagement from './pages/Admin/EnquiryManagement'
import ActivityReports from './pages/Admin/ActivityReports'
// SOFT-CODED: Subscription feature disabled for in-house deployment
// import SubscriptionManagement from './pages/SubscriptionManagement'
// import SubscriptionPlans from './pages/SubscriptionPlans'
import ContactSupportPage from './pages/ContactSupportPage'
import DocumentationPage from './pages/DocumentationPage'
import Solutions from './pages/Solutions'
import Enquiry from './pages/Enquiry'
import ConsultingService from './pages/ConsultingService'
import PFDConversionService from './pages/PFDConversionService'
import AssetIntegrityService from './pages/AssetIntegrityService'
import PIDAnalysisService from './pages/PIDAnalysisService'
import DataGovernanceService from './pages/DataGovernanceService'
import SecurityService from './pages/SecurityService'
import About from './pages/About'
import NotFound from './pages/NotFound'
// DesignIQ Components — SOFT-DISABLED: routes and sidebar hidden; source files untouched
// import DesignIQDashboard from './pages/DesignIQ/DesignIQDashboard'
// import DesignIQLists from './pages/DesignIQ/DesignIQLists'
// import StressCriticalLineList from './pages/DesignIQ/StressCriticalLineList'
// import PFDVerification from './pages/DesignIQ/PFDVerification'
// import DesignIQProjectDetail from './pages/DesignIQ/DesignIQProjectDetail'
// import DesignIQNewProject from './pages/DesignIQ/DesignIQNewProject'
// Procurement Components
import ProcurementDashboard from './pages/Procurement/ProcurementDashboard'
import VendorManagement from './pages/Procurement/VendorManagement'
import OrderManagement from './pages/Procurement/OrderManagement'
import PurchaseOrderDetail from './pages/Procurement/PurchaseOrderDetail'
import ReceiptManagement from './pages/Procurement/ReceiptManagement'
import ProjectDashboard from './pages/Procurement/ProjectDashboard'
import ProjectDetail from './pages/Procurement/ProjectDetail'
// Process Datasheet Components
import ProcessDatasheetPage from './pages/ProcessDatasheetPage'
import ComprehensivePumpForm from './pages/ProcessDatasheet/ComprehensivePumpForm'
import PFDGeneratorPage from './pages/ProcessDatasheet/PFDAnalysis'
import PumpDataSheetView from './pages/ProcessDatasheet/PumpDataSheetView'
import PressureInstrumentPage from './pages/ProcessDatasheet/PressureInstrumentPage'
import SDVStreamsPage from './pages/ProcessDatasheet/SDVStreamsPage'
import MOVEquipmentPage from './pages/ProcessDatasheet/MOVEquipmentPage'
import SmartDatasheetPage from './pages/ProcessDatasheet/SmartDatasheetPage'
import ProcessEquipmentDatasheet from './pages/Engineering/Process/ProcessEquipmentDatasheet'
import LineList from './pages/Engineering/Process/LineList'
import EquipmentList from './pages/Engineering/Process/EquipmentList'
import PIDVerification from './pages/Engineering/Process/PIDVerification'
import PIDVerificationV2 from './pages/Engineering/Process/PIDVerificationV2'
import PIDVerificationV2Report from './pages/Engineering/Process/PIDVerificationV2Report'
import PIDCheckerV2 from './pages/Engineering/Process/PIDCheckerV2'
import PIDCheckerV2Docs from './pages/Engineering/Process/PIDCheckerV2Docs'
import LegendSheetsCanvas from './pages/Engineering/Process/LegendSheetsCanvas'
import PFDQualityChecker from './pages/Engineering/Process/PFDQualityChecker'
import CriticalLineList from './pages/Engineering/Piping/CriticalLineList'
// Electrical Datasheet Components
import ElectricalDocumentsHub from './pages/Engineering/Electrical/ElectricalDocumentsHub'
import ElectricalDatasheetPage from './pages/Engineering/Electrical/ElectricalDatasheetPage'
import ElectricalEquipmentDatasheet from './pages/Engineering/Electrical/ElectricalEquipmentDatasheet'
import ElectricalDatasheetFormPage from './pages/Engineering/Electrical/ElectricalDatasheetFormPage'
import SingleLineDiagram from './pages/Engineering/Electrical/SingleLineDiagram'
import ElectricalCheckList from './pages/Engineering/Electrical/ElectricalCheckList'
import ExcelQualityCheckerPage from './pages/Engineering/Electrical/ExcelQualityCheckerPage'
import UnifiedElectricalQualityChecker from './pages/Engineering/Electrical/UnifiedElectricalQualityChecker'
import SmartElectricalDatasheetPage from './pages/Engineering/Electrical/SmartElectricalDatasheetPage'
// Instrument Datasheet Components
import InstrumentDatasheetPage from './pages/Engineering/Instrument/InstrumentDatasheetPage'
import InstrumentIndex from './pages/Engineering/Instrument/InstrumentIndex'
import IOListPage from './pages/Engineering/Instrument/IOListPage'
import IOListWorkflowPage from './pages/Engineering/Instrument/IOListWorkflow/IOListWorkflowPage'
import CableBlockDiagramPage from './pages/Engineering/Instrument/CableBlockDiagramPage'
import CableSchedulePage from './pages/Engineering/Instrument/CableSchedulePage'
// Mechanical Datasheet Components
import MechanicalDatasheetPage from './pages/Engineering/Mechanical/MechanicalDatasheetPage'
// Civil Datasheet Components
import CivilDatasheetPage from './pages/Engineering/Civil/CivilDatasheetPage'
// Digitization Components
import SpecCustomizationPage from './pages/Engineering/Digitization/SpecCustomizationPage'
import SpecProjectsPage from './pages/Engineering/Digitization/SpecProjectsPage'
import DigitizationDatasheetPage from './pages/Engineering/Digitization/DigitizationDatasheetPage'
import NonTeffMetadataPage from './pages/Engineering/Digitization/NonTeffMetadataPage'
import NonTeffProjectsPage from './pages/Engineering/Digitization/NonTeffProjectsPage'
// Piping Components
import CriticalStressLineList from './pages/Engineering/Piping/CriticalStressLineList'
import PipingDataSheet from './pages/Engineering/Piping/PipingDataSheet'
import ValveMTO from './pages/Engineering/Piping/ValveMTO'
import PipingHub from './pages/Engineering/Piping/PipingHub'
// Report Generator Components
import ReportGenerator from './pages/Admin/ReportGenerator'
import PredictiveInsights from './pages/Admin/PredictiveInsights'
import AdvancedAnalytics from './pages/Admin/AdvancedAnalytics'
import RoleManagement from './pages/Admin/RoleManagement'
import AccessRequests from './pages/Admin/AccessRequests'
import RequestAccess from './pages/RequestAccess'
// Approvals Page - Dynamic with Manager Hierarchy
import ApprovalsPageDynamic from './pages/ApprovalsPageDynamic'
// Debug Components
import FeaturesDebug from './pages/FeaturesDebug'
// AI Champion telemetry — fires per-route activity events to keep
// /admin/ai-champion live. Soft-coded URL→application/feature mapping.
import useAIChampionTracker from './hooks/useAIChampionTracker'

// SOFT-CODED: Toggle Digitization Datasheet route visibility
const ENABLE_DIGITIZATION_DATASHEET_ROUTE = false

// SOFT-CODED: Public path aliases — map convenience URLs to the page that
// should actually serve them. Useful when a URL exists in marketing material
// or muscle memory (e.g. /register, /contact, /contact-us) but no dedicated
// page lives at that path. Each entry becomes a public `<Route>` that
// `<Navigate>`s to the target. Edit this map (no JSX changes needed) to add
// or retarget aliases. Set the value to `null` to disable an alias.
//
//   /register   → /enquiry   (self-service signup is disabled; admin-provisioned)
//   /contact    → /enquiry   (public "Contact Us" form lives at /enquiry)
//   /contact-us → /enquiry   (alternate spelling used in external links)
const PUBLIC_PATH_REDIRECTS = {
  register:     '/enquiry',
  contact:      '/enquiry',
  'contact-us': '/enquiry',
}

// Back-compat alias (kept for any external reference to this constant)
const REGISTER_REDIRECT_TARGET = PUBLIC_PATH_REDIRECTS.register

function App() {
  // Mount AI Champion route-tracker (no-op when unauthenticated)
  useAIChampionTracker()

  const { isAuthenticated, user } = useSelector((state) => state.auth)
  const [userModules, setUserModules] = useState([])
  const [modulesLoaded, setModulesLoaded] = useState(false)
  const [mustChangePassword, setMustChangePassword] = useState(false)

  // SOFT-CODED: dev-only environment logging (avoids console noise on every render in production)
  if (import.meta.env.MODE !== 'production') {
    console.log('🎯 App Environment:', ENV)
    console.log('🎛️ PFD Upload Component:', FEATURE_FLAGS.pfdUploadVersion === 'new' ? 'PFDUploadNew (Ultra Complete)' : 'PFDUpload (Classic)')
    console.log('📋 CRS Multi-Revision Component:', FEATURE_FLAGS.crsMultiRevisionVersion === 'smart' ? 'CRSMultiRevisionSmart (with Finish Early)' : 'CRSMultipleRevision (Classic)')
  }

  // Fetch user modules on mount
  useEffect(() => {
    const fetchUserModules = async () => {
      if (!isAuthenticated) {
        setModulesLoaded(true)
        return
      }

      // Reset immediately on every fresh login so a stale `true` left over from
      // a previous session (e.g. via FirstLoginPasswordReset, which doesn't
      // touch this state) can never be rendered while the fetch below is
      // still in flight — this was the race condition causing the popup to
      // flash/reappear before the fresh value came back.
      setMustChangePassword(false)

      // Warmup ping: fire GET /health/ to wake Railway backend before page-level data fetches.
      // Non-fatal — runs in background, does not block module loading or page render.
      fetch(`${API_BASE_URL}${API_ENDPOINTS.HEALTH}`, { method: 'GET' })
        .then(() => console.log('[App] 🔥 Backend warmup ping succeeded'))
        .catch((e) => console.warn('[App] ⚠️ Backend warmup ping failed (non-fatal):', e.message))

      try {
        const token = localStorage.getItem('radai_access_token') || localStorage.getItem('access')
        const apiUrl = `${API_BASE_URL}/rbac/users/me/`
        console.log('🔐 App: Fetching modules from:', apiUrl)
        const response = await fetch(apiUrl, {
          headers: {
            'Authorization': `Bearer ${token}`
          }
        })
        
        if (!response.ok) {
          console.error('Failed to fetch modules, status:', response.status)
          setModulesLoaded(true)
          return
        }
        
        const data = await response.json()
        console.log('🔐 App: Full user data:', data)
        
        // Check must_change_password flag — set unconditionally from the fresh
        // API value (both true and false) so a stale true from an earlier
        // session can't survive a fresh fetch that correctly returns false.
        console.log('🔐 App: must_change_password from fresh /rbac/users/me/ call:', data.must_change_password)
        setMustChangePassword(data.must_change_password === true)
        
        if (data.modules && Array.isArray(data.modules)) {
          const moduleCodes = data.modules.map(m => m.code)
          setUserModules(moduleCodes)
          console.log('🔐 App: User accessible modules:', moduleCodes)
        } else {
          console.warn('App: No modules found in response')
          setUserModules([])
        }
      } catch (error) {
        console.error('Failed to fetch user modules:', error)
        setUserModules([])
      } finally {
        setModulesLoaded(true)
      }
    }
    
    fetchUserModules()
  }, [isAuthenticated])

  // Protected Route wrapper
  // SOFT-CODED: useCallback ensures stable component identity across renders —
  // prevents React from unmounting/remounting children on every App re-render
  const ProtectedRoute = useCallback(({ children }) => {
    return isAuthenticated ? children : <Navigate to="/login" replace />
  }, [isAuthenticated])

  // Module Protected Route wrapper
  // SOFT-CODED: stable reference via useCallback prevents remount loop
  const ModuleProtectedRoute = useCallback(({ children, moduleCode }) => {
    if (!isAuthenticated) {
      return <Navigate to="/login" replace />
    }
    
    // Smart admin check: Check nested user object AND roles array
    const userData = user?.user || user
    const hasAdminFlags = userData?.is_staff || userData?.is_superuser
    const hasSuperAdminRole = user?.roles?.some(role => 
      role.code === 'super_admin' || role.name === 'Super Administrator'
    )
    const isAdmin = hasAdminFlags || hasSuperAdminRole
    
    // Super Administrators and Staff have access to all modules
    if (isAdmin) {
      console.log('✅ App: Admin access granted for module:', moduleCode)
      return children
    }
    
    // Check if modules are loaded
    if (!modulesLoaded) {
      return (
        <div className="flex items-center justify-center h-screen">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
            <p className="text-gray-600">Loading...</p>
          </div>
        </div>
      )
    }
    
    // Check if user has access to the required module
    if (userModules.includes(moduleCode)) {
      return children
    }
    
    // Access denied
    return (
      <div className="flex items-center justify-center h-screen bg-gray-50">
        <div className="text-center p-8 bg-white rounded-lg shadow-lg max-w-md">
          <div className="text-red-500 text-6xl mb-4">🚫</div>
          <h2 className="text-2xl font-bold text-gray-800 mb-2">Access Denied</h2>
          <p className="text-gray-600 mb-4">
            You don&apos;t have permission to access this feature.
          </p>
          <p className="text-sm text-gray-500 mb-6">
            Required module: <span className="font-semibold">{moduleCode}</span>
          </p>
          <button
            onClick={() => window.location.href = '/dashboard'}
            className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
          >
            Go to Dashboard
          </button>
        </div>
      </div>
    )
  }, [isAuthenticated, user, modulesLoaded, userModules])

  // Public Route wrapper (redirect if authenticated)
  // SOFT-CODED: stable reference via useCallback prevents remount loop
  const PublicRoute = useCallback(({ children }) => {
    return !isAuthenticated ? children : <Navigate to="/dashboard" replace />
  }, [isAuthenticated])
  
  // Handle password change success
  const handlePasswordChangeSuccess = async () => {
    setMustChangePassword(false)
    // Immediately clear expiry banner — backend has already cleared the flag
    passwordExpiryService.clearAndNotify()
    // Re-check from backend so the service has accurate fresh state
    passwordExpiryService.checkPasswordExpiry().catch(err =>
      console.warn('[App] Failed to refresh expiry status after password change:', err)
    )
    // Refresh user data
    try {
      const token = localStorage.getItem('radai_access_token') || localStorage.getItem('access')
      const apiUrl = `${API_BASE_URL}/rbac/users/me/`
      const response = await fetch(apiUrl, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      })
      if (response.ok) {
        const data = await response.json()
        setMustChangePassword(data.must_change_password === true)
      }
    } catch (error) {
      console.error('Failed to refresh user data:', error)
    }
  }

  return (
    <>
      {/* Password Expiry Banner - shown globally when password is expiring or expired */}
      {isAuthenticated && <PasswordExpiryBanner />}
      
      {/* Password Change Modal - shown globally when required */}
      {isAuthenticated && mustChangePassword && (
        <ChangePasswordModal
          isOpen={true}
          isRequired={true}
          onSuccess={handlePasswordChangeSuccess}
        />
      )}
      
      <FirstLoginCheck onPasswordChanged={handlePasswordChangeSuccess}>
        <Routes>
          <Route path="/" element={<Layout />}>
            <Route index element={<Home />} />
            
            {/* Solutions Page */}
            <Route path="solutions" element={<Solutions />} />
            
            {/* Enquiry Page */}
            <Route path="enquiry" element={<Enquiry />} />
            
            {/* Services */}
          <Route path="services/consulting" element={<ConsultingService />} />
          <Route path="services/pfd-conversion" element={<PFDConversionService />} />
          <Route path="services/asset-integrity" element={<AssetIntegrityService />} />
          <Route path="services/pid-analysis" element={<PIDAnalysisService />} />
          <Route path="data-governance" element={<DataGovernanceService />} />
          <Route path="security" element={<SecurityService />} />
          <Route path="about" element={<About />} />
          
          {/* Public Routes */}
        <Route
          path="login"
          element={
            <PublicRoute>
              <Login />
            </PublicRoute>
          }
        />
        {/* SOFT-CODED: Public path aliases (see PUBLIC_PATH_REDIRECTS at top
            of this file). Smart-redirects URLs like /register, /contact and
            /contact-us to their real destination so visitors never land on a
            blank/404 page. Add new aliases in the map — no JSX changes here. */}
        {Object.entries(PUBLIC_PATH_REDIRECTS).map(([path, target]) =>
          target ? (
            <Route
              key={`alias-${path}`}
              path={path}
              element={<Navigate to={target} replace />}
            />
          ) : null
        )}
        {/* SOFT-CODED: Subscription pricing page disabled for in-house deployment */}
        {/* <Route
          path="pricing"
          element={
            <PublicRoute>
              <SubscriptionPlans />
            </PublicRoute>
          }
        /> */}
        
        {/* Password Reset Routes - Public */}
        <Route path="setup-password" element={<SetupPassword />} />
        <Route path="reset-password" element={<SetupPassword />} />
        <Route path="request-password-reset" element={<RequestPasswordReset />} />
        <Route path="forgot-password" element={<RequestPasswordReset />} />
        
        {/* Change Password - Protected Route */}
        <Route 
          path="change-password" 
          element={
            <ProtectedRoute>
              <ChangePassword />
            </ProtectedRoute>
          } 
        />
        
        {/* Finance Approval - Public Route */}
        <Route path="finance/approve/:token" element={<InvoiceApproval />} />
        
        <Route path="terms-of-service" element={<TermsOfService />} />
        <Route path="privacy-policy" element={<PrivacyPolicy />} />
        
        {/* Protected Routes */}
        <Route
          path="dashboard"
          element={
            <ProtectedRoute>
              <Dashboard />
            </ProtectedRoute>
          }
        />
        <Route
          path="approvals"
          element={
            <ProtectedRoute>
              <ApprovalsPageDynamic />
            </ProtectedRoute>
          }
        />
        <Route
          path="features-debug"
          element={
            <ProtectedRoute>
              <FeaturesDebug />
            </ProtectedRoute>
          }
        />
        <Route
          path="profile"
          element={
            <ProtectedRoute>
              <Profile />
            </ProtectedRoute>
          }
        />
        <Route
          path="notifications"
          element={
            <ProtectedRoute>
              <NotificationPanel />
            </ProtectedRoute>
          }
        />
        <Route
          path="usage-analytics"
          element={
            <ProtectedRoute>
              <UsageDashboard />
            </ProtectedRoute>
          }
        />
        
        {/* SOFT-CODED: /pid/upload disabled — replaced by /engineering/process/pid-verification */}
        {/* <Route
          path="pid/upload"
          element={
            <ModuleProtectedRoute moduleCode="pid_analysis">
              <PIDUpload />
            </ModuleProtectedRoute>
          }
        /> */}
        {/* Redirect old /pid/upload path to new location */}
        <Route path="pid/upload" element={<Navigate to="/engineering/process/pid-verification" replace />} />
        <Route
          path="pid/report/:id"
          element={
            <ModuleProtectedRoute moduleCode="pid_analysis">
              <PIDReport />
            </ModuleProtectedRoute>
          }
        />
        <Route
          path="pid/history"
          element={
            <ModuleProtectedRoute moduleCode="pid_analysis">
              <PIDHistory />
            </ModuleProtectedRoute>
          }
        />
        
        {/* Feature Routes - PFD Converter */}
        <Route
          path="pfd/upload"
          element={
            <ModuleProtectedRoute moduleCode="pfd_to_pid">
              <PFDUpload />
            </ModuleProtectedRoute>
          }
        />
        <Route
          path="pfd/analyze/:documentId"
          element={
            <ModuleProtectedRoute moduleCode="pfd_to_pid">
              <PFDAnalysisConsole />
            </ModuleProtectedRoute>
          }
        />
        <Route
          path="pfd/convert/:documentId"
          element={
            <ModuleProtectedRoute moduleCode="pfd_to_pid">
              <PFDConvert />
            </ModuleProtectedRoute>
          }
        />
        <Route
          path="pfd/s3-browser"
          element={
            <ModuleProtectedRoute moduleCode="pfd_to_pid">
              <S3PFDBrowser />
            </ModuleProtectedRoute>
          }
        />
        <Route
          path="pfd/history"
          element={
            <ModuleProtectedRoute moduleCode="pfd_to_pid">
              <PFDHistory />
            </ModuleProtectedRoute>
          }
        />
        <Route
          path="pfd/analysis/:id"
          element={
            <ModuleProtectedRoute moduleCode="pfd_to_pid">
              <PFDFiveStageAnalysis />
            </ModuleProtectedRoute>
          }
        />
        <Route
          path="pfd/s3-management"
          element={
            <ModuleProtectedRoute moduleCode="pfd_to_pid">
              <S3Management />
            </ModuleProtectedRoute>
          }
        />
        
        {/* Feature Routes - Data Mining Platform */}
        <Route
          path="data-mining"
          element={
            <ModuleProtectedRoute moduleCode="data_mining">
              <DataMiningPlatform />
            </ModuleProtectedRoute>
          }
        />
        
        {/* Feature Routes - CRS Documents */}
        <Route
          path="crs/documents"
          element={
            <ModuleProtectedRoute moduleCode="crs_documents">
              <CRSDocuments />
            </ModuleProtectedRoute>
          }
        />
        <Route
          path="crs/documents/:id"
          element={
            <ModuleProtectedRoute moduleCode="crs_documents">
              <CRSChainDetail />
            </ModuleProtectedRoute>
          }
        />
        <Route
          path="crs/documents/history"
          element={
            <ModuleProtectedRoute moduleCode="crs_documents">
              <CRSDocumentsHistory />
            </ModuleProtectedRoute>
          }
        />
        <Route
          path="crs/multiple-revision"
          element={
            <ModuleProtectedRoute moduleCode="crs_documents">
              <CRSMultipleRevision />
            </ModuleProtectedRoute>
          }
        />


        {/* Feature Routes - Finance Invoice Automation */}
        <Route
          path="finance"
          element={
            <ModuleProtectedRoute moduleCode="finance">
              <FinanceHub />
            </ModuleProtectedRoute>
          }
        />
        {/* SOFT-CODED: /finance/upload route retired — link removed from UI */}
        {/* SOFT-CODED: /finance/invoices and /finance/invoices/:id routes retired — link removed from UI */}
        <Route
          path="finance/invoice-tracker"
          element={
            <ModuleProtectedRoute moduleCode="finance">
              <InvoiceTracker />
            </ModuleProtectedRoute>
          }
        />
        <Route
          path="finance/salary-slip"
          element={
            <ModuleProtectedRoute moduleCode="finance">
              <SalarySlip />
            </ModuleProtectedRoute>
          }
        />
        {/* ── Human Resources Routes ─────────────────────────────────────────── */}
        {/* SOFT-CODED: Controlled by FEATURE_FLAGS.enableHRModule in features.config.js */}
        {FEATURE_FLAGS.enableHRModule ? (
          <>
            <Route
              path="hr"
              element={
                <ProtectedRoute>
                  <HRDashboard />
                </ProtectedRoute>
              }
            />
            <Route
              path="hr/employees"
              element={
                <ProtectedRoute>
                  <HREmployees />
                </ProtectedRoute>
              }
            />
            <Route
              path="hr/payroll"
              element={
                <ProtectedRoute>
                  <Payroll />
                </ProtectedRoute>
              }
            />
            <Route
              path="hr/leave"
              element={
                <ProtectedRoute>
                  <EmployeeSelfService />
                </ProtectedRoute>
              }
            />
            <Route
              path="hr/onboarding"
              element={
                <ProtectedRoute>
                  <OnboardingOffboarding />
                </ProtectedRoute>
              }
            />
          </>
        ) : (
          // Redirect all /hr/* routes to dashboard when HR module is disabled
          <>
            <Route path="hr" element={<Navigate to="/dashboard" replace />} />
            <Route path="hr/*" element={<Navigate to="/dashboard" replace />} />
          </>
        )}
        <Route
          path="hr/site-visits"
          element={
            <ProtectedRoute>
              <SiteVisits />
            </ProtectedRoute>
          }
        />
        {/* Internal Sales Analytics Dashboard */}
        <Route
          path="finance/sales"
          element={
            <ProtectedRoute>
              <InternalSalesDashboard />
            </ProtectedRoute>
          }
        />
        <Route
          path="sales"
          element={
            <ProtectedRoute>
              <InternalSalesDashboard />
            </ProtectedRoute>
          }
        />

        {/* DesignIQ Routes — SOFT-DISABLED: all DesignIQ routes commented out;
             source files in pages/DesignIQ/ are untouched and can be re-enabled here.
        <Route path="designiq" element={<ModuleProtectedRoute moduleCode="designiq"><DesignIQDashboard /></ModuleProtectedRoute>} />
        <Route path="designiq/new" element={<ModuleProtectedRoute moduleCode="designiq"><DesignIQNewProject /></ModuleProtectedRoute>} />
        <Route path="designiq/lists" element={<ModuleProtectedRoute moduleCode="designiq"><DesignIQLists /></ModuleProtectedRoute>} />
        <Route path="designiq/stress-critical-line-list" element={<ModuleProtectedRoute moduleCode="designiq"><StressCriticalLineList /></ModuleProtectedRoute>} />
        <Route path="designiq/pfd-verification" element={<ModuleProtectedRoute moduleCode="designiq"><PFDVerification /></ModuleProtectedRoute>} />
        <Route path="designiq/projects/:id" element={<ModuleProtectedRoute moduleCode="designiq"><DesignIQProjectDetail /></ModuleProtectedRoute>} />
        */}

        {/* Procurement Routes */}
        <Route
          path="procurement"
          element={
            <ModuleProtectedRoute moduleCode="procurement">
              <ProcurementDashboard />
            </ModuleProtectedRoute>
          }
        />
        <Route
          path="procurement/vendors"
          element={
            <ModuleProtectedRoute moduleCode="procurement_vendors">
              <VendorManagement />
            </ModuleProtectedRoute>
          }
        />
        <Route
          path="procurement/requisitions"
          element={
            <ModuleProtectedRoute moduleCode="procurement_requisitions">
              <OrderManagement />
            </ModuleProtectedRoute>
          }
        />
        <Route
          path="procurement/requisitions/:id"
          element={
            <ModuleProtectedRoute moduleCode="procurement_requisitions">
              <OrderManagement />
            </ModuleProtectedRoute>
          }
        />
        <Route
          path="procurement/orders"
          element={
            <ModuleProtectedRoute moduleCode="procurement_orders">
              <OrderManagement />
            </ModuleProtectedRoute>
          }
        />
        <Route
          path="procurement/orders/:id"
          element={
            <ModuleProtectedRoute moduleCode="procurement_orders">
              <PurchaseOrderDetail />
            </ModuleProtectedRoute>
          }
        />
        <Route
          path="procurement/receipts"
          element={
            <ModuleProtectedRoute moduleCode="procurement_receipts">
              <ReceiptManagement />
            </ModuleProtectedRoute>
          }
        />
        <Route
          path="procurement/projects"
          element={
            <ModuleProtectedRoute moduleCode="procurement">
              <ProjectDashboard />
            </ModuleProtectedRoute>
          }
        />
        <Route
          path="procurement/projects/:id"
          element={
            <ModuleProtectedRoute moduleCode="procurement">
              <ProjectDetail />
            </ModuleProtectedRoute>
          }
        />

        {/* Process Datasheet Routes */}
        {/* Process Data Sheet - Main Page */}
        <Route
          path="engineering/process/datasheet"
          element={
            <ModuleProtectedRoute moduleCode="process_datasheet">
              <ProcessDatasheetPage />
            </ModuleProtectedRoute>
          }
        />

        {/* Process Data Sheet - PFD Generator from P&ID */}
        <Route
          path="engineering/process/datasheet/pfd"
          element={
            <ModuleProtectedRoute moduleCode="process_datasheet">
              <PFDGeneratorPage />
            </ModuleProtectedRoute>
          }
        />

        {/* Process Data Sheet - View Pump Data (Template Format) */}
        <Route
          path="engineering/process/datasheet/view/:id"
          element={
            <ModuleProtectedRoute moduleCode="process_datasheet">
              <PumpDataSheetView />
            </ModuleProtectedRoute>
          }
        />

                {/* Process Data Sheet - SDV Streams P&ID Upload */}
        <Route
          path="engineering/process/datasheet/streams"
          element={
            <ModuleProtectedRoute moduleCode="process_datasheet">
              <SDVStreamsPage />
            </ModuleProtectedRoute>
          }
        />          {/* Smart Datasheet - Unified AI Tool for All 4 Datasheet Types */}
          <Route
            path="engineering/process/datasheet/smart"
            element={
              <ModuleProtectedRoute moduleCode="process_datasheet">
                <SmartDatasheetPage />
              </ModuleProtectedRoute>
            }
          />
        {/* Process Data Sheet - MOV Equipment P&ID Upload */}
        <Route
          path="engineering/process/datasheet/equipment"
          element={
            <ModuleProtectedRoute moduleCode="process_datasheet">
              <MOVEquipmentPage />
            </ModuleProtectedRoute>
          }
        />


{/* Process Data Sheet - Pressure Instrument P&ID Upload */}
        <Route
          path="engineering/process/datasheet/pressure-instrument"
          element={
            <ModuleProtectedRoute moduleCode="process_datasheet">
              <PressureInstrumentPage />
            </ModuleProtectedRoute>
          }
        />

        {/* Process Equipment Datasheet - P&ID Upload for Equipment Detection */}
        <Route
          path="engineering/process/datasheet/equipment"
          element={
            <ModuleProtectedRoute moduleCode="process_datasheet">
              <ProcessEquipmentDatasheet />
            </ModuleProtectedRoute>
          }
        />


        {/* P&ID Verification - Default is now V2 */}
        <Route
          path="engineering/process/pid-verification"
          element={
            <ModuleProtectedRoute moduleCode="pid_analysis">
              <PIDVerificationV2 />
            </ModuleProtectedRoute>
          }
        />

        {/* P&ID Verification V1 (Legacy) */}
        <Route
          path="engineering/process/pid-verification-v1"
          element={
            <ModuleProtectedRoute moduleCode="pid_analysis">
              <PIDVerification />
            </ModuleProtectedRoute>
          }
        />

        {/* P&ID Verification — Comparison Report */}
        <Route
          path="engineering/process/pid-verification/report/:documentId"
          element={
            <ModuleProtectedRoute moduleCode="pid_analysis">
              <PIDVerificationV2Report />
            </ModuleProtectedRoute>
          }
        />

        {/* PFD Quality Checker */}
        <Route
          path="engineering/process/pfd-quality-checker"
          element={
            <ProtectedRoute>
              <PFDQualityChecker />
            </ProtectedRoute>
          }
        />

        {/* P&ID Checker V2 — Line-List Extractor */}
        <Route
          path="engineering/process/pid-checker-v2"
          element={
            <ModuleProtectedRoute moduleCode="pid_analysis">
              <PIDCheckerV2 />
            </ModuleProtectedRoute>
          }
        />

        {/* P&ID Checker V2 — Documentation & Workflow */}
        <Route
          path="engineering/process/pid-checker-v2/docs"
          element={
            <ModuleProtectedRoute moduleCode="pid_analysis">
              <PIDCheckerV2Docs />
            </ModuleProtectedRoute>
          }
        />

        {/* P&ID Checker V2 — Legend Sheets Canvas */}
        <Route
          path="engineering/process/pid-checker-v2/legends"
          element={
            <ModuleProtectedRoute moduleCode="pid_analysis">
              <LegendSheetsCanvas />
            </ModuleProtectedRoute>
          }
        />

        {/* Line List - Base Extraction (P&ID Only) */}
        <Route
          path="engineering/process/line-list"
          element={
            <ModuleProtectedRoute moduleCode="pid_analysis">
              <LineList />
            </ModuleProtectedRoute>
          }
        />
        {/* Equipment List - P&ID Equipment Extraction */}
        <Route
          path="engineering/process/equipment-list"
          element={
            <ModuleProtectedRoute moduleCode="pid_analysis">
              <EquipmentList />
            </ModuleProtectedRoute>
          }
        />
        {/* Critical Line List - Full Enrichment (5 Documents) */}
        <Route
          path="engineering/piping/critical-line-list"
          element={
            <ProtectedRoute>
              <CriticalLineList />
            </ProtectedRoute>
          }
        />
          {/* Piping Routes */}
          {/* Piping Hub - Landing page for /engineering/piping (fixes 404) */}
          <Route
            path="engineering/piping"
            element={
              <ProtectedRoute>
                <PipingHub />
              </ProtectedRoute>
            }
          />
          {/* Valve MTO (Material Take-Off) */}
          <Route
            path="engineering/piping/pms"
            element={
              <ProtectedRoute>
                <ValveMTO />
              </ProtectedRoute>
            }
          />

          {/* Piping Data Sheet - Main Page */}
          <Route
            path="engineering/piping/datasheet"
            element={
              <ProtectedRoute>
                <PipingDataSheet />
              </ProtectedRoute>
            }
          />

          {/* Piping Data Sheet - Critical Stress Lines Sub-Page */}
          <Route
            path="engineering/piping/datasheet/critical-stress-lines"
          element={
            <ProtectedRoute>
              <CriticalStressLineList />
            </ProtectedRoute>
          }
        />

        {/* Electrical Routes */}
        {/* Single Line Diagram - Coming Soon */}
        <Route
          path="engineering/electrical/sld"
          element={
            <ProtectedRoute>
              <SingleLineDiagram />
            </ProtectedRoute>
          }
        />

        {/* SOFT-CODED: Electrical Check List - NEW FEATURE */}
        <Route
          path="engineering/electrical/checklist"
          element={
            <ModuleProtectedRoute moduleCode="electrical_checklist">
              <ElectricalCheckList />
            </ModuleProtectedRoute>
          }
        />

        {/* Electrical Documents Hub - Main Landing for All 27 Initiatives */}
        <Route
          path="engineering/electrical/datasheet"
          element={
            <ModuleProtectedRoute moduleCode="electrical_datasheet">
              <ElectricalDatasheetPage />
            </ModuleProtectedRoute>
          }
        />
        
        {/* Electrical Equipment Smart Datasheet Generator - SLD Upload & AI Detection */}
        <Route
          path="engineering/electrical/datasheet/smart"
          element={
            <ModuleProtectedRoute moduleCode="electrical_datasheet">
              <ElectricalEquipmentDatasheet />
            </ModuleProtectedRoute>
          }
        />
        
        {/* Transformer Datasheet Verification — served by ElectricalEquipmentDatasheet */}
        <Route
          path="engineering/electrical/transformer-verification"
          element={
            <ModuleProtectedRoute moduleCode="electrical_datasheet">
              <ElectricalEquipmentDatasheet />
            </ModuleProtectedRoute>
          }
        />
        
        {/* Unified Quality Checker - Universal AI-Powered Tool for ALL Equipment Types */}
        <Route
          path="engineering/electrical/datasheet/unified-checker"
          element={
            <ModuleProtectedRoute moduleCode="electrical_datasheet">
              <UnifiedElectricalQualityChecker />
            </ModuleProtectedRoute>
          }
        />
        
        {/* Excel Quality Checker - AI-Powered Quality Check Tool */}
        <Route
          path="engineering/electrical/datasheet/quality-checker/*"
          element={
            <ModuleProtectedRoute moduleCode="electrical_datasheet">
              <ExcelQualityCheckerPage />
            </ModuleProtectedRoute>
          }
        />
        
        {/* Legacy route - redirect to main hub */}
        <Route
          path="engineering/electrical"
          element={
            <ModuleProtectedRoute moduleCode="electrical_datasheet">
              <ElectricalDocumentsHub />
            </ModuleProtectedRoute>
          }
        />
        {/* Smart Electrical Datasheet Generator - 6 Equipment Types (Transformer, DG Set, MV/LV Switchgear, AC/DC UPS) */}
        <Route
          path="engineering/electrical/datasheet/smart-generator"
          element={
            <ModuleProtectedRoute moduleCode="electrical_datasheet">
              <SmartElectricalDatasheetPage />
            </ModuleProtectedRoute>
          }
        />
        <Route
          path="engineering/electrical/datasheet/create"
          element={
            <ModuleProtectedRoute moduleCode="electrical_datasheet">
              <ElectricalDatasheetFormPage />
            </ModuleProtectedRoute>
          }
        />
        <Route
          path="engineering/electrical/datasheet/:id"
          element={
            <ModuleProtectedRoute moduleCode="electrical_datasheet">
              <ElectricalDatasheetFormPage />
            </ModuleProtectedRoute>
          }
        />

        {/* Instrument Routes */}
        {/* Instrument Index - Coming Soon */}
        <Route
          path="engineering/instrument/index"
          element={
            <ProtectedRoute>
              <InstrumentIndex />
            </ProtectedRoute>
          }
        />

        {/* Instrument Datasheet Routes */}
        <Route
          path="engineering/instrument/datasheet"
          element={
            <ModuleProtectedRoute moduleCode="instrument_datasheet">
              <InstrumentDatasheetPage />
            </ModuleProtectedRoute>
          }
        />
        <Route
          path="engineering/instrument/datasheet/io-list"
          element={
            <ModuleProtectedRoute moduleCode="instrument_datasheet">
              <IOListWorkflowPage />
            </ModuleProtectedRoute>
          }
        />
        <Route
          path="engineering/instrument/datasheet/io-list/generator"
          element={
            <ModuleProtectedRoute moduleCode="instrument_datasheet">
              <IOListPage />
            </ModuleProtectedRoute>
          }
        />
        <Route
          path="engineering/instrument/datasheet/cable-block-diagram"
          element={
            <ModuleProtectedRoute moduleCode="instrument_datasheet">
              <CableBlockDiagramPage />
            </ModuleProtectedRoute>
          }
        />
        <Route
          path="engineering/instrument/datasheet/cable-schedule"
          element={
            <ModuleProtectedRoute moduleCode="instrument_datasheet">
              <CableSchedulePage />
            </ModuleProtectedRoute>
          }
        />

        {/* Mechanical Datasheet Routes */}
        <Route
          path="engineering/mechanical/datasheet"
          element={
            <ModuleProtectedRoute moduleCode="mechanical_datasheet">
              <MechanicalDatasheetPage />
            </ModuleProtectedRoute>
          }
        />

        {/* Civil Datasheet Routes — Coming Soon hub (soft-coded: cards configured in CivilDatasheetPage.jsx) */}
        <Route
          path="engineering/civil/datasheet"
          element={
            <ProtectedRoute>
              <CivilDatasheetPage />
            </ProtectedRoute>
          }
        />

        {/* Digitization Routes — Coming Soon hubs (soft-coded: cards configured in each page file) */}
        <Route
          path="engineering/digitization/spec-customization"
          element={
            <ProtectedRoute>
              <SpecCustomizationPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="engineering/digitization/spec-customization/projects"
          element={
            <ProtectedRoute>
              <SpecProjectsPage />
            </ProtectedRoute>
          }
        />
        {ENABLE_DIGITIZATION_DATASHEET_ROUTE && (
          <Route
            path="engineering/digitization/datasheet"
            element={
              <ProtectedRoute>
                <DigitizationDatasheetPage />
              </ProtectedRoute>
            }
          />
        )}
        <Route
          path="engineering/digitization/non-teff-metadata"
          element={
            <ProtectedRoute>
              <NonTeffMetadataPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="engineering/digitization/non-teff-metadata/projects"
          element={
            <ProtectedRoute>
              <NonTeffProjectsPage />
            </ProtectedRoute>
          }
        />

        {/* Project Management — phased: Cost Dashboard → Estimates → Documents → (Phase 2+) AI/EVM/Risk */}
        <Route
          path="projects"
          element={
            <ModuleProtectedRoute moduleCode="project_control">
              <ProjectsPage />
            </ModuleProtectedRoute>
          }
        />

        {/* SOFT-CODED: Planning Package (Feature 6.2 under Project Control) */}
        <Route
          path="planning-packages"
          element={
            <ModuleProtectedRoute moduleCode="project_control">
              <PlanningPackagePage />
            </ModuleProtectedRoute>
          }
        />

        {/* QHSE Routes */}
        <Route
          path="qhse"
          element={
            <ModuleProtectedRoute moduleCode="qhse">
              <QHSEHub />
            </ModuleProtectedRoute>
          }
        />
        <Route
          path="qhse/general/*"
          element={
            <ModuleProtectedRoute moduleCode="qhse">
              <GeneralQHSE />
            </ModuleProtectedRoute>
          }
        />
        {/* SOFT-CODED: QHSE Interconnected Demo route removed (not needed) */}
        {/* <Route
          path="qhse/interconnected-demo/:projectId?"
          element={
            <ModuleProtectedRoute moduleCode="qhse">
              <QHSEInterconnectedDemo />
            </ModuleProtectedRoute>
          }
        /> */}

        {/* Admin Routes */}
        <Route
          path="admin"
          element={
            <ProtectedRoute>
              <AdminDashboard />
            </ProtectedRoute>
          }
        />
        <Route
          path="admin/dashboard"
          element={
            <ProtectedRoute>
              <AdminDashboard />
            </ProtectedRoute>
          }
        />
        <Route
          path="admin/users"
          element={
            <ProtectedRoute>
              <UserManagement />
            </ProtectedRoute>
          }
        />
        <Route
          path="admin/roles"
          element={
            <ProtectedRoute>
              <RoleManagement />
            </ProtectedRoute>
          }
        />
        <Route
          path="admin/access-requests"
          element={<Navigate to="/admin/roles" replace />}
        />
        <Route
          path="request-access"
          element={
            <ProtectedRoute>
              <RequestAccess />
            </ProtectedRoute>
          }
        />
        <Route
          path="admin/users/:id"
          element={
            <ProtectedRoute>
              <UserDetail />
            </ProtectedRoute>
          }
        />
        <Route
          path="admin/wrench"
          element={
            <ProtectedRoute>
              <WrenchIntegration />
            </ProtectedRoute>
          }
        />
        <Route
          path="admin/ai-champion"
          element={
            <ProtectedRoute>
              <AIChampion />
            </ProtectedRoute>
          }
        />
        <Route
          path="admin/enquiries"
          element={
            <ProtectedRoute>
              <EnquiryManagement />
            </ProtectedRoute>
          }
        />
        {/* SOFT-CODED: Subscription management disabled for in-house deployment */}
        {/* <Route
          path="admin/subscriptions"
          element={
            <ProtectedRoute>
              <SubscriptionManagement />
            </ProtectedRoute>
          }
        /> */}
        <Route
          path="admin/reports"
          element={
            <ProtectedRoute>
              <ReportGenerator />
            </ProtectedRoute>
          }
        />
        <Route
          path="admin/reports/predictive"
          element={
            <ProtectedRoute>
              <PredictiveInsights />
            </ProtectedRoute>
          }
        />
        <Route
          path="admin/reports/analytics"
          element={
            <ProtectedRoute>
              <AdvancedAnalytics />
            </ProtectedRoute>
          }
        />
        <Route
          path="admin/activity-reports"
          element={
            <ProtectedRoute>
              <ActivityReports />
            </ProtectedRoute>
          }
        />

        {/* Contact Support */}
        <Route
          path="support"
          element={
            <ProtectedRoute>
              <ContactSupportPage />
            </ProtectedRoute>
          }
        />

        {/* Documentation */}
        <Route
          path="documentation"
          element={
            <ProtectedRoute>
              <DocumentationPage />
            </ProtectedRoute>
          }
        />

        {/* 404 Not Found */}
        <Route path="*" element={<NotFound />} />
      </Route>
    </Routes>
    </FirstLoginCheck>
    </>
  )
}

export default App










