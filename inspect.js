const { chromium } = require('playwright');
const path = require('path');

async function run() {
    console.log("Launching browser...");
    const browser = await chromium.launch({ headless: true });
    const page = await browser.newPage();
    
    page.on('console', msg => {
        console.log(`[BROWSER CONSOLE] ${msg.type()}: ${msg.text()}`);
    });

    page.on('pageerror', err => {
        console.log(`[BROWSER ERROR] ${err.message}`);
    });

    page.on('response', response => {
        if (response.status() >= 400) {
            console.log(`[FAILED REQUEST] ${response.status()} ${response.url()}`);
        }
    });

    console.log("Navigating to http://localhost:3000/simple ...");
    await page.goto('http://localhost:3000/simple');
    
    console.log("Waiting 10 seconds for page load and rendering...");
    await page.waitForTimeout(10000);
    
    const screenshotPath = '/home/stone/.gemini/antigravity/brain/458bcf9e-7409-4d6d-b3da-6f539cf156e5/scratch/screenshot.png';
    console.log(`Taking screenshot and saving to ${screenshotPath}...`);
    await page.screenshot({ path: screenshotPath });
    
    console.log("Closing browser...");
    await browser.close();
    console.log("Done!");
}

run().catch(err => {
    console.error("Execution error:", err);
});
