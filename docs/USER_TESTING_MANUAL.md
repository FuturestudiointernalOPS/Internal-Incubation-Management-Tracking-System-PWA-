# Future Studio Staff Onboarding — User Testing Manual

**Who this is for:** Someone testing this feature for the first time. No prior knowledge needed.

**What you are testing:** The complete journey of a person applying to join Future Studio — from opening a form to logging into the platform as an approved staff member.

---

## BEFORE YOU START — What You Need

Get these from your team before you begin:

1. **The Form link** — a URL like `https://...your-staging-url.../s/abc123`
2. **An email inbox** you can check — you will use this as the test person's email
3. **Super Admin login** — email and password

Open **two browser windows:**

- **Window A (Incognito / Private mode):** You will use this as the "Public User" — the person filling the form.
- **Window B (Normal mode):** You will use this as the "Super Admin" — the person reviewing and approving.

---

## QUICK REFERENCE — Who Does What

Use this table to know which role to use for each step, which browser window, and which sidebar to look at.

| Step | Who | Window | Sidebar to use | What to click |
|------|-----|--------|----------------|---------------|
| 1 | Public User | A | None (just open the link) | Open the Form URL |
| 2 | Public User | A | None | Fill every field |
| 3 | Public User | A | None | "Submit Final Response" button |
| 4 | Super Admin | B | Main sidebar (dark, left edge, has logo) | Login with admin credentials |
| 5 | Super Admin | B | Main sidebar → **CRM** (expand it) | **FORMS** (under CRM) |
| 6 | Super Admin | B | Forms sidebar (has orange icon, says "Forms") | **Runs** |
| 7 | Super Admin | B | Forms sidebar → Runs page | Click the active run name |
| 8 | Super Admin | B | Forms sidebar → Runs page | **Review** button on the submission row |
| 9 | Super Admin | B | Review panel (overlay) | Select "✓ Approve" → "Submit Review" |
| 10 | Public User | A | None (check email inbox) | Open activation email |
| 11 | Public User | A | None | Click the activation link/button |
| 12 | Public User | A | None | Type password → "Set Password & Activate Account" |
| 13 | Public User | A | None | Login with new credentials |
| 14 | Super Admin | B | Main sidebar → **CRM** (expand) → **PEOPLE** | Search for user, open profile |
| 15 | Super Admin | B | Main sidebar → **CRM** → **FORMS** → Forms sidebar → **Runs** | Open run, find submission, click **Full** |
| 16 | Public User | A | None | Try to login with unapproved email |

---

## THE SCENARIO

You are pretending to be a new person who wants to join Future Studio as a staff member. You fill out a form. A Super Admin reviews your application and approves it. You then receive an email to set up your account, create a password, and log in.

---

## Step 1 — Open the Form

**Use:** Window A (Incognito)

**Who:** Public User

**What to do:**

Take the Form link your team gave you. Paste it into the address bar and press Enter.

**How to know you're in the right place:**

You should see a dark page with a form on it. At the top is a form title — something like a person's name or a program name. Below the title it says: *"Please complete the required details below."*

If the form has a yellow-bordered box at the top asking for your name and email, that's normal — it means you opened the form as a public visitor without a tracking link.

**What to check:**
- The page loaded completely (no spinning loader forever).
- You can see input fields to type into.

**Result:** PASS / FAIL

---

## Step 2 — Fill in the Form

**Use:** Window A (Incognito)

**Who:** Public User

**What to do:**

Fill in every field. Use this test information so you can recognise it later:

- **Full Name:** `Samuel Adebayo`
- **Email:** Use a real email address you can check. Example: `samuel.test@example.com`
- **Phone:** `+229 90 84 78 20`
- Fill every other field you see. Required fields are marked with a red star (*).

**What to check:**
- Every field lets you type.
- Required fields show a red asterisk.
- No error messages appear while typing.

**Result:** PASS / FAIL

---

## Step 3 — Submit the Form

**Use:** Window A (Incognito)

**Who:** Public User

**What to do:**

Scroll to the bottom of the form. Click the button labelled **"Submit Final Response."**

