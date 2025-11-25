/**
 * Microsoft Outlook Integration API
 * Allows importing emails and attachments from Outlook into eDiscovery cases
 */

const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const { requireRole } = require('../middleware/rbac');
const logger = require('../utils/logger');
const axios = require('axios');
const { upload } = require('../middleware/upload');
const path = require('path');
const fs = require('fs').promises;
const crypto = require('crypto');

/**
 * GET /api/outlook/auth-url
 * Get Microsoft OAuth2 authorization URL
 */
router.get('/auth-url', auth, requireRole('admin', 'manager', 'user'), (req, res) => {
  const clientId = process.env.OUTLOOK_CLIENT_ID;
  const redirectUri = process.env.OUTLOOK_REDIRECT_URI || 'https://localhost:4443/api/outlook/callback';
  const state = crypto.randomBytes(16).toString('hex');
  
  if (!clientId) {
    return res.status(500).json({ 
      error: 'Outlook integration not configured',
      message: 'OUTLOOK_CLIENT_ID not set in environment variables'
    });
  }

  const scopes = [
    'https://graph.microsoft.com/Mail.Read',
    'https://graph.microsoft.com/Mail.ReadBasic',
    'offline_access'
  ].join(' ');

  const authUrl = `https://login.microsoftonline.com/common/oauth2/v2.0/authorize?` +
    `client_id=${encodeURIComponent(clientId)}` +
    `&response_type=code` +
    `&redirect_uri=${encodeURIComponent(redirectUri)}` +
    `&response_mode=query` +
    `&scope=${encodeURIComponent(scopes)}` +
    `&state=${state}`;

  res.json({ 
    authUrl,
    state,
    message: 'Open this URL in your browser to authorize Outlook access'
  });
});

/**
 * POST /api/outlook/token
 * Exchange authorization code for access token
 */
router.post('/token', auth, requireRole('admin', 'manager', 'user'), async (req, res) => {
  const { code } = req.body;
  const knex = req.knex;

  if (!code) {
    return res.status(400).json({ error: 'Authorization code is required' });
  }

  const clientId = process.env.OUTLOOK_CLIENT_ID;
  const clientSecret = process.env.OUTLOOK_CLIENT_SECRET;
  const redirectUri = process.env.OUTLOOK_REDIRECT_URI || 'https://localhost:4443/api/outlook/callback';

  if (!clientId || !clientSecret) {
    return res.status(500).json({ 
      error: 'Outlook integration not configured',
      message: 'OUTLOOK_CLIENT_ID or OUTLOOK_CLIENT_SECRET not set'
    });
  }

  try {
    const tokenResponse = await axios.post(
      'https://login.microsoftonline.com/common/oauth2/v2.0/token',
      new URLSearchParams({
        client_id: clientId,
        client_secret: clientSecret,
        code: code,
        redirect_uri: redirectUri,
        grant_type: 'authorization_code'
      }),
      {
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' }
      }
    );

    const { access_token, refresh_token, expires_in } = tokenResponse.data;

    // Store tokens in database (encrypted in production)
    await knex('outlook_tokens').insert({
      user_id: req.user.id,
      access_token: access_token,
      refresh_token: refresh_token,
      expires_at: new Date(Date.now() + expires_in * 1000),
      created_at: knex.fn.now(),
      updated_at: knex.fn.now()
    }).onConflict('user_id').merge();

    logger.info('Outlook token obtained', { userId: req.user.id });

    res.json({ 
      success: true,
      message: 'Outlook account connected successfully',
      expiresIn: expires_in
    });

  } catch (error) {
    logger.error('Outlook token exchange failed', { 
      error: error.message, 
      userId: req.user.id,
      response: error.response?.data
    });
    
    res.status(500).json({ 
      error: 'Failed to obtain Outlook access token',
      details: error.response?.data?.error_description || error.message
    });
  }
});

/**
 * GET /api/outlook/folders
 * Get list of Outlook mail folders
 */
