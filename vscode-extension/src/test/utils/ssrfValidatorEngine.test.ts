// ---------------------------------------------------------------------------
// Tests -- SSRF Validator Engine (internals)
// ---------------------------------------------------------------------------

import { strict as assert } from 'assert';
import {
  validateUrl,
  resolveAndValidate,
  validateToolUrlParams,
  isPrivateIp,
  addAllowedHost,
  removeAllowedHost,
  getAllowedHosts,
} from '../../utils/ssrfValidatorEngine';

describe('SsrfValidatorEngine', () => {
  afterEach(() => {
    for (const host of getAllowedHosts()) {
      removeAllowedHost(host);
    }
  });

  // -----------------------------------------------------------------------
  // isPrivateIp
  // -----------------------------------------------------------------------
  describe('isPrivateIp', () => {
    it('should detect 10.x.x.x as private', () => {
      assert.equal(isPrivateIp('10.0.0.1'), true);
      assert.equal(isPrivateIp('10.255.255.255'), true);
    });

    it('should detect 172.16-31.x.x as private', () => {
      assert.equal(isPrivateIp('172.16.0.1'), true);
      assert.equal(isPrivateIp('172.31.255.255'), true);
    });

    it('should detect 192.168.x.x as private', () => {
      assert.equal(isPrivateIp('192.168.0.1'), true);
      assert.equal(isPrivateIp('192.168.255.255'), true);
    });

    it('should detect 127.x.x.x loopback as private', () => {
      assert.equal(isPrivateIp('127.0.0.1'), true);
      assert.equal(isPrivateIp('127.255.255.255'), true);
    });

    it('should detect link-local 169.254.x.x as private', () => {
      assert.equal(isPrivateIp('169.254.1.1'), true);
    });

    it('should detect IPv6 loopback as private', () => {
      assert.equal(isPrivateIp('::1'), true);
    });

    it('should detect IPv6 ULA (fc/fd) as private', () => {
      assert.equal(isPrivateIp('fd00::1'), true);
      assert.equal(isPrivateIp('fc00::1'), true);
    });

    it('should detect IPv6 link-local (fe80) as private', () => {
      assert.equal(isPrivateIp('fe80::1'), true);
    });

    it('should detect IPv4-mapped IPv6 private addresses', () => {
      assert.equal(isPrivateIp('::ffff:127.0.0.1'), true);
      assert.equal(isPrivateIp('::ffff:10.0.0.1'), true);
      assert.equal(isPrivateIp('::ffff:192.168.1.1'), true);
    });

    it('should allow public IPs', () => {
      assert.equal(isPrivateIp('8.8.8.8'), false);
      assert.equal(isPrivateIp('1.1.1.1'), false);
      assert.equal(isPrivateIp('203.0.113.1'), false);
    });

    it('should return false for empty input', () => {
      assert.equal(isPrivateIp(''), false);
    });
  });

  // -----------------------------------------------------------------------
  // validateUrl -- cloud metadata blocking
  // -----------------------------------------------------------------------
  describe('validateUrl - metadata endpoint blocking', () => {
    it('should block AWS/Azure metadata endpoint 169.254.169.254', () => {
      const result = validateUrl('http://169.254.169.254/latest/meta-data/');
      assert.equal(result.allowed, false);
      assert.ok(result.reason?.includes('metadata'));
    });

    it('should block GCP metadata endpoint', () => {
      const result = validateUrl('http://metadata.google.internal/computeMetadata/v1/');
      assert.equal(result.allowed, false);
      assert.ok(result.reason?.includes('metadata'));
    });
  });

  // -----------------------------------------------------------------------
  // validateUrl -- private IP blocking
  // -----------------------------------------------------------------------
  describe('validateUrl - private IP blocking', () => {
    it('should block localhost by IP', () => {
      const result = validateUrl('http://127.0.0.1:8080/admin');
      assert.equal(result.allowed, false);
      assert.ok(result.reason?.includes('private'));
    });

    it('should block 10.x private range', () => {
      const result = validateUrl('http://10.0.0.1/internal');
      assert.equal(result.allowed, false);
    });

    it('should block 192.168.x private range', () => {
      const result = validateUrl('http://192.168.1.1/router');
      assert.equal(result.allowed, false);
    });
  });

  // -----------------------------------------------------------------------
  // Allow-list management
  // -----------------------------------------------------------------------
  describe('allow-list management', () => {
    it('should add and retrieve allowed hosts', () => {
      addAllowedHost('internal.example.com');
      const hosts = getAllowedHosts();
      assert.ok(hosts.has('internal.example.com'));
    });

    it('should allow URLs to added hosts', () => {
      addAllowedHost('internal.example.com');
      const result = validateUrl('https://internal.example.com/api');
      assert.equal(result.allowed, true);
    });

    it('should remove hosts from allow-list', () => {
      addAllowedHost('temp.example.com');
      const removed = removeAllowedHost('temp.example.com');
      assert.equal(removed, true);
      assert.ok(!getAllowedHosts().has('temp.example.com'));
    });

    it('should return false when removing non-existent host', () => {
      const removed = removeAllowedHost('never-added.example.com');
      assert.equal(removed, false);
    });
  });

  // -----------------------------------------------------------------------
  // validateToolUrlParams
  // -----------------------------------------------------------------------
  describe('validateToolUrlParams', () => {
    it('should allow empty params', () => {
      const result = validateToolUrlParams({});
      assert.equal(result.allowed, true);
    });

    it('should allow safe URLs in url param', () => {
      const result = validateToolUrlParams({ url: 'https://example.com/api' });
      assert.equal(result.allowed, true);
    });

    it('should block private IPs in url param', () => {
      const result = validateToolUrlParams({ url: 'http://127.0.0.1/admin' });
      assert.equal(result.allowed, false);
      assert.ok(result.reason?.includes('param: url'));
    });

    it('should check endpoint param', () => {
      const result = validateToolUrlParams({ endpoint: 'http://169.254.169.254/' });
      assert.equal(result.allowed, false);
      assert.ok(result.reason?.includes('param: endpoint'));
    });

    it('should check baseUrl param', () => {
      const result = validateToolUrlParams({ baseUrl: 'ftp://evil.com' });
      assert.equal(result.allowed, false);
      assert.ok(result.reason?.includes('param: baseUrl'));
    });

    it('should skip non-string params', () => {
      const result = validateToolUrlParams({ url: 42 as unknown });
      assert.equal(result.allowed, true);
    });
  });

  // -----------------------------------------------------------------------
  // resolveAndValidate -- DNS rebinding protection
  // -----------------------------------------------------------------------
  describe('resolveAndValidate', () => {
    it('should reject empty URL', async () => {
      const result = await resolveAndValidate('');
      assert.equal(result.allowed, false);
    });

    it('should reject invalid URL', async () => {
      const result = await resolveAndValidate('not-a-url');
      assert.equal(result.allowed, false);
    });

    it('should allow valid public URL', async () => {
      // Use an IP-based URL to skip DNS resolution
      const result = await resolveAndValidate('https://8.8.8.8/dns');
      assert.equal(result.allowed, true);
    });

    it('should block private IP even via resolveAndValidate', async () => {
      const result = await resolveAndValidate('http://127.0.0.1:3000/api');
      assert.equal(result.allowed, false);
    });
  });
});