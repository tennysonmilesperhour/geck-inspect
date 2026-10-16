/**
 * The animation library (framer-motion, about 38 kB compressed) for the
 * open Morph Guide quiz. MorphQuiz.jsx loads this file when a visitor
 * shows interest in the quiz, so the Morph Guide itself draws without it.
 *
 * Only library code may be imported here. If this file imported one of
 * our own modules that only the Morph Guide uses, the build would have to
 * share it from the page's own file, and the page would lose its entry in
 * the build manifest (which the size check and the prerendered preload
 * links read).
 */
export { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
