import type { ButtonHTMLAttributes, InputHTMLAttributes, ReactNode } from "react";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";

export function Button({ className, variant = "primary", size = "md", ...props }: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: "primary" | "secondary" | "ghost" | "danger"; size?: "sm" | "md" | "icon" }) {
  return <button className={cn("button", `button-${variant}`, `button-${size}`, className)} {...props} />;
}

export function Input({ className, ...props }: InputHTMLAttributes<HTMLInputElement>) {
  return <input className={cn("input", className)} {...props} />;
}

export function Field({ label, hint, error, children, wide = false }: { label: string; hint?: string; error?: string; children: ReactNode; wide?: boolean }) {
  return <label className={cn("field", wide && "field-wide")}><span className="field-label">{label}</span>{children}{error ? <span className="field-error">{error}</span> : hint ? <span className="field-hint">{hint}</span> : null}</label>;
}

export function Toggle({ checked, onChange, label, description }: { checked: boolean; onChange: (value: boolean) => void; label: string; description?: string }) {
  return <button type="button" className="toggle-row" role="switch" aria-checked={checked} onClick={() => onChange(!checked)}><span className={cn("toggle", checked && "toggle-on")}><span /></span><span><strong>{label}</strong>{description && <small>{description}</small>}</span></button>;
}

export function Modal({ open, onClose, title, subtitle, children, className }: { open: boolean; onClose: () => void; title: string; subtitle?: string; children: ReactNode; className?: string }) {
  if (!open) return null;
  return <div className="modal-root" role="dialog" aria-modal="true" aria-labelledby="modal-title"><button className="modal-backdrop" onClick={onClose} aria-label="Close dialog" /><section className={cn("modal-card", className)}><header className="modal-header"><div><h2 id="modal-title">{title}</h2>{subtitle && <p>{subtitle}</p>}</div><Button variant="ghost" size="icon" onClick={onClose} aria-label="Close"><X size={19} /></Button></header>{children}</section></div>;
}

export function EmptyState({ icon, title, body, action }: { icon: ReactNode; title: string; body: string; action?: ReactNode }) {
  return <div className="empty-state"><div className="empty-icon">{icon}</div><h3>{title}</h3><p>{body}</p>{action}</div>;
}

export function ProgressBar({ value, color = "#6f8edb" }: { value: number; color?: string }) {
  return <div className="progress-track" aria-label={`${Math.round(value)} percent complete`}><span style={{ width: `${Math.min(100, Math.max(0, value))}%`, background: color }} /></div>;
}

export function Pill({ children, tone = "neutral" }: { children: ReactNode; tone?: "neutral" | "green" | "amber" | "red" | "blue" }) {
  return <span className={cn("pill", `pill-${tone}`)}>{children}</span>;
}
