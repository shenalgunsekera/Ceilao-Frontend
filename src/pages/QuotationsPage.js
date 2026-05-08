import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  collection, addDoc, getDocs, query, orderBy, onSnapshot,
  doc, updateDoc, deleteDoc, serverTimestamp
} from 'firebase/firestore';
import { db } from '../firebase';
import { useAuth } from '../App';
import { PRODUCTS, PRODUCT_LIST } from '../config/products';
import { COUNTRIES } from '../config/countries';
import emailjs from '@emailjs/browser';
import { uploadToCloudinary } from '../cloudinary';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';

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
import FormHelperText from '@mui/material/FormHelperText';
import InputLabel from '@mui/material/InputLabel';
import WarningAmberRoundedIcon from '@mui/icons-material/WarningAmberRounded';
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

/* ── form validation ─────────────────────────────────────────────────────── */
function validateForm(product, values) {
  const def = PRODUCTS[product];
  const errors  = {};
  const missing = [];
  const invalid = [];

  const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

  def.fields.forEach(f => {
    if (f.autoCalc) return;
    if (f.type === 'file') return;
    // skip fields hidden by showIf
    if (f.showIf && values[f.showIf.field] !== f.showIf.value) return;

    const raw = values[f.name];
    const val = raw?.toString().trim() ?? '';

    if (f.required && !val) {
      errors[f.name] = 'Required';
      missing.push(f.label);
      return;
    }

    if (val && (f.type === 'number' || f.type === 'currency')) {
      if (isNaN(Number(val)) || val === '') {
        errors[f.name] = 'Must be a number';
        invalid.push(`${f.label} — must be a number`);
      }
    }

    if (val && f.type === 'email' && !EMAIL_RE.test(val)) {
      errors[f.name] = 'Invalid email address';
      invalid.push(`${f.label} — invalid email address`);
    }
  });

  return { errors, missing, invalid };
}

/* ── generate reference number ────────────────────────────────────────────── */
function genRef(productKey, customerName) {
  const prefix = PRODUCTS[productKey]?.prefix || 'QT';
  const d = new Date();
  const ymd = `${d.getFullYear()}${String(d.getMonth()+1).padStart(2,'0')}${String(d.getDate()).padStart(2,'0')}`;
  const uid = Math.random().toString(36).substring(2, 6).toUpperCase();
  const name = (customerName || '').replace(/[^A-Za-z0-9]/g, '').substring(0, 12).toUpperCase() || 'UNKNOWN';
  return `${prefix}-${ymd}-${uid}-${name}`;
}

