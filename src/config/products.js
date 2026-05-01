// Insurance product definitions — one source of truth for forms, labels, comparison rows

export const PRODUCTS = {
  fire: {
    label: 'Fire Insurance',
    icon: '🔥',
    color: '#FF5A5A',
    comparisonRows: ['Annual Premium (LKR)', 'Sum Insured (LKR)', 'Deductible', 'Perils Covered', 'Reinstatement', 'Loss of Rent', 'Public Liability', 'Validity (days)', 'Special Conditions'],
    fields: [
      { name: 'property_name',    label: 'Property / Risk Name',        required: true },
      { name: 'property_address', label: 'Property Address',            required: true },
      { name: 'occupancy',        label: 'Occupancy / Use',             required: true,  options: ['Residential','Commercial','Industrial','Warehouse','Mixed'] },
      { name: 'construction',     label: 'Construction Type',           required: true,  options: ['Brick & Concrete','Timber','Semi-Permanent','Steel Frame'] },
      { name: 'building_value',   label: 'Building Value (LKR)',        required: true,  type: 'number' },
      { name: 'contents_value',   label: 'Contents Value (LKR)',        type: 'number' },
      { name: 'stock_value',      label: 'Stock / Goods Value (LKR)',   type: 'number' },
      { name: 'machinery_value',  label: 'Machinery Value (LKR)',       type: 'number' },
      { name: 'sum_insured',      label: 'Total Sum Insured (LKR)',     required: true,  type: 'number' },
      { name: 'perils',           label: 'Perils Required',             multiSelect: true, options: ['Fire','Lightning','Explosion','Aircraft Damage','Riot & Strike','Malicious Damage','Storm & Flood','Earthquake','Subsidence','Impact Damage','Sprinkler Leakage','Overflow of Water','Bursting of Pipes'] },
      { name: 'period_from',      label: 'Policy Period From',          type: 'date' },
      { name: 'period_to',        label: 'Policy Period To',            type: 'date' },
      { name: 'remarks',          label: 'Special Instructions / Remarks' },
    ],
  },

  motor: {
    label: 'Motor Insurance',
    icon: '🚗',
    color: '#6366f1',
    comparisonRows: ['Annual Premium (LKR)', 'Sum Insured (LKR)', 'Own Damage Excess', 'Windscreen Cover', 'PA Driver Cover', 'PA Passenger Cover', 'Emergency Towing', 'Flood Cover', 'Validity (days)', 'Special Conditions'],
    fields: [
      { name: 'vehicle_reg',      label: 'Vehicle Registration No.',    required: true },
      { name: 'make',             label: 'Make',                        required: true },
      { name: 'model',            label: 'Model',                       required: true },
      { name: 'year',             label: 'Year of Manufacture',         required: true, type: 'number' },
      { name: 'engine_cc',        label: 'Engine CC',                   type: 'number' },
      { name: 'chassis_no',       label: 'Chassis No.' },
      { name: 'seating',          label: 'Seating Capacity',            type: 'number' },
      { name: 'fuel_type',        label: 'Fuel Type',                   options: ['Petrol','Diesel','Electric','Hybrid','CNG'] },
      { name: 'cover_type',       label: 'Cover Type',                  required: true, options: ['Comprehensive','Third Party Only','Third Party Fire & Theft'] },
      { name: 'sum_insured',      label: 'Sum Insured / Market Value (LKR)', required: true, type: 'number' },
      { name: 'ncb',              label: 'No Claim Bonus (%)',          type: 'number' },
      { name: 'period_from',      label: 'Policy Period From',          type: 'date' },
      { name: 'period_to',        label: 'Policy Period To',            type: 'date' },
      { name: 'remarks',          label: 'Special Instructions / Remarks' },
    ],
  },

  life: {
    label: 'Life Insurance',
    icon: '💚',
    color: '#10B981',
    comparisonRows: ['Annual Premium (LKR)', 'Sum Assured (LKR)', 'Policy Term (years)', 'Premium Payment Term', 'Surrender Value', 'Loan Facility', 'Accidental Death Benefit', 'Critical Illness Rider', 'Disability Rider', 'Validity (days)'],
    fields: [
      { name: 'proposer_name',    label: 'Proposer Full Name',          required: true },
      { name: 'dob',              label: 'Date of Birth',               required: true, type: 'date' },
      { name: 'gender',           label: 'Gender',                      required: true, options: ['Male','Female'] },
      { name: 'nic',              label: 'NIC / Passport No.' },
      { name: 'occupation',       label: 'Occupation',                  required: true },
      { name: 'smoker',           label: 'Smoker?',                     options: ['No','Yes'] },
      { name: 'policy_type',      label: 'Policy Type',                 required: true, options: ['Whole Life','Term Life','Endowment','Unit Linked','Money Back'] },
      { name: 'sum_assured',      label: 'Sum Assured (LKR)',           required: true, type: 'number' },
      { name: 'policy_term',      label: 'Policy Term (years)',         required: true, type: 'number' },
      { name: 'premium_term',     label: 'Premium Payment Term',        options: ['Single','5 years','10 years','15 years','20 years','Till maturity'] },
      { name: 'premium_mode',     label: 'Premium Payment Mode',        options: ['Monthly','Quarterly','Half-Yearly','Annually'] },
      { name: 'medical_history',  label: 'Existing Medical Conditions' },
      { name: 'remarks',          label: 'Special Instructions / Remarks' },
    ],
  },

  marine: {
    label: 'Marine Insurance',
    icon: '⚓',
    color: '#0ea5e9',
    comparisonRows: ['Premium Rate (%)', 'Premium (LKR)', 'Sum Insured (LKR)', 'Cover Basis', 'War & Strikes', 'Theft Cover', 'Transshipment', 'Survey Required', 'Validity (days)', 'Special Conditions'],
    fields: [
      { name: 'cargo_description',label: 'Cargo / Goods Description',  required: true },
      { name: 'packing',          label: 'Packing / Container Type',    required: true },
      { name: 'marks',            label: 'Marks & Numbers / Invoice No.' },
      { name: 'quantity',         label: 'Quantity / Weight' },
      { name: 'origin',           label: 'Port / Place of Origin',      required: true },
      { name: 'destination',      label: 'Port / Place of Destination', required: true },
      { name: 'mode',             label: 'Mode of Transport',           required: true, options: ['Sea','Air','Land','Multimodal','Courier'] },
      { name: 'vessel',           label: 'Vessel / Aircraft / Vehicle Name' },
      { name: 'voyage_date',      label: 'Expected Voyage Date',        type: 'date' },
      { name: 'sum_insured',      label: 'Sum Insured (LKR)',           required: true, type: 'number' },
      { name: 'cover_type',       label: 'Institute Cargo Clause',      required: true, options: ['ICC (A) — All Risks','ICC (B)','ICC (C) — Basic'] },
      { name: 'remarks',          label: 'Special Instructions / Remarks' },
    ],
  },

  medical: {
    label: 'Medical / Health',
    icon: '🏥',
    color: '#f59e0b',
    comparisonRows: ['Annual Premium (LKR)', 'Hospitalization Limit (LKR)', 'OPD Limit (LKR)', 'Pre-existing Cover', 'Maternity Benefit', 'Dental Cover', 'No-Claim Bonus', 'Network Hospitals', 'Validity (days)', 'Special Conditions'],
    fields: [
      { name: 'proposer_name',    label: 'Proposer / Company Name',     required: true },
      { name: 'member_count',     label: 'No. of Members',              required: true, type: 'number' },
      { name: 'member_details',   label: 'Member Ages (e.g. 35, 32, 8, 5)' },
      { name: 'plan_type',        label: 'Plan Type',                   required: true, options: ['Individual','Family Floater','Group (Company)','Executive'] },
      { name: 'hospitalization',  label: 'Hospitalization Limit Required (LKR)', required: true, type: 'number' },
      { name: 'opd',              label: 'OPD Limit Required (LKR)',    type: 'number' },
      { name: 'pre_existing',     label: 'Pre-existing Conditions Coverage?', options: ['Not Required','After 1 year waiting','From day 1'] },
      { name: 'maternity',        label: 'Maternity Benefit Required?', options: ['No','Yes'] },
      { name: 'dental',           label: 'Dental Coverage Required?',   options: ['No','Yes'] },
      { name: 'period_from',      label: 'Policy Period From',          type: 'date' },
      { name: 'remarks',          label: 'Special Instructions / Remarks' },
    ],
  },

  engineering: {
    label: 'Engineering',
    icon: '⚙️',
    color: '#8b5cf6',
    comparisonRows: ['Annual Premium (LKR)', 'Contract Value (LKR)', 'Third Party Limit (LKR)', 'Deductible', 'Maintenance Period', 'Escalation Clause', 'Offsite Storage', 'Validity (days)', 'Special Conditions'],
    fields: [
      { name: 'project_name',     label: 'Project Name',                required: true },
      { name: 'project_type',     label: 'Type of Work',                required: true, options: ['Contractors All Risk (CAR)','Erection All Risk (EAR)','Plant & Machinery Breakdown','Electronic Equipment','Deterioration of Stock'] },
      { name: 'contractor',       label: 'Contractor / Insured Name',   required: true },
      { name: 'employer',         label: 'Employer / Principal' },
      { name: 'location',         label: 'Project Site Location',       required: true },
      { name: 'contract_value',   label: 'Contract / Project Value (LKR)', required: true, type: 'number' },
      { name: 'third_party',      label: 'Third Party Liability Limit (LKR)', type: 'number' },
      { name: 'period_from',      label: 'Construction Period From',    type: 'date' },
      { name: 'period_to',        label: 'Construction Period To',      type: 'date' },
      { name: 'maintenance',      label: 'Maintenance Period (months)', type: 'number' },
      { name: 'remarks',          label: 'Special Instructions / Remarks' },
    ],
  },
};

export const PRODUCT_LIST = Object.entries(PRODUCTS).map(([key, val]) => ({
  key,
  ...val,
}));

export const MODULES = [
  { key: 'quotations',   label: 'Quotations',       icon: '📋', description: 'Quote requests and comparisons' },
  { key: 'underwriting', label: 'Underwriting',      icon: '📝', description: 'Policy issuance and client records' },
  { key: 'claims',       label: 'Claims',            icon: '🛡️', description: 'Claims registration and tracking' },
  { key: 'accounting',   label: 'Accounting',        icon: '💰', description: 'Premiums, commissions and payments' },
  { key: 'reports',      label: 'Reports',           icon: '📊', description: 'Analytics and data exports' },
  { key: 'renewals',     label: 'Renewals Tracker',  icon: '🔄', description: 'Upcoming renewals and alerts' },
];

export const DEFAULT_MODULE_ACCESS = {
  quotations:   ['admin', 'manager', 'employee'],
  underwriting: ['admin', 'manager', 'employee'],
  claims:       ['admin', 'manager', 'employee'],
  accounting:   ['admin', 'manager'],
  reports:      ['admin', 'manager', 'employee'],
  renewals:     ['admin', 'manager', 'employee'],
};
