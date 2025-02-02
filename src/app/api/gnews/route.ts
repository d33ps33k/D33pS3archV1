import { NextResponse } from 'next/server';

const SERPER_API_KEY = process.env.SERPER_API_KEY;
const SERPER_NEWS_API_URL = 'https://google.serper.dev/news';

if (!SERPER_API_KEY) {
  throw new Error('SERPER_API_KEY is not set in environment variables');
}

// Configure the runtime to use edge for better performance
export const runtime = 'edge';

export async function POST(req: Request) {
  try {
    const { query } = await req.json();
    
    if (!query) {
      return NextResponse.json(
        { error: 'Query parameter is required' },
        { status: 400 }
      );
    }

    // Fetch news results
    const newsResponse = await fetch(SERPER_NEWS_API_URL, {
      method: 'POST',
      headers: {
        'X-API-KEY': SERPER_API_KEY as string,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        q: query,
        num: 10,
        gl: 'us',
        hl: 'en',
      })
    });

    // Also fetch images to maintain consistency with other search types
    const imageResponse = await fetch('https://google.serper.dev/images', {
      method: 'POST',
      headers: {
        'X-API-KEY': SERPER_API_KEY as string,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        q: query,
        num: 10,
        gl: 'us',
        hl: 'en',
      })
    });

    if (!newsResponse.ok || !imageResponse.ok) {
      const error = await newsResponse.json();
      console.error('Serper API Error Response:', {
        newsStatus: newsResponse.status,
        imageStatus: imageResponse.status,
        error,
      });
      throw new Error(error.message || `Failed to get response from Serper: ${newsResponse.statusText}`);
    }

    const newsData = await newsResponse.json();
    const imageData = await imageResponse.json();

    if (!newsData.news || !Array.isArray(newsData.news)) {
      console.error('Invalid Serper API response format:', newsData);
      throw new Error('Invalid response format from Serper API');
    }

    // Transform news results to match our SearchResult interface
    const results = newsData.news.map((result: any) => ({
      title: result.title || 'Untitled',
      content: result.snippet || result.description || '',
      url: result.link,
      snippet: result.snippet || result.description || '',
      date: result.date || '',
      source: result.source || ''
    }));

    // Transform image results
    const images = imageData.images?.map((image: any) => ({
      url: image.imageUrl,
      description: image.title || ''
    })) || [];

    // Combine results with images
    const resultsWithImages = results.map((result: any, index: number) => ({
      ...result,
      image: images[index] || null
    }));

    return NextResponse.json({ 
      results: resultsWithImages,
      images
    });

  } catch (error) {
    console.error('Serper News API Error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to process request' },
      { status: 500 }
    );
  }
} 