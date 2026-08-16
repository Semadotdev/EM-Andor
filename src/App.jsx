import Navbar from './components/layout/Navbar.jsx'
import Footer from './components/layout/Footer.jsx'
import Hero from './components/sections/Hero.jsx'
import Stats from './components/sections/Stats.jsx'
import About from './components/sections/About.jsx'
import Services from './components/sections/Services.jsx'
import Projects from './components/sections/Projects.jsx'
import WhyChooseUs from './components/sections/WhyChooseUs.jsx'
import CTA from './components/sections/CTA.jsx'
import Contact from './components/sections/Contact.jsx'

export default function App() {
  return (
    <>
      <a href="#home" className="skip-link">
        Skip to content
      </a>
      <Navbar />
      <main>
        <Hero />
        <Stats />
        <About />
        <Services />
        <Projects />
        <WhyChooseUs />
        <CTA />
        <Contact />
      </main>
      <Footer />
    </>
  )
}
