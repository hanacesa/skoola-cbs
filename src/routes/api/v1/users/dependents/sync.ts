import { createFileRoute } from '@tanstack/react-router'
import { query } from '../../../../../lib/mysql.server'
import crypto from 'node:crypto'

export const Route = createFileRoute('/api/v1/users/dependents/sync')({
  server: {
    handlers: {
      POST: async ({ request }) => {
        try {
          const configuredKey = process.env["CBS_SKOOLA_SYNC_API_KEY"]

          const authorization = request.headers.get('authorization') || ''
          const providedKey = authorization.startsWith('Bearer ')
            ? authorization.slice(7)
            : ''

          if (!configuredKey || !providedKey) {
            return Response.json(
              { success: false, message: 'Unauthorized' },
              { status: 401 },
            )
          }

          const expected = Buffer.from(configuredKey)
          const received = Buffer.from(providedKey)

          if (
            expected.length !== received.length ||
            !crypto.timingSafeEqual(expected, received)
          ) {
            return Response.json(
              { success: false, message: 'Unauthorized' },
              { status: 401 },
            )
          }

          const body = await request.json()

          const {
            guardian_id,
            child_id,
            relationship,
            date_of_birth,
          } = body

          if (
            typeof guardian_id !== 'string' ||
            typeof child_id !== 'string' ||
            typeof relationship !== 'string' ||
            !guardian_id ||
            !child_id ||
            !relationship
          ) {
            return Response.json(
              { success: false, message: 'Missing required fields' },
              { status: 422 },
            )
          }

          if (guardian_id === child_id) {
            return Response.json(
              { success: false, message: 'Guardian and child must differ' },
              { status: 422 },
            )
          }

          const users = await query<{ id: string }>(
            `SELECT id FROM users
             WHERE id IN (?, ?) AND organization_id = ?`,
            [
              guardian_id,
              child_id,
              process.env["CBS_SKOOLA_ORGANIZATION_ID"],
            ],
          )

          if (users.length !== 2) {
            return Response.json(
              { success: false, message: 'Guardian or child not found in CBS organization' },
              { status: 404 },
            )
          }

          await query(
            `INSERT INTO user_dependents
              (id, guardian_id, child_id, relationship, date_of_birth)
             VALUES (UUID(), ?, ?, ?, ?)
             ON DUPLICATE KEY UPDATE
               relationship = VALUES(relationship),
               date_of_birth = VALUES(date_of_birth)`,
            [
              guardian_id,
              child_id,
              relationship,
              date_of_birth || null,
            ],
          )

          return Response.json({
            success: true,
            message: 'Dependent relationship synchronized',
          })
        } catch (error) {
          console.error('CBS dependent sync error:', error)

          return Response.json(
            { success: false, message: 'Dependent synchronization failed' },
            { status: 500 },
          )
        }
      },
    },
  },
})