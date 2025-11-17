/**
 * Email Notification Service
 * Sends emails for incident notifications, GDPR breach notifications, and system alerts
 */

const nodemailer = require('nodemailer');

// Email configuration from environment variables
const EMAIL_CONFIG = {
  host: process.env.SMTP_HOST || 'smtp.gmail.com',
  port: parseInt(process.env.SMTP_PORT || '587'),
  secure: process.env.SMTP_SECURE === 'true', // true for 465, false for other ports
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASSWORD
  }
};

const FROM_EMAIL = process.env.FROM_EMAIL || process.env.SMTP_USER;
const FROM_NAME = process.env.FROM_NAME || 'eDiscovery Platform';

/**
 * Create nodemailer transporter
 */
function createTransporter() {
  // Validate required configuration
  if (!EMAIL_CONFIG.auth.user || !EMAIL_CONFIG.auth.pass) {
    console.warn('⚠️  Email service not configured - SMTP_USER and SMTP_PASSWORD required');
    return null;
  }
  
  return nodemailer.createTransport(EMAIL_CONFIG);
}

/**
 * Send email with retry logic
 */
async function sendEmail({ to, subject, html, text, attachments = [] }) {
  const transporter = createTransporter();
  
  if (!transporter) {
    // Email not configured - log instead of failing
    console.log('📧 [EMAIL NOT CONFIGURED] Would send email:', { to, subject });
    return {
      success: false,
      message: 'Email service not configured',
      simulated: true
    };
  }
  
  try {
    const mailOptions = {
      from: `"${FROM_NAME}" <${FROM_EMAIL}>`,
      to: Array.isArray(to) ? to.join(', ') : to,
      subject,
      html,
      text: text || stripHtml(html),
      attachments
    };
    
    const info = await transporter.sendMail(mailOptions);
    
    console.log(`✅ Email sent: ${subject} to ${to}`);
    console.log(`   Message ID: ${info.messageId}`);
    
    return {
      success: true,
      messageId: info.messageId,
      recipients: to
    };
    
  } catch (error) {
    console.error('❌ Email send failed:', error.message);
    
    return {
      success: false,
      error: error.message
    };
  }
}

/**
 * Strip HTML tags for plain text version
 */
