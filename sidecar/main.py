#!/usr/bin/env python3
"""Small, newline-delimited JSON processor for the Tauri desktop shell.

The React app parses YAML into a canonical JSON model. This sidecar validates
cross-record relationships and prepares content/report manifests. It does not
publish to the CCMS or generate a production DITAVAL.
"""

import json
import sys


def validate_levels(ident, cap, current, target):
    levels = cap.get("levels")
    if levels is None:
        return []
    if not isinstance(levels, list) or len(levels) < 2:
        return [f"{ident} needs at least two maturity levels."]
    if any(not isinstance(level, dict) or not str(level.get("name", "")).strip() for level in levels):
        return [f"{ident} has a maturity level without a name."]
    top = len(levels) - 1
    values = [current, target] + [m.get("maturity") for m in cap.get("milestones", []) if isinstance(m, dict)]
    if any(isinstance(v, (int, float)) and v > top for v in values):
        return [f"{ident} has maturity above its highest level (M{top})."]
    return []


def validate(capabilities):
    errors = []
    if not isinstance(capabilities, list) or not capabilities:
        return ["Expected a nonempty capabilities list."]
    by_id = {}
    for index, cap in enumerate(capabilities, 1):
        if not isinstance(cap, dict):
            errors.append(f"Capability {index} must be an object.")
            continue
        ident = cap.get("id")
        if not isinstance(ident, str) or not ident.strip():
            errors.append(f"Capability {index} needs an id.")
            continue
        if ident in by_id:
            errors.append(f"Duplicate capability id: {ident}.")
        by_id[ident] = cap
        if not isinstance(cap.get("name"), str) or not cap["name"].strip():
            errors.append(f"{ident} needs a name.")
        current, target = cap.get("current"), cap.get("target")
        if not isinstance(current, (int, float)) or not isinstance(target, (int, float)):
            errors.append(f"{ident} needs numeric current and target maturity.")
        elif current < 0 or target < current:
            errors.append(f"{ident} has an invalid maturity range.")
        errors.extend(validate_levels(ident, cap, current, target))
        for field in ("owner", "futureOwner"):
            if cap.get(field) not in ("appliance", "federated"):
                errors.append(f"{ident} has an invalid {field}.")
    for ident, cap in by_id.items():
        deps = cap.get("dependencies", [])
        if not isinstance(deps, list):
            errors.append(f"{ident} dependencies must be a list.")
            continue
        for dep in deps:
            if dep not in by_id:
                errors.append(f"{ident} refers to missing dependency {dep}.")
            if dep == ident:
                errors.append(f"{ident} cannot depend on itself.")
    return errors


def content_manifest(capabilities):
    return [
        {
            "capabilityId": cap["id"],
            "capabilityName": cap["name"],
            "audiences": cap.get("dita", {}).get("audience", []),
            "maturity": cap.get("dita", {}).get("maturity"),
            "ownership": cap.get("dita", {}).get("ownership"),
            "deliveryTargets": ["embedded-help", "pdf-manual"],
            "status": "draft-mapping",
        }
        for cap in capabilities
    ]


def report_summary(capabilities):
    return {
        "capabilityCount": len(capabilities),
        "handoffs": [cap["id"] for cap in capabilities if cap.get("owner") != cap.get("futureOwner")],
        "unassignedDependencies": [
            {"capability": cap["id"], "dependency": dep}
            for cap in capabilities
            for dep in cap.get("dependencies", [])
            if dep not in {item["id"] for item in capabilities}
        ],
    }


def process(request):
    operation = request.get("operation")
    capabilities = request.get("capabilities")
    errors = validate(capabilities)
    if operation == "validate":
        return {"ok": not errors, "errors": errors}
    if errors:
        return {"ok": False, "errors": errors}
    if operation == "content-manifest":
        return {"ok": True, "manifest": content_manifest(capabilities)}
    if operation == "report-summary":
        return {"ok": True, "summary": report_summary(capabilities)}
    return {"ok": False, "errors": ["Unknown operation."]}


def main():
    line = sys.stdin.readline()
    if not line:
        return
    try:
        result = process(json.loads(line))
    except (ValueError, TypeError, KeyError) as exc:
        result = {"ok": False, "errors": [str(exc)]}
    print(json.dumps(result, separators=(",", ":")), flush=True)


if __name__ == "__main__":
    main()
