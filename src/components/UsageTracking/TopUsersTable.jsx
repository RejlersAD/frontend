/**
 * Top Users Table Component
 * 
 * Table showing top users by request count
 */

import React from 'react';
import { UserGroupIcon, TrophyIcon } from '@heroicons/react/24/outline';

const TopUsersTable = ({ users, timeRange }) => {
  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center">
          <UserGroupIcon className="h-6 w-6 text-purple-600 mr-2" />
          <h2 className="text-lg font-semibold text-gray-900">
            Top Active Users
          </h2>
        </div>
        <span className="text-xs text-gray-500">Most Requests</span>
      </div>

      {users && users.length > 0 ? (
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Rank
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  User
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Department
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Requests
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Tokens
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Avg Time
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Last Active
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {users.map((user, index) => (
                <tr key={user.user_id} className="hover:bg-gray-50 transition">
                  <td className="px-4 py-4 whitespace-nowrap">
                    <div className="flex items-center">
                      {index === 0 && (
                        <TrophyIcon className="h-5 w-5 text-yellow-500 mr-2" />
                      )}
                      {index === 1 && (
                        <TrophyIcon className="h-5 w-5 text-gray-400 mr-2" />
                      )}
                      {index === 2 && (
                        <TrophyIcon className="h-5 w-5 text-orange-400 mr-2" />
                      )}
                      <span className="text-sm font-medium text-gray-900">
                        #{index + 1}
                      </span>
                    </div>
                  </td>
                  <td className="px-4 py-4 whitespace-nowrap">
                    <div>
                      <div className="text-sm font-medium text-gray-900">
                        {user.username}
                      </div>
                      <div className="text-xs text-gray-500">
                        {user.email}
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-4 whitespace-nowrap">
                    <span className="px-2 py-1 text-xs font-medium bg-blue-100 text-blue-800 rounded">
                      {user.department || 'Unknown'}
                    </span>
                  </td>
                  <td className="px-4 py-4 whitespace-nowrap">
                    <span className="text-sm font-semibold text-gray-900">
                      {user.total_requests?.toLocaleString() || 0}
                    </span>
                  </td>
                  <td className="px-4 py-4 whitespace-nowrap">
                    <span className="text-sm text-gray-700">
                      {user.total_tokens?.toLocaleString() || 0}
                    </span>
                  </td>
                  <td className="px-4 py-4 whitespace-nowrap">
                    <span className="text-sm text-gray-700">
                      {user.avg_processing_time?.toFixed(2) || '0.00'}s
                    </span>
                  </td>
                  <td className="px-4 py-4 whitespace-nowrap">
                    <span className="text-xs text-gray-500">
                      {user.last_activity
                        ? new Date(user.last_activity).toLocaleString()
                        : 'N/A'}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="flex items-center justify-center h-48 text-gray-500">
          No user data available
        </div>
      )}
    </div>
  );
};

export default TopUsersTable;
