import fs from "node:fs";
import path from "node:path";
import {createHash} from "node:crypto";
import sharp from "sharp";
import {WDCC_MOCKUP_FINGERPRINT_PROVENANCE,WDCC_MOCKUP_FINGERPRINT_SHA256,WDCC_MOCKUP_REFERENCE_CROP_SHA256,wdccMockupFingerprint} from "./wdcc-mockup-fingerprints.mjs";

const [metricsPath="mockup-v2-proof/metrics.json",outDir="mockup-v2-proof"]=process.argv.slice(2);
const threshold=95;
const maximumNonPassingScore=threshold-1;
// Preserve the v4 structural contract exactly: RGB-MAE is mandatory and at
// least one of luma/edge cosine must agree. Color and chroma remain mandatory.
// Directional alignment is an additional per-view requirement whose floors are
// the next hundredth above that reference's >13px horizontal-drift control.
// Per-view calibration avoids rejecting a near-registered mobile render merely
// because different approved crops have different directional-edge density.
const perceptualThresholds={
  source:"four approved crops + deterministic positive/negative controls",
  saturationCosine:.84,
  chromaCosine:.84,
  structure:{rgbMae:22,lumaCosine:.968,edgeCosine:.70,minSecondaryVotes:1,rule:"RGB-MAE is mandatory; at least one of luma/edge must pass (the stricter v4 behavior)"},
  alignment:{directionalEdgeCosineByView:{desktopStorefront:.71,mobileStorefront:.35,desktopDealer:.63,mobileDealer:.55},rule:"per-view floor is the next hundredth above its >13px horizontal-drift negative control"},
  driftControl:{minimumRejectedPixels:13,centerZoomRatio:1.05}
};
const referenceDimensions={
  desktopStorefront:{width:1440,height:2119},
  mobileStorefront:{width:390,height:844},
  desktopDealer:{width:1440,height:1348},
  mobileDealer:{width:390,height:866}
};
const references={
  mobileStorefront:"1000003354.png — approved 390px storefront",
  desktopStorefront:"1000003294.png / 53327.jpg — approved wide storefront",
  desktopDealer:"1000003293.png / 1000003294.png — approved 1280px+ editor",
  mobileDealer:"1000003293.png / 1000003294.png — approved 390px editor"
};

const near=(value,target,tolerance)=>Number.isFinite(Number(value))&&Math.abs(Number(value)-target)<=tolerance;
const between=(value,min,max)=>Number.isFinite(Number(value))&&Number(value)>=min&&Number(value)<=max;
const normalized=value=>String(value??"").replace(/\s+/g," ").trim().toUpperCase();
const includesAll=(values,expected)=>{const actual=(values||[]).map(normalized);return expected.every(item=>actual.some(value=>value.includes(normalized(item))))};
const sourceIncludes=(value,expected)=>{try{return decodeURIComponent(String(value||"")).includes(expected)}catch{return String(value||"").includes(expected)}};
const rgb=value=>{const match=String(value||"").match(/rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)/i);return match?[Number(match[1]),Number(match[2]),Number(match[3])]:null};
const colorNear=(value,target,tolerance=28)=>{const actual=rgb(value);if(!actual)return false;return Math.hypot(actual[0]-target[0],actual[1]-target[1],actual[2]-target[2])<=tolerance};
const criterion=(id,points,pass,target,actual)=>({id,points,earned:pass?points:0,pass:Boolean(pass),target,actual});
const category=(name,maximum,criteria)=>({name,maximum,earned:criteria.reduce((sum,item)=>sum+item.earned,0),criteria});
const honestScore=(rubricScore,eligibilityFailures)=>eligibilityFailures.length?Math.min(rubricScore,maximumNonPassingScore):rubricScore;

function fingerprintMetrics(reference,current,width,height){
  const luminance=buffer=>{const values=[];for(let i=0;i<buffer.length;i+=3)values.push(.2126*buffer[i]+.7152*buffer[i+1]+.0722*buffer[i+2]);return values};
  const saturation=buffer=>{const values=[];for(let i=0;i<buffer.length;i+=3)values.push(Math.max(buffer[i],buffer[i+1],buffer[i+2])-Math.min(buffer[i],buffer[i+1],buffer[i+2]));return values};
  const chroma=buffer=>{const values=[];for(let i=0;i<buffer.length;i+=3)values.push(buffer[i]-buffer[i+1],buffer[i+2]-buffer[i+1]);return values};
  const edge=values=>{const result=[];for(let y=0;y<height;y++)for(let x=0;x<width;x++){const i=y*width+x;const dx=x<width-1?Math.abs(values[i+1]-values[i]):0;const dy=y<height-1?Math.abs(values[i+width]-values[i]):0;result.push(Math.min(255,dx+dy))}return result};
  const directionalEdge=values=>{const result=[];for(let y=0;y<height;y++)for(let x=0;x<width;x++){const i=y*width+x;result.push(x<width-1?values[i+1]-values[i]:0,y<height-1?values[i+width]-values[i]:0)}return result};
  const cosine=(left,right)=>{let numerator=0,leftSquare=0,rightSquare=0;for(let i=0;i<left.length;i++){numerator+=left[i]*right[i];leftSquare+=left[i]**2;rightSquare+=right[i]**2}return leftSquare&&rightSquare?numerator/Math.sqrt(leftSquare*rightSquare):0};
  let rgbDifference=0;for(let i=0;i<reference.length;i++)rgbDifference+=Math.abs(reference[i]-current[i]);
  const referenceLuma=luminance(reference),currentLuma=luminance(current),referenceEdge=edge(referenceLuma),currentEdge=edge(currentLuma);
  return {rgbMae:Math.round(rgbDifference/reference.length*100)/100,lumaCosine:Math.round(cosine(referenceLuma,currentLuma)*10000)/10000,edgeCosine:Math.round(cosine(referenceEdge,currentEdge)*10000)/10000,directionalEdgeCosine:Math.round(cosine(directionalEdge(referenceLuma),directionalEdge(currentLuma))*10000)/10000,saturationCosine:Math.round(cosine(saturation(reference),saturation(current))*10000)/10000,chromaCosine:Math.round(cosine(chroma(reference),chroma(current))*10000)/10000};
}

