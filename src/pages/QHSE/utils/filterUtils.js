import { parseDate } from './dateUtils.js';
import { parsePercent, getKPIStatus } from './projectUtils.js';

// Get unique clients from projects
export const getUniqueClients = (projectsData) => {
  const clients = projectsData
    .map(p => p.client)
    .filter(client => client && client !== '' && client !== 'N/A');
  
  // Normalize and deduplicate clients by converting to uppercase for comparison
  const normalizedClients = new Map();
  
  clients.forEach(client => {
    const normalizedKey = client.toUpperCase().trim();
    // Keep the first occurrence (preserves original casing)
    if (!normalizedClients.has(normalizedKey)) {
      normalizedClients.set(normalizedKey, client);
    }
  });
  
  // Return the original casing values, sorted
  return Array.from(normalizedClients.values()).sort();
};

// Calculate basic project metrics
export const calculateProjectMetrics = (filteredProjects) => {
  const totalProjects = filteredProjects.length;
  
  const extendedProjects = filteredProjects.filter(p => 
    p.projectExtension && 
    p.projectExtension !== "No" && 
    p.projectExtension !== "" &&
    p.projectExtension !== "N/A"
  ).length;

  const totalOpenCARs = filteredProjects.reduce((sum, p) => {
    const cars = Number(p.carsOpen) || 0;
    return sum + cars;
  }, 0);
  
  const totalOpenObs = filteredProjects.reduce((sum, p) => {
    const obs = Number(p.obsOpen) || 0;
    return sum + obs;
  }, 0);

  const avgProgress = totalProjects > 0
    ? filteredProjects.reduce((sum, p) => {
        const progress = parsePercent(p.projectCompletionPercent);
        return sum + progress;
      }, 0) / totalProjects
    : 0;

  return {
    totalProjects,
    extendedProjects,
    totalOpenCARs,
    totalOpenObs,
    avgProgress
  };
};

// Project filtering logic
export const createProjectFilters = (selectedYear, selectedMonth, selectedClient, selectedKPIStatus) => {
  return (project) => {
    // Year filter
    const yearMatch = (() => {
      if (selectedYear === "all" || selectedYear === "") return true;
      
      const startDate = project.projectStartingDate;
      if (!startDate || startDate === '' || startDate === 'N/A') return false;
      
      const projectDate = parseDate(startDate);
      if (!projectDate) return false;
      
      return projectDate.getFullYear().toString() === selectedYear;
    })();

    // Month filter
    const monthMatch = (() => {
      if (selectedMonth === "all" || selectedMonth === "") return true;
      
      const startDate = project.projectStartingDate;
      if (!startDate || startDate === '' || startDate === 'N/A') return false;
      
      const projectDate = parseDate(startDate);
      if (!projectDate) return false;
      
      return (projectDate.getMonth() + 1).toString() === selectedMonth;
    })();

    // Client filter
    const clientMatch = (() => {
      if (selectedClient === "all" || selectedClient === "") return true;
      
      const clientName = project.client;
      if (!clientName || clientName === '' || clientName === 'N/A') return false;
      
      // Compare clients case-insensitively
      return clientName.toUpperCase().trim() === selectedClient.toUpperCase().trim();
    })();

    // KPI Status filter
    const kpiMatch = (() => {
      if (selectedKPIStatus === "all" || selectedKPIStatus === "") return true;
      
      const kpiStatus = getKPIStatus(project.projectKPIsAchievedPercent);
      return kpiStatus === selectedKPIStatus;
    })();

    return yearMatch && monthMatch && clientMatch && kpiMatch;
  };
};