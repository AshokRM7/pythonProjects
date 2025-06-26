import pytest
from selenium import webdriver

@pytest.fixture
def browser():
    driver = webdriver.Chrome()  # or use ChromeDriverManager
    driver.maximize_window()
    yield driver
    driver.quit()
