import { Link } from 'react-router-dom';

/**
 * Placeholder for the legacy P&ID Verification V1 route
 * (/engineering/process/pid-verification-v1).
 * V1 was removed for a from-scratch redesign; existing projects and
 * drawings are kept in the database. Active module: P&ID Verification V2.
 */
export default function PlaceholderPidVerification() {
  return (
    <div className="min-h-[60vh] flex items-center justify-center p-8">
      <div className="max-w-md text-center space-y-4">
        <h1 className="text-2xl font-semibold text-gray-800">P&amp;ID Verification</h1>
        <p className="text-gray-600">
          This application is being redesigned. Existing projects and drawings are kept.
        </p>
        <Link
          to="/engineering/process/pid-verification"
          className="inline-block px-4 py-2 rounded-lg bg-indigo-600 text-white hover:bg-indigo-700 transition-colors"
        >
          Open P&amp;ID Verification V2
        </Link>
      </div>
    </div>
  );
}
