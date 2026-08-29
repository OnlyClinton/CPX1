import Link from "next/link";

export type DealerNavKey="dashboard"|"inventory"|"editor"|"import"|"leads"|"appointments"|"test-drives"|"customers"|"applications"|"messages"|"reports"|"settings";

const item=(active:DealerNavKey,key:DealerNavKey,href:string,label:string)=><Link className={active===key?"active":undefined} href={href}>{label}</Link>;

export default function DealerNav({active}:{active:DealerNavKey}){
  return <nav data-wdcc-dealer-nav="canonical">
    {item(active,"dashboard","/dealer","⌂ Dashboard")}
    <strong>INVENTORY</strong>
    {item(active,"inventory","/dealer/inventory","▣ All Vehicles")}
    {item(active,"editor","/dealer/inventory/new","＋ Add / Edit Vehicle")}
    {item(active,"import","/dealer/inventory/import","⇧ Import Vehicles")}
    <strong>OPERATIONS</strong>
    {item(active,"leads","/dealer/leads","♙ Leads")}
    {item(active,"appointments","/dealer/appointments","▣ Appointments")}
    {item(active,"test-drives","/dealer/test-drives","◉ Test Drives")}
    {item(active,"customers","/dealer/customers","◎ Customers")}
    {item(active,"applications","/dealer/applications","▤ Applications")}
    {item(active,"messages","/dealer/messages","✉ Messages")}
    {item(active,"reports","/dealer/reports","▥ Reports")}
    {item(active,"settings","/dealer/settings","⚙ Settings")}
  </nav>;
}
