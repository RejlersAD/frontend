import React from 'react'
import { Link } from 'react-router-dom'
import { REJLERS_COLORS, BRAND_TEXT } from '../config/theme.config'
import { LOGO_CONFIG, getLogoPath } from '../config/logo.config'

/**
 * Terms of Service Page - REJLERS RADAI
 * Professional legal document with brand styling
 * Last Updated: December 31, 2025
 */

const TermsOfService = () => {
  const sections = [
    {
      title: "1. Acceptance of Terms",
      content: `By accessing and using the RADAI platform ("Service"), you accept and agree to be bound by these Terms of Service. If you do not agree to these terms, please do not use our Service. These terms apply to all users, including visitors, registered users, and enterprise clients.`
    },
    {
      title: "2. Service Description",
      content: `RADAI is an AI-powered engineering intelligence platform designed for P&ID verification, PFD to P&ID conversion, comment resolution, and project control. The Service is provided by Rejlers International Engineering Solutions, operating from Abu Dhabi, United Arab Emirates.`
    },
    {
      title: "3. User Accounts",
      content: `To access certain features, you must register for an account. You are responsible for:
      
• Maintaining the confidentiality of your account credentials
• All activities that occur under your account
• Notifying us immediately of any unauthorized use
• Ensuring that your account information is accurate and current

We reserve the right to suspend or terminate accounts that violate these terms or engage in fraudulent activity.`
    },
    {
      title: "4. Acceptable Use Policy",
      content: `You agree not to:

• Use the Service for any unlawful purpose or in violation of any applicable laws
• Attempt to gain unauthorized access to our systems or other user accounts
• Upload malicious code, viruses, or any harmful software
• Interfere with or disrupt the Service or servers
• Use automated systems (bots, scrapers) without written permission
• Reverse engineer, decompile, or disassemble any part of the Service
• Resell, redistribute, or sublicense the Service without authorization`
    },
    {
      title: "5. Intellectual Property",
      content: `All content, features, and functionality of RADAI, including but not limited to text, graphics, logos, software, AI algorithms, and data compilations, are the exclusive property of Rejlers AB and protected by international copyright, trademark, patent, and trade secret laws.

You are granted a limited, non-exclusive, non-transferable license to access and use the Service for your intended business purposes. This license does not include any rights to:

• Copy, modify, or create derivative works
• Distribute, sell, or transfer the software
• Remove or alter any proprietary notices`
    },
    {
      title: "6. User-Generated Content",
      content: `When you upload engineering drawings, documents, or other content to RADAI:

• You retain ownership of your content
• You grant us a license to process, analyze, and store your content to provide the Service
• You represent that you have all necessary rights to upload the content
• You are responsible for ensuring your content does not violate any third-party rights
• We may use anonymized, aggregated data to improve our AI models

We do not claim ownership of your engineering data and documents.`
    },
    {
      title: "7. Privacy and Data Protection",
      content: `Your privacy is important to us. Our use of your personal data is governed by our Privacy Policy, which complies with:

• UAE Federal Law No. 45 of 2021 on the Protection of Personal Data
• ISO 27001 Information Security Management standards
• International data protection best practices

Please review our Privacy Policy for detailed information about data collection, processing, and security measures.`
    },
    {
      title: "8. Service Availability",
      content: `While we strive for 24/7 availability, we do not guarantee uninterrupted access to the Service. We may:

• Perform scheduled maintenance with advance notice
• Make emergency updates or repairs
• Modify or discontinue features with reasonable notice
• Experience downtime due to factors beyond our control

We are not liable for any losses resulting from Service unavailability.`
    },
    {
      title: "9. AI-Generated Results",
      content: `RADAI uses artificial intelligence to analyze engineering documents. You acknowledge that:

• AI-generated results should be reviewed by qualified engineers
• We do not guarantee 100% accuracy in all cases
• You are responsible for final verification and decision-making
• AI recommendations are advisory and not a substitute for professional judgment
• We continuously improve our algorithms but cannot eliminate all errors`
    },
    {
      title: "10. Fees and Payment",
      content: `Certain features require a paid subscription. By subscribing, you agree to:

• Pay all fees as specified in your subscription plan
• Provide accurate billing information
• Authorize automatic recurring charges (if applicable)
• Pay all applicable taxes

Fees are subject to change with 30 days' notice. Refunds are governed by our refund policy available upon request.`
    },
    {
      title: "11. Limitation of Liability",
      content: `To the maximum extent permitted by law:

• The Service is provided "as is" without warranties of any kind
• We are not liable for indirect, incidental, or consequential damages
• Our total liability shall not exceed the fees paid by you in the 12 months preceding the claim
• We are not responsible for third-party content or services
• We do not warrant that the Service will meet all your requirements

Nothing in these terms excludes liability for fraud, death, or personal injury caused by negligence.`
    },
    {
      title: "12. Indemnification",
      content: `You agree to indemnify and hold harmless Rejlers AB, its affiliates, officers, directors, employees, and agents from any claims, damages, losses, liabilities, and expenses (including legal fees) arising from:

• Your use of the Service
• Your violation of these terms
• Your infringement of any third-party rights
• Your user-generated content`
    },
    {
      title: "13. Termination",
      content: `We may terminate or suspend your access immediately, without prior notice, for:

• Breach of these Terms of Service
• Fraudulent or illegal activity
• Non-payment of fees
• At our discretion for any other reason

Upon termination:
• Your right to use the Service ceases immediately
• You must cease all use of our software and delete any copies
• We may delete your account and data after 30 days
• Certain provisions (intellectual property, limitations of liability) survive termination`
    },
    {
      title: "14. Governing Law and Jurisdiction",
      content: `These Terms of Service are governed by the laws of the United Arab Emirates. Any disputes shall be subject to the exclusive jurisdiction of the courts of Abu Dhabi, UAE.

For international clients, we may agree to alternative dispute resolution methods including arbitration under ICC rules.`
    },
    {
      title: "15. Changes to Terms",
      content: `We reserve the right to modify these terms at any time. We will notify users of material changes via:

• Email notification to registered users
• Prominent notice on the platform
• Updated "Last Modified" date on this page

Your continued use after changes constitutes acceptance of the modified terms.`
    },
    {
      title: "16. Contact Information",
      content: `For questions about these Terms of Service, please contact:

Rejlers International Engineering Solutions
Rejlers Tower, 13th Floor
AI Hamdan Street, P.O. Box 39317
Abu Dhabi, United Arab Emirates

Phone: +971 2 639 7449
Email: legal@rejlers.ae
Website: www.rejlers.com/ae`
    }
  ];

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-white">
      {/* Navigation Bar */}
      <nav className="bg-white/90 backdrop-blur-md border-b border-gray-200 sticky top-0 z-50 shadow-sm">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <Link to="/" className="flex items-center space-x-3 group">
              <div className="relative">
                <div className="absolute -inset-1 rounded-xl opacity-0 group-hover:opacity-100 transition duration-300 blur-sm" 
                     style={{ background: `linear-gradient(135deg, ${REJLERS_COLORS.secondary.green.base}, ${REJLERS_COLORS.secondary.turbine.base})` }}></div>
                <div className="relative bg-white rounded-xl shadow-md group-hover:shadow-xl transition-all duration-300 p-1">
                  <img 
                    src={getLogoPath('horizontal')}
                    alt={LOGO_CONFIG.primary.alt}
                    className="h-12 w-auto transition-all group-hover:scale-105"
                    style={{ filter: 'drop-shadow(0 2px 4px rgba(0,0,0,0.1))' }}
                    onError={(e) => {
                      e.target.style.display = 'none';
                      e.target.nextElementSibling.style.display = 'flex';
                    }}
                  />
                  <div style={{display: 'none'}} className="flex items-center h-12 px-2">
                    <div className="w-8 h-8 rounded-full flex items-center justify-center mr-2" style={{ background: `linear-gradient(135deg, ${REJLERS_COLORS.primary.base}, ${REJLERS_COLORS.secondary.green.base})` }}>
                      <span className="text-white font-black text-base">{LOGO_CONFIG.fallback.iconLetter}</span>
                    </div>
                    <span className="text-lg font-black" style={{ color: REJLERS_COLORS.primary.base }}>{LOGO_CONFIG.fallback.text}</span>
                  </div>
                </div>
              </div>
              <div>
                <div className="text-base font-bold text-gray-900">RADAI</div>
                <div className="text-xs font-semibold" style={{ color: REJLERS_COLORS.secondary.green.base }}>{LOGO_CONFIG.fallback.subtext}</div>
              </div>
            </Link>
            
            <Link 
              to="/" 
              className="flex items-center space-x-2 px-4 py-2 rounded-lg transition-colors hover:bg-gray-100"
              style={{ color: REJLERS_COLORS.primary.base }}
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
              </svg>
              <span className="text-sm font-semibold">Back to Home</span>
            </Link>
          </div>
        </div>
      </nav>

      {/* Header Section */}
      <section className="py-12 lg:py-16 bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900 text-white relative overflow-hidden">
        <div className="absolute inset-0 opacity-10">
          <div className="absolute inset-0" style={{
            backgroundImage: `linear-gradient(${REJLERS_COLORS.secondary.green.base} 1px, transparent 1px), linear-gradient(90deg, ${REJLERS_COLORS.secondary.green.base} 1px, transparent 1px)`,
            backgroundSize: '30px 30px'
          }}></div>
        </div>
        
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
          <div className="text-center">
            <div className="inline-flex items-center px-4 py-1.5 rounded-full border border-white/20 backdrop-blur-sm mb-4" style={{ background: `${REJLERS_COLORS.secondary.green.base}20` }}>
              <svg className="w-4 h-4 mr-2" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
              </svg>
              <span className="text-sm font-semibold">Legal Document</span>
            </div>
            
            <h1 className="text-3xl sm:text-4xl lg:text-5xl font-black mb-4">
              Terms of Service
            </h1>
            <p className="text-base lg:text-lg text-gray-300 mb-6">
              RADAI Platform by Rejlers International Engineering Solutions
            </p>
            <div className="flex items-center justify-center space-x-4 text-sm text-gray-400">
              <div className="flex items-center">
                <svg className="w-4 h-4 mr-1.5" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M6 2a1 1 0 00-1 1v1H4a2 2 0 00-2 2v10a2 2 0 002 2h12a2 2 0 002-2V6a2 2 0 00-2-2h-1V3a1 1 0 10-2 0v1H7V3a1 1 0 00-1-1zm0 5a1 1 0 000 2h8a1 1 0 100-2H6z" clipRule="evenodd" />
                </svg>
                Last Updated: December 31, 2025
              </div>
              <span>•</span>
              <div className="flex items-center">
                <svg className="w-4 h-4 mr-1.5" fill="currentColor" viewBox="0 0 20 20">
                  <path d="M9 2a1 1 0 000 2h2a1 1 0 100-2H9z" />
                  <path fillRule="evenodd" d="M4 5a2 2 0 012-2 3 3 0 003 3h2a3 3 0 003-3 2 2 0 012 2v11a2 2 0 01-2 2H6a2 2 0 01-2-2V5zm3 4a1 1 0 000 2h.01a1 1 0 100-2H7zm3 0a1 1 0 000 2h3a1 1 0 100-2h-3zm-3 4a1 1 0 100 2h.01a1 1 0 100-2H7zm3 0a1 1 0 100 2h3a1 1 0 100-2h-3z" clipRule="evenodd" />
                </svg>
                Version 2.0
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Content Section */}
      <section className="py-12 lg:py-16">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          {/* Introduction */}
          <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-6 lg:p-8 mb-8">
            <div className="flex items-start space-x-3">
              <div className="flex-shrink-0 w-10 h-10 rounded-full flex items-center justify-center" style={{ background: `linear-gradient(135deg, ${REJLERS_COLORS.secondary.green.base}, ${REJLERS_COLORS.secondary.turbine.base})` }}>
                <svg className="w-5 h-5 text-white" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
                </svg>
              </div>
              <div className="flex-1">
                <h2 className="text-lg font-bold text-gray-900 mb-2">Important Notice</h2>
                <p className="text-sm text-gray-600 leading-relaxed">
                  Please read these Terms of Service carefully before using the RADAI platform. 
                  These terms constitute a legally binding agreement between you and Rejlers International Engineering Solutions. 
                  By using our Service, you acknowledge that you have read, understood, and agree to be bound by these terms.
                </p>
              </div>
            </div>
          </div>

          {/* Terms Sections */}
          <div className="space-y-6">
            {sections.map((section, index) => (
              <div 
                key={index}
                className="bg-white rounded-xl shadow-sm border border-gray-200 p-5 lg:p-6 hover:shadow-md transition-shadow"
              >
                <h3 className="text-base lg:text-lg font-bold text-gray-900 mb-3" style={{ color: REJLERS_COLORS.primary.base }}>
                  {section.title}
                </h3>
                <p className="text-sm lg:text-base text-gray-700 leading-relaxed whitespace-pre-line">
                  {section.content}
                </p>
              </div>
            ))}
          </div>

          {/* Acceptance Section */}
          <div className="mt-8 bg-gradient-to-br from-gray-50 to-white rounded-2xl border-2 p-6 lg:p-8" style={{ borderColor: REJLERS_COLORS.secondary.green.base }}>
            <div className="text-center">
              <div className="w-16 h-16 mx-auto rounded-full flex items-center justify-center mb-4" style={{ background: `linear-gradient(135deg, ${REJLERS_COLORS.secondary.green.base}, ${REJLERS_COLORS.secondary.turbine.base})` }}>
                <svg className="w-8 h-8 text-white" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M6.267 3.455a3.066 3.066 0 001.745-.723 3.066 3.066 0 013.976 0 3.066 3.066 0 001.745.723 3.066 3.066 0 012.812 2.812c.051.643.304 1.254.723 1.745a3.066 3.066 0 010 3.976 3.066 3.066 0 00-.723 1.745 3.066 3.066 0 01-2.812 2.812 3.066 3.066 0 00-1.745.723 3.066 3.066 0 01-3.976 0 3.066 3.066 0 00-1.745-.723 3.066 3.066 0 01-2.812-2.812 3.066 3.066 0 00-.723-1.745 3.066 3.066 0 010-3.976 3.066 3.066 0 00.723-1.745 3.066 3.066 0 012.812-2.812zm7.44 5.252a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                </svg>
              </div>
              <h3 className="text-xl font-bold text-gray-900 mb-3">
                Questions or Concerns?
              </h3>
              <p className="text-sm text-gray-600 mb-6">
                If you have any questions about these Terms of Service, please don't hesitate to contact our legal team.
              </p>
              <div className="flex flex-col sm:flex-row gap-3 justify-center">
                <a 
                  href="mailto:legal@rejlers.ae"
                  className="inline-flex items-center justify-center px-6 py-2.5 rounded-lg font-semibold text-sm transition-all hover:scale-105 text-white"
                  style={{ background: `linear-gradient(to right, ${REJLERS_COLORS.secondary.green.base}, ${REJLERS_COLORS.secondary.green.accent})` }}
                >
                  <svg className="w-4 h-4 mr-2" fill="currentColor" viewBox="0 0 20 20">
                    <path d="M2.003 5.884L10 9.882l7.997-3.998A2 2 0 0016 4H4a2 2 0 00-1.997 1.884z" />
                    <path d="M18 8.118l-8 4-8-4V14a2 2 0 002 2h12a2 2 0 002-2V8.118z" />
                  </svg>
                  Contact Legal Team
                </a>
                <Link 
                  to="/"
                  className="inline-flex items-center justify-center px-6 py-2.5 bg-white border-2 rounded-lg font-semibold text-sm transition-all hover:scale-105"
                  style={{ color: REJLERS_COLORS.primary.base, borderColor: REJLERS_COLORS.secondary.green.base }}
                >
                  Return to Home
                </Link>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-gray-900 text-white py-8 border-t border-gray-800">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center text-sm text-gray-400">
            <p className="mb-2">© 2025 Rejlers AB • Engineering Excellence Since 1942</p>
            <div className="flex flex-wrap justify-center items-center gap-3">
              <Link to="/privacy-policy" className="hover:text-white transition-colors">Privacy Policy</Link>
              <span>•</span>
              <Link to="/terms-of-service" className="hover:text-white transition-colors">Terms of Service</Link>
              <span>•</span>
              <a href="https://www.rejlers.com/ae/contact-us/" target="_blank" rel="noopener noreferrer" className="hover:text-white transition-colors">Contact</a>
            </div>
          </div>
        </div>
      </footer>
    </div>
  )
}

export default TermsOfService
