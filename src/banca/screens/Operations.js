// S-15 Bulk upload · S-16 Batch history & reversal · S-17 Exceptions · S-18 Reconciliation
import React, { useMemo, useState } from 'react';
import { saveAs } from 'file-saver';
import { openFile } from '../../storage';
import { useBanca, postBatch, storeLibraryFile, fileFingerprint, newId, requestApproval, saveConfig, audit, setRecord, nowIso } from '../store';
import { TEMPLATES, parseFile, validate, templateWorkbook, errorWorkbook } from '../templates';
import { DataGrid, StatusChip, Kpi, SectionTitle, T, btnPrimary, btnOutline } from '../ui';
import { lkr, round2, num, reconciliation, monthEnd, todayYmd, monthOf } from '../core';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import Button from '@mui/material/Button';
import Stack from '@mui/material/Stack';
import TextField from '@mui/material/TextField';
import MenuItem from '@mui/material/MenuItem';
import Alert from '@mui/material/Alert';
import LinearProgress from '@mui/material/LinearProgress';
import Checkbox from '@mui/material/Checkbox';
import FormControlLabel from '@mui/material/FormControlLabel';
import Dialog from '@mui/material/Dialog';
import DialogTitle from '@mui/material/DialogTitle';
import DialogContent from '@mui/material/DialogContent';
import DialogActions from '@mui/material/DialogActions';
import Autocomplete from '@mui/material/Autocomplete';
import Table from '@mui/material/Table';
import TableHead from '@mui/material/TableHead';
import TableBody from '@mui/material/TableBody';
import TableRow from '@mui/material/TableRow';
import TableCell from '@mui/material/TableCell';
import Tabs from '@mui/material/Tabs';
import Tab from '@mui/material/Tab';
import IconButton from '@mui/material/IconButton';
import FileDownloadOutlinedIcon from '@mui/icons-material/FileDownloadOutlined';
import UploadFileOutlinedIcon from '@mui/icons-material/UploadFileOutlined';
import AddIcon from '@mui/icons-material/Add';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline';

const UPLOAD_REGISTERS = ['master', 'gwp', 'renewals', 'payments', 'commission', 'claims', 'targets'];

