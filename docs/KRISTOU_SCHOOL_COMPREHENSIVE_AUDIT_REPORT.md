# KRISTOU SCHOOL — COMPREHENSIVE ARCHITECTURAL, CODE, AND DOMAIN AUDIT REPORT

**Date:** 2026-11-19  
**Audit Scope:** Read-Only Audit & Inspection of Codebase, Dependencies, Domain Ownership, Features, Functions, Missing Backend Integrations, and Remediation Roadmap.  
**Target Repository:** `funmarket/KRISTOUSCHOOL`  
**Application Architecture:** React 19 / TypeScript SPA (Vite) + Supabase (PostgreSQL, RLS, RPCs, Edge Functions) + Tailwind CSS v4.

---

## 1. EXECUTIVE SUMMARY

Kristou School is a dedicated, multi-role school management platform designed around strict domain boundaries (People, Academics, Attendance, Assessment, Enrollment, Family, Notes, and Governance). 

Following the S1/S2 corrections (which established authorized school-wide student search RPCs `list_school_students` and `get_school_student_identity`, corrected Teacher vs. administrative navigation, eliminated fabricated Recharts performance data in favor of an honest multilingual empty state, resolved navigation origin tracking for Back buttons, and hardened actor-switch data isolation), this comprehensive audit evaluates the current state of the application. 

While core administrative classes, class rosters, attendance registers, parent notes quotas, telegram visitor linking, and role-based homepages are robustly implemented and verified against strict test suites, several backend contracts remain unlinked or stubbed, and several functional domains (such as full academic grading, document uploads, and automated rollover) remain pending complete backend-frontend integration.

---

## 2. DEPENDENCIES & RUNTIME ENVIRONMENT AUDIT

### A. Core Dependencies (`package.json`)
* **React 19 (`react`, `react-dom`):** Modern functional component architecture with Context API and custom hooks.
* **Supabase Client (`@supabase/supabase-js`):** Official SDK for database queries, RPC invocations, and Auth session management.
* **Icons (`lucide-react`):** Consistent UI iconography across navigation, actions, and status indicators.
* **Build Tools (`vite`, `@tailwindcss/vite`, `typescript`):** Fast client compilation and Tailwind v4 styling (`@import "tailwindcss";`).
* **Cleaned Dependency Tree:** Unused visualization packages (`recharts`) introduced during experimental mock charts have been removed to maintain zero dependency bloat.

### B. Environment & Security Boundaries
* Client configuration enforces `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY`.
* Server-side service role secrets remain strictly out of client bundles.
* RLS policies and PL/pgSQL security definer RPCs enforce least-privilege access control.

---

## 3. DOMAIN OWNERSHIP STRUCTURE & ARCHITECTURAL INTEGRITY

In accordance with `docs/CANONICAL_MODEL.md` and `structure.md`, domain ownership is strictly isolated:
1. **Identity & Auth:** Supabase Auth owns credentials and sessions. Username/email sign-in with NFC/Unicode normalization is enforced (AUTH-LOGIN-02).
2. **People:** Canonical `students` table owns permanent pupil identities, student codes, full names, and status.
3. **Academics:** `academic_years`, `school_classes`, `student_class_memberships`, and `teacher_class_assignments` own academic structure and rosters.
4. **Attendance:** `src/lib/attendance/*` and associated tables own daily attendance registers, submission states, and auditing.
5. **Enrollment:** `enrollment_applications` owns admission requests and review workflows.
6. **Family:** `parent_child_links` owns verified guardian-pupil associations.
7. **Parent Notes:** Bounded quota controller (`parentNotesBoundary.ts`) enforces 11 notes/day quotas, 08:00–18:00 Africa/Tunis windows, and Teacher assignment pairing.
8. **Governance:** Role assignments (`APP_ADMIN`, `ADMINISTRATIVE_PERSONNEL`, `MANAGER`, `TEACHER`, `PARENT`, `STUDENT`, `SCHOOL_STAFF`) and `manager_capability_grants` govern UI and server permissions.

---

## 4. CURRENT FUNCTIONAL INVENTORY & VERIFIED CAPABILITIES