function perceptualPass(measured,view){
  const rgbMaePass=measured.rgbMae<=perceptualThresholds.structure.rgbMae;
  const directionalEdgeFloor=perceptualThresholds.alignment.directionalEdgeCosineByView[view];
  const directionalEdgePass=Number.isFinite(directionalEdgeFloor)&&measured.directionalEdgeCosine>=directionalEdgeFloor;
  const secondaryVotes=[
    measured.lumaCosine>=perceptualThresholds.structure.lumaCosine,
    measured.edgeCosine>=perceptualThresholds.structure.edgeCosine
  ].filter(Boolean).length;
  return {
    rgbMaePass,
    directionalEdgeFloor,
    directionalEdgePass,
    secondaryVotes,
    structuralVotes:Number(rgbMaePass)+secondaryVotes,
    pass:rgbMaePass&&
      directionalEdgePass&&
      measured.saturationCosine>=perceptualThresholds.saturationCosine&&
      measured.chromaCosine>=perceptualThresholds.chromaCosine&&
      secondaryVotes>=perceptualThresholds.structure.minSecondaryVotes
  };
}

function horizontalFlip(source,width,height){
  const target=Buffer.alloc(source.length);
  for(let y=0;y<height;y++)for(let x=0;x<width;x++){
    const from=(y*width+x)*3,to=(y*width+(width-1-x))*3;
    target[to]=source[from];target[to+1]=source[from+1];target[to+2]=source[from+2];
  }
  return target;
}

function grayscale(source){
  const target=Buffer.alloc(source.length);
  for(let index=0;index<source.length;index+=3){
    const value=Math.round(.2126*source[index]+.7152*source[index+1]+.0722*source[index+2]);
    target[index]=value;target[index+1]=value;target[index+2]=value;
  }
  return target;
}

function verticalShift(source,width,height,rows){
  const target=Buffer.alloc(source.length,127),rowBytes=width*3;
  source.copy(target,rows*rowBytes,0,(height-rows)*rowBytes);
  return target;
}

function horizontalShift(source,width,height,columns){
  const target=Buffer.alloc(source.length,127),rowBytes=width*3,offsetBytes=columns*3;
  for(let y=0;y<height;y++)source.copy(target,y*rowBytes+offsetBytes,y*rowBytes,y*rowBytes+rowBytes-offsetBytes);
  return target;
}

function centerZoom(source,width,height,ratio){
  const target=Buffer.alloc(source.length,127),centerX=(width-1)/2,centerY=(height-1)/2;
  for(let y=0;y<height;y++)for(let x=0;x<width;x++){
    const sourceX=Math.max(0,Math.min(width-1,Math.round((x-centerX)/ratio+centerX)));
    const sourceY=Math.max(0,Math.min(height-1,Math.round((y-centerY)/ratio+centerY)));
    const from=(sourceY*width+sourceX)*3,to=(y*width+x)*3;
    target[to]=source[from];target[to+1]=source[from+1];target[to+2]=source[from+2];
  }
  return target;
}

function calibrationControls(view,reference,width,height){
  const dimensions=referenceDimensions[view];
  const driftRows=Math.ceil((perceptualThresholds.driftControl.minimumRejectedPixels+.01)*height/dimensions.height);
  const driftColumns=Math.ceil((perceptualThresholds.driftControl.minimumRejectedPixels+.01)*width/dimensions.width);
  const effectiveVerticalDriftPixels=Math.round(driftRows*dimensions.height/height*100)/100;
  const effectiveHorizontalDriftPixels=Math.round(driftColumns*dimensions.width/width*100)/100;
  const candidates={
    positive:reference,
    horizontalFlip:horizontalFlip(reference,width,height),
    grayscale:grayscale(reference),
    verticalDrift:verticalShift(reference,width,height,driftRows),
    horizontalDrift:horizontalShift(reference,width,height,driftColumns),
    centerZoomCrop:centerZoom(reference,width,height,perceptualThresholds.driftControl.centerZoomRatio)
  };
  const controls={};
  for(const[name,candidate]of Object.entries(candidates)){
    const metrics=fingerprintMetrics(reference,candidate,width,height),result=perceptualPass(metrics,view);
    controls[name]={...metrics,...result,
      ...(name==="verticalDrift"?{rows:driftRows,effectiveDriftPixels:effectiveVerticalDriftPixels}:{}),
      ...(name==="horizontalDrift"?{columns:driftColumns,effectiveDriftPixels:effectiveHorizontalDriftPixels}:{}),
      ...(name==="centerZoomCrop"?{ratio:perceptualThresholds.driftControl.centerZoomRatio}:{})};
  }
  return {
    method:"approved fingerprint self-match must pass; horizontal flip, grayscale, >13px horizontal/vertical drift, and 5% center zoom/crop must fail",
    pass:controls.positive.pass&&!controls.horizontalFlip.pass&&!controls.grayscale.pass&&!controls.verticalDrift.pass&&!controls.horizontalDrift.pass&&!controls.centerZoomCrop.pass&&effectiveVerticalDriftPixels>perceptualThresholds.driftControl.minimumRejectedPixels&&effectiveHorizontalDriftPixels>perceptualThresholds.driftControl.minimumRejectedPixels,
    controls
  };
}

