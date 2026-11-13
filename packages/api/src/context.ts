import type { Session } from "@seidor_it/auth";
import type { Database } from "@seidor_it/db";

export type Context = {
  session: Session | null;
  db: Database;
};
