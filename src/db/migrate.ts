import { drizzle } from "drizzle-orm/mysql2";
import { migrate } from "drizzle-orm/mysql2/migrator";
import mysql from "mysql2/promise";
import dotenv from "dotenv";

dotenv.config();

async function runMigrations() {
  console.log("⏳ Connecting to database for migrations...");

  if (!process.env.MYSQL_DATABASE_URL) {
    console.log("❌ MYSQL_DATABASE_URL env variable not set");
    return;
  }

  const connection = await mysql.createConnection(
    process.env.MYSQL_DATABASE_URL,
  );
  const db = drizzle(connection);

  console.log("🚀 Running Drizzle Migrations...");

  await migrate(db, { migrationsFolder: "migrations" });

  console.log("✅ Migrations completed!");
  await connection.end();
}

runMigrations().catch((err) => {
  console.error("❌ Migration failed!", err);
  process.exit(1);
});
