// =========================================================================
// MEDIPISO v2.0 — CATÁLOGO MICROBIOLÓGICO (200 PATÓGENOS) Y DATOS BASE
// =========================================================================

const HOSPITAL_PATHOGENS_DB = [
  // --- ENTEROBACTERALES GRAM NEGATIVOS Y FENOTIPOS MDR (1 - 55) ---
  { name: "Klebsiella pneumoniae KPC (Carbapenemasa)", category: "Bacteria", suggestedIsolation: "contacto" },
  { name: "Klebsiella pneumoniae BLEE", category: "Bacteria", suggestedIsolation: "contacto" },
  { name: "Klebsiella pneumoniae NDM (Metalo-beta-lactamasa)", category: "Bacteria", suggestedIsolation: "contacto" },
  { name: "Klebsiella pneumoniae OXA-48", category: "Bacteria", suggestedIsolation: "contacto" },
  { name: "Klebsiella pneumoniae VIM", category: "Bacteria", suggestedIsolation: "contacto" },
  { name: "Klebsiella pneumoniae Multisensible", category: "Bacteria", suggestedIsolation: "none" },
  { name: "Klebsiella oxytoca BLEE", category: "Bacteria", suggestedIsolation: "contacto" },
  { name: "Klebsiella oxytoca", category: "Bacteria", suggestedIsolation: "none" },
  { name: "Klebsiella aerogenes (Enterobacter aerogenes) AmpC", category: "Bacteria", suggestedIsolation: "contacto" },
  { name: "Klebsiella variicola", category: "Bacteria", suggestedIsolation: "none" },
  { name: "Escherichia coli BLEE", category: "Bacteria", suggestedIsolation: "contacto" },
  { name: "Escherichia coli Productora de Carbapenemasa (EPC)", category: "Bacteria", suggestedIsolation: "contacto" },
  { name: "Escherichia coli Uropatógena (UPEC)", category: "Bacteria", suggestedIsolation: "none" },
  { name: "Escherichia coli Enterohemorrágica (EHEC O157:H7)", category: "Bacteria", suggestedIsolation: "contacto" },
  { name: "Escherichia coli Enterotoxigénica (ETEC)", category: "Bacteria", suggestedIsolation: "contacto" },
  { name: "Escherichia coli Enteropatogénica (EPEC)", category: "Bacteria", suggestedIsolation: "contacto" },
  { name: "Enterobacter cloacae complex AmpC", category: "Bacteria", suggestedIsolation: "contacto" },
  { name: "Enterobacter cloacae Productor de Carbapenemasa", category: "Bacteria", suggestedIsolation: "contacto" },
  { name: "Enterobacter hormaechei", category: "Bacteria", suggestedIsolation: "contacto" },
  { name: "Enterobacter asburiae", category: "Bacteria", suggestedIsolation: "none" },
  { name: "Serratia marcescens MDR", category: "Bacteria", suggestedIsolation: "contacto" },
  { name: "Serratia marcescens", category: "Bacteria", suggestedIsolation: "none" },
  { name: "Serratia liquefaciens", category: "Bacteria", suggestedIsolation: "none" },
  { name: "Citrobacter freundii AmpC", category: "Bacteria", suggestedIsolation: "contacto" },
  { name: "Citrobacter koseri", category: "Bacteria", suggestedIsolation: "none" },
  { name: "Citrobacter braakii", category: "Bacteria", suggestedIsolation: "none" },
  { name: "Proteus mirabilis BLEE", category: "Bacteria", suggestedIsolation: "contacto" },
  { name: "Proteus mirabilis", category: "Bacteria", suggestedIsolation: "none" },
  { name: "Proteus vulgaris", category: "Bacteria", suggestedIsolation: "none" },
  { name: "Proteus penneri", category: "Bacteria", suggestedIsolation: "none" },
  { name: "Morganella morganii AmpC", category: "Bacteria", suggestedIsolation: "contacto" },
  { name: "Morganella morganii", category: "Bacteria", suggestedIsolation: "none" },
  { name: "Providencia stuartii MDR", category: "Bacteria", suggestedIsolation: "contacto" },
  { name: "Providencia rettgeri", category: "Bacteria", suggestedIsolation: "none" },
  { name: "Providencia alcalifaciens", category: "Bacteria", suggestedIsolation: "none" },
  { name: "Pantoea agglomerans", category: "Bacteria", suggestedIsolation: "none" },
  { name: "Hafnia alvei", category: "Bacteria", suggestedIsolation: "none" },
  { name: "Raoultella ornithinolytica", category: "Bacteria", suggestedIsolation: "none" },
  { name: "Raoultella planticola", category: "Bacteria", suggestedIsolation: "none" },
  { name: "Cronobacter sakazakii", category: "Bacteria", suggestedIsolation: "contacto" },
  { name: "Kluyvera ascorbata", category: "Bacteria", suggestedIsolation: "none" },
  { name: "Edwardsiella tarda", category: "Bacteria", suggestedIsolation: "none" },
  { name: "Salmonella enterica serovar Enteritidis", category: "Bacteria", suggestedIsolation: "contacto" },
  { name: "Salmonella enterica serovar Typhimurium", category: "Bacteria", suggestedIsolation: "contacto" },
  { name: "Salmonella Typhi", category: "Bacteria", suggestedIsolation: "contacto" },
  { name: "Salmonella Paratyphi", category: "Bacteria", suggestedIsolation: "contacto" },
  { name: "Shigella sonnei", category: "Bacteria", suggestedIsolation: "contacto" },
  { name: "Shigella flexneri", category: "Bacteria", suggestedIsolation: "contacto" },
  { name: "Shigella dysenteriae", category: "Bacteria", suggestedIsolation: "contacto" },
  { name: "Yersinia enterocolitica", category: "Bacteria", suggestedIsolation: "contacto" },
  { name: "Yersinia pseudotuberculosis", category: "Bacteria", suggestedIsolation: "none" },
  { name: "Campylobacter jejuni", category: "Bacteria", suggestedIsolation: "contacto" },
  { name: "Campylobacter coli", category: "Bacteria", suggestedIsolation: "contacto" },
  { name: "Campylobacter fetus", category: "Bacteria", suggestedIsolation: "none" },
  { name: "Helicobacter pylori", category: "Bacteria", suggestedIsolation: "none" },

  // --- BACILOS GRAM NEGATIVOS NO FERMENTADORES (56 - 80) ---
  { name: "Pseudomonas aeruginosa MDR / XDR", category: "Bacteria", suggestedIsolation: "contacto" },
  { name: "Pseudomonas aeruginosa Resistente a Carbapenémicos (CRPA)", category: "Bacteria", suggestedIsolation: "contacto" },
  { name: "Pseudomonas aeruginosa Productora de VIM / IMP", category: "Bacteria", suggestedIsolation: "contacto" },
  { name: "Pseudomonas aeruginosa Multisensible", category: "Bacteria", suggestedIsolation: "none" },
  { name: "Pseudomonas putida", category: "Bacteria", suggestedIsolation: "none" },
  { name: "Pseudomonas fluorescens", category: "Bacteria", suggestedIsolation: "none" },
  { name: "Pseudomonas stutzeri", category: "Bacteria", suggestedIsolation: "none" },
  { name: "Acinetobacter baumannii Complejo Resistente a Carbapenémicos (CRAB)", category: "Bacteria", suggestedIsolation: "contacto" },
  { name: "Acinetobacter baumannii XDR / Panresistente", category: "Bacteria", suggestedIsolation: "contacto" },
  { name: "Acinetobacter pittii", category: "Bacteria", suggestedIsolation: "contacto" },
  { name: "Acinetobacter lwoffii", category: "Bacteria", suggestedIsolation: "none" },
  { name: "Stenotrophomonas maltophilia", category: "Bacteria", suggestedIsolation: "contacto" },
  { name: "Burkholderia cepacia complex", category: "Bacteria", suggestedIsolation: "contacto" },
  { name: "Burkholderia gladioli", category: "Bacteria", suggestedIsolation: "contacto" },
  { name: "Burkholderia pseudomallei", category: "Bacteria", suggestedIsolation: "contacto" },
  { name: "Achromobacter xylosoxidans", category: "Bacteria", suggestedIsolation: "contacto" },
  { name: "Alcaligenes faecalis", category: "Bacteria", suggestedIsolation: "none" },
  { name: "Elizabethkingia meningoseptica", category: "Bacteria", suggestedIsolation: "contacto" },
  { name: "Chryseobacterium indologenes", category: "Bacteria", suggestedIsolation: "contacto" },
  { name: "Ralstonia pickettii", category: "Bacteria", suggestedIsolation: "none" },
  { name: "Sphingomonas paucimobilis", category: "Bacteria", suggestedIsolation: "none" },
  { name: "Brevundimonas vesicularis", category: "Bacteria", suggestedIsolation: "none" },
  { name: "Ochrobactrum anthropi", category: "Bacteria", suggestedIsolation: "none" },
  { name: "Aeromonas hydrophila", category: "Bacteria", suggestedIsolation: "contacto" },
  { name: "Vibrio cholerae / Vibrio parahaemolyticus", category: "Bacteria", suggestedIsolation: "contacto" },

  // --- COCOS Y BACILOS GRAM POSITIVOS (81 - 120) ---
  { name: "Staphylococcus aureus Meticilino Resistente (SAMR / MRSA)", category: "Bacteria", suggestedIsolation: "contacto" },
  { name: "Staphylococcus aureus Meticilino Sensible (SAMS / MSSA)", category: "Bacteria", suggestedIsolation: "none" },
  { name: "Staphylococcus aureus con sensibilidad intermedia a Vancomicina (VISA)", category: "Bacteria", suggestedIsolation: "contacto" },
  { name: "Staphylococcus epidermidis Resistente a Meticilina", category: "Bacteria", suggestedIsolation: "none" },
  { name: "Staphylococcus haemolyticus", category: "Bacteria", suggestedIsolation: "none" },
  { name: "Staphylococcus hominis", category: "Bacteria", suggestedIsolation: "none" },
  { name: "Staphylococcus lugdunensis", category: "Bacteria", suggestedIsolation: "none" },
  { name: "Staphylococcus saprophyticus", category: "Bacteria", suggestedIsolation: "none" },
  { name: "Staphylococcus capitis", category: "Bacteria", suggestedIsolation: "none" },
  { name: "Enterococcus faecium Resistente a Vancomicina (ERV / VRE)", category: "Bacteria", suggestedIsolation: "contacto" },
  { name: "Enterococcus faecalis Resistente a Vancomicina (ERV)", category: "Bacteria", suggestedIsolation: "contacto" },
  { name: "Enterococcus faecalis Sensible a Ampicilina", category: "Bacteria", suggestedIsolation: "none" },
  { name: "Enterococcus faecium Sensible a Vancomicina", category: "Bacteria", suggestedIsolation: "none" },
  { name: "Enterococcus gallinarum", category: "Bacteria", suggestedIsolation: "none" },
  { name: "Enterococcus casseliflavus", category: "Bacteria", suggestedIsolation: "none" },
  { name: "Enterococcus avium", category: "Bacteria", suggestedIsolation: "none" },
  { name: "Streptococcus pneumoniae (Neumococo)", category: "Bacteria", suggestedIsolation: "none" },
  { name: "Streptococcus pneumoniae Resistente a Penicilina", category: "Bacteria", suggestedIsolation: "contacto" },
  { name: "Streptococcus pyogenes (Grupo A - Invasor / Fascitis / Escarlatina)", category: "Bacteria", suggestedIsolation: "contacto_gotitas" },
  { name: "Streptococcus agalactiae (Grupo B)", category: "Bacteria", suggestedIsolation: "none" },
  { name: "Streptococcus dysgalactiae (Grupo C / G)", category: "Bacteria", suggestedIsolation: "none" },
  { name: "Streptococcus anginosus (Grupo Milleri)", category: "Bacteria", suggestedIsolation: "none" },
  { name: "Streptococcus intermedius", category: "Bacteria", suggestedIsolation: "none" },
  { name: "Streptococcus constellatus", category: "Bacteria", suggestedIsolation: "none" },
  { name: "Streptococcus mitis / oralis", category: "Bacteria", suggestedIsolation: "none" },
  { name: "Streptococcus sanguinis", category: "Bacteria", suggestedIsolation: "none" },
  { name: "Streptococcus mutans", category: "Bacteria", suggestedIsolation: "none" },
  { name: "Streptococcus gallolyticus (S. bovis)", category: "Bacteria", suggestedIsolation: "none" },
  { name: "Abiotrophia defectiva / Granulicatella", category: "Bacteria", suggestedIsolation: "none" },
  { name: "Gemella morbillorum", category: "Bacteria", suggestedIsolation: "none" },
  { name: "Leuconostoc mesenteroides", category: "Bacteria", suggestedIsolation: "none" },
  { name: "Pediococcus spp.", category: "Bacteria", suggestedIsolation: "none" },
  { name: "Listeria monocytogenes", category: "Bacteria", suggestedIsolation: "none" },
  { name: "Corynebacterium striatum MDR", category: "Bacteria", suggestedIsolation: "contacto" },
  { name: "Corynebacterium jeikeium", category: "Bacteria", suggestedIsolation: "contacto" },
  { name: "Corynebacterium urealyticum", category: "Bacteria", suggestedIsolation: "none" },
  { name: "Corynebacterium diphtheriae", category: "Bacteria", suggestedIsolation: "contacto_gotitas" },
  { name: "Bacillus cereus", category: "Bacteria", suggestedIsolation: "none" },
  { name: "Nocardia farcinica / Nocardia asteroides", category: "Bacteria", suggestedIsolation: "none" },
  { name: "Rhodococcus equi", category: "Bacteria", suggestedIsolation: "none" },

  // --- ANAEROBIOS, MICOBACTERIAS Y RESPIRATORIOS (121 - 150) ---
  { name: "Clostridioides difficile (Clostridium difficile) Toxigénico", category: "Bacteria", suggestedIsolation: "contacto" },
  { name: "Clostridium perfringens", category: "Bacteria", suggestedIsolation: "contacto" },
  { name: "Clostridium septicum", category: "Bacteria", suggestedIsolation: "none" },
  { name: "Clostridium tetani", category: "Bacteria", suggestedIsolation: "none" },
  { name: "Bacteroides fragilis", category: "Bacteria", suggestedIsolation: "none" },
  { name: "Bacteroides thetaiotaomicron", category: "Bacteria", suggestedIsolation: "none" },
  { name: "Prevotella melaninogenica", category: "Bacteria", suggestedIsolation: "none" },
  { name: "Fusobacterium necrophorum", category: "Bacteria", suggestedIsolation: "none" },
  { name: "Fusobacterium nucleatum", category: "Bacteria", suggestedIsolation: "none" },
  { name: "Peptostreptococcus anaerobius", category: "Bacteria", suggestedIsolation: "none" },
  { name: "Parvimonas micra", category: "Bacteria", suggestedIsolation: "none" },
  { name: "Finegoldia magna", category: "Bacteria", suggestedIsolation: "none" },
  { name: "Cutibacterium acnes (Propionibacterium acnes)", category: "Bacteria", suggestedIsolation: "none" },
  { name: "Actinomyces israelii", category: "Bacteria", suggestedIsolation: "none" },
  { name: "Mycobacterium tuberculosis (TBC Pulmonar Bacilífera)", category: "Bacteria", suggestedIsolation: "aereo" },
  { name: "Mycobacterium tuberculosis MDR / XDR", category: "Bacteria", suggestedIsolation: "contacto_aereo" },
  { name: "Mycobacterium avium complex (MAC)", category: "Bacteria", suggestedIsolation: "none" },
  { name: "Mycobacterium abscessus", category: "Bacteria", suggestedIsolation: "contacto" },
  { name: "Mycobacterium kansasii", category: "Bacteria", suggestedIsolation: "none" },
  { name: "Neisseria meningitidis (Meningococo)", category: "Bacteria", suggestedIsolation: "gotitas" },
  { name: "Neisseria gonorrhoeae", category: "Bacteria", suggestedIsolation: "none" },
  { name: "Haemophilus influenzae tipo b / no tipificable", category: "Bacteria", suggestedIsolation: "gotitas" },
  { name: "Moraxella catarrhalis", category: "Bacteria", suggestedIsolation: "none" },
  { name: "Bordetella pertussis (Coqueluche)", category: "Bacteria", suggestedIsolation: "gotitas" },
  { name: "Legionella pneumophila", category: "Bacteria", suggestedIsolation: "none" },
  { name: "Mycoplasma pneumoniae", category: "Bacteria", suggestedIsolation: "gotitas" },
  { name: "Chlamydophila pneumoniae", category: "Bacteria", suggestedIsolation: "none" },
  { name: "Pasteurella multocida", category: "Bacteria", suggestedIsolation: "none" },
  { name: "Brucella melitensis / Treponema pallidum / Leptospira", category: "Bacteria", suggestedIsolation: "none" },
  { name: "Grupo HACEK (Haemophilus, Aggregatibacter, Cardiobacterium, Eikenella, Kingella)", category: "Bacteria", suggestedIsolation: "none" },

  // --- 50 VIRUS Y HONGOS HOSPITALARIOS (151 - 200) ---
  { name: "SARS-CoV-2 (COVID-19)", category: "Virus", suggestedIsolation: "contacto_gotitas" },
  { name: "Virus Influenza A (H1N1 / H3N2)", category: "Virus", suggestedIsolation: "gotitas" },
  { name: "Virus Influenza B", category: "Virus", suggestedIsolation: "gotitas" },
  { name: "Virus Respiratorio Sincicial (VRS)", category: "Virus", suggestedIsolation: "contacto_gotitas" },
  { name: "Adenovirus Respiratorio / Entérico", category: "Virus", suggestedIsolation: "contacto_gotitas" },
  { name: "Metapneumovirus Humano (hMPV)", category: "Virus", suggestedIsolation: "contacto_gotitas" },
  { name: "Virus Parainfluenza 1", category: "Virus", suggestedIsolation: "contacto_gotitas" },
  { name: "Virus Parainfluenza 2", category: "Virus", suggestedIsolation: "contacto_gotitas" },
  { name: "Virus Parainfluenza 3", category: "Virus", suggestedIsolation: "contacto_gotitas" },
  { name: "Virus Parainfluenza 4", category: "Virus", suggestedIsolation: "contacto_gotitas" },
  { name: "Rinovirus / Enterovirus Respiratorio", category: "Virus", suggestedIsolation: "gotitas" },
  { name: "Bocavirus Humano", category: "Virus", suggestedIsolation: "contacto_gotitas" },
  { name: "Coronavirus Estacional (OC43 / 229E / NL63)", category: "Virus", suggestedIsolation: "gotitas" },
  { name: "Rotavirus", category: "Virus", suggestedIsolation: "contacto" },
  { name: "Norovirus (Gastroenteritis Aguda)", category: "Virus", suggestedIsolation: "contacto" },
  { name: "Astrovirus", category: "Virus", suggestedIsolation: "contacto" },
  { name: "Sapovirus", category: "Virus", suggestedIsolation: "contacto" },
  { name: "Enterovirus (Meningitis Viral / Coxsackie)", category: "Virus", suggestedIsolation: "contacto" },
  { name: "Virus Varicela-Zóster (VVZ - Varicela o Zóster Diseminado)", category: "Virus", suggestedIsolation: "contacto_aereo" },
  { name: "Virus Sarampión (Rubeola morbillivirus)", category: "Virus", suggestedIsolation: "aereo" },
  { name: "Virus Rubéola", category: "Virus", suggestedIsolation: "gotitas" },
  { name: "Virus Parotiditis (Paperas)", category: "Virus", suggestedIsolation: "gotitas" },
  { name: "Citomegalovirus (CMV)", category: "Virus", suggestedIsolation: "none" },
  { name: "Virus Epstein-Barr (VEB)", category: "Virus", suggestedIsolation: "none" },
  { name: "Virus Herpes Simple Tipo 1 (VHS-1 Encefalitis / Mucocutáneo)", category: "Virus", suggestedIsolation: "contacto" },
  { name: "Virus Herpes Simple Tipo 2 (VHS-2)", category: "Virus", suggestedIsolation: "contacto" },
  { name: "Virus Herpes Humano 6 (VHH-6)", category: "Virus", suggestedIsolation: "none" },
  { name: "Virus Herpes Humano 8 (VHH-8 / Sarcoma de Kaposi)", category: "Virus", suggestedIsolation: "none" },
  { name: "Parvovirus B19 (Crisis Aplásica)", category: "Virus", suggestedIsolation: "gotitas" },
  { name: "Poliomavirus BK (Nefropatía en Trasplante)", category: "Virus", suggestedIsolation: "none" },
  { name: "Poliomavirus JC (LEMP)", category: "Virus", suggestedIsolation: "none" },
  { name: "Virus Hepatitis A (VHA)", category: "Virus", suggestedIsolation: "contacto" },
  { name: "Virus Hepatitis B (VHB)", category: "Virus", suggestedIsolation: "none" },
  { name: "Virus Hepatitis C (VHC)", category: "Virus", suggestedIsolation: "none" },
  { name: "Virus Hepatitis E (VHE)", category: "Virus", suggestedIsolation: "contacto" },
  { name: "Virus de la Inmunodeficiencia Humana (VIH-1 / VIH-2)", category: "Virus", suggestedIsolation: "none" },
  { name: "Virus Linfotrópico T Humano (HTLV-1)", category: "Virus", suggestedIsolation: "none" },
  { name: "Hantavirus (Virus Andes - Síndrome Cardiopulmonar)", category: "Virus", suggestedIsolation: "contacto_gotitas" },
  { name: "Virus Dengue", category: "Virus", suggestedIsolation: "none" },
  { name: "Mpox (Viruela Símica / Monkeypox)", category: "Virus", suggestedIsolation: "contacto_gotitas" },
  { name: "Candida auris (Multirresistente)", category: "Hongo", suggestedIsolation: "contacto" },
  { name: "Candida albicans", category: "Hongo", suggestedIsolation: "none" },
  { name: "Candida glabrata (Nakaseomyces glabratus)", category: "Hongo", suggestedIsolation: "none" },
  { name: "Candida parapsilosis", category: "Hongo", suggestedIsolation: "contacto" },
  { name: "Candida tropicalis", category: "Hongo", suggestedIsolation: "none" },
  { name: "Candida krusei (Pichia kudriavzevii)", category: "Hongo", suggestedIsolation: "none" },
  { name: "Aspergillus fumigatus / Aspergilosis Pulmonar Invasora", category: "Hongo", suggestedIsolation: "none" },
  { name: "Cryptococcus neoformans", category: "Hongo", suggestedIsolation: "none" },
  { name: "Pneumocystis jirovecii (PCP)", category: "Hongo", suggestedIsolation: "gotitas" },
  { name: "Mucorales (Rhizopus / Mucor - Mucormicosis)", category: "Hongo", suggestedIsolation: "none" }
];

