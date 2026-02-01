# @mirrordb/types

Shared TypeScript types for the MirrorDB monorepo.

## Usage

In your app's `package.json`, add the dependency:

```json
{
  "dependencies": {
    "@mirrordb/types": "workspace:*"
  }
}
```

Then import types in your code:

```typescript
import { Database, DatabaseEngine, ConnectDbPayload } from "@mirrordb/types";
```

## Development

Build the types:
```bash
yarn workspace @mirrordb/types build
```

Type check:
```bash
yarn workspace @mirrordb/types typecheck
```
