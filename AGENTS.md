# Asset Management Workflow
When working with images, sprites, or other static assets, observe the following rules to prevent missing files and load failures:

1. **Verify Asset Existence Before Use:** NEVER hardcode asset paths. Always use `list_dir` or `shell_exec` (with `grep` or `npx`) to verify the exact filenames and structures inside the `public/` directory before referencing them in code. AI image generators may use different naming schemes (e.g. `palpitate_1` instead of `lightning_1`).

2. **CORS and Canvas Extraction:** If the application uses `<canvas>` elements to extract pixel data (e.g., `getImageData`), it requires `crossOrigin="anonymous"` on the requested images. Ensure `vite.config.ts` explicitly sets `server: { cors: true, headers: { 'Access-Control-Allow-Origin': '*' } }` to allow this within proxied development environments like AI Studio.

3. **Graceful Fallbacks and Error Handling:** All image loading logic (like `new Image()` or TextureLoaders) MUST include robust `onerror` handlers. Instead of crashing or failing silently, fall back to default colors, placeholder images, or explicitly mark the visual element as unavailable so the core app functionalities continue to work.

4. **Dynamic Imports via Manifests (Recommended):** If the application requires a large, dynamic set of sprites, consider writing a short pre-build script (e.g., `generate-manifest.js`) that safely reads directory contents and generates a JSON manifest. This guarantees the application only attempts to load files that strictly exist.
