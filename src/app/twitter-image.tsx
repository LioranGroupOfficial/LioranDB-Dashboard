import { createSocialImage } from '@/lib/social-image';

export const runtime = 'nodejs';
export const alt = 'LioranDB Cloud - Your database. Ready to build.';
export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';

export default function Image() {
  return createSocialImage();
}
