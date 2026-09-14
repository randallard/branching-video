#!/usr/bin/env python3
"""Mechanical documentation hygiene checks.

Deliberately stdlib-only and language-agnostic: this has to run in a Rust-only
project with no Node, and in a TypeScript project with no Python toolchain, so it
takes no dependencies and needs no virtualenv.

What it can check is exactly the mechanical part — is the index accurate, do the
supersession links resolve, do the relative links point at real files. It cannot
check whether a decision is still *correct*; that is what the monthly stance
review is for (docs/reviews/README.md). Don't try to grow this into that.

Exit codes: 0 clean (warnings allowed), 1 errors found.
"""

from __future__ import annotations

import os
import re
import sys
from dataclasses import dataclass, field

DOCS = "docs"
ADR_DIR = os.path.join(DOCS, "adr")
JOURNAL_DIR = os.path.join(DOCS, "journal")

# Bloat tripwire. Not a hard rule — a prompt to consider splitting. See
# docs/adr/README.md "One decision per file".
#
# The decision count is the real signal. The word count is a weak proxy, and the
# threshold is calibrated above the largest *healthy* single-decision ADRs
# observed across the fleet (~1390 words) so that a thorough Context, real
# Alternatives, and honest Consequences never get nagged — writing less would be
# the wrong response to this warning.
MAX_ADR_WORDS = 1600
MAX_ADR_DECISIONS = 3

VALID_STATUS = re.compile(
    r"^(Proposed|Accepted|Deprecated|Superseded by \[?ADR-(\d{4})\]?.*)$", re.I
)
ADR_FILE = re.compile(r"^(\d{4})-[a-z0-9-]+\.md$")
JOURNAL_FILE = re.compile(r"^(\d{4})-(\d{2})-(\d{2})-.+\.md$")
# A numbered decision: "1. **Something**" — the shape that signals a policy doc.
# Only counted inside the `## Decision` section: a Context that enumerates the
# forces at play is good ADR writing, and flagging it would push people toward
# thinner reasoning, which is the opposite of the point.
NUMBERED_DECISION = re.compile(r"^\s*\d+\.\s+\*\*", re.M)
SECTION = re.compile(r"^## +(.+?)\s*$", re.M)


def decision_section(body: str) -> str:
    """The text under `## Decision`, up to the next `## ` heading."""
    heads = [(m.start(), m.end(), m.group(1).lower()) for m in SECTION.finditer(body)]
    for i, (_, end, title) in enumerate(heads):
        if title.startswith("decision"):
            stop = heads[i + 1][0] if i + 1 < len(heads) else len(body)
            return body[end:stop]
    return ""
MD_LINK = re.compile(r"\[[^\]]*\]\(([^)\s]+)\)")
FENCED = re.compile(r"^```.*?^```", re.M | re.S)
INLINE_CODE = re.compile(r"`[^`\n]*`")


def strip_code(text: str) -> str:
    """Remove fenced blocks and inline code before link checking.

    Docs that *document* markdown — this template's own ADR README, for one —
    contain example links like `[ADR-NNNN](NNNN-new-title.md)` that intentionally
    point nowhere. Checking those produces noise that trains people to ignore
    the linter, which is worse than not having it.
    """
    return INLINE_CODE.sub("`code`", FENCED.sub("", text))


@dataclass
class Report:
    errors: list[str] = field(default_factory=list)
    warnings: list[str] = field(default_factory=list)

    def error(self, msg: str) -> None:
        self.errors.append(msg)

    def warn(self, msg: str) -> None:
        self.warnings.append(msg)


def read(path: str) -> str:
    with open(path, encoding="utf-8") as fh:
        return fh.read()


