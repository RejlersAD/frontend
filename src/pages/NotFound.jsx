import React from 'react'
import { Link } from 'react-router-dom'

/**
 * Not Found Page
 * 404 error page
 */

const NotFound = () => {
  return (
    <div className="container-custom py-16">
      <div className="max-w-2xl mx-auto text-center">
        <h1 className="text-9xl font-bold text-blue-600 dark:text-blue-400 mb-4">
          404
        </h1>
        <h2 className="text-3xl font-bold text-gray-900 dark:text-white mb-4">
          Page Not Found
        </h2>
        <p className="text-gray-600 dark:text-gray-400 mb-8">
          The page you&apos;re looking for doesn&apos;t exist or has been moved.
        </p>
        <Link to="/" className="btn-primary">
          Go Home
        </Link>
      </div>
    </div>
  )
}

export default NotFound
