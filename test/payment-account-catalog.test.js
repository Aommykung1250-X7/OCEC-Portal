import assert from 'node:assert/strict';
import test from 'node:test';
import { normalizePaymentAccounts } from '../server/catalog.js';

const account = (id, overrides = {}) => ({
  id,
  bankName: 'Example Bank',
  accountName: `Account ${id}`,
  accountNumber: `123-456-${id === 'one' ? '7890' : '7891'}`,
  category: 'other',
  showInForm: false,
  active: true,
  ...overrides,
});

test('payment account catalog allows only one active account in the application form', () => {
  const accounts = normalizePaymentAccounts([
    account('one'),
    account('two', { showInForm: true }),
  ]);
  assert.equal(accounts.filter((item) => item.showInForm && item.active).length, 1);
  assert.equal(accounts[1].showInForm, true);
});

test('payment account catalog rejects multiple selected accounts and duplicate account numbers', () => {
  assert.throws(() => normalizePaymentAccounts([account('one')]), /Select one active payment account/);
  assert.throws(() => normalizePaymentAccounts([
    account('one', { showInForm: true }),
    account('two', { showInForm: true }),
  ]), /Only one active payment account/);

  assert.throws(() => normalizePaymentAccounts([
    account('one'),
    account('two', { accountNumber: account('one').accountNumber }),
  ]), /Payment account numbers must be unique/);
});

test('inactive account selection does not count as the form account', () => {
  const accounts = normalizePaymentAccounts([
    account('one', { showInForm: true, active: false }),
    account('two', { showInForm: true, active: true }),
  ]);
  assert.equal(accounts.filter((item) => item.showInForm && item.active).length, 1);
});
