from playwright.sync_api import sync_playwright
import time

def run():
    with sync_playwright() as p:
        browser = p.chromium.launch()
        page = browser.new_page()

        try:
            # Dashboard Tab
            print("Navigating to Dashboard...")
            page.goto("http://localhost:3847/dashboard")
            page.wait_for_selector(".app")

            # Collaborative Debates Tab
            print("Navigating to Collaborative Debates...")
            page.click(".tab:text('Collaborative')")
            page.wait_for_selector("#collaborative-debates-table")
            time.sleep(1)
            page.screenshot(path="collaborative_tab.png")
            print("Collaborative tab screenshot saved.")

            # Create Debate Modal
            print("Opening Create Debate Modal...")
            page.click("button:has-text('Create Debate')")
            page.wait_for_selector("#create-debate-modal.show")
            time.sleep(0.5)
            page.screenshot(path="create_debate_modal.png")
            print("Create debate modal screenshot saved.")
            page.click(".modal-close")

            # Simulator Tab
            print("Navigating to Simulator...")
            page.click(".tab:text('Simulator')")
            page.wait_for_selector("#simulations-table")
            time.sleep(1)
            page.screenshot(path="simulator_tab.png")
            print("Simulator tab screenshot saved.")

        except Exception as e:
            print(f"Error: {e}")
            page.screenshot(path="error_state_collab.png")

        finally:
            browser.close()

if __name__ == "__main__":
    run()
