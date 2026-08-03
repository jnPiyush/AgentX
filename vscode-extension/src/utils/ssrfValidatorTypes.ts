export interface SsrfResolvedAddress {
  readonly address: string;
  readonly family: number;
}

export interface SsrfValidationResult {
  readonly allowed: boolean;
  readonly url: string;
  readonly reason?: string;
  readonly resolvedAddresses?: readonly SsrfResolvedAddress[];
}
