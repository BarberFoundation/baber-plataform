import { Link } from 'react-router-dom';

export default function Cta() {
  return (
    <section className="bg-gradient-to-br from-orange-700 via-red-800 to-neutral-950 px-6 py-24 text-center">
      <h2 className="mx-auto max-w-2xl text-3xl font-bold text-white sm:text-4xl">
        Pronto pra deixar sua barbearia no automático?
      </h2>
      <Link
        to="/login"
        className="mt-8 inline-block rounded-full bg-white px-8 py-4 text-lg font-semibold text-neutral-950 shadow-lg"
      >
        Entrar
      </Link>
    </section>
  );
}
