import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { collection, getDocs, query, orderBy, doc, setDoc, deleteDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../firebase';
import { saveAs } from 'file-saver';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import {
  BarChart, Bar, PieChart, Pie, Cell, LineChart, Line,
  XAxis, YAxis, CartesianGrid, Tooltip as RTooltip, Legend, ResponsiveContainer
} from 'recharts';

import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import Button from '@mui/material/Button';
import Card from '@mui/material/Card';
import CardContent from '@mui/material/CardContent';
import Stack from '@mui/material/Stack';
import Chip from '@mui/material/Chip';
import Tabs from '@mui/material/Tabs';
import Tab from '@mui/material/Tab';
import TextField from '@mui/material/TextField';
import MenuItem from '@mui/material/MenuItem';
import Select from '@mui/material/Select';
import FormControl from '@mui/material/FormControl';
import InputLabel from '@mui/material/InputLabel';
import Checkbox from '@mui/material/Checkbox';
import FormControlLabel from '@mui/material/FormControlLabel';
import Table from '@mui/material/Table';
import TableBody from '@mui/material/TableBody';
import TableCell from '@mui/material/TableCell';
import TableContainer from '@mui/material/TableContainer';
import TableHead from '@mui/material/TableHead';
import TableRow from '@mui/material/TableRow';
import Pagination from '@mui/material/Pagination';
import Dialog from '@mui/material/Dialog';
import DialogTitle from '@mui/material/DialogTitle';
import DialogContent from '@mui/material/DialogContent';
import DialogActions from '@mui/material/DialogActions';
import Snackbar from '@mui/material/Snackbar';
import Alert from '@mui/material/Alert';
import Skeleton from '@mui/material/Skeleton';
import IconButton from '@mui/material/IconButton';
import Tooltip from '@mui/material/Tooltip';
import { LocalizationProvider } from '@mui/x-date-pickers';
import { AdapterDateFns } from '@mui/x-date-pickers/AdapterDateFns';

import BarChartIcon from '@mui/icons-material/BarChart';
import PieChartOutlineIcon from '@mui/icons-material/PieChartOutline';
import ShowChartIcon from '@mui/icons-material/ShowChart';
import FileDownloadOutlinedIcon from '@mui/icons-material/FileDownloadOutlined';
import SaveOutlinedIcon from '@mui/icons-material/SaveOutlined';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline';
import RefreshIcon from '@mui/icons-material/Refresh';
import PlayArrowIcon from '@mui/icons-material/PlayArrow';
import BookmarkOutlinedIcon from '@mui/icons-material/BookmarkOutlined';
import BookmarkIcon from '@mui/icons-material/Bookmark';
import AddIcon from '@mui/icons-material/Add';
import TuneIcon from '@mui/icons-material/Tune';
import PictureAsPdfOutlinedIcon from '@mui/icons-material/PictureAsPdfOutlined';
import TableChartOutlinedIcon from '@mui/icons-material/TableChartOutlined';

/* ── Palette ─────────────────────────────────────────────────────────────── */
const CHART_COLORS = ['#FF5A5A','#6366f1','#10B981','#f59e0b','#0ea5e9','#8b5cf6','#ec4899','#14b8a6'];

/* ── All available fields from clients collection ────────────────────────── */
const CLIENT_FIELDS = [
  { key: 'client_name',        label: 'Client Name',        type: 'string'  },
  { key: 'customer_type',      label: 'Customer Type',      type: 'string'  },
  { key: 'product',            label: 'Product',            type: 'string'  },
  { key: 'main_class',         label: 'Main Class',         type: 'string'  },
  { key: 'insurance_provider', label: 'Insurance Provider', type: 'string'  },
  { key: 'insurer',            label: 'Insurer',            type: 'string'  },
  { key: 'branch',             label: 'Branch',             type: 'string'  },
  { key: 'policy_no',          label: 'Policy No',          type: 'string'  },
  { key: 'policy_type',        label: 'Policy Type',        type: 'string'  },
  { key: 'policy_period_from', label: 'Policy From',        type: 'date'    },
  { key: 'policy_period_to',   label: 'Policy Expiry',      type: 'date'    },
  { key: 'ceilao_ib_file_no',  label: 'File No',            type: 'string'  },
  { key: 'mobile_no',          label: 'Mobile',             type: 'string'  },
  { key: 'email',              label: 'Email',              type: 'string'  },
  { key: 'sales_rep_id',       label: 'Sales Rep',          type: 'string'  },
  { key: 'sum_insured',        label: 'Sum Insured',        type: 'number'  },
  { key: 'basic_premium',      label: 'Basic Premium',      type: 'number'  },
  { key: 'srcc_premium',       label: 'SRCC Premium',       type: 'number'  },
  { key: 'tc_premium',         label: 'TC Premium',         type: 'number'  },
  { key: 'net_premium',        label: 'Net Premium',        type: 'number'  },
  { key: 'total_invoice',      label: 'Total Invoice',      type: 'number'  },
  { key: 'commission_basic',   label: 'Commission Basic',   type: 'number'  },
  { key: 'commission_srcc',    label: 'Commission SRCC',    type: 'number'  },
  { key: 'commission_tc',      label: 'Commission TC',      type: 'number'  },
  { key: 'stamp_duty',         label: 'Stamp Duty',         type: 'number'  },
  { key: 'admin_fees',         label: 'Admin Fees',         type: 'number'  },
  { key: 'vat_fee',            label: 'VAT',                type: 'number'  },
  { key: 'status',             label: 'Status',             type: 'string'  },
];

const CLAIM_FIELDS = [
  { key: 'client_name',      label: 'Client Name',    type: 'string' },
  { key: 'claim_no',         label: 'Claim No',       type: 'string' },
  { key: 'insurer',          label: 'Insurer',        type: 'string' },
  { key: 'status',           label: 'Status',         type: 'string' },
  { key: 'claim_amount',     label: 'Claim Amount',   type: 'number' },
  { key: 'settled_amount',   label: 'Settled Amount', type: 'number' },
  { key: 'product',          label: 'Product',        type: 'string' },
  { key: 'main_class',       label: 'Main Class',     type: 'string' },
];

const NUMBER_OPS  = ['sum','avg','min','max','count'];

const FILTER_OPS  = {
  string: ['equals','contains','starts with','not equals'],
  number: ['=','>','<','>=','<='],
  date:   ['after','before','between'],
};

/* ── Built-in templates ──────────────────────────────────────────────────── */
const BUILTIN_TEMPLATES = [
  {
    id: 'premium_summary',
    name: 'Premium Summary',
    description: 'Total premiums by insurer and product',
    icon: '💰',
    source: 'clients',
    fields: ['insurance_provider','product','net_premium','total_invoice'],
    groupBy: 'insurance_provider',
    aggregations: [{ field: 'net_premium', op: 'sum' }, { field: 'total_invoice', op: 'sum' }, { field: 'client_name', op: 'count' }],
    filters: [],
    sortBy: 'total_invoice_sum',
    sortDir: 'desc',
    chartType: 'bar',
    chartField: 'total_invoice_sum',
  },
  {
    id: 'expiry_report',
    name: 'Policy Expiry Report',
    description: 'Policies expiring in the next 90 days',
    icon: '📅',
    source: 'clients',
    fields: ['client_name','policy_no','policy_period_to','insurance_provider','product','mobile_no','net_premium'],
    groupBy: '',
    aggregations: [],
    filters: [{ field: 'policy_period_to', op: 'between', value: '__next90__' }],
    sortBy: 'policy_period_to',
    sortDir: 'asc',
    chartType: 'bar',
    chartField: '',
  },
  {
    id: 'commission_report',
    name: 'Commission Report',
    description: 'Commission earned by type and insurer',
    icon: '📊',
    source: 'clients',
    fields: ['insurance_provider','commission_basic','commission_srcc','commission_tc'],
    groupBy: 'insurance_provider',
    aggregations: [{ field: 'commission_basic', op: 'sum' }, { field: 'commission_srcc', op: 'sum' }, { field: 'commission_tc', op: 'sum' }],
    filters: [],
    sortBy: 'commission_basic_sum',
    sortDir: 'desc',
    chartType: 'bar',
    chartField: 'commission_basic_sum',
  },
  {
    id: 'claims_summary',
    name: 'Claims Summary',
    description: 'Claims by status and insurer',
    icon: '🛡️',
    source: 'claims',
    fields: ['insurer','status','claim_amount','settled_amount','client_name'],
    groupBy: 'status',
    aggregations: [{ field: 'claim_amount', op: 'sum' }, { field: 'settled_amount', op: 'sum' }, { field: 'client_name', op: 'count' }],
    filters: [],
    sortBy: 'client_name_count',
    sortDir: 'desc',
    chartType: 'pie',
    chartField: 'client_name_count',
  },
];

/* ── Helpers ─────────────────────────────────────────────────────────────── */
function fmtNum(v) {
  if (v === null || v === undefined || v === '') return '—';
  const n = Number(v);
  return isNaN(n) ? v : n.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 2 });
}

