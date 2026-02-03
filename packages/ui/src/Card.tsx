import React from 'react';

interface CardProps {
  children: React.ReactNode;
  className?: string;
  title?: string;
}

export const Card: React.FC<CardProps> = ({ children, className = '', title }) => (
  <div className={`bg-white border border-gray-200 rounded-lg shadow-sm p-4 ${className}`}>
    {title && <h2 className="text-lg font-bold mb-3">{title}</h2>}
    {children}
  </div>
);
