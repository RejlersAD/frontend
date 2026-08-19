/**
 * InstrumentationEngine.js
 * Advanced AI-driven instrumentation placement and control loop management
 * Implements ISA-5.1 standards for P&ID instrumentation
 * 
 * Features:
 * - Auto instrument detection and categorization
 * - Smart instrument placement (field, panel, DCS)
 * - Control loop visualization and identification
 * - Signal line routing with different styles
 * - ISA-5.1 compliant symbols and nomenclature
 * - Soft-coded configuration
 */

export class InstrumentationEngine {
  constructor(canvasWidth, canvasHeight, options = {}) {
    this.width = canvasWidth
    this.height = canvasHeight
    this.gridSize = options.gridSize || 25
    this.instrumentSize = options.instrumentSize || 40
    this.panelHeight = options.panelHeight || 100
    this.margins = options.margins || { top: 50, right: 50, bottom: 50, left: 50 }
    
    // ISA-5.1 Instrument categories
    this.instrumentCategories = {
      // Measured variables (first letter)
      measured: {
        'A': 'Analysis',
        'B': 'Burner/Combustion',
        'C': 'Conductivity',
        'D': 'Density',
        'E': 'Voltage',
        'F': 'Flow',
        'G': 'Gauging',
        'H': 'Hand',
        'I': 'Current',
        'J': 'Power',
        'K': 'Time',
        'L': 'Level',
        'M': 'Moisture',
        'N': 'User defined',
        'O': 'User defined',
        'P': 'Pressure',
        'Q': 'Quantity',
        'R': 'Radiation',
        'S': 'Speed',
        'T': 'Temperature',
        'U': 'Multivariable',
        'V': 'Vibration',
        'W': 'Weight',
        'X': 'Unclassified',
        'Y': 'Event',
        'Z': 'Position'
      },
      // Function (subsequent letters)
      functions: {
        'A': 'Alarm',
        'C': 'Controller',
        'E': 'Element (Sensor)',
        'G': 'Glass/Gauge',
        'I': 'Indicator',
        'K': 'Control Station',
        'L': 'Light',
        'O': 'Orifice',
        'R': 'Recorder',
        'S': 'Switch',
        'T': 'Transmitter',
        'V': 'Valve',
        'W': 'Well',
        'X': 'Unclassified',
        'Y': 'Relay/Compute',
        'Z': 'Driver/Actuator'
      }
    }
    
    // Instrument mounting locations
    this.mountingLocations = {
      field: 'FIELD_MOUNTED',
      panel: 'PANEL_MOUNTED',
      dcs: 'DCS_MOUNTED',
      shared: 'SHARED_DISPLAY'
    }
    
    // Signal line styles
    this.signalLineStyles = {
      pneumatic: 'dashed',
      electric: 'solid',
      hydraulic: 'dashdot',
      capillary: 'dotted',
      wireless: 'dashdotdot',
      software: 'dotted'
    }
  }

  /**
   * Place instruments on P&ID based on equipment and control strategy
   */
  placeInstruments(equipmentPositions, instrumentData, options = {}) {
    const strategy = options.placementStrategy || 'auto'
    const showControlLoops = options.showControlLoops !== false
    const groupByLoop = options.groupByLoop !== false
    
    const placedInstruments = []
    const controlLoops = []
    
    // Parse and categorize instruments
    const categorizedInstruments = this.categorizeInstruments(instrumentData)
    
    // Identify control loops
    if (showControlLoops) {
      const loops = this.identifyControlLoops(categorizedInstruments)
      controlLoops.push(...loops)
    }
    
    // Place instruments based on strategy
    switch (strategy) {
      case 'auto':
        return this.placeInstrumentsAuto(equipmentPositions, categorizedInstruments, controlLoops)
      case 'by-equipment':
        return this.placeByEquipment(equipmentPositions, categorizedInstruments)
      case 'by-function':
        return this.placeByFunction(equipmentPositions, categorizedInstruments)
      case 'by-loop':
        return this.placeByControlLoop(equipmentPositions, categorizedInstruments, controlLoops)
      default:
        return this.placeInstrumentsAuto(equipmentPositions, categorizedInstruments, controlLoops)
    }
  }

