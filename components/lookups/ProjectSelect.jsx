'use client';

import SapLookupCombobox from './SapLookupCombobox';

export default function ProjectSelect({ valueCode, valueLabel, onSelect, disabled }) {
  return (
    <SapLookupCombobox
      endpoint="/api/sap/projects"
      valueCode={valueCode}
      valueLabel={valueLabel}
      onSelect={(code, label) => onSelect(code, label)}
      getCode={(p) => p.projectCode}
      getLabel={(p) => `${p.projectCode} — ${p.projectName || ''}`}
      placeholder="Search project"
      disabled={disabled}
      minChars={0}
    />
  );
}
