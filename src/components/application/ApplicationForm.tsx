'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

const COMPANY_STAGES = [
  'Idea', 'Prototype', 'Pre-revenue', 'Early revenue',
  'Growth', 'Established business', 'Personal project', 'Other',
];

const DOCUMENT_COUNT_OPTIONS = [
  'Under 10,000', '10,000 – 100,000', '100,000 – 500,000',
  '500,000 – 1,000,000', 'Over 1,000,000',
];

const TRAFFIC_OPTIONS = [
  'Light (under 100 req/s)', 'Moderate (100–1,000 req/s)',
  'Heavy (1,000–10,000 req/s)', 'Very heavy (over 10,000 req/s)',
];

const STORAGE_OPTIONS = [
  'Under 1 GB', '1–5 GB', '5–10 GB', 'Over 10 GB',
];

interface Props {
  defaultEmail?: string;
  defaultName?: string;
  nextVersion: number;
}

export default function ApplicationForm({ defaultEmail, defaultName, nextVersion }: Props) {
  const router = useRouter();
  const [step, setStep] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const [formData, setFormData] = useState({
    fullName: defaultName || '',
    workEmail: defaultEmail || '',
    phone: '',
    country: '',
    companyName: '',
    website: '',
    description: '',
    stage: '',
    githubUrl: '',
    linkedinUrl: '',
    twitterUrl: '',
    productUrl: '',
    demoUrl: '',
    whyLioranDB: '',
    appDescription: '',
    expectedDocumentCount: '',
    expectedMonthlyUsers: '',
    readTrafficLevel: '',
    writeTrafficLevel: '',
    estimatedStorage: '',
    isProduction: 'true',
    pricingResponse: '',
    acknowledgedDisclaimer: false,
  });

  function update(field: string, value: string | boolean) {
    setFormData((prev) => ({ ...prev, [field]: value }));
  }

  const steps = [
    'Contact & Company',
    'Social & Links',
    'Use Case',
    'Plan & Pricing',
    'Review & Submit',
  ];

  async function handleSubmit() {
    setError('');
    setLoading(true);

    try {
      const payload = {
        ...formData,
        isProduction: formData.isProduction === 'true',
      };

      const res = await fetch('/api/customer/application', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || 'Submission failed. Please try again.');
        return;
      }

      router.push('/dashboard');
      router.refresh();
    } catch {
      setError('An unexpected error occurred. Please try again.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="max-w-2xl">
      {/* Step indicator */}
      <div className="flex items-center gap-2 mb-8">
        {steps.map((label, i) => (
          <div key={i} className="flex items-center gap-2">
            <div
              className="flex items-center justify-center w-7 h-7 rounded-full text-xs font-medium"
              style={{
                background: i === step ? 'var(--accent)' : i < step ? 'var(--surface-2)' : 'var(--surface)',
                color: i === step ? 'var(--background)' : i < step ? 'var(--success)' : 'var(--text-muted)',
                border: `1px solid ${i === step ? 'var(--accent)' : 'var(--border)'}`,
              }}
            >
              {i < step ? '✓' : i + 1}
            </div>
            {i < steps.length - 1 && (
              <div className="h-px w-8" style={{ background: i < step ? 'var(--accent)' : 'var(--border)' }} />
            )}
          </div>
        ))}
      </div>

      {error && (
        <div className="alert-banner alert-banner-error text-sm mb-4" role="alert">
          {error}
        </div>
      )}

      {/* Step 0: Contact & Company */}
      {step === 0 && (
        <div className="space-y-4">
          <h2 className="text-lg font-medium text-[var(--text-primary)]">Contact & Company</h2>

          <FormField label="Full name *" required>
            <input
              type="text"
              className="input-field"
              value={formData.fullName}
              onChange={(e) => update('fullName', e.target.value)}
              placeholder="Your full name"
            />
          </FormField>

          <FormField label="Work email *" required>
            <input
              type="email"
              className="input-field"
              value={formData.workEmail}
              onChange={(e) => update('workEmail', e.target.value)}
              placeholder="work@company.com"
            />
          </FormField>

          <FormField label="Phone (optional)">
            <input
              type="tel"
              className="input-field"
              value={formData.phone}
              onChange={(e) => update('phone', e.target.value)}
              placeholder="+91 98765 43210"
            />
          </FormField>

          <FormField label="Country *" required>
            <input
              type="text"
              className="input-field"
              value={formData.country}
              onChange={(e) => update('country', e.target.value)}
              placeholder="India"
            />
          </FormField>

          <FormField label="Company / Project name *" required>
            <input
              type="text"
              className="input-field"
              value={formData.companyName}
              onChange={(e) => update('companyName', e.target.value)}
              placeholder="Acme Corp"
            />
          </FormField>

          <FormField label="Website (optional)">
            <input
              type="url"
              className="input-field"
              value={formData.website}
              onChange={(e) => update('website', e.target.value)}
              placeholder="https://example.com"
            />
          </FormField>

          <FormField label="Short description *" required>
            <textarea
              className="input-field"
              rows={3}
              value={formData.description}
              onChange={(e) => update('description', e.target.value)}
              placeholder="Brief description of your company/project (minimum 20 characters)"
            />
          </FormField>

          <FormField label="Current stage *" required>
            <select
              className="input-field"
              value={formData.stage}
              onChange={(e) => update('stage', e.target.value)}
            >
              <option value="">Select stage</option>
              {COMPANY_STAGES.map((s) => (
                <option key={s} value={s}>{s}</option>
              ))}
            </select>
          </FormField>

          <div className="flex justify-end">
            <button
              type="button"
              onClick={() => {
                if (!formData.fullName || !formData.workEmail || !formData.country || !formData.companyName || !formData.description || !formData.stage) {
                  setError('Please fill in all required fields.');
                  return;
                }
                setError('');
                setStep(1);
              }}
              className="btn-primary"
            >
              Next →
            </button>
          </div>
        </div>
      )}

      {/* Step 1: Social & Links */}
      {step === 1 && (
        <div className="space-y-4">
          <h2 className="text-lg font-medium text-[var(--text-primary)]">Social & Technical Links</h2>
          <p className="text-sm text-[var(--text-secondary)]">All fields are optional.</p>

          {[
            { label: 'GitHub', field: 'githubUrl', placeholder: 'https://github.com/yourorg' },
            { label: 'LinkedIn', field: 'linkedinUrl', placeholder: 'https://linkedin.com/company/...' },
            { label: 'X / Twitter', field: 'twitterUrl', placeholder: 'https://twitter.com/...' },
            { label: 'Product URL', field: 'productUrl', placeholder: 'https://yourproduct.com' },
            { label: 'Demo URL', field: 'demoUrl', placeholder: 'https://demo.yourproduct.com' },
          ].map(({ label, field, placeholder }) => (
            <FormField key={field} label={label}>
              <input
                type="url"
                className="input-field"
                value={(formData as unknown as Record<string, string>)[field]}
                onChange={(e) => update(field, e.target.value)}
                placeholder={placeholder}
              />
            </FormField>
          ))}

          <div className="flex justify-between">
            <button type="button" onClick={() => setStep(0)} className="btn-secondary">← Back</button>
            <button type="button" onClick={() => setStep(2)} className="btn-primary">Next →</button>
          </div>
        </div>
      )}

      {/* Step 2: Use Case */}
      {step === 2 && (
        <div className="space-y-4">
          <h2 className="text-lg font-medium text-[var(--text-primary)]">Use Case</h2>

          <FormField label="Why do you want to use LioranDB? *" required>
            <textarea
              className="input-field"
              rows={4}
              value={formData.whyLioranDB}
              onChange={(e) => update('whyLioranDB', e.target.value)}
              placeholder="Tell us why LioranDB fits your use case (minimum 50 characters)"
            />
          </FormField>

          <FormField label="Describe the application you plan to run *" required>
            <textarea
              className="input-field"
              rows={4}
              value={formData.appDescription}
              onChange={(e) => update('appDescription', e.target.value)}
              placeholder="What will you build? What data will you store? (minimum 50 characters)"
            />
          </FormField>

          <FormField label="Expected document count *" required>
            <select
              className="input-field"
              value={formData.expectedDocumentCount}
              onChange={(e) => update('expectedDocumentCount', e.target.value)}
            >
              <option value="">Select range</option>
              {DOCUMENT_COUNT_OPTIONS.map((o) => <option key={o} value={o}>{o}</option>)}
            </select>
          </FormField>

          <FormField label="Expected monthly users *" required>
            <input
              type="text"
              className="input-field"
              value={formData.expectedMonthlyUsers}
              onChange={(e) => update('expectedMonthlyUsers', e.target.value)}
              placeholder="e.g. 5,000"
            />
          </FormField>

          <FormField label="Estimated read traffic *" required>
            <select
              className="input-field"
              value={formData.readTrafficLevel}
              onChange={(e) => update('readTrafficLevel', e.target.value)}
            >
              <option value="">Select traffic level</option>
              {TRAFFIC_OPTIONS.map((o) => <option key={o} value={o}>{o}</option>)}
            </select>
          </FormField>

          <FormField label="Estimated write traffic *" required>
            <select
              className="input-field"
              value={formData.writeTrafficLevel}
              onChange={(e) => update('writeTrafficLevel', e.target.value)}
            >
              <option value="">Select traffic level</option>
              {TRAFFIC_OPTIONS.map((o) => <option key={o} value={o}>{o}</option>)}
            </select>
          </FormField>

          <FormField label="Estimated storage needed *" required>
            <select
              className="input-field"
              value={formData.estimatedStorage}
              onChange={(e) => update('estimatedStorage', e.target.value)}
            >
              <option value="">Select storage</option>
              {STORAGE_OPTIONS.map((o) => <option key={o} value={o}>{o}</option>)}
            </select>
          </FormField>

          <FormField label="Intended use *" required>
            <select
              className="input-field"
              value={formData.isProduction}
              onChange={(e) => update('isProduction', e.target.value)}
            >
              <option value="true">Production</option>
              <option value="false">Non-production / Development</option>
            </select>
          </FormField>

          <div className="flex justify-between">
            <button type="button" onClick={() => setStep(1)} className="btn-secondary">← Back</button>
            <button
              type="button"
              onClick={() => {
                if (!formData.whyLioranDB || !formData.appDescription || !formData.expectedDocumentCount || !formData.readTrafficLevel || !formData.writeTrafficLevel || !formData.estimatedStorage || !formData.expectedMonthlyUsers) {
                  setError('Please fill in all required fields.');
                  return;
                }
                setError('');
                setStep(3);
              }}
              className="btn-primary"
            >
              Next →
            </button>
          </div>
        </div>
      )}

      {/* Step 3: Plan & Pricing */}
      {step === 3 && (
        <div className="space-y-4">
          <h2 className="text-lg font-medium text-[var(--text-primary)]">Plan & Pricing</h2>

          <div className="card border-[var(--accent)]/20">
            <div className="flex justify-between items-start mb-4">
              <div>
                <h3 className="text-base font-medium text-[var(--text-primary)]">LioranDB Managed Hosting</h3>
                <p className="text-sm text-[var(--text-secondary)] mt-0.5">Everything you need to run LioranDB at scale</p>
              </div>
              <div className="text-right">
                <span className="text-2xl font-bold text-[var(--accent)]">₹5,000</span>
                <span className="text-sm text-[var(--text-secondary)]">/month</span>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-y-2 text-sm">
              {[
                ['vCPU', '2 vCPU'],
                ['RAM', '4 GB'],
                ['Storage', 'Up to 10 GB'],
                ['Documents', '~1 million'],
                ['Backups', 'Daily backups'],
                ['IOPS', '~3,000 IOPS'],
                ['Studio access', 'Included'],
                ['Support', 'Managed'],
              ].map(([label, value]) => (
                <div key={label} className="flex gap-2 py-1">
                  <span className="text-[var(--text-muted)]">{label}</span>
                  <span className="text-[var(--text-secondary)] font-medium">{value}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="card">
            <h4 className="text-sm font-medium text-[var(--text-secondary)] mb-2">
              LioranDB Benchmark Characteristics
            </h4>
            <div className="space-y-1 text-sm">
              <div className="flex justify-between">
                <span className="text-[var(--text-muted)]">Writes/sec</span>
                <span className="text-[var(--text-secondary)]">~10,000</span>
              </div>
              <div className="flex justify-between">
                <span className="text-[var(--text-muted)]">Reads/sec</span>
                <span className="text-[var(--text-secondary)]">~35,000</span>
              </div>
              <div className="flex justify-between">
                <span className="text-[var(--text-muted)]">Combined ops/sec</span>
                <span className="text-[var(--text-secondary)]">~45,000</span>
              </div>
            </div>
            <div className="alert-banner alert-banner-warning mt-3 text-xs">
              Performance depends on workload, indexes, document size, query patterns, concurrency, hardware, network conditions, and LioranDB version. Benchmark figures are not guaranteed service limits.
            </div>
          </div>

          <FormField label="Are you comfortable with the ₹5,000/month price? *" required>
            <div className="space-y-2">
              {[
                { value: 'yes', label: 'Yes, I am comfortable with ₹5,000/month' },
                { value: 'discuss', label: 'I need to discuss this with LioranDB' },
                { value: 'no', label: 'No, the pricing does not work for me' },
              ].map(({ value, label }) => (
                <label key={value} className="flex items-center gap-3 cursor-pointer">
                  <input
                    type="radio"
                    name="pricingResponse"
                    value={value}
                    checked={formData.pricingResponse === value}
                    onChange={(e) => update('pricingResponse', e.target.value)}
                    className="accent-[var(--accent)]"
                  />
                  <span className="text-sm text-[var(--text-secondary)]">{label}</span>
                </label>
              ))}
            </div>
          </FormField>

          <div className="alert-banner alert-banner-info text-sm">
            Submitting this application does <strong>not</strong> automatically activate hosting or charge your payment method. Every application is reviewed manually.
          </div>

          <div className="flex justify-between">
            <button type="button" onClick={() => setStep(2)} className="btn-secondary">← Back</button>
            <button
              type="button"
              onClick={() => {
                if (!formData.pricingResponse) {
                  setError('Please select your response to the pricing question.');
                  return;
                }
                setError('');
                setStep(4);
              }}
              className="btn-primary"
            >
              Review →
            </button>
          </div>
        </div>
      )}

      {/* Step 4: Review & Submit */}
      {step === 4 && (
        <div className="space-y-4">
          <h2 className="text-lg font-medium text-[var(--text-primary)]">Review & Submit</h2>

          <div className="card space-y-3 text-sm">
            <ReviewRow label="Name" value={formData.fullName} />
            <ReviewRow label="Email" value={formData.workEmail} />
            <ReviewRow label="Country" value={formData.country} />
            <ReviewRow label="Company" value={formData.companyName} />
            <ReviewRow label="Stage" value={formData.stage} />
            <ReviewRow label="Pricing response" value={formData.pricingResponse} />
            <ReviewRow label="Expected documents" value={formData.expectedDocumentCount} />
            <ReviewRow label="Estimated storage" value={formData.estimatedStorage} />
          </div>

          <div className="alert-banner alert-banner-info text-sm">
            By submitting this application, you confirm that the information provided is accurate. Submitting an application does not guarantee approval or immediate provisioning.
          </div>

          {error && (
            <div className="alert-banner alert-banner-error text-sm" role="alert">
              {error}
            </div>
          )}

          <div className="flex justify-between">
            <button type="button" onClick={() => setStep(3)} className="btn-secondary">← Back</button>
            <button
              type="button"
              onClick={handleSubmit}
              disabled={loading}
              className="btn-primary"
            >
              {loading ? 'Submitting...' : 'Submit Application'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function FormField({
  label,
  required,
  children,
}: {
  label: string;
  required?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div>
      <label className="label">
        {label}
        {required && <span className="text-[var(--error)] ml-0.5">*</span>}
      </label>
      {children}
    </div>
  );
}

function ReviewRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between">
      <span className="text-[var(--text-muted)]">{label}</span>
      <span className="text-[var(--text-secondary)] font-medium">{value || '—'}</span>
    </div>
  );
}
