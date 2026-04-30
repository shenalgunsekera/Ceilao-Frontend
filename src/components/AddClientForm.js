import React, { useState } from 'react';
import { collection, addDoc, doc, updateDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../firebase';
import { uploadToCloudinary } from '../cloudinary';

import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';
import Grid from '@mui/material/Grid';
import MenuItem from '@mui/material/MenuItem';
import Select from '@mui/material/Select';
import InputLabel from '@mui/material/InputLabel';
import FormControl from '@mui/material/FormControl';
import FormHelperText from '@mui/material/FormHelperText';
import LinearProgress from '@mui/material/LinearProgress';
import Alert from '@mui/material/Alert';
import Link from '@mui/material/Link';
import { LocalizationProvider, DatePicker } from '@mui/x-date-pickers';
import { AdapterDateFns } from '@mui/x-date-pickers/AdapterDateFns';

import CloudUploadOutlinedIcon from '@mui/icons-material/CloudUploadOutlined';
import CheckCircleOutlinedIcon from '@mui/icons-material/CheckCircleOutlined';

/* ── field definitions ────────────────────────────────────────────────── */
const docFields = [
  { label: 'Policyholder',     doc: 'policyholder_doc_url',     text: 'policyholder_text' },
  { label: 'Proposal Form',    doc: 'proposal_form_doc_url',    text: 'proposal_form_text' },
  { label: 'Quotation',        doc: 'quotation_doc_url',        text: 'quotation_text' },
  { label: 'CR Copy',          doc: 'cr_copy_doc_url',          text: 'cr_copy_text' },
  { label: 'Schedule',         doc: 'schedule_doc_url',         text: 'schedule_text' },
  { label: 'Invoice / Debit',  doc: 'invoice_doc_url',          text: 'invoice_text' },
  { label: 'Payment Receipt',  doc: 'payment_receipt_doc_url',  text: 'payment_receipt_text' },
  { label: 'NIC / BR',         doc: 'nic_br_doc_url',           text: 'nic_br_text' },
];

const dropdowns = {
  main_class:         ['Motor','Fire','Marine','Miscellaneous'],
  product:            ['Comprehensive','Third Party','Other'],
  customer_type:      ['Individual','Company'],
  insurance_provider: ['Ceylinco','Janashakthi','Union','Other'],
  branch:             ['Colombo','Kandy','Galle','Other'],
  commission_type:    ['Flat','Percentage','Other'],
};

export const textFields = [
  { label:'Ceilao IB File No.', name:'ceilao_ib_file_no',    section:'General Info' },
  { label:'Vehicle Number',      name:'vehicle_number',        section:'General Info' },
  { label:'Main Class',          name:'main_class',            section:'General Info', dropdown:true },
  { label:'Insurer',             name:'insurer',               section:'General Info' },
  { label:'Introducer Code',     name:'introducer_code',       section:'General Info' },
  { label:'Customer Type',       name:'customer_type',         section:'General Info', dropdown:true, required:true },
  { label:'Product',             name:'product',               section:'General Info', dropdown:true, required:true },
  { label:'Policy',              name:'policy_',               section:'General Info' },
  { label:'Insurance Provider',  name:'insurance_provider',    section:'General Info', dropdown:true, required:true },
  { label:'Branch',              name:'branch',                section:'General Info', dropdown:true },
  { label:'Client Name',         name:'client_name',           section:'General Info', required:true },
  { label:'Street 1',            name:'street1',               section:'Address' },
  { label:'Street 2',            name:'street2',               section:'Address' },
  { label:'City',                name:'city',                  section:'Address' },
  { label:'District',            name:'district',              section:'Address' },
  { label:'Province',            name:'province',              section:'Address' },
  { label:'Telephone',           name:'telephone',             section:'Contact' },
  { label:'Mobile No',           name:'mobile_no',             section:'Contact',  required:true },
  { label:'Contact Person',      name:'contact_person',        section:'Contact' },
  { label:'Email',               name:'email',                 section:'Contact' },
  { label:'Social Media',        name:'social_media',          section:'Contact' },
  { label:'NIC Proof',           name:'nic_proof',             section:'Proofs' },
  { label:'DOB Proof',           name:'dob_proof',             section:'Proofs' },
  { label:'Business Registration',name:'business_registration',section:'Proofs' },
  { label:'SVAT Proof',          name:'svat_proof',            section:'Proofs' },
  { label:'VAT Proof',           name:'vat_proof',             section:'Proofs' },
  { label:'Policy Type',         name:'policy_type',           section:'Policy Details' },
  { label:'Policy No',           name:'policy_no',             section:'Policy Details' },
  { label:'Policy Period From',  name:'policy_period_from',    section:'Policy Details', date:true },
  { label:'Policy Period To',    name:'policy_period_to',      section:'Policy Details', date:true },
  { label:'Coverage',            name:'coverage',              section:'Policy Details' },
  { label:'Sum Insured',         name:'sum_insured',           section:'Financials', type:'number' },
  { label:'Basic Premium',       name:'basic_premium',         section:'Financials', type:'number' },
  { label:'SRCC Premium',        name:'srcc_premium',          section:'Financials', type:'number' },
  { label:'TC Premium',          name:'tc_premium',            section:'Financials', type:'number' },
  { label:'Net Premium',         name:'net_premium',           section:'Financials', type:'number' },
  { label:'Stamp Duty',          name:'stamp_duty',            section:'Financials', type:'number' },
  { label:'Admin Fees',          name:'admin_fees',            section:'Financials', type:'number' },
  { label:'Road Safety Fee',     name:'road_safety_fee',       section:'Financials', type:'number' },
  { label:'Policy Fee',          name:'policy_fee',            section:'Financials', type:'number' },
  { label:'VAT Fee',             name:'vat_fee',               section:'Financials', type:'number' },
  { label:'Total Invoice',       name:'total_invoice',         section:'Financials', type:'number' },
  { label:'Commission Type',     name:'commission_type',       section:'Commission', dropdown:true },
  { label:'Commission Basic',    name:'commission_basic',      section:'Commission', type:'number' },
  { label:'Commission SRCC',     name:'commission_srcc',       section:'Commission', type:'number' },
  { label:'Commission TC',       name:'commission_tc',         section:'Commission', type:'number' },
  { label:'Sales Rep ID',        name:'sales_rep_id',          section:'Other' },
  { label:'Policies',            name:'policies',              section:'Other',     type:'number' },
];

const sections = ['General Info','Address','Contact','Proofs','Policy Details','Financials','Commission','Other'];

const sectionColors = {
  'General Info':'#FF5A5A', Address:'#FF8B5A', Contact:'#FFA95A', Proofs:'#FFD45A',
  'Policy Details':'#10B981', Financials:'#6366f1', Commission:'#8b5cf6', Other:'#6B7280',
};

/* ── file upload box ──────────────────────────────────────────────────── */
function DocUploadBox({ label, fieldName, existing, onFile, progress, uploaded }) {
  const [dragging, setDragging] = useState(false);
  const [fileName, setFileName] = useState('');

  const handleFile = (file) => {
    if (!file) return;
    setFileName(file.name);
    onFile(file);
  };

  return (
    <Box>
      <Box
        onDragOver={e => { e.preventDefault(); setDragging(true); }}
        onDragLeave={() => setDragging(false)}
        onDrop={e => { e.preventDefault(); setDragging(false); handleFile(e.dataTransfer.files[0]); }}
        onClick={() => document.getElementById(`file-${fieldName}`).click()}
        sx={{
          border: `2px dashed ${dragging ? '#FF5A5A' : uploaded ? '#10B981' : 'rgba(255,139,90,0.35)'}`,
          borderRadius: '12px',
          p: 1.5,
          cursor: 'pointer',
          display: 'flex', alignItems: 'center', gap: 1,
          bgcolor: dragging ? 'rgba(255,90,90,0.04)' : uploaded ? 'rgba(16,185,129,0.04)' : '#FAFAFA',
          transition: 'all 0.2s ease',
          '&:hover': { borderColor: '#FF8B5A', bgcolor: 'rgba(255,139,90,0.04)' },
        }}
      >
        {uploaded
          ? <CheckCircleOutlinedIcon sx={{ color: '#10B981', fontSize: 20, flexShrink: 0 }} />
          : <CloudUploadOutlinedIcon sx={{ color: '#FF8B5A', fontSize: 20, flexShrink: 0 }} />
        }
        <Box sx={{ flex: 1, minWidth: 0 }}>
          <Typography sx={{ fontSize: 12, fontWeight: 600, color: '#374151', lineHeight: 1.2 }}>{label}</Typography>
          {fileName
            ? <Typography sx={{ fontSize: 10.5, color: '#10B981', textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap' }}>{fileName}</Typography>
            : existing
              ? <Typography sx={{ fontSize: 10.5, color: '#9CA3AF' }}>Current file saved — drop to replace</Typography>
              : <Typography sx={{ fontSize: 10.5, color: '#9CA3AF' }}>Click or drag to upload (PDF/image)</Typography>
          }
        </Box>
        {existing && !fileName && (
          <Link href={existing} target="_blank" rel="noopener noreferrer"
            onClick={e => e.stopPropagation()}
            sx={{ fontSize: 10.5, color: '#FF8B5A', whiteSpace: 'nowrap', flexShrink: 0 }}>
            View
          </Link>
        )}
      </Box>
      {progress !== null && progress < 100 && (
        <LinearProgress
          variant="determinate" value={progress}
          sx={{ mt: 0.5, borderRadius: '2px', height: 3,
                '& .MuiLinearProgress-bar': { background: 'linear-gradient(90deg,#FF5A5A,#FF8B5A)' } }}
        />
      )}
      <input
        type="file" id={`file-${fieldName}`} accept="application/pdf,image/*"
        style={{ display: 'none' }}
        onChange={e => handleFile(e.target.files[0])}
      />
    </Box>
  );
}

/* ── section header ───────────────────────────────────────────────────── */
function SectionHeader({ title }) {
  return (
    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 2, mt: 0.5 }}>
      <Box sx={{
        width: 4, height: 20, borderRadius: '2px',
        background: `linear-gradient(180deg,${sectionColors[title] || '#FF5A5A'},rgba(0,0,0,0))`,
      }} />
      <Typography sx={{ fontWeight: 700, fontSize: 13, color: '#374151', textTransform: 'uppercase', letterSpacing: 0.6 }}>
        {title}
      </Typography>
      <Box sx={{ flex: 1, height: 1, bgcolor: 'rgba(255,139,90,0.12)' }} />
    </Box>
  );
}

/* ── main form ────────────────────────────────────────────────────────── */
const AddClientForm = ({ onSuccess, onCancel, initialData = {}, isEdit = false }) => {
  const [fields, setFields] = useState(() => {
    const obj = {};
    textFields.forEach(f => { obj[f.name] = initialData[f.name] || ''; });
    docFields.forEach(f => { obj[f.text] = initialData[f.text] || ''; });
    return obj;
  });
  const [dates, setDates]   = useState({
    policy_period_from: initialData.policy_period_from ? new Date(initialData.policy_period_from) : null,
    policy_period_to:   initialData.policy_period_to   ? new Date(initialData.policy_period_to)   : null,
  });
  const [docs,     setDocs]     = useState({});
  const [progress, setProgress] = useState({});
  const [uploaded, setUploaded] = useState({});
  const [saving,   setSaving]   = useState(false);
  const [error,    setError]    = useState('');

  const set = (name, val) => setFields(f => ({ ...f, [name]: val }));

  const handleDate = (name, val) => {
    setDates(d => ({ ...d, [name]: val }));
    set(name, val ? val.toISOString().split('T')[0] : '');
  };

  const handleDocFile = (fieldName, file) => {
    setDocs(d => ({ ...d, [fieldName]: file }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    /* validate required text fields */
    for (const f of textFields.filter(f => f.required)) {
      if (!fields[f.name]?.trim()) { setError(`${f.label} is required`); return; }
    }

    setSaving(true);
    try {
      /* upload docs to Cloudinary */
      const docUrls = {};
      for (const df of docFields) {
        const file = docs[df.doc];
        if (file) {
          const folder = `ceilao/clients/docs`;
          const url = await uploadToCloudinary(file, folder, (pct) => {
            setProgress(p => ({ ...p, [df.doc]: pct }));
          });
          docUrls[df.doc] = url;
          setUploaded(u => ({ ...u, [df.doc]: true }));
        }
      }

      const payload = { ...fields, ...docUrls };

      if (isEdit && initialData.id) {
        const ref = doc(db, 'clients', initialData.id);
        await updateDoc(ref, { ...payload, updated_at: serverTimestamp() });
      } else {
        await addDoc(collection(db, 'clients'), {
          ...payload, created_at: serverTimestamp(), is_active: true,
        });
      }

      onSuccess?.();
    } catch (err) {
      setError(err.message || 'Failed to save client');
    }
    setSaving(false);
  };

  return (
    <LocalizationProvider dateAdapter={AdapterDateFns}>
      <Box component="form" onSubmit={handleSubmit} sx={{ px: 3, py: 2.5, overflow: 'auto' }}>

        {/* ── documents ─────────────────────────────────────── */}
        <SectionHeader title="Documents" />
        <Grid container spacing={1.5} sx={{ mb: 2.5 }}>
          {docFields.map(df => (
            <Grid item xs={12} sm={6} key={df.doc}>
              <DocUploadBox
                label={df.label}
                fieldName={df.doc}
                existing={initialData[df.doc]}
                onFile={file => handleDocFile(df.doc, file)}
                progress={progress[df.doc] ?? null}
                uploaded={!!uploaded[df.doc]}
              />
            </Grid>
          ))}
        </Grid>

        {/* ── text sections ──────────────────────────────────── */}
        {sections.map(section => {
          const sFields = textFields.filter(f => f.section === section);
          if (!sFields.length) return null;
          return (
            <Box key={section} sx={{ mb: 2.5 }}>
              <SectionHeader title={section} />
              <Grid container spacing={2}>
                {sFields.map(f => (
                  <Grid item xs={12} sm={6} md={4} key={f.name}>
                    {f.dropdown ? (
                      <FormControl fullWidth size="small">
                        <InputLabel sx={{ fontSize: 13 }}>{f.label}{f.required ? ' *' : ''}</InputLabel>
                        <Select
                          label={`${f.label}${f.required ? ' *' : ''}`}
                          value={fields[f.name]}
                          onChange={e => set(f.name, e.target.value)}
                          required={!!f.required}
                          sx={{ borderRadius: '10px', fontSize: 13 }}
                        >
                          {dropdowns[f.name]?.map(opt => (
                            <MenuItem key={opt} value={opt} sx={{ fontSize: 13 }}>{opt}</MenuItem>
                          ))}
                        </Select>
                        {f.required && !fields[f.name] && (
                          <FormHelperText error>{f.label} is required</FormHelperText>
                        )}
                      </FormControl>
                    ) : f.date ? (
                      <DatePicker
                        label={f.label}
                        value={dates[f.name]}
                        onChange={val => handleDate(f.name, val)}
                        slotProps={{
                          textField: {
                            fullWidth: true, size: 'small', required: !!f.required,
                            sx: { '& .MuiOutlinedInput-root': { borderRadius: '10px', fontSize: 13 } },
                          },
                        }}
                      />
                    ) : (
                      <TextField
                        label={f.label}
                        value={fields[f.name]}
                        onChange={e => set(f.name, e.target.value)}
                        type={f.type || 'text'}
                        fullWidth size="small"
                        required={!!f.required}
                        sx={{ '& .MuiOutlinedInput-root': { borderRadius: '10px', fontSize: 13 } }}
                      />
                    )}
                  </Grid>
                ))}
                {/* doc description fields in General Info section */}
                {section === 'General Info' && docFields.map(df => (
                  <Grid item xs={12} sm={6} md={4} key={df.text}>
                    <TextField
                      label={`${df.label} Description`}
                      value={fields[df.text]}
                      onChange={e => set(df.text, e.target.value)}
                      fullWidth size="small"
                      sx={{ '& .MuiOutlinedInput-root': { borderRadius: '10px', fontSize: 13 } }}
                    />
                  </Grid>
                ))}
              </Grid>
            </Box>
          );
        })}

        {error && (
          <Alert severity="error" sx={{ mb: 2, borderRadius: '10px' }}>{error}</Alert>
        )}

        {saving && (
          <Box sx={{ mb: 2 }}>
            <Typography sx={{ fontSize: 12, color: '#FF8B5A', mb: 0.5, fontWeight: 600 }}>
              Uploading and saving…
            </Typography>
            <LinearProgress sx={{
              borderRadius: '4px', height: 5,
              '& .MuiLinearProgress-bar': { background: 'linear-gradient(90deg,#FF5A5A,#FF8B5A)' },
            }} />
          </Box>
        )}

        <Box sx={{ display: 'flex', gap: 1.5, pt: 1, justifyContent: 'flex-end', borderTop: '1px solid rgba(255,139,90,0.12)', mt: 1 }}>
          <Button onClick={onCancel} variant="outlined" disabled={saving}
            sx={{ borderColor: '#e0e0e0', color: '#6B7280', '&:hover': { borderColor: '#aaa' } }}>
            Cancel
          </Button>
          <Button type="submit" variant="contained" disabled={saving} sx={{ minWidth: 130 }}>
            {saving ? 'Saving…' : isEdit ? 'Update Client' : 'Add Client'}
          </Button>
        </Box>
      </Box>
    </LocalizationProvider>
  );
};

export default AddClientForm;
