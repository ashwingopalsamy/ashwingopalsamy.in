<?xml version="1.0" encoding="utf-8"?>
<xsl:stylesheet version="3.0"
  xmlns:xsl="http://www.w3.org/1999/XSL/Transform"
  xmlns:atom="http://www.w3.org/2005/Atom"
  exclude-result-prefixes="atom">
  <xsl:output method="html" version="1.0" encoding="UTF-8" indent="yes"/>
  <xsl:template match="/">
    <html lang="en">
      <head>
        <meta charset="utf-8"/>
        <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover"/>
        <title><xsl:value-of select="/rss/channel/title"/> · Feed</title>
        <style>
          :root { color-scheme: light dark; --ink: #151617; --muted: #2c2e30; --rule: #dcdee0; --bg: #ffffff; }
          @media (prefers-color-scheme: dark) {
            :root { --ink: #ffffff; --muted: #dcdee0; --rule: #45484a; --bg: #151617; }
          }
          body { margin: 0; font: 16px/1.5 system-ui, sans-serif; color: var(--ink); background: var(--bg); }
          main { max-width: 40rem; margin: 0 auto; padding: 2.5rem 1.25rem calc(4rem + env(safe-area-inset-bottom, 0px)); }
          h1 { font-size: 1.5rem; letter-spacing: -0.02em; margin: 0 0 0.5rem; }
          .lede { color: var(--muted); margin: 0 0 1.5rem; }
          .meta { font-size: 0.875rem; color: var(--muted); margin-bottom: 2rem; }
          .meta a { color: inherit; }
          ol { list-style: none; margin: 0; padding: 0; border-top: 1px solid var(--rule); }
          li { padding: 1rem 0; border-bottom: 1px solid var(--rule); }
          .title { font-weight: 600; text-decoration: none; color: var(--ink); }
          .when { display: block; margin-top: 0.25rem; font-size: 0.8125rem; color: var(--muted); }
          .kind { font-size: 0.75rem; text-transform: uppercase; letter-spacing: 0.06em; color: var(--muted); }
        </style>
      </head>
      <body>
        <main>
          <h1><xsl:value-of select="/rss/channel/title"/></h1>
          <p class="lede"><xsl:value-of select="/rss/channel/description"/></p>
          <p class="meta">
            This is an RSS feed. Subscribe with a reader, or
            <a href="{/rss/channel/link}">browse the library</a>.
            Raw XML:
            <a href="{/rss/channel/atom:link[@rel='self']/@href}">feed.xml</a>.
          </p>
          <ol>
            <xsl:for-each select="/rss/channel/item">
              <li>
                <span class="kind"><xsl:value-of select="category"/></span>
                <a class="title" href="{link}"><xsl:value-of select="title"/></a>
                <span class="when"><xsl:value-of select="pubDate"/></span>
              </li>
            </xsl:for-each>
          </ol>
        </main>
      </body>
    </html>
  </xsl:template>
</xsl:stylesheet>
