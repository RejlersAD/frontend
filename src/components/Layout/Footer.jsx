import React from 'react'
import { Link } from 'react-router-dom'
import { APP_NAME, APP_VERSION } from '../../config/app.config'
import { FOOTER_CONFIG } from '../../config/footer.config'

/**
 * Footer Component
 * Smart footer with app information and company details
 */

const Footer = () => {
  const currentYear = new Date().getFullYear()

  return (
    <footer className="bg-white dark:bg-gray-800 border-t border-gray-200 dark:border-gray-700 mt-auto">
      <div className="container-custom py-6">
        <div className="flex flex-col md:flex-row items-center justify-between">
          <p className="text-gray-600 dark:text-gray-400 text-sm">
            &copy; {currentYear} {APP_NAME} • {FOOTER_CONFIG.contact.company} • v{APP_VERSION}
          </p>
          <div className="flex space-x-6 mt-4 md:mt-0">
            {FOOTER_CONFIG.bottomBar.links.slice(0, 3).map((link, index) => (
              link.external ? (
                <a
                  key={index}
                  href={link.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-gray-600 dark:text-gray-400 hover:text-blue-600 dark:hover:text-blue-400 text-sm transition-colors"
                >
                  {link.label}
                </a>
              ) : (
                <Link
                  key={index}
                  to={link.url}
                  className="text-gray-600 dark:text-gray-400 hover:text-blue-600 dark:hover:text-blue-400 text-sm transition-colors"
                >
                  {link.label}
                </Link>
              )
            ))}
          </div>
        </div>
      </div>
    </footer>
  )
}

export default Footer
