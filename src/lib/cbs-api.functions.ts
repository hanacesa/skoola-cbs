/**
 * cbs-api-auth.server.ts
 *
 * Authentication layer for the external Wallet -> CBS API.
 *
 * There are TWO authentication layers:
 *
 * 1. Wallet application authentication
 *    Authorization: Bearer <CBS_WALLET_API_KEY>
 *
 *    This proves that the request is coming from an authorized
 *    Wallet application/server.
 *
 * 2. CBS user authentication
 *    Authorization: Bearer <CBS_USER_ACCESS_TOKEN>
 *
 *    This identifies the actual CBS user after login.
 *
 * IMPORTANT:
 * - Never expose CBS_WALLET_API_KEY to browser/client-side code.
 * - The Wallet should call CBS through its own server-side API layer.
 * - User passwords must NEVER be stored in plain text.
 */ 
// For .env
// CBS_WALLET_API_KEY=CHANGE_THIS_TO_A_LONG_RANDOM_SECRET
// CBS_USER_JWT_SECRET=CHANGE_THIS_TO_ANOTHER_LONG_RANDOM_SECRET
// CBS_USER_JWT_EXPIRES_IN=12h

//  module need to install
// 1) npm install jsonwebtoken
// 2) npm install -D @types/jsonwebtoken

import crypto from "node:crypto";
import jwt from "jsonwebtoken";

/* -------------------------------------------------------------------------- */
/* Environment                                                               */
/* -------------------------------------------------------------------------- */

// Read per request: Cloudflare Workers inject env at request time.
const walletApiKey = () => process.env['CBS_WALLET_API_KEY'];

const jwtSecret = () => process.env['CBS_USER_JWT_SECRET'];

const jwtExpiresIn = () => process.env['CBS_USER_JWT_EXPIRES_IN'] ?? "12h";

/* -------------------------------------------------------------------------- */
/* Types                                                                      */
/* -------------------------------------------------------------------------- */

export type CbsApiClient = {
  type: "WALLET";
  code: string;
};

export type CbsAuthenticatedUser = {
  type: "USER";
  userId: string;
  userCode: string;
  organizationId?: string | null;
  clusterId?: string | null;
  walletNumber?: string | null;
};

export type CbsAuthContext =
  | CbsApiClient
  | CbsAuthenticatedUser;

/* -------------------------------------------------------------------------- */
/* Errors                                                                     */
/* -------------------------------------------------------------------------- */

export class CbsAuthError extends Error {
  status: number;
  code: string;

  constructor(
    message: string,
    code = "UNAUTHORIZED",
    status = 401,
  ) {
    super(message);
    this.name = "CbsAuthError";
    this.code = code;
    this.status = status;
  }
}

export function unauthorized(
  message = "Authentication required.",
): never {
  throw new CbsAuthError(message, "UNAUTHORIZED", 401);
}

export function forbidden(
  message = "You are not authorized to perform this operation.",
): never {
  throw new CbsAuthError(message, "FORBIDDEN", 403);
}

/* -------------------------------------------------------------------------- */
/* Constant-time secret comparison                                           */
/* -------------------------------------------------------------------------- */

function safeCompare(
  provided: string,
  expected: string,
): boolean {
  const providedBuffer = Buffer.from(provided);
  const expectedBuffer = Buffer.from(expected);

  if (providedBuffer.length !== expectedBuffer.length) {
    return false;
  }

  return crypto.timingSafeEqual(
    providedBuffer,
    expectedBuffer,
  );
}

/* -------------------------------------------------------------------------- */
/* HTTP response helpers                                                      */
/* -------------------------------------------------------------------------- */

export function authErrorResponse(
  error: unknown,
): Response {
  if (error instanceof CbsAuthError) {
    return new Response(
      JSON.stringify({
        success: false,
        error: error.code,
        message: error.message,
      }),
      {
        status: error.status,
        headers: {
          "Content-Type": "application/json",
        },
      },
    );
  }

  return new Response(
    JSON.stringify({
      success: false,
      error: "UNAUTHORIZED",
      message: "Authentication failed.",
    }),
    {
      status: 401,
      headers: {
        "Content-Type": "application/json",
      },
    },
  );
}

/* -------------------------------------------------------------------------- */
/* Extract Bearer token                                                       */
/* -------------------------------------------------------------------------- */

function getBearerToken(request: Request): string {
  const authorization =
    request.headers.get("authorization");

  if (!authorization) {
    unauthorized("Authorization header is required.");
  }

  const parts = authorization.trim().split(/\s+/);

  if (parts.length !== 2) {
    unauthorized("Invalid Authorization header.");
  }

  if ((parts[0] ?? "").toLowerCase() !== "bearer") {
    unauthorized("Authorization scheme must be Bearer.");
  }

  return parts[1] ?? "";
}

/* -------------------------------------------------------------------------- */
/* Wallet application authentication                                          */
/* -------------------------------------------------------------------------- */

/**
 * Authenticates the Wallet application itself.
 *
 * Expected:
 *
 * Authorization: Bearer <CBS_WALLET_API_KEY>
 *
 * This should only be called from your Wallet SERVER.
 */
