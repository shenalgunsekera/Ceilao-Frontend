import React, { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { doc, getDoc, updateDoc, arrayUnion, serverTimestamp } from 'firebase/firestore';
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
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import UploadFileIcon from '@mui/icons-material/UploadFile';

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
    premium: '', deductible: '', validity_days: '', notes: '',
    comparison_data: {},
  });

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
            const alreadyResponded = (data.responses || []).some(r => r.company_id === cid);
            if (alreadyResponded) { setSubmitted(true); }
            setQuote({ id: snap.id, ...data });
          })
          .catch(() => setError('Failed to load quote. Please check your link.'))
          .finally(() => setLoading(false));
      });
  }, [qid, cid]);

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

  const handleSubmit = async () => {
    if (!form.premium) { setError('Annual Premium is required.'); return; }
    setSaving(true);
    try {
      const response = {
        id:              `${cid}_${Date.now()}`,
        company_id:      cid,
        company_name:    companyName,
        premium:         Number(form.premium),
        deductible:      form.deductible,
        validity_days:   form.validity_days,
        notes:           form.notes,
        comparison_data: form.comparison_data,
        quote_file_url:  fileUrl,
        submitted_at:    new Date().toISOString(),
      };

      await updateDoc(doc(db, 'quotes', qid), {
        responses: arrayUnion(response),
        status: 'partial',
        updated_at: serverTimestamp(),
      });
      setSubmitted(true);
    } catch (err) {
      setError(err.message);
    }
    setSaving(false);
  };

  const product = quote ? PRODUCTS[quote.product_key] : null;

  if (loading) return (
    <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '100vh' }}>
      <CircularProgress sx={{ color: '#FF5A5A' }} />
    </Box>
  );

  if (submitted) return (
    <Box sx={{ minHeight: '100vh', bgcolor: '#F9F9FB', display: 'flex', alignItems: 'center', justifyContent: 'center', p: 3 }}>
      <Card sx={{ maxWidth: 480, width: '100%', textAlign: 'center' }}>
        <CardContent sx={{ p: 4 }}>
          <CheckCircleIcon sx={{ fontSize: 64, color: '#10B981', mb: 2 }} />
          <Typography variant="h5" sx={{ fontWeight: 800, mb: 1 }}>Quote Submitted!</Typography>
          <Typography sx={{ color: '#6B7280', fontSize: 14 }}>
            Thank you, <strong>{companyName}</strong>. Your quotation has been received and will be reviewed by Ceilao Insurance Brokers.
          </Typography>
        </CardContent>
      </Card>
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
              {Object.entries(quote?.form_data || {}).filter(([,v]) => v).map(([k, v]) => {
                const fieldDef = product?.fields?.find(f => f.name === k);
                return (
                  <Box key={k}>
                    <Typography sx={{ fontSize: 10.5, fontWeight: 700, color: '#9CA3AF', textTransform: 'uppercase', letterSpacing: 0.5 }}>
                      {fieldDef?.label || k}
                    </Typography>
                    <Typography sx={{ fontSize: 13, color: '#1A1A2E', fontWeight: 500 }}>{v}</Typography>
                  </Box>
                );
              })}
            </Box>
          </CardContent>
        </Card>

        {/* Response form */}
        <Card>
          <CardContent>
            <Typography sx={{ fontWeight: 700, fontSize: 14, mb: 2.5, color: '#1A1A2E' }}>Your Quotation Details</Typography>

            {error && <Alert severity="error" sx={{ mb: 2, fontSize: 12 }}>{error}</Alert>}

            <Stack spacing={2.5}>
              <TextField label="Annual Premium (LKR) *" type="number" fullWidth size="small"
                value={form.premium} onChange={e => setForm(f => ({ ...f, premium: e.target.value }))} />
              <TextField label="Deductible / Excess" fullWidth size="small"
                value={form.deductible} onChange={e => setForm(f => ({ ...f, deductible: e.target.value }))} />
              <TextField label="Quote Validity (days)" type="number" fullWidth size="small"
                value={form.validity_days} onChange={e => setForm(f => ({ ...f, validity_days: e.target.value }))} />

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
              {saving ? 'Submitting…' : 'Submit Quotation'}
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
    </Box>
  );
};

export default QuoteResponsePage;
