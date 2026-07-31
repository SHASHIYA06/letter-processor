import PDFDocument from 'pdfkit';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { Document, Packer, Paragraph, TextRun, AlignmentType, BorderStyle, TableRow, TableCell, Table, WidthType } from 'docx';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const PAGE_MARGIN_BOTTOM = 50;

function checkPageBreak(doc, y, neededHeight, L, R) {
  if (y + neededHeight > doc.page.height - PAGE_MARGIN_BOTTOM) {
    doc.addPage();
    return 50;
  }
  return y;
}

function drawCheckbox(doc, x, y, checked) {
  doc.rect(x, y, 8, 8).lineWidth(0.5).stroke();
  if (checked) {
    doc.save().fontSize(9).font('Helvetica-Bold').text('\u2588', x + 0.5, y - 0.5, { width: 8, align: 'center' }).restore();
  }
}

// ══════════════════════════════════════════════════════════════
//  BEML LETTER HEADER
// ══════════════════════════════════════════════════════════════
function drawBEMLHeader(doc, W) {
  const headerPath = path.join(__dirname, 'assets', 'beml-letterhead-header.png');
  if (fs.existsSync(headerPath)) {
    try {
      doc.image(headerPath, 0, 0, { width: W });
      return 142;
    } catch (e) {
      console.log('⚠️  Header image load failed:', e.message);
    }
  }
  // Fallback: draw text header
  doc.font('Times-Bold').fontSize(16).fillColor('#000').text('BEML LIMITED', 0, 20, { width: W, align: 'center' });
  doc.font('Times-Roman').fontSize(8).fillColor('#333').text('BEML Bhavan, No.1, Outer Ring Road, Bengaluru - 560068', 0, 40, { width: W, align: 'center' });
  doc.font('Times-Roman').fontSize(7).fillColor('#666').text("Schedule 'A' Company under Ministry of Defence, Govt. of India", 0, 52, { width: W, align: 'center' });
  doc.font('Times-Roman').fontSize(7).fillColor('#666').text('Defence & Aerospace | Mining & Construction | Rail & Metro', 0, 62, { width: W, align: 'center' });
  doc.moveTo(55, 75).lineTo(W - 55, 75).lineWidth(1).stroke('#000');
  return 85;
}

function drawBEMLFooter(doc, W, H) {
  const footerPath = path.join(__dirname, 'assets', 'beml-letterhead-footer.png');
  if (fs.existsSync(footerPath)) {
    try {
      doc.save();
      doc.opacity(0.6);
      doc.image(footerPath, 0, H - 100, { width: W });
      doc.restore();
      return;
    } catch (e) {
      console.log('⚠️  Footer image load failed:', e.message);
    }
  }
  // Fallback: draw text footer
  doc.save();
  doc.font('Times-Roman').fontSize(7).fillColor('#666');
  doc.text('BEML Limited, Bengaluru Complex, New Thippasandra Post, Bengaluru - 560 075', 55, H - 60, { width: W - 110, align: 'center' });
  doc.text('Tel: +91-80-2524 1752 | E-mail: office.edr@bemlltd.in | www.beml.co.in', 55, H - 48, { width: W - 110, align: 'center' });
  doc.moveTo(55, H - 70).lineTo(W - 55, H - 70).lineWidth(0.5).stroke('#999');
  doc.restore();
}

