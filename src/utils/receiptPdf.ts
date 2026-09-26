import { jsPDF } from 'jspdf';
import { Application } from '../types';

/**
 * Formats an ISO date string into a clean printable string.
 */
function formatReceiptDate(isoString: string): string {
  try {
    const d = new Date(isoString);
    return d.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: true,
    });
  } catch {
    return isoString;
  }
}

/**
 * Generates an official, beautifully styled, high-resolution placement receipt PDF document.
 */
export function generatePlacementReceiptPdf(application: Application): jsPDF {
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'pt',
    format: 'letter', // 612 x 792 pt
  });

  const pageWidth = 612;
  const pageHeight = 792;
  const margin = 40;
  const contentWidth = pageWidth - margin * 2;

  // --- Decorative Outer Border ---
  doc.setDrawColor(203, 213, 225); // slate-300
  doc.setLineWidth(1);
  doc.rect(margin - 10, margin - 10, contentWidth + 20, pageHeight - (margin - 10) * 2);

  doc.setDrawColor(79, 70, 229); // indigo-600 thin inner accent
  doc.setLineWidth(0.5);
  doc.rect(margin - 6, margin - 6, contentWidth + 12, pageHeight - (margin - 6) * 2);

  // --- Top Header Banner ---
  // Dark navy-indigo gradient style header block
  doc.setFillColor(30, 41, 59); // slate-800
  doc.rect(margin, margin, contentWidth, 75, 'F');

  // Accent stripe at top of header
  doc.setFillColor(79, 70, 229); // indigo-600
  doc.rect(margin, margin, contentWidth, 4, 'F');

  // School Program Title
  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(14);
  doc.text('FILI MIDDLE SCHOOL STUDENT WORK PROGRAM', margin + 16, margin + 28);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.setTextColor(199, 210, 254); // indigo-200
  doc.text('OFFICIAL PLACEMENT RECEIPT & DISBURSEMENT RECORD', margin + 16, margin + 44);
  doc.text('Academic Year 2026-2027 • Middle School Division • 1,180 Capacity Authority', margin + 16, margin + 58);

  // Top right receipt reference box
  doc.setFillColor(15, 23, 42); // slate-900
  doc.roundedRect(pageWidth - margin - 140, margin + 15, 126, 44, 4, 4, 'F');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7.5);
  doc.setTextColor(148, 163, 184); // slate-400
  doc.text('RECEIPT IDENTIFIER', pageWidth - margin - 132, margin + 29);

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9.5);
  doc.setTextColor(255, 255, 255);
  const shortId = `FL-${application.id.slice(0, 8).toUpperCase()}`;
  doc.text(shortId, pageWidth - margin - 132, margin + 46);

  let currentY = margin + 90;

  // --- Status Banner ---
  const isApproved = application.status === 'Approved';
  const isDisplaced = application.status === 'Kicked Out (Displaced by Certified Candidate)';
  const isWaitlisted = application.status === 'Waitlisted';

  let statusBg = [236, 253, 245]; // emerald-50
  let statusBorder = [16, 185, 129]; // emerald-500
  let statusText = [6, 78, 59]; // emerald-900
  let statusHeading = 'STATUS: OFFICIALLY APPROVED & COHORT ALLOCATED';

  if (isDisplaced) {
    statusBg = [255, 247, 237]; // orange-50
    statusBorder = [249, 115, 22]; // orange-500
    statusText = [154, 52, 18]; // orange-900
    statusHeading = 'STATUS: KICKED OUT (PREEMPTED BY CERTIFIED CANDIDATE)';
  } else if (isWaitlisted) {
    statusBg = [254, 243, 199]; // amber-100
    statusBorder = [245, 158, 11]; // amber-500
    statusText = [120, 53, 15]; // amber-900
    statusHeading = 'STATUS: WAITLISTED (QUEUED BY CAPACITY QUOTA)';
  } else if (!isApproved) {
    statusBg = [254, 242, 242]; // rose-50
    statusBorder = [239, 68, 68]; // rose-500
    statusText = [153, 27, 27]; // rose-900
    statusHeading = 'STATUS: DISQUALIFIED (INVALID OR MISSING RESUME)';
  }

  doc.setFillColor(statusBg[0], statusBg[1], statusBg[2]);
  doc.setDrawColor(statusBorder[0], statusBorder[1], statusBorder[2]);
  doc.setLineWidth(1.5);
  doc.roundedRect(margin, currentY, contentWidth, 32, 4, 4, 'FD');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10.5);
  doc.setTextColor(statusText[0], statusText[1], statusText[2]);
  doc.text(statusHeading, margin + 14, currentY + 20);

  // Status badge timestamp
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.text(formatReceiptDate(application.submissionTimestamp), pageWidth - margin - 14, currentY + 20, { align: 'right' });

  currentY += 44;

  // --- Section 1: Student Profile & Cohort Assignment ---
  doc.setFillColor(248, 250, 252); // slate-50
  doc.setDrawColor(226, 232, 240); // slate-200
  doc.setLineWidth(1);
  doc.roundedRect(margin, currentY, contentWidth, 80, 4, 4, 'FD');

  // Section Header
  doc.setFillColor(241, 245, 249); // slate-100
  doc.roundedRect(margin, currentY, contentWidth, 20, 4, 4, 'F');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8.5);
  doc.setTextColor(71, 85, 105); // slate-600
  doc.text('1. APPLICANT & CLASS RECORD', margin + 12, currentY + 13.5);

  const col1X = margin + 14;
  const col2X = margin + 180;
  const col3X = margin + 360;

  // Row 1
  const row1Y = currentY + 36;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7.5);
  doc.setTextColor(100, 116, 139);
  doc.text('STUDENT FULL NAME', col1X, row1Y);
  doc.text('CAMPUS EMAIL ADDRESS', col2X, row1Y);
  doc.text('CLASS & SECTION', col3X, row1Y);

  doc.setFont('helvetica', 'bold');
  const displayName = application.accountOwner === 'parent' && application.actualStudentName 
    ? application.actualStudentName 
    : application.studentName;

  doc.setFontSize(9.5);
  doc.setTextColor(15, 23, 42);
  doc.text(displayName, col1X, row1Y + 11);
  doc.text(application.studentEmail, col2X, row1Y + 11);
  doc.text(`${application.studentClass} • Sec ${application.section}`, col3X, row1Y + 11);

  // Row 2
  const row2Y = currentY + 60;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7.5);
  doc.setTextColor(100, 116, 139);
  doc.text('AUTH STATUS', col1X, row2Y);
  doc.text('APPLICATION ID', col2X, row2Y);
  doc.text('SUBMISSION TIMESTAMP', col3X, row2Y);

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8.5);
  doc.setTextColor(15, 23, 42);
  doc.text('Google Workspace Verified', col1X, row2Y + 10);
  doc.setFont('courier', 'bold');
  doc.text(application.id, col2X, row2Y + 10);
  doc.setFont('helvetica', 'normal');
  doc.text(application.submissionTimestamp, col3X, row2Y + 10);

  currentY += 92;

  // --- Section 2: Position Allocation & Credit Compensation ---
  doc.setFillColor(248, 250, 252);
  doc.setDrawColor(226, 232, 240);
  doc.setLineWidth(1);
  doc.roundedRect(margin, currentY, contentWidth, 78, 4, 4, 'FD');

  doc.setFillColor(241, 245, 249);
  doc.roundedRect(margin, currentY, contentWidth, 20, 4, 4, 'F');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8.5);
  doc.setTextColor(71, 85, 105);
  doc.text('2. POSITION ALLOCATION & STIPEND SCHEDULE', margin + 12, currentY + 13.5);

  const posRow1Y = currentY + 36;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7.5);
  doc.setTextColor(100, 116, 139);
  doc.text('ALLOCATED WORK-STUDY ROLE', col1X, posRow1Y);
  doc.text('MONTHLY STIPEND / CREDIT', col3X, posRow1Y);

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.setTextColor(30, 41, 59);
  doc.text(application.jobTitle, col1X, posRow1Y + 12);

  doc.setFontSize(11);
  doc.setTextColor(79, 70, 229); // indigo-600
  doc.text(application.payout || '200 BRAED/Month', col3X, posRow1Y + 12);

  const posRow2Y = currentY + 60;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7.5);
  doc.setTextColor(100, 116, 139);
  doc.text('PROGRAM CATEGORY: Student Leadership & Campus Operations', col1X, posRow2Y);
  doc.text('DISBURSEMENT: Credited directly to Student Account on the 1st of each month', col1X, posRow2Y + 10);

  currentY += 90;

  // --- Section 3: AI Screening, Credentials & Preemption Audit ---
  doc.setFillColor(248, 250, 252);
  doc.setDrawColor(226, 232, 240);
  doc.setLineWidth(1);
  doc.roundedRect(margin, currentY, contentWidth, 120, 4, 4, 'FD');

  doc.setFillColor(241, 245, 249);
  doc.roundedRect(margin, currentY, contentWidth, 20, 4, 4, 'F');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8.5);
  doc.setTextColor(71, 85, 105);
  doc.text('3. CREDENTIAL VERIFICATION & AUTOMATED PREEMPTION AUDIT', margin + 12, currentY + 13.5);

  let auditY = currentY + 34;

  // Attached PDF Record
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8);
  doc.setTextColor(15, 23, 42);
  doc.text('Attached Resume Document:', col1X, auditY);
  doc.setFont('helvetica', 'normal');
  const sizeKb = application.resumeFileSize ? `(${(application.resumeFileSize / 1024).toFixed(1)} KB)` : '';
  doc.text(`${application.resumeFileName || 'Official PDF Attached'} ${sizeKb} - Verdict: ${application.resumeValidity === 'valid' ? 'VALID / RECORDED' : 'GENERAL FCFS ENTRY'}`, col1X + 130, auditY);

  auditY += 16;
  // Certificates & Preemption Policy
  doc.setFont('helvetica', 'bold');
  doc.text('Certification Status:', col1X, auditY);
  doc.setFont('helvetica', 'normal');
  if (application.hasCertificates && application.certificateNames && application.certificateNames.length > 0) {
    doc.setTextColor(109, 40, 217); // purple-700
    doc.text(`VERIFIED CERTIFIED CANDIDATE: ${application.certificateNames.join(', ')}`, col1X + 130, auditY);
  } else {
    doc.setTextColor(51, 65, 85);
    doc.text('STANDARD NOVICE APPLICANT (Placed on First-Come, First-Served Basis)', col1X + 130, auditY);
  }

  auditY += 16;
  // Preemption / Displaced tracking
  if (application.displacedCandidateName) {
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(126, 34, 206);
    doc.text('Preemption Impact:', col1X, auditY);
    doc.setFont('helvetica', 'normal');
    doc.text(`Awarded slot via certificate preemption. Replaced uncertified candidate: ${application.displacedCandidateName}.`, col1X + 130, auditY);
    auditY += 16;
  } else if (application.displacedByCandidateName) {
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(194, 65, 12);
    doc.text('Displacement Audit:', col1X, auditY);
    doc.setFont('helvetica', 'normal');
    doc.text(`Preempted by incoming certified candidate: ${application.displacedByCandidateName}. Reassigned to waitlist.`, col1X + 130, auditY);
    auditY += 16;
  }

  // AI Screening Reasoning
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(15, 23, 42);
  doc.text('AI Screening Rationale:', col1X, auditY);
  auditY += 12;

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7.5);
  doc.setTextColor(71, 85, 105);
  const splitReasoning = doc.splitTextToSize(application.aiReasoning || 'Candidate evaluated against role operational guidelines.', contentWidth - 28);
  doc.text(splitReasoning.slice(0, 3), col1X, auditY);

  currentY += 132;

  // --- Section 4: FiLi Policy & Operational Terms ---
  doc.setFillColor(248, 250, 252);
  doc.setDrawColor(226, 232, 240);
  doc.setLineWidth(1);
  doc.roundedRect(margin, currentY, contentWidth, 75, 4, 4, 'FD');

  doc.setFillColor(241, 245, 249);
  doc.roundedRect(margin, currentY, contentWidth, 18, 4, 4, 'F');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8);
  doc.setTextColor(71, 85, 105);
  doc.text('4. OFFICIAL FILI MIDDLE SCHOOL WORK CHARTER TERMS', margin + 12, currentY + 12);

  let termY = currentY + 28;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7);
  doc.setTextColor(100, 116, 139);

  doc.text('• NO EXPERIENCE BARRIER: Many kids do not have work experience; they are enrolled first-come, first-served.', col1X, termY);
  termY += 10;
  doc.text('• CERTIFICATE PREEMPTION: Candidates presenting accredited youth certificates will take priority and preempt uncertified slots.', col1X, termY);
  termY += 10;
  doc.text('• INCLUSIVE FCFS ADMISSION: Applicants with no resume or unverified files are automatically placed into open general FCFS slots.', col1X, termY);
  termY += 10;
  doc.text('• MONTHLY STIPEND: 200 BRAED credits are credited every month for active performance and school community participation.', col1X, termY);

  currentY += 86;

  // --- Section 5: Official Signatures & Verification Seal ---
  doc.setDrawColor(203, 213, 225);
  doc.setLineWidth(0.75);

  const sigBoxY = currentY;
  const sigColWidth = (contentWidth - 20) / 2;

  // Left Signature: Program Coordinator
  doc.line(col1X, sigBoxY + 36, col1X + sigColWidth - 20, sigBoxY + 36);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8);
  doc.setTextColor(30, 41, 59);
  doc.text('FiLi Student Placement Coordinator', col1X, sigBoxY + 46);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7);
  doc.setTextColor(148, 163, 184);
  doc.text('Official Electronic Seal & Faculty Endorsement', col1X, sigBoxY + 55);

  // Right Signature: Student Signature
  const rightSigX = margin + sigColWidth + 20;
  doc.line(rightSigX, sigBoxY + 36, rightSigX + sigColWidth - 20, sigBoxY + 36);
  const displayNameSig = application.accountOwner === 'parent' && application.actualStudentName 
    ? application.actualStudentName 
    : application.studentName;

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8);
  doc.setTextColor(30, 41, 59);
  doc.text(displayNameSig, rightSigX, sigBoxY + 46);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7);
  doc.setTextColor(148, 163, 184);
  doc.text('Student Acknowledgment & Digital Receipt Acceptance', rightSigX, sigBoxY + 55);

  // Bottom Security / Barcode Footer
  const footerY = pageHeight - margin - 2;
  doc.setDrawColor(226, 232, 240);
  doc.setLineWidth(0.5);
  doc.line(margin, footerY - 14, pageWidth - margin, footerY - 14);

  doc.setFont('courier', 'normal');
  doc.setFontSize(6.5);
  doc.setTextColor(148, 163, 184);
  doc.text(`DOC-REF: ${application.id} | AUTH: VERIFIED_GSUITE | CREATED: ${new Date().toISOString()}`, margin, footerY);
  doc.text('FILI WORK-STUDY PLATFORM • SECURE DISBURSEMENT RECORD', pageWidth - margin, footerY, { align: 'right' });

  return doc;
}

