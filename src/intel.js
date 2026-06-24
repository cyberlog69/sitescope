// intel.js

export async function fetchWhois(domain) {
  const whoisEl = document.getElementById('intelWhois');
  if (!whoisEl) return;
  whoisEl.innerHTML = '<span class="intel-loading">Fetching WHOIS...</span>';
  try {
    const res = await fetch('https://networkcalc.com/api/dns/whois/' + encodeURIComponent(domain));
    const data = await res.json();
    if (data.status === 'OK' && data.whois) {
      const reg = data.whois.registrar || 'Unknown';
      const created = data.whois.creation_date ? new Date(data.whois.creation_date).toLocaleDateString() : 'Unknown';
      whoisEl.innerHTML = `Registrar: ${reg}<br>Created: ${created}`;
    } else {
      whoisEl.innerHTML = 'No WHOIS data found';
    }
  } catch (e) {
    whoisEl.innerHTML = 'Unavailable';
  }
}

export async function fetchHttpHeaders(domain) {
  const headersEl = document.getElementById('intelHeaders');
  if (!headersEl) return;
  headersEl.innerHTML = '<span class="intel-loading">Fetching Headers...</span>';
  try {
    const res = await fetch('https://api.hackertarget.com/httpheaders/?q=' + encodeURIComponent(domain));
    const text = await res.text();
    if (text.includes('error') || text.includes('valid key required')) {
      headersEl.innerHTML = 'Unavailable (API Limit)';
      return;
    }
    
    // Parse the plain text HTTP headers
    const lines = text.split('\\n');
    let importantHeaders = '';
    const lookup = ['server', 'strict-transport-security', 'content-security-policy', 'x-powered-by', 'x-xss-protection'];
    
    lines.forEach(line => {
      const lower = line.toLowerCase();
      if (lookup.some(h => lower.startsWith(h + ':'))) {
        const parts = line.split(':');
        const key = parts[0].trim();
        const val = parts.slice(1).join(':').trim();
        importantHeaders += `<div class="header-line"><strong>${key}:</strong> <span>${val}</span></div>`;
      }
    });

    if (!importantHeaders) {
      headersEl.innerHTML = 'No significant security headers detected.';
    } else {
      headersEl.innerHTML = importantHeaders;
    }
  } catch (e) {
    headersEl.innerHTML = 'Unavailable';
  }
}
