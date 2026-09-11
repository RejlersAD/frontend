export const CORPORATE_CAREER_LEVELS = [
  { value: 'corp_associate', label: 'Associate', years: 'Operational and administrative support' },
  { value: 'corp_specialist', label: 'Specialist', years: 'Independent functional responsibility' },
  { value: 'corp_senior', label: 'Senior Specialist', years: 'Advanced expertise and mentoring' },
  { value: 'corp_lead', label: 'Team Lead', years: 'Team coordination and delivery' },
  { value: 'corp_manager', label: 'Manager', years: 'People and functional management' },
  { value: 'corp_head', label: 'Department Head', years: 'Department direction and accountability' },
];
export const CORPORATE_FUNCTIONS = ['Finance & Accounting', 'Human Resources', 'Sales & Business Development', 'Procurement', 'IT & Digital Services', 'Administration', 'Operations Support', 'Facilities', 'Document Control', 'Quality Assurance', 'Marketing & Communications', 'Legal & Compliance'];
export const CORPORATE_SKILLS = ['Microsoft Excel', 'Power BI', 'SAP', 'Microsoft 365', 'Financial Reporting', 'Budgeting', 'Recruitment', 'Payroll Administration', 'CRM', 'Contract Management', 'Supplier Management', 'Document Management', 'Customer Service', 'Business Analysis'];
const SUPPORT_DEPARTMENTS = new Set(['finance', 'sales', 'hr', 'it', 'admin', 'management', 'operations', 'procurement', 'quality', 'radai', 'human resources', 'information technology', 'administration', 'corporate & operational support']);
export function defaultCareerTrack(level, department) {
  if (String(level || '').startsWith('corp_')) return 'corporate';
  if (level) return 'engineering';
  return SUPPORT_DEPARTMENTS.has(String(department || '').trim().toLowerCase()) ? 'corporate' : 'engineering';
}
