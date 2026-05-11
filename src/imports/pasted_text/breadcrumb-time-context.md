# Prompt 2 - Add Time Context to Breadcrumb (Labeling Correction Only)

You are still in STRICT EXECUTION MODE.

---

## Constraints

Do not make assumptions.
Do not redesign anything.
Do not change layout, spacing, styling, hierarchy, structure, or behavior outside of the requested change.
Do not add new UI elements unless explicitly instructed.
Do not remove existing UI elements unless explicitly instructed.

---

## Objective

Add explicit **time context to the breadcrumb context line** so that users can understand the active timeframe without referencing the control bar.

This is a **labeling correction only**.
No structural, behavioral, or layout changes are allowed.

---

## Changes to Implement

1. Locate the existing breadcrumb and the context/subheader line directly beneath it.

2. Update the context line to include **timeframe information appended to the existing scope description**, separated by a pipe (`|`).

---

### Time Formatting Rules

Apply the following rules exactly based on current control state:

#### Case 1: View By = Monthly, no Period filter applied

Append:
Jan 2025 - Dec 2025

---

#### Case 2: View By = Weekly, no Period filter applied

Append:
Weeks of Jan 1, 2025 - Dec 31, 2025

---

#### Case 3: Period filter is applied (single time bucket selected)

Replace timeframe display with ONLY the selected period.

Examples:
Jan 2025
Week of Jan 1, 2025

---

#### Case 4: View By = Full Timeframe

Append:
Full Timeframe

---

### Final Format

The context line must follow this structure:

[Scope Description] | [Time Context]

Example:
Vendors within 7200 - Medical Supplies | Jan 2025 - Dec 2025

---

## Preserve

* Breadcrumb structure and styling
* Control bar behavior and content
* Table structure, columns, and filters
* Period column behavior
* All spacing, typography, and layout
* All existing logic and interactions

---

## Output

Respond with:

1. What text was updated in the context line
2. Confirmation that no layout or structural changes were made
3. Confirmation that no other elements were modified

Do not propose next steps.
Stop after reporting changes.
