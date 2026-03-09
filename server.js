const Parser = require('rss-parser');
const express = require('express');
const fs = require('fs');
const path = require('path');

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

// ── Publishers ──────────────────────────────────────────────
const PUBLISHERS = [
  { name: 'Stonemaier Games',     url: 'https://stonemaiergames.com/feed/',                    logo: '🏆' },
  { name: 'Czech Games Edition',  url: 'https://czechgames.com/en/news/feed/',                 logo: '🎲' },
  { name: 'Cephalofair Games',    url: 'https://cephalofair.com/blogs/blog.atom',              logo: '⚔️' },
  { name: 'GMT Games',            url: 'https://www.gmtgames.com/blogs/news.atom',             logo: '🗺️' },
  { name: 'Renegade Game Studios',url: 'https://renegadegamestudios.com/blog/feed/',          logo: '🎭' },
  { name: 'Leder Games',          url: 'https://ledergames.com/blogs/news.atom',               logo: '🦊' },
  { name: 'Chip Theory Games',    url: 'https://chiptheorygames.com/blog/feed/',               logo: '🎰' },
  { name: 'Capstone Games',       url: 'https://capstone-games.com/blogs/news.atom',          logo: '🏛️' },
  { name: 'Lucky Duck Games',     url: 'https://luckyduckgames.com/blog/feed/',                logo: '🦆' },
  { name: 'Alley Cat Games',      url: 'https://alleycatgames.com/blogs/news.atom',            logo: '🐱' },
  { name: 'Pandasaurus Games',    url: 'https://pandasaurusgames.com/blog/feed/',              logo: '🐼' },
  { name: 'Thunderworks Games',   url: 'https://thunderworksgames.com/blogs/news.atom',        logo: '⚡' },
  { name: 'Horrible Guild',       url: 'https://horribleguild.com/blog/feed/',                 logo: '😈' },
  { name: 'Button Shy Games',     url: 'https://buttonshygames.com/blogs/news.atom',           logo: '🔘' },
  { name: 'Osprey Games',         url: 'https://ospreypublishing.com/blog/feed/',              logo: '🦅' },
  { name: 'Devir Games',          url: 'https://devirgames.com/blog/feed/',                    logo: '🌍' },
  { name: 'Mindclash Games',      url: 'https://mindclashgames.com/news/feed/',                logo: '🧠' },
  { name: 'Earthborne Games',     url: 'https://earthbornegames.com/blog/feed/',               logo: '🌿' },
  { name: 'Awaken Realms',        url: 'https://awakenrealms.com/blog/feed/',                  logo: '🌟' },
  { name: 'Capstone Games',       url: 'https://capstone-games.com/blogs/news.atom',          logo: '🏛️' },
  { name: 'Grey Fox Games',       url: 'https://greyfoxgames.com/blog/feed/',                  logo: '🦊' },
  { name: 'Flatout Games',        url: 'https://flatout.games/blog/feed/',                     logo: '🃏' },
  { name: 'Restoration Games',    url: 'https://restorationgames.com/blog/feed/',              logo: '♻️' },
  { name: 'Bezier Games',         url: 'https://beziergames.com/blogs/news.atom',              logo: '📐' },
  { name: 'Lookout Games',        url: 'https://lookout-spiele.de/en/news/feed/',              logo: '🔭' },
  { name: 'Inside Up Games',      url: 'https://insideupgames.com/blogs/news.atom',            logo: '🔼' },
  { name: 'Alley Cat Games',      url: 'https://alleycatgames.com/blogs/news.atom',            logo: '🐱' },
  { name: 'Pencil First Games',   url: 'https://pencilfirstgames.com/blogs/news.atom',        logo: '✏️' },
  { name: 'Archon Studio',        url: 'https://archon-studio.com/blog/feed/',                 logo: '🏰' },
  { name: 'Big Potato Games',     url: 'https://bigpotato.com/blog/feed/',                    logo: '🥔' },
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

async function scrapePublisher(pub) {
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

// ── In-memory cache ──────────────────────────────────────────
let cache = { lastUpdated: null, articles: [] };

async function runScrape() {
  console.log('🎲 Scraping started:', new Date().toISOString());
  const results = await Promise.allSettled(PUBLISHERS.map(scrapePublisher));
  const articles = results
    .flatMap(r => r.status === 'fulfilled' ? r.value : [])
    .sort((a, b) => new Date(b.date) - new Date(a.date));

  // Deduplicate by link
  const seen = new Set();
  const unique = articles.filter(a => {
    if (seen.has(a.link)) return false;
    seen.add(a.link);
    return true;
  });

  cache = { lastUpdated: new Date().toISOString(), totalArticles: unique.length, articles: unique };
  console.log(`✅ Scraped ${unique.length} articles`);
}

// ── Express API ──────────────────────────────────────────────
const app = express();

// CORS – tillad dit WordPress-site at hente data
app.use((req, res, next) => {
  res.setHeader('Access-Control-Allow-Origin', '*'); // Skift til 'https://braetspillet.dk' for sikkerhed
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
    lastUpdated:    cache.lastUpdated,
    totalArticles:  articles.length,
    articles:       articles.slice(Number(offset), Number(offset) + Number(limit)),
  });
});

app.get('/health', (req, res) => res.json({ ok: true, articles: cache.articles.length, lastUpdated: cache.lastUpdated }));

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server kører på port ${PORT}`));

// ── Scheduler: scrape ved opstart + hver 6. time ────────────
runScrape();
setInterval(runScrape, 6 * 60 * 60 * 1000);
