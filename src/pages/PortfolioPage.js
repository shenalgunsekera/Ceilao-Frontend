import React, { useState, useMemo, useCallback } from 'react';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import Button from '@mui/material/Button';
import Stepper from '@mui/material/Stepper';
import Step from '@mui/material/Step';
import StepLabel from '@mui/material/StepLabel';
import TextField from '@mui/material/TextField';
import MenuItem from '@mui/material/MenuItem';
import Select from '@mui/material/Select';
import FormControl from '@mui/material/FormControl';
import InputLabel from '@mui/material/InputLabel';
import Chip from '@mui/material/Chip';
import Stack from '@mui/material/Stack';
import Card from '@mui/material/Card';
import CardContent from '@mui/material/CardContent';
import Checkbox from '@mui/material/Checkbox';
import FormControlLabel from '@mui/material/FormControlLabel';
import Collapse from '@mui/material/Collapse';
import Divider from '@mui/material/Divider';
import Alert from '@mui/material/Alert';

import BusinessIcon from '@mui/icons-material/Business';
import FolderOpenIcon from '@mui/icons-material/FolderOpen';
import InventoryIcon from '@mui/icons-material/Inventory';
import AssessmentIcon from '@mui/icons-material/Assessment';
import DescriptionIcon from '@mui/icons-material/Description';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import ArrowForwardIcon from '@mui/icons-material/ArrowForward';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import RestartAltIcon from '@mui/icons-material/RestartAlt';
import FileDownloadOutlinedIcon from '@mui/icons-material/FileDownloadOutlined';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import ExpandLessIcon from '@mui/icons-material/ExpandLess';
import WarningAmberIcon from '@mui/icons-material/WarningAmber';
import ShieldIcon from '@mui/icons-material/Shield';
import BuildIcon from '@mui/icons-material/Build';

import {
  INDUSTRIES, ASSET_EXPOSURE_MAP,
  getPortfoliosForIndustry, getAssetsForPortfolio,
  computeRecommendations, RISK_SCORING_RULES, STRENGTH_COLORS,
} from '../config/portfolioEngine';

const STEPS = [
  { label: 'Customer & Industry', icon: <BusinessIcon />   },
  { label: 'Portfolios',          icon: <FolderOpenIcon /> },
  { label: 'Assets',              icon: <InventoryIcon />  },
  { label: 'Risk Assessment',     icon: <AssessmentIcon /> },
  { label: 'Recommendations',     icon: <DescriptionIcon />},
];

const sectionHdr = (label, icon) => (
  <Box sx={{ display:'flex', alignItems:'center', gap:1, mb:2, pb:1, borderBottom:'2px solid rgba(255,139,90,0.12)' }}>
    <Box sx={{ color:'#FF5A5A', display:'flex' }}>{icon}</Box>
    <Typography sx={{ fontWeight:800, fontSize:15, color:'#1A1A2E', textTransform:'uppercase', letterSpacing:0.8 }}>
      {label}
    </Typography>
  </Box>
);

// ─── Step 1: Customer + Industry ────────────────────────────────────────────
function StepCustomer({ data, onChange }) {
  return (
    <Box>
      {sectionHdr('Customer & Business Details', <BusinessIcon />)}
      <Box sx={{ display:'grid', gridTemplateColumns:{ xs:'1fr', sm:'1fr 1fr' }, gap:2, mb:3 }}>
        <TextField label="Customer / Company Name" value={data.name} fullWidth
          onChange={e => onChange('name', e.target.value)} size="small" />
        <TextField label="Contact Person" value={data.contact || ''} fullWidth
          onChange={e => onChange('contact', e.target.value)} size="small" />
        <TextField label="Assessment Date" type="date" value={data.date || new Date().toISOString().split('T')[0]}
          onChange={e => onChange('date', e.target.value)} size="small" InputLabelProps={{ shrink: true }} />
        <TextField label="Broker / Prepared By" value={data.broker || ''} fullWidth
          onChange={e => onChange('broker', e.target.value)} size="small" />
      </Box>

      {sectionHdr('Industry Classification', <BusinessIcon />)}
      <FormControl fullWidth size="small" sx={{ mb:2 }}>
        <InputLabel>Select Industry</InputLabel>
        <Select value={data.industry || ''} label="Select Industry"
          onChange={e => onChange('industry', e.target.value)}>
          {INDUSTRIES.map(ind => (
            <MenuItem key={ind.code} value={ind.code}>
              <Box>
                <Typography sx={{ fontWeight:600, fontSize:13 }}>{ind.name}</Typography>
                <Typography sx={{ fontSize:11, color:'#9CA3AF' }}>{ind.sector} · Risk: {ind.risk}</Typography>
              </Box>
            </MenuItem>
          ))}
        </Select>
      </FormControl>
      {data.industry && (() => {
        const ind = INDUSTRIES.find(i => i.code === data.industry);
        return ind ? (
          <Alert severity="info" sx={{ fontSize:12.5 }}>
            <strong>Typical Key Risks:</strong> {ind.typical}
          </Alert>
        ) : null;
      })()}
    </Box>
  );
}

