/* ============================================================
 *  CRYSTAL ROYALE ICONS — hand-drawn SVG, animated with CSS
 *  (gold filigree, lavender crystal, twinkling sparkles).
 *  ICON(name) returns an <svg> string. Shared gradients live in
 *  one hidden <svg> that is added to the page once.
 * ============================================================ */
(() => {
  const DEFS = `<svg width="0" height="0" style="position:absolute" aria-hidden="true" focusable="false"><defs>
    <linearGradient id="ig-gold" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#fff6d2"/><stop offset=".45" stop-color="#f2c96a"/><stop offset="1" stop-color="#b9801f"/></linearGradient>
    <linearGradient id="ig-gem" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#ffffff"/><stop offset=".45" stop-color="#e5ceff"/><stop offset="1" stop-color="#9d6fe3"/></linearGradient>
    <linearGradient id="ig-pink" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#fff0f8"/><stop offset=".5" stop-color="#f9b6da"/><stop offset="1" stop-color="#e070ad"/></linearGradient>
    <linearGradient id="ig-ice" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#ffffff"/><stop offset=".5" stop-color="#cfe9ff"/><stop offset="1" stop-color="#86bff0"/></linearGradient>
    <linearGradient id="ig-velvet" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#c79cf5"/><stop offset="1" stop-color="#6a36b5"/></linearGradient>
    <linearGradient id="ig-leaf" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#bfe8b8"/><stop offset="1" stop-color="#5a9e62"/></linearGradient>
    <linearGradient id="ig-rainbow" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#ffc6e8"/><stop offset=".33" stop-color="#e2d0ff"/><stop offset=".66" stop-color="#cfe9ff"/><stop offset="1" stop-color="#fff3c4"/></linearGradient>
  </defs></svg>`;

  const OUT = 'stroke="#9a6418" stroke-width="1.1" stroke-linejoin="round"';
  // Twinkle: the outer <g> places it, the inner path is what CSS animates.
  const spk = (x, y, s = 1) => `<g transform="translate(${x} ${y}) scale(${s})"><path class="spk" d="M0-6 1.3-1.3 6 0 1.3 1.3 0 6-1.3 1.3-6 0-1.3-1.3Z" fill="#fff"/></g>`;
  const heart = (x, y, s = 1, fill = 'url(#ig-gem)') =>
    `<g transform="translate(${x} ${y}) scale(${s})"><path class="gem" d="M0 7C-6 2.5-9-1-9-4.2-9-7.2-6.6-9-4.4-9-2.4-9-.8-7.8 0-6.2.8-7.8 2.4-9 4.4-9 6.6-9 9-7.2 9-4.2 9-1 6 2.5 0 7Z" fill="${fill}" stroke="#fff" stroke-width=".9"/><path d="M-5-6.5-3-4.4" stroke="#fff" stroke-width="1.4" stroke-linecap="round" opacity=".9"/></g>`;
  const gemDot = (x, y, r, fill) => `<circle class="gem" cx="${x}" cy="${y}" r="${r}" fill="${fill}" stroke="#fff" stroke-width=".8"/>`;

  const ICONS = {
    /* --- royal looks --- */
    princess: `
      <path d="M11 45 15 25 23 36 32 15 41 36 49 25 53 45Q32 38 11 45Z" fill="url(#ig-gold)" ${OUT}/>
      <path d="M10 45Q32 37 54 45L52.5 51Q32 44 11.5 51Z" fill="url(#ig-gold)" ${OUT}/>
      ${gemDot(15, 25, 2.6, 'url(#ig-pink)')}${gemDot(49, 25, 2.6, 'url(#ig-pink)')}${gemDot(32, 15, 2.8, 'url(#ig-gem)')}
      ${heart(32, 36, .95)}${gemDot(20, 46.5, 1.6, 'url(#ig-pink)')}${gemDot(44, 46.5, 1.6, 'url(#ig-pink)')}
      ${spk(52, 13, .8)}${spk(10, 17, .55)}`,
    prince: `
      <path d="M13 46 11 24 22 33 32 18 42 33 53 24 51 46Z" fill="url(#ig-gold)" ${OUT}/>
      <rect x="12" y="45" width="40" height="7" rx="2.5" fill="url(#ig-gold)" ${OUT}/>
      ${gemDot(22, 48.5, 2.2, 'url(#ig-ice)')}${gemDot(32, 48.5, 2.6, 'url(#ig-gem)')}${gemDot(42, 48.5, 2.2, 'url(#ig-ice)')}
      ${gemDot(11, 24, 2.3, 'url(#ig-ice)')}${gemDot(53, 24, 2.3, 'url(#ig-ice)')}
      <path class="gem" d="M32 9 36 14 32 20 28 14Z" fill="url(#ig-ice)" stroke="#fff" stroke-width=".9"/>
      ${spk(50, 12, .7)}${spk(13, 14, .5)}`,
    queen: `
      <path d="M17 40Q17 18 32 15Q47 18 47 40Z" fill="url(#ig-velvet)"/>
      <path d="M12 47 10 26 21 35 26 22 32 31 38 22 43 35 54 26 52 47Z" fill="url(#ig-gold)" ${OUT}/>
      <rect x="11" y="46" width="42" height="7.5" rx="2.5" fill="url(#ig-gold)" ${OUT}/>
      <circle cx="32" cy="12" r="4" fill="url(#ig-gold)" ${OUT}/><path d="M32 3v6M29 6h6" stroke="url(#ig-gold)" stroke-width="2.4" stroke-linecap="round"/>
      ${gemDot(21, 49.7, 2.2, 'url(#ig-pink)')}${heart(32, 50.5, .55)}${gemDot(43, 49.7, 2.2, 'url(#ig-pink)')}
      ${gemDot(10, 26, 2.2, 'url(#ig-gem)')}${gemDot(54, 26, 2.2, 'url(#ig-gem)')}
      ${spk(52, 10, .8)}${spk(11, 13, .55)}`,
    fairy: `
      <path d="M38 34Q50 16 58 24Q60 34 44 38Z" fill="url(#ig-ice)" opacity=".75" stroke="#fff" stroke-width=".8"/>
      <path d="M38 38Q52 40 54 50Q48 56 40 44Z" fill="url(#ig-pink)" opacity=".7" stroke="#fff" stroke-width=".8"/>
      <path d="M12 55 36 26" stroke="url(#ig-gold)" stroke-width="3.4" stroke-linecap="round"/>
      <path class="gem" d="M38 9 41.5 18.5 51.5 19 43.5 25 46.5 35 38 29 29.5 35 32.5 25 24.5 19 34.5 18.5Z" fill="url(#ig-gem)" stroke="#fff" stroke-width="1"/>
      ${spk(20, 30, .6)}${spk(26, 42, .45)}${spk(14, 40, .5)}${spk(52, 10, .55)}`,
    knight: `
      <path d="M32 7 52 13V31C52 44 43 52 32 57 21 52 12 44 12 31V13Z" fill="url(#ig-gold)" ${OUT}/>
      <path d="M32 12 47 16.5V31C47 41 40 47.5 32 51.5 24 47.5 17 41 17 31V16.5Z" fill="url(#ig-velvet)"/>
      <path d="M32 12V51.5" stroke="#fff" stroke-width=".8" opacity=".35"/>
      ${heart(32, 33, 1.25)}${spk(48, 9, .65)}${spk(14, 51, .5)}`,
    unicorn: `
      <path d="M25 50 32 7 39 50Z" fill="url(#ig-gold)" ${OUT}/>
      <path d="M27.3 41 37.5 37M28.6 33 36.5 29.7M29.9 25 35.4 22.4M31 17.5 34.2 15.8" stroke="#a86f1f" stroke-width="1.2" stroke-linecap="round"/>
      <path d="M14 54Q16 44 25 46M50 54Q48 44 39 46" stroke="url(#ig-rainbow)" stroke-width="5" stroke-linecap="round" fill="none"/>
      <circle cx="20" cy="49" r="4.2" fill="url(#ig-pink)" stroke="#fff" stroke-width=".8"/><circle cx="20" cy="49" r="1.4" fill="#fff3c4"/>
      <circle cx="44" cy="49" r="4.2" fill="url(#ig-gem)" stroke="#fff" stroke-width=".8"/><circle cx="44" cy="49" r="1.4" fill="#fff3c4"/>
      <circle cx="32" cy="52" r="4.6" fill="url(#ig-ice)" stroke="#fff" stroke-width=".8"/><circle cx="32" cy="52" r="1.5" fill="#fff3c4"/>
      ${spk(45, 12, .75)}${spk(18, 20, .55)}`,
    ballerina: `
      <path d="M12 42C12 34 22 31 33 34L50 39C56 41 56 49 50 50L22 51C16 51 12 48 12 42Z" fill="url(#ig-pink)" stroke="#d76aa6" stroke-width="1.1"/>
      <path d="M17 42C18 37 25 36 31 38" stroke="#fff" stroke-width="1.6" fill="none" opacity=".8" stroke-linecap="round"/>
      <path d="M33 34Q30 22 37 12M33 34Q42 24 50 22" stroke="url(#ig-pink)" stroke-width="2.6" fill="none" stroke-linecap="round"/>
      <path d="M33 34Q30 22 37 12M33 34Q42 24 50 22" stroke="#d76aa6" stroke-width=".7" fill="none" opacity=".6"/>
      ${gemDot(33, 34, 2.4, 'url(#ig-gem)')}${spk(50, 12, .7)}${spk(14, 26, .5)}`,
    garden: `
      <path d="M32 36V58" stroke="#5f9f63" stroke-width="3" stroke-linecap="round"/>
      <path d="M32 48C24 50 18 46 17 40 24 39 30 42 32 48ZM32 44C40 46 46 42 47 36 40 35 34 38 32 44Z" fill="url(#ig-leaf)"/>
      <circle cx="32" cy="24" r="14" fill="url(#ig-pink)" stroke="#d76aa6" stroke-width="1.1"/>
      <path d="M32 13C40 13 44 20 41 26 38 32 28 32 25 27 22 22 26 17 32 18 37 19 38 24 35 26 32 28 29 25 31 22" stroke="#c8559a" stroke-width="1.5" fill="none" stroke-linecap="round"/>
      ${spk(50, 12, .7)}${spk(13, 16, .55)}${spk(48, 34, .45)}`,
    snow: `
      <g stroke="url(#ig-ice)" stroke-width="3.2" stroke-linecap="round">
        <path d="M32 6V58M9.5 19 54.5 45M9.5 45 54.5 19"/>
      </g>
      <g stroke="#ffffff" stroke-width="1.6" stroke-linecap="round" fill="none" opacity=".95">
        <path d="M26 11 32 16 38 11M26 53 32 48 38 53M13 26 19.5 25 17 19M51 38 44.5 39 47 45M13 38 19.5 39 17 45M51 26 44.5 25 47 19"/>
      </g>
      <path class="gem" d="M32 24 39 32 32 40 25 32Z" fill="url(#ig-gem)" stroke="#fff" stroke-width="1"/>
      ${spk(52, 9, .65)}${spk(11, 54, .5)}`,

    /* --- interface --- */
    crown: `
      <path d="M8 44 6 18 20 30 32 10 44 30 58 18 56 44Z" fill="url(#ig-gold)" ${OUT}/>
      <rect x="7" y="43" width="50" height="9" rx="3" fill="url(#ig-gold)" ${OUT}/>
      ${heart(32, 33, 1.05)}${gemDot(6, 18, 2.6, 'url(#ig-pink)')}${gemDot(58, 18, 2.6, 'url(#ig-pink)')}${gemDot(32, 10, 2.8, 'url(#ig-gem)')}
      ${gemDot(17, 47.5, 2, 'url(#ig-pink)')}${gemDot(47, 47.5, 2, 'url(#ig-pink)')}
      ${spk(56, 6, .9)}${spk(8, 8, .6)}${spk(32, 58, .5)}`,
    sparkle: `
      <path class="spk2" d="M32 4 37 27 60 32 37 37 32 60 27 37 4 32 27 27Z" fill="url(#ig-gold)" stroke="#fff6d2" stroke-width="1"/>
      ${spk(52, 12, 1)}${spk(14, 50, .7)}`,
    download: `
      <path d="M32 8V38M20 27 32 39 44 27" stroke="currentColor" stroke-width="5" stroke-linecap="round" stroke-linejoin="round" fill="none"/>
      <path d="M12 44V50C12 53 14 55 17 55H47C50 55 52 53 52 50V44" stroke="currentColor" stroke-width="5" stroke-linecap="round" fill="none"/>`,
    ticket: `
      <path d="M8 18H56V27A5 5 0 0 0 56 37V46H8V37A5 5 0 0 0 8 27Z" fill="url(#ig-gold)" ${OUT}/>
      <path d="M40 19V45" stroke="#9a6418" stroke-width="1.2" stroke-dasharray="3 3"/>
      ${heart(24, 33, .9)}${spk(52, 12, .6)}`,
    camera: `
      <rect x="8" y="18" width="48" height="34" rx="7" fill="url(#ig-velvet)" stroke="#fff" stroke-width="1.2"/>
      <path d="M22 18 26 11H38L42 18" fill="url(#ig-gold)" ${OUT}/>
      <circle cx="32" cy="35" r="11" fill="url(#ig-gem)" stroke="#fff" stroke-width="1.5"/><circle cx="32" cy="35" r="5" fill="#6a36b5"/>
      ${spk(50, 10, .6)}`,
    people: `
      <circle cx="23" cy="22" r="8" fill="url(#ig-pink)"/><circle cx="41" cy="22" r="8" fill="url(#ig-gem)"/>
      <path d="M9 52C9 41 15 34 23 34S37 41 37 52Z" fill="url(#ig-pink)"/><path d="M27 52C27 41 33 34 41 34S55 41 55 52Z" fill="url(#ig-gem)"/>`,
    check: `<path d="M14 33 27 46 51 19" stroke="currentColor" stroke-width="6" stroke-linecap="round" stroke-linejoin="round" fill="none"/>`
  };

  window.ICON = (name, cls = '') => ICONS[name]
    ? `<svg class="ico ${cls}" viewBox="0 0 64 64" aria-hidden="true" focusable="false">${ICONS[name]}</svg>` : '';
  window.ICON_NAMES = Object.keys(ICONS);

  const add = () => { if (!document.getElementById('ico-defs')) { const d = document.createElement('div'); d.id = 'ico-defs'; d.innerHTML = DEFS; document.body.prepend(d); }
    // Swap any <i data-ico="name"></i> placeholders in the page for the real icon.
    document.querySelectorAll('[data-ico]').forEach(el => { if (!el.firstChild) el.innerHTML = window.ICON(el.dataset.ico, el.dataset.icoClass || ''); }); };
  document.readyState === 'loading' ? document.addEventListener('DOMContentLoaded', add) : add();
})();
