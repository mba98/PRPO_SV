'use client';

import { motion, useReducedMotion } from 'framer-motion';
import { useI18n } from '@/lib/hooks/useI18n';
import { useMotionSafe } from '@/components/ui/useMotionSafe';

const STEP_NAME_RULES = [
  { pattern: /warehouse/i, key: 'warehouseApproval' },
  { pattern: /project manager|pm approval/i, key: 'projectManagerApproval' },
  { pattern: /finance/i, key: 'financeApproval' },
  { pattern: /^created$/i, key: 'created' },
];

function resolveStepTitle(step, workflow, documentType) {
  if (step.kind === 'sap') {
    if (documentType === 'PO') return workflow.sapPoCreated;
    if (documentType === 'APRI') return workflow.sapApriCreated;
    return workflow.sapCreated;
  }
  const name = step.stepName || '';
  for (const rule of STEP_NAME_RULES) {
    if (rule.pattern.test(name) && workflow[rule.key]) {
      return workflow[rule.key];
    }
  }
  if (/sap created/i.test(name)) {
    if (documentType === 'PO') return workflow.sapPoCreated;
    return workflow.sapCreated;
  }
  return name || `Step ${step.stepOrder}`;
}

function stateLabel(state, workflow) {
  switch (state) {
    case 'completed':
    case 'sap_created':
      return workflow.completed;
    case 'current':
      return workflow.current;
    case 'rejected':
      return workflow.rejected;
    case 'sap_failed':
      return workflow.failed;
    case 'sap_creating':
      return workflow.creatingInSap;
    default:
      return workflow.pending;
  }
}

function circleClass(state) {
  switch (state) {
    case 'completed':
    case 'sap_created':
      return 'workflow-step-circle--completed';
    case 'current':
      return 'workflow-step-circle--current';
    case 'rejected':
      return 'workflow-step-circle--rejected';
    case 'sap_failed':
      return 'workflow-step-circle--sap_failed';
    case 'sap_creating':
      return 'workflow-step-circle--sap_creating';
    default:
      return 'workflow-step-circle--pending';
  }
}

function connectorActive(prevState) {
  return (
    prevState === 'completed' ||
    prevState === 'current' ||
    prevState === 'sap_created' ||
    prevState === 'sap_creating'
  );
}

function CheckIcon() {
  return (
    <svg viewBox="0 0 20 20" className="h-4 w-4" aria-hidden fill="currentColor">
      <path d="M7.5 13.2 4.3 10l1.4-1.4 1.8 1.8 6.3-6.3 1.4 1.4-7.7 7.7z" />
    </svg>
  );
}

function ChevronIcon({ rtl }) {
  return (
    <svg
      viewBox="0 0 24 24"
      className={`workflow-connector-chevron h-4 w-4 shrink-0 ${rtl ? 'rotate-180' : ''}`}
      aria-hidden
      fill="none"
      stroke="currentColor"
      strokeWidth="2.5"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M9 6l6 6-6 6" />
    </svg>
  );
}

function WorkflowConnector({ active, isRtl, reduceMotion }) {
  const chevronMotion = useMotionSafe(
    reduceMotion
      ? {}
      : {
          x: isRtl ? [-4, 0, -4] : [0, 4, 0],
          transition: { duration: 1.2, repeat: Infinity, ease: 'easeInOut' },
        },
  );

  return (
    <>
      <div
        className="workflow-connector my-1 flex min-h-[1.5rem] flex-col items-center md:hidden"
        aria-hidden
      >
        <div
          className={`workflow-connector-line min-h-[1.25rem] w-[2px] rounded-full ${active ? 'workflow-connector-line--active-vertical' : ''}`}
        />
      </div>
      <div
        className="workflow-connector mx-1 hidden min-w-[2.5rem] flex-1 items-center gap-1 md:flex"
        aria-hidden
      >
        <div
          className={`workflow-connector-line h-[2px] flex-1 rounded-full ${active ? 'workflow-connector-line--active' : ''}`}
        />
        <motion.span className="flex shrink-0" animate={active ? chevronMotion : undefined}>
          <ChevronIcon rtl={isRtl} />
        </motion.span>
      </div>
    </>
  );
}

function WorkflowStepCard({ step, index, workflow, documentType, reduceMotion }) {
  const title = resolveStepTitle(step, workflow, documentType);
  const status = stateLabel(step.state, workflow);
  const isCurrent = step.state === 'current' || step.state === 'sap_creating';
  const isDone = step.state === 'completed' || step.state === 'sap_created';

  const enterProps = useMotionSafe({
    initial: { opacity: 0, y: 8 },
    animate: { opacity: 1, y: 0 },
    transition: { duration: 0.25, delay: index * 0.05 },
  });

  const pulseProps = useMotionSafe(
    isCurrent && !reduceMotion
      ? {
          boxShadow: [
            '0 0 0 0 color-mix(in srgb, var(--primary) 35%, transparent)',
            '0 0 0 8px color-mix(in srgb, var(--primary) 0%, transparent)',
          ],
          transition: { duration: 1.5, repeat: Infinity, ease: 'easeOut' },
        }
      : {},
  );

  return (
    <motion.div className="workflow-step-card" {...enterProps}>
      <motion.div
        className={`workflow-step-circle ${circleClass(step.state)}`}
        animate={pulseProps}
      >
        {isDone ? <CheckIcon /> : index + 1}
      </motion.div>
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-semibold text-foreground">{title}</p>
        <p
          className={`mt-0.5 text-[10px] font-bold uppercase tracking-widest ${
            isCurrent
              ? 'text-primary'
              : isDone
                ? 'text-primary/80'
                : step.state === 'rejected' || step.state === 'sap_failed'
                  ? 'text-destructive'
                  : 'text-muted-foreground'
          }`}
        >
          {status}
        </p>
      </div>
    </motion.div>
  );
}

export default function WorkflowStepper({ steps = [], documentType = 'PR' }) {
  const { workflow: wf, isRtl } = useI18n();
  const reduceMotion = useReducedMotion();

  if (!steps.length) return null;

  return (
    <nav aria-label={wf.progressLabel} className="workflow-stepper">
      <ol
        className={`workflow-stepper-list ${isRtl ? 'workflow-stepper-list--rtl' : ''}`}
      >
        {steps.map((step, index) => (
          <li
            key={`${step.kind}-${step.stepOrder}`}
            className="workflow-step-item snap-center md:snap-align-none"
          >
            <WorkflowStepCard
              step={step}
              index={index}
              workflow={wf}
              documentType={documentType}
              reduceMotion={reduceMotion}
            />
            {index < steps.length - 1 && (
              <WorkflowConnector
                active={connectorActive(step.state)}
                isRtl={isRtl}
                reduceMotion={reduceMotion}
              />
            )}
          </li>
        ))}
      </ol>
    </nav>
  );
}
