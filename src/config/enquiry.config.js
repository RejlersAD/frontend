/**
 * Enquiry Configuration - REJLERS RADAI
 * Soft-coded configuration for enquiry form
 * 
 * EASY MAINTENANCE:
 * - Update recipient email in one place
 * - Customize services list
 * - Modify urgency levels
 * - Update contact methods
 */

export const ENQUIRY_CONFIG = {
  // Email Configuration (SOFT CODED - Easy to update)
  email: {
    recipient: 'radai@rejlers.ae',
    cc: [],
    subject_prefix: '[RADAI Enquiry]',
    replyTo: true // Use customer's email as reply-to
  },

  // Page Content
  page: {
    title: 'Get in Touch',
    subtitle: 'We\'d love to hear from you. Send us your enquiry and we\'ll respond within 24 hours.',
    metaDescription: 'Contact REJLERS RADAI for AI-powered engineering solutions. Submit your enquiry and our team will get back to you within 24 hours.'
  },

  // Contact Methods
  contactMethods: [
    {
      icon: '📧',
      title: 'Email Us',
      value: 'radai@rejlers.ae',
      link: 'mailto:radai@rejlers.ae'
    },
    {
      icon: '📞',
      title: 'Call Us',
      value: '+971 50 560 6987',
      link: 'tel:+971505606987'
    },
    {
      icon: '🏢',
      title: 'Visit Us',
      value: 'Abu Dhabi, UAE',
      link: 'https://www.google.com/maps/search/Rejlers+Abu+Dhabi'
    }
  ],

  // Services List (for dropdown)
  services: [
    { value: 'pid-analysis', label: 'P&ID Analysis & Verification' },
    { value: 'pfd-conversion', label: 'PFD to P&ID Conversion' },
    { value: 'asset-integrity', label: 'Asset Integrity Management' },
    { value: 'engineering-consulting', label: 'Engineering Consulting' },
    { value: 'digital-twin', label: 'Digital Twin Solutions' },
    { value: 'ai-ml-services', label: 'AI/ML Engineering Services' },
    { value: 'password-reset', label: '🔐 Password Reset Request' },
    { value: 'general', label: 'General Enquiry' },
    { value: 'other', label: 'Other Services' }
  ],

  // Urgency Levels
  urgencyLevels: [
    { value: 'low', label: '⏰ Low - Response within 72 hours' },
    { value: 'normal', label: '📅 Normal - Response within 24 hours' },
    { value: 'high', label: '⚡ High - Response within 12 hours' },
    { value: 'urgent', label: '🚨 Urgent - Immediate attention required' }
  ],

  // Form Validation Rules
  validation: {
    name: {
      required: true,
      minLength: 2,
      maxLength: 100
    },
    email: {
      required: true,
      pattern: /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    },
    phone: {
      required: true,
      minLength: 8
    },
    subject: {
      required: true,
      minLength: 5,
      maxLength: 200
    },
    message: {
      required: true,
      minLength: 10,
      maxLength: 1000
    }
  },

  // Email Template Settings
  emailTemplate: {
    companyLogo: 'https://www.rejlers.com/logo.png',
    companyName: 'REJLERS RADAI',
    companyWebsite: 'https://www.radai.ae',
    footerText: 'This is an automated message from RADAI Enquiry System',
    supportEmail: 'support@rejlers.ae'
  },

  // Success Message
  successMessage: {
    title: 'Thank You!',
    message: 'Your enquiry has been submitted successfully. Our team will review your message and get back to you within 24 hours.',
    redirectDelay: 5000 // milliseconds
  },

  // Error Messages
  errorMessages: {
    network: 'Unable to submit your enquiry. Please check your internet connection.',
    server: 'Something went wrong. Please try again or contact us directly.',
    validation: 'Please fill in all required fields correctly.'
  }
};

// Helper function to get recipient email
export const getEnquiryRecipient = () => {
  return ENQUIRY_CONFIG.email.recipient;
};

// Helper function to format email subject
export const formatEmailSubject = (subject) => {
  return `${ENQUIRY_CONFIG.email.subject_prefix} ${subject}`;
};

export default ENQUIRY_CONFIG;