export function requireWalletApiClient(
  request: Request,
): CbsApiClient {
  if (!walletApiKey()) {
    throw new Error(
      "CBS_WALLET_API_KEY is not configured.",
    );
  }

  const token = getBearerToken(request);

  if (!safeCompare(token, walletApiKey() ?? "")) {
    unauthorized("Invalid Wallet API credentials.");
  }

  return {
    type: "WALLET",
    code: "WALLET",
  };
}

/* -------------------------------------------------------------------------- */
/* JWT user token                                                             */
/* -------------------------------------------------------------------------- */

export type CbsUserJwtPayload = {
  sub: string;
  type: "USER";
  userId: string;
  userCode: string;
  organizationId?: string | null;
  clusterId?: string | null;
  walletNumber?: string | null;
};

/**
 * Creates the access token returned after CBS user login.
 */
export function createUserAccessToken(
  user: {
    userId: string;
    userCode: string;
    organizationId?: string | null;
    clusterId?: string | null;
    walletNumber?: string | null;
  },
): string {
  if (!jwtSecret()) {
    throw new Error(
      "CBS_USER_JWT_SECRET is not configured.",
    );
  }

  const payload: CbsUserJwtPayload = {
    sub: user.userId,
    type: "USER",
    userId: user.userId,
    userCode: user.userCode,
    organizationId: user.organizationId ?? null,
    clusterId: user.clusterId ?? null,
    walletNumber: user.walletNumber ?? null,
  };

  return jwt.sign(
    payload,
    jwtSecret() as jwt.Secret,
    {
      expiresIn: jwtExpiresIn() as NonNullable<jwt.SignOptions["expiresIn"]>,
      issuer: "cbs",
      audience: "wallet",
    },
  );
}

/**
 * Verifies a CBS user access token.
 */
export function verifyUserAccessToken(
  token: string,
): CbsAuthenticatedUser {
  if (!jwtSecret()) {
    throw new Error(
      "CBS_USER_JWT_SECRET is not configured.",
    );
  }

  try {
    const decoded = jwt.verify(
      token,
      jwtSecret() as jwt.Secret,
      {
        issuer: "cbs",
        audience: "wallet",
      },
    ) as CbsUserJwtPayload;

    if (
      decoded.type !== "USER" ||
      !decoded.userId ||
      !decoded.userCode
    ) {
      unauthorized("Invalid CBS user token.");
    }

    return {
      type: "USER",
      userId: decoded.userId,
      userCode: decoded.userCode,
      organizationId:
        decoded.organizationId ?? null,
      clusterId:
        decoded.clusterId ?? null,
      walletNumber:
        decoded.walletNumber ?? null,
    };
  } catch {
    unauthorized(
      "CBS user session has expired or is invalid.",
    );
  }
}

/* -------------------------------------------------------------------------- */
/* Require CBS user                                                           */
/* -------------------------------------------------------------------------- */

/**
 * Used by user-level endpoints such as:
 *
 * GET  /balance
 * POST /transfer
 * POST /wallet-reload
 * GET  /wallet-topups
 *
 * Expected:
 *
 * Authorization: Bearer <CBS_USER_ACCESS_TOKEN>
 */
export function requireCbsUser(
  request: Request,
): CbsAuthenticatedUser {
  const token = getBearerToken(request);

  return verifyUserAccessToken(token);
}

/* -------------------------------------------------------------------------- */
/* Combined API authentication                                                */
/* -------------------------------------------------------------------------- */

/**
 * Some endpoints need the Wallet application to authenticate.
 *
 * Others need the actual CBS user.
 *
 * This helper accepts either:
 *
 * - Wallet API key
 * - CBS user access token
 *
 * It first attempts to identify the Wallet application.
 */
export function requireCbsApiClient(
  request: Request,
): CbsAuthContext {
  const token = getBearerToken(request);

  if (
    walletApiKey() &&
    safeCompare(token, walletApiKey() ?? "")
  ) {
    return {
      type: "WALLET",
      code: "WALLET",
    };
  }

  return verifyUserAccessToken(token);
}

/* -------------------------------------------------------------------------- */
/* User ownership helpers                                                     */
/* -------------------------------------------------------------------------- */

/**
 * Ensures that the authenticated user can only access their own wallet.
 *
 * This prevents:
 *
 * User A
 *   ↓
 * /wallets/WAL-U1002/balance
 *   ↓
 * reading User B's wallet.
 */
export function requireWalletOwnership(
  user: CbsAuthenticatedUser,
  walletNumber: string,
) {
  if (!user.walletNumber) {
    forbidden(
      "The authenticated user does not have a wallet.",
    );
  }

  if (user.walletNumber !== walletNumber) {
    forbidden(
      "You are not authorized to access this wallet.",
    );
  }
}

/**
 * Ensures that a user can only transfer FROM their own wallet.
 */
export function requireTransferOwnership(
  user: CbsAuthenticatedUser,
  fromWalletNumber: string,
) {
  requireWalletOwnership(
    user,
    fromWalletNumber,
  );
}