// ─── Step 2: Portfolio Selection ─────────────────────────────────────────────
function StepPortfolios({ industryCode, selected, onToggle }) {
  const portfolios = useMemo(() => getPortfoliosForIndustry(industryCode), [industryCode]);
  return (
    <Box>
      {sectionHdr('Select Customer Portfolios', <FolderOpenIcon />)}
      <Typography sx={{ fontSize:13, color:'#6B7280', mb:2.5 }}>
        Select all portfolios that apply to this customer. Each portfolio groups related assets and risks.
      </Typography>
      <Box sx={{ display:'grid', gridTemplateColumns:{ xs:'1fr', sm:'1fr 1fr' }, gap:1.5 }}>
        {portfolios.map(p => {
          const active = selected.includes(p.code);
          return (
            <Box key={p.code} onClick={() => onToggle(p.code)}
              sx={{
                p:2, borderRadius:'12px', cursor:'pointer', transition:'all 0.15s',
                border: active ? '2px solid #E8472A' : '1.5px solid rgba(255,139,90,0.18)',
                bgcolor: active ? 'rgba(232,71,42,0.04)' : '#fff',
                '&:hover': { borderColor:'#E8712A', bgcolor:'rgba(232,113,42,0.03)' },
              }}>
              <Stack direction="row" spacing={1.5} alignItems="flex-start">
                <Box sx={{
                  width:32, height:32, borderRadius:'8px', flexShrink:0,
                  bgcolor: active ? 'rgba(232,71,42,0.12)' : 'rgba(107,114,128,0.08)',
                  display:'flex', alignItems:'center', justifyContent:'center',
                }}>
                  {active ? <CheckCircleIcon sx={{ fontSize:18, color:'#E8472A' }} /> : <FolderOpenIcon sx={{ fontSize:18, color:'#9CA3AF' }} />}
                </Box>
                <Box sx={{ flex:1 }}>
                  <Typography sx={{ fontWeight:700, fontSize:13, color: active ? '#1A1A2E' : '#374151' }}>
                    {p.name}
                  </Typography>
                  <Typography sx={{ fontSize:11.5, color:'#9CA3AF', lineHeight:1.5 }}>
                    {p.desc}
                  </Typography>
                </Box>
              </Stack>
            </Box>
          );
        })}
      </Box>
    </Box>
  );
}

