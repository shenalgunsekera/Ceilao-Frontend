import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  collection, addDoc, getDocs, query, orderBy, onSnapshot,
  doc, updateDoc, serverTimestamp
} from 'firebase/firestore';
import { db } from '../firebase';
import { useAuth } from '../App';
import { PRODUCTS, PRODUCT_LIST } from '../config/products';
import emailjs from '@emailjs/browser';

import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import Button from '@mui/material/Button';
import Card from '@mui/material/Card';
import CardContent from '@mui/material/CardContent';
import Tabs from '@mui/material/Tabs';
import Tab from '@mui/material/Tab';
import Dialog from '@mui/material/Dialog';
import DialogTitle from '@mui/material/DialogTitle';
import DialogContent from '@mui/material/DialogContent';
import DialogActions from '@mui/material/DialogActions';
import TextField from '@mui/material/TextField';
import MenuItem from '@mui/material/MenuItem';
import Select from '@mui/material/Select';
import FormControl from '@mui/material/FormControl';
import InputLabel from '@mui/material/InputLabel';
import Chip from '@mui/material/Chip';
import Stack from '@mui/material/Stack';
import Autocomplete from '@mui/material/Autocomplete';
import Table from '@mui/material/Table';
import TableHead from '@mui/material/TableHead';
import TableBody from '@mui/material/TableBody';
import TableRow from '@mui/material/TableRow';
import TableCell from '@mui/material/TableCell';
import TableContainer from '@mui/material/TableContainer';
import Paper from '@mui/material/Paper';
import Collapse from '@mui/material/Collapse';
import Snackbar from '@mui/material/Snackbar';
import Alert from '@mui/material/Alert';
import CircularProgress from '@mui/material/CircularProgress';
import Checkbox from '@mui/material/Checkbox';
import FormControlLabel from '@mui/material/FormControlLabel';
import { LocalizationProvider, DatePicker } from '@mui/x-date-pickers';
import { AdapterDateFns } from '@mui/x-date-pickers/AdapterDateFns';

import AddIcon from '@mui/icons-material/Add';
import SendIcon from '@mui/icons-material/Send';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import ExpandLessIcon from '@mui/icons-material/ExpandLess';
import CompareArrowsIcon from '@mui/icons-material/CompareArrows';
import CheckCircleOutlineIcon from '@mui/icons-material/CheckCircleOutline';
import PendingOutlinedIcon from '@mui/icons-material/PendingOutlined';
import FileDownloadOutlinedIcon from '@mui/icons-material/FileDownloadOutlined';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';

const EMAILJS_SERVICE  = process.env.REACT_APP_EMAILJS_SERVICE_ID  || '';
const EMAILJS_TEMPLATE = process.env.REACT_APP_EMAILJS_TEMPLATE_ID || '';
const EMAILJS_KEY      = process.env.REACT_APP_EMAILJS_PUBLIC_KEY  || '';

// Initialise once — must be after all imports
if (EMAILJS_KEY) emailjs.init({ publicKey: EMAILJS_KEY });

/* ── generate reference number ────────────────────────────────────────────── */
function genRef() {
  const d = new Date();
  const ymd = `${d.getFullYear()}${String(d.getMonth()+1).padStart(2,'0')}${String(d.getDate()).padStart(2,'0')}`;
  const rand = Math.floor(Math.random() * 9000) + 1000;
  return `QT-${ymd}-${rand}`;
}

