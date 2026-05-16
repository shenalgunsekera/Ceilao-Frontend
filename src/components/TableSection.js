import React, { useEffect, useState, useMemo, useCallback, useRef } from 'react';
import { useLocation } from 'react-router-dom';
import {
  collection, getDocs, deleteDoc, doc, query, orderBy, writeBatch
} from 'firebase/firestore';
import { db } from '../firebase';
import { useAuth } from '../App';
import AddClientForm from './AddClientForm';
import ClientDetailsModal from './ClientDetailsModal';
import Papa from 'papaparse';

import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import IconButton from '@mui/material/IconButton';
import Table from '@mui/material/Table';
import TableBody from '@mui/material/TableBody';
import TableCell from '@mui/material/TableCell';
import TableContainer from '@mui/material/TableContainer';
import TableHead from '@mui/material/TableHead';
import TableRow from '@mui/material/TableRow';
import Paper from '@mui/material/Paper';
import Typography from '@mui/material/Typography';
import Pagination from '@mui/material/Pagination';
import Select from '@mui/material/Select';
import MenuItem from '@mui/material/MenuItem';
import Dialog from '@mui/material/Dialog';
import DialogTitle from '@mui/material/DialogTitle';
import DialogContent from '@mui/material/DialogContent';
import DialogActions from '@mui/material/DialogActions';
import Snackbar from '@mui/material/Snackbar';
import Alert from '@mui/material/Alert';
import Skeleton from '@mui/material/Skeleton';
import Chip from '@mui/material/Chip';
import Tooltip from '@mui/material/Tooltip';
import Stack from '@mui/material/Stack';

import AddCircleOutlineIcon from '@mui/icons-material/AddCircleOutline';
import VisibilityOutlinedIcon from '@mui/icons-material/VisibilityOutlined';
import EditOutlinedIcon from '@mui/icons-material/EditOutlined';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline';
import FileDownloadOutlinedIcon from '@mui/icons-material/FileDownloadOutlined';
import FileUploadOutlinedIcon from '@mui/icons-material/FileUploadOutlined';
import PeopleOutlineIcon from '@mui/icons-material/PeopleOutline';
import DeleteSweepIcon from '@mui/icons-material/DeleteSweep';

/* ── module-level client cache (survives React re-mounts) ─────────────── */
let _cachedClients = null;

/* ── helpers ──────────────────────────────────────────────────────────── */
function daysUntilExpiry(dateStr) {
  if (!dateStr) return null;
  const exp = new Date(dateStr);
  if (isNaN(exp)) return null;
  return Math.ceil((exp - new Date()) / (1000 * 60 * 60 * 24));
}

function expiryStatus(client) {
  const d = daysUntilExpiry(client.policy_period_to);
  if (d === null)  return 'none';
  if (d < 0)       return 'expired';
  if (d <= 30)     return 'expiring';
  return 'active';
}

const statusChip = {
  active:   { label: 'Active',   color: '#059669', bg: 'rgba(16,185,129,0.10)' },
  expiring: { label: 'Expiring', color: '#d97706', bg: 'rgba(245,158,11,0.10)' },
  expired:  { label: 'Expired',  color: '#dc2626', bg: 'rgba(239,68,68,0.10)'  },
  none:     { label: '—',        color: '#9CA3AF', bg: 'transparent'            },
};



/* ── skeleton row ─────────────────────────────────────────────────────── */
function SkeletonRow() {
  return (
    <TableRow>
      {[180, 120, 120, 120, 90, 100].map((w, i) => (
        <TableCell key={i}>
          <Skeleton variant="text" width={w} height={18} sx={{ bgcolor: 'rgba(255,90,90,0.06)' }} />
        </TableCell>
      ))}
    </TableRow>
  );
}

