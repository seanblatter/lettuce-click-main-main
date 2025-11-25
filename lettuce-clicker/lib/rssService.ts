import AsyncStorage from '@react-native-async-storage/async-storage';

export interface RSSFeedItem {
  id: string;
  title: string;
  description: string;
  link: string;
  pubDate: string;
  source: string;
  category?: string;
}

export interface RSSFeed {
  id: string;
  name: string;
  url: string;
  category: string;
  enabled: boolean;
  items?: RSSFeedItem[]; // Store items directly for instant access
}

export interface RSSCache {
  [feedId: string]: {
    items: RSSFeedItem[];
    lastUpdated: number;
  };
}

// Cache settings
const CACHE_DURATION = 24 * 60 * 60 * 1000; // 24 hours in milliseconds
const RSS_CACHE_KEY = '@lettuce_rss_cache';
const RSS_LAST_UPDATE_KEY = '@lettuce_rss_last_update';

class DynamicRSSService {

  /**
   * Check if cache needs refresh (daily update)
   */
  private async shouldRefreshCache(): Promise<boolean> {
    try {
      const lastUpdate = await AsyncStorage.getItem(RSS_LAST_UPDATE_KEY);
      if (!lastUpdate) return true;
      
      const timeSinceUpdate = Date.now() - parseInt(lastUpdate);
      return timeSinceUpdate > CACHE_DURATION;
    } catch (error) {
      console.warn('Error checking cache timestamp:', error);
      return true;
    }
  }

  /**
   * Parse RSS XML to extract articles
   */
  private parseRSSXML(xmlText: string, feedSource: string): RSSFeedItem[] {
    const items: RSSFeedItem[] = [];
    
    // Simple regex-based RSS parsing (for demo - in production use proper XML parser)
    const itemRegex = /<item[^>]*>(.*?)<\/item>/gs;
    const titleRegex = /<title[^>]*><!\[CDATA\[(.*?)\]\]><\/title>|<title[^>]*>(.*?)<\/title>/s;
    const linkRegex = /<link[^>]*>(.*?)<\/link>/s;
    const descRegex = /<description[^>]*><!\[CDATA\[(.*?)\]\]><\/description>|<description[^>]*>(.*?)<\/description>/s;
    const dateRegex = /<pubDate[^>]*>(.*?)<\/pubDate>/s;
    
    let match;
    let itemCount = 0;
    
    while ((match = itemRegex.exec(xmlText)) !== null && itemCount < 5) {
      const itemXml = match[1];
      
      const titleMatch = titleRegex.exec(itemXml);
      const linkMatch = linkRegex.exec(itemXml);
      const descMatch = descRegex.exec(itemXml);
      const dateMatch = dateRegex.exec(itemXml);
      
      const title = (titleMatch?.[1] || titleMatch?.[2] || 'Untitled').trim();
      const link = linkMatch?.[1]?.trim() || '';
      const description = (descMatch?.[1] || descMatch?.[2] || '').trim();
      const pubDate = dateMatch?.[1] || new Date().toISOString();
      
      if (title && link) {
        items.push({
          id: `${feedSource}-${itemCount}-${Date.now()}`,
          title: this.cleanText(title),
          description: this.cleanText(description).slice(0, 200),
          link: link,
          pubDate: pubDate,
          source: feedSource,
          category: 'News'
        });
        itemCount++;
      }
    }
    
    console.log(`📰 Parsed ${items.length} articles from ${feedSource}`);
    return items;
  }

