const SECRET_PATTERNS = [
  /b1session=/i,
  /routeid=/i,
  /password/i,
  /authorization:/i,
  /cookie:/i,
  /set-cookie/i,
];

/**
 * Strip session cookies, passwords, and other secrets from error text.
 */
export function sanitizeSapErrorText(text) {
  if (text == null) return '';
  let out = String(text);
  out = out.replace(/B1SESSION=[^;\s]*/gi, 'B1SESSION=[redacted]');
  out = out.replace(/ROUTEID=[^;\s]*/gi, 'ROUTEID=[redacted]');
  out = out.replace(/password\s*=\s*\S+/gi, 'password=[redacted]');
  for (const pattern of SECRET_PATTERNS) {
    out = out.replace(pattern, '[redacted]');
  }
  return out;
}

function readSapLayerMessage(body) {
  if (!body || typeof body !== 'object') return null;
  const err = body.error;
  if (!err) return null;
  const code = err.code != null ? String(err.code) : null;
  const value =
    err.message?.value ??
    (typeof err.message === 'string' ? err.message : null) ??
    err.message?.lang;
  if (value) {
    return { code, message: String(value) };
  }
  return code ? { code, message: `SAP error ${code}` } : null;
}

function readHttpStatus(errorOrResponse) {
  if (errorOrResponse?.status != null) return Number(errorOrResponse.status);
  if (errorOrResponse?.response?.status != null) {
    return Number(errorOrResponse.response.status);
  }
  return undefined;
}

function readResponseBody(errorOrResponse) {
  if (errorOrResponse?.responseBody != null) return errorOrResponse.responseBody;
  if (errorOrResponse?.response?.data != null) return errorOrResponse.response.data;
  return null;
}

/**
 * Parse SAP Service Layer / transport errors into a normalized shape.
 */
export function parseSapError(errorOrResponse) {
  const status = readHttpStatus(errorOrResponse);
  const body = readResponseBody(errorOrResponse);
  const fromBody = readSapLayerMessage(body);

  if (fromBody) {
    return {
      code: fromBody.code || errorOrResponse?.code || 'SAP_ERROR',
      message: sanitizeSapErrorText(fromBody.message),
      status,
      details: body && typeof body === 'object' ? { sap: body.error } : undefined,
    };
  }

  if (typeof body === 'string' && body.trim()) {
    try {
      const parsed = JSON.parse(body);
      const nested = readSapLayerMessage(parsed);
      if (nested) {
        return {
          code: nested.code || 'SAP_ERROR',
          message: sanitizeSapErrorText(nested.message),
          status,
          details: { sap: parsed.error },
        };
      }
    } catch {
      return {
        code: 'SAP_ERROR',
        message: sanitizeSapErrorText(body.slice(0, 500)),
        status,
      };
    }
  }

  const code = errorOrResponse?.code;
  const rawMessage = errorOrResponse?.message || 'SAP request failed';

  if (code === 'SAP_LOGIN_FAILED') {
    return {
      code,
      message: sanitizeSapErrorText(rawMessage),
      status: status || errorOrResponse?.status,
    };
  }

  if (code === 'DEPTH_ZERO_SELF_SIGNED_CERT' || /self[- ]?signed/i.test(rawMessage)) {
    return {
      code: 'SAP_TLS_ERROR',
      message:
        'SAP TLS certificate validation failed. Set SAP_SL_CA_CERT to your CA file or SAP_SL_INSECURE_TLS=true for internal dev only.',
      status,
    };
  }

  if (code === 'ENOTFOUND' || code === 'EAI_AGAIN') {
    return {
      code: 'SAP_NETWORK_ERROR',
      message: 'Cannot resolve SAP Service Layer host',
      status,
    };
  }

  if (code === 'ECONNREFUSED') {
    return {
      code: 'SAP_NETWORK_ERROR',
      message: 'Connection refused by SAP Service Layer host',
      status,
    };
  }

  if (code === 'ETIMEDOUT' || code === 'ESOCKET') {
    return {
      code: 'SAP_TIMEOUT',
      message: 'SAP Service Layer did not respond in time',
      status,
    };
  }

  if (/invalid json/i.test(rawMessage)) {
    return {
      code: 'SAP_INVALID_RESPONSE',
      message: 'SAP returned an invalid response',
      status,
    };
  }

  return {
    code: code || 'SAP_ERROR',
    message: sanitizeSapErrorText(rawMessage),
    status,
  };
}

export function getSapErrorMessage(errorOrResponse) {
  return parseSapError(errorOrResponse).message;
}

export function getSapErrorCode(errorOrResponse) {
  return parseSapError(errorOrResponse).code;
}

export function sanitizeSapError(errorOrResponse) {
  const parsed = parseSapError(errorOrResponse);
  return {
    code: parsed.code,
    message: parsed.message,
    status: parsed.status,
    ...(parsed.details ? { details: parsed.details } : {}),
  };
}

/**
 * Build a thrown Error with responseBody for Service Layer callers.
 */
export function toSapRequestError(response, parsedBody) {
  const parsed = parseSapError({
    status: response?.status,
    responseBody: parsedBody,
    message: parsed?.message,
  });
  const err = new Error(parsed.message);
  err.status = parsed.status || response?.status;
  err.code = parsed.code;
  err.responseBody = parsedBody;
  return err;
}
