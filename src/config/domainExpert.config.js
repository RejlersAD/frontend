/**
 * Domain Expert Configuration
 * Expert recommendations for P&ID design at each stage
 * Soft-coded for easy updates and expert input integration
 */

export const DOMAIN_EXPERT_CONFIG = {
  // Expert Profile
  expert: {
    name: 'Process Engineering Expert',
    credentials: 'PE, CEng, 20+ years experience',
    specialization: 'P&ID Design, Process Safety, Equipment Selection',
    avatar: '👨‍🔬'
  },

  // Design Stages with Expert Recommendations
  designStages: [
    {
      id: 'stage1_layout',
      name: 'Stage 1: Layout & Flow Direction',
      icon: '📐',
      description: 'Define overall layout and process flow direction',
      expertRecommendations: [
        {
          id: 'flow_direction',
          title: 'Flow Direction Convention',
          priority: 'critical',
          recommendation: 'Process flow should be from left to right or top to bottom. This is an industry standard (ISO 10628) that improves readability and reduces errors.',
          rationale: 'Consistent flow direction allows engineers to quickly understand the process without confusion.',
          examples: [
            'Main process lines: Left to right',
            'Vertical vessels: Top to bottom',
            'Return streams: Right to left (clearly marked)'
          ],
          standards: ['ISO 10628', 'ASME Y14.100']
        },
        {
          id: 'equipment_spacing',
          title: 'Equipment Spacing',
          priority: 'high',
          recommendation: 'Maintain minimum 50mm spacing between equipment symbols to allow for clear pipe routing and instrument placement.',
          rationale: 'Adequate spacing prevents visual clutter and allows space for tags, instrumentation, and connecting lines.',
          examples: [
            'Pumps: 50-75mm apart',
            'Vessels: 100-150mm apart',
            'Heat exchangers: 75-100mm apart'
          ],
          standards: ['Company drafting standards']
        },
        {
          id: 'elevation_indication',
          title: 'Elevation Considerations',
          priority: 'medium',
          recommendation: 'Even in 2D P&IDs, indicate elevation differences using line breaks or annotations where critical for gravity flow or NPSH requirements.',
          rationale: 'Elevation is critical for pump sizing and gravity-driven processes.',
          examples: [
            'Overhead condensers: Higher position',
            'Reboilers: Lower position',
            'Gravity drains: Downward indication'
          ],
          standards: ['ASME B31.3']
        }
      ]
    },
    {
      id: 'stage2_equipment',
      name: 'Stage 2: Equipment Placement',
      icon: '⚙️',
      description: 'Position major equipment items',
      expertRecommendations: [
        {
          id: 'equipment_grouping',
          title: 'Logical Equipment Grouping',
          priority: 'critical',
          recommendation: 'Group equipment by process unit or function. Place equipment in sequence of operation.',
          rationale: 'Logical grouping makes the P&ID easier to understand and follow during operations.',
          examples: [
            'Reaction section: Reactors, separators, recycle systems',
            'Separation section: Distillation columns, drums, condensers',
            'Utilities: Pumps, coolers, heaters grouped together'
          ],
          standards: ['ISA-5.1', 'ISO 10628']
        },
        {
          id: 'major_equipment_first',
          title: 'Major Equipment First',
          priority: 'high',
          recommendation: 'Place major equipment (columns, reactors, vessels) first, then add rotating equipment (pumps, compressors), then heat exchangers.',
          rationale: 'This hierarchy ensures the process backbone is established before adding supporting equipment.',
          examples: [
            '1. Towers and vessels',
            '2. Reactors and separators',
            '3. Pumps and compressors',
            '4. Heat exchangers',
            '5. Instrumentation'
          ],
          standards: ['Industry best practice']
        },
        {
          id: 'symbol_standards',
          title: 'Use Standard Symbols',
          priority: 'critical',
          recommendation: 'Always use ISO 10628 or company-specific standard symbols. Never create custom symbols.',
          rationale: 'Standard symbols ensure universal understanding across engineering teams and contractors.',
          examples: [
            'Centrifugal pump: Circle with internal arrow',
            'Control valve: Triangle with line',
            'Tank: Rectangle',
            'Heat exchanger: Rectangle with crossed lines'
          ],
          standards: ['ISO 10628', 'ISA-5.1', 'ASME Y14.100']
        }
      ]
    },
    {
      id: 'stage3_piping',
      name: 'Stage 3: Piping & Connections',
      icon: '🔗',
      description: 'Connect equipment with process lines',
      expertRecommendations: [
        {
          id: 'line_routing',
          title: 'Clean Line Routing',
          priority: 'high',
          recommendation: 'Route piping lines with minimal crossings. Use horizontal and vertical segments only (no diagonal lines in 2D P&IDs).',
          rationale: 'Orthogonal routing (90° angles) is standard practice and improves clarity.',
          examples: [
            'Horizontal-vertical routing only',
            'Avoid crossing lines when possible',
            'Use line breaks at crossings',
            'Label crossing lines clearly'
          ],
          standards: ['ISO 10628', 'Company standards']
        },
        {
          id: 'line_sizing',
          title: 'Line Size Indication',
          priority: 'critical',
          recommendation: 'Show line sizes on all major process lines. Format: "3\"-CS-150#" (Size-Material-Rating).',
          rationale: 'Line sizing is critical for construction, procurement, and plant operations.',
          examples: [
            'Main process: 6"-CS-300#',
            'Utility lines: 2"-CS-150#',
            'Small instrument lines: 1/2"-SS-300#'
          ],
          standards: ['ASME B31.3', 'API RP 14E']
        },
        {
          id: 'line_numbering',
          title: 'Line Number System',
          priority: 'critical',
          recommendation: 'Use systematic line numbering: [Unit]-[Fluid]-[Size]-[Sequence]',
          rationale: 'Consistent line numbering is essential for iso generation, construction, and maintenance.',
          examples: [
            '100-P-6-001: Unit 100, Process liquid, 6 inch, sequence 001',
            '200-S-4-015: Unit 200, Steam, 4 inch, sequence 015',
            '300-W-2-042: Unit 300, Water, 2 inch, sequence 042'
          ],
          standards: ['Company standards', 'Industry practice']
        }
      ]
    },
    {
      id: 'stage4_instrumentation',
      name: 'Stage 4: Instrumentation & Control',
      icon: '🎛️',
      description: 'Add instruments, controls, and safety devices',
      expertRecommendations: [
        {
          id: 'instrument_tagging',
          title: 'ISA Instrument Tagging',
          priority: 'critical',
          recommendation: 'Follow ISA-5.1 standard for instrument tags. Format: [Function][Loop Number]',
          rationale: 'ISA tagging is the global standard and ensures universal understanding.',
          examples: [
            'FT-101: Flow Transmitter, Loop 101',
            'LIC-205: Level Indicator Controller, Loop 205',
            'PSV-301: Pressure Safety Valve, Loop 301',
            'TI-405: Temperature Indicator, Loop 405'
          ],
          standards: ['ISA-5.1', 'ISA-5.3']
        },
        {
          id: 'control_valve_placement',
          title: 'Control Valve Placement',
          priority: 'high',
          recommendation: 'Place control valves downstream of measurement points. Show valve fail position (FC/FO).',
          rationale: 'Proper valve placement ensures accurate control and safe failure modes.',
          examples: [
            'Flow control: FCV after FT',
            'Level control: LCV on outlet',
            'Pressure control: PCV with PSV backup',
            'Show fail-closed (FC) or fail-open (FO)'
          ],
          standards: ['ISA-5.1', 'IEC 61511']
        },
        {
          id: 'safety_instrumentation',
          title: 'Safety Instrumented Systems',
          priority: 'critical',
          recommendation: 'Clearly mark safety instruments and interlocks. Use different line styles or colors for SIS.',
          rationale: 'Safety systems must be immediately identifiable for operations and maintenance.',
          examples: [
            'PSV: Pressure Safety Valve (required)',
            'PAHH: High-high pressure alarm with shutdown',
            'LALL: Low-low level alarm with shutdown',
            'ESV: Emergency Shutdown Valve'
          ],
          standards: ['IEC 61511', 'ISA-84']
        }
      ]
    },
    {
      id: 'stage5_annotations',
      name: 'Stage 5: Annotations & Documentation',
      icon: '📝',
      description: 'Add notes, specifications, and documentation',
      expertRecommendations: [
        {
          id: 'equipment_data',
          title: 'Equipment Data Tables',
          priority: 'high',
          recommendation: 'Include equipment data tables or reference equipment data sheets.',
          rationale: 'Quick reference to equipment specifications is essential for operations.',
          examples: [
            'Pump data: Flow, head, power, MOC',
            'Vessel data: Volume, pressure, temperature',
            'Heat exchanger: Area, duty, LMTD'
          ],
          standards: ['Company standards']
        },
        {
          id: 'process_notes',
          title: 'Process Notes',
          priority: 'medium',
          recommendation: 'Add critical process notes for non-standard operations or design basis.',
          rationale: 'Notes capture design intent and special operating considerations.',
          examples: [
            'Normal operating conditions',
            'Start-up sequence requirements',
            'Special material considerations',
            'Design basis (flow rates, compositions)'
          ],
          standards: ['Company standards']
        },
        {
          id: 'drawing_title_block',
          title: 'Complete Title Block',
          priority: 'critical',
          recommendation: 'Always complete title block: Drawing number, title, revision, date, approvals.',
          rationale: 'Title block is a legal document requirement for design and construction.',
          examples: [
            'Drawing No: P&ID-100-001',
            'Title: Reactor Feed System',
            'Revision: B',
            'Date: 2026-01-05',
            'Designed by / Checked by / Approved by'
          ],
          standards: ['ISO 7200', 'ASME Y14.100']
        }
      ]
    }
  ],

  // General P&ID Design Guidelines
  generalGuidelines: [
    {
      id: 'drawing_scale',
      title: 'Drawing Scale',
      recommendation: 'P&IDs are schematic and not to scale. Focus on clarity and logical flow, not physical dimensions.',
      priority: 'info'
    },
    {
      id: '2d_representation',
      title: '2D Representation',
      recommendation: 'P&IDs are strictly 2D drawings. Use annotations for elevation differences, not 3D visualization.',
      priority: 'info'
    },
    {
      id: 'simplicity',
      title: 'Keep It Simple',
      recommendation: 'Avoid cluttering the drawing. Split complex systems into multiple sheets if necessary.',
      priority: 'high'
    },
    {
      id: 'consistency',
      title: 'Consistency is Key',
      recommendation: 'Use consistent symbols, line styles, and conventions throughout all project P&IDs.',
      priority: 'critical'
    }
  ],

  // Common Mistakes to Avoid
  commonMistakes: [
    {
      id: 'wrong_flow_direction',
      mistake: 'Inconsistent flow direction',
      consequence: 'Confusion during operations, installation errors',
      fix: 'Always maintain left-to-right or top-to-bottom flow'
    },
    {
      id: 'missing_line_numbers',
      mistake: 'Missing or inconsistent line numbers',
      consequence: 'Cannot generate piping isometrics, procurement issues',
      fix: 'Number all process and utility lines systematically'
    },
    {
      id: 'incorrect_instruments',
      mistake: 'Non-standard instrument tags',
      consequence: 'Confusion with instrument types and control philosophy',
      fix: 'Strictly follow ISA-5.1 tagging standard'
    },
    {
      id: 'missing_safety_valves',
      mistake: 'Forgetting PSVs on vessels',
      consequence: 'Major safety violation, code non-compliance',
      fix: 'Every pressure vessel must have overpressure protection'
    },
    {
      id: 'cluttered_drawing',
      mistake: 'Too much information on one sheet',
      consequence: 'Unreadable drawing, increased errors',
      fix: 'Split into multiple logical sheets'
    }
  ],

  // Checklist for Quality P&ID
  qualityChecklist: [
    { id: 'flow_direction', item: 'Consistent flow direction (left-to-right or top-to-bottom)', checked: false },
    { id: 'equipment_tags', item: 'All equipment properly tagged', checked: false },
    { id: 'line_numbers', item: 'All lines numbered with size and material', checked: false },
    { id: 'instruments', item: 'All instruments follow ISA-5.1 standard', checked: false },
    { id: 'safety_valves', item: 'All vessels have PSVs or other overpressure protection', checked: false },
    { id: 'control_valves', item: 'Control valves show fail position', checked: false },
    { id: 'tie_ins', item: 'All tie-ins to other drawings are shown', checked: false },
    { id: 'utilities', item: 'All utility connections shown', checked: false },
    { id: 'notes', item: 'Critical process notes included', checked: false },
    { id: 'title_block', item: 'Title block complete with approvals', checked: false }
  ],

  // Industry Standards Reference
  standards: [
    { code: 'ISO 10628', title: 'Diagrams for chemical and petrochemical industry', type: 'International' },
    { code: 'ISA-5.1', title: 'Instrumentation Symbols and Identification', type: 'Instrumentation' },
    { code: 'ASME Y14.100', title: 'Engineering Drawing Practices', type: 'Drawing' },
    { code: 'IEC 61511', title: 'Functional safety - Safety instrumented systems', type: 'Safety' },
    { code: 'ASME B31.3', title: 'Process Piping', type: 'Piping' },
    { code: 'API RP 14E', title: 'Design and Installation of Offshore Platforms', type: 'Offshore' }
  ]
}

export const getStageRecommendations = (stageId) => {
  const stage = DOMAIN_EXPERT_CONFIG.designStages.find(s => s.id === stageId)
  return stage ? stage.expertRecommendations : []
}

export const getAllRecommendations = () => {
  return DOMAIN_EXPERT_CONFIG.designStages.flatMap(stage => 
    stage.expertRecommendations.map(rec => ({ ...rec, stage: stage.name }))
  )
}

export const getCriticalRecommendations = () => {
  return getAllRecommendations().filter(rec => rec.priority === 'critical')
}

export const getRecommendationsByPriority = (priority) => {
  return getAllRecommendations().filter(rec => rec.priority === priority)
}
