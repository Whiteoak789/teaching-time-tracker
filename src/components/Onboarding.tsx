import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { ArrowRight, CalendarDays, Check, LockKeyhole } from "lucide-react";
import { Button, Field, Input } from "./ui";
import { useAppStore } from "@/stores/appStore";

const schema = z.object({
  name: z.string().min(2, "Enter a semester name"),
  start_date: z.string().min(10), end_date: z.string().min(10),
  required_clinical_days: z.number().min(0), required_pd_hours: z.number().min(0),
  school: z.string(), cooperating_teacher: z.string(), university_supervisor: z.string(),
}).refine((data) => data.end_date >= data.start_date, { message: "End date must follow start date", path: ["end_date"] });
type Values = z.infer<typeof schema>;

export default function Onboarding() {
  const saveSemester = useAppStore((state) => state.saveSemester);
  const saving = useAppStore((state) => state.saving);
  const { register, handleSubmit, formState: { errors } } = useForm<Values>({
    resolver: zodResolver(schema),
    defaultValues: { name: "Spring 2027", start_date: "2027-01-11", end_date: "2027-05-14", required_clinical_days: 70, required_pd_hours: 0, school: "", cooperating_teacher: "", university_supervisor: "" },
  });
  return <main className="onboarding-shell"><section className="onboarding-aside"><div className="brand-mark"><CalendarDays /></div><div><span className="eyebrow light">Teaching Time Tracker</span><h1>Your semester,<br />beautifully organized.</h1><p>Track clinical days, professional learning, notes, and verification—privately on your device.</p></div><ul className="benefit-list"><li><Check /> Calendar-first time tracking</li><li><Check /> Flexible clinical-day rules</li><li><LockKeyhole /> Fully local and private</li></ul></section><section className="onboarding-form"><div className="step-label">WELCOME · 1 OF 1</div><h2>Set up your first semester</h2><p>You can change every detail later in Settings.</p><form onSubmit={handleSubmit((values) => saveSemester({ ...values, half_day_threshold: 5, full_day_threshold: 6, partial_hours_accumulate: false, pd_counts_clinical: false, subbing_counts: true, archived: false }))}><div className="form-grid"><Field label="Semester name" error={errors.name?.message} wide><Input {...register("name")} autoFocus /></Field><Field label="Starts" error={errors.start_date?.message}><Input type="date" {...register("start_date")} /></Field><Field label="Ends" error={errors.end_date?.message}><Input type="date" {...register("end_date")} /></Field><Field label="Required clinical days"><Input type="number" step="0.5" {...register("required_clinical_days", { valueAsNumber: true })} /></Field><Field label="Required PD hours"><Input type="number" step="0.5" {...register("required_pd_hours", { valueAsNumber: true })} /></Field><Field label="School" wide><Input placeholder="Optional" {...register("school")} /></Field><Field label="Cooperating teacher"><Input placeholder="Optional" {...register("cooperating_teacher")} /></Field><Field label="University supervisor"><Input placeholder="Optional" {...register("university_supervisor")} /></Field></div><div className="onboarding-actions"><span>Your data never leaves this device unless you export or back it up.</span><Button type="submit" disabled={saving}>Create semester <ArrowRight size={17} /></Button></div></form></section></main>;
}
