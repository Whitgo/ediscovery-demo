# Outlook Integration API Documentation

## Overview

The Outlook Integration API allows users to import emails and attachments directly from Microsoft Outlook into eDiscovery cases. This integration uses Microsoft Graph API with OAuth2 authentication.

## Features

- ✅ OAuth2 authentication with Microsoft
- ✅ Browse Outlook mail folders
- ✅ Search and filter emails
- ✅ Import emails as .eml files
- ✅ Automatically import email attachments
- ✅ Full audit trail logging
- ✅ Automatic token refresh
- ✅ Metadata extraction and tagging

## Setup

### 1. Register Azure Application

1. Go to [Azure Portal](https://portal.azure.com)
2. Navigate to **Azure Active Directory** > **App registrations**
3. Click **New registration**
4. Configure:
   - **Name**: eDiscovery Outlook Integration
   - **Supported account types**: Accounts in any organizational directory and personal Microsoft accounts
   - **Redirect URI**: `https://localhost:4443/outlook-callback.html`
5. After registration, copy the **Application (client) ID**

### 2. Create Client Secret

1. In your app registration, go to **Certificates & secrets**
2. Click **New client secret**
3. Add description and select expiration
4. Copy the **Value** (client secret) immediately

### 3. Configure API Permissions

1. Go to **API permissions**
2. Click **Add a permission**
3. Select **Microsoft Graph**
4. Choose **Delegated permissions**
5. Add these permissions:
   - `Mail.Read`
   - `Mail.ReadBasic`
   - `offline_access`
6. Click **Grant admin consent** (if applicable)

### 4. Environment Variables

Add to your `.env` file:

```bash
# Microsoft Outlook Integration
OUTLOOK_CLIENT_ID=your-application-client-id
OUTLOOK_CLIENT_SECRET=your-client-secret-value
OUTLOOK_REDIRECT_URI=https://localhost:4443/outlook-callback.html
```

### 5. Database Migration

Run the database migration to create the `outlook_tokens` table:

```bash
cd backend
npx knex migrate:latest
```

## API Endpoints

### Authentication

#### GET /api/outlook/auth-url
Get Microsoft OAuth2 authorization URL.

**Authentication**: Required (JWT)  
**Role**: admin, manager, user

**Response**:
```json
{
  "authUrl": "https://login.microsoftonline.com/...",
  "state": "random-state-token",
  "message": "Open this URL in your browser to authorize Outlook access"
}
```

#### POST /api/outlook/token
Exchange authorization code for access token.

**Authentication**: Required (JWT)  
**Role**: admin, manager, user

**Request Body**:
```json
{
  "code": "authorization-code-from-oauth-callback"
}
```

**Response**:
```json
{
  "success": true,
  "message": "Outlook account connected successfully",
  "expiresIn": 3600
}
```

#### GET /api/outlook/status
Check connection status.

**Authentication**: Required (JWT)  
**Role**: admin, manager, user

**Response**:
```json
{
  "connected": true,
  "expiresAt": "2025-11-24T10:00:00Z",
  "isExpired": false,
  "needsRefresh": false
}
```

#### DELETE /api/outlook/disconnect
Disconnect Outlook account.

**Authentication**: Required (JWT)  
**Role**: admin, manager, user

**Response**:
```json
{
  "success": true,
  "message": "Outlook account disconnected successfully"
}
```

### Mail Operations

#### GET /api/outlook/folders
Get list of mail folders.

**Authentication**: Required (JWT)  
**Role**: admin, manager, user

**Response**:
```json
{
  "folders": [
    {
      "id": "inbox",
      "displayName": "Inbox",
      "unreadItemCount": 5,
      "totalItemCount": 150
    }
  ]
}
```

#### GET /api/outlook/messages
Get messages from a folder.

**Authentication**: Required (JWT)  
**Role**: admin, manager, user

**Query Parameters**:
- `folderId` (optional): Folder ID (default: "inbox")
- `top` (optional): Number of messages to retrieve (default: 50, max: 100)
- `skip` (optional): Number of messages to skip (default: 0)
- `search` (optional): Search query

**Response**:
```json
{
  "messages": [
    {
      "id": "message-id",
      "subject": "Important Legal Matter",
      "from": "sender@example.com",
      "fromName": "John Doe",
      "receivedDateTime": "2025-11-23T10:00:00Z",
      "hasAttachments": true,
      "bodyPreview": "This is a preview...",
      "isRead": false
    }
  ],
  "count": 50,
  "hasMore": true
}
```

#### GET /api/outlook/messages/:messageId
Get full message details.

**Authentication**: Required (JWT)  
**Role**: admin, manager, user

**Response**:
```json
{
  "id": "message-id",
  "subject": "Important Legal Matter",
  "from": {
    "email": "sender@example.com",
    "name": "John Doe"
  },
  "to": [
    {
      "email": "recipient@example.com",
      "name": "Jane Smith"
    }
  ],
  "cc": [],
  "receivedDateTime": "2025-11-23T10:00:00Z",
  "bodyPreview": "Preview text...",
  "body": "Full email body...",
  "bodyType": "html",
  "hasAttachments": true,
  "attachments": [
    {
      "id": "attachment-id",
      "name": "document.pdf",
      "contentType": "application/pdf",
      "size": 1024000,
      "isInline": false
    }
  ]
}
```

### Import Operations

#### POST /api/outlook/import/:caseId
Import emails into a case.

**Authentication**: Required (JWT)  
**Role**: admin, manager, user

**Request Body**:
```json
{
  "messageIds": ["msg-id-1", "msg-id-2"],
  "includeAttachments": true
}
```

**Response**:
```json
{
  "success": true,
  "message": "Imported 2 email(s)",
  "imported": [
    {
      "messageId": "msg-id-1",
      "documentId": 123,
      "subject": "Email Subject"
    }
  ],
  "failed": [],
  "attachmentsImported": 3
}
```

## Frontend Integration

### Import Component

Use the `OutlookImport` component in your case detail view:

```jsx
import OutlookImport from './components/OutlookImport';

// In your component
const [showOutlookImport, setShowOutlookImport] = useState(false);

{showOutlookImport && (
  <OutlookImport
    caseId={caseId}
    onClose={() => setShowOutlookImport(false)}
    onSuccess={(result) => {
      console.log('Imported:', result);
      refreshDocuments();
    }}
  />
)}
```

### Button to Trigger Import

```jsx
<button onClick={() => setShowOutlookImport(true)}>
  📧 Import from Outlook
</button>
```

## Security Considerations

### Token Storage
- Access tokens are stored in the `outlook_tokens` table
- Tokens are associated with user accounts
- In production, consider encrypting tokens at rest

### Token Refresh
- Tokens automatically refresh when expired
- Refresh tokens are stored for seamless reconnection
- Failed refresh requires re-authentication

### Permissions
- Only admin, manager, and user roles can access Outlook integration
- Each user connects their own Outlook account
- Imported documents inherit user's permissions

### Rate Limiting
- Standard API rate limits apply to Outlook endpoints
- Microsoft Graph API has its own rate limits

## Audit Trail

All Outlook operations are logged to the `audit_logs` table:

- **Connection**: When user authorizes Outlook access
- **Import**: Full details of imported emails including:
  - Number of emails imported
  - Number of attachments imported
  - Message IDs
  - Case ID
  - User ID

## Troubleshooting

### "Outlook integration not configured"
Ensure `OUTLOOK_CLIENT_ID` and `OUTLOOK_CLIENT_SECRET` are set in `.env`

### "Failed to obtain access token"
- Check client ID and secret are correct
- Verify redirect URI matches Azure app registration
- Ensure user granted all required permissions

### "Outlook authentication expired"
- User needs to reconnect their account
- Automatic token refresh may have failed
- Click "Disconnect" and reconnect

### Import Fails
- Verify case exists and user has access
- Check file size limits (50MB per attachment)
- Review backend logs for specific errors

## Metadata Extracted

Imported emails include:

- **File Type**: message/rfc822 (.eml format)
- **Legal Category**: Correspondence
- **Evidence Type**: Digital Evidence
- **Tags**: outlook, email
- **Custom Metadata**:
  - outlook_message_id
  - from (sender email)
  - subject
  - received_date

## Limitations

- Maximum 50 messages can be imported at once
- Maximum 100 messages retrieved per folder query
- Attachment size limit: 50MB
- Inline images may not be preserved in .eml format
- HTML emails are converted to plain text in .eml body

## Future Enhancements

- [ ] Support for importing entire folder structures
- [ ] Preserve HTML email formatting
- [ ] Thread conversation grouping
- [ ] Advanced search with date ranges
- [ ] Scheduled automatic imports
- [ ] Gmail integration using similar pattern
- [ ] Direct attachment preview without download
