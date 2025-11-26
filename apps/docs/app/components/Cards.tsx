import React from 'react';

export function Cards({ children }: { children: React.ReactNode }) {
  return <div className="nx-cards">{children}</div>;
}

export function Card({ 
  title, 
  href, 
  children 
}: { 
  title: string; 
  href: string; 
  children: React.ReactNode;
}) {
  return (
    <a href={href} className="nx-card-link">
      <div className="nx-card">
        <div className="nx-card-title">{title}</div>
        <div className="nx-card-desc">{children}</div>
      </div>
    </a>
  );
}

