import React, { useState, useMemo } from 'react';
import { collection, getDocs, query, orderBy } from 'firebase/firestore';
import { db } from '../firebase';
import Papa from 'papaparse';

import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import Card from '@mui/material/Card';
import CardContent from '@mui/material/CardContent';
import Button from '@mui/material/Button';
import Stack from '@mui/material/Stack';
import Table from '@mui/material/Table';
import TableBody from '@mui/material/TableBody';
import TableCell from '@mui/material/TableCell';
import TableContainer from '@mui/material/TableContainer';
import TableHead from '@mui/material/TableHead';
import TableRow from '@mui/material/TableRow';
import Paper from '@mui/material/Paper';
import Skeleton from '@mui/material/Skeleton';
import Collapse from '@mui/material/Collapse';
import Chip from '@mui/material/Chip';
import { LocalizationProvider, DatePicker } from '@mui/x-date-pickers';
import { AdapterDateFns } from '@mui/x-date-pickers/AdapterDateFns';

import BarChartIcon from '@mui/icons-material/BarChart';
import PeopleOutlineIcon from '@mui/icons-material/PeopleOutline';
import MonetizationOnOutlinedIcon from '@mui/icons-material/MonetizationOnOutlined';
import FileDownloadOutlinedIcon from '@mui/icons-material/FileDownloadOutlined';
import RefreshIcon from '@mui/icons-material/Refresh';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import ExpandLessIcon from '@mui/icons-material/ExpandLess';
import TrendingUpIcon from '@mui/icons-material/TrendingUp';
import WarningAmberIcon from '@mui/icons-material/WarningAmber';

/* ── summary stat ─────────────────────────────────────────────────────── */
function SumStat({ label, value, gradient, icon }) {
  return (
    <Box sx={{
      p: 2.5, borderRadius: '14px',
      background: gradient,
      flex: 1, minWidth: 140,
    }}>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
        <Typography sx={{ fontSize: 11, fontWeight: 700, color: 'rgba(255,255,255,0.8)', textTransform: 'uppercase', letterSpacing: 0.6 }}>
          {label}
        </Typography>
        <Box sx={{ '& svg': { color: 'rgba(255,255,255,0.7)', fontSize: 18 } }}>{icon}</Box>
      </Box>
      <Typography sx={{ fontSize: 20, fontWeight: 800, color: '#fff', lineHeight: 1 }}>
        {value}
      </Typography>
    </Box>
  );
}

/* ── report card ──────────────────────────────────────────────────────── */
function ReportCard({ title, description, icon, expanded, onToggle, children, onDownload, downloadLabel, loading }) {
  return (
    <Card className="anim-fade-up card-hover" sx={{ mb: 2.5 }}>
      <CardContent sx={{ p: 0, '&:last-child': { pb: 0 } }}>
        {/* header */}
        <Box sx={{
          px: 3, py: 2,
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          borderBottom: expanded ? '1px solid rgba(255,139,90,0.10)' : 'none',
          cursor: 'pointer',
          '&:hover': { bgcolor: 'rgba(255,90,90,0.02)' },
          transition: 'background 0.15s ease',
        }} onClick={onToggle}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
            <Box sx={{
              width: 38, height: 38, borderRadius: '10px',
              background: 'linear-gradient(135deg,#FF5A5A,#FF8B5A)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              '& svg': { color: '#fff', fontSize: 18 },
            }}>
              {icon}
            </Box>
            <Box>
              <Typography sx={{ fontWeight: 700, fontSize: 15, color: '#1A1A2E' }}>{title}</Typography>
              <Typography sx={{ fontSize: 12, color: '#9CA3AF' }}>{description}</Typography>
            </Box>
          </Box>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            {onDownload && (
              <Button
                size="small" variant="outlined" startIcon={<FileDownloadOutlinedIcon />}
                onClick={e => { e.stopPropagation(); onDownload(); }}
                sx={{ fontSize: 11.5, borderColor: 'rgba(255,139,90,0.30)', color: '#FF8B5A',
                      '&:hover': { borderColor: '#FF8B5A', bgcolor: 'rgba(255,139,90,0.06)' } }}
              >
                {downloadLabel || 'Export CSV'}
              </Button>
            )}
            {expanded ? <ExpandLessIcon sx={{ color: '#9CA3AF' }} /> : <ExpandMoreIcon sx={{ color: '#9CA3AF' }} />}
          </Box>
        </Box>

        {/* body */}
        <Collapse in={expanded} timeout={280} unmountOnExit>
          <Box sx={{ px: 3, py: 2.5 }}>
            {loading
              ? <Stack spacing={1}>
                  {[1,2,3,4].map(i => <Skeleton key={i} height={36} sx={{ bgcolor: 'rgba(255,90,90,0.05)', borderRadius: '8px' }} />)}
                </Stack>
              : children
            }
          </Box>
        </Collapse>
      </CardContent>
    </Card>
  );
}

