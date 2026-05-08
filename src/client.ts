import * as ynab from "ynab";

export function getClient(token: string): ynab.API {
  return new ynab.API(token);
}
