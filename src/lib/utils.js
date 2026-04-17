import { clsx } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs) {
  return twMerge(clsx(inputs))
}

export const isIframe = window.self !== window.top;

export const getSexIcon = (sex) =>
  sex === 'Male' ? '♂' : sex === 'Female' ? '♀' : '?';

export const getSexColor = (sex) =>
  sex === 'Male' ? 'text-blue-400' : sex === 'Female' ? 'text-pink-400' : 'text-gray-400';
