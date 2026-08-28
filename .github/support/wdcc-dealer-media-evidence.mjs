import fs from "node:fs";
import path from "node:path";
import {createHash} from "node:crypto";
import sharp from "sharp";

export const WDCC_DEALER_MEDIA_DISTINCTNESS_THRESHOLDS=Object.freeze({
  rgbMae:15,
  dHashHamming:48,
  lumaCosine:.94
});

const sha256=value=>createHash("sha256").update(value).digest("hex");

export async function measureDealerMediaEvidence(files){
  if(!Array.isArray(files)||files.length<2)throw new TypeError("dealer media evidence requires at least two files");
  const items=[];
  for(const file of files){
    const absolute=path.resolve(file),source=fs.readFileSync(absolute);
    const rgb=await sharp(source).resize(32,24,{fit:"cover",kernel:"lanczos3"}).removeAlpha().raw().toBuffer();
    const grayscale=await sharp(source).resize(17,16,{fit:"cover",kernel:"lanczos3"}).grayscale().raw().toBuffer();
    const luma=await sharp(source).resize(32,24,{fit:"cover",kernel:"lanczos3"}).grayscale().raw().toBuffer();
    const dHash=[];
    for(let y=0;y<16;y++)for(let x=0;x<16;x++)dHash.push(grayscale[y*17+x]>grayscale[y*17+x+1]?1:0);
    items.push({
      file:absolute,
      name:path.basename(absolute),
      sourceId:path.relative(process.cwd(),absolute).split(path.sep).join("/"),
      sourceSha256:sha256(source),
      perceptualFingerprint:sha256(rgb),
      rgb,luma,dHash
    });
  }

  const pairwise=[];
  for(let left=0;left<items.length;left++)for(let right=left+1;right<items.length;right++){
    let difference=0,hamming=0,numerator=0,leftSquare=0,rightSquare=0;
    for(let index=0;index<items[left].rgb.length;index++)difference+=Math.abs(items[left].rgb[index]-items[right].rgb[index]);
    for(let index=0;index<items[left].dHash.length;index++)hamming+=items[left].dHash[index]!==items[right].dHash[index]?1:0;
    for(let index=0;index<items[left].luma.length;index++){
      const a=items[left].luma[index],b=items[right].luma[index];
      numerator+=a*b;leftSquare+=a*a;rightSquare+=b*b;
    }
    const rgbMae=Math.round(difference/items[left].rgb.length*100)/100;
    const lumaCosine=Math.round(numerator/Math.sqrt(leftSquare*rightSquare)*10000)/10000;
    pairwise.push({
      left:items[left].name,
      right:items[right].name,
      rgbMae,
      dHashHamming:hamming,
      lumaCosine,
      pass:rgbMae>=WDCC_DEALER_MEDIA_DISTINCTNESS_THRESHOLDS.rgbMae&&
        hamming>=WDCC_DEALER_MEDIA_DISTINCTNESS_THRESHOLDS.dHashHamming&&
        lumaCosine<=WDCC_DEALER_MEDIA_DISTINCTNESS_THRESHOLDS.lumaCosine
    });
  }

  const sourceIds=items.map(item=>item.sourceId),sourceHashes=items.map(item=>item.sourceSha256),fingerprints=items.map(item=>item.perceptualFingerprint);
  const pass=new Set(sourceIds).size===files.length&&new Set(sourceHashes).size===files.length&&new Set(fingerprints).size===files.length&&pairwise.every(pair=>pair.pass);
  return {
    pass,
    items:items.map(({name,sourceId,sourceSha256,perceptualFingerprint})=>({name,sourceId,sourceSha256,perceptualFingerprint})),
    pairwise,
    thresholds:WDCC_DEALER_MEDIA_DISTINCTNESS_THRESHOLDS
  };
}
