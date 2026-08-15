# Single-operator Studio boundary

The Studio publishing workspace has exactly one operator (one configured email, one allowed identity in the Access policy), not a configurable list. Access is enforced per-endpoint with full JWT verification plus an exact email check, and the same guard covers reads and writes.

This is a deliberate product boundary, not a future-proofing gap: M3 has no collaboration, multi-author, or delegation story, and the design treats any second operator as a config change, not a feature. Adding an operator later is a one-line config + Access policy edit with no schema or guard change.
