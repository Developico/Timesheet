# Security Policy

## Supported Versions

| Version | Supported          |
| ------- | ------------------ |
| 0.1.x   | :white_check_mark: |

## Reporting a Vulnerability

**Please do NOT report security vulnerabilities through public GitHub issues.**

Instead, please report them via email to: **contact@developico.com**

When reporting a vulnerability, please include:

- **Description** of the vulnerability
- **Steps to reproduce** the issue
- **Potential impact** assessment
- **Suggested fix** (if you have one)
- **Your contact information** for follow-up

### What to Expect

1. **Acknowledgment**: We will acknowledge receipt of your report within **48 hours**
2. **Assessment**: We will investigate and assess the vulnerability within **7 days**
3. **Resolution**: We will work with you to resolve the issue and coordinate disclosure
4. **Credit**: We will credit you in our security advisories (unless you prefer anonymity)

## Security Best Practices for Deployment

When deploying this solution, please follow these security guidelines:

### Secrets Management

- ✅ **Never commit secrets to git** — Use `.env.example` as a template
- ✅ **Use Azure Key Vault** for all production credentials
- ✅ **Rotate secrets regularly** — Especially Azure AD client secrets and NEXTAUTH_SECRET
- ✅ **Use Managed Identities** where possible for Azure resources

### Azure Configuration

- ✅ **Enable RBAC** on all Azure resources
- ✅ **Configure proper CORS** — Never use `*` in production
- ✅ **Use Private Endpoints** for Key Vault in production
- ✅ **Enable Azure Defender** for cloud resources
- ✅ **Enable audit logging** in Azure resources

### Authentication

- ✅ **Configure security groups** properly in Entra ID (Admin / Consultant)
- ✅ **Use least privilege principle** for Graph API scopes
- ✅ **Enable MFA** for all administrator accounts
- ✅ **Restrict tokens** — Access tokens are stored in volatile memory (never persisted to disk)

### Application Security

- ✅ **Keep dependencies updated** — Dependabot is configured for automatic updates
- ✅ **Review code changes** before merging
- ✅ **Run security scans** as part of CI/CD
- ✅ **Monitor for suspicious activity** using Application Insights

## Known Security Considerations

### Token Storage

- Access tokens are stored in volatile in-memory store with encryption
- Refresh tokens are stored in volatile in-memory store with TTL
- Session JWTs are httpOnly cookies — not accessible from JavaScript
- PII is redacted from all structured logs (`lib/app-logger.ts`)

### Data in Dataverse

When Dataverse integration is enabled:

- Data is stored in Microsoft Dataverse with row-level security
- All Dataverse communication uses OAuth 2.0 client credentials
- OData queries are sanitized to prevent injection

### Middleware Security

The application enforces:

- **HSTS** (2-year max-age, includeSubDomains, preload)
- **CSP** (strict defaults; inline scripts/styles for Next.js/Tailwind)
- **X-Frame-Options: DENY** (clickjacking protection)
- **Rate limiting** on all `/api/*` routes (IP-based, 429 with Retry-After)

## Security Updates

Security updates will be released as soon as possible after a vulnerability is confirmed. We recommend:

1. **Watch this repository** for security advisories
2. **Subscribe to release notifications**
3. **Keep your deployment updated**

## Contact

- Security issues: contact@developico.com
- General questions: [GitHub Discussions](https://github.com/Developico/developico-timesheet/discussions)

Maintained by **[Developico Sp. z o.o.](https://developico.com)** | Łukasz Falaciński
