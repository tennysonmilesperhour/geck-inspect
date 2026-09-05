-- Adds a `section` column to page_config so admins can override which
-- top-level section (Manage / Discover) a page belongs to without a
-- code deploy. The application falls back to src/lib/navItems.js
-- (SECTION_FOR_PAGE) when the column is NULL, so this migration is
-- safe to roll forward without immediately backfilling every row.

ALTER TABLE page_config
  ADD COLUMN IF NOT EXISTS section text
    CHECK (section IS NULL OR section IN ('manage', 'discover'));

-- Backfill sensible defaults for every page currently in the table.
-- Keep in sync with SECTION_FOR_PAGE in src/lib/navItems.js.
UPDATE page_config SET section = 'manage'
  WHERE section IS NULL AND page_name IN (
    'MyGeckos','Breeding','BreedingPairs','Lineage','Pedigree','GeckoDetail',
    'AnimalPassport','ClaimAnimal','LikedGeckos','ProjectManager',
    'MarketplaceSalesStats','MyListings','BreederShipping','BreederStorefront',
    'Shipping','BatchHusbandry'
  );

UPDATE page_config SET section = 'discover'
  WHERE section IS NULL AND page_name IN (
    'Recognition','MorphVisualizer','MorphGuide','MorphGuideSubmission',
    'GeneticsGuide','GeneticCalculatorTool','Gallery','CareGuide','CareGuideTopic',
    'Forum','ForumPost','BreederConsultant','GeckAnswers','PrintableWorksheets',
    'ImageImport','Training','TrainModel','Marketplace','MarketplaceBuy',
    'MarketplaceSell','MarketplaceVerification','MarketPricing','BreedingROI',
    'BreedingLoans','Giveaways','Breeder'
  );

COMMENT ON COLUMN page_config.section IS
  'Top-level section this page belongs to: manage | discover. NULL means the page is section-agnostic (Dashboard, Settings, etc.).';
