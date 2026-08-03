/**
 * DesignIQ Configuration - Soft-Coded Design Templates
 * Advanced AI-powered engineering design configuration
 * Supports multiple design types with dynamic parameters
 */

// Design Type Categories
export const DESIGN_TYPES = {
  process_flow: {
    id: 'process_flow',
    name: 'Process Flow Design',
    icon: '🔄',
    color: 'blue',
    description: 'Process flow diagrams, mass/energy balances, process optimization',
    tags: ['PFD', 'Process', 'Flow', 'Simulation'],
    
    // Dynamic parameters for this design type
    parameters: [
      {
        name: 'flow_rate',
        label: 'Design Flow Rate',
        type: 'number',
        unit: 'm³/h',
        required: true,
        min: 0,
        helpText: 'Normal operating flow rate',
        aiSuggestion: true
      },
      {
        name: 'operating_pressure',
        label: 'Operating Pressure',
        type: 'number',
        unit: 'barg',
        required: true,
        min: 0,
        helpText: 'Normal operating pressure',
        aiSuggestion: true
      },
      {
        name: 'operating_temperature',
        label: 'Operating Temperature',
        type: 'number',
        unit: '°C',
        required: true,
        helpText: 'Normal operating temperature',
        aiSuggestion: true
      },
      {
        name: 'fluid_type',
        label: 'Fluid Type',
        type: 'select',
        required: true,
        options: [
          { value: 'oil', label: 'Crude Oil' },
          { value: 'gas', label: 'Natural Gas' },
          { value: 'water', label: 'Water' },
          { value: 'condensate', label: 'Condensate' },
          { value: 'multiphase', label: 'Multi-phase' },
          { value: 'other', label: 'Other' }
        ],
        aiSuggestion: true
      },
      {
        name: 'process_units',
        label: 'Process Units',
        type: 'multiselect',
        options: [
          { value: 'separation', label: 'Separation' },
          { value: 'compression', label: 'Compression' },
          { value: 'heating', label: 'Heating' },
          { value: 'cooling', label: 'Cooling' },
          { value: 'pumping', label: 'Pumping' },
          { value: 'storage', label: 'Storage' }
        ],
        helpText: 'Select all applicable process units'
      },
      {
        name: 'design_standard',
        label: 'Design Standard',
        type: 'select',
        required: true,
        options: [
          { value: 'api', label: 'API Standards' },
          { value: 'asme', label: 'ASME Standards' },
          { value: 'iso', label: 'ISO Standards' },
          { value: 'ped', label: 'PED (EU)' },
          { value: 'custom', label: 'Custom/Other' }
        ]
      }
    ],
    
    // AI-powered suggestions
    aiTemplates: [
      {
        name: 'Three-Phase Separator',
        description: 'Oil, gas, and water separation unit',
        defaultParams: {
          flow_rate: 1000,
          operating_pressure: 10,
          operating_temperature: 60,
          fluid_type: 'multiphase'
        }
      },
      {
        name: 'Gas Compression Station',
        description: 'Multi-stage gas compression with cooling',
        defaultParams: {
          flow_rate: 5000,
          operating_pressure: 80,
          operating_temperature: 40,
          fluid_type: 'gas'
        }
      }
    ]
  },

  equipment: {
    id: 'equipment',
    name: 'Equipment Design',
    icon: '⚙️',
    color: 'green',
    description: 'Rotating equipment, static equipment, mechanical design',
    tags: ['Equipment', 'Mechanical', 'Specification'],
    
    parameters: [
      {
        name: 'equipment_type',
        label: 'Equipment Type',
        type: 'select',
        required: true,
        options: [
          { value: 'pump', label: 'Pump' },
          { value: 'compressor', label: 'Compressor' },
          { value: 'turbine', label: 'Turbine' },
          { value: 'motor', label: 'Motor' },
          { value: 'fan', label: 'Fan/Blower' },
          { value: 'agitator', label: 'Agitator/Mixer' }
        ],
        aiSuggestion: true
      },
      {
        name: 'capacity',
        label: 'Design Capacity',
        type: 'number',
        required: true,
        min: 0,
        helpText: 'Equipment rated capacity',
        aiSuggestion: true
      },
      {
        name: 'power_rating',
        label: 'Power Rating',
        type: 'number',
        unit: 'kW',
        required: true,
        min: 0,
        aiSuggestion: true
      },
      {
        name: 'material_construction',
        label: 'Material of Construction',
        type: 'select',
        required: true,
        options: [
          { value: 'carbon_steel', label: 'Carbon Steel' },
          { value: 'stainless_316', label: 'Stainless Steel 316' },
          { value: 'stainless_304', label: 'Stainless Steel 304' },
          { value: 'duplex', label: 'Duplex Stainless' },
          { value: 'inconel', label: 'Inconel' },
          { value: 'hastelloy', label: 'Hastelloy' }
        ],
        aiSuggestion: true
      },
      {
        name: 'api_standard',
        label: 'Applicable API Standard',
        type: 'select',
        options: [
          { value: 'api_610', label: 'API 610 (Centrifugal Pumps)' },
          { value: 'api_617', label: 'API 617 (Centrifugal Compressors)' },
          { value: 'api_618', label: 'API 618 (Reciprocating Compressors)' },
          { value: 'api_661', label: 'API 661 (Air-Cooled Heat Exchangers)' },
          { value: 'other', label: 'Other' }
        ]
      }
    ],
    
    aiTemplates: [
      {
        name: 'Centrifugal Pump (API 610)',
        description: 'Oil & gas process pump',
        defaultParams: {
          equipment_type: 'pump',
          capacity: 100,
          power_rating: 75,
          material_construction: 'carbon_steel'
        }
      }
    ]
  },

  piping: {
    id: 'piping',
    name: 'Piping & Instrumentation',
    icon: '🔧',
    color: 'purple',
    description: 'P&ID development, piping design, instrumentation',
    tags: ['P&ID', 'Piping', 'Instrumentation'],
    
    parameters: [
      {
        name: 'pipe_size',
        label: 'Nominal Pipe Size',
        type: 'select',
        required: true,
        options: [
          { value: '1', label: '1"' },
          { value: '2', label: '2"' },
          { value: '3', label: '3"' },
          { value: '4', label: '4"' },
          { value: '6', label: '6"' },
          { value: '8', label: '8"' },
          { value: '10', label: '10"' },
          { value: '12', label: '12"' },
          { value: '16', label: '16"' },
          { value: '20', label: '20"' },
          { value: '24', label: '24"' }
        ]
      },
      {
        name: 'piping_class',
        label: 'Piping Class',
        type: 'text',
        required: true,
        placeholder: 'e.g., 150#, 300#, 600#',
        helpText: 'ASME pressure class rating'
      },
      {
        name: 'piping_material',
        label: 'Piping Material',
        type: 'select',
        required: true,
        options: [
          { value: 'cs_a106', label: 'Carbon Steel A106 Grade B' },
          { value: 'cs_api5l', label: 'Carbon Steel API 5L X65' },
          { value: 'ss_304', label: 'Stainless Steel 304' },
          { value: 'ss_316', label: 'Stainless Steel 316' },
          { value: 'alloy_625', label: 'Alloy 625' }
        ],
        aiSuggestion: true
      },
      {
        name: 'design_code',
        label: 'Design Code',
        type: 'select',
        required: true,
        options: [
          { value: 'asme_b31.3', label: 'ASME B31.3 (Process Piping)' },
          { value: 'asme_b31.4', label: 'ASME B31.4 (Pipeline)' },
          { value: 'asme_b31.8', label: 'ASME B31.8 (Gas Pipeline)' },
          { value: 'iso_15156', label: 'ISO 15156 (Sour Service)' }
        ]
      },
      {
        name: 'corrosion_allowance',
        label: 'Corrosion Allowance',
        type: 'number',
        unit: 'mm',
        required: true,
        min: 0,
        max: 25,
        helpText: 'Typical: 3mm for carbon steel, 1.5mm for stainless'
      }
    ]
  },

  heat_exchanger: {
    id: 'heat_exchanger',
    name: 'Heat Exchanger Design',
    icon: '🔥',
    color: 'red',
    description: 'Thermal design, shell & tube, plate exchangers',
    tags: ['Heat Transfer', 'Thermal', 'TEMA'],
    
    parameters: [
      {
        name: 'exchanger_type',
        label: 'Exchanger Type',
        type: 'select',
        required: true,
        options: [
          { value: 'shell_tube', label: 'Shell & Tube' },
          { value: 'plate', label: 'Plate Heat Exchanger' },
          { value: 'air_cooled', label: 'Air-Cooled' },
          { value: 'double_pipe', label: 'Double Pipe' }
        ]
      },
      {
        name: 'heat_duty',
        label: 'Heat Duty',
        type: 'number',
        unit: 'kW',
        required: true,
        min: 0,
        helpText: 'Required heat transfer rate',
        aiSuggestion: true
      },
      {
        name: 'shell_side_fluid',
        label: 'Shell Side Fluid',
        type: 'text',
        required: true,
        placeholder: 'e.g., Hot Oil, Process Fluid',
        aiSuggestion: true
      },
      {
        name: 'tube_side_fluid',
        label: 'Tube Side Fluid',
        type: 'text',
        required: true,
        placeholder: 'e.g., Cooling Water, Cold Oil',
        aiSuggestion: true
      },
      {
        name: 'tema_type',
        label: 'TEMA Type',
        type: 'select',
        options: [
          { value: 'bem', label: 'BEM (Fixed Tubesheet)' },
          { value: 'aes', label: 'AES (Floating Head)' },
          { value: 'aeu', label: 'AEU (U-Tube)' },
          { value: 'cfu', label: 'CFU (Kettle Reboiler)' }
        ],
        helpText: 'TEMA designation for shell & tube'
      },
      {
        name: 'design_pressure_shell',
        label: 'Shell Side Design Pressure',
        type: 'number',
        unit: 'barg',
        required: true,
        min: 0
      },
      {
        name: 'design_pressure_tube',
        label: 'Tube Side Design Pressure',
        type: 'number',
        unit: 'barg',
        required: true,
        min: 0
      }
    ],
    
    aiTemplates: [
      {
        name: 'Process Cooler',
        description: 'Cooling water service',
        defaultParams: {
          exchanger_type: 'shell_tube',
          heat_duty: 1500,
          shell_side_fluid: 'Hot Process Oil',
          tube_side_fluid: 'Cooling Water',
          tema_type: 'bem'
        }
      }
    ]
  },

  vessel: {
    id: 'vessel',
    name: 'Pressure Vessel Design',
    icon: '🛢️',
    color: 'indigo',
    description: 'Storage tanks, pressure vessels, ASME Section VIII',
    tags: ['Vessel', 'Storage', 'ASME'],
    
    parameters: [
      {
        name: 'vessel_type',
        label: 'Vessel Type',
        type: 'select',
        required: true,
        options: [
          { value: 'vertical', label: 'Vertical Vessel' },
          { value: 'horizontal', label: 'Horizontal Vessel' },
          { value: 'spherical', label: 'Spherical Tank' },
          { value: 'bullet', label: 'Bullet Tank' }
        ]
      },
      {
        name: 'design_pressure',
        label: 'Design Pressure',
        type: 'number',
        unit: 'barg',
        required: true,
        min: 0,
        aiSuggestion: true
      },
      {
        name: 'design_temperature',
        label: 'Design Temperature',
        type: 'number',
        unit: '°C',
        required: true,
        aiSuggestion: true
      },
      {
        name: 'vessel_volume',
        label: 'Vessel Volume',
        type: 'number',
        unit: 'm³',
        required: true,
        min: 0,
        helpText: 'Internal volume'
      },
      {
        name: 'asme_code',
        label: 'ASME Code',
        type: 'select',
        required: true,
        options: [
          { value: 'viii_div1', label: 'ASME VIII Division 1' },
          { value: 'viii_div2', label: 'ASME VIII Division 2' },
          { value: 'i', label: 'ASME Section I (Boilers)' }
        ]
      },
      {
        name: 'corrosion_allowance',
        label: 'Corrosion Allowance',
        type: 'number',
        unit: 'mm',
        required: true,
        min: 0,
        max: 25
      }
    ]
  },

  pump: {
    id: 'pump',
    name: 'Pump Selection & Design',
    icon: '💧',
    color: 'cyan',
    description: 'Centrifugal, positive displacement, pump sizing',
    tags: ['Pump', 'API 610', 'Hydraulics'],
    
    parameters: [
      {
        name: 'pump_type',
        label: 'Pump Type',
        type: 'select',
        required: true,
        options: [
          { value: 'centrifugal', label: 'Centrifugal' },
          { value: 'positive_displacement', label: 'Positive Displacement' },
          { value: 'reciprocating', label: 'Reciprocating' },
          { value: 'screw', label: 'Screw Pump' }
        ]
      },
      {
        name: 'flow_rate',
        label: 'Flow Rate',
        type: 'number',
        unit: 'm³/h',
        required: true,
        min: 0,
        aiSuggestion: true
      },
      {
        name: 'differential_head',
        label: 'Differential Head',
        type: 'number',
        unit: 'm',
        required: true,
        min: 0,
        helpText: 'Total head requirement',
        aiSuggestion: true
      },
      {
        name: 'npsh_available',
        label: 'NPSH Available',
        type: 'number',
        unit: 'm',
        required: true,
        min: 0,
        helpText: 'Net Positive Suction Head'
      },
      {
        name: 'fluid_viscosity',
        label: 'Fluid Viscosity',
        type: 'number',
        unit: 'cP',
        required: true,
        min: 0
      },
      {
        name: 'api_610_type',
        label: 'API 610 Type',
        type: 'select',
        options: [
          { value: 'oh1', label: 'OH1 - Overhung, One Stage' },
          { value: 'oh2', label: 'OH2 - Overhung, Multi-Stage' },
          { value: 'bb1', label: 'BB1 - Between Bearings, One Stage' },
          { value: 'bb2', label: 'BB2 - Between Bearings, Two Stage' },
          { value: 'vs1', label: 'VS1 - Vertical Suspended, Single Casing' }
        ]
      }
    ]
  },

  valve: {
    id: 'valve',
    name: 'Valve Sizing & Selection',
    icon: '🎚️',
    color: 'teal',
    description: 'Control valves, isolation valves, valve sizing',
    tags: ['Valve', 'Control', 'ISA'],
    
    parameters: [
      {
        name: 'valve_type',
        label: 'Valve Type',
        type: 'select',
        required: true,
        options: [
          { value: 'control', label: 'Control Valve' },
          { value: 'gate', label: 'Gate Valve' },
          { value: 'globe', label: 'Globe Valve' },
          { value: 'ball', label: 'Ball Valve' },
          { value: 'butterfly', label: 'Butterfly Valve' },
          { value: 'check', label: 'Check Valve' }
        ]
      },
      {
        name: 'flow_rate',
        label: 'Flow Rate',
        type: 'number',
        unit: 'm³/h',
        required: true,
        min: 0
      },
      {
        name: 'inlet_pressure',
        label: 'Inlet Pressure',
        type: 'number',
        unit: 'barg',
        required: true,
        min: 0
      },
      {
        name: 'outlet_pressure',
        label: 'Outlet Pressure',
        type: 'number',
        unit: 'barg',
        required: true,
        min: 0
      },
      {
        name: 'cv_required',
        label: 'Flow Coefficient (Cv)',
        type: 'number',
        required: false,
        helpText: 'Will be calculated if not provided',
        aiSuggestion: true
      },
      {
        name: 'valve_size',
        label: 'Valve Size',
        type: 'select',
        options: [
          { value: '1', label: '1"' },
          { value: '2', label: '2"' },
          { value: '3', label: '3"' },
          { value: '4', label: '4"' },
          { value: '6', label: '6"' },
          { value: '8', label: '8"' }
        ]
      }
    ]
  },

  safety: {
    id: 'safety',
    name: 'Safety System Design',
    icon: '🛡️',
    color: 'yellow',
    description: 'Relief valves, safety instrumented systems, fire & gas',
    tags: ['Safety', 'Relief', 'SIS'],
    
    parameters: [
      {
        name: 'system_type',
        label: 'Safety System Type',
        type: 'select',
        required: true,
        options: [
          { value: 'psv', label: 'Pressure Safety Valve' },
          { value: 'sis', label: 'Safety Instrumented System' },
          { value: 'fire_gas', label: 'Fire & Gas Detection' },
          { value: 'esdv', label: 'Emergency Shutdown Valve' },
          { value: 'blowdown', label: 'Blowdown System' }
        ]
      },
      {
        name: 'sil_level',
        label: 'SIL Level',
        type: 'select',
        options: [
          { value: 'sil1', label: 'SIL 1' },
          { value: 'sil2', label: 'SIL 2' },
          { value: 'sil3', label: 'SIL 3' },
          { value: 'sil4', label: 'SIL 4' }
        ],
        helpText: 'Safety Integrity Level (if applicable)'
      },
      {
        name: 'set_pressure',
        label: 'Set Pressure',
        type: 'number',
        unit: 'barg',
        required: false,
        helpText: 'For PSV/relief valve'
      },
      {
        name: 'relief_capacity',
        label: 'Relief Capacity',
        type: 'number',
        unit: 'kg/h',
        required: false,
        helpText: 'Required relief rate'
      },
      {
        name: 'api_standard',
        label: 'Applicable Standard',
        type: 'select',
        options: [
          { value: 'api_520', label: 'API 520 (Relief Valve Sizing)' },
          { value: 'api_521', label: 'API 521 (Fire Relief)' },
          { value: 'iec_61508', label: 'IEC 61508 (Functional Safety)' },
          { value: 'iec_61511', label: 'IEC 61511 (SIS)' }
        ]
      }
    ]
  }
};

