import React, { useState, useEffect, useCallback } from 'react';
import { collection, addDoc, getDocs, deleteDoc, doc, updateDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../firebase';

import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import Button from '@mui/material/Button';
import TextField from '@mui/material/TextField';
import Stack from '@mui/material/Stack';
import Card from '@mui/material/Card';
import CardContent from '@mui/material/CardContent';
import IconButton from '@mui/material/IconButton';
import Dialog from '@mui/material/Dialog';
import DialogTitle from '@mui/material/DialogTitle';
import DialogContent from '@mui/material/DialogContent';
import DialogActions from '@mui/material/DialogActions';
import Snackbar from '@mui/material/Snackbar';
import Alert from '@mui/material/Alert';
import Skeleton from '@mui/material/Skeleton';

import BusinessOutlinedIcon from '@mui/icons-material/BusinessOutlined';
import AddIcon from '@mui/icons-material/Add';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline';
import EditOutlinedIcon from '@mui/icons-material/EditOutlined';
import SaveOutlinedIcon from '@mui/icons-material/SaveOutlined';

const InsuranceCompaniesManager = () => {
  const [companies, setCompanies] = useState([]);
  const [loading,   setLoading]   = useState(true);
  const [addOpen,   setAddOpen]   = useState(false);
  const [editId,    setEditId]    = useState(null);
  const [form,      setForm]      = useState({ name: '', email: '' });
  const [saving,    setSaving]    = useState(false);
  const [toast,     setToast]     = useState({ open: false, msg: '', severity: 'success' });

  const load = useCallback(async () => {
    setLoading(true);
    const snap = await getDocs(collection(db, 'insurance_companies'));
    setCompanies(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const handleSave = async () => {
    if (!form.name.trim() || !form.email.trim()) {
      setToast({ open: true, msg: 'Name and email are required', severity: 'error' }); return;
    }
    setSaving(true);
    try {
      if (editId) {
        await updateDoc(doc(db, 'insurance_companies', editId), { name: form.name.trim(), email: form.email.trim() });
        setToast({ open: true, msg: 'Company updated.', severity: 'success' });
        setEditId(null);
      } else {
        await addDoc(collection(db, 'insurance_companies'), {
          name: form.name.trim(), email: form.email.trim(), created_at: serverTimestamp(),
        });
        setToast({ open: true, msg: 'Company added.', severity: 'success' });
        setAddOpen(false);
      }
      setForm({ name: '', email: '' });
      load();
    } catch (err) {
      setToast({ open: true, msg: err.message, severity: 'error' });
    }
    setSaving(false);
  };

  const handleDelete = async (id, name) => {
    if (!window.confirm(`Remove ${name}?`)) return;
    await deleteDoc(doc(db, 'insurance_companies', id));
    setCompanies(c => c.filter(x => x.id !== id));
    setToast({ open: true, msg: `${name} removed.`, severity: 'info' });
  };

  return (
    <Box>
      <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 2.5 }}>
        <Box>
          <Typography sx={{ fontWeight: 700, fontSize: 15 }}>Insurance Companies</Typography>
          <Typography sx={{ fontSize: 12, color: '#9CA3AF' }}>
            Manage the insurers available for quote requests
          </Typography>
        </Box>
        <Button variant="contained" size="small" startIcon={<AddIcon />} onClick={() => { setForm({ name: '', email: '' }); setAddOpen(true); }}>
          Add Company
        </Button>
      </Stack>

      {loading ? (
        <Stack spacing={1}>{[1,2,3].map(i => <Skeleton key={i} height={56} sx={{ borderRadius: '12px' }} />)}</Stack>
      ) : companies.length === 0 ? (
        <Box sx={{ textAlign: 'center', py: 5 }}>
          <BusinessOutlinedIcon sx={{ fontSize: 40, color: 'rgba(255,90,90,0.2)', mb: 1 }} />
          <Typography sx={{ color: '#9CA3AF' }}>No insurance companies yet.</Typography>
          <Typography sx={{ fontSize: 12, color: '#C4B5B0' }}>Add companies to enable quote requests.</Typography>
        </Box>
      ) : (
        <Stack spacing={1}>
          {companies.map(co => (
            <Card key={co.id} sx={{ border: '1px solid rgba(255,139,90,0.12)' }}>
              <CardContent sx={{ p: 0, '&:last-child': { pb: 0 } }}>
                {editId === co.id ? (
                  <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.5} alignItems="center" sx={{ p: 2 }}>
                    <TextField size="small" label="Company Name" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} sx={{ flex: 1 }} />
                    <TextField size="small" label="Email" type="email" value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} sx={{ flex: 1 }} />
                    <Stack direction="row" spacing={0.5}>
                      <Button size="small" variant="contained" startIcon={<SaveOutlinedIcon />} onClick={handleSave} disabled={saving}>Save</Button>
                      <Button size="small" variant="outlined" onClick={() => setEditId(null)} sx={{ borderColor: '#e0e0e0', color: '#6B7280' }}>Cancel</Button>
                    </Stack>
                  </Stack>
                ) : (
                  <Box sx={{ px: 2.5, py: 1.5, display: 'flex', alignItems: 'center', gap: 1.5 }}>
                    <Box sx={{ width: 36, height: 36, borderRadius: '10px', bgcolor: 'rgba(255,90,90,0.08)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      <BusinessOutlinedIcon sx={{ color: '#FF5A5A', fontSize: 18 }} />
                    </Box>
                    <Box sx={{ flex: 1 }}>
                      <Typography sx={{ fontWeight: 700, fontSize: 13.5 }}>{co.name}</Typography>
                      <Typography sx={{ fontSize: 12, color: '#9CA3AF' }}>{co.email}</Typography>
                    </Box>
                    <IconButton size="small" onClick={() => { setEditId(co.id); setForm({ name: co.name, email: co.email }); }}
                      sx={{ color: '#9CA3AF', '&:hover': { color: '#FF5A5A' } }}>
                      <EditOutlinedIcon fontSize="small" />
                    </IconButton>
                    <IconButton size="small" onClick={() => handleDelete(co.id, co.name)}
                      sx={{ color: '#9CA3AF', '&:hover': { color: '#ef4444' } }}>
                      <DeleteOutlineIcon fontSize="small" />
                    </IconButton>
                  </Box>
                )}
              </CardContent>
            </Card>
          ))}
        </Stack>
      )}

      <Dialog open={addOpen} onClose={() => setAddOpen(false)} maxWidth="xs" fullWidth>
        <DialogTitle>Add Insurance Company</DialogTitle>
        <DialogContent sx={{ pt: 2.5 }}>
          <Stack spacing={2}>
            <TextField label="Company Name *" fullWidth size="small" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} />
            <TextField label="Email Address *" type="email" fullWidth size="small" value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))}
              helperText="This email receives quote requests" />
          </Stack>
        </DialogContent>
        <DialogActions sx={{ px: 3, py: 2, borderTop: '1px solid rgba(255,139,90,0.10)' }}>
          <Button onClick={() => setAddOpen(false)} variant="outlined" sx={{ borderColor: '#e0e0e0', color: '#6B7280' }}>Cancel</Button>
          <Button variant="contained" onClick={handleSave} disabled={saving}>{saving ? 'Saving…' : 'Add Company'}</Button>
        </DialogActions>
      </Dialog>

      <Snackbar open={toast.open} autoHideDuration={3500} onClose={() => setToast(t => ({ ...t, open: false }))}>
        <Alert severity={toast.severity} variant="filled">{toast.msg}</Alert>
      </Snackbar>
    </Box>
  );
};

export default InsuranceCompaniesManager;
