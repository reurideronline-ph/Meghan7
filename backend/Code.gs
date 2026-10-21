/**
 * ============================================================
 *  CRYSTAL ROYALE AI PHOTO BOOTH — Google Apps Script backend
 *  Meghan's 7th birthday · QR download only (no printing)
 * ============================================================
 *  Bind this script to a Google Sheet (Extensions → Apps Script),
 *  then run  setup()  once from the editor.
 *
 *  CUSTOMISE FROM THE SHEET (no redeploy needed — changes apply within a minute):
 *    "Settings"   tab → prices, timers, texts, layouts, AI options, prompts, staff code
 *    "Characters" tab → tick/untick, edit or add characters (name, emoji, costume, scene…)
 *
 *  Script Properties (Project Settings → Script properties):
 *    OPENAI_API_KEY   (required)  your OpenAI key — kept here, never in the sheet
 *    Any Settings key may also be set here; the Settings tab wins when it has a value.
 *    OPENAI_MODEL     (optional)  default: gpt-image-1-mini
 *    IMAGE_QUALITY    (optional)  low | medium | high   (default: medium)
 *    INPUT_FIDELITY   (optional)  high | off            (default: high)
 *    RETENTION_DAYS   (optional)  days photos are kept  (default: 7)
 *    MAX_ATTEMPTS     (optional)  AI retries per PIN    (default: 3)
 *    STAFF_CODE       (required for prints) code staff type on the booth after taking payment
 *    PRINT_PRICE      (optional)  price per 5R print    (default: 50)
 *    CURRENCY         (optional)  symbol shown to guests (default: ₱)
 *    SHEET_ID / FOLDER_ID are written automatically by setup().
 *
 *  Endpoints (deployed as Web App: Execute as "Me", Who has access "Anyone").
 *  Every call is a POST with a text/plain JSON body:
 *    POST {action:'config'}                                theme + characters + public settings
 *    POST {action:'photo', c: SHARECODE}                   the 3 photos for the QR download page
 *    POST {action:'validatePin', pin}
 *    POST {action:'generate', token, characterId, photo, size}   STEP 1: Crystal Royale portrait (size 1024x1536 or 1536x1024)
 *    POST {action:'animate', token}                        STEP 2: 3D-animated version of step 1
 *    POST {action:'poll', token}                           check a running AI step (background engine)
 *    POST {action:'save', token, layoutId, image}          (image = base64 JPEG)
 *    POST {action:'printOrder', token, items, staffCode}   paid prints, logged to the "Prints" sheet
 * ============================================================
 */

/* ---------------- IDENTITY PROMPT (highest priority) ---------------- */
const IDENTITY_PROMPT =
  "IDENTITY PRESERVATION IS THE HIGHEST PRIORITY. The people in the reference photo must remain the exact same people. " +
  "Preserve each person's facial identity, facial structure, eyes, nose, mouth, jawline, face shape, skin tone, age, hairstyle, " +
  "and distinctive facial characteristics. Do not reinterpret, beautify, redesign, or replace a face. The generated image must be " +
  "immediately recognizable as the same people in the reference photograph. Specifically: never lighten, whiten or even out anyone's " +
  "complexion. Keep every mole, freckle, scar, line, wrinkle and blemish exactly where it is. Do not slim, broaden, smooth, airbrush " +
  "or de-age anyone, and do not make anyone taller, thinner or more conventionally attractive. Keep glasses and facial hair exactly as " +
  "worn. These are paying customers standing in front of the booth: if a person cannot instantly recognise themselves, the image has " +
  "failed, no matter how good it looks.";

/* ---------------- TODAY'S THEME: CRYSTAL ROYALE ---------------- */
// Shared look of the party: lavender sky, crystal palace, rose-gold light, pastel colours.
const PALACE = 'a dreamy Crystal Royale palace: lavender and pink sky, glowing fairytale castle with pastel spires, ' +
  'floating iridescent crystals, soft golden sparkles and warm magical light';
const THEME = {
  id: 'crystal-royale-meghan-7',
  name: 'Crystal Royale',
  characters: [
    { id: 'princess',  name: 'Crystal Princess',   emoji: '👸', tagline: 'Ball gowns & a sparkling tiara', color: '#f6a8d6',
      costume: 'pastel pink and lavender ball gown with crystal-beaded bodice, layers of shimmering tulle, satin gloves and a delicate gold tiara set with a heart-shaped amethyst crystal',
      scene: 'grand crystal ballroom of ' + PALACE + ', with glittering chandeliers' },
    { id: 'prince',    name: 'Crystal Prince',     emoji: '🤴', tagline: 'Royal coats & a golden crown',   color: '#9fb7ff',
      costume: 'ivory and lavender royal prince coat with gold embroidery, gold buttons and epaulettes, a pale-blue sash and a small gold crown with crystal gems',
      scene: 'palace balcony of ' + PALACE },
    { id: 'queen',     name: 'Crystal Queen & King', emoji: '👑', tagline: 'Regal capes for the grown-ups', color: '#c7a2ff',
      costume: 'regal royal attire: a flowing lilac velvet cape with ermine-style trim over an elegant pastel gown or tailored royal suit, and a tall jewelled gold crown',
      scene: 'throne room of ' + PALACE + ', with twin crystal thrones' },
    { id: 'fairy',     name: 'Fairy Godparent',    emoji: '🧚', tagline: 'Shimmering wings & a wand',      color: '#e2d0ff',
      costume: 'flowing iridescent pastel robes, translucent sparkling fairy wings and a slender crystal-tipped wand leaving a trail of golden sparkles',
      scene: 'enchanted crystal garden of ' + PALACE },
    { id: 'knight',    name: 'Royal Knight',       emoji: '🛡️', tagline: 'Lavender armour & a crystal crest', color: '#b8c4e0',
      costume: 'polished silver-and-lavender ceremonial armour with gold trim, a flowing pastel cape and a shield bearing a heart-shaped crystal crest (no helmet, face fully visible)',
      scene: 'castle courtyard of ' + PALACE },
    { id: 'unicorn',   name: 'Unicorn Royalty',    emoji: '🦄', tagline: 'Pastel rainbow & a unicorn horn', color: '#ffc6e8',
      costume: 'pastel rainbow royal outfit with sparkles, a golden unicorn-horn headband with flowers, and a soft cape; a friendly white unicorn with a pastel mane stands nearby',
      scene: 'rainbow meadow in front of ' + PALACE },
    { id: 'ballerina', name: 'Ballet Royale',      emoji: '🩰', tagline: 'Tulle, pearls & pointe shoes',   color: '#ffd9e8',
      costume: 'royal ballet costume: pale pink tutu or ballet tunic with crystal details, pearl accents and a small sparkling crown',
      scene: 'moonlit crystal stage inside ' + PALACE },
    { id: 'garden',    name: 'Rose Garden Royalty', emoji: '🌹', tagline: 'Roses, butterflies & gold',     color: '#f7a1b5',
      costume: 'romantic royal outfit covered in pastel roses and gold filigree, a crown of pink roses and tiny crystals, with lavender butterflies around',
      scene: 'rose garden archway with lanterns and wisteria, overlooking ' + PALACE + ' across a sparkling lake' },
    { id: 'snow',      name: 'Snow Crystal Royalty', emoji: '❄️', tagline: 'Icy silver & frosted gems',     color: '#bfe3ff',
      costume: 'an original icy royal look (not from any film): frosted silver-blue gown or tailored coat with snowflake crystal embroidery, a fur-trimmed pastel cape and an ice-crystal crown',
      scene: 'glittering ice-crystal hall of ' + PALACE + ', with gentle snowflakes' }
  ]
};

/* ---------------- SHEET COLUMNS ---------------- */
const API_VERSION = 1;   // Crystal Royale booth v1 — shown at the /exec URL   // shown at the /exec URL — if it doesn't match, the deployment is still the old version
const SHEET_NAME = 'PINs';
const HEADERS = ['PIN', 'Status', 'Created', 'Activated', 'Generated', 'Done', 'Token', 'Character', 'Layout',
                 'AI File IDs', 'Photo File ID', 'Share Code', 'Attempts', 'Note', 'Job', 'Job Started', 'Source File ID', 'Size'];
const C = {}; HEADERS.forEach((h, i) => C[h] = i);   // column index map (0-based)

/* ============================================================
 *  WEB APP ENTRY POINTS
 * ============================================================ */
/** Remembers the booth's last contact so the Test AI tool can tell whether the booth is connected. */
function noteCall_(action) {
  if (action === 'poll') return;
  try { PropertiesService.getScriptProperties().setProperty('LAST_CALL', JSON.stringify({ t: new Date().toISOString(), action: action || '(none)' })); } catch (x) {}
}

function doGet(e) {
  const p = (e && e.parameter) || {};
  noteCall_('GET ' + (p.action || ''));
  try {
    if (p.action === 'config') return json_(publicConfig_());
    if (p.action === 'photo')  return json_(getPhoto_(p.c));
    let engine = '?', model = '?';
    try { engine = aiEngine_(); model = imageModel_(); } catch (x) {}
    return json_({ ok: true, service: 'Crystal Royale Photo Booth', version: API_VERSION, engine, model,
                   message: `Crystal Royale Photo Booth API v${API_VERSION} is running. Engine: ${engine}. Model: ${model}.` });
  } catch (err) {
    return json_({ ok: false, error: String(err.message || err) });
  }
}

function doPost(e) {
  let body = {};
  try { body = JSON.parse((e && e.postData && e.postData.contents) || '{}'); } catch (x) {}
  noteCall_(body.action);
  try {
    switch (body.action) {
      case 'config':      return json_(publicConfig_());
      case 'photo':       return json_(getPhoto_(body.c));
      case 'validatePin': return json_(validatePin_(body.pin));
      case 'generate':    return json_(generate_(body.token, body.characterId, body.photo, body.size));
      case 'animate':     return json_(animate_(body.token));
      case 'poll':        return json_(poll_(body.token));
      case 'save':        return json_(save_(body.token, body.layoutId, body.image));
      case 'printOrder':  return json_(printOrder_(body.token, body.items, body.staffCode));
      default:            return json_({ ok: false, error: 'Unknown action' });
    }
  } catch (err) {
    console.error(err);
    const m = String(err.message || err);
    if (/too many simultaneous|Service invoked too many times|Lock timeout|exceeded maximum execution/i.test(m)) {
      return json_({ ok: false, retry: true, net: true, error: 'The booth is handling a lot of guests at once. Wait about half a minute and try again — nothing has been lost.', detail: m });
    }
    return json_({ ok: false, error: m });
  }
}