// ══════════════════════════════════════════════════════════════
//  NCR PDF
// ══════════════════════════════════════════════════════════════
function generateNCRPdf(data, outputPath) {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ size: 'A4', margins: { top: 0, bottom: 0, left: 0, right: 0 } });
    const stream = fs.createWriteStream(outputPath);
    doc.pipe(stream);
    const W = doc.page.width, H = doc.page.height, L = 55, R = 555, CW = R - L;
    let y = 15;
    
    // Draw BEML header
    const ncrH = path.join(__dirname, 'assets', 'ncr-header.png');
    const bemlH = path.join(__dirname, 'assets', 'beml-header.jpg');
    const bemlL = path.join(__dirname, 'assets', 'beml-logo.jpg');
    
    if (fs.existsSync(ncrH)) {
      try { doc.image(ncrH, L - 5, y, { width: CW + 10 }); } catch (e) {}
    } else if (fs.existsSync(bemlH)) {
      try { doc.image(bemlH, L - 5, y, { width: 80, height: 50 }); } catch (e) {}
    }
    if (fs.existsSync(bemlL)) {
      try { doc.image(bemlL, W - 140, y, { width: 110, height: 45 }); } catch (e) {}
    }
    
    doc.font('Times-Bold').fontSize(13).fillColor('#000').text('NON-CONFORMITY REPORT', 0, y + 58, { width: W, align: 'center' });
    y += 78;
    const c1 = L, c2 = L + 110, c3 = L + 280, c4 = L + 390, rowH = 22;
    doc.rect(L, y, CW, 0).lineWidth(0.5).stroke();
    function tRow(l1, v1, l2, v2, h) {
      const rh = h || rowH;
      doc.moveTo(L, y + rh).lineTo(R, y + rh).lineWidth(0.5).stroke();
      doc.moveTo(c2, y).lineTo(c2, y + rh).lineWidth(0.5).stroke();
      doc.moveTo(c3, y).lineTo(c3, y + rh).lineWidth(0.5).stroke();
      doc.moveTo(c4, y).lineTo(c4, y + rh).lineWidth(0.5).stroke();
      doc.font('Times-Bold').fontSize(8).fillColor('#000');
      if (l1) doc.text(l1, c1 + 3, y + 5, { width: c2 - c1 - 6 });
      if (l2) doc.text(l2, c3 + 3, y + 5, { width: c4 - c3 - 6 });
      doc.font('Helvetica').fontSize(8);
      if (v1 !== undefined) doc.text(v1 || '---', c2 + 3, y + 5, { width: c3 - c2 - 6 });
      if (v2 !== undefined) doc.text(v2 || '---', c4 + 3, y + 5, { width: R - c4 - 6 });
      y += rh;
    }
    tRow('Report no.', data.ncrNo, 'Distribution to:', data.distribution || 'OEM/ SBU-S&M / R&D/ PM/Purchase/ Quality');
    tRow('Project', data.project, 'Vehicle no.', data.vehicleNo);
    tRow('Product', data.product, 'Assy dwg no.', (data.assyDwgNo || '---') + '    Rev ' + (data.rev || '---'));
    tRow('Quantity', data.qty, 'Part no.', data.partNo);
    tRow('Supplier', data.supplier, 'Assy serial no.', data.assySerialNo);
    tRow('Detection', data.detectionDate, 'Part serial no.', data.partSerialNo);
    tRow('Place', data.place, 'B/L No.', data.blNo);
    tRow('Stored at', data.storedAt, 'Invoice no.', data.invoiceNo);
    doc.moveTo(L, y + rowH).lineTo(R, y + rowH).lineWidth(0.5).stroke();
    doc.moveTo(c2, y).lineTo(c2, y + rowH).lineWidth(0.5).stroke();
    doc.moveTo(c3, y).lineTo(c3, y + rowH).lineWidth(0.5).stroke();
    doc.moveTo(c4, y).lineTo(c4, y + rowH).lineWidth(0.5).stroke();
    doc.font('Times-Bold').fontSize(8).fillColor('#000').text('Severity', c1 + 3, y + 5, { width: c2 - c1 - 6 });
    const sv = y + 6;
    drawCheckbox(doc, c2 + 5, sv, data.severity === 'Major');
    doc.font('Helvetica').fontSize(8).text(' Major', c2 + 15, sv, { width: 50 });
    drawCheckbox(doc, c2 + 60, sv, data.severity === 'Minor');
    doc.text(' Minor', c2 + 70, sv, { width: 50 });
    doc.font('Times-Bold').fontSize(8).text('Responsible party', c3 + 3, y + 5, { width: c4 - c3 - 6 });
    doc.font('Helvetica').fontSize(8).text(data.responsibility || '---', c4 + 3, y + 5, { width: R - c4 - 6 });
    y += rowH;
    doc.moveTo(L, y + rowH).lineTo(R, y + rowH).lineWidth(0.5).stroke();
    doc.moveTo(c2, y).lineTo(c2, y + rowH).lineWidth(0.5).stroke();
    doc.moveTo(c3, y).lineTo(c3, y + rowH).lineWidth(0.5).stroke();
    doc.moveTo(c4, y).lineTo(c4, y + rowH).lineWidth(0.5).stroke();
    doc.font('Times-Bold').fontSize(8).fillColor('#000').text('Material status', c1 + 3, y + 5, { width: c2 - c1 - 6 });
    const mv = y + 6;
    drawCheckbox(doc, c2 + 5, mv, data.materialStatus === 'Before installation');
    doc.font('Times-Bold').fontSize(7).text(' Before installation', c2 + 15, mv, { width: 100 });
    drawCheckbox(doc, c2 + 120, mv, data.materialStatus === 'Installed');
    doc.text(' Installed', c2 + 130, mv, { width: 50 });
    drawCheckbox(doc, c3 + 5, mv, data.disassembled === 'Disassembled');
    doc.text(' Disassembled', c3 + 15, mv, { width: 70 });
    drawCheckbox(doc, c4 + 5, mv, data.disassembled === 'Before receiving');
    doc.text(' Before receiving', c4 + 15, mv, { width: 80 });
    y += rowH;
    doc.moveTo(L, 93).lineTo(L, y).lineWidth(0.5).stroke();
    doc.moveTo(R, 93).lineTo(R, y).lineWidth(0.5).stroke();
    y += 6;
    y = checkPageBreak(doc, y, 60, L, R);
    doc.font('Times-Bold').fontSize(8).fillColor('#000').text('Description of non-conformity:', L, y);
    y += 12;
    doc.font('Helvetica').fontSize(8).text(data.ncrDesc || '---', L + 3, y, { width: CW - 6, lineGap: 2 });
    const dLines = Math.ceil((data.ncrDesc || '').length / 80);
    y += Math.max(18, dLines * 10 + 8);
    doc.font('Times-Bold').fontSize(7).fillColor('#666').text('Attached documents (if any):', L, y);
    y += 12;
    doc.rect(L, y - dLines * 10 - 30, CW, dLines * 10 + 42).lineWidth(0.3).stroke();
    y += 4;
    const tC = [L, L + 90, L + 220, L + 350, R];
    doc.moveTo(L, y).lineTo(R, y).lineWidth(0.3).stroke();
    doc.moveTo(L, y + 16).lineTo(R, y + 16).lineWidth(0.3).stroke();
    doc.moveTo(L, y + 32).lineTo(R, y + 32).lineWidth(0.3).stroke();
    tC.forEach((cx, i) => { if (i > 0 && i < 5) doc.moveTo(cx, y).lineTo(cx, y + 32).lineWidth(0.3).stroke(); });
    doc.moveTo(L, y).lineTo(L, y + 32).lineWidth(0.3).stroke();
    doc.moveTo(R, y).lineTo(R, y + 32).lineWidth(0.3).stroke();
    doc.font('Times-Bold').fontSize(7).fillColor('#000');
    doc.text('Date', tC[0] + 3, y + 3, { width: 84 });
    doc.text('Team', tC[1] + 3, y + 3, { width: 124 });
    doc.text('Issued by', tC[2] + 3, y + 3, { width: 124 });
    doc.text('Reviewed & approved by', tC[3] + 3, y + 3, { width: R - tC[3] - 3 });
    doc.font('Helvetica').fontSize(8);
    doc.text(data.detectionDate || '---', tC[0] + 3, y + 19, { width: 84 });
    doc.text(data.team || '---', tC[1] + 3, y + 19, { width: 124 });
    doc.text(data.issuedBy || '---', tC[2] + 3, y + 19, { width: 124 });
    doc.text(data.reviewedBy || '---', tC[3] + 3, y + 19, { width: R - tC[3] - 3 });
    y += 36;
    y += 4;
    y = checkPageBreak(doc, y, 60, L, R);
    doc.font('Times-Bold').fontSize(8).fillColor('#000').text('Cause of non-conformity:', L, y);
    y += 12;
    doc.font('Helvetica').fontSize(8).text(data.cause || '---', L + 3, y, { width: CW - 6, lineGap: 2 });
    const cLines = Math.ceil((data.cause || '').length / 80);
    y += Math.max(16, cLines * 10 + 6);
    doc.font('Times-Bold').fontSize(7).fillColor('#666').text('Attached documents (if any):', L, y);
    y += 10;
    doc.rect(L, y - cLines * 10 - 28, CW, cLines * 10 + 38).lineWidth(0.3).stroke();
    y += 4;
    y = checkPageBreak(doc, y, 80, L, R);
    doc.font('Times-Bold').fontSize(9).fillColor('#000').text('Correction / Corrective Action Result:', L + 2, y);
    y += 14;
    doc.font('Helvetica').fontSize(8).text(data.correction || '---', L + 12, y, { width: CW - 15, lineGap: 2 });
    const coLines = Math.ceil((data.correction || '').length / 75);
    y += Math.max(16, coLines * 10 + 6);
    if (data.healthySl || data.faultySl) {
      doc.font('Helvetica').fontSize(8);
      if (data.healthySl) { doc.text('In (Healthy) Sl. No: ' + data.healthySl, L + 40, y); y += 11; }
      if (data.faultySl) { doc.text('Out (Faulty) Sl. No: ' + data.faultySl, L + 40, y); y += 11; }
    }
    doc.font('Times-Bold').fontSize(7).fillColor('#666').text('Attached documents (if any):', L, y);
    y += 10;
    doc.rect(L, y - coLines * 10 - 50, CW, coLines * 10 + 62).lineWidth(0.3).stroke();
    y += 4;
    y = checkPageBreak(doc, y, 120, L, R);
    const bC = [L, L + 70, L + 190, L + 310, L + 385, R], bH = 16;
    doc.moveTo(L, y).lineTo(R, y).lineWidth(0.3).stroke();
    doc.moveTo(L, y + bH).lineTo(R, y + bH).lineWidth(0.3).stroke();
    [1,2,3,4,5].forEach(i => doc.moveTo(bC[i], y).lineTo(bC[i], y + bH).lineWidth(0.3).stroke());
    doc.moveTo(L, y).lineTo(L, y + bH).lineWidth(0.3).stroke();
    doc.moveTo(R, y).lineTo(R, y + bH).lineWidth(0.3).stroke();
    doc.font('Times-Bold').fontSize(7).fillColor('#000');
    doc.text('Date', bC[0] + 2, y + 3, { width: 66 });
    doc.text('Action by', bC[1] + 2, y + 3, { width: 116 });
    doc.text('Issued by', bC[2] + 2, y + 3, { width: 116 });
    doc.text('Reviewed by', bC[3] + 2, y + 3, { width: 71 });
    doc.text('Approved by', bC[4] + 2, y + 3, { width: R - bC[4] - 2 });
    y += bH;
    doc.moveTo(L, y + bH).lineTo(R, y + bH).lineWidth(0.3).stroke();
    [1,2,3,4,5].forEach(i => doc.moveTo(bC[i], y).lineTo(bC[i], y + bH).lineWidth(0.3).stroke());
    doc.moveTo(L, y).lineTo(L, y + bH).lineWidth(0.3).stroke();
    doc.moveTo(R, y).lineTo(R, y + bH).lineWidth(0.3).stroke();
    y += bH;
    const dH = 24;
    doc.moveTo(L, y + dH).lineTo(R, y + dH).lineWidth(0.3).stroke();
    doc.moveTo(bC[1], y).lineTo(bC[1], y + dH).lineWidth(0.3).stroke();
    doc.moveTo(bC[4], y).lineTo(bC[4], y + dH).lineWidth(0.3).stroke();
    doc.moveTo(L, y).lineTo(L, y + dH).lineWidth(0.3).stroke();
    doc.moveTo(R, y).lineTo(R, y + dH).lineWidth(0.3).stroke();
    doc.font('Times-Bold').fontSize(8).fillColor('#000').text('Decision', bC[0] + 2, y + 4, { width: 66 });
    const decs = ['Claim','Holding','Use as is','Rework','Waiver','Scrap','Repair'];
    let dx = bC[1] + 5, dy = y + 4;
    decs.forEach((d, i) => { drawCheckbox(doc, dx, dy, data.decision === d); doc.font('Helvetica').fontSize(7).text(' ' + d, dx + 9, dy, { width: 48 }); dx += 62; if (i === 3) { dx = bC[1] + 5; dy += 10; } });
    doc.font('Times-Bold').fontSize(7).text('Repair procedure', bC[4] + 2, y + 3, { width: 70 });
    doc.font('Helvetica').fontSize(7).text(' Yes /  No', bC[4] + 2, y + 13, { width: 70 });
    y += dH;
    const vH = 20;
    doc.moveTo(L, y + vH).lineTo(R, y + vH).lineWidth(0.3).stroke();
    doc.moveTo(bC[1], y).lineTo(bC[1], y + vH).lineWidth(0.3).stroke();
    doc.moveTo(bC[4], y).lineTo(bC[4], y + vH).lineWidth(0.3).stroke();
    doc.moveTo(L, y).lineTo(L, y + vH).lineWidth(0.3).stroke();
    doc.moveTo(R, y).lineTo(R, y + vH).lineWidth(0.3).stroke();
    doc.font('Times-Bold').fontSize(7).fillColor('#000').text('Verification on\ncorrection', bC[0] + 2, y + 2, { width: 66 });
    doc.font('Times-Bold').text('Approval\nScope', bC[4] + 2, y + 2, { width: 70 });
    doc.font('Helvetica').fontSize(7).text(' Internal /  Customer', bC[4] + 2, y + 12, { width: 70 });
    y += vH;
    doc.moveTo(L, y + vH).lineTo(R, y + vH).lineWidth(0.3).stroke();
    doc.moveTo(bC[1], y).lineTo(bC[1], y + vH).lineWidth(0.3).stroke();
    doc.moveTo(bC[4], y).lineTo(bC[4], y + vH).lineWidth(0.3).stroke();
    doc.moveTo(L, y).lineTo(L, y + vH).lineWidth(0.3).stroke();
    doc.moveTo(R, y).lineTo(R, y + vH).lineWidth(0.3).stroke();
    doc.font('Times-Bold').fontSize(7).fillColor('#000').text('Verification on\ncorrective action', bC[0] + 2, y + 2, { width: 66 });
    y += vH;
    const aH = 20;
    doc.moveTo(L, y + aH).lineTo(R, y + aH).lineWidth(0.3).stroke();
    doc.moveTo(bC[1], y).lineTo(bC[1], y + aH).lineWidth(0.3).stroke();
    doc.moveTo(bC[2], y).lineTo(bC[2], y + aH).lineWidth(0.3).stroke();
    doc.moveTo(bC[3], y).lineTo(bC[3], y + aH).lineWidth(0.3).stroke();
    doc.moveTo(bC[4], y).lineTo(bC[4], y + aH).lineWidth(0.3).stroke();
    doc.moveTo(L, y).lineTo(L, y + aH).lineWidth(0.3).stroke();
    doc.moveTo(R, y).lineTo(R, y + aH).lineWidth(0.3).stroke();
    doc.font('Times-Bold').fontSize(7).fillColor('#000').text('Approved by', bC[0] + 2, y + 4, { width: 66 });
    doc.text('Entity', bC[1] + 2, y + 2, { width: 66 });
    doc.text('Position', bC[2] + 2, y + 2, { width: 66 });
    doc.text('Name', bC[3] + 2, y + 2, { width: 66 });
    doc.text('Date', bC[4] + 2, y + 2, { width: 40 });
    doc.text('Sign', R - 40, y + 2, { width: 38 });
    doc.end();
    stream.on('finish', () => resolve(outputPath));
    stream.on('error', reject);
  });
}

