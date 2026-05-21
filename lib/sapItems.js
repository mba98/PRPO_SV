import '@/models/index.js';
import ItemCreationLog from '@/models/ItemCreationLog.js';
import { searchItems, getItemDetail } from '@/lib/sapHana.js';
import { getItem, createItem } from '@/lib/sapServiceLayer.js';
import { connectDB } from '@/lib/mongodb';

function mapHanaRow(row) {
  return {
    itemCode: row.ItemCode || row.ITEMCODE,
    itemName: row.ItemName || row.ITEMNAME,
    uom: row.PurPackMsr || row.PURPACKMSR,
    itemGroup: row.ItmsGrpNam || row.ITMSGRPNAM,
  };
}

export async function searchSapItems(query) {
  if (!query || query.trim().length < 1) {
    return [];
  }
  const rows = await searchItems(query.trim());
  return (rows || []).map(mapHanaRow);
}

export async function getSapItem(itemCode) {
  const rows = await getItemDetail(itemCode);
  const row = rows?.[0];
  if (!row) return null;
  return mapHanaRow(row);
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
    return { success: true, data: sapResult };
  } catch (err) {
    const message = err?.responseBody?.error?.message?.value || err.message;
    await ItemCreationLog.create({
      itemCode: payload.ItemCode,
      itemName: payload.ItemName,
      createdBy: user._id || user.id,
      sapResponse: err.responseBody || null,
      status: 'Failed',
      errorMessage: message,
      relatedPRNumber,
    });
    const wrapped = new Error(message || 'Failed to create item in SAP');
    wrapped.code = 'SAP_ITEM_FAILED';
    throw wrapped;
  }
}
