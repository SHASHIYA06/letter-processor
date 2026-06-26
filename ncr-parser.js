// ══════════════════════════════════════════════════════════════
//  NCR CONTENT PARSER - Handles ALL NCR formats
// ══════════════════════════════════════════════════════════════
function parseNCRContent(text) {
  const normalized = text.replace(/\r\n/g, '\n').replace(/\r/g, '\n').replace(/\t/g, ' ').replace(/ {2,}/g, ' ');
  const lines = normalized.split('\n').map(l => l.trim()).filter(Boolean);
  const fullText = lines.join('\n');

  const extracted = {
    ncrNo: '', date: '', detectionDate: '', itemDesc: '', ncrDesc: '',
    faultySl: '', healthySl: '', qty: '', subSystem: '', trainNo: '',
    car: '', responsibility: '', status: '', remarks: ''
  };

  // Helper: find value after label (handles same-line and next-line formats)
  function findAfterLabel(label) {
    // Same-line: "Label: Value" or "LabelValue" or "Label Value"
    const patterns = [
      new RegExp(label + '\\s*[:\\.]\\s*(.+?)(?:\\n|$)', 'i'),
      new RegExp(label + '\\s+(.+?)(?:\\n|$)', 'i'),
      new RegExp(label + '(.+?)(?:\\n|$)', 'i')
    ];
    for (const p of patterns) {
      const m = fullText.match(p);
      if (m && m[1] && m[1].trim().length > 1 && m[1].trim() !== '—') {
        return m[1].trim();
      }
    }
    // Next-line: "Label\nValue"
    for (let i = 0; i < lines.length - 1; i++) {
      if (lines[i].toLowerCase().includes(label.toLowerCase())) {
        const nextLine = lines[i + 1];
        if (nextLine && nextLine.trim().length > 1 && nextLine.trim() !== '—') {
          return nextLine.trim();
        }
      }
    }
    return '';
  }

  // === NCR NUMBER ===
  // Pattern 1: "Report no. NCR-BEML RS3R-T&C-CPD-895 Distribution to:"
  for (const line of lines.slice(0, 15)) {
    const m = line.match(/(?:Report|NCR)\s*(?:no|number)\.?\s*[:\.]?\s*(NCR[\-][A-Za-z0-9\s\-&]+?)(?:\s+Distribution|\s+Project|\s+FM|\s*$)/i);
    if (m) {
      let ncr = m[1].replace(/\s+/g, '-').replace(/-$/, '').trim();
      extracted.ncrNo = ncr;
      break;
    }
  }
  // Pattern 2: NCR number on standalone line
  if (!extracted.ncrNo) {
    for (const line of lines.slice(0, 15)) {
      if (/^NCR[\-]/.test(line) && line.length > 10 && line.length < 60) {
        extracted.ncrNo = line.replace(/\s+/g, '-');
        break;
      }
    }
  }
  // Pattern 3: "NCR Number: NCR-..."
  if (!extracted.ncrNo) {
    const m = fullText.match(/NCR\s+Number\s*[:\.]?\s*(NCR[\-][A-Za-z0-9\-]+)/i);
    if (m) extracted.ncrNo = m[1];
  }

  // === DATES ===
  let m = fullText.match(/Date\s+of\s+Detection\s*[\u2014\-]?\s*(\d{1,2}\s+(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*\.?\s+\d{2,4})/i);
  if (m) extracted.detectionDate = m[1].trim();
  if (!extracted.detectionDate) {
    m = fullText.match(/Detection\s*[:\.]?\s*(\d{1,2}[\.\/\-]\d{1,2}[\.\/\-]\d{2,4})/i);
    if (m) extracted.detectionDate = m[1];
  }
  m = fullText.match(/(?:Date\s+(?:Raised|of\s+NCR)|DateRaised)\s*[:\.]?\s*(\d{1,2}\s+(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*\.?\s+\d{2,4})/i);
  if (m) extracted.date = m[1].trim();
  if (!extracted.date && extracted.detectionDate) extracted.date = extracted.detectionDate;

  // === PRODUCT/ITEM ===
  extracted.itemDesc = findAfterLabel('Product');
  if (!extracted.itemDesc) extracted.itemDesc = findAfterLabel('Product/Component');
  if (!extracted.itemDesc) extracted.itemDesc = findAfterLabel('Item Description');
  const partNo = findAfterLabel('Part no');
  const supplier = findAfterLabel('Supplier');
  if (partNo && !partNo.includes('Supplier') && partNo.length < 50 && partNo !== '---') {
    extracted.itemDesc = (extracted.itemDesc || '') + ` [Part: ${partNo}]`;
  }
  if (supplier && !extracted.itemDesc.includes(supplier) && supplier.length < 50 && supplier !== '---') {
    extracted.itemDesc = (extracted.itemDesc || '') + ` [Supplier: ${supplier}]`;
  }
  extracted.itemDesc = extracted.itemDesc.replace(/\s*-\s*$/, '').replace(/Qty\.?\d+/i, '').trim();

  // === QUANTITY ===
  extracted.qty = findAfterLabel('Quantity');
  if (extracted.qty) { m = extracted.qty.match(/(\d+)/); if (m) extracted.qty = m[1]; }
  if (!extracted.qty) { m = fullText.match(/Qty\.?\s*[:\.]?\s*(\d+)/i); if (m) extracted.qty = m[1]; }

  // === NCR DESCRIPTION ===
  m = fullText.match(/Description\s+of\s+non[\-\s]?conformity\s*[:\.]?\s*\n(.+?)(?:\nDate|\nIssued|\nCorrection|\nAttached|$)/is);
  if (m) extracted.ncrDesc = m[1].trim().replace(/\n/g, ' ').substring(0, 500);
  if (!extracted.ncrDesc) {
    m = fullText.match(/Description\s+of\s+Non[\-\s]?Conformity\s*\n(.+?)(?:\nDate|\nIssued|\nCorrection|$)/is);
    if (m) extracted.ncrDesc = m[1].trim().replace(/\n/g, ' ').substring(0, 500);
  }

  // === VEHICLE/TRAIN ===
  const vehicleLine = findAfterLabel('Vehicle\\s*(?:no|number)');
  if (vehicleLine) {
    m = vehicleLine.match(/TS[#\s]*(\d+)/i);
    if (m) extracted.trainNo = m[1];
    m = vehicleLine.match(/((?:DMC|TC|MR)\s*[-#]?\s*[A-Z0-9\-]+)/i);
    if (m) extracted.car = m[1].replace(/\s+/g, ' ').trim();
    if (!extracted.car && vehicleLine.match(/MC\d/i)) {
      m = vehicleLine.match(/(MC\d)/i);
      if (m) extracted.car = m[1];
    }
  }
  if (!extracted.trainNo) { m = fullText.match(/TS[#\s]*(\d+)/i); if (m) extracted.trainNo = m[1]; }

  // === SUB-SYSTEM ===
  extracted.subSystem = findAfterLabel('Sub[\\-\\s]?System');

  // === STATUS ===
  m = fullText.match(/Status\s*[:\.]?\s*(OPEN|CLOSED|PENDING|RESOLVED)/i);
  if (m) extracted.status = m[1].toUpperCase();
  if (!extracted.status) {
    m = fullText.match(/Severity\s*[:\.]?\s*(Major|Minor)/i);
    if (m) extracted.status = m[1].toUpperCase();
  }

  // === RESPONSIBILITY ===
  extracted.responsibility = findAfterLabel('Responsible\\s+party');
  if (!extracted.responsibility) extracted.responsibility = findAfterLabel('Distribution');

  // === FAULTY/HEALTHY SL NO ===
  extracted.faultySl = findAfterLabel('Faulty.*?Sl\\.?\\s*No');
  if (!extracted.faultySl) extracted.faultySl = findAfterLabel('Faulty.*?item.*?Sl');
  if (extracted.faultySl) {
    extracted.faultySl = extracted.faultySl.split(/\u2014/)[0].trim();
    if (extracted.faultySl === '—' || extracted.faultySl.length < 2 || extracted.faultySl === 'NA') extracted.faultySl = '';
  }
  extracted.healthySl = findAfterLabel('Healthy.*?Sl\\.?\\s*No');
  if (!extracted.healthySl) extracted.healthySl = findAfterLabel('Healthy.*?item.*?Sl');
  if (extracted.healthySl) {
    extracted.healthySl = extracted.healthySl.split(/\u2014/)[0].trim();
    if (extracted.healthySl === '—' || extracted.healthySl.length < 2 || extracted.healthySl === 'NA') extracted.healthySl = '';
  }

  return extracted;
}
export { parseNCRContent };
