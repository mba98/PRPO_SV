import '@/models/index.js';
import ItemCreationLog from '@/models/ItemCreationLog.js';
import { searchItems, getItemDetail } from '@/lib/sapHana.js';
import { getItem, createItem } from '@/lib/sapServiceLayer.js';
import { connectDB } from '@/lib/mongodb';
import { formatSapErrorForClient, getSapErrorMessage, sanitizeSapError } from '@/lib/sap/sapErrors.js';
import { writeSapIntegrationLog } from '@/lib/sap/sapIntegrationLog.js';

function trimOptional(value) {
  if (value == null || value === '') return undefined;
  const s = String(value).trim();
  return s || undefined;
}

export function getSapItemSeries() {
  const raw = process.env.SAP_ITEM_SERIES?.trim();
  const itemSeries = Number(raw);
  if (!raw || !Number.isInteger(itemSeries) || itemSeries <= 0) {
    const err = new Error('SAP_ITEM_SERIES is not configured');
    err.code = 'SAP_ITEM_SERIES_NOT_CONFIGURED';
    throw err;
  }
  return itemSeries;
}

/**
 * Map portal item create body → SAP Service Layer /Items payload.
 * ItemCode is assigned by SAP from Series; omit empty optional fields (e.g. DefaultWarehouse).
 */
export function buildSapItemCreatePayload(payload) {
  const sapPayload = {
    Series: getSapItemSeries(),
    ItemName: String(payload.ItemName || '').trim(),
  };

  const itemGroup = trimOptional(payload.ItemGroup);
  if (itemGroup != null) {
    sapPayload.ItemsGroupCode = Number(itemGroup);
  }

  const ugpEntry = payload.UgpEntry ?? payload.UoMGroup;
  if (ugpEntry != null && ugpEntry !== '') {
    sapPayload.UoMGroupEntry = Number(ugpEntry);
  }

  const warehouse = trimOptional(payload.DefaultWarehouse);
  if (warehouse) {
    sapPayload.DefaultWarehouse = warehouse;
  }

  const uCode = trimOptional(payload.U_Code);
  if (uCode) sapPayload.U_Code = uCode;

  const uAcct = trimOptional(payload.U_AcctCode);
  if (uAcct) sapPayload.U_AcctCode = uAcct;

  const uCompany = trimOptional(payload.U_Company);
  if (uCompany) sapPayload.U_Company = uCompany;

  const optionalUdfs = ['U_Model', 'U_PartNo', 'U_Category', 'U_FactoryName', 'U_UOM'];
  for (const key of optionalUdfs) {
    const val = trimOptional(payload[key]);
    if (val) sapPayload[key] = val;
  }

  return sapPayload;
}

export function logSapItemCreatePayload(sapPayload) {
  console.log('[sap/items/create] Create Item Payload', sapPayload);
  console.log('[sap/items/create] Fields', {
    Series: sapPayload.Series,
    ItemName: sapPayload.ItemName,
    ItemsGroupCode: sapPayload.ItemsGroupCode,
    UoMGroupEntry: sapPayload.UoMGroupEntry,
    U_Code: sapPayload.U_Code,
    U_AcctCode: sapPayload.U_AcctCode,
    U_Company: sapPayload.U_Company,
    DefaultWarehouse: sapPayload.DefaultWarehouse,
  });
}

function pickField(row, ...keys) {
  if (!row) return undefined;
  for (const key of keys) {
    if (row[key] != null && row[key] !== '') return row[key];
    const upper = key.toUpperCase();
    if (row[upper] != null && row[upper] !== '') return row[upper];
    const lower = key.toLowerCase();
    if (row[lower] != null && row[lower] !== '') return row[lower];
  }
  return undefined;
}

export function formatItemWarehouseFields(code, name) {
  const warehouseCode =
    code != null && String(code).trim() !== '' ? String(code).trim() : '';
  const warehouseName =
    name != null && String(name).trim() !== '' ? String(name).trim() : '';
  const warehouseLabel = warehouseCode
    ? warehouseName
      ? `${warehouseCode} — ${warehouseName}`
      : warehouseCode
    : '';
  return { warehouseCode, warehouseName, warehouseLabel };
}

export function mapHanaItemRow(row) {
  if (!row) return null;
  const itemCode = pickField(row, 'itemCode', 'ItemCode');
  const purchaseUom = pickField(row, 'purchaseUom', 'PurPackMsr', 'BuyUnitMsr');
  const inventoryUom = pickField(row, 'inventoryUom', 'InvntryUom');
  const uomCode = purchaseUom || inventoryUom;
  const ugpEntry = pickField(row, 'ugpEntry', 'UgpEntry');
  const warehouse = formatItemWarehouseFields(
    pickField(row, 'warehouseCode', 'DfltWH'),
    pickField(row, 'warehouseName', 'WhsName'),
  );
  return {
    itemCode,
    itemName: pickField(row, 'itemName', 'ItemName'),
    uom: uomCode,
    uomCode,
    purchaseUom,
    inventoryUom,
    defaultWarehouse: warehouse.warehouseCode,
    ...warehouse,
    ugpEntry: ugpEntry != null ? Number(ugpEntry) : undefined,
    itemGroupCode: pickField(row, 'itemGroupCode', 'ItmsGrpCod'),
    itemGroupName: pickField(row, 'itemGroupName', 'ItmsGrpNam'),
    itemGroup: pickField(row, 'itemGroupName', 'ItmsGrpNam'),
  };
}

