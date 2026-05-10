
async function test() {
  const res = await fetch('http://localhost:3000/api/contacts/full-state');
  const data = await res.json();
  console.log("FAMILIES:", JSON.stringify(data.families, null, 2));
  console.log("CONTACTS GROUP NAMES:", data.contacts.map(c => c.group_name));
}
test();
