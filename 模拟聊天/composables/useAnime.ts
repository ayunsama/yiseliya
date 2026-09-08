/* eslint-disable import-x/no-named-as-default-member */
import anime from 'animejs';

export function useAnime() {
  function breathe(el: HTMLElement | null) {
    if (!el) return;
    return anime({
      targets: el,
      scale: [1, 1.05],
      loop: true,
      direction: 'alternate',
      easing: 'easeInOutSine',
      duration: 3000,
    });
  }

  function expandFromButton(
    container: HTMLElement | null,
    content: HTMLElement | null,
    onComplete?: () => void,
  ) {
    if (!container) return;
    const tl = anime.timeline({
      easing: 'easeOutElastic(1, .6)',
      complete: onComplete,
    });

    tl.add({
      targets: container,
      width: [64, 320],
      height: [64, 640],
      borderRadius: ['50%', '42px'],
      scale: [0, 1],
      opacity: [0, 1],
      duration: 900,
    });

    if (content) {
      tl.add({
        targets: content,
        opacity: [0, 1],
        scale: [0.9, 1],
        duration: 500,
      }, '-=500');
    }

    return tl;
  }

  function collapseToButton(
    container: HTMLElement | null,
    onComplete?: () => void,
  ) {
    if (!container) return;
    return anime({
      targets: container,
      scale: [1, 0],
      opacity: [1, 0],
      borderRadius: ['42px', '50%'],
      easing: 'easeInBack',
      duration: 500,
      complete: onComplete,
    });
  }

  function popInMessage(el: HTMLElement | null) {
    if (!el) return;
    return anime({
      targets: el,
      scale: [0.6, 1],
      translateY: [20, 0],
      opacity: [0, 1],
      easing: 'easeOutElastic(1, .8)',
      duration: 600,
    });
  }

  function staggerContacts(els: HTMLElement[] | NodeListOf<HTMLElement>) {
    return anime({
      targets: els,
      translateX: [30, 0],
      opacity: [0, 1],
      delay: anime.stagger(80),
      easing: 'easeOutCubic',
      duration: 500,
    });
  }

  function typingDots(els: HTMLElement[] | NodeListOf<HTMLElement>) {
    return anime({
      targets: els,
      translateY: [0, -6],
      delay: anime.stagger(120),
      loop: true,
      direction: 'alternate',
      easing: 'easeInOutQuad',
      duration: 400,
    });
  }

  return {
    breathe,
    expandFromButton,
    collapseToButton,
    popInMessage,
    staggerContacts,
    typingDots,
  };
}
