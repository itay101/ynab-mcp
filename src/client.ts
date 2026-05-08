import * as ynab from "ynab";

let _defaultClient: ynab.API | null = null;

export function getClient(token?: string): ynab.API {
  if (token) {
    return new ynab.API(token);
  }
  if (!_defaultClient) {
    const envToken = process.env.YNAB_API_TOKEN;
    if (!envToken) {
      console.error("Error: YNAB_API_TOKEN environment variable is not set.");
      process.exit(1);
    }
    _defaultClient = new ynab.API(envToken);
  }
  return _defaultClient;
}
