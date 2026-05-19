# Firebase Security Specification

## Data Invariants
1. A User document can only be created/modified by the authenticated user whose UID matches the document ID.
2. A Story can only be created/modified/read by its owner (userId).
3. A Step can only be created in a story that the user owns.
4. Timestamps (createdAt, updatedAt) must be set by the server.

## The "Dirty Dozen" Payloads

1. **Identity Spoofing**: Attempt to create a user profile for another UID.
2. **Path Poisoning**: Attempt to create a story with a 1MB string as ID.
3. **Ghost Field Update**: Attempt to add `isAdmin: true` to a story document.
4. **Orphaned Step**: Attempt to add a step to a story belonging to another user.
5. **Timeline Warp**: Attempt to set `createdAt` to a past date.
6. **Owner Swap**: Attempt to update a story to change its `userId`.
7. **Unverified Read**: Attempt to read another user's story.
8. **Malicious Enum**: Attempt to set genre to "malicious-genre".
9. **Size Exhaustion**: Attempt to write a scene description > 1MB.
10. **Terminal State Bypass**: Attempt to update an "active" story to "completed" and then back to "active". (Wait, status is active/completed).
11. **Shadow Deletion**: Attempt to delete another user's story.
12. **Unauthenticated List**: Attempt to list all users.

## Test Runner (firestore.rules.test.ts)
*(Note: This is a conceptual test runner for AI verification)*
```typescript
import { assertFails, assertSucceeds, initializeTestEnvironment } from '@firebase/rules-unit-testing';

// ... tests for the 12 payloads ...
```
