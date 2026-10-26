# App Store resubmission kit, 26 October 2026

Everything that can be done without the iPhone, Xcode or App Store Connect is done. This file has the steps only Tennyson can do, in order, and the text to paste. Evidence and history are in [APP_STORE_REQUIREMENTS.md](../APP_STORE_REQUIREMENTS.md).

## Checked on 26 October (production)

- **Apple purchases reach the app.** A sandbox Breeder annual purchase (18 Oct) arrived through RevenueCat, and 8 renewals have followed, the latest today. The member's `breeder` entitlement is active. This was the last open billing proof, so `NATIVE_BILLING_WEBHOOK_VERIFIED=true` can be set for the store build.
- **Content filtering is live** (guideline 1.2). Both migrations from 19 October are applied, 48 held terms are loaded, and the approval queue is empty (nothing waiting on a moderator).
- **Account deletion** (`delete-my-account`) is deployed with sign-in required.
- **Reviewer accounts exist and are confirmed:** `morphiclabsdata+geckreview-breeder@gmail.com` (Breeder plan, 3 geckos) and `morphiclabsdata+geckreview-free@gmail.com` (free plan, 2 geckos). Passwords are the ones already in App Store Connect.
- **Sign-in rules** (guideline 4.8): on iPhone only email and password show. Google and Facebook stay hidden until Sign in with Apple is switched on. Nothing to change.
- **Build number** in the Xcode project is now 14. The last submission used build 13 (builds 8 to 13 were numbered by hand in Xcode and never recorded here), and Apple only accepts a number higher than every earlier upload.
- On `main`: lint has 0 errors, typecheck passes, 3,575 unit tests pass.

Could not check from the cloud session: whether the website pages open (the session cannot reach geckinspect.com), and anything in App Store Connect.

## Your steps, in order

### 0. Fix the EULA rejection in the listing (done 26 October, build 13 resubmitted)

Apple's automated check stopped build 13 again on 26 October because the App Store product page still had no working Terms of Use (EULA) link. The cloud session cannot open App Store Connect, so this is by hand.

https://appstoreconnect.apple.com/apps/6801304123/distribution

1. Open the 1.0 version page (left column, under iOS App). At the top right, open the language menu and repeat steps 2 and 3 for **every** language listed there, including any extra English (U.K., Australia, Canada).
2. Scroll to **Description** and paste this at the very end, on its own lines:

   ```
   Subscriptions renew automatically unless cancelled at least 24 hours before the end of the current period. Manage or cancel in your Apple Account settings.
   Terms of Use (EULA): https://www.apple.com/legal/internet-services/itunes/dev/stdeula/
   Privacy Policy: https://geckinspect.com/PrivacyPolicy
   ```

   It goes in **Description**, not Promotional Text (promotional text does not count) and not the review notes. Type the URL in full, starting with `https://`.
3. Press **Save** (top right) before switching language.
4. Open **App Information** (left column). Under **License Agreement** it should read "Apple's Standard License Agreement". If it shows a custom agreement, choose Edit and switch back to the standard one, because a blank or broken custom EULA fails the same check.
5. In **App Privacy**, confirm the Privacy Policy URL is `https://geckinspect.com/PrivacyPolicy`.

The in-app half is in code too: from build 14, the iPhone Membership screen also links Apple's standard Terms of Use (EULA) next to Terms and Privacy (guideline 3.1.2 asks for both). Build 13 already shows Terms and Privacy links, so if you resubmit before build 14 is ready, steps 1 to 5 are enough for this automated check.

### 1. Turn on Sign in with Apple for the app ID (2 minutes)

The iOS project now asks for this permission, so build 14 will not sign without it, even though the button stays hidden.

https://developer.apple.com/account/resources/identifiers/list

Open `com.geckinspect.app`, tick **Sign in with Apple**, Save. If Xcode uses automatic signing, it refreshes the profile on its own; otherwise download a new App Store profile.

### 2. Build and upload build 14

On the Mac, from the repo on the latest `main`:

```
NATIVE_AUTH_REDIRECT_VERIFIED=true NATIVE_BILLING_WEBHOOK_VERIFIED=true pnpm ios:release
```

In Xcode: confirm Version 1.0, Build 14 (raise it if App Store Connect already has a 14 or higher), then Product > Archive > Distribute App > App Store Connect.

Build 13 does not have the purchase fix from 24 October or the other changes merged since the last submission, so do not resubmit it.

### 3. Record the walkthrough Apple asked for

On a phone running the **newest iOS** (the iPhone 11 on 18.5 does not qualify). Install build 14 from TestFlight, start screen recording, then in one take:

