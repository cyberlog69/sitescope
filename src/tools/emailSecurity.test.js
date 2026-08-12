import { describe, it, expect } from 'vitest';
import { parseDmarcRecord, parseSpfRecord, identifyMailProvider, auditEmailSecurity } from './emailSecurity.js';

describe('emailSecurity module', () => {
  it('parses strict DMARC, SPF, and BIMI records correctly and grades A+', () => {
    const dnsData = {
      dmarcTxt: 'v=DMARC1; p=reject; rua=mailto:dmarc@example.com; pct=100; adkim=s; aspf=s;',
      spfTxt: 'v=spf1 include:_spf.google.com include:sendgrid.net -all',
      mx: ['aspmx.l.google.com', 'alt1.aspmx.l.google.com'],
      bimiTxt: 'v=BIMI1; l=https://example.com/logo.svg; a=https://example.com/cert.pem;',
      mtaStsTxt: 'v=STSv1; id=20260101;',
      dnssecAd: true
    };

    const res = auditEmailSecurity(dnsData, 'example.com');
    expect(res.dmarc.policy).toBe('reject');
    expect(res.dmarc.present).toBe(true);
    expect(res.spf.qualifier).toBe('-all');
    expect(res.spf.lookupCountEstimate).toBe(2);
    expect(res.mailProvider).toContain('Google Workspace');
    expect(res.dnssec.enabled).toBe(true);
    expect(res.bimi.hasVmc).toBe(true);
    expect(res.spoofingRiskScore).toBeLessThanOrEqual(5);
    expect(res.authGrade).toBe('A+');
  });

  it('detects insecure/missing DMARC and permissive SPF and assigns high spoofing risk', () => {
    const dnsData = {
      dmarcTxt: null,
      spfTxt: 'v=spf1 +all',
      mx: [],
      dnssecAd: false
    };

    const res = auditEmailSecurity(dnsData, 'vulnerable-site.com');
    expect(res.dmarc.policy).toBe('missing');
    expect(res.spf.qualifier).toBe('+all');
    expect(res.spoofingRiskScore).toBeGreaterThanOrEqual(70);
    expect(['D', 'F']).toContain(res.authGrade);
    expect(res.checklist.some((c) => c.severity === 'critical')).toBe(true);
  });

  it('identifies Microsoft 365 mail servers correctly', () => {
    const provider = identifyMailProvider(['contoso-com.mail.protection.outlook.com']);
    expect(provider).toContain('Microsoft 365');
  });
});
