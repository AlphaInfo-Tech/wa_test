# WhatsApp Bot Admin

Next.js app: WhatsApp Cloud API webhook + AI auto-reply (OpenAI) + admin dashboard
(live inbox, knowledge base, escalations), backed by Firestore.

## 1. Install dependencies

```bash
npm install
```

## 2. Set up accounts (each is free to start)

- **Firebase project** — console.firebase.google.com — enable Firestore (Native mode)
  and Authentication (Email/Password provider).
- **Meta Business + WhatsApp Cloud API** — business.facebook.com — create an app,
  add the WhatsApp product, get a test phone number.
- **OpenAI** — platform.openai.com — get an API key, create a vector store
  (Dashboard > Storage > Vector stores, or via API) and note its ID.

## 3. Configure environment variables

```bash
cp .env.example .env.local
```

Fill in every value in `.env.local` — see comments in that file for exactly where
each one comes from. The Firebase service account JSON must be base64-encoded
onto a single line (command included in the file's comments).

## 4. Create at least one admin login

In Firebase Console > Authentication > Users > Add user, create an email/password
account for yourself. This is what you'll use to log into `/login`.

## 5. Run locally

```bash
npm run dev
```

Visit `http://localhost:3000/login`, sign in, you'll land on the dashboard.

## 6. Expose your local server for the WhatsApp webhook

Meta needs a public HTTPS URL to send webhooks to — localhost alone won't work.
Use a tunnel tool for local testing:

```bash
npx ngrok http 3000
```

Copy the `https://....ngrok-free.app` URL it gives you.

## 7. Configure the webhook in Meta's dashboard

In your Meta app > WhatsApp > Configuration:
- Callback URL: `https://your-ngrok-url.ngrok-free.app/api/webhook`
- Verify token: must match `WHATSAPP_VERIFY_TOKEN` in your `.env.local` exactly
- Subscribe to the `messages` field

Click "Verify and save" — this triggers the GET handshake in `app/api/webhook/route.js`.

## 8. Test it

Send a WhatsApp message to your test number from your phone. It should:
1. Hit your webhook (visible in your terminal logs)
2. Get processed (rule match, AI reply, or escalation)
3. Send a reply back to your phone
4. Appear in your dashboard inbox at `http://localhost:3000/dashboard/inbox`

## Project structure

```
app/
  api/            — webhook, agent-reply, knowledge-base, escalations routes
  dashboard/      — inbox, knowledge-base, escalations admin pages
  login/          — sign-in page
lib/
  ai/             — OpenAI generate.js (retrieval + tool-call loop)
  auth/           — Firebase Auth context + server-side token verification
  firebase/       — client SDK init
  firestore/      — admin SDK init + conversation state helpers
  knowledge-base/ — OpenAI vector store document management
  router/         — rule-based keyword routing
  whatsapp/       — send, dedupe, message handling
```

## Known setup steps not automated

- Firestore composite indexes: the escalations query and the message status
  lookup will throw an error in your server console the first time they run,
  with a direct link to create the required index — click it once.
- Firestore security rules: lock down client reads to authenticated users
  (see rules snippet discussed during build).
- `lib/ai/tool-handlers.js` and parts of `app/api/escalations` use placeholder
  logic for order lookup / appointment checking — replace with real backend calls.

## Deploying

Push to GitHub, import the repo in Vercel, add all the same env vars in
Vercel's project settings, deploy. Then update the Meta webhook URL to your
production Vercel URL instead of the ngrok tunnel.