  /**
   * Categorize instruments based on ISA-5.1 tag nomenclature
   */
  categorizeInstruments(instrumentData) {
    return instrumentData.map(instrument => {
      const tag = instrument.tag_number || instrument.tag || ''
      const analysis = this.analyzeInstrumentTag(tag)
      
      return {
        ...instrument,
        ...analysis,
        mountingLocation: this.determineMountingLocation(instrument, analysis),
        signalType: this.determineSignalType(instrument, analysis),
        connectionPoint: this.determineConnectionPoint(instrument, analysis)
      }
    })
  }

  /**
   * Analyze instrument tag based on ISA-5.1 standard
   */
  analyzeInstrumentTag(tag) {
    // Format: XXX-YYY where XXX is function letters, YYY is loop number
    const match = tag.match(/^([A-Z]+)-?(\d+)?([A-Z])?$/)
    
    if (!match) {
      return {
        measuredVariable: 'X',
        functions: ['I'],
        loopNumber: '000',
        suffix: '',
        isValid: false
      }
    }
    
    const [, letters, loopNum, suffix] = match
    const measuredVariable = letters[0] || 'X'
    const functions = letters.slice(1).split('') || ['I']
    
    return {
      measuredVariable,
      functions,
      loopNumber: loopNum || '000',
      suffix: suffix || '',
      isValid: true,
      description: this.getInstrumentDescription(measuredVariable, functions)
    }
  }

  /**
   * Get human-readable instrument description
   */
  getInstrumentDescription(measuredVariable, functions) {
    const variable = this.instrumentCategories.measured[measuredVariable] || 'Unknown'
    const functionDesc = functions.map(f => this.instrumentCategories.functions[f] || '').join(' ')
    return `${variable} ${functionDesc}`.trim()
  }

  /**
   * Determine mounting location based on instrument type
   */
  determineMountingLocation(instrument, analysis) {
    const { functions } = analysis
    
    // Transmitters and elements are usually field mounted
    if (functions.includes('T') || functions.includes('E')) {
      return this.mountingLocations.field
    }
    
    // Controllers and indicators are usually panel/DCS mounted
    if (functions.includes('C') || functions.includes('R')) {
      return this.mountingLocations.dcs
    }
    
    // Indicators can be local or panel
    if (functions.includes('I')) {
      return instrument.is_local ? this.mountingLocations.field : this.mountingLocations.panel
    }
    
    // Default to field mounted
    return this.mountingLocations.field
  }

  /**
   * Determine signal type
   */
  determineSignalType(instrument, analysis) {
    const type = (instrument.signal_type || '').toLowerCase()
    
    if (type.includes('pneumatic') || type.includes('air')) return 'pneumatic'
    if (type.includes('wireless') || type.includes('radio')) return 'wireless'
    if (type.includes('hart') || type.includes('fieldbus') || type.includes('profibus')) return 'electric'
    
    // Default to electric for modern instruments
    return 'electric'
  }

  /**
   * Determine which equipment this instrument connects to
   */
  determineConnectionPoint(instrument, analysis) {
    // Check if instrument has explicit equipment reference
    if (instrument.equipment_tag || instrument.associated_equipment) {
      return instrument.equipment_tag || instrument.associated_equipment
    }
    
    // Try to infer from tag number or description
    const desc = (instrument.description || '').toLowerCase()
    const tag = instrument.tag_number || ''
    
    // Look for equipment references in description
    const equipmentTypes = ['pump', 'vessel', 'tank', 'column', 'exchanger', 'reactor', 'drum']
    for (const eqType of equipmentTypes) {
      if (desc.includes(eqType)) {
        return eqType
      }
    }
    
    return null
  }

