import * as ynab from "ynab";

let client: ynab.API | null = null;

export function getClient(): ynab.API {
  if (!client) {
    const token = process.env.YNAB_API_TOKEN;
    if (!token) {
      console.error("Error: YNAB_API_TOKEN environment variable is not set.");
      process.exit(1);
    }
    client = new ynab.API(token);
  }
  return client;
}
