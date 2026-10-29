import test from 'node:test';
import assert from 'node:assert/strict';

test('Deduplication logic - Set based deduplication', () => {
  const existingIdsInDb = new Set(['momo_msg_1001', 'momo_msg_1002']);

  const incomingEmails = [
    { id: 'momo_msg_1001', subject: 'GD 1' },
    { id: 'momo_msg_1002', subject: 'GD 2' },
    { id: 'momo_msg_1003', subject: 'GD 3' }, // New
    { id: 'momo_msg_1004', subject: 'GD 4' }, // New
  ];

  let skippedDuplicatesCount = 0;
  const newEmails = incomingEmails.filter((email) => {
    if (existingIdsInDb.has(email.id)) {
      skippedDuplicatesCount++;
      return false;
    }
    return true;
  });

  assert.equal(skippedDuplicatesCount, 2);
  assert.equal(newEmails.length, 2);
  assert.equal(newEmails[0].id, 'momo_msg_1003');
  assert.equal(newEmails[1].id, 'momo_msg_1004');
});