**What to check — Success Screen:**

The page changes. You should now see:

- A green checkmark icon in a circle.
- The heading **"Submission Received."**
- A message below it.

Now look at the message carefully. You need to check three things:

> **Check A:** Is your test name shown correctly? If you entered `Samuel Adebayo`, the message should show that name — NOT `{{submitter_name}}` or `{{name}}` or anything inside curly braces.

> **Check B:** Are there any curly-brace placeholders visible at all? Like `{{something}}`? There should be **NONE.** If you see anything like `{{form_name}}` or `{{group_name}}` in curly braces, that is a bug — report it.

> **Check C:** Does the message read like a real sentence? It should be a message thanking you and telling you what to expect next. If the message is the default fallback, it will say: *"Thank you! Your response has been recorded."*

**Result:** PASS / FAIL

---

## Step 4 — Switch to Super Admin and Log In

**Use:** Window B (Normal)

**Who:** Super Admin

**What to do:**

1. Go to the login page. (The URL is usually your staging URL with `/login` at the end.)
2. Type the Super Admin email.
3. Type the Super Admin password.
4. Click the login button.

**What you should see:**

- The page changes. You are now on a dashboard.
- At the very top-left, you see the **Future Studio logo** (or an orange icon if the sidebar is collapsed).
- On the left side of the screen is a **dark vertical sidebar** — this is your main navigation.

**How to understand the sidebar:**

The sidebar is the dark column on the left edge of the screen. It has a logo at the top. Below the logo, there is a small grey label that says **"MAIN OPERATIONS."** Under that label, there are several menu items in ALL CAPS. Each one has an icon next to it. Some have a small arrow (chevron) on the right side — these can be clicked to expand and show more options underneath.

**Result:** PASS / FAIL

---

## Step 5 — Navigate to the Forms Section

**Use:** Window B (Normal)

**Who:** Super Admin

**Where to look:**

Look at the left sidebar. Find the menu item labelled **"CRM."** It has a people/users icon next to it and a small downward arrow (chevron) on the right.

**What to do:**

1. **Click on the word "CRM"** in the sidebar. This expands a list of sub-items below it.

   The sub-items appear indented underneath CRM. You should see:
   - DASHBOARD
   - PEOPLE
   - TIMELINE
   - DUPLICATES
   - PENDING APPROVALS
   - BULK IMPORT
   - **FORMS**
   - MESSAGES
   - ANNOUNCEMENTS

2. **Click on FORMS** (the one inside the CRM menu, not anywhere else).

**What happens:**

The entire page changes. You are now in the **Forms section.** This section has its own sidebar — it's similar to the main one but narrower and only shows Forms-related items.

**How to recognise the Forms sidebar:**

- At the top-left of this new sidebar, you see a small orange square icon and the word **"Forms."**
- Below that, there are three items: **Dashboard**, **Forms**, and **Runs.**
- At the very top of the main content area (not the sidebar), there's a thin dark bar with a small link that says **"← Back to CRM"** — this confirms you are inside the Forms section.

**Result:** PASS / FAIL

---

## Step 6 — Open the Runs Page

**Use:** Window B (Normal)

**Who:** Super Admin

**Where to look:**

Look at the left sidebar (the Forms sidebar — the narrower one). You see three items: Dashboard, Forms, and Runs.

**What to do:**

**Click on "Runs"** in this sidebar.

**What you should see:**

The main area now shows a list of form runs. Each run is a row or card showing:
- A name
- A status badge (Draft, Active, or Closed)
- Some numbers (submissions count, etc.)

**What to do next:**

Find the run that matches the form the test user submitted in Step 3. The status should say **"Active"** (shown in green).

**Click on the run's name** to open it.

**What happens:**

The page changes to show details for that specific run — submission counts, a table of responses, and filter tabs.

**Result:** PASS / FAIL

---

## Step 7 — Find the Test User's Submission

**Use:** Window B (Normal)

**Who:** Super Admin

**Where to look:**

You are now on the run detail page. Below the run name, you should see a row of small stat boxes:

| Total | Submitted | Approved | Rejected | Revision | Drafts |

