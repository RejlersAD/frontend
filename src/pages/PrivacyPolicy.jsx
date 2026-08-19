import React from 'react'
import { Link } from 'react-router-dom'
import { REJLERS_COLORS, BRAND_TEXT } from '../config/theme.config'
import { LOGO_CONFIG, getLogoPath } from '../config/logo.config'

/**
 * Privacy Policy Page - REJLERS RADAI
 * Based on Rejlers official privacy notices
 * Compliant with GDPR and data protection legislation
 * Last Updated: December 31, 2025
 * Build: 16:29:30
 */

const PrivacyPolicy = () => {
  const sections = [
    {
      title: "1. Introduction",
      content: `This privacy notice explains how we at Rejlers International Engineering Solutions ("Rejlers", "we", "us", or "our") process your personal data ("data") when you use the RADAI platform and outlines your rights regarding this data. As data controller, we are responsible for ensuring your data is processed legally. We want you to be informed and feel safe.

This Privacy Notice complies with:
• General Data Protection Regulation (GDPR)
• UAE Federal Law No. 45 of 2021 on the Protection of Personal Data
• International data protection best practices

By using the RADAI Service, you acknowledge that we will process your personal data in accordance with this privacy notice.`
    },
    {
      title: "2. Data Controller Information",
      content: `Rejlers International Engineering Solutions acts as the data controller for your personal information.

**Contact Details:**
Rejlers International Engineering Solutions
Rejlers Tower, 13th Floor
AI Hamdan Street, P.O. Box 39317
Abu Dhabi, United Arab Emirates

Phone: +971 2 639 7449
Email: tanzeem.agra@rejlers.ae

For data protection inquiries in your region:
• Sweden: dataskyddsgruppen@rejlers.se | +46 771 78 00 00
• Finland: tietosuoja@rejlers.fi | +358 207 520 700
• Norway: kontakt@rejlers.no | +47 22 33 66 33`
    },
    {
      title: "3. What Personal Data Do We Process?",
      content: `**3.1 Contact and Identification Details**
• Name, address, email address, phone number
• Organization, job title, and professional credentials
• Account credentials (encrypted passwords)
• User preferences and settings

**3.2 Engineering and Project Data**
• P&ID drawings and technical documents
• PFD files and conversion data
• Comment resolution records (CRS)
• Project control data and collaboration content
• Analysis results and verification reports
• Uploaded files and generated outputs

**3.3 Technical and Usage Data**
When you use our platform, your device automatically sends us technical information:
• IP address, browser type, and operating system
• How and how long you use our platform
• Pages visited and features used
• Time stamps and session duration
• Error logs and diagnostic data

**3.4 Communication Data**
• Messages or feedback provided through contact forms
• Support inquiries and correspondence
• Event registration and meeting attendance`
    },
    {
      title: "4. How Do We Collect Your Personal Data?",
      content: `We collect data in the following ways:

**Direct Collection:**
• During account registration and profile setup
• When you upload engineering documents and files
• Through your use of platform features
• Via contact forms and support inquiries
• When subscribing to updates or notifications

**Automatic Collection:**
• Technical data collected when you visit and use the platform
• Usage patterns and analytics data
• Cookie and tracking technologies (with your consent)

**From Other Sources:**
• From your organization during enterprise onboarding
• From authorities and official registries where applicable`
    },
    {
      title: "5. Why Do We Process Your Personal Data?",
      content: `We process your personal data only for reasons that are needed for providing our services, ensuring operational efficiency, and complying with legal obligations. The following outlines the primary legal bases for which we process data:

**Contract Performance:**
We process data to establish, manage, and fulfill our service contract with you:
• Creating and managing user accounts
• Processing P&ID verification and PFD conversion requests
• Performing AI-powered analysis and validation
• Generating compliance reports
• Facilitating team collaboration and project management
• Providing customer support and handling inquiries
• Managing payments and subscriptions

**Legitimate Interest:**
We process data to improve our services and maintain business operations:
• Analyzing usage patterns to enhance platform features
• Training and improving AI algorithms (using anonymized data)
• Identifying and fixing technical issues
• Conducting research and development
• Marketing and developing our business and services
• Managing customer communication and relationships

We ensure that processing based on legitimate interest is fair and meets your reasonable expectations.

**Legal Obligation:**
Local laws may require us to fulfill legal obligations or disclose data to authorities:
• Accounting, audit, and tax requirements
• Labor, environmental, and data protection laws
• Compliance with enforceable official requests

**Consent:**
We may process personal data based on your consent for specific purposes:
• Marketing communications (with your explicit consent)
• Optional cookies and analytics
• Newsletters and product updates

You are not required to provide consent, and you can withdraw your consent at any time without affecting the lawfulness of processing based on consent before withdrawal.`
    },
    {
      title: "6. Who Has Access to Your Personal Data?",
      content: `We do not sell or disclose data to third parties without a legal basis. We may share data with trusted parties as described below:

**Service Providers:**
We may share data with trusted service providers who help us with:
• Cloud hosting and infrastructure (AWS, Azure)
• Payment processors for subscription management
• Email service providers for communications
• Analytics platforms for service improvement
• Security and monitoring services
• IT support and maintenance

These service providers only process your data according to our instructions and for the purposes mentioned in this privacy notice. We ensure that shared data is adequately protected and that recipients are bound by contracts with sufficient data protection terms.

**Within Rejlers:**
Our employees may have access to your data on a need-to-know basis to perform their job duties. We may share your data with our affiliates where they are involved in service delivery or to support business operations, streamline processes, and ensure consistency across the organization.

**Legal Requirements:**
Data may be disclosed to authorities or other third parties if required by applicable law or enforceable official requests:
• Responding to court orders or legal processes
• Complying with government requests
• Protecting our rights and property
• Investigating fraud or security breaches
• Ensuring user safety

**Business Transfers:**
In the event of a merger, acquisition, or sale of assets, your information may be transferred to the acquiring entity, subject to the same privacy protections.`
    },
    {
      title: "7. How Long Do We Keep Your Personal Data?",
      content: `We keep your data only as long as necessary for its processing purpose or as required by applicable law. Below is a guideline on how long we store your data:

**Active Accounts:**
• Account and profile data: While your account is active and you continue to use the service
• Project and engineering data: For the duration of your subscription plus retention period

**Contractual Data:**
• Contractual records: 10 years from expiry of last contractual obligation
• Financial and accounting records: 7-10 years, depending on applicable tax and financial regulations

**Communication and Support Data:**
• Contact form inquiries: As long as necessary to address your queries
• Support tickets: Duration of issue resolution plus reasonable follow-up period
• Marketing communications: For the duration of your consent

**Technical and Usage Data:**
• Technical logs: Only as long as necessary for system maintenance and security
• Analytics data: Typically anonymized and retained for statistical purposes

**Legal and Compliance Data:**
• For the duration of any relevant legal requirement plus an additional period to cover potential claims or disputes

**Inactive Accounts:**
• If you stop using the Service, we may retain your data for up to 12 months before deletion
• We will notify you before permanent deletion

**Backup Systems:**
• Data in backup systems is deleted according to our backup retention schedule

We may also keep your data longer if needed for legal reasons, such as claims, litigation, or internal investigations. After these periods, we delete or anonymize your data.

You may request deletion of your data at any time by contacting us (see Section 10).`
    },
    {
      title: "8. How Do We Protect Your Personal Data?",
      content: `We consider personal integrity a top priority and actively strive to keep your data safe. We take all reasonably expected technical and organizational measures to ensure that data is processed securely and protected from loss, accidental destruction, misuse, and unauthorized access or alteration.

**Technical Safeguards:**
• End-to-end encryption for data in transit (TLS/SSL)
• AES-256 encryption for data at rest
• Secure authentication with multi-factor support
• Regular security audits and penetration testing
• Intrusion detection and prevention systems
• Automated backup and disaster recovery
• Firewalls and antivirus software
• Encrypted database connections

**Organizational Measures:**
• ISO 27001 certified information security management
• Staff training on data protection and privacy
• Access controls and role-based permissions
• Regular security policy reviews
• Incident response procedures
• Confidentiality agreements with all personnel
• Secure physical locations for materials storage

**International Data Transfers:**
We transfer your data to service providers outside the EU/EEA only when necessary for the technical and practical implementation of data processing, such as when a service provider operates outside these areas. In such cases, we ensure they have appropriate safeguards and data protection measures in place:
• Standard Contractual Clauses approved by relevant authorities
• Adequacy decisions by competent authorities
• Other legally recognized transfer mechanisms

Your data is always protected with the same level of security regardless of location.

**Your Responsibilities:**
• Keep your account credentials secure and confidential
• Use strong, unique passwords
• Enable two-factor authentication when available
• Report suspicious activity immediately
• Log out when using shared or public devices
• Do not share your account with others`
    },
    {
      title: "9. Your Data Protection Rights",
      content: `According to data protection legislation, you have the following rights:

**Right to Information:**
You have the right to obtain information on how we process your data.

**Right of Access:**
You have the right to access the data we hold about you and receive a copy.

**Right to Rectification:**
You have the right to correct inaccurate or incomplete information about you.

**Right to Erasure ("Right to be Forgotten"):**
You have the right to request deletion of your data under certain circumstances.

**Right to Restrict Processing:**
You have the right to limit how we use your data in certain circumstances.

**Right to Data Portability:**
You have the right to receive your data in a structured, machine-readable format and transfer it to another service provider.

**Right to Object:**
You have the right to object to processing based on legitimate interests or for direct marketing purposes.

**Right to Withdraw Consent:**
You have the right to withdraw consent for processing activities at any time.

**How to Exercise Your Rights:**
You can exercise these rights by contacting us (see Section 10 for contact details). We may need to verify your identity before processing your request.

Please note that if we comply with your request to withdraw consent or restrict or delete personal data, you may no longer be able to receive services that you previously received, ordered, or requested.

The applicability and extent of the above-mentioned rights are determined on a case-by-case basis in accordance with applicable data protection legislation. We will respond to your request within 30 days.`
    },
    {
      title: "10. Contact Information",
      content: `For any questions or concerns about your data and this privacy notice, please contact us:

**Rejlers Abu Dhabi:**
Email: tanzeem.agra@rejlers.ae
Phone: +971 2 639 7449
Address: Rejlers Tower, 13th Floor, AI Hamdan Street, P.O. Box 39317, Abu Dhabi, UAE

**Regional Data Protection Contacts:**

**Sweden:**
Email: dataskyddsgruppen@rejlers.se
Phone: +46 771 78 00 00

**Finland:**
Email: tietosuoja@rejlers.fi
Phone: +358 207 520 700

**Norway:**
Email: kontakt@rejlers.no
Phone: +47 22 33 66 33

We are committed to resolving privacy concerns promptly and transparently.`
    },
    {
      title: "11. Right to Lodge a Complaint",
      content: `If you feel that the processing of your data is not done legally, you have the right to file a complaint with the relevant supervisory authority:

**Sweden:**
Swedish Authority for Privacy Protection (Integritetsskyddsmyndigheten)
Email: imy@imy.se
Phone: +46 (0)8 657 61 00

**Finland:**
Office of the Data Protection Ombudsman (Tietosuojavaltuutetun toimisto)
Email: tietosuoja@om.fi
Phone: +358 29 566 6777

**Norway:**
Norwegian Data Protection Authority (Datatilsynet)
Email: postkasse@datatilsynet.no
Phone: +47 22 39 69 00

**United Arab Emirates:**
UAE Data Protection Authority
For information on data protection regulations in the UAE`
    },
    {
      title: "12. Cookies and Tracking Technologies",
      content: `We use cookies and similar technologies to enhance your experience on the RADAI platform. Cookies are small text files that can be used by websites to make a user's experience more efficient.

**Types of Cookies We Use:**

**Necessary Cookies (Essential):**
These cookies are required for authentication and core platform functionality. They cannot be disabled as the platform cannot function properly without them.

**Functional Cookies (Preferences):**
These cookies remember your preferences and settings to provide a more personalized experience.

**Analytics Cookies (Statistics):**
These cookies help us understand how you use the platform by collecting and reporting information anonymously. Used only with your consent.

**Security Cookies:**
These cookies detect fraudulent activity and enhance platform security.

**Managing Cookies:**
You can manage cookie preferences through your browser settings. Note that disabling certain cookies may affect platform functionality, particularly necessary cookies required for authentication and core features.

The law states that we can store cookies on your device if they are strictly necessary for the operation of the platform. For all other types of cookies, we need your permission.

For detailed information about cookies and how to manage them, please refer to your browser's help documentation or contact us at tanzeem.agra@rejlers.ae`
    },
    {
      title: "13. Third-Party Links",
      content: `The RADAI platform may contain links to third-party websites, applications, or services. This privacy notice does not apply to external sites.

We are not responsible for the privacy practices of third parties. Please note that if you navigate to other websites through links provided on our platform, those websites are not under our control, and this privacy notice does not apply to them. Other website providers collect and use your data according to their own privacy practices.

We encourage you to review the privacy policies of any third-party services you access through our platform. Third-party links are provided for convenience only and do not constitute an endorsement.`
    },
    {
      title: "14. Changes to This Privacy Notice",
      content: `We may at our sole discretion update this privacy notice occasionally to reflect changes in our practices, legal requirements, or service features.

**How We Notify You of Changes:**
• Update the "Last Updated" date at the top of this page
• For registered users, we will notify you via email of significant changes
• Display a prominent notice on the platform
• Update the notice on our website (always available at www.rejlers.com)

**Your Continued Use:**
We encourage you to review this privacy notice periodically. The latest version will always be available on our platform. Your continued use of the RADAI Service after changes constitutes acceptance of the updated policy.

For material changes that require renewed consent under applicable law, we will request your explicit consent before the changes take effect.`
    },
    {
      title: "15. Children's Privacy and Business Use",
      content: `**Age Restrictions:**
RADAI is a professional engineering platform intended for business use by qualified professionals. The platform is not designed for or directed at individuals under 18 years of age.

**No Knowingly Collection from Minors:**
We do not knowingly collect personal information from individuals under 18 years of age. If we discover that we have inadvertently collected data from a minor, we will delete it immediately.

**Parental Notice:**
If you are a parent or guardian and you believe your child has provided us with personal data, please contact us immediately at tanzeem.agra@rejlers.ae, and we will take steps to remove such information from our systems.

**Business and Professional Use:**
All users must be of legal age to enter into a binding contract and have the authority to use the platform on behalf of their organization.`
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
                <div className="relative bg-white rounded-xl shadow-md group-hover:shadow-xl transition-all duration-300 p-2">
                  <img 
                    src={getLogoPath()}
                    alt={LOGO_CONFIG.primary.alt}
                    className="h-10 w-auto transition-all group-hover:scale-105"
                    style={{ filter: 'drop-shadow(0 2px 4px rgba(0,0,0,0.1))' }}
                    onError={(e) => {
                      e.target.style.display = 'none';
                      e.target.nextElementSibling.style.display = 'flex';
                    }}
                  />
                  <div style={{display: 'none'}} className="flex items-center h-10 px-2">
                    <img 
                      src={LOGO_CONFIG.fallback.image}
                      alt={LOGO_CONFIG.primary.alt}
                      className="h-full w-auto"
                    />
                  </div>
                </div>
              </div>
              <div>
                <div className="flex items-center space-x-2">
                  <span className="text-base font-bold bg-gradient-to-r from-[#00a896] to-[#73bdc8] bg-clip-text text-transparent">RADAI</span>
                  <span className="px-1.5 py-0.5 text-[8px] font-bold text-white rounded-full" style={{ background: `linear-gradient(135deg, ${REJLERS_COLORS.secondary.green.base}, ${REJLERS_COLORS.secondary.turbine.base})` }}>AI</span>
                </div>
                <div className="text-[10px] font-medium text-gray-600">by Rejlers Engineering Solutions</div>
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
            <div className="inline-flex items-center px-4 py-1.5 rounded-full border border-white/20 backdrop-blur-sm mb-4" style={{ background: `${REJLERS_COLORS.secondary.turbine.base}20` }}>
              <svg className="w-4 h-4 mr-2" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M2.166 4.999A11.954 11.954 0 0010 1.944 11.954 11.954 0 0017.834 5c.11.65.166 1.32.166 2.001 0 5.225-3.34 9.67-8 11.317C5.34 16.67 2 12.225 2 7c0-.682.057-1.35.166-2.001zm11.541 3.708a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
              </svg>
              <span className="text-sm font-semibold">Data Protection & Privacy</span>
            </div>
            
            <h1 className="text-3xl sm:text-4xl lg:text-5xl font-black mb-4">
              Privacy Policy
            </h1>
            <p className="text-base lg:text-lg text-gray-300 mb-6">
              Your privacy and data security are our top priorities
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
                  <path fillRule="evenodd" d="M2.166 4.999A11.954 11.954 0 0010 1.944 11.954 11.954 0 0017.834 5c.11.65.166 1.32.166 2.001 0 5.225-3.34 9.67-8 11.317C5.34 16.67 2 12.225 2 7c0-.682.057-1.35.166-2.001zm11.541 3.708a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                </svg>
                GDPR Compliant
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Content Section */}
      <section className="py-12 lg:py-16">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          {/* Key Highlights */}
          <div className="bg-gradient-to-br from-blue-50 to-green-50 rounded-2xl border-2 p-6 lg:p-8 mb-8" style={{ borderColor: REJLERS_COLORS.secondary.turbine.base }}>
            <div className="flex items-start space-x-3">
              <div className="flex-shrink-0 w-10 h-10 rounded-full flex items-center justify-center" style={{ background: `linear-gradient(135deg, ${REJLERS_COLORS.secondary.turbine.base}, ${REJLERS_COLORS.secondary.green.base})` }}>
                <svg className="w-5 h-5 text-white" fill="currentColor" viewBox="0 0 20 20">
                  <path d="M9 2a1 1 0 000 2h2a1 1 0 100-2H9z" />
                  <path fillRule="evenodd" d="M4 5a2 2 0 012-2 3 3 0 003 3h2a3 3 0 003-3 2 2 0 012 2v11a2 2 0 01-2 2H6a2 2 0 01-2-2V5zm3 4a1 1 0 000 2h.01a1 1 0 100-2H7zm3 0a1 1 0 000 2h3a1 1 0 100-2h-3zm-3 4a1 1 0 100 2h.01a1 1 0 100-2H7zm3 0a1 1 0 100 2h3a1 1 0 100-2h-3z" clipRule="evenodd" />
                </svg>
              </div>
              <div className="flex-1">
                <h2 className="text-lg font-bold text-gray-900 mb-2">Our Privacy Commitments</h2>
                <ul className="text-sm text-gray-700 space-y-2">
                  <li className="flex items-start">
                    <svg className="w-5 h-5 mr-2 mt-0.5 flex-shrink-0" style={{ color: REJLERS_COLORS.secondary.green.base }} fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                    </svg>
                    <span><strong>We do not sell your personal data</strong> or engineering documents to third parties</span>
                  </li>
                  <li className="flex items-start">
                    <svg className="w-5 h-5 mr-2 mt-0.5 flex-shrink-0" style={{ color: REJLERS_COLORS.secondary.green.base }} fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                    </svg>
                    <span><strong>Military-grade encryption</strong> protects your data (AES-256) in storage and transit (TLS/SSL)</span>
                  </li>
                  <li className="flex items-start">
                    <svg className="w-5 h-5 mr-2 mt-0.5 flex-shrink-0" style={{ color: REJLERS_COLORS.secondary.green.base }} fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                    </svg>
                    <span><strong>ISO 27001 certified</strong> information security management system</span>
                  </li>
                  <li className="flex items-start">
                    <svg className="w-5 h-5 mr-2 mt-0.5 flex-shrink-0" style={{ color: REJLERS_COLORS.secondary.green.base }} fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                    </svg>
                    <span><strong>You retain full ownership</strong> of all your engineering data and documents</span>
                  </li>
                  <li className="flex items-start">
                    <svg className="w-5 h-5 mr-2 mt-0.5 flex-shrink-0" style={{ color: REJLERS_COLORS.secondary.green.base }} fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                    </svg>
                    <span><strong>You have full control</strong> over your data with rights to access, modify, or delete it</span>
                  </li>
                </ul>
              </div>
            </div>
          </div>

          {/* Privacy Sections */}
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

          {/* Contact Section */}
          <div className="mt-8 bg-gradient-to-br from-gray-50 to-white rounded-2xl border-2 p-6 lg:p-8" style={{ borderColor: REJLERS_COLORS.secondary.turbine.base }}>
            <div className="text-center">
              <div className="w-16 h-16 mx-auto rounded-full flex items-center justify-center mb-4" style={{ background: `linear-gradient(135deg, ${REJLERS_COLORS.secondary.turbine.base}, ${REJLERS_COLORS.secondary.green.base})` }}>
                <svg className="w-8 h-8 text-white" fill="currentColor" viewBox="0 0 20 20">
                  <path d="M2.003 5.884L10 9.882l7.997-3.998A2 2 0 0016 4H4a2 2 0 00-1.997 1.884z" />
                  <path d="M18 8.118l-8 4-8-4V14a2 2 0 002 2h12a2 2 0 002-2V8.118z" />
                </svg>
              </div>
              <h3 className="text-xl font-bold text-gray-900 mb-3">
                Privacy Questions or Data Requests?
              </h3>
              <p className="text-sm text-gray-600 mb-6">
                Our team is here to help with any privacy concerns or to assist with exercising your data rights.
              </p>
              <div className="flex flex-col sm:flex-row gap-3 justify-center">
                <a 
                  href="mailto:tanzeem.agra@rejlers.ae"
                  className="inline-flex items-center justify-center px-6 py-2.5 rounded-lg font-semibold text-sm transition-all hover:scale-105 text-white"
                  style={{ background: `linear-gradient(to right, ${REJLERS_COLORS.secondary.turbine.base}, ${REJLERS_COLORS.secondary.turbine.accent})` }}
                >
                  <svg className="w-4 h-4 mr-2" fill="currentColor" viewBox="0 0 20 20">
                    <path d="M2.003 5.884L10 9.882l7.997-3.998A2 2 0 0016 4H4a2 2 0 00-1.997 1.884z" />
                    <path d="M18 8.118l-8 4-8-4V14a2 2 0 002 2h12a2 2 0 002-2V8.118z" />
                  </svg>
                  Contact Privacy Team
                </a>
                <Link 
                  to="/"
                  className="inline-flex items-center justify-center px-6 py-2.5 bg-white border-2 rounded-lg font-semibold text-sm transition-all hover:scale-105"
                  style={{ color: REJLERS_COLORS.primary.base, borderColor: REJLERS_COLORS.secondary.turbine.base }}
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

export default PrivacyPolicy
