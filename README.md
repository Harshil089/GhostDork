# GhostDork

GhostDork is a private OSINT research dashboard built with Next.js, TypeScript, and Tailwind CSS for authorized security research, CTF practice, and portfolio demonstration. It provides a terminal-inspired interface for constructing structured Google Custom Search queries, discovering public documents across multiple file formats, analyzing images with OCR and AI vision, and coordinating target-focused search sweeps.

## Features

- Structured query builder with common Google search operators
- Preset research templates for:
  - Exposed configuration files
  - Open directory listings
  - Public document repositories
  - Social profile enumeration
- Multi-format document discovery across:
  - Documents: `pdf`, `docx`, `xlsx`, `pptx`, `txt`, `csv`
  - Config/data: `json`, `yaml`, `xml`, `sql`, `log`, `env`
  - Archives: `zip`, `tar`
- Image analysis pipeline:
  - OCR with Tesseract.js
  - AI-based identifier extraction with Gemini Vision
  - Auto-generated follow-up search queries
- Target sweep dashboard for names, emails, usernames, and domains
- Upstash Redis caching with 1-hour TTL
- Session history sidebar
- Export support for JSON, CSV, and PDF
- Vercel-friendly serverless architecture

## Tech Stack

| Layer | Technology |
|---|---|
| Framework | Next.js App Router |
| Language | TypeScript |
| Styling | Tailwind CSS |
| UI | Custom brutalist components inspired by shadcn/ui patterns |
| Search API | SerpAPI |
| OCR | Tesseract.js |
| AI Vision | Google Gemini API |
| Cache | Upstash Redis |
| PDF Export | pdf-lib |
| Deployment | Vercel |

## Project Structure

```/dev/null/project-structure.txt#L1-22
GhostDork/
├── app/
│   ├── api/
│   │   ├── export/pdf/
│   │   ├── history/
│   │   ├── image/analyze/
│   │   ├── search/batch/
│   │   ├── search/query/
│   │   └── target/sweep/
│   ├── globals.css
│   ├── layout.tsx
│   └── page.tsx
├── components/
│   ├── dashboard/
│   └── ui/
├── lib/
│   ├── api/
│   ├── data/
│   ├── types/
│   ├── cache.ts
│   ├── env.ts
│   ├── image.ts
│   ├── osint-service.ts
│   ├── pdf.ts
│   ├── query.ts
│   └── utils.ts
```

## Requirements

Before running the project, make sure you have:

- Node.js 18.18+ or newer
- npm 9+ or newer

