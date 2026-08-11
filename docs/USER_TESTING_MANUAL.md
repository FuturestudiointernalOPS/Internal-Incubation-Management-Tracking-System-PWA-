# Internal Operations — Beginner User Testing Manual

---

## Quick Reference Table

| Test | User | Where | What We Are Testing | Expected Result |
|---|---|---|---|---|
| 1 | Super Admin | CRM → PEOPLE | Create test users | Users appear in list |
| 2 | Staff | Dashboard | View operations section | "Staff Operations" visible with standup/tasks |
| 3 | Staff | Stand-Up | Create weekly Stand-Up | Stand-Up submitted |
| 4 | Staff | Operations | Create personal tasks | Tasks appear below Stand-Up |
| 5 | Staff | Operations | Mark task complete | Task moves to completed, progress bar updates |
| 6 | Staff | Tasks | Assign task to same-group user | Assignment created, appears for assignee |
| 7 | Staff | Tasks | Try assign to different-group user | Assignment blocked with error |
| 8 | Staff | Stand-Up | Leave tasks incomplete | They carry forward to next week |
| 9 | Staff | Operations | Create blocker on task | Task shows "blocked", blocker visible |
| 10 | Supervisor | Operations | View supervisee tasks | Supervised tasks visible |
| 11 | Staff | Retro | Submit end-of-week Retro | Retro saved |
| 12 | Participant | Dashboard | View own operational area | Own tasks visible |
| 13 | Venture | Ventures | Test venture operations | Venture tasks/standup work correctly |
| 14 | All roles | Permissions | Try to see another user's data | Access denied (403) |
| 15 | Super Admin | Operations | View staff operations | Staff ops visible |
| 16 | Super Admin | Ventures | Try view unrelated venture | Venture data not automatically exposed |

---

## PART 1 — How to Log In and Switch Users

The staging environment includes a **Developer Tools** panel on the login page.

### Steps to Switch Between Test Users

1. Go to the **Login page**.
2. Scroll to the bottom of the page.
3. Look for the **Wrench icon** and click **"Developer Tools"**.
4. A panel expands. You will see a dropdown that says **"Select Role"**.
5. Pick the role you want (Super Admin, Staff, Participant, etc).
6. A second dropdown appears — select the specific user.
7. Click **"Impersonate"**.

> **IMPORTANT:** Always log out before switching users. Click your profile icon at the bottom-left of the sidebar → **Log Out**. Then return to the login page.

### If Developer Tools Is Not Visible

The staging environment must have `NEXT_PUBLIC_ALLOW_IMPERSONATION=true` enabled. If you don't see the Developer Tools panel, ask your developer to enable it.

### If Users Don't Exist Yet

Create them first (Part 2). If a role dropdown is empty, there are no users with that role. Create them from the Super Admin account first.

---

## PART 2 — Create Test Users (Super Admin)

### Step 1: Log In as Super Admin

1. Go to **Login** → Developer Tools → **Super Admin** → pick a user → **Impersonate**.
2. You are now on the Super Admin Dashboard.

### Step 2: Navigate to People Management

1. In the left sidebar, find the **CRM** section.
2. Click **PEOPLE** to open the contacts list.
3. You should see existing users. Look for a **"Create Contact"** or **"+"** button to add a new user.

### Step 3: Create the Staff User

Create a user with these details:

- **Full Name:** John Staff
- **Email:** `test.staff@example.com`
- **Role:** Staff
- **Group / Team:** Future Studio Staff (or create a new group named `FUTURE STUDIO STAFF`)

> **NOTE ABOUT GROUPS:** Group membership controls who can assign tasks to whom. Put test users who should work together in the SAME group. Put users who should NOT collaborate in DIFFERENT groups. Write down which group each user is in.

### Step 4: Create the Program Participant

- **Full Name:** Jane Participant
- **Email:** `test.participant@example.com`
- **Role:** Participant
- **Group:** Future Studio Cohort

### Step 5: Create the Venture User (as Founder)

- **Full Name:** David Venture
- **Email:** `test.venture@example.com`
- **Role:** Founder (or Participant)
- **Group:** GreenTech Ventures

### Step 6: Create a Second Staff User (for assignment test)

- **Full Name:** Sarah Staff
- **Email:** `test.staff2@example.com`
- **Role:** Staff
- **Group:** Future Studio Staff (SAME group as John Staff)

---

## PART 3 — Staff Complete Workflow (John Staff)

