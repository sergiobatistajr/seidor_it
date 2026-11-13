import { createAxiomDrain } from "evlog/axiom";
import { createEvlog } from "evlog/next";
import { createInstrumentation } from "evlog/next/instrumentation/create";

export const { withEvlog, useLogger, log, createError } = createEvlog({
  service: "seidor_it-web",
  drain: createAxiomDrain(),
});

export const { register, onRequestError } = createInstrumentation({
  service: "seidor_it-web",
});
