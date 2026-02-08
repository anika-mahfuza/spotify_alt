export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);

    // --- FRONTEND ASSET FIX ---
    if (url.pathname.startsWith("/assets/") || url.pathname.endsWith(".svg") || url.pathname.endsWith(".ico")) {
      const FRONTEND_URL = "https://spotify-alt.pages.dev"; 
      return Response.redirect(`${FRONTEND_URL}${url.pathname}`, 302);
    }

    // --- CORS PREFLIGHT (OPTIONS) ---
    if (request.method === "OPTIONS") {
      return new Response(null, {
        headers: {
          "Access-Control-Allow-Origin": "*", 
          "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
          "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Requested-With",
          "Access-Control-Max-Age": "86400",
        },
      });
    }

    // --- BACKEND PROXY (via sslip.io to bypass Cloudflare IP restriction) ---
    // Cloudflare Workers block direct IP access (Error 1003).
    // We use sslip.io, a free DNS service that maps ANY-IP.sslip.io to that IP.
    const BACKEND_HOST = "212.227.64.179.sslip.io"; 
    const BACKEND_PORT = "11946";
    
    // We construct the URL with sslip.io domain
    const targetUrl = `http://${BACKEND_HOST}:${BACKEND_PORT}${url.pathname}${url.search}`;

    // Clone original headers to preserve audio streaming headers (Accept, Range, etc.)
    const proxyHeaders = new Headers(request.headers);
    
    // Override/set only necessary proxy headers
    proxyHeaders.set("User-Agent", "Cloudflare-Worker-Proxy");
    proxyHeaders.set("Host", `212.227.64.179:${BACKEND_PORT}`);
    // Remove any existing Origin to avoid CORS issues
    proxyHeaders.delete("Origin");
    
    const proxyRequest = new Request(targetUrl, {
      method: request.method,
      headers: proxyHeaders,
      body: request.body,
      redirect: "manual" 
    });

    try {
      const response = await fetch(proxyRequest);
      
      // --- ADD CORS HEADERS TO RESPONSE ---
      const newHeaders = new Headers(response.headers);
      newHeaders.set("Access-Control-Allow-Origin", "*");
      newHeaders.set("Access-Control-Expose-Headers", "*");

      return new Response(response.body, {
        status: response.status,
        statusText: response.statusText,
        headers: newHeaders
      });
    } catch (err) {
      return new Response("Proxy Error: " + err.message, { status: 500 });
    }
  }
};