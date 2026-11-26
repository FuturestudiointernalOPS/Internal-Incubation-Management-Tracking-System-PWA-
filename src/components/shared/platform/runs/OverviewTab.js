import OverviewStats from "./OverviewStats";
import OverviewFilters from "./OverviewFilters";
import OverviewResponsesTable from "./OverviewResponsesTable";
import OverviewRunModals from "./OverviewRunModals";

export default function OverviewTab(props) {
  return (
    <>
      <OverviewStats ctx={props} />
      <OverviewFilters ctx={props} />
      <OverviewResponsesTable ctx={props} />
      <OverviewRunModals ctx={props} />
    </>
  );
}