router.get('/folders', auth, requireRole('admin', 'manager', 'user'), async (req, res) => {
  const knex = req.knex;

  try {
    const token = await getValidToken(knex, req.user.id);
    
    if (!token) {
      return res.status(401).json({ 
        error: 'Outlook not connected',
        message: 'Please connect your Outlook account first'
      });
    }

    const response = await axios.get(
      'https://graph.microsoft.com/v1.0/me/mailFolders',
      {
        headers: { 'Authorization': `Bearer ${token}` }
      }
    );

    const folders = response.data.value.map(folder => ({
      id: folder.id,
      displayName: folder.displayName,
      unreadItemCount: folder.unreadItemCount,
      totalItemCount: folder.totalItemCount
    }));

    res.json({ folders });

  } catch (error) {
    handleOutlookError(error, res, 'Failed to fetch folders');
  }
});

/**
 * GET /api/outlook/messages
 * Get messages from a specific folder
 */
router.get('/messages', auth, requireRole('admin', 'manager', 'user'), async (req, res) => {
  const knex = req.knex;
  const { folderId = 'inbox', top = 50, skip = 0, search } = req.query;

  try {
    const token = await getValidToken(knex, req.user.id);
    
    if (!token) {
      return res.status(401).json({ 
        error: 'Outlook not connected',
        message: 'Please connect your Outlook account first'
      });
    }

    let url = `https://graph.microsoft.com/v1.0/me/mailFolders/${folderId}/messages`;
    const params = new URLSearchParams({
      $top: Math.min(parseInt(top), 100),
      $skip: parseInt(skip),
      $select: 'id,subject,from,receivedDateTime,hasAttachments,bodyPreview,isRead',
      $orderby: 'receivedDateTime DESC'
    });

    if (search) {
      params.append('$search', `"${search}"`);
    }

    url += '?' + params.toString();

    const response = await axios.get(url, {
      headers: { 'Authorization': `Bearer ${token}` }
    });

    const messages = response.data.value.map(msg => ({
      id: msg.id,
      subject: msg.subject || '(No Subject)',
      from: msg.from?.emailAddress?.address || 'Unknown',
      fromName: msg.from?.emailAddress?.name || 'Unknown',
      receivedDateTime: msg.receivedDateTime,
      hasAttachments: msg.hasAttachments,
      bodyPreview: msg.bodyPreview,
      isRead: msg.isRead
    }));

    res.json({ 
      messages,
      count: messages.length,
      hasMore: messages.length === parseInt(top)
    });

  } catch (error) {
    handleOutlookError(error, res, 'Failed to fetch messages');
  }
});

/**
 * GET /api/outlook/messages/:messageId
 * Get full message details including body and attachments
 */
router.get('/messages/:messageId', auth, requireRole('admin', 'manager', 'user'), async (req, res) => {
  const knex = req.knex;
  const { messageId } = req.params;

  try {
    const token = await getValidToken(knex, req.user.id);
    
    if (!token) {
      return res.status(401).json({ 
        error: 'Outlook not connected'
      });
    }

    const response = await axios.get(
      `https://graph.microsoft.com/v1.0/me/messages/${messageId}`,
      {
        headers: { 'Authorization': `Bearer ${token}` },
        params: {
          $select: 'id,subject,from,toRecipients,ccRecipients,receivedDateTime,hasAttachments,body,bodyPreview'
        }
      }
    );

    const message = response.data;

    // Get attachments if present
    let attachments = [];
    if (message.hasAttachments) {
      const attachResponse = await axios.get(
        `https://graph.microsoft.com/v1.0/me/messages/${messageId}/attachments`,
        {
          headers: { 'Authorization': `Bearer ${token}` }
        }
      );
      attachments = attachResponse.data.value.map(att => ({
        id: att.id,
        name: att.name,
        contentType: att.contentType,
        size: att.size,
        isInline: att.isInline
      }));
    }

    res.json({
      id: message.id,
      subject: message.subject || '(No Subject)',
      from: {
        email: message.from?.emailAddress?.address,
        name: message.from?.emailAddress?.name
      },
      to: message.toRecipients?.map(r => ({
        email: r.emailAddress?.address,
        name: r.emailAddress?.name
      })) || [],
      cc: message.ccRecipients?.map(r => ({
        email: r.emailAddress?.address,
        name: r.emailAddress?.name
      })) || [],
      receivedDateTime: message.receivedDateTime,
      bodyPreview: message.bodyPreview,
      body: message.body?.content || '',
      bodyType: message.body?.contentType || 'text',
      hasAttachments: message.hasAttachments,
      attachments
    });

  } catch (error) {
    handleOutlookError(error, res, 'Failed to fetch message details');
  }
});

