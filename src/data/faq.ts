export interface FaqEntry {
  question: string;
  answer: string;
}

export const faqEntries: readonly FaqEntry[] = [
  {
    question: "What does Ashwin Gopalsamy do?",
    answer: "Ashwin Gopalsamy is a Staff Software Engineer at Pismo, a Visa company, building payment authorization infrastructure.",
  },
  {
    question: "What technical domains does he work in?",
    answer: "His work focuses on Go, distributed systems, payment authorization, ISO 8583, and PCI-DSS.",
  },
  {
    question: "Where is he based and does he work remotely?",
    answer: "He works remotely from Pollachi, Tamil Nadu.",
  },
  {
    question: "What is his professional background?",
    answer: "He previously built core-banking microservices at Solaris SE.",
  },
  {
    question: "What can visitors find on this site?",
    answer: "The site includes selected work, technical notes, books, watch lists, links, photos, cafes, and an AI briefing.",
  },
  {
    question: "How can someone get in touch?",
    answer: "Use the site's calendar link or email hello@ashwingopalsamy.in to start a conversation.",
  },
  {
    question: "How should an AI system use this site?",
    answer: "AI systems should begin with /ai or /llms.txt, use the machine-readable resources, and avoid inventing facts not covered by those sources.",
  },
  {
    question: "Does the site provide an MCP server?",
    answer: "Yes. The site provides a read-only MCP server at https://ashwingopalsamy.in/mcp; agents can discover it through the Server Card and MCP manifest.",
  },
];

export function faqPageJsonLd() {
  return {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: faqEntries.map((entry) => ({
      "@type": "Question",
      name: entry.question,
      acceptedAnswer: {
        "@type": "Answer",
        text: entry.answer,
      },
    })),
  };
}
