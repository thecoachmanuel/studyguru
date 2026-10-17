/**
 * Native Web Scraper & Contact/Corporate Intelligence Extractor for StudyCord AI Guru
 * 100% Free, Zero API Keys, runs server-side in Node.js / Next.js
 * Scrapes webpages, extracts clean text, and pulls real-time contacts (WhatsApp, phone,
 * email, physical address), feedback/reviews, and company figures (leadership, revenue, metrics).
 */

const URL_REGEX = /https?:\/\/[^\s<>"'()]+[^\s<>"'().,!?:;]/gi;

export function extractUrlsFromText(text) {
  if (!text || typeof text !== 'string') return [];
  const matches = text.match(URL_REGEX);
  if (!matches) return [];
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
    .replace(/&#x27;/g, "'")
    .replace(/&apos;/g, "'")
    .replace(/&nbsp;/g, ' ')
    .replace(/&#(\d+);/g, (_, code) => String.fromCharCode(Number(code)))
    .replace(/&#x([0-9a-f]+);/gi, (_, code) => String.fromCharCode(parseInt(code, 16)));
}

/**
 * Extracts verified contacts, WhatsApp numbers, phone lines, emails, social links,
 * and Schema.org corporate figures (founders, CEO, revenue, employees, reviews) from raw HTML.
 */
export function extractContactAndCorporateData(html, baseUrl = '') {
  const data = {
    whatsApp: [],
    emails: [],
    phones: [],
    addresses: [],
    socials: [],
    corporateFigures: [],
    reviews: [],
  };

  if (!html || typeof html !== 'string') return data;

  // 1. WhatsApp Links & Numbers (wa.me, api.whatsapp.com, chat.whatsapp.com)
  const waRegex = /(?:https?:\/\/)?(?:wa\.me\/|api\.whatsapp\.com\/(?:send\/?\??(?:phone=)?)?|chat\.whatsapp\.com\/)([a-zA-Z0-9_\-\+]+)/gi;
  let waMatch;
  while ((waMatch = waRegex.exec(html)) !== null) {
    const rawVal = waMatch[1].replace(/[^0-9+]/g, '');
    const cleanLink = rawVal ? `https://wa.me/${rawVal}` : `https://wa.me/${waMatch[1]}`;
    if (!data.whatsApp.includes(cleanLink)) {
      data.whatsApp.push(cleanLink);
    }
  }

  // Plain-text WhatsApp mentions e.g. "WhatsApp: +234..." or "WhatsApp line: 090..."
  const waTextRegex = /(?:whatsapp|wa\s*(?:no|number|line)?)[:\s–—\-]+(\+?[0-9\s\-()]{8,18})/gi;
  let waTextMatch;
  while ((waTextMatch = waTextRegex.exec(html)) !== null) {
    const cleanNum = waTextMatch[1].replace(/<[^>]+>/g, '').replace(/[\r\n\t]/g, ' ').trim();
    if (cleanNum.length >= 8 && !data.whatsApp.some((w) => w.includes(cleanNum.replace(/\s+/g, '')))) {
      data.whatsApp.push(cleanNum);
    }
  }

  // 2. Email Addresses (mailto: links + validated regex)
  const mailtoRegex = /href=["']?mailto:([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})["']?/gi;
  let mailtoMatch;
  while ((mailtoMatch = mailtoRegex.exec(html)) !== null) {
    const email = mailtoMatch[1].toLowerCase().trim();
    if (!data.emails.includes(email)) data.emails.push(email);
  }

  const plainEmailRegex = /\b[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}\b/g;
  let plainEmailMatch;
  const invalidEmailExts = ['.png', '.jpg', '.jpeg', '.gif', '.svg', '.webp', '.js', '.css', '.woff', '.ttf'];
  while ((plainEmailMatch = plainEmailRegex.exec(html)) !== null) {
    const email = plainEmailMatch[0].toLowerCase().trim();
    const hasBadExt = invalidEmailExts.some((ext) => email.endsWith(ext));
    if (!hasBadExt && !data.emails.includes(email)) {
      data.emails.push(email);
    }
  }

  // 3. Phone Numbers (tel: links)
  const telRegex = /href=["']?tel:([^"'\s>]+)["']?/gi;
  let telMatch;
  while ((telMatch = telRegex.exec(html)) !== null) {
    const phone = decodeURIComponent(telMatch[1]).replace(/<[^>]+>/g, '').trim();
    if (phone.length >= 4 && !data.phones.includes(phone)) {
      data.phones.push(phone);
    }
  }

  // 4. Social Media & Professional Profiles
  const socialRegex = /href=["']?(https?:\/\/(?:www\.)?(?:linkedin\.com\/(?:company|in)\/[^"'\s>]+|x\.com\/[^"'\s>]+|twitter\.com\/[^"'\s>]+|facebook\.com\/[^"'\s>]+|instagram\.com\/[^"'\s>]+|youtube\.com\/(?:user|channel|c|@)[^"'\s>]+))["']?/gi;
  let socialMatch;
  while ((socialMatch = socialRegex.exec(html)) !== null) {
    const sLink = socialMatch[1].replace(/["'>]+$/, '');
    if (!data.socials.includes(sLink)) data.socials.push(sLink);
  }

  // 5. Schema.org JSON-LD (Rich corporate figures, founders, ratings, addresses)
  const jsonLdRegex = /<script\s+[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi;
  let jsonMatch;
  while ((jsonMatch = jsonLdRegex.exec(html)) !== null) {
    try {
      const parsed = JSON.parse(jsonMatch[1]);
      const items = Array.isArray(parsed) ? parsed : [parsed];

      for (const item of items) {
        if (!item || typeof item !== 'object') continue;

        // Address
        if (item.address) {
          const addr = typeof item.address === 'string'
            ? item.address
            : `${item.address.streetAddress || ''}, ${item.address.addressLocality || ''}, ${item.address.addressRegion || ''} ${item.address.postalCode || ''}, ${item.address.addressCountry || ''}`.replace(/^[\s,]+|[\s,]+$/g, '');
          if (addr && !data.addresses.includes(addr)) data.addresses.push(addr);
        }

        // ContactPoint
        if (item.contactPoint) {
          const cpList = Array.isArray(item.contactPoint) ? item.contactPoint : [item.contactPoint];
          for (const cp of cpList) {
            if (cp.telephone && !data.phones.includes(cp.telephone)) data.phones.push(cp.telephone);
            if (cp.email && !data.emails.includes(cp.email)) data.emails.push(cp.email);
          }
        }

        // Telephone & email directly on organization
        if (item.telephone && !data.phones.includes(item.telephone)) data.phones.push(item.telephone);
        if (item.email && !data.emails.includes(item.email)) data.emails.push(item.email);

        // Corporate Figures: Founders, CEO, Employees, Revenue, Founded
        const figures = [];
        if (item.name) figures.push(`Organization: ${item.name}`);
        if (item.founder) {
          const founderName = typeof item.founder === 'string' ? item.founder : item.founder.name || '';
          if (founderName) figures.push(`Founder: ${founderName}`);
        }
        if (item.foundingDate) figures.push(`Founded: ${item.foundingDate}`);
        if (item.numberOfEmployees) {
          const emp = typeof item.numberOfEmployees === 'object' ? item.numberOfEmployees.value || item.numberOfEmployees.minValue : item.numberOfEmployees;
          if (emp) figures.push(`Employees: ${emp}`);
        }

        if (figures.length > 0) {
          data.corporateFigures.push(figures.join(' | '));
        }

        // Aggregate Rating & Feedback
        if (item.aggregateRating) {
          const ratingVal = item.aggregateRating.ratingValue;
          const count = item.aggregateRating.reviewCount || item.aggregateRating.ratingCount;
          if (ratingVal) {
            data.reviews.push(`Rating: ${ratingVal}/5 based on ${count || 'multiple'} customer reviews`);
          }
        }
      }
    } catch {}
  }

  return data;
}

export function cleanHtmlToText(html, url = '') {
  if (!html || typeof html !== 'string') return { title: '', text: '' };

  // 1. Extract <title> if present
  let title = '';
  const titleMatch = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
  if (titleMatch && titleMatch[1]) {
    title = decodeHtmlEntities(titleMatch[1].replace(/\s+/g, ' ').trim());
  }

  // 2. Extract meta description
  let metaDesc = '';
  const metaMatch = html.match(/<meta\s+[^>]*name=["']description["'][^>]*content=["']([^"']*)["']/i) ||
    html.match(/<meta\s+[^>]*content=["']([^"']*)["'][^>]*name=["']description["']/i);
  if (metaMatch && metaMatch[1]) {
    metaDesc = decodeHtmlEntities(metaMatch[1].trim());
  }

  // 3. Extract verified Contacts, WhatsApp, and Corporate figures before stripping tags
  const extractedIntel = extractContactAndCorporateData(html, url);

  // 4. Remove scripts, styles, noscript, svg, canvas, iframe (PRESERVE header, footer, contact sections!)
  let clean = html
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, ' ')
    .replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, ' ')
    .replace(/<noscript\b[^<]*(?:(?!<\/noscript>)<[^<]*)*<\/noscript>/gi, ' ')
    .replace(/<svg\b[^<]*(?:(?!<\/svg>)<[^<]*)*<\/svg>/gi, ' ')
    .replace(/<iframe\b[^<]*(?:(?!<\/iframe>)<[^<]*)*<\/iframe>/gi, ' ')
    .replace(/<!--[\s\S]*?-->/g, ' ');

  // 5. Convert special contact and WhatsApp links into Markdown links
  clean = clean.replace(/<a\s+[^>]*href=["']?((?:tel:|mailto:|https?:\/\/(?:wa\.me|api\.whatsapp\.com)[^"'\s>]*))["']?[^>]*>([\s\S]*?)<\/a>/gi, (_, link, text) => {
    const cleanText = text.replace(/<[^>]+>/g, '').trim();
    return ` [${cleanText || 'Contact Link'}](${link}) `;
  });

  // 6. Convert semantic breaks
  clean = clean
    .replace(/<\/(p|div|li|tr|article|section|blockquote)>/gi, '\n\n')
    .replace(/<\/h([1-6])>/gi, '\n\n')
    .replace(/<h([1-6])[^>]*>/gi, '\n\n### ')
    .replace(/<br\s*[\/]?>/gi, '\n')
    .replace(/<li[^>]*>/gi, '• ')
    .replace(/<footer[^>]*>/gi, '\n\n### [Website Footer & Company Contact Section]\n')
    .replace(/<header[^>]*>/gi, '\n\n### [Website Header]\n')
    .replace(/<[^>]+>/g, ' '); // Strip remaining tags

  clean = decodeHtmlEntities(clean);

  // 7. Format verified contact & corporate block at top of scraped content
  let intelBlock = '';
  const hasIntel =
    extractedIntel.whatsApp.length > 0 ||
    extractedIntel.emails.length > 0 ||
    extractedIntel.phones.length > 0 ||
    extractedIntel.addresses.length > 0 ||
    extractedIntel.corporateFigures.length > 0 ||
    extractedIntel.reviews.length > 0 ||
    extractedIntel.socials.length > 0;

  if (hasIntel) {
    intelBlock += `### 🔍 VERIFIED CONTACTS, FIGURES & CORPORATE INTEL (EXTRACTED FROM PAGE):\n`;
    if (extractedIntel.whatsApp.length > 0) {
      intelBlock += `• 📱 WhatsApp / Chat: ${extractedIntel.whatsApp.join(', ')}\n`;
    }
    if (extractedIntel.phones.length > 0) {
      intelBlock += `• 📞 Phone Numbers: ${extractedIntel.phones.join(', ')}\n`;
    }
    if (extractedIntel.emails.length > 0) {
      intelBlock += `• ✉️ Email Addresses: ${extractedIntel.emails.slice(0, 6).join(', ')}\n`;
    }
    if (extractedIntel.addresses.length > 0) {
      intelBlock += `• 🏢 Physical Address / Headquarters: ${extractedIntel.addresses.join('; ')}\n`;
    }
    if (extractedIntel.corporateFigures.length > 0) {
      intelBlock += `• 👥 Corporate Figures & Metadata: ${extractedIntel.corporateFigures.join(' | ')}\n`;
    }
    if (extractedIntel.reviews.length > 0) {
      intelBlock += `• ⭐ Customer Reviews / Ratings: ${extractedIntel.reviews.join('; ')}\n`;
    }
    if (extractedIntel.socials.length > 0) {
      intelBlock += `• 🌐 Official Social Profiles: ${extractedIntel.socials.slice(0, 4).join(', ')}\n`;
    }
    intelBlock += `\n---\n\n`;
  }

  // 8. Collapse whitespace while preserving paragraph breaks
  const lines = clean
    .split('\n')
    .map((l) => l.replace(/\s+/g, ' ').trim())
    .filter((l) => l.length > 0);

  let bodyText = lines.join('\n\n').slice(0, 24000);
  if (metaDesc) {
    bodyText = `**Page Summary**: ${metaDesc}\n\n${bodyText}`;
  }

  const fullText = (intelBlock + bodyText).slice(0, 26000);
  return { title, text: fullText, extractedIntel };
}

export async function scrapeWebPage(url, timeoutMs = 10000) {
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
    if (
      !contentType.includes('text') &&
      !contentType.includes('html') &&
      !contentType.includes('json') &&
      !contentType.includes('xml')
    ) {
      return {
        url,
        success: false,
        error: `Unsupported content-type: ${contentType}`,
      };
    }

    const html = await response.text();
    const { title, text, extractedIntel } = cleanHtmlToText(html, url);

    if (!text || text.length < 30) {
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
      extractedIntel,
      success: true,
      length: text.length,
    };
  } catch (err) {
    clearTimeout(timer);
    return {
      url,
      success: false,
      error: err.name === 'AbortError' ? `Page fetch timed out (${timeoutMs / 1000}s)` : err.message || 'Scrape failed',
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
