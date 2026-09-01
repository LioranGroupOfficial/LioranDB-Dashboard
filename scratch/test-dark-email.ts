import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

import { sendEmail } from '../src/lib/email/transporter';
import { verificationOTPTemplate } from '../src/lib/email/templates';

async function testDarkEmail() {
  console.log('Sending dark mode verification email to epicdeveloper14@gmail.com...');
  await sendEmail({
    to: 'epicdeveloper14@gmail.com',
    subject: 'Verify your LioranDB account (Full Dark Mode)',
    html: verificationOTPTemplate('916453', 10),
  });
  console.log('Dark mode email sent successfully!');
}

testDarkEmail().catch(console.error);

