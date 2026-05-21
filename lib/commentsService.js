import mongoose from 'mongoose';
import '@/models/index.js';
import Comment from '@/models/Comment.js';
import { connectDB } from '@/lib/mongodb';

export async function listComments(documentType, documentId) {
  await connectDB();
  if (!mongoose.Types.ObjectId.isValid(documentId)) return [];
  const rows = await Comment.find({ documentType, documentId })
    .sort({ postedAt: -1 })
    .populate('postedBy', 'name username')
    .lean();
  return rows.map((c) => ({
    id: c._id.toString(),
    comment: c.comment,
    postedBy: c.postedBy?.name || c.postedBy?.username,
    postedAt: c.postedAt,
  }));
}

export async function addComment(documentType, documentId, comment, user) {
  await connectDB();
  if (!mongoose.Types.ObjectId.isValid(documentId)) {
    const err = new Error('Invalid document id');
    err.code = 'INVALID_ID';
    throw err;
  }
  const doc = await Comment.create({
    documentType,
    documentId,
    comment: comment.trim(),
    postedBy: user._id,
  });
  return {
    id: doc._id.toString(),
    comment: doc.comment,
    postedAt: doc.postedAt,
  };
}
