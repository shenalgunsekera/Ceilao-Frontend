import React, { useState, useEffect, useCallback } from 'react';
import {
  collection, getDocs, doc, updateDoc, deleteDoc,
  query, orderBy, serverTimestamp, where
} from 'firebase/firestore';
import { db } from '../firebase';
import { useAuth } from '../App';
import { useNavigate } from 'react-router-dom';
import ExcelJS from 'exceljs';
import JSZip from 'jszip';
import { saveAs } from 'file-saver';
import logoUrl from '../Ceilao Logo.png';
import PendingApprovals from './PendingApprovals';
import CreateAccountModal from './CreateAccountModal';
import InsuranceCompaniesManager from './InsuranceCompaniesManager';
import ModuleAccessManager from './ModuleAccessManager';

import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import Card from '@mui/material/Card';
import CardContent from '@mui/material/CardContent';
import Button from '@mui/material/Button';
import IconButton from '@mui/material/IconButton';
import Chip from '@mui/material/Chip';
import Stack from '@mui/material/Stack';
import Tabs from '@mui/material/Tabs';
import Tab from '@mui/material/Tab';
import Collapse from '@mui/material/Collapse';
import TextField from '@mui/material/TextField';
import MenuItem from '@mui/material/MenuItem';
import Select from '@mui/material/Select';
import FormControl from '@mui/material/FormControl';
import InputLabel from '@mui/material/InputLabel';
import Dialog from '@mui/material/Dialog';
import DialogTitle from '@mui/material/DialogTitle';
import DialogContent from '@mui/material/DialogContent';
import LinearProgress from '@mui/material/LinearProgress';
import Snackbar from '@mui/material/Snackbar';
import Alert from '@mui/material/Alert';

import ConfirmationNumberOutlinedIcon from '@mui/icons-material/ConfirmationNumberOutlined';
import BackupOutlinedIcon from '@mui/icons-material/BackupOutlined';
import HourglassEmptyIcon from '@mui/icons-material/HourglassEmpty';
import GroupAddOutlinedIcon from '@mui/icons-material/GroupAddOutlined';
import BusinessOutlinedIcon from '@mui/icons-material/BusinessOutlined';
import LockOutlinedIcon from '@mui/icons-material/LockOutlined';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import ExpandLessIcon from '@mui/icons-material/ExpandLess';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline';
import SaveOutlinedIcon from '@mui/icons-material/SaveOutlined';
import FolderZipOutlinedIcon from '@mui/icons-material/FolderZipOutlined';
import CheckCircleOutlineIcon from '@mui/icons-material/CheckCircleOutline';
import EditOutlinedIcon from '@mui/icons-material/EditOutlined';
import CheckIcon from '@mui/icons-material/Check';
import CloseIcon from '@mui/icons-material/Close';

/* ── colour maps ─────────────────────────────────────────────────────────── */
const PRIORITY_COLORS = {
  Low:      { bg: 'rgba(16,185,129,0.10)', color: '#059669' },
  Medium:   { bg: 'rgba(245,158,11,0.12)', color: '#d97706' },
  High:     { bg: 'rgba(255,90,90,0.12)',  color: '#FF5A5A' },
  Critical: { bg: 'rgba(139,0,0,0.12)',    color: '#8B0000' },
};
const STATUS_COLORS = {
  Open:        { bg: 'rgba(99,102,241,0.12)',  color: '#6366f1' },
  'In Progress':{ bg: 'rgba(245,158,11,0.12)', color: '#d97706' },
  Resolved:    { bg: 'rgba(16,185,129,0.12)',  color: '#059669' },
  Closed:      { bg: 'rgba(107,114,128,0.12)', color: '#6B7280' },
};

/* ── ExcelJS ARGB palette ────────────────────────────────────────────────── */
const XL = {
  coral: 'FFFF5A5A', orange: 'FFFF8B5A', dark: 'FF1A1A2E',
  grey: 'FF6B7280', peach: 'FFFFF8F5', border: 'FFFFD4C0',
  white: 'FFFFFFFF', gold: 'FFFFD45A',
};

function xlFill(argb) {
  return { type: 'pattern', pattern: 'solid', fgColor: { argb } };
}

