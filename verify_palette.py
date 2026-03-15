import asyncio
from playwright.async_api import async_playwright

async def verify_command_palette():
    async with async_playwright() as p:
        browser = await p.chromium.launch()
        page = await browser.new_page()

        print("Navigating to UI...")
        await page.goto("http://127.0.0.1:4000")

        print("Triggering Command Palette (Ctrl+K)...")
        await page.keyboard.press("Control+k")

        # Wait for the palette to appear
        await page.wait_for_selector(".command-palette.open")

        print("Typing in Command Palette...")
        await page.keyboard.type("New S")

        # Wait a moment for filtering to happen
        await asyncio.sleep(0.5)

        print("Taking screenshot...")
        await page.screenshot(path="command_palette.png")

        print("Done. Closing browser.")
        await browser.close()

if __name__ == "__main__":
    asyncio.run(verify_command_palette())
