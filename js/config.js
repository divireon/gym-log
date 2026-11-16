// Cloud sync settings, from Supabase → Project Settings → API Keys.
// Both values are meant to be public (they ship inside every Supabase web app).
// Your data stays private because every request must be signed in, row-level security
// limits each row to its owner, and new sign-ups are turned off.
// NEVER put the "secret" / "service_role" key here.

export const SUPABASE_URL = 'https://tvvwqyplnhorvthrpelc.supabase.co';
export const SUPABASE_KEY = 'sb_publishable_zQwx3A2c9w9B1IFccCXf2A_yqDC6qgi';

// Public half of the push-notification key pair (the private half lives only in Supabase secrets).
export const VAPID_PUBLIC_KEY = 'BAkDDgNPjaaFWUJsHf6P11JBhWuVnHLnRq-jTnv6FFNwCtpvLsjSazhdQHgr40Xh7-Jtk_VrgPmnZp5DkP2zh7g';
