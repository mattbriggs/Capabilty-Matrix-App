"""Draft content manifests and report summaries from a validated document.

These record proposed DITA mappings only; they do not publish to the CCMS.
"""

from typing import Any


def content_manifest(doc: dict[str, Any]) -> list[dict[str, Any]]:
    return [
        {
            "capabilityId": cap["id"],
            "capabilityName": cap["name"],
            "audiences": cap["dita"]["audience"],
            "maturity": cap["dita"]["maturity"],
            "ownership": cap["dita"]["ownership"],
            "deliveryTargets": ["embedded-help", "pdf-manual"],
            "status": "draft-mapping",
        }
        for cap in doc["capabilities"]
    ]


def report_summary(doc: dict[str, Any]) -> dict[str, Any]:
    capabilities = doc["capabilities"]
    return {
        "projectId": doc["project"]["id"],
        "capabilityCount": len(capabilities),
        "domainCount": len(doc["domains"]),
        "handoffs": [cap["id"] for cap in capabilities if cap["owner"] != cap["futureOwner"]],
        "unassignedDomain": [cap["id"] for cap in capabilities if cap["domainId"] is None],
    }
