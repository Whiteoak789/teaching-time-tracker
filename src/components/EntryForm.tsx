import { useEffect, useMemo } from "react";
import { useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Copy, Save, Trash2 } from "lucide-react";
import { differenceInMinutes, parse } from "date-fns";
import { Button, Field, Input, Modal, Toggle } from "./ui";
import { useAppStore } from "@/stores/appStore";
import { duplicateTimeEntry } from "@/api/tauri";

const schema = z.object({
  entry_date: z.string().min(10), category_id: z.string().min(1, "Choose a category"),
  start_time: z.string().optional(), end_time: z.string().optional(), duration_hours: z.number().min(0).max(24),
  all_day: z.boolean(), counts_clinical: z.boolean(), counts_pd: z.boolean(),
  day_credit_override: z.union([z.literal(""), z.number().min(0).max(2)]),
  location: z.string(), teacher: z.string(), description: z.string().max(300), notes: z.string().max(3000),
  verification_required: z.boolean(), verified: z.boolean(), verifier_name: z.string(), verifier_initials: z.string(), attachment_reference: z.string(),
}).refine((value) => !value.start_time || !value.end_time || value.end_time > value.start_time, { path: ["end_time"], message: "End must be after start" });
type Values = z.infer<typeof schema>;

export default function EntryForm() {
  const { data, selectedDate, entryModalOpen, editingEntryId, closeEntryModal, saveEntry, deleteEntry, setData, saving } = useAppStore();
  const activeSemester = data?.semesters.find((item) => item.id === data.settings.active_semester_id) ?? data?.semesters[0];
  const editing = data?.entries.find((entry) => entry.id === editingEntryId);
  const defaultCategory = data?.categories.find((category) => category.id === data.settings.default_category_id) ?? data?.categories.find((category) => category.active);
  const defaultValues = useMemo<Values>(() => ({
    entry_date: editing?.entry_date ?? selectedDate, category_id: editing?.category_id ?? defaultCategory?.id ?? "",
    start_time: editing?.start_time ?? "08:00", end_time: editing?.end_time ?? "14:00", duration_hours: editing ? editing.duration_minutes / 60 : (data?.settings.default_duration ?? 360) / 60,
    all_day: editing?.all_day ?? false, counts_clinical: editing?.counts_clinical ?? defaultCategory?.counts_clinical ?? false,
    counts_pd: editing?.counts_pd ?? defaultCategory?.counts_pd ?? false, day_credit_override: editing?.day_credit_override ?? "",
    location: editing?.location ?? activeSemester?.school ?? "", teacher: editing?.teacher ?? activeSemester?.cooperating_teacher ?? "",
    description: editing?.description ?? "", notes: editing?.notes ?? "", verification_required: editing?.verification_required ?? false,
    verified: editing?.verified ?? false, verifier_name: editing?.verifier_name ?? "", verifier_initials: editing?.verifier_initials ?? "", attachment_reference: editing?.attachment_reference ?? "",
  }), [editing, selectedDate, defaultCategory, data?.settings.default_duration, activeSemester]);
  const { register, control, reset, setValue, handleSubmit, formState: { errors } } = useForm<Values>({ resolver: zodResolver(schema), defaultValues });
  const [categoryId, startTime, endTime, allDay, verificationRequired, verified, countsClinical, countsPd] = useWatch({ control, name: ["category_id", "start_time", "end_time", "all_day", "verification_required", "verified", "counts_clinical", "counts_pd"] });
  useEffect(() => { reset(defaultValues); }, [defaultValues, reset, entryModalOpen]);
  useEffect(() => {
    if (startTime && endTime && endTime > startTime && !allDay) {
      const base = new Date(2020, 0, 1);
      const minutes = differenceInMinutes(parse(endTime, "HH:mm", base), parse(startTime, "HH:mm", base));
      if (minutes >= 0) setValue("duration_hours", minutes / 60);
    }
  }, [startTime, endTime, allDay, setValue]);

  const updateCategoryDefaults = (id: string) => {
    const category = data?.categories.find((item) => item.id === id);
    if (category) { setValue("counts_clinical", category.counts_clinical); setValue("counts_pd", category.counts_pd); }
  };

  if (!data || !activeSemester) return null;
  const submit = (values: Values) => saveEntry({
    id: editing?.id, semester_id: activeSemester.id, category_id: values.category_id, entry_date: values.entry_date,
    start_time: values.all_day ? null : values.start_time || null, end_time: values.all_day ? null : values.end_time || null,
    duration_minutes: Math.round(values.duration_hours * 60), all_day: values.all_day, counts_clinical: values.counts_clinical,
    counts_pd: values.counts_pd, day_credit_override: values.day_credit_override === "" ? null : Number(values.day_credit_override),
    location: values.location, teacher: values.teacher, description: values.description, notes: values.notes,
    verification_required: values.verification_required, verified: values.verification_required && values.verified,
    verified_date: values.verified ? new Date().toISOString().slice(0, 10) : null, verifier_name: values.verifier_name,
    verifier_initials: values.verifier_initials, attachment_reference: values.attachment_reference, recurrence_group_id: editing?.recurrence_group_id ?? null,
  });

  return (
    <Modal
      open={entryModalOpen}
      onClose={closeEntryModal}
      title={editing ? "Edit time entry" : "Add time"}
      subtitle="Record the work that made today count."
      className="entry-modal"
    >
      <form
        id="entry-time-form"
        className="modal-scroll"
        onSubmit={handleSubmit(submit)}
      >
        <div className="form-section">
          <h3>Time & category</h3>
          <div className="form-grid">
            <Field label="Date">
              <Input
                type="date"
                min={activeSemester.start_date}
                max={activeSemester.end_date}
                {...register("entry_date")}
              />
            </Field>
            <Field label="Category" error={errors.category_id?.message}>
              <select
                className="input"
                {...register("category_id", {
                  onChange: (event) => updateCategoryDefaults(event.target.value),
                })}
              >
                {data.categories
                  .filter((item) => item.active)
                  .map((category) => (
                    <option key={category.id} value={category.id}>
                      {category.name}
                    </option>
                  ))}
              </select>
            </Field>
            <div className="field-wide compact-toggles">
              <Toggle
                checked={allDay}
                onChange={(value) => {
                  setValue("all_day", value);
                  if (value) {
                    setValue("duration_hours", activeSemester.full_day_threshold);
                  }
                }}
                label="All day"
              />
            </div>
            {!allDay && (
              <>
                <Field label="Start time">
                  <Input type="time" {...register("start_time")} />
                </Field>
                <Field label="End time" error={errors.end_time?.message}>
                  <Input type="time" {...register("end_time")} />
                </Field>
              </>
            )}
            <Field label="Duration (hours)" hint="You can edit this manually">
              <Input
                type="number"
                min="0"
                max="24"
                step="0.25"
                {...register("duration_hours", { valueAsNumber: true })}
              />
            </Field>
            <Field
              label="Day-credit override"
              hint="Leave blank for automatic"
            >
              <Input
                type="number"
                min="0"
                max="2"
                step="0.25"
                placeholder="Automatic"
                {...register("day_credit_override", {
                  setValueAs: (value) => value === "" ? "" : Number(value),
                })}
              />
            </Field>
          </div>
          <div className="inline-toggles">
            <Toggle
              checked={countsClinical}
              onChange={(value) => setValue("counts_clinical", value)}
              label="Count toward clinical days"
            />
            <Toggle
              checked={countsPd}
              onChange={(value) => setValue("counts_pd", value)}
              label="Count toward PD"
            />
          </div>
        </div>

        <div className="form-section">
          <h3>Details</h3>
          <div className="form-grid">
            <Field label="Location / school">
              <Input {...register("location")} />
            </Field>
            <Field label="Teacher / supervisor">
              <Input {...register("teacher")} />
            </Field>
            <Field label="Description" wide>
              <Input
                placeholder="What did you work on?"
                {...register("description")}
              />
            </Field>
            <Field label="Notes" wide>
              <textarea
                className="input textarea"
                placeholder="Optional private notes"
                {...register("notes")}
              />
            </Field>
            <Field label="Attachment / reference" wide>
              <Input
                placeholder="File path, document name, or URL"
                {...register("attachment_reference")}
              />
            </Field>
          </div>
        </div>

        <div className="form-section">
          <h3>Verification</h3>
          <div className="inline-toggles">
            <Toggle
              checked={verificationRequired}
              onChange={(value) => {
                setValue("verification_required", value);
                if (!value) setValue("verified", false);
              }}
              label="Verification required"
            />
            <Toggle
              checked={verified}
              onChange={(value) => setValue("verified", value)}
              label="Verified"
            />
          </div>
          {verificationRequired && (
            <div className="form-grid verify-fields">
              <Field label="Verifier name">
                <Input {...register("verifier_name")} />
              </Field>
              <Field label="Initials">
                <Input maxLength={8} {...register("verifier_initials")} />
              </Field>
            </div>
          )}
        </div>
      </form>

      <footer className="modal-actions">
        <div>
          {editing && (
            <>
              <Button
                type="button"
                variant="danger"
                onClick={async () => {
                  if (confirm("Delete this time entry? This action can be recovered from a backup.")) {
                    await deleteEntry(editing.id);
                    closeEntryModal();
                  }
                }}
              >
                <Trash2 size={16} /> Delete
              </Button>
              <Button
                type="button"
                variant="ghost"
                onClick={async () => {
                  setData(await duplicateTimeEntry(editing.id, editing.entry_date));
                  closeEntryModal();
                }}
              >
                <Copy size={16} /> Duplicate
              </Button>
            </>
          )}
        </div>
        <div>
          <Button type="button" variant="secondary" onClick={closeEntryModal}>
            Cancel
          </Button>
          <Button
            type="submit"
            form="entry-time-form"
            disabled={saving}
          >
            <Save size={16} /> {editing ? "Save changes" : "Add time"}
          </Button>
        </div>
      </footer>
    </Modal>
  );
}
