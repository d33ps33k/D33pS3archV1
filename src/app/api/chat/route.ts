import { NextResponse } from 'next/server';

const DEEPSEEK_API_KEY = process.env.DEEPSEEK_API_KEY;
const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
const GROQ_API_KEY = process.env.GROQ_API_KEY;
const DEEPSEEK_API_URL = 'https://api.deepseek.com/chat/completions';
const OPENAI_API_URL = 'https://api.openai.com/v1/chat/completions';
const GROQ_API_URL = 'https://api.groq.com/openai/v1/chat/completions';

if (!DEEPSEEK_API_KEY && !OPENAI_API_KEY && !GROQ_API_KEY) {
  throw new Error('No API keys set in environment variables');
}

// Set response timeout to 60 seconds
export const maxDuration = 60;

// Configure the runtime to use edge for better streaming support
export const runtime = 'edge';
export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
  try {
    const { messages, model = 'deepseek-reasoner' } = await req.json();
    
    // Determine which API to use based on the model
    const isOpenAI = model.startsWith('gpt-');
    const isGroq = model.includes('deepseek-r1');
    const apiUrl = isOpenAI ? OPENAI_API_URL : (isGroq ? GROQ_API_URL : DEEPSEEK_API_URL);
    const apiKey = isOpenAI ? OPENAI_API_KEY : (isGroq ? GROQ_API_KEY : DEEPSEEK_API_KEY);
    
    if (!apiKey) {
      throw new Error(`API key not found for ${isOpenAI ? 'OpenAI' : (isGroq ? 'Groq' : 'DeepSeek')}`);
    }

    const apiRequestBody = {
      model: model,
      messages: messages,
      temperature: 0.7,
      stream: true,
      ...(isGroq ? { max_tokens: 8000 } : {})
    };

    const response = await fetch(apiUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
      },
      body: JSON.stringify(apiRequestBody),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.message || `Failed to get response from ${isOpenAI ? 'OpenAI' : (isGroq ? 'Groq' : 'DeepSeek')}`);
    }

    if (!response.body) {
      throw new Error('No response body available');
    }

    const reader = response.body.getReader();
    const encoder = new TextEncoder();
    const decoder = new TextDecoder();

    let buffer = '';

    const stream = new ReadableStream({
      async start(controller) {
        try {
          while (true) {
            const { done, value } = await reader.read();
            
            if (done) {
              if (buffer.trim()) {
                try {
                  const parsed = JSON.parse(buffer);
                  controller.enqueue(encoder.encode(JSON.stringify(parsed) + '\n'));
                } catch (e) {
                  console.error('Error parsing final buffer:', e);
                }
              }
              controller.close();
              break;
            }

            buffer += decoder.decode(value, { stream: true });
            const lines = buffer.split('\n');
            
            buffer = lines.pop() || '';

            for (const line of lines) {
              const trimmedLine = line.trim();
              if (!trimmedLine || 
                  trimmedLine === 'data: [DONE]' || 
                  trimmedLine === ': keep-alive') continue;

              try {
                let data = trimmedLine;
                if (trimmedLine.startsWith('data: ')) {
                  data = trimmedLine.slice(6);
                }

                const parsed = JSON.parse(data);
                const chunk = {
                  id: parsed.id,
                  choices: [{
                    delta: {
                      content: parsed.choices?.[0]?.delta?.content || '',
                      ...(model === 'deepseek-reasoner' || model === 'deepseek-r1-distill-llama-70b' ? {
                        reasoning_content: parsed.choices?.[0]?.delta?.content.startsWith('<think>') ? parsed.choices?.[0]?.delta?.content : '',
                        content: parsed.choices?.[0]?.delta?.content.startsWith('<think>') ? '' : parsed.choices?.[0]?.delta?.content
                      } : {})
                    }
                  }]
                };
                controller.enqueue(encoder.encode(JSON.stringify(chunk) + '\n'));
              } catch (e) {
                console.error('Error parsing JSON line:', e);
                console.error('Problematic line:', trimmedLine);
              }
            }
          }
        } catch (error) {
          console.error('Error in stream processing:', error);
          controller.error(error);
        }
      }
    });

    return new Response(stream, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
      },
    });
  } catch (error: any) {
    console.error('Error in chat route:', error);
    return new Response(JSON.stringify({ error: error.message || 'Unknown error occurred' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
} 