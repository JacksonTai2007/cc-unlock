import { failWith } from "./common.mjs";
import { collectDocFactSyncFindings } from "../docs/fact-sync.mjs";

failWith(collectDocFactSyncFindings(), "check-doc-fact-sync");
