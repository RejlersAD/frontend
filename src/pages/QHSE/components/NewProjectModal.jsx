import React, { useState, useEffect } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  TextField,
  Grid,
  Alert,
  CircularProgress,
  Typography,
  Divider,
  Box,
} from '@mui/material';
import { XMarkIcon } from '@heroicons/react/24/outline';

/**
 * New/Edit Project Modal - QHSE Running Projects
 * Comprehensive form for creating and editing QHSE projects
 * Integrates with Django backend API
 */
const NewProjectModal = ({ open, onClose, onProjectCreated, editMode = false, projectData = null }) => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [formData, setFormData] = useState({
    // Required fields
    projectNo: '',
    projectTitle: '',
    client: '',
    projectManager: '',
    
    // Optional identification
    projectQualityEng: '',
    
    // Timeline
    projectStartingDate: '',
    projectClosingDate: '',
    projectExtension: '',
    
    // Quality Plan
    projectQualityPlanStatusRev: '',
    projectQualityPlanStatusIssueDate: '',
    
    // Audits
    projectAudit1: '',
    projectAudit2: '',
    projectAudit3: '',
    projectAudit4: '',
    clientAudit1: '',
    clientAudit2: '',
    delayInAuditsNoDays: 0,
    
    // CARs
    carsOpen: 0,
    carsDelayedClosingNoDays: 0,
    carsClosed: 0,
    
    // Observations
    obsOpen: 0,
    obsDelayedClosingNoDays: 0,
    obsClosed: 0,
    
    // Performance Metrics
    projectKPIsAchievedPercent: '0',
    projectCompletionPercent: '0',
    rejectionOfDeliverablesPercent: '',
    costOfPoorQualityAED: 0,
    
    // Additional
    remarks: '',
  });

  // Populate form data when editing
  useEffect(() => {
    if (editMode && projectData && open) {
      setFormData({
        projectNo: projectData.projectNo || '',
        projectTitle: projectData.projectTitle || '',
        client: projectData.client || '',
        projectManager: projectData.projectManager || '',
        projectQualityEng: projectData.projectQualityEng || '',
        projectStartingDate: projectData.projectStartingDate || '',
        projectClosingDate: projectData.projectClosingDate || '',
        projectExtension: projectData.projectExtension || '',
        projectQualityPlanStatusRev: projectData.projectQualityPlanStatusRev || '',
        projectQualityPlanStatusIssueDate: projectData.projectQualityPlanStatusIssueDate || '',
        projectAudit1: projectData.projectAudit1 || '',
        projectAudit2: projectData.projectAudit2 || '',
        projectAudit3: projectData.projectAudit3 || '',
        projectAudit4: projectData.projectAudit4 || '',
        clientAudit1: projectData.clientAudit1 || '',
        clientAudit2: projectData.clientAudit2 || '',
        delayInAuditsNoDays: projectData.delayInAuditsNoDays || 0,
        carsOpen: projectData.carsOpen || 0,
        carsDelayedClosingNoDays: projectData.carsDelayedClosingNoDays || 0,
        carsClosed: projectData.carsClosed || 0,
        obsOpen: projectData.obsOpen || 0,
        obsDelayedClosingNoDays: projectData.obsDelayedClosingNoDays || 0,
        obsClosed: projectData.obsClosed || 0,
        projectKPIsAchievedPercent: projectData.projectKPIsAchievedPercent || '0',
        projectCompletionPercent: projectData.projectCompletionPercent || '0',
        rejectionOfDeliverablesPercent: projectData.rejectionOfDeliverablesPercent || '',
        costOfPoorQualityAED: projectData.costOfPoorQualityAED || 0,
        remarks: projectData.remarks || '',
      });
    } else if (!editMode && open) {
      // Reset form for new project
      setFormData({
        projectNo: '',
        projectTitle: '',
        client: '',
        projectManager: '',
        projectQualityEng: '',
        projectStartingDate: '',
        projectClosingDate: '',
        projectExtension: '',
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
        projectKPIsAchievedPercent: '0',
        projectCompletionPercent: '0',
        rejectionOfDeliverablesPercent: '',
        costOfPoorQualityAED: 0,
        remarks: '',
      });
    }
  }, [editMode, projectData, open]);

  const handleChange = (field) => (event) => {
    setFormData({
      ...formData,
      [field]: event.target.value,
    });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    // Validation
    if (!formData.projectNo || !formData.projectTitle || !formData.client || !formData.projectManager) {
      setError('Please fill in all required fields (Project No, Title, Client, Manager)');
      return;
    }

    try {
      setLoading(true);
      setError(null);

      // Import the API service
      const { qhseProjectsAPI } = await import('../../../services/qhse.service');

      let result;
      if (editMode && projectData) {
        // Update existing project
        result = await qhseProjectsAPI.update(projectData.id, formData);
      } else {
        // Create new project
        result = await qhseProjectsAPI.create(formData);
      }

      // Notify parent component
      if (onProjectCreated) {
        onProjectCreated(result);
      }

      // Close modal
      onClose();
    } catch (err) {
      console.error('Error creating project:', err);
      setError(err.message || 'Failed to create project. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleClose = () => {
    if (!loading) {
      setFormData({
        projectNo: '',
        projectTitle: '',
        client: '',
        projectManager: '',
        projectQualityEng: '',
        projectStartingDate: '',
        projectClosingDate: '',
        projectExtension: '',
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
        projectKPIsAchievedPercent: '0',
        projectCompletionPercent: '0',
        rejectionOfDeliverablesPercent: '',
        costOfPoorQualityAED: 0,
        remarks: '',
      });
      setError(null);
      onClose();
    }
  };

  return (
    <Dialog 
      open={open} 
      onClose={handleClose} 
      maxWidth="md" 
      fullWidth
      PaperProps={{
        sx: { borderRadius: 2 }
      }}
    >
      <DialogTitle>
        <Box display="flex" justifyContent="space-between" alignItems="center">
          <Typography variant="h6" fontWeight="bold">
            {editMode ? 'Edit QHSE Project' : 'Create New QHSE Project'}
          </Typography>
          <Button
            onClick={handleClose}
            disabled={loading}
            sx={{ minWidth: 'auto', p: 0.5 }}
          >
            <XMarkIcon className="w-6 h-6 text-gray-500" />
          </Button>
        </Box>
      </DialogTitle>

      <form onSubmit={handleSubmit}>
        <DialogContent dividers>
          {error && (
            <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError(null)}>
              {error}
            </Alert>
          )}

          {/* Basic Information */}
          <Typography variant="subtitle1" fontWeight="bold" gutterBottom color="primary">
            Basic Information
          </Typography>
          <Grid container spacing={2} sx={{ mb: 3 }}>
            <Grid item xs={12} sm={6}>
              <TextField
                required
                fullWidth
                label="Project Number"
                value={formData.projectNo}
                onChange={handleChange('projectNo')}
                disabled={loading}
                size="small"
              />
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField
                required
                fullWidth
                label="Client"
                value={formData.client}
                onChange={handleChange('client')}
                disabled={loading}
                size="small"
              />
            </Grid>
            <Grid item xs={12}>
              <TextField
                required
                fullWidth
                label="Project Title"
                value={formData.projectTitle}
                onChange={handleChange('projectTitle')}
                disabled={loading}
                multiline
                rows={2}
                size="small"
              />
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField
                required
                fullWidth
                label="Project Manager"
                value={formData.projectManager}
                onChange={handleChange('projectManager')}
                disabled={loading}
                size="small"
              />
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField
                fullWidth
                label="Quality Engineer"
                value={formData.projectQualityEng}
                onChange={handleChange('projectQualityEng')}
                disabled={loading}
                size="small"
              />
            </Grid>
          </Grid>

          <Divider sx={{ my: 2 }} />

          {/* Timeline */}
          <Typography variant="subtitle1" fontWeight="bold" gutterBottom color="primary">
            Project Timeline
          </Typography>
          <Grid container spacing={2} sx={{ mb: 3 }}>
            <Grid item xs={12} sm={4}>
              <TextField
                fullWidth
                type="date"
                label="Starting Date"
                value={formData.projectStartingDate}
                onChange={handleChange('projectStartingDate')}
                disabled={loading}
                InputLabelProps={{ shrink: true }}
                size="small"
              />
            </Grid>
            <Grid item xs={12} sm={4}>
              <TextField
                fullWidth
                type="date"
                label="Closing Date"
                value={formData.projectClosingDate}
                onChange={handleChange('projectClosingDate')}
                disabled={loading}
                InputLabelProps={{ shrink: true }}
                size="small"
              />
            </Grid>
            <Grid item xs={12} sm={4}>
              <TextField
                fullWidth
                type="date"
                label="Extension Date"
                value={formData.projectExtension}
                onChange={handleChange('projectExtension')}
                disabled={loading}
                InputLabelProps={{ shrink: true }}
                size="small"
              />
            </Grid>
          </Grid>

          <Divider sx={{ my: 2 }} />

          {/* Quality Plan */}
          <Typography variant="subtitle1" fontWeight="bold" gutterBottom color="primary">
            Quality Plan
          </Typography>
          <Grid container spacing={2} sx={{ mb: 3 }}>
            <Grid item xs={12} sm={6}>
              <TextField
                fullWidth
                label="Quality Plan Status/Rev"
                value={formData.projectQualityPlanStatusRev}
                onChange={handleChange('projectQualityPlanStatusRev')}
                disabled={loading}
                size="small"
              />
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField
                fullWidth
                type="date"
                label="Quality Plan Issue Date"
                value={formData.projectQualityPlanStatusIssueDate}
                onChange={handleChange('projectQualityPlanStatusIssueDate')}
                disabled={loading}
                InputLabelProps={{ shrink: true }}
                size="small"
              />
            </Grid>
          </Grid>

          <Divider sx={{ my: 2 }} />

          {/* Audits */}
          <Typography variant="subtitle1" fontWeight="bold" gutterBottom color="primary">
            Project Audits
          </Typography>
          <Grid container spacing={2} sx={{ mb: 3 }}>
            <Grid item xs={6} sm={3}>
              <TextField
                fullWidth
                type="date"
                label="Audit 1"
                value={formData.projectAudit1}
                onChange={handleChange('projectAudit1')}
                disabled={loading}
                InputLabelProps={{ shrink: true }}
                size="small"
              />
            </Grid>
            <Grid item xs={6} sm={3}>
              <TextField
                fullWidth
                type="date"
                label="Audit 2"
                value={formData.projectAudit2}
                onChange={handleChange('projectAudit2')}
                disabled={loading}
                InputLabelProps={{ shrink: true }}
                size="small"
              />
            </Grid>
            <Grid item xs={6} sm={3}>
              <TextField
                fullWidth
                type="date"
                label="Audit 3"
                value={formData.projectAudit3}
                onChange={handleChange('projectAudit3')}
                disabled={loading}
                InputLabelProps={{ shrink: true }}
                size="small"
              />
            </Grid>
            <Grid item xs={6} sm={3}>
              <TextField
                fullWidth
                type="date"
                label="Audit 4"
                value={formData.projectAudit4}
                onChange={handleChange('projectAudit4')}
                disabled={loading}
                InputLabelProps={{ shrink: true }}
                size="small"
              />
            </Grid>
            <Grid item xs={6} sm={4}>
              <TextField
                fullWidth
                type="date"
                label="Client Audit 1"
                value={formData.clientAudit1}
                onChange={handleChange('clientAudit1')}
                disabled={loading}
                InputLabelProps={{ shrink: true }}
                size="small"
              />
            </Grid>
            <Grid item xs={6} sm={4}>
              <TextField
                fullWidth
                type="date"
                label="Client Audit 2"
                value={formData.clientAudit2}
                onChange={handleChange('clientAudit2')}
                disabled={loading}
                InputLabelProps={{ shrink: true }}
                size="small"
              />
            </Grid>
            <Grid item xs={12} sm={4}>
              <TextField
                fullWidth
                type="number"
                label="Delay in Audits (Days)"
                value={formData.delayInAuditsNoDays}
                onChange={handleChange('delayInAuditsNoDays')}
                disabled={loading}
                size="small"
              />
            </Grid>
          </Grid>

          <Divider sx={{ my: 2 }} />

          {/* CARs & Observations */}
          <Typography variant="subtitle1" fontWeight="bold" gutterBottom color="primary">
            CARs & Observations
          </Typography>
          <Grid container spacing={2} sx={{ mb: 3 }}>
            <Grid item xs={6} sm={4}>
              <TextField
                fullWidth
                type="number"
                label="CARs Open"
                value={formData.carsOpen}
                onChange={handleChange('carsOpen')}
                disabled={loading}
                size="small"
              />
            </Grid>
            <Grid item xs={6} sm={4}>
              <TextField
                fullWidth
                type="number"
                label="CARs Closed"
                value={formData.carsClosed}
                onChange={handleChange('carsClosed')}
                disabled={loading}
                size="small"
              />
            </Grid>
            <Grid item xs={12} sm={4}>
              <TextField
                fullWidth
                type="number"
                label="CARs Delay (Days)"
                value={formData.carsDelayedClosingNoDays}
                onChange={handleChange('carsDelayedClosingNoDays')}
                disabled={loading}
                size="small"
              />
            </Grid>
            <Grid item xs={6} sm={4}>
              <TextField
                fullWidth
                type="number"
                label="Observations Open"
                value={formData.obsOpen}
                onChange={handleChange('obsOpen')}
                disabled={loading}
                size="small"
              />
            </Grid>
            <Grid item xs={6} sm={4}>
              <TextField
                fullWidth
                type="number"
                label="Observations Closed"
                value={formData.obsClosed}
                onChange={handleChange('obsClosed')}
                disabled={loading}
                size="small"
              />
            </Grid>
            <Grid item xs={12} sm={4}>
              <TextField
                fullWidth
                type="number"
                label="Obs Delay (Days)"
                value={formData.obsDelayedClosingNoDays}
                onChange={handleChange('obsDelayedClosingNoDays')}
                disabled={loading}
                size="small"
              />
            </Grid>
          </Grid>

          <Divider sx={{ my: 2 }} />

          {/* Performance Metrics */}
          <Typography variant="subtitle1" fontWeight="bold" gutterBottom color="primary">
            Performance Metrics
          </Typography>
          <Grid container spacing={2} sx={{ mb: 3 }}>
            <Grid item xs={6} sm={3}>
              <TextField
                fullWidth
                label="KPIs Achieved %"
                value={formData.projectKPIsAchievedPercent}
                onChange={handleChange('projectKPIsAchievedPercent')}
                disabled={loading}
                size="small"
              />
            </Grid>
            <Grid item xs={6} sm={3}>
              <TextField
                fullWidth
                label="Completion %"
                value={formData.projectCompletionPercent}
                onChange={handleChange('projectCompletionPercent')}
                disabled={loading}
                size="small"
              />
            </Grid>
            <Grid item xs={6} sm={3}>
              <TextField
                fullWidth
                label="Rejection %"
                value={formData.rejectionOfDeliverablesPercent}
                onChange={handleChange('rejectionOfDeliverablesPercent')}
                disabled={loading}
                size="small"
              />
            </Grid>
            <Grid item xs={6} sm={3}>
              <TextField
                fullWidth
                type="number"
                label="Cost Poor Quality (AED)"
                value={formData.costOfPoorQualityAED}
                onChange={handleChange('costOfPoorQualityAED')}
                disabled={loading}
                size="small"
              />
            </Grid>
          </Grid>

          <Divider sx={{ my: 2 }} />

          {/* Remarks */}
          <Typography variant="subtitle1" fontWeight="bold" gutterBottom color="primary">
            Additional Information
          </Typography>
          <TextField
            fullWidth
            label="Remarks"
            value={formData.remarks}
            onChange={handleChange('remarks')}
            disabled={loading}
            multiline
            rows={3}
            size="small"
          />
        </DialogContent>

        <DialogActions sx={{ px: 3, py: 2 }}>
          <Button 
            onClick={handleClose} 
            disabled={loading}
            variant="outlined"
          >
            Cancel
          </Button>
          <Button 
            type="submit" 
            disabled={loading}
            variant="contained"
            startIcon={loading ? <CircularProgress size={20} /> : null}
          >
            {loading 
              ? (editMode ? 'Updating...' : 'Creating...') 
              : (editMode ? 'Update Project' : 'Create Project')}
          </Button>
        </DialogActions>
      </form>
    </Dialog>
  );
};

export default NewProjectModal;