function json_(o) {
  return ContentService.createTextOutput(JSON.stringify(o)).setMimeType(ContentService.MimeType.JSON);
}

function publicConfig_() {
  const st = settings_();
  const pub = {};
  SETTINGS_DEFS.filter(d => d.public).forEach(d => pub[d.key] = st[d.key]);
  return {
    ok: true,
    version: API_VERSION,
    theme: { id: THEME.id, name: st.THEME_TITLE },
    settings: pub,
    print: printPricing_(),
    characters: characters_().map(c => ({ id: c.id, name: c.name, emoji: c.emoji, tagline: c.tagline, color: c.color }))
  };
}

/* ============================================================
 *  PIN / SESSION
 *  Status flow: NEW → ACTIVE → GENERATING → STEP1 → ANIMATING → GENERATED → DONE
 * ============================================================ */
function validatePin_(pin) {
  pin = String(pin || '').replace(/\D/g, '');
  if (pin.length < 4) return { ok: false, error: 'Please enter your PIN.' };

  const demoPin = String(setting_('DEMO_PIN') || '');
  if (demoPin && pin === demoPin) return startDemo_();

  return withLock_(() => {
    const { sheet, rowIndex, row } = findRow_(C['PIN'], pin);
    if (!row) return { ok: false, error: 'PIN not found. Please check your PIN Slip or ask the booth counter.' };

    const status = row[C['Status']];
    const token = row[C['Token']] || Utilities.getUuid().replace(/-/g, '');

    if (status === 'NEW') {
      setCells_(sheet, rowIndex, { 'Status': 'ACTIVE', 'Activated': new Date(), 'Token': token, 'Attempts': 0 });
      return { ok: true, stage: 'active', token };
    }
    if (status === 'ACTIVE') return { ok: true, stage: 'active', token, resumed: true };
    if (status === 'GENERATING') return { ok: true, stage: 'pending', step: 1, token, characterId: row[C['Character']] };
    if (status === 'ANIMATING') {
      const ids = aiFileIds_(row);
      return { ok: true, stage: 'pending', step: 2, token, characterId: row[C['Character']], images: ids[0] ? [fileB64_(ids[0])] : [] };
    }
    if (status === 'STEP1' || status === 'GENERATED') {
      // Customer reloaded mid-way: give back what is already made.
      const images = aiFileIds_(row).map(id => Utilities.base64Encode(DriveApp.getFileById(id).getBlob().getBytes()));
      return { ok: true, stage: status === 'GENERATED' ? 'generated' : 'step1', token, characterId: row[C['Character']], images };
    }
    if (status === 'DONE') {
      return { ok: true, stage: 'done', token, shareCode: row[C['Share Code']] };
    }
    if (status === 'FAILED') return { ok: false, error: 'This PIN needs help from the booth staff. Please visit the counter.' };
    if (status === 'VOID')   return { ok: false, error: 'This PIN is no longer valid.' };
    return { ok: false, error: 'This PIN cannot be used.' };
  });
}

/** Demo PIN: every use opens a brand-new session row ("DEMO-…") that runs the real AI. */
function startDemo_() {
  const limit = Number(setting_('DEMO_DAILY_LIMIT'));
  return withLock_(() => {
    const sh = sheet_(), tz = Session.getScriptTimeZone();
    const today = Utilities.formatDate(new Date(), tz, 'yyyy-MM-dd');
    if (limit > 0) {
      const used = sh.getDataRange().getValues().slice(1).filter(r => isDemo_(r[C['PIN']]) && r[C['Created']] &&
        Utilities.formatDate(new Date(r[C['Created']]), tz, 'yyyy-MM-dd') === today).length;
      if (used >= limit) return { ok: false, error: `The demo PIN has been used ${used} times today (limit ${limit}). Change DEMO_DAILY_LIMIT in Settings.` };
    }
    const token = Utilities.getUuid().replace(/-/g, '');
    const row = new Array(HEADERS.length).fill('');
    row[C['PIN']] = 'DEMO-' + Utilities.formatDate(new Date(), tz, 'MMdd-HHmmss');
    row[C['Status']] = 'ACTIVE'; row[C['Created']] = new Date(); row[C['Activated']] = new Date();
    row[C['Token']] = token; row[C['Attempts']] = 0; row[C['Note']] = 'Demo session (real AI, not charged)';
    sh.appendRow(row);
    return { ok: true, stage: 'active', token, demo: true };
  });
}
function isDemo_(pin) { return /^DEMO-/.test(String(pin)); }

function aiFileIds_(row) { return String(row[C['AI File IDs']] || '').split(',').filter(String); }

/* ============================================================
 *  AI GENERATION
 *  Frame window 1 = photoreal character photo (from the guest's shot)
 *  Frame window 2 = 3D animated-movie version OF window 1
 *
 *  WHY BACKGROUND JOBS: Apps Script drops any outgoing request after ~60 s,
 *  and an OpenAI image edit often takes longer. So by default (AI_ENGINE =
 *  "background") the booth STARTS an OpenAI background job, gets a job id
 *  back in a second or two, and the booth app polls every few seconds until
 *  the picture is ready. No single request ever comes near the 60 s limit.
 *  AI_ENGINE = "direct" uses the old one-shot Images API call instead.
 * ============================================================ */
const STUCK_QUEUE_SECONDS = 75;    // a job still "queued" after this is cancelled and resubmitted once
const JOB_MAX_SECONDS = 300;       // give up on a step after 5 minutes

/** Reserve a step under lock. Returns {ok, pin, row} or an error object. */
function reserve_(token, fromStatus, busyStatus, extra) {
  return withLock_(() => {
    const { sheet, rowIndex, row } = findRow_(C['Token'], token);
    if (!row) return { ok: false, error: 'Session not found. Please re-enter your PIN.' };
    const status = row[C['Status']];
    if (status === busyStatus) {
      const started = new Date(row[C['Generated']] || 0).getTime();
      if (Date.now() - started < (JOB_MAX_SECONDS + 30) * 1000) return { ok: true, pending: true, already: true, pin: row[C['PIN']], row };
    } else if (status !== fromStatus) {
      if (status === 'GENERATED' || status === 'DONE') return { ok: false, error: 'This PIN has already been used for its photo.' };
      return { ok: false, error: 'This step is not available for this PIN.' };
    }
    setCells_(sheet, rowIndex, Object.assign({ 'Status': busyStatus, 'Generated': new Date(), 'Job': '', 'Job Started': '' }, extra || {}));
    return { ok: true, pin: row[C['PIN']], row };
  });
}

function failStep_(token, err, backTo) {
  const maxAttempts = Number(setting_('MAX_ATTEMPTS')) || 3;
  const detail = String((err && err.message) || err).slice(0, 300);
  console.error('AI step failed: ' + detail);
  withLock_(() => {
    const { sheet, rowIndex, row } = findRow_(C['Token'], token);
    if (!row) return;
    const attempts = Number(row[C['Attempts']] || 0) + 1;
    setCells_(sheet, rowIndex, { 'Status': attempts >= maxAttempts ? 'FAILED' : backTo, 'Attempts': attempts,
                                 'Note': detail, 'Job': '', 'Job Started': '' });
  });
  return { ok: false, retry: true, error: friendlyError_(err), detail };
}

function storeImage_(pin, b64, label, characterId) {
  const folder = DriveApp.getFolderById(PropertiesService.getScriptProperties().getProperty('FOLDER_ID'));
  const stamp = Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'yyyyMMdd-HHmmss');
  const file = folder.createFile(Utilities.newBlob(Utilities.base64Decode(b64), 'image/jpeg', `${pin}_${stamp}_${label}.jpg`));
  logPhoto_(file, pin, label, characterId);
  return file.getId();
}
function fileB64_(id) { return Utilities.base64Encode(DriveApp.getFileById(id).getBlob().getBytes()); }

const SIZES = ['1024x1536', '1536x1024', '1024x1024'];
function sizeOf_(row) { const v = String((row && row[C['Size']]) || ''); return SIZES.indexOf(v) >= 0 ? v : '1024x1536'; }
function orientation_(size) { return size === '1536x1024' ? 'landscape' : size === '1024x1024' ? 'square' : 'portrait'; }

/** STEP 1 — guest photo → photoreal Crystal Royale portrait. */
function generate_(token, characterId, photoB64, size) {
  size = SIZES.indexOf(String(size)) >= 0 ? String(size) : '1024x1536';
  if (!token || !photoB64) return { ok: false, error: 'Missing photo or session.' };
  const list = characters_();
  const character = list.find(c => c.id === characterId) || list[0];
  const r = reserve_(token, 'ACTIVE', 'GENERATING', { 'Character': character.id, 'Size': size });
  if (!r.ok) return r;
  if (r.already) return { ok: true, pending: true, step: 1, status: 'in_progress', characterId: r.row[C['Character']] };

  // Keep the guest photo so a stuck job can be resubmitted (deleted with the rest after RETENTION_DAYS).
  try {
    const srcId = storeImage_(r.pin, photoB64, '0-original', character.id);
    withLock_(() => { const f = findRow_(C['Token'], token); setCells_(f.sheet, f.rowIndex, { 'Source File ID': srcId }); });
  } catch (x) { console.warn('Could not store original: ' + x); }

  return runOrStart_(token, 1, photoB64, characterPrompt_(character, size), 'ACTIVE', { characterId: character.id }, size);
}

/** STEP 2 — the step-1 picture (read from Drive, never from the client) → 3D animated version. */
function animate_(token) {
  if (!token) return { ok: false, error: 'Missing session.' };
  const r = reserve_(token, 'STEP1', 'ANIMATING');
  if (!r.ok) return r;
  if (r.already) return { ok: true, pending: true, step: 2, status: 'in_progress' };
  const ids = aiFileIds_(r.row);
  return runOrStart_(token, 2, fileB64_(ids[0]), animatedPrompt_(), 'STEP1', null, sizeOf_(r.row));
}

function runOrStart_(token, step, imageB64, prompt, backTo, extra, size) {
  try {
    if (aiEngine_() === 'direct') return finishStep_(token, step, directEdit_(imageB64, prompt, size), extra);
    const id = startJob_(imageB64, prompt, size);
    withLock_(() => { const f = findRow_(C['Token'], token); setCells_(f.sheet, f.rowIndex, { 'Job': id + '|1', 'Job Started': new Date() }); });
    return Object.assign({ ok: true, pending: true, step, status: 'queued' }, extra || {});
  } catch (err) {
    return failStep_(token, err, backTo);
  }
}

