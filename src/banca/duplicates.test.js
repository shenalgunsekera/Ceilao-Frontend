// Duplicate rows on upload: Update or Ignore, Facility No / Vehicle Reg No carried from payments to the policy, and batch reversal of updates.
import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { validate } from './templates';
import { DEFAULT_CONFIG, expectedCommission, periodId, capsRecord } from './core';
import { executeReversal } from './store';
import { DuplicateReview } from './screens/Operations';

global.__OPS = [];
jest.mock('./../firebase', () => ({ db: {}, auth: {} }));
jest.mock('../App', () => ({ useAuth: () => ({}) }));
jest.mock('../storage', () => ({ uploadFile: jest.fn(), openFile: jest.fn() }));
jest.mock('firebase/firestore', () => ({
  collection: (db, p) => ({ p }), doc: (db, ...p) => ({ p: p.join('/'), id: 'NEW' }), query: (c) => c, orderBy: () => null, limit: () => null,
  getDoc: async () => ({ exists: () => false, data: () => ({}) }), getDocs: async () => ({ docs: [] }),
  setDoc: async () => {}, updateDoc: async () => {},
  writeBatch: () => ({ set: () => {}, update: (ref, data) => global.__OPS.push([ref.p, data]), commit: async () => {} }),
}));

const PID = periodId('X', 'P1', '2026-01-01');
const comm = expectedCommission(DEFAULT_CONFIG, 'X', 'Motor', '2026-01-01', 100, 0, 0);
const stored = () => ({
  policies: [capsRecord({ id: PID, policy_no: 'P1', customer: 'A', address: 'Old Rd', insurer: 'X', branch: 'Colombo', class: 'Motor', inception: '2026-01-01', expiry: '2026-12-31', facility_no: '', vehicle_no: 'CAB-1', batch_id: 'B1' })],
  txns: [{ id: 'T1', policy_id: PID, type: 'New', effective_date: '2026-01-01', basic: 100, srcc: 0, tc: 0, total: 100, ...comm, comm_source: 'schedule', batch_id: 'B1' }],
  receipts: [], commissions: [], claims: [], targets: [], exceptions: [],
});
const GWP_H = ['Policy No', 'Transaction Type', 'Customer Name', 'Address', 'Insurance Company', 'Branch', 'Vehicle Reg No', 'Class / Product', 'Inception Date', 'Expiry Date', 'Basic Premium', 'Total Premium'];
const gwpRow = (o = {}) => ({ __row: 2, 'Policy No': 'P1', 'Transaction Type': 'New', 'Customer Name': 'A', Address: '', 'Insurance Company': 'X', Branch: 'Colombo', 'Vehicle Reg No': 'CAB-1',
  'Class / Product': 'Motor', 'Inception Date': '2026-01-01', 'Expiry Date': '2026-12-31', 'Basic Premium': 100, 'Total Premium': 100, ...o });
const PAY_H = ['Policy No', 'Payment Date', 'Amount', 'Insurance Company', 'Facility No', 'Vehicle Reg No', 'Payment Reference', 'Type'];
const payRow = (o = {}) => ({ __row: 2, 'Policy No': 'P1', 'Payment Date': '2026-02-01', Amount: 100, 'Insurance Company': 'X', 'Facility No': '', 'Vehicle Reg No': '', 'Payment Reference': 'REF1', Type: 'Receipt', ...o });
const run = (register, headers, rows, raw = stored()) => validate(register, { headers, rows }, raw, DEFAULT_CONFIG, { batchId: 'B2', user: 'Tester', bankId: 'pmf' });

