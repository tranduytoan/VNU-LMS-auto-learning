import { services } from "../services.js";
import fs from "fs";
import "dotenv/config";

async function main() {
    const allLeafs = await services.getAllLeafsOfClass('d97c044f-44b4-4b58-b451-7957fc35a094');
    
    const baseUrl = 'https://cdnlms.vnu.edu.vn/dhqg.file.api/uploads/';

    const filteredLeafs = allLeafs.filter(leaf => {
        return leaf.type && leaf.type.id && leaf.type.id !== "b6421bc8-2324-4510-9217-68babde82313";
    });

    const result = filteredLeafs.map(leaf => {
        let content;
        if (leaf.type.id === "b196bfc0-591d-497d-9128-87e2746b9494") {
            content = leaf.type.title;
        } else {
            content = baseUrl + leaf.fileId;
        }

        return {
            title: leaf.title,
            content: content
        };
    });

    fs.writeFileSync(path.join(__dirname, 'result', 'leafs_output.json'), JSON.stringify(result, null, 2), 'utf8');
    console.log(`Exported ${result.length} leafs to leafs_output.json`);
}

main().catch(console.error);