/* ── build per-client workbook ──────────────────────────────────────────── */
async function buildClientWorkbook(client, logoBase64, ExcelJS) {
  const wb = new ExcelJS.Workbook();
  wb.creator = 'Ceilao Insurance Brokers';
  wb.created = new Date();

  const ws = wb.addWorksheet('Client Info');

  let logoId = null;
  if (logoBase64) {
    try { logoId = wb.addImage({ base64: logoBase64, extension: 'png' }); } catch { /* skip */ }
  }

  ws.columns = [{ width: 26 }, { width: 38 }];

  // Header block rows 1-4
  ws.mergeCells('A1:B4');
  const hCell = ws.getCell('A1');
  hCell.value = '';
  hCell.fill = xlFill(XL.coral);
  ws.getRow(1).height = 18; ws.getRow(2).height = 18;
  ws.getRow(3).height = 18; ws.getRow(4).height = 18;

  if (logoId !== null) {
    ws.addImage(logoId, { tl: { col: 0.3, row: 0.2 }, ext: { width: 100, height: 50 } });
  }

  ws.mergeCells('A5:B5');
  const cCell = ws.getCell('A5');
  cCell.value = 'CEILAO INSURANCE BROKERS (PVT) LTD';
  cCell.fill = xlFill(XL.dark);
  cCell.font = { bold: true, size: 12, color: { argb: XL.white }, name: 'Calibri' };
  cCell.alignment = { horizontal: 'center', vertical: 'middle' };
  ws.getRow(5).height = 22;

  ws.mergeCells('A6:B6');
  const tCell = ws.getCell('A6');
  const fileNo = client.ceilao_ib_file_no || client.id;
  tCell.value = `CLIENT RECORD — FILE NO: ${fileNo}`;
  tCell.fill = xlFill(XL.orange);
  tCell.font = { bold: true, size: 11, color: { argb: XL.white }, name: 'Calibri' };
  tCell.alignment = { horizontal: 'center', vertical: 'middle' };
  ws.getRow(6).height = 20;

  ws.mergeCells('A7:B7');
  const dCell = ws.getCell('A7');
  dCell.value = `Exported: ${new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })}`;
  dCell.fill = xlFill(XL.peach);
  dCell.font = { size: 9.5, color: { argb: XL.grey }, name: 'Calibri' };
  dCell.alignment = { horizontal: 'center' };
  ws.getRow(7).height = 15;
  ws.getRow(8).height = 8;

  let row = 9;
  const sections = [
    { title: 'GENERAL INFORMATION', fields: [
      ['Client Name',        client.client_name],
      ['Customer Type',      client.customer_type],
      ['Product',            client.product],
      ['Insurance Provider', client.insurance_provider],
      ['Insurer',            client.insurer],
      ['Branch',             client.branch],
      ['Main Class',         client.main_class],
      ['Vehicle Number',     client.vehicle_number],
      ['Ceilao IB File No.', client.ceilao_ib_file_no],
      ['Introducer Code',    client.introducer_code],
      ['NIC Proof',          client.nic_proof],
      ['DOB Proof',          client.dob_proof],
      ['Business Reg.',      client.business_registration],
      ['SVAT Proof',         client.svat_proof],
      ['VAT Proof',          client.vat_proof],
      ['Sales Rep ID',       client.sales_rep_id],
    ]},
    { title: 'ADDRESS', fields: [
      ['Street 1',  client.street1],
      ['Street 2',  client.street2],
      ['City',      client.city],
      ['District',  client.district],
      ['Province',  client.province],
    ]},
    { title: 'CONTACT', fields: [
      ['Mobile No',      client.mobile_no],
      ['Telephone',      client.telephone],
      ['Email',          client.email],
      ['Contact Person', client.contact_person],
      ['Social Media',   client.social_media],
    ]},
    { title: 'POLICY', fields: [
      ['Policy Type',        client.policy_type],
      ['Policy No',          client.policy_no],
      ['Policy',             client.policy_],
      ['Policy Period From', client.policy_period_from],
      ['Policy Period To',   client.policy_period_to],
      ['Coverage',           client.coverage],
    ]},
    { title: 'FINANCIALS', fields: [
      ['Sum Insured',    client.sum_insured],
      ['Basic Premium',  client.basic_premium],
      ['SRCC Premium',   client.srcc_premium],
      ['TC Premium',     client.tc_premium],
      ['Net Premium',    client.net_premium],
      ['Stamp Duty',     client.stamp_duty],
      ['Admin Fees',     client.admin_fees],
      ['Road Safety Fee',client.road_safety_fee],
      ['Policy Fee',     client.policy_fee],
      ['VAT Fee',        client.vat_fee],
      ['Total Invoice',  client.total_invoice],
      ['Commission Type',client.commission_type],
      ['Commission Basic',client.commission_basic],
      ['Commission SRCC', client.commission_srcc],
      ['Commission TC',   client.commission_tc],
    ]},
    { title: 'DOCUMENTS (URLs)', fields: [
      ['Policyholder Doc',     client.policyholder_doc_url],
      ['Proposal Form Doc',    client.proposal_form_doc_url],
      ['Quotation Doc',        client.quotation_doc_url],
      ['CR Copy Doc',          client.cr_copy_doc_url],
      ['Schedule Doc',         client.schedule_doc_url],
      ['Invoice/Debit Doc',    client.invoice_doc_url],
      ['Payment Receipt Doc',  client.payment_receipt_doc_url],
      ['NIC/BR Doc',           client.nic_br_doc_url],
    ]},
  ];

  sections.forEach(sec => {
    // Section header
    ws.mergeCells(row, 1, row, 2);
    const sh = ws.getCell(row, 1);
    sh.value = sec.title;
    sh.fill = xlFill(XL.dark);
    sh.font = { bold: true, size: 9.5, color: { argb: XL.gold }, name: 'Calibri' };
    sh.alignment = { horizontal: 'left', vertical: 'middle', indent: 1 };
    ws.getRow(row).height = 18;
    row++;

    sec.fields.forEach(([label, value], i) => {
      const bg = i % 2 === 1 ? XL.peach : XL.white;
      const lc = ws.getCell(row, 1);
      lc.value = label;
      lc.fill = xlFill(bg);
      lc.font = { size: 10, color: { argb: XL.grey }, name: 'Calibri' };
      lc.alignment = { vertical: 'middle', indent: 1 };
      lc.border = { bottom: { style: 'hair', color: { argb: XL.border } } };

      const vc = ws.getCell(row, 2);
      vc.value = value || '—';
      vc.fill = xlFill(bg);
      vc.font = { size: 10, bold: label.includes('Total') || label.includes('Net'), color: { argb: XL.dark }, name: 'Calibri' };
      vc.alignment = { vertical: 'middle', indent: 1, wrapText: true };
      vc.border = { bottom: { style: 'hair', color: { argb: XL.border } } };

      ws.getRow(row).height = 17;
      row++;
    });
    ws.getRow(row).height = 6;
    row++;
  });

  return wb.xlsx.writeBuffer();
}

