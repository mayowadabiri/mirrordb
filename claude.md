# MirrorDB Project Documentation

> **Purpose**: This document serves as the authoritative guide for understanding and contributing to the MirrorDB codebase. It captures the current architecture, patterns, conventions, and future roadmap.

## Project Overview

**MirrorDB** is a platform that allows users to safely create temporary, isolated mirrors of production databases for debugging and testing purposes.

### Tech Stack

- **Monorepo**: Yarn workspaces
- **API**: Fastify + Prisma + PostgreSQL
- **CLI**: Commander.js + Node.js
- **Web**: React + Vite + TailwindCSS + TanStack Router
- **Shared**: TypeScript types package
- **Linting**: ESLint 9.x with TypeScript support
- **Git Hooks**: Husky + lint-staged

---

## Architecture

### Monorepo Structure

```
mirrordb/
├── apps/
│   ├── api/          # Backend API (Fastify)
│   ├── cli/          # Command-line interface
│   └── web/          # Web dashboard (React)
└── packages/
    └── types/        # Shared TypeScript types
```

### Apps

#### 1. API (`apps/api`)

**Framework**: Fastify with TypeScript

**Structure**:
```
src/
├── lib/              # Core libraries
├── middleware/       # Request middleware (auth, etc.)
├── plugins/          # Fastify plugins (prisma, swagger, rate-limit)
├── routes/           # Route handlers
│   ├── auth/         # Authentication endpoints
│   ├── db/           # Database management endpoints
│   ├── mfa/          # MFA endpoints (cli + browser)
│   ├── health.ts     # Health check
│   └── session.ts    # Session management
├── schemas/          # Request/response schemas
├── services/         # Business logic layer
│   ├── auth/         # Auth services
│   ├── db/           # Database services
│   └── mfa/          # MFA services
├── types/            # Local type definitions
├── utils/            # Utility functions
│   ├── appError.ts   # Custom error classes
│   ├── dbConnector.ts # Database connection validators
│   ├── errors.ts     # Error utilities
│   └── security.ts   # Encryption/security utils
├── app.ts            # Fastify app setup
└── server.ts         # Entry point
```

**Key Plugins**:
- `helmet`: Security headers
- `cors`: Cross-origin resource sharing
- `rate-limit`: API rate limiting
- `prisma`: Database ORM integration
- `swagger`: API documentation
- `cookie`: Cookie parsing
- `multipart`: File upload support

**Database**: Prisma ORM with PostgreSQL

**Error Handling**: Custom `AppError` class that converts to standardized `ApiErrorResponse`

#### 2. CLI (`apps/cli`)

**Framework**: Commander.js

**Structure**:
```
src/
├── api/              # API client functions
├── commands/         # CLI commands
│   ├── auth/         # Auth commands (login, logout)
│   ├── db/           # Database commands (add, list, connect)
│   ├── mfa/          # MFA commands (start, challenge)
│   └── version.ts    # Version command
├── hooks/            # Command hooks (authGuard, mfaGuard)
├── utils/            # Utility functions
│   ├── config.ts     # Config file management
│   ├── errors.ts     # Error handling
│   ├── helpers.ts    # DB engine helpers
│   ├── path.ts       # Path constants
│   └── axios.ts      # HTTP client
├── index.ts          # Entry point
└── program.ts        # Commander program setup
```

**Config File**: `~/.mirrordb/config.json` stores user session, MFA status, and active database

**Commands**:
- `mirror auth login`: OAuth device flow login
- `mirror auth logout`: Logout and clear session
- `mirror mfa start`: Start MFA enrollment
- `mirror mfa challenge`: Complete MFA challenge
- `mirror db add`: Register a new database
- `mirror db list`: List all databases
- `mirror db connect <name|id>`: Connect to a database
- `mirror version`: Show version

#### 3. Web (`apps/web`)

**Framework**: React + Vite + TanStack Router

