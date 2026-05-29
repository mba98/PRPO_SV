'use client';

import AnimatedTableContainer from './AnimatedTableContainer';

export default function DataTable({ children, className = '', animate = true }) {
  return (
    <AnimatedTableContainer className={className} animate={animate}>
      <table className="data-table">{children}</table>
    </AnimatedTableContainer>
  );
}

export function DataTableHead({ children }) {
  return <thead>{children}</thead>;
}

export function DataTableBody({ children }) {
  return <tbody>{children}</tbody>;
}

export function DataTableRow({ children }) {
  return <tr>{children}</tr>;
}

export function DataTableCell({ children, mono = false, sticky = false, className = '' }) {
  return (
    <td
      className={`${mono ? 'font-mono-ltr font-mono text-xs' : ''} ${sticky ? 'sticky start-0 z-10 bg-card' : ''} ${className}`.trim()}
    >
      {children}
    </td>
  );
}

export function DataTableHeaderCell({ children, className = '' }) {
  return <th className={className}>{children}</th>;
}
