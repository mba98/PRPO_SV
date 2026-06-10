import '@/models/index.js';
import ItemCreationLog from '@/models/ItemCreationLog.js';
import { searchItems, getItemDetail } from '@/lib/sapHana.js';
import { getItem, createItem } from '@/lib/sapServiceLayer.js';
import { connectDB } from '@/lib/mongodb';
import { getSapErrorMessage } from '@/lib/sap/sapErrors.js';
import { writeSapIntegrationLog } from '@/lib/sap/sapIntegrationLog.js';

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
  return {
    itemCode,
    itemName: pickField(row, 'ItemName'),
    uom: uomCode,
    uomCode,
    purchaseUom: pickField(row, 'PurPackMsr'),
    inventoryUom,
    defaultWarehouse: pickField(row, 'DfltWH'),
    ugpEntry: ugpEntry != null ? Number(ugpEntry) : undefined,
    itemGroupCode: pickField(row, 'ItmsGrpCod'),
    itemGroupName: pickField(row, 'ItmsGrpNam'),
    itemGroup: pickField(row, 'ItmsGrpNam'),
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
  const exists = await itemExistsInSap(payload.ItemCode);
  if (exists) {
    await writeSapIntegrationLog({
      documentType: 'ITEM',
      documentId: user._id || user.id,
      action: 'CREATE_ITEM',
      requestPayload: payload,
      responsePayload: { skipped: true },
      status: 'Failed',
      errorMessage: 'Duplicate guard: item already exists in SAP',
    });
    const err = new Error('Item code already exists in SAP');
    err.code = 'DUPLICATE_ITEM';
    throw err;
  }

  try {
    const sapResult = await createItem(payload);
    await ItemCreationLog.create({
      itemCode: payload.ItemCode,
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
      sapDocNum: sapResult?.ItemCode || payload.ItemCode,
      status: 'Success',
    });
    return { success: true, data: sapResult };
  } catch (err) {
    const message = getSapErrorMessage(err);
    await ItemCreationLog.create({
      itemCode: payload.ItemCode,
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
    wrapped.code = 'SAP_ITEM_FAILED';
    throw wrapped;
  }
}
