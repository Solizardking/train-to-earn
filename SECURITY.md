# Security Policy

## Supported Versions

| Version | Supported |
|---------|-----------|
| main    | ✅ Yes    |

## Reporting a Vulnerability

**Do not open a public GitHub issue for security vulnerabilities.**

Please report security issues by emailing **security@x402.wtf**. Include:

- A description of the vulnerability
- Steps to reproduce
- Potential impact
- Suggested fix (optional)

You will receive a response within 48 hours. We will work with you to understand
and resolve the issue before any public disclosure.

## Scope

In scope:
- Server-side code (`server/`)
- Smart contracts (`programs/`)
- Authentication and wallet handling
- API key exposure or injection

Out of scope:
- Third-party dependencies (report to their maintainers)
- Issues requiring physical access to the host
- Social engineering attacks

## Best Practices for Contributors

- Never commit `.env` files or secrets
- Use `.env.example` with placeholder values only
- Keep API keys in environment variables — not in source code
- CLAWD mint address (`8cHzQHUS2s2h8TzCmfqPKYiM4dSt4roa3n7MyRLApump`) is a public
  blockchain address and is safe to commit
