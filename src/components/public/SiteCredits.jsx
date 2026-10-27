import {
  FOUNDER_NAME,
  FOUNDER_URL,
} from '@/data/public-links';

const external = {
  target: '_blank',
  rel: 'noopener noreferrer',
};

export function FounderCredit({ className }) {
  return (
    <a href={FOUNDER_URL} {...external} className={className}>
      by {FOUNDER_NAME}
    </a>
  );
}
