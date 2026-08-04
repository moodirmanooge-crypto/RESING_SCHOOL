# Send SMS Feature — Setup Guide (Hormuud SMS API)

Waxaan kuu sameeyay 3 file:

1. `src/admin/pages/Dashboard.jsx`
2. `src/admin/components/SendSmsModal.jsx`
3. `sms/index.js`

Username-ka, Password-ka iyo Sender ID-ga Hormuud waxaa lagu kaydiyaa Firebase Secret Manager, mana lagu qoro frontend-ka.

---

## Tallaabo 1 — Files-ka

```
src/admin/pages/Dashboard.jsx
src/admin/components/SendSmsModal.jsx
sms/index.js
```

---

## Tallaabo 2 — Firebase Functions

Haddii aadan hore u samayn:

```bash
npm install -g firebase-tools
firebase login
firebase init functions
```

Dooro:

- JavaScript
- Project: `one-click-onilne`
- ESLint: No
- Install dependencies: Yes

---

## Tallaabo 3 — Packages

```bash
cd sms
npm install firebase-admin firebase-functions axios
```

---

## Tallaabo 4 — Cloud Function

Geli code-ka `sms/index.js`.

---

## Tallaabo 5 — Secret Manager

```bash
firebase functions:secrets:set HORMUUD_USERNAME
firebase functions:secrets:set HORMUUD_PASSWORD
firebase functions:secrets:set HORMUUD_SENDERID
```

Qiimaha geli:

- `HORMUUD_USERNAME`
- `HORMUUD_PASSWORD`
- `HORMUUD_SENDERID`

---

## Tallaabo 6 — Deploy

```bash
firebase deploy --only functions:sms:sendBulkSms
```

Marka uu guuleysto waxaad arki doontaa:

```
functions[sms:sendBulkSms(us-central1)] Successful update operation.
Deploy complete!
```

---

## Tallaabo 7 — Firebase Frontend

```bash
npm install firebase
```

`src/firebase/firebase.js`

```javascript
import { getFunctions } from "firebase/functions";

export const functions = getFunctions(risingApp, "us-central1");
```

---

## Tallaabo 8 — SendSmsModal

Hubi in uu isticmaalo:

```javascript
import { httpsCallable } from "firebase/functions";

const sendBulkSms = httpsCallable(functions, "sendBulkSms");

await sendBulkSms({
  audience,
  targetId,
  message,
});
```

---

## Tallaabo 9 — Dashboard

Ku dar:

```text
SendSmsModal
```

iyo badhanka:

```text
Send SMS
```

---

# Sida uu u shaqeeyo

Admin-ku wuxuu dooran karaa:

- Dhamaan Waalidiinta
- Waalid Gaar ah
- Dhamaan Macalimiinta
- Macalin Gaar ah
- Dhamaan Ardayda
- Arday Gaar ah

Kadib:

1. Qor fariinta.
2. Guji **Dir SMS**.
3. Frontend-ku wuxuu wacayaa `sendBulkSms`.
4. Cloud Function-ku wuxuu:
   - Firestore ka soo qaadaa lambarada.
   - Hormuud ka qaataa Access Token.
   - SMS ayuu diraa.
   - Wuxuu soo celiyaa natiijada.

---

# Firestore Fields

Students:

```
fullName
studentPhone
parentPhone
studentId
className
```

Teachers:

```
fullName
phone
teacherPhone
mobile
username
subject
```

---

# Phone Number Format

Hormuud API wuxuu isticmaalaa:

```
61XXXXXXX
```

Haddii aad isticmaalayso:

```
25261XXXXXXX
```

ama

```
061XXXXXXX
```

waxaad ku saxdaa `cleanPhone()` gudaha `sms/index.js`.

---

# Hormuud API

Secret Manager:

```
HORMUUD_USERNAME
HORMUUD_PASSWORD
HORMUUD_SENDERID
```

API:

```
https://smsapi.hormuud.com/token
```

```
https://smsapi.hormuud.com/api/SendSMS
```

---

# Haddii SMS-ku shaqayn waayo

Logs:

```bash
firebase functions:log --only sendBulkSms
```

Deploy:

```bash
firebase deploy --only functions:sms:sendBulkSms
```

Secrets:

```bash
firebase functions:secrets:get HORMUUD_USERNAME
firebase functions:secrets:get HORMUUD_PASSWORD
firebase functions:secrets:get HORMUUD_SENDERID
```

---

# Response Codes

| Code | Macnaha |
|------|---------|
| 200 | SMS waa la diray |
| 201 | Authentication Failed |
| 203 | Invalid Sender ID |
| 204 | Balance kuma filna |
| 205 | Balance aad ayuu u hooseeyaa |
| 207 | Wrong Mobile Number |

---

# Hubinta ugu dambeysa

Hubi in:

- Firebase Functions Deploy Success yahay.
- Secret Manager uu leeyahay Version 1 (Enabled).
- `sendBulkSms` uu ku yaal `us-central1`.
- `getFunctions(risingApp, "us-central1")` la isticmaalayo.
- Frontend-ku isticmaalo `httpsCallable()`.
- Username, Password iyo Sender ID ay sax yihiin.
- Hormuud SMS account-ku leeyahay adeeg firfircoon iyo balance haddii adeeggaagu u baahan yahay.