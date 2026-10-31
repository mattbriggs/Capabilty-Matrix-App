"""Explicit version 1 → version 2 migration. Mirrors ``src/domain/migrate.js``.

Fills only what version 1 itself defaulted (missing settings, owners and levels),
assigns IDs and copies DITA audiences into business membership. Invalid source
values are carried over unchanged so validation reports them; nothing is repaired.
"""

import copy
import re
from typing import Any

DEFAULT_OWNER_LABELS = {"appliance": "Appliance", "federated": "Federated"}
DEFAULT_TIMELINE = {"granularity": "quarter", "start": "2026-10-01", "periods": 9, "asOf": "2026-10-01"}
DEFAULT_AUDIENCES = [
    {"id": "client", "label": "Client", "description": "Uses and funds the capability", "need": "Clear outcomes, usable guidance and a dependable operating experience."},
    {"id": "consultant", "label": "Consultant", "description": "Advises, designs and enables", "need": "Practical guidance for tailoring the product to a client context."},
    {"id": "product-team", "label": "Product team", "description": "Builds and operates the product", "need": "A clear product boundary, data contract and implementation ownership."},
    {"id": "leadership", "label": "Leadership", "description": "Sets direction and allocates resources", "need": "A defensible scope decision with visible dependencies and risk."},
    {"id": "wider-domain", "label": "Wider domain", "description": "Extends value across the ecosystem", "need": "How local capabilities contribute to the evolving domain solution."},
]
LEVEL_NAMES = ["Emerging", "Initial", "Defined", "Managed", "Measured", "Optimized", "Scaled", "Extended", "Ecosystem"]
LEVEL_NOTES = ["Explore the need.", "Describe the capability.", "Define the model.", "Operate a first version.", "Measure outcomes.", "Optimize the handoff.", "Scale to more contexts.", "Connect across domains.", "Continue domain evolution."]
GUIDANCE_NOTES = ["Ad hoc content with no shared approach.", "Basic in-app help and FAQs.", "Consistent topics and terminology.", "Product-owned guidance delivered in device.", "Contextual, task-based guidance.", "Shared guidance across products.", "Partners and clients integrated.", "Guidance across workflows and channels.", "Continuing wider-domain evolution."]


class MigrationError(ValueError):
    pass


def slug(value: Any) -> str:
    text = value.lower() if isinstance(value, str) else ""
    return re.sub(r"^-+|-+$", "", re.sub(r"[^a-z0-9]+", "-", text))[:80].rstrip("-")


def default_levels(capability_id: Any) -> list[dict[str, str]]:
    notes = GUIDANCE_NOTES if capability_id == "contextual-guidance" else LEVEL_NOTES
    return [{"name": name, "description": notes[index]} for index, name in enumerate(LEVEL_NAMES)]


def is_version_1(raw: Any) -> bool:
    if isinstance(raw, list):
        return True
    if not isinstance(raw, dict):
        return False
    version = raw.get("version")
    return (type(version) is int and version == 1) or ("version" not in raw and isinstance(raw.get("capabilities"), list))


def _level_ids(levels: list[Any]) -> int:
    taken: set[str] = set()
    assigned = 0
    for index, level in enumerate(levels):
        if not isinstance(level, dict):
            continue
        if isinstance(level.get("id"), str) and level["id"]:
            taken.add(level["id"])
            continue
        base = slug(level.get("name")) or f"level-{index}"
        candidate, suffix = base, 2
        while candidate in taken:
            candidate, suffix = f"{base}-{suffix}", suffix + 1
        taken.add(candidate)
        level["id"] = candidate
        assigned += 1
    return assigned


def migrate_v1(raw: Any, project_id: str, now: str, name: str | None = None) -> tuple[dict[str, Any], list[str]]:
    if not is_version_1(raw):
        raise MigrationError("Only version 1 documents can be migrated.")
    source = {"capabilities": raw} if isinstance(raw, list) else copy.deepcopy(raw)

    settings = source.get("settings") if isinstance(source.get("settings"), dict) else {}
    settings = dict(settings)
    labels = settings.get("ownerLabels")
    settings["ownerLabels"] = {**DEFAULT_OWNER_LABELS, **labels} if isinstance(labels, dict) else dict(DEFAULT_OWNER_LABELS)
    if not isinstance(settings.get("audiences"), list) or not settings["audiences"]:
        settings["audiences"] = copy.deepcopy(DEFAULT_AUDIENCES)
    timeline = settings.get("timeline")
    settings["timeline"] = {**DEFAULT_TIMELINE, **timeline} if isinstance(timeline, dict) else dict(DEFAULT_TIMELINE)

    level_count = default_count = membership_count = 0
    capabilities = source.get("capabilities", [])
    if isinstance(capabilities, list):
        for cap in capabilities:
            if not isinstance(cap, dict):
                continue
            cap.setdefault("owner", "appliance")
            cap.setdefault("futureOwner", "appliance")
            if not isinstance(cap.get("levels"), list) or not cap["levels"]:
                cap["levels"] = default_levels(cap.get("id"))
                default_count += 1
            level_count += _level_ids(cap["levels"])
            if "audienceIds" not in cap:
                dita = cap.get("dita")
                audience = dita.get("audience") if isinstance(dita, dict) else None
                cap["audienceIds"] = list(audience) if isinstance(audience, list) else []
                membership_count += 1 if cap["audienceIds"] else 0

    rest = {key: value for key, value in source.items() if key not in ("version", "settings", "capabilities")}
    document = {
        "version": 2,
        "project": {"id": project_id, "name": name or "Migrated project", "description": "", "createdAt": now, "updatedAt": now},
        "settings": settings,
        "capabilities": capabilities,
        "domains": [],
        "timeSegments": [],
        "mapViews": [],
        **rest,
    }
    notes = [
        f"Assigned project ID {project_id}.",
        f"Assigned IDs to {level_count} maturity levels.",
        f"Added the default maturity levels to {default_count} capabilities.",
        f"Copied DITA audiences into business audience membership for {membership_count} capabilities.",
        "Domains, time-segment overrides and map views start empty.",
    ]
    return document, notes