// AI Suggestion Engine Configuration
export const AI_SUGGESTIONS = {
  enabled: true,
  confidence_threshold: 0.7,
  
  // Knowledge base for RAG
  knowledgeBase: {
    materials: {
      'carbon_steel': {
        codes: ['ASTM A106', 'API 5L', 'ASME SA-106'],
        applications: ['General service', 'Non-corrosive fluids'],
        temperature_range: '-29°C to 400°C',
        corrosion_allowance: 3
      },
      'stainless_316': {
        codes: ['ASTM A312', 'ASME SA-312'],
        applications: ['Corrosive service', 'High temperature'],
        temperature_range: '-196°C to 870°C',
        corrosion_allowance: 1.5
      }
    },
    
    standards: {
      'process_piping': 'ASME B31.3',
      'oil_gas_pipeline': 'ASME B31.4',
      'gas_pipeline': 'ASME B31.8',
      'pressure_vessels': 'ASME Section VIII',
      'pumps': 'API 610',
      'compressors': 'API 617',
      'heat_exchangers': 'TEMA'
    },
    
    typical_values: {
      'oil_viscosity': { min: 1, max: 500, unit: 'cP' },
      'gas_pressure': { min: 10, max: 200, unit: 'barg' },
      'process_temperature': { min: -40, max: 400, unit: '°C' },
      'pump_efficiency': { min: 0.60, max: 0.85, unit: '%' }
    }
  }
};

