const cloudflareContextSymbol=Symbol.for("__cloudflare-context__");

type CloudflareContextShape={env?:Record<string,unknown>};

export function cloudflareEnv(){
  const context=(globalThis as any)[cloudflareContextSymbol] as CloudflareContextShape|undefined;
  if(!context?.env)throw Error("CLOUDFLARE_CONTEXT_MISSING");
  return context.env as Record<string,any>;
}

export function cloudflareDataBucket(){
  const bucket=cloudflareEnv().WDCC_DATA;
  if(!bucket)throw Error("R2_BINDING_MISSING:WDCC_DATA");
  return bucket as any;
}
