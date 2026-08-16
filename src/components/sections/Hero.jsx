import Button from '../shared/Button.jsx'
import Icon from '../shared/Icon.jsx'
import { company } from '../../data/site.js'

export default function Hero() {
  return (
    <section id="home" className="relative flex min-h-svh items-center overflow-hidden bg-brand-deep">
      <div
        className="absolute inset-0"
        style={{
          backgroundImage: 'linear-gradient(rgb(0 45 26 / 0.82), rgb(0 69 42 / 0.9) 55%, rgb(0 69 42 / 0.96)), url(/images/hero.jpg)',
          backgroundSize: 'cover',
          backgroundPosition: 'center',
        }}
        aria-hidden="true"
      />
      <div className="hero-lines absolute inset-0" aria-hidden="true" />

      <div className="container-x relative z-10 py-32">
        <div className="max-w-3xl">
          <p className="mb-6 flex items-center gap-3 font-display text-xs font-bold uppercase tracking-[0.3em] text-gold">
            <span className="gold-rule" aria-hidden="true" />
            Construction &amp; Development
          </p>

          <h1 className="font-display text-4xl font-extrabold leading-[1.08] tracking-tight text-white sm:text-6xl lg:text-7xl">
            Built on Trust.
            <br />
            <span className="text-gold">Driven by Quality.</span>
          </h1>

          <p className="mt-7 max-w-xl text-lg leading-relaxed text-white/80">{company.description}</p>

          <div className="mt-10 flex flex-col gap-4 sm:flex-row">
            <Button href="#projects">
              View Our Projects
              <Icon name="arrow-right" className="size-4" />
            </Button>
            <Button href="#contact" variant="outline-light">
              Get a Quote
            </Button>
          </div>
        </div>
      </div>

      <div className="absolute bottom-0 left-0 h-2 w-full bg-gold" aria-hidden="true" />
      <a
        href="#about"
        aria-label="Scroll to About Us"
        className="absolute bottom-10 right-10 z-10 hidden animate-bounce text-white/70 transition-colors hover:text-gold lg:block"
      >
        <svg viewBox="0 0 24 24" className="size-8" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="M12 4v16M6 14l6 6 6-6" />
        </svg>
      </a>
    </section>
  )
}
