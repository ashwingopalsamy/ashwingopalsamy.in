export interface ProfileLink {
  id: string;
  platform: string;
  handle: string;
  href: string;
  mail?: boolean;
}

export const profileLinks: ProfileLink[] = [
  {
    id: "github",
    platform: "GitHub",
    handle: "ashwingopalsamy",
    href: "https://github.com/ashwingopalsamy",
  },
  {
    id: "linkedin",
    platform: "LinkedIn",
    handle: "in/ashwingopalsamy",
    href: "https://www.linkedin.com/in/ashwingopalsamy",
  },
  { id: "x", platform: "X", handle: "@ashwin2125", href: "https://x.com/ashwin2125" },
  {
    id: "youtube",
    platform: "YouTube",
    handle: "@ashwxng",
    href: "https://www.youtube.com/@ashwxng",
  },
  {
    id: "substack",
    platform: "Substack",
    handle: "ashwingopalsamy",
    href: "https://ashwingopalsamy.substack.com/",
  },
  {
    id: "devto",
    platform: "Dev.to",
    handle: "@ashwingopalsamy",
    href: "https://dev.to/ashwingopalsamy",
  },
  {
    id: "scholar",
    platform: "Google Scholar",
    handle: "publications",
    href: "https://scholar.google.com/citations?user=i1AHxuIAAAAJ&hl=en",
  },
  {
    id: "xing",
    platform: "XING",
    handle: "Ashwin_Gopalsamy",
    href: "https://www.xing.com/profile/Ashwin_Gopalsamy",
  },
  {
    id: "standard-resume",
    platform: "Standard Resume",
    handle: "Resume",
    href: "https://standardresume.co/r/ashwingopalsamy",
  },
  {
    id: "cal",
    platform: "Cal.com",
    handle: "book a call",
    href: "https://cal.com/ashwingopalsamy/flexible-slot?user=ashwingopalsamy",
  },
  {
    id: "email",
    platform: "Email",
    handle: "hello@ashwingopalsamy.in",
    href: "mailto:hello@ashwingopalsamy.in",
    mail: true,
  },
];
