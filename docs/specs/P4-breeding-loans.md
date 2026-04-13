# P4 — Breeding Loan Management

**Priority:** P4
**Dependencies:** P1 (Animal Passport — uses transfer infrastructure and on_loan status)
**Origin:** iHerp analysis — extremely common practice in the gecko hobby, currently done via handshake deals

---

## What It Is

A formal loan agreement system for when a breeder temporarily sends their animal to another breeder for pairing. Both parties can track the loan status, terms, and return. The loaned animal's status changes to "on_loan" and its passport shows the loan details. Neither party loses the record continuity — **this is not a transfer**.

## Strategic Value

**Network-effect feature.** To use this, both parties need Geck Inspect accounts. One lender inviting a borrower to track a loan is acquisition. It also differentiates from iHerp (which had this) in that we tie it into the passport system and ROI tracking.

---

## Data Model

```
BreedingLoan {
  id:                  UUID
  animal_id:           UUID → Animal  (the animal being loaned)
  lender_user_id:      UUID → User    (current owner)
  borrower_user_id:    UUID nullable → User
  borrower_email:      string         (used before they have an account)
  borrower_name:       string

  status:              enum [proposed, active, overdue, returned, cancelled]

  -- Terms
  purpose:             string  (e.g. "Pairing with my Lilly White female")
  loan_start:          date
  expected_return:     date
  actual_return:       date nullable
  stud_fee:            decimal nullable  (if lender charges a fee)
  stud_fee_paid:       boolean
  offspring_agreement: text  (e.g. "Pick of the clutch" — free text, not enforced)

  -- Condition records
  condition_on_loan:   text   (photos + notes of animal state when sent)
  condition_on_return: text   (photos + notes when returned)
  condition_photos_out: array of URLs
  condition_photos_in:  array of URLs

  -- Pairing outcome (optional — linked to breeding project)
  breeding_project_id: UUID nullable → BreedingProject

  notes:               text
  created_at:          timestamp
  updated_at:          timestamp
}
```

---

## UI Spec

### Loan Management Page (`/loans`)

- **Two tabs:** Geckos I've loaned out / Geckos I'm borrowing
- Each loan card shows:
  - Animal photo + name + passport code
  - Other party's name (lender or borrower depending on view)
  - Loan dates (start -> expected return)
  - Status badge: Active / Overdue (amber if past expected return) / Returned
  - Stud fee if applicable
  - "View details" link

### New Loan Flow (initiated from animal detail page, owner only)

"Send on loan" button -> multi-step modal:

1. **Borrower:** email input (if they have account, their name auto-resolves; if not, they receive an email invite to create account and accept the loan)
2. **Terms:** purpose (textarea), start date, expected return date, stud fee (optional), offspring agreement (textarea, plain text — not a legal document, just a record)
3. **Condition record:** photo upload + notes describing the animal's current state (weight, morph, any health notes) — this protects both parties
4. **Summary** -> "Send loan request"

On send: animal status -> "on_loan", loan status -> "proposed"
Borrower receives email -> "Accept loan" page -> loan status -> "active"
If borrower has no account: sign up flow -> return to accept

### Active Loan View

- Timeline bar (start -> expected return -> today marker)
- Overdue warning in amber if past expected return date
- "Record return" button (lender side):
  - Upload condition photos on return
  - Confirm condition notes
  - Optional: link to a BreedingProject for pairing outcome tracking
  - On confirm: animal status -> "owned", loan status -> "returned"
  - **OwnershipRecord is NOT created** (it's not an ownership change — that's the key distinction)

### Passport Page Integration

When animal status = on_loan: show a "Currently on loan" banner in the care history section with loan start date and borrower name (not full details — just enough context for buyers who see the passport to know the animal is temporarily placed)

---

## Claude Code Prompt

```
Build the Breeding Loan Management feature for Geck Inspect.

DESIGN SYSTEM: [PASTE GLOBAL DESIGN SYSTEM]

CONTEXT: Animal Passport (P1) is already built. Animals have an on_loan status.
TransferRequest infrastructure exists and can be referenced for the email invite pattern.
This feature is NOT a transfer — ownership never changes. It's a temporary placement.

DATABASE:
[PASTE BreedingLoan model]

BUILD:

1. LOANS PAGE (/loans)
Two tabs: "Loaned out" / "Borrowed". Each tab is a list of loan cards showing
animal photo, name, passport code, counterparty name, date range, status badge.
Overdue loans (past expected_return, not yet returned) get amber "Overdue" badge.

2. NEW LOAN FLOW (modal, triggered from animal detail page — owner only)
"Send on loan" button on animal detail → 4-step modal:
- Step 1: borrower email (resolve to user if exists, otherwise flag as invite needed)
- Step 2: terms — purpose, dates, stud fee (optional, decimal), offspring agreement (textarea)
- Step 3: condition record — photo upload (up to 4), weight at time of loan, health notes
- Step 4: summary → "Send loan request"
On submit: set animal.status = 'on_loan', create BreedingLoan with status 'proposed',
send email to borrower.

3. BORROWER ACCEPT PAGE (/loans/accept/:token)
Shows animal info, loan terms, lender name.
"Accept loan" CTA → loan.status = 'active'.
If no account: sign up → redirect back.

4. LOAN DETAIL PAGE (/loans/:id)
Timeline bar showing start → expected return → today.
Condition record (photos + notes from when sent).
Overdue warning banner if applicable.
Link to breeding project if set.
"Record return" button (lender only):
  - Upload condition photos on return
  - Notes on return condition
  - Optional: link to BreedingProject
  On confirm: animal.status → 'owned', loan.status → 'returned', loan.actual_return = today

5. PASSPORT INTEGRATION
On passport page: if animal.status = 'on_loan', show a subtle "Currently on loan" notice
in the care history section with loan start date and borrower name.

QUALITY: Both lender and borrower must always be able to see the loan terms clearly.
The condition record on loan-out is important — it's the shared reference point if there
is any dispute about the animal's condition on return. Make uploading photos easy.
Overdue state must be visually obvious — amber, not subtle.
```