Log in as **John Staff**.

### Step 1: Open the Staff Dashboard

1. After login, you should land on the **Staff Dashboard**.
2. If not, click **DASHBOARD** in the left sidebar.
3. Scroll down. Look for the section titled **"Future Studio — Staff Operations"**.

> **If you cannot see this section:** The Unified Operations View may not be loaded. Refresh the page. If still missing, record this as a bug.

### Step 2: Understand What You See

The Operations section shows:

| Element | What It Is |
|---|---|
| **Week header** | Shows Week X, Year Y, active tasks count, blocked count, progress % |
| **Progress bar** | Orange/Green bar — fills as you complete tasks |
| **Stat cards** | Completed / Active / Blocked counts |
| **Task list** | Every task with status dot, title, expand arrow |
| **New Task button** | Orange "+ New Task" at top-right |

### Step 3: Create the Week's Stand-Up

1. In the left sidebar, click **STANDUP**.
2. You should see the Stand-Up page (`/staff/op-report`).
3. Set the week to the **current week** if not already selected.
4. Fill in:
   - **Top Priorities:** `Complete weekly reporting, Update records, Prepare presentation`
   - **Expected Deliverables:** `Weekly report, Updated participant list, Presentation deck`
   - **Projects / Tasks:** Leave this — tasks will be added separately below.
5. Click **Submit**.

**Expected:** A success message. The standup is saved.

### Step 4: Return to Dashboard and Create Tasks

1. Click **DASHBOARD** in the sidebar.
2. Scroll to the Operations section.
3. Click the orange **"+ New Task"** button.
4. Type a task title: `Prepare weekly report` and press **Enter** or click **Create**.
5. Repeat for these tasks:
   - `Update participant records`
   - `Prepare Friday presentation`
   - `Review pending applications`
   - `Check team availability for next sprint`
   - `Update knowledge base articles`
   - `Respond to partner emails`
   - `Review budget spreadsheet`

**Expected:** Each task appears in the list below with an orange status dot. The active count increases.

### Step 5: Verify Task Visibility

- All 8 tasks should be visible in the Operations section.
- Each task has a status indicator (orange = active).
- The **Active** stat card shows 8.
- The progress bar is at 0%.

### Step 6: Complete Some Tasks

1. Click the **arrow (>) ** next to `Prepare weekly report`.
2. The task expands — you see description, blockers, and action buttons.
3. Click the green **"Complete"** button.
4. Repeat for `Update participant records` and `Prepare Friday presentation`.

**Expected:**
- Completed tasks get a green dot and strikethrough text.
- They dim slightly (lower opacity).
- The **Completed** stat card now shows **3**.
- The **Active** stat card shows **5**.
- The progress bar moves to about 37%.

### Step 7: Leave Some Incomplete

Do NOT complete these tasks:
- `Review pending applications`
- `Check team availability`
- `Update knowledge base articles`
- `Respond to partner emails`
- `Review budget spreadsheet`

These 5 tasks remain active. They will be tested for carry-over in Part 6.

### Step 8: Create a Blocker

1. Find the task `Review pending applications`.
2. Expand it (click the arrow).
3. **Note:** If the current UI does not have a blocker creation button in this view, navigate to **MY TASKS** in the sidebar and find the task there. Use whatever method creates a blocker.
4. Create a blocker with:
   - **Title:** `Waiting for HR to send applicant list`
   - **Severity:** Medium
5. Save/Submit the blocker.

**Expected:**
- The task status changes from "in progress" to **"blocked"**.
- The task dot turns **red**.
- The **Blocked** stat card increases to 1.
- The blocker is listed under the task when expanded.

### Step 9: Verify in Stand-Up

1. Go back to **STANDUP** in the sidebar.
2. Look at the current week.
3. Verify that:
   - Completed tasks show correctly.
   - The blocked task shows with its blocker.
   - Incomplete tasks are visible.

---

## PART 4 — Task Assignment Test

### First, Assign a Task to Someone in the Same Group

John Staff and Sarah Staff are both in the "Future Studio Staff" group.

1. Log in as **John Staff**.
2. Navigate to **MY TASKS** or the Dashboard Operations section.
3. Find or create a task: `Prepare participant report`.
4. Assign this task to **Sarah Staff**.
   - Look for an **"Assign"** button, **assignee dropdown**, or **collaborator field**.
   - Select Sarah Staff from the list.
   - Save/Submit.