Below the stat boxes is a **table** listing all the submissions people have sent.

**What to do:**

Look through the table rows. Each row shows:
- The submitter's name
- Their status (Submitted / Approved / Rejected / Revision / Draft)
- The date they submitted
- Some action buttons on the right

Find the row with the name **"Samuel Adebayo"** (or the name you entered in Step 2).

If there are many submissions, look at the **Submitted** stat box — click it to filter and show only submitted (not yet reviewed) responses. This makes it easier to find your test submission.

**What to check:**
- The name and email you entered in Step 2 appear in the table.
- The status shows **"Submitted"** (blue).

**If you cannot find the submission**, something went wrong in Step 3 — the form may not have saved. Report this as a bug.

**Result:** PASS / FAIL

---

## Step 8 — Open the Review Panel

**Use:** Window B (Normal)

**Who:** Super Admin

**Where to look:**

In the table row for Samuel Adebayo, look at the right side. You should see small buttons. One of them says **"Review."** It is orange-coloured.

**What to do:**

**Click the "Review" button.**

**What happens:**

A panel slides open (or appears as an overlay) — this is the **Review panel.** It shows:

- The submitter's name at the top: **"Samuel Adebayo"**
- A section showing all the answers the person submitted — each field label and the value they entered
- If scoring is enabled, a score breakdown
- An activity timeline (may be empty if this is the first review)
- At the bottom: controls for making a decision

**What to check — The Submitted Answers:**

Scroll through the answers section. Verify that **every piece of information you typed in Step 2 appears here:**

- Full Name: `Samuel Adebayo`
- Email: the email you used
- Phone: the phone number you entered
- Any other fields you filled

If any answer is missing, incorrect, or cut off, report it as a bug.

**Result:** PASS / FAIL

---

## Step 9 — Approve the Person

**Use:** Window B (Normal)

**Who:** Super Admin

**Where to look:**

Inside the Review panel, scroll to the bottom. You should see:

- A dropdown menu (decision selector)
- A text box labelled **"Public Comment"** (with a note saying "visible to submitter")
- A text box labelled **"Internal Note"** (with a note saying "private")
- Two buttons: **Cancel** and **Submit Review**

**What to do:**

1. Click the dropdown at the top of the decision area. You should see these options:
   - ✓ Approve
   - ✗ Reject
   - ↻ Request Revision
   - ↑ Escalate
   - → Reassign

2. **Select "✓ Approve."**

3. In the **Public Comment** box, type: `Welcome to the team!`

4. Leave the **Internal Note** box empty.

5. Click the **"Submit Review"** button (the orange one on the right).

**What you should see:**

- A small notification appears briefly at the bottom of the screen saying **"Review submitted."**
- The Review panel closes.
- Back in the submission table, the row for Samuel Adebayo now shows the status **"Approved"** (in green) instead of "Submitted."

**What to check:**
- No error message appeared.
- The status visibly changed to Approved.
- The row is still there — it was not deleted.

**Result:** PASS / FAIL

---

## Step 10 — Check the Activation Email

**Use:** Window A (Incognito) — or open your email inbox

**Who:** Public User

**What to do:**

Open the inbox for the email address you used in Step 2 (for example: `samuel.test@example.com`). Check both the inbox and the spam/junk folder.

**What you should look for:**

You should receive **one or two emails** from the system:

1. **A decision notification** — this tells you that your application was approved. The subject might say: *"Your application has been approved"* or something similar.

2. **An activation email** — this contains a link or button to set up your password. The subject might say: *"Welcome to ImpactOS — Set Your Password"* or *"You're invited to ImpactOS."*

**What to check:**
- At least the activation email arrived.
- The activation email contains a clickable button or link (usually orange).

**Note for staging environments:** If your staging server does not actually send emails, ask your developer to confirm the email was queued or to provide the activation link directly.

**Result:** PASS / FAIL

---

## Step 11 — Open the Activation Link

**Use:** Window A (Incognito)

**Who:** Public User

**What to do:**

In the activation email, click the orange button (or click the link below it).

**What happens:**

