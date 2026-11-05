# WhatsApp integration

Status: **click-to-chat is live; the Cloud API sender and the inbound webhook
are built but switched off.** No WhatsApp Business account exists yet, so the
Cloud API path stays disabled until one does.

---

## 1. What is available today

| Surface | Behaviour |
|---|---|
| Contact registration (participant + staff) | Optional consent checkbox, disabled until a usable phone number is entered |
| LMS checkout (paid course) | Optional consent checkbox next to the required capture consent; recorded when the paid account is created |
| Profile (every role) | The same consent checkbox, changeable at any time |
| CRM person record + contact lists | A WhatsApp action that opens `wa.me` with the number and an editable message prefilled |

The click-to-chat action is a real send, but it is typed and sent **by a
person** from their own phone. That is why it needs no template approval and
costs nothing.

A contact is offered the action only when the shared rule allows it:

1. they explicitly agreed (consent recorded),
2. the record is live (not archived, not deleted),
3. the number resolves to a valid E.164 value.

Any other case renders a disabled control whose tooltip explains the reason.
No screen decides contactability on its own.

---

## 2. Anti-block measures already enforced

A business number is a shared reputation: one unchecked loop can get it
restricted for everyone. The following rules are implemented, not aspirational.

| Measure | Where |
|---|---|
| Consent required, stored with timestamp + source | `contact_whatsapp_consents` |
| Consent can only be granted by the person themselves | registration/profile services; a public form cannot grant consent for an existing email |
| Consent withdrawn on opt-out, keeps history | consent upsert keeps `opted_in_at` and stamps `opted_out_at` |
| Invalid numbers refused before any send | `lib/integrations/whatsapp/phone.js` |
| Two switches must both be on (`WHATSAPP_API_ENABLED` + credentials) | `lib/integrations/whatsapp/config.js` |
| Templates only — no free-form server text | `lib/integrations/whatsapp/send.js` |
| Rolling 24-hour daily cap | `services/communications/whatsappOutbound.js` |
| Per-contact cooldown (default 24 h) | same |
| Every automated attempt logged, success or failure | `platform_whatsapp_log` |
| Inbound STOP withdraws consent automatically | webhook → `whatsappInbound` |

The daily cap and the cooldown are counted **from the log**, so a send that is
not logged is a guard that does not exist. Do not bypass
`sendWhatsappTemplateToContact` with a direct call to the transport.

---

## 3. Turning the Cloud API on (when the account exists)

### 3.1 External checklist

1. Create a Meta Business Portfolio and complete business verification.
2. Add a **dedicated phone number** that is not currently used on WhatsApp
   (a number already on WhatsApp must be deleted from the app first).
3. Register a display name and wait for approval.
4. Add a payment method.
5. Create message templates. Start with two or three transactional ones:
   - appointment/class reminder
   - confirmation
   - invitation
   Each must be approved before use. Templates are what WhatsApp bills; service
   replies inside the 24-hour window are free.
6. Note the **Phone Number ID** and create a **permanent access token**.

### 3.2 Environment variables

```bash
# The deliberate switch. Never set this before the templates are approved.
WHATSAPP_API_ENABLED=true
WHATSAPP_ACCESS_TOKEN=...
WHATSAPP_PHONE_NUMBER_ID=...
WHATSAPP_API_VERSION=v21.0            # optional, default v21.0

# Webhook (Meta's callback). Both are required; the route fails closed.
WHATSAPP_APP_SECRET=...
WHATSAPP_VERIFY_TOKEN=...             # the token you type into Meta's console

# Country used to resolve a national number typed without a dial code.
WHATSAPP_DEFAULT_COUNTRY=BJ

# Anti-block limits.
WHATSAPP_DAILY_CAP=50
WHATSAPP_CONTACT_COOLDOWN_HOURS=24

# Default Meta template locale.
WHATSAPP_TEMPLATE_LANGUAGE=fr
```

Staging and production are separate databases and separate Meta apps: configure
both, and never point a test run at production contacts.

### 3.3 Sending from code

```js
import { sendWhatsappTemplateToContact } from "@/services/communications/whatsappOutbound";

const result = await sendWhatsappTemplateToContact({
  contact,                       // must carry cid, phone, whatsapp_opt_in
  templateName: "class_reminder",
  languageCode: "fr",
  components: [/* Meta template components */],
});

// { success, provider, messageId } or { success:false, error|reason }
```

A refusal is a value, never an exception. Possible refusals:
`no_consent`, `invalid_phone`, `inactive`, `whatsapp_not_configured`,
`whatsapp_daily_cap_reached`, `whatsapp_cooldown_active`.

---

## 4. Inbound webhook

Public URL to declare in Meta's console:

```
https://<your-domain>/api/integrations/whatsapp/webhook
```

- **GET** answers the verification handshake, but only when `hub.verify_token`
  equals `WHATSAPP_VERIFY_TOKEN`. Without a configured token it answers `503`.
- **POST** verifies `X-Hub-Signature-256` over the **raw** body with
  `WHATSAPP_APP_SECRET`. No secret configured → `503`; bad signature → `401`.
- **Idempotency**: `provider_message_id` is unique in the delivery log, so
  Meta's retries cannot double-record anything.
- **Replies** are logged with their contact (resolved by an exact phone match,
  international/local/`00` variants).
- **STOP** (`stop`, `arrêter`, `désabonner`, `unsubscribe`…) withdraws consent.
  The whole message must be the keyword: "stop by tomorrow" is not an opt-out.
- **Statuses** (`sent`, `delivered`, `read`, `failed`) update the outbound row,
  with the provider's failure reason kept in `error`.
- A processing failure answers `500` on purpose, so Meta retries.

The route is listed in `src/proxy.js` as a public API path. Do not remove it:
without the edge exemption, every callback is refused before reaching the
signature check.

---

## 5. What still has to be built before automated sending is complete

- **Conversation view.** A person record tab that shows outbound/inbound
  messages and whether a free reply is still allowed (the 24-hour window can be
  derived from `platform_whatsapp_log`).
- **Campaign integration.** The campaign engine can gain a channel selector,
  but only on top of the guards above, with templates and scheduling.
- **Opt-out link/instruction** in every promotional template.

Do not add a free-text send endpoint. WhatsApp requires templates outside the
24-hour window, and an unguarded text endpoint is the fastest route to a
restricted number.

---

## 6. Database objects (created automatically on first use)

- `contact_whatsapp_consents` — one row per contact: `opt_in`,
  `source`, `opted_in_at`, `opted_out_at`, `updated_at`.
- `platform_whatsapp_log` — one row per attempt or inbound message: contact,
  direction, template, status, provider message id, error, recipient,
  timestamps.
- `lms_registrations.whatsapp_opt_in` — the optional consent ticked on a paid
  checkout, carried until the account is created.

All are additive and idempotent. The runtime schema guard in `src/lib/db.js`
makes the repeated `CREATE … IF NOT EXISTS` free.
