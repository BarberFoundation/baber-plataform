import { useEffect, useRef } from 'react';
import { CalendarDays, Users, Scissors, LayoutDashboard } from 'lucide-react';
import { animate, stagger, onScroll } from 'animejs';

const FEATURES = [
  {
    icon: CalendarDays,
    title: 'Agendamento inteligente',
    description: 'Clientes marcam horário sozinhos, sem choque de agenda entre profissionais.',
  },
  {
    icon: Users,
    title: 'Gestão de barbeiros',
    description: 'Escalas, especialidades e disponibilidade de cada barbeiro em um lugar só.',
  },
  {
    icon: Scissors,
    title: 'Catálogo de serviços',
    description: 'Preços, duração e combos configuráveis sem depender de planilha.',
  },
  {
    icon: LayoutDashboard,
    title: 'Dashboard e relatórios',
    description: 'Veja o movimento do dia em tempo real, direto no painel.',
  },
];

export default function Features() {
  const gridRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!gridRef.current) return;
    const cards = Array.from(gridRef.current.children);
    const animation = animate(cards, {
      opacity: [0, 1],
      translateY: [24, 0],
      delay: stagger(100),
      duration: 500,
      easing: 'easeOutQuad',
      autoplay: onScroll({ target: gridRef.current, enter: 'bottom-=10% top' }),
    });
    return () => {
      animation.pause();
    };
  }, []);

  return (
    <section className="bg-neutral-950 px-6 py-24">
      <div ref={gridRef} className="mx-auto grid max-w-5xl gap-6 sm:grid-cols-2 lg:grid-cols-4">
        {FEATURES.map(({ icon: Icon, title, description }) => (
          <div key={title} className="rounded-2xl border border-neutral-800 bg-neutral-900 p-6">
            <Icon className="h-8 w-8 text-orange-500" />
            <h3 className="mt-4 text-lg font-semibold text-white">{title}</h3>
            <p className="mt-2 text-sm text-neutral-400">{description}</p>
          </div>
        ))}
      </div>
    </section>
  );
}