5. If the system uses a pending-accept workflow, the task shows as **"pending assignment"** until Sarah accepts.

**Expected:** The assignment is created successfully. No error message.

### Now, Log in as Sarah Staff

1. **Log out** (sidebar bottom-left → Log Out).
2. **Log in** as Sarah Staff via Developer Tools.
3. Go to the Dashboard and scroll to Operations.

**Expected:**
- The task `Prepare participant report` should appear in Sarah's task list.
- Sarah should be able to expand it.
- Sarah should be able to mark it as **in progress** or **complete**.

### Sarah Completes the Task

1. Expand `Prepare participant report`.
2. Click **"Complete"**.
3. The task moves to completed.

### Back to John Staff

1. **Log out** and **log back in** as John Staff.
2. Go to Dashboard Operations.

**Expected:** The task `Prepare participant report` now shows as **completed** in John's view (or shows Sarah as the assignee with completed status).

### Now Test: Assign to Someone in a DIFFERENT Group

1. As John Staff, try to assign a task to **Jane Participant** (who is in "Future Studio Cohort", NOT "Future Studio Staff").
2. Attempt the assignment.

**Expected:** The system should **block** this. You should see an error message like:
> `Cannot assign task outside your Contact Group.`

Or the user should not appear in the assignee dropdown at all.

> **Record this result carefully.** If the assignment is blocked, that is the CORRECT behavior. If it is allowed, that is a BUG.

---

## PART 5 — Task Carry-Over Test

This test spans multiple weeks. Use the tasks from Part 3.

### Setup (Week 1)

From Part 3, you should have:

- 3 completed tasks
- 5 incomplete tasks

### Move to Week 2

1. Stay logged in as John Staff.
2. In the Operations section, look for a **week selector** or navigation to change the week.
3. Move to **Week X+1** (next week after current).

**Expected:**
- The 5 incomplete tasks from Week 1 should **still appear**.
- They should have a **purple badge** showing their original week (e.g., `W32`).
- The 3 completed tasks should **NOT appear** as active tasks.
- You should be able to add new Week 2 tasks alongside the carried-over ones.

### Complete One Carried-Over Task in Week 2

1. Find `Check team availability for next sprint` (one of the carried-over tasks).
2. Mark it as **Complete**.

**Expected:** The task moves to completed. It should not reappear when you move to Week 3.

### Leave One Still Incomplete

1. Keep `Review budget spreadsheet` incomplete.
2. Move to **Week 3**.

**Expected:** `Review budget spreadsheet` still appears with its carryover badge updated.

### Finally Complete It

1. Mark `Review budget spreadsheet` as **Complete** in Week 3.

**Expected:** The task stops appearing in future weeks. No duplicate copies of the same task were created.

> **📋 RECORD:** Did any duplicate tasks appear? Did any completed tasks falsely reappear? Did the carryover badge track the correct original week?

---

## PART 6 — Blocker Test

### Single Blocker

Already tested in Part 3 Step 8. Verify again:

1. Create a task: `Prepare monthly report`.
2. Add a blocker: `Waiting for financial information.`
3. Confirm:
   - [ ] Blocker is attached to the correct task.
   - [ ] Task status changes to **"blocked"**.
   - [ ] The task dot turns red in the task list.
   - [ ] The blocker is visible when the task is expanded.

### Multiple Blockers

1. Add a **second blocker** to the same task: `Need sign-off from manager.`
2. Confirm both blockers appear under the task.
3. Resolve only the first blocker.
4. Confirm the task stays **"blocked"** (because the second blocker is still active).
5. Resolve the second blocker.
6. Confirm the task returns to **"in progress"** (assuming no other blockers).

### Supervisor Visibility of Blockers

1. Log in as **Super Admin** (or the person set as supervisor for the intent/task).
2. Navigate to Operations or Tasks.
3. Try to view the blockers on John's tasks.

**Expected:** Super Admin should be able to see the blockers on staff tasks within the Internal Organization context.

