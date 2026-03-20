Project: The Global Pulse (Zen News Aggregator)

Vision: A high-end, minimalist, AI-driven news platform covering 195+ countries, built on a zero-infrastructure GitHub-Native stack.

1. Core Mission & Design Philosophy

"Zen" Reading: No ads, no popups, no clutter. The focus is purely on high-quality typography and clear information.

Global Intelligence: 24/7 AI-driven research covering every country across Politics, Economy, Sports, and Showbiz.

Extreme Performance: 100% static HTML served via Global CDN (GitHub Pages), utilizing incremental builds to maintain speed even with 10,000+ articles.

2. Technical Stack

Layer

Technology

Implementation Detail

Data Layer

GitHub Repository

Markdown files with YAML frontmatter act as the primary database.

Compute

GitHub Actions

Scheduled Python scripts (Cron) for news discovery and LLM synthesis.

Site Generator

Astro 5.0+

Utilizing the Content Layer API for high-performance incremental builds.

Styling

Tailwind CSS

Using @tailwindcss/typography for premium prose formatting.

Hosting

GitHub Pages

Free, globally distributed static hosting.

3. Information Architecture (The "Database")

News articles are stored hierarchically in the repository to ensure scalability.

Directory Structure:

/src/content/news/{country_code}/{category}/{YYYY-MM-DD-slug}.md

Markdown Schema (Frontmatter):

title: "The Headline" pubDate: 2026-03-20T14:30:00Z description: "A 150-character summary for index cards." country: "Pakistan" category: "Economy" sourceUrl: "https://www.google.com/search?q=https://original-news-link.com" heroImage: "https://www.google.com/search?q=https://image-url.com/hero.jpg" sentiment: "Positive"

Full AI-generated content in Markdown format...

4. The AI Researcher Agent (scripts/researcher.py)

A Python script executed via GitHub Actions on a 4-hour schedule.

Step-by-Step Logic:

Discovery: Use NewsAPI or GNews RSS feeds to fetch headlines for all 195+ countries.

Deduplication: Check the local file system; if the headline/slug already exists, skip it.

Synthesis: - Send raw article snippets to an LLM (e.g., GPT-4o-mini).

Instruction: "Summarize this news in a sophisticated, neutral, and calm tone. Use Markdown headers for structure."

Commit: Save the generated .md files and perform a single batch commit to the repository.

5. UI/UX & Aesthetic Requirements

Typography:

UI: Inter (Sans-serif) for buttons and navigation.

Reading: Newsreader or Charter (Serif) for the article body.

Layout:

Center-aligned content with a max-width of 65ch (optimal for reading).

Large whitespace margins.

Visuals:

Subtle "Glassmorphism" (background blur) on headers.

An interactive SVG globe or map on the homepage for regional filtering.

Theme: Default "Cream/Ivory" light mode; "Midnight Blue" dark mode.

6. Optimization Strategy (The "Speed" Plan)

To prevent the project from slowing down as the content grows:

Astro Content Layer: Use the glob loader in src/content/config.ts. This caches metadata in an internal SQLite database.

GitHub Actions Caching:

Cache node_modules.

Cache the .astro directory (the content cache).

Cache the dist directory.

Batching: The Python agent must never commit more than once per run to avoid triggering redundant build cycles.

7. Project Naming Suggestions

https://www.google.com/search?q=AuraNews.com (Atmospheric, calm)

Mundi.news (Global, prestigious)

Stille.io (Zen, quiet)

AtlasPulse.io (Dynamic, geographical)

8. Implementation Roadmap

Phase 1: Setup Astro + Tailwind + Typography.

Phase 2: Develop the Python researcher.py and test with a few countries.

Phase 3: Create the GitHub Action workflows for automation.

Phase 4: Polish the UI, add the interactive map, and deploy.