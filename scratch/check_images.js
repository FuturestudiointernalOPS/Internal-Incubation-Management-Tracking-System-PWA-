import db from './src/lib/db.js';

async function checkImages() {
  try {
    console.log("Checking contacts table...");
    const contacts = await db.execute("SELECT cid, name, email, image FROM contacts WHERE image IS NOT NULL LIMIT 10");
    console.log("Contacts with images:", JSON.stringify(contacts.rows, null, 2));

    console.log("\nChecking v2_submissions table...");
    const submissions = await db.execute("SELECT id, participant_id, file_url FROM v2_submissions WHERE file_url IS NOT NULL LIMIT 10");
    console.log("Submissions with file_url:", JSON.stringify(submissions.rows, null, 2));

    process.exit(0);
  } catch (e) {
    console.error(e);
    process.exit(1);
  }
}

checkImages();
