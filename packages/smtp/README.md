# @betagors/yama-smtp

SMTP email plugin for Yama with Mailpit support for local development.

## Installation

```bash
npm install @betagors/yama-smtp nodemailer
# or
pnpm add @betagors/yama-smtp nodemailer
```

## Configuration

### Local Development with Mailpit

```yaml
plugins:
  "@betagors/yama-smtp":
    host: localhost
    port: 1025  # Mailpit default SMTP port
    from: noreply@example.com
```

Mailpit is automatically detected when using `localhost:1025`. No authentication needed!

### Production SMTP

```yaml
plugins:
  "@betagors/yama-smtp":
    host: smtp.example.com
    port: 587
    secure: false
    auth:
      user: ${SMTP_USER}
      pass: ${SMTP_PASSWORD}
    from: noreply@example.com
```

## Usage

Access email service in your handlers:

```typescript
import { HandlerContext } from '@betagors/yama-core';

export async function sendWelcomeEmail(context: HandlerContext) {
  await context.email?.send({
    to: 'user@example.com',
    subject: 'Welcome!',
    html: '<h1>Welcome to our service</h1>',
    text: 'Welcome to our service'
  });
}
```

### Send with Attachments

```typescript
await context.email?.send({
  to: 'user@example.com',
  subject: 'Invoice',
  html: '<p>Please find your invoice attached.</p>',
  attachments: [
    {
      filename: 'invoice.pdf',
      path: '/path/to/invoice.pdf'
    }
  ]
});
```

### Batch Sending

```typescript
await context.email?.sendBatch([
  { to: 'user1@example.com', subject: 'Hello', text: 'Hi there!' },
  { to: 'user2@example.com', subject: 'Hello', text: 'Hi there!' }
]);
```

## Features

- ✅ SMTP email sending
- ✅ HTML and plain text support
- ✅ Attachments
- ✅ Batch sending
- ✅ Mailpit auto-detection for local development
- ✅ TLS/SSL support
- ✅ Multiple recipients (to, cc, bcc)



