A new page opens. This is the **password setup page.**

**How to recognise the password setup page:**

- At the top, you should see the **Future Studio logo** or the **ImpactOS logo** (orange text: "Impact" in orange + "OS" in white).
- Below the logo, an orange shield icon inside a rounded box.
- The heading says: **"Set Your Password"** or **"Activate Account."**
- Your name is displayed: **"Welcome, Samuel Adebayo"** (or whatever name you used).
- Your email is shown below your name.
- Two password fields: **"Create Password"** and **"Confirm Password."**
- A button: **"Set Password & Activate Account"** or **"Activate Account."**

**What to check:**
- The name shown is correct (matches what you entered in Step 2).
- The email shown is correct.

**Result:** PASS / FAIL

---

## Step 12 — Create the Password

**Use:** Window A (Incognito)

**Who:** Public User

**What to do:**

1. In the **"Create Password"** field, type a password. Make it at least 6 characters. Use something you will remember. Example: `TestPass123`

2. In the **"Confirm Password"** field, type the exact same password again.

3. Click the button: **"Set Password & Activate Account"** (or "Activate Account").

**What you should see:**

- The page changes to a success screen.
- A green checkmark icon appears.
- The heading says: **"Account Activated"** or **"Password Set Successfully."**
- A message says your account is active and you can log in.
- There may be a button: **"Go to Login"** — or you may be automatically redirected.

**What to check:**
- No error message appeared (especially no "Passwords do not match" or "Password must be at least X characters").
- The success message is clear.

**Result:** PASS / FAIL

---

## Step 13 — Log In as the New User

**Use:** Window A (Incognito)

**Who:** Public User (now a real user)

**What to do:**

1. Go to the login page. If you were redirected automatically, you are already there. If not, go to the login URL.
2. Enter the email you used in Step 2 (for example: `samuel.test@example.com`).
3. Enter the password you just created in Step 12 (for example: `TestPass123`).
4. Click the login button.

**What you should see:**

- The page changes — you are now logged in.
- You arrive at a dashboard page.
- You do NOT see the Super Admin sidebar (no Settings, Security, Audit Logs, etc.).
- Instead, you see a simpler sidebar with staff-appropriate sections.

**What to check:**
- You successfully logged in. No error like "Access Denied" or "Invalid credentials."
- The dashboard looks different from the Super Admin dashboard — you have fewer menu options.

**Result:** PASS / FAIL

---

## Step 14 — Confirm Future Studio Group Membership

**Use:** Window B (Normal)

**Who:** Super Admin

**Where to look:**

You are on the main Super Admin dashboard. Look at the left sidebar (the wide one with the logo). Find **"CRM"** and click it to expand. Then click **"PEOPLE"** (the second item under CRM).

**What to do:**

1. You are now on the PEOPLE page — a list of contacts.
2. At the top of the page, there should be a **search bar.** Click inside it.
3. Type the test user's name: `Samuel Adebayo` (or the email you used).
4. Press Enter or wait for results to filter.

The list should now show only one person: Samuel Adebayo.

5. **Click on the person's name or row** to open their contact profile.

**What to check — In the profile:**

- The person's name, email, and phone match what you entered in Step 2.
- The **Group** (or group name) field shows **"Future Studio"** (or the actual group name your form is assigned to).
- The **Status** field shows **"active"** or **"approved."**

**Result:** PASS / FAIL

---

## Step 15 — Return to Forms and Verify the Original Response

**Use:** Window B (Normal)

**Who:** Super Admin

**Where to look:**

You are on the PEOPLE page. Look at the left sidebar.

**What to do:**

1. Click **"CRM"** to expand the menu (if it is not already open).
2. Click **"FORMS"** (inside the CRM menu).

**What happens:**

You are back in the Forms section. The sidebar on the left now shows the Forms sub-sidebar (with Dashboard, Forms, Runs).

3. In the Forms sidebar, click **"Runs."**
4. Find the same run from Step 6 and click its name.
5. The table of submissions appears. Find Samuel Adebayo's row — it should now show **"Approved"** in green.
6. Click the **"Full"** button (purple) or the **"History"** button next to the row to open the submission detail.

