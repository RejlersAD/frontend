/**
 * CRS Multi-Revision Workflow - SMART VERSION
 * With Preview Table & HTML-to-Excel Export
 */

import React, { useState } from 'react';
import { 
  Box, Button, Card, CardContent, TextField, Typography, Grid, Alert,
  Paper, Stepper, Step, StepLabel, CircularProgress, Divider,
  List, ListItem, ListItemText, Chip, Table, TableBody, TableCell,
  TableContainer, TableHead, TableRow, IconButton, Tooltip, Select, MenuItem, FormControl
} from '@mui/material';
import {
  CloudUpload as UploadIcon, CheckCircle as CheckIcon,
  Download as DownloadIcon, Visibility as PreviewIcon,
  TableChart as TableIcon, CloudDownload as CloudDownloadIcon
} from '@mui/icons-material';
import { withDashboardControls } from '../hoc/withPageControls';
import { PageControlButtons } from '../components/PageControlButtons';

// Smart configuration
const CONFIG = {
  API_BASE_URL: import.meta.env.VITE_API_URL || '/api/v1',
  TOKEN_KEYS: ['radai_access_token', 'access_token', 'access'],
  MAX_FILE_SIZE_MB: 50,
  ACCEPTED_FILE_TYPE: '.pdf'
};

