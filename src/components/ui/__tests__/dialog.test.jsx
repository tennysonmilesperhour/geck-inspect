// @vitest-environment jsdom
import React from 'react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { expect, it } from 'vitest';
import { installDomHarness } from '@/lib/__tests__/domHarness';
import { Dialog, DialogContent, DialogTitle, DialogDescription, DialogTrigger } from '../dialog';

installDomHarness();

it('keeps modal fields interactive while the page is disabled and restores the trigger on close', async () => {
  const user = userEvent.setup();
  render(
    <Dialog>
      <DialogTrigger>Edit animal</DialogTrigger>
      <DialogContent style={{ maxWidth: 400 }}>
        <DialogTitle>Edit animal</DialogTitle>
        <DialogDescription>Update the animal name.</DialogDescription>
        <label>Name<input /></label>
      </DialogContent>
    </Dialog>,
  );
  await user.click(screen.getByRole('button', { name: 'Edit animal' }));
  expect(document.body.style.pointerEvents).toBe('none');
  expect(screen.getByRole('dialog').style.pointerEvents).toBe('auto');
  expect(screen.getByRole('dialog').style.maxWidth).toBe('400px');
  await user.type(screen.getByLabelText('Name'), 'QA');
  expect(screen.getByLabelText('Name').value).toBe('QA');
  await user.click(screen.getByRole('button', { name: 'Close' }));
  expect(screen.queryByRole('dialog')).toBeNull();
  expect(document.body.style.pointerEvents).not.toBe('none');
  expect(document.activeElement).toBe(screen.getByRole('button', { name: 'Edit animal' }));
});
