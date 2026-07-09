import { useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import { animate, stagger, onScroll } from 'animejs';

export default function Cta() {
  const contentRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!contentRef.current) return;
    const children = Array.from(contentRef.current.children);
    const animation = animate(children, {
      opacity: [0, 1],
      translateY: [24, 0],
      delay: stagger(100),
      duration: 500,
      easing: 'easeOutQuad',
      autoplay: onScroll({ target: contentRef.current, enter: 'bottom-=10% top', repeat: false }),
    });
    return () => {
      animation.pause();
    };
  }, []);

  return (
    <section className="bg-gradient-to-br from-orange-700 via-red-800 to-neutral-950 px-6 py-24 text-center">
      <div ref={contentRef}>
        <h2 className="mx-auto max-w-2xl text-3xl font-bold text-white sm:text-4xl">
          Pronto pra deixar sua barbearia no automático?
        </h2>
        <Link
          to="/login"
          className="mt-8 inline-block rounded-full bg-white px-8 py-4 text-lg font-semibold text-neutral-950 shadow-lg"
        >
          Entrar
        </Link>
      </div>
    </section>
  );
}
