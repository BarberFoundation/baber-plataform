import { useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import { animate, stagger, split } from 'animejs';
import { Scissors, Sparkles, Wand2 } from 'lucide-react';

export default function Hero() {
  const headlineRef = useRef<HTMLHeadingElement>(null);
  const ctaRef = useRef<HTMLAnchorElement>(null);
  const blobRef = useRef<HTMLDivElement>(null);
  const iconsRef = useRef<HTMLDivElement>(null);

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

  useEffect(() => {
    if (!blobRef.current) return;
    const animation = animate(blobRef.current, {
      translateX: ['-5%', '5%'],
      translateY: ['-3%', '4%'],
      scale: [1, 1.15],
      duration: 6000,
      loop: true,
      direction: 'alternate',
      easing: 'easeInOutSine',
    });
    return () => {
      animation.pause();
    };
  }, []);

  useEffect(() => {
    if (!iconsRef.current) return;
    const icons = Array.from(iconsRef.current.children);
    const loopAnimations = icons.map((icon, i) =>
      animate(icon, {
        translateY: [-10, 10],
        duration: 2200 + i * 400,
        loop: true,
        direction: 'alternate',
        easing: 'easeInOutSine',
      }),
    );

    function handleMouseMove(e: MouseEvent) {
      const { innerWidth } = window;
      const x = (e.clientX / innerWidth - 0.5) * 20;
      icons.forEach((icon, i) => {
        animate(icon, {
          translateX: x * (i + 1) * 0.3,
          duration: 400,
          easing: 'easeOutQuad',
        });
      });
    }

    window.addEventListener('mousemove', handleMouseMove);
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      loopAnimations.forEach((a) => a.pause());
    };
  }, []);

  return (
    <section className="relative overflow-hidden bg-neutral-950 px-6 py-32 text-center">
      <div
        ref={blobRef}
        className="pointer-events-none absolute left-1/2 top-1/2 h-[36rem] w-[36rem] -translate-x-1/2 -translate-y-1/2 rounded-[40%] bg-gradient-to-br from-orange-600 via-red-700 to-neutral-950 opacity-40 blur-3xl"
      />
      <div ref={iconsRef} className="pointer-events-none absolute inset-0">
        <Scissors data-testid="hero-floating-icon" className="absolute left-[15%] top-[25%] h-10 w-10 text-orange-500/70" />
        <Wand2 data-testid="hero-floating-icon" className="absolute right-[18%] top-[35%] h-8 w-8 text-red-500/70" />
        <Sparkles data-testid="hero-floating-icon" className="absolute left-[25%] bottom-[20%] h-9 w-9 text-orange-400/70" />
      </div>
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
