<!-- LOVABLE:BEGIN -->
> [!IMPORTANT]
> This project is connected to [Lovable](https://lovable.dev). Avoid rewriting
> published git history — force pushing, or rebasing/amending/squashing commits
> that are already pushed — as it rewrites history on Lovable's side and the
> user will likely lose their project history.
>
> Commits you push to the connected branch sync back to Lovable and show up in
> the editor, so keep the branch in a working state.
<!-- LOVABLE:END -->

- The demo wallet (`/demo-wallet`) keeps its user, balance and reload history in browser localStorage and talks to the senangPay (DOKU) sandbox through its own server functions — so reloads can be tested without MySQL; never route it through the seeded SENANGPAY provider rows.
- The staff Wallet Reload Test page (/wallet-test) must call the same startReload/confirmReload used by /api/v1/wallets/reload so testing there matches the Wallet API; wallet data stays in MySQL, never the cloud database.
- Run the MySQL-only source guard before deployment; editor-managed Cloud scaffolding must stay unreachable and is omitted from standalone exports so self-hosted servers never need Cloud credentials.