/** Saves a finished picture and moves the session on. Safe if two polls finish at once. */
function finishStep_(token, step, img, extra) {
  return withLock_(() => {
    const { sheet, rowIndex, row } = findRow_(C['Token'], token);
    const busy = step === 1 ? 'GENERATING' : 'ANIMATING';
    const ids = aiFileIds_(row);
    if (row[C['Status']] !== busy) {                         // another poll already saved it
      const have = ids[step - 1];
      return Object.assign({ ok: true, step, image: have ? fileB64_(have) : img }, extra || {});
    }
    const id = storeImage_(row[C['PIN']], img, step === 1 ? '1-character' : '2-animated', row[C['Character']]);
    const patch = step === 1
      ? { 'Status': 'STEP1', 'AI File IDs': id, 'Attempts': 0 }
      : { 'Status': 'GENERATED', 'Generated': new Date(), 'AI File IDs': ids[0] + ',' + id };
    setCells_(sheet, rowIndex, Object.assign(patch, { 'Note': '', 'Job': '', 'Job Started': '' }));
    return Object.assign({ ok: true, step, image: img }, extra || {});
  });
}

/** Booth app calls this every few seconds while a background job runs. */
function poll_(token) {
  if (!token) return { ok: false, error: 'Missing session.' };
  const { row } = findRow_(C['Token'], token);
  if (!row) return { ok: false, error: 'Session not found. Please re-enter your PIN.' };
  const status = row[C['Status']];
  const step = status === 'GENERATING' ? 1 : status === 'ANIMATING' ? 2 : 0;
  const extra = step === 1 ? { characterId: row[C['Character']] } : {};

  if (!step) {                                               // not running any more
    const ids = aiFileIds_(row);
    if (status === 'STEP1' && ids[0]) return { ok: true, step: 1, image: fileB64_(ids[0]), characterId: row[C['Character']] };
    if ((status === 'GENERATED' || status === 'DONE') && ids[1]) return { ok: true, step: 2, image: fileB64_(ids[1]) };
    return { ok: false, retry: status === 'ACTIVE' || status === 'STEP1', error: friendlyError_(row[C['Note']] || ''), detail: String(row[C['Note']] || '') };
  }

  const backTo = step === 1 ? 'ACTIVE' : 'STEP1';
  const job = String(row[C['Job']] || '');
  const startedAt = new Date(row[C['Job Started']] || row[C['Generated']] || Date.now()).getTime();
  const age = (Date.now() - startedAt) / 1000;
  if (!job) {                                                // job is being created right now (or direct mode is running)
    if (age > JOB_MAX_SECONDS) return failStep_(token, new Error('The AI step never started.'), backTo);
    return { ok: true, pending: true, step, status: 'starting', seconds: Math.round(age) };
  }
  const [id, attemptStr] = job.split('|');
  const attempt = Number(attemptStr) || 1;

  let resp;
  try { resp = getJob_(id); }
  catch (err) {                                              // network blip: keep waiting unless we're past the limit
    if (age > JOB_MAX_SECONDS) return failStep_(token, err, backTo);
    return { ok: true, pending: true, step, status: 'checking', seconds: Math.round(age) };
  }

  if (resp.status === 'completed') {
    try { return finishStep_(token, step, extractImage_(resp), extra); }
    catch (err) { return failStep_(token, err, backTo); }
  }
  if (resp.status === 'queued' || resp.status === 'in_progress') {
    if (age > JOB_MAX_SECONDS) {
      cancelJob_(id);
      return failStep_(token, new Error(`AI job ${id} still "${resp.status}" after ${Math.round(age)} s — cancelled.`), backTo);
    }
    if (resp.status === 'queued' && age > STUCK_QUEUE_SECONDS && attempt < 2) {
      // Known OpenAI issue: some background jobs never leave "queued". Cancel and resubmit once.
      cancelJob_(id);
      try {
        const src = step === 1 ? row[C['Source File ID']] : aiFileIds_(row)[0];
        const list = characters_();
        const prompt = step === 1 ? characterPrompt_(list.find(c => c.id === row[C['Character']]) || list[0], sizeOf_(row)) : animatedPrompt_();
        const newId = startJob_(fileB64_(src), prompt, sizeOf_(row));
        withLock_(() => { const f = findRow_(C['Token'], token); setCells_(f.sheet, f.rowIndex, { 'Job': newId + '|' + (attempt + 1), 'Job Started': new Date() }); });
        return Object.assign({ ok: true, pending: true, step, status: 'requeued', seconds: 0 }, extra);
      } catch (err) { return failStep_(token, err, backTo); }
    }
    return Object.assign({ ok: true, pending: true, step, status: resp.status, seconds: Math.round(age) }, extra);
  }
  // failed / incomplete / cancelled
  const why = (resp.error && resp.error.message) || (resp.incomplete_details && ('incomplete: ' + resp.incomplete_details.reason)) || ('AI job ' + resp.status);
  return failStep_(token, new Error(why), backTo);
}

/* ---------------- prompts ---------------- */
function characterPrompt_(character, size) {
  const o = orientation_(size || '1024x1536');
  const framing = o === 'landscape'
    ? 'FRAMING: wide landscape group portrait facing the camera, everyone fully in frame from the waist up with room around them, same poses as the reference.'
    : 'FRAMING: tall portrait, everyone in frame from the waist up (or full length for small children), facing the camera, same poses as the reference.';
  return [
    setting_('IDENTITY_PROMPT'),
    '',
    `TASK: Turn this reference photo into a magical birthday photo-booth portrait for a "Crystal Royale" party. Look: "${character.name}".`,
    `COSTUME: ${character.costume}.`,
    `SCENE: ${character.scene}.`,
    framing,
    'HEADCOUNT: keep exactly the same number of people, in the same arrangement, with the same expressions and head angles — never add, merge or drop anyone. ' +
    'Every person wears the look, adapted naturally to their age and to them. Only clothing, accessories, props, lighting and background change — faces never change. ' +
    'No masks, no face paint, no heavy makeup that covers or reshapes facial features. ' +
    'Photorealistic photograph with natural skin texture, real lens and soft dreamy pastel lighting (lavender, blush pink, gold sparkles). ' +
    'This is a children\'s birthday party: everything wholesome, modest and age-appropriate. No text, letters, logos or watermarks. ' +
    'Do not copy any existing film, toy or brand character.',
    '',
    'FINAL CHECK: every face must be identical to the reference photo.'
  ].join('\n');
}

function animatedPrompt_() {
  return [
    setting_('IDENTITY_PROMPT'),
    '',
    'TASK: Re-render this exact picture as a still frame from a high-end 3D computer-animated family feature film.',
    'The ONLY thing that changes is the rendering style. Keep the same people, the same number of people, the same costumes, ' +
    'props, poses, expressions, head angles, composition, camera angle and Crystal Royale palace scene, with the same framing and orientation.',
    'STYLE: ' + setting_('ANIMATED_STYLE'),
    'LIKENESS IN THE ANIMATED STYLE: each person must still be instantly recognisable as themselves. Keep each person\'s exact skin tone ' +
    '(never lighter), face shape, jaw and nose shape, eye shape and colour, eyebrows, hairstyle, hair colour and hairline, glasses, facial hair, ' +
    'visible moles or freckles, apparent age and body type. Stylise them the way an animation studio would design a character based on that real person, ' +
    'never as a generic cartoon face.',
    'Do not turn anyone into an existing animated character. Wholesome and age-appropriate for a children\'s party. No text, letters, logos or watermarks.',
    '',
    'FINAL CHECK: a friend looking at this should immediately name every person in it.'
  ].join('\n');
}

/* ---------------- OpenAI plumbing ---------------- */
function apiKey_() {
  const key = PropertiesService.getScriptProperties().getProperty('OPENAI_API_KEY');
  if (!key) throw new Error('OPENAI_API_KEY is not set in Script Properties.');
  return key.trim();
}
function aiEngine_() { return String(setting_('AI_ENGINE') || 'direct').toLowerCase() === 'background' ? 'background' : 'direct'; }
function imageModel_() { return String(setting_('OPENAI_MODEL') || 'gpt-image-1-mini').trim(); }
function quality_() { return String(setting_('IMAGE_QUALITY') || 'medium').trim().toLowerCase(); }

/** input_fidelity: gpt-image-1-mini only accepts "low" (its default), so it is never sent for mini models. */
function fidelityFor_(model) {
  const s = String(setting_('INPUT_FIDELITY') || 'auto').trim().toLowerCase();
  if (s === 'off' || /mini/i.test(model) || /^gpt-image-2/i.test(model)) return null;
  return s === 'low' ? 'low' : 'high';
}

/** JSON call to OpenAI. If OpenAI rejects one of the optional fields, drop it and try once more. */
function openaiJson_(method, path, body) {
  const optional = ['action', 'input_fidelity', 'output_compression', 'quality'];
  for (let tryNo = 0; tryNo < optional.length + 1; tryNo++) {
    const opts = { method, headers: { Authorization: 'Bearer ' + apiKey_() }, muteHttpExceptions: true };
    if (body) { opts.contentType = 'application/json'; opts.payload = JSON.stringify(body); }
    const res = UrlFetchApp.fetch('https://api.openai.com/v1' + path, opts);
    const code = res.getResponseCode();
    let data = {};
    try { data = JSON.parse(res.getContentText()); } catch (x) {}
    if (code >= 200 && code < 300) return data;
    const msg = (data.error && data.error.message) || ('OpenAI HTTP ' + code + ': ' + res.getContentText().slice(0, 200));
    const tool = body && body.tools && body.tools[0];
    const bad = tool && code === 400 && optional.find(k => k in tool && new RegExp(k, 'i').test(msg + ' ' + ((data.error && data.error.param) || '')));
    if (!bad) throw new Error(msg);
    console.warn(`OpenAI rejected "${bad}" — retrying without it. (${msg})`);
    delete tool[bad];
  }
  throw new Error('OpenAI rejected the request.');
}

function imageTool_(size) {
  const model = imageModel_();
  const tool = { type: 'image_generation', model, quality: quality_(), size: size || '1024x1536',
                 output_format: 'jpeg', output_compression: 82, action: 'edit' };
  const f = fidelityFor_(model); if (f) tool.input_fidelity = f;
  return tool;
}

