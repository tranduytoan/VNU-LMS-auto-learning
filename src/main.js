import { services } from "./services.js";
import WebSocket from "ws";
import fs from "fs";
import prompts from "prompt-sync";
import "dotenv/config";

const prompt = prompts();
const RS = String.fromCharCode(0x1e);

function isTestOrExam(leaf) {
    if (!leaf.type) return false;
    return leaf.type.title === "Bài kiểm tra / thi" || leaf.type.id === "b6421bc8-2324-4510-9217-68babde82313";
}

function calculateAutoStopSeconds(leaf) {
    const mincore = leaf.mincore || 0;
    const learnTime = leaf.learnTime || 0;
    
    if (mincore === null || mincore === 0) {
        return 60; // 1 phút cho việc chỉ cần xem qua
    }
    
    return Math.max((mincore - learnTime) * 60 + 60, 60); // tối thiểu 1 phút
}

function validateConfig(config) {
    try {
        if (!config || !config.list_job || !Array.isArray(config.list_job)) {
            return false;
        }
        
        for (const job of config.list_job) {
            if (!job.id || !job.classContentId || typeof job.EDIT_HERE_enable !== 'boolean') {
                return false;
            }
        }
        
        return true;
    } catch (error) {
        return false;
    }
}

async function askToUseConfig() {
    try {
        const configData = fs.readFileSync('./config.json', 'utf8');
        const config = JSON.parse(configData);
        
        if (!validateConfig(config)) {
            console.log('Config file is invalid. Switching to command line interface...');
            return false;
        }
        
        console.log('Valid config.json found!');
        const useConfig = prompt('Do you want to use config.json? (y/n): ');
        
        if (useConfig.toLowerCase() === 'y') {
            return await runFromConfig(config);
        } else {
            return false;
        }
    } catch (error) {
        return false;
    }
}

async function runFromConfig(config) {
    console.log('Running jobs from config...');
    
    for (const job of config.list_job) {
        if (!job.EDIT_HERE_enable) {
            console.log(`Skipping disabled job: ${job.title}`);
            continue;
        }
        
        if (!job.id) {
            console.log(`Skipping job with null ID: ${job.title}`);
            continue;
        }
        
        console.log(`Processing job: ${job.title}`);
        await processJob(job.id, job.EDIT_HERE_autoStopSeconds);
    }
    
    return true;
}

async function showClassMenu() {
    console.log('\n=== SELECT CLASS ===');
    
    try {
        const classes = await services.getCurrentClasses();
        
        if (!classes || classes.length === 0) {
            console.log('No classes found.');
            return null;
        }
        
        console.log('Available classes:');
        classes.forEach((cls, index) => {
            console.log(`${index + 1}. ${cls.classTitle}`);
        });
        
        const choice = prompt('Select class (enter number): ');
        const classIndex = parseInt(choice) - 1;
        
        if (classIndex >= 0 && classIndex < classes.length) {
            return classes[classIndex];
        } else {
            console.log('Invalid selection.');
            return null;
        }
    } catch (error) {
        console.error('Error fetching classes:', error.message);
        return null;
    }
}

async function showModeMenu(selectedClass) {
    console.log(`\n=== MODE SELECTION FOR CLASS: ${selectedClass.classTitle} ===`);
    console.log('1. Auto - Automatically process all available leafs');
    console.log('2. Manual - Manually select leafs to process');
    console.log('3. Create config - Generate config.json file');
    
    const choice = prompt('Select mode (1-3): ');
    
    switch (choice) {
        case '1':
            await runAutoMode(selectedClass.id);
            break;
        case '2':
            await runManualMode(selectedClass.id);
            break;
        case '3':
            await createConfigFile(selectedClass.id);
            break;
        default:
            console.log('Invalid selection.');
            return false;
    }
    
    return true;
}

async function runAutoMode(classId) {
    console.log('\n=== AUTO MODE ===');
    
    try {
        const availableLeafs = await services.getNowAvailableLeafsOfClass(classId);
        const unfinishedLeafs = availableLeafs.filter(leaf => !(leaf.isFinish && leaf.isPassed));
        
        if (unfinishedLeafs.length === 0) {
            console.log('No unfinished leafs found.');
            return;
        }
        
        console.log(`Found ${unfinishedLeafs.length} unfinished leafs. Starting auto processing...`);
        
        for (const leaf of unfinishedLeafs) {
            if (isTestOrExam(leaf)) {
                console.log(`Skipping test/exam: ${leaf.title}`);
                continue;
            }
            
            const leafId = await services.getLeafId(leaf);
            
            if (!leafId) {
                console.log(`Error: Cannot get ID for leaf "${leaf.title}". Skipping...`);
                continue;
            }
            
            const autoStopSeconds = calculateAutoStopSeconds(leaf);
            console.log(`Processing: ${leaf.title} (${autoStopSeconds}s)`);
            
            await processJob(leafId, autoStopSeconds);
        }
        
        console.log('Auto processing completed.');
    } catch (error) {
        console.error('Error in auto mode:', error.message);
    }
}

