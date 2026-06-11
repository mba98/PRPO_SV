import { apiFetch } from '@/lib/apiClient';

export async function fetchSapItemDetails(itemCode) {
  const code = String(itemCode || '').trim();
  if (!code) {
    return null;
  }

  const { json, status } = await apiFetch(
    `/api/sap/items/${encodeURIComponent(code)}/details`,
  );

  if (json.success && json.data) {
    return json.data;
  }

  const err = new Error(json.message || 'Failed to load item details');
  err.status = status;
  throw err;
}

export function mapItemDetailsToLinePatch(details) {
  if (!details) {
    return {
      itemCode: '',
      itemName: '',
      estimatedUnitPrice: '',
      unitPrice: '',
      ugpEntry: '',
      ugpName: '',
      uomCode: '',
      warehouseCode: '',
      warehouseLabel: '',
      itemGroupName: '',
    };
  }

  const warehouseCode = String(details.warehouseCode || '').trim();
  const warehouseName = String(details.warehouseName || '').trim();
  const warehouseLabel =
    String(details.warehouseLabel || '').trim() ||
    (warehouseCode
      ? warehouseName
        ? `${warehouseCode} — ${warehouseName}`
        : warehouseCode
      : '');

  const price =
    details.price != null && details.price !== '' ? String(details.price) : '';

  const patch = {
    itemCode: String(details.itemCode || '').trim(),
    itemName: details.itemName || '',
    estimatedUnitPrice: price,
    unitPrice: price,
    ugpEntry: details.ugpEntry ?? details.uomGroupEntry ?? '',
    ugpName: details.uom || details.uomGroupName || '',
    uomCode: details.uomCode || '',
    itemGroupCode: details.itemGroupCode,
    itemGroupName: details.itemGroupName || '',
    warehouseCode: warehouseCode || '',
    warehouseLabel: warehouseCode ? warehouseLabel : '',
  };

  console.log('[item-select] returned warehouse', {
    warehouseCode: details.warehouseCode,
    warehouseName: details.warehouseName,
    warehouseLabel: details.warehouseLabel,
  });
  console.log('[item-select] assigned warehouse', {
    warehouseCode: patch.warehouseCode,
    warehouseLabel: patch.warehouseLabel,
  });

  return patch;
}