**Purpose**: Web dashboard for MFA enrollment browser flow and future features

---

## Database Schema

### Core Models

#### User
- Core identity: email, username, avatarUrl
- Status: isActive
- MFA: mfaEnabled, mfaSecretEncrypted, mfaConfirmedAt
- Relations: devices, accounts, refreshTokens, databases

#### AuthAccount
- OAuth provider accounts (GitHub, Google)
- One-to-many with User

#### DeviceAuth
- Device authorization flow (OAuth2)
- deviceCode, userCode
- Status: PENDING | APPROVED | REJECTED
- MFA verification per session

#### RefreshToken
- JWT refresh token storage
- tokenHash (bcrypt)
- expiresAt, revokedAt

#### MfaSetupSession
- Temporary session for MFA enrollment
- expiresAt, usedAt

#### MfaChallengeSession
- MFA challenge verification
- Status: PENDING | VERIFIED | EXPIRED
- Links to DeviceAuth

#### Database
- User-owned database registrations
- engine: POSTGRES | MYSQL | MONGODB | SQLITE
- environment: PRODUCTION | STAGING | DEVELOPMENT
- status: REGISTERED | CONNECTED | VERIFIED | CLONED | DISABLED
- Metadata: name, description, tags
- Relations: credentials, clones

#### DatabaseCredential
- Encrypted credential storage
- type: PASSWORD | SSL_CERT | IAM_ROLE
- encryptedPayload (AES encryption)
- isActive, rotatedAt (for rotation)

#### DatabaseClone
- Clone job tracking (future feature)
- status: PENDING | RUNNING | FAILED | COMPLETED

---

## Current Features

### 1. Authentication

**Flow**: OAuth2 Device Authorization Flow

**Providers**: GitHub, Google

**Process**:
1. User runs `mirror auth login`
2. CLI requests device code from API
3. User visits URL and enters code in browser
4. User authorizes via OAuth provider
5. CLI polls for approval
6. API issues JWT access + refresh tokens
7. Tokens stored in `~/.mirrordb/config.json`

**Guards**:
- `authGuard`: Ensures user is authenticated (CLI hook)
- `authMiddleware`: Validates JWT tokens (API middleware)

### 2. Multi-Factor Authentication (MFA)

**Type**: TOTP (Time-based One-Time Password)

**Library**: Speakeasy

**Enrollment Flow** (CLI):
1. User runs `mirror mfa start`
2. API creates MfaSetupSession
3. CLI displays QR code in terminal
4. User scans with authenticator app
5. User enters verification code
6. API confirms and enables MFA

**Challenge Flow** (per device session):
1. During login, if MFA enabled
2. CLI prompts for MFA code
3. API verifies code against encrypted secret
4. Sets mfaVerifiedAt on DeviceAuth
5. Issues tokens

**Browser Flow**: Web app provides alternative MFA enrollment UI

### 3. Database Management

**Supported Engines**: PostgreSQL, MySQL, MongoDB, SQLite (SQLite not yet implemented)

**Operations**:

#### Add Database (`mirror db add`)
- Registers database metadata
- Status: REGISTERED
- Requires: name, engine, environment
- Optional: description

#### List Databases (`mirror db list`)
- Shows all user's databases
- Displays: name, ID, engine, environment, status

#### Connect Database (`mirror db connect <name|id>`)
- Validates database credentials
- Stores encrypted credentials
- Updates status to CONNECTED
- Saves database ID to config

**Connection Methods**:
1. **URI Method**: Single connection string
   - PostgreSQL: `postgresql://` or `postgres://`
   - MySQL: `mysql://`
   - MongoDB: `mongodb://` or `mongodb+srv://`

2. **Host/Port Method**: Individual fields
   - host, port, username, password, database
   - Default ports: PostgreSQL (5432), MySQL (3306), MongoDB (27017)

