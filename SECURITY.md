# Security Policy
Please report suspected vulnerabilities privately through GitHub private vulnerability reporting where enabled, or an independently verified maintainer contact.

Do not open public issues containing tokens, keys, private data, authentication cookies or exploit details. Never paste protected data into public CI logs.

All source changes should be code-reviewed, and production releases must pass security CI, least-privilege access review, and a tested rollback plan. Keep provider secrets in the deployment platform's protected secret manager, not in repository files.

This repository must not be used as a storage location for restricted client, clinical, secured-party or government-controlled information. Post-quantum cryptography claims require measured, end-to-end technical evidence.
