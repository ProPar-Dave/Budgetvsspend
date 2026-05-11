You are still in STRICT EXECUTION MODE.

Do not make assumptions.
Do not add new functionality.
Do not change calculations or data behavior.
Do not modify controls other than what is explicitly described.

You are now improving clarity for the active Metric (Dollars vs PPD).

OBJECTIVE

Make it immediately clear to the user whether they are viewing:

- Dollars
or
- PPD

This must be visible in:
- table column labels
- KPI labels

Do not change any calculations.
Do not change any interactions.

CHANGES TO IMPLEMENT

1. UPDATE TABLE COLUMN LABELS

When metric === "dollars":
- keep labels exactly as they are:
  - Budget
  - Consumed
  - Remaining
  - Variance

When metric === "ppd":
- update labels to:

  - Budget (PPD)
  - Consumed (PPD)
  - Remaining (PPD)
  - Variance (PPD)

Do not change:
- Name
- Variance %

Do not add new columns.

2. UPDATE KPI LABELS

When metric === "dollars":
- keep labels:
  - Total Budget
  - Total Consumed
  - Total Remaining
  - Total Variance

When metric === "ppd":
- update labels to:

  - Total Budget (PPD)
  - Total Consumed (PPD)
  - Total Remaining (PPD)
  - Total Variance (PPD)

Do not change:
- Variance %

3. DO NOT ADD UNITS OR SYMBOLS

Do NOT:
- add "$"
- add "/day"
- add tooltips
- add explanations

Only update labels with "(PPD)".

4. PRESERVE EVERYTHING ELSE

Do NOT change:
- metric toggle behavior
- calculations
- formatting
- drill behavior
- breadcrumb
- scope label
- other controls
- sorting/filtering
- layout
- styling beyond label text

5. OUTPUT

After implementing, return:

1. TABLE LABELS UPDATED
2. KPI LABELS UPDATED
3. CONFIRMATION THAT METRIC BEHAVIOR DID NOT CHANGE
4. CONFIRMATION THAT NO OTHER BEHAVIOR CHANGED

Do not propose next steps.
Stop after reporting changes.