  /**
   * Identify control loops from instruments
   */
  identifyControlLoops(instruments) {
    const loops = new Map()
    
    instruments.forEach(instrument => {
      const loopId = instrument.loopNumber
      
      if (!loops.has(loopId)) {
        loops.set(loopId, {
          loopId,
          instruments: [],
          measuredVariable: instrument.measuredVariable,
          hasController: false,
          hasTransmitter: false,
          hasValve: false,
          hasIndicator: false
        })
      }
      
      const loop = loops.get(loopId)
      loop.instruments.push(instrument)
      
      // Track loop components
      if (instrument.functions.includes('C')) loop.hasController = true
      if (instrument.functions.includes('T')) loop.hasTransmitter = true
      if (instrument.functions.includes('V')) loop.hasValve = true
      if (instrument.functions.includes('I')) loop.hasIndicator = true
    })
    
    return Array.from(loops.values())
  }

  /**
   * Auto placement - intelligent positioning based on instrument type
   */
  placeInstrumentsAuto(equipmentPositions, instruments, controlLoops) {
    const positioned = []
    const panelInstruments = []
    const fieldInstruments = []
    const dcsInstruments = []
    
    // Separate by mounting location
    instruments.forEach(instrument => {
      switch (instrument.mountingLocation) {
        case this.mountingLocations.field:
          fieldInstruments.push(instrument)
          break
        case this.mountingLocations.panel:
          panelInstruments.push(instrument)
          break
        case this.mountingLocations.dcs:
          dcsInstruments.push(instrument)
          break
        default:
          fieldInstruments.push(instrument)
      }
    })
    
    // Place field instruments near their equipment
    fieldInstruments.forEach((instrument, index) => {
      const equipment = this.findEquipmentForInstrument(instrument, equipmentPositions)
      
      if (equipment) {
        // Place around equipment
        const angle = (index * Math.PI / 4) + Math.PI / 8
        const distance = 80
        
        positioned.push({
          ...instrument,
          x: equipment.x + Math.cos(angle) * distance,
          y: equipment.y + Math.sin(angle) * distance,
          connectedEquipment: equipment
        })
      } else {
        // Place in grid if no equipment found
        const col = index % 5
        const row = Math.floor(index / 5)
        positioned.push({
          ...instrument,
          x: this.margins.left + col * 100,
          y: this.height - this.margins.bottom - this.panelHeight - 100 - row * 80
        })
      }
    })
    
    // Place panel instruments in bottom panel area
    panelInstruments.forEach((instrument, index) => {
      positioned.push({
        ...instrument,
        x: this.margins.left + (index * 100) + 50,
        y: this.height - this.margins.bottom - 50,
        isPanel: true
      })
    })
    
    // Place DCS instruments in top area
    dcsInstruments.forEach((instrument, index) => {
      positioned.push({
        ...instrument,
        x: this.margins.left + (index * 100) + 50,
        y: this.margins.top + 30,
        isDCS: true
      })
    })
    
    return positioned
  }

  /**
   * Place instruments grouped by equipment
   */
  placeByEquipment(equipmentPositions, instruments) {
    const positioned = []
    
    equipmentPositions.forEach((equipment, eqIndex) => {
      const instrumentsForEquipment = instruments.filter(inst => 
        this.isInstrumentForEquipment(inst, equipment)
      )
      
      instrumentsForEquipment.forEach((instrument, instIndex) => {
        const angle = (instIndex * Math.PI / 3) + Math.PI / 6
        const distance = 70 + (instIndex * 10)
        
        positioned.push({
          ...instrument,
          x: equipment.x + Math.cos(angle) * distance,
          y: equipment.y + Math.sin(angle) * distance,
          connectedEquipment: equipment
        })
      })
    })
    
    return positioned
  }

  /**
   * Place instruments grouped by function
   */
  placeByFunction(equipmentPositions, instruments) {
    const positioned = []
    const functionGroups = new Map()
    
    // Group by primary function
    instruments.forEach(instrument => {
      const primaryFunction = instrument.functions[0] || 'I'
      if (!functionGroups.has(primaryFunction)) {
        functionGroups.set(primaryFunction, [])
      }
      functionGroups.get(primaryFunction).push(instrument)
    })
    
    let groupIndex = 0
    functionGroups.forEach((group, functionType) => {
      const baseY = this.margins.top + 100 + (groupIndex * 150)
      
      group.forEach((instrument, index) => {
        positioned.push({
          ...instrument,
          x: this.margins.left + (index * 100) + 50,
          y: baseY,
          functionGroup: functionType
        })
      })
      
      groupIndex++
    })
    
    return positioned
  }

