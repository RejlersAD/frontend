import React from 'react';
import Tooltip from '@mui/material/Tooltip';

const OverviewTable = ({ columns, data, headerClass = "" }) => (
  <div className="overflow-x-auto">
    <table className="w-full text-sm" style={{ tableLayout: 'fixed' }}>
      <thead className={`sticky top-0 z-10 ${headerClass}`}>
        <tr>
          {columns.map(col => (
            <th
              key={col.key}
              className="border border-gray-300 dark:border-slate-600 px-3 py-3 text-left font-semibold text-gray-900 dark:text-slate-100"
              style={{
                width: col.width,
                minWidth: col.minWidth,
                whiteSpace: 'nowrap'
              }}
            >
              <Tooltip title={col.fullLabel || col.label} arrow placement="top">
                <span className="cursor-help">{col.label}</span>
              </Tooltip>
            </th>
          ))}
        </tr>
      </thead>
      <tbody className="bg-white dark:bg-slate-900">
        {data.map((row, idx) => (
          <tr key={idx}>
            {columns.map(col => (
              <td
                key={`${col.key}-${idx}`}
                className="border border-gray-300 dark:border-slate-600 px-3 py-2 text-gray-900 dark:text-slate-100"
                style={{
                  width: col.width,
                  minWidth: col.minWidth,
                  overflow: col.truncate ? 'hidden' : 'visible',
                  textOverflow: col.truncate ? 'ellipsis' : 'clip'
                }}
              >
                {row[col.key] || <span className="text-gray-400">−</span>}
              </td>
            ))}
          </tr>
        ))}
      </tbody>
    </table>
  </div>
);

export default OverviewTable;