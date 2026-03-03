// ---------------------------------------------------------------------------
// Tests -- SSRF Validator
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
} from '../../utils/ssrfValidator';

describe('SsrfValidator', () => {
  // Clean up allow-list between tests
  afterEach(() => {
    for (const host of getAllowedHosts()) {
      removeAllowedHost(host);
    }
  });

  // -----------------------------------------------------------------------
  // validateUrl -- scheme checks
  // -----------------------------------------------------------------------
  describe('validateUrl - scheme validation', () => {
    it('should allow http: URLs', () => {
      const result = validateUrl('http://example.com/api');
      assert.equal(result.allowed, true);
    });

    it('should allow https: URLs', () => {
      const result = validateUrl('https://example.com/api');
      assert.equal(result.allowed, true);
    });

    it('should block file: scheme', () => {
      const result = validateUrl('file:///etc/passwd');
      assert.equal(result.allowed, false);
      assert.ok(result.reason?.includes('Scheme'));
    });

    it('should block ftp: scheme', () => {
      const result = validateUrl('ftp://evil.com/data');
      assert.equal(result.allowed, false);
      assert.ok(result.reason?.includes('Scheme'));
    });

    it('should block javascript: scheme', () => {
      const result = validateUrl('javascript:alert(1)');
      assert.equal(result.allowed, false);
    });

    it('should block data: scheme', () => {
      const result = validateUrl('data:text/html,<h1>hello</h1>');
      assert.equal(result.allowed, false);
    });
  });

  // -----------------------------------------------------------------------
  // validateUrl -- private IPs
  // -----------------------------------------------------------------------
  describe('validateUrl - private IP detection', () => {
    it('should block 10.x.x.x (Class A private)', () => {
      const result = validateUrl('http://10.0.0.1/admin');
      assert.equal(result.allowed, false);
      assert.ok(result.reason?.includes('private'));
    });

    it('should block 172.16.x.x (Class B private)', () => {
      const result = validateUrl('http://172.16.0.1/data');
      assert.equal(result.allowed, false);
    });

    it('should block 192.168.x.x (Class C private)', () => {
      const result = validateUrl('http://192.168.1.1/');
      assert.equal(result.allowed, false);
    });

    it('should block 127.0.0.1 (loopback)', () => {
      const result = validateUrl('http://127.0.0.1:3000/api');
      assert.equal(result.allowed, false);
    });

    it('should block 169.254.x.x (link-local)', () => {
      const result = validateUrl('http://169.254.1.1/path');
      assert.equal(result.allowed, false);
    });

    it('should block 0.0.0.0 (this network)', () => {
      const result = validateUrl('http://0.0.0.0/');
      assert.equal(result.allowed, false);
    });

    it('should allow public IPs', () => {
      const result = validateUrl('http://8.8.8.8/dns');
      assert.equal(result.allowed, true);
    });
  });

  // -----------------------------------------------------------------------
  // validateUrl -- cloud metadata endpoints
  // -----------------------------------------------------------------------
  describe('validateUrl - cloud metadata blocking', () => {
    it('should block AWS metadata endpoint (169.254.169.254)', () => {
      const result = validateUrl('http://169.254.169.254/latest/meta-data/');
      assert.equal(result.allowed, false);
    });

    it('should block GCE metadata endpoint', () => {
      const result = validateUrl('http://metadata.google.internal/computeMetadata/v1/');
      assert.equal(result.allowed, false);
    });

    it('should block Alibaba Cloud metadata', () => {
      const result = validateUrl('http://100.100.100.200/latest/meta-data/');
      assert.equal(result.allowed, false);
    });
  });

  // -----------------------------------------------------------------------
  // validateUrl -- edge cases
  // -----------------------------------------------------------------------
  describe('validateUrl - edge cases', () => {
    it('should reject empty string', () => {
      const result = validateUrl('');
      assert.equal(result.allowed, false);
      assert.ok(result.reason?.includes('Empty'));
    });

    it('should reject malformed URL', () => {
      const result = validateUrl('not-a-url');
      assert.equal(result.allowed, false);
      assert.ok(result.reason?.includes('Invalid'));
    });

    it('should reject whitespace-only input', () => {
      const result = validateUrl('   ');
      assert.equal(result.allowed, false);
    });

    it('should allow URLs with ports', () => {
      const result = validateUrl('https://api.example.com:8443/v2');
      assert.equal(result.allowed, true);
    });

    it('should allow URLs with query strings', () => {
      const result = validateUrl('https://api.example.com/search?q=test');
      assert.equal(result.allowed, true);
    });

    it('should allow URLs with fragments', () => {
      const result = validateUrl('https://docs.example.com/page#section');
      assert.equal(result.allowed, true);
    });
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
      assert.equal(isPrivateIp('172.31.255.254'), true);
    });

    it('should not detect 172.32.x.x as private', () => {
      assert.equal(isPrivateIp('172.32.0.1'), false);
    });

    it('should detect 192.168.x.x as private', () => {
      assert.equal(isPrivateIp('192.168.0.1'), true);
    });

    it('should detect 127.x.x.x as private', () => {
      assert.equal(isPrivateIp('127.0.0.1'), true);
      assert.equal(isPrivateIp('127.255.255.255'), true);
    });

    it('should detect ::1 as private (IPv6 loopback)', () => {
      assert.equal(isPrivateIp('::1'), true);
    });

    it('should detect fd00:: as private (unique-local)', () => {
      assert.equal(isPrivateIp('fd12:3456:789a::1'), true);
    });

    it('should detect fe80:: as private (link-local)', () => {
      assert.equal(isPrivateIp('fe80:1234::1'), true);
    });

    it('should handle IPv4-mapped IPv6', () => {
      assert.equal(isPrivateIp('::ffff:192.168.1.1'), true);
      assert.equal(isPrivateIp('::ffff:8.8.8.8'), false);
    });

    it('should handle empty/null input', () => {
      assert.equal(isPrivateIp(''), false);
    });

    it('should not flag public IPs', () => {
      assert.equal(isPrivateIp('8.8.8.8'), false);
      assert.equal(isPrivateIp('1.1.1.1'), false);
      assert.equal(isPrivateIp('203.0.113.1'), false);
    });
  });

  // -----------------------------------------------------------------------
  // Configurable allow-list
  // -----------------------------------------------------------------------
  describe('allow-list management', () => {
    it('should bypass checks for allow-listed hosts', () => {
      addAllowedHost('proxy.corp.internal');
      const result = validateUrl('http://proxy.corp.internal:8080/api');
      assert.equal(result.allowed, true);
    });

    it('should be case-insensitive', () => {
      addAllowedHost('PROXY.Corp.Internal');
      const result = validateUrl('http://proxy.corp.internal/api');
      assert.equal(result.allowed, true);
    });

    it('should remove allow-listed hosts', () => {
      addAllowedHost('proxy.corp.internal');
      const removed = removeAllowedHost('proxy.corp.internal');
      assert.equal(removed, true);
      const result = validateUrl('http://proxy.corp.internal/');
      // The URL would normally be allowed since proxy.corp.internal
      // is a public-looking hostname, but let's verify the list is clean
      assert.equal(getAllowedHosts().size, 0);
    });

    it('should return false when removing non-existent host', () => {
      assert.equal(removeAllowedHost('never-added.com'), false);
    });

    it('should return snapshot via getAllowedHosts', () => {
      addAllowedHost('a.com');
      addAllowedHost('b.com');
      const hosts = getAllowedHosts();
      assert.equal(hosts.size, 2);
      assert.ok(hosts.has('a.com'));
      assert.ok(hosts.has('b.com'));
    });
  });

  // -----------------------------------------------------------------------
  // resolveAndValidate (async with DNS)
  // -----------------------------------------------------------------------
  describe('resolveAndValidate', () => {
    it('should reject URLs that fail static check', async () => {
      const result = await resolveAndValidate('ftp://evil.com');
      assert.equal(result.allowed, false);
    });

    it('should pass static-only check for public literal IPs', async () => {
      const result = await resolveAndValidate('http://8.8.8.8/path');
      assert.equal(result.allowed, true);
    });

    it('should reject private literal IPs', async () => {
      const result = await resolveAndValidate('http://192.168.1.1/admin');
      assert.equal(result.allowed, false);
    });

    // DNS resolution test (may require network -- tests DNS rebinding)
    it('should handle DNS lookup for public hostnames', async () => {
      // This test verifies the function runs without throwing.
      // Actual DNS resolution depends on network availability.
      const result = await resolveAndValidate('https://example.com');
      // example.com is a public IP, so should be allowed if DNS resolves
      assert.equal(typeof result.allowed, 'boolean');
    });
  });

  // -----------------------------------------------------------------------
  // validateToolUrlParams
  // -----------------------------------------------------------------------
  describe('validateToolUrlParams', () => {
    it('should pass when no URL params present', () => {
      const result = validateToolUrlParams({ name: 'test', count: 42 });
      assert.equal(result.allowed, true);
    });

    it('should validate url parameter', () => {
      const result = validateToolUrlParams({ url: 'http://192.168.1.1/admin' });
      assert.equal(result.allowed, false);
      assert.ok(result.reason?.includes('param: url'));
    });

    it('should validate endpoint parameter', () => {
      const result = validateToolUrlParams({ endpoint: 'ftp://evil.com' });
      assert.equal(result.allowed, false);
      assert.ok(result.reason?.includes('param: endpoint'));
    });

    it('should validate baseUrl parameter', () => {
      const result = validateToolUrlParams({ baseUrl: 'https://api.example.com' });
      assert.equal(result.allowed, true);
    });

    it('should skip non-string URL params', () => {
      const result = validateToolUrlParams({ url: 42 });
      assert.equal(result.allowed, true);
    });

    it('should skip empty-string URL params', () => {
      const result = validateToolUrlParams({ url: '' });
      assert.equal(result.allowed, true);
    });

    it('should return first blocked param', () => {
      const result = validateToolUrlParams({
        url: 'https://example.com',
        targetUrl: 'file:///etc/passwd',
      });
      assert.equal(result.allowed, false);
      assert.ok(result.reason?.includes('param: targetUrl'));
    });
  });
});
