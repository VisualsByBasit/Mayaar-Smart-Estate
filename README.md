# Mayaar Smart Estate

Interactive map for browsing Islamabad property listings.

## Setup

```bash
npm install
```

Create `.env.local` in the project root:

```env
NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN=your_mapbox_token
GEMINI_API_KEY=your_gemini_key
```

Start the development server:

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

Listings are loaded from `src/data/listings.json`.
