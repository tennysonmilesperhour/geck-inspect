import {
  FOUNDER_NAME,
  FOUNDER_URL,
  GECK_INTELLECT_LABEL,
  GECK_INTELLECT_URL,
} from '@/data/public-links';

const external = {
  target: '_blank',
  rel: 'noopener noreferrer',
};

export function GeckIntellectLink({ className }) {
  return (
    <a href={GECK_INTELLECT_URL} {...external} className={className}>
      {GECK_INTELLECT_LABEL}
    </a>
  );
}

export function FounderCredit({ className }) {
  return (
    <a href={FOUNDER_URL} {...external} className={className}>
      by {FOUNDER_NAME}
    </a>
  );
}
