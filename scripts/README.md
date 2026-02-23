# Service Worker Generation

## Overview

The Firebase Cloud Messaging service worker (`firebase-messaging-sw.js`) is automatically generated at build time from environment variables.

## Why?

This approach prevents hardcoding sensitive Firebase API keys in the source code. Instead, the configuration is injected from environment variables at build time.

## How it works

The `generate-sw.js` script:
1. Reads environment variables from `.env` or `.env.local`
2. Injects them into the service worker template
3. Generates `public/firebase-messaging-sw.js`

This script runs automatically:
- `npm run dev` - generates before starting development server
- `npm run build` - generates before building for production

## Required Environment Variables

Your `.env.local` or `.env` file must include:

```
NEXT_PUBLIC_FIREBASE_API_KEY=your_key_here
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=your_domain
NEXT_PUBLIC_FIREBASE_PROJECT_ID=your_project_id
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=your_bucket
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=your_sender_id
NEXT_PUBLIC_FIREBASE_APP_ID=your_app_id
```

## Important

- ⚠️ **Never commit `firebase-messaging-sw.js`** - It's in `.gitignore` to prevent accidentally exposing API keys
- 🔒 Always ensure `.env.local` is in `.gitignore` (it already is)
- ✅ Only commit `.env.example` with empty values