**What to check:**
- The submission still exists — it was not deleted.
- All the original answers from Step 2 are still visible: name, email, phone, and any other fields.
- The status shows **"Approved."**
- Nothing was lost, changed, or overwritten during the approval process.

**Result:** PASS / FAIL

---

## Step 16 — Test That Unapproved Users Are Blocked

**Use:** A new incognito window (or fully log out of Window A first)

**Who:** Public User (trying to sneak in)

**What to do:**

1. Fill and submit a **second** test form using a **different email** that you will NOT approve.
2. Do NOT go through activation. Go straight to the login page.
3. Enter that unapproved email and any password.
4. Click login.

**What you should see:**

- Login is blocked.
- An error message appears, saying something like: **"Access Denied: Your account is currently pending verification."**
- You stay on the login page.

**Result:** PASS / FAIL

---

## COMPLETE CHECKLIST

| Step | Description | PASS / FAIL |
|------|-------------|-------------|
| 1 | Open the Form — page loads with title and fields | |
| 2 | Fill all fields — no errors while typing | |
| 3 | Click "Submit Final Response" — success screen appears | |
| 3a | Success message shows the correct name (no {{curly braces}}) | |
| 3b | Success message reads as a normal sentence | |
| 4 | Log in as Super Admin — see main sidebar with CRM menu | |
| 5 | Expand CRM → click FORMS — arrive in Forms section | |
| 6 | Forms sidebar → click Runs — see list of runs | |
| 7 | Click active run → find "Samuel Adebayo" in the table | |
| 8 | Click "Review" button → review panel opens with all answers | |
| 9 | Select "✓ Approve" → click "Submit Review" → status changes to Approved | |
| 10 | Check email inbox → activation email arrived | |
| 11 | Click activation link → password setup page opens | |
| 12 | Create password → "Account Activated" success screen | |
| 13 | Log in with new credentials → login succeeds, staff dashboard shown | |
| 14 | CRM → PEOPLE → search for user → group = "Future Studio" | |
| 15 | FORMS → Runs → open submission → all original answers still there | |
| 16 | Unapproved email cannot log in → "pending verification" error | |

---

## HOW TO REPORT A BUG

If any test step does not work as described, fill out this form:

---

**BUG TITLE:**
(One sentence — what went wrong?)

**WHO WAS LOGGED IN:**
(Public User / Super Admin / Staff)

**WHERE:**
Which dashboard? Which sidebar menu did you click? Which page?

Example:
> "Super Admin Dashboard → Left sidebar: CRM → FORMS → Left sidebar: Runs → Clicked on the run name to open it."

**WHAT I CLICKED:**
The exact button, link, or action.

Example:
> "Clicked the orange 'Review' button in the submissions table."

**WHAT I DID:**

1. ...
2. ...
3. ...

**WHAT I EXPECTED:**
What should have happened.

**WHAT ACTUALLY HAPPENED:**
What happened instead.

**SCREENSHOT / VIDEO:**
Attach a screenshot or recording.

---

### Example Bug Report

**BUG TITLE:**
Approve button clicked — status did not change to Approved.

**WHO WAS LOGGED IN:**
Super Admin

**WHERE:**
Super Admin Dashboard → Left sidebar: CRM → FORMS → Left sidebar: Runs → Clicked active run → Table of submissions → Review panel.

**WHAT I CLICKED:**
"Submit Review" button after selecting "✓ Approve."

**WHAT I DID:**

1. Opened the run and found Samuel Adebayo's submission.
2. Clicked the orange "Review" button.
3. In the Review panel, selected "✓ Approve" from the dropdown.
4. Clicked "Submit Review."

**WHAT I EXPECTED:**
The review panel to close and the status to change to "Approved" in green.

**WHAT ACTUALLY HAPPENED:**
Nothing happened. The review panel stayed open and the status did not change.

**SCREENSHOT / VIDEO:**
[Attached.]

---

## END OF TEST

Once you finish all 16 steps, fill out the checklist above. For any step that failed, attach a separate bug report.

Thank you!
