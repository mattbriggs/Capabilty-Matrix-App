"""Semantic layer: cross-record rules JSON Schema cannot express.

Runs on the structurally valid, defaults-filled document (``model_dump(by_alias=True)``).
Every rule here has a twin in ``src/domain/semantic.js``; the shared fixtures in
``tests/fixtures/validation`` hold both implementations to the same results.
"""

from typing import Any

from ..contracts.issues import Issue
from ..timeline import period_starts, real_date
from .issues import Part, make_issue

Doc = dict[str, Any]


class _Collector:
    def __init__(self, doc: Doc):
        self.doc = doc
        self.issues: list[Issue] = []

    def add(self, severity: str, code: str, parts: list[Part], message: str) -> None:
        self.issues.append(make_issue(self.doc, severity, code, parts, message))


def _duplicates(out: _Collector, items: list[dict], key: str, base: list[Part], noun: str) -> set[str]:
    seen: set[str] = set()
    for index, item in enumerate(items):
        value = item[key]
        if value in seen:
            out.add("error", "id.duplicate", [*base, index, key], f"Another {noun} already uses `{value}`. Give this {noun} a unique {key}.")
        seen.add(value)
    return seen


def _cycles(out: _Collector, capabilities: list[dict]) -> None:
    ids = {cap["id"] for cap in capabilities}
    first_index: dict[str, int] = {}
    graph: dict[str, list[str]] = {}
    for index, cap in enumerate(capabilities):
        if cap["id"] in graph:
            continue
        first_index[cap["id"]] = index
        deps: list[str] = []
        for dep in cap["dependencies"]:
            if dep in ids and dep != cap["id"] and dep not in deps:
                deps.append(dep)
        graph[cap["id"]] = deps
    state: dict[str, int] = {}
    stack: list[str] = []
    reported: set[str] = set()

    def visit(node: str) -> None:
        state[node] = 1
        stack.append(node)
        for dep in graph[node]:
            if state.get(dep) == 1:
                cycle = stack[stack.index(dep):]
                start = cycle.index(min(cycle))
                cycle = cycle[start:] + cycle[:start]
                key = ">".join(cycle)
                if key not in reported:
                    reported.add(key)
                    route = " → ".join([*cycle, cycle[0]])
                    out.add("warning", "dependency.cycle", ["capabilities", first_index[cycle[0]], "dependencies"],
                            f"Dependency cycle: {route}. Mutual dependencies are allowed in planning, but confirm they are intended.")
            elif dep not in state:
                visit(dep)
        stack.pop()
        state[node] = 2

    for cap in capabilities:
        if cap["id"] not in state:
            visit(cap["id"])


