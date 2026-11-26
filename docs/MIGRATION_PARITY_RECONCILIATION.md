# G2 Migration Parity Reconciliation

**Task:** G2-EXECUTION-RECONCILE-01  
**Repository baseline:** `main` at `afd9f706479a3521bc820527d6f66c6cb2e1f406`  
**Database:** Supabase project `ofppapwofhovhroyjtkc` (read-only inspection; no production writes)  
**Scope:** Reconcile the installed 20-entry migration history only. This document does not authorize or include G3 Pickup DDL.

## Evidence method

The hosted `supabase_migrations.schema_migrations` rows were read with `version`, `name`, and `statements[1]`. The database returned 20 rows and one stored SQL statement per row. The `md5_of_sql` column below is PostgreSQL `md5(statements[1])`; `source_sql_md5` is the MD5 of the branch source file after this reconciliation. Hashes identify the exact UTF-8 text and do not by themselves prove catalog equivalence.

The two absent source payloads were extracted verbatim from the recorded `statements[1]` values. Owner-provided provenance is that both were applied directly to this project through Supabase migration tooling. Their original review-candidate header comments are preserved unchanged. The hosted history independently confirms that the named versions and complete statement payloads are recorded as applied. The review-candidate wording is retained as historical source text and is not treated as executable authorization.

## Installed-history parity matrix

