import {WDCC_CORRECT_LOGO_DATA_URI} from "../wdccCorrectLogoData";

export const dynamic="force-static";

export async function GET(){
  const encoded=WDCC_CORRECT_LOGO_DATA_URI.split(",",2)[1]||"";
  const binary=atob(encoded);
  const bytes=new Uint8Array(binary.length);
  for(let i=0;i<binary.length;i++)bytes[i]=binary.charCodeAt(i);
  return new Response(bytes,{status:200,headers:{"Content-Type":"image/webp","Cache-Control":"public, max-age=31536000, immutable","X-WDCC-Logo":"owner-approved"}});
}
