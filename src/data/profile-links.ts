export type ProfileCategory = "engineering" | "design" | "research" | "curation" | "direct";

export interface ProfileLink {
  id: string;
  platform: string;
  handle: string;
  href: string;
  category?: ProfileCategory;
  mail?: boolean;
}

export interface ProfileSectionDef {
  id: ProfileCategory;
  title: string;
}

export const profileLinkSections: ProfileSectionDef[] = [
  { id: "engineering", title: "Engineering & Network" },
  { id: "design", title: "Design & Craft" },
  { id: "research", title: "Research & Publications" },
  { id: "curation", title: "Curation & Spaces" },
  { id: "direct", title: "Direct & Booking" },
];

export const profileLinks: ProfileLink[] = [
  // Engineering & Network
  {
    id: "github",
    platform: "GitHub",
    handle: "ashwingopalsamy",
    href: "https://github.com/ashwingopalsamy",
    category: "engineering",
  },
  {
    id: "linkedin",
    platform: "LinkedIn",
    handle: "in/ashwingopalsamy",
    href: "https://www.linkedin.com/in/ashwingopalsamy",
    category: "engineering",
  },
  {
    id: "x",
    platform: "X",
    handle: "@ashwin2125",
    href: "https://x.com/ashwin2125",
    category: "engineering",
  },
  {
    id: "xing",
    platform: "XING",
    handle: "Ashwin_Gopalsamy",
    href: "https://www.xing.com/profile/Ashwin_Gopalsamy",
    category: "engineering",
  },
  {
    id: "standard-resume",
    platform: "Standard Resume",
    handle: "Resume",
    href: "https://standardresume.co/r/ashwingopalsamy",
    category: "engineering",
  },

  // Design & Craft
  {
    id: "figma",
    platform: "Figma",
    handle: "@ashwingopalsamy",
    href: "https://www.figma.com/@ashwingopalsamy",
    category: "design",
  },
  {
    id: "dribbble",
    platform: "Dribbble",
    handle: "ashwingopalsamy",
    href: "https://dribbble.com/ashwingopalsamy/",
    category: "design",
  },

  // Research & Publications
  {
    id: "scholar",
    platform: "Google Scholar",
    handle: "publications",
    href: "https://scholar.google.com/citations?user=i1AHxuIAAAAJ&hl=en",
    category: "research",
  },
  {
    id: "researchgate",
    platform: "ResearchGate",
    handle: "Ashwin-Gopalsamy",
    href: "https://www.researchgate.net/profile/Ashwin-Gopalsamy/",
    category: "research",
  },
  {
    id: "substack",
    platform: "Substack",
    handle: "ashwingopalsamy",
    href: "https://ashwingopalsamy.substack.com/",
    category: "research",
  },
  {
    id: "devto",
    platform: "Dev.to",
    handle: "@ashwingopalsamy",
    href: "https://dev.to/ashwingopalsamy",
    category: "research",
  },
  {
    id: "youtube",
    platform: "YouTube",
    handle: "@ashwxng",
    href: "https://www.youtube.com/@ashwxng",
    category: "research",
  },

  // Curation & Spaces
  {
    id: "arena",
    platform: "Are.na",
    handle: "ashwin-gopalsamy",
    href: "https://www.are.na/ashwin-gopalsamy/channels",
    category: "curation",
  },
  {
    id: "cosmos",
    platform: "Cosmos",
    handle: "ashwingopalsamy",
    href: "https://www.cosmos.so/ashwingopalsamy/collections",
    category: "curation",
  },

  // Direct & Booking
  {
    id: "cal",
    platform: "Cal.com",
    handle: "book a call",
    href: "https://cal.com/ashwingopalsamy/flexible-slot?user=ashwingopalsamy",
    category: "direct",
  },
  {
    id: "email",
    platform: "Email",
    handle: "hello@ashwingopalsamy.in",
    href: "mailto:hello@ashwingopalsamy.in",
    category: "direct",
    mail: true,
  },
];