// ══════════════════════════════════════════════════════════════
//  BEML LETTER PDF
// ══════════════════════════════════════════════════════════════
function generateLetterPdf(data, outputPath) {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ size: 'A4', margins: { top: 0, bottom: 0, left: 0, right: 0 } });
    const stream = fs.createWriteStream(outputPath);
    doc.pipe(stream);
    const W = doc.page.width, H = doc.page.height, L = 55, R = W - 55, CW = R - L;
    let y = drawBEMLHeader(doc, W);
    drawBEMLFooter(doc, W, H);
    doc.font('Times-Bold').fontSize(10).fillColor('#000').text(data.refNumber || '---', L, y);
    doc.font('Times-Roman').fontSize(10).text('Date: ' + (data.date || '---'), R - 140, y, { width: 140, align: 'right' });
    y += 18;
    doc.font('Times-Roman').fontSize(10).text('To,', L, y); y += 14;
    if (data.to) { doc.text(data.to, L, y, { width: CW }); y += data.to.split('\n').length * 14 + 6; }
    if (data.kindAttn) { doc.font('Times-Bold').fontSize(10).text('Kind Attn: ' + data.kindAttn, L, y, { width: CW, align: 'center' }); y += 20; }
    y += 5;
    doc.font('Times-Bold').fontSize(10).text('Subject: ' + (data.subject || '---'), L, y, { width: CW, underline: true });
    y += 18;
    if (data.allReferences) { doc.font('Times-Roman').fontSize(10).text('Ref: ' + data.allReferences, L, y, { width: CW }); y += data.allReferences.split('\n').length * 13 + 6; }
    y += 5;
    doc.font('Times-Roman').fontSize(10).text('Dear Sir,', L, y); y += 18;
    const body = data.letterContent || data.letterBody || '---';
    doc.font('Times-Roman').fontSize(10).text(body, L, y, { width: CW, lineGap: 4 });
    y = doc.y + 5;
    doc.font('Times-Roman').fontSize(10);
    doc.text('Thanking you.', L, y); y += 16;
    doc.text('Yours sincerely,', L, y); y += 16;
    doc.text('for BEML Limited', L, y); y += 30;
    doc.font('Times-Bold').fontSize(10).text(data.signatory || '', L, y); y += 14;
    doc.font('Times-Roman').fontSize(10).text(data.designation || '', L, y); y += 14;
    doc.text(data.project || '', L, y); y += 22;
    if (data.enclosures) { doc.font('Times-Roman').fontSize(10).text('Encl: ' + data.enclosures, L, y, { width: CW, align: 'center' }); y += 18; }
    if (data.cc) { doc.font('Times-Roman').fontSize(10); const ccLines = data.cc.split('\n'); doc.text('Cc: ' + ccLines[0], L, y, { width: CW }); y += 14; for (let i = 1; i < ccLines.length; i++) { doc.text('      ' + ccLines[i], L, y, { width: CW }); y += 14; } }
    doc.end();
    stream.on('finish', () => resolve(outputPath));
    stream.on('error', reject);
  });
}

