import User from '@/models/User.js';

/**
 * Resolve the PR's original requester (never the acting user performing retry/SAP).
 */
export async function resolvePrRequesterUser(pr) {
  if (!pr?.requester) return null;

  if (typeof pr.requester === 'object' && pr.requester !== null) {
    if (pr.requester.username || pr.requester.sapRequesterCode) {
      return pr.requester;
    }
    const id = pr.requester._id || pr.requester;
    if (id) {
      return User.findById(id).select('username sapRequesterCode email name').lean();
    }
    return null;
  }

  return User.findById(pr.requester).select('username sapRequesterCode email name').lean();
}
