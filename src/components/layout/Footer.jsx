import Logo from '../shared/Logo.jsx'
import Icon from '../shared/Icon.jsx'
import { company, nav, services, contact, footer } from '../../data/site.js'

const year = new Date().getFullYear()

export default function Footer() {
  return (
    <footer className="bg-brand-deep text-white/80">
      <div className="container-x grid gap-12 py-16 sm:grid-cols-2 lg:grid-cols-[1.4fr_1fr_1fr_1.3fr] lg:gap-8">
        <div className="flex flex-col gap-5">
          <Logo variant="light" />
          <p className="max-w-sm text-sm leading-relaxed">{footer.description}</p>
          <ul className="flex gap-3">
            {footer.socials.map((social) => (
              <li key={social.label}>
                <a
                  href={social.href}
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label={social.label}
                  className="grid size-10 place-items-center rounded-md border border-white/15 text-white/80 transition-all duration-300 hover:border-gold hover:bg-gold hover:text-brand-deep"
                >
                  <Icon name={social.icon} className="size-4.5" />
                </a>
              </li>
            ))}
          </ul>
        </div>

        <nav aria-label="Footer navigation">
          <h3 className="font-display text-sm font-bold uppercase tracking-[0.18em] text-gold">Quick Links</h3>
          <ul className="mt-5 space-y-3 text-sm">
            {nav.map((item) => (
              <li key={item.href}>
                <a href={item.href} className="inline-flex items-center gap-2 transition-colors hover:text-gold">
                  <span className="h-px w-4 bg-gold/60" aria-hidden="true" />
                  {item.label}
                </a>
              </li>
            ))}
          </ul>
        </nav>

        <div>
          <h3 className="font-display text-sm font-bold uppercase tracking-[0.18em] text-gold">Services</h3>
          <ul className="mt-5 space-y-3 text-sm">
            {services.map((service) => (
              <li key={service.title}>
                <a href="#services" className="inline-flex items-center gap-2 transition-colors hover:text-gold">
                  <span className="h-px w-4 bg-gold/60" aria-hidden="true" />
                  {service.title}
                </a>
              </li>
            ))}
          </ul>
        </div>

        <div>
          <h3 className="font-display text-sm font-bold uppercase tracking-[0.18em] text-gold">Contact</h3>
          <ul className="mt-5 space-y-4 text-sm">
            <li className="flex items-start gap-3">
              <Icon name="phone" className="mt-0.5 size-4 shrink-0 text-gold" />
              <a href={contact.phoneHref} className="transition-colors hover:text-gold">
                {contact.phone}
              </a>
            </li>
            <li className="flex items-start gap-3">
              <Icon name="mail" className="mt-0.5 size-4 shrink-0 text-gold" />
              <a href={`mailto:${contact.email}`} className="break-all transition-colors hover:text-gold">
                {contact.email}
              </a>
            </li>
            <li className="flex items-start gap-3">
              <Icon name="pin" className="mt-0.5 size-4 shrink-0 text-gold" />
              <span className="leading-relaxed">{contact.address}</span>
            </li>
          </ul>
        </div>
      </div>

      <div className="border-t border-white/10">
        <div className="container-x flex flex-col items-center justify-between gap-3 py-6 text-xs text-white/60 sm:flex-row">
          <p>
            © {year} {company.name}. All rights reserved.
          </p>
          <p className="flex items-center gap-2">
            Batangas City, Philippines
            <span className="inline-block h-1.5 w-1.5 rounded-full bg-gold" aria-hidden="true" />
            Built on Trust. Driven by Quality.
          </p>
        </div>
      </div>
    </footer>
  )
}