/* ── dynamic product form ─────────────────────────────────────────────────── */
function ProductForm({ product, values, onChange }) {
  const def = PRODUCTS[product];
  if (!def) return null;
  return (
    <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr' }, gap: 2 }}>
      {def.fields.map(f => {
        if (f.multiSelect) {
          const selected = values[f.name] ? values[f.name].split(',').map(s => s.trim()).filter(Boolean) : [];
          return (
            <Box key={f.name} sx={{ gridColumn: '1 / -1' }}>
              <Typography sx={{ fontSize: 12, fontWeight: 600, color: '#6B7280', mb: 1 }}>{f.label}</Typography>
              <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.8 }}>
                {f.options.map(opt => (
                  <Chip
                    key={opt} label={opt} size="small" clickable
                    onClick={() => {
                      const next = selected.includes(opt)
                        ? selected.filter(s => s !== opt)
                        : [...selected, opt];
                      onChange(f.name, next.join(', '));
                    }}
                    sx={{
                      bgcolor: selected.includes(opt) ? 'rgba(255,90,90,0.12)' : 'rgba(0,0,0,0.05)',
                      color:   selected.includes(opt) ? '#FF5A5A' : '#6B7280',
                      border:  selected.includes(opt) ? '1px solid rgba(255,90,90,0.3)' : '1px solid transparent',
                      fontWeight: selected.includes(opt) ? 700 : 400,
                    }}
                  />
                ))}
              </Box>
            </Box>
          );
        }
        if (f.type === 'date') {
          return (
            <DatePicker key={f.name}
              label={f.label + (f.required ? ' *' : '')}
              value={values[f.name] ? new Date(values[f.name]) : null}
              onChange={v => onChange(f.name, v ? v.toISOString().split('T')[0] : '')}
              slotProps={{ textField: { size: 'small', fullWidth: true } }}
            />
          );
        }
        if (f.options) {
          return (
            <FormControl key={f.name} size="small" fullWidth>
              <InputLabel>{f.label}{f.required ? ' *' : ''}</InputLabel>
              <Select value={values[f.name] || ''} label={f.label + (f.required ? ' *' : '')}
                onChange={e => onChange(f.name, e.target.value)}>
                {f.options.map(o => <MenuItem key={o} value={o}>{o}</MenuItem>)}
              </Select>
            </FormControl>
          );
        }
        return (
          <TextField key={f.name} size="small" fullWidth
            label={f.label + (f.required ? ' *' : '')}
            type={f.type || 'text'}
            value={values[f.name] || ''}
            onChange={e => onChange(f.name, e.target.value)}
            multiline={f.name === 'remarks'} rows={f.name === 'remarks' ? 2 : 1}
            sx={{ gridColumn: f.name === 'remarks' ? '1 / -1' : 'auto' }}
          />
        );
      })}
    </Box>
  );
}

