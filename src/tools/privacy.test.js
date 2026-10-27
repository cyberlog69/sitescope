import { describe, it, expect } from 'vitest';
import { auditPrivacyAndConsent } from './privacy.js';

describe('privacy module', () => {
  it('detects Privacy Policy URL, OneTrust CMP, and calculates PASS rating', () => {
    const html = `
      <html>
        <head><script src="https://cdn.cookielaw.org/scripttemplates/otSDKStub.js"></script></head>
        <body>
          <footer><a href="/privacy-policy">Privacy Policy</a></footer>
        </body>
      </html>
    `;

    const result = auditPrivacyAndConsent(html, {}, 'https://example.com');
    expect(result.hasPrivacyPolicy).toBe(true);
    expect(result.privacyPolicyUrl).toBe('https://example.com/privacy-policy');
    expect(result.cmpDetected?.name).toBe('OneTrust');
    expect(result.complianceLevel).toBe('PASS');
    expect(result.complianceScore).toBe(100);
  });

  it('detects third-party trackers without CMP and assigns FAIL rating', () => {
    const html = `
      <html>
        <head>
          <script src="https://www.googletagmanager.com/gtag/js?id=UA-12345"></script>
          <script src="https://connect.facebook.net/en_US/fbevents.js"></script>
        </head>
        <body>No privacy policy here</body>
      </html>
    `;

    const result = auditPrivacyAndConsent(html, {}, 'https://example.com');
    expect(result.hasPrivacyPolicy).toBe(false);
    expect(result.cmpDetected).toBeNull();
    expect(result.thirdPartyTrackers).toContain('Google Analytics');
    expect(result.thirdPartyTrackers).toContain('Meta / Facebook Pixel');
    expect(result.complianceLevel).toBe('FAIL');
    expect(result.complianceScore).toBeLessThan(50);
  });
});
