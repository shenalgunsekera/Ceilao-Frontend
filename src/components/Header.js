import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useLocation } from 'react-router-dom';
import {
  collection, addDoc, updateDoc, doc,
  query, where, getDocs, serverTimestamp, Timestamp,
} from 'firebase/firestore';
import { db } from '../firebase';
import { useAuth } from '../App';

import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import TextField from '@mui/material/TextField';
import Avatar from '@mui/material/Avatar';
import Chip from '@mui/material/Chip';
import Button from '@mui/material/Button';
import Tooltip from '@mui/material/Tooltip';
import InputAdornment from '@mui/material/InputAdornment';
import SearchIcon from '@mui/icons-material/Search';
import PeopleOutlineIcon from '@mui/icons-material/PeopleOutline';
import BarChartIcon from '@mui/icons-material/BarChart';
import AccessTimeIcon from '@mui/icons-material/AccessTime';
import LoginIcon from '@mui/icons-material/Login';
import LogoutIcon from '@mui/icons-material/Logout';

const pageMeta = {
  '/':             { title: 'Underwriting', sub: 'Policy issuance and client records',    icon: <PeopleOutlineIcon /> },
  '/underwriting': { title: 'Underwriting', sub: 'Policy issuance and client records',    icon: <PeopleOutlineIcon /> },
  '/reports':      { title: 'Reports',      sub: 'Financial summaries and analytics',     icon: <BarChartIcon /> },
};

