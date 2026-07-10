import { redirect } from "next/navigation";

/** Analytics is the landing view for the Supply Chain module. */
export default function SupplyChainIndex() {
  redirect("/supply-chain/analytics");
}
