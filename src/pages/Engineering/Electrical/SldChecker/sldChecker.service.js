/**
 * SLD Checker — data layer. Thin re-export of sldService
 * (/api/v1/electrical-comparison/*): the staged comparison API is the
 * only backend this module calls.
 */
import sldService from '../../../../services/sldService'

export default sldService
export const {
  listProjects, createProject, deleteProject,
  getState, uploadFile, updateMapping,
  getKey, testKey, saveKey, removeKey,
  setLegend,
  analyse, listAnalyses, getAnalysis, deleteAnalysis, exportAnalysis,
} = sldService
