export interface ReadinessPayload {
  asOf: string
  modules: Module[]
  source?: 'live' | 'baseline'
  builtAt?: string
}

export type Module = DeliveryModule
export type Status = 'on_track' | 'in_progress' | 'early' | 'at_risk' | 'blocked'
export type DateConfidence = 'committed' | 'projected'

export interface SubTask {
  title: string
  status: string
}

export interface BucketItem {
  title: string
  detail?: string
  weight?: number
  subtasks?: SubTask[]
}

export interface DeliveryModule {
  key: string
  name: string
  sub: string
  phase: 'delivery'
  percent: number
  status: Status
  statusLabel: string
  note: string
  targetDate: string
  dateConfidence: DateConfidence
  assumed: boolean
  assumedLabel?: string
  accentColor?: string
  counts: { delivered: number; inProgress: number; remaining: number }
  buckets: {
    delivered: BucketItem[]
    inProgress: BucketItem[]
    remaining: BucketItem[]
  }
}

export const ANALYZER_KEYS = ['bank', 'id', 'pl', 'paystub', 'tax'] as const

export function buildPayload(now: string): ReadinessPayload {
  return { asOf: now, modules: MODULES, source: 'baseline' }
}

const bank: DeliveryModule = {
  key: 'bank',
  name: 'Bank Statement Analyzer',
  sub: 'Document-extraction analyzer. Build progress from the Analyzers workstream.',
  phase: 'delivery',
  percent: 77,
  status: 'on_track',
  statusLabel: 'On track',
  note: 'Figures assumed until the Analyzers board is tagged.',
  targetDate: '~6 July',
  dateConfidence: 'projected',
  assumed: true,
  assumedLabel: 'Awaiting board data',
  counts: { delivered: 0, inProgress: 0, remaining: 0 },
  buckets: { delivered: [], inProgress: [], remaining: [] },
}

const pe: DeliveryModule = {
  key: 'pe',
  name: 'Pricing & Eligibility',
  sub: 'Pricing engine, eligibility evaluation, product and rules catalogs.',
  phase: 'delivery',
  percent: 71,
  status: 'on_track',
  statusLabel: 'On track',
  note: '53 of 75 tracked stories accepted. The most mature module on the program.',
  targetDate: '11 July',
  dateConfidence: 'committed',
  assumed: false,
  counts: { delivered: 53, inProgress: 14, remaining: 8 },
  buckets: {
    delivered: [
      { title: 'Product catalog and field library.', detail: 'Loan attributes modeled, loanPASS-aligned.' },
      { title: 'Rules engine, end to end.', detail: 'Backend, frontend, and CI/CD all live.' },
      { title: 'Eligibility against real prequal data.', detail: 'Evaluates actual scenarios, explains each qualify or decline.' },
      { title: 'Add and modify products and rules.', detail: 'Admin can author eligibility and pricing without code.' },
    ],
    inProgress: [
      { title: 'Final price calculation.', detail: 'Refining the full price build-up.' },
      { title: 'Pricing accuracy fixes.', detail: 'CLTV bands, LPC, escrow waiver, scope-wins precedence.' },
      { title: 'Evaluation performance.', detail: 'Faster price evaluation in review.' },
    ],
    remaining: [
      { title: 'Load Series 2 through Z rules.', detail: 'Currently blocked, the main remaining lift.' },
      { title: 'Admin draft and publish workflow.', detail: 'Separate admin edits from the live calculator.' },
      { title: 'Residual calculation fixes.', detail: 'Field dependencies and edge cases.' },
    ],
  },
}

