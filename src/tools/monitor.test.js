import { describe, it, expect, beforeEach } from 'vitest';
import { addMonitoredSite, removeMonitoredSite, evaluateAlertConditions } from './monitor.js';

describe('monitor module', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('adds and removes items from watchlist in localStorage', () => {
    let list = addMonitoredSite('https://example.com', 'example.com');
    expect(list.length).toBe(1);
    expect(list[0].domain).toBe('example.com');

    // Deduplicates duplicate URL additions
    list = addMonitoredSite('https://example.com', 'example.com');
    expect(list.length).toBe(1);

    const id = list[0].id;
    list = removeMonitoredSite(id);
    expect(list.length).toBe(0);
  });

  it('evaluates downtime and SSL expiry alert conditions correctly', () => {
    // Transition from UP to DOWN
    const alertsDown = evaluateAlertConditions('up', 'down', 90);
    expect(alertsDown.length).toBe(1);
    expect(alertsDown[0].type).toBe('down');

    // SSL expiring in 15 days
    const alertsSsl = evaluateAlertConditions('up', 'up', 15);
    expect(alertsSsl.length).toBe(1);
    expect(alertsSsl[0].type).toBe('ssl_expiring');

    // Normal healthy site
    const alertsHealthy = evaluateAlertConditions('up', 'up', 120);
    expect(alertsHealthy.length).toBe(0);
  });
});
