# D33pS3arch from Planet D33pS33k

A powerful search interface that combines multiple search engines (DuckDuckGo, Google via Serper, and Bing(portal.azure.com)) with AI-powered analysis using DeepSeek. Built with Next.js 14, TypeScript, and Tailwind CSS.

## Support the Project

If you find this project useful, please consider supporting its development:

**Crypto Donations**: [https://www.d33ps33k.com/donations/](https://www.d33ps33k.com/donations/)

Your support helps maintain and improve this project! ❤️

## Features

### Triple Search Engine Integration
- **DuckDuckGo**: Web and image scraping using Cheerio (Local development only)
- **Google Search**: Via Serper API for web and image results
- **Bing Search**: Official API integration for web, image, and video results
- **Mojeek Search**: Privacy-focused search engine with official API integration
- **Google News**: Via Serper API for news articles and related images
- **Google Scholar**: Academic search via Serper API with citation tracking

### AI Integration
- **DeepSeek AI**: For comprehensive analysis and report generation
- **Groq AI**: Ultra-fast inference with LLaMA2-70B
- **Streaming Responses**: Using Edge runtime for real-time updates
- **Four Models**: 
  - Reasoner: deepseek-reasoner Shows thinking process and reasoning content
  - Chat: deepseek-chat Direct responses
  - Groq: llama2-70b-4096 High-performance responses
  - Chat with GPT: gpt-4o-mini Direct responses
- **Automatic Retries**: Built-in handling for API timeouts
- **Edge Runtime**: Optimized for streaming responses with 60s timeout

### UI Components
- **Responsive Search Interface**: Built with Tailwind CSS
- **Full-width Scrollable Source Cards**: Easy navigation through results
- **Markdown Rendering**: Using ReactMarkdown with GitHub Flavored Markdown
- **Image Components**: Lazy loading for optimal performance
- **Loading States**: Animated with Framer Motion

## Environment Setup

### Local Development
Create a `.env.local` file in the root directory with your API keys:
```
# Required API Keys
DEEPSEEK_API_KEY="your_deepseek_api_key"
SERPER_API_KEY="your_serper_api_key"
BING_API_KEY="your_bing_api_key"
GROQ_API_KEY="your_groq_api_key"
OPENAI_API_KEY="your_openai_api_key"  # Optional: For GPT model fallback
MOJEEK_API_KEY="your_mojeek_api_key"  # Required for Mojeek search integration

# Feature Flags
NEXT_PUBLIC_ENABLE_DUCKDUCKGO="true"  # Enable DuckDuckGo scraping locally
```

### Vercel Deployment
When deploying to Vercel, add these environment variables in the Vercel dashboard:
```
# Required API Keys
DEEPSEEK_API_KEY="your_deepseek_api_key"
SERPER_API_KEY="your_serper_api_key"
BING_API_KEY="your_bing_api_key"
GROQ_API_KEY="your_groq_api_key"
OPENAI_API_KEY="your_openai_api_key"  # Optional: For GPT model fallback
MOJEEK_API_KEY="your_mojeek_api_key"  # Required for Mojeek search integration

# Feature Flags
NEXT_PUBLIC_ENABLE_DUCKDUCKGO="false"  # Disable DuckDuckGo scraping on Vercel
NEXT_PUBLIC_APP_URL="your_deployment_url"  # e.g., https://d33ps3arch.d33ps33k.com
```

> ⚠️ **Important Notes**: 
> - The `.env.local` file is excluded from Git to protect your API keys. Never commit this file to your repository.
> - DuckDuckGo scraping is disabled by default in Vercel deployments to comply with their policies.
> - When backing up or moving the project, make sure to preserve your `.env.local` file separately.
> - The `NEXT_PUBLIC_ENABLE_DUCKDUCKGO` environment variable controls the availability of the "Go Quack" search option.

## Setup

1. Clone the repository:
```bash
git clone [repository-url]
cd better_search
```

2. Install dependencies:
```bash
npm install
```

3. Run the development server:
```bash
npm run dev
```

4. Open [http://localhost:3000](http://localhost:3000) in your browser

## Project Structure

```
src/
├── app/
│   ├── page.tsx           # Main search interface
│   ├── layout.tsx         # Root layout with providers
│   ├── globals.css        # Global styles and Tailwind
│   ├── error.tsx          # Error boundary handling
│   ├── loading.tsx        # Loading state animations
│   ├── not-found.tsx     # 404 page
│   └── api/
│       ├── scraper/      # DuckDuckGo scraping
│       │   └── route.ts  # Web and image results
│       ├── serper/       # Google search via Serper
│       │   └── route.ts  # Web and image integration
│       ├── bing/         # Bing search integration
│       │   └── route.ts  # Web, image, and video search
│       ├── mojeek/       # Mojeek search integration
│       │   └── route.ts  # Privacy-focused web search
│       ├── gnews/        # Google News integration
│       │   └── route.ts  # News articles and images
│       ├── gbrains/      # Google Scholar integration
│       │   └── route.ts  # Academic papers and citations
│       └── chat/         # DeepSeek AI completion
│           └── route.ts  # Streaming response handler
├── components/           # Reusable UI components
│   ├── search/          # Search-related components
│   ├── results/         # Result display components
│   └── ui/              # Common UI elements
└── lib/                 # Utility functions and types
    ├── types/           # TypeScript definitions
    └── utils/           # Helper functions
```

## Dependencies

- **Node.js**: >= 18.17.0 (20.11.0 LTS recommended)
- **Next.js**: ^14.1.0
- **React**: ^18.2.0
- **TypeScript**: ^5.3.3
- **Tailwind CSS**: ^3.4.1
- **Key Packages**:
  - axios: ^1.6.5
  - cheerio: ^1.0.0-rc.12
  - framer-motion: ^10.18.0
  - react-markdown: ^9.0.1
  - remark-gfm: ^4.0.0
  - rehype-raw: ^7.0.0
  - @types/node: ^20.11.0
  - @types/react: ^18.2.48
  - eslint: ^8.56.0
  - postcss: ^8.4.33
  - autoprefixer: ^10.4.17

## API Routes

### `/api/scraper`
- DuckDuckGo web and image search scraping
- Uses Cheerio for HTML parsing
- Supports both text and image results
- Handles pagination and result formatting

### `/api/serper`
- Google search via Serper API
- Supports web and image results
- Handles structured data responses
- Includes metadata and rich snippets

### `/api/bing`
- Bing web, image, and video search
- Uses official Bing Search v7 API
- Supports multiple markets and languages
- Includes thumbnail generation

### `/api/gnews`
- Google News search via Serper API
- Real-time news articles and updates
- Includes publication dates and sources
- Automatic image fetching for news items

### `/api/gbrains`
- Google Scholar search via Serper API
- Academic paper search with citation tracking
- Author information and publication dates
- Related academic images when available
- Supports scholarly metadata and citations

### `/api/mojeek`
- Privacy-focused search engine integration
- Uses official Mojeek API
- Supports web search with rich metadata
- Includes image results when available
- Configurable result limits and formatting
- Respects user privacy with no tracking

### `/api/chat`
- DeepSeek, Groq, and OpenAI integration
- Supports streaming responses with Edge runtime
- Configurable 60-second timeout
- Four models: 
  - DeepSeek Reasoner: (deepseek-reasoner) Provides both reasoning_content and final content
  - DeepSeek Chat: (deepseek-chat) Streamlined responses
  - Groq Chat: (llama2-70b-4096) High-performance responses with image support
  - Chat by OpenAI: (gpt-4o-mini) Direct responses
- Error handling for API timeouts and service disruptions
- Automatic parsing of streaming chunks
- Keep-alive support for long-running requests
- Enhanced image handling support across all models

## License

D33pS33kOS License - See LICENSE file for details