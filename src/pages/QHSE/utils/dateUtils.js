// Enhanced European date parser to handle all formats
export const parseDate = (dateString) => {
  if (!dateString || dateString === '' || dateString === 'N/A') {
    return null;
  }
  
  // Handle European format DD.MM.YYYY or DD.MM.YY
  if (/^\d{1,2}\.\d{1,2}\.\d{2,4}$/.test(dateString)) {
    const [day, month, year] = dateString.split('.');
    const fullYear = year.length === 2 ? `20${year}` : year;
    return new Date(fullYear, month - 1, day); // month is 0-indexed
  }
  
  // Handle DD/MM/YYYY format (alternative European)
  if (/^\d{1,2}\/\d{1,2}\/\d{2,4}$/.test(dateString)) {
    const [day, month, year] = dateString.split('/');
    const fullYear = year.length === 2 ? `20${year}` : year;
    return new Date(fullYear, month - 1, day); // month is 0-indexed
  }
  
  // Handle other formats (ISO, US, etc.)
  const date = new Date(dateString);
  return isNaN(date.getTime()) ? null : date;
};

// Format date to readable string
export const formatDate = (date) => {
  if (!date) return 'N/A';
  const parsedDate = date instanceof Date ? date : parseDate(date);
  if (!parsedDate) return 'N/A';
  const day = parsedDate.getDate().toString().padStart(2, '0');
  const month = (parsedDate.getMonth() + 1).toString().padStart(2, '0');
  const year = parsedDate.getFullYear();
  return `${day}/${month}/${year}`;
};

// Calculate days between two dates
export const daysBetween = (startDate, endDate) => {
  const start = startDate instanceof Date ? startDate : parseDate(startDate);
  const end = endDate instanceof Date ? endDate : parseDate(endDate);
  
  if (!start || !end) return 0;
  
  return Math.ceil((end - start) / (1000 * 60 * 60 * 24));
};

// Check if date is in the past
export const isPastDate = (date) => {
  const parsedDate = date instanceof Date ? date : parseDate(date);
  if (!parsedDate) return false;
  
  return parsedDate < new Date();
};

// Check if date is in the future
export const isFutureDate = (date) => {
  const parsedDate = date instanceof Date ? date : parseDate(date);
  if (!parsedDate) return false;
  
  return parsedDate > new Date();
};

// Get unique years from projects
export const getUniqueYears = (projectsData) => {
  const years = projectsData
    .map(p => {
      const startDate = p.projectStartingDate;
      if (!startDate || startDate === '' || startDate === 'N/A') return null;
      
      const projectDate = parseDate(startDate);
      return projectDate ? projectDate.getFullYear() : null;
    })
    .filter(year => year !== null)
    .map(year => year.toString());
  
  return [...new Set(years)].sort((a, b) => parseInt(b) - parseInt(a));
};