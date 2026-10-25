// PMF BANCA Module — its own sub-space inside the portal (route /banca/:bankId/:section).
import React, { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useAuth } from '../App';
import { BANKS } from './core';
import { BancaProvider, useBanca } from './store';
import { T, PolicyDrawer } from './ui';
import ceilaoLogo from '../Ceilao Logo.png';
import pmfMark from './pmf-mark.png';
import { MasterRegister, GwpRegister, PaymentsRegister, CommissionRegister, RenewalTracker, CommissionTracker, OutstandingTracker, ExpiredTracker, CommissionSplit, Library, ClaimsTracker } from './screens/Registers';
import { UploadPage, BatchHistory, Exceptions, Reconciliation } from './screens/Operations';
import { Statements, Approvals, Targets } from './screens/Finance';
import { Dashboard } from './screens/Dashboard';
import { Settings, AuditLog } from './screens/Admin';
import { Platform } from './screens/Platform';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import Button from '@mui/material/Button';
import Alert from '@mui/material/Alert';
import Chip from '@mui/material/Chip';
import IconButton from '@mui/material/IconButton';
import Drawer from '@mui/material/Drawer';
import CircularProgress from '@mui/material/CircularProgress';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import MenuIcon from '@mui/icons-material/Menu';
import RefreshIcon from '@mui/icons-material/Refresh';

// Left navigation — the first 13 entries follow the PMF layout file order exactly.
const NAV = [
  { group: 'PMF BANCA Module', items: [
    ['master', 'Master Register'], ['gwp', 'GWP Register'], ['payments', 'Payments Register'], ['commission', 'Commission Register'],
    ['renewals', 'Renewal Tracker'], ['commission-tracker', 'Commission Tracker'], ['outstanding', 'Outstanding Tracker'], ['expired', 'Expired Policy Tracker'],
    ['split', 'PMF & Ceilao Commission Split'], ['lib-gwp', 'GWP Report Library'], ['lib-payment', 'Payment Confirmations Library'], ['lib-commission', 'Commission Reports Library'], ['claims', 'Claims Tracker'],
  ] },
  { group: 'Operations', items: [['dashboard', 'Management Dashboard'], ['upload', 'Bulk Upload'], ['batches', 'Batch History'], ['exceptions', 'Exceptions'], ['reconciliation', 'Reconciliation'], ['statements', 'PMF Statements & Payments'], ['approvals', 'Approvals'], ['lib-pmf', 'PMF Payment Library'], ['lib-claims', 'Claims Document Library']] },
  { group: 'Administration', items: [['targets', 'GWP Targets'], ['settings', 'Settings'], ['audit', 'Audit Log']] },
  { group: 'Platform Support', items: [['p-dr', 'DR Tests'], ['p-ca', 'Corrective Actions'], ['p-issue', 'Issues & Support'], ['p-incident', 'Incidents'], ['p-release', 'Releases'], ['p-training', 'Training'], ['p-improvement', 'Improvements'], ['p-dev', 'Developer Capacity']] },
];

