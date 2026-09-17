# Known Robot native identity

Known Robot owns contributor UUIDs, permanent handles, team memberships and artifact attribution. Email-code authentication uses Supabase Auth; GitHub and Hugging Face URLs are optional self-declared references, never identity keys or verification credentials. Public browsing and the local validator require no account.

Profiles are created only after explicit public-profile consent. Email addresses and authentication credentials are not public profile data. Team invitations require acceptance, expire after seven days, and are invalid if their inviter loses the necessary authority. Team ownership transfers are serialized; owners must transfer before leaving. Membership does not appoint reviewers. Published evaluation evidence remains immutable and initially self-reported.

## Release gate

`KNOWNROBOT_EMAIL_AUTH_READY` defaults to false. Do not set it to `true` until a verified production SMTP sender for knownrobot.com is configured in Supabase Auth and tested with real external recipients. Configure the production site URL as `https://knownrobot.com`, an email OTP template containing `{{ .Token }}`, appropriate email rate limits, and abuse protection before opening signup. Supabase's restricted default sender is not a public-production email service.

Apply `202609170001_native_identity.sql` to the linked Known Robot project only after database authorization tests pass. Verify signup, code expiry/reuse, sign-out, profile consent, invitation acceptance, private drafts, publication, and JSON export against the deployed application before announcing accounts. Never use test fixtures as public evidence.

## SMTP verification — September 17, 2026

The Known Robot Supabase project `lxhepwrzhpukmuoeiwgj` uses Resend custom SMTP at `smtp.resend.com:465`, with sender `KnownRobot <accounts@knownrobot.com>`. Its dedicated Resend credential has sending-only access scoped to `knownrobot.com` and is stored in Supabase's encrypted SMTP configuration, not in application source or public environment variables. The production Auth site URL is `https://knownrobot.com`. Confirmation and returning-user emails both render a one-time code using `{{ .Token }}` and the subject `Your KnownRobot sign-in code`.

A real Supabase Auth email-code request returned HTTP 200, and Resend reported Delivered to the approved external test recipient. Code expiry remains one hour; sending is limited to 30 emails per hour with a 60-second minimum interval per recipient. This verifies transport, not the deployed account UI, code redemption/reuse, or abuse protection. The application signup release gate remains closed until those release checks are complete.

## Future authentication changes

Contributor UUIDs currently match the project's native Supabase Auth user UUIDs, not external provider subjects. Changing authentication vendors requires preserving these UUIDs or migrating an explicit authentication-to-contributor mapping and the existing foreign keys. Never merge accounts automatically by a social username, repository namespace, affiliation, or an unverified email. Keep historical attribution and independent review appointments separate from current memberships.

## Verification

`npm test`, `npm run lint`, and `npm run build` validate application contracts. `supabase/tests/run_verification.py` creates and drops a disposable PostgreSQL database, applies all migrations, and runs identity, authorization and concurrency tests. Run it only against a dedicated test cluster, never production.
