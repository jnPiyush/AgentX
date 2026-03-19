import * as fs from 'fs';
import { createHash } from 'crypto';

export interface ParsedChecksumSpec {
  readonly algorithm: 'sha256' | 'sha512';
  readonly expectedHex: string;
}

export interface ChecksumVerificationResult extends ParsedChecksumSpec {
  readonly actualHex: string;
  readonly matches: boolean;
}

export function parseChecksumSpec(spec: string): ParsedChecksumSpec {
  const trimmed = spec.trim();
  const match = trimmed.match(/^(sha256|sha512):([a-fA-F0-9]+)$/);
  if (!match) {
    throw new Error('Invalid checksum format. Expected sha256:<hex> or sha512:<hex>.');
  }

  return {
    algorithm: match[1].toLowerCase() as 'sha256' | 'sha512',
    expectedHex: match[2].toLowerCase(),
  };
}

export function computeFileChecksum(filePath: string, algorithm: 'sha256' | 'sha512'): string {
  const hash = createHash(algorithm);
  hash.update(fs.readFileSync(filePath));
  return hash.digest('hex').toLowerCase();
}

export function verifyFileChecksum(filePath: string, spec: string): ChecksumVerificationResult {
  const parsed = parseChecksumSpec(spec);
  const actualHex = computeFileChecksum(filePath, parsed.algorithm);
  return {
    ...parsed,
    actualHex,
    matches: actualHex === parsed.expectedHex,
  };
}
