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
  - AI-based identifier extraction with OpenAI Vision
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
| Search API | Google Custom Search JSON API |
| OCR | Tesseract.js |
| AI Vision | OpenAI API |
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
- A Google Custom Search Engine
- A Google Custom Search JSON API key
- An OpenAI API key
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
GOOGLE_CSE_API_KEY=
GOOGLE_CSE_ID=
OPENAI_API_KEY=
UPSTASH_REDIS_REST_URL=
UPSTASH_REDIS_REST_TOKEN=
```

### Variable Notes

- `GOOGLE_CSE_API_KEY`: API key for the Google Custom Search JSON API
- `GOOGLE_CSE_ID`: Search engine ID for your Custom Search Engine
- `OPENAI_API_KEY`: API key for image analysis and identifier extraction
- `UPSTASH_REDIS_REST_URL`: REST URL from your Upstash Redis database
- `UPSTASH_REDIS_REST_TOKEN`: REST token from your Upstash Redis database

## API Key Setup

### 1. Google Custom Search API

You need both a Google API key and a Custom Search Engine ID.

#### Create a Google API key

1. Go to the Google Cloud Console
2. Create or select a project
3. Enable the Custom Search JSON API
4. Go to Credentials
5. Create an API key

#### Create a Custom Search Engine

1. Go to the Google Programmable Search Engine dashboard
2. Create a new search engine
3. Configure it to search the public web
4. Copy the Search Engine ID

Notes:
- Google Custom Search has quota and billing constraints depending on your account
- Restrict your API key in Google Cloud where possible

### 2. OpenAI API Key

1. Sign in to the OpenAI platform
2. Create an API key
3. Add it to `.env.local`

Notes:
- Keep the key server-side only
- Do not expose it in client-side code
- Costs depend on model usage and request volume

### 3. Upstash Redis

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

- Search-dependent features require valid Google Custom Search credentials
- Vision-dependent features require an OpenAI API key
- Redis-backed history and caching require Upstash credentials
- Without external credentials, some features may fall back to empty/mock responses depending on configuration paths

## Troubleshooting

### App starts but searches return no results

Check:
- `GOOGLE_CSE_API_KEY`
- `GOOGLE_CSE_ID`
- Custom Search Engine configuration
- API quota and billing

### Image analysis fails

Check:
- `OPENAI_API_KEY`
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