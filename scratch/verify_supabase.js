
const https = require('https');

const url = 'https://yakxdxdzuojafzdkqhjd.supabase.co/rest/v1/v2_programs?select=*';
const options = {
  headers: {
    'apikey': 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inlha3hkeGR6dW9qYWZ6ZGtxaGpkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzg4ODI0OTMsImV4cCI6MjA5MzQ1ODQ5M30.prRdDM3ENoIOzdI-osQ4dObE-_W3ASYVdZXYbF4iBk8',
    'Authorization': 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inlha3hkeGR6dW9qYWZ6ZGtxaGpkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzg4ODI0OTMsImV4cCI6MjA5MzQ1ODQ5M30.prRdDM3ENoIOzdI-osQ4dObE-_W3ASYVdZXYbF4iBk8'
  }
};

https.get(url, options, (res) => {
  let data = '';
  console.log('Status Code:', res.statusCode);
  res.on('data', (chunk) => { data += chunk; });
  res.on('end', () => { console.log('Response:', data); });
}).on('error', (err) => {
  console.error('Error:', err.message);
});