export function UploadPage({ initialRegister, onPosted }) {
  const ctx = useBanca();
  const { bank, bankId, raw, config, me, reload, model } = ctx;
  const [register, setRegister] = useState(initialRegister && TEMPLATES[initialRegister] ? initialRegister : 'master');
  const [file, setFile] = useState(null);
  const [declCount, setDeclCount] = useState(''); const [declTotal, setDeclTotal] = useState('');
  const [doc, setDoc] = useState(null); const [docIns, setDocIns] = useState(''); const [docFrom, setDocFrom] = useState(''); const [docTo, setDocTo] = useState('');
  const [corrects, setCorrects] = useState('');
  const [parsed, setParsed] = useState(null); const [plan, setPlan] = useState(null); const [batchId, setBatchId] = useState('');
  const [fp, setFp] = useState('');
  const [err, setErr] = useState(''); const [busy, setBusy] = useState(false); const [pct, setPct] = useState(0);
  const [overrideReason, setOverrideReason] = useState(''); const [addMasters, setAddMasters] = useState(true);
  const [done, setDone] = useState(null);
  const tpl = TEMPLATES[register];
  const isApprover = me.role === 'admin' || me.role === 'manager';
  const insurers = useMemo(() => [...new Set(model.policies.map(p => p.insurer))].sort(), [model]);
  const reset = () => { setFile(null); setParsed(null); setPlan(null); setErr(''); setDone(null); setPct(0); setOverrideReason(''); setFp(''); };

  const downloadTemplate = async () => { const buf = await templateWorkbook(register, bank.name); saveAs(new Blob([buf]), `${bank.name}_${register}_template_v1.xlsx`); };
  const runValidation = async () => {
    setErr(''); setPlan(null); setBusy(true);
    try {
      const fingerprint = await fileFingerprint(file);
      const dupBatch = (raw.batches || []).find(b => b.file_hash === fingerprint && b.register === register && b.status !== 'Reversed' && b.type !== 'Reversal');
      if (dupBatch) throw new Error(`This exact file was already posted (batch ${dupBatch.id}, ${String(dupBatch.uploaded_at).slice(0, 10)} by ${dupBatch.uploaded_by}). Reverse that batch first if it must be re-posted.`);
      const p = await parseFile(file, tpl);
      const id = newId(bankId, 'batches');
      const v = validate(register, p, raw, config, { batchId: id, user: me.name, bankId });
      if (v.fatal) throw new Error(v.fatal);
      setParsed(p); setPlan(v); setBatchId(id); setFp(fingerprint);
    } catch (e) { setErr(e.message || 'Could not read the file'); }
    setBusy(false);
  };
  const variance = plan && ((declCount !== '' && num(declCount) !== plan.stats.count) || (declTotal !== '' && Math.abs(num(declTotal) - plan.stats.total) > 0.01));
  const canConfirm = plan && plan.stats.accepted > 0 && declCount !== '' && declTotal !== '' && (!variance || (isApprover && overrideReason.trim()));
  const confirm = async () => {
    setBusy(true); setErr('');
    try {
      let fileId = '';
      if (doc && tpl.library) fileId = (await storeLibraryFile(ctx, doc, { library: tpl.library, insurer: docIns, from: docFrom, to: docTo, batch_id: batchId })).id;
      const counts = await postBatch(ctx, { batchId, register, plan, fileName: file.name, fileHash: fp, fileId, declared: { count: num(declCount), total: num(declTotal) },
        override: variance ? { by: me.name, reason: overrideReason } : null, corrects, onProgress: setPct });
      const nm = plan.newMasters || {};
      if (addMasters && (nm.insurers?.length || nm.branches?.length || nm.classes?.length)) {
        await saveConfig(ctx, { insurers: [...new Set([...(config.insurers || []), ...(nm.insurers || [])])], branches: [...new Set([...(config.branches || []), ...(nm.branches || [])])], classes: [...new Set([...(config.classes || []), ...(nm.classes || [])])] }, `Masters added from batch ${batchId}`).catch(() => {});
      }
      setDone({ counts, stats: plan.stats }); await reload(); onPosted && onPosted();
    } catch (e) { setErr(`Posting stopped: ${e.message}. It is safe to retry — rows already written are not duplicated.`); }
    setBusy(false);
  };
  const reversedSame = (raw.batches || []).filter(b => b.register === register && b.status === 'Reversed' && !b.corrected_by);

  return (<>
    <SectionTitle sub="Download the standard template, declare the record count and control total, validate, review accepted / rejected / duplicate counts, then confirm. Only accepted rows post; nothing posts before confirmation.">Bulk Upload</SectionTitle>
    <Stack direction="row" spacing={1} useFlexGap flexWrap="wrap" sx={{ mb: 2 }}>
      {UPLOAD_REGISTERS.map(k => (
        <Box key={k} onClick={() => { if (!busy) { setRegister(k); reset(); } }} sx={{ cursor: 'pointer', px: 1.6, py: 1, borderRadius: '10px', border: `2px solid ${register === k ? T.coral : T.line}`, bgcolor: register === k ? '#FFF1EC' : '#fff' }}>
          <Typography sx={{ fontWeight: 800, fontSize: 13 }}>{TEMPLATES[k].label}</Typography>
        </Box>
      ))}
    </Stack>
    <Box sx={{ p: 2, bgcolor: '#fff', borderRadius: '14px', border: `1px solid ${T.line}` }}>
      <Typography sx={{ fontSize: 12.5, color: T.muted, mb: 1.5 }}>{tpl.note}</Typography>
      <Stack direction={{ xs: 'column', md: 'row' }} spacing={1.5} alignItems={{ md: 'center' }}>
        <Button startIcon={<FileDownloadOutlinedIcon />} variant="outlined" sx={btnOutline} onClick={downloadTemplate}>Download template</Button>
        <Button component="label" startIcon={<UploadFileOutlinedIcon />} variant="outlined" sx={btnOutline} disabled={busy}>
          {file ? file.name : 'Choose .xlsx / .csv'}<input hidden type="file" accept=".xlsx,.csv" onChange={e => { reset(); setFile(e.target.files?.[0] || null); }} />
        </Button>
        <TextField size="small" type="number" label="Declared record count *" value={declCount} onChange={e => setDeclCount(e.target.value)} sx={{ width: 190 }} />
        <TextField size="small" type="number" label={`Declared control total (${tpl.control}) *`} value={declTotal} onChange={e => setDeclTotal(e.target.value)} sx={{ width: 260 }} />
      </Stack>
      {tpl.library && (
        <Stack direction={{ xs: 'column', md: 'row' }} spacing={1.5} alignItems={{ md: 'center' }} sx={{ mt: 1.5 }}>
          <Button component="label" variant="outlined" sx={{ ...btnOutline, color: '#374151', borderColor: '#D1D5DB' }} disabled={busy}>
            {doc ? doc.name : 'Source document (insurer statement PDF) — recommended'}<input hidden type="file" accept=".pdf,.png,.jpg,.jpeg,.xlsx,.xls,.csv" onChange={e => setDoc(e.target.files?.[0] || null)} />
          </Button>
          {doc && <>
            <Autocomplete freeSolo size="small" options={insurers} value={docIns} onInputChange={(_, v) => setDocIns(v)} sx={{ width: 220 }} renderInput={p => <TextField {...p} label="Insurance company" />} />
            <TextField size="small" type="date" label="Statement from" value={docFrom} onChange={e => setDocFrom(e.target.value)} InputLabelProps={{ shrink: true }} />
            <TextField size="small" type="date" label="to" value={docTo} onChange={e => setDocTo(e.target.value)} InputLabelProps={{ shrink: true }} />
          </>}
        </Stack>
      )}
      {reversedSame.length > 0 && (
        <TextField select size="small" label="This upload corrects a reversed batch (optional)" value={corrects} onChange={e => setCorrects(e.target.value)} sx={{ mt: 1.5, minWidth: 380 }}>
          <MenuItem value="">— not a correction —</MenuItem>
          {reversedSame.map(b => <MenuItem key={b.id} value={b.id}>{b.file_name} · {String(b.uploaded_at).slice(0, 10)} · {b.id}</MenuItem>)}
        </TextField>
      )}
      <Stack direction="row" spacing={1} sx={{ mt: 2 }}>
        <Button sx={btnPrimary} disabled={!file || busy} onClick={runValidation}>{busy && !plan ? 'Validating…' : 'Validate'}</Button>
        {plan && <Button sx={btnPrimary} disabled={!canConfirm || busy || !!done} onClick={confirm}>{busy ? 'Posting…' : `Confirm & post ${plan.stats.accepted} row(s)`}</Button>}
        {plan && !done && <Button onClick={reset} disabled={busy} sx={{ textTransform: 'none' }}>Cancel</Button>}
      </Stack>
      {busy && plan && <LinearProgress variant="determinate" value={pct} sx={{ mt: 1.5 }} />}
      {err && <Alert severity="error" sx={{ mt: 1.5 }}>{err}</Alert>}
    </Box>

    {plan && (
      <Box sx={{ mt: 2 }}>
        <Stack direction="row" spacing={1.2} useFlexGap flexWrap="wrap" sx={{ mb: 1.5 }}>
          <Kpi label="Rows in file" value={plan.stats.count} sub={declCount !== '' ? `Declared ${num(declCount)}` : 'Declare the count'} color={declCount !== '' && num(declCount) !== plan.stats.count ? T.danger : undefined} />
          <Kpi label="Accepted" value={plan.stats.accepted} sub={`LKR ${lkr(plan.stats.acceptedTotal)}`} color={T.green} />
          <Kpi label="Rejected" value={plan.stats.rejected} sub={`LKR ${lkr(plan.stats.rejectedTotal)}`} color={plan.stats.rejected ? T.danger : undefined} />
          <Kpi label="Duplicates" value={plan.stats.duplicates} sub={`LKR ${lkr(plan.stats.duplicateTotal)}`} />
          {(register === 'payments' || register === 'commission') && <Kpi label="Unmatched → Exceptions" value={plan.stats.unmatched} sub={`LKR ${lkr(plan.stats.unmatchedTotal)}`} color={plan.stats.unmatched ? T.amber : undefined} />}
          <Kpi label={`Computed ${tpl.control}`} value={`LKR ${lkr(plan.stats.total)}`} sub={declTotal !== '' ? `Declared LKR ${lkr(num(declTotal))}` : 'Declare the control total'} color={declTotal !== '' && Math.abs(num(declTotal) - plan.stats.total) > 0.01 ? T.danger : undefined} />
        </Stack>
        <Typography sx={{ fontSize: 12, color: T.muted, mb: 1 }}>Control total includes rejected and duplicate rows: accepted {lkr(plan.stats.acceptedTotal)} + rejected {lkr(plan.stats.rejectedTotal)} + duplicate {lkr(plan.stats.duplicateTotal)} = {lkr(plan.stats.total)}.</Typography>
        {variance && (isApprover
          ? <TextField size="small" fullWidth label="Declared vs computed differ — approver override reason (logged)" value={overrideReason} onChange={e => setOverrideReason(e.target.value)} sx={{ mb: 1.5 }} />
          : <Alert severity="error" sx={{ mb: 1.5 }}>Declared count / control total do not match the file. Fix the declaration or the file — a manager or admin can override with a reason.</Alert>)}
        {Object.values(plan.newMasters || {}).some(a => a.length) && (
          <FormControlLabel control={<Checkbox checked={addMasters} onChange={e => setAddMasters(e.target.checked)} />}
            label={<Typography sx={{ fontSize: 12.5 }}>Add new values to the bank masters: {[...plan.newMasters.insurers, ...plan.newMasters.branches, ...plan.newMasters.classes].join(', ')}</Typography>} />
        )}
        {(plan.stats.rejected + plan.stats.duplicates + (plan.stats.unmatched || 0)) > 0 && (
          <Button size="small" startIcon={<FileDownloadOutlinedIcon />} sx={{ textTransform: 'none', mb: 1 }} onClick={async () => saveAs(new Blob([await errorWorkbook(plan, parsed.headers)]), `${file.name.replace(/\.\w+$/, '')}_errors.xlsx`)}>Download error workbook</Button>
        )}
        {done && <Alert severity="success" sx={{ mb: 1.5 }}>Batch {batchId} posted: {Object.entries(done.counts).filter(([, n]) => n).map(([k, n]) => `${n} ${k}`).join(', ')}.</Alert>}
        <Table size="small" sx={{ bgcolor: '#fff' }}>
          <TableHead><TableRow><TableCell>Row</TableCell><TableCell>Outcome</TableCell><TableCell>Amount</TableCell><TableCell>Reason</TableCell></TableRow></TableHead>
          <TableBody>
            {plan.rows.filter(r => r.status !== 'accepted' || r.warnings.length).slice(0, 200).map(r => (
              <TableRow key={r.rowNo}><TableCell>{r.rowNo}</TableCell><TableCell><StatusChip value={r.status === 'accepted' ? 'Matched' : r.status === 'rejected' ? 'Rejected' : r.status === 'unmatched' ? 'Unmatched' : 'Duplicate'} /></TableCell>
                <TableCell>{lkr(r.amount)}</TableCell><TableCell sx={{ fontSize: 12 }}>{[...r.errors, ...r.warnings].join('; ') || (r.status === 'duplicate' ? 'Already posted / repeated in file' : '')}</TableCell></TableRow>
            ))}
          </TableBody>
        </Table>
      </Box>
    )}
  </>);
}