- A SerpAPI account and API key
- A Google Gemini API key (free tier available at https://aistudio.google.com/app/apikey)
- An Upstash Redis database

## Installation

1. Clone the repository:

```/dev/null/install.sh#L1-3
git clone <your-repo-url>
cd GhostDork
npm install
```

2. Create your environment file:

```/dev/null/env-copy.sh#L1-1
cp .env.example .env.local
```

3. Fill in the required environment variables in `.env.local`.

4. Start the development server:

```/dev/null/dev.sh#L1-1
npm run dev
```

5. Open the app in your browser:

```/dev/null/browser.txt#L1-1
http://localhost:3000
```

## Environment Variables

Create a `.env.local` file with the following values:

```/dev/null/.env.example#L1-5
GEMINI_API_KEY=
GOOGLE_CSE_ID=
GEMINI_API_KEY=
UPSTASH_REDIS_REST_URL=
UPSTASH_REDIS_REST_TOKEN=
```

### Variable Notes

- `SERPAPI_API_KEY`: API key for SerpAPI (free tier provides 100 searches/mo)
- `UPSTASH_REDIS_REST_URL`: REST URL from your Upstash Redis database
- `UPSTASH_REDIS_REST_TOKEN`: REST token from your Upstash Redis database

## API Key Setup

### 1. SerpAPI Key

1. Go to https://serpapi.com/
2. Create an account and copy your API key
3. Add it to `.env.local`

### 2. Google Gemini API Key

1. Go to https://aistudio.google.com/app/apikey
2. Create an API key (free tier available)
3. Add it to `.env.local`

Notes:
- Keep the key server-side only
- Do not expose it in client-side code
- The free tier has generous rate limits for development

### 3. Global Security (Optional but Recommended)

Since GhostDork is a powerful OSINT tool, you can lock it down so it is not publicly accessible (preventing unauthorized users from using your API quotas).
To enable Basic HTTP Authentication for all pages and APIs:

1. Open `.env.local`
2. Set a secure password for `AUTH_PASSWORD=your_secure_password_here`
3. Restart the server. When prompted by your browser, use username **`admin`** and your configured password.

### 4. Upstash Redis

1. Create an account on Upstash
2. Create a Redis database
3. Copy the REST URL and REST token
4. Add both to `.env.local`

Notes:
- GhostDork falls back to in-memory storage if Redis is not configured
- For persistent serverless caching on Vercel, configure Upstash

## Available Scripts

```/dev/null/scripts.json#L1-6
npm run dev
npm run build
npm run start
npm run lint
```

- `npm run dev`: start the local development server
- `npm run build`: create a production build
- `npm run start`: serve the production build
- `npm run lint`: run ESLint

## API Routes

GhostDork exposes the following routes:

```/dev/null/routes.txt#L1-6
POST /api/search/query
POST /api/search/batch
POST /api/image/analyze
POST /api/target/sweep
GET  /api/history
POST /api/export/pdf
```

### Route Summary

- `POST /api/search/query`
  - Runs a single structured Google Custom Search query
- `POST /api/search/batch`
  - Runs multi-format discovery against many file extensions
- `POST /api/image/analyze`
  - Performs OCR and AI vision analysis on an image
- `POST /api/target/sweep`
  - Executes coordinated search workflows for a target
- `GET /api/history`
  - Returns cached or in-memory session history
- `POST /api/export/pdf`
  - Generates a downloadable PDF report

## Deployment on Vercel

GhostDork is designed for Vercel deployment.

### Recommended deployment flow

1. Push the project to GitHub
2. Import the repository into Vercel
3. Add all environment variables in the Vercel dashboard
4. Deploy

### Vercel configuration

Create a `vercel.json` file like this:

```/dev/null/vercel.json#L1-8
{
  "functions": {
    "api/image/analyze.ts": { "maxDuration": 60, "memory": 1024 },
    "api/search/batch.ts": { "maxDuration": 60, "memory": 512 },
    "api/target/sweep.ts": { "maxDuration": 60, "memory": 512 }
  }
}
```

If your routes are implemented under the App Router, adjust the paths to match your deployment needs.

## Usage Guide

### Structured Query Builder

Use the query builder tab to combine operator-based inputs such as:

- `site`
- `inurl`
- `intitle`
- `intext`
- `filetype`
- `before`
- `after`

You can also:
- add exact terms
- exclude terms
- use preset templates
- export results as JSON or CSV

### Document Scan

Use the document scan tab to:
- input a domain or keyword
- select the file formats to include
- run a unified batch scan
- review findings in a single table

### Image AI

Use the image analysis tab to:
- submit an image URL
- paste a base64-encoded image
- extract OCR text
- identify usernames, emails, domains, names, and other visible identifiers
- generate follow-up search pivots automatically

### Target Sweep

Use the target sweep tab to:
- input a name, email, username, or domain
- run coordinated searches
- inspect section-by-section results
- export the report as JSON or PDF

## Caching Behavior

- Cache backend: Upstash Redis
- TTL: 1 hour
- Fallback: in-memory cache if Redis is not configured
- Session history is also stored through the same cache abstraction

## Security Notes

GhostDork is intended only for:

- authorized security research
- educational lab work
- CTF exercises
- defensive analysis
- portfolio demonstration

Do not use this project for:
- unauthorized access
- invasive surveillance
- unlawful data gathering
- targeting systems or individuals without permission

Recommended best practices:
- keep API keys in server-only environment variables
- restrict Google API keys by service and referrer where possible
- never commit `.env.local`
- review rate limits and quotas before heavy usage

## Current Notes

- Search-dependent features require a valid SerpAPI key
- Vision-dependent features require a Google Gemini API key
- Redis-backed history and caching require Upstash credentials
- Without external credentials, some features may fall back to empty/mock responses depending on configuration paths

## Troubleshooting

### App starts but searches return no results

Check:
- `SERPAPI_API_KEY`
- SerpAPI dashboard for rate limits (Free tier allows 100 req/mo)

### Image analysis fails

Check:
- `GEMINI_API_KEY`
- image URL accessibility
- base64 payload formatting
- server logs for OCR or API failures

### History does not persist across restarts

Check:
- `UPSTASH_REDIS_REST_URL`
- `UPSTASH_REDIS_REST_TOKEN`

If Redis is missing, the app may use in-memory storage only.

### Build errors

Try:

```/dev/null/fix-build.sh#L1-3
rm -rf .next
npm install
npm run build
```

Then review any lint or type errors.

## License

This project is intended as a personal educational and portfolio application. Add the license of your choice before public release.

## Disclaimer

GhostDork is provided for lawful, authorized research and educational use only. You are responsible for complying with applicable laws, platform terms, and organizational policies when using this software.