You are still in STRICT EXECUTION MODE.

Do not make assumptions.
Do not modify any controls other than what is explicitly described.
Do not change layout, styling, or behavior beyond what is required.

You are now activating the Metric control.

OBJECTIVE

Make the Metric control functional so the report can switch between:

- Dollars
- PPD

This change must affect:
- KPI values
- table values

It must NOT affect:
- drill structure
- dataset switching
- breadcrumb
- scope label
- other controls

CHANGES TO IMPLEMENT

1. ACTIVATE METRIC CONTROL

Convert the Metric control from display-only into a simple toggle between:

- Dollars (default)
- PPD

Requirements:
- clicking toggles between the two values
- only these two values exist
- no dropdown
- no additional options

2. ADD METRIC STATE

Add a new state:

metric: "dollars" | "ppd"

Default:
- "dollars"

This state must be accessible to:
- KPI calculations
- table rendering

3. DEFINE TEMPORARY PPD TRANSFORMATION

For this prototype only, define PPD values using a fixed divisor:

ppdValue = value / 100

Apply this to:
- budget
- consumed
- remaining
- variance

This is temporary scaffolding.
Do not explain it in the UI.

4. TABLE VALUE SWITCHING

When metric === "dollars":
- display existing numeric values

When metric === "ppd":
- display transformed values using ppdValue

Do not change:
- column labels
- column order
- editability

5. KPI VALUE SWITCHING

KPI values must follow the same rule:

When metric === "dollars":
- use original totals

When metric === "ppd":
- use transformed totals (divide by 100)

Variance % remains unchanged (it is already relative).

6. FORMATTING

- Dollars:
  - whole numbers
  - no decimals required

- PPD:
  - allow one decimal place
  - example: 12.3, -4.5

Do not add units or suffixes yet.

7. PRESERVE EVERYTHING ELSE

Do NOT change:
- drill state
- dataset switching
- breadcrumb
- scope label
- other controls
- sorting/filtering behavior
- table structure
- view states

8. OUTPUT

After implementing, return:

1. METRIC CONTROL ACTIVATED
2. METRIC STATE ADDED
3. TABLE VALUE SWITCHING CONFIRMED
4. KPI VALUE SWITCHING CONFIRMED
5. CONFIRMATION THAT NO OTHER BEHAVIOR CHANGED

Do not propose next steps.
Stop after reporting changes.