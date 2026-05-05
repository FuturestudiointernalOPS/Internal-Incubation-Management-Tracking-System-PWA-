const { createClient } = require('@supabase/supabase-js');

// HARDCODED SECURE INITIALIZATION (Extracted from .env.local)
const supabaseUrl = "https://yakxdxdzuojafzdkqhjd.supabase.co";
const serviceRoleKey = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inlha3hkeGR6dW9qYWZ6ZGtxaGpkIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3Nzg4MjQ5MywiZXhwIjoyMDkzNDU4NDkzfQ.M3EGObWRFB0pukk-048PU_po9Augz0Uk5Ls-hgbhF5w";

const supabase = createClient(supabaseUrl, serviceRoleKey);

async function initializeStorage() {
  console.log("--- IMPACTOS STORAGE INITIALIZATION ---");
  
  const buckets = ['knowledge', 'materials'];
  
  for (const bucketName of buckets) {
    console.log(`Checking bucket: ${bucketName}...`);
    
    try {
      const { data: bucket, error: getError } = await supabase.storage.getBucket(bucketName);
      
      if (getError && getError.message.includes('not found')) {
        console.log(`Bucket ${bucketName} not found. Creating...`);
        const { error: createError } = await supabase.storage.createBucket(bucketName, {
          public: true,
          allowedMimeTypes: ['application/pdf', 'image/png', 'image/jpeg'],
          fileSizeLimit: 10485760 // 10MB
        });
        
        if (createError) {
          console.error(`Failed to create ${bucketName}:`, createError.message);
        } else {
          console.log(`Successfully created bucket: ${bucketName}`);
        }
      } else if (getError) {
        console.error(`Error checking ${bucketName}:`, getError.message);
      } else {
        console.log(`Bucket ${bucketName} already exists.`);
      }
    } catch (e) {
      console.error(`Exception for ${bucketName}:`, e.message);
    }
  }
  
  console.log("--- INITIALIZATION COMPLETE ---");
}

initializeStorage();