| version | name | filename | md5_of_sql (hosted statement) | source_sql_md5 | SQL-match confirmation | provenance_status |
|---|---|---|---|---|---|---|
| 20261110212125 | `authentication_foundation` | `20261110212125_authentication_foundation.sql` | `a49844db652602ae0f73d35f00ccc7d1` | `db0ed4f2cbf6447ade19a6c400974b39` | SEMANTIC MATCH; header comments and function-body whitespace differ | SEMANTIC MATCH; header comments and function-body whitespace differ |
| 20261110212204 | `revoke_auth_trigger_execute` | `20261110212204_revoke_auth_trigger_execute.sql` | `59d13c28255b574881be724fb74ee090` | `1e7d2789adeacfda28fcec290c102eb3` | SEMANTIC MATCH; source comment differs | SEMANTIC MATCH; source comment differs |
| 20261110212239 | `revoke_auth_trigger_execute_public` | `20261110212239_revoke_auth_trigger_execute_public.sql` | `3d7921b86d05f48028215dd210f5d03e` | `3d7921b86d05f48028215dd210f5d03e` | Exact bytes | CORRECTED TO EXACT INSTALLED SQL |
| 20261111150532 | `atomic_telegram_account_link` | `20261111150532_atomic_telegram_account_link.sql` | `d2dce2479ed52d7c8ee00279616e1618` | `46eeed709de4aceccc1e2695cf13b058` | SEMANTIC MATCH; trailing newline differs | SEMANTIC MATCH; trailing newline differs |
| 20261112190435 | `canonical_account_roles` | `20261112190435_canonical_account_roles.sql` | `03a3e19ee9551162259d7b6ada785e43` | `d7cfdadc441b65732b72eb5b6fcc8af6` | SEMANTIC MATCH; repository provenance comment differs | SEMANTIC MATCH; repository provenance comment differs |
| 20261113120000 | `human_friendly_usernames` | `20261113120000_human_friendly_usernames.sql` | `9e9be54bd92894fe11c894205b9f89f0` | `ead09e633b6c4dcad2b66332499346ce` | SEMANTIC MATCH; CRLF/LF line endings differ | SEMANTIC MATCH; CRLF/LF line endings differ |
| 20261113150000 | `account_governance_foundation` | `20261113150000_account_governance_foundation.sql` | `571c3082553c1dc61e6b425d078a2c0e` | `0e61576576fc1f8fe3f0d0c977363611` | SEMANTIC MATCH; repository provenance comment differs | SEMANTIC MATCH; repository provenance comment differs |
| 20261115005628 | `gov02_manager_delegation_and_preferences` | `20261115005628_gov02_manager_delegation_and_preferences.sql` | `7fbe023cfb89437223cdb55ebf4ac60c` | `7fbe023cfb89437223cdb55ebf4ac60c` | Exact bytes | BYTE-EXACT SOURCE MATCH |
| 20261115005910 | `people_family_academics_enrollment` | `20261115005910_people_family_academics_enrollment.sql` | `071a9dcee9b073e826a3796b212f0ddc` | `071a9dcee9b073e826a3796b212f0ddc` | Exact bytes | BYTE-EXACT SOURCE MATCH |
| 20261115010521 | `broadcasts_calendar_class_community` | `20261115010521_broadcasts_calendar_class_community.sql` | `e2b04c58ee42308b11716cfbd8b57d64` | `e2b04c58ee42308b11716cfbd8b57d64` | Exact bytes | BYTE-EXACT SOURCE MATCH |
| 20261115011519 | `parent_notes_and_messaging` | `20261115011519_parent_notes_and_messaging.sql` | `53ceec4b93b3ce59a905465baf31d5fb` | `53ceec4b93b3ce59a905465baf31d5fb` | Exact bytes | BYTE-EXACT SOURCE MATCH |
| 20261115011625 | `directory_food_menu_public_content` | `20261115011625_directory_food_menu_public_content.sql` | `85d7fd1534e47a3e313847534abbd01d` | `85d7fd1534e47a3e313847534abbd01d` | Exact bytes | BYTE-EXACT SOURCE MATCH |
| 20261115011700 | `fix_broadcast_level_validation` | `20261115011700_fix_broadcast_level_validation.sql` | `24ff9eac0119e928c84e179616f403f8` | `24ff9eac0119e928c84e179616f403f8` | Exact bytes | BYTE-EXACT SOURCE MATCH |
| 20261115012206 | `harden_school_helper_grants` | `20261115012206_harden_school_helper_grants.sql` | `f25a1700358e975e43124722aeb88067` | `f25a1700358e975e43124722aeb88067` | Exact bytes | BYTE-EXACT SOURCE MATCH |
| 20261117185416 | `academics_subject_catalogue_and_teacher_allocations` | `20261117185416_academics_subject_catalogue_and_teacher_allocations.sql` | `8b4b75f20a32108e2d7c073a915d185e` | `8b4b75f20a32108e2d7c073a915d185e` | Exact bytes | BYTE-EXACT SOURCE MATCH |
| 20261117214536 | `calendar_cancellation_serialization` | `20261117214536_calendar_cancellation_serialization.sql` | `b669eb63a03a748148ebd61017296c1b` | `b669eb63a03a748148ebd61017296c1b` | Exact bytes | BYTE-EXACT SOURCE MATCH |
| 20261118093040 | `calendar_audience_snapshot` | `20261118093040_calendar_audience_snapshot.sql` | `fd1daf08834fb049fee48c9711974ced` | `fd1daf08834fb049fee48c9711974ced` | Exact bytes | RESTORED VERBATIM FROM HOSTED STATEMENTS; header retained |
| 20261118103953 | `daily_class_attendance` | `20261118103953_daily_class_attendance.sql` | `096be5071cfde3b9ce46f427f0ddffc4` | `096be5071cfde3b9ce46f427f0ddffc4` | Exact bytes | RESTORED VERBATIM FROM HOSTED STATEMENTS; header retained |
| 20261118213709 | `class_management_creation_permissions_and_years` | `20261118213709_class_management_creation_permissions_and_years.sql` | `8723be23dedddd25d7b0ff948b3882d1` | `8723be23dedddd25d7b0ff948b3882d1` | Exact bytes | BYTE-EXACT SOURCE MATCH |
| 20261118235802 | `students_search_and_identity_detail` | `20261118235802_students_search_and_identity_detail.sql` | `1ba630fb8a2b84c27c153c3916eab973` | `1ba630fb8a2b84c27c153c3916eab973` | Exact bytes | BYTE-EXACT SOURCE MATCH |

## Timestamp reconciliation

The 15 source filenames below are renamed to the installed versions shown in the matrix. No migration body is changed for timestamp alignment. This restores the hosted chronological order, including Calendar cancellation serialization after Academics as recorded in the installed history.

