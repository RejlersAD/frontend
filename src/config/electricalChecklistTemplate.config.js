/**
 * UPS & Battery Checklist Template Configuration
 * Based on: Check_List_Template.xlsx
 * 
 * Template Structure:
 * - 6 Columns: General Information | To be fill at Site | Remarks | Need List | Query | Company Reply
 * - 15 Sections with multiple fields each
 */

// Column Definitions
export const TEMPLATE_COLUMNS = [
  { 
    key: 'field_name', 
    label: 'General Information', 
    width: '25%',
    editable: false,
    description: 'Field name from template'
  },
  { 
    key: 'site_value', 
    label: 'To be fill at Site', 
    width: '15%',
    editable: true,
    inputType: 'text',
    description: 'Values to be filled during site visit'
  },
  { 
    key: 'remarks', 
    label: 'Remarks', 
    width: '15%',
    editable: true,
    inputType: 'textarea',
    description: 'Additional remarks or observations'
  },
  { 
    key: 'need_list', 
    label: 'Need List', 
    width: '15%',
    editable: true,
    inputType: 'textarea',
    description: 'List of items or actions needed'
  },
  { 
    key: 'query', 
    label: 'Query', 
    width: '15%',
    editable: true,
    inputType: 'textarea',
    description: 'Questions or clarifications required'
  },
  { 
    key: 'company_reply', 
    label: 'Company Reply', 
    width: '15%',
    editable: true,
    inputType: 'textarea',
    description: 'Company response to queries'
  }
];

