import React, { useState } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  TextField,
  Grid,
  Accordion,
  AccordionSummary,
  AccordionDetails,
  Typography,
  Box,
  Alert,
  CircularProgress,
  Divider
} from '@mui/material';
import {
  ChevronDown,
  Save,
  X,
  ClipboardList,
  Calendar,
  TrendingUp,
  BadgeCheck,
  AlertTriangle,
  Info
} from 'lucide-react';
import {
  projectFormSections,
  getInitialFormValues,
  validateFormData,
  formatFormDataForAPI
} from '../../../../config/qhseProjectForm.config';
import { qhseProjectsAPI } from '../../../../services/qhse.service';
import { toast } from 'react-toastify';

// Icon mapping
const iconMap = {
  ClipboardList: ClipboardList,
  Calendar: Calendar,
  TrendingUp: TrendingUp,
  BadgeCheck: BadgeCheck,
  AlertTriangle: AlertTriangle,
  Info: Info
};

const CreateProjectModal = ({ open, onClose, onSuccess }) => {
  const [formData, setFormData] = useState(getInitialFormValues());
  const [errors, setErrors] = useState({});
  const [submitting, setSubmitting] = useState(false);
  const [expandedSections, setExpandedSections] = useState(
    projectFormSections
      .filter(section => section.defaultExpanded)
      .map(section => section.id)
  );

  // Handle accordion expansion
  const handleAccordionChange = (sectionId) => (event, isExpanded) => {
    setExpandedSections(prev => 
      isExpanded 
        ? [...prev, sectionId]
        : prev.filter(id => id !== sectionId)
    );
  };

  // Handle field change
  const handleFieldChange = (fieldName, value) => {
    setFormData(prev => ({
      ...prev,
      [fieldName]: value
    }));
    
    // Clear error for this field
    if (errors[fieldName]) {
      setErrors(prev => {
        const newErrors = { ...prev };
        delete newErrors[fieldName];
        return newErrors;
      });
    }
  };

  // Handle form submission
  const handleSubmit = async () => {
    // Validate form
    const validationErrors = validateFormData(formData);
    if (Object.keys(validationErrors).length > 0) {
      setErrors(validationErrors);
      toast.error('Please fix the validation errors before submitting');
      return;
    }

    setSubmitting(true);
    try {
      // Format data for API
      const apiData = formatFormDataForAPI(formData);
      
      // Submit to API
      const response = await qhseProjectsAPI.create(apiData);
      
      toast.success('Project created successfully!');
      onSuccess(response);
      handleClose();
    } catch (error) {
      console.error('Error creating project:', error);
      toast.error(error.message || 'Failed to create project');
    } finally {
      setSubmitting(false);
    }
  };

  // Handle modal close
  const handleClose = () => {
    if (!submitting) {
      setFormData(getInitialFormValues());
      setErrors({});
      setExpandedSections(
        projectFormSections
          .filter(section => section.defaultExpanded)
          .map(section => section.id)
      );
      onClose();
    }
  };

  // Render field based on type
  const renderField = (field) => {
    const hasError = !!errors[field.name];
    const errorMessage = errors[field.name];

    const commonProps = {
      fullWidth: true,
      label: field.label,
      value: formData[field.name] || '',
      onChange: (e) => handleFieldChange(field.name, e.target.value),
      error: hasError,
      helperText: hasError ? errorMessage : field.helperText,
      required: field.required,
      placeholder: field.placeholder,
      size: 'small'
    };

    switch (field.type) {
      case 'textarea':
        return (
          <TextField
            {...commonProps}
            multiline
            rows={field.rows || 3}
          />
        );
      
      case 'number':
        return (
          <TextField
            {...commonProps}
            type="number"
            inputProps={{
              step: field.step || 1,
              min: field.min || 0
            }}
          />
        );
      
      case 'date':
        return (
          <TextField
            {...commonProps}
            type="date"
            InputLabelProps={{ shrink: true }}
          />
        );
      
      case 'text':
      default:
        return (
          <TextField {...commonProps} />
        );
    }
  };

  return (
    <Dialog 
      open={open} 
      onClose={handleClose}
      maxWidth="lg"
      fullWidth
      PaperProps={{
        sx: {
          minHeight: '80vh',
          maxHeight: '90vh'
        }
      }}
    >
      <DialogTitle>
        <Box display="flex" alignItems="center" justifyContent="space-between">
          <Box display="flex" alignItems="center" gap={1}>
            <ClipboardList size={24} />
            <Typography variant="h6" component="span">
              Create New QHSE Project
            </Typography>
          </Box>
          <Button
            onClick={handleClose}
            disabled={submitting}
            size="small"
            sx={{ minWidth: 'auto', p: 1 }}
          >
            <X size={20} />
          </Button>
        </Box>
      </DialogTitle>

      <Divider />

      <DialogContent sx={{ pt: 2 }}>
        {Object.keys(errors).length > 0 && (
          <Alert severity="error" sx={{ mb: 2 }}>
            Please correct the errors below before submitting.
          </Alert>
        )}

        {projectFormSections.map((section) => {
          const IconComponent = iconMap[section.icon] || ClipboardList;
          const isExpanded = expandedSections.includes(section.id);

          return (
            <Accordion
              key={section.id}
              expanded={isExpanded}
              onChange={handleAccordionChange(section.id)}
              sx={{ 
                mb: 1,
                '&:before': { display: 'none' },
                boxShadow: 1
              }}
            >
              <AccordionSummary
                expandIcon={<ChevronDown size={20} />}
                sx={{
                  backgroundColor: isExpanded ? 'primary.light' : 'grey.50',
                  '& .MuiAccordionSummary-content': {
                    alignItems: 'center',
                    gap: 1
                  }
                }}
              >
                <IconComponent size={20} />
                <Typography variant="subtitle1" fontWeight={600}>
                  {section.title}
                </Typography>
                <Typography variant="caption" color="text.secondary" sx={{ ml: 'auto', mr: 2 }}>
                  {section.fields.filter(f => f.required).length > 0 && 
                    `(${section.fields.filter(f => f.required).length} required)`
                  }
                </Typography>
              </AccordionSummary>
              
              <AccordionDetails sx={{ pt: 2 }}>
                <Grid container spacing={2}>
                  {section.fields.map((field) => (
                    <Grid item xs={12} sm={field.gridSize || 6} key={field.name}>
                      {renderField(field)}
                    </Grid>
                  ))}
                </Grid>
              </AccordionDetails>
            </Accordion>
          );
        })}
      </DialogContent>

      <Divider />

      <DialogActions sx={{ p: 2, gap: 1 }}>
        <Button
          onClick={handleClose}
          disabled={submitting}
          variant="outlined"
          startIcon={<X size={18} />}
        >
          Cancel
        </Button>
        <Button
          onClick={handleSubmit}
          disabled={submitting}
          variant="contained"
          startIcon={submitting ? <CircularProgress size={18} /> : <Save size={18} />}
        >
          {submitting ? 'Creating...' : 'Create Project'}
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default CreateProjectModal;