1. Launch the app from the home screen.
2. Sign in with the Breeder reviewer account.
3. Today, then My Geckos, then open a gecko.
4. Add a gecko and take its photo with the **camera**.
5. Morph ID: take or pick a photo, show the AI data notice, run one scan.
6. Breeding: open a pair and show the clutch odds.
7. Settings > **Phone reminders**: turn one on and accept the iOS notification prompt.
8. Membership: show the store prices, **Restore purchases**, and the Terms and Privacy links.
9. Community: open a post, tap **Report**, and show the **Block** option in the same dialog.
10. Settings > **Delete account**: open the dialog and cancel.

Steps 4, 7 and 8 are the device features that answer "is this just a website" (guideline 4.2), so make them clear.

### 4. Sandbox purchase on build 14

Sign in with the **free** reviewer account, buy Keeper monthly with a sandbox tester, delete the app, reinstall, Restore purchases. The plan should come back. RevenueCat delivery is already proven, so this checks the new build only.

### 5. Screenshots

The app ships on iPhone and iPad, so both sizes are needed. Take them from build 14 (the design changed in the 17 October overhaul). Do not show the Morph Visualizer, Promote, the AI Consultant or the supplies store; those are retired.

### 6. App Store Connect

https://appstoreconnect.apple.com/apps/6801304123/distribution

- **Description:** make sure it ends with the block in "Description footer" below, in every language.
- **App Review Information:** both reviewer accounts, your contact details, and the notes in "Review notes" below. Attach the recording.
- **Build:** select build 14.
- **Subscriptions:** all four (Keeper monthly and annual, Breeder monthly and annual) attached to this version.
- **Age rating and App Privacy:** re-answer if anything changed. Nothing in build 14 adds new data collection.
- **Reply to Apple** in the Resolution Center with the text in "Reply to App Review" below, then Submit for Review. Keep release on manual.

## Description footer

```
Subscriptions renew automatically unless cancelled at least 24 hours before the end of the current period. Manage or cancel in your Apple Account settings.
Terms of Use (EULA): https://www.apple.com/legal/internet-services/itunes/dev/stdeula/
Privacy Policy: https://geckinspect.com/PrivacyPolicy
```

## Review notes

Paste into App Review Information > Notes.

```
Geck Inspect is a record-keeping app for crested gecko keepers and breeders: collection records, weights and feeding logs, breeding pairs with clutch odds, lineage, and photo-based morph identification.

Accounts
- Breeder plan (all paid features): morphiclabsdata+geckreview-breeder@gmail.com
- Free plan (to test purchases): morphiclabsdata+geckreview-free@gmail.com
Passwords are in the sign-in fields above.

Device features
- Camera and photo library: adding a gecko, gecko photos and Morph ID.
- Local notifications: Settings > Phone reminders schedules feeding and weigh-in reminders on the device.
- In-app purchase: Keeper and Breeder, monthly or annual, through StoreKit.

Where to find things
- Membership (prices, Restore purchases, Terms, Privacy): side menu > Membership.
- Account deletion: Settings > Delete account > Delete my account. It deletes the account in the app; no email or website step.
- Morph ID sends the photo to our AI providers (Anthropic, Replicate) only after the member confirms a notice on each scan.

Member content (1.2)
New posts and photos are screened automatically against a list of objectionable terms; photos and links from new members, and all content from members with prior removals, are held for manual approval. Members can report any post, comment or photo, and block its author from the same screen. Reports are reviewed within 24 hours. Contact: morphiclabsdata@gmail.com (also in Settings and the Privacy Policy).

A screen recording on a physical device, from launch through each of these features, is attached.
```

The support address matches the one the app shows (`SUPPORT_EMAIL` in the code). Check the "side menu > Membership" path against build 14 before pasting.

## Reply to App Review

```
Hello,

Thank you for the review. In response to the request for more information:

1. A screen recording made on a physical iPhone running the latest iOS is attached. It starts at launch and shows sign-in, adding a gecko with the camera, Morph ID, breeding records, on-device reminders, the subscription screen with Restore purchases, reporting and blocking, and account deletion.

2. Demo accounts for the free and paid plans are in App Review Information.

3. The App Store description now includes the Terms of Use (EULA) and Privacy Policy links, and the subscription screen in the app shows the price, renewal period, Restore purchases, Terms and Privacy.

4. Build 14 is the current build. It includes automatic filtering and manual approval of member content, a confirmation before any photo is sent to an AI service, and in-app account deletion.

The review notes describe where each feature is. Please let us know if anything else is needed.

Thank you,
Tennyson
```
