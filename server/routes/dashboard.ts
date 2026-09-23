import { Router } from 'express';
import { sqlite } from '../db/database';

const router = Router();

router.get('/', (_req, res) => {
  try {
    // Stats
    const totalEvents = (sqlite.prepare('SELECT COUNT(*) as c FROM login_events').get() as any).c;
    const criticalAlerts = (sqlite.prepare("SELECT COUNT(*) as c FROM alerts WHERE severity = 'critical' AND status NOT IN ('closed','false_positive')").get() as any).c;
    const openAlerts = (sqlite.prepare("SELECT COUNT(*) as c FROM alerts WHERE status NOT IN ('closed','false_positive')").get() as any).c;
    const activeInvestigations = (sqlite.prepare("SELECT COUNT(*) as c FROM cases WHERE status IN ('investigating','triaging','contained')").get() as any).c;
    const highRiskUsers = (sqlite.prepare("SELECT COUNT(*) as c FROM users WHERE risk_level IN ('critical','high')").get() as any).c;
    const openCases = (sqlite.prepare("SELECT COUNT(*) as c FROM cases WHERE status NOT IN ('resolved','false_positive')").get() as any).c;
    const confirmedThreats = (sqlite.prepare("SELECT COUNT(*) as c FROM cases WHERE status = 'resolved' AND resolution IS NOT NULL AND false_positive_reason IS NULL").get() as any).c;
    const falsePositives = (sqlite.prepare("SELECT COUNT(*) as c FROM cases WHERE status = 'false_positive'").get() as any).c;

    // Core Parameter Metrics
    const vpnDetectedCount = (sqlite.prepare("SELECT COUNT(*) as c FROM login_events WHERE is_vpn = 1 OR vpn_detected = 'detected'").get() as any).c;
    const unusualLocationCount = (sqlite.prepare("SELECT COUNT(*) as c FROM login_events WHERE is_new_country = 1 OR is_new_city = 1").get() as any).c;
    const outsideWindowCount = (sqlite.prepare("SELECT COUNT(*) as c FROM login_events WHERE signals LIKE '%odd_hour%' OR signals LIKE '%Unusual Login Time%'").get() as any).c;
    const newIpCount = (sqlite.prepare("SELECT COUNT(*) as c FROM login_events WHERE signals LIKE '%new_ip%' OR signals LIKE '%New IP Address%'").get() as any).c;

    // Recent critical alerts
    const recentAlerts = sqlite.prepare(`
      SELECT a.*, u.name as user_name, u.email as user_email, u.department, u.avatar_color
      FROM alerts a
      JOIN users u ON a.user_id = u.id
      WHERE a.status NOT IN ('closed','false_positive')
      ORDER BY a.risk_score DESC, a.last_seen DESC
      LIMIT 10
    `).all();

    // Top risky users
    const topRiskyUsers = sqlite.prepare(`
      SELECT id, name, email, department, role, current_risk, risk_level, risk_trend, avatar_color, last_login
      FROM users WHERE current_risk > 20
      ORDER BY current_risk DESC LIMIT 8
    `).all();

    // Recent events (live feed)
    const recentEvents = sqlite.prepare(`
      SELECT e.*, u.name as user_name, u.avatar_color
      FROM login_events e
      JOIN users u ON e.user_id = u.id
      ORDER BY e.timestamp DESC LIMIT 20
    `).all();

    // Risk level distribution
    const riskDist = sqlite.prepare(`
      SELECT risk_level, COUNT(*) as count FROM login_events GROUP BY risk_level
    `).all();

    // Events per day (last 7 days)
    const eventsPerDay = sqlite.prepare(`
      SELECT date(timestamp) as date, COUNT(*) as total,
        SUM(CASE WHEN result = 'success' THEN 1 ELSE 0 END) as successes,
        SUM(CASE WHEN result = 'failure' THEN 1 ELSE 0 END) as failures,
        SUM(CASE WHEN risk_level = 'critical' THEN 1 ELSE 0 END) as critical
      FROM login_events
      WHERE timestamp >= datetime('now', '-7 days')
      GROUP BY date(timestamp)
      ORDER BY date ASC
    `).all();

    // Alert severity breakdown
    const alertSeverity = sqlite.prepare(`
      SELECT severity, COUNT(*) as count FROM alerts
      WHERE status NOT IN ('false_positive')
      GROUP BY severity
    `).all();

    // Geographic heatmap data
    const geoData = sqlite.prepare(`
      SELECT country, city, lat, lng, COUNT(*) as count,
        AVG(risk_score) as avg_risk,
        SUM(CASE WHEN risk_level = 'critical' THEN 1 ELSE 0 END) as critical_count
      FROM login_events
      WHERE lat IS NOT NULL AND lng IS NOT NULL
      GROUP BY country, city
      ORDER BY count DESC LIMIT 30
    `).all();

    // Detection signals frequency
    const allSignals = sqlite.prepare("SELECT signals FROM login_events WHERE signals IS NOT NULL AND signals != '[]'").all() as any[];
    const signalFreq: Record<string, number> = {};
    for (const row of allSignals) {
      try {
        const sigs = JSON.parse(row.signals);
        for (const sig of sigs) {
          signalFreq[sig.name] = (signalFreq[sig.name] ?? 0) + 1;
        }
      } catch { /* skip */ }
    }

    res.json({
      stats: {
        totalEvents,
        todayEvents: totalEvents,
        criticalAlerts,
        openAlerts,
        activeInvestigations,
        highRiskUsers,
        openCases,
        confirmedThreats,
        falsePositives,
        vpnDetectedCount,
        unusualLocationCount,
        outsideWindowCount,
        newIpCount,
      },
      recentAlerts: recentAlerts.map(parseJsonFields(['signals', 'related_event_ids'])),
      topRiskyUsers: topRiskyUsers.map(parseJsonFields(['risk_trend', 'known_countries', 'known_cities'])),
      recentEvents: recentEvents.map(parseJsonFields(['signals'])),
      riskDistribution: riskDist,
      eventsPerDay,
      alertSeverity,
      geoData,
      signalFrequency: Object.entries(signalFreq)
        .sort(([, a], [, b]) => b - a)
        .slice(0, 10)
        .map(([name, count]) => ({ name, count })),
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

function parseJsonFields(fields: string[]) {
  return (row: any) => {
    const result = { ...row };
    for (const field of fields) {
      if (typeof result[field] === 'string') {
        try { result[field] = JSON.parse(result[field]); } catch { /* keep raw */ }
      }
    }
    return result;
  };
}

export default router;