function parseNum(v) { const n = parseFloat(String(v || '').replace(/,/g, '')); return isNaN(n) ? 0 : n; }

function fmtDate(v) {
  if (!v) return '—';
  if (v?.toDate) return v.toDate().toLocaleDateString('en-GB');
  const d = new Date(v);
  return isNaN(d) ? v : d.toLocaleDateString('en-GB');
}

function applyFilters(rows, filters) {
  return rows.filter(row => {
    for (const f of filters) {
      const rawVal = row[f.field];
      if (f.value === '__next90__') {
        const now = new Date(); now.setHours(0,0,0,0);
        const end = new Date(now); end.setDate(end.getDate() + 90);
        const d = rawVal?.toDate ? rawVal.toDate() : new Date(rawVal);
        if (isNaN(d) || d < now || d > end) return false;
        continue;
      }
      const field = [...CLIENT_FIELDS, ...CLAIM_FIELDS].find(f2 => f2.key === f.field);
      if (!field) continue;
      if (field.type === 'string') {
        const val = (rawVal || '').toLowerCase();
        const cmp = (f.value || '').toLowerCase();
        if (f.op === 'equals'     && val !== cmp) return false;
        if (f.op === 'not equals' && val === cmp) return false;
        if (f.op === 'contains'   && !val.includes(cmp)) return false;
        if (f.op === 'starts with'&& !val.startsWith(cmp)) return false;
      } else if (field.type === 'number') {
        const a = parseNum(rawVal); const b = parseNum(f.value);
        if (f.op === '='  && a !== b) return false;
        if (f.op === '>'  && a <= b)  return false;
        if (f.op === '<'  && a >= b)  return false;
        if (f.op === '>=' && a < b)   return false;
        if (f.op === '<=' && a > b)   return false;
      } else if (field.type === 'date') {
        const d = rawVal?.toDate ? rawVal.toDate() : new Date(rawVal);
        if (isNaN(d)) return false;
        if (f.op === 'after'  && f.value && d <= new Date(f.value)) return false;
        if (f.op === 'before' && f.value && d >= new Date(f.value)) return false;
      }
    }
    return true;
  });
}

function aggregate(rows, groupBy, aggregations) {
  if (!groupBy || !aggregations.length) return rows;
  const groups = {};
  for (const row of rows) {
    const key = groupBy ? (row[groupBy] || '(None)') : '__all__';
    if (!groups[key]) groups[key] = { [groupBy]: key, _rows: [] };
    groups[key]._rows.push(row);
  }
  return Object.values(groups).map(g => {
    const result = { [groupBy]: g[groupBy] };
    for (const agg of aggregations) {
      const vals = g._rows.map(r => parseNum(r[agg.field]));
      const key2 = `${agg.field}_${agg.op}`;
      if (agg.op === 'sum')   result[key2] = vals.reduce((a, b) => a + b, 0);
      if (agg.op === 'avg')   result[key2] = vals.length ? vals.reduce((a,b)=>a+b,0)/vals.length : 0;
      if (agg.op === 'min')   result[key2] = Math.min(...vals);
      if (agg.op === 'max')   result[key2] = Math.max(...vals);
      if (agg.op === 'count') result[key2] = g._rows.length;
    }
    return result;
  });
}

