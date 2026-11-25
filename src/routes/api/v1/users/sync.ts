
import { createFileRoute } from '@tanstack/react-router'
import { query } from '../../../../lib/mysql.server'
import crypto from 'node:crypto'

type UserRow = {
  id: string
  user_code: string
  organization_id: string
}

function authorized(request: Request): boolean {
  const expected = process.env["CBS_SKOOLA_SYNC_API_KEY"]
  const provided =
    request.headers.get('authorization')?.replace(/^Bearer\s+/i, '') ?? ''

  if (!expected || !provided) return false

  const a = Buffer.from(provided)
  const b = Buffer.from(expected)

  return a.length === b.length && crypto.timingSafeEqual(a, b)
}

export const Route = createFileRoute('/api/v1/users/sync')({
  server: {
    handlers: {
      POST: async ({ request }) => {
        if (!authorized(request)) {
          return Response.json(
            { success: false, message: 'Unauthorized' },
            { status: 401 }
          )
        }

        try {
          const body = await request.json()

          const {
            organization_id,
            user_code,
            full_name,
            email,
            mobile,
            password_hash
          } = body

          if (
            typeof organization_id !== 'string' ||
            typeof user_code !== 'string' ||
            typeof full_name !== 'string' ||
            !organization_id ||
            !user_code ||
            !full_name ||
            (email != null && typeof email !== 'string') ||
            (mobile != null && typeof mobile !== 'string')
          ) {
            return Response.json(
              { success: false, message: 'Invalid or missing fields.' },
              { status: 422 }
            )
          }

          // Password is optional for students.
          // Only bcrypt hashes are accepted.
          if (
            password_hash !== undefined &&
            password_hash !== null &&
            (
              typeof password_hash !== 'string' ||
              !/^\$2[aby]\$\d{2}\$[./A-Za-z0-9]{53}$/.test(password_hash)
            )
          ) {
            return Response.json(
              { success: false, message: 'Invalid password hash format.' },
              { status: 422 }
            )
          }

          if (
            !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(organization_id) ||
            user_code.length > 40 ||
            full_name.length > 160 ||
            (email != null && email.length > 255) ||
            (mobile != null && mobile.length > 40)
          ) {
            return Response.json(
              { success: false, message: 'Invalid field length or organization ID.' },
              { status: 422 }
            )
          }

          if (
            organization_id !== process.env["CBS_SKOOLA_ORGANIZATION_ID"]
          ) {
            return Response.json(
              { success: false, message: 'Organization is not permitted.' },
              { status: 403 }
            )
          }

          // Find user by stable SKOOLA user code.
          const existing = await query<UserRow>(
            `
            SELECT id, user_code, organization_id
            FROM users
            WHERE user_code = ?
            LIMIT 1
            `,
            [user_code]
          )

          if (existing.length > 0) {
            // Never modify an account belonging to another organization.
            if (existing[0]!.organization_id !== organization_id) {
              return Response.json(
                { success: false, message: 'User belongs to another organization.' },
                { status: 403 }
              )
            }

            if (password_hash != null) {
              await query(
                `
                UPDATE users
                SET full_name = ?,
                    email = ?,
                    mobile = ?,
                    password_hash = ?
                WHERE id = ?
                  AND organization_id = ?
                `,
                [
                  full_name,
                  email ?? null,
                  mobile ?? null,
                  password_hash,
                  existing[0]!.id,
                  organization_id
                ]
              )
            } else {
              // Preserve existing password when no hash is supplied.
              await query(
                `
                UPDATE users
                SET full_name = ?,
                    email = ?,
                    mobile = ?
                WHERE id = ?
                  AND organization_id = ?
                `,
                [
                  full_name,
                  email ?? null,
                  mobile ?? null,
                  existing[0]!.id,
                  organization_id
                ]
              )
            }

            return Response.json({
              success: true,
              created: false,
              userId: existing[0]!.id
            })
          }

          // Create new CBS user.
          const id = crypto.randomUUID()

          await query(
            `
            INSERT INTO users (
              id,
              organization_id,
              user_code,
              full_name,
              email,
              mobile,
              password_hash,
              kyc_status,
              status
            )
            VALUES (?, ?, ?, ?, ?, ?, ?, 'UNVERIFIED', 'ACTIVE')
            `,
            [
              id,
              organization_id,
              user_code,
              full_name,
              email ?? null,
              mobile ?? null,
              password_hash ?? null
            ]
          )

          return Response.json({
            success: true,
            created: true,
            userId: id
          })

        } catch (error: any) {
          // Do not log request bodies or password hashes.
          console.error('CBS user sync error code:', error?.code ?? 'UNKNOWN')

          if (error?.code === 'ER_DUP_ENTRY') {
            return Response.json(
              {
                success: false,
                message: 'User code or unique field already exists.'
              },
              { status: 409 }
            )
          }

          return Response.json(
            {
              success: false,
              message: 'Unable to synchronize CBS user.'
            },
            { status: 500 }
          )
        }
      }
    }
  }
})
