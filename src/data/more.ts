export type MoreDestinationStatus = "live" | "coming-soon";

export type MoreDestinationId = "library" | "photos" | "ai" | "cafe" | "someday" | "people";

export interface MoreDestination {
  id: MoreDestinationId;
  title: string;
  href: string;
  description: string;
  status: MoreDestinationStatus;
  className: string;
}

export const moreDestinations: MoreDestination[] = [
  {
    id: "library",
    title: "library",
    href: "/library/",
    description: "Things I read, watch, and keep.",
    status: "live",
    className: "t-library",
  },
  {
    id: "photos",
    title: "photos",
    href: "/more/photos/",
    description: "Frames worth a second look.",
    status: "coming-soon",
    className: "t-photos",
  },
  {
    id: "ai",
    title: "ai",
    href: "/ai/",
    description: "For the agents. llms.txt, knowledge.json.",
    status: "live",
    className: "t-ai",
  },
  {
    id: "cafe",
    title: "cafe",
    href: "/more/cafe/",
    description: "Filed by city.",
    status: "coming-soon",
    className: "t-cafe",
  },
  {
    id: "someday",
    title: "someday",
    href: "/more/someday/",
    description: "The list I reread more than act on.",
    status: "coming-soon",
    className: "t-someday",
  },
  {
    id: "people",
    title: "people",
    href: "/more/people/",
    description: "Good people worth knowing.",
    status: "coming-soon",
    className: "t-people",
  },
];

export function getMoreDestination(id: MoreDestinationId): MoreDestination {
  const destination = moreDestinations.find((item) => item.id === id);
  if (!destination) throw new Error(`Unknown More destination: ${id}`);
  return destination;
}
