/**
 * Documentation Configuration
 * Centralized configuration for easy customization and maintenance
 * Update documentation sections, guides, and resources here
 */

export const DOCUMENTATION_CONFIG = {
  // Main Settings
  title: 'Documentation & Help Center',
  subtitle: 'Everything you need to master RADAI',
  searchPlaceholder: 'Search documentation...',
  
  // Documentation Categories
  categories: [
    {
      id: 'getting-started',
      name: 'Getting Started',
      icon: '🚀',
      color: 'blue',
      gradient: 'from-blue-500 to-cyan-500',
      description: 'Learn the basics and get up to speed quickly'
    },
    {
      id: 'features',
      name: 'Features',
      icon: '⚡',
      color: 'purple',
      gradient: 'from-purple-500 to-pink-500',
      description: 'Explore all available features and capabilities'
    },
    {
      id: 'tutorials',
      name: 'Tutorials',
      icon: '📖',
      color: 'green',
      gradient: 'from-green-500 to-emerald-500',
      description: 'Step-by-step guides for common tasks'
    },
    {
      id: 'api',
      name: 'API Reference',
      icon: '🔌',
      color: 'orange',
      gradient: 'from-orange-500 to-red-500',
      description: 'Technical API documentation for developers'
    },
    {
      id: 'troubleshooting',
      name: 'Troubleshooting',
      icon: '🔧',
      color: 'red',
      gradient: 'from-red-500 to-pink-500',
      description: 'Common issues and their solutions'
    },
    {
      id: 'best-practices',
      name: 'Best Practices',
      icon: '💡',
      color: 'yellow',
      gradient: 'from-yellow-500 to-orange-500',
      description: 'Tips and recommendations for optimal usage'
    }
  ],

  // Documentation Articles
  articles: {
    'getting-started': [
      {
        id: 'welcome',
        title: 'Welcome to RADAI',
        description: 'Introduction to the platform and its capabilities',
        readTime: '5 min',
        difficulty: 'Beginner',
        content: `
# Welcome to RADAI

RADAI is an AI-powered platform designed for process engineering professionals. This guide will help you get started with the platform.

## What is RADAI?

RADAI leverages advanced artificial intelligence to automate and enhance process engineering workflows, including:

- P&ID (Piping and Instrumentation Diagram) Analysis
- PFD (Process Flow Diagram) to P&ID Conversion
- CRS (Construction Requirement Sheets) Processing
- Project Control and Management

## Key Features

### 1. AI-Powered Analysis
Our AI engine analyzes engineering drawings with high accuracy, extracting valuable information and insights.

### 2. Document Processing
Upload, process, and manage your engineering documents in one centralized platform.

### 3. Collaboration
Work together with your team, share documents, and track project progress.

## Getting Started

1. **Create an Account**: Sign up or log in to your account
2. **Explore Features**: Navigate through available features on the dashboard
3. **Upload Documents**: Start by uploading your first drawing or document
4. **Review Results**: View AI-generated analysis and reports

## Need Help?

- Check our tutorials for step-by-step guides
- Browse FAQ for common questions
- Contact support for personalized assistance
        `
      },
      {
        id: 'account-setup',
        title: 'Setting Up Your Account',
        description: 'Configure your profile and preferences',
        readTime: '3 min',
        difficulty: 'Beginner',
        content: `
# Setting Up Your Account

Learn how to configure your RADAI account for optimal usage.

## Profile Setup

1. Click on your profile icon in the top right corner
2. Select "Profile Settings"
3. Update your information:
   - Name and email
   - Company details
   - Notification preferences

## Password Management

### Changing Your Password
1. Go to Profile Settings
2. Click "Change Password"
3. Enter your current password
4. Enter and confirm your new password
5. Click "Update Password"

### Password Requirements
- Minimum 8 characters
- At least one uppercase letter
- At least one lowercase letter
- At least one number
- At least one special character

## Notification Settings

Customize how you receive updates:
- Email notifications
- System alerts
- Project updates
- Feature announcements

## Security Best Practices

- Use a strong, unique password
- Enable two-factor authentication (if available)
- Log out from shared devices
- Regularly review account activity
        `
      },
      {
        id: 'first-upload',
        title: 'Your First Document Upload',
        description: 'Upload and process your first engineering drawing',
        readTime: '4 min',
        difficulty: 'Beginner',
        content: `
# Your First Document Upload

This guide walks you through uploading and processing your first engineering drawing.

## Supported File Formats

RADAI supports the following file formats:
- PDF (Recommended)
- PNG
- JPG/JPEG

## Upload Process

### Step 1: Navigate to Feature
1. Go to the Dashboard
2. Select the feature you want to use (PID, PFD, or CRS)
3. Click on "Upload" or the upload button

### Step 2: Select Files
1. Click "Choose Files" or drag and drop
2. Select your drawing file(s)
3. Wait for file validation

### Step 3: Review and Submit
1. Review the uploaded files
2. Add any notes or metadata (optional)
3. Click "Process" or "Submit"

### Step 4: View Results
1. Wait for AI processing to complete
2. View the analysis results
3. Download reports or processed files

## Tips for Best Results

- Use high-resolution files
- Ensure drawings are clear and legible
- Remove any unnecessary pages
- Use PDF format when possible

## Troubleshooting

**File won't upload?**
- Check file size (max 50MB)
- Verify file format
- Check your internet connection

**Processing taking too long?**
- Large files may take 5-10 minutes
- Complex drawings require more processing time
- Check your internet connection
        `
      }
    ],
    'features': [
      {
        id: 'pid-analysis',
        title: 'P&ID Analysis',
        description: 'Analyze Piping and Instrumentation Diagrams with AI',
        readTime: '8 min',
        difficulty: 'Intermediate',
        content: `
# P&ID Analysis Feature

Learn how to use the P&ID Analysis feature to extract insights from your piping and instrumentation diagrams.

## Overview

The P&ID Analysis feature uses advanced AI to:
- Identify equipment and instruments
- Extract tags and labels
- Detect connections and flow paths
- Generate comprehensive reports

## How to Use

### 1. Upload P&ID Drawing
- Navigate to PID Upload page
- Upload your P&ID file (PDF, PNG, or JPG)
- Add project information if needed

### 2. AI Processing
The AI engine will:
- Scan the entire drawing
- Identify all symbols and components
- Extract text and labels
- Analyze connections and relationships

### 3. Review Results
Access detailed reports including:
- Equipment list
- Instrument tags
- Line numbers
- Material specifications

## Advanced Features

### Custom Tags
Define custom naming conventions for your organization

### Batch Processing
Upload multiple P&IDs for simultaneous analysis

### Export Options
Download results in various formats (PDF, Excel, CSV)

## Best Practices

- Use clear, high-quality scans
- Ensure standard symbols are used
- Include legends when possible
- Add project context for better results
        `
      },
      {
        id: 'pfd-converter',
        title: 'PFD to P&ID Converter',
        description: 'Convert Process Flow Diagrams to P&IDs automatically',
        readTime: '10 min',
        difficulty: 'Advanced',
        content: `
# PFD to P&ID Converter

Transform your Process Flow Diagrams into detailed Piping and Instrumentation Diagrams using AI.

## What is PFD to P&ID Conversion?

This feature automates the conversion process by:
- Analyzing the PFD layout and components
- Generating detailed P&ID elements
- Adding instrumentation and piping details
- Creating industry-standard drawings

## Conversion Process

### Step 1: Upload PFD
1. Go to PFD Upload page
2. Select your PFD file
3. Provide project metadata

### Step 2: AI Analysis
The system will:
- Identify process equipment
- Determine flow paths
- Calculate piping requirements
- Add instrumentation

### Step 3: Review & Customize
- Review generated P&ID
- Make adjustments as needed
- Validate against standards
- Export final drawing

## Customization Options

### Equipment Details
- Specify equipment types
- Add custom specifications
- Define operating conditions

### Instrumentation
- Select instrument types
- Configure control loops
- Set alarm parameters

### Piping Specifications
- Material selection
- Size specifications
- Insulation requirements

## Quality Assurance

- Automated symbol validation
- Standard compliance checking
- Consistency verification
- Review checklists

## Tips for Success

1. Start with clean, clear PFDs
2. Use standard symbols and conventions
3. Include all process information
4. Review carefully before finalizing
5. Save iterations for version control
        `
      },
      {
        id: 'crs-documents',
        title: 'CRS Document Processing',
        description: 'Process and manage Construction Requirement Sheets',
        readTime: '6 min',
        difficulty: 'Intermediate',
        content: `
# CRS Document Processing

Streamline your Construction Requirement Sheets management with AI-powered processing.

## Overview

CRS (Construction Requirement Sheets) processing helps you:
- Extract data from CRS documents
- Organize requirements systematically
- Track revisions and changes
- Generate reports and summaries

## Features

### Document Upload
- Support for multiple CRS formats
- Batch upload capabilities
- Automatic data extraction

### Revision Management
- Track document revisions
- Compare versions
- Maintain revision history

### Data Extraction
The AI extracts:
- Equipment information
- Material specifications
- Construction requirements
- Installation details

## How to Use

### Single Document Processing
1. Navigate to CRS Documents
2. Upload your CRS file
3. Review extracted data
4. Validate and confirm

### Multiple Revisions
1. Go to Multiple Revision page
2. Upload different revision versions
3. Compare changes automatically
4. Generate comparison reports

### History & Reports
- Access processed documents
- View extraction history
- Download comprehensive reports
- Export data in various formats

## Best Practices

- Maintain consistent naming conventions
- Include revision numbers in filenames
- Validate extracted data
- Keep original documents archived
        `
      }
    ],
    'tutorials': [
      {
        id: 'batch-upload',
        title: 'Batch Processing Tutorial',
        description: 'Process multiple documents at once efficiently',
        readTime: '7 min',
        difficulty: 'Intermediate',
        content: `
# Batch Processing Tutorial

Learn how to efficiently process multiple documents simultaneously.

## When to Use Batch Processing

Batch processing is ideal when you need to:
- Process multiple P&IDs from the same project
- Convert several PFDs at once
- Handle large document sets
- Save time on repetitive tasks

## Step-by-Step Guide

### 1. Prepare Your Files
- Organize files in a folder
- Use consistent naming convention
- Ensure all files are in supported formats
- Check file sizes (max 50MB each)

### 2. Upload Multiple Files
1. Navigate to the upload page
2. Click "Select Multiple Files" or drag and drop
3. Wait for all files to be validated
4. Review the file list

### 3. Configure Settings
- Set common parameters
- Choose processing options
- Configure output preferences

### 4. Start Processing
1. Click "Process All"
2. Monitor progress
3. View real-time status updates

### 5. Review Results
- Check each processed document
- Download batch reports
- Export consolidated data

## Tips for Efficient Batch Processing

1. **Group Similar Documents**: Process similar types together
2. **Optimize File Sizes**: Compress large files before upload
3. **Use Descriptive Names**: Makes results easier to identify
4. **Process During Off-Peak**: Faster processing times
5. **Save Templates**: Reuse settings for similar batches

## Troubleshooting Batch Operations

**Some files failed?**
- Check individual file status
- Retry failed files separately
- Verify file format and quality

**Slow processing?**
- Reduce batch size
- Check internet connection
- Try during off-peak hours
        `
      }
    ],
    'troubleshooting': [
      {
        id: 'common-issues',
        title: 'Common Issues & Solutions',
        description: 'Quick fixes for frequently encountered problems',
        readTime: '5 min',
        difficulty: 'Beginner',
        content: `
# Common Issues & Solutions

Quick solutions to the most frequently encountered problems.

## Login Issues

### Cannot Log In
**Problem**: Unable to access your account

**Solutions**:
1. Verify email and password
2. Check for typos in email address
3. Try password reset
4. Clear browser cache and cookies
5. Try a different browser

### Forgot Password
1. Click "Forgot Password" on login page
2. Enter your email address
3. Check inbox for reset link
4. Check spam folder if not received
5. Contact support if no email arrives

## Upload Issues

### File Won't Upload
**Problem**: File upload fails or hangs

**Solutions**:
1. Check file size (max 50MB)
2. Verify file format (PDF, PNG, JPG)
3. Check internet connection
4. Try a different browser
5. Disable browser extensions
6. Clear browser cache

### Processing Stuck
**Problem**: Processing doesn't complete

**Solutions**:
1. Wait at least 10 minutes
2. Refresh the page
3. Check file quality
4. Reduce file size
5. Contact support with file ID

## Display Issues

### Page Not Loading
**Problem**: Blank page or loading forever

**Solutions**:
1. Refresh the page (F5)
2. Clear browser cache
3. Check internet connection
4. Try incognito mode
5. Update your browser

### Images Not Displaying
**Problem**: Drawings or images don't show

**Solutions**:
1. Wait for full page load
2. Check internet speed
3. Disable ad blockers
4. Allow images in browser settings
5. Try different browser

## Performance Issues

### Slow Loading
**Problem**: Application is slow

**Solutions**:
1. Check internet connection speed
2. Close unnecessary browser tabs
3. Clear browser cache
4. Disable heavy extensions
5. Use recommended browsers

## Getting Help

If these solutions don't work:
1. Note the error message
2. Take a screenshot
3. Contact support with details
4. Include browser and OS information
        `
      }
    ]
  },

  // Quick Links
  quickLinks: [
    {
      id: 'video-tutorials',
      title: 'Video Tutorials',
      description: 'Watch step-by-step video guides',
      icon: '🎥',
      url: '#videos',
      gradient: 'from-red-500 to-pink-500'
    },
    {
      id: 'api-docs',
      title: 'API Documentation',
      description: 'Technical API reference for developers',
      icon: '📚',
      url: '#api',
      gradient: 'from-blue-500 to-cyan-500'
    },
    {
      id: 'release-notes',
      title: 'Release Notes',
      description: 'Latest updates and new features',
      icon: '📋',
      url: '#releases',
      gradient: 'from-green-500 to-emerald-500'
    },
    {
      id: 'community',
      title: 'Community Forum',
      description: 'Connect with other users',
      icon: '👥',
      url: '#community',
      gradient: 'from-purple-500 to-pink-500'
    }
  ],

  // Popular Topics
  popularTopics: [
    { title: 'How to upload P&ID drawings', views: 1250, category: 'features' },
    { title: 'Converting PFD to P&ID', views: 980, category: 'tutorials' },
    { title: 'Account setup guide', views: 850, category: 'getting-started' },
    { title: 'Troubleshooting upload errors', views: 720, category: 'troubleshooting' },
    { title: 'Batch processing documents', views: 650, category: 'tutorials' }
  ],

  // Help Resources
  helpResources: [
    {
      id: 'support',
      title: 'Contact Support',
      description: 'Get help from our team',
      icon: '💬',
      action: 'support'
    },
    {
      id: 'faq',
      title: 'FAQ',
      description: 'Frequently asked questions',
      icon: '❓',
      action: 'faq'
    },
    {
      id: 'feedback',
      title: 'Send Feedback',
      description: 'Help us improve',
      icon: '💡',
      action: 'feedback'
    }
  ]
}

// Export individual sections
export const categories = DOCUMENTATION_CONFIG.categories
export const articles = DOCUMENTATION_CONFIG.articles
export const quickLinks = DOCUMENTATION_CONFIG.quickLinks
export const popularTopics = DOCUMENTATION_CONFIG.popularTopics
