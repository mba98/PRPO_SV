'use client';

import AnimatedStatusBadge from './AnimatedStatusBadge';

/** HRMS-aligned status badge — delegates to AnimatedStatusBadge */
export default function StatusBadge(props) {
  return <AnimatedStatusBadge {...props} />;
}
