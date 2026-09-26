/**
 * Utility to generate a valid PDF byte string or test blank/corrupt files for testing
 */

export function createSampleResumePdf(studentName: string, targetJob: string, skills: string[]): { base64: string; fileName: string; size: number } {
  const contentText = `
%PDF-1.4
1 0 obj
<< /Type /Catalog /Pages 2 0 R >>
endobj
2 0 obj
<< /Type /Pages /Kids [3 0 R] /Count 1 >>
endobj
3 0 obj
<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Contents 4 0 R /Resources << /Font << /F1 5 0 R >> >> >>
endobj
4 0 obj
<< /Length 450 >>
stream
BT
/F1 20 Tf
50 720 Td
(${studentName} - Middle School Student Resume) Tj
/F1 12 Tf
0 -30 Td
(Target Position: ${targetJob}) Tj
0 -25 Td
(Academic History & Conduct Record: 2024-2026 Academic Years) Tj
0 -20 Td
(Verified Middle School Extracurriculars and Duties:) Tj
0 -20 Td
(- Key Skills: ${skills.join(', ')}) Tj
0 -20 Td
(- 2-Year Experience: Active participant in campus clubs and classroom tasks) Tj
0 -20 Td
(- Faculty Commendations: Good citizenship, reliable attendance, zero infractions) Tj
ET
endstream
endobj
5 0 obj
<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>
endobj
xref
0 6
0000000000 65535 f 
0000000010 00000 n 
0000000060 00000 n 
0000000117 00000 n 
0000000227 00000 n 
0000000729 00000 n 
trailer
<< /Size 6 /Root 1 0 R >>
startxref
800
%%EOF
`.trim();

  const base64 = btoa(unescape(encodeURIComponent(contentText)));
  return {
    base64,
    fileName: `${studentName.replace(/\s+/g, '_')}_Resume_2026.pdf`,
    size: contentText.length,
  };
}

/**
 * Creates a resume for a first-time middle schooler with NO prior experience.
 * Used to verify: "Many kids don't have experience, so We just take them in first".
 */
export function createUncertifiedNoviceResumePdf(studentName: string, targetJob: string): { base64: string; fileName: string; size: number } {
  const contentText = `
%PDF-1.4
1 0 obj
<< /Type /Catalog /Pages 2 0 R >>
endobj
2 0 obj
<< /Type /Pages /Kids [3 0 R] /Count 1 >>
endobj
3 0 obj
<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Contents 4 0 R /Resources << /Font << /F1 5 0 R >> >> >>
endobj
4 0 obj
<< /Length 500 >>
stream
BT
/F1 18 Tf
50 720 Td
(${studentName} - Middle School Candidate Profile) Tj
/F1 11 Tf
0 -30 Td
(Position Preference: ${targetJob}) Tj
0 -25 Td
(Candidate Status: First-Time Student Applicant - No Prior Work Experience) Tj
0 -20 Td
(Middle School Enrollment: Grade 7/8 in good standing) Tj
0 -20 Td
(Personal Statement: I have no prior job experience or certificates yet, but I am eager to learn,) Tj
0 -15 Td
(punctual, and ready to contribute to school daily operations on a first-come basis.) Tj
0 -25 Td
(Attendance Record: 98% Daily middle school attendance, teacher verified.) Tj
0 -20 Td
(Certificates: None yet (Uncertified Entry-Level Middle School Student).) Tj
ET
endstream
endobj
5 0 obj
<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>
endobj
xref
0 6
0000000000 65535 f 
0000000010 00000 n 
0000000060 00000 n 
0000000117 00000 n 
0000000227 00000 n 
0000000729 00000 n 
trailer
<< /Size 6 /Root 1 0 R >>
startxref
800
%%EOF
`.trim();

  const base64 = btoa(unescape(encodeURIComponent(contentText)));
  return {
    base64,
    fileName: `${studentName.replace(/\s+/g, '_')}_Novice_Resume.pdf`,
    size: contentText.length,
  };
}

/**
 * Creates a resume for a standout candidate with verified certificates & credentials.
 * Used to verify: "if any good candidate with certificates come in, then we take them in and kick the other kid out".
 */
export function createCertifiedCandidateResumePdf(
  studentName: string,
  targetJob: string,
  certificates: string[],
  skills: string[]
): { base64: string; fileName: string; size: number } {
  const contentText = `
%PDF-1.4
1 0 obj
<< /Type /Catalog /Pages 2 0 R >>
endobj
2 0 obj
<< /Type /Pages /Kids [3 0 R] /Count 1 >>
endobj
3 0 obj
<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Contents 4 0 R /Resources << /Font << /F1 5 0 R >> >> >>
endobj
4 0 obj
<< /Length 620 >>
stream
BT
/F1 18 Tf
50 720 Td
(${studentName} - Certified Candidate Portfolio & Credentials) Tj
/F1 11 Tf
0 -30 Td
(Applying for: ${targetJob}) Tj
0 -25 Td
(OFFICIAL CERTIFICATIONS & ACCREDITATIONS VERIFIED (2024-2026):) Tj
0 -20 Td
(${certificates.map(c => `* Official Certificate: ${c}`).join('  |  ')}) Tj
0 -25 Td
(Verified Operational Competencies & Relevant Experience:) Tj
0 -20 Td
(- Advanced Skills: ${skills.join(', ')}) Tj
0 -20 Td
(- 2-Year Track Record: Demonstrated leadership, flawless attendance, and peer training) Tj
0 -20 Td
(- Certificate Accreditation Authority: Middle School Science, Tech & Leadership Board) Tj
0 -25 Td
(Eligibility: Priority Certificate Placement under FiLi Preemption Guidelines) Tj
ET
endstream
endobj
5 0 obj
<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>
endobj
xref
0 6
0000000000 65535 f 
0000000010 00000 n 
0000000060 00000 n 
0000000117 00000 n 
0000000227 00000 n 
0000000729 00000 n 
trailer
<< /Size 6 /Root 1 0 R >>
startxref
800
%%EOF
`.trim();

  const base64 = btoa(unescape(encodeURIComponent(contentText)));
  return {
    base64,
    fileName: `${studentName.replace(/\s+/g, '_')}_Certified_Credentials.pdf`,
    size: contentText.length,
  };
}

export function createBlankCorruptedPdf(): { base64: string; fileName: string; size: number } {
  // Corrupted / almost empty PDF
  const corruptContent = `%PDF-1.4\n% Corrupt empty blank content with no student text\n%%EOF`;
  const base64 = btoa(corruptContent);
  return {
    base64,
    fileName: 'corrupted_blank_test.pdf',
    size: corruptContent.length,
  };
}