/**
 * POST /api/outlook/import/:caseId
 * Import email message(s) into a case as documents
 */
router.post('/import/:caseId', auth, requireRole('admin', 'manager', 'user'), async (req, res) => {
  const knex = req.knex;
  const { caseId } = req.params;
  const { messageIds, includeAttachments = true } = req.body;

  if (!Array.isArray(messageIds) || messageIds.length === 0) {
    return res.status(400).json({ error: 'Message IDs array is required' });
  }

  if (messageIds.length > 50) {
    return res.status(400).json({ error: 'Maximum 50 messages can be imported at once' });
  }

  try {
    // Verify case exists
    const caseExists = await knex('cases').where({ id: caseId }).first();
    if (!caseExists) {
      return res.status(404).json({ error: 'Case not found' });
    }

    const token = await getValidToken(knex, req.user.id);
    if (!token) {
      return res.status(401).json({ error: 'Outlook not connected' });
    }

    const results = {
      imported: [],
      failed: [],
      attachmentsImported: 0
    };

    for (const messageId of messageIds) {
      try {
        // Get message details
        const msgResponse = await axios.get(
          `https://graph.microsoft.com/v1.0/me/messages/${messageId}`,
          {
            headers: { 'Authorization': `Bearer ${token}` }
          }
        );

        const message = msgResponse.data;

        // Create EML file content
        const emlContent = await generateEmlContent(message);
        const emlFileName = sanitizeFileName(message.subject || 'email') + '.eml';
        
        // Save EML file
        const uploadsDir = path.join(__dirname, '../../uploads');
        const hashedName = crypto.randomBytes(32).toString('hex') + '.eml';
        const filePath = path.join(uploadsDir, hashedName);
        
        await fs.writeFile(filePath, emlContent, 'utf8');
        const fileSize = (await fs.stat(filePath)).size;

        // Insert document record
        const [docId] = await knex('documents').insert({
          case_id: caseId,
          name: emlFileName,
          file_type: 'message/rfc822',
          size: fileSize,
          stored_filename: hashedName,
          uploaded_by: req.user.name,
          legal_category: 'Correspondence',
          evidence_type: 'Digital Evidence',
          tags: JSON.stringify(['outlook', 'email']),
          custom_metadata: JSON.stringify({
            outlook_message_id: messageId,
            from: message.from?.emailAddress?.address,
            subject: message.subject,
            received_date: message.receivedDateTime
          }),
          created_at: knex.fn.now(),
          updated_at: knex.fn.now()
        }).returning('id');

        results.imported.push({
          messageId,
          documentId: docId,
          subject: message.subject
        });

        // Import attachments if requested
        if (includeAttachments && message.hasAttachments) {
          const attachCount = await importAttachments(
            knex, 
            token, 
            messageId, 
            caseId, 
            req.user.name,
            message.subject
          );
          results.attachmentsImported += attachCount;
        }

      } catch (error) {
        logger.error('Failed to import message', { 
          messageId, 
          error: error.message 
        });
        results.failed.push({
          messageId,
          error: error.message
        });
      }
    }

    // Log audit trail
    await knex('audit_logs').insert({
      case_id: caseId,
      user: req.user.id,
      action: 'outlook_import',
      object_type: 'document',
      details: JSON.stringify({
        imported_count: results.imported.length,
        failed_count: results.failed.length,
        attachments_count: results.attachmentsImported,
        message_ids: messageIds
      }),
      timestamp: knex.fn.now()
    });

    logger.info('Outlook import completed', {
      userId: req.user.id,
      caseId,
      imported: results.imported.length,
      failed: results.failed.length
    });

    res.json({
      success: true,
      message: `Imported ${results.imported.length} email(s)`,
      ...results
    });

  } catch (error) {
    logger.error('Outlook import error', { 
      error: error.message,
      caseId,
      userId: req.user.id 
    });
    res.status(500).json({ 
      error: 'Failed to import emails',
      details: error.message 
    });
  }
});

