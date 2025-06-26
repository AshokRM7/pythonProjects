from selenium import webdriver
from selenium.webdriver.chrome.service import Service
from webdriver_manager.chrome import ChromeDriverManager

# Setup Chrome browser
driver = webdriver.Chrome(service=Service(ChromeDriverManager().install()))

# Open Udemy
driver.get("https://www.udemy.com")

# Optional: Maximize browser
driver.maximize_window()

# Wait for 5 seconds to see the page
import time
time.sleep(5)

# Close the browser
driver.quit()
