'use client';

import dynamic from 'next/dynamic';
import { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import React from 'react';
import remarkGfm from 'remark-gfm';
import rehypeRaw from 'rehype-raw';

// Dynamic import of ReactMarkdown only
const ReactMarkdown = dynamic(() => import('react-markdown'), {
  ssr: false,
  loading: () => <div className="animate-pulse bg-gray-100 h-40 rounded-lg"></div>
});

interface SearchEngineConfig {
  name: string;
  apiRoute: string;
  label: string;
}

interface DeepSeekModelConfig {
  name: string;
  label: string;
  hasReasoning: boolean;
}

interface Message {
  role: 'user' | 'assistant';
  content: string;
  reasoning?: string;
  searchResults?: SearchResult[];
  fullSearchData?: any;
  reasoningInput?: string;
}

interface ImageType {
  url: string;
  description?: string;
}

interface SearchResult {
  title: string;
  content: string;
  url: string;
  snippet?: string;
  score?: number;
  image?: ImageType;
}

interface ChatSection {
  query: string;
  searchResults: SearchResult[];
  reasoning: string;
  response: string;
  error?: string | null;
  isLoadingSources?: boolean;
  isLoadingThinking?: boolean;
  isReasoningCollapsed?: boolean;
  reasoningInput: string;
}

// Add this before the TopBar component
const ImageComponent = React.memo(({ src, alt }: { src: string; alt: string }) => {
  if (!src || !src.startsWith('http')) {
    return null;
  }

  return (
    <div className="relative mb-6 w-full md:float-right md:ml-6 md:max-w-sm lg:max-w-md rounded-lg overflow-hidden bg-white shadow-md">
      <div className="aspect-w-16 aspect-h-9 bg-gray-100">
        <img
          src={src}
          alt={alt}
          className="w-full h-full object-cover"
          loading="lazy"
          onError={(e) => {
            const target = e.target as HTMLImageElement;
            target.parentElement?.parentElement?.classList.add('hidden');
          }}
        />
      </div>
      {alt && (
        <div className="p-3 text-sm text-gray-600 border-t border-gray-100 bg-gray-50">
          {alt}
        </div>
      )}
    </div>
  );
});

ImageComponent.displayName = 'ImageComponent';

// Add TopBar component
const TopBar = () => {
  const [isZoomed, setIsZoomed] = useState(false);
  const [isZoomingFull, setIsZoomingFull] = useState(false);
  const pressTimer = useRef<NodeJS.Timeout>();
  const [hasSubmitted, setHasSubmitted] = useState(false);

  const handleMouseDown = () => {
    setIsZoomed(true);
    pressTimer.current = setTimeout(() => {
      setIsZoomingFull(true);
      setTimeout(() => {
        window.location.reload();
      }, 1000);
    }, 1000);
  };

  const handleMouseUp = () => {
    if (pressTimer.current) {
      clearTimeout(pressTimer.current);
    }
    if (!isZoomingFull) {
      setIsZoomed(false);
    }
  };

  const handleMouseLeave = () => {
    if (pressTimer.current) {
      clearTimeout(pressTimer.current);
    }
    if (!isZoomingFull) {
      setIsZoomed(false);
    }
  };

  return (
    <div className="fixed top-0 left-0 right-0 h-16 bg-white border-b border-gray-200 flex items-center px-6 z-50">
      <div className="dancing-blu3 mr-8">
        <img 
          src="/blu3.png" 
          alt="blu3" 
          className={`w-8 h-8 ${isZoomed ? 'zoomed' : ''} ${isZoomingFull ? 'zooming-full' : ''}`}
          onMouseDown={handleMouseDown}
          onMouseUp={handleMouseUp}
          onMouseLeave={handleMouseLeave}
          onTouchStart={handleMouseDown}
          onTouchEnd={handleMouseUp}
        />
      </div>
      <a 
        href="https://www.d33ps33k.com" 
        className="text-2xl font-serif text-gray-900 tracking-tight hover:text-gray-900 no-underline"
      >
        D33pS33k
      </a>
    </div>
  );
};

// MainContent component with proper client-side handling
const MainContent = dynamic(() => Promise.resolve(({ children }: { children: React.ReactNode }) => (
  <div className="container mx-auto px-4 pt-24 pb-16">
    {children}
  </div>
)), { ssr: false });

export default function Home() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [lastQuery, setLastQuery] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [currentReasoning, setCurrentReasoning] = useState('');
  const [searchStatus, setSearchStatus] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [currentSearchResults, setCurrentSearchResults] = useState<SearchResult[]>([]);
  const [showSearchModal, setShowSearchModal] = useState(false);
  const [showReasoningModal, setShowReasoningModal] = useState(false);
  const [selectedMessageData, setSelectedMessageData] = useState<{searchData?: any, reasoning?: string}>({});
  const [hasSubmitted, setHasSubmitted] = useState(false);
  const abortControllerRef = useRef<AbortController | null>(null);
  const [chatSections, setChatSections] = useState<ChatSection[]>([]);
  const [selectedEngine, setSelectedEngine] = useState<string>('serper');
  const [selectedModel, setSelectedModel] = useState<string>('gpt-4o-mini');
  
  const searchEngines: SearchEngineConfig[] = [
    ...(process.env.NEXT_PUBLIC_ENABLE_DUCKDUCKGO === 'true' ? [
      { name: 'scraper', apiRoute: '/api/scraper', label: 'Go Quack' }
    ] : []),
    { name: 'serper', apiRoute: '/api/serper', label: 'Googler' },
    { name: 'bing', apiRoute: '/api/bing', label: 'Binger' },
    { name: 'gnews', apiRoute: '/api/gnews', label: 'GNews' },
    { name: 'gbrains', apiRoute: '/api/gbrains', label: 'GBrains' },
    { name: 'mojeek', apiRoute: '/api/mojeek', label: 'Jeeker' }
  ];

  const deepseekModels: DeepSeekModelConfig[] = [
    { name: 'deepseek-chat', label: 'DpSk Chat', hasReasoning: false },
    { name: 'deepseek-reasoner', label: 'DpSk Reasoner', hasReasoning: true },
    { name: 'gpt-4o-mini', label: 'GPT 4o Mini', hasReasoning: false },
    { name: 'deepseek-r1-distill-llama-70b', label: 'Groq Reasoner', hasReasoning: true }
  ];

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || isLoading) return;

    setHasSubmitted(true);
    setLastQuery(input);
    setError(null);
    setCurrentSearchResults([]);
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    abortControllerRef.current = new AbortController();

    const userMessage = { role: 'user' as const, content: input };
    setMessages(prev => [...prev, userMessage]);
    setInput('');
    setIsLoading(true);
    setCurrentReasoning('');

    // Create a new chat section with loading states
    const newSection: ChatSection = {
      query: input,
      searchResults: [],
      reasoning: '',
      response: '',
      error: null,
      isLoadingSources: true,
      isLoadingThinking: false,
      reasoningInput: ''
    };
    setChatSections(prev => [...prev, newSection]);
    const sectionIndex = chatSections.length;

    try {
      // Step 1: Search with selected engine
      const selectedEngineConfig = searchEngines.find(engine => engine.name === selectedEngine);
      const searchResponse = await fetch(selectedEngineConfig?.apiRoute || '/api/serper', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          query: input,
          includeImages: true,
          includeImageDescriptions: true
        }),
        signal: abortControllerRef.current.signal,
      });

      const searchData = await searchResponse.json();
      
      if (!searchResponse.ok) {
        throw new Error(searchData.error || 'Failed to fetch search results');
      }

      if (!searchData.results || searchData.results.length === 0) {
        throw new Error('No relevant search results found. Please try a different query.');
      }

      // Combine images with results
      const resultsWithImages = searchData.results.map((result: SearchResult, index: number) => ({
        ...result,
        image: searchData.images?.[index]
      }));

      // Update section with search results and start thinking
      setChatSections(prev => {
        const updated = [...prev];
        updated[sectionIndex] = {
          ...updated[sectionIndex],
          searchResults: resultsWithImages,
          isLoadingSources: false,
          isLoadingThinking: true,
          reasoningInput: reasoningInput
        };
        return updated;
      });

      // Step 2: Format search results for DeepSeek
      const searchContext = resultsWithImages
        .map((result: SearchResult, index: number) => 
          `[Source ${index + 1}]: ${result.title}\n${result.content}\nURL: ${result.url}\n`
        )
        .join('\n\n');

      const directAnswer = searchData.answer 
        ? `\nDirect Answer: ${searchData.answer}\n\n` 
        : '';

      // Add sources table at the end
      const sourcesTable = `\n\n<div style="clear: both"></div>\n## Sources\n\n| Number | Source | Description |\n|:---------|:---------|:-------------|\n` +
        resultsWithImages.map((result: SearchResult, index: number) => 
          `| ${index + 1} | [${result.title}](${result.url}) | ${result.snippet || result.content.slice(0, 150)}${result.content.length > 150 ? '...' : ''} |`
        ).join('\n') + '\n';

      const localTime = new Date().toLocaleString('en-US', { 
        dateStyle: 'full',
        timeStyle: 'long'
      });

      const utcTime = new Date().toLocaleString('en-US', {
        timeZone: 'UTC',
        dateStyle: 'full',
        timeStyle: 'long'
      });

      const reasoningInput = `Search performed on:
Local Time: ${localTime}
UTC: ${utcTime}

Here is the research data:${directAnswer}\n${searchContext}

Please analyze this information and create a detailed report addressing the original query: "${input}". Include citations to the sources where appropriate.

Available Images from Search Results:
${resultsWithImages
  .filter((result: SearchResult) => result.image?.url)
  .map((result: SearchResult, index: number) => `[Image ${index + 1}]: ${result.image?.url} - From source: ${result.title}`)
  .join('\n')}

Formatting Guidelines:
1. Structure:
   - Use H1 (#) for main titles
   - Use H2 (##) for major sections
   - Use H3 (###) for subsections
   - Break content into clear, logical sections

2. Text Styling:
   - Use **bold** for emphasis on key points
   - Use *italic* for definitions or subtle emphasis
   - Use \`code\` for technical terms or data
   - Use > for important quotes or highlights

3. Lists:
   - Use bullet points for related items
   - Use numbered lists for sequential steps
   - Indent sub-points for hierarchy

4. Media Integration:
   - Include up to 3 relevant images using any of these formats:
     1. HTML: <img src="IMAGE_URL" alt="DESCRIPTIVE_TEXT" />
     2. Markdown: ![DESCRIPTIVE_TEXT](IMAGE_URL)
     3. Reference: [Image X]: IMAGE_URL
   - Place images naturally within the content
   - Only use images from the provided URLs above
   - Include descriptive alt text for accessibility

5. Citations:
   - Use inline citations [Source X] for claims
   - Link to sources using [text](URL) format
   - Include a sources table at the end

6. Tables:
   - Use markdown tables for structured data
   - Include headers and align columns
   - Keep tables focused and readable

Always end your response with a sources table listing all references used. Format it exactly as shown below:
${sourcesTable}`;

      let assistantMessage: Message = {
        role: 'assistant',
        content: '',
        reasoning: '',
        searchResults: resultsWithImages,
        fullSearchData: searchData,
        reasoningInput
      };

      // Step 3: Get analysis from DeepSeek
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          messages: [
          userMessage,
          {
            role: 'assistant' as const,
            content: 'I found some relevant information. Let me analyze it and create a comprehensive report.',
          },
          {
            role: 'user' as const,
            content: reasoningInput,
          },
          ],
          model: selectedModel
        }),
        signal: abortControllerRef.current.signal,
      });

      if (!response.ok) {
        throw new Error('Failed to generate report. Please try again.');
      }

      const reader = response.body?.getReader();
      if (!reader) throw new Error('No reader available');

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const chunk = new TextDecoder().decode(value);
        const lines = chunk.split('\n').filter(line => line.trim());

        for (const line of lines) {
          try {
            const parsed = JSON.parse(line);
            if (parsed.choices?.[0]?.delta?.reasoning_content) {
              const newReasoning = (assistantMessage.reasoning || '') + parsed.choices[0].delta.reasoning_content;
              assistantMessage.reasoning = newReasoning;
              setCurrentReasoning(newReasoning);
              setChatSections(prev => {
                const updated = [...prev];
                updated[sectionIndex] = {
                  ...updated[sectionIndex],
                  reasoning: newReasoning.replace(/<\/?think>/g, ''),
                  isLoadingThinking: false
                };
                return updated;
              });
            } else if (parsed.choices?.[0]?.delta?.content && !parsed.choices[0].delta.content.startsWith('<think>')) {
              const newContent = (assistantMessage.content || '') + parsed.choices[0].delta.content;
              assistantMessage.content = newContent;
              setChatSections(prev => {
                const updated = [...prev];
                updated[sectionIndex] = {
                  ...updated[sectionIndex],
                  response: newContent
                };
                return updated;
              });
            }
          } catch (e) {
            console.error('Error parsing chunk:', e);
          }
        }
      }

      // Update the section with search results
      setChatSections(prev => {
        const updated = [...prev];
        updated[sectionIndex] = {
          ...updated[sectionIndex],
          searchResults: resultsWithImages
        };
        return updated;
      });
    } catch (error: unknown) {
      if (error instanceof Error && error.name === 'AbortError') {
        console.log('Request was aborted');
      } else {
        const errorMessage = error instanceof Error ? error.message : 'An unexpected error occurred';
        console.error('Error:', error);
        setError(errorMessage);
        setChatSections(prev => {
          const updated = [...prev];
          updated[sectionIndex] = {
            ...updated[sectionIndex],
            error: errorMessage,
            isLoadingSources: false,
            isLoadingThinking: false
          };
          return updated;
        });
      }
    } finally {
      setIsLoading(false);
      setSearchStatus('');
      abortControllerRef.current = null;
    }
  };

  const toggleReasoning = (index: number) => {
    setChatSections(prev => {
      const updated = [...prev];
      updated[index] = {
        ...updated[index],
        isReasoningCollapsed: !updated[index].isReasoningCollapsed
      };
      return updated;
    });
  };

  // Update the View Full Data button click handler
  const handleViewFullData = (section: ChatSection) => {
    setSelectedMessageData({ 
      searchData: section.searchResults,
      reasoning: section.reasoningInput 
    });
    setShowSearchModal(true);
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <TopBar />
      <MainContent>
        <AnimatePresence>
          {!hasSubmitted ? (
            <motion.div 
              className="min-h-screen flex flex-col items-center justify-center"
              initial={{ opacity: 1 }}
              exit={{ opacity: 0, y: -50 }}
              transition={{ duration: 0.3 }}
            >
              <h1 className="text-5xl font-serif text-gray-900 mb-12 tracking-tight flex">
                {['D','3','3','p','S','3','a','r','c','h'].map((letter, index) => (
                  <span
                    key={index}
                    className="inline-block hover:text-blue-600 transition-colors duration-200 letter-bounce"
                    style={{ animationDelay: `${index * 0.1}s` }}
                  >
                    {letter}
                  </span>
                ))}
              </h1>
              <form onSubmit={handleSubmit} className="w-full max-w-[704px] mx-4">
                <div className="relative bg-gray-50 rounded-xl shadow-md border border-gray-300">
                  <textarea
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    placeholder="Ask a question..."
                    className="w-full p-5 pr-32 rounded-xl border-2 border-transparent focus:border-gray-900 focus:shadow-lg focus:outline-none resize-none h-[92px] bg-gray-50 transition-all duration-200"
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && !e.shiftKey) {
                        e.preventDefault();
                        handleSubmit(e);
                      }
                    }}
                  />
                  <div className="absolute right-3 bottom-3 flex items-center gap-2">
                    <button
                      type="submit"
                      disabled={isLoading}
                      className="px-6 py-2.5 bg-gray-900 text-white rounded-lg hover:bg-gray-800 disabled:opacity-50 disabled:cursor-not-allowed text-sm font-medium relative overflow-hidden group"
                    >
                      <span className="relative z-10">{isLoading ? 'Thinking...' : 'Send'}</span>
                      <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/10 to-transparent group-hover:via-white/15 translate-x-[-100%] group-hover:translate-x-[100%] transition-transform duration-1000"></div>
                    </button>
                  </div>
                </div>
                <div className="mt-4 flex flex-wrap gap-4 justify-center">
                  <div className="flex flex-wrap items-center gap-4 bg-white/80 backdrop-blur-sm p-2 rounded-lg shadow-sm w-full max-w-[704px] justify-center">
                    <div className="flex flex-wrap gap-2 justify-center">
                      {searchEngines.map((engine) => (
                        <button
                          key={engine.name}
                          type="button"
                          onClick={() => setSelectedEngine(engine.name)}
                          className={`px-3 py-2 rounded-lg text-sm font-medium transition-all duration-200 whitespace-nowrap ${
                            selectedEngine === engine.name
                              ? 'bg-gray-900 text-white'
                              : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                          }`}
                        >
                          {engine.label}
                        </button>
                      ))}
                    </div>
                    <select
                      value={selectedModel}
                      onChange={(e) => setSelectedModel(e.target.value)}
                      className="px-3 py-2 rounded-lg text-sm font-medium bg-gray-100 text-gray-600 hover:bg-gray-200 border-none focus:ring-2 focus:ring-gray-900 cursor-pointer"
                    >
                      {deepseekModels.map((model) => (
                        <option key={model.name} value={model.name}>
                          {model.label}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
              </form>
            </motion.div>
          ) : (
            <motion.div 
              className="space-y-6 pb-32"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3 }}
            >
              {chatSections.map((section, index) => (
                <div key={index} className="pt-8 border-b border-gray-200 last:border-0">
                  {/* Query */}
                  <div className="mb-8">
                    <p className="text-lg text-gray-800">
                      {section.query}
                    </p>
                  </div>

                  {/* Loading States */}
                  {isLoading && (
                    <div className="mb-6 flex items-center gap-8 text-sm text-gray-500">
                      <motion.div 
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        className="flex items-center gap-2"
                      >
                        <div className="w-2 h-2 bg-blue-500 rounded-full animate-pulse" />
                        <span>Loading Sources</span>
                      </motion.div>

                      <motion.div 
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        transition={{ delay: 2 }}
                        className="flex items-center gap-2"
                      >
                        <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
                        <span>Reading Content</span>
                      </motion.div>

                      <motion.div 
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        transition={{ delay: 4 }}
                        className="flex items-center gap-2"
                      >
                        <div className="w-2 h-2 bg-purple-500 rounded-full animate-pulse" />
                        <span>Analyzing Data</span>
                      </motion.div>
                    </div>
                  )}

                  {/* Sources Loading State */}
                  {section.isLoadingSources && (
                    <div className="mb-12 animate-pulse">
                      <div className="flex items-center gap-2 mb-4">
                        <div className="w-5 h-5 bg-gray-200 rounded" />
                        <div className="h-4 w-20 bg-gray-200 rounded" />
                      </div>
                      <div className="flex gap-3 overflow-x-auto pb-4">
                        {[1, 2, 3].map((_, idx) => (
                          <div key={idx} className="flex-shrink-0 w-[300px] bg-gray-50 border border-gray-200 rounded-xl overflow-hidden">
                            <div className="h-40 bg-gray-200 animate-pulse flex items-center justify-center">
                              <svg className="w-8 h-8 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                              </svg>
                            </div>
                            <div className="p-4 space-y-3">
                              <div className="h-4 bg-gray-200 rounded w-3/4" />
                              <div className="h-4 bg-gray-200 rounded w-full" />
                              <div className="h-4 bg-gray-200 rounded w-2/3" />
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Search Results */}
                  {section.searchResults.length > 0 && (
                    <div className="mb-12 relative w-screen left-1/2 -translate-x-1/2 bg-gray-50">
                      <div className="max-w-3xl mx-auto px-4">
                        <div className="flex justify-end items-center mb-4 clear-both">
                          <button
                            onClick={() => handleViewFullData(section)}
                            className="text-xs text-gray-50 hover:text-blue-600 flex items-center gap-1 transition-colors duration-200"
                          >
                            <span>View Full Data</span>
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
                            </svg>
                          </button>
                        </div>
                      </div>
                      <div className="relative group">
                        {/* Left Arrow */}
                        <button 
                          onClick={() => {
                            const container = document.getElementById(`scroll-container-${index}`);
                            if (container) {
                              container.scrollBy({ left: -300, behavior: 'smooth' });
                            }
                          }}
                          className="absolute left-4 top-1/2 -translate-y-1/2 z-10 bg-white/90 backdrop-blur-sm rounded-full p-2 shadow-lg border border-gray-200 
                            opacity-0 group-hover:opacity-100 transition-opacity duration-200 hover:bg-gray-50"
                        >
                          <svg className="w-6 h-6 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                          </svg>
                        </button>
                        
                        {/* Right Arrow */}
                        <button 
                          onClick={() => {
                            const container = document.getElementById(`scroll-container-${index}`);
                            if (container) {
                              container.scrollBy({ left: 300, behavior: 'smooth' });
                            }
                          }}
                          className="absolute right-4 top-1/2 -translate-y-1/2 z-10 bg-white/90 backdrop-blur-sm rounded-full p-2 shadow-lg border border-gray-200 
                            opacity-0 group-hover:opacity-100 transition-opacity duration-200 hover:bg-gray-50"
                        >
                          <svg className="w-6 h-6 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                          </svg>
                        </button>
                        
                        {/* Scrolling Container */}
                        <div className="max-w-[90vw] mx-auto overflow-x-auto scrollbar-hide" id={`scroll-container-${index}`}>
                          <div className="flex gap-3 pb-4 px-4">
                            {section.searchResults.map((result, idx) => (
                              <div 
                                key={idx}
                                className="flex-shrink-0 w-[300px] bg-gray-50 border border-gray-200 rounded-xl overflow-hidden"
                              >
                                <div className="h-40 bg-gray-200 overflow-hidden relative">
                                  {result.image ? (
                                    <>
                                      <div className="absolute inset-0 bg-gray-200 animate-pulse" />
                                      <ImageComponent src={result.image.url} alt={result.image.description || result.title} />
                                    </>
                                  ) : (
                                    <div className="w-full h-full flex items-center justify-center">
                                      <svg className="w-8 h-8 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                                      </svg>
                                    </div>
                                  )}
                                </div>
                                <div className="p-4">
                                  <a 
                                    href={result.url} 
                                    target="_blank" 
                                    rel="noopener noreferrer" 
                                    className="text-blue-600 hover:underline block mb-2 font-medium line-clamp-2"
                                  >
                                    {result.title}
                                  </a>
                                  <p className="text-sm text-gray-600 line-clamp-3">{result.content}</p>
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Thinking Process Loading State */}
                  {section.isLoadingThinking && deepseekModels.find(m => m.name === selectedModel)?.hasReasoning && (
                    <div className="mb-12">
                      <div className="flex items-center gap-2 mb-4">
                        <div className="w-5 h-5 bg-gray-200 rounded" />
                        <div className="h-4 w-32 bg-gray-200 rounded" />
                      </div>
                      <div className="pl-4 border-l-2 border-gray-300">
                        <div className="animate-pulse space-y-2">
                          <div className="h-4 bg-gray-200 rounded w-full" />
                          <div className="h-4 bg-gray-200 rounded w-5/6" />
                          <div className="h-4 bg-gray-200 rounded w-4/5" />
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Thinking Process */}
                  {section.reasoning && deepseekModels.find(m => m.name === selectedModel)?.hasReasoning && (
                    <div className="mb-12">
                      <div className="flex justify-between items-center mb-4">
                        <div className="flex items-center gap-2">
                          <svg className="w-5 h-5 text-gray-600" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
                          </svg>
                          <h3 className="text-sm font-semibold text-gray-600">Thinking Process:</h3>
                        </div>
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => {
                              setSelectedMessageData({ reasoning: section.reasoningInput });
                              setShowReasoningModal(true);
                            }}
                            className="text-xs text-blue-600 hover:text-blue-700 flex items-center gap-1"
                          >
                            <span>View Full Input</span>
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
                            </svg>
                          </button>
                          <button
                            onClick={() => toggleReasoning(index)}
                            className="text-gray-600 hover:text-gray-700"
                          >
                            <svg 
                              className={`w-5 h-5 transform transition-transform ${section.isReasoningCollapsed ? '-rotate-90' : 'rotate-0'}`} 
                              fill="none" 
                              stroke="currentColor" 
                              viewBox="0 0 24 24"
                            >
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                            </svg>
                          </button>
                        </div>
                      </div>
                      <motion.div 
                        className="pl-4 border-l-2 border-gray-300"
                        initial={false}
                        animate={{ 
                          height: section.isReasoningCollapsed ? 0 : 'auto',
                          opacity: section.isReasoningCollapsed ? 0 : 1
                        }}
                        transition={{ duration: 0.3 }}
                      >
                        <div className="text-sm text-gray-600 leading-relaxed overflow-hidden bg-gray-50 p-4 rounded-lg font-mono whitespace-pre-wrap">
                          {section.reasoning}
                        </div>
                      </motion.div>
                    </div>
                  )}

                  {/* Final Report */}
                  {section.response && (
                    <div className="mt-12 mb-16">
                      <div className="prose prose-blue prose-sm sm:prose lg:prose-lg max-w-none 
                        space-y-4 text-gray-800 
                        [&>ul]:list-disc [&>ul]:pl-6 
                        [&>ol]:list-decimal [&>ol]:pl-6 
                        [&>p]:clear-none
                        [&>h1]:text-3xl [&>h1]:font-bold [&>h1]:mb-6 [&>h1]:text-gray-900
                        [&>h2]:text-2xl [&>h2]:font-semibold [&>h2]:mb-4 [&>h2]:mt-8 [&>h2]:text-gray-800
                        [&>div+h2+table]:mt-0
                        [&>h3]:text-xl [&>h3]:font-medium [&>h3]:mb-3 [&>h3]:mt-6 [&>h3]:text-gray-700
                        [&>p]:leading-relaxed [&>p]:mb-4
                        [&>ul>li]:mb-2 [&>ol>li]:mb-2
                        [&>blockquote]:border-l-4 [&>blockquote]:border-gray-300 [&>blockquote]:pl-4 [&>blockquote]:italic [&>blockquote]:my-6 [&>blockquote]:text-gray-600
                        [&>pre]:bg-gray-50 [&>pre]:p-4 [&>pre]:rounded-lg [&>pre]:overflow-x-auto
                        [&>code]:bg-gray-100 [&>code]:text-gray-800 [&>code]:px-1 [&>code]:py-0.5 [&>code]:rounded
                        [&>hr]:my-8 [&>hr]:border-gray-200
                        [&>strong]:font-semibold [&>strong]:text-gray-900
                        [&>em]:italic [&>em]:text-gray-700
                        [&>a:not([class])]:text-blue-600 [&>a:not([class])]:underline-offset-2 [&>a:not([class])]:decoration-blue-500/30 [&>a:not([class])]:hover:decoration-blue-500
                        [&>table]:w-full [&>table]:my-6
                        [&>*:first-child]:mt-0 [&>*:last-child]:mb-0"
                      >
                        <ReactMarkdown
                          remarkPlugins={[remarkGfm]}
                          rehypePlugins={[rehypeRaw]}
                          components={{
                            table: ({ node, ...props }) => (
                              <div className="my-8 overflow-x-auto rounded-lg border border-gray-200">
                                <table className="w-full text-left border-collapse" {...props} />
                              </div>
                            ),
                            thead: ({ node, ...props }) => (
                              <thead className="bg-gray-50" {...props} />
                            ),
                            tbody: ({ node, ...props }) => (
                              <tbody className="bg-white divide-y divide-gray-200" {...props} />
                            ),
                            tr: ({ node, ...props }) => (
                              <tr 
                                className="hover:bg-gray-50 transition-colors" 
                                {...props} 
                              />
                            ),
                            th: ({ node, ...props }) => (
                              <th 
                                className="py-3 px-4 font-medium text-sm text-gray-900 border-b border-gray-200" 
                                {...props} 
                              />
                            ),
                            td: ({ node, ...props }) => {
                              // Check if the content includes a markdown link
                              const content = props.children?.toString() || '';
                              if (content.match(/\[.*?\]\(.*?\)/)) {
                                return (
                                  <td className="py-3 px-4 text-sm text-gray-500">
                                    <ReactMarkdown
                                      components={{
                                        a: ({ node, ...linkProps }) => (
                                          <a {...linkProps} className="text-blue-600 hover:text-blue-800 hover:underline" target="_blank" rel="noopener noreferrer" />
                                        )
                                      }}
                                    >
                                      {content}
                                    </ReactMarkdown>
                                  </td>
                                );
                              }
                              return (
                                <td 
                                  className="py-3 px-4 text-sm text-gray-500" 
                                  {...props} 
                                />
                              );
                            },
                            pre: ({ node, children, ...props }) => {
                              const content = String(children);
                              if (content.includes('|') && content.includes('\n')) {
                                const rows = content.trim().split('\n');
                                const headers = rows[0].split('|').filter(Boolean).map(h => h.trim());
                                const data = rows.slice(2).map(row => 
                                  row.split('|').filter(Boolean).map(cell => cell.trim())
                                );

                                return (
                                  <div className="my-8 overflow-x-auto">
                                    <table className="w-full text-left border-collapse border border-gray-200">
                                      <thead className="bg-gray-50">
                                        <tr>
                                          {headers.map((header, i) => (
                                            <th key={i} className="py-3 px-4 font-medium text-sm text-gray-900 border-b border-gray-200">
                                              {header}
                                            </th>
                                          ))}
                                        </tr>
                                      </thead>
                                      <tbody className="bg-white">
                                        {data.map((row, i) => (
                                          <tr key={i} className="border-b border-gray-200 hover:bg-gray-50 transition-colors">
                                            {row.map((cell, j) => (
                                              <td key={j} className="py-3 px-4 text-sm text-gray-500">
                                                {cell}
                                              </td>
                                            ))}
                                          </tr>
                                        ))}
                                      </tbody>
                                    </table>
                                  </div>
                                );
                              }
                              return <pre {...props}>{children}</pre>;
                            },
                            a: ({ node, ...props }) => {
                              const href = props.href || '';
                              const sourceMatch = href.match(/\[Source (\d+)\]/);
                              if (sourceMatch) {
                                const sourceIndex = parseInt(sourceMatch[1]) - 1;
                                const source = section.searchResults[sourceIndex];
                                return (
                                  <span className="inline-flex items-center group relative">
                                    <a {...props} className="inline-flex items-center text-blue-600 hover:text-blue-800" target="_blank" rel="noopener noreferrer">
                                      <svg className="w-4 h-4 mr-1" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
                                      </svg>
                                      {props.children}
                                    </a>
                                    {source && (
                                      <div className="absolute bottom-full left-0 mb-2 hidden group-hover:block z-50">
                                        <div className="bg-white p-4 rounded-lg shadow-lg border border-gray-200 w-80">
                                          <h4 className="font-medium text-gray-900 mb-2">{source.title}</h4>
                                          <p className="text-sm text-gray-600 mb-2">{source.content}</p>
                                          <a href={source.url} target="_blank" rel="noopener noreferrer" className="text-xs text-blue-600 hover:underline">
                                            Visit source →
                                          </a>
                                        </div>
                                      </div>
                                    )}
                                  </span>
                                );
                              }
                              return <a {...props} className="text-blue-600 hover:text-blue-800" target="_blank" rel="noopener noreferrer" />;
                            },
                            img: ({node, ...props}) => {
                              // Extract URL from various possible formats
                              let src = props.src || '';
                              let alt = props.alt || '';
                              
                              // Handle markdown image format ![alt](url)
                              const markdownMatch = src.match(/!\[(.*?)\]\((.*?)\)/);
                              if (markdownMatch) {
                                alt = markdownMatch[1];
                                src = markdownMatch[2];
                              }
                              
                              // Handle [Image X]: url format
                              const imageRefMatch = src.match(/\[Image \d+\]:\s*(.*?)(?:\s|$)/);
                              if (imageRefMatch) {
                                src = imageRefMatch[1];
                              }
                              
                              // Clean up the URL
                              src = src.replace(/['"]/g, '').trim();
                              
                              return <ImageComponent src={src} alt={alt} />;
                            },
                            iframe: ({node, ...props}) => {
                              const src = props.src || '';
                              // Extract video ID from various YouTube URL formats
                              const videoIdMatch = src.match(/(?:youtube\.com\/embed\/|youtube\.com\/watch\?v=|youtu\.be\/)([^&\s]+)/);
                              if (!videoIdMatch) {
                                console.log('Invalid YouTube URL:', src);
                                return null;
                              }
                              const videoId = videoIdMatch[1];
                              const embedUrl = `https://www.youtube.com/embed/${videoId}`;
                              
                              return (
                                <div className="my-4 aspect-video">
                                  <iframe
                                    {...props}
                                    src={embedUrl}
                                    className="w-full h-full rounded-lg"
                                    allowFullScreen
                                    allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                                  />
                                </div>
                              );
                            }
                          }}
                        >
                          {section.response}
                        </ReactMarkdown>
                      </div>
                    </div>
                  )}

                  {section.error && (
                    <div className="text-center text-red-600 mb-8">
                      {section.error}
                    </div>
                  )}
                </div>
              ))}
            </motion.div>
          )}
        </AnimatePresence>
        
        {/* Hidden bottom text - always at the bottom */}
        <div className="w-full text-center mt-20 mb-8">
          <p className="text-gray-50 hover:text-gray-600 transition-colors duration-200">
            We hope you love D33pS3arch from planet <a href="https://www.d33ps33k.com/" className="hover:text-blue-600 transition-colors duration-200">D33pS33k</a>. Please help us continue creating amazing tools by donating here: <a href="https://www.d33ps33k.com/donations/" className="hover:text-blue-600 transition-colors duration-200">D33pS33k Donations</a>
          </p>
        </div>
      </MainContent>

      {/* Modal for Search Data */}
      {showSearchModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg p-6 max-w-2xl w-full max-h-[80vh] overflow-y-auto">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-semibold text-gray-800">Full Search Data</h3>
              <button
                onClick={() => setShowSearchModal(false)}
                className="text-gray-600 hover:text-gray-700"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <pre className="whitespace-pre-wrap text-sm text-gray-600 font-mono">
              {JSON.stringify(selectedMessageData?.searchData, null, 2)}
            </pre>
          </div>
        </div>
      )}

      {/* Modal for Reasoning Input */}
      {showReasoningModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg p-6 max-w-2xl w-full max-h-[80vh] overflow-y-auto">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-semibold text-gray-800">Full Reasoning Input</h3>
              <button
                onClick={() => setShowReasoningModal(false)}
                className="text-gray-600 hover:text-gray-700"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <pre className="whitespace-pre-wrap text-sm text-gray-600 font-mono">
              {selectedMessageData?.reasoning}
            </pre>
          </div>
        </div>
      )}
    </div>
  );
}