/**
 * DELETE /api/outlook/disconnect
 * Disconnect Outlook account (remove stored tokens)
 */
router.delete('/disconnect', auth, requireRole('admin', 'manager', 'user'), async (req, res) => {
  const knex = req.knex;

  try {
    await knex('outlook_tokens')
      .where({ user_id: req.user.id })
      .del();

    logger.info('Outlook account disconnected', { userId: req.user.id });

    res.json({ 
      success: true,
      message: 'Outlook account disconnected successfully'
    });

  } catch (error) {
    logger.error('Failed to disconnect Outlook', { 
      error: error.message,
      userId: req.user.id 
    });
    res.status(500).json({ 
      error: 'Failed to disconnect Outlook account',
      details: error.message 
    });
  }
});

/**
 * GET /api/outlook/status
 * Check if user has connected Outlook account
 */
router.get('/status', auth, requireRole('admin', 'manager', 'user'), async (req, res) => {
  const knex = req.knex;

  try {
    const tokenRecord = await knex('outlook_tokens')
      .where({ user_id: req.user.id })
      .first();

    if (!tokenRecord) {
      return res.json({ 
        connected: false,
        message: 'Outlook account not connected'
      });
    }

    const isExpired = new Date(tokenRecord.expires_at) < new Date();

    res.json({
      connected: true,
      expiresAt: tokenRecord.expires_at,
      isExpired,
      needsRefresh: isExpired
    });

  } catch (error) {
    logger.error('Failed to check Outlook status', { 
      error: error.message,
      userId: req.user.id 
    });
    res.status(500).json({ 
      error: 'Failed to check connection status',
      details: error.message 
    });
  }
});

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Get valid access token (refresh if expired)
 */
async function getValidToken(knex, userId) {
  const tokenRecord = await knex('outlook_tokens')
    .where({ user_id: userId })
    .first();

  if (!tokenRecord) {
    return null;
  }

  const isExpired = new Date(tokenRecord.expires_at) < new Date();

  if (!isExpired) {
    return tokenRecord.access_token;
  }

  // Refresh token
  try {
    const clientId = process.env.OUTLOOK_CLIENT_ID;
    const clientSecret = process.env.OUTLOOK_CLIENT_SECRET;

    const tokenResponse = await axios.post(
      'https://login.microsoftonline.com/common/oauth2/v2.0/token',
      new URLSearchParams({
        client_id: clientId,
        client_secret: clientSecret,
        refresh_token: tokenRecord.refresh_token,
        grant_type: 'refresh_token'
      }),
      {
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' }
      }
    );

    const { access_token, refresh_token, expires_in } = tokenResponse.data;

    await knex('outlook_tokens')
      .where({ user_id: userId })
      .update({
        access_token: access_token,
        refresh_token: refresh_token || tokenRecord.refresh_token,
        expires_at: new Date(Date.now() + expires_in * 1000),
        updated_at: knex.fn.now()
      });

    logger.info('Outlook token refreshed', { userId });
    return access_token;

  } catch (error) {
    logger.error('Token refresh failed', { error: error.message, userId });
    return null;
  }
}

/**
 * Generate EML file content from Outlook message
 */