/* ── main ─────────────────────────────────────────────────────────────── */
const ReportsPage = () => {
  const [clients,    setClients]    = useState([]);
  const [loading,    setLoading]    = useState(false);
  const [expanded,   setExpanded]   = useState('');
  const [dateFrom,   setDateFrom]   = useState(null);
  const [dateTo,     setDateTo]     = useState(null);
  const [useRange,   setUseRange]   = useState(false);

  const fetchAll = async () => {
    setLoading(true);
    try {
      const q = query(collection(db, 'clients'), orderBy('created_at', 'desc'));
      const snap = await getDocs(q);
      setClients(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    } catch { /* ignore */ }
    setLoading(false);
  };

  const handleToggle = (card) => {
    if (expanded !== card) {
      setExpanded(card);
      if (!clients.length) fetchAll();
    } else {
      setExpanded('');
    }
  };

  const filteredClients = useMemo(() => {
    if (!useRange || (!dateFrom && !dateTo)) return clients;
    return clients.filter(c => {
      const d = c.policy_period_from ? new Date(c.policy_period_from) : null;
      if (!d) return false;
      if (dateFrom && d < dateFrom) return false;
      if (dateTo   && d > dateTo)   return false;
      return true;
    });
  }, [clients, useRange, dateFrom, dateTo]);

  const summary = useMemo(() => {
    const sum = (k) => filteredClients.reduce((a, c) => a + (Number(c[k]) || 0), 0);
    return {
      total:     filteredClients.length,
      sumInsured: sum('sum_insured'),
      basicPrem:  sum('basic_premium'),
      netPrem:    sum('net_premium'),
      totalInv:   sum('total_invoice'),
      expiring:   filteredClients.filter(c => {
        const d = c.policy_period_to ? Math.ceil((new Date(c.policy_period_to) - new Date()) / 86400000) : null;
        return d !== null && d >= 0 && d <= 30;
      }).length,
      expired: filteredClients.filter(c => {
        const d = c.policy_period_to ? Math.ceil((new Date(c.policy_period_to) - new Date()) / 86400000) : null;
        return d !== null && d < 0;
      }).length,
    };
  }, [filteredClients]);

  const lkr = (v) => `LKR ${Number(v).toLocaleString()}`;

  /* exports */
  const exportClientCSV = () => {
    const headers = ['Client Name','Mobile','Product','Policy No','Period From','Period To','Net Premium','Total Invoice'];
    const data = filteredClients.map(c => [
      c.client_name, c.mobile_no, c.product, c.policy_no,
      c.policy_period_from, c.policy_period_to, c.net_premium, c.total_invoice,
    ]);
    const now = new Date();
    const ts = `${now.getFullYear()}${String(now.getMonth()+1).padStart(2,'0')}${String(now.getDate()).padStart(2,'0')}`;
    const a = Object.assign(document.createElement('a'), {
      href: URL.createObjectURL(new Blob([Papa.unparse({ fields: headers, data })], { type: 'text/csv' })),
      download: `ceilao_clients_${ts}.csv`,
    });
    a.click(); URL.revokeObjectURL(a.href);
  };

  const exportSummaryCSV = () => {
    const csv = Papa.unparse([
      ['Metric','Value'],
      ['Total Clients',   summary.total],
      ['Sum Insured',     summary.sumInsured],
      ['Basic Premium',   summary.basicPrem],
      ['Net Premium',     summary.netPrem],
      ['Total Invoice',   summary.totalInv],
      ['Expiring (30d)',  summary.expiring],
      ['Expired',         summary.expired],
    ]);
    const a = Object.assign(document.createElement('a'), {
      href: URL.createObjectURL(new Blob([csv], { type: 'text/csv' })),
      download: `ceilao_summary_${Date.now()}.csv`,
    });
    a.click(); URL.revokeObjectURL(a.href);
  };

  /* date range filter UI */
  const DateRangeFilter = () => (
    <Box sx={{ mb: 2.5 }}>
      <Stack direction="row" spacing={1} sx={{ mb: 1.5 }} flexWrap="wrap">
        <Chip
          label="All time" clickable size="small"
          onClick={() => setUseRange(false)}
          sx={{ fontWeight: 700, fontSize: 12,
                background: !useRange ? 'linear-gradient(135deg,#FF5A5A,#FF8B5A)' : 'rgba(255,90,90,0.08)',
                color: !useRange ? '#fff' : '#FF5A5A' }}
        />
        <Chip
          label="Date range" clickable size="small"
          onClick={() => setUseRange(true)}
          sx={{ fontWeight: 700, fontSize: 12,
                background: useRange ? 'linear-gradient(135deg,#FF5A5A,#FF8B5A)' : 'rgba(255,90,90,0.08)',
                color: useRange ? '#fff' : '#FF5A5A' }}
        />
        <Button size="small" startIcon={<RefreshIcon />} onClick={fetchAll}
          sx={{ fontSize: 11.5, color: '#9CA3AF', '&:hover': { color: '#FF5A5A' } }}>
          Refresh
        </Button>
      </Stack>
      {useRange && (
        <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.5} alignItems="center">
          <DatePicker
            label="From date" value={dateFrom} onChange={setDateFrom}
            slotProps={{ textField: { size: 'small', sx: { minWidth: 160, '& .MuiOutlinedInput-root': { borderRadius: '10px', fontSize: 13 } } } }}
          />
          <DatePicker
            label="To date" value={dateTo} onChange={setDateTo}
            slotProps={{ textField: { size: 'small', sx: { minWidth: 160, '& .MuiOutlinedInput-root': { borderRadius: '10px', fontSize: 13 } } } }}
          />
        </Stack>
      )}
    </Box>
  );

  return (
    <LocalizationProvider dateAdapter={AdapterDateFns}>
      <Box className="page-enter" sx={{ maxWidth: 1000, mx: 'auto' }}>
        <Typography variant="h5" sx={{ mb: 0.5, fontWeight: 800 }}>Reports</Typography>
        <Typography sx={{ fontSize: 13, color: '#9CA3AF', mb: 3 }}>
          Financial summaries, client analytics, and export tools.
        </Typography>

        {/* ── summary overview ────────────────────────────────── */}
        <ReportCard
          title="Financial Summary"
          description="Portfolio totals and premium breakdown"
          icon={<MonetizationOnOutlinedIcon />}
          expanded={expanded === 'summary'}
          onToggle={() => handleToggle('summary')}
          onDownload={filteredClients.length ? exportSummaryCSV : null}
          loading={loading}
        >
          <DateRangeFilter />
          <Typography sx={{ fontSize: 12, color: '#9CA3AF', mb: 1.5 }}>
            Based on {filteredClients.length} client{filteredClients.length !== 1 ? 's' : ''}
          </Typography>

          {/* summary stat boxes */}
          <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.5} flexWrap="wrap" sx={{ mb: 2.5 }}>
            <SumStat label="Sum Insured"  value={lkr(summary.sumInsured)} gradient="linear-gradient(135deg,#FF5A5A,#FF8B5A)" icon={<TrendingUpIcon />} />
            <SumStat label="Net Premium"  value={lkr(summary.netPrem)}   gradient="linear-gradient(135deg,#FFA95A,#FFD45A)" icon={<MonetizationOnOutlinedIcon />} />
            <SumStat label="Total Invoice" value={lkr(summary.totalInv)} gradient="linear-gradient(135deg,#6366f1,#818cf8)" icon={<BarChartIcon />} />
          </Stack>

          {/* expiry overview */}
          <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap' }}>
            <Box sx={{ p: 2, borderRadius: '12px', bgcolor: 'rgba(245,158,11,0.08)', border: '1px solid rgba(245,158,11,0.20)', flex: 1, minWidth: 130 }}>
              <WarningAmberIcon sx={{ color: '#d97706', fontSize: 20, mb: 0.5 }} />
              <Typography sx={{ fontSize: 22, fontWeight: 800, color: '#d97706' }}>{summary.expiring}</Typography>
              <Typography sx={{ fontSize: 12, color: '#6B7280' }}>Expiring in 30 days</Typography>
            </Box>
            <Box sx={{ p: 2, borderRadius: '12px', bgcolor: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.20)', flex: 1, minWidth: 130 }}>
              <WarningAmberIcon sx={{ color: '#dc2626', fontSize: 20, mb: 0.5 }} />
              <Typography sx={{ fontSize: 22, fontWeight: 800, color: '#dc2626' }}>{summary.expired}</Typography>
              <Typography sx={{ fontSize: 12, color: '#6B7280' }}>Expired policies</Typography>
            </Box>
            <Box sx={{ p: 2, borderRadius: '12px', bgcolor: 'rgba(255,90,90,0.06)', border: '1px solid rgba(255,90,90,0.15)', flex: 1, minWidth: 130 }}>
              <PeopleOutlineIcon sx={{ color: '#FF5A5A', fontSize: 20, mb: 0.5 }} />
              <Typography sx={{ fontSize: 22, fontWeight: 800, color: '#FF5A5A' }}>{summary.total}</Typography>
              <Typography sx={{ fontSize: 12, color: '#6B7280' }}>Total clients</Typography>
            </Box>
          </Box>
        </ReportCard>

        {/* ── client list ─────────────────────────────────────── */}
        <ReportCard
          title="Client List"
          description="Full client list with policy details"
          icon={<PeopleOutlineIcon />}
          expanded={expanded === 'clients'}
          onToggle={() => handleToggle('clients')}
          onDownload={filteredClients.length ? exportClientCSV : null}
          loading={loading}
        >
          <DateRangeFilter />
          {filteredClients.length === 0 ? (
            <Box sx={{ textAlign: 'center', py: 4 }}>
              <Typography sx={{ color: '#9CA3AF' }}>No clients found for selected range.</Typography>
            </Box>
          ) : (
            <TableContainer component={Paper} elevation={0} sx={{ border: '1px solid rgba(255,139,90,0.10)', borderRadius: '12px', maxHeight: 440 }}>
              <Table stickyHeader size="small">
                <TableHead>
                  <TableRow>
                    <TableCell>Client Name</TableCell>
                    <TableCell>Product</TableCell>
                    <TableCell>Policy No</TableCell>
                    <TableCell>Period From</TableCell>
                    <TableCell>Period To</TableCell>
                    <TableCell align="right">Net Premium</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {filteredClients.map((c, i) => (
                    <TableRow key={c.id} sx={{ bgcolor: i % 2 === 0 ? '#fff' : 'rgba(255,248,245,0.6)' }}>
                      <TableCell sx={{ fontWeight: 600 }}>{c.client_name}</TableCell>
                      <TableCell>{c.product}</TableCell>
                      <TableCell sx={{ fontFamily: 'monospace' }}>{c.policy_no || '—'}</TableCell>
                      <TableCell>{c.policy_period_from || '—'}</TableCell>
                      <TableCell>{c.policy_period_to || '—'}</TableCell>
                      <TableCell align="right" sx={{ fontWeight: 700 }}>
                        {c.net_premium ? `LKR ${Number(c.net_premium).toLocaleString()}` : '—'}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
          )}
        </ReportCard>
      </Box>
    </LocalizationProvider>
  );
};

export default ReportsPage;
