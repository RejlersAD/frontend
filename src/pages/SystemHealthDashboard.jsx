/**
 * System Health Dashboard
 * Comprehensive monitoring of backend, database, and services
 */
import React, { useState, useEffect } from 'react';
import {
  Box, Card, CardContent, Typography, Grid, Chip, Alert,
  CircularProgress, Button, Table, TableBody, TableCell,
  TableContainer, TableHead, TableRow, Paper, Accordion,
  AccordionSummary, AccordionDetails
} from '@mui/material';
import {
  CheckCircle as HealthyIcon,
  Error as ErrorIcon,
  Warning as WarningIcon,
  Refresh as RefreshIcon,
  ExpandMore as ExpandMoreIcon
} from '@mui/icons-material';

const API_BASE_URL = import.meta.env.VITE_API_URL || '/api/v1';

const SystemHealthDashboard = () => {
  const [loading, setLoading] = useState(false);
  const [healthData, setHealthData] = useState(null);
  const [databaseData, setDatabaseData] = useState(null);
  const [error, setError] = useState(null);
  const [lastChecked, setLastChecked] = useState(null);

  const fetchHealthData = async () => {
    setLoading(true);
    setError(null);

    try {
      // Fetch comprehensive system health
      const healthResponse = await fetch(`${API_BASE_URL}/system-health/`);
      const healthJson = await healthResponse.json();
      setHealthData(healthJson);

      // Fetch database details
      const dbResponse = await fetch(`${API_BASE_URL}/database-check/`);
      const dbJson = await dbResponse.json();
      setDatabaseData(dbJson);

      setLastChecked(new Date());
    } catch (err) {
      setError(`Failed to fetch health data: ${err.message}`);
      console.error('[Health Check Error]', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchHealthData();
    // Auto-refresh every 30 seconds
    const interval = setInterval(fetchHealthData, 30000);
    return () => clearInterval(interval);
  }, []);

  const getStatusIcon = (status) => {
    if (!status) return <WarningIcon color="warning" />;
    
    const statusLower = status.toLowerCase();
    if (statusLower === 'healthy' || statusLower === 'connected' || statusLower === 'loaded' || statusLower === 'configured') {
      return <HealthyIcon color="success" />;
    }
    if (statusLower === 'degraded' || statusLower === 'warning' || statusLower === 'local') {
      return <WarningIcon color="warning" />;
    }
    return <ErrorIcon color="error" />;
  };

  const getStatusColor = (status) => {
    if (!status) return 'warning';
    
    const statusLower = status.toLowerCase();
    if (statusLower === 'healthy' || statusLower === 'connected' || statusLower === 'loaded' || statusLower === 'configured') {
      return 'success';
    }
    if (statusLower === 'degraded' || statusLower === 'warning' || statusLower === 'local') {
      return 'warning';
    }
    return 'error';
  };

  if (loading && !healthData) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: 400 }}>
        <CircularProgress />
      </Box>
    );
  }

  return (
    <Box sx={{ p: 3 }}>
      {/* Header */}
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Box>
          <Typography variant="h4" gutterBottom>
            🏥 System Health Dashboard
          </Typography>
          <Typography variant="body2" color="textSecondary">
            {lastChecked && `Last checked: ${lastChecked.toLocaleString()}`}
          </Typography>
        </Box>
        <Button
          variant="contained"
          startIcon={loading ? <CircularProgress size={20} /> : <RefreshIcon />}
          onClick={fetchHealthData}
          disabled={loading}
        >
          Refresh
        </Button>
      </Box>

      {/* Error Alert */}
      {error && (
        <Alert severity="error" sx={{ mb: 3 }}>
          {error}
        </Alert>
      )}

      {/* Overall Status */}
      {healthData && (
        <Card sx={{ mb: 3 }}>
          <CardContent>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
              {getStatusIcon(healthData.overall_status)}
              <Box>
                <Typography variant="h5">
                  Overall Status: {healthData.overall_status?.toUpperCase()}
                </Typography>
                <Typography variant="body2" color="textSecondary">
                  Timestamp: {healthData.timestamp}
                </Typography>
              </Box>
            </Box>
          </CardContent>
        </Card>
      )}

      {/* Services Grid */}
      {healthData?.services && (
        <Grid container spacing={3}>
          {/* Database Service */}
          {healthData.services.database && (
            <Grid item xs={12} md={6}>
              <Card>
                <CardContent>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 2 }}>
                    {getStatusIcon(healthData.services.database.status)}
                    <Typography variant="h6">Database</Typography>
                    <Chip 
                      label={healthData.services.database.status?.toUpperCase()} 
                      color={getStatusColor(healthData.services.database.status)}
                      size="small"
                    />
                  </Box>
                  {healthData.services.database.status === 'healthy' && (
                    <Box>
                      <Typography variant="body2"><strong>Type:</strong> {healthData.services.database.type}</Typography>
                      <Typography variant="body2"><strong>Host:</strong> {healthData.services.database.host}</Typography>
                      <Typography variant="body2"><strong>Database:</strong> {healthData.services.database.name}</Typography>
                      <Typography variant="body2">
                        <strong>Connections:</strong> {healthData.services.database.active_connections}/{healthData.services.database.total_connections}
                      </Typography>
                    </Box>
                  )}
                  {healthData.services.database.error && (
                    <Alert severity="error" sx={{ mt: 1 }}>
                      {healthData.services.database.error}
                    </Alert>
                  )}
                </CardContent>
              </Card>
            </Grid>
          )}

          {/* Redis Service */}
          {healthData.services.redis && (
            <Grid item xs={12} md={6}>
              <Card>
                <CardContent>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 2 }}>
                    {getStatusIcon(healthData.services.redis.status)}
                    <Typography variant="h6">Redis Cache</Typography>
                    <Chip 
                      label={healthData.services.redis.status?.toUpperCase()} 
                      color={getStatusColor(healthData.services.redis.status)}
                      size="small"
                    />
                  </Box>
                  {healthData.services.redis.cache_working && (
                    <Typography variant="body2" color="success.main">
                      ✅ Cache operations working
                    </Typography>
                  )}
                  {healthData.services.redis.error && (
                    <Alert severity="error" sx={{ mt: 1 }}>
                      {healthData.services.redis.error}
                    </Alert>
                  )}
                </CardContent>
              </Card>
            </Grid>
          )}

          {/* Email Service */}
          {healthData.services.email && (
            <Grid item xs={12} md={6}>
              <Card>
                <CardContent>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 2 }}>
                    {getStatusIcon(healthData.services.email.status)}
                    <Typography variant="h6">Email Service</Typography>
                    <Chip 
                      label={healthData.services.email.status?.toUpperCase()} 
                      color={getStatusColor(healthData.services.email.status)}
                      size="small"
                    />
                  </Box>
                  <Typography variant="body2"><strong>Backend:</strong> {healthData.services.email.backend?.split('.').pop()}</Typography>
                  <Typography variant="body2"><strong>Host:</strong> {healthData.services.email.host}</Typography>
                  <Typography variant="body2"><strong>Port:</strong> {healthData.services.email.port}</Typography>
                  <Typography variant="body2"><strong>TLS:</strong> {healthData.services.email.use_tls ? 'Yes' : 'No'}</Typography>
                </CardContent>
              </Card>
            </Grid>
          )}

          {/* Storage Service */}
          {healthData.services.storage && (
            <Grid item xs={12} md={6}>
              <Card>
                <CardContent>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 2 }}>
                    {getStatusIcon(healthData.services.storage.status)}
                    <Typography variant="h6">Storage</Typography>
                    <Chip 
                      label={healthData.services.storage.type} 
                      color={getStatusColor(healthData.services.storage.status)}
                      size="small"
                    />
                  </Box>
                  {healthData.services.storage.bucket && (
                    <Typography variant="body2"><strong>Bucket:</strong> {healthData.services.storage.bucket}</Typography>
                  )}
                  {healthData.services.storage.media_root && (
                    <Typography variant="body2" sx={{ wordBreak: 'break-all' }}>
                      <strong>Media Root:</strong> {healthData.services.storage.media_root}
                    </Typography>
                  )}
                </CardContent>
              </Card>
            </Grid>
          )}

          {/* Optional Apps */}
          {healthData.services.optional_apps && (
            <Grid item xs={12} md={6}>
              <Card>
                <CardContent>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 2 }}>
                    {getStatusIcon(healthData.services.optional_apps.status)}
                    <Typography variant="h6">Optional Apps</Typography>
                    <Chip 
                      label={`${healthData.services.optional_apps.count} Loaded`}
                      color="info"
                      size="small"
                    />
                  </Box>
                  <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
                    {healthData.services.optional_apps.apps?.map((app) => (
                      <Chip key={app} label={app.split('.').pop()} size="small" color="success" variant="outlined" />
                    ))}
                  </Box>
                </CardContent>
              </Card>
            </Grid>
          )}

          {/* Security Settings */}
          {healthData.services.security && (
            <Grid item xs={12} md={6}>
              <Card>
                <CardContent>
                  <Typography variant="h6" gutterBottom>🔒 Security</Typography>
                  <TableContainer>
                    <Table size="small">
                      <TableBody>
                        <TableRow>
                          <TableCell>Debug Mode</TableCell>
                          <TableCell>
                            <Chip 
                              label={healthData.services.security.debug_mode ? 'ON' : 'OFF'} 
                              color={healthData.services.security.debug_mode ? 'warning' : 'success'}
                              size="small"
                            />
                          </TableCell>
                        </TableRow>
                        <TableRow>
                          <TableCell>Allowed Hosts</TableCell>
                          <TableCell>{healthData.services.security.allowed_hosts}</TableCell>
                        </TableRow>
                        <TableRow>
                          <TableCell>CORS Origins</TableCell>
                          <TableCell>{healthData.services.security.cors_origins}</TableCell>
                        </TableRow>
                        <TableRow>
                          <TableCell>Secret Key</TableCell>
                          <TableCell>
                            {healthData.services.security.secret_key_set ? '✅ Set' : '❌ Missing'}
                          </TableCell>
                        </TableRow>
                      </TableBody>
                    </Table>
                  </TableContainer>
                  {healthData.services.security.warning && (
                    <Alert severity="warning" sx={{ mt: 2 }}>
                      {healthData.services.security.warning}
                    </Alert>
                  )}
                </CardContent>
              </Card>
            </Grid>
          )}
        </Grid>
      )}

      {/* Database Details Accordion */}
      {databaseData && (
        <Accordion sx={{ mt: 3 }}>
          <AccordionSummary expandIcon={<ExpandMoreIcon />}>
            <Typography variant="h6">📊 Database Details</Typography>
          </AccordionSummary>
          <AccordionDetails>
            {databaseData.database?.status === 'connected' ? (
              <TableContainer component={Paper}>
                <Table>
                  <TableBody>
                    <TableRow>
                      <TableCell><strong>Status</strong></TableCell>
                      <TableCell>
                        <Chip label="CONNECTED" color="success" size="small" />
                      </TableCell>
                    </TableRow>
                    <TableRow>
                      <TableCell><strong>Version</strong></TableCell>
                      <TableCell>{databaseData.database.version}</TableCell>
                    </TableRow>
                    <TableRow>
                      <TableCell><strong>Database Name</strong></TableCell>
                      <TableCell>{databaseData.database.name}</TableCell>
                    </TableRow>
                    <TableRow>
                      <TableCell><strong>Host</strong></TableCell>
                      <TableCell>{databaseData.database.host}:{databaseData.database.port}</TableCell>
                    </TableRow>
                    <TableRow>
                      <TableCell><strong>User</strong></TableCell>
                      <TableCell>{databaseData.database.user}</TableCell>
                    </TableRow>
                    <TableRow>
                      <TableCell><strong>Database Size</strong></TableCell>
                      <TableCell>{databaseData.database.database_size}</TableCell>
                    </TableRow>
                    <TableRow>
                      <TableCell><strong>Tables</strong></TableCell>
                      <TableCell>{databaseData.database.table_count}</TableCell>
                    </TableRow>
                    <TableRow>
                      <TableCell><strong>Connection Timeout</strong></TableCell>
                      <TableCell>{databaseData.database.connection_timeout}s</TableCell>
                    </TableRow>
                  </TableBody>
                </Table>
              </TableContainer>
            ) : (
              <Alert severity="error">
                Database disconnected: {databaseData.database?.error}
              </Alert>
            )}
          </AccordionDetails>
        </Accordion>
      )}
    </Box>
  );
};

export default SystemHealthDashboard;
