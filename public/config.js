/* ============================================================================
   RishtaRoast frontend config — the ONE place to point the static site at the API.
   Edit by hand, OR let Render fill it at build time: the static site's build command
   (scripts/configure-static.js) rewrites the PRODUCTION block from env vars
   API_BASE_URL, SITE_URL, UPI_ID, UPI_PAYEE_NAME, RAZORPAY_TIP_LINK, PRO_ENABLED, PRO_PRICE_INR.
   The site works fully even if the API is asleep/unreachable (client-side templates).
   ============================================================================ */
window.RR_CONFIG = (function () {
  var PRODUCTION = {
    // @generated-start (configure-static.js replaces this block)
    API_BASE_URL: 'https://rishtaroast-api.onrender.com', // PLACEHOLDER: set to your Render web service URL
    SITE_URL: 'https://rishtaroast.onrender.com', // PLACEHOLDER: your static site URL / custom domain
    UPI_ID: 'PLACEHOLDER@upi',
    UPI_PAYEE_NAME: 'RishtaRoast',
    RAZORPAY_TIP_LINK: 'https://rzp.io/l/PLACEHOLDER',
    PRO_ENABLED: true,
    PRO_PRICE_INR: 29,
    PRO_VALIDITY_DAYS: 30,
    // @generated-end
  };
  var cfg = Object.assign({ BRAND_NAME: 'RishtaRoast', API_TIMEOUT_MS: 4000 }, PRODUCTION);
  // Local development: static site on :8080, API on :3000
  if (/^(localhost|127\.0\.0\.1)$/.test(location.hostname)) {
    cfg.API_BASE_URL = 'http://localhost:3000';
  }
  cfg.API_BASE_URL = String(cfg.API_BASE_URL || '').replace(/\/$/, '');
  cfg.SITE_URL = String(cfg.SITE_URL || location.origin).replace(/\/$/, '');
  return cfg;
})();