// Template Sections with All Fields
export const TEMPLATE_SECTIONS = [
  {
    id: 'section_1',
    number: '1',
    title: 'GENERAL SITE INFORMATION',
    description: 'Basic site and visit information',
    color: 'blue',
    icon: 'InformationCircleIcon',
    fields: [
      { id: 'item', name: 'Item', type: 'text', required: false },
      { id: 'area_facility', name: 'Area/Facility', type: 'text', required: true },
      { id: 'substation', name: 'Substation/IES/MCR', type: 'text', required: true },
      { id: 'ups_room', name: 'UPS Room / Battery Room', type: 'text', required: true },
      { id: 'date_of_visit', name: 'Date of Visit', type: 'date', required: true },
      { id: 'attendees', name: 'Attendees (Ops/Maint/FEED)', type: 'textarea', required: true },
      { id: 'safety_induction', name: 'Safety Induction Completed', type: 'select', 
        options: ['Yes', 'No', 'N/A'], required: true }
    ]
  },
  {
    id: 'section_2',
    number: '2',
    title: 'UPS IDENTIFICATION',
    subtitle: '(ONE ROW PER UPS)',
    description: 'UPS equipment identification and specifications',
    color: 'green',
    icon: 'BoltIcon',
    repeatable: true,
    fields: [
      { id: 'ups_tag', name: 'UPS Tag', type: 'text', required: true },
      { id: 'ups_type', name: 'UPS Type(AC/DC/Static)', type: 'select',
        options: ['AC', 'DC', 'Static', 'Other'], required: true },
      { id: 'application', name: 'Application(DCS/F&G/ESD/C&P)', type: 'text', required: true },
      { id: 'ups_make_model', name: 'UPS Make & Model', type: 'text', required: true },
      { id: 'rated_capacity', name: 'Rated Capacity(kVA/A)', type: 'text', required: true }
    ]
  },
  {
    id: 'section_3',
    number: '3',
    title: 'LOADING DATA',
    description: 'UPS load information and measurements',
    color: 'yellow',
    icon: 'ChartBarIcon',
    fields: [
      { id: 'operating_load', name: 'Presenting Operating Load(%/KVA/A)', type: 'text', required: true },
      { id: 'load_measurement_source', name: 'Load Measurement Source(HMI/ECMS/Clamp/Ammeter)', 
        type: 'select', options: ['HMI', 'ECMS', 'Clamp', 'Ammeter', 'Other'], required: true },
      { id: 'highest_load', name: 'Highest Historical Load Encountered', type: 'text', required: false },
      { id: 'operating_condition', name: 'Operating Condition Durring Peak Load', type: 'textarea', required: false },
      { id: 'load_margin', name: 'Load Margin Adequated(<70%)', type: 'select',
        options: ['Yes', 'No', 'N/A'], required: true },
      { id: 'autonomy_time', name: 'Autonomy Time', type: 'text', required: true }
    ]
  },
  {
    id: 'section_4',
    number: '4',
    title: 'BATTERY SYSTEM DATA',
    description: 'Battery specifications and condition',
    color: 'purple',
    icon: 'Battery100Icon',
    fields: [
      { id: 'battery_make', name: 'Battery Make', type: 'text', required: true },
      { id: 'battery_rating_voltage', name: 'Rating & Voltage', type: 'text', required: true },
      { id: 'battery_model', name: 'Battery Model', type: 'text', required: true },
      { id: 'year_manufacturing', name: 'Year of Manufacturing', type: 'number', required: true },
      { id: 'battery_ah_rating', name: 'Battery Ah Rating', type: 'text', required: true },
      { id: 'number_of_cells', name: 'Number of Cells', type: 'number', required: true },
      { id: 'battery_installation_year', name: 'Battery Installation Year', type: 'number', required: true },
      { id: 'battery_physical_condition', name: 'Battery Physical Condition', type: 'textarea', required: true },
      { id: 'additional_space', name: 'Additional Space Avaialbility if needs to be add new cells (Only for record and observation and no action)', 
        type: 'textarea', required: false },
      { id: 'design_life', name: 'Design Life and Replacement Year', type: 'text', required: true },
      { id: 'battery_condition_test', name: 'Battery Condition based on the capacity test', type: 'textarea', required: true }
    ]
  },
  {
    id: 'section_5',
    number: '5',
    title: 'FEEDER RATING & PROTECTION',
    description: 'Feeder ratings and protection coordination',
    color: 'red',
    icon: 'ShieldCheckIcon',
    fields: [
      { id: 'normal_input_feeder', name: 'Normal Input Feeder Rating(A)', type: 'text', required: true },
      { id: 'bypass_feeder', name: 'Bypass Feeder rating(A)', type: 'text', required: true },
      { id: 'ups_output_feeder', name: 'UPS Output Feeder Rating(A)', type: 'text', required: true },
      { id: 'downstream_db_feeders', name: 'Downstream DB Feeder Ratings', type: 'textarea', required: false },
      { id: 'feeder_coordination', name: 'Feeder Cordination OK', type: 'select',
        options: ['Yes', 'No', 'To be verified'], required: true }
    ]
  },
  {
    id: 'section_6',
    number: '6',
    title: 'LOAD RATIONALIZATION',
    description: 'Load analysis and segregation',
    color: 'indigo',
    icon: 'AdjustmentsHorizontalIcon',
    fields: [
      { id: 'load_item', name: 'Item', type: 'text', required: false },
      { id: 'single_fed_load', name: 'Single-fed Load Identified', type: 'textarea', required: false },
      { id: 'non_critical_loads', name: 'Non Crticial Loads on UPS', type: 'textarea', required: false },
      { id: 'db_segregation', name: 'DB A/B Segregation Adequate', type: 'select',
        options: ['Yes', 'No', 'N/A'], required: false }
    ]
  },
  {
    id: 'section_7',
    number: '7',
    title: 'LV Switchgear TIE-IN',
    description: 'LV switchgear connection details',
    color: 'cyan',
    icon: 'Square3Stack3DIcon',
    fields: [
      { id: 'source_lv_panel', name: 'Source LV Panel ID', type: 'text', required: true },
      { id: 'switchgear_make', name: 'Switchgear Make', type: 'text', required: true }
    ]
  },
  {
    id: 'section_7_1',
    number: '7.1',
    title: 'GENERAL INFORMATION',
    description: 'Additional switchgear information',
    color: 'cyan',
    icon: 'InformationCircleIcon',
    parentSection: 'section_7',
    fields: [
      { id: 'feeder_rating', name: 'Feeder Rating', type: 'text', required: true },
      { id: 'feeder_tag', name: 'Feeder Tag', type: 'text', required: true },
      { id: 'bus_type', name: 'Bus-A/B/Emergency', type: 'select',
        options: ['Bus-A', 'Bus-B', 'Emergency', 'Other'], required: true },
      { id: 'spare_breaker', name: 'Spare Breaker Available & Rating', type: 'text', required: false },
      { id: 'vacant_space_rating', name: 'Vacant Space Avaialble & Rating', type: 'text', required: false },
      { id: 'vacant_space_height', name: 'Vacant Space Avaialble & Height', type: 'text', required: false },
      { id: 'shutdown_required', name: 'Shoutdown Required for Tie-In', type: 'select',
        options: ['Yes', 'No', 'TBD'], required: true }
    ]
  },
  {
    id: 'section_8',
    number: '8',
    title: 'STATIC/CONVERTER SWITCH',
    description: 'Static or converter switch information',
    color: 'pink',
    icon: 'ArrowsRightLeftIcon',
    fields: [
      { id: 'static_switch_present', name: 'Static/Converter Switch Present', type: 'select',
        options: ['Yes', 'No'], required: true },
      { id: 'static_switch_rating', name: 'Rating', type: 'text', required: false },
      { id: 'critical_load_supplied', name: 'Critical Load Supplied', type: 'textarea', required: false },
      { id: 'space_available', name: 'Space Available', type: 'select',
        options: ['Yes', 'No', 'N/A'], required: false }
    ]
  },
  {
    id: 'section_9',
    number: '9',
    title: 'BMS System',
    description: 'Battery Management System details',
    color: 'teal',
    icon: 'CpuChipIcon',
    fields: [
      { id: 'bms_make', name: 'Existing BMS Make', type: 'text', required: true },
      { id: 'monitoring_level', name: 'Monitoring Level (Cell/String)', type: 'select',
        options: ['Cell Level', 'String Level', 'Both', 'None'], required: true },
      { id: 'bms_interface', name: 'Interface with DCS /ECMS', type: 'select',
        options: ['Yes', 'No', 'Partial'], required: true }
    ]
  },
  {
    id: 'section_10',
    number: '10',
    title: 'SHUTDOWN & TEMPORARY UPS',
    description: 'Shutdown requirements and temporary arrangements',
    color: 'orange',
    icon: 'ExclamationTriangleIcon',
    fields: [
      { id: 'shutdown_window', name: 'Shutdown Window Available', type: 'text', required: false },
      { id: 'temporary_ups', name: 'Temporary UPS Avaialbe', type: 'select',
        options: ['Yes', 'No', 'TBD'], required: false }
    ]
  },
  {
    id: 'section_11',
    number: '11',
    title: 'DATA GAPS & FEED ASSUMPTIONS',
    description: 'Missing data and assumptions',
    color: 'amber',
    icon: 'QuestionMarkCircleIcon',
    fields: [
      { id: 'missing_load_history', name: 'Missing Load History', type: 'textarea', required: false },
      { id: 'missing_feeder_data', name: 'Missing Feeder Data', type: 'textarea', required: false },
      { id: 'feed_assumptions', name: 'Feed Assumptions Required', type: 'textarea', required: false }
    ]
  },
  {
    id: 'section_12',
    number: '12',
    title: 'SPACE Availability',
    description: 'Space availability for equipment',
    color: 'lime',
    icon: 'Square2StackIcon',
    fields: [
      { id: 'space_existing_ups', name: 'At Existing UPS', type: 'textarea', required: false },
      { id: 'space_temporary_ups', name: 'For Temporary UPS', type: 'textarea', required: false }
    ]
  },
  {
    id: 'section_13',
    number: '13',
    title: 'Cable Size',
    description: 'Cable sizing information',
    color: 'emerald',
    icon: 'WrenchScrewdriverIcon',
    fields: [
      { id: 'incomer_1', name: 'Incomer - 1', type: 'text', required: false },
      { id: 'incomer_2', name: 'Incomer - 2', type: 'text', required: false }
    ]
  },
  {
    id: 'section_14',
    number: '14',
    title: 'Existing Signal Interface with DCS/ECMS/ENMS etc',
    description: 'Signal interface details',
    color: 'violet',
    icon: 'SignalIcon',
    fields: [
      { id: 'signal_interface', name: 'Interface Details', type: 'textarea', required: false }
    ]
  },
  {
    id: 'section_15',
    number: '15',
    title: 'Documents Required',
    description: 'Required documentation and checklist items',
    color: 'rose',
    icon: 'DocumentTextIcon',
    fields: [
      { id: 'load_list_format', name: 'Load List Format to be followed', type: 'select',
        options: ['Yes', 'No', 'N/A'], required: false },
      { id: 'load_criticality_check', name: 'Load Criticality to be checked', type: 'select',
        options: ['Yes', 'No', 'Completed'], required: false },
      { id: 'shutdown_allowed', name: 'Shutdown is allowed', type: 'select',
        options: ['Yes', 'No', 'With conditions'], required: false },
      { id: 'rationalization_required', name: 'Load Rationalization is Required', type: 'select',
        options: ['Yes', 'No', 'TBD'], required: false },
      { id: 'cable_change', name: 'Cable change due to Load Rationalization', type: 'select',
        options: ['Yes', 'No', 'N/A'], required: false },
      { id: 'og_feeder_pa', name: 'O/G Feeder specifically for PA based on inrush current as per the company feedback it trips(Consider input transformer)', 
        type: 'textarea', required: false },
      { id: 'unit_number', name: 'Unit Number required against each loads', type: 'select',
        options: ['Yes', 'No', 'N/A'], required: false }
    ]
  }
];