/* ── S-16 Batch history & reversal ── */
export function BatchHistory() {
  const ctx = useBanca();
  const { raw, bank, me, reload } = ctx;
  const [rev, setRev] = useState(null); const [reason, setReason] = useState(''); const [busy, setBusy] = useState(false); const [err, setErr] = useState('');
  const rows = useMemo(() => (raw.batches || []).map(b => {
    const f = (raw.files || []).find(x => x.id === b.file_id);
    return { ...b, register_label: b.type === 'Reversal' ? `Reversal (${TEMPLATES[b.register]?.label || b.register})` : (TEMPLATES[b.register]?.label || b.register), uploaded: String(b.uploaded_at || '').slice(0, 16).replace('T', ' '),
      accepted: b.stats?.accepted, rejected: b.stats?.rejected, duplicates: b.stats?.duplicates, total: b.stats?.acceptedTotal, doc: f };
  }), [raw]);
  const submit = async () => {
    setBusy(true); setErr('');
    try {
      await requestApproval(ctx, { category: 'batch_reversal', ref_id: rev.id, amount: rev.stats?.acceptedTotal || 0, title: `Reverse ${rev.file_name}`, payload: { reason } });
      await setRecord(ctx.bankId, 'batches', rev.id, { status: 'Reversal requested', reversal_requested: true, reversal_reason: reason, reversal_requested_by: me.name, reversal_requested_at: nowIso() });
      setRev(null); setReason(''); reload();
    } catch (e) { setErr(e.message); }
    setBusy(false);
  };
  const cols = [
    { key: 'uploaded', label: 'Uploaded' }, { key: 'register_label', label: 'Register' }, { key: 'file_name', label: 'File', wrap: true }, { key: 'status', label: 'Status', render: r => <StatusChip value={r.status} /> },
    { key: 'accepted', label: 'Accepted', type: 'int' }, { key: 'rejected', label: 'Rejected', type: 'int' }, { key: 'duplicates', label: 'Duplicates', type: 'int' }, { key: 'total', label: 'Accepted total', type: 'money' },
    { key: 'uploaded_by', label: 'Uploader' }, { key: 'confirmed_by', label: 'Confirmer' },
    { key: 'links', label: 'Links', noExport: true, noSort: true, render: r => <>{r.reverses && `reverses ${r.reverses} `}{r.reversed_by && `reversed by ${r.reversed_by} `}{r.corrects && `corrects ${r.corrects} `}{r.corrected_by && `corrected by ${r.corrected_by}`}</> },
    { key: 'doc', label: 'Source', noExport: true, noSort: true, render: r => r.doc ? <Button size="small" onClick={(e) => { e.stopPropagation(); openFile(r.doc.url); }} sx={{ textTransform: 'none', p: 0 }}>open</Button> : <Typography sx={{ fontSize: 11, color: T.danger }}>{r.type === 'Reversal' ? '' : 'missing'}</Typography> },
    { key: 'act', label: '', noExport: true, noSort: true, render: r => (r.status === 'Posted' && r.type !== 'Reversal') ? <Button size="small" color="error" onClick={(e) => { e.stopPropagation(); setRev(r); }} sx={{ textTransform: 'none' }}>Request reversal</Button> : null },
  ];
  return (<>
    <SectionTitle sub="Every batch with uploader, confirmer, totals and source file. A wrong batch is reversed (never deleted) through maker-checker approval; originals stay visible and link to the corrected batch.">Batch History</SectionTitle>
    <DataGrid title="Batch History" bankName={bank.name} rows={rows} columns={cols} filterKeys={['register_label', 'status']} dateKey="uploaded" dateLabel="Uploaded" exportName={`${bank.name}_Batches`} defaultSort={{ key: 'uploaded', dir: 'desc' }} />
    <Dialog open={!!rev} onClose={() => setRev(null)} maxWidth="sm" fullWidth>
      <DialogTitle sx={{ fontWeight: 800 }}>Request reversal</DialogTitle>
      <DialogContent dividers>
        {rev && <Typography sx={{ fontSize: 13, mb: 1.5 }}>{rev.file_name} — {rev.stats?.accepted} posted row(s), LKR {lkr(rev.stats?.acceptedTotal)}. A different manager/admin must approve. All its postings will be flagged reversed (kept for audit) and live totals recalculate.</Typography>}
        <TextField fullWidth multiline minRows={2} label="Reason (original value, what is wrong) *" value={reason} onChange={e => setReason(e.target.value)} />
        {err && <Alert severity="error" sx={{ mt: 1.5 }}>{err}</Alert>}
      </DialogContent>
      <DialogActions><Button onClick={() => setRev(null)}>Cancel</Button><Button color="error" variant="contained" disabled={!reason.trim() || busy} onClick={submit}>Send for approval</Button></DialogActions>
    </Dialog>
  </>);
}

