/**
 * CRS Revision Chain Detail Page
 * Shows complete chain history, all revisions, comments, and AI insights
 */

import React, { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import {
  Box, Card, CardContent, Typography, Grid, CircularProgress, Alert,
  Chip, Table, TableBody, TableCell, TableContainer, TableHead, TableRow,
  Paper, Divider, Button, IconButton, Tooltip
} from '@mui/material';
import {
  ArrowBack as BackIcon,
  Download as DownloadIcon,
  CloudDownload as CloudDownloadIcon,
  Description as DocIcon,
  TrendingUp as InsightIcon
} from '@mui/icons-material';

const CONFIG = {
  API_BASE_URL: import.meta.env.VITE_API_URL || '/api/v1',
  TOKEN_KEYS: ['radai_access_token', 'access_token', 'access']
};

const CRSChainDetail = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const [chainData, setChainData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const getAuthHeaders = () => {
    for (const key of CONFIG.TOKEN_KEYS) {
      const token = localStorage.getItem(key);
      if (token) return { 'Authorization': `Bearer ${token}` };
    }
    return {};
  };

  useEffect(() => {
    fetchChainDetail();
  }, [id]);

  const fetchChainDetail = async () => {
    try {
      setLoading(true);
      const response = await fetch(
        `${CONFIG.API_BASE_URL}/crs/revision-chains/${id}/`,
        { headers: getAuthHeaders() }
      );

      if (!response.ok) {
        throw new Error(`Failed to fetch chain: ${response.status}`);
      }

      const data = await response.json();
      setChainData(data);
      setError(null);
    } catch (err) {
      setError(err.message);
      console.error('[CRS Detail] Error:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleDownloadExcel = () => {
    // Simple HTML-to-Excel export
    const html = generateExportHTML();
    const blob = new Blob([html], { type: 'application/vnd.ms-excel;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `CRS_Chain_${chainData.chain_id}_${new Date().toISOString().split('T')[0]}.xls`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const generateExportHTML = () => {
    return `
      <html>
      <head>
        <meta charset="UTF-8">
        <style>
          table { border-collapse: collapse; width: 100%; }
          th, td { border: 1px solid black; padding: 8px; text-align: left; }
          th { background-color: #4CAF50; color: white; font-weight: bold; }
        </style>
      </head>
      <body>
        <h2>CRS Revision Chain: ${chainData?.chain_id}</h2>
        <table>
          <tr><th>Document Title</th><td>${chainData?.document_title || 'N/A'}</td></tr>
          <tr><th>Document Number</th><td>${chainData?.document_number || 'N/A'}</td></tr>
          <tr><th>Project Name</th><td>${chainData?.project_name || 'N/A'}</td></tr>
          <tr><th>Contractor</th><td>${chainData?.contractor_name || 'N/A'}</td></tr>
          <tr><th>Total Revisions</th><td>${chainData?.revisions?.length || 0}</td></tr>
        </table>
        <h3>Revisions</h3>
        <table>
          <tr>
            <th>Revision Number</th>
            <th>Status</th>
            <th>File Name</th>
            <th>Uploaded At</th>
          </tr>
          ${(chainData?.revisions || []).map(rev => `
            <tr>
              <td>${rev.revision_number}</td>
              <td>${rev.status}</td>
              <td>${rev.original_file_name || 'N/A'}</td>
              <td>${new Date(rev.created_at).toLocaleString()}</td>
            </tr>
          `).join('')}
        </table>
      </body>
      </html>
    `;
  };

  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '60vh' }}>
        <CircularProgress />
      </Box>
    );
  }

  if (error) {
    return (
      <Box sx={{ p: 3 }}>
        <Alert severity="error" sx={{ mb: 2 }}>
          {error}
        </Alert>
        <Button startIcon={<BackIcon />} onClick={() => navigate('/crs/documents')}>
          Back to CRS Documents
        </Button>
      </Box>
    );
  }

  if (!chainData) {
    return (
      <Box sx={{ p: 3 }}>
        <Alert severity="warning">Chain not found</Alert>
      </Box>
    );
  }

  return (
    <Box sx={{ p: 3 }}>
      {/* Header */}
      <Box sx={{ display: 'flex', alignItems: 'center', mb: 3 }}>
        <IconButton onClick={() => navigate('/crs/documents')} sx={{ mr: 2 }}>
          <BackIcon />
        </IconButton>
        <Box sx={{ flexGrow: 1 }}>
          <Typography variant="h4" gutterBottom>
            {chainData.chain_id}
          </Typography>
          <Typography variant="body2" color="text.secondary">
            {chainData.document_title}
          </Typography>
        </Box>
        <Button
          variant="contained"
          color="success"
          startIcon={<DownloadIcon />}
          onClick={handleDownloadExcel}
        >
          Export Excel
        </Button>
      </Box>

      {/* Chain Information */}
      <Card sx={{ mb: 3 }}>
        <CardContent>
          <Typography variant="h6" gutterBottom sx={{ display: 'flex', alignItems: 'center' }}>
            <DocIcon sx={{ mr: 1 }} />
            Chain Information
          </Typography>
          <Divider sx={{ mb: 2 }} />
          <Grid container spacing={2}>
            <Grid item xs={12} md={6}>
              <Typography variant="body2" color="text.secondary">Chain ID</Typography>
              <Typography variant="body1" gutterBottom><strong>{chainData.chain_id}</strong></Typography>
            </Grid>
            <Grid item xs={12} md={6}>
              <Typography variant="body2" color="text.secondary">Document Number</Typography>
              <Typography variant="body1" gutterBottom>{chainData.document_number || 'N/A'}</Typography>
            </Grid>
            <Grid item xs={12} md={6}>
              <Typography variant="body2" color="text.secondary">Document Title</Typography>
              <Typography variant="body1" gutterBottom>{chainData.document_title || 'N/A'}</Typography>
            </Grid>
            <Grid item xs={12} md={6}>
              <Typography variant="body2" color="text.secondary">Project Name</Typography>
              <Typography variant="body1" gutterBottom>{chainData.project_name || 'N/A'}</Typography>
            </Grid>
            <Grid item xs={12} md={6}>
              <Typography variant="body2" color="text.secondary">Contractor</Typography>
              <Typography variant="body1" gutterBottom>{chainData.contractor_name || 'N/A'}</Typography>
            </Grid>
            <Grid item xs={12} md={6}>
              <Typography variant="body2" color="text.secondary">Department</Typography>
              <Typography variant="body1" gutterBottom>{chainData.department || 'N/A'}</Typography>
            </Grid>
            <Grid item xs={12} md={6}>
              <Typography variant="body2" color="text.secondary">Max Allowed Revisions</Typography>
              <Typography variant="body1" gutterBottom>{chainData.max_allowed_revisions}</Typography>
            </Grid>
            <Grid item xs={12} md={6}>
              <Typography variant="body2" color="text.secondary">Status</Typography>
              <Chip
                label={chainData.is_finalized ? 'Finalized' : 'Active'}
                color={chainData.is_finalized ? 'success' : 'primary'}
                size="small"
              />
            </Grid>
          </Grid>
        </CardContent>
      </Card>

      {/* Revisions History */}
      <Card>
        <CardContent>
          <Typography variant="h6" gutterBottom>
            Revision History ({chainData.revisions?.length || 0} revisions)
          </Typography>
          <Divider sx={{ mb: 2 }} />
          
          {chainData.revisions && chainData.revisions.length > 0 ? (
            <TableContainer component={Paper} variant="outlined">
              <Table>
                <TableHead>
                  <TableRow>
                    <TableCell><strong>Revision #</strong></TableCell>
                    <TableCell><strong>Status</strong></TableCell>
                    <TableCell><strong>File Name</strong></TableCell>
                    <TableCell><strong>Uploaded At</strong></TableCell>
                    <TableCell><strong>Uploaded By</strong></TableCell>
                    <TableCell align="center"><strong>Download</strong></TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {chainData.revisions.map((revision) => (
                    <TableRow key={revision.id}>
                      <TableCell>
                        <Chip label={`Rev ${revision.revision_number}`} color="primary" size="small" />
                      </TableCell>
                      <TableCell>
                        <Chip
                          label={revision.status}
                          color={revision.status === 'completed' ? 'success' : 'warning'}
                          size="small"
                        />
                      </TableCell>
                      <TableCell>{revision.original_file_name || 'N/A'}</TableCell>
                      <TableCell>{new Date(revision.created_at).toLocaleString()}</TableCell>
                      <TableCell>{revision.uploaded_by_username || 'N/A'}</TableCell>
                      <TableCell align="center">
                        {revision.excel_download_url ? (
                          <Tooltip title="Download from S3 (instant)">
                            <IconButton
                              size="small"
                              color="success"
                              onClick={() => window.open(revision.excel_download_url, '_blank')}
                            >
                              <CloudDownloadIcon fontSize="small" />
                            </IconButton>
                          </Tooltip>
                        ) : (
                          <Tooltip title="Excel not available">
                            <span>
                              <IconButton size="small" disabled>
                                <DownloadIcon fontSize="small" />
                              </IconButton>
                            </span>
                          </Tooltip>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
          ) : (
            <Alert severity="info">No revisions found for this chain</Alert>
          )}
        </CardContent>
      </Card>

      {/* AI Insights (if available) */}
      {chainData.ai_insights && chainData.ai_insights.length > 0 && (
        <Card sx={{ mt: 3 }}>
          <CardContent>
            <Typography variant="h6" gutterBottom sx={{ display: 'flex', alignItems: 'center' }}>
              <InsightIcon sx={{ mr: 1 }} />
              AI Insights
            </Typography>
            <Divider sx={{ mb: 2 }} />
            {chainData.ai_insights.map((insight, idx) => (
              <Alert key={idx} severity="info" sx={{ mb: 1 }}>
                {insight.insight_text}
              </Alert>
            ))}
          </CardContent>
        </Card>
      )}
    </Box>
  );
};

export default CRSChainDetail;
