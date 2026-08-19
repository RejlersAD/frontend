import React, { useState, useEffect, useRef } from 'react'
import { DOMAIN_EXPERT_CONFIG } from '../../config/domainExpert.config'
import { EquipmentPlacementEngine } from './EquipmentPlacementEngine'
import { PipingRouteEngine } from './PipingRouteEngine'
import { InstrumentationEngine } from './InstrumentationEngine'
import { AnnotationEngine } from './AnnotationEngine'
import { IntegrationEngine } from './IntegrationEngine'

/**
 * PID2DGenerator Component
 * Generates 2D P&ID diagrams with domain expert recommendations
 * Uses HTML5 Canvas for pure 2D rendering with Advanced AI Placement Engine
 * Configuration: src/config/domainExpert.config.js
 */

const PID2DGenerator = ({ pidData, pfdData }) => {
  const canvasRef = useRef(null)
  const placementEngineRef = useRef(null)
  const pipingEngineRef = useRef(null)
  const instrumentationEngineRef = useRef(null)
  const annotationEngineRef = useRef(null)
  const integrationEngineRef = useRef(null)
  const containerRef = useRef(null)
  
  const [currentStage, setCurrentStage] = useState('stage1_layout')
  const [showExpertPanel, setShowExpertPanel] = useState(true)
  const [zoom, setZoom] = useState(1)
  const [pan, setPan] = useState({ x: 0, y: 0 })
  const [isDragging, setIsDragging] = useState(false)
  const [isDraggingEquipment, setIsDraggingEquipment] = useState(false)
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 })
  const [checklist, setChecklist] = useState(DOMAIN_EXPERT_CONFIG.qualityChecklist)
  
  // Fullscreen and Canvas Controls
  const [isFullscreen, setIsFullscreen] = useState(false)
  const [showToolbar, setShowToolbar] = useState(true)
  const [showMiniMap, setShowMiniMap] = useState(false)
  const [canvasSize, setCanvasSize] = useState({ width: 1400, height: 1000 })
  
  // Third-Party Integration
  const [showIntegrationPanel, setShowIntegrationPanel] = useState(false)
  const [selectedIntegration, setSelectedIntegration] = useState(null)
  const [exportProgress, setExportProgress] = useState(null)
  
  // Stage-specific configuration
  const [flowDirection, setFlowDirection] = useState('left-to-right') // left-to-right, top-to-bottom, auto
  const [layoutStyle, setLayoutStyle] = useState('process-sequence') // process-sequence, equipment-type, elevation, grid
  const [showGrid, setShowGrid] = useState(true)
  const [showFlowArrows, setShowFlowArrows] = useState(true)
  const [respectElevation, setRespectElevation] = useState(true)
  const [autoOptimize, setAutoOptimize] = useState(true)
  const [equipmentPositions, setEquipmentPositions] = useState([])
  const [selectedEquipment, setSelectedEquipment] = useState(null)
  
  // Stage 3: Piping & Connections
  const [routingStrategy, setRoutingStrategy] = useState('manhattan') // manhattan, direct, orthogonal, smart
  const [pipeRoutes, setPipeRoutes] = useState([])
  const [showPipeLabels, setShowPipeLabels] = useState(true)
  const [avoidCrossings, setAvoidCrossings] = useState(true)
  const [autoGenerateConnections, setAutoGenerateConnections] = useState(false)
  const [selectedPipe, setSelectedPipe] = useState(null)
  const [connections, setConnections] = useState([])
  
  // Stage 4: Instrumentation & Control
  const [placementStrategy, setPlacementStrategy] = useState('auto') // auto, by-equipment, by-function, by-loop
  const [instrumentPositions, setInstrumentPositions] = useState([])
  const [signalRoutes, setSignalRoutes] = useState([])
  const [showInstrumentTags, setShowInstrumentTags] = useState(true)
  const [showControlLoops, setShowControlLoops] = useState(true)
  const [autoGenerateInstruments, setAutoGenerateInstruments] = useState(false)
  const [selectedInstrument, setSelectedInstrument] = useState(null)
  const [instruments, setInstruments] = useState([])
  
  // Stage 5: Annotation & Documentation
  const [annotations, setAnnotations] = useState([])
  const [showProcessData, setShowProcessData] = useState(true)
  const [showEquipmentNotes, setShowEquipmentNotes] = useState(true)
  const [showSafetyNotes, setShowSafetyNotes] = useState(true)
  const [showDesignBasis, setShowDesignBasis] = useState(false)
  const [autoGenerateAnnotations, setAutoGenerateAnnotations] = useState(false)
  const [selectedAnnotation, setSelectedAnnotation] = useState(null)
  const [showCallouts, setShowCallouts] = useState(false)

  // P&ID Canvas Settings (2D) - Dynamic based on fullscreen
  const canvasSettings = {
    width: canvasSize.width,
    height: canvasSize.height,
    backgroundColor: '#ffffff',
    gridSize: 50,
    showGrid: true,
    gridColor: '#e5e7eb',
    
    // Standard P&ID Styling (2D)
    lineWidth: 2,
    equipmentLineWidth: 3,
    processLineColor: '#1f2937',
    utilityLineColor: '#6b7280',
    instrumentLineColor: '#3b82f6',
    
    // Font settings
    fontSize: 12,
    fontFamily: 'Arial, sans-serif',
    tagFontSize: 10,
    
    // Equipment spacing (following expert recommendations)
    minEquipmentSpacing: 150,
    pipeSpacing: 30,
    instrumentOffset: 40
  }

  // Standard P&ID Symbols (2D)
  const drawEquipmentSymbol = (ctx, type, x, y, tag, size = 50) => {
    ctx.save()
    ctx.strokeStyle = canvasSettings.processLineColor
    ctx.lineWidth = canvasSettings.equipmentLineWidth
    ctx.fillStyle = '#ffffff'

    switch (type.toLowerCase()) {
      case 'pump':
      case 'centrifugal_pump':
        // Circle with internal arrow (standard pump symbol)
        ctx.beginPath()
        ctx.arc(x, y, size/2, 0, Math.PI * 2)
        ctx.fill()
        ctx.stroke()
        // Arrow inside
        ctx.beginPath()
        ctx.moveTo(x - size/4, y)
        ctx.lineTo(x + size/4, y)
        ctx.moveTo(x + size/8, y - size/8)
        ctx.lineTo(x + size/4, y)
        ctx.lineTo(x + size/8, y + size/8)
        ctx.stroke()
        break

      case 'tank':
      case 'vessel':
      case 'drum':
        // Rectangle (standard vessel symbol)
        const width = size * 0.8
        const height = size * 1.2
        ctx.beginPath()
        ctx.rect(x - width/2, y - height/2, width, height)
        ctx.fill()
        ctx.stroke()
        break

      case 'column':
      case 'tower':
        // Tall rectangle (standard column symbol)
        const colWidth = size * 0.6
        const colHeight = size * 2
        ctx.beginPath()
        ctx.rect(x - colWidth/2, y - colHeight/2, colWidth, colHeight)
        ctx.fill()
        ctx.stroke()
        // Add trays indication
        for (let i = 0; i < 5; i++) {
          const trayY = y - colHeight/2 + (i + 1) * colHeight/6
          ctx.beginPath()
          ctx.moveTo(x - colWidth/2, trayY)
          ctx.lineTo(x + colWidth/2, trayY)
          ctx.stroke()
        }
        break

      case 'heat_exchanger':
      case 'cooler':
      case 'heater':
        // Rectangle with crossed lines (standard heat exchanger)
        const hexWidth = size
        const hexHeight = size * 0.6
        ctx.beginPath()
        ctx.rect(x - hexWidth/2, y - hexHeight/2, hexWidth, hexHeight)
        ctx.fill()
        ctx.stroke()
        // Crossed lines
        ctx.beginPath()
        ctx.moveTo(x - hexWidth/2, y - hexHeight/2)
        ctx.lineTo(x + hexWidth/2, y + hexHeight/2)
        ctx.moveTo(x + hexWidth/2, y - hexHeight/2)
        ctx.lineTo(x - hexWidth/2, y + hexHeight/2)
        ctx.stroke()
        break

      case 'valve':
        // Triangle (standard valve symbol)
        ctx.beginPath()
        ctx.moveTo(x, y - size/2)
        ctx.lineTo(x + size/2, y + size/2)
        ctx.lineTo(x - size/2, y + size/2)
        ctx.closePath()
        ctx.fill()
        ctx.stroke()
        break

      default:
        // Generic circle
        ctx.beginPath()
        ctx.arc(x, y, size/2, 0, Math.PI * 2)
        ctx.fill()
        ctx.stroke()
    }

    // Draw tag
    if (tag) {
      ctx.fillStyle = '#1f2937'
      ctx.font = `bold ${canvasSettings.tagFontSize}px ${canvasSettings.fontFamily}`
      ctx.textAlign = 'center'
      ctx.fillText(tag, x, y + size/2 + 15)
    }

    ctx.restore()
  }

  // Draw pipe line (2D - orthogonal only)
  const drawPipeLine = (ctx, x1, y1, x2, y2, lineNumber, size) => {
    ctx.save()
    ctx.strokeStyle = canvasSettings.processLineColor
    ctx.lineWidth = canvasSettings.lineWidth

    // Draw orthogonal line (horizontal then vertical, or vice versa)
    ctx.beginPath()
    ctx.moveTo(x1, y1)
    
    // Determine routing (prefer horizontal-first)
    const midX = (x1 + x2) / 2
    ctx.lineTo(midX, y1) // Horizontal
    ctx.lineTo(midX, y2) // Vertical
    ctx.lineTo(x2, y2) // Horizontal
    ctx.stroke()

    // Draw line number and size
    if (lineNumber && size) {
      ctx.fillStyle = '#1f2937'
      ctx.font = `${canvasSettings.fontSize}px ${canvasSettings.fontFamily}`
      ctx.textAlign = 'center'
      ctx.fillText(`${lineNumber}`, midX, y1 - 5)
      ctx.fillText(`${size}`, midX, y1 + 15)
    }

    // Draw flow direction arrow
    ctx.beginPath()
    ctx.moveTo(x2 - 10, y2 - 5)
    ctx.lineTo(x2, y2)
    ctx.lineTo(x2 - 10, y2 + 5)
    ctx.stroke()

    ctx.restore()
  }

  // Draw instrument symbol
  // Draw instrument symbol (ISA-5.1 compliant)
  const drawInstrument = (ctx, instrument, x, y) => {
    if (!instrument) return
    
    ctx.save()
    const radius = 20
    const tag = instrument.tag_number || instrument.tag || instrument.id || 'XI-001'
    
    // Get symbol info from engine if available, with safe fallback
    let symbol
    try {
      symbol = instrumentationEngineRef.current 
        ? instrumentationEngineRef.current.getInstrumentSymbol(instrument)
        : { 
            circleType: 'field', 
            letters: tag.split('-')[0] || 'XI', 
            showBalloon: true,
            loopNumber: '001'
          }
    } catch (error) {
      console.error('Error getting instrument symbol:', error, instrument)
      // Fallback symbol
      symbol = { 
        circleType: 'field', 
        letters: tag.split('-')[0] || 'XI', 
        showBalloon: true,
        loopNumber: '001'
      }
    }

    // Draw based on mounting location
    if (symbol.circleType === 'dcs') {
      // Square for DCS/computer function
      ctx.strokeStyle = canvasSettings.instrumentLineColor
      ctx.lineWidth = 2
      ctx.fillStyle = '#ffffff'
      ctx.strokeRect(x - radius, y - radius, radius * 2, radius * 2)
      ctx.fillRect(x - radius, y - radius, radius * 2, radius * 2)
    } else if (symbol.circleType === 'panel') {
      // Circle on line for panel mounted
      ctx.strokeStyle = canvasSettings.instrumentLineColor
      ctx.lineWidth = 2
      ctx.fillStyle = '#ffffff'
      
      // Horizontal line
      ctx.beginPath()
      ctx.moveTo(x - radius - 10, y + radius + 5)
      ctx.lineTo(x + radius + 10, y + radius + 5)
      ctx.stroke()
      
      // Circle
      ctx.beginPath()
      ctx.arc(x, y, radius, 0, Math.PI * 2)
      ctx.fill()
      ctx.stroke()
    } else {
      // Standard circle for field mounted
      ctx.strokeStyle = canvasSettings.instrumentLineColor
      ctx.lineWidth = 2
      ctx.fillStyle = '#ffffff'
      ctx.beginPath()
      ctx.arc(x, y, radius, 0, Math.PI * 2)
      ctx.fill()
      ctx.stroke()
    }
    
    // Draw function letters inside circle
    if (symbol.letters) {
      ctx.fillStyle = '#1f2937'
      ctx.font = `bold ${canvasSettings.tagFontSize}px ${canvasSettings.fontFamily}`
      ctx.textAlign = 'center'
      ctx.textBaseline = 'middle'
      ctx.fillText(symbol.letters, x, y)
    }

    // Draw tag/loop number below
    if (showInstrumentTags && tag) {
      ctx.fillStyle = '#1f2937'
      ctx.font = `${canvasSettings.tagFontSize}px ${canvasSettings.fontFamily}`
      ctx.textAlign = 'center'
      ctx.textBaseline = 'top'
      ctx.fillText(tag, x, y + radius + 5)
    }
    
    // Highlight selected instrument
    if (selectedInstrument === tag) {
      ctx.strokeStyle = '#f59e0b'
      ctx.lineWidth = 3
      ctx.setLineDash([5, 5])
      ctx.beginPath()
      ctx.arc(x, y, radius + 5, 0, Math.PI * 2)
      ctx.stroke()
      ctx.setLineDash([])
    }

    ctx.restore()
  }

  // Draw grid
  const drawGrid = (ctx) => {
    if (!canvasSettings.showGrid) return

    ctx.save()
    ctx.strokeStyle = canvasSettings.gridColor
    ctx.lineWidth = 0.5

    const gridSize = canvasSettings.gridSize
    for (let x = 0; x < canvasSettings.width; x += gridSize) {
      ctx.beginPath()
      ctx.moveTo(x, 0)
      ctx.lineTo(x, canvasSettings.height)
      ctx.stroke()
    }

    for (let y = 0; y < canvasSettings.height; y += gridSize) {
      ctx.beginPath()
      ctx.moveTo(0, y)
      ctx.lineTo(canvasSettings.width, y)
      ctx.stroke()
    }

    ctx.restore()
  }

  // Initialize placement engine
  useEffect(() => {
    if (!placementEngineRef.current) {
      placementEngineRef.current = new EquipmentPlacementEngine(
        canvasSettings.width,
        canvasSettings.height,
        {
          minSpacing: canvasSettings.minEquipmentSpacing,
          gridSize: canvasSettings.gridSize,
          margins: { top: 100, right: 100, bottom: 100, left: 100 }
        }
      )
    }
    
    // Initialize piping engine
    if (!pipingEngineRef.current) {
      pipingEngineRef.current = new PipingRouteEngine(
        canvasSettings.width,
        canvasSettings.height,
        {
          gridSize: canvasSettings.gridSize / 2, // Finer grid for pipes
          minPipeSpacing: canvasSettings.pipeSpacing,
          routingStrategy: routingStrategy,
          avoidCrossings: avoidCrossings,
          snapToGrid: true,
          margins: { top: 100, right: 100, bottom: 100, left: 100 }
        }
      )
    }
    
    // Initialize instrumentation engine
    if (!instrumentationEngineRef.current) {
      instrumentationEngineRef.current = new InstrumentationEngine(
        canvasSettings.width,
        canvasSettings.height,
        {
          gridSize: canvasSettings.gridSize,
          instrumentSize: 40,
          panelHeight: 100,
          margins: { top: 100, right: 100, bottom: 100, left: 100 }
        }
      )
    }
    
    // Initialize annotation engine
    if (!annotationEngineRef.current) {
      annotationEngineRef.current = new AnnotationEngine(
        canvasSettings.width,
        canvasSettings.height,
        {
          gridSize: canvasSettings.gridSize,
          defaultFontSize: canvasSettings.fontSize,
          margins: { top: 100, right: 100, bottom: 100, left: 100 }
        }
      )
    }
  }, [])

  // Smart auto-calculate equipment positions using AI placement engine
  useEffect(() => {
    if (!pidData?.equipment_list || !placementEngineRef.current) return
    
    const positions = placementEngineRef.current.placeEquipment(pidData.equipment_list, {
      flowDirection,
      layoutStyle,
      autoOptimize,
      respectElevation
    })
    
    setEquipmentPositions(positions)
  }, [pidData, flowDirection, layoutStyle, autoOptimize, respectElevation])
  
  // Handle equipment dragging
  const handleEquipmentDrag = (index, newX, newY) => {
    if (placementEngineRef.current) {
      const updated = placementEngineRef.current.reArrange(equipmentPositions, index, newX, newY)
      setEquipmentPositions(updated)
    }
  }

  // Auto-arrange with different strategies
  const autoArrangeEquipment = (strategy) => {
    if (!pidData?.equipment_list || !placementEngineRef.current) return
    
    const positions = placementEngineRef.current.placeEquipment(pidData.equipment_list, {
      flowDirection,
      layoutStyle: strategy,
      autoOptimize: true,
      respectElevation
    })
    
    setEquipmentPositions(positions)
    setLayoutStyle(strategy)
  }
  
  // Stage 3: Route pipes using AI engine
  useEffect(() => {
    if (!equipmentPositions.length || !pipingEngineRef.current) return
    
    // Get or generate connections
    let connectionsToRoute = connections
    
    // Auto-generate connections if enabled and no manual connections
    if (autoGenerateConnections && connections.length === 0 && pidData?.equipment_list) {
      if (pipingEngineRef.current && typeof pipingEngineRef.current.autoGenerateConnections === 'function') {
        try {
          connectionsToRoute = pipingEngineRef.current.autoGenerateConnections(pidData.equipment_list)
          setConnections(connectionsToRoute)
        } catch (error) {
          console.error('Error auto-generating connections:', error)
          // Fallback to empty connections array
          connectionsToRoute = []
        }
      } else {
        console.warn('Piping engine not initialized, cannot auto-generate connections')
      }
    }
    
    // Extract connections from pidData if available
    if (!connectionsToRoute.length && pidData?.pipe_connections) {
      connectionsToRoute = pidData.pipe_connections
      setConnections(connectionsToRoute)
    }
    
    // Route pipes
    if (connectionsToRoute.length > 0 && pipingEngineRef.current) {
      try {
        const routes = pipingEngineRef.current.routePipes(
          equipmentPositions,
          connectionsToRoute,
          {
            routingStrategy,
            avoidCrossings
          }
        )
        setPipeRoutes(routes)
      } catch (error) {
        console.error('Error routing pipes:', error)
        setPipeRoutes([])
      }
    }
  }, [equipmentPositions, routingStrategy, avoidCrossings, autoGenerateConnections, connections])
  
  // Auto-route with different strategy
  const autoRoutePipes = (strategy) => {
    if (!equipmentPositions.length || !pipingEngineRef.current) return
    
    // Get connections to route (either manual or auto-generated)
    let connectionsToUse = connections
    if (connectionsToUse.length === 0 && pidData?.equipment_list) {
      try {
        connectionsToUse = pipingEngineRef.current.autoGenerateConnections(pidData?.equipment_list || [])
      } catch (error) {
        console.error('Error auto-generating connections in autoRoutePipes:', error)
        connectionsToUse = []
      }
    }
    
    const routes = pipingEngineRef.current.routePipes(
      equipmentPositions,
      connectionsToUse,
      {
        routingStrategy: strategy,
        avoidCrossings
      }
    )
    
    setPipeRoutes(routes)
    setRoutingStrategy(strategy)
  }
  
  // Stage 4: Place instruments using AI engine
  useEffect(() => {
    if (!equipmentPositions.length || !instrumentationEngineRef.current) return
    
    // Get or generate instruments
    let instrumentsToPlace = instruments
    
    // Auto-generate instruments if enabled and no manual instruments
    if (autoGenerateInstruments && instruments.length === 0 && pidData?.equipment_list) {
      instrumentsToPlace = instrumentationEngineRef.current.autoGenerateInstruments(pidData.equipment_list)
      setInstruments(instrumentsToPlace)
    }
    
    // Extract instruments from pidData if available
    if (!instrumentsToPlace.length && pidData?.instrument_list) {
      instrumentsToPlace = pidData.instrument_list
      setInstruments(instrumentsToPlace)
    }
    
    // Place instruments
    if (instrumentsToPlace.length > 0) {
      const positions = instrumentationEngineRef.current.placeInstruments(
        equipmentPositions,
        instrumentsToPlace,
        {
          placementStrategy,
          showControlLoops
        }
      )
      setInstrumentPositions(positions)
      
      // Route signal lines
      const signals = instrumentationEngineRef.current.routeSignalLines(
        positions,
        equipmentPositions
      )
      setSignalRoutes(signals)
    }
  }, [equipmentPositions, placementStrategy, showControlLoops, autoGenerateInstruments, instruments])
  
  // Auto-place with different strategy
  const autoPlaceInstruments = (strategy) => {
    if (!equipmentPositions.length || !instrumentationEngineRef.current) return
    
    const instrumentsToUse = instruments.length > 0 
      ? instruments 
      : instrumentationEngineRef.current.autoGenerateInstruments(pidData?.equipment_list || [])
    
    const positions = instrumentationEngineRef.current.placeInstruments(
      equipmentPositions,
      instrumentsToUse,
      {
        placementStrategy: strategy,
        showControlLoops
      }
    )
    
    setInstrumentPositions(positions)
    setPlacementStrategy(strategy)
    
    // Route signal lines
    const signals = instrumentationEngineRef.current.routeSignalLines(
      positions,
      equipmentPositions
    )
    setSignalRoutes(signals)
  }
  
  // Stage 5: Generate and place annotations
  useEffect(() => {
    // Soft coding: Validate all required conditions before proceeding
    if (!equipmentPositions?.length || !annotationEngineRef.current) return
    
    // Validate annotation engine has the required method
    if (!annotationEngineRef.current || typeof annotationEngineRef.current.generateAnnotations !== 'function') {
      console.warn('Annotation engine not properly initialized')
      return
    }
    
    if (autoGenerateAnnotations) {
      try {
        // Soft coding: Build diagram data with safe array operations
        const diagramData = {
          equipment: equipmentPositions || [],
          pipes: pipeRoutes || [],
          instruments: instrumentPositions || [],
          processConditions: {
            flowRates: (pipeRoutes || []).map((p, idx) => ({ 
              pipeId: p?.id || `pipe-${idx}`, 
              value: 100, 
              unit: 'm³/h' 
            })),
            pressures: (equipmentPositions || []).map((e, idx) => ({ 
              equipmentId: e?.id || `equipment-${idx}`, 
              value: 2.5, 
              unit: 'bar' 
            })),
            temperatures: (equipmentPositions || []).map((e, idx) => ({ 
              equipmentId: e?.id || `equipment-${idx}`, 
              value: 80, 
              unit: '°C' 
            }))
          }
        }
        
        // Soft coding: Configuration object with safe boolean checks
        const annotationConfig = {
          includeProcessData: showProcessData === true,
          includeEquipmentNotes: showEquipmentNotes === true,
          includeSafetyNotes: showSafetyNotes === true,
          includeDesignBasis: showDesignBasis === true,
          includeCallouts: showCallouts === true
        }
        
        const generated = annotationEngineRef.current.generateAnnotations(diagramData, annotationConfig)
        
        // Soft coding: Validate generated annotations before setting state
        if (Array.isArray(generated)) {
          setAnnotations(generated)
        } else {
          console.warn('Generated annotations is not an array, ignoring')
          setAnnotations([])
        }
      } catch (error) {
        console.error('Error auto-generating annotations:', error)
        setAnnotations([])
      }
    }
  }, [equipmentPositions, pipeRoutes, instrumentPositions, autoGenerateAnnotations, showProcessData, showEquipmentNotes, showSafetyNotes, showDesignBasis, showCallouts])
  
  // Auto-generate specific annotation types
  const autoGenerateAnnotationType = (type) => {
    // Soft coding: Validate annotation engine exists and has required methods
    if (!annotationEngineRef.current) {
      console.warn('Annotation engine not initialized')
      return
    }
    
    try {
      // Soft coding: Build diagram data with safe defaults
      const diagramData = {
        equipment: equipmentPositions || [],
        pipes: pipeRoutes || [],
        instruments: instrumentPositions || [],
        processConditions: {
          flowRates: (pipeRoutes || []).map((p, idx) => ({ 
            pipeId: p?.id || `pipe-${idx}`, 
            value: 100, 
            unit: 'm³/h' 
          })),
          pressures: (equipmentPositions || []).map((e, idx) => ({ 
            equipmentId: e?.id || `equipment-${idx}`, 
            value: 2.5, 
            unit: 'bar' 
          })),
          temperatures: (equipmentPositions || []).map((e, idx) => ({ 
            equipmentId: e?.id || `equipment-${idx}`, 
            value: 80, 
            unit: '°C' 
          }))
        }
      }
      
      let newAnnotations = []
      
      // Soft coding: Validate method exists before calling
      switch(type) {
        case 'process_data':
          if (typeof annotationEngineRef.current.generateProcessDataAnnotations === 'function') {
            newAnnotations = annotationEngineRef.current.generateProcessDataAnnotations(diagramData)
          }
          break
        case 'equipment':
          if (typeof annotationEngineRef.current.generateEquipmentAnnotations === 'function') {
            newAnnotations = annotationEngineRef.current.generateEquipmentAnnotations(diagramData)
          }
          break
        case 'safety':
          if (typeof annotationEngineRef.current.generateSafetyAnnotations === 'function') {
            newAnnotations = annotationEngineRef.current.generateSafetyAnnotations(diagramData)
          }
          break
        default:
          console.warn(`Unknown annotation type: ${type}`)
          break
      }
      
      // Soft coding: Validate result is array before updating state
      if (Array.isArray(newAnnotations) && newAnnotations.length > 0) {
        setAnnotations(prev => [...(prev || []), ...newAnnotations])
      }
    } catch (error) {
      console.error(`Error generating ${type} annotations:`, error)
    }
  }
  
  // Main render function
  const renderPID = () => {
    const canvas = canvasRef.current
    if (!canvas) return

    const ctx = canvas.getContext('2d')
    ctx.clearRect(0, 0, canvas.width, canvas.height)

    // Apply zoom and pan
    ctx.save()
    ctx.translate(pan.x, pan.y)
    ctx.scale(zoom, zoom)

    // Background
    ctx.fillStyle = canvasSettings.backgroundColor
    ctx.fillRect(0, 0, canvasSettings.width, canvasSettings.height)

    // Grid (toggle based on stage)
    if (showGrid) {
      drawGrid(ctx)
    }

    // Render equipment using calculated positions
    equipmentPositions.forEach(equipment => {
      drawEquipmentSymbol(ctx, equipment.equipment_type || 'vessel', 
                         equipment.x, equipment.y, equipment.tag)
      
      // Highlight selected equipment
      if (selectedEquipment === equipment.index) {
        ctx.strokeStyle = '#3b82f6'
        ctx.lineWidth = 3
        ctx.setLineDash([10, 5])
        ctx.strokeRect(equipment.x - 60, equipment.y - 60, 120, 120)
        ctx.setLineDash([])
      }
    })

    // Draw AI-routed pipes (Stage 3)
    if (pipeRoutes.length > 0) {
      pipeRoutes.forEach((route, index) => {
        ctx.save()
        
        // Set line style based on pipe category
        ctx.strokeStyle = this.getPipeColor(route.category)
        ctx.lineWidth = route.lineWidth || 2
        
        // Apply line style (solid, dashed, dotted)
        if (route.lineStyle === 'dashed') {
          ctx.setLineDash([10, 5])
        } else if (route.lineStyle === 'dotted') {
          ctx.setLineDash([3, 3])
        }
        
        // Draw pipe route through waypoints
        ctx.beginPath()
        route.waypoints.forEach((point, i) => {
          if (i === 0) {
            ctx.moveTo(point.x, point.y)
          } else {
            ctx.lineTo(point.x, point.y)
          }
        })
        ctx.stroke()
        ctx.setLineDash([])
        
        // Highlight selected pipe
        if (selectedPipe === route.id) {
          ctx.strokeStyle = '#f59e0b'
          ctx.lineWidth = route.lineWidth + 2
          ctx.globalAlpha = 0.5
          ctx.stroke()
          ctx.globalAlpha = 1.0
        }
        
        // Draw flow direction arrows
        if (showFlowArrows && route.flowDirection) {
          route.flowDirection.forEach(arrow => {
            ctx.save()
            ctx.translate(arrow.x, arrow.y)
            ctx.rotate(arrow.angle)
            ctx.fillStyle = ctx.strokeStyle
            ctx.beginPath()
            ctx.moveTo(0, 0)
            ctx.lineTo(-10, -5)
            ctx.lineTo(-10, 5)
            ctx.closePath()
            ctx.fill()
            ctx.restore()
          })
        }
        
        // Draw pipe labels
        if (showPipeLabels && route.line_number) {
          const midPoint = route.waypoints[Math.floor(route.waypoints.length / 2)]
          ctx.fillStyle = '#1f2937'
          ctx.font = `10px ${canvasSettings.fontFamily}`
          ctx.textAlign = 'center'
          ctx.fillText(route.line_number, midPoint.x, midPoint.y - 10)
          if (route.pipe_size) {
            ctx.fillText(`${route.pipe_size}"`, midPoint.x, midPoint.y + 20)
          }
        }
        
        ctx.restore()
      })
    } else if (equipmentPositions.length > 1) {
      // Fallback to simple pipes if Stage 3 not active
      if (flowDirection === 'left-to-right') {
        for (let i = 0; i < equipmentPositions.length - 1; i++) {
          const eq1 = equipmentPositions[i]
          const eq2 = equipmentPositions[i + 1]
          const x1 = eq1.x + 50
          const y1 = eq1.y
          const x2 = eq2.x - 50
          const y2 = eq2.y
          drawPipeLine(ctx, x1, y1, x2, y2, `${100 + i}-P-${i + 1}`, '4"')
          
          // Flow arrows
          if (showFlowArrows) {
            const midX = (x1 + x2) / 2
            const midY = (y1 + y2) / 2
            drawFlowArrow(ctx, midX, midY, 'right')
          }
        }
      } else if (flowDirection === 'top-to-bottom') {
        for (let i = 0; i < equipmentPositions.length - 1; i++) {
          const eq1 = equipmentPositions[i]
          const eq2 = equipmentPositions[i + 1]
          const x1 = eq1.x
          const y1 = eq1.y + 50
          const x2 = eq2.x
          const y2 = eq2.y - 50
          drawPipeLine(ctx, x1, y1, x2, y2, `${100 + i}-P-${i + 1}`, '4"')
          
          // Flow arrows
          if (showFlowArrows) {
            const midX = (x1 + x2) / 2
            const midY = (y1 + y2) / 2
            drawFlowArrow(ctx, midX, midY, 'down')
          }
        }
      }
    }

    // Draw AI-placed instruments (Stage 4)
    if (instrumentPositions.length > 0) {
      // Draw signal lines first (behind instruments)
      signalRoutes.forEach(route => {
        ctx.save()
        ctx.strokeStyle = '#3b82f6'
        ctx.lineWidth = 1
        
        // Apply signal line style
        if (route.lineStyle === 'dashed') {
          ctx.setLineDash([10, 5])
        } else if (route.lineStyle === 'dotted') {
          ctx.setLineDash([3, 3])
        } else if (route.lineStyle === 'dashdot') {
          ctx.setLineDash([10, 5, 3, 5])
        }
        
        // Draw signal line through waypoints
        ctx.beginPath()
        route.waypoints.forEach((point, i) => {
          if (i === 0) {
            ctx.moveTo(point.x, point.y)
          } else {
            ctx.lineTo(point.x, point.y)
          }
        })
        ctx.stroke()
        ctx.setLineDash([])
        ctx.restore()
      })
      
      // Draw instruments on top
      instrumentPositions.forEach(instrument => {
        drawInstrument(ctx, instrument, instrument.x, instrument.y)
      })
    } else if (pidData?.instrument_list && pidData.instrument_list.length > 0) {
      // Fallback to simple instrument rendering if Stage 4 not active
      const equipmentCount = pidData.equipment_list?.length || 0
      const spacing = Math.min(canvasSettings.minEquipmentSpacing,
                               (canvasSettings.width - 200) / Math.max(equipmentCount, 1))

      pidData.instrument_list.forEach((instrument, index) => {
        const equipIndex = Math.floor(index / 2)
        const x = 100 + equipIndex * spacing
        const y = (canvasSettings.height / 2) + (index % 2 === 0 ? -80 : 80)
        drawInstrument(ctx, instrument, x, y)

        // Connection line to equipment
        ctx.strokeStyle = canvasSettings.instrumentLineColor
        ctx.lineWidth = 1
        ctx.setLineDash([5, 5])
        ctx.beginPath()
        ctx.moveTo(x, y + (index % 2 === 0 ? 20 : -20))
        ctx.lineTo(x, canvasSettings.height / 2 + (index % 2 === 0 ? -50 : 50))
        ctx.stroke()
        ctx.setLineDash([])
      })
    }

    // Title block (bottom right - standard P&ID practice)
    ctx.strokeStyle = '#000000'
    ctx.lineWidth = 2
    ctx.strokeRect(canvasSettings.width - 350, canvasSettings.height - 150, 330, 130)
    
    ctx.fillStyle = '#000000'
    ctx.font = `bold 14px ${canvasSettings.fontFamily}`
    ctx.textAlign = 'left'
    ctx.fillText('P&ID DRAWING', canvasSettings.width - 340, canvasSettings.height - 125)
    
    ctx.font = `12px ${canvasSettings.fontFamily}`
    ctx.fillText(`Drawing No: ${pidData?.pid_drawing_number || 'P&ID-XXX-001'}`, 
                 canvasSettings.width - 340, canvasSettings.height - 105)
    ctx.fillText(`Title: ${pidData?.pid_title || 'Process System'}`, 
                 canvasSettings.width - 340, canvasSettings.height - 85)
    ctx.fillText(`Revision: ${pidData?.pid_revision || 'A'}`, 
                 canvasSettings.width - 340, canvasSettings.height - 65)
    ctx.fillText(`Date: ${new Date().toLocaleDateString()}`, 
                 canvasSettings.width - 340, canvasSettings.height - 45)
    ctx.fillText('Designed by: AI Assistant with Expert Guidance', 
                 canvasSettings.width - 340, canvasSettings.height - 25)
    
    // Draw annotations (Stage 5)
    if (annotations.length > 0) {
      annotations.forEach(annotation => {
        drawAnnotation(ctx, annotation)
      })
    }

    ctx.restore()
  }
  
  // Draw annotation with intelligent styling
  const drawAnnotation = (ctx, annotation) => {
    ctx.save()
    
    const { type, x, y, width, height, text, style } = annotation
    
    // Type-specific styling
    const typeStyles = {
      note: { bg: '#fef3c7', border: '#f59e0b', textColor: '#92400e' },
      process_data: { bg: '#dbeafe', border: '#3b82f6', textColor: '#1e40af' },
      equipment_tag: { bg: '#f3e8ff', border: '#a855f7', textColor: '#6b21a8' },
      safety: { bg: '#fee2e2', border: '#dc2626', textColor: '#991b1b' },
      design_basis: { bg: '#e0e7ff', border: '#6366f1', textColor: '#3730a3' },
      revision: { bg: '#f0fdf4', border: '#10b981', textColor: '#065f46' },
      callout: { bg: '#ffffff', border: '#374151', textColor: '#1f2937' },
      dimension: { bg: '#fafafa', border: '#6b7280', textColor: '#374151' },
      legend: { bg: '#f9fafb', border: '#9ca3af', textColor: '#1f2937' }
    }
    
    const currentStyle = typeStyles[type] || typeStyles.note
    
    // Draw annotation box
    ctx.fillStyle = currentStyle.bg
    ctx.strokeStyle = currentStyle.border
    ctx.lineWidth = 1.5
    
    if (type === 'revision') {
      // Draw revision cloud
      drawRevisionCloud(ctx, x, y, width, height, currentStyle.border)
    } else {
      ctx.fillRect(x, y, width, height)
      ctx.strokeRect(x, y, width, height)
    }
    
    // Draw leader line if callout
    if (type === 'callout' && annotation.leaderLine) {
      const { start, end } = annotation.leaderLine
      ctx.strokeStyle = currentStyle.border
      ctx.lineWidth = 1
      ctx.beginPath()
      ctx.moveTo(start.x, start.y)
      ctx.lineTo(end.x, end.y)
      ctx.stroke()
      
      // Arrow at target
      const angle = Math.atan2(end.y - start.y, end.x - start.x)
      ctx.save()
      ctx.translate(end.x, end.y)
      ctx.rotate(angle)
      ctx.beginPath()
      ctx.moveTo(0, 0)
      ctx.lineTo(-8, -4)
      ctx.lineTo(-8, 4)
      ctx.closePath()
      ctx.fillStyle = currentStyle.border
      ctx.fill()
      ctx.restore()
    }
    
    // Draw text content
    ctx.fillStyle = currentStyle.textColor
    ctx.font = `${style?.fontSize || 10}px ${canvasSettings.fontFamily}`
    ctx.textAlign = 'left'
    ctx.textBaseline = 'top'
    
    const padding = 5
    const lineHeight = (style?.fontSize || 10) + 2
    
    // Handle multi-line text
    if (Array.isArray(text)) {
      text.forEach((line, i) => {
        ctx.fillText(line, x + padding, y + padding + i * lineHeight)
      })
    } else {
      const lines = text.split('\n')
      lines.forEach((line, i) => {
        ctx.fillText(line, x + padding, y + padding + i * lineHeight)
      })
    }
    
    // Highlight selected annotation
    if (selectedAnnotation === annotation.id) {
      ctx.strokeStyle = '#f59e0b'
      ctx.lineWidth = 3
      ctx.setLineDash([5, 5])
      ctx.strokeRect(x - 3, y - 3, width + 6, height + 6)
      ctx.setLineDash([])
    }
    
    ctx.restore()
  }
  
  // Draw revision cloud
  const drawRevisionCloud = (ctx, x, y, width, height, color) => {
    ctx.save()
    ctx.strokeStyle = color
    ctx.lineWidth = 1.5
    ctx.beginPath()
    
    const arcRadius = 8
    const arcCount = Math.floor((width + height) * 2 / (arcRadius * 2))
    const perimeter = (width + height) * 2
    const arcSpacing = perimeter / arcCount
    
    let currentDist = 0
    let currentX = x
    let currentY = y
    let side = 0 // 0: top, 1: right, 2: bottom, 3: left
    
    ctx.moveTo(x, y)
    
    for (let i = 0; i < arcCount; i++) {
      const angle1 = Math.random() * Math.PI * 2
      const angle2 = angle1 + Math.PI
      
      // Calculate arc center based on current position
      let cx, cy
      if (side === 0) { // top
        cx = currentX
        cy = y
        currentX += arcSpacing
        if (currentX > x + width) {
          currentX = x + width
          currentY = y
          side = 1
        }
      } else if (side === 1) { // right
        cx = x + width
        cy = currentY
        currentY += arcSpacing
        if (currentY > y + height) {
          currentY = y + height
          currentX = x + width
          side = 2
        }
      } else if (side === 2) { // bottom
        cx = currentX
        cy = y + height
        currentX -= arcSpacing
        if (currentX < x) {
          currentX = x
          currentY = y + height
          side = 3
        }
      } else { // left
        cx = x
        cy = currentY
        currentY -= arcSpacing
        if (currentY < y) break
      }
      
      ctx.arc(cx, cy, arcRadius, angle1, angle2, false)
    }
    
    ctx.stroke()
    ctx.restore()
  }
  
  // Draw flow arrow
  const drawFlowArrow = (ctx, x, y, direction) => {
    ctx.save()
    ctx.fillStyle = '#3b82f6'
    ctx.strokeStyle = '#3b82f6'
    ctx.lineWidth = 2
    
    const arrowSize = 12
    ctx.beginPath()
    
    if (direction === 'right') {
      ctx.moveTo(x - arrowSize, y - arrowSize/2)
      ctx.lineTo(x, y)
      ctx.lineTo(x - arrowSize, y + arrowSize/2)
    } else if (direction === 'down') {
      ctx.moveTo(x - arrowSize/2, y - arrowSize)
      ctx.lineTo(x, y)
      ctx.lineTo(x + arrowSize/2, y - arrowSize)
    }
    
    ctx.stroke()
    ctx.restore()
  }
  
  // Get pipe color based on category
  const getPipeColor = (category) => {
    const colors = {
      'process': '#1f2937',
      'utility-steam': '#dc2626',
      'utility-cooling': '#3b82f6',
      'utility-air': '#a855f7',
      'utility-nitrogen': '#8b5cf6',
      'instrument': '#f59e0b',
      'signal': '#10b981'
    }
    return colors[category] || '#1f2937'
  }

  // Mouse handlers for pan and equipment dragging
  const handleMouseDown = (e) => {
    const canvas = canvasRef.current
    const rect = canvas.getBoundingClientRect()
    const mouseX = (e.clientX - rect.left - pan.x) / zoom
    const mouseY = (e.clientY - rect.top - pan.y) / zoom
    
    // Check if clicking on equipment (Stage 2 feature)
    if (currentStage === 'stage2_equipment') {
      let clickedEquipmentIndex = -1
      equipmentPositions.forEach((equipment, index) => {
        const distance = Math.sqrt(
          Math.pow(mouseX - equipment.x, 2) + Math.pow(mouseY - equipment.y, 2)
        )
        if (distance < 40) { // 40px click radius
          clickedEquipmentIndex = index
        }
      })
      
      if (clickedEquipmentIndex >= 0) {
        setIsDraggingEquipment(true)
        setSelectedEquipment(clickedEquipmentIndex)
        return
      }
    }
    
    // Otherwise, pan the canvas
    setIsDragging(true)
    setDragStart({ x: e.clientX - pan.x, y: e.clientY - pan.y })
  }

  const handleMouseMove = (e) => {
    const canvas = canvasRef.current
    const rect = canvas.getBoundingClientRect()
    const mouseX = (e.clientX - rect.left - pan.x) / zoom
    const mouseY = (e.clientY - rect.top - pan.y) / zoom
    
    // Handle equipment dragging
    if (isDraggingEquipment && selectedEquipment >= 0) {
      handleEquipmentDrag(selectedEquipment, mouseX, mouseY)
      return
    }
    
    // Handle canvas panning
    if (!isDragging) return
    setPan({
      x: e.clientX - dragStart.x,
      y: e.clientY - dragStart.y
    })
  }

  const handleMouseUp = () => {
    setIsDragging(false)
    setIsDraggingEquipment(false)
    // Keep selection for property inspection
  }

  const handleWheel = (e) => {
    e.preventDefault()
    const delta = e.deltaY > 0 ? 0.9 : 1.1
    setZoom(prev => Math.min(Math.max(prev * delta, 0.1), 5))
  }

  const exportToPNG = () => {
    const canvas = canvasRef.current
    const link = document.createElement('a')
    link.download = `PID_2D_${pidData?.pid_drawing_number || 'export'}.png`
    link.href = canvas.toDataURL()
    link.click()
  }

  const exportToSVG = () => {
    // SVG export would be implemented here
    alert('SVG export feature coming soon!')
  }
  
  // Initialize Integration Engine
  useEffect(() => {
    if (!integrationEngineRef.current) {
      integrationEngineRef.current = new IntegrationEngine({
        units: 'metric',
        coordinateScale: 1
      })
    }
  }, [])
  
  // Export to third-party software
  const exportToIntegration = (format) => {
    if (!integrationEngineRef.current) return
    
    setExportProgress({ format, status: 'preparing' })
    
    try {
      // Prepare complete P&ID data
      const exportData = {
        pid_drawing_number: pidData?.pid_drawing_number,
        pid_title: pidData?.pid_title,
        pid_revision: pidData?.pid_revision,
        equipment_list: equipmentPositions,
        pipe_list: pipeRoutes,
        instrument_list: instrumentPositions,
        annotations: annotations,
        flow_rates: pipeRoutes.map(p => ({ pipeId: p.id, value: 100, unit: 'm³/h' })),
        pressures: equipmentPositions.map(e => ({ equipmentId: e.id, value: 2.5, unit: 'bar' })),
        temperatures: equipmentPositions.map(e => ({ equipmentId: e.id, value: 80, unit: '°C' }))
      }
      
      // Validate before export
      const validation = integrationEngineRef.current.validateExportData(exportData, format)
      if (!validation.valid) {
        alert(`Export validation failed:\n${validation.errors.join('\n')}`)
        setExportProgress(null)
        return
      }
      
      // Export
      setExportProgress({ format, status: 'exporting' })
      const result = integrationEngineRef.current.exportTo(format, exportData)
      
      // Download file
      const blob = new Blob([result.content], { type: result.mimeType })
      const url = URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url
      link.download = result.filename
      link.click()
      URL.revokeObjectURL(url)
      
      setExportProgress({ format, status: 'complete' })
      setTimeout(() => setExportProgress(null), 2000)
      
      // Show instructions if available
      if (result.instructions) {
        setTimeout(() => {
          alert(`Export Complete!\n\n${result.instructions.join('\n')}`)
        }, 500)
      }
      
    } catch (error) {
      console.error('Export error:', error)
      alert(`Export failed: ${error.message}`)
      setExportProgress(null)
    }
  }
  
  // Get available integrations
  const getAvailableIntegrations = () => {
    if (!integrationEngineRef.current) return []
    return Object.values(integrationEngineRef.current.config.supportedFormats)
  }
  
  // Fullscreen Controls
  const toggleFullscreen = () => {
    const container = containerRef.current
    if (!container) return
    
    if (!isFullscreen) {
      // Enter fullscreen
      if (container.requestFullscreen) {
        container.requestFullscreen()
      } else if (container.webkitRequestFullscreen) {
        container.webkitRequestFullscreen()
      } else if (container.msRequestFullscreen) {
        container.msRequestFullscreen()
      }
      setIsFullscreen(true)
      // Expand canvas to fullscreen size
      setCanvasSize({
        width: window.innerWidth - 100,
        height: window.innerHeight - 100
      })
    } else {
      // Exit fullscreen
      if (document.exitFullscreen) {
        document.exitFullscreen()
      } else if (document.webkitExitFullscreen) {
        document.webkitExitFullscreen()
      } else if (document.msExitFullscreen) {
        document.msExitFullscreen()
      }
      setIsFullscreen(false)
      // Reset canvas to normal size
      setCanvasSize({ width: 1400, height: 1000 })
    }
  }
  
  // Zoom Controls
  const zoomIn = () => setZoom(prev => Math.min(prev * 1.2, 5))
  const zoomOut = () => setZoom(prev => Math.max(prev / 1.2, 0.1))
  const zoomReset = () => setZoom(1)
  const fitToScreen = () => {
    const container = containerRef.current
    if (!container) return
    const containerWidth = container.clientWidth
    const containerHeight = container.clientHeight
    const scaleX = containerWidth / canvasSettings.width
    const scaleY = containerHeight / canvasSettings.height
    setZoom(Math.min(scaleX, scaleY) * 0.9)
    setPan({ x: 0, y: 0 })
  }
  
  // Pan Controls
  const resetPan = () => setPan({ x: 0, y: 0 })
  const panLeft = () => setPan(prev => ({ ...prev, x: prev.x + 50 }))
  const panRight = () => setPan(prev => ({ ...prev, x: prev.x - 50 }))
  const panUp = () => setPan(prev => ({ ...prev, y: prev.y + 50 }))
  const panDown = () => setPan(prev => ({ ...prev, y: prev.y - 50 }))
  
  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyPress = (e) => {
      // Fullscreen toggle (F key)
      if (e.key === 'f' && !e.ctrlKey && !e.metaKey) {
        e.preventDefault()
        toggleFullscreen()
      }
      // Zoom in (+ or =)
      if ((e.key === '+' || e.key === '=') && !e.ctrlKey) {
        e.preventDefault()
        zoomIn()
      }
      // Zoom out (-)
      if (e.key === '-' && !e.ctrlKey) {
        e.preventDefault()
        zoomOut()
      }
      // Reset zoom (0)
      if (e.key === '0' && !e.ctrlKey) {
        e.preventDefault()
        zoomReset()
      }
      // Fit to screen (F key)
      if (e.key === 'f' && (e.ctrlKey || e.metaKey)) {
        e.preventDefault()
        fitToScreen()
      }
      // Toggle toolbar (T)
      if (e.key === 't' && !e.ctrlKey) {
        e.preventDefault()
        setShowToolbar(prev => !prev)
      }
      // Toggle expert panel (P)
      if (e.key === 'p' && !e.ctrlKey) {
        e.preventDefault()
        setShowExpertPanel(prev => !prev)
      }
      // Arrow keys for pan
      if (e.key === 'ArrowLeft') panLeft()
      if (e.key === 'ArrowRight') panRight()
      if (e.key === 'ArrowUp') panUp()
      if (e.key === 'ArrowDown') panDown()
    }
    
    window.addEventListener('keydown', handleKeyPress)
    return () => window.removeEventListener('keydown', handleKeyPress)
  }, [])
  
  // Handle fullscreen change events
  useEffect(() => {
    const handleFullscreenChange = () => {
      const isCurrentlyFullscreen = !!(document.fullscreenElement || 
                                       document.webkitFullscreenElement || 
                                       document.msFullscreenElement)
      setIsFullscreen(isCurrentlyFullscreen)
      if (!isCurrentlyFullscreen) {
        setCanvasSize({ width: 1400, height: 1000 })
      }
    }
    
    document.addEventListener('fullscreenchange', handleFullscreenChange)
    document.addEventListener('webkitfullscreenchange', handleFullscreenChange)
    document.addEventListener('msfullscreenchange', handleFullscreenChange)
    
    return () => {
      document.removeEventListener('fullscreenchange', handleFullscreenChange)
      document.removeEventListener('webkitfullscreenchange', handleFullscreenChange)
      document.removeEventListener('msfullscreenchange', handleFullscreenChange)
    }
  }, [])
  
  // Handle window resize for responsive canvas
  useEffect(() => {
    const handleResize = () => {
      if (isFullscreen) {
        setCanvasSize({
          width: Math.max(window.innerWidth - 100, 1400),
          height: Math.max(window.innerHeight - 150, 1000)
        })
      }
    }
    
    window.addEventListener('resize', handleResize)
    return () => window.removeEventListener('resize', handleResize)
  }, [isFullscreen])

  useEffect(() => {
    renderPID()
  }, [pidData, zoom, pan, currentStage, flowDirection, layoutStyle, showGrid, showFlowArrows, equipmentPositions, selectedEquipment, pipeRoutes, showPipeLabels, selectedPipe, instrumentPositions, signalRoutes, showInstrumentTags, selectedInstrument, annotations, showProcessData, showEquipmentNotes, showSafetyNotes, selectedAnnotation])

  // Load canvas data from sessionStorage if available (from "Load to Canvas" button)
  useEffect(() => {
    const loadCanvasData = () => {
      const canvasDataStr = sessionStorage.getItem('canvasLoadData');
      if (canvasDataStr) {
        try {
          const canvasData = JSON.parse(canvasDataStr);
          console.log('🎨 Loading P&ID data into canvas:', canvasData);
          
          // Load equipment positions
          if (canvasData.equipment && canvasData.equipment.length > 0) {
            const positions = canvasData.equipment.map(eq => ({
              tag: eq.tag || eq.id,
              type: eq.type,
              x: (eq.position.x / 100) * canvasSettings.width,  // Convert % to pixels
              y: (eq.position.y / 100) * canvasSettings.height,
              size: eq.size || 'medium',
              orientation: eq.orientation || 'vertical',
              draggable: eq.properties?.draggable !== false
            }));
            setEquipmentPositions(positions);
            console.log('✅ Loaded equipment positions:', positions.length);
          }
          
          // Load instrumentation
          if (canvasData.instrumentation && canvasData.instrumentation.length > 0) {
            const positions = canvasData.instrumentation.map(inst => ({
              tag: inst.tag || inst.id,
              type: inst.type,
              function: inst.function || 'indicator',
              x: (inst.position.x / 100) * canvasSettings.width,
              y: (inst.position.y / 100) * canvasSettings.height,
              connected_to: inst.connected_to,
              draggable: inst.properties?.draggable !== false
            }));
            setInstrumentPositions(positions);
            setInstruments(positions);
            console.log('✅ Loaded instruments:', positions.length);
          }
          
          // Load piping routes
          if (canvasData.piping && canvasData.piping.length > 0) {
            const routes = canvasData.piping.map(pipe => ({
              line_number: pipe.line_number || pipe.id,
              from: pipe.from,
              to: pipe.to,
              waypoints: pipe.waypoints.map(wp => ({
                x: (wp.x / 100) * canvasSettings.width,
                y: (wp.y / 100) * canvasSettings.height
              })),
              pipe_size: pipe.size,
              specification: pipe.specification,
              flow_direction: pipe.flow_direction || 'forward'
            }));
            setPipeRoutes(routes);
            console.log('✅ Loaded pipe routes:', routes.length);
          }
          
          // Load annotations
          if (canvasData.annotations && canvasData.annotations.length > 0) {
            const notes = canvasData.annotations.map(ann => ({
              id: ann.id,
              type: ann.type,
              text: ann.text,
              x: (ann.position.x / 100) * canvasSettings.width,
              y: (ann.position.y / 100) * canvasSettings.height,
              related_to: ann.related_to
            }));
            setAnnotations(notes);
            console.log('✅ Loaded annotations:', notes.length);
          }
          
          // Set layout from metadata
          if (canvasData.layout) {
            if (canvasData.layout.flow_direction === 'left-to-right') {
              setFlowDirection('left-to-right');
            } else if (canvasData.layout.flow_direction === 'top-to-bottom') {
              setFlowDirection('top-to-bottom');
            }
          }
          
          // Clear sessionStorage after loading
          sessionStorage.removeItem('canvasLoadData');
          
          // Show success notification
          console.log('✅ Canvas data loaded successfully from AI-generated P&ID!');
          
        } catch (error) {
          console.error('Failed to load canvas data:', error);
        }
      }
    };
    
    loadCanvasData();
  }, []); // Run once on mount

  const currentStageData = DOMAIN_EXPERT_CONFIG.designStages.find(s => s.id === currentStage)

  const toggleChecklistItem = (id) => {
    setChecklist(prev => prev.map(item => 
      item.id === id ? { ...item, checked: !item.checked } : item
    ))
  }
  
  // Stage-specific controls renderer
  const renderStageControls = () => {
    if (currentStage === 'stage1_layout') {
      return (
        <div className="mb-6 bg-gradient-to-br from-blue-50 to-indigo-50 border-2 border-blue-200 rounded-xl p-5">
          <h4 className="font-bold text-gray-900 mb-4 flex items-center gap-2">
            <span>📐</span>
            Stage 1: Layout Controls
          </h4>
          
          <div className="space-y-4">
            {/* Flow Direction */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Flow Direction (ISO 10628)
              </label>
              <div className="flex gap-2">
                <button
                  onClick={() => setFlowDirection('left-to-right')}
                  className={`flex-1 px-4 py-2 rounded-lg border-2 transition-all ${
                    flowDirection === 'left-to-right'
                      ? 'bg-blue-600 text-white border-blue-600'
                      : 'bg-white text-gray-700 border-gray-300 hover:border-blue-400'
                  }`}
                >
                  ← Left to Right →
                </button>
                <button
                  onClick={() => setFlowDirection('top-to-bottom')}
                  className={`flex-1 px-4 py-2 rounded-lg border-2 transition-all ${
                    flowDirection === 'top-to-bottom'
                      ? 'bg-blue-600 text-white border-blue-600'
                      : 'bg-white text-gray-700 border-gray-300 hover:border-blue-400'
                  }`}
                >
                  ↑ Top to Bottom ↓
                </button>
              </div>
              <p className="text-xs text-gray-600 mt-1">
                Industry standard: Left-to-right improves readability
              </p>
            </div>
            
            {/* Equipment Layout - Stage 1 uses layoutStyle for basic arrangement */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Equipment Arrangement
              </label>
              <div className="flex gap-2">
                <button
                  onClick={() => {
                    setLayoutStyle('process-sequence')
                    setFlowDirection('left-to-right')
                  }}
                  className={`flex-1 px-4 py-2 rounded-lg border-2 transition-all ${
                    flowDirection === 'left-to-right' && layoutStyle === 'process-sequence'
                      ? 'bg-indigo-600 text-white border-indigo-600'
                      : 'bg-white text-gray-700 border-gray-300 hover:border-indigo-400'
                  }`}
                >
                  Horizontal
                </button>
                <button
                  onClick={() => {
                    setLayoutStyle('process-sequence')
                    setFlowDirection('top-to-bottom')
                  }}
                  className={`flex-1 px-4 py-2 rounded-lg border-2 transition-all ${
                    flowDirection === 'top-to-bottom' && layoutStyle === 'process-sequence'
                      ? 'bg-indigo-600 text-white border-indigo-600'
                      : 'bg-white text-gray-700 border-gray-300 hover:border-indigo-400'
                  }`}
                >
                  Vertical
                </button>
                <button
                  onClick={() => setLayoutStyle('grid')}
                  className={`flex-1 px-4 py-2 rounded-lg border-2 transition-all ${
                    layoutStyle === 'grid'
                      ? 'bg-indigo-600 text-white border-indigo-600'
                      : 'bg-white text-gray-700 border-gray-300 hover:border-indigo-400'
                  }`}
                >
                  Grid
                </button>
              </div>
            </div>
            
            {/* Visual Aids */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Visual Aids
              </label>
              <div className="space-y-2">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={showGrid}
                    onChange={(e) => setShowGrid(e.target.checked)}
                    className="w-4 h-4 text-blue-600 rounded"
                  />
                  <span className="text-sm text-gray-700">Show Grid</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={showFlowArrows}
                    onChange={(e) => setShowFlowArrows(e.target.checked)}
                    className="w-4 h-4 text-blue-600 rounded"
                  />
                  <span className="text-sm text-gray-700">Show Flow Arrows</span>
                </label>
              </div>
            </div>
            
            {/* Quick Actions */}
            <div className="pt-3 border-t border-blue-200">
              <button
                onClick={() => {
                  setFlowDirection('left-to-right')
                  setLayoutStyle('process-sequence')
                  setShowGrid(true)
                  setShowFlowArrows(true)
                }}
                className="w-full px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors flex items-center justify-center gap-2"
              >
                <span>✨</span>
                Apply ISO 10628 Standards
              </button>
            </div>
          </div>
        </div>
      )
    }
    
    if (currentStage === 'stage2_equipment') {
      return (
        <div className="mb-6 bg-gradient-to-br from-purple-50 to-pink-50 border-2 border-purple-200 rounded-xl p-5">
          <h4 className="font-bold text-gray-900 mb-4 flex items-center gap-2">
            <span>🤖</span>
            Stage 2: AI Equipment Placement
          </h4>
          
          <div className="space-y-4">
            {/* Layout Strategy with AI */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                🧠 AI Layout Strategy
              </label>
              <select
                value={layoutStyle}
                onChange={(e) => setLayoutStyle(e.target.value)}
                className="w-full px-4 py-2 border-2 border-purple-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
              >
                <option value="process-sequence">Process Sequence (Follow Flow)</option>
                <option value="equipment-type">Equipment Type (Group Similar)</option>
                <option value="elevation">Elevation-Based (Physical Layout)</option>
                <option value="grid">Smart Grid (Balanced Distribution)</option>
              </select>
              <p className="text-xs text-gray-600 mt-1">
                {layoutStyle === 'process-sequence' && '✨ Places equipment in process order with smart spacing'}
                {layoutStyle === 'equipment-type' && '✨ Groups pumps, vessels, exchangers for maintenance access'}
                {layoutStyle === 'elevation' && '✨ Respects gravity flow and elevation requirements'}
                {layoutStyle === 'grid' && '✨ Optimal space utilization with collision avoidance'}
              </p>
            </div>
            
            {/* Flow Direction for Auto Mode */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Flow Direction
              </label>
              <select
                value={flowDirection}
                onChange={(e) => setFlowDirection(e.target.value)}
                className="w-full px-4 py-2 border-2 border-purple-300 rounded-lg focus:ring-2 focus:ring-purple-500"
              >
                <option value="auto">🤖 Auto-Detect (AI Decides)</option>
                <option value="left-to-right">→ Left to Right</option>
                <option value="top-to-bottom">↓ Top to Bottom</option>
              </select>
            </div>
            
            {/* Advanced AI Options */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Advanced Intelligence
              </label>
              <div className="space-y-2">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={respectElevation}
                    onChange={(e) => setRespectElevation(e.target.checked)}
                    className="w-4 h-4 text-purple-600 rounded"
                  />
                  <span className="text-sm text-gray-700">Respect Elevation Requirements</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={autoOptimize}
                    onChange={(e) => setAutoOptimize(e.target.checked)}
                    className="w-4 h-4 text-purple-600 rounded"
                  />
                  <span className="text-sm text-gray-700">Auto-Optimize Spacing</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={showGrid}
                    onChange={(e) => setShowGrid(e.target.checked)}
                    className="w-4 h-4 text-purple-600 rounded"
                  />
                  <span className="text-sm text-gray-700">Show Snap Grid</span>
                </label>
              </div>
            </div>
            
            {/* Quick Arrangement Buttons */}
            <div className="pt-3 border-t border-purple-200">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Quick AI Arrangements
              </label>
              <div className="grid grid-cols-2 gap-2">
                <button
                  onClick={() => autoArrangeEquipment('process-sequence')}
                  className="px-3 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-sm"
                  title="Arrange by process flow order"
                >
                  🔄 Process Flow
                </button>
                <button
                  onClick={() => autoArrangeEquipment('equipment-type')}
                  className="px-3 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors text-sm"
                  title="Group similar equipment types"
                >
                  🏭 Group Types
                </button>
                <button
                  onClick={() => autoArrangeEquipment('elevation')}
                  className="px-3 py-2 bg-orange-600 text-white rounded-lg hover:bg-orange-700 transition-colors text-sm"
                  title="Arrange by elevation/height"
                >
                  📏 By Elevation
                </button>
                <button
                  onClick={() => autoArrangeEquipment('grid')}
                  className="px-3 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors text-sm"
                  title="Optimal grid distribution"
                >
                  🎯 Smart Grid
                </button>
              </div>
            </div>
            
            {/* AI Status */}
            <div className="bg-purple-100 border border-purple-300 rounded-lg p-3">
              <div className="flex items-start gap-2">
                <span className="text-purple-600 text-lg">💡</span>
                <div>
                  <p className="text-xs font-medium text-purple-800">AI Placement Active</p>
                  <p className="text-xs text-purple-700 mt-1">
                    Using {layoutStyle.replace('-', ' ')} strategy with {autoOptimize ? 'optimization enabled' : 'manual control'}
                  </p>
                </div>
              </div>
            </div>
            
            {/* Expert Tips */}
            <div className="bg-gradient-to-r from-amber-50 to-yellow-50 border border-amber-200 rounded-lg p-3">
              <div className="flex items-start gap-2">
                <span className="text-amber-600 text-lg">👨‍🔬</span>
                <div>
                  <p className="text-xs font-semibold text-amber-900">Expert Tip:</p>
                  <p className="text-xs text-amber-800 mt-1">
                    {layoutStyle === 'process-sequence' && 'Process sequence layout improves operator understanding and reduces piping complexity.'}
                    {layoutStyle === 'equipment-type' && 'Grouping similar equipment simplifies maintenance planning and spare parts management.'}
                    {layoutStyle === 'elevation' && 'Elevation-based layout ensures proper gravity flow and reduces pumping requirements.'}
                    {layoutStyle === 'grid' && 'Grid layout maximizes space efficiency and provides clear access routes for operations.'}
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      )
    }
    
    if (currentStage === 'stage3_piping') {
      return (
        <div className="mb-6 bg-gradient-to-br from-green-50 to-emerald-50 border-2 border-green-200 rounded-xl p-5">
          <h4 className="font-bold text-gray-900 mb-4 flex items-center gap-2">
            <span>🔧</span>
            Stage 3: AI Piping & Connections
          </h4>
          
          <div className="space-y-4">
            {/* Routing Strategy */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                🛣️ AI Routing Strategy
              </label>
              <select
                value={routingStrategy}
                onChange={(e) => setRoutingStrategy(e.target.value)}
                className="w-full px-4 py-2 border-2 border-green-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
              >
                <option value="manhattan">Manhattan (L-shaped, Industrial Standard)</option>
                <option value="orthogonal">Orthogonal (90° Angles Only)</option>
                <option value="direct">Direct (Straight Lines)</option>
                <option value="smart">Smart (A* Pathfinding)</option>
              </select>
              <p className="text-xs text-gray-600 mt-1">
                {routingStrategy === 'manhattan' && '✨ Industry standard L-shaped routing with minimal bends'}
                {routingStrategy === 'orthogonal' && '✨ Professional 90-degree routing avoiding obstacles'}
                {routingStrategy === 'direct' && '✨ Simplest routing for close equipment'}
                {routingStrategy === 'smart' && '✨ AI finds optimal path avoiding all obstacles'}
              </p>
            </div>
            
            {/* Piping Options */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Advanced Routing Options
              </label>
              <div className="space-y-2">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={avoidCrossings}
                    onChange={(e) => setAvoidCrossings(e.target.checked)}
                    className="w-4 h-4 text-green-600 rounded"
                  />
                  <span className="text-sm text-gray-700">Avoid Pipe Crossings</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={showPipeLabels}
                    onChange={(e) => setShowPipeLabels(e.target.checked)}
                    className="w-4 h-4 text-green-600 rounded"
                  />
                  <span className="text-sm text-gray-700">Show Pipe Labels</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={showFlowArrows}
                    onChange={(e) => setShowFlowArrows(e.target.checked)}
                    className="w-4 h-4 text-green-600 rounded"
                  />
                  <span className="text-sm text-gray-700">Show Flow Arrows</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={autoGenerateConnections}
                    onChange={(e) => setAutoGenerateConnections(e.target.checked)}
                    className="w-4 h-4 text-green-600 rounded"
                  />
                  <span className="text-sm text-gray-700">Auto-Generate Connections</span>
                </label>
              </div>
            </div>
            
            {/* Quick Routing Buttons */}
            <div className="pt-3 border-t border-green-200">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Quick AI Routing
              </label>
              <div className="grid grid-cols-2 gap-2">
                <button
                  onClick={() => autoRoutePipes('manhattan')}
                  className="px-3 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-sm"
                  title="Standard L-shaped industrial routing"
                >
                  📐 Manhattan
                </button>
                <button
                  onClick={() => autoRoutePipes('orthogonal')}
                  className="px-3 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors text-sm"
                  title="90-degree routing with obstacle avoidance"
                >
                  ⟂ Orthogonal
                </button>
                <button
                  onClick={() => autoRoutePipes('direct')}
                  className="px-3 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors text-sm"
                  title="Direct straight-line connections"
                >
                  ➡️ Direct
                </button>
                <button
                  onClick={() => autoRoutePipes('smart')}
                  className="px-3 py-2 bg-orange-600 text-white rounded-lg hover:bg-orange-700 transition-colors text-sm"
                  title="AI pathfinding for optimal routes"
                >
                  🧠 Smart A*
                </button>
              </div>
            </div>
            
            {/* Connection Stats */}
            <div className="bg-green-100 border border-green-300 rounded-lg p-3">
              <div className="flex items-start gap-2">
                <span className="text-green-600 text-lg">📊</span>
                <div>
                  <p className="text-xs font-medium text-green-800">Routing Statistics</p>
                  <p className="text-xs text-green-700 mt-1">
                    {pipeRoutes.length} pipes routed using {routingStrategy} strategy
                    {connections.length > 0 && ` • ${connections.length} connections defined`}
                  </p>
                </div>
              </div>
            </div>
            
            {/* Expert Tips */}
            <div className="bg-gradient-to-r from-amber-50 to-yellow-50 border border-amber-200 rounded-lg p-3">
              <div className="flex items-start gap-2">
                <span className="text-amber-600 text-lg">👨‍🔬</span>
                <div>
                  <p className="text-xs font-semibold text-amber-900">Expert Tip:</p>
                  <p className="text-xs text-amber-800 mt-1">
                    {routingStrategy === 'manhattan' && 'Manhattan routing is industry standard - minimizes pipe fittings and simplifies fabrication.'}
                    {routingStrategy === 'orthogonal' && 'Orthogonal routing ensures all pipes follow 90-degree angles, ideal for isometric drawings.'}
                    {routingStrategy === 'direct' && 'Direct routing minimizes pipe length but may conflict with equipment access. Best for close connections.'}
                    {routingStrategy === 'smart' && 'Smart A* routing finds the optimal path considering all obstacles - best for complex layouts.'}
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      )
    }
    
    if (currentStage === 'stage4_instrumentation') {
      return (
        <div className="mb-6 bg-gradient-to-br from-indigo-50 to-blue-50 border-2 border-indigo-200 rounded-xl p-5">
          <h4 className="font-bold text-gray-900 mb-4 flex items-center gap-2">
            <span>📡</span>
            Stage 4: AI Instrumentation & Control
          </h4>
          
          <div className="space-y-4">
            {/* Placement Strategy */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                🎯 AI Placement Strategy
              </label>
              <select
                value={placementStrategy}
                onChange={(e) => setPlacementStrategy(e.target.value)}
                className="w-full px-4 py-2 border-2 border-indigo-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
              >
                <option value="auto">Auto (Smart Detection)</option>
                <option value="by-equipment">By Equipment</option>
                <option value="by-function">By Function Type</option>
                <option value="by-loop">By Control Loop</option>
              </select>
              <p className="text-xs text-gray-600 mt-1">
                {placementStrategy === 'auto' && '✨ AI places instruments based on type: field, panel, or DCS mounted'}
                {placementStrategy === 'by-equipment' && '✨ Groups instruments around their associated equipment'}
                {placementStrategy === 'by-function' && '✨ Organizes by transmitters, controllers, indicators, valves'}
                {placementStrategy === 'by-loop' && '✨ Arranges instruments by control loop identification'}
              </p>
            </div>
            
            {/* Instrumentation Options */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Display Options
              </label>
              <div className="space-y-2">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={showInstrumentTags}
                    onChange={(e) => setShowInstrumentTags(e.target.checked)}
                    className="w-4 h-4 text-indigo-600 rounded"
                  />
                  <span className="text-sm text-gray-700">Show Instrument Tags</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={showControlLoops}
                    onChange={(e) => setShowControlLoops(e.target.checked)}
                    className="w-4 h-4 text-indigo-600 rounded"
                  />
                  <span className="text-sm text-gray-700">Identify Control Loops</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={autoGenerateInstruments}
                    onChange={(e) => setAutoGenerateInstruments(e.target.checked)}
                    className="w-4 h-4 text-indigo-600 rounded"
                  />
                  <span className="text-sm text-gray-700">Auto-Generate Instruments</span>
                </label>
              </div>
            </div>
            
            {/* Quick Placement Buttons */}
            <div className="pt-3 border-t border-indigo-200">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Quick AI Placement
              </label>
              <div className="grid grid-cols-2 gap-2">
                <button
                  onClick={() => autoPlaceInstruments('auto')}
                  className="px-3 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-sm"
                  title="Smart auto-placement by type"
                >
                  🤖 Smart Auto
                </button>
                <button
                  onClick={() => autoPlaceInstruments('by-equipment')}
                  className="px-3 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors text-sm"
                  title="Group by equipment"
                >
                  🏭 By Equipment
                </button>
                <button
                  onClick={() => autoPlaceInstruments('by-function')}
                  className="px-3 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors text-sm"
                  title="Organize by function"
                >
                  ⚙️ By Function
                </button>
                <button
                  onClick={() => autoPlaceInstruments('by-loop')}
                  className="px-3 py-2 bg-orange-600 text-white rounded-lg hover:bg-orange-700 transition-colors text-sm"
                  title="Arrange by control loops"
                >
                  🔄 By Loop
                </button>
              </div>
            </div>
            
            {/* ISA-5.1 Standards */}
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
              <div className="flex items-start gap-2">
                <span className="text-blue-600 text-lg">📋</span>
                <div>
                  <p className="text-xs font-medium text-blue-800">ISA-5.1 Compliant</p>
                  <p className="text-xs text-blue-700 mt-1">
                    • Field Mounted: Solid circle<br />
                    • Panel Mounted: Circle on line<br />
                    • DCS/Computer: Square symbol<br />
                    • Tag format: XX-###
                  </p>
                </div>
              </div>
            </div>
            
            {/* Instrumentation Stats */}
            <div className="bg-indigo-100 border border-indigo-300 rounded-lg p-3">
              <div className="flex items-start gap-2">
                <span className="text-indigo-600 text-lg">📊</span>
                <div>
                  <p className="text-xs font-medium text-indigo-800">Instrumentation Statistics</p>
                  <p className="text-xs text-indigo-700 mt-1">
                    {instrumentPositions.length} instruments placed using {placementStrategy} strategy
                    {signalRoutes.length > 0 && ` • ${signalRoutes.length} signal lines routed`}
                  </p>
                </div>
              </div>
            </div>
            
            {/* Expert Tips */}
            <div className="bg-gradient-to-r from-amber-50 to-yellow-50 border border-amber-200 rounded-lg p-3">
              <div className="flex items-start gap-2">
                <span className="text-amber-600 text-lg">👨‍🔬</span>
                <div>
                  <p className="text-xs font-semibold text-amber-900">Expert Tip:</p>
                  <p className="text-xs text-amber-800 mt-1">
                    {placementStrategy === 'auto' && 'Auto placement follows ISA-5.1: transmitters near equipment, controllers in control room, indicators at operator stations.'}
                    {placementStrategy === 'by-equipment' && 'Grouping by equipment improves maintainability - all instruments for one unit are together.'}
                    {placementStrategy === 'by-function' && 'Function-based layout simplifies troubleshooting - find all transmitters or all controllers quickly.'}
                    {placementStrategy === 'by-loop' && 'Loop-based arrangement shows control system architecture - essential for control system engineers.'}
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      )
    }
    
    if (currentStage === 'stage5_annotations') {
      return (
        <div className="mb-6 bg-gradient-to-br from-green-50 to-teal-50 border-2 border-green-200 rounded-xl p-5">
          <h4 className="font-bold text-gray-900 mb-4 flex items-center gap-2">
            <span>📝</span>
            Stage 5: AI Annotation & Documentation
          </h4>
          
          <div className="space-y-4">
            {/* Annotation Types */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Display Annotations
              </label>
              <div className="space-y-2">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={showProcessData}
                    onChange={(e) => setShowProcessData(e.target.checked)}
                    className="w-4 h-4 text-green-600 rounded"
                  />
                  <span className="text-sm text-gray-700">Process Data (Flow, P, T)</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={showEquipmentNotes}
                    onChange={(e) => setShowEquipmentNotes(e.target.checked)}
                    className="w-4 h-4 text-green-600 rounded"
                  />
                  <span className="text-sm text-gray-700">Equipment Tags & Notes</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={showSafetyNotes}
                    onChange={(e) => setShowSafetyNotes(e.target.checked)}
                    className="w-4 h-4 text-green-600 rounded"
                  />
                  <span className="text-sm text-gray-700">Safety Notes & Warnings</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={showDesignBasis}
                    onChange={(e) => setShowDesignBasis(e.target.checked)}
                    className="w-4 h-4 text-green-600 rounded"
                  />
                  <span className="text-sm text-gray-700">Design Basis</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={showCallouts}
                    onChange={(e) => setShowCallouts(e.target.checked)}
                    className="w-4 h-4 text-green-600 rounded"
                  />
                  <span className="text-sm text-gray-700">Callouts & Dimensions</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={autoGenerateAnnotations}
                    onChange={(e) => setAutoGenerateAnnotations(e.target.checked)}
                    className="w-4 h-4 text-green-600 rounded"
                  />
                  <span className="text-sm text-gray-700 font-semibold">Auto-Generate All</span>
                </label>
              </div>
            </div>
            
            {/* Quick Generation Buttons */}
            <div className="pt-3 border-t border-green-200">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Quick AI Generation
              </label>
              <div className="grid grid-cols-2 gap-2">
                <button
                  onClick={() => autoGenerateAnnotationType('process_data')}
                  className="px-3 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-sm"
                  title="Generate process data annotations"
                >
                  📊 Process Data
                </button>
                <button
                  onClick={() => autoGenerateAnnotationType('equipment')}
                  className="px-3 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors text-sm"
                  title="Generate equipment annotations"
                >
                  🏭 Equipment
                </button>
                <button
                  onClick={() => autoGenerateAnnotationType('safety')}
                  className="px-3 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors text-sm"
                  title="Generate safety annotations"
                >
                  ⚠️ Safety
                </button>
                <button
                  onClick={() => setAnnotations([])}
                  className="px-3 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition-colors text-sm"
                  title="Clear all annotations"
                >
                  🗑️ Clear All
                </button>
              </div>
            </div>
            
            {/* Annotation Standards */}
            <div className="bg-green-50 border border-green-200 rounded-lg p-3">
              <div className="flex items-start gap-2">
                <span className="text-green-600 text-lg">📋</span>
                <div>
                  <p className="text-xs font-medium text-green-800">Industry Standards</p>
                  <p className="text-xs text-green-700 mt-1">
                    • Process data: Flow rates, pressures, temperatures<br />
                    • Safety: ASME pressure ratings, relief valve settings<br />
                    • Equipment: Tags, specifications, design notes<br />
                    • Smart placement with overlap avoidance
                  </p>
                </div>
              </div>
            </div>
            
            {/* Annotation Stats */}
            <div className="bg-teal-100 border border-teal-300 rounded-lg p-3">
              <div className="flex items-start gap-2">
                <span className="text-teal-600 text-lg">📊</span>
                <div>
                  <p className="text-xs font-medium text-teal-800">Annotation Statistics</p>
                  <p className="text-xs text-teal-700 mt-1">
                    {annotations.length} annotations placed
                    {annotations.filter(a => a.type === 'safety').length > 0 && ` • ${annotations.filter(a => a.type === 'safety').length} safety notes`}
                    {annotations.filter(a => a.type === 'process_data').length > 0 && ` • ${annotations.filter(a => a.type === 'process_data').length} process data`}
                  </p>
                </div>
              </div>
            </div>
            
            {/* Expert Tips */}
            <div className="bg-gradient-to-r from-amber-50 to-yellow-50 border border-amber-200 rounded-lg p-3">
              <div className="flex items-start gap-2">
                <span className="text-amber-600 text-lg">👨‍🔬</span>
                <div>
                  <p className="text-xs font-semibold text-amber-900">Expert Tip:</p>
                  <p className="text-xs text-amber-800 mt-1">
                    Complete annotations ensure P&ID clarity and compliance. Include process data for operations, 
                    safety notes for hazard mitigation, and design basis for engineering justification. 
                    Smart placement avoids overlaps while maintaining readability.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      )
    }
    
    // Add controls for other stages here
    return null
  }

  return (
    <div ref={containerRef} className={`flex h-screen bg-gray-50 ${isFullscreen ? 'fixed inset-0 z-50' : ''}`}>
      {/* Expert Recommendations Panel */}
      {showExpertPanel && (
        <div className={`${isFullscreen ? 'absolute left-0 top-0 bottom-0 z-10 shadow-2xl' : ''} w-96 bg-white border-r border-gray-200 overflow-y-auto`}>
          <div className="p-6">
            {/* Expert Profile */}
            <div className="bg-gradient-to-r from-blue-600 to-indigo-600 rounded-xl p-4 text-white mb-6">
              <div className="flex items-center gap-3 mb-2">
                <span className="text-4xl">{DOMAIN_EXPERT_CONFIG.expert.avatar}</span>
                <div>
                  <h3 className="font-bold">{DOMAIN_EXPERT_CONFIG.expert.name}</h3>
                  <p className="text-xs text-blue-100">{DOMAIN_EXPERT_CONFIG.expert.credentials}</p>
                </div>
              </div>
              <p className="text-sm text-blue-100">{DOMAIN_EXPERT_CONFIG.expert.specialization}</p>
            </div>

            {/* Design Stages */}
            <div className="mb-6">
              <h4 className="font-bold text-gray-900 mb-3">Design Stages</h4>
              <div className="space-y-2">
                {DOMAIN_EXPERT_CONFIG.designStages.map(stage => (
                  <button
                    key={stage.id}
                    onClick={() => setCurrentStage(stage.id)}
                    className={`w-full text-left p-3 rounded-lg transition-all ${
                      currentStage === stage.id
                        ? 'bg-blue-100 border-2 border-blue-500'
                        : 'bg-gray-50 border-2 border-transparent hover:bg-gray-100'
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      <span className="text-2xl">{stage.icon}</span>
                      <div className="flex-1">
                        <div className="font-medium text-gray-900 text-sm">{stage.name}</div>
                        <div className="text-xs text-gray-600">{stage.description}</div>
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            </div>
            
            {/* Stage-Specific Controls */}
            {renderStageControls()}

            {/* Current Stage Recommendations */}
            {currentStageData && (
              <div className="mb-6">
                <h4 className="font-bold text-gray-900 mb-3 flex items-center gap-2">
                  <span>{currentStageData.icon}</span>
                  Expert Recommendations
                </h4>
                <div className="space-y-4">
                  {currentStageData.expertRecommendations.map(rec => (
                    <div
                      key={rec.id}
                      className={`border-l-4 p-4 rounded-r-lg ${
                        rec.priority === 'critical' ? 'border-red-500 bg-red-50' :
                        rec.priority === 'high' ? 'border-orange-500 bg-orange-50' :
                        'border-blue-500 bg-blue-50'
                      }`}
                    >
                      <div className="flex items-start justify-between mb-2">
                        <h5 className="font-bold text-gray-900 text-sm">{rec.title}</h5>
                        <span className={`px-2 py-1 rounded text-xs font-medium ${
                          rec.priority === 'critical' ? 'bg-red-200 text-red-800' :
                          rec.priority === 'high' ? 'bg-orange-200 text-orange-800' :
                          'bg-blue-200 text-blue-800'
                        }`}>
                          {rec.priority}
                        </span>
                      </div>
                      <p className="text-sm text-gray-700 mb-2">{rec.recommendation}</p>
                      <p className="text-xs text-gray-600 italic mb-2">{rec.rationale}</p>
                      {rec.examples && (
                        <div className="text-xs text-gray-700">
                          <div className="font-medium mb-1">Examples:</div>
                          <ul className="list-disc list-inside space-y-1">
                            {rec.examples.map((ex, i) => (
                              <li key={i}>{ex}</li>
                            ))}
                          </ul>
                        </div>
                      )}
                      {rec.standards && (
                        <div className="mt-2 flex flex-wrap gap-1">
                          {rec.standards.map((std, i) => (
                            <span key={i} className="px-2 py-0.5 bg-gray-200 text-gray-700 rounded text-xs">
                              {std}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Quality Checklist */}
            <div>
              <h4 className="font-bold text-gray-900 mb-3 flex items-center gap-2">
                <span>✅</span>
                Quality Checklist
              </h4>
              <div className="space-y-2">
                {checklist.map(item => (
                  <label
                    key={item.id}
                    className="flex items-start gap-2 p-2 rounded hover:bg-gray-50 cursor-pointer"
                  >
                    <input
                      type="checkbox"
                      checked={item.checked}
                      onChange={() => toggleChecklistItem(item.id)}
                      className="mt-1"
                    />
                    <span className="text-sm text-gray-700">{item.item}</span>
                  </label>
                ))}
              </div>
              <div className="mt-4 p-3 bg-green-50 border border-green-200 rounded-lg">
                <div className="text-sm font-medium text-green-800">
                  Completion: {checklist.filter(i => i.checked).length} / {checklist.length}
                </div>
                <div className="w-full bg-green-200 rounded-full h-2 mt-2">
                  <div
                    className="bg-green-600 h-2 rounded-full transition-all"
                    style={{ width: `${(checklist.filter(i => i.checked).length / checklist.length) * 100}%` }}
                  ></div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Canvas Area */}
      <div className="flex-1 flex flex-col relative">
        {/* Enhanced Toolbar */}
        <div className={`bg-white border-b border-gray-200 p-4 flex items-center justify-between ${isFullscreen ? 'bg-opacity-95 backdrop-blur relative z-[100]' : ''}`}>
          <div className="flex items-center gap-4">
            {!isFullscreen && (
              <button
                onClick={() => setShowExpertPanel(!showExpertPanel)}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors flex items-center gap-2"
                title="Toggle Expert Panel (P)"
              >
                <span>{showExpertPanel ? '👨‍🔬 Hide' : '👨‍🔬 Show'} Expert</span>
              </button>
            )}
            
            {/* Zoom Controls */}
            <div className="flex items-center gap-2 bg-gray-50 rounded-lg px-3 py-1">
              <button
                onClick={zoomOut}
                className="px-3 py-1 bg-white border border-gray-300 rounded hover:bg-gray-100 transition-colors"
                title="Zoom Out (-)"
              >
                <span className="text-lg">−</span>
              </button>
              <span className="text-sm font-medium min-w-[60px] text-center">{Math.round(zoom * 100)}%</span>
              <button
                onClick={zoomIn}
                className="px-3 py-1 bg-white border border-gray-300 rounded hover:bg-gray-100 transition-colors"
                title="Zoom In (+)"
              >
                <span className="text-lg">+</span>
              </button>
              <button
                onClick={zoomReset}
                className="px-3 py-1 bg-white border border-gray-300 rounded hover:bg-gray-100 text-sm transition-colors"
                title="Reset Zoom (0)"
              >
                100%
              </button>
              <button
                onClick={fitToScreen}
                className="px-3 py-1 bg-white border border-gray-300 rounded hover:bg-gray-100 text-sm transition-colors"
                title="Fit to Screen (Ctrl+F)"
              >
                📐 Fit
              </button>
            </div>
            
            {/* Pan Controls */}
            <div className="flex items-center gap-1 bg-gray-50 rounded-lg px-2 py-1">
              <button onClick={panUp} className="p-1 hover:bg-gray-200 rounded" title="Pan Up">⬆️</button>
              <div className="flex flex-col gap-1">
                <button onClick={panLeft} className="p-1 hover:bg-gray-200 rounded" title="Pan Left">⬅️</button>
                <button onClick={resetPan} className="p-1 hover:bg-gray-200 rounded text-xs" title="Reset Pan">⚫</button>
                <button onClick={panRight} className="p-1 hover:bg-gray-200 rounded" title="Pan Right">➡️</button>
              </div>
              <button onClick={panDown} className="p-1 hover:bg-gray-200 rounded" title="Pan Down">⬇️</button>
            </div>
            
            {/* Fullscreen Toggle */}
            <button
              onClick={toggleFullscreen}
              className={`px-4 py-2 ${isFullscreen ? 'bg-red-600 hover:bg-red-700' : 'bg-indigo-600 hover:bg-indigo-700'} text-white rounded-lg transition-colors flex items-center gap-2`}
              title={isFullscreen ? 'Exit Fullscreen (F or Esc)' : 'Enter Fullscreen (F)'}
            >
              {isFullscreen ? (
                <>
                  <span>🗗</span>
                  <span>Exit Fullscreen</span>
                </>
              ) : (
                <>
                  <span>⛶</span>
                  <span>Fullscreen</span>
                </>
              )}
            </button>
          </div>

          <div className="flex items-center gap-2">
            {/* Integration/Export Dropdown */}
            <div className="relative">
              <button
                onClick={() => setShowIntegrationPanel(!showIntegrationPanel)}
                className="px-4 py-2 bg-gradient-to-r from-cyan-600 to-blue-600 text-white rounded-lg hover:from-cyan-700 hover:to-blue-700 transition-colors flex items-center gap-2 shadow-md"
                title="Export to Third-Party Software"
              >
                <span>🔗</span>
                <span>Integrate</span>
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
              </button>
              
              {/* Integration Panel */}
              {showIntegrationPanel && (
                <div className="absolute right-0 top-full mt-2 w-96 bg-white rounded-xl shadow-2xl border-2 border-gray-200 max-h-96 overflow-y-auto" style={{ zIndex: 9999 }}>
                  <div className="p-4 border-b border-gray-200 bg-gradient-to-r from-cyan-50 to-blue-50">
                    <div className="flex items-center justify-between">
                      <h3 className="font-bold text-gray-900">Third-Party Integration</h3>
                      <button
                        onClick={() => setShowIntegrationPanel(false)}
                        className="text-gray-500 hover:text-gray-700"
                      >
                        ✕
                      </button>
                    </div>
                    <p className="text-xs text-gray-600 mt-1">Export P&ID to industry software</p>
                  </div>
                  
                  <div className="p-4 space-y-2">
                    {getAvailableIntegrations().map(integration => (
                      <button
                        key={integration.id}
                        onClick={() => exportToIntegration(integration.id)}
                        disabled={exportProgress?.format === integration.id}
                        className={`w-full p-3 rounded-lg border-2 transition-all text-left ${
                          exportProgress?.format === integration.id
                            ? 'border-blue-500 bg-blue-50'
                            : 'border-gray-200 hover:border-blue-300 hover:bg-blue-50'
                        }`}
                      >
                        <div className="flex items-start gap-3">
                          <span className="text-2xl">{integration.icon}</span>
                          <div className="flex-1">
                            <div className="flex items-center justify-between">
                              <div className="font-semibold text-gray-900">{integration.name}</div>
                              {integration.popularity === 'high' && (
                                <span className="px-2 py-0.5 bg-green-100 text-green-800 text-xs rounded-full">
                                  Popular
                                </span>
                              )}
                            </div>
                            <div className="text-xs text-gray-600 mt-1">{integration.description}</div>
                            <div className="flex flex-wrap gap-1 mt-2">
                              {integration.features.slice(0, 3).map(feature => (
                                <span key={feature} className="px-2 py-0.5 bg-gray-100 text-gray-700 text-xs rounded">
                                  {feature}
                                </span>
                              ))}
                            </div>
                            {exportProgress?.format === integration.id && (
                              <div className="mt-2 text-xs font-medium text-blue-600">
                                {exportProgress.status === 'preparing' && '⏳ Preparing...'}
                                {exportProgress.status === 'exporting' && '📤 Exporting...'}
                                {exportProgress.status === 'complete' && '✅ Complete!'}
                              </div>
                            )}
                          </div>
                        </div>
                      </button>
                    ))}
                  </div>
                  
                  <div className="p-4 bg-gray-50 border-t border-gray-200">
                    <div className="text-xs text-gray-600">
                      <strong>💡 Tip:</strong> Choose based on your workflow:
                      <ul className="mt-1 ml-4 space-y-1">
                        <li>• <strong>AutoCAD</strong> for detailed 2D drawings</li>
                        <li>• <strong>Aspen</strong> for process simulation</li>
                        <li>• <strong>Excel</strong> for equipment/line lists</li>
                        <li>• <strong>JSON/XML</strong> for custom integration</li>
                      </ul>
                    </div>
                  </div>
                </div>
              )}
            </div>
            
            <button
              onClick={exportToPNG}
              className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors flex items-center gap-2"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
              </svg>
              PNG
            </button>
          </div>
        </div>

        {/* Canvas */}
        <div className="flex-1 overflow-hidden bg-gray-100 relative">
          <canvas
            ref={canvasRef}
            width={canvasSettings.width}
            height={canvasSettings.height}
            onMouseDown={handleMouseDown}
            onMouseMove={handleMouseMove}
            onMouseUp={handleMouseUp}
            onMouseLeave={handleMouseUp}
            onWheel={handleWheel}
            className={
              isDraggingEquipment 
                ? "cursor-grabbing" 
                : currentStage === 'stage2_equipment' 
                  ? "cursor-pointer" 
                  : "cursor-move"
            }
            style={{
              position: 'absolute',
              top: '50%',
              left: '50%',
              transform: 'translate(-50%, -50%)'
            }}
          />
          
          {/* Help overlay */}
          <div className="absolute bottom-4 left-4 bg-white bg-opacity-90 backdrop-blur rounded-lg p-3 text-xs space-y-1 shadow-lg">
            <div><strong>🎮 Controls:</strong></div>
            <div>• <kbd className="px-1 bg-gray-200 rounded">Mouse Drag</kbd> Pan canvas</div>
            <div>• <kbd className="px-1 bg-gray-200 rounded">Scroll</kbd> Zoom in/out</div>
            <div>• <kbd className="px-1 bg-gray-200 rounded">F</kbd> Fullscreen toggle</div>
            <div>• <kbd className="px-1 bg-gray-200 rounded">+/-</kbd> Zoom controls</div>
            <div>• <kbd className="px-1 bg-gray-200 rounded">0</kbd> Reset zoom</div>
            <div>• <kbd className="px-1 bg-gray-200 rounded">Arrows</kbd> Pan direction</div>
            <div>• <kbd className="px-1 bg-gray-200 rounded">P</kbd> Toggle expert panel</div>
            {currentStage === 'stage2_equipment' && (
              <div className="text-purple-600 font-semibold mt-2">• Click & drag equipment to reposition</div>
            )}
            <div>• Click stages for expert guidance</div>
          </div>
          
          {/* Equipment info overlay */}
          {currentStage === 'stage2_equipment' && selectedEquipment >= 0 && equipmentPositions[selectedEquipment] && (
            <div className="absolute top-4 right-4 bg-white bg-opacity-95 backdrop-blur rounded-lg p-4 shadow-lg max-w-sm">
              <h4 className="font-bold text-gray-900 mb-2">Selected Equipment</h4>
              <div className="space-y-1 text-xs">
                <div><strong>Tag:</strong> {equipmentPositions[selectedEquipment].tag_number}</div>
                <div><strong>Type:</strong> {equipmentPositions[selectedEquipment].equipment_type}</div>
                <div><strong>Description:</strong> {equipmentPositions[selectedEquipment].description}</div>
                <div className="pt-2 border-t border-gray-200">
                  <strong>Position:</strong> X: {Math.round(equipmentPositions[selectedEquipment].x)}, Y: {Math.round(equipmentPositions[selectedEquipment].y)}
                </div>
              </div>
              <button
                onClick={() => setSelectedEquipment(-1)}
                className="mt-3 w-full px-3 py-1 bg-gray-100 hover:bg-gray-200 rounded text-xs"
              >
                Clear Selection
              </button>
            </div>
          )}
          
          {/* Fullscreen Floating Stage Selector */}
          {isFullscreen && (
            <div className="absolute top-4 left-4 bg-white bg-opacity-95 backdrop-blur rounded-xl shadow-2xl p-4 max-w-xs">
              <div className="flex items-center justify-between mb-3">
                <h4 className="font-bold text-gray-900">Design Stages</h4>
                <button
                  onClick={() => setShowExpertPanel(true)}
                  className="text-xs px-2 py-1 bg-blue-50 text-blue-600 rounded hover:bg-blue-100"
                  title="Show Expert Panel (P)"
                >
                  📚 Guide
                </button>
              </div>
              <div className="space-y-2 max-h-96 overflow-y-auto">
                {DOMAIN_EXPERT_CONFIG.designStages.map(stage => (
                  <button
                    key={stage.id}
                    onClick={() => setCurrentStage(stage.id)}
                    className={`w-full text-left p-2 rounded-lg transition-all ${
                      currentStage === stage.id
                        ? 'bg-blue-600 text-white shadow-md'
                        : 'bg-gray-50 hover:bg-gray-100 text-gray-900'
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      <span className="text-lg">{stage.icon}</span>
                      <div className="flex-1">
                        <div className="text-xs font-medium">{stage.name}</div>
                      </div>
                    </div>
                  </button>
                ))}
              </div>
              
              {/* Current Stage Quick Controls */}
              {currentStage === 'stage3_piping' && (
                <div className="mt-3 pt-3 border-t border-gray-200">
                  <div className="text-xs font-medium text-gray-700 mb-2">Quick Actions</div>
                  <div className="grid grid-cols-2 gap-1">
                    <button onClick={() => autoRoutePipes('manhattan')} className="text-xs px-2 py-1 bg-blue-50 hover:bg-blue-100 rounded">Manhattan</button>
                    <button onClick={() => autoRoutePipes('smart')} className="text-xs px-2 py-1 bg-green-50 hover:bg-green-100 rounded">Smart</button>
                  </div>
                </div>
              )}
              
              {currentStage === 'stage4_instrumentation' && (
                <div className="mt-3 pt-3 border-t border-gray-200">
                  <div className="text-xs font-medium text-gray-700 mb-2">Quick Actions</div>
                  <div className="grid grid-cols-2 gap-1">
                    <button onClick={() => autoPlaceInstruments('auto')} className="text-xs px-2 py-1 bg-blue-50 hover:bg-blue-100 rounded">Auto Place</button>
                    <button onClick={() => setAutoGenerateInstruments(!autoGenerateInstruments)} className="text-xs px-2 py-1 bg-purple-50 hover:bg-purple-100 rounded">
                      {autoGenerateInstruments ? '✓ Auto Gen' : 'Auto Gen'}
                    </button>
                  </div>
                </div>
              )}
              
              {currentStage === 'stage5_annotations' && (
                <div className="mt-3 pt-3 border-t border-gray-200">
                  <div className="text-xs font-medium text-gray-700 mb-2">Quick Actions</div>
                  <div className="grid grid-cols-2 gap-1">
                    <button onClick={() => autoGenerateAnnotationType('process_data')} className="text-xs px-2 py-1 bg-blue-50 hover:bg-blue-100 rounded">📊 Data</button>
                    <button onClick={() => autoGenerateAnnotationType('safety')} className="text-xs px-2 py-1 bg-red-50 hover:bg-red-100 rounded">⚠️ Safety</button>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

export default PID2DGenerator