const COMMON_ATB_LIST = [
  "Ceftriaxona", "Cefazolina", "Cefepime", "Ceftazidima", "Ceftazidima/Avibactam",
  "Piperacilina/Tazobactam", "Ampicilina/Sulbactam", "Amoxicilina/Ác. Clavulánico",
  "Cloxacilina", "Meropenem", "Imipenem", "Ertapenem", "Vancomicina", "Linezolid",
  "Daptomicina", "Metronidazol", "Clindamicina", "Amikacina", "Gentamicina",
  "Ciprofloxacino", "Levofloxacino", "Azitromicina", "Claritromicina",
  "Cotrimoxazol (TMP/SMX)", "Colistín", "Tigeciclina", "Fluconazol", "Voriconazol",
  "Caspofungina", "Anfotericina B Liposomal", "Aciclovir", "Ganciclovir", "Oseltamivir"
];

function createEmptyPatient() {
  return {
    name: "",
    rut: "",
    dob: "",
    age: "",
    recordNumber: "",
    phone: "",
    address: "",
    allergies: "",
    letStatus: "Full / Sin restricción",
    oxygenSupport: "Ambiental",
    admissionDate: new Date().toISOString().slice(0, 10),
    hospDays: 1,
    diagnoses: "",
    clinicalPlan: "",
    labsSummary: "",
    medications: "",
    isolationType: "none",
    pathogens: [],
    antibiotics: [],
    devices: [], // [{ id, name: 'VVP', days: 1 }]
    tasks: []    // [{ id, category, text, timing, daysRemaining, dueTime, completed, notified }]
  };
}

