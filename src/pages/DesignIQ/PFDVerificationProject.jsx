import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import axios from 'axios';
import {
  Box,
  Button,
  Typography,
  TextField,
  Card,
  CardContent,
  Grid,
  Chip,
  LinearProgress,
  Alert,
  Stepper,
  Step,
  StepLabel,
  IconButton,
  Tooltip,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  List,
  ListItem,
  ListItemText,
  ListItemIcon,
  Divider,
} from '@mui/material';
import {
  ArrowBack as ArrowBackIcon,
  CloudUpload as CloudUploadIcon,
  CheckCircle as CheckCircleIcon,
  Description as DescriptionIcon,
  Close as CloseIcon,
  Upload as UploadIcon,
  Folder as FolderIcon,
} from '@mui/icons-material';

const PFDVerificationProject = () => {
  const { projectId } = useParams();
  const navigate = useNavigate();
  const [project, setProject] = useState(null);
  const [loading, setLoading] = useState(true);
  const [activeStep, setActiveStep] = useState(0);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  
  // Reference documents configuration
  const referenceDocTypes = [
    { key: 'bfd', label: 'BFD (Block Flow Diagram)', color: '#3b82f6' },
    { key: 'process_description', label: 'Process Description', color: '#10b981' },
    { key: 'process_design_basis', label: 'Process Design Basis', color: '#8b5cf6' },
    { key: 'operation_control_philosophy', label: 'Operation & Control Philosophy', color: '#f59e0b' },
    { key: 'scope_of_work', label: 'Scope of Work', color: '#6366f1' },
    { key: 'legends_symbols', label: 'Legends and Symbols of PFD', color: '#ec4899' },
    { key: 'equipment_datasheet', label: 'Equipment Data Sheet', color: '#14b8a6' },
    { key: 'other', label: 'Other Documents', color: '#6b7280' },
  ];

  const [referenceFiles, setReferenceFiles] = useState({});
  const [uploadingRef, setUploadingRef] = useState('');
  const [pfdFile, setPfdFile] = useState(null);
  const [pfdMetadata, setPfdMetadata] = useState({
    drawing_number: '',
    drawing_revision: '',
    drawing_title: '',
    project_name_field: '',
  });
  const [uploadingPfd, setUploadingPfd] = useState(false);

  const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000';

  const steps = ['Upload Reference Documents', 'Upload PFD', 'Review & Process'];

  useEffect(() => {
    if (projectId) {
      fetchProject();
    }
  }, [projectId]);

  const fetchProject = async () => {
    try {
      setLoading(true);
      const token = localStorage.getItem('token');
      const response = await axios.get(
        `${API_BASE_URL}/api/v1/pfd/projects/${projectId}/`,
        {
          headers: { Authorization: `Bearer ${token}` },
        }
      );

      if (response.data.success) {
        setProject(response.data.project);
        
        // Determine active step based on project state
        const refCount = Object.values(response.data.project.reference_documents || {}).filter(v => v).length;
        if (refCount === 0) {
          setActiveStep(0);
        } else if (response.data.project.pfd_count === 0) {
          setActiveStep(1);
        } else {
          setActiveStep(2);
        }
      }
    } catch (err) {
      console.error('Error fetching project:', err);
      setError('Failed to load project details');
    } finally {
      setLoading(false);
    }
  };

  const handleReferenceUpload = async (docType) => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.pdf';
    input.onchange = async (e) => {
      const file = e.target.files[0];
      if (!file) return;

      if (file.size > 50 * 1024 * 1024) {
        setError('File size must be less than 50MB');
        return;
      }

      try {
        setUploadingRef(docType);
        setError('');
        const token = localStorage.getItem('token');
        const formData = new FormData();
        formData.append('file', file);
        formData.append('document_type', docType);

        const response = await axios.post(
          `${API_BASE_URL}/api/v1/pfd/projects/${projectId}/upload-reference-doc/`,
          formData,
          {
            headers: {
              Authorization: `Bearer ${token}`,
              'Content-Type': 'multipart/form-data',
            },
          }
        );

        if (response.data.success) {
          setSuccess(`${referenceDocTypes.find(d => d.key === docType)?.label} uploaded successfully!`);
          fetchProject();
          setTimeout(() => setSuccess(''), 3000);
        }
      } catch (err) {
        console.error('Error uploading reference document:', err);
        setError(err.response?.data?.error || 'Failed to upload document');
      } finally {
        setUploadingRef('');
      }
    };
    input.click();
  };

  const handlePfdUpload = async () => {
    if (!pfdFile) {
      setError('Please select a PFD file');
      return;
    }

    try {
      setUploadingPfd(true);
      setError('');
      const token = localStorage.getItem('token');
      const formData = new FormData();
      formData.append('file', pfdFile);
      formData.append('drawing_number', pfdMetadata.drawing_number);
      formData.append('drawing_revision', pfdMetadata.drawing_revision);
      formData.append('drawing_title', pfdMetadata.drawing_title);
      formData.append('project_name_field', pfdMetadata.project_name_field);

      const response = await axios.post(
        `${API_BASE_URL}/api/v1/pfd/projects/${projectId}/upload-pfd/`,
        formData,
        {
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'multipart/form-data',
          },
        }
      );

      if (response.data.success) {
        setSuccess(`PFD uploaded successfully! Upload ID: ${response.data.upload.upload_id}`);
        setPfdFile(null);
        setPfdMetadata({
          drawing_number: '',
          drawing_revision: '',
          drawing_title: '',
          project_name_field: '',
        });
        fetchProject();
        setActiveStep(2);
        setTimeout(() => setSuccess(''), 5000);
      }
    } catch (err) {
      console.error('Error uploading PFD:', err);
      setError(err.response?.data?.error || 'Failed to upload PFD');
    } finally {
      setUploadingPfd(false);
    }
  };

  const renderReferenceDocumentsStep = () => {
    const uploadedDocs = project?.reference_documents || {};
    const uploadedCount = Object.values(uploadedDocs).filter(v => v).length;

    return (
      <Box>
        <Typography variant="h6" gutterBottom sx={{ mb: 3 }}>
          Upload Reference Documents ({uploadedCount}/8)
        </Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
          Upload all reference documents for this project. These will be used for PFD verification.
        </Typography>

        <Grid container spacing={2}>
          {referenceDocTypes.map((docType) => {
            const isUploaded = uploadedDocs[docType.key];
            const isUploading = uploadingRef === docType.key;

            return (
              <Grid item xs={12} sm={6} md={3} key={docType.key}>
                <Card
                  sx={{
                    border: `2px solid ${isUploaded ? '#10b981' : '#e5e7eb'}`,
                    backgroundColor: isUploaded ? '#f0fdf4' : '#fff',
                    cursor: 'pointer',
                    transition: 'all 0.3s ease',
                    '&:hover': {
                      borderColor: docType.color,
                      boxShadow: `0 4px 12px ${docType.color}33`,
                    },
                  }}
                  onClick={() => !isUploading && handleReferenceUpload(docType.key)}
                >
                  <CardContent sx={{ textAlign: 'center', py: 3 }}>
                    {isUploaded ? (
                      <CheckCircleIcon sx={{ fontSize: 48, color: '#10b981', mb: 1 }} />
                    ) : (
                      <CloudUploadIcon sx={{ fontSize: 48, color: docType.color, mb: 1 }} />
                    )}
                    <Typography variant="body2" sx={{ fontWeight: 600, mb: 1 }}>
                      {docType.label}
                    </Typography>
                    {isUploading && <LinearProgress sx={{ mt: 2 }} />}
                    {isUploaded && (
                      <Chip
                        label="Uploaded"
                        size="small"
                        sx={{ mt: 1, backgroundColor: '#10b981', color: '#fff' }}
                      />
                    )}
                  </CardContent>
                </Card>
              </Grid>
            );
          })}
        </Grid>

        <Box sx={{ mt: 4, display: 'flex', justifyContent: 'flex-end' }}>
          <Button
            variant="contained"
            onClick={() => setActiveStep(1)}
            disabled={uploadedCount === 0}
            sx={{
              textTransform: 'none',
              px: 4,
              background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
            }}
          >
            Continue to Upload PFD
          </Button>
        </Box>
      </Box>
    );
  };

  const renderPfdUploadStep = () => (
    <Box>
      <Typography variant="h6" gutterBottom sx={{ mb: 3 }}>
        Upload PFD Document
      </Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
        Upload a PFD document for verification. You can upload multiple PFDs to this project.
      </Typography>

      <Grid container spacing={3}>
        <Grid item xs={12} md={6}>
          <Card sx={{ p: 3 }}>
            <Typography variant="subtitle1" gutterBottom>
              PFD File
            </Typography>
            <Box
              sx={{
                border: '2px dashed #cbd5e0',
                borderRadius: 2,
                p: 4,
                textAlign: 'center',
                cursor: 'pointer',
                transition: 'all 0.3s ease',
                '&:hover': {
                  borderColor: '#667eea',
                  backgroundColor: '#f8f9fa',
                },
              }}
              onClick={() => document.getElementById('pfd-file-input').click()}
            >
              <input
                id="pfd-file-input"
                type="file"
                accept=".pdf"
                style={{ display: 'none' }}
                onChange={(e) => {
                  const file = e.target.files[0];
                  if (file && file.size <= 50 * 1024 * 1024) {
                    setPfdFile(file);
                  } else if (file) {
                    setError('File size must be less than 50MB');
                  }
                }}
              />
              <UploadIcon sx={{ fontSize: 48, color: '#667eea', mb: 2 }} />
              <Typography variant="body2" color="text.secondary">
                {pfdFile ? pfdFile.name : 'Click to select PFD file (PDF, max 50MB)'}
              </Typography>
            </Box>
          </Card>
        </Grid>

        <Grid item xs={12} md={6}>
          <Card sx={{ p: 3 }}>
            <Typography variant="subtitle1" gutterBottom>
              Drawing Metadata
            </Typography>
            <TextField
              fullWidth
              label="Drawing Number"
              value={pfdMetadata.drawing_number}
              onChange={(e) =>
                setPfdMetadata({ ...pfdMetadata, drawing_number: e.target.value })
              }
              sx={{ mb: 2 }}
            />
            <TextField
              fullWidth
              label="Drawing Revision"
              value={pfdMetadata.drawing_revision}
              onChange={(e) =>
                setPfdMetadata({ ...pfdMetadata, drawing_revision: e.target.value })
              }
              sx={{ mb: 2 }}
            />
            <TextField
              fullWidth
              label="Drawing Title"
              value={pfdMetadata.drawing_title}
              onChange={(e) =>
                setPfdMetadata({ ...pfdMetadata, drawing_title: e.target.value })
              }
              sx={{ mb: 2 }}
            />
            <TextField
              fullWidth
              label="Project Name"
              value={pfdMetadata.project_name_field}
              onChange={(e) =>
                setPfdMetadata({ ...pfdMetadata, project_name_field: e.target.value })
              }
            />
          </Card>
        </Grid>
      </Grid>

      <Box sx={{ mt: 4, display: 'flex', justifyContent: 'space-between' }}>
        <Button
          variant="outlined"
          onClick={() => setActiveStep(0)}
          sx={{ textTransform: 'none', px: 4 }}
        >
          Back
        </Button>
        <Button
          variant="contained"
          onClick={handlePfdUpload}
          disabled={!pfdFile || uploadingPfd}
          sx={{
            textTransform: 'none',
            px: 4,
            background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
          }}
        >
          {uploadingPfd ? 'Uploading...' : 'Upload PFD'}
        </Button>
      </Box>
    </Box>
  );

  const renderReviewStep = () => (
    <Box>
      <Typography variant="h6" gutterBottom sx={{ mb: 3 }}>
        Project Overview
      </Typography>

      <Grid container spacing={3}>
        <Grid item xs={12} md={6}>
          <Card sx={{ p: 3 }}>
            <Typography variant="subtitle1" gutterBottom>
              Reference Documents
            </Typography>
            <List>
              {referenceDocTypes.map((docType) => {
                const isUploaded = project?.reference_documents?.[docType.key];
                return (
                  <ListItem key={docType.key}>
                    <ListItemIcon>
                      {isUploaded ? (
                        <CheckCircleIcon sx={{ color: '#10b981' }} />
                      ) : (
                        <CloseIcon sx={{ color: '#ef4444' }} />
                      )}
                    </ListItemIcon>
                    <ListItemText primary={docType.label} />
                  </ListItem>
                );
              })}
            </List>
          </Card>
        </Grid>

        <Grid item xs={12} md={6}>
          <Card sx={{ p: 3 }}>
            <Typography variant="subtitle1" gutterBottom>
              PFD Uploads ({project?.pfd_count || 0})
            </Typography>
            {project?.pfd_uploads && project.pfd_uploads.length > 0 ? (
              <List>
                {project.pfd_uploads.map((upload) => (
                  <ListItem key={upload.id}>
                    <ListItemIcon>
                      <DescriptionIcon sx={{ color: '#667eea' }} />
                    </ListItemIcon>
                    <ListItemText
                      primary={upload.file_name}
                      secondary={`${upload.upload_id} - ${new Date(upload.uploaded_at).toLocaleString()}`}
                    />
                  </ListItem>
                ))}
              </List>
            ) : (
              <Typography variant="body2" color="text.secondary">
                No PFD uploads yet
              </Typography>
            )}
          </Card>
        </Grid>
      </Grid>

      <Box sx={{ mt: 4, display: 'flex', justifyContent: 'space-between' }}>
        <Button
          variant="outlined"
          onClick={() => setActiveStep(1)}
          sx={{ textTransform: 'none', px: 4 }}
        >
          Upload Another PFD
        </Button>
        <Button
          variant="contained"
          onClick={() => navigate('/designiq/pfd-projects')}
          sx={{
            textTransform: 'none',
            px: 4,
            background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
          }}
        >
          Back to Projects
        </Button>
      </Box>
    </Box>
  );

  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '60vh' }}>
        <Typography>Loading project...</Typography>
      </Box>
    );
  }

  if (!project) {
    return (
      <Box sx={{ p: 3 }}>
        <Alert severity="error">Project not found</Alert>
      </Box>
    );
  }

  return (
    <Box sx={{ p: 3 }}>
      {/* Header */}
      <Box sx={{ mb: 4 }}>
        <Button
          startIcon={<ArrowBackIcon />}
          onClick={() => navigate('/designiq/pfd-projects')}
          sx={{ mb: 2, textTransform: 'none' }}
        >
          Back to Projects
        </Button>
        <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
          <FolderIcon sx={{ fontSize: 32, color: '#667eea', mr: 2 }} />
          <Box>
            <Typography variant="h5" sx={{ fontWeight: 600 }}>
              {project.project_name}
            </Typography>
            <Chip label={project.project_id} size="small" sx={{ mt: 0.5 }} />
          </Box>
        </Box>
        {project.description && (
          <Typography variant="body2" color="text.secondary">
            {project.description}
          </Typography>
        )}
      </Box>

      {/* Success/Error Messages */}
      {success && (
        <Alert severity="success" onClose={() => setSuccess('')} sx={{ mb: 3 }}>
          {success}
        </Alert>
      )}
      {error && (
        <Alert severity="error" onClose={() => setError('')} sx={{ mb: 3 }}>
          {error}
        </Alert>
      )}

      {/* Stepper */}
      <Stepper activeStep={activeStep} sx={{ mb: 4 }}>
        {steps.map((label) => (
          <Step key={label}>
            <StepLabel>{label}</StepLabel>
          </Step>
        ))}
      </Stepper>

      {/* Step Content */}
      <Card sx={{ p: 4 }}>
        {activeStep === 0 && renderReferenceDocumentsStep()}
        {activeStep === 1 && renderPfdUploadStep()}
        {activeStep === 2 && renderReviewStep()}
      </Card>
    </Box>
  );
};

export default PFDVerificationProject;
