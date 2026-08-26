/**
 * Valve Standards Reference API Service
 * ──────────────────────────────────────
 * ASME B16.34 pressure-temperature ratings, wall thickness, and material
 * specification reference data — fully soft-coded, no hardcoded URLs.
 *
 * Adjust `VALVE_STANDARDS_CONFIG` to retune endpoints without touching UI code.
 */
import apiClient from './api.service';

export const VALVE_STANDARDS_CONFIG = {
  prefix: '/valve-standards',
  configPath: '/config/',
  materialGroupsPath: '/material-groups/',
  materialGroupDetailPath: (groupNo) => `/material-groups/${encodeURIComponent(groupNo)}/`,
  ratingsPath: '/ratings/',
  wallThicknessPath: '/wall-thickness/',
  wallThicknessSocketweldPath: '/wall-thickness-socketweld/',
  npsToIdPath: '/nps-to-id/',
  referenceStandardsPath: '/reference-standards/',
  validatePath: '/validate/',

  // ASME B31.3
  b313ConfigPath: '/b31-3/config/',
  b313MaterialAllowableStressPath: '/b31-3/material-allowable-stress/',
  b313MaterialAllowableStressDetailPath: (id) => `/b31-3/material-allowable-stress/${id}/`,
  b313HighPressureAllowableStressPath: '/b31-3/high-pressure-allowable-stress/',
  b313CastingQualityFactorsPath: '/b31-3/casting-quality-factors/',
  b313WeldJointQualityFactorsPath: '/b31-3/weld-joint-quality-factors/',
  b313ThermalExpansionPath: '/b31-3/thermal-expansion/',
  b313ModulusOfElasticityPath: '/b31-3/modulus-of-elasticity/',

  // ASME B16.5
  b165ConfigPath: '/b16-5/config/',
  b165MaterialGroupsPath: '/b16-5/material-groups/',
  b165MaterialGroupDetailPath: (groupNo) => `/b16-5/material-groups/${encodeURIComponent(groupNo)}/`,
  b165RatingsPath: '/b16-5/ratings/',
  b165DrillingTemplatesPath: '/b16-5/drilling-templates/',
  b165FlangeDimensionsPath: '/b16-5/flange-dimensions/',
  b165FlangeBoltingRecommendationsPath: '/b16-5/flange-bolting-recommendations/',
};

const path = (p) => `${VALVE_STANDARDS_CONFIG.prefix}${p}`;

const valveStandardsAPI = {
  async getConfig() {
    const { data } = await apiClient.get(path(VALVE_STANDARDS_CONFIG.configPath));
    return data;
  },

  async listMaterialGroups(params = {}) {
    const { data } = await apiClient.get(path(VALVE_STANDARDS_CONFIG.materialGroupsPath), { params });
    return data;
  },

  async getMaterialGroup(groupNo) {
    const { data } = await apiClient.get(path(VALVE_STANDARDS_CONFIG.materialGroupDetailPath(groupNo)));
    return data;
  },

  async listRatings(params = {}) {
    const { data } = await apiClient.get(path(VALVE_STANDARDS_CONFIG.ratingsPath), { params });
    return data;
  },

  async listWallThickness(params = {}) {
    const { data } = await apiClient.get(path(VALVE_STANDARDS_CONFIG.wallThicknessPath), { params });
    return data;
  },

  async listWallThicknessSocketweld(params = {}) {
    const { data } = await apiClient.get(path(VALVE_STANDARDS_CONFIG.wallThicknessSocketweldPath), { params });
    return data;
  },

  async listNpsToId(params = {}) {
    const { data } = await apiClient.get(path(VALVE_STANDARDS_CONFIG.npsToIdPath), { params });
    return data;
  },

  async listReferenceStandards() {
    const { data } = await apiClient.get(path(VALVE_STANDARDS_CONFIG.referenceStandardsPath));
    return data;
  },

  async validate(payload) {
    const { data } = await apiClient.post(path(VALVE_STANDARDS_CONFIG.validatePath), payload);
    return data;
  },

  // ── ASME B31.3 ────────────────────────────────────────────────────────
  async getB313Config() {
    const { data } = await apiClient.get(path(VALVE_STANDARDS_CONFIG.b313ConfigPath));
    return data;
  },

  async listMaterialAllowableStress(params = {}) {
    const { data } = await apiClient.get(path(VALVE_STANDARDS_CONFIG.b313MaterialAllowableStressPath), { params });
    return data;
  },

  async getMaterialAllowableStress(id) {
    const { data } = await apiClient.get(path(VALVE_STANDARDS_CONFIG.b313MaterialAllowableStressDetailPath(id)));
    return data;
  },

  async listHighPressureAllowableStress(params = {}) {
    const { data } = await apiClient.get(path(VALVE_STANDARDS_CONFIG.b313HighPressureAllowableStressPath), { params });
    return data;
  },

  async listCastingQualityFactors() {
    const { data } = await apiClient.get(path(VALVE_STANDARDS_CONFIG.b313CastingQualityFactorsPath));
    return data;
  },

  async listWeldJointQualityFactors() {
    const { data } = await apiClient.get(path(VALVE_STANDARDS_CONFIG.b313WeldJointQualityFactorsPath));
    return data;
  },

  async listThermalExpansionCoefficients() {
    const { data } = await apiClient.get(path(VALVE_STANDARDS_CONFIG.b313ThermalExpansionPath));
    return data;
  },

  async listModulusOfElasticity() {
    const { data } = await apiClient.get(path(VALVE_STANDARDS_CONFIG.b313ModulusOfElasticityPath));
    return data;
  },

  // ── ASME B16.5 ─────────────────────────────────────────────────────────
  async getB165Config() {
    const { data } = await apiClient.get(path(VALVE_STANDARDS_CONFIG.b165ConfigPath));
    return data;
  },

  async listB165MaterialGroups(params = {}) {
    const { data } = await apiClient.get(path(VALVE_STANDARDS_CONFIG.b165MaterialGroupsPath), { params });
    return data;
  },

  async getB165MaterialGroup(groupNo) {
    const { data } = await apiClient.get(path(VALVE_STANDARDS_CONFIG.b165MaterialGroupDetailPath(groupNo)));
    return data;
  },

  async listB165Ratings(params = {}) {
    const { data } = await apiClient.get(path(VALVE_STANDARDS_CONFIG.b165RatingsPath), { params });
    return data;
  },

  async listB165DrillingTemplates(params = {}) {
    const { data } = await apiClient.get(path(VALVE_STANDARDS_CONFIG.b165DrillingTemplatesPath), { params });
    return data;
  },

  async listB165FlangeDimensions(params = {}) {
    const { data } = await apiClient.get(path(VALVE_STANDARDS_CONFIG.b165FlangeDimensionsPath), { params });
    return data;
  },

  async listB165FlangeBoltingRecommendations() {
    const { data } = await apiClient.get(path(VALVE_STANDARDS_CONFIG.b165FlangeBoltingRecommendationsPath));
    return data;
  },
};

export default valveStandardsAPI;