* **Role Homepages & Navigation:** 8 distinct homepages with role-specific shortcuts and access guards (`homepageAccess.ts`).
* **Classes & Rosters:** Academic-year filtering, class creation with capacity/room controls, operation gates, and class roster inspection.
* **Students Directory & Dossier:** Server-backed school-wide pupil search (`list_school_students`), academic-year/class/status filters, pagination, and administrative student identity detail reader (`get_school_student_identity`).
* **Teacher T1 & T2:** Assigned class browsing and Teacher-scoped `StudentOverviewPanel`.
* **Attendance:** Daily attendance marking, register submission, and student attendance history panels.
* **Parent Notes & Messaging:** Quota-protected parent notes, class community Q&A, and direct messaging threads.
* **Telegram Visitor Linking:** Secure signed initData verification, one-time challenge claiming, and linked-account re-entry without session duplication.

---

## 5. CURRENT ISSUES & MISSING BACKEND / FRONTEND CAPABILITIES

### A. Pending Backend Implementations (Codex / Supabase Domain)
1. **Assessment & Grading Schema (`GRD-01` through `GRD-04`):**
   - *Current State:* Database contains assessment tables/stubs, but full term grade entry, coefficients, weighted averages, and report card publication RPCs (`get_student_report_card`, `submit_student_grades`) are not yet deployed or wired to the frontend.
   - *Impact:* Academic performance graphs and report cards remain unpopulated, hence the honest multilingual unavailable state.
2. **Private Document Storage (`MED-01` / `F3-C1`):**
   - *Current State:* Enrollment and pupil profile document attachments (birth certificates, medical records) lack a fully wired Supabase Storage bucket policy and frontend upload manager.
   - *Impact:* Document checklists are view-only.
3. **Automated Academic Rollover & Transfer Workflows (`YEAR-01` / `F2-A7`):**
   - *Current State:* Multi-year rollover and student transfer state transitions between academic years require manual database intervention rather than an administrative wizard.

### B. Minor Frontend Polish & Edge Cases
1. **Focus Management on Deep Links:** While Back navigation now successfully restores class roster context or students directory pagination, keyboard focus ring restoration after deep modal dismissal can be further polished across mobile viewports.
2. **Offline Resilience:** PWA offline caching and service worker sync for attendance drafts are structured but require expanded background sync testing under intermittent network conditions.

---

## 6. COMPREHENSIVE REMEDIATION & IMPLEMENTATION PLAN

To achieve 100% production readiness across all approved master criteria, follow this phased implementation roadmap:

### Phase 1 — Assessment & Grading Backend Integration (`GRD-01` to `GRD-04`)
* **Step 1:** Establish secure migration for assessment periods (Trimesters), subjects, grading scales (0–20), and weighted coefficients.
* **Step 2:** Implement PL/pgSQL RPCs for grade entry (`upsert_student_assessment`), review, and report card publication with strict Teacher/Owner RLS checks.
* **Step 3:** Wire frontend assessment tab in `StudentsManagementView` to consume the new assessment RPCs with reactive charts.

### Phase 2 — Private Document Storage & Management (`MED-01`)
* **Step 1:** Provision secure Supabase Storage buckets (`student-documents`) with row-level bucket policies tied to `students` and `parent_child_links`.
* **Step 2:** Implement multipart upload and signed URL retrieval helpers in `schoolOperations.ts`.
* **Step 3:** Add administrative document review UI to the student dossier.

### Phase 3 — Academic Rollover & Transfer Wizard (`YEAR-01`)
* **Step 1:** Implement migration for academic year promotion and class rollover rules.
* **Step 2:** Build administrative wizard for year-end student transition processing.
* **Step 3:** Verify historical retention of past memberships in `student_class_memberships`.

---

## 7. CONCLUSION
The Kristou School application codebase is architecturally sound, secure, and rigorously tested in its core operational domains (Auth, Classes, Students Read APIs, Attendance, and Parent Notes). By executing the phased remediation plan above, the remaining assessment and document storage domains will reach full parity with the core product specification.
