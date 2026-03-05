import { createClient } from '@supabase/supabase-js'

const supabaseUrl = 'https://tkakaqtvqizulyhqnbcc.supabase.co'
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InRrYWthcXR2cWl6dWx5aHFuYmNjIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzI2NzMwNjEsImV4cCI6MjA4ODI0OTA2MX0._eux6XJBXYnm6VUwtJFhUPUqcHfjAwIUuTBRptTv1iA'

export const supabase = createClient(supabaseUrl, supabaseAnonKey)