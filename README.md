# React + Vite

## WebDAV connection

Run the app with `bun run dev` (or `npm run dev`) and open the Vite URL. Requests to
`https://webdav.freemath.synology.me` are sent through the same-origin
`/__webdav_proxy` route. The proxy supports WebDAV methods and avoids browser CORS
and the NAS certificate-name mismatch without sending credentials to a third-party
proxy. Other WebDAV hosts continue to connect directly and therefore need their own
CORS configuration.

## AI Jena web search

The Vite development and preview servers expose `/api/web-search`. AI Jena uses
Google Custom Search when both `GOOGLE_CUSTOM_SEARCH_API_KEY` and
`GOOGLE_CUSTOM_SEARCH_ENGINE_ID` are present, otherwise DuckDuckGo HTML search is
used first and Bing RSS is the final fallback. Keep these server-only values in a
local `.env`; do not use the `VITE_` prefix because that would expose them to the
browser bundle. Google Custom Search support is intended for existing API
customers; the API is no longer open to new customers.

AI Jena can also store a SerpApi key in its settings. When configured, the key
is sent only to the same-origin Vite middleware in an `X-SerpApi-Key` header;
the middleware calls SerpApi's Google engine and never writes the key into a
generated asset. SerpApi is tried before the other search providers.

## WebDAV backup email

The automatic ZIP backup API is server-side middleware. It works when the app is
served by `npm run dev` or `npm run preview`; a static GitHub Pages deployment does
not run this API. For production, run the Vite server continuously or move
`/api/webdav-backups` and its scheduler to a persistent Node server. The server
also needs durable storage for `.webdav-backup-data`.

Backup completion mail uses Resend. Copy `.env.example` to `.env` on the server
and set the following server-only variables (never use a `VITE_` prefix and never
put the API key in browser settings or committed source):

```dotenv
RESEND_API_KEY=re_your_real_api_key
WEBDAV_BACKUP_FROM_EMAIL=WebDAV Backup <backup@your-verified-domain.example>
WEBDAV_BACKUP_SECRET=replace-with-a-long-random-secret
```

Create the API key in Resend, verify the sending domain and its DNS records, and
use an address on that verified domain for `WEBDAV_BACKUP_FROM_EMAIL`. Restart the
server after changing `.env`. `WEBDAV_BACKUP_SECRET` should remain stable so saved
WebDAV credentials can still be decrypted after a server migration.

This template provides a minimal setup to get React working in Vite with HMR and some ESLint rules.

Currently, two official plugins are available:

- [@vitejs/plugin-react](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react) uses [Oxc](https://oxc.rs)
- [@vitejs/plugin-react-swc](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react-swc) uses [SWC](https://swc.rs/)

## React Compiler

The React Compiler is not enabled on this template because of its impact on dev & build performances. To add it, see [this documentation](https://react.dev/learn/react-compiler/installation).

## Expanding the ESLint configuration

If you are developing a production application, we recommend using TypeScript with type-aware lint rules enabled. Check out the [TS template](https://github.com/vitejs/vite/tree/main/packages/create-vite/template-react-ts) for information on how to integrate TypeScript and [`typescript-eslint`](https://typescript-eslint.io) in your project.