function fmtElapsed(seconds) {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  return h > 0
    ? `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
    : `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

const Header = () => {
  const { userProfile, user, searchQuery, setSearchQuery } = useAuth();
  const location = useLocation();
  const meta     = pageMeta[location.pathname] || pageMeta['/'];
  const role     = userProfile?.role || '';
  const name     = userProfile?.full_name || user?.email?.split('@')[0] || '';
  const initials = name.split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2) || 'U';
  const isClients = location.pathname === '/' || location.pathname === '/underwriting';

  // ── Work-hours clock-in state ──
  const [activeSession,  setActiveSession]  = useState(null); // { id, clockInTs }
  const [elapsed,        setElapsed]        = useState(0);    // seconds
  const [clockBusy,      setClockBusy]      = useState(false);
  const timerRef = useRef(null);

  const startTimer = useCallback((clockInTs) => {
    clearInterval(timerRef.current);
    timerRef.current = setInterval(() => {
      const secs = Math.floor((Date.now() - clockInTs) / 1000);
      setElapsed(secs);
    }, 1000);
  }, []);

  // On mount: check for an open session today for this user
  useEffect(() => {
    if (!user) return;
    const today = new Date().toISOString().slice(0, 10);
    getDocs(query(
      collection(db, 'work_sessions'),
      where('user_id', '==', user.uid),
      where('date',    '==', today),
      where('clock_out', '==', null),
    )).then(snap => {
      if (snap.empty) return;
      const d = snap.docs[0];
      const ts = d.data().clock_in?.toDate?.()?.getTime() || Date.now();
      setActiveSession({ id: d.id, clockInTs: ts });
      startTimer(ts);
    }).catch(() => {});
  }, [user, startTimer]);

  useEffect(() => () => clearInterval(timerRef.current), []);

  const handleClockIn = async () => {
    if (!user || clockBusy) return;
    setClockBusy(true);
    try {
      const today = new Date().toISOString().slice(0, 10);
      const ref = await addDoc(collection(db, 'work_sessions'), {
        user_id:    user.uid,
        user_email: user.email || '',
        user_name:  userProfile?.full_name || name,
        date:       today,
        clock_in:   serverTimestamp(),
        clock_out:  null,
        duration_minutes: null,
        notes: '',
      });
      const ts = Date.now();
      setActiveSession({ id: ref.id, clockInTs: ts });
      setElapsed(0);
      startTimer(ts);
    } catch (_) {}
    setClockBusy(false);
  };

  const handleClockOut = async () => {
    if (!activeSession || clockBusy) return;
    setClockBusy(true);
    try {
      const now = Timestamp.now();
      const minutes = Math.round(elapsed / 60);
      await updateDoc(doc(db, 'work_sessions', activeSession.id), {
        clock_out:        now,
        duration_minutes: minutes,
      });
      clearInterval(timerRef.current);
      setActiveSession(null);
      setElapsed(0);
    } catch (_) {}
    setClockBusy(false);
  };

  const isClockedIn = !!activeSession;

  return (
    <Box sx={{
      position: 'sticky', top: 0, zIndex: 100,
      bgcolor: 'rgba(255,255,255,0.96)',
      backdropFilter: 'blur(12px)',
      borderBottom: '1px solid rgba(255,139,90,0.12)',
      boxShadow: '0 2px 16px rgba(255,90,90,0.06)',
      px: { xs: 2, sm: 3 }, py: 1.5,
      display: 'flex', alignItems: 'center', gap: 2,
    }}>
      {/* page info */}
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.2, minWidth: 0, flex: 1 }}>
        <Box sx={{
          width: 36, height: 36, borderRadius: '10px',
          background: 'linear-gradient(135deg,#FF5A5A,#FF8B5A)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          flexShrink: 0,
          '& svg': { color: '#fff', fontSize: 18 },
        }}>
          {meta.icon}
        </Box>
        <Box sx={{ minWidth: 0 }}>
          <Typography sx={{ fontWeight: 700, fontSize: 16, color: '#1A1A2E', lineHeight: 1.2, whiteSpace: 'nowrap' }}>
            {meta.title}
          </Typography>
          <Typography sx={{ fontSize: 11.5, color: '#9CA3AF', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', display: { xs: 'none', sm: 'block' } }}>
            {meta.sub}
          </Typography>
        </Box>
      </Box>

      {/* search — only on clients page */}
      {isClients && (
        <TextField
          placeholder="Search by name, mobile, policy…"
          size="small"
          value={searchQuery}
          onChange={e => setSearchQuery(e.target.value)}
          sx={{
            width: { xs: 160, sm: 260, md: 320 },
            '& .MuiOutlinedInput-root': {
              borderRadius: '12px',
              bgcolor: '#FFF8F5',
              fontSize: 13,
              '& fieldset': { borderColor: 'rgba(255,139,90,0.25)' },
              '&:hover fieldset': { borderColor: '#FF8B5A' },
              '&.Mui-focused fieldset': { borderColor: '#FF5A5A', borderWidth: 2 },
            },
          }}
          InputProps={{
            startAdornment: (
              <InputAdornment position="start">
                <SearchIcon sx={{ fontSize: 17, color: '#FF8B5A' }} />
              </InputAdornment>
            ),
          }}
        />
      )}

      {/* ── Clock-in / Clock-out widget ── */}
      {user && (
        <Tooltip title={isClockedIn ? 'Clock out' : 'Clock in to start tracking work hours'} arrow>
          <Button
            size="small"
            variant={isClockedIn ? 'contained' : 'outlined'}
            startIcon={isClockedIn ? <LogoutIcon sx={{ fontSize: 15 }} /> : <LoginIcon sx={{ fontSize: 15 }} />}
            onClick={isClockedIn ? handleClockOut : handleClockIn}
            disabled={clockBusy}
            sx={{
              fontSize: 12,
              fontWeight: 700,
              textTransform: 'none',
              borderRadius: '10px',
              flexShrink: 0,
              minWidth: 0,
              px: 1.5,
              ...(isClockedIn
                ? {
                    background: 'linear-gradient(135deg,#10B981,#059669)',
                    boxShadow: '0 2px 8px rgba(16,185,129,0.30)',
                    '&:hover': { background: 'linear-gradient(135deg,#059669,#047857)' },
                  }
                : {
                    borderColor: 'rgba(255,139,90,0.40)',
                    color: '#FF8B5A',
                    '&:hover': { borderColor: '#FF5A5A', color: '#FF5A5A', bgcolor: 'rgba(255,90,90,0.04)' },
                  }),
            }}
          >
            {isClockedIn ? (
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.6 }}>
                <AccessTimeIcon sx={{ fontSize: 13 }} />
                <span>{fmtElapsed(elapsed)}</span>
              </Box>
            ) : (
              <Box sx={{ display: { xs: 'none', sm: 'block' } }}>Clock In</Box>
            )}
          </Button>
        </Tooltip>
      )}

      {/* user badge */}
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.2, flexShrink: 0 }}>
        {role && (
          <Chip
            label={role}
            size="small"
            sx={{
              fontWeight: 700, fontSize: 11, textTransform: 'capitalize',
              background: 'linear-gradient(135deg,rgba(255,90,90,0.12),rgba(255,139,90,0.10))',
              color: '#FF5A5A', border: '1px solid rgba(255,90,90,0.20)',
              display: { xs: 'none', sm: 'flex' },
            }}
          />
        )}
        <Avatar sx={{
          width: 34, height: 34, fontSize: 12, fontWeight: 700,
          background: 'linear-gradient(135deg,#FF5A5A,#FF8B5A)',
          boxShadow: '0 2px 10px rgba(255,90,90,0.30)',
          cursor: 'default',
        }}>
          {initials}
        </Avatar>
      </Box>
    </Box>
  );
};

export default Header;
