import { readFileSync } from "fs";
import { fileURLToPath } from "url";
import { dirname, resolve } from "path";
const __dirname = dirname(fileURLToPath(import.meta.url));
const projectRoot = resolve(__dirname, "..");
const envPath = resolve(projectRoot, ".env.local");
try { const envContent = readFileSync(envPath, "utf-8"); for (const line of envContent.split("\n")) { const eqIdx = line.indexOf("="); if (eqIdx > 0 && !line.startsWith("#")) { const key = line.substring(0, eqIdx).trim(); const value = line.substring(eqIdx + 1).trim(); if (!process.env[key]) process.env[key] = value; } } } catch (_) {}
import { initDb } from "../src/lib/db.js";
import bcrypt from "bcryptjs";

const db = await initDb();
const PASSWORD = await bcrypt.hash("ImpactOS2026!", 10);

const investors = [
  {
    name: "Amara Diop",
    email: "amara.diop@investors.test",
    org: "Teranga Capital",
    role: "investor",
    industries: ["FinTech", "AgriTech", "CleanTech"],
    countries: ["SN", "CI", "ML", "BF"],
    stages: ["Seed", "Series A"],
    ticket_min: 100000,
    ticket_max: 500000,
    experience: "15 years in West African private equity. Previously Managing Director at Ecobank Capital. Focus on financial inclusion and agricultural value chains.",
    portfolio: "Wave Mobile Money (Series B, $10M), Sunu Assurance (Growth, $5M), AgroExpress (Seed, $750K)",
  },
  {
    name: "Kwame Asante",
    email: "kwame.asante@investors.test",
    org: "Ashanti Ventures",
    role: "investor",
    industries: ["EdTech", "HealthTech", "Logistics"],
    countries: ["GH", "NG", "KE"],
    stages: ["Pre-Seed", "Seed"],
    ticket_min: 25000,
    ticket_max: 150000,
    experience: "Angel investor and serial entrepreneur. Founded 3 tech startups in Accra. Active mentor at MEST Africa. Passionate about education and healthcare transformation.",
    portfolio: "mPharma (Seed, $200K), Complete Farmer (Pre-Seed, $50K), KudiGo (Seed, $100K)",
  },
  {
    name: "Fatima El-Khoury",
    email: "fatima.elkhoury@investors.test",
    org: "Rafik Investments",
    role: "investor",
    industries: ["AI/ML", "SaaS", "Renewable Energy", "E-Commerce"],
    countries: ["MA", "EG", "TN", "KE", "NG"],
    stages: ["Series A", "Series B", "Growth"],
    ticket_min: 500000,
    ticket_max: 2000000,
    experience: "Managing Partner at Rafik Investments. 20+ years in MENA and African tech. Former CTO at a Nasdaq-listed company. Deep expertise in AI, cloud infrastructure, and clean energy.",
    portfolio: "Careem (Series C, $5M), MaxAB (Series A, $3M), Dayra (Growth, $8M)",
  },
  {
    name: "Emmanuel Ndayishimiye",
    email: "emmanuel.nday@investors.test",
    org: "Great Lakes Impact Fund",
    role: "investor",
    industries: ["AgriTech", "CleanTech", "Logistics", "FinTech"],
    countries: ["RW", "UG", "TZ", "CD", "KE"],
    stages: ["Pre-Seed", "Seed"],
    ticket_min: 50000,
    ticket_max: 300000,
    experience: "Impact investor focused on the Great Lakes region. Background in agricultural economics. Managed $50M impact fund at KfW Development Bank. Believes in patient capital for transformative ideas.",
    portfolio: "Zipline Rwanda (Growth, $2M), AC Group (Seed, $500K), Ampersand (Series A, $1.5M)",
  },
  {
    name: "Chiamaka Okonkwo",
    email: "chiamaka.okonkwo@investors.test",
    org: "Nkata Capital Partners",
    role: "investor",
    industries: ["FinTech", "E-Commerce", "Logistics", "AI/ML"],
    countries: ["NG", "GH", "ZA", "KE"],
    stages: ["Seed", "Series A", "Series B"],
    ticket_min: 200000,
    ticket_max: 1000000,
    experience: "Ex-Goldman Sachs. Founded Nkata Capital in 2019. Focus on fintech infrastructure and B2B marketplaces. Board member at 4 portfolio companies. MBA from London Business School.",
    portfolio: "Flutterwave (Series D, $15M), TradeDepot (Series B, $7M), Sabi (Series A, $3M)",
  },
];

for (const inv of investors) {
  const cid = "USR-INV-" + Math.random().toString(36).substring(2, 10).toUpperCase();

  // Check if exists
  const exists = await db.execute({ sql: "SELECT cid FROM contacts WHERE email = ? AND deleted_at IS NULL", args: [inv.email] });
  if (exists.rows.length > 0) {
    console.log(`⏭️ ${inv.name} already exists`);
    continue;
  }

  // Create contact
  await db.execute({
    sql: "INSERT INTO contacts (cid, name, email, password, role, created_at, status) VALUES (?, ?, ?, ?, ?, NOW(), 'active')",
    args: [cid, inv.name, inv.email, PASSWORD, inv.role],
  });

  // Create investor profile (pre-approved for testing)
  const profileRes = await db.execute({
    sql: `INSERT INTO investor_profiles (user_id, approval_status, organization_name, biography, website)
          VALUES (?, 'approved', ?, ?, ?) RETURNING id`,
    args: [cid, inv.org, inv.experience, `https://${inv.org.toLowerCase().replace(/\s+/g, "")}.com`],
  });
  const profileId = profileRes.rows[0].id;

  // Create preferences
  await db.execute({
    sql: `INSERT INTO investor_preferences (investor_id, industries, countries, startup_stages, ticket_size_min, ticket_size_max)
          VALUES (?, ?, ?, ?, ?, ?)`,
    args: [profileId, inv.industries, inv.countries, inv.stages, inv.ticket_min, inv.ticket_max],
  });

  console.log(`✅ ${inv.name} (${inv.org}) — ${inv.email} / ImpactOS2026!`);
}

console.log("\n✅ 5 new investors created.");
process.exit(0);