  /**
   * Clean HTML entities and tags from text
   */
  private cleanText(text: string): string {
    return text
      .replace(/<[^>]*>/g, '') // Remove HTML tags
      .replace(/&quot;/g, '"')
      .replace(/&amp;/g, '&')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&#x27;/g, "'")
      .replace(/&#x2F;/g, '/')
      .trim();
  }

  /**
   * Fetch fresh RSS content from URL
   */
  async fetchFeed(feed: RSSFeed): Promise<RSSFeedItem[]> {
    if (!feed.enabled) {
      return [];
    }

    const startTime = Date.now();
    
    try {
      // Check cache first
      const shouldRefresh = await this.shouldRefreshCache();
      
      if (!shouldRefresh) {
        // Try to load from cache
        const cached = await this.getCachedItems(feed.id);
        if (cached.length > 0) {
          const loadTime = Date.now() - startTime;
          console.log(`📱 Cache hit for ${feed.name}: ${cached.length} items in ${loadTime}ms`);
          return cached;
        }
      }

      console.log(`🔄 Fetching fresh content from ${feed.name}...`);
      
      // Fetch fresh content with timeout
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 10000); // 10 second timeout
      
      const response = await fetch(feed.url, {
        method: 'GET',
        headers: {
          'Accept': 'application/xml, text/xml, application/rss+xml',
          'User-Agent': 'LettuceClicker/1.0'
        },
        signal: controller.signal
      });
      
      clearTimeout(timeoutId);

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const xmlText = await response.text();
      const items = this.parseRSSXML(xmlText, feed.name);

      // Cache the results
      await this.cacheItems(feed.id, items);
      await AsyncStorage.setItem(RSS_LAST_UPDATE_KEY, Date.now().toString());

      const loadTime = Date.now() - startTime;
      console.log(`🆕 Fresh ${feed.name}: ${items.length} items in ${loadTime}ms`);
      
      return items;
      
    } catch (error) {
      console.warn(`❌ RSS fetch error for ${feed.name}:`, error instanceof Error ? error.message : error);
      
      // Fallback to cache if network fails
      try {
        const cached = await this.getCachedItems(feed.id);
        if (cached.length > 0) {
          console.log(`📱 Network failed, using cached ${feed.name}: ${cached.length} items`);
          return cached;
        }
      } catch (cacheError) {
        console.warn(`❌ Cache fallback failed for ${feed.name}:`, cacheError);
      }
      
      console.warn(`⚠️ No items available for ${feed.name}, returning empty array`);
      return [];
    }
  }

  /**
   * Get RSS items from multiple feeds - fetches fresh daily content!
   */
  async fetchMultipleFeeds(feeds: RSSFeed[]): Promise<RSSFeedItem[]> {
    const startTime = Date.now();
    
    const enabledFeeds = feeds.filter(feed => feed.enabled);
    
    if (enabledFeeds.length === 0) {
      return [];
    }

    // Fetch from all enabled feeds
    const feedPromises = enabledFeeds.map(feed => this.fetchFeed(feed));
    const feedResults = await Promise.allSettled(feedPromises);
    console.log(`✅ All feed promises settled, processing results...`);

    const allItems: RSSFeedItem[] = [];
    
    feedResults.forEach((result, index) => {
      if (result.status === 'fulfilled') {
        console.log(`✅ ${enabledFeeds[index].name}: ${result.value.length} items`);
        allItems.push(...result.value);
      } else {
        console.warn(`❌ Failed to fetch ${enabledFeeds[index].name}:`, result.reason);
      }
    });

    // Sort by date (newest first)
    allItems.sort((a, b) => {
      const dateA = new Date(a.pubDate).getTime();
      const dateB = new Date(b.pubDate).getTime();
      return dateB - dateA;
    });

    // Only log occasionally for performance monitoring
    const loadTime = Date.now() - startTime;
    if (loadTime > 1000 || allItems.length > 50) {
      console.log(`🆕 RSS: Loaded ${allItems.length} items from ${enabledFeeds.length} feeds in ${loadTime}ms`);
    }

    return allItems.slice(0, 20);
  }

  /**
   * Get available feeds for configuration
   */
  getDefaultFeeds(): RSSFeed[] {
    return [];
  }

  /**
   * Add a custom feed (for future expansion)
   */
  addCustomFeed(feed: RSSFeed): void {
    // DEFAULT_RSS_FEEDS.push(feed);
  }

  /**
   * Update feed items (for future real RSS integration)
   */
  updateFeedItems(feedId: string, items: RSSFeedItem[]): void {
    // const feed = DEFAULT_RSS_FEEDS.find(f => f.id === feedId);
    // if (feed) {
    //   feed.items = items;
    // }
  }

  /**
   * Legacy compatibility - no longer needed but kept for compatibility
   */
  clearFeedCache(feedId: string): void {
    // No cache to clear in instant mode
  }

  /**
   * Clear all cache (no-op in instant mode)
   */
  clearAllCache(): void {
    // No cache to clear in instant mode  
  }

  /**
   * Cache RSS items
   */
  private async cacheItems(feedId: string, items: RSSFeedItem[]): Promise<void> {
    try {
      const cacheKey = `${RSS_CACHE_KEY}_${feedId}`;
      await AsyncStorage.setItem(cacheKey, JSON.stringify(items));
    } catch (error) {
      console.warn('Failed to cache RSS items:', error);
    }
  }

  /**
   * Get cached items
   */
  async getCachedItems(feedId: string): Promise<RSSFeedItem[]> {
    try {
      const cacheKey = `${RSS_CACHE_KEY}_${feedId}`;
      const cached = await AsyncStorage.getItem(cacheKey);
      return cached ? JSON.parse(cached) : [];
    } catch (error) {
      console.warn('Failed to load cached items:', error);
      return [];
    }
  }
}

export const rssService = new DynamicRSSService();