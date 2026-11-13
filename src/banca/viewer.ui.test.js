// PMF view-only login: sees the Management Dashboard and the 13 PMF BANCA reports and nothing else, loads only what they need, writes nothing.
import React from 'react';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import BancaPage from './BancaPage';
import { logoutWithSessionClose } from '../utils/workSession';

jest.mock('../App', () => ({ useAuth: () => ({ user: { uid: 'p1', email: 'pmf@ceilao.lk' }, userProfile: { role: 'pmf_viewer', full_name: 'PMF Finance' }, hasAccess: (k) => k === 'banca_pmf' }) }));
jest.mock('../firebase', () => ({ db: {}, auth: {} }));
jest.mock('../utils/workSession', () => ({ logoutWithSessionClose: jest.fn() }));
jest.mock('../storage', () => ({ uploadFile: jest.fn(), openFile: jest.fn() }));
jest.mock('recharts', () => { const P = ({ children }) => <div>{children}</div>; return new Proxy({}, { get: () => P }); });

global.__READS = [];
global.__WRITES = [];
jest.mock('firebase/firestore', () => {
  const write = (...a) => { global.__WRITES.push(a); return Promise.resolve(); };
  return {
    collection: (db, p) => ({ p }), doc: (db, ...p) => ({ p: p.join('/'), id: 'NEW' }), query: (c) => c, orderBy: () => null, limit: () => null,
    getDoc: async (d) => { global.__READS.push(d.p); return { exists: () => false, data: () => ({}) }; },
    getDocs: async (c) => { global.__READS.push(c.p); return { docs: [] }; },
    setDoc: write, updateDoc: write, writeBatch: () => ({ set: write, update: write, commit: write }),
  };
});

const REPORTS = ['Management Dashboard', 'Master Register', 'GWP Register', 'Payments Register', 'Commission Register', 'Renewal Tracker', 'Commission Tracker', 'Outstanding Tracker', 'Expired Policy Tracker', 'PMF & Ceilao Commission Split', 'GWP Report Library', 'Payment Confirmations Library', 'Commission Reports Library', 'Claims Tracker'];
const HIDDEN = ['Bulk Upload', 'Batch History', 'Exceptions', 'Reconciliation', 'PMF Statements & Payments', 'Approvals', 'PMF Payment Library', 'Claims Document Library', 'GWP Targets', 'Upload Fields', 'Settings', 'Audit Log', 'DR Tests', 'Issues & Support'];

const open = async (section) => {
  render(<MemoryRouter initialEntries={[`/banca/pmf/${section}`]}><Routes><Route path="/banca/:bankId/:section?" element={<BancaPage />} /></Routes></MemoryRouter>);
  await waitFor(() => expect(screen.getByText('Sign out')).toBeTruthy());
  await waitFor(() => expect(screen.queryByRole('progressbar')).toBeNull());
};

test('the menu has the dashboard, the 13 reports and nothing else', async () => {
  await open('master');
  for (const r of REPORTS) expect(screen.getAllByText(r).length).toBeGreaterThan(0);
  for (const h of HIDDEN) expect(screen.queryByText(h)).toBeNull();
  expect(screen.queryByText('Portal')).toBeNull();
  expect(screen.getAllByText('PMF Finance · View only').length).toBe(1);
});

for (const s of ['settings', 'upload', 'approvals', 'audit', 'batches', 'statements', 'p-dr', 'lib-pmf', 'made-up']) {
  test(`typing /banca/pmf/${s} into the address bar lands on the Master Register`, async () => {
    await open(s);
    expect(screen.getByText('Read-only consolidated view', { exact: false })).toBeTruthy();
  });
}

test('every report opens with no upload button', async () => {
  for (const s of ['master', 'gwp', 'payments', 'commission', 'renewals', 'commission-tracker', 'outstanding', 'expired', 'split', 'lib-gwp', 'lib-payment', 'lib-commission', 'claims']) {
    const { unmount } = render(<MemoryRouter initialEntries={[`/banca/pmf/${s}`]}><Routes><Route path="/banca/:bankId/:section?" element={<BancaPage />} /></Routes></MemoryRouter>);
    await waitFor(() => expect(screen.queryByRole('progressbar')).toBeNull());
    expect(screen.queryByText(/^Upload (document|claims)/)).toBeNull();
    expect(screen.queryByText(/Legal hold/)).toBeNull();
    unmount();
  }
});

test('the dashboard opens without anything built on data the login cannot read', async () => {
  await open('dashboard');
  expect(screen.getByRole('tab', { name: 'Financial Performance' })).toBeTruthy();
  expect(screen.queryByRole('tab', { name: 'Reconciliation' })).toBeNull();
  expect(screen.queryByText(/Legal hold/)).toBeNull();
  fireEvent.click(screen.getByRole('tab', { name: 'Data Quality' }));
  expect(screen.getByText('Completeness by source register')).toBeTruthy();
  expect(screen.queryByText(/exceptions/i)).toBeNull();
});

test('only the allowed collections are read, and nothing is written', async () => {
  global.__READS.length = 0; global.__WRITES.length = 0;
  await open('master');
  const reads = new Set(global.__READS);
  expect([...reads].sort()).toEqual(['banca/pmf', ...['batches', 'claims', 'commissions', 'files', 'pmf_payments', 'policies', 'receipts', 'statements', 'txns'].map(c => `banca/pmf/${c}`)].sort());
  expect(global.__WRITES).toEqual([]);
});

test('Sign out signs them out', async () => {
  await open('master');
  fireEvent.click(screen.getByText('Sign out'));
  await waitFor(() => expect(logoutWithSessionClose).toHaveBeenCalled());
});
