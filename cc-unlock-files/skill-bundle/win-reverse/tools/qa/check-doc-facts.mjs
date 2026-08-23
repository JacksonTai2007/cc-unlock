import { collectDocFactSyncFindings } from "../docs/fact-sync.mjs";
import { failWith } from "./common.mjs";

failWith(collectDocFactSyncFindings(), "check-doc-facts");
