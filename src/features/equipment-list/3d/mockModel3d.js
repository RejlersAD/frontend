/**
 * Mock 3D model data + simulated async API.
 * Used until the backend endpoints exist:
 *   GET  /api/engineering/process/equipment-list/:registerId/model3d
 *   POST /api/engineering/process/equipment-list/:registerId/model3d/refresh
 *   GET  /api/engineering/process/equipment-list/:registerId/model3d/jobs/:id
 *   POST /api/engineering/process/equipment-list/:registerId/plot-plan
 *   GET  /api/engineering/process/equipment-list/:registerId/model3d/export?format=glb|ifc
 */

export const MOCK_EQUIPMENT = [
  {
    tag: "2600-C-001",
    unit: "2600",
    typeCode: "C",
    description: "Crude distillation column",
    status: "validated",
    confidence: 0.97,
    sourceSheet: { dwgNo: "00523-2600-PRP-D-162", clientDwgNo: "2600-PID-001", rev: "C01", page: 15 },
    systems: ["SYS-100", "SYS-210"],
    dims: { diameter: 3.0, height: 30.0 },
  },
  ...["A", "B", "C", "D"].map((suffix, i) => ({
    tag: `2600-EA-001${suffix}`,
    unit: "2600",
    typeCode: "EA",
    description: `Fin-fan air cooler bay ${suffix}`,
    status: i === 3 ? "warning" : "validated",
    confidence: 0.9,
    sourceSheet: { dwgNo: "00523-2600-PRP-D-162", rev: "C01", page: 16 },
    systems: ["SYS-100"],
  })),
  ...["A", "B"].map((suffix, i) => ({
    tag: `2600-G-007${suffix}`,
    unit: "2600",
    typeCode: "G",
    description: `Crude charge pump ${suffix}`,
    status: i === 0 ? "changed" : "validated",
    confidence: 0.88,
    sourceSheet: { dwgNo: "00523-2600-PRP-D-162", rev: "C01", page: 17 },
    systems: ["SYS-100", "SYS-310"],
  })),
  ...["A", "B"].map((suffix) => ({
    tag: `2600-E-003${suffix}`,
    unit: "2600",
    typeCode: "E",
    description: `Crude preheat exchanger ${suffix}`,
    status: "validated",
    confidence: 0.93,
    sourceSheet: { dwgNo: "00523-2600-PRP-D-162", rev: "C01", page: 18 },
    systems: ["SYS-210"],
  })),
  ...["A", "B"].map((suffix) => ({
    tag: `2600-V-002${suffix}`,
    unit: "2600",
    typeCode: "V",
    description: `Crude strainer ${suffix}`,
    status: "pending",
    confidence: 0.61,
    sourceSheet: { dwgNo: "00523-2600-PRP-D-162", rev: "C01", page: 18 },
    systems: ["SYS-210"],
  })),
  {
    tag: "2610-D-004",
    unit: "2610",
    typeCode: "D",
    description: "Reflux drum",
    status: "validated",
    confidence: 0.95,
    sourceSheet: { dwgNo: "00523-2610-PRP-D-201", rev: "B02", page: 4 },
    systems: ["SYS-220"],
    dims: { diameter: 2.4, length: 7.0 },
  },
  {
    tag: "2600-T-001",
    unit: "2600",
    typeCode: "T",
    description: "Crude storage tank",
    status: "changed",
    confidence: 0.82,
    sourceSheet: { dwgNo: "00523-2600-PRP-D-163", rev: "C01", page: 2 },
    systems: ["SYS-310"],
  },
  {
    tag: "2610-K-001",
    unit: "2610",
    typeCode: "K",
    description: "Off-gas compressor",
    status: "error",
    confidence: 0.42,
    sourceSheet: { dwgNo: "00523-2610-PRP-D-202", rev: "B02", page: 6 },
    systems: ["SYS-220"],
  },
  {
    tag: "2610-F-011",
    unit: "2610",
    typeCode: "F",
    description: "Product filter",
    status: "validated",
    confidence: 0.9,
    sourceSheet: { dwgNo: "00523-2610-PRP-D-202", rev: "B02", page: 7 },
    systems: ["SYS-220"],
  },
  {
    tag: "2610-Z-009",
    unit: "2610",
    typeCode: "Z",
    description: "Unidentified package unit",
    status: "pending",
    confidence: 0.3,
    sourceSheet: { dwgNo: "00523-2610-PRP-D-202", rev: "B02", page: 9 },
    systems: [],
  },
  {
    tag: "TEMP-123",
    unit: "",
    typeCode: "",
    description: "Unparsed instrument stub",
    status: "pending",
    confidence: 0.2,
    sourceSheet: { dwgNo: "00523-2600-PRP-D-163", rev: "C01", page: 11 },
    systems: [],
  },
];

export const MOCK_LINES = [
  {
    lineNo: '28"-2600-P-301-11055MR-P',
    nps: "28",
    unit: "2600",
    service: "P",
    seq: "301",
    pipeClass: "11055MR",
    insulation: "P",
    fromTag: "2600-C-001",
    toTag: "2610-D-004",
    systems: ["SYS-100"],
    stressCategory: "B",
  },
  {
    lineNo: '6"-2600-P-114-11055MR-N',
    nps: "6",
    unit: "2600",
    service: "P",
    seq: "114",
    pipeClass: "11055MR",
    insulation: "N",
    fromTag: "2600-G-007A",
    toTag: "2600-C-001",
    systems: ["SYS-100"],
  },
  {
    lineNo: '10"-2600-P-208-11055MR-P',
    nps: "10",
    unit: "2600",
    service: "P",
    seq: "208",
    pipeClass: "11055MR",
    insulation: "P",
    fromTag: "2600-E-003A",
    toTag: "2600-E-003B",
    systems: ["SYS-210"],
  },
  {
    lineNo: '4"-2600-P-310-11055MR-N',
    nps: "4",
    unit: "2600",
    service: "P",
    seq: "310",
    pipeClass: "11055MR",
    insulation: "N",
    systems: ["SYS-210"],
  },
  {
    lineNo: '3"-2610-P-415-11055MR-N',
    nps: "3",
    unit: "2610",
    service: "P",
    seq: "415",
    pipeClass: "11055MR",
    insulation: "N",
    fromTag: "2610-D-004",
    systems: ["SYS-220"],
  },
];

export const MOCK_MODEL_META = {
  rev: "C01",
  builtAt: "2026-10-22T08:30:00+04:00",
  hasPlotPlan: false,
};

export const MODEL_STEPS = [
  { id: "loading", label: "Loading equipment" },
  { id: "placing", label: "Placing equipment" },
  { id: "routing", label: "Routing lines" },
  { id: "building", label: "Building scene" },
];

const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

/** Simulated async fetch with progress steps. */
export async function fetchModel3d(registerId, onStep) {
  void registerId;
  for (const step of MODEL_STEPS) {
    onStep?.(step.id);
    await delay(220);
  }
  return {
    equipment: MOCK_EQUIPMENT,
    lines: MOCK_LINES,
    ...MOCK_MODEL_META,
    builtAt: new Date().toISOString(),
  };
}

/** Simulated refresh job. */
export async function refreshModel3d(registerId, onStep) {
  await delay(300);
  return fetchModel3d(registerId, onStep);
}

/** Simulated export — resolves with a placeholder Blob. */
export async function exportModel3d(registerId, format) {
  await delay(400);
  const content = `RADAI 3D model export (placeholder)\nregister: ${registerId || "draft"}\nformat: ${format}\n`;
  return new Blob([content], { type: "application/octet-stream" });
}
