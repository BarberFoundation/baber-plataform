import { useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import { animate, stagger, split } from 'animejs';

export default function Hero() {
  const headlineRef = useRef<HTMLHeadingElement>(null);
  const ctaRef = useRef<HTMLAnchorElement>(null);

  useEffect(() => {
    if (!headlineRef.current) return;
    const { words } = split(headlineRef.current, { words: true });
    const animation = animate(words, {
      opacity: [0, 1],
      translateY: [20, 0],
      delay: stagger(80),
      duration: 600,
      easing: 'easeOutQuad',
    });
    return () => {
      animation.pause();
    };
  }, []);

  useEffect(() => {
    if (!ctaRef.current) return;
    const animation = animate(ctaRef.current, {
      scale: [1, 1.03],
      duration: 1200,
      loop: true,
      direction: 'alternate',
      easing: 'easeInOutSine',
    });
    return () => {
      animation.pause();
    };
  }, []);

  return (
    <section className="relative overflow-hidden bg-neutral-950 px-6 py-32 text-center">
      <h1 ref={headlineRef} className="mx-auto max-w-3xl text-5xl font-bold text-white sm:text-6xl">
        Gestão de barbearia que impressiona do primeiro corte ao último agendamento
      </h1>
      <p className="mx-auto mt-6 max-w-xl text-lg text-neutral-300">
        Agendamentos, barbeiros e serviços em um painel só. Simples pra você, rápido pro seu cliente.
      </p>
      <Link
        ref={ctaRef}
        to="/login"
        className="mt-10 inline-block rounded-full bg-orange-600 px-8 py-4 text-lg font-semibold text-white shadow-lg shadow-orange-600/30"
      >
        Começar agora
      </Link>
    </section>
  );
}
