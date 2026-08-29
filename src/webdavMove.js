const COPY_DELETE_FALLBACK_STATUSES = new Set([400, 403, 405, 409, 423, 500, 501, 502, 503]);

export const shouldFallbackToCopyDelete = (error) => {
  const status = Number(error?.status || error?.response?.status || 0);
  if (!status) return true;
  return COPY_DELETE_FALLBACK_STATUSES.has(status);
};
