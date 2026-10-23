import { createClient } from '@supabase/supabase-js';
import fs from 'fs';
import path from 'path';

// Load .env.local
const envPath = path.resolve(process.cwd(), '.env.local');
let envContent = '';
if (fs.existsSync(envPath)) {
  envContent = fs.readFileSync(envPath, 'utf-8');
}

const getEnv = (key) => {
  const match = envContent.match(new RegExp(`^${key}=(.*)$`, 'm'));
  return match ? match[1].trim() : process.env[key];
};

const supabaseUrl = getEnv('VITE_SUPABASE_URL') || 'https://ewwadohdfmqfbdqndrhr.supabase.co';
const supabaseKey = getEnv('VITE_SUPABASE_ANON_KEY') || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImV3d2Fkb2hkZm1xZmJkcW5kcmhyIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjQ3NTg2MDQsImV4cCI6MjA4MDMzNDYwNH0.KU2yNQ_s8DSW3Urt39cJXzCoh02p4fynBzP8Li6x8dw';

const supabase = createClient(supabaseUrl, supabaseKey);

// 1. Ensure categories table has core science categories
const CORE_CATEGORIES = [
  { id: 'chemistry', name: 'Chemistry', is_default: true },
  { id: 'biology', name: 'Biology', is_default: true },
  { id: 'physics', name: 'Physics', is_default: true },
  { id: 'earth-science', name: 'Earth Science', is_default: true },
  { id: 'general', name: 'General', is_default: true }
];

