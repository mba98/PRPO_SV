'use client';

const STATE_STYLES = {
  completed: 'border-emerald-500 bg-emerald-50 text-emerald-800',
  current: 'border-brand-500 bg-brand-50 text-brand-800 ring-2 ring-brand-200',
  pending: 'border-slate-200 bg-slate-50 text-slate-500',
  rejected: 'border-rose-500 bg-rose-50 text-rose-800',
  sap_creating: 'border-amber-500 bg-amber-50 text-amber-800 ring-2 ring-amber-200',
  sap_created: 'border-emerald-600 bg-emerald-50 text-emerald-900',
  sap_failed: 'border-rose-600 bg-rose-50 text-rose-900 ring-2 ring-rose-200',
};

const STATE_LABELS = {
  completed: 'Completed',
  current: 'Current',
  pending: 'Pending',
  rejected: 'Rejected',
  sap_creating: 'SAP creating',
  sap_created: 'SAP created',
  sap_failed: 'SAP failed',
};

export default function WorkflowStepper({ steps = [] }) {
  if (!steps.length) return null;

  return (
    <nav aria-label="Workflow progress" className="card overflow-x-auto">
      <ol className="flex min-w-max items-stretch gap-2 py-1">
        {steps.map((step, index) => (
          <li key={`${step.kind}-${step.stepOrder}`} className="flex items-center gap-2">
            <div
              className={`flex min-w-[9rem] flex-col rounded-lg border px-3 py-2 ${STATE_STYLES[step.state] || STATE_STYLES.pending}`}
            >
              <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                {index + 1}
              </span>
              <span className="text-sm font-medium">{step.stepName}</span>
              <span className="mt-1 text-xs">{STATE_LABELS[step.state] || step.state}</span>
            </div>
            {index < steps.length - 1 && (
              <span className="text-slate-300" aria-hidden>
                →
              </span>
            )}
          </li>
        ))}
      </ol>
    </nav>
  );
}
