import handler from "../../lib/handlers/config.cjs";
import {invokeLegacy} from "../../lib/vercel-adapter.mjs";
export async function GET(request){ return invokeLegacy(request, handler); }