describe('policy rows already in the system', () => {
  test('the same row again is a plain duplicate with nothing to choose', () => {
    const v = run('gwp', GWP_H, [gwpRow()]);
    expect(v.stats.duplicates).toBe(1);
    expect(v.conflicts).toEqual([]);
    expect(v.rows[0].note).toMatch(/nothing changed/);
  });

  test('changed values become one Update-or-Ignore choice listing old and new', () => {
    const v = run('gwp', GWP_H, [gwpRow({ 'Basic Premium': 120, 'Total Premium': 120, 'Vehicle Reg No': 'cab-2' })]);
    expect(v.stats).toMatchObject({ accepted: 0, rejected: 0, duplicates: 1 });
    expect(v.writes.txns).toEqual([]);
    const [c] = v.conflicts;
    const byLabel = Object.fromEntries(c.changes.map(x => [x.label, [x.old, x.new]]));
    expect(byLabel['Basic Premium']).toEqual([100, 120]);
    expect(byLabel['Total Premium']).toEqual([100, 120]);
    expect(byLabel['Vehicle Reg No']).toEqual(['CAB-1', 'CAB-2']);
    expect(byLabel.Address).toBeUndefined(); // a blank cell keeps the stored address
    const pol = c.updates.find(u => u.coll === 'policies');
    expect(pol.data.vehicle_no).toBe('CAB-2');
    expect(pol.data.history).toEqual([expect.objectContaining({ batch_id: 'B2', previous: { vehicle_no: 'CAB-1' } })]);
    const txn = c.updates.find(u => u.coll === 'txns');
    expect(txn.id).toBe('T1');
    expect(txn.data).toMatchObject({ basic: 120, total: 120 });
    expect(txn.data.history[0].previous).toMatchObject({ basic: 100, total: 100 });
  });

  test('a commission typed into the stored transaction is kept when the file gives none', () => {
    const raw = stored(); Object.assign(raw.txns[0], { comm_basic: 7, comm_total: 7, comm_source: 'file' });
    const v = run('gwp', GWP_H, [gwpRow({ 'Basic Premium': 120, 'Total Premium': 120 })], raw);
    expect(v.conflicts[0].changes.map(x => x.label)).not.toContain('Commission Basic');
  });

  test('a master row for a stored policy offers its new payment as part of the update', () => {
    const v = run('master', [...GWP_H, 'Premium Paid', 'Payment Date', 'Payment Reference'], [gwpRow({ 'Premium Paid': 100, 'Payment Date': '2026-02-01', 'Payment Reference': 'R9' })]);
    const [c] = v.conflicts;
    expect(c.changes).toEqual([expect.objectContaining({ label: 'Premium received 2026-02-01 (R9)', added: true, new: 100 })]);
    expect(c.adds).toEqual([expect.objectContaining({ coll: 'receipts', data: expect.objectContaining({ amount: 100, policy_id: PID, batch_id: 'B2' }) })]);
    expect(v.writes.receipts).toEqual([]);
  });

  test('a second row for the same new policy in one file is still rejected', () => {
    const fresh = { ...stored(), policies: [], txns: [] };
    const v = run('gwp', GWP_H, [gwpRow(), gwpRow({ __row: 3, 'Basic Premium': 90, 'Total Premium': 90 })], fresh);
    expect(v.stats).toMatchObject({ accepted: 1, rejected: 1 });
  });
});

test('names are taken in capitals, so different spellings of one insurer stay one', () => {
  const fresh = { ...stored(), policies: [], txns: [] };
  const v = run('gwp', GWP_H, [gwpRow({ 'Insurance Company': 'peoples Insurance', 'Customer Name': 'mr a. silva', Branch: 'colombo' })], fresh);
  expect(v.writes.policies[0].data).toMatchObject({ insurer: 'PEOPLES INSURANCE', customer: 'MR A. SILVA', branch: 'COLOMBO' });
  expect(capsRecord({ insurer: 'peoples insurance', status: 'Matched' })).toEqual({ insurer: 'PEOPLES INSURANCE', status: 'Matched' });
});

describe('payments and commission', () => {
  const withReceipt = (extra = {}) => { const raw = stored(); raw.receipts = [{ id: 'R1', policy_no: 'P1', policy_id: PID, date: '2026-02-01', amount: 100, reference: 'REF1', type: 'Receipt', status: 'Matched', ...extra }]; return raw; };

  test('same policy, date and reference with another amount is a correction to review', () => {
    const v = run('payments', PAY_H, [payRow({ Amount: 120 })], withReceipt());
    expect(v.writes.receipts).toEqual([]);
    expect(v.conflicts[0].changes).toEqual([expect.objectContaining({ label: 'Amount', old: 100, new: 120, money: true })]);
    expect(v.conflicts[0].updates[0]).toMatchObject({ coll: 'receipts', id: 'R1', data: { amount: 120 } });
  });

  test('an allocated receipt cannot have its amount changed', () => {
    const v = run('payments', PAY_H, [payRow({ Amount: 120 })], withReceipt({ allocations: [{ policy_id: PID, amount: 100 }] }));
    expect(v.conflicts[0].blocked).toMatch(/allocated/);
  });

  test('an unmatched receipt carries its open exception along', () => {
    const raw = withReceipt({ status: 'Unmatched', policy_id: null });
    raw.exceptions = [{ id: 'XR1', ref_id: 'R1', amount: 100, status: 'Open' }];
    const v = run('payments', PAY_H, [payRow({ Amount: 120 })], raw);
    expect(v.conflicts[0].updates.map(u => `${u.coll}/${u.id}:${u.data.amount}`)).toEqual(['receipts/R1:120', 'exceptions/XR1:120']);
  });

  test('a different reference is a separate payment, as before', () => {
    const v = run('payments', PAY_H, [payRow({ Amount: 120, 'Payment Reference': 'REF2' })], withReceipt());
    expect(v.stats.accepted).toBe(1);
    expect(v.conflicts).toEqual([]);
  });

  test('a Facility No on a payment fills in a blank one on the policy straight away', () => {
    const v = run('payments', PAY_H, [payRow({ 'Facility No': '1014231100094' })]);
    expect(v.stats.accepted).toBe(1);
    expect(v.writes.receipts).toHaveLength(1);
    expect(v.updates).toEqual([expect.objectContaining({ coll: 'policies', id: PID, data: expect.objectContaining({ facility_no: '1014231100094' }) })]);
    expect(v.rows[0].warnings.join()).toMatch(/Facility No 1014231100094 added to the policy/);
    expect(v.conflicts).toEqual([]);
  });

  test('a Facility No that differs from the policy replaces it too, keeping the old one in history', () => {
    const raw = stored(); raw.policies[0].facility_no = 'F-OLD';
    const v = run('payments', PAY_H, [payRow({ 'Facility No': 'F-NEW', 'Vehicle Reg No': 'cab-1' })], raw);
    expect(v.stats.accepted).toBe(1);
    expect(v.writes.receipts).toHaveLength(1);
    expect(v.conflicts).toEqual([]);
    expect(v.updates[0].data).toMatchObject({ facility_no: 'F-NEW', history: [expect.objectContaining({ previous: { facility_no: 'F-OLD' } })] });
    expect(v.rows[0].warnings.join()).toMatch(/Facility No on the policy changed F-OLD → F-NEW/);
  });

  test('a Facility No custom field on payments still goes on the receipt and now reaches the policy', () => {
    const config = { ...DEFAULT_CONFIG, custom_fields: { payment: [{ key: 'facility_no', label: 'Facility No', type: 'text' }] } };
    const v = validate('payments', { headers: PAY_H, rows: [payRow({ 'Facility No': '01712251000183' })] }, stored(), config, { batchId: 'B2', user: 'T', bankId: 'pmf' });
    expect(v.writes.receipts[0].data.custom).toEqual({ facility_no: '01712251000183' });
    expect(v.updates[0].data.facility_no).toBe('01712251000183');
  });

  test('a later row for the same policy with another Facility No is not carried', () => {
    const v = run('payments', PAY_H, [payRow({ 'Facility No': 'F1' }), payRow({ __row: 3, Amount: 50, 'Facility No': 'F2' })]);
    expect(v.updates).toHaveLength(1);
    expect(v.updates[0].data.facility_no).toBe('F1');
    expect(v.rows[1].warnings.join()).toMatch(/F2 differs from an earlier row/);
  });

  test('a commission file carries the Facility No too', () => {
    const v = run('commission', ['Policy No', 'Commission Date', 'Amount', 'Insurance Company', 'FacNo'], [{ __row: 2, 'Policy No': 'P1', 'Commission Date': '2026-02-01', Amount: 15, 'Insurance Company': 'X', FacNo: 'F1' }]);
    expect(v.updates[0].data.facility_no).toBe('F1');
  });
});

