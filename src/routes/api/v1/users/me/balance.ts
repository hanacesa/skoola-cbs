import { createFileRoute } from '@tanstack/react-router'
import { query } from '../../../../../lib/mysql.server'
import { requireCbsUser } from '../../../../../lib/cbs-api.functions'

type WalletBalanceRow = {
  available_balance: string | number
}

export const Route = createFileRoute(
  '/api/v1/users/me/balance'
)({
  server: {
    handlers: {
      GET: async ({ request }) => {
        try {

          // Get logged-in CBS user from JWT
          const authUser = await requireCbsUser(request)

          const wallets = await query<WalletBalanceRow>(
            `
            SELECT
              w.available_balance

            FROM parties p

            INNER JOIN accounts a
              ON a.party_id = p.id

            INNER JOIN wallets w
              ON w.account_id = a.id

            WHERE p.user_id = ?
              AND p.party_type = 'USER'
              AND p.status = 'ACTIVE'
              AND a.account_type = 'WALLET'
              AND a.status = 'ACTIVE'
              AND w.status = 'ACTIVE'

            LIMIT 1
            `,
            [authUser.userId]
          )

          if (!wallets || wallets.length === 0) {
            return Response.json(
              {
                success: false,
                message: 'Wallet not found.'
              },
              {
                status: 404
              }
            )
          }

          const wallet = wallets[0]

          return Response.json({
            success: true,
            availableBalance:
              Number(wallet?.available_balance) || 0
          })

        } catch (error: any) {

          console.error(
            'Get balance error:',
            error
          )

          return Response.json(
            {
              success: false,
              message:
                error?.message ||
                'Unable to retrieve balance.'
            },
            {
              status:
                error?.status ||
                error?.statusCode ||
                500
            }
          )
        }
      }
    }
  }
})