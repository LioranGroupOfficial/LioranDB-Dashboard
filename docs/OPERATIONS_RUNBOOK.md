# LioranDB Managed Hosting — Operations Runbook

**Audience:** Site Reliability Engineers, Support Engineers, and System Administrators  
**Production Control Plane:** `https://app.liorandb.com/admin`

---

## 1. Application Review & Onboarding SOP

### Objective
Ensure every managed hosting customer meets workload criteria, performance benchmarks, and compliance requirements before provisioning infrastructure.

### Procedure
1. Navigate to **Admin Panel → Applications** (`/admin/applications`).
2. Select an application in `SUBMITTED` or `UNDER_REVIEW` status.
3. Verify workload parameters:
   - **Pricing Comfort:** Ensure customer acknowledged the ₹5,000/mo fee.
   - **Workload Profile:** Check estimated document count, read/write ops, and storage sizing.
   - **Legitimacy:** Verify company website and contact credentials.
4. Make Decision:
   - **Approve:** Select **Approve Application**. The system automatically transitions the user to `APPLICATION_APPROVED`, triggers an approval email, and directs them to legal terms acceptance.
   - **Reject:** Select **Reject Application** and enter a clear **Rejection Reason** (e.g. *Incompatible workload profile or insufficient information provided*).

---

## 2. Database Provisioning Workflow

### Objective
Configure and deploy a managed database instance for a customer who has accepted all legal terms.

### Procedure
1. Navigate to **Admin Panel → Provisioning** (`/admin/provisioning`).
2. Locate the customer in the **Ready for Provisioning** queue.
3. Click **Provision Database →**.
4. Configure instance parameters:
   - **Deployment Display Name:** e.g. `Acme Production DB`
   - **Host Domain:** e.g. `acme.managed.liorandb.com`
   - **Port:** `27017` (default)
   - **Database Name:** e.g. `acme_prod`
   - **Admin Username:** e.g. `acme_admin`
   - **Temporary Password:** Leave blank to auto-generate a 24-character cryptographic password.
   - **Expiry:** Default 7 days.
5. Click **Confirm & Deploy**.
6. The system encrypts the connection URI with AES-256-GCM, transitions customer onboarding stage to `ACTIVE`, creates a subscription record, and emails the connection parameters to the user.

---

## 3. Billing & Offline Payment Recording

### Objective
Maintain accurate subscription statuses and record manual bank/UPI payments.

### Procedure
1. Navigate to **Admin Panel → Billing** (`/admin/billing`).
2. Locate the customer's subscription.
3. Click **Record Payment**.
4. Enter:
   - **Amount & Currency:** Standard ₹5,000 INR.
   - **Transaction Reference:** Enter UTR number or bank invoice reference (e.g. `UTR123456789`).
   - **Advance Next Due:** Keep checked to automatically advance the renewal date to the 1st of the next month in IST.
5. Click **Record Payment**.

---

## 4. Service Suspension & Resumption SOP

### Trigger Conditions
- Non-payment past due threshold.
- Acceptable Use Policy (AUP) violation or security anomaly.

### Suspension Procedure
1. Navigate to **Admin Panel → Provisioning**.
2. Find the target instance and click **Suspend**.
3. Enter a mandatory suspension reason.
4. The system suspends deployment, locks customer access to credentials, updates subscription status, and dispatches a formal suspension email.

### Resumption Procedure
1. Upon payment verification or issue resolution, click **Resume**.
2. Service is reactivated and customer receives resumption notification.

---

## 5. Support Operations & Evening Hours Protocol

- **Operational Window:** Daily 6:00 PM – 10:00 PM IST.
- **Customer Visibility:** Public replies sent by staff are emailed to the customer and visible on their ticket thread.
- **Internal Notes:** Check the **Post as internal note** box to document investigation findings. Internal notes are highlighted in gold/amber for staff and are never transmitted or exposed to customer sessions.

