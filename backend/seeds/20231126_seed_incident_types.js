/**
 * Seed default incident types for incident response system
 */

exports.seed = async function(knex) {
  // Delete existing entries
  await knex('incident_types').del();
  
  // Insert incident types
  await knex('incident_types').insert([
    {
      name: 'Data Breach - Unauthorized Access',
      category: 'security',
      severity_level: 1,
      requires_breach_notification: true,
      notification_deadline_hours: 72,
      description: 'Unauthorized access to personal data or confidential information',
      response_template: JSON.stringify({
        immediate_actions: [
          'Identify and isolate affected systems',
          'Revoke compromised credentials',
          'Preserve forensic evidence'
        ],
        investigation_steps: [
          'Determine scope of data accessed',
          'Identify affected users/records',
          'Document timeline of events'
        ],
        notification_requirements: [
          'Notify Data Protection Authority within 72 hours',
          'Notify affected users without undue delay',
          'Document all notification efforts'
        ]
      })
    },
    {
      name: 'Data Breach - Data Exfiltration',
      category: 'security',
      severity_level: 1,
      requires_breach_notification: true,
      notification_deadline_hours: 72,
      description: 'Confirmed theft or unauthorized export of personal data',
      response_template: JSON.stringify({
        immediate_actions: [
          'Block data egress points',
          'Capture network logs',
          'Contact law enforcement if criminal activity suspected'
        ],
        investigation_steps: [
          'Analyze logs to determine what data was exfiltrated',
          'Identify attack vector',
          'Assess impact on individuals'
        ]
      })
    },
    {
      name: 'Ransomware Attack',
      category: 'security',
      severity_level: 1,
      requires_breach_notification: true,
      notification_deadline_hours: 72,
      description: 'Ransomware encryption of systems or data',
      response_template: JSON.stringify({
        immediate_actions: [
          'Isolate infected systems',
          'Do NOT pay ransom',
          'Contact law enforcement',
          'Activate backup recovery procedures'
        ]
      })
    },
    {
      name: 'Unauthorized Access Attempt - Failed',
      category: 'security',
      severity_level: 2,
      requires_breach_notification: false,
      notification_deadline_hours: null,
      description: 'Multiple failed login attempts or access denial',
      response_template: JSON.stringify({
        immediate_actions: [
          'Lock affected accounts',
          'Review access logs',
          'Notify account owners'
        ]
      })
    },
    {
      name: 'Malware Detection',
      category: 'security',
      severity_level: 2,
      requires_breach_notification: false,
      notification_deadline_hours: null,
      description: 'Malware detected on system (no confirmed data access)',
      response_template: JSON.stringify({
        immediate_actions: [
          'Quarantine affected system',
          'Run malware scan',
          'Assess if data was accessed'
        ]
      })
    },
    {
      name: 'Insider Threat - Suspicious Activity',
      category: 'security',
      severity_level: 2,
      requires_breach_notification: false,
      notification_deadline_hours: null,
      description: 'Unusual access patterns by authorized user',
      response_template: JSON.stringify({
        immediate_actions: [
          'Monitor user activity',
          'Review recent access logs',
          'Consult with HR/Legal'
        ]
      })
    },
    {
      name: 'Accidental Data Disclosure',
      category: 'privacy',
      severity_level: 2,
      requires_breach_notification: true,
      notification_deadline_hours: 72,
      description: 'Unintentional exposure of personal data (email misdirection, wrong recipient)',
      response_template: JSON.stringify({
        immediate_actions: [
          'Request deletion/return of data',
          'Assess scope of disclosure',
          'Notify affected individuals'
        ]
      })
    },
    {
      name: 'Data Loss - System Failure',
      category: 'operational',
      severity_level: 3,
      requires_breach_notification: false,
      notification_deadline_hours: null,
      description: 'Data loss due to hardware failure, corruption, or deletion',
      response_template: JSON.stringify({
        immediate_actions: [
          'Initiate backup recovery',
          'Assess data recovery options',
          'Document affected data'
        ]
      })
    },
    {
      name: 'Phishing Attack - User Targeted',
      category: 'security',
      severity_level: 3,
      requires_breach_notification: false,
      notification_deadline_hours: null,
      description: 'Phishing email or social engineering attempt',
      response_template: JSON.stringify({
        immediate_actions: [
          'Block sender',
          'Notify affected users',
          'Check if credentials compromised'
        ]
      })
    },
    {
      name: 'Service Disruption - DDoS',
      category: 'operational',
      severity_level: 2,
      requires_breach_notification: false,
      notification_deadline_hours: null,
      description: 'Denial of service attack affecting availability',
      response_template: JSON.stringify({
        immediate_actions: [
          'Activate DDoS mitigation',
          'Contact ISP/hosting provider',
          'Monitor for data access'
        ]
      })
    },
    {
      name: 'Compliance Violation',
      category: 'compliance',
      severity_level: 3,
      requires_breach_notification: false,
      notification_deadline_hours: null,
      description: 'Violation of regulatory requirements or internal policy',
      response_template: JSON.stringify({
        immediate_actions: [
          'Document the violation',
          'Assess regulatory requirements',
          'Consult legal counsel'
        ]
      })
    },
    {
      name: 'Third-Party Breach',
      category: 'security',
      severity_level: 2,
      requires_breach_notification: true,
      notification_deadline_hours: 72,
      description: 'Data breach at vendor or service provider affecting our data',
      response_template: JSON.stringify({
        immediate_actions: [
          'Contact vendor for details',
          'Assess our data exposure',
          'Determine notification obligations'
        ]
      })
    }
  ]);
  
  console.log('✅ Incident types seeded successfully');
};
