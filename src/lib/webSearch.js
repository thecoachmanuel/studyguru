/**
 * Live Web Search Engine for StudyCord AI Guru
 * 100% Free, Zero API Keys required (uses DuckDuckGo HTML & Wikipedia APIs)
 * Supports optional Tavily / Serper API keys if provided in environment variables.
 */

import { scrapeWebPage, decodeHtmlEntities } from './webScraper.js';

/**
 * Clean and decode DuckDuckGo redirect URLs
 * e.g. //duckduckgo.com/l/?uddg=https%3A%2F%2Fexample.com%2F...
 */
function resolveDuckDuckGoUrl(rawHref) {
  if (!rawHref) return '';
  if (rawHref.startsWith('//')) {
    rawHref = `https:${rawHref}`;
  }
  try {
    const urlObj = new URL(rawHref, 'https://duckduckgo.com');
    const uddg = urlObj.searchParams.get('uddg');
    if (uddg) {
      return decodeURIComponent(uddg);
    }
  } catch {}
  return rawHref;
}

/**
 * 1. Free DuckDuckGo Search (Zero API keys, 100% Free & Live Real-Time Web Data)
 * Uses POST method for ultra-reliable results without bot challenge redirects
 */
async function searchDuckDuckGo(query, limit = 5, timeoutMs = 6500) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch('https://html.duckduckgo.com/html/', {
      method: 'POST',
      signal: controller.signal,
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'User-Agent':
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
        Accept: 'text/html,application/xhtml+xml',
        'Accept-Language': 'en-US,en;q=0.9',
      },
      body: `q=${encodeURIComponent(query)}`,
    });

    clearTimeout(timer);

    if (!response.ok) return [];

    const html = await response.text();
    const results = [];

    // Match each result block: <div class="result ...">
    const resultBlocks = html.split(/<div\s+class="[^"]*result\s+results_links[^"]*"[^>]*>/gi).slice(1);

    for (const block of resultBlocks) {
      if (results.length >= limit) break;

      // Extract Title & Link (handles any attribute order in anchor tag)
      const titleLinkMatch =
        block.match(/<a\s+[^>]*class="[^"]*result__a[^"]*"[^>]*href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/i) ||
        block.match(/<a\s+[^>]*href="([^"]+)"[^>]*class="[^"]*result__a[^"]*"[^>]*>([\s\S]*?)<\/a>/i);

      if (!titleLinkMatch) continue;

      const rawHref = titleLinkMatch[1];
      const rawTitle = titleLinkMatch[2].replace(/<[^>]+>/g, '').trim();
      const realUrl = resolveDuckDuckGoUrl(rawHref);

      if (!realUrl || !realUrl.startsWith('http') || realUrl.includes('duckduckgo.com/y.js')) {
        continue;
      }

      // Extract Snippet
      let snippet = '';
      const snippetMatch = block.match(/<a\s+[^>]*class="[^"]*result__snippet[^"]*"[^>]*>([\s\S]*?)<\/a>/i);
      if (snippetMatch && snippetMatch[1]) {
        snippet = snippetMatch[1].replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim();
      }

      const cleanTitle = decodeHtmlEntities(rawTitle);
      const cleanSnippet = decodeHtmlEntities(snippet);

      results.push({
        title: cleanTitle || 'Web Result',
        url: realUrl,
        snippet: cleanSnippet || `Live web page from ${new URL(realUrl).hostname}`,
        source: 'Live Web Search',
      });
    }

    return results;
  } catch (err) {
    clearTimeout(timer);
    console.warn('[WebSearch] DuckDuckGo search notice:', err.message);
    return [];
  }
}

/**
 * 2. Free Wikipedia Full-Text Search API (Zero API keys, instant academic grounding)
 */
async function searchWikipedia(query, limit = 3, timeoutMs = 4500) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    // Primary: Wikipedia full-text query search API
    const wikiSearchUrl = `https://en.wikipedia.org/w/api.php?action=query&list=search&srsearch=${encodeURIComponent(query)}&srlimit=${limit}&format=json`;
    const response = await fetch(wikiSearchUrl, {
      signal: controller.signal,
      headers: {
        'User-Agent': 'StudyCordBot/1.0 (academic study assistant; contact@studycord.app)',
      },
    });

    clearTimeout(timer);
    if (!response.ok) return [];

    const data = await response.json();
    const searchItems = data?.query?.search || [];

    if (Array.isArray(searchItems) && searchItems.length > 0) {
      return searchItems.map((item) => {
        const rawTitle = item.title || '';
        const cleanSnippet = decodeHtmlEntities((item.snippet || '').replace(/<[^>]+>/g, '').trim());
        const wikiUrl = `https://en.wikipedia.org/wiki/${encodeURIComponent(rawTitle.replace(/\s+/g, '_'))}`;
        return {
          title: `${rawTitle} (Wikipedia)`,
          url: wikiUrl,
          snippet: cleanSnippet || `Wikipedia academic article on ${rawTitle}`,
          source: 'Wikipedia Encyclopedia',
        };
      });
    }

    // Fallback: Wikipedia opensearch API
    const openSearchUrl = `https://en.wikipedia.org/w/api.php?action=opensearch&search=${encodeURIComponent(query)}&limit=${limit}&namespace=0&format=json`;
    const openRes = await fetch(openSearchUrl, {
      headers: { 'User-Agent': 'StudyCordBot/1.0' },
    });
    if (openRes.ok) {
      const openData = await openRes.json();
      const titles = openData[1] || [];
      const snippets = openData[2] || [];
      const urls = openData[3] || [];
      const results = [];
      for (let i = 0; i < titles.length; i++) {
        if (urls[i] && titles[i]) {
          results.push({
            title: `${titles[i]} (Wikipedia)`,
            url: urls[i],
            snippet: snippets[i] || `Wikipedia article on ${titles[i]}`,
            source: 'Wikipedia Encyclopedia',
          });
        }
      }
      return results;
    }

    return [];
  } catch (err) {
    clearTimeout(timer);
    return [];
  }
}

