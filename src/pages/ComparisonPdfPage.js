import React, { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { doc, getDoc } from 'firebase/firestore';
import { signInAnonymously } from 'firebase/auth';
import { db, auth } from '../firebase';
import { PRODUCTS } from '../config/products';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import Button from '@mui/material/Button';
import CircularProgress from '@mui/material/CircularProgress';
import Alert from '@mui/material/Alert';

const ComparisonPdfPage = () => {
  const [params]   = useSearchParams();
  const qid        = params.get('qid');
  const [status,   setStatus]  = useState('loading'); // loading | ready | error
  const [error,    setError]   = useState('');
  const [quote,    setQuote]   = useState(null);

  useEffect(() => {
    if (!qid) { setError('Invalid link — missing quote ID.'); setStatus('error'); return; }
    signInAnonymously(auth)
      .catch(() => {})
      .finally(() => {
        getDoc(doc(db, 'quotes', qid))
          .then(snap => {
            if (!snap.exists()) { setError('Quote not found.'); setStatus('error'); return; }
            setQuote({ id: snap.id, ...snap.data() });
            setStatus('ready');
          })
          .catch(() => { setError('Failed to load quote.'); setStatus('error'); });
      });
  }, [qid]);

  const generateAndDownload = async () => {
    setStatus('generating');
    try {
      const { default: jsPDF }     = await import('jspdf');
      const { default: autoTable } = await import('jspdf-autotable');

      const product   = quote.product_key ? PRODUCTS[quote.product_key] : null;
      const responses = (quote.responses || []);
      const today     = new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' });

      const pdf = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
      const pw  = pdf.internal.pageSize.getWidth();
      const ph  = pdf.internal.pageSize.getHeight();

      const drawHdr = () => {
        pdf.setFillColor(26,26,46);  pdf.rect(0, 0, pw, 20, 'F');
        pdf.setFillColor(255,90,90); pdf.rect(0, 20, pw, 3, 'F');
        pdf.setTextColor(255,139,90); pdf.setFontSize(13); pdf.setFont('helvetica','bold');
        pdf.text('CEILAO INSURANCE BROKERS (PVT) LTD', pw/2, 9, { align:'center' });
        pdf.setTextColor(148,163,184); pdf.setFontSize(8); pdf.setFont('helvetica','normal');
        pdf.text('INSURANCE BROKING & RISK MANAGEMENT  ·  SRI LANKA', pw/2, 15, { align:'center' });
      };

      const drawFtr = () => {
        const pn = pdf.internal.getCurrentPageInfo().pageNumber;
        const tp = pdf.internal.getNumberOfPages();
        pdf.setFillColor(26,26,46); pdf.rect(0, ph-14, pw, 14, 'F');
        pdf.setFillColor(255,90,90); pdf.rect(0, ph-14, pw, 1, 'F');
        pdf.setFont('helvetica','bold'); pdf.setFontSize(8); pdf.setTextColor(255,139,90);
        pdf.text('Ceilao Insurance Brokers (Pvt) Ltd', 12, ph-8);
        pdf.setFont('helvetica','normal'); pdf.setFontSize(7.5); pdf.setTextColor(148,163,184);
        pdf.text('This comparison is prepared exclusively for you. Prices are subject to final confirmation.', pw/2, ph-8, { align:'center' });
        pdf.setTextColor(107,114,128);
        pdf.text(`Page ${pn} / ${tp}`, pw-12, ph-8, { align:'right' });
        pdf.setFont('helvetica','italic'); pdf.setFontSize(6.5); pdf.setTextColor(100,116,139);
        pdf.text(`Generated: ${today}`, 12, ph-3.5);
        pdf.text('Insurance Broking & Risk Management  ·  Sri Lanka', pw-12, ph-3.5, { align:'right' });
      };

      drawHdr();
      pdf.setFillColor(249,250,251); pdf.rect(0,23,pw,12,'F');
      pdf.setFontSize(10); pdf.setFont('helvetica','bold'); pdf.setTextColor(26,26,46);
      pdf.text('PERSONALISED INSURANCE COMPARISON REPORT', 14, 31);
      pdf.setFont('helvetica','normal'); pdf.setFontSize(8); pdf.setTextColor(107,114,128);
      pdf.text(`Ref: ${quote.reference}   ·   ${product?.label || ''}   ·   ${today}`, pw-14, 31, { align:'right' });

      const coverFields  = (product?.fields || []).filter(f => ['Covers Required','Cover Required'].includes(f.section) && f.type === 'yesno');
      const clauseFields = (product?.fields || []).filter(f => f.section === 'Additional Clauses' && f.type === 'yesno');

      const mkSec = (label) => [{ content: label, colSpan: responses.length+1, styles:{ fillColor:[26,26,46], textColor:[255,139,90], fontStyle:'bold', fontSize:8, cellPadding:{top:3,bottom:3,left:5,right:5} } }];
      const mkRow = (label, vals, isTotal=false, i=0) => [
        { content:label, styles:{ fontStyle:isTotal?'bold':'normal', fontSize:isTotal?9:8.5, fillColor:isTotal?[255,90,90]:i%2===0?[255,255,255]:[255,248,245], textColor:isTotal?[255,255,255]:[26,26,46] } },
        ...vals.map(v => ({ content:v, styles:{ halign:'center', fontStyle:isTotal?'bold':'normal', fontSize:isTotal?9:8.5, fillColor:isTotal?[255,90,90]:i%2===0?[255,255,255]:[255,248,245], textColor:isTotal?[255,255,255]:[55,65,81] } })),
      ];

      const body = [
        mkSec('PREMIUM BREAKDOWN'),
        ...['basic_premium','srcc_premium','tc_premium','admin_fee','vat_amount','other_premium'].map((k,i)=>
          mkRow(['Basic Premium (LKR)','SRCC (LKR)','TC (LKR)','Admin Fee (LKR)','VAT (LKR)','Other (LKR)'][i],
                responses.map(r=>r[k]?`LKR ${Number(r[k]).toLocaleString()}`:'—'), false, i)),
        mkRow('TOTAL PREMIUM (LKR)', responses.map(r=>`LKR ${Number(r.premium||0).toLocaleString()}`), true),
        mkSec('DEDUCTIBLES, EXCESSES & VALIDITY'),
        mkRow('Deductibles',    responses.map(r=>r.deductible||'—'), false, 0),
        mkRow('Excesses',       responses.map(r=>r.excesses||'—'),   false, 1),
        mkRow('Validity (days)',responses.map(r=>r.validity_days||'—'), false, 2),
        ...(coverFields.length>0 ? [
          mkSec('COVERS INCLUDED'),
          ...coverFields.map((f,i)=>mkRow(f.label, responses.map(r=>{
            const cr=r.cover_responses?.[f.name]; return cr?.provided?`${cr.provided}${cr.terms?'\n'+cr.terms:''}`:'—';
          }), false, i)),
        ]:[]),
        ...(clauseFields.length>0 ? [
          mkSec('ADDITIONAL CLAUSES'),
          ...clauseFields.map((f,i)=>mkRow(f.label, responses.map(r=>{
            const cr=r.clause_responses?.[f.name]; return cr?.provided?`${cr.provided}${cr.terms?'\n'+cr.terms:''}`:'—';
          }), false, i)),
        ]:[]),
        mkSec('NOTES & SPECIAL TERMS'),
        mkRow('Notes / Terms', responses.map(r=>r.notes||'—'), false, 0),
      ];

      autoTable(pdf, {
        startY: 38,
        head: [[
          { content:'Field', styles:{fillColor:[26,26,46],textColor:[255,139,90],fontStyle:'bold',fontSize:9} },
          ...responses.map(r=>({ content:r.company_name, styles:{fillColor:[255,90,90],textColor:[255,255,255],fontStyle:'bold',fontSize:9,halign:'center'} })),
        ]],
        body,
        columnStyles: { 0: { cellWidth: 52 } },
        styles: { fontSize:8.5, cellPadding:{top:3.5,bottom:3.5,left:5,right:5}, overflow:'linebreak', minCellHeight:9 },
        margin: { left:10, right:10, top:28, bottom:18 },
        didDrawPage: (data) => { if (data.pageNumber > 1) drawHdr(); drawFtr(); },
      });

      pdf.save(`CeilaoIB_Comparison_${quote.reference}.pdf`);
      setStatus('done');
    } catch (err) {
      console.error(err);
      setError('Failed to generate PDF. Please try again.');
      setStatus('error');
    }
  };

  // Auto-trigger download once quote is loaded
  useEffect(() => {
    if (status === 'ready') generateAndDownload();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status]);

  return (
    <Box sx={{ minHeight:'100vh', bgcolor:'#F9F9FB', display:'flex', alignItems:'center', justifyContent:'center', p:3 }}>
      <Box sx={{ maxWidth:440, width:'100%', textAlign:'center' }}>

        <Box sx={{ width:64, height:64, borderRadius:'16px', mx:'auto', mb:2, background:'linear-gradient(135deg,#1A1A2E,#374151)', display:'flex', alignItems:'center', justifyContent:'center', fontSize:30 }}>
          📄
        </Box>

        <Typography variant="h5" sx={{ fontWeight:800, mb:0.5 }}>
          {status === 'generating' ? 'Generating Your PDF…' :
           status === 'done'       ? 'PDF Downloaded!' :
           status === 'error'      ? 'Something went wrong' :
           'Preparing Comparison PDF'}
        </Typography>
        <Typography sx={{ color:'#6B7280', fontSize:13, mb:3 }}>
          Ceilao Insurance Brokers — {quote?.reference || '…'}
        </Typography>

        {(status === 'loading' || status === 'generating') && (
          <CircularProgress sx={{ color:'#FF5A5A', mb:2 }} />
        )}

        {status === 'error' && (
          <>
            <Alert severity="error" sx={{ mb:2, textAlign:'left' }}>{error}</Alert>
            <Button variant="contained" onClick={() => window.location.reload()}
              sx={{ background:'linear-gradient(135deg,#FF5A5A,#FF8B5A)' }}>
              Try Again
            </Button>
          </>
        )}

        {status === 'done' && (
          <>
            <Alert severity="success" sx={{ mb:2, textAlign:'left' }}>
              Your comparison PDF has been downloaded successfully.
            </Alert>
            <Button variant="outlined" onClick={generateAndDownload}
              sx={{ borderColor:'rgba(255,90,90,0.3)', color:'#FF5A5A' }}>
              Download Again
            </Button>
          </>
        )}

        <Typography sx={{ fontSize:11.5, color:'#9CA3AF', mt:3 }}>
          Ceilao Insurance Brokers (Pvt) Ltd — Confidential Quotation Portal
        </Typography>
      </Box>
    </Box>
  );
};

export default ComparisonPdfPage;
