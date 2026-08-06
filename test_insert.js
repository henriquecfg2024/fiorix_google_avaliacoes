const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');

const supabase = createClient(
  'https://aws-0-sa-east-1.pooler.supabase.com',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...' // I don't have the anon key. Let's use Prisma to test inserting!
);