async function generateEmlContent(message) {
  const eml = [];
  
  eml.push(`From: ${message.from?.emailAddress?.name || ''} <${message.from?.emailAddress?.address || ''}>`);
  
  if (message.toRecipients && message.toRecipients.length > 0) {
    const to = message.toRecipients
      .map(r => `${r.emailAddress?.name || ''} <${r.emailAddress?.address || ''}>`)
      .join(', ');
    eml.push(`To: ${to}`);
  }
  
  if (message.ccRecipients && message.ccRecipients.length > 0) {
    const cc = message.ccRecipients
      .map(r => `${r.emailAddress?.name || ''} <${r.emailAddress?.address || ''}>`)
      .join(', ');
    eml.push(`Cc: ${cc}`);
  }
  
  eml.push(`Subject: ${message.subject || '(No Subject)'}`);
  eml.push(`Date: ${message.receivedDateTime || new Date().toISOString()}`);
  eml.push(`Message-ID: <${message.id}@outlook.com>`);
  eml.push(`Content-Type: text/plain; charset="UTF-8"`);
  eml.push('');
  
  // Body
  const bodyText = message.body?.contentType === 'html' 
    ? stripHtml(message.body?.content || '')
    : message.body?.content || message.bodyPreview || '';
  
  eml.push(bodyText);
  
  return eml.join('\r\n');
}

/**
 * Import email attachments
 */
async function importAttachments(knex, token, messageId, caseId, userName, emailSubject) {
  try {
    const response = await axios.get(
      `https://graph.microsoft.com/v1.0/me/messages/${messageId}/attachments`,
      {
        headers: { 'Authorization': `Bearer ${token}` }
      }
    );

    const attachments = response.data.value.filter(att => !att.isInline);
    let importedCount = 0;

    for (const attachment of attachments) {
      try {
        // Skip inline attachments and overly large files
        if (attachment.size > 50 * 1024 * 1024) {
          logger.warn('Attachment too large, skipping', { 
            name: attachment.name, 
            size: attachment.size 
          });
          continue;
        }

        // Decode base64 content
        const contentBytes = Buffer.from(attachment.contentBytes, 'base64');
        
        const uploadsDir = path.join(__dirname, '../../uploads');
        const ext = path.extname(attachment.name) || '';
        const hashedName = crypto.randomBytes(32).toString('hex') + ext;
        const filePath = path.join(uploadsDir, hashedName);
        
        await fs.writeFile(filePath, contentBytes);

        await knex('documents').insert({
          case_id: caseId,
          name: attachment.name,
          file_type: attachment.contentType || 'application/octet-stream',
          size: attachment.size,
          stored_filename: hashedName,
          uploaded_by: userName,
          legal_category: 'Evidence',
          evidence_type: 'Digital Evidence',
          tags: JSON.stringify(['outlook', 'attachment', 'email']),
          custom_metadata: JSON.stringify({
            outlook_message_id: messageId,
            email_subject: emailSubject,
            attachment_type: 'email_attachment'
          }),
          created_at: knex.fn.now(),
          updated_at: knex.fn.now()
        });

        importedCount++;

      } catch (error) {
        logger.error('Failed to import attachment', { 
          name: attachment.name, 
          error: error.message 
        });
      }
    }

    return importedCount;

  } catch (error) {
    logger.error('Failed to fetch attachments', { 
      messageId, 
      error: error.message 
    });
    return 0;
  }
}

/**
 * Sanitize filename for safe file system storage
 */
function sanitizeFileName(name) {
  return name
    .replace(/[^a-zA-Z0-9_\-. ]/g, '_')
    .replace(/\s+/g, '_')
    .substring(0, 100);
}

/**
 * Strip HTML tags from content
 */
function stripHtml(html) {
  return html
    .replace(/<style[^>]*>.*?<\/style>/gi, '')
    .replace(/<script[^>]*>.*?<\/script>/gi, '')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .trim();
}

/**
 * Handle Outlook API errors
 */
function handleOutlookError(error, res, message) {
  logger.error(message, { 
    error: error.message,
    status: error.response?.status,
    data: error.response?.data
  });

  if (error.response?.status === 401) {
    return res.status(401).json({ 
      error: 'Outlook authentication expired',
      message: 'Please reconnect your Outlook account'
    });
  }

  res.status(500).json({ 
    error: message,
    details: error.response?.data?.error?.message || error.message
  });
}

module.exports = router;
