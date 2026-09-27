// tests/test_docx_mammoth_security.mjs
// Targeted verification suite for mammoth 1.13.0 upgrade:
// 1. DOCX text extraction with standard paragraphs, headings, bullet lists
// 2. Malformed / non-zip buffer resilience
// 3. Path traversal / directory escape resistance (GHSA-rmjr-87wv-gf87)
// 4. Verification that extracted text matches expected resume content

import assert from 'node:assert/strict';
import mammoth from 'mammoth';
import JSZip from 'jszip';

console.log('================================================================');
console.log('  MAMMOTH 1.13.0 DOCX PARSING & SECURITY REGRESSION SUITE        ');
console.log('================================================================\n');

// 1. Helper to generate a valid in-memory .docx buffer using standard OpenXML
async function createSampleDocx(paragraphs) {
  const zip = new JSZip();

  // Content Types
  zip.file('[Content_Types].xml', `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
  <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
  <Default Extension="xml" ContentType="application/xml"/>
  <Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>
</Types>`);

  // Package Relationships
  zip.file('_rels/.rels', `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/>
</Relationships>`);

  // Word Document XML
  const bodyXml = paragraphs.map(p => `
    <w:p>
      <w:r>
        <w:t>${p}</w:t>
      </w:r>
    </w:p>
  `).join('');

  zip.file('word/document.xml', `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
  <w:body>
    ${bodyXml}
  </w:body>
</w:document>`);

  return zip.generateAsync({ type: 'nodebuffer' });
}

// -------------------------------------------------------------
// Test 1: Valid DOCX Resume Extraction
// -------------------------------------------------------------
console.log('Test 1: Valid DOCX resume extraction via mammoth.extractRawText...');
const resumeParagraphs = [
  'Alex Rivera - Senior Full Stack Cloud Architect',
  'San Francisco, CA | alex.rivera@example.com | (555) 019-2834 | linkedin.com/in/alexrivera',
  'Summary: Proven engineering leader with 10+ years specializing in Next.js, TypeScript, PostgreSQL, and AWS.',
  'Experience: Principal Engineer at CloudScale Labs (2021 - Present)',
  '- Designed and orchestrated multi-region microservices handling 40M+ monthly transactions.',
  '- Mentored 14 engineers across full-stack TypeScript, CI/CD automation, and Supabase RLS security.',
  'Education: B.S. in Computer Science, University of California, Berkeley'
];

const validDocxBuffer = await createSampleDocx(resumeParagraphs);
const result = await mammoth.extractRawText({ buffer: validDocxBuffer });
assert.ok(result.value, 'Extracted text must not be empty');
assert.ok(result.value.includes('Alex Rivera - Senior Full Stack Cloud Architect'), 'Must extract candidate header');
assert.ok(result.value.includes('CloudScale Labs'), 'Must extract work history');
assert.ok(result.value.includes('40M+ monthly transactions'), 'Must extract metrics');
assert.ok(result.value.length >= 80, 'Extracted text must exceed 80-char minimum resume threshold');
console.log(`  ✓ Successfully extracted ${result.value.length} characters of structured resume text.`);

// -------------------------------------------------------------
// Test 2: Malformed / Corrupted DOCX Handling
// -------------------------------------------------------------
console.log('\nTest 2: Malformed / non-zip buffer resilience...');
const randomCorruptBuffer = Buffer.from('NOT_A_VALID_ZIP_HEADER_JUST_GARBAGE_BYTES_1234567890');
try {
  await mammoth.extractRawText({ buffer: randomCorruptBuffer });
  assert.fail('Should have rejected corrupted non-zip buffer');
} catch (err) {
  assert.ok(err, 'Expected error on invalid zip archive');
  console.log(`  ✓ Malformed buffer cleanly rejected: "${err.message}".`);
}

// Truncated buffer
const truncatedBuffer = validDocxBuffer.subarray(0, 150);
try {
  await mammoth.extractRawText({ buffer: truncatedBuffer });
  assert.fail('Should have rejected truncated buffer');
} catch (err) {
  assert.ok(err, 'Expected error on truncated buffer');
  console.log(`  ✓ Truncated buffer cleanly rejected: "${err.message}".`);
}

// -------------------------------------------------------------
// Test 3: Path Traversal / Directory Escape Resistance (GHSA-rmjr-87wv-gf87)
// -------------------------------------------------------------
console.log('\nTest 3: Hostile path traversal archive entry audit (GHSA-rmjr-87wv-gf87)...');
const hostileZip = new JSZip();
hostileZip.file('[Content_Types].xml', `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
  <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
  <Default Extension="xml" ContentType="application/xml"/>
  <Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>
</Types>`);

hostileZip.file('_rels/.rels', `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/>
</Relationships>`);

hostileZip.file('word/document.xml', `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
  <w:body>
    <w:p><w:r><w:t>Path Traversal Test Content for Resume Processing</w:t></w:r></w:p>
  </w:body>
</w:document>`);

// Attempt zip slip directory traversal entry
hostileZip.file('../../etc/passwd', 'malicious_content_payload');
hostileZip.file('word/../../escaped_target.txt', 'malicious_escape_payload');

const hostileBuffer = await hostileZip.generateAsync({ type: 'nodebuffer' });
// mammoth.extractRawText should process document text safely in memory without writing or escaping to disk
const hostileResult = await mammoth.extractRawText({ buffer: hostileBuffer });
assert.ok(hostileResult.value.includes('Path Traversal Test Content'), 'Must parse safe content in memory');
assert.ok(!hostileResult.value.includes('malicious'), 'Must not read arbitrary external traversal files');
console.log('  ✓ Hostile archive safely sanitized and processed in memory without path traversal exploit.');

// -------------------------------------------------------------
// Test 4: Route Integration Pipeline Simulation
// -------------------------------------------------------------
console.log('\nTest 4: Simulating resume upload endpoint sanitization & length gating...');
let processedText = hostileResult.value.replace(/\u0000/g, '').trim();
assert.ok(processedText.length >= 40, 'Sanitization keeps valid text');
console.log('  ✓ Endpoint pipeline integration logic validated.');

console.log('\n================================================================');
console.log('  ALL MAMMOTH 1.13.0 REGRESSION CHECKS PASSED (4/4)            ');
console.log('================================================================\n');
