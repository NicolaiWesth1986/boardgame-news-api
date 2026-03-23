const Parser = require('rss-parser');
const express = require('express');
const cheerio = require('cheerio');
const fetch = require('node-fetch');


// ── RSS Parser ──────────────────────────────────────────────
const rssParser = new Parser({
  customFields: {
    item: [
      ['media:content', 'mediaContent', { keepArray: false }],
      ['media:thumbnail', 'mediaThumbnail'],
      ['enclosure', 'enclosure'],
    ]
  },
  timeout: 10000,
  headers: { 'User-Agent': 'BraetspilletDK/1.0 (+https://braetspillet.dk)' }
});

const FETCH_HEADERS = {
  'User-Agent': 'Mozilla/5.0 (compatible; BraetspilletDK/1.0; +https://braetspillet.dk)',
  'Accept': 'text/html,application/xhtml+xml',
  'Accept-Language': 'en-US,en;q=0.9',
};

// ── Publishers: RSS-baserede ────────────────────────────────
const RSS_PUBLISHERS = [
  { name: 'Stonemaier Games',    url: 'https://stonemaiergames.com/feed/',             logo: '🏆' },
  { name: 'GMT Games',           url: 'https://insidegmt.com/feed/',                  logo: '🗺️' },
  { name: 'Mindclash Games',     url: 'https://mindclashgames.com/news/feed/',         logo: '🧠' },
  { name: 'Earthborne Games',    url: 'https://earthbornegames.com/blog/feed/',        logo: '🌿' },
  { name: 'Horrible Guild',      url: 'https://horribleguild.com/feed/',               logo: '😈' },
  { name: 'Lookout Games',       url: 'https://lookout-spiele.de/feed/',               logo: '🔭' },
  { name: 'Ares Games',          url: 'http://www.aresgames.eu/category/news/feed/',   logo: '⚔️' },
  { name: 'Cephalofair Games',   url: 'https://cephalofair.com/blogs/blog.atom',       logo: '⚔️' },
  { name: 'Leder Games',         url: 'https://ledergames.com/blogs/news.atom',        logo: '🦊' },
  { name: 'Capstone Games',      url: 'https://capstone-games.com/blogs/news.atom',    logo: '🏛️' },
  { name: 'Bezier Games',        url: 'https://beziergames.com/blogs/news.atom',       logo: '📐' },
  { name: 'Thunderworks Games',  url: 'https://thunderworksgames.com/blogs/news.atom', logo: '⚡' },
  { name: 'Lucky Duck Games',    url: 'https://luckyduckgames.com/blogs/news.atom',    logo: '🦆' },
  { name: 'Pandasaurus Games',   url: 'https://pandasaurusgames.com/blogs/news.atom',  logo: '🐼' },
  { name: 'Grey Fox Games',      url: 'https://greyfoxgames.com/blogs/news.atom',      logo: '🦊' },
  { name: 'Chip Theory Games',   url: 'https://chiptheorygames.com/blogs/news.atom',   logo: '🎰' },
  { name: 'Restoration Games', url: 'https://restorationgames.com/feed/', logo: '♻️' },
  { name: 'Days of Wonder',   url: 'https://www.daysofwonder.com/feed/',          logo: '🎡' },
{ name: 'Board Game Wire',  url: 'https://boardgamewire.com/index.php/feed/',    logo: '📰' },
];

// ── Publishers: HTML-scraping ───────────────────────────────
// Hver entry har en scrape-funktion der modtager cheerio $ og returnerer artikler
const HTML_PUBLISHERS = [
  {
    name: 'Czech Games Edition',
    logo: '🎲',
    url: 'https://www.czechgames.com/news',
    scrape: ($) => {
      const articles = [];
      // Webflow CMS cards: .card--news
      $('.card--news').slice(0, 5).each((i, el) => {
        const titleEl = $(el).find('h3, .card__title');
        const linkEl  = $(el).find('a[href^="/news/"]').first();
        const imgEl   = $(el).find('img').first();
        const summaryEl = $(el).find('p').first();

        const title = titleEl.text().trim();
        const href  = linkEl.attr('href');
        const link  = href ? `https://www.czechgames.com${href}` : '';
        const image = imgEl.attr('src') || imgEl.attr('data-src') || null;
        const summary = summaryEl.text().trim();

        if (title && link) {
          articles.push({ title, link, image, summary, date: new Date().toISOString() });
        }
      });
      return articles;
    }
  },
  {
    name: 'Awaken Realms',
    logo: '🌟',
    url: 'https://awakenrealms.com/blogs/news',
    scrape: ($) => {
      const articles = [];
      $('article, .article, .blog-post, .grid__item').slice(0, 5).each((i, el) => {
        const titleEl = $(el).find('h2, h3').first();
        const linkEl  = $(el).find('a').first();
        const imgEl   = $(el).find('img').first();
        const summaryEl = $(el).find('p').first();

        const title = titleEl.text().trim();
        const href  = linkEl.attr('href');
        const link  = href ? (href.startsWith('http') ? href : `https://awakenrealms.com${href}`) : '';
        const image = imgEl.attr('src') || null;
        const summary = summaryEl.text().trim();

        if (title && link) {
          articles.push({ title, link, image, summary, date: new Date().toISOString() });
        }
      });
      return articles;
    }
  },
  {
    name: 'Renegade Game Studios',
    logo: '🎭',
    url: 'https://renegadegamestudios.com/blog/',
    scrape: ($) => {
      const articles = [];
      $('article, .blog-post, [class*="blog"]').slice(0, 5).each((i, el) => {
        const titleEl = $(el).find('h2, h3').first();
        const linkEl  = $(el).find('a').first();
        const imgEl   = $(el).find('img').first();
        const summaryEl = $(el).find('p').first();

        const title = titleEl.text().trim();
        const href  = linkEl.attr('href');
        const link  = href ? (href.startsWith('http') ? href : `https://renegadegamestudios.com${href}`) : '';
        const image = imgEl.attr('src') || null;
        const summary = summaryEl.text().trim();

        if (title && link) {
          articles.push({ title, link, image, summary, date: new Date().toISOString() });
        }
      });
      return articles;
    }
  },
];

