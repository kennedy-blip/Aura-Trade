import { Check, LockKeyhole, ShieldCheck, UserRound } from 'lucide-react'
import { useDesk } from '../context/workspace.js'

const roles = [
  { id: 'member', name: 'Retail Research Member', description: 'Research chat, event studies, and the paper trading sandbox.', icon: UserRound },
  { id: 'admin', name: 'Lead Quantitative Analyst', description: 'Desk configuration, raw feed exports, and compliance audit tools.', icon: ShieldCheck },
]
export default function RoleSwitcher() {
  const { role, switchRole, canSwitchAdmin, previewRoles, identity, online, accessError } = useDesk()
  const hint = previewRoles ? 'Sandbox role switching only affects this device.' : !identity && !accessError && !online ? 'Go online to verify workspace access.' : canSwitchAdmin ? 'This account is authorized. Select Lead Quantitative Analyst to open desk controls.' : !online ? 'Go online to check Lead Analyst access.' : accessError ? 'Access could not be verified. Use Check workspace access above.' : !identity ? 'Checking your account’s role…' : 'This account is a Research Member. The project owner can sign in with the authorized GitHub account for Lead Analyst access.'
  return <div className="roles"><div className="role-grid" aria-label="Workspace role" role="group">{roles.map(({ id, name, description, icon: Icon }) => {
    const selected = role === id, locked = id === 'admin' && !canSwitchAdmin
    return <button type="button" className={`role-option ${selected ? 'selected' : ''}`} key={id} aria-pressed={selected} disabled={locked} onClick={() => switchRole(id)}><span className="role-symbol"><Icon size={19}/></span><span><strong>{name}</strong><small>{description}</small></span><span className="role-state">{locked ? <LockKeyhole size={14}/> : selected ? <Check size={15}/> : <i/>}</span></button>
  })}</div><p className="helper-text">{hint}</p></div>
}
