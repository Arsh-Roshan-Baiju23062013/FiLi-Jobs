# Firestore Security Specification for FiLi Job Application

## 1. Data Invariants
1. **Default Deny**: All unspecified collections and routes are strictly closed (`match /{document=**} { allow read, write: if false; }`).
2. **Student Identity Integrity**: A student can only create an application matching their authenticated Google email (`request.auth.token.email`). Students cannot forge submissions under another student's account.
3. **Immutability of Queue Timestamps**: Once created, application `submissionTimestamp`, `submissionTimestampMs`, and `studentEmail` cannot be altered or spoofed.
4. **Admin Access Partitioning**: Only verified administrators (`baijuqs@gmail.com` with `email_verified == true` or documented in `/admins/{adminId}`) can review, modify application statuses, approve candidates, or trigger candidate displacement.
5. **Slot Settings Protection**: Anyone can view current slot availability (`/slotSettings/global`) so students see which positions are open, but only administrators can toggle slots, close positions, or update global announcements.
6. **No Client-Side Delegation**: List queries for applications are constrained so non-admins can only list/read their own application records (`resource.data.studentEmail == request.auth.token.email`).

## 2. The Dirty Dozen Attack Payloads
1. **Unauthenticated Write**: Creating an application without an active Firebase Auth token -> **PERMISSION_DENIED**.
2. **Student Impersonation**: Authenticated user `studentA@example.com` creating an application with `studentEmail: "studentB@example.com"` -> **PERMISSION_DENIED**.
3. **Timestamp Manipulation**: Overwriting `submissionTimestampMs` with an arbitrary retroactive time to jump the FCFS queue -> **PERMISSION_DENIED**.
4. **Status Self-Promotion**: Student attempting to set `status: "Approved"` or change displacement states on their own record -> **PERMISSION_DENIED**.
5. **Slot Lockout Bypass**: Non-admin attempting to overwrite `/slotSettings/global` to reopen a closed position -> **PERMISSION_DENIED**.
6. **Denial-of-Wallet String Inflation**: Submitting a 500KB string in `studentName` or `jobId` -> **PERMISSION_DENIED** via string length limits.
7. **Document ID Path Poisoning**: Submitting invalid characters or oversized IDs in `{applicationId}` -> **PERMISSION_DENIED** via `isValidId()`.
8. **Admin Role Self-Assignment**: Non-admin writing a document to `/admins/{uid}` to elevate permissions -> **PERMISSION_DENIED**.
9. **Unverified Email Spoof**: Token containing admin email string but `email_verified: false` attempting admin mutations -> **PERMISSION_DENIED**.
10. **Shadow Field Injection**: Application payload containing arbitrary unrecognized fields (e.g. `isSuperAdmin: true`) -> **PERMISSION_DENIED** via strict schema validation.
11. **Roster Scraping**: Non-admin student listing all applications in `/applications` -> **PERMISSION_DENIED** (only matching email allowed).
12. **Malicious Displacement**: Student attempting to kick out another student by updating target's status to `Kicked Out (Displaced by Certified Candidate)` -> **PERMISSION_DENIED**.
