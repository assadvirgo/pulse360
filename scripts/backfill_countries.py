#!/usr/bin/env python3
"""
One-time backfill script: tag every existing article with country / countryCode.

Usage:
    OPENAI_API_KEY=sk-... python scripts/backfill_countries.py [--dry-run] [--limit N]

The script:
  1. Scans all .md files under src/content/news/
  2. Skips articles that already have a non-empty countryCode
  3. Sends title + description to GPT-4o-mini asking ONLY for the country code
  4. Patches the YAML frontmatter in-place
  5. Is fully resumable — just re-run to continue where it left off
"""
from __future__ import annotations

import argparse
import logging
import os
import sys
import time
from pathlib import Path

import frontmatter
from openai import OpenAI
from tenacity import retry, stop_after_attempt, wait_exponential

sys.path.insert(0, str(Path(__file__).parent))
from countries import COUNTRIES

# ---------------------------------------------------------------------------
# Config
# ---------------------------------------------------------------------------

ROOT = Path(__file__).parent.parent
CONTENT_DIR = ROOT / "src" / "content" / "news"
LLM_MODEL = "gpt-4o-mini"

OPENAI_API_KEY = os.environ.get("OPENAI_API_KEY", "")
client: OpenAI | None = None

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(message)s",
    datefmt="%H:%M:%S",
)
log = logging.getLogger("backfill")

# ---------------------------------------------------------------------------
# Country detection prompt (lightweight — title + description only)
# ---------------------------------------------------------------------------

SYSTEM_PROMPT = (
    "You are a country classifier for news articles. "
    "Given a headline and short description, respond with ONLY the ISO 3166-1 "
    "alpha-2 country code of the country the article is primarily about.\n\n"
    "Rules:\n"
    "- Output exactly one 2-letter uppercase code, nothing else.\n"
    "- If the story is about a specific country, use that code (e.g. US, GB, FR, CN).\n"
    "- If the story involves two countries (e.g. a bilateral summit), pick the one "
    "that is the main subject.\n"
    "- If the story is truly global or about an international organization with no "
    "single primary country, output ZZ.\n"
    "- Never output explanations, just the code."
)


@retry(stop=stop_after_attempt(3), wait=wait_exponential(multiplier=1, min=2, max=15))
def detect_country(title: str, description: str) -> str:
    """Ask GPT-4o-mini for the country code. Returns 2-letter code or ''."""
    response = client.chat.completions.create(  # type: ignore[union-attr]
        model=LLM_MODEL,
        messages=[
            {"role": "system", "content": SYSTEM_PROMPT},
            {"role": "user", "content": f"Headline: {title}\nDescription: {description}"},
        ],
        temperature=0.0,
        max_tokens=5,
    )
    raw = (response.choices[0].message.content or "").strip().upper()
    # Validate: must be exactly 2 uppercase letters
    if len(raw) == 2 and raw.isalpha():
        return raw
    return ""


def collect_articles() -> list[Path]:
    """Return all .md files that are missing a countryCode."""
    articles = []
    for md in sorted(CONTENT_DIR.rglob("*.md")):
        post = frontmatter.load(str(md))
        code = post.metadata.get("countryCode", "")
        if not code:
            articles.append(md)
    return articles


def patch_article(path: Path, country_code: str) -> None:
    """Add country and countryCode to the article's YAML frontmatter."""
    post = frontmatter.load(str(path))
    country_name = COUNTRIES.get(country_code, {}).get("name", "")
    post.metadata["country"] = country_name
    post.metadata["countryCode"] = country_code
    path.write_text(frontmatter.dumps(post), encoding="utf-8")


def main():
    parser = argparse.ArgumentParser(description="Backfill country codes on existing articles")
    parser.add_argument("--dry-run", action="store_true", help="Detect countries but don't write files")
    parser.add_argument("--limit", type=int, default=0, help="Process at most N articles (0 = all)")
    args = parser.parse_args()

    global client
    if not OPENAI_API_KEY:
        sys.exit("Error: OPENAI_API_KEY environment variable is not set.")
    client = OpenAI(api_key=OPENAI_API_KEY)

    log.info("Scanning %s for articles missing countryCode...", CONTENT_DIR)
    pending = collect_articles()
    log.info("Found %d articles to backfill", len(pending))

    if args.limit > 0:
        pending = pending[:args.limit]
        log.info("Limiting to %d articles", len(pending))

    if not pending:
        log.info("Nothing to do — all articles already have country codes.")
        return

    updated = 0
    skipped = 0
    errors = 0

    for i, path in enumerate(pending, 1):
        post = frontmatter.load(str(path))
        title = post.metadata.get("title", "")
        description = post.metadata.get("description", "")

        try:
            code = detect_country(title, description)
        except Exception as exc:
            log.warning("[%d/%d] Error on %s: %s — skipping", i, len(pending), path.name, exc)
            errors += 1
            continue

        if not code or code == "ZZ":
            log.info("[%d/%d] %s → global/unknown — skipping", i, len(pending), path.name[:60])
            skipped += 1
            continue

        country_name = COUNTRIES.get(code, {}).get("name", code)

        if args.dry_run:
            log.info("[%d/%d] %s → %s (%s) [dry-run]", i, len(pending), path.name[:60], code, country_name)
        else:
            patch_article(path, code)
            log.info("[%d/%d] %s → %s (%s)", i, len(pending), path.name[:60], code, country_name)

        updated += 1

        # Small delay to respect rate limits (gpt-4o-mini is generous, but be polite)
        if i % 50 == 0:
            log.info("Progress: %d/%d processed, pausing briefly...", i, len(pending))
            time.sleep(1)

    log.info(
        "Done! Updated: %d, Skipped (global): %d, Errors: %d, Total: %d",
        updated, skipped, errors, len(pending),
    )


if __name__ == "__main__":
    main()
