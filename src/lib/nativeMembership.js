/** RevenueCat catalog contract. Keep aligned with docs/BILLING.md and the SQL tier resolver. */
const entitlementTiers = { keeper: 'keeper', breeder: 'breeder', 'Geck Inspect Pro': 'breeder' };

export function mirroredMembershipTier(rows = [], now = Date.now()) {
  let tier = 'free';
  for (const row of rows) {
    if (!row.is_active || (row.expires_at && !(Date.parse(row.expires_at) > now))) continue;
    const candidate = entitlementTiers[row.entitlement_identifier];
    if (candidate === 'breeder') return 'breeder';
    if (candidate === 'keeper') tier = 'keeper';
  }
  return tier;
}

/** Custom packages have packageType CUSTOM; identify the actual Apple product. */
export function nativePackagePlan(pkg) {
  const match = /^com\.geckinspect\.(keeper|breeder)\.(monthly|annual)$/.exec(pkg?.product?.identifier || '');
  if (!match) return null;
  return { tier: match[1], label: match[1] === 'keeper' ? 'Keeper' : 'Breeder', period: match[2] === 'annual' ? 'per year' : 'per month' };
}
