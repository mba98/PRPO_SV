/**
 * Export portal ↔ SAP reference archive before test data cleanup.
 *
 * Run: npm run export:sap-references
 * Output: backup/<db>-<YYYYMMDD>/sap-references.{json,csv}
 */
import fs from 'node:fs';
import path from 'node:path';
import mongoose from 'mongoose';
import { loadEnvLocal } from '../lib/loadEnvLocal.js';
import {
  connectMongo,
  disconnectMongo,
  getMongoUriSummary,
} from '../lib/mongodb.js';
import { formatMongoConnectionError } from '../lib/mongodbUri.js';

function formatDateStamp(date = new Date()) {
  const y = date.getUTCFullYear();
  const m = String(date.getUTCMonth() + 1).padStart(2, '0');
  const d = String(date.getUTCDate()).padStart(2, '0');
  return `${y}${m}${d}`;
}

function csvEscape(value) {
  const text = value == null ? '' : String(value);
  if (/[",\n\r]/.test(text)) {
    return `"${text.replace(/"/g, '""')}"`;
  }
  return text;
}

function mapPr(row) {
  return {
    portalDocumentType: 'PR',
    portalNumber: row.portalPRNumber || '',
    mongoId: row._id.toString(),
    sapDocEntry: row.sapPRDocEntry ?? '',
    sapDocNum: row.sapPRDocNum ?? '',
    status: row.status || '',
    createdAt: row.createdAt ? new Date(row.createdAt).toISOString() : '',
  };
}

function mapPo(row) {
  return {
    portalDocumentType: 'PO',
    portalNumber: row.portalPONumber || '',
    mongoId: row._id.toString(),
    sapDocEntry: row.sapPODocEntry ?? '',
    sapDocNum: row.sapPODocNum ?? '',
    status: row.status || '',
    createdAt: row.createdAt ? new Date(row.createdAt).toISOString() : '',
  };
}

function mapApri(row) {
  return {
    portalDocumentType: 'APRI',
    portalNumber: row.portalAPNumber || '',
    mongoId: row._id.toString(),
    sapDocEntry: row.sapAPDocEntry ?? '',
    sapDocNum: row.sapAPDocNum ?? '',
    status: row.status || '',
    createdAt: row.createdAt ? new Date(row.createdAt).toISOString() : '',
  };
}

function mapLp(row) {
  return {
    portalDocumentType: 'LOCAL_PURCHASE',
    portalNumber: row.portalLPNumber || '',
    mongoId: row._id.toString(),
    sapDocEntry: '',
    sapDocNum: '',
    status: row.status || '',
    createdAt: row.createdAt ? new Date(row.createdAt).toISOString() : '',
  };
}

function toCsv(rows) {
  const headers = [
    'portalDocumentType',
    'portalNumber',
    'mongoId',
    'sapDocEntry',
    'sapDocNum',
    'status',
    'createdAt',
  ];
  const lines = [headers.join(',')];
  for (const row of rows) {
    lines.push(headers.map((h) => csvEscape(row[h])).join(','));
  }
  return `${lines.join('\n')}\n`;
}

async function main() {
  loadEnvLocal();
  if (!process.env.MONGODB_URI) {
    throw new Error('MONGODB_URI is not set.');
  }

  const { summary } = getMongoUriSummary();
  await connectMongo();
  const db = mongoose.connection.db;
  const dbName = db.databaseName;
  const stamp = formatDateStamp();
  const outDir = path.resolve(process.cwd(), 'backup', `${dbName}-${stamp}`);
  fs.mkdirSync(outDir, { recursive: true });

  const [prs, pos, apris, lps] = await Promise.all([
    db.collection('purchaserequests').find({}).sort({ createdAt: 1 }).toArray(),
    db.collection('purchaseorders').find({}).sort({ createdAt: 1 }).toArray(),
    db.collection('apreserveinvoices').find({}).sort({ createdAt: 1 }).toArray(),
    db.collection('localpurchases').find({}).sort({ createdAt: 1 }).toArray(),
  ]);

  const rows = [
    ...prs.map(mapPr),
    ...pos.map(mapPo),
    ...apris.map(mapApri),
    ...lps.map(mapLp),
  ];

  const manifest = {
    exportedAt: new Date().toISOString(),
    database: dbName,
    hosts: summary?.ok ? summary.hosts : null,
    counts: {
      PR: prs.length,
      PO: pos.length,
      APRI: apris.length,
      LOCAL_PURCHASE: lps.length,
      total: rows.length,
    },
    sapLinked: {
      PR: rows.filter((r) => r.portalDocumentType === 'PR' && (r.sapDocEntry || r.sapDocNum)).length,
      PO: rows.filter((r) => r.portalDocumentType === 'PO' && (r.sapDocEntry || r.sapDocNum)).length,
      APRI: rows.filter((r) => r.portalDocumentType === 'APRI' && (r.sapDocEntry || r.sapDocNum)).length,
    },
    note:
      'Local Purchase has no SAP DocEntry/DocNum fields in the portal schema. Deleting MongoDB data does not delete SAP documents.',
    rows,
  };

  const jsonPath = path.join(outDir, 'sap-references.json');
  const csvPath = path.join(outDir, 'sap-references.csv');
  fs.writeFileSync(jsonPath, `${JSON.stringify(manifest, null, 2)}\n`, 'utf8');
  fs.writeFileSync(csvPath, toCsv(rows), 'utf8');

  console.log('=== SAP reference export complete ===');
  console.log(`Database: ${dbName}`);
  console.log(`Directory: ${outDir}`);
  console.log(`JSON: ${jsonPath}`);
  console.log(`CSV: ${csvPath}`);
  console.log(`Counts: PR=${prs.length}, PO=${pos.length}, APRI=${apris.length}, LP=${lps.length}`);
  console.log(
    `SAP-linked: PR=${manifest.sapLinked.PR}, PO=${manifest.sapLinked.PO}, APRI=${manifest.sapLinked.APRI}`,
  );
}

main()
  .catch((error) => {
    console.error('Export failed:', formatMongoConnectionError(error.cause || error));
    process.exitCode = 1;
  })
  .finally(async () => {
    await disconnectMongo();
  });