| Previous source version | Installed version | Migration |
|---|---|---|
| `20261110210000` | `20261110212125` | `authentication_foundation` |
| `20261110222200` | `20261110212204` | `revoke_auth_trigger_execute` |
| `20261110222300` | `20261110212239` | `revoke_auth_trigger_execute_public` |
| `20261111030000` | `20261111150532` | `atomic_telegram_account_link` |
| `20261114100000` | `20261115005628` | `gov02_manager_delegation_and_preferences` |
| `20261114110000` | `20261115005910` | `people_family_academics_enrollment` |
| `20261114120000` | `20261115010521` | `broadcasts_calendar_class_community` |
| `20261114130000` | `20261115011519` | `parent_notes_and_messaging` |
| `20261114140000` | `20261115011625` | `directory_food_menu_public_content` |
| `20261115003630` | `20261115011700` | `fix_broadcast_level_validation` |
| `20261115012023` | `20261115012206` | `harden_school_helper_grants` |
| `20261117110000` | `20261117185416` | `academics_subject_catalogue_and_teacher_allocations` |
| `20261115213000` | `20261117214536` | `calendar_cancellation_serialization` |
| `20261118210357` | `20261118213709` | `class_management_creation_permissions_and_years` |
| `20261118222622` | `20261118235802` | `students_search_and_identity_detail` |

## SQL drift disposition

The main-branch `revoke_auth_trigger_execute_public` source revoked execution from `PUBLIC` only. The installed statement is `revoke execute on function public.handle_new_user() from public, anon, authenticated;`. The reconciled file uses the installed statement verbatim; the database history shows its MD5 as `3d7921b86d05f48028215dd210f5d03e`.

Six other source files differ byte-for-byte from their stored statements only in comments or formatting recorded in the matrix. Their executable SQL was compared against the hosted statements; no other SQL-token change was found. The two restored files and the corrected revoke statement are byte-identical to their hosted payloads.

## Normalized live catalog snapshot

On 2026-11-26, a read-only query against `ofppapwofhovhroyjtkc` computed deterministic MD5 fingerprints from sorted, normalized `public` catalog rows. The snapshot covers relation kinds/owners/RLS, columns and formatted types/nullability/defaults, custom type definitions and enum labels, constraints, indexes, non-internal triggers, public function/procedure signatures and definitions/security/owners/configuration, RLS policies, and explicit table/routine ACL entries. OIDs and application row data are excluded. Row counts and fingerprints are:

| Catalog category | Rows | Normalized MD5 |
|---|---:|---|
| Relations | 50 | `6a45512997971f57eff829e358ef9767` |
| Columns | 519 | `94c56097d3ae7f3f32b17028ea3bffbe` |
| Constraints | 304 | `60ddb737da94705fe02e13c1a27332ee` |
| Indexes | 93 | `a3105f3a779e0a734a272d36e55f5000` |
| Triggers | 40 | `243e9c72292fe2a2ac8dbec5220555f5` |
| Functions and procedures | 99 | `3688e8bce4583672b13f46eb0b094eb2` |
| RLS policies | 56 | `d093adf4ea11deae5d7067ae0fc9fa4a` |
| Table/view/sequence grants | 839 | `2643402505bd4f6a74a930e30cd9e5b5` |
| Routine grants | 295 | `97acc07e6163e9b2b1bdf889faec8761` |
| Custom types | 2 | `ad0b86ba85981a94326ee576e14f199f` |

`supabase/tests/migration_catalog_parity.test.sql` computes the same ten fingerprints on the isolated database after the migration replay and asserts both row counts and hashes against this live snapshot. The comparison is **pending** until that test passes in GitHub Actions for this branch. A mismatch is a hard stop; do not waive or label it unexplained parity without investigating the differing category.

## Verification boundary

The successful replay run `45737505828` validated all 20 migrations and the existing application/security suites, but it predates the normalized catalog parity test. A new passing GitHub Actions run on the updated branch is required to close G2. That run must show all ten catalog assertions passing alongside the application checks, `db reset`, and SQL security tests.

No live production migration was applied. No `main` ref was changed. No G3 Pickup schema, RLS, RPC, or Edge Function is part of this packet. The normalized live/replay comparison is not yet claimed as passing.
