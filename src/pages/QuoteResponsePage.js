import React, { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import {
  doc, getDoc, updateDoc, arrayUnion, serverTimestamp,
  collection, addDoc, getDocs, query, where,
} from 'firebase/firestore';
import { signInAnonymously } from 'firebase/auth';
import { db, auth } from '../firebase';
import { uploadToCloudinary } from '../cloudinary';
import { PRODUCTS } from '../config/products';

import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import Button from '@mui/material/Button';
import TextField from '@mui/material/TextField';
import Card from '@mui/material/Card';
import CardContent from '@mui/material/CardContent';
import Stack from '@mui/material/Stack';
import Alert from '@mui/material/Alert';
import CircularProgress from '@mui/material/CircularProgress';
import LinearProgress from '@mui/material/LinearProgress';
import Dialog from '@mui/material/Dialog';
import DialogTitle from '@mui/material/DialogTitle';
import DialogContent from '@mui/material/DialogContent';
import DialogActions from '@mui/material/DialogActions';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import UploadFileIcon from '@mui/icons-material/UploadFile';
import WarningAmberRoundedIcon from '@mui/icons-material/WarningAmberRounded';

const QuoteResponsePage = () => {
  const [params]    = useSearchParams();
  const qid         = params.get('qid');
  const cid         = params.get('cid');
  const companyName = params.get('cn') ? decodeURIComponent(params.get('cn')) : 'Your Company';

  const [quote,      setQuote]      = useState(null);
  const [loading,    setLoading]    = useState(true);
  const [submitted,  setSubmitted]  = useState(false);
  const [error,      setError]      = useState('');
  const [saving,     setSaving]     = useState(false);
  const [uploading,  setUploading]  = useState(false);
  const [uploadPct,  setUploadPct]  = useState(0);
  const [fileUrl,    setFileUrl]    = useState('');
  const [fileName,   setFileName]   = useState('');

  const [form, setForm] = useState({
    basic_premium: '', srcc_premium: '', tc_premium: '',
    admin_fee: '', vat_amount: '', other_premium: '',
    deductible: '', validity_days: '', notes: '',
    special_terms: '', excesses: '', commission_type: '',
    comparison_data: {},
  });

  const [submittedData,  setSubmittedData]  = useState(null);
  const [editing,        setEditing]        = useState(false);
  const [fieldErrors,    setFieldErrors]    = useState({});
  const [valOpen,        setValOpen]        = useState(false);
  const [valIssues,      setValIssues]      = useState({ missing: [], invalid: [] });
  const [editWindowOpen,  setEditWindowOpen]  = useState(false);
  const [reditApproved,   setReditApproved]   = useState(false);
  const [reditPending,    setReditPending]    = useState(false);
  const [showReditForm,   setShowReditForm]   = useState(false);
  const [reditReason,     setReditReason]     = useState('');
  const [reditSending,    setReditSending]    = useState(false);

  useEffect(() => {
    if (!qid) { setError('Invalid link — missing quote ID.'); setLoading(false); return; }

    // Sign in anonymously so Firestore rules allow unauthenticated public access
    signInAnonymously(auth)
      .catch(() => {})
      .finally(() => {
        getDoc(doc(db, 'quotes', qid))
          .then(snap => {
            if (!snap.exists()) { setError('This quote request could not be found.'); return; }
            const data = snap.data();
            if (data.status === 'confirmed') { setError('This quote has already been confirmed. No further responses needed.'); return; }
            const myResponse = (data.responses || []).find(r => r.company_id === cid);
            if (myResponse) {
              setSubmitted(true);
              setSubmittedData(myResponse);
              const submitTime = new Date(myResponse.submitted_at);
              const windowEnd  = new Date(submitTime.getTime() + 15 * 60 * 1000);
              if (new Date() < windowEnd) {
                setEditWindowOpen(true);
              } else {
                // check for an approved re-edit request
                getDocs(query(
                  collection(db, 'quote_redit_requests'),
                  where('quote_id', '==', snap.id),
                  where('company_id', '==', cid),
                  where('status', '==', 'approved'),
                )).then(rsnap => {
                  const valid = rsnap.docs.find(d => new Date(d.data().approved_until) > new Date());
                  if (valid) { setReditApproved(true); return; }
                  // check for a pending request
                  getDocs(query(
                    collection(db, 'quote_redit_requests'),
                    where('quote_id', '==', snap.id),
                    where('company_id', '==', cid),
                    where('status', '==', 'pending'),
                  )).then(psnap => { if (!psnap.empty) setReditPending(true); });
                }).catch(() => {});
              }
            }
            setQuote({ id: snap.id, ...data });
          })
          .catch(() => setError('Failed to load quote. Please check your link.'))
          .finally(() => setLoading(false));
      });
  }, [qid, cid]);

  // Poll every 20s while re-edit request is pending — auto-unlocks when broker approves
  useEffect(() => {
    if (!reditPending || !qid || !cid) return;
    const iv = setInterval(async () => {
      try {
        const snap = await getDocs(query(
          collection(db, 'quote_redit_requests'),
          where('quote_id', '==', qid),
          where('company_id', '==', cid),
          where('status', '==', 'approved'),
        ));
        const valid = snap.docs.find(d => new Date(d.data().approved_until) > new Date());
        if (valid) { setReditApproved(true); setReditPending(false); clearInterval(iv); }
      } catch {}
    }, 20000);
    return () => clearInterval(iv);
  }, [reditPending, qid, cid]);

  const submitReditRequest = async () => {
    if (!reditReason.trim()) return;
    setReditSending(true);
    try {
      await addDoc(collection(db, 'quote_redit_requests'), {
        quote_id:     qid,
        quote_ref:    quote?.reference || qid,
        company_id:   cid,
        company_name: companyName,
        product:      quote?.product_label || '',
        reason:       reditReason.trim(),
        status:       'pending',
        requested_at: serverTimestamp(),
      });
      setReditPending(true);
      setShowReditForm(false);
      setReditReason('');
    } catch { /* ignore */ }
    setReditSending(false);
  };

  const handleFile = async (file) => {
    if (!file) return;
    setFileName(file.name);
    setUploading(true);
    try {
      const url = await uploadToCloudinary(file, 'ceilao/quote-responses', (pct) => setUploadPct(pct));
      setFileUrl(url);
    } catch (err) {
      setError(err.message);
    }
    setUploading(false);
  };

  const setCompRow = (key, val) =>
    setForm(f => ({ ...f, comparison_data: { ...f.comparison_data, [key]: val } }));

  const totalPremium =
    (Number(form.basic_premium) || 0) +
    (Number(form.srcc_premium)  || 0) +
    (Number(form.tc_premium)    || 0) +
    (Number(form.admin_fee)     || 0) +
    (Number(form.vat_amount)    || 0) +
    (Number(form.other_premium) || 0);

  // ── Validation ────────────────────────────────────────────────────────
  const REQUIRED_FIELDS = [
    { key: 'basic_premium',    label: 'Basic Premium',         num: true  },
    { key: 'srcc_premium',     label: 'SRCC Premium',          num: true  },
    { key: 'tc_premium',       label: 'TC Premium',            num: true  },
    { key: 'admin_fee',        label: 'Admin Fee',             num: true  },
    { key: 'vat_amount',       label: 'VAT',                   num: true  },
    { key: 'commission_type',  label: 'Commission Type',       num: false },
    { key: 'deductible',       label: 'Deductible / Excess',   num: false },
    { key: 'validity_days',    label: 'Quote Validity (days)', num: true  },
  ];

  const validateInsurer = () => {
    const errs = {};
    const missing = [];
    const invalid = [];
    REQUIRED_FIELDS.forEach(({ key, label, num }) => {
      const val = form[key]?.toString().trim() || '';
      if (!val) { errs[key] = 'Required'; missing.push(label); return; }
      if (num && isNaN(Number(val))) { errs[key] = 'Must be a number'; invalid.push(`${label} — must be a valid number`); }
    });
    return { errs, missing, invalid };
  };

  const setFE = (key, val) => {
    setForm(f => ({ ...f, [key]: val }));
    setFieldErrors(e => { const n = { ...e }; delete n[key]; return n; });
  };

  const handleSubmit = async () => {
    const { errs, missing, invalid } = validateInsurer();
    if (Object.keys(errs).length > 0) {
      setFieldErrors(errs);
      setValIssues({ missing, invalid });
      setValOpen(true);
      return;
    }
    setFieldErrors({});
    setError('');
    setSaving(true);
    try {
      const responseId = `${cid}_${Date.now()}`;
      const response = {
        id:              responseId,
        company_id:      cid,
        company_name:    companyName,
        premium:         totalPremium,
        basic_premium:   Number(form.basic_premium) || 0,
        srcc_premium:    Number(form.srcc_premium)  || 0,
        tc_premium:      Number(form.tc_premium)    || 0,
        admin_fee:       Number(form.admin_fee)     || 0,
        vat_amount:      Number(form.vat_amount)    || 0,
        other_premium:   Number(form.other_premium) || 0,
        special_terms:   form.special_terms,
        excesses:        form.excesses,
        commission_type: form.commission_type,
        deductible:      form.deductible,
        validity_days:   form.validity_days,
        notes:           form.notes,
        comparison_data: form.comparison_data,
        quote_file_url:  fileUrl,
        submitted_at:    new Date().toISOString(),
      };

      // If editing, remove previous response for this company first
      if (editing) {
        const snap = await (await import('firebase/firestore')).getDoc(
          (await import('firebase/firestore')).doc(db, 'quotes', qid)
        );
        if (snap.exists()) {
          const prev = (snap.data().responses || []).filter(r => r.company_id !== cid);
          await updateDoc(doc(db, 'quotes', qid), {
            responses: [...prev, response],
            status: 'partial',
            updated_at: serverTimestamp(),
          });
        }
      } else {
        await updateDoc(doc(db, 'quotes', qid), {
          responses: arrayUnion(response),
          status: 'partial',
          updated_at: serverTimestamp(),
        });
      }

      setSubmittedData(response);
      setSubmitted(true);
      setEditing(false);
    } catch (err) {
      setError(err.message);
    }
    setSaving(false);
  };

  const downloadReceipt = async () => {
    const { default: jsPDF }     = await import('jspdf');
    const { default: autoTable } = await import('jspdf-autotable');
    const pdf = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });

    // Header band
    pdf.setFillColor(255, 90, 90);
    pdf.rect(0, 0, 210, 38, 'F');
    pdf.setTextColor(255, 255, 255);
    pdf.setFontSize(18); pdf.setFont('helvetica', 'bold');
    pdf.text('Ceilao Insurance Brokers', 14, 15);
    pdf.setFontSize(11); pdf.setFont('helvetica', 'normal');
    pdf.text('Quotation Submission Receipt', 14, 23);
    pdf.setFontSize(9);
    pdf.text(`Ref: ${quote?.reference || qid}   |   ${new Date().toLocaleDateString('en-GB', { day:'numeric', month:'long', year:'numeric' })}`, 14, 31);

    // Sub-header
    pdf.setFillColor(26, 26, 46);
    pdf.rect(0, 38, 210, 12, 'F');
    pdf.setTextColor(255, 139, 90);
    pdf.setFontSize(10); pdf.setFont('helvetica', 'bold');
    pdf.text(`SUBMITTED BY: ${companyName}`, 14, 46);
    pdf.setTextColor(255,255,255);
    pdf.text(`PRODUCT: ${quote?.product_label || ''}`, 120, 46);

    // Submission details table
    const rows = [
      ['Annual Premium (LKR)', Number(submittedData?.premium || form.premium).toLocaleString()],
      ['Deductible / Excess',  submittedData?.deductible      || form.deductible     || '—'],
      ['Quote Validity (days)',submittedData?.validity_days   || form.validity_days  || '—'],
      ['Notes / Terms',        submittedData?.notes           || form.notes          || '—'],
      ...(submittedData?.quote_file_url ? [['Uploaded Document', submittedData.quote_file_url]] : []),
      ...Object.entries(submittedData?.comparison_data || {})
        .filter(([,v]) => v)
        .map(([k, v]) => [k, String(v)]),
    ];

    autoTable(pdf, {
      startY: 56,
      head: [['Field', 'Value']],
      body: rows,
      headStyles: { fillColor: [255, 139, 90], textColor: 255, fontStyle: 'bold', fontSize: 10 },
      alternateRowStyles: { fillColor: [255, 248, 245] },
      columnStyles: { 0: { fontStyle: 'bold', cellWidth: 65 } },
      styles: { fontSize: 9.5, cellPadding: 4 },
      margin: { left: 14, right: 14 },
    });

    const finalY = pdf.lastAutoTable.finalY + 10;
    pdf.setTextColor(150, 150, 150); pdf.setFontSize(8); pdf.setFont('helvetica', 'italic');
    pdf.text('Ceilao Insurance Brokers (Pvt) Ltd — Confidential Quotation Receipt', 14, finalY);

    pdf.save(`receipt_${quote?.reference || qid}_${companyName.replace(/\s+/g, '_')}.pdf`);
  };

  const canEdit = editWindowOpen || reditApproved;
  const handleEdit = () => {
    if (!canEdit) return;
    setSubmitted(false);
    setEditing(true);
  };

  const product = quote ? PRODUCTS[quote.product_key] : null;

  if (loading) return (
    <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '100vh' }}>
      <CircularProgress sx={{ color: '#FF5A5A' }} />
    </Box>
  );

  if (submitted) return (
    <Box sx={{ minHeight: '100vh', bgcolor: '#F9F9FB', py: 4, px: 2 }}>
      <Box sx={{ maxWidth: 560, mx: 'auto' }}>
        <Card sx={{ mb: 2.5, overflow: 'hidden' }}>
          <Box sx={{ background: 'linear-gradient(135deg,#10B981,#059669)', p: 3, textAlign: 'center' }}>
            <CheckCircleIcon sx={{ fontSize: 52, color: '#fff', mb: 1 }} />
            <Typography sx={{ fontWeight: 800, fontSize: 20, color: '#fff' }}>
              {editing ? 'Quotation Updated!' : 'Quotation Submitted!'}
            </Typography>
            <Typography sx={{ fontSize: 13, color: 'rgba(255,255,255,0.82)', mt: 0.5 }}>
              {companyName} · Ref: {quote?.reference}
            </Typography>
          </Box>
          <CardContent sx={{ p: 3 }}>
            {/* Receipt summary */}
            <Typography sx={{ fontSize: 11, fontWeight: 700, color: '#9CA3AF', textTransform: 'uppercase', letterSpacing: 0.8, mb: 1.5 }}>
              Submission Summary
            </Typography>
            <Stack spacing={1} sx={{ mb: 2.5 }}>
              {[
                ['Total Premium',   `LKR ${Number(submittedData?.premium || 0).toLocaleString()}`],
                ['Basic Premium',   submittedData?.basic_premium ? `LKR ${Number(submittedData.basic_premium).toLocaleString()}` : '—'],
                ['SRCC',            submittedData?.srcc_premium  ? `LKR ${Number(submittedData.srcc_premium).toLocaleString()}`  : '—'],
                ['TC',              submittedData?.tc_premium    ? `LKR ${Number(submittedData.tc_premium).toLocaleString()}`    : '—'],
                ['Admin Fee',       submittedData?.admin_fee     ? `LKR ${Number(submittedData.admin_fee).toLocaleString()}`     : '—'],
                ['VAT',             submittedData?.vat_amount    ? `LKR ${Number(submittedData.vat_amount).toLocaleString()}`    : '—'],
                ['Deductible',      submittedData?.deductible    || '—'],
                ['Validity',        submittedData?.validity_days ? `${submittedData.validity_days} days` : '—'],
                ['Submitted',       new Date(submittedData?.submitted_at || Date.now()).toLocaleString('en-GB')],
              ].map(([l, v]) => (
                <Box key={l} sx={{ display: 'flex', justifyContent: 'space-between', py: 0.8,
                                    borderBottom: '1px solid rgba(255,139,90,0.08)' }}>
                  <Typography sx={{ fontSize: 13, color: '#6B7280' }}>{l}</Typography>
                  <Typography sx={{ fontSize: 13, fontWeight: 700, color: '#1A1A2E' }}>{v}</Typography>
                </Box>
              ))}
            </Stack>
            <Stack spacing={1.5}>
              <Button fullWidth variant="contained" onClick={downloadReceipt}
                startIcon={<UploadFileIcon />}
                sx={{ py: 1.2, fontSize: 13, background: 'linear-gradient(135deg,#1A1A2E,#2d2d42)' }}>
                Download PDF Receipt
              </Button>
              {/* Edit / re-edit access control */}
              {canEdit ? (
                <Button fullWidth variant="outlined" onClick={handleEdit}
                  sx={{ py: 1.2, fontSize: 13, borderColor: 'rgba(255,90,90,0.3)', color: '#FF5A5A' }}>
                  {reditApproved ? '✏️ Re-edit Approved — Edit & Resubmit' : 'Made a Mistake? Edit & Resubmit'}
                </Button>
              ) : reditPending ? (
                <Box sx={{ p: 2, borderRadius: '10px', bgcolor: 'rgba(245,158,11,0.08)', border: '1px solid rgba(245,158,11,0.2)', textAlign: 'center' }}>
                  <Typography sx={{ fontSize: 13, fontWeight: 700, color: '#d97706', mb: 0.5 }}>Re-edit Request Pending</Typography>
                  <Typography sx={{ fontSize: 12, color: '#6B7280' }}>
                    Your request is awaiting broker approval. This page will automatically unlock once approved.
                  </Typography>
                </Box>
              ) : showReditForm ? (
                <Box sx={{ p: 2, borderRadius: '10px', border: '1px solid rgba(255,90,90,0.2)' }}>
                  <Typography sx={{ fontSize: 13, fontWeight: 700, mb: 1.5, color: '#374151' }}>
                    Request Re-edit Access
                  </Typography>
                  <TextField fullWidth size="small" multiline rows={3}
                    label="Reason for re-edit *"
                    placeholder="Briefly explain why you need to update your submission…"
                    value={reditReason}
                    onChange={e => setReditReason(e.target.value)}
                    sx={{ mb: 1.5 }} />
                  <Stack direction="row" spacing={1}>
                    <Button variant="outlined" size="small" onClick={() => setShowReditForm(false)}
                      sx={{ borderColor: '#e0e0e0', color: '#6B7280' }}>Cancel</Button>
                    <Button variant="contained" size="small" onClick={submitReditRequest}
                      disabled={!reditReason.trim() || reditSending}
                      sx={{ background: 'linear-gradient(135deg,#FF5A5A,#FF8B5A)' }}>
                      {reditSending ? 'Sending…' : 'Submit Request'}
                    </Button>
                  </Stack>
                </Box>
              ) : (
                <Box sx={{ p: 2, borderRadius: '10px', bgcolor: 'rgba(107,114,128,0.05)', border: '1px solid rgba(0,0,0,0.08)', textAlign: 'center' }}>
                  <Typography sx={{ fontSize: 12.5, color: '#6B7280', mb: 1.5 }}>
                    The 15-minute edit window has closed. Need to make a change?
                  </Typography>
                  <Button variant="outlined" size="small" onClick={() => setShowReditForm(true)}
                    sx={{ borderColor: 'rgba(255,90,90,0.3)', color: '#FF5A5A', fontSize: 12 }}>
                    Request Re-edit Access
                  </Button>
                </Box>
              )}
            </Stack>
          </CardContent>
        </Card>
        <Typography sx={{ fontSize: 11.5, color: '#9CA3AF', textAlign: 'center' }}>
          Ceilao Insurance Brokers (Pvt) Ltd — your response has been tracked in real-time.
        </Typography>
      </Box>
    </Box>
  );

  if (error && !quote) return (
    <Box sx={{ minHeight: '100vh', bgcolor: '#F9F9FB', display: 'flex', alignItems: 'center', justifyContent: 'center', p: 3 }}>
      <Card sx={{ maxWidth: 480, width: '100%' }}>
        <CardContent sx={{ p: 4, textAlign: 'center' }}>
          <Typography variant="h5" sx={{ fontWeight: 800, mb: 2 }}>⚠️ Link Error</Typography>
          <Alert severity="error">{error}</Alert>
        </CardContent>
      </Card>
    </Box>
  );

  return (
    <Box sx={{ minHeight: '100vh', bgcolor: '#F9F9FB', py: 4, px: 2 }}>
      <Box sx={{ maxWidth: 680, mx: 'auto' }}>
        {/* Header */}
        <Box sx={{ textAlign: 'center', mb: 4 }}>
          <Box sx={{
            width: 64, height: 64, borderRadius: '16px', mx: 'auto', mb: 2,
            background: 'linear-gradient(135deg,#FF5A5A,#FF8B5A)',
            display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 28,
          }}>
            {product?.icon || '📋'}
          </Box>
          <Typography variant="h5" sx={{ fontWeight: 800, mb: 0.5 }}>Submit Your Quotation</Typography>
          <Typography sx={{ fontSize: 13.5, color: '#6B7280' }}>
            From <strong>{companyName}</strong> · Reference: <strong>{quote?.reference}</strong>
          </Typography>
          <Typography sx={{ fontSize: 12.5, color: '#9CA3AF', mt: 0.5 }}>
            {product?.label} — Requested by Ceilao Insurance Brokers
          </Typography>
        </Box>

        {/* Quote request summary */}
        <Card sx={{ mb: 3 }}>
          <CardContent>
            <Typography sx={{ fontWeight: 700, fontSize: 13, mb: 1.5, color: '#374151' }}>Quote Request Details</Typography>
            <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 1.5 }}>
              {(() => {
                const formData = quote?.form_data || {};
                const noFields = new Set(
                  (product?.fields || [])
                    .filter(f => f.type === 'yesno' && formData[f.name] === 'No')
                    .map(f => f.name)
                );
                return Object.entries(formData)
                  .filter(([k, v]) => {
                    if (!v) return false;
                    const fd = product?.fields?.find(f => f.name === k);
                    if (fd?.type === 'yesno' && v === 'No') return false;
                    if (fd?.showIf && noFields.has(fd.showIf.field)) return false;
                    return true;
                  })
                  .map(([k, v]) => {
                    const fieldDef = product?.fields?.find(f => f.name === k);
                    return (
                      <Box key={k}>
                        <Typography sx={{ fontSize: 10.5, fontWeight: 700, color: '#9CA3AF', textTransform: 'uppercase', letterSpacing: 0.5 }}>
                          {fieldDef?.label || k}
                        </Typography>
                        <Typography sx={{ fontSize: 13, color: '#1A1A2E', fontWeight: 500 }}>{v}</Typography>
                      </Box>
                    );
                  });
              })()}
            </Box>
          </CardContent>
        </Card>

        {/* Response form */}
        <Card>
          <CardContent>
            <Typography sx={{ fontWeight: 700, fontSize: 14, mb: 2.5, color: '#1A1A2E' }}>
              {editing ? '✏️ Editing Submission — Update your details below' : 'Your Quotation Details'}
            </Typography>

            {error && <Alert severity="error" sx={{ mb: 2, fontSize: 12 }}>{error}</Alert>}

            <Stack spacing={2.5}>

              {/* ── Premium Breakdown ── */}
              <Box sx={{ p: 2, borderRadius: '12px', border: `1px solid ${['basic_premium','srcc_premium','tc_premium','admin_fee','vat_amount'].some(k => fieldErrors[k]) ? 'rgba(239,68,68,0.4)' : 'rgba(255,90,90,0.15)'}`, bgcolor: 'rgba(255,90,90,0.02)' }}>
                <Typography sx={{ fontSize: 12, fontWeight: 800, color: '#FF5A5A', textTransform: 'uppercase', letterSpacing: 0.8, mb: 1.5 }}>
                  Premium Breakdown
                </Typography>
                <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 1.5 }}>
                  <TextField label="Basic Premium (LKR) *" type="number" size="small" fullWidth
                    error={!!fieldErrors.basic_premium} helperText={fieldErrors.basic_premium}
                    value={form.basic_premium} onChange={e => setFE('basic_premium', e.target.value)} />
                  <TextField label="SRCC (LKR) *" type="number" size="small" fullWidth
                    error={!!fieldErrors.srcc_premium} helperText={fieldErrors.srcc_premium}
                    value={form.srcc_premium} onChange={e => setFE('srcc_premium', e.target.value)} />
                  <TextField label="TC (LKR) *" type="number" size="small" fullWidth
                    error={!!fieldErrors.tc_premium} helperText={fieldErrors.tc_premium}
                    value={form.tc_premium} onChange={e => setFE('tc_premium', e.target.value)} />
                  <TextField label="Admin Fee (LKR) *" type="number" size="small" fullWidth
                    error={!!fieldErrors.admin_fee} helperText={fieldErrors.admin_fee}
                    value={form.admin_fee} onChange={e => setFE('admin_fee', e.target.value)} />
                  <TextField label="VAT (LKR) *" type="number" size="small" fullWidth
                    error={!!fieldErrors.vat_amount} helperText={fieldErrors.vat_amount}
                    value={form.vat_amount} onChange={e => setFE('vat_amount', e.target.value)} />
                  <TextField label="Other (LKR)" type="number" size="small" fullWidth
                    value={form.other_premium} onChange={e => setFE('other_premium', e.target.value)} />
                </Box>
                <Box sx={{ mt: 1.5, p: 1.5, borderRadius: '8px', bgcolor: 'rgba(255,90,90,0.08)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <Typography sx={{ fontSize: 13, fontWeight: 700, color: '#374151' }}>Total Premium (LKR)</Typography>
                  <Typography sx={{ fontSize: 16, fontWeight: 800, color: '#FF5A5A' }}>
                    {totalPremium > 0 ? totalPremium.toLocaleString() : '—'}
                  </Typography>
                </Box>
              </Box>

              {/* ── Commission (broker-internal) ── */}
              <Box>
                <Typography sx={{ fontSize: 12, fontWeight: 700, color: fieldErrors.commission_type ? '#ef4444' : '#6B7280', mb: 0.8 }}>
                  Commission Type *
                  <Box component="span" sx={{ ml: 1, px: 0.8, py: 0.2, borderRadius: '4px', bgcolor: 'rgba(99,102,241,0.1)', color: '#6366f1', fontSize: 10, fontWeight: 700 }}>
                    FOR BROKER USE ONLY
                  </Box>
                </Typography>
                <Box sx={{ display: 'flex', gap: 1, border: fieldErrors.commission_type ? '1px solid #ef4444' : 'none', borderRadius: '8px', p: fieldErrors.commission_type ? 0.5 : 0 }}>
                  {['Standard', 'Special'].map(opt => (
                    <Box key={opt} onClick={() => setFE('commission_type', opt)}
                      sx={{
                        flex: 1, py: 1, textAlign: 'center', borderRadius: '8px', cursor: 'pointer',
                        border: `1.5px solid ${form.commission_type === opt ? '#6366f1' : 'rgba(0,0,0,0.12)'}`,
                        bgcolor: form.commission_type === opt ? 'rgba(99,102,241,0.08)' : 'transparent',
                        color: form.commission_type === opt ? '#6366f1' : '#6B7280',
                        fontWeight: form.commission_type === opt ? 700 : 400, fontSize: 13,
                        transition: 'all 0.15s ease',
                      }}>
                      {opt}
                    </Box>
                  ))}
                </Box>
                {fieldErrors.commission_type && <Typography sx={{ fontSize: 11, color: '#ef4444', mt: 0.5, ml: 0.5 }}>{fieldErrors.commission_type}</Typography>}
              </Box>

              <TextField label="Special Terms" multiline minRows={2} fullWidth size="small"
                value={form.special_terms} onChange={e => setFE('special_terms', e.target.value)} />

              <TextField label="Excesses" multiline minRows={2} fullWidth size="small"
                value={form.excesses} onChange={e => setFE('excesses', e.target.value)} />

              <TextField label="Deductible / Excess *" fullWidth size="small"
                error={!!fieldErrors.deductible} helperText={fieldErrors.deductible}
                value={form.deductible} onChange={e => setFE('deductible', e.target.value)} />
              <TextField label="Quote Validity (days) *" type="number" fullWidth size="small"
                error={!!fieldErrors.validity_days} helperText={fieldErrors.validity_days}
                value={form.validity_days} onChange={e => setFE('validity_days', e.target.value)} />

              {/* Comparison data fields */}
              <Box>
                <Typography sx={{ fontSize: 12.5, fontWeight: 700, color: '#374151', mb: 1.5 }}>
                  Comparison Fields (optional — helps with side-by-side comparison)
                </Typography>
                <Stack spacing={1.5}>
                  {(product?.comparisonRows || [])
                    .filter(r => !['Annual Premium (LKR)', 'Validity (days)'].includes(r))
                    .map(row => (
                      <TextField key={row} label={row} fullWidth size="small"
                        value={form.comparison_data[row] || ''}
                        onChange={e => setCompRow(row, e.target.value)} />
                    ))}
                </Stack>
              </Box>

              <TextField label="Notes / Terms & Conditions" multiline minRows={3} fullWidth size="small"
                value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} />

              {/* File upload */}
              <Box>
                <Typography sx={{ fontSize: 12.5, fontWeight: 700, color: '#374151', mb: 1 }}>
                  Upload Your Quotation Document (PDF / Image)
                </Typography>
                <Box
                  onClick={() => document.getElementById('quote-file-input').click()}
                  onDragOver={e => e.preventDefault()}
                  onDrop={e => { e.preventDefault(); handleFile(e.dataTransfer.files[0]); }}
                  sx={{
                    border: `2px dashed ${fileUrl ? '#10B981' : 'rgba(255,139,90,0.35)'}`,
                    borderRadius: '12px', p: 2.5, cursor: 'pointer', textAlign: 'center',
                    bgcolor: fileUrl ? 'rgba(16,185,129,0.04)' : '#FAFAFA',
                    transition: 'all 0.2s ease',
                    '&:hover': { borderColor: '#FF8B5A', bgcolor: 'rgba(255,139,90,0.04)' },
                  }}>
                  <input id="quote-file-input" type="file" accept=".pdf,.jpg,.jpeg,.png,.webp"
                    style={{ display: 'none' }}
                    onChange={e => handleFile(e.target.files[0])} />
                  {uploading ? (
                    <Box>
                      <Typography sx={{ fontSize: 13, color: '#6B7280', mb: 1 }}>Uploading…</Typography>
                      <LinearProgress variant="determinate" value={uploadPct}
                        sx={{ borderRadius: 4, '& .MuiLinearProgress-bar': { background: 'linear-gradient(90deg,#FF5A5A,#FF8B5A)' } }} />
                    </Box>
                  ) : fileUrl ? (
                    <Typography sx={{ fontSize: 13, color: '#10B981', fontWeight: 600 }}>
                      ✓ {fileName} uploaded
                    </Typography>
                  ) : (
                    <Box>
                      <UploadFileIcon sx={{ color: '#FF8B5A', fontSize: 32, mb: 0.5 }} />
                      <Typography sx={{ fontSize: 13, color: '#6B7280' }}>
                        Click or drag & drop your standard quotation document
                      </Typography>
                      <Typography sx={{ fontSize: 11, color: '#9CA3AF', mt: 0.3 }}>PDF, JPG, PNG — max 20 MB</Typography>
                    </Box>
                  )}
                </Box>
              </Box>
            </Stack>

            <Button fullWidth variant="contained" onClick={handleSubmit} disabled={saving || uploading}
              sx={{ mt: 3, py: 1.3, fontSize: 14, fontWeight: 700 }}>
              {saving ? 'Submitting…' : editing ? 'Update Quotation' : 'Submit Quotation'}
            </Button>

            <Typography sx={{ fontSize: 11, color: '#9CA3AF', textAlign: 'center', mt: 2 }}>
              Your submission is securely transmitted to Ceilao Insurance Brokers and tracked in real-time.
            </Typography>
          </CardContent>
        </Card>

        <Typography sx={{ fontSize: 11.5, color: '#9CA3AF', textAlign: 'center', mt: 3 }}>
          Ceilao Insurance Brokers (Pvt) Ltd — Confidential Quotation Portal
        </Typography>
      </Box>

      {/* ── Validation dialog ── */}
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
            Fields with issues are highlighted in red above.
          </Typography>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button variant="contained" onClick={() => setValOpen(false)}
            sx={{ background: 'linear-gradient(135deg,#FF5A5A,#FF8B5A)', minWidth: 100 }}>
            OK, fix them
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default QuoteResponsePage;