async function measureReferenceMatch(view,screenshot){
  try{
    const screenshotPath=path.join(outDir,screenshot);
    const {raw:reference,size}=wdccMockupFingerprint(view);
    const referenceHash=createHash("sha256").update(reference).digest("hex");
    if(referenceHash!==WDCC_MOCKUP_FINGERPRINT_SHA256[view])throw new Error(`reference fingerprint integrity mismatch: ${view}`);
    const current=await sharp(screenshotPath).resize(size.width,size.height,{fit:"contain",position:"top",background:{r:127,g:127,b:127}}).removeAlpha().raw().toBuffer();
    const measured=fingerprintMetrics(reference,current,size.width,size.height);
    const result=perceptualPass(measured,view),calibration=calibrationControls(view,reference,size.width,size.height);
    return {...measured,...result,screenshot,reference:WDCC_MOCKUP_FINGERPRINT_PROVENANCE[view],referenceCropSha256:WDCC_MOCKUP_REFERENCE_CROP_SHA256[view],referenceFingerprintSha256:referenceHash,grid:`${size.width}x${size.height}`,fit:"contain/top",calibration,pass:result.pass&&calibration.pass};
  }catch(error){return {screenshot,pass:false,error:error instanceof Error?error.message:String(error)}}
}

function storefront(metrics,mobile){
  const m=metrics||{};
  const desktopBenefitGeometry=(m.benefitGeometry||[]).length===4&&(m.benefitGeometry||[]).every(item=>
    between(item.box?.width,352,368)&&between(item.box?.height,208,218)&&
    item.textAlign==="center"&&
    between(item.icon?.width,40,58)&&between(item.icon?.height,40,58)&&
    Math.abs(((item.icon?.x||0)+(item.icon?.width||0)/2)-((item.box?.x||0)+(item.box?.width||0)/2))<=6&&
    Math.abs(((item.heading?.x||0)+(item.heading?.width||0)/2)-((item.box?.x||0)+(item.box?.width||0)/2))<=6&&
    Math.abs(((item.copy?.x||0)+(item.copy?.width||0)/2)-((item.box?.x||0)+(item.box?.width||0)/2))<=8&&
    between((item.icon?.y||0)-(item.box?.y||0),20,40)&&
    between((item.heading?.y||0)-(item.box?.y||0),82,108)&&
    between((item.copy?.y||0)-(item.box?.y||0),112,142)&&
    (item.heading?.y||0)>=(item.icon?.bottom||0)+18
  );
  const layout=mobile?[
    criterion("viewport-header-overflow",8,m.viewportWidth===390&&m.documentWidth<=391&&between(m.headerHeight,76,80),"390px viewport; 76–80px header; ≤1px overflow",{viewport:m.viewportWidth,header:m.headerHeight,document:m.documentWidth}),
    criterion("hero-boundary",8,between(m.heroHeight,486,498)&&between(m.h1Top,228,250),"hero 486–498px; headline y 228–250",{hero:m.heroHeight,h1Top:m.h1Top}),
    criterion("benefits-boundary",8,between(m.benefitsHeight,176,181)&&between(m.inventoryTop,740,752),"benefits 176–181px; inventory y 740–752",{benefits:m.benefitsHeight,inventoryTop:m.inventoryTop}),
    criterion("two-column-benefits",8,m.benefitColumns===2,"2 benefit columns",m.benefitColumns),
    criterion("inventory-fold-and-card-strip",8,between(m.inventoryTop,740,752)&&between(m.firstCardWidth,108,140)&&m.cards===5,"inventory heading at approved fold; 5 cards; 108–140px first card",{inventoryTop:m.inventoryTop,cards:m.cards,width:m.firstCardWidth})
  ]:[
    criterion("viewport-header-overflow",8,m.viewportWidth===1440&&m.documentWidth<=1441&&between(m.headerHeight,122,130),"1440px viewport; 122–130px header; ≤1px overflow",{viewport:m.viewportWidth,header:m.headerHeight,document:m.documentWidth}),
    criterion("hero-boundary",8,between(m.heroHeight,656,668)&&between(m.inventoryTop,1035,1047),"hero 656–668px; inventory y 1035–1047",{hero:m.heroHeight,inventoryTop:m.inventoryTop}),
    criterion("benefits-grid",8,between(m.benefitsHeight,208,218)&&m.benefitColumns===4&&desktopBenefitGeometry,"208–218px; 4 equal columns; each icon → heading → copy stack is centered at approved scale",{height:m.benefitsHeight,columns:m.benefitColumns,items:m.benefitGeometry}),
    criterion("five-card-grid",8,m.cards===5&&between(m.firstCardWidth,256,268),"5 cards; 256–268px first card",{cards:m.cards,width:m.firstCardWidth}),
    criterion("lower-page-composition",8,between(m.financeTop,1657,1669)&&between(m.financeHeight,337,350)&&between(m.trustTop,2001,2013)&&between(m.documentHeight,2112,2126),"approved financing/trust/page boundaries",{financeTop:m.financeTop,financeHeight:m.financeHeight,trustTop:m.trustTop,pageHeight:m.documentHeight})
  ];
  const typography=mobile?[
    criterion("headline-scale",5,between(m.h1Font,40,44)&&m.h1Weight>=800,"40–44px / ≥800",{size:m.h1Font,weight:m.h1Weight}),
    criterion("supporting-copy",5,between(m.proofFont,11,14)&&between(m.proofLineHeight,14,20),"11–14px / 14–20px line",{size:m.proofFont,line:m.proofLineHeight}),
    criterion("button-and-section-hierarchy",5,m.buttonWeight>=700&&between(m.sectionHeadingFont,27,34)&&m.sectionHeadingWeight>=700,"bold CTA; 27–34px section heading",{buttonWeight:m.buttonWeight,heading:m.sectionHeadingFont,headingWeight:m.sectionHeadingWeight})
  ]:[
    criterion("headline-scale",5,between(m.h1Font,64,82)&&m.h1Weight>=800,"64–82px / ≥800",{size:m.h1Font,weight:m.h1Weight}),
    criterion("supporting-copy",5,between(m.proofFont,14,16)&&between(m.proofLineHeight,19,23),"14–16px / 19–23px line",{size:m.proofFont,line:m.proofLineHeight}),
    criterion("button-and-section-hierarchy",5,m.buttonWeight>=700&&between(m.sectionHeadingFont,32,36)&&m.sectionHeadingWeight>=700,"bold CTA; 32–36px section heading",{buttonWeight:m.buttonWeight,heading:m.sectionHeadingFont,headingWeight:m.sectionHeadingWeight})
  ];
  const colors=[
    criterion("headline-red-blue",5,colorNear(m.redColor,[239,32,47],34)&&colorNear(m.blueColor,[22,139,235],42),"mockup red #ef202f and electric blue",{red:m.redColor,blue:m.blueColor}),
    criterion("benefit-panel",5,colorNear(m.benefitsBackground,mobile?[255,255,255]:[7,21,34],mobile?12:18),mobile?"white #fff":"navy #071522",m.benefitsBackground),
    criterion("cta-and-inventory-surface",5,colorNear(m.primaryButtonBackground,[239,32,47],34)&&colorNear(m.inventoryBackground,[246,248,250],28),"red CTA; near-white inventory",{cta:m.primaryButtonBackground,inventory:m.inventoryBackground})
  ];
  const expectedPhotoSources=["2020-dodge-challenger-sxt.webp","2019-dodge-charger-rt.webp","2018-chevrolet-camaro-lt.webp","2020-jeep-grand-cherokee-laredo.webp","2018-ford-f150-xlt.webp"];
  const imagery=[
    criterion("hero-asset",5,m.heroLoaded&&String(m.heroSrc||"").includes(mobile?"/wdcc-hero-v2.webp":"/wdcc-hero-canonical.webp")&&m.heroObjectFit==="cover"&&(mobile||String(m.heroObjectPosition||"").startsWith("50%")),`loaded approved ${mobile?"mobile":"desktop"} WDCC hero / cover${mobile?"":" at 50% x"}`,{loaded:m.heroLoaded,src:m.heroSrc,fit:m.heroObjectFit,position:m.heroObjectPosition}),
    criterion("inventory-media",5,m.photoCount===5&&m.loadedPhotos===5&&expectedPhotoSources.every((name,index)=>sourceIncludes(m.photoSources?.[index],`/wdcc-mockup-preview/${name}`)),"5/5 exact ordered approved inventory photos",{count:m.photoCount,loaded:m.loadedPhotos,sources:m.photoSources}),
    criterion("image-crops",5,m.placeholderCount===0&&(m.photoObjectFits||[]).length===5&&(m.photoObjectFits||[]).every(fit=>fit==="cover"),"no placeholders; all card images cover",{placeholders:m.placeholderCount,fits:m.photoObjectFits})
  ];
  const content=[
    criterion("hero-copy",5,normalized(m.headlineText)==="BAD CREDIT?NO CREDIT?WE DON'T CARE."&&includesAll(m.actionLabels,["GET PRE-APPROVED","BROWSE INVENTORY"])&&includesAll([m.proofText],["IN-HOUSE FINANCING","LOW DOWN PAYMENTS","STRAIGHT ANSWERS"]),"exact 3-line headline, proof copy and 2 CTAs",{headline:m.headlineText,actions:m.actionLabels,proof:m.proofText}),
    criterion("benefits-and-contact",5,includesAll(m.benefitTexts,["FAST APPROVALS","LOW DOWN PAYMENTS","DRIVE TODAY","BUILD YOUR CREDIT"])&&includesAll([m.phoneText],["CALL SEAN","813-516-4752"]),"4 approved benefits and Sean phone",{benefits:m.benefitTexts,phone:m.phoneText}),
    criterion("inventory-and-process",5,m.vehicleTitles?.length===5&&includesAll(m.vehicleTitles,["2020 Dodge Challenger SXT","2019 Dodge Charger R/T","2018 Chevrolet Camaro LT","2020 Jeep Grand Cherokee Laredo","2018 Ford F-150 XLT"])&&m.financeStepCount===4&&(mobile||m.trustItemCount===5),"5 approved listings; 4 finance steps; desktop trust strip",{titles:m.vehicleTitles,steps:m.financeStepCount,trust:m.trustItemCount})
  ];
  return {reference:mobile?references.mobileStorefront:references.desktopStorefront,categories:[category("layout/geometry",40,layout),category("typography",15,typography),category("color",15,colors),category("imagery",15,imagery),category("content/detail",15,content)]};
}

