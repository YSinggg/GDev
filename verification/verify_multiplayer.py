from playwright.sync_api import sync_playwright
import time
import subprocess
import os

def run_test():
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)

        # Player 1 (Host)
        context1 = browser.new_context()
        page1 = context1.new_page()
        page1.on("console", lambda msg: print(f"Host Console: {msg.text}"))
        page1.goto("file://" + os.path.abspath("snake.html"))

        # Player 2 (Joiner)
        context2 = browser.new_context()
        page2 = context2.new_page()
        page2.on("console", lambda msg: print(f"Peer Console: {msg.text}"))
        page2.goto("file://" + os.path.abspath("snake.html"))

        print("Pages loaded")

        # 1. Host creates game
        page1.get_by_role("button", name="Host Game").click()
        page1.wait_for_selector("#roomCodeDisplay")
        room_code = page1.locator("#roomCodeDisplay").inner_text()
        print(f"Room Created: {room_code}")

        # 2. Joiner joins game
        page2.get_by_role("button", name="Join Game").click()
        page2.fill("#roomInput", room_code)
        page2.get_by_role("button", name="Connect").click()
        page2.wait_for_selector("text=Connected! Waiting for Host...")
        print("Player 2 Connected")

        # 3. Host starts game
        page1.get_by_role("button", name="Start Multiplayer").click()

        # Wait for gameInstance on Peer
        try:
            page2.wait_for_function("typeof gameInstance !== 'undefined'", timeout=5000)
            print("Game Instance Created on Peer")
        except:
            print("Timeout waiting for Game Instance on Peer")

        # Wait a bit for checkTurn to update UI
        time.sleep(2)

        # Debug info
        try:
            p2_id = page2.evaluate("gameInstance.myPlayerId")
            p2_turn = page2.evaluate("gameInstance.turnIndex")
            print(f"P2 Debug: ID={p2_id}, Turn={p2_turn}")
        except:
            print("P2 Debug failed")

        btn = page2.locator("#rollBtn")
        btn_text = btn.inner_text()
        print(f"P2 Button Text: '{btn_text}'")

        if "WAITING" in btn_text:
            print("P2 controls correctly locked")
        else:
            print("FAIL: P2 controls not locked")

        # 5. Host Rolls
        page1.get_by_role("button", name="ROLL DICE").click()
        print("Host Rolled")

        # Wait for animation
        time.sleep(3)

        # Take screenshot of Host view
        page1.screenshot(path="verification/host_view.png")
        # Take screenshot of Peer view
        page2.screenshot(path="verification/peer_view.png")

        browser.close()

if __name__ == "__main__":
    run_test()