// ─── Step 3: Asset Confirmation ──────────────────────────────────────────────
function StepAssets({ industryCode, selectedPortfolios, assetData, onAssetToggle, onAssetValue }) {
  const [openPf, setOpenPf] = useState(selectedPortfolios[0] || null);
  const portfolios = useMemo(() => getPortfoliosForIndustry(industryCode), [industryCode]);

  return (
    <Box>
      {sectionHdr('Confirm Assets Present', <InventoryIcon />)}
      <Typography sx={{ fontSize:13, color:'#6B7280', mb:2.5 }}>
        For each portfolio, confirm which assets are present and enter an estimated value where applicable.
      </Typography>
      <Stack spacing={1.5}>
        {selectedPortfolios.map(pfCode => {
          const pf      = portfolios.find(p => p.code === pfCode);
          const assets  = getAssetsForPortfolio(industryCode, pfCode);
          const isOpen  = openPf === pfCode;
          const confirmed = assets.filter(a => assetData[a.assetCode]?.present).length;
          return (
            <Card key={pfCode} elevation={0} sx={{ border:'1.5px solid rgba(255,139,90,0.15)', borderRadius:'12px' }}>
              <Box sx={{ p:2, cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'space-between' }}
                onClick={() => setOpenPf(isOpen ? null : pfCode)}>
                <Stack direction="row" spacing={1.5} alignItems="center">
                  <Box sx={{ width:36, height:36, borderRadius:'10px', bgcolor:'rgba(232,71,42,0.08)',
                             display:'flex', alignItems:'center', justifyContent:'center' }}>
                    <FolderOpenIcon sx={{ fontSize:18, color:'#E8472A' }} />
                  </Box>
                  <Box>
                    <Typography sx={{ fontWeight:700, fontSize:13.5 }}>{pf?.name || pfCode}</Typography>
                    <Typography sx={{ fontSize:11.5, color:'#9CA3AF' }}>
                      {confirmed}/{assets.length} assets confirmed
                    </Typography>
                  </Box>
                </Stack>
                {isOpen ? <ExpandLessIcon sx={{ color:'#9CA3AF' }} /> : <ExpandMoreIcon sx={{ color:'#9CA3AF' }} />}
              </Box>
              <Collapse in={isOpen}>
                <Divider />
                <Box sx={{ p:2 }}>
                  <Stack spacing={1.5}>
                    {assets.map(({ assetCode, mandatory, asset }) => {
                      const present = assetData[assetCode]?.present || false;
                      const value   = assetData[assetCode]?.value   || '';
                      const notes   = assetData[assetCode]?.notes   || '';
                      if (!asset) return null;
                      return (
                        <Box key={assetCode} sx={{
                          p:1.5, borderRadius:'10px',
                          bgcolor: present ? 'rgba(16,185,129,0.04)' : 'rgba(107,114,128,0.03)',
                          border: present ? '1px solid rgba(16,185,129,0.20)' : '1px solid rgba(107,114,128,0.10)',
                        }}>
                          <Stack direction={{ xs:'column', sm:'row' }} spacing={1.5} alignItems={{ sm:'center' }}>
                            <FormControlLabel sx={{ flex:1, m:0 }}
                              control={
                                <Checkbox checked={present} size="small"
                                  onChange={e => onAssetToggle(assetCode, e.target.checked)}
                                  sx={{ color: present ? '#10B981' : '#D1D5DB', '&.Mui-checked': { color:'#10B981' } }} />
                              }
                              label={
                                <Box>
                                  <Stack direction="row" spacing={1} alignItems="center">
                                    <Typography sx={{ fontWeight:600, fontSize:13 }}>{asset.name}</Typography>
                                    {mandatory === 'Yes' && (
                                      <Chip label="Core" size="small"
                                        sx={{ fontSize:9.5, height:16, bgcolor:'rgba(232,71,42,0.10)', color:'#E8472A', fontWeight:700 }} />
                                    )}
                                  </Stack>
                                  <Typography sx={{ fontSize:11, color:'#9CA3AF' }}>{asset.desc}</Typography>
                                </Box>
                              }
                            />
                            {present && (
                              <Stack direction="row" spacing={1} sx={{ flexShrink:0 }}>
                                <TextField size="small" label="Est. Value (LKR)" type="number"
                                  value={value} onChange={e => onAssetValue(assetCode, 'value', e.target.value)}
                                  sx={{ width:160, '& .MuiOutlinedInput-root': { borderRadius:'8px', fontSize:12 } }} />
                                <TextField size="small" label="Notes" value={notes}
                                  onChange={e => onAssetValue(assetCode, 'notes', e.target.value)}
                                  sx={{ width:180, '& .MuiOutlinedInput-root': { borderRadius:'8px', fontSize:12 } }} />
                              </Stack>
                            )}
                          </Stack>
                          {present && (
                            <Typography sx={{ fontSize:11, color:'#6B7280', mt:0.5, pl:4 }}>
                              <strong>Valuation basis:</strong> {asset.valuationBasis} &nbsp;·&nbsp;
                              <strong>Data needed:</strong> {asset.dataRequired}
                            </Typography>
                          )}
                        </Box>
                      );
                    })}
                  </Stack>
                </Box>
              </Collapse>
            </Card>
          );
        })}
      </Stack>
    </Box>
  );
}