// ── Scraper helpers ──────────────────────────────────────────
function extractImage(item) {
  if (item.mediaContent?.$?.url) return item.mediaContent.$.url;
  if (item.mediaThumbnail?.$?.url) return item.mediaThumbnail.$.url;
  if (item.enclosure?.url && item.enclosure?.type?.startsWith('image')) return item.enclosure.url;
  const content = item['content:encoded'] || item.content || item.summary || '';
  const m = content.match(/<img[^>]+src=["']([^"']+)["']/i);
  return m ? m[1] : null;
}

function stripHtml(html) {
  if (!html) return '';
  return html.replace(/<[^>]+>/g, ' ').replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/\s+/g, ' ').trim();
}

// RSS scrape
async function scrapeRSS(pub) {
  try {
    const feed = await rssParser.parseURL(pub.url);
    return feed.items.slice(0, 5).map(item => ({
      title:     item.title || '',
      link:      item.link || item.guid || '',
      summary:   stripHtml(item['content:encoded'] || item.content || item.contentSnippet || '').substring(0, 300),
      image:     extractImage(item),
      date:      item.pubDate || item.isoDate || new Date().toISOString(),
      publisher: pub.name,
      logo:      pub.logo,
    }));
  } catch (e) {
    console.warn(`⚠️  ${pub.name}: ${e.message}`);
    return [];
  }
}

// HTML scrape
async function scrapeHTML(pub) {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 12000);
    const res = await fetch(pub.url, { headers: FETCH_HEADERS, signal: controller.signal });
    clearTimeout(timeout);
    if (!res.ok) throw new Error(`Status code ${res.status}`);
    const html = await res.text();
    const $ = cheerio.load(html);
    const articles = pub.scrape($);
    console.log(`✅ ${pub.name} (HTML): ${articles.length} articles`);
    return articles.map(a => ({
      ...a,
      summary: a.summary.substring(0, 300),
      publisher: pub.name,
      logo: pub.logo,
    }));
  } catch (e) {
    console.warn(`⚠️  ${pub.name} (HTML): ${e.message}`);
    return [];
  }
}

// ── In-memory cache ──────────────────────────────────────────
let cache = { lastUpdated: null, articles: [] };

async function runScrape() {
  console.log('🎲 Scraping started:', new Date().toISOString());

  const [rssResults, htmlResults] = await Promise.all([
    Promise.allSettled(RSS_PUBLISHERS.map(scrapeRSS)),
    Promise.allSettled(HTML_PUBLISHERS.map(scrapeHTML)),
  ]);

  const articles = [
    ...rssResults.flatMap(r => r.status === 'fulfilled' ? r.value : []),
    ...htmlResults.flatMap(r => r.status === 'fulfilled' ? r.value : []),
  ].sort((a, b) => new Date(b.date) - new Date(a.date));

  // Deduplicate by link
  const seen = new Set();
  const unique = articles.filter(a => {
    if (!a.link || seen.has(a.link)) return false;
    seen.add(a.link);
    return true;
  });

  cache = { lastUpdated: new Date().toISOString(), totalArticles: unique.length, articles: unique };
  console.log(`✅ Scraped ${unique.length} articles total`);
}

// ── Express API ──────────────────────────────────────────────
const app = express();

app.use((req, res, next) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET');
  next();
});

app.get('/api/news', (req, res) => {
  const { q, publisher, limit = 60, offset = 0 } = req.query;
  let articles = cache.articles;
  if (publisher) articles = articles.filter(a => a.publisher.toLowerCase().includes(publisher.toLowerCase()));
  if (q) {
    const ql = q.toLowerCase();
    articles = articles.filter(a => a.title.toLowerCase().includes(ql) || a.summary.toLowerCase().includes(ql));
  }
  res.json({
    lastUpdated:   cache.lastUpdated,
    totalArticles: articles.length,
    articles:      articles.slice(Number(offset), Number(offset) + Number(limit)),
  });
});

app.get('/health', (req, res) => res.json({ ok: true, articles: cache.articles.length, lastUpdated: cache.lastUpdated }));

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server kører på port ${PORT}`));

runScrape();
setInterval(runScrape, 6 * 60 * 60 * 1000);
