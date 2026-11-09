const dns = require('dns').promises;
const net = require('net');

// Private / reserved / link-local ranges that must never be fetched on a user's behalf.
const BLOCKED_IPV4_RANGES = [
  /^0\./,
  /^10\./,
  /^100\.(6[4-9]|[7-9]\d|1[01]\d|12[0-7])\./, // 100.64.0.0/10 (CGNAT)
  /^127\./,
  /^169\.254\./,
  /^172\.(1[6-9]|2\d|3[01])\./,
  /^192\.0\.0\./,
  /^192\.168\./,
  /^198\.1[89]\./,
  /^224\./, // multicast
  /^(23[0-9])\./, // reserved/multicast tail
];

function isBlockedIPv4(ip) {
  return BLOCKED_IPV4_RANGES.some((re) => re.test(ip));
}

function isBlockedIPv6(ip) {
  const lower = ip.toLowerCase();
  return (
    lower === '::1' || // loopback
    lower.startsWith('fe80:') || // link-local
    lower.startsWith('fc') || // unique local
    lower.startsWith('fd') || // unique local
    lower.startsWith('::ffff:127.') ||
    lower.startsWith('::ffff:10.') ||
    lower.startsWith('::ffff:192.168.')
  );
}

/**
 * Validates a user-supplied URL is safe to fetch server-side:
 * - http/https only
 * - no credentials embedded in the URL
 * - hostname does not resolve to a private/loopback/link-local address
 * Throws an Error with a safe, user-facing message on failure.
 */
async function assertSafeUrl(rawUrl) {
  let parsed;
  try {
    parsed = new URL(rawUrl);
  } catch {
    throw new Error('Invalid URL');
  }

  if (!['http:', 'https:'].includes(parsed.protocol)) {
    throw new Error('Only http/https URLs are allowed');
  }

  if (parsed.username || parsed.password) {
    throw new Error('URLs with embedded credentials are not allowed');
  }

  const hostname = parsed.hostname;

  if (hostname === 'localhost' || hostname.endsWith('.local')) {
    throw new Error('Local hostnames are not allowed');
  }

  // If the hostname is already a literal IP, check it directly.
  if (net.isIP(hostname)) {
    if (net.isIPv4(hostname) && isBlockedIPv4(hostname)) {
      throw new Error('Target address is not allowed');
    }
    if (net.isIPv6(hostname) && isBlockedIPv6(hostname)) {
      throw new Error('Target address is not allowed');
    }
    return parsed;
  }

  // Resolve DNS and check every returned address (defends against DNS rebinding).
  let records;
  try {
    records = await dns.lookup(hostname, { all: true });
  } catch {
    throw new Error('Could not resolve host');
  }

  for (const record of records) {
    if (record.family === 4 && isBlockedIPv4(record.address)) {
      throw new Error('Target address is not allowed');
    }
    if (record.family === 6 && isBlockedIPv6(record.address)) {
      throw new Error('Target address is not allowed');
    }
  }

  return parsed;
}

module.exports = { assertSafeUrl };
