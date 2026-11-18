import { Check, Moon, Sun, TerminalSquare } from 'lucide-react'
import { useDesk } from '../context/workspace.js'

const themes = [
  { id: 'obsidian', name: 'Institutional Obsidian', description: 'Charcoal with mint and cyan accents', icon: Moon },
  { id: 'savannah', name: 'Savannah Wealth', description: 'Light, frosted glass', icon: Sun },
  { id: 'amber', name: 'Terminal Amber', description: 'High-contrast amber display', icon: TerminalSquare },
]
export default function ThemeToggle() {
  const { theme, setTheme } = useDesk()
  return <div className="theme-grid" role="group" aria-label="Color theme">{themes.map(({ id, name, description, icon: Icon }) => <button type="button" key={id} aria-pressed={theme === id} className={`theme-option ${theme === id ? 'selected' : ''}`} onClick={() => setTheme(id)}><span className={`theme-sample sample-${id}`} aria-hidden="true"><span/><i/><i/><i/></span><span className="theme-name"><Icon size={16}/>{name}{theme === id && <Check size={15} className="theme-check"/>}</span><small>{description}</small></button>)}</div>
}
