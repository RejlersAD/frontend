/**
 * Pricing & Subscription Plans Configuration
 * Soft-coded pricing page - all content configurable without code changes
 * Advanced configuration for subscription tiers, features, and display
 */

export const PRICING_CONFIG = {
  // Page Header
  header: {
    title: 'Choose Your Perfect Plan',
    subtitle: 'Flexible pricing for teams of all sizes',
    description: 'Start free, upgrade when you need more power. All plans include core features.',
    badge: 'TRANSPARENT PRICING',
  },

  // Pricing Display Options
  display: {
    showAnnualToggle: true, // Enable annual/monthly toggle
    annualDiscount: 20, // % discount for annual billing
    highlightPlan: 'professional', // Plan code to highlight
    showComparison: true, // Show feature comparison table
    currency: {
      symbol: '$',
      position: 'before', // 'before' or 'after'
      code: 'USD',
    },
    billingCycles: {
      monthly: { label: 'Monthly', suffix: '/month' },
      yearly: { label: 'Annual', suffix: '/year', badge: 'Save 20%' },
    },
  },

  // Call to Action
  cta: {
    loginRequired: true, // If true, redirect to login; if false, direct signup
    loginText: 'Sign in to get started',
    loginLink: '/login',
    contactSalesText: 'Contact Sales',
    contactSalesLink: '/enquiry',
  },

  // Trust Indicators
  trustIndicators: {
    enabled: true,
    items: [
      { icon: 'shield-check', text: '256-bit SSL Encryption' },
      { icon: 'users', text: '500+ Happy Customers' },
      { icon: 'clock', text: '24/7 Support' },
      { icon: 'globe', text: 'Global Infrastructure' },
    ],
  },

  // Subscription Plans - Soft-coded
  plans: [
    {
      code: 'free',
      name: 'Free Trial',
      tagline: 'Test our platform for 24 hours',
      price: {
        monthly: 0,
        yearly: 0,
      },
      badge: {
        text: '1-DAY TRIAL',
        color: 'gray',
      },
      features: {
        users: { value: 1, label: 'User', icon: 'users' },
        storage: { value: '1 GB', label: 'Storage', icon: 'server' },
        projects: { value: 1, label: 'Project', icon: 'folder' },
        documents: { value: '5 documents', label: 'Document Limit', icon: 'document' },
        apiCalls: { value: '50/day', label: 'API Calls', icon: 'code' },
        duration: { value: '24 hours', label: 'Trial Period', icon: 'clock' },
      },
      includedFeatures: [
        '24-Hour Full Access',
        'Test All Core Features',
        'Basic CRS Documents',
        'Email Notifications',
        'Community Support',
        '5 Document Upload Limit',
      ],
      excludedFeatures: [
        'Extended Access',
        'AI Features',
        'Priority Support',
        'Advanced Analytics',
        'Custom Integrations',
      ],
      cta: {
        text: 'Start 24h Trial',
        style: 'outline',
      },
      popular: false,
    },
    {
      code: 'basic',
      name: 'Basic',
      tagline: 'For small teams',
      price: {
        monthly: 49,
        yearly: 470, // ~20% discount
      },
      badge: {
        text: 'GREAT VALUE',
        color: 'blue',
      },
      features: {
        users: { value: 10, label: 'Users', icon: 'users' },
        storage: { value: '50 GB', label: 'Storage', icon: 'server' },
        projects: { value: 10, label: 'Projects', icon: 'folder' },
        documents: { value: '500/month', label: 'Documents', icon: 'document' },
        apiCalls: { value: '1,000/day', label: 'API Calls', icon: 'code' },
      },
      includedFeatures: [
        'Everything in Free',
        'API Access',
        'Basic AI Features',
        'Data Export',
        'Email Support',
        '5 Module Access',
      ],
      excludedFeatures: [
        'Advanced Analytics',
        'Priority Support',
        'Custom Branding',
        'Dedicated Account Manager',
      ],
      cta: {
        text: 'Start Basic Plan',
        style: 'solid',
      },
      popular: false,
    },
    {
      code: 'professional',
      name: 'Professional',
      tagline: 'Most popular for growing teams',
      price: {
        monthly: 149,
        yearly: 1430, // ~20% discount
      },
      badge: {
        text: 'MOST POPULAR',
        color: 'purple',
      },
      features: {
        users: { value: 50, label: 'Users', icon: 'users' },
        storage: { value: '500 GB', label: 'Storage', icon: 'server' },
        projects: { value: 100, label: 'Projects', icon: 'folder' },
        documents: { value: '5,000/month', label: 'Documents', icon: 'document' },
        apiCalls: { value: '10,000/day', label: 'API Calls', icon: 'code' },
      },
      includedFeatures: [
        'Everything in Basic',
        'Advanced AI Features',
        'Priority Support',
        'Custom Branding',
        'Advanced Analytics',
        'Multi-language Support',
        '10 Module Access',
        'Custom Reports',
      ],
      excludedFeatures: [
        'White Label',
        'Dedicated Account Manager',
        'SLA Guarantee',
        'Custom Integrations',
      ],
      cta: {
        text: 'Go Professional',
        style: 'gradient',
      },
      popular: true,
      highlight: true,
    },
    {
      code: 'enterprise',
      name: 'Enterprise',
      tagline: 'For large organizations',
      price: {
        monthly: 999,
        yearly: 9590, // ~20% discount
      },
      badge: {
        text: 'BEST VALUE',
        color: 'amber',
      },
      features: {
        users: { value: 'Unlimited', label: 'Users', icon: 'users' },
        storage: { value: 'Unlimited', label: 'Storage', icon: 'server' },
        projects: { value: 'Unlimited', label: 'Projects', icon: 'folder' },
        documents: { value: 'Unlimited', label: 'Documents', icon: 'document' },
        apiCalls: { value: 'Unlimited', label: 'API Calls', icon: 'code' },
      },
      includedFeatures: [
        'Everything in Professional',
        'White Label Solution',
        'Dedicated Account Manager',
        'SLA Guarantee',
        'Custom Integrations',
        'SSO Integration',
        'Audit Logs',
        'All Module Access',
        'On-premise Deployment Option',
        '24/7 Phone Support',
      ],
      excludedFeatures: [],
      cta: {
        text: 'Contact Sales',
        style: 'premium',
        action: 'contact', // 'contact' or 'login'
      },
      popular: false,
    },
  ],

  // Feature Comparison Table
  comparisonFeatures: [
    {
      category: 'Core Features',
      features: [
        { name: 'CRS Documents', free: true, basic: true, professional: true, enterprise: true },
        { name: 'PFD to P&ID Conversion', free: false, basic: true, professional: true, enterprise: true },
        { name: 'P&ID QC', free: false, basic: true, professional: true, enterprise: true }, // SOFT-CODED: renamed from 'P&ID Verification'
        { name: 'Mobile Access', free: true, basic: true, professional: true, enterprise: true },
      ],
    },
    {
      category: 'AI & Analytics',
      features: [
        { name: 'Basic AI Features', free: false, basic: true, professional: true, enterprise: true },
        { name: 'Advanced AI Features', free: false, basic: false, professional: true, enterprise: true },
        { name: 'Advanced Analytics', free: false, basic: false, professional: true, enterprise: true },
        { name: 'Custom Reports', free: false, basic: false, professional: true, enterprise: true },
        { name: 'Predictive Insights', free: false, basic: false, professional: false, enterprise: true },
      ],
    },
    {
      category: 'Support & Services',
      features: [
        { name: 'Community Support', free: true, basic: true, professional: true, enterprise: true },
        { name: 'Email Support', free: false, basic: true, professional: true, enterprise: true },
        { name: 'Priority Support', free: false, basic: false, professional: true, enterprise: true },
        { name: 'Dedicated Account Manager', free: false, basic: false, professional: false, enterprise: true },
        { name: '24/7 Phone Support', free: false, basic: false, professional: false, enterprise: true },
      ],
    },
    {
      category: 'Customization',
      features: [
        { name: 'Custom Branding', free: false, basic: false, professional: true, enterprise: true },
        { name: 'White Label', free: false, basic: false, professional: false, enterprise: true },
        { name: 'Custom Integrations', free: false, basic: false, professional: false, enterprise: true },
        { name: 'SSO Integration', free: false, basic: false, professional: false, enterprise: true },
      ],
    },
    {
      category: 'Security & Compliance',
      features: [
        { name: 'SSL Encryption', free: true, basic: true, professional: true, enterprise: true },
        { name: 'Audit Logs', free: false, basic: false, professional: false, enterprise: true },
        { name: 'SLA Guarantee', free: false, basic: false, professional: false, enterprise: true },
        { name: 'On-premise Deployment', free: false, basic: false, professional: false, enterprise: true },
      ],
    },
  ],

  // FAQ Section
  faq: {
    enabled: true,
    title: 'Frequently Asked Questions',
    items: [
      {
        question: 'Can I change plans later?',
        answer: 'Yes! You can upgrade or downgrade your plan at any time. Changes take effect immediately, and we\'ll prorate any charges.',
      },
      {
        question: 'What payment methods do you accept?',
        answer: 'We accept all major credit cards (Visa, MasterCard, American Express), PayPal, and bank transfers for Enterprise plans.',
      },
      {
        question: 'Is there a free trial?',
        answer: 'Yes! Start with our 24-hour Free Trial with 1 user and up to 5 document uploads. No credit card required. After the trial, upgrade to any paid plan for continued access.',
      },
      {
        question: 'Can I cancel anytime?',
        answer: 'Yes, you can cancel your subscription at any time. Your access will continue until the end of your billing period.',
      },
      {
        question: 'Do you offer discounts for annual billing?',
        answer: 'Yes! Save 20% when you choose annual billing on any paid plan.',
      },
      {
        question: 'What happens if I exceed my limits?',
        answer: 'We\'ll notify you when approaching limits. You can upgrade anytime or purchase add-ons for additional capacity.',
      },
    ],
  },
};

