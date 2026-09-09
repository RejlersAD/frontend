import PropTypes from "prop-types";
import { XMarkIcon } from "@heroicons/react/24/outline";

const optionValue = (option) =>
  typeof option === "string" ? option : option.value;
const optionLabel = (option) =>
  typeof option === "string" ? option.replaceAll("_", " ") : option.label;

export default function SalesActionDialog({
  action,
  values,
  busy,
  error,
  onChange,
  onClose,
  onSubmit,
}) {
  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-950/40 p-4">
      <section
        role="dialog"
        aria-modal="true"
        aria-labelledby="sales-action-title"
        className="w-full max-w-2xl overflow-hidden rounded-lg border border-slate-200 bg-white"
      >
        <header className="flex items-start justify-between border-b border-slate-200 px-5 py-4">
          <div>
            <h2
              id="sales-action-title"
              className="text-lg font-bold text-[#102a47]"
            >
              {action.title}
            </h2>
            {action.description && (
              <p className="mt-1 text-sm text-slate-600">
                {action.description}
              </p>
            )}
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="rounded-md p-1.5 text-slate-500 hover:bg-slate-100"
          >
            <XMarkIcon className="h-5 w-5" />
          </button>
        </header>

        <form onSubmit={onSubmit} className="max-h-[70vh] overflow-y-auto p-5">
          {error && (
            <div className="mb-4 rounded-md border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-800">
              {error}
            </div>
          )}
          <div className="grid gap-4 sm:grid-cols-2">
            {action.fields.map((field) => (
              <label
                key={field.name}
                className={`${field.type === "textarea" || field.full ? "sm:col-span-2" : ""} ${field.type === "checkbox" ? "flex items-start gap-3 rounded-md border border-slate-200 p-3" : "block"}`}
              >
                {field.type === "checkbox" ? (
                  <>
                    <input
                      type="checkbox"
                      checked={Boolean(values[field.name])}
                      required={field.required}
                      onChange={(event) =>
                        onChange(field.name, event.target.checked)
                      }
                      className="mt-0.5 h-4 w-4 rounded border-slate-300 text-blue-700"
                    />
                    <span>
                      <span className="block text-sm font-semibold text-slate-700">
                        {field.label}
                      </span>
                      {field.help && (
                        <span className="mt-0.5 block text-xs text-slate-500">
                          {field.help}
                        </span>
                      )}
                    </span>
                  </>
                ) : (
                  <>
                    <span className="text-sm font-semibold text-slate-700">
                      {field.label}
                      {field.required && (
                        <span className="ml-1 text-rose-600">*</span>
                      )}
                    </span>
                    {field.type === "textarea" ? (
                      <textarea
                        rows={field.rows || 3}
                        required={field.required}
                        value={values[field.name] ?? ""}
                        onChange={(event) =>
                          onChange(field.name, event.target.value)
                        }
                        placeholder={field.placeholder}
                        className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm outline-none focus:border-blue-600 focus:ring-2 focus:ring-blue-100"
                      />
                    ) : field.type === "select" ? (
                      <select
                        required={field.required}
                        value={values[field.name] ?? ""}
                        onChange={(event) =>
                          onChange(field.name, event.target.value)
                        }
                        className="mt-1 w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm outline-none focus:border-blue-600 focus:ring-2 focus:ring-blue-100"
                      >
                        <option value="">Select...</option>
                        {field.options.map((option) => (
                          <option
                            key={optionValue(option)}
                            value={optionValue(option)}
                          >
                            {optionLabel(option)}
                          </option>
                        ))}
                      </select>
                    ) : (
                      <input
                        type={field.type || "text"}
                        min={field.min}
                        step={field.type === "number" ? "0.01" : undefined}
                        required={field.required}
                        value={values[field.name] ?? ""}
                        onChange={(event) =>
                          onChange(field.name, event.target.value)
                        }
                        placeholder={field.placeholder}
                        className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm outline-none focus:border-blue-600 focus:ring-2 focus:ring-blue-100"
                      />
                    )}
                    {field.help && (
                      <span className="mt-1 block text-xs text-slate-500">
                        {field.help}
                      </span>
                    )}
                  </>
                )}
              </label>
            ))}
          </div>
          {!action.fields.length && (
            <p className="text-sm text-slate-600">
              Confirm this governed lifecycle action.
            </p>
          )}
          <footer className="mt-6 flex justify-end gap-2 border-t border-slate-200 pt-4">
            <button
              type="button"
              onClick={onClose}
              className="rounded-md border border-slate-300 px-4 py-2 text-sm font-semibold"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={busy}
              className={`rounded-md px-4 py-2 text-sm font-semibold text-white disabled:opacity-50 ${action.danger ? "bg-rose-700" : "bg-blue-700"}`}
            >
              {busy ? "Processing..." : action.submitLabel || action.title}
            </button>
          </footer>
        </form>
      </section>
    </div>
  );
}

SalesActionDialog.propTypes = {
  action: PropTypes.shape({
    title: PropTypes.string.isRequired,
    description: PropTypes.string,
    submitLabel: PropTypes.string,
    danger: PropTypes.bool,
    fields: PropTypes.arrayOf(PropTypes.object).isRequired,
  }).isRequired,
  values: PropTypes.object.isRequired,
  busy: PropTypes.bool.isRequired,
  error: PropTypes.string,
  onChange: PropTypes.func.isRequired,
  onClose: PropTypes.func.isRequired,
  onSubmit: PropTypes.func.isRequired,
};
SalesActionDialog.defaultProps = { error: "" };
