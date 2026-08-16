import { useEffect, useState } from 'react'
import Logo from '../shared/Logo.jsx'
import Button from '../shared/Button.jsx'
import { nav } from '../../data/site.js'

export default function Navbar() {
  const [scrolled, setScrolled] = useState(false)
  const [open, setOpen] = useState(false)

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 24)
    onScroll()
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  const solid = scrolled || open

  return (
    <header className={`fixed inset-x-0 top-0 z-50 transition-all duration-300 ${solid ? 'bg-white/95 shadow-card backdrop-blur-md' : 'bg-transparent'}`}>
      <nav className="container-x flex items-center justify-between py-3.5" aria-label="Main navigation">
        <Logo variant={solid ? 'dark' : 'light'} className="flex-1" />

        <ul className="hidden items-center gap-9 lg:flex">
          {nav.map((item) => (
            <li key={item.href}>
              <a
                href={item.href}
                className={`group relative font-display text-sm font-semibold tracking-wide transition-colors ${
                  solid ? 'text-brand-deep hover:text-brand' : 'text-white hover:text-gold'
                }`}
              >
                {item.label}
                <span className="absolute -bottom-1.5 left-0 h-0.5 w-0 rounded-full bg-gold transition-all duration-300 group-hover:w-full" />
              </a>
            </li>
          ))}
        </ul>

        <div className="flex items-center gap-3 lg:ml-10">
          <div className="hidden lg:block">
            <Button href="#contact" className="px-6 py-3">
              Get a Quote
            </Button>
          </div>

          <button
            type="button"
            className={`relative z-50 grid size-11 place-items-center rounded-md transition-colors lg:hidden ${
              solid ? 'text-brand-deep hover:bg-mist' : 'text-white hover:bg-white/10'
            }`}
            aria-label={open ? 'Close menu' : 'Open menu'}
            aria-expanded={open}
            aria-controls="mobile-menu"
            onClick={() => setOpen((v) => !v)}
          >
            <svg viewBox="0 0 24 24" className="size-6" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
              {open ? <path d="M6 6l12 12M18 6 6 18" /> : <path d="M4 7h16M4 12h16M4 17h10" />}
            </svg>
          </button>
        </div>
      </nav>

      <div
        id="mobile-menu"
        className={`overflow-hidden border-t border-mist bg-white transition-[max-height] duration-300 ease-in-out lg:hidden ${
          open ? 'max-h-[420px]' : 'max-h-0 border-t-0'
        }`}
      >
        <ul className="container-x flex flex-col py-4">
          {nav.map((item) => (
            <li key={item.href}>
              <a
                href={item.href}
                onClick={() => setOpen(false)}
                className="block border-b border-mist py-3.5 font-display text-base font-semibold text-brand-deep transition-colors hover:text-brand"
              >
                {item.label}
              </a>
            </li>
          ))}
          <li className="pt-4">
            <Button href="#contact" onClick={() => setOpen(false)} className="w-full">
              Get a Quote
            </Button>
          </li>
        </ul>
      </div>
    </header>
  )
}