  /**
   * Place instruments grouped by control loop
   */
  placeByControlLoop(equipmentPositions, instruments, controlLoops) {
    const positioned = []
    
    controlLoops.forEach((loop, loopIndex) => {
      const baseX = this.margins.left + (loopIndex % 4) * 300
      const baseY = this.margins.top + 100 + Math.floor(loopIndex / 4) * 200
      
      loop.instruments.forEach((instrument, instIndex) => {
        positioned.push({
          ...instrument,
          x: baseX + (instIndex * 80),
          y: baseY,
          loopId: loop.loopId,
          loopSequence: instIndex
        })
      })
    })
    
    return positioned
  }

  /**
   * Route signal lines from instruments to equipment
   */
  routeSignalLines(instrumentPositions, equipmentPositions, options = {}) {
    const routes = []
    
    instrumentPositions.forEach(instrument => {
      // Find connected equipment
      const equipment = instrument.connectedEquipment || 
                       this.findEquipmentForInstrument(instrument, equipmentPositions)
      
      if (!equipment) return
      
      // Create signal line route
      const route = {
        id: `signal_${instrument.tag_number}`,
        from: { x: instrument.x, y: instrument.y },
        to: { x: equipment.x, y: equipment.y },
        signalType: instrument.signalType,
        lineStyle: this.signalLineStyles[instrument.signalType] || 'solid',
        instrument: instrument,
        equipment: equipment
      }
      
      // Add waypoint for cleaner routing
      if (Math.abs(equipment.x - instrument.x) > 100 && 
          Math.abs(equipment.y - instrument.y) > 100) {
        route.waypoints = [
          route.from,
          { x: instrument.x, y: equipment.y },
          route.to
        ]
      } else {
        route.waypoints = [route.from, route.to]
      }
      
      routes.push(route)
    })
    
    return routes
  }

  /**
   * Find equipment that this instrument should connect to
   */
  findEquipmentForInstrument(instrument, equipmentPositions) {
    // Try exact match on connection point
    if (instrument.connectionPoint) {
      const exact = equipmentPositions.find(eq => 
        (eq.tag_number || '').toLowerCase().includes(instrument.connectionPoint.toLowerCase())
      )
      if (exact) return exact
    }
    
    // Try to match by type
    const measuredVar = instrument.measuredVariable
    
    if (measuredVar === 'F') { // Flow - look for pumps or pipes
      return equipmentPositions.find(eq => 
        (eq.equipment_type || '').toLowerCase().includes('pump')
      )
    }
    
    if (measuredVar === 'L') { // Level - look for tanks/vessels
      return equipmentPositions.find(eq => 
        ['tank', 'vessel', 'drum'].some(type => 
          (eq.equipment_type || '').toLowerCase().includes(type)
        )
      )
    }
    
    if (measuredVar === 'P') { // Pressure - look for vessels
      return equipmentPositions.find(eq => 
        ['vessel', 'column', 'reactor'].some(type => 
          (eq.equipment_type || '').toLowerCase().includes(type)
        )
      )
    }
    
    if (measuredVar === 'T') { // Temperature - look for exchangers/reactors
      return equipmentPositions.find(eq => 
        ['exchanger', 'reactor', 'furnace'].some(type => 
          (eq.equipment_type || '').toLowerCase().includes(type)
        )
      )
    }
    
    // Default to closest equipment
    if (equipmentPositions.length > 0) {
      return equipmentPositions.reduce((closest, eq) => {
        const distCurrent = this.distance(instrument, eq)
        const distClosest = this.distance(instrument, closest)
        return distCurrent < distClosest ? eq : closest
      })
    }
    
    return null
  }