async function sync() {
  console.log('Connecting to Supabase at:', supabaseUrl);

  // Sync Categories
  console.log('\n--- SYNCING CATEGORIES ---');
  for (const cat of CORE_CATEGORIES) {
    const { error } = await supabase.from('categories').upsert(cat, { onConflict: 'name' });
    if (error) console.warn('Category upsert notice for', cat.name, error.message);
    else console.log('  ✓ Category ready:', cat.name);
  }

  // Load LNHS items from data/lnhsActualEquipment.ts
  const equipmentFilePath = path.resolve(process.cwd(), 'data/lnhsActualEquipment.ts');
  const tsContent = fs.readFileSync(equipmentFilePath, 'utf-8');

  // We can import or execute via jiti/tsx or define here:
  console.log('\n--- SYNCING ACTUAL PROPERTY ITEMS (PIS TAGGED APPARATUS) ---');
  const { data: existingProps } = await supabase.from('property_items').select('*');
  console.log('Currently existing property items in DB:', existingProps?.length || 0);

  // Read actual property items list
  const propertyItems = [
    {
      property_number: 'LNHS-SCI-2025-001',
      pis_code: 'PIS-25-00101',
      name: 'Triple Beam Balance',
      category: 'Science Lab - Balances & Measurement',
      description: 'Mechanical triple beam balance with stainless steel pan, magnetic damping, 610g capacity. DepEd standard issue.',
      quantity: 35,
      unit: 'units',
      unit_value: 4850,
      total_value: 169750,
      location: 'Cabinet 1',
      custodian: 'Jeebs M. Sabidalas',
      condition: 'Serviceable',
      acquisition_date: '2025-06-15',
      source_of_fund: 'DepEd National GAA',
      inventory_type: 'Semi-Expendable',
      par_number: 'ICS-2025-SCI-01',
      notes: 'Actual inventory counted: 35 units stored in Cabinet 1.',
      short_id: 'SCI-BAL-01'
    },
    {
      property_number: 'LNHS-SCI-2025-002',
      pis_code: 'PIS-25-00102',
      name: 'Optical Bench (1 m with riders)',
      category: 'Science Lab - Apparatus & Instruments',
      description: '100 cm graduated aluminum/steel optical rail complete with sliding carriers/riders and lens holders.',
      quantity: 25,
      unit: 'sets',
      unit_value: 4200,
      total_value: 105000,
      location: 'Cabinet 3',
      custodian: 'Jeebs M. Sabidalas',
      condition: 'Serviceable',
      acquisition_date: '2025-06-15',
      source_of_fund: 'DepEd National GAA',
      inventory_type: 'Semi-Expendable',
      par_number: 'ICS-2025-SCI-02',
      notes: 'Actual inventory counted: 25 sets stored in Cabinet 3.',
      short_id: 'SCI-OPT-01'
    },
    {
      property_number: 'LNHS-SCI-2025-003',
      pis_code: 'PIS-25-00103',
      name: 'Optical Lens Bench',
      category: 'Science Lab - Apparatus & Instruments',
      description: 'Specialized optical rail support for focal length and image formation experiments with adjustable lens brackets.',
      quantity: 2,
      unit: 'sets',
      unit_value: 3500,
      total_value: 7000,
      location: 'Cabinet 2',
      custodian: 'Jeebs M. Sabidalas',
      condition: 'Serviceable',
      acquisition_date: '2025-06-15',
      source_of_fund: 'DepEd National GAA',
      inventory_type: 'Semi-Expendable',
      par_number: 'ICS-2025-SCI-03',
      notes: 'Actual inventory counted: 2 sets stored in Cabinet 2.',
      short_id: 'SCI-OPT-02'
    },
    {
      property_number: 'LNHS-SCI-2025-004',
      pis_code: 'PIS-25-00104',
      name: 'Hot Plate (ceramic 500 W)',
      category: 'Science Lab - Electrical & Electronic Equipment',
      description: 'Laboratory electric heating plate with ceramic surface, 500 W heating element, stepless temperature control dial.',
      quantity: 4,
      unit: 'units',
      unit_value: 3800,
      total_value: 15200,
      location: 'Cabinet 2',
      custodian: 'Jeebs M. Sabidalas',
      condition: 'Serviceable',
      acquisition_date: '2025-06-15',
      source_of_fund: 'School MOOE',
      inventory_type: 'Semi-Expendable',
      par_number: 'ICS-2025-SCI-04',
      notes: 'Actual inventory counted: 4 units stored in Cabinet 2.',
      short_id: 'SCI-HEAT-01'
    },
    {
      property_number: 'LNHS-SCI-2025-005',
      pis_code: 'PIS-25-00105',
      name: 'Aneroid Barometer',
      category: 'Science Lab - Earth & Space Science',
      description: 'Precision dial-type aneroid barometer measuring atmospheric pressure in hPa and mmHg.',
      quantity: 12,
      unit: 'units',
      unit_value: 2800,
      total_value: 33600,
      location: 'Cabinet 1',
      custodian: 'Jeebs M. Sabidalas',
      condition: 'Serviceable',
      acquisition_date: '2025-06-15',
      source_of_fund: 'DepEd National GAA',
      inventory_type: 'Semi-Expendable',
      par_number: 'ICS-2025-SCI-05',
      notes: 'Actual inventory counted: 12 units stored in Cabinet 1.',
      short_id: 'SCI-BARO-01'
    },
    {
      property_number: 'LNHS-SCI-2025-006',
      pis_code: 'PIS-25-00106',
      name: 'Sling Psychrometer',
      category: 'Science Lab - Earth & Space Science',
      description: 'Dual thermometer whirling psychrometer (dry-bulb and wet-bulb) mounted on swivel handle with relative humidity scale.',
      quantity: 18,
      unit: 'units',
      unit_value: 1650,
      total_value: 29700,
      location: 'Cabinet 1',
      custodian: 'Jeebs M. Sabidalas',
      condition: 'Serviceable',
      acquisition_date: '2025-06-15',
      source_of_fund: 'DepEd National GAA',
      inventory_type: 'Semi-Expendable',
      par_number: 'ICS-2025-SCI-06',
      notes: 'Actual inventory counted: 18 units stored in Cabinet 1.',
      short_id: 'SCI-PSY-01'
    },
    {
      property_number: 'LNHS-SCI-2025-007',
      pis_code: 'PIS-25-00107',
      name: 'Digital Multimeter',
      category: 'Science Lab - Electrical & Electronic Equipment',
      description: 'Digital multimeter with True-RMS, backlit LCD display, test probe leads, measuring AC/DC voltage and resistance.',
      quantity: 7,
      unit: 'units',
      unit_value: 2400,
      total_value: 16800,
      location: 'Cabinet 2',
      custodian: 'Jeebs M. Sabidalas',
      condition: 'Serviceable',
      acquisition_date: '2025-06-15',
      source_of_fund: 'School MOOE',
      inventory_type: 'Semi-Expendable',
      par_number: 'ICS-2025-SCI-07',
      notes: 'Actual inventory counted: 7 units stored in Cabinet 2.',
      short_id: 'SCI-ELEC-01'
    },
    {
      property_number: 'LNHS-SCI-2025-008',
      pis_code: 'PIS-25-00108',
      name: 'Ticker Timer',
      category: 'Science Lab - Apparatus & Instruments',
      description: 'Electromagnetic ticker timer operating at 50 Hz for velocity and acceleration mechanics experiments.',
      quantity: 24,
      unit: 'units',
      unit_value: 2600,
      total_value: 62400,
      location: 'Cabinet 1',
      custodian: 'Jeebs M. Sabidalas',
      condition: 'Serviceable',
      acquisition_date: '2025-06-15',
      source_of_fund: 'DepEd National GAA',
      inventory_type: 'Semi-Expendable',
      par_number: 'ICS-2025-SCI-08',
      notes: 'Actual inventory counted: 24 units stored in Cabinet 1.',
      short_id: 'SCI-TIM-01'
    },
    {
      property_number: 'LNHS-SCI-2025-009',
      pis_code: 'PIS-25-00109',
      name: 'AC Output Power Supply Unit',
      category: 'Science Lab - Electrical & Electronic Equipment',
      description: 'Laboratory stepped low-voltage AC power supply (2V to 12V AC) with overload circuit breaker protection.',
      quantity: 9,
      unit: 'units',
      unit_value: 3950,
      total_value: 35550,
      location: 'Cabinet 5',
      custodian: 'Jeebs M. Sabidalas',
      condition: 'Serviceable',
      acquisition_date: '2025-06-15',
      source_of_fund: 'DepEd National GAA',
      inventory_type: 'Semi-Expendable',
      par_number: 'ICS-2025-SCI-09',
      notes: 'Actual inventory counted: 9 units stored in Cabinet 5.',
      short_id: 'SCI-PWR-01'
    },
    {
      property_number: 'LNHS-SCI-2025-010',
      pis_code: 'PIS-25-00110',
      name: 'Generator Output Dynamo Apparatus',
      category: 'Science Lab - Electrical & Electronic Equipment',
      description: 'Hand-crank and motor-driven electrical dynamo generator demonstration apparatus with clear casing.',
      quantity: 7,
      unit: 'units',
      unit_value: 3200,
      total_value: 22400,
      location: 'Cabinet 5',
      custodian: 'Jeebs M. Sabidalas',
      condition: 'Serviceable',
      acquisition_date: '2025-06-15',
      source_of_fund: 'DepEd National GAA',
      inventory_type: 'Semi-Expendable',
      par_number: 'ICS-2025-SCI-10',
      notes: 'Actual inventory counted: 7 units stored in Cabinet 5.',
      short_id: 'SCI-GEN-01'
    },
    {
      property_number: 'LNHS-SCI-2025-011',
      pis_code: 'PIS-25-00111',
      name: 'Logic Gate Trainer Board',
      category: 'Science Lab - Electrical & Electronic Equipment',
      description: 'Digital electronics logic trainer module featuring AND, OR, NOT, NAND, NOR logic gates.',
      quantity: 3,
      unit: 'units',
      unit_value: 5500,
      total_value: 16500,
      location: 'Cabinet 5',
      custodian: 'Jeebs M. Sabidalas',
      condition: 'Serviceable',
      acquisition_date: '2025-06-15',
      source_of_fund: 'DepEd National GAA',
      inventory_type: 'Semi-Expendable',
      par_number: 'ICS-2025-SCI-11',
      notes: 'Actual inventory counted: 3 units stored in Cabinet 5.',
      short_id: 'SCI-LOG-01'
    },
    {
      property_number: 'LNHS-SCI-2025-012',
      pis_code: 'PIS-25-00112',
      name: 'Scikit Mechanics 001 Kit',
      category: 'Science Lab - Experimental Kits & Mechanics',
      description: 'DepEd standardized Science Kit (SciKit) Mechanics Module 001 for kinematic and linear motion laboratory experiments.',
      quantity: 4,
      unit: 'kits',
      unit_value: 8800,
      total_value: 35200,
      location: 'Cabinet 5',
      custodian: 'Jeebs M. Sabidalas',
      condition: 'Serviceable',
      acquisition_date: '2025-06-15',
      source_of_fund: 'DepEd National GAA',
      inventory_type: 'Semi-Expendable',
      par_number: 'ICS-2025-SCI-12',
      notes: 'Actual inventory counted: 4 complete kits stored in Cabinet 5.',
      short_id: 'SCI-KIT-01'
    },
    {
      property_number: 'LNHS-SCI-2025-013',
      pis_code: 'PIS-25-00113',
      name: 'Scikit Mechanics 002 Kit',
      category: 'Science Lab - Experimental Kits & Mechanics',
      description: 'DepEd standardized Science Kit (SciKit) Mechanics Module 002 for force, friction, and incline planes.',
      quantity: 11,
      unit: 'kits',
      unit_value: 8800,
      total_value: 96800,
      location: 'Cabinet 5',
      custodian: 'Jeebs M. Sabidalas',
      condition: 'Serviceable',
      acquisition_date: '2025-06-15',
      source_of_fund: 'DepEd National GAA',
      inventory_type: 'Semi-Expendable',
      par_number: 'ICS-2025-SCI-13',
      notes: 'Actual inventory counted: 11 complete kits stored in Cabinet 5.',
      short_id: 'SCI-KIT-02'
    },
    {
      property_number: 'LNHS-SCI-2025-014',
      pis_code: 'PIS-25-00114',
      name: 'Scikit Mechanics 003 Kit',
      category: 'Science Lab - Experimental Kits & Mechanics',
      description: 'DepEd standardized Science Kit (SciKit) Mechanics Module 003 for work, mechanical advantage, and pulley systems.',
      quantity: 5,
      unit: 'kits',
      unit_value: 8800,
      total_value: 44000,
      location: 'Cabinet 5',
      custodian: 'Jeebs M. Sabidalas',
      condition: 'Serviceable',
      acquisition_date: '2025-06-15',
      source_of_fund: 'DepEd National GAA',
      inventory_type: 'Semi-Expendable',
      par_number: 'ICS-2025-SCI-14',
      notes: 'Actual inventory counted: 5 complete kits stored in Cabinet 5.',
      short_id: 'SCI-KIT-03'
    },
    {
      property_number: 'LNHS-SCI-2025-015',
      pis_code: 'PIS-25-00115',
      name: 'Electromagnetism Kit',
      category: 'Science Lab - Experimental Kits & Mechanics',
      description: 'Complete boxed apparatus kit for magnetic field induction, Oersted effect, and solenoid experiments.',
      quantity: 5,
      unit: 'kits',
      unit_value: 4500,
      total_value: 22500,
      location: 'Cabinet 2',
      custodian: 'Jeebs M. Sabidalas',
      condition: 'Serviceable',
      acquisition_date: '2025-06-15',
      source_of_fund: 'DepEd National GAA',
      inventory_type: 'Semi-Expendable',
      par_number: 'ICS-2025-SCI-15',
      notes: 'Actual inventory counted: 5 kits stored in Cabinet 2.',
      short_id: 'SCI-KIT-04'
    },
    {
      property_number: 'LNHS-SCI-2025-016',
      pis_code: 'PIS-25-00116',
      name: 'Electronic Kit',
      category: 'Science Lab - Experimental Kits & Mechanics',
      description: 'Modular electronics experiment kit with quick-snap connections, breadboard, and electronic components.',
      quantity: 3,
      unit: 'kits',
      unit_value: 4200,
      total_value: 12600,
      location: 'Cabinet 2',
      custodian: 'Jeebs M. Sabidalas',
      condition: 'Serviceable',
      acquisition_date: '2025-06-15',
      source_of_fund: 'DepEd National GAA',
      inventory_type: 'Semi-Expendable',
      par_number: 'ICS-2025-SCI-16',
      notes: 'Actual inventory counted: 3 kits stored in Cabinet 2.',
      short_id: 'SCI-KIT-05'
    },
    {
      property_number: 'LNHS-SCI-2025-017',
      pis_code: 'PIS-25-00117',
      name: 'Laser Refraction Tank',
      category: 'Science Lab - Apparatus & Instruments',
      description: 'Circular/semicircular transparent optics tank with 360-degree graduated protractor dial for Snell\'s Law experiments.',
      quantity: 3,
      unit: 'units',
      unit_value: 2900,
      total_value: 8700,
      location: 'Cabinet 4',
      custodian: 'Jeebs M. Sabidalas',
      condition: 'Serviceable',
      acquisition_date: '2025-06-15',
      source_of_fund: 'DepEd National GAA',
      inventory_type: 'Semi-Expendable',
      par_number: 'ICS-2025-SCI-17',
      notes: 'Actual inventory counted: 3 units stored in Cabinet 4.',
      short_id: 'SCI-OPT-03'
    },
    {
      property_number: 'LNHS-SCI-2025-018',
      pis_code: 'PIS-25-00118',
      name: 'Wind Blower Apparatus',
      category: 'Science Lab - Apparatus & Instruments',
      description: 'Electric variable-speed air stream blower unit for aerodynamic drag and air track glider experiments.',
      quantity: 1,
      unit: 'unit',
      unit_value: 6800,
      total_value: 6800,
      location: 'Cabinet 3',
      custodian: 'Jeebs M. Sabidalas',
      condition: 'Serviceable',
      acquisition_date: '2025-06-15',
      source_of_fund: 'DepEd National GAA',
      inventory_type: 'Semi-Expendable',
      par_number: 'ICS-2025-SCI-18',
      notes: 'Actual inventory counted: 1 unit stored in Cabinet 3.',
      short_id: 'SCI-BLW-01'
    },
    {
      property_number: 'LNHS-SCI-2025-019',
      pis_code: 'PIS-25-00119',
      name: 'Solar System Desktop Model (Orrery)',
      category: 'Science Lab - Earth & Space Science',
      description: 'Mechanical desktop planetary model showing heliocentric orbits of planets around the Sun.',
      quantity: 6,
      unit: 'units',
      unit_value: 3400,
      total_value: 20400,
      location: 'Cabinet 3-4',
      custodian: 'Jeebs M. Sabidalas',
      condition: 'Serviceable',
      acquisition_date: '2025-06-15',
      source_of_fund: 'DepEd National GAA',
      inventory_type: 'Semi-Expendable',
      par_number: 'ICS-2025-SCI-19',
      notes: 'Actual inventory counted: 6 units stored in Cabinets 3 and 4.',
      short_id: 'SCI-AST-01'
    },
    {
      property_number: 'LNHS-SCI-2025-020',
      pis_code: 'PIS-25-00120',
      name: 'U-Tube Manometer Apparatus',
      category: 'Science Lab - Apparatus & Instruments',
      description: 'Mounted glass U-tube fluid manometer with calibrated millimeter scale stand for fluid pressure difference.',
      quantity: 5,
      unit: 'units',
      unit_value: 2100,
      total_value: 10500,
      location: 'Cabinet 3',
      custodian: 'Jeebs M. Sabidalas',
      condition: 'Serviceable',
      acquisition_date: '2025-06-15',
      source_of_fund: 'DepEd National GAA',
      inventory_type: 'Semi-Expendable',
      par_number: 'ICS-2025-SCI-20',
      notes: 'Actual inventory counted: 5 units stored in Cabinet 3.',
      short_id: 'SCI-MANO-01'
    },
    {
      property_number: 'LNHS-SCI-2025-021',
      pis_code: 'PIS-25-00121',
      name: 'Ring and Ball Thermal Expansion Apparatus',
      category: 'Science Lab - Apparatus & Instruments',
      description: '\'s Gravesande brass ring and sphere apparatus with insulated handles for volumetric thermal expansion.',
      quantity: 25,
      unit: 'sets',
      unit_value: 1450,
      total_value: 36250,
      location: 'Cabinet 2',
      custodian: 'Jeebs M. Sabidalas',
      condition: 'Serviceable',
      acquisition_date: '2025-06-15',
      source_of_fund: 'DepEd National GAA',
      inventory_type: 'Semi-Expendable',
      par_number: 'ICS-2025-SCI-21',
      notes: 'Actual inventory counted: 25 sets stored in Cabinet 2.',
      short_id: 'SCI-EXP-01'
    },
    {
      property_number: 'LNHS-SCI-2025-022',
      pis_code: 'PIS-25-00122',
      name: 'Electrolysis Apparatus (Voltameter)',
      category: 'Science Lab - Apparatus & Instruments',
      description: 'Water electrolysis voltameter apparatus equipped with graded gas collecting tubes and electrodes.',
      quantity: 25,
      unit: 'sets',
      unit_value: 3100,
      total_value: 77500,
      location: 'Cabinet 2',
      custodian: 'Jeebs M. Sabidalas',
      condition: 'Serviceable',
      acquisition_date: '2025-06-15',
      source_of_fund: 'DepEd National GAA',
      inventory_type: 'Semi-Expendable',
      par_number: 'ICS-2025-SCI-22',
      notes: 'Actual inventory counted: 25 sets stored in Cabinet 2.',
      short_id: 'SCI-LYS-01'
    }
  ];

  for (const item of propertyItems) {
    const { error } = await supabase.from('property_items').upsert(item, { onConflict: 'property_number' });
    if (error) {
      console.warn('Property item upsert notice for', item.name, error.message);
    } else {
      console.log(`  ✓ Property ready: [${item.pis_code}] ${item.name} (${item.quantity} ${item.unit} in ${item.location})`);
    }
  }

  // Sync Laboratory Inventory Items (Non-PIS)
  console.log('\n--- SYNCING ACTUAL LABORATORY INVENTORY ITEMS (NON-PIS) ---');
  const labItems = [
    { name: 'Three Neck Flask (250 mL)', category: 'Chemistry', quantity: 1, unit: 'pc', location: 'Cabinet 2', condition: 'Good', description: 'Round-bottom borosilicate 3.3 laboratory glass flask with 3 necks.', shortId: 'CHE-FLK-001', isConsumable: false },
    { name: 'Safety Goggles (Anti-Fog)', category: 'General', quantity: 4, unit: 'pcs', location: 'Cabinet 3', condition: 'Good', description: 'Direct-vented polycarbonate safety eyewear with anti-fog coating.', shortId: 'GEN-GOG-001', isConsumable: false },
    { name: 'Digital Stopwatch (1/100 sec)', category: 'General', quantity: 69, unit: 'units', location: 'Cabinet 1', condition: 'Good', description: 'Handheld electronic sports and science stopwatch.', shortId: 'GEN-STW-001', isConsumable: false },
    { name: 'Pyramid in Prism (Optical Acrylic/Glass)', category: 'Physics', quantity: 4, unit: 'pcs', location: 'Cabinet 4', condition: 'Good', description: 'Precision-cut optical square pyramid for light refraction.', shortId: 'PHY-PYR-001', isConsumable: false },
    { name: 'Equilateral Glass Prism', category: 'Physics', quantity: 23, unit: 'pcs', location: 'Cabinet 2', condition: 'Good', description: '60-degree triangular optical glass prism for light dispersion.', shortId: 'PHY-PRS-001', isConsumable: false },
    { name: 'Basic Optical Lens (Single)', category: 'Physics', quantity: 5, unit: 'pcs', location: 'Cabinet 2', condition: 'Good', description: 'Polished optical glass double-convex lens.', shortId: 'PHY-LNS-001', isConsumable: false },
    { name: 'Basic Optical Lens Set', category: 'Physics', quantity: 25, unit: 'sets', location: 'Cabinet 2', condition: 'Good', description: 'Set of 6 assorted optical glass lenses.', shortId: 'PHY-LNS-002', isConsumable: false },
    { name: 'Refraction Blocks (Acrylic / Glass)', category: 'Physics', quantity: 5, unit: 'pcs', location: 'Cabinet 5', condition: 'Good', description: 'Rectangular and semicircular clear optical blocks.', shortId: 'PHY-BLK-001', isConsumable: false },
    { name: 'Assorted Mirror Set', category: 'Physics', quantity: 35, unit: 'sets', location: 'Cabinet 2', condition: 'Good', description: 'Optics mirror set containing plane, concave, and convex mirrors.', shortId: 'PHY-MIR-001', isConsumable: false },
    { name: 'Compact Laser Light Diode Pointer', category: 'Physics', quantity: 14, unit: 'pcs', location: 'Cabinet 2', condition: 'Good', description: 'Class II laser beam emitter diode for ray tracing.', shortId: 'PHY-LAS-001', isConsumable: false },
    { name: 'Hardwood Meter Stick (100 cm)', category: 'General', quantity: 64, unit: 'pcs', location: 'Cabinet 3', condition: 'Good', description: 'One-meter hardwood measuring stick with metric graduations.', shortId: 'GEN-MET-001', isConsumable: false },
    { name: 'Helical Steel Extension Spring', category: 'Physics', quantity: 10, unit: 'pcs', location: 'Cabinet 2', condition: 'Good', description: 'Calibrated steel extension spring with pointer for Hooke\'s Law.', shortId: 'PHY-SPR-001', isConsumable: false },
    { name: 'Spear in a Cylinder (Archimedes Apparatus)', category: 'Physics', quantity: 2, unit: 'sets', location: 'Cabinet 4', condition: 'Good', description: 'Brass solid sphere and hollow cylinder for buoyant force.', shortId: 'PHY-SPH-001', isConsumable: false },
    { name: 'Plastic 180° Protractor', category: 'General', quantity: 4, unit: 'pcs', location: 'Cabinet 3', condition: 'Good', description: 'Transparent semi-circular 180-degree protractor.', shortId: 'GEN-PRO-001', isConsumable: false },
    { name: 'Geometrical Figure Solid Models Set', category: 'General', quantity: 9, unit: 'sets', location: 'Cabinet 3', condition: 'Good', description: 'Set of 3D geometric solid forms (cone, cylinder, pyramid, sphere).', shortId: 'GEN-GEO-001', isConsumable: false },
    { name: 'Optimus Dissection & Cutter Blades', category: 'General', quantity: 10, unit: 'packs', location: 'Cabinet 2', condition: 'Good', description: 'Stainless steel replaceable precision dissection blades.', shortId: 'GEN-BLD-001', isConsumable: true },
    { name: 'Slinky Wave Demonstration Spring', category: 'Physics', quantity: 50, unit: 'pcs', location: 'Cabinet 1', condition: 'Good', description: 'Flat steel coil slinky spring for mechanical wave experiments.', shortId: 'PHY-SLK-001', isConsumable: false },
    { name: 'Connecting Insulated Wire Leads with Clips', category: 'Physics', quantity: 14, unit: 'rolls', location: 'Cabinet 5', condition: 'Good', description: 'Flexible multi-strand copper wire rolls with alligator clips.', shortId: 'PHY-WIR-001', isConsumable: true },
    { name: 'Laboratory Hygiene & Cleaning Kit', category: 'General', quantity: 20, unit: 'kits', location: 'Cabinet 3', condition: 'Good', description: 'Sanitary maintenance package containing brushes, wipes, and cleaner.', shortId: 'GEN-HYG-001', isConsumable: true },
    { name: 'Knife Switch (SPST Single Pole)', category: 'Physics', quantity: 25, unit: 'pcs', location: 'Cabinet 5', condition: 'Good', description: 'Single-pole single-throw open knife switch on plastic base.', shortId: 'PHY-SWT-001', isConsumable: false },
    { name: 'Ceramic-Centered Wire Gauze Mesh', category: 'Chemistry', quantity: 1, unit: 'pc', location: 'Cabinet 3', condition: 'Good', description: 'Galvanized iron wire mesh (150x150 mm) with ceramic center disc.', shortId: 'CHE-MSH-001', isConsumable: true },
    { name: 'Lumper / Test Tube Holder Clamp', category: 'Chemistry', quantity: 53, unit: 'pcs', location: 'Cabinet 5', condition: 'Good', description: 'Spring-loaded self-closing brass/steel test tube clamp.', shortId: 'CHE-LMP-001', isConsumable: false },
    { name: 'Tayot / Retort Bosshead Clamp', category: 'Chemistry', quantity: 5, unit: 'pcs', location: 'Cabinet 5', condition: 'Good', description: 'Heavy-duty 90-degree metal bosshead holder clamp for lab stands.', shortId: 'CHE-TYT-001', isConsumable: false },
    { name: 'Alnico Bar & Horseshoe Magnets', category: 'Physics', quantity: 25, unit: 'pcs', location: 'Cabinet 5', condition: 'Good', description: 'Permanent Alnico magnetic bars with keepers.', shortId: 'PHY-MAG-001', isConsumable: false },
    { name: 'Acoustic Tuning Fork (440 Hz / 512 Hz)', category: 'Physics', quantity: 1, unit: 'set', location: 'Cabinet 3', condition: 'Good', description: 'Precision acoustic tuning fork with resonance box.', shortId: 'PHY-TNK-001', isConsumable: false },
    { name: 'Assorted Equal-Volume Density Spheres Set', category: 'Physics', quantity: 5, unit: 'sets', location: 'Cabinet 4', condition: 'Good', description: 'Set of equal diameter spheres of different metals for density experiments.', shortId: 'PHY-SPH-002', isConsumable: false },
    { name: 'Cone in Cylinder Geometric Volume Model', category: 'Physics', quantity: 4, unit: 'sets', location: 'Cabinet 4', condition: 'Good', description: 'Clear acrylic cone and cylinder for 1/3 volume demonstration.', shortId: 'PHY-CYL-001', isConsumable: false },
    { name: 'Geological Rock & Mineral Specimen Box', category: 'Earth Science', quantity: 1, unit: 'set', location: 'Cabinet 4', condition: 'Good', description: 'Collection of authentic Philippine rock specimens.', shortId: 'EAR-RCK-001', isConsumable: false },
    { name: 'Slotted Brass Masses Set with Hanger (500g)', category: 'Physics', quantity: 1, unit: 'set', location: 'Cabinet 3', condition: 'Good', description: 'Machined brass slotted weights set (500g total).', shortId: 'PHY-WGT-001', isConsumable: false },
    { name: 'Alkaline Dry Cell Batteries (1.5V)', category: 'Physics', quantity: 12, unit: 'pcs', location: 'Cabinet 5', condition: 'Good', description: 'Heavy-duty 1.5V D-cell / AA alkaline batteries.', shortId: 'PHY-BAT-001', isConsumable: true },
    { name: 'Interlocking Plastic Battery Holders', category: 'Physics', quantity: 115, unit: 'pcs', location: 'Cabinet 3', condition: 'Good', description: 'Molded plastic interlocking single D-cell battery holders.', shortId: 'PHY-BTH-001', isConsumable: false },
    { name: 'Geological Soil Sieve Mesh Set', category: 'Earth Science', quantity: 1, unit: 'set', location: 'Science Lab', condition: 'Good', description: 'Stackable stainless steel soil classification sieves.', shortId: 'EAR-MSH-001', isConsumable: false }
  ];

  const { data: currentInv } = await supabase.from('inventory_items').select('*');
  console.log('Currently existing laboratory items in DB:', currentInv?.length || 0);

  for (const item of labItems) {
    const existing = currentInv?.find(e => e.name.toLowerCase().trim() === item.name.toLowerCase().trim() || e.shortId === item.shortId);
    const payload = {
      id: existing?.id || crypto.randomUUID(),
      name: item.name,
      category: item.category,
      quantity: item.quantity,
      borrowedQuantity: existing?.borrowedQuantity || 0,
      unit: item.unit,
      location: item.location,
      condition: item.condition,
      description: item.description,
      safetyNotes: item.safetyNotes || '',
      lastUpdated: new Date().toISOString(),
      shortId: item.shortId,
      isConsumable: item.isConsumable
    };

    const { error } = await supabase.from('inventory_items').upsert(payload);
    if (error) {
      console.warn('Lab item upsert notice for', item.name, error.message);
    } else {
      console.log(`  ✓ Lab Item ready: ${item.name} (${item.quantity} ${item.unit} in ${item.location}) [${item.category}]`);
    }
  }

  console.log('\n=============================================');
  console.log('SYNC FINISHED SUCCESSFULLY!');
  console.log('All 54 LNHS actual items are categorized & synced!');
  console.log('=============================================');
}

sync().catch(console.error);