// Field Input Types Configuration
export const FIELD_INPUT_CONFIG = {
  text: {
    component: 'input',
    props: { type: 'text', className: 'w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent' }
  },
  number: {
    component: 'input',
    props: { type: 'number', className: 'w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent' }
  },
  date: {
    component: 'input',
    props: { type: 'date', className: 'w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent' }
  },
  textarea: {
    component: 'textarea',
    props: { rows: 2, className: 'w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-y' }
  },
  select: {
    component: 'select',
    props: { className: 'w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent' }
  }
};

// Color Palette for Sections
export const SECTION_COLORS = {
  blue: {
    bg: 'bg-blue-50',
    border: 'border-blue-200',
    text: 'text-blue-900',
    icon: 'text-blue-600',
    badge: 'bg-blue-100 text-blue-800'
  },
  green: {
    bg: 'bg-green-50',
    border: 'border-green-200',
    text: 'text-green-900',
    icon: 'text-green-600',
    badge: 'bg-green-100 text-green-800'
  },
  yellow: {
    bg: 'bg-yellow-50',
    border: 'border-yellow-200',
    text: 'text-yellow-900',
    icon: 'text-yellow-600',
    badge: 'bg-yellow-100 text-yellow-800'
  },
  purple: {
    bg: 'bg-purple-50',
    border: 'border-purple-200',
    text: 'text-purple-900',
    icon: 'text-purple-600',
    badge: 'bg-purple-100 text-purple-800'
  },
  red: {
    bg: 'bg-red-50',
    border: 'border-red-200',
    text: 'text-red-900',
    icon: 'text-red-600',
    badge: 'bg-red-100 text-red-800'
  },
  indigo: {
    bg: 'bg-indigo-50',
    border: 'border-indigo-200',
    text: 'text-indigo-900',
    icon: 'text-indigo-600',
    badge: 'bg-indigo-100 text-indigo-800'
  },
  cyan: {
    bg: 'bg-cyan-50',
    border: 'border-cyan-200',
    text: 'text-cyan-900',
    icon: 'text-cyan-600',
    badge: 'bg-cyan-100 text-cyan-800'
  },
  pink: {
    bg: 'bg-pink-50',
    border: 'border-pink-200',
    text: 'text-pink-900',
    icon: 'text-pink-600',
    badge: 'bg-pink-100 text-pink-800'
  },
  teal: {
    bg: 'bg-teal-50',
    border: 'border-teal-200',
    text: 'text-teal-900',
    icon: 'text-teal-600',
    badge: 'bg-teal-100 text-teal-800'
  },
  orange: {
    bg: 'bg-orange-50',
    border: 'border-orange-200',
    text: 'text-orange-900',
    icon: 'text-orange-600',
    badge: 'bg-orange-100 text-orange-800'
  },
  amber: {
    bg: 'bg-amber-50',
    border: 'border-amber-200',
    text: 'text-amber-900',
    icon: 'text-amber-600',
    badge: 'bg-amber-100 text-amber-800'
  },
  lime: {
    bg: 'bg-lime-50',
    border: 'border-lime-200',
    text: 'text-lime-900',
    icon: 'text-lime-600',
    badge: 'bg-lime-100 text-lime-800'
  },
  emerald: {
    bg: 'bg-emerald-50',
    border: 'border-emerald-200',
    text: 'text-emerald-900',
    icon: 'text-emerald-600',
    badge: 'bg-emerald-100 text-emerald-800'
  },
  violet: {
    bg: 'bg-violet-50',
    border: 'border-violet-200',
    text: 'text-violet-900',
    icon: 'text-violet-600',
    badge: 'bg-violet-100 text-violet-800'
  },
  rose: {
    bg: 'bg-rose-50',
    border: 'border-rose-200',
    text: 'text-rose-900',
    icon: 'text-rose-600',
    badge: 'bg-rose-100 text-rose-800'
  }
};

