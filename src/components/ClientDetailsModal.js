import React, { useState } from 'react';
import { viewUrl } from '../cloudinary';
import Dialog from '@mui/material/Dialog';
import DialogTitle from '@mui/material/DialogTitle';
import DialogContent from '@mui/material/DialogContent';
import DialogActions from '@mui/material/DialogActions';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import Grid from '@mui/material/Grid';
import Button from '@mui/material/Button';
import Tabs from '@mui/material/Tabs';
import Tab from '@mui/material/Tab';
import Link from '@mui/material/Link';
import Chip from '@mui/material/Chip';
import Stack from '@mui/material/Stack';

import PersonOutlineIcon from '@mui/icons-material/PersonOutline';
import HomeOutlinedIcon from '@mui/icons-material/HomeOutlined';
import ContactPhoneOutlinedIcon from '@mui/icons-material/ContactPhoneOutlined';
import PolicyOutlinedIcon from '@mui/icons-material/PolicyOutlined';
import MonetizationOnOutlinedIcon from '@mui/icons-material/MonetizationOnOutlined';
import FolderOutlinedIcon from '@mui/icons-material/FolderOutlined';
import OpenInNewIcon from '@mui/icons-material/OpenInNew';

const docFields = [
  { label:'Policyholder',     doc:'policyholder_doc_url',     text:'policyholder_text' },
  { label:'Proposal Form',    doc:'proposal_form_doc_url',    text:'proposal_form_text' },
  { label:'Quotation',        doc:'quotation_doc_url',        text:'quotation_text' },
  { label:'CR Copy',          doc:'cr_copy_doc_url',          text:'cr_copy_text' },
  { label:'Schedule',         doc:'schedule_doc_url',         text:'schedule_text' },
  { label:'Invoice / Debit',  doc:'invoice_doc_url',          text:'invoice_text' },
  { label:'Payment Receipt',  doc:'payment_receipt_doc_url',  text:'payment_receipt_text' },
  { label:'NIC / BR',         doc:'nic_br_doc_url',           text:'nic_br_text' },
];

const tabs = [
  { label:'General',    icon:<PersonOutlineIcon /> },
  { label:'Address',    icon:<HomeOutlinedIcon /> },
  { label:'Contact',    icon:<ContactPhoneOutlinedIcon /> },
  { label:'Policy',     icon:<PolicyOutlinedIcon /> },
  { label:'Financials', icon:<MonetizationOnOutlinedIcon /> },
  { label:'Documents',  icon:<FolderOutlinedIcon /> },
];

function Field({ label, value }) {
  if (!value) return null;
  return (
    <Box>
      <Typography sx={{ fontSize: 10.5, fontWeight: 700, color: '#9CA3AF', textTransform: 'uppercase', letterSpacing: 0.6, mb: 0.3 }}>
        {label}
      </Typography>
      <Typography sx={{ fontSize: 13.5, color: '#1A1A2E', fontWeight: 500 }}>
        {value}
      </Typography>
    </Box>
  );
}

function FinancialRow({ label, value }) {
  const fmt = (v) => v ? `LKR ${Number(v).toLocaleString()}` : '—';
  return (
    <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', py: 1, borderBottom: '1px solid rgba(255,139,90,0.08)' }}>
      <Typography sx={{ fontSize: 13, color: '#6B7280' }}>{label}</Typography>
      <Typography sx={{ fontSize: 13, fontWeight: 700, color: '#1A1A2E' }}>{fmt(value)}</Typography>
    </Box>
  );
}

function DocCard({ label, url, description }) {
  return (
    <Box sx={{
      p: 1.5, borderRadius: '12px',
      border: `1px solid ${url ? 'rgba(255,139,90,0.25)' : 'rgba(0,0,0,0.06)'}`,
      bgcolor: url ? 'rgba(255,248,245,0.8)' : '#FAFAFA',
      transition: 'all 0.2s ease',
      '&:hover': url ? { boxShadow: '0 4px 16px rgba(255,90,90,0.10)', transform: 'translateY(-1px)' } : {},
    }}>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 0.5 }}>
        <Typography sx={{ fontSize: 12, fontWeight: 700, color: '#374151' }}>{label}</Typography>
        {url && (
          <Link href={viewUrl(url)} target="_blank" rel="noopener noreferrer"
            sx={{ display: 'flex', alignItems: 'center', gap: 0.3, fontSize: 11, fontWeight: 700, color: '#FF5A5A', textDecoration: 'none',
                  '&:hover': { textDecoration: 'underline' } }}>
            View <OpenInNewIcon sx={{ fontSize: 11 }} />
          </Link>
        )}
      </Box>
      <Typography sx={{ fontSize: 11, color: url ? '#FF8B5A' : '#C4B5B0', fontWeight: url ? 500 : 400 }}>
        {url ? 'Document uploaded' : 'No document'}
      </Typography>
      {description && (
        <Typography sx={{ fontSize: 11, color: '#6B7280', mt: 0.5, fontStyle: 'italic' }}>
          {description}
        </Typography>
      )}
    </Box>
  );
}