**Validation** (`apps/api/src/utils/dbConnector.ts`):
- `validatePgConnection()`: PostgreSQL connection test
- `validateMySqlConnection()`: MySQL connection test
- `validateMongoConnection()`: MongoDB connection test
- All validators: 5-second timeout, execute test query, convert errors to `BadRequestError`

**Credential Storage**:
- Encrypted using AES (see `apps/api/src/utils/security.ts`)
- Stored in `DatabaseCredential` table
- Supports rotation (isActive flag)

---

## Patterns & Conventions

### API Patterns

#### 1. Service Layer Pattern
- Routes handle HTTP concerns
- Services contain business logic
- Prisma handles data access

Example:
```typescript
// Route
app.post("/db", async (req, reply) => {
  const result = await addDatabase(prisma, req.user, req.body);
  return { success: true, data: result };
});

// Service
export const addDatabase = async (prisma, user, body) => {
  // Business logic here
  return prisma.database.create(...);
};
```

#### 2. Error Handling
- Use `AppError` classes: `BadRequestError`, `UnauthorizedError`, etc.
- All errors converted to `ApiErrorResponse` format:
  ```typescript
  {
    success: false,
    statusCode: "ERROR_CODE",
    message: "User message",
    details?: any
  }
  ```

#### 3. Authentication
- JWT access tokens (short-lived)
- JWT refresh tokens (long-lived, stored in DB)
- `authMiddleware` validates tokens and attaches `req.user`

#### 4. Type Safety
- Fastify schemas for request/response validation
- Shared types from `@mirrordb/types`
- Prisma-generated types

### CLI Patterns

#### 1. Command Structure
```typescript
export function createDbCommand() {
  const command = new Command("db")
    .description("Database management")
    .addCommand(addCommand())
    .addCommand(listCommand())
    .addCommand(connectCommand());
  return command;
}
```

#### 2. Hooks
- `authGuard`: Check authentication before command
- `mfaGuard`: Verify MFA if enabled

#### 3. Config Management
- `readConfig()`: Read from `~/.mirrordb/config.json`
- `writeConfig()`: Write to config file
- Config structure defined in `MirrorConfig` type

#### 4. User Prompts
- Use `prompts` library for interactive input
- Validate input inline
- Handle cancellation (Ctrl+C)

#### 5. Display Formatting
- Use `chalk` for colors
- Use `cli-table3` for tables
- Error messages in red
- Success messages in green

### Shared Types

#### 1. API Responses
```typescript
ApiSuccessResponse<T> = { success: true; data: T }
ApiErrorResponse = { success: false; statusCode: string; message: string; details?: unknown }
```

#### 2. Database Types
- `Database`, `DatabaseEngine`, `DatabaseEnvironment`, `DatabaseStatus`
- `DbCredentialsPayload` (discriminated union)
- `HostDbCredentials`, `UriDbCredentials`

#### 3. Auth Types
- `AuthProvider`, `DeviceAuthResponse`, `RequestUser`, `MirrorConfig`

### Database Helpers (CLI)

**Location**: `apps/cli/src/utils/helpers.ts`

**Functions**:
- `getDbEngineName(engine)`: Human-readable name (e.g., "PostgreSQL")
- `getDbEngineUriPrefix(engine)`: Primary URI scheme (e.g., "postgresql://")
- `getDbEngineValidUriPrefixes(engine)`: All valid URI schemes (array)
- `getDbEngineDefaultPort(engine)`: Default port number

**When adding new DB engine**: Update all four functions

---

## Future Features

### 1. Database Cloning (Core Feature)
**Status**: Schema ready, not implemented

**Purpose**: Create isolated database copies for testing/debugging

**Flow**:
1. User runs `mirror db clone <source-db>`
2. API creates `DatabaseClone` record (status: PENDING)
3. Background worker:
   - Provisions target database
   - Dumps source data
   - Restores to target
   - Updates status to COMPLETED
4. User receives credentials to cloned database

