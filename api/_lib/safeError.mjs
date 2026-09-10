/**
 * Turns an unknown thrown value into something safe to log.
 *
 * This exists because the errors thrown by an HTTP or auth client are not
 * plain messages. They routinely carry the request that failed, which can
 * include headers, an Authorization bearer token, or the signed assertion the
 * private key produced. Passing such an object to console.error would write
 * all of it into the platform log.
 *
 * So we take only a status code and a short message, and we scrub the message
 * before returning it. Nothing else from the error is ever logged.
 */

/**
 * Fragments that indicate key or token material rather than a description.
 *
 * The PEM pattern matches through to the END marker rather than stopping at
 * the first "-----". Stopping early would redact only the header and leave the
 * key body in the log, which is the opposite of the point.
 */
const SENSITIVE = [
  /-----BEGIN[\s\S]*?END[^-]*-----/gi,
  // A truncated or malformed block that never reaches an END marker.
  /-----BEGIN[\s\S]*/gi,
  /\bBearer\s+[A-Za-z0-9._~+/-]+=*/gi,
  /\bya29\.[A-Za-z0-9._~+/-]+/gi,
  /\bAIza[A-Za-z0-9._~+/-]{10,}/gi,
  /\beyJ[A-Za-z0-9._-]{20,}/g,
];

/** Keeps a log line short enough that a long body cannot be smuggled through. */
const MAX_MESSAGE = 200;

export function scrub(text) {
  let output = String(text ?? '');
  for (const pattern of SENSITIVE) output = output.replace(pattern, '[redacted]');
  return output.length > MAX_MESSAGE ? `${output.slice(0, MAX_MESSAGE)}...` : output;
}

/**
 * A one-line, credential-free summary of a failure.
 *
 * Deliberately returns a string rather than an object, so there is no way for
 * a caller to accidentally log a nested request or response alongside it.
 */
export function describeError(error) {
  if (error === null || error === undefined) return 'unknown error';

  const status =
    (typeof error === 'object' && (error.status ?? error.code ?? error.response?.status)) || null;

  const message =
    typeof error === 'object' && typeof error.message === 'string'
      ? error.message
      : String(error);

  const name = (typeof error === 'object' && error.name) || 'Error';

  return status ? `${name} (status ${scrub(status)}): ${scrub(message)}` : `${name}: ${scrub(message)}`;
}
