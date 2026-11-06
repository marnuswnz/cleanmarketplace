import { randomInt } from "node:crypto";

// Unambiguous alphabet (no 0/O/1/I/L).
const ALPHABET = "23456789ABCDEFGHJKMNPQRSTUVWXYZ";

/** Customer-facing lead reference, e.g. "CH-7K3QX9". */
export function newRefCode(): string {
  let s = "";
  for (let i = 0; i < 6; i++) s += ALPHABET[randomInt(ALPHABET.length)];
  return `CH-${s}`;
}
