import Reveal from '../shared/Reveal.jsx'
import Button from '../shared/Button.jsx'

export default function CTA() {
  return (
    <section className="relative overflow-hidden bg-brand py-24 sm:py-32" aria-label="Call to action">
      <div
        className="absolute inset-0"
        style={{
          backgroundImage: 'linear-gradient(rgb(0 69 42 / 0.86), rgb(0 69 42 / 0.92)), url(/images/cta-bg.jpg)',
          backgroundSize: 'cover',
          backgroundPosition: 'center',
        }}
        aria-hidden="true"
      />
      <div className="hero-lines absolute inset-0" aria-hidden="true" />

      <Reveal className="container-x relative flex flex-col items-center text-center">
        <span className="grid size-14 place-items-center rounded-md bg-gold text-brand-deep shadow-card">
          <svg viewBox="0 0 24 24" className="size-7" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M16 4 20 8 8 20H4v-4L16 4Z" />
            <path d="m13.5 6.5 4 4" />
          </svg>
        </span>
        <h2 className="mt-6 max-w-3xl font-display text-3xl font-extrabold leading-tight tracking-tight text-white sm:text-5xl">
          Let’s Build Your Vision.
        </h2>
        <p className="mt-5 max-w-xl text-lg leading-relaxed text-white/80">
          Have a project in mind? Let’s discuss how we can bring it to life.
        </p>
        <Button href="#contact" className="mt-9 px-9 py-4 text-base">
          Contact Us
        </Button>
      </Reveal>
    </section>
  )
}
