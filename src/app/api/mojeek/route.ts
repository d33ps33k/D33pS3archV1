import { NextResponse } from 'next/server';

const MOJEEK_API_KEY = process.env.MOJEEK_API_KEY;
const MOJEEK_API_URL = 'https://api.mojeek.com/search';

if (!MOJEEK_API_KEY) {
  throw new Error('MOJEEK_API_KEY is not set in environment variables');
}

interface MojeekImage {
  url: string;
  width?: number;
  height?: number;
}

interface MojeekResult {
  title: string;
  desc?: string;
  url: string;
  image?: MojeekImage;
  timestamp?: number;
  date?: string;
  size?: string;
}

interface MojeekResponse {
  response: {
    status: string;
    head: {
      query: string;
      timer: number;
      results: number;
      start: number;
      return: number;
    };
    results: MojeekResult[];
  };
}

interface SearchResult {
  title: string;
  content: string;
  url: string;
  snippet: string;
  image?: {
    url: string;
    description: string;
  } | null;
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

    const requestUrl = `${MOJEEK_API_URL}?api_key=${MOJEEK_API_KEY}&q=${encodeURIComponent(query)}&t=20&fmt=json`;
    console.log('Searching Mojeek for:', query);

    try {
      // Fetch search results from Mojeek
      const searchResponse = await fetch(requestUrl, {
        method: 'GET',
        headers: {
          'Accept': 'application/json'
        }
      });

      const rawData = await searchResponse.text();
      // Removed logging of raw response to protect sensitive information
      
      if (!searchResponse.ok) {
        console.error('Mojeek API Error:', {
          status: searchResponse.status,
          statusText: searchResponse.statusText
        });
        throw new Error('Failed to fetch search results');
      }

      let searchData: any;
      try {
        searchData = JSON.parse(rawData);
        console.log('Parsed Mojeek Response Structure:', {
          hasResponse: !!searchData.response,
          hasResults: !!searchData.response?.results,
          resultsLength: searchData.response?.results?.length,
          firstResult: {
            title: searchData.response?.results?.[0]?.title,
            url: searchData.response?.results?.[0]?.url
          }
        });

        // Check for API key balance issues
        if (searchData.response?.status?.toLowerCase().includes('access denied')) {
          throw new Error('Search service temporarily unavailable');
        }

      } catch (e) {
        console.error('Failed to parse response');
        throw new Error('Failed to process search results');
      }
      
      // Check if we have results in the expected structure
      const mojeekResults = searchData.response?.results;
      if (!mojeekResults || !Array.isArray(mojeekResults) || mojeekResults.length === 0) {
        console.error('No results found in Mojeek response:', searchData);
        throw new Error(`No search results found. Response structure: ${JSON.stringify(searchData)}`);
      }

      // Transform Mojeek response to match our SearchResult interface
      const transformedResults = mojeekResults.map((result: MojeekResult): SearchResult => ({
        title: result.title || 'Untitled',
        content: result.desc || '',
        url: result.url,
        snippet: result.desc || '',
        image: result.image ? {
          url: result.image.url,
          description: result.title || 'Search result image'
        } : null
      }));

      console.log('Transformed Results:', {
        count: transformedResults.length,
        firstResult: transformedResults[0]
      });

      // Extract images from results that have images
      const extractedImages = transformedResults
        .filter((result: SearchResult) => result.image)
        .map((result: SearchResult) => result.image);

      // Return in the format expected by the frontend
      const responseData = {
        results: transformedResults,
        images: extractedImages,
        organic: transformedResults,
        metadata: {
          timer: searchData.response.head?.timer,
          totalResults: searchData.response.head?.results
        }
      };

      console.log('Final Response Structure:', {
        hasResults: Array.isArray(responseData.results),
        resultCount: responseData.results.length,
        imageCount: responseData.images.length
      });

      return NextResponse.json(responseData);

    } catch (error) {
      console.error('Mojeek API Error:', error);
      return NextResponse.json(
        { error: error instanceof Error ? error.message : 'Failed to fetch search results' },
        { status: 500 }
      );
    }
  } catch (error) {
    console.error('Mojeek API Error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to fetch search results' },
      { status: 500 }
    );
  }
} 