const CRSMultiRevisionSmart = ({ pageControls }) => {
  // Step tracking
  const [currentStep, setCurrentStep] = useState(0);
  
  // Chain details
  const [chainForm, setChainForm] = useState({
    chain_id: '', document_title: '', document_number: '',
    project_name: '', contractor_name: '', department: '',
    notes: '', max_allowed_revisions: 10  // Flexible: user can set max, finish early
  });
  
  // Created chain and revisions
  const [createdChain, setCreatedChain] = useState(null);
  const [currentRevisionNumber, setCurrentRevisionNumber] = useState(1);
  const [uploadedRevisions, setUploadedRevisions] = useState([]);
  const [allComments, setAllComments] = useState([]); // For preview table
  
  // UI states
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);
  const [showPreview, setShowPreview] = useState(false);
  const [hasOpenComments, setHasOpenComments] = useState(false); // Track if previous revisions have open comments

  // Smart auto-generation of unique chain_id
  const generateUniqueChainId = () => {
    const timestamp = Date.now();
    const random = Math.floor(Math.random() * 1000).toString().padStart(3, '0');
    const prefix = chainForm.project_name ? 
      chainForm.project_name.substring(0, 3).toUpperCase().replace(/[^A-Z]/g, '') || 'CRS' : 
      'CRS';
    return `${prefix}-${timestamp}-${random}`;
  };

  const handleAutoGenerateChainId = () => {
    const newChainId = generateUniqueChainId();
    setChainForm({...chainForm, chain_id: newChainId});
    setSuccess(`Auto-generated Chain ID: ${newChainId}`);
    setTimeout(() => setSuccess(null), 3000);
  };

  // Smart auth helper
  const getAuthHeaders = () => {
    for (const key of CONFIG.TOKEN_KEYS) {
      const token = localStorage.getItem(key);
      if (token) return { 'Authorization': `Bearer ${token}` };
    }
    console.warn('[CRS] No auth token found');
    return {};
  };

  // Create Chain with smart error handling
  const handleCreateChain = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    // Client-side validation for required fields
    const requiredFields = {
      'Chain ID': chainForm.chain_id,
      'Document Title': chainForm.document_title,
      'Document Number': chainForm.document_number,
      'Project Name': chainForm.project_name
    };

    const missingFields = Object.entries(requiredFields)
      .filter(([_, value]) => !value || value.trim() === '')
      .map(([name, _]) => name);

    if (missingFields.length > 0) {
      setError(`Required fields missing: ${missingFields.join(', ')}`);
      setLoading(false);
      return;
    }

    try {
      console.log('[CRS] Submitting chain data:', chainForm);
      
      const response = await fetch(`${CONFIG.API_BASE_URL}/crs/revision-chains/`, {
        method: 'POST',
        headers: { ...getAuthHeaders(), 'Content-Type': 'application/json' },
        body: JSON.stringify(chainForm)
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        console.error('[CRS] Server error response:', JSON.stringify(errorData, null, 2));
        console.error('[CRS] Error data keys:', Object.keys(errorData));
        console.error('[CRS] Full error object:', errorData);
        
        // Smart error message extraction - handle all possible formats
        let errorMsg = `Failed: ${response.status}`;
        
        // Check for 'detail' field
        if (errorData.detail && typeof errorData.detail === 'string') {
          errorMsg = errorData.detail;
        }
        
        // Check for 'errors' object (DRF serializer errors)
        if (errorData.errors && typeof errorData.errors === 'object') {
          const fieldErrors = Object.entries(errorData.errors)
            .map(([field, errors]) => {
              const errorText = Array.isArray(errors) ? errors.join(', ') : String(errors);
              return `${field}: ${errorText}`;
            })
            .join(' | ');
          if (fieldErrors) errorMsg = fieldErrors;
        }
        
        // Check for direct field errors (DRF default format)
        else if (errorData && typeof errorData === 'object' && !errorData.detail && !errorData.errors) {
          // DRF returns errors like: {chain_id: ['error msg'], project_name: ['error msg']}
          const directErrors = Object.entries(errorData)
            .filter(([key]) => key !== 'non_field_errors')
            .map(([field, errors]) => {
              const errorText = Array.isArray(errors) ? errors.join(', ') : String(errors);
              return `${field}: ${errorText}`;
            });
          
          if (directErrors.length > 0) {
            errorMsg = directErrors.join(' | ');
          }
          
          // Check for non_field_errors
          if (errorData.non_field_errors) {
            const nfeText = Array.isArray(errorData.non_field_errors) 
              ? errorData.non_field_errors.join(', ') 
              : String(errorData.non_field_errors);
            errorMsg = nfeText;
          }
        }
        
        // Final fallback: stringify the entire error object
        if (errorMsg === `Failed: ${response.status}` && Object.keys(errorData).length > 0) {
          errorMsg = JSON.stringify(errorData);
        }
        
        console.error('[CRS] Final error message:', errorMsg);
        throw new Error(errorMsg);
      }

      const data = await response.json();
      setCreatedChain(data);
      setSuccess(`Chain "${data.chain_id}" created successfully!`);
      setCurrentStep(1);
      setError(null);
    } catch (err) {
      let errorMessage = err.message || 'Failed to create chain';
      
      // Smart handling for duplicate chain_id
      if (errorMessage.includes('already exists') || errorMessage.includes('chain_id')) {
        errorMessage += ' - Click "Auto-Generate ID" button to create a unique Chain ID.';
      }
      
      setError(errorMessage);
      console.error('[CRS] Create chain error:', err);
    } finally {
      setLoading(false);
    }
  };

  // Smart Status Change Handler with Dropdown
  const handleStatusChange = async (commentId, newStatus, revisionLabel, commentText) => {
    if (!createdChain?.id) {
      setError('❌ No revision chain found');
      return;
    }

    setLoading(true);
    try {
      const response = await fetch(
        `${CONFIG.API_BASE_URL}/crs/revision-chains/${createdChain.id}/close_comment/`,
        {
          method: 'POST',
          headers: {
            ...getAuthHeaders(),
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({ comment_id: commentId, status: newStatus })
        }
      );

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to update comment status');
      }

      // Smart state update: Update the comment status in local state
      setUploadedRevisions(prevRevisions => 
        prevRevisions.map(rev => {
          if (rev.comments && rev.comments.length > 0) {
            return {
              ...rev,
              comments: rev.comments.map(comment => 
                (comment.id === commentId || comment.comment_id === commentId)
                  ? { ...comment, status: newStatus }
                  : comment
              )
            };
          }
          // Also check nested data structure
          if (rev.data?.comments && rev.data.comments.length > 0) {
            return {
              ...rev,
              data: {
                ...rev.data,
                comments: rev.data.comments.map(comment =>
                  (comment.id === commentId || comment.comment_id === commentId)
                    ? { ...comment, status: newStatus }
                    : comment
                )
              }
            };
          }
          return rev;
        })
      );

      setSuccess(`✅ Status updated to "${newStatus}" successfully!`);
      setTimeout(() => setSuccess(''), 3000);
      
      // Force re-check of open comments after status change
      console.log('[CRS] Status updated, checking for remaining open comments...');
      
    } catch (err) {
      setError(`❌ Failed to update status: ${err.message}`);
      console.error('[CRS] Status change error:', err);
    } finally {
      setLoading(false);
    }
  };

  // Smart Close Comment Handler (for Action button)
  const handleCloseComment = async (commentId, revisionLabel, commentText) => {
    const confirmClose = window.confirm(
      `🔒 Close this comment?\n\nRevision: ${revisionLabel}\nComment: ${commentText?.substring(0, 100)}${commentText?.length > 100 ? '...' : ''}\n\nThis action will mark the comment as CLOSED.`
    );

    if (!confirmClose) return;

    await handleStatusChange(commentId, 'closed', revisionLabel, commentText);
  };

  // Check if there are open comments from previous revisions
  const checkForOpenComments = () => {
    console.log('[CRS] Checking for open comments...');
    console.log('[CRS] Current uploadedRevisions:', uploadedRevisions);
    console.log('[CRS] Current revision number:', currentRevisionNumber);
    
    if (uploadedRevisions.length === 0) {
      console.log('[CRS] No revisions uploaded yet');
      return false;
    }
    
    // For REV 2 upload, check REV 1. For REV 3, check REV 1 & 2, etc.
    // We check ALL previous revisions (not just the latest)
    const previousRevisions = uploadedRevisions;
    
    console.log(`[CRS] Checking ${previousRevisions.length} previous revision(s)`);
    
    // Check each revision for open comments
    for (const rev of previousRevisions) {
      const comments = rev.comments || rev.data?.comments || [];
      console.log(`[CRS] ${rev.label}: ${comments.length} total comments`);
      
      const openComments = comments.filter(comment => {
        const status = (comment.status || 'open').toLowerCase();
        const isOpen = status === 'open';
        if (isOpen) {
          console.log(`[CRS]   - OPEN: "${(comment.comment_text || comment.text || '').substring(0, 50)}..."`);
        }
        return isOpen;
      });
      
      if (openComments.length > 0) {
        console.log(`[CRS] ❌ FOUND ${openComments.length} open comment(s) in ${rev.label}`);
        return true;
      }
    }
    
    console.log('[CRS] ✅ All comments are closed');
    return false;
  };

  // Upload Revision with smart file validation
  const handleUploadRevision = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    // ⚠️ CRITICAL: Client-side validation FIRST - check local state
    if (uploadedRevisions.length > 0) {
      const hasOpenComments = checkForOpenComments();
      if (hasOpenComments) {
        setError('⚠️ BLOCKED: You have open comments from previous revisions! Please close all comments before uploading the next revision.');
        e.target.value = ''; // Reset file input
        console.error('[CRS] ❌ Upload blocked - open comments detected in frontend state');
        return; // BLOCK IMMEDIATELY
      }
    }

    // Smart validation
    if (!file.name.toLowerCase().endsWith('.pdf')) {
      setError('Only PDF files are accepted');
      return;
    }

    const fileSizeMB = file.size / (1024 * 1024);
    if (fileSizeMB > CONFIG.MAX_FILE_SIZE_MB) {
      setError(`File too large (${fileSizeMB.toFixed(1)} MB). Max: ${CONFIG.MAX_FILE_SIZE_MB} MB`);
      return;
    }

    // ⚠️ CRITICAL VALIDATION: Double-check with backend API
    if (uploadedRevisions.length > 0) {
      setLoading(true);
      setError(null);
      
      try {
        const checkResponse = await fetch(
          `${CONFIG.API_BASE_URL}/crs/revision-chains/${createdChain.id}/check_previous_comments_status/`,
          { headers: getAuthHeaders() }
        );

        if (!checkResponse.ok) {
          throw new Error(`Failed to verify comment status: ${checkResponse.status}`);
        }

        const checkData = await checkResponse.json();
        
        // BLOCK upload if any comments are still open
        if (!checkData.all_closed && checkData.open_count > 0) {
          setError(`⚠️ Cannot upload next revision! You must close all ${checkData.open_count} open comment(s) from previous revisions first. Use the "Close" action in the comments table below.`);
          setLoading(false);
          e.target.value = ''; // Reset file input to allow retry
          return;
        }
        
        // All comments closed - proceed with upload
        console.log(`[CRS] ✅ All previous comments closed, proceeding with REV ${currentRevisionNumber} upload`);
        
      } catch (err) {
        console.error('[CRS] Comment status check failed:', err);
        setError(`⚠️ Could not verify comment status: ${err.message}. Please ensure all previous comments are closed before uploading.`);
        setLoading(false);
        e.target.value = ''; // Reset file input
        return; // BLOCK upload on validation error
      }
    } else {
      // First revision - no validation needed
      setLoading(true);
      setError(null);
    }

    try {
      const formData = new FormData();
      formData.append('file', file);  // Backend expects 'file', not 'pdf_file'
      formData.append('revision_label', `Rev ${currentRevisionNumber}`);
      formData.append('notes', `Revision ${currentRevisionNumber} upload`);

      const response = await fetch(
        `${CONFIG.API_BASE_URL}/crs/revision-chains/${createdChain.id}/upload_and_add_revision/`,
        {
          method: 'POST',
          headers: getAuthHeaders(),
          body: formData
        }
      );

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || `Upload failed: ${response.status}`);
      }

      const data = await response.json();
      
      // Smart comment extraction from response
      let extractedComments = [];
      
      // Try multiple paths to find comments in the response
      if (data.data?.comments) {
        extractedComments = data.data.comments;
      } else if (data.comments) {
        extractedComments = data.comments;
      } else if (data.data?.document_details?.comments) {
        extractedComments = data.data.document_details.comments;
      }
      
      // Ensure all comments have a status field (default to 'open')
      extractedComments = extractedComments.map(comment => ({
        ...comment,
        status: comment.status || 'open' // CRITICAL: Default to 'open'
      }));
      
      console.log(`[CRS] Extracted ${extractedComments.length} comments with status:`, 
        extractedComments.map(c => ({ id: c.id, status: c.status })));
      
      // Store revision with extracted comments
      const revisionData = {
        number: currentRevisionNumber,
        label: `Rev ${currentRevisionNumber}`,
        fileName: file.name,
        data: data.data,
        uploadedAt: new Date().toISOString(),
        comments: extractedComments, // Store comments directly
        totalComments: data.data?.extraction_summary?.total_comments || extractedComments.length || 0
      };

      setUploadedRevisions(prev => [...prev, revisionData]);
      
      // Add comments to global comments list
      if (extractedComments.length > 0) {
        setAllComments(prev => [...prev, ...extractedComments.map(c => ({
          ...c,
          revision: revisionData.label,
          revision_label: revisionData.label,
          revisionNumber: currentRevisionNumber
        }))]);
      }

      setSuccess(`Revision ${currentRevisionNumber} uploaded successfully! (${revisionData.totalComments} comments found)`);
      setCurrentRevisionNumber(prev => prev + 1);
      setError(null);

      // Auto-show preview after first upload
      if (currentRevisionNumber === 1) {
        setShowPreview(true);
      }
    } catch (err) {
      setError(err.message || 'Upload failed');
      console.error('[CRS] Upload error:', err);
    } finally {
      setLoading(false);
      e.target.value = ''; // Reset file input
    }
  };

  // Smart HTML-to-Excel export - ALL revisions combined
  const handleDownloadExcel = async () => {
    try {
      setLoading(true);
      
      // Fetch all chain data
      const response = await fetch(
        `${CONFIG.API_BASE_URL}/crs/revision-chains/${createdChain.id}/`,
        { headers: getAuthHeaders() }
      );

      if (!response.ok) throw new Error('Failed to fetch chain data');
      
      const chainData = await response.json();

      // Build smart HTML table
      const html = generateSmartHTML(chainData, uploadedRevisions);

      // Convert to Excel-compatible format
      const blob = new Blob([html], { 
        type: 'application/vnd.ms-excel;charset=utf-8' 
      });
      
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `CRS_${chainData.chain_id}_ALL_REVISIONS_${new Date().toISOString().split('T')[0]}.xls`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);

      setSuccess('Combined Excel file downloaded successfully!');
    } catch (err) {
      setError(`Download failed: ${err.message}`);
      console.error('[CRS] Excel download error:', err);
    } finally {
      setLoading(false);
    }
  };

  // S3 Excel Download Handler - Try S3 first, fallback to on-the-fly generation
  const handleDownloadFromS3 = async (revisionIndex) => {
    try {
      const revision = uploadedRevisions[revisionIndex];
      
      if (!revision || !revision.data || !revision.data.revision) {
        throw new Error('Revision data not found');
      }

      const revisionData = revision.data.revision;
      
      // Check if S3 presigned URL exists
      if (revisionData.excel_download_url) {
        console.log(`✅ Downloading from S3: ${revision.label}`);
        
        // Download from S3 using presigned URL
        const link = document.createElement('a');
        link.href = revisionData.excel_download_url;
        link.download = `CRS_${createdChain.chain_id}_${revision.label}_${new Date().toISOString().split('T')[0]}.xls`;
        link.target = '_blank';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        
        setSuccess(`✅ Downloaded ${revision.label} from S3`);
        return;
      } else {
        // Fallback: Generate on-the-fly (existing logic)
        console.warn('⚠️ No S3 URL available, generating excel on-the-fly');
        handleDownloadSingleRevision(revisionIndex);
      }
    } catch (error) {
      console.error('❌ Error downloading from S3:', error);
      // Fallback to existing on-the-fly generation
      setError('S3 download failed, generating excel...');
      setTimeout(() => handleDownloadSingleRevision(revisionIndex), 1000);
    }
  };

  // Smart individual revision download - soft-coded for any revision
  const handleDownloadSingleRevision = async (revisionIndex) => {
    try {
      setLoading(true);
      const revision = uploadedRevisions[revisionIndex];
      
      if (!revision) {
        throw new Error('Revision not found');
      }

      // Fetch chain data for context
      const response = await fetch(
        `${CONFIG.API_BASE_URL}/crs/revision-chains/${createdChain.id}/`,
        { headers: getAuthHeaders() }
      );

      if (!response.ok) throw new Error('Failed to fetch chain data');
      
      const chainData = await response.json();

      // Build HTML for single revision
      const html = generateSingleRevisionHTML(chainData, revision);

      // Convert to Excel
      const blob = new Blob([html], { 
        type: 'application/vnd.ms-excel;charset=utf-8' 
      });
      
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `CRS_${chainData.chain_id}_${revision.label}_${new Date().toISOString().split('T')[0]}.xls`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);

      setSuccess(`${revision.label} Excel downloaded successfully!`);
    } catch (err) {
      setError(`Download failed: ${err.message}`);
      console.error('[CRS] Single revision download error:', err);
    } finally {
      setLoading(false);
    }
  };

  // Generate smart HTML for Excel export - ALL revisions
  const generateSmartHTML = (chainData, revisions) => {
    return `
      <html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:x="urn:schemas-microsoft-com:office:excel">
      <head>
        <meta charset="UTF-8">
        <style>
          table { border-collapse: collapse; width: 100%; margin-bottom: 20px; }
          th, td { border: 1px solid black; padding: 8px; text-align: left; }
          th { background-color: #4CAF50; color: white; font-weight: bold; }
          .section-header { background-color: #2196F3; color: white; font-weight: bold; font-size: 14px; }
          .revision-header { background-color: #FF9800; color: white; font-weight: bold; font-size: 13px; }
          .status-open { background-color: #FFEBEE; color: #C62828; font-weight: bold; }
          .status-closed { background-color: #E8F5E9; color: #2E7D32; font-weight: bold; }
          .rev-separator { height: 20px; background-color: #F5F5F5; }
        </style>
      </head>
      <body>
        <h2>CRS Multi-Revision Comparison Report</h2>
        <p><i>Generated on: ${new Date().toLocaleString()}</i></p>
        
        <!-- Chain Information -->
        <table>
          <tr class="section-header"><th colspan="2">Chain Information</th></tr>
          <tr><td><b>Chain ID</b></td><td>${chainData.chain_id || 'N/A'}</td></tr>
          <tr><td><b>Document Title</b></td><td>${chainData.document_title || 'N/A'}</td></tr>
          <tr><td><b>Document Number</b></td><td>${chainData.document_number || 'N/A'}</td></tr>
          <tr><td><b>Project Name</b></td><td>${chainData.project_name || 'N/A'}</td></tr>
          <tr><td><b>Contractor</b></td><td>${chainData.contractor_name || 'N/A'}</td></tr>
          <tr><td><b>Department</b></td><td>${chainData.department || 'N/A'}</td></tr>
          <tr><td><b>Total Revisions</b></td><td>${revisions.length}</td></tr>
        </table>
        <br/>
        
        <!-- Revisions Summary -->
        <table>
          <tr class="section-header"><th colspan="6">Revisions Summary</th></tr>
          <tr>
            <th>Revision</th>
            <th>File Name</th>
            <th>Total Comments</th>
            <th>Open Comments</th>
            <th>Closed Comments</th>
            <th>Uploaded At</th>
          </tr>
          ${revisions.map(rev => {
            const comments = rev.comments || rev.data?.comments || [];
            const openCount = comments.filter(c => (c.status || 'open').toLowerCase() === 'open').length;
            const closedCount = comments.filter(c => (c.status || 'open').toLowerCase() === 'closed').length;
            return `
            <tr>
              <td><b>${rev.label}</b></td>
              <td>${rev.fileName}</td>
              <td>${comments.length}</td>
              <td class="status-open">${openCount}</td>
              <td class="status-closed">${closedCount}</td>
              <td>${new Date(rev.uploadedAt).toLocaleString()}</td>
            </tr>
          `}).join('')}
        </table>
        <br/>
        
        <!-- Comments by Revision (Separated) -->
        ${revisions.map((rev, revIdx) => {
          const comments = rev.comments || rev.data?.comments || [];
          const openCount = comments.filter(c => (c.status || 'open').toLowerCase() === 'open').length;
          const closedCount = comments.filter(c => (c.status || 'open').toLowerCase() === 'closed').length;
          
          return `
          ${revIdx > 0 ? '<br/><br/>' : ''}
          <table>
            <tr class="revision-header">
              <th colspan="8">
                📄 ${rev.label} - ${comments.length} Comment${comments.length !== 1 ? 's' : ''} 
                (🔴 ${openCount} Open | ✅ ${closedCount} Closed)
              </th>
            </tr>
            <tr>
              <th>Page</th>
              <th>Reviewer</th>
              <th>Comment</th>
              <th>Type</th>
              <th>Discipline</th>
              <th>Drawing Ref</th>
              <th>Status</th>
              <th>Serial #</th>
            </tr>
            ${comments.length > 0 ? comments.map((comment, idx) => {
              const status = (comment.status || 'open').toLowerCase();
              const statusClass = status === 'open' ? 'status-open' : 'status-closed';
              return `
              <tr>
                <td>${comment.page_number || 'N/A'}</td>
                <td>${comment.reviewer_name || 'Not Provided'}</td>
                <td>${comment.comment_text || comment.text || 'N/A'}</td>
                <td>${comment.comment_type || comment.type || 'GENERAL'}</td>
                <td>${comment.discipline || 'Not Provided'}</td>
                <td>${comment.drawing_ref || 'N/A'}</td>
                <td class="${statusClass}">${status.toUpperCase()}</td>
                <td>${comment.serial_number || idx + 1}</td>
              </tr>
            `}).join('') : `
              <tr><td colspan="8" style="text-align: center; font-style: italic;">No comments found for ${rev.label}</td></tr>
            `}
          </table>
        `}).join('')}
        
        <br/><br/>
        <p style="font-size: 12px; color: #666;">
          <b>Legend:</b><br/>
          🔴 Open = Comment requires action<br/>
          ✅ Closed = Comment resolved<br/>
          <br/>
          <i>This report contains ${revisions.length} revision${revisions.length !== 1 ? 's' : ''} with detailed comment tracking.</i>
        </p>
      </body>
      </html>
    `;
  };

  // Generate HTML for SINGLE revision - soft-coded
  const generateSingleRevisionHTML = (chainData, revision) => {
    const comments = revision.comments || revision.data?.comments || revision.data?.document_details?.recent_activities || [];
    const openCount = comments.filter(c => (c.status || 'open').toLowerCase() === 'open').length;
    const closedCount = comments.filter(c => (c.status || 'open').toLowerCase() === 'closed').length;
    
    return `
      <html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:x="urn:schemas-microsoft-com:office:excel">
      <head>
        <meta charset="UTF-8">
        <style>
          table { border-collapse: collapse; width: 100%; margin-bottom: 15px; }
          th, td { border: 1px solid black; padding: 8px; text-align: left; }
          th { background-color: #4CAF50; color: white; font-weight: bold; }
          .section-header { background-color: #2196F3; color: white; font-weight: bold; }
          .status-open { background-color: #FFEBEE; color: #C62828; font-weight: bold; }
          .status-closed { background-color: #E8F5E9; color: #2E7D32; font-weight: bold; }
        </style>
      </head>
      <body>
        <h2>CRS Report - ${revision.label}</h2>
        <p><i>Generated on: ${new Date().toLocaleString()}</i></p>
        
        <!-- Chain Context -->
        <table>
          <tr class="section-header"><th colspan="2">Document Information</th></tr>
          <tr><td><b>Chain ID</b></td><td>${chainData.chain_id || 'N/A'}</td></tr>
          <tr><td><b>Document Title</b></td><td>${chainData.document_title || 'N/A'}</td></tr>
          <tr><td><b>Document Number</b></td><td>${chainData.document_number || 'N/A'}</td></tr>
          <tr><td><b>Project Name</b></td><td>${chainData.project_name || 'N/A'}</td></tr>
          <tr><td><b>Contractor</b></td><td>${chainData.contractor_name || 'N/A'}</td></tr>
          <tr><td><b>Department</b></td><td>${chainData.department || 'N/A'}</td></tr>
        </table>
        <br/>
        
        <!-- Revision Details -->
        <table>
          <tr class="section-header"><th colspan="2">Revision Details - ${revision.label}</th></tr>
          <tr><td><b>File Name</b></td><td>${revision.fileName}</td></tr>
          <tr><td><b>Uploaded At</b></td><td>${new Date(revision.uploadedAt).toLocaleString()}</td></tr>
          <tr><td><b>Total Comments</b></td><td>${comments.length}</td></tr>
          <tr><td><b>Open Comments</b></td><td class="status-open">${openCount}</td></tr>
          <tr><td><b>Closed Comments</b></td><td class="status-closed">${closedCount}</td></tr>
        </table>
        <br/>
        
        <!-- Comments for this revision -->
        <table>
          <tr class="section-header"><th colspan="8">Comments - ${revision.label} (${comments.length} Total)</th></tr>
          <tr>
            <th>Page</th>
            <th>Reviewer</th>
            <th>Comment</th>
            <th>Type</th>
            <th>Discipline</th>
            <th>Drawing Ref</th>
            <th>Status</th>
            <th>Serial #</th>
          </tr>
          ${comments.length > 0 ? comments.map((comment, idx) => {
            const status = (comment.status || 'open').toLowerCase();
            const statusClass = status === 'open' ? 'status-open' : 'status-closed';
            return `
            <tr>
              <td>${comment.page_number || 'N/A'}</td>
              <td>${comment.reviewer_name || 'Not Provided'}</td>
              <td>${comment.comment_text || comment.text || 'N/A'}</td>
              <td>${comment.comment_type || comment.type || 'GENERAL'}</td>
              <td>${comment.discipline || 'Not Provided'}</td>
              <td>${comment.drawing_ref || 'N/A'}</td>
              <td class="${statusClass}">${status.toUpperCase()}</td>
              <td>${comment.serial_number || idx + 1}</td>
            </tr>
          `}).join('') : '<tr><td colspan="8" style="text-align: center; font-style: italic;">No comments found for this revision</td></tr>'}
        </table>
        
        <br/>
        <p style="font-size: 12px; color: #666;">
          <b>Legend:</b><br/>
          🔴 Open = Comment requires action<br/>
          ✅ Closed = Comment resolved<br/>
        </p>
      </body>
      </html>
    `;
  };

  // Smart preview table component
  const PreviewTable = () => {
    if (!showPreview || uploadedRevisions.length === 0) return null;

    return (
      <Card sx={{ mt: 3, mb: 3 }}>
        <CardContent>
          <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
            <TableIcon sx={{ mr: 1, color: 'primary.main' }} />
            <Typography variant="h6">Preview: All Revisions & Comments</Typography>
            <Box sx={{ flexGrow: 1 }} />
            <Button
              variant="contained"
              color="success"
              startIcon={<DownloadIcon />}
              onClick={handleDownloadExcel}
              disabled={loading}
              sx={{ mr: 1 }}
            >
              Download All (Combined)
            </Button>
          </Box>

          <Divider sx={{ mb: 2 }} />

          {/* Chain Info */}
          <Typography variant="subtitle1" gutterBottom sx={{ fontWeight: 'bold' }}>
            Chain Information
          </Typography>
          <TableContainer component={Paper} sx={{ mb: 3, maxHeight: 200 }}>
            <Table size="small">
              <TableBody>
                <TableRow>
                  <TableCell sx={{ fontWeight: 'bold', width: '30%' }}>Chain ID</TableCell>
                  <TableCell>{createdChain?.chain_id}</TableCell>
                </TableRow>
                <TableRow>
                  <TableCell sx={{ fontWeight: 'bold' }}>Document Title</TableCell>
                  <TableCell>{createdChain?.document_title}</TableCell>
                </TableRow>
                <TableRow>
                  <TableCell sx={{ fontWeight: 'bold' }}>Project</TableCell>
                  <TableCell>{createdChain?.project_name}</TableCell>
                </TableRow>
                <TableRow>
                  <TableCell sx={{ fontWeight: 'bold' }}>Total Revisions</TableCell>
                  <TableCell>{uploadedRevisions.length}</TableCell>
                </TableRow>
              </TableBody>
            </Table>
          </TableContainer>

          {/* Revisions Summary with Individual Downloads */}
          <Typography variant="subtitle1" gutterBottom sx={{ fontWeight: 'bold' }}>
            Revisions Summary
          </Typography>
          <TableContainer component={Paper} sx={{ mb: 3, maxHeight: 300 }}>
            <Table size="small" stickyHeader>
              <TableHead>
                <TableRow>
                  <TableCell sx={{ fontWeight: 'bold', bgcolor: '#2196F3', color: 'white' }}>Revision</TableCell>
                  <TableCell sx={{ fontWeight: 'bold', bgcolor: '#2196F3', color: 'white' }}>File Name</TableCell>
                  <TableCell sx={{ fontWeight: 'bold', bgcolor: '#2196F3', color: 'white' }}>Comments</TableCell>
                  <TableCell sx={{ fontWeight: 'bold', bgcolor: '#2196F3', color: 'white' }}>Status</TableCell>
                  <TableCell sx={{ fontWeight: 'bold', bgcolor: '#2196F3', color: 'white' }} align="center">Download</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {uploadedRevisions.map((rev, idx) => (
                  <TableRow key={idx}>
                    <TableCell>{rev.label}</TableCell>
                    <TableCell>{rev.fileName}</TableCell>
                    <TableCell>
                      <Chip 
                        label={rev.data?.extraction_summary?.total_comments || 0}
                        color="primary"
                        size="small"
                      />
                    </TableCell>
                    <TableCell>
                      <Chip 
                        label={rev.data?.revision?.status || 'N/A'}
                        color="success"
                        size="small"
                      />
                    </TableCell>
                    <TableCell align="center">
                      <Tooltip title={rev.data?.revision?.excel_download_url ? "Download from S3 (instant)" : "Generate Excel"}>
                        <IconButton
                          color={rev.data?.revision?.excel_download_url ? "success" : "primary"}
                          size="small"
                          onClick={() => handleDownloadFromS3(idx)}
                          disabled={loading}
                        >
                          {rev.data?.revision?.excel_download_url ? 
                            <CloudDownloadIcon fontSize="small" /> : 
                            <DownloadIcon fontSize="small" />
                          }
                        </IconButton>
                      </Tooltip>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>

          {/* Comments Detail (if available) */}
          <Typography variant="subtitle1" gutterBottom sx={{ fontWeight: 'bold' }}>
            All Comments Across Revisions
          </Typography>
          <TableContainer component={Paper} sx={{ maxHeight: 400 }}>
            <Table size="small" stickyHeader>
              <TableHead>
                <TableRow>
                  <TableCell sx={{ fontWeight: 'bold', bgcolor: '#4CAF50', color: 'white' }}>Revision</TableCell>
                  <TableCell sx={{ fontWeight: 'bold', bgcolor: '#4CAF50', color: 'white' }}>Page</TableCell>
                  <TableCell sx={{ fontWeight: 'bold', bgcolor: '#4CAF50', color: 'white' }}>Reviewer</TableCell>
                  <TableCell sx={{ fontWeight: 'bold', bgcolor: '#4CAF50', color: 'white', minWidth: 300 }}>Comment</TableCell>
                  <TableCell sx={{ fontWeight: 'bold', bgcolor: '#4CAF50', color: 'white' }}>Type</TableCell>
                  <TableCell sx={{ fontWeight: 'bold', bgcolor: '#4CAF50', color: 'white' }}>Discipline</TableCell>
                  <TableCell sx={{ fontWeight: 'bold', bgcolor: '#4CAF50', color: 'white' }}>Drawing Ref</TableCell>
                  <TableCell sx={{ fontWeight: 'bold', bgcolor: '#4CAF50', color: 'white' }}>Status</TableCell>
                  <TableCell sx={{ fontWeight: 'bold', bgcolor: '#4CAF50', color: 'white' }}>Action</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {uploadedRevisions.map((rev, revIdx) => {
                  // Smart comment extraction: try multiple paths
                  const comments = rev.comments || rev.data?.comments || rev.data?.document_details?.recent_activities || [];
                  
                  console.log(`[CRS Debug] Revision ${revIdx}:`, {
                    label: rev.label,
                    number: rev.number,
                    commentsCount: comments.length,
                    comments: comments
                  });
                  
                  // Create array to hold all rows for this revision
                  const revisionRows = [];
                  
                  // Add revision header separator row (only if not first revision)
                  if (revIdx > 0) {
                    revisionRows.push(
                      <TableRow key={`separator-${rev.number}`}>
                        <TableCell colSpan={9} sx={{ 
                          bgcolor: '#E0E0E0', 
                          height: '8px', 
                          padding: 0,
                          borderTop: '2px solid #9E9E9E'
                        }} />
                      </TableRow>
                    );
                  }
                  
                  // Add revision section header
                  revisionRows.push(
                    <TableRow key={`header-${rev.number}`}>
                      <TableCell colSpan={9} sx={{ 
                        bgcolor: '#2196F3',
                        color: 'white',
                        fontWeight: 'bold',
                        fontSize: '1rem',
                        py: 1.5
                      }}>
                        📄 {rev.label || `Revision ${rev.number}`} - {comments.length} Comment{comments.length !== 1 ? 's' : ''}
                      </TableCell>
                    </TableRow>
                  );
                  
                  if (comments.length > 0) {
                    comments.forEach((comment, idx) => {
                      const commentId = comment.id || comment.comment_id;
                      const commentStatus = comment.status || 'open';
                      const isOpen = commentStatus.toLowerCase() === 'open';
                      
                      console.log(`[CRS Debug] Comment ${idx}:`, {
                        commentId,
                        commentStatus,
                        isOpen,
                        hasId: !!commentId,
                        comment
                      });
                      
                      revisionRows.push(
                        <TableRow key={`${rev.number}-comment-${idx}`} sx={{
                          bgcolor: isOpen ? '#FFF3E0' : 'inherit',
                          '&:hover': { bgcolor: isOpen ? '#FFE0B2' : '#F5F5F5' }
                        }}>
                          <TableCell>
                            <Chip 
                              label={rev.label || `Rev ${rev.number}`}
                              size="small"
                              color={isOpen ? 'warning' : 'success'}
                              variant="outlined"
                            />
                          </TableCell>
                          <TableCell>{comment.page_number || 'N/A'}</TableCell>
                          <TableCell>{comment.reviewer_name || 'Not Provided'}</TableCell>
                          <TableCell sx={{ wordBreak: 'break-word' }}>{comment.comment_text || comment.text || 'N/A'}</TableCell>
                          <TableCell>
                            <Chip 
                              label={comment.comment_type || comment.type || 'General'}
                              size="small"
                              color={comment.comment_type?.includes('RED') || comment.type?.includes('RED') ? 'error' : 'warning'}
                            />
                          </TableCell>
                          <TableCell>{comment.discipline || 'Not Provided'}</TableCell>
                          <TableCell>{comment.drawing_ref || 'N/A'}</TableCell>
                          <TableCell>
                            <FormControl size="small" fullWidth>
                              <Select
                                value={commentStatus.toLowerCase()}
                                onChange={(e) => {
                                  console.log('[CRS] Status change:', { commentId, newStatus: e.target.value });
                                  handleStatusChange(
                                    commentId, 
                                    e.target.value, 
                                    rev.label || `Rev ${rev.number}`, 
                                    comment.comment_text || comment.text
                                  );
                                }}
                                disabled={loading || !commentId}
                                sx={{
                                  minWidth: 120,
                                  bgcolor: commentStatus.toLowerCase() === 'open' ? '#FFEBEE' : 
                                           commentStatus.toLowerCase() === 'closed' ? '#E8F5E9' :
                                           commentStatus.toLowerCase() === 'in_progress' ? '#FFF3E0' :
                                           commentStatus.toLowerCase() === 'resolved' ? '#E3F2FD' : '#F3E5F5',
                                  fontWeight: 'bold',
                                  fontSize: '0.875rem'
                                }}
                              >
                                <MenuItem value="open">🔴 Open</MenuItem>
                                <MenuItem value="in_progress">🟡 In Progress</MenuItem>
                                <MenuItem value="resolved">🟢 Resolved</MenuItem>
                                <MenuItem value="closed">✅ Closed</MenuItem>
                                <MenuItem value="rejected">❌ Rejected</MenuItem>
                              </Select>
                            </FormControl>
                          </TableCell>
                          <TableCell>
                            {commentId ? (
                              <Button
                                size="small"
                                variant="contained"
                                color="success"
                                onClick={() => {
                                  console.log('[CRS] Close button clicked:', { commentId, revLabel: rev.label, comment });
                                  handleCloseComment(commentId, rev.label || `Rev ${rev.number}`, comment.comment_text || comment.text);
                                }}
                                disabled={loading || commentStatus.toLowerCase() === 'closed'}
                                sx={{ minWidth: 80 }}
                              >
                                {commentStatus.toLowerCase() === 'closed' ? '✓ Closed' : 'Close'}
                              </Button>
                            ) : (
                              <Typography variant="caption" color="text.secondary">
                                No ID
                              </Typography>
                            )}
                          </TableCell>
                        </TableRow>
                      );
                    });
                  } else {
                    // No comments for this revision
                    revisionRows.push(
                      <TableRow key={`${rev.number}-empty`}>
                        <TableCell colSpan={9} align="center" sx={{ 
                          fontStyle: 'italic', 
                          color: 'text.secondary',
                          py: 2,
                          bgcolor: '#FAFAFA'
                        }}>
                          No comments found for {rev.label}
                        </TableCell>
                      </TableRow>
                    );
                  }
                  
                  return revisionRows;
                })}
                {uploadedRevisions.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={9} align="center" sx={{ fontStyle: 'italic', color: 'text.secondary' }}>
                      No revisions uploaded yet
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </TableContainer>
        </CardContent>
      </Card>
    );
  };

  return (
    <Box sx={{ pt: 6, px: 4, pb: 4, minHeight: "100vh" }}>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
        <Typography variant="h4">
          CRS Multi-Revision Workflow (Smart Version)
        </Typography>
        <PageControlButtons controls={pageControls} />
      </Box>

      {/* Stepper */}
      <Stepper activeStep={currentStep} sx={{ mb: 4 }}>
        <Step><StepLabel>Create Chain</StepLabel></Step>
        <Step><StepLabel>Upload Revisions</StepLabel></Step>
        <Step><StepLabel>Complete</StepLabel></Step>
      </Stepper>

      {/* Error/Success Messages */}
      {error && <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError(null)}>{error}</Alert>}
      {success && <Alert severity="success" sx={{ mb: 2 }} onClose={() => setSuccess(null)}>{success}</Alert>}

      {/* STEP 0: Create Chain */}
      {currentStep === 0 && (
        <Card>
          <CardContent>
            <Typography variant="h6" gutterBottom>Step 1: Create Revision Chain</Typography>
            <form onSubmit={handleCreateChain}>
              <Grid container spacing={2}>
                <Grid item xs={12} md={6}>
                  <Box sx={{ display: 'flex', gap: 1, alignItems: 'flex-start' }}>
                    <TextField
                      fullWidth
                      label="Chain ID *"
                      value={chainForm.chain_id}
                      onChange={(e) => setChainForm({...chainForm, chain_id: e.target.value})}
                      required
                      helperText="Unique identifier for this revision chain"
                    />
                    <Button
                      variant="outlined"
                      onClick={handleAutoGenerateChainId}
                      sx={{ mt: 0.5, minWidth: '120px', whiteSpace: 'nowrap' }}
                      disabled={loading}
                    >
                      Auto-Generate
                    </Button>
                  </Box>
                </Grid>
                <Grid item xs={12} md={6}>
                  <TextField
                    fullWidth
                    label="Document Title *"
                    value={chainForm.document_title}
                    onChange={(e) => setChainForm({...chainForm, document_title: e.target.value})}
                    required
                  />
                </Grid>
                <Grid item xs={12} md={6}>
                  <TextField
                    fullWidth
                    label="Document Number *"
                    value={chainForm.document_number}
                    onChange={(e) => setChainForm({...chainForm, document_number: e.target.value})}
                    required
                  />
                </Grid>
                <Grid item xs={12} md={6}>
                  <TextField
                    fullWidth
                    label="Project Name *"
                    value={chainForm.project_name}
                    onChange={(e) => setChainForm({...chainForm, project_name: e.target.value})}
                    required
                  />
                </Grid>
                <Grid item xs={12} md={6}>
                  <TextField
                    fullWidth
                    label="Contractor Name"
                    value={chainForm.contractor_name}
                    onChange={(e) => setChainForm({...chainForm, contractor_name: e.target.value})}
                  />
                </Grid>
                <Grid item xs={12} md={6}>
                  <TextField
                    fullWidth
                    label="Department"
                    value={chainForm.department}
                    onChange={(e) => setChainForm({...chainForm, department: e.target.value})}
                  />
                </Grid>
                <Grid item xs={12} md={6}>
                  <TextField
                    fullWidth
                    type="number"
                    label="Maximum Revisions *"
                    value={chainForm.max_allowed_revisions}
                    onChange={(e) => setChainForm({...chainForm, max_allowed_revisions: parseInt(e.target.value) || 10})}
                    inputProps={{ min: 1, max: 50 }}
                    helperText="You can finish early, this is just the maximum"
                    required
                  />
                </Grid>
                <Grid item xs={12}>
                  <TextField
                    fullWidth
                    multiline
                    rows={2}
                    label="Notes"
                    value={chainForm.notes}
                    onChange={(e) => setChainForm({...chainForm, notes: e.target.value})}
                  />
                </Grid>
                <Grid item xs={12}>
                  <Button
                    type="submit"
                    variant="contained"
                    color="primary"
                    size="large"
                    disabled={loading}
                    fullWidth
                  >
                    {loading ? <CircularProgress size={24} /> : 'Create Chain'}
                  </Button>
                </Grid>
              </Grid>
            </form>
          </CardContent>
        </Card>
      )}

      {/* STEP 1: Upload Revisions */}
      {currentStep === 1 && (
        <Box>
          <Card sx={{ mb: 3 }}>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                Chain: {createdChain?.chain_id} - Upload Revisions
              </Typography>

              {/* Debug Info: Show open comment count */}
              {uploadedRevisions.length > 0 && (() => {
                const allComments = uploadedRevisions.flatMap(r => r.comments || []);
                const openCount = allComments.filter(c => (c.status || 'open').toLowerCase() === 'open').length;
                const closedCount = allComments.filter(c => (c.status || 'open').toLowerCase() === 'closed').length;
                return (
                  <Alert severity="info" sx={{ mb: 2 }}>
                    <strong>📊 Comment Status:</strong> {openCount} Open | {closedCount} Closed | {allComments.length} Total
                  </Alert>
                );
              })()}

              {/* Warning: Open Comments from Previous Revisions */}
              {uploadedRevisions.length > 0 && (() => {
                const hasOpen = checkForOpenComments();
                console.log('[CRS] Upload button check:', { 
                  uploadedRevisionsCount: uploadedRevisions.length,
                  currentRevisionNumber,
                  hasOpenComments: hasOpen 
                });
                return hasOpen;
              })() && (
                <Alert severity="warning" sx={{ mb: 2 }}>
                  <strong>⚠️ Cannot Upload Next Revision!</strong>
                  <br />
                  You have open comments from previous revisions. 
                  Please close all comments before uploading <strong>Rev {currentRevisionNumber}</strong>.
                  <br />
                  <Typography variant="caption" sx={{ mt: 1, display: 'block' }}>
                    💡 Scroll down to the "All Comments Across Revisions" table and change the "Status" dropdown from "Open" to "Closed" for each comment.
                  </Typography>
                </Alert>
              )}
              
              <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap', mb: 3 }}>
                {Array.from({ length: createdChain?.max_allowed_revisions || 5 }).map((_, idx) => {
                  const isNextRevision = idx === currentRevisionNumber - 1;
                  const hasOpenPrevComments = isNextRevision && uploadedRevisions.length > 0 && checkForOpenComments();
                  
                  return (
                    <Button
                      key={idx}
                      variant={idx < currentRevisionNumber - 1 ? "outlined" : idx === currentRevisionNumber - 1 ? "contained" : "text"}
                      color={idx < currentRevisionNumber - 1 ? "success" : "primary"}
                      startIcon={idx < currentRevisionNumber - 1 ? <CheckIcon /> : <UploadIcon />}
                      component="label"
                      disabled={idx !== currentRevisionNumber - 1 || loading || hasOpenPrevComments}
                      sx={{ minWidth: 150 }}
                      title={hasOpenPrevComments ? "Close all previous comments before uploading this revision" : ""}
                    >
                      Rev {idx + 1} {idx < currentRevisionNumber - 1 ? "✓" : ""}
                      <input
                        type="file"
                        accept={CONFIG.ACCEPTED_FILE_TYPE}
                        hidden
                        onChange={handleUploadRevision}
                        disabled={idx !== currentRevisionNumber - 1 || hasOpenPrevComments}
                      />
                    </Button>
                  );
                })}
              </Box>

              {loading && (
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                  <CircularProgress size={24} />
                  <Typography>Processing PDF and extracting comments...</Typography>
                </Box>
              )}

              {uploadedRevisions.length > 0 && (
                <Box sx={{ mt: 3 }}>
                  <Typography variant="subtitle1" gutterBottom>Uploaded Revisions:</Typography>
                  <List>
                    {uploadedRevisions.map((rev, idx) => (
                      <ListItem key={idx}>
                        <ListItemText
                          primary={`${rev.label}: ${rev.fileName}`}
                          secondary={`${rev.data?.extraction_summary?.total_comments || 0} comments extracted`}
                        />
                        <Chip label={rev.data?.revision?.status || 'Submitted'} color="success" />
                      </ListItem>
                    ))}
                  </List>
                </Box>
              )}

              <Divider sx={{ my: 3 }} />

              <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap' }}>
                <Button
                  variant="outlined"
                  onClick={() => setShowPreview(!showPreview)}
                  startIcon={<PreviewIcon />}
                  disabled={uploadedRevisions.length === 0}
                >
                  {showPreview ? 'Hide' : 'Show'} Preview
                </Button>
                <Button
                  variant="contained"
                  color="success"
                  startIcon={<DownloadIcon />}
                  onClick={handleDownloadExcel}
                  disabled={uploadedRevisions.length === 0 || loading}
                >
                  Download Excel
                </Button>
                <Box sx={{ flexGrow: 1 }} />
                <Button
                  variant="outlined"
                  color="warning"
                  startIcon={<CheckIcon />}
                  onClick={() => setCurrentStep(2)}
                  disabled={uploadedRevisions.length === 0}
                >
                  Finish Early ({uploadedRevisions.length} of {createdChain?.max_allowed_revisions})
                </Button>
                <Button
                  variant="contained"
                  onClick={() => setCurrentStep(2)}
                  disabled={uploadedRevisions.length === 0}
                >
                  Complete All Revisions
                </Button>
              </Box>
            </CardContent>
          </Card>

          {/* SMART PREVIEW TABLE */}
          <PreviewTable />
        </Box>
      )}

      {/* STEP 2: Complete */}
      {currentStep === 2 && (
        <Card>
          <CardContent>
            <Box sx={{ textAlign: 'center', py: 4 }}>
              <CheckIcon sx={{ fontSize: 80, color: 'success.main', mb: 2 }} />
              <Typography variant="h5" gutterBottom>
                Multi-Revision Workflow Complete!
              </Typography>
              <Typography variant="body1" color="text.secondary" gutterBottom>
                Chain: {createdChain?.chain_id} | Revisions: {uploadedRevisions.length}
              </Typography>
              <Box sx={{ mt: 4, display: 'flex', gap: 2, justifyContent: 'center' }}>
                <Button
                  variant="contained"
                  color="success"
                  startIcon={<DownloadIcon />}
                  onClick={handleDownloadExcel}
                  disabled={loading}
                >
                  Download Excel Report
                </Button>
                <Button
                  variant="outlined"
                  onClick={() => {
                    setCurrentStep(0);
                    setCreatedChain(null);
                    setUploadedRevisions([]);
                    setCurrentRevisionNumber(1);
                    setShowPreview(false);
                  }}
                >
                  Start New Chain
                </Button>
              </Box>
            </Box>
          </CardContent>
        </Card>
      )}
    </Box>
  );
};

export default withDashboardControls(CRSMultiRevisionSmart);

