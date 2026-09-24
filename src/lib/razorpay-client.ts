'use client';

/**
 * Dynamically loads the Razorpay checkout script if not already present.
 * Ensures the SDK is available on window.Razorpay before initializing checkout.
 */
export function loadRazorpaySDK(): Promise<boolean> {
  return new Promise((resolve) => {
    if (typeof window === 'undefined') {
      resolve(false);
      return;
    }

    // Check if Razorpay object already exists on window
    if ((window as unknown as { Razorpay?: unknown }).Razorpay) {
      resolve(true);
      return;
    }

    const scriptSrc = 'https://checkout.razorpay.com/v1/checkout.js';

    // Check if script tag is already attached
    const existingScript = document.querySelector<HTMLScriptElement>(`script[src="${scriptSrc}"]`);
    if (existingScript) {
      if ((window as unknown as { Razorpay?: unknown }).Razorpay) {
        resolve(true);
        return;
      }
      existingScript.addEventListener('load', () => resolve(true), { once: true });
      existingScript.addEventListener('error', () => resolve(false), { once: true });
      return;
    }

    // Inject the script element
    const script = document.createElement('script');
    script.src = scriptSrc;
    script.async = true;
    script.onload = () => {
      resolve(true);
    };
    script.onerror = () => {
      console.error('[Razorpay SDK] Failed to load checkout script from', scriptSrc);
      resolve(false);
    };

    document.body.appendChild(script);
  });
}