// ─── Step 4: Risk Assessment Questions ───────────────────────────────────────
function StepRisk({ confirmedAssets, riskAnswers, onAnswer }) {
  const relevantRules = useMemo(() =>
    RISK_SCORING_RULES.filter(r =>
      confirmedAssets.some(ac =>
        ASSET_EXPOSURE_MAP.some(m => m.assetCode === ac && m.exposureCode === r.exposureCode)
      )
    ),
  [confirmedAssets]);

  const grouped = useMemo(() => {
    const map = {};
    relevantRules.forEach(r => {
      if (!map[r.exposureCode]) map[r.exposureCode] = [];
      map[r.exposureCode].push(r);
    });
    return map;
  }, [relevantRules]);

  if (relevantRules.length === 0) return (
    <Box sx={{ textAlign:'center', py:6 }}>
      <Typography sx={{ color:'#9CA3AF' }}>No risk questions applicable — please confirm assets in the previous step.</Typography>
    </Box>
  );

  return (
    <Box>
      {sectionHdr('Risk Assessment Questions', <AssessmentIcon />)}
      <Typography sx={{ fontSize:13, color:'#6B7280', mb:2.5 }}>
        Answer the following questions to generate an accurate risk score and targeted recommendations.
      </Typography>
      <Stack spacing={3}>
        {Object.entries(grouped).map(([expCode, rules]) => (
          <Box key={expCode}>
            <Typography sx={{ fontWeight:700, fontSize:12, color:'#FF5A5A', textTransform:'uppercase',
                              letterSpacing:1, mb:1.5 }}>
              {expCode.replace('EXP-','')} Exposure
            </Typography>
            <Stack spacing={1.5}>
              {rules.map(rule => {
                const answer = riskAnswers[rule.id];
                const isAdverse = answer === rule.answerCondition;
                return (
                  <Box key={rule.id} sx={{
                    p:2, borderRadius:'12px',
                    bgcolor: isAdverse ? 'rgba(239,68,68,0.04)' : '#fff',
                    border: isAdverse ? '1px solid rgba(239,68,68,0.20)' : '1px solid rgba(255,139,90,0.12)',
                  }}>
                    <Typography sx={{ fontWeight:600, fontSize:13, mb:1 }}>{rule.question}</Typography>
                    <Stack direction="row" spacing={1} flexWrap="wrap">
                      {['Yes','No','More than 10 years','More than 10 km','More than 12 months ago',
                        'Poor','Combustible / timber / sandwich panel'].includes(rule.answerCondition)
                        ? ['Yes','No'].map(opt => (
                          <Button key={opt} size="small" variant={answer === opt ? 'contained' : 'outlined'}
                            onClick={() => onAnswer(rule.id, opt)}
                            sx={{
                              fontSize:12, py:0.4, minWidth:70,
                              ...(answer === opt
                                ? { background: isAdverse ? 'linear-gradient(135deg,#ef4444,#dc2626)' : 'linear-gradient(135deg,#10B981,#059669)', boxShadow:'none' }
                                : { borderColor:'rgba(255,139,90,0.25)', color:'#6B7280' }),
                            }}>
                            {opt}
                          </Button>
                        ))
                        : (
                          <Select size="small" value={answer || ''} displayEmpty
                            onChange={e => onAnswer(rule.id, e.target.value)}
                            sx={{ fontSize:12, borderRadius:'8px', minWidth:220 }}>
                            <MenuItem value="">— Select —</MenuItem>
                            {[rule.answerCondition, 'Not applicable'].map(o => (
                              <MenuItem key={o} value={o} sx={{ fontSize:12 }}>{o}</MenuItem>
                            ))}
                          </Select>
                        )
                      }
                    </Stack>
                    {isAdverse && (
                      <Alert severity="warning" icon={<WarningAmberIcon sx={{ fontSize:16 }} />}
                        sx={{ mt:1.5, fontSize:12, py:0.5 }}>
                        <strong>Risk Control:</strong> {rule.rmAdvice}
                      </Alert>
                    )}
                  </Box>
                );
              })}
            </Stack>
          </Box>
        ))}
      </Stack>
    </Box>
  );
}

