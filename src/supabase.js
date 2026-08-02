import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || 'https://gtvklcbkneboymyymkao.supabase.co'
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imd0dmtsY2JrbmVib3lteXlta2FvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODU2ODg5NTYsImV4cCI6MjEwMTI2NDk1Nn0.lD3TEDpSpR-ra-Ec_mDeYq8lmpEoznKWz0Wap91u0U8'

export const supabaseClient = supabaseUrl && supabaseAnonKey ? createClient(supabaseUrl, supabaseAnonKey) : null
