import {headers} from "next/headers";
import {isIsolatedWorkersDevPreview} from "../lib/visualPreviewGate";
import ReferenceCloneHome from "./ReferenceCloneHome";

export default async function Home(){return <ReferenceCloneHome allowVisualFixture={isIsolatedWorkersDevPreview(await headers())}/>}
