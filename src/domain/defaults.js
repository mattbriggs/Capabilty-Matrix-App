// Documented defaults. Version 1 defaults are reproduced exactly for migration.

export const SUPPORTED_VERSION = 2;

export const defaultAudiences = [
  { id: 'client', label: 'Client', description: 'Uses and funds the capability', need: 'Clear outcomes, usable guidance and a dependable operating experience.' },
  { id: 'consultant', label: 'Consultant', description: 'Advises, designs and enables', need: 'Practical guidance for tailoring the product to a client context.' },
  { id: 'product-team', label: 'Product team', description: 'Builds and operates the product', need: 'A clear product boundary, data contract and implementation ownership.' },
  { id: 'leadership', label: 'Leadership', description: 'Sets direction and allocates resources', need: 'A defensible scope decision with visible dependencies and risk.' },
  { id: 'wider-domain', label: 'Wider domain', description: 'Extends value across the ecosystem', need: 'How local capabilities contribute to the evolving domain solution.' },
];
export const defaultOwnerLabels = { appliance: 'Appliance', federated: 'Federated' };
export const defaultTimeline = { granularity: 'quarter', start: '2026-10-01', periods: 9, asOf: '2026-10-01' };

export const levelNames = ['Emerging', 'Initial', 'Defined', 'Managed', 'Measured', 'Optimized', 'Scaled', 'Extended', 'Ecosystem'];
const levelNotes = ['Explore the need.', 'Describe the capability.', 'Define the model.', 'Operate a first version.', 'Measure outcomes.', 'Optimize the handoff.', 'Scale to more contexts.', 'Connect across domains.', 'Continue domain evolution.'];
const guidanceNotes = ['Ad hoc content with no shared approach.', 'Basic in-app help and FAQs.', 'Consistent topics and terminology.', 'Product-owned guidance delivered in device.', 'Contextual, task-based guidance.', 'Shared guidance across products.', 'Partners and clients integrated.', 'Guidance across workflows and channels.', 'Continuing wider-domain evolution.'];

// Version 1 default levels (no IDs); migration assigns IDs.
export const v1DefaultLevels = (id) => levelNames.map((name, index) => ({ name, description: (id === 'contextual-guidance' ? guidanceNotes : levelNotes)[index] }));
// Version 2 default levels for a new capability.
export const newCapabilityLevels = () => levelNames.map((name, index) => ({ id: name.toLowerCase(), name, description: levelNotes[index], outcomes: '', exitCriteria: '' }));

export const journeySectionDefaults = [
  { id: 'purpose', label: 'Purpose' },
  { id: 'scope', label: 'Scope and inclusions' },
  { id: 'exclusions', label: 'Exclusions' },
  { id: 'outcomes', label: 'Outcomes' },
  { id: 'evidence', label: 'Evidence and references' },
  { id: 'notes', label: 'Notes' },
  { id: 'stageCriteria', label: 'Stage outcomes and exit criteria' },
  { id: 'audienceGuidance', label: 'Why it matters at each stage' },
];
export const definitionFields = ['purpose', 'scope', 'exclusions', 'outcomes', 'evidence', 'notes'];

export const dimensions = [
  { id: 'capability', label: 'Capability' },
  { id: 'maturity', label: 'Maturity stage' },
  { id: 'audience', label: 'Audience' },
  { id: 'domain', label: 'Domain' },
  { id: 'time', label: 'Time segment' },
];

export const domainPalette = ['#e7e2f5', '#dcefe9', '#f6e7d2', '#e2ecf7', '#f4dfe2', '#e6efd8', '#efe6f2', '#dfeef0'];