  /**
   * Check if instrument is for specific equipment
   */
  isInstrumentForEquipment(instrument, equipment) {
    const eqTag = (equipment.tag_number || '').toLowerCase()
    const instConnection = (instrument.connectionPoint || '').toLowerCase()
    const instDesc = (instrument.description || '').toLowerCase()
    
    return instConnection.includes(eqTag) || 
           instDesc.includes(eqTag) ||
           eqTag.includes(instConnection)
  }

  /**
   * Generate ISA-5.1 compliant instrument symbols
   */
  getInstrumentSymbol(instrument) {
    // Safely extract properties with defaults
    const mountingLocation = instrument?.mountingLocation || instrument?.mounting_location || 'field'
    const functions = instrument?.functions || instrument?.function || []
    const measuredVariable = instrument?.measuredVariable || instrument?.measured_variable || instrument?.variable || 'X'
    
    // Ensure functions is an array
    const functionsArray = Array.isArray(functions) ? functions : [functions].filter(Boolean)
    
    // Determine circle type based on mounting
    let circleType = 'field' // Solid circle
    if (mountingLocation === this.mountingLocations.panel || mountingLocation === 'panel') {
      circleType = 'panel' // Circle mounted on line
    } else if (mountingLocation === this.mountingLocations.dcs || mountingLocation === 'dcs' || mountingLocation === 'computer') {
      circleType = 'dcs' // Square or hexagon
    }
    
    // Determine if balloon should be shown
    const showBalloon = functionsArray.includes('C') || functionsArray.includes('I') || functionsArray.includes('R')
    
    return {
      circleType,
      showBalloon,
      letters: `${measuredVariable}${functionsArray.join('')}`,
      loopNumber: instrument?.loopNumber || instrument?.loop_number || '001'
    }
  }

  /**
   * Calculate distance between two points
   */
  distance(a, b) {
    const dx = (b.x || 0) - (a.x || 0)
    const dy = (b.y || 0) - (a.y || 0)
    return Math.sqrt(dx * dx + dy * dy)
  }

  /**
   * Auto-generate instruments based on equipment
   */
  autoGenerateInstruments(equipmentList) {
    const instruments = []
    let loopCounter = 100
    
    equipmentList.forEach((equipment, index) => {
      const eqType = (equipment.equipment_type || '').toLowerCase()
      
      // Pumps get flow and pressure instruments
      if (eqType.includes('pump')) {
        instruments.push({
          tag_number: `FT-${loopCounter}`,
          description: `${equipment.tag_number || 'PUMP'} Flow Transmitter`,
          equipment_tag: equipment.tag_number,
          signal_type: 'electric'
        })
        loopCounter++
        
        instruments.push({
          tag_number: `PT-${loopCounter}`,
          description: `${equipment.tag_number || 'PUMP'} Discharge Pressure`,
          equipment_tag: equipment.tag_number,
          signal_type: 'electric'
        })
        loopCounter++
      }
      
      // Vessels get level and pressure
      if (['tank', 'vessel', 'drum'].some(t => eqType.includes(t))) {
        instruments.push({
          tag_number: `LT-${loopCounter}`,
          description: `${equipment.tag_number || 'VESSEL'} Level Transmitter`,
          equipment_tag: equipment.tag_number,
          signal_type: 'electric'
        })
        loopCounter++
        
        instruments.push({
          tag_number: `PT-${loopCounter}`,
          description: `${equipment.tag_number || 'VESSEL'} Pressure`,
          equipment_tag: equipment.tag_number,
          signal_type: 'electric'
        })
        loopCounter++
      }
      
      // Heat exchangers get temperature
      if (eqType.includes('exchanger') || eqType.includes('heater') || eqType.includes('cooler')) {
        instruments.push({
          tag_number: `TT-${loopCounter}`,
          description: `${equipment.tag_number || 'EXCHANGER'} Outlet Temperature`,
          equipment_tag: equipment.tag_number,
          signal_type: 'electric'
        })
        loopCounter++
      }
    })
    
    return instruments
  }
}