**Schema**:
- `DatabaseClone` table tracks clone jobs
- `targetEngine`, `targetRegion` for flexibility

### 2. Database Verification
**Status**: Schema ready, not implemented

**Purpose**: Verify database connectivity and schema

**Flow**:
1. User runs `mirror db verify <name|id>`
2. API connects to database
3. Runs health checks (connectivity, permissions)
4. Optionally validates schema
5. Updates status to VERIFIED
6. Sets `verifiedAt` timestamp

### 3. Cross-Engine Cloning
**Status**: Planned

**Purpose**: Clone PostgreSQL → MySQL, etc.

**Challenges**:
- Schema translation
- Data type mapping
- Index conversion

### 4. Scheduled Clones
**Status**: Planned

**Purpose**: Automatically refresh clones on schedule

### 5. Clone Expiration
**Status**: Planned

**Purpose**: Auto-delete clones after TTL

### 6. Team/Organization Support
**Status**: Planned

**Changes Required**:
- New `Organization` model
- Database ownership: User OR Organization
- Role-based access control
- Shared credentials

### 7. Database Tags & Filtering
**Status**: Schema ready (tags array), not implemented

**Purpose**: Organize databases with labels

### 8. Credential Rotation
**Status**: Schema ready (rotatedAt), not implemented

**Purpose**: Rotate database credentials

**Flow**:
1. User updates credentials
2. New `DatabaseCredential` created (isActive: true)
3. Old credential marked (isActive: false, rotatedAt: now)
4. History preserved for audit

### 9. SSL/Certificate Support
**Status**: Schema ready (CredentialType.SSL_CERT), not implemented

**Purpose**: Support SSL connections

### 10. IAM Role Support
**Status**: Schema ready (CredentialType.IAM_ROLE), not implemented

**Purpose**: Support cloud IAM authentication

---

## Development Guidelines

### Adding a New Database Engine

1. **Update TypeScript Types** (`packages/types/src/index.ts`):
   ```typescript
   export enum DatabaseEngine {
     // ...
     NEW_ENGINE = "NEW_ENGINE",
   }
   ```

2. **Update Prisma Schema** (`apps/api/prisma/schema.prisma`):
   ```prisma
   enum DatabaseEngine {
     // ...
     NEW_ENGINE
   }
   ```

3. **Run Prisma Migration**:
   ```bash
   cd apps/api
   npx prisma migrate dev --name add_new_engine
   ```

4. **Add Validation Function** (`apps/api/src/utils/dbConnector.ts`):
   ```typescript
   export const validateNewEngineConnection = async (config) => {
     // Implement connection test
   };
   ```

5. **Update Connection Service** (`apps/api/src/services/db/index.ts`):
   - Add URI method case
   - Add host-based method case

6. **Update CLI Helpers** (`apps/cli/src/utils/helpers.ts`):
   - `getDbEngineName()`
   - `getDbEngineUriPrefix()`
   - `getDbEngineValidUriPrefixes()`
   - `getDbEngineDefaultPort()`

7. **Install Client Package** (if needed):
   ```bash
   cd apps/api
   yarn add <db-client-package>
   ```

8. **Test**:
   - URI connection method
   - Host/port connection method
   - Error handling

### Adding a New CLI Command

1. **Create Command File** (`apps/cli/src/commands/<group>/<command>.ts`):
   ```typescript
   export function createMyCommand() {
     return new Command("mycommand")
       .description("My command")
       .action(async () => {
         // Implementation
       });
   }
   ```

2. **Register Command** (`apps/cli/src/commands/<group>/index.ts`):
   ```typescript
   command.addCommand(createMyCommand());
   ```

3. **Add API Client** (`apps/cli/src/api/<group>.ts`) if needed

4. **Add Guards** if needed (authGuard, mfaGuard)

### Adding a New API Endpoint

1. **Create Service** (`apps/api/src/services/<domain>/<file>.ts`):
   ```typescript
   export const myService = async (prisma, user, data) => {
     // Business logic
   };
   ```