// Helper para crear un Servicio con salas y numeración continua (1 a N)
function buildServiceWithCorrelativeRooms(id, name, icon, color, startNumber, roomSizesArray) {
  let currentBedNum = startNumber || 1;
  const rooms = roomSizesArray.map((bedCount, idx) => {
    const rNum = idx + 1;
    const beds = [];
    for (let i = 0; i < bedCount; i++) {
      beds.push({
        id: `${id}-r${rNum}-b${currentBedNum}`,
        number: currentBedNum,
        code: `Cama ${currentBedNum}`,
        status: "free",
        patientServiceId: id, // Servicio dueño clínico del paciente
        isMyBed: false,
        seenToday: false,
        patient: createEmptyPatient()
      });
      currentBedNum++;
    }
    return {
      id: `${id}-room-${rNum}`,
      name: `Sala ${rNum}`,
      roomIsolation: "none",
      roomIsolationNote: "",
      beds
    };
  });

  return {
    id,
    name,
    icon: icon || "🏥",
    color: color || "teal",
    continuousNumbering: true,
    startBedNumber: startNumber || 1,
    rooms
  };
}

function generateDefaultHospitalState() {
  const today = new Date().toISOString().slice(0, 10);

  // 1. Servicio de Cirugía (Ejemplo correlativo: Sala 1 [1-6], Sala 2 [7-12], Sala 3 Aislamiento [13-14], Sala 4 [15-20])
  const srvCirugia = buildServiceWithCorrelativeRooms("srv-cirugia", "Cirugía", "🔪", "teal", 1, [6, 6, 2, 6]);
  srvCirugia.rooms[2].name = "Sala 3 (Aislamiento)";
  srvCirugia.rooms[2].roomIsolation = "cohorte_contacto";
  srvCirugia.rooms[2].roomIsolationNote = "Precaución de Contacto";

  // Poblar pacientes de ejemplo en Cirugía
  const cBed1 = srvCirugia.rooms[0].beds[0]; // Cama 1
  cBed1.status = "occupied";
  cBed1.isMyBed = true;
  cBed1.seenToday = false;
  cBed1.patient = {
    ...createEmptyPatient(),
    name: "Roberto Carlos Muñoz Tapia",
    rut: "9.412.883-4",
    dob: "1956-04-14",
    age: 70,
    recordNumber: "FC-448219",
    phone: "+56 9 9123 4567 (Esposa: Rosa)",
    address: "San Fernando",
    allergies: "Alergia a Penicilina (Rash)",
    letStatus: "Full / Sin restricción",
    oxygenSupport: "Naricera 2L",
    admissionDate: "2026-10-20",
    hospDays: 5,
    diagnoses: "1. Colecistitis aguda litiásica operada (Colelap difícil)\n2. HTA crónica / DM2",
    clinicalPlan: "Evolución favorable, afebril, drenaje tubular serohemático escaso (20cc). Evaluar retiro de drenaje mañana.",
    labsSummary: "GB 9.400 | PCR 42 (en descenso) | Crea 0.9 | Bilirrubina T 1.1",
    medications: "- Enoxaparina 40mg SC día\n- Omeprazol 20mg EV día\n- Metamizol 1g EV c/8h",
    isolationType: "none",
    pathogens: ["Escherichia coli Uropatógena (UPEC)"],
    antibiotics: [
      { id: "atb-1", name: "Ceftriaxona", dose: "2g c/24h EV", currentDay: 5, targetDays: 7 },
      { id: "atb-2", name: "Metronidazol", dose: "500mg c/8h EV", currentDay: 5, targetDays: 7 }
    ],
    devices: [
      { id: "dev-1", name: "VVP", days: 3 },
      { id: "dev-2", name: "Drenaje", days: 4 }
    ],
    tasks: [
      { id: "t-1", category: "Imágenes", text: "Revisar ecografía abdominal de control", timing: "today", daysRemaining: 0, dueTime: "11:30", completed: false, notified: false },
      { id: "t-2", category: "Procedimiento", text: "Retirar puntos / control en policlínico", timing: "in_days", daysRemaining: 5, dueTime: "", completed: false, notified: false }
    ]
  };

  // Paciente en Sala 2 (Cama 7 - correlativa)
  const cBed7 = srvCirugia.rooms[1].beds[0]; // Cama 7
  cBed7.status = "occupied";
  cBed7.isMyBed = true;
  cBed7.seenToday = true;
  cBed7.patient = {
    ...createEmptyPatient(),
    name: "Jorge Luis Valenzuela Pino",
    rut: "11.829.301-K",
    dob: "1964-08-22",
    age: 62,
    recordNumber: "FC-501923",
    phone: "+56 9 8442 1190 (Hijo: Matías)",
    address: "Av. Manso de Velasco 780, San Fernando",
    allergies: "No conocidas (RAM (-))",
    letStatus: "Full / Sin restricción",
    oxygenSupport: "Ambiental",
    admissionDate: "2026-10-22",
    hospDays: 3,
    diagnoses: "1. Obstrucción intestinal por bridas en manejo médico\n2. LRA prerrenal resuelta",
    clinicalPlan: "Con SNG a caída libre dando 150cc bilioso claro. Tránsito para gases (+). Probar régimen líquido hoy.",
    labsSummary: "Na 138 | K 4.1 | Crea 1.0 | PCR 18",
    medications: "- SF 0.9% 1500cc/24h\n- Enoxaparina 40mg SC\n- Ondansetrón 4mg EV SOS",
    isolationType: "none",
    pathogens: [],
    antibiotics: [],
    devices: [
      { id: "dev-3", name: "SNG", days: 3 },
      { id: "dev-4", name: "Foley (CUP)", days: 3 }
    ],
    tasks: [
      { id: "t-3", category: "Imágenes", text: "Pedir Rx abdomen simple si reaparece dolor", timing: "later", daysRemaining: 0, dueTime: "15:00", completed: false, notified: false }
    ]
  };

  // Paciente en Sala 3 Aislamiento (Cama 13 - correlativa)
  const cBed13 = srvCirugia.rooms[2].beds[0]; // Cama 13
  cBed13.status = "occupied";
  cBed13.isMyBed = true;
  cBed13.seenToday = false;
  cBed13.patient = {
    ...createEmptyPatient(),
    name: "Carmen Gloria Contreras Silva",
    rut: "7.882.410-5",
    dob: "1948-11-03",
    age: 77,
    recordNumber: "FC-319482",
    phone: "+56 9 6554 9981 (Sobrina: Andrea)",
    address: "Santa Cruz",
    allergies: "Sulfa",
    letStatus: "LET: No RCP / No IOT",
    oxygenSupport: "Naricera 1L",
    admissionDate: "2026-10-18",
    hospDays: 7,
    diagnoses: "1. Pie diabético infectado Wagner III post aseo quirúrgico\n2. Colonización/Infección por K. pneumoniae KPC\n3. ERC Etapa 4",
    clinicalPlan: "Herida operatoria limpia con tejido granulatorio. Vigilar función renal con antibiótico.",
    labsSummary: "Hb 9.8 | GB 11.200 | PCR 65 | Crea 2.3 | K 4.6",
    medications: "- Insulina NPH 14 UI AM / 6 UI PM\n- Atorvastatina 20mg VO\n- Losartán 50mg VO",
    isolationType: "contacto",
    pathogens: ["Klebsiella pneumoniae KPC (Carbapenemasa)"],
    antibiotics: [
      { id: "atb-4", name: "Ceftazidima/Avibactam", dose: "1.25g c/8h EV", currentDay: 7, targetDays: 7 }
    ],
    devices: [
      { id: "dev-5", name: "CVC", days: 6 }
    ],
    tasks: [
      { id: "t-5", category: "Laboratorio", text: "Rescatar cultivo de tejido profundo", timing: "today", daysRemaining: 0, dueTime: "12:00", completed: false, notified: false }
    ]
  };

  // 2. Servicio de Medicina Interna (Camas 1 a 16 en 4 salas de 4)
  const srvMedicina = buildServiceWithCorrelativeRooms("srv-medicina", "Medicina Interna", "🩺", "indigo", 1, [4, 4, 4, 4]);

  // 3. Servicio UTI (Camas 1 a 8 en 2 salas de 4)
  const srvUti = buildServiceWithCorrelativeRooms("srv-uti", "UTI", "⚡", "amber", 1, [4, 4]);

  // 4. Servicio UCI (Camas 1 a 6 en 1 sala de 6 boxes)
  const srvUci = buildServiceWithCorrelativeRooms("srv-uci", "UCI", "🚨", "rose", 1, [6]);
  srvUci.rooms[0].name = "Boxes UCI (1 al 6)";

  // 5. Servicio Traumatología (Camas 1 a 12 en 3 salas de 4)
  const srvTrauma = buildServiceWithCorrelativeRooms("srv-trauma", "Traumatología", "🦴", "cyan", 1, [4, 4, 4]);

  return {
    version: "2.0",
    hospitalName: "Hospital San Fernando",
    myServiceId: "srv-cirugia",
    activeTab: "floor",
    floorFilter: "all",
    tasksScope: "all",
    searchQuery: "",
    lastNewDayDate: "",
    navState: {
      level: "services", // 'services' | 'rooms' | 'beds'
      selectedServiceId: "srv-cirugia",
      selectedRoomId: "srv-cirugia-room-1",
      showAllRoomsBedsInService: false
    },
    services: [srvCirugia, srvMedicina, srvUti, srvUci, srvTrauma]
  };
}
