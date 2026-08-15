import { describe, expect, it } from 'vitest';
import { importPKCS8 } from 'jose';
import { base64UrlToBytes, bytesToBase64Url, normalizePrivateKeyPem } from './github-adapter.auth';

describe('normalizePrivateKeyPem', () => {
  it('passes PKCS#8 PEM through unchanged after normalizing line endings', () => {
    const pem = '-----BEGIN PRIVATE KEY-----\nMIIB\n-----END PRIVATE KEY-----\n';
    const result = normalizePrivateKeyPem(`\r\n${pem}\r\n`);
    expect(result.startsWith('-----BEGIN PRIVATE KEY-----\n')).toBe(true);
    expect(result.endsWith('-----END PRIVATE KEY-----\n')).toBe(true);
    // The base64 body is preserved byte-for-byte.
    const body = result
      .split('\n')
      .filter((line) => !line.includes('-----'))
      .join('');
    expect(body).toBe('MIIB');
  });

  it('rewraps PKCS#1 PEM into PKCS#8 with the RSA OID', () => {
    const pkcs1 =
      '-----BEGIN RSA PRIVATE KEY-----\nMIIBOgIBAAJBAK\n-----END RSA PRIVATE KEY-----\n';
    const result = normalizePrivateKeyPem(pkcs1);
    expect(result).toMatch(/^-----BEGIN PRIVATE KEY-----\n/);
    expect(result).toMatch(/\n-----END PRIVATE KEY-----\n$/);
    // Header: SEQUENCE(30) len, INTEGER version(02 01 00), AlgorithmIdentifier
    // (30 0d 06 09 2a 86 48 86 f7 0d 01 01 01 05 00), OCTET STRING(04).
    const body = result
      .split('\n')
      .filter((line) => !line.includes('-----'))
      .join('');
    const der = base64UrlToBytes(body);
    expect(der[0]).toBe(0x30);
    // Version INTEGER (02 01 00).
    expect(der[2]).toBe(0x02);
    expect(der[3]).toBe(0x01);
    expect(der[4]).toBe(0x00);
    // AlgorithmIdentifier SEQUENCE with the RSA OID.
    expect(der[5]).toBe(0x30);
    expect(der[6]).toBe(0x0d);
    expect([...der.slice(7, 18)]).toEqual([
      0x06, 0x09, 0x2a, 0x86, 0x48, 0x86, 0xf7, 0x0d, 0x01, 0x01, 0x01,
    ]);
    // Locate the OCTET STRING after the AlgorithmIdentifier SEQUENCE.
    // AlgorithmIdentifier = 30 0d <11 bytes> 05 00 → starts at 5, ends at 18.
    let cursor = 5;
    expect(der[cursor]).toBe(0x30);
    const algorithmLength = der[cursor + 1];
    if (algorithmLength === undefined) throw new Error('truncated DER');
    expect(algorithmLength).toBe(0x0d);
    cursor += 2 + algorithmLength;
    expect(der[cursor]).toBe(0x04);
    cursor += 1;
    const octetLength = der[cursor];
    if (octetLength === undefined) throw new Error('truncated DER');
    cursor += 1;
    // The PKCS#1 body inside the OCTET STRING must be exactly the input DER.
    expect(cursor + octetLength).toBe(der.length);
    expect([...der.slice(cursor, cursor + octetLength)]).toEqual([
      ...base64UrlToBytes('MIIBOgIBAAJBAK'),
    ]);
  });

  it('throws on a PEM that is neither PKCS#1 nor PKCS#8', () => {
    expect(() =>
      normalizePrivateKeyPem('-----BEGIN EC PRIVATE KEY-----\nAAAA\n-----END EC PRIVATE KEY-----'),
    ).toThrow('invalid-private-key');
  });

  it('rejects garbage input', () => {
    expect(() => normalizePrivateKeyPem('not a pem')).toThrow('invalid-private-key');
  });
});

describe('base64 helpers', () => {
  it('round-trips base64url bytes', () => {
    const bytes = new Uint8Array([0, 1, 2, 250, 251, 252, 253, 254, 255]);
    expect(base64UrlToBytes(bytesToBase64Url(bytes))).toEqual(bytes);
  });

  it('decodes standard base64 with padding', () => {
    expect(base64UrlToBytes('AQID')).toEqual(new Uint8Array([1, 2, 3]));
  });
});

describe('normalizePrivateKeyPem round-trip with a real RSA key', () => {
  it('produces a PKCS#8 PEM that jose.importPKCS8 accepts (GitHub App PKCS#1 download)', async () => {
    // GitHub App downloads ship PKCS#1 PEM. Generate one exactly like that
    // with Node's crypto (jose can only export PKCS#8).
    const { generateKeyPairSync } = await import('node:crypto');
    const { privateKey: pkcs1 } = generateKeyPairSync('rsa', {
      modulusLength: 2048,
      privateKeyEncoding: { type: 'pkcs1', format: 'pem' },
      publicKeyEncoding: { type: 'spki', format: 'pem' },
    });
    expect(pkcs1).toMatch(/^-----BEGIN RSA PRIVATE KEY-----/);
    const rewrapped = normalizePrivateKeyPem(pkcs1);
    expect(rewrapped).toMatch(/^-----BEGIN PRIVATE KEY-----/);
    // jose must accept the rewrapped key for RS256 signing.
    const imported = await importPKCS8(rewrapped, 'RS256');
    expect(imported).toBeDefined();
  });
});
