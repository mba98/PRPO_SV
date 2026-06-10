import '@/models/index.js';
import ItemCreationLog from '@/models/ItemCreationLog.js';
import { searchItems, getItemDetail } from '@/lib/sapHana.js';
import { getItem, createItem } from '@/lib/sapServiceLayer.js';
import { connectDB } from '@/lib/mongodb';
import { formatSapErrorForClient, getSapErrorMessage, sanitizeSapError } from '@/lib/sap/sapErrors.js';
import { writeSapIntegrationLog } from '@/lib/sap/sapIntegrationLog.js';
import { getNextItemCode } from '@/lib/sapItemCode.js';

function trimOptional(value) {
  if (value == null || value === '') return undefined;
  const s = String(value).trim();
  return s || undefined;
}

/**
 * Map portal item create body → SAP Service Layer /Items payload.
 * ItemCode is required for Service Layer; omit empty optional fields (e.g. DefaultWarehouse).
 */
export function buildSapItemCreatePayload(payload) {
  const itemCode = trimOptional(payload.ItemCode);
  if (!itemCode) {
    throw new Error('ItemCode is required for SAP item creation');
  }

  const sapPayload = {
    ItemCode: itemCode,
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
    ItemCode: sapPayload.ItemCode,
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
  for (const key of keys) {
    if (row[key] != null && row[key] !== '') return row[key];
    const upper = key.toUpperCase();
    if (row[upper] != null && row[upper] !== '') return row[upper];
  }
  return undefined;
}

export function mapHanaItemRow(row) {
  if (!row) return null;
  const itemCode = pickField(row, 'ItemCode');
  const purchaseUom = pickField(row, 'PurPackMsr', 'BuyUnitMsr');
  const inventoryUom = pickField(row, 'InvntryUom');
  const uomCode = purchaseUom || inventoryUom;
  const ugpEntry = pickField(row, 'UgpEntry');
  const warehouseCode = pickField(row, 'DfltWH');
  return {
    itemCode,
    itemName: pickField(row, 'ItemName'),
    uom: uomCode,
    uomCode,
    purchaseUom: pickField(row, 'PurPackMsr'),
    inventoryUom,
    defaultWarehouse: warehouseCode,
    warehouseCode,
    ugpEntry: ugpEntry != null ? Number(ugpEntry) : undefined,
    itemGroupCode: pickField(row, 'ItmsGrpCod'),
    itemGroupName: pickField(row, 'ItmsGrpNam'),
    itemGroup: pickField(row, 'ItmsGrpNam'),
  };
}

/** Full item detail for PR line auto-fill (OITM + OUGP + OWHS). */
export function mapItemDetailRow(row) {
  if (!row) return null;
  const avgPrice = pickField(row, 'AvgPrice');
  const ugpEntry = pickField(row, 'UgpEntry');
  const warehouseCode = pickField(row, 'DfltWH');
  const warehouseName = pickField(row, 'WhsName');
  const price =
    avgPrice != null && avgPrice !== '' && !Number.isNaN(Number(avgPrice))
      ? Number(avgPrice)
      : undefined;
  return {
    itemCode: pickField(row, 'ItemCode'),
    itemName: pickField(row, 'ItemName'),
    price,
    uomGroupEntry: ugpEntry != null ? Number(ugpEntry) : undefined,
    uomGroupName: pickField(row, 'UgpName'),
    warehouseCode,
    warehouseName,
    itemGroupCode: pickField(row, 'ItmsGrpCod'),
    itemGroupName: pickField(row, 'ItmsGrpNam'),
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

  let itemCode = trimOptional(payload.ItemCode);
  if (!itemCode) {
    itemCode = await getNextItemCode();
  }

  const exists = await itemExistsInSap(itemCode);
  if (exists) {
    await writeSapIntegrationLog({
      documentType: 'ITEM',
      documentId: user._id || user.id,
      action: 'CREATE_ITEM',
      requestPayload: { ...payload, ItemCode: itemCode },
      responsePayload: { skipped: true },
      status: 'Failed',
      errorMessage: 'Duplicate guard: item already exists in SAP',
    });
    const err = new Error('Item code already exists in SAP');
    err.code = 'DUPLICATE_ITEM';
    throw err;
  }

  const enrichedPayload = { ...payload, ItemCode: itemCode };

  try {
    const sapPayload = buildSapItemCreatePayload(enrichedPayload);
    logSapItemCreatePayload(sapPayload);

    const sapResult = await createItem(sapPayload);
    const createdItemCode = sapResult?.ItemCode || itemCode;
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
      requestPayload: enrichedPayload,
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
      itemCode,
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
      requestPayload: enrichedPayload,
      responsePayload: err.responseBody || null,
      status: 'Failed',
      errorMessage: message,
    });
    const wrapped = new Error(message || 'Failed to create item in SAP');
    wrapped.code = 'SAP_ITEM_FAILED';
    wrapped.status = err.status || sanitizeSapError(err).status || 502;
    wrapped.sapError = sapError;
    wrapped.responseBody = err.responseBody;
    throw wrapped;
  }
}
