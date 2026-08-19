/**
 * Contact Support Configuration
 * Centralized configuration for easy customization and maintenance
 * Update contact details, methods, and settings here
 */

export const SUPPORT_CONFIG = {
  // Main Settings
  title: 'Contact Support',
  subtitle: 'Choose your preferred way to reach us',
  companyName: 'RADAI',
  
  // Contact Methods Configuration
  // To enable/disable a contact method, set available: true/false
  // To update contact details, change the action and details fields
  contactMethods: [
    {
      id: 'email',
      name: 'Email Support',
      description: 'Get a response within 24 hours',
      icon: '📧',
      action: 'mailto:tanzeem.agra@rejlers.ae',
      color: 'blue',
      gradient: 'from-blue-500 to-cyan-500',
      hoverGradient: 'from-blue-600 to-cyan-600',
      available: true,
      responseTime: '24 hours',
      details: 'tanzeem.agra@rejlers.ae'
    },
    {
      id: 'phone',
      name: 'Phone Support',
      description: 'Speak with our team directly',
      icon: '📞',
      action: 'tel:+971XXXXXXXXX', // Update with actual phone number
      color: 'green',
      gradient: 'from-green-500 to-emerald-500',
      hoverGradient: 'from-green-600 to-emerald-600',
      available: true, // Set to true when phone support is ready
      responseTime: 'Immediate',
      details: '+971 XX XXX XXXX' // Update with actual phone number
    },
    {
      id: 'chat',
      name: 'Live Chat',
      description: 'Chat with us in real-time',
      icon: '💬',
      action: 'chat',
      color: 'purple',
      gradient: 'from-purple-500 to-pink-500',
      hoverGradient: 'from-purple-600 to-pink-600',
      available: false, // Set to true when live chat is implemented
      responseTime: 'Instant',
      details: 'Coming Soon'
    },
    {
      id: 'whatsapp',
      name: 'WhatsApp',
      description: 'Message us on WhatsApp',
      icon: '📱',
      action: 'https://wa.me/971XXXXXXXXX', // Update with actual WhatsApp number
      color: 'teal',
      gradient: 'from-teal-500 to-green-500',
      hoverGradient: 'from-teal-600 to-green-600',
      available: true, // Set to true when WhatsApp is ready
      responseTime: '2 hours',
      details: '+971 XX XXX XXXX' // Update with actual WhatsApp number
    }
  ],

  // Business Hours
  businessHours: {
    days: 'Sunday - Thursday',
    hours: '9:00 AM - 6:00 PM',
    timezone: 'GST (Gulf Standard Time)'
  },

  // Frequently Asked Questions
  // Add, remove, or modify FAQs as needed
  faq: [
    {
      question: 'How do I reset my password?',
      answer: 'Go to the login page and click "Forgot Password". Follow the instructions sent to your email. If you don\'t receive the email within 10 minutes, check your spam folder or contact support.'
    },
    {
      question: 'How do I upload drawings?',
      answer: 'Navigate to the respective feature (PFD or PID) from the dashboard, click the "Upload" button, and select your files. We support PDF, PNG, JPG, and JPEG formats.'
    },
    {
      question: 'What file formats are supported?',
      answer: 'We support PDF, PNG, JPG, and JPEG formats for drawings. For optimal results, we recommend using high-resolution PDF files.'
    },
    {
      question: 'How long does AI processing take?',
      answer: 'Processing time varies based on file size and complexity. Typically, it takes 2-5 minutes for standard drawings. You\'ll receive a notification when processing is complete.'
    },
    {
      question: 'Can I download my processed drawings?',
      answer: 'Yes! You can download your processed drawings from the history page. Navigate to the feature (PFD or PID), go to History, and click the download button.'
    },
    {
      question: 'How do I get access to more features?',
      answer: 'Contact your administrator to request access to additional features. Your admin can assign modules based on your role and requirements.'
    }
  ],

  // Support Features/Benefits
  features: [
    {
      id: 'global',
      icon: '🌍',
      title: 'Global Support',
      description: 'Supporting clients across the UAE and beyond'
    },
    {
      id: 'fast',
      icon: '⚡',
      title: 'Fast Response',
      description: 'Average response time under 24 hours'
    },
    {
      id: 'expert',
      icon: '🎯',
      title: 'Expert Team',
      description: 'Dedicated support from AI specialists'
    }
  ],

  // Contact Form Configuration
  form: {
    enabled: true,
    emailEndpoint: '/api/support/contact', // Update with actual API endpoint
    priorities: [
      { value: 'low', label: 'Low' },
      { value: 'medium', label: 'Medium' },
      { value: 'normal', label: 'Normal' },
      { value: 'high', label: 'High' },
      { value: 'urgent', label: 'Urgent' }
    ],
    defaultPriority: 'medium',
    successMessage: 'Message Sent Successfully!',
    successSubMessage: 'We\'ll get back to you within 24 hours.',
    errorMessage: 'Failed to send message. Please try again or contact us directly.'
  },

  // Social Media Links (optional)
  socialMedia: {
    enabled: false,
    links: [
      {
        id: 'linkedin',
        name: 'LinkedIn',
        icon: '🔗',
        url: 'https://linkedin.com/company/radai'
      },
      {
        id: 'twitter',
        name: 'Twitter',
        icon: '🐦',
        url: 'https://twitter.com/radai'
      }
    ]
  },

  // Emergency Contact (for critical issues)
  emergency: {
    enabled: false,
    phone: '+971 XX XXX XXXX',
    email: 'emergency@radai.ae',
    message: 'For critical system issues, call our emergency hotline'
  }
}

// Export individual sections for granular imports
export const contactMethods = SUPPORT_CONFIG.contactMethods
export const businessHours = SUPPORT_CONFIG.businessHours
export const faqList = SUPPORT_CONFIG.faq
export const supportFeatures = SUPPORT_CONFIG.features
export const formConfig = SUPPORT_CONFIG.form
