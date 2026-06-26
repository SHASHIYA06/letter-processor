import { parseNCRContent } from './ncr-parser.js';

const text = `NONCONFORMITY REPORT
Report no.
NCR-BEML RS3R-T&C-CPD-867
Distribution to: OEM / QR / RT / GR1 / RD
Project KMRCL RS(3R)
Vehicle no. TS#17, DMC2
Product ACP
Assy dwg no. --
Quantity 1 no.
Part no.
Supplier M/s Televic
Detection 24.10.2025
Responsible party M/s Televic
Description of non-conformity: During commissioning, ACP is found faulty.
Status OPEN`;

const result = parseNCRContent(text);
console.log('=== NCR-867 EXTRACTION ===');
for (const [k, v] of Object.entries(result)) {
  console.log(k + ':', v || 'EMPTY');
}