// Color schemes for different plan types
export const PLAN_COLORS = {
  free: {
    badge: 'bg-gray-100 text-gray-700 border-gray-300',
    border: 'border-gray-200',
    button: 'border-gray-300 text-gray-700 hover:bg-gray-50',
    gradient: 'from-gray-50 to-gray-100',
  },
  basic: {
    badge: 'bg-blue-100 text-blue-700 border-blue-300',
    border: 'border-blue-200',
    button: 'bg-blue-600 text-white hover:bg-blue-700',
    gradient: 'from-blue-50 to-blue-100',
  },
  professional: {
    badge: 'bg-purple-100 text-purple-700 border-purple-300',
    border: 'border-purple-300',
    button: 'bg-gradient-to-r from-purple-600 to-indigo-600 text-white hover:from-purple-700 hover:to-indigo-700',
    gradient: 'from-purple-50 to-indigo-50',
    highlight: 'ring-4 ring-purple-200',
  },
  enterprise: {
    badge: 'bg-gradient-to-r from-amber-400 to-orange-500 text-white border-amber-500',
    border: 'border-amber-300',
    button: 'bg-gradient-to-r from-amber-500 to-orange-600 text-white hover:from-amber-600 hover:to-orange-700',
    gradient: 'from-amber-50 to-orange-50',
  },
};
