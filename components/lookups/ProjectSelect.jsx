'use client';

import SearchableLookup from './SearchableLookup';

export default function ProjectSelect({ valueCode, valueLabel, onSelect, disabled, placeholder = 'Search project' }) {
  return (
    <SearchableLookup
      endpoint="/api/sap/projects"
      value={valueCode}
      label={valueLabel}
      onSelect={(code, label) => onSelect(code, label)}
      placeholder={placeholder}
      disabled={disabled}
      loadAllOnFocus={false}
      minChars={1}
    />
  );
}
