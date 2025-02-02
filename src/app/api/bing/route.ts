import { NextResponse } from 'next/server';

if (!process.env.BING_API_KEY) {
  throw new Error('BING_API_KEY environment variable is not set');
}

const BING_API_KEY = process.env.BING_API_KEY;
const BING_WEB_API_URL = 'https://api.bing.microsoft.com/v7.0/search';
const BING_VIDEO_API_URL = 'https://api.bing.microsoft.com/v7.0/videos/search';
const BING_IMAGE_API_URL = 'https://api.bing.microsoft.com/v7.0/images/search';

interface VideoResult {
  title: string;
  content: string;
  url: string;
  image: {
    url: string;
    description: string;
  };
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

    // Fetch web search results (first 5)
    const webResponse = await fetch(`${BING_WEB_API_URL}?q=${encodeURIComponent(query)}&count=5`, {
      headers: {
        'Ocp-Apim-Subscription-Key': BING_API_KEY,
        'Accept': 'application/json'
      }
    });

    // Fetch image search results (5 images)
    const imageResponse = await fetch(`${BING_IMAGE_API_URL}?q=${encodeURIComponent(query)}&count=5`, {
      headers: {
        'Ocp-Apim-Subscription-Key': BING_API_KEY,
        'Accept': 'application/json'
      }
    });

    // Fetch video search results (5 videos)
    const videoResponse = await fetch(`${BING_VIDEO_API_URL}?q=${encodeURIComponent(query)}&count=5&pricing=Free&embedded=player`, {
      headers: {
        'Ocp-Apim-Subscription-Key': BING_API_KEY,
        'Accept': 'application/json'
      }
    });

    if (!webResponse.ok || !videoResponse.ok || !imageResponse.ok) {
      throw new Error('Failed to fetch results from Bing API');
    }

    const webData = await webResponse.json();
    const imageData = await imageResponse.json();
    const videoData = await videoResponse.json();

    // Combine and format results
    const webResults = webData.webPages?.value?.map((result: any, index: number) => ({
      title: result.name,
      content: result.snippet,
      url: result.url,
      image: imageData.value?.[index] ? {
        url: imageData.value[index].thumbnailUrl,
        description: imageData.value[index].name
      } : undefined
    })) || [];

    const videoResults = videoData.value?.map((video: any) => {
      // Get the best available thumbnail URL - prefer motion thumbnail if available
      const thumbnailUrl = video.thumbnailUrl || video.motionThumbnailUrl;
      
      // Log the raw video data for debugging
      console.log('Raw video data:', {
        name: video.name,
        thumbnailUrl: video.thumbnailUrl,
        motionThumbnailUrl: video.motionThumbnailUrl
      });

      // Only include videos that have a valid thumbnail
      if (!thumbnailUrl) {
        console.log('Skipping video due to missing thumbnail:', video.name);
        return null;
      }

      return {
        title: video.name,
        content: video.description || video.name,
        url: video.contentUrl || video.hostPageUrl,
        image: {
          url: thumbnailUrl,
          description: video.name
        }
      };
    }).filter(Boolean) || [];

    // Log processed video results for debugging
    console.log('Processed video results:', JSON.stringify(videoResults, null, 2));

    // Combine web and video results
    const combinedResults = [...webResults, ...videoResults];

    if (!combinedResults.length) {
      return NextResponse.json(
        { error: 'No search results found. Please try a different query.' },
        { status: 404 }
      );
    }

    // Get all images from both web and video results
    const images = [
      ...webResults.filter((result: any) => result.image?.url).map((result: any) => ({
        url: result.image.url,
        description: result.image.description
      })),
      ...videoResults.filter((result: any) => result.image?.url).map((result: any) => ({
        url: result.image.url,
        description: result.image.description
      }))
    ];

    // Log the final images array for debugging
    console.log('Final images array:', JSON.stringify(images, null, 2));

    return NextResponse.json({
      results: combinedResults,
      images
    });

  } catch (error) {
    console.error('Bing API Error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to fetch search results' },
      { status: 500 }
    );
  }
} 