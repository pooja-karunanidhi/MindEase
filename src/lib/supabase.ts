import { createClient } from '@supabase/supabase-js';

// @ts-ignore
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
// @ts-ignore
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  console.error('Supabase URL or Anon Key is missing in environment variables.');
}

// Ensure we don't pass empty strings or invalid URLs to createClient which would throw
const isValidUrl = (url: any): url is string => {
  if (typeof url !== 'string' || !url) return false;
  try {
    new URL(url);
    return true;
  } catch {
    return false;
  }
};

console.log('Supabase URL from env:', supabaseUrl ? `${supabaseUrl.substring(0, 15)}...` : 'undefined');
console.log('Supabase Key from env:', supabaseAnonKey ? 'defined' : 'undefined');

const validUrl = isValidUrl(supabaseUrl) ? supabaseUrl : 'https://placeholder.supabase.co';
const validKey = (typeof supabaseAnonKey === 'string' && supabaseAnonKey) ? supabaseAnonKey : 'placeholder-key';

if (validUrl.includes('placeholder') || !validUrl.startsWith('http')) {
  console.warn('CRITICAL: Supabase URL is invalid or using placeholder. Current value:', supabaseUrl);
  if (supabaseUrl === '1234') {
    console.error('ERROR: Supabase URL is set to "1234". This is likely a configuration error. Please update VITE_SUPABASE_URL in your environment.');
  }
}

console.log('Initializing Supabase client with URL:', validUrl.substring(0, 15) + '...');

// Use the backend proxy for Supabase requests to bypass browser-side network blocks/CORS
const proxyUrl = `${window.location.origin}/api/supabase-proxy`;
console.log('Using Supabase Proxy URL:', proxyUrl);

export const supabase = createClient(validUrl, validKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
  },
  global: {
    // Custom fetch to handle proxying
    fetch: async (url, options) => {
      // Rewrite the URL to point to our proxy
      // Supabase SDK calls something like https://fuufzusquyjcrwweisdx.supabase.co/rest/v1/...
      // We want to call /api/supabase-proxy/rest/v1/...
      const originalUrl = new URL(url.toString());
      const finalFetchUrl = `${proxyUrl}${originalUrl.pathname}${originalUrl.search}`;
      return fetch(finalFetchUrl, options);
    }
  }
});

// Connection test - run once and be silent if it fails to avoid console noise
const testConnection = async () => {
  try {
    const { error } = await supabase
      .from('profiles')
      .select('id')
      .limit(1);
    
    if (error) {
      const message = error.message || '';
      if (error.code === 'PGRST116' || message.includes('relation') || error.code === '42P01') {
        console.log('Supabase connection successful (but profiles table might not exist yet)');
        return;
      }
      throw error;
    }
    
    console.log('Supabase connection test successful.');
  } catch (err: any) {
    // Only log if it's not a fetch error, or log it once quietly
    const message = err?.message || (typeof err === 'object' ? JSON.stringify(err) : String(err));
    if (message.includes('fetch')) {
      console.warn('Supabase fetch failed. This is likely a network or CORS issue. Check your browser console for details.');
    } else {
      console.error('Supabase connection test failed:', message);
    }
  }
};

// Direct fetch test for diagnostics - run once quietly
const directFetchTest = async () => {
  try {
    const response = await fetch(`${validUrl}/rest/v1/profiles?select=id&limit=1`, {
      method: 'GET',
      headers: {
        'apikey': validKey,
        'Authorization': `Bearer ${validKey}`
      }
    });
    if (!response.ok && response.status !== 404 && response.status !== 401) {
      console.warn('Direct fetch test status:', response.status, response.statusText);
    }
  } catch (err: any) {
    // Silent failure for direct fetch test
  }
};

directFetchTest();
testConnection();
