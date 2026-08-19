import { useEffect, useState, useCallback } from 'react';
import { STORAGE_KEYS } from '../../../config/app.config';
import { API_BASE_URL } from '../../../config/api.config';

/**
 * Custom hook to fetch QHSE Spot Check Register from Django API
 */
export const useQHSESpotCheckRegister = () => {
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [error, setError] = useState(null);
  const [lastUpdated, setLastUpdated] = useState(null);
  const [dataLastChanged, setDataLastChanged] = useState(null);

  const fetchData = useCallback(async (isRefresh = false) => {
    try {
      if (isRefresh) {
        setIsRefreshing(true);
      } else {
        setLoading(true);
      }
      setError(null);

      const token = localStorage.getItem(STORAGE_KEYS.ACCESS_TOKEN);
      if (!token) {
        throw new Error('No authentication token found. Please log in.');
      }
      // Fetch all spot checks (handling pagination)
      let allSpotChecks = [];
      let nextUrl = `${API_BASE_URL}/qhse/spot-checks/?page_size=1000`; // Get all at once
      
      while (nextUrl) {
        const response = await fetch(nextUrl, {
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
          }
        });

        if (!response.ok) {
          if (response.status === 401) {
            throw new Error('Session expired. Please log in again.');
          }
          throw new Error(`HTTP error! status: ${response.status}`);
        }

        const jsonData = await response.json();
        
        // Handle paginated response (DRF format: {count, next, previous, results})
        // or direct array response
        if (jsonData.results && Array.isArray(jsonData.results)) {
          allSpotChecks = [...allSpotChecks, ...jsonData.results];
          nextUrl = jsonData.next; // Continue to next page if exists
        } else if (Array.isArray(jsonData)) {
          allSpotChecks = jsonData;
          nextUrl = null; // No pagination, exit loop
        } else {
          throw new Error('Unexpected API response format');
        }
      }
      
      // Transform API response if needed
      const transformedData = allSpotChecks.map(spotCheck => ({
        srNo: spotCheck.srNo || '',
        projectNo: spotCheck.projectNo || '',
        projectTitle: spotCheck.projectTitle || '',
        client: spotCheck.client || '',
        documentNo: spotCheck.documentNo || '',
        documentRev: spotCheck.documentRev || '',
        documentTitle: spotCheck.documentTitle || '',
        spotCheckStatus: spotCheck.spotCheckStatus || '',
        remarks: spotCheck.remarks || ''
      }));

      setData(transformedData);
      const now = new Date().toISOString();
      setLastUpdated(now);
      setDataLastChanged(now);
    } catch (err) {
      console.error('Error fetching QHSE spot checks:', err);
      setError(err.message);
    } finally {
      setLoading(false);
      setIsRefreshing(false);
    }
  }, []);

  const refetch = useCallback(() => {
    fetchData(true);
  }, [fetchData]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  return {
    data,
    loading,
    isRefreshing,
    error,
    refetch,
    lastUpdated,
    dataLastChanged
  };
};