def check_adrs(rep: Report) -> None:
    if not os.path.isdir(ADR_DIR):
        rep.warn(f"{ADR_DIR}/ does not exist — no ADRs to check")
        return

    files = sorted(f for f in os.listdir(ADR_DIR) if ADR_FILE.match(f))
    if not files:
        rep.warn(f"{ADR_DIR}/ has no ADRs yet")
        return

    numbers: dict[str, str] = {}
    statuses: dict[str, str] = {}

    for name in files:
        num = ADR_FILE.match(name).group(1)  # type: ignore[union-attr]
        path = os.path.join(ADR_DIR, name)
        body = read(path)

        if num in numbers:
            rep.error(f"duplicate ADR number {num}: {name} and {numbers[num]}")
        numbers[num] = name

        m = re.search(r"^- ?Status:\s*(.+?)\s*$", body, re.M | re.I)
        if not m:
            rep.error(f"{name}: no `- Status:` line")
            continue
        status = m.group(1)
        statuses[num] = status
        if not VALID_STATUS.match(status):
            rep.error(f"{name}: invalid status {status!r}")

        # Supersession target must exist.
        sm = re.search(r"Superseded by \[?ADR-(\d{4})", status, re.I)
        if sm and sm.group(1) not in [
            ADR_FILE.match(f).group(1) for f in files  # type: ignore[union-attr]
        ]:
            rep.error(f"{name}: superseded by ADR-{sm.group(1)}, which does not exist")

        # Bloat tripwire. Skipped for superseded ADRs: they're frozen history,
        # splitting them is not an option, and nagging about a file you've
        # already dealt with is how a linter teaches people to ignore it.
        if status.lower().startswith("superseded"):
            continue
        words = len(body.split())
        decisions = len(NUMBERED_DECISION.findall(decision_section(body)))
        if decisions > MAX_ADR_DECISIONS:
            rep.warn(
                f"{name}: {decisions} numbered decisions (>{MAX_ADR_DECISIONS}) — "
                "this looks like a policy document. Consider splitting; see "
                "docs/adr/README.md 'One decision per file'."
            )
        elif words > MAX_ADR_WORDS:
            rep.warn(
                f"{name}: {words} words (>{MAX_ADR_WORDS}) — consider whether it holds "
                "more than one decision."
            )

    # Index accuracy.
    index_path = os.path.join(ADR_DIR, "README.md")
    if not os.path.isfile(index_path):
        rep.error(f"{index_path} missing — the ADR index lives there")
        return
    index = read(index_path)
    for name in files:
        if name not in index:
            rep.error(f"{name} is not listed in {index_path}")
    for linked in set(re.findall(r"\((\d{4}-[a-z0-9-]+\.md)\)", index)):
        if linked not in files:
            rep.error(f"{index_path} links {linked}, which does not exist")

    # A superseded ADR must not still read as current in the index row.
    for num, status in statuses.items():
        if status.lower().startswith("superseded"):
            row = next(
                (ln for ln in index.splitlines() if f"{num}-" in ln and "|" in ln), None
            )
            if row and "superseded" not in row.lower():
                rep.error(
                    f"ADR-{num} is superseded but its index row still reads as current"
                )


def check_journal(rep: Report) -> None:
    if not os.path.isdir(JOURNAL_DIR):
        return
    for name in sorted(os.listdir(JOURNAL_DIR)):
        if name == "README.md" or not name.endswith(".md"):
            continue
        if not JOURNAL_FILE.match(name):
            rep.error(
                f"journal/{name}: expected YYYY-MM-DD-kebab-title.md "
                "(see docs/journal/README.md)"
            )


def check_links(rep: Report) -> None:
    """Relative links in docs/ and top-level markdown must resolve.

    A link that resolves *outside* the repo root is an error even when the file
    is sitting right there on disk. Sibling checkouts are a property of one
    developer's machine, not of the repository: `../../work/…` and `../../../the-lot/…`
    resolved fine locally and broke every CI run, because a fresh clone has no
    siblings. Checking existence alone makes this class of link pass exactly
    where it is least useful. Link out of the repo with a URL instead.
    """
    roots = [DOCS] + ([".claude"] if os.path.isdir(".claude") else [])
    targets: list[str] = [f for f in os.listdir(".") if f.endswith(".md")]
    for root in roots:
        for dirpath, dirnames, filenames in os.walk(root):
            dirnames[:] = [d for d in dirnames if d not in {".git", "node_modules"}]
            targets += [
                os.path.join(dirpath, f) for f in filenames if f.endswith(".md")
            ]

    for path in targets:
        for link in MD_LINK.findall(strip_code(read(path))):
            if link.startswith(("http://", "https://", "mailto:", "#")):
                continue
            resolved = os.path.normpath(
                os.path.join(os.path.dirname(path), link.split("#")[0])
            )
            if not resolved:
                continue
            # Truncated: on a `pull_request` run this content comes from the
            # PR author, and echoing it unbounded lets a crafted link flood
            # the CI log. 120 chars is plenty to identify a real broken link.
            shown = link if len(link) <= 120 else link[:120] + "…[truncated]"
            # Checked before existence, so this fails on the developer's machine
            # too — where the target does exist — and not only in CI.
            if resolved == ".." or resolved.startswith(".." + os.sep):
                rep.error(
                    f"{path}: link escapes the repo -> {shown} "
                    "(resolves only where sibling checkouts exist; use a URL)"
                )
            elif not os.path.exists(resolved):
                rep.error(f"{path}: broken link -> {shown}")


def check_review_freshness(rep: Report) -> None:
    """Informational only — the reminder lives in stance-review.yml, which
    opens an issue. This never fails the build."""
    review_dir = os.path.join(DOCS, "reviews")
    if not os.path.isdir(review_dir):
        return
    entries = sorted(
        f for f in os.listdir(review_dir) if re.match(r"^\d{4}-\d{2}-\d{2}-", f)
    )
    if not entries:
        rep.warn("no stance review recorded yet — see docs/reviews/README.md")
        return
    import datetime

    last = datetime.date.fromisoformat(entries[-1][:10])
    days = (datetime.date.today() - last).days
    if days >= 30:
        rep.warn(f"last stance review was {days} days ago ({last}) — one is due")


def main() -> int:
    rep = Report()
    check_adrs(rep)
    check_journal(rep)
    check_links(rep)
    check_review_freshness(rep)

    for w in rep.warnings:
        print(f"warning: {w}")
    for e in rep.errors:
        print(f"error: {e}")

    if rep.errors:
        print(f"\n{len(rep.errors)} error(s), {len(rep.warnings)} warning(s)")
        return 1
    print(f"docs hygiene clean ({len(rep.warnings)} warning(s))")
    return 0


if __name__ == "__main__":
    sys.exit(main())
