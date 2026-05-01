import React, { useState, useEffect } from 'react';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { db } from '../firebase';
import { MODULES, DEFAULT_MODULE_ACCESS } from '../config/products';

import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import Button from '@mui/material/Button';
import Stack from '@mui/material/Stack';
import Checkbox from '@mui/material/Checkbox';
import FormControlLabel from '@mui/material/FormControlLabel';
import Card from '@mui/material/Card';
import CardContent from '@mui/material/CardContent';
import Snackbar from '@mui/material/Snackbar';
import Alert from '@mui/material/Alert';
import Skeleton from '@mui/material/Skeleton';

const ROLES = ['admin', 'manager', 'employee'];

const ModuleAccessManager = () => {
  const [access,  setAccess]  = useState(DEFAULT_MODULE_ACCESS);
  const [loading, setLoading] = useState(true);
  const [saving,  setSaving]  = useState(false);
  const [toast,   setToast]   = useState({ open: false, msg: '', severity: 'success' });

  useEffect(() => {
    getDoc(doc(db, 'settings', 'module_access'))
      .then(snap => { if (snap.exists()) setAccess({ ...DEFAULT_MODULE_ACCESS, ...snap.data() }); })
      .finally(() => setLoading(false));
  }, []);

  const toggle = (moduleKey, role) => {
    setAccess(prev => {
      const current = prev[moduleKey] || [];
      const next = current.includes(role)
        ? current.filter(r => r !== role)
        : [...current, role];
      // admin always has access to everything
      if (role === 'admin') return prev;
      return { ...prev, [moduleKey]: next };
    });
  };

  const save = async () => {
    setSaving(true);
    try {
      await setDoc(doc(db, 'settings', 'module_access'), access, { merge: true });
      setToast({ open: true, msg: 'Module access updated.', severity: 'success' });
    } catch (err) {
      setToast({ open: true, msg: err.message, severity: 'error' });
    }
    setSaving(false);
  };

  if (loading) return <Stack spacing={1.5}>{[1,2,3,4,5,6].map(i => <Skeleton key={i} height={72} sx={{ borderRadius: '12px' }} />)}</Stack>;

  return (
    <Box>
      <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 2.5 }}>
        <Box>
          <Typography sx={{ fontWeight: 700, fontSize: 15 }}>Module Access Control</Typography>
          <Typography sx={{ fontSize: 12, color: '#9CA3AF' }}>
            Choose which roles can access each module. Admins always have full access.
          </Typography>
        </Box>
        <Button variant="contained" size="small" onClick={save} disabled={saving}>
          {saving ? 'Saving…' : 'Save Changes'}
        </Button>
      </Stack>

      <Stack spacing={1.5}>
        {MODULES.map(mod => {
          const allowed = access[mod.key] || DEFAULT_MODULE_ACCESS[mod.key] || [];
          return (
            <Card key={mod.key} sx={{ border: '1px solid rgba(255,139,90,0.12)' }}>
              <CardContent sx={{ py: 1.5, px: 2.5, '&:last-child': { pb: 1.5 } }}>
                <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2} alignItems={{ sm: 'center' }}>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, flex: 1 }}>
                    <Typography sx={{ fontSize: 22 }}>{mod.icon}</Typography>
                    <Box>
                      <Typography sx={{ fontWeight: 700, fontSize: 13.5 }}>{mod.label}</Typography>
                      <Typography sx={{ fontSize: 11.5, color: '#9CA3AF' }}>{mod.description}</Typography>
                    </Box>
                  </Box>
                  <Stack direction="row" spacing={1}>
                    {ROLES.map(role => (
                      <FormControlLabel
                        key={role}
                        control={
                          <Checkbox
                            size="small"
                            checked={allowed.includes(role)}
                            disabled={role === 'admin'}
                            onChange={() => toggle(mod.key, role)}
                            sx={{ color: '#FF8B5A', '&.Mui-checked': { color: '#FF5A5A' } }}
                          />
                        }
                        label={<Typography sx={{ fontSize: 12.5, fontWeight: 600, textTransform: 'capitalize', color: role === 'admin' ? '#9CA3AF' : '#374151' }}>{role}</Typography>}
                        sx={{ mr: 0 }}
                      />
                    ))}
                  </Stack>
                </Stack>
              </CardContent>
            </Card>
          );
        })}
      </Stack>

      <Snackbar open={toast.open} autoHideDuration={3000} onClose={() => setToast(t => ({ ...t, open: false }))}>
        <Alert severity={toast.severity} variant="filled">{toast.msg}</Alert>
      </Snackbar>
    </Box>
  );
};

export default ModuleAccessManager;