// Validation Rules (Soft-Coded)
export const VALIDATION_RULES = {
  project_name: {
    required: true,
    minLength: 3,
    maxLength: 200,
    pattern: /^[a-zA-Z0-9\s\-_]+$/,
    message: 'Project name must be 3-200 characters (alphanumeric, spaces, dashes, underscores)'
  },
  
  description: {
    maxLength: 2000,
    message: 'Description must not exceed 2000 characters'
  },
  
  organization: {
    maxLength: 200
  },
  
  parameters: {
    number: {
      validate: (value, config) => {
        if (config.required && (value === null || value === undefined || value === '')) {
          return 'This field is required';
        }
        if (config.min !== undefined && parseFloat(value) < config.min) {
          return `Value must be at least ${config.min}`;
        }
        if (config.max !== undefined && parseFloat(value) > config.max) {
          return `Value must not exceed ${config.max}`;
        }
        return null;
      }
    },
    
    select: {
      validate: (value, config) => {
        if (config.required && !value) {
          return 'Please select an option';
        }
        return null;
      }
    }
  }
};

// File Upload Configuration
export const FILE_UPLOAD_CONFIG = {
  acceptedFormats: [
    '.pdf', '.dwg', '.dxf', '.png', '.jpg', '.jpeg', 
    '.xlsx', '.xls', '.csv', '.docx', '.doc'
  ],
  maxSize: 50 * 1024 * 1024, // 50MB
  supportedTypes: {
    drawings: ['.pdf', '.dwg', '.dxf', '.png', '.jpg', '.jpeg'],
    calculations: ['.xlsx', '.xls', '.pdf', '.csv'],
    documents: ['.pdf', '.docx', '.doc']
  }
};

// Export helper functions
export const getDesignTypeConfig = (designTypeId) => {
  return DESIGN_TYPES[designTypeId] || null;
};

export const getDesignTypeParameters = (designTypeId) => {
  const config = getDesignTypeConfig(designTypeId);
  return config ? config.parameters : [];
};

export const getAITemplates = (designTypeId) => {
  const config = getDesignTypeConfig(designTypeId);
  return config ? (config.aiTemplates || []) : [];
};

export const validateParameter = (paramName, value, paramConfig) => {
  const typeRules = VALIDATION_RULES.parameters[paramConfig.type];
  if (typeRules && typeRules.validate) {
    return typeRules.validate(value, paramConfig);
  }
  return null;
};

export default {
  DESIGN_TYPES,
  AI_SUGGESTIONS,
  VALIDATION_RULES,
  FILE_UPLOAD_CONFIG,
  getDesignTypeConfig,
  getDesignTypeParameters,
  getAITemplates,
  validateParameter
};