/** Starts a background job and returns its id (takes a second or two). */
function startJob_(imageB64, prompt, size) {
  const tool = imageTool_(size);
  const content = imageB64
    ? [{ type: 'input_text', text: 'Use the image_generation tool to EDIT the attached photo. Give the tool these instructions in full — do not shorten, soften or reinterpret them:\n\n' + prompt },
       { type: 'input_image', image_url: 'data:image/jpeg;base64,' + imageB64 }]
    : [{ type: 'input_text', text: 'Use the image_generation tool to create this picture:\n\n' + prompt }];
  if (!imageB64) { tool.action = 'generate'; delete tool.input_fidelity; }
  const data = openaiJson_('post', '/responses', {
    model: String(setting_('AI_TEXT_MODEL') || 'gpt-4.1-mini').trim(),
    background: true,
    input: [{ role: 'user', content }],
    tools: [tool],
    tool_choice: { type: 'image_generation' }
  });
  if (!data.id) throw new Error('OpenAI did not return a job id.');
  return data.id;
}
function getJob_(id) { return openaiJson_('get', '/responses/' + encodeURIComponent(id)); }
function cancelJob_(id) { try { openaiJson_('post', '/responses/' + encodeURIComponent(id) + '/cancel', {}); } catch (x) {} }

function extractImage_(resp) {
  const out = resp.output || [];
  const call = out.find(o => o.type === 'image_generation_call' && o.result);
  if (call) return call.result;
  const failed = out.find(o => o.type === 'image_generation_call');
  if (failed) throw new Error('Image tool ' + (failed.status || 'failed') + (failed.error ? ': ' + (failed.error.message || failed.error) : ''));
  const text = out.filter(o => o.type === 'message').map(o => (o.content || []).map(c => c.text || '').join(' ')).join(' ').trim();
  throw new Error('No image returned' + (text ? ': ' + text.slice(0, 200) : '.'));
}

/** AI_ENGINE = "direct": one /images/edits call that waits for the picture.
 *  Sent as JSON with images:[{image_url: data URL}] — the same format proven in production
 *  booths. Apps Script allows a single request to run for minutes (execution limit 6 min). */
function directEdit_(imageB64, prompt, size) {
  const model = imageModel_();
  const payload = { model, prompt, images: [{ image_url: 'data:image/jpeg;base64,' + imageB64 }],
                    size: size || '1024x1536', quality: quality_(), output_format: 'jpeg', output_compression: 82, n: 1 };
  const f = fidelityFor_(model); if (f) payload.input_fidelity = f;
  const started = Date.now();
  let lastErr = '';
  for (let attempt = 1; attempt <= 4; attempt++) {
    const res = UrlFetchApp.fetch('https://api.openai.com/v1/images/edits', {
      method: 'post', contentType: 'application/json', headers: { Authorization: 'Bearer ' + apiKey_() },
      payload: JSON.stringify(payload), muteHttpExceptions: true });
    const code = res.getResponseCode(), text = res.getContentText();
    if (code === 200) {
      const b64 = ((JSON.parse(text).data || [{}])[0] || {}).b64_json;
      if (!b64) throw new Error('The AI returned no image.');
      return b64;
    }
    let msg = text.slice(0, 300); try { msg = JSON.parse(text).error.message || msg; } catch (x) {}
    lastErr = 'HTTP ' + code + ' — ' + msg;
    // A setting this model doesn't accept: drop it and go again straight away.
    if (code === 400 && /not support|unsupported|unknown[_ ]parameter|invalid/i.test(text)) {
      let dropped = null;
      if (/input_fidelity/i.test(text) && 'input_fidelity' in payload) { delete payload.input_fidelity; dropped = 'input_fidelity'; }
      else if (/output_compression/i.test(text) && 'output_compression' in payload) { delete payload.output_compression; dropped = 'output_compression'; }
      else if (/quality/i.test(text) && payload.quality !== 'auto') { payload.quality = 'auto'; dropped = 'quality'; }
      else if (/\bsize\b/i.test(text) && payload.size !== 'auto') { payload.size = 'auto'; dropped = 'size'; }
      if (dropped) { console.warn(`Model ${model} rejected "${dropped}" — retrying without it.`); continue; }
    }
    if (code === 400 && /moderation|safety|content_policy|rejected/i.test(text)) throw new Error('Safety system: ' + msg);
    if (code === 401) throw new Error('Incorrect API key (401): ' + msg);
    // Busy / wobbling: one more go if there is clearly time to finish it.
    if ((code === 429 || code >= 500) && attempt < 3 && Date.now() - started < 150000) { Utilities.sleep(code === 429 ? 4000 : 3000); continue; }
    break;
  }
  throw new Error('AI generation failed (' + lastErr + ')');
}

function friendlyError_(err) {
  const m = String((err && err.message) || err || '');
  if (/safety|moderation|rejected|content policy/i.test(m)) return 'The magic was blocked by the safety filter. Please try another look.';
  if (/timeout|timed out|Exceeded|still "/i.test(m)) return 'The spell took too long. Please tap Try Again.';
  if (/OPENAI_API_KEY|Incorrect API key|invalid_api_key|401/i.test(m)) return 'The booth\'s AI key is not working. Please call the staff.';
  if (/verif/i.test(m)) return 'The booth\'s OpenAI account needs verification. Please call the staff.';
  if (/quota|billing|insufficient|rate limit|429/i.test(m)) return 'The booth\'s AI account is out of credit or busy. Please call the staff.';
  return 'The spell fizzled. Please tap Try Again.';
}

/* ============================================================
 *  SAVE FINAL COLLAGE + SHARE CODE (for the QR download)
 * ============================================================ */
function save_(token, layoutId, imageB64) {
  if (!token || !imageB64) return { ok: false, error: 'Missing image.' };
  const props = PropertiesService.getScriptProperties();
  return withLock_(() => {
    const { sheet, rowIndex, row } = findRow_(C['Token'], token);
    if (!row) return { ok: false, error: 'Session not found.' };
    if (row[C['Status']] === 'DONE') return { ok: true, shareCode: row[C['Share Code']] };
    if (row[C['Status']] !== 'GENERATED') return { ok: false, error: 'Photo is not ready yet.' };

    const folder = DriveApp.getFolderById(props.getProperty('FOLDER_ID'));
    const stamp = Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'yyyyMMdd-HHmmss');
    const file = folder.createFile(Utilities.newBlob(Utilities.base64Decode(imageB64), 'image/jpeg',
      `CRYSTAL_${row[C['PIN']]}_${stamp}.jpg`));
    logPhoto_(file, row[C['PIN']], 'collage', row[C['Character']], layoutId);
    const shareCode = randomCode_(10);
    setCells_(sheet, rowIndex, { 'Status': 'DONE', 'Done': new Date(), 'Layout': layoutId || '',
                                 'Photo File ID': file.getId(), 'Share Code': shareCode });
    return { ok: true, shareCode };
  });
}

/** Download page: returns all three pictures — the collage, the character photo and the animated photo. */
function getPhoto_(code) {
  code = String(code || '').trim();
  if (!code) return { ok: false, error: 'Missing code.' };
  const { row } = findRow_(C['Share Code'], code);
  if (!row) return { ok: false, error: 'Photo not found.' };
  const collageId = row[C['Photo File ID']];
  if (!collageId) return { ok: false, error: 'These photos have expired.' };
  const ids = aiFileIds_(row);
  const list = [
    { id: 'collage', label: 'Photo collage', fileId: collageId },
    { id: 'photo1',  label: 'Crystal Royale portrait', fileId: ids[0] },
    { id: 'photo2',  label: '3D animated film photo', fileId: ids[1] }
  ].filter(x => x.fileId);
  // Public links (PUBLIC_PHOTO_LINKS): send small lh3/Drive links instead of three big images in one reply,
  // which keeps the reply well under the size where Apps Script responses get cut off.
  const linkMode = bool_(setting_('PUBLIC_PHOTO_LINKS'));
  const photos = list.map(x => linkMode
    ? { id: x.id, label: x.label, url: lh3_(x.fileId), download: 'https://drive.google.com/uc?export=download&id=' + x.fileId }
    : { id: x.id, label: x.label, dataUrl: 'data:image/jpeg;base64,' + Utilities.base64Encode(DriveApp.getFileById(x.fileId).getBlob().getBytes()) });
  return { ok: true, photos, dataUrl: photos[0].dataUrl || '', url: photos[0].url || '', retentionDays: Number(setting_('RETENTION_DAYS')) || 7 };
}

/* ============================================================
 *  PAID PRINTS  (PRINT_PRICE per 5R print, approved by staff)
 * ============================================================ */
const PRINT_ITEMS = { collage: 'Photo collage', photo1: 'Character photo', photo2: '3D animated photo' };
const PRINTS_SHEET = 'Prints';
const PRINT_HEADERS = ['Time', 'Order ID', 'PIN', 'Share Code', 'Collage', 'Character photo', '3D animated photo', 'Total prints', 'Price each', 'Amount'];

function printPricing_() {
  const st = settings_();
  return { price: Number(st.PRINT_PRICE) || 0, currency: st.CURRENCY || '₱', maxCopies: Number(st.MAX_COPIES) || 10,
           enabled: bool_(st.PRINTING_ENABLED) };
}

function printOrder_(token, items, staffCode) {
  const pricing = printPricing_();
  if (!pricing.enabled) return { ok: false, error: 'Printing is switched off today.' };
  const staff = String(setting_('STAFF_CODE') || '').trim();
  if (!staff) return { ok: false, error: 'Printing is not set up yet (STAFF_CODE is empty in Settings). Please call the staff.' };

  // Throttle wrong staff codes per session: 5 tries per 10 minutes.
  const cache = CacheService.getScriptCache(), key = 'sc_' + token;
  const tries = Number(cache.get(key) || 0);
  if (tries >= 5) return { ok: false, error: 'Too many wrong staff codes. Please wait 10 minutes.' };
  if (String(staffCode || '') !== String(staff)) {
    cache.put(key, String(tries + 1), 600);
    return { ok: false, error: 'Wrong staff code. Please ask the counter to confirm payment.' };
  }

  const qty = {};
  let total = 0;
  (Array.isArray(items) ? items : []).forEach(it => {
    if (!PRINT_ITEMS[it.id]) return;
    const n = Math.max(0, Math.min(pricing.maxCopies, parseInt(it.copies, 10) || 0));
    qty[it.id] = (qty[it.id] || 0) + n; total += n;
  });
  if (!total) return { ok: false, error: 'Choose at least one photo to print.' };

  return withLock_(() => {
    const { row } = findRow_(C['Token'], token);
    if (!row) return { ok: false, error: 'Session not found.' };
    if (row[C['Status']] !== 'DONE') return { ok: false, error: 'Photos are not saved yet.' };
    const sh = printsSheet_();
    const demo = isDemo_(row[C['PIN']]);
    const orderId = (demo ? 'DEMO-' : 'P') + Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'MMddHHmmss');
    const amount = demo ? 0 : total * pricing.price;      // demo prints are logged but not counted as sales
    sh.appendRow([new Date(), orderId, String(row[C['PIN']]), row[C['Share Code']],
                  qty.collage || 0, qty.photo1 || 0, qty.photo2 || 0, total, pricing.price, amount]);
    return { ok: true, orderId, total, amount, currency: pricing.currency };
  });
}

