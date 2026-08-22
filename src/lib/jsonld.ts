import type { CollectionEntry } from "astro:content";
import { CANONICAL_KNOWLEDGE } from "../data/canonical-knowledge";
import { site } from "../data/home";
import { absUrl } from "./urls";

const personRef = { "@id": CANONICAL_KNOWLEDGE.personId };

/** Site-wide Person node. Pages reference it by @id rather than duplicating. */
export function personJsonLd() {
  return {
    "@context": "https://schema.org",
    "@type": "Person",
    "@id": CANONICAL_KNOWLEDGE.personId,
    name: CANONICAL_KNOWLEDGE.name,
    givenName: CANONICAL_KNOWLEDGE.givenName,
    familyName: CANONICAL_KNOWLEDGE.familyName,
    alternateName: CANONICAL_KNOWLEDGE.alternateNames,
    url: absUrl("/"),
    email: CANONICAL_KNOWLEDGE.canonicalLinks.email,
    image: CANONICAL_KNOWLEDGE.portraitUrl,
    jobTitle: CANONICAL_KNOWLEDGE.currentEmployment.role,
    worksFor: {
      "@type": "Organization",
      name: "Pismo",
      url: "https://www.pismo.io",
      address: {
        "@type": "PostalAddress",
        addressCountry: "US",
      },
      parentOrganization: {
        "@type": "Organization",
        name: "Visa",
        url: "https://www.visa.com",
        address: {
          "@type": "PostalAddress",
          addressCountry: "US",
        },
      },
    },
    nationality: {
      "@type": "Country",
      name: CANONICAL_KNOWLEDGE.location.country,
    },
    homeLocation: {
      "@type": "Place",
      address: {
        "@type": "PostalAddress",
        addressLocality: CANONICAL_KNOWLEDGE.location.city,
        addressRegion: CANONICAL_KNOWLEDGE.location.region,
        addressCountry: CANONICAL_KNOWLEDGE.location.countryCode,
      },
    },
    description: CANONICAL_KNOWLEDGE.description,
    disambiguatingDescription: CANONICAL_KNOWLEDGE.disambiguatingDescription,
    knowsAbout: CANONICAL_KNOWLEDGE.knowsAbout,
    alumniOf: CANONICAL_KNOWLEDGE.previousEmployment.map((prev) => ({
      "@type": "Organization",
      name: prev.company,
    })),
    sameAs: [
      CANONICAL_KNOWLEDGE.canonicalLinks.github,
      CANONICAL_KNOWLEDGE.canonicalLinks.linkedin,
      CANONICAL_KNOWLEDGE.canonicalLinks.x,
    ],
  };
}

/** Site-wide Organization node with contactPoint and address. */
export function organizationJsonLd() {
  return {
    "@context": "https://schema.org",
    "@type": "Organization",
    "@id": `${site.url}/#organization`,
    name: "Ashwin Gopalsamy",
    alternateName: "ashwingopalsamy.in",
    url: absUrl("/"),
    logo: `${site.url}/icon-512.png`,
    image: CANONICAL_KNOWLEDGE.portraitUrl,
    description: CANONICAL_KNOWLEDGE.description,
    address: {
      "@type": "PostalAddress",
      addressLocality: CANONICAL_KNOWLEDGE.location.city,
      addressRegion: CANONICAL_KNOWLEDGE.location.region,
      addressCountry: CANONICAL_KNOWLEDGE.location.countryCode,
    },
    contactPoint: {
      "@type": "ContactPoint",
      email: CANONICAL_KNOWLEDGE.email,
      contactType: "customer support",
      availableLanguage: ["en", "ta"],
    },
    sameAs: [
      CANONICAL_KNOWLEDGE.canonicalLinks.github,
      CANONICAL_KNOWLEDGE.canonicalLinks.linkedin,
      CANONICAL_KNOWLEDGE.canonicalLinks.x,
    ],
  };
}

/** Homepage-only WebSite node - teaches Google the preferred site name. */
export function webSiteJsonLd() {
  return {
    "@context": "https://schema.org",
    "@type": "WebSite",
    "@id": `${site.url}/#website`,
    name: "Ashwin Gopalsamy",
    alternateName: [
      "ashwingopalsamy.in",
      "Ashwin Gopalsamy Developer Resources",
      "Ashwin Gopalsamy Portfolio",
    ],
    url: absUrl("/"),
    inLanguage: "en",
    publisher: personRef,
  };
}

