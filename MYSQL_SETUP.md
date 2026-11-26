# CBS on MySQL — setup

Everything the core banking system stores is in **`database.sql`**: all tables, the
double-entry posting procedure, and a full set of demo records (organizations,
clusters, users, merchants, accounts, wallets, chart of accounts, payment
providers, top-ups, transfers, audit trail, and three staff logins).

## 1. Requirements

- MySQL 8.0 or newer (MariaDB 10.6+ also works)

## 2. Create the database

```bash
mysql -u root -p < database.sql
```

This drops and recreates a database named `cbs`, so run it on a fresh instance
or rename the database at the top of the file first.

## 3. Create an application login

```sql
CREATE USER 'cbs_app'@'%' IDENTIFIED BY 'change-me-strong-password';
GRANT SELECT, INSERT, UPDATE, DELETE, EXECUTE ON cbs.* TO 'cbs_app'@'%';
FLUSH PRIVILEGES;
```

## 4. Connection settings

Put these in your environment (never commit real passwords):

```
MYSQL_HOST=127.0.0.1
MYSQL_PORT=3306
MYSQL_DATABASE=cbs
MYSQL_USER=cbs_app
MYSQL_PASSWORD=change-me-strong-password
```

## 5. Check the data loaded

```sql
USE cbs;
SELECT wallet_number, available_balance FROM wallets ORDER BY wallet_number;
SELECT reference, transaction_type, amount FROM transactions ORDER BY created_at;
```

Debits and credits are printed at the end of the import and must be equal.

## Demo staff logins

| Email | Password | Role |
| --- | --- | --- |
| admin@cbs.local | admin123 | admin |
| operator@cbs.local | admin123 | operator |
| viewer@cbs.local | admin123 | viewer |

Change these before any real use.

## Posting money

Never insert into `ledger_entries` directly — call the procedure, which enforces
balanced entries, records the transaction, and moves wallet balances:

```sql
CALL post_transaction(
  'TRF-1001', 'TRANSFER', 'Wallet transfer', 'MYR',
  '22222222-2222-4222-8222-000000000001', 'TRF-1001',
  '[{"ledger_account_id":"<from-ledger-account>","direction":"DEBIT","amount":25.00},
    {"ledger_account_id":"<to-ledger-account>","direction":"CREDIT","amount":25.00}]',
  @txn);
SELECT @txn;
```

## MySQL-only deployment

CBS staff login, wallet APIs, ledger and portal data use MySQL exclusively.
The demo wallet uses browser localStorage and the existing senangPay sandbox,
without requiring MySQL. Neither requires Cloud environment settings.

The editor maintains unused integration scaffolding; it cannot be deleted here.
It is excluded from typechecking and has no application imports. The Cloud SDK
is not an application dependency. `npm run check:mysql` rejects Cloud imports
or environment requirements in CBS code; this check also runs before builds.

For a source folder with **none of the editor-managed integration files**, run:

```bash
npm run export:mysql -- /tmp/cbs-mysql-source
```

Choose a new folder outside the project. The export excludes integration files,
environment files, repository metadata, installed dependencies and old build
output. Deploy that folder using your existing server setup, install dependencies
again and rebuild; do not reuse the older server bundle. Keep your existing
MySQL, `SESSION_SECRET`, `CREDENTIALS_KEY`, `CBS_WALLET_API_KEY`,
`CBS_USER_JWT_SECRET` and senangPay settings on your server. Do not change the
credential encryption key or reimport `database.sql` into your existing database.

The preview cannot reach MySQL running at localhost on your server. Staff login
and real-user wallet balance updates must be verified against your MySQL server.

## Detail profiles with account numbers

`database.sql` includes two views that join a user or merchant to its assigned
account number, wallet and balances:

```sql
SELECT user_code, full_name, account_number, wallet_number, available_balance
FROM v_user_profiles;

SELECT merchant_code, business_name, account_number, wallet_number, available_balance
FROM v_merchant_profiles;
```

Rows with a NULL `account_number` have not been assigned an account yet.
