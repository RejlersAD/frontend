import { useEffect, useRef, useState } from "react";
import PropTypes from "prop-types";
import salesService from "../../services/sales.service";
import SalesEmailOpportunityForm from "./SalesEmailOpportunityForm";
import useSalesEmailClients from "./useSalesEmailClients";
import { registrationFields } from "./salesOpportunityRegistration";

export default function SalesOpportunityRegistrationDialog({
  onClose,
  onCreated,
}) {
  const clients = useSalesEmailClients();
  const [clientChoice, setClientChoice] = useState("");
  const [state, setState] = useState({
    saving: false,
    error: "",
    fieldErrors: {},
  });
  const [frameworks, setFrameworks] = useState([]);
  const inFlight = useRef(false);
  const requestId = useRef(null);
  if (!requestId.current) requestId.current = crypto.randomUUID();
  useEffect(() => {
    let active = true;
    salesService
      .getFrameworks({ status: "active", page_size: 500 })
      .then((data) => {
        if (active)
          setFrameworks(Array.isArray(data) ? data : data?.results || []);
      })
      .catch(() => {
        /* Frameworks are optional; registration remains available. */
      });
    return () => {
      active = false;
    };
  }, []);
  const submit = async (event) => {
    event.preventDefault();
    if (
      inFlight.current ||
      clients.loading ||
      clients.error ||
      !clients.records.some((client) => client.id === clientChoice)
    )
      return;
    const form = new FormData(event.currentTarget);
    inFlight.current = true;
    setState({ saving: true, error: "", fieldErrors: {} });
    try {
      const record = await salesService.createDeal({
        ...registrationFields(form),
        registration_request_id: requestId.current,
        deal_name: form.get("deal_name"),
        client: clientChoice,
        client_reference: form.get("client_reference"),
        description: form.get("description"),
        scope_type: form.get("scope_type") || "",
        framework: form.get("framework") || null,
        estimated_hours: form.get("estimated_hours") || null,
        project_duration_months: form.get("project_duration_months") || null,
      });
      onCreated(record);
    } catch (error) {
      const data = error?.response?.data;
      const fieldErrors = Object.fromEntries(
        Object.entries(data || {})
          .filter(
            ([, value]) =>
              typeof value === "string" ||
              (Array.isArray(value) && typeof value[0] === "string"),
          )
          .map(([key, value]) => [
            key,
            Array.isArray(value) ? value[0] : value,
          ]),
      );
      setState({
        saving: false,
        fieldErrors,
        error:
          error?.response?.status === 409
            ? "This registration changed or was already saved with different details. Your entries are retained; review the existing opportunity before retrying."
            : data?.detail ||
              "Opportunity could not be registered. Your entries are retained; review the details and retry.",
      });
    } finally {
      inFlight.current = false;
    }
  };
  return (
    <SalesEmailOpportunityForm
      manual
      clients={clients.records}
      clientChoice={clientChoice}
      onClientChange={setClientChoice}
      onSubmit={submit}
      onClose={onClose}
      submitting={state.saving}
      error={state.error}
      fieldErrors={state.fieldErrors}
      loadingClients={clients.loading}
      clientError={clients.error}
      onRetryClients={clients.load}
      frameworks={frameworks}
    />
  );
}
SalesOpportunityRegistrationDialog.propTypes = {
  onClose: PropTypes.func.isRequired,
  onCreated: PropTypes.func.isRequired,
};
