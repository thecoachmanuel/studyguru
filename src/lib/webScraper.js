/**
 * Native Web Scraper for StudyCord AI Guru
 * 100% Free, Zero API Keys, runs server-side in Node.js / Next.js
 * Fetches and extracts clean, readable text from any website URL for LLM context grounding.
 */

const URL_REGEX = /https?:\/\/[^\s<>"'()]+[^\s<>"'().,!?:;]/gi;

export function extractUrlsFromText(text) {
  if (!text || typeof text !== 'string') return [];
  const matches = text.match(URL_REGEX);
  if (!matches) return [];
  // Deduplicate and filter out unwanted links
  const unique = Array.from(new Set(matches.map((u) => u.trim())));
  return unique.filter((u) => {
    try {
      const parsed = new URL(u);
      return parsed.protocol === 'http:' || parsed.protocol === 'https:';
    } catch {
      return false;
    }
  });
}

export function decodeHtmlEntities(str) {
  if (!str) return '';
  return str
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&apos;/g, "'")
    .replace(/&nbsp;/g, ' ')
    .replace(/&#(\d+);/g, (_, code) => String.fromCharCode(Number(code)))
    .replace(/&#x([0-9a-f]+);/gi, (_, code) => String.fromCharCode(parseInt(code, 16)));
}

export function cleanHtmlToText(html) {
  if (!html || typeof html !== 'string') return '';

  // Extract <title> if present
  let title = '';
  const titleMatch = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
  if (titleMatch && titleMatch[1]) {
    title = decodeHtmlEntities(titleMatch[1].replace(/\s+/g, ' ').trim());
  }

  // Remove script, style, noscript, svg, canvas, iframe, header, footer, nav
  let clean = html
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, ' ')
    .replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, ' ')
    .replace(/<noscript\b[^<]*(?:(?!<\/noscript>)<[^<]*)*<\/noscript>/gi, ' ')
    .replace(/<svg\b[^<]*(?:(?!<\/svg>)<[^<]*)*<\/svg>/gi, ' ')
    .replace(/<iframe\b[^<]*(?:(?!<\/iframe>)<[^<]*)*<\/iframe>/gi, ' ')
    .replace(/<nav\b[^<]*(?:(?!<\/nav>)<[^<]*)*<\/nav>/gi, ' ')
    .replace(/<footer\b[^<]*(?:(?!<\/footer>)<[^<]*)*<\/footer>/gi, ' ')
    .replace(/<!--[\s\S]*?-->/g, ' ');

  // Convert semantic breaks
  clean = clean
    .replace(/<\/(p|div|h[1-6]|li|tr|article|section|blockquote)>/gi, '\n\n')
    .replace(/<br\s*[\/]?>/gi, '\n')
    .replace(/<li[^>]*>/gi, '• ')
    .replace(/<h([1-6])[^>]*>/gi, '\n\n### ')
    .replace(/<[^>]+>/g, ' '); // Strip remaining tags

  clean = decodeHtmlEntities(clean);

  // Collapse excessive whitespace while preserving paragraph breaks
  const lines = clean
    .split('\n')
    .map((l) => l.replace(/\s+/g, ' ').trim())
    .filter((l) => l.length > 0);

  const text = lines.join('\n\n').slice(0, 24000); // 24k chars cap for optimal LLM context
  return { title, text };
}

export async function scrapeWebPage(url, timeoutMs = 7000) {
  if (!url || typeof url !== 'string') {
    return { url, success: false, error: 'Invalid URL' };
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(url, {
      signal: controller.signal,
      headers: {
        'User-Agent':
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36 StudyCordBot/1.0',
        Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,text/plain;q=0.8,*/*;q=0.7',
        'Accept-Language': 'en-US,en;q=0.9',
      },
      redirect: 'follow',
    });

    clearTimeout(timer);

    if (!response.ok) {
      return {
        url,
        success: false,
        error: `HTTP ${response.status} (${response.statusText})`,
      };
    }

    const contentType = response.headers.get('content-type') || '';
    if (!contentType.includes('text') && !contentType.includes('html') && !contentType.includes('json') && !contentType.includes('xml')) {
      return {
        url,
        success: false,
        error: `Unsupported content-type: ${contentType}`,
      };
    }

    const html = await response.text();
    const { title, text } = cleanHtmlToText(html);

    if (!text || text.length < 40) {
      return {
        url,
        title: title || url,
        text: '',
        success: false,
        error: 'Page returned empty content or is protected by anti-bot verification.',
      };
    }

    return {
      url,
      title: title || url,
      text,
      success: true,
      length: text.length,
    };
  } catch (err) {
    clearTimeout(timer);
    return {
      url,
      success: false,
      error: err.name === 'AbortError' ? 'Page fetch timed out (7s)' : err.message || 'Scrape failed',
    };
  }
}

/**
 * Scrapes multiple URLs in parallel with concurrency cap
 */
export async function scrapeMultipleWebPages(urls, maxPages = 3) {
  if (!Array.isArray(urls) || urls.length === 0) return [];
  const targetUrls = urls.slice(0, maxPages);
  const results = await Promise.allSettled(targetUrls.map((u) => scrapeWebPage(u)));
  return results
    .filter((r) => r.status === 'fulfilled' && r.value.success)
    .map((r) => r.value);
}
