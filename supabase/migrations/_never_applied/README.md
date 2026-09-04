# Migrations that were never applied to production

These files existed in the repo but never ran against the live database
(verified 4 Sep 2026 by checking for the columns, tables and functions they
create). They are kept out of `supabase/migrations/` so `supabase db push`
cannot replay them by accident.

| File | Why it is here |
|---|---|
| 20260417000008_gecko_images_multi_photo.sql | Adds `gecko_images.image_urls`. Nothing in the app reads or writes that column. |
| 20260422210000_notifications_send_email_trigger.sql | Superseded by `notification_dispatch_via_vault`, which sends email and push from one trigger with a Vault secret. Applying this would double-send. |
| 20260423100000_profiles_favorite_pages.sql | Adds `profiles.favorite_pages`. No code uses it; favourites live in localStorage. |
| 20260430_referral_program.sql | The referral program was never launched. `award_referral_signup_bonus()` in production expects a different schema (`social_referral_bonuses`). Decide the program's design before applying anything. |

To adopt one of these, copy it back with a fresh 14-digit timestamp and
apply it deliberately. See docs/MIGRATIONS.md.
