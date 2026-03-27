import { createClient } from '@supabase/supabase-js';

// MIT Supabase credentials
const supabaseUrl = 'https://ufxxqirqupvtgmraxbak.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVmeHhxaXJxdXB2dGdtcmF4YmFrIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzIzNDkwMzEsImV4cCI6MjA4NzkyNTAzMX0.-hv178Vm55HeE3VHdKiujkEfv9CZXaOUWlbynNI1XdM';

// Service role key - ONLY for admin operations (system_settings, etc.)
// TODO: Move sensitive operations to Supabase Edge Functions in production
const supabaseServiceRoleKey = import.meta.env.VITE_SUPABASE_SERVICE_ROLE_KEY;

// Single Supabase client for all operations (uses anon key with RLS)
// This prevents multiple GoTrueClient instances
export const supabase = createClient(supabaseUrl, supabaseAnonKey);

// Admin client for system-level operations (bypasses RLS - use carefully!)
// Only create if service role key is available and different from anon key
export const supabaseAdmin = supabaseServiceRoleKey && supabaseServiceRoleKey !== supabaseAnonKey
  ? (() => {
      try {
        return createClient(supabaseUrl, supabaseServiceRoleKey, {
          auth: {
            // Disable auto-refresh for service role to avoid conflicts
            autoRefreshToken: false,
            persistSession: false,
            detectSessionInUrl: false
          }
        });
      } catch (error) {
        console.warn('Failed to create admin Supabase client:', error);
        return null;
      }
    })()
  : null;
