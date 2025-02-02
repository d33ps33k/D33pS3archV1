import { NextResponse } from 'next/server';

const SERPER_API_KEY = process.env.SERPER_API_KEY;
const SERPER_API_URL = 'https://google.serper.dev/search';

if (!SERPER_API_KEY) {
  throw new Error('SERPER_API_KEY is not set in environment variables');
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

    // First, get web search results
    const webResponse = await fetch(SERPER_API_URL, {
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

    // Then, get image search results
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

    if (!webResponse.ok || !imageResponse.ok) {
      const error = await webResponse.json();
      console.error('Serper API Error Response:', {
        webStatus: webResponse.status,
        imageStatus: imageResponse.status,
        error,
      });
      throw new Error(error.message || `Failed to get response from Serper: ${webResponse.statusText}`);
    }

    const webData = await webResponse.json();
    const imageData = await imageResponse.json();
    
    if (!webData.organic || !Array.isArray(webData.organic)) {
      console.error('Invalid Serper API response format:', webData);
      throw new Error('Invalid response format from Serper API');
    }

    // Transform Serper response to match our SearchResult interface
    const results = webData.organic.map((result: any) => ({
      title: result.title || 'Untitled',
      content: result.snippet || result.description || '',
      url: result.link,
      snippet: result.snippet || result.description || ''
    }));

    // Transform image results
    const images = imageData.images?.map((image: any) => ({
      url: image.imageUrl,
      description: image.title || ''
    })) || [];

    // Get answer from knowledge graph or answer box
    const answer = webData.answerBox?.answer || 
                  webData.knowledgeGraph?.description ||
                  webData.answerBox?.snippet ||
                  '';

    // Combine results with images
    const resultsWithImages = results.map((result: any, index: number) => ({
      ...result,
      image: images[index] || null
    }));

    return NextResponse.json({ 
      results: resultsWithImages,
      images,
      answer
    });
  } catch (error) {
    console.error('Serper API Error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to process request' },
      { status: 500 }
    );
  }
} 