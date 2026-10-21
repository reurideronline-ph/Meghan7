# 👑 Crystal Royale AI Photo Booth — Meghan turns 7

A PWA photo booth for Meghan's Crystal Royale birthday (Nov. 8, 2026). Guests open an animated landing page built from the invitation, enter a PIN, pick a background and a royal look, and take **one shot with a 10-second countdown**. OpenAI then makes two pictures that keep their real faces:

1. **Crystal Royale portrait**: a photoreal picture of them in the chosen royal costume, in the crystal palace.
2. **3D animated film photo**: that same portrait re-rendered as a 3D animated-movie still.

Both go into the chosen frame. Guests **scan a QR code to download** the collage plus both photos. There is no printing at this event.

```
/                      ← GitHub Pages site
├─ index.html · app.js · styles.css · config.js
├─ download.html       page opened by the QR code
├─ manifest.webmanifest · sw.js     (PWA, install banner on first open)
├─ frames/landing.jpg  the invitation (landing page)
├─ frames/frame1.png   Crystal Castle (portrait, 2 windows)
├─ frames/frame2.png   Rose Garden Palace (landscape, 2 windows)
├─ icons/
└─ backend/Code.gs · appsscript.json   (Google Apps Script)
```

## Guest flow
1. **Landing**: the invitation rises in with a burst of light. A shine sweeps across it, sparkles twinkle on the gold lettering, the gold frame glows, crystals float and glitter falls. Then *✨ Enter the Booth*.
2. **PIN** from the slip handed out at the photo booth counter.
3. **Choose your background**: Crystal Castle (tall) or Rose Garden Palace (wide). The camera and the AI pictures follow this shape: 1024×1536 or 1536×1024.
4. **Choose your royal look** (no timer): Crystal Princess, Crystal Prince, Crystal Queen & King, Fairy Godparent, Royal Knight, Unicorn Royalty, Ballet Royale, Rose Garden Royalty, Snow Crystal Royalty.
5. **Camera**: tap *I'm Ready*, 10-second countdown, one shot.
6. **AI, step 1 then step 2** (the guest sees step 1 while step 2 runs).
7. **Result**: QR code and *Save 3 Photos to This Device*. After 3 minutes without a tap it returns to the landing page.

## Setup: use a NEW Sheet + Apps Script for this party
Keep the Halloween booth separate, so its PINs, photos and settings stay apart.
1. Create a new Google Sheet, e.g. "Meghan 7 Photo Booth".
2. **Extensions → Apps Script**. Paste `backend/Code.gs`. In Project Settings tick *Show appsscript.json* and paste `backend/appsscript.json`.
3. Run **`setup`** and allow the permissions. It creates the PINs, Settings, Characters, Photos and Prints tabs, plus the Drive folder **"Crystal Royale Booth – Photos"**.
4. **Project Settings → Script properties** → add `OPENAI_API_KEY`.
5. **Deploy → New deployment → Web app** · Execute as **Me** · Who has access **Anyone** → copy the `/exec` URL.
6. Open that URL in a **private window**. It must say *Crystal Royale Photo Booth API v1 is running*.
7. Paste the URL into `API_URL` in **config.js**, then upload all files to a GitHub repo and turn on GitHub Pages.
8. **👑 Photo Booth → Generate PINs…** for the slips. Run **🧪 Test AI generation** once.

> Updating code later: **Deploy → Manage deployments → ✏️ Edit → Version: New version → Deploy**. This keeps the same URL; "New deployment" would create a new one.

## Customise from the Sheet (no redeploy)
- **Characters tab**: tick or untick looks, edit the costume and scene text the AI receives, or add rows.
- **Settings tab**: texts, demo PIN (`000000`), countdown, which backgrounds to offer, AI model and quality, identity prompt, 3D style, how long photos are kept. `PRINTING_ENABLED` is off.
- **Photos tab**: every saved picture with its `lh3` link and a preview.

**Better likeness:** set `OPENAI_MODEL` = `gpt-image-1.5` and `IMAGE_QUALITY` = `high`. It costs more, but face matching is stronger. Note that OpenAI retires `gpt-image-1-mini` and `gpt-image-1.5` on **1 Dec 2026**.

## Notes
- Every call from the booth is a POST with a `text/plain` JSON body. The QR page gets small photo links and downloads through Drive, which keeps every reply small.
- Photos are shared "anyone with the link" (`PUBLIC_PHOTO_LINKS`), so the QR page and lh3 links work. They are deleted after `RETENTION_DAYS` (7).
- All prompts are written for a children's party: wholesome outfits, no masks or face paint, and no copying of film characters.
