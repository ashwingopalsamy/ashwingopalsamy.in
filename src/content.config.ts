import { defineCollection, z } from "astro:content";
import { file, glob } from "astro/loaders";

const rating = z.enum(["up", "mixed", "down"]);
const slug = z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/);
/** Wall-clock time where it happened, with that place's UTC offset. */
const localDateTime = z.string().regex(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(?::\d{2})?[+-]\d{2}:\d{2}$/);
/** Year and month only; a visit or a meeting needs no more precision. */
const yearMonth = z.string().regex(/^\d{4}-(?:0[1-9]|1[0-2])$/);
/** Coordinates are rounded to two decimals (about a kilometre) before they
 *  are written down, so nothing here can pin a doorstep. */
const latitude = z.number().min(-90).max(90);
const longitude = z.number().min(-180).max(180);

const books = defineCollection({
  loader: glob({ pattern: "**/*.md", base: "./src/content/library/books" }),
  schema: z.object({
    title: z.string(),
    date: z.coerce.date(),
    author: z.string(),
    status: z.enum(["reading", "finished", "dropped"]),
    rating: rating.optional(),
    tags: z.array(z.string()).optional(),
    take: z.string().optional(),
    cover: z.string().optional(),
    placeholder: z.boolean().optional(),
  }),
});

const watch = defineCollection({
  loader: glob({ pattern: "**/*.md", base: "./src/content/library/watch" }),
  schema: z.object({
    title: z.string(),
    date: z.coerce.date(),
    platform: z.string(),
    status: z.enum(["watching", "finished", "dropped"]),
    rating: rating.optional(),
    tags: z.array(z.string()).optional(),
    take: z.string().optional(),
    cover: z.string().optional(),
    placeholder: z.boolean().optional(),
  }),
});

const notes = defineCollection({
  loader: glob({ pattern: "**/*.md", base: "./src/content/library/notes" }),
  schema: z.object({
    title: z.string(),
    date: z.coerce.date(),
    tags: z.array(z.string()).optional(),
    placeholder: z.boolean().optional(),
    /** one-line SEO/OG/lede sentence. When absent, an excerpt of the body is
     *  used for feeds/metadata; the on-page lede then also falls back. */
    description: z.string().optional(),
    /** last-edited date; renders an "Updated …" stamp and feeds dateModified. */
    updated: z.coerce.date().optional(),
    /** drafts are excluded from production pages, the index, feeds, and
     *  sitemap, but still build in dev for previewing. */
    draft: z.boolean().optional(),
    /** search-result title, used verbatim as <title>/og:title/twitter:title
     *  (no site suffix). The H1 stays `title`. */
    seoTitle: z.string().optional(),
    /** social card PNG (1200x630), site-relative under public/ or absolute.
     *  Siblings `<name>-16x9|4x3|1x1.png` that exist join the BlogPosting
     *  `image` list. */
    image: z.string().optional(),
    /** alt text for `image`; falls back to the title. */
    imageAlt: z.string().optional(),
  }),
});

const articles = defineCollection({
  loader: glob({ pattern: "**/*.md", base: "./src/content/library/articles" }),
  schema: z.object({
    title: z.string(),
    date: z.coerce.date(),
    url: z.string().url(),
    source: z.string().optional(),
    tags: z.array(z.string()).optional(),
    placeholder: z.boolean().optional(),
  }),
});

const craft = defineCollection({
  loader: glob({ pattern: "**/*.md", base: "./src/content/craft" }),
  schema: z.object({
    title: z.string(),
    slug: z.string(),
    date: z.coerce.date(),
    note: z.string().optional(),
    description: z.string(),
    tech: z.array(z.string()),
    status: z.enum(["Active", "Archive"]),
    github: z.string().url().optional(),
    placeholder: z.boolean().optional(),
  }),
});

