
import time
import json
import sys
import pyperclip
from selenium import webdriver
from selenium.webdriver.common.by import By
from selenium.webdriver.support.ui import WebDriverWait
from selenium.webdriver.support import expected_conditions as EC
from selenium.common.exceptions import TimeoutException, NoSuchElementException

print("=============================================")
print("  Web Church Expense Automation Bot")
print("=============================================")

# Check if running via Protocol (argument passed)
auto_run = False
if len(sys.argv) > 1:
    print(f"DEBUG: Started with arguments: {sys.argv}")
    auto_run = True

print("=============================================")
print("  Web Church Expense Automation Bot")
print("=============================================")

if not auto_run:
    print("1. Please copy the expense data from the Nursery Budget App.")
    print("   (Click 'Web Church Send' button in the app)")
    print("2. Press Enter here when ready using the copied data...")
    input()
else:
    print(">> Started via Web Protocol. Giving system a moment to finalize clipboard...")
    time.sleep(1.0) # Wait a bit for React to write to clipboard

try:
    raw_data = pyperclip.paste()
    print(f"DEBUG: Clipboard content: {raw_data[:50]}...")
    data = json.loads(raw_data)
    print(">> Data loaded successfully!")
    print(f"   Subject: {data.get('description')}")
    print(f"   Amount: {data.get('amount')}")
except Exception as e:
    print("!! Error reading clipboard data. Make sure you clicked the button in the web app.")
    print(f"Error: {e}")
    if not auto_run:
        input("Press Enter to exit...")
    sys.exit(1)

print(">> Launching Chrome...")

options = webdriver.ChromeOptions()
# options.add_argument("--headless") # Comment out to see the browser
options.add_experimental_option("detach", True) # Keep browser open

try:
    driver = webdriver.Chrome(options=options)
except Exception as e:
    print("!! Failed to launch Chrome. Make sure Chrome is installed.")
    print(f"Error: {e}")
    input("Press Enter to exit...")
    sys.exit(1)

try:
    # 1. Login
    print(">> Navigating to Login...")
    driver.get("https://ch2ch.or.kr/login.asp")
    
    WebDriverWait(driver, 10).until(EC.presence_of_element_located((By.NAME, "id")))
    
    driver.find_element(By.NAME, "id").send_keys("") # Credentials removed
    driver.find_element(By.NAME, "passwd").send_keys("") # Credentials removed
    
    # Click Login (using javascript link usually)
    try:
        login_btn = driver.find_element(By.XPATH, "//a[contains(@href, 'sendit')]")
        login_btn.click()
    except:
        # Fallback to form submit
        driver.find_element(By.NAME, "passwd").submit()

    print(">> Login submitted. Waiting for main page...")
    time.sleep(3)

    # 2. Click "지출결의서" (Expense Resolution)
    # It is inside a frame. 'menu-iframe' or 'left_frame'
    print(">> Looking for '지출결의서' menu...")
    
    # Switch to left frame
    frames = driver.find_elements(By.TAG_NAME, "frame")
    found_frame = False
    for frame in frames:
        name = frame.get_attribute("name")
        lid = frame.get_attribute("id")
        if name == "left_frame" or lid == "menu-iframe":
            driver.switch_to.frame(frame)
            found_frame = True
            break
    
    if not found_frame:
        print("!! Could not find menu frame. Trying default 'menu-iframe'...")
        try:
            driver.switch_to.frame("menu-iframe")
        except:
            print("!! Still failed. Trying to find by content...")

    # Click Menu
    try:
        menu_item = WebDriverWait(driver, 5).until(
            EC.element_to_be_clickable((By.XPATH, "//div[contains(text(), '지출결의서')]"))
        )
        menu_item.click()
        print(">> Clicked '지출결의서'")
    except:
        print("!! Failed to click menu item. Trying Span...")
        driver.find_element(By.XPATH, "//span[contains(text(), '지출결의서')]").click()

    driver.switch_to.default_content()
    time.sleep(2)

    # 3. Click "신규작성" (New Write)
    # Inside 'details-iframe' or 'main_frame'
    print(">> Looking for '신규작성' button...")
    
    frames = driver.find_elements(By.TAG_NAME, "frame")
    for frame in frames:
        name = frame.get_attribute("name")
        # usually main_frame or details-iframe
        if "main" in name or "detail" in name:
            driver.switch_to.frame(frame)
            try:
                btn = driver.find_element(By.NAME, "gift_ask_input")
                btn.click()
                print(">> Clicked '신규작성'")
                break
            except:
                driver.switch_to.default_content()
                continue
    
    # 4. Handle Popup / New Window
    print(">> Waiting for Write Form window...")
    time.sleep(3)
    
    # Switch to new window handle
    current_window = driver.current_window_handle
    all_windows = driver.window_handles
    
    new_window = None
    for w in all_windows:
        if w != current_window:
            new_window = w
            break
            
    if new_window:
        driver.switch_to.window(new_window)
        print(">> Switched to new window.")
    else:
        print("!! New window not found. Automation might fail from here.")

    # 5. Fill Form
    print(">> Filling Form...")
    
    # Title
    try: WebDriverWait(driver, 10).until(EC.presence_of_element_located((By.NAME, "subject")))
    except: print("!! Could not find subject field.")

    driver.find_element(By.NAME, "subject").send_keys(data.get("description", ""))
    
    # Date
    date_val = data.get("date", "").replace("-", "")
    try:
        driver.find_element(By.NAME, "sday").clear()
        driver.find_element(By.NAME, "sday").send_keys(date_val)
    except: pass

    # Tree Categories
    # "다음세대사역위원회" -> "다음세대지원" -> "유치부" -> [Category]
    def click_tree(text):
        try:
            el = WebDriverWait(driver, 2).until(EC.element_to_be_clickable((By.XPATH, f"//*[contains(text(), '{text}')]")))
            el.click()
            time.sleep(0.5)
        except:
            print(f"Warning: Could not click '{text}'")

    click_tree("다음세대사역위원회")
    click_tree("다음세대지원")
    click_tree("유치부")
    click_tree(data.get("category", ""))

    # Bank Info
    driver.find_element(By.NAME, "bank_user").send_keys(data.get("purchaser", ""))
    driver.find_element(By.NAME, "bank_name").send_keys(data.get("bank", ""))
    driver.find_element(By.NAME, "bank_num").send_keys(data.get("account", ""))
    
    # Officer Info
    driver.find_element(By.NAME, "writer").clear()
    driver.find_element(By.NAME, "writer").send_keys("박은혜")
    
    driver.find_element(By.NAME, "tel").clear()
    driver.find_element(By.NAME, "tel").send_keys("010-8607-3953")

    print("\n>> Automation Complete! Please verify and click Save.")
    
except Exception as e:
    print(f"\n!! An error occurred: {e}")
    import traceback
    traceback.print_exc()

print("\nPress Enter to close browser and exit...")
input()
try:
    driver.quit()
except: pass
