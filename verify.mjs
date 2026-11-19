import handler from "../../lib/handlers/verify.cjs";
import {invokeLegacy} from "../../lib/vercel-adapter.mjs";
export async function POST(request){ return invokeLegacy(request, handler); }
