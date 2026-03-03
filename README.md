# X-ray ANWH

A professional work schedule management system built with React, TypeScript, and Supabase.

## Supabase Configuration for GitHub Pages

Since GitHub Pages doesn't support server-side environment variables, you need to configure Supabase directly in the code:

### Step 1: Update Supabase Configuration
1. Open `src/lib/supabase.ts`
2. Replace the placeholder values with your actual Supabase credentials:
   ```typescript
   const supabaseUrl = 'https://your-project-id.supabase.co';
   const supabaseAnonKey = 'your-anon-key-here';
   ```

### Step 2: Create Database Tables
Run this SQL in your Supabase SQL Editor:

```sql
-- Create the roster_entries table
CREATE TABLE roster_entries (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  date DATE NOT NULL,
  shift_type TEXT NOT NULL,
  assigned_name TEXT,
  last_edited_by TEXT,
  last_edited_at TEXT,
  change_description TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable Row Level Security
ALTER TABLE roster_entries ENABLE ROW LEVEL SECURITY;

-- Create policy to allow all operations (since this is internal use)
CREATE POLICY "Allow all operations on roster_entries" ON roster_entries
FOR ALL USING (true);
```

### Step 3: Add Sample Data (Optional)
```sql
-- Insert sample roster data
INSERT INTO roster_entries (date, shift_type, assigned_name, last_edited_by, last_edited_at) VALUES
('2025-01-20', 'Morning Shift (9-4)', 'NARAYYA', 'NARAYYA', '20-01-2025 09:00:00'),
('2025-01-20', 'Evening Shift (4-10)', 'Subita', 'NARAYYA', '20-01-2025 09:00:00'),
('2025-01-20', 'Night Duty', 'Dr. Smith', 'NARAYYA', '20-01-2025 09:00:00');
```

## Features

- 📅 Interactive calendar with shift scheduling
- 💰 Automatic salary calculations
- 🔄 Data import/export functionality
- 📱 Mobile-responsive design
- 🔒 Secure roster management with authentication
- 💾 Offline-capable with IndexedDB storage

## Development

```bash
npm install
npm run dev
```

## Deployment

- **GitHub Pages**: `npm run build:github`
- **Netlify**: `npm run build:netlify`