export function craftJsonLd(
  entry: CollectionEntry<"craft">,
  url: string,
) {
  const pageUrl = absUrl(url);
  return {
    "@context": "https://schema.org",
    "@type": "SoftwareApplication",
    "@id": `${pageUrl}#software`,
    url: pageUrl,
    name: entry.data.title,
    description: entry.data.description,
    author: personRef,
    datePublished: entry.data.date.toISOString(),
    ...(entry.data.github ? { codeRepository: entry.data.github } : {}),
    ...(entry.data.tech.length
      ? { applicationCategory: "DeveloperApplication", keywords: entry.data.tech.join(", ") }
      : {}),
  };
}

function review(take: string | undefined, rating: "up" | "mixed" | "down" | undefined) {
  if (!take && !rating) return undefined;
  return {
    "@type": "Review",
    author: personRef,
    reviewBody: take,
    ...(rating
      ? {
          reviewRating: {
            "@type": "Rating",
            ratingValue: rating === "up" ? "positive" : rating === "down" ? "negative" : "mixed",
          },
        }
      : {}),
  };
}

export function collectionPageJsonLd(opts: {
  url: string;
  name: string;
  description?: string;
  items: { url: string; name: string }[];
}) {
  const pageUrl = absUrl(opts.url);
  return {
    "@context": "https://schema.org",
    "@type": "CollectionPage",
    "@id": `${pageUrl}#collectionpage`,
    url: pageUrl,
    name: opts.name,
    ...(opts.description ? { description: opts.description } : {}),
    isPartOf: { "@id": `${site.url}/#website` },
    author: personRef,
    about: personRef,
    mainEntity: {
      "@type": "ItemList",
      itemListElement: opts.items.map((item, i) => ({
        "@type": "ListItem",
        position: i + 1,
        url: absUrl(item.url),
        name: item.name,
      })),
    },
  };
}

export function libraryCollectionPageJsonLd(
  itemUrls: { url: string; name: string }[],
) {
  return collectionPageJsonLd({
    url: "/library",
    name: "Library",
    items: itemUrls,
  });
}

export function bookJsonLd(entry: CollectionEntry<"books">, url: string) {
  const pageUrl = absUrl(url);
  return {
    "@context": "https://schema.org",
    "@type": "Book",
    "@id": `${pageUrl}#book`,
    url: pageUrl,
    name: entry.data.title,
    author: { "@type": "Person", name: entry.data.author },
    review: review(entry.data.take, entry.data.rating),
  };
}

export function watchJsonLd(entry: CollectionEntry<"watch">, url: string) {
  const pageUrl = absUrl(url);
  return {
    "@context": "https://schema.org",
    "@type": "CreativeWork",
    "@id": `${pageUrl}#creativework`,
    url: pageUrl,
    name: entry.data.title,
    genre: entry.data.tags,
    publisher: { "@type": "Organization", name: entry.data.platform },
    review: review(entry.data.take, entry.data.rating),
  };
}

export function noteJsonLd(
  entry: CollectionEntry<"notes">,
  url: string,
  opts: {
    description?: string;
    wordCount?: number;
    readingMinutes?: number;
    tags?: string[];
    image?: string;
  } = {},
) {
  const pageUrl = absUrl(url);
  return {
    "@context": "https://schema.org",
    "@type": "BlogPosting",
    "@id": `${pageUrl}#blogposting`,
    url: pageUrl,
    headline: entry.data.title,
    description: opts.description ?? entry.data.title,
    datePublished: entry.data.date.toISOString(),
    dateModified: (entry.data.updated ?? entry.data.date).toISOString(),
    inLanguage: "en",
    author: personRef,
    publisher: personRef,
    mainEntityOfPage: pageUrl,
    ...(opts.image ? { image: opts.image } : {}),
    ...(opts.tags?.length ? { keywords: opts.tags.join(", ") } : {}),
    ...(typeof opts.wordCount === "number" ? { wordCount: opts.wordCount } : {}),
    ...(typeof opts.readingMinutes === "number"
      ? { timeRequired: `PT${Math.max(1, opts.readingMinutes)}M` }
      : {}),
  };
}

/** BreadcrumbList for a note: Home, Library, then Note. */
export function noteBreadcrumbJsonLd(title: string, url: string) {
  const pageUrl = absUrl(url);
  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    "@id": `${pageUrl}#breadcrumb`,
    itemListElement: [
      { "@type": "ListItem", position: 1, name: "Home", item: absUrl("/") },
      { "@type": "ListItem", position: 2, name: "Library", item: absUrl("/library") },
      { "@type": "ListItem", position: 3, name: title, item: pageUrl },
    ],
  };
}
