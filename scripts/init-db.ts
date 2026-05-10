import mysql from "mysql2/promise";
import dotenv from "dotenv";

dotenv.config();

async function initDb() {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    console.error("DATABASE_URL is not defined in .env");
    process.exit(1);
  }

  // Parse connection string to get host, user, password and database name
  // Format: mysql://user:password@host:port/database
  const url = new URL(connectionString);
  const host = url.hostname;
  const user = url.username;
  const password = url.password;
  const database = url.pathname.slice(1);

  console.log(`Checking database "${database}" on ${host}...`);

  try {
    const connection = await mysql.createConnection({
      host,
      user,
      password,
    });

    await connection.query(`CREATE DATABASE IF NOT EXISTS \`${database}\`;`);
    console.log(`Database "${database}" is ready.`);
    await connection.end();
  } catch (error) {
    console.error("Failed to initialize database:", error);
    process.exit(1);
  }
}

initDb();
