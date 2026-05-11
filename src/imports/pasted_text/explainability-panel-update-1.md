You are still in STRICT EXECUTION MODE.

Do not make assumptions.
Do not change calculations.
Do not change drill behavior.
Do not change layout beyond updating content inside the existing Explainability Panel.

OBJECTIVE

Replace fragmented scope language inside the Explainability Panel with one single authoritative description of what the user is currently viewing.

CHANGES TO IMPLEMENT

1. REMOVE THESE EXISTING FIELDS FROM THE EXPLAINABILITY PANEL

Remove:
- Drill Level
- Facility Scope
- View Scope

Do not remove any other fields yet.

2. ADD "CURRENT VIEW" FIELD AT THE TOP OF THE PANEL

Insert a new field at the top of the Explainability Panel:

Current View: [value]

Use these exact rules:

- At LEVEL_0:
  Current View: Facilities

- At LEVEL_1:
  Current View: Facilities > [path[0]]

- At LEVEL_2:
  Current View: Facilities > [path[0]] > [path[1]]

- At LEVEL_3:
  Current View: Facilities > [path[0]] > [path[1]] > [path[2]]

Use the current drill path values exactly as already stored and displayed elsewhere.

3. ADD "KPI SCOPE" FIELD DIRECTLY BELOW CURRENT VIEW

Add:

KPI Scope: [value]

Use these exact rules:

- At LEVEL_0:
  - if the Facility Scope control is displaying "All Facilities", then:
    KPI Scope: All Facilities
  - otherwise:
    KPI Scope: [displayed Facility Scope control value]

- At LEVEL_1:
  KPI Scope: [path[0]]

- At LEVEL_2:
  KPI Scope: [path[0]]

- At LEVEL_3:
  KPI Scope: [path[0]]

4. KEEP THESE EXISTING FIELDS

Do not change or remove these fields in this step:
- level-aware selected item field
  - Facility / Category / Vendor / Transaction
- Timeframe
- Metric
- Spend Mode
- Definitions section

5. PRESENTATION RULES

- Keep the panel plain and minimal
- Same styling as current panel
- No icons
- No badges
- No pills
- No tooltips
- No extra containers inside the panel

6. DO NOT DUPLICATE SCOPE LANGUAGE ELSEWHERE IN THE PANEL

After this change, the panel should express scope through:
- Current View
- KPI Scope

Do not reintroduce scope through additional labels.

7. DO NOT CHANGE ANYTHING ELSE

Do NOT change:
- control behavior
- KPI values
- table values
- drill state
- dataset switching
- breadcrumb
- scope label above the table
- sorting/filtering
- density controls
- table states
- layout outside the panel

8. OUTPUT

1. OLD SCOPE FIELDS REMOVED
2. CURRENT VIEW ADDED
3. KPI SCOPE ADDED
4. PANEL CONTENT PRESERVED
5. CONFIRM NO OTHER CHANGES

Do not propose next steps.
Stop after reporting changes.