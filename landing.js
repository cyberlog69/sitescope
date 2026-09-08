// @ts-check
// landing.js — Interactive Client Logic for SiteScope SaaS Landing Page

document.addEventListener('DOMContentLoaded', () => {
  // ─── 1. Monthly / Annual Billing Toggle ─────────────────────
  const billingToggle = document.getElementById('billingToggle');
  const labelMonthly = document.getElementById('labelMonthly');
  const labelAnnual = document.getElementById('labelAnnual');
  
  const proPriceAmount = document.getElementById('proPrice');
  const entPriceAmount = document.getElementById('entPrice');
  const proPeriod = document.getElementById('proPeriod');
  const entPeriod = document.getElementById('entPeriod');

  let isAnnual = false;

  function setBilling(annual) {
    isAnnual = annual;
    if (billingToggle) {
      billingToggle.classList.toggle('annual', isAnnual);
    }
    if (labelMonthly) labelMonthly.classList.toggle('active', !isAnnual);
    if (labelAnnual) labelAnnual.classList.toggle('active', isAnnual);

    if (proPriceAmount) {
      proPriceAmount.textContent = isAnnual ? '15' : '19';
    }
    if (entPriceAmount) {
      entPriceAmount.textContent = isAnnual ? '65' : '79';
    }
    if (proPeriod) {
      proPeriod.textContent = isAnnual ? '/month (billed annually)' : '/month';
    }
    if (entPeriod) {
      entPeriod.textContent = isAnnual ? '/month (billed annually)' : '/month';
    }
  }

  if (billingToggle) {
    billingToggle.addEventListener('click', () => setBilling(!isAnnual));
  }
  if (labelMonthly) {
    labelMonthly.addEventListener('click', () => setBilling(false));
  }
  if (labelAnnual) {
    labelAnnual.addEventListener('click', () => setBilling(true));
  }

  // ─── 2. FAQ Accordion ───────────────────────────────────────
  const faqItems = document.querySelectorAll('.faq-item');
  faqItems.forEach((item) => {
    const question = item.querySelector('.faq-question');
    if (question) {
      question.addEventListener('click', () => {
        const isOpen = item.classList.contains('open');
        // Close others
        faqItems.forEach((i) => i.classList.remove('open'));
        if (!isOpen) {
          item.classList.add('open');
        }
      });
    }
  });

  // ─── 3. Mobile Navigation Drawer ────────────────────────────
  const mobileToggle = document.getElementById('mobileToggle');
  const navLinks = document.getElementById('navLinks');

  if (mobileToggle && navLinks) {
    mobileToggle.addEventListener('click', () => {
      navLinks.classList.toggle('active');
    });

    // Close nav on link click
    navLinks.querySelectorAll('a').forEach((link) => {
      link.addEventListener('click', () => {
        navLinks.classList.remove('active');
      });
    });
  }

  // ─── 4. Mock Terminal Interactive Demo ──────────────────────
  const sampleDomains = [
    { domain: 'stripe.com', grade: 'A+', vitals: '98', dmarc: 'REJECT', dnssec: 'ACTIVE', threat: '0 SAFE' },
    { domain: 'github.com', grade: 'A', vitals: '95', dmarc: 'REJECT', dnssec: 'ACTIVE', threat: '0 SAFE' },
    { domain: 'vercel.com', grade: 'A+', vitals: '99', dmarc: 'REJECT', dnssec: 'ACTIVE', threat: '0 SAFE' },
    { domain: 'cloudflare.com', grade: 'A+', vitals: '97', dmarc: 'REJECT', dnssec: 'ACTIVE', threat: '0 SAFE' }
  ];

  let sampleIdx = 0;
  const previewDomain = document.getElementById('previewDomain');
  const previewGrade = document.getElementById('previewGrade');
  const previewVitals = document.getElementById('previewVitals');
  const previewDmarc = document.getElementById('previewDmarc');

  if (previewDomain) {
    previewDomain.addEventListener('click', () => {
      sampleIdx = (sampleIdx + 1) % sampleDomains.length;
      const s = sampleDomains[sampleIdx];
      previewDomain.textContent = `https://${s.domain}`;
      if (previewGrade) previewGrade.textContent = s.grade;
      if (previewVitals) previewVitals.textContent = `${s.vitals}/100`;
      if (previewDmarc) previewDmarc.textContent = s.dmarc;
    });
  }
});
