'use client';

import { useEffect, useState } from 'react';
import { formatMoneyInput, parseMoneyInput } from '@/lib/lpMoney';

export default function MoneyInput({
  value,
  onChange,
  currency = 'IQD',
  className = 'input-field',
  required = false,
  disabled = false,
  id,
  'aria-label': ariaLabel,
}) {
  const [focused, setFocused] = useState(false);
  const [display, setDisplay] = useState('');

  useEffect(() => {
    if (!focused) {
      setDisplay(value == null || value === '' ? '' : formatMoneyInput(value, currency));
    }
  }, [value, focused, currency]);

  function commitDisplay(raw) {
    const parsed = parseMoneyInput(raw);
    if (parsed === null) {
      onChange(0);
      return;
    }
    if (parsed < 0) return;
    onChange(parsed);
  }

  return (
    <input
      id={id}
      type="text"
      inputMode="decimal"
      className={className}
      aria-label={ariaLabel}
      required={required}
      disabled={disabled}
      value={focused ? display : formatMoneyInput(value, currency)}
      onFocus={() => {
        setFocused(true);
        setDisplay(value == null || value === '' ? '' : String(value));
      }}
      onBlur={() => {
        setFocused(false);
        commitDisplay(display);
      }}
      onChange={(e) => {
        const raw = e.target.value;
        setDisplay(raw);
        const parsed = parseMoneyInput(raw);
        if (parsed !== null && parsed >= 0) {
          onChange(parsed);
        }
      }}
    />
  );
}
