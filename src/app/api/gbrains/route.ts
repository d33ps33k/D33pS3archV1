import { NextResponse } from 'next/server';

const SERPER_API_KEY = process.env.SERPER_API_KEY;
const SERPER_SCHOLAR_API_URL = 'https://google.serper.dev/scholar';

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

    // Fetch scholar results
    const scholarResponse = await fetch(SERPER_SCHOLAR_API_URL, {
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

    if (!scholarResponse.ok || !imageResponse.ok) {
      const error = await scholarResponse.json();
      console.error('Serper API Error Response:', {
        scholarStatus: scholarResponse.status,
        imageStatus: imageResponse.status,
        error,
      });
      throw new Error(error.message || `Failed to get response from Serper: ${scholarResponse.statusText}`);
    }

    const scholarData = await scholarResponse.json();
    const imageData = await imageResponse.json();

    if (!scholarData.organic || !Array.isArray(scholarData.organic)) {
      console.error('Invalid Serper API response format:', scholarData);
      throw new Error('Invalid response format from Serper API');
    }

    // Transform scholar results to match our SearchResult interface
    const results = scholarData.organic.map((result: any) => ({
      title: result.title || 'Untitled',
      content: result.snippet || result.description || '',
      url: result.link,
      snippet: result.snippet || result.description || '',
      date: result.publicationDate || '',
      source: result.source || '',
      citations: result.citations || 0,
      authors: result.authors || []
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
    console.error('Serper Scholar API Error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to process request' },
      { status: 500 }
    );
  }
} 