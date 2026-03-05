/**
 * Validates Netscape-format cookie file content for YouTube authentication.
 * Extracted from the inline helper in server.js.
 *
 * @param {string} content - Raw cookie file text.
 * @returns {{ valid: boolean, errors: string[], warnings: string[] }}
 */
function validateCookieFormat(content) {
  const errors = [];
  const warnings = [];

  const lines = content.trim().split('\n');
  if (lines.length === 0) {
    errors.push('Cookie file is empty');
    return { valid: false, errors, warnings };
  }

  // Netscape header check
  const hasNetscapeHeader = lines.some(line => line.includes('Netscape HTTP Cookie File'));
  if (!hasNetscapeHeader) {
    warnings.push('Missing Netscape HTTP Cookie File header (may still work)');
  }

  // Must contain .youtube.com cookies
  const hasYouTubeCookies = lines.some(
    line => line.includes('.youtube.com') && !line.startsWith('#')
  );
  if (!hasYouTubeCookies) {
    errors.push('No .youtube.com cookies found');
  }

  // Warn if no auth cookies present
  const AUTH_COOKIES = ['LOGIN_INFO', 'SSID', 'SID', 'HSID', 'APISID', 'SAPISID'];
  const foundAuth = AUTH_COOKIES.filter(name =>
    lines.some(line => line.includes(name) && !line.startsWith('#'))
  );
  if (foundAuth.length === 0) {
    warnings.push('No authentication cookies found (LOGIN_INFO, SSID, SID, etc.)');
  }

  // Warn about lines with too few tab-separated fields (Netscape format = 7 fields)
  const dataLines = lines.filter(line => !line.startsWith('#') && line.trim());
  const badLines = dataLines.filter(line => line.split('\t').length < 6);
  if (badLines.length > 0) {
    warnings.push(`${badLines.length} line(s) may have invalid format`);
  }

  return { valid: errors.length === 0, errors, warnings };
}

module.exports = { validateCookieFormat };
