/**
 * Normalize Local Purchase API payloads — mutations return { document }, GET returns flat doc.
 */
export function wrapLocalPurchaseResponse(document) {
  if (!document) return { document: null };
  return { document };
}

export function extractLocalPurchaseDocument(data) {
  if (!data) return null;
  if (data.document && typeof data.document === 'object') {
    return data.document;
  }
  if (data.localPurchase && typeof data.localPurchase === 'object') {
    return data.localPurchase;
  }
  if (data.id || data._id || data.portalLPNumber) {
    return data;
  }
  return null;
}