2. **Create Route** (`apps/api/src/routes/<domain>/<file>.ts`):
   ```typescript
   app.post("/path", async (req, reply) => {
     const result = await myService(prisma, req.user, req.body);
     return { success: true, data: result };
   });
   ```

3. **Add Schema** (`apps/api/src/schemas/<domain>/<file>.ts`) if needed

4. **Register Route** (`apps/api/src/app.ts`)

5. **Add Types** (`packages/types/src/index.ts`) if needed

### Testing Strategy

**Current State**: No automated tests

**Manual Testing**:
- API: Use Swagger UI at `/docs` endpoint
- CLI: Test all commands manually
- Database connections: Test with real databases

**Future**: Add Jest tests for services and routes

---

## Security

### Credentials
- Database credentials encrypted with AES
- MFA secrets encrypted before storage
- JWT tokens signed with secret key

### Authentication
- OAuth2 device flow (no client secrets in CLI)
- Short-lived access tokens
- Refresh token rotation

### API Security
- Helmet for security headers
- CORS configured
- Rate limiting enabled
- Input validation via Fastify schemas

### Environment Variables
- API URL: `VITE_API_URL` (web), `API_URL` (cli)
- CORS origin: `CORS_ORIGIN`
- Database URL: Prisma expects `DATABASE_URL`
- JWT secrets: Required for token signing
- Encryption key: Required for credential encryption

---

## Common Tasks

### Run Development Servers
```bash
# All (API + Web)
yarn dev

# Individual
yarn dev:api
yarn dev:web

# CLI
cd apps/cli
yarn dev <command>
```

### Build
```bash
# All workspaces
yarn build

# Individual
yarn workspace api build
yarn workspace cli build
yarn workspace web build
yarn workspace types build
```

### Database Migrations
```bash
cd apps/api
npx prisma migrate dev
npx prisma generate
```

### View Database
```bash
cd apps/api
npx prisma studio
```

### Linting

**Setup**: ESLint 9.x with TypeScript support, Husky, and lint-staged

**Configuration**: `eslint.config.js` (flat config format)

**Commands**:
```bash
# Lint all files in monorepo
yarn lint

# Auto-fix linting issues
yarn lint:fix

# Type checking (separate from linting)
yarn typecheck
```

**Pre-commit Hooks**:
- Husky runs automatically on `git commit`
- Lint-staged lints only staged files (faster than full lint)
- Commit blocked if linting errors exist
- Auto-fixes are applied when possible

**Hook Location**: `.husky/pre-commit`

**How It Works**:
1. Stage files: `git add <files>`
2. Attempt commit: `git commit -m "message"`
3. Husky triggers lint-staged
4. ESLint runs on staged TypeScript/JavaScript files
5. If errors: commit blocked, fix issues and retry
6. If clean: commit succeeds

**Bypass Hook** (not recommended):
```bash
git commit --no-verify -m "message"
```

---

## Troubleshooting

### TypeScript Errors After Type Changes
1. Rebuild types package: `cd packages/types && yarn build`
2. Restart TypeScript server in IDE

### Prisma Client Out of Sync
```bash
cd apps/api
npx prisma generate
```

### Database Connection Issues
- Check `DATABASE_URL` in API `.env`
- Verify PostgreSQL is running
- Check network/firewall settings

### CLI Authentication Issues
- Delete `~/.mirrordb/config.json`
- Run `mirror auth login` again

---

## Project Philosophy

1. **Type Safety**: Use TypeScript everywhere, share types across apps
2. **Separation of Concerns**: Routes → Services → Data
3. **Security First**: Encrypt sensitive data, validate inputs
4. **Developer Experience**: Clear errors, helpful CLI output
5. **Extensibility**: Design for future features (cloning, teams, etc.)
6. **Monorepo Benefits**: Shared types, coordinated changes
