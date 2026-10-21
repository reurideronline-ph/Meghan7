/* ============================================================
 *  BOOTH CONFIG — edit this file, nothing else needs changing.
 * ============================================================ */
window.BOOTH_CONFIG = {
  // Paste the /exec URL of THIS event's Apps Script deployment (a new Sheet + script for Meghan's party).
  API_URL: 'https://script.google.com/macros/s/AKfycbzAbipZht1ZrfQEy-hU8b8KDi9cpXTYWL58IGO8JbZG5aojASh8aCZ6e6z2XL_Yh58awg/exec',

  /* Everything below is a FALLBACK. Once API_URL is set, the "Settings" and
     "Characters" tabs in your Google Sheet override these automatically. */
  BOOTH_NAME: 'Crystal Royale Photo Booth',
  THEME_TITLE: 'Photo Booth',

  // Timers (seconds)
  CAMERA_COUNTDOWN: 10,    // seconds to pose after tapping "I'm Ready" (the only timer)
  RESULT_IDLE_SECONDS: 180,// result screen returns to the landing page after this

  // Camera
  MIRROR_OUTPUT: true,     // true = photo looks like the preview (selfie mirror)

  // Output: collage is rendered at FRAME_SCALE × the frame artwork (1024×1536 / 1536×1024)
  FRAME_SCALE: 1.5,

  PIN_PRICE: 0,
  DEMO_PIN: '000000',        // offline fallback only — the live demo PIN is the DEMO_PIN setting in the Sheet
  CURRENCY: '₱',

  // No printing at this event: QR download only. (Set true + STAFF_CODE in the Sheet to offer paid prints.)
  PRINTING_ENABLED: false,
  PRINT_PRICE: 0,
  MAX_COPIES: 10,
  DEMO_STAFF_CODE: '1234',
  PRINT_DPI: 300,
  PRINT_FIT: 'contain-blur',

  // Layouts = your uploaded frames. Slots were measured from the artwork.
  // cx,cy,w,h in frame pixels, angle in degrees (clockwise).
  LAYOUTS: [
    { id: 'frame1', name: 'Crystal Castle', src: 'frames/frame1.png', thumb: 'frames/frame1-thumb.jpg',
      width: 1024, height: 1536,
      slots: [ { cx: 762.5, cy: 405.0, w: 389, h: 536, angle: 0 },
               { cx: 762.5, cy: 1059.5, w: 389, h: 501, angle: 0 } ] },
    { id: 'frame2', name: 'Rose Garden Palace', src: 'frames/frame2.png', thumb: 'frames/frame2-thumb.jpg',
      width: 1536, height: 1024,
      slots: [ { cx: 1154.5, cy: 299.0, w: 487, h: 316, angle: 0 },
               { cx: 1154.0, cy: 763.0, w: 486, h: 316, angle: 0 } ] }
  ],

  // Fallback characters (used if the server can't be reached for config).
  // The real prompts live on the server so customers can't tamper with them.
  CHARACTERS: [
    { id: 'princess',  name: 'Crystal Princess',   emoji: '👸', tagline: 'Ball gowns & a sparkling tiara', color: '#f6a8d6' },
    { id: 'prince',    name: 'Crystal Prince',     emoji: '🤴', tagline: 'Royal coats & a golden crown',   color: '#9fb7ff' },
    { id: 'queen',     name: 'Crystal Queen & King', emoji: '👑', tagline: 'Regal capes for the grown-ups', color: '#c7a2ff' },
    { id: 'fairy',     name: 'Fairy Godparent',    emoji: '🧚', tagline: 'Shimmering wings & a wand',      color: '#e2d0ff' },
    { id: 'knight',    name: 'Royal Knight',       emoji: '🛡️', tagline: 'Lavender armour & a crystal crest', color: '#b8c4e0' },
    { id: 'unicorn',   name: 'Unicorn Royalty',    emoji: '🦄', tagline: 'Pastel rainbow & a unicorn horn', color: '#ffc6e8' },
    { id: 'ballerina', name: 'Ballet Royale',      emoji: '🩰', tagline: 'Tulle, pearls & pointe shoes',   color: '#ffd9e8' },
    { id: 'garden',    name: 'Rose Garden Royalty', emoji: '🌹', tagline: 'Roses, butterflies & gold',     color: '#f7a1b5' },
    { id: 'snow',      name: 'Snow Crystal Royalty', emoji: '❄️', tagline: 'Icy silver & frosted gems',     color: '#bfe3ff' }
  ]
};
