import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import {
  collection, addDoc, getDocs, query, orderBy, onSnapshot,
  doc, updateDoc, deleteDoc, serverTimestamp
} from 'firebase/firestore';
import { db } from '../firebase';
import { useAuth } from '../App';
import { PRODUCTS, PRODUCT_LIST } from '../config/products';
import { COUNTRIES } from '../config/countries';
import emailjs from '@emailjs/browser';
import { uploadToCloudinary, viewUrl, openFile } from '../cloudinary';
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

const DRAFT_KEY = 'ceilao_draft_quote';

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
            error={hasErr} helperText={errMsg}
            inputProps={{ maxLength: 9, placeholder: '7XXXXXXXX' }} />
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
        inputProps={f.maxLength ? { maxLength: f.maxLength } : undefined}
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

  const hasSelection = !!quote.customer_selection;

  return (
    <Card sx={{ mb: 1.5, border: `1px solid ${hasSelection ? 'rgba(16,185,129,0.35)' : 'rgba(255,139,90,0.12)'}`, boxShadow: hasSelection ? '0 0 0 2px rgba(16,185,129,0.08)' : 'none' }}>
      {hasSelection && (
        <Box sx={{ background: 'linear-gradient(90deg,#059669,#10B981)', px: 2.5, py: 0.9, display: 'flex', alignItems: 'center', gap: 1.5 }}>
          <Box sx={{ fontSize: 16 }}>🏆</Box>
          <Typography sx={{ fontWeight: 700, fontSize: 12.5, color: '#fff' }}>
            Customer selected <strong>{quote.customer_selection.company_name}</strong>
          </Typography>
          <Typography sx={{ fontSize: 11, color: 'rgba(255,255,255,0.75)', ml: 'auto' }}>
            {new Date(quote.customer_selection.selected_at).toLocaleString('en-GB', { day:'numeric', month:'short', hour:'2-digit', minute:'2-digit' })}
          </Typography>
        </Box>
      )}
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
              {hasSelection && (
                <Chip label={`🏆 ${quote.customer_selection.company_name}`} size="small"
                  sx={{ bgcolor: 'rgba(16,185,129,0.12)', color: '#059669', fontWeight: 700, fontSize: 10 }} />
              )}
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
                        <Button size="small" onClick={() => openFile(r.quote_file_url)}
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
  const coverFields  = (product?.fields || []).filter(f => ['Covers Required', 'Cover Required'].includes(f.section) && f.type === 'yesno');
  const clauseFields = (product?.fields || []).filter(f => f.section === 'Additional Clauses' && f.type === 'yesno');

  // ── Broker response-edit state ──────────────────────────────────────────────
  const [editTarget,       setEditTarget]       = useState(null);
  const [editForm,         setEditForm]         = useState({});
  const [editCoverResp,    setEditCoverResp]    = useState({});
  const [editClauseResp,   setEditClauseResp]   = useState({});
  const [editSaving,       setEditSaving]       = useState(false);
  const [exportingExcel,   setExportingExcel]   = useState(false);
  const [exportingPdf,     setExportingPdf]     = useState(false);
  const [exportError,      setExportError]      = useState('');

  const openEdit = (r) => {
    setEditTarget(r);
    setEditForm({
      basic_premium:   r.basic_premium?.toString()  || '',
      srcc_premium:    r.srcc_premium?.toString()   || '',
      tc_premium:      r.tc_premium?.toString()     || '',
      admin_fee:       r.admin_fee?.toString()      || '',
      vat_amount:      r.vat_amount?.toString()     || '',
      other_premium:   r.other_premium?.toString()  || '',
      deductible:      r.deductible     || '',
      excesses:        r.excesses       || '',
      commission_type: r.commission_type || '',
      validity_days:   r.validity_days?.toString()  || '',
      notes:           r.notes          || '',
    });
    setEditCoverResp(r.cover_responses   ? JSON.parse(JSON.stringify(r.cover_responses))  : {});
    setEditClauseResp(r.clause_responses ? JSON.parse(JSON.stringify(r.clause_responses)) : {});
  };

  const setECover  = (name, key, val) => setEditCoverResp(prev  => ({ ...prev, [name]: { ...(prev[name]  || {}), [key]: val } }));
  const setEClause = (name, key, val) => setEditClauseResp(prev => ({ ...prev, [name]: { ...(prev[name] || {}), [key]: val } }));

  const saveEdit = async () => {
    if (!editTarget) return;
    setEditSaving(true);
    try {
      const snap = await (await import('firebase/firestore')).getDoc(
        (await import('firebase/firestore')).doc(db, 'quotes', quote.id)
      );
      if (snap.exists()) {
        const updated = (snap.data().responses || []).map(r => {
          if (r.company_id !== editTarget.company_id) return r;
          const bp = Number(editForm.basic_premium) || 0;
          const sp = Number(editForm.srcc_premium)  || 0;
          const tc = Number(editForm.tc_premium)    || 0;
          const af = Number(editForm.admin_fee)     || 0;
          const vt = Number(editForm.vat_amount)    || 0;
          const op = Number(editForm.other_premium) || 0;
          return {
            ...r,
            basic_premium:    bp,
            srcc_premium:     sp,
            tc_premium:       tc,
            admin_fee:        af,
            vat_amount:       vt,
            other_premium:    op,
            premium:          bp + sp + tc + af + vt + op,
            deductible:       editForm.deductible,
            excesses:         editForm.excesses,
            commission_type:  editForm.commission_type,
            validity_days:    editForm.validity_days,
            notes:            editForm.notes,
            cover_responses:  editCoverResp,
            clause_responses: editClauseResp,
            edited_by_broker: true,
            broker_edited_at: new Date().toISOString(),
          };
        });
        await updateDoc(doc(db, 'quotes', quote.id), { responses: updated, updated_at: serverTimestamp() });
      }
      setEditTarget(null);
    } catch (err) { console.error('Edit save failed:', err); }
    setEditSaving(false);
  };
  const [custEmail,  setCustEmail]  = useState('');
  const [sending,    setSending]    = useState(false);
  const [sendDone,   setSendDone]   = useState(false);
  const [sendError,  setSendError]  = useState('');

  const sendToCustomer = async () => {
    if (!custEmail.trim()) return;
    setSending(true);
    try {
      // Build an HTML comparison table for the customer
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
      const deductiblesRow = `<tr style="background:#FFF8F5"><td style="padding:8px 14px;font-weight:600;color:#374151;">Deductibles</td>${responses.map(r => `<td style="padding:8px 14px;color:#4B5563;">${r.deductible||'—'}</td>`).join('')}</tr>`;
      const excessRow      = `<tr><td style="padding:8px 14px;font-weight:600;color:#374151;">Excesses</td>${responses.map(r => `<td style="padding:8px 14px;color:#4B5563;">${r.excesses||'—'}</td>`).join('')}</tr>`;
      const validityRow    = `<tr style="background:#FFF8F5"><td style="padding:8px 14px;font-weight:600;color:#374151;">Validity (days)</td>${responses.map(r => `<td style="padding:8px 14px;color:#4B5563;text-align:center;">${r.validity_days||'—'}</td>`).join('')}</tr>`;
      // Covers section
      const cvFields = (product?.fields || []).filter(f => ['Covers Required','Cover Required'].includes(f.section) && f.type === 'yesno');
      const clFields = (product?.fields || []).filter(f => f.section === 'Additional Clauses' && f.type === 'yesno');
      const sectionHeader = (label) => `<tr><td colspan="${responses.length+1}" style="background:#1A1A2E;padding:10px 14px;font-size:11px;font-weight:800;color:#FF8B5A;text-transform:uppercase;letter-spacing:1px;">${label}</td></tr>`;
      const coverRows = cvFields.length > 0 ? sectionHeader('Covers Required') + cvFields.map((f,i) => {
        const cells = responses.map(r => {
          const cr = r.cover_responses?.[f.name];
          const p = cr?.provided || '—';
          const c = p === 'Yes' ? '#059669' : p === 'No' ? '#dc2626' : '#9CA3AF';
          const t = cr?.terms ? `<br/><span style="font-size:10px;color:#9CA3AF;">${cr.terms}</span>` : '';
          return `<td style="padding:8px 14px;text-align:center;"><span style="font-weight:700;color:${c};">${p}</span>${t}</td>`;
        }).join('');
        return `<tr style="background:${i%2===0?'#fff':'#FFF8F5'}"><td style="padding:8px 14px 8px 22px;font-weight:600;color:#374151;font-size:12px;">${f.label}</td>${cells}</tr>`;
      }).join('') : '';
      const clauseRows = clFields.length > 0 ? sectionHeader('Additional Clauses') + clFields.map((f,i) => {
        const cells = responses.map(r => {
          const cr = r.clause_responses?.[f.name];
          const p = cr?.provided || '—';
          const c = p === 'Yes' ? '#059669' : p === 'No' ? '#dc2626' : '#9CA3AF';
          const t = cr?.terms ? `<br/><span style="font-size:10px;color:#9CA3AF;">${cr.terms}</span>` : '';
          return `<td style="padding:8px 14px;text-align:center;"><span style="font-weight:700;color:${c};">${p}</span>${t}</td>`;
        }).join('');
        return `<tr style="background:${i%2===0?'#fff':'#FFF8F5'}"><td style="padding:8px 14px 8px 22px;font-weight:600;color:#374151;font-size:12px;">${f.label}</td>${cells}</tr>`;
      }).join('') : '';
      const isImg = (url) => url && /\.(jpe?g|png|gif|webp|avif)(\?|$)/i.test(url);
      const docRow = `<tr style="background:#F9F9FB"><td style="padding:10px 14px;font-weight:600;color:#374151;">Uploaded Quote</td>${
        responses.map(r => r.quote_file_url
          ? isImg(r.quote_file_url)
            ? `<td style="padding:8px 14px;text-align:center;"><a href="${r.quote_file_url}" target="_blank"><img src="${r.quote_file_url}" alt="Quote" style="max-width:140px;max-height:100px;border-radius:6px;border:1px solid #E5E7EB;" /></a></td>`
            : `<td style="padding:8px 14px;text-align:center;"><a href="${r.quote_file_url}" target="_blank" style="display:inline-block;background:#6366f1;color:#fff;padding:7px 16px;border-radius:8px;font-size:12px;font-weight:700;text-decoration:none;">View PDF ↗</a></td>`
          : `<td style="padding:8px 14px;text-align:center;color:#9CA3AF;font-size:12px;">Not uploaded</td>`
        ).join('')
      }</tr>`;

      const tableHtml = `<table style="width:100%;border-collapse:collapse;font-family:Arial,sans-serif;border-radius:10px;overflow:hidden;"><thead><tr><th style="background:#1A1A2E;color:#FF8B5A;padding:10px 14px;font-size:13px;text-align:left;">Field</th>${headerCells}</tr></thead><tbody>${breakdownRows}${deductiblesRow}${excessRow}${validityRow}${coverRows}${clauseRows}${docRow}</tbody></table>`;

      // Selection buttons + PDF download link for email
      const baseUrl = window.location.origin;
      const selectionSection = `
        <div style="margin-top:28px;padding:20px 0;border-top:2px solid rgba(255,90,90,0.15);text-align:center;">
          <p style="margin:0 0 14px;color:#1A1A2E;font-size:15px;font-weight:700;">Select Your Preferred Insurer</p>
          <p style="margin:0 0 18px;color:#6B7280;font-size:13px;">Click the company you'd like to proceed with:</p>
          <div style="display:flex;gap:10px;justify-content:center;flex-wrap:wrap;margin-bottom:20px;">
            ${responses.map(r => `<a href="${baseUrl}/quote-select?qid=${quote.id}&cid=${encodeURIComponent(r.company_id)}&cn=${encodeURIComponent(r.company_name)}" target="_blank" style="display:inline-block;background:linear-gradient(135deg,#FF5A5A,#FF8B5A);color:#fff;padding:11px 22px;border-radius:8px;font-size:13px;font-weight:700;text-decoration:none;margin:3px;">Go with ${r.company_name} →</a>`).join('')}
          </div>
          <a href="${baseUrl}/comparison-pdf?qid=${quote.id}" target="_blank" style="display:inline-block;background:#1A1A2E;color:#fff;padding:10px 24px;border-radius:8px;font-size:13px;font-weight:600;text-decoration:none;">📄 Download PDF Comparison</a>
        </div>`;

      await emailjs.send(
        process.env.REACT_APP_EMAILJS_SERVICE_ID  || '',
        process.env.REACT_APP_EMAILJS_CUSTOMER_TEMPLATE_ID || process.env.REACT_APP_EMAILJS_TEMPLATE_ID || '',
        {
          to_email:      custEmail.trim(),
          to_name:       'Valued Client',
          reference:     quote.reference,
          product:       product?.label || quote.product_key,
          table_html:    tableHtml + selectionSection,
          company_count: responses.length,
        },
        { publicKey: process.env.REACT_APP_EMAILJS_PUBLIC_KEY || '' }
      );
      setSendDone(true);
      setTimeout(() => setSendDone(false), 4000);
    } catch (err) {
      const msg = err?.text || err?.message || JSON.stringify(err);
      console.error('Customer email error:', msg);
      setSendError(msg);
      setTimeout(() => setSendError(''), 8000);
    }
    setSending(false);
  };

  // ── helpers shared by both exports ─────────────────────────────────────────
  const colCount = responses.length + 1;
  const today    = new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' });

  const fetchBase64 = async (url) => {
    const res = await fetch(url);
    const blob = await res.blob();
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload  = () => resolve(reader.result);
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });
  };

  // ── Export Excel ────────────────────────────────────────────────────────────
  const exportExcel = async () => {
    setExportingExcel(true);
    setExportError('');
    try {
    const { default: ExcelJS } = await import('exceljs');
    const wb = new ExcelJS.Workbook();
    wb.creator   = 'Ceilao Insurance Brokers';
    wb.created   = new Date();
    const ws = wb.addWorksheet('Quote Comparison', { pageSetup: { orientation: 'landscape', fitToPage: true } });
    ws.columns = [{ width: 34 }, ...responses.map(() => ({ width: 24 }))];

    const DARK  = 'FF1A1A2E';
    const RED   = 'FFFF5A5A';
    const AMBER = 'FFFF8B5A';
    const WHITE = 'FFFFFFFF';
    const LIGHT = 'FFFFF8F5';
    const GREY  = 'FFF9FAFB';

    const mergedRow = (text, bg, fg, sz, h = 20, align = 'center') => {
      const r = ws.addRow([text, ...Array(colCount - 1).fill('')]);
      ws.mergeCells(r.number, 1, r.number, colCount);
      r.height = h;
      const c = r.getCell(1);
      c.fill      = { type: 'pattern', pattern: 'solid', fgColor: { argb: bg } };
      c.font      = { bold: true, color: { argb: fg }, size: sz, name: 'Calibri' };
      c.alignment = { horizontal: align, vertical: 'middle', indent: align === 'left' ? 2 : 0, wrapText: false };
      return r;
    };

    const addSection = (label) => {
      // Spacer row
      const sp = ws.addRow(Array(colCount).fill(''));
      sp.height = 6;
      sp.eachCell(c => { c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF3F4F6' } }; });
      // Section header
      mergedRow(label, DARK, AMBER, 9, 18, 'left');
    };

    const addDataRow = (label, values, isTotal = false, isInternal = false, rowIdx = 0) => {
      const r = ws.addRow([label, ...values]);
      r.height = isTotal ? 20 : 17;
      const sides = { style: 'thin', color: { argb: 'FFE5E7EB' } };
      r.eachCell((cell, ci) => {
        const bg = isTotal ? RED : isInternal ? 'FFEEF2FF' : rowIdx % 2 === 0 ? WHITE : LIGHT;
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: bg } };
        cell.font = {
          bold: ci === 1 || isTotal,
          color: { argb: isTotal ? WHITE : isInternal ? 'FF4F46E5' : DARK },
          size: isTotal ? 10.5 : 9.5, name: 'Calibri',
        };
        cell.alignment = { horizontal: ci === 1 ? 'left' : 'center', vertical: 'middle', wrapText: true, indent: ci === 1 ? 2 : 0 };
        cell.border = { top: { style: 'hair', color: { argb: 'FFF3F4F6' } }, bottom: { style: 'hair', color: { argb: 'FFF3F4F6' } }, left: sides, right: sides };
      });
    };

    // ── Title block ──
    mergedRow('CEILAO INSURANCE BROKERS (PVT) LTD', RED, WHITE, 15, 30, 'center');
    mergedRow('INSURANCE BROKING & RISK MANAGEMENT  ·  Sri Lanka', DARK, AMBER, 9, 18, 'center');

    // ── Reference info block ──
    mergedRow('QUOTE COMPARISON REPORT', GREY, DARK, 11, 22, 'center');
    mergedRow(`Reference: ${quote.reference}   |   Product: ${product?.label || ''}   |   Date: ${today}`, GREY, 'FF6B7280', 9, 16, 'center');

    // Spacer
    const sp0 = ws.addRow(Array(colCount).fill(''));
    sp0.height = 4;

    // ── Company header row ──
    const compRow = ws.addRow(['FIELD', ...responses.map(r => r.company_name + (r.edited_by_broker ? ' ✎' : ''))]);
    compRow.height = 24;
    compRow.eachCell((cell, ci) => {
      cell.fill      = { type: 'pattern', pattern: 'solid', fgColor: { argb: ci === 1 ? DARK : RED } };
      cell.font      = { bold: true, color: { argb: AMBER }, size: 10, name: 'Calibri' };
      cell.alignment = { horizontal: ci === 1 ? 'left' : 'center', vertical: 'middle', indent: ci === 1 ? 2 : 0 };
      cell.border    = { bottom: { style: 'medium', color: { argb: RED } } };
    });

    // ── Premium Breakdown ──
    addSection('PREMIUM BREAKDOWN');
    [
      ['Basic Premium (LKR)',  'basic_premium'],
      ['SRCC (LKR)',           'srcc_premium'],
      ['TC (LKR)',             'tc_premium'],
      ['Admin Fee (LKR)',      'admin_fee'],
      ['VAT (LKR)',            'vat_amount'],
      ['Other (LKR)',          'other_premium'],
    ].forEach(([label, key], i) => addDataRow(label, responses.map(r => r[key] ? Number(r[key]).toLocaleString() : '—'), false, false, i));
    addDataRow('TOTAL PREMIUM (LKR)', responses.map(r => Number(r.premium || 0).toLocaleString()), true);

    // ── Deductibles & Validity ──
    addSection('DEDUCTIBLES, EXCESSES & VALIDITY');
    addDataRow('Deductibles',    responses.map(r => r.deductible    || '—'), false, false, 0);
    addDataRow('Excesses',       responses.map(r => r.excesses      || '—'), false, false, 1);
    addDataRow('Validity (days)',responses.map(r => r.validity_days  || '—'), false, false, 2);

    // ── Commission (broker only) ──
    addSection('COMMISSION — INTERNAL USE ONLY');
    addDataRow('Commission Type', responses.map(r => r.commission_type || '—'), false, true, 0);

    // ── Covers Required ──
    if (coverFields.length > 0) {
      addSection('COVERS REQUIRED');
      coverFields.forEach((f, i) => {
        const vals = responses.map(r => {
          const cr = r.cover_responses?.[f.name];
          return cr?.provided ? `${cr.provided}${cr.terms ? ` — ${cr.terms}` : ''}` : '—';
        });
        addDataRow(f.label, vals, false, false, i);
      });
    }

    // ── Additional Clauses ──
    if (clauseFields.length > 0) {
      addSection('ADDITIONAL CLAUSES');
      clauseFields.forEach((f, i) => {
        const vals = responses.map(r => {
          const cr = r.clause_responses?.[f.name];
          return cr?.provided ? `${cr.provided}${cr.terms ? ` — ${cr.terms}` : ''}` : '—';
        });
        addDataRow(f.label, vals, false, false, i);
      });
    }

    // ── Notes ──
    addSection('NOTES / TERMS & CONDITIONS');
    addDataRow('Notes', responses.map(r => r.notes || '—'), false, false, 0);

    // ── Insurer quote documents ──
    addSection('UPLOADED QUOTATION DOCUMENTS');
    addDataRow('Document Link', responses.map(r => r.quote_file_url ? r.quote_file_url : 'Not uploaded'), false, false, 0);
    // Make the document link cells actual hyperlinks
    const docRow = ws.lastRow;
    responses.forEach((r, ci) => {
      if (r.quote_file_url) {
        const cell = docRow.getCell(ci + 2);
        cell.value = { text: 'Open Document ↗', hyperlink: r.quote_file_url, tooltip: r.quote_file_url };
        cell.font  = { ...cell.font, color: { argb: 'FF6366F1' }, underline: true };
      }
    });

    ws.addRow([]);

    // ── Footer ──
    const foot1 = ws.addRow([`Ceilao Insurance Brokers (Pvt) Ltd  ·  Insurance Broking & Risk Management  ·  Sri Lanka`, ...responses.map(() => '')]);
    ws.mergeCells(foot1.number, 1, foot1.number, colCount);
    foot1.height = 16;
    foot1.getCell(1).fill      = { type: 'pattern', pattern: 'solid', fgColor: { argb: DARK } };
    foot1.getCell(1).font      = { size: 9, color: { argb: AMBER }, name: 'Calibri' };
    foot1.getCell(1).alignment = { horizontal: 'center', vertical: 'middle' };

    const foot2 = ws.addRow([`CONFIDENTIAL — This comparison report is prepared for internal use. Commission details are not shared with clients.`, ...responses.map(() => '')]);
    ws.mergeCells(foot2.number, 1, foot2.number, colCount);
    foot2.height = 14;
    foot2.getCell(1).fill      = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF374151' } };
    foot2.getCell(1).font      = { size: 8, color: { argb: 'FFD1D5DB' }, italic: true, name: 'Calibri' };
    foot2.getCell(1).alignment = { horizontal: 'center', vertical: 'middle' };

    const buf  = await wb.xlsx.writeBuffer();
    const blob = new Blob([buf], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
    const dlUrl = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = dlUrl;
    a.download = `CeilaoIB_Comparison_${quote.reference}.xlsx`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(() => URL.revokeObjectURL(dlUrl), 1000);
    } catch (err) {
      console.error('Excel export error:', err);
      setExportError(err?.message || 'Excel export failed — please try again.');
    }
    setExportingExcel(false);
  };

  // ── Export PDF (broker) ─────────────────────────────────────────────────────
  const exportPdf = async () => {
    setExportingPdf(true);
    setExportError('');
    try {
    const { default: jsPDF }     = await import('jspdf');
    const { default: autoTable } = await import('jspdf-autotable');

    const pdf = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
    const pw  = pdf.internal.pageSize.getWidth();
    const ph  = pdf.internal.pageSize.getHeight();

    const drawHeader = () => {
      // Dark top band
      pdf.setFillColor(26, 26, 46);
      pdf.rect(0, 0, pw, 20, 'F');
      // Red accent line
      pdf.setFillColor(255, 90, 90);
      pdf.rect(0, 20, pw, 3, 'F');
      pdf.setTextColor(255, 139, 90);
      pdf.setFontSize(13); pdf.setFont('helvetica', 'bold');
      pdf.text('CEILAO INSURANCE BROKERS (PVT) LTD', pw / 2, 9, { align: 'center' });
      pdf.setFontSize(8); pdf.setFont('helvetica', 'normal');
      pdf.setTextColor(148, 163, 184);
      pdf.text('INSURANCE BROKING & RISK MANAGEMENT  ·  SRI LANKA', pw / 2, 15, { align: 'center' });
    };

    const drawFooter = () => {
      const pn = pdf.internal.getCurrentPageInfo().pageNumber;
      const tp = pdf.internal.getNumberOfPages();
      pdf.setFillColor(26, 26, 46);
      pdf.rect(0, ph - 14, pw, 14, 'F');
      pdf.setFillColor(255, 90, 90);
      pdf.rect(0, ph - 14, pw, 1, 'F');
      // left: company
      pdf.setFont('helvetica', 'bold'); pdf.setFontSize(8); pdf.setTextColor(255, 139, 90);
      pdf.text('Ceilao Insurance Brokers (Pvt) Ltd', 12, ph - 8);
      // centre: confidential
      pdf.setFont('helvetica', 'normal'); pdf.setFontSize(7.5); pdf.setTextColor(148, 163, 184);
      pdf.text('CONFIDENTIAL  ·  Commission details for internal broker use only', pw / 2, ph - 8, { align: 'center' });
      // right: page
      pdf.setTextColor(107, 114, 128);
      pdf.text(`Page ${pn} / ${tp}`, pw - 12, ph - 8, { align: 'right' });
      // bottom line
      pdf.setFont('helvetica', 'italic'); pdf.setFontSize(6.5); pdf.setTextColor(100, 116, 139);
      pdf.text(`Generated: ${today}`, 12, ph - 3.5);
      pdf.text('Insurance Broking & Risk Management  ·  Sri Lanka', pw - 12, ph - 3.5, { align: 'right' });
    };

    drawHeader();

    // Info band (page 1 only)
    pdf.setFillColor(249, 250, 251);
    pdf.rect(0, 23, pw, 12, 'F');
    pdf.setFontSize(10); pdf.setFont('helvetica', 'bold');
    pdf.setTextColor(26, 26, 46);
    pdf.text('QUOTE COMPARISON REPORT', 14, 31);
    pdf.setFont('helvetica', 'normal'); pdf.setFontSize(8);
    pdf.setTextColor(107, 114, 128);
    pdf.text(`Ref: ${quote.reference}   ·   ${product?.label || ''}   ·   ${today}`, pw - 14, 31, { align: 'right' });

    // Build table body
    const mkSectionRow = (label) => [{ content: label, colSpan: colCount, styles: { fillColor: [26,26,46], textColor: [255,139,90], fontStyle: 'bold', fontSize: 8, cellPadding: { top: 3, bottom: 3, left: 4, right: 4 } } }];
    const mkRow = (label, vals, isTotal = false, isInternal = false, i = 0) => [
      { content: label, styles: { fontStyle: isTotal ? 'bold' : 'normal', fontSize: isTotal ? 9 : 8.5, fillColor: isTotal ? [255,90,90] : isInternal ? [232,232,255] : i%2===0 ? [255,255,255] : [255,248,245], textColor: isTotal ? [255,255,255] : isInternal ? [67,56,202] : [26,26,46] } },
      ...vals.map(v => ({ content: v, styles: { halign: 'center', fontStyle: isTotal ? 'bold' : 'normal', fontSize: isTotal ? 9 : 8.5, fillColor: isTotal ? [255,90,90] : isInternal ? [232,232,255] : i%2===0 ? [255,255,255] : [255,248,245], textColor: isTotal ? [255,255,255] : isInternal ? [67,56,202] : [55,65,81] } })),
    ];

    const body = [
      mkSectionRow('PREMIUM BREAKDOWN'),
      ...['basic_premium','srcc_premium','tc_premium','admin_fee','vat_amount','other_premium'].map((k,i) =>
        mkRow(['Basic Premium (LKR)','SRCC (LKR)','TC (LKR)','Admin Fee (LKR)','VAT (LKR)','Other (LKR)'][i],
              responses.map(r => r[k] ? `LKR ${Number(r[k]).toLocaleString()}` : '—'), false, false, i)),
      mkRow('TOTAL PREMIUM (LKR)', responses.map(r => `LKR ${Number(r.premium||0).toLocaleString()}`), true),

      mkSectionRow('DEDUCTIBLES, EXCESSES & VALIDITY'),
      mkRow('Deductibles',    responses.map(r => r.deductible   || '—'), false, false, 0),
      mkRow('Excesses',       responses.map(r => r.excesses     || '—'), false, false, 1),
      mkRow('Validity (days)',responses.map(r => r.validity_days || '—'), false, false, 2),

      mkSectionRow('COMMISSION — INTERNAL USE ONLY'),
      mkRow('Commission Type', responses.map(r => r.commission_type || '—'), false, true, 0),

      ...(coverFields.length > 0 ? [
        mkSectionRow('COVERS REQUIRED'),
        ...coverFields.map((f,i) => mkRow(f.label, responses.map(r => {
          const cr = r.cover_responses?.[f.name]; return cr?.provided ? `${cr.provided}${cr.terms ? `\n${cr.terms}` : ''}` : '—';
        }), false, false, i)),
      ] : []),

      ...(clauseFields.length > 0 ? [
        mkSectionRow('ADDITIONAL CLAUSES'),
        ...clauseFields.map((f,i) => mkRow(f.label, responses.map(r => {
          const cr = r.clause_responses?.[f.name]; return cr?.provided ? `${cr.provided}${cr.terms ? `\n${cr.terms}` : ''}` : '—';
        }), false, false, i)),
      ] : []),

      mkSectionRow('NOTES / TERMS & CONDITIONS'),
      mkRow('Notes', responses.map(r => r.notes || '—'), false, false, 0),
    ];

    autoTable(pdf, {
      startY: 38,
      head: [[
        { content: 'Field', styles: { fillColor: [26,26,46], textColor: [255,139,90], fontStyle: 'bold', fontSize: 9 } },
        ...responses.map(r => ({ content: r.company_name + (r.edited_by_broker ? '\n✎ Broker Edited' : ''), styles: { fillColor: [255,90,90], textColor: [255,255,255], fontStyle: 'bold', fontSize: 9, halign: 'center' } })),
      ]],
      body,
      columnStyles: { 0: { cellWidth: 52 } },
      styles: { fontSize: 8.5, cellPadding: { top: 3.5, bottom: 3.5, left: 5, right: 5 }, overflow: 'linebreak', minCellHeight: 9 },
      margin: { left: 10, right: 10, top: 28, bottom: 18 },
      didDrawPage: (data) => {
        if (data.pageNumber > 1) drawHeader();
        drawFooter();
      },
    });

    // ── Insurer Quote Documents Page ───────────────────────────────────────────
    const insurerDocs = responses.filter(r => r.quote_file_url);
    if (insurerDocs.length > 0) {
      pdf.addPage();
      drawHeader();

      const margL = 12, usableW = pw - 24;
      const cols  = Math.min(insurerDocs.length, 3);
      const gap   = 8;
      const colW  = (usableW - gap * (cols - 1)) / cols;
      const imgMaxH = 140;
      let curDocY = 30;

      // Section header
      pdf.setFillColor(26, 26, 46);
      pdf.rect(margL, curDocY, usableW, 10, 'F');
      pdf.setFontSize(9); pdf.setFont('helvetica', 'bold'); pdf.setTextColor(255, 139, 90);
      pdf.text('INSURER UPLOADED QUOTE DOCUMENTS', pw / 2, curDocY + 6.5, { align: 'center' });
      curDocY += 14;

      for (let di = 0; di < insurerDocs.length; di++) {
        const r   = insurerDocs[di];
        const url = r.quote_file_url;
        const col = di % cols;
        if (di > 0 && col === 0) curDocY += imgMaxH + 20;
        const cx = margL + col * (colW + gap);

        // Company name label
        pdf.setFontSize(9); pdf.setFont('helvetica', 'bold'); pdf.setTextColor(26, 26, 46);
        pdf.text(r.company_name, cx + colW / 2, curDocY + 6, { align: 'center', maxWidth: colW });

        const imgBoxY = curDocY + 10;
        const isImg = /\.(jpg|jpeg|png|webp|gif)(\?|$)/i.test(url) || url.includes('/image/upload/');

        pdf.setFillColor(245, 247, 250);
        pdf.rect(cx, imgBoxY, colW, imgMaxH, 'F');
        pdf.setDrawColor(210, 215, 225); pdf.setLineWidth(0.3);
        pdf.rect(cx, imgBoxY, colW, imgMaxH, 'S');

        if (isImg) {
          try {
            const b64 = await fetchBase64(url);
            if (!b64.startsWith('data:image/')) throw new Error('not an image');
            const dims = await new Promise(res => {
              const img = new window.Image();
              img.onload  = () => res({ w: img.naturalWidth, h: img.naturalHeight });
              img.onerror = () => res({ w: 4, h: 3 });
              img.src = b64;
            });
            const aspect = dims.w / dims.h;
            const bW = colW - 6, bH = imgMaxH - 6;
            let dw = bW, dh = dw / aspect;
            if (dh > bH) { dh = bH; dw = dh * aspect; }
            const fmt = /\.png(\?|$)/i.test(url) ? 'PNG' : 'JPEG';
            pdf.addImage(b64, fmt, cx + (colW - dw) / 2, imgBoxY + (imgMaxH - dh) / 2, dw, dh, undefined, 'FAST');
          } catch {
            pdf.setFontSize(7.5); pdf.setTextColor(180, 180, 190);
            pdf.text('Image unavailable', cx + colW / 2, imgBoxY + imgMaxH / 2, { align: 'center' });
          }
        } else {
          pdf.setFontSize(9); pdf.setFont('helvetica', 'bold'); pdf.setTextColor(99, 102, 241);
          pdf.text('PDF DOCUMENT', cx + colW / 2, imgBoxY + imgMaxH / 2 - 4, { align: 'center' });
          pdf.setFontSize(7); pdf.setFont('helvetica', 'normal'); pdf.setTextColor(120, 124, 180);
          pdf.text('Open via digital copy', cx + colW / 2, imgBoxY + imgMaxH / 2 + 4, { align: 'center' });
        }
      }
      drawFooter();
    }

    pdf.save(`CeilaoIB_Comparison_${quote.reference}.pdf`);
    } catch (err) {
      console.error('PDF export error:', err);
      setExportError(err?.message || 'PDF export failed — please try again.');
    }
    setExportingPdf(false);
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
        <Button variant="outlined" size="small"
          startIcon={exportingExcel ? <CircularProgress size={12} color="inherit" /> : <FileDownloadOutlinedIcon />}
          onClick={exportExcel} disabled={exportingExcel}
          sx={{ fontSize: 12, borderColor: 'rgba(255,139,90,0.3)', color: '#FF8B5A' }}>
          {exportingExcel ? 'Exporting…' : 'Export Excel'}
        </Button>
        <Button variant="outlined" size="small"
          startIcon={exportingPdf ? <CircularProgress size={12} color="inherit" /> : <FileDownloadOutlinedIcon />}
          onClick={exportPdf} disabled={exportingPdf}
          sx={{ fontSize: 12, borderColor: 'rgba(99,102,241,0.3)', color: '#6366f1' }}>
          {exportingPdf ? 'Generating PDF…' : 'Export PDF'}
        </Button>
      </Stack>
      {exportError && (
        <Alert severity="error" sx={{ mb: 2, fontSize: 12 }} onClose={() => setExportError('')}>
          {exportError}
        </Alert>
      )}

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
      {sendError && (
        <Alert severity="error" sx={{ mb: 2, fontSize: 12 }}>
          Email failed: {sendError}
        </Alert>
      )}

      {/* Customer selection indicator */}
      {quote.customer_selection && (
        <Alert icon="🏆" severity="success" sx={{ mb: 2.5, fontWeight: 600, fontSize: 13 }}>
          <strong>Customer's Preferred Insurer: {quote.customer_selection.company_name}</strong>
          <Box component="span" sx={{ ml: 1.5, fontSize: 12, color: '#4B5563', fontWeight: 400 }}>
            — selected on {new Date(quote.customer_selection.selected_at).toLocaleString('en-GB', { day:'numeric', month:'short', year:'numeric', hour:'2-digit', minute:'2-digit' })}
          </Box>
        </Alert>
      )}

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
                {responses.map(r => {
                  const isSelected = quote.customer_selection?.company_id === r.company_id;
                  return (
                  <TableCell key={r.id} align="center" sx={{ fontWeight: 700, minWidth: 160, bgcolor: isSelected ? 'rgba(16,185,129,0.06)' : 'transparent' }}>
                    <Box>
                      <Typography sx={{ fontWeight: 800, fontSize: 13 }}>{r.company_name}</Typography>
                      {isSelected && <Box component="span" sx={{ fontSize: 10, color: '#059669', fontWeight: 700, bgcolor: 'rgba(16,185,129,0.12)', px: 1, py: 0.2, borderRadius: '10px', display: 'inline-block', mt: 0.3 }}>🏆 Customer's Choice</Box>}

                      {r.quote_file_url && (
                        <Button size="small" onClick={() => openFile(r.quote_file_url)}
                          sx={{ fontSize: 10, p: 0, color: '#6366f1', minWidth: 'auto' }}>
                          View Quote ↗
                        </Button>
                      )}
                    </Box>
                  </TableCell>
                  );
                })}
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
              {/* Deductibles & Excesses & Validity */}
              {[
                { key: 'deductible',   label: 'Deductibles' },
                { key: 'excesses',     label: 'Excesses' },
                { key: 'validity_days', label: 'Validity (days)' },
              ].map((row, i) => (
                <TableRow key={row.key} sx={{ bgcolor: i % 2 === 0 ? 'rgba(107,114,128,0.04)' : '#fff' }}>
                  <TableCell sx={{ fontWeight: 600, color: '#374151', fontSize: 12.5 }}>{row.label}</TableCell>
                  {responses.map(r => (
                    <TableCell key={r.id} align="center" sx={{ fontSize: 12.5, color: '#4B5563' }}>
                      {r[row.key] || '—'}
                    </TableCell>
                  ))}
                </TableRow>
              ))}

              {/* Covers Required */}
              {coverFields.length > 0 && (
                <>
                  <TableRow>
                    <TableCell colSpan={responses.length + 1}
                      sx={{ background: '#1A1A2E', color: '#FF8B5A', fontWeight: 800, fontSize: 11, letterSpacing: 1, textTransform: 'uppercase', py: 1.2 }}>
                      Covers Required
                    </TableCell>
                  </TableRow>
                  {coverFields.map((f, i) => (
                    <TableRow key={f.name} sx={{ bgcolor: i % 2 === 0 ? '#fff' : 'rgba(255,248,245,0.5)' }}>
                      <TableCell sx={{ fontWeight: 600, color: '#374151', fontSize: 12.5, pl: 3 }}>{f.label}</TableCell>
                      {responses.map(r => {
                        const cr = r.cover_responses?.[f.name];
                        const p = cr?.provided || '';
                        return (
                          <TableCell key={r.id} align="center">
                            {p ? (
                              <Box>
                                <Box component="span" sx={{
                                  display: 'inline-block', px: 1.2, py: 0.3, borderRadius: '12px', fontSize: 11.5, fontWeight: 700,
                                  bgcolor: p === 'Yes' ? 'rgba(16,185,129,0.12)' : 'rgba(239,68,68,0.10)',
                                  color: p === 'Yes' ? '#059669' : '#dc2626',
                                }}>{p}</Box>
                                {cr?.terms && <Typography sx={{ fontSize: 10, color: '#9CA3AF', mt: 0.3, maxWidth: 160 }}>{cr.terms}</Typography>}
                              </Box>
                            ) : <Typography sx={{ color: '#D1D5DB', fontSize: 13 }}>—</Typography>}
                          </TableCell>
                        );
                      })}
                    </TableRow>
                  ))}
                </>
              )}

              {/* Additional Clauses */}
              {clauseFields.length > 0 && (
                <>
                  <TableRow>
                    <TableCell colSpan={responses.length + 1}
                      sx={{ background: '#1A1A2E', color: '#FF8B5A', fontWeight: 800, fontSize: 11, letterSpacing: 1, textTransform: 'uppercase', py: 1.2 }}>
                      Additional Clauses
                    </TableCell>
                  </TableRow>
                  {clauseFields.map((f, i) => (
                    <TableRow key={f.name} sx={{ bgcolor: i % 2 === 0 ? '#fff' : 'rgba(255,248,245,0.5)' }}>
                      <TableCell sx={{ fontWeight: 600, color: '#374151', fontSize: 12.5, pl: 3 }}>{f.label}</TableCell>
                      {responses.map(r => {
                        const cr = r.clause_responses?.[f.name];
                        const p = cr?.provided || '';
                        return (
                          <TableCell key={r.id} align="center">
                            {p ? (
                              <Box>
                                <Box component="span" sx={{
                                  display: 'inline-block', px: 1.2, py: 0.3, borderRadius: '12px', fontSize: 11.5, fontWeight: 700,
                                  bgcolor: p === 'Yes' ? 'rgba(16,185,129,0.12)' : 'rgba(239,68,68,0.10)',
                                  color: p === 'Yes' ? '#059669' : '#dc2626',
                                }}>{p}</Box>
                                {cr?.terms && <Typography sx={{ fontSize: 10, color: '#9CA3AF', mt: 0.3, maxWidth: 160 }}>{cr.terms}</Typography>}
                              </Box>
                            ) : <Typography sx={{ color: '#D1D5DB', fontSize: 13 }}>—</Typography>}
                          </TableCell>
                        );
                      })}
                    </TableRow>
                  ))}
                </>
              )}

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
                            <Box component="a" href={r.quote_file_url} onClick={e => { e.preventDefault(); openFile(r.quote_file_url); }} rel="noopener noreferrer">
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
                            component="a" href={r.quote_file_url} onClick={e => { e.preventDefault(); openFile(r.quote_file_url); }}
                            target="_blank"
                            sx={{ bgcolor: 'rgba(99,102,241,0.10)', color: '#6366f1', fontWeight: 600, fontSize: 11 }} />
                        </Box>
                      ) : <Typography sx={{ fontSize: 12, color: '#9CA3AF' }}>Not uploaded</Typography>}
                    </TableCell>
                  );
                })}
              </TableRow>
              {/* Broker edit row */}
              <TableRow sx={{ bgcolor: 'rgba(99,102,241,0.04)' }}>
                <TableCell sx={{ fontWeight: 700, color: '#6366f1' }}>Edit Response</TableCell>
                {responses.map(r => (
                  <TableCell key={r.id} align="center">
                    <Button size="small" variant="outlined"
                      onClick={() => openEdit(r)}
                      sx={{ fontSize: 11, py: 0.4, borderColor: '#6366f1', color: '#6366f1' }}>
                      ✏️ Edit
                    </Button>
                    {r.edited_by_broker && (
                      <Typography sx={{ fontSize: 9.5, color: '#9CA3AF', mt: 0.3 }}>Broker edited</Typography>
                    )}
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

      {/* ── Broker edit dialog ─────────────────────────────────────────────── */}
      <Dialog open={!!editTarget} onClose={() => setEditTarget(null)} maxWidth="md" fullWidth
        PaperProps={{ sx: { maxHeight: '90vh' } }}>
        <DialogTitle sx={{ pb: 1, fontWeight: 800 }}>
          ✏️ Edit Response — {editTarget?.company_name}
        </DialogTitle>
        <DialogContent dividers sx={{ pt: 2 }}>
          <Alert severity="info" sx={{ mb: 2.5, fontSize: 12 }}>
            All changes are saved directly to the comparison. A "Broker edited" note will appear on this response.
          </Alert>

          {/* Premium Breakdown */}
          <Typography sx={{ fontSize: 11, fontWeight: 800, color: '#FF5A5A', textTransform: 'uppercase', letterSpacing: 1, mb: 1.5 }}>
            Premium Breakdown
          </Typography>
          <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 1.5, mb: 2.5 }}>
            {[
              { key: 'basic_premium', label: 'Basic Premium (LKR)' },
              { key: 'srcc_premium',  label: 'SRCC (LKR)'          },
              { key: 'tc_premium',    label: 'TC (LKR)'             },
              { key: 'admin_fee',     label: 'Admin Fee (LKR)'      },
              { key: 'vat_amount',    label: 'VAT (LKR)'            },
              { key: 'other_premium', label: 'Other (LKR)'          },
            ].map(({ key, label }) => (
              <TextField key={key} size="small" fullWidth label={label} type="number"
                value={editForm[key] || ''}
                onChange={e => setEditForm(f => ({ ...f, [key]: e.target.value }))} />
            ))}
          </Box>

          {/* Deductibles / Excesses / Validity */}
          <Typography sx={{ fontSize: 11, fontWeight: 800, color: '#374151', textTransform: 'uppercase', letterSpacing: 1, mb: 1.5 }}>
            Deductibles, Excesses & Validity
          </Typography>
          <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 1.5, mb: 2.5 }}>
            <TextField size="small" fullWidth label="Deductibles"
              value={editForm.deductible || ''}
              onChange={e => setEditForm(f => ({ ...f, deductible: e.target.value }))} />
            <TextField size="small" fullWidth label="Excesses"
              value={editForm.excesses || ''}
              onChange={e => setEditForm(f => ({ ...f, excesses: e.target.value }))} />
            <TextField size="small" fullWidth label="Validity (days)" type="number"
              value={editForm.validity_days || ''}
              onChange={e => setEditForm(f => ({ ...f, validity_days: e.target.value }))} />
          </Box>

          {/* Commission */}
          <Typography sx={{ fontSize: 11, fontWeight: 800, color: '#6366f1', textTransform: 'uppercase', letterSpacing: 1, mb: 1 }}>
            Commission Type (Broker Only)
          </Typography>
          <Box sx={{ display: 'flex', gap: 1, mb: 2.5 }}>
            {['Standard', 'Special'].map(opt => (
              <Box key={opt} onClick={() => setEditForm(f => ({ ...f, commission_type: opt }))}
                sx={{ flex: 1, py: 1, textAlign: 'center', borderRadius: '8px', cursor: 'pointer',
                  border: `1.5px solid ${editForm.commission_type === opt ? '#6366f1' : 'rgba(0,0,0,0.12)'}`,
                  bgcolor: editForm.commission_type === opt ? 'rgba(99,102,241,0.08)' : 'transparent',
                  color: editForm.commission_type === opt ? '#6366f1' : '#6B7280',
                  fontWeight: editForm.commission_type === opt ? 700 : 400, fontSize: 13 }}>
                {opt}
              </Box>
            ))}
          </Box>

          {/* Covers Required */}
          {coverFields.length > 0 && (
            <>
              <Typography sx={{ fontSize: 11, fontWeight: 800, color: '#374151', textTransform: 'uppercase', letterSpacing: 1, mb: 1.5 }}>
                Covers Required
              </Typography>
              <Box sx={{ border: '1px solid rgba(0,0,0,0.08)', borderRadius: '10px', overflow: 'hidden', mb: 2.5 }}>
                {coverFields.map((f, i) => {
                  const cr = editCoverResp[f.name] || { provided: '', terms: '' };
                  return (
                    <Box key={f.name} sx={{ display: 'grid', gridTemplateColumns: '1fr 110px 1fr', gap: 1.5, alignItems: 'center', p: 1.2, bgcolor: i % 2 === 0 ? '#fff' : 'rgba(255,248,245,0.5)', borderBottom: i < coverFields.length - 1 ? '1px solid rgba(0,0,0,0.05)' : 'none' }}>
                      <Typography sx={{ fontSize: 13, fontWeight: 600, color: '#374151' }}>{f.label}</Typography>
                      <Select size="small" value={cr.provided} displayEmpty fullWidth
                        onChange={e => setECover(f.name, 'provided', e.target.value)}>
                        <MenuItem value="">—</MenuItem>
                        <MenuItem value="Yes">Yes</MenuItem>
                        <MenuItem value="No">No</MenuItem>
                      </Select>
                      <TextField size="small" placeholder="Special terms…" fullWidth
                        value={cr.terms}
                        onChange={e => setECover(f.name, 'terms', e.target.value)}
                        sx={{ '& .MuiInputBase-root': { fontSize: 12 } }} />
                    </Box>
                  );
                })}
              </Box>
            </>
          )}

          {/* Additional Clauses */}
          {clauseFields.length > 0 && (
            <>
              <Typography sx={{ fontSize: 11, fontWeight: 800, color: '#374151', textTransform: 'uppercase', letterSpacing: 1, mb: 1.5 }}>
                Additional Clauses
              </Typography>
              <Box sx={{ border: '1px solid rgba(0,0,0,0.08)', borderRadius: '10px', overflow: 'hidden', mb: 2.5 }}>
                {clauseFields.map((f, i) => {
                  const cr = editClauseResp[f.name] || { provided: '', terms: '' };
                  return (
                    <Box key={f.name} sx={{ display: 'grid', gridTemplateColumns: '1fr 110px 1fr', gap: 1.5, alignItems: 'center', p: 1.2, bgcolor: i % 2 === 0 ? '#fff' : 'rgba(255,248,245,0.5)', borderBottom: i < clauseFields.length - 1 ? '1px solid rgba(0,0,0,0.05)' : 'none' }}>
                      <Typography sx={{ fontSize: 13, fontWeight: 600, color: '#374151' }}>{f.label}</Typography>
                      <Select size="small" value={cr.provided} displayEmpty fullWidth
                        onChange={e => setEClause(f.name, 'provided', e.target.value)}>
                        <MenuItem value="">—</MenuItem>
                        <MenuItem value="Yes">Yes</MenuItem>
                        <MenuItem value="No">No</MenuItem>
                      </Select>
                      <TextField size="small" placeholder="Terms…" fullWidth
                        value={cr.terms}
                        onChange={e => setEClause(f.name, 'terms', e.target.value)}
                        sx={{ '& .MuiInputBase-root': { fontSize: 12 } }} />
                    </Box>
                  );
                })}
              </Box>
            </>
          )}

          {/* Notes */}
          <Typography sx={{ fontSize: 11, fontWeight: 800, color: '#374151', textTransform: 'uppercase', letterSpacing: 1, mb: 1 }}>
            Notes / Terms & Conditions
          </Typography>
          <TextField size="small" fullWidth multiline rows={3}
            value={editForm.notes || ''}
            onChange={e => setEditForm(f => ({ ...f, notes: e.target.value }))} />
        </DialogContent>
        <DialogActions sx={{ px: 3, py: 2, gap: 1 }}>
          <Button variant="outlined" onClick={() => setEditTarget(null)}
            sx={{ borderColor: '#e0e0e0', color: '#6B7280' }}>Cancel</Button>
          <Button variant="contained" onClick={saveEdit} disabled={editSaving}
            sx={{ background: 'linear-gradient(135deg,#6366f1,#818cf8)', minWidth: 130 }}>
            {editSaving ? 'Saving…' : 'Save All Changes'}
          </Button>
        </DialogActions>
      </Dialog>
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
  const [draftBanner,    setDraftBanner]    = useState(null); // { product, formValues, savedAt }
  const [hasDraft,       setHasDraft]       = useState(() => {
    try { const s = localStorage.getItem(DRAFT_KEY); return !!(s && Object.keys(JSON.parse(s).formValues || {}).length > 0); }
    catch (_) { return false; }
  });
  const draftTimerRef  = useRef(null);
  const formValuesRef  = useRef(formValues);
  const productRef     = useRef(product);
  useEffect(() => { formValuesRef.current = formValues; }, [formValues]);
  useEffect(() => { productRef.current = product; }, [product]);

  const flushDraftSave = useCallback(() => {
    if (Object.keys(formValuesRef.current).length === 0) return;
    try {
      localStorage.setItem(DRAFT_KEY, JSON.stringify({ product: productRef.current, formValues: formValuesRef.current, savedAt: new Date().toISOString() }));
      setHasDraft(true);
    } catch (_) {}
  }, []);

  // Auto-save draft to localStorage while form is open
  useEffect(() => {
    if (!newQuoteOpen) return;
    if (Object.keys(formValues).length === 0) return;
    clearTimeout(draftTimerRef.current);
    draftTimerRef.current = setTimeout(() => {
      try {
        localStorage.setItem(DRAFT_KEY, JSON.stringify({ product, formValues, savedAt: new Date().toISOString() }));
        setHasDraft(true);
      } catch (_) {}
    }, 800);
    return () => clearTimeout(draftTimerRef.current);
  }, [formValues, product, newQuoteOpen]);

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
      setDraftBanner(null);
      setHasDraft(false);
      try { localStorage.removeItem(DRAFT_KEY); } catch (_) {}
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
          <Stack direction="row" spacing={1} alignItems="center" sx={{ mt: { xs: 1.5, sm: 0 } }}>
            {hasDraft && (
              <Chip
                label="Resume draft"
                size="small"
                onClick={() => {
                  try {
                    const saved = localStorage.getItem(DRAFT_KEY);
                    if (saved) {
                      const parsed = JSON.parse(saved);
                      setDraftBanner(parsed);
                      setProduct(parsed.product || 'fire');
                      setFormValues({});
                      setNewQuoteOpen(true);
                    }
                  } catch (_) {}
                }}
                sx={{
                  fontWeight: 700, fontSize: 12, cursor: 'pointer',
                  bgcolor: 'rgba(59,130,246,0.10)', color: '#2563eb',
                  border: '1.5px solid rgba(59,130,246,0.30)',
                  '&:hover': { bgcolor: 'rgba(59,130,246,0.18)' },
                }}
                icon={<span style={{ fontSize: 14, marginLeft: 6 }}>💾</span>}
              />
            )}
            <Button variant="contained" startIcon={<AddIcon />} onClick={() => {
              try {
                const saved = localStorage.getItem(DRAFT_KEY);
                if (saved) {
                  const parsed = JSON.parse(saved);
                  if (parsed && Object.keys(parsed.formValues || {}).length > 0) {
                    setDraftBanner(parsed);
                    setProduct(parsed.product || 'fire');
                    setFormValues({});
                    setNewQuoteOpen(true);
                    return;
                  }
                }
              } catch (_) {}
              setDraftBanner(null);
              setFormValues({});
              setNewQuoteOpen(true);
            }}>
              New Quote Request
            </Button>
          </Stack>
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
        <Dialog open={newQuoteOpen} onClose={() => { flushDraftSave(); setNewQuoteOpen(false); }} maxWidth="md" fullWidth>
          <DialogTitle>
            New Quote Request
          </DialogTitle>
          <DialogContent sx={{ pt: 2.5 }}>
            {/* Draft restore banner */}
            {draftBanner && (
              <Alert
                severity="info"
                sx={{ mb: 2.5, fontSize: 13, alignItems: 'center', '& .MuiAlert-message': { width: '100%' } }}
                icon={<span style={{ fontSize: 18 }}>💾</span>}
              >
                <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 1 }}>
                  <Box>
                    <Typography sx={{ fontWeight: 700, fontSize: 13, color: '#1e40af' }}>Unsaved draft found</Typography>
                    <Typography sx={{ fontSize: 12, color: '#3b82f6' }}>
                      {PRODUCTS[draftBanner.product]?.label || draftBanner.product} · saved {new Date(draftBanner.savedAt).toLocaleString('en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}
                    </Typography>
                  </Box>
                  <Stack direction="row" spacing={1}>
                    <Button size="small" variant="contained"
                      sx={{ fontSize: 12, background: 'linear-gradient(135deg,#3b82f6,#2563eb)', boxShadow: 'none', py: 0.5 }}
                      onClick={() => {
                        setProduct(draftBanner.product || 'fire');
                        setFormValues(draftBanner.formValues || {});
                        setFieldErrors({});
                        setDraftBanner(null);
                      }}>
                      Restore Draft
                    </Button>
                    <Button size="small" variant="outlined"
                      sx={{ fontSize: 12, borderColor: '#93c5fd', color: '#2563eb', py: 0.5 }}
                      onClick={() => {
                        setDraftBanner(null);
                        setFormValues({});
                        setHasDraft(false);
                        try { localStorage.removeItem(DRAFT_KEY); } catch (_) {}
                      }}>
                      Start Fresh
                    </Button>
                  </Stack>
                </Box>
              </Alert>
            )}
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
            <Button onClick={() => { flushDraftSave(); setNewQuoteOpen(false); }} variant="outlined"
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