function printsSheet_() {
  const id = PropertiesService.getScriptProperties().getProperty('SHEET_ID');
  const ss = id ? SpreadsheetApp.openById(id) : SpreadsheetApp.getActiveSpreadsheet();
  let sh = ss.getSheetByName(PRINTS_SHEET);
  if (!sh) {
    sh = ss.insertSheet(PRINTS_SHEET);
    sh.getRange(1, 1, 1, PRINT_HEADERS.length).setValues([PRINT_HEADERS]).setFontWeight('bold').setBackground('#7c2d12').setFontColor('#fde68a');
    sh.setFrozenRows(1); sh.getRange('C:C').setNumberFormat('@');
  }
  return sh;
}

/* ============================================================
 *  HELPERS
 * ============================================================ */
function sheet_() {
  const sh = sheetRaw_();
  if (sh && sh.getLastColumn() < HEADERS.length) {     // older sheet: add the new columns
    sh.getRange(1, 1, 1, HEADERS.length).setValues([HEADERS]).setFontWeight('bold').setBackground('#2e1065').setFontColor('#fde68a');
  }
  return sh;
}
function sheetRaw_() {
  const id = PropertiesService.getScriptProperties().getProperty('SHEET_ID');
  const ss = id ? SpreadsheetApp.openById(id) : SpreadsheetApp.getActiveSpreadsheet();
  return ss.getSheetByName(SHEET_NAME);
}

function findRow_(colIndex, value) {
  const sheet = sheet_();
  const values = sheet.getDataRange().getValues();
  for (let r = 1; r < values.length; r++) {
    if (String(values[r][colIndex]) === String(value) && String(value) !== '') {
      return { sheet, rowIndex: r + 1, row: values[r] };
    }
  }
  return { sheet, rowIndex: -1, row: null };
}

function setCells_(sheet, rowIndex, obj) {
  Object.keys(obj).forEach(k => sheet.getRange(rowIndex, C[k] + 1).setValue(obj[k]));
}

function withLock_(fn) {
  const lock = LockService.getScriptLock();
  lock.waitLock(20000);
  try { return fn(); } finally { lock.releaseLock(); }
}

function randomCode_(len) {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  const bytes = Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, Utilities.getUuid() + Date.now());
  let s = '';
  for (let i = 0; i < len; i++) s += chars[(bytes[i] + 256) % chars.length];
  return s;
}

/* ============================================================
 *  ADMIN (Sheet menu)
 * ============================================================ */
/** Shows a pop-up when run from the Sheet menu; prints to the Execution log when run from the Apps Script editor. */
function say_(msg, title) {
  console.log((title ? title + '\n' : '') + msg);
  try {
    const ui = SpreadsheetApp.getUi();
    title ? ui.alert(title, msg, ui.ButtonSet.OK) : ui.alert(msg);
  } catch (x) { /* editor / trigger: no pop-ups — the Execution log has the message */ }
}

function onOpen() {
  SpreadsheetApp.getUi().createMenu('👑 Photo Booth')
    .addItem('1. Setup (run once)', 'setup')
    .addItem('Generate PINs…', 'menuGeneratePins')
    .addItem('Reset selected PIN (allow re-shoot)', 'menuResetPin')
    .addItem('Void selected PIN', 'menuVoidPin')
    .addSeparator()
    .addItem('⚙️ Open Settings', 'menuOpenSettings')
    .addItem('🧙 Open Characters', 'menuOpenCharacters')
    .addItem('Apply changes now', 'menuApplySettings')
    .addItem('Add missing settings / characters', 'menuRepairSettings')
    .addSeparator()
    .addItem('Test OpenAI key', 'testOpenAIKey')
    .addItem('🧪 Test AI generation (shows the real error)', 'testAI')
    .addItem('📷 Check photo storage', 'menuCheckStorage')
    .addItem('📷 Refresh Photos tab (status + missing files)', 'menuSyncPhotos')
    .addItem('Show today\'s stats', 'menuStats')
    .addItem('Install daily cleanup', 'installCleanupTrigger')
    .addToUi();
}

function setup() {
  const props = PropertiesService.getScriptProperties();
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  if (!ss) throw new Error('Open this script from its Google Sheet (Extensions → Apps Script).');
  props.setProperty('SHEET_ID', ss.getId());

  let sh = ss.getSheetByName(SHEET_NAME);
  if (!sh) sh = ss.insertSheet(SHEET_NAME);
  sh.getRange(1, 1, 1, HEADERS.length).setValues([HEADERS]).setFontWeight('bold').setBackground('#2e1065').setFontColor('#fde68a');
  sh.setFrozenRows(1);
  sh.getRange('A:A').setNumberFormat('@');
  sh.getRange('L:L').setNumberFormat('@');

  if (!props.getProperty('FOLDER_ID')) {
    const folder = DriveApp.createFolder('Crystal Royale Booth – Photos');
    props.setProperty('FOLDER_ID', folder.getId());
  }
  settingsSheet_();
  charactersSheet_();
  printsSheet_();
  photosSheet_();
  migrateSettings_();
  clearSettingsCache_();
  installCleanupTrigger();
  say_('✅ Setup complete.\n\nNext:\n1. Project Settings → Script properties → add OPENAI_API_KEY.\n2. Settings tab → fill in STAFF_CODE (and adjust prices, texts, timers).\n3. Deploy → New deployment → Web app.');
}

function menuGeneratePins() {
  let n = 20;
  try {
    const ui = SpreadsheetApp.getUi();
    const res = ui.prompt('Generate PINs', 'How many PINs? (e.g. 50)', ui.ButtonSet.OK_CANCEL);
    if (res.getSelectedButton() !== ui.Button.OK) return;
    n = parseInt(res.getResponseText(), 10) || 0;
  } catch (x) { /* run from the editor: make 20 */ }
  n = Math.min(Math.max(n, 1), 1000);
  const pins = generatePins(n);
  say_(`Created ${pins.length} PINs:\n\n` + pins.slice(0, 40).join('  ') + (pins.length > 40 ? ' …' : ''));
}

/** Creates n unique 6-digit PINs. Can also be run directly from the editor. */
function generatePins(n) {
  n = n || 20;
  const sh = sheet_();
  const existing = new Set(sh.getRange(1, 1, Math.max(sh.getLastRow(), 1), 1).getValues().flat().map(String));
  const out = [];
  while (out.length < n) {
    const pin = String(Math.floor(100000 + Math.random() * 900000));
    if (existing.has(pin)) continue;
    existing.add(pin); out.push(pin);
  }
  const now = new Date();
  const rows = out.map(p => { const r = new Array(HEADERS.length).fill(''); r[C['PIN']] = p; r[C['Status']] = 'NEW'; r[C['Created']] = now; r[C['Attempts']] = 0; return r; });
  sh.getRange(sh.getLastRow() + 1, 1, rows.length, HEADERS.length).setValues(rows);
  return out;
}

function menuResetPin() { changeSelected_('ACTIVE', 'Reset by staff'); }
function menuVoidPin()  { changeSelected_('VOID', 'Voided by staff'); }

function changeSelected_(status, note) {
  const sh = SpreadsheetApp.getActiveSheet();
  if (sh.getName() !== SHEET_NAME) { say_('Open the Sheet, click a row in the PINs tab, then use the 👑 Photo Booth menu.'); return; }
  const r = sh.getActiveRange().getRow();
  if (r < 2) return;
  const patch = { 'Status': status, 'Note': note };
  if (status === 'ACTIVE') Object.assign(patch, { 'Attempts': 0, 'Generated': '', 'AI File IDs': '', 'Done': '', 'Photo File ID': '', 'Share Code': '', 'Job': '', 'Job Started': '', 'Source File ID': '' });
  setCells_(sh, r, patch);
  say_(`PIN ${sh.getRange(r, 1).getValue()} → ${status}`);
}

function menuStats() {
  const values = sheet_().getDataRange().getValues().slice(1);
  const counts = {};
  values.forEach(v => counts[v[C['Status']]] = (counts[v[C['Status']]] || 0) + 1);
  const today = Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'yyyy-MM-dd');
  const demoToday = values.filter(v => isDemo_(v[C['PIN']]) && v[C['Created']] && Utilities.formatDate(new Date(v[C['Created']]), Session.getScriptTimeZone(), 'yyyy-MM-dd') === today).length;
  const doneToday = values.filter(v => !isDemo_(v[C['PIN']]) && v[C['Done']] && Utilities.formatDate(new Date(v[C['Done']]), Session.getScriptTimeZone(), 'yyyy-MM-dd') === today).length;
  const pr = printsSheet_().getDataRange().getValues().slice(1)
    .filter(v => v[0] && Utilities.formatDate(new Date(v[0]), Session.getScriptTimeZone(), 'yyyy-MM-dd') === today);
  const printsToday = pr.reduce((a, v) => a + Number(v[7] || 0), 0), cashToday = pr.reduce((a, v) => a + Number(v[9] || 0), 0);
  const cur = printPricing_().currency;
  say_('Photos finished today: ' + doneToday + '  (+ ' + demoToday + ' demo sessions)' +
    '\nPrints today: ' + printsToday + ' (' + pr.length + ' orders) = ' + cur + cashToday +
    '\n\n' + Object.keys(counts).map(k => `${k}: ${counts[k]}`).join('\n'));
}

function testOpenAIKey() {
  const key = PropertiesService.getScriptProperties().getProperty('OPENAI_API_KEY');
  if (!key) { say_('OPENAI_API_KEY is missing.'); return; }
  const r = UrlFetchApp.fetch('https://api.openai.com/v1/models', { headers: { Authorization: 'Bearer ' + key }, muteHttpExceptions: true });
  say_(r.getResponseCode() === 200 ? '✅ OpenAI key works.' : '❌ OpenAI said: ' + r.getContentText().slice(0, 300));
}

/* ---------------- Privacy: delete photos after RETENTION_DAYS ---------------- */
function installCleanupTrigger() {
  ScriptApp.getProjectTriggers().filter(t => t.getHandlerFunction() === 'purgeOldPhotos').forEach(t => ScriptApp.deleteTrigger(t));
  ScriptApp.newTrigger('purgeOldPhotos').timeBased().everyDays(1).atHour(4).create();
}

