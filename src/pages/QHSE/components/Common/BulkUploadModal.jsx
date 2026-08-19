import React, { useState } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Box,
  Typography,
  Alert,
  CircularProgress,
  LinearProgress,
  IconButton,
  List,
  ListItem,
  ListItemText
} from '@mui/material';
import { Upload, X, FileSpreadsheet, CheckCircle, AlertCircle } from 'lucide-react';
import { STORAGE_KEYS } from '../../../../config/app.config';
import { API_BASE_URL } from '../../../../config/api.config';

/**
 * Bulk Upload Modal - Soft-coded Excel upload for QHSE projects
 * Replaces manual Google Forms with direct Excel upload
 */
export const BulkUploadModal = ({ open, onClose, onSuccess }) => {
  const [selectedFile, setSelectedFile] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState(null);
  const [result, setResult] = useState(null);

  const handleFileSelect = (event) => {
    const file = event.target.files[0];
    if (file) {
      // Validate file type
      const validTypes = [
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'application/vnd.ms-excel'
      ];
      if (!validTypes.includes(file.type) && !file.name.endsWith('.xlsx')) {
        setError('Please select a valid Excel file (.xlsx)');
        return;
      }
      setSelectedFile(file);
      setError(null);
      setResult(null);
    }
  };

  const handleUpload = async () => {
    if (!selectedFile) {
      setError('Please select a file first');
      return;
    }

    setUploading(true);
    setError(null);
    setProgress(10);

    try {
      const token = localStorage.getItem(STORAGE_KEYS.ACCESS_TOKEN);
      if (!token) {
        throw new Error('Authentication required');
      }

      const formData = new FormData();
      formData.append('file', selectedFile);

      setProgress(30);

      const response = await fetch(
        `${API_BASE_URL}/qhse/projects/bulk_upload/`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${token}`,
          },
          body: formData
        }
      );

      setProgress(70);

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.detail || 'Upload failed');
      }

      const resultData = await response.json();
      setProgress(100);
      setResult(resultData);

      // Notify parent component
      if (onSuccess) {
        setTimeout(() => onSuccess(), 2000);
      }

    } catch (err) {
      console.error('Upload error:', err);
      setError(err.message);
      setProgress(0);
    } finally {
      setUploading(false);
    }
  };

  const handleClose = () => {
    if (!uploading) {
      setSelectedFile(null);
      setError(null);
      setResult(null);
      setProgress(0);
      onClose();
    }
  };

  return (
    <Dialog
      open={open}
      onClose={handleClose}
      maxWidth="sm"
      fullWidth
      PaperProps={{
        sx: {
          borderRadius: 2,
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
          Bulk Upload Projects
        </Typography>
        <IconButton onClick={handleClose} size="small" disabled={uploading}>
          <X />
        </IconButton>
      </DialogTitle>

      <DialogContent sx={{ mt: 2 }}>
        {error && (
          <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError(null)}>
            {error}
          </Alert>
        )}

        {result && (
          <Alert 
            severity="success" 
            icon={<CheckCircle />}
            sx={{ mb: 2 }}
          >
            <Typography variant="body2" fontWeight={600}>
              Upload Successful!
            </Typography>
            <List dense>
              <ListItem>
                <ListItemText 
                  primary={`Created: ${result.created || 0}`}
                  primaryTypographyProps={{ variant: 'body2' }}
                />
              </ListItem>
              <ListItem>
                <ListItemText 
                  primary={`Updated: ${result.updated || 0}`}
                  primaryTypographyProps={{ variant: 'body2' }}
                />
              </ListItem>
              {result.skipped > 0 && (
                <ListItem>
                  <ListItemText 
                    primary={`Skipped: ${result.skipped}`}
                    primaryTypographyProps={{ variant: 'body2', color: 'warning.main' }}
                  />
                </ListItem>
              )}
            </List>
          </Alert>
        )}

        {!result && (
          <>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
              Upload an Excel file (.xlsx) containing QHSE project data. The system will automatically create new projects or update existing ones based on project numbers.
            </Typography>

            <Box
              sx={{
                border: 2,
                borderColor: selectedFile ? 'primary.main' : 'divider',
                borderStyle: 'dashed',
                borderRadius: 2,
                p: 4,
                textAlign: 'center',
                backgroundColor: selectedFile ? 'action.hover' : 'background.default',
                cursor: 'pointer',
                transition: 'all 0.3s',
                '&:hover': {
                  borderColor: 'primary.main',
                  backgroundColor: 'action.hover',
                }
              }}
              onClick={() => document.getElementById('bulk-upload-input').click()}
            >
              <input
                id="bulk-upload-input"
                type="file"
                accept=".xlsx,.xls"
                onChange={handleFileSelect}
                style={{ display: 'none' }}
                disabled={uploading}
              />

              {selectedFile ? (
                <Box>
                  <FileSpreadsheet size={48} style={{ color: '#10b981', marginBottom: 8 }} />
                  <Typography variant="body1" fontWeight={600}>
                    {selectedFile.name}
                  </Typography>
                  <Typography variant="caption" color="text.secondary">
                    {(selectedFile.size / 1024).toFixed(2)} KB
                  </Typography>
                </Box>
              ) : (
                <Box>
                  <Upload size={48} style={{ color: '#9ca3af', marginBottom: 8 }} />
                  <Typography variant="body1" fontWeight={600}>
                    Click to select Excel file
                  </Typography>
                  <Typography variant="caption" color="text.secondary">
                    or drag and drop here
                  </Typography>
                </Box>
              )}
            </Box>

            {uploading && (
              <Box sx={{ mt: 3 }}>
                <LinearProgress variant="determinate" value={progress} />
                <Typography variant="caption" color="text.secondary" align="center" sx={{ mt: 1, display: 'block' }}>
                  Uploading... {progress}%
                </Typography>
              </Box>
            )}

            <Alert severity="info" icon={<AlertCircle />} sx={{ mt: 3 }}>
              <Typography variant="caption">
                <strong>Expected format:</strong> Excel file should contain sheets with project data matching the QHSE structure. 
                Existing projects will be updated based on project numbers.
              </Typography>
            </Alert>
          </>
        )}
      </DialogContent>

      <DialogActions sx={{ px: 3, py: 2, borderTop: 1, borderColor: 'divider' }}>
        {!result ? (
          <>
            <Button onClick={handleClose} disabled={uploading} variant="outlined">
              Cancel
            </Button>
            <Button
              onClick={handleUpload}
              disabled={!selectedFile || uploading}
              variant="contained"
              startIcon={uploading ? <CircularProgress size={20} /> : <Upload />}
            >
              {uploading ? 'Uploading...' : 'Upload'}
            </Button>
          </>
        ) : (
          <Button onClick={handleClose} variant="contained">
            Close
          </Button>
        )}
      </DialogActions>
    </Dialog>
  );
};

export default BulkUploadModal;
