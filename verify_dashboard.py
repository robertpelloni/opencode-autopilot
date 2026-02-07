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
            page.wait_for_selector(".app") # Wait for root
            time.sleep(2) # Wait for JS to likely run

            page.screenshot(path="dashboard_debug.png")
            print("Debug screenshot saved.")

            # Check if sessions grid is visible
            if page.is_visible(".sessions-grid"):
                print("Sessions grid is visible.")
            else:
                print("Sessions grid is NOT visible.")

            # Check for empty state text
            if page.get_by_text("No sessions active").is_visible():
                print("Empty state text found.")

            # Dashboard Tab Screenshot
            page.screenshot(path="dashboard_tab.png")
            print("Dashboard tab screenshot saved.")

            # Debate History Tab
            print("Navigating to Debate History...")
            page.click(".tab:text('Debate History')")
            time.sleep(1)
            page.screenshot(path="debate_history_tab.png")
            print("Debate History tab screenshot saved.")

            # Supervisors Tab
            print("Navigating to Supervisors...")
            page.click(".tab:text('Supervisors')")
            time.sleep(1)
            page.screenshot(path="supervisors_tab.png")
            print("Supervisors tab screenshot saved.")

            # Settings Modal
            print("Opening Settings Modal...")
            page.click("button:has-text('Settings')")
            time.sleep(1)
            page.screenshot(path="settings_modal.png")
            print("Settings modal screenshot saved.")
            page.click(".modal-close")

            # Help Modal
            print("Opening Help Modal...")
            page.click("button:has-text('Help')")
            time.sleep(1)
            page.screenshot(path="help_modal.png")
            print("Help modal screenshot saved.")
            page.click(".modal-close")

        except Exception as e:
            print(f"Error: {e}")
            page.screenshot(path="error_state.png")

        finally:
            browser.close()

if __name__ == "__main__":
    run()