/* ── S-17 Exceptions ── */
export function Exceptions({ openPolicy }) {
  const ctx = useBanca();
  const { raw, model, bank, config, reload } = ctx;
  const [tab, setTab] = useState(0);
  const [alloc, setAlloc] = useState(null);
  const open = useMemo(() => (raw.exceptions || []).filter(e => e.status === 'Open').map(e => {
    const src = (raw[e.ref_coll] || []).find(x => x.id === e.ref_id);
    return { ...e, age: e.opened_at ? Math.max(0, Math.round((new Date(todayYmd()) - new Date(e.opened_at)) / 86400000)) : 0, pending: !!src?.allocation_pending };
  }), [raw]);
  const tol = num(config.tolerance);
  const variances = useMemo(() => {
    const out = [];
    for (const p of model.policies) {
      if (p.comm_received > p.exp_comm + tol) out.push({ id: p.id + 'c', type: 'Commission over-received', policy_no: p.policy_no, customer: p.customer, insurer: p.insurer, amount: round2(p.comm_received - p.exp_comm), p });
      if (p.comm_status === 'Partly received' && p.pay_status === 'Paid') out.push({ id: p.id + 'k', type: 'Premium paid, commission short', policy_no: p.policy_no, customer: p.customer, insurer: p.insurer, amount: p.comm_balance, p });
      if (p.outstanding < -0.005) out.push({ id: p.id + 'o', type: 'Premium overpaid', policy_no: p.policy_no, customer: p.customer, insurer: p.insurer, amount: -p.outstanding, p });
      if (p.pmf_due < -0.005) out.push({ id: p.id + 'w', type: 'PMF clawback due', policy_no: p.policy_no, customer: p.customer, insurer: p.insurer, amount: -p.pmf_due, p });
    }
    return out;
  }, [model, tol]);
  const quality = useMemo(() => (raw.batches || []).filter(b => b.type !== 'Reversal' && (b.stats?.rejected || !b.file_id)).map(b => ({ id: b.id, file: b.file_name, register: TEMPLATES[b.register]?.label || b.register, uploaded: String(b.uploaded_at || '').slice(0, 10), rejected: b.stats?.rejected || 0, exposure: b.stats?.rejectedTotal || 0, source: b.file_id ? 'Linked' : 'Missing source document' })), [raw]);
  return (<>
    <SectionTitle sub="Unmatched receipts and commission, variances and data-quality issues. Allocating an exception needs a second person's approval.">Exceptions</SectionTitle>
    <Stack direction="row" spacing={1.2} useFlexGap flexWrap="wrap" sx={{ mb: 1.5 }}>
      <Kpi label="Open exceptions" value={open.length} sub={`LKR ${lkr(open.reduce((s, e) => s + num(e.amount), 0))} exposure`} color={open.length >= num(config.alert_open_exceptions) ? T.danger : open.length ? T.amber : T.green} />
      <Kpi label="Variances" value={variances.length} sub={`LKR ${lkr(variances.reduce((s, e) => s + num(e.amount), 0))}`} />
      <Kpi label="Batches with issues" value={quality.length} sub={`${quality.reduce((s, q) => s + q.rejected, 0)} rejected rows`} />
    </Stack>
    <Tabs value={tab} onChange={(_, v) => setTab(v)} sx={{ mb: 1, '& .MuiTab-root': { textTransform: 'none', fontWeight: 700 } }}>
      <Tab label={`Unmatched (${open.length})`} /><Tab label={`Variances (${variances.length})`} /><Tab label={`Data quality (${quality.length})`} />
    </Tabs>
    {tab === 0 && <DataGrid title="Open Exceptions" bankName={bank.name} rows={open} filterKeys={['insurer', 'kind']} dateKey="date" exportName={`${bank.name}_Exceptions`} columns={[
      { key: 'kind', label: 'Type' }, { key: 'policy_no', label: 'Policy No' }, { key: 'customer', label: 'Name' }, { key: 'insurer', label: 'Insurer' }, { key: 'date', label: 'Date' },
      { key: 'amount', label: 'Amount', type: 'money' }, { key: 'reason', label: 'Reason', wrap: true }, { key: 'age', label: 'Age (days)', type: 'int' },
      { key: 'act', label: '', noExport: true, noSort: true, render: r => r.pending ? <StatusChip value="Pending" /> : <Button size="small" onClick={() => setAlloc(r)} sx={{ textTransform: 'none' }}>Allocate</Button> },
    ]} />}
    {tab === 1 && <DataGrid title="Variances" bankName={bank.name} rows={variances} filterKeys={['insurer', 'type']} onRowClick={(r) => openPolicy(r.p)} exportName={`${bank.name}_Variances`} columns={[
      { key: 'type', label: 'Variance' }, { key: 'policy_no', label: 'Policy No' }, { key: 'customer', label: 'Name' }, { key: 'insurer', label: 'Insurer' }, { key: 'amount', label: 'Amount', type: 'money' }]} />}
    {tab === 2 && <DataGrid title="Data Quality" bankName={bank.name} rows={quality} filterKeys={['register', 'source']} exportName={`${bank.name}_Data_Quality`} columns={[
      { key: 'uploaded', label: 'Uploaded' }, { key: 'register', label: 'Register' }, { key: 'file', label: 'File' }, { key: 'rejected', label: 'Rejected rows', type: 'int' }, { key: 'exposure', label: 'Rejected exposure', type: 'money' }, { key: 'source', label: 'Source document' }]} />}
    <AllocateDialog exc={alloc} onClose={() => setAlloc(null)} ctx={ctx} onDone={() => { setAlloc(null); reload(); }} />
  </>);
}
function AllocateDialog({ exc, onClose, ctx, onDone }) {
  const { model } = ctx;
  const [lines, setLines] = useState([]);
  const [err, setErr] = useState(''); const [busy, setBusy] = useState(false);
  React.useEffect(() => { if (exc) { setLines([{ policy: null, amount: String(exc.amount) }]); setErr(''); } }, [exc]);
  if (!exc) return null;
  const opts = model.policies;
  const total = round2(lines.reduce((s, l) => s + num(l.amount), 0));
  const ok = lines.length && lines.every(l => l.policy && num(l.amount) !== 0) && Math.abs(total - num(exc.amount)) <= 0.01;
  const submit = async () => {
    setBusy(true); setErr('');
    try {
      const allocations = lines.map(l => ({ policy_id: l.policy.id, policy_no: l.policy.policy_no, amount: round2(num(l.amount)) }));
      await requestApproval(ctx, { category: 'allocation', ref_id: exc.ref_id, amount: exc.amount, title: `Allocate ${exc.kind} ${exc.policy_no} (LKR ${lkr(exc.amount)}) to ${allocations.map(a => a.policy_no).join(', ')}`,
        payload: { coll: exc.ref_coll, id: exc.ref_id, allocations, exception_id: exc.id } });
      await setRecord(ctx.bankId, exc.ref_coll, exc.ref_id, { allocation_pending: true });
      await audit(ctx.bankId, ctx.me, 'allocation_proposed', exc.ref_id, { allocations });
      onDone();
    } catch (e) { setErr(e.message); }
    setBusy(false);
  };
  return (
    <Dialog open={!!exc} onClose={onClose} maxWidth="md" fullWidth>
      <DialogTitle sx={{ fontWeight: 800 }}>Allocate {exc.kind} — {exc.policy_no} · LKR {lkr(exc.amount)}</DialogTitle>
      <DialogContent dividers>
        <Typography sx={{ fontSize: 12.5, color: T.muted, mb: 1.5 }}>Choose the policy period(s). Split across several policies if needed — the lines must add up to the full amount. A second person approves before it takes effect.</Typography>
        {lines.map((l, i) => (
          <Stack key={i} direction="row" spacing={1} sx={{ mb: 1 }} alignItems="center">
            <Autocomplete size="small" sx={{ flex: 1 }} options={opts} value={l.policy} onChange={(_, v) => setLines(ls => ls.map((x, j) => (j === i ? { ...x, policy: v } : x)))}
              getOptionLabel={p => `${p.policy_no} · ${p.customer} · ${p.insurer} · ${p.inception}→${p.expiry} · O/S ${lkr(p.outstanding)}`} isOptionEqualToValue={(a, b) => a.id === b.id}
              renderInput={p => <TextField {...p} label="Policy period" />} />
            <TextField size="small" type="number" label="Amount" value={l.amount} onChange={e => setLines(ls => ls.map((x, j) => (j === i ? { ...x, amount: e.target.value } : x)))} sx={{ width: 150 }} />
            <IconButton size="small" disabled={lines.length === 1} onClick={() => setLines(ls => ls.filter((_, j) => j !== i))}><DeleteOutlineIcon fontSize="small" /></IconButton>
          </Stack>
        ))}
        <Button size="small" startIcon={<AddIcon />} onClick={() => setLines(ls => [...ls, { policy: null, amount: '' }])} sx={{ textTransform: 'none' }}>Split to another policy</Button>
        <Typography sx={{ fontSize: 12.5, mt: 1, color: Math.abs(total - num(exc.amount)) > 0.01 ? T.danger : T.green }}>Allocated LKR {lkr(total)} of {lkr(exc.amount)}</Typography>
        {err && <Alert severity="error" sx={{ mt: 1 }}>{err}</Alert>}
      </DialogContent>
      <DialogActions><Button onClick={onClose}>Cancel</Button><Button sx={btnPrimary} disabled={!ok || busy} onClick={submit}>Send for approval</Button></DialogActions>
    </Dialog>
  );
}