const photos = defineCollection({
  loader: glob({ pattern: "*.md", base: "./src/content/photos" }),
  schema: ({ image }) => z.object({
    // Store only metadata-stripped masters from src/assets/photos; keep camera
    // originals outside the site repository and never copy them to public/.
    source: image(),
    order: z.number().int().positive(),
    alt: z.string().trim().min(1),
    caption: z.string().trim().min(1).optional(),
    // A curated label preserves the precision the photographer chooses
    // (for example, a year or season) without implying EXIF-level certainty.
    date: z.string().trim().min(1).optional(),
    location: z.string().trim().min(1).optional(),
    // The capture record, written by hand from the original's info panel
    // (the master itself carries no metadata). `date` and `location` above
    // override the labels derived from these when a vaguer one reads better.
    taken: localDateTime.optional(),
    place: z.object({
      name: z.string().trim().min(1),
      locality: z.string().trim().min(1),
      region: z.string().trim().min(1).optional(),
      country: z.string().trim().min(1),
      lat: latitude.optional(),
      lon: longitude.optional(),
    }).optional(),
    camera: z.object({
      make: z.string().trim().min(1),
      model: z.string().trim().min(1),
      lens: z.string().trim().min(1).optional(),
      /** 35 mm equivalent, as the phone reports it */
      focal: z.number().positive().optional(),
      aperture: z.number().positive().optional(),
      /** seconds: "1/120", "0.5", "10" */
      shutter: z.string().regex(/^(?:1\/\d+|\d+(?:\.\d+)?)$/).optional(),
      iso: z.number().int().positive().optional(),
      ev: z.number().optional(),
      format: z.string().trim().min(1).optional(),
      mode: z.string().trim().min(1).optional(),
      /** the original's pixel dimensions and file size, not the master's */
      pixels: z.tuple([z.number().int().positive(), z.number().int().positive()]).optional(),
      bytes: z.number().int().positive().optional(),
    }).optional(),
    tags: z.array(slug).default([]),
    // New entries stay out of production until their image, order, and copy
    // have been reviewed and explicitly approved.
    draft: z.boolean().default(true),
    // Synthetic gallery studies can be reviewed locally but must never ship.
    generatedPreview: z.boolean().default(false),
  }),
});

const cafes = defineCollection({
  loader: file("./src/content/cafes.yaml"),
  schema: z.object({
    name: z.string().trim().min(1),
    area: z.string().trim().min(1),
    city: z.string().trim().min(1),
    country: z.string().trim().min(1).default("India"),
    lat: latitude,
    lon: longitude,
    /** one line, in my words */
    note: z.string().trim().min(1).max(90),
    order: z.string().trim().min(1).max(40),
    /** what it is best at: a single word */
    for: z.string().trim().min(1).max(16).optional(),
    visits: z.number().int().positive(),
    last: yearMonth,
    /** invented sample rows: shown in dev, never built for production */
    placeholder: z.boolean().default(false),
  }),
});

const people = defineCollection({
  loader: file("./src/content/people.yaml"),
  schema: z.object({
    name: z.string().trim().min(1),
    role: z.string().trim().min(1).max(48),
    place: z.string().trim().min(1).optional(),
    field: slug,
    /** why they are worth knowing, in one line */
    note: z.string().trim().min(1).max(110),
    met: z.number().int().min(1990).max(2100),
    links: z.array(z.object({
      kind: z.enum(["site", "github", "x", "linkedin", "substack", "youtube"]),
      href: z.string().url(),
    })).default([]),
    /** invented sample rows: shown in dev, never built for production */
    placeholder: z.boolean().default(false),
  }),
});

const someday = defineCollection({
  loader: file("./src/content/someday.yaml"),
  schema: z.object({
    title: z.string().trim().min(1).max(64),
    /** one line, in my words */
    note: z.string().trim().min(1).max(90).optional(),
    kind: slug,
    added: yearMonth,
    status: z.enum(["someday", "planned", "done"]).default("someday"),
    done: yearMonth.optional(),
    /** where it went, once it happened: a photo, a note */
    href: z.string().trim().min(1).optional(),
    /** invented sample rows: shown in dev, never built for production */
    placeholder: z.boolean().default(false),
  }).refine((item) => (item.status === "done") === (item.done !== undefined), {
    message: "A done item needs `done` (YYYY-MM); an open one must not have it.",
  }),
});

export const collections = { books, watch, notes, articles, craft, photos, cafes, people, someday };