// ══════════════════════════════════════════════════════════════
//  DOCX GENERATORS
// ══════════════════════════════════════════════════════════════
function generateNCRDocx(data, outputPath) {
  return new Promise((resolve, reject) => {
    const bs = { style: BorderStyle.SINGLE, size: 1, color: '000000' }, cb = { top: bs, bottom: bs, left: bs, right: bs };
    function mr(cells) { return new TableRow({ children: cells.map(([text, bold, w]) => new TableCell({ borders: cb, width: { size: w || 25, type: WidthType.PERCENTAGE }, children: [new Paragraph({ children: [new TextRun({ text: text || '---', bold: bold || false, size: 16, font: 'Times New Roman' })] })] })) }); }
    const doc = new Document({ sections: [{ children: [
      new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: 'NON-CONFORMITY REPORT', bold: true, size: 24, font: 'Times New Roman' })] }),
      new Paragraph({ spacing: { before: 100 }, children: [] }),
      new Table({ width: { size: 100, type: WidthType.PERCENTAGE }, rows: [
        mr([['Report no.', true, 15], [data.ncrNo, false, 35], ['Distribution to:', true, 15], [data.distribution, false, 35]]),
        mr([['Project', true, 15], [data.project, false, 35], ['Vehicle no.', true, 15], [data.vehicleNo, false, 35]]),
        mr([['Product', true, 15], [data.product, false, 35], ['Assy dwg no.', true, 15], [data.assyDwgNo || '---', false, 35]]),
        mr([['Quantity', true, 15], [data.qty, false, 35], ['Part no.', true, 15], [data.partNo, false, 35]]),
        mr([['Supplier', true, 15], [data.supplier, false, 35], ['Assy serial no.', true, 15], [data.assySerialNo, false, 35]]),
        mr([['Detection', true, 15], [data.detectionDate, false, 35], ['Part serial no.', true, 15], [data.partSerialNo, false, 35]]),
        mr([['Place', true, 15], [data.place, false, 35], ['B/L No.', true, 15], [data.blNo, false, 35]]),
        mr([['Stored at', true, 15], [data.storedAt, false, 35], ['Invoice no.', true, 15], [data.invoiceNo, false, 35]]),
        mr([['Severity', true, 15], [(data.severity === 'Major' ? '[X]' : '[ ]') + ' Major  ' + (data.severity === 'Minor' ? '[X]' : '[ ]') + ' Minor', false, 35], ['Responsible party', true, 15], [data.responsibility, false, 35]]),
        mr([['Material status', true, 15], [data.materialStatus || 'Before installation', false, 35], ['Disassembled', true, 15], [data.disassembled || '---', false, 35]]),
      ]}),
      new Paragraph({ spacing: { before: 200 }, children: [new TextRun({ text: 'Description of non-conformity:', bold: true, size: 18, font: 'Times New Roman' })] }),
      new Paragraph({ spacing: { before: 100 }, children: [new TextRun({ text: data.ncrDesc || '---', size: 18, font: 'Times New Roman' })] }),
      new Paragraph({ spacing: { before: 200 }, children: [new TextRun({ text: 'Cause of non-conformity:', bold: true, size: 18, font: 'Times New Roman' })] }),
      new Paragraph({ spacing: { before: 100 }, children: [new TextRun({ text: data.cause || '---', size: 18, font: 'Times New Roman' })] }),
      new Paragraph({ spacing: { before: 200 }, children: [new TextRun({ text: 'Correction / Corrective Action Result:', bold: true, size: 18, font: 'Times New Roman' })] }),
      new Paragraph({ spacing: { before: 100 }, children: [new TextRun({ text: data.correction || '---', size: 18, font: 'Times New Roman' })] }),
      new Paragraph({ spacing: { before: 300 }, children: [new TextRun({ text: 'Decision: ' + (data.decision || '---'), size: 18, font: 'Times New Roman' })] }),
    ] }] });
    Packer.toBuffer(doc).then(buf => { fs.writeFileSync(outputPath, buf); resolve(outputPath); }).catch(reject);
  });
}