/* ── quote row ─────────────────────────────────────────────────────────────── */
function QuoteRow({ quote, onSelect, tab }) {
  const [open, setOpen] = useState(false);
  const product = PRODUCTS[quote.product_key];
  const sentCount = quote.sent_to?.length || 0;
  const respondedCount = quote.responses?.length || 0;

  const created = quote.created_at?.toDate?.()
    ? quote.created_at.toDate().toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
    : '—';

  return (
    <Card sx={{ mb: 1.5, border: '1px solid rgba(255,139,90,0.12)' }}>
      <CardContent sx={{ p: 0, '&:last-child': { pb: 0 } }}>
        <Box sx={{ px: 2.5, py: 1.5, display: 'flex', alignItems: 'center', gap: 1.5,
                    cursor: 'pointer', '&:hover': { bgcolor: 'rgba(255,90,90,0.02)' } }}
             onClick={() => setOpen(o => !o)}>
          <Box sx={{ width: 38, height: 38, borderRadius: '10px', flexShrink: 0,
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      background: product?.color ? `${product.color}18` : 'rgba(255,90,90,0.08)',
                      fontSize: 18 }}>
            {product?.icon || '📋'}
          </Box>
          <Box sx={{ flex: 1, minWidth: 0 }}>
            <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 0.3 }}>
              <Typography sx={{ fontWeight: 700, fontSize: 14, color: '#1A1A2E' }}>
                {quote.reference}
              </Typography>
              <Chip label={product?.label || quote.product_key} size="small"
                sx={{ bgcolor: 'rgba(255,90,90,0.08)', color: '#FF5A5A', fontWeight: 600, fontSize: 10 }} />
            </Stack>
            <Typography sx={{ fontSize: 11.5, color: '#9CA3AF' }}>
              {created} · By {quote.created_by_name}
              {tab === 'received' && ` · ${respondedCount}/${sentCount} replied`}
            </Typography>
          </Box>
          <Stack direction="row" spacing={1} alignItems="center">
            {(tab === 'received' || tab === 'sent') && sentCount > 0 && (
              <Chip
                label={`${respondedCount}/${sentCount} replied`}
                size="small"
                sx={{
                  bgcolor: respondedCount === sentCount ? 'rgba(16,185,129,0.10)' : 'rgba(245,158,11,0.10)',
                  color:   respondedCount === sentCount ? '#059669' : '#d97706',
                  fontWeight: 700, fontSize: 11,
                }}
              />
            )}
            {tab === 'compare' && (
              <Button size="small" variant="outlined" startIcon={<CompareArrowsIcon />}
                onClick={e => { e.stopPropagation(); onSelect(quote); }}
                sx={{ fontSize: 11, py: 0.4, borderColor: 'rgba(255,139,90,0.3)', color: '#FF8B5A', flexShrink: 0 }}>
                Compare
              </Button>
            )}
            {open ? <ExpandLessIcon sx={{ color: '#9CA3AF' }} /> : <ExpandMoreIcon sx={{ color: '#9CA3AF' }} />}
          </Stack>
        </Box>

        <Collapse in={open} timeout={220} unmountOnExit>
          <Box sx={{ px: 2.5, pb: 2, pt: 0.5, borderTop: '1px solid rgba(255,139,90,0.08)' }}>
            {/* Form data summary */}
            <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: 1.5, mb: 2 }}>
              {Object.entries(quote.form_data || {}).filter(([,v]) => v).slice(0,8).map(([k, v]) => {
                const fieldDef = product?.fields?.find(f => f.name === k);
                return (
                  <Box key={k}>
                    <Typography sx={{ fontSize: 10.5, fontWeight: 700, color: '#9CA3AF', textTransform: 'uppercase', letterSpacing: 0.5 }}>
                      {fieldDef?.label || k}
                    </Typography>
                    <Typography sx={{ fontSize: 12.5, color: '#1A1A2E', fontWeight: 500 }}>{v}</Typography>
                  </Box>
                );
              })}
            </Box>

            {/* Sent to */}
            {quote.sent_to?.length > 0 && (
              <Box sx={{ mb: 1.5 }}>
                <Typography sx={{ fontSize: 11, fontWeight: 700, color: '#9CA3AF', textTransform: 'uppercase', letterSpacing: 0.6, mb: 0.8 }}>
                  Sent to
                </Typography>
                <Stack direction="row" spacing={0.8} flexWrap="wrap">
                  {quote.sent_to.map(c => {
                    const responded = quote.responses?.some(r => r.company_id === c.company_id);
                    return (
                      <Chip key={c.company_id}
                        icon={responded ? <CheckCircleOutlineIcon sx={{ fontSize: '14px !important' }} /> : <PendingOutlinedIcon sx={{ fontSize: '14px !important' }} />}
                        label={c.company_name} size="small"
                        sx={{
                          bgcolor: responded ? 'rgba(16,185,129,0.10)' : 'rgba(245,158,11,0.08)',
                          color:   responded ? '#059669' : '#d97706',
                          fontWeight: 600, fontSize: 11,
                        }} />
                    );
                  })}
                </Stack>
              </Box>
            )}

            {/* Responses preview */}
            {quote.responses?.length > 0 && (
              <Box sx={{ mb: 1.5 }}>
                <Typography sx={{ fontSize: 11, fontWeight: 700, color: '#9CA3AF', textTransform: 'uppercase', letterSpacing: 0.6, mb: 0.8 }}>
                  Received quotes
                </Typography>
                <Stack spacing={1}>
                  {quote.responses.map(r => (
                    <Box key={r.id} sx={{ p: 1.5, borderRadius: '10px', bgcolor: 'rgba(16,185,129,0.06)', border: '1px solid rgba(16,185,129,0.12)' }}>
                      <Stack direction="row" spacing={2} alignItems="center" justifyContent="space-between">
                        <Typography sx={{ fontWeight: 700, fontSize: 13 }}>{r.company_name}</Typography>
                        <Typography sx={{ fontWeight: 800, fontSize: 14, color: '#FF5A5A' }}>
                          LKR {Number(r.premium || 0).toLocaleString()}
                        </Typography>
                      </Stack>
                      {r.quote_file_url && (
                        <Button size="small" href={r.quote_file_url} target="_blank"
                          sx={{ fontSize: 11, mt: 0.5, color: '#6366f1', p: 0 }}>
                          View uploaded quote →
                        </Button>
                      )}
                    </Box>
                  ))}
                </Stack>
              </Box>
            )}

          </Box>
        </Collapse>
      </CardContent>
    </Card>
  );
}