function stripHtml(html) {
  return html
    .replace(/<[^>]*>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .trim();
}

/**
 * Send GDPR data breach notification to regulatory authority (DPA)
 */
async function sendRegulatoryBreachNotification({ incident, dpaEmail, dpaName }) {
  const subject = `URGENT: Data Breach Notification - ${incident.incident_number}`;
  
  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <style>
        body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
        .header { background: #d32f2f; color: white; padding: 20px; text-align: center; }
        .content { padding: 20px; }
        .incident-details { background: #f5f5f5; padding: 15px; margin: 15px 0; border-left: 4px solid #d32f2f; }
        .label { font-weight: bold; color: #555; }
        .value { margin-left: 10px; }
        .deadline { background: #fff3cd; padding: 10px; margin: 15px 0; border: 1px solid #ffc107; }
        .footer { margin-top: 30px; padding: 20px; background: #f5f5f5; font-size: 12px; color: #666; }
      </style>
    </head>
    <body>
      <div class="header">
        <h1>🚨 Data Breach Notification</h1>
        <p>GDPR Article 33 - Personal Data Breach Notification</p>
      </div>
      
      <div class="content">
        <p>Dear ${dpaName || 'Data Protection Authority'},</p>
        
        <p>We are writing to notify you of a personal data breach in accordance with Article 33 of the GDPR.</p>
        
        <div class="incident-details">
          <h2>Incident Details</h2>
          <p><span class="label">Incident Number:</span><span class="value">${incident.incident_number}</span></p>
          <p><span class="label">Incident Title:</span><span class="value">${incident.title}</span></p>
          <p><span class="label">Severity:</span><span class="value">${incident.severity?.toUpperCase()}</span></p>
          <p><span class="label">Date/Time Discovered:</span><span class="value">${new Date(incident.breach_discovered_at).toLocaleString()}</span></p>
          <p><span class="label">Description:</span></p>
          <p>${incident.description || 'N/A'}</p>
        </div>
        
        <div class="incident-details">
          <h2>Nature of the Breach</h2>
          <p><span class="label">Type:</span><span class="value">${incident.type_name || 'Data Breach'}</span></p>
          <p><span class="label">Category:</span><span class="value">${incident.category || 'N/A'}</span></p>
          <p><span class="label">Affected Users:</span><span class="value">${incident.affected_users_count || 'Under investigation'}</span></p>
          <p><span class="label">Affected Records:</span><span class="value">${incident.affected_records_count || 'Under investigation'}</span></p>
          <p><span class="label">Data Types:</span><span class="value">${incident.data_types_affected || 'Under investigation'}</span></p>
        </div>
        
        <div class="incident-details">
          <h2>Impact Assessment</h2>
          <p>${incident.impact_assessment || 'Impact assessment in progress. We will provide updates as our investigation continues.'}</p>
        </div>
        
        <div class="incident-details">
          <h2>Containment Measures</h2>
          <p>${incident.containment_actions || 'Immediate containment measures have been initiated. Details to follow.'}</p>
        </div>
        
        <div class="deadline">
          <p><strong>⏰ Notification Timeline:</strong></p>
          <p>Breach discovered: ${new Date(incident.breach_discovered_at).toLocaleString()}</p>
          <p>Notification sent: ${new Date().toLocaleString()}</p>
          <p>Time elapsed: ${calculateTimeElapsed(incident.breach_discovered_at)}</p>
        </div>
        
        <h2>Contact Information</h2>
        <p>For further information regarding this breach, please contact:</p>
        <p>
          <strong>Data Protection Officer</strong><br>
          Email: ${process.env.DPO_EMAIL || 'dpo@company.com'}<br>
          Phone: ${process.env.DPO_PHONE || '+1-XXX-XXX-XXXX'}
        </p>
        
        <p>We will continue to provide updates as our investigation progresses and will notify affected individuals in accordance with GDPR requirements.</p>
        
        <p>Sincerely,<br>
        ${FROM_NAME}<br>
        Data Protection Team</p>
      </div>
      
      <div class="footer">
        <p>This notification is sent in compliance with GDPR Article 33. Reference: ${incident.incident_number}</p>
      </div>
    </body>
    </html>
  `;
  
  return await sendEmail({
    to: dpaEmail,
    subject,
    html
  });
}

/**
 * Send data breach notification to affected users
 */
async function sendUserBreachNotification({ incident, userEmail, userName }) {
  const subject = `Important: Security Notification Regarding Your Data`;
  
  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <style>
        body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
        .header { background: #1976d2; color: white; padding: 20px; text-align: center; }
        .content { padding: 20px; }
        .alert-box { background: #fff3cd; padding: 15px; margin: 15px 0; border-left: 4px solid #ffc107; }
        .info-box { background: #f5f5f5; padding: 15px; margin: 15px 0; }
        .action-box { background: #e3f2fd; padding: 15px; margin: 15px 0; border-left: 4px solid #1976d2; }
        .footer { margin-top: 30px; padding: 20px; background: #f5f5f5; font-size: 12px; color: #666; }
        ul { margin: 10px 0; padding-left: 20px; }
      </style>
    </head>
    <body>
      <div class="header">
        <h1>Security Notification</h1>
      </div>
      
      <div class="content">
        <p>Dear ${userName || 'User'},</p>
        
        <div class="alert-box">
          <p><strong>⚠️ We are writing to inform you about a security incident that may have affected your personal data.</strong></p>
        </div>
        
        <h2>What Happened?</h2>
        <p>${incident.description || 'We have detected unauthorized access to our systems that may have exposed personal data.'}</p>
        
        <div class="info-box">
          <h3>What Data Was Affected?</h3>
          <p>${incident.data_types_affected || 'We are currently investigating which specific data was affected. We will provide updates as we learn more.'}</p>
          
          <h3>When Did This Happen?</h3>
          <p>The incident was discovered on ${new Date(incident.breach_discovered_at).toLocaleDateString()} at ${new Date(incident.breach_discovered_at).toLocaleTimeString()}.</p>
        </div>
        
        <h2>What We're Doing</h2>
        <p>We take the security of your data very seriously. We have:</p>
        <ul>
          <li>Immediately initiated our incident response procedures</li>
          <li>Contained the breach to prevent further unauthorized access</li>
          <li>Launched a thorough investigation</li>
          <li>Notified the relevant data protection authorities</li>
          <li>Engaged cybersecurity experts to enhance our security measures</li>
        </ul>
        
        <div class="action-box">
          <h2>What You Should Do</h2>
          <p>We recommend you take the following precautionary steps:</p>
          <ul>
            <li><strong>Change your password immediately</strong> if you haven't done so recently</li>
            <li><strong>Enable two-factor authentication</strong> for additional security</li>
            <li><strong>Monitor your accounts</strong> for any suspicious activity</li>
            <li><strong>Be alert</strong> for phishing emails or suspicious communications</li>
            <li><strong>Review your account activity</strong> for any unauthorized access</li>
          </ul>
        </div>
        
        <h2>Need Help?</h2>
        <p>If you have questions or concerns, please contact us:</p>
        <p>
          Email: ${process.env.SUPPORT_EMAIL || 'support@company.com'}<br>
          Phone: ${process.env.SUPPORT_PHONE || '+1-XXX-XXX-XXXX'}<br>
          Hours: Monday-Friday, 9 AM - 5 PM
        </p>
        
        <p>We sincerely apologize for any inconvenience this may cause and are committed to protecting your data.</p>
        
        <p>Sincerely,<br>
        ${FROM_NAME}<br>
        Security Team</p>
      </div>
      
      <div class="footer">
        <p>Reference: ${incident.incident_number} | Date: ${new Date().toLocaleDateString()}</p>
        <p>This is an automated notification. Please do not reply directly to this email.</p>
      </div>
    </body>
    </html>
  `;
  
  return await sendEmail({
    to: userEmail,
    subject,
    html
  });
}

/**
 * Send internal incident alert to security team
 */
async function sendInternalIncidentAlert({ incident, teamEmails }) {
  const subject = `🚨 ${incident.severity?.toUpperCase()} Incident: ${incident.title}`;
  
  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <style>
        body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
        .header { background: #d32f2f; color: white; padding: 20px; }
        .content { padding: 20px; }
        .incident-box { background: #ffebee; padding: 15px; margin: 15px 0; border-left: 4px solid #d32f2f; }
        .action-required { background: #fff3cd; padding: 15px; margin: 15px 0; border: 2px solid #ff9800; }
        .label { font-weight: bold; }
        table { width: 100%; border-collapse: collapse; margin: 15px 0; }
        th, td { padding: 10px; text-align: left; border-bottom: 1px solid #ddd; }
        th { background: #f5f5f5; }
      </style>
    </head>
    <body>
      <div class="header">
        <h1>🚨 Incident Alert</h1>
        <h2>${incident.incident_number}: ${incident.title}</h2>
      </div>
      
      <div class="content">
        <div class="incident-box">
          <p><span class="label">Severity:</span> ${incident.severity?.toUpperCase()}</p>
          <p><span class="label">Status:</span> ${incident.status}</p>
          <p><span class="label">Detected:</span> ${new Date(incident.detected_at).toLocaleString()}</p>
          <p><span class="label">Detected By:</span> ${incident.detected_by || 'System'}</p>
        </div>
        
        <h2>Incident Details</h2>
        <table>
          <tr><th>Field</th><th>Value</th></tr>
          <tr><td>Type</td><td>${incident.type_name || 'N/A'}</td></tr>
          <tr><td>Category</td><td>${incident.category || 'N/A'}</td></tr>
          <tr><td>Data Breach</td><td>${incident.is_data_breach ? 'YES ⚠️' : 'No'}</td></tr>
          <tr><td>Requires Notification</td><td>${incident.requires_notification ? 'YES ⚠️' : 'No'}</td></tr>
          ${incident.notification_deadline ? `<tr><td>Notification Deadline</td><td>${new Date(incident.notification_deadline).toLocaleString()}</td></tr>` : ''}
          <tr><td>Affected Users</td><td>${incident.affected_users_count || 'TBD'}</td></tr>
          <tr><td>Affected Records</td><td>${incident.affected_records_count || 'TBD'}</td></tr>
        </table>
        
        <h2>Description</h2>
        <p>${incident.description || 'No description provided'}</p>
        
        ${incident.requires_notification ? `
        <div class="action-required">
          <h2>⏰ ACTION REQUIRED</h2>
          <p><strong>This incident requires breach notification under GDPR Article 33.</strong></p>
          <p>Deadline: ${new Date(incident.notification_deadline).toLocaleString()}</p>
          <p>Time remaining: ${calculateTimeRemaining(incident.notification_deadline)}</p>
          <p><a href="${process.env.APP_URL || 'http://localhost:3000'}/incidents/${incident.id}">View Incident Details</a></p>
        </div>
        ` : ''}
        
        <h2>Next Steps</h2>
        <ol>
          <li>Review incident details and assess impact</li>
          <li>Begin investigation and containment procedures</li>
          <li>Update incident status as actions are taken</li>
          ${incident.requires_notification ? '<li><strong>Prepare breach notification within 72 hours</strong></li>' : ''}
          <li>Document all actions in incident timeline</li>
        </ol>
        
        <p><strong>Access the incident:</strong><br>
        <a href="${process.env.APP_URL || 'http://localhost:3000'}/incidents/${incident.id}">${process.env.APP_URL || 'http://localhost:3000'}/incidents/${incident.id}</a></p>
      </div>
    </body>
    </html>
  `;
  
  return await sendEmail({
    to: teamEmails,
    subject,
    html
  });
}

/**
 * Send deadline reminder for GDPR notification
 */
async function sendDeadlineReminder({ incident, reminderEmails, hoursRemaining }) {
  const subject = `⏰ URGENT: Breach Notification Deadline in ${hoursRemaining} hours - ${incident.incident_number}`;
  
  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <style>
        body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
        .header { background: #ff9800; color: white; padding: 20px; text-align: center; }
        .content { padding: 20px; }
        .urgent { background: #fff3cd; padding: 20px; margin: 15px 0; border: 3px solid #ff9800; }
        .countdown { font-size: 24px; font-weight: bold; color: #d32f2f; text-align: center; padding: 20px; }
      </style>
    </head>
    <body>
      <div class="header">
        <h1>⏰ URGENT REMINDER</h1>
        <h2>GDPR Breach Notification Deadline Approaching</h2>
      </div>
      
      <div class="content">
        <div class="urgent">
          <h2>Incident: ${incident.incident_number}</h2>
          <p><strong>${incident.title}</strong></p>
          
          <div class="countdown">
            ${hoursRemaining} HOURS REMAINING
          </div>
          
          <p><strong>Notification Deadline:</strong> ${new Date(incident.notification_deadline).toLocaleString()}</p>
          <p><strong>Breach Discovered:</strong> ${new Date(incident.breach_discovered_at).toLocaleString()}</p>
        </div>
        
        <h2>Required Actions</h2>
        <ul>
          <li>Complete impact assessment</li>
          <li>Prepare DPA notification</li>
          <li>Identify affected individuals</li>
          <li>Prepare user notifications</li>
          <li>Document containment measures</li>
        </ul>
        
        <p><strong>View Incident:</strong><br>
        <a href="${process.env.APP_URL || 'http://localhost:3000'}/incidents/${incident.id}">${process.env.APP_URL || 'http://localhost:3000'}/incidents/${incident.id}</a></p>
        
        <p><strong>This is an automated reminder. Failure to notify within 72 hours may result in regulatory penalties.</strong></p>
      </div>
    </body>
    </html>
  `;
  
  return await sendEmail({
    to: reminderEmails,
    subject,
    html
  });
}

/**
 * Calculate time elapsed since breach
 */
function calculateTimeElapsed(breachTime) {
  const elapsed = Date.now() - new Date(breachTime).getTime();
  const hours = Math.floor(elapsed / (1000 * 60 * 60));
  const minutes = Math.floor((elapsed % (1000 * 60 * 60)) / (1000 * 60));
  return `${hours} hours, ${minutes} minutes`;
}

/**
 * Calculate time remaining until deadline
 */
function calculateTimeRemaining(deadline) {
  const remaining = new Date(deadline).getTime() - Date.now();
  if (remaining < 0) return 'OVERDUE';
  const hours = Math.floor(remaining / (1000 * 60 * 60));
  const minutes = Math.floor((remaining % (1000 * 60 * 60)) / (1000 * 60));
  return `${hours} hours, ${minutes} minutes`;
}

/**
 * Test email configuration
 */
async function testEmailConfig() {
  const transporter = createTransporter();
  
  if (!transporter) {
    return {
      success: false,
      message: 'Email not configured - SMTP_USER and SMTP_PASSWORD required'
    };
  }
  
  try {
    await transporter.verify();
    return {
      success: true,
      message: 'Email configuration is valid'
    };
  } catch (error) {
    return {
      success: false,
      message: `Email configuration error: ${error.message}`
    };
  }
}

module.exports = {
  sendEmail,
  sendRegulatoryBreachNotification,
  sendUserBreachNotification,
  sendInternalIncidentAlert,
  sendDeadlineReminder,
  testEmailConfig
};
