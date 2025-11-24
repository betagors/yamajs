# Security Policy

## Supported Versions

We actively support security updates for the following versions:

| Version | Supported          |
| ------- | ------------------ |
| Latest  | :white_check_mark: |
| < Latest| :x:                |

## Reporting a Vulnerability

We take security vulnerabilities seriously. If you discover a security vulnerability in Yama, please follow these steps:

### 1. **Do NOT** open a public issue

Security vulnerabilities should be reported privately to protect users until a fix is available.

### 2. Report the vulnerability

Please email security concerns to: **[INSERT SECURITY EMAIL]**

Include the following information in your report:

- **Description**: A clear description of the vulnerability
- **Impact**: The potential impact of the vulnerability
- **Steps to reproduce**: Detailed steps to reproduce the issue
- **Affected versions**: Which versions of Yama are affected
- **Suggested fix**: If you have ideas for how to fix it (optional but appreciated)

### 3. What to expect

- **Acknowledgment**: You should receive an acknowledgment within 48 hours
- **Initial assessment**: We'll assess the vulnerability within 7 days
- **Updates**: We'll keep you informed of our progress
- **Resolution**: We'll work to resolve the issue as quickly as possible

### 4. Disclosure

We follow responsible disclosure practices:

- We'll work with you to understand and resolve the issue
- We'll create a fix and test it thoroughly
- We'll release the fix in a timely manner
- We'll credit you in the security advisory (unless you prefer to remain anonymous)

### 5. Public disclosure

Please allow us time to fix the vulnerability before making it public. We typically aim to:

- Acknowledge the report within 48 hours
- Provide an initial assessment within 7 days
- Release a fix within 30 days (depending on severity)

If you believe we're not responding appropriately, please reach out again or contact us through another channel.

## Security Best Practices

When using Yama:

- **Keep dependencies updated**: Regularly update Yama and its dependencies
- **Use environment variables**: Store sensitive data (API keys, secrets) in environment variables, not in code
- **Review your configuration**: Regularly review your `yama.yaml` and handler code
- **Follow authentication best practices**: Use strong secrets for JWT and other auth mechanisms
- **Monitor your application**: Set up logging and monitoring for production applications

## Security Considerations

### Configuration Files

- Never commit sensitive data (API keys, passwords, secrets) to version control
- Use environment variables for sensitive configuration
- Review your `.env` files and ensure they're in `.gitignore`

### Database Connections

- Use secure connection strings
- Implement proper access controls
- Use connection pooling appropriately
- Regularly update database drivers and adapters

### Authentication & Authorization

- Use strong, randomly generated secrets for JWT
- Implement proper authorization checks in handlers
- Follow OWASP guidelines for authentication
- Regularly rotate secrets in production

## Questions?

If you have questions about security in Yama, please:

1. Check the [documentation](https://yama.dev) (if available)
2. Open a general discussion (not a security issue)
3. Contact the maintainers

Thank you for helping keep Yama secure! 🔒

