# LioranDB Managed Hosting — API Reference Guide

**Base URL:** `https://app.liorandb.com/api`  
**Authentication:** Session Cookie (`liorandb_session`)

All endpoints accept and return `application/json`.

---

## 1. Authentication Endpoints (`/api/auth`)

### `POST /api/auth/signup`
Creates a new customer account and sends a 6-digit verification OTP.
- **Request Body:**
  ```json
  {
    "email": "user@example.com",
    "password": "StrongPassword123!",
    "confirmPassword": "StrongPassword123!"
  }
  ```
- **Response (200 OK):**
  ```json
  {
    "success": true,
    "userId": "66b1a2f4..."
  }
  ```

---

### `POST /api/auth/login`
Authenticates user and issues encrypted iron-session cookie.
- **Request Body:**
  ```json
  {
    "email": "user@example.com",
    "password": "StrongPassword123!"
  }
  ```
- **Response (200 OK):**
  ```json
  {
    "success": true,
    "user": {
      "email": "user@example.com",
      "role": "customer",
      "emailVerified": true
    }
  }
  ```

---

### `POST /api/auth/verify-email`
Validates 6-digit OTP code and marks email as verified.
- **Request Body:**
  ```json
  {
    "otp": "123456"
  }
  ```
- **Response (200 OK):**
  ```json
  {
    "success": true,
    "message": "Email verified successfully."
  }
  ```

---

### `POST /api/auth/resend-otp`
Requests a new verification OTP (enforces 60-second cooldown).
- **Response (200 OK):**
  ```json
  {
    "success": true,
    "message": "A new verification code has been sent to your email."
  }
  ```

---

### `POST /api/auth/forgot-password`
Initiates password reset email flow. Anti-enumeration: always returns HTTP 200.
- **Request Body:**
  ```json
  {
    "email": "user@example.com"
  }
  ```

---

### `POST /api/auth/reset-password`
Completes password reset using single-use 32-byte token.
- **Request Body:**
  ```json
  {
    "token": "a1b2c3d4...",
    "password": "NewStrongPassword123!",
    "confirmPassword": "NewStrongPassword123!"
  }
  ```

---

### `POST /api/auth/logout`
Destroys active session cookie.

---

## 2. Customer Endpoints (`/api/customer`)

### `POST /api/customer/application`
Submits a managed hosting application.
- **Request Body:** (See `ApplicationSchema` in `src/lib/validation/schemas.ts`)
  ```json
  {
    "fullName": "Jane Doe",
    "workEmail": "jane@company.com",
    "country": "India",
    "companyName": "Acme Corp",
    "description": "B2B document management platform",
    "stage": "Growth",
    "whyLioranDB": "High performance document operations",
    "appDescription": "Invoice and ledger parsing backend",
    "expectedDocumentCount": "100,000 – 500,000",
    "expectedMonthlyUsers": "10,000",
    "readTrafficLevel": "Moderate (100–1,000 req/s)",
    "writeTrafficLevel": "Light (under 100 req/s)",
    "estimatedStorage": "5–10 GB",
    "isProduction": true,
    "pricingResponse": "yes"
  }
  ```

---

### `POST /api/customer/legal`
Records immutable consent for versioned policy documents.
- **Request Body:**
  ```json
  {
    "acceptances": [
      { "policySlug": "managed-hosting-terms", "policyVersion": "1.0" },
      { "policySlug": "privacy-policy", "policyVersion": "1.0" },
      { "policySlug": "acceptable-use-policy", "policyVersion": "1.0" },
      { "policySlug": "refund-cancellation-policy", "policyVersion": "1.0" }
    ]
  }
  ```

---

### `GET /api/customer/notifications` & `GET /api/customer/notifications/unread-count`
Retrieves customer notification list and live unread notification count.

---

### `POST /api/customer/tickets`
Creates a support inquiry.
- **Request Body:**
  ```json
  {
    "category": "SUPPORT_REQUEST",
    "subject": "Question regarding connection pooling",
    "description": "We are experiencing connection timeout issues...",
    "priority": "NORMAL"
  }
  ```

---

### `POST /api/customer/tickets/[id]/messages`
Appends a customer response to an existing ticket.

---

## 3. Admin Endpoints (`/api/admin`)

*Requires `role === 'admin'`*

### `POST /api/admin/applications/[id]/review`
Records decision on customer application.
- **Request Body:**
  ```json
  {
    "status": "APPROVED",
    "reviewNotes": "Qualified production workload."
  }
  ```

---

### `POST /api/admin/provision`
Provisions database deployment and stores AES-256-GCM encrypted URI.
- **Request Body:**
  ```json
  {
    "customerId": "66b1a...",
    "name": "Acme Production DB",
    "host": "acme.managed.liorandb.com",
    "port": 27017,
    "databaseName": "acme_prod",
    "username": "acme_admin",
    "temporaryPassword": "OptionalCustomPassword!",
    "expiresInDays": 7
  }
  ```

---

### `POST /api/admin/provision/[id]/suspend` & `POST /api/admin/provision/[id]/resume`
Suspends or resumes managed database deployment and associated subscription.

---

### `POST /api/admin/billing/payments`
Records manual bank/UPI transfer and advances subscription due date.
- **Request Body:**
  ```json
  {
    "subscriptionId": "66b1...",
    "userId": "66b1...",
    "amount": 5000,
    "currency": "INR",
    "transactionReference": "UTR987654321",
    "notes": "Bank transfer via HDFC",
    "advanceNextDue": true
  }
  ```

---

### `POST /api/admin/support/[id]/messages`
Posts staff reply or internal team note.
- **Request Body:**
  ```json
  {
    "body": "Investigating node latency logs.",
    "isInternal": true
  }
  ```