/* ── comparison view ──────────────────────────────────────────────────────── */
function ComparisonView({ quote, onBack, onConfirm }) {
  const product = PRODUCTS[quote?.product_key];
  const responses = quote?.responses || [];

  const exportExcel = async () => {
    const { default: ExcelJS } = await import('exceljs');
    const { saveAs } = await import('file-saver');
    const wb = new ExcelJS.Workbook();
    const ws = wb.addWorksheet('Quote Comparison');
    ws.columns = [
      { width: 28 },
      ...responses.map(() => ({ width: 22 })),
    ];

    // Header
    const headerRow = ws.addRow(['', ...responses.map(r => r.company_name)]);
    headerRow.eachCell((cell, ci) => {
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: ci === 1 ? 'FF1A1A2E' : 'FFFF5A5A' } };
      cell.font = { bold: true, color: { argb: 'FFFFFFFF' }, size: 11, name: 'Calibri' };
      cell.alignment = { horizontal: 'center', vertical: 'middle' };
    });
    headerRow.height = 22;

    // Reference row
    ws.addRow(['Reference', ...responses.map(() => quote.reference)]);

    // Comparison rows
    (product?.comparisonRows || []).forEach((label, i) => {
      const row = ws.addRow([label, ...responses.map(r => r.comparison_data?.[label] || '—')]);
      row.eachCell((cell, ci) => {
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: i % 2 === 0 ? 'FFFFFFFF' : 'FFFFF8F5' } };
        if (ci === 1) cell.font = { bold: true, size: 10, name: 'Calibri' };
      });
    });

    ws.addRow([]);
    ws.addRow(['Notes / Terms', ...responses.map(r => r.notes || '')]);
    ws.addRow(['Quote File URL', ...responses.map(r => r.quote_file_url || '')]);

    const buf = await wb.xlsx.writeBuffer();
    saveAs(new Blob([buf], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }), `comparison_${quote.reference}.xlsx`);
  };

  if (!quote) return null;

  return (
    <Box>
      <Stack direction="row" spacing={1.5} alignItems="center" sx={{ mb: 3 }}>
        <Button startIcon={<ArrowBackIcon />} onClick={onBack} variant="outlined"
          sx={{ fontSize: 12, borderColor: 'rgba(255,139,90,0.3)', color: '#FF8B5A' }}>
          Back
        </Button>
        <Typography sx={{ fontWeight: 800, fontSize: 18 }}>
          Quote Comparison — {quote.reference}
        </Typography>
        <Chip label={product?.label} sx={{ bgcolor: 'rgba(255,90,90,0.08)', color: '#FF5A5A', fontWeight: 700 }} />
        <Box sx={{ flex: 1 }} />
        <Button variant="outlined" size="small" startIcon={<FileDownloadOutlinedIcon />}
          onClick={exportExcel}
          sx={{ fontSize: 12, borderColor: 'rgba(255,139,90,0.3)', color: '#FF8B5A' }}>
          Export Excel
        </Button>
        <Button variant="outlined" size="small" startIcon={<FileDownloadOutlinedIcon />}
          onClick={() => window.print()}
          sx={{ fontSize: 12, borderColor: 'rgba(99,102,241,0.3)', color: '#6366f1' }}>
          Export PDF
        </Button>
      </Stack>

      {responses.length === 0 ? (
        <Box sx={{ textAlign: 'center', py: 6 }}>
          <Typography sx={{ color: '#9CA3AF' }}>No responses received yet for this quote.</Typography>
        </Box>
      ) : (
        <TableContainer component={Paper} elevation={0} sx={{ border: '1px solid rgba(255,139,90,0.12)', borderRadius: '14px', mb: 3 }}>
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell sx={{ fontWeight: 700, minWidth: 180 }}>Field</TableCell>
                {responses.map(r => (
                  <TableCell key={r.id} align="center" sx={{ fontWeight: 700, minWidth: 160 }}>
                    <Box>
                      <Typography sx={{ fontWeight: 800, fontSize: 13 }}>{r.company_name}</Typography>
                      {r.quote_file_url && (
                        <Button size="small" href={r.quote_file_url} target="_blank"
                          sx={{ fontSize: 10, p: 0, color: '#6366f1', minWidth: 'auto' }}>
                          View Quote ↗
                        </Button>
                      )}
                    </Box>
                  </TableCell>
                ))}
              </TableRow>
            </TableHead>
            <TableBody>
              <TableRow sx={{ bgcolor: 'rgba(255,90,90,0.04)' }}>
                <TableCell sx={{ fontWeight: 700 }}>Premium (LKR)</TableCell>
                {responses.map(r => (
                  <TableCell key={r.id} align="center" sx={{ fontWeight: 800, color: '#FF5A5A', fontSize: 15 }}>
                    {Number(r.premium || 0).toLocaleString()}
                  </TableCell>
                ))}
              </TableRow>
              {(product?.comparisonRows || []).filter(row => row !== 'Annual Premium (LKR)').map((row, i) => (
                <TableRow key={row} sx={{ bgcolor: i % 2 === 0 ? '#fff' : 'rgba(255,248,245,0.6)' }}>
                  <TableCell sx={{ fontWeight: 600, color: '#374151' }}>{row}</TableCell>
                  {responses.map(r => (
                    <TableCell key={r.id} align="center" sx={{ fontSize: 12.5 }}>
                      {r.comparison_data?.[row] || '—'}
                    </TableCell>
                  ))}
                </TableRow>
              ))}
              <TableRow>
                <TableCell sx={{ fontWeight: 700 }}>Notes</TableCell>
                {responses.map(r => (
                  <TableCell key={r.id} sx={{ fontSize: 12, color: '#6B7280', whiteSpace: 'pre-wrap' }}>
                    {r.notes || '—'}
                  </TableCell>
                ))}
              </TableRow>
              {/* Quote images */}
              <TableRow>
                <TableCell sx={{ fontWeight: 700 }}>Uploaded Quote</TableCell>
                {responses.map(r => (
                  <TableCell key={r.id} align="center">
                    {r.quote_file_url ? (
                      <Box component="a" href={r.quote_file_url} target="_blank" rel="noopener noreferrer">
                        {r.quote_file_url.match(/\.(jpg|jpeg|png|gif|webp)/i) ? (
                          <Box component="img" src={r.quote_file_url} alt="Quote"
                            sx={{ width: 100, height: 80, objectFit: 'cover', borderRadius: '8px', border: '1px solid rgba(255,139,90,0.2)' }} />
                        ) : (
                          <Chip label="View PDF" size="small"
                            sx={{ bgcolor: 'rgba(99,102,241,0.1)', color: '#6366f1', fontWeight: 600, cursor: 'pointer' }} />
                        )}
                      </Box>
                    ) : '—'}
                  </TableCell>
                ))}
              </TableRow>
              {/* Select winner */}
              <TableRow sx={{ bgcolor: 'rgba(16,185,129,0.04)' }}>
                <TableCell sx={{ fontWeight: 700, color: '#059669' }}>Select this quote</TableCell>
                {responses.map(r => (
                  <TableCell key={r.id} align="center">
                    <Button variant="contained" size="small" color="success"
                      onClick={() => onConfirm(quote, r)}
                      sx={{ fontSize: 11.5, py: 0.5 }}>
                      Go with {r.company_name}
                    </Button>
                  </TableCell>
                ))}
              </TableRow>
            </TableBody>
          </Table>
        </TableContainer>
      )}
    </Box>
  );
}

