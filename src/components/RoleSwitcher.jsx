import { Check, LockKeyhole, ShieldCheck, UserRound } from 'lucide-react'
import { useDesk } from '../context/workspace.js'

const roles = [
  { id: 'member', name: 'Retail Research Member', description: 'Research chat, event studies, and the paper trading sandbox.', icon: UserRound },
  { id: 'admin', name: 'Lead Quantitative Analyst', description: 'Desk configuration, raw feed exports, and compliance audit tools.', icon: ShieldCheck },
]
export default function RoleSwitcher() {
  const { role, switchRole, canSwitchAdmin, previewRoles } = useDesk()
  return <div className="roles"><div className="role-grid" aria-label="Workspace role" role="group">{roles.map(({ id, name, description, icon: Icon }) => {
    const selected = role === id, locked = id === 'admin' && !canSwitchAdmin
    return <button type="button" className={`role-option ${selected ? 'selected' : ''}`} key={id} aria-pressed={selected} disabled={locked} onClick={() => switchRole(id)}><span className="role-symbol"><Icon size={19}/></span><span><strong>{name}</strong><small>{description}</small></span><span className="role-state">{locked ? <LockKeyhole size={14}/> : selected ? <Check size={15}/> : <i/>}</span></button>
  })}</div><p className="helper-text">{previewRoles ? 'Sandbox role switching only affects this device. Hosted privileges require an authorized account.' : canSwitchAdmin ? 'Use the member view to review the workspace with restricted controls.' : 'An authorized account is required to enter the Lead Analyst desk.'}</p></div>
}
