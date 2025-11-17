# Email Notification Service - Configuration Guide

## Overview

The email notification service enables automated email sending for:
- GDPR breach notifications to regulatory authorities (DPA)
- Breach notifications to affected users
- Internal incident alerts to security team
- Deadline reminders for 72-hour GDPR compliance

## Environment Variables

Add these variables to your `.env` file or environment configuration:

### Required Variables

```env
# SMTP Configuration
SMTP_HOST=smtp.gmail.com              # SMTP server hostname
SMTP_PORT=587                         # SMTP port (587 for TLS, 465 for SSL, 25 for unencrypted)
SMTP_SECURE=false                     # true for 465 (SSL), false for other ports (TLS/STARTTLS)
SMTP_USER=your-email@company.com      # SMTP authentication username (usually your email)
SMTP_PASSWORD=your-app-password       # SMTP authentication password or app-specific password

# Sender Information
FROM_EMAIL=noreply@company.com        # Email address shown in "From" field (defaults to SMTP_USER)
FROM_NAME=eDiscovery Platform         # Name shown in "From" field

# Incident Response Team
INCIDENT_TEAM_EMAILS=security@company.com,dpo@company.com,ciso@company.com
ESCALATION_EMAILS=ciso@company.com,ceo@company.com

# Data Protection Officer Contact (for email templates)
DPO_EMAIL=dpo@company.com
DPO_PHONE=+1-555-0100

# Support Contact (for user notifications)
SUPPORT_EMAIL=support@company.com
SUPPORT_PHONE=+1-555-0200

# Application URL (for links in emails)
APP_URL=https://ediscovery.company.com
```

## SMTP Provider Configuration

### Gmail

1. **Enable 2-Factor Authentication** on your Google account
2. **Generate App Password**:
   - Go to: https://myaccount.google.com/apppasswords
   - Select "Mail" and your device
   - Copy the 16-character password
3. **Configuration**:
   ```env
   SMTP_HOST=smtp.gmail.com
   SMTP_PORT=587
   SMTP_SECURE=false
   SMTP_USER=your-email@gmail.com
   SMTP_PASSWORD=xxxx-xxxx-xxxx-xxxx  # App password
   ```

### SendGrid

1. **Create SendGrid Account**: https://sendgrid.com
2. **Generate API Key**: Settings > API Keys
3. **Configuration**:
   ```env
   SMTP_HOST=smtp.sendgrid.net
   SMTP_PORT=587
   SMTP_SECURE=false
   SMTP_USER=apikey
   SMTP_PASSWORD=SG.xxxxxxxxxxxxx  # Your API key
   FROM_EMAIL=noreply@yourdomain.com  # Must be verified domain
   ```

### AWS SES (Simple Email Service)

1. **Set up AWS SES**: https://aws.amazon.com/ses/
2. **Verify Domain**: SES > Verified identities
3. **Get SMTP Credentials**: SES > SMTP settings > Create SMTP credentials
4. **Configuration**:
   ```env
   SMTP_HOST=email-smtp.us-east-1.amazonaws.com  # Your region
   SMTP_PORT=587
   SMTP_SECURE=false
   SMTP_USER=AKIAIOSFODNN7EXAMPLE     # SMTP username
   SMTP_PASSWORD=wJalrXUtnFEMI/EXAMPLE  # SMTP password
   FROM_EMAIL=noreply@yourdomain.com     # Verified email
   ```

### Microsoft 365 / Outlook

```env
SMTP_HOST=smtp.office365.com
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=your-email@company.com
SMTP_PASSWORD=your-password
```

### Custom SMTP Server

```env
SMTP_HOST=mail.yourcompany.com
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=username
SMTP_PASSWORD=password
```

## Testing Email Configuration

### Via API