function purgeOldPhotos() {
  const days = Number(setting_('RETENTION_DAYS')) || 7;
  const cutoff = Date.now() - days * 86400000;
  const sh = sheet_();
  const values = sh.getDataRange().getValues();
  for (let r = 1; r < values.length; r++) {
    const row = values[r];
    const when = new Date(row[C['Done']] || row[C['Generated']] || 0).getTime();
    if (!when || when > cutoff) continue;
    const ids = String(row[C['AI File IDs']] || '').split(',').concat([row[C['Photo File ID']], row[C['Source File ID']]]).filter(String);
    if (!ids.length) continue;
    ids.forEach(id => { try { DriveApp.getFileById(id).setTrashed(true); } catch (x) {} });
    markPhotos_(ids, `Deleted after ${days} days (in Drive trash for 30 days)`);
    setCells_(sh, r + 1, { 'AI File IDs': '', 'Photo File ID': '', 'Source File ID': '', 'Note': 'Photos purged ' + new Date().toISOString().slice(0, 10) });
  }
}

/* ============================================================
 *  SETTINGS & CHARACTERS TABS (customise from the Google Sheet)
 * ============================================================ */
const SETTINGS_SHEET = 'Settings';
const CHARACTERS_SHEET = 'Characters';
const CHAR_HEADERS = ['Enabled', 'ID', 'Name', 'Emoji', 'Tagline', 'Color', 'Costume (sent to AI)', 'Scene (sent to AI)'];

/* group · key · default · description · public (sent to the booth app) · allowed values */
const SETTINGS_DEFS = [
  { group: 'Guest screens', key: 'BOOTH_NAME',     value: 'Crystal Royale Photo Booth', public: true,  desc: 'App name (browser tab, install banner).' },
  { group: 'Guest screens', key: 'THEME_TITLE',    value: 'Photo Booth',       public: true,  desc: 'Big animated title on the opening screen. Each word goes on its own line.' },
  { group: 'Guest screens', key: 'SUBTITLE',       value: 'Crystal Royale · Meghan turns 7',        public: true,  desc: 'Small text under the title.' },
  { group: 'Guest screens', key: 'TAGLINE',        value: 'Step into the palace: become royalty, then see yourself in a 3D animated film.', public: true, desc: 'Line under "Tap to Begin".' },
  { group: 'PIN Slip',      key: 'PIN_PRICE',      value: 0,     public: true,  desc: 'Not shown at this party (guests get PIN slips at the photo booth counter). Kept for paid events.' },
  { group: 'PIN Slip',      key: 'CURRENCY',       value: '₱',     public: true,  desc: 'Currency symbol for all prices.' },
  { group: 'PIN Slip',      key: 'DEMO_PIN',       value: '000000', public: false, desc: 'Staff demo PIN. Runs the full flow with REAL AI (uses OpenAI credit) and is never charged to a PIN. Each use is logged as a DEMO-… row. Leave empty to disable.' },
  { group: 'PIN Slip',      key: 'DEMO_DAILY_LIMIT', value: 20,     public: false, desc: 'Most demo sessions per day, so a leaked demo PIN cannot run up your OpenAI bill. 0 = no limit.' },
  { group: 'Prints',        key: 'PRINTING_ENABLED', value: false,  public: true,  desc: 'Off for Meghan\'s party: QR download only. Tick (and set STAFF_CODE) to offer paid 5R prints at another event.', type: 'bool' },
  { group: 'Prints',        key: 'PRINT_PRICE',    value: 0,      public: true,  desc: 'Price per 5R print (each copy).' },
  { group: 'Prints',        key: 'MAX_COPIES',     value: 10,      public: true,  desc: 'Most copies of one photo per order.' },
  { group: 'Prints',        key: 'STAFF_CODE',     value: '',      public: false, desc: 'Code staff type on the booth after taking payment for prints. Required for printing. Keep this sheet private.' },
  { group: 'Booth timing',  key: 'CAMERA_COUNTDOWN', value: 10,    public: true,  desc: 'Seconds to pose after tapping "I\'m Ready" (the only timer).' },
  { group: 'Booth timing',  key: 'RESULT_IDLE_SECONDS', value: 180, public: true, desc: 'Result screen returns to the start after this many seconds without a tap.' },
  { group: 'Booth timing',  key: 'MIRROR_OUTPUT',  value: true,    public: true,  desc: 'Tick: photo looks like the selfie preview. Untick: true (un-mirrored) view.', type: 'bool' },
  { group: 'Layouts',       key: 'LAYOUTS',        value: 'frame1, frame2', public: true, desc: 'Backgrounds offered to guests, in order. frame1 = Crystal Castle (portrait), frame2 = Rose Garden Palace (landscape). Remove one to hide it.' },
  { group: 'AI',            key: 'AI_ENGINE',      value: 'direct', public: false, desc: 'direct (recommended) = one /images/edits call that waits for the picture; your prompt goes to the image model word for word. background = start an OpenAI job and check back every few seconds (backup if direct calls time out; adds a small helper-model cost).', options: ['direct', 'background'] },
  { group: 'AI',            key: 'OPENAI_MODEL',   value: 'gpt-image-1-mini', public: false, desc: 'OpenAI image model. Note: OpenAI retires gpt-image-1-mini on 1 Dec 2026 — switch before then (e.g. gpt-image-2).' },
  { group: 'AI',            key: 'AI_TEXT_MODEL',  value: 'gpt-4.1-mini', public: false, desc: 'Background engine only: the small model that hands your prompt to the image tool. Adds a little cost per picture.' },
  { group: 'AI',            key: 'IMAGE_QUALITY',  value: 'medium', public: false, desc: 'low = fastest & cheapest, high = most detail (slower).', options: ['low', 'medium', 'high'] },
  { group: 'AI',            key: 'INPUT_FIDELITY', value: 'auto',  public: false, desc: 'Face-matching strength. auto = high where the model supports it. gpt-image-1-mini only supports low (its default), so nothing is sent for mini models.', options: ['auto', 'high', 'low', 'off'] },
  { group: 'AI',            key: 'MAX_ATTEMPTS',   value: 3,       public: false, desc: 'AI retries per PIN before it needs staff (Reset PIN).' },
  { group: 'AI',            key: 'IDENTITY_PROMPT', value: IDENTITY_PROMPT, public: false, desc: 'Sent first in EVERY AI request. Highest priority: keeps guests recognisable.' },
  { group: 'AI',            key: 'ANIMATED_STYLE', value: 'polished cinematic 3D animation — soft subsurface-scattered skin, gently stylised proportions, slightly larger expressive eyes, smooth sculpted hair with clear strands, soft dreamy pastel lavender, blush-pink and gold fairytale lighting with sparkles, soft global illumination, shallow depth of field, charming and friendly.', public: false, desc: 'Look of the second photo (3D animated version of the first).' },
  { group: 'Privacy',       key: 'RETENTION_DAYS', value: 7,       public: false, desc: 'Photos are deleted from Drive after this many days (QR links stop working).' },
  { group: 'Privacy',       key: 'PUBLIC_PHOTO_LINKS', value: true, public: false, type: 'bool', desc: 'Tick: each saved photo is shared "anyone with the link can view", so its lh3 link and the preview in the Photos tab work. Untick: photos stay private to you (lh3 links then only work for you, and previews are blank). Links are long random IDs, but anyone who gets one can see that photo.' }
];

function bool_(v) { return v === true || /^(true|yes|1|on|y)$/i.test(String(v).trim()); }

/** All settings merged: Settings tab → Script Properties → default. Cached for 60 s. */
function settings_() {
  const cache = CacheService.getScriptCache();
  const hit = cache.get('settings_v1');
  if (hit) { try { return JSON.parse(hit); } catch (x) {} }
  const props = PropertiesService.getScriptProperties();
  const fromSheet = {};
  try {
    const sh = ssOrNull_() && ssOrNull_().getSheetByName(SETTINGS_SHEET);
    if (sh && sh.getLastRow() > 1) {
      sh.getRange(2, 1, sh.getLastRow() - 1, 3).getValues().forEach(r => {
        const k = String(r[1] || '').trim(); if (k) fromSheet[k] = r[2];
      });
    }
  } catch (x) { console.warn('Settings read failed: ' + x); }
  const out = {};
  SETTINGS_DEFS.forEach(d => {
    const v = fromSheet[d.key];
    if (v !== undefined && v !== '' && v !== null) out[d.key] = v;
    else if (props.getProperty(d.key) !== null) out[d.key] = props.getProperty(d.key);
    else out[d.key] = d.value;
    if (d.type === 'bool') out[d.key] = bool_(out[d.key]);
  });
  out.DEMO_PIN = String(out.DEMO_PIN || '').replace(/\D/g, '');
  try { cache.put('settings_v1', JSON.stringify(out), 60); } catch (x) {}
  return out;
}
function setting_(key) { return settings_()[key]; }

function writeSetting_(key, value) {
  const sh = settingsSheet_();
  const keys = sh.getRange(2, 2, Math.max(sh.getLastRow() - 1, 1), 1).getValues().flat().map(String);
  const i = keys.indexOf(key);
  if (i >= 0) sh.getRange(i + 2, 3).setValue(value);
  clearSettingsCache_();
}

/** Enabled characters from the Characters tab (falls back to the built-in list). Cached for 60 s. */
function characters_() {
  const cache = CacheService.getScriptCache();
  const hit = cache.get('characters_v1');
  if (hit) { try { return JSON.parse(hit); } catch (x) {} }
  let list = [];
  try {
    const sh = ssOrNull_() && ssOrNull_().getSheetByName(CHARACTERS_SHEET);
    if (sh && sh.getLastRow() > 1) {
      list = sh.getRange(2, 1, sh.getLastRow() - 1, CHAR_HEADERS.length).getValues()
        .filter(r => bool_(r[0]) && String(r[2]).trim())
        .map((r, i) => ({
          id: String(r[1] || '').trim() || ('char' + (i + 1)),
          name: String(r[2]).trim(), emoji: String(r[3] || '✨').trim(), tagline: String(r[4] || '').trim(),
          color: /^#[0-9a-f]{3,8}$/i.test(String(r[5]).trim()) ? String(r[5]).trim() : '#7c3aed',
          costume: String(r[6] || '').trim() || 'a Crystal Royale outfit matching the name "' + String(r[2]).trim() + '"',
          scene: String(r[7] || '').trim() || PALACE
        }));
    }
  } catch (x) { console.warn('Characters read failed: ' + x); }
  if (!list.length) list = THEME.characters;
  try { cache.put('characters_v1', JSON.stringify(list), 60); } catch (x) {}
  return list;
}