function dealer(metrics,mobile){
  const m=metrics||{},[save,preview,publish]=m.actionButtons||[];
  const uploadCount=mobile?7:5;
  const expectedUploadNames=["2020-dodge-challenger-sxt.webp","01-front-angle.webp","02-interior.webp","03-rear-road.webp","04-rear-skyline.webp",...(mobile?["05-rear-side.webp","06-rear-close.webp"]:[])];
  const uniqueUploadSources=(m.uploadFileNames||[]).length===uploadCount&&new Set(m.uploadFileNames||[]).size===uploadCount&&JSON.stringify(m.uploadFileNames)===JSON.stringify(expectedUploadNames);
  const uniqueUploadFingerprints=(m.uploadMediaFingerprints||[]).length===uploadCount&&new Set(m.uploadMediaFingerprints||[]).size===uploadCount&&m.uploadMediaDistinct===true;
  const mobileGalleryControls=between(m.addPhotoBox?.width,78,84)&&between(m.addPhotoBox?.height,61,67)&&
    Math.abs((m.addPhotoBox?.width||0)-(m.thumbBox?.width||0))<=2&&Math.abs((m.addPhotoBox?.height||0)-(m.thumbBox?.height||0))<=2&&
    between(m.thumbRemoveBox?.width,13,18)&&between(m.thumbRemoveBox?.height,13,18)&&
    between(m.addPhotoIconBox?.width,18,23)&&between(m.addPhotoIconBox?.height,18,23)&&
    between(m.photoToolIconBox?.width,15,20)&&between(m.photoToolIconBox?.height,15,20);
  const previewBackgroundAsset=sourceIncludes(m.previewBackgroundImage,"/wdcc-dealer-proof/reference-only-preview.webp")&&m.previewBackgroundSize==="cover"&&m.previewBackgroundPosition==="50% 50%"&&Number(m.previewImageOpacity)<=.05;
  const previewImageAsset=sourceIncludes(m.previewImageSource,"/wdcc-dealer-proof/reference-only-preview.webp")&&m.previewImageObjectFit==="cover"&&m.previewImageObjectPosition==="50% 50%"&&Number(m.previewImageOpacity)>=.95;
  const desktopPreviewCrop=between(m.previewImageBox?.x,1077,1085)&&between(m.previewImageBox?.y,584,598)&&
    between(m.previewImageBox?.width,342,350)&&between(m.previewImageBox?.height,206,214)&&(previewBackgroundAsset||previewImageAsset);
  const layout=mobile?[
    criterion("masthead",8,between(m.headerHeight,51,55)&&m.brandVisible&&m.phoneVisible&&m.menuVisible&&!m.headerOverlap,"51–55px; brand + phone + menu; no overlap",{height:m.headerHeight,brand:m.brandVisible,phone:m.phoneVisible,menu:m.menuVisible,overlap:m.headerOverlap}),
    criterion("single-column-editor",8,(m.layoutTracks||0)<=1&&!m.sideVisible&&!m.rightVisible&&m.mobileReadinessVisible,"single column; desktop rails hidden",{tracks:m.layoutTracks,side:m.sideVisible,right:m.rightVisible,mobileReadiness:m.mobileReadinessVisible}),
    criterion("vehicle-form-boundary",8,between(m.vehicleInfoBox?.y,149,158)&&between(m.vehicleInfoBox?.height,290,304)&&m.fieldTracks===4&&m.fieldCount===17,"vehicle form y 149–158 / h 290–304; 17 fields / 4 columns",{box:m.vehicleInfoBox,tracks:m.fieldTracks,fields:m.fieldCount}),
    criterion("photos-boundary",8,between(m.photosHeadingBox?.y,457,466)&&between(m.photoToolsBox?.y,488,497)&&m.thumbTracks===4&&between(m.thumbBox?.width,78,84)&&between(m.thumbBox?.height,61,67)&&mobileGalleryControls,"Photos y 457–466; tools y 488–497; 4-column 78–84 × 61–67px gallery; add/remove/tool controls at approved scale",{heading:m.photosHeadingBox,tools:m.photoToolsBox,tracks:m.thumbTracks,thumb:m.thumbBox,add:m.addPhotoBox,remove:m.thumbRemoveBox,addIcon:m.addPhotoIconBox,toolIcon:m.photoToolIconBox}),
    criterion("readiness-actions",8,between(m.mobileReadinessBox?.y,687,696)&&between(m.mobileReadinessBox?.height,172,181)&&between(m.documentHeight,860,874)&&save&&preview&&publish&&Math.abs(save.y-preview.y)<=3&&publish.y>save.y,"readiness y 687–696 / h 172–181; page 860–874; 2+1 actions",{box:m.mobileReadinessBox,pageHeight:m.documentHeight,actions:m.actionButtons})
  ]:[
    criterion("masthead",8,near(m.headerBox?.x,0,1)&&near(m.headerBox?.y,0,2)&&near(m.headerBox?.width,1440,2)&&between(m.headerHeight,94,100),"full-width 1440 × 94–100 masthead",m.headerBox),
    criterion("sidebar",8,between(m.sideBox?.width,208,212)&&between(m.sideBox?.y,94,100)&&m.sideVisible&&Math.abs((m.sideBox?.bottom||0)-m.documentHeight)<=2&&Math.abs((m.sideBox?.height||0)-(m.documentHeight-(m.sideBox?.y||0)))<=2,"210px sidebar beneath masthead and extending through the full document",{sidebar:m.sideBox,pageHeight:m.documentHeight}),
    criterion("workspace-and-rail",8,between(m.layoutBox?.x,208,212)&&between(m.layoutBox?.width,1228,1232)&&between(m.rightBox?.x,1058,1070)&&between(m.rightBox?.width,370,382)&&between(m.documentHeight,1338,1358),"workspace x 210 / w 1230; rail x 1058–1070 / w 370–382; page 1338–1358",{workspace:m.layoutBox,right:m.rightBox,pageHeight:m.documentHeight}),
    criterion("readiness-actions",8,between(m.rightReadinessBox?.width,342,350)&&between(m.rightReadinessBox?.height,454,466)&&save&&preview&&publish&&Math.abs(save.x-preview.x)<=2&&Math.abs(save.x-publish.x)<=2,"346 × 460 readiness; stacked equal-width actions",{readiness:m.rightReadinessBox,actions:m.actionButtons}),
    criterion("form-and-photos",8,m.fieldTracks===4&&m.fieldCount===17&&m.toolTracks===3&&m.thumbTracks===6&&between((m.thumbBox?.width||0)/(m.thumbBox?.height||1),1.05,1.18),"17 fields / 4 columns; 3 tools; 6-column 1.05–1.18 crop",{fields:m.fieldCount,fieldTracks:m.fieldTracks,tools:m.toolTracks,thumbTracks:m.thumbTracks,thumb:m.thumbBox})
  ];
  const typography=mobile?[
    criterion("page-title",5,between(m.titleFont,16,18)&&m.titleWeight>=700,"16–18px / ≥700",{size:m.titleFont,weight:m.titleWeight}),
    criterion("field-labels",5,between(m.fieldLabelFont,6,7.5)&&m.fieldLabelWeight>=700,"6–7.5px uppercase / ≥700",{size:m.fieldLabelFont,weight:m.fieldLabelWeight}),
    criterion("dense-input-type",5,between(m.fieldInputFont,7.5,9),"7.5–9px dense editor inputs",m.fieldInputFont)
  ]:[
    criterion("page-title",5,between(m.titleFont,28,32)&&m.titleWeight>=700,"28–32px / ≥700",{size:m.titleFont,weight:m.titleWeight}),
    criterion("field-labels",5,between(m.fieldLabelFont,7,11)&&m.fieldLabelWeight>=700,"7–11px uppercase / ≥700",{size:m.fieldLabelFont,weight:m.fieldLabelWeight}),
    criterion("editor-input-type",5,between(m.fieldInputFont,10,15),"10–15px editor inputs",m.fieldInputFont)
  ];
  const colors=[
    criterion("portal-chrome",5,colorNear(m.headerBackground,[2,16,27],28)&&colorNear(m.sideBackground,[4,24,37],34),"near-black/navy portal chrome",{header:m.headerBackground,side:m.sideBackground}),
    criterion("work-surfaces",5,colorNear(m.mainBackground,[255,255,255],25)&&colorNear(m.surfaceBackground,[255,255,255],25),"white main/readiness surfaces",{main:m.mainBackground,surface:m.surfaceBackground}),
    criterion("action-red",5,colorNear(m.publishBackground,[239,30,45],36)&&colorNear(m.activeStepColor,[217,30,45],50),"WDCC red publish and active step",{publish:m.publishBackground,step:m.activeStepColor})
  ];
  const imagery=[
    criterion("portal-brand",5,m.logoLoaded,"loaded WDCC portal logo",m.logoLoaded),
    criterion("vehicle-photo-set",5,m.loadedThumbs===uploadCount&&m.primaryThumbs===1&&m.thumbChildren===uploadCount+1&&uniqueUploadSources&&uniqueUploadFingerprints,`${uploadCount} unique source identities and perceptually distinct owner-approved dealer-gallery media fingerprints, 1 primary, add tile`,{loaded:m.loadedThumbs,primary:m.primaryThumbs,children:m.thumbChildren,files:m.uploadFileNames,fingerprints:m.uploadMediaFingerprints,pairwise:m.uploadMediaPairwise}),
    criterion("photo-crops-and-preview",5,(m.thumbObjectFits||[]).length===uploadCount&&(m.thumbObjectFits||[]).every(fit=>fit==="cover")&&(mobile||m.previewLoaded&&desktopPreviewCrop),mobile?"all thumbnails cover":"all thumbnails cover; 346 × 210 preview uses the approved tight canonical Challenger crop",{fits:m.thumbObjectFits,preview:m.previewLoaded,previewBox:m.previewImageBox,backgroundImage:m.previewBackgroundImage,backgroundSize:m.previewBackgroundSize,backgroundPosition:m.previewBackgroundPosition,imageSource:m.previewImageSource,imageFit:m.previewImageObjectFit,imagePosition:m.previewImageObjectPosition,imageOpacity:m.previewImageOpacity})
  ];
  const content=[
    criterion("identity-and-stepper",5,m.titleText==="Add / Edit Vehicle"&&m.steps===5&&String(m.activeStep||"").includes("Photos")&&includesAll(m.stepLabels,["Info","Pricing","Photos","Details","Review"]),"Add / Edit Vehicle; 5-step Photos state",{title:m.titleText,active:m.activeStep,steps:m.stepLabels}),
    criterion("form-tools-readiness",5,m.fieldCount===17&&m.stockValue===""&&m.vinValue===""&&includesAll(m.toolLabels,["Take Photo","Upload Files","Drag & Drop"])&&m.readinessItems===4&&String(m.readinessText||"").includes("75"),"17 fields with blank stock/VIN; 3 upload tools; Ready 75%; 4 checks",{fields:m.fieldCount,stock:m.stockValue,vin:m.vinValue,tools:m.toolLabels,readiness:m.readinessLabels}),
    criterion("portal-navigation-actions",5,includesAll([m.brandText],["WDCC","DEALER PORTAL"])&&includesAll(m.sideLabels,["Dashboard","All Vehicles","Add / Edit Vehicle","Categories","Leads","Appointments","Reports","Settings"])&&includesAll(m.actionLabels,["Save Draft","Preview","Publish / Submit"]),"dealer identity, complete portal nav, 3 publish actions",{brand:m.brandText,side:m.sideLabels,actions:m.actionLabels})
  ];
  return {reference:mobile?references.mobileDealer:references.desktopDealer,categories:[category("layout/geometry",40,layout),category("typography",15,typography),category("color",15,colors),category("imagery",15,imagery),category("content/detail",15,content)]};
}

