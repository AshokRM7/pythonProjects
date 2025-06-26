from pytest_bdd import scenarios, given, when, then, parsers
import pytest
from selenium import webdriver
from webdriver_manager.chrome import ChromeDriverManager
from pages.login_page import LoginPage
from utils.config_reader import get_config

scenarios('login.feature')  # this assumes login.feature is inside the features dir

@pytest.fixture
def setup_driver():
    driver = webdriver.Chrome(ChromeDriverManager().install())
    driver.maximize_window()
    yield driver
    driver.quit()

@given("I launch the browser")
def launch_browser(setup_driver):
    # Setup config and page object
    config = get_config()
    return {"driver": setup_driver, "config": config}

@when("I open the Udemy homepage")
def open_homepage(launch_browser):
    driver = launch_browser["driver"]
    config = launch_browser["config"]
    page = LoginPage(driver)
    page.open_url(config["base_url"])

@then('I should see the title contains "Udemy"')
def validate_title(launch_browser):
    driver = launch_browser["driver"]
    assert "Udemy" in driver.title