function clearSettingsCache_() { CacheService.getScriptCache().removeAll(['settings_v1', 'characters_v1']); }

function ssOrNull_() {
  const id = PropertiesService.getScriptProperties().getProperty('SHEET_ID');
  try { return id ? SpreadsheetApp.openById(id) : SpreadsheetApp.getActiveSpreadsheet(); } catch (x) { return null; }
}

/** Creates the Settings tab, or adds any missing rows to it (never overwrites your values). */
function settingsSheet_() {
  const ss = ssOrNull_();
  let sh = ss.getSheetByName(SETTINGS_SHEET);
  if (!sh) {
    sh = ss.insertSheet(SETTINGS_SHEET, 0);
    sh.getRange(1, 1, 1, 4).setValues([['Section', 'Setting', 'Value', 'What it does']])
      .setFontWeight('bold').setBackground('#2e1065').setFontColor('#fde68a');
    sh.setFrozenRows(1);
    sh.setColumnWidth(1, 120); sh.setColumnWidth(2, 190); sh.setColumnWidth(3, 380); sh.setColumnWidth(4, 460);
  }
  const existing = sh.getLastRow() > 1 ? sh.getRange(2, 2, sh.getLastRow() - 1, 1).getValues().flat().map(String) : [];
  SETTINGS_DEFS.forEach(d => {
    if (existing.indexOf(d.key) >= 0) return;
    const props = PropertiesService.getScriptProperties();
    const start = props.getProperty(d.key) !== null ? props.getProperty(d.key) : d.value;   // carry over old Script Properties
    sh.appendRow([d.group, d.key, '', d.desc]);
    const r = sh.getLastRow(), cell = sh.getRange(r, 3);
    if (d.type === 'bool') { cell.insertCheckboxes(); cell.setValue(bool_(start)); }
    else {
      if (/^\d+$/.test(String(start)) && /PIN|CODE/.test(d.key)) cell.setNumberFormat('@');
      cell.setValue(start);
    }
    if (d.options) cell.setDataValidation(SpreadsheetApp.newDataValidation().requireValueInList(d.options, true).build());
    if (String(start).length > 120) cell.setWrap(true);
    sh.getRange(r, 4).setFontColor('#6b5b7b').setWrap(true);
    sh.getRange(r, 1).setFontColor('#7c3aed').setFontWeight('bold');
  });
  sh.getRange('C:C').setVerticalAlignment('top');
  return sh;
}

/** Creates the Characters tab with the Crystal Royale line-up (tick Enabled to show a character). */
function charactersSheet_() {
  const ss = ssOrNull_();
  let sh = ss.getSheetByName(CHARACTERS_SHEET);
  if (sh) return sh;
  sh = ss.insertSheet(CHARACTERS_SHEET, 1);
  sh.getRange(1, 1, 1, CHAR_HEADERS.length).setValues([CHAR_HEADERS]).setFontWeight('bold').setBackground('#2e1065').setFontColor('#fde68a');
  sh.setFrozenRows(1);
  const rows = THEME.characters.map(c => [true, c.id, c.name, c.emoji, c.tagline, c.color, c.costume, c.scene]);
  sh.getRange(2, 1, rows.length, CHAR_HEADERS.length).setValues(rows);
  sh.getRange(2, 1, 60, 1).insertCheckboxes();
  sh.getRange(2, 1, rows.length, 1).setValue(true);
  [70, 90, 160, 60, 200, 80, 420, 420].forEach((w, i) => sh.setColumnWidth(i + 1, w));
  sh.getRange(2, 7, 60, 2).setWrap(true).setVerticalAlignment('top');
  sh.getRange(rows.length + 3, 1).setValue('Tip: untick "Enabled" to hide a character. Add a row to create a new one — the order here is the order on the booth.')
    .setFontColor('#6b5b7b').setFontStyle('italic');
  return sh;
}

function onEdit(e) {
  try {
    const name = e && e.range && e.range.getSheet().getName();
    if (name === SETTINGS_SHEET || name === CHARACTERS_SHEET) clearSettingsCache_();
  } catch (x) {}
}

function menuOpenSettings()   { const ss = SpreadsheetApp.getActive(); ss.setActiveSheet(settingsSheet_()); }
function menuOpenCharacters() { const ss = SpreadsheetApp.getActive(); ss.setActiveSheet(charactersSheet_()); }
function menuApplySettings() {
  clearSettingsCache_();
  const st = settings_(), n = characters_().length;
  say_('✅ Changes applied.\n\nThe booth picks them up the next time it opens or reloads.\n\n' +
    `Characters enabled: ${n}\nPIN Slip: ${st.CURRENCY}${Number(st.PIN_PRICE).toFixed(2)}\n` +
    `Prints: ${st.PRINTING_ENABLED ? st.CURRENCY + st.PRINT_PRICE + ' each' : 'OFF'}\nCountdown: ${st.CAMERA_COUNTDOWN}s\n` +
    `Staff code: ${String(st.STAFF_CODE || '').trim() ? 'set' : '⚠️ EMPTY — printing will not work'}`);
}
/** One-time upgrades of values written by older versions (never touches values you chose later). */
function migrateSettings_() {
  const props = PropertiesService.getScriptProperties();
  if (props.getProperty('MIGRATED_V12')) return '';
  const sh = settingsSheet_();
  const keys = sh.getRange(2, 2, Math.max(sh.getLastRow() - 1, 1), 1).getValues().flat().map(String);
  const i = keys.indexOf('AI_ENGINE'); let note = '';
  if (i >= 0) {
    const cell = sh.getRange(i + 2, 3);
    cell.setDataValidation(SpreadsheetApp.newDataValidation().requireValueInList(['direct', 'background'], true).build());
    if (String(cell.getValue()).trim() === 'background') { cell.setValue('direct'); note = 'AI_ENGINE switched from background to direct (the proven /images/edits method).'; }
    sh.getRange(i + 2, 4).setValue(SETTINGS_DEFS.find(d => d.key === 'AI_ENGINE').desc);
  }
  props.setProperty('MIGRATED_V12', '1'); clearSettingsCache_();
  return note;
}

function menuRepairSettings() { settingsSheet_(); charactersSheet_(); photosSheet_(); const mig = migrateSettings_(); if (mig) say_(mig); clearSettingsCache_(); say_('Settings and Characters tabs are up to date.'); }

/* ============================================================
 *  🧪 TEST AI — runs one real picture and reports exactly what happened
 * ============================================================ */
function testAI() {
  clearSettingsCache_();
  const lines = [], t0 = Date.now(), secs = () => ((Date.now() - t0) / 1000).toFixed(1) + ' s';
  const engine = aiEngine_(), model = imageModel_();
  lines.push(`Engine: ${engine}   Image model: ${model}   Quality: ${quality_()}`);
  if (engine === 'background') lines.push(`Helper model: ${setting_('AI_TEXT_MODEL')}`);
  lines.push(`input_fidelity sent: ${fidelityFor_(model) || '(none)'}`);
  lines.push('', '— Booth connection —', ...boothConnection_(), '', '— AI test —');
  try {
    apiKey_();
    // Use the newest guest photo if there is one, so the test matches real use.
    let src = null, srcName = '';
    const folder = DriveApp.getFolderById(PropertiesService.getScriptProperties().getProperty('FOLDER_ID'));
    const it = folder.getFiles(); let newest = 0;
    while (it.hasNext()) { const f = it.next(); if (/_0-original\.jpg$/.test(f.getName()) && f.getDateCreated().getTime() > newest) { newest = f.getDateCreated().getTime(); src = f; } }
    let b64 = null, prompt;
    if (src) {
      srcName = src.getName();
      lines.push('Test: EDIT the newest guest photo (' + srcName + ')');
      b64 = Utilities.base64Encode(src.getBlob().getBytes());
      prompt = characterPrompt_(characters_()[0], '1024x1536');
    } else {
      srcName = 'no-photo';
      lines.push('Test: no guest photo yet, so making a picture from text only');
      prompt = 'A sparkling crystal tiara on a velvet cushion in a lavender palace ballroom, soft golden light, photorealistic. No text.';
      if (engine === 'direct') {   // no photo to edit yet: use the newest TEST picture if there is one
        const t = DriveApp.getFolderById(PropertiesService.getScriptProperties().getProperty('FOLDER_ID')).getFiles();
        let newestT = null; while (t.hasNext()) { const f = t.next(); if (/^TEST_/.test(f.getName()) && (!newestT || f.getDateCreated() > newestT.getDateCreated())) newestT = f; }
        if (!newestT) throw new Error('Direct engine edits a photo, and there is none yet. Take one photo on the booth (demo PIN), or set AI_ENGINE = background once to make a test picture.');
        lines.push('Using earlier test picture: ' + newestT.getName());
        b64 = Utilities.base64Encode(newestT.getBlob().getBytes());
        prompt = characterPrompt_(characters_()[0], '1024x1536');
      }
    }
    let img;
    if (engine === 'direct') {
      img = directEdit_(b64, prompt, '1024x1536');
    } else {
      const id = startJob_(b64, prompt, '1024x1536');
      lines.push(`Job started in ${secs()} (id ${id})`);
      let resp, last = '';
      while ((Date.now() - t0) < 280000) {
        Utilities.sleep(4000);
        resp = getJob_(id);
        if (resp.status !== last) { lines.push(`  ${secs()}: ${resp.status}`); last = resp.status; }
        if (resp.status !== 'queued' && resp.status !== 'in_progress') break;
      }
      if (resp.status === 'queued' || resp.status === 'in_progress') { cancelJob_(id); throw new Error(`Still "${resp.status}" after ${secs()} — cancelled.`); }
      if (resp.status !== 'completed') throw new Error((resp.error && resp.error.message) || ('Job ended as ' + resp.status));
      img = extractImage_(resp);
    }
    const out = folder.createFile(Utilities.newBlob(Utilities.base64Decode(img), 'image/jpeg', 'TEST_' + srcName.replace('_0-original', '_test') + (b64 ? '' : '.jpg')));
    logPhoto_(out, 'TEST', 'test', '');
    lines.push('', `✅ SUCCESS in ${secs()}.`, 'Saved to Drive: ' + out.getUrl(), 'Also logged in the Photos tab.');
  } catch (err) {
    lines.push('', `❌ FAILED after ${secs()}:`, String(err.message || err));
    const m = String(err.message || err);
    if (/verif/i.test(m)) lines.push('', '→ Verify your organization at platform.openai.com → Settings → Organization → General.');
    else if (/quota|billing|insufficient/i.test(m)) lines.push('', '→ Add credit at platform.openai.com → Settings → Billing.');
    else if (/model/i.test(m)) lines.push('', '→ Check OPENAI_MODEL / AI_TEXT_MODEL in the Settings tab.');
    else if (/Timeout|Exceeded/i.test(m)) lines.push('', '→ Use AI_ENGINE = background in the Settings tab.');
  }
  say_(lines.join('\n'), '🧪 AI test');
}