/* ── dynamic product form ─────────────────────────────────────────────────── */
function ProductForm({ product, values, onChange, errors = {} }) {
  const [fileUploading, setFileUploading] = useState({});
  const def = PRODUCTS[product];
  if (!def) return null;

  // Group fields by section
  const sections = [];
  let currentSection = { name: null, fields: [] };
  def.fields.forEach(f => {
    if (f.section !== currentSection.name) {
      if (currentSection.fields.length) sections.push({ ...currentSection });
      currentSection = { name: f.section, fields: [f] };
    } else {
      currentSection.fields.push(f);
    }
  });
  if (currentSection.fields.length) sections.push(currentSection);

  const isVisible = (f) => {
    if (!f.showIf) return true;
    return values[f.showIf.field] === f.showIf.value;
  };

  const renderField = (f) => {
    if (!isVisible(f)) return null;
    const isFullWidth = f.fullWidth || f.type === 'textarea' || f.name === 'remarks' || f.name === 'address' || f.name === 'address_of_risk' || f.name === 'operations_description' || f.name === 'goods_description' || f.name === 'product_description';
    const gridStyle = isFullWidth ? { gridColumn: '1 / -1' } : {};
    const hasErr  = !!errors[f.name];
    const errMsg  = errors[f.name];

    // Multi-select (chips)
    if (f.multiSelect || f.type === 'multiselect') {
      const selected = values[f.name] ? values[f.name].split(',').map(s => s.trim()).filter(Boolean) : [];
      return (
        <Box key={f.name} sx={{ gridColumn: '1 / -1' }}>
          <Typography sx={{ fontSize: 12, fontWeight: 600, color: hasErr ? '#ef4444' : '#6B7280', mb: 0.8 }}>
            {f.label}{f.required ? ' *' : ''}
            {hasErr && <Box component="span" sx={{ ml: 1, fontSize: 11, color: '#ef4444' }}>— {errMsg}</Box>}
          </Typography>
          <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.8, p: hasErr ? 1 : 0, borderRadius: '8px', border: hasErr ? '1px solid #ef4444' : 'none' }}>
            {(f.options || []).map(opt => (
              <Chip key={opt} label={opt} size="small" clickable
                onClick={() => {
                  const next = selected.includes(opt) ? selected.filter(s => s !== opt) : [...selected, opt];
                  onChange(f.name, next.join(', '));
                }}
                sx={{
                  bgcolor: selected.includes(opt) ? 'rgba(255,90,90,0.12)' : 'rgba(0,0,0,0.05)',
                  color: selected.includes(opt) ? '#FF5A5A' : '#6B7280',
                  border: selected.includes(opt) ? '1px solid rgba(255,90,90,0.3)' : '1px solid transparent',
                  fontWeight: selected.includes(opt) ? 700 : 400,
                }} />
            ))}
          </Box>
        </Box>
      );
    }

    // Country searchable select
    if (f.type === 'country-select') {
      const selected = COUNTRIES.find(c => c.name === values[f.name]) || null;
      return (
        <Autocomplete key={f.name} sx={gridStyle}
          options={COUNTRIES}
          getOptionLabel={c => c.name}
          value={selected}
          onChange={(_, c) => {
            onChange(f.name, c?.name || '');
            // auto-fill dial code for phone fields if this country field affects them
            if (c && f.affectsPhoneCode) {
              onChange('telephone_code', c.dialCode);
              onChange('mobile_code', c.dialCode);
            }
          }}
          renderOption={(props, c) => (
            <li {...props} key={c.code}>
              <Box component="span" sx={{ mr: 1, fontSize: 11, color: '#9CA3AF', fontFamily: 'monospace' }}>{c.dialCode}</Box>
              {c.name}
            </li>
          )}
          renderInput={params => (
            <TextField {...params} size="small" fullWidth
              label={f.label + (f.required ? ' *' : '')}
              error={hasErr} helperText={errMsg} />
          )}
        />
      );
    }

    // Date
    if (f.type === 'date') {
      return (
        <DatePicker key={f.name}
          label={f.label + (f.required ? ' *' : '')}
          value={values[f.name] ? new Date(values[f.name]) : null}
          onChange={v => onChange(f.name, v ? v.toISOString().split('T')[0] : '')}
          slotProps={{
            textField: {
              size: 'small', fullWidth: true,
              error: hasErr, helperText: errMsg,
            },
          }}
          sx={gridStyle} />
      );
    }

    // Select (includes yesno)
    if (f.options || f.type === 'yesno' || f.type === 'select') {
      const opts = f.type === 'yesno' ? ['Yes', 'No'] : (f.options || []);
      return (
        <FormControl key={f.name} size="small" fullWidth sx={gridStyle} error={hasErr}>
          <InputLabel>{f.label}{f.required ? ' *' : ''}</InputLabel>
          <Select value={values[f.name] || ''} label={f.label + (f.required ? ' *' : '')}
            onChange={e => onChange(f.name, e.target.value)}>
            {opts.map(o => <MenuItem key={o} value={o}>{o}</MenuItem>)}
          </Select>
          {hasErr && <FormHelperText>{errMsg}</FormHelperText>}
        </FormControl>
      );
    }

    // Textarea
    if (f.type === 'textarea') {
      return (
        <TextField key={f.name} size="small" fullWidth multiline rows={3}
          label={f.label + (f.required ? ' *' : '')}
          value={values[f.name] || ''}
          onChange={e => onChange(f.name, e.target.value)}
          error={hasErr} helperText={errMsg}
          sx={{ gridColumn: '1 / -1' }} />
      );
    }

    // Auto-calculated
    if (f.autoCalc) {
      const fields = f.autoCalc.replace('sum:', '').split(',');
      const total = fields.reduce((acc, fn) => acc + (Number(values[fn.trim()]) || 0), 0);
      if (total !== Number(values[f.name] || 0)) {
        setTimeout(() => onChange(f.name, String(total)), 0);
      }
      return (
        <TextField key={f.name} size="small" fullWidth
          label={f.label + ' (Auto-calculated)'}
          value={total > 0 ? total.toLocaleString() : ''}
          InputProps={{ readOnly: true }}
          sx={{ ...gridStyle, '& .MuiInputBase-input': { color: '#FF5A5A', fontWeight: 700 } }} />
      );
    }

    // Phone fields — dial-code selector + number input
    if (f.name === 'telephone' || f.name === 'mobile') {
      const codeKey  = f.name + '_code';
      const codeVal  = values[codeKey] || '+94';
      const codeObj  = COUNTRIES.find(c => c.dialCode === codeVal) || null;
      return (
        <Box key={f.name} sx={{ ...gridStyle, display: 'flex', gap: 0.8, alignItems: 'flex-start' }}>
          <Autocomplete
            options={COUNTRIES}
            getOptionLabel={c => c.dialCode}
            value={codeObj}
            onChange={(_, c) => onChange(codeKey, c?.dialCode || '')}
            disableClearable
            sx={{ width: 120, flexShrink: 0 }}
            renderOption={(props, c) => (
              <li {...props} key={c.code} style={{ fontSize: 12 }}>
                <Box component="span" sx={{ fontWeight: 700, mr: 0.5 }}>{c.dialCode}</Box>
                <Box component="span" sx={{ color: '#9CA3AF' }}>{c.name}</Box>
              </li>
            )}
            renderInput={params => (
              <TextField {...params} size="small" label="Code"
                inputProps={{ ...params.inputProps, style: { fontSize: 13 } }} />
            )}
          />
          <TextField size="small" fullWidth
            label={f.label + (f.required ? ' *' : '')}
            type="tel"
            value={values[f.name] || ''}
            onChange={e => onChange(f.name, e.target.value)}
            error={hasErr} helperText={errMsg} />
        </Box>
      );
    }

    // File upload
    if (f.type === 'file') {
      const url   = values[f.name] || '';
      const fname = values[f.name + '_filename'] || '';
      const busy  = fileUploading[f.name];
      const accept = (f.accept || 'pdf,jpg,jpeg,png').split(',').map(e => `.${e}`).join(',');
      return (
        <Box key={f.name} sx={{ gridColumn: '1 / -1', display: 'flex', alignItems: 'center', gap: 2, p: 1.5, borderRadius: '8px', border: '1px dashed rgba(255,90,90,0.25)', bgcolor: 'rgba(255,90,90,0.02)' }}>
          <Button component="label" variant="outlined" size="small" disabled={busy}
            sx={{ flexShrink: 0, borderColor: url ? '#22c55e' : 'rgba(255,90,90,0.5)', color: url ? '#22c55e' : '#FF5A5A', textTransform: 'none', fontSize: 12, minWidth: 110 }}>
            {busy ? 'Uploading…' : url ? 'Replace' : 'Upload'}
            <input type="file" hidden accept={accept}
              onChange={async (e) => {
                const file = e.target.files[0];
                if (!file) return;
                setFileUploading(prev => ({ ...prev, [f.name]: true }));
                try {
                  const uploadedUrl = await uploadToCloudinary(file, 'ceilao/quotation-docs');
                  onChange(f.name, uploadedUrl);
                  onChange(f.name + '_filename', file.name);
                } catch { /* silently ignore */ }
                setFileUploading(prev => ({ ...prev, [f.name]: false }));
              }} />
          </Button>
          <Box sx={{ flex: 1, minWidth: 0 }}>
            <Typography sx={{ fontSize: 12, fontWeight: 600, color: '#374151' }}>{f.label}</Typography>
            {url ? (
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, mt: 0.3 }}>
                <CheckCircleIcon sx={{ color: '#22c55e', fontSize: 14 }} />
                <Typography component="a" href={url} target="_blank" rel="noopener noreferrer"
                  sx={{ fontSize: 11, color: '#22c55e', textDecoration: 'none', '&:hover': { textDecoration: 'underline' }, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 280 }}>
                  {fname || 'View document'}
                </Typography>
              </Box>
            ) : (
              <Typography sx={{ fontSize: 11, color: '#9CA3AF', mt: 0.3 }}>
                Accepted: {(f.accept || 'pdf, jpg, png').toUpperCase()}
              </Typography>
            )}
          </Box>
        </Box>
      );
    }

    // Currency, email, number, text
    return (
      <TextField key={f.name} size="small" fullWidth
        label={f.label + (f.required ? ' *' : '')}
        type={f.type === 'currency' ? 'number' : (f.type === 'email' ? 'email' : (f.type === 'number' ? 'number' : 'text'))}
        value={values[f.name] || ''}
        onChange={e => onChange(f.name, e.target.value)}
        error={hasErr} helperText={errMsg}
        InputProps={f.type === 'currency' ? { startAdornment: <Box component="span" sx={{ color: '#9CA3AF', mr: 0.5, fontSize: 12 }}>LKR</Box> } : undefined}
        sx={gridStyle} />
    );
  };

  return (
    <Box>
      {sections.map(sec => {
        const sectionHasError = sec.fields.some(f => errors[f.name] && isVisible(f));
        return (
        <Box key={sec.name || 'default'} sx={{ mb: 3 }}>
          {sec.name && (
            <Typography sx={{
              fontSize: 11, fontWeight: 800,
              color: sectionHasError ? '#ef4444' : '#FF5A5A',
              textTransform: 'uppercase', letterSpacing: 1, mb: 1.5, pb: 0.5,
              borderBottom: `1px solid ${sectionHasError ? 'rgba(239,68,68,0.3)' : 'rgba(255,90,90,0.12)'}`,
              display: 'flex', alignItems: 'center', gap: 0.8,
            }}>
              {sectionHasError && <WarningAmberRoundedIcon sx={{ fontSize: 13 }} />}
              {sec.name}
            </Typography>
          )}
          <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr' }, gap: 2 }}>
            {sec.fields.map(f => renderField(f))}
          </Box>
        </Box>
        );
      })}
    </Box>
  );
}

