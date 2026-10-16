import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

import { sendEmail } from '../src/lib/email/transporter';
import { verificationOTPTemplate } from '../src/lib/email/templates';

async function testLightEmail() {
  console.log('Sending light mode verification email to epicdeveloper14@gmail.com...');
  await sendEmail({
    to: 'epicdeveloper14@gmail.com',
    subject: 'Verify your LioranDB account (DESIGN.md Light Mode)',
    html: verificationOTPTemplate('916453', 10),
  });
  console.log('Light mode email sent successfully!');
}

testLightEmail().catch(console.error);
