import React from 'react';
import { Card, CardContent } from './Card';

const OverviewCard = ({
  title,
  value,
  valueColor, // <-- NEW
  description,
  icon,
  color,
  onClick,
  children // For extra content if needed
}) => (
  <Card
    className={`${color} cursor-pointer hover:shadow-lg hover:scale-[1.02] transition-all duration-300 border border-gray-200 dark:border-slate-700`}
    onClick={onClick}
  >
    <CardContent className="p-4 bg-white dark:bg-slate-800">
      <div className="flex items-center justify-between mb-2">
        <p className="text-sm font-medium text-gray-700 dark:text-gray-300">
          {title}
        </p>
        <div>{icon}</div>
      </div>
      <p className={`text-3xl font-bold mb-1 ${valueColor}`}>{value}</p>
      <p className="text-xs text-gray-600 dark:text-gray-400">{description}</p>
      {children}
    </CardContent>
  </Card>
);

export default OverviewCard;