function sortRows(rows, sortBy, sortDir) {
  if (!sortBy) return rows;
  return [...rows].sort((a, b) => {
    const av = parseNum(a[sortBy]) || 0; const bv = parseNum(b[sortBy]) || 0;
    if (av !== bv) return sortDir === 'asc' ? av - bv : bv - av;
    const as = String(a[sortBy] || ''); const bs = String(b[sortBy] || '');
    return sortDir === 'asc' ? as.localeCompare(bs) : bs.localeCompare(as);
  });
}

/* ── PDF export ──────────────────────────────────────────────────────────── */
async function exportPDF(columns, rows, reportName) {
  const pdf = new jsPDF({ orientation: columns.length > 6 ? 'landscape' : 'portrait', unit: 'mm' });
  const pageW = pdf.internal.pageSize.getWidth();

  // Header bar
  pdf.setFillColor(255, 90, 90);
  pdf.rect(0, 0, pageW, 22, 'F');
  pdf.setTextColor(255,255,255);
  pdf.setFontSize(14); pdf.setFont('helvetica','bold');
  pdf.text('Ceilao Insurance Brokers', pageW / 2, 10, { align: 'center' });
  pdf.setFontSize(9); pdf.setFont('helvetica','normal');
  pdf.text(reportName, pageW / 2, 16, { align: 'center' });

  // Date
  pdf.setTextColor(100,100,100); pdf.setFontSize(8);
  pdf.text(`Generated: ${new Date().toLocaleDateString('en-GB', { day:'numeric', month:'long', year:'numeric' })}`, pageW - 10, 28, { align: 'right' });

  autoTable(pdf, {
    startY: 32,
    head: [columns.map(c => c.label)],
    body: rows.map(r => columns.map(c => {
      const v = r[c.key];
      if (v === null || v === undefined) return '—';
      if (c.type === 'date') return fmtDate(v);
      if (c.type === 'number') return fmtNum(v);
      return String(v);
    })),
    headStyles: { fillColor: [26,26,46], textColor: 255, fontStyle: 'bold', fontSize: 9 },
    alternateRowStyles: { fillColor: [255,248,245] },
    styles: { fontSize: 8, cellPadding: 2.5 },
    didDrawPage: (data) => {
      pdf.setFontSize(7); pdf.setTextColor(150,150,150);
      pdf.text(`Page ${pdf.getNumberOfPages()}`, pageW/2, pdf.internal.pageSize.getHeight()-5, { align:'center' });
    },
  });

  pdf.save(`${reportName.replace(/\s+/g,'_')}_${new Date().toISOString().slice(0,10)}.pdf`);
}

/* ── CSV export ──────────────────────────────────────────────────────────── */
function exportCSV(columns, rows, reportName) {
  const header = columns.map(c => `"${c.label}"`).join(',');
  const body = rows.map(r => columns.map(c => {
    const v = r[c.key];
    if (v === null || v === undefined) return '';
    if (c.type === 'date') return fmtDate(v);
    if (c.type === 'number') return parseNum(v);
    return `"${String(v).replace(/"/g,'""')}"`;
  }).join(','));
  const blob = new Blob([[header,...body].join('\r\n')], { type: 'text/csv' });
  saveAs(blob, `${reportName.replace(/\s+/g,'_')}_${new Date().toISOString().slice(0,10)}.csv`);
}

/* ════════════════════════════════════════════════════════════════════════════
   MAIN COMPONENT
   ════════════════════════════════════════════════════════════════════════════ */