def semantic(doc: Doc) -> list[Issue]:
    out = _Collector(doc)
    timeline = doc["settings"]["timeline"]
    periods: list[str] | None = None

    for key in ("start", "asOf"):
        if real_date(timeline[key]) is None:
            out.add("error", "date.invalid", ["settings", "timeline", key], f"{timeline[key]} is not a real calendar date. Enter a valid YYYY-MM-DD date.")
    if real_date(timeline["start"]) is not None:
        periods = period_starts(timeline["granularity"], timeline["start"], timeline["periods"])
    first, horizon = (periods[0], periods[-1]) if periods else (None, None)
    if periods and real_date(timeline["asOf"]) is not None and not first <= timeline["asOf"] <= horizon:
        out.add("error", "timeline.asOf.range", ["settings", "timeline", "asOf"],
                f"Current maturity is anchored at {timeline['asOf']}, outside the timeline ({first} to {horizon}). Choose a date inside the timeline or extend it.")

    audience_ids = _duplicates(out, doc["settings"]["audiences"], "id", ["settings", "audiences"], "audience")
    domain_ids = _duplicates(out, doc["domains"], "id", ["domains"], "domain")
    capabilities = doc["capabilities"]
    capability_ids = _duplicates(out, capabilities, "id", ["capabilities"], "capability")
    all_level_ids: set[str] = set()

    for index, cap in enumerate(capabilities):
        base: list[Part] = ["capabilities", index]
        level_ids = _duplicates(out, cap["levels"], "id", [*base, "levels"], "maturity level")
        all_level_ids |= level_ids
        top = len(cap["levels"]) - 1
        for field in ("current", "target"):
            if cap[field] > top:
                out.add("error", "maturity.range", [*base, field], f"{field.capitalize()} maturity M{cap[field]} is above the highest defined level (M{top}). Choose M0–M{top} or add levels.")
        if cap["target"] < cap["current"]:
            out.add("error", "maturity.order", [*base, "target"], f"Target maturity M{cap['target']} is below current maturity M{cap['current']}. Raise the target or lower the current maturity.")

        handoff = cap["handoffDate"]
        if handoff is not None:
            if real_date(handoff) is None:
                out.add("error", "date.invalid", [*base, "handoffDate"], f"{handoff} is not a real calendar date. Enter a valid YYYY-MM-DD date.")
            elif periods and not first <= handoff <= horizon:
                out.add("warning", "handoff.range", [*base, "handoffDate"], f"The handoff date {handoff} is outside the timeline ({first} to {horizon}), so the handoff is never shown. Move it inside the timeline.")

        seen_dates: set[str] = set()
        for k, milestone in enumerate(cap["milestones"]):
            mp: list[Part] = [*base, "milestones", k]
            if milestone["maturity"] > top:
                out.add("error", "maturity.range", [*mp, "maturity"], f"Milestone maturity M{milestone['maturity']} is above the highest defined level (M{top}).")
            date = milestone["date"]
            if real_date(date) is None:
                out.add("error", "date.invalid", [*mp, "date"], f"{date} is not a real calendar date. Enter a valid YYYY-MM-DD date.")
                continue
            if date in seen_dates:
                out.add("error", "milestone.duplicate", [*mp, "date"], f"Another milestone already uses {date}. Keep one milestone per date.")
            seen_dates.add(date)
            if periods:
                if date in (timeline["asOf"], horizon):
                    out.add("error", "milestone.anchorCollision", [*mp, "date"], f"{date} is an anchor date (current maturity at {timeline['asOf']}, target at {horizon}). Edit current or target maturity instead, or move the milestone.")
                elif not first <= date <= horizon:
                    out.add("error", "milestone.range", [*mp, "date"], f"Milestone {date} is outside the timeline ({first} to {horizon}). Move it inside the timeline or extend the timeline.")

        seen_deps: set[str] = set()
        for k, dep in enumerate(cap["dependencies"]):
            dp: list[Part] = [*base, "dependencies", k]
            if dep == cap["id"]:
                out.add("error", "dependency.self", dp, f"{cap['name']} cannot depend on itself. Remove this dependency.")
            elif dep not in capability_ids:
                out.add("error", "ref.capability.missing", dp, f"Dependency `{dep}` does not match any capability. Remove it or create the capability.")
            if dep in seen_deps:
                out.add("warning", "dependency.duplicate", dp, f"`{dep}` is listed more than once. Remove the repeat.")
            seen_deps.add(dep)

        if cap["domainId"] is not None and cap["domainId"] not in domain_ids:
            out.add("error", "ref.domain.missing", [*base, "domainId"], f"Domain `{cap['domainId']}` does not exist. Choose an existing domain or leave the capability unassigned.")

        seen_members: set[str] = set()
        for k, audience_id in enumerate(cap["audienceIds"]):
            if audience_id not in audience_ids:
                out.add("error", "ref.audience.missing", [*base, "audienceIds", k], f"Audience `{audience_id}` does not exist. Remove the membership or add the audience in Settings.")
            if audience_id in seen_members:
                out.add("warning", "membership.duplicate", [*base, "audienceIds", k], f"Audience `{audience_id}` is listed more than once. Remove the repeat.")
            seen_members.add(audience_id)

        _guidance(out, cap["journey"]["guidance"], [*base, "journey", "guidance"], audience_ids, level_ids, missing_level="error")

    _cycles(out, capabilities)

    seen_segments: set[str] = set()
    for index, segment in enumerate(doc["timeSegments"]):
        if real_date(segment["date"]) is None:
            out.add("error", "date.invalid", ["timeSegments", index, "date"], f"{segment['date']} is not a real calendar date.")
        elif segment["date"] in seen_segments:
            out.add("error", "id.duplicate", ["timeSegments", index, "date"], f"Time segment {segment['date']} already has an override. Merge the two overrides.")
        seen_segments.add(segment["date"])

    presentation = doc["presentation"]
    _duplicates(out, presentation["journeySections"], "id", ["presentation", "journeySections"], "journey section")
    _guidance(out, presentation["defaultGuidance"], ["presentation", "defaultGuidance"], audience_ids, all_level_ids, missing_level="warning")
    table = presentation["dataTable"]
    if table["xAxis"] == table["yAxis"]:
        out.add("error", "table.axes.same", ["presentation", "dataTable", "yAxis"], "The data table X and Y axes use the same dimension. Choose two different dimensions.")
    for k, cap_id in enumerate(table["filters"]["capabilityIds"]):
        if cap_id not in capability_ids:
            out.add("warning", "ref.filter.missing", ["presentation", "dataTable", "filters", "capabilityIds", k], f"The table filter refers to missing capability `{cap_id}`; it is ignored.")

    _duplicates(out, doc["mapViews"], "id", ["mapViews"], "map view")
    for index, view in enumerate(doc["mapViews"]):
        base = ["mapViews", index]
        for field in ("currentDate", "focusDate"):
            if view[field] is not None and real_date(view[field]) is None:
                out.add("error", "date.invalid", [*base, field], f"{view[field]} is not a real calendar date.")
        if view["selectedCapabilityId"] is not None and view["selectedCapabilityId"] not in capability_ids:
            out.add("warning", "ref.mapView.missing", [*base, "selectedCapabilityId"], f"The view selects missing capability `{view['selectedCapabilityId']}`; it will be cleared when the view opens.")
        if view["audienceId"] is not None and view["audienceId"] not in audience_ids:
            out.add("warning", "ref.mapView.missing", [*base, "audienceId"], f"The view uses missing audience `{view['audienceId']}`; the first audience is used instead.")
        for k, domain_id in enumerate(view["filters"]["domainIds"]):
            if domain_id not in domain_ids:
                out.add("warning", "ref.mapView.missing", [*base, "filters", "domainIds", k], f"The view filters on missing domain `{domain_id}`; the filter is ignored.")
        seen_placements: set[tuple[str, str]] = set()
        for k, placement in enumerate(view["placements"]):
            key = (placement["nodeId"], placement["context"])
            if key in seen_placements:
                out.add("error", "placement.duplicate", [*base, "placements", k], f"{placement['nodeId']} has two saved positions for {placement['context']}. Keep one.")
            seen_placements.add(key)
            node = placement["nodeId"]
            if node.startswith("cap:") and node[4:] not in capability_ids:
                out.add("warning", "ref.mapView.missing", [*base, "placements", k, "nodeId"], f"The saved position for missing capability `{node[4:]}` will be pruned when the view opens.")

    return out.issues


def _guidance(out: _Collector, entries: list[dict], base: list[Part], audience_ids: set[str], level_ids: set[str], missing_level: str) -> None:
    seen: set[tuple[str, str]] = set()
    for k, entry in enumerate(entries):
        if entry["audienceId"] not in audience_ids:
            out.add("error", "ref.audience.missing", [*base, k, "audienceId"], f"Guidance refers to missing audience `{entry['audienceId']}`. Choose an existing audience or delete the guidance.")
        if entry["levelId"] not in level_ids:
            if missing_level == "error":
                out.add("error", "ref.level.missing", [*base, k, "levelId"], f"Guidance refers to missing maturity level `{entry['levelId']}`. Choose an existing level or delete the guidance.")
            else:
                out.add("warning", "guidance.level.unused", [*base, k, "levelId"], f"Default guidance for level `{entry['levelId']}` matches no capability level, so it is never shown.")
        pair = (entry["audienceId"], entry["levelId"])
        if pair in seen:
            out.add("error", "guidance.duplicate", [*base, k], "Guidance for this audience and level is recorded twice. Merge the entries.")
        seen.add(pair)
