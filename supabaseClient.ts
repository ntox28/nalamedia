import { createClient } from '@supabase/supabase-js';

// URL dan Kunci API Supabase Anda.
const supabaseUrl = 'https://wqgbkwujfxdwlywxrjup.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6IndxZ2Jrd3VqZnhkd2x5d3hyanVwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTYwNTE1NzAsImV4cCI6MjA3MTYyNzU3MH0.CHuHtbCshDYW3cVauSK5RjAjguiCN6DASECoJ7EApCw';

export const supabase = createClient(supabaseUrl, supabaseAnonKey);
