import PricingSection from '../../components/PricingSection';

export default function PlansPage() {
  return (
    <section className="py-20">
      <h1 className="text-center text-4xl font-black mb-12">Escolha o seu plano</h1>
      <PricingSection /> {/* 👈 Injetado aqui! */}
    </section>
  );
}