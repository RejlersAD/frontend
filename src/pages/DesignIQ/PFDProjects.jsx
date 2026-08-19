import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
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
  IconButton,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  CircularProgress,
  Alert,
  Tooltip,
} from '@mui/material';
import {
  Add as AddIcon,
  Folder as FolderIcon,
  Description as DescriptionIcon,
  CloudUpload as CloudUploadIcon,
  Visibility as VisibilityIcon,
  Search as SearchIcon,
} from '@mui/icons-material';

const PFDProjects = () => {
  const navigate = useNavigate();
  const [projects, setProjects] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [openCreateDialog, setOpenCreateDialog] = useState(false);
  const [newProject, setNewProject] = useState({
    project_name: '',
    description: '',
  });
  const [createLoading, setCreateLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000';

  useEffect(() => {
    fetchProjects();
  }, [searchQuery]);

  const fetchProjects = async () => {
    try {
      setLoading(true);
      const token = localStorage.getItem('token');
      const params = searchQuery ? { search: searchQuery } : {};
      
      const response = await axios.get(`${API_BASE_URL}/api/v1/pfd/projects/`, {
        headers: { Authorization: `Bearer ${token}` },
        params,
      });

      if (response.data.success) {
        setProjects(response.data.projects);
      }
    } catch (err) {
      console.error('Error fetching projects:', err);
      setError('Failed to load projects');
    } finally {
      setLoading(false);
    }
  };

  const handleCreateProject = async () => {
    if (!newProject.project_name.trim()) {
      setError('Project name is required');
      return;
    }

    try {
      setCreateLoading(true);
      setError('');
      const token = localStorage.getItem('token');

      const response = await axios.post(
        `${API_BASE_URL}/api/v1/pfd/projects/`,
        newProject,
        {
          headers: { Authorization: `Bearer ${token}` },
        }
      );

      if (response.data.success) {
        setSuccess(`Project ${response.data.project.project_id} created successfully!`);
        setOpenCreateDialog(false);
        setNewProject({ project_name: '', description: '' });
        fetchProjects();
        
        // Navigate to the newly created project
        setTimeout(() => {
          navigate(`/designiq/pfd-verification/${response.data.project.id}`);
        }, 1500);
      }
    } catch (err) {
      console.error('Error creating project:', err);
      setError(err.response?.data?.error || 'Failed to create project');
    } finally {
      setCreateLoading(false);
    }
  };

  const handleViewProject = (projectId) => {
    navigate(`/designiq/pfd-verification/${projectId}`);
  };

  return (
    <Box sx={{ p: 3 }}>
      {/* Header */}
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Box>
          <Typography variant="h4" sx={{ fontWeight: 600, color: '#2c3e50', mb: 1 }}>
            PFD Projects
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Manage your PFD verification projects with reference documents
          </Typography>
        </Box>
        <Button
          variant="contained"
          startIcon={<AddIcon />}
          onClick={() => setOpenCreateDialog(true)}
          sx={{
            background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
            textTransform: 'none',
            px: 3,
            '&:hover': {
              background: 'linear-gradient(135deg, #5568d3 0%, #6a3f8f 100%)',
            },
          }}
        >
          Create New Project
        </Button>
      </Box>

      {/* Search */}
      <Box sx={{ mb: 3 }}>
        <TextField
          fullWidth
          placeholder="Search projects by name or ID..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          InputProps={{
            startAdornment: <SearchIcon sx={{ mr: 1, color: 'text.secondary' }} />,
          }}
          sx={{
            '& .MuiOutlinedInput-root': {
              backgroundColor: '#fff',
            },
          }}
        />
      </Box>

      {/* Success/Error Messages */}
      {success && (
        <Alert severity="success" onClose={() => setSuccess('')} sx={{ mb: 2 }}>
          {success}
        </Alert>
      )}
      {error && (
        <Alert severity="error" onClose={() => setError('')} sx={{ mb: 2 }}>
          {error}
        </Alert>
      )}

      {/* Projects Grid */}
      {loading ? (
        <Box sx={{ display: 'flex', justifyContent: 'center', py: 5 }}>
          <CircularProgress />
        </Box>
      ) : projects.length === 0 ? (
        <Card sx={{ p: 5, textAlign: 'center', backgroundColor: '#f8f9fa' }}>
          <FolderIcon sx={{ fontSize: 80, color: '#cbd5e0', mb: 2 }} />
          <Typography variant="h6" color="text.secondary" gutterBottom>
            No projects found
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
            Create your first PFD project to get started
          </Typography>
          <Button
            variant="contained"
            startIcon={<AddIcon />}
            onClick={() => setOpenCreateDialog(true)}
            sx={{
              background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
              textTransform: 'none',
            }}
          >
            Create Project
          </Button>
        </Card>
      ) : (
        <Grid container spacing={3}>
          {projects.map((project) => (
            <Grid item xs={12} sm={6} md={4} key={project.id}>
              <Card
                sx={{
                  height: '100%',
                  display: 'flex',
                  flexDirection: 'column',
                  transition: 'all 0.3s ease',
                  '&:hover': {
                    transform: 'translateY(-4px)',
                    boxShadow: '0 8px 24px rgba(0,0,0,0.12)',
                  },
                }}
              >
                <CardContent sx={{ flexGrow: 1 }}>
                  {/* Project Icon and Name */}
                  <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
                    <Box
                      sx={{
                        width: 48,
                        height: 48,
                        borderRadius: 2,
                        background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        mr: 2,
                      }}
                    >
                      <FolderIcon sx={{ color: '#fff', fontSize: 28 }} />
                    </Box>
                    <Box sx={{ flexGrow: 1 }}>
                      <Typography variant="h6" sx={{ fontWeight: 600, mb: 0.5 }}>
                        {project.project_name}
                      </Typography>
                      <Chip
                        label={project.project_id}
                        size="small"
                        sx={{
                          fontSize: '0.7rem',
                          height: 20,
                          backgroundColor: '#e3f2fd',
                          color: '#1976d2',
                        }}
                      />
                    </Box>
                  </Box>

                  {/* Description */}
                  {project.description && (
                    <Typography
                      variant="body2"
                      color="text.secondary"
                      sx={{
                        mb: 2,
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        display: '-webkit-box',
                        WebkitLineClamp: 2,
                        WebkitBoxOrient: 'vertical',
                      }}
                    >
                      {project.description}
                    </Typography>
                  )}

                  {/* Stats */}
                  <Box sx={{ display: 'flex', gap: 2, mb: 2 }}>
                    <Tooltip title="PFD Uploads">
                      <Chip
                        icon={<DescriptionIcon />}
                        label={`${project.pfd_count} PFDs`}
                        size="small"
                        variant="outlined"
                      />
                    </Tooltip>
                    <Tooltip title="Reference Documents">
                      <Chip
                        icon={<CloudUploadIcon />}
                        label={`${project.reference_docs_count}/8 Refs`}
                        size="small"
                        variant="outlined"
                        color={project.reference_docs_count === 8 ? 'success' : 'default'}
                      />
                    </Tooltip>
                  </Box>

                  {/* Created Info */}
                  <Typography variant="caption" color="text.secondary">
                    Created by {project.created_by_name} on{' '}
                    {new Date(project.created_at).toLocaleDateString()}
                  </Typography>
                </CardContent>

                {/* Actions */}
                <Box
                  sx={{
                    p: 2,
                    pt: 0,
                    display: 'flex',
                    justifyContent: 'flex-end',
                  }}
                >
                  <Button
                    variant="contained"
                    startIcon={<VisibilityIcon />}
                    onClick={() => handleViewProject(project.id)}
                    sx={{
                      textTransform: 'none',
                      background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                      '&:hover': {
                        background: 'linear-gradient(135deg, #5568d3 0%, #6a3f8f 100%)',
                      },
                    }}
                  >
                    Open Project
                  </Button>
                </Box>
              </Card>
            </Grid>
          ))}
        </Grid>
      )}

      {/* Create Project Dialog */}
      <Dialog
        open={openCreateDialog}
        onClose={() => !createLoading && setOpenCreateDialog(false)}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle>Create New PFD Project</DialogTitle>
        <DialogContent>
          <Box sx={{ pt: 2 }}>
            <TextField
              fullWidth
              label="Project Name"
              required
              value={newProject.project_name}
              onChange={(e) =>
                setNewProject({ ...newProject, project_name: e.target.value })
              }
              sx={{ mb: 3 }}
            />
            <TextField
              fullWidth
              label="Description"
              multiline
              rows={3}
              value={newProject.description}
              onChange={(e) =>
                setNewProject({ ...newProject, description: e.target.value })
              }
              helperText="Optional: Add a description for this project"
            />
          </Box>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button
            onClick={() => setOpenCreateDialog(false)}
            disabled={createLoading}
            sx={{ textTransform: 'none' }}
          >
            Cancel
          </Button>
          <Button
            variant="contained"
            onClick={handleCreateProject}
            disabled={createLoading}
            sx={{
              textTransform: 'none',
              background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
              minWidth: 120,
            }}
          >
            {createLoading ? <CircularProgress size={24} /> : 'Create Project'}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default PFDProjects;