if(metricsPath==="--self-test"){
  const failures=[];
  for(const view of Object.keys(referenceDimensions)){
    const {raw:reference,size}=wdccMockupFingerprint(view);
    const referenceHash=createHash("sha256").update(reference).digest("hex");
    const controls=calibrationControls(view,reference,size.width,size.height);
    if(referenceHash!==WDCC_MOCKUP_FINGERPRINT_SHA256[view])failures.push(`${view}:fingerprint-integrity`);
    if(!controls.pass)failures.push(`${view}:control-suite`);
    if(controls.controls.horizontalDrift.pass||!(controls.controls.horizontalDrift.effectiveDriftPixels>perceptualThresholds.driftControl.minimumRejectedPixels))failures.push(`${view}:horizontal-drift`);
    const calibratedFloor=Math.ceil((controls.controls.horizontalDrift.directionalEdgeCosine+.000001)*100)/100;
    if(perceptualThresholds.alignment.directionalEdgeCosineByView[view]!==calibratedFloor)failures.push(`${view}:directional-floor-calibration`);
    if(controls.controls.verticalDrift.pass||!(controls.controls.verticalDrift.effectiveDriftPixels>perceptualThresholds.driftControl.minimumRejectedPixels))failures.push(`${view}:vertical-drift`);
    if(controls.controls.centerZoomCrop.pass)failures.push(`${view}:center-zoom-crop`);
  }
  if(honestScore(100,["perceptual-reference"])>=threshold)failures.push("score-cap:false-green");
  if(honestScore(100,[])!==100)failures.push("score-cap:false-negative");
  if(failures.length)throw new Error(`WDCC_MOCKUP_GATE_SELF_TEST_FAILED ${failures.join(",")}`);
  console.log(`WDCC_MOCKUP_GATE_SELF_TEST PASS views=${Object.keys(referenceDimensions).length} horizontalDrift=>${perceptualThresholds.driftControl.minimumRejectedPixels}px centerZoom=${perceptualThresholds.driftControl.centerZoomRatio} nonPassingCap=${maximumNonPassingScore}`);
}else{
let raw={};
try{raw=JSON.parse(fs.readFileSync(metricsPath,"utf8"))}catch(error){raw={failure:`metrics unavailable: ${error instanceof Error?error.message:String(error)}`}}
const views={desktopStorefront:storefront(raw.desktop,false),mobileStorefront:storefront(raw.ownerMobile||raw.plainMobile,true),desktopDealer:dealer(raw.dealerDesktop,false),mobileDealer:dealer(raw.dealerMobile,true)};
const screenshotByView={desktopStorefront:"desktop-02-home.png",mobileStorefront:"ownerMobile-02-home-viewport.png",desktopDealer:"dealerDesktop-dealer-step3.png",mobileDealer:"dealerMobile-dealer-step3.png"};
const hardInvariantCategories=new Set(["layout/geometry","imagery","content/detail"]);
const visualAssertions=Array.isArray(raw.visualAssertions)?raw.visualAssertions:[];
const assertionPrefixes={desktopStorefront:["desktop_"],mobileStorefront:["ownerMobile_","plainMobile_","androidWide_"],desktopDealer:["dealerDesktop_"],mobileDealer:["dealerMobile_"]};
const knownAssertionPrefixes=Object.values(assertionPrefixes).flat();
const unmappedVisualAssertions=visualAssertions.filter(assertion=>!knownAssertionPrefixes.some(prefix=>assertion.startsWith(prefix)));
for(const[name,view]of Object.entries(views)){
  view.referenceEvidence=await measureReferenceMatch(name,screenshotByView[name]);
  const imagery=view.categories.find(item=>item.name==="imagery");
  const composition=imagery?.criteria.at(-1);
  if(composition){composition.target+=`; spatial fingerprint ${JSON.stringify(perceptualThresholds)}`;composition.actual={dom:composition.actual,fingerprint:view.referenceEvidence};composition.pass=composition.pass&&view.referenceEvidence.pass;composition.earned=composition.pass?composition.points:0;if(imagery)imagery.earned=imagery.criteria.reduce((sum,item)=>sum+item.earned,0)}
  view.rubricScore=view.categories.reduce((sum,item)=>sum+item.earned,0);view.maximum=view.categories.reduce((sum,item)=>sum+item.maximum,0);
  view.hardInvariantFailures=view.categories.flatMap(group=>hardInvariantCategories.has(group.name)?group.criteria.filter(item=>!item.pass).map(item=>`${group.name}:${item.id}`):[]);
  view.visualAssertionFailures=visualAssertions.filter(assertion=>(assertionPrefixes[name]||[]).some(prefix=>assertion.startsWith(prefix)));
  view.eligibilityFailures=[...(raw.failure?["capture-source-failure"]:[]),...(!view.referenceEvidence.pass?["perceptual-reference"]:[]),...view.hardInvariantFailures,...view.visualAssertionFailures.map(()=>"capture-geometry"),...unmappedVisualAssertions.map(()=>"capture-geometry-global")];
  view.score=honestScore(view.rubricScore,view.eligibilityFailures);
  view.scoreCapped=view.score!==view.rubricScore;
  view.pass=view.score>=threshold;
}
const scores=Object.values(views).map(view=>view.score);
const overall=Math.round((scores.reduce((sum,value)=>sum+value,0)/scores.length)*100)/100;
const pass=Object.values(views).every(view=>view.pass)&&overall>=threshold&&!raw.failure&&!visualAssertions.length;
const report={schema:"wdcc-mockup-score/v5",threshold,maximumNonPassingScore,perceptualThresholds,weights:{"layout/geometry":40,typography:15,color:15,imagery:15,"content/detail":15},scoreSemantics:"A view that fails perceptual reference, capture geometry, or any hard invariant is capped below 95. Therefore score >=95 always means that view passed every eligibility gate.",calibration:"Approved owner mockups; exact 390px and 1440px rendered views plus aspect-preserving 96px RGB/luminance/edge/chroma fingerprints. Each reference proves its positive control and rejects horizontal flip, grayscale, >13px horizontal and vertical drift, and 5% center zoom/crop. The stricter v4 structure rule is preserved: RGB-MAE is mandatory and one of luma/edge must pass. Directional-edge alignment is additionally mandatory at a per-view floor set to the next hundredth above that view's >13px horizontal-drift control. Layout, imagery, and content are hard invariants in addition to the 95-point threshold.",metricsPath,overall,pass,sourceFailure:raw.failure||null,visualAssertions,unmappedVisualAssertions,views};
fs.mkdirSync(outDir,{recursive:true});
fs.writeFileSync(path.join(outDir,"score-report.json"),JSON.stringify(report,null,2)+"\n");
const lines=["# WDCC mockup score","",`Threshold: **${threshold}/100 per view and overall**`,"",`Overall: **${overall}/100 — ${pass?"PASS":"FAIL"}**`,"",`Score semantics: **a failed perceptual/capture/hard-invariant gate is capped at ${maximumNonPassingScore}; ≥95 always means PASS**`,"",`Cross-viewport assertions: **${visualAssertions.length?`FAIL (${visualAssertions.length})`:"PASS"}**`,"",`Hard invariants: **layout/geometry + imagery + content/detail must all pass**`,"",`Structural rule: **RGB-MAE is mandatory; ≥1 of luma/edge must also pass (strict v4 behavior retained)**`,"",`Directional alignment: **mandatory per-view floor calibrated immediately above each view's >13px horizontal-drift control**`,"",`Perceptual controls: **positive reference must pass; horizontal flip, grayscale, >13px horizontal/vertical drift, and 5% center zoom/crop must fail**`,"","| View | Layout | Type | Color | Imagery | Content | Rubric | Honest score | Result |","|---|---:|---:|---:|---:|---:|---:|---:|---|"];
for(const[name,view]of Object.entries(views)){const values=Object.fromEntries(view.categories.map(item=>[item.name,item.earned]));lines.push(`| ${name} | ${values["layout/geometry"]}/40 | ${values.typography}/15 | ${values.color}/15 | ${values.imagery}/15 | ${values["content/detail"]}/15 | ${view.rubricScore}/100 | **${view.score}/100** | ${view.pass?"PASS":"FAIL"} |`)}
for(const[name,view]of Object.entries(views)){lines.push("",`## ${name} — ${view.score}/100`,`Rubric score before eligibility cap: ${view.rubricScore}/100`,`Reference: ${view.reference}`,`Eligibility failures: ${view.eligibilityFailures.length?view.eligibilityFailures.join(", "):"none"}`,`Hard invariant failures: ${view.hardInvariantFailures.length?view.hardInvariantFailures.join(", "):"none"}`,`Perceptual fingerprint: ${view.referenceEvidence.pass?"PASS":"FAIL"} — \`${JSON.stringify(view.referenceEvidence)}\``);for(const group of view.categories){for(const item of group.criteria){lines.push(`- ${item.pass?"PASS":"FAIL"} ${group.name} · ${item.id} (${item.earned}/${item.points}) — target: ${item.target}; measured: \`${JSON.stringify(item.actual)}\``)}}}
fs.writeFileSync(path.join(outDir,"score-report.md"),lines.join("\n")+"\n");
console.log(`WDCC_MOCKUP_SCORE overall=${overall} desktopStorefront=${views.desktopStorefront.score} mobileStorefront=${views.mobileStorefront.score} desktopDealer=${views.desktopDealer.score} mobileDealer=${views.mobileDealer.score} threshold=${threshold} result=${pass?"PASS":"FAIL"}`);
if(!pass)process.exitCode=1;
}