/** Lines describing whether the booth app can reach this backend. */
function boothConnection_() {
  const out = [];
  let url = null;
  try { url = ScriptApp.getService().getUrl(); } catch (x) {}
  out.push('Web app URL: ' + (url || '⚠️ NOT DEPLOYED — Deploy → New deployment → Web app'));
  if (url && /\/dev$/.test(url)) out.push('⚠️ This is the /dev test URL. The booth needs the /exec URL from Deploy → Manage deployments.');
  let last = null;
  try { last = JSON.parse(PropertiesService.getScriptProperties().getProperty('LAST_CALL') || 'null'); } catch (x) {}
  if (!last) {
    out.push('Booth contact: ❌ the booth has NEVER reached this backend (since this version).');
    out.push('  → In config.js, API_URL must be the /exec URL above.');
    out.push('  → Deployment must be: Execute as "Me", Who has access "Anyone".');
    out.push('  → After pasting new code: Deploy → Manage deployments → ✏️ Edit → Version: New version → Deploy.');
  } else {
    const mins = Math.round((Date.now() - new Date(last.t).getTime()) / 60000);
    out.push(`Booth contact: ✅ last request "${last.action}" ${mins <= 0 ? 'just now' : mins + ' min ago'}.`);
  }
  return out;
}

/* ============================================================
 *  PHOTOS TAB — one row per picture saved to Drive (with lh3 link)
 * ============================================================ */
const PHOTOS_SHEET = 'Photos';
const PHOTO_HEADERS = ['Time', 'PIN', 'Type', 'Character', 'Layout', 'Preview', 'lh3 URL', 'Drive link', 'File name', 'File ID', 'Status'];
const PHOTO_TYPES = { '0-original': 'Guest photo (camera)', '1-character': 'AI Crystal Royale portrait', '2-animated': 'AI 3D animated film photo',
                      'collage': 'Collage (framed)', 'test': 'Test AI picture' };
function lh3_(id) { return 'https://lh3.googleusercontent.com/d/' + id; }

function photosSheet_() {
  const ss = ssOrNull_();
  let sh = ss.getSheetByName(PHOTOS_SHEET);
  if (sh) return sh;
  sh = ss.insertSheet(PHOTOS_SHEET);
  sh.getRange(1, 1, 1, PHOTO_HEADERS.length).setValues([PHOTO_HEADERS]).setFontWeight('bold').setBackground('#2e1065').setFontColor('#fde68a');
  sh.setFrozenRows(1);
  [140, 120, 160, 120, 80, 110, 330, 260, 300, 260, 200].forEach((w, i) => sh.setColumnWidth(i + 1, w));
  sh.getRange('B:B').setNumberFormat('@');
  return sh;
}

/** Shares the file (if PUBLIC_PHOTO_LINKS) and adds a row to the Photos tab. Never throws. */
function logPhoto_(file, pin, label, characterId, layoutId) {
  try {
    let status = 'Saved';
    if (bool_(setting_('PUBLIC_PHOTO_LINKS'))) {
      try { file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW); status = 'Saved · link sharing on'; }
      catch (x) { status = 'Saved · link sharing blocked by Google Workspace admin'; }
    } else status = 'Saved · private';
    const id = file.getId(), url = lh3_(id);
    const sh = photosSheet_();
    sh.appendRow([new Date(), String(pin || ''), PHOTO_TYPES[label] || label, characterId || '', layoutId || '',
                  /link sharing on/.test(status) ? '=IMAGE("' + url + '")' : '', url, file.getUrl(), file.getName(), id, status]);
    sh.setRowHeight(sh.getLastRow(), 90);
  } catch (x) { console.warn('Photos log failed: ' + x); }
}

/** Updates Status for rows whose File ID is in ids. */
function markPhotos_(ids, status) {
  try {
    const sh = photosSheet_(); const n = sh.getLastRow() - 1; if (n < 1) return;
    const col = PHOTO_HEADERS.indexOf('File ID') + 1, st = PHOTO_HEADERS.indexOf('Status') + 1;
    const vals = sh.getRange(2, col, n, 1).getValues();
    vals.forEach((v, i) => { if (ids.indexOf(String(v[0])) >= 0) sh.getRange(i + 2, st).setValue(status); });
  } catch (x) {}
}

function typeFromName_(name) {
  if (/^TEST_/.test(name)) return 'test';
  if (/^(CRYSTAL|HALLOWEEN)_/.test(name)) return 'collage';
  const m = name.match(/_(0-original|1-character|2-animated)\.jpg$/); return m ? m[1] : '';
}
function pinFromName_(name) {
  if (/^TEST_/.test(name)) return 'TEST';
  const m = name.match(/^(?:CRYSTAL|HALLOWEEN)_([^_]+)_/) || name.match(/^([^_]+)_\d{8}-\d{6}_/); return m ? m[1] : '';
}

/** Adds any Drive photo missing from the Photos tab, and refreshes each row's status (exists / in trash / gone). */
function syncPhotos_() {
  const sh = photosSheet_();
  const idCol = PHOTO_HEADERS.indexOf('File ID') + 1, stCol = PHOTO_HEADERS.indexOf('Status') + 1;
  const n = sh.getLastRow() - 1;
  const known = n > 0 ? sh.getRange(2, idCol, n, 1).getValues().map(r => String(r[0])) : [];
  const res = { added: 0, ok: 0, trashed: 0, gone: 0 };
  known.forEach((id, i) => {
    if (!id) return;
    let st;
    try { st = DriveApp.getFileById(id).isTrashed() ? 'In Drive trash (restore within 30 days)' : null; }
    catch (x) { st = 'Missing — deleted from Drive'; }
    if (!st) { res.ok++; return; }
    if (/trash/.test(st)) res.trashed++; else res.gone++;
    const cell = sh.getRange(i + 2, stCol);
    if (!/^Deleted after/.test(String(cell.getValue()))) cell.setValue(st);
  });
  const folder = DriveApp.getFolderById(PropertiesService.getScriptProperties().getProperty('FOLDER_ID'));
  const files = folder.getFiles(), add = [];
  while (files.hasNext()) {
    const f = files.next();
    if (known.indexOf(f.getId()) >= 0) continue;
    add.push(f);
  }
  add.sort((a, b) => a.getDateCreated() - b.getDateCreated()).forEach(f => {
    logPhoto_(f, pinFromName_(f.getName()), typeFromName_(f.getName()), '');
    const r = sh.getLastRow(); sh.getRange(r, 1).setValue(f.getDateCreated());
    res.added++; res.ok++;
  });
  return res;
}

function menuSyncPhotos() {
  const r = syncPhotos_();
  say_(`Photos tab refreshed.\n\nIn Drive: ${r.ok}\nIn Drive trash: ${r.trashed}\nMissing: ${r.gone}\nNewly added to the tab: ${r.added}`, '📷 Photos');
}

/** 📷 Check photo storage: where photos go, what is there, and whether anything was deleted. */
function menuCheckStorage() {
  const lines = [];
  const props = PropertiesService.getScriptProperties();
  const folderId = props.getProperty('FOLDER_ID');
  let folder;
  try { folder = DriveApp.getFolderById(folderId); }
  catch (x) { say_('❌ The photo folder is missing (FOLDER_ID ' + folderId + '). Run Setup again to create a new one.', '📷 Photo storage'); return; }
  lines.push('Folder: ' + folder.getName() + (folder.isTrashed() ? '  ⚠️ IN TRASH — restore it from Drive trash!' : ''));
  lines.push(folder.getUrl());
  const count = {}, trashedCount = {};
  let newest = null;
  const it = folder.getFiles();
  while (it.hasNext()) {
    const f = it.next(), t = PHOTO_TYPES[typeFromName_(f.getName())] || 'Other';
    count[t] = (count[t] || 0) + 1;
    if (!newest || f.getDateCreated() > newest.getDateCreated()) newest = f;
  }
  try { const tr = DriveApp.searchFiles(`trashed = true and '${folderId}' in parents`);
        while (tr.hasNext()) { const f = tr.next(), t = PHOTO_TYPES[typeFromName_(f.getName())] || 'Other'; trashedCount[t] = (trashedCount[t] || 0) + 1; } } catch (x) {}
  lines.push('', 'In the folder now:');
  const types = Object.values(PHOTO_TYPES).concat(['Other']);
  types.forEach(t => { if (count[t] || trashedCount[t]) lines.push(`  ${t}: ${count[t] || 0}` + (trashedCount[t] ? `   (+${trashedCount[t]} in trash)` : '')); });
  if (!Object.keys(count).length && !Object.keys(trashedCount).length) lines.push('  (empty)');
  if (newest) lines.push('', 'Newest file: ' + newest.getName() + ' — ' + Utilities.formatDate(newest.getDateCreated(), Session.getScriptTimeZone(), 'MMM d, HH:mm'));

  const purged = sheet_().getDataRange().getValues().slice(1).filter(r => /^Photos purged/.test(String(r[C['Note']]))).length;
  lines.push('', `Auto-delete: after ${Number(setting_('RETENTION_DAYS')) || 7} days, daily at 4 am. Sessions cleaned so far: ${purged}.`);

  const guest = (count[PHOTO_TYPES['0-original']] || 0) + (trashedCount[PHOTO_TYPES['0-original']] || 0) + purged;
  let last = null; try { last = JSON.parse(props.getProperty('LAST_CALL') || 'null'); } catch (x) {}
  lines.push('', 'Last booth request: ' + (last ? `"${last.action}" at ${Utilities.formatDate(new Date(last.t), Session.getScriptTimeZone(), 'MMM d, HH:mm')}` : 'none recorded'));
  if (!guest) {
    lines.push('', '⚠️ No guest photos have ever been saved.',
      'A guest photo is saved the moment the booth starts the AI, so the booth has not reached this backend yet.',
      'Check: API_URL in config.js = the /exec URL; deployment access = Anyone; booth shows no red bar at the top.');
  }
  const r = syncPhotos_();
  lines.push('', `Photos tab updated (${r.added} added, ${r.trashed} in trash, ${r.gone} missing).`);
  say_(lines.join('\n'), '📷 Photo storage');
}