const ReportsPage = () => {
  const [tab, setTab] = useState(0); // 0=builder 1=saved

  // Data
  const [clients,    setClients]    = useState([]);
  const [claims,     setClaims]     = useState([]);
  const [dataLoaded, setDataLoaded] = useState(false);
  const [loading,    setLoading]    = useState(false);

  // Saved templates in Firestore
  const [savedTemplates, setSavedTemplates] = useState([]);

  // Builder state
  const [source,       setSource]       = useState('clients');
  const [selFields,    setSelFields]    = useState(['client_name','insurance_provider','net_premium','total_invoice']);
  const [groupBy,      setGroupBy]      = useState('');
  const [aggregations, setAggregations] = useState([]);
  const [filters,      setFilters]      = useState([]);
  const [sortBy,       setSortBy]       = useState('');
  const [sortDir,      setSortDir]      = useState('desc');
  const [chartType,    setChartType]    = useState('bar');
  const [chartField,   setChartField]   = useState('');

  // Results
  const [results,      setResults]      = useState(null);
  const [rPage,        setRPage]        = useState(1);
  const R_PER_PAGE = 20;

  // Save template dialog
  const [saveOpen,    setSaveOpen]    = useState(false);
  const [saveName,    setSaveName]    = useState('');
  const [saveDesc,    setSaveDesc]    = useState('');
  const [savingTpl,   setSavingTpl]   = useState(false);

  const [toast, setToast] = useState({ open: false, msg: '', severity: 'success' });
  const showToast = (msg, severity = 'success') => setToast({ open: true, msg, severity });

  // Load data once
  const loadData = useCallback(async () => {
    setLoading(true);
    const [cSnap, clSnap] = await Promise.all([
      getDocs(query(collection(db, 'clients'), orderBy('created_at', 'desc'))),
      getDocs(query(collection(db, 'claims'),  orderBy('created_at', 'desc'))),
    ]);
    setClients(cSnap.docs.map(d => ({ id: d.id, ...d.data() })));
    setClaims(clSnap.docs.map(d => ({ id: d.id, ...d.data() })));
    setDataLoaded(true);
    setLoading(false);
  }, []);

  const loadSavedTemplates = useCallback(async () => {
    try {
      const snap = await getDocs(query(collection(db, 'report_templates'), orderBy('created_at', 'desc')));
      setSavedTemplates(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    } catch { /* ignore */ }
  }, []);

  useEffect(() => { loadData(); loadSavedTemplates(); }, [loadData, loadSavedTemplates]);

  const sourceFields = source === 'clients' ? CLIENT_FIELDS : CLAIM_FIELDS;

  // Run report
  const runReport = useCallback(() => {
    const raw = source === 'clients' ? clients : claims;
    const filtered = applyFilters(raw, filters);
    const agged = aggregate(filtered, groupBy, aggregations);
    const sorted = sortRows(agged, sortBy, sortDir);
    setResults(sorted);
    setRPage(1);
  }, [source, clients, claims, filters, groupBy, aggregations, sortBy, sortDir]);

  // Load a template (builtin or saved) into builder
  const loadTemplate = (tpl) => {
    setSource(tpl.source || 'clients');
    setSelFields(tpl.fields || []);
    setGroupBy(tpl.groupBy || '');
    setAggregations(tpl.aggregations || []);
    setFilters(tpl.filters?.filter(f => f.value !== '__next90__') || []);
    setSortBy(tpl.sortBy || '');
    setSortDir(tpl.sortDir || 'desc');
    setChartType(tpl.chartType || 'bar');
    setChartField(tpl.chartField || '');
    setResults(null);
    setTab(0);
    // Auto-run for expiry report since filter is dynamic
    if (tpl.id === 'expiry_report') {
      const raw = clients;
      const now = new Date(); now.setHours(0,0,0,0);
      const end = new Date(now); end.setDate(end.getDate() + 90);
      const filtered = raw.filter(r => {
        const v = r.policy_period_to;
        const d = v?.toDate ? v.toDate() : new Date(v);
        return !isNaN(d) && d >= now && d <= end;
      });
      setResults(sortRows(filtered, 'policy_period_to', 'asc'));
    }
  };

  // Save template
  const handleSaveTemplate = async () => {
    if (!saveName.trim()) return;
    setSavingTpl(true);
    try {
      const tpl = {
        name: saveName.trim(), description: saveDesc.trim(),
        source, fields: selFields, groupBy, aggregations, filters, sortBy, sortDir, chartType, chartField,
        created_at: serverTimestamp(),
      };
      await setDoc(doc(collection(db, 'report_templates')), tpl);
      setSaveOpen(false); setSaveName(''); setSaveDesc('');
      loadSavedTemplates();
      showToast('Template saved!');
    } catch (err) { showToast(err.message, 'error'); }
    setSavingTpl(false);
  };

  const handleDeleteTemplate = async (id) => {
    await deleteDoc(doc(db, 'report_templates', id));
    setSavedTemplates(p => p.filter(t => t.id !== id));
    showToast('Template deleted.', 'info');
  };

  // Compute display columns
  const displayCols = useMemo(() => {
    if (!results) return [];
    if (groupBy && aggregations.length) {
      const groupField = sourceFields.find(f => f.key === groupBy);
      const cols = [{ key: groupBy, label: groupField?.label || groupBy, type: 'string' }];
      for (const agg of aggregations) {
        const f = sourceFields.find(ff => ff.key === agg.field);
        cols.push({ key: `${agg.field}_${agg.op}`, label: `${f?.label || agg.field} (${agg.op})`, type: 'number' });
      }
      return cols;
    }
    return selFields.map(k => sourceFields.find(f => f.key === k)).filter(Boolean);
  }, [results, groupBy, aggregations, selFields, sourceFields]);

  const pagedResults = useMemo(() => {
    if (!results) return [];
    return results.slice((rPage-1)*R_PER_PAGE, rPage*R_PER_PAGE);
  }, [results, rPage]);

  // Chart data
  const chartData = useMemo(() => {
    if (!results || !chartField) return [];
    return results.slice(0, 12).map(r => ({
      name: String(groupBy ? r[groupBy] : r[selFields[0]] || '').slice(0, 20),
      value: parseNum(r[chartField]),
    }));
  }, [results, chartField, groupBy, selFields]);

  // Toggle field selection
  const toggleField = (key) => {
    setSelFields(p => p.includes(key) ? p.filter(k => k !== key) : [...p, key]);
  };

  // Add/remove filter
  const addFilter = () => setFilters(p => [...p, { field: sourceFields[0].key, op: 'equals', value: '' }]);
  const removeFilter = (i) => setFilters(p => p.filter((_,idx) => idx !== i));
  const updateFilter = (i, patch) => setFilters(p => p.map((f,idx) => idx===i ? {...f,...patch} : f));

  // Add/remove aggregation
  const addAgg = () => setAggregations(p => [...p, { field: sourceFields.find(f=>f.type==='number')?.key || '', op: 'sum' }]);
  const removeAgg = (i) => setAggregations(p => p.filter((_,idx) => idx !== i));
  const updateAgg = (i, patch) => setAggregations(p => p.map((a,idx) => idx===i ? {...a,...patch} : a));

  const ChartIcon = chartType === 'pie' ? PieChartOutlineIcon : chartType === 'line' ? ShowChartIcon : BarChartIcon;

  return (
    <LocalizationProvider dateAdapter={AdapterDateFns}>
    <Box className="page-enter" sx={{ maxWidth: 1200, mx: 'auto' }}>

      {/* Header */}
      <Stack direction={{ xs:'column', sm:'row' }} justifyContent="space-between" alignItems={{ sm:'center' }} sx={{ mb: 3 }}>
        <Box>
          <Typography variant="h5" sx={{ fontWeight: 800, mb: 0.3 }}>Reports</Typography>
          <Typography sx={{ fontSize: 13, color: '#9CA3AF' }}>
            Build custom reports, apply filters, visualise with charts and export
          </Typography>
        </Box>
        <Stack direction="row" spacing={1}>
          <Button size="small" variant="outlined" startIcon={<RefreshIcon />} onClick={loadData} disabled={loading}
            sx={{ fontSize: 12, borderColor: 'rgba(255,139,90,0.35)', color: '#FF8B5A' }}>
            {loading ? 'Loading…' : 'Refresh Data'}
          </Button>
          {results && (
            <>
              <Button size="small" variant="outlined" startIcon={<PictureAsPdfOutlinedIcon />}
                onClick={() => exportPDF(displayCols, results, saveName || 'Report')}
                sx={{ fontSize: 12, borderColor: 'rgba(239,68,68,0.35)', color: '#ef4444' }}>
                Export PDF
              </Button>
              <Button size="small" variant="outlined" startIcon={<FileDownloadOutlinedIcon />}
                onClick={() => exportCSV(displayCols, results, saveName || 'Report')}
                sx={{ fontSize: 12, borderColor: 'rgba(16,185,129,0.35)', color: '#059669' }}>
                Export CSV
              </Button>
              <Button size="small" variant="contained" startIcon={<SaveOutlinedIcon />}
                onClick={() => setSaveOpen(true)}
                sx={{ fontSize: 12 }}>
                Save Template
              </Button>
            </>
          )}
        </Stack>
      </Stack>

      {/* ── Built-in templates quick-launch ── */}
      <Typography sx={{ fontSize: 11, fontWeight: 800, color: '#9CA3AF', textTransform: 'uppercase', letterSpacing: 1, mb: 1.5 }}>
        Quick Templates
      </Typography>
      <Stack direction={{ xs:'column', sm:'row' }} spacing={1.5} sx={{ mb: 3 }} flexWrap="wrap">
        {BUILTIN_TEMPLATES.map(tpl => (
          <Card key={tpl.id} onClick={() => loadTemplate(tpl)} sx={{
            flex: 1, minWidth: 180, cursor: 'pointer', border: '1px solid rgba(255,139,90,0.12)',
            transition: 'all 0.18s', '&:hover': { transform: 'translateY(-2px)', boxShadow: '0 6px 20px rgba(255,90,90,0.12)' }
          }}>
            <CardContent sx={{ p: 2, '&:last-child': { pb: 2 } }}>
              <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 0.5 }}>
                <Typography sx={{ fontSize: 20 }}>{tpl.icon}</Typography>
                <Typography sx={{ fontWeight: 700, fontSize: 13 }}>{tpl.name}</Typography>
              </Stack>
              <Typography sx={{ fontSize: 11.5, color: '#9CA3AF' }}>{tpl.description}</Typography>
            </CardContent>
          </Card>
        ))}
      </Stack>

      <Tabs value={tab} onChange={(_,v)=>setTab(v)} sx={{
        mb: 2.5, borderBottom: '1px solid rgba(255,139,90,0.12)',
        '& .MuiTab-root': { fontSize: 13, fontWeight: 600, textTransform: 'none', color: '#9CA3AF' },
        '& .Mui-selected': { color: '#FF5A5A' },
        '& .MuiTabs-indicator': { background: 'linear-gradient(90deg,#FF5A5A,#FF8B5A)', height: 2.5 },
      }}>
        <Tab icon={<TuneIcon sx={{ fontSize: 17 }} />} iconPosition="start" label="Report Builder" />
        <Tab icon={<BookmarkIcon sx={{ fontSize: 17 }} />} iconPosition="start"
          label={`Saved Templates${savedTemplates.length ? ` (${savedTemplates.length})` : ''}`} />
      </Tabs>

      {/* ════════ TAB 0 — Builder ════════ */}
      {tab === 0 && (
        <Stack direction={{ xs:'column', lg:'row' }} spacing={2.5} alignItems="flex-start">

          {/* ── LEFT: Config panel ── */}
          <Box sx={{ width: { xs:'100%', lg: 340 }, flexShrink: 0 }}>
            <Card sx={{ border: '1px solid rgba(255,139,90,0.12)', mb: 2 }}>
              <CardContent sx={{ p: 2.5 }}>

                {/* Source */}
                <Typography sx={{ fontSize: 11, fontWeight: 800, color: '#9CA3AF', textTransform: 'uppercase', letterSpacing: 0.8, mb: 1 }}>
                  Data Source
                </Typography>
                <FormControl fullWidth size="small" sx={{ mb: 2.5 }}>
                  <Select value={source} onChange={e => { setSource(e.target.value); setSelFields([]); setGroupBy(''); setAggregations([]); setFilters([]); setResults(null); }}>
                    <MenuItem value="clients">Underwriting (Clients)</MenuItem>
                    <MenuItem value="claims">Claims</MenuItem>
                  </Select>
                </FormControl>

                {/* Fields */}
                <Typography sx={{ fontSize: 11, fontWeight: 800, color: '#9CA3AF', textTransform: 'uppercase', letterSpacing: 0.8, mb: 1 }}>
                  Fields to Show
                </Typography>
                <Box sx={{ maxHeight: 200, overflowY: 'auto', border: '1px solid rgba(0,0,0,0.08)', borderRadius: '8px', p: 1, mb: 2.5 }}>
                  {sourceFields.map(f => (
                    <FormControlLabel key={f.key} control={
                      <Checkbox size="small" checked={selFields.includes(f.key)} onChange={() => toggleField(f.key)}
                        sx={{ color: '#FF8B5A', '&.Mui-checked': { color: '#FF5A5A' }, p: 0.5 }} />
                    } label={<Typography sx={{ fontSize: 12 }}>{f.label}</Typography>}
                      sx={{ display: 'block', m: 0, py: 0.2 }} />
                  ))}
                </Box>

                {/* Group By */}
                <Typography sx={{ fontSize: 11, fontWeight: 800, color: '#9CA3AF', textTransform: 'uppercase', letterSpacing: 0.8, mb: 1 }}>
                  Group By (optional)
                </Typography>
                <FormControl fullWidth size="small" sx={{ mb: 2.5 }}>
                  <Select value={groupBy} onChange={e => setGroupBy(e.target.value)}>
                    <MenuItem value="">No grouping — show all rows</MenuItem>
                    {sourceFields.filter(f => f.type === 'string').map(f => (
                      <MenuItem key={f.key} value={f.key}>{f.label}</MenuItem>
                    ))}
                  </Select>
                </FormControl>

                {/* Aggregations (only when grouped) */}
                {groupBy && (
                  <>
                    <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 1 }}>
                      <Typography sx={{ fontSize: 11, fontWeight: 800, color: '#9CA3AF', textTransform: 'uppercase', letterSpacing: 0.8 }}>
                        Aggregations
                      </Typography>
                      <IconButton size="small" onClick={addAgg} sx={{ color: '#FF5A5A' }}>
                        <AddIcon fontSize="small" />
                      </IconButton>
                    </Stack>
                    <Stack spacing={1} sx={{ mb: 2.5 }}>
                      {aggregations.map((agg, i) => (
                        <Stack key={i} direction="row" spacing={0.5} alignItems="center">
                          <FormControl size="small" sx={{ flex: 1 }}>
                            <Select value={agg.field} onChange={e => updateAgg(i, { field: e.target.value })}>
                              {sourceFields.map(f => <MenuItem key={f.key} value={f.key} sx={{ fontSize: 12 }}>{f.label}</MenuItem>)}
                            </Select>
                          </FormControl>
                          <FormControl size="small" sx={{ width: 80 }}>
                            <Select value={agg.op} onChange={e => updateAgg(i, { op: e.target.value })}>
                              {NUMBER_OPS.map(op => <MenuItem key={op} value={op} sx={{ fontSize: 12 }}>{op}</MenuItem>)}
                            </Select>
                          </FormControl>
                          <IconButton size="small" onClick={() => removeAgg(i)} sx={{ color: '#9CA3AF', flexShrink: 0 }}>
                            <DeleteOutlineIcon fontSize="small" />
                          </IconButton>
                        </Stack>
                      ))}
                      {!aggregations.length && (
                        <Typography sx={{ fontSize: 12, color: '#9CA3AF' }}>Click + to add an aggregation</Typography>
                      )}
                    </Stack>
                  </>
                )}

                {/* Filters */}
                <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 1 }}>
                  <Typography sx={{ fontSize: 11, fontWeight: 800, color: '#9CA3AF', textTransform: 'uppercase', letterSpacing: 0.8 }}>
                    Filters
                  </Typography>
                  <IconButton size="small" onClick={addFilter} sx={{ color: '#FF5A5A' }}>
                    <AddIcon fontSize="small" />
                  </IconButton>
                </Stack>
                <Stack spacing={1.2} sx={{ mb: 2.5 }}>
                  {filters.map((f, i) => {
                    const fieldDef = sourceFields.find(sf => sf.key === f.field);
                    const ops = FILTER_OPS[fieldDef?.type || 'string'];
                    return (
                      <Box key={i} sx={{ p: 1.5, border: '1px solid rgba(0,0,0,0.08)', borderRadius: '8px' }}>
                        <Stack direction="row" spacing={0.5} alignItems="center" sx={{ mb: 0.8 }}>
                          <FormControl size="small" sx={{ flex: 1 }}>
                            <Select value={f.field} onChange={e => updateFilter(i, { field: e.target.value, op: 'equals', value: '' })}>
                              {sourceFields.map(sf => <MenuItem key={sf.key} value={sf.key} sx={{ fontSize: 12 }}>{sf.label}</MenuItem>)}
                            </Select>
                          </FormControl>
                          <IconButton size="small" onClick={() => removeFilter(i)} sx={{ color: '#9CA3AF' }}>
                            <DeleteOutlineIcon fontSize="small" />
                          </IconButton>
                        </Stack>
                        <Stack direction="row" spacing={0.5}>
                          <FormControl size="small" sx={{ width: 110 }}>
                            <Select value={f.op} onChange={e => updateFilter(i, { op: e.target.value })}>
                              {ops.map(op => <MenuItem key={op} value={op} sx={{ fontSize: 12 }}>{op}</MenuItem>)}
                            </Select>
                          </FormControl>
                          <TextField size="small" value={f.value} onChange={e => updateFilter(i, { value: e.target.value })}
                            placeholder="Value" sx={{ flex: 1, '& input': { fontSize: 12 } }} />
                        </Stack>
                      </Box>
                    );
                  })}
                  {!filters.length && (
                    <Typography sx={{ fontSize: 12, color: '#9CA3AF' }}>No filters — showing all records</Typography>
                  )}
                </Stack>

                {/* Sort */}
                <Typography sx={{ fontSize: 11, fontWeight: 800, color: '#9CA3AF', textTransform: 'uppercase', letterSpacing: 0.8, mb: 1 }}>
                  Sort
                </Typography>
                <Stack direction="row" spacing={1} sx={{ mb: 2.5 }}>
                  <FormControl size="small" sx={{ flex: 1 }}>
                    <InputLabel sx={{ fontSize: 12 }}>Sort by</InputLabel>
                    <Select label="Sort by" value={sortBy} onChange={e => setSortBy(e.target.value)}>
                      <MenuItem value="">None</MenuItem>
                      {sourceFields.map(f => <MenuItem key={f.key} value={f.key} sx={{ fontSize: 12 }}>{f.label}</MenuItem>)}
                    </Select>
                  </FormControl>
                  <FormControl size="small" sx={{ width: 90 }}>
                    <Select value={sortDir} onChange={e => setSortDir(e.target.value)}>
                      <MenuItem value="asc">Asc</MenuItem>
                      <MenuItem value="desc">Desc</MenuItem>
                    </Select>
                  </FormControl>
                </Stack>

                {/* Chart */}
                <Typography sx={{ fontSize: 11, fontWeight: 800, color: '#9CA3AF', textTransform: 'uppercase', letterSpacing: 0.8, mb: 1 }}>
                  Chart
                </Typography>
                <Stack direction="row" spacing={1} sx={{ mb: 1.5 }}>
                  {[['bar','Bar',<BarChartIcon />],['pie','Pie',<PieChartOutlineIcon />],['line','Line',<ShowChartIcon />]].map(([v,l,icon]) => (
                    <Chip key={v} label={l} icon={icon} size="small" clickable onClick={() => setChartType(v)}
                      sx={{ fontSize: 11, fontWeight: 700,
                            bgcolor: chartType===v ? 'rgba(99,102,241,0.12)' : 'transparent',
                            color: chartType===v ? '#6366f1' : '#9CA3AF',
                            border: `1.5px solid ${chartType===v ? 'rgba(99,102,241,0.4)' : 'rgba(0,0,0,0.10)'}` }} />
                  ))}
                </Stack>
                <FormControl fullWidth size="small" sx={{ mb: 2.5 }}>
                  <InputLabel sx={{ fontSize: 12 }}>Chart field (Y-axis)</InputLabel>
                  <Select label="Chart field (Y-axis)" value={chartField} onChange={e => setChartField(e.target.value)}>
                    <MenuItem value="">None</MenuItem>
                    {sourceFields.filter(f => f.type === 'number').map(f => (
                      <MenuItem key={f.key} value={groupBy ? `${f.key}_sum` : f.key} sx={{ fontSize: 12 }}>{f.label}</MenuItem>
                    ))}
                  </Select>
                </FormControl>

                <Button fullWidth variant="contained" size="large" startIcon={<PlayArrowIcon />}
                  onClick={runReport} disabled={!dataLoaded || loading || selFields.length === 0}
                  sx={{ fontWeight: 700, fontSize: 14 }}>
                  {loading ? 'Loading data…' : 'Run Report'}
                </Button>
              </CardContent>
            </Card>
          </Box>

          {/* ── RIGHT: Results ── */}
          <Box sx={{ flex: 1, minWidth: 0 }}>
            {!dataLoaded && (
              <Stack spacing={1}>{[1,2,3].map(i=><Skeleton key={i} height={56} sx={{ borderRadius:'10px' }} />)}</Stack>
            )}

            {dataLoaded && !results && (
              <Box sx={{ textAlign:'center', py: 8, bgcolor: 'rgba(255,90,90,0.03)', borderRadius:'16px', border:'1px dashed rgba(255,139,90,0.20)' }}>
                <Typography sx={{ fontSize: 40, mb: 1 }}>📊</Typography>
                <Typography sx={{ fontWeight: 700, fontSize: 15, color: '#1A1A2E', mb: 0.5 }}>Configure and run your report</Typography>
                <Typography sx={{ fontSize: 13, color: '#9CA3AF' }}>Select fields, add filters, then click Run Report</Typography>
              </Box>
            )}

            {results && (
              <>
                {/* Summary bar */}
                <Stack direction="row" spacing={1.5} sx={{ mb: 2 }} flexWrap="wrap">
                  {[
                    { label: 'Total Rows', val: results.length, color: '#6366f1', bg: 'rgba(99,102,241,0.08)' },
                    ...displayCols.filter(c => c.type === 'number').slice(0,3).map(c => ({
                      label: c.label,
                      val: fmtNum(results.reduce((a,r) => a + parseNum(r[c.key]), 0)),
                      color: '#FF5A5A', bg: 'rgba(255,90,90,0.07)',
                    })),
                  ].map((s,i) => (
                    <Box key={i} sx={{ p: 1.5, borderRadius:'10px', bgcolor: s.bg, border: `1px solid ${s.bg}`, minWidth: 120 }}>
                      <Typography sx={{ fontSize: 18, fontWeight: 800, color: s.color }}>{s.val}</Typography>
                      <Typography sx={{ fontSize: 11, color: '#6B7280' }}>{s.label}</Typography>
                    </Box>
                  ))}
                </Stack>

                {/* Chart */}
                {chartField && chartData.length > 0 && (
                  <Card sx={{ border: '1px solid rgba(255,139,90,0.12)', mb: 2 }}>
                    <CardContent sx={{ p: 2.5 }}>
                      <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 2 }}>
                        <ChartIcon sx={{ color: '#6366f1', fontSize: 20 }} />
                        <Typography sx={{ fontWeight: 700, fontSize: 14 }}>Chart</Typography>
                        <Stack direction="row" spacing={0.8} sx={{ ml: 'auto' }}>
                          {[['bar','Bar'],['pie','Pie'],['line','Line']].map(([v,l]) => (
                            <Chip key={v} label={l} size="small" clickable onClick={() => setChartType(v)}
                              sx={{ fontSize: 10, height: 22, fontWeight: 700,
                                    bgcolor: chartType===v ? 'rgba(99,102,241,0.12)' : 'transparent',
                                    color: chartType===v ? '#6366f1' : '#9CA3AF' }} />
                          ))}
                        </Stack>
                      </Stack>
                      <ResponsiveContainer width="100%" height={260}>
                        {chartType === 'pie' ? (
                          <PieChart>
                            <Pie data={chartData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={100} label={({name,percent})=>`${name} ${(percent*100).toFixed(0)}%`}>
                              {chartData.map((_,i) => <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />)}
                            </Pie>
                            <RTooltip formatter={v => fmtNum(v)} />
                            <Legend />
                          </PieChart>
                        ) : chartType === 'line' ? (
                          <LineChart data={chartData} margin={{ left: 10, right: 10 }}>
                            <CartesianGrid strokeDasharray="3 3" stroke="rgba(0,0,0,0.06)" />
                            <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                            <YAxis tick={{ fontSize: 11 }} tickFormatter={v => fmtNum(v)} />
                            <RTooltip formatter={v => fmtNum(v)} />
                            <Line type="monotone" dataKey="value" stroke="#6366f1" strokeWidth={2.5} dot={{ r: 4 }} />
                          </LineChart>
                        ) : (
                          <BarChart data={chartData} margin={{ left: 10, right: 10 }}>
                            <CartesianGrid strokeDasharray="3 3" stroke="rgba(0,0,0,0.06)" />
                            <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                            <YAxis tick={{ fontSize: 11 }} tickFormatter={v => fmtNum(v)} />
                            <RTooltip formatter={v => fmtNum(v)} />
                            <Bar dataKey="value" radius={[6,6,0,0]}>
                              {chartData.map((_,i) => <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />)}
                            </Bar>
                          </BarChart>
                        )}
                      </ResponsiveContainer>
                    </CardContent>
                  </Card>
                )}

                {/* Data table */}
                <Card sx={{ border: '1px solid rgba(255,139,90,0.12)' }}>
                  <CardContent sx={{ p: 0, '&:last-child': { pb: 0 } }}>
                    <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ px: 2.5, py: 1.5, borderBottom: '1px solid rgba(255,139,90,0.08)' }}>
                      <Stack direction="row" spacing={1} alignItems="center">
                        <TableChartOutlinedIcon sx={{ color: '#9CA3AF', fontSize: 18 }} />
                        <Typography sx={{ fontWeight: 700, fontSize: 14 }}>Data ({results.length} rows)</Typography>
                      </Stack>
                    </Stack>
                    <TableContainer>
                      <Table size="small">
                        <TableHead>
                          <TableRow sx={{ bgcolor: '#1A1A2E' }}>
                            {displayCols.map(c => (
                              <TableCell key={c.key} sx={{ color: '#FF8B5A', fontWeight: 700, fontSize: 11.5, whiteSpace: 'nowrap',
                                                           borderBottom: 'none', py: 1.2 }}>
                                {c.label}
                              </TableCell>
                            ))}
                          </TableRow>
                        </TableHead>
                        <TableBody>
                          {pagedResults.map((row, i) => (
                            <TableRow key={i} sx={{ '&:nth-of-type(even)': { bgcolor: 'rgba(255,248,245,0.6)' },
                                                    '&:hover': { bgcolor: 'rgba(255,90,90,0.04)' } }}>
                              {displayCols.map(c => (
                                <TableCell key={c.key} sx={{ fontSize: 12.5, py: 1, borderBottom: '1px solid rgba(255,139,90,0.07)' }}>
                                  {c.type === 'date' ? fmtDate(row[c.key]) : c.type === 'number' ? fmtNum(row[c.key]) : (row[c.key] ?? '—')}
                                </TableCell>
                              ))}
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </TableContainer>
                    {results.length > R_PER_PAGE && (
                      <Box sx={{ display:'flex', justifyContent:'center', py: 1.5 }}>
                        <Pagination count={Math.ceil(results.length/R_PER_PAGE)} page={rPage} onChange={(_,v)=>setRPage(v)} size="small"
                          sx={{ '& .Mui-selected': { bgcolor: 'rgba(255,90,90,0.12) !important', color: '#FF5A5A', fontWeight: 700 } }} />
                      </Box>
                    )}
                  </CardContent>
                </Card>
              </>
            )}
          </Box>
        </Stack>
      )}

      {/* ════════ TAB 1 — Saved Templates ════════ */}
      {tab === 1 && (
        <Box>
          {savedTemplates.length === 0 ? (
            <Box sx={{ textAlign:'center', py: 8 }}>
              <BookmarkOutlinedIcon sx={{ fontSize: 48, color: 'rgba(255,90,90,0.2)', mb: 1 }} />
              <Typography sx={{ fontWeight: 700, color: '#374151', mb: 0.5 }}>No saved templates yet</Typography>
              <Typography sx={{ fontSize: 13, color: '#9CA3AF' }}>
                Build a report in the builder tab and click "Save Template" to store it here
              </Typography>
            </Box>
          ) : (
            <Stack spacing={1.5}>
              {savedTemplates.map(tpl => (
                <Card key={tpl.id} sx={{ border: '1px solid rgba(255,139,90,0.12)' }}>
                  <CardContent sx={{ p: 0, '&:last-child': { pb: 0 } }}>
                    <Box sx={{ px: 2.5, py: 1.5, display:'flex', alignItems:'center', gap: 1.5 }}>
                      <Box sx={{ flex: 1, minWidth: 0 }}>
                        <Typography sx={{ fontWeight: 700, fontSize: 14 }}>{tpl.name}</Typography>
                        {tpl.description && <Typography sx={{ fontSize: 12, color: '#9CA3AF' }}>{tpl.description}</Typography>}
                        <Stack direction="row" spacing={0.8} sx={{ mt: 0.5 }} flexWrap="wrap">
                          <Chip label={tpl.source} size="small" sx={{ fontSize: 10, height: 18, bgcolor:'rgba(99,102,241,0.08)', color:'#6366f1' }} />
                          <Chip label={`${(tpl.fields||[]).length} fields`} size="small" sx={{ fontSize: 10, height: 18, bgcolor:'rgba(255,90,90,0.08)', color:'#FF5A5A' }} />
                          {tpl.groupBy && <Chip label={`Grouped by ${tpl.groupBy}`} size="small" sx={{ fontSize: 10, height: 18, bgcolor:'rgba(16,185,129,0.08)', color:'#059669' }} />}
                          {(tpl.filters||[]).length > 0 && <Chip label={`${tpl.filters.length} filter${tpl.filters.length!==1?'s':''}`} size="small" sx={{ fontSize: 10, height: 18, bgcolor:'rgba(245,158,11,0.08)', color:'#d97706' }} />}
                        </Stack>
                      </Box>
                      <Stack direction="row" spacing={0.8}>
                        <Button size="small" variant="contained" startIcon={<PlayArrowIcon />} onClick={() => loadTemplate(tpl)} sx={{ fontSize: 12 }}>
                          Load & Run
                        </Button>
                        <Tooltip title="Delete template">
                          <IconButton size="small" onClick={() => handleDeleteTemplate(tpl.id)} sx={{ color: '#9CA3AF', '&:hover': { color: '#ef4444' } }}>
                            <DeleteOutlineIcon fontSize="small" />
                          </IconButton>
                        </Tooltip>
                      </Stack>
                    </Box>
                  </CardContent>
                </Card>
              ))}
            </Stack>
          )}
        </Box>
      )}

      {/* Save template dialog */}
      <Dialog open={saveOpen} onClose={() => setSaveOpen(false)} maxWidth="xs" fullWidth PaperProps={{ sx: { borderRadius: '16px' } }}>
        <DialogTitle sx={{ fontWeight: 700 }}>Save Report Template</DialogTitle>
        <DialogContent sx={{ pt: 1.5 }}>
          <Stack spacing={2}>
            <TextField label="Template Name *" fullWidth size="small" value={saveName} onChange={e => setSaveName(e.target.value)} />
            <TextField label="Description" fullWidth size="small" value={saveDesc} onChange={e => setSaveDesc(e.target.value)} />
          </Stack>
        </DialogContent>
        <DialogActions sx={{ px: 3, py: 2 }}>
          <Button onClick={() => setSaveOpen(false)} variant="outlined" sx={{ borderColor: '#e0e0e0', color: '#6B7280' }}>Cancel</Button>
          <Button variant="contained" onClick={handleSaveTemplate} disabled={!saveName.trim() || savingTpl}>
            {savingTpl ? 'Saving…' : 'Save'}
          </Button>
        </DialogActions>
      </Dialog>

      <Snackbar open={toast.open} autoHideDuration={3500} onClose={() => setToast(t => ({ ...t, open: false }))}>
        <Alert severity={toast.severity} variant="filled">{toast.msg}</Alert>
      </Snackbar>

    </Box>
    </LocalizationProvider>
  );
};

export default ReportsPage;
