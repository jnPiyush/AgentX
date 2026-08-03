import * as dns from 'dns';

export const ALLOWED_SCHEMES: readonly string[] = ['http:', 'https:'];

export const BLOCKED_METADATA_HOSTS: ReadonlySet<string> = new Set([
  '169.254.169.254',       // AWS, Azure, and generic link-local IMDS
  'metadata.google.internal', // GCP IMDS
  'metadata.azure.internal',  // Azure IMDS alternate hostname
  '100.100.100.200',       // Alibaba Cloud IMDS
  'fd00:ec2::254',         // AWS IMDSv2 IPv6 access point
]);

export const PRIVATE_IPV4_PATTERNS: readonly RegExp[] = [
  /^10\.\d{1,3}\.\d{1,3}\.\d{1,3}$/,
  /^172\.(1[6-9]|2\d|3[01])\.\d{1,3}\.\d{1,3}$/,
  /^192\.168\.\d{1,3}\.\d{1,3}$/,
  /^127\.\d{1,3}\.\d{1,3}\.\d{1,3}$/,
  /^169\.254\.\d{1,3}\.\d{1,3}$/,
  /^0\.\d{1,3}\.\d{1,3}\.\d{1,3}$/,
];

export const PRIVATE_IPV6_PATTERNS: readonly RegExp[] = [
  /^::1$/i,
  /^f[cd][0-9a-f]{2}:/i,
  /^fe[89ab][0-9a-f]:/i,
];

const INTERNAL_ALLOWLIST: Set<string> = new Set();

export function addAllowedHostInternal(hostname: string): void {
  INTERNAL_ALLOWLIST.add(hostname.toLowerCase());
}

export function removeAllowedHostInternal(hostname: string): boolean {
  return INTERNAL_ALLOWLIST.delete(hostname.toLowerCase());
}

export function getAllowedHostsSnapshot(): ReadonlySet<string> {
  return new Set(INTERNAL_ALLOWLIST);
}

export function isAllowedHost(hostname: string): boolean {
  return INTERNAL_ALLOWLIST.has(hostname.toLowerCase());
}

export async function lookupAddresses(hostname: string): Promise<readonly dns.LookupAddress[]> {
  return dns.promises.lookup(hostname, { all: true, verbatim: true });
}
