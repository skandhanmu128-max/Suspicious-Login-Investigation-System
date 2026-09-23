# 🛡️ SentinelTrace

> **Real-World SOC-Style Suspicious Authentication Detection, Correlation & Incident Investigation Platform**

[![Node.js Version](https://img.shields.io/badge/node-%3E%3D20.0.0-brightgreen.svg)](https://nodejs.org/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.4-blue.svg)](https://www.typescriptlang.org/)
[![React](https://img.shields.io/badge/React-18.3-61dafb.svg)](https://react.dev/)
[![Express](https://img.shields.io/badge/Express-4.18-lightgrey.svg)](https://expressjs.com/)
[![SQLite](https://img.shields.io/badge/SQLite-WAL%20Mode-003B57.svg)](https://www.sqlite.org/)
[![License](https://img.shields.io/badge/License-MIT-purple.svg)](LICENSE)

---

## 📌 Executive Overview

**SentinelTrace** is an autonomous, full-stack Security Operations Center (SOC) investigation platform engineered to ingest corporate authentication telemetry, identify behavioral anomalies, correlate multi-stage adversary storylines, and empower security analysts with structured investigation workflows.

Unlike standard dashboards that display basic logins and arbitrary risk numbers, **SentinelTrace thinks like a cybersecurity product engineer**:
- **Why was this flagged?**: Every score is supported by transparent, plain-English security evidence breakdowns and weighted behavioral signals.
- **Four Core Investigation Parameters**: Anchors every investigation around the 4 essential SOC telemetry dimensions: **IP Address**, **Location**, **Login Window / Timeline**, and **VPN Detection**.
- **UEBA Behavioral Baselines**: Learns dynamic 30-day user profiles (typical working hours, trusted device fingerprints, known geolocations, failure frequency).
- **Correlation Engine**: Automatically aggregates disjointed telemetry events into high-confidence attack dockets.
- **Incident Response Controls**: Enables one-click SOC containment actions (*Lock Identity, Enforce Step-Up MFA, Terminate Sessions*).
- **Adversary Threat Simulator**: Includes an interactive replay studio with 8 MITRE ATT&CK adversary scenarios and core parameter test harnesses.

---

## 🏛️ Architecture & Security Engine

```
                             ┌───────────────────────────────────────┐
                             │       AUTHENTICATION TELEMETRY        │
                             │  (IP, Geo, Device, Headers, Result)   │
                             └───────────────────┬───────────────────┘
                                                 │
                        ┌────────────────────────┴────────────────────────┐
                        ▼                                                 ▼
        ┌───────────────────────────────┐                 ┌───────────────────────────────┐
        │       UEBA ENGINE             │                 │   THREAT INTEL ENRICHMENT     │
        │ • 30-Day Working Hours        │                 │ • Tor Exit Node Database      │
        │ • Known Device Fingerprints   │                 │ • VPN / Commercial Proxy      │
        │ • Typical Countries & Cities  │                 │ • IP Reputation Feed          │
        │ • Historical Failure Rate     │                 │ • Geolocation Coordinates     │
        └───────────────┬───────────────┘                 └───────────────┬───────────────┘
                        │                                                 │
                        └────────────────────────┬────────────────────────┘
                                                 │
                                                 ▼
                             ┌───────────────────────────────────────┐
                             │       ALGORITHMIC RISK ENGINE         │
                             │ • Geodetic Velocity (Haversine km/h)  │
                             │ • Brute Force / Credential Stuffing   │
                             │ • Unrecognized Client / OS Drift      │
                             │ • Dynamic Scoring & Confidence (0-100)│
                             └───────────────────┬───────────────────┘
                                                 │
                                                 ▼
                             ┌───────────────────────────────────────┐
                             │          CORRELATION ENGINE           │
                             │  Aggregates multi-event attack chains │
                             │  Opens prioritized SOC case dockets  │
                             └───────────────────┬───────────────────┘
                                                 │
                        ┌────────────────────────┴────────────────────────┐
                        ▼                                                 ▼
        ┌───────────────────────────────┐                 ┌───────────────────────────────┐
        │       SOC ALERT QUEUE         │                 │    INVESTIGATION DOCKETS      │
        │ Prioritized triage, signal    │                 │ Timeline, Evidence Review,    │
        │ explainers & threat mapping   │                 │ Containment, Forensic Reports │
        └───────────────────────────────┘                 └───────────────────────────────┘
```

---

## 🎯 The Four Core Login Investigation Parameters

Every suspicious authentication investigation in SentinelTrace is grounded in **Four Core Telemetry Parameters**:

| # | Parameter | What is Evaluated | Baseline Context | Anomaly Statuses | Scoring Weight |
|---|---|---|---|---|---|
| **1** | **IP Address** | Current ingress IP, Autonomous System (ASN), ISP, and IP reputation | Compared against User's historical trusted IP list | `KNOWN` / `NEW IP` / `SUSPICIOUS` | +8 pts |
| **2** | **Location** | Geolocation (Country, City, Lat/Lng) and geodetic travel velocity | Compared against baseline countries and previous login coordinates | `KNOWN` / `UNUSUAL LOCATION` / `IMPOSSIBLE TRAVEL` | +20 pts (country) / +40 pts (velocity) |
| **3** | **Login Window / Timeline** | Hour of authentication, day of week, timestamp delta from previous login | Compared against 30-day working hours profile (e.g. `08:00 AM – 10:00 PM`) | `NORMAL` / `OUTSIDE NORMAL WINDOW` / `INSUFFICIENT DATA` | +10 pts |
| **4** | **VPN Detection** | VPN endpoint recognition, anonymization provider (e.g., NordSec Ltd), Tor/Proxy flags | Evaluated as an **investigation signal**, NOT automatic compromise | `DETECTED` / `NOT DETECTED` / `UNKNOWN` | +10 pts |

### 💡 SOC Engineering Principle: VPN as an Investigation Signal
In modern enterprise environments, legitimate remote workers use corporate and commercial VPNs daily. Treating a VPN login as an automatic compromise leads to crippling alert fatigue. SentinelTrace scores a VPN login alone as **Low Risk (10 pts)**. It only escalates to **High or Critical** severity when corroborated by anomalies across the other three core parameters (e.g., New IP + Moscow Location + 02:49 AM Outside Login Window).

### 🧪 Standard Benchmark: User `U101` Synthetic Test Cases
The platform comes pre-seeded with identity `U101` (Aarav Patel, Lead DevOps Engineer) establishing the following benchmark cases:
- **Established Baseline**:
  - Usual IP: `103.21.45.10` (ACT Corp Gateway, Bengaluru, IN)
  - Usual Location: `Bengaluru, India` (12.9716° N, 77.5946° E)
  - Typical Login Window: `08:00 AM – 10:00 PM IST`
  - Typical VPN Status: `NOT DETECTED`
- **Benchmark Test Suite**:
  1. **TC-1: Clean Login** — `103.21.45.10`, Bengaluru, 10:15 AM, VPN: Not Detected ➔ **Risk: 0 (SAFE)**
  2. **TC-2: VPN Alone** — `103.21.45.50`, Bengaluru, 02:30 PM, VPN: Detected ➔ **Risk: 10 (SAFE/LOW)** *(Investigation signal only)*
  3. **TC-3: VPN + Location + Odd Hour** — `185.22.91.44`, Moscow, 02:49 AM, VPN: Detected (NordSec) ➔ **Risk: 48 (SUSPICIOUS)**
  4. **TC-4: VPN + New IP + Location + Odd Hour (Corroborated)** — `185.22.91.44`, Moscow, 02:49 AM, New IP, New Country, Odd Hour, VPN ➔ **Risk: 48–74 (HIGH)** *(Auto-opens Case `CASE-0007`)*

---

## ✨ Key Platform Features

### 1. ⬡ SOC Dashboard (`/`)
- **Key Defense Metrics**: Real-time counters for Critical Alerts, High-Risk Accounts, Active Investigations, and 24-Hour Authentication Volume.
- **Authentication Trends**: 7-day daily login volume and critical anomaly trajectory.
- **Top Detection Signals**: Frequency distribution across Impossible Travel, Tor nodes, Brute Force, and Behavioral Deviations.
- **Live Ingestion Feed**: Real-time event streaming with severity indicators.

### 2. ⚠ Alert Queue & Explainability (`/alerts` & `/alerts/:id`)
- **Severity-Ordered Triage**: Filter by status (*Open, In Triage, Resolved, False Positive*) and risk tiers (*Critical, High, Suspicious, Safe*).
- **"Why Was This Flagged?" Engine**: Detailed explainability pane showing exact signal contributions, point penalties, and corroborating evidence.
- **One-Click Case Escalation**: Convert any alert directly into a formal security investigation docket.

### 3. 🗂 Investigation Cases (`/cases` & `/cases/:id`)
- **Lifecycle Management**: Structured SOC docket workflow (*New ➔ Triaging ➔ Investigating ➔ Contained ➔ Resolved*).
- **Baseline vs Anomaly Diff**: Side-by-side comparison of user's typical profile against anomalous attributes observed during the incident.
- **Interactive Multi-Tab Workspace**:
  - **Telemetry Timeline**: Chronological event progression with raw network attributes.
  - **Forensic Evidence Review**: Verification checklist for IPs, device hashes, and velocity calculations.
  - **Analyst Notes & Audit Log**: Immutable record of actions taken, containment timestamps, and hypotheses.

### 4. ⚡ Authentication Telemetry Log (`/events`)
- Complete searchable and filterable event stream with auto-refresh (5s).
- **Telemetry Inspection Drawer**: Raw IP reputation, ASN, ISP, VPN/Tor/Proxy flags, user-agent parsing, device fingerprinting, and risk score breakdown.

### 5. 👤 Identity & UEBA Profiles (`/users` & `/users/:id`)
- Monitored directory of enterprise accounts with risk gauges, department filters, and failure rates.
- **Identity Dossier**: 30-day risk trend trajectory and historical authentications.
- **Active SOC Containment Actions**:
  - `⊘ Terminate Sessions`: Invalidate all active refresh tokens.
  - `🔐 Require MFA`: Force immediate step-up multi-factor challenge.
  - `🔒 Lock Identity`: Temporarily disable account access pending investigation.

### 6. 🌐 Global Threat Map (`/map`)
- **Radar Matrix Visualizer**: High-tech SVG map plotting worldwide authentication ingress nodes.
- **Animated Impossible Travel Arcs**: Visualizes geographic velocity violations between consecutive logins with speed callouts (e.g. `7,240 km/h · 28 min delta`).
- **Origin Analytics**: Breakdown of top source countries and ingress volumes.

### 7. 🎭 Adversary Threat Simulator (`/simulator`)
- Interactive studio to inject 8 real-world attack scenarios into the live SOC pipeline:
  1. **Impossible Travel**: Rapid cross-continental access (e.g., Bengaluru ➔ Frankfurt in 28 min).
  2. **Brute Force ➔ Account Compromise**: 8 consecutive password failures culminating in success.
  3. **Password Spraying**: Distributed authentication attempts against multiple corporate identities.
  4. **Session Hijacking / Cookie Theft**: Abrupt device/IP switch on an existing valid session.
  5. **Credential Stuffing**: High-velocity automated hits across multiple accounts.
  6. **Off-Hours Privilege Escalation**: 3:00 AM administrative access from an unverified client.
  7. **New Device + Geofence Breach**: Access from a non-business country on an unknown machine.
  8. **Fast Lateral Token Abuse**: Token reuse across distributed network origins.
- **Attack Replay Player**: Step-by-step playback player with real-time risk gauges and MITRE ATT&CK mapping.

### 8. 📄 Forensic Reports & Dossiers (`/reports`)
- Executive incident review dossiers and post-incident compliance reports.
- Formatted with print/PDF styling including forensic artifacts, attack timeline, analyst containment notes, and sign-off blocks.

### 9. ⚙ Detection Engine Settings (`/settings`)
- Fine-tune risk thresholds (*Safe Ceiling, Suspicious Ceiling, High Risk Ceiling*).
- Calibrate individual behavioral signal scoring weights (*Impossible Travel, Tor Node, Brute Force, New Country, Odd Hours*).

---

---

## 📱 Mobile-Friendly SOC & Remote Incident Response

SentinelTrace is fully responsive and optimized for remote security triage from **smartphones (Android, iPhone)**, **tablets (iPad, Android tablets)**, and **desktop workstations**:

- **Touch-Friendly Ergonomics**: 44px+ touch targets, swipe-friendly layouts, and card-based metrics.
- **Mobile Navigation Bar**: Fixed bottom navigation bar with instant access to `Dashboard`, `Alerts`, `Cases`, `Events`, and `Menu`.
- **Slide-Out Mobile Drawer**: Drawer navigation displaying identity status, system health, and one-click SOC navigation links.
- **Remote Outbox Notifications**: Direct access to real-time mobile push, email, and webhook alerts from the notification bell.

---

## 🔐 Authentication, Session Security & RBAC

SentinelTrace implements an enterprise security architecture ensuring protected access to security telemetry:

### 1. Cryptographic Authentication
- **Salted `scrypt` Hashing**: All passwords are encrypted with individual cryptographic salts and high-cost `scrypt` derivation (`server/security/auth.ts`). No plaintext passwords are ever persisted.
- **Stateful 24h Bearer Sessions**: Authenticated users receive a secure random hex bearer token mapped to `soc_sessions` with 24-hour expiration, client IP binding, and user-agent tracking.
- **Protected Routes**: React router is wrapped in an `AuthProvider` and `ProtectedRoute` barrier, automatically redirecting unauthenticated traffic to `/login`.

### 2. Role-Based Access Control (RBAC) Matrix

| SOC Role | Capabilities & Permissions | UI & API Enforcement |
|---|---|---|
| **`ANALYST`** | • Triage and filter alerts<br>• Investigate incident dockets<br>• Submit True/False Positive feedback<br>• Add investigation notes<br>• View identities and telemetry | Restricted from sensitive containment actions. Attempts to invoke admin endpoints return `403 Forbidden`. |
| **`ADMIN`** | • All Analyst permissions<br>• Lock/Unlock user identities<br>• Terminate active sessions<br>• Enforce Step-Up MFA<br>• Calibrate risk engine settings & thresholds<br>• Reset simulation demo dataset | Full platform administrative privileges. Action buttons dynamically unlocked. |

### 3. Pre-Seeded Demo Credentials
| Role | Email | Password | Quick Login |
|---|---|---|---|
| **Admin** | `admin@sentineltrace.io` | `Admin@Sentinel2026!` | 1-Click "👑 Demo Admin" button on `/login` |
| **Analyst** | `analyst@sentineltrace.io` | `Analyst@Sentinel2026!` | 1-Click "🛡 Demo Analyst" button on `/login` |

---

## 🔄 Continuous In-Session Monitoring & Department Peer Baselines

Threat detection does not end at login. SentinelTrace monitors post-authentication activity in real-time (`server/security/sessionMonitoring.ts`):

1. **Active Telemetry Ingestion (`POST /api/events/session-activity`)**:
   - Ingests in-session metrics: request frequency (`requestsPerMinute`), session duration (`sessionDurationMinutes`), resource accessed, and HTTP payload actions.
2. **Department Peer Group Behavioral Baselines**:
   - Every identity is benchmarked against department baseline profiles:
     - **Finance**: Typical max 45 req/min, 180 min session max, sensitive endpoints: `/api/finance`, `/api/payroll`, `/api/payments`.
     - **Engineering**: Typical max 120 req/min, 480 min session max, sensitive endpoints: `/api/admin`, `/api/production`, `/api/deploy`, `/api/credentials`.
     - **Sales / Marketing / Executive / Core Infrastructure**: Tailored baselines according to organizational behavior.
3. **Session Anomaly Detection & Correlated Escalation**:
   - Detects **Spike in Request Rate** (+35 risk pts if >2.5x peer average).
   - Detects **Abnormal Session Duration** (+20 risk pts if >2x peer average).
   - Detects **Unusual Sensitive Resource Access** (+30 risk pts when accessing restricted peer paths).
   - Scores $\ge 50$ automatically create an Alert and correlate into an Incident Docket.

---

## 📝 Analyst Feedback & Model Tuning

To prevent alert fatigue and enable continuous detection refinement, SOC analysts can record ground-truth determinations:
- **Available Verifications**: `True Positive`, `False Positive`, `Under Investigation`, `Resolved`.
- **Feedback Snapshot**: Records analyst ID, timestamp, verdict, notes, and a frozen JSON snapshot of the risk signals.
- **REST Endpoints**: `POST /api/alerts/:id/feedback` and `POST /api/cases/:id/feedback`.

---

## 📡 Remote Incident Notifications Outbox

SentinelTrace features a modular multi-channel remote dispatch system (`server/security/notificationService.ts`):
- **Channels Supported**: `push` (Mobile Push), `email` (Urgent SOC Email), `webhook` (Slack / PagerDuty / SIEM).
- **Automated Dispatch**: Dispatched on all `CRITICAL` and `HIGH` security incidents.
- **Outbox Store**: Stored in `remote_notifications` table in SQLite for auditing and mobile review via the UI notification bell drawer.
- **REST Endpoints**:
  - `GET /api/notifications/remote` — Fetch recent remote dispatches.
  - `POST /api/notifications/test-remote` — Test dispatch a synthetic notification.

---

## 🧪 Testing & Verification

SentinelTrace includes comprehensive automated test suites covering both the Algorithmic Risk Engine and the new Mobile/Auth/RBAC/Session-Monitoring stack:

### 1. Risk Engine Unit Tests
```bash
cd server
npx tsx security/riskEngine.test.ts
```

### 2. Mobile, Auth, RBAC & In-Session Monitoring Integration Tests
```bash
cd server
npx tsx test-mobile-auth-rbac.ts
```

**Expected Integration Test Output**:
```text
🧪 Starting SentinelTrace Mobile, Auth, RBAC & Session Monitoring Test Suite...

[Auth & Password Hashing]
✅ PASSED: Password hashed with salt
✅ PASSED: Valid password verified
✅ PASSED: Invalid password rejected

[Session Creation & Validation]
✅ PASSED: Session created with token
✅ PASSED: Session resolved to user
✅ PASSED: Session revoked successfully

[RBAC Verification]
✅ PASSED: Admin permitted on admin endpoint
✅ PASSED: Analyst forbidden on admin endpoint (403)

[Continuous In-Session Monitoring & Baselines]
✅ PASSED: Normal engineering activity is safe (Risk: 0)
✅ PASSED: High-frequency request spike flagged (Risk: 65)
✅ PASSED: Sensitive resource access anomaly flagged (Risk: 65)

[Analyst Feedback Logging]
✅ PASSED: Feedback recorded in database
✅ PASSED: Feedback linked to target alert

[Remote Notification Dispatch]
✅ PASSED: Remote notification logged in outbox
✅ PASSED: Outbox notification details match payload

🎉 All 24 Mobile, Auth, RBAC & Session Monitoring tests passed successfully!
```

To verify the client production build:
```bash
cd client
npx vite build
```

---

## 📡 REST API Reference

| Method | Endpoint | Description |
|---|---|---|
| `POST`| `/api/auth/login` | Authenticate SOC user credentials, returns bearer session token & role |
| `POST`| `/api/auth/logout`| Invalidate current bearer session token |
| `GET` | `/api/auth/me` | Fetch active authenticated user profile and permissions |
| `GET` | `/api/dashboard` | Aggregated SOC statistics, 7-day trend, top signals, active alerts |
| `GET` | `/api/events` | Paginated authentication telemetry stream (filters: `userId`, `riskLevel`, `result`, `search`) |
| `GET` | `/api/events/:id` | Full inspection of single authentication event |
| `POST`| `/api/events/session-activity` | Ingest post-login session telemetry (rate, duration, sensitive resources) |
| `GET` | `/api/events/session-activity/recent` | Recent continuous in-session events |
| `GET` | `/api/alerts` | Alert queue (filters: `severity`, `status`, `userId`) |
| `GET` | `/api/alerts/:id` | Alert detail with risk signal explanations |
| `PATCH`| `/api/alerts/:id` | Update alert triage status |
| `POST`| `/api/alerts/:id/feedback` | Submit analyst ground-truth verdict (`true_positive`, `false_positive`, etc.) |
| `GET` | `/api/cases` | Security incident dockets |
| `POST`| `/api/cases` | Open new manual investigation docket |
| `GET` | `/api/cases/:id` | Full case workspace with timeline, evidence, notes |
| `PATCH`| `/api/cases/:id` | Update case status or resolution |
| `POST`| `/api/cases/:id/notes` | Add analyst investigation note |
| `POST`| `/api/cases/:id/feedback` | Submit analyst ground-truth verdict on investigation docket |
| `GET` | `/api/users` | Directory of monitored enterprise identities |
| `GET` | `/api/users/:id` | Identity profile, UEBA baseline, risk progression |
| `GET` | `/api/notifications/remote` | Fetch remote incident notification outbox (`push`, `email`, `webhook`) |
| `POST`| `/api/notifications/test-remote` | Dispatch synthetic test notification to outbox |
| `GET` | `/api/simulator/scenarios`| List all 8 adversary attack storylines |
| `POST`| `/api/simulator/run` | Execute attack simulation into live database |
| `POST`| `/api/simulator/reset` | Restore clean baseline demo dataset *(Requires ADMIN role)* |
| `GET` | `/api/reports/:caseId` | Generate forensic incident dossier |
| `GET` | `/api/settings` | Retrieve current detection thresholds and weights |
| `PATCH`| `/api/settings` | Update risk scoring thresholds and parameters *(Requires ADMIN role)* |
| `GET` | `/api/health` | Service health status check |

---

## 📁 Repository Structure

```text
login/
├── client/                     # Frontend Application (React + TypeScript + Vite)
│   ├── src/
│   │   ├── components/
│   │   │   └── layout/         # SOCLayout, Mobile Drawer, Bottom Nav, Notifications
│   │   ├── context/            # AuthContext (Role, Session Token, User State)
│   │   ├── pages/
│   │   │   ├── Login.tsx       # Secure Login & 1-Click Quick Demo Switcher
│   │   │   ├── Dashboard.tsx   # SOC Overview & Threat Metrics
│   │   │   ├── Alerts.tsx      # Prioritized Alert Queue & Triage
│   │   │   ├── AlertDetail.tsx # Explainability, Signal Pane & Analyst Feedback
│   │   │   ├── Cases.tsx       # Investigation Dockets List & Creation
│   │   │   ├── CaseDetail.tsx  # Investigation Workspace, Baseline Diff & Feedback
│   │   │   ├── Events.tsx      # Real-Time Telemetry Stream & Drawer
│   │   │   ├── Users.tsx       # Identity Behavioral Directory
│   │   │   ├── UserDetail.tsx  # Profile, RBAC Guarded Containment Actions
│   │   │   ├── ThreatMap.tsx   # Global Threat Radar & Impossible Travel
│   │   │   ├── Simulator.tsx   # Adversary Attack Replay Studio
│   │   │   ├── Reports.tsx     # Forensic Incident Dossier & Print
│   │   │   └── Settings.tsx    # Engine Calibration & Thresholds (Admin only)
│   │   ├── services/           # API Client Service Layer (Bearer Injection)
│   │   ├── lib/                # Formatting, Utilities, Date Helpers
│   │   ├── types/              # Unified TypeScript Security & Session Models
│   │   ├── App.tsx             # Protected Route Configuration
│   │   └── main.tsx            # Application Entry Point
│   └── vite.config.ts          # Vite Configuration & Backend Proxy
│
├── server/                     # Backend API & Security Engine (Express + TypeScript)
│   ├── db/
│   │   ├── database.ts         # SQLite Initialization (WAL Mode) & Schema Migrations
│   │   ├── schema.ts           # Drizzle Schema (soc_users, soc_sessions, feedback, outbox)
│   │   └── seed.ts             # Users, Telemetry, Alerts, Cases, SOC Users
│   ├── routes/                 # Express API Endpoints (auth, events, alerts, cases, etc.)
│   ├── security/
│   │   ├── auth.ts             # Salted scrypt Hashing, Session Tokens, RBAC Guards
│   │   ├── sessionMonitoring.ts# Continuous In-Session Telemetry & Peer Baselines
│   │   ├── notificationService.ts # Remote Push / Email / Webhook Outbox Dispatcher
│   │   ├── riskEngine.ts       # Algorithmic Risk Scorer & Signal Generator
│   │   ├── behaviorEngine.ts   # UEBA Anomaly Detection
│   │   ├── correlationEngine.ts# Multi-Event Attack Storyline Correlator
│   │   ├── threatIntel.ts      # Tor/VPN & IP Reputation Lookups
│   │   ├── geoService.ts       # Geodetic Velocity & Haversine Distance
│   │   ├── simulationEngine.ts # 8 Adversary Attack Scenario Generators
│   │   └── riskEngine.test.ts  # Automated Security Engine Test Suite
│   ├── test-mobile-auth-rbac.ts# 24-Assertion Mobile/Auth/RBAC Integration Suite
│   └── index.ts                # Server Entry Point & Middleware
│
├── package.json                # Monorepo Scripts (concurrently)
└── README.md                   # Platform Documentation
```
└── README.md                   # Platform Documentation
```

---

## 🔒 Security & Privacy Notice
All telemetry, IP addresses, user profiles, and threat storylines provided in this platform are **synthetic demonstration data** generated for educational, SOC training, and detection engineering research purposes.

---

## 📄 License
This project is licensed under the MIT License — see the [LICENSE](LICENSE) file for details.