```bash
# Test email configuration
curl -X GET https://localhost:4443/api/backups/test-email \
  -H "Authorization: Bearer YOUR_ADMIN_TOKEN" \
  -k

# Response (success):
{
  "success": true,
  "message": "Email configuration is valid"
}

# Response (not configured):
{
  "success": false,
  "message": "Email not configured - SMTP_USER and SMTP_PASSWORD required"
}

# Response (configuration error):
{
  "success": false,
  "message": "Email configuration error: Invalid login: 535 5.7.8 Error: authentication failed"
}
```

### Via Node.js

```javascript
const { testEmailConfig } = require('./src/utils/emailService');

async function test() {
  const result = await testEmailConfig();
  console.log(result);
}

test();
```

## Email Functions

### 1. Regulatory Breach Notification (DPA)

Sends GDPR Article 33 compliant notification to Data Protection Authority.

```javascript
const { sendRegulatoryBreachNotification } = require('./utils/emailService');

await sendRegulatoryBreachNotification({
  incident: incidentObject,
  dpaEmail: 'dpa@authority.gov',
  dpaName: 'UK Information Commissioner\'s Office'
});
```

**Template Includes**:
- Incident details and severity
- Nature of the breach
- Affected data types and user counts
- Impact assessment
- Containment measures taken
- Contact information for DPO
- Notification timeline

### 2. User Breach Notification

Sends notification to affected users about data breach.

```javascript
const { sendUserBreachNotification } = require('./utils/emailService');

await sendUserBreachNotification({
  incident: incidentObject,
  userEmail: 'user@example.com',
  userName: 'John Doe'
});
```

**Template Includes**:
- What happened (incident description)
- What data was affected
- When it happened
- What we're doing (response actions)
- What users should do (action items)
- Contact information for support

### 3. Internal Incident Alert

Sends immediate alert to incident response team when incident created.

```javascript
const { sendInternalIncidentAlert } = require('./utils/emailService');

await sendInternalIncidentAlert({
  incident: incidentObject,
  teamEmails: ['security@company.com', 'dpo@company.com']
});
```

**Template Includes**:
- Incident severity and status
- Detection details
- Full incident information table
- GDPR notification requirements
- Action items and next steps
- Link to incident in system

### 4. Deadline Reminder

Sends urgent reminder when GDPR notification deadline approaching.

```javascript
const { sendDeadlineReminder } = require('./utils/emailService');

await sendDeadlineReminder({
  incident: incidentObject,
  reminderEmails: ['security@company.com'],
  hoursRemaining: 12
});
```

**Template Includes**:
- Countdown timer (hours remaining)
- Incident details
- Required actions before deadline
- Link to incident
- Urgency indicators

## Automated Email Triggers

### When Incidents Created

Automatically sends internal alert when:
- Data breach incident created
- `is_data_breach = true`
- `requires_notification = true`

**Recipients**: `INCIDENT_TEAM_EMAILS` environment variable

### Deadline Reminders

Automatically sends reminders at:
- **12 hours before deadline**: Warning email
- **Deadline passed**: Escalation email to `ESCALATION_EMAILS`

**Triggered by**: `checkNotificationDeadlines()` function (called by admin endpoint or cron job)

## Usage Examples

### Manual Breach Notification

```bash
# Send regulatory notification
curl -X POST https://localhost:4443/api/incidents/1/breach-notification \
  -H "Authorization: Bearer YOUR_ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "recipient_email": "dpa@authority.gov",
    "notification_type": "regulatory",
    "method": "email",
    "message": "Formal breach notification per GDPR Article 33"
  }' \
  -k
```

### Send User Notification

```bash
curl -X POST https://localhost:4443/api/incidents/1/breach-notification \
  -H "Authorization: Bearer YOUR_ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "recipient_email": "user@example.com",
    "notification_type": "user",
    "method": "email",
    "message": "You may have been affected by a recent security incident"
  }' \
  -k
```

### Check Deadlines (Manual Trigger)

```bash
# Manually trigger deadline check (sends reminders if needed)
curl -X GET https://localhost:4443/api/incidents/admin/check-deadlines \
  -H "Authorization: Bearer YOUR_ADMIN_TOKEN" \
  -k
```

## Graceful Degradation

The email service is designed to **not break** the application if not configured:

```javascript
// If SMTP credentials not provided:
// - Emails are logged to console
// - Returns { success: false, simulated: true }
// - Application continues normally
// - No errors thrown

console.log('📧 [EMAIL NOT CONFIGURED] Would send email:', { to, subject });
```

This allows development/testing without email configuration while still recording notification attempts.

## Security Considerations

### SMTP Credentials

- **Never commit** SMTP credentials to version control
- Use **app-specific passwords** (Gmail, Outlook) not main account password
- Store in environment variables or secrets manager
- Rotate credentials regularly

### Email Content

- GDPR notifications contain **sensitive information**
- Use **TLS/SSL** for SMTP connections (SMTP_PORT=587 with STARTTLS)
- Consider **encrypting emails** with S/MIME or PGP for high-sensitivity
- Log email sending but **not** full email content

### Rate Limiting

- Gmail: 500 emails/day (free), 2000/day (Workspace)
- SendGrid: 100 emails/day (free), unlimited (paid)
- AWS SES: 200 emails/day (free tier)
- Implement **rate limiting** for bulk notifications

## Troubleshooting

### "Authentication Failed"

**Cause**: Invalid SMTP credentials  
**Fix**: 
- Verify SMTP_USER and SMTP_PASSWORD
- For Gmail: Use app-specific password, not account password
- For SendGrid: Use "apikey" as username, API key as password

### "Connection Timeout"

**Cause**: Firewall blocking SMTP port  
**Fix**:
- Check port 587 (or 465) is not blocked
- Try alternate port (465 for SSL, 25 for unencrypted)
- Verify SMTP_HOST is correct

### "Email Not Configured"

**Cause**: Missing SMTP_USER or SMTP_PASSWORD  
**Fix**: Set environment variables in .env file

### "Sender Address Rejected"

**Cause**: FROM_EMAIL not verified  
**Fix**:
- Verify domain/email with your provider (SendGrid, SES)
- Use verified sender address
- Some providers require FROM_EMAIL = SMTP_USER

## Monitoring

### Email Delivery Tracking

All sent emails are logged:
```
✅ Email sent: URGENT: Data Breach Notification - INC-2025-0001 to dpa@authority.gov
   Message ID: <abc123@company.com>
```

Failed emails are logged:
```
❌ Email send failed: Authentication failed: 535 5.7.8 Error: authentication failed
```

### Database Records

Email notifications are tracked in `incident_notifications` table:
- `status`: pending, sent, failed, acknowledged
- `sent_at`: Timestamp of successful send
- `delivery_confirmation`: JSON with messageId and provider response

## Production Checklist

- [ ] Configure SMTP credentials (SendGrid, AWS SES, or corporate SMTP)
- [ ] Set FROM_EMAIL to verified domain
- [ ] Configure INCIDENT_TEAM_EMAILS with actual team addresses
- [ ] Set ESCALATION_EMAILS for overdue incidents
- [ ] Configure DPO contact information
- [ ] Set APP_URL to production domain
- [ ] Test email configuration via API
- [ ] Send test breach notification
- [ ] Verify DPA notification template
- [ ] Verify user notification template
- [ ] Set up email delivery monitoring
- [ ] Document incident response email workflow
- [ ] Train team on email notification system

## Compliance Notes

### GDPR Article 33

Email notifications support 72-hour breach notification requirement:
- ✅ Automated countdown tracking
- ✅ Reminder emails at 12 hours remaining
- ✅ Escalation emails if deadline passed
- ✅ Template includes all required information
- ✅ Audit trail of all notifications sent

### Required Information in Breach Notifications

Per GDPR Article 33(3), notifications must include:
- ✅ Nature of the personal data breach
- ✅ Name and contact details of DPO
- ✅ Likely consequences of the breach
- ✅ Measures taken or proposed to address the breach

All included in `sendRegulatoryBreachNotification()` template.

---

**Status**: ✅ Implemented  
**Production Ready**: ⚠️ Requires SMTP configuration  
**Last Updated**: November 17, 2025