const vt: DeliveryModule = {
  key: 'vt',
  name: 'Verified Truth',
  sub: 'Governed, evidence-backed loan state. Currently defining the data model and integration contract.',
  phase: 'delivery',
  percent: 55,
  status: 'in_progress',
  statusLabel: 'In design',
  note: 'Data model and integration contract substantially in place. The governed lifecycle is the remaining build. Figures assumed.',
  targetDate: '6 July',
  dateConfidence: 'committed',
  assumed: true,
  assumedLabel: 'Architecture phase',
  accentColor: '#7A5FD0',
  // bcount strings are non-numeric; counts derived from bucket item count (delivered) and card bignum (inProgress, remaining)
  counts: { delivered: 3, inProgress: 1, remaining: 4 },
  buckets: {
    delivered: [
      { title: 'Integration-contract principle.', detail: 'Verified Truth established as the contract between modules, not point-to-point calls.' },
      { title: 'Downstream reaction model.', detail: 'How a truth change drives pricing, conditions, and underwriting is defined.' },
      { title: 'Truth record data model.', detail: 'Versioned scenario state per loan, designed and locked.' },
    ],
    inProgress: [
      { title: 'Provenance and versioning.', detail: 'Each value linked to the evidence version behind it. Being finalized.' },
    ],
    remaining: [
      { title: 'Propose, approve, publish.', detail: 'The governance workflow for every truth change.' },
      { title: 'Auto-recalculate on publish.', detail: 'Conditions, readiness, and pricing react automatically.' },
      { title: 'Version history view.', detail: 'Reconstruct the decision trail at any point.' },
    ],
  },
}

const uw: DeliveryModule = {
  key: 'uw',
  name: 'Underwriting',
  sub: 'Analyzer framework and verification center.',
  phase: 'delivery',
  percent: 69,
  status: 'on_track',
  statusLabel: 'On track',
  note: '9 of 13 framework stories accepted. Core analyzer plumbing is live.',
  targetDate: 'mid-August',
  dateConfidence: 'committed',
  assumed: false,
  accentColor: '#1E8E7E',
  counts: { delivered: 9, inProgress: 0, remaining: 4 },
  buckets: {
    delivered: [
      { title: 'Analyzer framework.', detail: 'Structured findings, manual trigger, full run history.' },
      { title: 'Auto re-run on new evidence.', detail: 'Replacement evidence re-triggers the right analyzers.' },
      { title: 'Analyzer service and workbench UI.', detail: 'Built and operational.' },
    ],
    inProgress: [
      { title: 'Individual analyzers.', detail: 'Bank and ID tracked on their own tabs.' },
    ],
    remaining: [
      { title: 'Verification center.', detail: 'Unified findings and discrepancy view for the underwriter.' },
      { title: 'Discrepancy accept and reject.', detail: 'With permanently recorded reason codes.' },
      { title: 'Truth-proposal handoff.', detail: 'The same output-contract dependency that gates the analyzers.' },
    ],
  },
}

const lexi: DeliveryModule = {
  key: 'lexi',
  name: 'Lexi Intelligence',
  sub: 'Agent orchestration and Generative UI. v1 is back online answering questions from pricing data.',
  phase: 'delivery',
  percent: 55,
  status: 'in_progress',
  statusLabel: 'In progress',
  note: '11 of 20 stories accepted. v1 orchestration and the Generative UI kit are live.',
  targetDate: '6 July',
  dateConfidence: 'committed',
  assumed: false,
  accentColor: '#C77DBB',
  counts: { delivered: 11, inProgress: 0, remaining: 9 },
  buckets: {
    delivered: [
      { title: 'Orchestration v1.', detail: 'Plan generation, sequencing, live progress.' },
      { title: 'Generative UI kit.', detail: 'Component library and interactive form flow with validation.' },
      { title: 'Edit-from-chat.', detail: 'First end-to-end agent use case, plus direct field updates.' },
    ],
    inProgress: [
      { title: 'Q&A on pricing data.', detail: 'Lexi answers from the engine, surfaced through Slack for now.' },
    ],
    remaining: [
      { title: 'Background autonomy.', detail: 'Auto-detect evidence, trigger analyzers, plan remediation for gaps.' },
      { title: 'Truth-proposal routing.', detail: 'Generate proposals from findings, route to the right approver.' },
      { title: 'Approval surface and resilience.', detail: 'Approve or reject in the workflow view, retry and recovery.' },
    ],
  },
}

