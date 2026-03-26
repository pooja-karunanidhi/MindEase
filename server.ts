import express from "express";
import { createServer as createViteServer } from "vite";
import http from "http";
import path from "path";
import { fileURLToPath } from "url";
import dotenv from "dotenv";

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const server = http.createServer(app);
const PORT = 3000;

app.use(express.json());

// Supabase Proxy to bypass browser-side network blocks/CORS
app.all('/api/supabase-proxy/*', async (req, res) => {
  const supabaseUrl = (process.env.VITE_SUPABASE_URL || '').trim();
  const supabaseKey = (process.env.VITE_SUPABASE_ANON_KEY || '').trim();

  if (!supabaseUrl || !supabaseKey) {
    console.error('Supabase environment variables missing on server. URL:', !!supabaseUrl, 'Key:', !!supabaseKey);
    return res.status(500).json({ error: 'Supabase environment variables missing on server' });
  }

  // Handle req.params[0] safely
  const rawPath = req.params[0] || '';
  const path = rawPath.startsWith('/') ? rawPath.substring(1) : rawPath;
  const query = new URLSearchParams(req.query as any).toString();
  
  // Ensure we don't have double slashes if supabaseUrl ends with one
  const baseUrl = supabaseUrl.endsWith('/') ? supabaseUrl.slice(0, -1) : supabaseUrl;
  
  // CRITICAL: If baseUrl is not a valid URL (like '1234'), this will fail.
  if (!baseUrl.startsWith('http')) {
    console.error('Supabase URL does not start with http:', baseUrl);
    return res.status(500).json({ 
      error: 'Invalid Supabase URL configured', 
      details: `The configured Supabase URL "${baseUrl}" is not a valid URL. It must start with http:// or https://. Please update your environment variables in the AI Studio Settings menu.` 
    });
  }

  const url = `${baseUrl}/${path}${query ? '?' + query : ''}`;

  console.log(`Proxying ${req.method} request to: ${url}`);

  try {
    // Validate URL before using it
    let parsedUrl;
    try {
      parsedUrl = new URL(url);
    } catch (e) {
      throw new Error(`Invalid URL constructed: ${url}`);
    }

    const fetchOptions: RequestInit = {
      method: req.method,
      headers: {
        'apikey': supabaseKey,
        'Authorization': req.headers.authorization || `Bearer ${supabaseKey}`,
        'Content-Type': req.headers['content-type'] || 'application/json',
        'Accept': 'application/json',
        'Prefer': req.headers['prefer'] || '',
      } as any,
    };

    if (['POST', 'PUT', 'PATCH'].includes(req.method)) {
      fetchOptions.body = JSON.stringify(req.body);
    }

    const response = await fetch(url, fetchOptions);
    console.log(`Supabase responded with status: ${response.status}`);

    // Forward headers that might be important (like pagination info)
    const headersToForward = ['content-range', 'content-type', 'preference-applied'];
    headersToForward.forEach(h => {
      const val = response.headers.get(h);
      if (val) res.setHeader(h, val);
    });

    const contentType = response.headers.get('content-type');
    if (contentType && contentType.includes('application/json')) {
      const data = await response.json();
      res.status(response.status).json(data);
    } else {
      const text = await response.text();
      res.status(response.status).send(text);
    }
  } catch (error: any) {
    console.error('Supabase Proxy Error:', error.message);
    res.status(500).json({ error: 'Failed to proxy request to Supabase', details: error.message });
  }
});

// Vite middleware for development
async function setupVite() {
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    app.use(express.static(path.join(__dirname, "dist")));
    app.get("*", (req, res) => {
      res.sendFile(path.join(__dirname, "dist", "index.html"));
    });
  }
}

async function startServer() {
  console.log('Starting server...');
  console.log('VITE_SUPABASE_URL in process.env:', process.env.VITE_SUPABASE_URL);
  console.log('VITE_SUPABASE_ANON_KEY in process.env:', !!process.env.VITE_SUPABASE_ANON_KEY);
  
  await setupVite();

  if (process.env.NODE_ENV !== "production" || !process.env.VERCEL) {
    server.listen(PORT, "0.0.0.0", () => {
      console.log(`Server running on http://0.0.0.0:${PORT}`);
    });
  }
}

startServer();

export default app;
