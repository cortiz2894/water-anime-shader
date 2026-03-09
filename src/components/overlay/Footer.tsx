'use client'

import { Twitter, Instagram, Youtube, Github } from 'lucide-react'
import Link from 'next/link'

const socialLinks = [
  { icon: Twitter, href: 'https://x.com/cortiz2894', label: 'Twitter' },
  { icon: Instagram, href: 'https://www.instagram.com/cortiz.dev/', label: 'Instagram' },
  { icon: Youtube, href: 'https://www.youtube.com/channel/UCFnCV2VGESofcA5gZU8ao2A', label: 'YouTube' },
  { icon: Github, href: 'https://github.com/cortiz2894', label: 'GitHub' },
]
const Footer =() => (

<footer className="fixed bottom-0 left-0 w-full flex justify-between items-center px-8 py-4 bg-[#0a0a0a] font-plex text-[8px] tracking-[2.5px] text-white uppercase">
<div className="flex justify-center items-center gap-3">
    <span>&reg;Made by</span>
    <img
      src="/logo-cortiz.svg"
      alt="Cortiz Logo"
      className="h-5 opacity-50 hidden sm:block"
    />

</div>
  <span className="hidden sm:inline">Creative Boilerplate — v0.1.6</span>
  <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
    {socialLinks.map(({ icon: Icon, href, label }) => (
      <Link
        key={label}
        href={href}
        target="_blank"
        rel="noopener noreferrer"
        aria-label={label}
        style={{
          color: 'rgba(255, 255, 255, 0.5)',
          transition: 'all 0.2s ease',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.color = '#fff'
          e.currentTarget.style.transform = 'scale(1.1)'
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.color = 'rgba(255, 255, 255, 0.5)'
          e.currentTarget.style.transform = 'scale(1)'
        }}
      >
        <Icon size={18} />
      </Link>
    ))}
  </div>
  
</footer>
)

export default Footer;