/* ── fetch all docs for a client into a JSZip ───────────────────────────── */
const DOC_FIELDS = [
  { label: 'policyholder',     key: 'policyholder_doc_url' },
  { label: 'proposal_form',    key: 'proposal_form_doc_url' },
  { label: 'quotation',        key: 'quotation_doc_url' },
  { label: 'cr_copy',          key: 'cr_copy_doc_url' },
  { label: 'schedule',         key: 'schedule_doc_url' },
  { label: 'invoice',          key: 'invoice_doc_url' },
  { label: 'payment_receipt',  key: 'payment_receipt_doc_url' },
  { label: 'nic_br',           key: 'nic_br_doc_url' },
];

async function fetchLogoBase64() {
  try {
    const resp = await fetch(logoUrl);
    const blob = await resp.blob();
    return new Promise((res, rej) => {
      const r = new FileReader();
      r.onloadend = () => res(r.result.split(',')[1]);
      r.onerror = rej;
      r.readAsDataURL(blob);
    });
  } catch { return null; }
}

async function buildDocZip(client, JSZip) {
  const zip = new JSZip();
  const urlLines = [];
  let fetchedAny = false;

  for (const { label, key } of DOC_FIELDS) {
    const url = client[key];
    if (!url) continue;

    // Always record the URL so the zip is never empty
    urlLines.push(`${label}:\n  ${url}\n`);

    try {
      const ctrl = new AbortController();
      const timer = setTimeout(() => ctrl.abort(), 30_000); // 30s per file
      const resp = await fetch(url, {
        mode: 'cors',
        cache: 'no-cache',
        signal: ctrl.signal,
        headers: { 'Accept': '*/*' },
      });
      clearTimeout(timer);
      if (!resp.ok) continue;
      const buf = await resp.arrayBuffer();
      if (buf.byteLength === 0) continue;

      // Extract extension from URL path (before any query string)
      const pathPart = url.split('?')[0];
      const ext = pathPart.includes('.')
        ? pathPart.split('.').pop().toLowerCase().slice(0, 5) || 'pdf'
        : 'pdf';

      zip.file(`${label}.${ext}`, buf);
      fetchedAny = true;
    } catch {
      // Binary fetch failed — URL is still recorded in document_links.txt
    }
  }

  // Always include a plain-text list of all document URLs as a reliable fallback
  if (urlLines.length === 0) return null;
  zip.file('document_links.txt', urlLines.join('\n'));

  // If binary fetch failed entirely, add a note explaining how to access files
  if (!fetchedAny && urlLines.length > 0) {
    zip.file('README.txt', [
      'Binary download of documents was blocked by CORS in this browser session.',
      'Open document_links.txt and paste each URL into your browser to view/save the files.',
      '',
      'To enable direct binary backup, configure CORS in your Cloudinary dashboard:',
      '  Settings → Security → Allowed fetch domains → add your Vercel domain',
    ].join('\n'));
  }

  return zip.generateAsync({ type: 'arraybuffer', compression: 'DEFLATE' });
}

/* ── ticket chip helpers ─────────────────────────────────────────────────── */
function PriorityChip({ p }) {
  const c = PRIORITY_COLORS[p] || PRIORITY_COLORS.Low;
  return <Chip label={p} size="small" sx={{ bgcolor: c.bg, color: c.color, fontWeight: 700, fontSize: 11 }} />;
}
function StatusChip({ s }) {
  const c = STATUS_COLORS[s] || STATUS_COLORS.Open;
  return <Chip label={s} size="small" sx={{ bgcolor: c.bg, color: c.color, fontWeight: 700, fontSize: 11 }} />;
}