/**
 * 3. Optional Tavily AI Search (if TAVILY_API_KEY is configured in .env)
 */
async function searchTavily(query, apiKey, limit = 4, timeoutMs = 6000) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch('https://api.tavily.com/search', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      signal: controller.signal,
      body: JSON.stringify({
        api_key: apiKey,
        query,
        search_depth: 'basic',
        include_answer: true,
        max_results: limit,
      }),
    });

    clearTimeout(timer);
    if (!response.ok) return null;

    const data = await response.json();
    const results = (data.results || []).map((r) => ({
      title: r.title || 'Web Result',
      url: r.url,
      snippet: r.content || '',
      source: 'Tavily Search',
    }));

    return {
      results,
      directAnswer: data.answer || null,
    };
  } catch (err) {
    clearTimeout(timer);
    return null;
  }
}

/**
 * 4. Optional Serper Google Search (if SERPER_API_KEY is configured in .env)
 */
async function searchSerper(query, apiKey, limit = 4, timeoutMs = 6000) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch('https://google.serper.dev/search', {
      method: 'POST',
      headers: {
        'X-API-KEY': apiKey,
        'Content-Type': 'application/json',
      },
      signal: controller.signal,
      body: JSON.stringify({
        q: query,
        num: limit,
      }),
    });

    clearTimeout(timer);
    if (!response.ok) return null;

    const data = await response.json();
    const results = (data.organic || []).map((r) => ({
      title: r.title || 'Web Result',
      url: r.link,
      snippet: r.snippet || '',
      source: 'Google (Serper)',
    }));

    return {
      results,
      directAnswer: data.answerBox?.snippet || data.knowledgeGraph?.description || null,
    };
  } catch (err) {
    clearTimeout(timer);
    return null;
  }
}

/**
 * Master Hybrid Web Search
 * Automatically selects the best search provider:
 * 1. Tavily / Serper if API key configured
 * 2. DuckDuckGo + Wikipedia (100% Free, zero config)
 * 3. Deep-crawls top 1-2 pages for grounded excerpt text
 */
export async function performWebSearch(query, options = {}) {
  const { maxResults = 5, deepScrape = true } = options;
  const cleanQuery = query.trim();
  if (!cleanQuery) return { results: [], query: '' };

  let searchResults = [];
  let directAnswer = null;
  let providerUsed = 'free-ddg-wiki';

  // Check for paid/enhanced API keys if user added them
  const tavilyKey = process.env.TAVILY_API_KEY;
  const serperKey = process.env.SERPER_API_KEY;

  if (tavilyKey) {
    const tavilyRes = await searchTavily(cleanQuery, tavilyKey, maxResults);
    if (tavilyRes && tavilyRes.results?.length > 0) {
      searchResults = tavilyRes.results;
      directAnswer = tavilyRes.directAnswer;
      providerUsed = 'Tavily Search';
    }
  }

  if (searchResults.length === 0 && serperKey) {
    const serperRes = await searchSerper(cleanQuery, serperKey, maxResults);
    if (serperRes && serperRes.results?.length > 0) {
      searchResults = serperRes.results;
      directAnswer = serperRes.directAnswer;
      providerUsed = 'Google (Serper)';
    }
  }

  // Free Fallback: Concurrently query DuckDuckGo and Wikipedia
  if (searchResults.length === 0) {
    const [ddgResults, wikiResults] = await Promise.all([
      searchDuckDuckGo(cleanQuery, maxResults),
      searchWikipedia(cleanQuery, 2),
    ]);

    const seenUrls = new Set();
    const merged = [];

    // Prioritize top Wikipedia hit if relevant for encyclopedia knowledge
    if (wikiResults.length > 0) {
      merged.push(wikiResults[0]);
      seenUrls.add(wikiResults[0].url);
    }

    for (const r of ddgResults) {
      if (!seenUrls.has(r.url)) {
        seenUrls.add(r.url);
        merged.push(r);
      }
    }

    for (const r of wikiResults.slice(1)) {
      if (!seenUrls.has(r.url) && merged.length < maxResults) {
        seenUrls.add(r.url);
        merged.push(r);
      }
    }

    searchResults = merged.slice(0, maxResults);
    providerUsed = 'DuckDuckGo + Wikipedia (Free Web)';
  }

  // Deep Scrape: fetch full text from top 1 or 2 URLs to provide deep groundings
  let scrapedPassages = [];
  if (deepScrape && searchResults.length > 0) {
    const scrapeCandidates = searchResults
      .filter((r) => !r.url.endsWith('.pdf') && !r.url.includes('youtube.com'))
      .slice(0, 2);

    const scraped = await Promise.allSettled(
      scrapeCandidates.map((r) => scrapeWebPage(r.url, 4500))
    );

    scrapedPassages = scraped
      .filter((s) => s.status === 'fulfilled' && s.value.success && s.value.text)
      .map((s) => ({
        url: s.value.url,
        title: s.value.title,
        text: s.value.text.slice(0, 4500),
      }));
  }

  return {
    query: cleanQuery,
    provider: providerUsed,
    results: searchResults,
    directAnswer,
    scrapedPassages,
  };
}
