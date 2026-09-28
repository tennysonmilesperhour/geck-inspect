// Browser page translation (Chrome's built-in Google Translate on Android,
// iPhone and desktop, and Safari's Translate) swaps the page's text nodes for
// its own elements. React still holds the original nodes, so the next update
// that removes or moves one asks the browser to detach a node from a parent
// it no longer has. The browser throws NotFoundError ("The object can not be
// found here." in Safari) and the whole screen falls to the error page.
//
// The error log shows this hitting real visitors on sign-up, Dashboard, Home,
// Morph ID and the Morph Guide. The guard below is the workaround the React
// team suggests (facebook/react#11538): when the node has already been moved
// by the translator, skip the DOM call instead of crashing. Pages that are not
// translated never reach the skip branch.
export function installTranslationGuard(proto = typeof Node === 'function' ? Node.prototype : null) {
  if (!proto || proto.__translationGuard) return false;

  const removeChild = proto.removeChild;
  proto.removeChild = function guardedRemoveChild(child) {
    if (child && child.parentNode !== this) return child;
    return removeChild.apply(this, arguments);
  };

  const insertBefore = proto.insertBefore;
  proto.insertBefore = function guardedInsertBefore(newNode, referenceNode) {
    if (referenceNode && referenceNode.parentNode !== this) return newNode;
    return insertBefore.apply(this, arguments);
  };

  Object.defineProperty(proto, '__translationGuard', { value: true });
  return true;
}
