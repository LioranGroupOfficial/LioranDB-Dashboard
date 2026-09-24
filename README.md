# LioranDB Managed Database Customer Dashboard & Control Plane

[![Next.js](https://img.shields.io/badge/Next.js-16.3.3-black?logo=next.js)](https://nextjs.org/)
[![React](https://img.shields.io/badge/React-19.2.8-blue?logo=react)](https://react.dev/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.0-blue?logo=typescript)](https://www.typescriptlang.org/)
[![Tailwind CSS](https://img.shields.io/badge/Tailwind_CSS-4.0-38bdf8?logo=tailwind-css)](https://tailwindcss.com/)
[![Razorpay](https://img.shields.io/badge/Razorpay-Payment_Gateway-blue?logo=razorpay)](https://razorpay.com/)
[![MongoDB](https://img.shields.io/badge/MongoDB-Mongoose_9-green?logo=mongodb)](https://mongoosejs.com/)
[![License](https://img.shields.io/badge/License-Proprietary-red)]()

Production Domain: **[`https://app.liorandb.com`](https://app.liorandb.com)**  
Companion Properties:
- Public Website & Marketing: [`https://liorandb.com`](https://liorandb.com)
- Developer Documentation: [`https://docs.liorandb.com`](https://docs.liorandb.com)
- Database Studio: [`https://studio.liorandb.com`](https://studio.liorandb.com)

---

## 1. Product Overview

**LioranDB Managed Database Dashboard** is the dedicated customer control plane for provisioning, scaling, and managing LioranDB managed database instances.

The customer lifecycle follows a strict server-validated flow:

```mermaid
graph TD
    A["1. Signup (Email + Password)"] --> B["2. Email OTP Verification"]
    B --> C["3. ₹100 One-Time Registration Fee (Razorpay)"]
    C --> D["4. Server-Side HMAC SHA256 Verification"]
    D --> E["5. Full Dashboard Access Unlocked"]
    E --> F["6. Deploy Instance (Select Plan & Backups)"]
    F --> G["7. Monthly Razorpay Payment"]
    G --> H["8. Provisioning Pipeline & AES-256 Credentials"]
    H --> I["9. Active Running Cluster & Studio Connection"]
```

---

## 2. Centralized Plans & Pricing (`src/lib/plans.ts`)

All monetary amounts are strictly managed in integer paise internally (`1 INR = 100 paise`) to eliminate floating-point rounding errors:

| Plan Tier | Monthly Price (INR) | Price in Paise | Resource Allocation | Document Guideline | Daily Backup |
|---|---|---|---|---|---|
| **Developer Shared** | ₹299 / mo | `29,900` | Shared vCPU & Shared RAM | Up to 50,000 docs | Optional (+₹500/mo) |
| **Starter Dedicated** | ₹1,499 / mo | `149,900` | 1 vCPU • 1 GB RAM | Up to 100,000 docs | Optional (+₹500/mo) |
| **Growth Dedicated** | ₹2,499 / mo | `249,900` | 2 vCPU • 2 GB RAM | Up to 500,000 docs | **Included** (₹0 extra) |
| **Pro Dedicated** | ₹5,000 / mo | `500,000` | 2 vCPU • 4 GB RAM | Up to 1,000,000 docs | **Included** (₹0 extra) |

- **One-Time Account Registration**: ₹100 (`10,000` paise).
- **Automated Daily Backup Add-on**: ₹500 / month (`50,000` paise) for Developer Shared and Starter Dedicated.

---

## 3. Security & Payment Architecture

### A. Razorpay Integration
- **Zero-Trust Verification**: Browser callbacks are never trusted alone. All transactions require server-side signature verification using HMAC SHA256 (`crypto.createHmac('sha256', secret).update(order_id + '|' + payment_id).digest('hex')`) with constant-time comparison (`crypto.timingSafeEqual`).
- **Idempotent Webhooks & Endpoints**: Duplicate webhooks and retried callbacks are processed idempotently without creating duplicate charges or instances.
- **Client Key Isolation**: Only `NEXT_PUBLIC_RAZORPAY_KEY_ID` is exposed to the client. `RAZORPAY_KEY_SECRET` remains server-side only.

### B. Database Instance Provisioning
- Clean provider abstraction (`LioranProvisioningProvider` and `provisionInstance()`) in `src/lib/providers/provisioning.ts`.
- Database credentials and connection URIs (`mongodb://user:pass@host:port/db`) are encrypted at rest with AES-256-GCM (`iv:tag:ciphertext`).
- Ready for seamless plug-in to cloud infrastructure APIs (AWS/Azure/Bare-metal).

---

## 4. Getting Started & Local Setup

### Prerequisites
- **Node.js**: `v20.x` or later
- **MongoDB**: Local `mongodb://localhost:27017` or Atlas
- **Razorpay Test Keys**: Configured in `.env.local`

### Environment Configuration (`.env.local`)
```env
# Database
MONGODB_URI=mongodb://localhost:27017/liorandb-dashboard

# Session / Authentication (32+ hex characters)
AUTH_SECRET=1945d70c8ddc8b493b48eee719b88ce5b6ca1c7796d96623e573a3429ad37acb

# AES-256-GCM Credential Encryption Key (64 hex characters = 32 bytes)
CREDENTIAL_ENCRYPTION_KEY=ed1a67380d610695b8f63a3371e0ff2d02fe4ffd21e5e84e7c12b3b7eb2fc414

# Razorpay Configuration (Test Mode)
RAZORPAY_KEY_ID=rzp_test_TZcnCUrtz38sxF
RAZORPAY_KEY_SECRET=eUJ4wOl4p5MMRFPO3YD0YPKk
NEXT_PUBLIC_RAZORPAY_KEY_ID=rzp_test_TZcnCUrtz38sxF
RAZORPAY_WEBHOOK_SECRET=liorandb_rzp_webhook_secret_dev_2026

# SMTP (Hostinger / Standard)
SMTP_HOST=smtp.hostinger.com
SMTP_PORT=465
SMTP_SECURE=true
SMTP_USER=liorandb@liorandb.com
SMTP_PASS="Ultron@19#S2008"
SMTP_FROM_NAME=LioranDB
SMTP_FROM_EMAIL=liorandb@liorandb.com

# Initial Admin Seed
SEED_ADMIN_EMAIL=admin@liorandb.com
SEED_ADMIN_PASSWORD=ChangeThisPassword!2026
```

### Installation & Run
```bash
# Install dependencies
npm install

# Run database seeds
npm run seed:dev
npm run seed:admin

# Start development server
npm run dev

# Run automated unit test suite (32 tests across 8 suites)
npm test

# Run TypeScript type check
npm run typecheck

# Production build
npm run build
```

---

## 5. Testing & Verification Checklist

- [x] **Email Signup & OTP Verification**: Customer registers and confirms email code.
- [x] **₹100 Registration Fee Guard**: Customer is guided to `/onboarding/registration` and cannot create instances until verified.
- [x] **Razorpay Checkout**: Seamless test mode checkout with signature verification.
- [x] **Database Deployment Wizard**: 5-step workflow (Name -> Plan selection -> Backups -> Order review -> Razorpay payment -> Provisioning).
- [x] **Provisioning Pipeline**: Transitions instance to `ACTIVE`, creates encrypted credentials, and generates connection URI.
- [x] **Instance Details & Studio Link**: Connection URI copy, resource telemetry, and termination controls.
- [x] **Customer Dashboard & Billing**: Real-time summary cards, subscription renewal dates, and Razorpay transaction ledger.
- [x] **Admin Oversight**: Real-time customer registration statuses, subscriptions, and instance deployments.

---

## 6. License

Proprietary — Copyright © 2026 LioranDB. All Rights Reserved.