const ClientDetailsModal = ({ client, onClose }) => {
  const [tab, setTab] = useState(0);
  if (!client) return null;

  const renderTab = () => {
    switch (tab) {
      case 0: /* General */
        return (
          <Grid container spacing={2.5}>
            <Grid item xs={12} sm={6} md={4}><Field label="Client Name"         value={client.client_name} /></Grid>
            <Grid item xs={12} sm={6} md={4}><Field label="Customer Type"        value={client.customer_type} /></Grid>
            <Grid item xs={12} sm={6} md={4}><Field label="Product"              value={client.product} /></Grid>
            <Grid item xs={12} sm={6} md={4}><Field label="Insurance Provider"   value={client.insurance_provider} /></Grid>
            <Grid item xs={12} sm={6} md={4}><Field label="Insurer"              value={client.insurer} /></Grid>
            <Grid item xs={12} sm={6} md={4}><Field label="Branch"               value={client.branch} /></Grid>
            <Grid item xs={12} sm={6} md={4}><Field label="Main Class"           value={client.main_class} /></Grid>
            <Grid item xs={12} sm={6} md={4}><Field label="Vehicle Number"       value={client.vehicle_number} /></Grid>
            <Grid item xs={12} sm={6} md={4}><Field label="Ceilao IB File No."   value={client.ceilao_ib_file_no} /></Grid>
            <Grid item xs={12} sm={6} md={4}><Field label="Introducer Code"      value={client.introducer_code} /></Grid>
            <Grid item xs={12} sm={6} md={4}><Field label="NIC Proof"            value={client.nic_proof} /></Grid>
            <Grid item xs={12} sm={6} md={4}><Field label="DOB Proof"            value={client.dob_proof} /></Grid>
            <Grid item xs={12} sm={6} md={4}><Field label="Business Reg."        value={client.business_registration} /></Grid>
            <Grid item xs={12} sm={6} md={4}><Field label="SVAT Proof"           value={client.svat_proof} /></Grid>
            <Grid item xs={12} sm={6} md={4}><Field label="VAT Proof"            value={client.vat_proof} /></Grid>
            <Grid item xs={12} sm={6} md={4}><Field label="Sales Rep ID"         value={client.sales_rep_id} /></Grid>
          </Grid>
        );
      case 1: /* Address */
        return (
          <Grid container spacing={2.5}>
            <Grid item xs={12} sm={6}><Field label="Street 1"  value={client.street1} /></Grid>
            <Grid item xs={12} sm={6}><Field label="Street 2"  value={client.street2} /></Grid>
            <Grid item xs={12} sm={6} md={4}><Field label="City"     value={client.city} /></Grid>
            <Grid item xs={12} sm={6} md={4}><Field label="District" value={client.district} /></Grid>
            <Grid item xs={12} sm={6} md={4}><Field label="Province" value={client.province} /></Grid>
          </Grid>
        );
      case 2: /* Contact */
        return (
          <Grid container spacing={2.5}>
            <Grid item xs={12} sm={6} md={4}><Field label="Mobile No"      value={client.mobile_no} /></Grid>
            <Grid item xs={12} sm={6} md={4}><Field label="Telephone"      value={client.telephone} /></Grid>
            <Grid item xs={12} sm={6} md={4}><Field label="Email"          value={client.email} /></Grid>
            <Grid item xs={12} sm={6} md={4}><Field label="Contact Person" value={client.contact_person} /></Grid>
            <Grid item xs={12} sm={6} md={4}><Field label="Social Media"   value={client.social_media} /></Grid>
          </Grid>
        );
      case 3: /* Policy */
        return (
          <Grid container spacing={2.5}>
            <Grid item xs={12} sm={6} md={4}><Field label="Policy Type"        value={client.policy_type} /></Grid>
            <Grid item xs={12} sm={6} md={4}><Field label="Policy No"          value={client.policy_no} /></Grid>
            <Grid item xs={12} sm={6} md={4}><Field label="Policy"             value={client.policy_} /></Grid>
            <Grid item xs={12} sm={6} md={4}><Field label="Policy Period From" value={client.policy_period_from} /></Grid>
            <Grid item xs={12} sm={6} md={4}><Field label="Policy Period To"   value={client.policy_period_to} /></Grid>
            <Grid item xs={12} sm={6} md={4}><Field label="Coverage"           value={client.coverage} /></Grid>
          </Grid>
        );
      case 4: /* Financials */
        return (
          <Box>
            <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr' }, gap: 3, mb: 2 }}>
              <Box>
                <Typography sx={{ fontSize: 12, fontWeight: 700, color: '#9CA3AF', mb: 1, letterSpacing: 0.6, textTransform: 'uppercase' }}>Premiums</Typography>
                <FinancialRow label="Sum Insured"    value={client.sum_insured} />
                <FinancialRow label="Basic Premium"  value={client.basic_premium} />
                <FinancialRow label="SRCC Premium"   value={client.srcc_premium} />
                <FinancialRow label="TC Premium"     value={client.tc_premium} />
                <FinancialRow label="Net Premium"    value={client.net_premium} />
              </Box>
              <Box>
                <Typography sx={{ fontSize: 12, fontWeight: 700, color: '#9CA3AF', mb: 1, letterSpacing: 0.6, textTransform: 'uppercase' }}>Fees & Taxes</Typography>
                <FinancialRow label="Stamp Duty"      value={client.stamp_duty} />
                <FinancialRow label="Admin Fees"      value={client.admin_fees} />
                <FinancialRow label="Road Safety Fee" value={client.road_safety_fee} />
                <FinancialRow label="Policy Fee"      value={client.policy_fee} />
                <FinancialRow label="VAT Fee"         value={client.vat_fee} />
              </Box>
            </Box>
            <Box sx={{ p: 2, borderRadius: '12px', background: 'linear-gradient(135deg,rgba(255,90,90,0.08),rgba(255,139,90,0.06))', border: '1px solid rgba(255,90,90,0.15)' }}>
              <Typography sx={{ fontSize: 12, color: '#9CA3AF', mb: 0.5 }}>Total Invoice</Typography>
              <Typography sx={{ fontSize: 24, fontWeight: 800, color: '#FF5A5A' }}>
                LKR {Number(client.total_invoice || 0).toLocaleString()}
              </Typography>
            </Box>
            <Box sx={{ mt: 2 }}>
              <Typography sx={{ fontSize: 12, fontWeight: 700, color: '#9CA3AF', mb: 1, letterSpacing: 0.6, textTransform: 'uppercase' }}>Commission</Typography>
              <Stack direction="row" spacing={2} flexWrap="wrap">
                <Field label="Type"  value={client.commission_type} />
                <Field label="Basic" value={client.commission_basic} />
                <Field label="SRCC"  value={client.commission_srcc} />
                <Field label="TC"    value={client.commission_tc} />
              </Stack>
            </Box>
          </Box>
        );
      case 5: /* Documents */
        return (
          <Grid container spacing={1.5}>
            {docFields.map(df => (
              <Grid item xs={12} sm={6} key={df.doc}>
                <DocCard label={df.label} url={client[df.doc]} description={client[df.text]} />
              </Grid>
            ))}
          </Grid>
        );
      default: return null;
    }
  };

  return (
    <Dialog
      open={!!client} onClose={onClose}
      maxWidth="md" fullWidth
      PaperProps={{ sx: { maxHeight: '90vh' } }}
    >
      {/* header */}
      <DialogTitle sx={{ pb: 1 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
          <Box sx={{ flex: 1 }}>
            <Typography sx={{ fontWeight: 800, fontSize: 17, color: '#fff' }}>{client.client_name}</Typography>
            <Box sx={{ display: 'flex', gap: 1, mt: 0.5, flexWrap: 'wrap' }}>
              {client.customer_type && (
                <Chip label={client.customer_type} size="small"
                  sx={{ fontSize: 10, fontWeight: 700, bgcolor: 'rgba(255,255,255,0.20)', color: '#fff', height: 20 }} />
              )}
              {client.product && (
                <Chip label={client.product} size="small"
                  sx={{ fontSize: 10, fontWeight: 700, bgcolor: 'rgba(255,255,255,0.20)', color: '#fff', height: 20 }} />
              )}
            </Box>
          </Box>
        </Box>
      </DialogTitle>

      {/* tabs */}
      <Box sx={{ bgcolor: 'rgba(255,248,245,0.5)', borderBottom: '1px solid rgba(255,139,90,0.12)' }}>
        <Tabs
          value={tab} onChange={(_, v) => setTab(v)}
          variant="scrollable" scrollButtons="auto"
          sx={{
            minHeight: 42,
            '& .MuiTab-root': { fontSize: 12, fontWeight: 600, minHeight: 42, py: 0, textTransform: 'none', color: '#9CA3AF', minWidth: 'unset', px: 2 },
            '& .Mui-selected': { color: '#FF5A5A' },
            '& .MuiTabs-indicator': { background: 'linear-gradient(90deg,#FF5A5A,#FF8B5A)', height: 2.5 },
          }}
        >
          {tabs.map((t, i) => (
            <Tab key={i} label={t.label} icon={t.icon} iconPosition="start"
              sx={{ '& .MuiTab-iconWrapper': { fontSize: 16, mr: 0.5 } }} />
          ))}
        </Tabs>
      </Box>

      {/* content */}
      <DialogContent sx={{ p: 3, overflowY: 'auto' }}>
        <Box className="anim-fade-in">
          {renderTab()}
        </Box>
      </DialogContent>

      <DialogActions sx={{ px: 3, py: 2, borderTop: '1px solid rgba(255,139,90,0.10)' }}>
        <Button onClick={onClose} variant="outlined"
          sx={{ borderColor: '#e0e0e0', color: '#6B7280', '&:hover': { borderColor: '#aaa' } }}>
          Close
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default ClientDetailsModal;
