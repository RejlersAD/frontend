import React, { useState, useEffect } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  TextField,
  Grid,
  MenuItem,
  CircularProgress,
  Alert,
  IconButton,
  Typography
} from '@mui/material';
import { X, Save, Upload } from 'lucide-react';
import { STORAGE_KEYS } from '../../../../config/app.config';
import { API_BASE_URL } from '../../../../config/api.config';

/**
 * Project Edit Modal - Soft-coded admin interface for creating/updating QHSE projects
 * Replaces Google Forms with integrated CRUD functionality
 */
export const ProjectEditModal = ({ open, onClose, project, onUpdate, mode = 'edit' }) => {
  const isCreateMode = mode === 'create';
  const [formData, setFormData] = useState({});
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(false);

  // Return a valid YYYY-MM-DD string or '' — prevents browser date-input warnings
  // when existing DB rows contain non-date text (e.g. spreadsheet artefacts).
  const safeDate = (value) => {
    if (!value) return '';
    if (/^\d{4}-\d{2}-\d{2}$/.test(String(value))) return value;
    return '';
  };

  // Initialize form data when project changes or in create mode
  useEffect(() => {
    if (isCreateMode) {
      // Initialize with empty values for create mode
      setFormData({
        projectNo: '',
        projectTitle: '',
        client: '',
        projectManager: '',
        projectStartingDate: '',
        projectClosingDate: '',
        projectExtension: '',
        projectQualityEng: '',
        manHourForQuality: 0,
        manhoursUsed: 0,
        qualityBillabilityPercent: '0%',
        projectQualityPlanStatusRev: '',
        projectQualityPlanStatusIssueDate: '',
        projectAudit1: '',
        projectAudit2: '',
        projectAudit3: '',
        projectAudit4: '',
        clientAudit1: '',
        clientAudit2: '',
        delayInAuditsNoDays: 0,
        carsOpen: 0,
        carsDelayedClosingNoDays: 0,
        carsClosed: 0,
        obsOpen: 0,
        obsDelayedClosingNoDays: 0,
        obsClosed: 0,
        projectKPIsAchievedPercent: '0%',
        projectCompletionPercent: '0%',
        rejectionOfDeliverablesPercent: '0%',
        costOfPoorQualityAED: 0,
        remarks: ''
      });
    } else if (project) {
      setFormData({
        projectNo: project.projectNo || '',
        projectTitle: project.projectTitle || '',
        client: project.client || '',
        projectManager: project.projectManager || '',
        projectStartingDate: safeDate(project.projectStartingDate),
        projectClosingDate: safeDate(project.projectClosingDate),
        projectExtension: safeDate(project.projectExtension),
        projectQualityEng: project.projectQualityEng || '',
        manHourForQuality: project.manHourForQuality || 0,
        manhoursUsed: project.manhoursUsed || 0,
        qualityBillabilityPercent: project.qualityBillabilityPercent || '0%',
        projectQualityPlanStatusRev: project.projectQualityPlanStatusRev || '',
        projectQualityPlanStatusIssueDate: safeDate(project.projectQualityPlanStatusIssueDate),
        projectAudit1: safeDate(project.projectAudit1),
        projectAudit2: safeDate(project.projectAudit2),
        projectAudit3: safeDate(project.projectAudit3),
        projectAudit4: safeDate(project.projectAudit4),
        clientAudit1: safeDate(project.clientAudit1),
        clientAudit2: safeDate(project.clientAudit2),
        delayInAuditsNoDays: project.delayInAuditsNoDays || 0,
        carsOpen: project.carsOpen || 0,
        carsDelayedClosingNoDays: project.carsDelayedClosingNoDays || 0,
        carsClosed: project.carsClosed || 0,
        obsOpen: project.obsOpen || 0,
        obsDelayedClosingNoDays: project.obsDelayedClosingNoDays || 0,
        obsClosed: project.obsClosed || 0,
        projectKPIsAchievedPercent: project.projectKPIsAchievedPercent || '0%',
        projectCompletionPercent: project.projectCompletionPercent || '0%',
        rejectionOfDeliverablesPercent: project.rejectionOfDeliverablesPercent || '0%',
        costOfPoorQualityAED: project.costOfPoorQualityAED || 0,
        remarks: project.remarks || ''
      });
    }
  }, [project, isCreateMode]);

  const handleChange = (field, value) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    setError(null);
  };

  const handleSubmit = async () => {
    setLoading(true);
    setError(null);
    setSuccess(false);

    try {
      const token = localStorage.getItem(STORAGE_KEYS.ACCESS_TOKEN);
      if (!token) {
        throw new Error('Authentication required');
      }

      // Determine API endpoint and method based on mode
      // CRITICAL: Use project.id (primary key) not project.srNo for updates
      const projectId = project?.id || project?.pk;
      
      if (!isCreateMode && !projectId) {
        throw new Error('Project ID is required for updates');
      }

      const url = isCreateMode 
        ? `${API_BASE_URL}/qhse/projects/`
        : `${API_BASE_URL}/qhse/projects/${projectId}/`;
      
      const method = isCreateMode ? 'POST' : 'PATCH';

      // SOFT-CODED FIX: Convert empty strings to null for date fields and optional fields
      // Django expects null, not empty string for optional date/text fields
      const sanitizedData = { ...formData };
      
      // Date fields that should be null instead of empty string
      const dateFields = [
        'projectStartingDate', 'projectClosingDate', 'projectExtension',
        'projectQualityPlanStatusIssueDate', 'projectAudit1', 'projectAudit2',
        'projectAudit3', 'projectAudit4', 'clientAudit1', 'clientAudit2'
      ];
      
      // Optional text fields that should be null instead of empty string
      const optionalTextFields = [
        'projectQualityEng', 'projectQualityPlanStatusRev', 'projectTitleKey',
        'rejectionOfDeliverablesPercent', 'remarks'
      ];
      
      // Convert empty strings to null
      [...dateFields, ...optionalTextFields].forEach(field => {
        if (sanitizedData[field] === '') {
          sanitizedData[field] = null;
        }
      });

      console.log(`[ProjectEditModal] ${method} request to: ${url}`);
      console.log('[ProjectEditModal] Original payload:', formData);
      console.log('[ProjectEditModal] Sanitized payload:', sanitizedData);

      const response = await fetch(url, {
        method,
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(sanitizedData)
        }
      );

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ detail: 'Unknown error occurred' }));
        console.error('[ProjectEditModal] Error response:', errorData);
        const message =
          errorData.detail ||
          (errorData.non_field_errors && errorData.non_field_errors.join(', ')) ||
          Object.entries(errorData)
            .map(([field, errs]) => `${field}: ${Array.isArray(errs) ? errs.join(', ') : errs}`)
            .join(' | ') ||
          `Failed to ${isCreateMode ? 'create' : 'update'} project`;
        throw new Error(message);
      }

      const savedProject = await response.json();
      console.log('[ProjectEditModal] Success:', savedProject);
      setSuccess(true);
      
      // Notify parent component
      if (onUpdate) {
        onUpdate(savedProject);
      }

      // Close modal after success
      setTimeout(() => {
        onClose();
        setSuccess(false);
      }, 1500);
      
    } catch (err) {
      console.error(`Error ${isCreateMode ? 'creating' : 'updating'} project:`, err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  // Allow rendering for both create and edit modes
  if (!isCreateMode && !project) return null;

  return (
    <Dialog 
      open={open} 
      onClose={onClose}
      maxWidth="lg"
      fullWidth
      PaperProps={{
        sx: {
          borderRadius: 2,
          maxHeight: '90vh'
        }
      }}
    >
      <DialogTitle sx={{ 
        display: 'flex', 
        justifyContent: 'space-between', 
        alignItems: 'center',
        pb: 2,
        borderBottom: 1,
        borderColor: 'divider'
      }}>
        <Typography variant="h6" component="div" sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <Upload size={24} />
          {isCreateMode ? 'Create New Project' : `Update Project: ${project.projectNo}`}
        </Typography>
        <IconButton onClick={onClose} size="small">
          <X />
        </IconButton>
      </DialogTitle>

      <DialogContent sx={{ mt: 2 }}>
        {error && (
          <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError(null)}>
            {error}
          </Alert>
        )}
        
        {success && (
          <Alert severity="success" sx={{ mb: 2 }}>
            Project updated successfully!
          </Alert>
        )}

        <Grid container spacing={2}>
          {/* Basic Information */}
          <Grid item xs={12}>
            <Typography variant="subtitle2" color="primary" sx={{ mb: 1, fontWeight: 600 }}>
              Basic Information
            </Typography>
          </Grid>
          
          <Grid item xs={12} md={6}>
            <TextField
              fullWidth
              label="Project Number"
              value={formData.projectNo || ''}
              onChange={(e) => handleChange('projectNo', e.target.value)}
              size="small"
              disabled
            />
          </Grid>

          <Grid item xs={12} md={6}>
            <TextField
              fullWidth
              label="Client"
              value={formData.client || ''}
              onChange={(e) => handleChange('client', e.target.value)}
              size="small"
            />
          </Grid>

          <Grid item xs={12}>
            <TextField
              fullWidth
              label="Project Title"
              value={formData.projectTitle || ''}
              onChange={(e) => handleChange('projectTitle', e.target.value)}
              size="small"
              multiline
              rows={2}
            />
          </Grid>

          <Grid item xs={12} md={6}>
            <TextField
              fullWidth
              label="Project Manager"
              value={formData.projectManager || ''}
              onChange={(e) => handleChange('projectManager', e.target.value)}
              size="small"
            />
          </Grid>

          <Grid item xs={12} md={6}>
            <TextField
              fullWidth
              label="Quality Engineer"
              value={formData.projectQualityEng || ''}
              onChange={(e) => handleChange('projectQualityEng', e.target.value)}
              size="small"
            />
          </Grid>

          {/* Dates */}
          <Grid item xs={12}>
            <Typography variant="subtitle2" color="primary" sx={{ mb: 1, mt: 2, fontWeight: 600 }}>
              Project Timeline
            </Typography>
          </Grid>

          <Grid item xs={12} md={4}>
            <TextField
              fullWidth
              type="date"
              label="Starting Date"
              value={formData.projectStartingDate || ''}
              onChange={(e) => handleChange('projectStartingDate', e.target.value)}
              size="small"
              InputLabelProps={{ shrink: true }}
            />
          </Grid>

          <Grid item xs={12} md={4}>
            <TextField
              fullWidth
              type="date"
              label="Closing Date"
              value={formData.projectClosingDate || ''}
              onChange={(e) => handleChange('projectClosingDate', e.target.value)}
              size="small"
              InputLabelProps={{ shrink: true }}
            />
          </Grid>

          <Grid item xs={12} md={4}>
            <TextField
              fullWidth
              type="date"
              label="Extension Date"
              value={formData.projectExtension || ''}
              onChange={(e) => handleChange('projectExtension', e.target.value)}
              size="small"
              InputLabelProps={{ shrink: true }}
            />
          </Grid>

          {/* Manhours */}
          <Grid item xs={12}>
            <Typography variant="subtitle2" color="primary" sx={{ mb: 1, mt: 2, fontWeight: 600 }}>
              Manhours & Billability
            </Typography>
          </Grid>

          <Grid item xs={12} md={4}>
            <TextField
              fullWidth
              type="number"
              label="Manhours Allocated"
              value={formData.manHourForQuality || 0}
              onChange={(e) => handleChange('manHourForQuality', parseFloat(e.target.value) || 0)}
              size="small"
            />
          </Grid>

          <Grid item xs={12} md={4}>
            <TextField
              fullWidth
              type="number"
              label="Manhours Used"
              value={formData.manhoursUsed || 0}
              onChange={(e) => handleChange('manhoursUsed', parseFloat(e.target.value) || 0)}
              size="small"
            />
          </Grid>

          <Grid item xs={12} md={4}>
            <TextField
              fullWidth
              label="Billability %"
              value={formData.qualityBillabilityPercent || '0%'}
              onChange={(e) => handleChange('qualityBillabilityPercent', e.target.value)}
              size="small"
              placeholder="e.g., 85%"
            />
          </Grid>

          {/* Quality Plan */}
          <Grid item xs={12}>
            <Typography variant="subtitle2" color="primary" sx={{ mb: 1, mt: 2, fontWeight: 600 }}>
              Quality Plan Status
            </Typography>
          </Grid>

          <Grid item xs={12} md={6}>
            <TextField
              fullWidth
              label="Quality Plan Revision"
              value={formData.projectQualityPlanStatusRev || ''}
              onChange={(e) => handleChange('projectQualityPlanStatusRev', e.target.value)}
              size="small"
            />
          </Grid>

          <Grid item xs={12} md={6}>
            <TextField
              fullWidth
              type="date"
              label="Quality Plan Issue Date"
              value={formData.projectQualityPlanStatusIssueDate || ''}
              onChange={(e) => handleChange('projectQualityPlanStatusIssueDate', e.target.value)}
              size="small"
              InputLabelProps={{ shrink: true }}
            />
          </Grid>

          {/* Audits */}
          <Grid item xs={12}>
            <Typography variant="subtitle2" color="primary" sx={{ mb: 1, mt: 2, fontWeight: 600 }}>
              Audits
            </Typography>
          </Grid>

          <Grid item xs={12} md={3}>
            <TextField
              fullWidth
              type="date"
              label="Project Audit 1"
              value={formData.projectAudit1 || ''}
              onChange={(e) => handleChange('projectAudit1', e.target.value)}
              size="small"
              InputLabelProps={{ shrink: true }}
            />
          </Grid>

          <Grid item xs={12} md={3}>
            <TextField
              fullWidth
              type="date"
              label="Project Audit 2"
              value={formData.projectAudit2 || ''}
              onChange={(e) => handleChange('projectAudit2', e.target.value)}
              size="small"
              InputLabelProps={{ shrink: true }}
            />
          </Grid>

          <Grid item xs={12} md={3}>
            <TextField
              fullWidth
              type="date"
              label="Client Audit 1"
              value={formData.clientAudit1 || ''}
              onChange={(e) => handleChange('clientAudit1', e.target.value)}
              size="small"
              InputLabelProps={{ shrink: true }}
            />
          </Grid>

          <Grid item xs={12} md={3}>
            <TextField
              fullWidth
              type="number"
              label="Audit Delays (Days)"
              value={formData.delayInAuditsNoDays || 0}
              onChange={(e) => handleChange('delayInAuditsNoDays', parseInt(e.target.value) || 0)}
              size="small"
            />
          </Grid>

          {/* CARs and Observations */}
          <Grid item xs={12}>
            <Typography variant="subtitle2" color="primary" sx={{ mb: 1, mt: 2, fontWeight: 600 }}>
              CARs & Observations
            </Typography>
          </Grid>

          <Grid item xs={12} md={3}>
            <TextField
              fullWidth
              type="number"
              label="CARs Open"
              value={formData.carsOpen || 0}
              onChange={(e) => handleChange('carsOpen', parseInt(e.target.value) || 0)}
              size="small"
            />
          </Grid>

          <Grid item xs={12} md={3}>
            <TextField
              fullWidth
              type="number"
              label="CARs Closed"
              value={formData.carsClosed || 0}
              onChange={(e) => handleChange('carsClosed', parseInt(e.target.value) || 0)}
              size="small"
            />
          </Grid>

          <Grid item xs={12} md={3}>
            <TextField
              fullWidth
              type="number"
              label="Observations Open"
              value={formData.obsOpen || 0}
              onChange={(e) => handleChange('obsOpen', parseInt(e.target.value) || 0)}
              size="small"
            />
          </Grid>

          <Grid item xs={12} md={3}>
            <TextField
              fullWidth
              type="number"
              label="Observations Closed"
              value={formData.obsClosed || 0}
              onChange={(e) => handleChange('obsClosed', parseInt(e.target.value) || 0)}
              size="small"
            />
          </Grid>

          {/* KPIs */}
          <Grid item xs={12}>
            <Typography variant="subtitle2" color="primary" sx={{ mb: 1, mt: 2, fontWeight: 600 }}>
              KPIs & Performance
            </Typography>
          </Grid>

          <Grid item xs={12} md={4}>
            <TextField
              fullWidth
              label="KPIs Achieved %"
              value={formData.projectKPIsAchievedPercent || '0%'}
              onChange={(e) => handleChange('projectKPIsAchievedPercent', e.target.value)}
              size="small"
              placeholder="e.g., 90%"
            />
          </Grid>

          <Grid item xs={12} md={4}>
            <TextField
              fullWidth
              label="Project Completion %"
              value={formData.projectCompletionPercent || '0%'}
              onChange={(e) => handleChange('projectCompletionPercent', e.target.value)}
              size="small"
              placeholder="e.g., 75%"
            />
          </Grid>

          <Grid item xs={12} md={4}>
            <TextField
              fullWidth
              type="number"
              label="Cost of Poor Quality (AED)"
              value={formData.costOfPoorQualityAED || 0}
              onChange={(e) => handleChange('costOfPoorQualityAED', parseFloat(e.target.value) || 0)}
              size="small"
            />
          </Grid>

          {/* Remarks */}
          <Grid item xs={12}>
            <TextField
              fullWidth
              label="Remarks"
              value={formData.remarks || ''}
              onChange={(e) => handleChange('remarks', e.target.value)}
              size="small"
              multiline
              rows={3}
              placeholder="Add any additional notes or comments..."
            />
          </Grid>
        </Grid>
      </DialogContent>

      <DialogActions sx={{ px: 3, py: 2, borderTop: 1, borderColor: 'divider' }}>
        <Button 
          onClick={onClose} 
          disabled={loading}
          variant="outlined"
        >
          Cancel
        </Button>
        <Button 
          onClick={handleSubmit}
          disabled={loading}
          variant="contained"
          startIcon={loading ? <CircularProgress size={20} /> : <Save />}
        >
          {loading ? 'Saving...' : 'Save Changes'}
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default ProjectEditModal;