/* ── S-18 Reconciliation & month-end sign-off ── */
export function Reconciliation() {
  const ctx = useBanca();
  const { raw, model, bank, me, bankId, reload } = ctx;
  const [month, setMonth] = useState(monthOf(todayYmd()));
  const end = monthEnd(month);
  const openEx = (raw.exceptions || []).filter(e => e.status === 'Open');
  const stages = useMemo(() => reconciliation(model, openEx), [model, openEx]);
  const monthEx = openEx.filter(e => !e.date || e.date <= end);
  const signoffs = [...(raw.signoffs || [])].sort((a, b) => String(b.at).localeCompare(String(a.at)));
  const signOff = async () => {
    const id = newId(bankId, 'signoffs');
    const prev = signoffs.find(s => s.month === month);
    await setRecord(bankId, 'signoffs', id, { month, stages, open_exceptions: monthEx.length, revision_of: prev?.id || '', by: me.name, by_uid: me.uid, at: nowIso() });
    await audit(bankId, me, 'reconciliation_signoff', id, { month, open_exceptions: monthEx.length });
    reload();
  };
  return (<>
    <SectionTitle sub="Four stages: GWP → premium receipts, expected → received commission, PMF payable → PMF paid, and outstanding at policy level. Variance shown per stage.">Reconciliation</SectionTitle>
    <Table sx={{ bgcolor: '#fff', mb: 2 }}>
      <TableHead><TableRow>{['Stage', 'Expected', 'Actual', 'Variance', 'Unmatched (exceptions)'].map(h => <TableCell key={h} sx={{ fontWeight: 800 }}>{h}</TableCell>)}</TableRow></TableHead>
      <TableBody>{stages.map(s => <TableRow key={s.stage}><TableCell sx={{ fontWeight: 700 }}>{s.stage}</TableCell><TableCell>{lkr(s.expected)}</TableCell><TableCell>{lkr(s.actual)}</TableCell>
        <TableCell sx={{ fontWeight: 700, color: Math.abs(s.variance) > 0.005 ? T.amber : T.green }}>{lkr(s.variance)}</TableCell><TableCell>{lkr(s.unmatched)}</TableCell></TableRow>)}</TableBody>
    </Table>
    <Box sx={{ p: 2, bgcolor: '#fff', borderRadius: '12px', border: `1px solid ${T.line}` }}>
      <Typography sx={{ fontWeight: 800, mb: 1 }}>Month-end sign-off</Typography>
      <Stack direction="row" spacing={1.5} alignItems="center">
        <TextField size="small" type="month" label="Month" value={month} onChange={e => setMonth(e.target.value)} InputLabelProps={{ shrink: true }} />
        <Typography sx={{ fontSize: 13, color: monthEx.length ? T.danger : T.green }}>{monthEx.length} open exception(s) dated up to {end}</Typography>
        <Button sx={btnPrimary} onClick={signOff} disabled={!(me.role === 'admin' || me.role === 'manager')}>Sign off {month}</Button>
      </Stack>
      <Typography sx={{ fontSize: 11.5, color: T.muted, mt: 1 }}>Sign-offs keep the user, time and stage figures. Signing a month again records a revision beside the earlier one — nothing is overwritten.</Typography>
      {signoffs.length > 0 && <Table size="small" sx={{ mt: 1 }}><TableHead><TableRow><TableCell>Month</TableCell><TableCell>Signed by</TableCell><TableCell>At</TableCell><TableCell>Open exceptions</TableCell><TableCell>Revision of</TableCell></TableRow></TableHead>
        <TableBody>{signoffs.map(s => <TableRow key={s.id}><TableCell>{s.month}</TableCell><TableCell>{s.by}</TableCell><TableCell>{String(s.at).slice(0, 16).replace('T', ' ')}</TableCell><TableCell>{s.open_exceptions}</TableCell><TableCell sx={{ fontSize: 11 }}>{s.revision_of}</TableCell></TableRow>)}</TableBody></Table>}
    </Box>
    <Typography sx={{ fontSize: 11.5, color: T.muted, mt: 1 }}>Data as of {bank.name} load · {model.policies.length} policy periods.</Typography>
  </>);
}
