/**
 * User seeder script - Creates test users for all roles
 * Run with: npm run db:seed
 */
import { db } from "./index";
import { usersSqlite, type Role } from "./schema/users";
import { hashPassword } from "../auth/password";
import { eq } from "drizzle-orm";

interface SeedUser {
  email: string;
  password: string;
  name: string;
  role: Role;
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

async function seedDatabase() {
  console.log("🌱 Starting user seeding...\n");

  for (const user of seedUsers) {
    // Check if user already exists
    const existing = await db
      .select({ id: usersSqlite.id })
      .from(usersSqlite)
      .where(eq(usersSqlite.email, user.email))
      .limit(1);

    if (existing.length > 0) {
      console.log(`⏭️  User ${user.email} already exists, skipping...`);
      continue;
    }

    // Hash password and create user
    const passwordHash = await hashPassword(user.password);
    const id = crypto.randomUUID();

    await db.insert(usersSqlite).values({
      id,
      email: user.email,
      passwordHash,
      name: user.name,
      role: user.role,
    });

    console.log(`✅ Created ${user.role}: ${user.email}`);
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
