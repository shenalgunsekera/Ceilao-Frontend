import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '../firebase';
import { useAuth } from '../App';
import { MODULES, DEFAULT_MODULE_ACCESS } from '../config/products';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import Grid from '@mui/material/Grid';
import Chip from '@mui/material/Chip';

const MODULE_ROUTES = {
  quotations:   '/quotations',
  underwriting: '/underwriting',
  claims:       '/claims',
  accounting:   '/accounting',
  reports:      '/reports',
  renewals:     '/renewals',
};

const MODULE_GRADIENTS = {
  quotations:   'linear-gradient(135deg,#FF5A5A,#FF8B5A)',
  underwriting: 'linear-gradient(135deg,#6366f1,#818cf8)',
  claims:       'linear-gradient(135deg,#0ea5e9,#38bdf8)',
  accounting:   'linear-gradient(135deg,#10B981,#34d399)',
  reports:      'linear-gradient(135deg,#f59e0b,#fbbf24)',
  renewals:     'linear-gradient(135deg,#8b5cf6,#a78bfa)',
};

const OperationalMenu = () => {
  const { user, userProfile } = useAuth();
  const navigate = useNavigate();
  const role = userProfile?.role || 'employee';
  const [access, setAccess] = useState(DEFAULT_MODULE_ACCESS);
  const name = userProfile?.full_name || user?.email?.split('@')[0] || 'there';

  useEffect(() => {
    getDoc(doc(db, 'settings', 'module_access'))
      .then(snap => { if (snap.exists()) setAccess({ ...DEFAULT_MODULE_ACCESS, ...snap.data() }); })
      .catch(() => {});
  }, []);

  const hasAccess = (key) => (access[key] || DEFAULT_MODULE_ACCESS[key] || []).includes(role);

  return (
    <Box sx={{
      minHeight: '100vh', bgcolor: '#0F0F1A',
      display: 'flex', flexDirection: 'column',
    }}>
      {/* Header */}
      <Box sx={{
        px: { xs: 3, md: 6 }, py: 4,
        background: 'linear-gradient(135deg,#1A1A2E 0%,#0F0F1A 100%)',
        borderBottom: '1px solid rgba(255,255,255,0.06)',
      }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 1 }}>
          <Box component="img"
            src={require('../Ceilao Logo.png')}
            alt="Ceilao" sx={{ width: 40, height: 40, objectFit: 'contain' }} />
          <Box>
            <Typography sx={{ fontWeight: 800, color: '#fff', fontSize: 22, lineHeight: 1 }}>
              Ceilao Insurance Brokers
            </Typography>
            <Typography sx={{ fontSize: 11.5, color: 'rgba(255,255,255,0.45)', fontWeight: 500, letterSpacing: 1 }}>
              OPERATIONAL MANAGEMENT PORTAL
            </Typography>
          </Box>
        </Box>
        <Typography sx={{ fontSize: 14, color: 'rgba(255,255,255,0.55)', mt: 2 }}>
          Good {new Date().getHours() < 12 ? 'morning' : new Date().getHours() < 17 ? 'afternoon' : 'evening'},{' '}
          <strong style={{ color: '#FF8B5A' }}>{name}</strong> — select a module to get started.
        </Typography>
      </Box>

      {/* Module grid */}
      <Box sx={{ flex: 1, px: { xs: 3, md: 6 }, py: 5 }}>
        <Grid container spacing={2.5}>
          {MODULES.map(mod => {
            const allowed = hasAccess(mod.key);
            return (
              <Grid item xs={12} sm={6} md={4} key={mod.key}>
                <Box
                  onClick={() => allowed && navigate(MODULE_ROUTES[mod.key])}
                  sx={{
                    borderRadius: '18px',
                    border: allowed
                      ? '1px solid rgba(255,255,255,0.10)'
                      : '1px solid rgba(255,255,255,0.04)',
                    bgcolor: allowed ? 'rgba(255,255,255,0.04)' : 'rgba(255,255,255,0.01)',
                    p: 3, cursor: allowed ? 'pointer' : 'not-allowed',
                    opacity: allowed ? 1 : 0.4,
                    transition: 'all 0.25s cubic-bezier(0.4,0,0.2,1)',
                    position: 'relative', overflow: 'hidden',
                    '&:hover': allowed ? {
                      bgcolor: 'rgba(255,255,255,0.08)',
                      transform: 'translateY(-4px)',
                      boxShadow: '0 16px 48px rgba(0,0,0,0.4)',
                      border: '1px solid rgba(255,255,255,0.16)',
                    } : {},
                  }}
                >
                  {/* gradient accent strip */}
                  <Box sx={{
                    position: 'absolute', top: 0, left: 0, right: 0, height: 3,
                    background: MODULE_GRADIENTS[mod.key],
                    opacity: allowed ? 1 : 0.3,
                    borderRadius: '18px 18px 0 0',
                  }} />

                  {/* icon */}
                  <Box sx={{
                    width: 52, height: 52, borderRadius: '14px',
                    background: allowed ? MODULE_GRADIENTS[mod.key] : 'rgba(255,255,255,0.06)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: 24, mb: 2, mt: 0.5,
                    boxShadow: allowed ? '0 8px 24px rgba(0,0,0,0.3)' : 'none',
                  }}>
                    {mod.icon}
                  </Box>

                  <Typography sx={{ fontWeight: 800, color: '#fff', fontSize: 17, mb: 0.5 }}>
                    {mod.label}
                  </Typography>
                  <Typography sx={{ fontSize: 12.5, color: 'rgba(255,255,255,0.45)', lineHeight: 1.5 }}>
                    {mod.description}
                  </Typography>

                  {!allowed && (
                    <Chip label="No access" size="small" sx={{
                      mt: 1.5, bgcolor: 'rgba(255,255,255,0.06)',
                      color: 'rgba(255,255,255,0.35)', fontSize: 10, fontWeight: 600,
                    }} />
                  )}
                </Box>
              </Grid>
            );
          })}
        </Grid>
      </Box>

      {/* Footer */}
      <Box sx={{ px: 6, py: 2.5, borderTop: '1px solid rgba(255,255,255,0.05)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <Typography sx={{ fontSize: 11.5, color: 'rgba(255,255,255,0.25)' }}>
          Ceilao Insurance Brokers (Pvt) Ltd — Internal Portal
        </Typography>
        <Chip label={role} size="small" sx={{
          bgcolor: 'rgba(255,139,90,0.15)', color: '#FF8B5A',
          fontWeight: 700, fontSize: 10.5, textTransform: 'capitalize',
        }} />
      </Box>
    </Box>
  );
};

export default OperationalMenu;