function Shell() {
  const { bankId, section = 'master' } = useParams();
  const navigate = useNavigate();
  const ctx = useBanca();
  const { bank, loading, error, model, raw, reload, me, platform = [], loadedAt } = ctx;
  const [policy, setPolicy] = useState(null);
  const [uploadReg, setUploadReg] = useState(null);
  const [mobileNav, setMobileNav] = useState(false);
  const go = (s) => { navigate(`/banca/${bankId}/${s}`); setMobileNav(false); };
  const goUpload = (reg) => { setUploadReg(reg); go('upload'); };
  const openPolicy = (p) => p && setPolicy(model.byId.get(p.id) || p);
  const pendingMine = (raw?.approvals || []).filter(a => a.status === 'Pending' && a.maker_uid !== me.uid).length;
  const openEx = (raw?.exceptions || []).filter(e => e.status === 'Open').length;
  const incidents = platform.filter(x => x.type === 'incident' && x.status === 'Active');

  const nav = (
    <Box sx={{ width: 268, bgcolor: T.dark, color: '#fff', height: '100%', overflowY: 'auto', py: 1.5 }}>
      {NAV.map(g => (
        <Box key={g.group} sx={{ mb: 1.5 }}>
          <Typography sx={{ px: 2.2, py: 0.6, fontSize: 10.5, fontWeight: 800, letterSpacing: 1, textTransform: 'uppercase', color: 'rgba(255,255,255,0.45)' }}>{g.group}</Typography>
          {g.items.map(([k, label]) => {
            const active = section === k;
            const badge = k === 'approvals' ? pendingMine : k === 'exceptions' ? openEx : 0;
            return (
              <Box key={k} onClick={() => go(k)} sx={{ mx: 1, px: 1.4, py: 0.75, borderRadius: '8px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                bgcolor: active ? T.active : 'transparent', color: active ? T.dark : 'rgba(255,255,255,0.85)', fontWeight: active ? 800 : 500, fontSize: 13,
                '&:hover': { bgcolor: active ? T.active : 'rgba(255,255,255,0.07)' } }}>
                <span>{label}</span>{badge > 0 && <Chip size="small" label={badge} sx={{ height: 18, fontSize: 10, bgcolor: T.coral, color: '#fff' }} />}
              </Box>
            );
          })}
        </Box>
      ))}
    </Box>
  );

  let body = null;
  if (!loading && !error && model) {
    const P = { openPolicy, goUpload };
    const map = {
      master: <MasterRegister {...P} />, gwp: <GwpRegister {...P} />, payments: <PaymentsRegister {...P} />, commission: <CommissionRegister {...P} />,
      renewals: <RenewalTracker {...P} />, 'commission-tracker': <CommissionTracker {...P} />, outstanding: <OutstandingTracker {...P} />, expired: <ExpiredTracker {...P} />,
      split: <CommissionSplit {...P} />, 'lib-gwp': <Library library="gwp" />, 'lib-payment': <Library library="payment" />, 'lib-commission': <Library library="commission" />,
      'lib-pmf': <Library library="pmf_payment" />, 'lib-claims': <Library library="claims" />, claims: <ClaimsTracker {...P} />,
      dashboard: <Dashboard />, upload: <UploadPage key={uploadReg || 'u'} initialRegister={uploadReg} />, batches: <BatchHistory />, exceptions: <Exceptions {...P} />, reconciliation: <Reconciliation />,
      statements: <Statements />, approvals: <Approvals />, targets: <Targets {...P} />, settings: <Settings />, audit: <AuditLog />,
      'p-dr': <Platform kind="dr" />, 'p-ca': <Platform kind="ca" />, 'p-issue': <Platform kind="issue" />, 'p-incident': <Platform kind="incident" />, 'p-release': <Platform kind="release" />,
      'p-training': <Platform kind="training" />, 'p-improvement': <Platform kind="improvement" />, 'p-dev': <Platform kind="dev" />,
    };
    body = map[section] || <Alert severity="warning">Unknown section.</Alert>;
  }

  return (
    <Box sx={{ minHeight: '100vh', bgcolor: T.bg, display: 'flex', flexDirection: 'column' }}>
      {/* header */}
      <Box sx={{ height: 62, px: { xs: 1, md: 2 }, display: 'flex', alignItems: 'center', gap: 1.5, bgcolor: '#fff', borderBottom: `1px solid ${T.line}`, position: 'sticky', top: 0, zIndex: 20 }}>
        <IconButton sx={{ display: { md: 'none' } }} onClick={() => setMobileNav(true)}><MenuIcon /></IconButton>
        <Button startIcon={<ArrowBackIcon />} onClick={() => navigate('/menu')} sx={{ textTransform: 'none', color: T.muted, display: { xs: 'none', sm: 'inline-flex' } }}>Portal</Button>
        <Box component="img" src={ceilaoLogo} alt="Ceilao" sx={{ height: 36 }} />
        <Typography sx={{ fontWeight: 800, color: T.muted, fontSize: 18 }}>×</Typography>
        <Box component="img" src={pmfMark} alt={bank.name} sx={{ height: 34 }} />
        <Box sx={{ ml: 0.5 }}>
          <Typography sx={{ fontWeight: 900, fontSize: 17, color: T.dark, lineHeight: 1.1 }}>{bank.heading}</Typography>
          <Typography sx={{ fontSize: 11, color: T.muted }}>Module {bank.moduleNo} · Bancassurance · Ceilao Insurance Brokers (Pvt) Ltd</Typography>
        </Box>
        <Box sx={{ flex: 1 }} />
        {loadedAt && <Typography sx={{ fontSize: 11, color: '#9CA3AF', display: { xs: 'none', md: 'block' } }}>Data loaded {loadedAt.toLocaleTimeString()}</Typography>}
        <IconButton onClick={reload} title="Refresh data"><RefreshIcon /></IconButton>
        <Chip label={`${me.name} · ${me.role}`} size="small" sx={{ fontWeight: 700, display: { xs: 'none', sm: 'flex' } }} />
      </Box>
      <Box sx={{ display: 'flex', flex: 1, minHeight: 0 }}>
        <Box sx={{ display: { xs: 'none', md: 'block' }, position: 'sticky', top: 62, height: 'calc(100vh - 62px)' }}>{nav}</Box>
        <Drawer open={mobileNav} onClose={() => setMobileNav(false)} sx={{ display: { md: 'none' } }}>{nav}</Drawer>
        <Box sx={{ flex: 1, minWidth: 0, p: { xs: 1.5, md: 2.5 } }}>
          {incidents.map(i => <Alert key={i.id} severity="error" sx={{ mb: 1 }}>Incident in progress: {i.title}{i.notice ? ` — ${i.notice}` : ''}</Alert>)}
          {loading && <Box sx={{ display: 'flex', justifyContent: 'center', py: 10 }}><CircularProgress sx={{ color: T.coral }} /></Box>}
          {error && <Alert severity="error">{error}</Alert>}
          {body}
        </Box>
      </Box>
      <PolicyDrawer policy={policy} model={model || { byId: new Map() }} batches={raw?.batches} files={raw?.files} onClose={() => setPolicy(null)} onOpenPolicy={openPolicy} />
    </Box>
  );
}

export default function BancaPage() {
  const { bankId } = useParams();
  const { hasAccess } = useAuth();
  const navigate = useNavigate();
  const bank = BANKS[bankId];
  if (!bank) return <Box sx={{ p: 4 }}><Alert severity="error">Unknown bank module.</Alert></Box>;
  if (!hasAccess(`banca_${bankId}`)) return (
    <Box sx={{ p: 4 }}><Alert severity="warning" action={<Button onClick={() => navigate('/menu')}>Back</Button>}>You don't have access to the {bank.title} module. Ask an administrator to grant it in Admin Panel → Module Access.</Alert></Box>
  );
  return <BancaProvider bankId={bankId}><Shell /></BancaProvider>;
}
