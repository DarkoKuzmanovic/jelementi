import { describe, expect, it } from 'vitest';
import { verifyWranglerContract } from './verify-deploy';

const contract = {
  main: '.svelte-kit/cloudflare/_worker.js',
  workers_dev: false,
  preview_urls: true,
  assets: {
    binding: 'ASSETS',
    directory: '.svelte-kit/cloudflare',
    not_found_handling: '404-page',
  },
  routes: [{ pattern: 'jelementi.quz.ma', custom_domain: true }],
  r2_buckets: [{ binding: 'R2_MEDIA', bucket_name: 'jelementi-media' }],
};

describe('Wrangler M2 reader contract', () => {
  it('accepts both routed production and route-less branch-upload contracts', () => {
    expect(() => verifyWranglerContract(contract)).not.toThrow();
    const { routes: _routes, ...branchUpload } = contract;
    expect(() => verifyWranglerContract(branchUpload, 'branch-upload')).not.toThrow();
  });

  it.each([
    [{ ...contract, workers_dev: true }, 'workers_dev'],
    [{ ...contract, preview_urls: false }, 'preview_urls'],
    [{ ...contract, routes: [] }, 'production route'],
    [
      {
        ...contract,
        assets: { ...contract.assets, not_found_handling: 'single-page-application' },
      },
      '404-page',
    ],
    [{ ...contract, r2_buckets: [] }, 'R2_MEDIA'],
  ])('rejects drift from the reader deployment boundary', (drifted, message) => {
    expect(() => verifyWranglerContract(drifted)).toThrow(message);
  });

  it('rejects a production route in the branch-upload config', () => {
    expect(() => verifyWranglerContract(contract, 'branch-upload')).toThrow('route-less');
  });

  // The Studio acceptance identity bypass (#73) must never be reachable
  // from a real deployment contract (ADR-0001).
  it('rejects a wrangler config that defines STUDIO_ACCEPTANCE_MODE', () => {
    const withAcceptanceMode = { ...contract, vars: { STUDIO_ACCEPTANCE_MODE: '1' } };
    expect(() => verifyWranglerContract(withAcceptanceMode)).toThrow('STUDIO_ACCEPTANCE_MODE');
    const { routes: _routes, ...branchUploadWithAcceptanceMode } = withAcceptanceMode;
    expect(() => verifyWranglerContract(branchUploadWithAcceptanceMode, 'branch-upload')).toThrow(
      'STUDIO_ACCEPTANCE_MODE',
    );
  });

  it('rejects Reader acceptance mode from every deployable Wrangler contract', () => {
    const withAcceptanceMode = { ...contract, vars: { READER_ACCEPTANCE_SCENARIO: 'sparse' } };
    expect(() => verifyWranglerContract(withAcceptanceMode)).toThrow('READER_ACCEPTANCE');
    const { routes: _routes, ...branchUploadWithAcceptanceMode } = withAcceptanceMode;
    expect(() => verifyWranglerContract(branchUploadWithAcceptanceMode, 'branch-upload')).toThrow(
      'READER_ACCEPTANCE',
    );
  });

  it('accepts a contract with other production vars but no acceptance flag', () => {
    const withVars = { ...contract, vars: { PRODUCTION_ORIGIN: 'https://jelementi.quz.ma' } };
    expect(() => verifyWranglerContract(withVars)).not.toThrow();
  });
});
