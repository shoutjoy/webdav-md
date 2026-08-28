# React + Vite

## WebDAV connection

Run the app with `bun run dev` (or `npm run dev`) and open the Vite URL. Requests to
`https://webdav.freemath.synology.me` are sent through the same-origin
`/__webdav_proxy` route. The proxy supports WebDAV methods and avoids browser CORS
and the NAS certificate-name mismatch without sending credentials to a third-party
proxy. Other WebDAV hosts continue to connect directly and therefore need their own
CORS configuration.

This template provides a minimal setup to get React working in Vite with HMR and some ESLint rules.

Currently, two official plugins are available:

- [@vitejs/plugin-react](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react) uses [Oxc](https://oxc.rs)
- [@vitejs/plugin-react-swc](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react-swc) uses [SWC](https://swc.rs/)

## React Compiler

The React Compiler is not enabled on this template because of its impact on dev & build performances. To add it, see [this documentation](https://react.dev/learn/react-compiler/installation).

## Expanding the ESLint configuration

If you are developing a production application, we recommend using TypeScript with type-aware lint rules enabled. Check out the [TS template](https://github.com/vitejs/vite/tree/main/packages/create-vite/template-react-ts) for information on how to integrate TypeScript and [`typescript-eslint`](https://typescript-eslint.io) in your project.