/* ── quote row ─────────────────────────────────────────────────────────────── */
function QuoteRow({ quote, onSelect, tab, onDelete }) {
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

            <Box sx={{ display: 'flex', justifyContent: 'flex-end', mt: 1 }}>
              <Button size="small" color="error" variant="outlined"
                onClick={e => { e.stopPropagation(); onDelete(quote); }}
                sx={{ fontSize: 11, borderColor: 'rgba(239,68,68,0.3)', color: '#ef4444' }}>
                Delete Quote
              </Button>
            </Box>

          </Box>
        </Collapse>
      </CardContent>
    </Card>
  );
}

/* ── comparison view ──────────────────────────────────────────────────────── */
function ComparisonView({ quote, onBack, onConfirm }) {
  const product   = PRODUCTS[quote?.product_key];
  const responses = quote?.responses || [];
  const [custEmail,  setCustEmail]  = useState('');
  const [sending,    setSending]    = useState(false);
  const [sendDone,   setSendDone]   = useState(false);

  const sendToCustomer = async () => {
    if (!custEmail.trim()) return;
    setSending(true);
    try {
      // Build an HTML table of the comparison
      const compRows = (product?.comparisonRows || []);
      const headerCells = responses.map(r => `<th style="background:#FF5A5A;color:#fff;padding:10px 14px;font-size:13px;">${r.company_name}</th>`).join('');
      const fmt = n => n ? Number(n).toLocaleString() : '—';
      // Premium breakdown rows — shown to customer, commission excluded
      const breakdownRows = [
        ['Basic Premium (LKR)', r => fmt(r.basic_premium)],
        ['SRCC (LKR)',          r => fmt(r.srcc_premium)],
        ['TC (LKR)',            r => fmt(r.tc_premium)],
        ['Admin Fee (LKR)',     r => fmt(r.admin_fee)],
        ['VAT (LKR)',           r => fmt(r.vat_amount)],
        ['Other (LKR)',         r => fmt(r.other_premium)],
        ['Total Premium (LKR)', r => `<strong style="color:#FF5A5A">${fmt(r.premium)}</strong>`],
      ].map(([label, getter], i) =>
        `<tr style="background:${i%2===0?'#FFF8F5':'#fff'}"><td style="padding:8px 14px;font-weight:600;color:#374151;">${label}</td>${responses.map(r => `<td style="padding:8px 14px;text-align:right;">${getter(r)}</td>`).join('')}</tr>`
      ).join('');
      const excessRow = `<tr><td style="padding:8px 14px;font-weight:600;color:#374151;">Excesses</td>${responses.map(r => `<td style="padding:8px 14px;color:#4B5563;">${r.excesses||'—'}</td>`).join('')}</tr>`;
      const termsRow  = `<tr style="background:#FFF8F5"><td style="padding:8px 14px;font-weight:600;color:#374151;">Special Terms</td>${responses.map(r => `<td style="padding:8px 14px;color:#4B5563;">${r.special_terms||'—'}</td>`).join('')}</tr>`;
      const dataRows = compRows.filter(r => r !== 'Annual Premium (LKR)').map((row, i) =>
        `<tr style="background:${i%2===0?'#fff':'#FFF8F5'}"><td style="padding:8px 14px;font-weight:600;color:#374151;">${row}</td>${responses.map(r => `<td style="padding:8px 14px;color:#4B5563;text-align:right;">${r.comparison_data?.[row]||'—'}</td>`).join('')}</tr>`
      ).join('');
      const isImg = (url) => url && /\.(jpe?g|png|gif|webp|avif)(\?|$)/i.test(url);
      const docRow = `<tr style="background:#F9F9FB"><td style="padding:10px 14px;font-weight:600;color:#374151;">Uploaded Quote</td>${
        responses.map(r => r.quote_file_url
          ? isImg(r.quote_file_url)
            ? `<td style="padding:8px 14px;text-align:center;"><a href="${r.quote_file_url}" target="_blank"><img src="${r.quote_file_url}" alt="Quote" style="max-width:140px;max-height:100px;border-radius:6px;border:1px solid #E5E7EB;" /></a></td>`
            : `<td style="padding:8px 14px;text-align:center;"><a href="${r.quote_file_url}" target="_blank" style="display:inline-block;background:#6366f1;color:#fff;padding:7px 16px;border-radius:8px;font-size:12px;font-weight:700;text-decoration:none;">View PDF ↗</a></td>`
          : `<td style="padding:8px 14px;text-align:center;color:#9CA3AF;font-size:12px;">Not uploaded</td>`
        ).join('')
      }</tr>`;

      const tableHtml = `<table style="width:100%;border-collapse:collapse;font-family:Arial,sans-serif;"><thead><tr><th style="background:#1A1A2E;color:#FF8B5A;padding:10px 14px;font-size:13px;text-align:left;">Field</th>${headerCells}</tr></thead><tbody>${breakdownRows}${excessRow}${termsRow}${dataRows}${docRow}</tbody></table>`;

      await emailjs.send(
        process.env.REACT_APP_EMAILJS_SERVICE_ID  || '',
        process.env.REACT_APP_EMAILJS_CUSTOMER_TEMPLATE_ID || process.env.REACT_APP_EMAILJS_TEMPLATE_ID || '',
        {
          to_email:      custEmail.trim(),
          to_name:       'Valued Client',
          reference:     quote.reference,
          product:       product?.label || quote.product_key,
          table_html:    tableHtml,
          company_count: responses.length,
        },
        { publicKey: process.env.REACT_APP_EMAILJS_PUBLIC_KEY || '' }
      );
      setSendDone(true);
      setTimeout(() => setSendDone(false), 4000);
    } catch (err) {
      console.error('Customer email error:', err?.text || err?.message);
    }
    setSending(false);
  };

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

    // Premium breakdown
    const breakdownLabels = [
      ['Basic Premium (LKR)', 'basic_premium'],
      ['SRCC (LKR)',          'srcc_premium'],
      ['TC (LKR)',            'tc_premium'],
      ['Admin Fee (LKR)',     'admin_fee'],
      ['VAT (LKR)',           'vat_amount'],
      ['Other (LKR)',         'other_premium'],
      ['Total Premium (LKR)', 'premium'],
    ];
    breakdownLabels.forEach(([label, key], i) => {
      const row = ws.addRow([label, ...responses.map(r => r[key] ? Number(r[key]) : '—')]);
      row.eachCell((cell, ci) => {
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: i % 2 === 0 ? 'FFFFFFFF' : 'FFFFF8F5' } };
        if (ci === 1) cell.font = { bold: true, size: 10, name: 'Calibri' };
        if (key === 'premium' && ci > 1) { cell.font = { bold: true, color: { argb: 'FFFF5A5A' }, size: 11, name: 'Calibri' }; }
      });
    });

    ws.addRow(['Commission Type (Internal)', ...responses.map(r => r.commission_type || '—')]);
    ws.addRow(['Excesses',      ...responses.map(r => r.excesses     || '—')]);
    ws.addRow(['Special Terms', ...responses.map(r => r.special_terms || '—')]);

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

      {/* ── Send comparison to customer ── */}
      <Box sx={{ display: 'flex', gap: 1.5, mb: 3, alignItems: 'center', flexWrap: 'wrap',
                  p: 2, borderRadius: '12px', bgcolor: 'rgba(99,102,241,0.05)', border: '1px solid rgba(99,102,241,0.12)' }}>
        <Typography sx={{ fontSize: 13, fontWeight: 700, color: '#6366f1', flexShrink: 0 }}>
          📧 Send to Customer
        </Typography>
        <TextField size="small" placeholder="customer@email.com" type="email"
          value={custEmail} onChange={e => setCustEmail(e.target.value)}
          sx={{ flex: 1, minWidth: 220,
            '& .MuiOutlinedInput-root': { borderRadius: '10px', fontSize: 13 } }} />
        <Button variant="contained" size="small" disabled={sending || !custEmail.trim()}
          onClick={sendToCustomer}
          sx={{ background: sendDone ? 'linear-gradient(135deg,#10B981,#059669)' : 'linear-gradient(135deg,#6366f1,#818cf8)',
                fontSize: 12, flexShrink: 0, minWidth: 130 }}>
          {sending ? 'Sending…' : sendDone ? '✓ Sent!' : 'Send Comparison'}
        </Button>
      </Box>

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
              {/* Premium breakdown rows */}
              {[
                { key: 'basic_premium', label: 'Basic Premium (LKR)' },
                { key: 'srcc_premium',  label: 'SRCC (LKR)' },
                { key: 'tc_premium',    label: 'TC (LKR)' },
                { key: 'admin_fee',     label: 'Admin Fee (LKR)' },
                { key: 'vat_amount',    label: 'VAT (LKR)' },
                { key: 'other_premium', label: 'Other (LKR)' },
              ].map((row, i) => (
                <TableRow key={row.key} sx={{ bgcolor: i % 2 === 0 ? 'rgba(255,248,245,0.4)' : '#fff' }}>
                  <TableCell sx={{ fontWeight: 600, color: '#374151', fontSize: 12.5 }}>{row.label}</TableCell>
                  {responses.map(r => (
                    <TableCell key={r.id} align="center" sx={{ fontSize: 12.5 }}>
                      {r[row.key] ? Number(r[row.key]).toLocaleString() : '—'}
                    </TableCell>
                  ))}
                </TableRow>
              ))}
              <TableRow sx={{ bgcolor: 'rgba(255,90,90,0.06)' }}>
                <TableCell sx={{ fontWeight: 800, color: '#FF5A5A' }}>Total Premium (LKR)</TableCell>
                {responses.map(r => (
                  <TableCell key={r.id} align="center" sx={{ fontWeight: 800, color: '#FF5A5A', fontSize: 15 }}>
                    {Number(r.premium || 0).toLocaleString()}
                  </TableCell>
                ))}
              </TableRow>
              {/* Commission — broker internal only */}
              <TableRow sx={{ bgcolor: 'rgba(99,102,241,0.04)' }}>
                <TableCell sx={{ fontWeight: 600 }}>
                  <Stack direction="row" spacing={0.8} alignItems="center">
                    <span>Commission Type</span>
                    <Chip label="Internal" size="small"
                      sx={{ fontSize: 9, height: 16, bgcolor: 'rgba(99,102,241,0.12)', color: '#6366f1', fontWeight: 700 }} />
                  </Stack>
                </TableCell>
                {responses.map(r => (
                  <TableCell key={r.id} align="center" sx={{ fontSize: 12.5, color: '#6366f1', fontWeight: 600 }}>
                    {r.commission_type || '—'}
                  </TableCell>
                ))}
              </TableRow>
              {/* Excesses & Special Terms */}
              <TableRow>
                <TableCell sx={{ fontWeight: 600, color: '#374151' }}>Excesses</TableCell>
                {responses.map(r => (
                  <TableCell key={r.id} sx={{ fontSize: 12, color: '#6B7280', whiteSpace: 'pre-wrap' }}>
                    {r.excesses || '—'}
                  </TableCell>
                ))}
              </TableRow>
              <TableRow sx={{ bgcolor: 'rgba(255,248,245,0.6)' }}>
                <TableCell sx={{ fontWeight: 600, color: '#374151' }}>Special Terms</TableCell>
                {responses.map(r => (
                  <TableCell key={r.id} sx={{ fontSize: 12, color: '#6B7280', whiteSpace: 'pre-wrap' }}>
                    {r.special_terms || '—'}
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
                <TableCell sx={{ fontWeight: 700 }}>Notes / T&Cs</TableCell>
                {responses.map(r => (
                  <TableCell key={r.id} sx={{ fontSize: 12, color: '#6B7280', whiteSpace: 'pre-wrap' }}>
                    {r.notes || '—'}
                  </TableCell>
                ))}
              </TableRow>
              {/* Quote images */}
              <TableRow sx={{ bgcolor: 'rgba(99,102,241,0.03)' }}>
                <TableCell sx={{ fontWeight: 700 }}>Uploaded Quote Document</TableCell>
                {responses.map(r => {
                  const isImage = r.quote_file_url && (
                    r.quote_file_url.includes('/image/upload/') ||
                    /\.(jpe?g|png|gif|webp|avif)(\?|$)/i.test(r.quote_file_url)
                  );
                  return (
                    <TableCell key={r.id} align="center">
                      {r.quote_file_url ? (
                        <Box>
                          {isImage ? (
                            <Box component="a" href={r.quote_file_url} target="_blank" rel="noopener noreferrer">
                              <Box component="img"
                                src={r.quote_file_url.replace('/upload/', '/upload/q_auto,f_auto/')}
                                alt={`${r.company_name} quote`}
                                sx={{
                                  width: '100%', maxWidth: 180, maxHeight: 140,
                                  objectFit: 'contain', borderRadius: '10px',
                                  border: '1px solid rgba(99,102,241,0.20)',
                                  display: 'block', mx: 'auto', mb: 1,
                                  cursor: 'pointer',
                                  '&:hover': { opacity: 0.88 },
                                }} />
                            </Box>
                          ) : null}
                          <Chip
                            label={isImage ? 'Open full size ↗' : 'View PDF ↗'}
                            size="small" clickable
                            component="a" href={r.quote_file_url.replace('/upload/', '/upload/fl_inline/')}
                            target="_blank"
                            sx={{ bgcolor: 'rgba(99,102,241,0.10)', color: '#6366f1', fontWeight: 600, fontSize: 11 }} />
                        </Box>
                      ) : <Typography sx={{ fontSize: 12, color: '#9CA3AF' }}>Not uploaded</Typography>}
                    </TableCell>
                  );
                })}
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
  const [filterProduct,  setFilterProduct]  = useState('all');
  const [filterStatus,   setFilterStatus]   = useState('all');
  const [deleteTarget,   setDeleteTarget]   = useState(null);
  const [deleting,       setDeleting]       = useState(false);
  const [fieldErrors,    setFieldErrors]    = useState({});
  const [valIssues,      setValIssues]      = useState({ missing: [], invalid: [] });
  const [valOpen,        setValOpen]        = useState(false);

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
    if (filterProduct !== 'all') list = list.filter(q => q.product_key === filterProduct);
    if (filterStatus  !== 'all') list = list.filter(q => q.status === filterStatus);
    return list;
  }, [quotes, dateFrom, dateTo, filterProduct, filterStatus]);

  const sentQuotes     = filteredQuotes.filter(q => (q.sent_to?.length || 0) > 0);
  const receivedQuotes = filteredQuotes.filter(q => (q.responses?.length || 0) > 0);
  const compareQuotes  = receivedQuotes; // only quotes with at least 1 response can be compared

  const setField = useCallback((name, val) => {
    setFormValues(v => ({ ...v, [name]: val }));
    setFieldErrors(e => { const n = { ...e }; delete n[name]; return n; });
  }, []);

  const handleCreateQuote = async () => {
    const { errors, missing, invalid } = validateForm(product, formValues);
    if (Object.keys(errors).length > 0) {
      setFieldErrors(errors);
      setValIssues({ missing, invalid });
      setValOpen(true);
      return;
    }
    setFieldErrors({});

    setSaving(true);
    try {
      const customerName = formValues[PRODUCTS[product]?.customerNameField || ''] || '';
      const reference = genRef(product, customerName);
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
          const productFields = PRODUCTS[pendingQuote.product_key]?.fields || [];
          const formData      = pendingQuote.form_data || {};
          const noFields      = new Set(
            productFields.filter(f => f.type === 'yesno' && formData[f.name] === 'No').map(f => f.name)
          );
          const formEntries = Object.entries(formData).filter(([k, v]) => {
            if (!v) return false;
            const fd = productFields.find(f => f.name === k);
            if (fd?.type === 'yesno' && v === 'No') return false;
            if (fd?.showIf && noFields.has(fd.showIf.field)) return false;
            return true;
          });
          const details = formEntries.length
            ? formEntries.map(([k, v]) => {
                const field = productFields.find(f => f.name === k);
                return `${field?.label || k}: ${v}`;
              }).join('\n')
            : 'No additional details provided.';

          try {
            await emailjs.send(EMAILJS_SERVICE, EMAILJS_TEMPLATE, {
              to_name:       co.name,
              to_email:      co.email,
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
      const fd = quote.form_data || {};
      // Full mapping: quote form data + insurer response → underwriting form
      const prefill = {
        _quote_id:          quote.id,
        // Insurer & policy
        insurance_provider: response.company_name,
        insurer:            response.company_name,
        policy_type:        quote.product_label || '',
        main_class:         quote.product_label || '',
        coverage:           fd.cover_type || fd.plan_type || fd.marine_type || fd.liability_cover_type || fd.policy_type || '',
        // Premium breakdown from insurer response
        basic_premium:      String(response.basic_premium || response.premium || ''),
        srcc_premium:       String(response.srcc_premium  || ''),
        tc_premium:         String(response.tc_premium    || ''),
        admin_fees:         String(response.admin_fee     || ''),
        vat_fee:            String(response.vat_amount    || ''),
        net_premium:        String(response.basic_premium || response.premium || ''),
        total_invoice:      String(response.premium       || ''),
        // Commission from insurer
        commission_type:    response.commission_type || '',
        // Risk / sum insured from quote form
        sum_insured:        String(fd.sum_insured || fd.total_value || fd.market_value || fd.sum_assured || fd.limit_per_occurrence || fd.cyber_limit || ''),
        // Client details — standardised field names across all 14 products
        client_name:        fd.proposer_name || fd.company_name || fd.full_name || '',
        customer_type:      fd.customer_type === 'Corporate' ? 'Company' : (fd.customer_type || ''),
        introducer_code:    fd.introducer    || '',
        email:              fd.email         || '',
        mobile_no:          fd.mobile        || '',
        telephone:          fd.telephone     || '',
        contact_person:     fd.contact_person || '',
        // NIC or Business Registration
        nic_br:             fd.nic_no || fd.business_reg || '',
        // Address
        street1:            fd.address || fd.property_address || fd.address_of_risk || '',
        city:               fd.city || fd.district || '',
        // Policy period
        policy_period_from: fd.period_from || fd.departure_date || fd.loan_start || '',
        policy_period_to:   fd.period_to   || fd.return_date    || fd.loan_end   || '',
        // Vehicle (motor)
        vehicle_number:     fd.vehicle_no || '',
      };
      window.location.href = `/underwriting?prefill=${encodeURIComponent(JSON.stringify(prefill))}`;
    }, 1500);
  };

  const handleDeleteQuote = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await deleteDoc(doc(db, 'quotes', deleteTarget.id));
      setQuotes(prev => prev.filter(q => q.id !== deleteTarget.id));
      setToast({ open: true, msg: 'Quote deleted.', severity: 'info' });
    } catch (err) {
      setToast({ open: true, msg: err.message, severity: 'error' });
    }
    setDeleteTarget(null);
    setDeleting(false);
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

        {/* Product + Status filters */}
        <Stack direction="row" spacing={1.5} sx={{ mb: 2, flexWrap: 'wrap', gap: 1 }}>
          <FormControl size="small" sx={{ minWidth: 160 }}>
            <InputLabel>Product Type</InputLabel>
            <Select value={filterProduct} label="Product Type" onChange={e => setFilterProduct(e.target.value)}>
              <MenuItem value="all">All Products</MenuItem>
              {PRODUCT_LIST.map(p => <MenuItem key={p.key} value={p.key}>{p.icon} {p.label}</MenuItem>)}
            </Select>
          </FormControl>
          <FormControl size="small" sx={{ minWidth: 140 }}>
            <InputLabel>Status</InputLabel>
            <Select value={filterStatus} label="Status" onChange={e => setFilterStatus(e.target.value)}>
              <MenuItem value="all">All Status</MenuItem>
              <MenuItem value="draft">Draft</MenuItem>
              <MenuItem value="sent">Sent</MenuItem>
              <MenuItem value="partial">Partial</MenuItem>
              <MenuItem value="confirmed">Confirmed</MenuItem>
            </Select>
          </FormControl>
          {(filterProduct !== 'all' || filterStatus !== 'all') && (
            <Button size="small" onClick={() => { setFilterProduct('all'); setFilterStatus('all'); }}
              sx={{ fontSize: 12, color: '#9CA3AF' }}>Clear Filters</Button>
          )}
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
                  onSelect={setCompareQuote}
                  onDelete={q => setDeleteTarget(q)} />
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
                  onClick={() => { setProduct(p.key); setFieldErrors({}); }}
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

            <ProductForm product={product} values={formValues} onChange={setField} errors={fieldErrors} />
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

        {/* ── Validation errors dialog ── */}
        <Dialog open={valOpen} onClose={() => setValOpen(false)} maxWidth="xs" fullWidth>
          <DialogTitle sx={{ display: 'flex', alignItems: 'center', gap: 1.5, pb: 1 }}>
            <WarningAmberRoundedIcon sx={{ color: '#f59e0b', fontSize: 22 }} />
            <span>Please fix these issues</span>
          </DialogTitle>
          <DialogContent>
            {valIssues.missing.length > 0 && (
              <Box sx={{ mb: 2 }}>
                <Typography sx={{ fontSize: 11.5, fontWeight: 700, color: '#ef4444', textTransform: 'uppercase', letterSpacing: 0.6, mb: 1 }}>
                  Required fields not filled
                </Typography>
                {valIssues.missing.map(label => (
                  <Box key={label} sx={{ display: 'flex', alignItems: 'flex-start', gap: 1, mb: 0.6 }}>
                    <Box sx={{ width: 6, height: 6, borderRadius: '50%', bgcolor: '#ef4444', mt: 0.7, flexShrink: 0 }} />
                    <Typography sx={{ fontSize: 13 }}>{label}</Typography>
                  </Box>
                ))}
              </Box>
            )}
            {valIssues.invalid.length > 0 && (
              <Box>
                <Typography sx={{ fontSize: 11.5, fontWeight: 700, color: '#d97706', textTransform: 'uppercase', letterSpacing: 0.6, mb: 1 }}>
                  Invalid values
                </Typography>
                {valIssues.invalid.map(msg => (
                  <Box key={msg} sx={{ display: 'flex', alignItems: 'flex-start', gap: 1, mb: 0.6 }}>
                    <Box sx={{ width: 6, height: 6, borderRadius: '50%', bgcolor: '#d97706', mt: 0.7, flexShrink: 0 }} />
                    <Typography sx={{ fontSize: 13 }}>{msg}</Typography>
                  </Box>
                ))}
              </Box>
            )}
            <Typography sx={{ fontSize: 12, color: '#9CA3AF', mt: 2 }}>
              Fields with issues are highlighted in red on the form.
            </Typography>
          </DialogContent>
          <DialogActions sx={{ px: 3, pb: 2 }}>
            <Button variant="contained" onClick={() => setValOpen(false)}
              sx={{ background: 'linear-gradient(135deg,#FF5A5A,#FF8B5A)', minWidth: 100 }}>
              OK, fix them
            </Button>
          </DialogActions>
        </Dialog>

        <Dialog open={Boolean(deleteTarget)} onClose={() => setDeleteTarget(null)} maxWidth="xs" fullWidth>
          <DialogTitle sx={{ color: '#ef4444' }}>Delete Quote?</DialogTitle>
          <DialogContent>
            <Typography sx={{ fontSize: 13 }}>
              Are you sure you want to delete quote <strong>{deleteTarget?.reference}</strong>? This cannot be undone.
            </Typography>
          </DialogContent>
          <DialogActions>
            <Button onClick={() => setDeleteTarget(null)} sx={{ color: '#6B7280' }}>Cancel</Button>
            <Button variant="contained" color="error" onClick={handleDeleteQuote} disabled={deleting}>
              {deleting ? 'Deleting…' : 'Delete'}
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