> **📋 RECORD:** Can Super Admin see the blocker? Can Super Admin resolve it? (Only the blocker creator should be able to resolve it — Super Admin should NOT be able to resolve blockers they didn't create.)

---

## PART 7 — Retro Test

### Submit a Retro

1. Log in as **John Staff**.
2. In the sidebar, click **RETRO**.
3. You should see the Retro page (`/staff/op-report?tab=retro`).
4. Set the week to the **current week**.
5. Fill in:

   **What went well?**
   > Completed most planned tasks for the week. Presentation was well received.

   **What did not go well?**
   > One report was delayed because of missing financial data.

   **What should improve?**
   > Earlier communication with the finance team. Set deadlines 2 days before Friday.

   **Week Status:** (select Good / Okay / Needs Improvement)

   **Carryover Items:**
   > Review budget spreadsheet (carried to next week)

6. Click **Submit** / **Save Retro**.

**Expected:** The retro is saved. A success message appears.

### Verify Retro Visibility

1. Log in as a **different staff user** (Sarah Staff).
2. Try to view John's retro.

**Expected:** Sarah should NOT be able to see John's private retro information. She should only see her own.

3. Log in as **Super Admin**.
4. Navigate to the retro/reports section.
5. Try to view John's retro.

**Expected:** Super Admin should be able to see staff retros (internal org oversight).

> **📋 RECORD:** Who can see the retro? Who cannot? Is the correct week associated with the retro?

---

## PART 8 — Venture Test

### Log in as David Venture (Founder)

1. **Log out** and use Developer Tools to log in as David Venture.
2. You should land on a Founder/Participant dashboard.
3. In the sidebar, click **MY VENTURES**.

**Expected:** You see a list of ventures. If there are none, you may need to create one (look for a **"Create Venture"** / **"+"** button).

### Create or Open a Venture

1. Either select an existing venture or create one:
   - **Name:** GreenTech
   - **Industry:** Clean Energy
   - **Stage:** MVP

2. After opening/creating, look for operational tabs or sections like:
   - **Standups**
   - **Tasks**
   - **Retros**
   - **Blockers**

> **NOTE:** The Venture detail page has its own tabs. Look for **"Standups"**, **"Tasks"**, **"Retros"**, and **"Blockers"** tabs near the top of the venture page.

### Test Venture Standup

1. Click the **Standups** tab.
2. If there's a "Submit Now" or "Add Standup" button, click it.
3. Fill in:
   - **Top Priorities:** Launch MVP landing page
   - **Expected Deliverables:** Landing page, investor pitch deck
4. Submit.

**Expected:** The standup is saved for the venture.

### Test Venture Tasks

1. Click the **Tasks** tab.
2. Look for an **"Add Task"** button.
3. Create a task: `Prepare landing page copy`.
4. Assign it to a venture team member if available.

**Expected:** Task appears in the venture's task list.

### Test Venture Visibility

1. Log out and log in as a **different user** who is NOT a member of GreenTech.
2. Try to navigate to GreenTech's venture page.

**Expected:** You should NOT be able to see GreenTech's standups, tasks, or retros unless you are a member of that venture.

---

## PART 9 — Program / Participant Test

### Log in as Jane Participant

1. Log out. Use Developer Tools to log in as Jane Participant.
2. You land on the Participant Dashboard.

### Explore the Participant Dashboard

1. In the sidebar, click **MY PROGRAMS**.
2. You should see programs you're enrolled in.
3. Click into a program.

**Expected:** You see program details, progress, assignments, or rituals.

### Test Participant Rituals

1. Look for a **Rituals** section or tab.
2. Try to submit a **Standup** or **Check-in**.
3. Fill in the form and submit.

**Expected:** The ritual is submitted and appears in your history.

### Test Participant Visibility

1. Try to access the Staff Dashboard (`/staff`).
2. Try to access admin pages (`/admin`).

**Expected:** You should NOT be able to see staff data or admin pages. You may be redirected or see an error.

> **📋 RECORD:** Can the Participant see staff dashboards? Can they see other participants' data? Can they access admin areas?

---

## PART 10 — Visibility & Permissions Test

For each user role, test these scenarios. Record YES or NO in the table.

### Visibility Test Table

| # | User Role | What to Test | Expected | Actual (YES/NO) |
|---|---|---|---|---|
| V1 | Staff (John) | View own tasks in Operations | YES | |
| V2 | Staff (John) | View Sarah's personal tasks | NO | |
| V3 | Staff (John) | View task assigned TO John | YES | |
| V4 | Staff (Sarah) | View task assigned BY John | YES (the task itself) | |
| V5 | Staff (Sarah) | View John's full task list | NO | |
| V6 | Participant (Jane) | View own program work | YES | |
| V7 | Participant (Jane) | View staff dashboard (`/staff`) | NO | |
| V8 | Participant (Jane) | View admin pages (`/admin`) | NO | |
| V9 | Venture (David) | View own venture tasks | YES | |
| V10 | Venture (David) | View another venture's tasks | NO | |
| V11 | Super Admin | View staff operations | YES | |
| V12 | Super Admin | View all tasks in internal org | YES | |
| V13 | Super Admin | Auto-see unrelated venture data | NO (should NOT auto-see) | |
| V14 | Unauthenticated | Access `/staff` directly (while logged out) | NO (redirect to login) | |

### How to Test Each

1. **Log in** as the specified user.
2. **Navigate** to the page or section being tested.
3. Try to view data that belongs to another user.
4. Record whether access is **granted** or **denied**.

> **HOW TO TRY VIEWING ANOTHER USER'S DATA:** Look at the URL. If you see `?user_id=SOMEONE` or a task number in the URL, try changing it. If the system is secure, you should get an error or empty result — not the other user's data.

---

## PART 11 — Super Admin Oversight

### Log in as Super Admin

### 1. Internal Organization Operations

1. In the sidebar, go to **OPERATIONS** → **TASKS**.
2. You should see all internal staff tasks.
3. Go to **OPERATIONS** → **BLOCKERS**.
4. You should see all blockers across internal staff.

**Expected:** Super Admin can manage/oversee internal organization operations.

### 2. Venture Separation

1. Try to view venture-specific tasks from a venture you are NOT a member of.
2. Navigate to **VENTURES** in the sidebar.
3. Click into a venture you did NOT create or join.

**Expected:** Super Admin may see venture metadata (name, status) but should NOT automatically see venture operational data (standups, tasks, retros) unless explicitly added as a venture member.

> **📋 RECORD:** Document what Super Admin CAN and CANNOT see. Does the system properly separate Internal Organization from Venture operations?

---

## PART 12 — Bug Reporting Format

Whenever something fails, write it down like this:

---

### BUG TITLE
Short, clear description of the problem.

### USER / ROLE
Example: Staff — John Staff

### WHERE I WAS
Example: Sidebar → DASHBOARD → scrolled to Operations

### WHAT I WAS TRYING TO DO
Example: I was trying to create the new week's Stand-Up and expected 3 tasks from last week to appear.

### WHAT I DID (Step by Step)
1. Clicked DASHBOARD.
2. Scrolled to Operations section.
3. Changed week to next week.
4. Looked at the task list.

### EXPECTED RESULT
The 3 incomplete tasks from last week should appear with a carryover badge.

### ACTUAL RESULT
No previous tasks appeared. Only the new week's empty state.

### RESULT
FAIL

### SCREENSHOT
Attach if possible.

---

## PART 13 — Final Test Report

After completing all tests, fill in this summary:

| Area | PASS | FAIL | Notes |
|---|---|---|---|
| User creation / login | | | |
| Staff Stand-Up | | | |
| Task creation | | | |
| Task assignment (same group) | | | |
| Task assignment (blocked cross-group) | | | |
| Task assigned appears in assignee standup | | | |
| Task carry-over | | | |
| Task complete stops carry-over | | | |
| Blockers create/resolve | | | |
| Multiple blockers | | | |
| Retro submit | | | |
| Retro visibility | | | |
| Participant operations | | | |
| Venture operations | | | |
| Venture context isolation | | | |
| Super Admin oversight | | | |
| Super Admin venture separation | | | |
| Permission: staff can't see other staff | | | |
| Permission: participant can't see staff | | | |
| Permission: venture can't see other venture | | | |

### Summary

| Metric | Count |
|---|---|
| Total Tests | |
| Passed | |
| Failed | |
| Critical Bugs | |
| Minor Bugs | |

### Overall Result: PASS / FAIL / BLOCKED

---

## ⚠️ NOT CURRENTLY AVAILABLE

The following features are mentioned in the specification but may not be fully available in the current UI. If you cannot find them, mark the test as **"NOT AVAILABLE"** and move on:

- **Intent creation / management** — The Intent API exists but a front-end Intent management page may not be available yet. If you cannot find "Intents" in the sidebar or dashboard, it is not yet built.
- **Direct blocker creation from the Operations view** — You may need to use the **MY TASKS** page or the **Staff Op-Report** page to create blockers. The Operations view shows blockers but may not have a create button yet.
- **Supervisor-specific dashboard** — If there is no separate supervisor view, use the Super Admin account for oversight testing.

---

**Begin testing from the login page. Good luck!**
