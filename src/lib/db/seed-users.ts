/**
 * User seeder script - Creates test users for all roles
 * Run with: npm run db:seed
 * 
 * Supports both SQLite (development) and PostgreSQL (production)
 */
import { hashPassword } from "../auth/password";

const databaseUrl = process.env.DATABASE_URL || "file:./dev.db";

interface SeedUser {
  email: string;
  password: string;
  name: string;
  role: string;
}

const seedUsers: SeedUser[] = [
  {
    email: "superadmin@test.com",
    password: "password123",
    name: "Super Admin User",
    role: "SUPER_ADMIN",
  },
  {
    email: "manager@test.com",
    password: "password123",
    name: "Manager User",
    role: "MANAGER",
  },
  {
    email: "member@test.com",
    password: "password123",
    name: "Member User",
    role: "MEMBER",
  },
  {
    email: "guest@test.com",
    password: "password123",
    name: "Guest User",
    role: "GUEST",
  },
];

function isPostgresUrl(url: string): boolean {
  return url.startsWith("postgresql://") || url.startsWith("postgres://");
}

async function seedPostgres() {
  const postgres = (await import("postgres")).default;
  const sql = postgres(databaseUrl);

  console.log("🌱 Starting user seeding (PostgreSQL)...\n");

  for (const user of seedUsers) {
    // Check if user already exists
    const existing = await sql`SELECT id FROM users WHERE email = ${user.email} LIMIT 1`;

    if (existing.length > 0) {
      console.log(`⏭️  User ${user.email} already exists, skipping...`);
      continue;
    }

    // Hash password and create user
    const passwordHash = await hashPassword(user.password);
    const id = crypto.randomUUID();
    const now = Math.floor(Date.now() / 1000);

    await sql`
      INSERT INTO users (id, email, password_hash, name, role, theme_preference, created_at, updated_at)
      VALUES (${id}, ${user.email}, ${passwordHash}, ${user.name}, ${user.role}, 'system', ${now}, ${now})
    `;

    console.log(`✅ Created ${user.role}: ${user.email}`);
  }

  await sql.end();
  return;
}

async function seedSqlite() {
  const { db } = await import("./index");
  const { users } = await import("./schema/index");
  const { eq } = await import("drizzle-orm");

  console.log("🌱 Starting user seeding (SQLite)...\n");

  for (const user of seedUsers) {
    // Check if user already exists
    const existing = await db
      .select({ id: users.id })
      .from(users)
      .where(eq(users.email, user.email))
      .limit(1);

    if (existing.length > 0) {
      console.log(`⏭️  User ${user.email} already exists, skipping...`);
      continue;
    }

    // Hash password and create user
    const passwordHash = await hashPassword(user.password);
    const id = crypto.randomUUID();

    await db.insert(users).values({
      id,
      email: user.email,
      passwordHash,
      name: user.name,
      role: user.role as "SUPER_ADMIN" | "MANAGER" | "MEMBER" | "GUEST",
    });

    console.log(`✅ Created ${user.role}: ${user.email}`);
  }
}

async function seedDatabase() {
  if (isPostgresUrl(databaseUrl)) {
    await seedPostgres();
  } else {
    await seedSqlite();
  }

  console.log("\n🎉 Seeding complete!\n");
  console.log("Test credentials (all use password: password123):");
  console.log("─".repeat(50));
  seedUsers.forEach((u) => {
    console.log(`  ${u.role.padEnd(12)} → ${u.email}`);
  });
}

seedDatabase()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error("❌ Seeding failed:", err);
    process.exit(1);
  });