/**
 * Downloads the placement receipt PDF and opens the native print dialog.
 * Works seamlessly in standard browsers and sandboxed iframes.
 */
export function printAndDownloadPlacementReceipt(application: Application): {
  fileName: string;
  blobUrl: string;
} {
  const doc = generatePlacementReceiptPdf(application);
  const displayNameFile = application.accountOwner === 'parent' && application.actualStudentName 
    ? application.actualStudentName 
    : application.studentName;
  const cleanStudentName = displayNameFile.replace(/[^a-zA-Z0-9]/g, '_');
  const fileName = `FiLi_Placement_Receipt_${cleanStudentName}_${application.id.slice(0, 8)}.pdf`;

  // 1. Download the PDF file directly to user's device
  doc.save(fileName);

  // 2. Also prepare print dialog via Blob URL in a hidden iframe (with fallback to new window)
  const blob = doc.output('blob');
  const blobUrl = URL.createObjectURL(blob);

  try {
    const printFrame = document.createElement('iframe');
    printFrame.style.position = 'fixed';
    printFrame.style.right = '0';
    printFrame.style.bottom = '0';
    printFrame.style.width = '0';
    printFrame.style.height = '0';
    printFrame.style.border = '0';
    printFrame.src = blobUrl;
    document.body.appendChild(printFrame);

    printFrame.onload = () => {
      setTimeout(() => {
        try {
          printFrame.contentWindow?.focus();
          printFrame.contentWindow?.print();
        } catch {
          // Fallback if iframe print is blocked in sandbox:
          window.open(blobUrl, '_blank');
        }
        // Cleanup after delay
        setTimeout(() => {
          try {
            document.body.removeChild(printFrame);
          } catch {
            // ignore
          }
        }, 60000);
      }, 500);
    };
  } catch {
    // If iframe creation fails, window.open blob
    window.open(blobUrl, '_blank');
  }

  return { fileName, blobUrl };
}
