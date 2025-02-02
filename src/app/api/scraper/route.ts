import { NextResponse } from 'next/server';
import axios from 'axios';
import * as cheerio from 'cheerio';

// Configure the runtime to use edge for better performance
export const runtime = 'edge';

interface SearchResult {
  title: string;
  link: string;
  snippet: string;
}

interface ImageResult {
  title: string;
  imageUrl: string;
  source: string;
}

interface DuckDuckGoImageResult {
  title: string;
  image?: string;
  thumbnail?: string;
  url: string;
}

export async function POST(req: Request) {
  try {
    const { query } = await req.json();
    
    if (!query) {
      return NextResponse.json(
        { error: 'Query parameter is required' },
        { status: 400 }
      );
    }

    // Fetch web search results
    const webResults = await fetchGoogleResults(query);
    
    // Fetch image search results
    const imageResults = await fetchGoogleImageResults(query);

    if (!webResults || webResults.length === 0) {
      return NextResponse.json(
        { error: 'No search results found. Please try a different query.' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      results: webResults.map(result => ({
        title: result.title,
        content: result.snippet,
        url: result.link
      })),
      images: imageResults.map(img => ({
        url: img.imageUrl,
        description: img.title
      }))
    });

  } catch (error) {
    console.error('Scraper error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to fetch search results' },
      { status: 500 }
    );
  }
}

async function fetchGoogleResults(query: string): Promise<SearchResult[]> {
  const duckUrl = `https://html.duckduckgo.com/html/?q=${encodeURIComponent(query)}`;
  
  const headers = {
    'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36',
    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
    'Accept-Language': 'en-US,en;q=0.9',
  };

  try {
    const response = await axios.get(duckUrl, { 
      headers,
      timeout: 10000
    });
    
    console.log('DuckDuckGo response status:', response.status);
    
    const $ = cheerio.load(response.data);
    const results: SearchResult[] = [];

    // Parse DuckDuckGo results
    $('.result').each((i: number, el: cheerio.Element) => {
      const titleEl = $(el).find('.result__title');
      const linkEl = $(el).find('.result__url');
      const snippetEl = $(el).find('.result__snippet');

      if (titleEl.length) {
        const title = titleEl.text().trim();
        const link = linkEl.text().trim();
        const snippet = snippetEl.text().trim();

        if (title && link) {
          results.push({
            title,
            link: link.startsWith('http') ? link : `https://${link}`,
            snippet: snippet || title
          });
        }
      }
    });

    console.log('Found results:', results.length);
    return results;
  } catch (error) {
    console.error('Error fetching DuckDuckGo results:', error);
    return [];
  }
}

async function fetchGoogleImageResults(query: string): Promise<ImageResult[]> {
  try {
    // First, get the vqd token from the main search page
    const searchUrl = `https://duckduckgo.com/?q=${encodeURIComponent(query)}`;
    const headers = {
      'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36',
      'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
      'Accept-Language': 'en-US,en;q=0.9',
    };

    const searchResponse = await axios.get(searchUrl, { headers });
    const vqdMatch = searchResponse.data.match(/vqd="([^"]+)"/);
    const vqd = vqdMatch ? vqdMatch[1] : '';
    
    if (!vqd) {
      console.error('Could not find vqd token');
      return [];
    }

    console.log('Found vqd token:', vqd);

    // Now fetch images using the token
    const imageUrl = `https://duckduckgo.com/i.js?q=${encodeURIComponent(query)}&vqd=${vqd}&f=,,,&p=1`;
    
    const imageResponse = await axios.get(imageUrl, { 
      headers: {
        ...headers,
        'Accept': 'application/json',
        'Referer': 'https://duckduckgo.com/',
      },
      timeout: 10000
    });
    
    console.log('DuckDuckGo image response status:', imageResponse.status);
    
    if (imageResponse.data && Array.isArray(imageResponse.data.results)) {
      const mappedResults = imageResponse.data.results
        .slice(0, 10)
        .map((img: DuckDuckGoImageResult) => ({
          title: img.title || '',
          imageUrl: img.image || img.thumbnail || '',
          source: img.url || ''
        }))
        .filter((img: ImageResult) => img.imageUrl && img.title);
      
      console.log('Found image results:', mappedResults.length);
      return mappedResults;
    }
    
    console.log('No valid image results found in response');
    return [];
  } catch (error) {
    console.error('Error fetching DuckDuckGo image results:', error);
    return [];
  }
} 