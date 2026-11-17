/**
 * Desplaza suavemente el viewport hacia el inicio de un elemento (respetando prefers-reduced-motion).
 */
export function scrollElementToStart(element: HTMLElement | null): void {
  if (!element || typeof window === 'undefined') return;
  const prefersReduced =
    typeof window.matchMedia === 'function' &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  element.scrollIntoView({
    behavior: prefersReduced ? 'auto' : 'smooth',
    block: 'start',
  });
}
