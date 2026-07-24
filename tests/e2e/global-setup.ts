// Перед прогоном E2E чистим персистентный rate-limiter (RateEvent) в dev-БД:
// несколько прогонов подряд иначе упираются в лимит OTP «5/мин с IP».
// Поведение приложения не меняется — лимиты продолжают работать внутри прогона.
import "dotenv/config";
import { Client } from "pg";

export default async function globalSetup() {
  const url = new URL(process.env.DATABASE_URL!);
  url.searchParams.delete("schema");
  const client = new Client({ connectionString: url.toString() });
  await client.connect();
  await client.query('DELETE FROM "RateEvent"');
  await client.end();
}
