/**
 * homepage content - typed, local, single source of truth.
 *
 * Sections render only when their arrays are non-empty.
 * Entries flagged `placeholder: true` are samples shown with a muted
 * "(sample)" tag and no links - replace with real entries and remove
 * the flag. Nothing fabricated should ever ship unflagged.
 */

import { CANONICAL_KNOWLEDGE } from "./canonical-knowledge";

export type SocialId = "github" | "linkedin" | "x" | "email";

export interface SocialLink {
  id: SocialId;
  label: string;
  href: string;
}

export interface CraftItem {
  name: string;
  /** one plain sentence about the thing */
  sentence: string;
  /** destination - row becomes a link only when present */
  href?: string;
  placeholder?: boolean;
}

export interface NoteItem {
  title: string;
  /** ISO date, e.g. "2026-06-02" */
  date: string;
  /** one-line summary shown under the title on the homepage */
  sentence?: string;
  href?: string;
  /** note collection id - keys the view-transition morph with the note H1 */
  id?: string;
  placeholder?: boolean;
}

export interface PersonItem {
  name: string;
  /** what changed because of them, one clause */
  sentence: string;
  /** verified LinkedIn URL only */
  href?: string;
  placeholder?: boolean;
}

export interface Quote {
  text: string;
  author: string;
  source?: string;
  /** quieter, reflective lines preferred during the deep-night hours in
   *  Pollachi. Silent: only changes which quote surfaces for a late visitor. */
  night?: boolean;
}

export const site = {
  name: CANONICAL_KNOWLEDGE.name,
  url: CANONICAL_KNOWLEDGE.origin,
  title: CANONICAL_KNOWLEDGE.name,
  description: CANONICAL_KNOWLEDGE.description,
  location: `${CANONICAL_KNOWLEDGE.location.city}, ${CANONICAL_KNOWLEDGE.location.region}`,
  locationShort: CANONICAL_KNOWLEDGE.location.short,
  timeZone: CANONICAL_KNOWLEDGE.location.timeZone,
  cal: CANONICAL_KNOWLEDGE.canonicalLinks.cal,
  repo: "ashwingopalsamy/ashwingopalsamy.in",
  repoUrl: "https://github.com/ashwingopalsamy/ashwingopalsamy.in",
} as const;

/* ------------------------------------------------------------------ */

/** resume file/link - derived from canonical knowledge. The Resume CTA renders only when this
 *  is set, per the no-broken-links rule. */
export const resumeUrl: string | undefined = CANONICAL_KNOWLEDGE.canonicalLinks.resume ? "/resume.pdf" : undefined;

/* ------------------------------------------------------------------ */

export interface WorkRole {
  role: string;
  company: string;
  years: string;
}

/** current role, always shown. Company/role/years only - no
 *  responsibilities copy, per the "just the facts" instruction. */
export const currentRole: WorkRole = {
  role: CANONICAL_KNOWLEDGE.currentEmployment.role,
  company: CANONICAL_KNOWLEDGE.currentEmployment.company,
  years: CANONICAL_KNOWLEDGE.currentEmployment.years,
};

/** previous roles, tucked behind an accordion. Domain descriptors, not
 *  job titles - reads sharper than a resume line. */
export const previousRoles: WorkRole[] = CANONICAL_KNOWLEDGE.previousEmployment.map((entry) => ({
  role: entry.role,
  company: entry.company,
  years: entry.years,
}));

/* ------------------------------------------------------------------ */

export const craft: CraftItem[] = [];

/** Slugs for the homepage "Selected craft" strip (resolved from the craft
 *  collection at build time - titles/copy stay in content files). */
export const selectedCraftSlugs = [
  "uuidcheck",
  "claude-code-theme",
  "pismozones",
] as const;

/* Live notes live in src/content/library/notes.
 * currentRole / previousRoles feed the homepage Contact section. */

/* ------------------------------------------------------------------ */

/**
 * Curated quotes. Attributions verified against primary sources where a
 * work/year is known; generic motivational lines and shaky social-media
 * attributions were deliberately excluded. A couple carry a note where the
 * wording is a known rendering rather than a literal original. Sources stay
 * in the data (kept for the copy button) but are not rendered on screen.
 */
export const quotes: Quote[] = [
  {
    text: "Quality is more important than quantity. One home run is much better than two doubles.",
    author: "Steve Jobs",
    source: "BusinessWeek, 1998",
  },
  {
    text: "The only way to do great work is to love what you do.",
    author: "Steve Jobs",
    source: "Stanford commencement, 2005",
  },
  {
    text: "Your time is limited, so don't waste it living someone else's life.",
    author: "Steve Jobs",
    source: "Stanford commencement, 2005",
  },
  {
    text: "Without deviation from the norm, progress is not possible.",
    author: "Frank Zappa",
  },
  {
    text: "You cannot hire someone else to do your push-ups for you.",
    author: "Jim Rohn",
  },
  {
    text: "A good plan violently executed now is better than a perfect plan executed next week.",
    author: "George S. Patton",
  },
  {
    text: "Day by day, nothing changes, but when you look back, everything is different.",
    author: "C. S. Lewis",
    night: true,
  },
  {
    text: "What didn't you do to bury me. But you forgot that I was a seed.",
    author: "Dinos Christianopoulos",
  },
  {
    text: "Be quick, but don't hurry.",
    author: "John Wooden",
  },
  {
    text: "Let others lead small lives, but not you. Let others leave their future in someone else's hands, but not you.",
    author: "Jim Rohn",
  },
  {
    text: "Nothing great was ever achieved without enthusiasm.",
    author: "Ralph Waldo Emerson",
  },
  {
    text: "No legacy is so rich as honesty.",
    author: "William Shakespeare",
    source: "All's Well That Ends Well",
    night: true,
  },
  {
    text: "The successful warrior is the average man, with laser-like focus.",
    author: "Bruce Lee",
  },
  {
    text: "As you start to walk on the way, the way appears.",
    author: "Rumi",
    night: true,
  },
];

/* ------------------------------------------------------------------ */

export const socials: SocialLink[] = [
  { id: "github", label: "GitHub", href: CANONICAL_KNOWLEDGE.canonicalLinks.github },
  { id: "linkedin", label: "LinkedIn", href: CANONICAL_KNOWLEDGE.canonicalLinks.linkedin },
  { id: "x", label: "X", href: CANONICAL_KNOWLEDGE.canonicalLinks.x },
  { id: "email", label: "Email", href: CANONICAL_KNOWLEDGE.canonicalLinks.email },
];
