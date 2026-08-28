// Backward-compatible route alias. Both endpoints use the same authenticated
// Vercel Blob client-upload handshake; this route does not implement a second
// upload protocol.
export {GET,POST} from "../upload/route";