function generateLetterDocx(data, outputPath) {
  return new Promise((resolve, reject) => {
    const doc = new Document({ sections: [{ children: [
      new Paragraph({ alignment: AlignmentType.CENTER, spacing: { after: 100 }, children: [new TextRun({ text: 'BEML LIMITED', bold: true, size: 32, font: 'Times New Roman' })] }),
      new Paragraph({ alignment: AlignmentType.CENTER, spacing: { after: 50 }, children: [new TextRun({ text: "Schedule 'A' Company under Ministry of Defence, Govt. of India", size: 16, font: 'Times New Roman' })] }),
      new Paragraph({ alignment: AlignmentType.CENTER, spacing: { after: 50 }, children: [new TextRun({ text: 'Defence & Aerospace | Mining & Construction | Rail & Metro', bold: true, size: 16, font: 'Times New Roman', color: '4A148C' })] }),
      new Paragraph({ spacing: { before: 200 }, children: [new TextRun({ text: data.refNumber || '---', bold: true, size: 20, font: 'Times New Roman' }), new TextRun({ text: '\t\t\t\t\t\tDate: ' + (data.date || '---'), size: 20, font: 'Times New Roman' })] }),
      new Paragraph({ spacing: { before: 200 }, children: [new TextRun({ text: 'To,', size: 20, font: 'Times New Roman' })] }),
      new Paragraph({ children: [new TextRun({ text: data.to || '---', size: 20, font: 'Times New Roman' })] }),
      data.kindAttn ? new Paragraph({ alignment: AlignmentType.CENTER, spacing: { before: 200 }, children: [new TextRun({ text: 'Kind Attn: ' + data.kindAttn, bold: true, size: 20, font: 'Times New Roman' })] }) : null,
      new Paragraph({ spacing: { before: 200 }, children: [new TextRun({ text: 'Subject: ' + (data.subject || '---'), bold: true, underline: {}, size: 20, font: 'Times New Roman' })] }),
      data.allReferences ? new Paragraph({ spacing: { before: 100 }, children: [new TextRun({ text: 'Ref: ' + data.allReferences, size: 20, font: 'Times New Roman' })] }) : null,
      new Paragraph({ spacing: { before: 200 }, children: [new TextRun({ text: 'Dear Sir,', size: 20, font: 'Times New Roman' })] }),
      new Paragraph({ spacing: { before: 200 }, children: [new TextRun({ text: data.letterContent || data.letterBody || '---', size: 20, font: 'Times New Roman' })] }),
      new Paragraph({ spacing: { before: 200 }, children: [new TextRun({ text: 'Thanking you.', size: 20, font: 'Times New Roman' })] }),
      new Paragraph({ children: [new TextRun({ text: 'Yours sincerely,', size: 20, font: 'Times New Roman' })] }),
      new Paragraph({ spacing: { before: 100 }, children: [new TextRun({ text: 'for BEML Limited', size: 20, font: 'Times New Roman' })] }),
      new Paragraph({ spacing: { before: 300 }, children: [new TextRun({ text: data.signatory || '', bold: true, size: 20, font: 'Times New Roman' })] }),
      new Paragraph({ children: [new TextRun({ text: data.designation || '', size: 20, font: 'Times New Roman' })] }),
      new Paragraph({ children: [new TextRun({ text: data.project || '', size: 20, font: 'Times New Roman' })] }),
      data.enclosures ? new Paragraph({ alignment: AlignmentType.CENTER, spacing: { before: 200 }, children: [new TextRun({ text: 'Encl: ' + data.enclosures, size: 20, font: 'Times New Roman' })] }) : null,
      data.cc ? new Paragraph({ spacing: { before: 200 }, children: [new TextRun({ text: 'Cc: ' + data.cc, size: 20, font: 'Times New Roman' })] }) : null,
      new Paragraph({ spacing: { before: 200 }, children: [new TextRun({ text: 'BEML Limited, Bengaluru Complex, New Thippasandra Post, Bengaluru - 560 075', size: 14, font: 'Times New Roman', color: '666666' })] }),
      new Paragraph({ children: [new TextRun({ text: 'Tel: +91-80-2524 1752 | E-mail: office.edr@bemlltd.in', size: 14, font: 'Times New Roman', color: '666666' })] }),
    ].filter(Boolean) }] });
    Packer.toBuffer(doc).then(buf => { fs.writeFileSync(outputPath, buf); resolve(outputPath); }).catch(reject);
  });
}

export { generateNCRPdf, generateLetterPdf, generateNCRDocx, generateLetterDocx };