// ─── Step 5: Recommendations Report ──────────────────────────────────────────
function StepReport({ customer, industryCode, selectedPortfolios, confirmedAssets, assetData, riskAnswers }) {
  const recs = useMemo(() =>
    computeRecommendations(industryCode, selectedPortfolios, confirmedAssets),
  [industryCode, selectedPortfolios, confirmedAssets]);

  const industry = INDUSTRIES.find(i => i.code === industryCode);

  const [openProduct, setOpenProduct] = useState(null);

  const riskScore = useMemo(() => {
    let score = 0;
    RISK_SCORING_RULES.forEach(r => {
      if (riskAnswers[r.id] === r.answerCondition) score += r.scoreImpact;
    });
    return score;
  }, [riskAnswers]);

  const riskGrade = riskScore <= 4 ? { label:'Low',      color:'#059669', bg:'rgba(16,185,129,0.10)' }
                  : riskScore <= 8 ? { label:'Medium',   color:'#d97706', bg:'rgba(245,158,11,0.10)' }
                  : riskScore <= 14? { label:'High',     color:'#dc2626', bg:'rgba(239,68,68,0.10)'  }
                  :                  { label:'Critical', color:'#7c2d12', bg:'rgba(185,28,28,0.12)'  };

  const exportPdf = async () => {
    const { default: jsPDF }     = await import('jspdf');
    const { default: autoTable } = await import('jspdf-autotable');
    const pdf  = new jsPDF({ orientation:'portrait', unit:'mm', format:'a4' });
    const pw   = pdf.internal.pageSize.getWidth();
    const today = new Date().toLocaleDateString('en-GB', { day:'numeric', month:'long', year:'numeric' });

    // Header
    pdf.setFillColor(26,26,46); pdf.rect(0,0,pw,22,'F');
    pdf.setFillColor(232,71,42); pdf.rect(0,22,pw,2.5,'F');
    pdf.setFontSize(12); pdf.setFont('helvetica','bold'); pdf.setTextColor(255,139,90);
    pdf.text('CEILAO INSURANCE BROKERS (PVT) LTD', pw/2, 10, {align:'center'});
    pdf.setFontSize(8); pdf.setFont('helvetica','normal'); pdf.setTextColor(148,163,184);
    pdf.text('INSURANCE BROKING & RISK MANAGEMENT  ·  SRI LANKA', pw/2,17,{align:'center'});

    // Title block
    pdf.setFillColor(249,250,251); pdf.rect(0,24.5,pw,14,'F');
    pdf.setFontSize(11); pdf.setFont('helvetica','bold'); pdf.setTextColor(26,26,46);
    pdf.text('PORTFOLIO REVIEW & INSURANCE RECOMMENDATION REPORT', pw/2, 31, {align:'center'});
    pdf.setFontSize(8); pdf.setFont('helvetica','normal'); pdf.setTextColor(107,114,128);
    pdf.text(`${customer.name || 'Client'}   ·   ${industry?.name || industryCode}   ·   ${today}`, pw/2, 36.5, {align:'center'});

    let y = 44;
    const addSection = (title) => {
      pdf.setFillColor(26,26,46); pdf.rect(10, y, pw-20, 8,'F');
      pdf.setFontSize(8.5); pdf.setFont('helvetica','bold'); pdf.setTextColor(255,139,90);
      pdf.text(title, 14, y+5.5);
      y += 11;
    };

    // Summary
    addSection('RISK ASSESSMENT SUMMARY');
    autoTable(pdf, {
      startY: y,
      body: [
        ['Customer', customer.name || '—'],
        ['Industry', industry?.name || industryCode],
        ['Risk Grade', `${riskGrade.label} (Score: ${riskScore})`],
        ['Assets Confirmed', confirmedAssets.length.toString()],
        ['Exposures Identified', recs.exposures.length.toString()],
        ['Recommended Products', recs.products.length.toString()],
        ['Assessment Date', customer.date || today],
        ['Prepared By', customer.broker || '—'],
      ],
      columnStyles: { 0:{ fontStyle:'bold', cellWidth:50 } },
      styles: { fontSize:8.5, cellPadding:{top:3,bottom:3,left:5,right:5} },
      margin: { left:10, right:10 },
      didParseCell: d => { if(d.row.index%2===0) d.cell.styles.fillColor=[255,255,255]; else d.cell.styles.fillColor=[255,248,245]; },
    });
    y = pdf.lastAutoTable.finalY + 8;

    // Recommended Products
    addSection('RECOMMENDED INSURANCE PROGRAMME');
    autoTable(pdf, {
      startY: y,
      head: [[
        {content:'#', styles:{fillColor:[26,26,46],textColor:[255,139,90],fontStyle:'bold',fontSize:8}},
        {content:'Product', styles:{fillColor:[26,26,46],textColor:[255,139,90],fontStyle:'bold',fontSize:8}},
        {content:'Recommendation', styles:{fillColor:[26,26,46],textColor:[255,139,90],fontStyle:'bold',fontSize:8}},
        {content:'Reason', styles:{fillColor:[26,26,46],textColor:[255,139,90],fontStyle:'bold',fontSize:8}},
      ]],
      body: recs.products.map((p,i) => [
        i+1, p.product.name, p.strength, p.reason,
      ]),
      columnStyles: { 0:{cellWidth:8}, 1:{cellWidth:50}, 2:{cellWidth:32} },
      styles: { fontSize:8, cellPadding:{top:3,bottom:3,left:4,right:4}, overflow:'linebreak' },
      margin: { left:10, right:10 },
    });
    y = pdf.lastAutoTable.finalY + 8;

    if (y > 250) { pdf.addPage(); y = 15; }

    // Risk Controls
    if (recs.ruleAdvice.length > 0) {
      addSection('RISK MANAGEMENT ADVICE');
      autoTable(pdf, {
        startY: y,
        head: [[
          {content:'Area', styles:{fillColor:[26,26,46],textColor:[255,139,90],fontStyle:'bold',fontSize:8}},
          {content:'Risk Control Recommendation', styles:{fillColor:[26,26,46],textColor:[255,139,90],fontStyle:'bold',fontSize:8}},
        ]],
        body: recs.ruleAdvice.map(r => [r.rule.portfolioCode?.replace('PF-',''), r.advice]),
        styles: { fontSize:8, cellPadding:{top:3,bottom:3,left:4,right:4}, overflow:'linebreak' },
        columnStyles: { 0:{cellWidth:32} },
        margin: { left:10, right:10 },
      });
    }

    // Footer — 18mm tall, two lines
    const ph = pdf.internal.pageSize.getHeight();
    pdf.setFillColor(26,26,46);  pdf.rect(0, ph-18, pw, 18, 'F');
    pdf.setFillColor(232,71,42); pdf.rect(0, ph-18, pw, 1.5, 'F');
    // Line 1: company name (left) + date (right)
    pdf.setFontSize(8); pdf.setFont('helvetica','bold'); pdf.setTextColor(255,139,90);
    pdf.text('Ceilao Insurance Brokers (Pvt) Ltd', 12, ph-11);
    pdf.setFont('helvetica','normal'); pdf.setFontSize(7); pdf.setTextColor(107,114,128);
    pdf.text(`Generated: ${today}`, pw-12, ph-11, {align:'right'});
    // Line 2: confidential note centred
    pdf.setFont('helvetica','italic'); pdf.setFontSize(6.5); pdf.setTextColor(148,163,184);
    pdf.text(
      'This report is confidential and prepared for the named client only.  Recommendations subject to underwriting confirmation.',
      pw/2, ph-4.5, {align:'center'}
    );

    pdf.save(`CeilaoIB_PortfolioReview_${(customer.name||'Client').replace(/\s+/g,'_')}.pdf`);
  };

  return (
    <Box>
      {/* Summary banner */}
      <Box sx={{ p:2.5, borderRadius:'14px', mb:3, background:'linear-gradient(135deg,#1A1A2E,#2d2d44)', color:'#fff' }}>
        <Stack direction={{ xs:'column', sm:'row' }} justifyContent="space-between" alignItems={{ sm:'center' }} spacing={2}>
          <Box>
            <Typography sx={{ fontWeight:800, fontSize:17, mb:0.3 }}>
              {customer.name || 'Client'} — Portfolio Review
            </Typography>
            <Typography sx={{ fontSize:12.5, color:'#9CA3AF' }}>
              {industry?.name || industryCode} · {confirmedAssets.length} assets · {recs.exposures.length} exposures · {recs.products.length} recommended products
            </Typography>
          </Box>
          <Stack direction="row" spacing={1.5} alignItems="center">
            <Box sx={{ px:2, py:1, borderRadius:'10px', bgcolor: riskGrade.bg, textAlign:'center' }}>
              <Typography sx={{ fontSize:11, color: riskGrade.color, fontWeight:700, textTransform:'uppercase' }}>Risk Grade</Typography>
              <Typography sx={{ fontSize:22, fontWeight:900, color: riskGrade.color, lineHeight:1.1 }}>{riskGrade.label}</Typography>
              <Typography sx={{ fontSize:10, color: riskGrade.color }}>Score: {riskScore}</Typography>
            </Box>
            <Button variant="contained" startIcon={<FileDownloadOutlinedIcon />} onClick={exportPdf}
              sx={{ background:'linear-gradient(135deg,#E8472A,#E8712A)', flexShrink:0 }}>
              Export PDF
            </Button>
          </Stack>
        </Stack>
      </Box>

      {/* Exposures */}
      <Box sx={{ mb:3 }}>
        {sectionHdr('Risk Exposures Identified', <WarningAmberIcon />)}
        <Box sx={{ display:'grid', gridTemplateColumns:{ xs:'1fr', sm:'1fr 1fr 1fr' }, gap:1.5 }}>
          {recs.exposures.map(exp => (
            <Box key={exp.code} sx={{ p:1.5, borderRadius:'10px', bgcolor: exp.relevance==='High' ? 'rgba(239,68,68,0.06)' : 'rgba(245,158,11,0.06)', border: `1px solid ${exp.relevance==='High' ? 'rgba(239,68,68,0.18)' : 'rgba(245,158,11,0.18)'}` }}>
              <Stack direction="row" justifyContent="space-between" alignItems="center">
                <Typography sx={{ fontWeight:700, fontSize:12.5 }}>{exp.name}</Typography>
                <Chip label={exp.relevance} size="small" sx={{ fontSize:10, fontWeight:700, height:18,
                  bgcolor: exp.relevance==='High' ? 'rgba(239,68,68,0.12)' : 'rgba(245,158,11,0.12)',
                  color:   exp.relevance==='High' ? '#dc2626' : '#d97706' }} />
              </Stack>
              <Typography sx={{ fontSize:11, color:'#6B7280', mt:0.3 }}>{exp.desc}</Typography>
            </Box>
          ))}
        </Box>
      </Box>

      {/* Recommended Products */}
      <Box sx={{ mb:3 }}>
        {sectionHdr('Recommended Insurance Programme', <ShieldIcon />)}
        <Stack spacing={1.5}>
          {recs.products.map((p, idx) => {
            const st   = STRENGTH_COLORS[p.strength] || STRENGTH_COLORS['Recommended'];
            const open = openProduct === p.product.code;
            return (
              <Card key={p.product.code} elevation={0}
                sx={{ border:`1.5px solid ${open ? '#E8472A' : 'rgba(255,139,90,0.15)'}`, borderRadius:'12px' }}>
                <Box sx={{ p:2, cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'space-between' }}
                  onClick={() => setOpenProduct(open ? null : p.product.code)}>
                  <Stack direction="row" spacing={2} alignItems="center">
                    <Box sx={{ width:32, height:32, borderRadius:'8px', bgcolor:'rgba(232,71,42,0.08)',
                               display:'flex', alignItems:'center', justifyContent:'center',
                               fontWeight:800, fontSize:13, color:'#E8472A' }}>
                      {idx+1}
                    </Box>
                    <Box>
                      <Stack direction="row" spacing={1} alignItems="center">
                        <Typography sx={{ fontWeight:700, fontSize:14 }}>{p.product.name}</Typography>
                        <Chip label={st.label} size="small"
                          sx={{ fontSize:10, fontWeight:700, height:18, bgcolor:st.bg, color:st.color }} />
                        <Chip label={p.product.family} size="small"
                          sx={{ fontSize:10, height:18, bgcolor:'rgba(99,102,241,0.08)', color:'#6366f1' }} />
                      </Stack>
                      <Typography sx={{ fontSize:12, color:'#6B7280' }}>{p.reason}</Typography>
                    </Box>
                  </Stack>
                  {open ? <ExpandLessIcon sx={{ color:'#9CA3AF', flexShrink:0 }} /> : <ExpandMoreIcon sx={{ color:'#9CA3AF', flexShrink:0 }} />}
                </Box>
                <Collapse in={open}>
                  <Divider />
                  <Box sx={{ p:2 }}>
                    <Typography sx={{ fontSize:12.5, color:'#374151', mb:1.5 }}>{p.product.desc}</Typography>
                    {p.clauses.length > 0 && (
                      <>
                        <Typography sx={{ fontWeight:700, fontSize:11.5, color:'#1A1A2E', mb:1, textTransform:'uppercase', letterSpacing:0.5 }}>
                          Recommended Clauses
                        </Typography>
                        <Stack spacing={0.8}>
                          {p.clauses.map(cl => {
                            const cs = { Mandatory:{ bg:'rgba(239,68,68,0.08)',color:'#dc2626' }, Strong:{ bg:'rgba(245,158,11,0.08)',color:'#d97706' }, Recommended:{ bg:'rgba(16,185,129,0.08)',color:'#059669' }, Conditional:{ bg:'rgba(99,102,241,0.08)',color:'#6366f1' } };
                            const c = cs[cl.level] || cs.Recommended;
                            return (
                              <Box key={cl.code} sx={{ display:'flex', gap:1.5, alignItems:'flex-start', p:1.2, borderRadius:'8px', bgcolor:c.bg }}>
                                <Chip label={cl.level} size="small" sx={{ fontSize:9.5, fontWeight:700, height:16, bgcolor:'transparent', color:c.color, flexShrink:0 }} />
                                <Box>
                                  <Typography sx={{ fontWeight:600, fontSize:12, color:'#1A1A2E' }}>{cl.name}</Typography>
                                  <Typography sx={{ fontSize:11, color:'#6B7280' }}>{cl.purpose} · <em>{cl.trigger}</em></Typography>
                                </Box>
                              </Box>
                            );
                          })}
                        </Stack>
                      </>
                    )}
                  </Box>
                </Collapse>
              </Card>
            );
          })}
        </Stack>
      </Box>

      {/* Risk Management Advice */}
      {recs.ruleAdvice.length > 0 && (
        <Box>
          {sectionHdr('Risk Management Advice', <BuildIcon />)}
          <Stack spacing={1}>
            {recs.ruleAdvice.map(r => (
              <Box key={r.rule.ruleId} sx={{ p:1.5, borderRadius:'10px', bgcolor:'rgba(99,102,241,0.04)',
                                             border:'1px solid rgba(99,102,241,0.12)', display:'flex', gap:1.5 }}>
                <Box sx={{ width:28, height:28, borderRadius:'8px', bgcolor:'rgba(99,102,241,0.12)',
                           display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0 }}>
                  <BuildIcon sx={{ fontSize:15, color:'#6366f1' }} />
                </Box>
                <Box>
                  <Typography sx={{ fontWeight:600, fontSize:12.5, color:'#1A1A2E' }}>
                    {r.rule.portfolioCode?.replace('PF-','')} — {r.rule.assetCode?.replace('AST-','')}
                  </Typography>
                  <Typography sx={{ fontSize:12, color:'#4B5563' }}>{r.advice}</Typography>
                </Box>
              </Box>
            ))}
          </Stack>
        </Box>
      )}
    </Box>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────
export default function PortfolioPage() {
  const [step, setStep] = useState(0);
  const [customer, setCustomer] = useState({ name:'', industry:'', date: new Date().toISOString().split('T')[0], contact:'', broker:'' });
  const [selectedPortfolios, setSelectedPortfolios] = useState([]);
  const [assetData, setAssetData] = useState({}); // { assetCode: { present, value, notes } }
  const [riskAnswers, setRiskAnswers] = useState({}); // { ruleId: answer }

  const confirmedAssets = useMemo(() =>
    Object.entries(assetData).filter(([, d]) => d.present).map(([code]) => code),
  [assetData]);

  const setCustomerField = useCallback((key, val) => setCustomer(c => ({ ...c, [key]: val })), []);

  const togglePortfolio = useCallback((code) => {
    setSelectedPortfolios(prev =>
      prev.includes(code) ? prev.filter(c => c !== code) : [...prev, code]
    );
    setAssetData({});
  }, []);

  const toggleAsset = useCallback((code, present) => {
    setAssetData(prev => ({ ...prev, [code]: { ...(prev[code] || {}), present } }));
  }, []);

  const setAssetValue = useCallback((code, key, val) => {
    setAssetData(prev => ({ ...prev, [code]: { ...(prev[code] || {}), [key]: val } }));
  }, []);

  const setRiskAnswer = useCallback((ruleId, answer) => {
    setRiskAnswers(prev => ({ ...prev, [ruleId]: answer }));
  }, []);

  const canNext = () => {
    if (step === 0) return customer.name.trim() && customer.industry;
    if (step === 1) return selectedPortfolios.length > 0;
    if (step === 2) return confirmedAssets.length > 0;
    return true;
  };

  const reset = () => {
    setStep(0);
    setCustomer({ name:'', industry:'', date:new Date().toISOString().split('T')[0], contact:'', broker:'' });
    setSelectedPortfolios([]);
    setAssetData({});
    setRiskAnswers({});
  };

  return (
    <Box sx={{ maxWidth:900, mx:'auto' }}>
      {/* Page header */}
      <Stack direction={{ xs:'column', sm:'row' }} justifyContent="space-between" alignItems={{ sm:'center' }} sx={{ mb:3 }}>
        <Box>
          <Typography variant="h5" sx={{ fontWeight:800, mb:0.3 }}>Portfolio Review</Typography>
          <Typography sx={{ fontSize:13, color:'#9CA3AF' }}>
            Industry → Portfolio → Asset → Exposure → Insurance Recommendation
          </Typography>
        </Box>
        {step > 0 && (
          <Button variant="outlined" startIcon={<RestartAltIcon />} onClick={reset}
            sx={{ mt:{ xs:1.5, sm:0 }, borderColor:'rgba(255,139,90,0.3)', color:'#FF8B5A', fontSize:12 }}>
            New Assessment
          </Button>
        )}
      </Stack>

      {/* Stepper */}
      <Stepper activeStep={step} alternativeLabel sx={{ mb:4,
        '& .MuiStepLabel-label': { fontSize:12, fontWeight:600 },
        '& .MuiStepIcon-root.Mui-active': { color:'#E8472A' },
        '& .MuiStepIcon-root.Mui-completed': { color:'#10B981' },
      }}>
        {STEPS.map(s => (
          <Step key={s.label}><StepLabel>{s.label}</StepLabel></Step>
        ))}
      </Stepper>

      {/* Step content */}
      <Card elevation={0} sx={{ border:'1.5px solid rgba(255,139,90,0.12)', borderRadius:'16px', mb:3 }}>
        <CardContent sx={{ p:3 }}>
          {step === 0 && <StepCustomer data={customer} onChange={setCustomerField} />}
          {step === 1 && <StepPortfolios industryCode={customer.industry} selected={selectedPortfolios} onToggle={togglePortfolio} />}
          {step === 2 && <StepAssets industryCode={customer.industry} selectedPortfolios={selectedPortfolios} assetData={assetData} onAssetToggle={toggleAsset} onAssetValue={setAssetValue} />}
          {step === 3 && <StepRisk confirmedAssets={confirmedAssets} riskAnswers={riskAnswers} onAnswer={setRiskAnswer} />}
          {step === 4 && <StepReport customer={customer} industryCode={customer.industry} selectedPortfolios={selectedPortfolios} confirmedAssets={confirmedAssets} assetData={assetData} riskAnswers={riskAnswers} />}
        </CardContent>
      </Card>

      {/* Navigation */}
      <Stack direction="row" justifyContent="space-between">
        <Button variant="outlined" startIcon={<ArrowBackIcon />}
          onClick={() => setStep(s => s - 1)} disabled={step === 0}
          sx={{ borderColor:'rgba(255,139,90,0.3)', color:'#FF8B5A', fontSize:13 }}>
          Back
        </Button>
        {step < STEPS.length - 1 ? (
          <Button variant="contained" endIcon={<ArrowForwardIcon />}
            onClick={() => setStep(s => s + 1)} disabled={!canNext()}
            sx={{ fontSize:13 }}>
            {step === 3 ? 'View Recommendations' : 'Continue'}
          </Button>
        ) : (
          <Button variant="outlined" startIcon={<RestartAltIcon />} onClick={reset}
            sx={{ borderColor:'rgba(16,185,129,0.3)', color:'#059669', fontSize:13 }}>
            Start New Assessment
          </Button>
        )}
      </Stack>
    </Box>
  );
}