/** Full item detail for PR line auto-fill (OITM + OUGP + OWHS). */
export function mapItemDetailRow(row) {
  if (!row) return null;
  const avgPrice = pickField(row, 'price', 'AvgPrice');
  const ugpEntry = pickField(row, 'ugpEntry', 'UgpEntry');
  const uom = pickField(row, 'uom', 'UgpName');
  const warehouse = formatItemWarehouseFields(
    pickField(row, 'warehouseCode', 'DfltWH'),
    pickField(row, 'warehouseName', 'WhsName'),
  );
  const price =
    avgPrice != null && avgPrice !== '' && !Number.isNaN(Number(avgPrice))
      ? Number(avgPrice)
      : undefined;
  const parsedUgpEntry = ugpEntry != null && ugpEntry !== '' ? Number(ugpEntry) : undefined;
  return {
    itemCode: pickField(row, 'itemCode', 'ItemCode'),
    itemName: pickField(row, 'itemName', 'ItemName'),
    price,
    ugpEntry: parsedUgpEntry,
    uom,
    uomCode: pickField(row, 'purchaseUom', 'PurPackMsr') || pickField(row, 'inventoryUom', 'InvntryUom'),
    inventoryUom: pickField(row, 'inventoryUom', 'InvntryUom'),
    uomGroupEntry: parsedUgpEntry,
    uomGroupName: uom,
    ...warehouse,
    itemGroupCode: pickField(row, 'itemGroupCode', 'ItmsGrpCod'),
    itemGroupName: pickField(row, 'itemGroupName', 'ItmsGrpNam'),
  };
}

export async function searchSapItems(query, limit = 20) {
  if (!query || query.trim().length < 1) {
    return [];
  }
  const rows = await searchItems(query.trim(), limit);
  return (rows || []).map(mapHanaItemRow).filter((r) => r?.itemCode);
}

export async function getSapItem(itemCode) {
  const rows = await getItemDetail(itemCode);
  const row = rows?.[0];
  if (!row) return null;
  return mapHanaItemRow(row);
}

export async function getSapItemDetails(itemCode) {
  const rows = await getItemDetail(itemCode);
  const row = rows?.[0];
  if (!row) return null;
  return mapItemDetailRow(row);
}

export async function itemExistsInSap(itemCode) {
  try {
    await getItem(itemCode);
    return true;
  } catch (err) {
    if (err.status === 404) return false;
    throw err;
  }
}

export async function createSapItem(payload, user, relatedPRNumber) {
  await connectDB();

  try {
    const sapPayload = buildSapItemCreatePayload(payload);
    logSapItemCreatePayload(sapPayload);

    const sapResult = await createItem(sapPayload);
    const createdItemCode = sapResult?.ItemCode;
    if (!createdItemCode) {
      const err = new Error('SAP did not return an ItemCode after item creation');
      err.code = 'SAP_ITEM_FAILED';
      throw err;
    }

    await ItemCreationLog.create({
      itemCode: createdItemCode,
      itemName: payload.ItemName,
      createdBy: user._id || user.id,
      sapResponse: sapResult,
      status: 'Success',
      relatedPRNumber,
    });
    await writeSapIntegrationLog({
      documentType: 'ITEM',
      documentId: user._id || user.id,
      action: 'CREATE_ITEM',
      requestPayload: payload,
      responsePayload: sapResult,
      sapDocEntry: sapResult?.DocEntry,
      sapDocNum: createdItemCode,
      status: 'Success',
    });
    return { success: true, data: sapResult };
  } catch (err) {
    const sapError = formatSapErrorForClient(err);
    const message = sapError.message || getSapErrorMessage(err);
    console.error('[sap/items/create] SAP Error', sapError);
    console.error('[sap/items/create] SAP response body', err.responseBody ?? sanitizeSapError(err));
    await ItemCreationLog.create({
      itemCode: '(auto)',
      itemName: payload.ItemName,
      createdBy: user._id || user.id,
      sapResponse: err.responseBody || null,
      status: 'Failed',
      errorMessage: message,
      relatedPRNumber,
    });
    await writeSapIntegrationLog({
      documentType: 'ITEM',
      documentId: user._id || user.id,
      action: 'CREATE_ITEM',
      requestPayload: payload,
      responsePayload: err.responseBody || null,
      status: 'Failed',
      errorMessage: message,
    });
    const wrapped = new Error(message || 'Failed to create item in SAP');
    wrapped.code = err.code === 'SAP_ITEM_SERIES_NOT_CONFIGURED' ? err.code : 'SAP_ITEM_FAILED';
    wrapped.status = err.status || sanitizeSapError(err).status || 502;
    wrapped.sapError = sapError;
    wrapped.responseBody = err.responseBody;
    throw wrapped;
  }
}