/* ── main page ────────────────────────────────────────────────────────────── */
const QuotationsPage = () => {
  const { user, userProfile } = useAuth();
  const [tab,           setTab]           = useState(0);
  const [product,       setProduct]       = useState('fire');
  const [quotes,        setQuotes]        = useState([]);
  const [companies,     setCompanies]     = useState([]);
  const [newQuoteOpen,  setNewQuoteOpen]  = useState(false);
  const [sendOpen,      setSendOpen]      = useState(false);
  const [formValues,    setFormValues]    = useState({});
  const [selectedCos,   setSelectedCos]  = useState([]);
  const [saving,        setSaving]        = useState(false);
  const [sending,       setSending]       = useState(false);
  const [pendingQuote,  setPendingQuote]  = useState(null);
  const [compareQuote,  setCompareQuote]  = useState(null);
  const [dateFrom,      setDateFrom]      = useState(null);
  const [dateTo,        setDateTo]        = useState(null);
  const [toast,         setToast]         = useState({ open: false, msg: '', severity: 'success' });

  // Load companies
  useEffect(() => {
    getDocs(collection(db, 'insurance_companies'))
      .then(snap => setCompanies(snap.docs.map(d => ({ id: d.id, ...d.data() }))))
      .catch(() => {});
  }, []);

  // Real-time quotes listener
  useEffect(() => {
    const q = query(collection(db, 'quotes'), orderBy('created_at', 'desc'));
    const unsub = onSnapshot(
      q,
      snap => { setQuotes(snap.docs.map(d => ({ id: d.id, ...d.data() }))); },
      () => { /* permission or network error — keep local optimistic state */ }
    );
    return unsub;
  }, []);

  const filteredQuotes = useMemo(() => {
    let list = quotes;
    if (dateFrom) list = list.filter(q => q.created_at?.toDate?.() >= dateFrom);
    if (dateTo)   list = list.filter(q => q.created_at?.toDate?.() <= dateTo);
    return list;
  }, [quotes, dateFrom, dateTo]);

  const sentQuotes     = filteredQuotes.filter(q => (q.sent_to?.length || 0) > 0);
  const receivedQuotes = filteredQuotes.filter(q => (q.responses?.length || 0) > 0);
  const compareQuotes  = receivedQuotes; // only quotes with at least 1 response can be compared

  const setField = useCallback((name, val) => setFormValues(v => ({ ...v, [name]: val })), []);

  const handleCreateQuote = async () => {
    const def = PRODUCTS[product];
    const missing = def.fields.filter(f => f.required && !formValues[f.name]?.toString().trim());
    if (missing.length) { setToast({ open: true, msg: `Required: ${missing.map(f => f.label).join(', ')}`, severity: 'error' }); return; }

    setSaving(true);
    try {
      const reference = genRef();
      const ref = await addDoc(collection(db, 'quotes'), {
        reference,
        product_key:     product,
        product_label:   PRODUCTS[product].label,
        form_data:       formValues,
        status:          'draft',
        sent_to:         [],
        responses:       [],
        created_by:      user?.uid || '',
        created_by_name: userProfile?.full_name || user?.email?.split('@')[0] || 'Unknown',
        created_at:      serverTimestamp(),
        updated_at:      serverTimestamp(),
      });
      // Optimistic update — add draft to local state immediately
      setQuotes(prev => [{
        id: ref.id, reference, product_key: product,
        product_label: PRODUCTS[product].label,
        form_data: formValues, status: 'draft',
        sent_to: [], responses: [],
        created_by_name: userProfile?.full_name || '',
        created_at: { toDate: () => new Date() },
      }, ...prev]);
      setPendingQuote({ id: ref.id, reference, form_data: formValues, product_key: product });
      setNewQuoteOpen(false);
      setSendOpen(true);
      setFormValues({});
    } catch (err) {
      setToast({ open: true, msg: err.message, severity: 'error' });
    }
    setSaving(false);
  };

  const handleSendQuotes = async () => {
    if (!selectedCos.length) { setToast({ open: true, msg: 'Select at least one insurance company', severity: 'error' }); return; }
    setSending(true);
    try {
      const responseBase = `${window.location.origin}/quote-respond`;
      const sentTo = [];
      for (const co of selectedCos) {
        const responseUrl = `${responseBase}?qid=${pendingQuote.id}&cid=${co.id}&cn=${encodeURIComponent(co.name)}`;
        sentTo.push({ company_id: co.id, company_name: co.name, company_email: co.email, sent_at: new Date().toISOString(), responded: false });

        if (EMAILJS_SERVICE && EMAILJS_TEMPLATE && EMAILJS_KEY && co.email) {
          const productLabel = PRODUCTS[pendingQuote.product_key]?.label || pendingQuote.product_key;
          const formEntries  = Object.entries(pendingQuote.form_data || {}).filter(([,v]) => v);
          const details = formEntries.length
            ? formEntries.map(([k, v]) => {
                const field = PRODUCTS[pendingQuote.product_key]?.fields?.find(f => f.name === k);
                return `${field?.label || k}: ${v}`;
              }).join('\n')
            : 'No additional details provided.';

          try {
            await emailjs.send(EMAILJS_SERVICE, EMAILJS_TEMPLATE, {
              to_name:       co.name,
              to_email:      co.email,
              from_name:     'Ceilao Insurance Brokers',
              from_email:    'noreply@ceilaoinsurance.lk',
              email:         'noreply@ceilaoinsurance.lk',
              reference:     pendingQuote.reference,
              product:       productLabel,
              response_link: responseUrl,
              details,
            }, { publicKey: EMAILJS_KEY });
          } catch (emailErr) {
            // Don't block the whole flow if email fails — quote is still saved
            console.error('EmailJS error for', co.name, ':', emailErr?.text || emailErr?.message || emailErr);
          }
        }
      }

      await updateDoc(doc(db, 'quotes', pendingQuote.id), {
        sent_to: sentTo, status: 'sent', updated_at: serverTimestamp(),
      });

      // Optimistic update — mark as sent in local state immediately
      setQuotes(prev => prev.map(q =>
        q.id === pendingQuote.id ? { ...q, sent_to: sentTo, status: 'sent' } : q
      ));

      setSendOpen(false);
      setSelectedCos([]);
      setPendingQuote(null);
      setToast({ open: true, msg: `Quote request sent to ${sentTo.length} insurer${sentTo.length > 1 ? 's' : ''}!`, severity: 'success' });
      setTab(0);
    } catch (err) {
      setToast({ open: true, msg: err.message, severity: 'error' });
    }
    setSending(false);
  };

  const handleConfirmQuote = async (quote, response) => {
    await updateDoc(doc(db, 'quotes', quote.id), {
      status: 'confirmed',
      selected_company: response.company_name,
      selected_premium: response.premium,
      updated_at: serverTimestamp(),
    });
    setToast({ open: true, msg: `${response.company_name} selected. Forwarding to Underwriting…`, severity: 'success' });
    setCompareQuote(null);
    setTimeout(() => {
      window.location.href = `/underwriting?prefill=${encodeURIComponent(JSON.stringify({
        product:            quote.product_label,
        insurance_provider: response.company_name,
        net_premium:        response.premium,
        ...quote.form_data,
      }))}`;
    }, 1500);
  };

  const tabQuotes = [sentQuotes, receivedQuotes, compareQuotes];

  return (
    <LocalizationProvider dateAdapter={AdapterDateFns}>
      <Box className="page-enter" sx={{ maxWidth: 1100, mx: 'auto' }}>

        {/* Header */}
        <Stack direction={{ xs: 'column', sm: 'row' }} justifyContent="space-between" alignItems={{ sm: 'center' }} sx={{ mb: 3 }}>
          <Box>
            <Typography variant="h5" sx={{ fontWeight: 800, mb: 0.3 }}>Quotations</Typography>
            <Typography sx={{ fontSize: 13, color: '#9CA3AF' }}>
              Request, track and compare quotes from insurance companies
            </Typography>
          </Box>
          <Button variant="contained" startIcon={<AddIcon />} onClick={() => { setFormValues({}); setNewQuoteOpen(true); }} sx={{ mt: { xs: 1.5, sm: 0 } }}>
            New Quote Request
          </Button>
        </Stack>

        {/* Stats row */}
        <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.5} sx={{ mb: 3 }}>
          {[
            { label: 'Sent',     val: sentQuotes.length,     color: '#d97706', bg: 'rgba(245,158,11,0.08)' },
            { label: 'Received', val: receivedQuotes.length, color: '#059669', bg: 'rgba(16,185,129,0.08)' },
          ].map(s => (
            <Box key={s.label} sx={{ flex: 1, p: 2, borderRadius: '12px', bgcolor: s.bg, border: `1px solid ${s.bg}` }}>
              <Typography sx={{ fontSize: 24, fontWeight: 800, color: s.color }}>{s.val}</Typography>
              <Typography sx={{ fontSize: 12, color: '#6B7280' }}>{s.label}</Typography>
            </Box>
          ))}

          {/* Date filters */}
          <Box sx={{ display: 'flex', gap: 1.5, alignItems: 'center', flex: 2 }}>
            <DatePicker label="From" value={dateFrom} onChange={setDateFrom}
              slotProps={{ textField: { size: 'small', sx: { minWidth: 150 } } }} />
            <DatePicker label="To" value={dateTo} onChange={setDateTo}
              slotProps={{ textField: { size: 'small', sx: { minWidth: 150 } } } } />
            {(dateFrom || dateTo) && (
              <Button size="small" onClick={() => { setDateFrom(null); setDateTo(null); }}
                sx={{ fontSize: 12, color: '#9CA3AF', flexShrink: 0 }}>Clear</Button>
            )}
          </Box>
        </Stack>

        {/* Compare view */}
        {compareQuote ? (
          <ComparisonView quote={compareQuote} onBack={() => setCompareQuote(null)} onConfirm={handleConfirmQuote} />
        ) : (
          <>
            <Tabs value={tab} onChange={(_, v) => setTab(v)} sx={{
              mb: 2.5, borderBottom: '1px solid rgba(255,139,90,0.12)',
              '& .MuiTab-root': { fontSize: 13, fontWeight: 600, textTransform: 'none', color: '#9CA3AF' },
              '& .Mui-selected': { color: '#FF5A5A' },
              '& .MuiTabs-indicator': { background: 'linear-gradient(90deg,#FF5A5A,#FF8B5A)', height: 2.5 },
            }}>
              <Tab label={`Sent (${sentQuotes.length})`} />
              <Tab label={`Received (${receivedQuotes.length})`} />
              <Tab label={`Compare (${compareQuotes.length})`} />
            </Tabs>

            {tabQuotes[tab].length === 0 ? (
              <Box sx={{ textAlign: 'center', py: 6 }}>
                <Typography sx={{ color: '#9CA3AF', fontWeight: 600 }}>
                  {tab === 0 ? 'No sent quote requests yet.' : tab === 1 ? 'No responses received yet.' : 'No quotes with responses to compare yet.'}
                </Typography>
                <Typography sx={{ fontSize: 12.5, color: '#C4B5B0', mt: 0.5 }}>
                  {tab === 0 ? 'Click "New Quote Request" to get started.' : tab === 1 ? 'Responses appear here once insurers submit their quotes.' : 'Quotes move here once at least one insurer responds.'}
                </Typography>
              </Box>
            ) : (
              tabQuotes[tab].map(q => (
                <QuoteRow key={q.id} quote={q}
                  tab={tab === 0 ? 'sent' : tab === 1 ? 'received' : 'compare'}
                  onSelect={setCompareQuote} />
              ))
            )}
          </>
        )}

        {/* ── New Quote Dialog ── */}
        <Dialog open={newQuoteOpen} onClose={() => setNewQuoteOpen(false)} maxWidth="md" fullWidth>
          <DialogTitle>
            New Quote Request
          </DialogTitle>
          <DialogContent sx={{ pt: 2.5 }}>
            {/* Product selector */}
            <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap', mb: 3 }}>
              {PRODUCT_LIST.map(p => (
                <Chip key={p.key} label={`${p.icon} ${p.label}`} clickable
                  onClick={() => setProduct(p.key)}
                  sx={{
                    fontWeight: 700, fontSize: 12.5,
                    bgcolor: product === p.key ? `${p.color}18` : 'rgba(0,0,0,0.04)',
                    color:   product === p.key ? p.color : '#6B7280',
                    border:  product === p.key ? `1.5px solid ${p.color}50` : '1.5px solid transparent',
                    transition: 'all 0.15s ease',
                  }}
                />
              ))}
            </Box>

            <ProductForm product={product} values={formValues} onChange={setField} />
          </DialogContent>
          <DialogActions sx={{ px: 3, py: 2, borderTop: '1px solid rgba(255,139,90,0.10)' }}>
            <Button onClick={() => setNewQuoteOpen(false)} variant="outlined"
              sx={{ borderColor: '#e0e0e0', color: '#6B7280' }}>Cancel</Button>
            <Button variant="contained" onClick={handleCreateQuote} disabled={saving}>
              {saving ? 'Saving…' : 'Save & Select Insurers →'}
            </Button>
          </DialogActions>
        </Dialog>

        {/* ── Send to Insurers Dialog ── */}
        <Dialog open={sendOpen} onClose={() => setSendOpen(false)} maxWidth="sm" fullWidth>
          <DialogTitle sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
            <SendIcon sx={{ color: '#FF8B5A', fontSize: 20 }} />
            Select Insurance Companies
          </DialogTitle>
          <DialogContent sx={{ pt: 2 }}>
            <Typography sx={{ fontSize: 13, color: '#6B7280', mb: 2 }}>
              Select the insurers to send this quote request to. Each will receive an email with a link to submit their quotation.
            </Typography>
            {companies.length === 0 ? (
              <Alert severity="info" sx={{ fontSize: 12 }}>
                No insurance companies configured. Add them in the Admin Panel → Insurance Companies tab.
              </Alert>
            ) : (
              <Autocomplete
                multiple disableCloseOnSelect
                options={companies}
                getOptionLabel={o => `${o.name} (${o.email})`}
                value={selectedCos}
                onChange={(_, v) => setSelectedCos(v)}
                renderInput={params => (
                  <TextField {...params} label="Search and select insurers" size="small"
                    placeholder="Type to search…" />
                )}
                renderOption={(props, option, { selected }) => (
                  <li {...props}>
                    <FormControlLabel
                      control={<Checkbox size="small" checked={selected} sx={{ mr: 0.5 }} />}
                      label={<Box><Typography sx={{ fontSize: 13, fontWeight: 600 }}>{option.name}</Typography>
                        <Typography sx={{ fontSize: 11, color: '#9CA3AF' }}>{option.email}</Typography></Box>}
                      sx={{ m: 0 }}
                    />
                  </li>
                )}
              />
            )}
            {!EMAILJS_SERVICE && (
              <Alert severity="warning" sx={{ fontSize: 12, mt: 2 }}>
                EmailJS is not configured. Quotes will be saved but emails won't be sent automatically.
                Set REACT_APP_EMAILJS_SERVICE_ID, REACT_APP_EMAILJS_TEMPLATE_ID, and REACT_APP_EMAILJS_PUBLIC_KEY in your Vercel environment variables.
              </Alert>
            )}
          </DialogContent>
          <DialogActions sx={{ px: 3, py: 2, borderTop: '1px solid rgba(255,139,90,0.10)' }}>
            <Button onClick={() => setSendOpen(false)} variant="outlined"
              sx={{ borderColor: '#e0e0e0', color: '#6B7280' }}>Cancel</Button>
            <Button variant="contained" startIcon={sending ? <CircularProgress size={14} color="inherit" /> : <SendIcon />}
              onClick={handleSendQuotes} disabled={sending || !selectedCos.length}>
              {sending ? 'Sending…' : `Send to ${selectedCos.length} insurer${selectedCos.length !== 1 ? 's' : ''}`}
            </Button>
          </DialogActions>
        </Dialog>

        <Snackbar open={toast.open} autoHideDuration={5000} onClose={() => setToast(t => ({ ...t, open: false }))}>
          <Alert severity={toast.severity} variant="filled">{toast.msg}</Alert>
        </Snackbar>
      </Box>
    </LocalizationProvider>
  );
};

export default QuotationsPage;
