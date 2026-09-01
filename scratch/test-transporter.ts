import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

import { sendEmail } from '../src/lib/email/transporter';
import { verificationOTPTemplate } from '../src/lib/email/templates';

async function main() {
  console.log('Sending test OTP email using src/lib/email/transporter.ts...');
  await sendEmail({
    to: 'epicdeveloper14@gmail.com',
    subject: 'Verify your LioranDB account (Direct Test)',
    html: verificationOTPTemplate('849201', 10),
  });
  console.log('Test completed successfully!');
}

main().catch((err) => {
  console.error('Test error:', err);
});