async function runManualMode(classId) {
    console.log('\n=== MANUAL MODE ===');
    
    try {
        const availableLeafs = await services.getNowAvailableLeafsOfClass(classId);
        
        if (availableLeafs.length === 0) {
            console.log('No available leafs found.');
            return;
        }
        
        console.log('Available leafs:');
        availableLeafs.forEach((leaf, index) => {
            const status = (leaf.isFinish && leaf.isPassed) ? '[COMPLETED]' : '[PENDING]';
            console.log(`${index + 1}. ${leaf.title} ${status}`);
        });
        
        const choice = prompt('Select leaf (enter number): ');
        const leafIndex = parseInt(choice) - 1;
        
        if (leafIndex >= 0 && leafIndex < availableLeafs.length) {
            const selectedLeaf = availableLeafs[leafIndex];
            
            if (isTestOrExam(selectedLeaf)) {
                console.log(`Cannot process test/exam: ${selectedLeaf.title}`);
                return;
            }
            
            const leafId = await services.getLeafId(selectedLeaf);
            
            if (!leafId) {
                console.log('Error: Cannot get ID for this leaf.');
                return;
            }
            
            const defaultSeconds = calculateAutoStopSeconds(selectedLeaf);
            const customSeconds = prompt(`Enter auto stop time in seconds (default ${defaultSeconds}): `) || defaultSeconds;
            
            console.log(`Processing: ${selectedLeaf.title}`);
            await processJob(leafId, parseInt(customSeconds));
        } else {
            console.log('Invalid selection.');
        }
    } catch (error) {
        console.error('Error in manual mode:', error.message);
    }
}

async function createConfigFile(classId) {
    console.log('\n=== CREATE CONFIG FILE ===');
    
    try {
        const allLeafs = await services.getNowAvailableLeafsOfClass(classId);
        
        if (allLeafs.length === 0) {
            console.log('No leafs found for this class.');
            return;
        }
        
        const filteredLeafs = allLeafs.filter(leaf => {
            if (isTestOrExam(leaf)) {
                console.log(`Excluding test/exam from config: ${leaf.title}`);
                return false;
            }
            return true;
        });
        
        const configData = {
            list_job: filteredLeafs.map(leaf => ({
                id: leaf.id || null,
                classContentId: leaf.classContentId,
                title: leaf.title,
                isFinish: leaf.isFinish,
                isPassed: leaf.isPassed,
                mincore: leaf.mincore,
                learnTime: leaf.learnTime || 0,
                EDIT_HERE_autoStopSeconds: calculateAutoStopSeconds(leaf),
                EDIT_HERE_enable: !(leaf.isFinish && leaf.isPassed)
            }))
        };
        
        fs.writeFileSync('./config.json', JSON.stringify(configData, null, 2), 'utf8');
        console.log(`Config file created successfully with ${filteredLeafs.length} leafs (${allLeafs.length - filteredLeafs.length} tests/exams excluded).`);
        console.log('You can edit the EDIT_HERE_* fields in config.json to customize settings.');
    } catch (error) {
        console.error('Error creating config file:', error.message);
    }
}

async function processJob(leafId, autoStopSeconds) {
    return new Promise((resolve) => {
        console.log(`Starting job with ID: ${leafId} for ${autoStopSeconds} seconds`);
        
        const ws = new WebSocket('wss://lms.vnu.edu.vn/dhqg.lms.api/learninghub', {
            headers: {
                'Authorization': `Bearer ${process.env.ACCESS_TOKEN}`
            }
        });
        
        ws.on('open', () => {
            console.log('WebSocket connected');
            const message = JSON.stringify({
                protocol: "json",
                version: 1
            }) + RS;
            ws.send(message);
            
            setTimeout(() => {
                const startLearningMessage = JSON.stringify({
                    type: 1,
                    target: "StartLearning",
                    arguments: [leafId]
                }) + RS;
                ws.send(startLearningMessage);
                console.log('Learning started');
            }, 1000);
        });
        
        ws.on('message', (data) => {
            const message = data.toString();
            if (message.includes('StartLearning')) {
                console.log('Learning session confirmed');
            }
        });
        
        ws.on('error', (error) => {
            console.error('WebSocket error:', error.message);
            resolve();
        });
        
        setTimeout(() => {
            console.log('Auto stopping job...');
            if (ws.readyState === WebSocket.OPEN) {
                const stopMessage = JSON.stringify({
                    type: 1,
                    target: "StopLearning",
                    arguments: [leafId]
                }) + RS;
                ws.send(stopMessage);
            }
            
            setTimeout(() => {
                ws.close();
                console.log('Job completed\n');
                resolve();
            }, 1000);
        }, autoStopSeconds * 1000);
    });
}

async function main() {
    console.log('=== VNU LMS Auto Learning System ===');
    
    const useConfigFile = process.env.USE_CONFIG_FILE === 'true';
    
    if (useConfigFile) {
        const configSuccess = await askToUseConfig();
        if (configSuccess) {
            return;
        }
    }
    
    while (true) {
        const selectedClass = await showClassMenu();
        if (!selectedClass) {
            console.log('Exiting...');
            break;
        }
        
        const continueApp = await showModeMenu(selectedClass);
        if (!continueApp) {
            continue;
        }
        
        const another = prompt('Do you want to process another class? (y/n): ');
        if (another.toLowerCase() !== 'y') {
            break;
        }
    }
    
    console.log('Program ended.');
}

main().catch(console.error);

