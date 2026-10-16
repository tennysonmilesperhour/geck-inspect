// A toast sent before the Toaster starts listening still shows. The
// retired-page note (src/components/shared/RetiredPageNotice.jsx) is sent
// from an effect that runs before the Toaster's on a fresh page load, which
// is how every visitor arriving from an old /Promote or /Store link gets it.
import React, { useEffect } from 'react';
import { act, create } from 'react-test-renderer';
import { describe, expect, it } from 'vitest';
import { toast, useToast } from '@/components/ui/use-toast';

function Shown() {
  const { toasts } = useToast();
  return <span>{toasts.filter((t) => t.open !== false).map((t) => t.title).join(',')}</span>;
}
function SendsEarly() {
  useEffect(() => { toast({ title: 'Promote is switched off' }); }, []);
  return null;
}

describe('a toast sent before the Toaster listens', () => {
  it('still shows', () => {
    let tree;
    act(() => { tree = create(<><SendsEarly /><Shown /></>); });
    expect(tree.root.findByType('span').props.children).toContain('Promote is switched off');
    act(() => tree.unmount());
  });
});