test('reversing a batch puts updated records back, and refuses when a later batch changed them again', async () => {
  const raw = stored();
  raw.batches = [{ id: 'B2', register: 'gwp', status: 'Posted', file_name: 'f.xlsx' }];
  raw.policies[0] = { ...raw.policies[0], vehicle_no: 'CAB-2', history: [{ batch_id: 'B2', previous: { vehicle_no: 'CAB-1' } }] };
  global.__OPS.length = 0;
  await executeReversal({ bankId: 'pmf', raw, me: { name: 'M', uid: 'm', readOnly: true } }, 'B2', 'wrong file', 'A1');
  const op = global.__OPS.find(([p]) => p.endsWith(PID));
  expect(op[1].vehicle_no).toBe('CAB-1');
  expect(op[1].history[0]).toMatchObject({ batch_id: 'B2', reversed: true });

  raw.policies[0].history.push({ batch_id: 'B3', previous: { vehicle_no: 'CAB-2' } });
  await expect(executeReversal({ bankId: 'pmf', raw, me: { name: 'M', uid: 'm', readOnly: true } }, 'B2', 'x', 'A2')).rejects.toThrow(/changed again by batch B3/);
});

test('the review panel: select all, untick one, blocked rows stay out', () => {
  const conflicts = [
    { rowNo: 2, title: 'P1 · X · 2026-01-01', changes: [{ label: 'Basic Premium', old: 100, new: 120, money: true }], updates: [], adds: [] },
    { rowNo: 3, title: 'P2 · X · 2026-01-01', changes: [{ label: 'Vehicle Reg No', old: 'A', new: 'B' }], updates: [], adds: [] },
    { rowNo: 4, title: 'P3 · X · 2026-02-01', changes: [{ label: 'Amount', old: 5, new: 6, money: true }], updates: [], adds: [], blocked: 'R3 is already allocated' },
  ];
  function Harness() { const [picked, setPicked] = React.useState(new Set()); return <><DuplicateReview conflicts={conflicts} picked={picked} setPicked={setPicked} /><span data-testid="out">{[...picked].join(',')}</span></>; }
  render(<Harness />);
  expect(screen.getByText('3 rows would change records already in the system')).toBeTruthy();
  expect(screen.getByText('0 to update')).toBeTruthy();
  fireEvent.click(screen.getByLabelText('Select all'));
  expect(screen.getByTestId('out').textContent).toBe('2,3');
  expect(screen.getByText('2 to update')).toBeTruthy();
  fireEvent.click(screen.getByText('P2 · X · 2026-01-01'));
  expect(screen.getByTestId('out').textContent).toBe('2');
  fireEvent.click(screen.getByText('P3 · X · 2026-02-01'));
  expect(screen.getByTestId('out').textContent).toBe('2');
  expect(screen.getByText('Cannot update')).toBeTruthy();
  expect(screen.getByText('120.00')).toBeTruthy();
});
