import { sha256 } from "@noble/hashes/sha256";
import { bytesToHex, utf8ToBytes } from "@noble/hashes/utils";

export function sha256Hex(input: string | Uint8Array): string {
  const bytes = typeof input === "string" ? utf8ToBytes(input) : input;
  return bytesToHex(sha256(bytes));
}

