// Same-origin, preview-safe derivatives of the five verified first-party
// recovery photos. Static URLs avoid Android WebView data-URI decode failures.
export const WDCC_RECOVERED_MEDIA_PATHS={
  nissan350z:"/wdcc-recovered-media/2004-nissan-350z.webp",
  fordF150:"/wdcc-recovered-media/2016-ford-f150.webp",
  hondaPilot:"/wdcc-recovered-media/2019-honda-pilot.webp",
  kiaSportage:"/wdcc-recovered-media/2019-kia-sportage.webp",
  toyotaRav4:"/wdcc-recovered-media/2019-toyota-rav4.webp"
} as const;
