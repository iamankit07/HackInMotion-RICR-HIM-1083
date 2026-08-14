import rateLimit from 'express-rate-limit';

/**
 * Rate limits, keyed per account where we know who is asking.
 *
 * Keying on IP alone is wrong for this app: a whole college sits behind one
 * address, and limiting them as a single caller would lock out a classroom
 * because one person was impatient. Once a request is authenticated the account
 * is the honest unit, and the IP is only a fallback for routes that run before
 * anyone has signed in.
 */
/**
 * An IPv6 customer is handed a whole /64 to themselves, so keying on the full
 * address lets one person rotate through billions of them and never hit a
 * limit. Group them by subnet. IPv4 addresses are used as they are.
 */
function addressKey(ip) {
  if (!ip) return 'unknown';
  if (!ip.includes(':')) return ip;

  return `${ip.split(':').slice(0, 4).join(':')}::/64`;
}

const perAccountOrAddress = (req) =>
  req.user ? `user:${req.user._id}` : `ip:${addressKey(req.ip)}`;

const message = (text) => ({ error: { message: text } });

const shared = {
  standardHeaders: 'draft-7',
  legacyHeaders: false,
};

/**
 * A backstop across the whole API. Generous enough that no real student will
 * ever see it — a full session is a few dozen requests — and low enough that a
 * script pointed at the deployment does not get far.
 */
export const globalLimiter = rateLimit({
  ...shared,
  windowMs: 15 * 60 * 1000,
  limit: 300,
  keyGenerator: perAccountOrAddress,
  message: message('That is a lot of requests. Give it a minute and try again.'),
});

/**
 * The one that actually matters.
 *
 * Generating a topic graph, a quiz, a set of notes or a tutor reply costs a
 * call against a shared daily allowance — the free tier is roughly twenty per
 * model per day for the entire deployment, not per user. Without this, one
 * person holding down a button empties the quota for everybody else on the site
 * for the rest of the day.
 *
 * Twenty an hour is about five complete run-throughs, which is more than a
 * student doing real work needs and far less than a loop can waste.
 */
export const aiLimiter = rateLimit({
  ...shared,
  windowMs: 60 * 60 * 1000,
  limit: 20,
  keyGenerator: perAccountOrAddress,
  message: message(
    'You have asked for a lot of AI-generated material in the last hour. ' +
      'Everything already generated is still here — try again shortly.',
  ),
});

/**
 * Sign-in and sign-up, the obvious brute-force target. Keyed by address on
 * purpose: there is no account yet, and that is the point of the attack.
 */
export const credentialLimiter = rateLimit({
  ...shared,
  windowMs: 15 * 60 * 1000,
  limit: 20,
  message: message('Too many attempts. Please try again in a few minutes.'),
});
