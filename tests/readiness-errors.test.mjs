import assert from 'node:assert/strict';
import { test } from 'node:test';

globalThis.__KRISTOU_SUPABASE_URL__ = 'https://example.supabase.co';
globalThis.__KRISTOU_SUPABASE_PUBLISHABLE_KEY__ = 'test-publishable-key';
const { classifySupabaseError } = await import('../src/lib/supabase.ts');
const { classifyGovernanceRpcError } = await import('../src/lib/accountGovernance.ts');

test('transport failures remain retryable errors, not missing deployment contracts', () => {
  for (const message of ['Failed to fetch', 'NetworkError when attempting to fetch resource.']) {
    assert.equal(classifySupabaseError(new TypeError(message)).status, 'ERROR');
    assert.equal(classifyGovernanceRpcError(new TypeError(message)).errorCode, 'governance_operation_failed');
  }
});

test('invalid or expired JWT is unauthorized in both adapters', () => {
  const error = { code: 'PGRST301', message: 'JWT expired' };
  assert.equal(classifySupabaseError(error).status, 'UNAUTHORIZED');
  assert.equal(classifyGovernanceRpcError(error).errorCode, 'actor_unauthenticated');
});

test('missing backend contracts and genuine governance denials retain their classifications', () => {
  for (const code of ['PGRST202', '42883', '42P01']) {
    const error = { code, message: 'Missing contract' };
    assert.equal(classifySupabaseError(error).status, 'BLOCKED_BACKEND');
    assert.equal(classifyGovernanceRpcError(error).errorCode, 'backend_unavailable');
  }
  assert.equal(classifySupabaseError({ code: '42501', message: 'permission denied' }).status, 'UNAUTHORIZED');
  assert.equal(classifyGovernanceRpcError({ message: 'owner_only_operation' }).errorCode, 'owner_only_operation');
});
