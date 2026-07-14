import { z } from "zod";

/** Law 13: request body is untrusted input -- validated via zod, never cast.
 * Mirrors weave_backend.schemas.operations.Op (discriminated union on `op`).
 * Shared by every CE-WRITE-1 write-proxy route (TASK-006's chat/guided-form
 * proxy and TASK-023's canvas write proxy) -- one contract, one schema. */
export const opSchema = z.discriminatedUnion("op", [
  z.object({
    op: z.literal("add_node"),
    ref: z.string().min(1),
    kind: z.string().min(1),
    label: z.string().min(1),
    properties: z.record(z.string(), z.unknown()).default({}),
    // CE-002: punned owl:Class typing (glossary terms, decision B1) --
    // optional/default-empty so existing callers (guided-form, chat)
    // are unaffected.
    additional_types: z.array(z.string()).default([]),
  }),
  z.object({
    op: z.literal("update_node"),
    iri: z.string().min(1),
    properties: z.record(z.string(), z.unknown()).default({}),
  }),
  z.object({
    op: z.literal("add_edge"),
    subject_ref: z.string().min(1),
    predicate: z.string().min(1),
    object_ref: z.string().min(1),
  }),
  z.object({ op: z.literal("delete_node"), iri: z.string().min(1) }),
  z.object({
    op: z.literal("delete_edge"),
    subject: z.string().min(1),
    predicate: z.string().min(1),
    object: z.string().min(1),
  }),
]);

export type Op = z.infer<typeof opSchema>;
