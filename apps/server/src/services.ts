import { createAuth } from "@seidor_it/auth";
import { createDb } from "@seidor_it/db";

import { ENV } from "./env.server";

export const db = createDb(ENV);
export const auth = createAuth(ENV, db);
