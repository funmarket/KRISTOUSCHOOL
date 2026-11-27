import assert from 'node:assert/strict';
import test from 'node:test';
globalThis.__KRISTOU_SUPABASE_URL__ = '';
globalThis.__KRISTOU_SUPABASE_PUBLISHABLE_KEY__ = '';
const { completeEnrollmentAdmission } = await import('../src/lib/domains/enrollment.ts');

test('admission adapter preserves explicit IDs, version, guardian choice and retry receipt', async () => {
  for (const replayed of [false, true]) {
    const input = { applicationId: 'application-id', existingStudentId: 'student-id', verifyGuardian: false, expectedVersion: 7 };
    const receipt = { applicationId: input.applicationId, studentId: input.existingStudentId, status: 'ENROLLED', version: 8, guardianVerified: false, replayed };
    const result = await completeEnrollmentAdmission(input, { rpc: async (name, args) => {
      assert.equal(name, 'complete_enrollment_admission');
      assert.deepEqual(args, { p_application_id: input.applicationId, p_existing_student_id: input.existingStudentId, p_verify_guardian: false, p_expected_version: 7 });
      return { data: receipt, error: null };
    } });
    assert.deepEqual(result, { ok: true, status: 'READY', data: receipt });
  }
});

test('new student request defaults guardian verification without contact matching; malformed receipts fail closed', async () => {
  const result = await completeEnrollmentAdmission({ applicationId: 'application-id', expectedVersion: 1 }, {
    rpc: async (name, args) => {
      assert.deepEqual(args, { p_application_id: 'application-id', p_verify_guardian: true, p_expected_version: 1 });
      return { data: { applicationId: 'another-application', studentId: 'student-id', status: 'ENROLLED' }, error: null };
    },
  });
  assert.equal(result.ok, false);
  assert.equal(result.errorCode, 'invalid_admission_receipt');
  assert.equal((await completeEnrollmentAdmission({ applicationId: 'application-id', expectedVersion: 1 }, null)).status, 'BLOCKED_BACKEND');
});
