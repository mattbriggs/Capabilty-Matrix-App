import { capabilityIndex } from '../../../domain/operations';
import { pathParts } from '../../../domain/issues';
import { CapabilityTray } from './CapabilityTray';
import {
  AudienceTray, DependenciesTray, DitaPanel, DomainTray, LevelTray, LevelsTray, ProjectTray, SettingsTray,
  TimeSegmentTray, TimelineTray,
} from './EntityTrays';

const trays = {
  capability: CapabilityTray, levels: LevelsTray, level: LevelTray, dependencies: DependenciesTray,
  audience: AudienceTray, domain: DomainTray, timeSegment: TimeSegmentTray, timeline: TimelineTray,
  settings: SettingsTray, project: ProjectTray, mapping: DitaPanel,
};

// Entity registry: one tray per object type, keyed so a new selection always starts a fresh draft.
export function TrayHost({ tray, ...props }) {
  if (!tray) return null;
  const Tray = trays[tray.type];
  if (!Tray) return null;
  const exists = {
    capability: () => !tray.id || props.doc.capabilities.some((c) => c.id === tray.id),
    levels: () => props.doc.capabilities.some((c) => c.id === tray.id),
    dependencies: () => props.doc.capabilities.some((c) => c.id === tray.id),
    mapping: () => props.doc.capabilities.some((c) => c.id === tray.id),
    level: () => props.doc.capabilities.find((c) => c.id === tray.capabilityId)?.levels.some((l) => l.id === tray.id),
    audience: () => !tray.id || props.doc.settings.audiences.some((a) => a.id === tray.id),
    domain: () => !tray.id || props.doc.domains.some((d) => d.id === tray.id),
  }[tray.type];
  if (exists && !exists()) return null;
  return <Tray key={`${tray.type}:${tray.capabilityId || ''}:${tray.id || 'new'}:${tray.nonce || ''}`} ctx={tray} focusPath={tray.focusPath} {...props} />;
}

// Map a validation issue to the tray and field that fix it.
export function trayForIssue(doc, issue) {
  const parts = pathParts(issue.path);
  const focusPath = issue.path;
  const capAt = (index) => doc.capabilities?.[index]?.id;
  switch (issue.entityType) {
    case 'capability': {
      const id = issue.entityId || capAt(parts[1]);
      if (parts[2] === 'dependencies' && issue.code === 'dependency.cycle') return { type: 'dependencies', id };
      return id ? { type: 'capability', id, focusPath } : { type: 'source' };
    }
    case 'level': {
      const capId = capAt(parts[1]);
      const levelId = doc.capabilities?.[parts[1]]?.levels?.[parts[3]]?.id;
      return issue.code === 'id.duplicate' ? { type: 'levels', id: capId } : { type: 'level', capabilityId: capId, id: levelId, focusPath };
    }
    case 'audience': return { type: 'audience', id: issue.entityId, focusPath };
    case 'domain': return { type: 'domain', id: issue.entityId, focusPath };
    case 'timeSegment': return { type: 'timeSegment', id: issue.entityId, focusPath };
    case 'timeline': return { type: 'timeline', focusPath };
    case 'settings': return { type: 'settings', focusPath };
    case 'project': return { type: 'project', focusPath };
    case 'presentation': return parts[1] === 'dataTable' ? { type: 'table' } : parts[1] === 'defaultGuidance' ? { type: 'audience', id: doc.presentation?.defaultGuidance?.[parts[2]]?.audienceId } : { type: 'settings', focusPath };
    case 'mapView': return { type: 'mapView', id: issue.entityId };
    default: return { type: 'source' };
  }
}

export { capabilityIndex };