const id: DeliveryModule = {
  key: 'id',
  name: 'ID Analyzer',
  sub: 'Identity document extraction and validation.',
  phase: 'delivery',
  percent: 30,
  status: 'early',
  statusLabel: 'Early build',
  note: 'Inherits the live analyzer framework. Identity-specific extraction and validation ahead. Figures assumed.',
  targetDate: '1 July',
  dateConfidence: 'committed',
  assumed: true,
  assumedLabel: 'Scaffolding done',
  accentColor: '#E0913B',
  // delivered bcount is "inherited foundation" (1 item); inProgress card shows 1; remaining card shows "—" (2 items listed)
  counts: { delivered: 1, inProgress: 1, remaining: 2 },
  buckets: {
    delivered: [
      { title: 'Analyzer framework.', detail: 'Structured findings, provenance, run history, auto re-run all reused.' },
    ],
    inProgress: [
      { title: 'Identity field extraction.', detail: 'Name, date of birth, document number, issue and expiry, issuing authority.' },
    ],
    remaining: [
      { title: 'Validation and flags.', detail: 'Expired ID, name or date-of-birth mismatch against the application and credit data.' },
      { title: 'Eligibility checks.', detail: 'Document type and residency status against program rules.' },
    ],
  },
}

const pl: DeliveryModule = {
  key: 'pl',
  name: 'P&L Analyzer',
  sub: 'Profit & Loss statement extraction for self-employed Non-QM income.',
  phase: 'delivery',
  percent: 0,
  status: 'early',
  statusLabel: 'Early build',
  note: 'Dedicated board just seeded. Figures assumed until stories land.',
  targetDate: 'Release Two',
  dateConfidence: 'projected',
  assumed: true,
  assumedLabel: 'Awaiting board data',
  accentColor: '#B5654A',
  counts: { delivered: 0, inProgress: 0, remaining: 0 },
  buckets: { delivered: [], inProgress: [], remaining: [] },
}

const paystub: DeliveryModule = {
  key: 'paystub',
  name: 'Paystub Analyzer',
  sub: 'Income extraction and verification from paystubs.',
  phase: 'delivery',
  percent: 0,
  status: 'early',
  statusLabel: 'Early build',
  note: 'Dedicated board just seeded. Figures assumed until stories land.',
  targetDate: 'Release Two',
  dateConfidence: 'projected',
  assumed: true,
  assumedLabel: 'Awaiting board data',
  accentColor: '#5B8C5A',
  counts: { delivered: 0, inProgress: 0, remaining: 0 },
  buckets: { delivered: [], inProgress: [], remaining: [] },
}

const tax: DeliveryModule = {
  key: 'tax',
  name: 'Tax Docs Analyzer',
  sub: 'Tax form extraction. Planned for Release Two.',
  phase: 'delivery',
  percent: 30,
  status: 'early',
  statusLabel: 'Early build',
  note: 'Framework scaffolding in place. Form-specific extraction is the bulk of the work, planned for Release Two. Figures assumed.',
  targetDate: '3 July',
  dateConfidence: 'committed',
  assumed: true,
  assumedLabel: 'Scaffolding done',
  accentColor: '#5A8FB5',
  // delivered bcount "inherited foundation" (1 item); inProgress card "—" (1 item); remaining card "—" (3 items)
  counts: { delivered: 1, inProgress: 1, remaining: 3 },
  buckets: {
    delivered: [
      { title: 'Analyzer framework.', detail: 'The same structured-findings and provenance plumbing the other analyzers use.' },
    ],
    inProgress: [
      { title: 'Coverage definition.', detail: 'Which forms, which fields, which discrepancy checks.' },
    ],
    remaining: [
      { title: 'Personal returns.', detail: 'Form 1040 with all schedules: AGI, wages, self-employment, rental income.' },
      { title: 'Business returns.', detail: 'Forms 1065, 1120-S, 1120: revenue, ordinary income, distributions, ownership.' },
      { title: 'Income forms.', detail: 'W-2, the 1099 family, and Schedule K-1 variants.' },
    ],
  },
}

export const MODULES: Module[] = [pe, vt, uw, lexi, bank, id, pl, paystub, tax]

export const MODULE_KEYS: readonly string[] = MODULES.map((m) => m.key)

export const MODULES_BY_KEY: Record<string, Module> = Object.fromEntries(
  MODULES.map((m) => [m.key, m]),
)
