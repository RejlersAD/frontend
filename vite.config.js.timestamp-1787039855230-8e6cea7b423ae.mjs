// vite.config.js
import { defineConfig, loadEnv } from "file:///app/node_modules/vite/dist/node/index.js";
import react from "file:///app/node_modules/@vitejs/plugin-react/dist/index.js";
import { VitePWA } from "file:///app/node_modules/vite-plugin-pwa/dist/index.js";
import path from "path";
import http from "http";
var __vite_injected_original_dirname = "/app";
var PROXY_AGENT = process.env.VITE_PROXY_DISABLE_KEEPALIVE === "1" ? new http.Agent({ keepAlive: false }) : void 0;
var PROXY_TIMEOUT_MS = Number(process.env.VITE_PROXY_TIMEOUT_MS || 12e5);
var PROXY_UPSTREAM_TIMEOUT_MS = Number(process.env.VITE_PROXY_UPSTREAM_TIMEOUT_MS || 12e5);
var vite_config_default = defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "");
  let apiUrl = env.VITE_API_PROXY_TARGET || "http://localhost:8000";
  const apiUrlObj = new URL(apiUrl);
  const targetHost = apiUrlObj.host;
  const IS_PROD_BACKEND = !apiUrl.includes("localhost") && !apiUrl.includes("127.0.0.1") && !apiUrl.includes("backend_local") && !apiUrl.includes("aiflow_backend");
  console.log("\u{1F527} Vite Config - Mode:", mode);
  console.log("\u{1F527} Vite Config - Proxy Target:", apiUrl);
  if (IS_PROD_BACKEND) {
    console.log("\u26A0\uFE0F  PROD BACKEND MODE \u2014 all API calls proxy to Railway production. Writes hit production data!");
  }
  return {
    plugins: [
      react(),
      VitePWA({
        registerType: "autoUpdate",
        includeAssets: ["assets/Rejlers_Logo.png", "favicon.ico"],
        manifest: {
          name: "RADAI",
          short_name: "RADAI",
          description: "Next-generation AI-powered engineering workspace for the Oil & Gas industry",
          theme_color: "#0A1628",
          background_color: "#0A1628",
          display: "standalone",
          scope: "/",
          start_url: "/",
          orientation: "any",
          icons: [
            {
              src: "/assets/icon-192x192.png",
              sizes: "192x192",
              type: "image/png",
              purpose: "any maskable"
            },
            {
              src: "/assets/icon-512x512.png",
              sizes: "512x512",
              type: "image/png",
              purpose: "any maskable"
            }
          ],
          // Desktop shortcuts for quick access to common features
          shortcuts: [
            {
              name: "Login",
              short_name: "Login",
              description: "Quick login to RADAI",
              url: "/login",
              icons: [{ src: "/assets/icon-192x192.png", sizes: "192x192" }]
            },
            {
              name: "Dashboard",
              short_name: "Dashboard",
              description: "Open RADAI Dashboard",
              url: "/dashboard",
              icons: [{ src: "/assets/icon-192x192.png", sizes: "192x192" }]
            },
            {
              name: "PID Verification",
              short_name: "PID",
              description: "PID Verification Tool",
              url: "/engineering/process/pid-verification-v1",
              // SOFT-CODED: Updated to V1 route
              icons: [{ src: "/assets/icon-192x192.png", sizes: "192x192" }]
            }
          ]
        },
        workbox: {
          globPatterns: ["**/*.{js,css,html,ico,png,svg,woff,woff2}"],
          // CRITICAL: Increase file size limit for precaching large bundles
          // Default 2 MB is too small for production builds with all features
          // The current full-feature bundle is ~14 MB before gzip (~2.6 MB
          // transferred). Keep enough headroom for Workbox to complete the
          // production build while retaining offline startup support.
          maximumFileSizeToCacheInBytes: 20 * 1024 * 1024,
          // 20 MB
          // SOFT-CODED: Allow navigation to all routes (not just /)
          navigateFallback: "index.html",
          navigateFallbackAllowlist: [/.*/],
          // Allow all paths for SPA routing
          runtimeCaching: [
            {
              urlPattern: /^https:\/\/radai\.ae\/api\/.*/i,
              handler: "NetworkFirst",
              options: {
                cacheName: "api-cache",
                expiration: {
                  maxEntries: 100,
                  maxAgeSeconds: 60 * 5
                  // 5 minutes
                },
                cacheableResponse: {
                  statuses: [0, 200]
                }
              }
            }
          ]
        },
        devOptions: {
          enabled: false,
          // Avoid stale cached application code during development
          type: "module",
          navigateFallback: "index.html",
          navigateFallbackAllowlist: [/.*/]
          // Allow all paths in dev mode
        }
      })
    ],
    resolve: {
      alias: {
        "@": path.resolve(__vite_injected_original_dirname, "./src")
      },
      // Force a single instance of emotion so all chunks share the
      // same initialised module — prevents "styled_default is not a function"
      // when multiple vendor chunks each try to initialise their own copy.
      dedupe: ["@emotion/react", "@emotion/styled", "react", "react-dom"]
    },
    // Soft-coded: expose backend mode to the React app as a compile-time constant
    // Use in components: if (import.meta.env.VITE_IS_PROD_BACKEND === 'true') { ... }
    // process.env.NODE_ENV is defined for libraries that check the environment
    define: {
      "__PROD_BACKEND__": JSON.stringify(IS_PROD_BACKEND),
      "process.env.NODE_ENV": JSON.stringify(mode === "production" ? "production" : "development")
    },
    server: {
      host: "0.0.0.0",
      // Listen on all interfaces for Docker
      port: 5173,
      // Use port 5173 for local development
      watch: {
        usePolling: true,
        // Required for Docker on Windows (no native FS events through bind mounts)
        interval: 1e3
      },
      proxy: {
        // Local signed procurement documents use Django's MEDIA_URL. Proxy
        // them through Vite so relative attachment URLs open from previews.
        "/media": {
          target: apiUrl,
          changeOrigin: true,
          secure: false
        },
        "/api": {
          target: apiUrl,
          changeOrigin: true,
          secure: false,
          rewrite: (path2) => path2,
          // Soft-coded explicit timeouts so a stuck upstream surfaces as a
          // 504 rather than hanging the browser request indefinitely.
          timeout: PROXY_TIMEOUT_MS,
          proxyTimeout: PROXY_UPSTREAM_TIMEOUT_MS,
          // Optional fresh-DNS agent — only enabled when explicitly requested.
          ...PROXY_AGENT ? { agent: PROXY_AGENT } : {},
          configure: (proxy, options) => {
            proxy.on("error", (err, req, res) => {
              const msg = JSON.stringify({
                error: "backend_unavailable",
                message: `Proxy cannot reach backend at ${apiUrl}. Is it running?`,
                detail: err.message
              });
              console.log(`\u274C Proxy error \u2192 ${apiUrl}:`, err.message);
              if (!res.headersSent) {
                res.writeHead(503, { "Content-Type": "application/json", "Content-Length": Buffer.byteLength(msg) });
                res.end(msg);
              }
            });
            proxy.on("proxyReq", (proxyReq, req, res) => {
              proxyReq.setHeader("X-Forwarded-Host", "localhost:5173");
              proxyReq.setHeader("X-Forwarded-Proto", "http");
              proxyReq.setHeader("X-Forwarded-For", req.socket.remoteAddress);
              proxyReq.setHeader("Host", targetHost);
              console.log("\u{1F4E4} Proxy request:", req.method, req.url, "\u2192", apiUrl + req.url);
            });
          }
        }
      }
    },
    build: {
      outDir: "dist",
      sourcemap: true,
      // Soft-coded: Increase chunk size warning limit to 2 MB
      // Production bundles are large due to comprehensive feature set
      // Relying on Vite's automatic chunking to avoid circular dependencies
      chunkSizeWarningLimit: 2048
      // 2 MB (default is 500 KB)
    },
    // Soft-coded: explicitly pre-bundle packages that use non-standard ESM
    // default exports so Vite's esbuild can wrap them correctly.
    // Root cause: @mui/material uses @emotion/styled via @mui/styled-engine.
    // Without pre-bundling @emotion packages, the default export can resolve 
    // to undefined → "styled_default is not a function".
    optimizeDeps: {
      include: [
        "@emotion/styled",
        "@emotion/react",
        "@mui/styled-engine",
        "@mui/material"
      ]
    }
  };
});
export {
  vite_config_default as default
};
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsidml0ZS5jb25maWcuanMiXSwKICAic291cmNlc0NvbnRlbnQiOiBbImNvbnN0IF9fdml0ZV9pbmplY3RlZF9vcmlnaW5hbF9kaXJuYW1lID0gXCIvYXBwXCI7Y29uc3QgX192aXRlX2luamVjdGVkX29yaWdpbmFsX2ZpbGVuYW1lID0gXCIvYXBwL3ZpdGUuY29uZmlnLmpzXCI7Y29uc3QgX192aXRlX2luamVjdGVkX29yaWdpbmFsX2ltcG9ydF9tZXRhX3VybCA9IFwiZmlsZTovLy9hcHAvdml0ZS5jb25maWcuanNcIjtpbXBvcnQgeyBkZWZpbmVDb25maWcsIGxvYWRFbnYgfSBmcm9tICd2aXRlJ1xyXG5pbXBvcnQgcmVhY3QgZnJvbSAnQHZpdGVqcy9wbHVnaW4tcmVhY3QnXHJcbmltcG9ydCB7IFZpdGVQV0EgfSBmcm9tICd2aXRlLXBsdWdpbi1wd2EnXHJcbmltcG9ydCBwYXRoIGZyb20gJ3BhdGgnXHJcbmltcG9ydCBodHRwIGZyb20gJ2h0dHAnXHJcblxyXG4vLyBTb2Z0LWNvZGVkOiBkaXNhYmxlIEhUVFAga2VlcC1hbGl2ZSBzbyB0aGUgcHJveHkgcmUtcmVzb2x2ZXMgdGhlIGJhY2tlbmRcclxuLy8gaG9zdG5hbWUgb24gZXZlcnkgcmVxdWVzdC4gIFdpdGhvdXQgdGhpcywgTm9kZSBjYWNoZXMgdGhlIG9sZCBjb250YWluZXIgSVBcclxuLy8gYWZ0ZXIgYSBiYWNrZW5kIHJlc3RhcnQsIGNhdXNpbmcgNTAzIFwiY29ubmVjdCBFQ09OTlJFRlVTRURcIiBlcnJvcnMgdW50aWxcclxuLy8gdGhlIGZyb250ZW5kIGNvbnRhaW5lciBpcyBhbHNvIHJlc3RhcnRlZC5cclxuLy9cclxuLy8gTk9URTogdGhlIGN1c3RvbSBgYWdlbnRgIG9wdGlvbiBkb2VzIG5vdCBhbHdheXMgcHJvcGFnYXRlIGNsZWFubHkgdGhyb3VnaFxyXG4vLyBWaXRlJ3MgYnVuZGxlZCBodHRwLXByb3h5IGluIGRldiBtb2RlIGFuZCBoYXMgYmVlbiBvYnNlcnZlZCB0byBzaWxlbnRseVxyXG4vLyBzdGFsbCByZXF1ZXN0cyAocHJveHlSZXEgZXZlbnQgbmV2ZXIgZmlyZXMpLiAgSXQgaXMgdGhlcmVmb3JlIG9wdC1pbiB2aWFcclxuLy8gYFZJVEVfUFJPWFlfRElTQUJMRV9LRUVQQUxJVkU9MWAgcmF0aGVyIHRoYW4gYWx3YXlzLW9uLlxyXG5jb25zdCBQUk9YWV9BR0VOVCA9IHByb2Nlc3MuZW52LlZJVEVfUFJPWFlfRElTQUJMRV9LRUVQQUxJVkUgPT09ICcxJ1xyXG4gID8gbmV3IGh0dHAuQWdlbnQoeyBrZWVwQWxpdmU6IGZhbHNlIH0pXHJcbiAgOiB1bmRlZmluZWRcclxuXHJcbi8vIFNvZnQtY29kZWQgcHJveHkgdGltZW91dHMgKG92ZXJyaWRlIHZpYSBlbnYgdmFycyB3aGVuIG5lZWRlZClcclxuLy8gRGVmYXVsdCByYWlzZWQgdG8gMjAgbWluIHRvIGFjY29tbW9kYXRlIGxvbmctcnVubmluZyBBSSBleHRyYWN0aW9ucyBvblxyXG4vLyBkZW5zZSBtdWx0aS1wYWdlIFAmSURzIChJbnN0cnVtZW50IEluZGV4LCBQSUQgVmVyaWZpY2F0aW9uLCBQRkQgUXVhbGl0eSkuXHJcbi8vIE11c3Qgb3V0bGl2ZSB0aGUgY2xpZW50LXNpZGUgZmV0Y2ggdGltZW91dCAoY3VycmVudGx5IDE4IG1pbiBpblxyXG4vLyBJbnN0cnVtZW50SW5kZXguanN4KSBBTkQgc3RheSB3aXRoaW4gR3VuaWNvcm4ncyAyMC1taW4gd29ya2VyIHRpbWVvdXQsXHJcbi8vIG90aGVyd2lzZSB0aGUgcHJveHkgYWJvcnRzIHRoZSBzb2NrZXQgYW5kIHRoZSBicm93c2VyIHNob3dzXHJcbi8vIEVSUl9DT05ORUNUSU9OX1JFU0VUIC8gXCJ1cHN0cmVhbSBwcm94eSByZXNldFwiLlxyXG5jb25zdCBQUk9YWV9USU1FT1VUX01TID0gTnVtYmVyKHByb2Nlc3MuZW52LlZJVEVfUFJPWFlfVElNRU9VVF9NUyB8fCAxMjAwMDAwKVxyXG5jb25zdCBQUk9YWV9VUFNUUkVBTV9USU1FT1VUX01TID0gTnVtYmVyKHByb2Nlc3MuZW52LlZJVEVfUFJPWFlfVVBTVFJFQU1fVElNRU9VVF9NUyB8fCAxMjAwMDAwKVxyXG5cclxuLy8gaHR0cHM6Ly92aXRlanMuZGV2L2NvbmZpZy9cclxuZXhwb3J0IGRlZmF1bHQgZGVmaW5lQ29uZmlnKCh7IG1vZGUgfSkgPT4ge1xyXG4gIC8vIExvYWQgZW52aXJvbm1lbnQgdmFyaWFibGVzIGZvciB0aGlzIG1vZGVcclxuICBjb25zdCBlbnYgPSBsb2FkRW52KG1vZGUsIHByb2Nlc3MuY3dkKCksICcnKVxyXG4gIFxyXG4gIC8vIFNtYXJ0IEFQSSBVUkwgZGV0ZWN0aW9uIChzb2Z0LWNvZGVkIGZvciBEb2NrZXIgYW5kIHByb2R1Y3Rpb24pXHJcbiAgLy8gUHJpb3JpdHk6IFZJVEVfQVBJX1BST1hZX1RBUkdFVCBlbnYgdmFyIFx1MjE5MiBmYWxsYmFjayB0byBsb2NhbGhvc3Q6ODAwMFxyXG4gIC8vXHJcbiAgLy8gTW9kZXMgKHNldCBpbiAuZW52LmxvY2FsKTpcclxuICAvLyAgIExPQ0FMICBcdTIxOTIgVklURV9BUElfUFJPWFlfVEFSR0VUPWh0dHA6Ly9iYWNrZW5kX2xvY2FsOjgwMDBcclxuICAvLyAgIFBST0QgICBcdTIxOTIgVklURV9BUElfUFJPWFlfVEFSR0VUPWh0dHBzOi8vYWlmbG93YmFja2VuZC1wcm9kdWN0aW9uLnVwLnJhaWx3YXkuYXBwXHJcbiAgLy9cclxuICBsZXQgYXBpVXJsID0gZW52LlZJVEVfQVBJX1BST1hZX1RBUkdFVCB8fCAnaHR0cDovL2xvY2FsaG9zdDo4MDAwJ1xyXG4gIGNvbnN0IGFwaVVybE9iaiA9IG5ldyBVUkwoYXBpVXJsKVxyXG4gIGNvbnN0IHRhcmdldEhvc3QgPSBhcGlVcmxPYmouaG9zdCAvLyBkeW5hbWljOiAnbG9jYWxob3N0OjgwMDAnIE9SICdhaWZsb3diYWNrZW5kLXByb2R1Y3Rpb24udXAucmFpbHdheS5hcHAnXHJcblxyXG4gIC8vIFNvZnQtY29kZWQ6IGRldGVjdCB3aGVuIHBvaW50aW5nIGF0IHByb2R1Y3Rpb24gc28gd2UgY2FuIHdhcm4gaW4gdGhlIGJyb3dzZXJcclxuICBjb25zdCBJU19QUk9EX0JBQ0tFTkQgPSAhYXBpVXJsLmluY2x1ZGVzKCdsb2NhbGhvc3QnKSAmJiAhYXBpVXJsLmluY2x1ZGVzKCcxMjcuMC4wLjEnKSAmJiAhYXBpVXJsLmluY2x1ZGVzKCdiYWNrZW5kX2xvY2FsJykgJiYgIWFwaVVybC5pbmNsdWRlcygnYWlmbG93X2JhY2tlbmQnKVxyXG5cclxuICBjb25zb2xlLmxvZygnXHVEODNEXHVERDI3IFZpdGUgQ29uZmlnIC0gTW9kZTonLCBtb2RlKVxyXG4gIGNvbnNvbGUubG9nKCdcdUQ4M0RcdUREMjcgVml0ZSBDb25maWcgLSBQcm94eSBUYXJnZXQ6JywgYXBpVXJsKVxyXG4gIGlmIChJU19QUk9EX0JBQ0tFTkQpIHtcclxuICAgIGNvbnNvbGUubG9nKCdcdTI2QTBcdUZFMEYgIFBST0QgQkFDS0VORCBNT0RFIFx1MjAxNCBhbGwgQVBJIGNhbGxzIHByb3h5IHRvIFJhaWx3YXkgcHJvZHVjdGlvbi4gV3JpdGVzIGhpdCBwcm9kdWN0aW9uIGRhdGEhJylcclxuICB9XHJcblxyXG4gIHJldHVybiB7XHJcbiAgICBwbHVnaW5zOiBbXHJcbiAgICAgIHJlYWN0KCksXHJcbiAgICAgIFZpdGVQV0Eoe1xyXG4gICAgICAgIHJlZ2lzdGVyVHlwZTogJ2F1dG9VcGRhdGUnLFxyXG4gICAgICAgIGluY2x1ZGVBc3NldHM6IFsnYXNzZXRzL1JlamxlcnNfTG9nby5wbmcnLCAnZmF2aWNvbi5pY28nXSxcclxuICAgICAgICBtYW5pZmVzdDoge1xyXG4gICAgICAgICAgbmFtZTogJ1JBREFJJyxcclxuICAgICAgICAgIHNob3J0X25hbWU6ICdSQURBSScsXHJcbiAgICAgICAgICBkZXNjcmlwdGlvbjogJ05leHQtZ2VuZXJhdGlvbiBBSS1wb3dlcmVkIGVuZ2luZWVyaW5nIHdvcmtzcGFjZSBmb3IgdGhlIE9pbCAmIEdhcyBpbmR1c3RyeScsXHJcbiAgICAgICAgICB0aGVtZV9jb2xvcjogJyMwQTE2MjgnLFxyXG4gICAgICAgICAgYmFja2dyb3VuZF9jb2xvcjogJyMwQTE2MjgnLFxyXG4gICAgICAgICAgZGlzcGxheTogJ3N0YW5kYWxvbmUnLFxyXG4gICAgICAgICAgc2NvcGU6ICcvJyxcclxuICAgICAgICAgIHN0YXJ0X3VybDogJy8nLFxyXG4gICAgICAgICAgb3JpZW50YXRpb246ICdhbnknLFxyXG4gICAgICAgICAgaWNvbnM6IFtcclxuICAgICAgICAgICAge1xyXG4gICAgICAgICAgICAgIHNyYzogJy9hc3NldHMvaWNvbi0xOTJ4MTkyLnBuZycsXHJcbiAgICAgICAgICAgICAgc2l6ZXM6ICcxOTJ4MTkyJyxcclxuICAgICAgICAgICAgICB0eXBlOiAnaW1hZ2UvcG5nJyxcclxuICAgICAgICAgICAgICBwdXJwb3NlOiAnYW55IG1hc2thYmxlJ1xyXG4gICAgICAgICAgICB9LFxyXG4gICAgICAgICAgICB7XHJcbiAgICAgICAgICAgICAgc3JjOiAnL2Fzc2V0cy9pY29uLTUxMng1MTIucG5nJyxcclxuICAgICAgICAgICAgICBzaXplczogJzUxMng1MTInLFxyXG4gICAgICAgICAgICAgIHR5cGU6ICdpbWFnZS9wbmcnLFxyXG4gICAgICAgICAgICAgIHB1cnBvc2U6ICdhbnkgbWFza2FibGUnXHJcbiAgICAgICAgICAgIH1cclxuICAgICAgICAgIF0sXHJcbiAgICAgICAgICAvLyBEZXNrdG9wIHNob3J0Y3V0cyBmb3IgcXVpY2sgYWNjZXNzIHRvIGNvbW1vbiBmZWF0dXJlc1xyXG4gICAgICAgICAgc2hvcnRjdXRzOiBbXHJcbiAgICAgICAgICAgIHtcclxuICAgICAgICAgICAgICBuYW1lOiAnTG9naW4nLFxyXG4gICAgICAgICAgICAgIHNob3J0X25hbWU6ICdMb2dpbicsXHJcbiAgICAgICAgICAgICAgZGVzY3JpcHRpb246ICdRdWljayBsb2dpbiB0byBSQURBSScsXHJcbiAgICAgICAgICAgICAgdXJsOiAnL2xvZ2luJyxcclxuICAgICAgICAgICAgICBpY29uczogW3sgc3JjOiAnL2Fzc2V0cy9pY29uLTE5MngxOTIucG5nJywgc2l6ZXM6ICcxOTJ4MTkyJyB9XVxyXG4gICAgICAgICAgICB9LFxyXG4gICAgICAgICAgICB7XHJcbiAgICAgICAgICAgICAgbmFtZTogJ0Rhc2hib2FyZCcsXHJcbiAgICAgICAgICAgICAgc2hvcnRfbmFtZTogJ0Rhc2hib2FyZCcsXHJcbiAgICAgICAgICAgICAgZGVzY3JpcHRpb246ICdPcGVuIFJBREFJIERhc2hib2FyZCcsXHJcbiAgICAgICAgICAgICAgdXJsOiAnL2Rhc2hib2FyZCcsXHJcbiAgICAgICAgICAgICAgaWNvbnM6IFt7IHNyYzogJy9hc3NldHMvaWNvbi0xOTJ4MTkyLnBuZycsIHNpemVzOiAnMTkyeDE5MicgfV1cclxuICAgICAgICAgICAgfSxcclxuICAgICAgICAgICAge1xyXG4gICAgICAgICAgICAgIG5hbWU6ICdQSUQgVmVyaWZpY2F0aW9uJyxcclxuICAgICAgICAgICAgICBzaG9ydF9uYW1lOiAnUElEJyxcclxuICAgICAgICAgICAgICBkZXNjcmlwdGlvbjogJ1BJRCBWZXJpZmljYXRpb24gVG9vbCcsXHJcbiAgICAgICAgICAgICAgdXJsOiAnL2VuZ2luZWVyaW5nL3Byb2Nlc3MvcGlkLXZlcmlmaWNhdGlvbi12MScsIC8vIFNPRlQtQ09ERUQ6IFVwZGF0ZWQgdG8gVjEgcm91dGVcclxuICAgICAgICAgICAgICBpY29uczogW3sgc3JjOiAnL2Fzc2V0cy9pY29uLTE5MngxOTIucG5nJywgc2l6ZXM6ICcxOTJ4MTkyJyB9XVxyXG4gICAgICAgICAgICB9XHJcbiAgICAgICAgICBdXHJcbiAgICAgICAgfSxcclxuICAgICAgICB3b3JrYm94OiB7XHJcbiAgICAgICAgICBnbG9iUGF0dGVybnM6IFsnKiovKi57anMsY3NzLGh0bWwsaWNvLHBuZyxzdmcsd29mZix3b2ZmMn0nXSxcclxuICAgICAgICAgIC8vIENSSVRJQ0FMOiBJbmNyZWFzZSBmaWxlIHNpemUgbGltaXQgZm9yIHByZWNhY2hpbmcgbGFyZ2UgYnVuZGxlc1xyXG4gICAgICAgICAgLy8gRGVmYXVsdCAyIE1CIGlzIHRvbyBzbWFsbCBmb3IgcHJvZHVjdGlvbiBidWlsZHMgd2l0aCBhbGwgZmVhdHVyZXNcclxuICAgICAgICAgIC8vIFRoZSBjdXJyZW50IGZ1bGwtZmVhdHVyZSBidW5kbGUgaXMgfjE0IE1CIGJlZm9yZSBnemlwICh+Mi42IE1CXHJcbiAgICAgICAgICAvLyB0cmFuc2ZlcnJlZCkuIEtlZXAgZW5vdWdoIGhlYWRyb29tIGZvciBXb3JrYm94IHRvIGNvbXBsZXRlIHRoZVxyXG4gICAgICAgICAgLy8gcHJvZHVjdGlvbiBidWlsZCB3aGlsZSByZXRhaW5pbmcgb2ZmbGluZSBzdGFydHVwIHN1cHBvcnQuXHJcbiAgICAgICAgICBtYXhpbXVtRmlsZVNpemVUb0NhY2hlSW5CeXRlczogMjAgKiAxMDI0ICogMTAyNCwgLy8gMjAgTUJcclxuICAgICAgICAgIC8vIFNPRlQtQ09ERUQ6IEFsbG93IG5hdmlnYXRpb24gdG8gYWxsIHJvdXRlcyAobm90IGp1c3QgLylcclxuICAgICAgICAgIG5hdmlnYXRlRmFsbGJhY2s6ICdpbmRleC5odG1sJyxcclxuICAgICAgICAgIG5hdmlnYXRlRmFsbGJhY2tBbGxvd2xpc3Q6IFsvLiovXSwgLy8gQWxsb3cgYWxsIHBhdGhzIGZvciBTUEEgcm91dGluZ1xyXG4gICAgICAgICAgcnVudGltZUNhY2hpbmc6IFtcclxuICAgICAgICAgICAge1xyXG4gICAgICAgICAgICAgIHVybFBhdHRlcm46IC9eaHR0cHM6XFwvXFwvcmFkYWlcXC5hZVxcL2FwaVxcLy4qL2ksXHJcbiAgICAgICAgICAgICAgaGFuZGxlcjogJ05ldHdvcmtGaXJzdCcsXHJcbiAgICAgICAgICAgICAgb3B0aW9uczoge1xyXG4gICAgICAgICAgICAgICAgY2FjaGVOYW1lOiAnYXBpLWNhY2hlJyxcclxuICAgICAgICAgICAgICAgIGV4cGlyYXRpb246IHtcclxuICAgICAgICAgICAgICAgICAgbWF4RW50cmllczogMTAwLFxyXG4gICAgICAgICAgICAgICAgICBtYXhBZ2VTZWNvbmRzOiA2MCAqIDUgLy8gNSBtaW51dGVzXHJcbiAgICAgICAgICAgICAgICB9LFxyXG4gICAgICAgICAgICAgICAgY2FjaGVhYmxlUmVzcG9uc2U6IHtcclxuICAgICAgICAgICAgICAgICAgc3RhdHVzZXM6IFswLCAyMDBdXHJcbiAgICAgICAgICAgICAgICB9XHJcbiAgICAgICAgICAgICAgfVxyXG4gICAgICAgICAgICB9XHJcbiAgICAgICAgICBdXHJcbiAgICAgICAgfSxcclxuICAgICAgICBkZXZPcHRpb25zOiB7XHJcbiAgICAgICAgICBlbmFibGVkOiBmYWxzZSwgLy8gQXZvaWQgc3RhbGUgY2FjaGVkIGFwcGxpY2F0aW9uIGNvZGUgZHVyaW5nIGRldmVsb3BtZW50XHJcbiAgICAgICAgICB0eXBlOiAnbW9kdWxlJyxcclxuICAgICAgICAgIG5hdmlnYXRlRmFsbGJhY2s6ICdpbmRleC5odG1sJyxcclxuICAgICAgICAgIG5hdmlnYXRlRmFsbGJhY2tBbGxvd2xpc3Q6IFsvLiovXSAvLyBBbGxvdyBhbGwgcGF0aHMgaW4gZGV2IG1vZGVcclxuICAgICAgICB9XHJcbiAgICAgIH0pXHJcbiAgICBdLFxyXG4gICAgcmVzb2x2ZToge1xyXG4gICAgICBhbGlhczoge1xyXG4gICAgICAgICdAJzogcGF0aC5yZXNvbHZlKF9fZGlybmFtZSwgJy4vc3JjJyksXHJcbiAgICAgIH0sXHJcbiAgICAgIC8vIEZvcmNlIGEgc2luZ2xlIGluc3RhbmNlIG9mIGVtb3Rpb24gc28gYWxsIGNodW5rcyBzaGFyZSB0aGVcclxuICAgICAgLy8gc2FtZSBpbml0aWFsaXNlZCBtb2R1bGUgXHUyMDE0IHByZXZlbnRzIFwic3R5bGVkX2RlZmF1bHQgaXMgbm90IGEgZnVuY3Rpb25cIlxyXG4gICAgICAvLyB3aGVuIG11bHRpcGxlIHZlbmRvciBjaHVua3MgZWFjaCB0cnkgdG8gaW5pdGlhbGlzZSB0aGVpciBvd24gY29weS5cclxuICAgICAgZGVkdXBlOiBbJ0BlbW90aW9uL3JlYWN0JywgJ0BlbW90aW9uL3N0eWxlZCcsICdyZWFjdCcsICdyZWFjdC1kb20nXSxcclxuICAgIH0sXHJcbiAgICAvLyBTb2Z0LWNvZGVkOiBleHBvc2UgYmFja2VuZCBtb2RlIHRvIHRoZSBSZWFjdCBhcHAgYXMgYSBjb21waWxlLXRpbWUgY29uc3RhbnRcclxuICAgIC8vIFVzZSBpbiBjb21wb25lbnRzOiBpZiAoaW1wb3J0Lm1ldGEuZW52LlZJVEVfSVNfUFJPRF9CQUNLRU5EID09PSAndHJ1ZScpIHsgLi4uIH1cclxuICAgIC8vIHByb2Nlc3MuZW52Lk5PREVfRU5WIGlzIGRlZmluZWQgZm9yIGxpYnJhcmllcyB0aGF0IGNoZWNrIHRoZSBlbnZpcm9ubWVudFxyXG4gICAgZGVmaW5lOiB7XHJcbiAgICAgICdfX1BST0RfQkFDS0VORF9fJzogSlNPTi5zdHJpbmdpZnkoSVNfUFJPRF9CQUNLRU5EKSxcclxuICAgICAgJ3Byb2Nlc3MuZW52Lk5PREVfRU5WJzogSlNPTi5zdHJpbmdpZnkobW9kZSA9PT0gJ3Byb2R1Y3Rpb24nID8gJ3Byb2R1Y3Rpb24nIDogJ2RldmVsb3BtZW50JyksXHJcbiAgICB9LFxyXG4gICAgc2VydmVyOiB7XHJcbiAgICAgIGhvc3Q6ICcwLjAuMC4wJywgLy8gTGlzdGVuIG9uIGFsbCBpbnRlcmZhY2VzIGZvciBEb2NrZXJcclxuICAgICAgcG9ydDogNTE3MywgLy8gVXNlIHBvcnQgNTE3MyBmb3IgbG9jYWwgZGV2ZWxvcG1lbnRcclxuICAgICAgd2F0Y2g6IHtcclxuICAgICAgICB1c2VQb2xsaW5nOiB0cnVlLCAvLyBSZXF1aXJlZCBmb3IgRG9ja2VyIG9uIFdpbmRvd3MgKG5vIG5hdGl2ZSBGUyBldmVudHMgdGhyb3VnaCBiaW5kIG1vdW50cylcclxuICAgICAgICBpbnRlcnZhbDogMTAwMCxcclxuICAgICAgfSxcclxuICAgICAgcHJveHk6IHtcclxuICAgICAgICAvLyBMb2NhbCBzaWduZWQgcHJvY3VyZW1lbnQgZG9jdW1lbnRzIHVzZSBEamFuZ28ncyBNRURJQV9VUkwuIFByb3h5XHJcbiAgICAgICAgLy8gdGhlbSB0aHJvdWdoIFZpdGUgc28gcmVsYXRpdmUgYXR0YWNobWVudCBVUkxzIG9wZW4gZnJvbSBwcmV2aWV3cy5cclxuICAgICAgICAnL21lZGlhJzoge1xyXG4gICAgICAgICAgdGFyZ2V0OiBhcGlVcmwsXHJcbiAgICAgICAgICBjaGFuZ2VPcmlnaW46IHRydWUsXHJcbiAgICAgICAgICBzZWN1cmU6IGZhbHNlLFxyXG4gICAgICAgIH0sXHJcbiAgICAgICAgJy9hcGknOiB7XHJcbiAgICAgICAgICB0YXJnZXQ6IGFwaVVybCxcclxuICAgICAgICAgIGNoYW5nZU9yaWdpbjogdHJ1ZSxcclxuICAgICAgICAgIHNlY3VyZTogZmFsc2UsXHJcbiAgICAgICAgICByZXdyaXRlOiAocGF0aCkgPT4gcGF0aCxcclxuICAgICAgICAgIC8vIFNvZnQtY29kZWQgZXhwbGljaXQgdGltZW91dHMgc28gYSBzdHVjayB1cHN0cmVhbSBzdXJmYWNlcyBhcyBhXHJcbiAgICAgICAgICAvLyA1MDQgcmF0aGVyIHRoYW4gaGFuZ2luZyB0aGUgYnJvd3NlciByZXF1ZXN0IGluZGVmaW5pdGVseS5cclxuICAgICAgICAgIHRpbWVvdXQ6IFBST1hZX1RJTUVPVVRfTVMsXHJcbiAgICAgICAgICBwcm94eVRpbWVvdXQ6IFBST1hZX1VQU1RSRUFNX1RJTUVPVVRfTVMsXHJcbiAgICAgICAgICAvLyBPcHRpb25hbCBmcmVzaC1ETlMgYWdlbnQgXHUyMDE0IG9ubHkgZW5hYmxlZCB3aGVuIGV4cGxpY2l0bHkgcmVxdWVzdGVkLlxyXG4gICAgICAgICAgLi4uKFBST1hZX0FHRU5UID8geyBhZ2VudDogUFJPWFlfQUdFTlQgfSA6IHt9KSxcclxuICAgICAgICAgIGNvbmZpZ3VyZTogKHByb3h5LCBvcHRpb25zKSA9PiB7XHJcbiAgICAgICAgICAgIHByb3h5Lm9uKCdlcnJvcicsIChlcnIsIHJlcSwgcmVzKSA9PiB7XHJcbiAgICAgICAgICAgICAgLy8gU09GVC1DT0RFRDogc2VuZCBhIHByb3BlciBKU09OIDUwMyBpbnN0ZWFkIG9mIGEgc2lsZW50IGVtcHR5IDUwMFxyXG4gICAgICAgICAgICAgIC8vIHNvIHRoZSBmcm9udGVuZCBzaG93cyBhIG1lYW5pbmdmdWwgZXJyb3IgKGJhY2tlbmQgdW5yZWFjaGFibGUpXHJcbiAgICAgICAgICAgICAgY29uc3QgbXNnID0gSlNPTi5zdHJpbmdpZnkoe1xyXG4gICAgICAgICAgICAgICAgZXJyb3I6ICdiYWNrZW5kX3VuYXZhaWxhYmxlJyxcclxuICAgICAgICAgICAgICAgIG1lc3NhZ2U6IGBQcm94eSBjYW5ub3QgcmVhY2ggYmFja2VuZCBhdCAke2FwaVVybH0uIElzIGl0IHJ1bm5pbmc/YCxcclxuICAgICAgICAgICAgICAgIGRldGFpbDogZXJyLm1lc3NhZ2UsXHJcbiAgICAgICAgICAgICAgfSlcclxuICAgICAgICAgICAgICBjb25zb2xlLmxvZyhgXHUyNzRDIFByb3h5IGVycm9yIFx1MjE5MiAke2FwaVVybH06YCwgZXJyLm1lc3NhZ2UpXHJcbiAgICAgICAgICAgICAgaWYgKCFyZXMuaGVhZGVyc1NlbnQpIHtcclxuICAgICAgICAgICAgICAgIHJlcy53cml0ZUhlYWQoNTAzLCB7ICdDb250ZW50LVR5cGUnOiAnYXBwbGljYXRpb24vanNvbicsICdDb250ZW50LUxlbmd0aCc6IEJ1ZmZlci5ieXRlTGVuZ3RoKG1zZykgfSlcclxuICAgICAgICAgICAgICAgIHJlcy5lbmQobXNnKVxyXG4gICAgICAgICAgICAgIH1cclxuICAgICAgICAgICAgfSlcclxuICAgICAgICAgICAgcHJveHkub24oJ3Byb3h5UmVxJywgKHByb3h5UmVxLCByZXEsIHJlcykgPT4ge1xyXG4gICAgICAgICAgICAgIC8vIEZvcndhcmQgdGhlIG9yaWdpbmFsIGhvc3QgaGVhZGVyIGZvciBwcm9wZXIgVVJMIGdlbmVyYXRpb25cclxuICAgICAgICAgICAgICBwcm94eVJlcS5zZXRIZWFkZXIoJ1gtRm9yd2FyZGVkLUhvc3QnLCAnbG9jYWxob3N0OjUxNzMnKVxyXG4gICAgICAgICAgICAgIHByb3h5UmVxLnNldEhlYWRlcignWC1Gb3J3YXJkZWQtUHJvdG8nLCAnaHR0cCcpXHJcbiAgICAgICAgICAgICAgcHJveHlSZXEuc2V0SGVhZGVyKCdYLUZvcndhcmRlZC1Gb3InLCByZXEuc29ja2V0LnJlbW90ZUFkZHJlc3MpXHJcbiAgICAgICAgICAgICAgLy8gU09GVC1DT0RFRDogSG9zdCBkZXJpdmVzIGZyb20gdGFyZ2V0IFVSTCBcdTIwMTQgd29ya3MgZm9yIGJvdGggbG9jYWxob3N0IGFuZCBSYWlsd2F5XHJcbiAgICAgICAgICAgICAgcHJveHlSZXEuc2V0SGVhZGVyKCdIb3N0JywgdGFyZ2V0SG9zdClcclxuICAgICAgICAgICAgICBjb25zb2xlLmxvZygnXHVEODNEXHVEQ0U0IFByb3h5IHJlcXVlc3Q6JywgcmVxLm1ldGhvZCwgcmVxLnVybCwgJ1x1MjE5MicsIGFwaVVybCArIHJlcS51cmwpXHJcbiAgICAgICAgICAgIH0pXHJcbiAgICAgICAgICB9XHJcbiAgICAgICAgfSxcclxuICAgICAgfSxcclxuICAgIH0sXHJcbiAgICBidWlsZDoge1xyXG4gICAgICBvdXREaXI6ICdkaXN0JyxcclxuICAgICAgc291cmNlbWFwOiB0cnVlLFxyXG4gICAgICAvLyBTb2Z0LWNvZGVkOiBJbmNyZWFzZSBjaHVuayBzaXplIHdhcm5pbmcgbGltaXQgdG8gMiBNQlxyXG4gICAgICAvLyBQcm9kdWN0aW9uIGJ1bmRsZXMgYXJlIGxhcmdlIGR1ZSB0byBjb21wcmVoZW5zaXZlIGZlYXR1cmUgc2V0XHJcbiAgICAgIC8vIFJlbHlpbmcgb24gVml0ZSdzIGF1dG9tYXRpYyBjaHVua2luZyB0byBhdm9pZCBjaXJjdWxhciBkZXBlbmRlbmNpZXNcclxuICAgICAgY2h1bmtTaXplV2FybmluZ0xpbWl0OiAyMDQ4LCAvLyAyIE1CIChkZWZhdWx0IGlzIDUwMCBLQilcclxuICAgIH0sXHJcbiAgICAvLyBTb2Z0LWNvZGVkOiBleHBsaWNpdGx5IHByZS1idW5kbGUgcGFja2FnZXMgdGhhdCB1c2Ugbm9uLXN0YW5kYXJkIEVTTVxyXG4gICAgLy8gZGVmYXVsdCBleHBvcnRzIHNvIFZpdGUncyBlc2J1aWxkIGNhbiB3cmFwIHRoZW0gY29ycmVjdGx5LlxyXG4gICAgLy8gUm9vdCBjYXVzZTogQG11aS9tYXRlcmlhbCB1c2VzIEBlbW90aW9uL3N0eWxlZCB2aWEgQG11aS9zdHlsZWQtZW5naW5lLlxyXG4gICAgLy8gV2l0aG91dCBwcmUtYnVuZGxpbmcgQGVtb3Rpb24gcGFja2FnZXMsIHRoZSBkZWZhdWx0IGV4cG9ydCBjYW4gcmVzb2x2ZSBcclxuICAgIC8vIHRvIHVuZGVmaW5lZCBcdTIxOTIgXCJzdHlsZWRfZGVmYXVsdCBpcyBub3QgYSBmdW5jdGlvblwiLlxyXG4gICAgb3B0aW1pemVEZXBzOiB7XHJcbiAgICAgIGluY2x1ZGU6IFtcclxuICAgICAgICAnQGVtb3Rpb24vc3R5bGVkJyxcclxuICAgICAgICAnQGVtb3Rpb24vcmVhY3QnLFxyXG4gICAgICAgICdAbXVpL3N0eWxlZC1lbmdpbmUnLFxyXG4gICAgICAgICdAbXVpL21hdGVyaWFsJyxcclxuICAgICAgXSxcclxuICAgIH0sXHJcbiAgfVxyXG59KVxyXG5cclxuIl0sCiAgIm1hcHBpbmdzIjogIjtBQUE4TCxTQUFTLGNBQWMsZUFBZTtBQUNwTyxPQUFPLFdBQVc7QUFDbEIsU0FBUyxlQUFlO0FBQ3hCLE9BQU8sVUFBVTtBQUNqQixPQUFPLFVBQVU7QUFKakIsSUFBTSxtQ0FBbUM7QUFlekMsSUFBTSxjQUFjLFFBQVEsSUFBSSxpQ0FBaUMsTUFDN0QsSUFBSSxLQUFLLE1BQU0sRUFBRSxXQUFXLE1BQU0sQ0FBQyxJQUNuQztBQVNKLElBQU0sbUJBQW1CLE9BQU8sUUFBUSxJQUFJLHlCQUF5QixJQUFPO0FBQzVFLElBQU0sNEJBQTRCLE9BQU8sUUFBUSxJQUFJLGtDQUFrQyxJQUFPO0FBRzlGLElBQU8sc0JBQVEsYUFBYSxDQUFDLEVBQUUsS0FBSyxNQUFNO0FBRXhDLFFBQU0sTUFBTSxRQUFRLE1BQU0sUUFB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
