import { defineCollection, z } from "astro:content";
import { glob } from "astro/loaders";

const rating = z.enum(["up", "mixed", "down"]);

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
    // New entries stay out of production until their image, order, and copy
    // have been reviewed and explicitly approved.
    draft: z.boolean().default(true),
    // Synthetic gallery studies can be reviewed locally but must never ship.
    generatedPreview: z.boolean().default(false),
  }),
});

export const collections = { books, watch, notes, articles, craft, photos };