// Export Template Metadata
export const TEMPLATE_METADATA = {
  name: 'UPS & Battery Inspection Checklist',
  version: '1.0',
  source: 'Check_List_Template.xlsx',
  totalSections: TEMPLATE_SECTIONS.length,
  totalFields: TEMPLATE_SECTIONS.reduce((sum, section) => sum + section.fields.length, 0),
  columns: TEMPLATE_COLUMNS.length,
  description: 'Comprehensive UPS and Battery system inspection checklist for oil & gas facilities',
  lastUpdated: '2026-07-17'
};

// Helper function to get all fields flattened
export const getAllFields = () => {
  return TEMPLATE_SECTIONS.flatMap(section => 
    section.fields.map(field => ({
      ...field,
      sectionId: section.id,
      sectionTitle: section.title,
      sectionNumber: section.number
    }))
  );
};

// Helper function to get section by ID
export const getSectionById = (sectionId) => {
  return TEMPLATE_SECTIONS.find(section => section.id === sectionId);
};

// Helper function to get fields by section ID
export const getFieldsBySectionId = (sectionId) => {
  const section = getSectionById(sectionId);
  return section ? section.fields : [];
};

// Helper function to validate required fields
export const validateSection = (sectionId, data) => {
  const fields = getFieldsBySectionId(sectionId);
  const errors = [];
  
  fields.forEach(field => {
    if (field.required && !data[field.id]) {
      errors.push({
        fieldId: field.id,
        fieldName: field.name,
        message: `${field.name} is required`
      });
    }
  });
  
  return {
    isValid: errors.length === 0,
    errors
  };
};

// Helper function to get empty template data structure
export const getEmptyTemplateData = () => {
  const data = {};
  TEMPLATE_SECTIONS.forEach(section => {
    section.fields.forEach(field => {
      data[field.id] = {
        field_name: field.name,
        site_value: '',
        remarks: '',
        need_list: '',
        query: '',
        company_reply: ''
      };
    });
  });
  return data;
};