/* ── TicketCard ──────────────────────────────────────────────────────────── */
function TicketCard({ ticket, onSave, onDelete }) {
  const [open, setOpen] = useState(false);
  const [status, setStatus] = useState(ticket.status);
  const [notes, setNotes] = useState(ticket.admin_notes || '');
  const [saving, setSaving] = useState(false);

  const save = async () => {
    setSaving(true);
    await onSave(ticket.id, { status, admin_notes: notes, updated_at: serverTimestamp() });
    setSaving(false);
  };

  const created = ticket.created_at?.toDate?.()
    ? ticket.created_at.toDate().toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
    : '—';

  return (
    <Card sx={{ mb: 1.5, border: '1px solid rgba(255,139,90,0.12)' }}>
      <CardContent sx={{ p: 0, '&:last-child': { pb: 0 } }}>
        {/* collapsed header */}
        <Box
          onClick={() => setOpen(o => !o)}
          sx={{ px: 2.5, py: 1.5, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 1.5,
                '&:hover': { bgcolor: 'rgba(255,90,90,0.02)' } }}
        >
          <Box sx={{ flex: 1, minWidth: 0 }}>
            <Typography sx={{ fontWeight: 700, fontSize: 14, color: '#1A1A2E', mb: 0.3, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
              {ticket.subject}
            </Typography>
            <Stack direction="row" spacing={0.8} alignItems="center" flexWrap="wrap">
              <StatusChip s={ticket.status} />
              <PriorityChip p={ticket.priority} />
              <Chip label={ticket.category} size="small" sx={{ bgcolor: 'rgba(99,102,241,0.08)', color: '#6366f1', fontWeight: 600, fontSize: 11 }} />
              <Typography sx={{ fontSize: 11, color: '#9CA3AF' }}>by {ticket.created_by_name} · {created}</Typography>
            </Stack>
          </Box>
          <Stack direction="row" spacing={0.5} alignItems="center">
            <IconButton size="small" onClick={e => { e.stopPropagation(); onDelete(ticket.id); }}
              sx={{ color: 'rgba(239,68,68,0.4)', '&:hover': { color: '#ef4444', bgcolor: 'rgba(239,68,68,0.08)' } }}>
              <DeleteOutlineIcon fontSize="small" />
            </IconButton>
            {open ? <ExpandLessIcon sx={{ color: '#9CA3AF' }} /> : <ExpandMoreIcon sx={{ color: '#9CA3AF' }} />}
          </Stack>
        </Box>

        {/* expanded body */}
        <Collapse in={open} timeout={220} unmountOnExit>
          <Box sx={{ px: 2.5, pb: 2.5, pt: 0.5, borderTop: '1px solid rgba(255,139,90,0.08)' }}>
            <Typography sx={{ fontSize: 13, color: '#374151', mb: 2, whiteSpace: 'pre-wrap', lineHeight: 1.7 }}>
              {ticket.description}
            </Typography>
            <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.5} alignItems="flex-start">
              <FormControl size="small" sx={{ minWidth: 150 }}>
                <InputLabel sx={{ fontSize: 12 }}>Status</InputLabel>
                <Select value={status} label="Status" onChange={e => setStatus(e.target.value)} sx={{ fontSize: 13 }}>
                  {['Open', 'In Progress', 'Resolved', 'Closed'].map(s => (
                    <MenuItem key={s} value={s} sx={{ fontSize: 13 }}>{s}</MenuItem>
                  ))}
                </Select>
              </FormControl>
              <TextField
                label="Admin Notes / Response" multiline minRows={2}
                value={notes} onChange={e => setNotes(e.target.value)}
                size="small" fullWidth
                sx={{ '& textarea': { fontSize: 13 }, '& label': { fontSize: 12 } }}
              />
              <Button variant="contained" size="small" startIcon={<SaveOutlinedIcon />}
                onClick={save} disabled={saving}
                sx={{ whiteSpace: 'nowrap', flexShrink: 0, alignSelf: 'flex-end' }}>
                {saving ? 'Saving…' : 'Save'}
              </Button>
            </Stack>
          </Box>
        </Collapse>
      </CardContent>
    </Card>
  );
}

/* ── main AdminPanel ─────────────────────────────────────────────────────── */
const AdminPanel = () => {
  const { userProfile } = useAuth();
  const navigate = useNavigate();

  const [tab,        setTab]        = useState(0);
  const [tickets,    setTickets]    = useState([]);
  const [ticketLoad, setTicketLoad] = useState(true);
  const [filterStatus, setFilterStatus] = useState('All');
  const [filterPriority, setFilterPriority] = useState('All');
  const [backupOpen,    setBackupOpen]    = useState(false);
  const [reditRequests, setReditRequests] = useState([]);
  const [reditLoading,  setReditLoading]  = useState(false);
  const [backupState,   setBackupState]   = useState({ step: '', progress: 0, done: false });
  const [createAccOpen, setCreateAccOpen] = useState(false);
  const [toast, setToast] = useState({ open: false, msg: '', severity: 'success' });

  const isManager = userProfile?.role === 'manager' || userProfile?.role === 'admin';
  const isAdmin   = userProfile?.role === 'admin';
  const isPrivileged = isManager;

  // Admin guard — only redirect after profile has loaded and is definitively non-privileged
  useEffect(() => {
    if (userProfile && !isPrivileged) navigate('/');
  }, [userProfile, isPrivileged, navigate]);

  const loadTickets = useCallback(async () => {
    setTicketLoad(true);
    try {
      const q = query(collection(db, 'tickets'), orderBy('created_at', 'desc'));
      const snap = await getDocs(q);
      setTickets(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    } catch { /* ignore */ }
    setTicketLoad(false);
  }, []);

  const loadReditRequests = useCallback(async () => {
    setReditLoading(true);
    try {
      const snap = await getDocs(query(collection(db, 'quote_redit_requests'), orderBy('requested_at', 'desc')));
      setReditRequests(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    } catch { /* ignore */ }
    setReditLoading(false);
  }, []);

  const handleReditDecision = async (reqId, decision) => {
    const approvedUntil = new Date(Date.now() + 15 * 60 * 1000).toISOString();
    await updateDoc(doc(db, 'quote_redit_requests', reqId), {
      status:          decision,
      ...(decision === 'approved' ? { approved_until: approvedUntil } : {}),
      reviewed_by:     userProfile?.full_name || user?.email || '',
      reviewed_at:     serverTimestamp(),
    });
    setReditRequests(prev => prev.map(r => r.id === reqId ? { ...r, status: decision } : r));
    setToast({ open: true, msg: `Re-edit request ${decision}.`, severity: decision === 'approved' ? 'success' : 'info' });
  };

  useEffect(() => { loadTickets(); }, [loadTickets]);
  useEffect(() => { if (tab === 6) loadReditRequests(); }, [tab, loadReditRequests]);

  const saveTicket = async (id, updates) => {
    await updateDoc(doc(db, 'tickets', id), updates);
    setTickets(prev => prev.map(t => t.id === id ? { ...t, ...updates } : t));
    setToast({ open: true, msg: 'Ticket updated.', severity: 'success' });
  };

  const deleteTicket = async (id) => {
    await deleteDoc(doc(db, 'tickets', id));
    setTickets(prev => prev.filter(t => t.id !== id));
    setToast({ open: true, msg: 'Ticket deleted.', severity: 'info' });
  };

  const filteredTickets = tickets.filter(t => {
    if (filterStatus !== 'All' && t.status !== filterStatus) return false;
    if (filterPriority !== 'All' && t.priority !== filterPriority) return false;
    return true;
  });

  const stats = {
    total:      tickets.length,
    open:       tickets.filter(t => t.status === 'Open').length,
    inProgress: tickets.filter(t => t.status === 'In Progress').length,
    resolved:   tickets.filter(t => t.status === 'Resolved' || t.status === 'Closed').length,
  };

  /* ── backup ── */
  const runBackup = async () => {
    setBackupOpen(true);
    setBackupState({ step: 'Loading client records…', progress: 0, done: false });

    try {
      const snap = await getDocs(query(collection(db, 'clients'), orderBy('created_at', 'desc')));
      const clients = snap.docs.map(d => ({ id: d.id, ...d.data() }));

      setBackupState(s => ({ ...s, step: 'Loading company logo…' }));
      const logoBase64 = await fetchLogoBase64();

      const masterZip = new JSZip();
      const total = clients.length;

      for (let i = 0; i < total; i++) {
        const c = clients[i];
        const fileNo = (c.ceilao_ib_file_no || c.id).toString().replace(/[^a-zA-Z0-9_-]/g, '_');
        const safeName = (c.client_name || 'Unknown').replace(/[^a-zA-Z0-9 _-]/g, '').trim();
        const folderName = `${fileNo}_${safeName}`;
        const folder = masterZip.folder(folderName);

        setBackupState({
          step: `Backing up ${i + 1} of ${total}: ${c.client_name || fileNo}`,
          progress: Math.round(((i) / total) * 90),
          done: false,
        });

        // Excel info sheet
        try {
          const xlBuf = await buildClientWorkbook(c, logoBase64, ExcelJS);
          folder.file(`${fileNo}_info.xlsx`, xlBuf);
        } catch { /* skip on error */ }

        // Documents zip
        try {
          const docBuf = await buildDocZip(c, JSZip);
          if (docBuf) folder.file(`${fileNo}_documents.zip`, docBuf);
        } catch { /* skip on error */ }
      }

      setBackupState({ step: 'Generating master ZIP…', progress: 92, done: false });

      const blob = await masterZip.generateAsync(
        { type: 'blob', compression: 'DEFLATE', compressionOptions: { level: 6 } },
        (meta) => setBackupState(s => ({ ...s, progress: 92 + Math.round(meta.percent * 0.08) }))
      );

      const dateStr = new Date().toISOString().slice(0, 10).replace(/-/g, '');
      saveAs(blob, `ceilao_backup_${dateStr}.zip`);
      setBackupState({ step: `Backup complete! ${total} client${total !== 1 ? 's' : ''} exported.`, progress: 100, done: true });

    } catch (err) {
      setBackupState({ step: `Error: ${err.message}`, progress: 0, done: true });
    }
  };

  return (
    <Box className="page-enter" sx={{ maxWidth: 1000, mx: 'auto' }}>
      <Typography variant="h5" sx={{ mb: 0.5, fontWeight: 800 }}>Admin Panel</Typography>
      <Typography sx={{ fontSize: 13, color: '#9CA3AF', mb: 3 }}>
        Manage support tickets and back up client data.
      </Typography>

      <Tabs
        value={tab} onChange={(_, v) => setTab(v)}
        sx={{
          mb: 3, borderBottom: '1px solid rgba(255,139,90,0.12)',
          '& .MuiTab-root': { fontSize: 13, fontWeight: 600, textTransform: 'none', color: '#9CA3AF' },
          '& .Mui-selected': { color: '#FF5A5A' },
          '& .MuiTabs-indicator': { background: 'linear-gradient(90deg,#FF5A5A,#FF8B5A)', height: 2.5 },
        }}
      >
        <Tab icon={<ConfirmationNumberOutlinedIcon sx={{ fontSize: 18 }} />} iconPosition="start" label={`Tickets${stats.open ? ` (${stats.open})` : ''}`} />
        <Tab icon={<HourglassEmptyIcon sx={{ fontSize: 18 }} />} iconPosition="start" label="Pending Approvals" />
        <Tab icon={<GroupAddOutlinedIcon sx={{ fontSize: 18 }} />} iconPosition="start" label="Accounts" />
        <Tab icon={<BusinessOutlinedIcon sx={{ fontSize: 18 }} />} iconPosition="start" label="Insurers" />
        <Tab icon={<LockOutlinedIcon sx={{ fontSize: 18 }} />} iconPosition="start" label="Module Access" />
        <Tab icon={<BackupOutlinedIcon sx={{ fontSize: 18 }} />} iconPosition="start" label="Data Backup" />
        <Tab icon={<EditOutlinedIcon sx={{ fontSize: 18 }} />} iconPosition="start"
          label={`Re-edit Requests${reditRequests.filter(r => r.status === 'pending').length ? ` (${reditRequests.filter(r => r.status === 'pending').length})` : ''}`} />
      </Tabs>

      {/* ── TICKETS TAB ── */}
      {tab === 0 && (
        <Box>
          {/* stats */}
          <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.5} sx={{ mb: 2.5 }}>
            {[
              { label: 'Total',       val: stats.total,      color: '#6366f1', bg: 'rgba(99,102,241,0.08)' },
              { label: 'Open',        val: stats.open,       color: '#FF5A5A', bg: 'rgba(255,90,90,0.08)' },
              { label: 'In Progress', val: stats.inProgress, color: '#d97706', bg: 'rgba(245,158,11,0.08)' },
              { label: 'Resolved',    val: stats.resolved,   color: '#059669', bg: 'rgba(16,185,129,0.08)' },
            ].map(s => (
              <Box key={s.label} sx={{ flex: 1, p: 2, borderRadius: '12px', bgcolor: s.bg, border: `1px solid ${s.bg}` }}>
                <Typography sx={{ fontSize: 22, fontWeight: 800, color: s.color }}>{s.val}</Typography>
                <Typography sx={{ fontSize: 12, color: '#6B7280' }}>{s.label}</Typography>
              </Box>
            ))}
          </Stack>

          {/* filters */}
          <Stack direction="row" spacing={1.5} sx={{ mb: 2 }} flexWrap="wrap">
            <FormControl size="small" sx={{ minWidth: 130 }}>
              <InputLabel sx={{ fontSize: 12 }}>Status</InputLabel>
              <Select value={filterStatus} label="Status" onChange={e => setFilterStatus(e.target.value)} sx={{ fontSize: 13 }}>
                {['All', 'Open', 'In Progress', 'Resolved', 'Closed'].map(s => (
                  <MenuItem key={s} value={s} sx={{ fontSize: 13 }}>{s}</MenuItem>
                ))}
              </Select>
            </FormControl>
            <FormControl size="small" sx={{ minWidth: 130 }}>
              <InputLabel sx={{ fontSize: 12 }}>Priority</InputLabel>
              <Select value={filterPriority} label="Priority" onChange={e => setFilterPriority(e.target.value)} sx={{ fontSize: 13 }}>
                {['All', 'Low', 'Medium', 'High', 'Critical'].map(p => (
                  <MenuItem key={p} value={p} sx={{ fontSize: 13 }}>{p}</MenuItem>
                ))}
              </Select>
            </FormControl>
            <Button size="small" variant="outlined" onClick={loadTickets}
              sx={{ fontSize: 12, borderColor: 'rgba(255,139,90,0.3)', color: '#FF8B5A' }}>
              Refresh
            </Button>
          </Stack>

          {ticketLoad
            ? <Typography sx={{ color: '#9CA3AF', fontSize: 13 }}>Loading tickets…</Typography>
            : filteredTickets.length === 0
              ? <Box sx={{ textAlign: 'center', py: 6 }}>
                  <ConfirmationNumberOutlinedIcon sx={{ fontSize: 40, color: 'rgba(255,90,90,0.2)', mb: 1 }} />
                  <Typography sx={{ color: '#9CA3AF' }}>No tickets found.</Typography>
                </Box>
              : filteredTickets.map(t => (
                  <TicketCard key={t.id} ticket={t} onSave={saveTicket} onDelete={deleteTicket} />
                ))
          }
        </Box>
      )}

      {/* ── PENDING APPROVALS TAB ── */}
      {tab === 1 && <PendingApprovals />}

      {/* ── ACCOUNTS TAB ── */}
      {tab === 2 && (
        <Box>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2.5 }}>
            <Box>
              <Typography sx={{ fontWeight: 700, fontSize: 15 }}>Employee Accounts</Typography>
              <Typography sx={{ fontSize: 12, color: '#9CA3AF' }}>Create login credentials for new staff members</Typography>
            </Box>
            <Button variant="contained" startIcon={<GroupAddOutlinedIcon />}
              onClick={() => setCreateAccOpen(true)} sx={{ fontSize: 13 }}>
              Create Account
            </Button>
          </Box>
          <Box sx={{ p: 3, borderRadius: '14px', bgcolor: 'rgba(255,90,90,0.04)', border: '1px solid rgba(255,139,90,0.12)' }}>
            <Typography sx={{ fontSize: 13, color: '#6B7280', lineHeight: 1.8 }}>
              Use this to create login accounts for your employees and managers. They receive an email and password you can share with them.
              Employees can add clients (pending manager approval). Managers get full access including the Admin Panel.
            </Typography>
          </Box>
          <CreateAccountModal
            open={createAccOpen}
            onClose={() => setCreateAccOpen(false)}
            onCreated={() => setToast({ open: true, msg: 'Account created successfully!', severity: 'success' })}
          />
        </Box>
      )}

      {/* ── INSURERS TAB ── */}
      {tab === 3 && <InsuranceCompaniesManager />}

      {/* ── MODULE ACCESS TAB ── */}
      {tab === 4 && <ModuleAccessManager />}

      {/* ── BACKUP TAB (admin only) ── */}
      {tab === 5 && !isAdmin && (
        <Box sx={{ textAlign: 'center', py: 6 }}>
          <Typography sx={{ color: '#9CA3AF' }}>Data backup is restricted to admin accounts.</Typography>
        </Box>
      )}
      {tab === 5 && isAdmin && (
        <Box>
          <Card sx={{ mb: 2 }}>
            <CardContent>
              <Box sx={{ display: 'flex', gap: 2, alignItems: 'flex-start' }}>
                <Box sx={{
                  width: 48, height: 48, borderRadius: '12px', flexShrink: 0,
                  background: 'linear-gradient(135deg,#FF5A5A,#FF8B5A)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}>
                  <FolderZipOutlinedIcon sx={{ color: '#fff', fontSize: 22 }} />
                </Box>
                <Box>
                  <Typography sx={{ fontWeight: 700, fontSize: 15, mb: 0.5 }}>Full Data Backup</Typography>
                  <Typography sx={{ fontSize: 13, color: '#6B7280', mb: 1.5, lineHeight: 1.6 }}>
                    Downloads a ZIP file containing one folder per client (named by File Number).
                    Each folder contains an <strong>Excel sheet</strong> with all text data and a
                    <strong> documents ZIP</strong> with uploaded files.
                  </Typography>
                  <Stack direction="row" spacing={1} sx={{ mb: 1.5 }} flexWrap="wrap">
                    {[
                      '📁 {FileNo}_{Name}/ per client',
                      '📊 {FileNo}_info.xlsx — all fields',
                      '🗂 {FileNo}_documents.zip — PDFs & files',
                    ].map(t => (
                      <Chip key={t} label={t} size="small"
                        sx={{ bgcolor: 'rgba(255,90,90,0.07)', color: '#FF5A5A', fontWeight: 600, fontSize: 11 }} />
                    ))}
                  </Stack>
                  <Button
                    variant="contained" startIcon={<BackupOutlinedIcon />}
                    onClick={runBackup}
                    sx={{ fontSize: 13 }}
                  >
                    Backup All Clients
                  </Button>
                </Box>
              </Box>
            </CardContent>
          </Card>
        </Box>
      )}

      {/* ── Backup Progress Dialog ── */}
      <Dialog open={backupOpen} maxWidth="sm" fullWidth PaperProps={{ sx: { borderRadius: '16px' } }}>
        <DialogTitle sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
          {backupState.done
            ? <CheckCircleOutlineIcon sx={{ color: '#10B981' }} />
            : <BackupOutlinedIcon sx={{ color: '#FF8B5A' }} />
          }
          {backupState.done ? 'Backup Complete' : 'Backing Up…'}
        </DialogTitle>
        <DialogContent sx={{ pt: 1, pb: 3 }}>
          <Typography sx={{ fontSize: 13, color: '#374151', mb: 2 }}>{backupState.step}</Typography>
          <LinearProgress
            variant="determinate" value={backupState.progress}
            sx={{ height: 8, borderRadius: 4,
                  '& .MuiLinearProgress-bar': { background: 'linear-gradient(90deg,#FF5A5A,#FF8B5A)' },
                  bgcolor: 'rgba(255,90,90,0.10)' }}
          />
          <Typography sx={{ fontSize: 11, color: '#9CA3AF', mt: 1, textAlign: 'right' }}>
            {backupState.progress}%
          </Typography>
          {backupState.done && (
            <Button fullWidth variant="outlined" sx={{ mt: 2, fontSize: 13 }}
              onClick={() => { setBackupOpen(false); setBackupState({ step: '', progress: 0, done: false }); }}>
              Close
            </Button>
          )}
        </DialogContent>
      </Dialog>

      {/* ── RE-EDIT REQUESTS TAB ── */}
      {tab === 6 && (
        <Box>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2.5 }}>
            <Box>
              <Typography variant="h6" sx={{ fontWeight: 700 }}>Re-edit Requests</Typography>
              <Typography sx={{ fontSize: 13, color: '#9CA3AF' }}>
                Insurance companies requesting permission to edit a submitted quote response
              </Typography>
            </Box>
            <Button size="small" variant="outlined" onClick={loadReditRequests}
              sx={{ borderColor: 'rgba(255,139,90,0.3)', color: '#FF8B5A', fontSize: 12 }}>
              Refresh
            </Button>
          </Box>

          {reditLoading ? (
            <Typography sx={{ color: '#9CA3AF', fontSize: 13 }}>Loading…</Typography>
          ) : reditRequests.length === 0 ? (
            <Box sx={{ textAlign: 'center', py: 6 }}>
              <EditOutlinedIcon sx={{ fontSize: 40, color: 'rgba(255,90,90,0.2)', mb: 1 }} />
              <Typography sx={{ color: '#9CA3AF' }}>No re-edit requests yet.</Typography>
            </Box>
          ) : reditRequests.map(r => {
            const statusMap = {
              pending:  { color: '#d97706', bg: 'rgba(245,158,11,0.08)',  label: 'Pending' },
              approved: { color: '#059669', bg: 'rgba(16,185,129,0.08)', label: 'Approved' },
              denied:   { color: '#ef4444', bg: 'rgba(239,68,68,0.08)',   label: 'Denied' },
            };
            const s = statusMap[r.status] || statusMap.pending;
            const requestedAt = r.requested_at?.toDate?.()?.toLocaleString('en-GB') || '—';

            return (
              <Card key={r.id} sx={{ mb: 1.5, border: '1px solid rgba(255,139,90,0.12)' }}>
                <CardContent sx={{ p: 2.5, '&:last-child': { pb: 2.5 } }}>
                  <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 2 }}>
                    <Box sx={{ flex: 1, minWidth: 0 }}>
                      <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 0.5 }}>
                        <Typography sx={{ fontWeight: 700, fontSize: 14 }}>{r.company_name}</Typography>
                        <Chip label={s.label} size="small"
                          sx={{ bgcolor: s.bg, color: s.color, fontWeight: 700, fontSize: 10 }} />
                      </Stack>
                      <Typography sx={{ fontSize: 12, color: '#6B7280', mb: 0.5 }}>
                        Quote: <strong>{r.quote_ref}</strong> · {r.product} · {requestedAt}
                      </Typography>
                      <Box sx={{ p: 1.5, borderRadius: '8px', bgcolor: 'rgba(0,0,0,0.03)', border: '1px solid rgba(0,0,0,0.06)', mt: 1 }}>
                        <Typography sx={{ fontSize: 11, fontWeight: 700, color: '#9CA3AF', textTransform: 'uppercase', letterSpacing: 0.5, mb: 0.5 }}>
                          Reason
                        </Typography>
                        <Typography sx={{ fontSize: 13 }}>{r.reason}</Typography>
                      </Box>
                    </Box>
                    {r.status === 'pending' && (
                      <Stack direction="row" spacing={1} sx={{ flexShrink: 0 }}>
                        <Button variant="contained" size="small" startIcon={<CheckIcon />}
                          onClick={() => handleReditDecision(r.id, 'approved')}
                          sx={{ background: 'linear-gradient(135deg,#10B981,#059669)', fontSize: 12 }}>
                          Approve
                        </Button>
                        <Button variant="outlined" size="small" startIcon={<CloseIcon />}
                          onClick={() => handleReditDecision(r.id, 'denied')}
                          sx={{ borderColor: 'rgba(239,68,68,0.3)', color: '#ef4444', fontSize: 12 }}>
                          Deny
                        </Button>
                      </Stack>
                    )}
                    {r.status === 'approved' && (
                      <Typography sx={{ fontSize: 11, color: '#059669', fontWeight: 600, flexShrink: 0 }}>
                        ✓ Approved<br/>
                        <Box component="span" sx={{ fontSize: 10, color: '#9CA3AF', fontWeight: 400 }}>
                          by {r.reviewed_by}
                        </Box>
                      </Typography>
                    )}
                    {r.status === 'denied' && (
                      <Typography sx={{ fontSize: 11, color: '#ef4444', fontWeight: 600, flexShrink: 0 }}>
                        ✗ Denied
                      </Typography>
                    )}
                  </Box>
                </CardContent>
              </Card>
            );
          })}
        </Box>
      )}

      <Snackbar open={toast.open} autoHideDuration={3000} onClose={() => setToast(t => ({ ...t, open: false }))}>
        <Alert severity={toast.severity} variant="filled" sx={{ width: '100%' }}>{toast.msg}</Alert>
      </Snackbar>
    </Box>
  );
};

export default AdminPanel;
