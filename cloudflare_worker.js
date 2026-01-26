export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);

    // --- FRONTEND ASSET FIX ---
    // If the request is for static assets (js, css, svg), we should NOT proxy it to the backend.
    // The browser is asking the WORKER for these files because the backend redirect sent us to /callback
    // on the worker domain, so relative paths like /assets/... break.
    // 
    // Ideally, the backend should redirect back to the ACTUAL frontend domain.
    // But since we are here, we can just return a 404 for assets and let the frontend handle it,
    // OR, we can try to redirect these asset requests back to the frontend (Cloudflare Pages).
    
    if (url.pathname.startsWith("/assets/") || url.pathname.endsWith(".svg") || url.pathname.endsWith(".ico")) {
      // Redirect asset requests back to the frontend domain
      // We need to know your Cloudflare Pages URL. 
      // Based on previous context, it seems to be https://spotify-alt.pages.dev
      const FRONTEND_URL = "https://spotify-alt.pages.dev"; 
      return Response.redirect(`${FRONTEND_URL}${url.pathname}`, 302);
    }

    // --- BACKEND PROXY ---
    // This part is working now! (No more 1003 error)
    const BACKEND_HOST = "ip217.154.114-227.pbiaas.com";
    const BACKEND_PORT = "11700";
    
    const targetUrl = `http://${BACKEND_HOST}:${BACKEND_PORT}${url.pathname}${url.search}`;

    const proxyRequest = new Request(targetUrl, {
      method: request.method,
      headers: {
        "Accept": "*/*", 
        "User-Agent": "Cloudflare-Worker-Proxy",
        ...(request.headers.get("Content-Type") && { "Content-Type": request.headers.get("Content-Type") })
      },
      body: request.body,
      redirect: "follow"
    });

    try {
      const response = await fetch(proxyRequest);
      
      // If the backend returns a redirect (like to the frontend), pass it through.
      // But we need to make sure it doesn't redirect back to an HTTP URL if possible.
      return response;
    } catch (err) {
      return new Response("Proxy Error: " + err.message, { status: 500 });
    }
  }
};