/* ── main component ───────────────────────────────────────────────────── */
const TableSection = () => {
  const { user, userProfile, searchQuery } = useAuth();
  const location = useLocation();
  const prefillHandled = useRef(false);
  const isPrivileged = userProfile?.role === 'manager' || userProfile?.role === 'admin';
  const isManager = isPrivileged;
  const uid = user?.uid || '';

  const [clients,      setClients]      = useState([]);
  const [loading,      setLoading]      = useState(true);
  const [addOpen,      setAddOpen]      = useState(false);
  const [prefillData,  setPrefillData]  = useState({});
  const [detailClient, setDetailClient] = useState(null);
  const [editClient,   setEditClient]   = useState(null);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [deleteAllDlg, setDeleteAllDlg] = useState(false);
  const [csvErrors,    setCsvErrors]    = useState([]);
  const [csvErrDlg,    setCsvErrDlg]    = useState(false);
  const [csvImporting, setCsvImporting] = useState(false);
  const [snackbar,     setSnackbar]     = useState({ open: false, msg: '', sev: 'success' });
  const [page,         setPage]         = useState(1);
  const [rowsPerPage,  setRowsPerPage]  = useState(15);
  const [filterType,   setFilterType]   = useState('all');

  const toast = (msg, sev = 'success') => setSnackbar({ open: true, msg, sev });

  /* fetch — serves from module cache instantly, then refreshes from Firestore */
  const fetchClients = useCallback(async (force = false) => {
    if (!force && _cachedClients) {
      setClients(_cachedClients);
      setLoading(false);
    } else {
      setLoading(true);
    }
    try {
      const q = query(collection(db, 'clients'), orderBy('created_at', 'desc'));
      const snap = await getDocs(q);
      const all = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      // Employees only see approved clients + their own pending/rejected
      const data = isPrivileged
        ? all
        : all.filter(c =>
            !c.status || c.status === 'approved' ||
            ((c.status === 'pending' || c.status === 'rejected') && c.submitted_by === uid)
          );
      _cachedClients = data;
      setClients(data);
    } catch (err) {
      if (!_cachedClients) toast('Failed to load clients', 'error');
    }
    setLoading(false);
  }, [isPrivileged, uid]);

  useEffect(() => { fetchClients(); }, [fetchClients]);

  // Auto-open Add/Edit Client form with pre-filled data from Quote comparison
  useEffect(() => {
    if (prefillHandled.current) return;
    const params = new URLSearchParams(location.search);
    const raw = params.get('prefill');
    if (!raw) return;
    try {
      const data = JSON.parse(decodeURIComponent(raw));
      prefillHandled.current = true;
      window.history.replaceState({}, '', window.location.pathname);

      const quoteId  = data._quote_id;
      const { _quote_id: _removed, ...cleanData } = data; // eslint-disable-line no-unused-vars

      if (quoteId) {
        // If a client was already saved from this quote, open it in edit mode
        const existing = _cachedClients?.find(c => c.source_quote_id === quoteId);
        if (existing) {
          setEditClient({ ...existing, ...cleanData });
        } else {
          setPrefillData({ ...cleanData, source_quote_id: quoteId });
          setAddOpen(true);
        }
      } else {
        setPrefillData(cleanData);
        setAddOpen(true);
      }
    } catch { /* ignore malformed param */ }
  }, [location.search]);

  /* stats */
  /* filter + search */
  const filtered = useMemo(() => {
    let list = clients;
    if (filterType !== 'all') list = list.filter(c => c.customer_type === filterType);
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      list = list.filter(c =>
        (c.client_name  || '').toLowerCase().includes(q) ||
        (c.mobile_no    || '').toLowerCase().includes(q) ||
        (c.policy_no    || '').toLowerCase().includes(q) ||
        (c.product      || '').toLowerCase().includes(q) ||
        (c.email        || '').toLowerCase().includes(q)
      );
    }
    return list;
  }, [clients, filterType, searchQuery]);

  /* paginate */
  const pageCount    = Math.ceil(filtered.length / rowsPerPage);
  const paginated    = filtered.slice((page - 1) * rowsPerPage, page * rowsPerPage);
  const handlePageChange = (_, v) => { setPage(v); window.scrollTo({ top: 0, behavior: 'smooth' }); };

  /* delete single */
  const handleDelete = async () => {
    if (!deleteTarget) return;
    try {
      await deleteDoc(doc(db, 'clients', deleteTarget.id));
      toast('Client deleted');
      _cachedClients = null; fetchClients(true);
    } catch {
      toast('Failed to delete client', 'error');
    }
    setDeleteTarget(null);
  };

  /* delete all */
  const handleDeleteAll = async () => {
    try {
      const snap  = await getDocs(collection(db, 'clients'));
      const batch = writeBatch(db);
      snap.docs.forEach(d => batch.delete(d.ref));
      await batch.commit();
      toast(`Deleted ${snap.size} clients`);
      _cachedClients = null; fetchClients(true);
    } catch {
      toast('Failed to delete all clients', 'error');
    }
    setDeleteAllDlg(false);
  };

  /* CSV template */
  const handleDownloadTemplate = () => {
    const allFields = [
      'customer_type','product','insurance_provider','client_name','mobile_no',
      'ceilao_ib_file_no','vehicle_number','main_class','insurer','introducer_code',
      'branch','street1','street2','city','district','province','telephone',
      'contact_person','email','social_media','nic_proof','dob_proof',
      'business_registration','svat_proof','vat_proof','policy_type','policy_no',
      'policy_period_from','policy_period_to','coverage','sum_insured',
      'basic_premium','srcc_premium','tc_premium','net_premium','stamp_duty',
      'admin_fees','road_safety_fee','policy_fee','vat_fee','total_invoice',
      'commission_type','commission_basic','commission_srcc','commission_tc','sales_rep_id',
    ];
    const example = {
      customer_type:'Individual', product:'Comprehensive', insurance_provider:'Ceylinco',
      client_name:'John Doe', mobile_no:'0771234567', policy_no:'POL123456',
      policy_period_from:'2025-01-01', policy_period_to:'2026-01-01',
      net_premium:'58000', total_invoice:'64600',
    };
    const csv = Papa.unparse([allFields, allFields.map(h => example[h] ?? '')]);
    const a = Object.assign(document.createElement('a'), {
      href: URL.createObjectURL(new Blob([csv], { type: 'text/csv' })),
      download: 'ceilao_client_template.csv',
    });
    a.click(); URL.revokeObjectURL(a.href);
  };

  /* CSV import */
  const handleImportCSV = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    setCsvImporting(true);
    Papa.parse(file, {
      header: true, skipEmptyLines: true,
      complete: async (results) => {
        const required = ['customer_type','product','insurance_provider','client_name','mobile_no'];
        const missing = required.filter(f => !results.meta.fields?.includes(f));
        if (missing.length) {
          toast(`Missing CSV columns: ${missing.join(', ')}`, 'error');
          setCsvImporting(false); return;
        }
        let imported = 0, errors = [];
        const batch = writeBatch(db);
        for (let i = 0; i < results.data.length; i++) {
          const row = results.data[i];
          const miss = required.filter(f => !row[f]);
          if (miss.length) { errors.push({ row: i + 2, error: `Missing: ${miss.join(', ')}` }); continue; }
          const ref = doc(collection(db, 'clients'));
          const clean = {};
          Object.entries(row).forEach(([k, v]) => { if (v !== '' && v != null) clean[k] = v; });
          batch.set(ref, { ...clean, created_at: new Date(), is_active: true });
          imported++;
        }
        try {
          await batch.commit();
          if (errors.length) { setCsvErrors(errors); setCsvErrDlg(true); toast(`Imported ${imported}, ${errors.length} failed`, 'warning'); }
          else toast(`Successfully imported ${imported} clients!`);
          _cachedClients = null; fetchClients(true);
        } catch { toast('Import failed', 'error'); }
        e.target.value = ''; setCsvImporting(false);
      },
    });
  };

  /* add / edit callbacks */
  const handleAddClient  = () => { _cachedClients = null; fetchClients(true); setAddOpen(false);    toast('Client added successfully!'); };
  const handleEditClient = () => { _cachedClients = null; fetchClients(true); setEditClient(null);  toast('Client updated successfully!'); };

  return (
    <Box className="page-enter">

      {/* ── toolbar ───────────────────────────────────────────── */}
      <Box sx={{
        display: 'flex', flexWrap: 'wrap', gap: 1.5, mb: 2,
        alignItems: 'center', justifyContent: 'space-between',
      }}>
        {/* filter chips */}
        <Stack direction="row" spacing={1} flexWrap="wrap">
          {['all','Individual','Company'].map(t => (
            <Chip
              key={t}
              label={t === 'all' ? 'All' : t}
              clickable
              onClick={() => { setFilterType(t); setPage(1); }}
              sx={{
                fontWeight: 600, fontSize: 12,
                background: filterType === t
                  ? 'linear-gradient(135deg,#FF5A5A,#FF8B5A)'
                  : 'rgba(255,90,90,0.07)',
                color: filterType === t ? '#fff' : '#FF5A5A',
                border: filterType === t ? 'none' : '1px solid rgba(255,90,90,0.20)',
                transition: 'all 0.2s ease',
                '&:hover': { opacity: 0.88 },
              }}
            />
          ))}
        </Stack>

        {/* action buttons */}
        <Stack direction="row" spacing={1} flexWrap="wrap" justifyContent="flex-end">
          <Button
            size="small" variant="outlined"
            startIcon={<FileDownloadOutlinedIcon />}
            onClick={handleDownloadTemplate}
            sx={{ borderColor: 'rgba(255,139,90,0.35)', color: '#FF8B5A', fontSize: 12,
                  '&:hover': { borderColor: '#FF8B5A', bgcolor: 'rgba(255,139,90,0.07)' } }}
          >
            CSV Template
          </Button>
          <Button
            size="small" variant="outlined"
            startIcon={<FileUploadOutlinedIcon />}
            onClick={() => document.getElementById('csv-input').click()}
            disabled={csvImporting}
            sx={{ borderColor: 'rgba(255,139,90,0.35)', color: '#FF8B5A', fontSize: 12,
                  '&:hover': { borderColor: '#FF8B5A', bgcolor: 'rgba(255,139,90,0.07)' } }}
          >
            {csvImporting ? 'Importing…' : 'Import CSV'}
          </Button>
          <Button
            size="small" variant="contained"
            startIcon={<AddCircleOutlineIcon />}
            onClick={() => setAddOpen(true)}
            sx={{ fontSize: 12 }}
          >
            Add Client
          </Button>
          {isManager && (
            <Tooltip title="Delete all clients">
              <Button
                size="small" variant="outlined"
                startIcon={<DeleteSweepIcon />}
                onClick={() => setDeleteAllDlg(true)}
                sx={{ borderColor: 'rgba(239,68,68,0.35)', color: '#ef4444', fontSize: 12,
                      '&:hover': { borderColor: '#ef4444', bgcolor: 'rgba(239,68,68,0.06)' } }}
              >
                Delete All
              </Button>
            </Tooltip>
          )}
        </Stack>
      </Box>

      {/* ── table ────────────────────────────────────────────── */}
      <Paper elevation={1} sx={{ overflow: 'hidden', borderRadius: '14px', border: '1px solid rgba(255,139,90,0.10)' }}>
        <TableContainer>
          <Table sx={{ minWidth: 680 }}>
            <TableHead>
              <TableRow>
                <TableCell>Client Name</TableCell>
                <TableCell>Contact</TableCell>
                <TableCell>Product</TableCell>
                <TableCell>Policy #</TableCell>
                <TableCell>Status</TableCell>
                <TableCell align="right">Actions</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {loading
                ? Array.from({ length: 8 }).map((_, i) => <SkeletonRow key={i} />)
                : paginated.length === 0
                  ? (
                    <TableRow>
                      <TableCell colSpan={6} align="center" sx={{ py: 6 }}>
                        <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 1 }}>
                          <PeopleOutlineIcon sx={{ fontSize: 42, color: 'rgba(255,90,90,0.25)' }} />
                          <Typography sx={{ color: '#9CA3AF', fontWeight: 500 }}>
                            {searchQuery ? 'No clients match your search' : 'No clients yet — add your first client!'}
                          </Typography>
                        </Box>
                      </TableCell>
                    </TableRow>
                  )
                  : paginated.map((client, idx) => {
                    const status = expiryStatus(client);
                    const sc = statusChip[status];
                    const rowClass =
                      status === 'expiring' ? 'row-expiring-soon' :
                      status === 'expired'  ? 'row-expired' : '';
                    return (
                      <TableRow
                        key={client.id}
                        className={rowClass}
                        sx={{
                          bgcolor: idx % 2 === 0 ? '#fff' : 'rgba(255,248,245,0.7)',
                          animation: `stagger 0.3s ease both`,
                          animationDelay: `${Math.min(idx * 0.04, 0.4)}s`,
                        }}
                      >
                        <TableCell>
                          <Typography sx={{ fontWeight: 600, fontSize: 13, color: '#1A1A2E' }}>
                            {client.client_name}
                          </Typography>
                          {client.email && (
                            <Typography sx={{ fontSize: 11, color: '#9CA3AF' }}>{client.email}</Typography>
                          )}
                          {client.status === 'pending' && (
                            <Chip label="Pending approval" size="small"
                              sx={{ mt: 0.4, bgcolor: 'rgba(245,158,11,0.12)', color: '#d97706', fontWeight: 600, fontSize: 10, height: 18 }} />
                          )}
                          {client.status === 'rejected' && (
                            <Tooltip title={client.rejection_reason || 'Rejected'}>
                              <Chip label="Rejected" size="small"
                                sx={{ mt: 0.4, bgcolor: 'rgba(239,68,68,0.10)', color: '#dc2626', fontWeight: 600, fontSize: 10, height: 18, cursor: 'help' }} />
                            </Tooltip>
                          )}
                        </TableCell>
                        <TableCell sx={{ fontSize: 13 }}>{client.mobile_no}</TableCell>
                        <TableCell>
                          <Chip
                            label={client.product || '—'}
                            size="small"
                            sx={{ fontSize: 11, fontWeight: 600,
                                  bgcolor: 'rgba(255,139,90,0.10)', color: '#c05010' }}
                          />
                        </TableCell>
                        <TableCell sx={{ fontSize: 13, fontFamily: 'monospace', letterSpacing: 0.3 }}>
                          {client.policy_no || '—'}
                        </TableCell>
                        <TableCell>
                          {status !== 'none' && (
                            <Box sx={{
                              display: 'inline-flex', alignItems: 'center',
                              px: 1.2, py: 0.3, borderRadius: '20px',
                              background: sc.bg, fontSize: 11, fontWeight: 700, color: sc.color,
                            }}>
                              {sc.label}
                            </Box>
                          )}
                        </TableCell>
                        <TableCell align="right">
                          <Stack direction="row" spacing={0.5} justifyContent="flex-end">
                            <Tooltip title="View details">
                              <IconButton size="small" onClick={() => setDetailClient(client)}
                                sx={{ color: '#4f46e5', '&:hover': { bgcolor: 'rgba(99,102,241,0.10)' } }}>
                                <VisibilityOutlinedIcon fontSize="small" />
                              </IconButton>
                            </Tooltip>
                            {isManager && (
                              <>
                                <Tooltip title="Edit">
                                  <IconButton size="small" onClick={() => setEditClient(client)}
                                    sx={{ color: '#FF8B5A', '&:hover': { bgcolor: 'rgba(255,139,90,0.10)' } }}>
                                    <EditOutlinedIcon fontSize="small" />
                                  </IconButton>
                                </Tooltip>
                                <Tooltip title="Delete">
                                  <IconButton size="small" onClick={() => setDeleteTarget(client)}
                                    sx={{ color: '#ef4444', '&:hover': { bgcolor: 'rgba(239,68,68,0.10)' } }}>
                                    <DeleteOutlineIcon fontSize="small" />
                                  </IconButton>
                                </Tooltip>
                              </>
                            )}
                          </Stack>
                        </TableCell>
                      </TableRow>
                    );
                  })
              }
            </TableBody>
          </Table>
        </TableContainer>

        {/* pagination bar */}
        {!loading && filtered.length > 0 && (
          <Box sx={{
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            px: 2.5, py: 1.5, flexWrap: 'wrap', gap: 1,
            borderTop: '1px solid rgba(255,139,90,0.08)',
          }}>
            <Typography sx={{ fontSize: 12.5, color: '#9CA3AF' }}>
              Showing {(page - 1) * rowsPerPage + 1}–{Math.min(page * rowsPerPage, filtered.length)} of {filtered.length} clients
            </Typography>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <Typography sx={{ fontSize: 12.5, color: '#9CA3AF' }}>Rows:</Typography>
              <Select
                size="small" value={rowsPerPage}
                onChange={e => { setRowsPerPage(Number(e.target.value)); setPage(1); }}
                sx={{ fontSize: 12, '& .MuiOutlinedInput-root': { borderRadius: '8px' }, minWidth: 65 }}
              >
                {[10, 15, 25, 50, 100].map(n => <MenuItem key={n} value={n}>{n}</MenuItem>)}
              </Select>
            </Box>
            <Pagination
              count={pageCount} page={page}
              onChange={handlePageChange}
              shape="rounded" size="small"
            />
          </Box>
        )}
      </Paper>

      {/* ── dialogs ──────────────────────────────────────────── */}
      <Dialog open={addOpen} onClose={() => setAddOpen(false)} maxWidth="md" fullWidth
        PaperProps={{ sx: { maxHeight: '92vh' } }}>
        <DialogTitle>
          {Object.keys(prefillData).length > 0 ? 'New Client — Pre-filled from Quote' : 'Add New Client'}
        </DialogTitle>
        <DialogContent sx={{ p: 0 }}>
          <AddClientForm
            onSuccess={() => { handleAddClient(); setPrefillData({}); }}
            onCancel={() => { setAddOpen(false); setPrefillData({}); }}
            initialData={prefillData}
          />
        </DialogContent>
      </Dialog>

      <Dialog open={!!editClient} onClose={() => setEditClient(null)} maxWidth="md" fullWidth
        PaperProps={{ sx: { maxHeight: '92vh' } }}>
        <DialogTitle>Edit Client</DialogTitle>
        <DialogContent sx={{ p: 0 }}>
          {editClient && (
            <AddClientForm
              initialData={editClient}
              isEdit
              onSuccess={handleEditClient}
              onCancel={() => setEditClient(null)}
            />
          )}
        </DialogContent>
      </Dialog>

      {/* delete single confirm */}
      <Dialog open={!!deleteTarget} onClose={() => setDeleteTarget(null)} maxWidth="xs" fullWidth>
        <DialogTitle>Delete Client</DialogTitle>
        <DialogContent sx={{ pt: '12px !important' }}>
          <Typography>
            Are you sure you want to delete <strong>{deleteTarget?.client_name}</strong>? This cannot be undone.
          </Typography>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2, gap: 1 }}>
          <Button onClick={() => setDeleteTarget(null)} variant="outlined" sx={{ color: '#6B7280', borderColor: '#e0e0e0' }}>
            Cancel
          </Button>
          <Button onClick={handleDelete} variant="contained"
            sx={{ background: 'linear-gradient(135deg,#FF5A5A,#e04040)', boxShadow: 'none',
                  '&:hover': { background: 'linear-gradient(135deg,#e04040,#c03030)' } }}>
            Delete
          </Button>
        </DialogActions>
      </Dialog>

      {/* delete all confirm */}
      <Dialog open={deleteAllDlg} onClose={() => setDeleteAllDlg(false)} maxWidth="xs" fullWidth>
        <DialogTitle>Delete All Clients</DialogTitle>
        <DialogContent sx={{ pt: '12px !important' }}>
          <Alert severity="error" sx={{ mb: 1.5 }}>This will permanently delete ALL {clients.length} clients.</Alert>
          <Typography>This action cannot be undone. Are you absolutely sure?</Typography>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2, gap: 1 }}>
          <Button onClick={() => setDeleteAllDlg(false)} variant="outlined" sx={{ color: '#6B7280', borderColor: '#e0e0e0' }}>
            Cancel
          </Button>
          <Button onClick={handleDeleteAll} variant="contained"
            sx={{ background: 'linear-gradient(135deg,#FF5A5A,#e04040)', boxShadow: 'none' }}>
            Delete All
          </Button>
        </DialogActions>
      </Dialog>

      {/* CSV errors */}
      <Dialog open={csvErrDlg} onClose={() => setCsvErrDlg(false)} maxWidth="sm" fullWidth>
        <DialogTitle>CSV Import Errors</DialogTitle>
        <DialogContent>
          <Typography sx={{ mb: 1.5, color: '#9CA3AF', fontSize: 13 }}>
            {csvErrors.length} rows failed to import:
          </Typography>
          <Box sx={{ maxHeight: 320, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 1 }}>
            {csvErrors.map((e, i) => (
              <Box key={i} sx={{ p: 1.5, bgcolor: 'rgba(239,68,68,0.06)', borderRadius: '10px',
                                  border: '1px solid rgba(239,68,68,0.15)' }}>
                <Typography sx={{ fontWeight: 700, color: '#dc2626', fontSize: 12 }}>Row {e.row}</Typography>
                <Typography sx={{ color: '#6B7280', fontSize: 12 }}>{e.error}</Typography>
              </Box>
            ))}
          </Box>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={() => setCsvErrDlg(false)} variant="contained" size="small">Close</Button>
        </DialogActions>
      </Dialog>

      <ClientDetailsModal client={detailClient} onClose={() => setDetailClient(null)} />

      <input type="file" accept=".csv" id="csv-input" style={{ display: 'none' }} onChange={handleImportCSV} />

      <Snackbar
        open={snackbar.open}
        autoHideDuration={4000}
        onClose={() => setSnackbar(s => ({ ...s, open: false }))}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
      >
        <Alert
          severity={snackbar.sev}
          variant="filled"
          onClose={() => setSnackbar(s => ({ ...s, open: false }))}
          sx={{ borderRadius: '12px', fontWeight: 500 }}
        >
          {snackbar.msg}
        </Alert>
      </Snackbar>
    </Box>
  );
};

export default TableSection;
